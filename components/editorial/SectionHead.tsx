import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'

interface Props {
  /** "i", "ii", "iii", "iv" — numeral romano (sem ponto, é adicionado). */
  numeral: string
  /** "Agenda", "Operação Atlas" — vai pra caps automaticamente. */
  title: string
  /** Standfirst opcional · italic Frau pequeno abaixo do título.
   *  Ex.: "diário de intenção · sete de maio". */
  deck?: string
}

// SectionHead editorial · numeral romano em mono caps com ponto bronze,
// título em Frau caps com letterSpacing de capítulo, standfirst opcional
// em italic Frau pequeno, hairline de fechamento. Substitui o TierMark
// (que era italic + ✦ diamond) — vocabulário de chapter opener de livro
// encadernado em vez de marker de wishlist.
export function SectionHead({ numeral, title, deck }: Props) {
  const c = usePalette()
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Mono
          size={11}
          lineHeight={16}
          letterSpacing={0.6}
          color={c.bronze}
          style={styles.numeral}
        >
          {`${numeral.toLowerCase()}.`}
        </Mono>
        <Frau
          weight="med"
          size={17}
          lineHeight={22}
          letterSpacing={3}
          color={c.ink}
          style={styles.title}
        >
          {title.toUpperCase()}
        </Frau>
      </View>

      {deck ? (
        <Frau
          italic
          size={13}
          lineHeight={19}
          color={c.ink2}
          style={styles.deck}
        >
          {deck}
        </Frau>
      ) : null}

      <View
        style={[
          styles.hr,
          { backgroundColor: c.ink, opacity: 0.12, marginTop: deck ? 14 : 18 },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  // F mockup .va .section: marginTop:0, marginBottom:44 · respiro vertical
  // todo abaixo da seção (não acima). RN aproxima distribuindo 14+30.
  wrap: {
    marginTop: 14,
    marginBottom: 30,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  numeral: {
    minWidth: 22,
  },
  title: {
    flex: 1,
  },
  // deck/hr no trilho interno x=64..329 (marginLeft 32 + marginRight 32).
  // Simetria com os blocos da agenda/TOC abaixo: o hairline da seção termina
  // exatamente onde os values do TOC terminam, formando um único trilho
  // direito coerente.
  deck: {
    marginTop: 4,
    marginLeft: 32,
    marginRight: 32,
  },
  hr: {
    height: 1,
    marginLeft: 32,
    marginRight: 32,
  },
})
