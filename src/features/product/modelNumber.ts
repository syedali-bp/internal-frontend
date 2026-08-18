import type { Vertical } from '../../types/catalog'

/**
 * Vertical codes whose products are identified by a manufacturer model number.
 * Anything else — groceries, for instance — has no such number, so the field
 * stays hidden there rather than collecting noise.
 */
export const MODEL_NUMBER_VERTICAL_CODES: readonly string[] = ['mobile', 'electronics']

/** True when the given vertical is one that asks for a model number. */
export function verticalUsesModelNumber(vertical: Vertical | undefined): boolean {
  if (!vertical) return false
  return MODEL_NUMBER_VERTICAL_CODES.includes(vertical.code.trim().toLowerCase())
}
