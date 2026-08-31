import { useMemo } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { Checkbox, Dropdown } from '../../../components'
import type { DropdownOption } from '../../../components/Dropdown'
import type { Palette } from '../../../theme/colors'
import { makeControls, useColors, useThemedStyles } from '../../../theme/useColors'
import type { AttributeDefinition, AttributeValue } from '../../../types/catalog'
import { DIMENSION_LABELS } from '../attributeValues'

type AttributeControlProps = {
  definition: AttributeDefinition
  value: AttributeValue
  onChange: (value: AttributeValue) => void
}

/** Reads a value that the definition guarantees is text. */
function asText(value: AttributeValue) {
  return typeof value === 'string' ? value : ''
}

function asList(value: AttributeValue) {
  return Array.isArray(value) ? value : []
}

/**
 * The input for one attribute, chosen by its `data_type`. Rendered on its own by
 * variant cards and wrapped with a label by AttributeField, so a new data type
 * means adding one branch here and nowhere else.
 */
export function AttributeControl({ definition, value, onChange }: AttributeControlProps) {
  const controls = useThemedStyles(makeControls)
  const colors = useColors()
  const s = useThemedStyles(makeStyles)
  const { data_type: dataType, unit, options } = definition

  // Units read best on the option itself for choices ("500 ml") and beside the
  // box for typed numbers, so they are never rendered twice.
  const dropdownOptions = useMemo<DropdownOption[]>(
    () =>
      (options ?? []).map((option) => ({
        label: unit ? `${option} ${unit}` : option,
        value: option,
      })),
    [options, unit],
  )

  switch (dataType) {
    case 'select':
      return (
        <Dropdown
          value={asText(value)}
          options={dropdownOptions}
          onChange={onChange}
          placeholder={`Select ${definition.name.toLowerCase()}`}
        />
      )

    case 'multi_select': {
      const selected = asList(value)
      return (
        <View style={s.chips}>
          {dropdownOptions.map((option) => {
            const isOn = selected.includes(option.value)
            return (
              <Pressable
                key={option.value}
                style={[s.chip, isOn && s.chipOn]}
                onPress={() =>
                  onChange(
                    isOn
                      ? selected.filter((entry) => entry !== option.value)
                      : [...selected, option.value],
                  )
                }
              >
                <Text style={[s.chipText, isOn && s.chipTextOn]}>{option.label}</Text>
              </Pressable>
            )
          })}
          {dropdownOptions.length === 0 && <Text style={s.note}>No options defined.</Text>}
        </View>
      )
    }

    case 'boolean':
      return (
        <View style={s.boolRow}>
          <Checkbox checked={value === true} onToggle={() => onChange(value !== true)} />
          <Text style={s.boolText}>{value === true ? 'Yes' : 'No'}</Text>
        </View>
      )

    case 'dimension': {
      const parts = asList(value)
      return (
        <View style={s.inline}>
          {DIMENSION_LABELS.map((axis, index) => (
            <TextInput
              key={axis}
              style={[controls.input, s.dimensionInput]}
              value={parts[index] ?? ''}
              onChangeText={(next) => {
                const updated = [...DIMENSION_LABELS].map((_, slot) =>
                  slot === index ? next : (parts[slot] ?? ''),
                )
                onChange(updated)
              }}
              keyboardType="numeric"
              placeholder={axis}
              placeholderTextColor={colors.placeholder}
            />
          ))}
          {!!unit && <Text style={s.unit}>{unit}</Text>}
        </View>
      )
    }

    case 'number':
      return (
        <View style={s.inline}>
          <TextInput
            style={[controls.input, s.grow]}
            value={asText(value)}
            onChangeText={onChange}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.placeholder}
          />
          {!!unit && <Text style={s.unit}>{unit}</Text>}
        </View>
      )

    case 'date':
      return (
        <TextInput
          style={controls.input}
          value={asText(value)}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.placeholder}
        />
      )

    default:
      return (
        <TextInput
          style={controls.input}
          value={asText(value)}
          onChangeText={onChange}
          placeholder={definition.name}
          placeholderTextColor={colors.placeholder}
        />
      )
  }
}

/** Built from the palette so the theme toggle repaints it. */
const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grow: { flex: 1 },
  dimensionInput: { flex: 1, textAlign: 'center' },
  unit: { fontSize: 13, color: colors.textMuted, minWidth: 28 },

  boolRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boolText: { fontSize: 14, color: colors.text },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryHighlight },
  chipText: { fontSize: 13, color: colors.textSubtle },
  chipTextOn: { color: colors.primary, fontWeight: '700' },
  note: { fontSize: 13, color: colors.textMuted },
})

