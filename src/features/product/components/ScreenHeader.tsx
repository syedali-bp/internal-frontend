import { StyleSheet, Text, View } from 'react-native'

import { colors } from '../../../theme/colors'

export function ScreenHeader({ title }: { title: string }) {
  return (
    <View style={s.header}>
      <Text style={s.icon}>⊠</Text>
      <Text style={s.text}>{title}</Text>
    </View>
  )
}

const s = StyleSheet.create({
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
  icon: { fontSize: 18, color: colors.text },
  text: { fontSize: 17, fontWeight: '700', color: colors.text },
})
