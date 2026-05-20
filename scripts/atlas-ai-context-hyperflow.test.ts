/**
 * Slice 3b · integração HyperFlow + ContextSheet.
 *
 * Valida que `useHyperflowRuntime(trace)` derivado dentro do
 * AtlasAiContextSheet expõe os campos corretos do `trace.hyperflow`
 * canon (flat shape) E do fallback `metadata.hyperflow_runtime` (nested).
 *
 * NÃO testa renderização (RN runtime). Testa o hook em si para garantir
 * que o componente recebe a view derivada esperada.
 */
import assert from 'node:assert/strict'
import {
  extractHyperflow,
  formatRoutingReason,
  intentLabelFor,
} from '../lib/atlasAi/hyperflowRuntime'

// Simula trace que chega via /ai/interactions response (flat shape canon).
const flatTrace = {
  id: 'trace-research-1',
  status: 'completed',
  hyperflow: {
    schema_version: 'atlas.ai.hyperflow_runtime.v1',
    intent: 'research',
    domain_id: 'research',
    flow_id: 'atlas_research',
    runtime_mode: 'deep',
    confidence: 0.84,
    policy_refs: ['policy.gate.evidence'],
    evidence_refs: ['evidence.research_protocol'],
    decision_receipt_hash: 'c'.repeat(64),
    dispatch_status: 'planned',
    handoff_target: null,
    handoff_reason: null,
    reasons: ['intent_type:research', 'primary_domain:research', 'confidence:84'],
  },
} as const

const extracted = extractHyperflow(flatTrace)
assert.ok(extracted, 'flat trace deve render extracted')
assert.equal(extracted!.intent, 'research')
assert.equal(extracted!.flow_id, 'atlas_research')
assert.equal(extracted!.runtime_mode, 'deep')
assert.equal(intentLabelFor(extracted!.intent), 'Pesquisa')

// Renderização típica que o ContextSheet vai mostrar
const intentRow = `${intentLabelFor(extracted!.intent)} (${extracted!.intent})`
assert.equal(intentRow, 'Pesquisa (research)')

const confidencePct = `${Math.round(extracted!.confidence * 100)}%`
assert.equal(confidencePct, '84%')

const summary = formatRoutingReason(extracted)
assert.equal(summary, 'intent_type:research · primary_domain:research · confidence:84')

// ─── Caso programming com handoff ────────────────────────────────────

const programmingTrace = {
  id: 'trace-prog-1',
  status: 'completed',
  hyperflow: {
    schema_version: 'atlas.ai.hyperflow_runtime.v1',
    intent: 'programming',
    domain_id: 'programming',
    flow_id: 'atlas_dev',
    runtime_mode: 'standard',
    confidence: 0.91,
    policy_refs: [],
    evidence_refs: [],
    decision_receipt_hash: 'd'.repeat(64),
    dispatch_status: 'simulated',
    handoff_target: 'atlas_dev',
    handoff_reason: 'hyperflow_programming_flow_handoff',
  },
}

const progExtracted = extractHyperflow(programmingTrace)
assert.equal(progExtracted!.handoff_target, 'atlas_dev', 'programming deve ter handoff_target')
assert.equal(progExtracted!.dispatch_status, 'simulated')

// ─── Caso null (trace sem decisão hyperflow ainda) ───────────────────

const emptyTrace = { id: 'trace-empty', status: 'queued', hyperflow: null }
const emptyExtracted = extractHyperflow(emptyTrace)
assert.equal(emptyExtracted, null, 'sem hyperflow → null (sheet mostra empty state)')

// ─── Caso nested em metadata (backwards-compat) ──────────────────────

const nestedTrace = {
  id: 'trace-nested',
  status: 'completed',
  metadata: {
    hyperflow_runtime: {
      schema_version: 'atlas.ai.hyperflow_runtime.v1',
      intent: { intent_type: 'finance', confidence: 0.77 },
      primary_domain: 'finance',
      flow_id: 'atlas_finance',
      router_decision: { routing_mode: 'deep', receipt_hash: 'e'.repeat(64) },
      flow_route: { runtime_mode: 'deep' },
      dispatch: { dispatch_status: 'planned' },
      decision_receipt: { receipt_hash: 'e'.repeat(64) },
    },
  },
}

const nestedExtracted = extractHyperflow(nestedTrace)
assert.equal(nestedExtracted!.intent, 'finance', 'nested → flat fallback funciona')
assert.equal(nestedExtracted!.flow_id, 'atlas_finance')
assert.equal(intentLabelFor(nestedExtracted!.intent), 'Finanças')

// ─── Anti-regressão · research/finance NUNCA viram programming ───────

assert.notEqual(extracted!.flow_id, 'programming.dev', 'research nunca programming.dev')
assert.equal(extracted!.handoff_target, null, 'research sem handoff')
assert.equal(nestedExtracted!.handoff_target, null, 'finance sem handoff')

console.log('✓ context sheet hyperflow integration tests passaram')
