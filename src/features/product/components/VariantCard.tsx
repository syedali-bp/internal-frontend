import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { Checkbox, Dropdown, Field } from '../../../components'
import { COLORS, STORAGES } from '../../../constants/options'
import { colors } from '../../../theme/colors'
import { controls } from '../../../theme/styles'
import type { Variant } from '../../../types/product'

type VariantCardProps = {
  variant: Variant
  index: number
  canRemove: boolean
  onChange: (patch: Partial<Variant>) => void
  onRemove: () => void
  onToggleDefault: () => void
}

export function VariantCard({
  variant,
  index,
  canRemove,
  onChange,
  onRemove,
  onToggleDefault,
}: VariantCardProps) {
  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.title}>Variant {index + 1}</Text>
        {canRemove && (
          <Pressable onPress={onRemove}>
            <Text style={s.remove}>Remove</Text>
          </Pressable>
        )}
      </View>

      <Field label="Color:">
        <Dropdown
          value={variant.color}
          options={COLORS}
          onChange={(color) => onChange({ color })}
          placeholder="Select color"
        />
      </Field>

      <Field label="Storage:">
        <Dropdown
          value={variant.storage}
          options={STORAGES}
          onChange={(storage) => onChange({ storage })}
          placeholder="Select storage"
        />
      </Field>

      <Field label="SKU:">
        <TextInput
          style={controls.input}
          value={variant.sku}
          onChangeText={(sku) => onChange({ sku })}
          placeholder="SAM-S24-BLK-256"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="characters"
        />
      </Field>

      <Field label="Default:">
        <Checkbox checked={variant.isDefault} onToggle={onToggleDefault} />
      </Field>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryBg,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 14, fontWeight: '700', color: colors.primary },
  remove: { fontSize: 12, color: colors.danger },
})
