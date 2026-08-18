import { StyleSheet, View } from 'react-native'

import { colors } from '../theme/colors'

type BarcodeIconProps = {
  color?: string
  size?: number
}

/** A small, dependency-free barcode mark for action buttons and scan overlays. */
export function BarcodeIcon({ color = colors.onAccent, size = 52 }: BarcodeIconProps) {
  const bars = [3, 2, 5, 2, 4, 2, 6, 2, 3, 5, 2, 4, 2, 6, 2, 3]

  return (
    <View style={[s.icon, { height: size, width: size }]}> 
      {bars.map((width, index) => (
        <View
          key={index}
          style={{ backgroundColor: color, height: size, marginRight: index === bars.length - 1 ? 0 : 2, width: (width / 6) * 5 }}
        />
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  icon: { alignItems: 'stretch', flexDirection: 'row', justifyContent: 'center' },
})
