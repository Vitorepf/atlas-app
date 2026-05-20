/**
 * Cartografia · região (lane lateral) com atoms internos.
 *
 * Renderiza um container com cabeçalho discreto (eyebrow Mono caps + nome
 * Frau italic) e empilha os nodes em sequência vertical.
 *
 * Cabeçalho visual ensina que é uma "lane" (não pipeline) através de:
 *   - tipografia menor e mais quieta
 *   - hairline lateral (canto esquerdo/direito dependendo do side)
 *   - background bgRecessed (afunda · sussurro)
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, useReducedMotion } from 'react-native-reanimated'
import { usePalette } from '../../../design/theme'
import { Frau, Mono } from '../../../design/Type'
import { AtomTouchable } from './AtomTouchable'
import { PIPELINE_STEPS, type LaneDef, type PipelineStep } from './atlasFlowData'
import { type LodLevel } from './layout'

type HealthNode = {
  missingSource?: boolean
  graphSource?: string
}

type HealthLane = LaneDef & HealthNode

interface Props {
  lane: LaneDef
  lod: LodLevel
  onLaneLongPress?: (id: string) => void
  onNodePress: (id: string) => void
  onNodeLongPress?: (id: string) => void
  revealIndex: number
  /** Lane alimenta o atom focused · ganha border bronze acesa */
  isKin?: boolean
  targetStep?: PipelineStep
}

export function LaneRegion({
  lane,
  lod,
  onLaneLongPress,
  onNodePress,
  onNodeLongPress,
  revealIndex,
  isKin,
  targetStep,
}: Props) {
  const c = usePalette()
  const reduced = useReducedMotion()
  const showNodes = lod !== 'far'
  const nodeMinHeight = lod === 'close' ? 56 : 44
  const healthLane = lane as HealthLane
  const laneMissing = healthLane.missingSource || healthLane.graphSource === 'missing'
  const target = targetStep ?? PIPELINE_STEPS.find((step) => step.id === lane.feedsInto)
  const visibleNodes = lod === 'far' ? lane.nodes.slice(0, 3) : lane.nodes
  const missingCount = lane.nodes.filter((node) => {
    const healthNode = node as typeof node & HealthNode
    return healthNode.missingSource || healthNode.graphSource === 'missing'
  }).length
  const headerHeight = 138 + (lod === 'close' ? 54 : 0) + (target ? 72 : 0)
  const bodyHeight = showNodes
    ? visibleNodes.length * (nodeMinHeight + 10) + Math.max(0, visibleNodes.length - 1) * 8 + 34 + (missingCount > 0 ? 28 : 0)
    : 0
  const dynamicHeight = Math.max(lane.h, headerHeight + bodyHeight + 72)

  const shellStyle: StyleProp<ViewStyle> = {
    position: 'absolute',
    left: lane.x,
    top: lane.y,
    width: lane.w,
    minHeight: dynamicHeight,
  }

  return (
    <Animated.View
      style={shellStyle}
      entering={reduced
        ? undefined
        : FadeIn.duration(420)
            .delay(120 + revealIndex * 60)
            .easing(Easing.bezier(0.16, 1, 0.3, 1))}
    >
      <View
        style={[
          styles.region,
          {
            minHeight: dynamicHeight,
            backgroundColor: c.bgRecessed,
            borderColor: laneMissing ? c.recRed : isKin ? c.bronze : c.borderSoft,
            borderWidth: laneMissing || isKin ? 1.2 : 1,
          },
        ]}
      >
      <AtomTouchable
        onPress={() => {}}
        onLongPress={onLaneLongPress ? () => onLaneLongPress(lane.id) : undefined}
        shellStyle={styles.regionLongPressSurface}
        maxDistance={16}
        pressOpacity={1}
        liftAmount={0}
      >
        <View style={StyleSheet.absoluteFillObject} />
      </AtomTouchable>
      {target ? (
        <View
          style={[
            styles.targetPin,
            lane.side === 'right' ? styles.targetPinLeft : styles.targetPinRight,
            { backgroundColor: isKin ? c.bronze : c.borderSoft },
          ]}
        />
      ) : null}
      {target ? (
        <View
          pointerEvents="none"
          style={[
            styles.flowPort,
            lane.side === 'right' ? styles.flowPortLeft : styles.flowPortRight,
          ]}
        >
          <View style={[styles.portSocket, { borderColor: isKin ? c.bronzeLight : c.bronze, backgroundColor: c.bgRecessed }]} />
          <View style={[styles.portRail, { backgroundColor: isKin ? c.bronzeLight : c.bronze }]} />
          <Mono size={11} letterSpacing={0.4} color={isKin ? c.bronzeLight : c.bronze} style={styles.portArrow}>
            {lane.side === 'right' ? '←' : '→'}
          </Mono>
        </View>
      ) : null}
      <AtomTouchable
        onPress={() => {}}
        onLongPress={onLaneLongPress ? () => onLaneLongPress(lane.id) : undefined}
        shellStyle={styles.headTouch}
        maxDistance={16}
      >
        <View style={styles.head}>
          <Mono size={9.5} letterSpacing={1.8} color={c.bronze}>
            {lane.side === 'right' ? '◂ ' : lane.side === 'left' ? '▸ ' : '◆ '}
            LANE
          </Mono>
          <Frau italic weight="med" size={16} lineHeight={20} color={c.ink} style={styles.headName}>
            {lane.name}
          </Frau>
          {lod === 'close' ? (
            <Frau italic size={11} lineHeight={15} color={c.ink2} style={styles.headDeck}>
              {lane.deck}
            </Frau>
          ) : null}
          {target ? (
            <View style={[styles.targetBadge, { borderColor: isKin ? c.bronze : c.borderSoft }]}>
              <Mono size={8.5} letterSpacing={1.1} color={isKin ? c.bronze : c.ink3}>
                {lane.feedback ? 'RETORNA PARA' : 'ALIMENTA'} · {target.num}
              </Mono>
              <Frau italic size={11} lineHeight={14} color={isKin ? c.bronzeLight : c.ink2}>
                {target.name}
              </Frau>
              <View style={styles.microRoute} pointerEvents="none">
                <View style={[styles.microDot, { backgroundColor: c.bronze, opacity: isKin ? 0.95 : 0.45 }]} />
                <View style={[styles.microLine, { backgroundColor: c.bronze, opacity: isKin ? 0.75 : 0.24 }]} />
                <Mono size={8} letterSpacing={0.2} color={isKin ? c.bronzeLight : c.ink3}>
                  {lane.feedback ? '↺' : '→'}
                </Mono>
                <View style={[styles.microDot, { backgroundColor: isKin ? c.bronzeLight : c.ink3, opacity: isKin ? 0.95 : 0.35 }]} />
              </View>
            </View>
          ) : null}
          <View style={styles.headAffordances} pointerEvents="none">
            <Mono size={9} letterSpacing={0.8} color={c.ink3}>
              ☰
            </Mono>
          </View>
        </View>
      </AtomTouchable>

      <View style={[styles.headDivider, { backgroundColor: c.bronze, opacity: 0.18 }]} />

      {showNodes ? (
        <View style={styles.body}>
          {visibleNodes.map((node) => {
            const healthNode = node as typeof node & HealthNode
            const nodeMissing = healthNode.missingSource || healthNode.graphSource === 'missing'
            return (
              <AtomTouchable
                key={node.id}
                onPress={() => onNodePress(node.id)}
                onLongPress={onNodeLongPress ? () => onNodeLongPress(node.id) : undefined}
                shellStyle={[
                  styles.node,
                  {
                    minHeight: nodeMinHeight,
                    borderColor: c.borderSoft,
                  },
                ]}
              >
                <View
                  style={[
                    styles.nodeDot,
                    {
                      backgroundColor: nodeMissing ? c.recRed : c.bronze,
                      opacity: nodeMissing ? 0.92 : 0.55,
                    },
                  ]}
                />
                <Frau italic size={13} lineHeight={18} color={c.ink2} style={styles.nodeLabel}>
                  {node.name}
                </Frau>
                <View style={styles.nodeAffordances} pointerEvents="none">
                  <Mono size={8.5} letterSpacing={0.6} color={c.bronze}>
                    ↧
                  </Mono>
                  <Mono size={8.5} letterSpacing={0.6} color={c.ink3}>
                    ☰
                  </Mono>
                </View>
              </AtomTouchable>
            )
          })}
          {visibleNodes.length < lane.nodes.length ? (
            <Mono size={9} letterSpacing={0.9} color={c.ink3} style={styles.moreNodes}>
              +{lane.nodes.length - visibleNodes.length} PEÇAS
            </Mono>
          ) : null}
          {missingCount > 0 ? (
            <Mono size={8.5} letterSpacing={0.8} color={c.recRed} style={styles.missingHint}>
              {missingCount} FONTE{missingCount === 1 ? '' : 'S'} AUSENTE{missingCount === 1 ? '' : 'S'}
            </Mono>
          ) : null}
        </View>
      ) : null}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  region: {
    borderWidth: 1,
    borderRadius: 3,
    padding: 14,
    overflow: 'visible',
  },
  regionLongPressSurface: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  targetPin: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    opacity: 0.75,
  },
  targetPinRight: {
    right: 0,
  },
  targetPinLeft: {
    left: 0,
  },
  flowPort: {
    position: 'absolute',
    top: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    opacity: 0.88,
  },
  flowPortRight: {
    right: -18,
  },
  flowPortLeft: {
    left: -18,
  },
  portSocket: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.2,
  },
  portRail: {
    width: 16,
    height: 1,
  },
  portArrow: {
    marginTop: -1,
  },
  headTouch: {
    marginBottom: 8,
    zIndex: 2,
  },
  head: {
    minHeight: 34,
  },
  headAffordances: {
    position: 'absolute',
    top: 0,
    right: 0,
    opacity: 0.72,
  },
  headName: {
    marginTop: 4,
  },
  headDeck: {
    marginTop: 2,
  },
  targetBadge: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 2,
    alignSelf: 'flex-start',
  },
  microRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  microDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  microLine: {
    width: 28,
    height: 1,
  },
  headDivider: {
    height: 1,
    marginBottom: 10,
  },
  body: {
    gap: 6,
    zIndex: 2,
  },
  node: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  nodeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  nodeLabel: {
    flex: 1,
    flexShrink: 1,
  },
  nodeAffordances: {
    flexDirection: 'row',
    gap: 5,
    opacity: 0.72,
  },
  moreNodes: {
    marginTop: 4,
    marginLeft: 8,
  },
  missingHint: {
    marginTop: 2,
    marginLeft: 8,
  },
})
