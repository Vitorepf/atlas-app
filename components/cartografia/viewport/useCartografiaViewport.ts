/**
 * Cartografia · viewport hook · Reanimated shared values + gestos.
 *
 * Mantém `scale`/`translateX`/`translateY` como shared values worklet-safe.
 * Aplica fit() automático quando o viewport é medido pela primeira vez.
 * Expõe `animatedStyle` pronto pra colocar no `<Animated.View>` do mundo,
 * `composedGesture` pra `<GestureDetector>`, e callback `onLayout` pro
 * viewport ancorar dimensões.
 *
 * LOD class é derivada de `scale` via `useAnimatedReaction` · runOnJS
 * dispara `setLod` só quando a faixa muda (não a cada frame).
 */
import { useCallback, useRef, useState } from 'react'
import { type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Gesture } from 'react-native-gesture-handler'
import {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import {
  LOD_FAR_MAX,
  LOD_MID_MAX,
  MAX_SCALE,
  MIN_SCALE,
  VIEWPORT_PADDING,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type LodLevel,
} from '../map/layout'
import {
  clampScale,
  clampTranslate,
  computeTranslateBounds,
  fitWorld,
  zoomAroundPoint,
} from './viewportMath'

export interface CartografiaViewport {
  /** Pronto para spread em `<Animated.View style={[..., animatedStyle]}>`. */
  animatedStyle: StyleProp<ViewStyle>
  composedGesture: ReturnType<typeof Gesture.Simultaneous>
  onLayout: (e: LayoutChangeEvent) => void
  fit: () => void
  /** Centraliza viewport num world-point específico mantendo scale atual. */
  teleport: (worldX: number, worldY: number) => void
  /** Focus on a world rect com scale alvo (smooth animation) */
  focusOnRect: (rect: { x: number; y: number; w: number; h: number }, targetScale?: number) => void
  lod: LodLevel
  scalePercent: number
  viewportReady: boolean
  /** Shared values expostos pra mini-map / overlays sync ao vivo */
  scale: SharedValue<number>
  translateX: SharedValue<number>
  translateY: SharedValue<number>
  /** Tamanho do viewport (medido via onLayout) · 0 antes do boot */
  viewportSize: { w: number; h: number }
}

// JS-side haptic trigger pra "bate limite" do pinch · chamado via runOnJS
function fireLimitHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
}

export function useCartografiaViewport(): CartografiaViewport {
  const scale = useSharedValue(0.4)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)

  // Pinch saved state (snapshot no onStart pra zoom focal consistente)
  const savedScale = useSharedValue(0.4)
  const savedX = useSharedValue(0)
  const savedY = useSharedValue(0)
  const focalX = useSharedValue(0)
  const focalY = useSharedValue(0)
  // Track pinch limit · dispara haptic na transição
  const wasAtLimit = useSharedValue(false)

  // Viewport size (JS state — só lemos uma vez no onLayout pra fit boot)
  const viewportSize = useRef({ w: 0, h: 0 })
  // Worklet-accessible viewport size · shared values pra usar em gestos
  // sem cross-thread JS (useRef.current não é worklet-safe).
  const vpW = useSharedValue(0)
  const vpH = useSharedValue(0)
  // Smart minScale dinâmico · responsive ao viewport. Calculado em
  // onLayout como `fitScale * 0.85` · impede zoom-out exagerado em que o
  // canvas vira um ponto perdido. Cap em MIN_SCALE pra mundos minúsculos.
  const minDynamicScale = useSharedValue(MIN_SCALE)
  const [viewportReady, setViewportReady] = useState(false)
  const [lod, setLod] = useState<LodLevel>('far')
  const [scalePercent, setScalePercent] = useState(40)

  /** Aplica fit() centralizado no viewport · usado no boot e no botão fit. */
  const fit = useCallback(() => {
    const { w, h } = viewportSize.current
    if (w <= 0 || h <= 0) return
    cancelAnimation(translateX)
    cancelAnimation(translateY)
    cancelAnimation(scale)
    const target = fitWorld({
      viewportW: w,
      viewportH: h,
      worldW: WORLD_WIDTH,
      worldH: WORLD_HEIGHT,
      padding: VIEWPORT_PADDING,
    })
    const dur = 380
    scale.value = withTiming(target.scale, { duration: dur, easing: Easing.bezier(0.16, 1, 0.3, 1) })
    translateX.value = withTiming(target.x, { duration: dur, easing: Easing.bezier(0.16, 1, 0.3, 1) })
    translateY.value = withTiming(target.y, { duration: dur, easing: Easing.bezier(0.16, 1, 0.3, 1) })
  }, [scale, translateX, translateY])

  /** Centraliza no world point (wx, wy) preservando scale atual */
  const teleport = useCallback(
    (wx: number, wy: number) => {
      const { w, h } = viewportSize.current
      if (w <= 0 || h <= 0) return
      cancelAnimation(translateX)
      cancelAnimation(translateY)
      const s = scale.value
      const targetX = w / 2 - wx * s
      const targetY = h / 2 - wy * s
      const dur = 360
      translateX.value = withTiming(targetX, { duration: dur, easing: Easing.bezier(0.16, 1, 0.3, 1) })
      translateY.value = withTiming(targetY, { duration: dur, easing: Easing.bezier(0.16, 1, 0.3, 1) })
    },
    [scale, translateX, translateY],
  )

  /** Foca num retângulo world-space com scale alvo (default 1.55) */
  const focusOnRect = useCallback(
    (rect: { x: number; y: number; w: number; h: number }, targetScale = 1.55) => {
      const { w, h } = viewportSize.current
      if (w <= 0 || h <= 0) return
      cancelAnimation(translateX)
      cancelAnimation(translateY)
      cancelAnimation(scale)
      const s = clampScale(targetScale, MIN_SCALE, MAX_SCALE)
      const cx = rect.x + rect.w / 2
      const cy = rect.y + rect.h / 2
      const targetX = w / 2 - cx * s
      const targetY = h / 2 - cy * s
      const dur = 420
      const ease = Easing.bezier(0.16, 1, 0.3, 1)
      scale.value = withTiming(s, { duration: dur, easing: ease })
      translateX.value = withTiming(targetX, { duration: dur, easing: ease })
      translateY.value = withTiming(targetY, { duration: dur, easing: ease })
    },
    [scale, translateX, translateY],
  )

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout
      const first = viewportSize.current.w === 0
      viewportSize.current = { w: width, h: height }
      vpW.value = width
      vpH.value = height
      // Atualiza minScale dinâmico baseado em viewport atual
      if (width > 0 && height > 0) {
        const fitScale = Math.min(
          (width - VIEWPORT_PADDING * 2) / WORLD_WIDTH,
          (height - VIEWPORT_PADDING * 2) / WORLD_HEIGHT,
        )
        // Permite zoom-out até 50% do fit · user pode dar zoom-out
        // bem além do mundo, sensação de "espaço aberto".
        minDynamicScale.value = Math.max(MIN_SCALE, fitScale * 0.5)
      }
      if (first && width > 0 && height > 0) {
        // Boot ergonomic · câmera "descobre" o mapa.
        // 1) Inicia 12% mais zoom-in que fit
        // 2) Anima suavemente até fit canon em 580ms (ease-considered)
        // 3) Sensação canon "câmera centrando" · canon NYRB plate.
        const target = fitWorld({
          viewportW: width,
          viewportH: height,
          worldW: WORLD_WIDTH,
          worldH: WORLD_HEIGHT,
          padding: VIEWPORT_PADDING,
        })
        const startScale = target.scale * 1.12
        const startX = (width - WORLD_WIDTH * startScale) / 2
        const startY = (height - WORLD_HEIGHT * startScale) / 2
        scale.value = startScale
        translateX.value = startX
        translateY.value = startY
        savedScale.value = startScale
        savedX.value = startX
        savedY.value = startY
        // Anima até fit canon
        const dur = 580
        const ease = Easing.bezier(0.16, 1, 0.3, 1)
        scale.value = withTiming(target.scale, { duration: dur, easing: ease })
        translateX.value = withTiming(target.x, { duration: dur, easing: ease })
        translateY.value = withTiming(target.y, { duration: dur, easing: ease })
        setViewportReady(true)
      }
    },
    [scale, translateX, translateY, savedScale, savedX, savedY],
  )

  // Pan · arrasta com 1 dedo. minDistance pequeno pra ativar logo · tap
  // dos atoms tem maxDistance=8 (menor), então tap vence em toque parado
  // e pan vence quando user arrasta · race nativo do RNGH v2.
  //
  // CLAMP CRÍTICO: tanto onChange quanto withDecay aplicam clampTranslate
  // pra IMPEDIR o usuário de perder o canvas no espaço. Bounds calculados
  // ao vivo baseado em scale atual + viewport size.
  const panGesture = Gesture.Pan()
    .minDistance(6)
    .averageTouches(true)
    .onBegin(() => {
      'worklet'
      cancelAnimation(translateX)
      cancelAnimation(translateY)
    })
    .onChange((e) => {
      'worklet'
      const nextX = translateX.value + e.changeX
      const nextY = translateY.value + e.changeY
      const bounds = computeTranslateBounds(
        scale.value,
        vpW.value,
        vpH.value,
        WORLD_WIDTH,
        WORLD_HEIGHT,
      )
      const clamped = clampTranslate(nextX, nextY, bounds)
      translateX.value = clamped.x
      translateY.value = clamped.y
    })
    .onEnd((e) => {
      'worklet'
      // Momentum com clamp · withDecay aceita `clamp` (array de 2 nums)
      // que freia a animação ao bater os limites. UX Figma feel sem perder
      // canvas.
      const bounds = computeTranslateBounds(
        scale.value,
        vpW.value,
        vpH.value,
        WORLD_WIDTH,
        WORLD_HEIGHT,
      )
      translateX.value = withDecay({
        velocity: e.velocityX,
        deceleration: 0.997,
        clamp: [bounds.minX, bounds.maxX],
      })
      translateY.value = withDecay({
        velocity: e.velocityY,
        deceleration: 0.997,
        clamp: [bounds.minY, bounds.maxY],
      })
    })

  // Pinch · zoom focal mantendo o ponto entre os dedos fixo na tela.
  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      'worklet'
      // Pinch interrompe momentum em curso · evita brigas entre o gesto
      // ativo e a decay animation residual de um pan anterior.
      cancelAnimation(translateX)
      cancelAnimation(translateY)
      cancelAnimation(scale)
    })
    .onStart((e) => {
      'worklet'
      savedScale.value = scale.value
      savedX.value = translateX.value
      savedY.value = translateY.value
      focalX.value = e.focalX
      focalY.value = e.focalY
    })
    .onChange((e) => {
      'worklet'
      const target = zoomAroundPoint({
        scale: savedScale.value,
        x: savedX.value,
        y: savedY.value,
        factor: e.scale,
        focalX: focalX.value,
        focalY: focalY.value,
        min: minDynamicScale.value,
        max: MAX_SCALE,
      })
      const bounds = computeTranslateBounds(
        target.scale,
        vpW.value,
        vpH.value,
        WORLD_WIDTH,
        WORLD_HEIGHT,
      )
      const clamped = clampTranslate(target.x, target.y, bounds)
      scale.value = target.scale
      translateX.value = clamped.x
      translateY.value = clamped.y
      // Haptic Light no bate-limite · feedback canon "encontrou parede".
      const atLimit =
        target.scale >= MAX_SCALE - 0.01 ||
        target.scale <= minDynamicScale.value + 0.01
      if (atLimit && !wasAtLimit.value) {
        runOnJS(fireLimitHaptic)()
      }
      wasAtLimit.value = atLimit
    })
    .onEnd(() => {
      'worklet'
      scale.value = clampScale(scale.value, minDynamicScale.value, MAX_SCALE)
      const bounds = computeTranslateBounds(
        scale.value,
        vpW.value,
        vpH.value,
        WORLD_WIDTH,
        WORLD_HEIGHT,
      )
      const clamped = clampTranslate(translateX.value, translateY.value, bounds)
      translateX.value = clamped.x
      translateY.value = clamped.y
      wasAtLimit.value = false
    })

  // Double-tap pra zoom in focal (1.6x). Se já está zoom-close, faz fit().
  // Padrão Figma/Miro/Maps · gesture canônico que ENSINA pelo movimento.
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDistance(16)
    .maxDelay(280)
    .onEnd((e, success) => {
      'worklet'
      if (!success) return
      cancelAnimation(translateX)
      cancelAnimation(translateY)
      cancelAnimation(scale)
      const currentScale = scale.value
      // Se já estamos próximos do max, fit() pra voltar ao panorama
      if (currentScale >= 1.0) {
        const { w, h } = viewportSize.current
        if (w > 0 && h > 0) {
          const fitTarget = {
            scale: Math.min(
              (w - VIEWPORT_PADDING * 2) / WORLD_WIDTH,
              (h - VIEWPORT_PADDING * 2) / WORLD_HEIGHT,
            ),
            x: 0,
            y: 0,
          }
          fitTarget.x = (w - WORLD_WIDTH * fitTarget.scale) / 2
          fitTarget.y = (h - WORLD_HEIGHT * fitTarget.scale) / 2
          const dur = 380
          scale.value = withTiming(fitTarget.scale, { duration: dur, easing: Easing.bezier(0.16, 1, 0.3, 1) })
          translateX.value = withTiming(fitTarget.x, { duration: dur, easing: Easing.bezier(0.16, 1, 0.3, 1) })
          translateY.value = withTiming(fitTarget.y, { duration: dur, easing: Easing.bezier(0.16, 1, 0.3, 1) })
        }
        return
      }
      // Zoom in 1.6x focal no ponto do double-tap
      const targetScale = clampScale(currentScale * 2.2, MIN_SCALE, MAX_SCALE)
      const target = zoomAroundPoint({
        scale: currentScale,
        x: translateX.value,
        y: translateY.value,
        factor: targetScale / currentScale,
        focalX: e.x,
        focalY: e.y,
        min: MIN_SCALE,
        max: MAX_SCALE,
      })
      const dur = 360
      scale.value = withTiming(target.scale, { duration: dur, easing: Easing.bezier(0.16, 1, 0.3, 1) })
      translateX.value = withTiming(target.x, { duration: dur, easing: Easing.bezier(0.16, 1, 0.3, 1) })
      translateY.value = withTiming(target.y, { duration: dur, easing: Easing.bezier(0.16, 1, 0.3, 1) })
    })

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture, doubleTapGesture)

  // LOD reaction · dispara setLod só quando faixa muda
  useAnimatedReaction(
    () => scale.value,
    (current, previous) => {
      if (previous === null) return
      let next: LodLevel = 'mid'
      if (current < LOD_FAR_MAX) next = 'far'
      else if (current >= LOD_MID_MAX) next = 'close'
      let prev: LodLevel = 'mid'
      if (previous < LOD_FAR_MAX) prev = 'far'
      else if (previous >= LOD_MID_MAX) prev = 'close'
      if (next !== prev) runOnJS(setLod)(next)
    },
  )

  // Scale percent reaction · atualiza display "42%" floater (throttled
  // implicitly · só dispara quando o inteiro arredondado muda)
  useAnimatedReaction(
    () => Math.round(scale.value * 100),
    (current, previous) => {
      if (previous === null || current === previous) return
      runOnJS(setScalePercent)(current)
    },
  )

  // Convention canon: translateX/translateY guardam a POSIÇÃO VISUAL
  // TOP-LEFT desejada do world. Como RN aplica `scale` em torno do
  // CENTRO do elemento (default), precisamos compensar — calculamos o
  // translate real que coloca o top-left visual em (translateX, translateY).
  //
  // Math: depois de scale center-origin, top-left visual sem translate
  // adicional fica em ((1-s)*W/2, (1-s)*H/2). Subtraímos isso pra que
  // o resultado final caia exatamente em (translateX, translateY).
  const animatedStyle = useAnimatedStyle(() => {
    const s = scale.value
    const cx = ((1 - s) * WORLD_WIDTH) / 2
    const cy = ((1 - s) * WORLD_HEIGHT) / 2
    return {
      transform: [
        { translateX: translateX.value - cx },
        { translateY: translateY.value - cy },
        { scale: s },
      ],
    }
  }) as StyleProp<ViewStyle>

  // Viewport size pra consumers (mini-map etc) · ref + snapshot state
  const [vpSize, setVpSize] = useState({ w: 0, h: 0 })
  const wrappedOnLayout = useCallback(
    (e: LayoutChangeEvent) => {
      onLayout(e)
      const { width, height } = e.nativeEvent.layout
      setVpSize((prev) =>
        prev.w === width && prev.h === height ? prev : { w: width, h: height },
      )
    },
    [onLayout],
  )

  return {
    animatedStyle,
    composedGesture,
    onLayout: wrappedOnLayout,
    fit,
    teleport,
    focusOnRect,
    lod,
    scalePercent,
    viewportReady,
    scale,
    translateX,
    translateY,
    viewportSize: vpSize,
  }
}
