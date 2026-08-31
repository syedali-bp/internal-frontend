import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SafeAreaView as SafeAreaScreen } from 'react-native-safe-area-context'

import type { Palette } from '../../theme/colors'
import { useColors, useThemedStyles } from '../../theme/useColors'
import { useAndroidBack } from '../../navigation/useAndroidBack'
import {
  outcomeOf,
  useMySubmissions,
  type MySubmission,
  type SubmissionOutcome,
} from './useMySubmissions'

type MySubmissionsScreenProps = {
  onBack: () => void
}

/** What each outcome is called and how it is coloured, in one place. */
const OUTCOME_LABEL: Record<SubmissionOutcome, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

/**
 * What this collector has filed, and what review decided.
 *
 * Distinct from ReviewProductsScreen, which shows how far a capture has got
 * towards the server — queued, sent, failed. That is the device's own business.
 * This is the answer that comes back afterwards, and only a moderator can give
 * it.
 */
export function MySubmissionsScreen({ onBack }: MySubmissionsScreenProps) {
  const colors = useColors()
  const s = useThemedStyles(makeStyles)
  const { data, isLoading, error, refetch, isFetching } = useMySubmissions()

  useAndroidBack(onBack)

  // Separate from isFetching so the spinner in the pull gesture is not also
  // triggered by a background refetch the collector did not ask for.
  const [isRefreshing, setIsRefreshing] = useState(false)
  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refetch()
    } finally {
      setIsRefreshing(false)
    }
  }, [refetch])

  const submissions = data ?? []

  return (
    <SafeAreaScreen style={s.screen} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onBack}>
          <Text style={s.back}>‹ Back</Text>
        </Pressable>
        <Text style={s.title}>My Submissions</Text>
        <Text style={s.subtitle}>The products you have sent in, and what review decided.</Text>
      </View>

      {isLoading ? (
        <View style={s.state}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.stateText}>Loading your submissions…</Text>
        </View>
      ) : error ? (
        <View style={s.state}>
          <Text style={s.stateTitle}>Could not load your submissions</Text>
          <Text style={s.stateText}>
            {error instanceof Error ? error.message : 'Unknown error'}
          </Text>
          <Pressable style={s.retry} onPress={() => void refetch()}>
            <Text style={s.retryText}>{isFetching ? 'Retrying…' : 'Try again'}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={submissions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          // Pull to refresh: a decision can land at any time, and the collector
          // has no other way to ask whether one has.
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => void refresh()}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
          ListEmptyComponent={
            <View style={s.state}>
              <Text style={s.stateTitle}>Nothing submitted yet</Text>
              <Text style={s.stateText}>
                Products you capture will appear here with their review status.
              </Text>
            </View>
          }
          renderItem={({ item }) => <SubmissionRow submission={item} />}
        />
      )}
    </SafeAreaScreen>
  )
}

/** One capture, with the verdict and — when rejected — why. */
function SubmissionRow({ submission }: { submission: MySubmission }) {
  const s = useThemedStyles(makeStyles)
  const outcome = outcomeOf(submission.review_status)

  const captured = formatWhen(submission.captured_at)

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text numberOfLines={2} style={s.name}>
          {submission.entered_name || 'Unnamed product'}
        </Text>
        <View style={[s.pill, s[`pill_${outcome}`]]}>
          <Text style={[s.pillText, s[`pillText_${outcome}`]]}>{OUTCOME_LABEL[outcome]}</Text>
        </View>
      </View>

      {submission.entered_category_path ? (
        <Text numberOfLines={2} style={s.meta}>
          {submission.entered_category_path}
        </Text>
      ) : null}

      {captured ? <Text style={s.when}>Captured {captured}</Text> : null}

      {/* Said plainly, because "Pending" alone does not tell a collector
          whether anything is expected of them. */}
      {outcome === 'pending' ? (
        <Text style={s.note}>Your submission is currently under review.</Text>
      ) : null}

      {outcome === 'accepted' ? (
        <Text style={s.note}>Approved and added to the catalog.</Text>
      ) : null}

      {/* Only on a rejection, and only when a reason was actually recorded —
          an empty "Reason:" label reads as the moderator having said nothing
          when they may simply not have been asked for one. */}
      {outcome === 'rejected' ? (
        submission.rejection_reason?.trim() ? (
          <Text style={s.note}>
            <Text style={s.reasonLabel}>Reason: </Text>
            {submission.rejection_reason.trim()}
          </Text>
        ) : (
          <Text style={s.note}>This submission was not added to the catalog.</Text>
        )
      ) : null}
    </View>
  )
}

/** Device-local formatting; an unparseable date is shown as nothing at all. */
function formatWhen(value: string) {
  if (!value) return ''
  const when = new Date(value)
  return Number.isNaN(when.getTime()) ? '' : when.toLocaleString()
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { backgroundColor: colors.screen, flex: 1, padding: 16 },
    header: { marginBottom: 12 },
    back: { color: colors.accent, fontSize: 15, fontWeight: '700', marginBottom: 10 },
    title: { color: colors.text, fontSize: 26, fontWeight: '800' },
    subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },

    // flexGrow so a short or empty list still fills the viewport: without it there
    // is nothing to drag, and pull-to-refresh cannot be started on the empty state
    // — which is exactly when a refresh is most wanted.
    list: { flexGrow: 1, paddingBottom: 24 },

    state: { alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 48 },
    stateTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
    stateText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
    retry: {
      borderColor: colors.inputBorder,
      borderRadius: 10,
      borderWidth: 1,
      marginTop: 8,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    retryText: { color: colors.accent, fontWeight: '800' },

    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      marginTop: 12,
      padding: 14,
    },
    cardHead: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
    name: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '800' },
    meta: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 6 },
    when: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
    note: { color: colors.textSubtle, fontSize: 13, lineHeight: 19, marginTop: 10 },
    reasonLabel: { color: colors.text, fontWeight: '800' },

    pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    pillText: { fontSize: 12, fontWeight: '800' },
    // Waiting, done, and closed — read at a glance without needing the words.
    pill_pending: { backgroundColor: colors.screen, borderColor: colors.inputBorder, borderWidth: 1 },
    pillText_pending: { color: colors.textSubtle },
    pill_accepted: { backgroundColor: colors.accent },
    pillText_accepted: { color: colors.onAccent },
    pill_rejected: { backgroundColor: colors.dangerText },
    pillText_rejected: { color: colors.onAccent },
  })
