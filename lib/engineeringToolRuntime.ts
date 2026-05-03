import type {
  AtlasToolDoctorItem,
  AtlasToolRunSummary,
  AtlasToolsGateFilters,
  AtlasToolsGateResponse,
} from './api/client'

export type EngineeringToolGateMode = 'observe' | 'release'

export interface EngineeringToolRuntimeSummary {
  status: 'ready' | 'warning' | 'failed' | 'unknown'
  readyCount: number
  missingCount: number
  warningCount: number
  failedEvidenceCount: number
  evidenceCount: number
  blockingFindingCount: number
  lastEvidenceAt: string | null
}

export function buildEngineeringToolRuntimeSummary(
  tools: AtlasToolDoctorItem[] = [],
  runs: AtlasToolRunSummary[] = [],
): EngineeringToolRuntimeSummary {
  const readyCount = tools.filter((tool) => tool.status === 'ready').length
  const missingCount = tools.filter((tool) => tool.status === 'missing').length
  const warningCount = tools.filter((tool) => ['disabled', 'skipped', 'timeout'].includes(tool.status)).length
  const failedEvidenceCount = runs.filter((run) => ['failed', 'timeout'].includes(run.status)).length
  const blockingFindingCount = runs.reduce((sum, run) => (
    sum + (run.findings ?? []).filter((finding) => finding.blocks_resolved).length
  ), 0)
  const lastEvidenceAt = runs
    .map((run) => run.finished_at ?? run.created_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null

  return {
    status: statusForToolRuntime({
      toolCount: tools.length,
      readyCount,
      missingCount,
      warningCount,
      failedEvidenceCount,
      blockingFindingCount,
    }),
    readyCount,
    missingCount,
    warningCount,
    failedEvidenceCount,
    evidenceCount: runs.length,
    blockingFindingCount,
    lastEvidenceAt,
  }
}

export function toolRuntimeRiskLine(tool: AtlasToolDoctorItem): string {
  const risk = [tool.risk_level, tool.cost_posture].filter(Boolean).join(' · ')
  const capabilities = tool.capabilities.slice(0, 3).join(', ')

  return [risk, capabilities].filter(Boolean).join(' · ') || tool.category
}

export function toolRuntimeEvidenceLine(run: AtlasToolRunSummary): string {
  const duration = Number.isFinite(run.duration_ms) ? `${run.duration_ms}ms` : '-'
  const artifacts = run.artifacts?.length ?? 0
  const findings = run.findings?.length ?? 0
  const context = [run.run_context_type, run.run_context_id].filter(Boolean).join(':')

  return [run.surface, run.policy_decision, context, duration, `${artifacts} artefatos`, `${findings} findings`]
    .filter(Boolean)
    .join(' · ')
}

export function toolRuntimeGateLine(gate: AtlasToolsGateResponse | null | undefined): string {
  if (!gate) return 'gate ainda não avaliado'

  const runCount = gate.summary?.run_count ?? 0
  const blockingCount = gate.summary?.blocking_failure_count ?? gate.blocking_failures?.length ?? 0
  const warningCount = gate.summary?.warning_count ?? gate.warnings?.length ?? 0
  const requiredTools = gate.required_tools?.length ?? 0

  return [
    gate.allowed ? 'liberado' : 'bloqueado',
    pluralize(runCount, 'evidência', 'evidências'),
    pluralize(blockingCount, 'bloqueio', 'bloqueios'),
    pluralize(warningCount, 'aviso', 'avisos'),
    requiredTools > 0 ? pluralize(requiredTools, 'ferramenta exigida', 'ferramentas exigidas') : null,
  ].filter(Boolean).join(' · ')
}

export function toolRuntimeGateIssueLine(issue: Record<string, unknown> | null | undefined): string {
  if (!issue) return 'sem detalhe'

  const tool = stringValue(issue.tool_slug ?? issue.tool ?? issue.required_tool)
  const rule = stringValue(issue.rule_id ?? issue.rule ?? issue.type)
  const message = stringValue(issue.title ?? issue.message ?? issue.reason ?? issue.status)

  return [tool, rule, message].filter(Boolean).join(' · ') || 'sem detalhe'
}

export function buildToolRuntimeGateFilters(input: {
  workspace?: string | null
  mode?: EngineeringToolGateMode
  limit?: number
}): AtlasToolsGateFilters {
  const workspace = input.workspace?.trim() || null
  const mode = input.mode ?? 'observe'

  return {
    workspace,
    limit: input.limit ?? 8,
    require_evidence: mode === 'release',
  }
}

export function toolRuntimeGateModeLine(mode: EngineeringToolGateMode): string {
  return mode === 'release'
    ? 'release · exige evidência para liberar'
    : 'observação · ausência de evidência vira aviso'
}

function statusForToolRuntime(input: {
  toolCount: number
  readyCount: number
  missingCount: number
  warningCount: number
  failedEvidenceCount: number
  blockingFindingCount: number
}): EngineeringToolRuntimeSummary['status'] {
  if (input.toolCount === 0) return 'unknown'
  if (input.failedEvidenceCount > 0 || input.blockingFindingCount > 0) return 'failed'
  if (input.missingCount > 0 || input.warningCount > 0) return 'warning'
  if (input.readyCount > 0) return 'ready'

  return 'unknown'
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  return null
}
