/**
 * OB-05 Residual Elite — Mobile open_brain injection proof (source-level).
 * Avoids importing RN-heavy AtlasAiRoutingModel; asserts wiring + provider-safe shape in source.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sheet = readFileSync(join(root, 'components/sheets/AtlasAiSheet.tsx'), 'utf8')
const routing = readFileSync(join(root, 'components/sheets/atlas-ai/AtlasAiRoutingModel.ts'), 'utf8')

assert.ok(
  sheet.includes("import { buildInteractionPayload } from '../../lib/atlasAi/contract'"),
  'AtlasAiSheet imports buildInteractionPayload',
)
assert.ok(
  sheet.includes('openBrainPayloadForRouting'),
  'AtlasAiSheet references openBrainPayloadForRouting',
)
assert.ok(
  sheet.includes('open_brain: openBrainPayloadForRouting(routingSnapshot)'),
  'AtlasAiSheet wires open_brain into createAiInteraction payload',
)

assert.ok(
  routing.includes('export function openBrainPayloadForRouting'),
  'openBrainPayloadForRouting is exported',
)
assert.ok(
  /mode === 'programming'[\s\S]*task === 'dev'[\s\S]*task === 'debug'[\s\S]*task === 'review'/.test(routing)
  || /routing\.mode === 'programming' \|\| routing\.task === 'dev' \|\| routing\.task === 'debug' \|\| routing\.task === 'review'/.test(routing),
  'injection gate matches programming/dev/debug/review',
)
assert.ok(routing.includes("mode: 'auto'"), 'open_brain.mode=auto')
assert.ok(routing.includes("surface: 'app_ai'"), 'open_brain.surface=app_ai (server allowlist)')
assert.ok(routing.includes('provider_safe_only: true'), 'provider_safe_only hard-coded true')
assert.ok(routing.includes('raw_text_exposed: false'), 'policy.raw_text_exposed=false')
assert.ok(routing.includes('raw_logs_allowed: false'), 'policy.raw_logs_allowed=false')
assert.ok(routing.includes('providers_invoked: false'), 'policy.providers_invoked=false')

// No raw sensitive fields in the open_brain return block
const fnMatch = routing.match(
  /export function openBrainPayloadForRouting[\s\S]*?^}/m,
)
assert.ok(fnMatch, 'could locate openBrainPayloadForRouting body')
const body = fnMatch[0]
for (const forbidden of [
  'prompt_section',
  'memory_text',
  'context_pack',
  'api_key',
  'password',
  'conversation_context',
  'context_delivery_policy',
]) {
  assert.equal(body.includes(forbidden), false, `openBrainPayloadForRouting must not include ${forbidden}`)
}

console.log('OB-05 mobile open_brain injection proof: ok')
