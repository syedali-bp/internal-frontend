import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import {
  Keyboard,
  Platform,
  ScrollView,
  UIManager,
  findNodeHandle,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type TextInputFocusEventData,
} from 'react-native'

/**
 * Space left between a focused field and the top of the keyboard.
 *
 * Enough that the field clears the keyboard with room to read the line above
 * it: a field scrolled to sit flush against the keyboard is technically visible
 * while still looking like it is about to be covered.
 */
const FIELD_CLEARANCE = 24

/**
 * The part of a focus event this actually uses.
 *
 * Only `target` is read, and RN types `TextInput`'s own `onFocus` more narrowly
 * than `NativeSyntheticEvent<TextInputFocusEventData>` — so asking for the full
 * event would make the handle unusable as an `onFocus` handler for no gain.
 */
export type FocusedInputEvent = Pick<
  NativeSyntheticEvent<TextInputFocusEventData>,
  'target'
>

export type KeyboardAwareScrollHandle = {
  /** Brings a newly focused input clear of the keyboard. */
  scrollInputIntoView: (event: FocusedInputEvent) => void
}

/**
 * A ScrollView that keeps the focused text field above the keyboard.
 *
 * React Native's own tools do not cover this between them:
 * `KeyboardAvoidingView` shrinks or pads its container but never scrolls to
 * anything, and `automaticallyAdjustKeyboardInsets` is iOS-only. So on Android
 * a focused field that starts out behind the keyboard stays there — the bug
 * this fixes.
 *
 * Positions are measured in window coordinates, which is the same frame the
 * keyboard reports its own top edge in, so the two are directly comparable. It
 * also means the maths does not care how the content is laid out or how far it
 * has already been scrolled.
 *
 * `react-native-keyboard-controller` does this and more, but it is a native
 * module — a new dependency and a rebuild — for the one behaviour this screen
 * needs. If it is ever added, this component is what it replaces.
 */
export const KeyboardAwareScroll = forwardRef<KeyboardAwareScrollHandle, ScrollViewProps>(
  function KeyboardAwareScroll({ children, onScroll, contentContainerStyle, ...props }, ref) {
    const scrollRef = useRef<ScrollView>(null)
    /** Top edge of the keyboard in window coordinates; null while it is down. */
    const keyboardTop = useRef<number | null>(null)
    const scrollY = useRef(0)
    /** The focused field, so a keyboard that resizes can re-reveal it. */
    const focusedNode = useRef<number | null>(null)

    // Padding rather than a resizing container: it lets the last field scroll
    // up past where the keyboard sits, and costs nothing when it is down.
    const [bottomInset, setBottomInset] = useState(0)

    /** Scrolls until the given native input sits clear of the keyboard. */
    const revealNode = useCallback((node: number) => {
      const scroll = scrollRef.current
      const limit = keyboardTop.current
      if (!scroll || limit === null) return

      UIManager.measureInWindow(node, (_x, y, _width, height) => {
        const overlap = y + height + FIELD_CLEARANCE - limit
        // Already clear, or above the fold — either way, leave it alone rather
        // than scrolling the form under the collector.
        if (overlap <= 0) return

        scroll.scrollTo({ y: scrollY.current + overlap, animated: true })
      })
    }, [])

    useEffect(() => {
      // `Will` fires before the keyboard animates on iOS, so the scroll moves
      // with it rather than after it. Android only emits `Did`.
      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
      const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

      const shown = Keyboard.addListener(showEvent, (event) => {
        keyboardTop.current = event.endCoordinates.screenY
        setBottomInset(event.endCoordinates.height)

        // Covers both the first focus — where the keyboard height was unknown
        // when the field was tapped — and a keyboard that changes height, as
        // when a suggestion strip appears.
        if (focusedNode.current !== null) revealNode(focusedNode.current)
      })

      const hidden = Keyboard.addListener(hideEvent, () => {
        keyboardTop.current = null
        focusedNode.current = null
        setBottomInset(0)
      })

      return () => {
        shown.remove()
        hidden.remove()
      }
    }, [revealNode])

    useImperativeHandle(ref, () => ({
      scrollInputIntoView: (event) => {
        const node = findNodeHandle(event.target as never)
        if (node === null) return

        focusedNode.current = node

        // Moving between fields with the keyboard already up: reveal now. On
        // first focus the keyboard is still opening, and the show listener
        // handles it once its height is known.
        if (keyboardTop.current !== null) revealNode(node)
      },
    }))

    return (
      <ScrollView
        ref={scrollRef}
        // So a tap on the eye toggle or Sign In lands on the first press
        // instead of being swallowed to dismiss the keyboard.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        onScroll={(event) => {
          scrollY.current = event.nativeEvent.contentOffset.y
          onScroll?.(event)
        }}
        scrollEventThrottle={16}
        // Room to scroll the lowest field above the keyboard. As padding on the
        // content it behaves the same on both platforms, unlike `contentInset`,
        // which is iOS-only.
        contentContainerStyle={[contentContainerStyle, { paddingBottom: bottomInset }]}
        {...props}
      >
        {children}
      </ScrollView>
    )
  },
)
