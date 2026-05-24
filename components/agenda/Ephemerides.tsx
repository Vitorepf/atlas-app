import { StyleSheet, View } from 'react-native'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { Ephemeris } from '../../lib/agenda'

interface Props {
  entries: Ephemeris[]
}

// Marcos do mês · seção v. EFEMÉRIDES · marginalia editorial.
// Cada row: when mono caps small bronze (width 56) + what italic Frau 13 ink2.
//
// Quando vazio, retorna null — silente. NUNCA fake.
//
// Round agenda polish · entries entram com stagger 40ms × idx.
export function Ephemerides({ entries }: Props) {
  const c = usePalette()
  if (entries.length === 0) return null
  return (
    <View style={styles.wrap}>
      {entries.map((eph, idx) => (
        <Animated.View
          key={`${eph.whenLabel}-${idx}`}
          entering={FadeInDown.duration(360).delay(30 * idx).easing(Easing.bezier(0.16, 1, 0.3, 1)).springify().damping(22).stiffness(180)}
          style={styles.row}
        >
          <Mono
            size={10}
            lineHeight={14}
            letterSpacing={1.4}
            color={c.bronze}
            weight="med"
            style={styles.when}
          >
            {eph.whenLabel}
          </Mono>
          <Frau italic size={13} lineHeight={20} color={c.ink2} style={styles.what}>
            {eph.what}
          </Frau>
        </Animated.View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 6,
    gap: 14,
  },
  when: {
    width: 56,
    flexShrink: 0,
  },
  what: {
    flex: 1,
  },
})
