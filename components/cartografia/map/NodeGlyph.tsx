/**
 * Cartografia · glifo SVG mini por kind do node.
 *
 * 7 categorias canon: book, pillar, spark, gear, gates, risk, tag.
 * Cada glifo é desenhado em viewBox 16×16 e renderiza em size
 * proporcional (default 14px).
 *
 * Princípio: o glifo CARREGA significado · operador lê a categoria
 * antes mesmo de ler o nome. Sensação canon NYRB plate "section
 * ornament".
 */
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg'
import { type NodeKind } from './continentNodes'

interface Props {
  kind?: NodeKind
  size?: number
  color: string
}

export function NodeGlyph({ kind, size = 14, color }: Props) {
  const stroke = 1.2
  switch (kind) {
    case 'book':
      return (
        <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          {/* Códice aberto · dois retângulos como páginas */}
          <Path d="M 8 3 L 2 4 L 2 12 L 8 13 Z" stroke={color} strokeWidth={stroke} fill="none" />
          <Path d="M 8 3 L 14 4 L 14 12 L 8 13 Z" stroke={color} strokeWidth={stroke} fill="none" />
        </Svg>
      )
    case 'pillar':
      return (
        <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          {/* Coluna · capitel + fuste + base */}
          <Line x1={4} y1={3.5} x2={12} y2={3.5} stroke={color} strokeWidth={stroke} />
          <Line x1={5.5} y1={5} x2={5.5} y2={11} stroke={color} strokeWidth={stroke} />
          <Line x1={10.5} y1={5} x2={10.5} y2={11} stroke={color} strokeWidth={stroke} />
          <Line x1={4} y1={12.5} x2={12} y2={12.5} stroke={color} strokeWidth={stroke} />
        </Svg>
      )
    case 'spark':
      return (
        <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          {/* ✦ centelha · 4 pontas + miolo */}
          <Line x1={8} y1={2} x2={8} y2={14} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
          <Line x1={2} y1={8} x2={14} y2={8} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
          <Line x1={4} y1={4} x2={12} y2={12} stroke={color} strokeWidth={stroke - 0.4} strokeLinecap="round" opacity={0.7} />
          <Line x1={12} y1={4} x2={4} y2={12} stroke={color} strokeWidth={stroke - 0.4} strokeLinecap="round" opacity={0.7} />
        </Svg>
      )
    case 'gear':
      return (
        <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          {/* Engrenagem · círculo + 4 dentes ortogonais */}
          <Circle cx={8} cy={8} r={3.6} stroke={color} strokeWidth={stroke} fill="none" />
          <Line x1={8} y1={2} x2={8} y2={4} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
          <Line x1={8} y1={12} x2={8} y2={14} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
          <Line x1={2} y1={8} x2={4} y2={8} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
          <Line x1={12} y1={8} x2={14} y2={8} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
        </Svg>
      )
    case 'gates':
      return (
        <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          {/* 3 chevrons sequenciais · funil de gates */}
          <Path d="M 3 5 L 6 8 L 3 11" stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M 7 5 L 10 8 L 7 11" stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M 11 5 L 14 8 L 11 11" stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      )
    case 'risk':
      return (
        <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          {/* X cruzado · barreira/obstrução */}
          <Line x1={3.5} y1={3.5} x2={12.5} y2={12.5} stroke={color} strokeWidth={stroke + 0.2} strokeLinecap="round" />
          <Line x1={12.5} y1={3.5} x2={3.5} y2={12.5} stroke={color} strokeWidth={stroke + 0.2} strokeLinecap="round" />
        </Svg>
      )
    case 'tag':
    default:
      return (
        <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          {/* Tag · etiqueta */}
          <Path
            d="M 2 5 L 8 2 L 14 5 L 14 11 L 8 14 L 2 11 Z"
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinejoin="round"
          />
          <Circle cx={8} cy={8} r={1.4} fill={color} opacity={0.5} />
        </Svg>
      )
  }
}
