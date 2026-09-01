import { useMemo } from 'react'
import { buildCategoryTree } from '../../lib/categoryTree'
import * as api from '../../api/api'
import type { Category } from '../../types/catalog'

/** Shared empty list, so an unanswered query does not rebuild the tree per render. */
const NO_CATEGORIES: Category[] = []

/** The category tree for one vertical; empty until a vertical is chosen. */
export function useCategories(verticalId: string) {
  const query = api.useCategories(verticalId)
  const categories: Category[] = query.data ?? NO_CATEGORIES

  const tree = useMemo(() => buildCategoryTree(verticalId ? categories : []), [verticalId, categories])

  return { tree, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}
