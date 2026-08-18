/**
 * A device-generated id for one captured submission. It stays the same for the
 * whole capture, so filing it twice updates the entry instead of duplicating it.
 *
 * RFC 4122 v4 shape. `crypto.randomUUID` is used when the runtime has it and a
 * Math.random fallback otherwise — collision odds are irrelevant at the volume
 * one collector produces, and nothing reads meaning out of the id.
 */
export function createClientId(): string {
  const runtimeCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (typeof runtimeCrypto?.randomUUID === 'function') return runtimeCrypto.randomUUID()

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (marker) => {
    const random = (Math.random() * 16) | 0
    const value = marker === 'x' ? random : (random & 0x3) | 0x8
    return value.toString(16)
  })
}
