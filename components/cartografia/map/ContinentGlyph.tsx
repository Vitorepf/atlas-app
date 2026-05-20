/**
 * Cartografia · glifos canônicos por continente.
 *
 * Cada continente tem um glifo SVG que **carrega o significado** sem
 * precisar de legenda escrita. Inspiração editorial: chapter ornaments
 * de NYRB, drop-caps Tschichold, fleurons de Smythson.
 *
 * Princípio: a imagem ensina o que o continente É. Texto do nome só
 * confirma; quem vê o ícone já sabe.
 *
 *   Atlas       → kernel pipeline (nó central + 17 órbitas)
 *   Memória     → códice aberto (2 páginas + linhas manuscritas)
 *   Obras       → scaffold construção (3 quadros em estágios)
 *   Forge       → gates de qualidade (3 filtros sequenciais)
 *   Filosofia   → tripé estoico (3 pilares + base)
 *   Gargalos    → barreira (X cruzado deliberado)
 *
 * Stroke canon: 1.4px hairline · bronze burnished pra peso editorial.
 * Sem fills sólidos — manuscript outline only.
 */
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg'

interface Props {
  /** id canônico do continente */
  continentId: string
  /** tamanho do glyph (square) */
  size: number
  /** stroke color · default bronze atlas gold */
  color: string
  /** opcional · cor pra detalhes (default = color @ 50% via opacity) */
  detailColor?: string
}

export function ContinentGlyph({ continentId, size, color, detailColor }: Props) {
  const detail = detailColor ?? color
  const stroke = 1.4
  // viewBox 0..60 padronizado · todos os glifos desenham no mesmo espaço,
  // size do <Svg> faz scale via aspect-fit.
  const vb = 60

  switch (continentId) {
    case 'atlas':
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none">
          {/* Nó central · pulse symbol */}
          <Circle cx={30} cy={30} r={6} stroke={color} strokeWidth={stroke} fill="none" />
          <Circle cx={30} cy={30} r={2.2} fill={color} />
          {/* 17 órbitas (representam as 17 etapas) — distribuídas em raio externo */}
          {Array.from({ length: 17 }).map((_, i) => {
            const angle = (i / 17) * Math.PI * 2 - Math.PI / 2
            const cx = 30 + Math.cos(angle) * 24
            const cy = 30 + Math.sin(angle) * 24
            return <Circle key={i} cx={cx} cy={cy} r={1.2} fill={detail} opacity={0.78} />
          })}
          {/* Anel externo hairline */}
          <Circle cx={30} cy={30} r={24} stroke={detail} strokeWidth={0.6} fill="none" opacity={0.35} />
        </Svg>
      )

    case 'memory':
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none">
          {/* Códice aberto · 2 páginas em V invertido */}
          <Path
            d="M 30 14 L 10 18 L 10 46 L 30 50 Z"
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinejoin="miter"
          />
          <Path
            d="M 30 14 L 50 18 L 50 46 L 30 50 Z"
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinejoin="miter"
          />
          {/* Linhas manuscritas (3 em cada página) */}
          {[24, 30, 36].map((y, i) => (
            <Line key={`l-${i}`} x1={14} y1={y} x2={27} y2={y - 0.8} stroke={detail} strokeWidth={0.7} opacity={0.55} />
          ))}
          {[24, 30, 36].map((y, i) => (
            <Line key={`r-${i}`} x1={33} y1={y - 0.8} x2={46} y2={y} stroke={detail} strokeWidth={0.7} opacity={0.55} />
          ))}
        </Svg>
      )

    case 'works':
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none">
          {/* Scaffold · 3 obras em estágios */}
          {/* Obra 1 · completa */}
          <Rect x={10} y={32} width={12} height={18} stroke={color} strokeWidth={stroke} fill="none" />
          <Line x1={10} y1={38} x2={22} y2={38} stroke={color} strokeWidth={0.7} opacity={0.7} />
          <Line x1={10} y1={44} x2={22} y2={44} stroke={color} strokeWidth={0.7} opacity={0.7} />
          {/* Obra 2 · em construção */}
          <Rect x={24} y={20} width={12} height={30} stroke={color} strokeWidth={stroke} fill="none" />
          <Line x1={24} y1={28} x2={36} y2={28} stroke={color} strokeWidth={0.7} opacity={0.7} />
          <Line x1={24} y1={36} x2={36} y2={36} stroke={detail} strokeWidth={0.7} opacity={0.4} strokeDasharray="2,2" />
          <Line x1={24} y1={42} x2={36} y2={42} stroke={detail} strokeWidth={0.7} opacity={0.4} strokeDasharray="2,2" />
          {/* Obra 3 · planejada (dashed) */}
          <Rect x={38} y={26} width={12} height={24} stroke={detail} strokeWidth={stroke} fill="none" strokeDasharray="2,2" opacity={0.6} />
        </Svg>
      )

    case 'forge':
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none">
          {/* 3 gates sequenciais (filtros) · funil de qualidade */}
          <Path d="M 10 18 L 22 30 L 10 42" stroke={color} strokeWidth={stroke} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <Path d="M 24 18 L 36 30 L 24 42" stroke={color} strokeWidth={stroke} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <Path d="M 38 18 L 50 30 L 38 42" stroke={color} strokeWidth={stroke} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {/* Trilha central · evidence flow */}
          <Line x1={6} y1={30} x2={54} y2={30} stroke={detail} strokeWidth={0.6} opacity={0.45} />
        </Svg>
      )

    case 'philosophy':
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none">
          {/* Tripé estoico · 3 pilares + entablamento */}
          {/* Entablamento */}
          <Line x1={8} y1={18} x2={52} y2={18} stroke={color} strokeWidth={stroke} />
          <Line x1={6} y1={15} x2={54} y2={15} stroke={detail} strokeWidth={0.7} opacity={0.6} />
          {/* 3 colunas */}
          {[14, 30, 46].map((x, i) => (
            <Line key={i} x1={x} y1={20} x2={x} y2={44} stroke={color} strokeWidth={stroke} />
          ))}
          {/* Capitéis */}
          {[14, 30, 46].map((x, i) => (
            <Line key={`cap-${i}`} x1={x - 3} y1={20} x2={x + 3} y2={20} stroke={color} strokeWidth={0.9} />
          ))}
          {/* Base */}
          <Line x1={8} y1={46} x2={52} y2={46} stroke={color} strokeWidth={stroke} />
          <Line x1={6} y1={49} x2={54} y2={49} stroke={detail} strokeWidth={0.7} opacity={0.6} />
        </Svg>
      )

    case 'risks':
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none">
          {/* Barreira · X com hairlines deliberadas */}
          <Line x1={14} y1={14} x2={46} y2={46} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
          <Line x1={46} y1={14} x2={14} y2={46} stroke={color} strokeWidth={stroke} strokeLinecap="round" />
          {/* Frame de obstrução */}
          <Rect x={10} y={10} width={40} height={40} stroke={detail} strokeWidth={0.7} fill="none" opacity={0.45} strokeDasharray="3,2" />
        </Svg>
      )

    default:
      // Fallback canon · pequeno losango neutro
      return (
        <Svg width={size} height={size} viewBox={`0 0 ${vb} ${vb}`} fill="none">
          <Path d="M 30 12 L 48 30 L 30 48 L 12 30 Z" stroke={color} strokeWidth={stroke} fill="none" />
        </Svg>
      )
  }
}
