import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView as SafeAreaScreen } from 'react-native-safe-area-context'

import type { Palette } from '../../theme/colors'
import { makeControls, useColors, useThemedStyles } from '../../theme/useColors'
import { useCollector } from '../auth/authSession'
import { useVerticals } from '../product/useVerticals'
import { AddStoreModal } from './components/AddStoreModal'
import { DuplicateStoreModal } from './components/DuplicateStoreModal'
import { useStoreTypes } from './useStoreTypes'
import { startSession, type ActiveSession } from './sessionStore'
import {
  DuplicateStoreError,
  storeTypeLabel,
  useCreateStore,
  useStartSession,
  useStores,
  type NewStoreInput,
  type Store,
  type StoreDuplicateCandidate,
  type StoreType,
} from './storeApi'

type SelectStoreScreenProps = {
  /** Handed the visit once its session has been opened. */
  onSessionStarted: (session: ActiveSession) => void
}

/**
 * Which store the collector is standing in, and what they are collecting.
 *
 * Two steps in one screen: pick or create a store, then pick the vertical,
 * which together open a collection session for the visit. Both are asked once
 * on arrival rather than per product.
 *
 * A collector with no fixed store — a street-side or construction supplier —
 * skips the first step. The session still exists and still has a vertical; only
 * `store_id` is null.
 */
export function SelectStoreScreen({ onSessionStarted }: SelectStoreScreenProps) {
  const controls = useThemedStyles(makeControls)
  const colors = useColors()
  const s = useThemedStyles(makeStyles)
  const collector = useCollector()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<StoreType | ''>('')
  const [isAdding, setIsAdding] = useState(false)
  // Which row is opening. Starting a visit is a round trip, and without this the
  // list sat there looking untapped until the screen abruptly changed.
  const [openingId, setOpeningId] = useState<string | null>(null)
  // The row just added, so the list can point it out among stores that may
  // already number in the hundreds.
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null)
  // Why the note is showing: a store this collector just submitted, or one they
  // recognised that is itself still awaiting approval. The wording differs.
  const [noteKind, setNoteKind] = useState<'created' | 'pending'>('created')

  const filters = useMemo(
    () => ({ search, store_type: typeFilter }),
    [search, typeFilter],
  )

  const { data, isLoading, error, refetch, isFetching } = useStores(filters)

  // Separate from isFetching so the spinner in the pull gesture is not also
  // triggered by a background refetch the collector did not ask for — same
  // reasoning as My Submissions.
  const [isRefreshing, setIsRefreshing] = useState(false)
  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refetch()
    } finally {
      setIsRefreshing(false)
    }
  }, [refetch])
  // The filter row offers whatever the catalog knows, including trades added
  // from the field — not just the set the app shipped with.
  const { storeTypes } = useStoreTypes()
  // Only the list is needed: the session's vertical is taken from it without
  // asking, so there is no loading or error state for the collector to see.
  const { verticals } = useVerticals()

  const collectorId = collector?.id ?? ''
  const createStore = useCreateStore(collectorId)
  const startSessionMutation = useStartSession()

  const stores = data ?? []

  /**
   * The stores a pending create looks like, and the create that was stopped.
   *
   * Held together because the second attempt has to resend exactly what the
   * first one did, plus `force` — rebuilding the body from the form would lose
   * the coordinates, which are resolved inside the mutation.
   */
  const [duplicates, setDuplicates] = useState<{
    candidates: StoreDuplicateCandidate[]
    input: NewStoreInput
  } | null>(null)

  const create = (body: NewStoreInput) => {
    createStore.mutate(body, {
      onSuccess: (created) => {
        setIsAdding(false)
        setDuplicates(null)
        // Cleared so the new row is not filtered out of the list the collector
        // lands back on — it is the one thing they want to see confirmed.
        setSearch('')
        setTypeFilter('')
        setNoteKind('created')

        // Back to the list rather than into a visit. A store added from the
        // field is pending_review until staff have looked at it, and opening a
        // session against an unvetted row would file captures against a store
        // that may yet be rejected or merged into another. The row appears in
        // the list marked Pending so the collector can see their submission
        // exists, and becomes selectable when it is approved.
        setJustCreatedId(created.id)
      },
      onError: (error) => {
        // Not a failure but a question: the catalog holds stores this one might
        // already be, and only the collector standing there can say. The Add
        // Store sheet stays mounted behind this, so `Back` returns to the form
        // with everything they typed still in it.
        if (error instanceof DuplicateStoreError) {
          setDuplicates({ candidates: error.candidates, input: body })
        }
      },
    })
  }

  /**
   * The collector recognised one of the matches: collect against that store
   * instead of creating a second row for one shop.
   *
   * The candidate carries everything `begin` needs, so the visit opens without
   * another round trip to read the store back — and `created_by_collector_id`
   * is not among them, because it belongs to whoever first added the row rather
   * than to whoever recognised it today.
   */
  const useExisting = (candidate: StoreDuplicateCandidate) => {
    setDuplicates(null)
    setIsAdding(false)
    setSearch('')

    // The store they recognised may itself be awaiting approval — someone else
    // may have added it earlier the same day. `begin` refuses those, so say why
    // rather than letting the sheet close on a tap that did nothing.
    if (candidate.status !== 'active') {
      setTypeFilter('')
      setNoteKind('pending')
      setJustCreatedId(candidate.store_id)
      return
    }

    begin({
      id: candidate.store_id,
      name: candidate.name,
      store_type: candidate.store_type,
      address: candidate.address,
      city: candidate.city,
      region: candidate.region,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      status: candidate.status,
      created_by_collector_id: null,
    })
  }

  /** None of the matches is the shop. Resend the same body, forced. */
  const createAnyway = () => {
    if (!duplicates) return
    create({ ...duplicates.input, force: true })
  }

  /**
   * Opens the visit for a store and goes straight to capture.
   *
   * The collector is not asked what they are collecting. A session still
   * carries a `vertical_id` — the backend requires one — but it is no longer a
   * question put to them here: the capture form asks per product, which is the
   * finer-grained answer and the one that actually files the submission. Asking
   * twice made the session's copy a prompt that changed nothing downstream.
   *
   * `store` is typed nullable because the session model allows it — `store_id`
   * is null for a supplier with no fixed premises. Nothing in the UI passes
   * null any more: the button that did was removed. The signature stays so the
   * case can be offered again without rework.
   */
  const begin = (store: Store | null) => {
    // A store still awaiting review cannot be collected against: its row may
    // yet be rejected, or merged into the store it duplicates, and captures
    // filed against it would have to be reattributed afterwards. The guard is
    // here as well as on the row so it holds for every caller — including
    // useExisting, where the duplicate the collector recognised may itself be
    // a pending row someone else added earlier today.
    if (store && store.status !== 'active') return

    // The session's own vertical, which the capture form overrides per product.
    // First in display order rather than a guess from `store_type`: a mapping
    // would be wrong for any shop that sells across trades, and this value is
    // not what a submission is filed against.
    const vertical = verticals[0]
    if (!vertical || startSessionMutation.isPending) return

    setOpeningId(store?.id ?? null)
    startSessionMutation.mutate(
      {
        collectorId,
        storeId: store?.id ?? null,
        verticalId: vertical.id,
      },
      {
        onSuccess: (session) => {
          const active: ActiveSession = { session, store, vertical }
          // Held for the visit, so the capture flow can read it without being
          // handed it again.
          startSession(active)
          onSessionStarted(active)
        },
        // Cleared on failure only: on success the screen is being replaced, and
        // clearing it there would flash the row back to normal first.
        onError: () => setOpeningId(null),
      },
    )
  }

  return (
    <SafeAreaScreen style={s.screen} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <Text style={s.title}>Select Store</Text>
        <Text style={s.subtitle}>Pick the store you are collecting at.</Text>
      </View>

      <View style={s.searchRow}>
        <TextInput
          style={controls.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, area or city"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Type filter. `All` first so clearing it is one tap from anywhere. */}
      <FlatList
        horizontal
        data={[{ value: '', label: 'All' }, ...storeTypes]}
        keyExtractor={(type) => type.value || 'all'}
        showsHorizontalScrollIndicator={false}
        // A horizontal list is still a flex child of the screen column, so
        // without a height of its own it takes the space the store list should
        // have and stretches every pill down with it. flexGrow: 0 keeps it to
        // its content; alignItems centres the pills instead of stretching them.
        style={s.filterBar}
        contentContainerStyle={s.filters}
        renderItem={({ item }) => {
          const isActive = item.value === typeFilter
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => setTypeFilter(item.value)}
              style={[s.filter, isActive && s.filterActive]}
            >
              <Text style={[s.filterText, isActive && s.filterTextActive]}>{item.label}</Text>
            </Pressable>
          )
        }}
      />

      {/* Starting the visit is what a tap on a store does, so a failure has to
          be visible here — there is no longer a modal holding it. */}
      {startSessionMutation.error ? (
        <View style={s.startError}>
          <Text style={s.startErrorText}>
            Could not start the visit: {startSessionMutation.error.message}
          </Text>
        </View>
      ) : null}

      {/* Confirms the submission landed. Without it a collector who expected to
          be taken into a visit is left looking at a list, with the row they
          just added greyed out and no explanation. */}
      {justCreatedId ? (
        <View style={s.createdNote}>
          <Text style={s.createdNoteText}>
            {noteKind === 'created'
              ? 'Store submitted for approval. You can collect against it once staff have approved it.'
              : 'That store is still awaiting approval, so a visit cannot be started against it yet.'}
          </Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={s.state}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.stateText}>Loading stores…</Text>
        </View>
      ) : error ? (
        <View style={s.state}>
          <Text style={s.stateTitle}>Could not load stores</Text>
          <Text style={s.stateText}>{error instanceof Error ? error.message : 'Unknown error'}</Text>
          <Pressable style={s.retry} onPress={() => void refetch()}>
            <Text style={s.retryText}>{isFetching ? 'Retrying…' : 'Try again'}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={stores}
          keyExtractor={(store) => store.id}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          // Pull to refresh: a store added from another device — or by this
          // collector on an earlier visit — should be reachable without
          // restarting the app.
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
              <Text style={s.stateTitle}>
                {search.trim() || typeFilter ? 'No stores match' : 'No stores yet'}
              </Text>
              <Text style={s.stateText}>
                {search.trim() || typeFilter
                  ? 'Nothing found for that search — add the store below if it is missing.'
                  : 'No stores found — add one below to get started.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              // Dimmed while any row is opening, so the list reads as busy
              // rather than as ignoring taps; the pressed row also darkens on
              // touch, which it did not do at all before.
              style={({ pressed }) => [
                s.row,
                pressed && item.status === 'active' && s.rowPressed,
                item.status !== 'active' && s.rowUnavailable,
                item.id === justCreatedId && s.rowJustCreated,
                openingId !== null && openingId !== item.id && s.rowDimmed,
              ]}
              disabled={openingId !== null || item.status !== 'active'}
              onPress={() => begin(item)}
            >
              <View style={s.rowCopy}>
                <Text style={s.rowName}>{item.name}</Text>
                {/* Only what was recorded: an empty line reads as a missing
                    value rather than as spacing. */}
                {item.address || item.city ? (
                  <Text style={s.rowMeta}>
                    {[item.address, item.city, item.region].filter(Boolean).join(', ')}
                  </Text>
                ) : null}
              </View>
              <View style={s.rowSide}>
                {openingId === item.id ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <>
                    <Text style={s.rowType}>{storeTypeLabel(item.store_type)}</Text>
                    {/* Says what the state means for the collector, not what it
                        is called in the database: "pending review" reads as a
                        label, "awaiting approval" as the reason the row cannot
                        be tapped. */}
                    {item.status !== 'active' ? (
                      <Text style={s.rowPending}>
                        {item.status === 'pending_review' ? 'AWAITING APPROVAL' : 'UNAVAILABLE'}
                      </Text>
                    ) : null}
                  </>
                )}
              </View>
            </Pressable>
          )}
        />
      )}

      <View style={s.footer}>
        <Pressable accessibilityRole="button" style={s.add} onPress={() => setIsAdding(true)}>
          <Text style={s.addText}>+ Add new store</Text>
        </Pressable>
      </View>

      <AddStoreModal
        visible={isAdding}
        initialName={search.trim()}
        onCancel={() => setIsAdding(false)}
        onSubmit={create}
        saving={createStore.isPending}
        // A duplicate is not reported here: it has a sheet of its own, and
        // printing "This store may already exist" under the form as well would
        // read as a second, unrelated failure.
        error={
          createStore.error && !(createStore.error instanceof DuplicateStoreError)
            ? createStore.error.message
            : null
        }
      />

      {/* Over the Add Store sheet rather than replacing it, so `Back` returns
          to the form with everything the collector typed still in it. */}
      <DuplicateStoreModal
        visible={duplicates !== null}
        typedName={duplicates?.input.name ?? ''}
        candidates={duplicates?.candidates ?? []}
        onUseExisting={useExisting}
        onCreateAnyway={createAnyway}
        onCancel={() => setDuplicates(null)}
        saving={createStore.isPending}
      />

    </SafeAreaScreen>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  startError: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.dangerBorder,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
  },
  startErrorText: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
  screen: { backgroundColor: colors.screen, flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 18 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 6 },
  searchRow: { paddingHorizontal: 20, paddingTop: 16 },
  filterBar: { flexGrow: 0, flexShrink: 0 },
  filters: { alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  filter: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  rowPressed: { backgroundColor: colors.primaryHighlight, borderColor: colors.primaryBorder },
  rowDimmed: { opacity: 0.4 },
  // Greyed rather than hidden: the collector needs to see that the store they
  // added exists and is waiting, not have it vanish from the list.
  rowUnavailable: { backgroundColor: colors.screen, opacity: 0.55 },
  rowJustCreated: { borderColor: colors.eyebrow },
  createdNote: {
    backgroundColor: colors.primaryBg,
    borderColor: colors.primaryBorder,
    borderRadius: 10,
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 4,
    padding: 12,
  },
  createdNoteText: { color: colors.textSubtle, fontSize: 12, lineHeight: 17 },
  filterText: { color: colors.textSubtle, fontSize: 13, fontWeight: '700' },
  filterTextActive: { color: colors.onAccent },
  // flexGrow so a short or empty list still fills the viewport: without it there
  // is nothing to drag, and pull-to-refresh cannot be started on the empty state
  // — which is exactly when a refresh is most wanted.
  list: { flexGrow: 1, paddingBottom: 12, paddingHorizontal: 20 },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    padding: 16,
  },
  rowCopy: { flex: 1 },
  rowName: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowMeta: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  rowSide: { alignItems: 'flex-end', gap: 4 },
  rowType: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  rowPending: { color: colors.eyebrow, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  state: { alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 40 },
  stateTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  stateText: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
  retry: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  retryText: { color: colors.onAccent, fontWeight: '800' },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  add: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 15,
  },
  addText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
})

