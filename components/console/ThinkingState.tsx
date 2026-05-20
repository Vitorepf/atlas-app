import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { BronzeDiamond } from './BronzeDiamond'

interface Props {
  startedAtMs: number
  // Editorial subject: 'claude', 'codex', 'conselho', 'atlas', etc.
  // When undefined, defaults to 'atlas' (Auto routing).
  provider?: string
}

// "Thinking" state for an active turn. Three phases of voice based on elapsed time:
//   0–3s   → "na fila"
//   3–15s  → "{provider} pensando"
//   15–45s → "{provider} pensando há {N}s"
//   45s+   → "{provider} ainda pensando — pode demorar"
//
// The bronze diamond pulses (1.0 ↔ 0.3 in 900ms) the entire time. The phrase
// changes once per second; the diamond never stops breathing.
export function ThinkingState({ startedAtMs, provider }: Props) {
  const c = usePalette()
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)),
  )

  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAtMs])

  // Slice 6ai · reducedMotion guard canon accessibility · pulse infinito
  // desativa quando user habilita Reduce Motion · opacity fixa 0.65.
  const reducedMotion = useReducedMotion()
  const opacity = useSharedValue(1)
  useEffect(() => {
    if (reducedMotion) {
      opacity.value = withTiming(0.65, { duration: 200 })
      return
    }
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
  }, [opacity, reducedMotion])
  const pulseStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(220)}
      style={styles.row}
    >
      <Animated.View style={pulseStyle}>
        <BronzeDiamond size={20} />
      </Animated.View>
      <Frau italic size={13} lineHeight={18} color={c.ink} style={styles.phrase}>
        {thinkingPhrase(elapsed, provider)}
      </Frau>
    </Animated.View>
  )
}

function thinkingPhrase(elapsed: number, provider?: string): string {
  const subject = provider ?? 'atlas'
  if (elapsed < 3)  return 'na fila'
  if (elapsed < 15) return `${subject} pensando`
  if (elapsed < 45) return `${subject} pensando há ${elapsed}s`
  return `${subject} ainda pensando — pode demorar`
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  phrase: {
    opacity: 0.45,
    marginTop: 14,
  },
})
