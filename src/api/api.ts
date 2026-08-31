import { useQuery, useMutation } from '@tanstack/react-query'
// The SDK's own fetch. It takes a spec-compliant body, which is what a multipart
// upload needs here — see the note on uploadMedia.
import { fetch as expoFetch } from 'expo/fetch'

import { getAccessToken } from '../features/auth/authSession'
import { setReachable } from '../features/product/connectivity'

/**
 * Where the catalog backend lives, from `EXPO_PUBLIC_API_URL` in `.env`.
 *
 * There is no default host on purpose. A browser would resolve a relative URL
 * against the page origin, but a native app has no page — so a blank base makes
 * every request a relative path with nothing to resolve against, and each one
 * fails as an opaque "Network request failed". Saying so explicitly is the
 * difference between a two-minute fix and hunting an empty dropdown.
 *
 * Note that `localhost` means *the device*, not the machine running the server:
 * an Android emulator reaches the host at 10.0.2.2, and a physical phone needs
 * the machine's LAN address.
 */
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || ''

/**
 * How long to wait before calling a request dead.
 *
 * `fetch` has no timeout of its own, and an address that is merely *unroutable*
 * — the wrong host for this device, a firewalled port — does not refuse the
 * connection, it silently drops it. Without a deadline the promise never
 * settles, so the UI sits in a loading state forever and never reaches the
 * error path that would explain why.
 */
const REQUEST_TIMEOUT_MS = 8000

/**
 * Options that are ours rather than fetch's.
 *
 * `unwrap: false` is for the auth endpoints: `/api/collect/login`, `/register`
 * and `/refresh` answer with the session object at the top level, where the
 * rest of the API nests its payload under `data`.
 */
type RequestOptions = {
  unwrap?: boolean
  /**
   * Internal. Set when a call is already the retry after a token refresh, so a
   * second 401 fails instead of refreshing again forever.
   */
  isRetry?: boolean
  /**
   * Set on the auth endpoints themselves. A 401 from `/refresh` means the
   * refresh token is dead — there is nothing to recover with, and trying would
   * re-enter the refresh that is already in flight and await itself. Deadlock.
   */
  noRefresh?: boolean
}

/**
 * How a 401 gets a fresh token.
 *
 * A callback registered by the auth layer rather than a direct import: authApi
 * imports this module, so importing it back would be a cycle. Returns true if a
 * new access token is now in place and the caller should retry.
 */
type TokenRefresher = () => Promise<boolean>

let refreshTokens: TokenRefresher | null = null

/** Wired once, on launch, by the auth layer. */
export function setTokenRefresher(refresher: TokenRefresher | null) {
  refreshTokens = refresher
}

/**
 * The refresh in flight, if any.
 *
 * Several requests can 401 at once — the capture screen loads categories,
 * attributes and brands together — and each must not start its own refresh: the
 * server rotates the refresh token, so the second call would present one the
 * first has already spent and log the collector out. They all await this one
 * promise instead.
 */
let refreshInFlight: Promise<boolean> | null = null

function refreshOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (refreshTokens?.() ?? Promise.resolve(false)).finally(() => {
      refreshInFlight = null
    })
  }

  return refreshInFlight
}

async function request<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
  options: RequestOptions = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set, so there is no server to call. ' +
        'Add it to .env (e.g. http://10.0.2.2:8080 for the Android emulator) ' +
        'and restart Expo — env vars are read at bundle time.',
    )
  }

  const target = `${API_BASE_URL}${url}`

  // AbortController rather than AbortSignal.timeout(): the former works on every
  // RN engine this app runs on.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  // Every authenticated call carries the collector's bearer token. Attached
  // here rather than at each call site so a new endpoint cannot forget it —
  // and skipped when absent, because login itself has no token yet.
  const token = getAccessToken()
  const headers = {
    ...(init?.headers as Record<string, string> | undefined),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  let res: Response
  try {
    res = await fetch(target, {
      credentials: 'include',
      ...init,
      headers,
      signal: controller.signal,
    })
  } catch (caught) {
    // Name the address that failed. "Network request failed" on its own gives
    // no way to tell a stopped server from the wrong host for this device.
    // The request never got an answer, so the backend is not reachable from
    // here. The offline queue watches this to know when to try again.
    setReachable(false)

    const aborted = caught instanceof Error && caught.name === 'AbortError'
    throw new Error(
      `${aborted ? `No answer from ${target} within ${timeoutMs / 1000}s` : `Could not reach ${target}`}. ` +
        'Check the backend is running, and that the host is right for this ' +
        'device: an Android emulator reaches your machine at 10.0.2.2, a ' +
        'physical phone needs its LAN IP.',
    )
  } finally {
    clearTimeout(timer)
  }

  // An answer of any status proves the host is up; a 4xx is the server
  // disagreeing with the request, not the connection failing.
  setReachable(true)

  if (!res.ok) {
    const text = await res.text()

    // An expired access token is the one failure worth handling rather than
    // reporting: refresh and replay the request once, so a collector who left
    // the app open overnight does not get an error they can only fix by
    // logging in again. Only once — `isRetry` stops a genuinely unauthorised
    // call from looping.
    if (res.status === 401 && !options.isRetry && !options.noRefresh && token && refreshTokens) {
      const refreshed = await refreshOnce()
      if (refreshed) {
        return request<T>(url, init, timeoutMs, { ...options, isRetry: true })
      }
    }

    throw new Error(`Request failed ${res.status}: ${text}`)
  }

  const json = await res.json()
  return (options.unwrap === false ? json : json.data) as T
}

/**
 * POST that returns the body as-is, for the auth endpoints whose response is
 * not wrapped in `data`.
 */
export async function postJsonRaw<T = any>(url: string, body: unknown): Promise<T> {
  return request<T>(
    url,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    },
    REQUEST_TIMEOUT_MS,
    // These are the auth endpoints. None of them can be rescued by a refresh,
    // and `/refresh` refreshing itself would deadlock.
    { unwrap: false, noRefresh: true },
  )
}

export async function fetcher<T = any>(url: string): Promise<T> {
  return request<T>(url)
}

/** One-shot POST for callers that own their own mutation, e.g. store creation. */
export async function postJson<T = any>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

/** One-shot PATCH for the same callers, e.g. ending a collection session. */
export async function patchJson<T = any>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

export const useGet = <T = any>(key: unknown[], url: string, options?: any) =>
  useQuery<T>({ queryKey: key as unknown[], queryFn: () => fetcher<T>(url), ...(options ?? {}) })

export const usePost = <T = any, V = any>(url: string) =>
  useMutation<T, Error, V>({ mutationFn: async (body: V) => request<T>(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) })

export const usePut = <T = any, V = any>(url: string) =>
  useMutation<T, Error, V>({ mutationFn: async (body: V) => request<T>(url, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) })

export const usePatch = <T = any, V = any>(url: string) =>
  useMutation<T, Error, V>({ mutationFn: async (body: V) => request<T>(url, { method: 'PATCH', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) })

export const useDelete = <T = any>(url: string) =>
  useMutation<T, Error, void>({ mutationFn: async () => request<T>(url, { method: 'DELETE' }) })

// Catalog hooks
// `options` is forwarded so a caller serving the list from fixtures can disable
// the query outright rather than letting it fail against an absent backend.
export const useVerticals = (options?: any) =>
  useGet(['catalog', 'verticals'], '/api/catalog/verticals', options)

export const useCategories = (verticalId?: string) => {
  const url = verticalId ? `/api/catalog/categories/${encodeURIComponent(verticalId)}` : '/api/catalog/categories'
  const key = verticalId ? ['catalog', 'categories', verticalId] : ['catalog', 'categories']
  return useGet(key, url, { enabled: verticalId !== undefined ? !!verticalId : true })
}

export const useManufacturers = () =>
  useGet(['catalog', 'manufacturers'], '/api/catalog/manufacturers')

export const useBrands = (manufacturerId?: string) => {
  const url = manufacturerId ? `/api/catalog/brands?manufacturer_id=${encodeURIComponent(manufacturerId)}` : '/api/catalog/brands'
  const key = manufacturerId ? ['catalog', 'brands', manufacturerId] : ['catalog', 'brands']
  return useGet(key, url)
}

export const useAttributes = (categoryId?: string) => {
  const url = categoryId ? `/api/catalog/attributes/${encodeURIComponent(categoryId)}` : '/api/catalog/attributes'
  const key = categoryId ? ['catalog', 'attributes', categoryId] : ['catalog', 'attributes']
  return useGet(key, url, { enabled: categoryId !== undefined ? !!categoryId : true })
}

/** What POST /media/upload answers: one file, already in Cloudinary. */
export type UploadedMedia = {
  kind: string
  storage_key: string
  public_url: string
  mime_type: string
  file_size: number
  width: number
  height: number
  content_hash: string
}

/**
 * Puts one captured file in Cloudinary and returns what it became.
 *
 * The bytes travel on their own, ahead of the submission, because they are the
 * part that fails on a bad connection: a failed upload then costs one photo to
 * retry rather than the whole capture. The submission that follows carries only
 * this metadata.
 *
 * No Content-Type is set — React Native fills it in from the FormData, and
 * setting it by hand loses the multipart boundary.
 */
/**
 * Puts one captured file in Cloudinary and returns what it became.
 *
 * Two ways of sending it, tried in order, because the supported one changed:
 *
 *  1. A Blob through `expo/fetch`. This is what the SDK documents now — its own
 *     source says plainly that "`uri` is not supported for React Native's
 *     FormData", so the body has to be real bytes rather than a file reference.
 *  2. The legacy `{ uri, name, type }` part through the global fetch, where the
 *     native networking layer opens the file itself.
 *
 * Form (2) is the older React Native idiom and is what threw
 * "Network request failed" on this device: the request never reached the server,
 * because it failed while the native layer was opening the file. It is kept as a
 * fallback rather than deleted, since it is the only path that works if reading
 * the file into memory ever fails.
 *
 * Neither form sets Content-Type — the boundary belongs to whichever
 * implementation builds the body, and naming the type by hand loses it.
 */
export const uploadMedia = async (
  file: { uri: string; name: string; type: string },
  kind?: string,
): Promise<UploadedMedia> => {
  if (!API_BASE_URL) {
    throw new Error('EXPO_PUBLIC_API_URL is not set, so there is no server to upload to.')
  }
  if (!file.uri) {
    throw new Error('the picker returned no file path for this photo')
  }

  const target = `${API_BASE_URL}/api/collect/media/upload`
  const name = file.name || 'photo.jpg'
  const type = file.type || 'image/jpeg'
  const attempts: string[] = []

  // These two attempts call fetch directly rather than going through
  // `request`, so the bearer token it would have added has to be added here.
  // Content-Type is left alone deliberately: the multipart boundary is
  // generated by FormData, and setting the header by hand loses it.
  const token = getAccessToken()
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined

  // ---- (1) the documented path: real bytes, sent by expo/fetch ----
  try {
    // The global fetch reads a file:// URI into memory; only expo/fetch is
    // fussy about the body, not about this.
    const local = await fetch(file.uri)
    const blob = await local.blob()

    const form = new FormData()
    form.append('file', blob, name)
    if (kind) form.append('kind', kind)

    return await send(
      () => expoFetch(target, { method: 'POST', body: form, headers: authHeaders }),
      target,
    )
  } catch (caught) {
    attempts.push(`blob upload: ${caught instanceof Error ? caught.message : String(caught)}`)
  }

  // ---- (2) the legacy path: hand the native layer a file reference ----
  try {
    const form = new FormData()
    form.append('file', { uri: file.uri, name, type } as any)
    if (kind) form.append('kind', kind)

    return await send(
      () => fetch(target, { method: 'POST', body: form, headers: authHeaders }),
      target,
    )
  } catch (caught) {
    attempts.push(`uri upload: ${caught instanceof Error ? caught.message : String(caught)}`)
  }

  // Both forms reported, so the message says which one got how far.
  throw new Error(attempts.join(' | '))
}

/**
 * Runs one upload attempt and reads the answer.
 *
 * The server's own words are passed through: "unsupported file type" and
 * "file is empty" are different problems with different fixes, and a caller that
 * only hears "upload failed" cannot tell them apart.
 */
async function send(attempt: () => Promise<Response>, target: string): Promise<UploadedMedia> {
  let res: Response
  try {
    res = await attempt()
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : String(caught)
    throw new Error(`could not reach ${target} (${detail})`)
  }

  const body = await res.text()
  if (!res.ok) {
    throw new Error(`server said ${res.status}: ${body.slice(0, 200)}`)
  }

  let parsed: { data?: UploadedMedia }
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error(`unreadable reply: ${body.slice(0, 120)}`)
  }

  if (!parsed.data?.public_url) {
    throw new Error('the upload returned no public_url, so there is nothing to store')
  }

  return parsed.data
}

/** Files one capture. Retry-safe on `client_id`: the first write is the one kept. */
export const submitProductSubmission = <T = any>(body: unknown): Promise<T> =>
  request<T>('/api/collect/product-submissions', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })

// Reference data the collector can create on the spot, so a product is never
// blocked by a brand the catalog has not heard of yet.
export const useCreateManufacturer = () => usePost<any, any>('/api/catalog/manufacturer/add')

export const useCreateBrand = () => usePost<any, any>('/api/catalog/brand/add')

// Variant operations
export const useCreateVariant = (productId: string) =>
  usePost<any, any>(`/api/catalog/products/${encodeURIComponent(productId)}/variants`)

export const useUpdateVariant = (variantId: string) =>
  usePatch<any, any>(`/api/catalog/variants/${encodeURIComponent(variantId)}`)

export const useDeleteVariant = (variantId: string) =>
  useDelete<any>(`/api/catalog/variants/${encodeURIComponent(variantId)}`)

export default {
  fetcher,
  useGet,
  usePost,
  usePut,
  usePatch,
  useDelete,
  useVerticals,
  useCategories,
  useManufacturers,
  useBrands,
  useAttributes,
  useCreateManufacturer,
  useCreateBrand,
  uploadMedia,
  submitProductSubmission,
  useCreateVariant,
  useUpdateVariant,
  useDeleteVariant,
}
