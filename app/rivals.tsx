import { RefreshControl, Pressable, StyleSheet, View } from 'react-native'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { CodexReveal } from '../components/CodexReveal'
import { Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { useShell } from '../components/AtlasShell'
import {
  fetchEngineeringBenchmarkRun,
  fetchEngineeringFairClaudeReport,
  type AtlasEngineeringFairClaudeCaseComparison,
  type AtlasEngineeringFairClaudeNextAction,
  type AtlasEngineeringBenchmarkResultSummary,
  type AtlasEngineeringBenchmarkRunResponse,
  type AtlasEngineeringFairClaudeRunSummary,
  type AtlasEngineeringFairClaudeReportResponse,
} from '../lib/api/client'

const SUITE = 'atlas-fair-claude-v1'
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
  const [latestRun, setLatestRun] = useState<AtlasEngineeringBenchmarkRunResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const loadReport = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetchEngineeringFairClaudeReport(SUITE, { limit: 30 })
      setReport(response)
      const runId = response.runs[0]?.id
      if (runId) {
        try {
          const runResponse = await fetchEngineeringBenchmarkRun(runId)
          setLatestRun(runResponse)
        } catch {
          setLatestRun(null)
        }
      } else {
        setLatestRun(null)
      }
    } catch {
      setReport(null)
      setLatestRun(null)
      showToast('Não consegui carregar Atlas Rivals')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadReport()
  }, [loadReport])

  const readiness = report?.readiness
  const scorecard = report?.paired_scorecard
  const executive = report?.executive_summary
  const evidence = report?.evidence_packet
  const exportBundle = report?.export_bundle
  const claimMarkdown = report?.claim_markdown ?? ''
  const runs = report?.runs ?? []
  const ready = Boolean(readiness?.ready_for_claim)
  const winner = executive?.headline ?? winnerLabel(report)
  const insights = useMemo(() => buildInsights(report), [report])
  const nextActions = report?.next_actions ?? []
  const caseComparisons = report?.case_comparisons ?? []
  const legacyCaseResults = latestRun?.results ?? []

  return (
    <Screen
      topExtra={22}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadReport() }} />}
    >
      <CodexReveal index={0}>
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label>Atlas Engineering</Label>
            <Sans weight="sb" size={24} lineHeight={30} color={c.ink}>
              Atlas Rivals
            </Sans>
            <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
              Fair Claude · Atlas harness vs Claude Code CLI · {report?.generated_at ? dateLabel(report.generated_at) : 'sem report'}
            </Mono>
          </View>
          <Pressable
            onPress={() => router.push('/engineering')}
            style={({ pressed }) => [
              styles.backButton,
              { borderColor: c.border, backgroundColor: pressed ? c.premium : c.surface },
            ]}
          >
            <Mono size={10.5} lineHeight={14} letterSpacing={0.1} color={c.prussian}>
              bench
            </Mono>
          </Pressable>
        </View>
      </CodexReveal>

      <CodexReveal index={1}>
      <View style={[styles.executivePanel, { borderColor: ready ? c.moss : c.border, backgroundColor: c.surface }]}>
        <View style={styles.executiveTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Label>Executive Summary</Label>
            <Sans weight="sb" size={19} lineHeight={25} color={c.ink}>
              {winner}
            </Sans>
            <Mono size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
              {executive?.claim_status ?? readiness?.status ?? (loading ? 'loading' : 'not_ready')} · {readiness?.comparable_count ?? 0} comparable cases · confidence {executive?.confidence ?? '-'}
            </Mono>
          </View>
          <StatusBadge status={readiness?.status ?? (loading ? 'running' : 'missing')} />
        </View>

        <View style={styles.metricGrid}>
          <Metric label="Atlas wins" value={String(readiness?.atlas_win_count ?? 0)} tone={ready ? 'passed' : 'pending'} />
          <Metric label="Claude wins" value={String(readiness?.claude_code_baseline_win_count ?? 0)} tone={readiness?.claude_code_baseline_win_count ? 'warning' : 'passed'} />
          <Metric label="Ties" value={String(readiness?.tie_count ?? 0)} />
          <Metric label="Claim" value={ready ? 'ready' : 'blocked'} tone={ready ? 'passed' : 'blocked'} />
        </View>
      </View>
      </CodexReveal>

      <CodexReveal index={2}>
        <Section title="O Que Importa Agora" count={insights.length}>
          <View style={styles.insightList}>
            {insights.map((insight) => (
              <InsightRow key={`${insight.severity}:${insight.title}`} insight={insight} />
            ))}
          </View>
        </Section>
      </CodexReveal>

      <CodexReveal index={3}>
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

      <Section title="Evidence Packet" count={evidence ? 1 : 0}>
        {evidence ? (
          <EvidencePacketCard evidence={evidence} />
        ) : (
          <EmptyLine text="Nenhum pacote de evidência disponível ainda." />
        )}
      </Section>

      <Section title="Markdown Export" count={claimMarkdown ? 1 : 0}>
        {claimMarkdown ? (
          <MarkdownExportPreview markdown={claimMarkdown} bundle={exportBundle} />
        ) : (
          <EmptyLine text="Nenhum export Markdown disponível ainda." />
        )}
      </Section>

      <Section title="Scorecard" count={scorecard?.case_count ?? 0}>
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
      </Section>

      <Section title="Protocol Integrity" count={report?.scope.fair_result_count ?? 0}>
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
      </Section>

      <Section title="Blocking Reasons" count={readiness?.blocking_reasons.length ?? 0}>
        {readiness?.blocking_reasons.length ? (
          <View style={styles.reasonList}>
            {readiness.blocking_reasons.map((reason) => <BlockingReasonRow key={reason} reason={reason} />)}
          </View>
        ) : (
          <EmptyLine text="Nenhum bloqueio ativo." />
        )}
      </Section>

      <Section title="Run History" count={runs.length}>
        {runs.length ? (
          <View style={styles.historyList}>
            {runs.map((run) => <RunHistoryRow key={run.id} run={run} />)}
          </View>
        ) : (
          <EmptyLine text="Nenhuma bateria Rivals concluída ainda." />
        )}
      </Section>

      <Section title="Case Results" count={caseComparisons.length || legacyCaseResults.length}>
        {caseComparisons.length ? (
          <View style={styles.caseList}>
            {caseComparisons.map((comparison) => <CaseComparisonRow key={comparison.result_id} comparison={comparison} />)}
          </View>
        ) : legacyCaseResults.length ? (
          <View style={styles.caseList}>
            {legacyCaseResults.map((result) => <CaseResultRow key={result.id} result={result} />)}
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

function CaseResultRow({ result }: { result: AtlasEngineeringBenchmarkResultSummary }) {
  const c = usePalette()
  const expectation = objectValue(result.expectation)
  const observed = objectValue(result.observed)
  const domain = textValue(expectation.domain_slug ?? expectation.domain ?? observed.domain_slug, '-')
  const difficulty = textValue(expectation.difficulty ?? observed.difficulty, '-')
  const gate = textValue(observed.release_gate_status ?? observed.gate_status ?? observed.status, result.status)

  return (
    <View style={[styles.caseRow, { borderColor: result.passed ? c.border : c.bronze, backgroundColor: c.bg }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={12.5} lineHeight={18} color={c.ink} numberOfLines={1}>
          {result.case_code ?? result.case_id}
        </Sans>
        <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={2}>
          {domain} · {difficulty} · score {result.score ?? '-'} · {result.failure_summary ?? result.decision ?? 'sem falha registrada'}
        </Mono>
      </View>
      <View style={styles.caseStatus}>
        <StatusBadge status={result.passed ? 'passed' : result.status} compact />
        <Mono size={9.5} lineHeight={12} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
          {statusLabel(gate)}
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

  return (
    <View style={[styles.historyRow, { borderColor: statusColor(health, c), backgroundColor: c.bg }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={12.5} lineHeight={18} color={c.ink} numberOfLines={1}>
          {winner} · {statusLabel(health)} · {run.passed_cases}/{run.total_cases} cases
        </Sans>
        <Mono size={10.2} lineHeight={14} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
          {dateLabel(run.finished_at ?? run.created_at)} · comparable {comparable ?? '-'} · Atlas {atlasWins ?? 0} / Claude {baselineWins ?? 0} · protocol {percentValue(protocol)} · h0 {percentValue(passWithoutHuman)}
        </Mono>
        <View style={styles.historyBadges}>
          <StatusBadge status={run.fair_report_scope === 'official_fair_claude' ? 'passed' : 'warning'} compact />
          <StatusBadge status={baselineOk ? 'baseline_ok' : 'missing'} compact />
          <StatusBadge status={replayOk ? 'replay_ok' : 'missing'} compact />
          {summary?.blocking_reasons?.slice(0, 2).map((reason) => (
            <Mono key={reason} size={9.2} lineHeight={12} letterSpacing={0.05} color={c.bronze} numberOfLines={1}>
              {reason}
            </Mono>
          ))}
        </View>
      </View>
      <StatusBadge status={health} compact />
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
  executiveTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
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
