import type {
  AtlasAiJob,
  AtlasAiQualityAction,
  AtlasAiSessionState,
  AtlasAiStatus,
  AtlasAiTrace,
} from './api/client'

export const TRACE_HISTORY_LIMIT = 48

export type AtlasAiTurnFilter = 'all' | 'pinned' | 'decisions' | 'actions' | 'dev' | 'errors'

export interface AtlasAiSessionMap {
  decisions: string[]
  actions: string[]
  code: string[]
  errors: string[]
}

const ACTIVE_STATUSES = new Set<AtlasAiStatus>(['queued', 'processing'])

export function isAtlasTraceActive(trace: Pick<AtlasAiTrace, 'status'>): boolean {
  return ACTIVE_STATUSES.has(trace.status)
}

export function pollIntervalForAtlasAi(input: {
  hasActiveTrace: boolean
  failureCount: number
  activeTraceAgeMs?: number | null
  appIsActive?: boolean
}): number | null {
  if (!input.hasActiveTrace || input.appIsActive === false) return null

  const failures = Math.max(0, input.failureCount)
  if (failures >= 5) return 15000
  if (failures >= 3) return 9000
  if (failures >= 1) return 5000

  const age = Math.max(0, input.activeTraceAgeMs ?? 0)
  if (age < 30000) return 1800
  if (age < 180000) return 2800
  if (age < 600000) return 4500
  return 7000
}

export function traceMatchesClientId(trace: AtlasAiTrace, clientId: string): boolean {
  if (trace.job?.client_id === clientId) return true
  if ((trace.jobs ?? []).some((job) => job.client_id === clientId)) return true
  return trace.metadata?.client_id === clientId
}

export function sortAtlasTraces(traces: AtlasAiTrace[]): AtlasAiTrace[] {
  return [...traces].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime()
    const rightTime = new Date(right.created_at).getTime()
    if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
      return left.id.localeCompare(right.id)
    }
    return leftTime - rightTime
  })
}

export function mergeAtlasTrace(trace: AtlasAiTrace, traces: AtlasAiTrace[], limit = TRACE_HISTORY_LIMIT): AtlasAiTrace[] {
  return sortAtlasTraces([trace, ...traces.filter((item) => item.id !== trace.id)]).slice(-limit)
}

export function matchesAtlasTraceSearch(trace: AtlasAiTrace, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  const haystack = [
    trace.operator_input,
    trace.response_text,
    trace.agent_slug,
    trace.provider,
    trace.model,
    trace.intent,
    trace.job?.result_text,
    ...(trace.jobs ?? []).map((job) => job.result_text),
    ...qualityFlagCodes(trace),
    ...artifactStrings([trace.metadata, trace.context_refs, trace.skill_versions], ['file', 'path', 'command', 'error']),
  ].filter(Boolean).join(' ').toLowerCase()

  return haystack.includes(needle)
}

export function traceMatchesTurnFilter(
  trace: AtlasAiTrace,
  filter: AtlasAiTurnFilter,
  pinnedTraceIds: readonly string[] = [],
): boolean {
  if (filter === 'all') return true
  if (filter === 'pinned') return pinnedTraceIds.includes(trace.id)
  if (filter === 'errors') return trace.status === 'failed' || trace.status === 'cancelled' || traceHasErrors(trace)
  if (filter === 'actions') return traceHasOpenActions(trace)
  if (filter === 'dev') return traceLooksLikeDev(trace)
  if (filter === 'decisions') return traceLooksLikeDecision(trace)
  return true
}

export function buildAtlasSessionMap(input: {
  state: AtlasAiSessionState | null
  traces: AtlasAiTrace[]
  qualityActions: AtlasAiQualityAction[]
  pinnedTraceIds?: readonly string[]
}): AtlasAiSessionMap {
  const pinned = new Set(input.pinnedTraceIds ?? [])
  const decisions = [
    ...formatUnknownList(input.state?.decisions),
    ...input.traces
      .filter((trace) => pinned.has(trace.id) || traceLooksLikeDecision(trace))
      .flatMap((trace) => [
        trace.operator_input ? `Pergunta: ${trace.operator_input}` : '',
        trace.response_text ? `Resposta: ${trace.response_text}` : '',
      ]),
  ]

  const actions = [
    ...formatUnknownList(input.state?.next_steps),
    ...formatUnknownList(input.state?.open_loops),
    ...input.qualityActions
      .filter((action) => ['queued', 'running', 'blocked', 'failed'].includes(action.status))
      .map((action) => `${action.action_type.replace(/_/g, ' ')}: ${action.reason}`),
  ]

  const code = [
    ...formatUnknownList(input.state?.relevant_artifacts),
    ...input.traces.flatMap((trace) => {
      const jobs = trace.jobs?.length ? trace.jobs : trace.job ? [trace.job] : []
      return executionArtifactStrings(trace, jobs, ['file', 'files', 'path', 'paths', 'command', 'commands', 'test', 'tests'])
    }),
  ]

  const errors = [
    ...input.traces.flatMap((trace) => {
      const jobs = trace.jobs?.length ? trace.jobs : trace.job ? [trace.job] : []
      return [
        trace.status === 'failed' ? `Trace falhou: ${trace.operator_input}` : '',
        ...jobs.map((job) => job.error_message || '').filter(Boolean),
      ]
    }),
  ]

  return {
    decisions: uniqueTrimmed(decisions, 12, 220),
    actions: uniqueTrimmed(actions, 12, 220),
    code: uniqueTrimmed(code, 12, 220),
    errors: uniqueTrimmed(errors, 12, 220),
  }
}

export function buildPinnedTraceSummary(traces: AtlasAiTrace[], pinnedTraceIds: readonly string[]): string[] {
  const pinned = new Set(pinnedTraceIds)
  return traces
    .filter((trace) => pinned.has(trace.id))
    .map((trace) => {
      const response = trace.response_text || trace.job?.result_text || ''
      return uniqueTrimmed([trace.operator_input, response], 2, 180).join(' -> ')
    })
    .filter(Boolean)
}

function traceHasOpenActions(trace: AtlasAiTrace): boolean {
  return (trace.quality_actions ?? []).some((action) => ['queued', 'running', 'blocked', 'failed'].includes(action.status))
}

function traceHasErrors(trace: AtlasAiTrace): boolean {
  const jobs = trace.jobs?.length ? trace.jobs : trace.job ? [trace.job] : []
  return jobs.some((job) => Boolean(job.error_message) || job.status === 'failed' || job.status === 'cancelled')
}

function traceLooksLikeDecision(trace: AtlasAiTrace): boolean {
  const text = `${trace.operator_input} ${trace.response_text ?? ''}`.toLowerCase()
  return /\b(decid|decisão|decisao|escolh|opção|opcao|a\)|b\)|c\)|ambos|plano|direção|direcao)\b/.test(text)
}

function traceLooksLikeDev(trace: AtlasAiTrace): boolean {
  const jobs = trace.jobs?.length ? trace.jobs : trace.job ? [trace.job] : []
  const text = [
    trace.agent_slug,
    trace.operator_input,
    trace.response_text,
    trace.metadata,
    ...jobs.flatMap((job) => [job.kind, job.payload, job.result_json, job.result_text, job.error_message]),
  ].map((item) => typeof item === 'string' ? item : JSON.stringify(item ?? '')).join(' ').toLowerCase()

  return /\b(código|codigo|codex|debug|bug|teste|typecheck|php artisan|npm run|arquivo|tsx|php|diff|commit)\b/.test(text)
}

function qualityFlagCodes(trace: AtlasAiTrace): string[] {
  return (trace.quality_evaluation?.flags ?? [])
    .map((flag) => typeof flag.code === 'string' ? flag.code : '')
    .filter(Boolean)
}

function executionArtifactStrings(trace: AtlasAiTrace, jobs: AtlasAiJob[], keys: string[]): string[] {
  return artifactStrings([
    trace.metadata,
    trace.context_refs,
    trace.skill_versions,
    ...jobs.flatMap((job) => [job.payload, job.metadata, job.result_json, job.result_text, job.error_message]),
  ], keys)
}

function artifactStrings(roots: unknown[], keys: string[]): string[] {
  const found: string[] = []
  const keySet = new Set(keys.map((key) => key.toLowerCase()))

  const visit = (value: unknown, keyHint?: string, depth = 0): void => {
    if (depth > 5 || found.length >= 20 || value == null) return

    const hint = keyHint?.toLowerCase() ?? ''
    const matched = [...keySet].some((key) => hint.includes(key))

    if (typeof value === 'string') {
      if (matched || looksLikeArtifact(value, keySet)) found.push(value)
      return
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      if (matched) found.push(String(value))
      return
    }

    if (Array.isArray(value)) {
      for (const item of value) visit(item, keyHint, depth + 1)
      return
    }

    if (typeof value === 'object') {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        visit(nested, key, depth + 1)
      }
    }
  }

  for (const root of roots) visit(root)
  return uniqueTrimmed(found, 20, 220)
}

function looksLikeArtifact(value: string, keySet: Set<string>): boolean {
  const lower = value.toLowerCase()
  if ((keySet.has('path') || keySet.has('file')) && /\.(tsx?|php|json|md|css)\b/.test(lower)) return true
  if ((keySet.has('command') || keySet.has('commands')) && /^(npm|php|composer|git|npx)\s/.test(lower)) return true
  if (keySet.has('error') && /\b(error|failed|exception|fatal)\b/.test(lower)) return true
  return false
}

function formatUnknownList(items?: unknown[]): string[] {
  if (!Array.isArray(items)) return []
  return items.map((item) => {
    if (typeof item === 'string') return item
    if (typeof item === 'number' || typeof item === 'boolean') return String(item)
    if (!item || typeof item !== 'object') return ''

    const record = item as Record<string, unknown>
    for (const key of ['title', 'label', 'text', 'summary', 'description', 'content', 'decision', 'next_step']) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) return value
    }
    return JSON.stringify(record)
  })
}

function uniqueTrimmed(values: string[], limit: number, maxLength: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const compact = trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength - 1)}…`
    if (seen.has(compact)) continue
    seen.add(compact)
    result.push(compact)
    if (result.length >= limit) break
  }

  return result
}
