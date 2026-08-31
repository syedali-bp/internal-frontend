import { StyleSheet } from 'react-native'
import { useMemo } from 'react'

import { darkColors, lightColors, type Palette } from './colors'
import { useTheme } from './ThemeContext'

/**
 * The palette for the current theme.
 *
 * Drop-in for the static `colors` import, with one difference that matters:
 * this has to be called inside a component, and the styles built from it have
 * to be built there too. A `StyleSheet.create` at module scope runs once at
 * import and captures whatever the palette was then, which is exactly why the
 * unmigrated screens cannot follow the toggle.
 *
 *   const colors = useColors()
 *   const s = useThemedStyles(makeStyles)
 */
export function useColors(): Palette {
  const { theme } = useTheme()
  return theme === 'dark' ? darkColors : lightColors
}

/**
 * Builds a StyleSheet from the current palette, rebuilding it when that changes.
 *
 * `factory` has to be a stable reference — defined at module scope, not inline
 * in the component — or the memo is recomputed every render and the sheet is
 * rebuilt for nothing.
 */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: Palette) => T,
): T {
  const colors = useColors()
  return useMemo(() => StyleSheet.create(factory(colors)), [factory, colors])
}

/**
 * The shared control styles, themed.
 *
 * Same shapes as `theme/styles.ts`, which keeps exporting the dark-baked
 * versions for anything not yet on the hook. Pass these to `useThemedStyles`:
 *
 *   const controls = useThemedStyles(makeControls)
 */
export const makeControls = (colors: Palette) => ({
  input: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' as const },
})

/** The shared form-row styles, themed. Mirrors `forms` in theme/styles.ts. */
export const makeForms = (colors: Palette) => ({
  label: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.text,
    marginBottom: 7,
    marginTop: 13,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 10,
  },
  rowLabel: {
    width: 78,
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.textSubtle,
  },
})
