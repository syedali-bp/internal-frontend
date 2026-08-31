import { useRef, useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { SafeAreaView as SafeAreaScreen } from 'react-native-safe-area-context'

import { EyeIcon, KeyboardAwareScroll, VentrieLogo } from '../../components'
import type { KeyboardAwareScrollHandle } from '../../components/KeyboardAwareScroll'
import type { Palette } from '../../theme/colors'
import { makeControls, useColors, useThemedStyles } from '../../theme/useColors'
import { ThemeToggle } from '../../theme/ThemeToggle'
import { AuthField } from './components/AuthField'
import { AuthError, MIN_PASSWORD_LENGTH, requestPasswordReset, verifyPasswordReset } from './authApi'

type ForgotPasswordScreenProps = {
  companyName?: string
  /** Back to sign-in, both from the link and after a successful reset. */
  onDone: () => void
}

/**
 * Password recovery by emailed code.
 *
 * Two steps on one screen rather than two screens: the second step needs the
 * address from the first, and keeping them together means a collector who
 * mistypes it can correct it without losing the code they were sent.
 *
 * Recovery is by email, not phone — a collector who has forgotten their
 * password still has their mailbox, and the server sends the code there.
 */
export function ForgotPasswordScreen({
  companyName = 'Ventrie Collector',
  onDone,
}: ForgotPasswordScreenProps) {
  const colors = useColors()
  const s = useThemedStyles(makeStyles)
  const controls = useThemedStyles(makeControls)

  // 'request' asks for the code; 'verify' takes the code and the new password.
  const [step, setStep] = useState<'request' | 'verify'>('request')

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const scrollRef = useRef<KeyboardAwareScrollHandle>(null)

  const canRequest = email.trim().length > 0 && !isSubmitting
  const canVerify =
    code.trim().length > 0 && password.length >= MIN_PASSWORD_LENGTH && !isSubmitting

  const submitRequest = async () => {
    if (!canRequest) return

    setError(null)
    setIsSubmitting(true)

    try {
      await requestPasswordReset(email)

      // Deliberately not "we sent you a code": the server answers the same way
      // for an address with no account, and claiming delivery would tell an
      // attacker which addresses are registered.
      setNotice('If that address has an account, a reset code is on its way.')
      setStep('verify')
    } catch (caught) {
      setError(caught instanceof AuthError ? caught.message : String(caught))
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitVerify = async () => {
    if (!canVerify) return

    setError(null)
    setIsSubmitting(true)

    try {
      await verifyPasswordReset(email, code, password)
      onDone()
    } catch (caught) {
      setError(caught instanceof AuthError ? caught.message : String(caught))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaScreen style={s.screen} edges={['top', 'left', 'right']}>
      <KeyboardAwareScroll ref={scrollRef} contentContainerStyle={s.content}>
        <View style={s.toggleRow}>
          <ThemeToggle />
        </View>

        <View style={s.centred}>
          <View style={s.brand}>
            <VentrieLogo size={46} color={colors.primary} />
            <Text style={s.wordmark}>Ventrie</Text>
          </View>

          <View style={s.card}>
            <Text style={s.eyebrow}>PASSWORD RESET</Text>
            <Text style={s.company}>{companyName}</Text>
            <Text style={s.heading}>
              {step === 'request' ? 'Forgot Password' : 'Enter Your Code'}
            </Text>

            <Text style={s.blurb}>
              {step === 'request'
                ? 'Enter the email address on your account and we will send you a reset code.'
                : 'Enter the code from the email, then choose a new password. Codes last 10 minutes.'}
            </Text>

            {/* Accounts created before an email was required have nowhere to
                receive a code, and no amount of retrying changes that. Saying so
                here is the difference between a short call to an admin and a
                collector locked out with no idea why. */}
            <Text style={s.hint}>
              No email on your account? An administrator has to reset it for you.
            </Text>

            <AuthField label="EMAIL" required>
              <TextInput
                style={controls.input}
                value={email}
                onChangeText={setEmail}
                // Editable in step two as well: a mistyped address is the most
                // likely reason no code arrived, and locking the field would
                // force a restart to fix it.
                placeholder="you@company.com"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
            </AuthField>

            {step === 'verify' ? (
              <>
                <AuthField label="RESET CODE" required>
                  <TextInput
                    style={controls.input}
                    value={code}
                    onChangeText={setCode}
                    placeholder="6-digit code"
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="number-pad"
                    maxLength={6}
                    textContentType="oneTimeCode"
                  />
                </AuthField>

                <AuthField label="NEW PASSWORD" required>
                  <View style={s.secretRow}>
                    <TextInput
                      style={[controls.input, s.secretInput]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
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
                </AuthField>
              </>
            ) : null}

            {notice ? <Text style={s.notice}>{notice}</Text> : null}
            {error ? <Text style={s.error}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: step === 'request' ? !canRequest : !canVerify }}
              disabled={step === 'request' ? !canRequest : !canVerify}
              onPress={step === 'request' ? submitRequest : submitVerify}
              style={[
                s.signInButton,
                (step === 'request' ? !canRequest : !canVerify) && s.signInButtonDisabled,
              ]}
            >
              <Text style={s.signInText}>
                {isSubmitting
                  ? 'Working…'
                  : step === 'request'
                    ? 'Send Reset Code'
                    : 'Set New Password'}
              </Text>
            </Pressable>

            {step === 'verify' ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  // Back to step one to re-send. The code already issued stays
                  // valid until the server replaces it, so nothing is lost.
                  setStep('request')
                  setCode('')
                  setError(null)
                  setNotice(null)
                }}
                style={s.switchRow}
              >
                <Text style={s.switchText}>
                  Didn't get a code? <Text style={s.switchAction}>Send again</Text>
                </Text>
              </Pressable>
            ) : null}

            <Pressable accessibilityRole="button" hitSlop={8} onPress={onDone} style={s.switchRow}>
              <Text style={s.switchText}>
                Remembered it? <Text style={s.switchAction}>Sign in</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScroll>
    </SafeAreaScreen>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  ({
    screen: { backgroundColor: colors.screen, flex: 1 },
    content: { flexGrow: 1, padding: 24 },
    toggleRow: { alignItems: 'flex-end' },
    centred: { flex: 1, justifyContent: 'center' },
    brand: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center' },
    wordmark: { color: colors.text, fontSize: 26, fontWeight: '800' },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      marginTop: 24,
      padding: 22,
    },
    eyebrow: { color: colors.eyebrow, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
    company: { color: colors.textMuted, fontSize: 13, marginTop: 6 },
    heading: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: 10 },
    blurb: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 6, marginTop: 8 },
    hint: { color: colors.textSubtle, fontSize: 12, lineHeight: 17, marginBottom: 4 },
    secretRow: { justifyContent: 'center' },
    secretInput: { paddingRight: 44 },
    reveal: { position: 'absolute', right: 12 },
    notice: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: 12 },
    error: { color: colors.danger, fontSize: 13, lineHeight: 19, marginTop: 12 },
    signInButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 10,
      marginTop: 18,
      paddingVertical: 14,
    },
    signInButtonDisabled: { opacity: 0.45 },
    signInText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
    switchRow: { alignItems: 'center', marginTop: 16 },
    switchText: { color: colors.textMuted, fontSize: 13 },
    switchAction: { color: colors.primary, fontWeight: '800' },
  }) as const
