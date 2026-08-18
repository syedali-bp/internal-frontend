import type { AttributeDefinition, AttributeValues } from '../../types/catalog'
import type { ProductDetails, Variant } from '../../types/product'
import { isAttributeMissing } from './attributeValues'

/**
 * Everything one submission must have before it is worth a moderator's time.
 * The form is checked in one pass now that the whole capture lives on one
 * screen — there is no half-saved draft to validate separately.
 */
export function validateCapture(
  details: ProductDetails,
  productLevel: readonly AttributeDefinition[],
  values: AttributeValues,
  axes: readonly AttributeDefinition[],
  variants: readonly Variant[],
): string[] {
  const errors: string[] = []

  if (!details.name.trim()) errors.push('Product name is required.')
  if (!details.verticalId) errors.push('Product vertical is required.')
  if (!details.categoryId) errors.push('Category is required.')

  productLevel.forEach((definition) => {
    if (!definition.is_required) return
    if (isAttributeMissing(definition, values[definition.code] ?? '')) {
      errors.push(`${definition.name} is required.`)
    }
  })

  if (variants.length === 0) errors.push('At least one variant is required.')

  const seenSkus = new Map<string, number>()
  const seenAxes = new Map<string, number>()

  variants.forEach((variant, i) => {
    const label = `Variant ${i + 1}`

    // Every axis must be answered — the axes are what tell two variants apart.
    axes.forEach((axis) => {
      if (isAttributeMissing(axis, variant.axes[axis.code] ?? '')) {
        errors.push(`${label}: ${axis.name} is required.`)
      }
    })

    const sku = variant.sku.trim()
    if (!sku) {
      errors.push(`${label}: SKU is required.`)
    } else {
      const firstSeen = seenSkus.get(sku.toUpperCase())
      if (firstSeen) errors.push(`${label}: SKU already used by variant ${firstSeen}.`)
      else seenSkus.set(sku.toUpperCase(), i + 1)
    }

    // Two variants with identical axis answers are the same sellable thing.
    // Only compare fully answered variants, so blanks are not reported twice.
    const isAnswered = axes.every((axis) => !isAttributeMissing(axis, variant.axes[axis.code] ?? ''))
    if (axes.length && isAnswered) {
      const key = axes.map((axis) => JSON.stringify(variant.axes[axis.code] ?? '')).join('|')
      const firstSeen = seenAxes.get(key)
      if (firstSeen) errors.push(`${label}: same options as variant ${firstSeen}.`)
      else seenAxes.set(key, i + 1)
    }
  })

  const defaults = variants.filter((variant) => variant.isDefault).length
  if (defaults === 0) errors.push('One variant must be marked as Default.')
  if (defaults > 1) errors.push('Only one variant can be marked as Default.')

  return errors
}
