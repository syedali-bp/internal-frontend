import { useEffect } from 'react'
import { BackHandler } from 'react-native'

/**
 * Runs `onBack` when Android's hardware/gesture back is pressed.
 *
 * Without a handler the OS default runs, and the default for the root activity
 * is to exit the app — which is why backing out of any screen closed Catalog
 * Capture rather than returning to the previous one. This app routes with a
 * `useState` switch rather than a navigation library, so there is no back stack
 * to unwind on its behalf; each screen says where back goes.
 *
 * Returning true from the listener tells Android the press was handled and stops
 * it reaching that default.
 *
 * `enabled` exists because every mounted listener is consulted in reverse order
 * of registration until one returns true. A screen that is routed away from
 * unmounts and so removes itself, but a screen that stays mounted while
 * inactive would otherwise keep answering for a press meant for whatever is on
 * top of it.
 *
 * No-ops off Android: iOS has no hardware back button, and the swipe gesture
 * belongs to the navigator rather than to a global listener.
 */
export function useAndroidBack(onBack: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack()
      return true
    })

    return () => subscription.remove()
  }, [onBack, enabled])
}
