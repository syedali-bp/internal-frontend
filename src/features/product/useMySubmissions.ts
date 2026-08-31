import { useQuery } from '@tanstack/react-query'

import * as api from '../../api/api'

/**
 * One of the collector's own captures, as review left it.
 *
 * A subset of `catalog_submissions`: the fields this screen shows, not the
 * whole row. The statuses and the rejection reason are the server's own — this
 * is a second reading of the moderation queue's data, not a second copy of it.
 */
export type MySubmission = {
  id: string
  entered_name: string
  entered_brand: string | null
  entered_category_path: string | null
  /** pending, in_review, approved, partially_approved, rejected, duplicate. */
  review_status: string
  /** Set by the moderator who rejected it. Null on every other status. */
  rejection_reason: string | null
  /** Device clock at capture time. */
  captured_at: string
  reviewed_at: string | null
  observed_price: number | null
  currency: string
}

/** The three outcomes the screen speaks in, folded from the server's six. */
export type SubmissionOutcome = 'pending' | 'accepted' | 'rejected'

/**
 * Maps a review status onto what the collector is told.
 *
 * The server distinguishes more states than a collector needs: `in_review` is
 * still waiting from their side, and `partially_approved` did reach the
 * catalog. `duplicate` is grouped with rejected because the capture was closed
 * without being added — and the reason field explains it when one was given.
 */
export function outcomeOf(status: string): SubmissionOutcome {
  switch (status) {
    case 'approved':
    case 'partially_approved':
      return 'accepted'
    case 'rejected':
    case 'duplicate':
      return 'rejected'
    default:
      return 'pending'
  }
}

/**
 * The signed-in collector's own submissions.
 *
 * No collector id is passed: the server reads it from the access token, so
 * this cannot be pointed at anyone else's captures. `status=all` because the
 * point of the screen is the decided ones as much as the waiting ones.
 */
export function useMySubmissions() {
  return useQuery<MySubmission[]>({
    queryKey: ['collect/my-submissions'],
    queryFn: () => api.fetcher<MySubmission[]>('/api/collect/product-submissions?status=all'),
    // A moderator may have decided something since the screen was last opened,
    // so returning to it should show the current answer rather than a cached one.
    refetchOnMount: 'always',
  })
}
