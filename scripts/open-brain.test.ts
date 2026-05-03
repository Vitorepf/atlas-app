import assert from 'node:assert/strict'
import {
  openBrainAuditLine,
  openBrainContextPackCopyText,
  openBrainContextPackSummary,
  openBrainMaintenanceLine,
  openBrainRecallSummary,
} from '../lib/openBrain'

assert.equal(openBrainRecallSummary(null), 'recall ainda não executado')
assert.equal(openBrainRecallSummary({
  query: 'memoria',
  context: {},
  summary: {
    recall_count: 2,
    budget_chars: 420,
    policy: 'provider_safe_only',
  },
  recall: [],
  sources: {},
}), '2 memórias · provider_safe_only · 420 chars')

assert.equal(openBrainContextPackSummary({
  ok: true,
  schema_version: 1,
  context_pack_hash: 'abcdef1234567890',
  context_pack: { task: { objective: 'x' } },
  context_refs: [],
  summary: {
    context_refs_count: 4,
    memory_refs_count: 2,
    recall_count: 3,
  },
}), '4 refs · 2 memórias · 3 recall · abcdef1234')

assert.equal(openBrainContextPackCopyText({
  ok: true,
  schema_version: 1,
  context_pack_hash: 'hash',
  context_pack: { task: { objective: 'x' } },
  context_refs: [],
  summary: {},
  prompt_section: 'prompt pronto',
}), 'prompt pronto')

assert.equal(openBrainAuditLine({
  id: '1',
  surface: 'api',
  requester: 'app',
  action: 'context_pack_export',
  status: 'completed',
  workspace_hash: null,
  workspace_label: 'atlas-server',
  context_pack_hash: 'hash',
  context_refs_count: 4,
  memory_refs_count: 2,
  provider_safe: true,
  query: {},
  result_summary: {},
  accessed_at: null,
}), 'api · app · completed · provider-safe')

assert.equal(openBrainMaintenanceLine({
  ok: true,
  status: 'ready',
  workspace: '/tmp/atlas',
  dry_run: false,
  prune: true,
  writes: {},
  stages: {
    knowledge_sync: { ok: true },
    code_index: { ok: true },
    provider_projection_status: { status: 'passed' },
    mcp_health: { overall_status: 'ready' },
  },
  generated_at: '2026-05-03T00:00:00.000Z',
}), 'ready · docs ok · code ok · projection passed')

console.log('open brain tests passed')
