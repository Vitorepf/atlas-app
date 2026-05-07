import { useEffect } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useTheme } from '../../design/theme'
import { fonts } from '../../design/tokens'

interface Props {
  onPress: () => void          // tap rápido (<220ms) → captura de texto
  onLongPress?: () => void     // hold (≥220ms) → captura de áudio
  size?: number
}

// v15 · ✦ SOLTO · sem moldura, sem circle, sem dome, sem edge.
// Só o glyph bronze flutuando · matching a gramática visual do ✦ no resto do app
// (FoilStar nos cards, accent inline no DetailSheet, "tipo sugerido").
//
// FILOSOFIA: Atlas não é SaaS · é manuscrito editorial. iOS FAB pattern (circle
// solid + shadow) é regra padrão UX SaaS · aqui violamos pra ganhar P12 sussurrada
// radical. O usuário usa esse botão dezenas de vezes ao dia → descobre na 1ª, depois
// é muscle memory absoluto.
//
// hitSlop generoso (size/2) garante tap target invisível mesmo sem background
// visível · usuário toca em 60×60+ ainda que veja só ~24pt de glyph.
//
// Tap rápido = texto · Long-press 220ms = áudio (sub-10s sagrado P1).
export function CaptureButton({ onPress, onLongPress, size = 60 }: Props) {
  const { c } = useTheme()
  const glyphSize = Math.round(size * 0.55) // glyph maior agora que não tem circle competindo
  const hitSlop = Math.round(size / 2)

  // v16 cinema · contemplative pulse · ✦ respira lentamente como estrela antes
  // do amanhecer. 3.5s ciclo (1.75s up, 1.75s down), easing sin in-out.
  // Não distrai · ritmo de respiração calma. Press feedback combina com pulse
  // (multiplicação · press wins quando ativo).
  const pulseProgress = useSharedValue(0)
  const pressProgress = useSharedValue(0)

  useEffect(() => {
    pulseProgress.value = withRepeat(
      withTiming(1, { duration: 1750, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
  }, [pulseProgress])

  const animatedGlyphStyle = useAnimatedStyle(() => ({
    opacity: (0.7 + pulseProgress.value * 0.3) * (1 - pressProgress.value * 0.45),
    transform: [{ scale: 1 - pressProgress.value * 0.08 }],
  }))

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      onLongPress={
        onLongPress
          ? () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              onLongPress()
            }
          : undefined
      }
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
      delayLongPress={220}
      accessibilityRole="button"
      accessibilityLabel="captura · toque para texto, segure para áudio"
      hitSlop={hitSlop}
      style={[styles.touch, { width: size, height: size }]}
    >
      {/* Único elemento · ✦ bronze · Frau italic · matching todos outros usos
          do glyph na app. Sem chrome, sem moldura, sem shadow. Pure signature.
          Pulse contemplativo · estrela respirando entre captures. */}
      <Animated.View style={animatedGlyphStyle}>
        <Text
          style={{
            fontFamily: fonts.serifItalic,
            fontSize: glyphSize,
            lineHeight: glyphSize,
            color: c.bronze,
            textAlign: 'center',
            includeFontPadding: false,
          }}
        >
          ✦
        </Text>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  touch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
