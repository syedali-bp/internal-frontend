import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { Palette } from '../../../theme/colors'
import { useColors, useThemedStyles } from '../../../theme/useColors'

type AuthFieldProps = {
  label: string
  /** Marks the label with an asterisk, so what is mandatory is visible up front. */
  required?: boolean
  children: ReactNode
}

/**
 * A label stacked above its control.
 *
 * The shared `Field` puts the label beside the control on a fixed 78px column,
 * which suits the dense capture form. A login card has room to breathe and only
 * two fields, so these stack instead.
 */
export function AuthField({ label, required = false, children }: AuthFieldProps) {
  const s = useThemedStyles(makeStyles)
  return (
    <View style={s.field}>
      <Text style={s.label}>
        {label}
        {required ? <Text style={s.required}> *</Text> : null}
      </Text>
      {children}
    </View>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  field: { marginTop: 18 },
  label: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  required: { color: colors.danger },
})

