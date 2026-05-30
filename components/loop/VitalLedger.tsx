import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { TocRow } from '../editorial/TocRow'
import { StatusDot } from './StatusDot'
import { ImmuneLedger } from './ImmuneLedger'
import { loopStateWord, loopTone, normalizeHealth, type LoopState } from './loopTone'
import { absoluteTime, relativeTime, uptimeSince } from './loopFormat'
import type { AtlasLoopLiveResponse } from '../../lib/loop'

interface Props {
  live: AtlasLoopLiveResponse | null
  loopState: LoopState
  loading: boolean
  /** Newest cycle recorded_at (relative "última atividade"). */
  newestCycleAt?: string | null
  /** Smooth-scroll target when the immune "kill armado" row is tapped. */
  onKillRowPress: () => void
}

const PLACEHOLDER = '·····'

// Section i body · the watch board. A stack of TocRow (variant codex, leader);
// values = StatusDot + Mono. live=true ONLY on real/non-default datums. Then a
// hr whisper + ImmuneLedger. LOADING shows "·····" that HOLD the real layout so
// nothing reflows when data lands. IDLE renders honest "sem …" + a calm Frau line.
export function VitalLedger({ live, loopState, loading, newestCycleAt, onKillRowPress }: Props) {
  const c = usePalette()
  const tone = loopTone(loopState, c)
  const isLoading = loading && live === null

  // --- derive real datums (honest; null/absent -> calm fallbacks) -----------
  const holder = live?.run_state?.lock?.holder ?? null
  const acquiredAt = (holder?.acquired_at as string | undefined) ?? null
  const uptime = uptimeSince(acquiredAt)
  const backlog = live?.run_state?.scheduler_backlog
  const cycleIndex = backlog?.recovery?.last_cycle_index
  const mergesTotal = backlog?.recovery?.merges_total ?? 0
  const blockedInRow = backlog?.recovery?.blocked_in_row ?? 0
  const leaseTtl = (holder?.lease_ttl_seconds as number | undefined) ?? null
  const budget = readBudget(live)
  const health = normalizeHealth(live)

  const isIdle = loopState === 'idle'
  const hasRun = uptime !== null

  // última atividade staleness: older than lease_ttl -> honest absolute callout.
  const lastActivity = computeLastActivity(newestCycleAt, leaseTtl)

  const v = (node: React.ReactNode) => (isLoading ? <Placeholder /> : node)

  return (
    <View>
      {/* 1 · estado — the trust anchor, equals the masthead pill */}
      <TocRow
        label="estado"
        withLeader
        live={loopState === 'alive'}
        value={v(
          <View style={styles.value}>
            <StatusDot tone={tone} />
            <Mono weight="med" size={13} lineHeight={18} letterSpacing={0.2} color={tone}>
              {loopStateWord(loopState)}
            </Mono>
          </View>,
        )}
      />

      {/* 2 · saúde */}
      <TocRow
        label="saúde"
        withLeader
        live={health === 'healthy'}
        value={v(
          <View style={styles.value}>
            <StatusDot tone={healthTone(health, c)} />
            <Mono size={13} lineHeight={18} color={healthTone(health, c)}>
              {healthWord(health)}
            </Mono>
          </View>,
        )}
      />

      {/* 3 · tempo de vida */}
      <TocRow
        label="tempo de vida"
        withLeader
        live={hasRun}
        value={v(
          hasRun ? (
            <Mono size={13} lineHeight={18} color={c.ink}>
              {`${uptime} · ciclo ${cycleIndex ?? '—'}`}
            </Mono>
          ) : (
            <Mono size={13} lineHeight={18} color={c.ink3}>
              sem run ativo
            </Mono>
          ),
        )}
      />

      {/* 4 · taxa de merge */}
      <TocRow
        label="taxa de merge"
        withLeader
        live={mergesTotal > 0}
        value={v(
          <Mono size={13} lineHeight={18} color={mergesTotal > 0 ? c.bronze : c.ink2}>
            {`${mergesTotal} merges · ${blockedInRow} em bloqueio`}
          </Mono>,
        )}
      />

      {/* 5 · orçamento — OMITTED entirely when no real budget field exists */}
      {budget !== null ? (
        <TocRow
          label="orçamento"
          withLeader
          live={budget.tone !== 'neutral'}
          value={v(
            <Mono size={13} lineHeight={18} color={budgetColor(budget.tone, c)}>
              {budget.label}
            </Mono>,
          )}
        />
      ) : null}

      {/* 6 · última atividade */}
      <TocRow
        label="última atividade"
        withLeader
        live={lastActivity.kind === 'fresh'}
        value={v(
          <Mono size={13} lineHeight={18} color={lastActivityColor(lastActivity.kind, c)}>
            {lastActivity.label}
          </Mono>,
        )}
      />

      {/* IDLE (endpoint OK, no run): calm, not an error. */}
      {isIdle && !isLoading ? (
        <Frau italic size={15} lineHeight={22} color={c.ink2} style={styles.idleLine}>
          O loop está em repouso. Nenhum ciclo em curso.
        </Frau>
      ) : null}

      {/* Immune sub-cluster (real/honest even when idle) */}
      {live !== null ? <ImmuneLedger live={live} onKillRowPress={onKillRowPress} /> : null}
    </View>
  )
}

function Placeholder() {
  const c = usePalette()
  return (
    <Mono size={13} lineHeight={18} color={c.ink3}>
      {PLACEHOLDER}
    </Mono>
  )
}

function healthWord(health: string): string {
  if (health === 'healthy') return 'saudável'
  if (health === 'blocked') return 'bloqueado'
  if (health === 'bug') return 'defeito'
  if (health === 'unknown') return 'sem leitura'
  return health
}

function healthTone(health: string, c: ReturnType<typeof usePalette>): string {
  if (health === 'healthy') return c.moss
  if (health === 'blocked') return c.amber
  if (health === 'bug') return c.recRed
  return c.ink3
}

type LastActivity = { kind: 'fresh' | 'stale' | 'none'; label: string }

function computeLastActivity(
  recordedAt: string | null | undefined,
  leaseTtlSeconds: number | null,
): LastActivity {
  if (recordedAt == null || String(recordedAt).trim() === '') {
    return { kind: 'none', label: 'sem atividade' }
  }
  const now = new Date()
  const ms = Date.parse(String(recordedAt))
  if (Number.isNaN(ms)) return { kind: 'none', label: 'sem atividade' }
  const ageSec = Math.max(0, (now.getTime() - ms) / 1000)
  const ttl = leaseTtlSeconds && leaseTtlSeconds > 0 ? leaseTtlSeconds : 90
  if (ageSec > ttl) {
    // Honest "this hasn't moved": absolute time, bronze callout.
    return { kind: 'stale', label: `parado desde ${absoluteTime(recordedAt)}` }
  }
  return { kind: 'fresh', label: relativeTime(recordedAt, now) }
}

function lastActivityColor(kind: LastActivity['kind'], c: ReturnType<typeof usePalette>): string {
  if (kind === 'fresh') return c.ink
  if (kind === 'stale') return c.bronze
  return c.ink3
}

type Budget = { label: string; tone: 'neutral' | 'low' | 'exhausted' }

// Budget remaining — ONLY when a real field is projected (never fabricated).
// Reads scheduler_backlog.budgets if present (cycles/runtime/merges caps).
function readBudget(live: AtlasLoopLiveResponse | null): Budget | null {
  if (live === null) return null
  // scheduler_backlog has no `budgets` in its strict type; budgets only appear in
  // some runner projections. Read it via unknown so we never fabricate the field.
  const backlog = live.run_state?.scheduler_backlog as unknown as Record<string, unknown> | undefined
  const budgets = backlog?.['budgets'] as Record<string, unknown> | undefined
  if (budgets == null || typeof budgets !== 'object') return null
  const max = numericField(budgets, ['cycles_max', 'max_cycles', 'cycle_budget'])
  const used = numericField(budgets, ['cycles_used', 'used_cycles', 'cycles_this_run'])
  if (max == null) return null
  const usedSafe = used ?? 0
  const remaining = Math.max(0, max - usedSafe)
  if (remaining === 0) return { label: `ciclos ${usedSafe}/${max} · esgotado`, tone: 'exhausted' }
  const low = remaining <= Math.max(1, Math.round(max * 0.1))
  return { label: `ciclos ${usedSafe}/${max}`, tone: low ? 'low' : 'neutral' }
}

function budgetColor(tone: Budget['tone'], c: ReturnType<typeof usePalette>): string {
  if (tone === 'exhausted') return c.recRed
  if (tone === 'low') return c.bronze
  return c.ink2
}

function numericField(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const val = obj[k]
    if (typeof val === 'number' && Number.isFinite(val)) return val
  }
  return null
}

const styles = StyleSheet.create({
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  idleLine: {
    marginHorizontal: 32,
    marginTop: 14,
  },
})
