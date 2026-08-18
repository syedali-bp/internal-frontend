import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  CategoryPicker,
  Dropdown,
  SearchableSelect,
  SectionHeader,
  TagInput,
} from '../../components'
import { COUNTRIES } from '../../constants/countries'
import { BRANDS, CURRENCY_OPTIONS, UOM_OPTIONS } from '../../constants/options'
import { formatCategoryPath } from '../../lib/categoryTree'
import { colors } from '../../theme/colors'
import { controls, forms } from '../../theme/styles'
import type { SubmissionPayload } from '../../types/product'
import { AttributesSection } from './components/AttributesSection'
import { ErrorList } from './components/ErrorList'
import { MediaSection } from './components/MediaSection'
import { PackagingForm, createEmptyPackaging } from './components/PackagingForm'
import { PayloadPreview } from './components/PayloadPreview'
import { SavedVariantRow } from './components/SavedVariantRow'
import { ScreenHeader } from './components/ScreenHeader'
import { VariantForm } from './components/VariantForm'
import { verticalUsesModelNumber } from './modelNumber'
import { useCategories } from './useCategories'
import { useProductCapture } from './useProductCapture'
import { useVerticals } from './useVerticals'

type AddProductScreenProps = {
  barcode?: string
  onBack: () => void
  onSubmitted: (payload: SubmissionPayload) => void
}

/**
 * The whole capture on one screen.
 *
 * It used to be two, because saving a draft product was what produced the id
 * that variants needed. Nothing is saved mid-capture any more, so there is
 * nothing to split the form across.
 */
export function AddProductScreen({ barcode, onBack, onSubmitted }: AddProductScreenProps) {
  const {
    details,
    setDetail,
    productLevel,
    variantAxes,
    attributeValues,
    setAttribute,
    mediaList,
    variantList,
    errors,
    payload,
    submit,
  } = useProductCapture(barcode ?? '')

  const { verticals } = useVerticals()
  const { tree: categoryTree } = useCategories(details.verticalId)

  const [packagingOpenFor, setPackagingOpenFor] = useState<string | null>(null)
  const [packagingDraft, setPackagingDraft] = useState(createEmptyPackaging)

  const {
    variants,
    form,
    setFormField,
    isFormComplete,
    editingId,
    saveForm,
    editVariant,
    removeVariant,
    resetForm,
    addPackaging,
  } = variantList

  useEffect(() => {
    if (!details.verticalId && verticals.length) {
      setDetail('verticalId', verticals[0].id)
    }
  }, [details.verticalId, setDetail, verticals])

  // A model number is only meaningful on some verticals, so the field appears
  // for those and stays out of the way everywhere else.
  const selectedVertical = verticals.find((vertical) => vertical.id === details.verticalId)
  const showModelNumber = verticalUsesModelNumber(selectedVertical)

  // Categories belong to a vertical, so switching verticals invalidates the pick.
  const handleVerticalChange = (verticalId: string) => {
    setDetail('verticalId', verticalId)
    setDetail('categoryId', '')

    // Drop anything typed under the previous vertical, so a hidden field can
    // never submit a leftover value.
    const nextVertical = verticals.find((vertical) => vertical.id === verticalId)
    if (!verticalUsesModelNumber(nextVertical)) setDetail('modelNumber', '')
  }

  const openPackaging = (variantId: string) => {
    setPackagingOpenFor(variantId)
    setPackagingDraft(createEmptyPackaging())
  }

  const savePackaging = () => {
    if (!packagingOpenFor || !packagingDraft.level) return

    addPackaging(packagingOpenFor, packagingDraft)
    setPackagingDraft(createEmptyPackaging())
    setPackagingOpenFor(null)
  }

  const handleSubmit = () => {
    // The breadcrumb is resolved here, from the tree the pick came from — the
    // submission carries the path, not the tree.
    const result = submit(formatCategoryPath(categoryTree, details.categoryId))
    // An invalid form keeps the screen up, with the errors above the button.
    if (!result) return

    onSubmitted(result)
  }

  const categoryPlaceholder = details.verticalId ? 'Select category' : 'Select a vertical first'

  const axisSummary = variantAxes.map((axis) => axis.name).join(' × ')

  // The ISO list is 249 fixed rows, so the option shapes are built once.
  const countryOptions = useMemo(
    () =>
      COUNTRIES.map((country) => ({
        label: `${country.name} (${country.code})`,
        value: country.code,
      })),
    [],
  )

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <ScreenHeader title="ADD PRODUCT" />
      <Pressable style={s.back} onPress={onBack}>
        <Text style={s.backText}>‹ Back</Text>
      </Pressable>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.intro}>
          Everything below is captured as one submission and kept on this device, where the
          review screen lists it.
        </Text>

        {!!barcode && (
          <View style={s.barcodeBox}>
            <Text style={s.barcodeLabel}>Barcode</Text>
            <TextInput
              style={s.barcodeInput}
              value={barcode}
              editable={false}
              placeholderTextColor={colors.placeholder}
            />
          </View>
        )}

        {/* ---------------- Where it belongs ---------------- */}
        <Text style={forms.label}>Product Vertical:</Text>
        <Dropdown
          value={details.verticalId}
          options={verticals.map((vertical) => ({ label: vertical.name, value: vertical.id }))}
          onChange={handleVerticalChange}
          placeholder="Select vertical"
        />

        <Text style={forms.label}>Category:</Text>
        <CategoryPicker
          value={details.categoryId}
          nodes={categoryTree}
          onChange={(value) => setDetail('categoryId', value)}
          placeholder={categoryPlaceholder}
          disabled={!details.verticalId}
        />

        {/* ---------------- What it is ---------------- */}
        <Text style={forms.label}>Product Name:</Text>
        <TextInput
          style={controls.input}
          value={details.name}
          onChangeText={(value) => setDetail('name', value)}
          placeholder="Olpers Full Cream Milk"
          placeholderTextColor={colors.placeholder}
        />

        {showModelNumber && (
          <>
            <Text style={forms.label}>Model Number:</Text>
            <TextInput
              style={controls.input}
              value={details.modelNumber}
              onChangeText={(value) => setDetail('modelNumber', value)}
              placeholder="SM-A207F"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </>
        )}

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
          placeholder="1L tetra pack"
          placeholderTextColor={colors.placeholder}
        />

        <Text style={forms.label}>Tags:</Text>
        <TagInput
          tags={details.tags}
          onChange={(tags) => setDetail('tags', tags)}
          placeholder="halal, imported, sugar-free"
        />

        <Text style={forms.label}>Default UOM:</Text>
        <Dropdown
          value={details.defaultUom}
          options={UOM_OPTIONS}
          onChange={(value) => setDetail('defaultUom', value)}
          placeholder="Select unit of measure"
        />

        <Text style={forms.label}>Country of Origin:</Text>
        <SearchableSelect
          value={details.countryOfOrigin}
          options={countryOptions}
          onChange={(value) => setDetail('countryOfOrigin', value)}
          placeholder="Select country"
          searchPlaceholder="Search by country or code"
        />

        {/* ---- Captured on the shelf, not properties of the product ---- */}
        <Text style={forms.label}>Observed Price:</Text>
        <View style={s.priceRow}>
          <TextInput
            style={[controls.input, s.priceInput]}
            value={details.observedPrice}
            onChangeText={(value) => setDetail('observedPrice', value)}
            keyboardType="decimal-pad"
            placeholder="Shelf price, if visible"
            placeholderTextColor={colors.placeholder}
          />
          <View style={s.currencyBox}>
            <Dropdown
              value={details.currency}
              options={CURRENCY_OPTIONS}
              onChange={(value) => setDetail('currency', value)}
              placeholder="Currency"
            />
          </View>
        </View>

        <Text style={forms.label}>Notes:</Text>
        <TextInput
          style={[controls.input, controls.multiline]}
          value={details.notes}
          onChangeText={(value) => setDetail('notes', value)}
          multiline
          placeholder="Anything the reviewer should know"
          placeholderTextColor={colors.placeholder}
        />

        {/* ------- Product-level attributes for this category ------- */}
        <SectionHeader text="ATTRIBUTES" color={colors.attribute} />

        <AttributesSection
          definitions={productLevel}
          values={attributeValues}
          onChange={setAttribute}
          hasCategory={!!details.categoryId}
        />

        {/* ------------- Photos and documents ------------- */}
        <SectionHeader text="MEDIA" color={colors.primary} />

        <MediaSection
          items={mediaList.items}
          kind={mediaList.kind}
          onKindChange={mediaList.setKind}
          onAdd={mediaList.addMedia}
          onRemove={mediaList.removeMedia}
          error={mediaList.error}
        />

        {/* ------------- Variants, built from the axes ------------- */}
        <SectionHeader text="VARIANTS" color={colors.text} />

        {!details.categoryId ? (
          <Text style={s.note}>Select a category to see what its variants are made of.</Text>
        ) : (
          <>
            <Text style={s.note}>
              {variantAxes.length
                ? `This category varies by ${axisSummary}.`
                : 'This category defines no variant axes, so variants differ by SKU only.'}
            </Text>

            {variants.length === 0 ? (
              <Text style={s.empty}>No variants added yet. Fill the form below and press Add.</Text>
            ) : (
              variants.map((variant, index) => (
                <SavedVariantRow
                  key={variant.id}
                  variant={variant}
                  index={index}
                  axes={variantAxes}
                  isEditing={editingId === variant.id}
                  onEdit={() => editVariant(variant.id)}
                  onDelete={() => removeVariant(variant.id)}
                  onAddPackaging={() => openPackaging(variant.id)}
                  packagingLevels={variant.packagingLevels ?? []}
                />
              ))
            )}

            {packagingOpenFor && (
              <PackagingForm
                value={packagingDraft}
                onChange={setPackagingDraft}
                onSubmit={savePackaging}
                onCancel={() => setPackagingOpenFor(null)}
              />
            )}

            <VariantForm
              axes={variantAxes}
              value={form}
              onChange={setFormField}
              onSubmit={saveForm}
              onCancel={resetForm}
              isEditing={editingId !== null}
              canSubmit={isFormComplete}
            />
          </>
        )}

        {/* ---------------- Validation ---------------- */}
        <ErrorList errors={errors} />

        <Pressable style={s.submit} onPress={handleSubmit}>
          <Text style={s.submitText}>ADD PRODUCT</Text>
        </Pressable>

        {payload && <PayloadPreview json={payload} />}
      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screen },
  body: { padding: 16, paddingBottom: 48 },
  back: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backText: { color: colors.primary, fontWeight: '700' },
  intro: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 6 },

  barcodeBox: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.headerBg,
  },
  barcodeLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4 },
  barcodeInput: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    paddingVertical: 0,
  },

  note: { fontSize: 13, color: colors.textMuted, marginBottom: 10, lineHeight: 19 },
  empty: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginBottom: 10 },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceInput: { flex: 1 },
  currencyBox: { width: 116 },

  submit: {
    marginTop: 22,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: { color: colors.onAccent, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
})
