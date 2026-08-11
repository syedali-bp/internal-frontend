import { StyleSheet, Text, TextInput, View } from 'react-native'

import { colors } from '../theme/colors'
import { controls, forms } from '../theme/styles'

type AttrRowProps = {
  label: string
  value: string
  onChange: (value: string) => void
  unit: string
}

/** Numeric attribute row: label, input, trailing unit. */
export function AttrRow({ label, value, onChange, unit }: AttrRowProps) {
  return (
    <View style={forms.row}>
      <Text style={forms.rowLabel}>{label}</Text>
      <TextInput
        style={[controls.input, { flex: 1 }]}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
      />
      <Text style={s.unit}>{unit}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  unit: { width: 40, fontSize: 13, color: colors.textMuted, textAlign: 'right' },
})
