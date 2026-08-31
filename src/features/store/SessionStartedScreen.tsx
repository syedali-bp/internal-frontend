import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView as SafeAreaScreen } from 'react-native-safe-area-context'

import type { Palette } from '../../theme/colors'
import { useColors, useThemedStyles } from '../../theme/useColors'
import { storeTypeLabel } from './storeApi'
import type { ActiveSession } from './sessionStore'

type SessionStartedScreenProps = {
  session: ActiveSession
  /** Ends the visit and goes back to pick a different store or vertical. */
  onChangeStore: () => void
}

/**
 * Placeholder for whatever the visit leads to.
 *
 * The capture flow is wired up separately; this stands in so the session can be
 * seen to exist and read back. It shows what was actually recorded, which is
 * also the quickest way to spot a field that did not survive the round trip.
 */
export function SessionStartedScreen({ session, onChangeStore }: SessionStartedScreenProps) {
  const s = useThemedStyles(makeStyles)
  const { session: row, store, vertical } = session

  const rows: Array<[string, string]> = [
    ['Session', row.id],
    ['Collector', row.collector_id],
    ['Store', store ? store.name : 'None (street-side supplier)'],
    ['Store type', store ? storeTypeLabel(store.store_type) : '—'],
    ['Store id', row.store_id ?? 'null'],
    ['Vertical', vertical.name],
    ['Started', new Date(row.started_at).toLocaleString()],
    [
      'Start GPS',
      row.start_latitude === null || row.start_longitude === null
        ? 'Not captured'
        : `${row.start_latitude}, ${row.start_longitude}`,
    ],
    ['Captures', String(row.submission_count)],
  ]

  return (
    <SafeAreaScreen style={s.screen} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.eyebrow}>SESSION STARTED</Text>
        <Text style={s.title}>{store ? store.name : 'Street-side supplier'}</Text>
        <Text style={s.subtitle}>Collecting for {vertical.name}.</Text>

        <View style={s.card}>
          {rows.map(([label, value]) => (
            <View key={label} style={s.row}>
              <Text style={s.rowLabel}>{label}</Text>
              <Text style={s.rowValue} numberOfLines={2}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        <Text style={s.note}>
          Scanning and capture are wired up separately. This screen stands in until they are.
        </Text>

        <Pressable accessibilityRole="button" style={s.change} onPress={onChangeStore}>
          <Text style={s.changeText}>Change store or vertical</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaScreen>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  screen: { backgroundColor: colors.screen, flex: 1 },
  body: { padding: 20 },
  eyebrow: { color: colors.eyebrow, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 8 },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: 6 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 20,
    padding: 16,
  },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 7 },
  rowLabel: { color: colors.textMuted, fontSize: 13, width: 92 },
  rowValue: { color: colors.text, flex: 1, fontSize: 13, fontWeight: '600' },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 18 },
  change: {
    alignItems: 'center',
    borderColor: colors.inputBorder,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 22,
    paddingVertical: 14,
  },
  changeText: { color: colors.textSubtle, fontWeight: '800' },
})

