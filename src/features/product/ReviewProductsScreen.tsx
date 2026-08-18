import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { colors } from '../../theme/colors'
import type { SubmissionPayload } from '../../types/product'
import { ScreenHeader } from './components/ScreenHeader'
import { removeSubmission } from './submissionStore'
import { useProductSubmissions } from './useProductSubmissions'

type ReviewProductsScreenProps = {
  /** The capture just filed, used only to point it out in the list. */
  item?: SubmissionPayload
  onBack: () => void
  onDone: () => void
}

/** Prices are held as a number; a missing one means none was visible. */
function formatPrice(payload: SubmissionPayload) {
  if (payload.observed_price === null) return 'No price seen'
  return `${payload.currency || ''} ${payload.observed_price}`.trim()
}

function formatCapturedAt(value: string) {
  const captured = new Date(value)
  if (Number.isNaN(captured.getTime())) return value
  return captured.toLocaleString()
}

export function ReviewProductsScreen({ item, onBack, onDone }: ReviewProductsScreenProps) {
  // Everything captured in this session, newest first — the one just filed included.
  const { submissions } = useProductSubmissions()

  const justCapturedId = item?.client_id

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <ScreenHeader title="REVIEW PRODUCTS" />
      <View style={s.actions}>
        <Pressable style={s.back} onPress={onBack}>
          <Text style={s.backText}>‹ Back</Text>
        </Pressable>
        <Pressable style={s.done} onPress={onDone}>
          <Text style={s.doneText}>Finish</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <View style={s.queueHeader}>
          <Text style={s.queueTitle}>
            Captured{submissions.length ? ` (${submissions.length})` : ''}
          </Text>
        </View>

        {submissions.length === 0 && (
          <Text style={s.empty}>Nothing captured yet.</Text>
        )}

        {submissions.map(({ id, payload }) => (
          <View key={id} style={[s.card, id === justCapturedId && s.cardJustSent]}>
            <View style={s.cardTop}>
              <Text style={s.status}>CAPTURED</Text>
              {id === justCapturedId ? (
                <Text style={s.statusPill}>Just submitted</Text>
              ) : (
                <Pressable onPress={() => removeSubmission(id)}>
                  <Text style={s.removePill}>Remove</Text>
                </Pressable>
              )}
            </View>

            <Text style={s.title}>{payload.product.name}</Text>
            <Text style={s.meta}>
              {payload.product.brand || 'No brand'} · {payload.category_path || 'Uncategorised'}
            </Text>
            <Text style={s.desc}>{payload.product.description || 'No description added.'}</Text>

            <View style={s.factRow}>
              <Text style={s.fact}>{payload.scanned_barcode || 'No barcode'}</Text>
              <Text style={s.fact}>{payload.product.default_uom || 'No UOM'}</Text>
              <Text style={s.fact}>{formatPrice(payload)}</Text>
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>Captured</Text>
              <Text style={s.countLine}>
                {Object.keys(payload.product.attributes).length} attributes ·{' '}
                {payload.variants.length} variants · {payload.media.length} media
              </Text>
              <Text style={s.timestamp}>{formatCapturedAt(payload.captured_at)}</Text>
            </View>

            {!!payload.media.length && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Media</Text>
                {payload.media.map((media) => (
                  <View key={media.local_uri} style={s.mediaRow}>
                    <Text style={s.mediaKind}>{media.kind}</Text>
                    <Text style={s.mediaName}>{media.file_name || 'Unnamed file'}</Text>
                    <Text style={s.mediaStatus}>{media.mime_type}</Text>
                  </View>
                ))}
              </View>
            )}

            {!!payload.notes && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Notes</Text>
                <Text style={s.desc}>{payload.notes}</Text>
              </View>
            )}
          </View>
        ))}

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screen },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  back: { paddingVertical: 8, paddingHorizontal: 4 },
  backText: { color: colors.primary, fontWeight: '700' },
  done: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  doneText: { color: colors.onAccent, fontWeight: '800' },
  body: { padding: 16, paddingBottom: 40 },

  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  queueTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  empty: { color: colors.textMuted, fontStyle: 'italic', paddingVertical: 8 },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardJustSent: { borderColor: colors.primaryBorder, backgroundColor: colors.primaryBg },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  status: { color: colors.primary, fontWeight: '800', letterSpacing: 0.5 },
  statusPill: {
    color: colors.onAccent,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '800',
  },
  removePill: {
    color: colors.textSubtle,
    backgroundColor: colors.headerBg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '700',
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  meta: { color: colors.textMuted, marginTop: 6, fontSize: 13 },
  desc: { color: colors.textSubtle, marginTop: 10, fontSize: 14, lineHeight: 20 },

  factRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  fact: {
    color: colors.textSubtle,
    backgroundColor: colors.headerBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
  },

  section: { marginTop: 16 },
  sectionTitle: { color: colors.text, fontSize: 14, fontWeight: '800', marginBottom: 8 },
  countLine: { color: colors.textSubtle, fontSize: 13 },
  timestamp: { color: colors.textMuted, fontSize: 12, marginTop: 4 },

  mediaRow: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.headerBg,
    marginBottom: 8,
  },
  mediaKind: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  mediaName: { color: colors.text, marginTop: 3, fontSize: 13 },
  mediaStatus: { color: colors.textMuted, marginTop: 3, fontSize: 11 },

})
