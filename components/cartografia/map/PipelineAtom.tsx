/**
 * Cartografia · atom pipeline (variante pipe).
 *
 * Card retangular do pipeline central. Cada atom mostra:
 *   1. Numeral romano canon (i, ii, iii ...) Mono caps bronze
 *   2. Glifo de fase (intake/shape/decide/prove/render) SVG
 *   3. Nome Frau italic medium
 *   4. Deck italic regular ink2
 *
 * Atom hero (Atlas Decide) ganha:
 *   - ring 2px bronze ao redor
 *   - altura extra (HERO_EXTRA px)
 *   - glifo ✦ duplicado maior atrás (peso editorial)
 */
import { memo } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import { useReducedMotion } from 'react-native-reanimated'
import { usePalette } from '../../../design/theme'
import { Frau, Mono } from '../../../design/Type'
import { AtomTouchable } from './AtomTouchable'
import { PhaseGlyph } from './PhaseGlyph'
import {
  PIPELINE_WIDTH,
  PIPELINE_X,
  pipelineStepHeight,
  pipelineStepY,
  type PipelineStep,
} from './atlasFlowData'
import { type LodLevel } from './layout'
import { useTrailPulse } from './useTrailPulse'
import type { GraphSource } from '../state/useCartografiaLiveData'

interface Props {
  step: PipelineStep
  lod: LodLevel
  onPress: (id: string) => void
  isFocused?: boolean
  isKin?: boolean
  /** Fonte real do .md (repo/vault/mixed/missing) — vem da API live */
  graphSource?: GraphSource
  /** Se o .md esperado não existe no filesystem */
  missingSource?: boolean
  /** graph_status do SemanticNode correspondente (se encontrado) */
  graphStatus?: string | null
  /** Geometria calculada a partir da lista ativa de steps */
  positionY?: number
  atomHeight?: number
  onLongPress?: (id: string) => void
}

// Cor canon por fase · permite leitura visual da estrutura do pipeline
// (intake → shape → decide → prove → render) sem precisar ler.
function phaseColor(phase: PipelineStep['phase'], c: ReturnType<typeof usePalette>) {
  switch (phase) {
    case 'intake':  return c.prussian   // azul fria · entrada de dados
    case 'shape':   return c.bronzeLight // bronze claro · transformação
    case 'decide':  return c.bronze      // bronze pleno · centro decisor
    case 'prove':   return c.moss        // verde · verificação
    case 'render':  return c.bronzeLight // bronze suave · saída
    default:        return c.ink3
  }
}

// Cor da barra de saúde baseada na fonte real do .md
function healthBarColor(source: GraphSource | undefined, missing: boolean | undefined, c: ReturnType<typeof usePalette>) {
  if (missing) return c.recRed
  switch (source) {
    case 'repo':    return c.moss     // verde · .md existe no repo
    case 'vault':   return c.prussian // azul · .md vem do vault
    case 'mixed':   return c.bronze   // bronze · fontes mistas
    case 'missing': return c.recRed   // vermelho · .md ausente
    default:        return 'transparent' // sem dados live → sem barra
  }
}

// Label do status canônico para chip visual
function statusLabel(graphStatus: string | null | undefined): { label: string; colorKey: 'moss' | 'amber' | 'bronze' | 'ink3' } | null {
  switch (graphStatus) {
    case 'active':     return { label: 'ATIVO', colorKey: 'moss' }
    case 'building':   return { label: 'CONSTRUINDO', colorKey: 'amber' }
    case 'planned':    return { label: 'PLANEJADO', colorKey: 'bronze' }
    case 'future':     return { label: 'FUTURO', colorKey: 'bronze' }
    case 'deprecated': return { label: 'DESCONTINUADO', colorKey: 'ink3' }
    default:           return null
  }
}

function PipelineAtomImpl({
  step,
  lod,
  onPress,
  isFocused,
  isKin,
  graphSource,
  missingSource,
  graphStatus,
  positionY,
  atomHeight,
  onLongPress,
}: Props) {
  const c = usePalette()
  const reduced = useReducedMotion()
  // Hero pulse · halo bronze pulsando subtle só no Atlas Decide.
  // Sinaliza visualmente "este é o centro decisor do pipeline".
  const heroPulseStyle = useTrailPulse({
    enabled: !!step.hero && !reduced,
    min: 0.45,
    max: 0.9,
    halfPeriod: 2200,
  })
  // Focused pulse · borda bronze respirando no atom em foco. Mais
  // rápido que o hero (1.5s ciclo · "atenção viva").
  const focusedPulseStyle = useTrailPulse({
    enabled: !!isFocused && !reduced,
    min: 0.32,
    max: 0.7,
    halfPeriod: 1500,
  })
  const x = PIPELINE_X
  const y = positionY ?? pipelineStepY(step.num)
  const w = PIPELINE_WIDTH
  const h = atomHeight ?? pipelineStepHeight(step.num) - 12 // gap entre atoms
  const showDeck = lod !== 'far'
  const showPhaseBar = lod === 'close'

  // Estado focused tem peso visual: ring duplo bronze + scale 1.02 sutil
  // (não bouncy · canon Atlas peso silencioso). Outros atoms ficam quietos
  // (opacity 1) — o dim do resto fica a cargo do backdrop semi-transparente
  // por cima, não dos atoms individualmente, pra preservar legibilidade
  // editorial do conjunto.
  const focusedBorder = isFocused ? c.bronze : step.hero ? c.bronze : c.border

  const shellStyle: StyleProp<ViewStyle> = {
    position: 'absolute',
    left: x,
    top: y,
    width: w,
    height: h,
  }

  return (
    <Animated.View
      style={shellStyle}
      entering={reduced
        ? undefined
        : FadeInDown.duration(360)
            .delay(step.num * 38)
            .easing(Easing.bezier(0.16, 1, 0.3, 1))}
    >
      {step.hero ? (
        <>
          {/* Ring externo · halo difuso */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.heroHaloOuter,
              { borderColor: c.bronze },
              heroPulseStyle as StyleProp<ViewStyle>,
            ]}
          />
          {/* Ring médio */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.heroHaloMid,
              { borderColor: c.bronze },
              heroPulseStyle as StyleProp<ViewStyle>,
            ]}
          />
          {/* Ring interno · mais sólido */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.heroHaloInner,
              { borderColor: c.bronzeLight },
            ]}
          />
        </>
      ) : null}
      {/* Focus ring · só quando atom está em foco · pulsa sutil + sólido.
          Outer ring pulsa via mesmo hook que o hero halo · sensação canon
          consistente de "vivo focado". */}
      {isFocused ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.focusRingOuter,
              { borderColor: c.bronze },
              focusedPulseStyle as StyleProp<ViewStyle>,
            ]}
          />
          <View
            pointerEvents="none"
            style={[styles.focusRingInner, { borderColor: c.bronzeLight }]}
          />
        </>
      ) : null}
      <AtomTouchable
        onPress={() => onPress(step.id)}
        onLongPress={onLongPress ? () => onLongPress(step.id) : undefined}
        shellStyle={[
          styles.atomInner,
          {
            backgroundColor: step.hero || isFocused ? c.bgFresh : c.bgRaised,
            borderColor: focusedBorder,
            borderWidth: isFocused ? 2 : step.hero ? 2 : 1,
            opacity: isKin && !isFocused ? 0.92 : 1,
            transform: [{ scale: isFocused ? 1.02 : 1 }],
          },
        ]}
      >
      {/* Barra de saúde real · lado esquerdo · cor baseada na fonte do .md.
          Quando dados live estão presentes, substitui a phase bar estática
          com a informação honesta: verde = existe, vermelho = falta. */}
      {showPhaseBar && graphSource ? (
        <View
          style={[styles.phaseBar, { backgroundColor: healthBarColor(graphSource, missingSource, c) }]}
          pointerEvents="none"
        />
      ) : showPhaseBar ? (
        <View
          style={[styles.phaseBar, { backgroundColor: phaseColor(step.phase, c) }]}
          pointerEvents="none"
        />
      ) : null}
      {/* Header · phase glyph (canon visual da fase) + dot indicador da
          phase color. Sem numeral romano · canon "Cartografia sem letra
          de posição" · operador entende a sequência pela posição vertical
          + cor da phase + glyph. Ordem é visual, não textual. */}
      <View style={styles.header}>
        <View style={[styles.phaseDot, { backgroundColor: phaseColor(step.phase, c) }]} />
        <PhaseGlyph phase={step.phase} size={20} color={c.bronze} emphasized={step.hero} />
      </View>

      <Frau italic weight="med" size={18} lineHeight={22} color={c.ink} style={styles.name}>
        {step.name}
      </Frau>

      {showDeck ? (
        <Frau italic size={11.5} lineHeight={14} color={c.ink2} style={styles.deck} numberOfLines={2}>
          {step.deck}
        </Frau>
      ) : null}

      {/* Status chip canônico · revelado em zoom-close · mostra o
          graph_status real do SemanticNode correspondente. */}
      {showPhaseBar && graphStatus ? (() => {
        const status = statusLabel(graphStatus)
        if (!status) return null
        return (
          <View style={[styles.statusChip, { backgroundColor: c[status.colorKey] + '20', borderColor: c[status.colorKey] + '50' }]}>
            <Mono size={8} letterSpacing={1.2} color={c[status.colorKey]}>
              {status.label}
            </Mono>
          </View>
        )
      })() : null}

      {/* Subs canônicos · revelados em zoom-close · canon AtlasVault.
          Ensina visualmente que o atom tem subcomponentes sem precisar
          entrar no foco. Mini-chips bronze-veil com nome curto. */}
      {showPhaseBar && step.subs && step.subs.length > 0 ? (
        <View style={styles.subsRow}>
          {step.subs.slice(0, 4).map((sub, i) => (
            <View
              key={`${step.id}-sub-${i}`}
              style={[
                styles.subChip,
                {
                  backgroundColor: c.bronze + '14',
                  borderColor: c.bronze + '38',
                },
              ]}
            >
              <Mono size={8.5} letterSpacing={0.6} color={c.ink2}>
                {sub}
              </Mono>
            </View>
          ))}
          {step.subs.length > 4 ? (
            <Mono size={9} letterSpacing={0.6} color={c.ink3} style={styles.subOverflow}>
              +{step.subs.length - 4}
            </Mono>
          ) : null}
        </View>
      ) : null}
      {showPhaseBar ? (
        <View style={styles.affordanceRail} pointerEvents="none">
          <Mono size={9} letterSpacing={0.8} color={c.bronze}>
            ↧
          </Mono>
          <Mono size={9} letterSpacing={0.8} color={c.ink3}>
            ☰
          </Mono>
        </View>
      ) : null}
      </AtomTouchable>
    </Animated.View>
  )
}

/**
 * React.memo · evita re-render dos 17 atoms quando outros atoms mudam
 * de foco. Apenas re-renderiza quando step.id, lod, isFocused ou isKin
 * mudam. onPress é referencialmente estável (useCallback em parent).
 */
export const PipelineAtom = memo(
  PipelineAtomImpl,
  (a, b) =>
    a.step.id === b.step.id &&
    a.lod === b.lod &&
    a.isFocused === b.isFocused &&
    a.isKin === b.isKin &&
    a.onPress === b.onPress &&
    a.graphSource === b.graphSource &&
    a.missingSource === b.missingSource &&
    a.graphStatus === b.graphStatus &&
    a.positionY === b.positionY &&
    a.atomHeight === b.atomHeight &&
    a.onLongPress === b.onLongPress,
)

const styles = StyleSheet.create({
  atomInner: {
    flex: 1,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.38,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.82,
  },
  name: {
    marginTop: 4,
  },
  deck: {
    marginTop: 1,
    opacity: 0.85,
  },
  heroHaloOuter: {
    position: 'absolute',
    top: -28,
    left: -28,
    right: -28,
    bottom: -28,
    borderRadius: 14,
    borderWidth: 1,
    opacity: 0.35,
  },
  heroHaloMid: {
    position: 'absolute',
    top: -18,
    left: -18,
    right: -18,
    bottom: -18,
    borderRadius: 10,
    borderWidth: 1.1,
    opacity: 0.62,
  },
  heroHaloInner: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 6,
    borderWidth: 0.8,
    opacity: 0.85,
  },
  focusRingOuter: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 6,
    borderWidth: 1,
    opacity: 0.45,
  },
  focusRingInner: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 5,
    borderWidth: 1.2,
    opacity: 0.78,
  },
  phaseBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    opacity: 0.78,
  },
  statusChip: {
    marginTop: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  subsRow: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  subChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  subOverflow: {
    marginLeft: 2,
  },
  affordanceRail: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    flexDirection: 'row',
    gap: 6,
    opacity: 0.78,
  },
})
