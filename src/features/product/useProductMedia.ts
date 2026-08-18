import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import { useCallback, useState } from 'react'
import { Alert } from 'react-native'

import type { MediaKind } from '../../types/catalog'
import {
  DEFAULT_MEDIA_KIND,
  fileNameFromUri,
  isDocumentKind,
  mediaKindLabel,
  type MediaItem,
} from './media'

let nextMediaId = 1

/**
 * The product's attachments: pick a kind, then add a file for it.
 *
 * Photo kinds offer the camera or the gallery; `manual_pdf` and `other` open a
 * document picker instead, since neither is something you photograph.
 */
export function useProductMedia() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [kind, setKind] = useState<MediaKind>(DEFAULT_MEDIA_KIND)
  const [error, setError] = useState<string | null>(null)

  const append = useCallback(
    (item: Omit<MediaItem, 'id'>) => {
      setItems((prev) => [...prev, { ...item, id: String(nextMediaId++) }])
      setError(null)
    },
    [],
  )

  /** Camera and gallery return the same shape, so one handler covers both. */
  const addFromImagePicker = useCallback(
    async (source: 'camera' | 'library') => {
      try {
        const permission =
          source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync()

        if (!permission.granted) {
          setError(
            source === 'camera'
              ? 'Camera permission is needed to take a photo.'
              : 'Photo library permission is needed to choose a photo.',
          )
          return
        }

        const options: ImagePicker.ImagePickerOptions = { quality: 0.8 }
        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync(options)
            : await ImagePicker.launchImageLibraryAsync({ ...options, mediaTypes: ['images'] })

        if (result.canceled) return

        const asset = result.assets[0]
        append({
          kind,
          uri: asset.uri,
          name: asset.fileName ?? fileNameFromUri(asset.uri, `${kind}.jpg`),
          mimeType: asset.mimeType ?? 'image/jpeg',
        })
      } catch (caught) {
        console.error('Image picker failed', caught)
        setError(caught instanceof Error ? caught.message : 'Could not open the picker.')
      }
    },
    [append, kind],
  )

  const addDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        // manual_pdf means a PDF; `other` may be any file.
        type: kind === 'manual_pdf' ? 'application/pdf' : '*/*',
        copyToCacheDirectory: true,
      })

      if (result.canceled) return

      const asset = result.assets[0]
      append({
        kind,
        uri: asset.uri,
        name: asset.name ?? fileNameFromUri(asset.uri, 'document'),
        mimeType: asset.mimeType ?? 'application/octet-stream',
      })
    } catch (caught) {
      console.error('Document picker failed', caught)
      setError(caught instanceof Error ? caught.message : 'Could not open the file picker.')
    }
  }, [append, kind])

  /**
   * The single "Add media" entry point. Documents go straight to the file
   * picker; photos ask where the image should come from.
   */
  const addMedia = useCallback(() => {
    setError(null)

    if (isDocumentKind(kind)) {
      addDocument()
      return
    }

    Alert.alert(mediaKindLabel(kind), 'Where should this photo come from?', [
      { text: 'Take Photo', onPress: () => addFromImagePicker('camera') },
      { text: 'Choose from Gallery', onPress: () => addFromImagePicker('library') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }, [addDocument, addFromImagePicker, kind])

  const removeMedia = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  return { items, kind, setKind, addMedia, removeMedia, error }
}
