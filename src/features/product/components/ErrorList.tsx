import { StyleSheet, Text, View } from 'react-native'

import { colors } from '../../../theme/colors'

export function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null

  return (
    <View style={s.box}>
      {errors.map((error) => (
        <Text key={error} style={s.text}>
          • {error}
        </Text>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  box: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerBg,
    borderRadius: 8,
    padding: 12,
  },
  text: { color: colors.dangerText, fontSize: 13, lineHeight: 20 },
})
