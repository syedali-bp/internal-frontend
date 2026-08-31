import * as SecureStore from 'expo-secure-store'

import type { Collector, Tokens } from './authSession'

/**
 * Where the signed-in collector's tokens survive an app restart.
 *
 * SecureStore rather than AsyncStorage: these are bearer credentials, and
 * AsyncStorage keeps its values as plaintext in app-private storage — readable
 * from a rooted handset or a device backup. SecureStore hands them to the
 * Android Keystore / iOS Keychain instead, which is the difference between a
 * stolen phone costing a re-login and costing an account.
 *
 * It is a native module, so it only works in a build that includes it: after
 * adding the package the app needs `expo prebuild` and a fresh `run:android`.
 * Every call here is wrapped, because a device with no keystore available (and
 * Expo Go before that rebuild) throws rather than returning empty — and failing
 * to *persist* a session must never stop a collector from *having* one.
 */

/** One key, because the collector and the tokens have to be written together. */
const KEY = 'ventrie.collector.session'

/**
 * What gets written. The collector is stored alongside the tokens so a relaunch
 * can restore the identity screens read without waiting on a network call —
 * `/me` confirms it, but the app is usable before that answers.
 */
type StoredSession = {
  collector: Collector
  tokens: Tokens
}

export async function saveSession(collector: Collector, tokens: Tokens): Promise<void> {
  try {
    const payload: StoredSession = { collector, tokens }
    await SecureStore.setItemAsync(KEY, JSON.stringify(payload))
  } catch {
    // The session still works for this run; it just will not outlive it.
  }
}

/** The stored session, or null if there is none or it cannot be read. */
export async function loadSession(): Promise<StoredSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as StoredSession

    // A partial write, or a shape from an older build, is treated as no session
    // rather than restored into something half-authenticated.
    if (!parsed?.tokens?.access_token || !parsed?.tokens?.refresh_token || !parsed?.collector?.id) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY)
  } catch {
    // Nothing to do: the in-memory session is cleared by the caller regardless.
  }
}
