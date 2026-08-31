import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import type { Palette } from '../theme/colors'
import { makeControls, useColors, useThemedStyles } from '../theme/useColors'

export type DropdownOption = {
  label: string
  value: string
}

type DropdownProps = {
  value: string
  options: readonly (string | DropdownOption)[]
  onChange: (value: string) => void
  placeholder: string
  disabled?: boolean
}

/**
 * Small modal dropdown. RN has no built-in picker, and a modal list avoids
 * pulling in another native dependency.
 */
export function Dropdown({ value, options, onChange, placeholder, disabled = false }: DropdownProps) {
  const controls = useThemedStyles(makeControls)
  const s = useThemedStyles(makeStyles)
  const [open, setOpen] = useState(false)
  const normalizedOptions = options.map((option) =>
    typeof option === 'string' ? { label: option, value: option } : option,
  )
  const selectedOption = normalizedOptions.find((option) => option.value === value)

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

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={s.sheet}>
            <ScrollView contentContainerStyle={s.options}>
              {normalizedOptions.map((option) => (
                <Pressable
                  key={option.value}
                  style={[s.option, option.value === value && s.optionActive]}
                  onPress={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  <Text style={s.optionText}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
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
  sheet: { backgroundColor: colors.surface, borderRadius: 10, maxHeight: '70%' },
  options: { paddingVertical: 6 },
  option: { paddingVertical: 14, paddingHorizontal: 18 },
  optionActive: { backgroundColor: colors.primaryHighlight },
  optionText: { fontSize: 15, color: colors.text },
})

