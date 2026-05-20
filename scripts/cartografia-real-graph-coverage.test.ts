import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { visualFlowForGraphNode } from '../components/cartografia/state/cartografiaVisualSubflow'
import type { LiveGearFlowNode, LiveSemanticGraph, LiveSemanticNode } from '../components/cartografia/state/useCartografiaLiveData'

const SYSTEM_GRAPH_DIR = join(
  process.cwd(),
  '..',
  'atlas-server',
  'docs',
  'engineering-knowledge-base',
  'system-graph',
)
const ENGINEERING_DOCS_DIR = join(
  process.cwd(),
  '..',
  'atlas-server',
  'docs',
  'engineering-knowledge-base',
)

const KERNEL_GRAPH_IDS = [
  'surface-plane',
  'surface-adapter',
  'atlas-input',
  'operation-envelope',
  'intent-routing',
  'business-context',
  'domain-profile-flow',
  'context-builder',
  'policy-profile',
  'atlas-decide',
  'decision-receipt',
  'runtime-executor',
  'quality-gates',
  'repair-escalation',
  'evidence-ledger',
  'learning-proposals',
  'output-renderer',
] as const

type Frontmatter = {
  graph_id?: string
  graph_title?: string
  graph_world?: string
  graph_layer?: string
  graph_kind?: string
  graph_parent?: string
  graph_status?: string
  summary?: string
  risk_level?: string
  capabilities?: string[]
  decisions?: string[]
  allowed_changes?: string[]
  forbidden_changes?: string[]
  depends_on?: string[]
  flows_to?: string[]
  unlocks?: string[]
  governs?: string[]
  evidence?: string[]
  next_actions?: string[]
  required_tests?: string[]
  repo_paths?: string[]
  related_paths?: string[]
  ai_entrypoints?: string[]
  ai_usage_notes?: string[]
  quality_gates?: string[]
  failure_modes?: string[]
  observability_signals?: string[]
  visual_tags?: string[]
  gear_flow?: LiveGearFlowNode[]
}

function frontmatterFrom(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/)
  if (lines[0] !== '---') return []
  const end = lines.findIndex((line, index) => index > 0 && line === '---')
  return end > 0 ? lines.slice(1, end) : []
}

function parseStringList(lines: string[], startIndex: number): { values: string[]; endIndex: number } {
  const values: string[] = []
  let index = startIndex + 1
  while (index < lines.length) {
    const line = lines[index]
    const match = line.match(/^  -\s+(.+)$/)
    if (!match) break
    values.push(match[1].replace(/^["']|["']$/g, '').trim())
    index += 1
  }
  return { values, endIndex: index - 1 }
}

function parseGearFlow(lines: string[], startIndex: number): { values: LiveGearFlowNode[]; endIndex: number } {
  const values: LiveGearFlowNode[] = []
  let current: Partial<LiveGearFlowNode> | null = null
  let index = startIndex + 1

  const flush = () => {
    if (!current?.graph_id || !current.name || !current.kind) return
    values.push({
      graph_id: current.graph_id,
      name: current.name,
      kind: current.kind,
      summary: current.summary ?? '',
      target_graph_id: current.target_graph_id,
    })
  }

  while (index < lines.length) {
    const line = lines[index]
    const first = line.match(/^  - graph_id:\s*(.+)$/)
    if (first) {
      flush()
      current = { graph_id: first[1].trim() }
      index += 1
      continue
    }

    const field = line.match(/^    (target_graph_id|name|kind|summary):\s*(.+)$/)
    if (field && current) {
      current[field[1] as 'target_graph_id' | 'name' | 'kind' | 'summary'] = field[2].trim()
      index += 1
      continue
    }

    if (line.startsWith('    ') || line.trim() === '') {
      index += 1
      continue
    }
    break
  }

  flush()
  return { values, endIndex: index - 1 }
}

function parseFrontmatter(lines: string[]): Frontmatter {
  const fm: Frontmatter = {}
  for (let i = 0; i < lines.length; i += 1) {
    const scalar = lines[i].match(/^([a-z_]+):\s*(.*)$/)
    if (!scalar) continue
    const [, key, rawValue] = scalar
    const value = rawValue.trim()
    if (key === 'gear_flow' && value === '') {
      const parsed = parseGearFlow(lines, i)
      fm.gear_flow = parsed.values
      i = parsed.endIndex
      continue
    }
    if (
      [
        'capabilities',
        'decisions',
        'allowed_changes',
        'forbidden_changes',
        'depends_on',
        'flows_to',
        'unlocks',
        'governs',
        'evidence',
        'next_actions',
        'required_tests',
        'repo_paths',
        'related_paths',
        'ai_entrypoints',
        'ai_usage_notes',
        'quality_gates',
        'failure_modes',
        'observability_signals',
        'visual_tags',
      ].includes(key) &&
      value === ''
    ) {
      const parsed = parseStringList(lines, i)
      ;(fm as Record<string, unknown>)[key] = parsed.values
      i = parsed.endIndex
      continue
    }
    if (key.startsWith('graph_') || key === 'summary' || key === 'risk_level') {
      ;(fm as Record<string, unknown>)[key] = value
    }
  }
  return fm
}

function walkMarkdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) return walkMarkdownFiles(path)
    return entry.endsWith('.md') ? [path] : []
  })
}

function semanticNodeFromPath(path: string): LiveSemanticNode | null {
  const fm = parseFrontmatter(frontmatterFrom(readFileSync(path, 'utf8')))
  const graphId = fm.graph_id
  if (!graphId || !['active', 'building'].includes(fm.graph_status ?? '')) return null
  return semanticNodeFromFrontmatter(
    graphId,
    fm,
    relative(join(process.cwd(), '..', 'atlas-server'), path),
  )
}

function semanticNodeFor(graphId: string): LiveSemanticNode {
  const path = join(SYSTEM_GRAPH_DIR, `${graphId}.md`)
  assert.equal(existsSync(path), true, `missing system graph doc for ${graphId}`)
  const fm = parseFrontmatter(frontmatterFrom(readFileSync(path, 'utf8')))
  return semanticNodeFromFrontmatter(
    graphId,
    fm,
    `docs/engineering-knowledge-base/system-graph/${graphId}.md`,
  )
}

function semanticNodeFromDoc(graphId: string, filename: string): LiveSemanticNode {
  const path = join(ENGINEERING_DOCS_DIR, filename)
  assert.equal(existsSync(path), true, `missing engineering doc for ${graphId}`)
  const fm = parseFrontmatter(frontmatterFrom(readFileSync(path, 'utf8')))
  return semanticNodeFromFrontmatter(graphId, fm, `docs/engineering-knowledge-base/${filename}`)
}

function semanticNodeFromFrontmatter(graphId: string, fm: Frontmatter, sourcePath: string): LiveSemanticNode {
  return {
    graph_id: fm.graph_id ?? graphId,
    graph_title: fm.graph_title ?? graphId,
    graph_world: fm.graph_world ?? 'atlas',
    graph_layer: fm.graph_layer ?? null,
    graph_kind: fm.graph_kind ?? null,
    graph_parent: fm.graph_parent ?? null,
    graph_status: fm.graph_status ?? null,
    graph_source: 'repo',
    source_path: sourcePath,
    summary: fm.summary ?? null,
    capabilities: fm.capabilities ?? [],
    decisions: fm.decisions ?? [],
    allowed_changes: fm.allowed_changes ?? [],
    forbidden_changes: fm.forbidden_changes ?? [],
    depends_on: fm.depends_on ?? [],
    flows_to: fm.flows_to ?? [],
    unlocks: fm.unlocks ?? [],
    governs: fm.governs ?? [],
    risk_level: fm.risk_level ?? null,
    evidence: fm.evidence ?? [],
    next_actions: fm.next_actions ?? [],
    required_tests: fm.required_tests ?? [],
    requires_evidence: null,
    repo_paths: fm.repo_paths ?? [],
    related_paths: fm.related_paths ?? [],
    gear_flow: fm.gear_flow ?? [],
    ai_entrypoints: fm.ai_entrypoints ?? [],
    ai_usage_notes: fm.ai_usage_notes ?? [],
    quality_gates: fm.quality_gates ?? [],
    failure_modes: fm.failure_modes ?? [],
    observability_signals: fm.observability_signals ?? [],
    visual_tags: fm.visual_tags ?? [],
    mtime: null,
  }
}

const nodes = [
  ...KERNEL_GRAPH_IDS.map(semanticNodeFor),
  semanticNodeFromDoc('atlas-ai-pipeline', 'atlas-ai-pipeline.md'),
  semanticNodeFromDoc('atlas-ai-flow-visual-map', 'atlas-ai-flow-visual-map.md'),
  semanticNodeFromDoc('atlas-ai-kernel-architecture', 'atlas-ai-kernel-architecture.md'),
  semanticNodeFromDoc('atlas-ai-voice-realtime-canon-de-fala', 'atlas-ai-voice-realtime-canon-de-fala.md'),
  semanticNodeFromDoc('adr-0002-voice-realtime-sdk-loop-kernel-response-path', 'adr/0002-voice-realtime-sdk-loop-kernel-response-path.md'),
  semanticNodeFromDoc('atlas-vox-operational-thinking-interface', 'atlas-vox-operational-thinking-interface.md'),
  semanticNodeFromDoc('atlas-ai-voice-realtime-surface', 'atlas-ai-voice-realtime-surface.md'),
]
const hierarchy: LiveSemanticGraph['hierarchy'] = {}
const relations: LiveSemanticGraph['relations'] = []

nodes.forEach((node) => {
  if (node.graph_parent) {
    hierarchy[node.graph_parent] ??= []
    hierarchy[node.graph_parent].push(node.graph_id)
  }
  node.depends_on.forEach((target) => relations.push({ from: node.graph_id, to: target, kind: 'depends_on' }))
  node.flows_to.forEach((target) => relations.push({ from: node.graph_id, to: target, kind: 'flows_to' }))
  node.unlocks.forEach((target) => relations.push({ from: node.graph_id, to: target, kind: 'unlocks' }))
  node.governs.forEach((target) => relations.push({ from: node.graph_id, to: target, kind: 'governs' }))
})

const semanticGraph: LiveSemanticGraph = {
  worlds: ['atlas'],
  nodes,
  hierarchy,
  relations,
}

const realNodes = walkMarkdownFiles(ENGINEERING_DOCS_DIR)
  .map(semanticNodeFromPath)
  .filter((node): node is LiveSemanticNode => Boolean(node))
const realHierarchy: LiveSemanticGraph['hierarchy'] = {}
const realRelations: LiveSemanticGraph['relations'] = []

realNodes.forEach((node) => {
  if (node.graph_parent) {
    realHierarchy[node.graph_parent] ??= []
    realHierarchy[node.graph_parent].push(node.graph_id)
  }
  node.depends_on.forEach((target) => realRelations.push({ from: node.graph_id, to: target, kind: 'depends_on' }))
  node.flows_to.forEach((target) => realRelations.push({ from: node.graph_id, to: target, kind: 'flows_to' }))
  node.unlocks.forEach((target) => realRelations.push({ from: node.graph_id, to: target, kind: 'unlocks' }))
  node.governs.forEach((target) => realRelations.push({ from: node.graph_id, to: target, kind: 'governs' }))
})

const realSemanticGraph: LiveSemanticGraph = {
  worlds: Array.from(new Set(realNodes.map((node) => node.graph_world))),
  nodes: realNodes,
  hierarchy: realHierarchy,
  relations: realRelations,
}

const docsWithoutVisualFlow = realNodes.flatMap((node) => {
  const flow = visualFlowForGraphNode(realSemanticGraph, node.graph_id)
  if (!flow.length) return [`${node.graph_id}: no visual flow`]

  const blankPieces = flow.filter((piece) => !piece.name.trim() || !piece.summary.trim())
  if (blankPieces.length) {
    return [`${node.graph_id}: blank visual pieces ${blankPieces.map((piece) => piece.graph_id).join(', ')}`]
  }

  const hasVisualEvidence = flow.some((piece) =>
    Boolean(piece.target_graph_id || piece.source_path || piece.graph_id.includes(':documented:') || piece.graph_id.includes(':empty')),
  )
  return hasVisualEvidence ? [] : [`${node.graph_id}: visual flow has no canonical target, source, or documented terminal marker`]
})

assert.deepEqual(
  docsWithoutVisualFlow,
  [],
  'Every active/building documentation node must open a visual flow, even when it is terminal or has a documentation gap',
)

const failures: string[] = []

KERNEL_GRAPH_IDS.forEach((graphId) => {
  const flow = visualFlowForGraphNode(semanticGraph, graphId)
  if (!flow.length) {
    failures.push(`${graphId}: no visual flow generated`)
    return
  }
  if (graphId !== 'atlas-decide') {
    const leakedKernelNode = flow.find((node) =>
      KERNEL_GRAPH_IDS.includes(node.graph_id as (typeof KERNEL_GRAPH_IDS)[number]),
    )
    if (leakedKernelNode) {
      failures.push(`${graphId}: global relation ${leakedKernelNode.graph_id} leaked as an internal subflow`)
    }
    if (!flow.some((node) => node.graph_id === `${graphId}:documented:self`)) {
      failures.push(`${graphId}: terminal visual flow does not include its documented self node`)
    }
  }
})

assert.deepEqual(failures, [])

const atlasDecideFlow = visualFlowForGraphNode(semanticGraph, 'atlas-decide')
assert.equal(atlasDecideFlow.length, 7)
assert.deepEqual(
  atlasDecideFlow.map((node) => node.name),
  [
    'Intento + risco',
    'Policy limits',
    'Contexto + evidencia',
    'Provider topology',
    'Budget + autonomia',
    'Decision Receipt',
    'Falha governada',
  ],
)

const atlasAiPipelineFlow = visualFlowForGraphNode(semanticGraph, 'atlas-ai-pipeline')
assert.deepEqual(
  atlasAiPipelineFlow.map((node) => node.name),
  [
    'Input',
    'Intent',
    'Domain',
    'Domain Profile',
    'Flow Profile',
    'Context',
    'Policy',
    'Decide',
    'Executor',
    'Gate',
    'Repair / Escalation',
    'Evidence',
    'Learning',
    'Output',
  ],
  'Atlas AI Pipeline must expose its documented macro gear_flow instead of a generic relation fallback',
)
const pipelineDecideNode = atlasAiPipelineFlow.find((node) => node.name === 'Decide')
assert.equal(
  pipelineDecideNode?.target_graph_id,
  'atlas-decide',
  'Atlas AI Pipeline Decide gear must target the canonical Atlas Decide node, not remain a synthetic dead end',
)
assert.deepEqual(
  pipelineDecideNode?.gear_flow?.map((node) => node.name),
  [
    'Intento + risco',
    'Policy limits',
    'Contexto + evidencia',
    'Provider topology',
    'Budget + autonomia',
    'Decision Receipt',
    'Falha governada',
  ],
  'Tapping Decide in the macro pipeline must open the real Atlas Decide visual flow',
)

const atlasAiVisualMapFlow = visualFlowForGraphNode(semanticGraph, 'atlas-ai-flow-visual-map')
assert.deepEqual(
  atlasAiVisualMapFlow.map((node) => node.name),
  [
    'Surface',
    'Atlas Input',
    'Operation Envelope',
    'Intent / Routing',
    'Business Context',
    'Domain Plane',
    'Domain Profile',
    'Flow Profile',
    'Context Builder',
    'Policy / Profile',
    'Atlas Decide',
    'Decision Receipt',
    'Runtime / Executor',
    'Quality Gates',
    'Repair / Escalation',
    'Evidence Ledger',
    'Learning / Proposals',
    'Output Renderer',
  ],
  'Atlas AI Flow Visual Map must expose the documented V3 visual flow exactly',
)
const visualAtlasDecideNode = atlasAiVisualMapFlow.find((node) => node.name === 'Atlas Decide')
assert.equal(
  visualAtlasDecideNode?.target_graph_id,
  'atlas-decide',
  'Atlas AI Flow Visual Map Atlas Decide gear must target the canonical Atlas Decide node',
)
assert.deepEqual(
  visualAtlasDecideNode?.gear_flow?.map((node) => node.name),
  [
    'Intento + risco',
    'Policy limits',
    'Contexto + evidencia',
    'Provider topology',
    'Budget + autonomia',
    'Decision Receipt',
    'Falha governada',
  ],
  'Tapping Atlas Decide inside the visual map must open the real Atlas Decide flow',
)

const voxFlow = visualFlowForGraphNode(semanticGraph, 'atlas-vox-operational-thinking-interface')
assert.deepEqual(
  voxFlow.map((node) => node.name),
  [
    'Fala humana',
    'Intent Packet',
    'Kernel + Policy',
    'Decision Receipt',
    'Acao governada',
    'Memoria revisavel',
    'Fronteira Voice Realtime',
  ],
  'Atlas Vox must use its own documented gear_flow instead of generic relation fallback',
)
assert.equal(
  voxFlow.some((node) => node.graph_id === 'atlas-ai-voice-realtime-surface'),
  false,
  'Atlas Vox must not absorb Voice Realtime as an internal visual piece; boundary remains explicit',
)
const voxIntentNode = voxFlow.find((node) => node.name === 'Intent Packet')
assert.equal(voxIntentNode?.target_graph_id, 'intent-routing')
assert.ok(
  voxIntentNode?.gear_flow?.length,
  'Tapping Vox Intent Packet must open canonical Intent / Routing instead of a synthetic dead end',
)
const voxVoiceNode = voxFlow.find((node) => node.name === 'Fala humana')
assert.equal(voxVoiceNode?.target_graph_id, 'atlas-ai-voice-realtime-canon-de-fala')
assert.ok(
  voxVoiceNode?.gear_flow?.length,
  'Tapping Vox Fala humana must open the canonical speech contract instead of hiding the docs',
)
const voxBoundaryNode = voxFlow.find((node) => node.name === 'Fronteira Voice Realtime')
assert.equal(voxBoundaryNode?.target_graph_id, 'atlas-ai-voice-realtime-surface')
assert.deepEqual(
  voxBoundaryNode?.gear_flow?.map((node) => node.name),
  [
    'Mobile Voice',
    'LiveKit Agents SDK',
    'Operation Envelope',
    'Atlas Decide',
    'Decision Receipt',
    'Response / TTS',
    'Evidence + Learning',
  ],
  'Tapping the Vox boundary gear must open the real Voice Realtime flow while keeping Vox and Voice separated',
)

const voiceRealtimeFlow = visualFlowForGraphNode(semanticGraph, 'atlas-ai-voice-realtime-surface')
assert.deepEqual(
  voiceRealtimeFlow.map((node) => node.name),
  [
    'Mobile Voice',
    'LiveKit Agents SDK',
    'Operation Envelope',
    'Atlas Decide',
    'Decision Receipt',
    'Response / TTS',
    'Evidence + Learning',
  ],
  'Voice Realtime must use its own documented technical gear_flow instead of Atlas Vox product flow',
)
assert.equal(
  voiceRealtimeFlow.some((node) => node.graph_id.includes('atlas-vox')),
  false,
  'Voice Realtime must not absorb Atlas Vox versions or product program nodes',
)
const voiceDecideNode = voiceRealtimeFlow.find((node) => node.name === 'Atlas Decide')
assert.equal(voiceDecideNode?.target_graph_id, 'atlas-decide')
assert.deepEqual(
  voiceDecideNode?.gear_flow?.map((node) => node.name),
  [
    'Intento + risco',
    'Policy limits',
    'Contexto + evidencia',
    'Provider topology',
    'Budget + autonomia',
    'Decision Receipt',
    'Falha governada',
  ],
  'Tapping Atlas Decide inside Voice Realtime must open the real Atlas Decide flow',
)
const voiceLiveKitNode = voiceRealtimeFlow.find((node) => node.name === 'LiveKit Agents SDK')
assert.equal(voiceLiveKitNode?.target_graph_id, 'adr-0002-voice-realtime-sdk-loop-kernel-response-path')
assert.ok(
  voiceLiveKitNode?.gear_flow?.length,
  'Tapping LiveKit Agents SDK must open the canonical Voice Realtime ADR instead of hiding the docs',
)

console.log('cartografia real graph coverage tests passed')
