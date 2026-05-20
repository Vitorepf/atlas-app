/**
 * Cartografia · hook de pulso editorial pra trilhas.
 *
 * Retorna `animatedStyle` que pulsa opacity 0.7 → 1.0 → 0.7 num ciclo de
 * ~3.6s. Sensação de "fluxo vivo" sutil · não SaaS blinking. Respeita
 * `prefers-reduced-motion` (Reanimated `useReducedMotion`).
 */
import { useEffect } from 'react'
import {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

interface Options {
  enabled: boolean
  /** opacidade mínima (vale chão) · default 0.72 */
  min?: number
  /** opacidade máxima (vale teto) · default 1 */
  max?: number
  /** duração de meio ciclo (ms) · default 1800 (ciclo total 3.6s) */
  halfPeriod?: number
}

export function useTrailPulse({ enabled, min = 0.72, max = 1, halfPeriod = 1800 }: Options) {
  const value = useSharedValue(enabled ? min : 1)

  useEffect(() => {
    if (!enabled) {
      cancelAnimation(value)
      value.value = 1
      return
    }
    value.value = min
    value.value = withRepeat(
      withTiming(max, { duration: halfPeriod, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
      -1,
      true, // reverse · vai e volta
    )
    return () => cancelAnimation(value)
  }, [enabled, min, max, halfPeriod, value])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: value.value,
  }))

  return animatedStyle
}
