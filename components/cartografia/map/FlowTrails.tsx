/**
 * Cartografia · trilhas do flow scene Atlas.
 *
 * Trilhas SVG canon que ensinam visualmente o fluxo do Kernel Pipeline:
 *
 *   sequence   · linha vertical fina entre i → i+1, com seta-tip ao chegar
 *                (a sequência do pipeline é o "rio" central)
 *   feed       · bezier curva lateral → pipeline · stroke contínuo bronze
 *                (lanes alimentam pontos específicos do pipeline)
 *   feedback   · bezier longa pipe → lane com strokeDasharray (Evidence
 *                Ledger retorna pro Atlas Decide · loop verdadeiro)
 *   governance · bezier pipe → lane curta (Learning Loop → propostas)
 *
 * Tip-marker (seta) em todas as relações, inclusive feedback. Loop também
 * precisa mostrar direção; sem seta ele vira ornamento e confunde leitura.
 *
 * Coordenadas world-space · trail escala junto com o transform parent.
 */
import { Fragment } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  useAnimatedProps,
  useReducedMotion,
} from 'react-native-reanimated'
import Svg, { Defs, Marker, Path, Circle, Text as SvgText } from 'react-native-svg'
import { usePalette } from '../../../design/theme'
import { WORLD_HEIGHT, WORLD_WIDTH } from './layout'
import { useTrailPulse } from './useTrailPulse'
import { useTrailFlow } from './useTrailFlow'

const AnimatedPath = Animated.createAnimatedComponent(Path)
import {
  LANE_DEFINITIONS,
  PIPELINE_STEPS,
  PIPELINE_WIDTH,
  PIPELINE_X,
  pipelineStepHeightFor,
  pipelineStepYForSteps,
  type LaneDef,
  type PipelineStep,
} from './atlasFlowData'
import { type AdaptedConnection } from '../state/useCartografiaLiveData'

interface Anchor {
  x: number
  y: number
}

function pipelineAnchor(
  step: PipelineStep,
  steps: ReadonlyArray<PipelineStep>,
  edge: 'top' | 'bottom' | 'left' | 'right' = 'left',
): Anchor {
  const y0 = pipelineStepYForSteps(step.num, steps)
  const h = pipelineStepHeightFor(step) - 12
  switch (edge) {
    case 'top':    return { x: PIPELINE_X + PIPELINE_WIDTH / 2, y: y0 }
    case 'bottom': return { x: PIPELINE_X + PIPELINE_WIDTH / 2, y: y0 + h }
    case 'left':   return { x: PIPELINE_X, y: y0 + h / 2 }
    case 'right':  return { x: PIPELINE_X + PIPELINE_WIDTH, y: y0 + h / 2 }
  }
}

function laneAnchor(
  laneId: string,
  lanes: ReadonlyArray<LaneDef>,
  edge: 'left' | 'right' | 'top' | 'bottom' = 'right',
): Anchor | null {
  const lane = lanes.find((l) => l.id === laneId)
  if (!lane) return null
  switch (edge) {
    case 'left':   return { x: lane.x, y: lane.y + lane.h / 2 }
    case 'right':  return { x: lane.x + lane.w, y: lane.y + lane.h / 2 }
    case 'top':    return { x: lane.x + lane.w / 2, y: lane.y }
    case 'bottom': return { x: lane.x + lane.w / 2, y: lane.y + lane.h }
  }
}

function bezierBetween(from: Anchor, to: Anchor, curvature = 0.35): string {
  // Horizontal-biased S-curve via control points · ideal pra trails laterais → pipeline
  const dx = to.x - from.x
  const dy = to.y - from.y
  const cx1 = from.x + dx * curvature
  const cx2 = to.x - dx * curvature
  return `M ${from.x} ${from.y} C ${cx1} ${from.y}, ${cx2} ${to.y}, ${to.x} ${to.y}`
}

function elbowBetween(from: Anchor, to: Anchor, side: 'left' | 'right'): string {
  const laneGap = side === 'left' ? 86 : -86
  const pipeGap = side === 'left' ? -42 : 42
  const midY = to.y
  const x1 = from.x + laneGap
  const x2 = to.x + pipeGap
  return `M ${from.x} ${from.y} L ${x1} ${from.y} Q ${x1} ${midY}, ${x2} ${midY} L ${to.x} ${to.y}`
}

function feedbackArc(from: Anchor, to: Anchor): string {
  // Loop longo que vai pelo lado direito · usado pra Evidence → Decide
  const dx = to.x - from.x
  const dy = to.y - from.y
  const swing = Math.max(180, Math.abs(dx) * 0.6)
  const cx1 = from.x + swing
  const cx2 = to.x + swing
  return `M ${from.x} ${from.y} C ${cx1} ${from.y}, ${cx2} ${to.y}, ${to.x} ${to.y}`
}

interface FlowTrailsProps {
  /** Atom focado · trails relacionadas ganham glow */
  focusedId?: string | null
  steps?: ReadonlyArray<PipelineStep>
  lanes?: ReadonlyArray<LaneDef>
  connections?: ReadonlyArray<AdaptedConnection>
}

export function FlowTrails({ focusedId, steps = PIPELINE_STEPS, lanes = LANE_DEFINITIONS, connections }: FlowTrailsProps = {}) {
  const c = usePalette()
  const reduced = useReducedMotion()
  const pulseStyle = useTrailPulse({ enabled: !reduced })
  // Fluxo direcional · dashes correndo ao longo das sequences/feeds
  const flowOffset = useTrailFlow({ enabled: !reduced, period: 1800 })
  const animatedDashProps = useAnimatedProps(() => ({
    strokeDashoffset: flowOffset.value,
  }))
  const orderedSteps = [...steps].sort((a, b) => a.num - b.num)
  const pipelineStepIds = new Set(orderedSteps.map((step) => step.id))
  const focusedStep = orderedSteps.find((s) => s.id === focusedId)
  const feedConnections = connections?.filter((connection) => (
    (connection.kind === 'feed' || connection.kind === 'feedback') &&
    pipelineStepIds.has(connection.to)
  ))

  return (
    <Animated.View
      style={[styles.svg, pulseStyle as StyleProp<ViewStyle>]}
      pointerEvents="none"
      entering={FadeIn.duration(720).delay(420).easing(Easing.bezier(0.16, 1, 0.3, 1))}
    >
      <Svg
        width={WORLD_WIDTH}
        height={WORLD_HEIGHT}
        viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
      >
        <Defs>
          <Marker
            id="tip-bronze"
            viewBox="0 0 8 8"
            markerWidth={6}
            markerHeight={6}
            refX={7}
            refY={4}
            orient="auto"
          >
            <Path d="M 0 0 L 8 4 L 0 8 Z" fill={c.bronze} opacity={0.7} />
          </Marker>
          <Marker
            id="tip-red"
            viewBox="0 0 8 8"
            markerWidth={6}
            markerHeight={6}
            refX={7}
            refY={4}
            orient="auto"
          >
            <Path d="M 0 0 L 8 4 L 0 8 Z" fill={c.recRedMuted} opacity={0.7} />
          </Marker>
          <Marker
            id="tip-loop"
            viewBox="0 0 8 8"
            markerWidth={7}
            markerHeight={7}
            refX={7}
            refY={4}
            orient="auto"
          >
            <Path d="M 0 0 L 8 4 L 0 8 Z" fill={c.bronzeLight} opacity={0.82} />
          </Marker>
        </Defs>

        {/* SEQUENCE · pipeline i → i+1 · linha vertical fina + seta + fluxo */}
        {orderedSteps.slice(0, -1).map((step, index) => {
          const nextStep = orderedSteps[index + 1]
          const from = pipelineAnchor(step, orderedSteps, 'bottom')
          const to = pipelineAnchor(nextStep, orderedSteps, 'top')
          const d = `M ${from.x} ${from.y} L ${to.x} ${to.y - 4}`
          // Trail kin do focused atom · acende
          const isKin = focusedStep
            ? step.id === focusedStep.id || nextStep.id === focusedStep.id
            : false
          return (
            <AnimatedPath
              key={`seq-${step.num}`}
              d={d}
              stroke={isKin ? c.bronzeLight : c.bronze}
              strokeOpacity={focusedId ? (isKin ? 0.95 : 0.16) : 0.42}
              strokeWidth={isKin ? 1.8 : 1.2}
              strokeDasharray="6,8"
              animatedProps={animatedDashProps}
              fill="none"
              vectorEffect="non-scaling-stroke"
              markerEnd="url(#tip-bronze)"
            />
          )
        })}

        {/* FEED · lanes → pipeline (bezier lateral) com fluxo direcional.
            Kin: feed lane que conecta no atom focado · acende mais visível
            (ensina que aquela lane alimenta este passo). */}
        {(feedConnections
          ? lanes.filter((lane) => feedConnections.some((connection) => connection.from === lane.id && !lane.feedback && connection.kind !== 'feedback'))
          : lanes.filter((l) => l.feedsInto && !l.feedback)
        ).map((lane) => {
          const liveFeed = feedConnections?.find((connection) => connection.from === lane.id && connection.kind !== 'feedback')
          const targetId = liveFeed?.to ?? lane.feedsInto
          const step = orderedSteps.find((s) => s.id === targetId)
          if (!step) return null
          const isLeft = lane.side === 'left' || lane.side === 'center'
          const from = laneAnchor(lane.id, lanes, isLeft ? 'right' : 'left')
          const to = pipelineAnchor(step, orderedSteps, isLeft ? 'left' : 'right')
          if (!from || !to) return null
          const isKin = focusedId === targetId
          const opacity = focusedId ? (isKin ? 0.95 : 0.035) : 0.42
          const side = isLeft ? 'left' : 'right'
          const labelX = isLeft ? to.x - 78 : to.x + 18
          const labelY = to.y - 10
          return (
            <Fragment key={`feed-${lane.id}`}>
              <AnimatedPath
                d={elbowBetween(from, to, side)}
                stroke={isKin ? c.bronzeLight : c.bronze}
                strokeOpacity={opacity}
                strokeWidth={isKin ? 2.2 : 1.35}
                strokeDasharray={isKin ? '8,7' : '4,10'}
                animatedProps={animatedDashProps}
                fill="none"
                vectorEffect="non-scaling-stroke"
                markerEnd="url(#tip-bronze)"
              />
              <Circle cx={to.x} cy={to.y} r={isKin ? 5 : 3.5} fill={c.bronze} opacity={opacity} />
              {isKin ? (
                <SvgText
                  x={labelX}
                  y={labelY}
                  fill={c.bronze}
                  opacity={0.95}
                  fontSize={11}
                  fontWeight="700"
                  textAnchor={isLeft ? 'end' : 'start'}
                >
                  {lane.name} → {step.num}
                </SvgText>
              ) : null}
            </Fragment>
          )
        })}

        {/* FEEDBACK · Evidence Loop → Atlas Decide · loop dashed.
            Acende mais quando user foca o Atlas Decide canônico — loop
            de evidência vira protagonista visual. */}
        {(feedConnections
          ? lanes.filter((lane) => feedConnections.some((connection) => connection.from === lane.id && connection.kind === 'feedback'))
          : lanes.filter((l) => l.feedback && l.feedsInto)
        ).map((lane) => {
          const liveFeed = feedConnections?.find((connection) => connection.from === lane.id && connection.kind === 'feedback')
          const targetId = liveFeed?.to ?? lane.feedsInto
          const step = orderedSteps.find((s) => s.id === targetId)
          if (!step) return null
          const from = laneAnchor(lane.id, lanes, 'left')
          const to = pipelineAnchor(step, orderedSteps, 'right')
          if (!from || !to) return null
          const isKin = focusedId === targetId
          const opacity = focusedId ? (isKin ? 0.95 : 0.035) : 0.4
          return (
            <Fragment key={`fb-${lane.id}`}>
              <Path
                d={feedbackArc(to, from)}
                stroke={isKin ? c.bronze : c.bronzeLight}
                strokeOpacity={opacity}
                strokeWidth={isKin ? 2 : 1.1}
                strokeDasharray="5,5"
                fill="none"
                vectorEffect="non-scaling-stroke"
                markerEnd="url(#tip-loop)"
              />
              <Circle cx={from.x} cy={from.y} r={isKin ? 4 : 2.8} fill={c.bronzeLight} opacity={opacity * 0.85} />
              <Circle cx={to.x} cy={to.y} r={isKin ? 5 : 3.5} fill={c.bronze} opacity={opacity} />
              {isKin ? (
                <SvgText
                  x={to.x + 18}
                  y={to.y - 12}
                  fill={c.bronze}
                  opacity={0.95}
                  fontSize={11}
                  fontWeight="700"
                >
                  {lane.name} ↺ {step.num}
                </SvgText>
              ) : null}
            </Fragment>
          )
        })}

        {/* Hero halo · Atlas Decide ganha ring duplo pulsando junto */}
        {(() => {
          const hero = orderedSteps.find((s) => s.hero)
          if (!hero) return null
          const anchor = pipelineAnchor(hero, orderedSteps, 'left')
          const cy = anchor.y
          const cx = PIPELINE_X + PIPELINE_WIDTH / 2
          return (
            <>
              <Circle cx={cx} cy={cy} r={PIPELINE_WIDTH / 2 + 18} stroke={c.bronze} strokeOpacity={0.16} strokeWidth={1} fill="none" />
              <Circle cx={cx} cy={cy} r={PIPELINE_WIDTH / 2 + 32} stroke={c.bronze} strokeOpacity={0.08} strokeWidth={0.7} fill="none" />
            </>
          )
        })()}
      </Svg>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  svg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
})
