// Memory + tool-authority domain API surface (types + functions), split out of ./client.
// Re-exported from ./client via `export * from './memory'` so existing imports keep working.
// Anti-cycle: this module MUST NOT import from ./client. The request engine comes from ./core.
//
// Holds: AtlasTool* authority/policy surface, memory registry/verbatim/recall/review-queue,
// provider-projection + audits, open-brain context pack + audits, memory quality/maintenance,
// suggestion audits, and VaultHealth (AtlasVaultHealthSnapshot + AtlasCognitiveReturn +
// getVaultHealth/recomputeVaultHealth — VaultHealth is AtlasCognitiveReturn's only consumer).
import { apiGet, apiPost, apiPut, apiDelete, queryString } from './core'

export interface AtlasToolDefinitionSummary {
  id?: string
  slug: string
  name: string
  type: string
  category: string
  risk_level: string
  status: string
  cost_posture: string
  execution_tier?: 'T0' | 'T1' | 'T2' | 'T3' | string
  expected_cost?: string | null
  default_trigger?: string | null
  authority_role?: string | null
  authority_group?: string | null
  capabilities_json?: string[]
  capabilities?: string[]
  risks_json?: string[]
  risks?: string[]
  default_failure_policy?: string
  default_timeout_seconds?: number
  created_at?: string | null
  updated_at?: string | null
}

export interface AtlasToolDoctorItem {
  slug: string
  name: string
  type: string
  category: string
  capabilities: string[]
  risks: string[]
  risk_level: string
  cost_posture: string
  execution_tier?: 'T0' | 'T1' | 'T2' | 'T3' | string
  expected_cost?: string | null
  default_trigger?: string | null
  authority_role?: string | null
  authority_group?: string | null
  status: 'ready' | 'missing' | 'disabled' | 'skipped' | 'failed' | 'timeout' | string
  execution_layer: string
  binary: string
  binary_path_hash: string | null
  version: string | null
  install_hint: string | null
  safe_commands?: AtlasToolSafeCommand[]
}

export interface AtlasToolSafeCommand {
  name: string
  category: string
  description: string
  command: string[]
  dry_run_default: boolean
  recommended_surface: string
  creates_evidence: boolean
  blocking_capable: boolean
  network_allowed: boolean
  max_execution_tier?: 'T0' | 'T1' | 'T2' | 'T3' | string | null
  sandbox_mode?: 'workspace' | 'worktree' | 'docker' | 'host' | 'none' | string | null
  privacy_level?: 'standard' | 'sensitive' | 'restricted' | string | null
  task_type?: string | null
  requires_provider_safe?: boolean
}

export interface AtlasToolsDoctorResponse {
  status: string
  workspace_hash: string
  tool_count: number
  tools: AtlasToolDoctorItem[]
}

export interface AtlasToolCommandsResponse {
  tool: AtlasToolDoctorItem
  commands: AtlasToolSafeCommand[]
}

export interface AtlasToolAuthorityTool {
  slug: string
  name: string
  execution_tier: 'T0' | 'T1' | 'T2' | 'T3' | string
  expected_cost: string
  default_trigger: string
  authority_role: string
  risk_level: string
  status: string
}

export interface AtlasToolAuthorityGroup {
  authority_group: string
  tool_count: number
  tier_span: string[]
  primary_tools: AtlasToolAuthorityTool[]
  complementary_tools: AtlasToolAuthorityTool[]
  fallback_tools: AtlasToolAuthorityTool[]
  executor_tools: AtlasToolAuthorityTool[]
  high_risk_tools: AtlasToolAuthorityTool[]
  release_heavy_tools: AtlasToolAuthorityTool[]
  missing_primary: boolean
  duplicate_primary: boolean
}

export interface AtlasToolAuthorityRecommendation {
  code: string
  severity: 'low' | 'medium' | 'high' | string
  authority_group: string
  message: string
}

export interface AtlasToolsAuthorityResponse {
  status: string
  generated_at: string
  summary: {
    tool_count: number
    authority_group_count: number
    primary_count: number
    complementary_count: number
    fallback_count: number
    executor_count: number
    high_risk_count: number
    t0_count: number
    t1_count: number
    t2_count: number
    t3_count: number
  }
  tiers: Record<string, { tool_count: number; tools: AtlasToolAuthorityTool[] }>
  authority_groups: AtlasToolAuthorityGroup[]
  recommendations: AtlasToolAuthorityRecommendation[]
}

export interface AtlasToolAuthorityPolicy {
  authority_group: string
  policy: string
  block_severities: string[]
  warn_severities: string[]
  block_reason: string
  warn_reason: string
  description: string
  source?: 'default' | 'workspace' | 'global' | string
  policy_id?: string | null
}

export interface AtlasToolsAuthorityPoliciesResponse {
  status: string
  schema: string
  summary: {
    policy_count: number
    blocking_policy_count: number
    warning_policy_count: number
  }
  policies: AtlasToolAuthorityPolicy[]
}

export interface AtlasToolAuthorityPolicyInput {
  workspace?: string | null
  scope_type?: 'workspace' | 'global' | string
  policy?: string | null
  block_severities?: string[]
  warn_severities?: string[]
  block_reason?: string | null
  warn_reason?: string | null
  description?: string | null
}

export interface AtlasToolAuthorityPolicyMutationResponse {
  status: string
  data: AtlasToolPolicySummary | null
  catalog: AtlasToolsAuthorityPoliciesResponse
}

export interface AtlasToolArtifactSummary {
  id: string
  tool_run_id: string
  type: string
  path: string
  filename: string
  mime_type: string | null
  size_bytes: number
  sha256: string
  is_redacted: boolean
  preview_json: Record<string, unknown>
  created_at: string | null
  updated_at?: string | null
}

export interface AtlasToolFindingSummary {
  id: string
  tool_run_id: string
  rule_id: string | null
  title: string
  message: string | null
  severity: string
  confidence: number | null
  file_path: string | null
  line: number | null
  end_line: number | null
  fingerprint: string | null
  blocks_resolved: boolean
  waiver_id: string | null
  status: string
  metadata_json: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
}

export interface AtlasToolRunSummary {
  id: string
  tool_definition_id: string | null
  tool_slug: string
  surface: string
  workspace_hash: string | null
  workspace: string | null
  run_context_type: string | null
  run_context_id: string | null
  status: string
  required: boolean
  failure_policy: string
  policy_decision: string
  command_hash: string | null
  exit_code: number | null
  started_at: string | null
  finished_at: string | null
  duration_ms: number
  summary_json: Record<string, unknown>
  normalized_result_json: Record<string, unknown>
  policy_decision_json: Record<string, unknown>
  metadata_json: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
  tool?: AtlasToolDefinitionSummary | null
  artifacts?: AtlasToolArtifactSummary[]
  findings?: AtlasToolFindingSummary[]
}

export interface AtlasToolsIndexResponse {
  data: AtlasToolDefinitionSummary[]
}

export interface AtlasToolsEvidenceResponse {
  data: AtlasToolRunSummary[]
}

export interface AtlasToolsEvidenceFilters extends Record<string, unknown> {
  workspace?: string | null
  tool_slug?: string
  tool?: string
  surface?: string
  status?: string
  policy_decision?: string
  run_context_type?: string
  run_context_id?: string
  recipe?: string
  recipe_category?: string
  recipe_recommended_surface?: string
  recipe_blocking_capable?: boolean
  required?: boolean
  limit?: number
}

export interface AtlasToolRunInput {
  workspace?: string | null
  command: string[]
  dry_run?: boolean
  approved?: boolean
  required?: boolean
  network_allowed?: boolean
  max_execution_tier?: 'T0' | 'T1' | 'T2' | 'T3' | string
  sandbox_mode?: 'workspace' | 'worktree' | 'docker' | 'host' | 'none' | string
  privacy_level?: 'standard' | 'sensitive' | 'restricted' | string
  task_type?: string
  requires_provider_safe?: boolean
  env?: Record<string, string> | string[]
  output_limit?: number
}

export interface AtlasToolRunRecipeInput {
  workspace?: string | null
  dry_run?: boolean
  approved?: boolean
  required?: boolean
  env?: Record<string, string> | string[]
  output_limit?: number
}

export interface AtlasToolRunResponse {
  data: AtlasToolRunSummary
}

export interface AtlasToolPolicySummary {
  id: string
  scope_type: 'workspace' | 'global' | string
  scope_id: string | null
  tool_slug: string
  enabled: boolean
  required_when_json: Record<string, unknown> | null
  failure_policy: string | null
  timeout_seconds: number | null
  thresholds_json: Record<string, unknown> | null
  metadata: {
    approved?: boolean
    approved_at?: string
    approved_until?: string
    approved_by?: string
    approval_reason?: string
    network_allowed?: boolean
    max_execution_tier?: string
    sandbox_mode?: string
    privacy_level?: string
    task_type?: string
    requires_provider_safe?: boolean
    workspace_hash?: string
    ttl_hours?: number
    approval_source?: string
    revoked_at?: string
    revocation_source?: string
    [key: string]: unknown
  } | null
  created_at: string | null
  updated_at: string | null
  approval_status?: string
}

export interface AtlasToolsPoliciesResponse {
  data: AtlasToolPolicySummary[]
}

export interface AtlasToolApprovalInput {
  workspace?: string | null
  scope_type?: 'workspace' | 'global' | string
  reason?: string | null
  ttl_hours?: number
  network_allowed?: boolean
  max_execution_tier?: 'T0' | 'T1' | 'T2' | 'T3' | string
  sandbox_mode?: 'workspace' | 'worktree' | 'docker' | 'host' | 'none' | string
  privacy_level?: 'standard' | 'sensitive' | 'restricted' | string
  task_type?: string
  requires_provider_safe?: boolean
}

export interface AtlasToolApprovalResponse {
  data: AtlasToolPolicySummary | null
  approval_status: string
}

export interface AtlasToolsGateResponse {
  status: 'passed' | 'warning' | 'blocked' | string
  allowed: boolean
  filters: Record<string, unknown>
  required_tools: string[]
  fail_statuses: string[]
  summary: {
    run_count: number
    input_run_count?: number
    tool_count: number
    failed_run_count: number
    blocking_failure_count: number
    warning_count: number
    stale_evidence_count?: number
    correlated_finding_group_count?: number
    suppressed_duplicate_finding_count?: number
  }
  freshness?: {
    max_age_minutes: number | null
    stale_blocks: boolean
  }
  selection?: {
    latest_per_tool: boolean
  }
  blocking_failures: Array<Record<string, unknown>>
  warnings: Array<Record<string, unknown>>
  finding_correlations?: Array<Record<string, unknown>>
  runs: Array<Record<string, unknown>>
}

export interface AtlasToolsGateFilters extends AtlasToolsEvidenceFilters {
  required_tool?: string[]
  fail_status?: string[]
  require_evidence?: boolean
  max_age_minutes?: number
  stale_blocks?: boolean
  latest_per_tool?: boolean
}

export interface AtlasVaultHealthSnapshot {
  id: string
  snapshot_date: string
  total_notes: number
  active_notes: number
  inbox_notes: number
  invalid_notes: number
  stale_notes: number
  notes_without_triggers: number
  notes_without_links: number
  activations_7d: number
  useful_activations_7d: number
  health_state: 'healthy' | 'inflated' | 'cold' | 'anxious' | 'mature' | 'needs_attention'
  recommendations: unknown[]
  cognitive_return?: AtlasCognitiveReturn
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasCognitiveReturn {
  version?: string
  score?: number
  label?: string
  useful_activations_7d?: number
  activations_7d?: number
  utility_rate_7d?: number
  response_rate_7d?: number
  active_note_coverage_7d?: number
  activated_notes_7d?: number
  notes_per_useful_activation_7d?: number | null
  interpretation?: string
}

export interface AtlasAuditItem {
  id: string
  type: 'curation_proposal' | 'semantic_activation' | 'ai_audit' | string
  title: string
  status: string
  created_at: string | null
  why: string
  evidence: Record<string, unknown>
  privacy: Record<string, unknown>
  raw_refs: Record<string, unknown>
}

export interface AtlasAuditResponse {
  items: AtlasAuditItem[]
  generated_at: string
}

export type AtlasMemoryReviewQueueKind = 'memory_privacy' | 'verbatim_privacy' | 'relation'

export interface AtlasMemoryReviewQueueItem {
  id: string
  kind: AtlasMemoryReviewQueueKind | string
  review_type: string
  priority: number
  severity: 'low' | 'medium' | 'high' | string
  reason: string | null
  action_hint: string | null
  memory_entry_id?: string | null
  verbatim_memory_id?: string | null
  relation_id?: string | null
  relation_type?: 'duplicate' | 'conflict' | string
  title?: string | null
  summary?: string | null
  scope?: string | null
  project_id?: string | null
  task_id?: string | null
  engineering_run_id?: string | null
  source_type?: string | null
  source_id?: string | null
  source_memory_entry_id?: string | null
  target_memory_entry_id?: string | null
  source_memory?: Record<string, unknown> | null
  target_memory?: Record<string, unknown> | null
  privacy_class?: 'normal' | 'private' | 'sensitive' | 'secret' | string | null
  external_ai_allowed?: boolean | null
  redaction_status?: 'clean' | 'redacted' | string | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface AtlasMemoryReviewQueue {
  generated_at: string
  areas: string[]
  total: number
  counts: {
    memory_privacy: number
    verbatim_privacy: number
    relation: number
    [key: string]: number
  }
  items: AtlasMemoryReviewQueueItem[]
}

export interface AtlasMemoryReviewQueueResponse {
  review_queue: AtlasMemoryReviewQueue
}

export type AtlasMemoryProviderProjectionTarget = 'claude' | 'agents' | 'all'

export type AtlasMemoryProviderProjectionSummary = Record<string, number | undefined>

export interface AtlasMemoryProviderProjectionItem {
  target: string
  path: string | null
  exists?: boolean
  managed?: boolean
  manual_drift?: boolean
  stale?: boolean
  changed?: boolean
  change_type?: 'create' | 'update' | 'adopt' | 'manual_drift' | 'none' | string
  reason?: string | null
  current_line_count?: number
  proposed_line_count?: number
  memory_count?: number
  diff_line_count?: number
  diff?: string
  written?: boolean
  error?: string | null
  inspection?: Record<string, unknown>
  result?: Record<string, unknown>
}

export interface AtlasMemoryProviderProjection {
  ok?: boolean
  status: 'passed' | 'needs_review' | string
  workspace?: string | null
  workspace_exists?: boolean
  target?: string
  targets?: string[]
  summary: AtlasMemoryProviderProjectionSummary
  detail?: string | null
  next_actions?: string[]
  projections?: AtlasMemoryProviderProjectionItem[]
  review?: AtlasMemoryProviderProjection
  applied?: AtlasMemoryProviderProjectionItem[]
  blocked?: AtlasMemoryProviderProjectionItem[]
  failed?: AtlasMemoryProviderProjectionItem[]
}

export interface AtlasMemoryProviderProjectionResponse {
  provider_projection: AtlasMemoryProviderProjection
  audit?: AtlasMemoryProviderProjectionAudit | null
}

export interface AtlasMemoryProviderProjectionParams {
  target?: AtlasMemoryProviderProjectionTarget
  workspace?: string
  max_lines?: number
  memory_limit?: number
  force?: boolean
}

export interface ApplyAtlasMemoryProviderProjectionInput extends AtlasMemoryProviderProjectionParams {
  confirm: boolean
  allow_partial?: boolean
}

export interface AtlasMemoryProviderProjectionAudit {
  id: string
  action: string
  target: AtlasMemoryProviderProjectionTarget | string
  workspace: string | null
  initiator: string
  confirmation_mode: string | null
  status: 'passed' | 'needs_review' | string
  ok: boolean
  summary: AtlasMemoryProviderProjectionSummary
  applied: AtlasMemoryProviderProjectionItem[]
  blocked: AtlasMemoryProviderProjectionItem[]
  failed: AtlasMemoryProviderProjectionItem[]
  review_summary: AtlasMemoryProviderProjectionSummary
  metadata: Record<string, unknown>
  applied_at: string | null
  created_at: string | null
}

export interface AtlasMemoryProviderProjectionAuditsResponse {
  provider_projection_audits: AtlasMemoryProviderProjectionAudit[]
}

export interface AtlasMemoryProviderProjectionAuditSummaryBucket {
  value: string
  total: number
  applied: number
  blocked: number
}

export interface AtlasMemoryProviderProjectionAuditSummary {
  ok: boolean
  period_days: number
  since_at: string
  generated_at: string
  total: number
  applied: number
  blocked: number
  by_target: Record<string, AtlasMemoryProviderProjectionAuditSummaryBucket>
  by_initiator: Record<string, AtlasMemoryProviderProjectionAuditSummaryBucket>
  latest_at: string | null
  oldest_at: string | null
}

export interface AtlasMemoryProviderProjectionAuditSummaryResponse {
  provider_projection_audit_summary: AtlasMemoryProviderProjectionAuditSummary
}

export interface AtlasMemoryProviderProjectionAuditParams {
  target?: AtlasMemoryProviderProjectionTarget
  workspace?: string
  initiator?: 'api' | 'cli' | 'system'
  status?: 'passed' | 'needs_review' | 'confirmation_required' | 'cancelled' | string
  ok?: boolean
  limit?: number
}

export interface AtlasMemoryProviderProjectionAuditSummaryParams extends AtlasMemoryProviderProjectionAuditParams {
  days?: number
}

export interface PurgeAtlasMemoryProviderProjectionAuditInput extends AtlasMemoryProviderProjectionAuditParams {
  older_than_days?: number
  dry_run?: boolean
  confirm?: boolean
  confirmation_fingerprint?: string
}

export interface AtlasMemoryProviderProjectionAuditPurgePolicy {
  authorized: boolean
  requires_operator: boolean
  mode: 'atlas_token' | 'operator_header' | 'operator_token' | string
  header: string
}

export interface AtlasMemoryProviderProjectionAuditPurge {
  ok: boolean
  dry_run: boolean
  older_than_days: number
  cutoff_at?: string
  matched?: number
  deleted: number
  confirmation_fingerprint?: string | null
  filters?: Record<string, unknown>
  policy?: AtlasMemoryProviderProjectionAuditPurgePolicy
  status?: string
}

export interface AtlasMemoryProviderProjectionAuditPurgeResponse {
  provider_projection_audit_purge: AtlasMemoryProviderProjectionAuditPurge
}

export interface AtlasMemoryRegistryEntry {
  id: string
  memory_type: string
  scope_type: string
  scope_id: string | null
  project_id?: string | null
  task_id?: string | null
  engineering_run_id?: string | null
  title: string | null
  body: string
  summary: string | null
  redacted_title?: string | null
  redacted_body?: string | null
  redacted_summary?: string | null
  privacy_class?: string | null
  external_ai_allowed?: boolean | null
  redaction_status?: string | null
  status: string
  metadata: Record<string, unknown>
}

export interface AtlasVerbatimMemoryEntry {
  id: string
  memory_entry_id: string | null
  verbatim_type: string
  scope_type?: string | null
  scope_id?: string | null
  project_id?: string | null
  task_id?: string | null
  engineering_run_id?: string | null
  title: string | null
  verbatim_text?: string | null
  redacted_text: string
  summary: string | null
  privacy_class: string
  external_ai_allowed: boolean
  redaction_status: string
  status: string
  metadata: Record<string, unknown>
}

export interface AtlasMemoryRecallItem {
  rank?: number
  source?: string
  source_ref_type?: string
  source_ref_id?: string
  id?: string
  type?: string
  scope?: string
  title?: string | null
  summary?: string | null
  excerpt?: string | null
  body?: string | null
  snippet?: string | null
  score?: number
  reason?: string | null
  estimated_chars?: number
  [key: string]: unknown
}

export interface AtlasMemoryRecall {
  query: string
  context: Record<string, unknown>
  summary: {
    registry_candidates?: number
    verbatim_candidates?: number
    semantic_candidates?: number
    recall_count?: number
    budget_chars?: number
    policy?: string
    [key: string]: unknown
  }
  recall: AtlasMemoryRecallItem[]
  sources: {
    registry?: AtlasMemoryRecallItem[]
    verbatim?: AtlasMemoryRecallItem[]
    semantic?: AtlasMemoryRecallItem[]
    [key: string]: unknown
  }
}

export interface AtlasMemoryRecallResponse {
  memory_recall: AtlasMemoryRecall
}

export interface AtlasOpenBrainContextPack {
  ok: boolean
  schema_version: number
  context_pack_hash: string
  context_pack: Record<string, unknown>
  context_refs: Record<string, unknown>[]
  summary: {
    context_refs_count?: number
    memory_refs_count?: number
    recall_count?: number
    registry_count?: number
    verbatim_count?: number
    semantic_count?: number
    provider_safe?: boolean
    [key: string]: unknown
  }
  audit?: Record<string, unknown> | null
  prompt_section?: string
}

export interface AtlasOpenBrainContextPackResponse {
  open_brain: AtlasOpenBrainContextPack
}

export interface AtlasOpenBrainAudit {
  id: string
  surface: string
  requester: string | null
  action: string
  status: string
  workspace_hash: string | null
  workspace_label: string | null
  context_pack_hash: string | null
  context_refs_count: number
  memory_refs_count: number
  provider_safe: boolean
  query: Record<string, unknown>
  result_summary: Record<string, unknown>
  accessed_at: string | null
}

export interface AtlasOpenBrainAuditsResponse {
  open_brain_audits: AtlasOpenBrainAudit[]
}

export interface AtlasMemoryMaintenanceStage {
  ok?: boolean
  status?: string
  summary?: Record<string, unknown>
  overall_status?: string
  next_actions?: string[]
  [key: string]: unknown
}

export interface AtlasMemoryQualityTrendDriver {
  kind?: string
  key?: string
  severity?: string
  delta?: number
  current?: number
  previous?: number
  [key: string]: unknown
}

export interface AtlasMemoryQualityTrend {
  status?: string
  current_score?: number
  latest_snapshot_score?: number
  previous_snapshot_score?: number | null
  snapshot_count?: number
  current_delta_from_latest?: number | null
  latest_delta_from_previous?: number | null
  window_delta?: number | null
  latest_snapshot_id?: string | null
  latest_snapshot_at?: string | null
  drivers?: AtlasMemoryQualityTrendDriver[]
  [key: string]: unknown
}

export interface AtlasMemoryQualitySnapshot {
  id: string
  workspace?: string | null
  workspace_hash?: string | null
  source_type?: string | null
  source_id?: string | null
  status: string
  score: number
  components?: Record<string, unknown>
  counts?: Record<string, unknown>
  ratios?: Record<string, unknown>
  issues?: Record<string, unknown>[]
  recommendations?: string[]
  metadata?: Record<string, unknown>
  snapshot_at?: string | null
  created_at?: string | null
}

export interface AtlasMemoryQuality {
  ok: boolean
  status: string
  score: number
  components?: Record<string, number>
  counts?: Record<string, unknown>
  ratios?: Record<string, number>
  issues?: Record<string, unknown>[]
  trend?: AtlasMemoryQualityTrend
  recommendations?: string[]
  latest_snapshot?: Partial<AtlasMemoryQualitySnapshot> | null
  generated_at?: string
  [key: string]: unknown
}

export interface AtlasMemoryQualityResponse {
  memory_quality: AtlasMemoryQuality
}

export interface AtlasMemoryQualityHistory {
  ok: boolean
  status: string
  period_days: number
  since_at: string
  summary: Record<string, unknown>
  snapshots: AtlasMemoryQualitySnapshot[]
  generated_at?: string
}

export interface AtlasMemoryQualityHistoryResponse {
  memory_quality_history: AtlasMemoryQualityHistory
}

export interface AtlasMemoryMaintenance {
  ok: boolean
  status: string
  workspace: string
  dry_run: boolean
  prune: boolean
  writes: {
    knowledge_sync?: boolean
    code_index?: boolean
    provider_projection_apply?: boolean
    [key: string]: boolean | undefined
  }
  stages: {
    knowledge_sync?: AtlasMemoryMaintenanceStage
    code_index?: AtlasMemoryMaintenanceStage
    memory_quality?: AtlasMemoryMaintenanceStage & AtlasMemoryQuality
    memory_quality_snapshot?: AtlasMemoryMaintenanceStage
    provider_projection_status?: AtlasMemoryMaintenanceStage
    provider_projection_apply?: AtlasMemoryMaintenanceStage
    mcp_health?: AtlasMemoryMaintenanceStage
    [key: string]: AtlasMemoryMaintenanceStage | undefined
  }
  generated_at: string
}

export interface AtlasMemoryMaintenanceResponse {
  memory_maintenance: AtlasMemoryMaintenance
}

export async function fetchAtlasToolsDoctor(
  params: { workspace?: string | null } = {},
): Promise<AtlasToolsDoctorResponse> {
  return apiGet<AtlasToolsDoctorResponse>(`/tools/doctor${queryString(params)}`)
}

export async function fetchAtlasToolsAuthority(): Promise<AtlasToolsAuthorityResponse> {
  return apiGet<AtlasToolsAuthorityResponse>('/tools/authority')
}

export async function fetchAtlasToolsAuthorityPolicies(
  params: { workspace?: string | null } = {},
): Promise<AtlasToolsAuthorityPoliciesResponse> {
  return apiGet<AtlasToolsAuthorityPoliciesResponse>(`/tools/authority/policies${queryString(params)}`)
}

export async function configureAtlasToolAuthorityPolicy(
  authorityGroup: string,
  input: AtlasToolAuthorityPolicyInput = {},
): Promise<AtlasToolAuthorityPolicyMutationResponse> {
  return apiPut<AtlasToolAuthorityPolicyMutationResponse>(
    `/tools/authority/policies/${encodeURIComponent(authorityGroup)}`,
    input,
  )
}

export async function revokeAtlasToolAuthorityPolicy(
  authorityGroup: string,
  input: { workspace?: string | null; scope_type?: 'workspace' | 'global' | string } = {},
): Promise<AtlasToolAuthorityPolicyMutationResponse> {
  return apiDelete<AtlasToolAuthorityPolicyMutationResponse>(
    `/tools/authority/policies/${encodeURIComponent(authorityGroup)}${queryString(input as Record<string, unknown>)}`,
  )
}

export async function listAtlasToolEvidence(
  params: AtlasToolsEvidenceFilters = {},
): Promise<AtlasToolsEvidenceResponse> {
  return apiGet<AtlasToolsEvidenceResponse>(`/tools/evidence${queryString(params as Record<string, unknown>)}`)
}

export async function runAtlasTool(
  tool: string,
  input: AtlasToolRunInput,
): Promise<AtlasToolRunResponse> {
  return apiPost<AtlasToolRunResponse>(`/tools/${encodeURIComponent(tool)}/run`, input)
}

export async function fetchAtlasToolCommands(
  tool: string,
  params: { workspace?: string | null } = {},
): Promise<AtlasToolCommandsResponse> {
  return apiGet<AtlasToolCommandsResponse>(`/tools/${encodeURIComponent(tool)}/commands${queryString(params)}`)
}

export async function runAtlasToolRecipe(
  tool: string,
  recipe: string,
  input: AtlasToolRunRecipeInput = {},
): Promise<AtlasToolRunResponse> {
  return apiPost<AtlasToolRunResponse>(
    `/tools/${encodeURIComponent(tool)}/commands/${encodeURIComponent(recipe)}/run`,
    input,
  )
}

export async function listAtlasToolPolicies(
  params: { workspace?: string | null; limit?: number } = {},
): Promise<AtlasToolsPoliciesResponse> {
  return apiGet<AtlasToolsPoliciesResponse>(`/tools/policies${queryString(params)}`)
}

export async function approveAtlasTool(
  tool: string,
  input: AtlasToolApprovalInput = {},
): Promise<AtlasToolApprovalResponse> {
  return apiPost<AtlasToolApprovalResponse>(`/tools/${encodeURIComponent(tool)}/approval`, input)
}

export async function revokeAtlasToolApproval(
  tool: string,
  input: { workspace?: string | null; scope_type?: 'workspace' | 'global' | string } = {},
): Promise<AtlasToolApprovalResponse> {
  return apiDelete<AtlasToolApprovalResponse>(
    `/tools/${encodeURIComponent(tool)}/approval${queryString(input as Record<string, unknown>)}`,
  )
}

export async function evaluateAtlasToolGate(
  params: AtlasToolsGateFilters = {},
): Promise<AtlasToolsGateResponse> {
  return apiGet<AtlasToolsGateResponse>(`/tools/gate${queryString(params as Record<string, unknown>)}`)
}

export async function getVaultHealth(): Promise<AtlasVaultHealthSnapshot> {
  return apiGet<AtlasVaultHealthSnapshot>('/semantic/vault-health')
}

export async function recomputeVaultHealth(): Promise<AtlasVaultHealthSnapshot> {
  return apiPost<AtlasVaultHealthSnapshot>('/semantic/vault-health/recompute', {})
}

export async function listSuggestionAudit(params: { limit?: number } = {}): Promise<AtlasAuditResponse> {
  return apiGet<AtlasAuditResponse>(`/audit/suggestions${queryString(params)}`)
}

export async function listAtlasMemoryReviewQueue(params: {
  area?: 'memory' | 'verbatim' | 'relations' | 'memory_privacy' | 'verbatim_privacy' | 'relation'
  scope_type?: string
  scope_id?: string
  project_id?: string
  task_id?: string
  engineering_run_id?: string
  privacy_class?: string
  relation_status?: string
  include_unreviewed?: boolean
  include_inactive?: boolean
  limit?: number
} = {}): Promise<AtlasMemoryReviewQueueResponse> {
  return apiGet<AtlasMemoryReviewQueueResponse>(`/ai/memory/review-queue${queryString(params)}`)
}

export async function recallAtlasMemory(input: {
  query: string
  context?: Record<string, unknown>
  filters?: Record<string, unknown>
  options?: Record<string, unknown>
}): Promise<AtlasMemoryRecallResponse> {
  return apiPost<AtlasMemoryRecallResponse>('/ai/memory/recall', input)
}

export async function buildAtlasOpenBrainContextPack(input: {
  objective: string
  workspace?: string
  task_type?: 'direct' | 'dev' | 'debug' | 'review' | 'research' | 'decision' | 'memory'
  desired_mode?: string
  agent?: string
  intent?: string
  requester?: string
  include_prompt?: boolean
  payload?: Record<string, unknown>
  options?: Record<string, unknown>
}): Promise<AtlasOpenBrainContextPackResponse> {
  return apiPost<AtlasOpenBrainContextPackResponse>('/ai/open-brain/context-pack', input)
}

export async function listAtlasOpenBrainAudits(params: { limit?: number } = {}): Promise<AtlasOpenBrainAuditsResponse> {
  return apiGet<AtlasOpenBrainAuditsResponse>(`/ai/open-brain/audits${queryString(params)}`)
}

export async function getAtlasMemoryQuality(params: {
  workspace?: string
  type?: string[]
  scope_type?: string
  scope_id?: string
  project_id?: string
  task_id?: string
  engineering_run_id?: string
  source_type?: string
  status?: string
} = {}): Promise<AtlasMemoryQualityResponse> {
  return apiGet<AtlasMemoryQualityResponse>(`/ai/memory/quality${queryString(params)}`)
}

export async function getAtlasMemoryQualityHistory(params: {
  workspace?: string
  days?: number
  limit?: number
  status?: string
  source_type?: string
} = {}): Promise<AtlasMemoryQualityHistoryResponse> {
  return apiGet<AtlasMemoryQualityHistoryResponse>(`/ai/memory/quality/history${queryString(params)}`)
}

export async function runAtlasMemoryMaintenance(input: {
  workspace?: string
  dry_run?: boolean
  sync?: boolean
  index_code?: boolean
  prune?: boolean
  include_drift_audit?: boolean
  apply_projection?: boolean
  confirm?: boolean
}): Promise<AtlasMemoryMaintenanceResponse> {
  return apiPost<AtlasMemoryMaintenanceResponse>('/ai/memory/maintain', input)
}

export async function getAtlasMemoryProviderProjectionStatus(
  params: AtlasMemoryProviderProjectionParams = {},
): Promise<AtlasMemoryProviderProjectionResponse> {
  return apiGet<AtlasMemoryProviderProjectionResponse>(`/ai/memory/provider-projection/status${queryString({ ...params })}`)
}

export async function reviewAtlasMemoryProviderProjection(
  params: AtlasMemoryProviderProjectionParams = {},
): Promise<AtlasMemoryProviderProjectionResponse> {
  return apiGet<AtlasMemoryProviderProjectionResponse>(`/ai/memory/provider-projection/review${queryString({ ...params })}`)
}

export async function applyAtlasMemoryProviderProjection(
  input: ApplyAtlasMemoryProviderProjectionInput,
): Promise<AtlasMemoryProviderProjectionResponse> {
  return apiPost<AtlasMemoryProviderProjectionResponse>('/ai/memory/provider-projection/apply', input)
}

export async function listAtlasMemoryProviderProjectionAudits(
  params: AtlasMemoryProviderProjectionAuditParams = {},
): Promise<AtlasMemoryProviderProjectionAuditsResponse> {
  return apiGet<AtlasMemoryProviderProjectionAuditsResponse>(`/ai/memory/provider-projection/audits${queryString({ ...params })}`)
}

export async function summarizeAtlasMemoryProviderProjectionAudits(
  params: AtlasMemoryProviderProjectionAuditSummaryParams = {},
): Promise<AtlasMemoryProviderProjectionAuditSummaryResponse> {
  return apiGet<AtlasMemoryProviderProjectionAuditSummaryResponse>(`/ai/memory/provider-projection/audits/summary${queryString({ ...params })}`)
}

export async function purgeAtlasMemoryProviderProjectionAudits(
  input: PurgeAtlasMemoryProviderProjectionAuditInput,
): Promise<AtlasMemoryProviderProjectionAuditPurgeResponse> {
  return apiPost<AtlasMemoryProviderProjectionAuditPurgeResponse>('/ai/memory/provider-projection/audits/purge', input)
}

export async function getAtlasMemoryEntry(id: string): Promise<{ memory: AtlasMemoryRegistryEntry }> {
  return apiGet<{ memory: AtlasMemoryRegistryEntry }>(`/ai/memory/${encodeURIComponent(id)}`)
}

export async function reviewAtlasMemoryPrivacy(
  id: string,
  input: {
    privacy_class?: string
    external_ai_allowed?: boolean
    redacted_title?: string | null
    redacted_body?: string | null
    redacted_summary?: string | null
    reviewed_by?: string
    review_note?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<{ memory: AtlasMemoryRegistryEntry }> {
  return apiPost(`/ai/memory/${encodeURIComponent(id)}/privacy`, input)
}

export async function reviewAtlasVerbatimMemory(
  id: string,
  input: {
    privacy_class?: string
    external_ai_allowed?: boolean
    redacted_text?: string | null
    summary?: string | null
    status?: string
    re_redact?: boolean
    reviewed_by?: string
    review_action?: string
    review_note?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<{ verbatim_memory: AtlasVerbatimMemoryEntry }> {
  return apiPost(`/ai/memory/verbatim/${encodeURIComponent(id)}/review`, input)
}

export async function getAtlasVerbatimMemory(
  id: string,
  params: { include_verbatim?: boolean } = {},
): Promise<{ verbatim_memory: AtlasVerbatimMemoryEntry }> {
  return apiGet<{ verbatim_memory: AtlasVerbatimMemoryEntry }>(`/ai/memory/verbatim/${encodeURIComponent(id)}${queryString(params)}`)
}

export async function reviewAtlasMemoryRelation(
  id: string,
  input: {
    status: 'open' | 'resolved' | 'dismissed'
    source_status?: string | null
    target_status?: string | null
    resolution_action?: string | null
    reviewed_by?: string
    review_note?: string | null
    reason?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<{ relation: Record<string, unknown> }> {
  return apiPost(`/ai/memory/relations/${encodeURIComponent(id)}/review`, input)
}
