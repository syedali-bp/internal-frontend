import { Pressable, StyleSheet, Text } from 'react-native'

import type { Palette } from '../theme/colors'
import { useColors, useThemedStyles } from '../theme/useColors'

type CheckboxProps = {
  checked: boolean
  onToggle: () => void
}

export function Checkbox({ checked, onToggle }: CheckboxProps) {
  const s = useThemedStyles(makeStyles)
  return (
    <Pressable
      onPress={onToggle}
      style={[s.box, checked && s.boxOn]}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      {checked && <Text style={s.tick}>✓</Text>}
    </Pressable>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  box: {
    width: 26,
    height: 26,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
})

