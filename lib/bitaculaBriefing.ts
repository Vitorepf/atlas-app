import type { AtlasBehavior, AtlasBehaviorLog } from './api/client'

export interface BitaculaBriefingSelection {
  behavior: AtlasBehavior
  log: AtlasBehaviorLog | null
  reason: 'pending_sleep_context' | 'pending_context' | 'already_logged'
  score: number
}

export function selectBitaculaBriefingItems({
  behaviors,
  logs,
  date,
  limit = 12,
  includeLogged = true,
}: {
  behaviors: AtlasBehavior[]
  logs: AtlasBehaviorLog[]
  date: string
  limit?: number
  includeLogged?: boolean
}): BitaculaBriefingSelection[] {
  const logsByBehavior = new Map(
    logs
      .filter((log) => log.log_date === date && !log.reverted_at)
      .map((log) => [log.behavior_client_id, log]),
  )

  return behaviors
    .filter((behavior) => !behavior.archived_at && behavior.show_in_morning_briefing)
    .map((behavior) => {
      const log = logsByBehavior.get(behavior.client_id) ?? null
      const score = briefingScore(behavior, log !== null)

      return {
        behavior,
        log,
        score,
        reason: briefingReason(behavior, log !== null),
      }
    })
    .filter((item) => includeLogged || item.log === null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function briefingScore(behavior: AtlasBehavior, hasLogForDate: boolean): number {
  let score = behavior.priority_score
  score += hasLogForDate ? 0 : 10000
  score += hasOutcome(behavior, ['sleep', 'hrv', 'energy', 'mood', 'focus']) ? 250 : 0
  score += Math.max(0, 7 - (behavior.total_yes_count + behavior.total_no_count)) * 30
  score -= behavior.streak_no >= 10 ? 100 : 0

  return score
}

function briefingReason(behavior: AtlasBehavior, hasLogForDate: boolean): BitaculaBriefingSelection['reason'] {
  if (!hasLogForDate) {
    return hasOutcome(behavior, ['sleep', 'hrv']) ? 'pending_sleep_context' : 'pending_context'
  }

  return 'already_logged'
}

function hasOutcome(behavior: AtlasBehavior, outcomes: string[]): boolean {
  return behavior.target_outcomes.some((outcome) => outcomes.includes(outcome))
}
