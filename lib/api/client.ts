import type { DomainKey } from '../domains'
export type { AtlasAiStreamDone, AtlasAiStreamEvent } from '../atlasAiStreamRuntime'

// HTTP foundation (config, auth, request engine, token storage) lives in ./core.
// Re-exported so every existing `import { X } from 'lib/api/client'` keeps working.
export * from './core'
// atlas-ai API surface (types + functions) lives in ./atlasAi, re-exported here.
export * from './atlasAi'
// engineering domain API surface (types + functions) lives in ./engineering, re-exported here.
export * from './engineering'
// captures domain API surface (types + functions) lives in ./captures, re-exported here.
export * from './captures'
// health domain API surface (types + functions) lives in ./health, re-exported here.
export * from './health'
// entity/telemetry/sync cluster (checkins, passive signals, behaviors, behavior-logs,
// digital sessions/activity, sync-delta) lives in ./entities, re-exported here.
export * from './entities'
// work-management cluster (projects, tasks, agenda, routines — types + functions) lives in
// ./work, re-exported here.
export * from './work'
// mobile cluster (inbox/voice/mac remote/pairing/push/recommendations/ai-thread + Mobile*/AtlasMobile*
// types) lives in ./mobile, re-exported here.
export * from './mobile'
// semantic notes/curation/activations + cognitive games live in ./semantic, re-exported here.
export * from './semantic'
// memory registry/verbatim/provider-projection/audits/quality/maintenance + tool-authority
// surface + VaultHealth live in ./memory, re-exported here.
export * from './memory'
import { apiGet, apiPost, queryString } from './core'
// Captures types still referenced by client.ts's kept triage code (which stays because it
// references project/semantic types that remain here / were split to ./semantic).
import type { AtlasCapture, CaptureTriageAction } from './captures'
// Engineering types still referenced by client.ts's kept AtlasEngineeringPackageResponse
// (which stays here because it references the non-engineering AtlasTaskEvent).
import type {
  AtlasEngineeringTaskContract,
  AtlasEngineeringBlueprint,
  AtlasEngineeringBlueprintSnapshot,
  AtlasEngineeringStatusSnapshot,
  AtlasEngineeringRunSummary,
  AtlasEngineeringBenchmarkCaseSummary,
  AtlasEngineeringBenchmarkResultSummary,
  AtlasEngineeringEvidence,
} from './engineering'
// Entity/telemetry types still referenced by client.ts's kept Bitacula normalization/analysis surface.
import type {
  AtlasBehavior,
  AtlasBehaviorLog,
  BehaviorCategory,
  BehaviorGranularityLevel,
  BehaviorSensitivityLevel,
  StoreBehaviorInput,
} from './entities'
// Work-management types still referenced by client.ts's kept code: AtlasTaskEvent by the kept
// AtlasEngineeringPackageResponse; CaptureTriageInput + the project-plan proposal types by the
// kept capture-originated triage/project-plan functions.
import type {
  AtlasTaskEvent,
  CaptureTriageInput,
  AtlasProjectPlanProposal,
  ProjectPlanProposalsResponse,
  ProjectPlanProposalAcceptResponse,
} from './work'
// Semantic type still referenced by client.ts's kept CaptureTriageResponse.
import type { AtlasSemanticCurationProposal } from './semantic'

export interface AtlasDomain {
  slug: string
  label: string
  description: string | null
  color_light: string
  color_dark: string
  default_sensitivity: 'normal' | 'private' | 'sensitive' | string
  external_ai_policy: 'allow' | 'block_private_sensitive' | 'block_all' | string
  active: boolean
  sort_order: number
  metadata: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
}

export interface AtlasInboxHealth {
  open_count: number
  no_destination_count: number
  failed_count: number
  curation_candidate_count: number
  average_age_hours: number
  oldest_capture_at: string | null
  by_domain: Record<string, {
    open_count: number
    no_destination_count: number
    failed_count: number
    curation_candidate_count: number
  }>
}

export interface CaptureTriageResponse {
  capture: AtlasCapture
  proposal: AtlasSemanticCurationProposal | null
}

export interface AtlasStructureMotherAuditAction {
  id: string
  module_id?: string | null
  type: string
  status: string
  operator_required?: boolean
  due_at?: string | null
  current_due_at?: string | null
  review_due_at?: string | null
  dry_run_command?: string | null
  apply_command?: string | null
  list_command?: string | null
  list_missing_command?: string | null
  record_command?: string | null
  missing_rate_count?: number | null
  critical_item_count?: number | null
  agent_auto_dispatch_allowed?: boolean | null
  external_notification_possible?: boolean | null
  diagnostics?: Record<string, unknown> | null
  item_commands?: Array<Record<string, unknown>>
  notes?: string[]
  [key: string]: unknown
}

export interface AtlasStructureMotherAuditModule {
  id: string
  label: string
  status: string
  implementation_status: string
  operational_status: string
  evidence: Record<string, unknown>
  canonical_command: string
  blockers: string[]
  operational_blockers: string[]
}

export interface AtlasStructureMotherAuditResponse {
  status: string
  structure_mother_audit: {
    schema_version: 'atlas.structure_mother_audit.v1' | string
    status: string
    complete: boolean
    implementation_complete: boolean
    hours: number
    workspace: string
    summary: {
      module_count: number
      ready_count: number
      attention_count: number
      blocked_count: number
      blocker_count: number
      operational_blocker_count: number
      qualitative_level?: string | null
      next_qualitative_level?: string | null
      next_level_blockers?: string[]
    }
    completion_gate: {
      status: string
      reason: string
      update_goal_allowed: boolean
    }
    operator_action_plan: {
      schema_version: 'atlas.structure_mother.operator_action_plan.v1' | string
      status: string
      action_count: number
      action_summary?: {
        schema_version: 'atlas.structure_mother.operator_action_summary.v1' | string
        status: string
        actionable_now_count: number
        calendar_wait_count: number
        human_review_action_count: number
        external_effect_action_count: number
        next_calendar_due_at?: string | null
        next_action_ids: string[]
        calendar_action_ids: string[]
      }
      actions: AtlasStructureMotherAuditAction[]
      rules: Record<string, unknown>
    }
    modules: AtlasStructureMotherAuditModule[]
    blockers: Array<{
      module_id: string
      module: string
      blocker: string
    }>
    generated_at: string | null
    [key: string]: unknown
  }
}

export interface AtlasEngineeringPackageResponse {
  task_id: string
  contract: AtlasEngineeringTaskContract
  blueprint: AtlasEngineeringBlueprint
  blueprint_snapshot: AtlasEngineeringBlueprintSnapshot | null
  status_snapshot: AtlasEngineeringStatusSnapshot
  latest_run: AtlasEngineeringRunSummary | null
  run_history: AtlasEngineeringRunSummary[]
  latest_harness_run?: AtlasEngineeringRunSummary | null
  harness_runs?: AtlasEngineeringRunSummary[]
  benchmark_cases?: AtlasEngineeringBenchmarkCaseSummary[]
  benchmark_results?: AtlasEngineeringBenchmarkResultSummary[]
  latest_evidence: AtlasEngineeringEvidence | null
  evidence_history: AtlasEngineeringEvidence[]
  events: AtlasTaskEvent[]
}

export interface BitaculaCanonicalFactor {
  id: string
  label: string
  category: BehaviorCategory
  parent_factor: string
  factor_condition: string
  question_text: string
  target_outcomes: string[]
  expected_lag: string
  expected_direction: string
  granularity_level: BehaviorGranularityLevel
  sensitivity_level: BehaviorSensitivityLevel
  guidance: string | null
  aliases: string[]
}

export interface BitaculaNormalizationSuggestion extends BitaculaCanonicalFactor {
  confidence: number
  matched_text: string
  match_reason: string
  operator_action: 'confirm' | string
  payload: Partial<StoreBehaviorInput>
}

export interface BitaculaNormalizationResponse {
  input_text: string
  normalized_text: string
  normalizer: string
  suggestions: BitaculaNormalizationSuggestion[]
}

export interface BitaculaFactorsResponse {
  normalizer: string
  factors: BitaculaCanonicalFactor[]
}

export interface BitaculaBriefingItem {
  behavior: AtlasBehavior
  log: AtlasBehaviorLog | null
  date: string
  score: number
  reason: string
}

export interface BitaculaBriefingResponse {
  date: string
  items: BitaculaBriefingItem[]
  normalizer: string
}

export interface BitaculaAnalysisRow {
  outcome: string
  yes_count: number
  no_count: number
  avg_yes: number | null
  avg_no: number | null
  difference: number | null
  effect_direction: 'higher_when_yes' | 'lower_when_yes' | 'neutral' | null | string
  support: 'insufficient' | 'weak' | 'moderate_exploratory' | 'strong_exploratory' | string
  sample_sufficient: boolean
  confidence_level: 'low' | 'medium' | 'high' | string
  interpretation: 'insufficient_data' | 'weak_signal' | 'hypothesis_candidate' | string
}

export interface BitaculaConfounder {
  name: string
  parent_factor: string | null
  count: number
}

export interface BitaculaAnalysisResponse {
  behavior: AtlasBehavior
  window_days: number
  lag_days: number
  date_from: string
  date_to: string
  computed_at: string
  analysis: BitaculaAnalysisRow[]
  confounders: BitaculaConfounder[]
  disclaimer: string
}

export interface AtlasWorkspaceProfile {
  slug: string
  name: string
  kind?: string | null
  workspace_path?: string | null
  workspace_path_exists?: boolean | null
  repo_root?: string | null
  stack_summary?: string | null
  production_status?: string | null
  docs_status?: string | null
  status?: string | null
  safety?: Record<string, unknown>
}

export interface AtlasWorkspaceProfileListResponse {
  schema_version: 'atlas.code.workspace_profile.v1' | string
  data: AtlasWorkspaceProfile[]
  meta: {
    total: number
    default_slug: string | null
  }
}

export interface AtlasWorkspaceProfileMutationResponse {
  schema_version: 'atlas.code.workspace_profile.v1' | string
  workspace: AtlasWorkspaceProfile
  meta: {
    persisted: boolean
    execution_allowed: boolean
    execution_blocked_reason?: string | null
  }
}

export interface AtlasWorkspaceProfileCreateInput {
  slug: string
  name: string
  workspace_path?: string | null
  repo_root?: string | null
  kind?: string
  source?: string
  status?: string
}

export interface DomainsResponse {
  domains: AtlasDomain[]
}

export interface CreateAtlasDomainInput {
  slug: string
  label: string
  description?: string | null
  color_light?: string
  color_dark?: string
  default_sensitivity?: 'normal' | 'private' | 'sensitive'
  external_ai_policy?: 'allow' | 'block_private_sensitive' | 'block_all'
  sort_order?: number
  active?: boolean
  metadata?: Record<string, unknown>
}

export interface InboxResponse {
  captures: AtlasCapture[]
  health: AtlasInboxHealth
  generated_at: string
}

export interface InboxHealthResponse {
  health: AtlasInboxHealth
  snapshot: {
    id: string
    snapshot_date: string | null
    domain: string | null
    created_at: string | null
    updated_at: string | null
  }
  generated_at: string
}

export interface InboxBulkResponse {
  captures: AtlasCapture[]
  updated_count: number
}

export async function listDomains(params: { include_inactive?: boolean } = {}): Promise<DomainsResponse> {
  return apiGet<DomainsResponse>(`/domains${queryString(params)}`)
}

export async function createDomain(input: CreateAtlasDomainInput): Promise<AtlasDomain> {
  return apiPost<AtlasDomain>('/domains', input)
}

export async function listInbox(params: {
  q?: string
  domain?: DomainKey | 'all'
  status?: 'open' | 'pending' | 'transcribed' | 'failed' | 'no_destination' | 'candidate' | 'routed' | 'archived' | 'snoozed' | 'all'
  sort?: 'recent' | 'oldest' | 'updated' | 'needs_triage'
  limit?: number
} = {}): Promise<InboxResponse> {
  const normalized = { ...params, domain: params.domain === 'all' ? undefined : params.domain }
  return apiGet<InboxResponse>(`/inbox${queryString(normalized)}`)
}

export async function getInboxHealth(params: { domain?: DomainKey | 'all' } = {}): Promise<InboxHealthResponse> {
  const normalized = { domain: params.domain === 'all' ? undefined : params.domain }
  return apiGet<InboxHealthResponse>(`/inbox/health${queryString(normalized)}`)
}

export async function bulkTriageCaptures(input: {
  capture_ids: string[]
  action: Exclude<CaptureTriageAction, 'attach_note'>
  title?: string | null
  snoozed_until?: string | null
  reason?: string | null
  metadata?: Record<string, unknown>
}): Promise<InboxBulkResponse> {
  return apiPost<InboxBulkResponse>('/inbox/bulk', input)
}

export async function listBitaculaFactors(): Promise<BitaculaFactorsResponse> {
  return apiGet<BitaculaFactorsResponse>('/bitacula/factors')
}

export async function normalizeBitaculaText(input: { text: string; limit?: number }): Promise<BitaculaNormalizationResponse> {
  return apiPost<BitaculaNormalizationResponse>('/bitacula/normalize', input)
}

export async function getBitaculaBriefing(params: {
  date?: string
  limit?: number
  include_logged?: boolean
} = {}): Promise<BitaculaBriefingResponse> {
  return apiGet<BitaculaBriefingResponse>(`/bitacula/briefing${queryString(params)}`)
}

export async function getBitaculaAnalysis(params: {
  behavior_client_id: string
  window_days?: number
}): Promise<BitaculaAnalysisResponse> {
  return apiGet<BitaculaAnalysisResponse>(`/bitacula/analysis${queryString(params)}`)
}

export async function triageCapture(id: string, input: CaptureTriageInput): Promise<CaptureTriageResponse> {
  return apiPost<CaptureTriageResponse>(`/captures/${encodeURIComponent(id)}/triage`, input)
}

export async function listCaptureProjectPlanProposals(id: string): Promise<ProjectPlanProposalsResponse> {
  return apiGet<ProjectPlanProposalsResponse>(`/captures/${encodeURIComponent(id)}/project-plan/proposals`)
}

export async function proposeCaptureProjectPlan(
  id: string,
  input: Partial<CaptureTriageInput> & {
    instruction?: string | null
    regeneration_instruction?: string | null
  } = {},
): Promise<AtlasProjectPlanProposal> {
  return apiPost<AtlasProjectPlanProposal>(`/captures/${encodeURIComponent(id)}/project-plan/propose`, input)
}

export async function acceptProjectPlanProposal(
  proposalId: string,
  input: Partial<CaptureTriageInput> = {},
): Promise<ProjectPlanProposalAcceptResponse> {
  return apiPost<ProjectPlanProposalAcceptResponse>(`/project-plan-proposals/${encodeURIComponent(proposalId)}/accept`, input)
}

export async function rejectProjectPlanProposal(
  proposalId: string,
  input: { reason?: string | null } = {},
): Promise<{ proposal: AtlasProjectPlanProposal }> {
  return apiPost<{ proposal: AtlasProjectPlanProposal }>(`/project-plan-proposals/${encodeURIComponent(proposalId)}/reject`, input)
}

export async function regenerateProjectPlanProposal(
  proposalId: string,
  input: Partial<CaptureTriageInput> & {
    instruction?: string | null
    regeneration_instruction?: string | null
  } = {},
): Promise<AtlasProjectPlanProposal> {
  return apiPost<AtlasProjectPlanProposal>(`/project-plan-proposals/${encodeURIComponent(proposalId)}/regenerate`, input)
}

export async function fetchTaskEngineering(
  id: string,
  params: { limit?: number } = {},
): Promise<AtlasEngineeringPackageResponse> {
  return apiGet<AtlasEngineeringPackageResponse>(`/tasks/${encodeURIComponent(id)}/engineering${queryString(params)}`)
}

export async function freezeTaskEngineeringBlueprint(id: string): Promise<AtlasEngineeringPackageResponse> {
  return apiPost<AtlasEngineeringPackageResponse>(`/tasks/${encodeURIComponent(id)}/engineering/blueprint/freeze`, {})
}

export async function fetchAtlasStructureMotherAudit(
  params: { hours?: number; workspace?: string | null } = {},
): Promise<AtlasStructureMotherAuditResponse> {
  return apiGet<AtlasStructureMotherAuditResponse>(`/ai/structure-mother-audit${queryString(params)}`)
}

export async function listAtlasWorkspaceProfiles(): Promise<AtlasWorkspaceProfileListResponse> {
  return apiGet<AtlasWorkspaceProfileListResponse>('/atlas-code/projects/workspaces')
}

export async function createAtlasWorkspaceProfile(input: AtlasWorkspaceProfileCreateInput): Promise<AtlasWorkspaceProfileMutationResponse> {
  return apiPost<AtlasWorkspaceProfileMutationResponse>('/atlas-code/projects/workspaces', input)
}

// Atlas Loop Command Surface · re-exported so callers keep importing from `lib/api/client`
// (the same surface every sibling lib module uses) while the implementation lives in its own
// `loopClient` file. loopClient depends only on the apiGet/apiPost defined above; this barrel
// re-export is evaluated after they exist, so there is no init-order hazard.
export {
  ATLAS_LOOP_DEFAULT_AREA,
  ATLAS_LOOP_DEFAULT_FOCUS,
  ATLAS_LOOP_DEFAULT_PORTFOLIO,
  fetchAtlasLoopLive,
  fetchAtlasLoopCycles,
  submitAtlasLoopOperatorDecision,
  submitAtlasLoopRunControl,
  sendAtlasLoopDirective,
} from './loopClient'
export type {
  AtlasLoopCycleOutcome,
  AtlasLoopWorkClass,
  AtlasLoopOperatorDecision,
  AtlasLoopRiskLevel,
  AtlasLoopRunControlAction,
  AtlasLoopLockHolder,
  AtlasLoopLockStatus,
  AtlasLoopSignalStatus,
  AtlasLoopStewardshipRecovery,
  AtlasLoopSchedulerCycleSummary,
  AtlasLoopSchedulerBacklog,
  AtlasLoopRunState,
  AtlasLoopCockpitHealth,
  AtlasLoop24hObservability,
  AtlasLoopCockpit,
  AtlasLoopLiveResponse,
  FetchAtlasLoopLiveParams,
  AtlasLoopCycleRecord,
  AtlasLoopCyclesResponse,
  FetchAtlasLoopCyclesParams,
  SubmitAtlasLoopDecisionInput,
  AtlasLoopOperatorDecisionReceipt,
  AtlasLoopOperatorDecisionError,
  SubmitAtlasLoopRunControlInput,
  AtlasLoopRunControlResponse,
  SendAtlasLoopDirectiveInput,
  AtlasLoopDirectiveConsumability,
  AtlasLoopDirectiveReceipt,
  AtlasLoopDirectiveError,
} from './loopClient'
