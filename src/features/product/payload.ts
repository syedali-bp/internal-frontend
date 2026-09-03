import type { AttributeDefinition, AttributeValues } from '../../types/catalog'
import type {
  PackagingLevelDraft,
  ProductDetails,
  SubmissionPayload,
  Variant,
} from '../../types/product'
import { serializeAttributes } from './attributeValues'
import { serializeMedia, type MediaItem, type UploadedFields } from './media'

/** Where and when the capture happened, as opposed to what was captured. */
export type CaptureContext = {
  /** Device-generated id for this capture; the same one across retries. */
  clientId: string
  /**
   * The open visit's session id, from `sessionStore`.
   *
   * Carried on the capture rather than read at send time on purpose: a queued
   * capture belongs to the visit it was made on, and syncing it later — after
   * the collector has moved to the next shop — must not re-attribute it to
   * whichever session happens to be open then.
   */
  sessionId: string
  /** Raw scan value, empty when the product was added without scanning. */
  barcode: string
  /** Category breadcrumb as picked in the app. */
  categoryPath: string
  /**
   * Display names for the manufacturer and brand the details hold ids for.
   *
   * Resolved by the screen from the lists the pick came from, for the same
   * reason `categoryPath` is: the submission carries what was captured, not the
   * reference data it was captured against. Blank when nothing was picked.
   */
  manufacturerName: string
  brandName: string
}

/**
 * The captured fields the submission has no field of its own for. They travel
 * inside the attributes map, alongside the category's own answers, so nothing
 * typed by the collector is dropped. Blank answers are left out rather than
 * recorded as empty values.
 */
function captureAttributes(details: ProductDetails): Record<string, unknown> {
  const extra: Record<string, unknown> = {}

  const modelNumber = details.modelNumber.trim()
  if (modelNumber) extra.model_number = modelNumber
  if (details.tags.length) extra.tags = details.tags
  if (details.countryOfOrigin) extra.country_of_origin = details.countryOfOrigin

  // catalog_submissions records the brand as free text (`entered_brand`) to be
  // matched at review, so it has no column for a resolved id. The app now knows
  // the real ones, and they are worth strictly more than the name — so they ride
  // here, the same way model_number and tags already do.
  if (details.manufacturerId) extra.manufacturer_id = details.manufacturerId
  if (details.brandId) extra.brand_id = details.brandId

  return extra
}

/** Blank or unreadable numbers are "not captured", which is not the same as 0. */
function toNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Packaging is captured against a variant and travels with it, so a case of 24
 * stays attached to the unit it counts.
 */
function serializePackaging(levels: readonly PackagingLevelDraft[] | undefined) {
  return (levels ?? []).map((level) => ({
    level: level.level,
    quantity_of_parent: toNumber(level.quantityOfParent),
    description: level.description.trim(),
    gross_weight: toNumber(level.grossWeight),
    weight_unit: level.weightUnit,
    dimensions: {
      length: toNumber(level.dimensions.length),
      width: toNumber(level.dimensions.width),
      height: toNumber(level.dimensions.height),
      unit: level.dimensions.unit,
    },
  }))
}

/**
 * Builds one collector submission.
 *
 * Everything the collector captured goes into this single body — no product or
 * variant is created on the way, so a capture stays raw field data until
 * something else decides what to do with it.
 */
export function buildSubmissionPayload(
  capture: CaptureContext,
  details: ProductDetails,
  productLevel: readonly AttributeDefinition[],
  values: AttributeValues,
  axes: readonly AttributeDefinition[],
  variants: readonly Variant[],
  media: readonly MediaItem[],
  uploaded?: ReadonlyMap<string, UploadedFields>,
): SubmissionPayload {
  const attributes = serializeAttributes(productLevel, values)

  // A category is free to define its own `tags` (or `model_number`) attribute,
  // and that definition is the authoritative one — so the captured extras only
  // fill codes the category left alone.
  Object.entries(captureAttributes(details)).forEach(([code, value]) => {
    if (!(code in attributes)) attributes[code] = value
  })

  return {
    client_id: capture.clientId,
    session_id: capture.sessionId,
    scanned_barcode: capture.barcode,
    scanned_packaging_level: details.scannedPackagingLevel,
    category_path: capture.categoryPath,
    captured_at: new Date().toISOString(),
    product: {
      name: details.name.trim(),
      // Null rather than "" for an id nobody picked: an empty string would read
      // as a real reference to nothing.
      manufacturer_id: details.manufacturerId || null,
      manufacturer_name: capture.manufacturerName,
      brand_id: details.brandId || null,
      brand_name: capture.brandName,
      // What the server stores as `entered_brand`: the name as captured, which
      // is what review matches against.
      brand: capture.brandName,
      description: details.description.trim(),
      category_id: details.categoryId,
      vertical_id: details.verticalId,
      default_uom: details.defaultUom,
      attributes,
    },
    variants: variants.map((variant) => ({
      // The device's own id for this variant, so media captured against it can
      // name it. The server has no variant row to point at until review merges
      // the capture, which is why the association travels as a client id.
      client_id: variant.id,
      // Axis answers go through the same typing rules as product attributes.
      axes: serializeAttributes(axes, variant.axes),
      sku: variant.sku.trim(),
      is_default: variant.isDefault,
      packaging_levels: serializePackaging(variant.packagingLevels),
    })),
    media: serializeMedia(media, uploaded),
    notes: details.notes.trim(),
    observed_price: toNumber(details.observedPrice),
    currency: details.currency,
  }
}
