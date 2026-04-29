import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native'
import { Label } from '../design/Type'
import { usePalette } from '../design/theme'

interface Props {
  label: string
  style?: StyleProp<ViewStyle>
  withRule?: boolean
}

export function SectionHeader({ label, style, withRule = true }: Props) {
  const c = usePalette()
  return (
    <View style={[styles.row, style]}>
      <Label>{label}</Label>
      {withRule && <View style={[styles.rule, { backgroundColor: c.border }]} />}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24, marginBottom: 10 },
  rule: { flex: 1, height: 1 },
})
