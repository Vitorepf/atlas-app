// Engineering domain API surface (types + functions), split out of ./client.
// Re-exported from ./client via `export * from './engineering'` so existing imports keep working.
// Anti-cycle: this module MUST NOT import from ./client. The request engine comes from ./core.
import { apiGet, apiPatch, apiPost, queryString } from './core'

export type AtlasEngineeringEvidenceStatus =
  | 'passed'
  | 'failed'
  | 'needs_review'
  | 'not_applicable'
  | string

export type AtlasEngineeringEvidenceType =
  | 'acceptance'
  | 'scenario'
  | 'validation_evidence'
  | 'manual_qa'
  | 'deep_code_review'
  | 'database_review'
  | string

export interface AtlasEngineeringTaskContract {
  contract_version: number | string
  source: string
  type: string
  goal: string
  context: string[]
  in_scope: string[]
  out_of_scope: string[]
  acceptance_criteria: Array<string | { id?: string; statement?: string; verification_method?: string }>
  likely_files: string[]
  allowed_paths?: string[]
  patterns_to_follow: string[]
  patterns_to_avoid: string[]
  edge_cases: string[]
  dependencies: {
    blocked_by: string[]
    blocks: string[]
  }
  test_coverage: string[]
  estimated_size: 'XS' | 'S' | 'M' | 'L' | 'XL' | string
  definition_of_done: string[]
  refs: Record<string, unknown>
}

export interface AtlasEngineeringBlueprintPhase {
  id: string
  title: string
  gate: string
  required_outputs: string[]
}

export interface AtlasEngineeringAcceptanceItem {
  id: string
  criterion: string
  verification_method: string
  status: string
  evidence_required: boolean
}

export interface AtlasEngineeringScenario {
  id: string
  name: string
  source?: string
  verification_method?: string
}

export interface AtlasEngineeringReviewGate {
  id: string
  title: string
  required: boolean
  status: string
  minimum_confidence?: number
  checks?: string[]
  evidence?: string
  evidence_id?: string | null
}

export interface AtlasEngineeringBlueprint {
  schema_version: number
  blueprint_id: string
  source: string
  generated_at: string
  objective: string
  phases: AtlasEngineeringBlueprintPhase[]
  task_contract_refs: {
    task_id: string
    project_id: string | null
    project_step_id: string | null
  }
  acceptance_matrix: AtlasEngineeringAcceptanceItem[]
  scenario_inventory: AtlasEngineeringScenario[]
  review_gates: AtlasEngineeringReviewGate[]
  contingency_policy: {
    stop_conditions: string[]
    fallback: string
    human_review_required_when: string[]
  }
}

export interface AtlasEngineeringEvidence {
  id: string
  evidence_type: AtlasEngineeringEvidenceType
  target_id: string | null
  status: AtlasEngineeringEvidenceStatus
  confidence: number | null
  summary: string
  trace_id?: string | null
  command: string | null
  artifact_url: string | null
  output_excerpt: string | null
  files: string[]
  metadata: Record<string, unknown>
  source: string
  recorded_at: string | null
}

export interface AtlasEngineeringRunAttemptSummary {
  id: string
  attempt_number: number
  provider?: string | null
  model?: string | null
  phase: string | null
  status: string | null
  trace_id?: string | null
  patch_hash?: string | null
  diff_stat?: Record<string, unknown> | null
  changed_files?: string[]
  failure_summary?: string | null
  started_at?: string | null
  finished_at?: string | null
}

export interface AtlasEngineeringPatchArtifactSummary {
  id: string
  attempt_id?: string | null
  base_ref?: string | null
  head_ref?: string | null
  diff_hash?: string | null
  diff_excerpt?: string | null
  diff_path?: string | null
  changed_files?: string[]
  created_files?: string[]
  deleted_files?: string[]
  risk_flags?: string[]
  metadata?: Record<string, unknown> | null
  created_at?: string | null
}

export interface AtlasEngineeringPatchDiffResponse {
  patch_artifact: AtlasEngineeringPatchArtifactSummary & {
    engineering_run_id: string
    computed_hash?: string | null
    hash_matches?: boolean | null
  }
  diff: {
    content: string
    source: 'diff_path' | 'excerpt' | string
    size_bytes: number
    returned_bytes: number
    truncated: boolean
    max_bytes: number
  }
}

export interface AtlasEngineeringControlResultSummary {
  id?: string
  attempt_id?: string | null
  control_id?: string | null
  control_slug: string
  control_definition_hash?: string | null
  control_version?: number | null
  status: string
  summary?: string | null
  output_excerpt?: string | null
  duration_ms?: number | null
  artifact_path?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string | null
}

export interface AtlasEngineeringTestRunSummary {
  id?: string
  attempt_id?: string | null
  test_case_id?: string | null
  command?: string | null
  status: string
  exit_code?: number | null
  duration_ms?: number | null
  stdout_excerpt?: string | null
  stderr_excerpt?: string | null
  type?: string | null
  source?: string | null
  artifact_path?: string | null
  metadata?: Record<string, unknown> | null
  visual_artifact_export?: Record<string, unknown> | null
  visual_e2e?: Record<string, unknown> | null
  visual_smoke?: Record<string, unknown> | null
  quality_scan?: Record<string, unknown> | null
  quality_scan_result?: Record<string, unknown> | null
  quality_artifact_export?: Record<string, unknown> | null
  created_at?: string | null
}

export interface AtlasEngineeringTestArtifactFile {
  path: string
  bytes: number
  mime_type?: string | null
  kind: 'image' | 'html' | 'json' | 'xml' | 'text' | 'binary' | string
  readable_inline: boolean
  sha256?: string | null
  modified_at?: string | null
}

export interface AtlasEngineeringTestArtifactsResponse {
  run_id: string
  test_run_id: string
  artifact_root_hash: string
  file_count: number
  total_listed_bytes: number
  truncated: boolean
  files: AtlasEngineeringTestArtifactFile[]
}

export interface AtlasEngineeringTestArtifactContentResponse {
  run_id: string
  test_run_id: string
  artifact: AtlasEngineeringTestArtifactFile & {
    returned_bytes: number
    truncated: boolean
    max_bytes: number
  }
  content?: string | null
  content_base64?: string | null
  data_url?: string | null
}

export interface AtlasEngineeringReviewFindingSummary {
  id: string
  severity: string
  status: string
  confidence?: number | null
  category?: string | null
  source?: string | null
  title: string
  body?: string | null
  file_path?: string | null
  start_line?: number | null
  end_line?: number | null
  evidence?: Record<string, unknown> | null
  recommendation?: string | null
  resolution?: Record<string, unknown> | null
  detected_at?: string | null
  resolved_at?: string | null
  created_at?: string | null
}

export interface AtlasEngineeringRunOperatorActionSummary {
  id: string
  action: 'cancel' | 'accept' | 'needs_human' | 'reject' | string
  actor: string | null
  status_before: string | null
  decision_before: string | null
  status_after: string | null
  decision_after: string | null
  note?: string | null
  payload?: Record<string, unknown> | null
  acted_at?: string | null
  created_at?: string | null
}

export interface AtlasEngineeringAttemptComparisonRow {
  attempt_id: string
  attempt_number: number
  provider?: string | null
  model?: string | null
  phase?: string | null
  status?: string | null
  score: number
  rank: number
  recommendation: 'best_repair_base' | 'review_before_replay' | 'avoid_replay_base' | string
  patch_hash?: string | null
  changed_files_count: number
  patch_count: number
  passed_tests: number
  failed_tests: number
  failed_controls: number
  open_findings: number
  blocking_findings: number
  risk_flags: string[]
  signals: string[]
}

export interface AtlasEngineeringAttemptComparison {
  status: 'empty' | 'single_attempt' | 'ranked' | string
  best_attempt_id?: string | null
  best_attempt_number?: number | null
  best_score?: number | null
  best_recommendation?: string | null
  attempts: AtlasEngineeringAttemptComparisonRow[]
}

export interface AtlasEngineeringRunSummary {
  id?: string
  task_id?: string
  generated_at?: string | null
  plan_id?: string | null
  blueprint_id?: string | null
  status?: string | null
  decision?: string | null
  score?: number | null
  attempt_count?: number
  context_pack_hash?: string | null
  harnessability_score?: number | null
  autonomy_policy?: Record<string, unknown> | null
  model_selection?: Record<string, unknown> | null
  replay?: Record<string, unknown> | null
  workspace?: {
    mode?: string | null
    status?: string | null
    isolated?: boolean
    release_status?: string | null
  }
  review_summary?: {
    open_count: number
    blocking_count: number
    by_severity: Record<string, number>
  }
  attempts?: AtlasEngineeringRunAttemptSummary[]
  patch_artifacts?: AtlasEngineeringPatchArtifactSummary[]
  control_results?: AtlasEngineeringControlResultSummary[]
  test_runs?: AtlasEngineeringTestRunSummary[]
  review_findings?: AtlasEngineeringReviewFindingSummary[]
  operator_actions?: AtlasEngineeringRunOperatorActionSummary[]
  attempt_comparison?: AtlasEngineeringAttemptComparison | null
  timeline?: Array<{
    type: string
    status: string
    label: string | null
    at: string | null
    ref_id: string | null
  }>
  started_at?: string | null
  finished_at?: string | null
  changed_files_count?: number
  acceptance_total?: number
  acceptance_needs_review?: number
  review_needs_attention?: number
  [key: string]: unknown
}

export interface AtlasEngineeringBenchmarkRunSummary {
  id: string
  suite_id: string
  benchmark_key: string | null
  provider: string | null
  model: string | null
  mode: string | null
  case_set_hash: string | null
  status: string
  total_cases: number
  passed_cases: number
  failed_cases: number
  baseline_run_id: string | null
  pass_rate: number | null
  pass_rate_delta: number | null
  average_score: number | null
  average_score_delta: number | null
  duration_ms: number
  trend_status: string | null
  harness_version: string | null
  total_attempts: number
  failed_control_count: number
  blocked_control_count: number
  skipped_required_control_count: number
  failed_test_count: number
  open_review_finding_count: number
  blocking_review_finding_count: number
  changed_files_count: number
  risk_flag_count: number
  total_tokens: number | null
  cost_microusd: number | null
  telemetry_coverage_count: number
  quality_metrics?: Record<string, unknown> | null
  release_gate_status: string | null
  release_gate_profile: string | null
  release_gate_policy?: Record<string, unknown> | null
  release_gate_failures?: string[] | null
  release_gate_warnings?: string[] | null
  rollout_status: string | null
  rollout_policy?: Record<string, unknown> | null
  rollout_decision_at: string | null
  outcome_status: string | null
  outcome_score: number | null
  outcome?: Record<string, unknown> | null
  outcome_recorded_at: string | null
  outcome_recorded_by: string | null
  summary?: Record<string, unknown> | null
  started_at: string | null
  finished_at: string | null
  created_at: string | null
}

export interface AtlasEngineeringBenchmarkSuiteSummary {
  id: string
  slug: string
  name: string
  description: string | null
  status: string
  cases_count: number
  benchmark_runs_count: number
  corpus_manifest?: Record<string, unknown> | null
  corpus_health?: Record<string, unknown> | null
  rollout_policy?: Record<string, unknown> | null
  rollout_calibration?: Record<string, unknown> | null
  latest_run: AtlasEngineeringBenchmarkRunSummary | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasEngineeringBenchmarkCaseSummary {
  id: string
  suite_id: string
  task_id: string | null
  case_code: string
  title: string
  description: string | null
  expected_decision: string | null
  min_score: number
  corpus_tier: string | null
  domain_slug: string | null
  risk_profile: string | null
  curation_status: string | null
  curation_score: number | null
  corpus_fingerprint: string | null
  curated_at: string | null
  tags: string[]
  status: string
  workspace_path_hash: string | null
  metadata?: Record<string, unknown>
  created_at: string | null
}

export interface AtlasEngineeringBenchmarkResultSummary {
  id: string
  benchmark_run_id: string
  case_id: string
  case_code: string | null
  engineering_run_id: string | null
  task_id: string | null
  status: string
  passed: boolean
  decision: string | null
  score: number | null
  duration_ms: number
  expectation: Record<string, unknown>
  observed: Record<string, unknown>
  failure_summary: string | null
  engineering_run?: AtlasEngineeringRunSummary | null
  created_at: string | null
}

export interface AtlasEngineeringBenchmarkSuiteResponse {
  suite: {
    id: string
    slug: string
    name: string
    description: string | null
    status: string
    default_runner_options: Record<string, unknown>
    metadata: Record<string, unknown>
    corpus_manifest?: Record<string, unknown> | null
    corpus_health?: Record<string, unknown> | null
    rollout_policy?: Record<string, unknown> | null
    rollout_calibration?: Record<string, unknown> | null
    created_at: string | null
    updated_at: string | null
  }
  cases: AtlasEngineeringBenchmarkCaseSummary[]
  latest_runs: AtlasEngineeringBenchmarkRunSummary[]
}

export interface AtlasEngineeringBenchmarkRunResponse {
  benchmark_run: AtlasEngineeringBenchmarkRunSummary
  suite: {
    id: string
    slug: string
    name: string
  } | null
  results: AtlasEngineeringBenchmarkResultSummary[]
}

export interface AtlasEngineeringBenchmarkSuitesResponse {
  suites: AtlasEngineeringBenchmarkSuiteSummary[]
}

export interface AtlasEngineeringBenchmarkRunInput {
  workspace?: string | null
  provider?: string | null
  model?: string | null
  model_policy?: 'fixed' | 'off' | 'auto' | 'balanced' | 'best_quality' | 'best-quality' | 'fastest' | 'cheapest' | string | null
  fair_mode?: boolean | null
  claude_only?: boolean | null
  single_provider?: boolean | null
  no_decide?: boolean | null
  fallback_disabled?: boolean | null
  require_pass_without_human?: boolean | null
  claude_code_baseline?: 'off' | 'plan' | 'run' | boolean | number | string | null
  claude_code_baseline_mode?: 'off' | 'plan' | 'run' | string | null
  claude_code_baseline_model?: string | null
  claude_code_baseline_binary?: string | null
  claude_code_baseline_workspace?: string | null
  claude_code_baseline_timeout?: number | null
  claude_code_baseline_validation_timeout?: number | null
  baseline_runner?: 'off' | 'plan' | 'run' | string | null
  baseline_model?: string | null
  baseline_timeout_seconds?: number | null
  baseline_validation_timeout_seconds?: number | null
  rivals_battery_mode?: 'official_fair' | 'same_model' | 'max' | string | null
  rivals_battery_plan_hash?: string | null
  operator_plan_reviewed?: boolean | null
  operator_cost_acknowledged?: boolean | null
  permission?: 'auto' | 'read' | 'write' | 'danger' | string | null
  sandbox?: 'workspace' | 'worktree' | 'docker' | string | null
  docker_service?: string | null
  docker_image?: string | null
  docker_workdir?: string | null
  docker_cache?: 'auto' | 'off' | string | null
  docker_network?: 'profile' | 'none' | 'bridge' | string | null
  docker_healthcheck_services?: string[] | null
  docker_healthcheck_timeout?: number | null
  docker_artifact_paths?: string[] | null
  docker_artifact_max_files?: number | null
  docker_artifact_max_bytes?: number | null
  provider_runtime?: 'host' | 'docker' | 'auto' | string | null
  provider_docker_compose_file?: string | null
  provider_docker_service?: string | null
  provider_docker_app_dir?: string | null
  provider_docker_workspace_dir?: string | null
  max_attempts?: number | null
  test_command?: string | null
  visual_e2e?: 'auto' | 'off' | 'required' | string | null
  quality_scan?: 'auto' | 'off' | 'required' | string | null
  quality_profile?: 'auto' | 'fast' | 'standard' | 'release' | 'deep' | string | null
  quality_changed_only?: boolean | null
  harness_policy?: 'auto' | 'off' | 'strict' | string | null
  control_profile?: string | null
  complete?: boolean | null
  auto_test?: boolean | null
  critical?: boolean | null
  dry_run?: boolean | null
  no_provider?: boolean | null
  keep_workspace?: boolean | null
  apply_isolated_patch?: boolean | null
  release_gate_profile?: 'off' | 'advisory' | 'smoke' | 'release' | 'strict' | string | null
  release_gate_policy?: Record<string, unknown> | null
  limit?: number | null
  corpus_tier?: 'smoke' | 'release' | 'full_regression' | 'quarantine' | string | null
  domain_slug?: string | null
  risk_profile?: 'low' | 'medium' | 'high' | 'critical' | string | null
  curation_status?: 'candidate' | 'curated' | 'quarantined' | 'retired' | string | null
  case_codes?: string[]
  tags?: string[]
  runner_options?: Record<string, unknown>
}

export interface AtlasEngineeringRivalsBatteryPlanInput {
  mode: 'official_fair' | 'same_model' | 'max' | string
  workspace?: string | null
  baseline_workspace?: string | null
  provider?: string | null
  model?: string | null
  limit?: number | null
}

export interface AtlasEngineeringRivalsBatteryPlanResponse {
  battery_plan: {
    schema_version: 'atlas.rivals.battery_plan.v1' | string
    mode: string
    status: string
    ready: boolean
    blockers: string[]
    operator_required: boolean
    cost_acknowledgement_required: boolean
    agent_auto_execution_allowed: boolean
    provider_dispatch_required: boolean
    external_cost_possible: boolean
    synthetic_scores_allowed: boolean
    plan_review_required: boolean
    plan_hash: string
    selection_contract?: {
      schema_version: 'atlas.rivals.battery_selection_contract.v1' | string
      allowed_modes?: Array<{
        id: string
        label?: string | null
        description?: string | null
        requires_provider?: boolean | null
        requires_model?: boolean | null
        requires_baseline_workspace?: boolean | null
        fair_claim_eligible?: boolean | null
        max_capability_run?: boolean | null
        recommended_provider?: string | null
        recommended_model?: string | null
      }>
      provider_model_options?: Array<{
        provider: string
        label?: string | null
        allow_auto?: boolean | null
        allow_manual?: boolean | null
        models?: Array<{
          model: string
          label?: string | null
          role?: string | null
          tier?: string | null
        }>
      }>
      ui_must_send_mode?: boolean | null
      ui_must_send_provider_and_model_for_modes?: string[]
      ui_may_leave_provider_or_model_empty_for_modes?: string[]
    }
    execution_intent: Record<string, unknown>
    corpus: Record<string, unknown>
    safety: Record<string, unknown>
    generated_at: string | null
    [key: string]: unknown
  }
}

export interface AtlasEngineeringRunReplayInput extends AtlasEngineeringBenchmarkRunInput {
  provider_replay?: boolean | null
  same_sandbox?: boolean | null
}

export interface AtlasEngineeringRunOperatorActionInput {
  action: 'cancel' | 'accept' | 'needs_human' | 'reject'
  actor?: string | null
  note?: string | null
  payload?: Record<string, unknown> | null
}

export interface AtlasEngineeringRunResponse {
  ok?: boolean
  run: AtlasEngineeringRunSummary
  operator_action?: AtlasEngineeringRunOperatorActionSummary
  contract?: Record<string, unknown>
  blueprint?: Record<string, unknown>
  context_pack?: Record<string, unknown>
  controls?: Array<Record<string, unknown>>
  harnessability?: Record<string, unknown>
  score?: Record<string, unknown>
  test_run_count?: number
}

export interface AtlasEngineeringBenchmarkDefaultSuiteInput {
  slug?: string | null
  name?: string | null
  description?: string | null
  default_runner_options?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface AtlasEngineeringBenchmarkOutcomeInput {
  status?: 'pending' | 'healthy' | 'accepted' | 'degraded' | 'incident' | 'rolled_back' | string | null
  outcome_status?: 'pending' | 'healthy' | 'accepted' | 'degraded' | 'incident' | 'rolled_back' | string | null
  score?: number | null
  outcome_score?: number | null
  summary?: string | null
  notes?: string | null
  signals?: Record<string, unknown>
  rollback_reason?: string | null
  incident_ref?: string | null
  recorded_by?: string | null
}

export interface AtlasEngineeringBenchmarkCalibrationInput {
  limit?: number | null
}

export interface AtlasEngineeringHarnessabilityCalibrationInput {
  limit?: number | null
}

export interface AtlasEngineeringHarnessabilityCalibrationResponse {
  harnessability_calibration: Record<string, unknown> | null
}

export interface AtlasEngineeringKnowledgeItemSummary {
  id: string
  slug: string
  title: string
  category: string
  status: string
  priority: number
  source_type: string
  canonical_path: string
  source_hash: string
  content_hash: string
  summary: string | null
  tags: string[]
  related_paths: string[]
  capabilities: string[]
  decisions: string[]
  maintenance: string[]
  metadata?: Record<string, unknown>
  indexed_at: string | null
  last_verified_at: string | null
  archived_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasEngineeringKnowledgeItemDetail extends AtlasEngineeringKnowledgeItemSummary {
  body_excerpt: string | null
}

export interface AtlasEngineeringKnowledgeItemResponse {
  knowledge_item: AtlasEngineeringKnowledgeItemDetail
}

export interface AtlasEngineeringKnowledgeContextRef {
  type: string
  id: string
  slug: string
  title: string
  category: string
  priority: number
  canonical_path: string
  content_hash: string
  summary: string | null
  reason: string
}

export interface AtlasEngineeringKnowledgeContextResponse {
  knowledge_refs: AtlasEngineeringKnowledgeContextRef[]
}

export interface AtlasEngineeringKnowledgeResponse {
  summary: {
    status: string
    table_exists: boolean
    docs_root: string
    docs_root_exists: boolean
    canonical_doc_count?: number
    total: number
    active: number
    archived?: number
    categories: Record<string, number>
    last_indexed_at: string | null
  }
  items: AtlasEngineeringKnowledgeItemSummary[]
}

export interface AtlasEngineeringKnowledgeSyncResponse {
  ok: boolean
  dry_run: boolean
  docs_root: string
  summary: {
    created: number
    updated: number
    unchanged: number
    archived: number
    failed: number
  }
  items: Array<Record<string, unknown>>
  generated_at: string
}

export interface AtlasEngineeringCodeSummary {
  status: string
  table_exists: boolean
  module_count: number
  symbol_count: number
  doc_link_count: number
  route_count?: number
  command_count?: number
  migration_count?: number
  test_count?: number
  docs_status?: Record<string, number>
  layers?: Record<string, number>
  last_indexed_at?: string | null
}

export interface AtlasEngineeringCodeModuleSummary {
  id: string
  slug: string
  name: string
  layer: string
  root_path: string | null
  primary_language: string | null
  status: string
  owner: string | null
  description: string | null
  docs_status: string
  file_count: number
  symbol_count: number
  route_count: number
  command_count: number
  migration_count: number
  test_count: number
  source_hash: string
  docs_hash: string | null
  tags: string[]
  related_docs: string[]
  related_tests: string[]
  metadata: Record<string, unknown>
  indexed_at: string | null
  archived_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface AtlasEngineeringCodeSymbolSummary {
  id: string
  module_id: string | null
  module_slug: string | null
  symbol_type: string
  symbol_name: string
  file_path: string
  line_start: number | null
  line_end: number | null
  language: string | null
  signature: string | null
  namespace: string | null
  parent_symbol: string | null
  visibility: string | null
  status: string
  docs_status: string
  source_hash: string
  related_doc_ids: string[]
  metadata: Record<string, unknown>
  indexed_at: string | null
}

export interface AtlasEngineeringDocLinkSummary {
  id: string
  knowledge_item_id: string | null
  module_id: string | null
  symbol_id: string | null
  link_type: string
  status: string
  canonical_path: string
  target_path: string | null
  doc_hash: string | null
  target_hash: string | null
  metadata: Record<string, unknown>
  indexed_at: string | null
}

export interface AtlasEngineeringCodeModulesResponse {
  summary: AtlasEngineeringCodeSummary
  modules: AtlasEngineeringCodeModuleSummary[]
}

export interface AtlasEngineeringCodeSymbolsResponse {
  summary: AtlasEngineeringCodeSummary
  symbols: AtlasEngineeringCodeSymbolSummary[]
}

export interface AtlasEngineeringCodeModuleResponse {
  module: AtlasEngineeringCodeModuleSummary
  symbols: AtlasEngineeringCodeSymbolSummary[]
  doc_links: AtlasEngineeringDocLinkSummary[]
}

export interface AtlasEngineeringCodeIndexResponse {
  ok: boolean
  dry_run: boolean
  workspace: string
  summary: {
    module_count: number
    symbol_count: number
    doc_link_count: number
    route_count: number
    command_count: number
    migration_count: number
    test_count: number
    file_count: number
  }
  modules?: AtlasEngineeringCodeModuleSummary[]
  symbols_preview?: AtlasEngineeringCodeSymbolSummary[]
  symbol_count?: number
  generated_at: string
}

export interface AtlasEngineeringCodeAuditModuleCounts {
  missing_in_index: number
  removed_from_workspace: number
  changed: number
}

export interface AtlasEngineeringCodeAuditSymbolCounts {
  added: number
  removed: number
}

export interface AtlasEngineeringCodeAuditDocLinkCounts {
  current: number
  persisted_missing_target_status: number
  missing_targets: number
  stale_target_hashes: number
}

export interface AtlasEngineeringCodeAuditSummary {
  scanned: {
    module_count?: number
    symbol_count?: number
    doc_link_count?: number
    route_count?: number
    command_count?: number
    migration_count?: number
    test_count?: number
    file_count?: number
    [key: string]: unknown
  }
  persisted: AtlasEngineeringCodeSummary
  drift: {
    total: number
    modules: AtlasEngineeringCodeAuditModuleCounts
    symbols: AtlasEngineeringCodeAuditSymbolCounts
    doc_links: AtlasEngineeringCodeAuditDocLinkCounts
  }
}

export interface AtlasEngineeringCodeAuditResponse {
  ok: boolean
  dry_run: boolean
  writes: boolean
  status: 'fresh' | 'drift_detected' | 'empty_index' | string
  workspace: string
  summary: AtlasEngineeringCodeAuditSummary
  drift: {
    modules: {
      counts: AtlasEngineeringCodeAuditModuleCounts
      missing_in_index: Array<Record<string, unknown>>
      removed_from_workspace: Array<Record<string, unknown>>
      changed: Array<Record<string, unknown>>
    }
    symbols: {
      counts: AtlasEngineeringCodeAuditSymbolCounts
      by_type: {
        added: Record<string, number>
        removed: Record<string, number>
      }
      added: Array<Record<string, unknown>>
      removed: Array<Record<string, unknown>>
    }
    doc_links: {
      counts: AtlasEngineeringCodeAuditDocLinkCounts
      missing_targets: Array<Record<string, unknown>>
      stale_target_hashes: Array<Record<string, unknown>>
    }
  }
  generated_at: string
}

export interface AtlasEngineeringBenchmarkTrendSeries {
  benchmark_key: string
  provider: string | null
  model: string | null
  mode: string | null
  case_set_hash: string | null
  latest_status: string | null
  latest_trend_status: string | null
  run_count: number
  runs: AtlasEngineeringBenchmarkRunSummary[]
}

export interface AtlasEngineeringBenchmarkTrendsResponse {
  suite: {
    id: string
    slug: string
    name: string
  }
  runs: AtlasEngineeringBenchmarkRunSummary[]
  series: AtlasEngineeringBenchmarkTrendSeries[]
}

export interface AtlasEngineeringFairClaudeScorecard {
  enabled: boolean
  case_count: number
  protocol_validity_rate: number | null
  pass_without_human_rate: number | null
  pass_without_human_rate_medium_hard: number | null
  repair_conversion_rate: number | null
  final_gate_pass_rate: number | null
  intervention_reduction: number | null
  autonomous_success_lift: number | null
  time_to_green: unknown
  cost_per_green_case: unknown
  invalid_case_count: number
  provider_violation_count: number
  fallback_violation_count: number
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeCaseComparison {
  schema_version: number
  result_id: string
  benchmark_run_id: string
  case_id: string
  case_code: string | null
  title: string | null
  domain_slug: string | null
  risk_profile: string | null
  corpus_tier: string | null
  status: string
  passed: boolean
  decision: string | null
  score: number | null
  comparison_status: string
  comparable: boolean
  winner: 'atlas' | 'claude_code_baseline' | 'tie' | string | null
  winner_reason: string | null
  blocking_reasons: string[]
  atlas: {
    verified: boolean
    passed: boolean
    pass_without_human: boolean
    score: number | null
    duration_ms: number | null
    attempt_count: number | null
    repair_attempt_count: number | null
    repair_used: boolean
    converted_to_green: boolean
    provider_violation_count: number
    fallback_violation_count: number
    human_intervention_count: number
    [key: string]: unknown
  }
  claude_code_baseline: {
    verified: boolean
    passed: boolean
    pass_without_human: boolean
    score: number | null
    duration_ms: number | null
    human_intervention_count: number
    [key: string]: unknown
  }
  deltas: {
    score: number | null
    duration_ms: number | null
    human_intervention_count: number | null
    [key: string]: unknown
  }
  failure_summary: string | null
  created_at: string | null
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeNextAction {
  id: string
  severity: 'critical' | 'warning' | 'info' | string
  title: string
  detail: string
  command: string | null
  owner: string | null
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeExecutiveSummary {
  claim_status: string
  headline: string
  ready_for_claim: boolean
  winner: 'atlas' | 'claude_code_baseline' | 'tie' | string | null
  confidence: string
  sample: Record<string, unknown>
  quality_bar: Record<string, unknown>
  auditability: Record<string, unknown>
  top_risks: string[]
  baseline_win_cases: string[]
  blocked_cases: string[]
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeEvidencePacket {
  schema_version: number
  kind: 'fair_claude_claim_evidence_packet' | string
  generated_at: string | null
  evidence_hash: string
  suite: Record<string, unknown>
  protocol: Record<string, unknown>
  claim: Record<string, unknown>
  scorecard: Record<string, unknown>
  audit: Record<string, unknown>
  case_outcomes: Array<Record<string, unknown>>
  next_action_ids: string[]
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeBatteryExecutionContract {
  schema_version: 'atlas.fair_claude.battery_execution_contract.v1' | string
  status: string
  summary: string
  operator_required: boolean
  agent_auto_execution_allowed: boolean
  provider_dispatch_required: boolean
  external_cost_possible: boolean
  synthetic_scores_allowed: boolean
  current_state: {
    corpus_prepared: boolean
    release_corpus_case_count: number
    minimum_release_corpus_case_count: number
    paired_case_count: number
    comparable_case_count: number
    baseline_executed: boolean
    replay_verified: boolean
    ready_for_claim: boolean
    [key: string]: unknown
  }
  start_requirements: string[]
  commands: Record<string, string>
  recommended_presets: Array<{
    id: string
    case_count: number | null
    estimated_time: string
    purpose: string
    [key: string]: unknown
  }>
  safety: Record<string, unknown>
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeExportBundle {
  schema_version: number
  kind: 'fair_claude_export_bundle' | string
  recommended_directory: string
  verification_command?: string
  evidence_hash: string | null
  bundle_hash: string
  files: Record<string, {
    kind: string
    content_type: string
    bytes: number
    sha256: string
    [key: string]: unknown
  }>
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeRunHistorySummary {
  schema_version: number
  health_status: string
  winner: 'atlas' | 'claude_code_baseline' | 'tie' | string | null
  blocking_reasons: string[]
  atlas_win_count: number
  claude_code_baseline_win_count: number
  tie_count: number
  comparable_count: number
  protocol_validity_rate: number | null
  pass_without_human_rate: number | null
  pass_without_human_rate_medium_hard: number | null
  final_gate_pass_rate: number | null
  repair_conversion_rate: number | null
  baseline_executed_count: number
  replay_packet_count: number
  replay_integrity_failed_count: number
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeRunSummary extends AtlasEngineeringBenchmarkRunSummary {
  fair_report_scope?: 'official_fair_claude' | 'paired_non_fair' | string
  history_summary?: AtlasEngineeringFairClaudeRunHistorySummary
  paired_scorecard?: AtlasEngineeringFairClaudeScorecard | Record<string, unknown> | null
  claude_code_baseline?: Record<string, unknown> | null
  replay_manifest?: Record<string, unknown> | null
}

export interface AtlasEngineeringFairClaudeReportResponse {
  schema_version: number
  kind: 'fair_claude_benchmark_report' | string
  generated_at: string | null
  suite: {
    id: string
    slug: string
    name: string
  }
  limit: number
  scan_limit: number
  scanned_run_count: number
  run_count: number
  result_count: number
  scope: {
    paired_run_count: number
    fair_run_count: number
    paired_result_count: number
    fair_result_count: number
    non_fair_paired_result_count: number
    [key: string]: unknown
  }
  readiness: {
    status: string
    ready_for_claim: boolean
    blocking_reasons: string[]
    atlas_win_count: number
    claude_code_baseline_win_count: number
    tie_count: number
    comparable_count: number
    fair_mode_count: number
    active_corpus_case_count: number
    release_corpus_case_count: number
    minimum_release_corpus_case_count: number
    [key: string]: unknown
  }
  executive_summary?: AtlasEngineeringFairClaudeExecutiveSummary
  battery_execution_contract?: AtlasEngineeringFairClaudeBatteryExecutionContract
  corpus_manifest?: Record<string, unknown> | null
  next_actions?: AtlasEngineeringFairClaudeNextAction[]
  evidence_packet?: AtlasEngineeringFairClaudeEvidencePacket
  claim_markdown?: string
  export_bundle?: AtlasEngineeringFairClaudeExportBundle
  paired_scorecard: AtlasEngineeringFairClaudeScorecard
  all_paired_scorecard?: AtlasEngineeringFairClaudeScorecard | null
  claude_code_baseline: {
    enabled: boolean
    case_count: number
    [key: string]: unknown
  }
  replay_manifest: {
    enabled: boolean
    run_count: number
    packet_count: number
    artifact_integrity_passed_count: number
    artifact_integrity_failed_count: number
    [key: string]: unknown
  }
  case_comparisons?: AtlasEngineeringFairClaudeCaseComparison[]
  runs: AtlasEngineeringFairClaudeRunSummary[]
}

export interface AtlasEngineeringDecision {
  status: string
  auto_complete_allowed: boolean
  reason: string
}

export interface AtlasEngineeringAcceptanceStatusItem extends AtlasEngineeringAcceptanceItem {
  evidence?: string
}

export interface AtlasEngineeringStatusSnapshot {
  snapshot_version: number
  generated_at: string
  task_id: string
  contract_goal: string
  blueprint_id: string
  decision: AtlasEngineeringDecision
  acceptance_checklist: AtlasEngineeringAcceptanceStatusItem[]
  review_gates: AtlasEngineeringReviewGate[]
  evidence_summary: {
    total: number
    latest: AtlasEngineeringEvidence | null
    passed: number
    failed: number
    needs_review: number
  }
}

export interface AtlasEngineeringBlueprintSnapshot {
  id: string
  task_id: string
  project_id: string | null
  project_step_id: string | null
  status: string
  version: number
  source: string
  content_hash: string
  frozen_at: string | null
  created_at: string | null
  updated_at: string | null
  matches_current_content: boolean
}

export interface AtlasEngineeringEvidenceInput {
  evidence_type: AtlasEngineeringEvidenceType
  target_id?: string | null
  status: AtlasEngineeringEvidenceStatus
  confidence?: number | null
  summary: string
  trace_id?: string | null
  command?: string | null
  artifact_url?: string | null
  output_excerpt?: string | null
  files?: string[]
  metadata?: Record<string, unknown>
}

export interface AtlasEngineeringEvidenceResponse {
  task_id: string
  evidence: AtlasEngineeringEvidence
  contract: AtlasEngineeringTaskContract
  blueprint: AtlasEngineeringBlueprint
  blueprint_snapshot: AtlasEngineeringBlueprintSnapshot | null
  status_snapshot: AtlasEngineeringStatusSnapshot
  latest_run: AtlasEngineeringRunSummary | null
  evidence_history: AtlasEngineeringEvidence[]
}

export interface AtlasEngineeringProjectBlueprintRecord {
  id: string
  project_id: string
  status: 'draft' | 'frozen' | 'superseded' | 'archived' | string
  version: number
  source: string
  created_by: string
  content_hash: string
  matches_current_content: boolean
  stale: boolean
  validation: Record<string, unknown>
  human_exception: Record<string, unknown>
  prepared_at: string | null
  frozen_at: string | null
  superseded_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasEngineeringProjectBlueprintResponse {
  project_id: string
  latest?: AtlasEngineeringProjectBlueprintRecord | null
  frozen?: AtlasEngineeringProjectBlueprintRecord | null
  record?: AtlasEngineeringProjectBlueprintRecord | null
  blueprint?: Record<string, unknown> | null
  content_hash?: string
  validation?: Record<string, unknown>
  missing_fields?: string[]
  suggested_questions?: string[]
}

export interface AtlasEngineeringProjectTasksGenerateResponse {
  project_id: string
  project_blueprint_id: string
  project_blueprint_version: number
  created_count: number
  updated_count: number
  skipped_count: number
  created: Array<Record<string, unknown>>
  updated: Array<Record<string, unknown>>
  skipped: Array<Record<string, unknown>>
}

export interface AtlasEngineeringQaInput {
  target_id?: string | null
  status: AtlasEngineeringEvidenceStatus
  confidence?: number | null
  summary?: string
  steps: string[]
  expected_result: string
  actual_result: string
  screenshot_url?: string | null
  artifact_url?: string | null
  console_output?: string | null
  network_output?: string | null
  risk_notes?: string | null
  visual_required?: boolean
  files?: string[]
}

export interface AtlasEngineeringGateResponse {
  task_id: string
  blocking?: boolean
  evidence?: AtlasEngineeringEvidence
  qa?: AtlasEngineeringEvidence
  status?: string
  checks?: Record<string, string>
  findings?: Array<Record<string, unknown>>
  summary?: Record<string, unknown>
  recorded_findings?: Array<Record<string, unknown>>
}

export interface AtlasEngineeringApiContractInput {
  workspace: string
  spec?: string | null
  strict?: boolean | null
  run_context_type?: string | null
  run_context_id?: string | null
}

export interface AtlasEngineeringApiContractResponse {
  status: string
  workspace_hash: string
  artifact_root: string
  artifact_root_hash: string
  spec_path: string | null
  strict: boolean
  summary: {
    spec_detected: boolean
    route_count: number
    documented_path_count: number
    finding_count: number
    blocking_finding_count: number
    severity_counts?: Record<string, number>
  }
  findings: Array<Record<string, unknown>>
  metrics: Record<string, unknown>
  recommendations: Array<Record<string, unknown>>
  duration_ms: number
}

export async function recordTaskEngineeringEvidence(
  id: string,
  input: AtlasEngineeringEvidenceInput,
): Promise<AtlasEngineeringEvidenceResponse> {
  return apiPost<AtlasEngineeringEvidenceResponse>(`/tasks/${encodeURIComponent(id)}/engineering/evidence`, input)
}

export async function fetchProjectEngineeringBlueprint(id: string): Promise<AtlasEngineeringProjectBlueprintResponse> {
  return apiGet<AtlasEngineeringProjectBlueprintResponse>(`/projects/${encodeURIComponent(id)}/engineering/blueprint`)
}

export async function prepareProjectEngineeringBlueprint(id: string): Promise<AtlasEngineeringProjectBlueprintResponse> {
  return apiPost<AtlasEngineeringProjectBlueprintResponse>(`/projects/${encodeURIComponent(id)}/engineering/blueprint/prepare`, {})
}

export async function createProjectEngineeringBlueprint(id: string): Promise<AtlasEngineeringProjectBlueprintResponse> {
  return apiPost<AtlasEngineeringProjectBlueprintResponse>(`/projects/${encodeURIComponent(id)}/engineering/blueprint/create`, {})
}

export async function validateProjectEngineeringBlueprint(
  id: string,
  input: { version?: number } = {},
): Promise<AtlasEngineeringProjectBlueprintResponse> {
  return apiPost<AtlasEngineeringProjectBlueprintResponse>(`/projects/${encodeURIComponent(id)}/engineering/blueprint/validate`, input)
}

export async function freezeProjectEngineeringBlueprint(
  id: string,
  input: { version?: number; exception_reason?: string; approved_by?: string } = {},
): Promise<AtlasEngineeringProjectBlueprintResponse> {
  return apiPost<AtlasEngineeringProjectBlueprintResponse>(`/projects/${encodeURIComponent(id)}/engineering/blueprint/freeze`, input)
}

export async function generateProjectEngineeringTasks(
  id: string,
  input: { version?: number; force?: boolean } = {},
): Promise<AtlasEngineeringProjectTasksGenerateResponse> {
  return apiPost<AtlasEngineeringProjectTasksGenerateResponse>(`/projects/${encodeURIComponent(id)}/engineering/tasks/generate`, input)
}

export async function recordTaskEngineeringQa(
  id: string,
  input: AtlasEngineeringQaInput,
): Promise<AtlasEngineeringGateResponse> {
  return apiPost<AtlasEngineeringGateResponse>(`/tasks/${encodeURIComponent(id)}/engineering/qa`, input)
}

export async function runTaskEngineeringHarness(
  id: string,
  input: AtlasEngineeringBenchmarkRunInput,
): Promise<AtlasEngineeringRunResponse> {
  return apiPost<AtlasEngineeringRunResponse>(`/tasks/${encodeURIComponent(id)}/engineering/runs`, input)
}

export async function runTaskEngineeringDeepReview(
  id: string,
  input: { findings?: Array<Record<string, unknown>>; recorded_by?: string } = {},
): Promise<AtlasEngineeringGateResponse> {
  return apiPost<AtlasEngineeringGateResponse>(`/tasks/${encodeURIComponent(id)}/engineering/review/deep`, input)
}

export async function runTaskPostgresReview(
  id: string,
  input: { workspace?: string; files?: string[] } = {},
): Promise<AtlasEngineeringGateResponse> {
  return apiPost<AtlasEngineeringGateResponse>(`/tasks/${encodeURIComponent(id)}/engineering/db/review`, input)
}

export async function fetchEngineeringRunPatchDiff(
  runId: string,
  patchId: string,
  params: { max_bytes?: number } = {},
): Promise<AtlasEngineeringPatchDiffResponse> {
  return apiGet<AtlasEngineeringPatchDiffResponse>(
    `/engineering/runs/${encodeURIComponent(runId)}/patch-artifacts/${encodeURIComponent(patchId)}/diff${queryString(params)}`,
  )
}

export async function replayEngineeringRun(
  runId: string,
  input: AtlasEngineeringRunReplayInput,
): Promise<AtlasEngineeringRunResponse> {
  return apiPost<AtlasEngineeringRunResponse>(`/engineering/runs/${encodeURIComponent(runId)}/replay`, input)
}

export async function replayEngineeringRunAttempt(
  runId: string,
  attemptId: string,
  input: AtlasEngineeringRunReplayInput,
): Promise<AtlasEngineeringRunResponse> {
  return apiPost<AtlasEngineeringRunResponse>(
    `/engineering/runs/${encodeURIComponent(runId)}/attempts/${encodeURIComponent(attemptId)}/replay`,
    input,
  )
}

export async function applyEngineeringRunOperatorAction(
  runId: string,
  input: AtlasEngineeringRunOperatorActionInput,
): Promise<AtlasEngineeringRunResponse> {
  return apiPost<AtlasEngineeringRunResponse>(`/engineering/runs/${encodeURIComponent(runId)}/operator-action`, input)
}

export async function listEngineeringTestRunArtifacts(
  runId: string,
  testRunId: string,
  params: { limit?: number } = {},
): Promise<AtlasEngineeringTestArtifactsResponse> {
  return apiGet<AtlasEngineeringTestArtifactsResponse>(
    `/engineering/runs/${encodeURIComponent(runId)}/test-runs/${encodeURIComponent(testRunId)}/artifacts${queryString(params)}`,
  )
}

export async function fetchEngineeringTestRunArtifactContent(
  runId: string,
  testRunId: string,
  params: { path: string; max_bytes?: number },
): Promise<AtlasEngineeringTestArtifactContentResponse> {
  return apiGet<AtlasEngineeringTestArtifactContentResponse>(
    `/engineering/runs/${encodeURIComponent(runId)}/test-runs/${encodeURIComponent(testRunId)}/artifacts/content${queryString(params)}`,
  )
}

export async function fetchEngineeringHarnessabilityCalibration(): Promise<AtlasEngineeringHarnessabilityCalibrationResponse> {
  return apiGet<AtlasEngineeringHarnessabilityCalibrationResponse>('/engineering/harnessability/calibration')
}

export async function calibrateEngineeringHarnessability(
  input: AtlasEngineeringHarnessabilityCalibrationInput = {},
): Promise<AtlasEngineeringHarnessabilityCalibrationResponse> {
  return apiPost<AtlasEngineeringHarnessabilityCalibrationResponse>('/engineering/harnessability/calibrate', input)
}

export async function runEngineeringApiContract(
  input: AtlasEngineeringApiContractInput,
): Promise<AtlasEngineeringApiContractResponse> {
  return apiPost<AtlasEngineeringApiContractResponse>('/engineering/api-contract', input)
}

export async function fetchEngineeringKnowledge(
  params: { category?: string; status?: string; q?: string; include_archived?: boolean; limit?: number } = {},
): Promise<AtlasEngineeringKnowledgeResponse> {
  return apiGet<AtlasEngineeringKnowledgeResponse>(`/engineering/knowledge${queryString(params)}`)
}

export async function fetchEngineeringKnowledgeItem(
  item: string,
): Promise<AtlasEngineeringKnowledgeItemResponse> {
  return apiGet<AtlasEngineeringKnowledgeItemResponse>(`/engineering/knowledge/items/${encodeURIComponent(item)}`)
}

export async function fetchEngineeringKnowledgeContext(
  params: { category?: string; q?: string; limit?: number } = {},
): Promise<AtlasEngineeringKnowledgeContextResponse> {
  return apiGet<AtlasEngineeringKnowledgeContextResponse>(`/engineering/knowledge/context${queryString(params)}`)
}

export async function syncEngineeringKnowledge(
  input: { dry_run?: boolean; prune?: boolean } = {},
): Promise<AtlasEngineeringKnowledgeSyncResponse> {
  return apiPost<AtlasEngineeringKnowledgeSyncResponse>('/engineering/knowledge/sync', input)
}

export async function indexEngineeringCodeKnowledge(
  input: { workspace?: string | null; dry_run?: boolean; prune?: boolean } = {},
): Promise<AtlasEngineeringCodeIndexResponse> {
  return apiPost<AtlasEngineeringCodeIndexResponse>('/engineering/knowledge/code/index', input)
}

export async function fetchEngineeringCodeAudit(
  params: { workspace?: string | null; limit?: number } = {},
): Promise<AtlasEngineeringCodeAuditResponse> {
  return apiGet<AtlasEngineeringCodeAuditResponse>(`/engineering/knowledge/code/audit${queryString(params)}`)
}

export async function fetchEngineeringCodeModules(
  params: { layer?: string; docs_status?: string; q?: string; include_archived?: boolean; limit?: number } = {},
): Promise<AtlasEngineeringCodeModulesResponse> {
  return apiGet<AtlasEngineeringCodeModulesResponse>(`/engineering/knowledge/code/modules${queryString(params)}`)
}

export async function fetchEngineeringCodeSymbols(
  params: { module?: string; symbol_type?: string; language?: string; docs_status?: string; q?: string; include_archived?: boolean; limit?: number } = {},
): Promise<AtlasEngineeringCodeSymbolsResponse> {
  return apiGet<AtlasEngineeringCodeSymbolsResponse>(`/engineering/knowledge/code/symbols${queryString(params)}`)
}

export async function fetchEngineeringCodeModule(
  module: string,
): Promise<AtlasEngineeringCodeModuleResponse> {
  return apiGet<AtlasEngineeringCodeModuleResponse>(`/engineering/knowledge/code/modules/${encodeURIComponent(module)}`)
}

export async function listEngineeringBenchmarkSuites(
  params: { status?: string } = {},
): Promise<AtlasEngineeringBenchmarkSuitesResponse> {
  return apiGet<AtlasEngineeringBenchmarkSuitesResponse>(`/engineering/benchmarks/suites${queryString(params)}`)
}

export async function fetchEngineeringBenchmarkSuite(
  suite: string,
): Promise<AtlasEngineeringBenchmarkSuiteResponse> {
  return apiGet<AtlasEngineeringBenchmarkSuiteResponse>(`/engineering/benchmarks/suites/${encodeURIComponent(suite)}`)
}

export async function fetchEngineeringBenchmarkTrends(
  suite: string,
  params: { limit?: number; benchmark_key?: string; provider?: string } = {},
): Promise<AtlasEngineeringBenchmarkTrendsResponse> {
  return apiGet<AtlasEngineeringBenchmarkTrendsResponse>(`/engineering/benchmarks/suites/${encodeURIComponent(suite)}/trends${queryString(params)}`)
}

export async function fetchEngineeringFairClaudeReport(
  suite = 'atlas-fair-claude-v1',
  params: { limit?: number } = {},
): Promise<AtlasEngineeringFairClaudeReportResponse> {
  return apiGet<AtlasEngineeringFairClaudeReportResponse>(
    `/engineering/benchmarks/suites/${encodeURIComponent(suite)}/fair-claude-report${queryString(params)}`,
  )
}

export async function prepareEngineeringFairClaudeBenchmark(
  input: { suite?: string | null; workspace?: string | null } = {},
): Promise<AtlasEngineeringBenchmarkSuiteResponse & {
  corpus_manifest?: Record<string, unknown>
  promoted_count?: number
  promoted_cases?: AtlasEngineeringBenchmarkCaseSummary[]
}> {
  return apiPost<AtlasEngineeringBenchmarkSuiteResponse & {
    corpus_manifest?: Record<string, unknown>
    promoted_count?: number
    promoted_cases?: AtlasEngineeringBenchmarkCaseSummary[]
  }>('/engineering/benchmarks/fair-claude/prepare', input)
}

export async function ensureDefaultEngineeringBenchmarkSuite(
  input: AtlasEngineeringBenchmarkDefaultSuiteInput = {},
): Promise<AtlasEngineeringBenchmarkSuiteResponse> {
  return apiPost<AtlasEngineeringBenchmarkSuiteResponse>('/engineering/benchmarks/suites/default', input)
}

export async function refreshEngineeringBenchmarkCorpus(
  suite: string,
): Promise<AtlasEngineeringBenchmarkSuiteResponse & { corpus_manifest?: Record<string, unknown> }> {
  return apiPost<AtlasEngineeringBenchmarkSuiteResponse & { corpus_manifest?: Record<string, unknown> }>(
    `/engineering/benchmarks/suites/${encodeURIComponent(suite)}/corpus/refresh`,
    {},
  )
}

export async function calibrateEngineeringBenchmarkSuite(
  suite: string,
  input: AtlasEngineeringBenchmarkCalibrationInput = {},
): Promise<AtlasEngineeringBenchmarkSuiteResponse & { rollout_calibration?: Record<string, unknown> }> {
  return apiPost<AtlasEngineeringBenchmarkSuiteResponse & { rollout_calibration?: Record<string, unknown> }>(
    `/engineering/benchmarks/suites/${encodeURIComponent(suite)}/calibrate`,
    input,
  )
}

export async function fetchEngineeringBenchmarkRun(
  runId: string,
): Promise<AtlasEngineeringBenchmarkRunResponse> {
  return apiGet<AtlasEngineeringBenchmarkRunResponse>(`/engineering/benchmarks/runs/${encodeURIComponent(runId)}`)
}

export async function recordEngineeringBenchmarkOutcome(
  runId: string,
  input: AtlasEngineeringBenchmarkOutcomeInput,
): Promise<AtlasEngineeringBenchmarkRunResponse> {
  return apiPatch<AtlasEngineeringBenchmarkRunResponse>(`/engineering/benchmarks/runs/${encodeURIComponent(runId)}/outcome`, input)
}

export async function runEngineeringBenchmarkSuite(
  suite: string,
  input: AtlasEngineeringBenchmarkRunInput,
): Promise<AtlasEngineeringBenchmarkRunResponse> {
  return apiPost<AtlasEngineeringBenchmarkRunResponse>(`/engineering/benchmarks/suites/${encodeURIComponent(suite)}/run`, input)
}

export async function planEngineeringRivalsBattery(
  suite: string,
  input: AtlasEngineeringRivalsBatteryPlanInput,
): Promise<AtlasEngineeringRivalsBatteryPlanResponse> {
  return apiPost<AtlasEngineeringRivalsBatteryPlanResponse>(
    `/engineering/benchmarks/suites/${encodeURIComponent(suite)}/rivals/battery-plan`,
    input,
  )
}

export async function promoteEngineeringRunToBenchmarkCase(
  suite: string,
  input: { run_id: string; title?: string; expected_decision?: string; status?: string; metadata?: Record<string, unknown> },
): Promise<{ case: AtlasEngineeringBenchmarkCaseSummary }> {
  return apiPost<{ case: AtlasEngineeringBenchmarkCaseSummary }>(
    `/engineering/benchmarks/suites/${encodeURIComponent(suite)}/cases/from-run`,
    input,
  )
}
