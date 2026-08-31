import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import * as api from '../../api/api'
import { STORE_TYPES } from './storeApi'

/** One row of `catalog_store_types`, as the server returns it. */
export type StoreTypeOption = {
  id: string
  /** Stored form: lowercase, underscores — "hardware_store". */
  name: string
  /** How it is written for a human — "Hardware store". */
  label: string
  created_by_collector_id: string | null
}

/** What the chip rows actually render. */
export type StoreTypeChoice = {
  value: string
  label: string
}

/** The shipped list, used until the server answers and if it never does. */
const FALLBACK: StoreTypeChoice[] = STORE_TYPES.map((type) => ({
  value: type.value,
  label: type.label,
}))

/**
 * The trades a store can be filed under.
 *
 * Read from `GET /api/collect/store-types`, which is the whole point: a trade
 * one collector typed and staff approved becomes a chip every other collector
 * sees, and a list baked into the app could never grow that way.
 *
 * Falls back to the shipped list the same way `useVerticals` falls back to its
 * fixtures — the store form is the first thing a visit needs, and an empty chip
 * row there is worse than a slightly stale one.
 */
export function useStoreTypes() {
  const query = useQuery<StoreTypeOption[]>({
    queryKey: ['collect/store-types'],
    queryFn: () => api.fetcher<StoreTypeOption[]>('/api/collect/store-types'),
  })

  const options: StoreTypeChoice[] = useMemo(() => {
    if (!query.data?.length) return FALLBACK

    return query.data
      .map((type) => ({
        value: type.name,
        // Rows seeded before labels existed, or written by an older client,
        // can carry an empty label — fall back to the stored name rather than
        // rendering a blank chip.
        label: type.label?.trim() || type.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [query.data])

  return {
    storeTypes: options,
    isLoading: query.isLoading,
    // Only a real failure with nothing to show is worth reporting; while the
    // shipped list is standing in, the form works.
    error: query.data?.length ? null : query.error,
  }
}
