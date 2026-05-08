import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'

interface Props {
  /** Texto da citação · sem aspas (são adicionadas com smart quotes). */
  quote: string
  /** Atribuição em mono caps · "pergunta de hoje", "passagem do dia". */
  attribution: string
}

// Pull quote editorial · barra vertical bronze 2px à esquerda + italic Frau
// indented + atribuição mono caps right-aligned com prefix em-dash.
//
// Vocabulário consagrado: NYT pull quote, Monocle "voz que falou", Hermès
// catálogo Le Carré. Marca a citação como uma voz OUTRA sendo trazida —
// estrutura, não decoração. Smart quotes (“ ”) renderizadas
// automaticamente.
export function EditorialPullQuote({ quote, attribution }: Props) {
  const c = usePalette()
  return (
    <View style={[styles.wrap, { borderLeftColor: c.bronze }]}>
      <Frau
        italic
        size={19}
        lineHeight={26}
        letterSpacing={-0.3}
        color={c.ink}
      >
        {`“${quote}”`}
      </Frau>
      <Mono
        size={10}
        lineHeight={14}
        letterSpacing={1.6}
        color={c.ink3}
        align="right"
        style={styles.attr}
      >
        {`— ${attribution.toUpperCase()}`}
      </Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingLeft: 14,
    borderLeftWidth: 2,
    // marginLeft 32 + marginRight 32 = trilhos internos simétricos (x=64..329)
    // alinhados com TOC, mission, tecido. Régua bronze em x=64, texto começa
    // em x=80 (64+14+2), termina em x=329. Espaço livre 64px nos dois lados
    // do canto da tela.
    marginTop: 0,
    marginBottom: 28,
    marginLeft: 32,
    marginRight: 32,
  },
  attr: {
    marginTop: 10,
  },
})
