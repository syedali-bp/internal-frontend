/**
 * Address autocomplete, backed by the Google Places API (New).
 *
 * Two calls, deliberately kept apart. Autocomplete runs on every keystroke and
 * returns only names and ids - it is billed per session and carries no
 * coordinates. Place Details runs once, when a suggestion is actually picked,
 * and is where the formatted address, the lat/long and the address components
 * come from. Fetching details for every suggestion would multiply the bill by
 * the length of the dropdown for data thrown away on the next keypress.
 *
 * The session token ties the two together: Google bills the autocomplete
 * requests and the details call that closes them as one session rather than
 * separately, so a token is minted per editing session and discarded once a
 * place is chosen.
 */

export type PlaceSuggestion = {
  /** Opaque id, passed straight back to `fetchPlaceDetails`. */
  placeId: string
  /** The bold line - "Dawood Mall". */
  primary: string
  /** The rest - "Autobahn Road, Hyderabad, Pakistan". Disambiguates branches. */
  secondary: string
}

export type PlaceDetails = {
  formattedAddress: string
  city: string
  region: string
  latitude: number | null
  longitude: number | null
}

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete'
const DETAILS_URL = 'https://places.googleapis.com/v1/places'

/**
 * The key, from `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` in `.env`.
 *
 * Read the same way as `EXPO_PUBLIC_API_URL`, and with the same bundle-time
 * caveat: Expo inlines it, so changing it needs a restart of `expo start`, not
 * just a reload.
 */
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || ''

/**
 * Whether autocomplete can run at all.
 *
 * Exported so the field can fall back to plain text with an explanation rather
 * than showing a dropdown that will never populate. Same idea as
 * `IS_LOCATION_AVAILABLE`.
 */
export const IS_PLACES_AVAILABLE = API_KEY.length > 0

/** Matches the app's own request deadline - see REQUEST_TIMEOUT_MS in api.ts. */
const PLACES_TIMEOUT_MS = 8000

/** Results are for collectors working in Pakistan, so the search is scoped there. */
const REGION_CODE = 'pk'

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PLACES_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error('Places request failed (' + response.status + ')')
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

async function getJson<T>(url: string, fieldMask: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PLACES_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        // Places (New) requires an explicit field mask; without one it refuses
        // the request rather than defaulting, and asking for fewer fields is
        // cheaper.
        'X-Goog-FieldMask': fieldMask,
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error('Place details failed (' + response.status + ')')
    }

    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string
      structuredFormat?: {
        mainText?: { text?: string }
        secondaryText?: { text?: string }
      }
      text?: { text?: string }
    }
  }>
}

/**
 * Suggestions for what has been typed so far.
 *
 * Returns an empty list rather than throwing on an unusable query, so a caller
 * debouncing keystrokes does not have to guard every call.
 */
export async function fetchPlaceSuggestions(
  input: string,
  sessionToken: string,
): Promise<PlaceSuggestion[]> {
  const query = input.trim()
  if (!IS_PLACES_AVAILABLE || query.length < 3) return []

  const body = {
    input: query,
    // Bias, not a hard filter: `includedRegionCodes` would drop a legitimate
    // result whose data Google files under a neighbouring code, and the
    // collectors using this are working inside Pakistan anyway.
    regionCode: REGION_CODE,
    sessionToken,
  }

  const data = await postJson<AutocompleteResponse>(AUTOCOMPLETE_URL, body)

  const suggestions: PlaceSuggestion[] = []
  for (const entry of data.suggestions ?? []) {
    const prediction = entry.placePrediction
    if (!prediction?.placeId) continue

    const structured = prediction.structuredFormat
    suggestions.push({
      placeId: prediction.placeId,
      // `text` is the whole one-line address; it stands in when Google returns
      // no structured split, which happens for some establishment results.
      primary: structured?.mainText?.text ?? prediction.text?.text ?? '',
      secondary: structured?.secondaryText?.text ?? '',
    })
  }

  return suggestions
}

type DetailsResponse = {
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  addressComponents?: Array<{
    longText?: string
    shortText?: string
    types?: string[]
  }>
}

/**
 * Picks the first component carrying any of `types`.
 *
 * Google returns components in a fixed hierarchy but not every place has every
 * level, so each field is a search through the list rather than an index.
 */
function componentOf(data: DetailsResponse, types: string[]): string {
  for (const component of data.addressComponents ?? []) {
    for (const type of component.types ?? []) {
      if (types.includes(type)) return component.longText ?? component.shortText ?? ''
    }
  }
  return ''
}

/**
 * The full address, coordinates and components for a chosen suggestion.
 *
 * This is also where the store's `latitude`/`longitude` finally come from. The
 * device's own GPS is still unavailable - `capturePosition` returns null - but a
 * store's position is a property of the place, not of the phone that recorded
 * it, so the picked place's coordinates are the better answer regardless.
 */
export async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string,
): Promise<PlaceDetails> {
  const url =
    DETAILS_URL +
    '/' +
    encodeURIComponent(placeId) +
    '?sessionToken=' +
    encodeURIComponent(sessionToken)

  const data = await getJson<DetailsResponse>(
    url,
    'formattedAddress,location,addressComponents',
  )

  // `locality` is the city proper; `postal_town` covers places Google files
  // without one, and the admin levels are the fallbacks for a shop in an
  // unincorporated area outside any named town.
  const city =
    componentOf(data, ['locality', 'postal_town']) ||
    componentOf(data, ['administrative_area_level_2']) ||
    componentOf(data, ['administrative_area_level_3'])

  // In Pakistan level 1 is the province - Sindh, Punjab - which is what the
  // `region` column holds.
  const region = componentOf(data, ['administrative_area_level_1'])

  return {
    formattedAddress: data.formattedAddress ?? '',
    city,
    region,
    latitude: data.location?.latitude ?? null,
    longitude: data.location?.longitude ?? null,
  }
}

/**
 * A fresh session token.
 *
 * Any unique string works; Google only uses it to group the keystrokes that led
 * to one selection. `crypto.randomUUID` is not available in the RN runtime, so
 * this is built from the primitives the app already has.
 */
export function newSessionToken(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12)
}
