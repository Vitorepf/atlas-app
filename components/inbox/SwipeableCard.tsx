import { type ReactNode, useRef } from 'react'
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Frau } from '../../design/Type'
import { useTheme } from '../../design/theme'

// SwipeableCard v4 · cinematic Apple Mail / Things 3 reference (FULL).
// =====================================================================
// Pan gesture + reanimated com physics Apple-like + haptic 3-stage +
// stage-3 stretch + exit micro-bounce + velocity tuning anti-fling.
//
// 3 ZONAS DE DRAG (canon Apple Mail):
//   · 0–35% (PEEK)        · label dim, snap-back se soltar
//   · 35–65% (SAFE OPEN)  · label full opacity, commit-by-release possível
//   · 65%+   (FULL-SWIPE) · background EXPANDE pra full-width, label
//                           anda pro centro com peso, commit imediato
//                           ao soltar (zona de não-retorno visual)
//
// HAPTIC 3-STAGE (sente cada estágio sem precisar olhar):
//   1. Light impact     · ao gesture activate (pegou na garra)
//   2. Selection        · ao cruzar reveal threshold (35%)
//   3. Heavy/Rigid impact · ao cruzar full-swipe threshold (65%) — "agora vai"
//   4. Success/Warning  · ao commit final
//   Cada estágio re-fires se voltar abaixo (haptic honesto)
//
// EXIT MICRO-BOUNCE: card desliza +12px pra DIREITA antes de partir
// pra esquerda · "tomar fôlego antes do salto" (Apple ease physics).
//
// VELOCITY TUNING: combina velocity + offset + acceleration · só commita
// se intenção é clara (evita apagar por fling acidental).
//
// 2 modos automáticos:
//   a) "commit" (só onDelete OR só onArchive) · auto-commit cinematic
//   b) "buttons" (multi-action) · snap-open com ações 84px clicáveis

const SPRING_OPEN = { damping: 26, stiffness: 240, mass: 0.85 }
const SPRING_CLOSE = { damping: 28, stiffness: 300, mass: 0.85 }
const COMMIT_TIMING = { duration: 240, easing: Easing.bezier(0.32, 0.72, 0.16, 1) }
const BOUNCE_OUT_TIMING = { duration: 110, easing: Easing.bezier(0.32, 0, 0.67, 0) }

const ACTION_WIDTH = 84
const REVEAL_PX = 50                     // px drag pra começar haptic + label
const REVEAL_RATIO = 0.35                // 35% card width = stage SAFE
const FULL_SWIPE_RATIO = 0.65            // 65% = stage FULL (point of no return)
const SNAP_OPEN_RATIO = 0.40             // % action width pra snap open
const FAST_VELOCITY = 1100               // px/s pra considerar "fast"
const COMMIT_VELOCITY_MIN_OFFSET = 0.30  // velocity só commita se já passou 30% width
const BOUNCE_BACK_PX = 12                // exit micro-bounce distance

interface Props {
  children: ReactNode
  onSnooze?: () => void
  onArchive?: () => void
  onDelete?: () => void
  enabled?: boolean
}

export function SwipeableCard({ children, onSnooze, onArchive, onDelete, enabled = true }: Props) {
  const { c } = useTheme()

  // Layout measurements
  const cardWidth = useSharedValue(0)
  const cardHeight = useSharedValue(0)

  // Drag state (worklet shared values)
  const translateX = useSharedValue(0)
  const isCommitting = useSharedValue(false)
  const collapseProgress = useSharedValue(1)

  // Haptic state (refs no JS thread · evita re-fire em alta freq)
  const hapticStateRef = useRef({
    started: false,        // light impact disparou (ao começar)
    revealed: false,       // selection disparou (reveal threshold)
    fullSwipe: false,      // heavy disparou (full-swipe threshold)
  })

  // Build actions list
  const actionsList: Array<{ kind: 'delete' | 'archive' | 'snooze'; label: string; bg: string; run: () => void }> = []
  if (onSnooze) actionsList.push({ kind: 'snooze', label: 'adiar', bg: c.amber, run: onSnooze })
  if (onArchive) actionsList.push({ kind: 'archive', label: 'arquivar', bg: c.recRedMuted, run: onArchive })
  if (onDelete) actionsList.push({ kind: 'delete', label: 'apagar', bg: c.recRedMuted, run: onDelete })

  // Mode commit · single destructive (delete OU archive sozinho)
  const isCommitMode = actionsList.length === 1 && (actionsList[0].kind === 'delete' || actionsList[0].kind === 'archive')
  const totalActionWidth = actionsList.length * ACTION_WIDTH
  const snapOpenAt = totalActionWidth

  // Haptic helpers · cada um é JS-thread (called via runOnJS)
  const hapticLightStart = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }
  const hapticSelection = () => {
    void Haptics.selectionAsync()
  }
  const hapticHeavyFullSwipe = () => {
    // Rigid = sensação de "lock" (igual quando alavanca de carro encaixa)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)
  }
  const hapticCommitSuccess = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  }

  const resetHapticState = () => {
    hapticStateRef.current.started = false
    hapticStateRef.current.revealed = false
    hapticStateRef.current.fullSwipe = false
  }

  // Run final action callback (after slide-out anim completes)
  const runActionByKind = (kind: 'delete' | 'archive' | 'snooze') => {
    const action = actionsList.find((a) => a.kind === kind)
    action?.run()
  }

  const onLayout = (e: LayoutChangeEvent) => {
    cardWidth.value = e.nativeEvent.layout.width
    cardHeight.value = e.nativeEvent.layout.height
  }

  // ===== Pan gesture =====
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onStart(() => {
      'worklet'
      // Stage 1 haptic · light "pegou na garra" ao começar gesture real
      if (!hapticStateRef.current.started) {
        hapticStateRef.current.started = true
        runOnJS(hapticLightStart)()
      }
    })
    .onUpdate((e) => {
      'worklet'
      if (isCommitting.value) return
      const x = Math.min(0, e.translationX)
      const cardW = cardWidth.value || 320
      const traveled = -x
      const fullSwipeAt = cardW * FULL_SWIPE_RATIO

      // Rubber-band: só além do snap-open em mode buttons
      if (!isCommitMode && x < -snapOpenAt) {
        const overshoot = x + snapOpenAt
        translateX.value = -snapOpenAt + overshoot * 0.5
      } else {
        translateX.value = x
      }

      // Stage 2 haptic · selection ao cruzar REVEAL threshold
      if (traveled >= REVEAL_PX && !hapticStateRef.current.revealed) {
        hapticStateRef.current.revealed = true
        runOnJS(hapticSelection)()
      } else if (traveled < REVEAL_PX * 0.5 && hapticStateRef.current.revealed) {
        // Re-armar se voltou bem antes (permite refire se redrag)
        hapticStateRef.current.revealed = false
      }

      // Stage 3 haptic · heavy/rigid ao cruzar FULL-SWIPE (só em commit mode)
      if (isCommitMode) {
        if (traveled >= fullSwipeAt && !hapticStateRef.current.fullSwipe) {
          hapticStateRef.current.fullSwipe = true
          runOnJS(hapticHeavyFullSwipe)()
        } else if (traveled < fullSwipeAt * 0.85 && hapticStateRef.current.fullSwipe) {
          // Re-arma quando volta abaixo (margem de hysteresis 15%)
          hapticStateRef.current.fullSwipe = false
        }
      }
    })
    .onEnd((e) => {
      'worklet'
      if (isCommitting.value) return
      const traveled = -translateX.value
      const velocity = -e.velocityX
      const cardW = cardWidth.value || 320

      // VELOCITY TUNING · só commita por velocity se já cruzou offset mínimo
      // (evita fling acidental num drag muito curto)
      const velocityOffsetGate = cardW * COMMIT_VELOCITY_MIN_OFFSET
      const fullSwipeAt = cardW * FULL_SWIPE_RATIO

      const passedFullSwipe = traveled >= fullSwipeAt
      const fastWithIntention = velocity >= FAST_VELOCITY && traveled >= velocityOffsetGate

      const shouldCommit = isCommitMode && (passedFullSwipe || fastWithIntention)
      const shouldSnapOpen = !isCommitMode && traveled > snapOpenAt * SNAP_OPEN_RATIO
      const commitKind = actionsList[0]?.kind ?? 'archive'

      // Reset haptic markers (sequence completed)
      runOnJS(resetHapticState)()

      if (shouldCommit) {
        if (commitKind === 'delete') {
          // Delete is destructive and must be confirmed by the caller.
          // Do not collapse optimistically before the confirmation modal.
          translateX.value = withSpring(0, SPRING_CLOSE)
          runOnJS(runActionByKind)('delete')
          return
        }

        isCommitting.value = true
        runOnJS(hapticCommitSuccess)()
        // EXIT MICRO-BOUNCE · pequeno recoil pra direita ANTES do disparo
        // pra esquerda. Sequência: bounce-back +12 → slide-out -cardWidth.
        // Crio sensação física "tomar fôlego antes do salto" (Apple).
        translateX.value = withSequence(
          withTiming(translateX.value + BOUNCE_BACK_PX, BOUNCE_OUT_TIMING),
          withTiming(-cardW, COMMIT_TIMING),
        )
        // Collapse altura em paralelo · row "dobra" pra dentro
        collapseProgress.value = withTiming(0, {
          duration: 320,
          easing: Easing.bezier(0.32, 0.72, 0.16, 1),
        }, (finished) => {
          if (finished) {
            runOnJS(runActionByKind)(commitKind)
          }
        })
      } else if (shouldSnapOpen) {
        translateX.value = withSpring(-snapOpenAt, SPRING_OPEN)
      } else {
        translateX.value = withSpring(0, SPRING_CLOSE)
      }
    })
    .onFinalize(() => {
      'worklet'
      // Cleanup haptic state quando gesture termina (cancel ou success)
      if (!isCommitting.value) {
        runOnJS(resetHapticState)()
      }
    })

  // ===== Animated styles =====
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  // Container collapse · altura encolhe + opacity some no commit
  const containerStyle = useAnimatedStyle(() => {
    if (collapseProgress.value === 1) return {}
    return {
      height: cardHeight.value * collapseProgress.value,
      opacity: collapseProgress.value,
      // marginVertical também colapsa pra fechar gap entre rows
      marginVertical: 0,
    }
  })

  // BG · cresce opacity gradual (zona PEEK = transparente, SAFE = visível, FULL = full opacity)
  const backgroundStyle = useAnimatedStyle(() => {
    const cardW = cardWidth.value || 320
    const peekEnd = cardW * REVEAL_RATIO
    const safeEnd = cardW * FULL_SWIPE_RATIO
    const progress = interpolate(
      -translateX.value,
      [0, REVEAL_PX * 0.5, peekEnd, safeEnd],
      [0, 0.3, 0.85, 1],
      Extrapolation.CLAMP,
    )
    return { opacity: progress }
  })

  // STAGE 3 STRETCH · ao cruzar full-swipe, label "estica" pro centro do card
  // E ganha font-weight visual (via scale leve). Enquanto SAFE, label fica
  // ancorado à direita normal.
  const labelWrapStyle = useAnimatedStyle(() => {
    if (!isCommitMode) return {}
    const cardW = cardWidth.value || 320
    const safeEnd = cardW * FULL_SWIPE_RATIO

    // Posição: ao entrar full-swipe, label desliza da direita pro centro
    // do card visível (que é o que SOBROU à direita do card que foi pra esq)
    const slideProgress = interpolate(
      -translateX.value,
      [0, REVEAL_PX, safeEnd, cardW],
      [28, 0, 0, -cardW * 0.3],  // negativo = vai pra esquerda (centro do card)
      Extrapolation.CLAMP,
    )
    const opacity = interpolate(
      -translateX.value,
      [0, REVEAL_PX, safeEnd],
      [0, 0.6, 1],
      Extrapolation.CLAMP,
    )
    // Scale ganha leve "peso" no full-swipe (1.0 → 1.08)
    const scale = interpolate(
      -translateX.value,
      [safeEnd * 0.85, safeEnd, cardW],
      [1.0, 1.0, 1.08],
      Extrapolation.CLAMP,
    )
    return {
      opacity,
      transform: [{ translateX: slideProgress }, { scale }],
    }
  })

  // Tap em ação revelada (mode buttons)
  const handleActionTap = (kind: 'delete' | 'archive' | 'snooze') => {
    if (kind === 'snooze') {
      hapticCommitSuccess()
      translateX.value = withSpring(0, SPRING_CLOSE)
      onSnooze?.()
      return
    }
    if (kind === 'delete') {
      translateX.value = withSpring(0, SPRING_CLOSE)
      runActionByKind(kind)
      return
    }

    hapticCommitSuccess()
    isCommitting.value = true
    const cardW = cardWidth.value || 320
    translateX.value = withSequence(
      withTiming(translateX.value + BOUNCE_BACK_PX, BOUNCE_OUT_TIMING),
      withTiming(-cardW, COMMIT_TIMING),
    )
    collapseProgress.value = withTiming(0, {
      duration: 320,
      easing: Easing.bezier(0.32, 0.72, 0.16, 1),
    }, (finished) => {
      if (finished) runOnJS(runActionByKind)(kind)
    })
  }

  if (!enabled || actionsList.length === 0) {
    return <>{children}</>
  }

  const primary = actionsList[0]
  const primaryBg = primary.bg

  return (
    <Animated.View style={[styles.outer, containerStyle]}>
      <View style={styles.container} onLayout={onLayout}>
        {/* Background reveal · cor primary, opacity progressiva */}
        <Animated.View
          style={[
            styles.actionsBg,
            { backgroundColor: primaryBg },
            backgroundStyle,
          ]}
          pointerEvents={isCommitMode ? 'none' : 'auto'}
        >
          {isCommitMode ? (
            // Mode commit · label "estica" no full-swipe stage
            <Animated.View style={[styles.labelWrap, labelWrapStyle]}>
              <Frau italic size={14} lineHeight={18} color={c.bg} align="center">
                {primary.label}
              </Frau>
            </Animated.View>
          ) : (
            // Mode buttons · 84px lado a lado, clicáveis
            <View style={styles.buttonsRow}>
              {actionsList.map((action) => (
                <Pressable
                  key={action.kind}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={() => handleActionTap(action.kind)}
                  style={[styles.actionButton, { backgroundColor: action.bg }]}
                >
                  <Frau italic size={13} lineHeight={16} color={c.bg} align="center">
                    {action.label}
                  </Frau>
                </Pressable>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Card on top · gestural translate */}
        <GestureDetector gesture={pan}>
          <Animated.View style={cardStyle}>
            {children}
          </Animated.View>
        </GestureDetector>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  outer: {
    overflow: 'hidden',
  },
  container: {
    position: 'relative',
  },
  actionsBg: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  labelWrap: {
    paddingRight: 32,
  },
  buttonsRow: {
    flexDirection: 'row',
    height: '100%',
  },
  actionButton: {
    width: ACTION_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
})
