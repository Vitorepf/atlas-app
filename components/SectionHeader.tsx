import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native'
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
// "ONTEM" → "ontem" · letras maiúsculas eram letreiro de seção, italic é murmúrio.
export function SectionHeader({ label, style, withRule = true }: Props) {
  const c = usePalette()
  return (
    <View style={[styles.row, style]}>
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
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 10 },
  // Bronze 10% hairline · sussurro warm · matches divider entre cards.
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(155,122,63,0.10)' },
})
