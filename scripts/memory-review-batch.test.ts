import assert from 'node:assert/strict'
import {
  buildMemoryReviewBatchPlan,
  selectableReviewItemIds,
} from '../lib/memoryReviewBatch'
import type { AtlasMemoryReviewQueueItem } from '../lib/api/client'

function item(input: Partial<AtlasMemoryReviewQueueItem> & { id: string; kind: string }): AtlasMemoryReviewQueueItem {
  return {
    review_type: input.review_type ?? 'privacy',
    priority: input.priority ?? 50,
    severity: input.severity ?? 'medium',
    reason: input.reason ?? null,
    action_hint: input.action_hint ?? null,
    ...input,
    id: input.id,
    kind: input.kind,
  }
}

const items = [
  item({ id: 'registry-1', kind: 'memory_privacy', memory_entry_id: 'memory-1' }),
  item({ id: 'verbatim-1', kind: 'verbatim_privacy', verbatim_memory_id: 'verbatim-1' }),
  item({ id: 'relation-1', kind: 'relation', relation_id: 'relation-1' }),
  item({ id: 'broken', kind: 'memory_privacy' }),
  item({ id: 'unknown', kind: 'custom' }),
]

{
  assert.deepEqual(selectableReviewItemIds(items), ['registry-1', 'verbatim-1', 'relation-1'])
}

{
  const plan = buildMemoryReviewBatchPlan(items, ['registry-1', 'verbatim-1', 'relation-1', 'missing'])
  assert.equal(plan.selected_count, 3)
  assert.equal(plan.privacy_count, 2)
  assert.equal(plan.relation_count, 1)
  assert.equal(plan.unsupported_count, 0)
  assert.equal(plan.can_block_privacy, true)
  assert.equal(plan.can_dismiss_relations, true)
}

{
  const plan = buildMemoryReviewBatchPlan(items, ['broken', 'unknown'])
  assert.equal(plan.selected_count, 2)
  assert.equal(plan.privacy_count, 0)
  assert.equal(plan.relation_count, 0)
  assert.equal(plan.unsupported_count, 2)
  assert.equal(plan.can_block_privacy, false)
  assert.equal(plan.can_dismiss_relations, false)
}

console.log('memory review batch tests passed')
