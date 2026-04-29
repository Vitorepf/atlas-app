import { useEffect, type ReactNode } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../design/theme'

interface Props {
  visible: boolean
  children: ReactNode
}

// Full-bleed sheet that slides in from the right. 320ms 0.16,1,0.3,1.
// Closing is up to the inner header (back button) — sidesheets don't auto-close on scrim.
export function SideSheet({ visible, children }: Props) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()

  const tx = useSharedValue(width)

  useEffect(() => {
    tx.value = withTiming(visible ? 0 : width, {
      duration: 320,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
  }, [visible, tx, width])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }))

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.sheet,
        { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom },
        animStyle,
      ]}
    >
      <View style={styles.fill}>{children}</View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 58,
  },
  fill: { flex: 1 },
})
