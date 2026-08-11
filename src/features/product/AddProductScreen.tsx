import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AttrRow, Dropdown, SectionHeader } from '../../components'
import { BRANDS } from '../../constants/options'
import { colors } from '../../theme/colors'
import { controls, forms } from '../../theme/styles'
import { ErrorList } from './components/ErrorList'
import { PayloadPreview } from './components/PayloadPreview'
import { ScreenHeader } from './components/ScreenHeader'
import { VariantCard } from './components/VariantCard'
import { useProductForm } from './useProductForm'

export function AddProductScreen() {
  const {
    details,
    setDetail,
    attributes,
    setAttribute,
    variants,
    addVariant,
    removeVariant,
    updateVariant,
    toggleDefault,
    errors,
    payload,
    submit,
  } = useProductForm()

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <ScreenHeader title="ADD PRODUCT — Smartphones" />

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {/* ---------------- Basic info ---------------- */}
        <Text style={forms.label}>Product Name:</Text>
        <TextInput
          style={controls.input}
          value={details.name}
          onChangeText={(value) => setDetail('name', value)}
          placeholder="Samsung Galaxy S24 Ultra"
          placeholderTextColor={colors.placeholder}
        />

        <Text style={forms.label}>Brand:</Text>
        <Dropdown
          value={details.brand}
          options={BRANDS}
          onChange={(value) => setDetail('brand', value)}
          placeholder="Select brand"
        />

        <Text style={forms.label}>Description:</Text>
        <TextInput
          style={[controls.input, controls.multiline]}
          value={details.description}
          onChangeText={(value) => setDetail('description', value)}
          multiline
          placeholder="..............................."
          placeholderTextColor={colors.placeholder}
        />

        {/* ---------------- Variants ---------------- */}
        <SectionHeader text="VARIANTS" color={colors.text} />

        {variants.map((variant, index) => (
          <VariantCard
            key={variant.id}
            variant={variant}
            index={index}
            canRemove={variants.length > 1}
            onChange={(patch) => updateVariant(variant.id, patch)}
            onRemove={() => removeVariant(variant.id)}
            onToggleDefault={() => toggleDefault(variant.id)}
          />
        ))}

        <Pressable style={s.addVariant} onPress={addVariant}>
          <Text style={s.addVariantText}>+ Add Another Variant</Text>
        </Pressable>

        {/* ---------------- Product-level attributes ---------------- */}
        <SectionHeader text="ATTRIBUTES (Product-Level)" color={colors.attribute} />

        <View style={s.attrCard}>
          <AttrRow
            label="Battery:"
            value={attributes.battery}
            onChange={(value) => setAttribute('battery', value)}
            unit="mAh"
          />
          <AttrRow
            label="Display:"
            value={attributes.display}
            onChange={(value) => setAttribute('display', value)}
            unit="inch"
          />
          <AttrRow
            label="RAM:"
            value={attributes.ram}
            onChange={(value) => setAttribute('ram', value)}
            unit="GB"
          />
        </View>

        {/* ---------------- Validation ---------------- */}
        <ErrorList errors={errors} />

        <Pressable style={s.submit} onPress={submit}>
          <Text style={s.submitText}>➤  SUBMIT PRODUCT</Text>
        </Pressable>

        {payload && <PayloadPreview json={payload} />}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screen },
  body: { padding: 16, paddingBottom: 48 },

  addVariant: {
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
  },
  addVariantText: { color: colors.primary, fontWeight: '700', fontSize: 14 },

  attrCard: {
    borderWidth: 1,
    borderColor: colors.attributeBorder,
    backgroundColor: colors.attributeBg,
    borderRadius: 8,
    padding: 14,
  },

  submit: {
    marginTop: 22,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: { color: colors.onAccent, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
})
