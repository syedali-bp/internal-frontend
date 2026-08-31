import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import type { Palette } from '../../../theme/colors'
import { useColors, useThemedStyles } from '../../../theme/useColors'
import type { SyncProgress } from '../syncQueue'

type SyncStatusBarProps = {
  queued: number
  progress: SyncProgress | null
  lastError: string | null
  onSyncNow: () => void
}

/**
 * What the queue owes the server, as a banner.
 *
 * A banner rather than a screen of its own: the queue is a property of the
 * session, not a place to go, and a collector working offline needs to see the
 * count while capturing — not have to navigate away to check it. It renders
 * nothing when there is nothing queued and no error, so the ordinary online
 * case costs no space at all.
 */
export function SyncStatusBar({ queued, progress, lastError, onSyncNow }: SyncStatusBarProps) {
  const colors = useColors()
  const s = useThemedStyles(makeStyles)
  const isSyncing = progress !== null

  if (!queued && !isSyncing && !lastError) return null

  return (
    <View style={[s.bar, lastError && !isSyncing ? s.barError : null]}>
      {isSyncing ? <ActivityIndicator color={colors.accent} size="small" /> : null}

      <View style={s.copy}>
        <Text style={s.title}>
          {isSyncing
            ? `Syncing ${progress.index} of ${progress.total}…`
            : `${queued} capture${queued === 1 ? '' : 's'} waiting to sync`}
        </Text>
        <Text style={[s.detail, lastError && !isSyncing ? s.detailError : null]} numberOfLines={2}>
          {lastError ?? 'Held on this device until the server can be reached.'}
        </Text>
      </View>

      {/* Automatic sync covers the ordinary case; this is for when the collector
          can see they have signal and would rather not wait to be noticed. */}
      {!isSyncing && queued > 0 ? (
        <Pressable accessibilityRole="button" onPress={onSyncNow} style={s.action}>
          <Text style={s.actionText}>Sync now</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  bar: {
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderBottomColor: colors.primaryBorder,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  barError: { backgroundColor: colors.dangerBg, borderBottomColor: colors.dangerBorder },
  copy: { flex: 1 },
  title: { color: colors.text, fontSize: 14, fontWeight: '700' },
  detail: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  detailError: { color: colors.dangerText },
  action: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  actionText: { color: colors.onAccent, fontSize: 13, fontWeight: '800' },
})

