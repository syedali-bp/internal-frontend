import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { KeyboardAwareScroll } from '../../../components'
import type {
  FocusedInputEvent,
  KeyboardAwareScrollHandle,
} from '../../../components/KeyboardAwareScroll'
import type { Palette } from '../../../theme/colors'
import { makeControls, makeForms, useColors, useThemedStyles } from '../../../theme/useColors'
import { IS_LOCATION_AVAILABLE } from '../location'
import {
  IS_PLACES_AVAILABLE,
  fetchPlaceDetails,
  fetchPlaceSuggestions,
  newSessionToken,
  type PlaceSuggestion,
} from '../placesApi'
import { type NewStoreInput, type StoreType } from '../storeApi'
import { useStoreTypes } from '../useStoreTypes'

type AddStoreModalProps = {
  visible: boolean
  /** Prefills the name from whatever was searched for and not found. */
  initialName?: string
  onCancel: () => void
  onSubmit: (body: NewStoreInput) => void
  saving: boolean
  error: string | null
}

const DEFAULT_TYPE: StoreType = 'mart'

/**
 * How long typing has to stop before a lookup is sent.
 *
 * Google bills per session rather than per keystroke, but each request still
 * costs a round trip on a phone connection, and firing one per character makes
 * the dropdown flicker through results nobody asked for.
 */
const SEARCH_DEBOUNCE_MS = 300

/**
 * Creates a store without leaving the screen.
 *
 * The collector standing in the shop is the first person to see a store the
 * catalog has never heard of, so making them wait for someone else to add it
 * would mean losing the visit. Same shape as the manufacturer and brand modals
 * it sits alongside.
 *
 * Only the name is required — it is the one field answerable from where the
 * collector is standing. `status` and `created_by_collector_id` are not asked
 * for at all: both are facts about how the row came to exist rather than
 * choices, and are set when it is saved.
 */
export function AddStoreModal({
  visible,
  initialName = '',
  onCancel,
  onSubmit,
  saving,
  error,
}: AddStoreModalProps) {
  // Same list the filter row reads, so a trade approved onto the catalog is
  // offered here too rather than having to be typed again by the next collector.
  const { storeTypes } = useStoreTypes()
  const controls = useThemedStyles(makeControls)
  const forms = useThemedStyles(makeForms)
  const colors = useColors()
  const s = useThemedStyles(makeStyles)
  // Same fix as the auth screens: the sheet is tall enough that the lower
  // fields start out behind the keyboard, and a plain ScrollView never scrolls
  // to them. Whichever field is focused gets brought clear.
  const scrollRef = useRef<KeyboardAwareScrollHandle>(null)
  const revealFocused = (event: FocusedInputEvent) =>
    scrollRef.current?.scrollInputIntoView(event)

  const [name, setName] = useState(initialName)
  const [storeType, setStoreType] = useState<StoreType>(DEFAULT_TYPE)

  // The free-text trade, and whether its box is showing. Separate from
  // `storeType` so switching back to a chip does not discard what was typed,
  // and so an opened-but-empty box is distinguishable from a closed one.
  const [isCustomType, setIsCustomType] = useState(false)
  const [customType, setCustomType] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [region, setRegion] = useState('')

  // Coordinates come from the picked place rather than the device: GPS is not
  // wired up (capturePosition returns null), and a store's position is a fact
  // about the shop, not about the phone that recorded it.
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)

  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [placesError, setPlacesError] = useState<string | null>(null)

  /**
   * Suppresses the next lookup.
   *
   * Set when the address box is written to by anything other than typing -
   * picking a suggestion, or resetting the form. Without it, filling the field
   * with the chosen address immediately searches for that address and reopens
   * the dropdown over the form the collector just finished with.
   */
  const skipNextSearch = useRef(false)

  /** Groups the keystrokes leading to one selection, for Google's billing. */
  const sessionToken = useRef(newSessionToken())

  // Debounced lookup. The cleanup cancels the pending timer on every keystroke,
  // so only the last one in a burst survives to fire.
  useEffect(() => {
    if (!IS_PLACES_AVAILABLE) return

    if (skipNextSearch.current) {
      skipNextSearch.current = false
      return
    }

    const query = address.trim()
    if (query.length < 3) {
      setSuggestions([])
      setIsSearching(false)
      return
    }

    // Cancelled by the cleanup below if this render is superseded, so a slow
    // response for an old query cannot overwrite a newer one.
    let active = true
    setIsSearching(true)

    const timer = setTimeout(() => {
      fetchPlaceSuggestions(query, sessionToken.current)
        .then((results) => {
          if (!active) return
          setSuggestions(results)
          setPlacesError(null)
        })
        .catch(() => {
          if (!active) return
          setSuggestions([])
          // Not fatal: the field stays typeable, and a store saves without a
          // matched place. Said out loud so an empty dropdown is not read as
          // "no such place".
          setPlacesError('Could not reach address search. You can still type it in.')
        })
        .finally(() => {
          if (active) setIsSearching(false)
        })
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [address])

  /** Fills address, city, region and coordinates from the chosen place. */
  const choosePlace = async (suggestion: PlaceSuggestion) => {
    // Close the dropdown first: the details call is a round trip, and leaving
    // the list up makes it look like the tap missed.
    setSuggestions([])
    skipNextSearch.current = true
    setAddress(suggestion.primary)

    try {
      const details = await fetchPlaceDetails(suggestion.placeId, sessionToken.current)

      skipNextSearch.current = true
      if (details.formattedAddress) setAddress(details.formattedAddress)
      // Only overwrite what Google actually returned; a place with no locality
      // must not blank a city the collector typed themselves.
      if (details.city) setCity(details.city)
      if (details.region) setRegion(details.region)
      if (details.latitude !== null && details.longitude !== null) {
        setCoords({ latitude: details.latitude, longitude: details.longitude })
      }
      setPlacesError(null)
    } catch {
      setPlacesError('Could not load that address. You can still type it in.')
    }

    // One selection closes the billing session; the next edit starts a new one.
    sessionToken.current = newSessionToken()
  }

  const canSave = name.trim().length > 0 && !saving

  const reset = () => {
    setName('')
    setStoreType(DEFAULT_TYPE)
    setIsCustomType(false)
    setCustomType('')
    skipNextSearch.current = true
    setAddress('')
    setCity('')
    setRegion('')
    setCoords(null)
    setSuggestions([])
    setPlacesError(null)
    sessionToken.current = newSessionToken()
  }

  const handleCancel = () => {
    reset()
    onCancel()
  }

  const handleSubmit = () => {
    if (!canSave) return
    onSubmit({
      name: name.trim(),
      // An empty custom box means unclassified rather than a guess: the column
      // is optional, and the server no longer substitutes a default. The value
      // is sent as typed; normalising it is the server's job, so one trade
      // cannot be stored two ways depending on which client sent it.
      store_type: isCustomType ? customType.trim() : storeType,
      address: address.trim(),
      city: city.trim(),
      region: region.trim(),
      // Null when the address was typed rather than picked, which the column
      // already allows.
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
    })
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
      // Carry over whatever was searched for, so a collector who looked for
      // their store does not type its name a second time.
      onShow={() => setName((current) => current || initialName)}
    >
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={s.title}>Add Store</Text>
          <Text style={s.subtitle}>Only the name is required.</Text>

          <KeyboardAwareScroll ref={scrollRef}>
            <Text style={forms.label}>Store name:</Text>
            <TextInput
              style={controls.input}
              value={name}
              onChangeText={setName}
              onFocus={revealFocused}
              placeholder="e.g. Imtiaz Super Market"
              placeholderTextColor={colors.placeholder}
              autoFocus
            />

            <Text style={forms.label}>Store type:</Text>
            {/* Chips rather than a dropdown: seven fixed options, and the whole
                set is worth seeing at once when classifying an unfamiliar shop. */}
            <View style={s.types}>
              {storeTypes.map((type) => {
                // A chip cannot read as selected while the custom box is open,
                // or two answers would look chosen at once.
                const isActive = !isCustomType && type.value === storeType
                return (
                  <Pressable
                    key={type.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    onPress={() => {
                      setIsCustomType(false)
                      setStoreType(type.value)
                    }}
                    style={[s.type, isActive && s.typeActive]}
                  >
                    <Text style={[s.typeText, isActive && s.typeTextActive]}>{type.label}</Text>
                  </Pressable>
                )
              })}

              {/* Last in the row, after the trades it is an escape hatch from. */}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isCustomType }}
                onPress={() => setIsCustomType(true)}
                style={[s.type, isCustomType && s.typeActive]}
              >
                <Text style={[s.typeText, isCustomType && s.typeTextActive]}>+ Custom</Text>
              </Pressable>
            </View>

            {isCustomType ? (
              <TextInput
                style={[controls.input, s.customType]}
                value={customType}
                onChangeText={setCustomType}
                onFocus={revealFocused}
                placeholder="e.g. Tuck shop, Pharmacy, Auto parts"
                placeholderTextColor={colors.placeholder}
                autoFocus
                autoCapitalize="sentences"
              />
            ) : null}

            <Text style={forms.label}>Address:</Text>
            <View style={s.addressField}>
              <TextInput
                style={controls.input}
                value={address}
                onChangeText={setAddress}
                onFocus={revealFocused}
                placeholder={
                  IS_PLACES_AVAILABLE ? 'Search for the shop or street' : 'Street or area'
                }
                placeholderTextColor={colors.placeholder}
                autoCorrect={false}
              />
              {isSearching ? (
                <ActivityIndicator style={s.addressSpinner} size="small" color={colors.textMuted} />
              ) : null}
            </View>

            {/* In flow rather than floating: an absolutely positioned list
                inside a ScrollView is clipped by the sheet on Android, and a
                dropdown that pushes the form down is better than one that is
                half cut off. */}
            {suggestions.length > 0 ? (
              <View style={s.suggestions}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion.placeId}
                    accessibilityRole="button"
                    onPress={() => {
                      void choosePlace(suggestion)
                    }}
                    style={s.suggestion}
                  >
                    <Text numberOfLines={1} style={s.suggestionPrimary}>
                      {suggestion.primary}
                    </Text>
                    {/* The line that tells two branches of the same mall apart. */}
                    {suggestion.secondary ? (
                      <Text numberOfLines={1} style={s.suggestionSecondary}>
                        {suggestion.secondary}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

            {placesError ? <Text style={s.hint}>{placesError}</Text> : null}

            <Text style={forms.label}>City:</Text>
            <TextInput
              style={controls.input}
              value={city}
              onChangeText={setCity}
              onFocus={revealFocused}
              placeholder="e.g. Karachi"
              placeholderTextColor={colors.placeholder}
            />

            <Text style={forms.label}>Region:</Text>
            <TextInput
              style={controls.input}
              value={region}
              onChangeText={setRegion}
              onFocus={revealFocused}
              placeholder="e.g. Sindh"
              placeholderTextColor={colors.placeholder}
            />

            {/* Said plainly rather than left to look like a bug: the row saves
                either way, and the coordinates are nullable by design. Picking
                an address now supplies them, so the warning only stands when
                nothing has been picked and the device cannot help either. */}
            {coords ? (
              <Text style={s.note}>
                Location captured from the selected address
                ({coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}).
              </Text>
            ) : !IS_LOCATION_AVAILABLE ? (
              <Text style={s.note}>
                {IS_PLACES_AVAILABLE
                  ? 'Pick an address from the suggestions to save this store with coordinates.'
                  : 'Location is not captured in this build, so this store is saved without coordinates.'}
              </Text>
            ) : null}

            {error ? <Text style={s.error}>{error}</Text> : null}
          </KeyboardAwareScroll>

          <View style={s.actions}>
            <Pressable style={s.cancel} onPress={handleCancel}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.save, !canSave && s.saveDisabled]}
              disabled={!canSave}
              onPress={handleSubmit}
            >
              <Text style={s.saveText}>{saving ? 'Saving…' : 'Save Store'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  backdrop: { backgroundColor: colors.backdrop, flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    maxHeight: '88%',
    padding: 20,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  type: {
    backgroundColor: colors.screen,
    borderColor: colors.inputBorder,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  typeActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  customType: { marginTop: 10 },
  typeText: { color: colors.textSubtle, fontSize: 13, fontWeight: '700' },
  typeTextActive: { color: colors.onAccent },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 16 },
  addressField: { justifyContent: 'center' },
  addressSpinner: { position: 'absolute', right: 12 },
  suggestions: {
    backgroundColor: colors.screen,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  suggestion: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  suggestionPrimary: { color: colors.text, fontSize: 14, fontWeight: '700' },
  suggestionSecondary: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  error: { color: colors.dangerText, fontSize: 13, marginTop: 14 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  cancel: {
    alignItems: 'center',
    borderColor: colors.inputBorder,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14,
  },
  cancelText: { color: colors.textSubtle, fontWeight: '800' },
  save: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 10,
    flex: 1,
    paddingVertical: 14,
  },
  saveDisabled: { opacity: 0.45 },
  saveText: { color: colors.onAccent, fontWeight: '800' },
})

