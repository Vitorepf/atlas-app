import { StyleSheet, View } from 'react-native'
import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'

interface Props {
  schemaShort: string
  generatedAt: string
}

// Closing audit seal · hairline-flanked Mono caps "── SCHEMA {short} · GERADO
// {relative} ──". Same recipe family as FolioFooter / Dateline rules. The page
// is a real projection of a real schema at a real time — this stamps that.
// Also restates the read-only invariant: signals never invoke a provider.
export function Colophon({ schemaShort, generatedAt }: Props) {
  const c = usePalette()
  const label = `SCHEMA ${schemaShort || '—'} · GERADO ${generatedAt || '—'}`
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={[styles.rule, { backgroundColor: c.border }]} />
        <Mono size={9.5} lineHeight={14} letterSpacing={1.6} color={c.ink3} align="center">
          {label}
        </Mono>
        <View style={[styles.rule, { backgroundColor: c.border }]} />
      </View>
      <Mono size={9.5} lineHeight={14} letterSpacing={1.4} color={c.ink3} align="center" style={styles.note}>
        SOMENTE LEITURA · SINAIS NÃO INVOCAM PROVIDER
      </Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 30,
    alignItems: 'center',
    gap: 8,
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
  note: {
    marginTop: 2,
  },
})
