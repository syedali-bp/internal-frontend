import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors } from '../../../theme/colors'
import type { AttributeDefinition } from '../../../types/catalog'
import type { PackagingLevelDraft, Variant } from '../../../types/product'

type SavedVariantRowProps = {
  variant: Variant
  index: number
  axes: readonly AttributeDefinition[]
  isEditing: boolean
  onEdit: () => void
  onDelete: () => void
  onAddPackaging: () => void
  packagingLevels: readonly PackagingLevelDraft[]
}

/** Renders the axis answers as "Flavour: Salted · Pack Size: 30 g". */
function describeAxes(variant: Variant, axes: readonly AttributeDefinition[]) {
  if (axes.length === 0) return 'No variant axes'

  return axes
    .map((axis) => {
      const value = variant.axes[axis.code]
      const text = Array.isArray(value) ? value.join(', ') : String(value ?? '')
      return `${axis.name}: ${text}${axis.unit ? ` ${axis.unit}` : ''}`
    })
    .join('  ·  ')
}

/** One variant already added to the capture, with its edit/delete controls. */
export function SavedVariantRow({
  variant,
  index,
  axes,
  isEditing,
  onEdit,
  onDelete,
  onAddPackaging,
  packagingLevels,
}: SavedVariantRowProps) {
  const rows = packagingLevels ?? []

  return (
    <View style={[s.card, isEditing && s.cardEditing]}>
      <View style={s.head}>
        <View style={s.headText}>
          <Text style={s.title}>
            Variant {index + 1}
            {variant.isDefault && <Text style={s.default}>  · DEFAULT</Text>}
          </Text>
          <Text style={s.rowId}>saved row {variant.id.slice(0, 8)}</Text>
        </View>

        <View style={s.actions}>
          <Pressable onPress={onEdit} hitSlop={6}>
            <Text style={s.edit}>Edit</Text>
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={6}>
            <Text style={s.delete}>Delete</Text>
          </Pressable>
        </View>
      </View>

      <Text style={s.axes}>{describeAxes(variant, axes)}</Text>
      <Text style={s.sku}>SKU: {variant.sku || '—'}</Text>

      <View style={s.packagingHead}>
        <Text style={s.packagingTitle}>Packaging</Text>
        <Pressable onPress={onAddPackaging} hitSlop={6}>
          <Text style={s.addPackaging}>+ Add Packaging</Text>
        </Pressable>
      </View>

      {rows.length === 0 ? (
        <Text style={s.packagingEmpty}>No packaging added yet.</Text>
      ) : (
        rows.map((packaging, index) => (
          <View key={`${variant.id}-pkg-${index}`} style={s.packagingItem}>
            <Text style={s.packagingLine}>
              {packaging.level || 'level not set'} · {packaging.quantityOfParent || '0'} parent units
            </Text>
            {!!packaging.description && <Text style={s.packagingDesc}>{packaging.description}</Text>}
            <Text style={s.packagingMeta}>
              {packaging.grossWeight
                ? `${packaging.grossWeight} ${packaging.weightUnit || ''}`.trim()
                : 'No weight'}
              {'  ·  '}
              {packaging.dimensions.length && packaging.dimensions.width && packaging.dimensions.height
                ? `${packaging.dimensions.length} × ${packaging.dimensions.width} × ${packaging.dimensions.height} ${packaging.dimensions.unit || ''}`.trim()
                : 'No dimensions'}
            </Text>
          </View>
        ))
      )}

      {isEditing && <Text style={s.editingNote}>Editing in the form below</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryBg,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  cardEditing: { borderColor: colors.primary, borderWidth: 2 },

  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headText: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: colors.primary },
  default: { fontSize: 10, fontWeight: '800', color: colors.attribute },
  rowId: { fontSize: 10, color: colors.textMuted, marginTop: 1 },

  actions: { flexDirection: 'row', gap: 14 },
  edit: { fontSize: 13, fontWeight: '700', color: colors.primary },
  delete: { fontSize: 13, fontWeight: '700', color: colors.danger },

  axes: { fontSize: 13, color: colors.text, marginTop: 8 },
  sku: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  editingNote: { fontSize: 11, color: colors.primary, marginTop: 8, fontWeight: '600' },
  packagingHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  packagingTitle: { fontSize: 12, fontWeight: '800', color: colors.text },
  addPackaging: { fontSize: 12, fontWeight: '800', color: colors.primary },
  packagingEmpty: { fontSize: 12, color: colors.textMuted, marginTop: 6, fontStyle: 'italic' },
  packagingItem: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.headerBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  packagingLine: { fontSize: 12, color: colors.text, fontWeight: '700' },
  packagingDesc: { fontSize: 12, color: colors.textSubtle, marginTop: 2 },
  packagingMeta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
})
