import { RefreshControl, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { CodexReveal } from '../components/CodexReveal'
import { Masthead, EditorialDateline } from '../components/editorial'
import { PressableTextScale } from '../components/atlas-ui/PressableScale'
import { SignatureGesture } from '../components/edition/SignatureGesture'
import { editorialDateLine } from '../lib/folio'
import { Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { useShell } from '../components/AtlasShell'
import {
  AtlasApiError,
  fetchEngineeringFairClaudeReport,
  getApiBase,
  planEngineeringRivalsBattery,
  prepareEngineeringFairClaudeBenchmark,
  runEngineeringBenchmarkSuite,
  type AtlasEngineeringFairClaudeCaseComparison,
  type AtlasEngineeringFairClaudeNextAction,
  type AtlasEngineeringRivalsBatteryPlanResponse,
  type AtlasEngineeringFairClaudeRunSummary,
  type AtlasEngineeringFairClaudeReportResponse,
} from '../lib/api/client'
import {
  buildRivalsBatteryInput,
  rivalsBatteryLaunchPlan,
  rivalsBatteryModeDetail,
  type RivalsBatteryMode,
} from '../lib/rivalsBatteryModels'

const SUITE = 'atlas-fair-claude-v1'
type BatteryMode = RivalsBatteryMode

const TARGETS = {
  protocol: 100,
  passWithoutHuman: 60,
  mediumHard: 50,
  repairConversion: 50,
  finalGates: 100,
}

export default function RivalsScreen() {
  const c = usePalette()
  const router = useRouter()
  const { showToast } = useShell()
  const [report, setReport] = useState<AtlasEngineeringFairClaudeReportResponse | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [runningBattery, setRunningBattery] = useState(false)
  const [batteryMode, setBatteryMode] = useState<BatteryMode>('official_fair')
  const [workspace, setWorkspace] = useState('/Users/vitorepf/develop/Atlas/atlas-server')
  const [baselineWorkspace, setBaselineWorkspace] = useState('/private/tmp/atlas-claude-baseline')
  const [provider, setProvider] = useState('claude_cli')
  const [model, setModel] = useState('opus')
  const [caseLimit, setCaseLimit] = useState('6')
  const [costAcknowledged, setCostAcknowledged] = useState(false)
  const [planReviewed, setPlanReviewed] = useState(false)
  const [batteryPlanPreview, setBatteryPlanPreview] = useState<AtlasEngineeringRivalsBatteryPlanResponse['battery_plan'] | null>(null)

  const loadReport = useCallback(async () => {
    setLoading(true)
    setReportError(null)
    try {
      let response: AtlasEngineeringFairClaudeReportResponse
      try {
        response = await fetchEngineeringFairClaudeReport(SUITE, { limit: 30 })
      } catch (firstError) {
        if (firstError instanceof AtlasApiError && firstError.status === 404) {
          await prepareEngineeringFairClaudeBenchmark({ suite: SUITE })
          response = await fetchEngineeringFairClaudeReport(SUITE, { limit: 30 })
        } else {
          throw firstError
        }
      }
      setReport(response)
      setReportError(null)
    } catch (caught) {
      setReport(null)
      const message = formatReportLoadError(caught)
      setReportError(message)
      showToast(message)
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  useEffect(() => {
    setCostAcknowledged(false)
    setPlanReviewed(false)
  }, [baselineWorkspace, batteryMode, caseLimit, model, provider, workspace])

  useEffect(() => {
    if (!report) return

    let cancelled = false
    const limit = Number.parseInt(caseLimit.trim(), 10)
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(30, limit)) : 6

    planEngineeringRivalsBattery(SUITE, {
      mode: batteryMode,
      workspace: workspace.trim() || null,
      baseline_workspace: baselineWorkspace.trim() || null,
      provider: provider.trim() || null,
      model: model.trim() || null,
      limit: safeLimit,
    })
      .then((response) => {
        if (!cancelled) setBatteryPlanPreview(response.battery_plan)
      })
      .catch(() => {
        if (!cancelled) setBatteryPlanPreview(null)
      })

    return () => {
      cancelled = true
    }
  }, [baselineWorkspace, batteryMode, caseLimit, model, provider, report, workspace])

  const runBattery = useCallback(async () => {
    if (runningBattery) return
    if (!planReviewed) {
      showToast('Revise o plano antes de rodar')
      return
    }
    if (!costAcknowledged) {
      showToast('Confirme custo/provider antes de rodar')
      return
    }

    const resolvedWorkspace = workspace.trim()
    if (!resolvedWorkspace) {
      showToast('Informe o workspace')
      return
    }

    const resolvedProvider = provider.trim()
    const resolvedModel = model.trim()
    const limit = Number.parseInt(caseLimit.trim(), 10)
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(30, limit)) : 6

    if (batteryMode === 'official_fair' && !baselineWorkspace.trim()) {
      showToast('Informe workspace separado para Claude Code baseline')
      return
    }
    if (batteryMode !== 'max' && (!resolvedProvider || !resolvedModel)) {
      showToast('Informe provider e modelo')
      return
    }

    const input = buildRivalsBatteryInput({
      baselineWorkspace: baselineWorkspace.trim(),
      caseLimit: String(safeLimit),
      mode: batteryMode,
      model: resolvedModel,
      provider: resolvedProvider,
      workspace: resolvedWorkspace,
    })
    const serverPlan = await planEngineeringRivalsBattery(SUITE, {
      mode: batteryMode,
      workspace: resolvedWorkspace,
      baseline_workspace: baselineWorkspace.trim() || null,
      provider: resolvedProvider || null,
      model: resolvedModel || null,
      limit: safeLimit,
    })
    if (!serverPlan.battery_plan.ready) {
      showToast(`Plano bloqueado: ${serverPlan.battery_plan.blockers.slice(0, 2).join(', ')}`)
      return
    }
    input.rivals_battery_mode = batteryMode
    input.rivals_battery_plan_hash = serverPlan.battery_plan.plan_hash
    input.operator_plan_reviewed = true
    input.operator_cost_acknowledged = true
    input.runner_options = {
      ...(input.runner_options ?? {}),
      rivals_battery_plan_hash: serverPlan.battery_plan.plan_hash,
      rivals_battery_mode: batteryMode,
    }

    setRunningBattery(true)
    try {
      const response = await runEngineeringBenchmarkSuite(SUITE, input)
      showToast(`Bateria ${response.benchmark_run.status}`)
      await loadReport()
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'Falha ao rodar bateria Rivals')
    } finally {
      setRunningBattery(false)
    }
  }, [
    baselineWorkspace,
    batteryMode,
    caseLimit,
    costAcknowledged,
    loadReport,
    model,
    planReviewed,
    provider,
    runningBattery,
    showToast,
    workspace,
  ])

  const readiness = report?.readiness
  const scorecard = report?.paired_scorecard
  const executive = report?.executive_summary
  const execution = report?.battery_execution_contract
  const evidence = report?.evidence_packet
  const exportBundle = report?.export_bundle
  const claimMarkdown = report?.claim_markdown ?? ''
  const runs = report?.runs ?? []
  const historySummary = useMemo(() => buildHistorySummary(report), [report])
  const ready = Boolean(readiness?.ready_for_claim)
  const winner = executive?.headline ?? winnerLabel(report)
  const insights = useMemo(() => buildInsights(report), [report])
  const nextActions = report?.next_actions ?? []
  const caseComparisons = report?.case_comparisons ?? []
  const comparableCount = readiness?.comparable_count ?? 0

  return (
    <Screen
      topExtra={22}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadReport() }} />}
    >
      <CodexReveal index={0}>
        {/* Masthead canon · RIVALS + dateline arena competitiva. */}
        <PressableTextScale onPress={() => router.replace('/edicao')} hitSlop={8} accessibilityLabel="voltar para edição">
          <Masthead title="RIVALS" folio={null} />
        </PressableTextScale>
        <EditorialDateline
          date={editorialDateLine()}
          edition={`arena competitiva · ${report?.generated_at ? dateLabel(report.generated_at) : 'sem report'}`}
        />
        {/* Gesture canon "bench." tap pra navegar a engineering */}
        <View style={{ alignItems: 'flex-end', marginTop: -16, marginBottom: 16, marginHorizontal: 32 }}>
          <SignatureGesture
            label="abrir bench."
            onPress={() => router.push('/engineering')}
            seal="commit"
            haptic="soft"
            accessibilityLabel="abrir engineering bench"
          />
        </View>
      </CodexReveal>

      <CodexReveal index={1}>
        {reportError ? (
          <RivalsConnectionAlert
            apiBase={getApiBase()}
            error={reportError}
            loading={loading}
            onRetry={() => { void loadReport() }}
          />
        ) : (
          <RivalsExecutiveBrief
            loading={loading}
            report={report}
            ready={ready}
            winner={winner}
          />
        )}
      </CodexReveal>

      <CodexReveal index={2}>
        <Section title="Relatórios dos Últimos Testes" count={runs.length}>
          <RivalsHistoryPanel summary={historySummary} runs={runs} />
        </Section>
      </CodexReveal>

      <CodexReveal index={3}>
        <Section title="Arena de Testes" count={batteryPlanPreview?.ready ? 1 : 0}>
          <RunBatteryPanel
            baselineWorkspace={baselineWorkspace}
            caseLimit={caseLimit}
            costAcknowledged={costAcknowledged}
            mode={batteryMode}
            model={model}
            planReviewed={planReviewed}
            provider={provider}
            running={runningBattery}
            workspace={workspace}
            onChangeBaselineWorkspace={setBaselineWorkspace}
            onChangeCaseLimit={setCaseLimit}
            onChangeCostAcknowledged={setCostAcknowledged}
            onChangeMode={setBatteryMode}
            onChangeModel={setModel}
            onChangePlanReviewed={setPlanReviewed}
            onChangeProvider={setProvider}
            onChangeWorkspace={setWorkspace}
            serverPlan={batteryPlanPreview}
            onRun={() => { void runBattery() }}
          />
        </Section>
      </CodexReveal>

      <CodexReveal index={4}>
        <Section title="O Que Importa Agora" count={insights.length}>
          <View style={styles.insightList}>
            {insights.map((insight) => (
              <InsightRow key={`${insight.severity}:${insight.title}`} insight={insight} />
            ))}
          </View>
        </Section>
      </CodexReveal>

      <CodexReveal index={5}>
        <Section title="Next Actions" count={nextActions.length}>
          {nextActions.length ? (
            <View style={styles.actionList}>
              {nextActions.map((action) => <NextActionRow key={action.id} action={action} />)}
            </View>
          ) : (
            <EmptyLine text="Nenhuma ação operacional pendente." />
          )}
        </Section>
      </CodexReveal>

      <Section title="Execução da Bateria" count={execution ? 1 : 0}>
        {execution ? (
          <BatteryExecutionCard contract={execution} />
        ) : (
          <EmptyLine text="Contrato de execução da bateria ainda não carregado." />
        )}
      </Section>

      <Section title="Pacote de Evidência" count={evidence ? 1 : 0}>
        {evidence ? (
          <EvidencePacketCard evidence={evidence} />
        ) : (
          <EmptyLine text="Nenhum pacote de evidência disponível ainda." />
        )}
      </Section>

      <Section title="Export Auditável" count={claimMarkdown ? 1 : 0}>
        {claimMarkdown ? (
          <MarkdownExportPreview markdown={claimMarkdown} bundle={exportBundle} />
        ) : (
          <EmptyLine text="Nenhum export Markdown disponível ainda." />
        )}
      </Section>

      <Section title="Scorecard Comparativo" count={scorecard?.case_count ?? 0}>
        {comparableCount > 0 ? (
          <>
            <View style={styles.targetList}>
              <TargetMetric label="Protocol validity" value={scorecard?.protocol_validity_rate} target={TARGETS.protocol} required />
              <TargetMetric label="Pass without human" value={scorecard?.pass_without_human_rate} target={TARGETS.passWithoutHuman} />
              <TargetMetric label="Medium/hard autonomy" value={scorecard?.pass_without_human_rate_medium_hard} target={TARGETS.mediumHard} />
              <TargetMetric label="Repair conversion" value={scorecard?.repair_conversion_rate} target={TARGETS.repairConversion} />
              <TargetMetric label="Final gates" value={scorecard?.final_gate_pass_rate} target={TARGETS.finalGates} required />
            </View>
            <View style={styles.metricGrid}>
              <Metric label="Lift" value={numberText(scorecard?.autonomous_success_lift)} tone={scorecard?.autonomous_success_lift ? 'passed' : 'pending'} />
              <Metric label="Intervention" value={numberText(scorecard?.intervention_reduction)} tone={scorecard?.intervention_reduction ? 'passed' : 'pending'} />
              <Metric label="Time green" value={timeToGreenText(scorecard?.time_to_green)} />
              <Metric label="Cost green" value={costPerGreenText(scorecard?.cost_per_green_case)} />
            </View>
          </>
        ) : (
          <NoComparableScorecard />
        )}
      </Section>

      <Section title="Fairness e Auditoria" count={report?.scope.fair_result_count ?? 0}>
        {runs.length ? (
          <View style={styles.integrityList}>
            <IntegrityRow label="Provider lock" value="claude_cli / claude_code_cli" status={scorecard?.provider_violation_count ? 'failed' : 'passed'} />
            <IntegrityRow label="Model lock" value="opus" status={scorecard?.invalid_case_count ? 'warning' : 'passed'} />
            <IntegrityRow label="Fallback disabled" value={`${scorecard?.fallback_violation_count ?? 0} violation`} status={scorecard?.fallback_violation_count ? 'failed' : 'passed'} />
            <IntegrityRow
              label="Replay manifest"
              value={`${report?.replay_manifest.packet_count ?? 0} packets`}
              status={report?.replay_manifest.enabled && (report?.replay_manifest.packet_count ?? 0) > 0 && (report?.replay_manifest.artifact_integrity_failed_count ?? 0) === 0 ? 'passed' : 'missing'}
            />
            <IntegrityRow label="Baseline executed" value={`${report?.claude_code_baseline.case_count ?? 0} cases`} status={report?.claude_code_baseline.enabled ? 'passed' : 'missing'} />
          </View>
        ) : (
          <EmptyLine text="A auditoria de fairness aparece depois da primeira execução registrada. Antes disso, mostrar OK aqui seria enganoso." />
        )}
      </Section>

      <Section title="Bloqueios de Claim" count={readiness?.blocking_reasons.length ?? 0}>
        {readiness?.blocking_reasons.length ? (
          <View style={styles.reasonList}>
            {readiness.blocking_reasons.map((reason) => <BlockingReasonRow key={reason} reason={reason} />)}
          </View>
        ) : (
          <EmptyLine text="Nenhum bloqueio ativo." />
        )}
      </Section>

      <Section title="Confrontos por Case" count={caseComparisons.length}>
        {caseComparisons.length ? (
          <View style={styles.caseList}>
            {caseComparisons.map((comparison) => <CaseComparisonRow key={comparison.result_id} comparison={comparison} />)}
          </View>
        ) : (
          <EmptyLine text="Execute uma bateria Rivals para ver o comparativo caso a caso." />
        )}
      </Section>
    </Screen>
  )
}

type Insight = {
  severity: 'critical' | 'warning' | 'good' | 'info'
  title: string
  detail: string
}

type RivalsHistorySummary = {
  lastRunLabel: string
  lastRunStatus: string
  trendLabel: string
  trendDetail: string
  totalRuns: number
  comparableCases: number
  atlasWins: number
  baselineWins: number
  ties: number
  hasRealBenchmark: boolean
}

function formatReportLoadError(caught: unknown): string {
  if (caught instanceof AtlasApiError) {
    if (caught.status === 401) {
      return 'Atlas Rivals não carregou: token X-Atlas-Token inválido ou ausente'
    }

    return `Atlas Rivals não carregou: API ${caught.status} em ${caught.path} · ${caught.message}`
  }
  if (caught instanceof Error) {
    return `Atlas Rivals não carregou: ${caught.message}`
  }

  return 'Atlas Rivals não carregou: falha desconhecida na API'
}

function InsightRow({ insight }: { insight: Insight }) {
  const c = usePalette()
  const color = severityColor(insight.severity, c)

  return (
    <View style={[styles.insightRow, { borderColor: color, backgroundColor: c.bg }]}>
      <View style={[styles.severityRail, { backgroundColor: color }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.insightTop}>
          <Sans weight="sb" size={12.5} lineHeight={18} color={c.ink} numberOfLines={1}>
            {insight.title}
          </Sans>
          <StatusBadge status={insight.severity === 'good' ? 'passed' : insight.severity === 'critical' ? 'blocked' : insight.severity} compact />
        </View>
        <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
          {insight.detail}
        </Mono>
      </View>
    </View>
  )
}

function RivalsConnectionAlert({
  apiBase,
  error,
  loading,
  onRetry,
}: {
  apiBase: string
  error: string
  loading: boolean
  onRetry: () => void
}) {
  const c = usePalette()

  return (
    <View style={[styles.connectionAlert, { borderColor: c.recRed, backgroundColor: c.surface }]}>
      <View style={styles.executiveTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Falha de conexão</Label>
          <Sans weight="sb" size={19} lineHeight={25} color={c.ink}>
            Relatório Rivals não foi carregado
          </Sans>
          <Sans size={12.2} lineHeight={17} color={c.ink2}>
            A tela não vai mais mostrar zeros como se fossem métricas reais. Primeiro resolva a conexão com a API e carregue o report auditável.
          </Sans>
        </View>
        <StatusBadge status="blocked" />
      </View>

      <View style={styles.connectionGrid}>
        <View style={[styles.connectionTile, { borderColor: c.border, backgroundColor: c.bg }]}>
          <Mono size={9.5} lineHeight={12} letterSpacing={0.8} color={c.ink3} style={styles.uppercase}>
            Endpoint usado
          </Mono>
          <Mono size={10.2} lineHeight={14} letterSpacing={0.05} color={c.prussian} numberOfLines={2}>
            {apiBase}/engineering/benchmarks/suites/{SUITE}/fair-claude-report
          </Mono>
        </View>
        <View style={[styles.connectionTile, { borderColor: c.recRed, backgroundColor: c.bg }]}>
          <Mono size={9.5} lineHeight={12} letterSpacing={0.8} color={c.ink3} style={styles.uppercase}>
            Erro real
          </Mono>
          <Sans size={11.5} lineHeight={16} color={c.recRed}>
            {error}
          </Sans>
        </View>
      </View>

      <Pressable
        disabled={loading}
        onPress={onRetry}
        style={({ pressed }) => [
          styles.retryButton,
          {
            borderColor: c.recRed,
            backgroundColor: pressed ? c.premium : c.bg,
            opacity: loading ? 0.6 : 1,
          },
        ]}
      >
        <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.recRed}>
          {loading ? 'tentando...' : 'tentar novamente'}
        </Mono>
      </Pressable>
    </View>
  )
}

function RivalsHistoryPanel({
  runs,
  summary,
}: {
  runs: AtlasEngineeringFairClaudeRunSummary[]
  summary: RivalsHistorySummary
}) {
  const c = usePalette()

  if (!runs.length) {
    return (
      <View style={[styles.historyOverview, { borderColor: c.bronze, backgroundColor: c.bg }]}>
        <View style={styles.evidenceHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label>Sem histórico ainda</Label>
            <Sans weight="sb" size={14} lineHeight={19} color={c.ink}>
              Nenhuma bateria Rivals foi registrada
            </Sans>
            <Sans size={11.5} lineHeight={16} color={c.ink2}>
              Primeiro rode uma bateria justa, mesmo modelo ou máximo. Depois esta área vira a linha do tempo para ver se o Atlas está melhorando ou piorando.
            </Sans>
          </View>
          <StatusBadge status="pending" compact />
        </View>
        <View style={styles.metricGrid}>
          <Metric label="Último teste" value="nenhum" tone="pending" />
          <Metric label="Comparáveis" value="-" tone="pending" />
          <Metric label="Atlas" value="-" tone="pending" />
          <Metric label="Rival" value="-" tone="pending" />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.historyPanelStack}>
      <View style={[styles.historyOverview, { borderColor: summary.hasRealBenchmark ? c.moss : c.bronze, backgroundColor: c.bg }]}>
        <View style={styles.evidenceHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label>Resumo do histórico</Label>
            <Sans weight="sb" size={14} lineHeight={19} color={c.ink}>
              {summary.trendLabel}
            </Sans>
            <Sans size={11.5} lineHeight={16} color={c.ink2}>
              {summary.trendDetail}
            </Sans>
          </View>
          <StatusBadge status={summary.hasRealBenchmark ? 'ready' : 'needs_review'} compact />
        </View>
        <View style={styles.metricGrid}>
          <Metric label="Último teste" value={summary.lastRunLabel} tone={summary.lastRunStatus} />
          <Metric label="Comparáveis" value={String(summary.comparableCases)} tone={summary.comparableCases > 0 ? 'passed' : 'pending'} />
          <Metric label="Atlas" value={String(summary.atlasWins)} tone={summary.atlasWins > 0 ? 'passed' : 'pending'} />
          <Metric label="Rival" value={String(summary.baselineWins)} tone={summary.baselineWins > 0 ? 'warning' : 'pending'} />
        </View>
      </View>

      <View style={styles.historyList}>
        {runs.slice(0, 8).map((run) => <RunHistoryRow key={run.id} run={run} />)}
      </View>
    </View>
  )
}

function NoComparableScorecard() {
  const c = usePalette()

  return (
    <View style={[styles.noScorecardBox, { borderColor: c.bronze, backgroundColor: c.bg }]}>
      <View style={styles.evidenceHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Sem score real ainda</Label>
          <Sans weight="sb" size={13.5} lineHeight={19} color={c.ink}>
            Não existe amostra comparável suficiente
          </Sans>
          <Sans size={11.5} lineHeight={16} color={c.ink2}>
            Os campos de scorecard ficam ocultos porque 0% aqui não significa desempenho ruim; significa que a bateria Atlas vs rival ainda não gerou pares comparáveis.
          </Sans>
        </View>
        <StatusBadge status="pending" compact />
      </View>
      <View style={styles.integrityList}>
        <IntegrityRow label="O que falta" value="rodar bateria Rivals" status="warning" />
        <IntegrityRow label="Depois disso" value="comparar vitórias, gates, custo e replay" status="pending" />
      </View>
    </View>
  )
}

function RivalsExecutiveBrief({
  loading,
  ready,
  report,
  winner,
}: {
  loading: boolean
  ready: boolean
  report: AtlasEngineeringFairClaudeReportResponse | null
  winner: string
}) {
  const c = usePalette()
  const readiness = report?.readiness
  const executive = report?.executive_summary
  const scorecard = report?.paired_scorecard
  const sample = readiness?.comparable_count ?? 0
  const status = readiness?.status ?? (loading ? 'running' : 'missing')
  const claimTone = ready ? 'passed' : sample > 0 ? 'warning' : 'blocked'
  const decision = ready
    ? 'Pode sustentar claim com evidência.'
    : sample > 0
      ? 'Existe benchmark real, mas ainda não sustenta claim.'
      : 'Ainda falta bateria comparável real.'
  const why = sample > 0
    ? `${readiness?.atlas_win_count ?? 0} vitória(s) Atlas, ${readiness?.claude_code_baseline_win_count ?? 0} vitória(s) Claude, ${readiness?.tie_count ?? 0} empate(s).`
    : 'Sem casos comparáveis, qualquer score seria sintético.'
  const next = report?.next_actions?.[0]?.title ?? (ready ? 'Exportar evidência e registrar revisão.' : 'Rodar bateria justa ou corrigir gates antes de ampliar a amostra.')

  return (
    <View style={[styles.executivePanel, { borderColor: statusColor(claimTone, c), backgroundColor: c.surface }]}>
      <View style={styles.executiveTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Decisão executiva</Label>
          <Sans weight="sb" size={20} lineHeight={26} color={c.ink}>
            {winner}
          </Sans>
          <Sans size={12.5} lineHeight={18} color={c.ink2}>
            {decision}
          </Sans>
        </View>
        <StatusBadge status={status} />
      </View>

      <View style={styles.executiveBriefGrid}>
        <ExecutiveBriefTile label="Leitura em 5s" value={statusLabel(status)} detail={why} tone={claimTone} />
        <ExecutiveBriefTile label="Confiança" value={executive?.confidence ?? 'sem amostra'} detail={`${sample} caso(s) comparáveis`} tone={sample > 0 ? 'warning' : 'blocked'} />
        <ExecutiveBriefTile label="Integridade" value={report?.replay_manifest?.artifact_integrity_failed_count ? 'falhou' : 'auditável'} detail={`${report?.replay_manifest?.packet_count ?? 0} replay packet(s)`} tone={report?.replay_manifest?.artifact_integrity_failed_count ? 'blocked' : 'passed'} />
        <ExecutiveBriefTile label="Próxima ação" value={next} detail={report?.next_actions?.[0]?.detail ?? 'Sem ação operacional pendente.'} tone={claimTone} wide />
      </View>

      <View style={styles.metricGrid}>
        <Metric label="Atlas" value={String(readiness?.atlas_win_count ?? 0)} tone={(readiness?.atlas_win_count ?? 0) > 0 ? 'passed' : 'pending'} />
        <Metric label="Claude" value={String(readiness?.claude_code_baseline_win_count ?? 0)} tone={(readiness?.claude_code_baseline_win_count ?? 0) > 0 ? 'warning' : 'pending'} />
        <Metric label="Protocolo" value={percentValue(scorecard?.protocol_validity_rate)} tone={(scorecard?.protocol_validity_rate ?? 0) >= 100 ? 'passed' : 'blocked'} />
        <Metric label="Claim" value={ready ? 'pronto' : 'bloqueado'} tone={claimTone} />
      </View>
    </View>
  )
}

function ExecutiveBriefTile({
  detail,
  label,
  tone,
  value,
  wide = false,
}: {
  detail: string
  label: string
  tone: string
  value: string
  wide?: boolean
}) {
  const c = usePalette()

  return (
    <View style={[styles.executiveBriefTile, wide && styles.executiveBriefTileWide, { borderColor: statusColor(tone, c), backgroundColor: c.bg }]}>
      <Mono size={9.5} lineHeight={12} letterSpacing={0.8} color={c.ink3} style={styles.uppercase}>
        {label}
      </Mono>
      <Sans weight="sb" size={13.2} lineHeight={18} color={statusColor(tone, c)} numberOfLines={2}>
        {value}
      </Sans>
      <Sans size={11.3} lineHeight={16} color={c.ink2} numberOfLines={3}>
        {detail}
      </Sans>
    </View>
  )
}

function NextActionRow({ action }: { action: AtlasEngineeringFairClaudeNextAction }) {
  const c = usePalette()
  const severity = normalizeActionSeverity(action.severity)
  const color = severityColor(severity, c)

  return (
    <View style={[styles.actionRow, { borderColor: color, backgroundColor: c.bg }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.insightTop}>
          <Sans weight="sb" size={12.5} lineHeight={18} color={c.ink} numberOfLines={1}>
            {action.title}
          </Sans>
          <StatusBadge status={severity === 'critical' ? 'blocked' : severity} compact />
        </View>
        <Sans size={11.2} lineHeight={16} color={c.ink2}>
          {action.detail}
        </Sans>
        {action.command ? (
          <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.prussian} numberOfLines={1}>
            {action.command}
          </Mono>
        ) : null}
      </View>
      {action.owner ? (
        <Mono size={9.5} lineHeight={12} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
          {action.owner}
        </Mono>
      ) : null}
    </View>
  )
}

function BatteryExecutionCard({
  contract,
}: {
  contract: NonNullable<AtlasEngineeringFairClaudeReportResponse['battery_execution_contract']>
}) {
  const c = usePalette()
  const state = contract.current_state
  const commands = contract.commands ?? {}
  const presets = contract.recommended_presets ?? []
  const ready = Boolean(state.ready_for_claim)
  const corpusReady = Boolean(state.corpus_prepared)

  return (
    <View style={[styles.evidenceBox, { borderColor: ready ? c.moss : corpusReady ? c.bronze : c.recRed, backgroundColor: c.bg }]}>
      <View style={styles.evidenceHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Sans weight="sb" size={12.5} lineHeight={18} color={c.ink}>
            {contract.status === 'operator_execution_required' ? 'Corpus pronto · bateria real pendente' : contract.status}
          </Sans>
          <Sans size={11.2} lineHeight={16} color={c.ink2}>
            {contract.summary}
          </Sans>
        </View>
        <StatusBadge status={ready ? 'ready' : corpusReady ? 'warning' : 'blocked'} compact />
      </View>

      <View style={styles.evidenceGrid}>
        <Metric label="Corpus" value={`${state.release_corpus_case_count}/${state.minimum_release_corpus_case_count}`} tone={corpusReady ? 'passed' : 'blocked'} />
        <Metric label="Comparáveis" value={String(state.comparable_case_count)} tone={state.comparable_case_count ? 'passed' : 'pending'} />
        <Metric label="Baseline" value={state.baseline_executed ? 'feito' : 'pendente'} tone={state.baseline_executed ? 'passed' : 'missing'} />
        <Metric label="Replay" value={state.replay_verified ? 'verificado' : 'pendente'} tone={state.replay_verified ? 'passed' : 'missing'} />
      </View>

      <View style={styles.integrityList}>
        <IntegrityRow label="Operador" value={contract.operator_required ? 'obrigatório' : 'não exigido'} status={contract.operator_required ? 'warning' : 'passed'} />
        <IntegrityRow label="Provider/custo" value={contract.external_cost_possible ? 'pode gerar custo' : 'sem custo externo'} status={contract.external_cost_possible ? 'warning' : 'passed'} />
        <IntegrityRow label="Auto execução" value={contract.agent_auto_execution_allowed ? 'permitida' : 'bloqueada'} status={contract.agent_auto_execution_allowed ? 'warning' : 'passed'} />
      </View>

      <View style={styles.commandList}>
        <CommandLine label="Runbook" value={commands.runbook} />
        <CommandLine label="Quick" value={commands.quick_battery} />
        <CommandLine label="Medium" value={commands.medium_battery} />
        <CommandLine label="Full" value={commands.full_battery} />
      </View>

      {presets.length ? (
        <View style={styles.presetList}>
          {presets.slice(0, 3).map((preset) => (
            <View key={preset.id} style={[styles.presetRow, { borderColor: c.border }]}>
              <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.prussian}>
                {preset.id} · {preset.case_count ?? 'full'} cases · {preset.estimated_time}
              </Mono>
              <Sans size={10.5} lineHeight={15} color={c.ink2}>
                {preset.purpose}
              </Sans>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function CommandLine({ label, value }: { label: string; value: string | undefined }) {
  const c = usePalette()
  if (!value) return null

  return (
    <View style={[styles.commandRow, { borderColor: c.border }]}>
      <Mono size={9.5} lineHeight={12} letterSpacing={0.1} color={c.ink2}>
        {label}
      </Mono>
      <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.prussian} numberOfLines={2}>
        {value}
      </Mono>
    </View>
  )
}

function RunBatteryPanel({
  baselineWorkspace,
  caseLimit,
  costAcknowledged,
  mode,
  model,
  planReviewed,
  provider,
  running,
  workspace,
  onChangeBaselineWorkspace,
  onChangeCaseLimit,
  onChangeCostAcknowledged,
  onChangeMode,
  onChangeModel,
  onChangePlanReviewed,
  onChangeProvider,
  onChangeWorkspace,
  onRun,
  serverPlan,
}: {
  baselineWorkspace: string
  caseLimit: string
  costAcknowledged: boolean
  mode: BatteryMode
  model: string
  planReviewed: boolean
  provider: string
  running: boolean
  workspace: string
  onChangeBaselineWorkspace: (value: string) => void
  onChangeCaseLimit: (value: string) => void
  onChangeCostAcknowledged: (value: boolean) => void
  onChangeMode: (value: BatteryMode) => void
  onChangeModel: (value: string) => void
  onChangePlanReviewed: (value: boolean) => void
  onChangeProvider: (value: string) => void
  onChangeWorkspace: (value: string) => void
  onRun: () => void
  serverPlan: AtlasEngineeringRivalsBatteryPlanResponse['battery_plan'] | null
}) {
  const c = usePalette()
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const modeDetail = rivalsBatteryModeDetail(mode)
  const plan = rivalsBatteryLaunchPlan({
    baselineWorkspace,
    caseLimit,
    mode,
    model,
    provider,
    workspace,
  })
  const disabled = running || !costAcknowledged || !planReviewed || !plan.ready
  const modeCatalog = serverPlan?.selection_contract?.allowed_modes ?? []
  const providerOptions = serverPlan?.selection_contract?.provider_model_options ?? []
  const disabledReason = !plan.ready
    ? 'corrija os bloqueios do plano'
    : !planReviewed
      ? 'confirme o plano'
      : !costAcknowledged
        ? 'confirme custo/provider'
        : null
  const resolvedProviderOptions = providerOptions.length ? providerOptions : defaultProviderModelOptions()
  const selectMode = (nextMode: BatteryMode) => {
    onChangeMode(nextMode)
    if (nextMode === 'official_fair') {
      onChangeProvider('claude_cli')
      onChangeModel('opus')
    }
  }

  return (
    <View style={[styles.runBatteryBox, { borderColor: costAcknowledged ? c.bronze : c.recRed, backgroundColor: c.bg }]}>
      <View style={styles.batteryHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Centro de controle</Label>
          <Sans weight="sb" size={15} lineHeight={20} color={c.ink}>
            Escolha modo, provider/modelo e rode a bateria
          </Sans>
        </View>
        <StatusBadge status={plan.ready ? 'ready' : 'blocked'} compact />
      </View>

      <View style={styles.modeGrid}>
        <ModeButton active={mode === 'official_fair'} label="Justa" detail="Atlas Opus vs Claude Opus" onPress={() => selectMode('official_fair')} />
        <ModeButton active={mode === 'same_model'} label="Mesmo modelo" detail="Provider/modelo fixos" onPress={() => selectMode('same_model')} />
        <ModeButton active={mode === 'max'} label="Máximo" detail="Atlas no modo mais forte" onPress={() => selectMode('max')} />
      </View>

      <Sans size={11.2} lineHeight={16} color={c.ink2}>
        {modeDetail}
      </Sans>

      {modeCatalog.length || resolvedProviderOptions.length ? (
        <View style={[styles.launchPlanBox, { borderColor: c.border, backgroundColor: c.surface }]}>
          {modeCatalog.length ? (
            <View style={styles.modeCatalogGrid}>
              {modeCatalog.map((item) => (
                <View key={item.id} style={[styles.modeCatalogItem, { borderColor: item.id === mode ? c.bronze : c.border }]}>
                  <Mono size={10} lineHeight={13} letterSpacing={0.08} color={item.id === mode ? c.bronze : c.ink2}>
                    {item.label || item.id}
                  </Mono>
                  <Sans size={10.5} lineHeight={14} color={c.ink2}>
                    {item.recommended_provider || 'policy'} / {item.recommended_model || 'best-quality'}
                  </Sans>
                </View>
              ))}
            </View>
          ) : null}
          {mode === 'official_fair' ? (
            <LockedProviderCard provider="claude_cli" model="opus" baseline="Claude Code CLI / opus" />
          ) : null}
          {mode !== 'official_fair' ? (
            <ProviderModelSelector
              currentModel={model}
              currentProvider={provider}
              options={resolvedProviderOptions}
              onSelect={(nextProvider, nextModel) => {
                onChangeProvider(nextProvider)
                onChangeModel(nextModel)
              }}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.casePresetRow}>
        {['1', '6', '12', '30'].map((value) => (
          <CaseLimitButton key={value} active={caseLimit === value} value={value} onPress={() => onChangeCaseLimit(value)} />
        ))}
      </View>

      <View style={[styles.launchPlanBox, { borderColor: plan.ready ? c.bronze : c.recRed, backgroundColor: c.surface }]}>
        <View style={styles.evidenceHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label>Plano de execução</Label>
            <Sans weight="sb" size={12.5} lineHeight={18} color={c.ink}>
              {plan.title}
            </Sans>
            <Sans size={11.2} lineHeight={16} color={c.ink2}>
              {plan.summary}
            </Sans>
          </View>
          <StatusBadge status={plan.ready ? 'warning' : 'blocked'} compact />
        </View>
        <View style={styles.evidenceGrid}>
          <Metric label="Baseline" value={plan.baseline} tone={plan.baseline === 'pareado' ? 'passed' : 'warning'} />
          <Metric label="Provider" value={plan.provider} tone="neutral" />
          <Metric label="Modelo" value={plan.model} tone="neutral" />
          <Metric label="Casos" value={plan.cases} tone="neutral" />
        </View>
        {plan.blockers.length ? (
          <View style={styles.blockerList}>
            {plan.blockers.map((blocker) => (
              <Mono key={blocker} size={10} lineHeight={14} letterSpacing={0.05} color={c.recRed}>
                {blocker}
              </Mono>
            ))}
          </View>
        ) : null}
      </View>

      <Pressable
        onPress={() => setAdvancedOpen(!advancedOpen)}
        style={({ pressed }) => [
          styles.advancedToggle,
          { borderColor: c.border, backgroundColor: pressed ? c.premium : c.surface },
        ]}
      >
        <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.prussian}>
          {advancedOpen ? 'ocultar paths avançados' : 'paths avançados'}
        </Mono>
        <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
          {advancedOpen ? '-' : '+'}
        </Mono>
      </Pressable>

      {advancedOpen ? (
        <View style={styles.formGrid}>
          <TextField label="Workspace Atlas" value={workspace} onChangeText={onChangeWorkspace} />
          {mode === 'official_fair' ? (
            <TextField label="Workspace baseline separado" value={baselineWorkspace} onChangeText={onChangeBaselineWorkspace} />
          ) : null}
        </View>
      ) : null}

      <Pressable
        onPress={() => onChangeCostAcknowledged(!costAcknowledged)}
        style={({ pressed }) => [
          styles.costAcknowledge,
          { borderColor: costAcknowledged ? c.moss : c.recRed, backgroundColor: pressed ? c.premium : c.surface },
        ]}
      >
        <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={costAcknowledged ? c.moss : c.recRed}>
          {costAcknowledged ? 'OK custo/provider confirmado' : 'confirmar custo/provider externo'}
        </Mono>
      </Pressable>

      <Pressable
        disabled={!plan.ready}
        onPress={() => onChangePlanReviewed(!planReviewed)}
        style={({ pressed }) => [
          styles.costAcknowledge,
          {
            borderColor: planReviewed ? c.moss : c.bronze,
            backgroundColor: pressed && plan.ready ? c.premium : c.surface,
            opacity: plan.ready ? 1 : 0.55,
          },
        ]}
      >
        <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={planReviewed ? c.moss : c.bronze}>
          {planReviewed ? 'OK plano revisado' : 'confirmar plano de execução'}
        </Mono>
      </Pressable>

      <Pressable
        disabled={disabled}
        onPress={onRun}
        style={({ pressed }) => [
          styles.runBatteryButton,
          { backgroundColor: disabled ? c.border : pressed ? c.bronze : c.prussian, opacity: disabled ? 0.6 : 1 },
        ]}
      >
        <Sans weight="sb" size={13} lineHeight={18} color={c.bg}>
          {running ? 'Rodando bateria...' : disabledReason ? `Rodar bateria Rivals · ${disabledReason}` : 'Rodar bateria Rivals'}
        </Sans>
      </Pressable>
    </View>
  )
}

function ProviderModelSelector({
  currentModel,
  currentProvider,
  onSelect,
  options,
}: {
  currentModel: string
  currentProvider: string
  onSelect: (provider: string, model: string) => void
  options: NonNullable<NonNullable<AtlasEngineeringRivalsBatteryPlanResponse['battery_plan']['selection_contract']>['provider_model_options']>
}) {
  const c = usePalette()

  return (
    <View style={styles.providerSelector}>
      <Label>Provider e modelo</Label>
      {options.map((option) => (
        <View key={option.provider} style={styles.providerGroup}>
          <View style={styles.providerGroupHead}>
            <Sans weight="sb" size={11.5} lineHeight={15} color={option.provider === currentProvider ? c.prussian : c.ink}>
              {option.label || option.provider}
            </Sans>
            <Mono size={9.5} lineHeight={12} letterSpacing={0.05} color={c.ink2}>
              {option.allow_auto ? 'auto' : 'manual'}
            </Mono>
          </View>
          <View style={styles.modelChipRow}>
            {(option.models ?? []).map((item) => {
              const active = option.provider === currentProvider && item.model === currentModel

              return (
                <Pressable
                  key={`${option.provider}:${item.model}`}
                  onPress={() => onSelect(option.provider, item.model)}
                  style={({ pressed }) => [
                    styles.modelChip,
                    {
                      borderColor: active ? c.moss : c.border,
                      backgroundColor: active ? c.premium : pressed ? c.premium : c.bg,
                    },
                  ]}
                >
                  <Mono size={9.8} lineHeight={13} letterSpacing={0.05} color={active ? c.moss : c.ink2} numberOfLines={1}>
                    {item.label || item.model}
                  </Mono>
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
    </View>
  )
}

function LockedProviderCard({ baseline, model, provider }: { baseline: string; model: string; provider: string }) {
  const c = usePalette()

  return (
    <View style={[styles.lockedProviderCard, { borderColor: c.moss, backgroundColor: c.bg }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Label>Provider travado</Label>
        <Sans weight="sb" size={12.5} lineHeight={18} color={c.ink}>
          {provider} / {model}
        </Sans>
        <Mono size={10.2} lineHeight={14} letterSpacing={0.05} color={c.ink2} numberOfLines={1}>
          Baseline: {baseline}
        </Mono>
      </View>
      <StatusBadge status="passed" compact />
    </View>
  )
}

function CaseLimitButton({ active, onPress, value }: { active: boolean; onPress: () => void; value: string }) {
  const c = usePalette()
  const label = value === '1' ? '1 caso' : `${value} casos`
  const detail = value === '1' ? 'prova rapida' : value === '6' ? 'release minimo' : value === '12' ? 'amostra forte' : 'bateria cheia'

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.caseLimitButton,
        {
          borderColor: active ? c.prussian : c.border,
          backgroundColor: active ? c.premium : pressed ? c.premium : c.surface,
        },
      ]}
    >
      <Sans weight="sb" size={11.2} lineHeight={15} color={active ? c.prussian : c.ink} numberOfLines={1}>
        {label}
      </Sans>
      <Mono size={9} lineHeight={12} letterSpacing={0.05} color={c.ink2} numberOfLines={1}>
        {detail}
      </Mono>
    </Pressable>
  )
}

function defaultProviderModelOptions(): NonNullable<NonNullable<AtlasEngineeringRivalsBatteryPlanResponse['battery_plan']['selection_contract']>['provider_model_options']> {
  return [
    {
      provider: 'claude_cli',
      label: 'Claude',
      allow_auto: false,
      allow_manual: true,
      models: [
        { model: 'opus', label: 'Opus', role: 'rival', tier: 'frontier' },
        { model: 'sonnet', label: 'Sonnet', role: 'fast', tier: 'frontier' },
      ],
    },
    {
      provider: 'codex_cli',
      label: 'Codex',
      allow_auto: false,
      allow_manual: true,
      models: [
        { model: 'gpt-5.5', label: 'GPT-5.5', role: 'rival', tier: 'frontier' },
        { model: 'gpt-5.3-codex-spark', label: 'Codex Spark', role: 'fast', tier: 'coding' },
      ],
    },
    {
      provider: 'gemini_cli',
      label: 'Gemini',
      allow_auto: false,
      allow_manual: true,
      models: [
        { model: 'gemini-3.1-pro-preview', label: '3.1 Pro', role: 'rival', tier: 'frontier' },
      ],
    },
  ]
}

function ModeButton({
  active,
  detail,
  label,
  onPress,
}: {
  active: boolean
  detail: string
  label: string
  onPress: () => void
}) {
  const c = usePalette()

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeButton,
        { borderColor: active ? c.prussian : c.border, backgroundColor: active ? c.premium : pressed ? c.premium : c.surface },
      ]}
    >
      <Sans weight="sb" size={11.5} lineHeight={15} color={c.ink} numberOfLines={1}>
        {label}
      </Sans>
      <Mono size={9.2} lineHeight={12} letterSpacing={0.05} color={c.ink2} numberOfLines={1}>
        {detail}
      </Mono>
    </Pressable>
  )
}

function TextField({
  keyboardType,
  label,
  onChangeText,
  value,
}: {
  keyboardType?: 'default' | 'number-pad'
  label: string
  onChangeText: (value: string) => void
  value: string
}) {
  const c = usePalette()

  return (
    <View style={styles.textFieldWrap}>
      <Label>{label}</Label>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.textField, { borderColor: c.border, color: c.ink, backgroundColor: c.surface }]}
        placeholderTextColor={c.ink3}
      />
    </View>
  )
}

function EvidencePacketCard({ evidence }: { evidence: NonNullable<AtlasEngineeringFairClaudeReportResponse['evidence_packet']> }) {
  const c = usePalette()
  const claim = objectValue(evidence.claim)
  const protocol = objectValue(evidence.protocol)
  const audit = objectValue(evidence.audit)
  const ready = Boolean(claim.ready_for_claim)
  const hash = evidence.evidence_hash || '-'

  return (
    <View style={[styles.evidenceBox, { borderColor: ready ? c.moss : c.bronze, backgroundColor: c.bg }]}>
      <View style={styles.evidenceHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Sans weight="sb" size={12.5} lineHeight={18} color={c.ink}>
            {textValue(claim.readiness_status, 'not_ready')} · {textValue(claim.winner, 'sem vencedor')}
          </Sans>
          <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
            hash {hash.slice(0, 16)} · {numberValue(audit.case_comparison_count) ?? 0} cases · {numberValue(audit.replay_packet_count) ?? 0} packets
          </Mono>
        </View>
        <StatusBadge status={ready ? 'ready' : 'blocked'} compact />
      </View>
      <View style={styles.evidenceGrid}>
        <Metric label="Atlas lock" value={textValue(protocol.atlas_provider_lock, '-')} tone="passed" />
        <Metric label="Model lock" value={textValue(protocol.atlas_model_lock, '-')} tone="passed" />
        <Metric label="Baseline" value={numberValue(audit.baseline_executed_count) ? 'executed' : 'missing'} tone={numberValue(audit.baseline_executed_count) ? 'passed' : 'missing'} />
        <Metric
          label="Replay"
          value={replayEvidenceVerified(audit) ? 'verified' : 'missing'}
          tone={replayEvidenceVerified(audit) ? 'passed' : 'missing'}
        />
      </View>
      <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
        {hash}
      </Mono>
    </View>
  )
}

function MarkdownExportPreview({
  markdown,
  bundle,
}: {
  markdown: string
  bundle: AtlasEngineeringFairClaudeReportResponse['export_bundle']
}) {
  const c = usePalette()
  const lines = markdown
    .split('\n')
    .filter((line) => line.trim() !== '')
    .slice(0, 12)
  const files = Object.entries(bundle?.files ?? {})

  return (
    <View style={[styles.markdownBox, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={styles.evidenceHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Sans weight="sb" size={12.5} lineHeight={18} color={c.ink}>
            Audit-ready Export Bundle
          </Sans>
          <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
            {files.length || 1} files · bundle {bundle?.bundle_hash ? bundle.bundle_hash.slice(0, 12) : '-'} · {markdown.length} chars
          </Mono>
        </View>
        <StatusBadge status="ready" compact />
      </View>
      {bundle?.verification_command ? (
        <View style={[styles.verifyCommandBox, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Label>Verify</Label>
          <Mono size={10.2} lineHeight={14} letterSpacing={0.05} color={c.prussian} numberOfLines={2}>
            {bundle.verification_command}
          </Mono>
        </View>
      ) : null}
      {files.length ? (
        <View style={styles.bundleFileList}>
          {files.map(([filename, file]) => (
            <View key={filename} style={styles.bundleFileRow}>
              <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink}>
                {filename}
              </Mono>
              <Mono size={9.5} lineHeight={12} letterSpacing={0.05} color={c.ink2} numberOfLines={1}>
                {file.bytes}b · {file.sha256.slice(0, 16)}
              </Mono>
            </View>
          ))}
        </View>
      ) : null}
      <View style={[styles.markdownPreview, { borderColor: c.border }]}>
        {lines.map((line, index) => (
          <Mono key={`${index}:${line}`} size={9.8} lineHeight={13} letterSpacing={0.05} color={c.ink2} numberOfLines={1}>
            {line}
          </Mono>
        ))}
      </View>
    </View>
  )
}

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  const c = usePalette()

  return (
    <View style={[styles.section, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.sectionHead}>
        <Label>{title}</Label>
        {typeof count === 'number' ? (
          <Mono size={10.5} lineHeight={14} color={c.ink2}>
            {count}
          </Mono>
        ) : null}
      </View>
      {children}
    </View>
  )
}

function TargetMetric({
  label,
  value,
  target,
  required = false,
}: {
  label: string
  value: number | null | undefined
  target: number
  required?: boolean
}) {
  const c = usePalette()
  const missing = typeof value !== 'number' || !Number.isFinite(value)
  const passed = !missing && value >= target
  const status = missing ? 'missing' : passed ? 'passed' : required ? 'blocked' : 'warning'

  return (
    <View style={[styles.targetRow, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={12.5} lineHeight={18} color={c.ink}>
          {label}
        </Sans>
        <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink2}>
          alvo {target}%{required ? ' · obrigatório' : ''}
        </Mono>
      </View>
      <View style={styles.targetValue}>
        <Mono size={14} lineHeight={18} letterSpacing={0.1} color={statusColor(status, c)}>
          {percentValue(value)}
        </Mono>
        <StatusBadge status={status} compact />
      </View>
    </View>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string | null }) {
  const c = usePalette()

  return (
    <View style={[styles.metric, { borderColor: c.border, backgroundColor: c.bg }]}>
      <Label>{label}</Label>
      <Mono size={15} lineHeight={20} letterSpacing={0.1} color={statusColor(tone ?? value, c)} numberOfLines={1}>
        {value}
      </Mono>
    </View>
  )
}

function BlockingReasonRow({ reason }: { reason: string }) {
  const c = usePalette()
  const severity = blockingSeverity(reason)
  const color = severityColor(severity, c)

  return (
    <View style={[styles.reasonRow, { borderColor: color, backgroundColor: c.bg }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={color}>
          {reason}
        </Mono>
        <Sans size={10.8} lineHeight={15} color={c.ink2}>
          {blockingReasonDetail(reason)}
        </Sans>
      </View>
      <StatusBadge status={severity === 'critical' ? 'blocked' : severity} compact />
    </View>
  )
}

function IntegrityRow({ label, value, status }: { label: string; value: string; status: string }) {
  const c = usePalette()

  return (
    <View style={[styles.integrityRow, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={12.5} lineHeight={18} color={c.ink}>
          {label}
        </Sans>
        <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
          {value}
        </Mono>
      </View>
      <StatusBadge status={status} compact />
    </View>
  )
}

function CaseComparisonRow({ comparison }: { comparison: AtlasEngineeringFairClaudeCaseComparison }) {
  const c = usePalette()
  const tone = comparison.comparable
    ? comparison.winner === 'atlas'
      ? 'passed'
      : comparison.winner === 'claude_code_baseline'
        ? 'warning'
        : 'pending'
    : 'blocked'

  return (
    <View style={[styles.caseRow, { borderColor: statusColor(tone, c), backgroundColor: c.bg }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={12.5} lineHeight={18} color={c.ink} numberOfLines={1}>
          {comparison.case_code ?? comparison.case_id}
        </Sans>
        <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
          {comparison.domain_slug ?? '-'} · {comparison.risk_profile ?? '-'} · {winnerText(comparison.winner)} · {comparison.winner_reason ?? comparison.comparison_status}
        </Mono>
        <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
          Atlas {caseArmText(comparison.atlas)} · Claude {caseArmText(comparison.claude_code_baseline)} · Δscore {comparison.deltas.score ?? '-'} · Δtime {timeDeltaText(comparison.deltas.duration_ms)}
        </Mono>
      </View>
      <View style={styles.caseStatus}>
        <StatusBadge status={tone} compact />
        <Mono size={9.5} lineHeight={12} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
          {statusLabel(comparison.comparison_status)}
        </Mono>
      </View>
    </View>
  )
}

function RunHistoryRow({ run }: { run: AtlasEngineeringFairClaudeRunSummary }) {
  const c = usePalette()
  const summary = run.history_summary
  const scorecard = objectValue(run.paired_scorecard)
  const atlasWins = summary?.atlas_win_count ?? numberValue(scorecard.atlas_win_count) ?? 0
  const baselineWins = summary?.claude_code_baseline_win_count ?? numberValue(scorecard.claude_code_baseline_win_count) ?? 0
  const comparable = summary?.comparable_count ?? numberValue(scorecard.comparable_count)
  const protocol = summary?.protocol_validity_rate ?? numberValue(scorecard.protocol_validity_rate)
  const passWithoutHuman = summary?.pass_without_human_rate_medium_hard ?? summary?.pass_without_human_rate ?? numberValue(scorecard.pass_without_human_rate_medium_hard ?? scorecard.pass_without_human_rate)
  const winner = winnerText(summary?.winner ?? null)
  const health = summary?.health_status ?? run.release_gate_status ?? run.status
  const replayOk = (summary?.replay_integrity_failed_count ?? 0) === 0 && (summary?.replay_packet_count ?? 0) > 0
  const baselineOk = (summary?.baseline_executed_count ?? 0) > 0
  const hasComparable = (comparable ?? 0) > 0
  const readableWinner = hasComparable ? winner : 'Sem comparação'
  const failures = run.release_gate_failures ?? []
  const warnings = run.release_gate_warnings ?? []
  const conclusion = hasComparable
    ? `${winner} · ${atlasWins} Atlas / ${baselineWins} rival / ${summary?.tie_count ?? 0} empate`
    : 'Não conclui vencedor: faltam pares comparáveis Atlas vs rival.'
  const scope = run.fair_report_scope === 'official_fair_claude'
    ? 'fair oficial'
    : run.fair_report_scope === 'paired_non_fair'
      ? 'pareado não-oficial'
      : run.fair_report_scope ?? 'escopo não classificado'

  return (
    <View style={[styles.enterpriseReportCard, { borderColor: statusColor(health, c), backgroundColor: c.bg }]}>
      <View style={styles.enterpriseReportHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Relatório de teste · {dateLabel(run.finished_at ?? run.created_at)}</Label>
          <Sans weight="sb" size={14.5} lineHeight={20} color={c.ink}>
            {readableWinner}
          </Sans>
          <Sans size={11.5} lineHeight={16} color={c.ink2}>
            {conclusion}
          </Sans>
        </View>
        <StatusBadge status={health} compact />
      </View>

      <View style={styles.enterpriseReportGrid}>
        <Metric label="Casos" value={`${run.passed_cases}/${run.total_cases}`} tone={run.failed_cases > 0 ? 'warning' : 'passed'} />
        <Metric label="Comparáveis" value={String(comparable ?? 0)} tone={hasComparable ? 'passed' : 'pending'} />
        <Metric label="Protocolo" value={hasComparable ? percentValue(protocol) : '-'} tone={hasComparable && (protocol ?? 0) >= 100 ? 'passed' : 'pending'} />
        <Metric label="H0" value={hasComparable ? percentValue(passWithoutHuman) : '-'} tone={hasComparable ? 'warning' : 'pending'} />
        <Metric label="Tempo" value={timeText(run.duration_ms)} tone="neutral" />
        <Metric label="Custo" value={costText(run.cost_microusd)} tone="neutral" />
      </View>

      <View style={styles.reportSectionGrid}>
        <ReportFact label="Escopo" value={scope} status={run.fair_report_scope === 'official_fair_claude' ? 'passed' : 'warning'} />
        <ReportFact label="Provider/modelo" value={`${run.provider ?? '-'} / ${run.model ?? '-'}`} status="neutral" />
        <ReportFact label="Baseline" value={baselineOk ? `${summary?.baseline_executed_count ?? 0} caso(s)` : 'ausente'} status={baselineOk ? 'passed' : 'missing'} />
        <ReportFact label="Replay" value={replayOk ? `${summary?.replay_packet_count ?? 0} packet(s)` : 'não verificado'} status={replayOk ? 'passed' : 'missing'} />
        <ReportFact label="Gates" value={run.release_gate_status ?? run.status} status={run.release_gate_status ?? run.status} />
        <ReportFact label="Riscos" value={`${run.risk_flag_count} risco(s) · ${run.blocking_review_finding_count} bloqueante(s)`} status={run.blocking_review_finding_count > 0 ? 'blocked' : run.risk_flag_count > 0 ? 'warning' : 'passed'} />
      </View>

      {summary?.blocking_reasons?.length || failures.length || warnings.length ? (
        <View style={[styles.enterpriseFindingBox, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Label>Bloqueios e observações</Label>
          {[...(summary?.blocking_reasons ?? []), ...failures, ...warnings].slice(0, 5).map((item) => (
            <View key={item} style={styles.enterpriseFindingRow}>
              <View style={[styles.findingDot, { backgroundColor: failures.includes(item) ? c.recRed : c.bronze }]} />
              <Sans size={11} lineHeight={15} color={c.ink2}>
                {item}
              </Sans>
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.enterpriseFindingBox, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Label>Bloqueios e observações</Label>
          <Sans size={11} lineHeight={15} color={c.ink2}>
            Nenhum bloqueio reportado neste run.
          </Sans>
        </View>
      )}

      <View style={styles.reportFooter}>
        <Mono size={9.5} lineHeight={12} letterSpacing={0.05} color={c.ink2} numberOfLines={1}>
          run {run.id}
        </Mono>
        <Mono size={9.5} lineHeight={12} letterSpacing={0.05} color={c.ink2} numberOfLines={1}>
          {run.harness_version ?? 'harness -'} · {run.total_attempts} tentativa(s)
        </Mono>
      </View>
    </View>
  )
}

function ReportFact({ label, status, value }: { label: string; status: string; value: string }) {
  const c = usePalette()

  return (
    <View style={[styles.reportFact, { borderColor: c.border, backgroundColor: c.surface }]}>
      <Mono size={9.3} lineHeight={12} letterSpacing={0.7} color={c.ink3} style={styles.uppercase}>
        {label}
      </Mono>
      <Sans weight="med" size={11.5} lineHeight={16} color={statusColor(status, c)} numberOfLines={2}>
        {value}
      </Sans>
    </View>
  )
}

function StatusBadge({ status, compact = false }: { status: string | null | undefined; compact?: boolean }) {
  const c = usePalette()
  const normalized = status ?? 'unknown'

  return (
    <View style={[styles.statusBadge, compact && styles.statusBadgeCompact, { borderColor: statusColor(normalized, c) }]}>
      <Mono size={compact ? 9.5 : 10.5} lineHeight={compact ? 12 : 14} letterSpacing={0.1} color={statusColor(normalized, c)}>
        {statusLabel(normalized)}
      </Mono>
    </View>
  )
}

function EmptyLine({ text }: { text: string }) {
  const c = usePalette()

  return (
    <View style={[styles.emptyLine, { borderColor: c.border, backgroundColor: c.bg }]}>
      <Sans size={11.5} lineHeight={16} color={c.ink2}>
        {text}
      </Sans>
    </View>
  )
}

function buildInsights(report: AtlasEngineeringFairClaudeReportResponse | null): Insight[] {
  if (!report) {
    return [{
      severity: 'info',
      title: 'Relatório ainda não carregado',
      detail: 'Aguardando resposta do servidor para calcular readiness, scorecard e histórico.',
    }]
  }

  const readiness = report.readiness
  const scorecard = report.paired_scorecard
  const insights: Insight[] = []
  const releaseCorpus = readiness.release_corpus_case_count ?? corpusReleaseCount(report.corpus_manifest)
  const minimumReleaseCorpus = readiness.minimum_release_corpus_case_count ?? 6

  if (releaseCorpus < minimumReleaseCorpus) {
    insights.push({
      severity: 'critical',
      title: 'Corpus Fair Claude incompleto',
      detail: `${releaseCorpus}/${minimumReleaseCorpus} casos release preparados; rode prepare antes da bateria.`,
    })
  }

  if (readiness.ready_for_claim) {
    insights.push({
      severity: 'good',
      title: 'Pronto para claim operacional',
      detail: `${readiness.comparable_count} casos comparáveis com protocolo, baseline e replay em condição verificável.`,
    })
  } else if (readiness.comparable_count === 0) {
    insights.push({
      severity: 'critical',
      title: 'Sem amostra comparável',
      detail: 'Ainda não existe par Atlas vs Claude Code suficiente para sustentar qualquer conclusão.',
    })
  } else {
    insights.push({
      severity: 'warning',
      title: 'Claim ainda bloqueado',
      detail: `${readiness.blocking_reasons.length} bloqueios impedem declarar vitória com segurança.`,
    })
  }

  if (!report.claude_code_baseline.enabled) {
    insights.push({
      severity: 'critical',
      title: 'Baseline Claude Code ausente',
      detail: 'A comparação justa exige o braço Claude Code CLI executado e validado em workspace separado.',
    })
  }

  if (!report.replay_manifest.enabled || report.replay_manifest.artifact_integrity_failed_count > 0) {
    insights.push({
      severity: 'critical',
      title: 'Replay/auditoria incompleto',
      detail: `${report.replay_manifest.packet_count} packets · ${report.replay_manifest.artifact_integrity_failed_count} falhas de integridade.`,
    })
  }

  if ((scorecard.provider_violation_count ?? 0) > 0 || (scorecard.fallback_violation_count ?? 0) > 0) {
    insights.push({
      severity: 'critical',
      title: 'Violação de fair mode',
      detail: `${scorecard.provider_violation_count} provider violations · ${scorecard.fallback_violation_count} fallback violations.`,
    })
  }

  if ((scorecard.protocol_validity_rate ?? 0) < TARGETS.protocol) {
    insights.push({
      severity: 'warning',
      title: 'Protocolo abaixo do alvo',
      detail: `Protocol validity ${percentValue(scorecard.protocol_validity_rate)}; alvo obrigatório ${TARGETS.protocol}%.`,
    })
  }

  if ((scorecard.pass_without_human_rate_medium_hard ?? scorecard.pass_without_human_rate ?? 0) >= TARGETS.mediumHard) {
    insights.push({
      severity: 'good',
      title: 'Autonomia útil em médio/difícil',
      detail: `Pass without human médio/difícil em ${percentValue(scorecard.pass_without_human_rate_medium_hard)}.`,
    })
  }

  if (readiness.atlas_win_count > readiness.claude_code_baseline_win_count) {
    insights.push({
      severity: 'good',
      title: 'Atlas lidera a amostra',
      detail: `${readiness.atlas_win_count} vitórias Atlas contra ${readiness.claude_code_baseline_win_count} do baseline.`,
    })
  } else if (readiness.claude_code_baseline_win_count > readiness.atlas_win_count) {
    insights.push({
      severity: 'warning',
      title: 'Claude Code lidera a amostra',
      detail: `${readiness.claude_code_baseline_win_count} vitórias Claude Code contra ${readiness.atlas_win_count} do Atlas.`,
    })
  }

  return insights.slice(0, 6)
}

function buildHistorySummary(report: AtlasEngineeringFairClaudeReportResponse | null): RivalsHistorySummary {
  const runs = report?.runs ?? []
  const latest = runs[0]
  const readiness = report?.readiness

  let comparableCases = readiness?.comparable_count ?? 0
  let atlasWins = readiness?.atlas_win_count ?? 0
  let baselineWins = readiness?.claude_code_baseline_win_count ?? 0
  let ties = readiness?.tie_count ?? 0

  for (const run of runs) {
    const summary = run.history_summary
    if (!summary) continue
    comparableCases = Math.max(comparableCases, summary.comparable_count ?? 0)
    atlasWins = Math.max(atlasWins, summary.atlas_win_count ?? 0)
    baselineWins = Math.max(baselineWins, summary.claude_code_baseline_win_count ?? 0)
    ties = Math.max(ties, summary.tie_count ?? 0)
  }

  const hasRealBenchmark = comparableCases > 0
  const lastRunLabel = latest ? dateLabel(latest.finished_at ?? latest.created_at) : 'nenhum'
  const lastRunStatus = latest?.history_summary?.health_status ?? latest?.release_gate_status ?? latest?.status ?? 'pending'

  if (!runs.length) {
    return {
      atlasWins,
      baselineWins,
      comparableCases,
      hasRealBenchmark: false,
      lastRunLabel,
      lastRunStatus,
      ties,
      totalRuns: 0,
      trendDetail: 'Sem linha do tempo. Rode uma bateria para criar o primeiro ponto de comparação.',
      trendLabel: 'Sem testes registrados',
    }
  }

  if (!hasRealBenchmark) {
    return {
      atlasWins,
      baselineWins,
      comparableCases,
      hasRealBenchmark: false,
      lastRunLabel,
      lastRunStatus,
      ties,
      totalRuns: runs.length,
      trendDetail: `${runs.length} execução(ões), mas nenhuma com par Atlas vs rival comparável. Não use 0% como score.`,
      trendLabel: 'Histórico existe, comparação ainda não',
    }
  }

  const leader = atlasWins > baselineWins
    ? 'Atlas lidera'
    : baselineWins > atlasWins
      ? 'Rival lidera'
      : 'Empate técnico'

  return {
    atlasWins,
    baselineWins,
    comparableCases,
    hasRealBenchmark,
    lastRunLabel,
    lastRunStatus,
    ties,
    totalRuns: runs.length,
    trendDetail: `${comparableCases} caso(s) comparáveis · Atlas ${atlasWins}, rival ${baselineWins}, empate ${ties}.`,
    trendLabel: `${leader} no histórico recente`,
  }
}

function corpusNumber(manifest: Record<string, unknown> | null | undefined, key: string): number {
  const value = manifest?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function corpusReleaseCount(manifest: Record<string, unknown> | null | undefined): number {
  const subsets = objectValue(manifest?.official_subsets)
  const release = numberValue(subsets.release)
  return release ?? 0
}

function winnerLabel(report: AtlasEngineeringFairClaudeReportResponse | null): string {
  const readiness = report?.readiness
  if (!readiness || readiness.comparable_count === 0) return 'Aguardando bateria comparável'
  if (readiness.atlas_win_count > readiness.claude_code_baseline_win_count) return 'Atlas lidera no benchmark justo'
  if (readiness.claude_code_baseline_win_count > readiness.atlas_win_count) return 'Claude Code lidera a amostra'
  return 'Empate técnico na amostra'
}

function percentValue(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : '-'
}

function numberText(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '-'
}

function timeText(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  if (value > 60_000) return `${Math.round(value / 60_000)}m`
  if (value > 1000) return `${Math.round(value / 1000)}s`
  return `${Math.round(value)}ms`
}

function costText(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `$${Math.round(value) / 1000000}`
}

function timeToGreenText(value: unknown): string {
  if (typeof value === 'number') return timeText(value)
  const payload = objectValue(value)
  const atlasMs = numberValue(payload.atlas_avg_ms)
  const baselineMs = numberValue(payload.claude_code_baseline_avg_ms)
  if (atlasMs === null && baselineMs === null) return '-'
  return `${timeText(atlasMs)} / ${timeText(baselineMs)}`
}

function costPerGreenText(value: unknown): string {
  if (typeof value === 'number') return costText(value)
  const payload = objectValue(value)
  const usd = numberValue(payload.usd)
  const microusd = numberValue(payload.microusd)
  if (usd !== null) return `$${usd.toFixed(4)}`
  if (microusd !== null) return costText(microusd)
  return '-'
}

function replayEvidenceVerified(audit: Record<string, unknown>): boolean {
  return (numberValue(audit.replay_packet_count) ?? 0) > 0
    && (numberValue(audit.artifact_integrity_failed_count) ?? 0) === 0
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function textValue(value: unknown, fallback = '-'): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function winnerText(winner: string | null): string {
  if (winner === 'atlas') return 'Atlas wins'
  if (winner === 'claude_code_baseline') return 'Claude wins'
  if (winner === 'tie') return 'Tie'
  return 'Inconclusive'
}

function caseArmText(arm: { verified?: boolean; pass_without_human?: boolean; score?: number | null; duration_ms?: number | null }): string {
  const status = arm.verified ? 'verified' : 'unverified'
  const h0 = arm.pass_without_human ? 'h0' : 'human'
  return `${status}/${h0}/score ${arm.score ?? '-'}/${timeText(arm.duration_ms)}`
}

function timeDeltaText(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${timeText(value)}`
}

function normalizeActionSeverity(severity: string): Insight['severity'] {
  if (severity === 'critical' || severity === 'warning' || severity === 'info') return severity
  return 'info'
}

function blockingSeverity(reason: string): Insight['severity'] {
  if ([
    'provider',
    'fallback',
    'baseline',
    'replay',
    'manifest',
    'no_comparable',
    'fair_atlas_arm_missing',
  ].some((needle) => reason.includes(needle))) return 'critical'
  if (['missing', 'not_ready', 'unverified'].some((needle) => reason.includes(needle))) return 'warning'
  return 'info'
}

function blockingReasonDetail(reason: string): string {
  if (reason.includes('no_fair_claude_runs')) return 'Nenhuma execução Fair Claude foi persistida.'
  if (reason.includes('paired_scorecard_missing')) return 'Scorecard pareado ainda não foi calculado.'
  if (reason.includes('fair_atlas_arm_missing')) return 'O braço Atlas fair não apareceu nos resultados.'
  if (reason.includes('no_comparable_cases')) return 'Não há casos pareáveis entre Atlas e Claude Code.'
  if (reason.includes('claude_code_baseline_not_executed')) return 'O braço Claude Code baseline não concluiu.'
  if (reason.includes('replay_manifest_not_fully_verified')) return 'A integridade dos artifacts/replay ainda não está completa.'
  return 'Bloqueio reportado pelo protocolo de readiness.'
}

function severityColor(severity: Insight['severity'], c: ReturnType<typeof usePalette>): string {
  if (severity === 'critical') return c.recRed
  if (severity === 'warning') return c.bronze
  if (severity === 'good') return c.moss
  return c.ink2
}

function statusLabel(status: string): string {
  switch (status) {
    case 'passed':
    case 'resolved':
    case 'active':
      return 'ok'
    case 'failed':
    case 'unresolved':
      return 'falha'
    case 'running':
      return 'rodando'
    case 'atlas_leading':
      return 'Atlas'
    case 'baseline_leading':
      return 'Claude'
    case 'tied':
      return 'empate'
    case 'inconclusive':
      return 'inconc'
    case 'baseline_ok':
      return 'baseline'
    case 'replay_ok':
      return 'replay'
    case 'warning':
      return 'aviso'
    case 'missing':
      return 'faltando'
    case 'release_ready':
    case 'ready':
      return 'pronto'
    case 'needs_review':
      return 'revisar'
    case 'blocked':
      return 'bloq'
    case 'not_ready':
      return 'não pronto'
    case 'pending':
      return 'pendente'
    case 'critical':
      return 'crítico'
    case 'info':
      return 'info'
    case 'good':
      return 'ok'
    default:
      return status || '-'
  }
}

function statusColor(status: string, c: ReturnType<typeof usePalette>): string {
  const normalized = status.toLowerCase()
  if (['passed', 'resolved', 'ok', 'active', 'ready', 'release_ready', 'pronto', 'atlas_leading', 'baseline_ok', 'replay_ok'].includes(normalized)) return c.moss
  if (['failed', 'unresolved', 'falha', 'blocked', 'missing', 'critical'].includes(normalized)) return c.recRed
  if (['warning', 'needs_review', 'pending', 'not_ready', 'running', 'baseline_leading', 'tied', 'inconclusive'].includes(normalized)) return c.bronze
  return c.ink2
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  backButton: {
    minHeight: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  executivePanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  connectionAlert: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  connectionGrid: {
    gap: 8,
  },
  connectionTile: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 10,
    gap: 5,
  },
  retryButton: {
    minHeight: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  executiveTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  executiveBriefGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  executiveBriefTile: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 92,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 10,
    gap: 5,
  },
  executiveBriefTileWide: {
    flexBasis: '100%',
  },
  uppercase: {
    textTransform: 'uppercase',
  },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insightList: {
    gap: 8,
  },
  actionList: {
    gap: 8,
  },
  insightRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 11,
    flexDirection: 'row',
    gap: 10,
  },
  insightTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 2,
  },
  severityRail: {
    width: 3,
    borderRadius: 999,
  },
  actionRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  evidenceBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 11,
    gap: 10,
  },
  evidenceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  evidenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  commandList: {
    gap: 7,
  },
  commandRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  presetList: {
    gap: 7,
  },
  presetRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  runBatteryBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 11,
    gap: 10,
  },
  modeGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  batteryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    minHeight: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 2,
  },
  modeCatalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  modeCatalogItem: {
    minWidth: 118,
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    gap: 2,
  },
  providerOptionList: {
    gap: 4,
  },
  providerSelector: {
    gap: 8,
  },
  providerGroup: {
    gap: 6,
  },
  providerGroupHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  modelChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  modelChip: {
    minHeight: 32,
    minWidth: 92,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  lockedProviderCard: {
    minHeight: 64,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  casePresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  caseLimitButton: {
    flexGrow: 1,
    minWidth: 92,
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 10,
    gap: 2,
  },
  formGrid: {
    gap: 8,
  },
  textFieldWrap: {
    gap: 4,
  },
  textField: {
    minHeight: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 11.5,
  },
  costAcknowledge: {
    minHeight: 34,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  advancedToggle: {
    minHeight: 34,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    paddingHorizontal: 10,
  },
  launchPlanBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 10,
    gap: 9,
  },
  blockerList: {
    gap: 3,
  },
  runBatteryButton: {
    minHeight: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  markdownBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 11,
    gap: 10,
  },
  markdownPreview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 10,
    gap: 3,
  },
  verifyCommandBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 10,
    gap: 4,
  },
  bundleFileList: {
    gap: 6,
  },
  bundleFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  metric: {
    flex: 1,
    minWidth: 128,
    minHeight: 58,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  targetList: {
    gap: 8,
  },
  targetRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  targetValue: {
    alignItems: 'flex-end',
    gap: 4,
  },
  integrityList: {
    gap: 8,
  },
  integrityRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reasonList: {
    gap: 8,
  },
  historyPanelStack: {
    gap: 10,
  },
  historyOverview: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 11,
    gap: 10,
  },
  reasonRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  historyList: {
    gap: 8,
  },
  historyRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  enterpriseReportCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    gap: 11,
  },
  enterpriseReportHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  enterpriseReportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reportSectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reportFact: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 58,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  enterpriseFindingBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 10,
    gap: 7,
  },
  enterpriseFindingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  findingDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginTop: 5,
  },
  reportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  historyBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 6,
  },
  caseList: {
    gap: 8,
  },
  caseRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  caseStatus: {
    alignItems: 'flex-end',
    gap: 4,
    maxWidth: 88,
  },
  noScorecardBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 11,
    gap: 10,
  },
  emptyLine: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
  },
  statusBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusBadgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
})
