/**
 * Shortening a captured address down to what a collector needs to read.
 *
 * An address picked from Google Places arrives complete rather than concise —
 * a plus code, a landmark, the unit, the area, the city, the postcode, and the
 * city again — and the store row shows it next to the name on a phone. Beside a
 * shop called "K&N's" that is four lines of text to answer one question: which
 * of these is the shop I am standing in.
 *
 *     988X+WV5, Street No. 6, near Ek Minara Masjid, Unit,
 *     Latifabad Unit 6 Latifabad, Hyderabad, 71800, Hyderabad, Sindh
 *
 *   becomes
 *
 *     Street No. 6, Latifabad Unit 6, Hyderabad
 *
 * This is display only. The stored address is never touched — it is what the
 * moderator reviews and what duplicate detection scores against, and a shop is
 * often identified by exactly the landmark this drops.
 *
 * Text only: no geocoding, no coordinates, no network. The parts are already in
 * the string, and the work here is choosing between them.
 */

/**
 * How many parts the concise form keeps.
 *
 * Three is what the layout holds on one or two lines, and it matches the
 * hierarchy worth showing: where on the street, which area, which city. A
 * fourth was almost always the province, which the city already implies.
 */
const MAX_PARTS = 3

/**
 * An Open Location Code, as Google writes it: "988X+WV5", sometimes "8FVC9G8F+6W".
 *
 * Four or more characters, a plus, then two or more. Precise enough to put on a
 * map and useless to read, so it is dropped whenever anything else survives.
 */
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}$/i

/**
 * The same code where it opens a part rather than being the whole of one.
 *
 * Places does not always give the code a comma of its own: a shop whose name it
 * knows comes back as "99F2+4FP Baig Mart", one part, so the anchored form
 * above never saw it and the row read "99F2+4FP Baig Mart, Latifabad Unit 2".
 * Stripped in place, which leaves the name that was sitting behind it.
 */
const LEADING_PLUS_CODE =
  /^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}\s+(?=\S)/i

/** A postcode: a bare run of digits. "71800", "71000". */
const POSTAL_CODE = /^\d{3,10}$/

/**
 * The top-level administrative names this catalog actually sees.
 *
 * Collectors work in Pakistan, and Places closes a Pakistani address with the
 * province. It is the least useful part on a list where the city is already
 * shown, so it is recognised by name rather than by position — the last part is
 * not reliably the province once postcodes and repeats have been dropped.
 *
 * A name not on this list is treated as an ordinary part, which is the safe
 * direction: keeping a real area beats dropping one.
 */
const PROVINCE =
  /^(sindh|punjab|balochistan|baluchistan|khyber\s*pakhtunkhwa|kpk?|gilgit[\s-]*baltistan|azad\s*(jammu\s*(and|&)?\s*)?kashmir|ajk|islamabad\s*capital\s*territory|ict)$/i

/**
 * Parts that describe how to find a place rather than where it is.
 *
 * "near Ek Minara Masjid" is how a collector is directed to a door and is the
 * first thing to go when space is short: it identifies nothing on a list where
 * every row is in the same district.
 */
const LANDMARK_PREFIX = /^(near|opposite|opp\.?|behind|beside|next\s+to|in\s+front\s+of|adjacent\s+to)\b/i

/**
 * Fragments that carry no location on their own.
 *
 * These arrive when Places has a field it cannot fill and emits the label
 * anyway — a bare "Unit" with no number is the one this data actually contains.
 */
const EMPTY_FRAGMENT = /^(unit|shop|plot|floor|block|street|road|st|rd|n\/a|na|-|—|,)$/i

/**
 * Splits an address into parts.
 *
 * Commas, newlines and the Arabic comma "،" all separate: the captured data
 * mixes them, because the address was typed on a phone that offers whichever
 * the keyboard is set to. Splitting on only "," left "latifabad، Shop.No. 3" as
 * one part, which then matched nothing and was kept whole.
 */
function splitParts(address: string): string[] {
  return address
    .split(/[,\n\r،؛;]+/)
    .map((part) => {
      const tidied = part.replace(/\s+/g, ' ').trim()
      // Peeled here rather than later so every rule downstream — scoring,
      // duplicate detection, the province check — sees the part as the name it
      // actually is, not as a code with a name stuck to it.
      const peeled = tidied.replace(LEADING_PLUS_CODE, '')
      return peeled.trim() || tidied
    })
    .filter(Boolean)
}

/**
 * A part reduced to what it is, for comparing two of them.
 *
 * Case, punctuation and spacing are all noise here: "Latifabad Unit 6" and
 * "latifabad unit-6" are the same place written twice.
 */
function comparisonKey(part: string): string {
  return part
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, '')
    .trim()
}

/**
 * Whether `part` says nothing `kept` has not already said.
 *
 * Substring rather than equality, because the repetition in these addresses is
 * nested rather than exact: "Latifabad Unit 6 Latifabad" contains the area
 * twice, and a later bare "Hyderabad" repeats what "Hyderabad, 71800" opened.
 * Guarded on length so "Unit 6" is not swallowed by "Unit 60".
 */
function isRedundant(part: string, kept: readonly string[]): boolean {
  const key = comparisonKey(part)
  if (!key) return true

  return kept.some((existing) => {
    const existingKey = comparisonKey(existing)
    if (!existingKey) return false
    if (existingKey === key) return true

    // One containing the other is a repeat only when the shorter is a real
    // word of the longer, not a coincidental run of characters.
    const [shorter, longer] =
      key.length < existingKey.length ? [key, existingKey] : [existingKey, key]

    return shorter.length >= 4 && longer.includes(shorter)
  })
}

/**
 * Collapses a part that repeats an area inside itself.
 *
 * Places writes the area twice when the unit is part of its name:
 * "Latifabad Unit 6 Latifabad". The trailing copy is dropped so the part reads
 * the way a person says it.
 */
function collapseSelfRepeat(part: string): string {
  const words = part.split(' ')
  if (words.length < 3) return part

  const last = words[words.length - 1].toLowerCase()
  // Only when the tail also opens the part — that is the Places pattern, and
  // it avoids touching "Street No. 6 Street" style genuine repetition.
  if (words[0].toLowerCase() === last) {
    return words.slice(0, -1).join(' ')
  }

  return part
}

/**
 * How much a part is worth keeping when there are more than three.
 *
 * Higher is kept. The order is the hierarchy a collector reads down: the
 * street or building first, then the area, then the city — so when something
 * has to go it is the landmark and the plus code rather than the street.
 */
function partScore(part: string, index: number, total: number): number {
  if (PLUS_CODE.test(part)) return 0
  if (LANDMARK_PREFIX.test(part)) return 1

  // The tail is the area and then the city — the two that place the shop for
  // someone scanning a list, where every row shares the city but not the area.
  // Ranked above the shop's own detail because "Latifabad Unit 7" narrows the
  // search and "Plot G-3" only matters once you are already on the right road.
  if (index >= total - 2) return 5

  // A street, road or numbered unit: the most identifying of what is left, and
  // what tells two shops on the same block apart.
  if (/\b(street|st\.?|road|rd\.?|avenue|ave\.?|lane|ln\.?|block|sector|plot|shop|market|centre|center|mall|plaza|tower|building|bazaar|chowk|no\.?\s*\d|#\s*\d|\d)\b/i.test(part)) {
    return 4
  }

  return 2
}

/**
 * A concise, readable version of a captured address.
 *
 * Never throws and never returns something misleading: an address it cannot
 * improve comes back tidied rather than altered, and an empty one comes back
 * empty for the caller to skip.
 *
 * @param address The stored address. Null and undefined are accepted.
 * @param context Other fields the row already holds. The city and region are
 *   passed so the address is not made to repeat what the row shows anyway.
 */
export function normalizeStoreAddress(
  address: string | null | undefined,
  context: { city?: string | null; region?: string | null } = {},
): string {
  if (typeof address !== 'string') return ''

  const parts = splitParts(address)
  if (parts.length === 0) return ''

  // One part is already concise. Returned tidied — the split has collapsed its
  // whitespace — with nothing dropped, so a bare plus code or a lone city name
  // survives as itself.
  if (parts.length === 1) return collapseSelfRepeat(parts[0])

  const cityKey = comparisonKey(context.city ?? '')
  const regionKey = comparisonKey(context.region ?? '')

  const kept: string[] = []

  for (const raw of parts) {
    const part = collapseSelfRepeat(raw)

    if (POSTAL_CODE.test(part)) continue
    if (EMPTY_FRAGMENT.test(part)) continue

    // The province is dropped once something else has placed the shop —
    // whichever tells us: the row's own city column, or a part already kept
    // from the address. On its own "Sindh" is the only locating word left and
    // is worth more than nothing, so it survives an otherwise empty list.
    const partKey = comparisonKey(part)
    const isRegion = partKey === regionKey || (!regionKey && PROVINCE.test(part))
    if (isRegion && (cityKey || kept.length > 0)) continue

    // A later part that contains an earlier one replaces it rather than being
    // dropped: Places writes the area loosely early on and precisely at the
    // end, so "latifabad" appears before "Latifabad Unit 7 Latifabad" and it is
    // the second that tells two branches apart.
    const supersedes = kept.findIndex((existing) => {
      const existingKey = comparisonKey(existing)
      return (
        existingKey.length >= 4 &&
        partKey.length > existingKey.length &&
        partKey.includes(existingKey)
      )
    })

    if (supersedes !== -1) {
      // Removed and re-appended rather than swapped in place, so the address
      // still reads outward from the shop to the city: the precise area belongs
      // where Places put it, at the end, not where the loose mention was.
      kept.splice(supersedes, 1)
      kept.push(part)
      continue
    }

    if (isRedundant(part, kept)) continue

    kept.push(part)
  }

  // Everything was a postcode, a filler or a repeat. The tidied original is
  // more use than a blank line.
  if (kept.length === 0) {
    return parts.join(', ')
  }

  // A plus code earns its place only when nothing else locates the shop. Kept
  // until here rather than dropped on sight so an address that is *only* a plus
  // code still has it.
  const located = kept.filter((part) => !PLUS_CODE.test(part))
  const shortlist = located.length > 0 ? located : kept

  if (shortlist.length <= MAX_PARTS) return shortlist.join(', ')

  // Too many: drop the least identifying, then restore the original order so
  // the address still reads outward from the street to the city.
  const ranked = shortlist
    .map((part, index) => ({ part, index, score: partScore(part, index, shortlist.length) }))
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .slice(0, MAX_PARTS)
    .sort((a, b) => a.index - b.index)

  return ranked.map((entry) => entry.part).join(', ')
}

/**
 * The one line a store row shows under its name.
 *
 * The city and region are appended only when the shortened address does not
 * already name them — which is what put "Hyderabad" on screen twice, once from
 * the address and once from the column beside it.
 */
export function storeLocationLine(store: {
  address?: string | null
  city?: string | null
  region?: string | null
}): string {
  const address = normalizeStoreAddress(store.address, {
    city: store.city,
    region: store.region,
  })

  const parts = address ? [address] : []

  const city = (store.city ?? '').trim()
  if (city && !isRedundant(city, parts)) parts.push(city)

  // The province earns its place only when nothing else is there to locate the
  // shop — with a city present it is implied, and the row has one line.
  const region = (store.region ?? '').trim()
  if (region && parts.length === 0) parts.push(region)

  return parts.join(', ')
}
