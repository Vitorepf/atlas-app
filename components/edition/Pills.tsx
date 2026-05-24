/**
 * Pills canon Atlas Mobile · MiniActionPill + ChoicePill.
 *
 * Substituem os MiniAction (radius 16, Sans sb 11.5 prussian) e TaskChip
 * (radius 16, Sans med 11.5, active = prussian background full chapado)
 * antigos do edicao.tsx por pills do mesmo DNA do composer:
 *
 *   radius 999 · hairline border · gold dot 5.5×5.5 · Frau italic 13
 *
 * Active state premium: borda bronzeBorder alpha 0.34 + background
 * bronzeVeil alpha 0.10 + dot opacidade 0.95 + texto bronzeLight.
 * Em vez de virar "botão preenchido", a pill ganha um halo bronze
 * sutil — coerente com o composer pill auto/effort.
 *
 * Press feedback via PressablePillScale (scale 0.96 + spring + haptic Soft).
 */
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { PressablePillScale } from '../atlas-ui/PressableScale'

const ACTIVATE_DURATION = 280
const ACTIVATE_EASING = Easing.out(Easing.cubic)

interface MiniActionPillProps {
  label: string
  onPress: () => void
  disabled?: boolean
  accessibilityLabel?: string
}

/**
 * Pill estática · gold dot + Frau italic. Usada em "planejar hoje",
 * "planejar semana", "marcar plano" (e qualquer ação não-toggle).
 *
 * Round 2 polish · quando disabled (loading "planejando", "marcando"),
 * o gold dot pulsa subtilmente (0.55↔0.95 em 1100ms cada lado).
 * Mesma vocabulary do processingPulse do composer: "Atlas pensando"
 * via marca d'água viva, não spinner SaaS. useReducedMotion guard.
 */
export function MiniActionPill({
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
}: MiniActionPillProps) {
  const c = usePalette()
  const reducedMotion = useReducedMotion()
  const dotPulse = useSharedValue(0.95)

  useEffect(() => {
    if (disabled && !reducedMotion) {
      dotPulse.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.95, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      )
    } else {
      cancelAnimation(dotPulse)
      dotPulse.value = withTiming(0.95, { duration: 220 })
    }
  }, [disabled, reducedMotion, dotPulse])

  const dotPulseStyle = useAnimatedStyle(() => ({
    opacity: dotPulse.value,
  }))

  return (
    <PressablePillScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      pressedBackground={c.bgRaised}
      style={[styles.pill, { borderColor: c.border }]}
    >
      <View style={styles.pillInner}>
        <Animated.View style={[styles.dot, { backgroundColor: c.bronze }, dotPulseStyle]} />
        <Frau italic size={13} lineHeight={16} color={c.ink2} numberOfLines={1}>
          {label}
        </Frau>
      </View>
    </PressablePillScale>
  )
}

interface ChoicePillProps {
  label: string
  active: boolean
  onPress: () => void
  disabled?: boolean
  accessibilityLabel?: string
}

/**
 * Pill com toggle active · usada em priority/energy choices do TaskEditor.
 * Active: border bronzeBorder + bg bronzeVeil + dot fade-in + texto bronzeLight.
 * Animação 280ms editorial · sincroniza com placeholder fade e border focus.
 */
export function ChoicePill({
  label,
  active,
  onPress,
  disabled = false,
  accessibilityLabel,
}: ChoicePillProps) {
  const c = usePalette()
  const progress = useSharedValue(active ? 1 : 0)

  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, {
      duration: ACTIVATE_DURATION,
      easing: ACTIVATE_EASING,
    })
  }, [active, progress])

  const bgAndBorderStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['rgba(0,0,0,0)', c.bronzeVeil],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [c.border, c.bronzeBorder],
    ),
    // Bronze glow halo · shadow sutil sob a pill active.
    // Não é tell SaaS (color shadow saturada) · é peso aurélico que diz
    // "esse foi o escolhido". Native shadowColor + opacity interpolada.
    shadowColor: c.bronze,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: progress.value * 0.15,
    shadowRadius: 4 + progress.value * 2,
  }))

  // Dot · scale via spring (não linear) · canon iOS-grade.
  // Sai de 0.4 e cresce até 1.0 com leve overshoot natural do spring.
  const dotScale = useSharedValue(active ? 1 : 0.4)
  useEffect(() => {
    dotScale.value = active
      ? withSpring(1, { damping: 14, stiffness: 280, mass: 0.65 })
      : withTiming(0.4, { duration: 200, easing: ACTIVATE_EASING })
  }, [active, dotScale])

  const dotStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.95,
    transform: [{ scale: dotScale.value }],
  }))

  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [c.ink2, c.bronzeLight]),
  }))

  return (
    <PressablePillScale
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      style={styles.choicePillOuter}
    >
      <Animated.View style={[styles.pill, bgAndBorderStyle]}>
        <View style={styles.pillInner}>
          <Animated.View style={[styles.dot, { backgroundColor: c.bronze }, dotStyle]} />
          <AnimatedFrau italic size={13} lineHeight={16} style={textStyle} numberOfLines={1}>
            {label}
          </AnimatedFrau>
        </View>
      </Animated.View>
    </PressablePillScale>
  )
}

const AnimatedFrau = Animated.createAnimatedComponent(Frau)

const styles = StyleSheet.create({
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
    minHeight: 28,
  },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  choicePillOuter: {
    // Outer wrapper sem estilo · o background/border animados ficam no
    // Animated.View interno. Mantém a press scale separada do active fade.
  },
  dot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
  },
})
