import { useSyncExternalStore } from 'react'

import type { AuthSession, Collector as ApiCollector } from './authApi'
import { clearSession, loadSession, saveSession } from './authStorage'

/**
 * Who is signed in, for as long as the app is open.
 *
 * Sessions and collector-created stores are attributed to this id, so it has to
 * outlive the login screen that set it. Held outside React for the same reason
 * the capture queue is: screens unmount, the visit does not.
 *
 * Persisted to the device keystore by authStorage.ts, so a collector who has
 * signed in once stays signed in across launches. `restoreSession` reads it
 * back before the first screen renders.
 */
export type Collector = {
  /** `collector_id` on a collection session, `created_by_collector_id` on a store. */
  id: string
  /** The login identifier. Field staff have handsets, not mailboxes. */
  phone?: string
  /** Nullable server-side: many collectors have none. */
  email?: string | null
  first_name?: string
  last_name?: string
}

/**
 * The bearer token and its replacement.
 *
 * Kept beside the collector rather than in their own module because they have
 * the same lifetime: losing one without the other leaves the app either
 * unauthenticated with an identity, or authenticated as nobody.
 */
export type Tokens = {
  access_token: string
  refresh_token: string
}

let collector: Collector | null = null
let tokens: Tokens | null = null

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function signIn(next: Collector, nextTokens?: Tokens) {
  collector = next
  tokens = nextTokens ?? null
  emit()

  // Fire-and-forget: the session is already usable, and a keystore that refuses
  // the write costs a re-login next launch rather than this one.
  if (nextTokens) void saveSession(next, nextTokens)
}

/**
 * Takes a login or register response and signs that collector in.
 *
 * The one place the server's shape is turned into the app's, so a caller never
 * has to remember that the response nests the collector inside the session.
 */
export function signInWithSession(session: AuthSession) {
  const from: ApiCollector = session.collector

  signIn(
    {
      id: from.id,
      phone: from.phone,
      email: from.email,
      first_name: from.first_name,
      last_name: from.last_name,
    },
    { access_token: session.access_token, refresh_token: session.refresh_token },
  )
}

/** Replaces both tokens after a refresh. The server rotates the refresh token. */
export function setTokens(next: Tokens | null) {
  tokens = next
  emit()

  // The rotated pair has to replace what is on disk, or the next launch
  // restores a refresh token the server has already retired.
  if (next && collector) void saveSession(collector, next)
}

export function signOut() {
  collector = null
  tokens = null
  emit()

  void clearSession()
}

/**
 * Restores a persisted session, if there is one.
 *
 * Called once on launch, before the first screen decides whether to show the
 * login card. Returns whether a session was restored so the caller can route
 * without subscribing to the store first.
 *
 * The access token is not verified here — it may well have expired while the
 * app was closed. That is deliberate: the first authenticated request refreshes
 * it on a 401, which is one round trip instead of a blocking check on every
 * launch.
 */
export async function restoreSession(): Promise<boolean> {
  const stored = await loadSession()
  if (!stored) return false

  collector = stored.collector
  tokens = stored.tokens
  emit()

  return true
}

export function getCollector() {
  return collector
}

/** Read by the request helper to authorise a call. */
export function getAccessToken() {
  return tokens?.access_token ?? null
}

export function getRefreshToken() {
  return tokens?.refresh_token ?? null
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The signed-in collector, or null before sign-in. */
export function useCollector() {
  return useSyncExternalStore(subscribe, getCollector)
}
