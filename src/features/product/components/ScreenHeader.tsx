import { StyleSheet, Text, View } from 'react-native'

import { VentrieLogo } from '../../../components'
import type { Palette } from '../../../theme/colors'
import { useColors, useThemedStyles } from '../../../theme/useColors'

export function ScreenHeader({ title }: { title: string }) {
  const s = useThemedStyles(makeStyles)
  const colors = useColors()
  return (
    <View style={s.header}>
      {/* The same mark as the login screen, so the brand carries through the
          capture flow. Replaces a `⊠` glyph that read as a close button. */}
      <VentrieLogo size={24} color={colors.primary} />
      <Text style={s.text}>{title}</Text>
    </View>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  text: { fontSize: 17, fontWeight: '700', color: colors.text },
})

