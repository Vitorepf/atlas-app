import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'

interface Props {
  /** "Quinta · 7 de Maio de 2026" */
  date: string
  /** "Goiânia" */
  location?: string | null
  /** "edição matinal" · default. */
  edition?: string
}

// Dateline editorial · linha de cidade + data + edição que marca o "quando
// e onde" do exemplar do dia. Vocabulário de cabeçalho de jornal impresso
// (NYT, Le Monde, FT) — italic Frau pra data + cidade, mono caps pra rótulo
// da edição. Centralizado, abaixo do masthead.
//
// Round 2 polish · edition row ganhou hairlines flanqueando: "── EDIÇÃO
// VESPERTINA ──". Vocabulário de stamp/seal editorial · fecha o cabeçalho
// como rodapé de página de livro encadernado, sem decoração Unicode.
export function EditorialDateline({ date, location, edition = 'edição matinal' }: Props) {
  const c = usePalette()
  const dateLine = location ? `${date} · ${location}` : date
  return (
    <View style={styles.wrap}>
      <Frau
        italic
        size={14}
        lineHeight={20}
        letterSpacing={0.4}
        color={c.ink}
        align="center"
      >
        {dateLine}
      </Frau>
      <View style={styles.editionRow}>
        <View style={[styles.editionRule, { backgroundColor: c.border }]} />
        <Mono
          size={9.5}
          lineHeight={14}
          letterSpacing={1.6}
          color={c.ink3}
          align="center"
        >
          {edition.toUpperCase()}
        </Mono>
        <View style={[styles.editionRule, { backgroundColor: c.border }]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 14,
    paddingBottom: 36,
  },
  editionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 4,
  },
  editionRule: {
    width: 18,
    height: StyleSheet.hairlineWidth,
  },
})
