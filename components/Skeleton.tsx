import { useEffect } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useTheme } from '../design/theme'

interface Props {
  width?: number | `${number}%`
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}

// Warm-light shimmer — não branco genérico. Surface → premium → surface.
export function Skeleton({ width = '100%', height = 12, radius = 4, style }: Props) {
  const { c, name } = useTheme()
  const t = useSharedValue(0)

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    )
    return () => cancelAnimation(t)
  }, [t])

  const peakColor = name === 'dark' ? '#322c22' : c.premium
  const baseColor = c.surface

  const animStyle = useAnimatedStyle(() => {
    const phase = t.value
    // Sinusoidal blend between base and peak — keeps it organic.
    const k = 0.5 - 0.5 * Math.cos(phase * 2 * Math.PI)
    return {
      backgroundColor: blend(baseColor, peakColor, k),
    }
  })

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius },
        animStyle,
        style,
      ]}
    />
  )
}

// Linear blend of two hex colors (#RRGGBB) — simple lerp, runs on UI thread (worklet-safe).
function blend(a: string, b: string, k: number): string {
  'worklet'
  const ar = parseInt(a.slice(1, 3), 16)
  const ag = parseInt(a.slice(3, 5), 16)
  const ab = parseInt(a.slice(5, 7), 16)
  const br = parseInt(b.slice(1, 3), 16)
  const bg = parseInt(b.slice(3, 5), 16)
  const bb = parseInt(b.slice(5, 7), 16)
  const r = Math.round(ar + (br - ar) * k)
  const g = Math.round(ag + (bg - ag) * k)
  const blu = Math.round(ab + (bb - ab) * k)
  return `rgb(${r}, ${g}, ${blu})`
}

void StyleSheet
