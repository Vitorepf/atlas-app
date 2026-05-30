import { View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { TocRow } from '../editorial/TocRow'
import { StatusDot } from './StatusDot'
import { loopStateWord, loopTone, normalizeHealth, type LoopState } from './loopTone'
import { absoluteTime, relativeTime } from './loopFormat'
import type { AtlasLoopLiveResponse } from '../../lib/loop'

interface Props {
  live: AtlasLoopLiveResponse
  loopState: LoopState
  /** Newest cycle recorded_at (relative "última atividade"). */
  newestCycleAt: string | null
}

// Section ii body · ACOMPANHAR — the live run, active-run-only. The caller MOUNTS
// this only when loopState ∈ {alive,blocked,bug} (gate on the STABLE loopState,
// not on `live` object identity — anti-flicker D.3), so it never mount-thrashes
// under a no-op poll. A TocRow stack (NOT cards), STATIC dots, no spinner. A
// blocked run is NOT an error → amber health + the verbatim latest blocker.
// Honest: every datum is a real typed field; absent rows are simply omitted.
export function RunTracker({ live, loopState, newestCycleAt }: Props) {
  const c = usePalette()
  const tone = loopTone(loopState, c)

  const backlog = live.run_state?.scheduler_backlog
  const recent = Array.isArray(backlog?.recent_cycles) ? backlog!.recent_cycles : []
  const last = recent.length > 0 ? recent[recent.length - 1] : null
  const cycleIndex = backlog?.recovery?.last_cycle_index
  const blockedInRow = backlog?.recovery?.blocked_in_row ?? 0
  const health = normalizeHealth(live)

  // última atividade staleness (lease-aware), honest absolute callout when stale.
  const holder = live.run_state?.lock?.holder ?? null
  const leaseTtl = (holder?.lease_ttl_seconds as number | undefined) ?? null
  const activity = computeLastActivity(newestCycleAt, leaseTtl)

  // worktrees — only show when there are real ones.
  const obs = live.cockpit?.loop_24h_observability
  const worktrees = Array.isArray(obs?.active_worktrees) ? obs!.active_worktrees.length : 0

  // The latest real blocker (verbatim), shown only for a blocked/bug run.
  const blockers = Array.isArray(last?.blockers) ? last!.blockers.filter((b) => String(b).trim() !== '') : []
  const showBlocker = (loopState === 'blocked' || loopState === 'bug') && blockers.length > 0

  return (
    <View>
      {/* ciclo atual — index + last outcome word */}
      <TocRow
        label="ciclo atual"
        withLeader
        live={cycleIndex != null}
        value={
          <Mono size={13} lineHeight={18} color={c.ink}>
            {cycleIndex != null
              ? `ciclo ${cycleIndex}${last != null ? ` · ${outcomeWord(String(last.outcome ?? ''))}` : ''}`
              : '—'}
          </Mono>
        }
      />

      {/* status — equals the masthead pill */}
      <TocRow
        label="status"
        withLeader
        live={loopState === 'alive'}
        value={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StatusDot tone={tone} />
            <Mono weight="med" size={13} lineHeight={18} letterSpacing={0.2} color={tone}>
              {loopStateWord(loopState)}
            </Mono>
          </View>
        }
      />

      {/* última atividade — fresh ink / stale bronze */}
      <TocRow
        label="última atividade"
        withLeader
        live={activity.kind === 'fresh'}
        value={
          <Mono size={13} lineHeight={18} color={activityColor(activity.kind, c)}>
            {activity.label}
          </Mono>
        }
      />

      {/* em bloqueio — amber when > 0 */}
      <TocRow
        label="em bloqueio"
        withLeader
        live={false}
        value={
          <Mono size={13} lineHeight={18} color={blockedInRow > 0 ? c.amber : c.ink2}>
            {`${blockedInRow} ciclos`}
          </Mono>
        }
      />

      {/* worktrees — only when real ones exist */}
      {worktrees > 0 ? (
        <TocRow
          label="worktrees"
          withLeader
          live
          value={
            <Mono size={13} lineHeight={18} color={c.bronze}>
              {`${worktrees} ativo${worktrees === 1 ? '' : 's'}`}
            </Mono>
          }
        />
      ) : null}

      {/* the latest blocker, verbatim (never hidden, never fabricated) */}
      {showBlocker ? (
        <Frau
          italic
          size={14}
          lineHeight={20}
          color={loopState === 'bug' ? c.recRed : c.amber}
          numberOfLines={3}
          style={{ marginHorizontal: 32, marginTop: 12 }}
        >
          {String(blockers[0])}
        </Frau>
      ) : null}
    </View>
  )
}

type LastActivity = { kind: 'fresh' | 'stale' | 'none'; label: string }

function computeLastActivity(recordedAt: string | null, leaseTtlSeconds: number | null): LastActivity {
  if (recordedAt == null || String(recordedAt).trim() === '') {
    return { kind: 'none', label: 'sem atividade' }
  }
  const ms = Date.parse(String(recordedAt))
  if (Number.isNaN(ms)) return { kind: 'none', label: 'sem atividade' }
  const ageSec = Math.max(0, (Date.now() - ms) / 1000)
  const ttl = leaseTtlSeconds && leaseTtlSeconds > 0 ? leaseTtlSeconds : 90
  if (ageSec > ttl) return { kind: 'stale', label: `parado desde ${absoluteTime(recordedAt)}` }
  return { kind: 'fresh', label: relativeTime(recordedAt) }
}

function activityColor(kind: LastActivity['kind'], c: ReturnType<typeof usePalette>): string {
  if (kind === 'fresh') return c.ink
  if (kind === 'stale') return c.bronze
  return c.ink3
}

function outcomeWord(outcome: string): string {
  switch (outcome) {
    case 'merged':
      return 'merged'
    case 'blocked':
      return 'bloqueado'
    case 'progress':
      return 'progresso'
    case 'bug':
      return 'defeito'
    case 'repeated_finding':
      return 'repetido'
    case 'quarantined':
      return 'quarentena'
    default:
      return outcome || 'em curso'
  }
}
