/**
 * Cartografia · atom continente · universe scene.
 *
 * Card retangular em world-coords fixos. O glifo SVG assume protagonismo
 * visual — ele ensina o que o continente É. O nome confirma; quem viu o
 * ícone já entendeu.
 *
 * Layout interno (top→bottom):
 *   1. Glifo SVG canônico (assume ~50% da altura do card)
 *   2. Nome (Frau italic medium)
 *   3. Hairline bronze (sussurro de separação)
 *   4. Count Mono caps direita + role mono caps esquerda
 *
 * LOD comportamento:
 *   - far  → glifo + nome + count
 *   - mid  → + deck (uma linha italic abaixo do nome)
 *   - close → + glifo cresce mais, hint ↗ aparece
 */
import { memo } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInDown, useReducedMotion } from 'react-native-reanimated'
import { usePalette } from '../../../design/theme'
import { Frau, Mono } from '../../../design/Type'
import { AtomTouchable } from './AtomTouchable'
import { ContinentGlyph } from './ContinentGlyph'
import { type ContinentLayout, type LodLevel } from './layout'

interface Props {
  continent: ContinentLayout
  lod: LodLevel
  onPress: (id: string) => void
  /** índice editorial pro stagger reveal (0..N-1) */
  revealIndex: number
  /** Long-press opcional · preview/peek do continent sem navegar */
  onLongPress?: (id: string) => void
}

function ContinentAtomImpl({ continent, lod, onPress, revealIndex, onLongPress }: Props) {
  const c = usePalette()
  const reduced = useReducedMotion()
  const showDeck = lod !== 'far'
  const showHint = lod === 'close'
  const glyphSize = lod === 'close' ? 110 : lod === 'mid' ? 96 : 88

  // Reveal · cada continente entra com delay editorial. Atlas (sun central)
  // entra primeiro (delay 0), depois os outros em ordem horária.
  const shellStyle: StyleProp<ViewStyle> = {
    position: 'absolute',
    left: continent.x,
    top: continent.y,
    width: continent.w,
    height: continent.h,
  }

  return (
    <Animated.View
      style={shellStyle}
      entering={reduced
        ? undefined
        : FadeInDown.duration(420)
            .delay(revealIndex * 90)
            .easing(Easing.bezier(0.16, 1, 0.3, 1))}
    >
      <AtomTouchable
        onPress={() => onPress(continent.id)}
        onLongPress={onLongPress ? () => onLongPress(continent.id) : undefined}
        shellStyle={[
          styles.atomInner,
          {
            backgroundColor: c.bgRaised,
            borderColor: c.border,
          },
        ]}
      >
      {/* Glifo · protagonista visual */}
      <View style={styles.glyphRow}>
        <ContinentGlyph
          continentId={continent.id}
          size={glyphSize}
          color={c.bronze}
          detailColor={c.ink3}
        />
      </View>

      {/* Nome · Frau italic medium */}
      <Frau italic weight="med" size={28} lineHeight={34} color={c.ink} style={styles.name}>
        {continent.name}
      </Frau>

      {/* Deck · só em mid/close */}
      {showDeck ? (
        <Frau italic size={14} lineHeight={20} color={c.ink2} style={styles.deck}>
          {continent.deck}
        </Frau>
      ) : null}

      {/* Hairline bronze sussurro */}
      <View style={[styles.divider, { backgroundColor: c.bronze, opacity: 0.16 }]} />

      {/* Footer · count + hint */}
      <View style={styles.footer}>
        <Mono size={10} letterSpacing={1.6} color={c.ink3}>
          {continent.count.toString().padStart(2, '0')} PEÇAS
        </Mono>
        {showHint ? (
          <Mono size={10} letterSpacing={1.4} color={c.bronze}>
            ↗
          </Mono>
        ) : (
          <View style={styles.footerSpacer} />
        )}
      </View>
      </AtomTouchable>
    </Animated.View>
  )
}

export const ContinentAtom = memo(
  ContinentAtomImpl,
  (a, b) =>
    a.continent.id === b.continent.id &&
    a.lod === b.lod &&
    a.onPress === b.onPress &&
    a.revealIndex === b.revealIndex &&
    a.onLongPress === b.onLongPress,
)

const styles = StyleSheet.create({
  atomInner: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 22,
    paddingVertical: 20,
    justifyContent: 'space-between',
    // Slate dark shadow canon · profundidade enterprise sem ruído
    shadowColor: '#000',
    shadowOpacity: 0.42,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  glyphRow: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 80,
  },
  name: {
    marginTop: 6,
  },
  deck: {
    marginTop: 4,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  footerSpacer: {
    width: 12,
  },
})
