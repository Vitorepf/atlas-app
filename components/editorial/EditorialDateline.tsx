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
      <Mono
        size={9.5}
        lineHeight={14}
        letterSpacing={1.6}
        color={c.ink3}
        align="center"
        style={styles.edition}
      >
        {edition.toUpperCase()}
      </Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 14,
    paddingBottom: 36,
  },
  edition: {
    marginTop: 4,
  },
})
