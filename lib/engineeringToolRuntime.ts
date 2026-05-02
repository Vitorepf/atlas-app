import type { AtlasToolDoctorItem, AtlasToolRunSummary } from './api/client'

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
