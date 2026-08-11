import { StyleSheet, Text, View } from 'react-native'

import { colors } from '../../../theme/colors'

export function PayloadPreview({ json }: { json: string }) {
  return (
    <View style={s.box}>
      <Text style={s.title}>Payload that would be sent</Text>
      <Text style={s.json} selectable>
        {json}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  box: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.codeBg,
    borderRadius: 8,
    padding: 12,
  },
  title: {
    color: colors.codeLabel,
    fontSize: 11,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  json: { color: colors.codeText, fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
})
