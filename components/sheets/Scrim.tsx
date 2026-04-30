import { Pressable } from 'react-native'
import { useEffect } from 'react'
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

interface Props {
  visible: boolean
  onPress?: () => void
  strength?: 'normal' | 'strong'
  // When provided, multiplies the base opacity. 1 = fully open, 0 = invisible.
  // Used by BottomSheet to fade the scrim while the user drags the sheet down.
  fade?: SharedValue<number>
}

// Warm-black backdrop. Tap-through on close.
export function Scrim({ visible, onPress, strength = 'normal', fade }: Props) {
  const opacity = useSharedValue(0)
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    })
  }, [opacity, visible])
  const animStyle = useAnimatedStyle(() => ({
    opacity: fade ? opacity.value * fade.value : opacity.value,
  }))
  const bg = strength === 'strong' ? 'rgba(28,25,22,0.50)' : 'rgba(28,25,22,0.40)'
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: bg,
          zIndex: 55,
        },
        animStyle,
      ]}
    >
      <Pressable
        onPress={onPress}
        style={{ flex: 1 }}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
      />
    </Animated.View>
  )
}
