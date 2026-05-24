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
    <View style={[styles.wrap, { borderBottomColor: c.borderSoft }]}>
      <Frau
        weight="med"
        size={30}
        lineHeight={36}
        letterSpacing={5.5}
        color={c.ink}
        align="center"
        // Round 6 polish · letterpress depth via textShadow.
        // Sombra ink 0/1/0 alpha 0.22 (token inkCarving) dá peso de tinta
        // sobre slate · chapa tipográfica que pressionou o papel.
        // Não é shadow Photoshop · é a marca da prensa. Letterpress canon.
        style={{
          textShadowColor: c.inkCarving,
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 0,
        }}
      >
        {title.toUpperCase()}
      </Frau>
      {showFolio ? (
        <View style={styles.folioRow}>
          {/* Hairlines flanqueando o folio · trazem peso editorial extra.
              Cada lateral ~14px wide, hairline cream alpha 0.10 (border canon).
              "─── VOL. III · NO. 127 ───" — fechamento ritual sub-masthead. */}
          <View style={[styles.folioRule, { backgroundColor: c.border }]} />
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
          <View style={[styles.folioRule, { backgroundColor: c.border }]} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 12,
    paddingBottom: 24,
    // Hairline canon · StyleSheet.hairlineWidth em vez de 1px inteiro.
    // borderBottomColor agora vem de c.borderSoft (cream alpha 0.05 em
    // dark, ink alpha 0.05 em light) · linha quase invisível, fechamento
    // editorial sutil. Antes era rgba(26,22,18,0.18) hardcoded warm
    // cream — em dark mode virava "linha cinza-preta" cortando a página.
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  folioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginTop: 8,
  },
  folioRule: {
    width: 22,
    height: StyleSheet.hairlineWidth,
  },
  folio: {
    // marginTop absorvido pelo folioRow gap
  },
})
