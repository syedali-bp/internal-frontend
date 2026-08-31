import type { SubmissionPayload } from '../../types/product'
import { loadQueue, saveQueue } from './queueStorage'

/**
 * Captures made in this session, newest first.
 *
 * The list lives outside React so it survives screens unmounting, and is
 * mirrored to device storage so it survives the app being backgrounded or
 * killed — a capture made underground or in a back room is worth nothing if
 * closing the app drops it.
 *
 * Storage is the mirror, not the source: reads are served from memory, and
 * every mutation writes the whole list back. That keeps `getSubmissions`
 * synchronous, which is what `useSyncExternalStore` requires of it.
 */

/**
 * How far a capture has got.
 *
 * `queued` has not reached the server yet — captured offline, or filed while
 * the send failed. `draft` is a capture the server has accepted and no
 * moderator has looked at yet, which the review queue holds as `pending`; the
 * app says draft because that is what it means to the collector: filed, not yet
 * judged. `failed` was refused by the server for a reason retrying will not fix.
 */
export type CaptureStatus = 'queued' | 'syncing' | 'draft' | 'failed'

export type CapturedSubmission = {
  /** The capture's own id — the same `client_id` the payload carries. */
  id: string
  payload: SubmissionPayload
  status: CaptureStatus
  /** The server's id for it, once it has one. */
  submissionId?: string
  /** Why it did not reach the server, when it did not. */
  error?: string
  /** How many send attempts this capture has had, for display and backoff. */
  attempts?: number
  /**
   * What the server decided this capture is: `new_product`, `existing_variant`,
   * or `possible_duplicate`. Kept so the review list can keep saying a capture
   * looks like a duplicate — a one-off alert at submit time is gone the moment
   * it is dismissed, and a capture that synced in the background never showed
   * one at all.
   */
  matchType?: string
}

let submissions: CapturedSubmission[] = []

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

/** Applies a change to the list, tells React, and mirrors it to storage. */
function commit(next: CapturedSubmission[]) {
  submissions = next
  emit()
  void saveQueue(next)
}

/**
 * Reads any queue left behind by a previous run.
 *
 * Anything caught mid-send when the app died is put back to `queued`: the POST
 * is retry-safe on `client_id`, so re-sending a capture that did land is
 * harmless, while leaving it `syncing` would strand it forever.
 */
export async function hydrateSubmissions(): Promise<void> {
  const stored = await loadQueue()
  if (!stored.length) return

  const restored = stored.map((entry) =>
    entry.status === 'syncing' ? { ...entry, status: 'queued' as const } : entry,
  )

  // Anything captured since hydration started wins: it is newer, and the
  // collector is looking at it.
  const live = new Set(submissions.map((entry) => entry.id))
  commit([...submissions, ...restored.filter((entry) => !live.has(entry.id))])
}

/** Files one capture. A repeated `client_id` replaces the earlier attempt. */
export function addSubmission(
  payload: SubmissionPayload,
  status: CaptureStatus,
  extra?: { submissionId?: string; error?: string; attempts?: number; matchType?: string },
): CapturedSubmission {
  const entry: CapturedSubmission = {
    id: payload.client_id,
    payload,
    status,
    submissionId: extra?.submissionId,
    error: extra?.error,
    attempts: extra?.attempts,
    matchType: extra?.matchType,
  }

  commit([entry, ...submissions.filter((existing) => existing.id !== entry.id)])

  return entry
}

/**
 * Changes one capture in place, keeping its position in the queue.
 *
 * Sync reports progress per item, and an entry that jumped to the top each time
 * its status changed would reorder the list under the collector as it ran.
 */
export function updateSubmission(
  id: string,
  changes: Partial<Omit<CapturedSubmission, 'id'>>,
): void {
  let changed = false

  const next = submissions.map((entry) => {
    if (entry.id !== id) return entry
    changed = true
    return { ...entry, ...changes }
  })

  if (changed) commit(next)
}

export function removeSubmission(id: string) {
  commit(submissions.filter((entry) => entry.id !== id))
}

export function clearSubmissions() {
  commit([])
}

/** Stable snapshot — the same reference until something actually changes. */
export function getSubmissions() {
  return submissions
}

/** The captures still owed to the server, oldest first — the order they send in. */
export function getPendingSubmissions(): CapturedSubmission[] {
  return submissions.filter((entry) => entry.status === 'queued').reverse()
}

export function subscribeToSubmissions(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
