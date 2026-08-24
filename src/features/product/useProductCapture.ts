import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from 'react-native'

import * as api from '../../api/api'
import { createClientId } from '../../lib/clientId'
import { DEFAULT_CURRENCY } from '../../constants/options'
import type { AttributeValue, AttributeValues } from '../../types/catalog'
import type { ProductDetails, SubmissionPayload } from '../../types/product'
import { createInitialValues, splitDefinitions } from './attributeValues'
import type { UploadedFields } from './media'
import { buildSubmissionPayload } from './payload'
import { addSubmission } from './submissionStore'
import { useAttributes } from './useAttributes'
import { useLocalVariants } from './useLocalVariants'
import { useProductMedia } from './useProductMedia'
import { validateCapture } from './validation'

const INITIAL_DETAILS: ProductDetails = {
  name: '',
  manufacturerId: '',
  brandId: '',
  description: '',
  categoryId: '',
  verticalId: '',
  modelNumber: '',
  tags: [],
  defaultUom: '',
  countryOfOrigin: '',
  notes: '',
  observedPrice: '',
  currency: DEFAULT_CURRENCY,
}

/**
 * One product capture, start to finish.
 *
 * Everything stays on the device: pressing ADD PRODUCT validates the form,
 * builds the submission body and files it locally for the review screen to read
 * back. Nothing is sent anywhere.
 */
export function useProductCapture(barcode: string) {
  const [details, setDetails] = useState<ProductDetails>(INITIAL_DETAILS)
  const [attributeValues, setAttributeValues] = useState<AttributeValues>({})

  const [errors, setErrors] = useState<string[]>([])
  const [payload, setPayload] = useState<string | null>(null)
  /** Set while the photos are uploading and the capture is being filed. */
  const [submitting, setSubmitting] = useState(false)

  // One id for this capture, held across attempts, so pressing ADD PRODUCT
  // twice updates the same entry rather than filing it a second time.
  const [clientId] = useState(createClientId)

  // Attachments are product-level, so they survive a change of category.
  const mediaList = useProductMedia()

  const { definitions } = useAttributes(details.categoryId)

  const { productLevel, variantAxes } = useMemo(
    () => splitDefinitions(definitions),
    [definitions],
  )

  const variantList = useLocalVariants(variantAxes)

  // Answers belong to the category that defined them, so a new set of
  // definitions starts blank rather than carrying stale codes over.
  useEffect(() => {
    setAttributeValues(createInitialValues(productLevel))
  }, [productLevel])

  const setDetail = useCallback(
    <K extends keyof ProductDetails>(key: K, value: ProductDetails[K]) => {
      setDetails((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const setAttribute = useCallback((code: string, value: AttributeValue) => {
    setAttributeValues((prev) => ({ ...prev, [code]: value }))
  }, [])

  const { variants } = variantList
  const { items: mediaItems } = mediaList

  /**
   * Validates the form, uploads the photos, and files the capture.
   *
   * The order matters. Bytes go to Cloudinary first, one request per file, so a
   * connection that drops costs one photo rather than the whole capture; the
   * submission that follows carries only the metadata of uploads that already
   * succeeded. Both halves then land in one server transaction.
   *
   * A failed upload does not abandon the capture: the row is still submitted,
   * and the server records it as `pending` so the photo is not forgotten.
   *
   * Returns the payload, or null when the form is invalid or the server refused
   * it — the caller stays put so the errors stay visible.
   *
   * The labels are resolved by the caller from the lists the picks came from:
   * this hook holds ids, and the screen is what has the rows to name them by.
   */
  const submit = useCallback(
    async (labels: {
      /** Breadcrumb, resolved from the tree the category was picked from. */
      categoryPath: string
      manufacturerName: string
      brandName: string
    }): Promise<SubmissionPayload | null> => {
      const found = validateCapture(details, productLevel, attributeValues, variantAxes, variants)
      setErrors(found)
      setPayload(null)
      if (found.length) return null

      setSubmitting(true)
      try {
        // One upload per file, keyed by the item so the metadata finds its way
        // back to the right row. A rejection is recorded, not fatal.
        const uploaded = new Map<string, UploadedFields>()
        const failed: string[] = []

        for (const item of mediaItems) {
          try {
            const result = await api.uploadMedia(
              { uri: item.uri, name: item.name, type: item.mimeType },
              item.kind,
            )
            uploaded.set(item.id, {
              storage_key: result.storage_key,
              public_url: result.public_url,
              file_size: result.file_size,
              width: result.width,
              height: result.height,
              content_hash: result.content_hash,
            })
          } catch (caught) {
            // Keep the server's reason, not just the file name. A rejected
            // format and an unreachable host both leave the photo unuploaded,
            // and only the message tells them apart — logging it to the console
            // alone means nobody holding the phone ever finds out.
            const reason = caught instanceof Error ? caught.message : 'upload failed'
            failed.push(`${item.name}: ${reason}`)
            console.warn('Media upload failed', item.name, caught)
          }
        }

        const body = buildSubmissionPayload(
          {
            clientId,
            barcode,
            categoryPath: labels.categoryPath,
            manufacturerName: labels.manufacturerName,
            brandName: labels.brandName,
          },
          details,
          productLevel,
          attributeValues,
          variantAxes,
          variants,
          mediaItems,
          uploaded,
        )

        setPayload(JSON.stringify(body, null, 2))

        try {
          const stored = await api.submitProductSubmission<{
            submission?: { id?: string }
          }>(body)

          // Accepted and waiting on review, which is what the collector sees as
          // a draft.
          addSubmission(body, 'draft', { submissionId: stored?.submission?.id })

          if (failed.length) {
            const heading =
              `Filed, but ${failed.length} photo${failed.length === 1 ? '' : 's'} did not upload ` +
              'and are recorded as pending:'

            setErrors([heading, ...failed])

            // An alert as well as the list. A photo that silently failed to
            // upload is the one thing on this screen a collector cannot see for
            // themselves — the capture still saved, so nothing else looks wrong.
            Alert.alert('Photos not uploaded', failed.join('\n\n'))
          }

          return body
        } catch (caught) {
          // The capture is kept on the device either way, so nothing typed is
          // lost — but it is marked failed rather than filed.
          const message = caught instanceof Error ? caught.message : 'Submission failed'
          addSubmission(body, 'failed', { error: message })
          setErrors([message])
          return null
        }
      } finally {
        setSubmitting(false)
      }
    },
    [
      attributeValues,
      barcode,
      clientId,
      details,
      mediaItems,
      productLevel,
      variantAxes,
      variants,
    ],
  )

  return {
    details,
    setDetail,
    productLevel,
    variantAxes,
    attributeValues,
    setAttribute,
    mediaList,
    variantList,
    errors,
    payload,
    submitting,
    submit,
  }
}
