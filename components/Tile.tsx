import { Pressable, StyleSheet, type ViewStyle } from 'react-native'
import { type ReactNode } from 'react'
import { Frau, Label } from '../design/Type'
import { usePalette } from '../design/theme'

interface Props {
  label: string
  children: ReactNode
  onPress?: () => void
  premium?: boolean
  style?: ViewStyle
  tall?: boolean
}

export function Tile({ label, children, onPress, premium, style, tall }: Props) {
  const c = usePalette()
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: premium ? c.premium : c.surface,
          borderColor: c.border,
          paddingVertical: tall ? 22 : 18,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      <Label style={{ marginBottom: 8 }}>{label}</Label>
      <Frau size={19} lineHeight={23} letterSpacing={-0.19}>
        {children}
      </Frau>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
  },
})
