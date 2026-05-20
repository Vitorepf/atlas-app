import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Frau, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import type {
  AiObservabilityResponse,
  AiProvidersStatusResponse,
  AtlasAiQualityAction,
  AtlasAiQualityEvaluation,
  AtlasAiTrace,
} from '../../../lib/api/client'
import { CaptionWhisper } from '../../console/CaptionWhisper'
import { BottomSheet } from '../BottomSheet'
import {
  DataList,
  DataRow,
  DataSection,
  EmptyInline,
  SheetHeading,
  StatusPill,
} from './AtlasAiDataPrimitives'
import { providerWord } from './threadHistoryModel'

const OPEN_ACTION_STATUSES = new Set(['queued', 'running', 'blocked', 'failed'])

export function OperationsSheet({
  visible,
  providerStatus,
  observability,
  qualityActions,
  onClose,
  onRunQualityAction,
}: {
  visible: boolean
  providerStatus: AiProvidersStatusResponse | null
  observability: AiObservabilityResponse | null
  qualityActions: AtlasAiQualityAction[]
  onClose: () => void
  onRunQualityAction: (action: AtlasAiQualityAction) => void
}) {
  const { c } = useTheme()
  const openActions = qualityActions.filter((action) => OPEN_ACTION_STATUSES.has(action.status))
  const providers = providerStatus?.providers ?? []
  const metrics = observability?.metrics
  const metricsHealth = observability?.metrics_health
  const metricTotals = metrics?.available ? metrics.totals : null
  const surfaceBuckets = metrics?.available ? metrics.by_surface ?? [] : []
  const atlasDecideMetrics = metrics?.available ? metrics.atlas_decide : null
  const atlasDecideBuckets = metrics?.available ? metrics.by_atlas_decide_execution_strategy ?? [] : []
  const missingCostRates = metricsHealth?.evidence?.missing_cost_rates ?? []

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <SheetHeading title="Operação Atlas" subtitle="providers, fila e qualidade" />

        <DataSection title="fila">
          <DataRow label="queued" value={String(providerStatus?.queue.queued ?? observability?.jobs.queued ?? 0)} />
          <DataRow label="rodando" value={String(providerStatus?.queue.processing ?? observability?.jobs.processing ?? 0)} />
          <DataRow label="falhas 24h" value={String(providerStatus?.queue.failed ?? observability?.jobs.failed_24h ?? 0)} />
        </DataSection>

        <DataSection title="providers">
          {providers.length === 0 ? (
            <EmptyInline text="sem health check carregado" />
          ) : providers.map((provider) => (
            <View key={`${provider.provider}-${provider.checked_at}`} style={[styles.executionRow, { borderTopColor: c.border }]}>
              <View style={styles.rowSplit}>
                <Sans weight="med" size={13} lineHeight={18} color={c.ink}>
                  {providerWord(provider.provider) ?? provider.provider}
                </Sans>
                <StatusPill status={provider.status} />
              </View>
              <CaptionWhisper
                text={`p50 ${provider.p50_latency_ms ? formatLatency(provider.p50_latency_ms) : 'n/a'} · jobs ${provider.total_jobs_24h} · dor ${provider.operational_pain_score}`}
              />
              {provider.message && (
                <Sans size={12} lineHeight={17} color={c.ink2}>
                  {provider.message}
                </Sans>
              )}
            </View>
          ))}
        </DataSection>

        <DataSection title="qualidade">
          <DataRow
            label="média"
            value={observability?.quality.available && observability.quality.average_score != null
              ? `${observability.quality.average_score}/100`
              : 'sem dados'}
          />
          <DataRow
            label="revisar"
            value={String(observability?.quality.by_status?.needs_review ?? 0)}
          />
          <DataRow
            label="falhou"
            value={String(observability?.quality.by_status?.failed ?? 0)}
          />
        </DataSection>

        <DataSection title="health gate">
          {!metricsHealth?.available ? (
            <EmptyInline text="sem health gate carregado" />
          ) : (
            <>
              <DataRow label="status" value={String(metricsHealth.status)} />
              <DataRow label="score" value={metricsHealth.health_score != null ? `${metricsHealth.health_score}/100` : 'n/a'} />
              <DataRow label="issues" value={String(metricsHealth.issues.length)} />
              {missingCostRates.length > 0 && (
                <DataList
                  label="rates faltando"
                  items={missingCostRates.map((rate) => {
                    const provider = rate.provider ? providerWord(rate.provider) ?? rate.provider : 'provider?'
                    const model = rate.model ?? 'model?'

                    return `${provider}/${model} · ${rate.reason} · ${rate.traces} traces`
                  })}
                />
              )}
              {metricsHealth.issues.slice(0, 3).map((issue) => (
                <DataRow key={issue.key} label={issue.key} value={`${issue.severity}: ${issue.summary}`} />
              ))}
            </>
          )}
        </DataSection>

        <DataSection title="eficiência">
          {!metrics?.available || !metricTotals ? (
            <EmptyInline text="sem scorecard carregado" />
          ) : (
            <>
              <DataRow label="traces 24h" value={String(metricTotals.traces)} />
              <DataRow label="qualidade final" value={formatScore(metricTotals.final_quality_avg)} />
              <DataRow label="eficiência final" value={formatScore(metricTotals.final_efficiency_avg)} />
              <DataRow label="1a passagem" value={formatRate(metricTotals.first_pass_success_rate)} />
              <DataRow label="remediação" value={formatRate(metricTotals.needed_remediation_rate)} />
              <DataRow
                label="visível app"
                value={metricTotals.app_visible_avg_ms != null ? formatLatency(metricTotals.app_visible_avg_ms) : 'n/a'}
              />
              <DataRow label="custo incerto" value={String(metricTotals.unknown_cost_count)} />
              <DataRow label="custo estimado" value={String(metricTotals.estimated_cost_count ?? 0)} />
              <DataRow label="custo real" value={String(metricTotals.actual_cost_count ?? 0)} />
              {atlasDecideMetrics?.available && (
                <>
                  <DataRow label="atlas decide" value={`${atlasDecideMetrics.traces} traces`} />
                  <DataRow label="multi-stage" value={`${atlasDecideMetrics.multi_stage_count} · ${formatRate(atlasDecideMetrics.multi_stage_rate)}`} />
                  <DataRow label="degradado" value={`${atlasDecideMetrics.degraded_count} · ${formatRate(atlasDecideMetrics.degraded_rate)}`} />
                  {atlasDecideBuckets.slice(0, 2).map((bucket) => (
                    <DataRow
                      key={`atlas-decide-${bucket.bucket}`}
                      label={bucket.bucket.replace(/_/g, ' ')}
                      value={`${bucket.traces} · q ${formatScore(bucket.quality_avg)} · e ${formatScore(bucket.efficiency_avg)}`}
                    />
                  ))}
                </>
              )}
              {surfaceBuckets.slice(0, 3).map((bucket) => (
                <DataRow
                  key={bucket.bucket}
                  label={bucket.bucket}
                  value={`q ${formatScore(bucket.quality_avg)} · e ${formatScore(bucket.efficiency_avg)}`}
                />
              ))}
            </>
          )}
        </DataSection>

        <DataSection title="ações abertas">
          {openActions.length === 0 ? (
            <EmptyInline text="nenhuma ação aberta" />
          ) : openActions.slice(0, 12).map((action) => (
            <View key={action.id} style={[styles.executionRow, { borderTopColor: c.border }]}>
              <View style={styles.rowSplit}>
                <Sans weight="med" size={13} lineHeight={18} color={c.ink}>
                  {action.action_type.replace(/_/g, ' ')}
                </Sans>
                <StatusPill status={action.status} />
              </View>
              <CaptionWhisper text={`${action.reason} · prioridade ${action.priority}`} />
              <View style={styles.inlineActions}>
                <SheetAction
                  label={qualityActionLabel(action)}
                  onPress={() => onRunQualityAction(action)}
                  disabled={!canRunQualityAction(action)}
                />
              </View>
            </View>
          ))}
        </DataSection>
      </ScrollView>
    </BottomSheet>
  )
}

export function SkillsSheet({
  visible,
  traces,
  qualityActions,
  onClose,
}: {
  visible: boolean
  traces: AtlasAiTrace[]
  qualityActions: AtlasAiQualityAction[]
  onClose: () => void
}) {
  const { c } = useTheme()
  const agents = skillDiagnostics(traces, qualityActions)

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <SheetHeading title="Skills e agentes" subtitle="uso, qualidade e pontos de atenção" />

        <DataSection title="visão geral">
          <DataRow label="agentes" value={String(agents.length)} />
          <DataRow label="traces" value={String(traces.length)} />
          <DataRow label="ações" value={String(qualityActions.length)} />
        </DataSection>

        <DataSection title="agentes ativos">
          {agents.length === 0 ? (
            <EmptyInline text="nenhum agente usado nesta sessão" />
          ) : agents.map((agent) => (
            <View key={agent.slug} style={[styles.executionRow, { borderTopColor: c.border }]}>
              <View style={styles.rowSplit}>
                <Sans weight="med" size={13} lineHeight={18} color={c.ink}>
                  {agent.slug}
                </Sans>
                <StatusPill status={agent.status} />
              </View>
              <CaptionWhisper
                text={`${agent.count} usos · qualidade ${agent.averageScore ?? 'n/a'} · ações ${agent.openActions}`}
              />
              <DataList label="providers" items={agent.providers} />
              <DataList label="skills" items={agent.skills} />
              <DataList label="flags" items={agent.flags} />
            </View>
          ))}
        </DataSection>
      </ScrollView>
    </BottomSheet>
  )
}

function SheetAction({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  // Slice 6af · haptic Soft + press scale spring canon premium
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    onPress()
  }
  const pressScale = useSharedValue(1)
  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))
  return (
    <Animated.View style={pressAnimStyle}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        hitSlop={8}
        onPressIn={() => {
          pressScale.value = withTiming(0.96, { duration: 120, easing: Easing.out(Easing.quad) })
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { damping: 14, stiffness: 240, mass: 0.7 })
        }}
        style={({ pressed }) => [
          styles.microAction,
          {
            borderColor: active ? c.bronze : c.border,
            backgroundColor: pressed ? c.bgRaised : 'transparent',
            opacity: disabled ? 0.35 : 1,
          },
        ]}
      >
        <Frau italic size={12} lineHeight={16} color={active ? c.bronze : c.ink2}>
          {label}
        </Frau>
      </Pressable>
    </Animated.View>
  )
}

function qualityActionLabel(action: AtlasAiQualityAction): string {
  if (action.status === 'queued') return 'correção na fila'
  if (action.status === 'running') return 'corrigindo'
  if (action.status === 'failed') return 'repetir correção'
  if (action.status === 'blocked') return 'corrigir'
  return action.action_type.replace(/_/g, ' ')
}

function canRunQualityAction(action: AtlasAiQualityAction): boolean {
  return action.status === 'queued' || action.status === 'failed'
}

function qualityFlagCodes(evaluation?: AtlasAiQualityEvaluation | null): string[] {
  const flags = evaluation?.flags
  if (!Array.isArray(flags)) return []
  return flags.map((flag) => {
    const code = (flag as { code?: unknown })?.code
    return typeof code === 'string' ? code : null
  }).filter((code): code is string => Boolean(code))
}

function skillVersionLabels(trace: AtlasAiTrace | null): string[] {
  if (!trace) return []
  return Object.entries(trace.skill_versions ?? {}).map(([slug, data]) => {
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>
      const version = typeof record.version === 'string' ? record.version : null
      const hash = typeof record.hash === 'string' ? shortId(record.hash) : null
      return [slug, version, hash].filter(Boolean).join(' · ')
    }
    return slug
  })
}

function skillDiagnostics(traces: AtlasAiTrace[], qualityActions: AtlasAiQualityAction[]) {
  const byAgent = new Map<string, {
    slug: string
    count: number
    providers: Set<string>
    skills: Set<string>
    scores: number[]
    flags: Set<string>
    openActions: number
  }>()

  for (const trace of traces) {
    const slug = trace.agent_slug || 'orquestrador'
    const current = byAgent.get(slug) ?? {
      slug,
      count: 0,
      providers: new Set<string>(),
      skills: new Set<string>(),
      scores: [],
      flags: new Set<string>(),
      openActions: 0,
    }
    current.count += 1
    if (trace.provider) current.providers.add(providerWord(trace.provider) ?? String(trace.provider))
    for (const label of skillVersionLabels(trace)) current.skills.add(label)
    if (trace.quality_evaluation?.score != null) current.scores.push(trace.quality_evaluation.score)
    for (const flag of qualityFlagCodes(trace.quality_evaluation)) current.flags.add(flag)
    byAgent.set(slug, current)
  }

  for (const action of qualityActions) {
    if (!OPEN_ACTION_STATUSES.has(action.status)) continue
    const trace = traces.find((item) => item.id === action.trace_id)
    const slug = trace?.agent_slug ?? 'desconhecido'
    const current = byAgent.get(slug) ?? {
      slug,
      count: 0,
      providers: new Set<string>(),
      skills: new Set<string>(),
      scores: [],
      flags: new Set<string>(),
      openActions: 0,
    }
    current.openActions += 1
    byAgent.set(slug, current)
  }

  return [...byAgent.values()]
    .map((item) => {
      const averageScore = item.scores.length
        ? Math.round(item.scores.reduce((sum, score) => sum + score, 0) / item.scores.length)
        : null
      return {
        slug: item.slug,
        count: item.count,
        providers: [...item.providers],
        skills: [...item.skills],
        flags: [...item.flags],
        openActions: item.openActions,
        averageScore,
        status: item.openActions > 0 ? 'needs_review' : averageScore != null && averageScore < 70 ? 'degraded' : 'passed',
      }
    })
    .sort((left, right) => right.count - left.count)
}

function shortId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`
}

function formatLatency(ms: number): string {
  if (!Number.isFinite(ms)) return 'n/a'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`
}

function formatScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'n/a'
  return `${Math.round(value)}/100`
}

function formatRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'n/a'
  return `${Math.round(value * 100)}%`
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 40,
  },
  executionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 7,
  },
  rowSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  microAction: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
