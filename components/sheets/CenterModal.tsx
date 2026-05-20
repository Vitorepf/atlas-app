import { useEffect, type ReactNode } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useTheme } from '../../design/theme'

interface Props {
  visible: boolean
  onClose: () => void
  children: ReactNode
  // 'denser' scrim; mic permission uses blur backdrop in the prototype.
  emphasised?: boolean
  /**
   * Canon variant — match mockup `confirm-modal`:
   *   border 1px @18% ink · border-radius 4 (manuscript minimal) ·
   *   padding 28 24 0 · bg cream (não premium)
   * Quando false (default), usa o card "premium" arredondado tradicional.
   */
  canon?: boolean
}

// Center confirmation/info modal. Card lifts + scales subtly on entry.
export function CenterModal({ visible, onClose, children, emphasised, canon }: Props) {
  const { c, name } = useTheme()
  const opacity = useSharedValue(0)
  const cardTy = useSharedValue(8)
  const cardScale = useSharedValue(0.985)

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 240, easing: Easing.out(Easing.cubic) })
    cardTy.value = withTiming(visible ? 0 : 8, { duration: 280, easing: Easing.bezier(0.2, 0.7, 0.2, 1) })
    cardScale.value = withTiming(visible ? 1 : 0.985, { duration: 280, easing: Easing.bezier(0.2, 0.7, 0.2, 1) })
  }, [visible, opacity, cardTy, cardScale])

  const scrimStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardTy.value }, { scale: cardScale.value }],
  }))

  const scrimColor = emphasised ? 'rgba(28,25,22,0.55)' : 'rgba(28,25,22,0.42)'

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.scrim, { backgroundColor: scrimColor }, scrimStyle]}
    >
      <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
      <Animated.View
        style={[
          styles.card,
          canon
            ? {
                backgroundColor: c.bg,
                borderColor: name === 'dark' ? c.border : 'rgba(26,22,18,0.18)',
                borderRadius: 4,
                paddingTop: 28,
                paddingHorizontal: 24,
                paddingBottom: 0,
                shadowColor: name === 'dark' ? '#000' : '#1A1612',
              }
            : {
                backgroundColor: c.premium,
                borderColor: c.border,
                shadowColor: name === 'dark' ? '#000' : '#1A1612',
              },
          cardStyle,
        ]}
      >
        <View>{children}</View>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 60,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 26,
    paddingHorizontal: 24,
    paddingBottom: 22,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 60,
    elevation: 20,
  },
})
