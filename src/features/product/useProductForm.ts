import { useCallback, useState } from 'react'

import type { ProductAttributes, ProductDetails, Variant } from '../../types/product'
import { buildProductPayload } from './payload'
import { validateProduct } from './validation'
import { createVariant, INITIAL_VARIANTS } from './variant'

const INITIAL_DETAILS: ProductDetails = {
  name: 'Samsung Galaxy S24 Ultra',
  brand: 'Samsung',
  description: '',
}

const INITIAL_ATTRIBUTES: ProductAttributes = {
  battery: '5000',
  display: '6.8',
  ram: '12',
}

/** All form state and behaviour for the Add Product screen. */
export function useProductForm() {
  const [details, setDetails] = useState<ProductDetails>(INITIAL_DETAILS)
  const [attributes, setAttributes] = useState<ProductAttributes>(INITIAL_ATTRIBUTES)
  const [variants, setVariants] = useState<Variant[]>(INITIAL_VARIANTS)

  const [errors, setErrors] = useState<string[]>([])
  const [payload, setPayload] = useState<string | null>(null)

  const setDetail = useCallback(<K extends keyof ProductDetails>(key: K, value: ProductDetails[K]) => {
    setDetails((prev) => ({ ...prev, [key]: value }))
  }, [])

  const setAttribute = useCallback(
    <K extends keyof ProductAttributes>(key: K, value: ProductAttributes[K]) => {
      setAttributes((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const addVariant = useCallback(() => {
    setVariants((prev) => [...prev, createVariant()])
  }, [])

  const removeVariant = useCallback((id: string) => {
    setVariants((prev) => prev.filter((variant) => variant.id !== id))
  }, [])

  const updateVariant = useCallback((id: string, patch: Partial<Variant>) => {
    setVariants((prev) =>
      prev.map((variant) => (variant.id === id ? { ...variant, ...patch } : variant)),
    )
  }, [])

  // Only one variant may be the default, so checking one clears the rest.
  const toggleDefault = useCallback((id: string) => {
    setVariants((prev) =>
      prev.map((variant) => ({ ...variant, isDefault: variant.id === id ? !variant.isDefault : false })),
    )
  }, [])

  const submit = useCallback(() => {
    const found = validateProduct(details, variants)
    setErrors(found)
    setPayload(null)
    if (found.length) return

    const json = JSON.stringify(buildProductPayload(details, attributes, variants), null, 2)
    console.log('SUBMIT PRODUCT payload:\n' + json)
    setPayload(json)
  }, [attributes, details, variants])

  return {
    details,
    setDetail,
    attributes,
    setAttribute,
    variants,
    addVariant,
    removeVariant,
    updateVariant,
    toggleDefault,
    errors,
    payload,
    submit,
  }
}
