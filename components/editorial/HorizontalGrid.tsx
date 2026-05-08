import { StyleSheet, View } from 'react-native'
import { usePalette } from '../../design/theme'

interface Props {
  cell?: number
  opacity?: number
  /** Quantidade de linhas a renderizar (cobertura vertical = count × cell px). */
  count?: number
}

// HorizontalGrid · pautas horizontais que rolam JUNTO com o conteúdo,
// formando quadrados 36×36 perfeitos quando se cruzam com as colunas
// verticais fixas do CartogBackground (axis='vertical').
//
// Vocabulário físico:
//   · Verticais (CartogBackground) = trilhos fixos do iPhone, não rolam
//   · Horizontais (HorizontalGrid)  = pautas do papel, rolam com texto
//
// Equivalente RN do CSS `background-attachment: local` que usamos na
// variante F do mockup web. Em RN não existe esse modo de attachment, então
// renderizamos as horizontais como filhos absolutos de um wrapper relativo
// dentro do ScrollView · scroll natural do RN move o wrapper, e as
// horizontais vão junto.
//
// Estilo IDÊNTICO às verticais do CartogBackground: 1px, ink, 2.5% opacity.
// Não há "doubling" porque na variante F o CartogBackground é axis='vertical'
// (sem horizontais próprias) — só essas horizontais do scroll existem.
//
// Posicionamento crítico: precisa estar dentro de uma View com
// position: 'relative' que envolve TODO o conteúdo scrollable. Renderiza
// como absolute fill — não afeta altura do parent (parent é dimensionado
// pelo conteúdo in-flow).
export function HorizontalGrid({ cell = 36, opacity = 0.025, count = 200 }: Props) {
  const c = usePalette()
  const lines: number[] = []
  for (let i = 0; i < count; i++) lines.push(i * cell)

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { opacity }]}>
      {lines.map((y) => (
        <View
          key={`hg${y}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: y,
            height: 1,
            backgroundColor: c.ink,
          }}
        />
      ))}
    </View>
  )
}
