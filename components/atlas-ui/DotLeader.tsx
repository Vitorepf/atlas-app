import { StyleSheet, View } from 'react-native'
import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'

// Editorial dot leader (the row of "·" that bridges a label and its value).
// Extracted from 6 identical private copies (runbook S-A7). `opacity` keeps
// each screen's exact tone: most use 0.45, MonthDayRow 0.4, SnoozeSheet 0.5.
export function DotLeader({ opacity = 0.45 }: { opacity?: number }) {
  const c = usePalette()
  return (
    <View style={styles.leader}>
      <Mono size={11} lineHeight={16} letterSpacing={2} color={c.ink3} numberOfLines={1} style={{ opacity }}>
        {'·'.repeat(60)}
      </Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  leader: {
    flex: 1,
    overflow: 'hidden',
  },
})
