import type { AttributeDefinition, AttributeValues } from '../../types/catalog'
import type { ProductDetails, Variant } from '../../types/product'
import { isAttributeMissing, isNumericAnswerInvalid } from './attributeValues'

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
  /**
   * True when this capture adds to a product the catalog already holds.
   *
   * A contribution is held to a different standard, because it is answering a
   * different question. A new product has to arrive complete enough to become a
   * catalog row — every required attribute, at least one variant, a default
   * among them. A contribution is somebody standing at a shelf adding the photo
   * that was missing: the product already exists, its variants already exist,
   * and the fields it is missing are exactly the ones the server asked for.
   *
   * Demanding the full set here asked the collector to re-describe a pack the
   * catalog had already described — from fields the screen locks against them,
   * which made the form impossible to submit rather than merely tedious.
   */
  contributing = false,
): string[] {
  const errors: string[] = []

  if (!details.name.trim()) errors.push('Product name is required.')
  if (!details.verticalId) errors.push('Product vertical is required.')
  if (!details.categoryId) errors.push('Category is required.')

  // Checked before the contribution early-return below, because an unreadable
  // number is wrong whoever typed it: a contribution carries its answers to the
  // server exactly as a new product does. Silently dropping it would file the
  // capture with the field blank and tell the collector nothing.
  productLevel.forEach((definition) => {
    if (isNumericAnswerInvalid(definition, values[definition.code] ?? '')) {
      errors.push(`${definition.name} must be a number.`)
    }
  })

  // Everything below describes a product being created. A contribution adds to
  // one that already exists, so its variants and attributes are already on file.
  if (contributing) return errors

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
      } else if (isNumericAnswerInvalid(axis, variant.axes[axis.code] ?? '')) {
        errors.push(`${label}: ${axis.name} must be a number.`)
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
