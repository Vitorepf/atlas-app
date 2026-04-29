import { useEffect, type ReactNode } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Scrim } from './Scrim'
import { useTheme } from '../../design/theme'

interface Props {
  visible: boolean
  onClose: () => void
  height?: '85%' | '40%' | number
  children: ReactNode
  scrimStrength?: 'normal' | 'strong'
}

// Slide-up bottom sheet with handle. 380ms cubic-bezier(0.16, 1, 0.3, 1).
export function BottomSheet({
  visible,
  onClose,
  height = '85%',
  children,
  scrimStrength,
}: Props) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { height: winH } = useWindowDimensions()

  const sheetH =
    typeof height === 'number'
      ? height
      : winH * (height === '85%' ? 0.85 : 0.4)

  const ty = useSharedValue(sheetH)

  useEffect(() => {
    ty.value = withTiming(visible ? 0 : sheetH, {
      duration: 380,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
  }, [visible, ty, sheetH])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }))

  return (
    <>
      <Scrim visible={visible} onPress={onClose} strength={scrimStrength} />
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          styles.sheet,
          {
            backgroundColor: c.bg,
            height: sheetH,
            paddingBottom: insets.bottom,
            shadowColor: '#1C1916',
          },
          animStyle,
        ]}
      >
        <View style={[styles.handle, { backgroundColor: c.border }]} />
        {children}
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    zIndex: 56,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 16,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
})
