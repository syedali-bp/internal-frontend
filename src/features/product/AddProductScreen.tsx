import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  CategoryPicker,
  Dropdown,
  SearchableSelect,
  SectionHeader,
  TagInput,
} from '../../components'
import { COUNTRIES } from '../../constants/countries'
import { CURRENCY_OPTIONS, PACKAGING_LEVELS, UOM_OPTIONS } from '../../constants/options'
import * as api from '../../api/api'
import { formatCategoryPath } from '../../lib/categoryTree'
import type { Palette } from '../../theme/colors'
import { makeControls, makeForms, useColors, useThemedStyles } from '../../theme/useColors'
import type { SubmissionPayload } from '../../types/product'
import { AddBrandModal, type NewBrand } from './components/AddBrandModal'
import { AddManufacturerModal, type NewManufacturer } from './components/AddManufacturerModal'
import { AttributesSection } from './components/AttributesSection'
import { ErrorList } from './components/ErrorList'
import { MediaSection } from './components/MediaSection'
import { PayloadPreview } from './components/PayloadPreview'
import { SavedVariantRow } from './components/SavedVariantRow'
import { ScreenHeader } from './components/ScreenHeader'
import { SyncStatusBar } from './components/SyncStatusBar'
import { useSyncQueue } from './useSyncQueue'
import { VariantForm } from './components/VariantForm'
import { verticalUsesModelNumber } from './modelNumber'
import { useBarcodeLookup } from './barcodeLookup'
import { useBrands } from './useBrands'
import { useCategories } from './useCategories'
import { useManufacturers } from './useManufacturers'
import { useProductCapture } from './useProductCapture'
import { useVerticals } from './useVerticals'

/**
 * Said once, beside every field a contribution cannot change.
 *
 * Approval fills only empty fields, so a value already on file would be
 * discarded whatever is typed over it. Locking the input is how that becomes
 * visible before the work is done rather than after it is thrown away.
 */
const ON_FILE_HINT = 'Already in the catalog — left as it is.'

type AddProductScreenProps = {
  barcode?: string
  /**
   * True when the scan resolved to a product the catalog already holds and the
   * collector chose to fill its gaps.
   *
   * Changes what the screen says, not what it does: the capture is submitted
   * the same way either way, and the server decides from the barcode that this
   * enriches an existing variant rather than creating a product. Approval fills
   * only empty fields, so nothing typed here can overwrite catalog data.
   */
  contributing?: boolean
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
export function AddProductScreen({ barcode, contributing, onBack, onSubmitted }: AddProductScreenProps) {
  const controls = useThemedStyles(makeControls)
  const forms = useThemedStyles(makeForms)
  const colors = useColors()
  const s = useThemedStyles(makeStyles)
  // The offline queue, for the banner above the form.
  const sync = useSyncQueue()

  // What the catalog already holds for this barcode, when the collector came
  // here from the scan-result card to fill its gaps. Cached by the query from
  // that screen, so this is normally an instant read rather than a second trip.
  const { data: lookup } = useBarcodeLookup(contributing ? barcode : undefined)
  const enriching = Boolean(contributing && lookup?.found)

  /**
   * What the form is seeded with, once the lookup answers.
   *
   * Memoised on the lookup rather than rebuilt inline: the hook applies it from
   * an effect, and a fresh object every render would re-fire that effect for as
   * long as the screen was open.
   */
  const prefill = useMemo(
    () =>
      enriching
        ? {
            name: lookup!.product_name,
            description: lookup!.description,
            defaultUom: '',
            verticalId: lookup!.vertical_id,
            categoryId: lookup!.category_id,
            brandId: lookup!.brand_id,
          }
        : undefined,
    [enriching, lookup],
  )

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
    submitting,
    submit,
    refetchAttributes,
  } = useProductCapture(barcode ?? '', prefill)

  /**
   * The gaps worth naming to the collector.
   *
   * Price is always offered by the server because it is about the shop rather
   * than the product, so listing it as "missing from the catalog" would be
   * misleading — it is never on file for anybody.
   */
  const contributionGaps = useMemo(
    () => (enriching ? lookup!.missing.filter((gap) => gap.field !== 'observed_price') : []),
    [enriching, lookup],
  )

  /**
   * Attachments that describe the product rather than one of its packs.
   *
   * The list is shared so uploading and submitting stay one path; the split is
   * by `variantId`, exactly as the server splits them on arrival.
   */
  const productLevelMedia = useMemo(
    () => mediaList.items.filter((item) => !item.variantId),
    [mediaList.items],
  )

  /**
   * Whether a field is already on file and so must not be edited here.
   *
   * Driven by the server's `missing` list rather than by checking the value:
   * which fields a contribution can fill is a rule about how approval merges a
   * capture, and approval fills only empty fields. A field the server did not
   * call missing would have its value discarded, so offering it as editable
   * would invite work that is silently thrown away.
   *
   * Nothing is locked for an ordinary new-product capture.
   */
  const isLocked = useCallback(
    (field: string) => {
      if (!enriching) return false
      return !lookup!.missing.some((gap) => gap.field === field)
    },
    [enriching, lookup],
  )

  const {
    verticals,
    isLoading: verticalsLoading,
    error: verticalsError,
    refetch: refetchVerticals,
  } = useVerticals()
  const { tree: categoryTree, refetch: refetchCategories } = useCategories(details.verticalId)

  const {
    manufacturers,
    isLoading: manufacturersLoading,
    refetch: refetchManufacturers,
  } = useManufacturers()

  // Keyed on the manufacturer, so picking one narrows the list to its brands and
  // clearing it widens the list back to every brand.
  const {
    brands,
    isLoading: brandsLoading,
    refetch: refetchBrands,
  } = useBrands(details.manufacturerId)

  /**
   * Re-reads the reference data the form is built out of.
   *
   * All five together, because they are one answer to the collector: a form
   * that is missing the brand added on another handset an hour ago is stale in
   * a way the collector cannot tell apart from a category that never had it.
   *
   * `allSettled` rather than `all` — one list failing should not stop the other
   * four from updating, and the screen already shows a per-list error where it
   * matters. Nothing typed is touched: these refill the pickers, and the
   * capture's own state lives elsewhere.
   */
  const [isRefreshing, setIsRefreshing] = useState(false)
  const refreshReferenceData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await Promise.allSettled([
        refetchVerticals(),
        refetchCategories(),
        refetchAttributes(),
        refetchManufacturers(),
        refetchBrands(),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }, [
    refetchVerticals,
    refetchCategories,
    refetchAttributes,
    refetchManufacturers,
    refetchBrands,
  ])

  const createManufacturer = api.useCreateManufacturer()
  const createBrand = api.useCreateBrand()

  const [manufacturerModalOpen, setManufacturerModalOpen] = useState(false)
  const [brandModalOpen, setBrandModalOpen] = useState(false)

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
  } = variantList

  useEffect(() => {
    if (!details.verticalId && verticals.length) {
      setDetail('verticalId', verticals[0].id)
    }
  }, [details.verticalId, setDetail, verticals])

  // A model number is only meaningful on some verticals, so the field appears
  // for those and stays out of the way everywhere else.
  const selectedVertical = verticals.find((vertical: any) => vertical.id === details.verticalId)
  const showModelNumber = verticalUsesModelNumber(selectedVertical)

  // Categories belong to a vertical, so switching verticals invalidates the pick.
  const handleVerticalChange = (verticalId: string) => {
    setDetail('verticalId', verticalId)
    setDetail('categoryId', '')

    // Drop anything typed under the previous vertical, so a hidden field can
    // never submit a leftover value.
    const nextVertical = verticals.find((vertical: any) => vertical.id === verticalId)
    if (!verticalUsesModelNumber(nextVertical)) setDetail('modelNumber', '')
  }

  /**
   * Files a new manufacturer and selects it.
   *
   * Selecting it is the point — the collector opened the popup because the one
   * they need is missing, so leaving them to find it in the list afterwards
   * would be busywork. The brand is cleared for the same reason changing the
   * manufacturer clears it: the brand list is about to be a different list.
   */
  const handleCreateManufacturer = (body: NewManufacturer) => {
    createManufacturer.mutate(body, {
      onSuccess: (created: any) => {
        refetchManufacturers()
        setDetail('manufacturerId', created?.id ?? '')
        setDetail('brandId', '')
        setManufacturerModalOpen(false)
      },
    })
  }

  const handleCreateBrand = (body: NewBrand) => {
    createBrand.mutate(body, {
      onSuccess: (created: any) => {
        refetchBrands()
        setDetail('brandId', created?.id ?? '')
        // A brand created against a maker implies that maker, so the form catches
        // up rather than leaving the two fields disagreeing.
        if (body.manufacturer_id) setDetail('manufacturerId', body.manufacturer_id)
        setBrandModalOpen(false)
      },
    })
  }

  /**
   * A different manufacturer means a different brand list, and the brand already
   * picked is almost certainly not on it. Clearing the manufacturer only widens
   * the list, so the brand survives that direction.
   */
  const handleManufacturerChange = (manufacturerId: string) => {
    setDetail('manufacturerId', manufacturerId)
    if (manufacturerId) setDetail('brandId', '')
  }

  const handleSubmit = async () => {
    // The breadcrumb and the two names are resolved here, from the lists the
    // picks came from — the submission carries the labels, not the lists.
    const result = await submit({
      categoryPath: formatCategoryPath(categoryTree, details.categoryId),
      manufacturerName: selectedManufacturer?.name ?? '',
      brandName: selectedBrand?.name ?? '',
    })
    // An invalid form keeps the screen up, with the errors above the button.
    if (!result) return

    onSubmitted(result)
  }

  const selectedManufacturer = manufacturers.find((row) => row.id === details.manufacturerId)
  const selectedBrand = brands.find((row) => row.id === details.brandId)

  const verticalOptions = verticals.map((row) => ({ label: row.name, value: row.id }))
  const manufacturerOptions = manufacturers.map((row) => ({ label: row.name, value: row.id }))
  const brandOptions = brands.map((row) => ({ label: row.name, value: row.id }))

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
      {/* The count has to be visible while capturing, not only on review: it is
          how a collector working out of signal knows the backlog is growing. */}
      <SyncStatusBar
        queued={sync.counts.queued}
        progress={sync.progress}
        lastError={sync.lastError}
        onSyncNow={sync.syncNow}
      />
      <Pressable style={s.back} onPress={onBack}>
        <Text style={s.backText}>‹ Back</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={s.body}
        keyboardShouldPersistTaps="handled"
        // Pull to refresh, the same gesture Select Store and Review use. The
        // reference data behind this form is fetched once when the screen
        // opens, and a session outlasts that: a brand or category added
        // elsewhere mid-visit is otherwise unreachable without restarting.
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void refreshReferenceData()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <Text style={s.intro}>
          {enriching
            ? 'Adding to a product the catalog already holds. Details on file are shown but locked — only the gaps below can be filled.'
            : 'Everything below is captured as one submission and kept on this device, where the review screen lists it.'}
        </Text>

        {/* Names the product being contributed to, so a collector who scrolled
            past the scan card can still tell what they are adding to. */}
        {enriching ? (
          <View style={s.contributing}>
            <Text style={s.contributingTitle}>{lookup!.product_name}</Text>
            <Text style={s.contributingText}>
              {contributionGaps.length > 0
                ? `You can add: ${contributionGaps.map((gap) => gap.label).join(', ')}.`
                : 'Nothing is missing — you can still record the price at this store.'}
            </Text>
          </View>
        ) : null}

        {!!barcode && (
          <View style={s.barcodeBox}>
            <Text style={s.barcodeLabel}>Barcode</Text>
            <TextInput
              style={s.barcodeInput}
              value={barcode}
              editable={false}
              placeholderTextColor={colors.placeholder}
            />

            {/* A can and its 24-tray carry different codes, and the code cannot
                say which it is. Answered here so the catalog knows what the
                scan buys. */}
            <Text style={s.barcodeLabel}>What did you scan?</Text>
            <View style={s.levelRow}>
              {PACKAGING_LEVELS.map((level) => {
                const chosen = details.scannedPackagingLevel === level.value
                return (
                  <Pressable
                    key={level.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: chosen }}
                    style={[s.levelChip, chosen && s.levelChipOn]}
                    onPress={() => setDetail('scannedPackagingLevel', level.value)}
                  >
                    <Text style={[s.levelChipText, chosen && s.levelChipTextOn]}>{level.label}</Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}

        {/* Reference data is the whole form: with no verticals there is no
            category, so no attributes and no axes. An empty dropdown looks like
            an empty catalog, so a failure to reach the server says so instead. */}
        {!!verticalsError && (
          <View style={s.loadError}>
            <Text style={s.loadErrorTitle}>Could not load the catalog</Text>
            <Text style={s.loadErrorText}>{verticalsError.message}</Text>
          </View>
        )}

        {/* ---------------- Where it belongs ---------------- */}
        <Text style={forms.label}>Product Vertical:</Text>
        <Dropdown
          value={details.verticalId}
          options={verticalOptions}
          onChange={handleVerticalChange}
          // Where the product belongs is settled by the row the barcode
          // resolved to. Letting a contribution move it would re-file somebody
          // else's product from a screen meant for adding a photo.
          disabled={enriching}
          placeholder={
            verticalsLoading
              ? 'Loading verticals...'
              : verticals.length === 0
                ? 'No verticals available'
                : 'Select vertical'
          }
        />

        <Text style={forms.label}>Category:</Text>
        <CategoryPicker
          value={details.categoryId}
          nodes={categoryTree}
          onChange={(value) => setDetail('categoryId', value)}
          placeholder={categoryPlaceholder}
          disabled={!details.verticalId || enriching}
        />
        {enriching && lookup?.category_name ? (
          <Text style={s.lockedHint}>On file: {lookup.category_name}</Text>
        ) : null}

        {/* ---------------- What it is ---------------- */}
        <Text style={forms.label}>Product Name:</Text>
        <TextInput
          style={[controls.input, isLocked('name') && s.lockedInput]}
          value={details.name}
          onChangeText={(value) => setDetail('name', value)}
          placeholder="Olpers Full Cream Milk"
          placeholderTextColor={colors.placeholder}
          editable={!isLocked('name')}
        />
        {isLocked('name') ? <Text style={s.lockedHint}>{ON_FILE_HINT}</Text> : null}

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

        {/* Pick one, or add it on the spot when the catalog has never heard of
            it — a collector at the shelf is usually the first to see it. */}
        <Text style={forms.label}>Manufacturer:</Text>
        <View style={s.selectRow}>
          <View style={s.selectGrow}>
            <Dropdown
              value={details.manufacturerId}
              options={manufacturerOptions}
              onChange={handleManufacturerChange}
              placeholder={
                manufacturersLoading ? 'Loading...' : 'Select manufacturer (optional)'
              }
            />
          </View>
          <Pressable style={s.addSmall} onPress={() => setManufacturerModalOpen(true)}>
            <Text style={s.addSmallText}>+ Add</Text>
          </Pressable>
        </View>
        {!!details.manufacturerId && (
          <Pressable onPress={() => handleManufacturerChange('')} hitSlop={8}>
            <Text style={s.clearLink}>Clear manufacturer — show every brand</Text>
          </Pressable>
        )}

        <Text style={forms.label}>Brand:</Text>
        <View style={s.selectRow}>
          <View style={s.selectGrow}>
            <Dropdown
              value={details.brandId}
              options={brandOptions}
              onChange={(value) => setDetail('brandId', value)}
              disabled={isLocked('brand')}
              placeholder={
                brandsLoading
                  ? 'Loading...'
                  : brands.length === 0
                    ? details.manufacturerId
                      ? 'No brands for this manufacturer yet'
                      : 'No brands yet — press Add'
                    : 'Select brand (optional)'
              }
            />
          </View>
          {!isLocked('brand') ? (
            <Pressable style={s.addSmall} onPress={() => setBrandModalOpen(true)}>
              <Text style={s.addSmallText}>+ Add</Text>
            </Pressable>
          ) : null}
        </View>
        {isLocked('brand') ? (
          <Text style={s.lockedHint}>
            On file: {lookup?.brand_name || 'already recorded'}. Left as it is.
          </Text>
        ) : null}
        <Text style={s.fieldHint}>
          {details.manufacturerId
            ? `Showing ${selectedManufacturer?.name ?? 'this manufacturer'}'s brands only.`
            : 'A brand does not need a manufacturer — either can be left blank.'}
        </Text>

        <Text style={forms.label}>Description:</Text>
        <TextInput
          style={[controls.input, controls.multiline, isLocked('description') && s.lockedInput]}
          value={details.description}
          onChangeText={(value) => setDetail('description', value)}
          multiline
          placeholder="1L tetra pack"
          placeholderTextColor={colors.placeholder}
          editable={!isLocked('description')}
        />
        {isLocked('description') ? <Text style={s.lockedHint}>{ON_FILE_HINT}</Text> : null}

        {/* Tags are the catalog's own taxonomy, and a collector cannot see
            which ones the product already carries. Offering the field on a
            contribution invited edits the merge then discarded. */}
        {!enriching ? (
          <>
            <Text style={forms.label}>Tags:</Text>
            <TagInput
              tags={details.tags}
              onChange={(tags) => setDetail('tags', tags)}
              placeholder="halal, imported, sugar-free"
            />
          </>
        ) : null}

        <Text style={forms.label}>Default UOM:</Text>
        <Dropdown
          value={details.defaultUom}
          options={UOM_OPTIONS}
          onChange={(value) => setDetail('defaultUom', value)}
          placeholder="Select unit of measure"
          disabled={isLocked('uom')}
        />
        {isLocked('uom') ? <Text style={s.lockedHint}>{ON_FILE_HINT}</Text> : null}

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

        {enriching ? (
          // Attributes reach the product through mergeSpecs, which fills only
          // keys the product has no answer for and silently drops the rest. The
          // lookup does not say which those are, so the screen cannot tell a
          // collector which answers would survive — and offering all of them
          // meant editing "Biscuit Type" and watching nothing change.
          <Text style={s.note}>
            This product's attributes are already recorded. Ask a reviewer if any of them need
            correcting.
          </Text>
        ) : (
          <AttributesSection
            definitions={productLevel}
            values={attributeValues}
            onChange={setAttribute}
            hasCategory={!!details.categoryId}
          />
        )}

        {/* ------------- Variants, built from the axes ------------- */}
        <SectionHeader text="VARIANTS" color={colors.text} />

        {enriching ? (
          // A contribution adds to a pack the catalog already sells, so its
          // variants, SKUs and pack sizes are already on file. The merge writes
          // none of them, and a SKU typed here would collide with the unique
          // index rather than update anything.
          <Text style={s.note}>
            This product's variants, SKUs and pack sizes are already in the catalog. Ask a
            reviewer if any of them need correcting.
          </Text>
        ) : !details.categoryId ? (
          <Text style={s.note}>Select a category to see what its variants are made of.</Text>
        ) : (
          <>
            <Text style={s.note}>
              {variantAxes.length
                ? `This category varies by ${axisSummary}.`
                : 'This category defines no variant axes, so variants differ by SKU only.'}
            </Text>

            {variants.length === 0 ? (
              // Says where photos live, because this is the state a collector
              // meets first and the per-variant Add media only appears once a
              // variant exists — which read as "media is still outside".
              <Text style={s.empty}>
                No variants added yet. Fill the form below and press Add — each variant gets its
                own Add media once saved.
              </Text>
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
                  packagingLevels={variant.packagingLevels ?? []}
                  // This variant's own photos, and an Add that tags what it
                  // captures with the variant's id — which is what actually
                  // reaches the server, not just a visual grouping.
                  media={mediaList.items.filter((item) => item.variantId === variant.id)}
                  onAddMedia={() => mediaList.addMedia(variant.id)}
                  onRemoveMedia={mediaList.removeMedia}
                />
              ))
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

        {/* ------------- Product-level media -------------
            Deliberately after the variants, and deliberately still here.

            Photos of a pack belong to the pack, and each variant carries its own
            Add media for them — so this section is no longer where a collector
            adds a product photo by default. It comes last because it is the
            rarer case: a shelf shot or a manual, which describe the product
            rather than any one version of it.

            Not removed, because a product thumbnail can only come from a
            product-level asset. Take this away and every product in every
            listing falls back to showing one of its packs. */}
        <SectionHeader text="PRODUCT MEDIA" color={colors.primary} />

        <Text style={s.note}>
          Optional, and only for the product as a whole — a shelf photo or a
          manual. Photos of a particular pack go on that variant above.
        </Text>

        <MediaSection
          items={productLevelMedia}
          kind={mediaList.kind}
          onKindChange={mediaList.setKind}
          onAdd={() => mediaList.addMedia()}
          onRemove={mediaList.removeMedia}
          error={mediaList.error}
        />

        {/* ---------------- Validation ---------------- */}
        <ErrorList errors={errors} />

        <Pressable
          style={[s.submit, submitting && s.submitBusy]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={s.submitText}>
            {submitting ? 'UPLOADING & FILING...' : 'ADD PRODUCT'}
          </Text>
        </Pressable>

        {payload && <PayloadPreview json={payload} />}
      </ScrollView>

      <AddManufacturerModal
        visible={manufacturerModalOpen}
        onCancel={() => setManufacturerModalOpen(false)}
        onSubmit={handleCreateManufacturer}
        saving={createManufacturer.isPending}
        error={createManufacturer.error?.message ?? null}
      />

      <AddBrandModal
        visible={brandModalOpen}
        onCancel={() => setBrandModalOpen(false)}
        onSubmit={handleCreateBrand}
        saving={createBrand.isPending}
        error={createBrand.error?.message ?? null}
        verticals={verticals}
        currentVerticalCode={selectedVertical?.code ?? ''}
        manufacturerOptions={manufacturerOptions}
        currentManufacturerId={details.manufacturerId}
      />
    </SafeAreaView>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screen },
  body: { padding: 16, paddingBottom: 48 },
  back: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backText: { color: colors.primary, fontWeight: '700' },
  intro: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 6 },

  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  levelChip: {
    borderColor: colors.inputBorder,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  levelChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  levelChipText: { color: colors.textSubtle, fontSize: 13, fontWeight: '700' },
  levelChipTextOn: { color: colors.onAccent },
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

  loadError: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    padding: 12,
  },
  loadErrorTitle: { fontSize: 13, fontWeight: '800', color: colors.dangerText },
  loadErrorText: { fontSize: 12, color: colors.dangerText, marginTop: 4, lineHeight: 17 },

  selectRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectGrow: { flex: 1 },
  addSmall: {
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryBg,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addSmallText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  clearLink: { fontSize: 12, fontWeight: '700', color: colors.primary, marginTop: 7 },
  fieldHint: { fontSize: 11, color: colors.textMuted, marginTop: 6 },
  // A locked field still shows its value — the collector needs to read it to
  // know they are working on the right pack — so it is dimmed rather than
  // hidden, and the screen background marks it as not an input.
  lockedInput: { backgroundColor: colors.screen, color: colors.textMuted },
  lockedHint: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic', marginTop: 6 },
  contributing: {
    backgroundColor: colors.primaryHighlight,
    borderColor: colors.primaryBorder,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  contributingTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  contributingText: { color: colors.textSubtle, fontSize: 12, lineHeight: 17, marginTop: 4 },

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
  submitBusy: { opacity: 0.6 },
  submitText: { color: colors.onAccent, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
})

