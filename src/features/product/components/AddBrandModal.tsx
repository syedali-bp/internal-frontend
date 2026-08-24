import { useEffect, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { Dropdown } from '../../../components'
import { colors } from '../../../theme/colors'
import { controls, forms } from '../../../theme/styles'
import type { Vertical } from '../../../types/catalog'

/**
 * The body `POST /api/catalog/brand/add` accepts.
 *
 * `normalized_name` and `aliases` are absent on purpose: the server derives the
 * first as its dedup key, and the second comes from what collectors find in the
 * field rather than from one form.
 */
export type NewBrand = {
  name: string
  logo_url: string
  /** Vertical *codes*, not ids. The server rejects a code that is not a vertical. */
  verticals: string[]
  manufacturer_id: string | null
}

type AddBrandModalProps = {
  visible: boolean
  onCancel: () => void
  onSubmit: (body: NewBrand) => void
  saving: boolean
  error: string | null
  /** Every vertical, so the brand can be filed against more than the current one. */
  verticals: readonly Vertical[]
  /** The vertical being captured under; pre-selected, since it is the likely answer. */
  currentVerticalCode: string
  /** Manufacturers to attach to, and the one already picked on the form. */
  manufacturerOptions: readonly { label: string; value: string }[]
  currentManufacturerId: string
}

/**
 * Creates a brand without leaving the capture.
 *
 * The manufacturer is optional here, exactly as it is on the brand itself — a
 * collector reading a pack usually knows the brand and not who owns it, and a
 * brand invented to satisfy a required field is worse than a null.
 */
export function AddBrandModal({
  visible,
  onCancel,
  onSubmit,
  saving,
  error,
  verticals,
  currentVerticalCode,
  manufacturerOptions,
  currentManufacturerId,
}: AddBrandModalProps) {
  const [name, setName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])
  const [manufacturerId, setManufacturerId] = useState('')

  // Opening seeds the two answers the form already knows, so the common case is
  // type a name and press Save. Closing is what clears them, not opening, so a
  // server error leaves everything typed still on screen.
  useEffect(() => {
    if (!visible) return

    setSelectedCodes(currentVerticalCode ? [currentVerticalCode] : [])
    setManufacturerId(currentManufacturerId)
  }, [visible, currentVerticalCode, currentManufacturerId])

  const reset = () => {
    setName('')
    setLogoUrl('')
    setSelectedCodes([])
    setManufacturerId('')
  }

  const handleCancel = () => {
    reset()
    onCancel()
  }

  const toggleCode = (code: string) => {
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((entry) => entry !== code) : [...prev, code],
    )
  }

  // The server requires at least one vertical, so Save stays out of reach until
  // there is one rather than letting the request come back rejected.
  const canSave = name.trim().length > 0 && selectedCodes.length > 0 && !saving

  const handleSubmit = () => {
    if (!canSave) return

    onSubmit({
      name: name.trim(),
      logo_url: logoUrl.trim(),
      verticals: selectedCodes,
      manufacturer_id: manufacturerId || null,
    })
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={s.title}>New Brand</Text>

          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            <Text style={forms.label}>Name:</Text>
            <TextInput
              style={controls.input}
              value={name}
              onChangeText={setName}
              placeholder="Olpers"
              placeholderTextColor={colors.placeholder}
              autoFocus
            />

            <Text style={forms.label}>Manufacturer:</Text>
            <Dropdown
              value={manufacturerId}
              options={manufacturerOptions}
              onChange={setManufacturerId}
              placeholder="Optional — leave blank if unknown"
            />
            {!!manufacturerId && (
              <Pressable onPress={() => setManufacturerId('')} hitSlop={8}>
                <Text style={s.clear}>Clear manufacturer</Text>
              </Pressable>
            )}

            <Text style={forms.label}>Sells into:</Text>
            <View style={s.chips}>
              {verticals.map((vertical) => {
                const active = selectedCodes.includes(vertical.code)
                return (
                  <Pressable
                    key={vertical.id}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => toggleCode(vertical.code)}
                  >
                    <Text style={[s.chipText, active && s.chipTextActive]}>{vertical.name}</Text>
                  </Pressable>
                )
              })}
            </View>
            <Text style={s.hint}>At least one vertical is required.</Text>

            <Text style={forms.label}>Logo URL:</Text>
            <TextInput
              style={controls.input}
              value={logoUrl}
              onChangeText={setLogoUrl}
              placeholder="https://example.com/logo.png"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            {error && <Text style={s.error}>{error}</Text>}
          </ScrollView>

          <View style={s.actions}>
            <Pressable style={[s.button, s.cancel]} onPress={handleCancel} disabled={saving}>
              <Text style={s.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[s.button, s.save, !canSave && s.disabled]}
              onPress={handleSubmit}
              disabled={!canSave}
            >
              <Text style={s.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    padding: 16,
    paddingBottom: 4,
  },
  body: { paddingHorizontal: 16, paddingBottom: 12 },

  clear: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 7 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: colors.primaryBg, borderColor: colors.primaryBorder },
  chipText: { fontSize: 13, color: colors.textMuted },
  chipTextActive: { color: colors.primary, fontWeight: '700' },

  hint: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  error: { fontSize: 12, color: colors.dangerText, marginTop: 12, lineHeight: 17 },

  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  button: { flex: 1, borderRadius: 8, paddingVertical: 13, alignItems: 'center' },
  cancel: { borderWidth: 1, borderColor: colors.inputBorder },
  cancelText: { color: colors.textSubtle, fontWeight: '700', fontSize: 14 },
  save: { backgroundColor: colors.accent },
  saveText: { color: colors.onAccent, fontWeight: '800', fontSize: 14 },
  disabled: { opacity: 0.5 },
})
