import assert from 'node:assert/strict'
import {
  HYPERFLOW_RUNTIME_SCHEMA,
  extractHyperflow,
  flowIdFromRuntime,
  formatRoutingReason,
  intentLabelFor,
  isAutoAutoCleanPayload,
  type AtlasAiHyperflowTrace,
} from '../lib/atlasAi/hyperflowRuntime'
import { buildInteractionPayload } from '../lib/atlasAi/contract'

// ─── Schema canon ────────────────────────────────────────────────────

assert.equal(HYPERFLOW_RUNTIME_SCHEMA, 'atlas.ai.hyperflow_runtime.v1')

// ─── intentLabelFor ──────────────────────────────────────────────────

assert.equal(intentLabelFor('research'), 'Pesquisa')
assert.equal(intentLabelFor('programming'), 'Programação')
assert.equal(intentLabelFor('finance'), 'Finanças')
assert.equal(intentLabelFor('unknown'), 'Indefinido')
assert.equal(intentLabelFor('not-mapped'), 'not-mapped', 'fallback: retorna o próprio intent')

// ─── extractHyperflow · null when absent ─────────────────────────────

assert.equal(extractHyperflow(null), null, 'null trace → null')
assert.equal(extractHyperflow(undefined), null, 'undefined trace → null')
assert.equal(extractHyperflow({}), null, 'empty obj → null')
assert.equal(extractHyperflow({ hyperflow: null }), null, 'hyperflow=null → null')

// ─── extractHyperflow · flat shape canon ─────────────────────────────

const flatTrace = {
  id: 'trace-1',
  status: 'completed',
  hyperflow: {
    schema_version: 'atlas.ai.hyperflow_runtime.v1',
    intent: 'research',
    domain_id: 'research',
    flow_id: 'atlas_research',
    runtime_mode: 'deep',
    confidence: 0.72,
    policy_refs: [],
    evidence_refs: ['evidence.gate'],
    decision_receipt_hash: 'a'.repeat(64),
    dispatch_status: 'planned',
    handoff_target: null,
    handoff_reason: null,
  } satisfies AtlasAiHyperflowTrace,
}

const extracted = extractHyperflow(flatTrace)
assert.ok(extracted, 'flat shape deve ser extraído')
assert.equal(extracted!.intent, 'research')
assert.equal(extracted!.flow_id, 'atlas_research')
assert.equal(extracted!.decision_receipt_hash, 'a'.repeat(64))

// ─── extractHyperflow · nested shape em payload ──────────────────────

const nestedTrace = {
  id: 'trace-2',
  payload: {
    hyperflow_runtime: {
      schema_version: 'atlas.ai.hyperflow_runtime.v1',
      status: 'ready',
      intent: { intent_type: 'finance', confidence: 0.66 },
      primary_domain: 'finance',
      flow_id: 'atlas_plan',
      router_decision: { routing_mode: 'deep', uuid: 'rd-uuid', receipt_hash: 'b'.repeat(64) },
      flow_route: { runtime_mode: 'deep' },
      dispatch: { dispatch_target: 'atlas_finance', dispatch_status: 'planned' },
      decision_receipt: { receipt_hash: 'b'.repeat(64) },
      handoff_target: null,
    },
  },
}

const nestedExtracted = extractHyperflow(nestedTrace)
assert.ok(nestedExtracted, 'nested shape deve ser normalizado')
assert.equal(nestedExtracted!.intent, 'finance')
assert.equal(nestedExtracted!.domain_id, 'finance')
assert.equal(nestedExtracted!.flow_id, 'atlas_plan')
assert.equal(nestedExtracted!.runtime_mode, 'deep')
assert.equal(nestedExtracted!.confidence, 0.66)
assert.equal(nestedExtracted!.decision_receipt_hash, 'b'.repeat(64))

// ─── extractHyperflow · metadata fallback ────────────────────────────

const metadataTrace = {
  id: 'trace-3',
  metadata: {
    hyperflow_runtime: {
      schema_version: 'atlas.ai.hyperflow_runtime.v1',
      intent: { intent_type: 'marketing' },
      primary_domain: 'marketing',
      flow_id: 'atlas_plan',
    },
  },
}
const metaExtracted = extractHyperflow(metadataTrace)
assert.ok(metaExtracted)
assert.equal(metaExtracted!.intent, 'marketing')

// ─── flat preferido sobre nested quando ambos presentes ──────────────

const bothTrace = {
  hyperflow: {
    schema_version: 'atlas.ai.hyperflow_runtime.v1',
    intent: 'programming',
    domain_id: 'programming',
    flow_id: 'atlas_dev',
    runtime_mode: 'standard',
    confidence: 0.9,
    policy_refs: [],
    evidence_refs: [],
    dispatch_status: 'simulated',
    handoff_target: 'atlas_dev',
    handoff_reason: 'hyperflow_programming_flow_handoff',
  },
  payload: {
    hyperflow_runtime: {
      schema_version: 'atlas.ai.hyperflow_runtime.v1',
      intent: { intent_type: 'WRONG' },
      primary_domain: 'WRONG',
      flow_id: 'WRONG',
    },
  },
}
const bothExtracted = extractHyperflow(bothTrace)
assert.equal(bothExtracted!.intent, 'programming', 'flat shape vence sobre nested')

// ─── ANTI-REGRESSÃO · research NÃO vira programming.dev ──────────────

const researchTrace = {
  hyperflow: {
    schema_version: 'atlas.ai.hyperflow_runtime.v1',
    intent: 'research',
    domain_id: 'research',
    flow_id: 'atlas_research',
    runtime_mode: 'deep',
    confidence: 0.7,
    policy_refs: [],
    evidence_refs: [],
    dispatch_status: 'planned',
    handoff_target: null,
    handoff_reason: null,
  },
}
const researchExtracted = extractHyperflow(researchTrace)
assert.equal(researchExtracted!.domain_id, 'research')
assert.notEqual(researchExtracted!.flow_id, 'programming.dev', 'research NUNCA vira programming.dev')
assert.equal(researchExtracted!.handoff_target, null, 'sem handoff_target em domain ≠ programming')

// ─── ANTI-REGRESSÃO · finance NUNCA tem handoff_target=atlas_dev ─────

const financeTrace = {
  hyperflow: {
    schema_version: 'atlas.ai.hyperflow_runtime.v1',
    intent: 'finance',
    domain_id: 'finance',
    flow_id: 'atlas_plan',
    runtime_mode: 'deep',
    confidence: 0.66,
    policy_refs: ['policy.gate'],
    evidence_refs: ['evidence.gate'],
    dispatch_status: 'planned',
    handoff_target: null,
    handoff_reason: null,
  },
}
const financeExtracted = extractHyperflow(financeTrace)
assert.equal(financeExtracted!.handoff_target, null)
assert.notEqual(financeExtracted!.handoff_target, 'atlas_dev', 'finance NUNCA tem handoff atlas_dev')

// ─── flowIdFromRuntime · backend wins, null se ausente ───────────────

assert.equal(flowIdFromRuntime(null), null, 'null hyperflow → null flow_id')
assert.equal(flowIdFromRuntime(researchExtracted), 'atlas_research')
assert.equal(flowIdFromRuntime(financeExtracted), 'atlas_plan')

// ─── formatRoutingReason ─────────────────────────────────────────────

assert.equal(formatRoutingReason(null), '')

const withReasons: AtlasAiHyperflowTrace = {
  schema_version: 'atlas.ai.hyperflow_runtime.v1',
  intent: 'marketing',
  domain_id: 'marketing',
  flow_id: 'atlas_plan',
  runtime_mode: 'standard',
  confidence: 0.6,
  policy_refs: [],
  evidence_refs: [],
  dispatch_status: 'planned',
  handoff_target: null,
  handoff_reason: null,
  reasons: ['intent_type:marketing', 'primary_domain:marketing'],
}
assert.equal(
  formatRoutingReason(withReasons),
  'intent_type:marketing · primary_domain:marketing',
)

const withoutReasons: AtlasAiHyperflowTrace = { ...withReasons, reasons: undefined }
assert.equal(
  formatRoutingReason(withoutReasons),
  'Marketing · flow:atlas_plan · mode:standard',
)

// ─── isAutoAutoCleanPayload · invariante crítico ─────────────────────

const autoPayload = buildInteractionPayload({
  mode: 'auto',
  task: 'auto',
  provider: 'auto',
  workspaceSlug: null,
}).payload
assert.ok(isAutoAutoCleanPayload(autoPayload), 'auto/auto payload deve ser limpo')

const progPayload = buildInteractionPayload({
  mode: 'programming',
  task: 'dev',
  provider: 'auto',
  workspaceSlug: 'atlas',
}).payload
assert.ok(isAutoAutoCleanPayload(progPayload), 'programming payload passa (regra só aplica em auto)')

// Synthetic dirty payload · auto com keys proibidas
const dirty = { atlas_mode: 'auto', programming_harness: {} }
assert.ok(!isAutoAutoCleanPayload(dirty), 'auto com programming_harness deve ser flagged')

const dirty2 = { atlas_mode: 'auto', capability_profile: 'atlas_programming' }
assert.ok(!isAutoAutoCleanPayload(dirty2), 'auto com capability_profile deve ser flagged')

console.log('✓ hyperflow runtime consumption tests passaram')
