import { useCallback, useEffect, useMemo, useState } from 'react'

import { createClientId } from '../../lib/clientId'
import { DEFAULT_CURRENCY } from '../../constants/options'
import type { AttributeValue, AttributeValues } from '../../types/catalog'
import type { ProductDetails, SubmissionPayload } from '../../types/product'
import { createInitialValues, splitDefinitions } from './attributeValues'
import { buildSubmissionPayload } from './payload'
import { addSubmission } from './submissionStore'
import { useAttributes } from './useAttributes'
import { useLocalVariants } from './useLocalVariants'
import { useProductMedia } from './useProductMedia'
import { validateCapture } from './validation'

const INITIAL_DETAILS: ProductDetails = {
  name: '',
  brand: '',
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
   * Validates the form and files the capture. Returns the payload, or null when
   * the form is invalid — the caller stays put so the errors stay visible.
   * `categoryPath` is the breadcrumb, resolved by the caller from the tree the
   * category was picked from.
   */
  const submit = useCallback(
    (categoryPath: string): SubmissionPayload | null => {
      const found = validateCapture(details, productLevel, attributeValues, variantAxes, variants)
      setErrors(found)
      setPayload(null)
      if (found.length) return null

      const body = buildSubmissionPayload(
        { clientId, barcode, categoryPath },
        details,
        productLevel,
        attributeValues,
        variantAxes,
        variants,
        mediaItems,
      )

      setPayload(JSON.stringify(body, null, 2))
      addSubmission(body)

      return body
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
    submit,
  }
}
