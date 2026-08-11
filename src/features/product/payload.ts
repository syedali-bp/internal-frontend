import type {
  ProductAttributes,
  ProductDetails,
  ProductPayload,
  Variant,
} from '../../types/product'

/** Builds the request body the catalog backend will receive. */
export function buildProductPayload(
  details: ProductDetails,
  attributes: ProductAttributes,
  variants: Variant[],
): ProductPayload {
  return {
    product: {
      name: details.name.trim(),
      brand: details.brand,
      description: details.description.trim(),
      attributes: {
        battery: Number(attributes.battery),
        display: Number(attributes.display),
        ram: Number(attributes.ram),
      },
    },
    variants: variants.map((variant) => ({
      axes: { Color: variant.color, Storage: variant.storage },
      sku: variant.sku.trim(),
      isDefault: variant.isDefault,
    })),
  }
}
