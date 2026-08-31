import { useRef, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { SafeAreaView as SafeAreaScreen } from 'react-native-safe-area-context'

import { EyeIcon, KeyboardAwareScroll, VentrieLogo } from '../../components'
import type {
  FocusedInputEvent,
  KeyboardAwareScrollHandle,
} from '../../components/KeyboardAwareScroll'
import type { Palette } from '../../theme/colors'
import { makeControls, useColors, useThemedStyles } from '../../theme/useColors'
import { ThemeToggle } from '../../theme/ThemeToggle'
import { AuthField } from './components/AuthField'
import { AuthError, register, validateRegisterInput, type RegisterInput } from './authApi'
import { signInWithSession } from './authSession'

type RegisterScreenProps = {
  /** The company the device is enrolled to, shown above the heading. */
  companyName?: string
  /** Registration signs the collector straight in, so this lands in the app. */
  onRegistered: () => void
  /** Back to the sign-in card. */
  onShowLogin: () => void
}

/** Blank form, and what a cleared error map looks like. */
const EMPTY: RegisterInput = {
  phone: '',
  email: '',
  password: '',
  first_name: '',
  last_name: '',
}

type FieldErrors = Partial<Record<keyof RegisterInput, string>>

/**
 * Where a collector creates their own account.
 *
 * The card, the field styling and the button are the login screen's, so the two
 * read as one surface rather than two screens that happen to be adjacent.
 *
 * Backed by `POST /api/collect/register`, which creates the collector; the
 * account is signed in immediately afterwards by `register` in authApi.ts.
 */
export function RegisterScreen({
  companyName = 'Ventrie Collector',
  onRegistered,
  onShowLogin,
}: RegisterScreenProps) {
  const colors = useColors()
  const s = useThemedStyles(makeStyles)
  const controls = useThemedStyles(makeControls)

  const [form, setForm] = useState<RegisterInput>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const scrollRef = useRef<KeyboardAwareScrollHandle>(null)
  const revealFocused = (event: FocusedInputEvent) =>
    scrollRef.current?.scrollInputIntoView(event)

  /** Editing a field clears its complaint, so the error tracks the current value. */
  const update = (field: keyof RegisterInput) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))
    setFormError(null)
  }

  const canSubmit =
    form.phone.trim().length > 0 &&
    form.password.length > 0 &&
    form.first_name.trim().length > 0 &&
    form.last_name.trim().length > 0 &&
    !isSubmitting

  const submit = async () => {
    if (!canSubmit) return

    // Everything checkable without the server, checked first: a round trip that
    // was never going to succeed is a round trip the collector waits through.
    const problems = validateRegisterInput(form)
    if (problems.length > 0) {
      const next: FieldErrors = {}
      problems.forEach((problem) => {
        next[problem.field] = problem.message
      })
      setErrors(next)
      return
    }

    setErrors({})
    setFormError(null)
    setIsSubmitting(true)

    try {
      // Device info is attached inside register(), not collected here.
      const session = await register(form)

      // Registration is a sign-in: the response carries the same tokens login's
      // does, so there is nothing further for the collector to do.
      signInWithSession(session)
      onRegistered()
    } catch (caught) {
      // A failure the server owns — a phone already taken — belongs on the
      // field it is about, where the collector can act on it.
      if (caught instanceof AuthError && caught.field) {
        setErrors({ [caught.field]: caught.message })
      } else {
        setFormError(caught instanceof Error ? caught.message : 'Could not create the account.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaScreen style={s.screen} edges={['top', 'left', 'right']}>
      <KeyboardAwareScroll ref={scrollRef} contentContainerStyle={s.content}>
        <View style={s.centred}>
          <View style={s.brand}>
            <VentrieLogo size={46} color={colors.primary} />
            <Text style={s.wordmark}>Ventrie</Text>
          </View>

          <View style={s.toggleRow}>
            <ThemeToggle />
          </View>

          <View style={s.card}>
            <Text style={s.eyebrow}>EMPLOYEE REGISTRATION</Text>
            <Text style={s.company}>{companyName}</Text>
            <Text style={s.heading}>Create Account</Text>

            <AuthField label="PHONE NUMBER" required>
              <TextInput
                style={[controls.input, errors.phone ? s.inputInvalid : null]}
                value={form.phone}
                onChangeText={update('phone')}
                onFocus={revealFocused}
                placeholder="+92 300 1234567"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
              />
              {errors.phone ? <Text style={s.fieldError}>{errors.phone}</Text> : null}
            </AuthField>

            <AuthField label="FIRST NAME" required>
              <TextInput
                style={[controls.input, errors.first_name ? s.inputInvalid : null]}
                value={form.first_name}
                onChangeText={update('first_name')}
                onFocus={revealFocused}
                placeholder="First name"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="givenName"
              />
              {errors.first_name ? <Text style={s.fieldError}>{errors.first_name}</Text> : null}
            </AuthField>

            <AuthField label="LAST NAME" required>
              <TextInput
                style={[controls.input, errors.last_name ? s.inputInvalid : null]}
                value={form.last_name}
                onChangeText={update('last_name')}
                onFocus={revealFocused}
                placeholder="Last name"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="familyName"
              />
              {errors.last_name ? <Text style={s.fieldError}>{errors.last_name}</Text> : null}
            </AuthField>

            {/* Required: it is the only way to recover a forgotten password. */}
            <AuthField label="EMAIL" required>
              <TextInput
                style={[controls.input, errors.email ? s.inputInvalid : null]}
                value={form.email}
                onChangeText={update('email')}
                onFocus={revealFocused}
                placeholder="you@company.com"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              {errors.email ? <Text style={s.fieldError}>{errors.email}</Text> : null}
            </AuthField>

            <AuthField label="PASSWORD" required>
              <View style={s.secretRow}>
                <TextInput
                  style={[controls.input, s.secretInput, errors.password ? s.inputInvalid : null]}
                  value={form.password}
                  onChangeText={update('password')}
                  onFocus={revealFocused}
                  placeholder="Choose a password"
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry={!isPasswordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
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
              {errors.password ? <Text style={s.fieldError}>{errors.password}</Text> : null}
            </AuthField>

            {formError ? <Text style={s.error}>{formError}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSubmit, busy: isSubmitting }}
              disabled={!canSubmit}
              onPress={submit}
              style={[s.signInButton, !canSubmit && s.signInButtonDisabled]}
            >
              <Text style={s.signInText}>
                {isSubmitting ? 'Creating Account…' : 'Create Account'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting}
              hitSlop={8}
              onPress={onShowLogin}
              style={s.switchRow}
            >
              <Text style={s.switchText}>
                Already have an account? <Text style={s.switchAction}>Sign In</Text>
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
  inputInvalid: { borderColor: colors.dangerBorder },
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
  fieldError: { color: colors.dangerText, fontSize: 12, marginTop: 6 },
  switchRow: { alignItems: 'center', marginTop: 18 },
  switchText: { color: colors.textMuted, fontSize: 13 },
  switchAction: { color: colors.accent, fontWeight: '800' },
  toggleRow: { alignItems: 'center', marginBottom: 18, marginTop: -10 },
  }) as const
