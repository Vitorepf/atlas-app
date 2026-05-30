import { StyleSheet, View } from 'react-native'
import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { riskTone, riskWord } from './loopTone'
import type { AtlasLoopRiskLevel } from '../../lib/loop'

interface Props {
  risk: AtlasLoopRiskLevel | string
  /** Append a bronze "RSI" tag (recursive self-improvement proposal). */
  rsi?: boolean
  /** Append a bronze "AUTONOMIA" tag (earned-autonomy proposal). */
  autonomy?: boolean
}

// Read-only risk word in DecisionCard top row · Mono caps "RISCO BAIXO/MÉDIO/
// ALTO/CRÍTICO" toned by riskTone, with an optional bronze RSI / AUTONOMIA tag.
export function RiskTag({ risk, rsi, autonomy }: Props) {
  const c = usePalette()
  return (
    <View style={styles.row}>
      <Mono size={11} lineHeight={14} letterSpacing={0.4} color={riskTone(risk, c)}>
        {riskWord(risk)}
      </Mono>
      {rsi ? (
        <Mono size={10} lineHeight={14} letterSpacing={0.6} color={c.bronze}>
          RSI
        </Mono>
      ) : null}
      {autonomy ? (
        <Mono size={10} lineHeight={14} letterSpacing={0.6} color={c.bronze}>
          AUTONOMIA
        </Mono>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
})
