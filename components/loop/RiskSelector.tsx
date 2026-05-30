import { StyleSheet, View } from 'react-native'
import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { radii } from '../../design/tokens'
import { PressablePillScale } from '../atlas-ui/PressableScale'
import type { AtlasLoopRiskLevel } from '../../lib/loop'

interface Props {
  value: AtlasLoopRiskLevel
  onChange: (r: AtlasLoopRiskLevel) => void
}

const RISKS: Array<{ value: AtlasLoopRiskLevel; label: string }> = [
  { value: 'low', label: 'BAIXO' },
  { value: 'medium', label: 'MÉDIO' },
  { value: 'high', label: 'ALTO' },
  { value: 'critical', label: 'CRÍTICO' },
]

// Shared 4-pill risk row · Mono caps "RISCO" + four pills. Active = bronzeVeil
// fill + bronzeBorder + bronze text; inactive = hairline + ink3 text. Default
// 'medium' (backend default). STATIC, press settle only (PressablePillScale).
export function RiskSelector({ value, onChange }: Props) {
  const c = usePalette()
  return (
    <View style={styles.row}>
      <Mono size={11} lineHeight={14} letterSpacing={0.8} color={c.ink3}>
        RISCO
      </Mono>
      <View style={styles.pills}>
        {RISKS.map((r) => {
          const active = r.value === value
          return (
            <PressablePillScale
              key={r.value}
              onPress={() => onChange(r.value)}
              haptic="soft"
              accessibilityLabel={`Definir risco ${r.label.toLowerCase()}`}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? c.bronzeVeil : 'transparent',
                  borderColor: active ? c.bronzeBorder : c.border,
                },
              ]}
            >
              <Mono size={10.5} lineHeight={13} letterSpacing={0.3} color={active ? c.bronze : c.ink3}>
                {r.label}
              </Mono>
            </PressablePillScale>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  pills: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
})
