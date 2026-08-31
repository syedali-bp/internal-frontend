import { Pressable, StyleSheet, Text } from 'react-native'

import { useColors } from './useColors'
import { useTheme } from './ThemeContext'

/**
 * Switches between light and dark.
 *
 * Shows the theme it will switch *to* rather than the one in use: a control
 * that offers an action reads better as the destination than as a status
 * light, and there is no room here for a label saying which is which.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const colors = useColors()
  const goingToDark = theme === 'light'

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={goingToDark ? 'Switch to dark mode' : 'Switch to light mode'}
      hitSlop={10}
      onPress={toggleTheme}
      style={[s.button, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={s.glyph}>{goingToDark ? '🌙' : '☀️'}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  // The glyph carries its own colour, so only the size is set here and the
  // sheet stays static.
  glyph: { fontSize: 18, lineHeight: 22 },
})
