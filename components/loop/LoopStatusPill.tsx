import { StyleSheet, View } from 'react-native'
import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { radii } from '../../design/tokens'
import { loopStateWord, loopTone, statusColor, statusLabel, type LoopState } from './loopTone'

interface Props {
  /** The derived loopState — fed identically to masthead, vitals, run-control. */
  state?: LoopState
  /** Compact outcome pill used INSIDE a CycleEntry / receipt header. */
  compact?: boolean
  /** Override word/tone for the compact outcome variant (cycle outcome). */
  outcome?: string
}

// PORT of engineering.tsx StatusPill (:3531): a bordered Mono-caps pill whose
// border + text both take the state tone. Words come from loopStateWord for the
// big loop pill, or from statusLabel for the compact cycle-outcome variant.
export function LoopStatusPill({ state, compact = false, outcome }: Props) {
  const c = usePalette()

  if (compact && outcome != null) {
    const tone = statusColor(outcome, c)
    return (
      <View style={[styles.pill, styles.pillCompact, { borderColor: tone }]}>
        <Mono size={9.5} lineHeight={12} letterSpacing={0.1} color={tone}>
          {statusLabel(outcome)}
        </Mono>
      </View>
    )
  }

  const resolved: LoopState = state ?? 'loading'
  const tone = loopTone(resolved, c)
  return (
    <View style={[styles.pill, compact && styles.pillCompact, { borderColor: tone }]}>
      <Mono
        size={compact ? 9.5 : 10.5}
        lineHeight={compact ? 12 : 14}
        letterSpacing={0.1}
        color={tone}
      >
        {loopStateWord(resolved)}
      </Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  pillCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
})
