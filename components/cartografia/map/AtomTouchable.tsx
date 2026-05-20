/**
 * Cartografia · touchable canon pra atoms dentro do canvas vivo.
 *
 * Substitui `<Pressable>` porque Pressable nativo CAPTURA o touch antes
 * do GestureDetector pai · resultado: pan/pinch do canvas não dispara
 * quando o dedo está sobre um atom. Com `Gesture.Tap()` aninhado, a
 * mecânica RNGH v2 trata corretamente:
 *
 *   - tap rápido (sem movimento) → onPress dispara · scale press canon
 *   - drag a partir do atom (movimento > maxDistance) → tap falha,
 *     pan/pinch do parent assume
 *
 * Sem isso, a Cartografia parece estática · "canvas morto".
 */
import { type ReactNode, useCallback } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

interface Props {
  onPress: () => void
  /** estilo do shell · positioning/dimensão (left, top, width, height...) */
  shellStyle: StyleProp<ViewStyle>
  children: ReactNode
  /** opacity durante press · default 0.85 */
  pressOpacity?: number
  /** distância máxima em px que dedo pode mover antes do tap falhar · default 8 */
  maxDistance?: number
  /** Quanto o atom "afunda" no press · default 1.5px (lift inverso canon) */
  liftAmount?: number
  /** Long-press callback opcional · 500ms hold dispara · haptic Medium */
  onLongPress?: () => void
}

export function AtomTouchable({
  onPress,
  shellStyle,
  children,
  pressOpacity = 0.85,
  maxDistance = 8,
  liftAmount = 1.5,
  onLongPress,
}: Props) {
  const pressed = useSharedValue(0)
  // Ring expand · dispara no commit success do tap · halo bronze
  // expandindo + fadeout em 380ms. Sensação canon "ação confirmada"
  // sem precisar de toast.
  const ringScale = useSharedValue(0)
  const ringOpacity = useSharedValue(0)

  const triggerHaptic = () => {
    void Haptics.selectionAsync().catch(() => {})
  }
  const triggerLongPressHaptic = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  }
  const triggerLongPress = useCallback(() => {
    if (!onLongPress) return
    requestAnimationFrame(() => {
      onLongPress()
    })
  }, [onLongPress])

  const tap = Gesture.Tap()
    .maxDistance(maxDistance)
    .maxDuration(800)
    .onBegin(() => {
      'worklet'
      pressed.value = withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) })
      // Haptic Soft canon · feedback tátil imediato no touch begin.
      // Sensação enterprise · "objeto sólido respondendo ao toque".
      runOnJS(triggerHaptic)()
    })
    .onEnd((_e, success) => {
      'worklet'
      pressed.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) })
      if (success) {
        // Ring confirmation editorial · expand + fadeout
        ringScale.value = 0.95
        ringOpacity.value = 0.42
        ringScale.value = withTiming(1.12, { duration: 380, easing: Easing.bezier(0.16, 1, 0.3, 1) })
        ringOpacity.value = withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) })
        runOnJS(onPress)()
      }
    })
    .onFinalize(() => {
      'worklet'
      pressed.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) })
    })

  // Long-press compete com tap: o primeiro gesto válido vence. Assim o
  // tap curto continua imediato, e o hold não navega junto por acidente.
  const longPress = Gesture.LongPress()
    .minDuration(500)
    .maxDistance(10)
    .onStart(() => {
      'worklet'
      runOnJS(triggerLongPressHaptic)()
    })
    .onEnd((_e, success) => {
      'worklet'
      pressed.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.cubic) })
      if (success) {
        runOnJS(triggerLongPress)()
      }
    })
    .onFinalize(() => {
      'worklet'
      pressed.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) })
    })

  const composed = onLongPress ? Gesture.Race(longPress, tap) : tap

  const animatedStyle = useAnimatedStyle(() => {
    const p = pressed.value
    return {
      opacity: 1 - p * (1 - pressOpacity),
      transform: [
        { translateY: p * liftAmount },
        { scale: 1 - p * 0.012 },
      ],
    }
  }) as StyleProp<ViewStyle>

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  })) as StyleProp<ViewStyle>

  return (
    <GestureDetector gesture={composed}>
      <Animated.View style={[shellStyle, animatedStyle]}>
        <Animated.View
          pointerEvents="none"
          style={[localStyles.ring, ringStyle, { borderColor: 'rgba(212, 168, 90, 0.8)' }]}
        />
        {children}
      </Animated.View>
    </GestureDetector>
  )
}

const localStyles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderWidth: 1.5,
    borderRadius: 6,
  },
})
