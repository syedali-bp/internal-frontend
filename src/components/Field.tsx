import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { forms } from '../theme/styles'

type FieldProps = {
  label: string
  children: ReactNode
}

/** Label on the left, control filling the remaining width. */
export function Field({ label, children }: FieldProps) {
  return (
    <View style={forms.row}>
      <Text style={forms.rowLabel}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  )
}
