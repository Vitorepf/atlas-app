import { StyleSheet, View } from 'react-native'
import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { PressableTextScale } from '../atlas-ui/PressableScale'
import { statusLabel } from './loopTone'
import { shortHash } from './loopFormat'

interface Props {
  decision: string
  decisionId: string
  routedTo: string
  onViewReceipt: () => void
}

// Collapsed state of a decided card · keeps the audit visible without a hole.
// "✓ {decision} · {decisionId short} · roteado a {routedTo}" + "ver recibo".
export function SealedDecisionRow({ decision, decisionId, routedTo, onViewReceipt }: Props) {
  const c = usePalette()
  return (
    <View style={styles.row}>
      <Mono size={12} lineHeight={17} letterSpacing={0.1} color={c.ink3} style={styles.line}>
        {`✓ ${statusLabel(decision)} · ${shortHash(decisionId, 10)} · roteado a ${routedTo}`}
      </Mono>
      <PressableTextScale onPress={onViewReceipt} haptic="soft" accessibilityLabel="ver recibo da decisão">
        <Mono size={11} lineHeight={16} letterSpacing={0.3} color={c.bronze}>
          ver recibo
        </Mono>
      </PressableTextScale>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  line: {
    flex: 1,
  },
})
