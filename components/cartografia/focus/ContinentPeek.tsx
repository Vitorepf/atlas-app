/**
 * Cartografia · peek overlay de continent · long-press preview.
 *
 * Long-press num continent atom no universe abre este overlay
 * mostrando preview rico sem navegar: glyph grande + nome + deck +
 * lista dos primeiros 4 nodes daquele continent. Tap no backdrop ou
 * "ENTRAR" navega de verdade. Tap "FECHAR" só fecha.
 *
 * Sensação canon iOS "Peek" (3D Touch ancestral) · review visual antes
 * de commit. UX enterprise.
 */
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { BlurView } from 'expo-blur'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
  useReducedMotion,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { useTheme, usePalette } from '../../../design/theme'
import { Frau, Mono } from '../../../design/Type'
import { ContinentGlyph } from '../map/ContinentGlyph'
import { NodeGlyph } from '../map/NodeGlyph'
import { PhaseGlyph } from '../map/PhaseGlyph'
import { UNIVERSE_CONTINENTS } from '../map/layout'
import { findContinentScene, type NodeKind } from '../map/continentNodes'
import {
  PIPELINE_STEPS,
  LANE_DEFINITIONS,
  type FlowPhase,
  type PipelineStep,
} from '../map/atlasFlowData'

interface Props {
  continentId: string | null
  onClose: () => void
  onEnter: () => void
  pipelineSteps?: ReadonlyArray<PipelineStep>
  laneCount?: number
}

export function ContinentPeek({ continentId, onClose, onEnter, pipelineSteps = PIPELINE_STEPS, laneCount: liveLaneCount }: Props) {
  const c = usePalette()
  const { name: themeName } = useTheme()
  const reduced = useReducedMotion()
  if (!continentId) return null
  const cont = UNIVERSE_CONTINENTS.find((x) => x.id === continentId)
  if (!cont) return null

  // Preview nodes: Atlas usa pipeline (6 first), outros usam radial scene
  type PreviewNode = {
    id: string
    name: string
    phase?: FlowPhase
    nodeKind?: NodeKind
  }
  const previewNodes: PreviewNode[] = (() => {
    if (continentId === 'atlas') {
      return pipelineSteps.slice(0, 6).map((s) => ({
        id: s.id,
        name: s.name,
        phase: s.phase,
      }))
    }
    const scene = findContinentScene(continentId)
    return (
      scene?.nodes.slice(0, 6).map((n) => ({
        id: n.id,
        name: n.name,
        nodeKind: n.kind,
      })) ?? []
    )
  })()

  const laneCount = continentId === 'atlas' ? liveLaneCount ?? LANE_DEFINITIONS.length : 0

  const handleEnter = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    onEnter()
  }

  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(220)}
      exiting={reduced ? undefined : FadeOut.duration(180)}
      style={styles.root}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={36} tint={themeName === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 24, 31, 0.84)' }]} />
      )}
      <Pressable onPress={onClose} style={StyleSheet.absoluteFill} accessibilityLabel="Fechar peek" />

      <Animated.View
        entering={reduced ? undefined : ZoomIn.duration(280).easing(Easing.bezier(0.16, 1, 0.3, 1))}
        exiting={reduced ? undefined : ZoomOut.duration(220)}
        style={[styles.card, { backgroundColor: c.bgRaised, borderColor: c.bronze }]}
      >
        {/* Header glyph + nome */}
        <View style={styles.header}>
          <View style={[styles.glyphFrame, { borderColor: c.bronze, backgroundColor: c.bgFresh }]}>
            <ContinentGlyph continentId={cont.id} size={88} color={c.bronze} detailColor={c.ink3} />
          </View>
          <View style={styles.headerInfo}>
            <Mono size={10} letterSpacing={2} color={c.bronze}>
              CONTINENTE
            </Mono>
            <Frau italic weight="med" size={26} lineHeight={30} color={c.ink}>
              {cont.name}
            </Frau>
            <Frau italic size={13} lineHeight={18} color={c.ink2}>
              {cont.deck}
            </Frau>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: c.bronze, opacity: 0.18 }]} />

        {/* Counts row */}
        <View style={styles.countsRow}>
          <View style={styles.countCol}>
            <Frau italic weight="med" size={22} lineHeight={26} color={c.ink}>
              {cont.count}
            </Frau>
            <Mono size={9.5} letterSpacing={1.4} color={c.ink3}>
              PEÇAS
            </Mono>
          </View>
          {laneCount > 0 ? (
            <View style={styles.countCol}>
              <Frau italic weight="med" size={22} lineHeight={26} color={c.ink}>
                {laneCount}
              </Frau>
              <Mono size={9.5} letterSpacing={1.4} color={c.ink3}>
                LANES
              </Mono>
            </View>
          ) : null}
          <View style={styles.countCol}>
            <Frau italic weight="med" size={22} lineHeight={26} color={c.ink}>
              {previewNodes.length}+
            </Frau>
            <Mono size={9.5} letterSpacing={1.4} color={c.ink3}>
              EM PREVIEW
            </Mono>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: c.bronze, opacity: 0.18 }]} />

        {/* Preview nodes · cada chip com glyph categorizado canon */}
        <View style={styles.nodesGrid}>
          {previewNodes.map((node) => (
            <View key={node.id} style={[styles.nodeChip, { borderColor: c.borderSoft }]}>
              {node.phase ? (
                <PhaseGlyph phase={node.phase} size={12} color={c.bronze} />
              ) : (
                <NodeGlyph kind={node.nodeKind ?? 'tag'} size={12} color={c.bronze} />
              )}
              <Frau italic size={11.5} lineHeight={14} color={c.ink2} numberOfLines={2}>
                {node.name}
              </Frau>
            </View>
          ))}
        </View>

        {/* Footer actions */}
        <View style={styles.footer}>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.footerBtn, { opacity: pressed ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Fechar peek"
          >
            <Mono size={10} letterSpacing={1.8} color={c.ink3}>
              FECHAR
            </Mono>
          </Pressable>
          <Pressable
            onPress={handleEnter}
            style={({ pressed }) => [
              styles.footerEnterBtn,
              { backgroundColor: c.bronze, opacity: pressed ? 0.78 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Entrar em ${cont.name}`}
          >
            <Mono size={10} letterSpacing={1.8} color={c.onInk}>
              ENTRAR
            </Mono>
            <Svg width={11} height={11} viewBox="0 0 11 11">
              <Path d="M 3 2 L 8 5.5 L 3 9" stroke={c.onInk} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '86%',
    maxWidth: 380,
    borderWidth: 2,
    borderRadius: 10,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  glyphFrame: {
    width: 108,
    height: 108,
    borderWidth: 1.5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
    gap: 3,
  },
  divider: {
    height: 1,
  },
  countsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  countCol: {
    alignItems: 'center',
    gap: 2,
  },
  nodesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  nodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
  },
  nodeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  footerBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  footerEnterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 4,
  },
})
