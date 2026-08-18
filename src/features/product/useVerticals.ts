import { useMemo } from 'react'

import { VERTICALS } from '../../data/catalog'

/** The verticals a product can be filed under, in display order. */
export function useVerticals() {
  const verticals = useMemo(
    () =>
      [...VERTICALS].sort(
        (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name),
      ),
    [],
  )

  return { verticals }
}
