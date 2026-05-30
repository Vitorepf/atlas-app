import { StyleSheet, View } from 'react-native'
import { Label, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { radii } from '../../design/tokens'
import { statusColor } from './loopTone'

interface Props {
  label: string
  value: string
  tone?: string | null
}

// PORT verbatim of engineering.tsx Metric (:3518): a bordered cell with a Label
// + a Mono datum colored by statusColor(tone ?? value). Used in the cycle
// receipt sheet's DIFF strip. Vitals use TocRow, not Metric.
export function Metric({ label, value, tone }: Props) {
  const c = usePalette()
  return (
    <View style={[styles.metric, { borderColor: c.border, backgroundColor: c.bg }]}>
      <Label>{label}</Label>
      <Mono size={16} lineHeight={21} letterSpacing={0.1} color={statusColor(tone ?? value, c)}>
        {value}
      </Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  metric: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
})
