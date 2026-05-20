import type { GraphSource, LiveGearFlowNode, LiveSemanticGraph, LiveSemanticNode } from './useCartografiaLiveData'
import type { FlowPhase } from '../map/atlasFlowData'
import { displayText, displayTextList } from './cartografiaText'

function findSemanticNode(
  semanticGraph: LiveSemanticGraph | null,
  graphId: string,
): LiveSemanticNode | undefined {
  return semanticGraph?.nodes.find((n) => n.graph_id === graphId)
}

function getChildrenIds(
  semanticGraph: LiveSemanticGraph | null,
  graphId: string,
): string[] {
  return semanticGraph?.hierarchy[graphId] ?? []
}

function uniqueNonEmpty(items: ReadonlyArray<string | null | undefined>): string[] {
  return Array.from(new Set(items.filter((item): item is string => Boolean(item?.trim()))))
}

export function semanticKindToGearKind(kind: string | null | undefined): LiveGearFlowNode['kind'] {
  switch (kind) {
    case 'policy':
      return 'policy'
    case 'flow':
    case 'step':
      return 'input'
    case 'contract':
    case 'adr':
      return 'gate'
    case 'runbook':
    case 'surface':
    case 'screen':
      return 'output'
    case 'module':
    case 'system':
    case 'index':
    case 'lateral':
      return 'context'
    default:
      return 'decision'
  }
}

export function phaseToGearKind(phase: FlowPhase): LiveGearFlowNode['kind'] {
  switch (phase) {
    case 'intake':
      return 'input'
    case 'shape':
      return 'context'
    case 'decide':
      return 'decision'
    case 'prove':
      return 'gate'
    case 'render':
      return 'output'
    default:
      return 'decision'
  }
}

export function subsToGearFlow(input: {
  graphId: string
  phase: FlowPhase
  deck: string
  subs?: ReadonlyArray<string>
}): LiveGearFlowNode[] {
  return (input.subs ?? []).map((name, index) => ({
    graph_id: `${input.graphId}:sub:${index + 1}`,
    name,
    kind: phaseToGearKind(input.phase),
    summary: input.deck,
    source: 'repo',
    gear_flow: [],
  }))
}

function nodeToGearNode(
  semanticGraph: LiveSemanticGraph | null,
  node: LiveSemanticNode,
  seen: Set<string>,
): LiveGearFlowNode {
  const nested = visualFlowForGraphNode(semanticGraph, node.graph_id, seen)
  const dependsOn = node.depends_on ?? []
  const flowsTo = node.flows_to ?? []
  const evidence = node.evidence ?? []
  const nextActions = node.next_actions ?? []

  return {
    graph_id: node.graph_id,
    target_graph_id: node.graph_id,
    name: node.graph_title,
    kind: semanticKindToGearKind(node.graph_kind),
    summary: node.summary ?? node.graph_layer ?? node.graph_world,
    status: node.graph_status,
    source: node.graph_source,
    source_path: node.source_path,
    input: dependsOn.length ? dependsOn.join(' · ') : null,
    output: flowsTo.length ? flowsTo.join(' · ') : null,
    risk: node.risk_level,
    evidence,
    next_action: nextActions[0] ?? null,
    gear_flow: nested,
  }
}

function explicitGearFlow(
  semanticGraph: LiveSemanticGraph | null,
  node: LiveSemanticNode,
  seen: Set<string>,
): LiveGearFlowNode[] {
  return (node.gear_flow ?? []).map((gear, index) =>
    sanitizeGearNode(semanticGraph, gear, {
      fallbackGraphId: `${node.graph_id}:gear:${index + 1}`,
      fallbackStatus: node.graph_status,
      fallbackSource: node.graph_source,
      fallbackSourcePath: node.source_path,
      seen,
    }),
  )
}

function sanitizeGearNode(
  semanticGraph: LiveSemanticGraph | null,
  gear: Partial<LiveGearFlowNode>,
  fallback: {
    fallbackGraphId: string
    fallbackStatus?: string | null
    fallbackSource?: GraphSource | string | null
    fallbackSourcePath?: string | null
    seen: Set<string>
  },
): LiveGearFlowNode {
  const graphId = displayText(gear.graph_id) ?? fallback.fallbackGraphId
  const targetGraphId = displayText(gear.target_graph_id)
  const target = targetGraphId ? findSemanticNode(semanticGraph, targetGraphId) : undefined
  const nextSeen = new Set(fallback.seen)
  if (targetGraphId && targetGraphId === graphId) nextSeen.add(targetGraphId)
  const nested = Array.isArray(gear.gear_flow)
    ? gear.gear_flow.map((child, index) =>
        sanitizeGearNode(semanticGraph, child, {
          fallbackGraphId: `${graphId}:gear:${index + 1}`,
          fallbackStatus: displayText(gear.status) ?? fallback.fallbackStatus,
          fallbackSource: displayText(gear.source) ?? fallback.fallbackSource,
          fallbackSourcePath: displayText(gear.source_path) ?? fallback.fallbackSourcePath,
          seen: nextSeen,
        }),
      )
    : target && !fallback.seen.has(target.graph_id)
      ? visualFlowForGraphNode(semanticGraph, target.graph_id, fallback.seen)
    : []

  return {
    graph_id: graphId,
    target_graph_id: targetGraphId,
    name: displayText(gear.name) ?? graphId,
    kind: displayText(gear.kind) ?? 'decision',
    summary: displayText(gear.summary) ?? target?.summary ?? 'peça documentada',
    status: displayText(gear.status) ?? target?.graph_status ?? fallback.fallbackStatus,
    source: displayText(gear.source) ?? target?.graph_source ?? fallback.fallbackSource,
    source_path: displayText(gear.source_path) ?? target?.source_path ?? fallback.fallbackSourcePath,
    input: displayText(gear.input) ?? (target?.depends_on.length ? target.depends_on.join(' · ') : null),
    output: displayText(gear.output) ?? (target?.flows_to.length ? target.flows_to.join(' · ') : null),
    risk: displayText(gear.risk) ?? target?.risk_level,
    evidence: displayTextList(gear.evidence).length ? displayTextList(gear.evidence) : target?.evidence ?? [],
    next_action: displayText(gear.next_action) ?? target?.next_actions[0] ?? null,
    gear_flow: nested,
  }
}

function documentedTerminalFlow(node: LiveSemanticNode): LiveGearFlowNode[] {
  const base = `${node.graph_id}:documented`
  const flow: LiveGearFlowNode[] = []
  const dependsOn = node.depends_on ?? []
  const flowsTo = node.flows_to ?? []
  const unlocks = node.unlocks ?? []
  const governs = node.governs ?? []
  const evidence = node.evidence ?? []
  const nextActions = node.next_actions ?? []
  const hasDeclaredSubflowClues = Boolean(
    dependsOn.length ||
    flowsTo.length ||
    unlocks.length ||
    governs.length ||
    evidence.length ||
    nextActions.length,
  )

  if (dependsOn.length) {
    flow.push({
      graph_id: `${base}:input`,
      target_graph_id: node.graph_id,
      name: 'Entrada',
      kind: 'input',
      summary: dependsOn.join(' · '),
      source: node.graph_source,
      source_path: node.source_path,
      gear_flow: [],
    })
  }

  flow.push({
    graph_id: `${base}:self`,
    target_graph_id: node.graph_id,
    name: node.graph_title,
    kind: semanticKindToGearKind(node.graph_kind),
    summary: node.summary ?? node.graph_layer ?? node.graph_world,
    status: node.graph_status,
    source: node.graph_source,
    source_path: node.source_path,
    risk: node.risk_level,
    evidence,
    next_action: nextActions[0] ?? null,
    gear_flow: [],
  })

  if (flowsTo.length || unlocks.length) {
    flow.push({
      graph_id: `${base}:output`,
      target_graph_id: node.graph_id,
      name: 'Saída',
      kind: 'output',
      summary: uniqueNonEmpty([...flowsTo, ...unlocks]).join(' · '),
      source: node.graph_source,
      source_path: node.source_path,
      gear_flow: [],
    })
  }

  if (governs.length) {
    flow.push({
      graph_id: `${base}:governs`,
      target_graph_id: node.graph_id,
      name: 'Governa',
      kind: 'policy',
      summary: governs.join(' · '),
      source: node.graph_source,
      source_path: node.source_path,
      gear_flow: [],
    })
  }

  if (node.source_path) {
    flow.push({
      graph_id: `${base}:source`,
      target_graph_id: node.graph_id,
      name: node.graph_source === 'missing' ? 'Fonte ausente' : 'Fonte',
      kind: node.graph_source === 'missing' ? 'failure' : 'gate',
      summary: node.source_path,
      source: node.graph_source,
      source_path: node.source_path,
      gear_flow: [],
    })
  }

  if (evidence.length) {
    flow.push({
      graph_id: `${base}:evidence`,
      target_graph_id: node.graph_id,
      name: 'Prova',
      kind: 'gate',
      summary: evidence.slice(0, 2).join(' · '),
      source: node.graph_source,
      source_path: node.source_path,
      gear_flow: [],
    })
  }

  if (nextActions.length) {
    flow.push({
      graph_id: `${base}:next`,
      target_graph_id: node.graph_id,
      name: 'Próxima ação',
      kind: 'output',
      summary: nextActions[0],
      source: node.graph_source,
      source_path: node.source_path,
      gear_flow: [],
    })
  }

  if (!hasDeclaredSubflowClues) {
    flow.push({
      graph_id: `${base}:empty`,
      target_graph_id: node.graph_id,
      name: 'Sem subfluxo',
      kind: 'failure',
      summary: 'documentação não declara engrenagens internas',
      source: node.graph_source,
      source_path: node.source_path,
      gear_flow: [],
    })
  }

  return flow
}

export function pipelineTerminalFlow(input: {
  graphId: string
  name: string
  phase: FlowPhase
  deck: string
  source?: GraphSource | string | null
  sourcePath?: string | null
  missingSource?: boolean
  input?: string | null
  output?: string | null
  evidence?: string | null
  risk?: string | null
  nextAction?: string | null
}): LiveGearFlowNode[] {
  const base = `${input.graphId}:pipeline-terminal`
  const flow: LiveGearFlowNode[] = []
  const hasDeclaredSubflowClues = Boolean(
    input.input ||
    input.output ||
    input.evidence ||
    input.risk ||
    input.nextAction,
  )

  if (input.input) {
    flow.push({
      graph_id: `${base}:input`,
      target_graph_id: input.graphId,
      name: 'Entrada',
      kind: 'input',
      summary: input.input,
      gear_flow: [],
    })
  }

  flow.push({
    graph_id: `${base}:self`,
    target_graph_id: input.graphId,
    name: input.name,
    kind: phaseToGearKind(input.phase),
    summary: input.deck || 'peça documentada',
    source: input.source,
    source_path: input.sourcePath,
    risk: input.risk,
    next_action: input.nextAction,
    evidence: input.evidence ? [input.evidence] : [],
    gear_flow: [],
  })

  if (input.output) {
    flow.push({
      graph_id: `${base}:output`,
      target_graph_id: input.graphId,
      name: 'Saída',
      kind: 'output',
      summary: input.output,
      gear_flow: [],
    })
  }

  if (input.sourcePath) {
    flow.push({
      graph_id: `${base}:source`,
      target_graph_id: input.graphId,
      name: input.missingSource ? 'Fonte ausente' : 'Fonte',
      kind: input.missingSource ? 'failure' : 'gate',
      summary: input.sourcePath,
      source: input.source,
      source_path: input.sourcePath,
      gear_flow: [],
    })
  }

  if (input.evidence) {
    flow.push({
      graph_id: `${base}:evidence`,
      target_graph_id: input.graphId,
      name: 'Prova',
      kind: 'gate',
      summary: input.evidence,
      gear_flow: [],
    })
  }

  if (input.nextAction) {
    flow.push({
      graph_id: `${base}:next`,
      target_graph_id: input.graphId,
      name: 'Próxima ação',
      kind: 'output',
      summary: input.nextAction,
      gear_flow: [],
    })
  }

  if (!hasDeclaredSubflowClues) {
    flow.push({
      graph_id: `${base}:empty`,
      target_graph_id: input.graphId,
      name: 'Sem subfluxo',
      kind: 'failure',
      summary: input.missingSource
        ? 'fonte da documentação ausente'
        : 'documentação não declara engrenagens internas',
      source: input.source,
      source_path: input.sourcePath,
      gear_flow: [],
    })
  }

  return flow
}

export function visualFlowForGraphNode(
  semanticGraph: LiveSemanticGraph | null,
  graphId: string,
  seen = new Set<string>(),
): LiveGearFlowNode[] {
  if (seen.has(graphId)) return []
  const node = findSemanticNode(semanticGraph, graphId)
  if (!node) return []

  if (node.gear_flow?.length) {
    const explicitSeen = new Set(seen)
    explicitSeen.add(graphId)
    return explicitGearFlow(semanticGraph, node, explicitSeen)
  }

  const nextSeen = new Set(seen)
  nextSeen.add(graphId)
  const childIds = getChildrenIds(semanticGraph, graphId)
  const childFlow = childIds
    .map((childId) => {
      const child = findSemanticNode(semanticGraph, childId)
      return child ? nodeToGearNode(semanticGraph, child, nextSeen) : null
    })
    .filter((child): child is LiveGearFlowNode => Boolean(child))

  return childFlow.length ? childFlow : documentedTerminalFlow(node)
}

export function semanticChildrenToGearFlow(
  semanticGraph: LiveSemanticGraph | null,
  graphId: string,
): LiveGearFlowNode[] {
  return visualFlowForGraphNode(semanticGraph, graphId)
}
