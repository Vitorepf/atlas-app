import { Text, type StyleProp, type TextStyle } from 'react-native'
import { usePalette } from '../../design/theme'
import { fonts } from '../../design/tokens'

interface Props {
  size?: number
  opacity?: number
  color?: string
  style?: StyleProp<TextStyle>
}

// Bronze ✦ — Atlas's editorial mark. Used as section divider, send affordance,
// and routing whisper anchor. Renders the unicode character in Fraunces serif
// so geometry stays consistent across platforms.
export function BronzeDiamond({ size = 14, opacity = 1, color, style }: Props) {
  const c = usePalette()
  return (
    <Text
      accessibilityLabel="bronze diamond"
      style={[
        {
          fontFamily: fonts.serif,
          fontSize: size,
          lineHeight: size + 2,
          color: color ?? c.bronze,
          opacity,
        },
        style,
      ]}
    >
      ✦
    </Text>
  )
}
