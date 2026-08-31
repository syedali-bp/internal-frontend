import { StyleSheet, View } from 'react-native'

import type { Palette } from '../theme/colors'
import { useColors, useThemedStyles } from '../theme/useColors'

type ProductDetailsIconProps = {
  color?: string
  size?: number
}

export function ProductDetailsIcon({ color, size = 38 }: ProductDetailsIconProps) {
  const colors = useColors()
  const tint = color ?? colors.primary
  const s = useThemedStyles(makeStyles)
  const lineWidth = size * 0.52

  return (
    <View style={[s.icon, { borderColor: tint, height: size, width: size * 0.78 }]}>
      <View style={[s.line, { backgroundColor: tint, width: lineWidth }]} />
      <View style={[s.line, { backgroundColor: tint, width: lineWidth }]} />
      <View style={[s.shortLine, { backgroundColor: tint, width: lineWidth * 0.62 }]} />
    </View>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  icon: {
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    paddingTop: 2,
  },
  line: { height: 3, marginVertical: 2 },
  shortLine: { height: 3, marginTop: 2 },
})

