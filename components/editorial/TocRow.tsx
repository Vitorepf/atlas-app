import { Pressable, StyleSheet, Text, View, type ViewStyle, type StyleProp } from 'react-native'
import { type ReactNode } from 'react'
import * as Haptics from 'expo-haptics'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Frau } from '../../design/Type'
import { fonts } from '../../design/tokens'
import { usePalette } from '../../design/theme'

interface Props {
  /** Label da entrada · ex.: "Memory", "bitácula". */
  label: string
  /** Valor à direita · pode ser string simples ou ReactNode pra formatação custom. */
  value: ReactNode
  /** Tornar a row pressável · ex.: Doorway pra outra screen. */
  onPress?: () => void
  /** Acessibilidade. */
  accessibilityLabel?: string
  /** Mostrar dotleader entre label e value (default true). */
  withLeader?: boolean
  /** Variante "doorway" · label italic ao invés de upright (sub-screens). */
  variant?: 'codex' | 'doorway'
  /**
   * Mostrar hairline-bottom (default true) · canon home/edicao tem hairlines
   * entre rows. ContinuityPanel canon NÃO tem hairlines entre toc-rows · só
   * leader dotted separando label/value. Quando false, sem borderBottom.
   */
  withDivider?: boolean
  style?: StyleProp<ViewStyle>
  /**
   * Round 3 polish · quando `live=true`, o valor é dado real (não placeholder
   * default tipo "abrir" / "montar dia"). Recebe color bronze sutil em vez
   * de ink2 default · signal canon "este valor está vivo".
   */
  live?: boolean
}

// TocRow · entry de TOC editorial estilo livro encadernado / Monocle TOC.
//
// Layout: [label] [........... dot leader ............] [value]
//
// Dot leader implementado via Text com '·' repetidos · cross-platform reliable
// em RN (borderStyle: 'dotted' é inconsistente entre iOS/Android). Mono font
// dá ritmo regular entre dots, letterSpacing ajusta densidade.
//
// Label · Frau weight medium pra codex (Memory, Open Brain), italic regular
// pra doorway (bitácula, saúde) — diferenciação visual sutil entre dossiês
// e portas.
// Value · italic Frau pequeno em ink2 — "anotação à direita do escrivão".
// Bottom border · ink @ 6% opacity (super faint, vocabulário F mockup).
export function TocRow({
  label,
  value,
  onPress,
  accessibilityLabel,
  withLeader = true,
  variant = 'codex',
  withDivider = true,
  style,
  live = false,
}: Props) {
  const c = usePalette()

  const labelEl = (
    <Frau
      italic={variant === 'doorway'}
      // Weight medium nas duas variantes:
      //   codex (upright) — peso natural do TOC editorial
      //   doorway (italic) — italic regular lê mais leve que medium upright;
      //     subir pra medium equilibra o peso visual entre as duas TOCs.
      weight="med"
      size={18}
      lineHeight={26}
      color={c.ink}
      letterSpacing={0}
    >
      {label}
    </Frau>
  )

  // Dot leader · 80 pontos clipped à largura disponível via overflow:hidden
  // + numberOfLines:1. flex:1 no wrap estica até o value, e o Text passa do
  // limite do wrap (overflow:hidden corta no edge correto).
  const leaderEl = withLeader ? (
    <View style={styles.leaderWrap}>
      <Text
        numberOfLines={1}
        ellipsizeMode="clip"
        style={[styles.leaderText, { color: c.ink3 }]}
      >
        {DOT_STRING}
      </Text>
    </View>
  ) : null

  // Round 3 polish · live=true → value em bronze (vs ink2 default).
  // Signal sutil "este valor está vivo, não placeholder". Aplicado em
  // Memory (count > 0), bitácula (count > 0), saúde (sleep/hrv presentes).
  const valueColor = live ? c.bronze : c.ink2
  const valueEl = typeof value === 'string' ? (
    <Frau italic size={15} lineHeight={26} color={valueColor}>
      {value}
    </Frau>
  ) : (
    value
  )

  // Round 5 polish · divider agora usa c.borderSoft (alpha 0.05) em vez
  // de c.border (alpha 0.10) · hairline mais sussurrada entre rows,
  // peso editorial sem virar tabela SaaS. + StyleSheet.hairlineWidth
  // (era 1px inteiro).
  const content = (
    <View
      style={[
        styles.row,
        withDivider && { borderBottomColor: c.borderSoft, borderBottomWidth: StyleSheet.hairlineWidth },
        style,
      ]}
    >
      {labelEl}
      {leaderEl}
      {valueEl}
    </View>
  )

  // Slice 6ab · haptic Soft + press scale spring quando pressable
  const pressScale = useSharedValue(1)
  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    onPress?.()
  }

  if (onPress) {
    return (
      <Animated.View style={pressAnimStyle}>
        <Pressable
          onPress={handlePress}
          hitSlop={6}
          accessibilityLabel={accessibilityLabel}
          accessibilityRole="button"
          onPressIn={() => {
            pressScale.value = withTiming(0.98, { duration: 120, easing: Easing.out(Easing.quad) })
          }}
          onPressOut={() => {
            pressScale.value = withSpring(1, { damping: 14, stiffness: 240, mass: 0.7 })
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
        >
          {content}
        </Pressable>
      </Animated.View>
    )
  }

  return content
}

const DOT_STRING = '· '.repeat(80)

const styles = StyleSheet.create({
  // marginLeft:32 + marginRight:32 = trilhos internos simétricos.
  // Combinado com Screen paddingHorizontal:32, cai em x=64..329 — espelho:
  //   esquerda: 0 → 32 (padding) → 32 (margin) → 64 (M de Memory)
  //   direita:  329 (último char) → 32 (margin) → 32 (padding) → 393 (canto)
  // Espaço livre em volta da TOC é idêntico nos dois lados (64px do canto).
  //
  // Round 5 calibração · paddingVertical 11→9 · row respira mas gap entre
  // SectionHead marginBottom (28) + primeira row fica ~37px em vez de 39.
  // Mantém ritmo editorial uniforme · diferença sutil mas perceptível.
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 9,
    gap: 8,
    marginLeft: 32,
    marginRight: 32,
  },
  leaderWrap: {
    flex: 1,
    overflow: 'hidden',
    height: 14,
    justifyContent: 'flex-end',
  },
  // dots mais densos · fontSize 13 + letterSpacing 0.5 aproxima o ritmo do
  // CSS `border-bottom: 1.5px dotted` do F mockup (denso, ~2-3px gap entre
  // dots). Evita o leader esparso de mono 11 + letterSpacing 1.5.
  leaderText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: 0.5,
    opacity: 0.55,
  },
})
