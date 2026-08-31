import { StyleSheet, Text, View } from 'react-native'

import type { Palette } from '../../../theme/colors'
import { useColors, useThemedStyles } from '../../../theme/useColors'
import type { AttributeDefinition, AttributeValue } from '../../../types/catalog'
import { AttributeControl } from './AttributeControl'

type AttributeFieldProps = {
  definition: AttributeDefinition
  value: AttributeValue
  onChange: (value: AttributeValue) => void
}

/** A labelled attribute row: name, required marker, and the data type's control. */
export function AttributeField({ definition, value, onChange }: AttributeFieldProps) {
  const s = useThemedStyles(makeStyles)
  return (
    <View style={s.field}>
      <Text style={s.label}>
        {definition.name}
        {definition.is_required && <Text style={s.required}> *</Text>}
      </Text>
      <AttributeControl definition={definition} value={value} onChange={onChange} />
    </View>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  required: { color: colors.danger },
})

