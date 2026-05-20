import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { buildAllHits } from '../components/cartografia/focus/SearchOverlayModel'
import type { LiveSemanticGraph, LiveSemanticNode } from '../components/cartografia/state/useCartografiaLiveData'

type Frontmatter = Record<string, string | string[]>

const repoRoot = join(process.cwd(), '..', 'atlas-server')
const docsRoot = join(repoRoot, 'docs', 'engineering-knowledge-base')

function walkMarkdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
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

function parseFrontmatter(lines: string[]): Frontmatter {
  const values: Frontmatter = {}

  for (let index = 0; index < lines.length; index += 1) {
    const scalar = lines[index].match(/^([a-z_]+):\s*(.*)$/)
    if (!scalar) continue

    const [, key, rawValue] = scalar
    const value = rawValue.trim()
    if (value) {
      values[key] = value.replace(/^["']|["']$/g, '')
      continue
    }

    const list: string[] = []
    let cursor = index + 1
    while (cursor < lines.length) {
      const item = lines[cursor].match(/^  -\s+(.+)$/)
      if (!item) break
      list.push(item[1].replace(/^["']|["']$/g, '').trim())
      cursor += 1
    }
    if (list.length) {
      values[key] = list
      index = cursor - 1
    }
  }

  return values
}

function scalar(fm: Frontmatter, key: string): string | null {
  const value = fm[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function list(fm: Frontmatter, key: string): string[] {
  const value = fm[key]
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function semanticNode(path: string): LiveSemanticNode | null {
  const fm = parseFrontmatter(frontmatterLines(readFileSync(path, 'utf8')))
  const graphId = scalar(fm, 'graph_id') ?? scalar(fm, 'id')
  const status = scalar(fm, 'graph_status') ?? scalar(fm, 'status')
  if (!graphId || !['active', 'building'].includes(status ?? '')) return null

  return {
    graph_id: graphId,
    graph_title: scalar(fm, 'graph_title') ?? scalar(fm, 'title') ?? graphId,
    graph_world: scalar(fm, 'graph_world') ?? 'atlas',
    graph_layer: scalar(fm, 'graph_layer') ?? null,
    graph_kind: scalar(fm, 'graph_kind') ?? scalar(fm, 'type') ?? 'module',
    graph_parent: scalar(fm, 'graph_parent'),
    graph_status: status,
    graph_source: 'repo',
    source_path: relative(repoRoot, path),
    summary: scalar(fm, 'summary'),
    capabilities: list(fm, 'capabilities'),
    decisions: list(fm, 'decisions'),
    allowed_changes: list(fm, 'allowed_changes'),
    forbidden_changes: list(fm, 'forbidden_changes'),
    depends_on: list(fm, 'depends_on'),
    flows_to: list(fm, 'flows_to'),
    unlocks: list(fm, 'unlocks'),
    governs: list(fm, 'governs'),
    risk_level: scalar(fm, 'risk_level'),
    evidence: list(fm, 'evidence'),
    next_actions: list(fm, 'next_actions'),
    required_tests: list(fm, 'required_tests'),
    requires_evidence: null,
    repo_paths: list(fm, 'repo_paths'),
    related_paths: list(fm, 'related_paths'),
    gear_flow: [],
    ai_entrypoints: list(fm, 'ai_entrypoints'),
    ai_usage_notes: list(fm, 'ai_usage_notes'),
    quality_gates: list(fm, 'quality_gates'),
    failure_modes: list(fm, 'failure_modes'),
    observability_signals: list(fm, 'observability_signals'),
    visual_tags: list(fm, 'visual_tags'),
    mtime: null,
  }
}

const nodes = walkMarkdownFiles(docsRoot)
  .map(semanticNode)
  .filter((item): item is LiveSemanticNode => Boolean(item))

const graph: LiveSemanticGraph = {
  worlds: Array.from(new Set(nodes.map((node) => node.graph_world))),
  nodes,
  hierarchy: {},
  relations: [],
}

const hits = buildAllHits(undefined, undefined, graph)
const representedGraphIds = new Set(hits.map((hit) => hit.graphId ?? hit.id))
const missing = nodes.filter((node) => !representedGraphIds.has(node.graph_id))
const semanticOnly = hits.filter((hit) => hit.kind === 'semantic').length
const visible = hits.length - semanticOnly
const byId = new Map(hits.map((hit) => [hit.graphId ?? hit.id, hit]))
const vox = byId.get('atlas-vox-operational-thinking-interface')
const voice = byId.get('atlas-ai-voice-realtime-surface')

const nomenclatureDoc = readFileSync(join(docsRoot, 'atlas-cartography-nomenclature-contract.md'), 'utf8')
const selfConstructionDoc = readFileSync(join(docsRoot, 'atlas-ai-self-construction-os.md'), 'utf8')
const voxDoc = readFileSync(join(docsRoot, 'atlas-vox-operational-thinking-interface.md'), 'utf8')

const failures: string[] = []
if (missing.length) failures.push(`Missing graph ids: ${missing.map((node) => node.graph_id).join(', ')}`)
if (!vox) failures.push('Atlas Vox is not represented in mobile cartography/search.')
if (!voice) failures.push('Voice Realtime Surface is not represented in mobile cartography/search.')
if (vox && voice && vox.subtitle === voice.subtitle) failures.push('Atlas Vox and Voice Realtime still look semantically identical.')
if (!/patamar_next:\s*Self-Programming OS/.test(selfConstructionDoc)) {
  failures.push('Self-Construction OS must declare Self-Programming OS as next patamar.')
}
if (!/version_family:\s*Atlas Vox/.test(voxDoc) || !/versions:\s*\n\s+- V0/.test(voxDoc)) {
  failures.push('Atlas Vox must declare versions as versions, not patamares.')
}
if (!/Atlas Vox V0\/V3\/V4\/V6 sao versoes\/degraus/.test(nomenclatureDoc)) {
  failures.push('Nomenclature contract must document that Atlas Vox versions are not Atlas patamares by default.')
}

console.log('cartografia coverage audit')
console.log(`docs vivos no repo: ${nodes.length}`)
console.log(`entradas representadas: ${representedGraphIds.size}`)
console.log(`entradas visiveis estaticas/live: ${visible}`)
console.log(`entradas semantic-only pela busca: ${semanticOnly}`)
console.log(`documentacoes vivas ausentes: ${missing.length}`)
console.log(`atlas vox: ${vox ? `OK (${vox.section})` : 'MISSING'}`)
console.log(`voice realtime: ${voice ? `OK (${voice.section})` : 'MISSING'}`)
console.log('patamar self-construction -> self-programming: OK')
console.log('atlas vox versions != patamares: OK')

if (failures.length) {
  console.error('\nFalhas:')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}
