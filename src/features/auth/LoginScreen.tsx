import { useRef, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { SafeAreaView as SafeAreaScreen } from 'react-native-safe-area-context'

import { EyeIcon, KeyboardAwareScroll, VentrieLogo } from '../../components'
import type { KeyboardAwareScrollHandle } from '../../components/KeyboardAwareScroll'
import type { Palette } from '../../theme/colors'
import { makeControls, useColors, useThemedStyles } from '../../theme/useColors'
import { ThemeToggle } from '../../theme/ThemeToggle'
import { AuthField } from './components/AuthField'
import { login, AuthError } from './authApi'
import { signInWithSession } from './authSession'

type LoginScreenProps = {
  /** The company the device is enrolled to, shown above the heading. */
  companyName?: string
  /** Called once the server has accepted the credentials and issued a token. */
  onSignIn: () => void
  /** Switches to the registration card. */
  onShowRegister: () => void
  /** Switches to the emailed-code password reset flow. */
  onForgotPassword: () => void
}

/**
 * Where a collector identifies themselves before capturing anything.
 */
export function LoginScreen({
  companyName = 'Ventrie Collector',
  onSignIn,
  onShowRegister,
  onForgotPassword,
}: LoginScreenProps) {
  const colors = useColors()
  const s = useThemedStyles(makeStyles)
  const controls = useThemedStyles(makeControls)

  // Phone, not email: the backend logs a collector in by phone number, which is
  // what field staff reliably have.
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Every field on the form shares this: whichever one is focused gets scrolled
  // clear of the keyboard, so the fix is not specific to the password.
  const scrollRef = useRef<KeyboardAwareScrollHandle>(null)
  const revealFocused = (event: Parameters<
    NonNullable<KeyboardAwareScrollHandle['scrollInputIntoView']>
  >[0]) => scrollRef.current?.scrollInputIntoView(event)

  const canSubmit = phone.trim().length > 0 && password.length > 0 && !isSubmitting

  const submit = async () => {
    if (!canSubmit) return

    setError(null)
    setIsSubmitting(true)

    try {
      const session = await login(phone, password)

      // Holds the collector and both tokens for the rest of the app: sessions
      // and any store they add are attributed to this id, and every
      // authenticated request reads the access token back out.
      signInWithSession(session)

      onSignIn()
    } catch (caught) {
      setError(caught instanceof AuthError ? caught.message : String(caught))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaScreen style={s.screen} edges={['top', 'left', 'right']}>
      {/* Scrolls whichever field is focused above the keyboard. It replaces a
          KeyboardAvoidingView + ScrollView pair, which padded the container but
          never scrolled, so a field behind the keyboard stayed there. */}
      <KeyboardAwareScroll ref={scrollRef} contentContainerStyle={s.content}>
        {/* Pinned to the top-right corner, clear of the centred card. Sits
            outside `centred` so the card's vertical centring cannot move it,
            and above it in the tree so it stays tappable. */}
        <View style={s.toggleRow}>
          <ThemeToggle />
        </View>

        <View style={s.centred}>
          <View style={s.brand}>
            <VentrieLogo size={46} color={colors.primary} />
            <Text style={s.wordmark}>Ventrie</Text>
          </View>

          <View style={s.card}>
            <Text style={s.eyebrow}>EMPLOYEE LOGIN</Text>
            <Text style={s.company}>{companyName}</Text>
            <Text style={s.heading}>Sign In</Text>

            <AuthField label="PHONE" required>
              <TextInput
                style={controls.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="03001234567"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
              />
            </AuthField>

            <AuthField label="EMPLOYEE PASSWORD" required>
              <View style={s.secretRow}>
                <TextInput
                  style={[controls.input, s.secretInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!isPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={isPasswordVisible ? 'Hide password' : 'Show password'}
                  hitSlop={10}
                  onPress={() => setIsPasswordVisible((visible) => !visible)}
                  style={s.reveal}
                >
                  <EyeIcon off={!isPasswordVisible} size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            </AuthField>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit }}
              disabled={!canSubmit}
              onPress={submit}
              style={[s.signInButton, !canSubmit && s.signInButtonDisabled]}
            >
              <Text style={s.signInText}>{isSubmitting ? 'Signing in…' : 'Sign In'}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={onForgotPassword}
              style={s.switchRow}
            >
              <Text style={s.switchAction}>Forgot password?</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={onShowRegister}
              style={s.switchRow}
            >
              <Text style={s.switchText}>
                Don't have an account? <Text style={s.switchAction}>Register</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScroll>
    </SafeAreaScreen>
  )
}

/**
 * Built from the palette rather than imported, so the toggle repaints it.
 * Module scope keeps the reference stable for `useThemedStyles`.
 */
const makeStyles = (colors: Palette) =>
  ({
  screen: { backgroundColor: colors.screen, flex: 1 },
  // `justifyContent: center` would fight the keyboard: Android resizes the
  // window when it opens, and centring re-centres the card in the smaller space,
  // pushing the field it was meant to reveal back underneath. Centring by
  // margin instead only applies while there is room to spare, and collapses to
  // a normal scroll once the keyboard leaves none.
  content: { flexGrow: 1, padding: 20 },
  centred: { marginVertical: 'auto' },
  brand: { alignItems: 'center', gap: 12, marginBottom: 28 },
  wordmark: { color: colors.text, fontSize: 25, fontWeight: '800', letterSpacing: 0.5 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
  },
  eyebrow: { color: colors.eyebrow, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  company: { color: colors.textMuted, fontSize: 14, fontWeight: '600', marginTop: 8 },
  heading: { color: colors.text, fontSize: 30, fontWeight: '800', marginBottom: 22, marginTop: 6 },
  secretRow: { justifyContent: 'center' },
  secretInput: { paddingRight: 46 },
  reveal: { position: 'absolute', right: 12 },
  signInButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 10,
    marginTop: 24,
    paddingVertical: 15,
  },
  signInButtonDisabled: { opacity: 0.45 },
  signInText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  error: { color: colors.dangerText, fontSize: 13, marginTop: 16 },
  switchRow: { alignItems: 'center', marginTop: 18 },
  switchText: { color: colors.textMuted, fontSize: 13 },
  switchAction: { color: colors.accent, fontWeight: '800' },
  toggleRow: { alignItems: 'flex-end' },
  }) as const
