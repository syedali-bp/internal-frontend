import { StyleSheet, View } from 'react-native'

import { colors } from '../theme/colors'

type ProductDetailsIconProps = {
  color?: string
  size?: number
}

export function ProductDetailsIcon({ color = colors.primary, size = 38 }: ProductDetailsIconProps) {
  const lineWidth = size * 0.52

  return (
    <View style={[s.icon, { borderColor: color, height: size, width: size * 0.78 }]}>
      <View style={[s.line, { backgroundColor: color, width: lineWidth }]} />
      <View style={[s.line, { backgroundColor: color, width: lineWidth }]} />
      <View style={[s.shortLine, { backgroundColor: color, width: lineWidth * 0.62 }]} />
    </View>
  )
}

const s = StyleSheet.create({
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
