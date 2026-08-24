import { useMemo } from 'react'
import * as api from '../../api/api'
import type { Vertical } from '../../types/catalog'

/** Shared empty list, so an unanswered query hands back a stable reference. */
const NO_VERTICALS: Vertical[] = []

/** The verticals a product can be filed under, in display order. */
export function useVerticals() {
  const query = api.useVerticals()
  const verticals: Vertical[] = useMemo(
    () =>
      (query.data ?? NO_VERTICALS)
        .slice()
        .sort(
          (a: Vertical, b: Vertical) =>
            (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
        ),
    [query.data],
  )
  return { verticals, isLoading: query.isLoading, error: query.error }
}
