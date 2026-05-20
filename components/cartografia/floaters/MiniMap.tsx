/**
 * Cartografia · mini-mapa flutuante (top-left).
 *
 * Pequeno overview do mundo em silhueta · retângulo bronze indica onde
 * o viewport real está focado. Sync ao vivo com pan/zoom via Reanimated
 * useAnimatedProps.
 *
 * Visual canon: editorial NYRB plate · cream-edged rect + dots dos atoms
 * + viewport indicator burnished gold. Sem texto.
 *
 * Tap no mini-mapa = teleport (recentraliza viewport naquele ponto).
 */
import { useCallback, useState } from 'react'
import { Platform, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native'
import { BlurView } from 'expo-blur'
import Animated, {
  useAnimatedProps,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Rect, Circle, type RectProps } from 'react-native-svg'
import { useTheme, usePalette } from '../../../design/theme'
import { UNIVERSE_CONTINENTS, WORLD_HEIGHT, WORLD_WIDTH } from '../map/layout'
import {
  PIPELINE_STEPS,
  LANE_DEFINITIONS,
  PIPELINE_WIDTH,
  PIPELINE_X,
  pipelineStepHeightFor,
  pipelineStepYForSteps,
  type LaneDef,
  type PipelineStep,
} from '../map/atlasFlowData'
import { findContinentScene, radialAnchor } from '../map/continentNodes'

const AnimatedRect = Animated.createAnimatedComponent(Rect)

const MINI_W = 110
const MINI_H = (WORLD_HEIGHT / WORLD_WIDTH) * MINI_W // proporcional

interface Props {
  scale: SharedValue<number>
  translateX: SharedValue<number>
  translateY: SharedValue<number>
  viewportW: number
  viewportH: number
  view: 'universe' | 'flow' | 'gear' | 'subflow'
  continentId: string | null
  pipelineSteps?: ReadonlyArray<PipelineStep>
  lanes?: ReadonlyArray<LaneDef>
  /** Teleport: world point onde centralizar viewport */
  onTeleport: (worldX: number, worldY: number) => void
}

export function MiniMap({
  scale,
  translateX,
  translateY,
  viewportW,
  viewportH,
  view,
  continentId,
  pipelineSteps,
  lanes,
  onTeleport,
}: Props) {
  const c = usePalette()
  const { name: themeName } = useTheme()
  const [layoutSize, setLayoutSize] = useState({ w: MINI_W, h: MINI_H })

  // Animated props do viewport rect · sempre sincronizado com pan/zoom
  const animatedRectProps = useAnimatedProps<RectProps>(() => {
    const s = scale.value
    if (s <= 0) return {}
    // Visual top-left do world em screen = (translateX, translateY).
    // World point at (0,0) is visually at (translateX, translateY).
    // World point at (W, H) is visually at (translateX + W*s, translateY + H*s).
    // Viewport sees screen (0, 0) to (viewportW, viewportH).
    // Inverse: world coords visible = ((-tx)/s, (-ty)/s) to ((viewportW-tx)/s, (viewportH-ty)/s)
    const wx1 = (-translateX.value) / s
    const wy1 = (-translateY.value) / s
    const wx2 = (viewportW - translateX.value) / s
    const wy2 = (viewportH - translateY.value) / s
    // Clamp to world bounds for the indicator
    const cx1 = Math.max(0, Math.min(WORLD_WIDTH, wx1))
    const cy1 = Math.max(0, Math.min(WORLD_HEIGHT, wy1))
    const cx2 = Math.max(0, Math.min(WORLD_WIDTH, wx2))
    const cy2 = Math.max(0, Math.min(WORLD_HEIGHT, wy2))
    // Convert to mini-map coords
    const mw = layoutSize.w
    const mh = layoutSize.h
    return {
      x: (cx1 / WORLD_WIDTH) * mw,
      y: (cy1 / WORLD_HEIGHT) * mh,
      width: ((cx2 - cx1) / WORLD_WIDTH) * mw,
      height: ((cy2 - cy1) / WORLD_HEIGHT) * mh,
    }
  })

  const handleTap = useCallback(
    (e: GestureResponderEvent) => {
      const { locationX, locationY } = e.nativeEvent
      const mw = layoutSize.w
      const mh = layoutSize.h
      const wx = (locationX / mw) * WORLD_WIDTH
      const wy = (locationY / mh) * WORLD_HEIGHT
      onTeleport(wx, wy)
    },
    [layoutSize, onTeleport],
  )

  // Compute dots based on current scene
  const dots = computeMiniDots(view, continentId, pipelineSteps, lanes)

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: Platform.OS === 'ios' ? 'rgba(15, 24, 31, 0.42)' : c.bgRecessed,
          borderColor: c.borderSoft,
        },
      ]}
      pointerEvents="box-none"
    >
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={26}
          tint={themeName === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <Pressable
        onPress={handleTap}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout
          if (width !== layoutSize.w || height !== layoutSize.h) {
            setLayoutSize({ w: width, h: height })
          }
        }}
        style={styles.tapArea}
        accessibilityRole="button"
        accessibilityLabel="Mini-mapa · tap pra teleportar"
      >
        <Svg width={layoutSize.w} height={layoutSize.h} viewBox={`0 0 ${layoutSize.w} ${layoutSize.h}`}>
          {/* World silhueta · borda hairline */}
          <Rect
            x={0.5}
            y={0.5}
            width={layoutSize.w - 1}
            height={layoutSize.h - 1}
            stroke={c.borderSoft}
            strokeWidth={0.6}
            fill="none"
          />
          {/* Atoms dots */}
          {dots.map((d, i) => (
            <Circle
              key={`mini-${i}`}
              cx={(d.x / WORLD_WIDTH) * layoutSize.w}
              cy={(d.y / WORLD_HEIGHT) * layoutSize.h}
              r={d.r}
              fill={d.color}
              opacity={d.opacity}
            />
          ))}
          {/* Viewport indicator · animated */}
          <AnimatedRect
            animatedProps={animatedRectProps}
            stroke={c.bronze}
            strokeWidth={1.2}
            fill={c.bronze}
            fillOpacity={0.10}
          />
        </Svg>
      </Pressable>
    </View>
  )
}

interface MiniDot {
  x: number
  y: number
  r: number
  color: string
  opacity: number
}

function computeMiniDots(
  view: string,
  continentId: string | null,
  pipelineSteps: ReadonlyArray<PipelineStep> = PIPELINE_STEPS,
  lanes: ReadonlyArray<LaneDef> = LANE_DEFINITIONS,
): MiniDot[] {
  // Universe view: 6 continentes
  if (view === 'universe' || !continentId) {
    return UNIVERSE_CONTINENTS.map((cont) => ({
      x: cont.x + cont.w / 2,
      y: cont.y + cont.h / 2,
      r: cont.id === 'atlas' ? 3 : 2.2,
      color: '#d4a85a', // bronze hardcoded · mini não tem access ao palette
      opacity: cont.id === 'atlas' ? 1 : 0.7,
    }))
  }
  // Flow Atlas: pipeline atoms
  if (continentId === 'atlas') {
    const orderedSteps = [...pipelineSteps].sort((a, b) => a.num - b.num)
    const dots: MiniDot[] = orderedSteps.map((step) => ({
      x: PIPELINE_X + PIPELINE_WIDTH / 2,
      y: pipelineStepYForSteps(step.num, orderedSteps) + pipelineStepHeightFor(step) / 2,
      r: step.hero ? 2 : 1.4,
      color: '#d4a85a',
      opacity: step.hero ? 1 : 0.55,
    }))
    lanes.forEach((lane) => {
      dots.push({
        x: lane.x + lane.w / 2,
        y: lane.y + lane.h / 2,
        r: 1.6,
        color: '#95a3ac',
        opacity: 0.5,
      })
    })
    return dots
  }
  // Other continents: radial nodes
  const scene = findContinentScene(continentId)
  if (!scene) return []
  const total = scene.nodes.length
  const cx = WORLD_WIDTH / 2
  const cy = WORLD_HEIGHT / 2
  return scene.nodes.map((node, i) => {
    const a = radialAnchor(cx, cy, scene.radius, i, total, scene.startAngle)
    return {
      x: a.x,
      y: a.y,
      r: 1.6,
      color: node.risk ? '#d05a52' : '#d4a85a',
      opacity: 0.75,
    }
  })
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 14,
    left: 14,
    borderWidth: 1,
    borderRadius: 6,
    padding: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.36,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  tapArea: {
    width: MINI_W,
    height: MINI_H,
  },
})
