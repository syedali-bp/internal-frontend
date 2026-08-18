// Brands the collector can pick from.
export const BRANDS =['Samsung', 'Apple', 'Xiaomi', 'Google', 'OnePlus']

/** Units the product is sold in by default; stored on the product as default_uom. */
export const UOM_OPTIONS = [
  'piece',
  'pack',
  'box',
  'bag',
  'bottle',
  'can',
  'kg',
  'g',
  'liter',
  'ml',
  'meter',
  'cm',
  'dozen',
  'pair',
  'set',
]

/** Currencies an observed shelf price can be recorded in. */
export const CURRENCY_OPTIONS = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'CNY']

/** What a price is assumed to be in until the collector says otherwise. */
export const DEFAULT_CURRENCY = 'PKR'
export const COLORS = ['Black', 'Blue', 'Titanium Gray', 'Violet']
export const STORAGES = ['128GB', '256GB', '512GB', '1TB']
