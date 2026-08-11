import { StyleSheet, Text, View } from 'react-native'

type SectionHeaderProps = {
  text: string
  color: string
}

/** Centered caption with a rule running out to each edge. */
export function SectionHeader({ text, color }: SectionHeaderProps) {
  return (
    <View style={s.section}>
      <View style={[s.rule, { backgroundColor: color }]} />
      <Text style={[s.text, { color }]}>{text}</Text>
      <View style={[s.rule, { backgroundColor: color }]} />
    </View>
  )
}

const s = StyleSheet.create({
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 26,
    marginBottom: 14,
  },
  rule: { flex: 1, height: 1.5, opacity: 0.5 },
  text: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
})
