import { useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

// ---------------------------------------------------------------------------
// Options. Hardcoded for now — these will come from the catalog backend later.
// ---------------------------------------------------------------------------
const BRANDS = ['Samsung', 'Apple', 'Xiaomi', 'Google', 'OnePlus']
const COLORS = ['Black', 'Blue', 'Titanium Gray', 'Violet']
const STORAGES = ['128GB', '256GB', '512GB', '1TB']

type Variant = {
  id: string
  color: string
  storage: string
  sku: string
  isDefault: boolean
}

let nextId = 3
const newVariant = (): Variant => ({
  id: String(nextId++),
  color: '',
  storage: '',
  sku: '',
  isDefault: false,
})

// ---------------------------------------------------------------------------
// Small modal dropdown. RN has no built-in picker, and a modal list avoids
// pulling in another native dependency.
// ---------------------------------------------------------------------------
function Dropdown({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string
  options: string[]
  onChange: (v: string) => void
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Pressable style={s.input} onPress={() => setOpen(true)}>
        <Text style={value ? s.inputText : s.placeholder}>{value || placeholder}</Text>
        <Text style={s.caret}>⌄</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <View style={s.sheet}>
            {options.map((o) => (
              <Pressable
                key={o}
                style={[s.option, o === value && s.optionActive]}
                onPress={() => {
                  onChange(o)
                  setOpen(false)
                }}
              >
                <Text style={s.optionText}>{o}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

export default function App() {
  const [name, setName] = useState('Samsung Galaxy S24 Ultra')
  const [brand, setBrand] = useState('Samsung')
  const [description, setDescription] = useState('')

  const [variants, setVariants] = useState<Variant[]>([
    { id: '1', color: 'Black', storage: '256GB', sku: 'SAM-S24-BLK-256', isDefault: true },
    { id: '2', color: 'Blue', storage: '512GB', sku: 'SAM-S24-BLU-512', isDefault: false },
  ])

  const [battery, setBattery] = useState('5000')
  const [display, setDisplay] = useState('6.8')
  const [ram, setRam] = useState('12')

  const [errors, setErrors] = useState<string[]>([])
  const [payload, setPayload] = useState<string | null>(null)

  const update = (id: string, patch: Partial<Variant>) =>
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))

  // Only one variant may be the default, so checking one clears the rest.
  const toggleDefault = (id: string) =>
    setVariants((prev) =>
      prev.map((v) => ({ ...v, isDefault: v.id === id ? !v.isDefault : false })),
    )

  function validate(): string[] {
    const errs: string[] = []
    if (!name.trim()) errs.push('Product name is required.')
    if (variants.length === 0) errs.push('At least one variant is required.')

    variants.forEach((v, i) => {
      if (!v.color) errs.push(`Variant ${i + 1}: Color is required.`)
      if (!v.storage) errs.push(`Variant ${i + 1}: Storage is required.`)
      if (!v.sku.trim()) errs.push(`Variant ${i + 1}: SKU is required.`)
    })

    const defaults = variants.filter((v) => v.isDefault).length
    if (defaults === 0) errs.push('One variant must be marked as Default.')
    if (defaults > 1) errs.push('Only one variant can be marked as Default.')

    return errs
  }

  function submit() {
    const errs = validate()
    setErrors(errs)
    setPayload(null)
    if (errs.length) return

    const body = {
      product: {
        name: name.trim(),
        brand,
        description: description.trim(),
        attributes: {
          battery: Number(battery),
          display: Number(display),
          ram: Number(ram),
        },
      },
      variants: variants.map((v) => ({
        axes: { Color: v.color, Storage: v.storage },
        sku: v.sku.trim(),
        isDefault: v.isDefault,
      })),
    }

    const json = JSON.stringify(body, null, 2)
    console.log('SUBMIT PRODUCT payload:\n' + json)
    setPayload(json)
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />

        <View style={s.header}>
          <Text style={s.headerIcon}>⊠</Text>
          <Text style={s.headerText}>ADD PRODUCT — Smartphones</Text>
        </View>

        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {/* ---------------- Basic info ---------------- */}
          <Text style={s.label}>Product Name:</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Samsung Galaxy S24 Ultra"
            placeholderTextColor="#9aa0aa"
          />

          <Text style={s.label}>Brand:</Text>
          <Dropdown value={brand} options={BRANDS} onChange={setBrand} placeholder="Select brand" />

          <Text style={s.label}>Description:</Text>
          <TextInput
            style={[s.input, s.multiline]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="..............................."
            placeholderTextColor="#9aa0aa"
          />

          {/* ---------------- Variants ---------------- */}
          <SectionHeader text="VARIANTS" color="#1f2430" />

          {variants.map((v, i) => (
            <View key={v.id} style={s.variantCard}>
              <View style={s.variantHead}>
                <Text style={s.variantTitle}>Variant {i + 1}</Text>
                {variants.length > 1 && (
                  <Pressable onPress={() => setVariants(variants.filter((x) => x.id !== v.id))}>
                    <Text style={s.remove}>Remove</Text>
                  </Pressable>
                )}
              </View>

              <Field label="Color:">
                <Dropdown
                  value={v.color}
                  options={COLORS}
                  onChange={(val) => update(v.id, { color: val })}
                  placeholder="Select color"
                />
              </Field>

              <Field label="Storage:">
                <Dropdown
                  value={v.storage}
                  options={STORAGES}
                  onChange={(val) => update(v.id, { storage: val })}
                  placeholder="Select storage"
                />
              </Field>

              <Field label="SKU:">
                <TextInput
                  style={s.input}
                  value={v.sku}
                  onChangeText={(val) => update(v.id, { sku: val })}
                  placeholder="SAM-S24-BLK-256"
                  placeholderTextColor="#9aa0aa"
                  autoCapitalize="characters"
                />
              </Field>

              <Field label="Default:">
                <Pressable
                  onPress={() => toggleDefault(v.id)}
                  style={[s.checkbox, v.isDefault && s.checkboxOn]}
                  hitSlop={8}
                >
                  {v.isDefault && <Text style={s.tick}>✓</Text>}
                </Pressable>
              </Field>
            </View>
          ))}

          <Pressable style={s.addVariant} onPress={() => setVariants([...variants, newVariant()])}>
            <Text style={s.addVariantText}>+ Add Another Variant</Text>
          </Pressable>

          {/* ---------------- Product-level attributes ---------------- */}
          <SectionHeader text="ATTRIBUTES (Product-Level)" color="#2e7d4f" />

          <View style={s.attrCard}>
            <AttrRow label="Battery:" value={battery} onChange={setBattery} unit="mAh" />
            <AttrRow label="Display:" value={display} onChange={setDisplay} unit="inch" />
            <AttrRow label="RAM:" value={ram} onChange={setRam} unit="GB" />
          </View>

          {/* ---------------- Validation ---------------- */}
          {errors.length > 0 && (
            <View style={s.errorBox}>
              {errors.map((e) => (
                <Text key={e} style={s.errorText}>
                  • {e}
                </Text>
              ))}
            </View>
          )}

          <Pressable style={s.submit} onPress={submit}>
            <Text style={s.submitText}>➤  SUBMIT PRODUCT</Text>
          </Pressable>

          {payload && (
            <View style={s.jsonBox}>
              <Text style={s.jsonTitle}>Payload that would be sent</Text>
              <Text style={s.json} selectable>
                {payload}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

function SectionHeader({ text, color }: { text: string; color: string }) {
  return (
    <View style={s.section}>
      <View style={[s.rule, { backgroundColor: color }]} />
      <Text style={[s.sectionText, { color }]}>{text}</Text>
      <View style={[s.rule, { backgroundColor: color }]} />
    </View>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  )
}

function AttrRow({
  label,
  value,
  onChange,
  unit,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  unit: string
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, { flex: 1 }]}
        value={value}
        onChangeText={onChange}
        keyboardType="numeric"
      />
      <Text style={s.unit}>{unit}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f7f8fa',
    borderBottomWidth: 1,
    borderBottomColor: '#dfe3e8',
  },
  headerIcon: { fontSize: 18, color: '#1f2430' },
  headerText: { fontSize: 17, fontWeight: '700', color: '#1f2430' },

  body: { padding: 16, paddingBottom: 48 },

  label: { fontSize: 13, fontWeight: '600', color: '#1f2430', marginBottom: 6, marginTop: 12 },

  input: {
    borderWidth: 1,
    borderColor: '#c9ced6',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1f2430',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  inputText: { fontSize: 14, color: '#1f2430', flex: 1 },
  placeholder: { fontSize: 14, color: '#9aa0aa', flex: 1 },
  caret: { fontSize: 16, color: '#5b6472', marginTop: -6 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 32 },
  sheet: { backgroundColor: '#fff', borderRadius: 10, paddingVertical: 6 },
  option: { paddingVertical: 14, paddingHorizontal: 18 },
  optionActive: { backgroundColor: '#f0ecfe' },
  optionText: { fontSize: 15, color: '#1f2430' },

  section: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26, marginBottom: 14 },
  rule: { flex: 1, height: 1.5, opacity: 0.5 },
  sectionText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },

  variantCard: {
    borderWidth: 1,
    borderColor: '#d9cffa',
    backgroundColor: '#faf8ff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  variantHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  variantTitle: { fontSize: 14, fontWeight: '700', color: '#6b4ef0' },
  remove: { fontSize: 12, color: '#d14343' },

  field: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  fieldLabel: { width: 78, fontSize: 13, fontWeight: '600', color: '#3a4250' },

  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#b3a4e8',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#6b4ef0', borderColor: '#6b4ef0' },
  tick: { color: '#fff', fontSize: 15, fontWeight: '800' },

  addVariant: {
    borderWidth: 1.5,
    borderColor: '#b3a4e8',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#faf8ff',
  },
  addVariantText: { color: '#6b4ef0', fontWeight: '700', fontSize: 14 },

  attrCard: {
    borderWidth: 1,
    borderColor: '#cfe9d5',
    backgroundColor: '#f5fbf6',
    borderRadius: 8,
    padding: 14,
  },
  unit: { width: 40, fontSize: 13, color: '#5b6472', textAlign: 'right' },

  errorBox: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#f3c2c2',
    backgroundColor: '#fdf3f3',
    borderRadius: 8,
    padding: 12,
  },
  errorText: { color: '#c0392b', fontSize: 13, lineHeight: 20 },

  submit: {
    marginTop: 22,
    backgroundColor: '#f26522',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },

  jsonBox: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#dfe3e8',
    backgroundColor: '#1f2430',
    borderRadius: 8,
    padding: 12,
  },
  jsonTitle: { color: '#9aa0aa', fontSize: 11, marginBottom: 8, textTransform: 'uppercase' },
  json: { color: '#d7e3ff', fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
})
