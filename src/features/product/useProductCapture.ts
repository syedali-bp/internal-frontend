import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from 'react-native'

import * as api from '../../api/api'
import { createClientId } from '../../lib/clientId'
import { DEFAULT_CURRENCY } from '../../constants/options'
import type { AttributeValue, AttributeValues } from '../../types/catalog'
import type { ProductDetails, SubmissionPayload } from '../../types/product'
import { createInitialValues, splitDefinitions } from './attributeValues'
import type { UploadedFields } from './media'
import { buildSubmissionPayload } from './payload'
import { getActiveSession } from '../store/sessionStore'
import { addSubmission } from './submissionStore'
import { syncQueue } from './syncQueue'
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
 * What the catalog already holds, when this capture is a contribution to a
 * product a scan resolved to.
 *
 * Only the fields the form can show. Passed in rather than looked up here so
 * the hook stays about capture state, and so the screen and the hook cannot
 * disagree about which product is being contributed to.
 */
export type CapturePrefill = {
  name: string
  description: string
  defaultUom: string
  /**
   * The ids the contribution submits against.
   *
   * Taken from the lookup rather than picked in the form: a contribution's
   * category and vertical are locked to whatever the catalog already holds, so
   * the collector has no way to supply them — and validation requires both.
   */
  verticalId: string
  categoryId: string
  brandId: string
}

/**
 * One product capture, start to finish.
 *
 * Everything stays on the device: pressing ADD PRODUCT validates the form,
 * builds the submission body and files it locally for the review screen to read
 * back. Nothing is sent anywhere.
 *
 * `prefill` carries what the catalog already knows when this capture enriches a
 * product a scan matched. It seeds the form once rather than continuously: the
 * collector is filling gaps beside those values, and re-applying them on every
 * render would fight whatever they type.
 */
export function useProductCapture(barcode: string, prefill?: CapturePrefill) {
  const [details, setDetails] = useState<ProductDetails>(INITIAL_DETAILS)

  const [attributeValues, setAttributeValues] = useState<AttributeValues>({})

  const [errors, setErrors] = useState<string[]>([])
  const [payload, setPayload] = useState<string | null>(null)
  /** Set while the photos are uploading and the capture is being filed. */
  const [submitting, setSubmitting] = useState(false)

  /**
   * Whether the prefill has been applied.
   *
   * A ref rather than state because applying it must not itself cause a render,
   * and because the guard has to be read inside the effect that sets it.
   */
  const prefilled = useRef(false)

  /**
   * Seeds the form from the catalog, once, when the lookup answers.
   *
   * Not a lazy useState initialiser, which was the first attempt and was wrong:
   * that runs on the first render only, and on the first render the lookup query
   * has not resolved — so `prefill` was undefined and the form stayed blank for
   * good. The empty category then made useAttributes fetch every attribute in
   * the catalog, which is why submitting demanded Chocolate Type and Compressive
   * Strength in the same breath.
   *
   * Applied once and never again: after this the collector owns the form, and
   * re-applying on a refetch would overwrite what they had typed.
   */
  useEffect(() => {
    if (!prefill || prefilled.current) return

    prefilled.current = true
    setDetails((previous) => ({
      ...previous,
      name: prefill.name,
      description: prefill.description,
      defaultUom: prefill.defaultUom,
      verticalId: prefill.verticalId,
      categoryId: prefill.categoryId,
      brandId: prefill.brandId,
    }))
  }, [prefill])

  // One id for this capture, held across attempts, so pressing ADD PRODUCT
  // twice updates the same entry rather than filing it a second time.
  const [clientId] = useState(createClientId)

  // Attachments are product-level, so they survive a change of category.
  const mediaList = useProductMedia()

  const { definitions, refetch: refetchAttributes } = useAttributes(details.categoryId)

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
   * A send that cannot reach the server queues the capture instead of failing
   * it. The collector moves on to the next product and the queue is sent later,
   * which is the whole point of capturing offline.
   *
   * Returns the payload, or null only when the form is invalid — the caller
   * stays put so the errors stay visible.
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
      // A contribution is checked against what it can actually supply: the
      // product it adds to already has its variants and attributes on file.
      const found = validateCapture(
        details,
        productLevel,
        attributeValues,
        variantAxes,
        variants,
        Boolean(prefill),
      )
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
            // Stamped now, while the visit is open, not at sync time.
            sessionId: getActiveSession()?.session.id ?? '',
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
            submission?: { id?: string; match_type?: string }
            summary?: { match_type?: string }
          }>(body)

          // Accepted and waiting on review, which is what the collector sees as
          // a draft.
          const matchType = stored?.summary?.match_type ?? stored?.submission?.match_type
          addSubmission(body, 'draft', { submissionId: stored?.submission?.id, matchType })

          // The server decides whether this capture looks like something the
          // catalog already holds — by barcode, by SKU, or by name. It files it
          // either way and leaves the decision to a moderator, but the collector
          // is the one person who can check the shelf right now, so they are
          // told before they walk away. Without this the capture reads as
          // ordinarily filed and the same product gets entered again.
          if (matchType === 'possible_duplicate' || matchType === 'existing_variant') {
            Alert.alert(
              'Possibly already in the catalog',
              matchType === 'existing_variant'
                ? 'This barcode is already on a product in the catalog. Your capture has been ' +
                    'filed and will be used to confirm the existing entry — you do not need to ' +
                    'capture it again.'
                : 'This looks like a product the catalog already has. Your capture has been ' +
                    'filed and a reviewer will decide whether it is the same one — you do not ' +
                    'need to capture it again.',
              [{ text: 'OK' }],
            )
          }

          // The connection is evidently up, so anything queued from an earlier
          // drop can go now. Not awaited: the capture is already filed, and the
          // collector should not wait on a backlog to move on to the next
          // product.
          void syncQueue()

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
          // Queued, not failed. The capture is on the device and persisted, so
          // nothing typed is lost, and a collector working out of signal should
          // be able to keep going rather than being stopped by each product.
          const message = caught instanceof Error ? caught.message : 'Submission failed'
          addSubmission(body, 'queued', { error: message, attempts: 1 })

          // Not an error to the collector: this is the offline path working.
          // The banner carries the count from here on.
          setErrors([])

          return body
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
      prefill,
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
    /** Re-reads this category's attribute definitions — see the pull to refresh. */
    refetchAttributes,
  }
}
