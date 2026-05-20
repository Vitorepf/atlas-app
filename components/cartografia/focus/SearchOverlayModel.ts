import { UNIVERSE_CONTINENTS } from '../map/layout'
import {
  LANE_DEFINITIONS,
  PIPELINE_STEPS,
  type FlowPhase,
  type LaneDef,
  type PipelineStep,
} from '../map/atlasFlowData'
import { CONTINENT_SCENES, type NodeKind } from '../map/continentNodes'
import type { LiveSemanticGraph, LiveSemanticNode } from '../state/useCartografiaLiveData'

export interface SearchHit {
  id: string
  /** graph_id real da documentação, quando o id visual da UI é diferente */
  graphId?: string
  name: string
  /** Seção (Mono caps eyebrow) */
  section: string
  /** Subtítulo (italic small) */
  subtitle: string
  /** Tipo · determina ação de tap */
  kind: 'continent' | 'pipeline' | 'lane-node' | 'continent-node' | 'semantic'
  /** ID do continent pai (pra navegar) */
  continentId?: string
  /** Glyph hint pra renderização visual */
  phase?: FlowPhase
  nodeKind?: NodeKind
}

export interface SearchCoverageGroup {
  section: string
  total: number
  visible: number
  semanticOnly: number
  primaryGraphId?: string
  sampleNames: string[]
}

export function semanticKindToNodeKind(kind: string | null | undefined): NodeKind {
  switch (kind) {
    case 'contract':
    case 'adr':
    case 'policy':
      return 'gates'
    case 'flow':
    case 'step':
      return 'gear'
    case 'surface':
    case 'screen':
      return 'spark'
    case 'system':
    case 'index':
      return 'pillar'
    default:
      return 'tag'
  }
}

export function semanticSectionFor(node: LiveSemanticNode): string {
  const world = node.graph_world ? node.graph_world.toUpperCase() : 'DOC'
  const layer = node.graph_layer ? node.graph_layer.toUpperCase() : 'SEMÂNTICO'
  return `${world} · ${layer}`
}

export function buildCoverageGroups(hits: ReadonlyArray<SearchHit>): SearchCoverageGroup[] {
  const bySection = new Map<string, SearchCoverageGroup>()

  hits.forEach((hit) => {
    const current = bySection.get(hit.section) ?? {
      section: hit.section,
      total: 0,
      visible: 0,
      semanticOnly: 0,
      primaryGraphId: hit.graphId ?? hit.id,
      sampleNames: [],
    }

    current.total += 1
    if (hit.kind === 'semantic') {
      current.semanticOnly += 1
    } else {
      current.visible += 1
    }
    if (current.sampleNames.length < 3) current.sampleNames.push(hit.name)
    if (!current.primaryGraphId) current.primaryGraphId = hit.graphId ?? hit.id
    bySection.set(hit.section, current)
  })

  return Array.from(bySection.values())
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return a.section.localeCompare(b.section)
    })
}

export function buildAllHits(
  pipelineSteps: ReadonlyArray<PipelineStep> = PIPELINE_STEPS,
  lanes: ReadonlyArray<LaneDef> = LANE_DEFINITIONS,
  semanticGraph?: LiveSemanticGraph | null,
): SearchHit[] {
  const hits: SearchHit[] = []
  const staticIds = new Set<string>()
  const semanticById = new Map((semanticGraph?.nodes ?? []).map((node) => [node.graph_id, node]))
  const semanticFor = (graphId: unknown) => typeof graphId === 'string' ? semanticById.get(graphId) : undefined
  // 6 continents
  UNIVERSE_CONTINENTS.forEach((cont) => {
    staticIds.add(cont.id)
    hits.push({
      id: cont.id,
      graphId: cont.id,
      name: cont.name,
      section: 'CONTINENTE',
      subtitle: cont.deck,
      kind: 'continent',
    })
  })
  // Pipeline steps
  pipelineSteps.forEach((step) => {
    staticIds.add(step.id)
    if ('graphId' in step && typeof step.graphId === 'string') staticIds.add(step.graphId)
    const semanticNode = semanticFor('graphId' in step ? step.graphId : undefined)
    hits.push({
      id: step.id,
      graphId: 'graphId' in step && typeof step.graphId === 'string' ? step.graphId : step.id,
      name: semanticNode?.graph_title ?? step.name,
      section: semanticNode ? semanticSectionFor(semanticNode) : `ATLAS · ${step.phase.toUpperCase()}`,
      subtitle: semanticNode?.summary ?? step.deck,
      kind: 'pipeline',
      phase: step.phase,
    })
  })
  // Lane nodes
  lanes.forEach((lane) => {
    if ('graphId' in lane && typeof lane.graphId === 'string') staticIds.add(lane.graphId)
    lane.nodes.forEach((node) => {
      staticIds.add(node.id)
      if ('graphId' in node && typeof node.graphId === 'string') staticIds.add(node.graphId)
      const semanticNode = semanticFor('graphId' in node ? node.graphId : undefined)
      hits.push({
        id: node.id,
        graphId: 'graphId' in node && typeof node.graphId === 'string' ? node.graphId : node.id,
        name: semanticNode?.graph_title ?? node.name,
        section: semanticNode ? semanticSectionFor(semanticNode) : `ATLAS · ${lane.name}`,
        subtitle: semanticNode?.summary ?? lane.deck,
        kind: 'lane-node',
      })
    })
  })
  // Continent radial nodes
  CONTINENT_SCENES.forEach((scene) => {
    const cont = UNIVERSE_CONTINENTS.find((c) => c.id === scene.continentId)
    scene.nodes.forEach((node) => {
      staticIds.add(node.id)
      if (node.graphId) staticIds.add(node.graphId)
      const semanticNode = semanticFor(node.graphId)
      hits.push({
        id: node.graphId ?? node.id,
        graphId: node.graphId ?? node.id,
        name: semanticNode?.graph_title ?? node.name,
        section: semanticNode ? semanticSectionFor(semanticNode) : (cont?.name ?? scene.continentId).toUpperCase(),
        subtitle: semanticNode?.summary ?? node.deck,
        kind: 'continent-node',
        continentId: scene.continentId,
        nodeKind: semanticNode ? semanticKindToNodeKind(semanticNode.graph_kind) : node.kind,
      })
    })
  })

  semanticGraph?.nodes.forEach((node) => {
    if (staticIds.has(node.graph_id)) return
    hits.push({
      id: node.graph_id,
      graphId: node.graph_id,
      name: node.graph_title,
      section: semanticSectionFor(node),
      subtitle: node.summary ?? node.source_path ?? node.graph_id,
      kind: 'semantic',
      continentId: node.graph_world === 'atlas' ? 'atlas' : undefined,
      nodeKind: semanticKindToNodeKind(node.graph_kind),
    })
  })
  return hits
}
