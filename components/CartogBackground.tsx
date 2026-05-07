import { View, type StyleProp, type ViewStyle } from 'react-native'
import { usePalette } from '../design/theme'

interface Props {
  cell?: number
  opacity?: number
  style?: StyleProp<ViewStyle>
  count?: number
}

// Cartography grid — sussurro de fundo. 36px cells, ~2.5% opacity, ink-tinted.
export function CartogBackground({ cell = 36, opacity = 0.025, style, count = 26 }: Props) {
  const c = usePalette()
  const lines: number[] = []
  for (let i = 0; i < count; i++) lines.push(i * cell)

  return (
    <View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, opacity, overflow: 'hidden' },
        style,
      ]}
    >
      {lines.map((y) => (
        <View
          key={`h${y}`}
          style={{
            position: 'absolute', left: 0, right: 0, top: y, height: 1, backgroundColor: c.ink,
          }}
        />
      ))}
      {lines.map((x) => (
        <View
          key={`v${x}`}
          style={{
            position: 'absolute', top: 0, bottom: 0, left: x, width: 1, backgroundColor: c.ink,
          }}
        />
      ))}
    </View>
  )
}
