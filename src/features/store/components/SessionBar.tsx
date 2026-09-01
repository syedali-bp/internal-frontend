import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'

import type { Palette } from '../../../theme/colors'
import { useColors, useThemedStyles } from '../../../theme/useColors'
import { storeLocationLine } from '../addressNormalization'
import type { ActiveSession } from '../sessionStore'

type SessionBarProps = {
  session: ActiveSession
  /** Captures already filed against this visit, if any are still queued. */
  queuedCount?: number
  /** Ends the visit and sends the collector back to pick a store. */
  onEndSession: () => void
}

/**
 * Which store the current captures are being filed against.
 *
 * A banner rather than a screen, for the same reason the sync status is one:
 * the store is a property of the visit that has to stay visible while working,
 * not somewhere to navigate to. Before this the store was chosen and then never
 * shown again, so a mistaken tap on the list was invisible until the captures
 * came back attributed to the wrong shop.
 *
 * Ending the visit is deliberately placed here, beside the name it undoes. It
 * confirms first, and says how many captures are queued when any are, because
 * the collector cannot otherwise know what the change costs.
 */
export function SessionBar({ session, queuedCount = 0, onEndSession }: SessionBarProps) {
  const colors = useColors()
  const s = useThemedStyles(makeStyles)

  const storeName = session.store ? session.store.name : 'No fixed store'
  // The bar is one line above the screen it sits on, so this is where a long
  // address costs the most. Display only — the session's store is unchanged.
  const place = session.store
    ? storeLocationLine(session.store) || 'No address recorded'
    : 'Street-side supplier'

  const confirm = () => {
    // Queued captures are the part worth warning about: they were filed against
    // this store, and changing it does not re-attribute them.
    const warning =
      queuedCount > 0
        ? `\n\n${queuedCount} capture${queuedCount === 1 ? '' : 's'} already filed against ` +
          'this store will stay attributed to it.'
        : ''

    Alert.alert(
      'Change store?',
      `This ends the visit to ${storeName}.${warning}`,
      [
        { text: 'Keep collecting', style: 'cancel' },
        { text: 'Change store', style: 'destructive', onPress: onEndSession },
      ],
    )
  }

  return (
    <View style={s.bar}>
      <View style={s.detail}>
        <Text style={s.label}>COLLECTING AT</Text>
        <Text numberOfLines={1} style={s.name}>
          {storeName}
        </Text>
        {place ? (
          <Text numberOfLines={1} style={s.place}>
            {place}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Change store, currently ${storeName}`}
        hitSlop={8}
        onPress={confirm}
        style={s.change}
      >
        <Text style={s.changeText}>Change</Text>
      </Pressable>
    </View>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    bar: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      marginBottom: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    // Takes the slack so a long store name truncates instead of squeezing the
    // button off the row.
    detail: { flex: 1 },
    label: { color: colors.eyebrow, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    name: { color: colors.text, fontSize: 15, fontWeight: '700', marginTop: 3 },
    place: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    change: {
      borderColor: colors.inputBorder,
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    changeText: { color: colors.textSubtle, fontSize: 13, fontWeight: '700' },
  })
