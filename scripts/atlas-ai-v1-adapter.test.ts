/**
 * Slice 3a · paridade V1 ↔ V2 adapter.
 *
 * Garante que `buildModePolicyFromRoutingState` (V2-internal) produz o
 * MESMO output que `atlasModePayloadForRoutingContract` (V1 legacy)
 * produzia, byte-a-byte, para os 3 modos × tarefas relevantes.
 *
 * Quando este teste falhar, é sinal de que algo no contrato V2 mudou de
 * forma que afeta o output V1-compat. Decidir antes de prosseguir:
 *   - Atualizar o adapter pra continuar idêntico ao V1 (compat strict)
 *   - Aceitar o diff e atualizar consumers
 */
import assert from 'node:assert/strict'
import { buildModePolicyFromRoutingState, type V1RoutingStateLike } from '../lib/atlasAi/v1Adapter'
import { atlasModePayloadForRoutingContract } from '../lib/atlasAiModeContract'

const FIXTURES: Array<{ name: string; routing: V1RoutingStateLike; workspace: string | null }> = [
  {
    name: 'general · direct · auto domain · auto executor',
    routing: { mode: 'general', task: 'direct', domain: 'auto', executor: 'auto', style: 'clear' },
    workspace: null,
  },
  {
    name: 'general · plan · saude domain · claude executor',
    routing: { mode: 'general', task: 'plan', domain: 'saude', executor: 'claude_cli', style: 'technical' },
    workspace: null,
  },
  {
    name: 'operational · review · atlas domain · auto executor',
    routing: { mode: 'operational', task: 'review', domain: 'atlas', executor: 'auto', style: 'complete' },
    workspace: null,
  },
  {
    name: 'operational · plan · blackink',
    routing: { mode: 'operational', task: 'plan', domain: 'blackink', executor: 'gemini_cli', style: 'brief' },
    workspace: null,
  },
  {
    name: 'programming · dev · atlas workspace',
    routing: { mode: 'programming', task: 'dev', domain: 'atlas', executor: 'codex_cli', style: 'technical' },
    workspace: '/Users/op/atlas',
  },
  {
    name: 'programming · debug · workspace presente',
    routing: { mode: 'programming', task: 'debug', domain: 'atlas', executor: 'claude_cli', style: 'technical' },
    workspace: '/Users/op/atlas-app',
  },
  {
    name: 'programming · plan · sem workspace',
    routing: { mode: 'programming', task: 'plan', domain: 'auto', executor: 'auto', style: 'clear' },
    workspace: null,
  },
  {
    name: 'programming · review · workspace',
    routing: { mode: 'programming', task: 'review', domain: 'atlas', executor: 'auto', style: 'technical' },
    workspace: '/Users/op/atlas',
  },
]

let mismatches = 0
for (const fixture of FIXTURES) {
  const v1 = atlasModePayloadForRoutingContract(fixture.routing, fixture.routing.mode, { workspace: fixture.workspace })
  const v2 = buildModePolicyFromRoutingState(fixture.routing, fixture.workspace)

  try {
    assert.deepStrictEqual(v2, v1, `Diff em "${fixture.name}"`)
  } catch (err) {
    mismatches++
    console.error(`✗ "${fixture.name}" FAIL`)
    console.error('  V1 (esperado):', JSON.stringify(v1, null, 2))
    console.error('  V2 (recebido):', JSON.stringify(v2, null, 2))
    throw err
  }
}

console.log(`✓ V1↔V2 adapter paridade: ${FIXTURES.length} fixtures OK (zero diff)`)

// ─── Asserts comportamentais adicionais ──────────────────────────────

const general = buildModePolicyFromRoutingState(
  { mode: 'general', task: 'direct', domain: 'auto', executor: 'auto', style: 'clear' },
  null,
)
assert.equal(general.atlas_mode, 'general')
assert.ok(!('capability_profile' in general), 'general não carrega capability_profile')
assert.ok(!('programming_harness' in general), 'general não carrega programming_harness')
assert.ok(!('mobile_runtime_policy' in general), 'general não carrega mobile_runtime_policy')

const programming = buildModePolicyFromRoutingState(
  { mode: 'programming', task: 'dev', domain: 'atlas', executor: 'codex_cli', style: 'technical' },
  '/Users/op/atlas',
)
assert.equal(programming.atlas_mode, 'programming')
assert.equal(programming.capability_profile, 'atlas_programming')
assert.equal(programming.permission_policy, 'full_access')
assert.equal(programming.permission_mode, 'danger')

const toolPerms = programming.tool_permissions as Record<string, unknown>
assert.equal(toolPerms.source, 'atlas_ai_programming_mode', 'V1 source preservado no adapter')
assert.equal(toolPerms.workspace, '/Users/op/atlas')
assert.equal(toolPerms.confirmed, true)
assert.equal(toolPerms.allow_unsandboxed_provider, true)

const harness = programming.programming_harness as Record<string, unknown>
assert.equal(harness.schema_version, 1, 'V1 schema_version preservado')
assert.equal(harness.workspace_required, true)

const mobilePolicy = programming.mobile_runtime_policy as Record<string, unknown>
assert.equal(mobilePolicy.allows_code_execution, true)

// Anti-regressão: keys extras V2 NÃO devem aparecer no output V1-compat
const v2OnlyKeys = ['app_surface', 'surface_id', 'atlas_focus', 'atlas_workflow_mode', 'routing_task', 'routing_domain', 'decision_mode', 'flow_id', 'domain_id', 'workspace', 'conversation_context', 'requested_provider', 'operator_requested_provider']
for (const k of v2OnlyKeys) {
  assert.ok(!(k in general), `V1 adapter NÃO deve expor '${k}'`)
  assert.ok(!(k in programming), `V1 adapter NÃO deve expor '${k}'`)
}

console.log(`✓ comportamento V1 preservado · ${mismatches === 0 ? 'zero mismatches' : `${mismatches} mismatches`}`)
