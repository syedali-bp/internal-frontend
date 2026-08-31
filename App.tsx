import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, BackHandler, Easing, View } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

import { LoginScreen } from './src/features/auth/LoginScreen'
import { RegisterScreen } from './src/features/auth/RegisterScreen'
import { ForgotPasswordScreen } from './src/features/auth/ForgotPasswordScreen'
import { SelectStoreScreen } from './src/features/store/SelectStoreScreen'
import { SessionStartedScreen } from './src/features/store/SessionStartedScreen'
import { endSession, type ActiveSession } from './src/features/store/sessionStore'
import { ScanQrScreen } from './src/features/product/ScanQrScreen'
import { ScannedProductScreen } from './src/features/product/ScannedProductScreen'
import { MySubmissionsScreen } from './src/features/product/MySubmissionsScreen'
import { AddProductScreen } from './src/features/product/AddProductScreen'
import { ReviewProductsScreen } from './src/features/product/ReviewProductsScreen'
import { ThemeProvider, useTheme } from './src/theme/ThemeContext'
import { useAndroidBack } from './src/navigation/useAndroidBack'
import { getRefreshToken, restoreSession, signOut } from './src/features/auth/authSession'
import { installTokenRefresher, logout } from './src/features/auth/authApi'
import type { SubmissionPayload } from './src/types/product'

type Route =
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'forgot' }
  | { name: 'store' }
  | { name: 'session'; session: ActiveSession }
  | { name: 'scan' }
  // What a scanned code turned out to be. Stands between the scanner and the
  // capture form so a collector is told the catalog already holds this pack
  // before filling one in about it.
  | { name: 'scanned'; barcode: string }
  // `contributing` marks a capture aimed at a product the catalog already has:
  // the collector is filling gaps, not describing the pack from scratch.
  | { name: 'add'; barcode?: string; contributing?: boolean }
  | { name: 'review'; payload: SubmissionPayload }
  | { name: 'my-submissions' }

// Registered at module load, before any screen can fire a request: a restored
// session's access token is often already expired, and the first call it makes
// has to be able to refresh rather than fail.
installTokenRefresher()

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'login' })
  // Nothing is rendered until the stored session has been read back, so a
  // returning collector never sees the login screen flash before being sent
  // past it.
  const [isRestoring, setIsRestoring] = useState(true)
  // Reference-data failures have to surface quickly. The default three retries
  // with backoff, on top of each request's own 8s deadline, would leave the form
  // in a loading state for well over half a minute before saying anything.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1 } },
      }),
  )

  /**
   * Where Android's back button goes from each screen.
   *
   * There is no navigation library here — routing is the `useState` switch
   * below — so without this the OS default runs and closes the app from every
   * screen. Each case names its parent explicitly rather than popping a stack,
   * because some of these are not simple reversals: leaving a session ends it,
   * and a filed capture goes back to the scanner rather than to its own form.
   */
  const goBack = useCallback(() => {
    setRoute((current) => {
      switch (current.name) {
        case 'register':
        case 'forgot':
          return { name: 'login' }

        case 'store':
          // Backing out of store selection is signing out: it is the first
          // screen after login, and leaving it while still authenticated would
          // strand the collector on a login screen they are already past.
          //
          // Revoked server-side too, so the stored refresh token cannot be used
          // again. Read before signOut clears it, and not awaited — navigation
          // must not wait on the network.
          void logout(getRefreshToken())
          signOut()
          return { name: 'login' }

        case 'session':
          // A different store or vertical is a different visit, so the open
          // session ends here exactly as it does via "change store".
          endSession()
          return { name: 'store' }

        case 'scan':
          // Back out of capture is leaving the visit, so the session ends here
          // rather than being left open behind a screen the collector can no
          // longer see. Returning to the store list without ending it would
          // silently keep filing against the old store on the next pick.
          //
          // Unconfirmed, unlike SessionBar's "Change": a deliberate back press
          // is already the gesture for "not this", and prompting on it makes
          // the button the only way out that does not argue.
          endSession()
          return { name: 'store' }

        case 'scanned':
          return { name: 'scan' }

        case 'add':
          // A contribution came from the scan-result card, so back returns
          // there rather than to the camera — same rule as the on-screen Back,
          // or the hardware button would land somewhere else than the one
          // beside it. A capture of a new product has no card to return to.
          return current.contributing && current.barcode
            ? { name: 'scanned', barcode: current.barcode }
            : { name: 'scan' }

        case 'review':
          // The capture is filed and in review; back starts a new one rather
          // than reopening a form that can no longer be edited.
          return { name: 'scan' }

        case 'login':
        default:
          // Nothing above login. Let Android do what it normally does, which
          // from the root screen is to leave the app.
          BackHandler.exitApp()
          return current
      }
    })
  }, [])

  useAndroidBack(goBack)

  // Once, on launch. A stored session sends the collector straight to store
  // selection; anything else leaves them on the login card.
  useEffect(() => {
    let cancelled = false

    void restoreSession()
      .then((restored) => {
        if (cancelled) return
        if (restored) setRoute({ name: 'store' })
      })
      .finally(() => {
        if (!cancelled) setIsRestoring(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
      <SafeAreaProvider>
        {/* Follows the theme: light glyphs are invisible on a light ground. */}
        <ThemedStatusBar />
        {isRestoring ? (
          // Deliberately blank rather than a spinner: reading one keystore entry
          // is fast enough that a spinner would be a flash of chrome, and the
          // splash screen is still up behind this on a cold start.
          <View style={{ flex: 1 }} />
        ) : (
          <ScreenFade routeKey={route.name}>
          {route.name === 'login' ? (
            <LoginScreen
              onSignIn={() => setRoute({ name: 'store' })}
              onShowRegister={() => setRoute({ name: 'register' })}
              onForgotPassword={() => setRoute({ name: 'forgot' })}
            />
          ) : route.name === 'forgot' ? (
            // Recovery is by emailed code. A successful reset lands back on the
            // login card, where the collector signs in with the new password.
            <ForgotPasswordScreen onDone={() => setRoute({ name: 'login' })} />
          ) : route.name === 'register' ? (
            // Registration signs the collector in itself, so it lands where a
            // successful login does.
            <RegisterScreen
              onRegistered={() => setRoute({ name: 'store' })}
              onShowLogin={() => setRoute({ name: 'login' })}
            />
          ) : route.name === 'store' ? (
            <SelectStoreScreen
              // The visit is held in sessionStore.ts for the rest of the app, so
              // nothing downstream has to be handed it. Capture starts straight
              // away: the collector picked a store and a vertical to scan, and an
              // extra screen confirming what they just chose is a tap for nothing.
              onSessionStarted={() => setRoute({ name: 'scan' })}
            />
          ) : route.name === 'session' ? (
            // No longer where starting a session lands — the flow goes to Scan.
            // Kept because it is the only screen that shows the session row as
            // stored, which is worth having while the backend is mocked.
            <SessionStartedScreen
              session={route.session}
              onChangeStore={() => {
                // A different store or vertical is a different visit.
                endSession()
                setRoute({ name: 'store' })
              }}
            />
          ) : route.name === 'scan' ? (
          <ScanQrScreen
            // Via the scan result, not straight to capture: a code the catalog
            // already holds has to be shown to the collector before they fill
            // in a form about it, or they find out their work was redundant
            // only after syncing it.
            onScanned={(barcode) => setRoute({ name: 'scanned', barcode })}
            onAddProductDetails={() => setRoute({ name: 'add' })}
            onMySubmissions={() => setRoute({ name: 'my-submissions' })}
            // The way out of a store picked by mistake: end the visit and go
            // back to the list. SessionBar confirms before calling this.
            onEndSession={() => {
              endSession()
              setRoute({ name: 'store' })
            }}
          />
        ) : route.name === 'my-submissions' ? (
          // Reached from the capture screen, and returns there: it is a detour
          // from collecting rather than a step in it.
          <MySubmissionsScreen onBack={() => setRoute({ name: 'scan' })} />
        ) : route.name === 'scanned' ? (
          <ScannedProductScreen
            barcode={route.barcode}
            // Filling the catalog's gaps for a product it already holds. The
            // capture still goes through review like any other.
            onContribute={() =>
              setRoute({ name: 'add', barcode: route.barcode, contributing: true })
            }
            // The scan was not this pack — a shelf tag on the wrong product, or
            // a code reused across two. Captured as new, and the server decides
            // again at sync.
            onCaptureNew={() => setRoute({ name: 'add', barcode: route.barcode })}
            onBack={() => setRoute({ name: 'scan' })}
          />
        ) : route.name === 'add' ? (
          <AddProductScreen
            barcode={route.barcode}
            contributing={route.contributing}
            // Back from a contribution returns to the product it is about, not
            // to the scanner: the collector arrived here from that card and is
            // still standing in front of the pack. Sending them to the camera
            // would make them scan the same code again to get back.
            onBack={() =>
              route.contributing && route.barcode
                ? setRoute({ name: 'scanned', barcode: route.barcode })
                : setRoute({ name: 'scan' })
            }
            onSubmitted={(payload) => setRoute({ name: 'review', payload })}
          />
        ) : (
          <ReviewProductsScreen
            item={route.payload}
            // Capture is finished and filed, so going back starts a new one
            // rather than reopening a form whose submission is already in review.
            onBack={() => setRoute({ name: 'scan' })}
            onDone={() => setRoute({ name: 'scan' })}
          />
        )}
          </ScreenFade>
        )}
    </SafeAreaProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

/**
 * Cross-fades whatever screen is showing when the route changes.
 *
 * Screens used to swap in a single frame, which read as a glitch rather than as
 * navigation — most visibly when tapping a store, where a network round trip
 * ended in the whole screen being replaced with no warning. A short fade is
 * enough to make it read as a transition; it is deliberately not a slide, since
 * this app's routes are not a stack and a slide would imply a direction that
 * does not exist.
 */
function ScreenFade({ routeKey, children }: { routeKey: string; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    opacity.setValue(0)
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      // The fade is opacity only, so it can run off the JS thread and stay
      // smooth while the incoming screen does its first data fetch.
      useNativeDriver: true,
    })
    animation.start()

    return () => animation.stop()
  }, [opacity, routeKey])

  return <Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View>
}

/**
 * The status bar, following the theme.
 *
 * A child rather than inline so it sits inside `ThemeProvider` and can read it —
 * `App` itself renders the provider and so is outside its own context.
 */
function ThemedStatusBar() {
  const { theme } = useTheme()
  return <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
}
