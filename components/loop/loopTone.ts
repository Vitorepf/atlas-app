// Atlas Loop · single tone source.
//
// The Loop is the ONLY surface the operator uses to talk to the autonomous 24h
// loop, so a SINGLE derived `loopState` value must feed three renderings (the
// masthead pill, the Vitals "estado" row, the RunControl top line) — they can
// never disagree. statusColor/statusLabel are ported VERBATIM from
// app/engineering.tsx (proven, same-codebase DNA, not a parallel style); the
// loop-specific tone/word maps below layer the run-state vocabulary on top of
// that single map so every dot, pill and word resolves through one function.

import type { AtlasPalette } from '../../design/tokens'
import type {
  AtlasLoopLiveResponse,
  AtlasLoopRiskLevel,
} from '../../lib/loop'

// The one truth word. kill beats all; a no-signal/blocked loop never renders
// alive and never offers stop controls.
export type LoopState =
  | 'loading'
  | 'alive'
  | 'paused'
  | 'killed'
  | 'blocked'
  | 'bug'
  | 'idle'
  | 'no_signal'

// ---------------------------------------------------------------------------
// statusLabel — PORTED VERBATIM from app/engineering.tsx:3581 (shared DNA).
// ---------------------------------------------------------------------------
export function statusLabel(status: string): string {
  switch (status) {
    case 'passed':
    case 'resolved':
    case 'active':
      return 'ok'
    case 'failed':
    case 'unresolved':
    case 'unsafe':
      return 'falha'
    case 'partial':
    case 'reviewing':
      return 'revisar'
    case 'running':
      return 'rodando'
    case 'empty':
      return 'vazio'
    case 'first_baseline':
      return 'base'
    case 'improved':
      return 'melhor'
    case 'regressed':
      return 'regrediu'
    case 'stable':
      return 'estável'
    case 'warning':
      return 'aviso'
    case 'skipped':
      return 'pulado'
    case 'missing':
      return 'faltando'
    case 'allowed':
      return 'permitido'
    case 'approved':
      return 'aprovado'
    case 'not_approved':
      return 'sem aprovação'
    case 'not_configured':
      return 'sem policy'
    case 'denied':
      return 'negado'
    case 'requires_approval':
      return 'aprovar'
    case 'release_ready':
      return 'pronto'
    case 'needs_review':
      return 'revisar'
    case 'blocked':
      return 'bloq'
    case 'healthy':
    case 'ready':
      return 'saudável'
    case 'documented':
      return 'doc'
    case 'module_documented':
      return 'módulo'
    case 'undocumented':
      return 'sem doc'
    case 'current':
    case 'fresh':
      return 'atual'
    case 'drift_detected':
      return 'drift'
    case 'empty_index':
      return 'vazio'
    case 'not_audited':
      return 'auditar'
    case 'missing_target':
      return 'faltando'
    case 'accepted':
      return 'aceito'
    case 'degraded':
      return 'degradou'
    case 'incident':
      return 'incidente'
    case 'rolled_back':
      return 'rollback'
    case 'monitoring':
      return 'monitorar'
    case 'pending':
      return 'pendente'
    case 'cancelled':
      return 'cancelado'
    case 'cancel':
      return 'cancelar'
    case 'accept':
      return 'aceitar'
    case 'reject':
      return 'rejeitar'
    case 'needs_human':
      return 'humano'
    case 'unchanged':
      return 'mantida'
    case 'adjusted':
      return 'ajustada'
    case 'insufficient_data':
      return 'sem dados'
    case 'watch':
      return 'atenção'
    case 'conservative':
      return 'restrito'
    case 'ranked':
      return 'rank'
    case 'single_attempt':
      return 'único'
    case 'best_repair_base':
      return 'melhor base'
    case 'review_before_replay':
      return 'revisar base'
    case 'avoid_replay_base':
      return 'evitar base'
    default:
      return status || '-'
  }
}

// ---------------------------------------------------------------------------
// statusColor — PORTED VERBATIM from app/engineering.tsx:3697 (shared DNA),
// extended with the loop-specific run-state tones (the spec's tone map):
//   moss   = alive/healthy/merged/resume/ok/stable
//   amber  = paused/blocked-cycle/progress/warning/drift/watch
//   recRed = killed/bug/critical/destructive/quarantined
//   prussian = info/request_changes
//   bronze = tier/live-datum/proof/repeated/accent
//   ink2/ink3 = neutral/absent
// ---------------------------------------------------------------------------
export function statusColor(status: string, c: AtlasPalette): string {
  const normalized = status.toLowerCase()
  // Loop run-state vocabulary first (these are the words the loop emits).
  if (['alive', 'merged', 'resume', 'desarmado', 'estável'].includes(normalized)) return c.moss
  if (['killed', 'encerrado', 'bug', 'defeito', 'quarantined', 'armado', 'crash'].includes(normalized)) return c.recRed
  if (['paused', 'pausado', 'progress', 'progresso', 'drift', 'deriva', 'repeated_finding', 'em_bloqueio'].includes(normalized)) return c.amber
  if (['request_changes', 'ajustes', 'info', 'idle', 'repouso'].includes(normalized)) return c.prussian
  if (['tier', 'proof', 'live', 'accent'].includes(normalized)) return c.bronze
  // engineering.tsx map (verbatim) — shared categories.
  if (['passed', 'resolved', 'ok', 'active', 'ready'].includes(normalized)) return c.moss
  if (['improved', 'melhor', 'release_ready', 'healthy', 'documented', 'current', 'fresh', 'accepted', 'accept', 'best_repair_base', 'allowed', 'approved'].includes(normalized)) return c.moss
  if (['failed', 'unresolved', 'unsafe', 'falha', 'regressed', 'blocked', 'degraded', 'incident', 'rolled_back', 'cancelled', 'cancel', 'reject', 'missing_target', 'missing', 'denied', 'critical', 'bloq'].includes(normalized)) return c.recRed
  if (['avoid_replay_base'].includes(normalized)) return c.recRed
  if (['partial', 'reviewing', 'running', 'first_baseline', 'stable', 'warning', 'needs_review', 'monitoring', 'pending', 'watch', 'conservative', 'adjusted', 'needs_human', 'ranked', 'single_attempt', 'review_before_replay', 'module_documented', 'undocumented', 'drift_detected', 'empty_index', 'requires_approval', 'not_approved', 'not_configured'].includes(normalized)) return c.bronze
  return c.ink2
}

// ---------------------------------------------------------------------------
// loopTone — resolves the dot/pill color for a derived LoopState.
// ---------------------------------------------------------------------------
export function loopTone(state: LoopState, c: AtlasPalette): string {
  switch (state) {
    case 'alive':
      return c.moss
    case 'paused':
    case 'blocked':
      return c.amber
    case 'killed':
    case 'bug':
      return c.recRed
    case 'idle':
      return c.ink3
    case 'no_signal':
      return c.ink2
    case 'loading':
      return c.ink3
    default:
      return c.ink2
  }
}

// The one word, shown identically in pill + vitals "estado" + run-control top.
export function loopStateWord(state: LoopState): string {
  switch (state) {
    case 'alive':
      return 'VIVO'
    case 'paused':
      return 'PAUSADO'
    case 'killed':
      return 'ENCERRADO'
    case 'blocked':
      return 'EM BLOQUEIO'
    case 'bug':
      return 'DEFEITO'
    case 'idle':
      return 'EM REPOUSO'
    case 'no_signal':
      return 'SEM SINAL'
    case 'loading':
    default:
      return '…'
  }
}

// Risk → tone for RiskTag / risk dots (low ink3, medium amber, high bronzeDeep,
// critical recRed). Honest escalation; never celebrates a high risk.
export function riskTone(risk: AtlasLoopRiskLevel | string, c: AtlasPalette): string {
  switch (risk) {
    case 'low':
      return c.ink3
    case 'medium':
      return c.amber
    case 'high':
      return c.bronzeDeep
    case 'critical':
      return c.recRed
    default:
      return c.ink2
  }
}

export function riskWord(risk: AtlasLoopRiskLevel | string): string {
  switch (risk) {
    case 'low':
      return 'RISCO BAIXO'
    case 'medium':
      return 'RISCO MÉDIO'
    case 'high':
      return 'RISCO ALTO'
    case 'critical':
      return 'RISCO CRÍTICO'
    default:
      return 'RISCO'
  }
}

// ---------------------------------------------------------------------------
// deriveLoopState — THE single truth. STRICT order, kill beats all.
//   loading & live===null                  -> 'loading'
//   live===null after load                 -> 'no_signal'  (BLOCKED render)
//   run_state.kill_switch.active===true     -> 'killed'
//   run_state.pause.active===true           -> 'paused'
//   lock.held && health==='healthy'         -> 'alive'
//   lock.held && health==='blocked'         -> 'blocked'
//   lock.held && health∈{bug,crash}         -> 'bug'
//   lock.available && !lock.held            -> 'idle'
// ---------------------------------------------------------------------------
export function deriveLoopState(
  live: AtlasLoopLiveResponse | null,
  loading: boolean,
): LoopState {
  if (loading && live === null) return 'loading'
  if (live === null) return 'no_signal'

  const run = live.run_state
  if (run?.kill_switch?.active === true) return 'killed'
  if (run?.pause?.active === true) return 'paused'

  const held = run?.lock?.held === true && run?.lock?.orphaned !== true
  const health = normalizeHealth(live)

  if (held && (health === 'healthy' || health === 'ok' || health === 'ready')) return 'alive'
  if (held && health === 'blocked') return 'blocked'
  if (held && (health === 'bug' || health === 'crash')) return 'bug'
  if (held) {
    // Held but health unknown/degraded: alive but in honest bloqueio (never fake healthy).
    return health === 'unknown' ? 'alive' : 'blocked'
  }
  if (run?.lock?.available === true && !held) return 'idle'
  return 'idle'
}

/** Read the cockpit overall health honestly (string already humanized server-side). */
export function normalizeHealth(live: AtlasLoopLiveResponse | null): string {
  const overall = String(live?.cockpit?.health?.overall ?? '').toLowerCase()
  if (overall === '') {
    // Cockpit blocked (no health) — treat as blocked, never healthy.
    return live?.cockpit?.status === 'blocked' ? 'blocked' : 'unknown'
  }
  if (['healthy', 'ok', 'ready', 'green', 'nominal'].includes(overall)) return 'healthy'
  if (['blocked', 'degraded', 'attention', 'warning', 'amber'].includes(overall)) return 'blocked'
  if (['bug', 'crash', 'incident', 'red', 'critical'].includes(overall)) return 'bug'
  return overall
}
