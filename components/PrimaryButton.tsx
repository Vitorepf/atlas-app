import { Pressable, StyleSheet, type ViewStyle, type StyleProp } from 'react-native'
import { Sans } from '../design/Type'
import { usePalette } from '../design/theme'

interface Props {
  label: string
  onPress?: () => void
  variant?: 'solid' | 'ghost' | 'secondary' | 'danger'
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
}

// Atlas's CTA. Solid (ink), ghost (transparent), secondary (prussian outline), danger (rec-red).
export function PrimaryButton({
  label,
  onPress,
  variant = 'solid',
  fullWidth = true,
  style,
}: Props) {
  const c = usePalette()

  const palette =
    variant === 'solid'
      ? { bg: c.ink, fg: c.bg, border: c.ink }
      : variant === 'ghost'
        ? { bg: 'transparent', fg: c.ink, border: 'transparent' }
        : variant === 'secondary'
          ? { bg: 'transparent', fg: c.prussian, border: c.prussian }
          : { bg: c.recRed, fg: c.bg, border: c.recRed }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      <Sans weight="sb" size={15} letterSpacing={0.3} color={palette.fg} align="center">
        {label}
      </Sans>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
