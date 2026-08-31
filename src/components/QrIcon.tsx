import { StyleSheet, View } from 'react-native'

import type { Palette } from '../theme/colors'
import { useColors, useThemedStyles } from '../theme/useColors'

type QrIconProps = {
  color?: string
  size?: number
}

/** Three finder squares and a scatter of cells — a QR code at icon scale. */
export function QrIcon({ color, size = 30 }: QrIconProps) {
  const colors = useColors()
  const tint = color ?? colors.onAccent
  const s = useThemedStyles(makeStyles)
  const finder = size * 0.38
  const cell = size * 0.16

  const finderStyle = { borderColor: tint, borderWidth: Math.max(2, size * 0.075), height: finder, width: finder }
  const cellStyle = { backgroundColor: tint, height: cell, width: cell }

  return (
    <View style={[s.icon, { height: size, width: size }]}>
      <View style={[s.finder, finderStyle, { left: 0, top: 0 }]} />
      <View style={[s.finder, finderStyle, { right: 0, top: 0 }]} />
      <View style={[s.finder, finderStyle, { bottom: 0, left: 0 }]} />
      {/* The data area: enough cells to read as a code, few enough to stay
          legible when the icon is small. */}
      <View style={[s.cell, cellStyle, { bottom: cell * 0.4, right: 0 }]} />
      <View style={[s.cell, cellStyle, { bottom: cell * 2, right: cell * 1.6 }]} />
      <View style={[s.cell, cellStyle, { bottom: cell * 2, right: 0 }]} />
    </View>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  icon: { position: 'relative' },
  finder: { borderRadius: 2, position: 'absolute' },
  cell: { borderRadius: 1, position: 'absolute' },
})

