/**
 * Cartografia · vinheta radial sutil sobre o canvas.
 *
 * Adiciona escurecimento progressivo nos cantos do viewport (canon Apple
 * Maps / NYRB plate edition). Não fica dentro do `.world` — fica acima
 * (overlay) com `pointerEvents="none"` pra não bloquear gestos.
 *
 * Implementação SVG radialGradient · cantos ~12% mais escuros, centro
 * intacto. Sensação enterprise de "plate iluminado no centro".
 */
import { StyleSheet } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

interface Props {
  width: number
  height: number
}

export function CanvasVignette({ width, height }: Props) {
  if (width <= 0 || height <= 0) return null
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={styles.svg}
      pointerEvents="none"
    >
      <Defs>
        <RadialGradient
          id="vignette"
          cx={width / 2}
          cy={height / 2}
          r={Math.max(width, height) * 0.62}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor="#000000" stopOpacity={0} />
          <Stop offset="0.7" stopColor="#000000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.32} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />
    </Svg>
  )
}

const styles = StyleSheet.create({
  svg: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
})
