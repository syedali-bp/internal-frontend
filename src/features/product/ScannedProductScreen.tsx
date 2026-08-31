import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView as SafeAreaScreen } from 'react-native-safe-area-context'

import type { Palette } from '../../theme/colors'
import { useColors, useThemedStyles } from '../../theme/useColors'
import { useBarcodeLookup } from './barcodeLookup'

type ScannedProductScreenProps = {
  barcode: string
  /** Add what the catalog is missing for this product. */
  onContribute: () => void
  /** The scan was not this product after all — capture it as new. */
  onCaptureNew: () => void
  onBack: () => void
}

/**
 * What the catalog already holds for a code that just resolved.
 *
 * Stands between the scanner and the capture form so a collector learns the
 * product exists *before* filling in a form about it. Without this the scan went
 * straight to a blank capture screen, and the collector only found out their
 * work was redundant after syncing it — which is the trip this screen exists to
 * save.
 *
 * A confirm step rather than jumping straight to the contribute form: a mis-scan
 * or a shelf tag stuck on the wrong pack would otherwise have them editing a
 * product they are not holding, and neither they nor the moderator would be able
 * to tell afterwards.
 *
 * The gaps come from the server, not from inspecting the product here: which
 * fields a contribution can fill is a rule about how approval merges a capture,
 * and it belongs with the merge.
 */
export function ScannedProductScreen({
  barcode,
  onContribute,
  onCaptureNew,
  onBack,
}: ScannedProductScreenProps) {
  const s = useThemedStyles(makeStyles)
  const colors = useColors()
  const { data, isLoading, error } = useBarcodeLookup(barcode)

  // Either the lookup failed or the catalog has never seen this code. Both lead
  // the same way — into capturing it as a new product — because a lookup that
  // could not be made must never block a capture. The server checks the barcode
  // again at sync, so nothing is lost by going on.
  const unknown = !isLoading && (Boolean(error) || !data?.found)

  if (isLoading) {
    return (
      <SafeAreaScreen style={s.screen} edges={['top', 'left', 'right']}>
        <View style={s.state}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.stateText}>Checking the catalog…</Text>
        </View>
      </SafeAreaScreen>
    )
  }

  if (unknown) {
    return (
      <SafeAreaScreen style={s.screen} edges={['top', 'left', 'right']}>
        <View style={s.state}>
          <Text style={s.stateTitle}>New to the catalog</Text>
          <Text style={s.stateText}>
            {error
              ? 'Could not check the catalog for this barcode. You can still capture it.'
              : 'Nothing on file for this barcode yet — capture it as a new product.'}
          </Text>
          <Text style={s.code}>{barcode}</Text>
          <Pressable accessibilityRole="button" style={s.primary} onPress={onCaptureNew}>
            <Text style={s.primaryText}>Capture this product</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={s.link} onPress={onBack}>
            <Text style={s.linkText}>Scan again</Text>
          </Pressable>
        </View>
      </SafeAreaScreen>
    )
  }

  const product = data as NonNullable<typeof data>
  // Price is always offered, so it alone does not mean the product needs
  // anything: what makes this worth a collector's time is a gap in the catalog.
  const catalogGaps = product.missing.filter((gap) => gap.field !== 'observed_price')

  return (
    <SafeAreaScreen style={s.screen} edges={['top', 'left', 'right']}>
      <View style={s.header}>
        <Text style={s.eyebrow}>ALREADY IN THE CATALOG</Text>
        <Text style={s.title}>{product.product_name}</Text>
      </View>

      <ScrollView contentContainerStyle={s.body}>
        <View style={s.card}>
          {product.thumbnail ? (
            <Image source={{ uri: product.thumbnail }} style={s.photo} resizeMode="cover" />
          ) : (
            // Said plainly rather than left as an empty box: a product with no
            // photo is the single most common reason this screen is worth
            // stopping on, so it reads as the task rather than as a broken image.
            <View style={[s.photo, s.photoEmpty]}>
              <Text style={s.photoEmptyText}>No photo{'\n'}on file</Text>
            </View>
          )}

          <View style={s.cardCopy}>
            {product.brand_name ? <Text style={s.brand}>{product.brand_name}</Text> : null}
            {product.category_name ? (
              <Text style={s.category}>{product.category_name}</Text>
            ) : null}
            <Text style={s.code}>{product.barcode}</Text>
            {/* A code nobody else has confirmed is worth a second look, so the
                count is shown rather than kept as an internal signal. */}
            <Text style={s.scans}>
              {product.verified_scan_count === 0
                ? 'Not yet confirmed by another collector'
                : `Confirmed by ${product.verified_scan_count} scan${product.verified_scan_count === 1 ? '' : 's'}`}
            </Text>
          </View>
        </View>

        {catalogGaps.length > 0 ? (
          <View style={s.gaps}>
            <Text style={s.gapsTitle}>Missing from the catalog</Text>
            {catalogGaps.map((gap) => (
              <Text key={gap.field} style={s.gap}>
                • {gap.label}
              </Text>
            ))}
            <Text style={s.gapsNote}>
              Anything you add goes to a reviewer before it reaches the catalog. Details already on
              file are left as they are.
            </Text>
          </View>
        ) : (
          <View style={s.gaps}>
            <Text style={s.gapsTitle}>Nothing missing</Text>
            <Text style={s.gapsNote}>
              The catalog already holds everything for this product. You can still record what this
              store charges.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        <Pressable accessibilityRole="button" style={s.primary} onPress={onContribute}>
          <Text style={s.primaryText}>
            {catalogGaps.length > 0 ? 'Add what’s missing' : 'Record price at this store'}
          </Text>
        </Pressable>

        {/* Not the same product after all — a shelf tag on the wrong pack, or a
            code reused across two products. Deliberately available: insisting
            the scan is right would file the collector's capture against
            something they are not holding. */}
        <Pressable accessibilityRole="button" style={s.secondary} onPress={onCaptureNew}>
          <Text style={s.secondaryText}>This isn’t the product I’m holding</Text>
        </Pressable>

        <Pressable accessibilityRole="button" style={s.link} onPress={onBack}>
          <Text style={s.linkText}>Scan again</Text>
        </Pressable>
      </View>
    </SafeAreaScreen>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { backgroundColor: colors.screen, flex: 1 },
    header: { paddingHorizontal: 20, paddingTop: 18 },
    eyebrow: {
      color: colors.eyebrow,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.8,
    },
    title: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 6 },
    body: { paddingBottom: 12, paddingHorizontal: 20, paddingTop: 16 },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 14,
      padding: 14,
    },
    photo: { borderRadius: 10, height: 96, width: 96 },
    photoEmpty: {
      alignItems: 'center',
      backgroundColor: colors.screen,
      borderColor: colors.inputBorder,
      borderStyle: 'dashed',
      borderWidth: 1,
      justifyContent: 'center',
    },
    photoEmptyText: {
      color: colors.placeholder,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'center',
    },
    cardCopy: { flex: 1, justifyContent: 'center' },
    brand: { color: colors.primary, fontSize: 14, fontWeight: '800' },
    category: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
    code: { color: colors.textSubtle, fontSize: 12, marginTop: 6 },
    scans: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
    gaps: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      marginTop: 14,
      padding: 16,
    },
    gapsTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
    gap: { color: colors.textSubtle, fontSize: 14, marginTop: 8 },
    gapsNote: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 12 },
    state: { alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingVertical: 48 },
    stateTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
    stateText: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    footer: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    primary: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 10,
      marginTop: 8,
      paddingVertical: 15,
    },
    primaryText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
    secondary: {
      alignItems: 'center',
      borderColor: colors.inputBorder,
      borderRadius: 10,
      borderWidth: 1,
      paddingVertical: 14,
    },
    secondaryText: { color: colors.textSubtle, fontSize: 14, fontWeight: '700' },
    link: { alignItems: 'center', paddingVertical: 6 },
    linkText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  })
