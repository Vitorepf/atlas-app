/**
 * Cartografia · glifo de fase pro pipeline.
 *
 * Cada uma das 5 fases canon tem um glifo SVG simples que **carrega o
 * tipo de operação**:
 *   - intake (i-iii)  · ↓ chevron descendente · "entra no Atlas"
 *   - shape  (iv-viii) · ◇ losango de transformação · "modela contexto"
 *   - decide (ix-xii) · ✦ asterisco 4-pontas · "escolha canônica"
 *   - prove  (xiii-xv) · ⊞ grade 4-quadrantes · "filtros de qualidade"
 *   - render (xvi-xvii) · → chevron lateral · "saída pro humano"
 *
 * Stroke canon 1.4px. Hairlines em bronze. Sem fills.
 */
import Svg, { Line, Path, Rect } from 'react-native-svg'
import { type FlowPhase } from './atlasFlowData'

interface Props {
  phase: FlowPhase
  size: number
  color: string
  emphasized?: boolean
}

export function PhaseGlyph({ phase, size, color, emphasized }: Props) {
  const vb = 24
  const stroke = emphasized ? 1.7 : 1.3

  switch (phase) {
    case 'intake':
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none">
          {/* ↓ chevron descendente */}
          <Path d="M 6 8 L 12 16 L 18 8" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
          <Line x1={12} y1={4} x2={12} y2={16} stroke={color} strokeWidth={stroke - 0.2} strokeLinecap="round" />
        </Svg>
      )

    case 'shape':
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none">
          {/* ◇ losango de transformação */}
          <Path d="M 12 4 L 20 12 L 12 20 L 4 12 Z" stroke={color} strokeWidth={stroke} strokeLinejoin="miter" />
        </Svg>
      )

    case 'decide':
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none">
          {/* ✦ asterisco 4-pontas · símbolo canon Atlas */}
          <Line x1={12} y1={3} x2={12} y2={21} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
          <Line x1={3} y1={12} x2={21} y2={12} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
          <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={stroke - 0.4} strokeLinecap="round" opacity={0.78} />
          <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={stroke - 0.4} strokeLinecap="round" opacity={0.78} />
        </Svg>
      )

    case 'prove':
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none">
          {/* ⊞ grade 4-quadrantes */}
          <Rect x={5} y={5} width={14} height={14} stroke={color} strokeWidth={stroke} fill="none" />
          <Line x1={12} y1={5} x2={12} y2={19} stroke={color} strokeWidth={stroke - 0.3} />
          <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={stroke - 0.3} />
        </Svg>
      )

    case 'render':
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none">
          {/* → chevron lateral */}
          <Path d="M 8 6 L 16 12 L 8 18" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
          <Line x1={4} y1={12} x2={16} y2={12} stroke={color} strokeWidth={stroke - 0.2} strokeLinecap="round" />
        </Svg>
      )

    default:
      return null
  }
}
