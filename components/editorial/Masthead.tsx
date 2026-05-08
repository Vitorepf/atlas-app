import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'

interface Props {
  /** "vol. iii · no. 127" — folio em mono caps abaixo do título. */
  folio?: string
}

// Masthead editorial · "ATLAS" centralizado em Frau caps com letterSpacing
// largo (vocabulário de frontispiece de Penguin Classics) + folio mono caps
// abaixo + hairline horizontal de fechamento. Substitui o "Bom dia, Vitor"
// servil — Atlas não cumprimenta, é a publicação que você abre na manhã.
export function Masthead({ folio = 'vol. iii · no. 127' }: Props) {
  const c = usePalette()
  return (
    <View style={[styles.wrap, { borderBottomColor: 'rgba(26,22,18,0.18)' }]}>
      <Frau
        weight="med"
        size={30}
        lineHeight={36}
        letterSpacing={5.5}
        color={c.ink}
        align="center"
        style={styles.title}
      >
        ATLAS
      </Frau>
      <Mono
        size={10}
        lineHeight={14}
        letterSpacing={1.6}
        color={c.ink2}
        align="center"
        style={styles.folio}
      >
        {folio.toUpperCase()}
      </Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 12,
    paddingBottom: 24,
    borderBottomWidth: 1,
  },
  title: {
    // letterSpacing 5.5 · F mockup exato · ATLAS abre em ~5 letras espaçadas,
    // ar de tipografia de capa de revista premium (Monocle, Apollo, NYRB).
  },
  folio: {
    marginTop: 8,
  },
})
