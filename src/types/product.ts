export type Variant = {
  id: string
  color: string
  storage: string
  sku: string
  isDefault: boolean
}

/** Free-text attribute values as typed. Coerced to numbers only at submit time. */
export type ProductAttributes = {
  battery: string
  display: string
  ram: string
}

export type ProductDetails = {
  name: string
  brand: string
  description: string
}

/** Shape of the request body the catalog backend will eventually receive. */
export type ProductPayload = {
  product: {
    name: string
    brand: string
    description: string
    attributes: {
      battery: number
      display: number
      ram: number
    }
  }
  variants: Array<{
    axes: { Color: string; Storage: string }
    sku: string
    isDefault: boolean
  }>
}
