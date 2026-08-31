import { useMemo } from 'react'
import * as api from '../../api/api'
import type { Vertical } from '../../types/catalog'
import { LOCAL_VERTICALS } from './verticalFixtures'

/**
 * The verticals a product can be filed under, in display order.
 *
 * Read from `GET /api/catalog/verticals`. The fixtures remain as the fallback
 * for a query that has not answered yet or has failed: the picker is the first
 * thing a session needs, and an empty list there blocks the whole capture flow,
 * where a slightly stale list does not.
 */
export function useVerticals() {
  const query = api.useVerticals()

  const source: Vertical[] = query.data?.length ? query.data : LOCAL_VERTICALS

  const verticals: Vertical[] = useMemo(
    () =>
      source
        .slice()
        .sort(
          (a: Vertical, b: Vertical) =>
            (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
        ),
    [source],
  )

  return {
    verticals,
    isLoading: query.isLoading,
    // Only a real failure with nothing to show is worth reporting. While the
    // fixtures are standing in, the picker is usable and an error banner over a
    // working list is noise.
    error: query.data?.length ? null : query.error,
  }
}
