import type {
  AtlasMemoryQuality,
  AtlasMemoryQualityHistory,
  AtlasMemoryQualityTrend,
  AtlasMemoryQualityTrendDriver,
  AtlasMemoryMaintenance,
  AtlasMemoryRecall,
  AtlasMemoryRecallItem,
  AtlasOpenBrainAudit,
  AtlasOpenBrainContextPack,
} from './api/client'

export function openBrainRecallSummary(recall: AtlasMemoryRecall | null): string {
  if (!recall) return 'recall ainda não executado'

  const summary = recall.summary ?? {}
  const count = nonNegative(summary.recall_count ?? recall.recall?.length)
  const policy = String(summary.policy ?? 'provider_safe_only')
  const budget = nonNegative(summary.budget_chars)

  return `${count} ${plural(count, 'memória', 'memórias')} · ${policy} · ${budget} chars`
}

export function openBrainRecallItemTitle(item: AtlasMemoryRecallItem): string {
  return String(item.title || item.summary || item.type || item.source || 'memória')
}

export function openBrainRecallItemBody(item: AtlasMemoryRecallItem): string {
  return String(item.excerpt || item.body || item.snippet || item.summary || item.reason || '')
}

export function openBrainContextPackSummary(pack: AtlasOpenBrainContextPack | null): string {
  if (!pack) return 'context pack ainda não gerado'

  const summary = pack.summary ?? {}
  const refs = nonNegative(summary.context_refs_count)
  const memory = nonNegative(summary.memory_refs_count)
  const recall = nonNegative(summary.recall_count)

  return `${refs} refs · ${memory} memórias · ${recall} recall · ${pack.context_pack_hash.slice(0, 10)}`
}

export function openBrainContextPackCopyText(pack: AtlasOpenBrainContextPack | null): string {
  if (!pack) return ''
  if (pack.prompt_section && pack.prompt_section.trim() !== '') return pack.prompt_section

  return JSON.stringify(pack.context_pack, null, 2)
}

export function openBrainAuditLine(audit: AtlasOpenBrainAudit): string {
  const requester = audit.requester ? ` · ${audit.requester}` : ''
  const provider = audit.provider_safe ? 'provider-safe' : 'revisar'

  return `${audit.surface}${requester} · ${audit.status} · ${provider}`
}

export function openBrainMaintenanceLine(maintenance: AtlasMemoryMaintenance | null): string {
  if (!maintenance) return 'manutenção ainda não executada'

  const health = String(maintenance.stages.mcp_health?.overall_status ?? maintenance.status ?? 'unknown')
  const projection = String(maintenance.stages.provider_projection_status?.status ?? 'unknown')
  const docs = stageLabel(maintenance.stages.knowledge_sync)
  const code = stageLabel(maintenance.stages.code_index)

  return `${health} · docs ${docs} · code ${code} · projection ${projection}`
}

export function openBrainMemoryQualityLine(quality: AtlasMemoryQuality | null): string {
  if (!quality) return 'scorecard ainda não carregado'

  const score = nonNegative(quality.score)
  const trend = openBrainTrendLabel(quality.trend)
  const active = nonNegative(valueAt(quality.counts, 'active'))
  const providerSafe = nonNegative(valueAt(quality.counts, 'provider_safe_active'))

  return `${quality.status} · score ${score} · ${trend} · ${providerSafe}/${active} provider-safe`
}

export function openBrainQualityHistoryLine(history: AtlasMemoryQualityHistory | null): string {
  if (!history) return 'histórico ainda não carregado'

  const total = nonNegative(history.summary?.total)
  const latest = numericOrDash(history.summary?.latest_score)
  const delta = signedNumber(history.summary?.score_delta)
  const trend = String(history.summary?.trend_status ?? history.status ?? 'unknown')

  return `${total} snapshots · latest ${latest} · delta ${delta} · ${trend}`
}

export function openBrainTrendLabel(trend: AtlasMemoryQualityTrend | null | undefined): string {
  if (!trend) return 'trend unknown'

  const status = String(trend.status ?? 'unknown')
  const delta = signedNumber(trend.current_delta_from_latest)

  return `trend ${status} (${delta})`
}

export function openBrainTrendDriverLine(driver: AtlasMemoryQualityTrendDriver): string {
  const key = String(driver.key ?? driver.kind ?? 'driver')
  const delta = signedNumber(driver.delta)
  const current = numericOrDash(driver.current)
  const previous = numericOrDash(driver.previous)

  return `${key} ${delta} · ${previous} → ${current}`
}

function stageLabel(stage: { ok?: boolean; status?: string } | undefined): string {
  if (!stage) return 'unknown'
  if (stage.status === 'skipped') return 'skipped'

  return stage.ok === false ? 'failed' : 'ok'
}

function nonNegative(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0

  return Math.max(0, Math.floor(value))
}

function numericOrDash(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value)) : '-'
}

function signedNumber(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a'
  if (value > 0) return `+${Math.round(value)}`

  return String(Math.round(value))
}

function valueAt(source: unknown, path: string): unknown {
  if (!source || typeof source !== 'object') return undefined
  let current: unknown = source
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object' || !(part in current)) return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

function plural(count: number, singular: string, pluralLabel: string): string {
  return count === 1 ? singular : pluralLabel
}
