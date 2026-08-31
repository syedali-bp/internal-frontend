import type { MediaKind } from '../../types/catalog'

/**
 * One attachment the collector has picked. The file lives only on the device,
 * so `uri` is a local path rather than a remote URL.
 */
export type MediaItem = {
  /** Id for this list only, assigned when the file is added. */
  id: string
  /**
   * The variant this file is of, by that variant's device-local id.
   *
   * Undefined means it describes the product as a whole — a shelf shot, a
   * manual — rather than one pack. The server treats absence the same way, so a
   * file captured outside any variant section stays product-level, which is what
   * keeps a product thumbnail possible.
   *
   * The variant's own `id` is used rather than a server id because the variant
   * does not exist server-side until review merges the capture.
   */
  variantId?: string
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

/**
 * One file as picked on the device, plus what Cloudinary made of it.
 *
 * `uploaded` is filled in by the submit step; it is absent while the file is
 * only on the device, which is what the server reads as upload_status pending.
 */
export type UploadedFields = {
  storage_key: string
  public_url: string
  file_size: number
  width: number
  height: number
  content_hash: string
}

const NOT_UPLOADED: UploadedFields = {
  storage_key: '',
  public_url: '',
  file_size: 0,
  width: 0,
  height: 0,
  content_hash: '',
}

/**
 * The media rows as the submission carries them.
 *
 * `local_uri` is kept even once the file is in Cloudinary: it is the record of
 * where the capture came from, and the only thing left to retry against if an
 * upload has to be repeated.
 */
export function serializeMedia(
  items: readonly MediaItem[],
  uploaded?: ReadonlyMap<string, UploadedFields>,
) {
  return items.map((item) => ({
    kind: item.kind,
    // Omitted rather than sent empty when the file is product-level: the server
    // distinguishes "named no variant" from "named an empty one".
    ...(item.variantId ? { variant_client_id: item.variantId } : {}),
    file_name: item.name,
    mime_type: item.mimeType,
    local_uri: item.uri,
    ...(uploaded?.get(item.id) ?? NOT_UPLOADED),
  }))
}
