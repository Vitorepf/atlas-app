import type { AtlasOperationalInboxItem } from './api/client'
import {
  dateTimeLabel,
  humanize,
  isRecord,
  payloadText,
  textValue,
} from './mobileInboxItemModels'

export type TelemetryIssue = {
  key: string
  severity: string
  value: unknown
  threshold: unknown
  summary: string | null
}

export type TelemetryHealthReport = {
  status: string
  score: number | null
  window: string | null
  traces: number | null
  sample: Record<string, unknown> | null
  whyReceived: Record<string, unknown> | null
  notificationPolicy: Record<string, unknown> | null
  breakdowns: Record<string, Array<Record<string, unknown>>>
  issues: TelemetryIssue[]
  actions: string[]
  metrics: Array<{ name: string; value: unknown }>
}

export function isTelemetryHealthInsight(item: AtlasOperationalInboxItem): boolean {
  return item.type === 'insight'
    && (payloadText(item.payload ?? {}, 'insight_kind') === 'atlas_ai_telemetry_health'
      || (item.dedupe_key?.includes('atlas-ai-telemetry-health') ?? false))
}

export function telemetryHealthReport(item: AtlasOperationalInboxItem): TelemetryHealthReport {
  const payload = item.payload ?? {}
  const health = isRecord(payload.health) ? payload.health : null
  const legacy = parseLegacyTelemetryBody(item.body)
  const metrics = telemetryMetricRefs(item)
  const sample = isRecord(health?.sample) ? health.sample : null
  const whyReceived = isRecord(health?.why_received) ? health.why_received : null
  const notificationPolicy = isRecord(health?.notification_policy) ? health.notification_policy : null
  const breakdowns = telemetryBreakdowns(health?.breakdowns)
  const score = numberValue(health?.health_score) ?? scoreFromSummary(item.summary)
  const issues = telemetryIssueList(health?.issues).length > 0
    ? telemetryIssueList(health?.issues)
    : legacy.issues
  const actions = telemetryActionList(health?.actions).length > 0
    ? telemetryActionList(health?.actions)
    : legacy.actions

  return {
    status: textValue(health?.status) ?? item.severity,
    score,
    window: windowLabelFromRecord(health?.window),
    traces: numberMetric(metrics, 'traces'),
    sample,
    whyReceived,
    notificationPolicy,
    breakdowns,
    issues,
    actions,
    metrics,
  }
}

export function parseLegacyTelemetryBody(body: string | null): { issues: TelemetryIssue[]; actions: string[] } {
  if (!body) return { issues: [], actions: [] }

  const issueMatch = body.match(/Issues:\s*(\[[\s\S]*?\])\s*(?:\n\n|$)/)
  let issues: TelemetryIssue[] = []
  if (issueMatch?.[1]) {
    try {
      issues = telemetryIssueList(JSON.parse(issueMatch[1]))
    } catch {
      issues = []
    }
  }

  const actionMatch = body.match(/Acoes sugeridas:\s*([\s\S]+)$/)
  const actions = actionMatch?.[1]
    ?.split('|')
    .map((entry) => entry.trim())
    .filter(Boolean) ?? []

  return { issues, actions }
}

export function telemetryIssueList(value: unknown): TelemetryIssue[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return []
    const key = textValue(entry.key)
    const severity = textValue(entry.severity)
    if (!key || !severity) return []
    return [{
      key,
      severity,
      value: entry.value,
      threshold: entry.threshold,
      summary: textValue(entry.summary),
    }]
  })
}

export function telemetryActionList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => textValue(entry)).filter((entry): entry is string => typeof entry === 'string')
}

export function telemetryMetricRefs(item: AtlasOperationalInboxItem): Array<{ name: string; value: unknown }> {
  const refs = item.context_bundle?.metric_refs
  if (!Array.isArray(refs)) return []
  return refs.flatMap((ref) => {
    if (!isRecord(ref)) return []
    const name = textValue(ref.name)
    if (!name) return []
    return [{ name, value: ref.value }]
  })
}

export function telemetryBreakdowns(value: unknown): Record<string, Array<Record<string, unknown>>> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).map(([key, rows]) => [
    key,
    Array.isArray(rows) ? rows.filter(isRecord) : [],
  ]))
}

export function whyReceivedText(report: TelemetryHealthReport): string {
  const message = textValue(report.whyReceived?.message)
    ?? 'O monitor automatico de telemetria abriu este item porque encontrou sinais fora do limite.'
  const scheduler = textValue(report.whyReceived?.scheduler)
  const cadence = textValue(report.whyReceived?.cadence)
  const notification = textValue(report.whyReceived?.notification_label)
    ?? notificationPolicyLabel(report.notificationPolicy)
  const parts = [message, notification ? `Notificacao: ${notification}` : null]

  if (scheduler || cadence) {
    parts.push(`Origem: ${scheduler ?? 'monitor de telemetria'}${cadence === 'hourly' ? ', roda de hora em hora' : ''}.`)
  }

  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join('\n')
}

export function notificationPolicyLabel(policy: Record<string, unknown> | null): string | null {
  const send = textValue(policy?.send)
  if (send === 'none') return 'sem push imediato; fica no Inbox e no relatorio da manha.'
  if (send === 'immediate') return 'push imediato porque o sinal pode afetar a operacao agora.'
  if (send === 'auto') return 'pode ser agrupado com outras atualizacoes.'
  return null
}

export function sampleConfidence(report: TelemetryHealthReport): string | null {
  return textValue(report.sample?.confidence)
}

export function sampleMessage(report: TelemetryHealthReport): string | null {
  return textValue(report.sample?.message)
}

export function telemetryPrimaryMetrics(report: TelemetryHealthReport): Array<{ name: string; value: unknown }> {
  const byName = new Map(report.metrics.map((metric) => [metric.name, metric.value]))
  const traces = numberMetric(report.metrics, 'traces')
  const unknownCostCount = numberMetric(report.metrics, 'unknown_cost_count')
  if (!byName.has('unknown_cost_rate') && traces && unknownCostCount != null) {
    byName.set('unknown_cost_rate', unknownCostCount / traces)
  }

  return [
    'traces',
    'final_quality_avg',
    'final_efficiency_avg',
    'first_pass_success_rate',
    'unknown_cost_rate',
    'total_latency_avg_ms',
    'app_visible_avg_ms',
  ].flatMap((name) => (byName.has(name) ? [{ name, value: byName.get(name) }] : []))
}

export function numberMetric(metrics: Array<{ name: string; value: unknown }>, name: string): number | null {
  const value = metrics.find((metric) => metric.name === name)?.value
  return numberValue(value)
}

export function numberValue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

export function scoreFromSummary(summary: string | null): number | null {
  const match = summary?.match(/score\s+(\d+(?:\.\d+)?)\/100/i)
  if (!match?.[1]) return null
  const score = Number(match[1])
  return Number.isFinite(score) ? score : null
}

export function windowLabelFromRecord(value: unknown): string | null {
  if (!isRecord(value)) return null
  const since = textValue(value.since)
  const until = textValue(value.until)
  if (!since || !until) return null
  const start = dateTimeLabel(since)
  const end = dateTimeLabel(until)
  return start && end ? `${start} ate ${end}` : null
}

export function metricLabel(key: string): string {
  switch (key) {
    case 'traces':
      return 'Traces analisados'
    case 'final_quality_avg':
      return 'Qualidade media'
    case 'final_efficiency_avg':
      return 'Eficiencia media'
    case 'context_efficiency_avg':
      return 'Eficiencia de contexto'
    case 'first_pass_success_rate':
      return 'First-pass'
    case 'unknown_cost_rate':
      return 'Custo desconhecido'
    case 'unknown_cost_count':
      return 'Traces sem custo'
    case 'low_quality_rate':
      return 'Baixa qualidade'
    case 'total_latency_avg_ms':
      return 'Latencia media'
    case 'app_visible_avg_ms':
      return 'Latencia visivel'
    case 'needed_remediation_rate':
      return 'Remediacao'
    case 'slow_trace_rate':
      return 'Traces lentas'
    default:
      return humanize(key)
  }
}

export function metricHint(key: string): string {
  switch (key) {
    case 'traces':
      return 'Tamanho da amostra usada no diagnostico.'
    case 'final_quality_avg':
      return 'Score medio de qualidade das respostas.'
    case 'final_efficiency_avg':
      return 'Score medio de eficiencia operacional.'
    case 'first_pass_success_rate':
      return 'Percentual que passou de primeira, sem retrabalho.'
    case 'unknown_cost_rate':
      return 'Parte das execucoes sem custo calculado.'
    case 'total_latency_avg_ms':
      return 'Tempo medio medido na execucao.'
    case 'app_visible_avg_ms':
      return 'Tempo percebido no app, quando existe evento mobile.'
    default:
      return 'Metrica de apoio para investigar o item.'
  }
}

export function formatMetricValue(key: string, value: unknown): string {
  const number = numberValue(value)
  if (number == null) return 'sem dado'
  if (key.endsWith('_rate') || key === 'first_pass_success_rate' || key === 'needed_remediation_rate') {
    return `${formatNumber(number * 100, 2)}%`
  }
  if (key.endsWith('_ms')) {
    return number >= 1000 ? `${formatNumber(number / 1000, 2)}s` : `${Math.round(number)}ms`
  }
  return formatNumber(number, 2)
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })
}

export function issueMeaning(issue: TelemetryIssue): string {
  switch (issue.key) {
    case 'final_quality_avg':
      return 'As respostas recentes ficaram abaixo do padrao esperado.'
    case 'final_efficiency_avg':
      return 'O Atlas esta usando mais esforco do que deveria para chegar ao resultado.'
    case 'first_pass_success_rate':
      return 'Poucas execucoes estao ficando boas na primeira tentativa.'
    case 'unknown_cost_rate':
      return 'A telemetria nao consegue calcular custo com confianca para essa janela.'
    case 'low_quality_rate':
      return 'Uma parte alta das execucoes recentes recebeu score baixo.'
    case 'slow_trace_rate':
    case 'app_visible_avg_ms':
      return 'A experiencia pode parecer lenta para quem usa o app.'
    default:
      return issue.summary ?? 'Sinal fora do limite configurado.'
  }
}

export function translateTelemetryAction(action: string): string {
  if (action.startsWith('Open recent low-score traces')) {
    return 'Abrir traces recentes com score baixo e revisar prompt, contexto e provider antes de mudar comportamento.'
  }
  if (action.startsWith('Configure operational estimate cost rates')) {
    return action
      .replace('Configure operational estimate cost rates for ', 'Configurar taxas estimadas de custo para ')
      .replace(' and rerun telemetry rollup.', ' e rodar o rollup de telemetria novamente.')
  }
  if (action.startsWith('Fix provider/model attribution')) {
    return 'Corrigir a atribuicao de provider/model nos traces com custo desconhecido antes de importar taxas.'
  }
  if (action.startsWith('Review quality flags')) {
    return 'Revisar flags de qualidade e feedback humano recente; ajustar selecao de contexto ou politica de resposta primeiro.'
  }
  if (action.startsWith('Check queue wait')) {
    return 'Separar tempo de fila, latencia do provider e eventos de visibilidade no app para descobrir onde o tempo esta sendo gasto.'
  }
  if (action.startsWith('Compare first-pass failures')) {
    return 'Comparar falhas de first-pass com traces bem-sucedidos por tipo de tarefa e provider.'
  }
  return action
}
