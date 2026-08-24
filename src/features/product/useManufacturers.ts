import * as api from '../../api/api'

/** One maker, as the catalog returns it. */
export type Manufacturer = {
  id: string
  name: string
  country: string
  website: string
  logo_url: string
  status: string
}

/**
 * Shared empty list, so an unanswered query hands back the same reference every
 * render. Derived lists memoise on this, and a fresh `[]` each render would make
 * every one of them look new.
 */
const NO_MANUFACTURERS: Manufacturer[] = []

/** The manufacturers a product can be filed under. */
export function useManufacturers() {
  const query = api.useManufacturers()
  const manufacturers: Manufacturer[] = query.data ?? NO_MANUFACTURERS

  return {
    manufacturers,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}
