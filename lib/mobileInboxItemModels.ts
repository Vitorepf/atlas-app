import type { AtlasInboxAction, AtlasOperationalInboxItem } from './api/client'
import type { usePalette } from '../design/theme'

export type { AtlasInboxAction }

export type DetailRow = {
  label: string
  value: string | null
}

export type ContextBundle = NonNullable<AtlasOperationalInboxItem['context_bundle']>
export type RefGroup = {
  key: keyof Pick<ContextBundle, 'source_refs' | 'trace_refs' | 'job_refs' | 'metric_refs' | 'file_refs' | 'diff_refs'>
  label: string
}

export const REF_GROUPS: RefGroup[] = [
  { key: 'source_refs', label: 'Fontes' },
  { key: 'trace_refs', label: 'Traces' },
  { key: 'job_refs', label: 'Jobs' },
  { key: 'metric_refs', label: 'Metricas' },
  { key: 'file_refs', label: 'Arquivos' },
  { key: 'diff_refs', label: 'Diffs' },
]

export const SNOOZE_CHOICES: Array<{ key: string; label: string; days: number; reason: string }> = [
  { key: 'tomorrow', label: 'Amanha', days: 1, reason: 'Item operacional adiado para revisao amanha.' },
  { key: 'week', label: '7 dias', days: 7, reason: 'Item operacional adiado por sete dias.' },
  { key: 'month', label: '30 dias', days: 30, reason: 'Item operacional adiado por trinta dias.' },
]

export function detailsForItem(item: AtlasOperationalInboxItem): DetailRow[] {
  const payload = item.payload ?? {}
  const reportRows = detailsForReport(payload.report)

  if (reportRows.length > 0) {
    return reportRows
  }

  const recommendationRows = detailsForRecommendation(payload.recommendation)
  if (recommendationRows.length > 0) {
    return recommendationRows
  }

  if (item.type === 'proposal') {
    return [
      { label: 'O que encontrou', value: payloadText(payload, 'finding') ?? item.summary },
      { label: 'Problema', value: payloadText(payload, 'problem') },
      { label: 'Solucao', value: payloadText(payload, 'solution') },
      { label: 'Vale a pena', value: payloadText(payload, 'worth_it') },
      { label: 'Alternativas', value: listText(payload.alternatives) },
      { label: 'Branch', value: payloadText(payload, 'branch') },
      { label: 'Politica', value: compactJson(payload.policy, 360) },
    ].filter((row) => row.value)
  }

  if (item.type === 'self_diagnostic') {
    return [
      { label: 'Observacao', value: payloadText(payload, 'observation') },
      { label: 'Hipotese', value: payloadText(payload, 'hypothesis') },
      { label: 'Correcao proposta', value: payloadText(payload, 'proposed_fix') },
      { label: 'Metricas', value: compactJson(payload.metrics, 520) },
      { label: 'Proposta criada', value: payloadText(payload, 'proposal_inbox_item_id') },
      { label: 'Ignorado ate', value: dateTimeLabel(payloadText(payload, 'ignored_until')) },
    ].filter((row) => row.value)
  }

  if (item.type === 'job_result' || item.type === 'job_status') {
    return [
      { label: 'Status', value: payloadText(payload, 'status') },
      { label: 'Importancia', value: payloadText(payload, 'importance') },
      { label: 'Kind', value: payloadText(payload, 'kind') },
      { label: 'Provider', value: payloadText(payload, 'provider') },
      { label: 'Model', value: payloadText(payload, 'model') },
      { label: 'Duracao', value: durationText(payload.duration_ms) },
      { label: 'Erro', value: [payloadText(payload, 'error_code'), payloadText(payload, 'error_message')].filter(Boolean).join(' - ') || null },
      { label: 'Job', value: payloadText(payload, 'job_id') },
      { label: 'Trace', value: payloadText(payload, 'trace_id') },
    ].filter((row) => row.value)
  }

  if (item.type === 'insight') {
    return [
      { label: 'Categoria', value: payloadText(payload, 'category') ?? item.category },
      { label: 'Tipo', value: payloadText(payload, 'insight_kind') },
      { label: 'Confianca', value: payloadNumber(payload.confidence, true) },
    ].filter((row) => row.value)
  }

  return Object.entries(payload)
    .slice(0, 8)
    .map(([label, value]) => ({ label: humanize(label), value: valueToText(value) }))
    .filter((row) => row.value)
}

export function detailTitle(type: string): string {
  switch (type) {
    case 'proposal':
      return 'Proposta'
    case 'self_diagnostic':
      return 'Auto-diagnostico'
    case 'job_result':
    case 'job_status':
      return 'Resultado do job'
    case 'insight':
      return 'Insight'
    default:
      return 'Detalhes'
  }
}

export function detailsForReport(value: unknown): DetailRow[] {
  if (!isRecord(value)) return []

  return [
    { label: 'Decisao', value: textValue(value.decision) },
    { label: 'Achados', value: listText(value.highlights) },
    { label: 'Proximas acoes', value: listText(value.next_actions) },
    { label: 'Riscos', value: listText(value.risks) },
    { label: 'Validacao', value: compactJson(value.validation, 520) },
    { label: 'Relatorio', value: textValue(value.full_text) },
  ].filter((row) => row.value)
}

export function detailsForRecommendation(value: unknown): DetailRow[] {
  if (!isRecord(value)) return []

  return [
    { label: 'Estado', value: textValue(value.state) },
    { label: 'Tipo', value: textValue(value.kind) },
    { label: 'Metrica alvo', value: textValue(value.target_metric) },
    { label: 'Dimensao', value: compactJson(value.target_dimension, 360) },
    { label: 'Impacto esperado', value: recommendationImpactText(value.expected_impact) },
    { label: 'Baseline', value: compactJson(value.baseline_snapshot, 420) },
    { label: 'Impacto observado', value: compactJson(value.observed_impact, 420) },
    { label: 'Medicao', value: measurementText(value) },
    { label: 'Adiada ate', value: dateTimeLabel(textValue(value.snoozed_until)) },
    { label: 'Fechada em', value: dateTimeLabel(textValue(value.closed_at)) },
    { label: 'Motivo de fechamento', value: textValue(value.closed_reason) },
    { label: 'Prioridade', value: payloadNumber(value.priority_score) },
  ].filter((row) => row.value)
}

export function threadIdFromActionResult(result: Record<string, unknown>): string | null {
  const threadId = result.thread_id
  if (typeof threadId === 'string' && threadId !== '') return threadId

  const deepLink = result.deep_link
  if (typeof deepLink !== 'string') return null

  const match = deepLink.match(/^atlas:\/\/thread\/([^/?#]+)/)
  return match?.[1] ?? null
}

export function actionMessage(actionId: string, result: Record<string, unknown>): string {
  if (actionId === 'create_proposal' && typeof result.proposal_item_id === 'string') return 'proposta criada no Inbox'
  if (actionId === 'ignore_30d') return 'auto-diagnostico ignorado por 30 dias'
  if (actionId === 'acknowledge_recommendation') return 'recomendacao reconhecida'
  if (actionId === 'apply_recommendation') return 'recomendacao marcada como aplicada'
  if (actionId === 'reject_recommendation') return 'recomendacao rejeitada'
  if (actionId === 'review_patch') return 'proposta marcada para revisao'
  if (actionId === 'view_trace') return 'trace marcado para revisao'
  if (actionId === 'mark_read') return 'marcado como lido'
  return 'acao aplicada'
}

export function payloadText(payload: Record<string, unknown>, key: string): string | null {
  return textValue(payload[key])
}

export function textValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

export function valueToText(value: unknown): string | null {
  return textValue(value) ?? listText(value) ?? compactJson(value, 420)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function listText(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null
  return value.map((entry) => textValue(entry) ?? compactJson(entry, 180)).join('\n')
}

export function payloadNumber(value: unknown, percent = false): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return percent ? `${Math.round(value * 100)}%` : String(value)
}

export function recommendationImpactText(value: unknown): string | null {
  if (!isRecord(value)) return null
  const parts = [
    textValue(value.direction),
    payloadNumber(value.magnitude, true),
    textValue(value.rationale),
  ].filter((part): part is string => typeof part === 'string' && part.length > 0)

  return parts.length > 0 ? parts.join(' - ') : compactJson(value, 360)
}

export function measurementText(value: Record<string, unknown>): string | null {
  const dueAt = dateTimeLabel(textValue(value.measurement_due_at))
  const windowDays = payloadNumber(value.measurement_window_days)
  const parts = [
    windowDays ? `${windowDays} dias` : null,
    dueAt ? `proxima: ${dueAt}` : null,
  ].filter((part): part is string => typeof part === 'string')

  return parts.length > 0 ? parts.join(' - ') : null
}

export function durationText(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < 1000) return `${Math.round(value)}ms`
  return `${(value / 1000).toFixed(1)}s`
}

export function compactJson(value: unknown, limit = 320): string | null {
  if (value == null) return null
  try {
    const text = JSON.stringify(value, null, 2)
    return text.length > limit ? `${text.slice(0, limit - 3)}...` : text
  } catch {
    return String(value)
  }
}

export function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function typeLabel(type: string): string {
  switch (type) {
    case 'self_diagnostic':
      return 'auto-diagnostico'
    case 'job_result':
      return 'job'
    case 'thread_update':
      return 'thread'
    default:
      return type.replace(/_/g, ' ')
  }
}

export function dateLabel(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function dateTimeLabel(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function daysFromNowIso(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export function severityColor(severity: string, c: ReturnType<typeof usePalette>, soft = false): string {
  if (severity === 'critical' || severity === 'warning') return soft ? `${c.recRed}18` : c.recRed
  return soft ? c.surface : c.ink3
}
