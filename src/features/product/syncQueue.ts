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
        // Back to queued, not failed: an unreachable server is the ordinary
        // case here, and the next pass should pick this up untouched.
        const message = caught instanceof Error ? caught.message : 'Sync failed'
        updateSubmission(entry.id, { status: 'queued', error: message })
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
