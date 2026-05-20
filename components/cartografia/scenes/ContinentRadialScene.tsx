/**
 * Cartografia · cena radial pra continentes não-Atlas.
 *
 * Layout canon: glifo grande do continente no centro · nodes orbitam
 * em raio fixo · trail bronze fina conecta cada node ao centro.
 *
 * A topologia fala sozinha: "todos esses nodes pertencem a este
 * continente · este continente é o que o glifo representa". Sem
 * legenda escrita.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeInDown } from 'react-native-reanimated'
import Svg, { Circle, Line } from 'react-native-svg'
import { usePalette } from '../../../design/theme'
import { Frau, Mono } from '../../../design/Type'
import { AtomTouchable } from '../map/AtomTouchable'
import { ContinentGlyph } from '../map/ContinentGlyph'
import { NodeGlyph } from '../map/NodeGlyph'
import { useTrailPulse } from '../map/useTrailPulse'
import { useReducedMotion } from 'react-native-reanimated'
import {
  findContinentScene,
  radialAnchor,
  type ContinentNode,
} from '../map/continentNodes'
import { WORLD_HEIGHT, WORLD_WIDTH, type LodLevel } from '../map/layout'

interface Props {
  continentId: string
  lod: LodLevel
  onCenterLongPress?: (id: string) => void
  onNodePress: (id: string) => void
  onNodeLongPress?: (id: string) => void
}

const CENTER_X = WORLD_WIDTH / 2
const CENTER_Y = WORLD_HEIGHT / 2
const NODE_W = 280
const NODE_H = 120

export function ContinentRadialScene({ continentId, lod, onCenterLongPress, onNodePress, onNodeLongPress }: Props) {
  const c = usePalette()
  const reduced = useReducedMotion()
  const pulseStyle = useTrailPulse({ enabled: !reduced, min: 0.78 })
  const scene = findContinentScene(continentId)
  if (!scene) return null

  const showDeck = lod !== 'far'
  const total = scene.nodes.length

  return (
    <>
      {/* Trail bronze fina · centro → cada node */}
      <Animated.View
        style={[styles.svg, pulseStyle as StyleProp<ViewStyle>]}
        pointerEvents="none"
        entering={FadeIn.duration(620).delay(280).easing(Easing.bezier(0.16, 1, 0.3, 1))}
      >
        <Svg
          width={WORLD_WIDTH}
          height={WORLD_HEIGHT}
          viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
        >
          {scene.nodes.map((node, i) => {
            const a = radialAnchor(CENTER_X, CENTER_Y, scene.radius, i, total, scene.startAngle)
            const isRisk = node.risk
            return (
              <Line
                key={`trail-${node.id}`}
                x1={CENTER_X}
                y1={CENTER_Y}
                x2={a.x}
                y2={a.y}
                stroke={isRisk ? c.recRedMuted : c.bronze}
                strokeOpacity={isRisk ? 0.4 : 0.4}
                strokeWidth={1.0}
              />
            )
          })}
          {/* Halo central */}
          <Circle cx={CENTER_X} cy={CENTER_Y} r={120} stroke={c.bronze} strokeOpacity={0.18} strokeWidth={1.2} fill="none" />
          <Circle cx={CENTER_X} cy={CENTER_Y} r={150} stroke={c.bronze} strokeOpacity={0.09} strokeWidth={0.8} fill="none" />
        </Svg>
      </Animated.View>

      {/* Glifo central */}
      <AtomTouchable
        onPress={() => {}}
        onLongPress={onCenterLongPress ? () => onCenterLongPress(continentId) : undefined}
        shellStyle={[
          styles.center,
          {
            left: CENTER_X - 90,
            top: CENTER_Y - 90,
            width: 180,
            height: 180,
            backgroundColor: c.bgRaised,
            borderColor: c.bronze,
          },
        ]}
        maxDistance={16}
      >
        <ContinentGlyph continentId={continentId} size={140} color={c.bronze} detailColor={c.ink3} />
        <View style={styles.centerAffordance} pointerEvents="none">
          <Mono size={10} letterSpacing={0.8} color={c.ink3}>
            ☰
          </Mono>
        </View>
      </AtomTouchable>

      {/* Nodes em órbita */}
      {scene.nodes.map((node, i) => {
        const a = radialAnchor(CENTER_X, CENTER_Y, scene.radius, i, total, scene.startAngle)
        return (
          <OrbitNode
            key={node.id}
            node={node}
            x={a.x - NODE_W / 2}
            y={a.y - NODE_H / 2}
            showDeck={showDeck}
            onPress={onNodePress}
            onLongPress={onNodeLongPress}
            revealIndex={i}
          />
        )
      })}
    </>
  )
}

function OrbitNode({
  node,
  x,
  y,
  showDeck,
  onPress,
  onLongPress,
  revealIndex,
}: {
  node: ContinentNode
  x: number
  y: number
  showDeck: boolean
  onPress: (id: string) => void
  onLongPress?: (id: string) => void
  revealIndex: number
}) {
  const c = usePalette()
  const accent = node.risk ? c.recRedMuted : c.bronze
  const opensFlow = Boolean(node.graphId)

  const shellStyle: StyleProp<ViewStyle> = {
    position: 'absolute',
    left: x,
    top: y,
    width: NODE_W,
    height: NODE_H,
  }

  return (
    <Animated.View
      style={shellStyle}
      entering={FadeInDown.duration(360)
        .delay(180 + revealIndex * 70)
        .easing(Easing.bezier(0.16, 1, 0.3, 1))}
    >
      <AtomTouchable
        onPress={() => onPress(node.id)}
        onLongPress={onLongPress ? () => onLongPress(node.id) : undefined}
        shellStyle={[
          styles.node,
          {
            backgroundColor: c.bgRaised,
            borderColor: c.border,
          },
        ]}
      >
        <View style={styles.nodeHeader}>
          <NodeGlyph kind={node.kind} size={14} color={accent} />
          {node.risk ? (
            <Mono size={9.5} letterSpacing={1.6} color={c.recRedMuted}>
              ABERTO
            </Mono>
          ) : null}
        </View>
        <Frau italic weight="med" size={17} lineHeight={20} color={c.ink} numberOfLines={2}>
          {node.name}
        </Frau>
        {showDeck ? (
          <Frau italic size={11} lineHeight={14} color={c.ink2} numberOfLines={2}>
            {node.deck}
          </Frau>
        ) : null}
        <View style={styles.nodeFooter} pointerEvents="none">
          <Mono size={7.1} letterSpacing={0.78} color={opensFlow ? accent : c.ink3}>
            {opensFlow ? 'TOQUE · ABRE FLUXO' : 'TOQUE · LOCALIZA'}
          </Mono>
          <View style={styles.nodeAffordances}>
            <Mono size={8.8} letterSpacing={0.6} color={opensFlow ? accent : c.ink3}>
              {opensFlow ? '↧' : '•'}
            </Mono>
            <Mono size={8.8} letterSpacing={0.6} color={c.ink3}>
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
  center: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerAffordance: {
    position: 'absolute',
    right: 10,
    top: 10,
  },
  node: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  nodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nodeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    opacity: 0.82,
  },
  nodeAffordances: {
    flexDirection: 'row',
    gap: 6,
  },
  nodeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
})
