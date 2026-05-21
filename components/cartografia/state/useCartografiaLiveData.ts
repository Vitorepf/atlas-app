/**
 * Cartografia · live data hook.
 *
 * Fetcha o graph real do backend (`GET /atlas-cartography/graph`) e
 * entrega à UI móvel. Polling de 30s quando online. Fallback: dados
 * estáticos de `atlasFlowData.ts` quando o servidor está off.
 *
 * Princípio canon: a documentação existe em UM lugar (o repositório).
 * A cartografia lê de lá via API. Se a API diz `missing_source: true`,
 * o mobile mostra vermelho. Sem intermediários.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet } from '../../../lib/api/client'
import {
  PIPELINE_STEPS,
  LANE_DEFINITIONS,
  type LaneDef,
  type LaneNode,
  type PipelineStep as StaticPipelineStep,
} from '../map/atlasFlowData'
import { displayText } from './cartografiaText'

// ────────────────────────────────────────────────────────────────────
// Tipos que espelham a resposta do backend `/api/atlas-cartography/graph`
// ────────────────────────────────────────────────────────────────────

export type GraphSource = 'repo' | 'vault' | 'mixed' | 'missing'

export interface LivePipelineStep {
  graph_id: string
  graph_order: number
  name: string
  deck: string | null
  graph_source: GraphSource
  source_path: string
  missing_source: boolean
  role: string | null
  input: string | null
  output: string | null
  depends_on: string[]
  unlocks: string[]
  evidence: string | string[] | null
  risks: string | string[] | null
  next_actions: string | string[] | null
  subs: Array<[string, string]>
  title: string | null
  patamar_current?: string | null
  patamar_next_of?: string | null
  patamar_next?: string | null
  patamar_after?: string[]
  version_family?: string | null
  versions?: string[]
  version_note?: string | null
  schema_version?: string | null
  gear_flow?: LiveGearFlowNode[]
}

export interface LiveGearFlowNode {
  graph_id: string
  target_graph_id?: string | null
  name: string
  kind: string
  summary: string
  status?: string | null
  source?: GraphSource | string | null
  source_path?: string | null
  input?: string | null
  output?: string | null
  risk?: string | null
  evidence?: string[]
  next_action?: string | null
  gear_flow?: LiveGearFlowNode[]
}

export interface LiveLateralNode {
  graph_id: string
  frontmatter_id?: string | null
  name: string
  deck: string | null
  graph_source: GraphSource
  source_path: string
  missing_source: boolean
  role: string | null
  input: string | null
  output: string | null
  depends_on: string[]
  unlocks: string[]
  evidence: string | string[] | null
  risks: string | string[] | null
  next_actions: string | string[] | null
  patamar_current?: string | null
  patamar_next_of?: string | null
  patamar_next?: string | null
  patamar_after?: string[]
  version_family?: string | null
  versions?: string[]
  version_note?: string | null
  schema_version?: string | null
}

export interface LiveLane {
  graph_id: string
  side: 'left' | 'right' | string
  name: string
  deck: string | null
  graph_source: GraphSource
  source_path: string
  missing_source: boolean
  role: string | null
  patamar_current?: string | null
  patamar_next_of?: string | null
  patamar_next?: string | null
  patamar_after?: string[]
  version_family?: string | null
  versions?: string[]
  version_note?: string | null
  schema_version?: string | null
  nodes: LiveLateralNode[]
}

export interface LiveSemanticNode {
  graph_id: string
  graph_title: string
  graph_world: string
  graph_layer: string | null
  graph_kind: string | null
  graph_parent: string | null
  graph_status: string | null
  graph_source: GraphSource
  human_summary?: string | null
  human_name?: string | null
  canonical_name?: string | null
  technical_name?: string | null
  product_name?: string | null
  runtime_acronym?: string | null
  internal_product_name?: string | null
  technical_runtime?: string | null
  cartography_type?: string | null
  canonical_source?: string | null
  layer?: string | null
  doc_schema?: string | null
  owner?: string | null
  category?: string | null
  priority?: number | string | null
  maintenance?: string[]
  line_limit?: number | string | null
  patamar_current?: string | null
  patamar_next_of?: string | null
  patamar_next?: string | null
  patamar_after?: string[]
  version_family?: string | null
  versions?: string[]
  version_note?: string | null
  schema_version?: string | null
  source_path: string
  summary: string | null
  capabilities: string[]
  decisions: string[]
  allowed_changes: string[]
  forbidden_changes: string[]
  depends_on: string[]
  flows_to: string[]
  unlocks: string[]
  governs: string[]
  risk_level: string | null
  evidence: string[]
  next_actions: string[]
  required_tests: string[]
  requires_evidence: boolean | string | null
  repo_paths: string[]
  related_paths: string[]
  gear_flow?: LiveGearFlowNode[]
  ai_entrypoints: string[]
  ai_usage_notes: string[]
  quality_gates: string[]
  failure_modes: string[]
  observability_signals: string[]
  visual_tags: string[]
  mtime: number | null
}

export interface LiveSemanticGraph {
  worlds: string[]
  nodes: LiveSemanticNode[]
  hierarchy: Record<string, string[]>
  relations: Array<{ from: string; to: string; kind: string }>
}

export interface LiveGraphAudit {
  found: number
  missing: number
  orphan_count: number
  semantic_node_count: number
  semantic_relation_count: number
}

export interface CartographyGraphResponse {
  audit: LiveGraphAudit
  pipeline: LivePipelineStep[]
  lanes: LiveLane[] | Record<string, LiveLane>
  connections: Array<{ from: string; to: string; kind: string }>
  semantic_graph: LiveSemanticGraph | null
  checksum: string | null
  human_clarity_contract?: {
    human_clarity?: {
      schema_version?: string
      status?: string
      score?: number
      target_score?: number
      grade?: string
      invariants?: Record<string, boolean>
    }
    writes?: boolean
  } | null
}

// ────────────────────────────────────────────────────────────────────
// Adaptador live → formato estático (para componentes existentes)
// ────────────────────────────────────────────────────────────────────

/** Converte um LivePipelineStep em algo compatível com o PipelineStep estático,
 *  acrescido dos campos live (graph_source, missing_source, etc.). */
export interface AdaptedPipelineStep extends StaticPipelineStep {
  graphSource: GraphSource
  sourcePath: string
  missingSource: boolean
  graphId: string
  // Ficha fields
  input: string | null
  output: string | null
  dependsOn: string[]
  unblocks: string[]
  evidence: string | null
  risk: string | null
  nextAction: string | null
  patamarCurrent?: string | null
  patamarNextOf?: string | null
  patamarNext?: string | null
  patamarAfter?: string[]
  versionFamily?: string | null
  versions?: string[]
  versionNote?: string | null
  schemaVersion?: string | null
  gearFlow: LiveGearFlowNode[]
}

export interface AdaptedLaneNode extends LaneNode {
  /** Identidade canônica da documentação real que explica este node. */
  graphId: string
  /** Identidade visual/canônica da peça lateral no mapa. */
  visualGraphId: string
  deck: string
  graphSource: GraphSource
  sourcePath: string
  missingSource: boolean
  patamarCurrent?: string | null
  patamarNextOf?: string | null
  patamarNext?: string | null
  patamarAfter?: string[]
  versionFamily?: string | null
  versions?: string[]
  versionNote?: string | null
  schemaVersion?: string | null
}

export interface AdaptedLane extends LaneDef {
  graphId: string
  graphSource: GraphSource
  sourcePath: string
  missingSource: boolean
  role: string | null
  patamarCurrent?: string | null
  patamarNextOf?: string | null
  patamarNext?: string | null
  patamarAfter?: string[]
  versionFamily?: string | null
  versions?: string[]
  versionNote?: string | null
  schemaVersion?: string | null
  nodes: ReadonlyArray<AdaptedLaneNode>
}

export interface AdaptedConnection {
  from: string
  to: string
  kind: string
  fromGraphId: string
  toGraphId: string
}

const PHASE_BY_ORDER: Record<number, StaticPipelineStep['phase']> = {
  1: 'intake', 2: 'intake', 3: 'intake',
  4: 'shape', 5: 'shape', 6: 'shape', 7: 'shape', 8: 'shape',
  9: 'decide', 10: 'decide', 11: 'decide', 12: 'decide',
  13: 'prove', 14: 'prove', 15: 'prove',
  16: 'render', 17: 'render',
}

function adaptLivePipelineStep(live: LivePipelineStep): AdaptedPipelineStep {
  // Try to find the matching static step for phase/hero/subs fallback
  const staticMatch = PIPELINE_STEPS.find(
    (s) => s.num === live.graph_order || s.name === live.name,
  )
  return {
    num: live.graph_order,
    id: `pipe-${live.graph_order}`,
    name: live.name,
    deck: live.deck ?? '',
    phase: PHASE_BY_ORDER[live.graph_order] ?? staticMatch?.phase ?? 'shape',
    hero: live.graph_id === 'atlas-decide' || staticMatch?.hero === true,
    subs: live.subs?.map(([name]) => name) ?? staticMatch?.subs ?? [],
    // Live-only fields
    graphSource: live.graph_source ?? 'repo',
    sourcePath: live.source_path ?? '',
    missingSource: live.missing_source ?? false,
    graphId: live.graph_id,
    input: live.input,
    output: live.output,
    dependsOn: live.depends_on ?? [],
    unblocks: live.unlocks ?? [],
    evidence: displayText(live.evidence),
    risk: displayText(live.risks),
    nextAction: displayText(live.next_actions),
    patamarCurrent: live.patamar_current,
    patamarNextOf: live.patamar_next_of,
    patamarNext: live.patamar_next,
    patamarAfter: live.patamar_after,
    versionFamily: live.version_family,
    versions: live.versions,
    versionNote: live.version_note,
    schemaVersion: live.schema_version,
    gearFlow: live.gear_flow ?? [],
  }
}

const LANE_LAYOUT_BY_GRAPH_ID: Record<string, string> = {
  'domain-plane': 'lane-domain',
  capabilities: 'lane-cap',
  'business-context-side': 'lane-biz',
  hks: 'lane-hks',
  'evidence-loop': 'lane-evi',
  'doc-os': 'lane-doc',
}

function normalizeLanes(lanes: CartographyGraphResponse['lanes'] | null | undefined): LiveLane[] {
  if (!lanes) return []
  return Array.isArray(lanes) ? lanes : Object.values(lanes)
}

function normalizeAudit(audit: Partial<LiveGraphAudit> | Record<string, unknown> | null | undefined): LiveGraphAudit {
  const raw = audit as Record<string, unknown> | null | undefined
  return {
    found: Number(raw?.found ?? raw?.pieces_found ?? 0),
    missing: Number(raw?.missing ?? raw?.pieces_missing ?? 0),
    orphan_count: Number(raw?.orphan_count ?? 0),
    semantic_node_count: Number(raw?.semantic_node_count ?? 0),
    semantic_relation_count: Number(raw?.semantic_relation_count ?? 0),
  }
}

function buildFallbackLanes(): AdaptedLane[] {
  return LANE_DEFINITIONS.map((lane) => ({
    ...lane,
    graphId: lane.id,
    graphSource: 'repo' as GraphSource,
    sourcePath: '',
    missingSource: false,
    role: null,
    nodes: lane.nodes.map((node) => ({
      ...node,
      graphId: node.id,
      visualGraphId: node.id,
      deck: '',
      graphSource: 'repo' as GraphSource,
      sourcePath: '',
      missingSource: false,
    })),
  }))
}

function adaptLiveLanes(
  liveLanes: LiveLane[],
  steps: AdaptedPipelineStep[],
  connections: Array<{ from: string; to: string; kind: string }>,
): AdaptedLane[] {
  const stepUiByGraphId = new Map(steps.map((step) => [step.graphId, step.id]))
  const usedLayouts = new Set<string>()

  return liveLanes.map((lane, index) => {
    const layoutId = LANE_LAYOUT_BY_GRAPH_ID[lane.graph_id]
    const layout =
      LANE_DEFINITIONS.find((item) => item.id === layoutId) ??
      LANE_DEFINITIONS.find((item) => !usedLayouts.has(item.id)) ??
      LANE_DEFINITIONS[index % LANE_DEFINITIONS.length]

    usedLayouts.add(layout.id)

    const laneNodeIds = new Set(lane.nodes.map((node) => node.graph_id))
    const feed = connections.find((connection) => {
      const fromLane = connection.from === lane.graph_id || laneNodeIds.has(connection.from)
      return fromLane && stepUiByGraphId.has(connection.to)
    })
    const feedsInto = feed ? stepUiByGraphId.get(feed.to) : layout.feedsInto

    return {
      ...layout,
      id: layout.id,
      graphId: lane.graph_id,
      name: lane.name,
      deck: lane.deck ?? layout.deck,
      side: layout.side,
      feedsInto,
      feedback: feed?.kind === 'feedback' || (lane.graph_id === 'evidence-loop' ? true : layout.feedback),
      graphSource: lane.graph_source ?? 'repo',
      sourcePath: lane.source_path ?? '',
      missingSource: lane.missing_source ?? false,
      role: lane.role ?? null,
      patamarCurrent: lane.patamar_current,
      patamarNextOf: lane.patamar_next_of,
      patamarNext: lane.patamar_next,
      patamarAfter: lane.patamar_after,
      versionFamily: lane.version_family,
      versions: lane.versions,
      versionNote: lane.version_note,
      schemaVersion: lane.schema_version,
      nodes: lane.nodes.map((node) => ({
        id: node.graph_id,
        graphId: node.frontmatter_id ?? node.graph_id,
        visualGraphId: node.graph_id,
        name: node.name,
        deck: node.deck ?? '',
        graphSource: node.graph_source ?? 'repo',
        sourcePath: node.source_path ?? '',
        missingSource: node.missing_source ?? false,
        patamarCurrent: node.patamar_current,
        patamarNextOf: node.patamar_next_of,
        patamarNext: node.patamar_next,
        patamarAfter: node.patamar_after,
        versionFamily: node.version_family,
        versions: node.versions,
        versionNote: node.version_note,
        schemaVersion: node.schema_version,
      })),
    }
  })
}

function adaptConnections(
  rawConnections: Array<{ from: string; to: string; kind: string }>,
  steps: AdaptedPipelineStep[],
  lanes: AdaptedLane[],
): AdaptedConnection[] {
  const stepUiByGraphId = new Map(steps.map((step) => [step.graphId, step.id]))
  const laneUiByGraphId = new Map(lanes.map((lane) => [lane.graphId, lane.id]))
  const laneUiByChildGraphId = new Map<string, string>()
  lanes.forEach((lane) => {
    lane.nodes.forEach((node) => laneUiByChildGraphId.set(node.graphId, lane.id))
  })

  const toUi = (graphId: string) =>
    stepUiByGraphId.get(graphId) ??
    laneUiByGraphId.get(graphId) ??
    laneUiByChildGraphId.get(graphId) ??
    graphId

  return rawConnections.map((connection) => ({
    from: toUi(connection.from),
    to: toUi(connection.to),
    kind: connection.kind,
    fromGraphId: connection.from,
    toGraphId: connection.to,
  }))
}

// ────────────────────────────────────────────────────────────────────
// Dados adaptados completos do graph live
// ────────────────────────────────────────────────────────────────────

export interface CartografiaLiveData {
  /** Steps adaptados para uso em FlowScene/PipelineAtom */
  steps: AdaptedPipelineStep[]
  /** Semantic graph completo (para hierarchy drilldown, status lookup) */
  semanticGraph: LiveSemanticGraph | null
  /** Lanes adaptadas para a geometria mobile, com conteúdo real da API */
  lanes: AdaptedLane[]
  /** Conexões canônicas da API com endpoints resolvidos para ids da UI */
  connections: AdaptedConnection[]
  /** Audit do graph */
  audit: LiveGraphAudit | null
  /** Score de clareza visual humana vindo do contrato AURC */
  humanClarityScore: number | null
  /** Contagem de lanes */
  laneCount: number
  /** Indica se os dados são live (API) ou fallback (estáticos) */
  isLive: boolean
  /** Loading state */
  loading: boolean
  /** Último erro (se houver) */
  error: string | null
}

// ────────────────────────────────────────────────────────────────────
// Cache e polling
// ────────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000

let cachedResponse: CartographyGraphResponse | null = null
let cachedChecksum: string | null = null
let cachedAdaptedSteps: AdaptedPipelineStep[] | null = null
let cachedAdaptedLanes: AdaptedLane[] | null = null
let cachedAdaptedConnections: AdaptedConnection[] | null = null

function buildFallbackSteps(): AdaptedPipelineStep[] {
  return PIPELINE_STEPS.map((s) => ({
    ...s,
    graphSource: 'repo' as GraphSource,
    sourcePath: '',
    missingSource: false,
    graphId: `pipe-${s.num}`,
    input: null,
    output: null,
    dependsOn: [],
    unblocks: [],
    evidence: null,
    risk: null,
    nextAction: null,
    gearFlow: [],
  }))
}

// ────────────────────────────────────────────────────────────────────
// Hook principal
// ────────────────────────────────────────────────────────────────────

export function useCartografiaLiveData(): CartografiaLiveData {
  const [steps, setSteps] = useState<AdaptedPipelineStep[]>(
    () => cachedAdaptedSteps ?? buildFallbackSteps(),
  )
  const [semanticGraph, setSemanticGraph] = useState<LiveSemanticGraph | null>(
    () => cachedResponse?.semantic_graph ?? null,
  )
  const [lanes, setLanes] = useState<AdaptedLane[]>(
    () => cachedAdaptedLanes ?? buildFallbackLanes(),
  )
  const [connections, setConnections] = useState<AdaptedConnection[]>(
    () => cachedAdaptedConnections ?? [],
  )
  const [audit, setAudit] = useState<LiveGraphAudit | null>(
    () => cachedResponse?.audit ? normalizeAudit(cachedResponse.audit) : null,
  )
  const [humanClarityScore, setHumanClarityScore] = useState<number | null>(
    () => cachedResponse?.human_clarity_contract?.human_clarity?.score ?? null,
  )
  const [laneCount, setLaneCount] = useState(
    () => cachedAdaptedLanes?.length ?? LANE_DEFINITIONS.length,
  )
  const [isLive, setIsLive] = useState(() => cachedResponse !== null)
  const [loading, setLoading] = useState(() => cachedResponse === null)
  const [error, setError] = useState<string | null>(null)
  const cancelledRef = useRef(false)

  const refresh = useCallback(async () => {
    try {
      const response = await apiGet<{ views?: Record<string, CartographyGraphResponse> } & CartographyGraphResponse>(
        '/atlas-cartography/graph',
      )

      if (cancelledRef.current) return

      // O backend pode retornar o graph dentro de `views['atlas-ai-kernel']`
      // ou diretamente no root. Adaptamos ambos os formatos.
      const graph: CartographyGraphResponse = response.views?.['atlas-ai-kernel']
        ? {
            pipeline: response.views['atlas-ai-kernel'].pipeline ?? [],
            lanes: response.views['atlas-ai-kernel'].lanes ?? {},
            connections: response.views['atlas-ai-kernel'].connections ?? [],
            semantic_graph: response.semantic_graph ?? null,
            audit: normalizeAudit(response.audit),
            checksum: response.checksum ?? null,
            human_clarity_contract: response.human_clarity_contract ?? null,
          }
        : response

      // Cheap diff: skip update if checksum hasn't changed
      if (graph.checksum && graph.checksum === cachedChecksum) {
        return
      }

      cachedChecksum = graph.checksum
      cachedResponse = graph

      const adapted = graph.pipeline.map(adaptLivePipelineStep).sort((a, b) => a.num - b.num)
      const rawLanes = normalizeLanes(graph.lanes)
      const adaptedLanes = adaptLiveLanes(rawLanes, adapted, graph.connections ?? [])
      const adaptedConnections = adaptConnections(graph.connections ?? [], adapted, adaptedLanes)
      cachedAdaptedSteps = adapted
      cachedAdaptedLanes = adaptedLanes
      cachedAdaptedConnections = adaptedConnections

      setSteps(adapted)
      setLanes(adaptedLanes)
      setConnections(adaptedConnections)
      setSemanticGraph(graph.semantic_graph)
      setAudit(normalizeAudit(graph.audit))
      setHumanClarityScore(graph.human_clarity_contract?.human_clarity?.score ?? null)
      setLaneCount(adaptedLanes.length)
      setIsLive(true)
      setError(null)
    } catch (err) {
      if (!cancelledRef.current) {
        setError(String(err))
        // Keep existing data (cached or fallback) — never blank the screen
      }
    }
  }, [])

  useEffect(() => {
    cancelledRef.current = false

    void refresh().finally(() => {
      if (!cancelledRef.current) setLoading(false)
    })

    const pollId = setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelledRef.current = true
      clearInterval(pollId)
    }
  }, [refresh])

  return { steps, semanticGraph, lanes, connections, audit, humanClarityScore, laneCount, isLive, loading, error }
}

// ────────────────────────────────────────────────────────────────────
// Utilidade: buscar SemanticNode por graph_id
// ────────────────────────────────────────────────────────────────────

export function findSemanticNode(
  semanticGraph: LiveSemanticGraph | null,
  graphId: string,
): LiveSemanticNode | undefined {
  return semanticGraph?.nodes.find((n) => n.graph_id === graphId)
}

/** Retorna filhos diretos de um node no hierarchy */
export function getChildrenIds(
  semanticGraph: LiveSemanticGraph | null,
  graphId: string,
): string[] {
  return semanticGraph?.hierarchy[graphId] ?? []
}
