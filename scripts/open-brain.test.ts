import assert from 'node:assert/strict'
import {
  openBrainAuditLine,
  openBrainContextPackCopyText,
  openBrainContextPackSummary,
  openBrainMaintenanceLine,
  openBrainMemoryQualityLine,
  openBrainQualityHistoryLine,
  openBrainTrendDriverLine,
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

assert.equal(openBrainMemoryQualityLine({
  ok: true,
  status: 'ready',
  score: 97,
  counts: {
    active: 5,
    provider_safe_active: 5,
  },
  trend: {
    status: 'stable',
    current_delta_from_latest: 0,
  },
}), 'ready · score 97 · trend stable (0) · 5/5 provider-safe')

assert.equal(openBrainQualityHistoryLine({
  ok: true,
  status: 'ready',
  period_days: 30,
  since_at: '2026-05-01T00:00:00.000Z',
  summary: {
    total: 3,
    latest_score: 97,
    score_delta: -4,
    trend_status: 'watch_regressed',
  },
  snapshots: [],
}), '3 snapshots · latest 97 · delta -4 · watch_regressed')

assert.equal(openBrainTrendDriverLine({
  kind: 'component_drop',
  key: 'provider_safety',
  delta: -20,
  current: 80,
  previous: 100,
}), 'provider_safety -20 · 100 → 80')

console.log('open brain tests passed')
