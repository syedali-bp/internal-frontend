import { StyleSheet, View } from 'react-native'

import type { Palette } from '../theme/colors'
import { useColors, useThemedStyles } from '../theme/useColors'

type EyeIconProps = {
  color?: string
  size?: number
  /** Draws the struck-through form, for "hidden". */
  off?: boolean
}

/** An eye, optionally struck through — the show/hide toggle on a secret field. */
export function EyeIcon({ color, size = 18, off = false }: EyeIconProps) {
  const colors = useColors()
  const tint = color ?? colors.textMuted
  const s = useThemedStyles(makeStyles)
  const stroke = Math.max(1.5, size * 0.09)

  return (
    <View style={[s.icon, { height: size, width: size }]}>
      {/* The lid is a wide, squat oval; the pupil sits inside it. */}
      <View
        style={{
          borderColor: tint,
          borderRadius: size * 0.5,
          borderWidth: stroke,
          height: size * 0.62,
          width: size,
        }}
      />
      <View
        style={{
          backgroundColor: tint,
          borderRadius: size * 0.12,
          height: size * 0.24,
          position: 'absolute',
          width: size * 0.24,
        }}
      />
      {off ? (
        <View
          style={{
            backgroundColor: tint,
            height: stroke,
            position: 'absolute',
            transform: [{ rotate: '-45deg' }],
            width: size * 1.1,
          }}
        />
      ) : null}
    </View>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center' },
})

