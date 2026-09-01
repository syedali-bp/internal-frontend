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
 * Reads a typed number, or null when the text is not one.
 *
 * The same rule as `toNumber` in payload.ts, and deliberately so: both turn
 * what a collector typed into JSON, and a number that is only sometimes checked
 * is worse than one that never is. `Number` alone is not enough — it answers
 * NaN for "500ml" and for "1,200", and `JSON.stringify` writes NaN out as
 * `null`, so an unguarded value does not fail loudly, it arrives at the catalog
 * as no answer at all.
 *
 * Infinity is rejected for the same reason: `Number('1e999')` is finite in
 * neither JSON nor any column this lands in.
 */
export function parseNumeric(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Whether an answer is a number the payload can carry.
 *
 * Blank passes: an empty optional field is "not captured", which
 * `isAttributeMissing` judges separately. Only a filled field that cannot be
 * read as a number is wrong here.
 */
export function isNumericAnswerInvalid(
  definition: AttributeDefinition,
  value: AttributeValue,
): boolean {
  if (definition.data_type === 'number') {
    if (typeof value !== 'string') return false
    return !!value.trim() && parseNumeric(value) === null
  }

  if (definition.data_type === 'dimension' && Array.isArray(value)) {
    // A part-filled dimension is incomplete rather than invalid, and is already
    // reported as missing. Only a fully typed one is checked for readability.
    if (value.some((part) => !part.trim())) return false
    return value.some((part) => parseNumeric(part) === null)
  }

  return false
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
 *
 * An unreadable number is dropped too, rather than written out as NaN. Submit
 * is gated on `validateCapture`, which reports it to the collector first, so in
 * practice nothing reaches here unreadable — this is the backstop for the paths
 * that build a payload without that gate.
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

      const [length, width, height] = value.map(parseNumeric)
      // All three or none: a box recorded as 10 x null x 4 is not a smaller
      // measurement, it is an unreadable one, and half a dimension would be
      // read downstream as a real answer.
      if (length === null || width === null || height === null) return

      payload[definition.code] = { length, width, height, unit: definition.unit }
      return
    }

    if (Array.isArray(value)) {
      if (value.length) payload[definition.code] = value
      return
    }

    const trimmed = value.trim()
    if (!trimmed) return

    if (definition.data_type === 'number') {
      const parsed = parseNumeric(trimmed)
      if (parsed === null) return
      payload[definition.code] = parsed
      return
    }

    payload[definition.code] = trimmed
  })

  return payload
}
