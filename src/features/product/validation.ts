import type { ProductDetails, Variant } from '../../types/product'

/** Returns a list of human-readable problems; empty means the form is valid. */
export function validateProduct(details: ProductDetails, variants: Variant[]): string[] {
  const errors: string[] = []

  if (!details.name.trim()) errors.push('Product name is required.')
  if (variants.length === 0) errors.push('At least one variant is required.')

  variants.forEach((variant, i) => {
    if (!variant.color) errors.push(`Variant ${i + 1}: Color is required.`)
    if (!variant.storage) errors.push(`Variant ${i + 1}: Storage is required.`)
    if (!variant.sku.trim()) errors.push(`Variant ${i + 1}: SKU is required.`)
  })

  const defaults = variants.filter((variant) => variant.isDefault).length
  if (defaults === 0) errors.push('One variant must be marked as Default.')
  if (defaults > 1) errors.push('Only one variant can be marked as Default.')

  return errors
}
