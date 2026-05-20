/**
 * Cartografia · flow scene do continente Atlas.
 *
 * Cena que mostra o Atlas AI Kernel Pipeline completo com lanes laterais
 * e trilhas canon entre tudo.
 *
 * Quando dados live estão disponíveis, usa-os. Caso contrário, fallback
 * para os dados estáticos de `atlasFlowData.ts`.
 *
 * Ordem de render (back → front):
 *   1. FlowTrails    · SVG no fundo, escala com world
 *   2. Lanes         · containers laterais
 *   3. Pipeline      · atoms numerados no centro (camada visual top)
 */
import { StyleSheet, View } from 'react-native'
import { LaneRegion } from '../map/LaneRegion'
import { PipelineAtom } from '../map/PipelineAtom'
import { FlowTrails } from '../map/FlowTrails'
import { AtomTouchable } from '../map/AtomTouchable'
import { Frau, Mono } from '../../../design/Type'
import { usePalette } from '../../../design/theme'
import {
  LANE_DEFINITIONS,
  PIPELINE_STEPS,
  PIPELINE_WIDTH,
  PIPELINE_X,
  pipelineStepHeightFor,
  pipelineStepYForSteps,
} from '../map/atlasFlowData'
import { type LodLevel } from '../map/layout'
import {
  findSemanticNode,
  type AdaptedConnection,
  type AdaptedLane,
  type AdaptedPipelineStep,
  type LiveSemanticGraph,
} from '../state/useCartografiaLiveData'

interface Props {
  lod: LodLevel
  onStepPress: (id: string) => void
  onStepLongPress?: (id: string) => void
  onFlowLongPress?: () => void
  onLaneLongPress?: (id: string) => void
  onLaneNodePress: (id: string) => void
  onLaneNodeLongPress?: (id: string) => void
  focusedId: string | null
  /** Steps live da API (quando disponíveis) */
  liveSteps?: AdaptedPipelineStep[]
  /** Lanes live da API adaptadas para a geometria mobile */
  liveLanes?: AdaptedLane[]
  /** Conexões canônicas resolvidas para ids da UI */
  connections?: AdaptedConnection[]
  /** Semantic graph para lookup de graph_status */
  semanticGraph?: LiveSemanticGraph | null
}

export function FlowScene({
  lod,
  onStepPress,
  onStepLongPress,
  onFlowLongPress,
  onLaneLongPress,
  onLaneNodePress,
  onLaneNodeLongPress,
  focusedId,
  liveSteps,
  liveLanes,
  connections,
  semanticGraph,
}: Props) {
  const c = usePalette()
  // Usa steps live se disponíveis, senão fallback estático
  const steps = liveSteps ?? PIPELINE_STEPS
  const lanes = liveLanes ?? LANE_DEFINITIONS
  const rootY = pipelineStepYForSteps(1, steps) - 106

  return (
    <>
      <FlowTrails focusedId={focusedId} steps={steps} lanes={lanes} connections={connections} />
      <AtomTouchable
        onPress={() => {}}
        onLongPress={onFlowLongPress}
        shellStyle={[
          styles.flowRoot,
          {
            left: PIPELINE_X + PIPELINE_WIDTH / 2 - 92,
            top: rootY,
            borderColor: c.bronze,
            backgroundColor: c.bgRecessed,
          },
        ]}
        maxDistance={16}
      >
        <View style={[styles.flowRootHalo, { borderColor: c.borderSoft }]} />
        <Mono size={8.5} letterSpacing={1.1} color={c.bronze}>
          FLUXO-MAE
        </Mono>
        <Frau italic weight="med" size={15} lineHeight={18} color={c.ink} numberOfLines={2}>
          Atlas AI Kernel
        </Frau>
        {lod === 'close' ? (
          <Frau italic size={10.5} lineHeight={13} color={c.ink2} numberOfLines={2}>
            input → decisão → prova → saída
          </Frau>
        ) : null}
      </AtomTouchable>
      {lanes.map((lane, i) => (
        <LaneRegion
          key={lane.id}
          lane={lane}
          lod={lod}
          onLaneLongPress={onLaneLongPress}
          onNodePress={onLaneNodePress}
          onNodeLongPress={onLaneNodeLongPress}
          revealIndex={i}
          isKin={Boolean(focusedId) && lane.feedsInto === focusedId}
          targetStep={steps.find((step) => step.id === lane.feedsInto)}
        />
      ))}
      {steps.map((step) => {
        const focusedStep = focusedId
          ? steps.find((s) => s.id === focusedId)
          : null
        const isKin = focusedStep
          ? Math.abs(step.num - focusedStep.num) === 1
          : false

        // Busca graph_status do SemanticNode correspondente
        const adaptedStep = step as AdaptedPipelineStep
        const semanticNode = semanticGraph
          ? findSemanticNode(semanticGraph, adaptedStep.graphId ?? `pipe-${step.num}`)
          : undefined

        return (
          <PipelineAtom
            key={step.id}
            step={step}
            lod={lod}
            onPress={onStepPress}
            onLongPress={onStepLongPress}
            isFocused={focusedId === step.id}
            isKin={isKin}
            graphSource={adaptedStep.graphSource}
            missingSource={adaptedStep.missingSource}
            graphStatus={semanticNode?.graph_status}
            positionY={pipelineStepYForSteps(step.num, steps)}
            atomHeight={pipelineStepHeightFor(step) - 12}
          />
        )
      })}
    </>
  )
}

const styles = StyleSheet.create({
  flowRoot: {
    position: 'absolute',
    width: 184,
    minHeight: 58,
    borderWidth: 1.2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  flowRootHalo: {
    position: 'absolute',
    top: -16,
    left: -16,
    right: -16,
    bottom: -16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    opacity: 0.65,
  },
})
