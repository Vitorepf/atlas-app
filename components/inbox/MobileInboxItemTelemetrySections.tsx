import { View } from 'react-native'
import { Frau, Label, Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { AtlasOperationalInboxItem } from '../../lib/api/client'
import { humanize, severityColor, textValue } from '../../lib/mobileInboxItemModels'
import {
  formatMetricValue,
  formatNumber,
  issueMeaning,
  metricHint,
  metricLabel,
  notificationPolicyLabel,
  numberValue,
  sampleConfidence,
  sampleMessage,
  telemetryActionList,
  telemetryBreakdowns,
  telemetryHealthReport,
  telemetryIssueList,
  telemetryMetricRefs,
  telemetryPrimaryMetrics,
  translateTelemetryAction,
  type TelemetryHealthReport,
  type TelemetryIssue,
  whyReceivedText,
} from '../../lib/mobileInboxTelemetryModels'
import { styles } from './mobileInboxItemStyles'
import { DetailLine, EmptyText, Section, TextBlock } from './MobileInboxItemSectionPrimitives'

export function TelemetryHealthPanel({ item }: { item: AtlasOperationalInboxItem }) {
  const c = usePalette()
  const report = telemetryHealthReport(item)
  const criticalCount = report.issues.filter((issue) => issue.severity === 'critical').length
  const warningCount = report.issues.filter((issue) => issue.severity === 'warning').length
  const statusText = report.status === 'critical' ? 'Critico' : report.status === 'warning' ? 'Atencao' : humanize(report.status)
  const scoreText = report.score == null ? '--' : `${report.score}/100`

  return (
    <Section title="Diagnostico">
      <View style={[styles.diagnosticHeader, { borderColor: c.border, backgroundColor: c.premium }]}>
        <View style={styles.diagnosticCopy}>
          <Sans weight="sb" size={15} lineHeight={20} color={c.ink}>
            Saude do Atlas em {statusText.toLowerCase()}
          </Sans>
          <Sans size={13} lineHeight={19} color={c.ink2}>
            O Atlas avaliou a telemetria operacional e abriu este item porque encontrou sinais fora do limite.
          </Sans>
        </View>
        <View style={[styles.scoreBadge, { borderColor: severityColor(item.severity, c, false) }]}>
          <Mono size={19} lineHeight={23} color={severityColor(item.severity, c)}>
            {scoreText}
          </Mono>
          <Sans size={10.5} lineHeight={13} color={c.ink3} align="center">
            score
          </Sans>
        </View>
      </View>

      <View style={styles.explainGrid}>
        <ExplainTile label="Janela" value={report.window ?? '48h recentes'} />
        <ExplainTile label="Amostra" value={report.traces == null ? 'sem dado' : `${report.traces} traces`} />
        <ExplainTile label="Criticos" value={String(criticalCount)} danger={criticalCount > 0} />
        <ExplainTile label="Alertas" value={String(warningCount)} danger={warningCount > 0} />
      </View>

      <TextBlock label="Por que apareceu" value={whyReceivedText(report)} />

      {sampleConfidence(report) === 'limited' ? (
        <View style={[styles.sampleNotice, { borderColor: c.border, backgroundColor: c.premium }]}>
          <Sans weight="sb" size={13} lineHeight={18} color={c.ink}>
            Leitura com amostra pequena
          </Sans>
          <Sans size={12.5} lineHeight={18} color={c.ink2}>
            {sampleMessage(report) ?? 'Use este item como sinal de investigacao, nao como conclusao definitiva.'}
          </Sans>
        </View>
      ) : null}

      <TextBlock
        label="O que significa"
        value="Isto nao quer dizer que o app quebrou. Quer dizer que a camada de IA produziu sinais ruins ou incompletos na janela analisada: qualidade baixa, first-pass ruim, custo sem atribuicao ou outro indicador acima do limite."
      />

      {report.issues.length > 0 ? (
        <View style={styles.issueList}>
          <Label>Sinais que dispararam</Label>
          {report.issues.map((issue, index) => (
            <IssueRow key={`${issue.key}-${index}`} issue={issue} />
          ))}
        </View>
      ) : null}

      {report.actions.length > 0 ? (
        <View style={styles.actionAdviceList}>
          <Label>Proximos passos recomendados</Label>
          {report.actions.map((action, index) => (
            <View key={`${action}-${index}`} style={styles.adviceRow}>
              <Mono size={11} lineHeight={16} color={c.prussian}>
                {String(index + 1).padStart(2, '0')}
              </Mono>
              <Sans size={13} lineHeight={19} color={c.ink}>
                {translateTelemetryAction(action)}
              </Sans>
            </View>
          ))}
        </View>
      ) : null}
    </Section>
  )
}

export function TelemetryHealthMetricsPanel({ item }: { item: AtlasOperationalInboxItem }) {
  const report = telemetryHealthReport(item)
  const primaryMetrics = telemetryPrimaryMetrics(report)
  if (primaryMetrics.length === 0) return null

  return (
    <Section title="Metricas principais">
      <View style={styles.metricRows}>
        {primaryMetrics.map((metric) => (
          <MetricRow
            key={metric.name}
            label={metricLabel(metric.name)}
            value={formatMetricValue(metric.name, metric.value)}
            hint={metricHint(metric.name)}
          />
        ))}
      </View>
    </Section>
  )
}

export function TelemetryHealthBreakdownPanel({ item }: { item: AtlasOperationalInboxItem }) {
  const report = telemetryHealthReport(item)
  const surfaceRows = report.breakdowns.by_surface ?? []
  const providerRows = report.breakdowns.by_provider ?? []
  const modelRows = report.breakdowns.by_model ?? []

  if (surfaceRows.length === 0 && providerRows.length === 0 && modelRows.length === 0) return null

  return (
    <Section title="Origem do sinal">
      {surfaceRows.length > 0 ? <BreakdownGroup title="Superficie" rows={surfaceRows} /> : null}
      {providerRows.length > 0 ? <BreakdownGroup title="Provider" rows={providerRows} /> : null}
      {modelRows.length > 0 ? <BreakdownGroup title="Modelo" rows={modelRows} /> : null}
    </Section>
  )
}

function BreakdownGroup({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  return (
    <View style={styles.breakdownGroup}>
      <Label>{title}</Label>
      <View style={styles.breakdownRows}>
        {rows.slice(0, 4).map((row, index) => (
          <BreakdownRow key={`${title}-${textValue(row.bucket) ?? index}`} row={row} />
        ))}
      </View>
    </View>
  )
}

function BreakdownRow({ row }: { row: Record<string, unknown> }) {
  const c = usePalette()
  const bucket = textValue(row.bucket) ?? 'unknown'
  const traces = numberValue(row.traces)
  const quality = numberValue(row.quality_avg)
  const firstPass = numberValue(row.first_pass_success_rate)
  const unknownCostCount = numberValue(row.unknown_cost_count)
  const latency = numberValue(row.latency_avg_ms)

  return (
    <View style={[styles.breakdownRow, { borderColor: c.border }]}>
      <View style={styles.metricCopy}>
        <Sans weight="sb" size={13.5} lineHeight={18} color={c.ink}>
          {bucket}
        </Sans>
        <Sans size={12.5} lineHeight={17} color={c.ink2}>
          {[
            traces == null ? null : `${formatNumber(traces, 0)} traces`,
            quality == null ? null : `qualidade ${formatMetricValue('final_quality_avg', quality)}`,
            firstPass == null ? null : `first-pass ${formatMetricValue('first_pass_success_rate', firstPass)}`,
            latency == null ? null : `latencia ${formatMetricValue('latency_avg_ms', latency)}`,
          ].filter(Boolean).join(' · ')}
        </Sans>
      </View>
      {unknownCostCount && unknownCostCount > 0 ? (
        <Mono size={11} lineHeight={15} color={c.recRed}>
          {formatNumber(unknownCostCount, 0)} sem custo
        </Mono>
      ) : null}
    </View>
  )
}

function ExplainTile({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  const c = usePalette()
  return (
    <View style={[styles.explainTile, { borderColor: c.border, backgroundColor: danger ? `${c.recRed}10` : c.surface }]}>
      <Mono size={10.5} lineHeight={14} color={c.ink3} letterSpacing={0.2} style={styles.detailLabel}>
        {label}
      </Mono>
      <Sans weight="sb" size={13.5} lineHeight={18} color={danger ? c.recRed : c.ink}>
        {value}
      </Sans>
    </View>
  )
}

function IssueRow({ issue }: { issue: TelemetryIssue }) {
  const c = usePalette()
  const critical = issue.severity === 'critical'
  return (
    <View style={[styles.issueRow, { borderColor: c.border, backgroundColor: critical ? `${c.recRed}10` : c.surface }]}>
      <View style={styles.issueTopRow}>
        <Sans weight="sb" size={13.5} lineHeight={18} color={c.ink}>
          {metricLabel(issue.key)}
        </Sans>
        <Mono size={10.5} lineHeight={14} color={critical ? c.recRed : c.ink2} letterSpacing={0.2} style={styles.detailLabel}>
          {issue.severity}
        </Mono>
      </View>
      <Sans size={12.5} lineHeight={18} color={c.ink2}>
        {formatMetricValue(issue.key, issue.value)} vs limite {formatMetricValue(issue.key, issue.threshold)}
      </Sans>
      <Sans size={12.5} lineHeight={18} color={c.ink}>
        {issueMeaning(issue)}
      </Sans>
    </View>
  )
}

function MetricRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  const c = usePalette()
  return (
    <View style={[styles.metricRow, { borderColor: c.border }]}>
      <View style={styles.metricCopy}>
        <Sans weight="sb" size={13.5} lineHeight={18} color={c.ink}>
          {label}
        </Sans>
        <Sans size={12.5} lineHeight={17} color={c.ink2}>
          {hint}
        </Sans>
      </View>
      <Mono size={13} lineHeight={18} color={c.prussian}>
        {value}
      </Mono>
    </View>
  )
}
