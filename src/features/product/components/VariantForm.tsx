import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { Checkbox, Field } from '../../../components'
import type { Palette } from '../../../theme/colors'
import { makeControls, useColors, useThemedStyles } from '../../../theme/useColors'
import type { AttributeDefinition } from '../../../types/catalog'
import type { VariantDraft } from '../../../types/product'
import { AttributeControl } from './AttributeControl'

type VariantFormProps = {
  /** The category's `is_variant_axis` attributes — what makes each variant distinct. */
  axes: readonly AttributeDefinition[]
  value: VariantDraft
  onChange: (patch: Partial<VariantDraft>) => void
  /** Saves the form: creates a new variant, or updates the one being edited. */
  onSubmit: () => void
  onCancel: () => void
  isEditing: boolean
  canSubmit: boolean
}

/**
 * The single variant entry form. Filling it and pressing Add appends the
 * variant to the capture; when a saved variant is being edited the same form
 * updates it instead.
 */
export function VariantForm({
  axes,
  value,
  onChange,
  onSubmit,
  onCancel,
  isEditing,
  canSubmit,
}: VariantFormProps) {
  const controls = useThemedStyles(makeControls)
  const colors = useColors()
  const s = useThemedStyles(makeStyles)
  const actionLabel = isEditing ? 'UPDATE VARIANT' : '+  ADD VARIANT'

  return (
    <View style={s.card}>
      <Text style={s.title}>{isEditing ? 'Edit variant' : 'New variant'}</Text>

      {axes.length === 0 && (
        <Text style={s.note}>This category defines no variant axes — SKU only.</Text>
      )}

      {axes.map((axis) => (
        <Field key={axis.id} label={`${axis.name}:`}>
          <AttributeControl
            definition={axis}
            value={value.axes[axis.code] ?? ''}
            onChange={(next) => onChange({ axes: { ...value.axes, [axis.code]: next } })}
          />
        </Field>
      ))}

      <Field label="SKU:">
        <TextInput
          style={controls.input}
          value={value.sku}
          onChangeText={(sku) => onChange({ sku })}
          placeholder="LAYS-SALT-30"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="characters"
        />
      </Field>

      <Field label="Default:">
        <Checkbox
          checked={value.isDefault}
          onToggle={() => onChange({ isDefault: !value.isDefault })}
        />
      </Field>

      <Pressable
        style={[s.action, !canSubmit && s.actionDisabled]}
        onPress={onSubmit}
        disabled={!canSubmit}
      >
        <Text style={s.actionText}>{actionLabel}</Text>
      </Pressable>

      {!canSubmit && (
        <Text style={s.hint}>
          {axes.length
            ? 'Choose every option above and enter a SKU to add this variant.'
            : 'Enter a SKU to add this variant.'}
        </Text>
      )}

      {isEditing && (
        <Pressable style={s.cancel} onPress={onCancel}>
          <Text style={s.cancelText}>Cancel edit</Text>
        </Pressable>
      )}
    </View>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
    borderStyle: 'dashed',
    backgroundColor: colors.primaryBg,
    borderRadius: 8,
    padding: 14,
    marginTop: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.4,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  note: { fontSize: 12, color: colors.textMuted, marginBottom: 10 },

  action: {
    marginTop: 6,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionDisabled: { opacity: 0.4 },
  actionText: { color: colors.onAccent, fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },

  hint: { fontSize: 11, color: colors.textMuted, marginTop: 8, textAlign: 'center' },

  cancel: { marginTop: 10, alignItems: 'center' },
  cancelText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
})

