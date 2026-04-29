import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { usePalette } from '../design/theme'

// Red-ink dot that pulses outward — the visible heartbeat of an active capture.
// Mirrors the CSS keyframes: 0% visible at center, 70% expanded+invisible, 100% hold.
export function CapturePulse() {
  const c = usePalette()
  const t = useSharedValue(0)

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.linear }),
      -1,
      false,
    )
    return () => cancelAnimation(t)
  }, [t])

  const ringStyle = useAnimatedStyle(() => {
    const phase = t.value
    let scale = 1
    let opacity = 0
    if (phase < 0.7) {
      const k = phase / 0.7
      scale = 1 + k * 2.5
      opacity = 0.45 * (1 - k)
    } else {
      scale = 3.5
      opacity = 0
    }
    return { opacity, transform: [{ scale }] }
  })

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.ring, { backgroundColor: c.recRed }, ringStyle]} />
      <View style={[styles.dot, { backgroundColor: c.recRed }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  ring: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
})
