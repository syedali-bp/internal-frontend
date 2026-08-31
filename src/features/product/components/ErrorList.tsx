import { StyleSheet, Text, View } from 'react-native'

import type { Palette } from '../../../theme/colors'
import { useColors, useThemedStyles } from '../../../theme/useColors'

export function ErrorList({ errors }: { errors: string[] }) {
  const s = useThemedStyles(makeStyles)
  if (errors.length === 0) return null

  return (
    <View style={s.box}>
      {/* Keyed by position, not by the message: two categories can define
          attributes with the same label ("Shelf Life" on both a food and a
          paper category), so the same sentence really can appear twice and
          keying by text collapses them into a duplicate-key warning. The list
          is static for a given render, so the index is a stable key here. */}
      {errors.map((error, index) => (
        <Text key={`${index}-${error}`} style={s.text}>
          • {error}
        </Text>
      ))}
    </View>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  box: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    padding: 12,
  },
  text: { color: colors.dangerText, fontSize: 13, lineHeight: 20 },
})

