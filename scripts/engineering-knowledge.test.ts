import assert from 'node:assert/strict'
import {
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

console.log('engineering knowledge helpers ok')
