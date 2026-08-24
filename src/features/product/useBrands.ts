import * as api from '../../api/api'

/** One brand, as the catalog returns it. `manufacturer_id` is null when unowned. */
export type Brand = {
  id: string
  manufacturer_id: string | null
  name: string
  logo_url: string
  verticals: string[]
  status: string
}

/** Shared empty list; see the note in `useManufacturers`. */
const NO_BRANDS: Brand[] = []

/**
 * The brands a product can be filed under.
 *
 * Passing a manufacturer narrows the list to its brands; passing nothing lists
 * every brand, which is the right default because a brand does not need a
 * manufacturer to exist.
 */
export function useBrands(manufacturerId: string) {
  const query = api.useBrands(manufacturerId || undefined)
  const brands: Brand[] = query.data ?? NO_BRANDS

  return { brands, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}
