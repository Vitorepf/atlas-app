import { useEffect, useRef, type ReactNode } from 'react'
import { Keyboard, StyleSheet, View, useWindowDimensions } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Scrim } from './Scrim'
import { useTheme } from '../../design/theme'

interface Props {
  visible: boolean
  onClose: () => void
  height?: '85%' | '40%' | number
  children: ReactNode
  scrimStrength?: 'normal' | 'strong'
}

// Threshold to dismiss: fraction of sheet height OR raw velocity.
const DISMISS_FRACTION = 0.18           // 18% of sheet height
const DISMISS_VELOCITY = 800            // pixels/second
const OVERSCROLL_RESISTANCE = 0.28      // rubber-band when pulling up
// Spring tuned to feel like a physical card returning to position —
// quick but with a hint of weight. Think paper, not jelly.
const RETURN_SPRING = { damping: 22, stiffness: 280, mass: 0.85 }

// Premium drag-to-close bottom sheet.
// — handle area is generously tappable (~64px touch target above the visible bar)
// — drag responds 1:1 with the finger; rubber-band resistance when pulled up
// — scrim fades in proportion to drag distance
// — soft haptic at drag start and at dismiss
// — taps inside the handle area still pass through (activeOffsetY)
export function BottomSheet({
  visible,
  onClose,
  height = '85%',
  children,
  scrimStrength,
}: Props) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { height: winH } = useWindowDimensions()

  const sheetH =
    typeof height === 'number'
      ? height
      : winH * (height === '85%' ? 0.85 : 0.4)

  const ty = useSharedValue(sheetH)
  const dragY = useSharedValue(0)
  // Flag · gesture já está fechando o sheet · suprime a withTiming duplicada que
  // o useEffect dispararia quando visible=false propaga via runOnJS(onClose).
  // Sem isso: drag-close inicia withTiming(200ms), state volta, useEffect inicia
  // OUTRO withTiming(380ms) por cima → animações conflitam, sheet trava/pula.
  const closingFromGestureRef = useRef(false)

  useEffect(() => {
    // Dismiss keyboard whenever a sheet rises — it'd otherwise overlap the
    // sheet's content and hide footer actions. Sheets that legitimately
    // need text entry mount their TextInputs after open and refocus then.
    if (visible) {
      Keyboard.dismiss()
      closingFromGestureRef.current = false
      // v15.2 · OPEN com spring · "papel pesado caindo" em vez de timing linear.
      // damping 22 / stiffness 220 / mass 0.9 → settle natural sem bounce jelly.
      // Trade-off: fechar mantém withTiming (mais previsível pra dismissal).
      ty.value = withSpring(0, {
        damping: 22,
        stiffness: 220,
        mass: 0.9,
      })
    } else {
      // Só dispara animação de fechamento se NÃO foi gesture-closed
      // (gesture já está animando ty → sheetH com timing próprio).
      if (!closingFromGestureRef.current) {
        ty.value = withTiming(sheetH, {
          duration: 380,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })
      }
      dragY.value = 0
    }
  }, [visible, ty, dragY, sheetH])

  // 1 when sheet is fully open, 0 when fully dragged away. Drives scrim fade.
  const scrimFade = useDerivedValue(() =>
    interpolate(ty.value + dragY.value, [0, sheetH], [1, 0], 'clamp'),
  )

  const triggerHapticStart = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)
  }
  const triggerHapticDismiss = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }
  // Marca a flag JS antes do onClose · runOnJS executa em ordem síncrona,
  // então useEffect lê closingFromGestureRef.current = true antes de animar.
  const markClosingFromGesture = () => {
    closingFromGestureRef.current = true
  }

  const dragGesture = Gesture.Pan()
    // Only activate after a real downward drag — lets taps and short scrolls
    // inside the handle area pass through.
    .activeOffsetY(8)
    .failOffsetY(-12)
    .onStart(() => {
      runOnJS(triggerHapticStart)()
    })
    .onUpdate((event) => {
      'worklet'
      // Pulling down: 1:1 follow. Pulling up: rubber-band resistance.
      if (event.translationY >= 0) {
        dragY.value = event.translationY
      } else {
        dragY.value = event.translationY * OVERSCROLL_RESISTANCE
      }
    })
    .onEnd((event) => {
      'worklet'
      const traveled = event.translationY
      const velocity = event.velocityY
      const shouldDismiss =
        traveled > sheetH * DISMISS_FRACTION || velocity > DISMISS_VELOCITY

      if (shouldDismiss) {
        // BAKE drag delta em ty antes de resetar dragY · evita snap-back visual.
        // Sem este passo: ty=0 + dragY=200 (sheet em y=200) → reset dragY=0 →
        // sheet pula pra y=0 → withTiming desce → user vê bounce/bug.
        // Com bake: ty=200 + dragY=0 (mesmo y=200) → withTiming desce smooth.
        const startY = ty.value + dragY.value
        ty.value = startY
        dragY.value = 0

        // Calcula duration em função da distância remanescente e velocidade
        // do gesto · momentum natural sem freadas bruscas.
        const remaining = sheetH - startY
        const minDuration = 180
        const maxDuration = 320
        const computed = velocity > 0 ? (remaining / velocity) * 1000 : maxDuration
        const duration = Math.max(minDuration, Math.min(maxDuration, computed))

        ty.value = withTiming(sheetH, {
          duration,
          easing: Easing.bezier(0.32, 0.72, 0, 1),
        })

        // Marca closingFromGesture ANTES de onClose · garante que o useEffect
        // que vai disparar não inicie outra animação concorrente.
        runOnJS(markClosingFromGesture)()
        runOnJS(triggerHapticDismiss)()
        runOnJS(onClose)()
      } else {
        dragY.value = withSpring(0, RETURN_SPRING)
      }
    })

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value + dragY.value }],
  }))

  return (
    <>
      <Scrim visible={visible} onPress={onClose} strength={scrimStrength} fade={scrimFade} />
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          styles.sheet,
          {
            backgroundColor: c.bg,
            height: sheetH,
            // 2026-05 v10 · removido paddingBottom: insets.bottom · double safe-area.
            // Children (QuickActionBar, BottomSheet conteúdo) gerenciam própria safe-area.
            // Antes: bar absoluta bottom:0 ficava acima do inset, deixava marfim entre
            // bar e home indicator → "torto e quebrado".
            shadowColor: '#1C1916',
          },
          animStyle,
        ]}
      >
        <GestureDetector gesture={dragGesture}>
          <View style={styles.handleArea} collapsable={false}>
            <View style={[styles.handle, { backgroundColor: c.border }]} />
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    zIndex: 56,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 16,
  },
  // Generous drag/tap target around the visible handle bar — about 56-64px
  // tall so the user can grab anywhere "perto da gaveta", not just the 4px line.
  // v10 · paddingBottom 28→24 (v7 spec, ritmo handle→meta mais crisp).
  handleArea: {
    paddingTop: 14,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 999,
  },
})
