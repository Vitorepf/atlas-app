import assert from 'node:assert/strict'
import {
  buildEngineeringToolAuthoritySummary,
  buildEngineeringToolRuntimeSummary,
  buildToolRuntimeGateFilters,
  toolAuthorityGroupLine,
  toolApprovalPolicyLine,
  toolRuntimeEvidenceLine,
  toolRuntimeGateIssueLine,
  toolRuntimeGateLine,
  toolRuntimeGateModeLine,
  toolRuntimePolicyLine,
  toolRuntimeRiskLine,
} from '../lib/engineeringToolRuntime'
import type {
  AtlasToolArtifactSummary,
  AtlasToolAuthorityGroup,
  AtlasToolDoctorItem,
  AtlasToolFindingSummary,
  AtlasToolPolicySummary,
  AtlasToolRunSummary,
  AtlasToolsGateResponse,
  AtlasToolsAuthorityResponse,
} from '../lib/api/client'

const readyTool: AtlasToolDoctorItem = {
  slug: 'ripgrep',
  name: 'ripgrep',
  type: 'external',
  category: 'code_search',
  capabilities: ['search', 'local'],
  risks: [],
  risk_level: 'low',
  cost_posture: 'free',
  status: 'ready',
  execution_layer: 'host',
  binary: 'rg',
  binary_path_hash: 'abc',
  version: 'ripgrep 14',
  install_hint: null,
}

const missingTool: AtlasToolDoctorItem = {
  ...readyTool,
  slug: 'semgrep',
  name: 'Semgrep',
  category: 'sast',
  status: 'missing',
  binary: 'semgrep',
  binary_path_hash: null,
  version: null,
  install_hint: 'brew install semgrep',
}

const failedRun: AtlasToolRunSummary = {
  id: 'run-1',
  tool_definition_id: null,
  tool_slug: 'semgrep',
  surface: 'engineering_quality_scan',
  workspace_hash: 'workspace',
  workspace: null,
  run_context_type: null,
  run_context_id: null,
  status: 'failed',
  required: false,
  failure_policy: 'warn',
  policy_decision: 'allowed',
  command_hash: 'cmd',
  exit_code: 1,
  started_at: '2026-05-02T10:00:00Z',
  finished_at: '2026-05-02T10:00:01Z',
  duration_ms: 1000,
  summary_json: {},
  normalized_result_json: {},
  policy_decision_json: {
    execution_tier: 'T2',
    sandbox_mode: 'worktree',
    privacy_level: 'standard',
    task_type: 'security_scan',
    provider_safe: false,
  },
  metadata_json: {},
  created_at: '2026-05-02T10:00:00Z',
  updated_at: '2026-05-02T10:00:01Z',
  artifacts: [{ id: 'artifact-1' } as AtlasToolArtifactSummary],
  findings: [{ blocks_resolved: true } as AtlasToolFindingSummary],
}

assert.deepEqual(buildEngineeringToolRuntimeSummary([], []), {
  status: 'unknown',
  readyCount: 0,
  missingCount: 0,
  warningCount: 0,
  failedEvidenceCount: 0,
  evidenceCount: 0,
  blockingFindingCount: 0,
  lastEvidenceAt: null,
})

const warningSummary = buildEngineeringToolRuntimeSummary([readyTool, missingTool], [])
assert.equal(warningSummary.status, 'warning')
assert.equal(warningSummary.readyCount, 1)
assert.equal(warningSummary.missingCount, 1)

const failedSummary = buildEngineeringToolRuntimeSummary([readyTool], [failedRun])
assert.equal(failedSummary.status, 'failed')
assert.equal(failedSummary.failedEvidenceCount, 1)
assert.equal(failedSummary.blockingFindingCount, 1)
assert.equal(failedSummary.lastEvidenceAt, '2026-05-02T10:00:01Z')

assert.equal(toolRuntimeRiskLine(readyTool), 'low · free · search, local')
assert.equal(
  toolRuntimeEvidenceLine(failedRun),
  'engineering_quality_scan · allowed · T2/worktree/standard/security_scan/provider-unsafe · 1000ms · 1 artefatos · 1 findings',
)

assert.equal(
  toolRuntimeEvidenceLine({
    ...failedRun,
    run_context_type: 'engineering_run',
    run_context_id: 'run-123',
  }),
  'engineering_quality_scan · allowed · T2/worktree/standard/security_scan/provider-unsafe · engineering_run:run-123 · 1000ms · 1 artefatos · 1 findings',
)
assert.equal(toolRuntimePolicyLine(null), null)
assert.equal(toolRuntimePolicyLine({ execution_tier: 'T0', provider_safe: true }), 'T0/provider-safe')

const approvalPolicy: AtlasToolPolicySummary = {
  id: 'policy-1',
  scope_type: 'workspace',
  scope_id: 'workspace-hash',
  tool_slug: 'codeql',
  enabled: true,
  required_when_json: null,
  failure_policy: null,
  timeout_seconds: null,
  thresholds_json: null,
  metadata: {
    approved: true,
    approved_until: '2026-05-03T12:00:00Z',
    network_allowed: true,
    max_execution_tier: 'T2',
    sandbox_mode: 'worktree',
    privacy_level: 'standard',
    task_type: 'security_scan',
    requires_provider_safe: true,
  },
  approval_status: 'approved',
  created_at: '2026-05-03T10:00:00Z',
  updated_at: '2026-05-03T10:00:00Z',
}

assert.equal(
  toolApprovalPolicyLine(approvalPolicy),
  'approved · workspace · T2/worktree/standard/security_scan/provider-safe obrigatório/rede permitida · até 2026-05-03T12:00:00Z',
)
assert.equal(toolApprovalPolicyLine(null), 'policy não configurada')

const blockedGate: AtlasToolsGateResponse = {
  status: 'blocked',
  allowed: false,
  filters: { workspace: '/repo' },
  required_tools: ['semgrep'],
  fail_statuses: ['failed', 'timeout'],
  summary: {
    run_count: 2,
    tool_count: 1,
    failed_run_count: 1,
    blocking_failure_count: 1,
    warning_count: 1,
  },
  blocking_failures: [{
    tool_slug: 'semgrep',
    rule_id: 'blocking_finding',
    title: 'Critical issue',
  }],
  warnings: [{
    rule_id: 'stale_evidence',
    message: 'Evidence is old',
  }],
  runs: [],
}

assert.equal(
  toolRuntimeGateLine(blockedGate),
  'bloqueado · 2 evidências · 1 bloqueio · 1 aviso · 1 ferramenta exigida',
)
assert.equal(
  toolRuntimeGateIssueLine(blockedGate.blocking_failures[0]),
  'semgrep · blocking_finding · Critical issue',
)
assert.equal(
  toolRuntimeGateIssueLine(blockedGate.warnings[0]),
  'stale_evidence · Evidence is old',
)
assert.equal(toolRuntimeGateLine(null), 'gate ainda não avaliado')
assert.deepEqual(buildToolRuntimeGateFilters({ workspace: ' /repo ', mode: 'observe', limit: 12 }), {
  workspace: '/repo',
  limit: 12,
  require_evidence: false,
})
assert.deepEqual(buildToolRuntimeGateFilters({ workspace: '', mode: 'release' }), {
  workspace: null,
  limit: 8,
  require_evidence: true,
})
assert.equal(toolRuntimeGateModeLine('observe'), 'observação · ausência de evidência vira aviso')
assert.equal(toolRuntimeGateModeLine('release'), 'release · exige evidência para liberar')

const authorityGroup: AtlasToolAuthorityGroup = {
  authority_group: 'semantic_sast',
  tool_count: 2,
  tier_span: ['T2'],
  primary_tools: [{
    slug: 'codeql',
    name: 'CodeQL',
    execution_tier: 'T2',
    expected_cost: 'review_medium',
    default_trigger: 'pr_review_or_release',
    authority_role: 'primary',
    risk_level: 'high',
    status: 'active',
  }],
  complementary_tools: [{
    slug: 'semgrep',
    name: 'Semgrep',
    execution_tier: 'T2',
    expected_cost: 'review_medium',
    default_trigger: 'pr_review_or_release',
    authority_role: 'complementary',
    risk_level: 'medium',
    status: 'active',
  }],
  fallback_tools: [],
  executor_tools: [],
  high_risk_tools: [],
  release_heavy_tools: [],
  missing_primary: false,
  duplicate_primary: false,
}

const authorityResponse: AtlasToolsAuthorityResponse = {
  status: 'ok',
  generated_at: '2026-05-03T10:00:00Z',
  summary: {
    tool_count: 61,
    authority_group_count: 35,
    primary_count: 39,
    complementary_count: 19,
    fallback_count: 3,
    executor_count: 3,
    high_risk_count: 12,
    t0_count: 7,
    t1_count: 17,
    t2_count: 28,
    t3_count: 9,
  },
  tiers: {},
  authority_groups: [
    authorityGroup,
    {
      ...authorityGroup,
      authority_group: 'external_coding_agent',
      primary_tools: [],
      complementary_tools: [],
      executor_tools: authorityGroup.primary_tools,
      missing_primary: false,
      duplicate_primary: false,
    },
    {
      ...authorityGroup,
      authority_group: 'symbol_index',
      primary_tools: [],
      complementary_tools: [],
      fallback_tools: authorityGroup.primary_tools,
      missing_primary: true,
    },
    {
      ...authorityGroup,
      authority_group: 'ts_js_type_lint',
      primary_tools: [authorityGroup.primary_tools[0], authorityGroup.complementary_tools[0]],
      complementary_tools: [authorityGroup.complementary_tools[0]],
      duplicate_primary: true,
    },
  ],
  recommendations: [
    {
      code: 'external_agents_require_policy_boundary',
      severity: 'high',
      authority_group: 'external_coding_agent',
      message: 'External coding agents must remain executors behind Atlas.',
    },
    {
      code: 'authority_group_missing_primary',
      severity: 'medium',
      authority_group: 'symbol_index',
      message: 'Define one primary tool.',
    },
  ],
}

assert.deepEqual(buildEngineeringToolAuthoritySummary(authorityResponse), {
  toolCount: 61,
  authorityGroupCount: 35,
  tierLine: 'T0 7 · T1 17 · T2 28 · T3 9',
  recommendationCount: 2,
  highRecommendationCount: 1,
  duplicatePrimaryCount: 1,
  missingPrimaryCount: 1,
})
assert.equal(
  toolAuthorityGroupLine(authorityGroup),
  'codeql · 1 complementares · T2',
)
