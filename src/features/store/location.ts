/**
 * Where the device is, when it will say.
 *
 * `expo-location` is not a dependency of this project, so nothing here can read
 * a real position yet and every caller gets null — which is exactly what the
 * schema expects when a fix is unavailable: `latitude` and `longitude` on
 * `catalog_stores`, and `start_latitude` / `start_longitude` on
 * `catalog_collection_sessions`, are all nullable.
 *
 * This exists as a seam rather than as an inline `null` so adding GPS later is
 * one file. To wire it up:
 *
 *   1. `npx expo install expo-location`, then rebuild — it is a native module,
 *      so a Metro reload will not pick it up.
 *   2. Replace the body of `capturePosition` with a permission request and a
 *      `getCurrentPositionAsync` call.
 *
 * Nothing else changes: callers already treat a null as "not captured" rather
 * than as a failure, and neither store creation nor starting a session is
 * blocked by it.
 */

export type Position = {
  latitude: number
  longitude: number
}

/**
 * The device's position, or null when there is none to be had.
 *
 * Deliberately never rejects. A missing fix is an ordinary outcome — a denied
 * permission, indoors with no signal, location switched off — and none of them
 * should cost the collector the store they are trying to add.
 */
export async function capturePosition(): Promise<Position | null> {
  return null
}

/** Whether a real position can be captured at all, for anything that explains itself. */
export const IS_LOCATION_AVAILABLE = false
