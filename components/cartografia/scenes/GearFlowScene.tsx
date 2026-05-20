/**
 * Cartografia · cena de subfluxo de uma engrenagem.
 *
 * Drill-down canon: ao tocar uma peça com `gear_flow`, o canvas anterior
 * some e este fluxo ocupa o mundo. Nada de sheet/overlay sobre a cena pai.
 */
import { Fragment, type Dispatch, type SetStateAction, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeIn, FadeInDown } from 'react-native-reanimated'
import Svg, { Circle, Line, Path, Polygon } from 'react-native-svg'
import { Frau, Mono } from '../../../design/Type'
import { usePalette } from '../../../design/theme'
import { AtomTouchable } from '../map/AtomTouchable'
import { PhaseGlyph } from '../map/PhaseGlyph'
import { PIPELINE_STEP_HEIGHT, PIPELINE_WIDTH, type PipelineStep } from '../map/atlasFlowData'
import { WORLD_HEIGHT, WORLD_WIDTH, type LodLevel } from '../map/layout'
import { type LiveGearFlowNode } from '../state/useCartografiaLiveData'

interface Props {
  parentStep: PipelineStep
  gearFlow: LiveGearFlowNode[]
  lod: LodLevel
  onActiveCountChange?: (count: number) => void
  onParentLongPress?: (activeNode?: LiveGearFlowNode) => void
  onNodeLongPress?: (node: LiveGearFlowNode, sequence: LiveGearFlowNode[], index: number) => void
}

type FlowStackEntry = {
  title: string
  flow: LiveGearFlowNode[]
  node?: LiveGearFlowNode
}

const CENTER_X = WORLD_WIDTH / 2
const CENTER_Y = WORLD_HEIGHT / 2
const NODE_W = PIPELINE_WIDTH
const NODE_H = PIPELINE_STEP_HEIGHT + 18
const NODE_GAP = 12
const KERNEL_SIZE = 96
const SIDE_NODE_W = 300
const STAGE_RAIL_X_OFFSET = 30
const TERMINAL_SUFFIX = ':terminal'

function glyphForKind(kind: string): string {
  switch (kind) {
    case 'input': return '↓'
    case 'policy': return '◇'
    case 'context': return '◎'
    case 'decision': return '✦'
    case 'gate': return '□'
    case 'output': return '→'
    case 'failure': return '!'
    default: return '•'
  }
}

function toneForKind(kind: string, c: ReturnType<typeof usePalette>): string {
  switch (kind) {
    case 'failure': return c.recRed
    case 'gate': return c.moss
    case 'output': return c.bronzeLight
    default: return c.bronze
  }
}

function isDocumentationGap(node: LiveGearFlowNode): boolean {
  return node.graph_id.includes(':empty') || node.name.toLowerCase() === 'sem subfluxo'
}

function toneForNode(node: LiveGearFlowNode, c: ReturnType<typeof usePalette>): string {
  if (isDocumentationGap(node)) return c.bronzeLight
  return toneForKind(node.kind, c)
}

function terminalFlowFor(node: LiveGearFlowNode): LiveGearFlowNode[] {
  const base = `${node.graph_id}${TERMINAL_SUFFIX}`
  const canonicalTarget = node.target_graph_id ?? node.graph_id
  const flow: LiveGearFlowNode[] = [
    {
      graph_id: `${base}:core`,
      target_graph_id: canonicalTarget,
      name: node.name,
      kind: node.kind || 'decision',
      summary: node.summary || 'peça documentada',
      status: node.status,
      source: node.source,
      source_path: node.source_path,
      evidence: node.evidence,
      risk: node.risk,
      next_action: node.next_action,
      gear_flow: [],
    },
  ]

  if (node.input) {
    flow.unshift({
      graph_id: `${base}:input`,
      target_graph_id: canonicalTarget,
      name: 'Entrada',
      kind: 'input',
      summary: node.input,
      gear_flow: [],
    })
  }

  if (node.output) {
    flow.push({
      graph_id: `${base}:output`,
      target_graph_id: canonicalTarget,
      name: 'Saída',
      kind: 'output',
      summary: node.output,
      gear_flow: [],
    })
  }

  if (node.source_path) {
    flow.push({
      graph_id: `${base}:source`,
      target_graph_id: canonicalTarget,
      name: 'Fonte',
      kind: node.source === 'missing' ? 'failure' : 'gate',
      summary: node.source_path,
      gear_flow: [],
    })
  }

  if (node.evidence?.length) {
    flow.push({
      graph_id: `${base}:evidence`,
      target_graph_id: canonicalTarget,
      name: 'Prova',
      kind: 'gate',
      summary: node.evidence.slice(0, 2).join(' · '),
      gear_flow: [],
    })
  }

  if (node.next_action) {
    flow.push({
      graph_id: `${base}:next`,
      target_graph_id: canonicalTarget,
      name: 'Próxima ação',
      kind: 'output',
      summary: node.next_action,
      gear_flow: [],
    })
  }

  if (flow.length === 1 && !node.input && !node.output && !node.source_path && !node.evidence?.length && !node.next_action) {
    flow.push({
      graph_id: `${base}:empty`,
      target_graph_id: canonicalTarget,
      name: 'Sem subfluxo',
      kind: 'failure',
      summary: 'a documentação ainda não descreve peças internas',
      gear_flow: [],
    })
  }

  return flow
}

function drillIntoNode(
  node: LiveGearFlowNode,
  setStack: Dispatch<SetStateAction<FlowStackEntry[]>>,
) {
  if (node.graph_id.includes(TERMINAL_SUFFIX)) return
  const flow = node.gear_flow?.length ? node.gear_flow : terminalFlowFor(node)
  if (!flow.length) return
  setStack((current) => [...current, { title: node.name, flow, node }])
}

export function GearFlowScene({
  parentStep,
  gearFlow,
  lod,
  onActiveCountChange,
  onParentLongPress,
  onNodeLongPress,
}: Props) {
  const c = usePalette()
  const [stack, setStack] = useState<FlowStackEntry[]>([
    { title: parentStep.name, flow: gearFlow },
  ])
  const active = stack[stack.length - 1]
  const primary = useMemo(() => active.flow.filter((node) => node.kind !== 'failure'), [active.flow])
  const failures = useMemo(() => active.flow.filter((node) => node.kind === 'failure'), [active.flow])
  const documentationGaps = useMemo(() => active.flow.filter(isDocumentationGap).length, [active.flow])
  const terminalNodes = useMemo(
    () => active.flow.filter((node) => !node.gear_flow?.length && !isDocumentationGap(node)).length,
    [active.flow],
  )
  const modalSequence = useMemo(() => [...primary, ...failures], [primary, failures])
  const totalH = primary.length * NODE_H + Math.max(0, primary.length - 1) * NODE_GAP
  const startY = CENTER_Y - totalH / 2
  const nodeX = CENTER_X - NODE_W / 2
  const railX = nodeX - STAGE_RAIL_X_OFFSET
  const failW = SIDE_NODE_W
  const failH = NODE_H
  const failX = nodeX - failW - 150
  const failY = startY + (NODE_H + NODE_GAP) * Math.min(2, Math.max(0, primary.length - 1))
  const showDeck = lod !== 'far'

  useEffect(() => {
    setStack([{ title: parentStep.name, flow: gearFlow }])
  }, [gearFlow, parentStep.id, parentStep.name])

  useEffect(() => {
    onActiveCountChange?.(active.flow.length)
  }, [active.flow.length, onActiveCountChange])

  return (
    <>
      <Animated.View
        pointerEvents="none"
        entering={FadeIn.duration(520).easing(Easing.bezier(0.16, 1, 0.3, 1))}
        style={styles.svg}
      >
        <Svg width={WORLD_WIDTH} height={WORLD_HEIGHT} viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}>
          <Circle cx={CENTER_X} cy={startY - 58} r={54} stroke={c.bronze} strokeOpacity={0.28} strokeWidth={1.1} fill={c.bgRaised} />
          <Circle cx={CENTER_X} cy={startY - 58} r={82} stroke={c.bronze} strokeOpacity={0.1} strokeWidth={0.9} fill="none" />
          <Line
            x1={railX}
            y1={startY + NODE_H / 2}
            x2={railX}
            y2={startY + (NODE_H + NODE_GAP) * Math.max(0, primary.length - 1) + NODE_H / 2}
            stroke={c.bronze}
            strokeOpacity={0.2}
            strokeWidth={1.2}
          />
          {primary.map((node, index) => {
            const y = startY + (NODE_H + NODE_GAP) * index
            const tone = toneForNode(node, c)
            return (
              <Circle
                key={`rail-${node.graph_id}`}
                cx={railX}
                cy={y + NODE_H / 2}
                r={index === stack.length - 1 ? 4.8 : 3.8}
                stroke={tone}
                strokeOpacity={0.8}
                strokeWidth={1}
                fill={c.bg}
              />
            )
          })}
          {primary.slice(0, -1).map((node, index) => {
            const y = startY + (NODE_H + NODE_GAP) * index
            const nextY = y + NODE_H + NODE_GAP - 10
            const tone = toneForNode(node, c)
            return (
              <Fragment key={`flow-${node.graph_id}`}>
                <Path
                  d={`M ${CENTER_X} ${y + NODE_H} L ${CENTER_X} ${nextY}`}
                  stroke={tone}
                  strokeOpacity={0.48}
                  strokeWidth={1.2}
                  fill="none"
                  strokeLinecap="round"
                />
                <Polygon
                  points={`${CENTER_X - 4},${nextY - 3} ${CENTER_X + 4},${nextY - 3} ${CENTER_X},${nextY + 4}`}
                  fill={tone}
                  opacity={0.62}
                />
              </Fragment>
            )
          })}
          {failures.map((failureNode, index) => {
            const y = failY + (failH + NODE_GAP) * index
            return (
              <Path
                key={`failure-line-${failureNode.graph_id}`}
                d={`M ${nodeX} ${y + failH / 2} L ${failX + failW} ${y + failH / 2}`}
                stroke={c.recRed}
                strokeOpacity={0.55}
                strokeWidth={1.2}
                strokeDasharray="7,10"
                fill="none"
              />
            )
          })}
        </Svg>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        entering={FadeIn.duration(360).easing(Easing.bezier(0.16, 1, 0.3, 1))}
        style={[
          styles.flowLabel,
          {
            left: CENTER_X - NODE_W / 2,
            top: startY - KERNEL_SIZE - 82,
          },
        ]}
      >
        <Mono size={8.5} letterSpacing={1.4} color={c.bronze}>
          FLUXO VISUAL · NIVEL {stack.length}
        </Mono>
        <Frau italic weight="med" size={18} lineHeight={22} color={c.ink} numberOfLines={2}>
          {active.title}
        </Frau>
        <Mono size={7.5} letterSpacing={1.1} color={documentationGaps ? c.bronzeLight : c.ink3}>
          {documentationGaps
            ? `${documentationGaps} LACUNA DOCUMENTAL · ${terminalNodes} TERMINAIS`
            : `${terminalNodes} TERMINAIS DOCUMENTADOS`}
        </Mono>
        <FlowTrail stack={stack} />
      </Animated.View>

      <AtomTouchable
        onPress={() => {}}
        onLongPress={() => onParentLongPress?.(active.node)}
        shellStyle={[
          styles.kernel,
          {
            left: CENTER_X - KERNEL_SIZE / 2,
            top: startY - KERNEL_SIZE - 10,
            backgroundColor: c.bgRaised,
            borderColor: c.bronze,
          },
        ]}
        maxDistance={16}
      >
        <PhaseGlyph phase={parentStep.phase} size={62} color={c.bronze} emphasized />
      </AtomTouchable>

      {primary.map((node, index) => (
        <GearNode
          key={`${active.title}-${node.graph_id}`}
          node={node}
          index={index}
          x={nodeX}
          y={startY + (NODE_H + NODE_GAP) * index}
          w={NODE_W}
          h={NODE_H}
          showDeck={showDeck}
          onPress={() => drillIntoNode(node, setStack)}
          onLongPress={() => onNodeLongPress?.(node, modalSequence, index)}
          hasDrilldown={Boolean(node.gear_flow?.length) || !node.graph_id.includes(TERMINAL_SUFFIX)}
        />
      ))}

      {failures.map((failureNode, index) => (
        <GearNode
          key={`${active.title}-${failureNode.graph_id}`}
          node={failureNode}
          index={primary.length + index}
          x={failX}
          y={failY + (failH + NODE_GAP) * index}
          w={failW}
          h={failH}
          showDeck={showDeck}
          failure
          onPress={() => drillIntoNode(failureNode, setStack)}
          onLongPress={() => onNodeLongPress?.(failureNode, modalSequence, primary.length + index)}
          hasDrilldown={Boolean(failureNode.gear_flow?.length) || !failureNode.graph_id.includes(TERMINAL_SUFFIX)}
        />
      ))}

      {stack.length > 1 ? (
        <AtomTouchable
          onPress={() => setStack((current) => current.slice(0, -1))}
          shellStyle={[
            styles.drillBack,
            {
              left: CENTER_X - 46,
              top: startY + totalH + 34,
              backgroundColor: c.bgRaised,
              borderColor: c.border,
            },
          ]}
        >
          <Mono size={14} color={c.bronze}>↑</Mono>
        </AtomTouchable>
      ) : null}
    </>
  )
}

function FlowTrail({ stack }: { stack: FlowStackEntry[] }) {
  const c = usePalette()
  return (
    <View style={styles.flowTrail} pointerEvents="none">
      {stack.slice(-4).map((entry, index, visibleStack) => {
        const active = index === visibleStack.length - 1
        return (
          <Fragment key={`${entry.title}-${index}`}>
            {index > 0 ? <View style={[styles.flowTrailLine, { backgroundColor: c.bronze }]} /> : null}
            <View
              style={[
                styles.flowTrailChip,
                {
                  borderColor: active ? c.bronze : c.border,
                  backgroundColor: active ? c.bronze + '12' : c.bgRaised,
                },
              ]}
            >
              <Mono size={6.8} letterSpacing={0.8} color={active ? c.bronze : c.ink3} numberOfLines={1}>
                {String(stack.length - visibleStack.length + index + 1).padStart(2, '0')}
              </Mono>
            </View>
          </Fragment>
        )
      })}
    </View>
  )
}

function GearNode({ node, index, x, y, w, h, showDeck, failure, onPress, onLongPress, hasDrilldown }: {
  node: LiveGearFlowNode
  index: number
  x: number
  y: number
  w: number
  h: number
  showDeck: boolean
  failure?: boolean
  onPress: () => void
  onLongPress?: () => void
  hasDrilldown: boolean
}) {
  const c = usePalette()
  const docGap = isDocumentationGap(node)
  const tone = toneForNode(node, c)

  return (
    <Animated.View
      style={{ position: 'absolute', left: x, top: y, width: w, height: h }}
      entering={FadeInDown.duration(360).delay(120 + index * 60).easing(Easing.bezier(0.16, 1, 0.3, 1))}
    >
      <AtomTouchable
        onPress={onPress}
        onLongPress={onLongPress}
        shellStyle={[
          styles.node,
          {
            backgroundColor: failure ? c.bgDeep : c.bgRaised,
            borderColor: tone,
            borderWidth: failure ? 1.4 : 1,
          },
        ]}
      >
        <View style={styles.nodeTop}>
          <View style={styles.nodeMeta}>
            <Mono size={8} letterSpacing={0.9} color={tone}>{String(index + 1).padStart(2, '0')}</Mono>
            <View style={[styles.nodeDot, { backgroundColor: tone }]} />
          </View>
          <Mono size={20} color={tone}>{hasDrilldown ? glyphForKind(node.kind) : '•'}</Mono>
        </View>
        <Frau italic weight="med" size={17} lineHeight={20} color={c.ink} numberOfLines={2} style={styles.nodeName}>
          {node.name}
        </Frau>
        {showDeck ? (
          <Frau italic size={11} lineHeight={14} color={failure ? c.recRed : c.ink2} numberOfLines={2} style={styles.nodeSummary}>
            {node.summary}
          </Frau>
        ) : null}
        <View style={styles.nodeFooter}>
          <Mono size={7} letterSpacing={0.8} color={hasDrilldown ? tone : c.ink3}>
            {hasDrilldown ? 'TOQUE · ABRE FLUXO' : docGap ? 'LACUNA DOCUMENTAL' : 'TERMINAL'}
          </Mono>
          <View style={styles.nodeAffordances} pointerEvents="none">
            <Mono size={9} letterSpacing={0.8} color={hasDrilldown ? tone : c.ink3}>
              {hasDrilldown ? '↧' : '•'}
            </Mono>
            <Mono size={9} letterSpacing={0.8} color={c.ink3}>
              ☰
            </Mono>
          </View>
        </View>
      </AtomTouchable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  svg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  kernel: {
    position: 'absolute',
    width: KERNEL_SIZE,
    height: KERNEL_SIZE,
    borderRadius: KERNEL_SIZE / 2,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowLabel: {
    position: 'absolute',
    width: NODE_W,
    alignItems: 'center',
    gap: 4,
  },
  flowTrail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 4,
  },
  flowTrailChip: {
    width: 22,
    height: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowTrailLine: {
    width: 12,
    height: StyleSheet.hairlineWidth,
    opacity: 0.48,
  },
  node: {
    flex: 1,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.38,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  nodeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nodeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nodeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.82,
  },
  nodeName: {
    marginTop: 4,
  },
  nodeSummary: {
    marginTop: 1,
    opacity: 0.85,
  },
  nodeFooter: {
    marginTop: 4,
    opacity: 0.8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nodeAffordances: {
    flexDirection: 'row',
    gap: 6,
  },
  drillBack: {
    position: 'absolute',
    width: 92,
    height: 44,
    borderWidth: 1,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
