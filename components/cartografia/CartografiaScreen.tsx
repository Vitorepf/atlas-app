/**
 * Cartografia · composition root.
 *
 * Mapa vivo do Atlas. Canvas único pan/zoom · cenas alternam por
 * navegação (universe → flow → gear → subflow).
 *
 * Princípio canon: a imagem ensina. Sem TOC, sem lista, sem drilldown
 * textual. Zoom é o drilldown.
 */
import { useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn } from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import Svg, { Circle, Path } from 'react-native-svg'
import { Frau, Mono } from '../../design/Type'
import { ContinentGlyph } from './map/ContinentGlyph'
import { useTheme, usePalette } from '../../design/theme'
import { CartographyWorld } from './map/CartographyWorld'
import { UniverseScene } from './scenes/UniverseScene'
import { FlowScene } from './scenes/FlowScene'
import { ContinentRadialScene } from './scenes/ContinentRadialScene'
import { GearFlowScene } from './scenes/GearFlowScene'
import { OnboardingHint } from './floaters/OnboardingHint'
import { CanvasVignette } from './floaters/CanvasVignette'
import { SearchOverlay, type SearchHit } from './focus/SearchOverlay'
import { GearInfoModal, type GearInfo } from './focus/GearInfoModal'
import {
  LANE_DEFINITIONS,
  PIPELINE_STEPS,
  PIPELINE_X,
  PIPELINE_Y,
  PIPELINE_WIDTH,
  type LaneDef,
} from './map/atlasFlowData'
import { useCartografiaViewport } from './viewport/useCartografiaViewport'
import { useCartografiaNavigation } from './state/useCartografiaNavigation'
import { UNIVERSE_CONTINENTS } from './map/layout'
import { CONTINENT_SCENES, type ContinentNode } from './map/continentNodes'
import {
  findSemanticNode,
  useCartografiaLiveData,
  type AdaptedLane,
  type AdaptedLaneNode,
  type AdaptedPipelineStep,
  type LiveGearFlowNode,
} from './state/useCartografiaLiveData'
import {
  pipelineTerminalFlow,
  subsToGearFlow,
  visualFlowForGraphNode,
} from './state/cartografiaVisualSubflow'

type VisualSubflow = {
  id: string
  parentStep: AdaptedPipelineStep
  flow: LiveGearFlowNode[]
}

type GearInfoState = {
  items: GearInfo[]
  index: number
}

const ATLAS_FLOW_FOCUS = {
  x: 180,
  y: PIPELINE_Y - 140,
  w: 2000,
  h: 2000,
}

function focusScaleForAtlasFlow(stepCount: number): number {
  return stepCount > 20 ? 0.34 : 0.38
}

function focusScaleForSubflow(count: number): number {
  if (count <= 4) return 0.84
  if (count <= 8) return 0.68
  if (count <= 14) return 0.54
  return 0.42
}

function subflowFocusRectForCount(count: number): { x: number; y: number; w: number; h: number } {
  const safeCount = Math.max(1, count)
  const estimatedNodeH = 110
  const estimatedStackH = safeCount * estimatedNodeH + Math.max(0, safeCount - 1) * 12
  const h = Math.min(2240, Math.max(1220, estimatedStackH + 340))
  return {
    x: 620,
    y: Math.max(120, 1300 - h / 2),
    w: 1580,
    h,
  }
}

function focusSubflow(viewport: ReturnType<typeof useCartografiaViewport>, count: number): void {
  viewport.focusOnRect(subflowFocusRectForCount(count), focusScaleForSubflow(count))
}

export default function CartografiaScreen() {
  const c = usePalette()
  const { name: themeName } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const viewport = useCartografiaViewport()
  const nav = useCartografiaNavigation()
  const liveData = useCartografiaLiveData()
  const [searchOpen, setSearchOpen] = useState(false)
  const [subflowCount, setSubflowCount] = useState(0)
  const [visualSubflow, setVisualSubflow] = useState<VisualSubflow | null>(null)
  const [gearInfoState, setGearInfoState] = useState<GearInfoState | null>(null)

  // Use live steps para navegação quando disponíveis
  const activeSteps = liveData.isLive ? liveData.steps : PIPELINE_STEPS
  const activeLanes = liveData.isLive ? liveData.lanes : LANE_DEFINITIONS
  const semanticGraph = liveData.semanticGraph
  const continentNodeById = useMemo(() => {
    const nodes = new Map<string, { node: ContinentNode; continentId: string }>()
    CONTINENT_SCENES.forEach((scene) => {
      scene.nodes.forEach((node) => {
        const value = { node, continentId: scene.continentId }
        nodes.set(node.id, value)
        if (node.graphId) nodes.set(node.graphId, value)
      })
    })
    return nodes
  }, [])
  const laneNodeByGraphId = useMemo(() => {
    const nodes = new Map<string, AdaptedLaneNode>()
    liveData.lanes.forEach((lane) => {
      lane.nodes.forEach((node) => {
        const adapted = node as AdaptedLaneNode
        nodes.set(adapted.graphId, adapted)
        nodes.set(adapted.visualGraphId ?? adapted.id, adapted)
        nodes.set(adapted.id, adapted)
      })
    })
    return nodes
  }, [liveData.lanes])
  const buildSemanticFlow = useCallback(
    (graphId: string) => visualFlowForGraphNode(semanticGraph, graphId),
    [semanticGraph],
  )
  const openGearInfo = useCallback((info: GearInfo, items?: GearInfo[], index = 0) => {
    const sequence = items?.length ? items : [info]
    const safeIndex = Math.max(0, Math.min(index, sequence.length - 1))
    setGearInfoState({ items: sequence, index: safeIndex })
  }, [])
  const onSubflowActiveCountChange = useCallback((count: number) => {
    setSubflowCount(count)
    setTimeout(() => focusSubflow(viewport, count), 60)
  }, [viewport])

  const openVisualSubflow = useCallback((source: AdaptedPipelineStep) => {
    const graphId = source.graphId ?? source.id
    const semanticFlow = buildSemanticFlow(graphId)
    const flow = semanticFlow.length
      ? semanticFlow
      : source.gearFlow ?? []
    const fallbackFlow: LiveGearFlowNode[] = flow.length
      ? flow
      : subsToGearFlow({ graphId, phase: source.phase, deck: source.deck, subs: source.subs })

    const honestFlow = fallbackFlow.length
      ? fallbackFlow
      : pipelineTerminalFlow({
          graphId,
          name: source.name,
          phase: source.phase,
          deck: source.deck,
          source: source.graphSource,
          sourcePath: source.sourcePath,
          missingSource: source.missingSource,
          input: source.input,
          output: source.output,
          evidence: source.evidence,
          risk: source.risk,
          nextAction: source.nextAction,
        })

    setVisualSubflow({ id: source.id, parentStep: source, flow: honestFlow })
    setSubflowCount(honestFlow.length)
    nav.enterSubflow(source.id)
    setTimeout(() => focusSubflow(viewport, honestFlow.length), 80)
    return true
  }, [buildSemanticFlow, nav, viewport])

  const semanticSubflowByGraphId = useCallback((graphId: string): VisualSubflow | null => {
    const semanticNode = findSemanticNode(liveData.semanticGraph, graphId)
    if (!semanticNode) return null
    const flow = buildSemanticFlow(graphId)
    if (!flow.length) return null
    const parentStep: AdaptedPipelineStep = {
      num: 0,
      id: graphId,
      name: semanticNode.graph_title,
      deck: semanticNode.summary ?? semanticNode.graph_layer ?? semanticNode.graph_world,
      phase: 'shape',
      graphSource: semanticNode.graph_source,
      sourcePath: semanticNode.source_path,
      missingSource: semanticNode.graph_source === 'missing',
      graphId: semanticNode.graph_id,
      input: null,
      output: null,
      dependsOn: semanticNode.depends_on,
      unblocks: semanticNode.unlocks,
      evidence: semanticNode.evidence[0] ?? null,
      risk: semanticNode.risk_level,
      nextAction: semanticNode.next_actions[0] ?? null,
      gearFlow: flow,
    }
    return { id: graphId, parentStep, flow }
  }, [buildSemanticFlow, liveData.semanticGraph])

  const infoFromStep = useCallback((source: AdaptedPipelineStep): GearInfo => {
    const semanticNode = findSemanticNode(liveData.semanticGraph, source.graphId)
    const semanticFlow = buildSemanticFlow(source.graphId)
    const flow = semanticFlow.length ? semanticFlow : source.gearFlow ?? []
    return {
      graphId: source.graphId,
      title: source.name,
      subtitle: source.deck,
      humanSummary: semanticNode?.human_summary,
      humanName: semanticNode?.human_name,
      canonicalName: semanticNode?.canonical_name,
      technicalName: semanticNode?.technical_name,
      productName: semanticNode?.product_name,
      runtimeAcronym: semanticNode?.runtime_acronym,
      internalProductName: semanticNode?.internal_product_name,
      technicalRuntime: semanticNode?.technical_runtime,
      cartographyType: semanticNode?.cartography_type,
      canonicalSource: semanticNode?.canonical_source,
      kind: source.phase,
      status: semanticNode?.graph_status ?? (source.missingSource ? 'missing' : 'active'),
      source: source.graphSource,
      world: semanticNode?.graph_world,
      layer: semanticNode?.layer,
      graphLayer: semanticNode?.graph_layer,
      parent: semanticNode?.graph_parent,
      owner: semanticNode?.owner,
      category: semanticNode?.category,
      priority: semanticNode?.priority,
      docSchema: semanticNode?.doc_schema,
      maintenance: semanticNode?.maintenance,
      lineLimit: semanticNode?.line_limit,
      patamarCurrent: semanticNode?.patamar_current ?? source.patamarCurrent,
      patamarNextOf: semanticNode?.patamar_next_of ?? source.patamarNextOf,
      patamarNext: semanticNode?.patamar_next ?? source.patamarNext,
      patamarAfter: semanticNode?.patamar_after ?? source.patamarAfter,
      versionFamily: semanticNode?.version_family ?? source.versionFamily,
      versions: semanticNode?.versions ?? source.versions,
      versionNote: semanticNode?.version_note ?? source.versionNote,
      schemaVersion: semanticNode?.schema_version ?? source.schemaVersion,
      sourcePath: source.sourcePath || semanticNode?.source_path,
      input: source.input,
      output: source.output,
      risk: source.risk,
      evidence: source.evidence ? [source.evidence] : semanticNode?.evidence,
      nextAction: source.nextAction,
      childrenCount: flow.length || source.subs?.length || 0,
      dependsOn: semanticNode?.depends_on ?? source.dependsOn,
      flowsTo: semanticNode?.flows_to ?? [],
      unlocks: semanticNode?.unlocks ?? source.unblocks,
      governs: semanticNode?.governs ?? [],
      repoPaths: semanticNode?.repo_paths,
      relatedPaths: semanticNode?.related_paths,
      capabilities: semanticNode?.capabilities,
      decisions: semanticNode?.decisions,
      allowedChanges: semanticNode?.allowed_changes,
      forbiddenChanges: semanticNode?.forbidden_changes,
      requiredTests: semanticNode?.required_tests,
      qualityGates: semanticNode?.quality_gates,
      failureModes: semanticNode?.failure_modes,
      observabilitySignals: semanticNode?.observability_signals,
      aiEntryPoints: semanticNode?.ai_entrypoints,
      aiUsageNotes: semanticNode?.ai_usage_notes,
      visualTags: semanticNode?.visual_tags,
      requiresEvidence: semanticNode?.requires_evidence,
    }
  }, [buildSemanticFlow, liveData.semanticGraph])

  const infoFromSemanticId = useCallback((graphId: string): GearInfo | null => {
    const semanticNode = findSemanticNode(liveData.semanticGraph, graphId)
    if (!semanticNode) return null
    return {
      graphId: semanticNode.graph_id,
      title: semanticNode.graph_title,
      subtitle: semanticNode.summary ?? semanticNode.graph_layer ?? semanticNode.graph_world,
      humanSummary: semanticNode.human_summary,
      humanName: semanticNode.human_name,
      canonicalName: semanticNode.canonical_name,
      technicalName: semanticNode.technical_name,
      productName: semanticNode.product_name,
      runtimeAcronym: semanticNode.runtime_acronym,
      internalProductName: semanticNode.internal_product_name,
      technicalRuntime: semanticNode.technical_runtime,
      cartographyType: semanticNode.cartography_type,
      canonicalSource: semanticNode.canonical_source,
      kind: semanticNode.graph_kind,
      status: semanticNode.graph_status,
      source: semanticNode.graph_source,
      world: semanticNode.graph_world,
      layer: semanticNode.layer,
      graphLayer: semanticNode.graph_layer,
      parent: semanticNode.graph_parent,
      owner: semanticNode.owner,
      category: semanticNode.category,
      priority: semanticNode.priority,
      docSchema: semanticNode.doc_schema,
      maintenance: semanticNode.maintenance,
      lineLimit: semanticNode.line_limit,
      patamarCurrent: semanticNode.patamar_current,
      patamarNextOf: semanticNode.patamar_next_of,
      patamarNext: semanticNode.patamar_next,
      patamarAfter: semanticNode.patamar_after,
      versionFamily: semanticNode.version_family,
      versions: semanticNode.versions,
      versionNote: semanticNode.version_note,
      schemaVersion: semanticNode.schema_version,
      sourcePath: semanticNode.source_path,
      input: semanticNode.depends_on.length ? semanticNode.depends_on.join(' · ') : null,
      output: semanticNode.flows_to.length ? semanticNode.flows_to.join(' · ') : null,
      risk: semanticNode.risk_level,
      evidence: semanticNode.evidence,
      nextAction: semanticNode.next_actions[0] ?? null,
      childrenCount: buildSemanticFlow(graphId).length,
      dependsOn: semanticNode.depends_on,
      flowsTo: semanticNode.flows_to,
      unlocks: semanticNode.unlocks,
      governs: semanticNode.governs,
      repoPaths: semanticNode.repo_paths,
      relatedPaths: semanticNode.related_paths,
      capabilities: semanticNode.capabilities,
      decisions: semanticNode.decisions,
      allowedChanges: semanticNode.allowed_changes,
      forbiddenChanges: semanticNode.forbidden_changes,
      requiredTests: semanticNode.required_tests,
      qualityGates: semanticNode.quality_gates,
      failureModes: semanticNode.failure_modes,
      observabilitySignals: semanticNode.observability_signals,
      aiEntryPoints: semanticNode.ai_entrypoints,
      aiUsageNotes: semanticNode.ai_usage_notes,
      visualTags: semanticNode.visual_tags,
      requiresEvidence: semanticNode.requires_evidence,
    }
  }, [buildSemanticFlow, liveData.semanticGraph])

  const infoFromLane = useCallback((lane: LaneDef): GearInfo => {
    const adaptedLane = lane as AdaptedLane
    const semanticInfo = adaptedLane.graphId ? infoFromSemanticId(adaptedLane.graphId) : null
    const target = lane.feedsInto ? activeSteps.find((step) => step.id === lane.feedsInto) : undefined
    const nodeNames = lane.nodes.map((node) => node.name)
    if (semanticInfo) {
      return {
        ...semanticInfo,
        childrenCount: Math.max(semanticInfo.childrenCount ?? 0, nodeNames.length),
        capabilities: semanticInfo.capabilities?.length ? semanticInfo.capabilities : nodeNames,
        output: semanticInfo.output ?? (target ? `${lane.feedback ? 'Retorna para' : 'Alimenta'} ${target.name}` : null),
      }
    }

    return {
      graphId: adaptedLane.graphId,
      title: lane.name,
      subtitle: lane.deck,
      kind: 'lane',
      status: adaptedLane.missingSource ? 'missing' : 'active',
      source: adaptedLane.graphSource ?? 'repo',
      sourcePath: adaptedLane.sourcePath,
      patamarCurrent: adaptedLane.patamarCurrent,
      patamarNextOf: adaptedLane.patamarNextOf,
      patamarNext: adaptedLane.patamarNext,
      patamarAfter: adaptedLane.patamarAfter,
      versionFamily: adaptedLane.versionFamily,
      versions: adaptedLane.versions,
      versionNote: adaptedLane.versionNote,
      schemaVersion: adaptedLane.schemaVersion,
      graphLayer: 'lane',
      parent: 'atlas-ai-kernel-pipeline',
      input: lane.feedback && target ? target.name : null,
      output: target ? `${lane.feedback ? 'Retorna para' : 'Alimenta'} ${target.name}` : null,
      nextAction: adaptedLane.missingSource
        ? 'Criar ou vincular documento canônico real desta lane.'
        : 'Usar esta lane como contexto lateral do fluxo principal.',
      childrenCount: nodeNames.length,
      capabilities: nodeNames,
      flowsTo: target ? [target.name] : [],
    }
  }, [activeSteps, infoFromSemanticId])

  const infoFromContinent = useCallback((id: string): GearInfo | null => {
    const continent = UNIVERSE_CONTINENTS.find((item) => item.id === id)
    if (!continent) return null
    if (id === 'atlas') {
      return {
        graphId: 'atlas',
        title: continent.name,
        subtitle: 'continente principal: documentação viva do Atlas AI em fluxo visual navegável',
        kind: 'continent',
        status: liveData.isLive ? 'active' : 'offline',
        source: liveData.isLive ? 'repo' : 'fallback',
        sourcePath: '/api/atlas-cartography/graph',
        graphLayer: 'universe',
        input: 'Universo da cartografia.',
        output: 'Atlas AI Kernel Pipeline.',
        nextAction: 'Toque para entrar no fluxo visual; segure peças internas para abrir documentação.',
        childrenCount: activeSteps.length,
        capabilities: activeSteps.map((step) => `${step.num}. ${step.name}`),
        flowsTo: activeLanes.map((lane) => lane.name),
        requiredTests: [
          'npm run test:cartografia',
          'php artisan test --filter=AtlasCartographyContractTest --stop-on-failure',
        ],
      }
    }

    const scene = CONTINENT_SCENES.find((item) => item.continentId === id)
    return {
      graphId: id,
      title: continent.name,
      subtitle: continent.deck,
      kind: 'continent',
      status: 'planned',
      source: 'missing',
      sourcePath: `cartografia/${id}`,
      graphLayer: 'universe',
      parent: 'cartografia-universe',
      input: 'Universo da cartografia.',
      output: scene?.nodes.length ? scene.nodes.map((node) => node.name).join(' · ') : null,
      nextAction: 'Vincular este continente e suas peças a documentos canônicos reais.',
      childrenCount: scene?.nodes.length ?? 0,
      capabilities: scene?.nodes.map((node) => node.name) ?? [],
      failureModes: ['Continente sem fonte canônica pode parecer completo mesmo sem documentação real.'],
      requiredTests: ['npm run test:cartografia'],
    }
  }, [activeLanes, activeSteps, liveData.isLive])

  const infoFromGearNode = useCallback((node: LiveGearFlowNode): GearInfo => {
    const semanticInfo = infoFromSemanticId(node.target_graph_id ?? node.graph_id)
    if (semanticInfo) return semanticInfo
    return {
      graphId: node.target_graph_id ?? node.graph_id,
      title: node.name,
      subtitle: node.summary,
      kind: node.kind,
      status: node.status,
      source: node.source,
      sourcePath: node.source_path,
      input: node.input,
      output: node.output,
      risk: node.risk,
      evidence: node.evidence,
      nextAction: node.next_action,
      childrenCount: node.gear_flow?.length ?? 0,
    }
  }, [infoFromSemanticId])

  const openInfoByGraphId = useCallback((graphId: string) => {
    const info = infoFromSemanticId(graphId)
    if (info) {
      openGearInfo(info)
      return
    }
    const laneNode = laneNodeByGraphId.get(graphId)
    if (laneNode) {
      openGearInfo({
        graphId: laneNode.graphId,
        title: laneNode.name,
        subtitle: laneNode.deck,
        kind: 'lateral',
        status: laneNode.missingSource ? 'missing' : 'active',
        source: laneNode.graphSource,
        sourcePath: laneNode.sourcePath,
        nextAction: laneNode.missingSource ? 'Criar ou vincular documento canônico real.' : null,
      })
    }
  }, [infoFromSemanticId, laneNodeByGraphId, openGearInfo])

  const openInfoBySourcePath = useCallback((sourcePath: string) => {
    if (!liveData.semanticGraph) return
    const normalized = sourcePath.replace(/^\/+/, '')
    const semanticNode = liveData.semanticGraph.nodes.find((node) => {
      const candidates = [
        node.source_path,
        node.canonical_source,
        ...(node.repo_paths ?? []),
        ...(node.related_paths ?? []),
      ].filter(Boolean)
      return candidates.some((candidate) => candidate === normalized || candidate === sourcePath)
    })
    if (semanticNode) {
      openInfoByGraphId(semanticNode.graph_id)
    }
  }, [liveData.semanticGraph, openInfoByGraphId])

  const continentNodeParentStep = useCallback((id: string): AdaptedPipelineStep | null => {
    const found = continentNodeById.get(id)
    if (!found) return null
    const graphId = found.node.graphId ?? id
    const semanticNode = findSemanticNode(liveData.semanticGraph, graphId)
    return {
      num: 0,
      id,
      name: semanticNode?.graph_title ?? found.node.name,
      deck: semanticNode?.summary ?? found.node.deck,
      phase: found.node.risk ? 'prove' : 'shape',
      graphSource: semanticNode?.graph_source ?? 'missing',
      sourcePath: semanticNode?.source_path ?? `cartografia/${found.continentId}/${id}`,
      missingSource: !semanticNode,
      graphId,
      input: semanticNode?.depends_on.length ? semanticNode.depends_on.join(' · ') : null,
      output: semanticNode?.flows_to.length ? semanticNode.flows_to.join(' · ') : null,
      dependsOn: semanticNode?.depends_on ?? [],
      unblocks: semanticNode?.unlocks ?? [],
      evidence: semanticNode?.evidence[0] ?? null,
      risk: semanticNode?.risk_level ?? (found.node.risk ? 'open' : null),
      nextAction: semanticNode?.next_actions[0] ?? (!semanticNode ? 'Vincular esta peça a um documento canônico real.' : null),
      gearFlow: semanticNode ? buildSemanticFlow(graphId) : [],
    }
  }, [buildSemanticFlow, continentNodeById, liveData.semanticGraph])

  const subflowScene = useMemo(() => {
    if (nav.view !== 'subflow') return null
    if (visualSubflow) return visualSubflow
    const source = nav.focusedId
      ? activeSteps.find((s) => s.id === nav.focusedId) as AdaptedPipelineStep | undefined
      : undefined
    if (!source) return null
    const graphId = source.graphId ?? source.id
    const semanticFlow = buildSemanticFlow(graphId)
    const flow = semanticFlow.length
      ? semanticFlow
      : source.gearFlow ?? []
    const fallbackFlow: LiveGearFlowNode[] = flow.length
      ? flow
      : subsToGearFlow({ graphId, phase: source.phase, deck: source.deck, subs: source.subs })
    return fallbackFlow.length ? { id: source.id, parentStep: source, flow: fallbackFlow } : null
  }, [activeSteps, buildSemanticFlow, nav.focusedId, nav.view, visualSubflow])

  const openLaneNodeVisual = useCallback((id: string) => {
    const subflow = semanticSubflowByGraphId(id)
    if (subflow) {
      setVisualSubflow(subflow)
      setSubflowCount(subflow.flow.length)
      nav.enterSubflow(subflow.id)
      setTimeout(() => focusSubflow(viewport, subflow.flow.length), 80)
      return true
    }
    const laneNode = laneNodeByGraphId.get(id)
    if (!laneNode) return false
    const semanticSubflow = semanticSubflowByGraphId(laneNode.graphId)
    if (semanticSubflow) {
      setVisualSubflow(semanticSubflow)
      setSubflowCount(semanticSubflow.flow.length)
      nav.enterSubflow(semanticSubflow.id)
      setTimeout(() => focusSubflow(viewport, semanticSubflow.flow.length), 80)
      return true
    }
    const parentStep: AdaptedPipelineStep = {
      num: 0,
      id,
      name: laneNode.name,
      deck: laneNode.deck,
      phase: 'shape',
      graphSource: laneNode.graphSource,
      sourcePath: laneNode.sourcePath,
      missingSource: laneNode.missingSource,
      graphId: laneNode.graphId,
      input: null,
      output: null,
      dependsOn: [],
      unblocks: [],
      evidence: null,
      risk: null,
      nextAction: null,
      gearFlow: [],
    }
    const flow = pipelineTerminalFlow({
      graphId: laneNode.graphId,
      name: laneNode.name,
      phase: 'shape',
      deck: laneNode.deck,
      source: laneNode.graphSource,
      sourcePath: laneNode.sourcePath,
      missingSource: laneNode.missingSource,
    })
    setVisualSubflow({ id, parentStep, flow })
    setSubflowCount(flow.length)
    nav.enterSubflow(id)
    setTimeout(() => focusSubflow(viewport, flow.length), 80)
    return true
  }, [laneNodeByGraphId, nav, semanticSubflowByGraphId, viewport])

  const onOpenSearch = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    setSearchOpen(true)
  }, [])

  const onSearchHit = useCallback(
    (hit: SearchHit) => {
      setSearchOpen(false)
      const docId = hit.graphId ?? hit.id
      if (hit.kind === 'continent') {
        nav.enterContinent(hit.id)
        setTimeout(() => {
          if (hit.id === 'atlas') {
            viewport.focusOnRect(ATLAS_FLOW_FOCUS, focusScaleForAtlasFlow(activeSteps.length))
          } else {
            viewport.fit()
          }
        }, 80)
        return
      }
      if (hit.kind === 'semantic') {
        const semanticSubflow = semanticSubflowByGraphId(docId)
        if (semanticSubflow) {
          setVisualSubflow(semanticSubflow)
          setSubflowCount(semanticSubflow.flow.length)
          nav.enterSubflow(semanticSubflow.id)
          setTimeout(() => focusSubflow(viewport, semanticSubflow.flow.length), 80)
        }
        return
      }
      if (hit.kind === 'pipeline') {
        // Garante que estamos no continent atlas
        if (nav.continent !== 'atlas') {
          nav.enterContinent('atlas')
        }
        const step = activeSteps.find((s) => s.id === hit.id || ('graphId' in s && s.graphId === docId))
        if (step) {
          setTimeout(() => {
            openVisualSubflow(step as AdaptedPipelineStep)
          }, 100)
        }
        return
      }
      const semanticSubflow = semanticSubflowByGraphId(docId)
      if (semanticSubflow) {
        setVisualSubflow(semanticSubflow)
        setSubflowCount(semanticSubflow.flow.length)
        nav.enterSubflow(semanticSubflow.id)
        setTimeout(() => focusSubflow(viewport, semanticSubflow.flow.length), 80)
        return
      }
      if (hit.kind === 'continent-node') {
        const parentStep = continentNodeParentStep(docId)
        if (parentStep) {
          const flow = pipelineTerminalFlow({
            graphId: parentStep.graphId,
            name: parentStep.name,
            phase: parentStep.phase,
            deck: parentStep.deck,
            source: parentStep.graphSource,
            sourcePath: parentStep.sourcePath,
            missingSource: parentStep.missingSource,
            risk: parentStep.risk,
            nextAction: parentStep.nextAction,
          })
          setVisualSubflow({ id: hit.id, parentStep, flow })
          setSubflowCount(flow.length)
          nav.enterSubflow(hit.id)
          setTimeout(() => focusSubflow(viewport, flow.length), 80)
          return
        }
      }
      if (hit.kind === 'lane-node' && openLaneNodeVisual(docId)) {
        return
      }
      // lane-node ou continent-node · navega ao continent quando o hit
      // não possui subfluxo visual direto.
      if (hit.continentId && hit.continentId !== nav.continent) {
        setVisualSubflow(null)
        nav.enterContinent(hit.continentId)
        setTimeout(() => {
          if (hit.continentId === 'atlas') {
            viewport.focusOnRect(ATLAS_FLOW_FOCUS, focusScaleForAtlasFlow(activeSteps.length))
          } else {
            viewport.fit()
          }
        }, 80)
      }
    },
    [activeSteps, continentNodeParentStep, nav, openLaneNodeVisual, openVisualSubflow, semanticSubflowByGraphId, viewport],
  )

  const onContinentPress = useCallback(
    (id: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
      setVisualSubflow(null)
      nav.enterContinent(id)
      // Re-fit pra centralizar nova cena com peso editorial (380ms tween
      // dentro de viewport.fit). Delay curto pra a scene montar antes do
      // fit calcular contra dimensions atuais (que continuam valendo).
      setTimeout(() => {
        if (id === 'atlas') {
          viewport.focusOnRect(ATLAS_FLOW_FOCUS, focusScaleForAtlasFlow(activeSteps.length))
        } else {
          viewport.fit()
        }
      }, 80)
    },
    [activeSteps.length, nav, viewport],
  )

  const onContinentLongPress = useCallback((id: string) => {
    const info = infoFromContinent(id)
    if (info) openGearInfo(info)
  }, [infoFromContinent, openGearInfo])

  const onStepPress = useCallback(
    (id: string) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
      const step = activeSteps.find((s) => s.id === id)
      if (step) {
        openVisualSubflow(step as AdaptedPipelineStep)
        return
      }
    },
    [activeSteps, openVisualSubflow],
  )

  const onStepLongPress = useCallback((id: string) => {
    const step = activeSteps.find((s) => s.id === id) as AdaptedPipelineStep | undefined
    if (!step) return
    const items = activeSteps.map((item) => infoFromStep(item as AdaptedPipelineStep))
    const index = Math.max(0, activeSteps.findIndex((item) => item.id === id))
    openGearInfo(items[index] ?? infoFromStep(step), items, index)
  }, [activeSteps, infoFromStep, openGearInfo])

  const onFlowLongPress = useCallback(() => {
    openGearInfo({
      title: 'Atlas AI Kernel Pipeline',
      subtitle: 'fluxo principal: input humano → decisão auditável → prova → saída',
      kind: 'pipeline',
      status: liveData.isLive ? 'active' : 'offline',
      source: liveData.isLive ? 'repo' : 'fallback',
      sourcePath: '/api/atlas-cartography/graph',
      graphLayer: 'pipeline',
      input: 'Surface Plane recebe usuário, app, mobile, CLI, API ou MCP.',
      output: 'Output Renderer entrega resposta, patch, plano, proposta ou briefing.',
      nextAction: liveData.isLive
        ? 'Use tap em qualquer etapa para abrir seu fluxo visual; segure para ler a explicação humana.'
        : 'Ligar servidor para confirmar este fluxo contra a documentação real.',
      childrenCount: activeSteps.length,
      capabilities: activeSteps.map((step) => `${step.num}. ${step.name}`),
      flowsTo: liveData.lanes.map((lane) => lane.name),
      requiredTests: [
        'npm run test:cartografia',
        'php artisan test --filter=AtlasCartographyContractTest --stop-on-failure',
      ],
    })
  }, [activeSteps, liveData.isLive, liveData.lanes, openGearInfo])

  const onLaneNodePress = useCallback((id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    openLaneNodeVisual(id)
  }, [openLaneNodeVisual])

  const onLaneLongPress = useCallback((id: string) => {
    const lane = activeLanes.find((item) => item.id === id)
    if (!lane) return
    const items = activeLanes.map((item) => infoFromLane(item))
    const index = Math.max(0, activeLanes.findIndex((item) => item.id === id))
    openGearInfo(items[index] ?? infoFromLane(lane), items, index)
  }, [activeLanes, infoFromLane, openGearInfo])

  const onLaneNodeLongPress = useCallback((id: string) => {
    const laneNode = laneNodeByGraphId.get(id)
    const info = infoFromSemanticId(laneNode?.graphId ?? id)
    if (info) {
      openGearInfo(info)
      return
    }
    if (!laneNode) return
    openGearInfo({
      title: laneNode.name,
      subtitle: laneNode.deck,
      kind: 'lateral',
      status: laneNode.missingSource ? 'missing' : 'active',
      source: laneNode.graphSource,
      sourcePath: laneNode.sourcePath,
      patamarCurrent: laneNode.patamarCurrent,
      patamarNextOf: laneNode.patamarNextOf,
      patamarNext: laneNode.patamarNext,
      patamarAfter: laneNode.patamarAfter,
      versionFamily: laneNode.versionFamily,
      versions: laneNode.versions,
      versionNote: laneNode.versionNote,
      schemaVersion: laneNode.schemaVersion,
      nextAction: laneNode.missingSource ? 'Criar ou vincular documento canônico real.' : null,
      childrenCount: 0,
    })
  }, [infoFromSemanticId, laneNodeByGraphId, openGearInfo])

  const onContinentNodePress = useCallback((id: string) => {
    const parentStep = continentNodeParentStep(id)
    if (!parentStep) return
    const semanticSubflow = semanticSubflowByGraphId(parentStep.graphId)
    if (semanticSubflow) {
      setVisualSubflow(semanticSubflow)
      setSubflowCount(semanticSubflow.flow.length)
      nav.enterSubflow(semanticSubflow.id)
      setTimeout(() => focusSubflow(viewport, semanticSubflow.flow.length), 80)
      return
    }
    const flow = pipelineTerminalFlow({
      graphId: parentStep.graphId,
      name: parentStep.name,
      phase: parentStep.phase,
      deck: parentStep.deck,
      source: parentStep.graphSource,
      sourcePath: parentStep.sourcePath,
      missingSource: parentStep.missingSource,
      risk: parentStep.risk,
      nextAction: parentStep.nextAction,
    })
    setVisualSubflow({ id, parentStep, flow })
    setSubflowCount(flow.length)
    nav.enterSubflow(id)
    setTimeout(() => focusSubflow(viewport, flow.length), 80)
  }, [continentNodeParentStep, nav, semanticSubflowByGraphId, viewport])

  const onContinentNodeLongPress = useCallback((id: string) => {
    const parentStep = continentNodeParentStep(id)
    if (!parentStep) return
    openGearInfo(infoFromStep(parentStep))
  }, [continentNodeParentStep, infoFromStep, openGearInfo])

  const onBack = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    if (nav.view === 'subflow') {
      setVisualSubflow(null)
      nav.exitSubflow()
      setTimeout(() => {
        if (nav.continent === 'atlas') {
          viewport.focusOnRect(ATLAS_FLOW_FOCUS, focusScaleForAtlasFlow(activeSteps.length))
        } else {
          viewport.fit()
        }
      }, 50)
      return
    }
    if (nav.view === 'flow') {
      nav.backToUniverse()
      setTimeout(() => viewport.fit(), 50)
      return
    }
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }, [activeSteps.length, nav, router, viewport])

  /** Tap no brand "CARTOGRAFIA" do header = recovery rápido · volta universo
   *  e centraliza. Canon iOS "tap no logo do navigation bar". */
  const onBrandTap = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    if (nav.view !== 'universe') {
      setVisualSubflow(null)
      nav.backToUniverse()
    }
    setTimeout(() => viewport.fit(), nav.view !== 'universe' ? 60 : 0)
  }, [nav, viewport])

  const backLabel = nav.view === 'universe'
    ? 'EDIÇÃO'
    : nav.view === 'subflow'
      ? 'ATLAS AI'
      : 'UNIVERSO'

  /** Contagem canon da cena ativa · única informação textual no rodapé.
   *  Diz "o que tem aqui" sem narrar o canvas. */
  const sceneCount = (() => {
    if (nav.view === 'universe') return '6 CONTINENTES'
    if (nav.view === 'subflow' && subflowScene) {
      const count = subflowCount || subflowScene.flow.length || 0
      return `${count} PEÇAS INTERNAS`
    }
    if (nav.continent === 'atlas') {
      const stepCount = liveData.isLive ? liveData.steps.length : PIPELINE_STEPS.length
      const lanes = liveData.isLive ? liveData.laneCount : 6
      return `${stepCount} ETAPAS · ${lanes} LANES`
    }
    const cont = UNIVERSE_CONTINENTS.find((x) => x.id === nav.continent)
    return cont ? `${cont.count} PEÇAS` : ''
  })()
  const humanNextMove = nav.view === 'universe'
    ? 'toque Atlas para entrar'
    : nav.view === 'subflow'
      ? 'segure uma peça para ver a fonte'
      : 'toque uma peça para aprofundar'

  return (
    <View
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}
    >
      {/* Header editorial · BlurView iOS dá peso de plate flutuante
          sobre o canvas vivo (Apple Maps/News pattern). Fallback Android
          usa solid backgroundColor pra evitar BlurView raster cost. */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={28}
          tint={themeName === 'dark' ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, styles.headerBlur, { height: insets.top + 58 }]}
          pointerEvents="none"
        />
      ) : null}
      <View
        style={[
          styles.header,
          {
            borderBottomColor: c.border,
            backgroundColor: Platform.OS === 'ios' ? 'transparent' : c.bg,
          },
        ]}
      >
        <Pressable
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={styles.headerLeft}
        >
          <Svg width={14} height={14} viewBox="0 0 14 14">
            <Path
              d="M 9 3 L 4 7 L 9 11"
              stroke={c.ink3}
              strokeWidth={1.4}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Mono size={11} letterSpacing={1.8} color={c.ink3}>
            {backLabel}
          </Mono>
        </Pressable>
        <Pressable
          onPress={onBrandTap}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Voltar pro universo e centralizar"
          style={({ pressed }) => [styles.headerCenter, { opacity: pressed ? 0.55 : 1 }]}
        >
          <Mono size={11} letterSpacing={2.4} color={c.bronze} style={styles.headerEyebrow}>
            CARTOGRAFIA
          </Mono>
          <Frau italic size={13} lineHeight={18} color={c.ink2}>
            {liveData.humanClarityScore != null
              ? `clareza ${liveData.humanClarityScore.toFixed(1)} · mapa vivo`
              : 'mapa vivo do atlas'}
          </Frau>
        </Pressable>
        {/* Cluster premium · indicador do continent (glyph mini sem
            letra) + fit + search. Sem labels textuais "UNIVERSO/ATLAS"
            (redundantes · brand central + glyph já ensinam). */}
        <Animated.View
          key={`hr-${nav.continent ?? 'root'}`}
          entering={FadeIn.duration(280)}
          style={styles.headerRight}
        >
          {nav.continent ? (
            <View style={styles.headerContinentDot}>
              <ContinentGlyph
                continentId={nav.continent}
                size={14}
                color={c.bronze}
                detailColor={c.ink3}
              />
            </View>
          ) : null}
          {/* Botão FIT (quadrado 4 cantos) REMOVIDO · feedback canon do user:
              "faço tudo com os dedos". Recovery via brand tap "CARTOGRAFIA"
              no header central (já existe) + pinch/pan/double-tap canônicos. */}
          <Pressable
            onPress={onOpenSearch}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Buscar peças do mapa"
            style={({ pressed }) => [styles.headerIcon, { opacity: pressed ? 0.45 : 1 }]}
          >
            <Svg width={15} height={15} viewBox="0 0 16 16">
              <Path
                d="M 7 1 a 6 6 0 1 0 0 12 a 6 6 0 0 0 0 -12"
                stroke={c.ink2}
                strokeWidth={1.4}
                fill="none"
              />
              <Path d="M 11.5 11.5 L 15 15" stroke={c.ink2} strokeWidth={1.4} strokeLinecap="round" />
            </Svg>
          </Pressable>
        </Animated.View>
        {/* Dot de status live · verde = dados do servidor, vermelho = offline.
            Indica ao operador se está vendo dados reais ou fallback. */}
        <View style={styles.headerLiveDot}>
          <Svg width={8} height={8} viewBox="0 0 8 8">
            <Circle
              cx={4}
              cy={4}
              r={3.5}
              fill={liveData.isLive ? c.moss : c.recRed}
              opacity={0.85}
            />
          </Svg>
        </View>
      </View>

      {/* Canvas vivo · pinch + pan · LOD por escala.
          Key=view+continent força remount limpa · cada cena revela
          stagger editorial seu primeiro frame.
          pointerEvents="box-none" CRÍTICO · sem isso este View absorve
          todos os touches em áreas vazias e nunca deixa chegar no
          GestureDetector do CartographyWorld. Atoms filhos (com gesture
          tap próprio) continuam recebendo touches porque box-none só
          afeta esta View, não os filhos. */}
      <CartographyWorld viewport={viewport}>
        <Animated.View
          key={`${nav.view}-${nav.continent ?? 'root'}-${nav.focusedId ?? 'none'}`}
          style={StyleSheet.absoluteFill}
          pointerEvents="box-none"
          entering={FadeIn.duration(380)}
        >
          {nav.view === 'universe' ? (
            <UniverseScene
              lod={viewport.lod}
              onContinentPress={onContinentPress}
              onContinentLongPress={onContinentLongPress}
            />
          ) : nav.view === 'subflow' && subflowScene ? (
            <GearFlowScene
              parentStep={subflowScene.parentStep}
              gearFlow={subflowScene.flow}
              lod={viewport.lod}
              onActiveCountChange={onSubflowActiveCountChange}
              onParentLongPress={(activeNode) => {
                if (activeNode) {
                  openGearInfo(infoFromGearNode(activeNode))
                  return
                }
                openGearInfo(infoFromStep(subflowScene.parentStep as AdaptedPipelineStep))
              }}
              onNodeLongPress={(node, sequence, index) => {
                const items = sequence.map(infoFromGearNode)
                openGearInfo(infoFromGearNode(node), items, index)
              }}
            />
          ) : nav.continent === 'atlas' ? (
            <FlowScene
              lod={viewport.lod}
              onStepPress={onStepPress}
              onStepLongPress={onStepLongPress}
              onFlowLongPress={onFlowLongPress}
              onLaneLongPress={onLaneLongPress}
              onLaneNodePress={onLaneNodePress}
              onLaneNodeLongPress={onLaneNodeLongPress}
              focusedId={nav.focusedId}
              liveSteps={liveData.isLive ? liveData.steps : undefined}
              liveLanes={liveData.isLive ? liveData.lanes : undefined}
              connections={liveData.isLive ? liveData.connections : undefined}
              semanticGraph={liveData.semanticGraph}
            />
          ) : nav.continent ? (
            <ContinentRadialScene
              continentId={nav.continent}
              lod={viewport.lod}
              onCenterLongPress={onContinentLongPress}
              onNodePress={onContinentNodePress}
              onNodeLongPress={onContinentNodeLongPress}
            />
          ) : null}
        </Animated.View>
      </CartographyWorld>

      {/* Contagem canon da cena · single source of truth do que tem na cena
          atual (não narra o canvas, só diz "o que tem aqui"). Mono caps
          fina, alinhada ao safe-area inferior, sem botões. */}
      {sceneCount ? (
        <View
          style={[styles.sceneCount, { paddingBottom: insets.bottom + 14 }]}
          pointerEvents="none"
        >
          <Mono size={10} letterSpacing={1.8} color={c.ink3}>
            {sceneCount}
          </Mono>
          <Frau italic size={12} lineHeight={16} color={c.ink3} style={styles.sceneHint}>
            {humanNextMove}
          </Frau>
        </View>
      ) : null}

      {/* Vinheta radial · plate iluminado canon · sobre o canvas, fora
          do transform. Sutil escurecimento dos cantos. */}
      {viewport.viewportSize.w > 0 ? (
        <View style={styles.vignetteAnchor} pointerEvents="none">
          <CanvasVignette
            width={viewport.viewportSize.w}
            height={viewport.viewportSize.h}
          />
        </View>
      ) : null}

      {/* ZoomControls REMOVIDO · feedback canon: vertical alto +/⊟/−
          era SaaS pobre. Zoom via pinch (canon mobile) + double-tap
          focal + brand tap (CARTOGRAFIA) que faz fit. Recovery via
          fit button SVG mini no header (ao lado do search). */}
      {viewport.viewportSize.w > 0 && !nav.focusedId ? <OnboardingHint /> : null}

      {/* Search overlay · lupa no header abre · lista todos os atoms */}
      <SearchOverlay
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectHit={onSearchHit}
        pipelineSteps={activeSteps}
        lanes={liveData.isLive ? liveData.lanes : undefined}
        semanticGraph={liveData.semanticGraph}
      />

      <GearInfoModal
        info={gearInfoState?.items[gearInfoState.index] ?? null}
        onOpenGraphId={openInfoByGraphId}
        onOpenSourcePath={openInfoBySourcePath}
        hasPrevious={Boolean(gearInfoState && gearInfoState.index > 0)}
        hasNext={Boolean(gearInfoState && gearInfoState.index < gearInfoState.items.length - 1)}
        onPrevious={() => setGearInfoState((current) =>
          current ? { ...current, index: Math.max(0, current.index - 1) } : current,
        )}
        onNext={() => setGearInfoState((current) =>
          current ? { ...current, index: Math.min(current.items.length - 1, current.index + 1) } : current,
        )}
        onClose={() => setGearInfoState(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBlur: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: undefined,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    zIndex: 2,
  },
  headerCenter: {
    alignItems: 'center',
    gap: 2,
  },
  headerEyebrow: {
    marginBottom: 0,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerContinentDot: {
    opacity: 0.9,
  },
  headerIcon: {
    padding: 2,
  },
  headerLiveDot: {
    marginLeft: -6,
    marginTop: -2,
  },
  vignetteAnchor: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sceneCount: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  sceneHint: {
    marginTop: 6,
    opacity: 0.72,
  },
})
