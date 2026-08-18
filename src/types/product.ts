import type { AttributeValues } from './catalog'

/**
 * One sellable version of a product. `axes` holds the answers to the category's
 * variant-axis attributes, keyed by attribute code — e.g. `{ volume_ml: '500' }`
 * for Milk, or `{ capacity_gb: '16', speed_mhz: '3200' }` for RAM.
 */
export type Variant = {
  id: string
  axes: AttributeValues
  sku: string
  isDefault: boolean
  packagingLevels?: PackagingLevelDraft[]
}

/** A variant being typed into the form, before it has been saved and given an id. */
export type VariantDraft = Omit<Variant, 'id'>

export type PackagingLevelDraft = {
  level: 'unit' | 'inner_pack' | 'case' | 'pallet' | ''
  quantityOfParent: string
  description: string
  grossWeight: string
  weightUnit: string
  dimensions: {
    length: string
    width: string
    height: string
    unit: string
  }
}

/** Everything the add-product form captures about the product itself. */
export type ProductDetails = {
  name: string
  brand: string
  description: string
  categoryId: string
  verticalId: string
  /** Manufacturer model number. Only asked for on the verticals listed in
   *  `MODEL_NUMBER_VERTICAL_CODES`; empty everywhere else. */
  modelNumber: string
  /** Free-text search/classification chips, e.g. `['halal', 'sugar-free']`. */
  tags: string[]
  /** Unit the product is sold in by default — one of `UOM_OPTIONS`. Maps to the
   *  submission's `uom`. */
  defaultUom: string
  /** ISO 3166-1 alpha-2 country code, e.g. `PK`. Empty when unknown. */
  countryOfOrigin: string
  /** Collector remarks, kept as typed. */
  notes: string
  /** Shelf price if visible, held as typed text until submit. */
  observedPrice: string
  /** Currency of `observedPrice`, e.g. `PKR`. */
  currency: string
}

/**
 * One collector submission: everything captured for a product, as captured.
 *
 * There is deliberately no product or variant id here — a capture is raw field
 * data, not a catalog entry, and stays that way until something turns it into one.
 */
export type SubmissionPayload = {
  /** Device-generated id for the capture, stable across repeated submits. */
  client_id: string
  /** Raw scan value; empty when nothing was scanned. */
  scanned_barcode: string
  /** Category breadcrumb as picked in the app. */
  category_path: string
  /** Device clock at capture time, ISO 8601. */
  captured_at: string
  product: {
    name: string
    brand: string
    description: string
    category_id: string
    vertical_id: string
    /** Unit the product is sold in by default. */
    default_uom: string
    /**
     * Product-level answers keyed by attribute code, e.g. `{ fat_percentage: 3.5 }`.
     * Model number, tags and country of origin ride here too, alongside the
     * category's own answers, so nothing typed by the collector is dropped.
     */
    attributes: Record<string, unknown>
  }
  /** Collector remarks, kept as typed. */
  notes: string
  /** Shelf price if the collector saw one; null when not captured. */
  observed_price: number | null
  currency: string
  variants: Array<{
    /** Variant-axis answers keyed by attribute code, e.g. `{ volume_ml: 500 }`. */
    axes: Record<string, unknown>
    sku: string
    is_default: boolean
    /** Packaging captured against this variant; blank fields come through null. */
    packaging_levels: Array<{
      level: string
      quantity_of_parent: number | null
      description: string
      gross_weight: number | null
      weight_unit: string
      dimensions: {
        length: number | null
        width: number | null
        height: number | null
        unit: string
      }
    }>
  }>
  /** Product-level attachments, as picked on the device. */
  media: Array<{
    kind: string
    file_name: string
    mime_type: string
    /** Path to the file on this device. */
    local_uri: string
  }>
}
