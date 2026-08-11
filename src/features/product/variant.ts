import type { Variant } from '../../types/product'

export const INITIAL_VARIANTS: Variant[] = [
  { id: '1', color: 'Black', storage: '256GB', sku: 'SAM-S24-BLK-256', isDefault: true },
  { id: '2', color: 'Blue', storage: '512GB', sku: 'SAM-S24-BLU-512', isDefault: false },
]

let nextId = INITIAL_VARIANTS.length + 1

export function createVariant(): Variant {
  return {
    id: String(nextId++),
    color: '',
    storage: '',
    sku: '',
    isDefault: false,
  }
}
