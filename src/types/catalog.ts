/** One category of a vertical, flat; `parent_id` is null at the root. */
export type Category = {
  id: string
  parent_id: string | null
  name: string
  sort_order: number
}

/** A top-level trade the catalog is split into, e.g. groceries or construction. */
export type Vertical = {
  id: string
  code: string
  name: string
  description: string
  icon: string
  sort_order: number
  is_active: boolean
}

/** A category nested into the tree. A node with no children is a selectable leaf. */
export type CategoryNode = {
  id: string
  name: string
  children: CategoryNode[]
}

/**
 * A single attribute answer, held in the shape the control edits rather than
 * the shape the submission carries. `dimension` uses a three-slot array of
 * [length, width, height] so its inputs stay as-typed text until submit.
 */
export type AttributeValue = string | string[] | boolean

/** Answers keyed by attribute `code`, which is unique within a category. */
export type AttributeValues = Record<string, AttributeValue>

/** What an attachment is a picture (or file) of. */
export type MediaKind =
  | 'photo_front'
  | 'photo_back'
  | 'photo_side'
  | 'photo_label'
  | 'photo_nutrition'
  | 'photo_barcode'
  | 'photo_packaging'
  | 'photo_in_store'
  | 'manual_pdf'
  | 'other'

/** The kinds of answer an attribute can take, one control per type. */
export type AttributeDataType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multi_select'
  | 'dimension'
  | 'date'

/** One question a category asks about the products filed under it. */
export type AttributeDefinition = {
  id: string
  category_id: string
  code: string
  name: string
  data_type: AttributeDataType
  /** Display unit such as `%`, `ml` or `GB`. Empty when the attribute is unitless. */
  unit: string
  /** Populated for `select` / `multi_select`; null for every other data type. */
  options: string[] | null
  is_required: boolean
  is_variant_axis: boolean
  is_filterable: boolean
  sort_order: number
}
