/**
 * Cartografia · grid editorial sutil de fundo.
 *
 * Replica o canon AtlasVault §4.4 · `radial-gradient 1px @5% bronze a
 * cada 32px`. Pequenos dots organizam o espaço sem competir com atoms.
 * Escala junto com o transform do `.world` (vive dentro dele).
 *
 * Implementação SVG via `<Pattern>` nativo · performant (não renderiza
 * milhares de Views) e escala perfeitamente com viewport transform.
 */
import { StyleSheet } from 'react-native'
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg'
import { usePalette } from '../../../design/theme'
import { WORLD_HEIGHT, WORLD_WIDTH } from './layout'

const GRID_SPACING = 56 // px no world (canon canvas: 32 era denso · 56 para mundo grande)

export function CanvasGrid() {
  const c = usePalette()
  return (
    <Svg
      width={WORLD_WIDTH}
      height={WORLD_HEIGHT}
      viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
      style={styles.svg}
      pointerEvents="none"
    >
      <Defs>
        <Pattern
          id="grid-dot"
          x="0"
          y="0"
          width={GRID_SPACING}
          height={GRID_SPACING}
          patternUnits="userSpaceOnUse"
        >
          <Circle cx={GRID_SPACING / 2} cy={GRID_SPACING / 2} r={0.7} fill={c.bronze} opacity={0.085} />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width={WORLD_WIDTH} height={WORLD_HEIGHT} fill="url(#grid-dot)" />
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
