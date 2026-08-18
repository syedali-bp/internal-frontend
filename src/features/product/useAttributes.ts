import { useMemo } from 'react'

import { ATTRIBUTES_BY_CATEGORY } from '../../data/catalog'

/**
 * The attribute definitions the selected category asks for. Clearing the
 * category, or picking one that defines none, gives an empty list.
 */
export function useAttributes(categoryId: string) {
  const definitions = useMemo(() => {
    const declared = categoryId ? (ATTRIBUTES_BY_CATEGORY[categoryId] ?? []) : []

    return [...declared].sort(
      (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name),
    )
  }, [categoryId])

  return { definitions }
}
