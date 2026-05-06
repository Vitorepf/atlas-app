import { useEffect, useRef } from 'react'
import { Animated, type StyleProp, type TextStyle } from 'react-native'
import { fonts } from '../../design/tokens'
import { usePalette } from '../../design/theme'

// Foil bronze ✦ · técnica #5 v5.
// Sem expo-linear-gradient · simulação por interpolação de cor entre 3 stops bronze.
// Quando shimmer = true (fresh card), cor oscila bronze → bronzeLight → bronze em 5s.
// Quando shimmer = false, cor sólida bronze.

interface Props {
  shimmer?: boolean
  size?: number
  style?: StyleProp<TextStyle>
}

export function FoilStar({ shimmer = false, size = 13, style }: Props) {
  const c = usePalette()
  const value = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!shimmer) {
      value.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 2500, useNativeDriver: false }),
        Animated.timing(value, { toValue: 0, duration: 2500, useNativeDriver: false }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [shimmer, value])

  const color = shimmer
    ? value.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [c.bronzeDeep, c.bronzeLight, c.bronzeDeep],
      })
    : c.bronze

  return (
    <Animated.Text
      style={[
        {
          fontFamily: fonts.serifItalic,
          fontSize: size,
          lineHeight: size + 1,
          color,
        },
        style,
      ]}
    >
      ✦
    </Animated.Text>
  )
}
