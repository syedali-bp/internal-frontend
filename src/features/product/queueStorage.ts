import AsyncStorage from '@react-native-async-storage/async-storage'

import type { CapturedSubmission } from './submissionStore'

/**
 * Where the queue lives between app launches.
 *
 * AsyncStorage rather than expo-sqlite because it is already a dependency, and
 * because the shape here does not need a database: a working session is tens of
 * captures read and written whole, not thousands queried by predicate. SQLite
 * would buy indexing and partial reads that nothing in this flow asks for, at
 * the cost of a native module and a migration story.
 */
const QUEUE_KEY = 'catalog.capture.queue.v1'

/**
 * Writes are serialised through a promise chain.
 *
 * Every mutation rewrites the whole list, so two overlapping writes would race:
 * the slower read would win and silently drop whatever the faster one had just
 * added. Chaining costs nothing at this size and removes the class of bug.
 */
let lastWrite: Promise<void> = Promise.resolve()

/**
 * Reads the queue back.
 *
 * Unreadable storage returns an empty queue rather than throwing. A corrupt
 * value should cost the captures it held, not prevent the app from starting —
 * and there is nothing the collector could do about it either way.
 */
export async function loadQueue(): Promise<CapturedSubmission[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    // Anything without a payload is not a capture, whatever else it is.
    return parsed.filter(
      (entry): entry is CapturedSubmission =>
        !!entry && typeof entry === 'object' && !!entry.payload && typeof entry.id === 'string',
    )
  } catch (caught) {
    console.warn('Could not read the capture queue; starting empty', caught)
    return []
  }
}

/** Replaces the stored queue. Failures are logged, not thrown — see `loadQueue`. */
export function saveQueue(entries: readonly CapturedSubmission[]): Promise<void> {
  lastWrite = lastWrite
    .catch(() => {})
    .then(async () => {
      try {
        await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(entries))
      } catch (caught) {
        console.warn('Could not persist the capture queue', caught)
      }
    })

  return lastWrite
}

export function clearStoredQueue(): Promise<void> {
  return saveQueue([])
}
