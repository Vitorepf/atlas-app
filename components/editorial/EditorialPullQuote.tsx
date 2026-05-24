import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'

interface Props {
  /** Texto da citação · sem aspas (são adicionadas com smart quotes). */
  quote: string
  /** Atribuição em mono caps · "pergunta de hoje", "passagem do dia",
   *  ou "AUTOR · OBRA" (será dividida em duas metades · autor med peso,
   *  obra reg lesser). Divisor é " · " (centro pong space-dot-space). */
  attribution: string
}

// Pull quote editorial · barra vertical bronze 2px à esquerda + italic Frau
// indented + atribuição mono caps right-aligned com prefix em-dash.
//
// Vocabulário consagrado: NYT pull quote, Monocle "voz que falou", Hermès
// catálogo Le Carré. Marca a citação como uma voz OUTRA sendo trazida —
// estrutura, não decoração. Smart quotes (“ ”) renderizadas
// automaticamente.
//
// Round 2 polish · aspas abrir em Fraunces 38 bronze inline · vocabulário
// de revista impressa (NYRB, Granta, Paris Review) onde a aspa abrir é
// glyph editorial peso. Sem ✦ decorativo · só a aspa do canon tipográfico.
export function EditorialPullQuote({ quote, attribution }: Props) {
  const c = usePalette()
  return (
    <View style={[styles.wrap, { borderLeftColor: c.bronze }]}>
      {/* Aspa abrir + body inline via nested <Frau> (não flex row).
          Mesmo padrão do EditorialEmptyLine fix · em RN, nested Text
          renderiza inline com baseline correto automático. Outer Frau
          italic 19 dita lineHeight 28; inner Frau med italic 28 bronze
          apenas muda fontSize + color + textShadow. Single visual line
          sem layout quebrado no device. Aspa fechar ao fim do body. */}
      <Frau italic size={19} lineHeight={28} letterSpacing={-0.3} color={c.ink}>
        <Frau
          weight="med"
          italic
          size={28}
          color={c.bronze}
          style={{
            textShadowColor: c.inkCarving,
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 0,
          }}
        >
          {'“'}
        </Frau>
        {`${quote}”`}
      </Frau>
      {/* Round 3 polish · attribution divide em "AUTOR · OBRA" se houver
          " · " · autor em mono med (peso) + obra em mono reg (lesser).
          Hierarquia tipográfica sutil mas presente · canon NYRB/Granta.
          Quando attribution é singular (ex.: "PASSAGEM DO DIA"), só
          renderiza mono uniforme. */}
      {(() => {
        const parts = attribution.split(' · ')
        const upper = attribution.toUpperCase()
        if (parts.length < 2) {
          return (
            <Mono size={10} lineHeight={14} letterSpacing={1.6} color={c.ink3} align="right" style={styles.attr}>
              {`— ${upper}`}
            </Mono>
          )
        }
        const [author, ...rest] = parts
        const work = rest.join(' · ')
        return (
          <View style={[styles.attrRow, styles.attr]}>
            <Mono size={10} lineHeight={14} letterSpacing={1.6} color={c.ink3}>
              {'— '}
            </Mono>
            <Mono weight="med" size={10} lineHeight={14} letterSpacing={1.6} color={c.ink2}>
              {author.toUpperCase()}
            </Mono>
            <Mono size={10} lineHeight={14} letterSpacing={1.6} color={c.ink3}>
              {` · ${work.toUpperCase()}`}
            </Mono>
          </View>
        )
      })()}
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
  // quoteRow / openQuote / quoteBody removidos · aspa agora vive inline
  // dentro do <Frau> outer via nested Text (sem flex row, sem margens).
  attr: {
    marginTop: 10,
  },
  attrRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
})
