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
//
// Round agenda polish · label ganhou bronzeGlow shadow halo + textShadow
// inkCarving. As linhas laterais ganharam sutil shadow bronze (radius 2)
// pra dar profundidade de régua impressa, não traço fino flat.
export function AgendaNowMarker({ now = new Date() }: Props) {
  const c = usePalette()
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.line,
          {
            backgroundColor: c.bronze,
            shadowColor: c.bronze,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 2,
          },
        ]}
      />
      <Mono
        size={9.5}
        lineHeight={12}
        letterSpacing={1.8}
        color={c.bronze}
        weight="med"
        style={[
          styles.label,
          {
            textShadowColor: c.inkCarving,
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 0,
          },
        ]}
      >
        {currentTimeLabel(now).toUpperCase()}
      </Mono>
      <View
        style={[
          styles.line,
          {
            backgroundColor: c.bronze,
            shadowColor: c.bronze,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.4,
            shadowRadius: 2,
          },
        ]}
      />
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
    opacity: 0.55,
  },
  label: {
    flexShrink: 0,
  },
})
