import { atlasStorage } from './storage'

export type ReviewAreaFilter = 'all' | 'memory_privacy' | 'verbatim_privacy' | 'relation'
export type ReviewSeverityFilter = 'all' | 'high' | 'medium' | 'low'
export type ReviewPrivacyFilter = 'all' | 'normal' | 'private' | 'sensitive' | 'secret'

export type ReviewFilters = {
  area: ReviewAreaFilter
  severity: ReviewSeverityFilter
  privacyClass: ReviewPrivacyFilter
  scopeType: string
  scopeId: string
  projectId: string
  taskId: string
  engineeringRunId: string
  includeUnreviewed: boolean
  includeInactive: boolean
}

export const MEMORY_REVIEW_FILTERS_STORAGE_KEY = 'atlas-memory.review-filters.v1'

export const DEFAULT_REVIEW_FILTERS: ReviewFilters = {
  area: 'all',
  severity: 'all',
  privacyClass: 'all',
  scopeType: '',
  scopeId: '',
  projectId: '',
  taskId: '',
  engineeringRunId: '',
  includeUnreviewed: false,
  includeInactive: false,
}

export const REVIEW_AREA_OPTIONS: Array<{ key: ReviewAreaFilter; label: string }> = [
  { key: 'all', label: 'Tudo' },
  { key: 'memory_privacy', label: 'Registry' },
  { key: 'verbatim_privacy', label: 'Verbatim' },
  { key: 'relation', label: 'Relações' },
]

export const REVIEW_SEVERITY_OPTIONS: Array<{ key: ReviewSeverityFilter; label: string }> = [
  { key: 'all', label: 'Todas' },
  { key: 'high', label: 'Alta' },
  { key: 'medium', label: 'Média' },
  { key: 'low', label: 'Baixa' },
]

export const REVIEW_PRIVACY_OPTIONS: Array<{ key: ReviewPrivacyFilter; label: string }> = [
  { key: 'all', label: 'Todas' },
  { key: 'private', label: 'Privada' },
  { key: 'sensitive', label: 'Sensível' },
  { key: 'secret', label: 'Secreta' },
  { key: 'normal', label: 'Normal' },
]

type FilterParams = Record<string, unknown>

export function normalizeReviewFilters(filters: ReviewFilters): ReviewFilters {
  return {
    area: validArea(filters.area),
    severity: validSeverity(filters.severity),
    privacyClass: validPrivacy(filters.privacyClass),
    scopeType: filters.scopeType.trim(),
    scopeId: filters.scopeId.trim(),
    projectId: filters.projectId.trim(),
    taskId: filters.taskId.trim(),
    engineeringRunId: filters.engineeringRunId.trim(),
    includeUnreviewed: Boolean(filters.includeUnreviewed),
    includeInactive: Boolean(filters.includeInactive),
  }
}

export function memoryReviewFiltersFromParams(params: FilterParams): ReviewFilters {
  return normalizeReviewFilters({
    ...DEFAULT_REVIEW_FILTERS,
    area: validArea(stringParam(params.area) ?? stringParam(params.review_area) ?? DEFAULT_REVIEW_FILTERS.area),
    severity: validSeverity(stringParam(params.severity) ?? DEFAULT_REVIEW_FILTERS.severity),
    privacyClass: validPrivacy(stringParam(params.privacy) ?? stringParam(params.privacy_class) ?? DEFAULT_REVIEW_FILTERS.privacyClass),
    scopeType: stringParam(params.scope_type) ?? stringParam(params.scopeType) ?? '',
    scopeId: stringParam(params.scope_id) ?? stringParam(params.scopeId) ?? '',
    projectId: stringParam(params.project_id) ?? stringParam(params.projectId) ?? '',
    taskId: stringParam(params.task_id) ?? stringParam(params.taskId) ?? '',
    engineeringRunId: stringParam(params.engineering_run_id) ?? stringParam(params.run_id) ?? stringParam(params.engineeringRunId) ?? '',
    includeUnreviewed: boolParam(params.include_unreviewed) ?? boolParam(params.unreviewed) ?? false,
    includeInactive: boolParam(params.include_inactive) ?? boolParam(params.inactive) ?? false,
  })
}

export function memoryReviewFiltersToParams(filters: ReviewFilters): Record<string, string> {
  const normalized = normalizeReviewFilters(filters)
  const params: Record<string, string> = {}
  if (normalized.area !== DEFAULT_REVIEW_FILTERS.area) params.area = normalized.area
  if (normalized.severity !== DEFAULT_REVIEW_FILTERS.severity) params.severity = normalized.severity
  if (normalized.privacyClass !== DEFAULT_REVIEW_FILTERS.privacyClass) params.privacy_class = normalized.privacyClass
  if (normalized.scopeType) params.scope_type = normalized.scopeType
  if (normalized.scopeId) params.scope_id = normalized.scopeId
  if (normalized.projectId) params.project_id = normalized.projectId
  if (normalized.taskId) params.task_id = normalized.taskId
  if (normalized.engineeringRunId) params.engineering_run_id = normalized.engineeringRunId
  if (normalized.includeUnreviewed) params.include_unreviewed = '1'
  if (normalized.includeInactive) params.include_inactive = '1'

  return params
}

export function loadSavedMemoryReviewFilters(): ReviewFilters | null {
  const raw = atlasStorage.getItemSync(MEMORY_REVIEW_FILTERS_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<ReviewFilters>
    return normalizeReviewFilters({
      ...DEFAULT_REVIEW_FILTERS,
      ...parsed,
    })
  } catch {
    return null
  }
}

export async function saveMemoryReviewFilters(filters: ReviewFilters): Promise<void> {
  await atlasStorage.setItem(
    MEMORY_REVIEW_FILTERS_STORAGE_KEY,
    JSON.stringify(normalizeReviewFilters(filters)),
  )
}

export async function clearSavedMemoryReviewFilters(): Promise<void> {
  await atlasStorage.removeItem(MEMORY_REVIEW_FILTERS_STORAGE_KEY)
}

export function sameReviewFilters(left: ReviewFilters, right: ReviewFilters): boolean {
  return JSON.stringify(normalizeReviewFilters(left)) === JSON.stringify(normalizeReviewFilters(right))
}

export function hasActiveReviewFilters(filters: ReviewFilters): boolean {
  return !sameReviewFilters(filters, DEFAULT_REVIEW_FILTERS)
}

function stringParam(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null
}

function boolParam(value: unknown): boolean | null {
  const raw = stringParam(value)
  if (raw == null) return null
  if (['1', 'true', 'yes', 'sim'].includes(raw.toLowerCase())) return true
  if (['0', 'false', 'no', 'nao', 'não'].includes(raw.toLowerCase())) return false

  return null
}

function validArea(value: unknown): ReviewAreaFilter {
  return REVIEW_AREA_OPTIONS.some((option) => option.key === value) ? value as ReviewAreaFilter : 'all'
}

function validSeverity(value: unknown): ReviewSeverityFilter {
  return REVIEW_SEVERITY_OPTIONS.some((option) => option.key === value) ? value as ReviewSeverityFilter : 'all'
}

function validPrivacy(value: unknown): ReviewPrivacyFilter {
  return REVIEW_PRIVACY_OPTIONS.some((option) => option.key === value) ? value as ReviewPrivacyFilter : 'all'
}
