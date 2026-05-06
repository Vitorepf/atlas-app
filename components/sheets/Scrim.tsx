import { Pressable, StyleSheet } from 'react-native'
import { useEffect } from 'react'
import { BlurView } from 'expo-blur'
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

// v10 robust · 3 camadas compostas · resistente a expo-blur não-compilado.
// 1. Animated.View container (gerencia opacity de fade-in/fade-out)
// 2. BlurView (gaussian premium quando nativo está compilado)
// 3. Pressable com bg dim warm-ink (fallback + interaction layer)
//
// Se expo-blur native não está no build, camada 2 vira no-op transparente
// e ainda temos camada 3 (~30% dim) garantindo que o usuário VÊ a separação
// entre sheet ativo e fundo. Não fica "buraco transparente".
//
// Usuário precisa rebuild iOS native (npx expo run:ios) pra ativar a camada 2.
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
  // Dim mais forte agora que serve como fallback E como overlay sobre blur.
  // 32% normal / 42% strong garante separação visível mesmo sem blur.
  const dimColor = strength === 'strong' ? 'rgba(28,22,18,0.42)' : 'rgba(28,22,18,0.32)'
  const intensity = 100
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFillObject, { zIndex: 55 }, animStyle]}
    >
      {/* Camada blur · ativa quando expo-blur native está compilado.
          tint systemChromeMaterialDark = mesmo material do share sheet/alert iOS. */}
      <BlurView
        intensity={intensity}
        tint="systemChromeMaterialDark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFillObject}
      />
      {/* Camada dim + interaction · sempre presente mesmo sem blur */}
      <Pressable
        onPress={onPress}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: dimColor }]}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
      />
    </Animated.View>
  )
}
