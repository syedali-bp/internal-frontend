import { useQuery } from '@tanstack/react-query'

import * as api from '../../api/api'

/**
 * What the catalog already knows about a scanned code.
 *
 * Asked the moment a barcode resolves on the device, so a collector is told the
 * catalog already holds this pack *before* they fill in a form about it rather
 * than after syncing one. A code that already resolves is proof — the same proof
 * the server acts on when it classifies a capture — so acting on it only at sync
 * time means the collector has already done the work twice.
 */

const BARCODES_URL = '/api/collect/barcodes'

/**
 * One gap a collector standing at the shelf can close.
 *
 * The server names these rather than the app working them out from the product,
 * because which fields are fillable is a rule about how approval merges a
 * capture — and that rule lives with the merge. An app deciding for itself would
 * drift from what approval actually does, and offer fields that get silently
 * dropped.
 */
export type MissingField = {
  /** Matches the capture payload's own field names. */
  field: 'media' | 'description' | 'brand' | 'uom' | 'observed_price' | string
  label: string
}

/** One photo on file. `variant_id` is empty for a photo of the product itself. */
export type LookupMedia = {
  kind: string
  public_url: string
  variant_id: string
}

/** One pack of the product. `scanned` marks the one the code resolved to. */
export type LookupVariant = {
  id: string
  name: string
  sku_code: string
  net_content: number
  net_content_unit: string
  barcodes: string[]
  scanned: boolean
}

/** One recorded answer, already rendered by the server for display. */
export type LookupSpec = {
  label: string
  value: string
  /** Empty for an answer about the product rather than about one pack. */
  variant_id: string
}

export type BarcodeLookup = {
  found: boolean
  barcode: string
  product_id: string | null
  variant_id: string | null
  /** The ids a contribution submits against — its category and vertical are locked to these. */
  vertical_id: string
  category_id: string
  brand_id: string
  product_name: string
  brand_name: string
  category_name: string
  variant_name: string
  sku_code: string
  description: string
  status: string
  /** Empty when the product has no photo — the gap this flow most often closes. */
  thumbnail: string
  /** How many independent collectors have scanned this code. */
  verified_scan_count: number
  /** Every photo on file, not just the thumbnail. */
  media: LookupMedia[]
  /** Every pack of the product, the scanned one flagged. */
  variants: LookupVariant[]
  /** The recorded answers, product-level first. */
  specs: LookupSpec[]
  missing: MissingField[]
}

/**
 * Resolves a scanned code to the product it belongs to.
 *
 * `found: false` is the ordinary answer for a pack the catalog has never seen,
 * not a failure — it is what a collector is out there to find.
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeLookup> {
  return api.fetcher<BarcodeLookup>(`${BARCODES_URL}/${encodeURIComponent(barcode)}`)
}

/**
 * The lookup as a query, for the screen that shows the scan result.
 *
 * Retries once rather than the default three, the same convention as the other
 * reference data: with an 8s per-request deadline, three retries with backoff
 * leave a collector staring at a spinner for over half a minute with a pack in
 * their hand.
 *
 * A failed lookup is not fatal anywhere it is used — the capture form is still
 * reachable, and the server checks the barcode again at sync regardless. This
 * screen is the fast path, not the safety net.
 */
export function useBarcodeLookup(barcode: string | undefined) {
  return useQuery<BarcodeLookup>({
    queryKey: ['catalog', 'barcode', barcode],
    queryFn: () => lookupBarcode(barcode as string),
    enabled: Boolean(barcode),
    retry: 1,
    // A barcode resolves to the same product for as long as a visit lasts, and
    // re-asking on every focus would spend a collector's data for an answer
    // that cannot have changed.
    staleTime: 5 * 60 * 1000,
  })
}
