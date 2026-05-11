import { useEffect } from 'react'
import { Pressable, ScrollView } from 'react-native'
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { OPERATIONAL_FILTERS } from '../../lib/inboxConstants'
import type { OperationalFilter } from '../../lib/inboxTypes'
import { styles } from './inboxScreenStyles'

const AnimatedSans = Animated.createAnimatedComponent(Sans)
const AnimatedMono = Animated.createAnimatedComponent(Mono)

export function OperationalFilterStrip({
  active,
  counts,
  onChange,
}: {
  active: OperationalFilter
  counts: Record<OperationalFilter, number>
  onChange: (filter: OperationalFilter) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.operationalFilterStrip}
      style={styles.operationalFilterScroll}
    >
      {OPERATIONAL_FILTERS.map((option) => (
        <OperationalFilterChip
          key={option.key}
          label={option.label}
          count={counts[option.key]}
          active={active === option.key}
          onPress={() => onChange(option.key)}
        />
      ))}
    </ScrollView>
  )
}

function OperationalFilterChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string
  count: number
  active: boolean
  onPress: () => void
}) {
  const c = usePalette()
  const activeProgress = useSharedValue(active ? 1 : 0)
  const pressProgress = useSharedValue(0)
  const baseOpacity = count === 0 && !active ? 0.45 : 1

  useEffect(() => {
    activeProgress.value = withTiming(active ? 1 : 0, {
      duration: 380,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
  }, [active, activeProgress])

  const animatedChipStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      [c.border, c.prussian],
    ),
    backgroundColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      ['rgba(0,0,0,0)', c.surface],
    ),
    opacity: baseOpacity * (1 - pressProgress.value * 0.45),
    transform: [{ scale: 1 - pressProgress.value * 0.025 }],
  }))

  const animatedLabelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      activeProgress.value,
      [0, 1],
      [c.ink2, c.prussian],
    ),
  }))

  const animatedCountStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      activeProgress.value,
      [0, 1],
      [c.ink3, c.prussian],
    ),
  }))

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressProgress.value = withTiming(1, {
          duration: 220,
          easing: Easing.bezier(0.32, 0, 0.67, 0),
        })
      }}
      onPressOut={() => {
        pressProgress.value = withTiming(0, {
          duration: 360,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })
      }}
    >
      <Animated.View style={[styles.operationalFilterChip, animatedChipStyle]}>
        <AnimatedSans weight={active ? 'sb' : 'med'} size={11.5} lineHeight={15} numberOfLines={1} style={animatedLabelStyle}>
          {label}
        </AnimatedSans>
        <AnimatedMono size={10.5} lineHeight={14} style={animatedCountStyle}>
          {count}
        </AnimatedMono>
      </Animated.View>
    </Pressable>
  )
}
