import * as api from '../../api/api'
import type { SubmissionPayload } from '../../types/product'
import {
  getPendingSubmissions,
  updateSubmission,
  type CapturedSubmission,
} from './submissionStore'
import { getActiveSession } from '../store/sessionStore'

/** What one pass over the queue did. */
export type SyncResult = {
  sent: number
  failed: number
  /** Photos that still have not uploaded, across every capture in the pass. */
  photosPending: number
}

export type SyncProgress = {
  /** Which capture is going now, 1-based, and how many the pass started with. */
  index: number
  total: number
}

/**
 * How many times a capture is sent before the queue stops offering it.
 *
 * A capture that has failed this often is not waiting on a connection: five
 * passes span reconnects, foregrounds and launches, so whatever is wrong is not
 * going to right itself. Retrying past here spends the collector's data on a
 * request that has already been refused five times, and hides the one capture
 * that needs a person behind a counter that never goes down.
 */
const MAX_SYNC_ATTEMPTS = 5

/**
 * Reads the HTTP status out of the error `request` throws.
 *
 * The message is built in api.ts as `Request failed ${status}: ${body}`. Parsed
 * from text rather than carried on a typed error because every call site
 * upstream already treats these as plain Errors; a typed error would be the
 * better shape and a much wider change.
 */
function statusOf(message: string): number | null {
  const matched = /^Request failed (\d{3}):/.exec(message)
  return matched ? Number(matched[1]) : null
}

/**
 * Whether sending this capture again could ever answer differently.
 *
 * A 4xx is the server having read the request and refused it — a malformed
 * body, a vertical id that is not a real one, a session that does not exist.
 * The same bytes will be refused the same way on every pass, so these stop
 * immediately rather than after five identical rejections.
 *
 * 408 and 429 are the exceptions: both are the server asking for the request
 * later, not saying no to it. 5xx and transport failures stay retryable.
 */
function isPermanentFailure(message: string): boolean {
  const status = statusOf(message)
  if (status === null) return false
  if (status === 408 || status === 429) return false

  return status >= 400 && status < 500
}

/**
 * Only one pass runs at a time.
 *
 * Auto-sync and the Sync now button can both fire at once — on reconnect while
 * a manual pass is already going, say. Two passes would read the same queued
 * entries and send each capture twice. The POST dedupes on `client_id`, so this
 * costs correctness nothing, but it doubles the upload traffic of a collector
 * who is on a connection bad enough to have queued in the first place.
 */
let running: Promise<SyncResult> | null = null

export function isSyncing() {
  return running !== null
}

/**
 * Uploads whatever photos this capture still owes and returns the media rows
 * with the results filled in.
 *
 * Rows that already carry a `public_url` are left alone: a capture may have got
 * its photos up on an earlier pass and failed only on the POST, and re-uploading
 * them would cost the collector's data for a file Cloudinary already holds.
 *
 * A photo that will not upload does not block the capture. The row keeps its
 * `local_uri`, the server records it as pending, and the next pass tries again.
 */
async function uploadPendingMedia(payload: SubmissionPayload) {
  let pending = 0

  const media = await Promise.all(
    payload.media.map(async (row) => {
      if (row.public_url) return row
      if (!row.local_uri) {
        pending += 1
        return row
      }

      try {
        const result = await api.uploadMedia(
          { uri: row.local_uri, name: row.file_name, type: row.mime_type },
          row.kind,
        )

        return {
          ...row,
          storage_key: result.storage_key,
          public_url: result.public_url,
          file_size: result.file_size,
          width: result.width,
          height: result.height,
          content_hash: result.content_hash,
        }
      } catch (caught) {
        pending += 1
        console.warn('Queued media upload failed', row.file_name, caught)
        return row
      }
    }),
  )

  return { media, pending }
}

/**
 * Sends everything queued, oldest first.
 *
 * Each capture is independent: one that fails is put back to `queued` with its
 * reason and the pass moves on, so a single bad photo or a server rejection
 * cannot strand the captures behind it. Nothing is removed from the queue on
 * failure, and nothing is sent twice — the POST is keyed on `client_id`, so a
 * capture that actually landed before the connection dropped is deduped by the
 * server rather than duplicated.
 *
 * Concurrent calls share one pass rather than starting a second.
 */
export function syncQueue(onProgress?: (progress: SyncProgress) => void): Promise<SyncResult> {
  if (running) return running

  running = (async () => {
    const pending = getPendingSubmissions()
    const result: SyncResult = { sent: 0, failed: 0, photosPending: 0 }

    for (let index = 0; index < pending.length; index += 1) {
      const entry: CapturedSubmission = pending[index]
      onProgress?.({ index: index + 1, total: pending.length })

      const attempts = (entry.attempts ?? 0) + 1
      updateSubmission(entry.id, { status: 'syncing', attempts, error: undefined })

      try {
        const { media, pending: photosPending } = await uploadPendingMedia(entry.payload)
        result.photosPending += photosPending

        // The body carries whatever the uploads achieved, so a later pass only
        // retries what is still missing.
        const body: SubmissionPayload = { ...entry.payload, media }

        // Captures queued before the app sent a session id have none stored, and
        // the server rejects those outright — so without this they retry forever
        // on every pass and can never drain. Adopting the open visit is the only
        // repair available on the device: the visit they were really made on was
        // never recorded, and a capture that reaches review attributed to the
        // current shop is worth more than one stuck in the queue.
        if (!body.session_id) {
          const active = getActiveSession()
          if (!active) {
            // Nothing to adopt. Say so plainly rather than sending a body the
            // server will only reject again.
            throw new Error('Start a store visit to sync this capture')
          }
          body.session_id = active.session.id
        }

        const stored = await api.submitProductSubmission<{
          submission?: { id?: string; match_type?: string }
          summary?: { match_type?: string }
        }>(body)

        updateSubmission(entry.id, {
          payload: body,
          status: 'draft',
          submissionId: stored?.submission?.id,
          // Recorded rather than alerted on: this pass runs in the background,
          // often while the collector is on another screen entirely, so the
          // review list is where they will see it.
          matchType: stored?.summary?.match_type ?? stored?.submission?.match_type,
          error: photosPending
            ? `Filed with ${photosPending} photo${photosPending === 1 ? '' : 's'} still to upload`
            : undefined,
        })

        result.sent += 1
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'Sync failed'

        // Back to queued for anything that could still go through — an
        // unreachable server is the ordinary case here, and the next pass
        // should pick it up untouched.
        //
        // `failed` is the other answer, and it is a terminal one: the queue
        // stops offering the capture, and the review row says NOT SENT with the
        // reason. Two ways to reach it — the server refused the body outright,
        // or it has now been refused enough times that the next attempt is not
        // worth the collector's data.
        const permanent = isPermanentFailure(message)
        const exhausted = attempts >= MAX_SYNC_ATTEMPTS

        if (permanent || exhausted) {
          updateSubmission(entry.id, {
            status: 'failed',
            // Says which of the two it was, because the fix differs: a refused
            // body needs someone to look at the capture, a run of failures
            // usually needs the connection looked at first.
            error: permanent
              ? message
              : `Gave up after ${attempts} attempts. ${message}`,
          })
        } else {
          updateSubmission(entry.id, { status: 'queued', error: message })
        }

        result.failed += 1
      }
    }

    return result
  })()

  const pass = running

  // Cleared however the pass ends, so a thrown pass cannot wedge the flag on
  // and leave sync permanently disabled for the rest of the session.
  void pass.finally(() => {
    running = null
  })

  return pass
}
