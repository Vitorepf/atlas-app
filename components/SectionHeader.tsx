import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Frau } from '../design/Type'
import { usePalette } from '../design/theme'

interface Props {
  label: string
  style?: StyleProp<ViewStyle>
  withRule?: boolean
}

// v13 · editorial premium · era Sans uppercase Label + cinza c.border hairline.
// Agora: lowercase Frau italic + bronze 10% hairline · mesma família do resto
// do inbox (filter chips italic, voiceLine italic, body italic). Coerência tipográfica.
//
// v15 · entrance animation · FadeIn 380ms quando section monta na lista.
// Stagger natural com cards (cards têm delay próprio · header aparece junto
// com primeiro card da seção). Easing default suave · entrada editorial calma.
export function SectionHeader({ label, style, withRule = true }: Props) {
  const c = usePalette()
  return (
    <Animated.View entering={FadeIn.duration(380)} style={[styles.row, style]}>
      <Frau
        italic
        size={13}
        lineHeight={17}
        letterSpacing={0.4}
        color={c.ink3}
      >
        {label.toLowerCase()}
      </Frau>
      {withRule && <View style={styles.rule} />}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 10 },
  // Bronze 10% hairline · sussurro warm · matches divider entre cards.
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(155,122,63,0.10)' },
})
