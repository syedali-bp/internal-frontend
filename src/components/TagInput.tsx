import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import type { Palette } from '../theme/colors'
import { makeControls, useColors, useThemedStyles } from '../theme/useColors'

type TagInputProps = {
  tags: readonly string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

/**
 * Free-text chips. A tag is committed on comma, on Enter, or when the field
 * loses focus, so a half-typed word is never silently dropped. Comparison is
 * case-insensitive, which keeps "Halal" and "halal" from both being stored.
 */
export function TagInput({ tags, onChange, placeholder = 'Add a tag' }: TagInputProps) {
  const controls = useThemedStyles(makeControls)
  const colors = useColors()
  const s = useThemedStyles(makeStyles)
  const [draft, setDraft] = useState('')

  const commit = (raw: string) => {
    const tag = raw.trim()
    setDraft('')
    if (!tag) return
    if (tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return
    onChange([...tags, tag])
  }

  // Typing (or pasting) a comma ends the tag, so "milk, dairy" adds two.
  const handleChange = (text: string) => {
    if (!text.includes(',')) {
      setDraft(text)
      return
    }

    const parts = text.split(',')
    const trailing = parts.pop() ?? ''
    const added = [...tags]

    parts.forEach((part) => {
      const tag = part.trim()
      if (!tag) return
      if (added.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return
      added.push(tag)
    })

    onChange(added)
    setDraft(trailing)
  }

  const remove = (tag: string) => onChange(tags.filter((existing) => existing !== tag))

  return (
    <View>
      {tags.length > 0 && (
        <View style={s.chips}>
          {tags.map((tag) => (
            <Pressable key={tag} style={s.chip} onPress={() => remove(tag)}>
              <Text style={s.chipText}>{tag}</Text>
              <Text style={s.chipRemove}>×</Text>
            </Pressable>
          ))}
        </View>
      )}

      <TextInput
        style={controls.input}
        value={draft}
        onChangeText={handleChange}
        onSubmitEditing={() => commit(draft)}
        onBlur={() => commit(draft)}
        // Keeps focus after Enter so several tags can be typed in a row.
        submitBehavior="submit"
        returnKeyType="done"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
      />
      <Text style={s.hint}>Comma or Enter adds a tag. Tap a tag to remove it.</Text>
    </View>
  )
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryHighlight,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  chipRemove: { fontSize: 15, color: colors.textMuted, marginTop: -2 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 6 },
})

