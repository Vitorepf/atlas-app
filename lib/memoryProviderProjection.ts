import type {
  AtlasMemoryProviderProjection,
  AtlasMemoryProviderProjectionAudit,
  AtlasMemoryProviderProjectionAuditParams,
  AtlasMemoryProviderProjectionAuditPurge,
  AtlasMemoryProviderProjectionAuditSummary,
  AtlasMemoryProviderProjectionAuditSummaryParams,
  AtlasMemoryProviderProjectionItem,
  AtlasMemoryProviderProjectionTarget,
  PurgeAtlasMemoryProviderProjectionAuditInput,
} from './api/client'

export const PROVIDER_PROJECTION_TARGET_OPTIONS: Array<{
  key: AtlasMemoryProviderProjectionTarget
  label: string
}> = [
  { key: 'all', label: 'Todos' },
  { key: 'claude', label: 'Claude' },
  { key: 'agents', label: 'Agents' },
]

export const PROVIDER_PROJECTION_COLLAPSED_DIFF_LINES = 10
export const PROVIDER_PROJECTION_EXPANDED_DIFF_LINES = 80
export const PROVIDER_PROJECTION_AUDIT_SUMMARY_DAYS = 30
export const PROVIDER_PROJECTION_AUDIT_RETENTION_DAYS = 90

export type ProviderProjectionDiffLineKind = 'addition' | 'removal' | 'hunk' | 'file' | 'context'
export type ProviderProjectionAuditResultFilter = 'all' | 'applied' | 'blocked'
export type ProviderProjectionAuditInitiatorFilter = 'all' | 'api' | 'cli'

export const PROVIDER_PROJECTION_AUDIT_RESULT_OPTIONS: Array<{
  key: ProviderProjectionAuditResultFilter
  label: string
}> = [
  { key: 'all', label: 'Todos' },
  { key: 'applied', label: 'Aplicados' },
  { key: 'blocked', label: 'Bloqueados' },
]

export const PROVIDER_PROJECTION_AUDIT_INITIATOR_OPTIONS: Array<{
  key: ProviderProjectionAuditInitiatorFilter
  label: string
}> = [
  { key: 'all', label: 'Todas' },
  { key: 'api', label: 'API' },
  { key: 'cli', label: 'CLI' },
]

export function projectionSummaryNumber(summary: AtlasMemoryProviderProjection['summary'], key: string): number {
  const value = summary[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function providerProjectionManualDriftCount(summary: AtlasMemoryProviderProjection['summary']): number {
  return projectionSummaryNumber(summary, 'manual_drift') + projectionSummaryNumber(summary, 'blocked')
}

export function providerProjectionApplicableCount(summary: AtlasMemoryProviderProjection['summary']): number {
  return projectionSummaryNumber(summary, 'applicable')
    || projectionSummaryNumber(summary, 'create')
    + projectionSummaryNumber(summary, 'update')
    + projectionSummaryNumber(summary, 'adopt')
}

export function providerProjectionCanApply(projection: AtlasMemoryProviderProjection | null, reviewMode: boolean): boolean {
  if (!projection || !reviewMode) return false

  const summary = projection.summary ?? {}
  return providerProjectionApplicableCount(summary) > 0
    && providerProjectionManualDriftCount(summary) === 0
}

export function providerProjectionItems(projection: AtlasMemoryProviderProjection | null): AtlasMemoryProviderProjectionItem[] {
  if (!projection) return []

  return projection.projections ?? projection.review?.projections ?? []
}

export function providerProjectionSummaryLine(summary: AtlasMemoryProviderProjection['summary']): string {
  const parts = [
    projectionCountLabel(projectionSummaryNumber(summary, 'ready'), 'pronto'),
    projectionCountLabel(projectionSummaryNumber(summary, 'missing'), 'ausente'),
    projectionCountLabel(projectionSummaryNumber(summary, 'unmanaged'), 'não gerenciado'),
    projectionCountLabel(projectionSummaryNumber(summary, 'stale'), 'stale'),
    projectionCountLabel(projectionSummaryNumber(summary, 'manual_drift'), 'drift manual'),
    projectionCountLabel(projectionSummaryNumber(summary, 'create'), 'criação'),
    projectionCountLabel(projectionSummaryNumber(summary, 'update'), 'atualização'),
    projectionCountLabel(projectionSummaryNumber(summary, 'adopt'), 'adoção'),
    projectionCountLabel(projectionSummaryNumber(summary, 'applied'), 'aplicado'),
    projectionCountLabel(projectionSummaryNumber(summary, 'blocked'), 'bloqueado'),
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' · ') : `${projectionSummaryNumber(summary, 'total')} arquivo(s)`
}

export function providerProjectionFileLine(
  file: AtlasMemoryProviderProjectionItem,
  clip: (value: string, max: number) => string = defaultClip,
): string {
  const status = providerProjectionChangeLabel(file)
  const memoryCount = typeof file.memory_count === 'number' ? ` · ${file.memory_count} memória(s)` : ''
  const diffCount = typeof file.diff_line_count === 'number' && file.diff_line_count > 0 ? ` · diff ${file.diff_line_count}` : ''
  const path = file.path ? clip(file.path, 84) : '-'

  return `${status}${memoryCount}${diffCount} · ${path}`
}

export function providerProjectionChangeLabel(file: AtlasMemoryProviderProjectionItem): string {
  if (file.change_type && file.change_type !== 'none') return file.change_type
  if (file.manual_drift) return 'manual_drift'
  if (file.stale) return 'stale'
  if (file.exists === false) return 'missing'
  if (file.managed === false) return 'unmanaged'
  if (file.written === true) return 'written'
  if (file.error) return file.error

  return 'ok'
}

export function providerProjectionDiffPreview(
  file: AtlasMemoryProviderProjectionItem,
  maxLines = 12,
): { lines: string[]; hidden: number } {
  const diff = typeof file.diff === 'string' ? file.diff.trim() : ''
  if (!diff) return { lines: [], hidden: 0 }

  const lines = diff
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
  const safeLimit = Math.max(1, Math.trunc(maxLines))

  return {
    lines: lines.slice(0, safeLimit),
    hidden: Math.max(0, lines.length - safeLimit),
  }
}

export function providerProjectionDiffReview(
  file: AtlasMemoryProviderProjectionItem,
  expanded: boolean,
): { lines: string[]; hidden: number; expanded: boolean; key: string } {
  return {
    ...providerProjectionDiffPreview(
      file,
      expanded ? PROVIDER_PROJECTION_EXPANDED_DIFF_LINES : PROVIDER_PROJECTION_COLLAPSED_DIFF_LINES,
    ),
    expanded,
    key: providerProjectionDiffKey(file),
  }
}

export function providerProjectionDiffKey(file: AtlasMemoryProviderProjectionItem): string {
  return [
    file.target,
    file.path,
    file.change_type,
    file.diff_line_count,
  ].filter((value): value is string | number => value !== null && value !== undefined && value !== '').join(':')
}

export function providerProjectionDiffToggleLabel(expanded: boolean, hidden: number): string {
  return expanded ? 'Recolher' : hidden > 0 ? 'Expandir' : 'Completo'
}

export function providerProjectionDiffLineKind(line: string): ProviderProjectionDiffLineKind {
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('+++') || line.startsWith('---')) return 'file'
  if (line.startsWith('+')) return 'addition'
  if (line.startsWith('-')) return 'removal'

  return 'context'
}

export function providerProjectionAuditStatusLabel(audit: AtlasMemoryProviderProjectionAudit): string {
  if (audit.ok) return 'aplicado'
  if (projectionSummaryNumber(audit.summary ?? {}, 'manual_drift') > 0) return 'bloqueado por drift'
  if (projectionSummaryNumber(audit.summary ?? {}, 'blocked') > 0) return 'bloqueado'
  if (audit.status === 'confirmation_required') return 'aguardando confirmação'
  if (audit.status === 'cancelled') return 'cancelado'

  return audit.status || 'registrado'
}

export function providerProjectionAuditSummaryLine(audit: AtlasMemoryProviderProjectionAudit): string {
  const summary = audit.summary ?? {}
  const line = providerProjectionSummaryLine(summary)

  return line === '0 arquivo(s)' ? providerProjectionAuditStatusLabel(audit) : line
}

export function providerProjectionAuditItems(audit: AtlasMemoryProviderProjectionAudit): AtlasMemoryProviderProjectionItem[] {
  return [
    ...(audit.applied ?? []),
    ...(audit.blocked ?? []),
    ...(audit.failed ?? []),
  ]
}

export function providerProjectionAuditMetaLine(audit: AtlasMemoryProviderProjectionAudit): string {
  return [
    audit.initiator,
    audit.confirmation_mode,
    providerProjectionAuditTimeLabel(audit.applied_at),
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0).join(' · ')
}

export function providerProjectionAuditTimeLabel(value: string | null | undefined): string {
  if (!value) return 'sem data'

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (match) return `${match[3]}/${match[2]} ${match[4]}:${match[5]}`

  return value.slice(0, 16)
}

export function providerProjectionAuditQuery(
  target: AtlasMemoryProviderProjectionTarget,
  result: ProviderProjectionAuditResultFilter,
  initiator: ProviderProjectionAuditInitiatorFilter,
  limit = 5,
): AtlasMemoryProviderProjectionAuditParams {
  return {
    target,
    limit,
    ...(result === 'applied' ? { ok: true } : {}),
    ...(result === 'blocked' ? { ok: false } : {}),
    ...(initiator !== 'all' ? { initiator } : {}),
  }
}

export function providerProjectionAuditSummaryQuery(
  target: AtlasMemoryProviderProjectionTarget,
  result: ProviderProjectionAuditResultFilter,
  initiator: ProviderProjectionAuditInitiatorFilter,
  days = PROVIDER_PROJECTION_AUDIT_SUMMARY_DAYS,
): AtlasMemoryProviderProjectionAuditSummaryParams {
  const { limit: _limit, ...filters } = providerProjectionAuditQuery(target, result, initiator, 1)

  return {
    ...filters,
    days,
  }
}

export function providerProjectionAuditPurgeInput(
  target: AtlasMemoryProviderProjectionTarget,
  result: ProviderProjectionAuditResultFilter,
  initiator: ProviderProjectionAuditInitiatorFilter,
  dryRun = true,
  confirm = false,
  olderThanDays = PROVIDER_PROJECTION_AUDIT_RETENTION_DAYS,
): PurgeAtlasMemoryProviderProjectionAuditInput {
  const { limit: _limit, ...filters } = providerProjectionAuditQuery(target, result, initiator, 1)

  return {
    ...filters,
    older_than_days: olderThanDays,
    dry_run: dryRun,
    confirm,
  }
}

export function providerProjectionAuditPurgeCanApply(
  purge: AtlasMemoryProviderProjectionAuditPurge | null,
  target: AtlasMemoryProviderProjectionTarget,
  result: ProviderProjectionAuditResultFilter,
  initiator: ProviderProjectionAuditInitiatorFilter,
): boolean {
  if (!purge || !purge.dry_run || purge.matched <= 0) return false

  return providerProjectionAuditPurgeFiltersMatch(purge, target, result, initiator)
}

export function providerProjectionAuditPurgePolicyLine(
  purge: AtlasMemoryProviderProjectionAuditPurge | null,
  target: AtlasMemoryProviderProjectionTarget,
  result: ProviderProjectionAuditResultFilter,
  initiator: ProviderProjectionAuditInitiatorFilter,
): string {
  if (!purge) return 'Simule antes de aplicar'
  if (!purge.dry_run) return 'Simule novamente apos remocao'
  if (!providerProjectionAuditPurgeFiltersMatch(purge, target, result, initiator)) return 'Filtros mudaram; simule novamente'
  if (purge.matched <= 0) return 'Nenhuma auditoria antiga encontrada'

  return 'Dry-run valido para aplicar'
}

export function providerProjectionAuditFilterLine(
  result: ProviderProjectionAuditResultFilter,
  initiator: ProviderProjectionAuditInitiatorFilter,
): string {
  const resultLabel = PROVIDER_PROJECTION_AUDIT_RESULT_OPTIONS.find((option) => option.key === result)?.label ?? result
  const initiatorLabel = PROVIDER_PROJECTION_AUDIT_INITIATOR_OPTIONS.find((option) => option.key === initiator)?.label ?? initiator

  return `${resultLabel} · ${initiatorLabel}`
}

export function providerProjectionAuditOverviewLine(summary: AtlasMemoryProviderProjectionAuditSummary | null): string {
  if (!summary) return 'Sem resumo carregado'

  return `${summary.total} evento(s) · ${summary.applied} aplicado(s) · ${summary.blocked} bloqueado(s)`
}

export function providerProjectionAuditOverviewPeriodLine(summary: AtlasMemoryProviderProjectionAuditSummary | null): string {
  if (!summary) return `${PROVIDER_PROJECTION_AUDIT_SUMMARY_DAYS} dias`

  return `${summary.period_days} dias · desde ${providerProjectionAuditTimeLabel(summary.since_at)}`
}

export function providerProjectionAuditPurgeLine(purge: AtlasMemoryProviderProjectionAuditPurge | null): string {
  if (!purge) return `Simulação padrão: ${PROVIDER_PROJECTION_AUDIT_RETENTION_DAYS} dias`

  const action = purge.dry_run ? 'simulação' : 'remoção'

  return `${action} · ${purge.matched} encontrado(s) · ${purge.deleted} removido(s)`
}

function providerProjectionAuditPurgeFiltersMatch(
  purge: AtlasMemoryProviderProjectionAuditPurge,
  target: AtlasMemoryProviderProjectionTarget,
  result: ProviderProjectionAuditResultFilter,
  initiator: ProviderProjectionAuditInitiatorFilter,
): boolean {
  const expected = providerProjectionAuditPurgeInput(target, result, initiator)
  const filters = purge.filters ?? {}

  return filterValueMatches(filters, 'target', expected.target)
    && filterValueMatches(filters, 'ok', expected.ok)
    && filterValueMatches(filters, 'initiator', expected.initiator)
}

function filterValueMatches(filters: Record<string, unknown>, key: string, expected: unknown): boolean {
  if (expected === undefined || expected === null) return filters[key] === undefined || filters[key] === null

  return filters[key] === expected
}

function projectionCountLabel(count: number, label: string): string | null {
  return count > 0 ? `${count} ${label}` : null
}

function defaultClip(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 3))}...`
}
