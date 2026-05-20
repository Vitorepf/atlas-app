/**
 * Cartografia · trilhas universe.
 *
 * Atlas no centro irradia pra cada continente lateral via bezier curvas.
 * As trilhas **carregam o significado** da topologia: você vê de imediato
 * que tudo passa pelo Atlas. Sem precisar de legenda.
 *
 * Cada trilha tem sentido visual canon:
 *   - sólida bronze · relação primária estabelecida (Atlas ↔ Memória,
 *     Atlas ↔ Filosofia)
 *   - dashed bronze-soft · relação de construção (Atlas ↔ Obras,
 *     Atlas ↔ Forge — trabalho em curso)
 *   - dashed rec-red · relação de obstrução (Atlas ↔ Gargalos)
 *
 * Motion: stroke pulsa via opacity 0.45 → 0.85 → 0.45 num ciclo de ~3.6s.
 * Marcador "vida": fluxo passando, não imagem estática.
 *
 * Coordenadas em world-space (mesmo sistema dos atoms). Trilhas vivem
 * DENTRO do `.world` no Animated.View — escalam junto com pan/zoom via
 * transform parent. Zero recalc.
 */
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  useAnimatedProps,
  useReducedMotion,
} from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { usePalette } from '../../../design/theme'
import { UNIVERSE_CONTINENTS, WORLD_HEIGHT, WORLD_WIDTH } from './layout'
import { useTrailPulse } from './useTrailPulse'
import { useTrailFlow } from './useTrailFlow'

const AnimatedPath = Animated.createAnimatedComponent(Path)

interface TrailDef {
  fromId: 'atlas'
  toId: string
  kind: 'primary' | 'construction' | 'obstruction'
}

// Trilhas canônicas universe · Atlas é o centro de tudo.
const TRAILS: ReadonlyArray<TrailDef> = [
  { fromId: 'atlas', toId: 'memory', kind: 'primary' },
  { fromId: 'atlas', toId: 'philosophy', kind: 'primary' },
  { fromId: 'atlas', toId: 'works', kind: 'construction' },
  { fromId: 'atlas', toId: 'forge', kind: 'construction' },
  { fromId: 'atlas', toId: 'risks', kind: 'obstruction' },
]

interface Anchor {
  x: number
  y: number
}

function centerOf(id: string): Anchor | null {
  const c = UNIVERSE_CONTINENTS.find((cont) => cont.id === id)
  if (!c) return null
  return { x: c.x + c.w / 2, y: c.y + c.h / 2 }
}

/**
 * Bezier curve do Atlas pro alvo · control points calculados pra dar
 * um arco editorial (não linha reta SaaS). Curva tende sutilmente em
 * direção ao centro do mundo, dando sensação de "órbita".
 */
function bezierPath(from: Anchor, to: Anchor): string {
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  // Offset perpendicular pra curvar · sinal depende do quadrante
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return `M ${from.x} ${from.y}`
  const perpX = -dy / len
  const perpY = dx / len
  const curvature = Math.min(160, len * 0.18)
  // Curva sempre pro lado "externo" (oposto ao centro do mundo)
  const worldCx = WORLD_WIDTH / 2
  const worldCy = WORLD_HEIGHT / 2
  const sign = (midX - worldCx) * perpX + (midY - worldCy) * perpY >= 0 ? 1 : -1
  const ctrlX = midX + perpX * curvature * sign
  const ctrlY = midY + perpY * curvature * sign
  return `M ${from.x} ${from.y} Q ${ctrlX} ${ctrlY} ${to.x} ${to.y}`
}

export function UniverseTrails() {
  const c = usePalette()
  const reduced = useReducedMotion()
  const pulseStyle = useTrailPulse({ enabled: !reduced })
  const flowOffset = useTrailFlow({ enabled: !reduced, period: 2200 })
  const animatedDashProps = useAnimatedProps(() => ({
    strokeDashoffset: flowOffset.value,
  }))

  const atlasAnchor = centerOf('atlas')
  if (!atlasAnchor) return null

  return (
    <Animated.View
      style={[styles.svg, pulseStyle as StyleProp<ViewStyle>]}
      pointerEvents="none"
      entering={FadeIn.duration(680).delay(320).easing(Easing.bezier(0.16, 1, 0.3, 1))}
    >
      <Svg
        width={WORLD_WIDTH}
        height={WORLD_HEIGHT}
        viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
      >
        {TRAILS.map((trail) => {
          const target = centerOf(trail.toId)
          if (!target) return null
          const d = bezierPath(atlasAnchor, target)
          const isObstruction = trail.kind === 'obstruction'
          const isConstruction = trail.kind === 'construction'
          const strokeColor = isObstruction ? c.recRedMuted : c.bronze
          const strokeOpacity = isObstruction ? 0.55 : 0.62
          // Primary trails (sólido) ganham flow direcional via dashoffset.
          // Construction/obstruction usam strokeDasharray semântico fixo.
          const isPrimary = !isObstruction && !isConstruction
          const dashArray = isConstruction ? '6,4' : isObstruction ? '3,3' : '6,9'
          if (isPrimary) {
            return (
              <AnimatedPath
                key={`${trail.fromId}-${trail.toId}`}
                d={d}
                stroke={strokeColor}
                strokeOpacity={strokeOpacity}
                strokeWidth={1.25}
                strokeDasharray={dashArray}
                animatedProps={animatedDashProps}
                strokeLinecap="round"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            )
          }
          return (
            <Path
              key={`${trail.fromId}-${trail.toId}`}
              d={d}
              stroke={strokeColor}
              strokeOpacity={strokeOpacity}
              strokeWidth={1.2}
              strokeDasharray={dashArray}
              strokeLinecap="round"
              fill="none"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}

        {/* Atlas central halo · marca o centro como pulso vivo */}
        <Circle cx={atlasAnchor.x} cy={atlasAnchor.y} r={14} stroke={c.bronze} strokeOpacity={0.32} strokeWidth={1.4} fill="none" />
        <Circle cx={atlasAnchor.x} cy={atlasAnchor.y} r={28} stroke={c.bronze} strokeOpacity={0.16} strokeWidth={1.0} fill="none" />
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
