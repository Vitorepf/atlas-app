// Atlas Loop Command Surface · typed mobile client.
//
// The Loop is the ONLY surface through which the operator talks to the autonomous
// 24h loop, so these types are the frozen contract the screen renders against. They
// mirror — field for field — the backend AreaFocusLoopCommandController and the owner
// services it composes (verified against the controller source, not invented):
//   live              GET  /ai/software-company-stewardship/loop/{area}/live
//   cycles            GET  /ai/software-company-stewardship/loop/{area}/cycles
//   operator-decision POST /ai/software-company-stewardship/loop/{area}/operator-decision
//   run-control       POST /ai/software-company-stewardship/loop/{area}/run-control
//   directive         POST /ai/software-company-stewardship/loop/{area}/directive
//
// Auth: every route is behind `atlas.token` (operator token, X-Atlas-Token). We use the
// operator-token helpers apiGet/apiPost — NOT the device-bearer mobileApi* (which 401s if
// unpaired). All five reuse the shared base URL + auth-header from apiRequest.
//
// Invariants the SHAPES preserve (must never be softened): real-or-blocked (no fabricated
// merge/provider-proof — `merge_performed`/`provider_invoked` are honest booleans the loop
// emits), proposal-only (an accept sets requires_owner_execution=true / executed=false and
// NEVER runs), honest-stop (run-control only flips the pause/kill signal files the loop
// already obeys), directive honesty (`loop_autonomously_consumable_now` is always false —
// the inbox is not a loop finding source).

import { apiGet, apiPost } from './client'

// --- shared scalars -------------------------------------------------------------

/** Area/focus default everywhere (matches the read-model + runner defaults). */
export const ATLAS_LOOP_DEFAULT_AREA = 'agentic_engineering_os'
export const ATLAS_LOOP_DEFAULT_FOCUS = 'dev_forge'
export const ATLAS_LOOP_DEFAULT_PORTFOLIO = 'atlas_software_company'

export type AtlasLoopCycleOutcome = 'merged' | 'blocked' | 'progress' | 'repeated_finding'
export type AtlasLoopWorkClass = 'product' | 'self_maintenance' | string
export type AtlasLoopOperatorDecision = 'accept' | 'reject' | 'defer' | 'request_changes'
export type AtlasLoopRiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type AtlasLoopRunControlAction = 'pause' | 'resume' | 'kill' | 'clear-kill'

// =================================================================================
// (a) GET live loop state
// =================================================================================

/**
 * Reliable24hLoopRunnerService::lockStatus — process/lease lock truth. `held` is false
 * the moment the holder's lease expired OR its process died (reclaimable), so a crashed
 * run never falsely reports the loop as live.
 */
export interface AtlasLoopLockHolder {
  run_id?: string
  pid?: number
  acquired_at?: string
  acquired_at_epoch?: number
  lease_ttl_seconds?: number
  [key: string]: unknown
}

export interface AtlasLoopLockStatus {
  available: boolean
  held: boolean
  holder: AtlasLoopLockHolder | null
  expired?: boolean
  orphaned?: boolean
  path: string
}

/** killSwitchStatus / pauseStatus — `active` reflects the real is_file() on the signal path. */
export interface AtlasLoopSignalStatus {
  active: boolean
  path: string
}

/** Reliable24hStewardshipRecoveryContract::toArray — "until consecutive merged cycles normal". */
export interface AtlasLoopStewardshipRecovery {
  schema_version: 'atlas.software_company_stewardship.ap790_24h_stewardship_recovery.v1' | string
  area_id: string
  focus: string
  inputs: {
    last_cycle_index: number
    merges_total: number
    blocked_in_row: number
    consecutive_merged_cycles: number
    target_consecutive_merged_cycles: number
  }
  merge_eligibility: { ledger_outcome: string; merge_performed: boolean }
  outputs: {
    recovery_normal: boolean
    consecutive_merged_cycles: number
    blocked_in_row: number
  }
}

/** A bounded per-cycle summary inside scheduler_backlog.recent_cycles (cycleSummary()). */
export interface AtlasLoopSchedulerCycleSummary {
  cycle_index: number
  outcome: AtlasLoopCycleOutcome | string
  finding_key: string
  cycle_final_status: string
  merge_performed: boolean
  merge_hash: string
  loop_receipt_integrity: string
  blockers: string[]
  repaired: boolean
  retried: boolean
  quarantined: boolean
  quarantine_reason: string
  multi_agent_workcell: { present: boolean; [key: string]: unknown }
}

/** continuous24hSchedulerBacklogObservability — bounded backlog observability for the priority engine. */
export interface AtlasLoopSchedulerBacklog {
  schema_version: 'atlas.software_company_stewardship.ap790_continuous_24h_scheduler_backlog.v1' | string
  ap790_backlog_item: string
  bounded_by: { recent_cycles_limit: number }
  outcome_counts: {
    blocked: number
    merged: number
    progress: number
    repeated_finding: number
  }
  recovery: {
    recovered: boolean
    last_cycle_index: number
    merges_total: number
    blocked_in_row: number
    consecutive_merged_cycles: number
    recovery_normal: boolean
    seen_finding_count: number
  }
  recent_cycles: AtlasLoopSchedulerCycleSummary[]
  lock: AtlasLoopLockStatus
  kill_switch: AtlasLoopSignalStatus
  pause: AtlasLoopSignalStatus
  ledger_record_count: number
}

export interface AtlasLoopRunState {
  lock: AtlasLoopLockStatus
  kill_switch: AtlasLoopSignalStatus
  pause: AtlasLoopSignalStatus
  stewardship_recovery: AtlasLoopStewardshipRecovery
  scheduler_backlog: AtlasLoopSchedulerBacklog
}

/**
 * The Product Mode cockpit aggregate (ProductModeCockpitSurfaceService::project). It is a
 * deep, multi-section read model; the Loop screen consumes the fields below directly and
 * treats the remaining (already-verified) sections as opaque via the index signature, so
 * the contract stays exact for what we render without re-declaring dozens of nested shapes.
 */
export interface AtlasLoopCockpitHealth {
  overall: string
  area_focus: string
  executive_review_pending?: number
  new_area_blocked?: number
  self_expanding_status?: string
  outcome_history_status?: string
  domain_runtime_creation_handoff_status?: string
  area_stewardship_active_handoff_status?: string
  area_stewardship_active_operation_status?: string
  continuous_stewardship_loop_status?: string
  continuous_stewardship_scheduler_status?: string
  dev_forge_release_status?: string
  owner_sandbox_runtime_runner_status?: string
  owner_runtime_result_bridge_status?: string
  executive_allocation_handoff_status?: string
  product_mode_operational_controls_status?: string
  [key: string]: unknown
}

export interface AtlasLoop24hObservability {
  schema_version: string
  ap_contract: string
  read_only: boolean
  area_id: string
  focus: string
  metrics: Record<string, unknown>
  blocked_by_reason: Record<string, unknown> | unknown[]
  latest_commit: Record<string, unknown> | null
  latest_inbox_item: Record<string, unknown> | null
  active_worktrees: Array<Record<string, unknown>>
  quarantined_count: number
  cycle_inbox_summaries: Array<Record<string, unknown>>
  lock: Record<string, unknown>
  kill_switch: Record<string, unknown>
  backlog: Record<string, unknown>
  observability_hash: string
  claim_policy: Record<string, unknown>
  [key: string]: unknown
}

export interface AtlasLoopCockpit {
  schema_version: 'atlas.software_company.product_mode_cockpit.v1' | string
  status: 'ready' | 'blocked' | string
  /** Present only when status === 'blocked'. */
  reason?: string
  blockers?: string[]
  ap_contract?: string
  area_id: string
  portfolio_id: string
  read_only: boolean
  counters?: Record<string, number>
  health?: AtlasLoopCockpitHealth
  area_focus?: Record<string, unknown>
  loop_24h_observability?: AtlasLoop24hObservability
  review_queue?: Array<Record<string, unknown>>
  operator_controls?: Record<string, unknown>
  // Remaining verified cockpit sections (executive_decision_inbox, self_expanding_company,
  // stewardship_outcome_history, …) are accessible but kept opaque here.
  [key: string]: unknown
}

export interface AtlasLoopLiveResponse {
  schema_version: 'atlas.software_company_stewardship.loop_command_live.v1' | string
  area_id: string
  focus: string
  portfolio_id: string
  read_only: boolean
  cockpit: AtlasLoopCockpit
  run_state: AtlasLoopRunState
  surface_hash: string
  generated_at: string
}

export interface FetchAtlasLoopLiveParams {
  area?: string
  focus?: string
  portfolio?: string
  /** Absolute repo root the cockpit's 24h observability scans (server reads git there). */
  repo_root?: string
}

export async function fetchAtlasLoopLive(
  params: FetchAtlasLoopLiveParams = {},
): Promise<AtlasLoopLiveResponse> {
  const area = params.area ?? ATLAS_LOOP_DEFAULT_AREA
  const query = buildQuery({
    focus: params.focus,
    portfolio: params.portfolio,
    repo_root: params.repo_root,
  })
  // etag:true → conditional GET; a 304 returns the prior body by reference (anti-flicker #1).
  return apiGet<AtlasLoopLiveResponse>(
    `/ai/software-company-stewardship/loop/${encodeURIComponent(area)}/live${query}`,
    { etag: true },
  )
}

// =================================================================================
// (b) GET cycles tail
// =================================================================================

/**
 * One append-only cycle ledger record (Reliable24hLoopRunnerService::cycleReceipt,
 * schema ap790_reliable_24h_loop_cycle.v1). readLedgerRecords() already filters out the
 * interleaved health_snapshot lines, so every element here is a real cycle receipt.
 */
export interface AtlasLoopCycleRecord {
  schema_version: 'atlas.software_company_stewardship.ap790_reliable_24h_loop_cycle.v1' | string
  run_id: string
  cycle_index: number
  cycle_id: string
  finding_key: string
  finding_keys: string[]
  outcome: AtlasLoopCycleOutcome | string
  work_class: AtlasLoopWorkClass
  session_status: string
  cycle_final_status: string
  blockers: string[]
  merge_performed: boolean
  merge_hash: string
  loop_receipt_integrity: string
  loop_receipt_hash: string
  inbox_item_id: string
  result_bridge_id: string
  cumulative: {
    cycles_this_run: number
    merges_total: number
    blocked_in_row: number
  }
  repaired: boolean
  retried: boolean
  quarantined: boolean
  quarantine_reason: string
  multi_agent_workcell: { present: boolean; [key: string]: unknown }
  recorded_at: string
  preflight_ref?: string
  post_cycle_audit_ref?: string
  [key: string]: unknown
}

export interface AtlasLoopCyclesResponse {
  schema_version: 'atlas.software_company_stewardship.loop_command_cycles.v1' | string
  area_id: string
  focus: string
  ledger_record_count_total: number
  returned_count: number
  tail: number
  hours: number | null
  /** Oldest -> newest, after `hours` filter then `tail` slice. */
  cycles: AtlasLoopCycleRecord[]
  surface_hash: string
  generated_at: string
}

export interface FetchAtlasLoopCyclesParams {
  area?: string
  focus?: string
  /** Last N records (default 20, hard-capped 200 server-side). */
  tail?: number
  /** Keep only records within the last H hours (applied before tail). */
  hours?: number
}

export async function fetchAtlasLoopCycles(
  params: FetchAtlasLoopCyclesParams = {},
): Promise<AtlasLoopCyclesResponse> {
  const area = params.area ?? ATLAS_LOOP_DEFAULT_AREA
  const query = buildQuery({
    focus: params.focus,
    tail: params.tail,
    hours: params.hours,
  })
  return apiGet<AtlasLoopCyclesResponse>(
    `/ai/software-company-stewardship/loop/${encodeURIComponent(area)}/cycles${query}`,
    { etag: true },
  )
}

// =================================================================================
// (c) POST operator-decision
// =================================================================================

export interface SubmitAtlasLoopDecisionInput {
  /** Path-param area; defaults to agentic_engineering_os. */
  area?: string
  decision: AtlasLoopOperatorDecision
  /** Required — the service blocks an empty actor (the operator must own the decision). */
  operator_actor: string
  /** Required deterministic anchor — the service blocks a missing finding hash. */
  finding_hash: string
  inbox_item_id?: string
  work_order_id?: string
  evidence_pack_hash?: string
  /** Required only for an accept when risk is high|critical. */
  rationale?: string
  /** Defaults to medium server-side. */
  risk?: AtlasLoopRiskLevel
}

/**
 * AreaFocusOperatorDecisionService::decide receipt (verbatim). The four hard guarantees at
 * the bottom are the proposal-only invariant in type form: an accept unlocks the next owner
 * stage under operator review (requires_owner_execution=true) but `executed` stays false and
 * no provider/branch/merge ever happens here.
 */
export interface AtlasLoopOperatorDecisionReceipt {
  schema_version: 'atlas.software_company_stewardship.area_focus_operator_decision_receipt.v1' | string
  ap_contract: 'AP-724' | string
  decision_id: string
  area_id: string
  inbox_item_id: string | null
  finding_hash: string
  work_order_id: string | null
  evidence_pack_hash: string | null
  operator_actor: string
  decision: AtlasLoopOperatorDecision
  rationale: string | null
  risk_level: AtlasLoopRiskLevel
  next_allowed_action:
    | 'release_to_owner_execution_under_operator_review'
    | 'close_item_no_action'
    | 're_review_next_area_focus_cycle'
    | 'return_to_spec_draft_revision'
    | string
  routes_to_owner: {
    owner: 'area_focus_loop' | 'self_directed_evolution' | string
    note: string
  }
  requires_owner_execution: boolean
  executed: false
  atlas_auto_decided: false
  autoapproval_allowed: false
  autoimplementation_allowed: false
  branch_created: false
  provider_invoked: false
  mutates_target_repo: false
  parallel_registry_created: false
  operator_owned: true
  decision_hash: string
  decided_at: string
}

/** 422 error shape from decide() InvalidArgumentException (stable machine reason + detail). */
export interface AtlasLoopOperatorDecisionError {
  schema_version: 'atlas.software_company_stewardship.area_focus_operator_decision_receipt.error.v1' | string
  status: 'blocked'
  reason:
    | 'operator_actor_required'
    | 'invalid_decision'
    | 'item_without_hash'
    | 'rationale_required_for_high_risk_accept'
    | string
  detail: string
}

export async function submitAtlasLoopOperatorDecision(
  input: SubmitAtlasLoopDecisionInput,
): Promise<AtlasLoopOperatorDecisionReceipt> {
  const area = input.area ?? ATLAS_LOOP_DEFAULT_AREA
  const body: Record<string, unknown> = {
    decision: input.decision,
    operator_actor: input.operator_actor,
    finding_hash: input.finding_hash,
  }
  if (input.inbox_item_id != null) body.inbox_item_id = input.inbox_item_id
  if (input.work_order_id != null) body.work_order_id = input.work_order_id
  if (input.evidence_pack_hash != null) body.evidence_pack_hash = input.evidence_pack_hash
  if (input.rationale != null) body.rationale = input.rationale
  if (input.risk != null) body.risk = input.risk
  return apiPost<AtlasLoopOperatorDecisionReceipt>(
    `/ai/software-company-stewardship/loop/${encodeURIComponent(area)}/operator-decision`,
    body,
  )
}

// =================================================================================
// (d) POST run-control
// =================================================================================

export interface SubmitAtlasLoopRunControlInput {
  area?: string
  action: AtlasLoopRunControlAction
  /** Required for audit — the controller rejects an empty actor with 422. */
  operator_actor: string
  focus?: string
  /** Free text written into the signal file body for audit. */
  reason?: string
}

/** Run-control response — TRUE post-state re-read from disk after the signal write/delete. */
export interface AtlasLoopRunControlResponse {
  schema_version: 'atlas.software_company_stewardship.loop_command_run_control.v1' | string
  area_id: string
  focus: string
  action: AtlasLoopRunControlAction
  operator_actor: string
  applied: boolean
  kill_switch: AtlasLoopSignalStatus
  pause: AtlasLoopSignalStatus
  note: string
  generated_at: string
}

export async function submitAtlasLoopRunControl(
  input: SubmitAtlasLoopRunControlInput,
): Promise<AtlasLoopRunControlResponse> {
  const area = input.area ?? ATLAS_LOOP_DEFAULT_AREA
  const body: Record<string, unknown> = {
    action: input.action,
    operator_actor: input.operator_actor,
  }
  if (input.focus != null) body.focus = input.focus
  if (input.reason != null) body.reason = input.reason
  return apiPost<AtlasLoopRunControlResponse>(
    `/ai/software-company-stewardship/loop/${encodeURIComponent(area)}/run-control`,
    body,
  )
}

// =================================================================================
// (e) POST directive
// =================================================================================

export interface SendAtlasLoopDirectiveInput {
  area?: string
  /** Required non-empty natural-language instruction. */
  directive: string
  /** Required — the directive must be operator-owned. */
  operator_actor: string
  focus?: string
  /** Defaults to medium server-side. */
  risk?: AtlasLoopRiskLevel
  /** Optional hint: which canonical owner doc this belongs to. */
  target_doc?: string
}

/** The machine-readable "how to make this loop-consumable" block (never auto-applied). */
export interface AtlasLoopDirectiveConsumability {
  real_finding_source: string
  reader: string
  docs_root: string
  required_flags: string[]
  operator_step: string
}

/**
 * Directive receipt. HONEST by construction: persisted into the real operational inbox as an
 * operator-review item; `loop_autonomously_consumable_now` is always false (the inbox is not a
 * loop finding source) and nothing is executed, provider-invoked, or committed.
 */
export interface AtlasLoopDirectiveReceipt {
  schema_version: 'atlas.software_company_stewardship.loop_command_directive.v1' | string
  area_id: string
  focus: string
  directive_id: string
  operator_actor: string
  directive: string
  persisted_to: 'operational_inbox' | string
  inbox_item_id: string
  loop_autonomously_consumable_now: false
  to_make_loop_consumable: AtlasLoopDirectiveConsumability
  executed: false
  provider_invoked: false
  mutates_target_repo: false
  auto_consumed: false
  generated_at: string
}

/** 422 error shape for the directive endpoint. */
export interface AtlasLoopDirectiveError {
  status: 'blocked'
  reason: 'directive_required' | 'operator_actor_required' | string
  detail: string
}

export async function sendAtlasLoopDirective(
  input: SendAtlasLoopDirectiveInput,
): Promise<AtlasLoopDirectiveReceipt> {
  const area = input.area ?? ATLAS_LOOP_DEFAULT_AREA
  const body: Record<string, unknown> = {
    directive: input.directive,
    operator_actor: input.operator_actor,
  }
  if (input.focus != null) body.focus = input.focus
  if (input.risk != null) body.risk = input.risk
  if (input.target_doc != null) body.target_doc = input.target_doc
  return apiPost<AtlasLoopDirectiveReceipt>(
    `/ai/software-company-stewardship/loop/${encodeURIComponent(area)}/directive`,
    body,
  )
}

// =================================================================================
// (f) GET areas — the selectable run areas (AP-712 Area Contract Registry)
// =================================================================================

/** AtlasNightShiftAreaFocusContractRegistry::resolve, projected for the run picker. */
export interface AtlasLoopArea {
  area_id: string
  area_name: string
  focus: string
  autonomy_tier: number
  max_tier_for_area: number
  dev_mode: string
  registered: boolean
  objective: string
  owned_systems: string[]
  repo_scope: Record<string, unknown>
  stop_conditions: string[]
  /** Thin live snapshot so the picker shows which area already has a live run. */
  run_state: { lock: AtlasLoopLockStatus }
}

export interface AtlasLoopAreasResponse {
  schema_version: 'atlas.software_company_stewardship.loop_command_areas.v1' | string
  read_only: boolean
  /** TRUTH: exactly ONE registered area in v1 (agentic_engineering_os). */
  areas: AtlasLoopArea[]
  area_count: number
  default_area: string
  default_focus: string
  surface_hash: string
  generated_at: string
}

export async function fetchAtlasLoopAreas(): Promise<AtlasLoopAreasResponse> {
  return apiGet<AtlasLoopAreasResponse>('/ai/software-company-stewardship/loop/areas', { etag: true })
}

// =================================================================================
// (g) GET backlog — open findings / to-implement for an area (thin cockpit projection)
// =================================================================================

export interface AtlasLoopBacklogFinding {
  finding_hash: string
  title: string
  source: string
  source_owner: string
  gap_kind: string
  risk_level: string
  priority_score: number
  route: string
  [key: string]: unknown
}

export interface AtlasLoopBacklogResponse {
  schema_version: 'atlas.software_company_stewardship.loop_command_backlog.v1' | string
  area_id: string
  focus: string
  portfolio_id: string
  read_only: boolean
  findings: {
    total: number
    returned: number
    offset: number
    limit: number
    by_risk: Record<string, unknown>
    by_route: Record<string, unknown>
    items: AtlasLoopBacklogFinding[]
  }
  work_orders: Array<Record<string, unknown>>
  inbox_items: Array<Record<string, unknown>>
  budgets: Record<string, unknown>
  surface_hash: string
  generated_at: string
}

export interface FetchAtlasLoopBacklogParams {
  area?: string
  focus?: string
  portfolio?: string
  repo_root?: string
  /** Page size over the findings list (default 20, hard-capped 200 server-side). */
  limit?: number
  offset?: number
}

export async function fetchAtlasLoopBacklog(
  params: FetchAtlasLoopBacklogParams = {},
): Promise<AtlasLoopBacklogResponse> {
  const area = params.area ?? ATLAS_LOOP_DEFAULT_AREA
  const query = buildQuery({
    focus: params.focus,
    portfolio: params.portfolio,
    repo_root: params.repo_root,
    limit: params.limit,
    offset: params.offset,
  })
  return apiGet<AtlasLoopBacklogResponse>(
    `/ai/software-company-stewardship/loop/${encodeURIComponent(area)}/backlog${query}`,
    { etag: true },
  )
}

// =================================================================================
// (h) GET done — delivered cycles (merged + real merge_hash + provider-proof)
// =================================================================================

export interface AtlasLoopDoneResponse {
  schema_version: 'atlas.software_company_stewardship.loop_command_done.v1' | string
  area_id: string
  focus: string
  read_only: boolean
  ledger_record_count_total: number
  delivered_total: number
  returned: number
  offset: number
  limit: number
  /** Newest-first. Every record is a REAL merge (outcome=merged && merge_performed && merge_hash). */
  delivered: AtlasLoopCycleRecord[]
  surface_hash: string
  generated_at: string
}

export interface FetchAtlasLoopDoneParams {
  area?: string
  focus?: string
  /** Page size (default 20, hard-capped 200 server-side). */
  limit?: number
  offset?: number
}

export async function fetchAtlasLoopDone(
  params: FetchAtlasLoopDoneParams = {},
): Promise<AtlasLoopDoneResponse> {
  const area = params.area ?? ATLAS_LOOP_DEFAULT_AREA
  const query = buildQuery({ focus: params.focus, limit: params.limit, offset: params.offset })
  return apiGet<AtlasLoopDoneResponse>(
    `/ai/software-company-stewardship/loop/${encodeURIComponent(area)}/done${query}`,
    { etag: true },
  )
}

// =================================================================================
// (i) POST start-run — launch the REAL reliable 24h loop (governed; never fakes running)
// =================================================================================

/** mode=execute is the DESTRUCTIVE real path and must be explicit; default is dry_run. */
export type AtlasLoopStartRunMode = 'dry_run' | 'execute'

export interface StartAtlasLoopRunInput {
  area?: string
  /** Required — the controller rejects an empty actor with 422. */
  operator_actor: string
  focus?: string
  /** Defaults to dry_run (safe). execute is the real, destructive path — confirm before sending. */
  mode?: AtlasLoopStartRunMode
  max_runtime_minutes?: number
  max_cycles?: number
  max_merges?: number
  sleep_seconds?: number
  auto_merge?: boolean
  scope_profile?: string
  provider?: string
  model?: string
  repo_root?: string
}

/**
 * Start-run receipt. HONEST by construction: the run is QUEUED on the dedicated worker queue, NOT
 * started — `status` is always 'enqueued' (never 'running'), `started`/`provider_invoked`/
 * `merge_performed` are false. The ONLY truth the loop started is run_state.lock.held flipping true
 * in /live once a worker consuming `software_company_loop` picks the job up.
 */
export interface AtlasLoopStartRunResponse {
  schema_version: 'atlas.software_company_stewardship.loop_command_start_run.v1' | string
  status: 'enqueued' | string
  launch: 'queued_job' | string
  queue: 'software_company_loop' | string
  area_id: string
  focus: string
  mode: AtlasLoopStartRunMode
  execute: boolean
  requires_worker: boolean
  operator_actor: string
  input_echo: {
    max_runtime_minutes: number | null
    max_cycles: number | null
    max_merges: number | null
    auto_merge: boolean
    scope_profile: string
    provider: string
    model: string
  }
  started: false
  merge_performed: false
  provider_invoked: false
  note: string
  generated_at: string
}

/** 409 shape when a live run already holds the exclusive lock (never double-launches). */
export interface AtlasLoopStartRunBlocked {
  schema_version: 'atlas.software_company_stewardship.loop_command_start_run.v1' | string
  status: 'blocked'
  reason: 'loop_already_running' | string
  area_id: string
  focus: string
  holder: { run_id: string; pid: number; acquired_at: string }
  detail: string
  generated_at: string
}

/** 422 shape (missing operator_actor / invalid mode). */
export interface AtlasLoopStartRunError {
  status: 'blocked'
  reason: 'operator_actor_required' | 'invalid_mode' | string
  detail: string
}

export async function startAtlasLoopRun(
  input: StartAtlasLoopRunInput,
): Promise<AtlasLoopStartRunResponse> {
  const area = input.area ?? ATLAS_LOOP_DEFAULT_AREA
  const body: Record<string, unknown> = { operator_actor: input.operator_actor }
  if (input.focus != null) body.focus = input.focus
  if (input.mode != null) body.mode = input.mode
  if (input.max_runtime_minutes != null) body.max_runtime_minutes = input.max_runtime_minutes
  if (input.max_cycles != null) body.max_cycles = input.max_cycles
  if (input.max_merges != null) body.max_merges = input.max_merges
  if (input.sleep_seconds != null) body.sleep_seconds = input.sleep_seconds
  if (input.auto_merge != null) body.auto_merge = input.auto_merge
  if (input.scope_profile != null) body.scope_profile = input.scope_profile
  if (input.provider != null) body.provider = input.provider
  if (input.model != null) body.model = input.model
  if (input.repo_root != null) body.repo_root = input.repo_root
  return apiPost<AtlasLoopStartRunResponse>(
    `/ai/software-company-stewardship/loop/${encodeURIComponent(area)}/start-run`,
    body,
  )
}

// --- internal -------------------------------------------------------------------

/** Build a `?a=1&b=2` string from defined, non-empty params (skips null/undefined/''). */
function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const pairs: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value == null) continue
    const str = String(value)
    if (str === '') continue
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(str)}`)
  }
  return pairs.length > 0 ? `?${pairs.join('&')}` : ''
}
