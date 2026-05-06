import { Pressable, StyleSheet, Text } from 'react-native'
import * as Haptics from 'expo-haptics'
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
      delayLongPress={220}
      accessibilityRole="button"
      accessibilityLabel="captura · toque para texto, segure para áudio"
      hitSlop={hitSlop}
      style={({ pressed }) => [
        styles.touch,
        {
          width: size,
          height: size,
          opacity: pressed ? 0.55 : 1,
          transform: [{ scale: pressed ? 0.92 : 1 }],
        },
      ]}
    >
      {/* Único elemento · ✦ bronze · Frau italic · matching todos outros usos
          do glyph na app. Sem chrome, sem moldura, sem shadow. Pure signature. */}
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
    </Pressable>
  )
}

const styles = StyleSheet.create({
  touch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
