import type { SubmissionPayload } from '../../types/product'

/**
 * Captures made in this session, newest first.
 *
 * Nothing leaves the device, so "submitting" means filing the capture here and
 * the review screen reads it back. The list lives outside React so it survives
 * the screen being unmounted between captures, and is dropped when the app is
 * closed.
 */

export type CapturedSubmission = {
  /** The capture's own id — the same `client_id` the payload carries. */
  id: string
  payload: SubmissionPayload
}

let submissions: CapturedSubmission[] = []

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

/** Files one capture. A repeated `client_id` replaces the earlier attempt. */
export function addSubmission(payload: SubmissionPayload): CapturedSubmission {
  const entry: CapturedSubmission = { id: payload.client_id, payload }

  submissions = [entry, ...submissions.filter((existing) => existing.id !== entry.id)]
  emit()

  return entry
}

export function removeSubmission(id: string) {
  submissions = submissions.filter((entry) => entry.id !== id)
  emit()
}

export function clearSubmissions() {
  submissions = []
  emit()
}

/** Stable snapshot — the same reference until something actually changes. */
export function getSubmissions() {
  return submissions
}

export function subscribeToSubmissions(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
