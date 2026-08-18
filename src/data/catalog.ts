import type { AttributeDefinition, AttributeDataType, Category, Vertical } from '../types/catalog'

/**
 * The catalog the app works against, held on the device.
 *
 * There is no backend behind this screenset: verticals, their category trees and
 * the attributes a category defines are all declared here, so the whole capture
 * flow runs offline. Swapping this file for a loader is the only change needed
 * if the data ever comes from somewhere else.
 */

export const VERTICALS: Vertical[] = [
  {
    id: 'mart',
    code: 'mart',
    name: 'Grocery & FMCG',
    description: 'Supermarkets, kirana stores, daily essentials, packaged foods',
    icon: '🛒',
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'electronics',
    code: 'electronics',
    name: 'Electronics & IT',
    description: 'Laptops, phones, components, peripherals and accessories',
    icon: '💻',
    sort_order: 2,
    is_active: true,
  },
  {
    id: 'construction',
    code: 'construction',
    name: 'Construction & Building Materials',
    description: 'Cement, steel, bricks, paints, tiles and site hardware',
    icon: '🏗️',
    sort_order: 3,
    is_active: true,
  },
]

/** A category and its children, so a tree is declared by nesting rather than by id. */
type CategorySeed = {
  id: string
  name: string
  children?: CategorySeed[]
}

/**
 * Flattens a declared tree into the rows the pickers consume. Siblings are
 * ordered by their position in the list, so moving one here moves it in the app.
 */
function flattenCategories(seeds: readonly CategorySeed[], parentId: string | null = null) {
  const rows: Category[] = []

  seeds.forEach((seed, index) => {
    rows.push({ id: seed.id, parent_id: parentId, name: seed.name, sort_order: index + 1 })
    rows.push(...flattenCategories(seed.children ?? [], seed.id))
  })

  return rows
}

const MART_CATEGORIES: CategorySeed[] = [
  {
    id: 'snacks',
    name: 'Snacks & Confectionery',
    children: [
      {
        id: 'chips-crisps',
        name: 'Chips & Crisps',
        children: [
          { id: 'potato-chips', name: 'Potato Chips' },
          { id: 'tortilla-chips', name: 'Tortilla Chips' },
        ],
      },
      {
        id: 'chocolates',
        name: 'Chocolates',
        children: [
          { id: 'chocolate-bars', name: 'Chocolate Bars' },
          { id: 'gift-boxes', name: 'Chocolate Gift Boxes' },
        ],
      },
    ],
  },
  {
    id: 'biscuits-bakery',
    name: 'Biscuits & Bakery',
    children: [
      {
        id: 'biscuits',
        name: 'Biscuits',
        children: [
          { id: 'sweet-biscuits', name: 'Sweet Biscuits' },
          { id: 'cream-biscuits', name: 'Cream Biscuits' },
          { id: 'crackers', name: 'Crackers' },
        ],
      },
    ],
  },
  {
    id: 'beverages',
    name: 'Beverages',
    children: [
      {
        id: 'cold-drinks',
        name: 'Cold Drinks',
        children: [
          { id: 'carbonated-soft-drinks', name: 'Carbonated Soft Drinks' },
          { id: 'juices-nectars', name: 'Juices & Nectars' },
          { id: 'energy-drinks', name: 'Energy & Sports Drinks' },
          { id: 'bottled-water', name: 'Bottled Water' },
        ],
      },
    ],
  },
]

const ELECTRONICS_CATEGORIES: CategorySeed[] = [
  {
    id: 'computers',
    name: 'Computers',
    children: [
      { id: 'laptops', name: 'Laptops' },
      { id: 'desktops', name: 'Desktops' },
    ],
  },
  {
    id: 'mobile-devices',
    name: 'Mobile Devices',
    children: [
      { id: 'smartphones', name: 'Smartphones' },
      { id: 'tablets', name: 'Tablets' },
    ],
  },
  {
    id: 'accessories',
    name: 'Accessories',
    children: [
      { id: 'keyboards', name: 'Keyboards' },
      { id: 'headphones', name: 'Headphones' },
    ],
  },
]

const CONSTRUCTION_CATEGORIES: CategorySeed[] = [
  {
    id: 'building-materials',
    name: 'Building Materials',
    children: [
      {
        id: 'cement-aggregates',
        name: 'Cement & Aggregates',
        children: [
          { id: 'cement', name: 'Cement' },
          { id: 'sand-aggregates', name: 'Sand & Aggregates' },
        ],
      },
      {
        id: 'steel-rebar',
        name: 'Steel & Rebar',
        children: [{ id: 'rebar', name: 'Rebar' }],
      },
      {
        id: 'bricks-blocks',
        name: 'Bricks & Blocks',
        children: [{ id: 'concrete-blocks', name: 'Concrete Blocks' }],
      },
    ],
  },
  {
    id: 'finishing-fixtures',
    name: 'Finishing & Fixtures',
    children: [
      {
        id: 'paints-coatings',
        name: 'Paints & Coatings',
        children: [{ id: 'wall-paint', name: 'Wall Paint' }],
      },
      {
        id: 'tiles',
        name: 'Tiles',
        children: [{ id: 'floor-tiles', name: 'Floor Tiles' }],
      },
    ],
  },
]

/** Flat category rows per vertical id; the picker nests them itself. */
export const CATEGORIES_BY_VERTICAL: Record<string, Category[]> = {
  mart: flattenCategories(MART_CATEGORIES),
  electronics: flattenCategories(ELECTRONICS_CATEGORIES),
  construction: flattenCategories(CONSTRUCTION_CATEGORIES),
}

/** An attribute as declared below; everything omitted takes a sensible default. */
type AttributeSeed = {
  code: string
  name: string
  data_type: AttributeDataType
  /** Display unit such as `%`, `ml` or `GB`. Omitted when the attribute is unitless. */
  unit?: string
  /** Required for `select` / `multi_select`; ignored by every other data type. */
  options?: string[]
  is_required?: boolean
  /** Axes are what make two variants different; everything else describes the product. */
  is_variant_axis?: boolean
  is_filterable?: boolean
}

/** Fills the defaults and orders the attributes by their position in the list. */
function defineAttributes(categoryId: string, seeds: readonly AttributeSeed[]) {
  return seeds.map<AttributeDefinition>((seed, index) => ({
    id: `${categoryId}:${seed.code}`,
    category_id: categoryId,
    code: seed.code,
    name: seed.name,
    data_type: seed.data_type,
    unit: seed.unit ?? '',
    options: seed.options ?? null,
    is_required: seed.is_required ?? false,
    is_variant_axis: seed.is_variant_axis ?? false,
    is_filterable: seed.is_filterable ?? false,
    sort_order: index + 1,
  }))
}

/**
 * What each leaf category asks for. Between them these exercise every data type
 * the form can render: text, number, boolean, select, multi_select, dimension
 * and date. A category that is not listed simply has no attributes.
 */
const ATTRIBUTE_SEEDS: Record<string, AttributeSeed[]> = {
  'potato-chips': [
    {
      code: 'flavour',
      name: 'Flavour',
      data_type: 'select',
      options: ['Salted', 'Sour Cream & Onion', 'Masala', 'Cheese', 'Barbecue'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    {
      code: 'pack_size_g',
      name: 'Pack Size',
      data_type: 'select',
      unit: 'g',
      options: ['15', '30', '60', '120', '200'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    { code: 'shelf_life_days', name: 'Shelf Life', data_type: 'number', unit: 'days', is_required: true },
    { code: 'is_baked', name: 'Baked (not fried)', data_type: 'boolean', is_filterable: true },
    {
      code: 'dietary',
      name: 'Dietary Tags',
      data_type: 'multi_select',
      options: ['Vegetarian', 'Vegan', 'Gluten Free', 'No MSG'],
      is_filterable: true,
    },
  ],

  'tortilla-chips': [
    {
      code: 'flavour',
      name: 'Flavour',
      data_type: 'select',
      options: ['Plain', 'Nacho Cheese', 'Chilli Lime', 'Sweet Chilli'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    {
      code: 'pack_size_g',
      name: 'Pack Size',
      data_type: 'select',
      unit: 'g',
      options: ['100', '200', '400'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    { code: 'shelf_life_days', name: 'Shelf Life', data_type: 'number', unit: 'days' },
    {
      code: 'dietary',
      name: 'Dietary Tags',
      data_type: 'multi_select',
      options: ['Vegetarian', 'Vegan', 'Gluten Free'],
      is_filterable: true,
    },
  ],

  // One axis only: type and cocoa content describe the bar, while the weight is
  // what makes two bars separate sellable units.
  'chocolate-bars': [
    {
      code: 'chocolate_type',
      name: 'Chocolate Type',
      data_type: 'select',
      options: ['Milk', 'Dark', 'White', 'Ruby'],
      is_required: true,
      is_filterable: true,
    },
    {
      code: 'cocoa_percentage',
      name: 'Cocoa Content',
      data_type: 'number',
      unit: '%',
      is_required: true,
      is_filterable: true,
    },
    {
      code: 'weight_g',
      name: 'Bar Weight',
      data_type: 'select',
      unit: 'g',
      options: ['12', '24', '50', '90'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    { code: 'contains_nuts', name: 'Contains Nuts', data_type: 'boolean', is_filterable: true },
    { code: 'allergen_info', name: 'Allergen Information', data_type: 'text' },
  ],

  'gift-boxes': [
    {
      code: 'box_size',
      name: 'Box Size',
      data_type: 'select',
      options: ['Small', 'Medium', 'Large'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    {
      code: 'piece_count',
      name: 'Pieces per Box',
      data_type: 'number',
      unit: 'pcs',
      is_required: true,
      is_filterable: true,
    },
    {
      code: 'occasion',
      name: 'Occasions',
      data_type: 'multi_select',
      options: ['Eid', 'Diwali', 'Christmas', 'Birthday', 'Wedding'],
      is_filterable: true,
    },
    { code: 'box_dimensions', name: 'Box Dimensions', data_type: 'dimension', unit: 'mm' },
    { code: 'best_before', name: 'Best Before', data_type: 'date' },
  ],

  'sweet-biscuits': [
    {
      code: 'biscuit_type',
      name: 'Biscuit Type',
      data_type: 'select',
      options: ['Glucose', 'Digestive', 'Tea', 'Butter'],
      is_required: true,
      is_filterable: true,
    },
    {
      code: 'pack_size_g',
      name: 'Pack Size',
      data_type: 'select',
      unit: 'g',
      options: ['24', '50', '100', '200', '400'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    { code: 'is_sugar_free', name: 'Sugar Free', data_type: 'boolean', is_filterable: true },
  ],

  'carbonated-soft-drinks': [
    {
      code: 'flavour',
      name: 'Flavour',
      data_type: 'select',
      options: ['Cola', 'Lemon Lime', 'Orange', 'Ginger'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    {
      code: 'pack_volume_ml',
      name: 'Volume',
      data_type: 'select',
      unit: 'ml',
      options: ['250', '345', '500', '1000', '1500', '2250'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    {
      code: 'container',
      name: 'Container',
      data_type: 'select',
      options: ['PET Bottle', 'Can', 'Returnable Glass'],
      is_required: true,
      is_filterable: true,
    },
    { code: 'is_diet', name: 'Diet / Zero Sugar', data_type: 'boolean', is_filterable: true },
    { code: 'best_before', name: 'Best Before', data_type: 'date' },
  ],

  'bottled-water': [
    {
      code: 'water_type',
      name: 'Water Type',
      data_type: 'select',
      options: ['Mineral', 'Purified', 'Sparkling'],
      is_required: true,
      is_filterable: true,
    },
    {
      code: 'pack_volume_ml',
      name: 'Volume',
      data_type: 'select',
      unit: 'ml',
      options: ['500', '1500', '5000', '19000'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    { code: 'source', name: 'Source', data_type: 'text' },
  ],

  laptops: [
    { code: 'processor', name: 'Processor', data_type: 'text', is_required: true },
    {
      code: 'screen_size_in',
      name: 'Screen Size',
      data_type: 'select',
      unit: 'in',
      options: ['13', '14', '15.6', '16', '17'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    {
      code: 'ram_gb',
      name: 'RAM',
      data_type: 'select',
      unit: 'GB',
      options: ['8', '16', '32', '64'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    {
      code: 'storage_gb',
      name: 'Storage',
      data_type: 'select',
      unit: 'GB',
      options: ['256', '512', '1024', '2048'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    { code: 'has_touchscreen', name: 'Touchscreen', data_type: 'boolean', is_filterable: true },
    { code: 'warranty_months', name: 'Warranty', data_type: 'number', unit: 'months' },
  ],

  smartphones: [
    {
      code: 'colour',
      name: 'Colour',
      data_type: 'select',
      options: ['Black', 'Blue', 'Titanium Gray', 'Violet'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    {
      code: 'storage_gb',
      name: 'Storage',
      data_type: 'select',
      unit: 'GB',
      options: ['128', '256', '512', '1024'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    {
      code: 'ram_gb',
      name: 'RAM',
      data_type: 'select',
      unit: 'GB',
      options: ['4', '6', '8', '12', '16'],
      is_filterable: true,
    },
    {
      code: 'network',
      name: 'Network',
      data_type: 'select',
      options: ['4G', '5G'],
      is_required: true,
      is_filterable: true,
    },
    { code: 'is_dual_sim', name: 'Dual SIM', data_type: 'boolean', is_filterable: true },
    { code: 'box_dimensions', name: 'Box Dimensions', data_type: 'dimension', unit: 'mm' },
  ],

  cement: [
    {
      code: 'cement_type',
      name: 'Cement Type',
      data_type: 'select',
      options: ['OPC', 'PPC', 'SRC', 'White'],
      is_required: true,
      is_filterable: true,
    },
    {
      code: 'grade',
      name: 'Grade',
      data_type: 'select',
      options: ['33', '43', '53'],
      is_required: true,
      is_filterable: true,
    },
    {
      code: 'bag_weight_kg',
      name: 'Bag Weight',
      data_type: 'select',
      unit: 'kg',
      options: ['25', '40', '50'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    { code: 'setting_time_min', name: 'Initial Setting Time', data_type: 'number', unit: 'min' },
  ],

  rebar: [
    {
      code: 'diameter_mm',
      name: 'Diameter',
      data_type: 'select',
      unit: 'mm',
      options: ['8', '10', '12', '16', '20', '25'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    {
      code: 'grade',
      name: 'Grade',
      data_type: 'select',
      options: ['Grade 40', 'Grade 60', 'Grade 75'],
      is_required: true,
      is_filterable: true,
    },
    { code: 'length_m', name: 'Standard Length', data_type: 'number', unit: 'm' },
    { code: 'is_epoxy_coated', name: 'Epoxy Coated', data_type: 'boolean', is_filterable: true },
  ],

  'wall-paint': [
    {
      code: 'finish',
      name: 'Finish',
      data_type: 'select',
      options: ['Matt', 'Silk', 'Satin', 'Gloss'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    {
      code: 'base_type',
      name: 'Base',
      data_type: 'select',
      options: ['Water Based', 'Solvent Based'],
      is_required: true,
      is_filterable: true,
    },
    {
      code: 'pack_size_l',
      name: 'Pack Size',
      data_type: 'select',
      unit: 'L',
      options: ['1', '3.6', '10', '18'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    { code: 'coverage_sqm_per_l', name: 'Coverage', data_type: 'number', unit: 'm²/L' },
    { code: 'is_washable', name: 'Washable', data_type: 'boolean', is_filterable: true },
  ],

  'floor-tiles': [
    {
      code: 'material',
      name: 'Material',
      data_type: 'select',
      options: ['Ceramic', 'Porcelain', 'Vitrified', 'Marble'],
      is_required: true,
      is_filterable: true,
    },
    {
      code: 'tile_size',
      name: 'Tile Size',
      data_type: 'select',
      options: ['300×300', '600×600', '800×800', '1200×600'],
      is_required: true,
      is_variant_axis: true,
      is_filterable: true,
    },
    {
      code: 'surface_finish',
      name: 'Surface Finish',
      data_type: 'select',
      options: ['Glossy', 'Matt', 'Anti-Skid'],
      is_filterable: true,
    },
    { code: 'tile_dimensions', name: 'Exact Dimensions', data_type: 'dimension', unit: 'mm' },
    { code: 'tiles_per_box', name: 'Tiles per Box', data_type: 'number', unit: 'pcs' },
  ],
}

/** Attribute definitions per category id. */
export const ATTRIBUTES_BY_CATEGORY: Record<string, AttributeDefinition[]> = Object.fromEntries(
  Object.entries(ATTRIBUTE_SEEDS).map(([categoryId, seeds]) => [
    categoryId,
    defineAttributes(categoryId, seeds),
  ]),
)
