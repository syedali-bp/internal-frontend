import AsyncStorage from '@react-native-async-storage/async-storage'

import type { CaptureStatus, CapturedSubmission } from './submissionStore'
import type { SubmissionPayload } from '../../types/product'

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

const CAPTURE_STATUSES: readonly CaptureStatus[] = ['queued', 'syncing', 'draft', 'failed']

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** A string, or the empty string when the stored value was never one. */
function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Rebuilds one entry into something every consumer can hold, or rejects it.
 *
 * The old filter narrowed to `CapturedSubmission` with a type predicate, which
 * is an assertion rather than a check: it proved `payload` was truthy and said
 * nothing about what was inside it. That is why the compiler saw nothing wrong
 * while `ReviewProductsScreen` read `payload.product.attributes` straight off a
 * shape that an older build may never have written.
 *
 * Two outcomes, and no third:
 *
 *  - Reject, when there is no capture here to speak of — no id, no payload, or
 *    no product name. A row that cannot be identified or shown is not something
 *    the collector can act on, and keeping it only puts it in front of them.
 *  - Repair, for everything else. The containers a screen walks — `product`,
 *    `attributes`, `variants`, `media` — are replaced with empty ones when they
 *    are the wrong type, so a capture that lost a field to a shape change still
 *    lists, still shows its name, and still syncs.
 *
 * Repair is preferred over rejection because the queue is the app's durability
 * promise: an unsynced capture is work the collector cannot redo, and dropping
 * it silently to avoid a render bug trades a crash for data loss.
 */
function reviveEntry(entry: unknown): CapturedSubmission | null {
  if (!isObject(entry)) return null

  const id = entry.id
  if (typeof id !== 'string' || !id) return null

  if (!isObject(entry.payload)) return null
  const raw = entry.payload

  // The one field with no safe default. Every capture row leads with the
  // product name, and a blank one is a row the collector cannot recognise.
  const product = isObject(raw.product) ? raw.product : null
  if (!product || !str(product.name)) return null

  const payload = {
    ...raw,
    client_id: str(raw.client_id) || id,
    session_id: str(raw.session_id),
    scanned_barcode: str(raw.scanned_barcode),
    category_path: str(raw.category_path),
    captured_at: str(raw.captured_at),
    product: {
      ...product,
      name: str(product.name),
      brand_name: str(product.brand_name),
      default_uom: str(product.default_uom),
      // Read with Object.keys on the review screen, which throws on anything
      // that is not an object — null and undefined included.
      attributes: isObject(product.attributes) ? product.attributes : {},
    },
    notes: str(raw.notes),
    currency: str(raw.currency),
    observed_price: typeof raw.observed_price === 'number' ? raw.observed_price : null,
    // Both are mapped over and counted by `.length`, and `uploadPendingMedia`
    // walks media on every sync pass.
    variants: Array.isArray(raw.variants) ? raw.variants.filter(isObject) : [],
    media: Array.isArray(raw.media) ? raw.media.filter(isObject) : [],
  } as unknown as SubmissionPayload

  const status = entry.status
  const attempts = entry.attempts

  return {
    id,
    payload,
    // An unknown status would fall through every branch the review screen
    // tests and render as a draft, which is the one state that claims the
    // server has it. Anything unrecognised is treated as still to send.
    status: CAPTURE_STATUSES.includes(status as CaptureStatus)
      ? (status as CaptureStatus)
      : 'queued',
    submissionId: typeof entry.submissionId === 'string' ? entry.submissionId : undefined,
    error: typeof entry.error === 'string' ? entry.error : undefined,
    attempts: typeof attempts === 'number' && Number.isFinite(attempts) ? attempts : undefined,
    matchType: typeof entry.matchType === 'string' ? entry.matchType : undefined,
  }
}

/**
 * Reads the queue back.
 *
 * Unreadable storage returns an empty queue rather than throwing. A corrupt
 * value should cost the captures it held, not prevent the app from starting —
 * and there is nothing the collector could do about it either way.
 *
 * Every entry that survives has been rebuilt by `reviveEntry`, so what callers
 * get back is safe to render and to send. Nothing is passed through as stored.
 */
export async function loadQueue(): Promise<CapturedSubmission[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    const entries: CapturedSubmission[] = []
    let dropped = 0

    for (const candidate of parsed) {
      const revived = reviveEntry(candidate)
      if (revived) entries.push(revived)
      else dropped += 1
    }

    // Worth a line in the log: a queue that shrinks across an update is the
    // first thing to look at if a collector says captures went missing.
    if (dropped) {
      console.warn(`Dropped ${dropped} unreadable capture(s) from the queue`)
    }

    return entries
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
