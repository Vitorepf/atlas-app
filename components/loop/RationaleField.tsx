import { StyleSheet, TextInput, View } from 'react-native'
import { Label } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { fonts, radii } from '../../design/tokens'

interface Props {
  value: string
  onChangeText: (t: string) => void
  required?: boolean
  placeholder: string
  label: string
  /** Override the label color (e.g. amber when required). */
  labelColor?: string
}

// Shared multiline rationale input · Label + multiline TextInput in FRAUNCES
// SERIF on c.bgRecessed (the same penned-not-typed cue as the directive well).
// Used by DecisionCard (high-risk accept + reject/request_changes reason).
export function RationaleField({
  value,
  onChangeText,
  required,
  placeholder,
  label,
  labelColor,
}: Props) {
  const c = usePalette()
  return (
    <View style={styles.wrap}>
      <Label color={labelColor ?? (required ? c.amber : c.ink3)}>{label}</Label>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.ink3}
        multiline
        selectionColor={c.bronze}
        cursorColor={c.bronze}
        style={[
          styles.input,
          {
            color: c.ink,
            backgroundColor: c.bgRecessed,
            borderColor: c.border,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6,
    marginTop: 12,
  },
  input: {
    fontFamily: fonts.serif,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
})
