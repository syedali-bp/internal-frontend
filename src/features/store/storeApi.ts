import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import * as api from '../../api/api'
import { capturePosition } from './location'

/**
 * Every assumption this app makes about stores and collection sessions, in one
 * file.
 *
 * Wired to the real backend. Both live on the collector surface at
 * `/api/collect/*`, which requires a collector token — `request` in api.ts
 * attaches it — and stamps `collector_id` from that token rather than from
 * anything sent here.
 */

const STORES_URL = '/api/collect/stores'
const DUPLICATES_URL = '/api/collect/stores/check-duplicates'
const SESSIONS_URL = '/api/collect/collection-sessions'
const STORES_KEY = ['catalog', 'stores']

/** `catalog_stores.store_type`. */
/**
 * The trades offered as chips.
 *
 * `other` is deliberately absent: the Add Store form offers a free-text box
 * beside these instead, because the trades a collector meets in the field
 * outrun any list written here, and "Other" recorded nothing about what the
 * shop actually was. Rows created before that change still hold `other`, which
 * `storeTypeLabel` renders as-is.
 */
export const STORE_TYPES = [
  { value: 'mart', label: 'Mart' },
  { value: 'supermarket', label: 'Supermarket' },
  { value: 'hardware_store', label: 'Hardware store' },
  { value: 'computer_shop', label: 'Computer shop' },
  { value: 'mobile_shop', label: 'Mobile shop' },
  { value: 'wholesaler', label: 'Wholesaler' },
] as const

/** One of the chips above. Kept for the filter row, which only offers those. */
export type FixedStoreType = (typeof STORE_TYPES)[number]['value']

/**
 * What actually travels on the wire.
 *
 * A plain string rather than the union: the server accepts any normalised
 * value now, so a custom trade typed in the field is as valid as a chip, and
 * an empty string means the collector left it unclassified.
 */
export type StoreType = string

/** `catalog_stores.status`. Set by the app, never by the collector. */
export type StoreStatus = 'active' | 'merged' | 'pending_review'

/** One row of `catalog_stores`. */
export type Store = {
  id: string
  name: string
  store_type: StoreType
  address: string
  city: string
  region: string
  /** GPS at creation. Null when the device would not give a position. */
  latitude: number | null
  longitude: number | null
  status: StoreStatus
  created_by_collector_id: string | null
}

/**
 * One store the shop being added might already be.
 *
 * Matched on position first — two GPS reads of one shop are metres apart, and
 * no two shops share a doorway — then on name, city and address. `confidence`
 * is 0-100 and `reasons` says in words why it matched, so the collector can
 * weigh it rather than being told to trust a number.
 */
export type StoreDuplicateCandidate = {
  store_id: string
  name: string
  store_type: StoreType
  address: string
  city: string
  region: string
  status: StoreStatus
  latitude: number | null
  longitude: number | null
  /** Metres away. Null when either side has no coordinates — matched on name alone. */
  distance_meters: number | null
  confidence: number
  reasons: string[]
}

/**
 * Thrown by `useCreateStore` when the server refused the create because the
 * shop looks like one already in the catalog.
 *
 * A distinct error type rather than a message, because the screen has to render
 * the candidates rather than print them: the collector picks the existing store
 * or says none of them is it, and only they can tell two branches of one chain
 * apart.
 */
export class DuplicateStoreError extends Error {
  candidates: StoreDuplicateCandidate[]

  constructor(candidates: StoreDuplicateCandidate[]) {
    super('This store may already exist')
    this.name = 'DuplicateStoreError'
    this.candidates = candidates
  }
}

/**
 * Recovers the 409 payload from what `request` threw.
 *
 * The shared fetch wrapper flattens every failure to
 * `Request failed <status>: <body>`, so the candidates have to be dug back out
 * of the message. Done here rather than by widening `request`, because this is
 * the only caller that needs the body of a failure, and the wrapper's contract
 * — errors are strings — is what every other screen is written against.
 */
function asDuplicateError(error: unknown): DuplicateStoreError | null {
  if (!(error instanceof Error)) return null

  const match = /^Request failed 409: (.*)$/s.exec(error.message)
  if (!match) return null

  try {
    const body = JSON.parse(match[1])
    if (!body?.duplicate || !Array.isArray(body.candidates)) return null
    return new DuplicateStoreError(body.candidates as StoreDuplicateCandidate[])
  } catch {
    // A 409 whose body is not the shape we expect is still a real failure, and
    // reporting it as "no duplicates" would be worse than letting the original
    // error through.
    return null
  }
}

/** What the collector fills in. Status and creator are added by `useCreateStore`. */
export type NewStoreInput = {
  name: string
  store_type: StoreType
  address: string
  city: string
  region: string
  /**
   * Where the store is, when the address was picked from Places rather than
   * typed. Optional because a typed address has no coordinates to offer, and
   * both columns are nullable.
   */
  latitude?: number | null
  longitude?: number | null
  /**
   * The collector's answer to the duplicates they were shown: none of these is
   * the shop I am standing in, save it anyway. Absent on the first attempt,
   * which is what makes the server ask the question at all.
   */
  force?: boolean
}

/** One row of `catalog_collection_sessions`. */
export type CollectionSession = {
  id: string
  collector_id: string
  /** Null for a street-side supplier with no fixed store. */
  store_id: string | null
  vertical_id: string
  started_at: string
  /** Null while the visit is still open. Set by `useEndSession`. */
  ended_at: string | null
  start_latitude: number | null
  start_longitude: number | null
  submission_count: number
  notes: string
  created_at: string
  updated_at: string
}

/** The filters the list screen offers. Sent as query params to the real endpoint. */
export type StoreFilters = {
  search?: string
  store_type?: StoreType | ''
  city?: string
}

function storesUrl(filters: StoreFilters) {
  const params = new URLSearchParams()
  if (filters.search?.trim()) params.set('search', filters.search.trim())
  if (filters.store_type) params.set('store_type', filters.store_type)
  if (filters.city?.trim()) params.set('city', filters.city.trim())

  const query = params.toString()
  return query ? `${STORES_URL}?${query}` : STORES_URL
}

/**
 * The stores a capture can be filed against.
 *
 * Retries once rather than the default three: with an 8s per-request deadline,
 * three retries with backoff leave the screen loading for over half a minute
 * before saying anything. Same convention as the other reference data.
 */
export function useStores(filters: StoreFilters) {
  return useQuery<Store[]>({
    queryKey: [...STORES_KEY, filters],
    queryFn: async () => {
      return api.fetcher<Store[]>(storesUrl(filters))
    },
    retry: 1,
  })
}

/**
 * Creates a store as captured by a collector.
 *
 * `status` and `created_by_collector_id` are set here rather than being asked
 * for: a store added from the field has not been reviewed by anyone, and who
 * added it is a fact about the session rather than a choice.
 */
/**
 * Fills in the coordinates a store is saved and matched with.
 *
 * A picked address already carries the shop's own coordinates, and those beat
 * the device's: the phone reports where the collector is standing, which is the
 * car park as readily as the shop. Only fall back to GPS when the address was
 * typed.
 *
 * Shared by the create and the duplicate check so both ask the same question of
 * the same point — checking against the typed address and then saving against a
 * GPS fix would look for the store in one place and file it in another.
 */
async function withPosition(input: NewStoreInput, collectorId: string) {
  const picked = input.latitude != null && input.longitude != null

  // Best-effort: a collector who denies location still gets their store.
  const position = picked ? null : await capturePosition()

  return {
    ...input,
    latitude: picked ? input.latitude : (position?.latitude ?? null),
    longitude: picked ? input.longitude : (position?.longitude ?? null),
    status: 'pending_review' as const,
    created_by_collector_id: collectorId,
  }
}

/**
 * Asks what the store being added might already be, without creating anything.
 *
 * Called while the Add Store form is still open, so a collector who sees the
 * shop they are standing in never creates the duplicate at all — the 409 on
 * save is the backstop for when they did not look.
 *
 * Never throws: a lookup that fails must not stop a store being saved, and the
 * server checks again on create regardless.
 */
export async function checkStoreDuplicates(
  input: NewStoreInput,
  collectorId: string,
): Promise<StoreDuplicateCandidate[]> {
  try {
    const body = await withPosition(input, collectorId)
    return await api.postJson<StoreDuplicateCandidate[]>(DUPLICATES_URL, body)
  } catch {
    return []
  }
}

export function useCreateStore(collectorId: string) {
  const queryClient = useQueryClient()

  return useMutation<Store, Error, NewStoreInput>({
    mutationFn: async (input) => {
      const body = await withPosition(input, collectorId)

      try {
        return await api.postJson<Store>(STORES_URL, body)
      } catch (error) {
        // A 409 here is not a failure so much as a question: the server found
        // stores this one might already be, and the collector is the only
        // person who can say. Rethrown as a typed error so the screen renders
        // them rather than printing a message.
        const duplicate = asDuplicateError(error)
        if (duplicate) throw duplicate
        throw error
      }
    },
    onSuccess: () => {
      // Every filter combination is now stale, and the collector is about to
      // select this row out of one of them.
      void queryClient.invalidateQueries({ queryKey: STORES_KEY })
    },
  })
}

/** What starting a session needs from the caller. The rest is filled in here. */
export type NewSessionInput = {
  collectorId: string
  /** Null for a street-side supplier with no fixed store. */
  storeId: string | null
  verticalId: string
  notes?: string
}

/** Opens a collection session for one visit. */
export function useStartSession() {
  return useMutation<CollectionSession, Error, NewSessionInput>({
    mutationFn: async (input) => {
      const position = await capturePosition()

      const body = {
        collector_id: input.collectorId,
        store_id: input.storeId,
        vertical_id: input.verticalId,
        started_at: new Date().toISOString(),
        start_latitude: position?.latitude ?? null,
        start_longitude: position?.longitude ?? null,
        notes: input.notes ?? '',
      }

      return api.postJson<CollectionSession>(SESSIONS_URL, body)
    },
  })
}

/** What closing a session needs. The end time is stamped here. */
export type EndSessionInput = {
  session: CollectionSession
}

/**
 * Closes one visit server-side.
 *
 * Plain function rather than a hook, because the four places a visit ends are
 * navigation handlers — a `useCallback` and three JSX callbacks — where a hook
 * cannot be called. `useEndSession` below wraps this for screens that want the
 * mutation's pending and error state.
 */
export async function endSessionOnServer(session: CollectionSession): Promise<CollectionSession> {
  return api.patchJson<CollectionSession>(`${SESSIONS_URL}/${session.id}`, {
    ended_at: new Date().toISOString(),
  })
}

/**
 * Closes a collection session.
 *
 * Takes the whole row rather than an id because the local-data path has no
 * store to read the rest back out of, and the caller already holds it — the
 * visit in progress lives in `sessionStore`.
 */
export function useEndSession() {
  return useMutation<CollectionSession, Error, EndSessionInput>({
    mutationFn: ({ session }) => endSessionOnServer(session),
  })
}

export function storeTypeLabel(value: StoreType) {
  const known = STORE_TYPES.find((type) => type.value === value)
  if (known) return known.label
  if (!value) return ''

  // A custom trade is stored normalised ("tuck_shop"), which is not how anyone
  // wrote it. Undo that for display so the chip reads "Tuck shop".
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
