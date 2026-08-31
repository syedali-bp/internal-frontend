import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { findCategoryTrail } from '../lib/categoryTree'
import type { Palette } from '../theme/colors'
import { makeControls, useColors, useThemedStyles } from '../theme/useColors'
import type { CategoryNode } from '../types/catalog'

type CategoryPickerProps = {
  value: string
  nodes: readonly CategoryNode[]
  onChange: (value: string) => void
  placeholder: string
  disabled?: boolean
}

/**
 * Drill-down category picker. Each tap on a parent opens its children; only a
 * leaf category (one with no children of its own) can actually be selected, so
 * the form always ends up with a specific category such as
 * Beverages › Carbonated Drinks › Cola.
 */
export function CategoryPicker({
  value,
  nodes,
  onChange,
  placeholder,
  disabled = false,
}: CategoryPickerProps) {
  const controls = useThemedStyles(makeControls)
  const s = useThemedStyles(makeStyles)
  const [isOpen, setIsOpen] = useState(false)
  // The ancestors currently drilled into; empty means we are at the root level.
  const [trail, setTrail] = useState<CategoryNode[]>([])

  const selectedTrail = useMemo(
    () => (value ? findCategoryTrail(nodes, value) : null),
    [nodes, value],
  )
  const level = trail.length ? trail[trail.length - 1].children : nodes

  const open = () => {
    // Reopen on the selected category's own level so the current pick is in view.
    setTrail(selectedTrail ? selectedTrail.slice(0, -1) : [])
    setIsOpen(true)
  }

  const goBack = () => setTrail((current) => current.slice(0, -1))

  const handlePress = (node: CategoryNode) => {
    if (node.children.length) {
      setTrail((current) => [...current, node])
      return
    }

    onChange(node.id)
    setIsOpen(false)
  }

  return (
    <>
      <Pressable
        style={[controls.input, disabled && s.disabled]}
        onPress={open}
        disabled={disabled}
      >
        <Text style={selectedTrail ? s.valueText : s.placeholder} numberOfLines={2}>
          {selectedTrail
            ? selectedTrail.map((node, index) => (
                <Text
                  key={node.id}
                  style={index === selectedTrail.length - 1 ? s.valueLeaf : s.valueAncestor}
                >
                  {index > 0 ? ' › ' : ''}
                  {node.name}
                </Text>
              ))
            : placeholder}
        </Text>
        <Text style={s.caret}>⌄</Text>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        // Android's hardware back should step up one level before closing.
        onRequestClose={() => (trail.length ? goBack() : setIsOpen(false))}
      >
        <Pressable style={s.backdrop} onPress={() => setIsOpen(false)}>
          {/* Swallow taps inside the sheet so they do not dismiss the modal. */}
          <Pressable style={s.sheet} onPress={() => {}}>
            <View style={s.header}>
              {trail.length > 0 && (
                <Pressable style={s.back} onPress={goBack} hitSlop={8}>
                  <Text style={s.backText}>‹</Text>
                </Pressable>
              )}
              <View style={s.headerTitles}>
                <Text style={s.title} numberOfLines={1}>
                  {trail.length ? trail[trail.length - 1].name : 'Select category'}
                </Text>
                {trail.length > 0 && (
                  <Text style={s.crumbs} numberOfLines={1}>
                    {trail.map((node) => node.name).join('  ›  ')}
                  </Text>
                )}
              </View>
              <Pressable style={s.close} onPress={() => setIsOpen(false)} hitSlop={8}>
                <Text style={s.closeText}>×</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={s.options}>
              {level.length === 0 && <Text style={s.empty}>No categories available.</Text>}

              {level.map((node) => {
                const isBranch = node.children.length > 0
                const isSelected = node.id === value

                return (
                  <Pressable
                    key={node.id}
                    style={[s.option, isSelected && s.optionActive]}
                    onPress={() => handlePress(node)}
                  >
                    <View style={s.optionTexts}>
                      <Text style={[s.optionText, isSelected && s.optionTextActive]}>
                        {node.name}
                      </Text>
                      {isBranch && (
                        <Text style={s.optionMeta}>
                          {node.children.length} subcategor{node.children.length === 1 ? 'y' : 'ies'}
                        </Text>
                      )}
                    </View>
                    <Text style={isBranch ? s.chevron : s.check}>
                      {isBranch ? '›' : isSelected ? '✓' : ''}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            <Text style={s.hint}>Tap a group to open it. Only end categories can be selected.</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  valueText: { fontSize: 14, color: colors.text, flex: 1 },
  valueAncestor: { color: colors.textMuted },
  valueLeaf: { color: colors.text, fontWeight: '600' },
  placeholder: { fontSize: 14, color: colors.placeholder, flex: 1 },
  caret: { fontSize: 16, color: colors.textMuted, marginTop: -6 },
  disabled: { opacity: 0.55 },

  backdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    maxHeight: '75%',
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitles: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: colors.text },
  crumbs: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  back: { paddingHorizontal: 6 },
  backText: { fontSize: 26, lineHeight: 28, color: colors.primary, fontWeight: '700' },
  close: { paddingHorizontal: 6 },
  closeText: { fontSize: 24, lineHeight: 26, color: colors.textMuted },

  options: { paddingVertical: 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
  optionActive: { backgroundColor: colors.primaryHighlight },
  optionTexts: { flex: 1 },
  optionText: { fontSize: 15, color: colors.text },
  optionTextActive: { fontWeight: '700', color: colors.primary },
  optionMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 22, color: colors.textMuted },
  check: { fontSize: 16, color: colors.primary, fontWeight: '700' },
  empty: { paddingVertical: 24, textAlign: 'center', color: colors.textMuted, fontSize: 14 },

  hint: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontSize: 11,
    color: colors.textMuted,
    backgroundColor: colors.headerBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
})

