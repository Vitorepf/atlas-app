import assert from 'node:assert/strict'
import {
  engineeringCodeAuditDriftLine,
  engineeringCodeAuditStatusLabel,
  engineeringCodeModuleCoverageLine,
  engineeringCodeModuleMetaLine,
  engineeringCodeSymbolMetaLine,
  engineeringCodeValuesLine,
  engineeringKnowledgeBodyPreview,
  engineeringKnowledgeMetaLine,
  engineeringKnowledgeValuesLine,
} from '../lib/engineeringKnowledge'

assert.equal(
  engineeringKnowledgeMetaLine({
    category: 'capability_matrix',
    priority: 90,
    canonical_path: 'docs/engineering-knowledge-base/capability-matrix.md',
  }),
  'capability_matrix · p90 · docs/engineering-knowledge-base/capability-matrix.md',
)

assert.equal(
  engineeringKnowledgeValuesLine(['context_pack', 'context_pack', ' harness_runner ', 'atlas_bench']),
  'context_pack · harness_runner · atlas_bench',
)

assert.equal(
  engineeringKnowledgeValuesLine(['architecture', 'maintenance', 'quality', 'visual']),
  'architecture · maintenance · quality +1',
)

assert.equal(engineeringKnowledgeValuesLine([], 'sem itens'), 'sem itens')
assert.equal(engineeringKnowledgeBodyPreview(null), 'Sem excerpt detalhado.')
assert.equal(engineeringKnowledgeBodyPreview('linha 1\n\nlinha 2'), 'linha 1 linha 2')
assert.equal(engineeringKnowledgeBodyPreview('a'.repeat(60), 12), 'aaaaaaaaa...')

assert.equal(
  engineeringCodeModuleMetaLine({
    layer: 'service',
    root_path: 'app/Services/Engineering',
    file_count: 18,
    symbol_count: 240,
  }),
  'service · app/Services/Engineering · 18 files · 240 símbolos',
)

assert.equal(
  engineeringCodeModuleCoverageLine({
    docs_status: 'documented',
    route_count: 3,
    command_count: 5,
    test_count: 7,
  }),
  'docs documented · rotas 3 · comandos 5 · testes 7',
)

assert.equal(
  engineeringCodeSymbolMetaLine({
    symbol_type: 'cli_command',
    module_slug: 'engineering_harness_cli',
    file_path: 'app/Console/Commands/AtlasEngineeringKnowledgeCommand.php',
    line_start: 13,
  }),
  'cli_command · engineering_harness_cli · app/Console/Commands/AtlasEngineeringKnowledgeCommand.php:13',
)

assert.equal(engineeringCodeValuesLine(['routes/api.php', 'routes/api.php', 'tests/Feature/FooTest.php']), 'routes/api.php · tests/Feature/FooTest.php')

assert.equal(engineeringCodeAuditStatusLabel(null), 'não auditado')
assert.equal(engineeringCodeAuditStatusLabel({
  ok: true,
  dry_run: true,
  writes: false,
  status: 'fresh',
  workspace: '/repo',
  summary: {
    scanned: { module_count: 2, symbol_count: 10 },
    persisted: {
      status: 'ready',
      table_exists: true,
      module_count: 2,
      symbol_count: 10,
      doc_link_count: 4,
    },
    drift: {
      total: 0,
      modules: { missing_in_index: 0, removed_from_workspace: 0, changed: 0 },
      symbols: { added: 0, removed: 0 },
      doc_links: { current: 4, persisted_missing_target_status: 0, missing_targets: 0, stale_target_hashes: 0 },
    },
  },
  drift: {
    modules: { counts: { missing_in_index: 0, removed_from_workspace: 0, changed: 0 }, missing_in_index: [], removed_from_workspace: [], changed: [] },
    symbols: { counts: { added: 0, removed: 0 }, by_type: { added: {}, removed: {} }, added: [], removed: [] },
    doc_links: { counts: { current: 4, persisted_missing_target_status: 0, missing_targets: 0, stale_target_hashes: 0 }, missing_targets: [], stale_target_hashes: [] },
  },
  generated_at: '2026-05-02T00:00:00.000Z',
}), 'fresh')

assert.equal(engineeringCodeAuditDriftLine({
  ok: true,
  dry_run: true,
  writes: false,
  status: 'drift_detected',
  workspace: '/repo',
  summary: {
    scanned: { module_count: 3, symbol_count: 12 },
    persisted: {
      status: 'ready',
      table_exists: true,
      module_count: 2,
      symbol_count: 10,
      doc_link_count: 4,
    },
    drift: {
      total: 4,
      modules: { missing_in_index: 1, removed_from_workspace: 0, changed: 1 },
      symbols: { added: 2, removed: 0 },
      doc_links: { current: 3, persisted_missing_target_status: 0, missing_targets: 0, stale_target_hashes: 0 },
    },
  },
  drift: {
    modules: { counts: { missing_in_index: 1, removed_from_workspace: 0, changed: 1 }, missing_in_index: [], removed_from_workspace: [], changed: [] },
    symbols: { counts: { added: 2, removed: 0 }, by_type: { added: { method: 2 }, removed: {} }, added: [], removed: [] },
    doc_links: { counts: { current: 3, persisted_missing_target_status: 0, missing_targets: 0, stale_target_hashes: 0 }, missing_targets: [], stale_target_hashes: [] },
  },
  generated_at: '2026-05-02T00:00:00.000Z',
}), 'drift 4 · módulos 2 · símbolos 2 · doc links 0 · dry-run sem escrita')

console.log('engineering knowledge helpers ok')
