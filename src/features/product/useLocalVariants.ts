import { useCallback, useEffect, useState } from 'react'

import { createClientId } from '../../lib/clientId'
import type { AttributeDefinition } from '../../types/catalog'
import type { PackagingLevelDraft, Variant, VariantDraft } from '../../types/product'
import { createInitialValues, isAttributeMissing } from './attributeValues'

/** An untouched form: one blank slot per axis the category defines. */
function emptyForm(axes: readonly AttributeDefinition[]): VariantDraft {
  return { axes: createInitialValues(axes), sku: '', isDefault: false, packagingLevels: [] }
}

/**
 * The variants being captured for one product, held entirely on the device.
 *
 * Nothing here touches the catalog: a collector's variants are raw capture and
 * only become `catalog_product_variants` rows when a moderator approves the
 * submission they belong to. The ids are local, generated so the list has keys
 * to edit and delete against.
 */
export function useLocalVariants(axes: readonly AttributeDefinition[]) {
  const [variants, setVariants] = useState<Variant[]>([])
  /** The variant currently being typed. */
  const [form, setForm] = useState<VariantDraft>(() => emptyForm(axes))
  /** Set while the form is editing an existing entry rather than adding one. */
  const [editingId, setEditingId] = useState<string | null>(null)

  // The category's axes decide what a variant even is, so a new set of axes
  // makes the ones already captured meaningless.
  useEffect(() => {
    setVariants([])
    setForm(emptyForm(axes))
    setEditingId(null)
  }, [axes])

  /** Every axis answered and a SKU typed — otherwise Add stays disabled. */
  const isFormComplete =
    form.sku.trim().length > 0 &&
    axes.every((axis) => !isAttributeMissing(axis, form.axes[axis.code] ?? ''))

  const setFormField = useCallback((patch: Partial<VariantDraft>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const resetForm = useCallback(() => {
    setForm(emptyForm(axes))
    setEditingId(null)
  }, [axes])

  /** Adds the form as a new variant, or replaces the one being edited. */
  const saveForm = useCallback(() => {
    if (!isFormComplete) return

    setVariants((prev) => {
      // Only one variant can be the default, so marking this one clears the rest.
      const others = prev.map((variant) =>
        form.isDefault ? { ...variant, isDefault: false } : variant,
      )

      if (editingId) {
        return others.map((variant) =>
          variant.id === editingId ? { ...form, id: editingId } : variant,
        )
      }

      return [...others, { ...form, id: createClientId() }]
    })

    setForm(emptyForm(axes))
    setEditingId(null)
  }, [axes, editingId, form, isFormComplete])

  /** Loads a captured variant back into the form. */
  const editVariant = useCallback(
    (id: string) => {
      const variant = variants.find((entry) => entry.id === id)
      if (!variant) return

      const { id: _id, ...fields } = variant
      setForm(fields)
      setEditingId(id)
    },
    [variants],
  )

  const removeVariant = useCallback(
    (id: string) => {
      setVariants((prev) => prev.filter((variant) => variant.id !== id))
      // Editing the row that just disappeared would save under a dead id.
      setEditingId((current) => {
        if (current !== id) return current
        setForm(emptyForm(axes))
        return null
      })
    },
    [axes],
  )

  /** Packaging belongs to a variant, so it is stored on the one it describes. */
  const addPackaging = useCallback((variantId: string, level: PackagingLevelDraft) => {
    setVariants((prev) =>
      prev.map((variant) =>
        variant.id === variantId
          ? { ...variant, packagingLevels: [...(variant.packagingLevels ?? []), level] }
          : variant,
      ),
    )
  }, [])

  return {
    variants,
    form,
    setFormField,
    isFormComplete,
    editingId,
    saveForm,
    editVariant,
    removeVariant,
    resetForm,
    addPackaging,
  }
}
