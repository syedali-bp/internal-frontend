import Constants from 'expo-constants'
import * as Device from 'expo-device'

import * as api from '../../api/api'
import { getRefreshToken, setTokens, signOut } from './authSession'
import { saveLastPhone } from './authStorage'

/**
 * Sign-in and sign-up against the collector auth surface.
 *
 * Both call the real backend. The mobile surface is mounted at `/api/collect/*`,
 * separately from the staff `/api/catalog/*` routes, and issues its own token —
 * a collector token is refused by staff middleware and vice versa.
 */

const LOGIN_URL = '/api/collect/login'
const REGISTER_URL = '/api/collect/register'
const REFRESH_URL = '/api/collect/refresh'
const LOGOUT_URL = '/api/collect/logout'
const RESET_REQUEST_URL = '/api/collect/password-reset/request'
const RESET_VERIFY_URL = '/api/collect/password-reset/verify'

/**
 * `models.Collector` as the backend serialises it, trimmed to what this app
 * reads. `password_hash` is `json:"-"` server-side and never arrives.
 */
export type Collector = {
  id: string
  phone: string
  /** Nullable server-side: many collectors have no mailbox. */
  email: string | null
  first_name: string
  last_name: string
  assigned_verticals: string[] | null
  assigned_region: string
  status: string
}

/**
 * What `POST /collect/login` and `POST /collect/refresh` both answer with —
 * `CollectorAuthResponse` in collector_auth.go.
 *
 * Note this is NOT wrapped in `{ data }`, unlike the rest of the API: the
 * controller returns the struct directly, which is why these calls go through
 * `postJsonRaw` rather than `postJson`.
 */
export type AuthSession = {
  access_token: string
  refresh_token: string
  /** Seconds until `access_token` expires. */
  expires_in: number
  collector: Collector
}

/** What the register form collects. Device info is added by `register`. */
export type RegisterInput = {
  phone: string
  /** Required: the address a password reset code is sent to. */
  email: string
  password: string
  first_name: string
  last_name: string
}

/**
 * The handset, as `models.Collector.DeviceInfo` (`json:"device_info"`).
 *
 * Never asked for and never shown: it describes the device, not the person, so
 * the registration form has no control for it. `currentDeviceInfo` reads it off
 * the platform and `register` attaches it to the payload.
 *
 * Three keys, matching the catalog_collectors schema exactly:
 *
 *   { "app_version": "1.0.0", "device_model": "Pixel 7 Pro", "os": "Android 14" }
 *
 * Note `os` is one field — name and version joined — rather than the two the
 * underlying APIs return separately. `DeviceInfo` is a free-form JSONMap
 * server-side with no Go struct pinning the names, so nothing would reject a
 * different shape; it would just quietly land in the column as something triage
 * queries do not match. Keep these keys stable for the same reason.
 *
 * Every value is nullable because the source can genuinely not answer:
 * `modelName` is null on web and on some Android builds, `osName` can come back
 * as a build fingerprint rather than a name, and `expoConfig` is null when the
 * manifest is unavailable. A null is honest; a made-up default would corrupt
 * exactly the triage this exists for.
 */
export type DeviceInfo = {
  app_version: string | null
  device_model: string | null
  /** Name and version as one string, e.g. "Android 14". */
  os: string | null
}

/**
 * The running device, read straight off the modules — these are constants, not
 * async lookups, so there is nothing to await and nothing to fail.
 */
export function currentDeviceInfo(): DeviceInfo {
  return {
    // `app.json`'s `expo.version`. This is the JS/OTA version, which after an
    // over-the-air update is the one that matters for triage — it can differ
    // from the version compiled into the binary.
    app_version: Constants.expoConfig?.version ?? null,
    device_model: Device.modelName,
    os: formatOs(Device.osName, Device.osVersion),
  }
}

/**
 * Joins OS name and version into the single `os` the schema asks for.
 *
 * Either half can be missing, and half an answer still helps triage: "Android"
 * with no version narrows a bug report, where dropping to null loses it. Only a
 * device that reports neither gives null.
 */
function formatOs(name: string | null, version: string | null): string | null {
  const parts = [name, version].filter((part): part is string => !!part?.trim())
  return parts.length > 0 ? parts.join(' ') : null
}

/**
 * Minimum password length.
 *
 * A PLACEHOLDER, not a rule read off the server. The backend hashes whatever it
 * is given and states no length anywhere, so this only stops the most obvious
 * typo. Confirm the real policy before relying on it — if the server is
 * stricter, a password accepted here is rejected there, which reads to the
 * collector as the app lying to them.
 */
export const MIN_PASSWORD_LENGTH = 8

/** Which field a validation failure belongs to, so the screen can place it. */
export type AuthFieldError = { field: keyof RegisterInput; message: string }

export class AuthError extends Error {
  readonly field?: keyof RegisterInput

  constructor(message: string, field?: keyof RegisterInput) {
    super(message)
    this.name = 'AuthError'
    this.field = field
  }
}

/** Digits only, so "+92 300 1234567" and "+923001234567" are one number. */
function normalisePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '')
}

/**
 * Good enough to catch a typo, deliberately not RFC 5322. Anything stricter
 * rejects addresses that are actually valid.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Checks the form before anything is sent. Returns every problem found. */
export function validateRegisterInput(input: RegisterInput): AuthFieldError[] {
  const errors: AuthFieldError[] = []

  if (!input.phone.trim()) {
    errors.push({ field: 'phone', message: 'Phone number is required.' })
  }

  if (!input.first_name.trim()) {
    errors.push({ field: 'first_name', message: 'First name is required.' })
  }

  if (!input.last_name.trim()) {
    errors.push({ field: 'last_name', message: 'Last name is required.' })
  }

  if (input.password.length < MIN_PASSWORD_LENGTH) {
    errors.push({
      field: 'password',
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    })
  }

  // Required: it is the only way to recover a forgotten password, so an account
  // without one can never be reset. A typo has the same effect, which is why the
  // shape is checked rather than just the presence.
  if (!input.email.trim()) {
    errors.push({ field: 'email', message: 'Email is required to reset your password later.' })
  } else if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.push({ field: 'email', message: 'Enter a valid email address.' })
  }

  return errors
}

/**
 * Turns a failed call into a message the form can place on a field.
 *
 * The backend answers `{ "error": "..." }`, and `request` puts that whole body
 * into the thrown Error's message. The duplicate-phone case is the only one the
 * form can point at a specific control, so it is the only one matched here.
 */
function toAuthError(caught: unknown): AuthError {
  const raw = caught instanceof Error ? caught.message : String(caught)

  if (/already exists/i.test(raw)) {
    return new AuthError('An account with this phone number already exists.', 'phone')
  }

  if (/invalid credentials/i.test(raw)) {
    return new AuthError('That phone number and password do not match.')
  }

  // Rate limited. The server answers this one honestly — a collector waiting on
  // a code needs to know to stop asking rather than keep pressing send.
  if (/^Request failed 429/.test(raw) || /too many/i.test(raw)) {
    return new AuthError(
      'Too many reset requests for that address. Wait an hour and try again.',
    )
  }

  // One generic failure covering a wrong code, an expired one, an address with
  // no account, and a code retired by too many wrong guesses. The server does
  // not distinguish them on purpose, so the app explains all four rather than
  // guessing which happened.
  if (/invalid or expired code/i.test(raw)) {
    return new AuthError(
      'That code is not valid. It may have expired (codes last 10 minutes), ' +
        'already been used, or been entered incorrectly too many times. ' +
        'Request a new one.',
    )
  }

  // Anything else — unreachable server, 500, a validation message the form has
  // no field for — is shown as-is rather than flattened into "sign-in failed",
  // which would hide the one detail that explains it.
  const detail = raw.replace(/^Request failed \d+:\s*/, '')
  try {
    const parsed = JSON.parse(detail)
    if (parsed?.error) return new AuthError(String(parsed.error))
  } catch {
    // Not JSON — a network message. Pass it through whole.
  }

  return new AuthError(detail || 'Could not reach the server.')
}

/**
 * Registers a collector and signs them in.
 *
 * `POST /api/collect/register` creates the row; it does not return tokens, so
 * this logs in immediately afterwards with the same credentials to obtain a
 * session. Two round trips rather than one, which is the cost of registration
 * being a plain create on the server.
 */
export async function register(input: RegisterInput): Promise<AuthSession> {
  const problems = validateRegisterInput(input)
  if (problems.length > 0) {
    // The screen validates before calling, so reaching here means a caller
    // skipped it. Report the first problem against its own field.
    throw new AuthError(problems[0].message, problems[0].field)
  }

  const phone = normalisePhone(input.phone)
  const email = input.email.trim()

  try {
    await api.postJsonRaw(REGISTER_URL, {
      phone,
      email: email || '',
      password: input.password,
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      // Collected without asking: it describes the handset, not the person, and
      // a field the collector types is a field they can get wrong.
      device_info: currentDeviceInfo(),
    })
  } catch (caught) {
    throw toAuthError(caught)
  }

  return login(phone, input.password)
}

/** Signs an existing collector in. Phone is the login, not email. */
export async function login(phone: string, password: string): Promise<AuthSession> {
  const normalised = normalisePhone(phone)

  try {
    const session = await api.postJsonRaw<AuthSession>(LOGIN_URL, {
      phone: normalised,
      password,
    })

    // Remembered only once the server has accepted it, so a typo is never the
    // number offered back. Stored in the normalised form the server saw, which
    // is also the form that will work when it is submitted again.
    void saveLastPhone(normalised)

    return session
  } catch (caught) {
    throw toAuthError(caught)
  }
}

/** Exchanges a refresh token for a new pair. The server rotates both. */
export async function refresh(refreshToken: string): Promise<AuthSession> {
  return api.postJsonRaw<AuthSession>(REFRESH_URL, { refresh_token: refreshToken })
}

/**
 * Teaches the request helper how to recover from an expired access token.
 *
 * Called once on launch. Registered as a callback rather than imported by
 * api.ts directly, because this module already imports that one.
 *
 * A refresh that fails is terminal: the refresh token is expired, revoked, or
 * already rotated, and none of those are recoverable without the collector's
 * password. Signing out here is what turns that into a login screen rather than
 * an app that keeps retrying against credentials it no longer has.
 */
export function installTokenRefresher() {
  api.setTokenRefresher(async () => {
    const current = getRefreshToken()
    if (!current) return false

    try {
      const session = await refresh(current)
      setTokens({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      })
      return true
    } catch {
      signOut()
      return false
    }
  })
}

/**
 * Revokes the refresh token server-side.
 *
 * Best-effort: the local session is cleared either way, so a logout with no
 * connection still signs the collector out on this device.
 */
export async function logout(refreshToken: string | null): Promise<void> {
  if (!refreshToken) return

  try {
    await api.postJsonRaw(LOGOUT_URL, { refresh_token: refreshToken })
  } catch {
    // Nothing to recover: the token is being discarded locally regardless.
  }
}

/**
 * Asks for a reset code to be emailed.
 *
 * Answers the same way whether or not the address has an account — the server
 * will not say which, so neither can this. A 429 (too many requests) is the one
 * failure it reports honestly, and toAuthError passes the message through.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await api.postJsonRaw(RESET_REQUEST_URL, { email: email.trim().toLowerCase() })
  } catch (caught) {
    throw toAuthError(caught)
  }
}

/**
 * Sets a new password using the emailed code.
 *
 * Every server-side failure is one generic "invalid or expired code", by
 * design: a wrong code, an expired one and an unregistered address are not
 * distinguished, because the difference would reveal who has an account.
 */
export async function verifyPasswordReset(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  try {
    await api.postJsonRaw(RESET_VERIFY_URL, {
      email: email.trim().toLowerCase(),
      code: code.trim(),
      new_password: newPassword,
    })
  } catch (caught) {
    throw toAuthError(caught)
  }
}

export { LOGIN_URL, LOGOUT_URL, REFRESH_URL, REGISTER_URL, RESET_REQUEST_URL, RESET_VERIFY_URL }
