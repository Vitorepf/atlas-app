import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'

interface Props {
  /** Título do masthead — defaults pra "ATLAS" (home).
   *  Telas-seção passam o próprio título: "AGENDA", "INBOX", "VÍNCULO". */
  title?: string
  /** "vol. iii · no. 127" — folio em mono caps abaixo do título.
   *  Pra masthead-section (telas não-home), passar `null` pra esconder
   *  o folio — o folio do exemplar é responsabilidade da home. */
  folio?: string | null
}

// Masthead editorial · título centralizado em Frau caps com letterSpacing
// largo (vocabulário de frontispiece de Penguin Classics) + folio mono caps
// opcional + hairline horizontal de fechamento. Substitui o "Bom dia, Vitor"
// servil — Atlas não cumprimenta, é a publicação que você abre na manhã.
//
// Variante masthead-section (canon): quando `folio === null`, renderiza
// só o título + hairline. Cadência apertada (sem padding-bottom 24 do
// folio absente, mas mantém o padding pra não colar com o conteúdo).
export function Masthead({ title = 'ATLAS', folio = 'vol. iii · no. 127' }: Props) {
  const c = usePalette()
  const showFolio = folio !== null && folio !== undefined
  return (
    <View style={[styles.wrap, { borderBottomColor: 'rgba(26,22,18,0.18)' }]}>
      <Frau
        weight="med"
        size={30}
        lineHeight={36}
        letterSpacing={5.5}
        color={c.ink}
        align="center"
      >
        {title.toUpperCase()}
      </Frau>
      {showFolio ? (
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
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 12,
    paddingBottom: 24,
    borderBottomWidth: 1,
  },
  folio: {
    marginTop: 8,
  },
})
