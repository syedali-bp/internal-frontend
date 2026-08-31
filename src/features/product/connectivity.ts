import { AppState } from 'react-native'

/**
 * Whether the backend is reachable.
 *
 * There is deliberately no netinfo here: it is not a dependency of this project,
 * and it answers a different question anyway — a phone on a captive-portal wifi
 * reports itself connected while every request to our host fails. What the queue
 * needs to know is whether *this backend* answers, which is exactly what an
 * attempted send already tells us.
 *
 * So reachability is inferred from outcomes rather than polled: a send that
 * succeeds means online, one that fails to reach the host means offline. The
 * retry triggers are the two moments a dropped connection tends to have come
 * back — the app returning to the foreground, and a fresh capture being filed.
 *
 * If netinfo is added later, `setReachable` is the seam: subscribe to it and
 * call this, and everything downstream keeps working unchanged.
 */

let reachable = true

const listeners = new Set<(reachable: boolean) => void>()

export function isReachable() {
  return reachable
}

/** Records what a request outcome just proved about the connection. */
export function setReachable(next: boolean) {
  if (next === reachable) return
  reachable = next
  listeners.forEach((listener) => listener(next))
}

export function subscribeToReachability(listener: (reachable: boolean) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Calls back when the app returns to the foreground.
 *
 * A connection that dropped in a stockroom is usually back by the time the
 * collector looks at the phone again, and that is the cheapest signal available
 * without polling the network or adding a dependency.
 */
export function subscribeToForeground(onForeground: () => void) {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') onForeground()
  })

  return () => subscription.remove()
}
