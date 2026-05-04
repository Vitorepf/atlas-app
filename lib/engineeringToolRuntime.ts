import type {
  AtlasToolDoctorItem,
  AtlasToolAuthorityGroup,
  AtlasToolAuthorityPolicy,
  AtlasToolPolicySummary,
  AtlasToolsAuthorityPoliciesResponse,
  AtlasToolsAuthorityResponse,
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

export interface EngineeringToolAuthoritySummary {
  toolCount: number
  authorityGroupCount: number
  tierLine: string
  recommendationCount: number
  highRecommendationCount: number
  duplicatePrimaryCount: number
  missingPrimaryCount: number
}

export interface EngineeringToolAuthorityPolicySummary {
  policyCount: number
  blockingPolicyCount: number
  warningPolicyCount: number
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
  const policy = [tool.execution_tier, tool.authority_group, tool.authority_role].filter(Boolean).join(' · ')
  const risk = [tool.risk_level, tool.cost_posture, policy].filter(Boolean).join(' · ')
  const capabilities = tool.capabilities.slice(0, 3).join(', ')

  return [risk, capabilities].filter(Boolean).join(' · ') || tool.category
}

export function buildEngineeringToolAuthoritySummary(
  authority: AtlasToolsAuthorityResponse | null | undefined,
): EngineeringToolAuthoritySummary {
  const summary = authority?.summary
  const groups = authority?.authority_groups ?? []
  const highRecommendationCount = (authority?.recommendations ?? [])
    .filter((recommendation) => recommendation.severity === 'high')
    .length

  return {
    toolCount: summary?.tool_count ?? 0,
    authorityGroupCount: summary?.authority_group_count ?? 0,
    tierLine: [
      `T0 ${summary?.t0_count ?? 0}`,
      `T1 ${summary?.t1_count ?? 0}`,
      `T2 ${summary?.t2_count ?? 0}`,
      `T3 ${summary?.t3_count ?? 0}`,
    ].join(' · '),
    recommendationCount: authority?.recommendations?.length ?? 0,
    highRecommendationCount,
    duplicatePrimaryCount: groups.filter((group) => group.duplicate_primary).length,
    missingPrimaryCount: groups.filter((group) => group.missing_primary).length,
  }
}

export function toolAuthorityGroupLine(group: AtlasToolAuthorityGroup): string {
  const primary = group.primary_tools.map((tool) => tool.slug).join(', ') || 'sem primária'
  const complementary = group.complementary_tools.length > 0
    ? `${group.complementary_tools.length} complementares`
    : null
  const fallback = group.fallback_tools.length > 0 ? `${group.fallback_tools.length} fallback` : null
  const executors = group.executor_tools.length > 0 ? `${group.executor_tools.length} executores` : null
  const tiers = group.tier_span.length > 0 ? group.tier_span.join('/') : null

  return [primary, complementary, fallback, executors, tiers].filter(Boolean).join(' · ')
}

export function buildEngineeringToolAuthorityPolicySummary(
  policies: AtlasToolsAuthorityPoliciesResponse | null | undefined,
): EngineeringToolAuthorityPolicySummary {
  return {
    policyCount: policies?.summary.policy_count ?? 0,
    blockingPolicyCount: policies?.summary.blocking_policy_count ?? 0,
    warningPolicyCount: policies?.summary.warning_policy_count ?? 0,
  }
}

export function toolAuthorityPolicyLine(policy: AtlasToolAuthorityPolicy): string {
  const block = policy.block_severities.length > 0
    ? `bloqueia ${policy.block_severities.join('/')}`
    : 'sem bloqueio'
  const warn = policy.warn_severities.length > 0
    ? `avisa ${policy.warn_severities.join('/')}`
    : 'sem aviso'

  const source = policy.source && policy.source !== 'default' ? `override ${policy.source}` : 'default'

  return [source, policy.policy, block, warn, policy.block_reason].filter(Boolean).join(' · ')
}

export function toolRuntimeEvidenceLine(run: AtlasToolRunSummary): string {
  const duration = Number.isFinite(run.duration_ms) ? `${run.duration_ms}ms` : '-'
  const artifacts = run.artifacts?.length ?? 0
  const findings = run.findings?.length ?? 0
  const context = [run.run_context_type, run.run_context_id].filter(Boolean).join(':')
  const policy = toolRuntimePolicyLine(run.policy_decision_json)

  return [run.surface, run.policy_decision, policy, context, duration, `${artifacts} artefatos`, `${findings} findings`]
    .filter(Boolean)
    .join(' · ')
}

export function toolRuntimePolicyLine(policy: Record<string, unknown> | null | undefined): string | null {
  if (!policy) return null

  const tier = stringValue(policy.execution_tier)
  const sandbox = stringValue(policy.sandbox_mode)
  const privacy = stringValue(policy.privacy_level)
  const taskType = stringValue(policy.task_type)
  const providerSafe = typeof policy.provider_safe === 'boolean'
    ? (policy.provider_safe ? 'provider-safe' : 'provider-unsafe')
    : null

  return [tier, sandbox, privacy, taskType, providerSafe].filter(Boolean).join('/') || null
}

export function toolApprovalPolicyLine(policy: AtlasToolPolicySummary | null | undefined): string {
  if (!policy) return 'policy não configurada'

  const metadata = policy.metadata ?? {}
  const guardrails = [
    stringValue(metadata.max_execution_tier),
    stringValue(metadata.sandbox_mode),
    stringValue(metadata.privacy_level),
    stringValue(metadata.task_type),
    metadata.requires_provider_safe === true ? 'provider-safe obrigatório' : null,
    metadata.network_allowed === true ? 'rede permitida' : null,
  ].filter(Boolean).join('/')
  const until = stringValue(metadata.approved_until)

  return [
    policy.approval_status ?? 'unknown',
    policy.scope_type,
    guardrails || null,
    until ? `até ${until}` : null,
  ].filter(Boolean).join(' · ')
}

export function toolRuntimeGateLine(gate: AtlasToolsGateResponse | null | undefined): string {
  if (!gate) return 'gate ainda não avaliado'

  const runCount = gate.summary?.run_count ?? 0
  const blockingCount = gate.summary?.blocking_failure_count ?? gate.blocking_failures?.length ?? 0
  const warningCount = gate.summary?.warning_count ?? gate.warnings?.length ?? 0
  const requiredTools = gate.required_tools?.length ?? 0
  const suppressedDuplicates = gate.summary?.suppressed_duplicate_finding_count ?? 0
  const staleEvidence = gate.summary?.stale_evidence_count ?? 0
  const inputRunCount = gate.summary?.input_run_count ?? runCount

  return [
    gate.allowed ? 'liberado' : 'bloqueado',
    pluralize(runCount, 'evidência', 'evidências'),
    gate.selection?.latest_per_tool && inputRunCount > runCount ? `${inputRunCount} avaliadas como latest/tool` : null,
    pluralize(blockingCount, 'bloqueio', 'bloqueios'),
    pluralize(warningCount, 'aviso', 'avisos'),
    staleEvidence > 0 ? pluralize(staleEvidence, 'stale', 'stale') : null,
    suppressedDuplicates > 0 ? `${suppressedDuplicates} duplicatas correlacionadas` : null,
    requiredTools > 0 ? pluralize(requiredTools, 'ferramenta exigida', 'ferramentas exigidas') : null,
  ].filter(Boolean).join(' · ')
}

export function toolRuntimeGateIssueLine(issue: Record<string, unknown> | null | undefined): string {
  if (!issue) return 'sem detalhe'

  const tool = stringValue(issue.tool_slug ?? issue.tool ?? issue.required_tool)
  const authority = [
    stringValue(issue.authority_group),
    stringValue(issue.authority_policy),
    stringValue(issue.severity),
  ].filter(Boolean).join('/')
  const rule = stringValue(issue.rule_id ?? issue.rule ?? issue.type)
  const message = stringValue(issue.title ?? issue.message ?? issue.reason ?? issue.status)

  return [tool, authority || null, rule, message].filter(Boolean).join(' · ') || 'sem detalhe'
}

export function buildToolRuntimeGateFilters(input: {
  workspace?: string | null
  mode?: EngineeringToolGateMode
  limit?: number
}): AtlasToolsGateFilters {
  const workspace = input.workspace?.trim() || null
  const mode = input.mode ?? 'observe'

  const filters: AtlasToolsGateFilters = {
    workspace,
    limit: input.limit ?? 8,
    require_evidence: mode === 'release',
  }
  if (mode === 'release') {
    filters.max_age_minutes = 1440
    filters.stale_blocks = true
    filters.latest_per_tool = true
  }

  return filters
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
