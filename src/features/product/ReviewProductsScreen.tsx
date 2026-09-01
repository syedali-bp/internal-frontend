import { useCallback, useState } from 'react'
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import type { Palette } from '../../theme/colors'
import { useColors, useThemedStyles } from '../../theme/useColors'
import type { SubmissionPayload } from '../../types/product'
import { ScreenHeader } from './components/ScreenHeader'
import { SyncStatusBar } from './components/SyncStatusBar'
import { removeSubmission } from './submissionStore'
import { useSyncQueue } from './useSyncQueue'

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
  const s = useThemedStyles(makeStyles)
  // Everything captured in this session, newest first — the one just filed
  // included — plus what the queue still owes the server.
  const { submissions, counts, progress, lastError, syncNow, refresh } = useSyncQueue()
  const colors = useColors()

  // Separate from the queue's own `progress` so the pull spinner tracks the
  // gesture rather than an automatic sync the collector did not ask for.
  const [isRefreshing, setIsRefreshing] = useState(false)
  const onRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refresh()
    } finally {
      setIsRefreshing(false)
    }
  }, [refresh])

  /**
   * Discards one capture, after asking.
   *
   * Confirmed rather than immediate because this is the one irreversible action
   * on the screen: a capture that has not reached the server exists nowhere
   * else, and the collector would have to walk back to the shelf to make it
   * again. The wording says which case they are in, since discarding a capture
   * the server already holds costs nothing but the row.
   */
  const confirmRemove = useCallback((id: string, name: string, synced: boolean) => {
    Alert.alert(
      'Discard this capture?',
      synced
        ? `"${name}" has already reached the server. Removing it here only clears it from this list.`
        : `"${name}" has not been sent yet. Discarding it here loses it for good.`,
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => removeSubmission(id) },
      ],
    )
  }, [])

  const justCapturedId = item?.client_id

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <ScreenHeader title="REVIEW PRODUCTS" />
      <SyncStatusBar
        queued={counts.queued}
        progress={progress}
        lastError={lastError}
        onSyncNow={syncNow}
      />
      <View style={s.actions}>
        <Pressable style={s.back} onPress={onBack}>
          <Text style={s.backText}>‹ Back</Text>
        </Pressable>
        <Pressable style={s.done} onPress={onDone}>
          <Text style={s.doneText}>Finish</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.body}
        // Pull to refresh: re-reads the stored queue and retries whatever it
        // still owes the server.
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        <View style={s.queueHeader}>
          <Text style={s.queueTitle}>
            Captured{submissions.length ? ` (${submissions.length})` : ''}
          </Text>
        </View>

        {submissions.length === 0 && (
          <Text style={s.empty}>Nothing captured yet.</Text>
        )}

        {submissions.map(({ id, payload, status, submissionId, error, matchType }) => {
          // `loadQueue` already rebuilds every stored entry, so these hold in
          // the ordinary case. Repeated here because this screen is the one
          // holding a collector's unsynced work: a capture that cannot be
          // redone is worth two guards, and a payload can also reach this list
          // straight from `addSubmission` without passing through storage.
          const product = payload.product ?? ({} as SubmissionPayload['product'])
          const attributes = product.attributes ?? {}
          const variants = payload.variants ?? []
          const media = payload.media ?? []

          return (
          <Pressable
            key={id}
            style={[s.card, id === justCapturedId && s.cardJustSent]}
            onPress={() => console.log('open submission', id)}
          >
            <View style={s.cardTop}>
              {/* Draft is what an accepted capture is to a collector: filed with
                  the server, not yet judged by a moderator. */}
              <Text style={status === 'failed' ? s.statusFailed : s.status}>
                {status === 'failed'
                  ? 'NOT SENT'
                  : status === 'queued'
                    ? 'QUEUED'
                    : status === 'syncing'
                      ? 'SENDING…'
                      : 'DRAFT'}
              </Text>
              {/* The just-captured badge gives way once the capture has failed:
                  a row saying NOT SENT with no way to clear it is the dead end
                  this screen exists to avoid. */}
              {id === justCapturedId && status !== 'failed' ? (
                <Text style={s.statusPill}>Just submitted</Text>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    confirmRemove(id, product.name || 'this capture', status === 'draft')
                  }
                >
                  <Text style={s.removePill}>
                    {status === 'failed' ? 'Discard' : 'Remove'}
                  </Text>
                </Pressable>
              )}
            </View>

            {status !== 'draft' && !!error && <Text style={s.errorLine}>{error}</Text>}
            {status === 'draft' && !!error && <Text style={s.noteLine}>{error}</Text>}

            {/* Says so for as long as the capture is listed. The alert at submit
                time is gone once dismissed, and a capture that synced in the
                background never raised one — this is what stops the same
                product being walked back to and captured a second time. */}
            {(matchType === 'possible_duplicate' || matchType === 'existing_variant') && (
              <Text style={s.duplicateLine}>
                {matchType === 'existing_variant'
                  ? 'Already in the catalog — your scan confirms the existing entry.'
                  : 'Looks like a product already in the catalog. A reviewer will decide.'}
              </Text>
            )}

            <Text style={s.title}>{product.name || 'Untitled capture'}</Text>
            <Text style={s.meta}>
              {/* The name, not the id — the id used to be what showed here. */}
              {product.brand_name || 'No brand'} ·{' '}
              {payload.category_path || 'Uncategorised'}
            </Text>
            <Text style={s.desc} numberOfLines={2}>{product.description || 'No description added.'}</Text>

            <View style={s.factRow}>
              <Text style={s.fact}>{payload.scanned_barcode || 'No barcode'}</Text>
              <Text style={s.fact}>{product.default_uom || 'No UOM'}</Text>
              <Text style={s.fact}>{formatPrice(payload)}</Text>
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>Captured</Text>
              <Text style={s.countLine}>
                {Object.keys(attributes).length} attributes ·{' '}
                {variants.length} variants · {media.length} media
              </Text>
              <Text style={s.timestamp}>{formatCapturedAt(payload.captured_at)}</Text>
              {/* Do not display raw ids in the UI */}
            </View>

            {!!media.length && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Media</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mediaScroll}>
                  {media.map((item, idx) => (
                    <View key={item.local_uri || idx} style={s.thumbWrap}>
                      <Image
                        source={{ uri: item.public_url || item.local_uri }}
                        style={s.thumb}
                        resizeMode="cover"
                      />
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {!!variants.length && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Variants</Text>
                <View style={s.variantsRow}>
                  {variants.map((v, idx) => {
                    const axes = v.axes ?? {}
                    return (
                    <View key={idx} style={s.variantChip}>
                      <Text style={s.variantText} numberOfLines={1}>
                        {v.sku || Object.keys(axes).map(k => `${k}:${axes[k]}`).join(', ')}
                      </Text>
                    </View>
                    )
                  })}
                </View>
              </View>
            )}

            {!!payload.notes && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Notes</Text>
                <Text style={s.desc} numberOfLines={3}>{payload.notes}</Text>
              </View>
            )}
          </Pressable>
          )
        })}

      </ScrollView>
    </SafeAreaView>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
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
  // flexGrow so a short list still fills the viewport and can be dragged;
  // without it there is nothing to pull when only one capture is listed.
  body: { flexGrow: 1, padding: 16, paddingBottom: 40 },

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
  duplicateLine: {
    // Amber, not red: a suspected duplicate is a caution the reviewer
    // settles, not a failure the collector has to fix.
    color: colors.eyebrow,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  noteLine: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  statusFailed: { color: colors.dangerText, fontWeight: '800', letterSpacing: 0.5 },
  errorLine: { fontSize: 12, color: colors.dangerText, marginTop: 6, lineHeight: 17 },
  submissionId: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
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

  mediaScroll: { marginTop: 6 },
  thumbWrap: { width: 120, height: 80, marginRight: 8, borderRadius: 8, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },

  variantsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variantChip: {
    backgroundColor: colors.headerBg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  variantText: { color: colors.text, fontSize: 12, maxWidth: 140 },

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

