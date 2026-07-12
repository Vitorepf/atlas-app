// atlas-ai API surface. Split out of client.ts (R2 barrel split).
// The client barrel re-exports this via `export * from './atlasAi'`, so every
// existing deep import keeps working. This file must never import the client
// barrel back (that would be a cycle). HTTP foundation comes from './core'.
import * as FileSystem from 'expo-file-system/legacy'
import { withRetry } from '../richInput/uploadRetry'
import { buildRichInputPayload } from '../richInput/sourceManifest'
import {
  createAtlasAiInteractionStream,
  type AtlasAiStreamDone,
  type AtlasAiStreamEvent,
} from '../atlasAiStreamRuntime'
import {
  apiGet,
  apiPost,
  apiPatch,
  apiDelete,
  apiUpload,
  mobileApiPost,
  apiRequest,
  queryString,
  getApiBase,
  AtlasApiError,
  hydrateApiConfig,
  getMobileDeviceSession,
  getAtlasAuthHeaders,
} from './core'

export type AtlasAiProvider = 'hermes_cli' | 'minimax_m27_cli' | 'claude_cli' | 'codex_cli' | 'gemini_cli' | 'claude_codex'
export type AtlasAiStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'awaiting_user_choice'

export type AtlasAiChoiceAction = 'switch_provider' | 'downgrade_model' | 'wait' | 'fail' | 'cancel' | 'retry_same'

export interface AtlasAiExecutionState {
  strategy?: string | null
  activation_status?: string | null
  blocked_reason?: string | null
  atlas_decide_stage?: string | null
  dependency_state?: string | null
  dependency_job_id?: string | null
  dependent_job_id?: string | null
  dependency_provider?: AtlasAiProvider | string | null
  dependency_model?: string | null
  dependency_timeout_seconds?: number | null
  [key: string]: unknown
}

export interface AtlasAiChoiceOption {
  id: string
  label: string
  description?: string
  action: AtlasAiChoiceAction
  provider?: string
  model?: string | null
  available_at_iso?: string
  cli_command?: string
  reason?: string
}

export type AtlasAiQualityStatus = 'passed' | 'needs_review' | 'failed' | string
export type AtlasAiQualityActionStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'blocked'
  | string

export interface AtlasAiJob {
  id: string
  trace_id: string | null
  client_id: string | null
  kind: 'interaction' | 'curation' | 'analysis' | 'council' | 'skill_test' | 'manual'
  status: AtlasAiStatus
  priority: number
  agent_slug: string
  provider: AtlasAiProvider | string | null
  model: string | null
  input_text: string
  context_refs: unknown[]
  payload: Record<string, unknown>
  atlas_decide_execution?: AtlasAiExecutionState
  atlas_decide_stage?: string | null
  dependency_state?: string | null
  result_text: string | null
  result_json: Record<string, unknown>
  error_code: string | null
  error_message: string | null
  available_at: string | null
  reserved_at: string | null
  started_at: string | null
  finished_at: string | null
  attempts: number
  max_attempts: number
  timeout_seconds: number
  worker_id: string | null
  awaiting_user_choice?: boolean
  choice_options?: AtlasAiChoiceOption[]
  provider_choice_state?: 'pending' | 'resolved' | null
  provider_choice_error_code?: string | null
  provider_reset_at?: string | null
  reset_hint?: string | null
  metadata: Record<string, unknown>
  trace?: AtlasAiTrace
  attempt_history?: AtlasAiJobAttempt[]
  created_at: string
  updated_at: string
}

export interface AtlasAiJobAttempt {
  id: string
  ai_job_id: string
  attempt_number: number
  worker_id: string
  provider: AtlasAiProvider | string
  model: string | null
  command: unknown[]
  command_hash: string | null
  prompt_hash: string
  response_hash: string | null
  status: 'processing' | 'succeeded' | 'failed' | 'timeout' | 'cancelled'
  exit_code: number | null
  duration_ms: number | null
  output_text: string | null
  stdout_excerpt: string | null
  stderr_excerpt: string | null
  error_code: string | null
  error_message: string | null
  started_at: string
  finished_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasAiTrace {
  id: string
  trace_key: string
  thread_id: string | null
  session_id: string | null
  source_type: string
  source_id: string | null
  status: AtlasAiStatus
  operator_input: string
  intent: string | null
  agent_slug: string
  provider: AtlasAiProvider | string | null
  model: string | null
  skill_versions: Record<string, unknown>
  context_refs: unknown[]
  prompt_hash: string | null
  response_hash: string | null
  response_text: string | null
  latency_ms: number | null
  feedback_score: number | null
  feedback_action: string | null
  feedback_comment: string | null
  completed_at: string | null
  metadata: Record<string, unknown>
  atlas_decide_execution?: AtlasAiExecutionState
  attachments?: AtlasAiAttachment[]
  thread?: AtlasAiThread
  session?: AtlasAiSession
  job?: AtlasAiJob
  jobs?: AtlasAiJob[]
  router_decision?: AtlasAiRouterDecision | null
  atlas_decision?: AtlasAiDecision | null
  decision_receipt?: AtlasAiDecisionReceipt | null
  quality_evaluation?: AtlasAiQualityEvaluation | null
  quality_actions?: AtlasAiQualityAction[]
  created_at: string
  updated_at: string
}

export interface AtlasAiRouterDecision {
  id: string
  mode: string
  selected_provider: AtlasAiProvider | string | null
  fallback_provider: AtlasAiProvider | string | null
  signals: Record<string, unknown>
  reason: string
  was_overridden: boolean
  created_at: string | null
  updated_at: string | null
}

export interface AtlasAiDecisionReceipt {
  decision_id?: string
  trace_id?: string
  schema_version?: number
  decision_mode?: 'atlas_decide' | 'manual_override' | string
  candidate_provider?: AtlasAiProvider | string | null
  selected_provider?: AtlasAiProvider | string | null
  selected_model?: string | null
  fallback_provider?: AtlasAiProvider | string | null
  fallback_reason?: string | null
  operator_requested_provider?: AtlasAiProvider | 'auto' | string | null
  requested_provider?: AtlasAiProvider | string | null
  was_overridden?: boolean
  reason?: string
  signals?: Record<string, unknown>
  candidates?: Array<Record<string, unknown>>
  constraints?: Record<string, unknown>
  metrics_snapshot?: Record<string, unknown>
  task_profile?: Record<string, unknown>
  context_strategy?: string | null
  execution_strategy?: string | null
  execution_graph?: Record<string, unknown>
}

export interface AtlasAiDecision {
  id: string
  trace_id: string | null
  router_decision_id: string | null
  policy_version: string
  decision_mode: 'atlas_decide' | 'manual_override' | string
  route_mode: string | null
  task_type: string | null
  risk_level: string | null
  context_strategy: string | null
  execution_strategy: string | null
  selected_provider: AtlasAiProvider | string | null
  selected_model: string | null
  fallback_provider: AtlasAiProvider | string | null
  operator_requested_provider: AtlasAiProvider | 'auto' | string | null
  requested_provider: AtlasAiProvider | string | null
  was_overridden: boolean
  confidence_score: number | null
  signals: Record<string, unknown>
  candidates: Array<Record<string, unknown>>
  constraints: Record<string, unknown>
  metrics_snapshot: Record<string, unknown>
  task_profile: Record<string, unknown>
  execution_graph: Record<string, unknown>
  reason: string
  created_at: string | null
  updated_at: string | null
}

export interface AtlasAiAttachment {
  id: string
  kind: 'image' | 'file' | string
  name: string
  mime_type: string | null
  bytes: number | null
  sha256?: string | null
  source?: string | null
  text_available?: boolean
  text_truncated?: boolean
  pdf_page_count?: number | null
  pdf_processing_status?: string | null
  pdf_chunk_count?: number | null
  pdf_render_status?: string | null
  pdf_rendered_page_count?: number | null
  pdf_ocr_status?: string | null
  pdf_visual_understanding_status?: string | null
  office_processing_status?: string | null
  office_render_status?: string | null
  office_rendered_page_count?: number | null
  content_url?: string | null
  preview_pages?: Array<{
    page: number
    url: string
  }>
}

export interface AtlasAiAttachmentSearchResult {
  id: string
  trace_id: string | null
  thread_id: string | null
  attachment_id: string
  attachment_kind: string
  source_name: string | null
  mime_type: string | null
  unit_type: string
  unit_number: number | null
  title: string | null
  excerpt: string
  visual_caption: string | null
  metadata: Record<string, unknown> | null
  indexed_at: string | null
  score?: number | null
}

export interface AtlasAiAttachmentSearchResponse {
  results: AtlasAiAttachmentSearchResult[]
}

export interface AtlasAiSession {
  id: string
  thread_id: string
  provider: AtlasAiProvider | string | null
  model: string | null
  title: string | null
  status: 'active' | 'closed' | 'archived' | string
  started_at: string | null
  ended_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasAiMessage {
  id: string
  thread_id: string
  trace_id: string | null
  position: number
  role: 'user' | 'assistant' | 'system' | 'tool' | 'summary' | string
  status: 'draft' | 'final' | 'failed' | 'redacted' | string
  content: string
  provider: AtlasAiProvider | string | null
  model: string | null
  agent_slug: string | null
  token_estimate: number | null
  occurred_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasAiThread {
  id: string
  title: string
  summary: string | null
  status: 'active' | 'archived' | 'closed' | string
  surface: string
  workspace: string | null
  source_type: string | null
  source_id: string | null
  last_trace_id: string | null
  last_provider: AtlasAiProvider | string | null
  message_count: number
  last_message_at: string | null
  metadata: Record<string, unknown>
  messages?: AtlasAiMessage[]
  active_session?: AtlasAiSession | null
  active_state?: AtlasAiSessionState | null
  latest_compaction?: AtlasAiCompaction | null
  latest_provider_handoff?: AtlasAiProviderHandoff | null
  last_trace?: AtlasAiTrace
  created_at: string
  updated_at: string
}

export interface AtlasAiSessionState {
  id: string
  thread_id: string
  session_id: string | null
  version: number
  active: boolean
  objective: string | null
  current_phase: string | null
  current_topic: string | null
  user_position: string | null
  decisions: unknown[]
  open_loops: unknown[]
  next_steps: unknown[]
  relevant_artifacts: unknown[]
  constraints: unknown[]
  provider_context: Record<string, unknown>
  quality_notes: unknown[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasAiCompaction {
  id: string
  thread_id: string
  session_id: string | null
  reason: string
  source_position_start: number | null
  source_position_end: number | null
  source_message_count: number
  summary: string
  structured_state: Record<string, unknown>
  token_estimate_before: number | null
  token_estimate_after: number | null
  quality_gate_status: string
  provider: string | null
  model: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasAiProviderHandoff {
  id: string
  thread_id: string
  session_id: string | null
  from_provider: string | null
  to_provider: string
  reason: string
  brief_text: string
  brief_json: Record<string, unknown>
  compaction_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasAiContextSnapshot {
  id: string
  trace_id: string | null
  thread_id: string | null
  session_id: string | null
  provider: string | null
  model: string | null
  prompt_hash: string | null
  context_pack: Record<string, unknown>
  messages_included: unknown[]
  compaction_id: string | null
  provider_handoff_id: string | null
  token_estimate: number | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface AtlasAiQualityEvaluation {
  id: string
  trace_id: string | null
  thread_id: string | null
  session_id: string | null
  provider: AtlasAiProvider | string | null
  model: string | null
  agent_slug: string | null
  evaluator_version: string
  score: number
  status: AtlasAiQualityStatus
  dimensions: Record<string, unknown>
  flags: Array<Record<string, unknown>>
  suggested_actions: unknown[]
  metadata: Record<string, unknown>
  actions?: AtlasAiQualityAction[]
  created_at: string
  updated_at: string
}

export interface AtlasAiQualityAction {
  id: string
  evaluation_id: string | null
  trace_id: string | null
  remediation_trace_id: string | null
  thread_id: string | null
  session_id: string | null
  action_type: string
  status: AtlasAiQualityActionStatus
  priority: number
  reason: string
  flags: unknown[]
  payload: Record<string, unknown>
  result: Record<string, unknown>
  error_message: string | null
  dedupe_key: string | null
  completed_at: string | null
  remediation_trace?: AtlasAiTrace | null
  created_at: string
  updated_at: string
}

export interface AtlasAiProviderHealth {
  id: string | null
  provider: AtlasAiProvider | string
  provider_label?: string | null
  enabled?: boolean
  model?: string | null
  model_label?: string | null
  model_tier?: string | null
  model_source?: string | null
  model_alias?: string | null
  model_selection?: 'auto' | 'fixed' | string | null
  default_model_alias?: string | null
  model_catalog?: AtlasAiProviderModelCatalogItem[]
  allow_auto?: boolean
  allow_manual?: boolean
  fallback_model?: string | null
  fallback_model_label?: string | null
  premium_model?: string | null
  premium_model_label?: string | null
  status: 'online' | 'degraded' | 'offline' | 'unknown'
  checked_at: string | null
  last_success_at: string | null
  last_failure_at: string | null
  total_jobs_24h: number
  failed_jobs_24h: number
  p50_latency_ms: number | null
  operational_pain_score: number
  message: string | null
  metadata: Record<string, unknown>
  created_at: string | null
}

export interface AtlasAiWorkerEvent {
  id: string
  worker_id: string
  provider: AtlasAiProvider | string | null
  ai_job_id: string | null
  ai_job_attempt_id: string | null
  event_type: string
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical'
  message: string
  metadata: Record<string, unknown>
  occurred_at: string | null
  created_at: string | null
}

export interface AtlasAiQueueByProvider {
  provider: AtlasAiProvider | string | null
  queued: number
  processing: number
  awaiting_user_choice?: number
  failed: number
}

export interface AtlasAiQueueStatus {
  queued: number
  processing: number
  awaiting_user_choice?: number
  failed: number
  by_provider?: AtlasAiQueueByProvider[]
}

export interface AtlasAiWorkerStatus {
  provider: AtlasAiProvider | string
  status: 'running' | 'stale' | 'stopped' | 'unknown' | string
  worker_id: string | null
  event_type: string | null
  severity: string | null
  message: string | null
  occurred_at: string | null
  age_seconds: number | null
}

export interface AtlasAiProviderUsage {
  provider: AtlasAiProvider | string
  model?: string | null
  traces: number
  failed_traces: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_tokens: number
  visible_tokens: number
  cost_microusd: number
  cost_usd_estimate: number
  unknown_cost_count: number
  last_computed_at: string | null
}

export interface AtlasAiBudgetUsage {
  visible_tokens: number
  total_tokens: number
  estimated_tokens: number
  traces: number
  max_visible_tokens: number | null
  warn_visible_tokens: number | null
  remaining_visible_tokens: number | null
  status: 'ok' | 'warning' | 'blocked' | string
}

export interface AtlasAiProviderBudget extends AtlasAiBudgetUsage {
  provider: AtlasAiProvider | string
}

export interface AtlasAiBudgetStatus {
  available: boolean
  enabled: boolean
  mode: 'monitor' | 'block' | string
  window_hours: number
  totals: AtlasAiBudgetUsage
  providers: AtlasAiProviderBudget[]
}

export interface AtlasAiUsageWindow {
  available: boolean
  window_hours: number
  since: string | null
  by_provider: AtlasAiProviderUsage[]
  by_model?: AtlasAiProviderUsage[]
  totals: AtlasAiProviderUsage | null
}

export interface AtlasAiActiveJob {
  id: string
  trace_id: string | null
  kind?: string | null
  priority?: number | null
  provider: AtlasAiProvider | string | null
  model: string | null
  model_label?: string | null
  model_tier?: string | null
  model_source?: string | null
  atlas_decide_execution?: AtlasAiExecutionState
  atlas_decide_stage?: string | null
  atlas_decide_strategy?: string | null
  dependency_state?: string | null
  dependency_job_id?: string | null
  dependent_job_id?: string | null
  dependency_provider?: AtlasAiProvider | string | null
  dependency_model?: string | null
  dependency_deadline_at?: string | null
  status: string
  attempts: number
  worker_id: string | null
  available_at: string | null
  started_at: string | null
  updated_at: string | null
}

export interface AtlasAiProviderModelPolicy {
  provider: AtlasAiProvider | string
  provider_label?: string | null
  enabled?: boolean
  model: string | null
  model_label: string | null
  model_tier: string | null
  model_source: string | null
  model_alias?: string | null
  model_selection?: 'auto' | 'fixed' | string | null
  default_model_alias?: string | null
  model_catalog?: AtlasAiProviderModelCatalogItem[]
  allow_auto: boolean
  allow_manual: boolean
  fallback_model?: string | null
  fallback_model_label?: string | null
  premium_model?: string | null
  premium_model_label?: string | null
}

export interface AtlasAiProviderModelCatalogItem {
  key: string
  alias?: string | null
  model?: string | null
  label: string
  tier?: string | null
  description?: string | null
}

export interface AtlasAiModelPolicy {
  source?: string
  updated_at?: string | null
  default_tier: string
  council_allow_auto: boolean
  providers: AtlasAiProviderModelPolicy[]
}

export interface AtlasAiDomainProfile {
  id: string
  label: string
  status: string
  default_flow?: string | null
  orchestrator?: string | null
  runtime_family?: string | null
  description?: string | null
  autonomy_default?: string | null
  background_allowed?: boolean
  model_policy?: Record<string, unknown>
  context_policy?: Record<string, unknown>
  skill_policy?: Record<string, unknown>
  tool_policy?: Record<string, unknown>
  memory_policy?: Record<string, unknown>
  gate_policy?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface AtlasAiFlowProfile {
  id: string
  domain_id: string
  label: string
  status: string
  orchestrator?: string | null
  runtime?: string | null
  description?: string | null
  autonomy?: string | null
  background_allowed?: boolean
  requires_human_approval_for_destructive?: boolean
  model_policy?: Record<string, unknown>
  context_policy?: Record<string, unknown>
  skill_policy?: Record<string, unknown>
  tool_policy?: Record<string, unknown>
  memory_policy?: Record<string, unknown>
  gate_policy?: Record<string, unknown>
  execution_policy?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface AtlasAiPolicyProfileRegistry {
  schema_version: number
  source: string
  domains: AtlasAiDomainProfile[]
  flows: AtlasAiFlowProfile[]
}

export interface AtlasAiPolicyProfilesResponse {
  generated_at?: string
  profile_registry: AtlasAiPolicyProfileRegistry
}

export interface AtlasAiDomainCatalogOnboarding {
  status: string
  completed_count: number
  total_count: number
  completed_phases: string[]
  missing_phases: string[]
}

export interface AtlasAiDomainCatalogDomain {
  id: string
  label: string
  default_flow: string
  orchestrator: string
  orchestrator_maturity: string
  runtime_family: string
  autonomy_default: string
  background_allowed: boolean
  flow_count: number
  onboarding: AtlasAiDomainCatalogOnboarding
}

export interface AtlasAiDomainCatalogFlow {
  id: string
  domain_id: string
  label: string
  runtime: string
  orchestrator: string
  orchestrator_maturity: string
  autonomy: string
  background_allowed: boolean
  destructive_requires_approval: boolean
  executor_preference: string
}

export interface AtlasAiDomainCatalogOrchestrator {
  id: string
  class: string
  maturity: string
  implemented_contract: boolean
  domains: string[]
  flows: string[]
}

export interface AtlasAiDomainCatalogResponse {
  schema_version: number
  status: string
  source: string
  filters: {
    domain: string | null
    flow: string | null
    maturity: string | null
  }
  summary: {
    domains: number
    flows: number
    orchestrators: number
    implemented_orchestrators: number
    scaffold_orchestrators: number
    planned_orchestrators: number
    ready_domains: number
    executable_incomplete_domains: number
  }
  domains: AtlasAiDomainCatalogDomain[]
  flows: AtlasAiDomainCatalogFlow[]
  orchestrators: AtlasAiDomainCatalogOrchestrator[]
  validation: {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
  generated_at: string
}

export interface AtlasAiDomainCatalogParams {
  domain?: string | null
  flow?: string | null
  maturity?: 'implemented' | 'scaffold' | 'planned' | string | null
}

export interface AtlasAiPolicyPreviewResponse {
  generated_at?: string
  profile: Record<string, unknown>
  effective_policy: Record<string, unknown>
  policy_merge_receipt: Record<string, unknown>
  legacy_policy: Record<string, unknown>
}

export interface AtlasAiPolicyPreviewInput {
  profile_id?: string
  surface?: string
  mode?: string
  task?: string
  payload?: Record<string, unknown>
  ai_policy_override?: Record<string, unknown>
}

export type AtlasAiDomainProfilePatch = Partial<Pick<
  AtlasAiDomainProfile,
  | 'label'
  | 'status'
  | 'default_flow'
  | 'orchestrator'
  | 'runtime_family'
  | 'description'
  | 'autonomy_default'
  | 'background_allowed'
  | 'model_policy'
  | 'context_policy'
  | 'skill_policy'
  | 'tool_policy'
  | 'memory_policy'
  | 'gate_policy'
  | 'metadata'
>>

export type AtlasAiFlowProfilePatch = Partial<Pick<
  AtlasAiFlowProfile,
  | 'label'
  | 'status'
  | 'orchestrator'
  | 'runtime'
  | 'description'
  | 'autonomy'
  | 'background_allowed'
  | 'requires_human_approval_for_destructive'
  | 'model_policy'
  | 'context_policy'
  | 'skill_policy'
  | 'tool_policy'
  | 'memory_policy'
  | 'gate_policy'
  | 'execution_policy'
  | 'metadata'
>>

export interface AtlasAiDomainProfileUpdateResponse {
  domain_profile: AtlasAiDomainProfile
  profile_registry: AtlasAiPolicyProfileRegistry
}

export interface AtlasAiFlowProfileUpdateResponse {
  flow_profile: AtlasAiFlowProfile
  profile_registry: AtlasAiPolicyProfileRegistry
  effective_policy?: Record<string, unknown>
}

export interface AtlasAiRuntimeSettings {
  source?: string
  updated_at?: string | null
  default_provider_selection?: 'auto' | 'fixed' | string
  default_provider: AtlasAiProvider | string
  default_tier: string
  council_allow_auto: boolean
  providers: Record<string, Partial<AtlasAiProviderModelPolicy>>
  budget: {
    enabled: boolean
    mode: string
    window_hours: number
    max_visible_tokens: number | null
    warn_visible_tokens: number | null
    providers: Record<string, {
      max_visible_tokens: number | null
      warn_visible_tokens: number | null
    }>
  }
}

export interface AtlasAiRuntimeSettingsPatch {
  default_provider?: AtlasAiProvider | string
  default_provider_selection?: 'auto' | 'fixed' | string
  default_tier?: string
  council_allow_auto?: boolean
  providers?: Record<string, {
    model?: string | null
    model_label?: string | null
    model_tier?: string | null
    model_identity?: string | null
    default_model_alias?: string | null
    allow_auto?: boolean
    allow_manual?: boolean
  }>
  budget?: {
    enabled?: boolean
    mode?: 'monitor' | 'block' | string
    window_hours?: number
    max_visible_tokens?: number | null
    warn_visible_tokens?: number | null
    providers?: Record<string, {
      max_visible_tokens?: number | null
      warn_visible_tokens?: number | null
    }>
  }
}

export interface AiProvidersStatusResponse {
  generated_at?: string
  runtime_settings?: AtlasAiRuntimeSettings
  provider_choice_catalog?: {
    schema_version?: string
    default_provider_selection?: 'auto' | 'fixed' | string
    default_provider?: AtlasAiProvider | string
    default_provider_options?: Array<{
      key: string
      provider?: AtlasAiProvider | string | null
      label: string
      description?: string | null
    }>
    providers?: AtlasAiProviderModelPolicy[]
  }
  default_provider_selection?: 'auto' | 'fixed' | string
  default_provider?: AtlasAiProvider | string
  default_model?: AtlasAiProviderModelPolicy
  model_policy?: AtlasAiModelPolicy
  budget?: AtlasAiBudgetStatus
  queue: AtlasAiQueueStatus
  workers?: AtlasAiWorkerStatus[]
  providers: AtlasAiProviderHealth[]
  usage_24h?: AtlasAiUsageWindow
  active_jobs?: AtlasAiActiveJob[]
  recent_events: AtlasAiWorkerEvent[]
}

export interface AiObservabilityResponse {
  window: {
    since: string
    until: string
  }
  threads: {
    active: number
    atlas_cli: number
  }
  traces: {
    total: number
    by_status: Record<string, number>
    by_provider: Record<string, number>
  }
  jobs: {
    queued: number
    processing: number
    failed_24h: number
  }
  quality: {
    available: boolean
    total?: number
    average_score?: number
    by_status?: Record<string, number>
    recent_needs_review?: Array<{
      id: string
      trace_id: string | null
      thread_id: string | null
      provider: AtlasAiProvider | string | null
      score: number
      status: AtlasAiQualityStatus
      flags: string[]
      created_at: string | null
    }>
  }
  metrics?: AtlasAiTelemetryScorecard
  metrics_health?: AtlasAiTelemetryHealth
  actions: {
    available: boolean
    by_status?: Record<string, number>
    open?: number
    recent?: Array<{
      id: string
      trace_id: string | null
      remediation_trace_id: string | null
      action_type: string
      status: AtlasAiQualityActionStatus
      priority: number
      reason: string
      created_at: string | null
    }>
  }
}

export interface AtlasAiTelemetryScorecard {
  available: boolean
  window?: {
    since: string
    until: string
  }
  totals?: {
    traces: number
    final_quality_avg: number | null
    final_efficiency_avg: number | null
    context_efficiency_avg: number | null
    total_latency_avg_ms: number | null
    app_visible_avg_ms: number | null
    cost_microusd_sum: number
    unknown_cost_count: number
    estimated_cost_count?: number
    actual_cost_count?: number
    operational_estimate_cost_count?: number
    first_pass_success_rate: number | null
    needed_remediation_rate: number | null
    backgrounded_during_run_rate: number | null
    recovered_from_pending_count: number
    reask_detected_count: number
    atlas_decide_trace_count?: number
    atlas_decide_multi_stage_count?: number
    atlas_decide_degraded_count?: number
  }
  by_surface?: AtlasAiTelemetryScorecardBucket[]
  by_provider?: AtlasAiTelemetryScorecardBucket[]
  by_task_type?: AtlasAiTelemetryScorecardBucket[]
  by_atlas_decide_execution_strategy?: AtlasAiTelemetryAtlasBucket[]
  by_atlas_decide_context_strategy?: AtlasAiTelemetryAtlasBucket[]
  atlas_decide?: {
    available: boolean
    traces: number
    multi_stage_count: number
    multi_stage_rate: number | null
    degraded_count: number
    degraded_rate: number | null
    by_execution_strategy?: AtlasAiTelemetryAtlasBucket[]
    by_context_strategy?: AtlasAiTelemetryAtlasBucket[]
    by_selected_provider?: AtlasAiTelemetryAtlasBucket[]
    by_scout_provider?: AtlasAiTelemetryAtlasBucket[]
  }
  risks?: Record<string, number>
  recent_low_score?: Array<Record<string, unknown>>
}

export interface AtlasAiTelemetryScorecardBucket {
  bucket: string
  traces: number
  quality_avg: number | null
  efficiency_avg: number | null
  latency_avg_ms: number | null
  cost_microusd_sum: number
  unknown_cost_count?: number
  estimated_cost_count?: number
  first_pass_success_rate: number | null
  needed_remediation_rate: number | null
}

export interface AtlasAiTelemetryAtlasBucket {
  bucket: string
  traces: number
  quality_avg: number | null
  efficiency_avg: number | null
  latency_avg_ms: number | null
  cost_microusd_sum: number
  multi_stage_rate: number | null
  degraded_rate: number | null
  providers_used?: string[]
}

export interface AtlasAiTelemetryHealthIssue {
  key: string
  severity: 'watch' | 'warning' | 'critical' | string
  value: unknown
  threshold: unknown
  summary: string
}

export interface AtlasAiMissingCostRate {
  provider: string | null
  model: string | null
  reason: string
  can_import_rate: boolean
  traces: number
  latest_computed_at: string | null
  rate_template?: Record<string, unknown> | null
}

export interface AtlasAiTelemetryHealth {
  available: boolean
  status: 'healthy' | 'watch' | 'warning' | 'critical' | 'unknown' | string
  health_score: number | null
  window?: {
    since: string
    until: string
  }
  thresholds?: Record<string, unknown>
  issues: AtlasAiTelemetryHealthIssue[]
  evidence?: {
    missing_cost_rates?: AtlasAiMissingCostRate[]
    [key: string]: unknown
  }
  actions: string[]
  scorecard?: AtlasAiTelemetryScorecard
}

export interface AtlasAiTelemetryEventInput {
  event_key?: string
  correlation_id?: string
  trace_id?: string | null
  thread_id?: string | null
  session_id?: string | null
  ai_job_id?: string | null
  ai_job_attempt_id?: string | null
  client_id?: string | null
  surface: 'mobile' | 'cli' | 'server' | 'worker' | 'scheduler' | 'eval'
  runtime?: 'ios' | 'android' | 'mac_cli' | 'laravel' | 'worker' | 'scheduler' | 'test' | null
  app_version?: string | null
  cli_version?: string | null
  provider?: string | null
  model?: string | null
  agent_slug?: string | null
  event_name: string
  event_phase?: string | null
  occurred_at_client?: string | null
  duration_ms?: number | null
  numeric_value?: number | null
  unit?: string | null
  metadata?: Record<string, unknown>
  privacy?: Record<string, unknown>
  schema_version?: number
}

export interface AtlasAiTelemetryBatchResponse {
  accepted: number
  duplicates: number
  rejected: number
  events: Array<{ id: string; event_key: string; duplicate: boolean }>
  errors: Array<{ index: number; message: string }>
}

export interface AtlasAiTelemetryScorecardResponse {
  scorecard: AtlasAiTelemetryScorecard
  health?: AtlasAiTelemetryHealth
  recomputed: number | null
}

export interface AtlasAiProviderCostRate {
  id: string
  provider: string
  model: string
  input_microusd_per_1k: number
  output_microusd_per_1k: number
  currency: string
  effective_from: string | null
  effective_until: string | null
  metadata: Record<string, unknown>
  created_at: string | null
}

export interface AtlasAiOutcomeLink {
  id: string
  trace_id: string | null
  thread_id: string | null
  session_id: string | null
  outcome_type: string
  target_type: string | null
  target_id: string | null
  value_score: number | null
  confidence: number | null
  source: string
  occurred_at: string | null
  metadata: Record<string, unknown>
  created_at: string | null
}

export interface AiThreadsResponse {
  threads: AtlasAiThread[]
}

export interface AiInteractionsResponse {
  traces: AtlasAiTrace[]
}

export interface AiJobsResponse {
  jobs: AtlasAiJob[]
}

export interface AiQualityActionsResponse {
  actions: AtlasAiQualityAction[]
}

export interface AiInteractionImageAttachmentInput {
  uri: string
  fileName: string
  mimeType: string
  size?: number | null
  width?: number | null
  height?: number | null
  source?: string | null
}

export interface AiInteractionFileAttachmentInput {
  uri: string
  fileName: string
  mimeType: string
  size?: number | null
  source?: string | null
}

export interface CreateAiInteractionInput {
  input_text: string
  client_id?: string
  thread_id?: string
  session_id?: string
  new_thread?: boolean
  agent_slug?: string
  provider?: AtlasAiProvider | string
  kind?: AtlasAiJob['kind']
  source_type?: string
  source_id?: string
  priority?: number
  include_semantic_context?: boolean
  context_note_limit?: number
  payload?: Record<string, unknown>
  image_attachments?: AiInteractionImageAttachmentInput[]
  file_attachments?: AiInteractionFileAttachmentInput[]
  on_upload_progress?: (progress: AiInteractionUploadProgress) => void
}

export interface AiInteractionUploadProgress {
  phase: 'starting' | 'uploading' | 'finalizing' | 'complete'
  fileName: string
  fileIndex: number
  fileCount: number
  sentBytes: number
  totalBytes: number
  percent: number
}

export async function createAiInteraction(input: CreateAiInteractionInput): Promise<{ trace: AtlasAiTrace }> {
  const imageAttachments = input.image_attachments ?? []
  const fileAttachments = input.file_attachments ?? []
  if (imageAttachments.length > 0 || fileAttachments.length > 0) {
    let chunkedUploadReady = false
    let uploadedImages: string[] = []
    let uploadedDocuments: string[] = []
    let totalBytes = 0
    const allUploads = [
      ...imageAttachments.map((attachment) => ({ kind: 'image' as const, attachment })),
      ...fileAttachments.map((attachment) => ({ kind: 'file' as const, attachment })),
    ]

    try {
      let uploadedBytesBefore = 0
      totalBytes = await totalAttachmentBytes(allUploads.map((item) => item.attachment))

      for (let index = 0; index < allUploads.length; index++) {
        const item = allUploads[index]
        const upload = await uploadAiAttachmentInChunks(
          item.attachment,
          item.kind,
          index,
          allUploads.length,
          totalBytes,
          uploadedBytesBefore,
          input.on_upload_progress,
        )
        uploadedBytesBefore += upload.bytes
        if (item.kind === 'image') uploadedImages.push(upload.id)
        else uploadedDocuments.push(upload.id)
      }

      chunkedUploadReady = true
    } catch {
      // Fallback: mantém compatibilidade em ambientes onde leitura em chunks
      // por file:// não está disponível. Erros da criação da interação não
      // entram aqui, para evitar reenviar anexos depois de um 4xx/5xx real.
    }

    if (chunkedUploadReady) {
      input.on_upload_progress?.({
        phase: 'finalizing',
        fileName: 'anexos',
        fileIndex: allUploads.length,
        fileCount: allUploads.length,
        sentBytes: totalBytes,
        totalBytes,
        percent: 1,
      })

      const {
        image_attachments: _imageAttachments,
        file_attachments: _fileAttachments,
        on_upload_progress: _onUploadProgress,
        ...jsonInput
      } = input

      // Slice 5b · rich_input_payload canon v1 (atlas.rich_input.payload.v1).
      // Forward-compat: backend hoje só consome uploaded_images/documents,
      // mas Forge/Dev futuros vão ler o manifest pra audit trail + dedup
      // por source_hash. Mobile não popula source_hash (custo CPU SHA-256
      // em iPhone) · backend pode preencher após processar.
      const richInputPayload = buildRichInputPayload({
        imageAttachments: imageAttachments,
        uploadedImageIds: uploadedImages,
        fileAttachments: fileAttachments,
        uploadedDocumentIds: uploadedDocuments,
        inputText: input.input_text,
      })

      const response = await apiPost<{ trace: AtlasAiTrace }>('/ai/interactions', {
        ...jsonInput,
        uploaded_images: uploadedImages,
        uploaded_documents: uploadedDocuments,
        rich_input_payload: richInputPayload,
      })

      input.on_upload_progress?.({
        phase: 'complete',
        fileName: 'anexos',
        fileIndex: allUploads.length,
        fileCount: allUploads.length,
        sentBytes: totalBytes,
        totalBytes,
        percent: 1,
      })

      return response
    }

    const form = new FormData()
    appendInteractionForm(form, 'input_text', input.input_text)
    appendInteractionForm(form, 'client_id', input.client_id)
    appendInteractionForm(form, 'thread_id', input.thread_id)
    appendInteractionForm(form, 'session_id', input.session_id)
    appendInteractionForm(form, 'new_thread', input.new_thread)
    appendInteractionForm(form, 'agent_slug', input.agent_slug)
    appendInteractionForm(form, 'provider', input.provider)
    appendInteractionForm(form, 'kind', input.kind)
    appendInteractionForm(form, 'source_type', input.source_type)
    appendInteractionForm(form, 'source_id', input.source_id)
    appendInteractionForm(form, 'priority', input.priority)
    appendInteractionForm(form, 'include_semantic_context', input.include_semantic_context)
    appendInteractionForm(form, 'context_note_limit', input.context_note_limit)
    appendInteractionForm(form, 'payload', JSON.stringify(input.payload ?? {}))
    appendInteractionForm(form, 'rich_input_payload', JSON.stringify(buildRichInputPayload({
      imageAttachments: imageAttachments,
      uploadedImageIds: [],
      fileAttachments: fileAttachments,
      uploadedDocumentIds: [],
      inputText: input.input_text,
    })))

    imageAttachments.forEach((attachment, index) => {
      form.append('images[]', {
        uri: attachment.uri,
        name: attachment.fileName || `atlas-image-${index + 1}.png`,
        type: attachment.mimeType || 'image/png',
      } as unknown as Blob)
    })

    fileAttachments.forEach((attachment, index) => {
      form.append('documents[]', {
        uri: attachment.uri,
        name: attachment.fileName || `atlas-file-${index + 1}`,
        type: attachment.mimeType || 'application/octet-stream',
      } as unknown as Blob)
    })

    return apiUpload<{ trace: AtlasAiTrace }>('/ai/interactions', form)
  }

  const {
    image_attachments: _imageAttachments,
    file_attachments: _fileAttachments,
    ...jsonInput
  } = input
  const richInputPayload = buildRichInputPayload({
    imageAttachments: [],
    uploadedImageIds: [],
    fileAttachments: [],
    uploadedDocumentIds: [],
    inputText: input.input_text,
  })
  const hasRichInputPayload = richInputPayload.url_attachments.length > 0
    || richInputPayload.source_manifest.length > 0
    || richInputPayload.text_blocks.length > 0

  return apiPost<{ trace: AtlasAiTrace }>('/ai/interactions', {
    ...jsonInput,
    ...(hasRichInputPayload ? { rich_input_payload: richInputPayload } : {}),
  })
}

export function streamAiInteraction(
  traceId: string,
  handlers: {
    onEvent?: (event: AtlasAiStreamEvent) => void
    onDone?: (event: AtlasAiStreamDone) => void
    onError?: (error: unknown) => void
  },
  options: {
    after?: number
    timeoutSeconds?: number
    maxReconnects?: number
  } = {},
): { cancel: () => void } {
  return createAtlasAiInteractionStream({
    traceId,
    handlers,
    options,
    prepare: hydrateApiConfig,
    getApiBase,
    getAuthHeaders: getAtlasAuthHeaders,
    createHttpError: (status, url) => new AtlasApiError(`Atlas stream ${status}`, status, url, null),
  })
}

const AI_UPLOAD_CHUNK_BYTES = 768 * 1024

async function uploadAiAttachmentInChunks(
  attachment: AiInteractionImageAttachmentInput | AiInteractionFileAttachmentInput,
  kind: 'image' | 'file',
  index: number,
  fileCount: number,
  aggregateTotalBytes: number,
  aggregateUploadedBefore: number,
  onProgress?: (progress: AiInteractionUploadProgress) => void,
): Promise<{ id: string; bytes: number }> {
  const info = await FileSystem.getInfoAsync(attachment.uri)
  const bytes = typeof attachment.size === 'number'
    ? attachment.size
    : (info.exists && typeof info.size === 'number' ? info.size : 0)
  if (bytes <= 0) throw new Error('Arquivo local sem tamanho para upload em chunks.')

  const fileName = attachment.fileName || (kind === 'image' ? `atlas-image-${index + 1}.png` : `atlas-file-${index + 1}`)
  onProgress?.({
    phase: 'starting',
    fileName,
    fileIndex: index + 1,
    fileCount,
    sentBytes: aggregateUploadedBefore,
    totalBytes: aggregateTotalBytes,
    percent: aggregateTotalBytes > 0 ? aggregateUploadedBefore / aggregateTotalBytes : 0,
  })

  const start = await apiPost<{
    upload: { id: string; received_chunks?: number[] }
  }>('/ai/uploads/chunks/start', {
    client_upload_id: `${kind}-${stableUploadKey(attachment.uri, fileName, bytes)}`,
    kind,
    file_name: fileName,
    mime_type: attachment.mimeType || 'application/octet-stream',
    total_bytes: bytes,
    source: attachment.source ?? 'app',
  })
  const uploadId = start.upload.id
  const received = new Set(start.upload.received_chunks ?? [])
  const totalChunks = Math.ceil(bytes / AI_UPLOAD_CHUNK_BYTES)
  let uploadedForFile = 0

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const offset = chunkIndex * AI_UPLOAD_CHUNK_BYTES
    const chunkBytes = Math.min(AI_UPLOAD_CHUNK_BYTES, bytes - offset)
    if (!received.has(chunkIndex)) {
      const chunkBase64 = await FileSystem.readAsStringAsync(attachment.uri, {
        encoding: FileSystem.EncodingType.Base64,
        position: offset,
        length: chunkBytes,
      })
      // Resilience: chunked upload POST não tem Idempotency-Key, então o
      // retry built-in do apiRequest não dispara. withRetry adiciona 3
      // tentativas com backoff exponencial (280/560/1120ms) idênticas ao
      // canon desktop. base64 é computada UMA vez fora do retry · retry
      // reusa o mesmo payload.
      await withRetry(() =>
        apiPost(`/ai/uploads/chunks/${encodeURIComponent(uploadId)}/chunk`, {
          index: chunkIndex,
          total_chunks: totalChunks,
          offset,
          bytes: chunkBytes,
          chunk_base64: chunkBase64,
        }),
      )
    }

    uploadedForFile += chunkBytes
    const sentBytes = Math.min(aggregateTotalBytes, aggregateUploadedBefore + uploadedForFile)
    onProgress?.({
      phase: 'uploading',
      fileName,
      fileIndex: index + 1,
      fileCount,
      sentBytes,
      totalBytes: aggregateTotalBytes,
      percent: aggregateTotalBytes > 0 ? sentBytes / aggregateTotalBytes : 0,
    })
  }

  const complete = await apiPost<{
    upload: { id: string; bytes?: number | null }
  }>(`/ai/uploads/chunks/${encodeURIComponent(uploadId)}/complete`, {})

  return {
    id: complete.upload.id,
    bytes: typeof complete.upload.bytes === 'number' ? complete.upload.bytes : bytes,
  }
}

function stableUploadKey(uri: string, fileName: string, bytes: number): string {
  const input = `${uri}|${fileName}|${bytes}`
  let hash = 2166136261
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `${Math.abs(hash >>> 0).toString(36)}-${bytes.toString(36)}`
}

async function totalAttachmentBytes(attachments: Array<AiInteractionImageAttachmentInput | AiInteractionFileAttachmentInput>): Promise<number> {
  let total = 0
  for (const attachment of attachments) {
    if (typeof attachment.size === 'number' && attachment.size > 0) {
      total += attachment.size
      continue
    }
    try {
      const info = await FileSystem.getInfoAsync(attachment.uri)
      if (info.exists && typeof info.size === 'number') total += info.size
    } catch {}
  }
  return total
}

export async function listAiInteractions(params: {
  thread_id?: string
  status?: AtlasAiStatus
  agent?: string
  client_id?: string
  limit?: number
} = {}): Promise<AiInteractionsResponse> {
  return apiGet<AiInteractionsResponse>(`/ai/interactions${queryString(params)}`)
}

export async function listAiDecisions(params: {
  trace_id?: string
  provider?: AtlasAiProvider | string
  decision_mode?: 'atlas_decide' | 'manual_override' | string
  task_type?: string
  limit?: number
} = {}): Promise<{ decisions: AtlasAiDecision[] }> {
  return apiGet<{ decisions: AtlasAiDecision[] }>(`/ai/decisions${queryString(params)}`)
}

export async function previewAiDecision(input: {
  input_text: string
  provider?: AtlasAiProvider | 'auto' | string | null
  model?: string | null
  source_type?: string | null
  agent_slug?: string | null
  mode?: string | null
  payload?: Record<string, unknown>
}): Promise<{ decision: AtlasAiDecisionReceipt }> {
  return apiPost<{ decision: AtlasAiDecisionReceipt }>('/ai/decisions/preview', input)
}

export async function searchAiAttachments(input: {
  query: string
  thread_id?: string | null
  limit?: number
}): Promise<AtlasAiAttachmentSearchResponse> {
  return apiPost<AtlasAiAttachmentSearchResponse>('/ai/attachments/search', input)
}

export async function listAiThreads(params: {
  status?: 'active' | 'archived' | 'closed' | 'all'
  surface?: string
  workspace?: string
  include_messages?: boolean
  limit?: number
  // 2026-05 · light=true omite relations pesadas (activeSession, activeState,
  // latestCompaction, latestProviderHandoff, lastTrace). Payload cai ~80×
  // (1.2MB → ~15KB pra 10 threads). Use no histórico — só precisa de
  // id/title/meta pra listar. Mobile inicial deve sempre passar true.
  light?: boolean
} = {}): Promise<AiThreadsResponse> {
  return apiGet<AiThreadsResponse>(`/ai/threads${queryString(params)}`)
}

export async function getAiThread(id: string): Promise<{ thread: AtlasAiThread }> {
  return apiGet(`/ai/threads/${encodeURIComponent(id)}`)
}

export async function createAiThread(input: {
  title?: string
  summary?: string | null
  surface?: string
  workspace?: string | null
  source_type?: string | null
  source_id?: string | null
  metadata?: Record<string, unknown>
} = {}): Promise<{ thread: AtlasAiThread }> {
  return apiPost('/ai/threads', input)
}

export async function updateAiThread(
  id: string,
  patch: {
    title?: string
    summary?: string | null
    status?: 'active' | 'archived' | 'closed'
    metadata?: Record<string, unknown>
  },
): Promise<{ thread: AtlasAiThread }> {
  return apiPatch(`/ai/threads/${encodeURIComponent(id)}`, patch)
}

export async function deleteAiThread(id: string): Promise<{
  ok: boolean
  deleted_thread_id: string
  deletion: {
    content_purged: boolean
    traces_tombstoned: number
  }
}> {
  return apiDelete<{
    ok: boolean
    deleted_thread_id: string
    deletion: {
      content_purged: boolean
      traces_tombstoned: number
    }
  }>(`/ai/threads/${encodeURIComponent(id)}`)
}

export async function getAiThreadState(id: string): Promise<{ state: AtlasAiSessionState }> {
  return apiGet(`/ai/threads/${encodeURIComponent(id)}/state`)
}

export async function compactAiThread(
  id: string,
  input: {
    reason?: 'manual' | 'auto' | 'provider_switch' | 'phase_change' | 'session_resume' | 'session_close'
    provider?: string | null
    model?: string | null
    metadata?: Record<string, unknown>
  } = {},
): Promise<{ compaction: AtlasAiCompaction; thread: AtlasAiThread }> {
  return apiPost(`/ai/threads/${encodeURIComponent(id)}/compact`, input)
}

export async function switchAiThreadProvider(
  id: string,
  input: {
    to_provider: AtlasAiProvider
    from_provider?: string | null
    reason?: string
    metadata?: Record<string, unknown>
  },
): Promise<{ handoff: AtlasAiProviderHandoff }> {
  return apiPost(`/ai/threads/${encodeURIComponent(id)}/switch-provider`, input)
}

export async function listAiThreadSnapshots(
  id: string,
  params: { limit?: number } = {},
): Promise<{ snapshots: AtlasAiContextSnapshot[] }> {
  return apiGet(`/ai/threads/${encodeURIComponent(id)}/snapshots${queryString(params)}`)
}

export async function getAiInteraction(id: string): Promise<{ trace: AtlasAiTrace }> {
  return apiGet(`/ai/interactions/${encodeURIComponent(id)}`)
}

export async function feedbackAiInteraction(
  id: string,
  feedback: { feedback_score?: number; feedback_action?: string; feedback_comment?: string },
): Promise<{ trace: AtlasAiTrace }> {
  return apiPost(`/ai/interactions/${encodeURIComponent(id)}/feedback`, feedback)
}

export async function listAiJobs(params: {
  status?: AtlasAiStatus
  provider?: AtlasAiProvider | string
  limit?: number
} = {}): Promise<AiJobsResponse> {
  return apiGet<AiJobsResponse>(`/ai/jobs${queryString(params)}`)
}

export async function getAiJob(id: string): Promise<{ job: AtlasAiJob }> {
  return apiGet(`/ai/jobs/${encodeURIComponent(id)}`)
}

export async function retryAiJob(id: string): Promise<{ job: AtlasAiJob }> {
  return apiPost(`/ai/jobs/${encodeURIComponent(id)}/retry`, {})
}

export async function cancelAiJob(id: string): Promise<{ job: AtlasAiJob }> {
  return apiPost(`/ai/jobs/${encodeURIComponent(id)}/cancel`, {})
}

export async function resumeAiJobChoice(
  jobId: string,
  optionId: string,
): Promise<{ job: AtlasAiJob }> {
  return apiRequest<{ job: AtlasAiJob }>(
    `/ai/jobs/${encodeURIComponent(jobId)}/resume-choice`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option_id: optionId }),
    },
  )
}

export async function getAiProvidersStatus(): Promise<AiProvidersStatusResponse> {
  return apiGet<AiProvidersStatusResponse>('/ai/providers/status')
}

export async function getAiPolicyProfiles(): Promise<AtlasAiPolicyProfilesResponse> {
  return apiGet<AtlasAiPolicyProfilesResponse>('/ai/policies/profiles')
}

export async function getAiDomainCatalog(params: AtlasAiDomainCatalogParams = {}): Promise<AtlasAiDomainCatalogResponse> {
  return apiGet<AtlasAiDomainCatalogResponse>(`/ai/domains${queryString(params as Record<string, unknown>)}`)
}

export async function previewAiPolicy(input: AtlasAiPolicyPreviewInput): Promise<AtlasAiPolicyPreviewResponse> {
  return apiPost<AtlasAiPolicyPreviewResponse>('/ai/policies/preview', input)
}

export async function updateAiDomainProfile(
  domainId: string,
  input: AtlasAiDomainProfilePatch,
): Promise<AtlasAiDomainProfileUpdateResponse> {
  return apiPatch<AtlasAiDomainProfileUpdateResponse>(`/ai/policies/domains/${encodeURIComponent(domainId)}`, input)
}

export async function updateAiFlowProfile(
  flowId: string,
  input: AtlasAiFlowProfilePatch,
): Promise<AtlasAiFlowProfileUpdateResponse> {
  return apiPatch<AtlasAiFlowProfileUpdateResponse>(`/ai/policies/flows/${encodeURIComponent(flowId)}`, input)
}

export async function updateAiProviderSettings(input: AtlasAiRuntimeSettingsPatch): Promise<AiProvidersStatusResponse> {
  return apiPatch<AiProvidersStatusResponse>('/ai/providers/settings', input)
}

export async function checkAiProviders(): Promise<{ providers: AtlasAiProviderHealth[] }> {
  return apiPost('/ai/providers/check', {})
}

export async function getAiObservability(params: {
  hours?: number
} = {}): Promise<AiObservabilityResponse> {
  return apiGet<AiObservabilityResponse>(`/ai/observability${queryString(params)}`)
}

export async function postAiTelemetryEvents(
  events: AtlasAiTelemetryEventInput[],
): Promise<AtlasAiTelemetryBatchResponse> {
  await hydrateApiConfig()
  const payload = { events }

  return getMobileDeviceSession()
    ? mobileApiPost<AtlasAiTelemetryBatchResponse>('/v1/mobile/telemetry/events', payload)
    : apiPost<AtlasAiTelemetryBatchResponse>('/ai/telemetry/events', payload)
}

export async function getAiTelemetryScorecard(params: {
  hours?: number
  recompute?: boolean
} = {}): Promise<AtlasAiTelemetryScorecardResponse> {
  return apiGet<AtlasAiTelemetryScorecardResponse>(`/ai/telemetry/scorecard${queryString(params)}`)
}

export async function getAiTelemetryHealth(params: {
  hours?: number
  recompute?: boolean
  emit?: boolean
} = {}): Promise<{ health: AtlasAiTelemetryHealth; insight: { emitted: boolean; item_id: string | null; reason: string }; recomputed: number | null }> {
  return apiGet<{ health: AtlasAiTelemetryHealth; insight: { emitted: boolean; item_id: string | null; reason: string }; recomputed: number | null }>(`/ai/telemetry/health${queryString(params)}`)
}

export async function listAiProviderCostRates(params: {
  provider?: string
  model?: string
  active?: boolean
  limit?: number
} = {}): Promise<{ available: boolean; rates: AtlasAiProviderCostRate[] }> {
  return apiGet<{ available: boolean; rates: AtlasAiProviderCostRate[] }>(`/ai/telemetry/cost-rates${queryString(params)}`)
}

export async function listMissingAiProviderCostRates(params: {
  hours?: number
  limit?: number
} = {}): Promise<{ available: boolean; missing_rates: AtlasAiMissingCostRate[] }> {
  return apiGet<{ available: boolean; missing_rates: AtlasAiMissingCostRate[] }>(`/ai/telemetry/cost-rates/missing${queryString(params)}`)
}

export async function upsertAiProviderCostRate(input: {
  provider: string
  model: string
  input_microusd_per_1k: number
  output_microusd_per_1k: number
  currency?: string
  effective_from?: string
  effective_until?: string
  metadata?: Record<string, unknown>
}): Promise<{ rate: AtlasAiProviderCostRate }> {
  return apiPost<{ rate: AtlasAiProviderCostRate }>('/ai/telemetry/cost-rates', input)
}

export async function recordAiOutcome(input: {
  trace_id?: string | null
  thread_id?: string | null
  session_id?: string | null
  outcome_type: string
  target_type?: string | null
  target_id?: string | null
  value_score?: number | null
  confidence?: number | null
  source?: string
  occurred_at?: string
  metadata?: Record<string, unknown>
}): Promise<{ outcome: AtlasAiOutcomeLink | null }> {
  return apiPost<{ outcome: AtlasAiOutcomeLink | null }>('/ai/telemetry/outcomes', input)
}

export async function listAiOutcomes(params: {
  trace_id?: string
  thread_id?: string
  outcome_type?: string
  limit?: number
} = {}): Promise<{ available: boolean; outcomes: AtlasAiOutcomeLink[] }> {
  return apiGet<{ available: boolean; outcomes: AtlasAiOutcomeLink[] }>(`/ai/telemetry/outcomes${queryString(params)}`)
}

export async function listAiQualityActions(params: {
  status?: AtlasAiQualityActionStatus
  action_type?: string
  trace_id?: string
  thread_id?: string
  limit?: number
} = {}): Promise<AiQualityActionsResponse> {
  return apiGet<AiQualityActionsResponse>(`/ai/quality/actions${queryString(params)}`)
}

export async function runAiQualityAction(id: string): Promise<{ action: AtlasAiQualityAction }> {
  return apiPost(`/ai/quality/actions/${encodeURIComponent(id)}/run`, {})
}

function appendInteractionForm(form: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null || value === '') return
  if (typeof value === 'boolean') {
    form.append(key, value ? '1' : '0')
    return
  }
  form.append(key, String(value))
}
