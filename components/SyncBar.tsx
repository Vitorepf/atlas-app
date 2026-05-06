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

type SyncState = 'synced' | 'error' | 'offline'

interface Props {
  active: boolean
  state?: SyncState
}

// 1px hairline logo abaixo da status bar · sweep adaptive ao estado de sync.
// state-aware (Frente 9 v6):
//   synced  → bronze, sweep 1.8s (ritmo normal)
//   error   → recRed, sweep 1.0s (urgência)
//   offline → ink3, sweep 3.2s (lento, calmo, "presente mas dormindo")
export function SyncBar({ active, state = 'synced' }: Props) {
  const c = usePalette()
  const { width } = useWindowDimensions()
  const sweepW = width * 0.3

  const opacity = useSharedValue(0)
  const sweepX = useSharedValue(-sweepW)

  // Cor + duração derivam do state.
  const tone =
    state === 'error' ? c.recRedOxide :
    state === 'offline' ? c.ink3 :
    c.bronze
  const sweepDuration =
    state === 'error' ? 1000 :
    state === 'offline' ? 3200 :
    1800

  useEffect(() => {
    if (active) {
      opacity.value = withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) })
      sweepX.value = -sweepW
      sweepX.value = withRepeat(
        withTiming(width, { duration: sweepDuration, easing: Easing.inOut(Easing.ease) }),
        -1,
        false,
      )
    } else {
      opacity.value = withTiming(0, { duration: 480, easing: Easing.in(Easing.cubic) })
      cancelAnimation(sweepX)
    }
  }, [active, opacity, sweepX, sweepW, width, sweepDuration])

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ translateX: sweepX.value }] }))

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <SafeAreaView edges={['top']}>
        <Animated.View style={[styles.bar, { backgroundColor: tone + '14' }, containerStyle]}>
          <Animated.View
            style={[styles.sweep, { width: sweepW, backgroundColor: tone }, sweepStyle]}
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
