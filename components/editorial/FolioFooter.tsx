import { StyleSheet, View } from 'react-native'
import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'

interface Props {
  /** Número do folio · ex.: 127, "127". Requerido a menos que `label`
   *  esteja definido (modo override). */
  number?: number | string
  /** Sufixo opcional após o número · ex.: "agenda", "inbox", "operacional".
   *  Renderiza "— FOLIO N · SUFIXO —" em mono caps. */
  suffix?: string
  /** Label override · sobrescreve o template "FOLIO N · SUFIXO" inteiro.
   *  Pra usos editoriais especiais (vista mensal: "— maio · mmxxvi —"
   *  sem "FOLIO" prefix). Mantém hairline + tipografia mono caps. */
  label?: string
}

// FolioFooter · "— FOLIO N —" centralizado em mono caps, com hairline acima.
// Vocabulário de rodapé de página de livro encadernado / revista impressa.
// Fecha a sessão da home como página tem rodapé · sem isso a página fica
// "aberta", sem encerramento ritual.
//
// Telas-seção (Agenda, Inbox, Operacional) usam suffix pra indicar a
// "cadernação" do exemplar — "— FOLIO 128 · AGENDA —" mantém continuidade
// do folio cumulativo enquanto rotula a seção atual.
//
// Vista mensal: usa `label` pra substituir totalmente o template, gerando
// algo como "— MAIO · MMXXVI —" — outra dimensão temporal (mês inteiro vs
// dia específico). Vocabulário canon do mockup (atlas-home-editorial-mockup.html
// viewport "Agenda · Mês").
export function FolioFooter({ number, suffix, label }: Props) {
  const c = usePalette()
  let text: string
  if (label) {
    text = label.toUpperCase()
  } else if (suffix) {
    text = `FOLIO ${number} · ${suffix.toUpperCase()}`
  } else {
    text = `FOLIO ${number}`
  }
  return (
    <View style={[styles.wrap, { borderTopColor: c.borderSoft }]}>
      {/* Round 3 polish · "─── FOLIO N ───" com hairlines bronze-soft
          flanqueando · consistente com masthead folio row e dateline edition.
          Em-dashes Unicode removidos · agora são hairlines reais (peso de
          régua impressa, não pontuação decorativa). */}
      <View style={styles.row}>
        <View style={[styles.rule, { backgroundColor: c.border }]} />
        <Mono
          size={9.5}
          lineHeight={14}
          letterSpacing={2}
          color={c.ink3}
          align="center"
        >
          {text}
        </Mono>
        <View style={[styles.rule, { backgroundColor: c.border }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    // F mockup: marginTop 42 · paddingTop 26 · marginBottom 110 (respiro pro dock).
    // Hairline canon · StyleSheet.hairlineWidth + c.borderSoft (cream alpha 0.05
    // dark / ink alpha 0.05 light). Antes era 1px inteiro com warm cream
    // hardcoded que virava linha cinza-preta em dark mode.
    marginTop: 42,
    paddingTop: 26,
    marginBottom: 110,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  rule: {
    width: 24,
    height: StyleSheet.hairlineWidth,
  },
})
