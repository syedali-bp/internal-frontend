import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { Dropdown, Field } from '../../../components'
import { colors } from '../../../theme/colors'
import { controls } from '../../../theme/styles'
import type { PackagingLevelDraft } from '../../../types/product'

const LEVELS = [
  { label: 'Unit', value: 'unit' },
  { label: 'Inner Pack', value: 'inner_pack' },
  { label: 'Case', value: 'case' },
  { label: 'Pallet', value: 'pallet' },
]

const EMPTY_FORM: PackagingLevelDraft = {
  level: '',
  quantityOfParent: '',
  description: '',
  grossWeight: '',
  weightUnit: '',
  dimensions: { length: '', width: '', height: '', unit: '' },
}

type PackagingFormProps = {
  value: PackagingLevelDraft
  onChange: (next: PackagingLevelDraft) => void
  onSubmit: () => void
  onCancel: () => void
}

export function createEmptyPackaging(): PackagingLevelDraft {
  return {
    level: EMPTY_FORM.level,
    quantityOfParent: EMPTY_FORM.quantityOfParent,
    description: EMPTY_FORM.description,
    grossWeight: EMPTY_FORM.grossWeight,
    weightUnit: EMPTY_FORM.weightUnit,
    dimensions: { ...EMPTY_FORM.dimensions },
  }
}

export function PackagingForm({ value, onChange, onSubmit, onCancel }: PackagingFormProps) {
  return (
    <View style={s.card}>
      <Text style={s.title}>Add Packaging</Text>

      <Field label="Level:">
        <Dropdown
          value={value.level}
          options={LEVELS}
          onChange={(level) => onChange({ ...value, level: level as PackagingLevelDraft['level'] })}
          placeholder="Select level"
        />
      </Field>

      <Field label="Qty:">
        <TextInput
          style={controls.input}
          value={value.quantityOfParent}
          onChangeText={(quantityOfParent) => onChange({ ...value, quantityOfParent })}
          keyboardType="numeric"
          placeholder="12"
          placeholderTextColor={colors.placeholder}
        />
      </Field>

      <Field label="Desc:">
        <TextInput
          style={controls.input}
          value={value.description}
          onChangeText={(description) => onChange({ ...value, description })}
          placeholder="Carton of 12"
          placeholderTextColor={colors.placeholder}
        />
      </Field>

      <Field label="Weight:">
        <View style={s.inline}>
          <TextInput
            style={[controls.input, s.weight]}
            value={value.grossWeight}
            onChangeText={(grossWeight) => onChange({ ...value, grossWeight })}
            keyboardType="numeric"
            placeholder="0.0"
            placeholderTextColor={colors.placeholder}
          />
          <TextInput
            style={[controls.input, s.unit]}
            value={value.weightUnit}
            onChangeText={(weightUnit) => onChange({ ...value, weightUnit })}
            placeholder="kg"
            placeholderTextColor={colors.placeholder}
          />
        </View>
      </Field>

      <Field label="Dimensions:">
        <View style={s.dimRow}>
          <TextInput
            style={[controls.input, s.dim]}
            value={value.dimensions.length}
            onChangeText={(length) =>
              onChange({ ...value, dimensions: { ...value.dimensions, length } })
            }
            placeholder="L"
            placeholderTextColor={colors.placeholder}
            keyboardType="numeric"
          />
          <TextInput
            style={[controls.input, s.dim]}
            value={value.dimensions.width}
            onChangeText={(width) =>
              onChange({ ...value, dimensions: { ...value.dimensions, width } })
            }
            placeholder="W"
            placeholderTextColor={colors.placeholder}
            keyboardType="numeric"
          />
          <TextInput
            style={[controls.input, s.dim]}
            value={value.dimensions.height}
            onChangeText={(height) =>
              onChange({ ...value, dimensions: { ...value.dimensions, height } })
            }
            placeholder="H"
            placeholderTextColor={colors.placeholder}
            keyboardType="numeric"
          />
        </View>
        <TextInput
          style={[controls.input, s.dimUnit]}
          value={value.dimensions.unit}
          onChangeText={(unit) => onChange({ ...value, dimensions: { ...value.dimensions, unit } })}
          placeholder="cm"
          placeholderTextColor={colors.placeholder}
        />
      </Field>

      <View style={s.actions}>
        <Pressable style={s.primary} onPress={onSubmit}>
          <Text style={s.primaryText}>Save Packaging</Text>
        </Pressable>
        <Pressable style={s.secondary} onPress={onCancel}>
          <Text style={s.secondaryText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    backgroundColor: colors.primaryBg,
    borderRadius: 10,
    padding: 14,
  },
  title: { fontSize: 13, fontWeight: '800', color: colors.primary, marginBottom: 10 },
  inline: { flexDirection: 'row', gap: 8 },
  weight: { flex: 1 },
  unit: { width: 90 },
  dimRow: { flexDirection: 'row', gap: 8 },
  dim: { flex: 1, textAlign: 'center' },
  dimUnit: { marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  primary: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: colors.onAccent, fontWeight: '800' },
  secondary: {
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    justifyContent: 'center',
  },
  secondaryText: { color: colors.textSubtle, fontWeight: '700' },
})
