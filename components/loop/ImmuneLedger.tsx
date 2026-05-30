import { StyleSheet, View } from 'react-native'
import { Label, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { TocRow } from '../editorial/TocRow'
import { StatusDot } from './StatusDot'
import type { AtlasLoopLiveResponse } from '../../lib/loop'

interface Props {
  live: AtlasLoopLiveResponse
  onKillRowPress: () => void
}

// Section i autonomy sub-cluster (the "what autonomy is in force" tail).
// RSI / EarnedAutonomy are DEFAULT-OFF: an un-elevated tier renders ink3
// ("padrão · nenhum tier elevado"), NOT bronze-celebrated. Honest fallbacks
// when a field is absent. The "kill armado" row bridges to Section v.
export function ImmuneLedger({ live, onKillRowPress }: Props) {
  const c = usePalette()

  const tier = readEarnedTier(live)
  const drift = readDrift(live)
  const killActive = live.run_state?.kill_switch?.active === true
  const killFileOnly = isFileBasedKill(live)

  return (
    <View style={styles.wrap}>
      <View style={[styles.hr, { backgroundColor: c.ink }]} />
      <Label color={c.ink3} style={styles.heading}>
        AUTONOMIA EM VIGOR
      </Label>

      <TocRow
        label="tier conquistado"
        withLeader
        withDivider
        live={tier.elevated}
        value={
          <View style={styles.value}>
            <StatusDot tone={tier.elevated ? c.bronze : c.ink3} />
            <Mono size={13} lineHeight={18} color={tier.elevated ? c.bronze : c.ink3}>
              {tier.label}
            </Mono>
          </View>
        }
      />

      <TocRow
        label="deriva"
        withLeader
        withDivider
        value={
          <View style={styles.value}>
            <StatusDot tone={drift.tone} />
            <Mono size={13} lineHeight={18} color={drift.color(c)}>
              {drift.label}
            </Mono>
          </View>
        }
      />

      <TocRow
        label="kill armado"
        withLeader
        withDivider
        onPress={onKillRowPress}
        accessibilityLabel="Ver controle de execução."
        value={
          <View style={styles.value}>
            <StatusDot tone={killActive ? c.recRed : c.moss} />
            <Mono size={13} lineHeight={18} color={killActive ? c.recRed : c.moss}>
              {`${killActive ? 'ARMADO' : 'desarmado'}${killFileOnly ? ' (sinal)' : ''}`}
            </Mono>
          </View>
        }
      />
    </View>
  )
}

// Earned-autonomy tier · default-off renders ink3, never bronze-celebrated.
function readEarnedTier(live: AtlasLoopLiveResponse): { label: string; elevated: boolean } {
  const ea = (live.cockpit as Record<string, unknown> | undefined)?.earned_autonomy as
    | Record<string, unknown>
    | undefined
  const tierRaw =
    ea?.['earned_tier'] ??
    ea?.['tier'] ??
    (live.cockpit?.health as Record<string, unknown> | undefined)?.['autonomy_tier']
  if (tierRaw == null || String(tierRaw).trim() === '') {
    // No earned-autonomy projection at all -> honest "não reportado".
    return { label: 'não reportado', elevated: false }
  }
  const tierStr = String(tierRaw).trim()
  const note = String(ea?.['note'] ?? ea?.['posture'] ?? '').trim()
  // Default tier (T0 / 0 / default / proposal-only) -> ink3, not bronze.
  const isDefault = /^(t0|tier_?0|0|default|proposal[_-]?only|baseline)$/i.test(tierStr)
  if (isDefault) {
    return { label: 'padrão · nenhum tier elevado', elevated: false }
  }
  return { label: note !== '' ? `${tierStr} · ${note}` : tierStr, elevated: true }
}

function readDrift(live: AtlasLoopLiveResponse): {
  label: string
  tone: string
  color: (c: ReturnType<typeof usePalette>) => string
} {
  const immune = (live.cockpit as Record<string, unknown> | undefined)?.immune as
    | Record<string, unknown>
    | undefined
  const driftRaw = immune?.['drift'] ?? immune?.['drift_status']
  if (driftRaw == null) {
    return { label: 'não medido', tone: '#677482', color: (c) => c.ink3 }
  }
  const drift = String(driftRaw).toLowerCase()
  if (['stable', 'estável', 'none', 'no_drift'].includes(drift)) {
    return { label: 'estável', tone: 'stable', color: (c) => c.moss }
  }
  return { label: 'deriva detectada', tone: 'drift', color: (c) => c.amber }
}

// Only the file signal is known (no richer immune projection) -> "(sinal)" suffix.
function isFileBasedKill(live: AtlasLoopLiveResponse): boolean {
  const immune = (live.cockpit as Record<string, unknown> | undefined)?.immune
  return immune == null
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 0,
  },
  hr: {
    height: 1,
    opacity: 0.08,
    marginHorizontal: 32,
    marginVertical: 14,
  },
  heading: {
    marginHorizontal: 32,
    marginBottom: 4,
  },
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
})
