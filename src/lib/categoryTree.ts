import type { Category, CategoryNode } from '../types/catalog'

function sortCategories(categories: readonly Category[]) {
  return [...categories].sort(
    (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name),
  )
}

/** Nests the flat category rows into a tree, keeping malformed records reachable. */
export function buildCategoryTree(categories: readonly Category[]): CategoryNode[] {
  const knownIds = new Set(categories.map((category) => category.id))
  const childrenByParent = new Map<string | null, Category[]>()

  categories.forEach((category) => {
    // A parent_id we never received is treated as a root so the record is not lost.
    const parentId =
      category.parent_id && knownIds.has(category.parent_id) ? category.parent_id : null
    const siblings = childrenByParent.get(parentId) ?? []
    siblings.push(category)
    childrenByParent.set(parentId, siblings)
  })

  const visited = new Set<string>()
  const toNode = (category: Category): CategoryNode => {
    visited.add(category.id)
    const children = sortCategories(childrenByParent.get(category.id) ?? [])
      // Skipping visited children breaks self-referencing / cyclic parent links.
      .filter((child) => !visited.has(child.id))
      .map(toNode)

    return { id: category.id, name: category.name, children }
  }

  const roots = sortCategories(childrenByParent.get(null) ?? []).map(toNode)
  // Anything trapped in a parent cycle has no root; surface it rather than drop it.
  sortCategories(categories).forEach((category) => {
    if (!visited.has(category.id)) roots.push(toNode(category))
  })

  return roots
}

/** Returns the chain of nodes from a root down to `id`, or null when absent. */
export function findCategoryTrail(
  nodes: readonly CategoryNode[],
  id: string,
): CategoryNode[] | null {
  for (const node of nodes) {
    if (node.id === id) return [node]

    const childTrail = findCategoryTrail(node.children, id)
    if (childTrail) return [node, ...childTrail]
  }

  return null
}

/** Human-readable path such as `Beverages › Carbonated Drinks › Cola`. */
export function formatCategoryPath(nodes: readonly CategoryNode[], id: string) {
  return (findCategoryTrail(nodes, id) ?? []).map((node) => node.name).join(' › ')
}
