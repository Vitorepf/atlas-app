import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { fonts } from '../../design/tokens'
import { PressableTextScale } from '../atlas-ui/PressableScale'
import { TrustColophon } from './TrustColophon'
import { useExpandable } from '../../lib/loop/useExpandable'
import type { AtlasLoopCycleRecord, AtlasLoopLiveResponse } from '../../lib/loop'

interface Props {
  live: AtlasLoopLiveResponse | null
  cycles: AtlasLoopCycleRecord[]
  loading: boolean
}

// Section viii tail · a one-line "confiança ……" disclosure that FadeIn-expands
// the existing TrustColophon. Default COLLAPSED so CONFIANÇA is not a top-level
// hero on first paint. The collapsed summary is honest: it counts only REAL
// proven merges in the window (never a fabricated verdict). Trust posture
// rendering inside TrustColophon stays default-tier ink3 (RSI/EarnedAutonomy
// default-off, unchanged).
export function TrustFold({ live, cycles, loading }: Props) {
  const c = usePalette()
  const { open, toggle } = useExpandable(false)

  const proven = cycles.filter((r) => r.merge_performed === true && isProven(r)).length
  const summary = loading ? '…' : proven > 0 ? `${proven} provas` : 'sem prova ainda'

  return (
    <View style={styles.wrap}>
      <PressableTextScale onPress={toggle} haptic="light" accessibilityLabel="abrir confiança">
        <View style={styles.row}>
          <Mono size={12} lineHeight={16} letterSpacing={0.4} color={c.bronze}>
            confiança
          </Mono>
          <View style={styles.leaderWrap}>
            <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.leaderText, { color: c.ink3 }]}>
              {DOT_STRING}
            </Text>
          </View>
          <Mono size={12} lineHeight={16} color={proven > 0 ? c.bronze : c.ink3}>
            {`${summary}  ${open ? '↑' : '↓'}`}
          </Mono>
        </View>
      </PressableTextScale>

      {open ? (
        <Animated.View entering={FadeIn.duration(220)} style={styles.body}>
          <TrustColophon live={live} cycles={cycles} loading={loading} />
        </Animated.View>
      ) : null}
    </View>
  )
}

// Same real provider-proof predicate as CycleEntry/TrustColophon (not exported
// from either — mirrored here to keep the summary honest without a fabrication).
function isProven(record: AtlasLoopCycleRecord): boolean {
  if (record.multi_agent_workcell?.present === true) return true
  const proof = (record as Record<string, unknown>)['provider_proof'] ?? (record as Record<string, unknown>)['proof']
  return proof != null && proof !== false && proof !== ''
}

const DOT_STRING = '· '.repeat(80)

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginHorizontal: 32,
    paddingVertical: 10,
    gap: 8,
  },
  leaderWrap: {
    flex: 1,
    overflow: 'hidden',
    height: 14,
    justifyContent: 'flex-end',
  },
  leaderText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: 0.5,
    opacity: 0.55,
  },
  body: {
    marginTop: 6,
  },
})
