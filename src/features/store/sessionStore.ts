import { useSyncExternalStore } from 'react'

import type { Vertical } from '../../types/catalog'
import { endSessionOnServer, type CollectionSession, type Store } from './storeApi'

/**
 * The visit in progress: one collection session, its store, and its vertical.
 *
 * Held outside React, like the capture queue in `submissionStore.ts`, so it
 * survives screens unmounting — a collector picks their store and vertical once
 * on arrival and captures against them for the whole visit rather than being
 * asked again between products.
 *
 * Not persisted. Keeping a session across app launches is out of scope, and a
 * stale visit silently resuming the next morning is worse than asking again.
 */

export type ActiveSession = {
  session: CollectionSession
  /** Null for a street-side supplier with no fixed store. */
  store: Store | null
  vertical: Vertical
}

let active: ActiveSession | null = null

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function startSession(next: ActiveSession) {
  active = next
  emit()
}

/**
 * Ends the visit — a new store or vertical means a new session.
 *
 * Clears the visit locally first and stamps `ended_at` on the server after, in
 * that order and without awaiting: every caller is a navigation handler, and
 * leaving a screen must not wait on a round trip or fail because the phone is
 * offline. The row staying open is a reporting inaccuracy; a collector stuck on
 * a screen is a broken app.
 *
 * The server also stamps `ended_at` itself for a PATCH with no body, so a visit
 * closed while offline is not lost — it is closed by whatever ends it next.
 */
export function endSession() {
  const ending = active
  active = null
  emit()

  if (ending) {
    void endSessionOnServer(ending.session).catch(() => {
      // Nothing to recover here: the visit is already over on this device, and
      // surfacing a network error on the way out of a screen would be noise.
    })
  }
}

export function getActiveSession() {
  return active
}

/**
 * Counts one more capture against the visit.
 *
 * `submission_count` is denormalised on the row, so the app keeps its own copy
 * in step rather than re-reading the session after every capture.
 */
export function countSubmission() {
  if (!active) return

  active = {
    ...active,
    session: { ...active.session, submission_count: active.session.submission_count + 1 },
  }

  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The visit in progress, re-rendering whatever reads it when it changes. */
export function useActiveSession() {
  return useSyncExternalStore(subscribe, getActiveSession)
}
