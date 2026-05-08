import { Pressable, StyleSheet, Text, View, type ViewStyle, type StyleProp } from 'react-native'
import { type ReactNode } from 'react'
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
  style?: StyleProp<ViewStyle>
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
  style,
}: Props) {
  const c = usePalette()

  const labelEl = (
    <Frau
      italic={variant === 'doorway'}
      weight={variant === 'codex' ? 'med' : 'reg'}
      size={15}
      lineHeight={22}
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

  const valueEl = typeof value === 'string' ? (
    <Frau italic size={13} lineHeight={22} color={c.ink2}>
      {value}
    </Frau>
  ) : (
    value
  )

  // Row separator · 1px sólido ink @ 6% opacity (F mockup exato:
  // rgba(26,22,18,0.06)). hairlineWidth desaparece em iOS retina, então usa
  // 1px sólido com opacidade controlada via cor rgba.
  const content = (
    <View style={[styles.row, { borderBottomColor: TOC_DIVIDER, borderBottomWidth: 1 }, style]}>
      {labelEl}
      {leaderEl}
      {valueEl}
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={6}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
      >
        {content}
      </Pressable>
    )
  }

  return content
}

const DOT_STRING = '· '.repeat(80)
const TOC_DIVIDER = 'rgba(26,22,18,0.06)' // ink @ 6% · F mockup row separator

const styles = StyleSheet.create({
  // marginLeft:32 + marginRight:32 = trilhos internos simétricos.
  // Combinado com Screen paddingHorizontal:32, cai em x=64..329 — espelho:
  //   esquerda: 0 → 32 (padding) → 32 (margin) → 64 (M de Memory)
  //   direita:  329 (último char) → 32 (margin) → 32 (padding) → 393 (canto)
  // Espaço livre em volta da TOC é idêntico nos dois lados (64px do canto).
  // Antes era só marginLeft, e o leader se estendia até o trilho borda x=361
  // — palavras à direita ficavam só 32px do canto enquanto à esquerda 64px.
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 7,
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
