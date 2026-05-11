import { type ReactNode, useRef } from 'react'
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Frau } from '../../design/Type'
import { useTheme } from '../../design/theme'
import {
  ACTION_WIDTH,
  BOUNCE_BACK_PX,
  BOUNCE_OUT_TIMING,
  COMMIT_TIMING,
  COMMIT_VELOCITY_MIN_OFFSET,
  FAST_VELOCITY,
  FULL_SWIPE_RATIO,
  REVEAL_PX,
  REVEAL_RATIO,
  SNAP_OPEN_RATIO,
  SPRING_CLOSE,
  SPRING_OPEN,
  buildSwipeActions,
  isCommitSwipeMode,
  type SwipeActionKind,
} from './swipeableCardModels'
import {
  hapticCommitSuccess,
  hapticHeavyFullSwipe,
  hapticLightStart,
  hapticSelection,
} from './swipeableCardHaptics'

interface Props {
  children: ReactNode
  onSnooze?: () => void
  onArchive?: () => void
  onDelete?: () => void
  enabled?: boolean
}

export function SwipeableCard({ children, onSnooze, onArchive, onDelete, enabled = true }: Props) {
  const { c } = useTheme()

  const cardWidth = useSharedValue(0)
  const cardHeight = useSharedValue(0)
  const translateX = useSharedValue(0)
  const isCommitting = useSharedValue(false)
  const collapseProgress = useSharedValue(1)
  const hapticStateRef = useRef({
    started: false,
    revealed: false,
    fullSwipe: false,
  })

  const actionsList = buildSwipeActions({
    amber: c.amber,
    recRedMuted: c.recRedMuted,
    onArchive,
    onDelete,
    onSnooze,
  })
  const isCommitMode = isCommitSwipeMode(actionsList)
  const totalActionWidth = actionsList.length * ACTION_WIDTH
  const snapOpenAt = totalActionWidth

  const resetHapticState = () => {
    hapticStateRef.current.started = false
    hapticStateRef.current.revealed = false
    hapticStateRef.current.fullSwipe = false
  }

  const runActionByKind = (kind: SwipeActionKind) => {
    const action = actionsList.find((a) => a.kind === kind)
    action?.run()
  }

  const onLayout = (e: LayoutChangeEvent) => {
    cardWidth.value = e.nativeEvent.layout.width
    cardHeight.value = e.nativeEvent.layout.height
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onStart(() => {
      'worklet'
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

      if (!isCommitMode && x < -snapOpenAt) {
        const overshoot = x + snapOpenAt
        translateX.value = -snapOpenAt + overshoot * 0.5
      } else {
        translateX.value = x
      }

      if (traveled >= REVEAL_PX && !hapticStateRef.current.revealed) {
        hapticStateRef.current.revealed = true
        runOnJS(hapticSelection)()
      } else if (traveled < REVEAL_PX * 0.5 && hapticStateRef.current.revealed) {
        hapticStateRef.current.revealed = false
      }

      if (isCommitMode) {
        if (traveled >= fullSwipeAt && !hapticStateRef.current.fullSwipe) {
          hapticStateRef.current.fullSwipe = true
          runOnJS(hapticHeavyFullSwipe)()
        } else if (traveled < fullSwipeAt * 0.85 && hapticStateRef.current.fullSwipe) {
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

      const velocityOffsetGate = cardW * COMMIT_VELOCITY_MIN_OFFSET
      const fullSwipeAt = cardW * FULL_SWIPE_RATIO

      const passedFullSwipe = traveled >= fullSwipeAt
      const fastWithIntention = velocity >= FAST_VELOCITY && traveled >= velocityOffsetGate

      const shouldCommit = isCommitMode && (passedFullSwipe || fastWithIntention)
      const shouldSnapOpen = !isCommitMode && traveled > snapOpenAt * SNAP_OPEN_RATIO
      const commitKind = actionsList[0]?.kind ?? 'archive'

      runOnJS(resetHapticState)()

      if (shouldCommit) {
        if (commitKind === 'delete') {
          translateX.value = withSpring(0, SPRING_CLOSE)
          runOnJS(runActionByKind)('delete')
          return
        }

        isCommitting.value = true
        runOnJS(hapticCommitSuccess)()
        translateX.value = withSequence(
          withTiming(translateX.value + BOUNCE_BACK_PX, BOUNCE_OUT_TIMING),
          withTiming(-cardW, COMMIT_TIMING),
        )
        collapseProgress.value = withTiming(0, {
          duration: COMMIT_TIMING.duration + 80,
          easing: COMMIT_TIMING.easing,
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
      if (!isCommitting.value) {
        runOnJS(resetHapticState)()
      }
    })

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  const containerStyle = useAnimatedStyle(() => {
    if (collapseProgress.value === 1) return {}
    return {
      height: cardHeight.value * collapseProgress.value,
      opacity: collapseProgress.value,
      marginVertical: 0,
    }
  })

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

  const labelWrapStyle = useAnimatedStyle(() => {
    if (!isCommitMode) return {}
    const cardW = cardWidth.value || 320
    const safeEnd = cardW * FULL_SWIPE_RATIO

    const slideProgress = interpolate(
      -translateX.value,
      [0, REVEAL_PX, safeEnd, cardW],
      [28, 0, 0, -cardW * 0.3],
      Extrapolation.CLAMP,
    )
    const opacity = interpolate(
      -translateX.value,
      [0, REVEAL_PX, safeEnd],
      [0, 0.6, 1],
      Extrapolation.CLAMP,
    )
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

  const handleActionTap = (kind: SwipeActionKind) => {
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
      duration: COMMIT_TIMING.duration + 80,
      easing: COMMIT_TIMING.easing,
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
        <Animated.View
          style={[
            styles.actionsBg,
            { backgroundColor: primaryBg },
            backgroundStyle,
          ]}
          pointerEvents={isCommitMode ? 'none' : 'auto'}
        >
          {isCommitMode ? (
            <Animated.View style={[styles.labelWrap, labelWrapStyle]}>
              <Frau italic size={14} lineHeight={18} color={c.bg} align="center">
                {primary.label}
              </Frau>
            </Animated.View>
          ) : (
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
