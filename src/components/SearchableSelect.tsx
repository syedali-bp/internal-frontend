import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import type { Palette } from '../theme/colors'
import { makeControls, useColors, useThemedStyles } from '../theme/useColors'
import type { DropdownOption } from './Dropdown'

type SearchableSelectProps = {
  value: string
  options: readonly DropdownOption[]
  onChange: (value: string) => void
  placeholder: string
  /** Prompt inside the search box, e.g. "Search countries". */
  searchPlaceholder?: string
  disabled?: boolean
}

/**
 * Dropdown for lists too long to scroll through — the ISO country list, for
 * instance. Same trigger as {@link Dropdown}, but the sheet filters as you type
 * and the list is virtualised.
 */
export function SearchableSelect({
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder = 'Search',
  disabled = false,
}: SearchableSelectProps) {
  const controls = useThemedStyles(makeControls)
  const colors = useColors()
  const s = useThemedStyles(makeStyles)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedOption = options.find((option) => option.value === value)

  // Matching on the value as well as the label lets a known code ("PK") find its
  // row without typing the country name out.
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return options
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.value.toLowerCase().includes(needle),
    )
  }, [options, query])

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <Pressable
        style={[controls.input, disabled && s.disabled]}
        onPress={() => setOpen(true)}
        disabled={disabled}
      >
        <Text style={selectedOption ? s.valueText : s.placeholder}>
          {selectedOption?.label || placeholder}
        </Text>
        <Text style={s.caret}>⌄</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={s.backdrop} onPress={close}>
          {/* Stops a tap inside the sheet from closing it. */}
          <Pressable style={s.sheet} onPress={() => {}}>
            <TextInput
              style={s.search}
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.placeholder}
              autoCorrect={false}
              autoFocus
            />

            <FlatList
              data={visible}
              keyExtractor={(option) => option.value}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={s.empty}>No matches.</Text>}
              renderItem={({ item }) => (
                <Pressable
                  style={[s.option, item.value === value && s.optionActive]}
                  onPress={() => {
                    onChange(item.value)
                    close()
                  }}
                >
                  <Text style={s.optionText}>{item.label}</Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  valueText: { fontSize: 14, color: colors.text, flex: 1 },
  placeholder: { fontSize: 14, color: colors.placeholder, flex: 1 },
  caret: { fontSize: 16, color: colors.textMuted, marginTop: -6 },
  disabled: { opacity: 0.55 },

  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    padding: 32,
  },
  sheet: { backgroundColor: colors.surface, borderRadius: 10, maxHeight: '70%', overflow: 'hidden' },

  search: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  option: { paddingVertical: 14, paddingHorizontal: 18 },
  optionActive: { backgroundColor: colors.primaryHighlight },
  optionText: { fontSize: 15, color: colors.text },
  empty: { padding: 18, fontSize: 14, color: colors.textMuted },
})

