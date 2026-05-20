import assert from 'node:assert/strict'
import {
  appendRoutingHistory,
  atlasAiFocusForRouting,
  atlasAiModeFromThread,
  normalizeAtlasAiMode,
  threadRoutingMetadataPatch,
  type AtlasAiThreadRoutingState,
} from '../lib/atlasAiThreadRouting'
import { normalizeAtlasAiFocus } from '../lib/atlasAiFocus'

const generalRouting: AtlasAiThreadRoutingState = {
  mode: 'general',
  task: 'direct',
  domain: 'auto',
  executor: 'auto',
  style: 'clear',
}

const operationalRouting: AtlasAiThreadRoutingState = {
  mode: 'operational',
  task: 'review',
  domain: 'atlas',
  executor: 'auto',
  style: 'complete',
}

const programmingRouting: AtlasAiThreadRoutingState = {
  mode: 'programming',
  task: 'dev',
  domain: 'atlas',
  executor: 'codex_cli',
  style: 'technical',
}

{
  assert.equal(normalizeAtlasAiMode('programacao'), 'programming')
  assert.equal(normalizeAtlasAiMode('programação'), 'programming')
  assert.equal(normalizeAtlasAiMode('operations'), 'operational')
  assert.equal(normalizeAtlasAiMode('operacional'), 'operational')
  assert.equal(normalizeAtlasAiMode('conversation'), 'conversation')
  assert.equal(normalizeAtlasAiMode('research'), 'research')
  assert.equal(normalizeAtlasAiMode('finanças'), 'finance')
  assert.equal(normalizeAtlasAiMode('unknown', 'operational'), 'operational')
  assert.equal(normalizeAtlasAiFocus('programação'), 'programming')
  assert.equal(normalizeAtlasAiFocus('revisão'), 'review')
}

{
  assert.equal(atlasAiFocusForRouting(generalRouting), 'general')
  assert.equal(atlasAiFocusForRouting({ ...generalRouting, task: 'plan' }), 'project')
  assert.equal(atlasAiFocusForRouting({ ...generalRouting, domain: 'vault-curador' }), 'research')
  assert.equal(atlasAiFocusForRouting(operationalRouting), 'operational')
  assert.equal(atlasAiFocusForRouting(programmingRouting), 'programming')
  assert.equal(atlasAiFocusForRouting({ ...generalRouting, mode: 'research' }), 'research')
}

{
  assert.equal(atlasAiModeFromThread({ metadata: { current_mode: 'programming' } }), 'programming')
  assert.equal(atlasAiModeFromThread({ metadata: { current_mode: 'finance' } }), 'finance')
  assert.equal(atlasAiModeFromThread({ source_type: 'inbox_item', metadata: {} }), 'operational')
  assert.equal(atlasAiModeFromThread({ metadata: { atlas_focus: 'general' } }), 'general')
}

{
  const now = '2026-05-03T12:00:00.000Z'
  const patch = threadRoutingMetadataPatch(
    {
      id: 'thread-1',
      source_type: 'inbox_item',
      source_id: 'inbox-1',
      metadata: {
        atlas_mode: 'operational',
        atlas_focus: 'operational',
        mode_history: [{ value: 'operational', changed_at: '2026-05-02T12:00:00.000Z' }],
      },
    },
    programmingRouting,
    { now },
  )

  assert.equal(patch.initial_mode, 'operational')
  assert.equal(patch.current_mode, 'programming')
  assert.equal(patch.atlas_focus, 'programming')
  assert.equal(patch.routing_task, 'dev')
  assert.equal(patch.requested_provider, 'codex_cli')
  assert.equal(patch.routing_updated_at, now)
  assert.deepEqual((patch.mode_history as Array<Record<string, unknown>>).map((item) => item.value), ['operational', 'programming'])
}

{
  const history = appendRoutingHistory(
    [{ value: 'programming', changed_at: '2026-05-03T12:00:00.000Z' }],
    'programming',
    '2026-05-03T12:10:00.000Z',
    programmingRouting,
  )
  assert.equal(history.length, 1)
}

console.info('atlas ai thread routing tests passed')
