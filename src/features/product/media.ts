import type { MediaKind } from '../../types/catalog'

/**
 * One attachment the collector has picked. The file lives only on the device,
 * so `uri` is a local path rather than a remote URL.
 */
export type MediaItem = {
  /** Id for this list only, assigned when the file is added. */
  id: string
  kind: MediaKind
  uri: string
  name: string
  mimeType: string
}

type MediaKindOption = {
  kind: MediaKind
  label: string
  /** Documents open a file picker; photos open the camera or the gallery. */
  isDocument: boolean
}

/** Every kind an attachment can be, in the order the dropdown shows them. */
export const MEDIA_KIND_OPTIONS: readonly MediaKindOption[] = [
  { kind: 'photo_front', label: 'Front of pack', isDocument: false },
  { kind: 'photo_back', label: 'Back of pack', isDocument: false },
  { kind: 'photo_side', label: 'Side of pack', isDocument: false },
  { kind: 'photo_label', label: 'Label', isDocument: false },
  { kind: 'photo_nutrition', label: 'Nutrition panel', isDocument: false },
  { kind: 'photo_barcode', label: 'Barcode', isDocument: false },
  { kind: 'photo_packaging', label: 'Packaging', isDocument: false },
  { kind: 'photo_in_store', label: 'In store', isDocument: false },
  { kind: 'manual_pdf', label: 'Manual (PDF)', isDocument: true },
  { kind: 'other', label: 'Other file', isDocument: true },
]

export const DEFAULT_MEDIA_KIND: MediaKind = 'photo_front'

export function findMediaKindOption(kind: MediaKind) {
  return MEDIA_KIND_OPTIONS.find((option) => option.kind === kind)
}

/** Whether this kind is picked from the filesystem rather than the camera. */
export function isDocumentKind(kind: MediaKind) {
  return findMediaKindOption(kind)?.isDocument ?? false
}

export function mediaKindLabel(kind: MediaKind) {
  return findMediaKindOption(kind)?.label ?? kind
}

/** Falls back to the last path segment when a picker gives no file name. */
export function fileNameFromUri(uri: string, fallback: string) {
  const segment = uri.split('?')[0].split('/').pop()
  return segment && segment.length > 0 ? decodeURIComponent(segment) : fallback
}

/** The media rows as the submission carries them; `local_uri` is the device path. */
export function serializeMedia(items: readonly MediaItem[]) {
  return items.map((item) => ({
    kind: item.kind,
    file_name: item.name,
    mime_type: item.mimeType,
    local_uri: item.uri,
  }))
}
