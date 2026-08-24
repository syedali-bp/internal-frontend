import { useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { SearchableSelect } from '../../../components'
import { COUNTRIES } from '../../../constants/countries'
import { colors } from '../../../theme/colors'
import { controls, forms } from '../../../theme/styles'

/** The body `POST /api/catalog/manufacturer/add` accepts. Only the name is required. */
export type NewManufacturer = {
  name: string
  country: string
  website: string
  logo_url: string
}

type AddManufacturerModalProps = {
  visible: boolean
  onCancel: () => void
  /** Resolves once the catalog has the row, so the caller can select it. */
  onSubmit: (body: NewManufacturer) => void
  saving: boolean
  /** Whatever the server said, e.g. that the name is already taken. */
  error: string | null
}

const countryOptions = COUNTRIES.map((country) => ({
  label: `${country.name} (${country.code})`,
  value: country.code,
}))

/**
 * Creates a manufacturer without leaving the capture.
 *
 * A collector standing in front of a shelf is the first person to see a maker
 * the catalog has never heard of, so blocking the product on someone else adding
 * it later would mean losing the capture. The fields are the same four the admin
 * form sends, and the server still decides whether the name is a duplicate.
 */
export function AddManufacturerModal({
  visible,
  onCancel,
  onSubmit,
  saving,
  error,
}: AddManufacturerModalProps) {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [website, setWebsite] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  // Every open starts clean: the last attempt's text is not this manufacturer.
  const reset = () => {
    setName('')
    setCountry('')
    setWebsite('')
    setLogoUrl('')
  }

  const handleCancel = () => {
    reset()
    onCancel()
  }

  const handleSubmit = () => {
    if (!name.trim() || saving) return

    onSubmit({
      name: name.trim(),
      country,
      website: website.trim(),
      logo_url: logoUrl.trim(),
    })
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={s.title}>New Manufacturer</Text>

          <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
            <Text style={forms.label}>Name:</Text>
            <TextInput
              style={controls.input}
              value={name}
              onChangeText={setName}
              placeholder="Nestlé Pakistan"
              placeholderTextColor={colors.placeholder}
              autoFocus
            />

            <Text style={forms.label}>Country:</Text>
            <SearchableSelect
              value={country}
              options={countryOptions}
              onChange={setCountry}
              placeholder="Select country"
              searchPlaceholder="Search by country or code"
            />

            <Text style={forms.label}>Website:</Text>
            <TextInput
              style={controls.input}
              value={website}
              onChangeText={setWebsite}
              placeholder="https://example.com"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

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
              style={[s.button, s.save, (!name.trim() || saving) && s.disabled]}
              onPress={handleSubmit}
              disabled={!name.trim() || saving}
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
