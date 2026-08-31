import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import type { Palette } from '../../../theme/colors'
import { useColors, useThemedStyles } from '../../../theme/useColors'
import type { Vertical } from '../../../types/catalog'

type PickVerticalModalProps = {
  visible: boolean
  /** What the session will be attached to: a store name, or the street-side case. */
  contextLabel: string
  verticals: readonly Vertical[]
  isLoading: boolean
  error: unknown
  starting: boolean
  startError: string | null
  onCancel: () => void
  onPick: (vertical: Vertical) => void
}

/**
 * Which vertical this visit is collecting for.
 *
 * NOT CURRENTLY USED. Selecting a store opens the visit directly and takes the
 * collector to capture; the vertical is chosen per product on the capture form
 * instead, which is the answer a submission is actually filed against. Kept
 * because the choice may want asking again per visit — nothing else references
 * it, so it can be deleted if that never happens.
 *
 * Asked after the store rather than before it because it is a property of the
 * visit, not of the shop: the same hardware store can be walked for
 * construction one day and electronics the next, and the session records which.
 *
 * The list is the catalog's own — `GET /api/catalog/verticals`, the same source
 * the capture form files products against — so a session can never be opened
 * against a vertical products cannot be filed under.
 */
export function PickVerticalModal({
  visible,
  contextLabel,
  verticals,
  isLoading,
  error,
  starting,
  startError,
  onCancel,
  onPick,
}: PickVerticalModalProps) {
  const colors = useColors()
  const s = useThemedStyles(makeStyles)
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={s.title}>What are you collecting?</Text>
          <Text style={s.subtitle}>{contextLabel}</Text>

          {isLoading ? (
            <View style={s.state}>
              <ActivityIndicator color={colors.accent} />
              <Text style={s.stateText}>Loading verticals…</Text>
            </View>
          ) : error ? (
            <View style={s.state}>
              <Text style={s.stateTitle}>Could not load verticals</Text>
              <Text style={s.stateText}>
                {error instanceof Error ? error.message : 'Unknown error'}
              </Text>
            </View>
          ) : verticals.length === 0 ? (
            <View style={s.state}>
              <Text style={s.stateTitle}>No verticals available</Text>
              <Text style={s.stateText}>
                A session needs one, so nothing can be collected until the catalog has at
                least one vertical.
              </Text>
            </View>
          ) : (
            <ScrollView>
              {verticals.map((vertical) => (
                <Pressable
                  key={vertical.id}
                  accessibilityRole="button"
                  disabled={starting}
                  onPress={() => onPick(vertical)}
                  style={[s.row, starting && s.rowDisabled]}
                >
                  <Text style={s.rowName}>{vertical.name}</Text>
                  {vertical.code ? <Text style={s.rowCode}>{vertical.code}</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
          )}

          {startError ? <Text style={s.error}>{startError}</Text> : null}

          <Pressable style={s.cancel} disabled={starting} onPress={onCancel}>
            <Text style={s.cancelText}>{starting ? 'Starting session…' : 'Cancel'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
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
    maxHeight: '80%',
    padding: 20,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 13, marginBottom: 16, marginTop: 4 },
  row: {
    alignItems: 'center',
    backgroundColor: colors.screen,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    padding: 16,
  },
  rowDisabled: { opacity: 0.5 },
  rowName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowCode: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  state: { alignItems: 'center', gap: 8, paddingVertical: 30 },
  stateTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  stateText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  error: { color: colors.dangerText, fontSize: 13, marginTop: 12 },
  cancel: {
    alignItems: 'center',
    borderColor: colors.inputBorder,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 14,
    paddingVertical: 14,
  },
  cancelText: { color: colors.textSubtle, fontWeight: '800' },
})

