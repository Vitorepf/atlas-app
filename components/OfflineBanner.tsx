import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Mono, Sans } from '../design/Type'
import { useTheme } from '../design/theme'

interface Props {
  visible: boolean
  queue: number
  label?: string
}

const HIDDEN_OFFSET = -120

// Tira discreta abaixo da status bar nativa do iOS. Bronze pontual no dot, mono no contador.
// Usa SafeAreaView pra garantir que fica sempre BELOW da Dynamic Island/notch.
export function OfflineBanner({ visible, queue, label = 'Sem conexão' }: Props) {
  const { c } = useTheme()
  const ty = useSharedValue(HIDDEN_OFFSET)

  useEffect(() => {
    ty.value = withTiming(visible ? 0 : HIDDEN_OFFSET, {
      duration: 320,
      easing: Easing.bezier(0.2, 0.7, 0.2, 1),
    })
  }, [ty, visible])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.outer, animStyle]}
    >
      <SafeAreaView edges={['top']} style={{ backgroundColor: c.bg }}>
        <View
          style={[
            styles.inner,
            { backgroundColor: c.bg, borderBottomColor: c.border },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: c.bronze }]} />
          <Sans
            weight="med"
            size={12}
            letterSpacing={0.96}
            color={c.ink2}
            style={{ textTransform: 'uppercase' }}
          >
            {label}
          </Sans>
          <View style={{ flex: 1 }} />
          <Mono size={11} letterSpacing={0.44} color={c.bronze}>
            fila local: {queue}
          </Mono>
        </View>
      </SafeAreaView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  outer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 35,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
})
