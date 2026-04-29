import { useEffect } from 'react'
import { StyleSheet, useWindowDimensions, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { usePalette } from '../design/theme'

interface Props {
  active: boolean
}

// 1px bronze hair logo abaixo da status bar nativa, com sweep de 30%.
// SafeAreaView garante posicionamento confiável independente de race do useSafeAreaInsets().
export function SyncBar({ active }: Props) {
  const c = usePalette()
  const { width } = useWindowDimensions()
  const sweepW = width * 0.3

  const opacity = useSharedValue(0)
  const sweepX = useSharedValue(-sweepW)

  useEffect(() => {
    if (active) {
      opacity.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) })
      sweepX.value = -sweepW
      sweepX.value = withRepeat(
        withTiming(width, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        -1,
        false,
      )
    } else {
      opacity.value = withTiming(0, { duration: 480, easing: Easing.in(Easing.cubic) })
      cancelAnimation(sweepX)
    }
  }, [active, opacity, sweepX, sweepW, width])

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sweepX.value }] }))

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <SafeAreaView edges={['top']}>
        <Animated.View style={[styles.bar, { backgroundColor: c.bronze + '14' }, containerStyle]}>
          <Animated.View
            style={[styles.sweep, { width: sweepW, backgroundColor: c.bronze }, sweepStyle]}
          />
        </Animated.View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 36,
  },
  bar: {
    height: 1,
    overflow: 'hidden',
  },
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
})
