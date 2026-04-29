import { useEffect, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { usePalette } from '../design/theme'

interface Props {
  bars?: number
  height?: number
}

// Live audio waveform visual. Each bar oscillates with its own random duration & delay
// so the row looks organic. Color uses ink-2 with low opacity — sussurro.
export function CaptureWave({ bars = 64, height = 56 }: Props) {
  const seeds = useMemo(
    () =>
      Array.from({ length: bars }, () => ({
        delay: Math.random() * 900,
        duration: 700 + Math.random() * 400,
      })),
    [bars],
  )

  return (
    <View style={[styles.row, { height }]}>
      {seeds.map((seed, i) => (
        <Bar key={i} delay={seed.delay} duration={seed.duration} maxHeight={height} />
      ))}
    </View>
  )
}

interface BarProps {
  delay: number
  duration: number
  maxHeight: number
}

function Bar({ delay, duration, maxHeight }: BarProps) {
  const c = usePalette()
  const v = useSharedValue(0.08)

  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.sin) }), -1, true),
    )
  }, [v, delay, duration])

  const style = useAnimatedStyle(() => ({ height: maxHeight * v.value }))

  return (
    <Animated.View
      style={[
        styles.bar,
        { backgroundColor: c.ink2 },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 36 },
  bar: { width: 3, opacity: 0.55, borderRadius: 2 },
})
