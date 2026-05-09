import { StyleSheet, View } from 'react-native'
import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { currentTimeLabel } from '../../lib/agenda'

interface Props {
  /** Defaults para `new Date()` · use `now` controlado pra testes/snapshots. */
  now?: Date
}

// Régua AGORA inline na timeline · linha bronze@50% à esquerda, label
// "agora · 14.32" mono caps small bronze centralizado, linha bronze@50%
// à direita. Ancoragem visual de "onde estou no dia" — dispositivo TDAH
// validado em feedback_atlas_tdah_design.md.
export function AgendaNowMarker({ now = new Date() }: Props) {
  const c = usePalette()
  return (
    <View style={styles.row}>
      <View style={[styles.line, { backgroundColor: c.bronze }]} />
      <Mono
        size={9.5}
        lineHeight={12}
        letterSpacing={1.8}
        color={c.bronze}
        weight="med"
        style={styles.label}
      >
        {currentTimeLabel(now).toUpperCase()}
      </Mono>
      <View style={[styles.line, { backgroundColor: c.bronze }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  line: {
    flex: 1,
    height: 1,
    opacity: 0.5,
  },
  label: {
    flexShrink: 0,
  },
})
