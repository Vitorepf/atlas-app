/**
 * PressableScale · primitivos de feedback tátil canon Atlas.
 *
 * Press canon iOS-grade — extraído do AtlasComposerCard pra que toda
 * affordance da app (icon · pill · text · surface) tenha o mesmo gesto:
 *
 *   press-in:  withTiming(scale, 120ms, ease.out.quad)
 *   press-out: withSpring(1, damping:14, stiffness:240, mass:0.7)
 *
 * Mais haptic opcional (Soft padrão · Light commit · Medium destrutivo).
 *
 * Sem libs novas · só react-native + reanimated + expo-haptics.
 *
 * NUNCA usar Pressable cru com `opacity: pressed ? 0.5 : 1` — isso é o
 * tell de UI SaaS. Os primitivos aqui dão press com peso, não com flicker.
 */
import { type ReactNode } from 'react'
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

type HapticKind = 'soft' | 'light' | 'medium' | 'none'

const HAPTIC: Record<Exclude<HapticKind, 'none'>, Haptics.ImpactFeedbackStyle> = {
  soft: Haptics.ImpactFeedbackStyle.Soft,
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
}

function fireHaptic(kind: HapticKind) {
  if (kind === 'none') return
  void Haptics.impactAsync(HAPTIC[kind]).catch(() => {})
}

const PRESS_SPRING = { damping: 14, stiffness: 240, mass: 0.7 } as const
const PRESS_IN_DURATION = 120
const PRESS_IN_EASING = Easing.out(Easing.quad)

interface BasePressProps {
  onPress?: () => void
  onLongPress?: () => void
  delayLongPress?: number
  disabled?: boolean
  accessibilityLabel?: string
  accessibilityHint?: string
  accessibilityRole?: PressableProps['accessibilityRole']
  hitSlop?: PressableProps['hitSlop']
  haptic?: HapticKind
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * PressableIconScale · botão de ícone 36×36 com scale 0.95.
 * Usado em mic · send · paperclip · close · qualquer affordance de ícone.
 */
export function PressableIconScale({
  onPress,
  onLongPress,
  delayLongPress,
  disabled,
  accessibilityLabel,
  accessibilityHint,
  hitSlop = 10,
  haptic = 'soft',
  children,
  style,
}: BasePressProps) {
  const pressScale = useSharedValue(1)
  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))
  return (
    <Animated.View style={pressAnimStyle}>
      <Pressable
        onPress={() => {
          if (!disabled) {
            fireHaptic(haptic)
            onPress?.()
          }
        }}
        onLongPress={onLongPress}
        delayLongPress={delayLongPress}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPressIn={() => {
          pressScale.value = withTiming(0.95, { duration: PRESS_IN_DURATION, easing: PRESS_IN_EASING })
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, PRESS_SPRING)
        }}
        style={({ pressed }) => [
          styles.iconBtn,
          style,
          { opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
}

/**
 * PressablePillScale · pill com scale 0.96 + spring.
 * Usado em routing pill, effort pill, mini-action, choice pill (priority/energy).
 * Press feedback é por scale + background, não opacity solo.
 */
interface PillProps extends BasePressProps {
  pressedBackground?: string
}

export function PressablePillScale({
  onPress,
  disabled,
  accessibilityLabel,
  hitSlop = 6,
  haptic = 'soft',
  children,
  style,
  pressedBackground,
}: PillProps) {
  const pressScale = useSharedValue(1)
  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))
  return (
    <Animated.View style={pressAnimStyle}>
      <Pressable
        onPress={() => {
          if (!disabled) {
            fireHaptic(haptic)
            onPress?.()
          }
        }}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => {
          pressScale.value = withTiming(0.96, { duration: PRESS_IN_DURATION, easing: PRESS_IN_EASING })
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, PRESS_SPRING)
        }}
        style={({ pressed }) => [
          style,
          {
            backgroundColor: pressed && pressedBackground ? pressedBackground : undefined,
            opacity: disabled ? 0.4 : 1,
          },
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
}

/**
 * PressableTextScale · scale 0.97 + opacity sutil.
 * Pra texto editorial pressionável (taskActions "Feita · Adiar · Editar",
 * agendaToggle "ver agenda completa", empty states "Capturar primeira tarefa.").
 *
 * Press canon mais discreto · 0.97 (não 0.95 do ícone) porque o texto
 * editorial não é um botão · é um gesto sussurrado.
 */
export function PressableTextScale({
  onPress,
  disabled,
  accessibilityLabel,
  hitSlop = 6,
  haptic = 'soft',
  children,
  style,
}: BasePressProps) {
  const pressScale = useSharedValue(1)
  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))
  return (
    <Animated.View style={pressAnimStyle}>
      <Pressable
        onPress={() => {
          if (!disabled) {
            fireHaptic(haptic)
            onPress?.()
          }
        }}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPressIn={() => {
          pressScale.value = withTiming(0.97, { duration: PRESS_IN_DURATION, easing: PRESS_IN_EASING })
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, PRESS_SPRING)
        }}
        style={({ pressed }) => [
          style,
          { opacity: disabled ? 0.4 : pressed ? 0.62 : 1 },
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
}

/**
 * PressableSurfaceScale · scale 0.985 + opacity 0.55.
 * Pra superfícies inteiras pressionáveis (saveCheckin signature, task block
 * inteira como tap-area, mission card). Mais sutil que TextScale porque
 * abrange área grande · um shift muito visível seria estranho em surface.
 */
export function PressableSurfaceScale({
  onPress,
  onLongPress,
  disabled,
  accessibilityLabel,
  hitSlop,
  haptic = 'soft',
  children,
  style,
}: BasePressProps) {
  const pressScale = useSharedValue(1)
  const pressOpacity = useSharedValue(1)
  const pressAnimStyle = useAnimatedStyle(() => ({
    opacity: pressOpacity.value,
    transform: [{ scale: pressScale.value }],
  }))
  return (
    <Pressable
      onPress={() => {
        if (!disabled) {
          fireHaptic(haptic)
          onPress?.()
        }
      }}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        pressScale.value = withTiming(0.985, { duration: 220, easing: Easing.bezier(0.32, 0, 0.67, 0) })
        pressOpacity.value = withTiming(0.55, { duration: 220, easing: Easing.bezier(0.32, 0, 0.67, 0) })
      }}
      onPressOut={() => {
        pressScale.value = withTiming(1, { duration: 360, easing: Easing.bezier(0.16, 1, 0.3, 1) })
        pressOpacity.value = withTiming(1, { duration: 360, easing: Easing.bezier(0.16, 1, 0.3, 1) })
      }}
    >
      <Animated.View style={[style, pressAnimStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
})
