import { StyleSheet } from 'react-native'

import { colors } from './colors'

/**
 * Shared control styles, baked with the dark palette.
 *
 * Superseded by `makeControls` / `makeForms` in useColors.ts, which build the
 * same shapes from the active theme. Nothing imports these any more; they are
 * kept as the reference the themed factories mirror, and are safe to delete
 * once that no longer has value.
 *
 * Do not add consumers: a `StyleSheet.create` at module scope evaluates once at
 * import, so anything reading from here is frozen dark whatever the toggle says.
 */
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
