import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { Frau, Mono, Sans } from '../design/Type'
import { useTheme } from '../design/theme'
import { domainColor, domainLabel, type DomainKey } from '../lib/domains'
import { useAtlasStore } from '../lib/atlasStore'
import { Skeleton } from './Skeleton'

interface Props {
  domain: DomainKey
}

// Card que aparece no topo da inbox enquanto a captura está sendo processada.
// Bronze dot pulsando, label em italic, skeleton lines.
export function ProcessingCard({ domain }: Props) {
  const { c } = useTheme()
  const domains = useAtlasStore((s) => s.domains)
  const opacity = useSharedValue(0)
  const ty = useSharedValue(-8)

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 320, easing: Easing.bezier(0.2, 0.7, 0.2, 1) })
    ty.value = withTiming(0, { duration: 320, easing: Easing.bezier(0.2, 0.7, 0.2, 1) })
  }, [opacity, ty])

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
      <View style={styles.meta}>
        <Mono size={12} color={c.ink2} letterSpacing={0.24}>agora</Mono>
        <Sans
          weight="sb"
          size={10.5}
          letterSpacing={1.05}
          color={domainColor(domain, c, domains)}
          style={{ textTransform: 'uppercase' }}
        >
          {domainLabel(domain, domains)}
        </Sans>
        <View style={styles.spacer} />
        <PulsingDot color={c.bronze} />
        <Frau italic size={13} color={c.ink2}>
          Processando…
        </Frau>
      </View>

      <Skeleton width="90%" height={12} radius={3} style={{ marginTop: 8 }} />
      <Skeleton width="60%" height={12} radius={3} style={{ marginTop: 8 }} />
    </Animated.View>
  )
}

function PulsingDot({ color }: { color: string }) {
  const t = useSharedValue(0.35)
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    )
  }, [t])
  const style = useAnimatedStyle(() => ({ opacity: t.value }))
  return (
    <Animated.View
      style={[
        { width: 4, height: 4, borderRadius: 2, backgroundColor: color, marginRight: 6 },
        style,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spacer: { flex: 1 },
})
