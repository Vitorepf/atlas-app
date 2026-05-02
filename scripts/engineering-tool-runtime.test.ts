import assert from 'node:assert/strict'
import {
  buildEngineeringToolRuntimeSummary,
  toolRuntimeEvidenceLine,
  toolRuntimeRiskLine,
} from '../lib/engineeringToolRuntime'
import type {
  AtlasToolArtifactSummary,
  AtlasToolDoctorItem,
  AtlasToolFindingSummary,
  AtlasToolRunSummary,
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
  policy_decision_json: {},
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
  'engineering_quality_scan · allowed · 1000ms · 1 artefatos · 1 findings',
)

assert.equal(
  toolRuntimeEvidenceLine({
    ...failedRun,
    run_context_type: 'engineering_run',
    run_context_id: 'run-123',
  }),
  'engineering_quality_scan · allowed · engineering_run:run-123 · 1000ms · 1 artefatos · 1 findings',
)
