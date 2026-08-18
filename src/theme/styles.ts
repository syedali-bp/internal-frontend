import { StyleSheet } from 'react-native'

import { colors } from './colors'

// Shared control styles. The dropdown trigger and the text inputs have to look
// identical, so the box style lives in one place instead of being copied.
export const controls = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
})

export const forms = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 7,
    marginTop: 13,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  rowLabel: { width: 78, fontSize: 14, fontWeight: '700', color: colors.textSubtle },
})
