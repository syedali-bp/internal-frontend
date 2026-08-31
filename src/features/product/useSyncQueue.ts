import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { isReachable, subscribeToForeground, subscribeToReachability } from './connectivity'
import { hydrateSubmissions } from './submissionStore'
import { syncQueue, type SyncProgress } from './syncQueue'
import { useProductSubmissions } from './useProductSubmissions'

/**
 * Drives the offline queue: what is owed, and sending it.
 *
 * Sync runs automatically — on launch once the stored queue is read, when the
 * app returns to the foreground, and when a failed request later proves the
 * backend is answering again. A manual "Sync now" sits alongside it rather than
 * instead of it: automatic covers the ordinary case, and the button is what a
 * collector reaches for when they can see a signal bar and do not want to wait
 * to find out whether the app agrees.
 */
export function useSyncQueue() {
  const { submissions } = useProductSubmissions()
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  // Read by the effects below, which must not re-subscribe every time the
  // queue changes.
  const queuedCount = submissions.filter((entry) => entry.status === 'queued').length
  const queuedRef = useRef(queuedCount)
  queuedRef.current = queuedCount

  const counts = useMemo(
    () => ({
      queued: queuedCount,
      sent: submissions.filter((entry) => entry.status === 'draft').length,
      failed: submissions.filter((entry) => entry.status === 'failed').length,
      total: submissions.length,
    }),
    [queuedCount, submissions],
  )

  const runSync = useCallback(async () => {
    if (!queuedRef.current) return

    setLastError(null)
    try {
      const result = await syncQueue(setProgress)
      if (result.failed) {
        setLastError(
          `${result.failed} capture${result.failed === 1 ? '' : 's'} could not be sent, and stay queued.`,
        )
      }
    } catch (caught) {
      setLastError(caught instanceof Error ? caught.message : 'Sync failed')
    } finally {
      setProgress(null)
    }
  }, [])

  /**
   * What pull-to-refresh asks for: re-read the store, then try to send.
   *
   * Both halves matter. Another part of the app — or the last run — may have
   * left entries the in-memory store has not seen, and `runSync` deliberately
   * does nothing when the queue is empty, so hydrating alone would leave a
   * collector pulling with no effect. Unlike `runSync` this always awaits, so
   * the pull spinner lasts as long as the work does.
   */
  const refresh = useCallback(async () => {
    await hydrateSubmissions()
    if (queuedRef.current && isReachable()) await runSync()
  }, [runSync])

  // Whatever the last run left behind, read back before anything else.
  useEffect(() => {
    void hydrateSubmissions().then(() => {
      if (isReachable()) void runSync()
    })
  }, [runSync])

  useEffect(() => subscribeToForeground(() => void runSync()), [runSync])

  useEffect(
    () => subscribeToReachability((reachable) => { if (reachable) void runSync() }),
    [runSync],
  )

  return {
    submissions,
    counts,
    progress,
    lastError,
    isSyncing: progress !== null,
    syncNow: runSync,
    refresh,
  }
}
