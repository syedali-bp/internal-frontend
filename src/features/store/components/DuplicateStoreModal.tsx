import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import type { Palette } from '../../../theme/colors'
import { useThemedStyles } from '../../../theme/useColors'
import { storeTypeLabel, type StoreDuplicateCandidate } from '../storeApi'

type DuplicateStoreModalProps = {
  visible: boolean
  /** What the collector typed, so the two can be compared side by side. */
  typedName: string
  candidates: StoreDuplicateCandidate[]
  /** Picks an existing store and starts the visit against it. */
  onUseExisting: (candidate: StoreDuplicateCandidate) => void
  /** None of these is the shop: save the new one anyway. */
  onCreateAnyway: () => void
  onCancel: () => void
  saving: boolean
}

/**
 * The stores this one might already be, put to the collector before a second
 * row is created for one shop.
 *
 * Framed as a question rather than an error. The catalog cannot tell two
 * branches of a chain apart — they share a name, a trade and often a street —
 * and the person standing in the doorway can. So this shows what matched and
 * why, and leaves the decision with them: use one of these, or say none of them
 * is it.
 *
 * `Use this store` is the primary action because it is the right answer far
 * more often than not — the whole reason a duplicate gets created is that the
 * collector could not find the store in the list.
 */
export function DuplicateStoreModal({
  visible,
  typedName,
  candidates,
  onUseExisting,
  onCreateAnyway,
  onCancel,
  saving,
}: DuplicateStoreModalProps) {
  const s = useThemedStyles(makeStyles)

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={s.title}>This store may already exist</Text>
          <Text style={s.subtitle}>
            {candidates.length === 1
              ? 'One store in the catalog looks like the one you are adding.'
              : `${candidates.length} stores in the catalog look like the one you are adding.`}{' '}
            Pick it to collect against it, or add yours if none of these is the shop you are in.
          </Text>

          <View style={s.typed}>
            <Text style={s.typedLabel}>You typed</Text>
            <Text style={s.typedName}>{typedName}</Text>
          </View>

          <ScrollView style={s.list} contentContainerStyle={s.listContent}>
            {candidates.map((candidate) => (
              <Pressable
                key={candidate.store_id}
                accessibilityRole="button"
                disabled={saving}
                onPress={() => onUseExisting(candidate)}
                style={({ pressed }) => [s.row, pressed && s.rowPressed, saving && s.rowDimmed]}
              >
                <View style={s.rowHead}>
                  <Text style={s.rowName}>{candidate.name}</Text>
                  {/* Distance is the signal that actually settles it, so it
                      leads rather than sitting in the reasons below. */}
                  {candidate.distance_meters !== null ? (
                    <Text style={s.rowDistance}>{formatDistance(candidate.distance_meters)}</Text>
                  ) : null}
                </View>

                {candidate.address || candidate.city ? (
                  <Text style={s.rowMeta}>
                    {[candidate.address, candidate.city, candidate.region]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                ) : null}

                <View style={s.rowFoot}>
                  {candidate.store_type ? (
                    <Text style={s.rowType}>{storeTypeLabel(candidate.store_type)}</Text>
                  ) : null}
                  {candidate.status === 'pending_review' ? (
                    <Text style={s.rowPending}>PENDING</Text>
                  ) : null}
                </View>

                {/* Why it matched, in words. A confidence number on its own
                    asks the collector to trust an arithmetic they cannot see. */}
                {candidate.reasons.length > 0 ? (
                  <Text style={s.rowReasons}>{candidate.reasons.join(' · ')}</Text>
                ) : null}

                <Text style={s.rowAction}>Use this store →</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={s.actions}>
            <Pressable style={s.cancel} onPress={onCancel} disabled={saving}>
              <Text style={s.cancelText}>Back</Text>
            </Pressable>
            {/* Secondary by weight, not by placement: it is the less likely
                answer, but it must not look unavailable — a genuinely new shop
                next door to an existing one is a real case. */}
            <Pressable style={[s.create, saving && s.createDisabled]} onPress={onCreateAnyway} disabled={saving}>
              <Text style={s.createText}>{saving ? 'Saving…' : 'None of these — add mine'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

/** Metres up close, where the difference is what decides it; kilometres beyond. */
function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)}m away`
  return `${(meters / 1000).toFixed(1)}km away`
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    backdrop: { backgroundColor: colors.backdrop, flex: 1, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderTopWidth: 1,
      maxHeight: '88%',
      padding: 20,
    },
    title: { color: colors.text, fontSize: 20, fontWeight: '800' },
    subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 6 },
    typed: {
      backgroundColor: colors.screen,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    typedLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    typedName: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 3 },
    list: { marginTop: 14 },
    listContent: { paddingBottom: 4 },
    row: {
      backgroundColor: colors.screen,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 10,
      padding: 14,
    },
    rowPressed: { backgroundColor: colors.primaryHighlight, borderColor: colors.primaryBorder },
    rowDimmed: { opacity: 0.5 },
    rowHead: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
    rowName: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '700' },
    rowDistance: { color: colors.primary, fontSize: 12, fontWeight: '800' },
    rowMeta: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
    rowFoot: { flexDirection: 'row', gap: 10, marginTop: 8 },
    rowType: { color: colors.primary, fontSize: 12, fontWeight: '800' },
    rowPending: { color: colors.eyebrow, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    rowReasons: { color: colors.textSubtle, fontSize: 12, lineHeight: 17, marginTop: 8 },
    rowAction: { color: colors.primary, fontSize: 13, fontWeight: '800', marginTop: 10 },
    actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
    cancel: {
      alignItems: 'center',
      borderColor: colors.inputBorder,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 22,
      paddingVertical: 14,
    },
    cancelText: { color: colors.textSubtle, fontWeight: '800' },
    create: {
      alignItems: 'center',
      borderColor: colors.inputBorder,
      borderRadius: 10,
      borderWidth: 1,
      flex: 1,
      paddingVertical: 14,
    },
    createDisabled: { opacity: 0.45 },
    createText: { color: colors.text, fontWeight: '800' },
  })
