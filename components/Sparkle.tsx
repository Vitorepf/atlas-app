import { Text, type TextStyle, type StyleProp } from 'react-native'
import { usePalette } from '../design/theme'

interface Props {
  size?: number
  style?: StyleProp<TextStyle>
  color?: string
}

// Atlas's calling-card glyph. Bronze, raro.
export function Sparkle({ size = 14, style, color }: Props) {
  const c = usePalette()
  return (
    <Text style={[{ color: color ?? c.bronze, fontSize: size, lineHeight: size }, style]}>
      ✦
    </Text>
  )
}
