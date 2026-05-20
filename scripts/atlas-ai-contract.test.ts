import assert from 'node:assert/strict'
import {
  ATLAS_AI_APP_SURFACE,
  ATLAS_AI_MODE_CONTRACT_VERSION,
  ATLAS_AI_SURFACE_ID,
  MODE_OPTIONS,
  PROVIDER_OPTIONS,
  TASK_OPTIONS_AUTO,
  TASK_OPTIONS_PROGRAMMING,
  buildInteractionPayload,
  defaultTaskForMode,
  domainIdForFlow,
  flowIdForMode,
  isTaskAllowedForMode,
  taskOptionsForMode,
} from '../lib/atlasAi/contract'
import type { AtlasAiMode, AtlasAiTask } from '../lib/atlasAi/types'

// ─── Surface identity ────────────────────────────────────────────────

assert.equal(ATLAS_AI_SURFACE_ID, 'atlas_mobile_ai', 'surface_id deve ser atlas_mobile_ai')
assert.equal(ATLAS_AI_APP_SURFACE, 'atlas_mobile_ai', 'app_surface deve ser atlas_mobile_ai')
assert.equal(ATLAS_AI_MODE_CONTRACT_VERSION, 2, 'schema version deve ser 2 (canon atual)')

// ─── 12 modos canon ──────────────────────────────────────────────────

const ALL_MODES: readonly AtlasAiMode[] = [
  'auto', 'general', 'conversation', 'operational', 'programming', 'research',
  'finance', 'marketing', 'strategy', 'personal_development', 'cyber', 'automation',
]
assert.equal(MODE_OPTIONS.length, 12, 'MODE_OPTIONS deve ter 12 entradas')
for (const mode of ALL_MODES) {
  assert.ok(
    MODE_OPTIONS.some((opt) => opt.value === mode),
    `MODE_OPTIONS deve incluir '${mode}'`,
  )
}
assert.equal(MODE_OPTIONS[0].value, 'auto', 'auto deve ser o primeiro mode')

// ─── 5 providers canon ───────────────────────────────────────────────

assert.equal(PROVIDER_OPTIONS.length, 5)
assert.equal(PROVIDER_OPTIONS[0].value, 'auto')
const providerValues = PROVIDER_OPTIONS.map((p) => p.value)
assert.deepEqual(providerValues, ['auto', 'claude_cli', 'codex_cli', 'gemini_cli', 'claude_codex'])

// ─── Defaults canon ──────────────────────────────────────────────────

assert.equal(defaultTaskForMode('auto'), 'auto', 'default task de auto é auto')
assert.equal(defaultTaskForMode('programming'), 'dev')
assert.equal(defaultTaskForMode('operational'), 'review')
assert.equal(defaultTaskForMode('general'), 'direct')
assert.equal(defaultTaskForMode('research'), 'direct')

// ─── Task allowed por mode ───────────────────────────────────────────

assert.ok(isTaskAllowedForMode('auto', 'auto'))
assert.ok(isTaskAllowedForMode('plan', 'auto'))
assert.ok(!isTaskAllowedForMode('dev', 'auto'), 'dev não deve ser allowed em auto')
assert.ok(isTaskAllowedForMode('dev', 'programming'))
assert.ok(isTaskAllowedForMode('debug', 'programming'))
assert.ok(!isTaskAllowedForMode('debug', 'research'), 'debug só em programming')

// ─── flowIdForMode ───────────────────────────────────────────────────

assert.equal(flowIdForMode('auto', 'auto'), 'auto', 'auto/auto vira flow_id=auto canon')
assert.equal(flowIdForMode('programming', 'dev'), 'programming.dev')
assert.equal(flowIdForMode('programming', 'debug'), 'programming.repair')
assert.equal(flowIdForMode('research', 'direct'), 'research.investigate')
assert.equal(flowIdForMode('finance', 'plan'), 'finance.analyze')

// ─── domainIdForFlow ─────────────────────────────────────────────────

assert.equal(domainIdForFlow('auto'), 'auto')
assert.equal(domainIdForFlow('programming.dev'), 'programming')
assert.equal(domainIdForFlow('research.investigate'), 'research')

// ─── taskOptionsForMode ──────────────────────────────────────────────

assert.equal(taskOptionsForMode('auto'), TASK_OPTIONS_AUTO)
assert.equal(taskOptionsForMode('programming'), TASK_OPTIONS_PROGRAMMING)

// ─── INVARIANTE CRÍTICO · auto/auto NÃO carrega programming_harness ───

const autoResult = buildInteractionPayload({
  mode: 'auto',
  task: 'auto',
  provider: 'auto',
  workspaceSlug: null,
})
assert.equal(autoResult.payload.atlas_mode, 'auto')
assert.equal(autoResult.payload.routing_task, 'auto')
assert.equal(autoResult.payload.routing_domain, 'auto')
assert.equal(autoResult.payload.flow_id, 'auto')
assert.equal(autoResult.payload.domain_id, 'auto')
assert.equal(autoResult.payload.decision_mode, 'atlas_decide')
assert.ok(
  !('capability_profile' in autoResult.payload),
  'auto/auto NUNCA carrega capability_profile',
)
assert.ok(
  !('programming_harness' in autoResult.payload),
  'auto/auto NUNCA carrega programming_harness',
)
assert.ok(
  !('permission_policy' in autoResult.payload),
  'auto/auto NUNCA carrega permission_policy',
)
assert.ok(
  !('requested_provider' in autoResult.payload),
  'provider=auto NUNCA carrega requested_provider',
)
assert.equal(autoResult.provider, undefined)

// ─── auto/auto com workspace presente ainda fica limpo ───────────────

const autoWithWorkspace = buildInteractionPayload({
  mode: 'auto',
  task: 'auto',
  provider: 'auto',
  workspaceSlug: 'atlas',
})
assert.equal(autoWithWorkspace.payload.routing_domain, 'auto', 'workspaceSlug não força domain em auto')
assert.ok(!('capability_profile' in autoWithWorkspace.payload))

// ─── programming/dev carrega capability_profile ─────────────────────

const progResult = buildInteractionPayload({
  mode: 'programming',
  task: 'dev',
  provider: 'claude_cli',
  workspaceSlug: 'atlas',
})
assert.equal(progResult.payload.atlas_mode, 'programming')
assert.equal(progResult.payload.routing_task, 'dev')
assert.equal(progResult.payload.flow_id, 'programming.dev')
assert.equal(progResult.payload.domain_id, 'programming')
assert.equal(progResult.payload.capability_profile, 'atlas_programming')
assert.equal(progResult.payload.permission_policy, 'full_access')
assert.equal(progResult.payload.requested_provider, 'claude_cli')
assert.equal(progResult.payload.operator_requested_provider, 'claude_cli')
assert.equal(progResult.provider, 'claude_cli')
// mobile-specific block preservado
assert.ok('mobile_runtime_policy' in progResult.payload, 'mobile_runtime_policy block deve estar presente')
const mobilePolicy = progResult.payload.mobile_runtime_policy as Record<string, unknown>
assert.equal(mobilePolicy.allows_code_execution, true)

// ─── programming/debug vira workflow_mode=dev mas routing_task=debug ──

const debugResult = buildInteractionPayload({
  mode: 'programming',
  task: 'debug',
  provider: 'auto',
  workspaceSlug: 'atlas',
})
assert.equal(debugResult.payload.atlas_workflow_mode, 'dev', 'debug colapsa em workflow_mode=dev')
assert.equal(debugResult.payload.routing_task, 'debug', 'routing_task preserva debug')
assert.equal(debugResult.payload.flow_id, 'programming.repair')

// ─── research mode não carrega programming policy ────────────────────

const researchResult = buildInteractionPayload({
  mode: 'research',
  task: 'plan',
  provider: 'auto',
  workspaceSlug: null,
})
assert.equal(researchResult.payload.atlas_mode, 'research')
assert.equal(researchResult.payload.flow_id, 'research.investigate')
assert.ok(!('capability_profile' in researchResult.payload))
assert.ok(!('programming_harness' in researchResult.payload))

// ─── conversation mode mapeia para flow general (compat) ─────────────

const convResult = buildInteractionPayload({
  mode: 'conversation',
  task: 'direct',
  provider: 'auto',
  workspaceSlug: null,
})
assert.equal(convResult.payload.flow_id, 'general.answer')
assert.equal(convResult.payload.routing_domain, 'conversation')

// ─── operational mode carrega quality_policy correto ─────────────────

const opResult = buildInteractionPayload({
  mode: 'operational',
  task: 'review',
  provider: 'auto',
  workspaceSlug: null,
})
const opQuality = opResult.payload.quality_policy as Record<string, unknown>
assert.equal(opQuality.require_evidence, true)
assert.equal(opQuality.require_next_actions, true)

// ─── conversation_context é passado quando presente ──────────────────

const withContext = buildInteractionPayload({
  mode: 'auto',
  task: 'auto',
  provider: 'auto',
  workspaceSlug: null,
  conversationContext: [{ role: 'user', content: 'previous' }],
})
assert.deepEqual(withContext.payload.conversation_context, [{ role: 'user', content: 'previous' }])

console.log('✓ atlas-ai contract tests passaram')
