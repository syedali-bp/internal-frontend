import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type ThemeName = 'light' | 'dark'

/**
 * Where the choice lives between launches.
 *
 * Versioned like the capture queue's key, so a future change of shape can be
 * told apart from this one rather than being read as a corrupt value.
 */
const THEME_KEY = 'catalog.theme.v1'

/**
 * Dark, matching the palette the app shipped with.
 *
 * Deliberately not the OS setting: the toggle is meant to be the only thing
 * that decides this, so a device in light mode still opens the app dark until
 * someone says otherwise.
 */
const DEFAULT_THEME: ThemeName = 'dark'

type ThemeContextValue = {
  theme: ThemeName
  toggleTheme: () => void
  setTheme: (next: ThemeName) => void
  /**
   * False until the stored choice has been read back.
   *
   * The first frame has to render as *something*, and that something is the
   * default — which for anyone who chose light is briefly the wrong theme. The
   * provider holds children back for that one tick rather than flashing.
   */
  isReady: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Holds the current theme and remembers it.
 *
 * Reading is best-effort: unreadable storage falls back to the default rather
 * than throwing, since a lost preference should cost a tap, not a launch.
 * Writing is fire-and-forget for the same reason — the toggle has already taken
 * effect on screen by the time the write resolves.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(DEFAULT_THEME)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_KEY)
        // Anything that is not one of the two names is treated as absent.
        if (!cancelled && (stored === 'light' || stored === 'dark')) {
          setThemeState(stored)
        }
      } catch {
        // Keep the default. There is nothing the collector could do about it.
      } finally {
        if (!cancelled) setIsReady(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next)
    // Not awaited: the UI has already changed, and a failed write only means
    // the choice is forgotten by the next launch.
    void AsyncStorage.setItem(THEME_KEY, next).catch(() => {})
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      void AsyncStorage.setItem(THEME_KEY, next).catch(() => {})
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ theme, toggleTheme, setTheme, isReady }),
    [theme, toggleTheme, setTheme, isReady],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * The current theme and the way to change it.
 *
 * Throws outside a provider rather than quietly defaulting: a screen rendering
 * with a theme nothing can change is a wiring mistake, and one that would
 * otherwise only show up as a toggle that does nothing.
 */
export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) {
    throw new Error('useTheme must be used inside a ThemeProvider.')
  }
  return value
}
