import type { AttributeDefinition, AttributeValue, AttributeValues } from '../../types/catalog'

const DIMENSION_SLOTS = 3

export const DIMENSION_LABELS = ['L', 'W', 'H'] as const

/**
 * Splits a category's attributes into the two places they are edited: the ones
 * flagged `is_variant_axis` define each variant, the rest describe the product.
 */
export function splitDefinitions(definitions: readonly AttributeDefinition[]) {
  return {
    productLevel: definitions.filter((definition) => !definition.is_variant_axis),
    variantAxes: definitions.filter((definition) => definition.is_variant_axis),
  }
}

/** A blank answer in whatever shape the data type's control edits. */
export function createInitialValue(definition: AttributeDefinition): AttributeValue {
  switch (definition.data_type) {
    case 'boolean':
      return false
    case 'multi_select':
      return []
    case 'dimension':
      return Array(DIMENSION_SLOTS).fill('')
    default:
      return ''
  }
}

/** Blank answers for a freshly loaded category. */
export function createInitialValues(definitions: readonly AttributeDefinition[]): AttributeValues {
  const values: AttributeValues = {}
  definitions.forEach((definition) => {
    values[definition.code] = createInitialValue(definition)
  })

  return values
}

/**
 * Whether a required attribute still needs an answer. A boolean is never
 * "missing" — an unchecked box is a deliberate "no", not an empty field.
 */
export function isAttributeMissing(definition: AttributeDefinition, value: AttributeValue) {
  if (typeof value === 'boolean') return false
  if (Array.isArray(value)) {
    return definition.data_type === 'dimension'
      ? value.some((part) => !part.trim())
      : value.length === 0
  }

  return !value.trim()
}

/**
 * Converts the edited answers into the JSON the submission carries, keyed by
 * attribute code. Blank optional answers are dropped rather than recorded as
 * empty strings.
 */
export function serializeAttributes(
  definitions: readonly AttributeDefinition[],
  values: AttributeValues,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  definitions.forEach((definition) => {
    const value = values[definition.code]
    if (value === undefined) return

    if (typeof value === 'boolean') {
      payload[definition.code] = value
      return
    }

    if (definition.data_type === 'dimension' && Array.isArray(value)) {
      if (value.some((part) => !part.trim())) return
      const [length, width, height] = value.map(Number)
      payload[definition.code] = { length, width, height, unit: definition.unit }
      return
    }

    if (Array.isArray(value)) {
      if (value.length) payload[definition.code] = value
      return
    }

    const trimmed = value.trim()
    if (!trimmed) return
    payload[definition.code] = definition.data_type === 'number' ? Number(trimmed) : trimmed
  })

  return payload
}
