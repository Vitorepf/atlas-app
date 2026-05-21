import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildInteractionPayload,
} from '../lib/atlasAi/contract'
import {
  isAutoAutoCleanPayload,
} from '../lib/atlasAi/hyperflowRuntime'

const root = process.cwd()

function file(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assertContains(source: string, needle: string, label: string): void {
  assert.ok(source.includes(needle), `${label}: missing ${needle}`)
}

function assertNotContains(source: string, needle: string, label: string): void {
  assert.ok(!source.includes(needle), `${label}: forbidden ${needle}`)
}

const sheet = file('components/sheets/AtlasAiSheet.tsx')
const routing = file('components/console/StatusRouting.tsx')
const decide = file('components/sheets/AtlasDecideSheet.tsx')
const contextSheet = file('components/sheets/atlas-ai/AtlasAiContextSheet.tsx')
const apiClient = file('lib/api/client.ts')

// Real send path: AtlasAiSheet must build the outbound payload through the
// V2 Hyperflow contract, not through the old V1 routing adapter.
assertContains(sheet, "import { buildInteractionPayload } from '../../lib/atlasAi/contract'", 'AtlasAiSheet')
assertContains(sheet, 'const hyperflowBuild = buildInteractionPayload({', 'AtlasAiSheet')
assertContains(sheet, 'computeEffort,', 'AtlasAiSheet compute effort contract')
assertContains(sheet, "...runtimePolicy,", 'AtlasAiSheet payload')
assertContains(sheet, 'operator_compute_effort: computeEffort', 'AtlasAiSheet payload effort operator hint')
assertContains(sheet, 'policy_hints: Object.keys(policyHints).length > 0 ? policyHints : undefined', 'AtlasAiSheet payload effort policy hints')
assertContains(sheet, "app_surface: 'atlas_mobile_ai'", 'AtlasAiSheet payload')
assertContains(sheet, "surface_id: 'atlas_mobile_ai'", 'AtlasAiSheet domain selection')
assertContains(sheet, 'conversationContext,', 'AtlasAiSheet context')
assertNotContains(sheet, 'atlasModePayloadForRouting(', 'AtlasAiSheet legacy submit path')

// Default state must be auto/auto so the surface does not force programming,
// general, Dev, or any other local decision before Hyperflow runs.
assertContains(routing, "mode: 'auto'", 'ROUTING_DEFAULT')
assertContains(routing, "task: 'auto'", 'ROUTING_DEFAULT')

// The visible routing sheet must expose every canonical Hyperflow mode.
for (const mode of [
  'auto',
  'general',
  'conversation',
  'operational',
  'programming',
  'research',
  'finance',
  'marketing',
  'strategy',
  'personal_development',
  'cyber',
  'automation',
]) {
  assertContains(decide, `key: '${mode}'`, `AtlasDecideSheet mode ${mode}`)
}
assertContains(decide, "key: 'auto',   label: 'Auto'", 'AtlasDecideSheet auto task')

// Runtime consumption: the context/debug panel must render the backend
// Hyperflow decision, not infer a client-side flow.
assertContains(contextSheet, 'useHyperflowRuntime(latestTrace)', 'ContextSheet Hyperflow consumer')

// Rich input is part of the same advanced route: attachments go through chunked
// upload and emit a canonical source_manifest-rich payload.
assertContains(apiClient, '/ai/uploads/chunks/start', 'chunked upload start')
assertContains(apiClient, '/chunk', 'chunked upload chunk')
assertContains(apiClient, '/complete', 'chunked upload complete')
assertContains(apiClient, 'rich_input_payload', 'rich input payload')
assertContains(apiClient, 'buildRichInputPayload({', 'source manifest builder')
assertContains(apiClient, 'richInputPayload.source_manifest', 'source manifest payload')

// Contract behavior: auto/auto remains clean and delegates routing to backend.
const auto = buildInteractionPayload({
  mode: 'auto',
  task: 'auto',
  provider: 'auto',
  workspaceSlug: 'atlas',
})
assert.equal(auto.payload.surface_id, 'atlas_mobile_ai')
assert.equal(auto.payload.app_surface, 'atlas_mobile_ai')
assert.equal(auto.payload.flow_id, 'auto')
assert.equal(auto.payload.routing_domain, 'auto')
assert.equal(auto.payload.routing_task, 'auto')
assert.equal(isAutoAutoCleanPayload(auto.payload), true)
assert.equal(auto.payload.operator_compute_effort, 'auto')
assert.equal('compute_effort' in auto.payload, false)

// Explicit programming remains allowed, but only when the operator asks for it.
const programming = buildInteractionPayload({
  mode: 'programming',
  task: 'dev',
  provider: 'auto',
  computeEffort: 'max',
  workspaceSlug: 'atlas',
})
assert.equal(programming.payload.flow_id, 'programming.dev')
assert.equal(programming.payload.capability_profile, 'atlas_programming')
assert.equal(programming.payload.operator_compute_effort, 'max')
assert.equal(programming.payload.compute_effort, 'max')
assert.ok('mobile_runtime_policy' in programming.payload)

console.info('✓ atlas ai mobile hyperflow screen integration tests passaram')
