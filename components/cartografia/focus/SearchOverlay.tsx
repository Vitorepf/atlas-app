/**
 * Cartografia · search overlay (Cmd+K mobile).
 *
 * Lista pesquisável de todos os atoms da Cartografia · universe,
 * pipeline, lanes e continents-radial. Tap = teleporta + foca.
 *
 * UX canon: TextInput no topo, lista vertical agrupada por seção.
 * Backdrop blur premium iOS · slide-up entry · ESC/swipe-down dismiss.
 */
import { useMemo, useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { BlurView } from 'expo-blur'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
  useReducedMotion,
} from 'react-native-reanimated'
import Svg, { Line, Path } from 'react-native-svg'
import * as Haptics from 'expo-haptics'
import { useTheme, usePalette } from '../../../design/theme'
import { Frau, Mono, Sans } from '../../../design/Type'
import {
  LANE_DEFINITIONS,
  PIPELINE_STEPS,
  type LaneDef,
  type PipelineStep,
} from '../map/atlasFlowData'
import { ContinentGlyph } from '../map/ContinentGlyph'
import { NodeGlyph } from '../map/NodeGlyph'
import { PhaseGlyph } from '../map/PhaseGlyph'
import type { LiveSemanticGraph } from '../state/useCartografiaLiveData'
import { buildAllHits, buildCoverageGroups, type SearchCoverageGroup, type SearchHit } from './SearchOverlayModel'

export type { SearchHit } from './SearchOverlayModel'

interface Props {
  visible: boolean
  onClose: () => void
  onSelectHit: (hit: SearchHit) => void
  pipelineSteps?: ReadonlyArray<PipelineStep>
  lanes?: ReadonlyArray<LaneDef>
  semanticGraph?: LiveSemanticGraph | null
}

export function SearchOverlay({ visible, onClose, onSelectHit, pipelineSteps, lanes, semanticGraph }: Props) {
  const c = usePalette()
  const { name: themeName } = useTheme()
  const reduced = useReducedMotion()
  const [query, setQuery] = useState('')

  const allHits = useMemo(
    () => buildAllHits(pipelineSteps ?? PIPELINE_STEPS, lanes ?? LANE_DEFINITIONS, semanticGraph),
    [pipelineSteps, lanes, semanticGraph],
  )
  const coverageGroups = useMemo(() => buildCoverageGroups(allHits).slice(0, 12), [allHits])
  const visibleCount = useMemo(() => allHits.filter((hit) => hit.kind !== 'semantic').length, [allHits])
  const semanticOnlyCount = allHits.length - visibleCount

  const filtered = useMemo(() => {
    if (!query.trim()) return allHits.slice(0, 60)
    const q = query.toLowerCase().trim()
    return allHits.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.subtitle.toLowerCase().includes(q) ||
        h.id.toLowerCase().includes(q) ||
        h.graphId?.toLowerCase().includes(q) ||
        h.section.toLowerCase().includes(q),
    ).slice(0, 80)
  }, [allHits, query])
  const hasQuery = query.trim().length > 0
  const resultLimit = hasQuery ? 80 : 60
  const isTruncated = filtered.length >= resultLimit && allHits.length > filtered.length

  if (!visible) return null

  const handlePress = (hit: SearchHit) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    onSelectHit(hit)
    setQuery('')
  }

  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(220).easing(Easing.bezier(0.16, 1, 0.3, 1))}
      exiting={reduced ? undefined : FadeOut.duration(180)}
      style={styles.root}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={42} tint={themeName === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 24, 31, 0.85)' }]} />
      )}
      <Pressable onPress={onClose} style={StyleSheet.absoluteFill} accessibilityLabel="Fechar busca" />
      <Animated.View
        entering={reduced ? undefined : SlideInUp.duration(320).easing(Easing.bezier(0.16, 1, 0.3, 1))}
        exiting={reduced ? undefined : SlideOutDown.duration(220)}
        style={[
          styles.panel,
          { backgroundColor: c.bgRecessed, borderColor: c.border },
        ]}
      >
        <View style={[styles.searchRow, { borderBottomColor: c.borderSoft }]}>
          <Svg width={16} height={16} viewBox="0 0 16 16">
            <Path d="M 7 1 a 6 6 0 1 0 0 12 a 6 6 0 0 0 0 -12" stroke={c.ink2} strokeWidth={1.4} fill="none" />
            <Line x1={11.5} y1={11.5} x2={15} y2={15} stroke={c.ink2} strokeWidth={1.4} strokeLinecap="round" />
          </Svg>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar peça do mapa"
            placeholderTextColor={c.ink3}
            style={[styles.input, { color: c.ink }]}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Limpar busca"
            >
              <Svg width={14} height={14} viewBox="0 0 14 14">
                <Path
                  d="M 3 3 L 11 11 M 11 3 L 3 11"
                  stroke={c.ink2}
                  strokeWidth={1.4}
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
            <Mono size={10} letterSpacing={1.6} color={c.ink3}>
              FECHAR
            </Mono>
          </Pressable>
        </View>

        <View style={[styles.metaRow, { borderBottomColor: c.borderSoft }]}>
          <Mono size={9.5} letterSpacing={1.6} color={c.ink3}>
            {filtered.length === 0
              ? 'NADA ENCONTRADO'
              : `${filtered.length}${isTruncated ? '+' : ''} PEÇA${filtered.length === 1 ? '' : 'S'}`}
          </Mono>
          {!hasQuery ? (
            <Mono size={9.5} letterSpacing={1.6} color={c.bronze}>
              {isTruncated ? 'DIGITE PARA BUSCAR TUDO' : '✦ TODAS'}
            </Mono>
          ) : null}
        </View>

        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {!hasQuery ? (
            <CoverageMap
              groups={coverageGroups}
              total={allHits.length}
              visibleCount={visibleCount}
              semanticOnlyCount={semanticOnlyCount}
              onSelectSection={setQuery}
            />
          ) : null}
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Frau italic size={15} color={c.ink3}>
                — sem resultados
              </Frau>
            </View>
          ) : (
            filtered.map((hit, i) => (
              <Pressable
                key={`${hit.kind}-${hit.id}-${i}`}
                onPress={() => handlePress(hit)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderBottomColor: c.borderSoft,
                    backgroundColor: pressed ? c.bgRaised : 'transparent',
                  },
                ]}
              >
                <View style={styles.rowGlyph}>
                  {hit.kind === 'continent' ? (
                    <ContinentGlyph continentId={hit.id} size={18} color={c.bronze} detailColor={c.ink3} />
                  ) : hit.kind === 'pipeline' && hit.phase ? (
                    <PhaseGlyph phase={hit.phase} size={16} color={c.bronze} />
                  ) : (
                    <NodeGlyph kind={hit.nodeKind ?? 'tag'} size={14} color={c.bronze} />
                  )}
                </View>
                <View style={styles.rowBody}>
                  <Mono size={9.5} letterSpacing={1.6} color={c.bronze} style={styles.rowSection}>
                    {hit.section}
                  </Mono>
                  <Frau italic weight="med" size={16} lineHeight={20} color={c.ink} numberOfLines={2}>
                    {hit.name}
                  </Frau>
                  <Frau italic size={12} lineHeight={16} color={c.ink2} numberOfLines={2}>
                    {hit.subtitle}
                  </Frau>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  )
}

function CoverageMap({
  groups,
  total,
  visibleCount,
  semanticOnlyCount,
  onSelectSection,
}: {
  groups: SearchCoverageGroup[]
  total: number
  visibleCount: number
  semanticOnlyCount: number
  onSelectSection: (section: string) => void
}) {
  const c = usePalette()
  if (!groups.length) return null

  return (
    <View style={[styles.coverage, { borderBottomColor: c.borderSoft }]}>
      <View style={styles.coverageHeader}>
        <View style={styles.coverageTitleBlock}>
          <Mono size={9} letterSpacing={1.8} color={c.bronze}>
            MAPA DE COBERTURA DOCUMENTAL
          </Mono>
          <Sans size={11} lineHeight={15} color={c.ink3}>
            Tudo que existe no grafo vivo aparece aqui; toque numa camada para filtrar.
          </Sans>
        </View>
        <View style={styles.coverageCounters}>
          <CoverageCounter label="TOTAL" value={total} />
          <CoverageCounter label="VISUAL" value={visibleCount} />
          <CoverageCounter label="GRAFO" value={semanticOnlyCount} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coverageRail}>
        {groups.map((group) => (
          <Pressable
            key={group.section}
            onPress={() => onSelectSection(group.section)}
            style={({ pressed }) => [
              styles.coverageCard,
              {
                borderColor: group.semanticOnly ? c.bronze : c.border,
                backgroundColor: pressed ? c.bgRaised : c.bg,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Filtrar documentação ${group.section}`}
          >
            <Mono size={8.5} letterSpacing={1.3} color={c.bronze} numberOfLines={1}>
              {group.section}
            </Mono>
            <Frau italic weight="med" size={18} lineHeight={22} color={c.ink}>
              {group.total}
            </Frau>
            <View style={styles.coverageMiniRow}>
              <Mono size={8} letterSpacing={1.1} color={c.ink3}>
                VIS {group.visible}
              </Mono>
              <Mono size={8} letterSpacing={1.1} color={group.semanticOnly ? c.bronze : c.ink3}>
                GRAFO {group.semanticOnly}
              </Mono>
            </View>
            <Sans size={10} lineHeight={13} color={c.ink2} numberOfLines={2}>
              {group.sampleNames.join(' · ')}
            </Sans>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  )
}

function CoverageCounter({ label, value }: { label: string; value: number }) {
  const c = usePalette()
  return (
    <View style={[styles.coverageCounter, { borderColor: c.borderSoft }]}>
      <Mono size={8} letterSpacing={1.2} color={c.ink3}>
        {label}
      </Mono>
      <Mono size={11} letterSpacing={1.2} color={c.ink}>
        {value}
      </Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  panel: {
    position: 'absolute',
    top: 88,
    left: 14,
    right: 14,
    bottom: 80,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.46,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontFamily: undefined,
    paddingVertical: 0,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  list: {
    flex: 1,
  },
  coverage: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  coverageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  coverageTitleBlock: {
    flex: 1,
    gap: 4,
  },
  coverageCounters: {
    flexDirection: 'row',
    gap: 6,
  },
  coverageCounter: {
    minWidth: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 5,
    alignItems: 'center',
    gap: 2,
  },
  coverageRail: {
    gap: 8,
    paddingRight: 10,
  },
  coverageCard: {
    width: 152,
    minHeight: 104,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 7,
    padding: 10,
    gap: 5,
  },
  coverageMiniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowGlyph: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowSection: {
    marginBottom: 2,
  },
  empty: {
    padding: 24,
    alignItems: 'center',
  },
})
