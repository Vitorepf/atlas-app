import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
} from 'react-native-reanimated'
import { SectionHead, TocRow, DestinoItem } from '../../editorial'
import { Frau, Mono, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import type {
  AiObservabilityResponse,
  AiProvidersStatusResponse,
  AtlasAiCompaction,
  AtlasAiProviderHandoff,
  AtlasAiQualityAction,
  AtlasAiSessionState,
  AtlasAiThread,
  AtlasAiTrace,
} from '../../../lib/api/client'
import {
  type AtlasAiTurnFilter,
} from '../../../lib/atlasAiRuntime'
import { providerWord } from './threadHistoryModel'

const OPEN_ACTION_STATUSES = new Set(['queued', 'running', 'blocked', 'failed'])

export function ContinuityPanel({
  thread,
  state,
  compaction,
  handoff,
  providerStatus,
  observability,
  qualityActions,
  latestTrace,
  activeTrace,
  activeTraceAgeMs,
  lastRefreshAt,
  lastRefreshError,
  refreshFailures,
  pinnedCount,
  turnFilter,
  busy,
  disabled,
  onCompact,
  onOpenThreads,
  onOpenContext,
  onOpenOperations,
  onOpenExecution,
  onOpenSkills,
  onOpenSearch,
  onOpenMap,
  onSetTurnFilter,
  onCopyConversation,
  expanded,
  onToggleExpanded,
  hasTurns,
}: {
  thread: AtlasAiThread | null
  state: AtlasAiSessionState | null
  compaction: AtlasAiCompaction | null
  handoff: AtlasAiProviderHandoff | null
  providerStatus: AiProvidersStatusResponse | null
  observability: AiObservabilityResponse | null
  qualityActions: AtlasAiQualityAction[]
  latestTrace: AtlasAiTrace | null
  activeTrace: AtlasAiTrace | null
  activeTraceAgeMs: number | null
  lastRefreshAt: number | null
  lastRefreshError: string | null
  refreshFailures: number
  pinnedCount: number
  turnFilter: AtlasAiTurnFilter
  busy: string | null
  disabled: boolean
  onCompact: () => void
  onOpenThreads: () => void
  onOpenContext: () => void
  onOpenOperations: () => void
  onOpenExecution: (trace: AtlasAiTrace) => void
  onOpenSkills: () => void
  expanded: boolean
  onToggleExpanded: () => void
  onOpenSearch: () => void
  onOpenMap: () => void
  onSetTurnFilter: (filter: AtlasAiTurnFilter) => void
  onCopyConversation: () => void
  hasTurns: boolean
}) {
  const { c } = useTheme()
  const openActions = qualityActions.filter((action) => OPEN_ACTION_STATUSES.has(action.status))
  const queue = providerStatus?.queue ?? observability?.jobs
  const topic = state?.current_topic || state?.objective || thread?.summary || 'sem sessão ativa'
  const compactionLabel = compaction
    ? `compactado ${formatRelative(compaction.created_at)} · ${compaction.quality_gate_status}`
    : 'sem compactação manual'
  const handoffLabel = handoff
    ? `handoff para ${providerWord(handoff.to_provider) ?? handoff.to_provider} ${formatRelative(handoff.created_at)}`
    : 'sem troca recente'

  return (
    <Animated.View
      layout={LinearTransition.springify().damping(22).stiffness(170).mass(0.9)}
      style={[styles.continuityPanel, expanded ? styles.continuityPanelOpen : null, { borderBottomColor: c.border, backgroundColor: c.bg }]}
    >
      <View style={[styles.continuityTop, (!thread?.title || expanded) ? styles.continuityTopEmpty : null]}>
        {thread?.title && !expanded ? (
          <Pressable
            onPress={onOpenThreads}
            hitSlop={8}
            style={({ pressed }) => [styles.continuityTitle, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity: 0.55 }}>
              continuidade
            </Frau>
            <Sans weight="med" size={14} lineHeight={19} color={c.ink} numberOfLines={1}>
              {thread.title}
            </Sans>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onToggleExpanded}
          hitSlop={10}
          style={({ pressed }) => [styles.continuityToggle, { opacity: pressed ? 0.55 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'recolher diagnóstico' : 'expandir diagnóstico'}
        >
          <Frau italic size={14} lineHeight={20} color={c.ink} style={{ opacity: 0.55 }}>
            · {expanded ? 'recolher' : 'expandir'}
          </Frau>
        </Pressable>
      </View>

      {expanded ? (
        <Animated.View
          entering={FadeInDown.duration(360).springify().damping(22).stiffness(160).mass(0.85)}
          exiting={FadeOutUp.duration(220).easing(Easing.out(Easing.cubic))}
        >
          <View style={styles.continuityHeader}>
            <Mono size={11} lineHeight={14} letterSpacing={1.6} color={c.ink2} style={styles.continuityHeaderEyebrow}>
              CONTINUIDADE DA SESSÃO
            </Mono>
            <Frau italic size={22} lineHeight={29} letterSpacing={-0.18} color={c.ink}>
              {thread?.title || 'Atlas · sessão atual.'}
            </Frau>
          </View>
          <View style={[styles.continuityHeaderRule, { backgroundColor: `${c.ink}1F` }]} />

          <View style={styles.continuitySection}>
            <SectionHead numeral="i" title="Estado" />
            <TocRow withDivider={false} variant="doorway" label="estado" value={topic} />
            <TocRow withDivider={false} variant="doorway" label="memória" value={compactionLabel} />
            <TocRow withDivider={false} variant="doorway" label="troca" value={handoffLabel} />
            <TocRow withDivider={false} variant="doorway" label="operação" value={operacaoSummary(queue, openActions.length)} />
            <TocRow withDivider={false} variant="doorway" label="qualidade" value={qualitySummary(observability, openActions)} />
          </View>

          <SyncDateline
            activeTrace={activeTrace}
            activeTraceAgeMs={activeTraceAgeMs}
            lastRefreshAt={lastRefreshAt}
            lastRefreshError={lastRefreshError}
            refreshFailures={refreshFailures}
          />

          <View style={styles.continuitySection}>
            <SectionHead numeral="ii" title="Operações" />
            <DestinoItem
              label={busy === 'compact' ? 'Compactando' : 'Compactar'}
              subtitle="comprime memória da sessão atual"
              onPress={onCompact}
              disabled={disabled || busy === 'compact'}
            />
            <DestinoItem label="Contexto" subtitle="abrir Context Pack ativo" onPress={onOpenContext} />
            <DestinoItem label="Mapa" subtitle="ver mapa cognitivo do Atlas" active={pinnedCount > 0} onPress={onOpenMap} />
            <DestinoItem label="Buscar" subtitle="buscar em sessões e memória" onPress={onOpenSearch} />
            <DestinoItem label="Fila" subtitle="fila de operações pendentes" onPress={onOpenOperations} />
            <DestinoItem label="Skills" subtitle="skills disponíveis" isLast={!hasTurns && !latestTrace} onPress={onOpenSkills} />
            {hasTurns ? (
              <DestinoItem
                label="Copiar"
                subtitle="copia toda a conversa pra clipboard"
                isLast={!latestTrace}
                onPress={onCopyConversation}
              />
            ) : null}
            {latestTrace ? (
              <DestinoItem
                label="Execução"
                subtitle="abre o trace de execução mais recente"
                isLast
                onPress={() => onOpenExecution(latestTrace)}
              />
            ) : null}
          </View>

          {hasTurns ? (
            <View style={styles.continuitySection}>
              <SectionHead numeral="iii" title="Vistas" />
              <View style={styles.vistasStrip}>
                {(['all', 'pinned', 'decisions', 'actions', 'dev', 'errors'] as AtlasAiTurnFilter[]).map((filter, idx) => {
                  const active = turnFilter === filter
                  return (
                    <Pressable
                      key={filter}
                      onPress={() => onSetTurnFilter(filter)}
                      hitSlop={6}
                      style={({ pressed }) => [styles.vistasItem, { opacity: pressed ? 0.55 : 1 }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Frau
                        italic
                        weight={active ? 'med' : 'reg'}
                        size={14}
                        lineHeight={20}
                        color={active ? c.bronze : c.ink3}
                        style={active ? styles.vistasItemActive : undefined}
                      >
                        {turnFilterLabel(filter, pinnedCount)}
                      </Frau>
                      {idx < 5 ? (
                        <Frau italic size={14} lineHeight={20} color={c.ink3} style={styles.vistasSep}>
                          ·
                        </Frau>
                      ) : null}
                    </Pressable>
                  )
                })}
              </View>
            </View>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  )
}

function SyncDateline({
  activeTrace,
  activeTraceAgeMs,
  lastRefreshAt,
  lastRefreshError,
  refreshFailures,
}: {
  activeTrace: AtlasAiTrace | null
  activeTraceAgeMs: number | null
  lastRefreshAt: number | null
  lastRefreshError: string | null
  refreshFailures: number
}) {
  const { c } = useTheme()
  const activeAge = activeTraceAgeMs != null && Number.isFinite(activeTraceAgeMs)
    ? Math.max(0, activeTraceAgeMs)
    : null
  const stale = Boolean(activeTrace && activeAge != null && activeAge > 10 * 60 * 1000)
  const text = lastRefreshError
    ? `reconectando · ${refreshFailures} falha${refreshFailures === 1 ? '' : 's'}`
    : stale
      ? `execução longa · ${formatLatency(activeAge ?? 0)}`
      : lastRefreshAt
        ? `sincronizado ${formatRelative(new Date(lastRefreshAt).toISOString())}`
        : 'sincronização aguardando'

  return (
    <View style={styles.syncDateline}>
      <Frau italic size={14} lineHeight={20} color={lastRefreshError ? c.recRed : stale ? c.bronze : c.ink2}>
        — {text}.
      </Frau>
    </View>
  )
}

function operacaoSummary(
  queue: { queued?: number; processing?: number } | null | undefined,
  openActionsCount: number,
): string {
  const queued = queue?.queued ?? 0
  const processing = queue?.processing ?? 0
  if (queued === 0 && processing === 0 && openActionsCount === 0) {
    return 'em repouso'
  }
  return `fila ${queued} · rodando ${processing} · ações ${openActionsCount}`
}

export function turnFilterLabel(filter: AtlasAiTurnFilter, pinnedCount: number): string {
  if (filter === 'all') return 'todos'
  if (filter === 'pinned') return pinnedCount > 0 ? `fixados ${pinnedCount}` : 'fixados'
  if (filter === 'decisions') return 'decisões'
  if (filter === 'actions') return 'ações'
  if (filter === 'dev') return 'código'
  return 'erros'
}

function qualitySummary(
  observability: AiObservabilityResponse | null,
  openActions: AtlasAiQualityAction[],
): string {
  const quality = observability?.quality
  const actionsCount = openActions.length

  if (!quality?.available) {
    return actionsCount === 0 ? 'em repouso' : `${actionsCount} ${actionsCount === 1 ? 'ação aberta' : 'ações abertas'}`
  }

  const avg = typeof quality.average_score === 'number' ? `${quality.average_score}/100` : 'sem média'
  const review = quality.by_status?.needs_review ?? 0
  const failed = quality.by_status?.failed ?? 0

  if (review === 0 && failed === 0 && actionsCount === 0) {
    return avg
  }

  const parts: string[] = [avg]
  if (review > 0) parts.push(`${review} a revisar`)
  if (failed > 0) parts.push(`${failed} ${failed === 1 ? 'falha' : 'falhas'}`)
  if (actionsCount > 0) parts.push(`${actionsCount} ${actionsCount === 1 ? 'ação' : 'ações'}`)
  return parts.join(' · ')
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  const seconds = ms / 1000
  if (seconds < 10) return `${seconds.toFixed(1)} s`
  return `${Math.round(seconds)} s`
}

function formatRelative(value: string | null | undefined): string {
  if (!value) return 'sem data'
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return 'sem data'

  const diffMs = Date.now() - time
  if (diffMs < 60_000) return 'agora'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 14) return `há ${days} d`
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

const styles = StyleSheet.create({
  continuityPanel: {
    paddingBottom: 12,
    marginBottom: 18,
  },
  continuityPanelOpen: {
    paddingBottom: 22,
    marginBottom: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  continuityTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  continuityTopEmpty: {
    justifyContent: 'flex-end',
    minHeight: 0,
  },
  continuityTitle: {
    flex: 1,
    gap: 2,
  },
  continuityToggle: {
    paddingVertical: 4,
  },
  continuitySection: {
    marginBottom: 12,
  },
  continuityHeader: {
    marginLeft: 32,
    marginRight: 32,
    marginTop: 12,
    marginBottom: 14,
  },
  continuityHeaderEyebrow: {
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  continuityHeaderRule: {
    height: 1,
    marginLeft: 32,
    marginRight: 32,
    marginBottom: 4,
  },
  syncDateline: {
    marginTop: 18,
    marginBottom: 6,
    marginLeft: 32,
    marginRight: 32,
  },
  vistasStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 14,
    marginLeft: 32,
    marginRight: 32,
    gap: 0,
  },
  vistasItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  vistasItemActive: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
  vistasSep: {
    paddingHorizontal: 8,
    opacity: 0.45,
  },
})
