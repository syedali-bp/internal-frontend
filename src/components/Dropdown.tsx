import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'

import { colors } from '../theme/colors'
import { controls } from '../theme/styles'

type DropdownProps = {
  value: string
  options: string[]
  onChange: (value: string) => void
  placeholder: string
}

/**
 * Small modal dropdown. RN has no built-in picker, and a modal list avoids
 * pulling in another native dependency.
 */
export function Dropdown({ value, options, onChange, placeholder }: DropdownProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Pressable style={controls.input} onPress={() => setOpen(true)}>
        <Text style={value ? s.valueText : s.placeholder}>{value || placeholder}</Text>
        <Text style={s.caret}>⌄</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={s.sheet}>
            {options.map((option) => (
              <Pressable
                key={option}
                style={[s.option, option === value && s.optionActive]}
                onPress={() => {
                  onChange(option)
                  setOpen(false)
                }}
              >
                <Text style={s.optionText}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  valueText: { fontSize: 14, color: colors.text, flex: 1 },
  placeholder: { fontSize: 14, color: colors.placeholder, flex: 1 },
  caret: { fontSize: 16, color: colors.textMuted, marginTop: -6 },

  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    padding: 32,
  },
  sheet: { backgroundColor: colors.surface, borderRadius: 10, paddingVertical: 6 },
  option: { paddingVertical: 14, paddingHorizontal: 18 },
  optionActive: { backgroundColor: colors.primaryHighlight },
  optionText: { fontSize: 15, color: colors.text },
})
