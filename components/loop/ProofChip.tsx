import { StyleSheet, View } from 'react-native'
import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { radii } from '../../design/tokens'

interface Props {
  proven: boolean
}

// Provider-proof badge · HONEST by construction. moss "PROVA ✓" ONLY when the
// cycle carries real provider-proof (multi_agent_workcell.present or a proof
// field); otherwise ink3 "SEM PROVA". NEVER a green check on an unproven cycle.
export function ProofChip({ proven }: Props) {
  const c = usePalette()
  return (
    <View
      style={[
        styles.chip,
        { borderColor: proven ? c.bronzeBorder : c.border },
        proven && { backgroundColor: c.bronzeWash },
      ]}
    >
      <Mono size={10} lineHeight={13} letterSpacing={0.4} color={proven ? c.moss : c.ink3}>
        {proven ? 'PROVA ✓' : 'SEM PROVA'}
      </Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
})
