import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { buildAllHits, buildCoverageGroups } from '../components/cartografia/focus/SearchOverlayModel'
import type { LiveSemanticGraph, LiveSemanticNode } from '../components/cartografia/state/useCartografiaLiveData'

function semanticNode(partial: Partial<LiveSemanticNode> & Pick<LiveSemanticNode, 'graph_id' | 'graph_title'>): LiveSemanticNode {
  return {
    graph_world: 'atlas',
    graph_layer: 'semantic',
    graph_kind: 'module',
    graph_parent: null,
    graph_status: 'active',
    graph_source: 'repo',
    source_path: `docs/engineering-knowledge-base/${partial.graph_id}.md`,
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
    gear_flow: [],
    ai_entrypoints: [],
    ai_usage_notes: [],
    quality_gates: [],
    failure_modes: [],
    observability_signals: [],
    visual_tags: [],
    mtime: null,
    ...partial,
  }
}

const graph: LiveSemanticGraph = {
  worlds: ['atlas'],
  nodes: [
    semanticNode({
      graph_id: 'atlas-vox-operational-thinking-interface',
      graph_title: 'Atlas Vox',
      graph_kind: 'surface',
      graph_layer: 'voice_product_architecture',
      summary: 'programa de voz, intenção e ação governada',
    }),
    semanticNode({
      graph_id: 'atlas-ai-voice-realtime-surface',
      graph_title: 'Voice Realtime Surface',
      graph_kind: 'surface',
      graph_layer: 'technical_audio_runtime',
      summary: 'superfície técnica mobile-first de áudio em tempo real',
    }),
    semanticNode({
      graph_id: 'atlas-doc-that-only-exists-in-semantic-graph',
      graph_title: 'Documento Só Semântico',
      graph_kind: 'contract',
      graph_layer: 'coverage',
      summary: 'deve aparecer na busca mesmo sem nó estático no canvas',
    }),
  ],
  hierarchy: {},
  relations: [],
}

const hits = buildAllHits([], [], graph)
const byId = new Map(hits.map((hit) => [hit.id, hit]))
const coverageGroups = buildCoverageGroups(hits)
const coverageBySection = new Map(coverageGroups.map((group) => [group.section, group]))

assert.equal(
  byId.get('atlas-doc-that-only-exists-in-semantic-graph')?.kind,
  'semantic',
  'Docs that exist only in semantic_graph must still appear in mobile search as visual drilldown hits',
)

assert.equal(
  byId.get('atlas-doc-that-only-exists-in-semantic-graph')?.graphId,
  'atlas-doc-that-only-exists-in-semantic-graph',
  'Search hits must carry graphId so UI ids cannot hide the real documentation identity',
)

assert.equal(
  byId.get('atlas-doc-that-only-exists-in-semantic-graph')?.section,
  'ATLAS · COVERAGE',
)

assert.equal(
  coverageBySection.get('ATLAS · COVERAGE')?.semanticOnly,
  1,
  'Coverage map must make semantic-only documentation visible as graph coverage, not hide it behind an unlabelled search list',
)

assert.equal(
  coverageBySection.get('ATLAS · COVERAGE')?.visible,
  0,
  'Coverage map must distinguish docs that are visible on the canvas from docs reachable through the semantic graph',
)

assert.ok(
  (coverageBySection.get('ATLAS · VOICE_PRODUCT_ARCHITECTURE')?.visible ?? 0) >= 1,
  'Coverage map must show Atlas Vox as a visible product/architecture node, separate from semantic-only docs',
)

assert.equal(
  byId.get('atlas-vox-operational-thinking-interface')?.kind,
  'continent-node',
  'Atlas Vox has a visible node and should keep that visible entry while pointing to the real graph id',
)

assert.equal(
  byId.get('atlas-vox-operational-thinking-interface')?.section,
  'ATLAS · VOICE_PRODUCT_ARCHITECTURE',
  'Visible Atlas Vox search entry must still use the live semantic section, not stale static continent copy',
)

assert.equal(
  byId.get('atlas-vox-operational-thinking-interface')?.subtitle,
  'programa de voz, intenção e ação governada',
  'Visible Atlas Vox search entry must use the live semantic summary when graph data exists',
)

assert.equal(
  byId.get('atlas-ai-voice-realtime-surface')?.kind,
  'continent-node',
  'Voice Realtime has a visible node and should keep that visible entry while pointing to the real graph id',
)

assert.notEqual(
  byId.get('atlas-vox-operational-thinking-interface')?.subtitle,
  byId.get('atlas-ai-voice-realtime-surface')?.subtitle,
  'Atlas Vox and Voice Realtime search entries must remain semantically distinct',
)

assert.equal(
  byId.get('atlas-ai-voice-realtime-surface')?.section,
  'ATLAS · TECHNICAL_AUDIO_RUNTIME',
  'Voice Realtime search entry must use its own live semantic layer, separate from Atlas Vox',
)

const repoDocsRoot = join(process.cwd(), '..', 'atlas-server', 'docs', 'engineering-knowledge-base')

function walkMarkdownFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  return entries.flatMap((entry) => {
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) return walkMarkdownFiles(path)
    return entry.endsWith('.md') ? [path] : []
  })
}

function frontmatterLines(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/)
  if (lines[0] !== '---') return []
  const end = lines.findIndex((line, index) => index > 0 && line === '---')
  return end > 0 ? lines.slice(1, end) : []
}

function scalar(lines: string[], key: string): string | null {
  const prefix = `${key}:`
  const line = lines.find((item) => item.startsWith(prefix))
  if (!line) return null
  const value = line.slice(prefix.length).trim()
  return value ? value.replace(/^["']|["']$/g, '') : null
}

function realSemanticNode(path: string): LiveSemanticNode | null {
  const lines = frontmatterLines(readFileSync(path, 'utf8'))
  if (!lines.length) return null
  const graphId = scalar(lines, 'graph_id') ?? scalar(lines, 'id')
  const status = scalar(lines, 'graph_status') ?? scalar(lines, 'status')
  if (!graphId || !['active', 'building'].includes(status ?? '')) return null
  const rel = relative(join(process.cwd(), '..', 'atlas-server'), path)
  return semanticNode({
    graph_id: graphId,
    graph_title: scalar(lines, 'graph_title') ?? scalar(lines, 'title') ?? graphId,
    graph_world: scalar(lines, 'graph_world') ?? 'atlas',
    graph_layer: scalar(lines, 'graph_layer') ?? 'semantic',
    graph_kind: scalar(lines, 'graph_kind') ?? scalar(lines, 'type') ?? 'module',
    graph_parent: scalar(lines, 'graph_parent'),
    graph_status: status,
    source_path: rel,
    summary: scalar(lines, 'summary') ?? rel,
  })
}

const realNodes = walkMarkdownFiles(repoDocsRoot)
  .map(realSemanticNode)
  .filter((item): item is LiveSemanticNode => Boolean(item))

const realGraph: LiveSemanticGraph = {
  worlds: Array.from(new Set(realNodes.map((node) => node.graph_world))),
  nodes: realNodes,
  hierarchy: {},
  relations: [],
}
const realHits = buildAllHits(undefined, undefined, realGraph)
const realCoverageGroups = buildCoverageGroups(realHits)
const realCoverageTotal = realCoverageGroups.reduce((sum, group) => sum + group.total, 0)
const realSemanticOnly = realCoverageGroups.reduce((sum, group) => sum + group.semanticOnly, 0)
const representedGraphIds = new Set(realHits.map((hit) => hit.graphId ?? hit.id))
const missingRealDocs = realNodes
  .map((node) => node.graph_id)
  .filter((graphId) => !representedGraphIds.has(graphId))

assert.deepEqual(
  missingRealDocs,
  [],
  'Every active/building repo graph_id must be represented by mobile search using graphId, even when the visible UI id differs',
)

assert.equal(
  realCoverageTotal,
  realHits.length,
  'Coverage map groups must account for every search hit so the UI cannot silently drop live documentation',
)

assert.ok(
  realSemanticOnly > 0,
  'Coverage map must expose semantic-only documentation count; otherwise the user cannot see how much documentation is reachable through graph drilldown/search',
)

console.log('cartografia search coverage tests passed')
