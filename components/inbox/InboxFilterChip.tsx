import { useEffect } from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { styles } from './inboxScreenStyles'

export function FilterChip({
  label,
  active,
  count,
  onPress,
  onLayoutChip,
}: {
  label: string
  active: boolean
  count?: number
  onPress: () => void
  onLayoutChip?: (layout: { x: number; width: number }) => void
}) {
  const c = usePalette()
  // v15.2 · per-chip underline removido · substituído pelo slider único no parent.
  // v16 · cinema crossfade · active state transita opacity smoothly em vez de
  // trocar color={c.ink} ↔ color={c.ink3} instantâneo. Duration 480ms exhale
  // = mesma curva do home cinema · contemplativo, não snap.
  const activeProgress = useSharedValue(active ? 1 : 0)

  useEffect(() => {
    activeProgress.value = withTiming(active ? 1 : 0, {
      duration: 480,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
  }, [active, activeProgress])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.42 + activeProgress.value * 0.58,
  }))

  return (
    <Pressable
      onPress={onPress}
      onLayout={(e) =>
        onLayoutChip?.({
          x: e.nativeEvent.layout.x,
          width: e.nativeEvent.layout.width,
        })
      }
      style={styles.filterChip}
    >
      <Animated.View style={[styles.filterChipRow, animatedStyle]}>
        {/* canon mockup .filter-tabs .tab · Frau italic 15 ink3 inactive ·
            ink + weight med active. Active state já vem via opacity (parent
            animatedStyle 0.42→1.0). Cor base ink (com opacity) ≈ canon. */}
        <Frau italic size={15} lineHeight={20} color={c.ink} weight={active ? 'med' : 'reg'}>
          {label}
        </Frau>
        {count != null && count > 0 ? (
          // canon mockup .filter-tabs .tab .count · Mono 11 lspc 0.6 ink3
          // (não Frau italic). Mono marca "número técnico" vs label editorial.
          <Mono size={11} lineHeight={14} letterSpacing={0.6} color={c.ink3} style={styles.filterChipCount}>
            {count}
          </Mono>
        ) : null}
      </Animated.View>
      {active ? <View pointerEvents="none" style={styles.filterChipActiveUnderline} /> : null}
    </Pressable>
  )
}
