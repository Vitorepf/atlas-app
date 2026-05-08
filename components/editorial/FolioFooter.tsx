import { StyleSheet, View } from 'react-native'
import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'

interface Props {
  /** Número do folio · ex.: 127, "127", "127 · ed. matinal". */
  number: number | string
}

// FolioFooter · "— FOLIO N —" centralizado em mono caps, com hairline acima.
// Vocabulário de rodapé de página de livro encadernado / revista impressa.
// Fecha a sessão da home como página tem rodapé · sem isso a página fica
// "aberta", sem encerramento ritual.
export function FolioFooter({ number }: Props) {
  const c = usePalette()
  return (
    <View style={[styles.wrap, { borderTopColor: 'rgba(26,22,18,0.18)' }]}>
      <Mono
        size={9.5}
        lineHeight={14}
        letterSpacing={2}
        color={c.ink3}
        align="center"
      >
        {`— FOLIO ${number} —`}
      </Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    // F mockup: marginTop 42 · paddingTop 26 · marginBottom 110 (respiro pro dock).
    marginTop: 42,
    paddingTop: 26,
    marginBottom: 110,
    borderTopWidth: 1,
    alignItems: 'center',
  },
})
