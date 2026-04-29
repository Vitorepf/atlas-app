import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { Skeleton } from './Skeleton'
import { useTheme } from '../design/theme'

const ROWS = [
  { dom: 64, l1: '92%', l2: '64%' },
  { dom: 48, l1: '88%', l2: '55%' },
  { dom: 72, l1: '78%', l2: '42%' },
  { dom: 54, l1: '90%', l2: '70%' },
  { dom: 60, l1: '82%', l2: '50%' },
] as const

export function InboxSkeleton() {
  return (
    <View style={{ gap: 10 }}>
      {ROWS.map((r, i) => (
        <SkelRow key={i} index={i} dom={r.dom} l1={r.l1} l2={r.l2} />
      ))}
    </View>
  )
}

interface SkelRowProps {
  index: number
  dom: number
  l1: `${number}%`
  l2: `${number}%`
}

function SkelRow({ index, dom, l1, l2 }: SkelRowProps) {
  const { c } = useTheme()
  const opacity = useSharedValue(0)
  const ty = useSharedValue(4)

  useEffect(() => {
    opacity.value = withDelay(index * 40, withTiming(1, { duration: 320, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }))
    ty.value = withDelay(index * 40, withTiming(0, { duration: 320, easing: Easing.bezier(0.2, 0.7, 0.2, 1) }))
  }, [opacity, ty, index])

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }))

  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: c.surface, borderColor: c.border },
        animStyle,
      ]}
    >
      <View style={styles.metaRow}>
        <Skeleton width={36} height={12} radius={3} />
        <Skeleton width={dom} height={11} radius={3} />
      </View>
      <Skeleton width={l1} height={13} radius={3} style={{ marginTop: 8 }} />
      <Skeleton width={l2} height={13} radius={3} style={{ marginTop: 8 }} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
})
