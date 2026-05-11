import type { AtlasOperationalInboxItem } from './api/client'
import type { OperationalFilter } from './inboxTypes'

export function threadIdFromActionResult(result: Record<string, unknown>): string | null {
  const threadId = result.thread_id
  if (typeof threadId === 'string' && threadId !== '') return threadId

  const deepLink = result.deep_link
  if (typeof deepLink !== 'string') return null

  const match = deepLink.match(/^atlas:\/\/thread\/([^/?#]+)/)
  return match?.[1] ?? null
}

export function isActiveOperationalItem(item: AtlasOperationalInboxItem): boolean {
  if (item.status === 'resolved' || item.status === 'dismissed' || item.status === 'expired') {
    return false
  }

  if (item.status === 'snoozed' && item.snoozed_until) {
    const snoozedUntil = new Date(item.snoozed_until)
    return Number.isFinite(snoozedUntil.getTime()) && snoozedUntil.getTime() <= Date.now()
  }

  return true
}

export function countOperationalItems(items: AtlasOperationalInboxItem[]): Record<OperationalFilter, number> {
  return items.reduce<Record<OperationalFilter, number>>((counts, item) => {
    counts.all += 1

    if (item.type === 'approval') counts.approval += 1
    if (item.category === 'atlas_ai_recommendation') counts.recommendation += 1
    if (item.type === 'insight') counts.insight += 1
    if (item.type === 'proposal') counts.proposal += 1
    if (item.type === 'job_result' || item.type === 'job_status') counts.job += 1
    if (item.type === 'self_diagnostic') counts.self_diagnostic += 1
    if (item.type === 'alert') counts.alert += 1

    if (
      item.type !== 'approval' &&
      item.category !== 'atlas_ai_recommendation' &&
      item.type !== 'insight' &&
      item.type !== 'proposal' &&
      item.type !== 'job_result' &&
      item.type !== 'job_status' &&
      item.type !== 'self_diagnostic' &&
      item.type !== 'alert' &&
      item.type !== 'all' &&
      item.type in counts
    ) {
      counts[item.type as OperationalFilter] += 1
    }

    return counts
  }, {
    all: 0,
    approval: 0,
    recommendation: 0,
    insight: 0,
    proposal: 0,
    job: 0,
    self_diagnostic: 0,
    alert: 0,
  })
}

export function operationalFilterMatches(item: AtlasOperationalInboxItem, filter: OperationalFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'recommendation') return item.category === 'atlas_ai_recommendation'
  if (filter === 'job') return item.type === 'job_result' || item.type === 'job_status'
  return item.type === filter
}

export function mergeOperationalItems(
  current: AtlasOperationalInboxItem[],
  next: AtlasOperationalInboxItem[],
): AtlasOperationalInboxItem[] {
  const byId = new Map<string, AtlasOperationalInboxItem>()
  for (const item of current) byId.set(item.id, item)
  for (const item of next) byId.set(item.id, item)

  return Array.from(byId.values()).sort((a, b) => timestampForSort(b.created_at) - timestampForSort(a.created_at))
}

export function timestampForSort(value: string | null): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

export function operationalActionMessage(actionId: string, result: Record<string, unknown>): string {
  if (actionId === 'create_proposal' && typeof result.proposal_item_id === 'string') {
    return 'proposta criada no Inbox'
  }
  if (actionId === 'ignore_30d') return 'auto-diagnóstico ignorado por 30 dias'
  if (actionId === 'review_patch') return 'proposta marcada para revisão'
  if (actionId === 'view_trace') return 'trace marcado para revisão'
  if (actionId === 'mark_read') return 'marcado como lido'

  return 'ação aplicada'
}

export function operationalTabSubtitle(total: number, critical: number): string {
  if (critical > 0) return critical === 1 ? '1 crítico' : `${critical} críticos`
  return total === 1 ? '1 ativo' : `${total} ativos`
}

export function operationalActiveLabel(count: number): string {
  return count === 1 ? '1 ATIVO' : `${count} ATIVOS`
}

export function operationalCriticalLabel(count: number): string {
  return count === 1 ? '1 CRÍTICO' : `${count} CRÍTICOS`
}
