import { Pressable, StyleSheet, Text, View } from 'react-native'

import { Dropdown } from '../../../components'
import { colors } from '../../../theme/colors'
import type { MediaKind } from '../../../types/catalog'
import { MEDIA_KIND_OPTIONS, isDocumentKind, mediaKindLabel, type MediaItem } from '../media'

type MediaSectionProps = {
  items: readonly MediaItem[]
  kind: MediaKind
  onKindChange: (kind: MediaKind) => void
  onAdd: () => void
  onRemove: (id: string) => void
  error: string | null
}

const dropdownOptions = MEDIA_KIND_OPTIONS.map((option) => ({
  label: `${option.label}  ·  ${option.kind}`,
  value: option.kind,
}))

/**
 * Attachments for the product. One kind picker plus one Add button, so the
 * section stays the same height whether the catalog defines three kinds or ten.
 */
export function MediaSection({
  items,
  kind,
  onKindChange,
  onAdd,
  onRemove,
  error,
}: MediaSectionProps) {
  return (
    <View>
      {items.length === 0 ? (
        <Text style={s.empty}>No media added yet.</Text>
      ) : (
        <View style={s.list}>
          {items.map((item) => (
            <View key={item.id} style={s.row}>
              {/* No image preview: the row states the kind and the file name
                  instead. A photo just taken is not in doubt, and rendering it
                  again only makes the list long enough to scroll past. */}
              <View style={s.rowText}>
                <Text style={s.rowKind}>{item.kind}</Text>
                <Text style={s.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>

              <Pressable onPress={() => onRemove(item.id)} hitSlop={8}>
                <Text style={s.remove}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={s.controls}>
        <View style={s.picker}>
          <Dropdown
            value={kind}
            options={dropdownOptions}
            onChange={(value) => onKindChange(value as MediaKind)}
            placeholder="Select media type"
          />
        </View>

        <Pressable style={s.add} onPress={onAdd}>
          <Text style={s.addText}>+ Add Media</Text>
        </Pressable>
      </View>

      <Text style={s.hint}>
        {isDocumentKind(kind)
          ? `Adds a file for ${mediaKindLabel(kind)}.`
          : 'Choose to take a photo or pick one from the gallery.'}
      </Text>

      {error && <Text style={s.error}>{error}</Text>}
    </View>
  )
}

const s = StyleSheet.create({
  empty: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginBottom: 10 },

  list: { marginBottom: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.headerBg,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  rowText: { flex: 1 },
  rowKind: { fontSize: 12, fontWeight: '800', color: colors.primary },
  rowName: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  remove: { fontSize: 12, fontWeight: '700', color: colors.danger },

  controls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  picker: { flex: 1 },
  add: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addText: { color: colors.onAccent, fontWeight: '800', fontSize: 13 },

  hint: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  error: { fontSize: 12, color: colors.danger, marginTop: 6 },
})
