import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { TocRow } from '../editorial/TocRow'
import { EditorialPullQuote } from '../editorial/EditorialPullQuote'
import { StatusDot } from './StatusDot'
import { normalizeHealth } from './loopTone'
import { shortMergeHash } from './loopFormat'
import type { AtlasLoopCycleRecord, AtlasLoopLiveResponse } from '../../lib/loop'

interface Props {
  live: AtlasLoopLiveResponse | null
  cycles: AtlasLoopCycleRecord[]
  loading: boolean
}

// Section vi (audit colophon). Distinct from i (which is "now") — this is the
// standing posture + proof. Introduces NO new data; it SUMMARIZES. The conscience
// pull-quote is SUPPRESSED while loading (no fabricated verdict) and turns into
// an honest WARNING when any merge in the window is unproven or drift is present.
export function TrustColophon({ live, cycles, loading }: Props) {
  const c = usePalette()

  const merged = cycles.filter((r) => r.merge_performed === true)
  const provenMerges = merged.filter((r) => isProven(r))
  const allProven = merged.length > 0 && provenMerges.length === merged.length
  const drift = readDrift(live)
  const newestMerged = [...merged].reverse().find((r) => String(r.merge_hash ?? '').trim() !== '')
  const tier = readTier(live)
  const killActive = live?.run_state?.kill_switch?.active === true

  return (
    <View>
      {/* conscience verdict — suppressed while loading */}
      {!loading && live !== null ? (
        merged.length === 0 ? null : allProven && !drift.detected ? (
          <EditorialPullQuote
            quote="Mostro merge só com prova de provider e base de aceitação. Bloqueio aparece inteiro, nunca escondido."
            attribution="ATLAS · VIGÍLIA DO LOOP"
          />
        ) : (
          <EditorialPullQuote
            quote="Há merges sem prova nesta janela. Audite antes de confiar."
            attribution="ATLAS · VIGÍLIA DO LOOP"
          />
        )
      ) : null}

      {/* EMPTY — no merges yet */}
      {!loading && merged.length === 0 ? (
        <Frau italic size={15} lineHeight={22} color={c.ink2} style={styles.empty}>
          Nenhum merge ainda para provar.
        </Frau>
      ) : null}

      <TocRow
        label="merges com prova"
        withLeader
        live={allProven}
        value={
          <Mono size={13} lineHeight={18} color={allProven ? c.moss : c.ink2}>
            {`${provenMerges.length}/${merged.length} provados`}
          </Mono>
        }
      />
      <TocRow
        label="última prova"
        withLeader
        live={newestMerged != null}
        value={
          <Mono size={13} lineHeight={18} color={newestMerged != null ? c.bronze : c.ink3}>
            {newestMerged != null ? `#${shortMergeHash(newestMerged.merge_hash)}` : 'sem merge'}
          </Mono>
        }
      />
      <TocRow
        label="base de aceitação"
        withLeader
        value={
          <Mono size={13} lineHeight={18} color={c.ink2}>
            {`gates+diff em ${cycles.length} ciclos`}
          </Mono>
        }
      />
      <TocRow
        label="tier de autonomia"
        withLeader
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
        value={
          <View style={styles.value}>
            <StatusDot tone={drift.detected ? c.amber : c.moss} />
            <Mono size={13} lineHeight={18} color={drift.detected ? c.amber : c.moss}>
              {drift.label}
            </Mono>
          </View>
        }
      />
      <TocRow
        label="kill armado"
        withLeader
        value={
          <View style={styles.value}>
            <StatusDot tone={killActive ? c.recRed : c.moss} />
            <Mono size={13} lineHeight={18} color={killActive ? c.recRed : c.moss}>
              {killActive ? 'sim' : 'não'}
            </Mono>
          </View>
        }
      />

      <Mono size={11} lineHeight={15} letterSpacing={1.1} color={c.ink3} style={styles.foot}>
        SOMENTE LEITURA · ESTE PAINEL NUNCA EXECUTA, NUNCA FAZ MERGE, NUNCA CHAMA PROVIDER.
      </Mono>
    </View>
  )
}

function isProven(record: AtlasLoopCycleRecord): boolean {
  if (record.multi_agent_workcell?.present === true) return true
  const proof = (record as Record<string, unknown>)['provider_proof'] ?? (record as Record<string, unknown>)['proof']
  return proof != null && proof !== false && proof !== ''
}

function readDrift(live: AtlasLoopLiveResponse | null): { detected: boolean; label: string } {
  const immune = (live?.cockpit as Record<string, unknown> | undefined)?.immune as Record<string, unknown> | undefined
  const driftRaw = immune?.['drift'] ?? immune?.['drift_status']
  if (driftRaw == null) {
    // No immune projection: fall back to health (blocked ~ unstable), honestly labeled.
    const health = normalizeHealth(live)
    if (health === 'blocked' || health === 'bug') return { detected: true, label: 'instável' }
    return { detected: false, label: 'estável' }
  }
  const drift = String(driftRaw).toLowerCase()
  if (['stable', 'estável', 'none', 'no_drift'].includes(drift)) return { detected: false, label: 'estável' }
  return { detected: true, label: 'deriva detectada' }
}

function readTier(live: AtlasLoopLiveResponse | null): { label: string; elevated: boolean } {
  const ea = (live?.cockpit as Record<string, unknown> | undefined)?.earned_autonomy as
    | Record<string, unknown>
    | undefined
  const tierRaw = ea?.['earned_tier'] ?? ea?.['tier']
  if (tierRaw == null || String(tierRaw).trim() === '') return { label: 'padrão', elevated: false }
  const tierStr = String(tierRaw).trim()
  const isDefault = /^(t0|tier_?0|0|default|proposal[_-]?only|baseline)$/i.test(tierStr)
  return isDefault ? { label: 'padrão', elevated: false } : { label: tierStr, elevated: true }
}

const styles = StyleSheet.create({
  empty: {
    marginHorizontal: 32,
    marginBottom: 8,
  },
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  foot: {
    marginHorizontal: 32,
    marginTop: 16,
  },
})
