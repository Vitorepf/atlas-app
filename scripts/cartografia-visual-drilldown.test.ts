import assert from 'node:assert/strict'
import {
  pipelineTerminalFlow,
  semanticChildrenToGearFlow,
  subsToGearFlow,
  visualFlowForGraphNode,
} from '../components/cartografia/state/cartografiaVisualSubflow'
import type { LiveSemanticGraph, LiveSemanticNode } from '../components/cartografia/state/useCartografiaLiveData'

function node(partial: Partial<LiveSemanticNode> & Pick<LiveSemanticNode, 'graph_id' | 'graph_title'>): LiveSemanticNode {
  return {
    graph_world: 'atlas',
    graph_layer: null,
    graph_kind: 'module',
    graph_parent: null,
    graph_status: 'active',
    graph_source: 'repo',
    source_path: `docs/${partial.graph_id}.md`,
    summary: null,
    capabilities: [],
    decisions: [],
    allowed_changes: [],
    forbidden_changes: [],
    depends_on: [],
    flows_to: [],
    unlocks: [],
    governs: [],
    risk_level: null,
    evidence: [],
    next_actions: [],
    required_tests: [],
    requires_evidence: null,
    repo_paths: [],
    related_paths: [],
    mtime: null,
    ai_entrypoints: [],
    ai_usage_notes: [],
    quality_gates: [],
    failure_modes: [],
    observability_signals: [],
    visual_tags: [],
    ...partial,
  }
}

const semanticGraph: LiveSemanticGraph = {
  worlds: ['atlas'],
  nodes: [
    node({ graph_id: 'atlas-decide', graph_title: 'Atlas Decide', graph_kind: 'system' }),
    node({ graph_id: 'intent', graph_title: 'Intento + risco', graph_kind: 'step', graph_parent: 'atlas-decide' }),
    node({ graph_id: 'policy', graph_title: 'Policy limits', graph_kind: 'policy', graph_parent: 'atlas-decide' }),
    node({ graph_id: 'context', graph_title: 'Contexto + evidência', graph_kind: 'module', graph_parent: 'atlas-decide' }),
    node({ graph_id: 'context-builder', graph_title: 'Context Builder', graph_kind: 'module', graph_parent: 'context' }),
    node({ graph_id: 'evidence-loop', graph_title: 'Evidence Loop', graph_kind: 'flow', graph_parent: 'context' }),
    node({ graph_id: 'provider', graph_title: 'Provider topology', graph_kind: 'adr' }),
    node({
      graph_id: 'atlas-input',
      graph_title: 'Atlas Input',
      graph_kind: 'step',
      flows_to: ['operation-envelope'],
      unlocks: ['operation-envelope'],
    }),
    node({
      graph_id: 'operation-envelope',
      graph_title: 'Operation Envelope',
      graph_kind: 'step',
      depends_on: ['atlas-input'],
      flows_to: ['intent-routing'],
      unlocks: ['intent-routing'],
      governs: ['traceability'],
    }),
    node({
      graph_id: 'intent-routing',
      graph_title: 'Intent / Routing',
      graph_kind: 'step',
      depends_on: ['operation-envelope'],
      flows_to: ['business-context'],
      unlocks: ['business-context'],
      governs: ['task-classification'],
    }),
    node({ graph_id: 'business-context', graph_title: 'Business Context', graph_kind: 'module' }),
    node({
      graph_id: 'budget',
      graph_title: 'Budget + autonomia',
      graph_kind: 'contract',
      flows_to: ['provider'],
    }),
    node({
      graph_id: 'explicit-system',
      graph_title: 'Sistema com gear_flow',
      graph_kind: 'system',
      gear_flow: [
        { graph_id: 'explicit-system:a', name: 'Peça A', kind: 'input', summary: 'entrada', gear_flow: [] },
        { graph_id: 'explicit-system:decide', target_graph_id: 'atlas-decide', name: 'Decide real', kind: 'decision', summary: 'abre nó canônico' },
        {
          graph_id: 'explicit-system:b',
          name: 'Peça B',
          kind: 'output',
          summary: ['saída', 'audit'] as unknown as string,
          evidence: ['docs/a.md', 'docs/b.md'],
          gear_flow: [
            {
              graph_id: '',
              name: 'Peça B.1',
              kind: 'gate',
              summary: null as unknown as string,
              gear_flow: [],
            },
          ],
        },
      ],
    }),
    node({ graph_id: 'lonely', graph_title: 'Sem fluxo explícito', graph_kind: 'module' }),
    node({
      graph_id: 'atlas-vox-operational-thinking-interface',
      graph_title: 'Atlas Vox',
      graph_kind: 'surface',
      graph_layer: 'voice_product_architecture',
      depends_on: ['atlas-ai-voice-realtime-surface'],
      summary: 'programa de voz, intenção e ação governada',
    }),
    node({
      graph_id: 'adr-0003-vox-vs-voice-realtime-surface-boundary',
      graph_title: 'Vox vs Voice Realtime Boundary',
      graph_kind: 'adr',
      graph_parent: 'atlas-vox-operational-thinking-interface',
      summary: 'separa produto Vox da superfície técnica de áudio',
    }),
    node({
      graph_id: 'atlas-vox-v4-contextual-operator-plan',
      graph_title: 'Atlas Vox V4',
      graph_kind: 'contract',
      graph_parent: 'atlas-vox-operational-thinking-interface',
      summary: 'versão contextual da escada Vox',
    }),
    node({
      graph_id: 'atlas-ai-voice-realtime-surface',
      graph_title: 'Voice Realtime Surface',
      graph_kind: 'surface',
      graph_layer: 'technical_audio_runtime',
      summary: 'superfície técnica mobile-first de áudio em tempo real',
    }),
    node({
      graph_id: 'atlas-ai-voice-realtime-canon-de-fala',
      graph_title: 'Canon de Fala',
      graph_kind: 'contract',
      graph_parent: 'atlas-ai-voice-realtime-surface',
      summary: 'contrato técnico de fala e tom',
    }),
  ],
  hierarchy: {
    'atlas-decide': ['intent', 'policy', 'context'],
    context: ['context-builder', 'evidence-loop'],
    'atlas-vox-operational-thinking-interface': [
      'adr-0003-vox-vs-voice-realtime-surface-boundary',
      'atlas-vox-v4-contextual-operator-plan',
    ],
    'atlas-ai-voice-realtime-surface': ['atlas-ai-voice-realtime-canon-de-fala'],
  },
  relations: [
    { from: 'provider', to: 'budget', kind: 'depends_on' },
  ],
}

const atlasDecideFlow = semanticChildrenToGearFlow(semanticGraph, 'atlas-decide')
assert.equal(atlasDecideFlow.length, 3)
assert.deepEqual(atlasDecideFlow.map((item) => item.graph_id), ['intent', 'policy', 'context'])
assert.equal(atlasDecideFlow[0]?.kind, 'input')
assert.equal(atlasDecideFlow[1]?.kind, 'policy')
assert.equal(atlasDecideFlow[2]?.kind, 'context')
assert.deepEqual(atlasDecideFlow[2]?.gear_flow?.map((item) => item.graph_id), ['context-builder', 'evidence-loop'])

const relationFallbackFlow = semanticChildrenToGearFlow(semanticGraph, 'budget')
assert.equal(relationFallbackFlow.some((item) => item.graph_id === 'provider'), false)
assert.equal(relationFallbackFlow[0]?.graph_id, 'budget:documented:self')
assert.equal(relationFallbackFlow.some((item) => item.graph_id === 'budget:documented:output'), true)

const reverseRelationFallbackFlow = semanticChildrenToGearFlow(semanticGraph, 'provider')
assert.equal(reverseRelationFallbackFlow.some((item) => item.graph_id === 'budget'), false)
assert.equal(reverseRelationFallbackFlow[0]?.graph_id, 'provider:documented:self')
assert.equal(reverseRelationFallbackFlow.some((item) => item.name === 'Sem subfluxo'), true)

const atlasInputFlow = visualFlowForGraphNode(semanticGraph, 'atlas-input')
assert.equal(atlasInputFlow.some((item) => item.graph_id === 'operation-envelope'), false)
assert.equal(atlasInputFlow[0]?.graph_id, 'atlas-input:documented:self')
assert.equal(atlasInputFlow.some((item) => item.graph_id === 'atlas-input:documented:output'), true)

const operationEnvelopeFlow = visualFlowForGraphNode(semanticGraph, 'operation-envelope')
assert.equal(operationEnvelopeFlow.some((item) => item.graph_id === 'atlas-input'), false)
assert.equal(operationEnvelopeFlow.some((item) => item.graph_id === 'intent-routing'), false)
assert.equal(operationEnvelopeFlow.some((item) => item.graph_id === 'operation-envelope:documented:input'), true)
assert.equal(operationEnvelopeFlow.some((item) => item.graph_id === 'operation-envelope:documented:output'), true)

const intentRoutingFlow = visualFlowForGraphNode(semanticGraph, 'intent-routing')
assert.equal(intentRoutingFlow.some((item) => item.graph_id === 'operation-envelope'), false)
assert.equal(intentRoutingFlow.some((item) => item.graph_id === 'business-context'), false)
assert.equal(intentRoutingFlow.some((item) => item.graph_id === 'intent-routing:documented:input'), true)
assert.equal(intentRoutingFlow.some((item) => item.graph_id === 'intent-routing:documented:output'), true)

const explicitFlow = visualFlowForGraphNode(semanticGraph, 'explicit-system')
assert.deepEqual(explicitFlow.map((item) => item.graph_id), ['explicit-system:a', 'explicit-system:decide', 'explicit-system:b'])
assert.equal(explicitFlow[1]?.target_graph_id, 'atlas-decide')
assert.deepEqual(explicitFlow[1]?.gear_flow?.map((item) => item.graph_id), ['intent', 'policy', 'context'])
assert.equal(explicitFlow[2]?.summary, 'saída · audit')
assert.deepEqual(explicitFlow[2]?.evidence, ['docs/a.md', 'docs/b.md'])
assert.equal(explicitFlow[2]?.gear_flow?.[0]?.graph_id, 'explicit-system:b:gear:1')
assert.equal(explicitFlow[2]?.gear_flow?.[0]?.summary, 'peça documentada')

const terminalFlow = visualFlowForGraphNode(semanticGraph, 'lonely')
assert.equal(terminalFlow.length, 3)
assert.equal(terminalFlow[0]?.graph_id, 'lonely:documented:self')
assert.equal(terminalFlow.some((item) => item.kind === 'failure' && item.name === 'Sem subfluxo'), true)

const voxFlow = visualFlowForGraphNode(semanticGraph, 'atlas-vox-operational-thinking-interface')
assert.deepEqual(
  voxFlow.map((item) => item.graph_id),
  ['adr-0003-vox-vs-voice-realtime-surface-boundary', 'atlas-vox-v4-contextual-operator-plan'],
)
assert.equal(
  voxFlow.some((item) => item.graph_id === 'atlas-ai-voice-realtime-surface'),
  false,
  'Atlas Vox must not absorb Voice Realtime as an internal child flow; it is a dependency/boundary, not the same thing',
)

const voiceRealtimeFlow = visualFlowForGraphNode(semanticGraph, 'atlas-ai-voice-realtime-surface')
assert.deepEqual(voiceRealtimeFlow.map((item) => item.graph_id), ['atlas-ai-voice-realtime-canon-de-fala'])
assert.equal(
  voiceRealtimeFlow.some((item) => item.graph_id.includes('atlas-vox')),
  false,
  'Voice Realtime must keep its own technical flow separate from Atlas Vox product/version docs',
)

const missingPipelineFlow = pipelineTerminalFlow({
  graphId: 'missing-piece',
  name: 'Peça ausente',
  phase: 'shape',
  deck: '',
  source: 'missing',
  sourcePath: 'docs/missing-piece.md',
  missingSource: true,
})
assert.equal(missingPipelineFlow.some((item) => item.name === 'Fonte ausente'), true)

const subsFallbackFlow = subsToGearFlow({
  graphId: 'surface-plane',
  phase: 'intake',
  deck: 'Usuário · App · Mobile · CLI · API · MCP',
  subs: ['App mobile', 'API REST'],
})
assert.deepEqual(subsFallbackFlow.map((item) => item.kind), ['input', 'input'])
assert.deepEqual(subsFallbackFlow.map((item) => item.graph_id), ['surface-plane:sub:1', 'surface-plane:sub:2'])

console.log('cartografia visual drilldown tests passed')
