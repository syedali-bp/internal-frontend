import * as api from '../../api/api'
import type { AttributeDefinition } from '../../types/catalog'

/**
 * A stable stand-in for a query that has not answered yet.
 *
 * It has to be one shared array rather than a fresh `[]` per render: these
 * definitions are what `splitDefinitions` memoises on, and the axes it produces
 * are what `useLocalVariants` watches to decide the category has changed. A new
 * empty array every render therefore looked like a new set of axes every render,
 * which cleared the captured variants and re-rendered — on loop, for as long as
 * no category was selected.
 */
const NO_DEFINITIONS: AttributeDefinition[] = []

/**
 * Fetch attribute definitions from the backend for a category. Returns
 * `{ definitions }` to match the previous local hook shape.
 */
export function useAttributes(categoryId: string) {
  const query = api.useAttributes(categoryId)
  const definitions: AttributeDefinition[] = query.data ?? NO_DEFINITIONS
  return { definitions, isLoading: query.isLoading, error: query.error }
}
