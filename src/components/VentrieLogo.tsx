import { StyleSheet, View } from 'react-native'

import type { Palette } from '../theme/colors'
import { useColors, useThemedStyles } from '../theme/useColors'

type VentrieLogoProps = {
  color?: string
  size?: number
}

/**
 * The Ventrie mark: three isometric blocks stacked into a building.
 *
 * Drawn from Views rather than an asset because the repo carries no logo file,
 * and rather than an SVG because nothing here pulls in react-native-svg — the
 * same reason BarcodeIcon is built this way. Each face is a rotated square, so
 * the mark scales with `size` instead of needing artwork per density.
 */
export function VentrieLogo({ color, size = 44 }: VentrieLogoProps) {
  const colors = useColors()
  const tint = color ?? colors.primary
  const s = useThemedStyles(makeStyles)
  // One block's face, as a share of the whole mark.
  const block = size * 0.46
  const overlap = block * 0.34

  return (
    <View style={[s.mark, { height: size, width: size }]}>
      {/* Back-left and back-right faces sit lower and dimmer, so the front
          block reads as nearest rather than as three flat diamonds. */}
      <View
        style={[
          s.face,
          {
            backgroundColor: tint,
            height: block,
            width: block,
            opacity: 0.45,
            left: 0,
            top: size * 0.3,
          },
        ]}
      />
      <View
        style={[
          s.face,
          {
            backgroundColor: tint,
            height: block,
            width: block,
            opacity: 0.7,
            right: 0,
            top: size * 0.3,
          },
        ]}
      />
      <View
        style={[
          s.face,
          {
            backgroundColor: tint,
            height: block,
            width: block,
            alignSelf: 'center',
            top: size * 0.3 - overlap,
          },
        ]}
      />
    </View>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  mark: { position: 'relative' },
  face: {
    borderRadius: 3,
    position: 'absolute',
    transform: [{ rotate: '45deg' }, { scaleY: 0.58 }],
  },
})

