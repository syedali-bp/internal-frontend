import { StyleSheet, View } from 'react-native'

import type { Palette } from '../theme/colors'
import { useColors, useThemedStyles } from '../theme/useColors'

type BarcodeIconProps = {
  color?: string
  size?: number
}

/** A small, dependency-free barcode mark for action buttons and scan overlays. */
export function BarcodeIcon({ color, size = 52 }: BarcodeIconProps) {
  const colors = useColors()
  const tint = color ?? colors.onAccent
  const s = useThemedStyles(makeStyles)
  const bars = [3, 2, 5, 2, 4, 2, 6, 2, 3, 5, 2, 4, 2, 6, 2, 3]

  return (
    <View style={[s.icon, { height: size, width: size }]}> 
      {bars.map((width, index) => (
        <View
          key={index}
          style={{ backgroundColor: tint, height: size, marginRight: index === bars.length - 1 ? 0 : 2, width: (width / 6) * 5 }}
        />
      ))}
    </View>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  icon: { alignItems: 'stretch', flexDirection: 'row', justifyContent: 'center' },
})

