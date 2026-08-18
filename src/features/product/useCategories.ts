import { useMemo } from 'react'

import { CATEGORIES_BY_VERTICAL } from '../../data/catalog'
import { buildCategoryTree } from '../../lib/categoryTree'

/** The category tree for one vertical; empty until a vertical is chosen. */
export function useCategories(verticalId: string) {
  const tree = useMemo(
    () => buildCategoryTree(verticalId ? (CATEGORIES_BY_VERTICAL[verticalId] ?? []) : []),
    [verticalId],
  )

  return { tree }
}
