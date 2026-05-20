import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { BronzeDiamond } from '../../console/BronzeDiamond'

export function SyncDiamond({ pulsing }: { pulsing: boolean }) {
  // Slice 6ai · reducedMotion guard · pulse/rotate desativa em accessibility
  // mode iOS. Quando pulsing+reducedMotion, mantém apenas opacity fixa 0.7
  // pra ainda sinalizar "loading state" sem movimento perturbador.
  const reducedMotion = useReducedMotion()
  const opacity = useSharedValue(1)
  const scale = useSharedValue(1)
  const rotate = useSharedValue(0)

  useEffect(() => {
    if (pulsing) {
      if (reducedMotion) {
        opacity.value = withTiming(0.7, { duration: 220 })
        scale.value = withTiming(1, { duration: 220 })
        rotate.value = withTiming(0, { duration: 220 })
        return
      }
      opacity.value = withRepeat(
        withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      )
      scale.value = withRepeat(
        withTiming(1.28, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      )
      rotate.value = withRepeat(
        withTiming(360, { duration: 4200, easing: Easing.linear }),
        -1,
        false,
      )
    } else {
      opacity.value = withTiming(1, { duration: 220 })
      scale.value = withTiming(1, { duration: 220 })
      rotate.value = withTiming(0, { duration: 220 })
    }
  }, [pulsing, opacity, scale, rotate, reducedMotion])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }))

  return (
    <Animated.View style={style}>
      <BronzeDiamond size={20} opacity={0.9} />
    </Animated.View>
  )
}
