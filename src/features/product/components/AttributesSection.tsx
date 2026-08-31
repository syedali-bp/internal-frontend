import { StyleSheet, Text, View } from 'react-native'

import type { Palette } from '../../../theme/colors'
import { useColors, useThemedStyles } from '../../../theme/useColors'
import type { AttributeDefinition, AttributeValue, AttributeValues } from '../../../types/catalog'
import { AttributeField } from './AttributeField'

type AttributesSectionProps = {
  definitions: readonly AttributeDefinition[]
  values: AttributeValues
  onChange: (code: string, value: AttributeValue) => void
  hasCategory: boolean
}

/** The category-driven attribute form, plus the states where there is nothing to show. */
export function AttributesSection({
  definitions,
  values,
  onChange,
  hasCategory,
}: AttributesSectionProps) {
  const s = useThemedStyles(makeStyles)
  if (!hasCategory) {
    return <Text style={s.note}>Select a category to see its attributes.</Text>
  }

  if (definitions.length === 0) {
    return <Text style={s.note}>This category has no attributes defined.</Text>
  }

  return (
    <View style={s.card}>
      {definitions.map((definition) => (
        <AttributeField
          key={definition.id}
          definition={definition}
          value={values[definition.code] ?? ''}
          onChange={(value) => onChange(definition.code, value)}
        />
      ))}
    </View>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.attributeBorder,
    backgroundColor: colors.attributeBg,
    borderRadius: 8,
    padding: 14,
    paddingBottom: 0,
  },
  note: { fontSize: 13, color: colors.textMuted, paddingVertical: 6 },
})

