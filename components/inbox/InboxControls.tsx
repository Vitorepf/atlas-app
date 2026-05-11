import { Pressable, TextInput, View } from 'react-native'
import { Frau, Sans } from '../../design/Type'
import { fonts } from '../../design/tokens'
import { usePalette } from '../../design/theme'
import { styles } from './inboxScreenStyles'

export function LabeledInput({
  label,
  value,
  multiline,
  onChangeText,
}: {
  label: string
  value: string
  multiline?: boolean
  onChangeText: (value: string) => void
}) {
  const c = usePalette()
  return (
    <View style={styles.proposalField}>
      <Sans size={10.5} lineHeight={13} color={c.ink2} style={styles.fieldLabel}>
        {label}
      </Sans>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={c.ink2}
        style={[
          styles.proposalInput,
          multiline ? styles.proposalInputMultiline : null,
          { color: c.ink, borderColor: c.border },
        ]}
      />
    </View>
  )
}

export function ProposalText({ label, value }: { label: string; value?: string | null }) {
  const c = usePalette()
  if (!value) return null

  return (
    <View style={styles.proposalField}>
      <Sans size={10.5} lineHeight={13} color={c.ink2} style={styles.fieldLabel}>
        {label}
      </Sans>
      <Sans size={12.5} lineHeight={17} color={c.ink}>
        {value}
      </Sans>
    </View>
  )
}

export function PriorityChip({
  label,
  tone,
  onPress,
}: {
  label: string
  tone?: 'low' | 'normal' | 'high' | 'urgent' | 'neutral'
  onPress: () => void
}) {
  const c = usePalette()
  const color =
    tone === 'low' ? c.ink3 :
    tone === 'normal' ? c.ink2 :
    tone === 'high' ? c.bronze :
    tone === 'urgent' ? c.recRed :
    c.ink2
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.priorityChip,
        {
          borderColor: color,
          backgroundColor: pressed ? c.bgRaised : c.bg,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Frau italic size={14} lineHeight={18} color={color}>
        {label}
      </Frau>
    </Pressable>
  )
}

export function ActionText({
  label,
  danger,
  onPress,
}: {
  label: string
  danger?: boolean
  onPress: () => void
}) {
  const c = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionText, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Frau italic size={13} lineHeight={17} color={danger ? c.recRedMuted : c.ink2}>
        {label}
      </Frau>
    </Pressable>
  )
}
