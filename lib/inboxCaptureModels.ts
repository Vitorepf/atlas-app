import type { InboxItem } from '../components/InboxCard'
import type { InboxFilter, InboxSort } from './inboxTypes'

// Vocabulário editorial canon do timeline-label (mockup .va-canon .timeline-label):
// só "hoje" e "ontem" são palavra — a partir de antes-de-ontem já vira data por extenso
// ("9 de maio", "9 de maio de 2025"). Numeral romano canon é reservado pra capítulos
// (i. ii.) e vol do folio — proibido como mês.
const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const SEARCH_TEXT_CACHE = new WeakMap<InboxItem, string>()

export interface InboxMetrics {
  open: number
  averageAgeLabel: string
  firstTimeLabel: string | null
  failed: number
}

export interface DateGroup {
  key: string
  label: string
  items: InboxItem[]
}

export function isVisibleInboxItem(item: InboxItem): boolean {
  if (item.isArchived) return false
  if (!item.snoozedUntil) return true
  const snoozedUntil = new Date(item.snoozedUntil).getTime()
  return Number.isFinite(snoozedUntil) ? snoozedUntil <= Date.now() : true
}

export function isOpenInboxItem(item: InboxItem): boolean {
  return isVisibleInboxItem(item) && !hasResolvedDestination(item)
}

export function countItemsForFilter(
  items: InboxItem[],
  visibleItems: InboxItem[],
  filter: InboxFilter,
): number {
  const baseItems = filter === 'snoozed' || filter === 'proposal' || filter === 'archived' ? items : visibleItems
  return baseItems.filter((item) => filterItem(item, filter)).length
}

export function countItemsByFilter(
  items: InboxItem[],
  visibleItems: InboxItem[],
): Record<InboxFilter, number> {
  const counts = emptyFilterCounts()

  for (const item of items) {
    if (item.isArchived) counts.archived += 1
    if (item.isSnoozed) counts.snoozed += 1
    if (isProposalItem(item)) counts.proposal += 1
  }

  for (const item of visibleItems) {
    if (isOpenInboxItem(item)) counts.open += 1
    if (item.isRawCapture) counts.no_destination += 1
    if (item.isCurationCandidate) counts.candidate += 1
    if (hasResolvedDestination(item)) counts.routed += 1
    if (item.transcriptionStatus === 'failed' || item.fileIntegrity === 'missing') counts.failed += 1
    if (
      item.isLocal ||
      item.transcriptionStatus === 'pending' ||
      item.transcriptionStatus === 'processing'
    ) {
      counts.pending += 1
    }
  }

  return counts
}

export function filterInboxItems({
  domainFilter,
  filter,
  items,
  query,
  visibleItems,
}: {
  domainFilter: string
  filter: InboxFilter
  items: InboxItem[]
  query: string
  visibleItems: InboxItem[]
}): InboxItem[] {
  const baseItems = filter === 'snoozed' || filter === 'proposal' || filter === 'archived' ? items : visibleItems
  const normalizedQuery = query.trim().toLowerCase()
  const next: InboxItem[] = []

  for (const item of baseItems) {
    if (domainFilter !== 'all' && item.domain !== domainFilter) continue
    if (normalizedQuery && !matchesNormalizedQuery(item, normalizedQuery)) continue
    if (!filterItem(item, filter)) continue
    next.push(item)
  }

  return next
}

function emptyFilterCounts(): Record<InboxFilter, number> {
  return {
    open: 0,
    candidate: 0,
    proposal: 0,
    no_destination: 0,
    snoozed: 0,
    routed: 0,
    failed: 0,
    pending: 0,
    archived: 0,
  }
}

export function filterItem(item: InboxItem, filter: InboxFilter): boolean {
  switch (filter) {
    case 'pending':
      return Boolean(
        item.isLocal ||
          item.transcriptionStatus === 'pending' ||
          item.transcriptionStatus === 'processing',
      )
    case 'no_destination':
      return Boolean(item.isRawCapture)
    case 'candidate':
      return Boolean(item.isCurationCandidate)
    case 'snoozed':
      return Boolean(item.isSnoozed)
    case 'proposal':
      return isProposalItem(item)
    case 'routed':
      return hasResolvedDestination(item)
    case 'failed':
      return Boolean(item.transcriptionStatus === 'failed' || item.fileIntegrity === 'missing')
    case 'archived':
      return Boolean(item.isArchived)
    case 'open':
    default:
      return isOpenInboxItem(item)
  }
}

export function hasResolvedDestination(item: InboxItem): boolean {
  const destination = item.triageDestination
  if (destination && [
    'semantic_note',
    'existing_note',
    'task',
    'project',
    'hypothesis',
  ].includes(destination)) {
    return true
  }

  return Boolean(item.targetType && [
    'semantic_note',
    'semantic_curation_proposal',
    'task',
    'project',
    'hypothesis',
  ].includes(item.targetType))
}

export function isProposalItem(item: InboxItem): boolean {
  return Boolean(
    item.triageDestination === 'semantic_note' ||
      item.triageDestination === 'hypothesis' ||
      item.targetType === 'semantic_curation_proposal' ||
      item.targetType === 'hypothesis',
  )
}

export function isNavigableDestination(item: InboxItem): boolean {
  return Boolean(
    item.targetId &&
      ['project', 'task'].includes(String(item.targetType ?? item.triageDestination ?? '')),
  )
}

export function matchesQuery(item: InboxItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return matchesNormalizedQuery(item, q)
}

function matchesNormalizedQuery(item: InboxItem, q: string): boolean {
  return searchTextForItem(item).includes(q)
}

function searchTextForItem(item: InboxItem): string {
  const cached = SEARCH_TEXT_CACHE.get(item)
  if (cached) return cached

  const searchText = [
    item.text,
    item.domain,
    item.domainLabel,
    item.statusLabel,
    item.statusDetail,
    item.triageLabel,
    item.nextStepLabel,
    item.targetTitle,
    item.linkedNoteTitle,
  ].filter(Boolean).join(' ').toLowerCase()
  SEARCH_TEXT_CACHE.set(item, searchText)
  return searchText
}

export function sortItems(items: InboxItem[], sort: InboxSort): InboxItem[] {
  const indexed = items.map((item) => ({
    item,
    timestamp: dateValue(item.capturedAt),
    priority: sort === 'needs_triage' ? triagePriority(item) : 0,
  }))

  switch (sort) {
    case 'oldest':
      return indexed.sort((a, b) => a.timestamp - b.timestamp).map((entry) => entry.item)
    case 'needs_triage':
      return indexed.sort((a, b) => b.priority - a.priority || a.timestamp - b.timestamp).map((entry) => entry.item)
    case 'recent':
    default:
      return indexed.sort((a, b) => b.timestamp - a.timestamp).map((entry) => entry.item)
  }
}

export function triagePriority(item: InboxItem): number {
  if (item.transcriptionStatus === 'failed' || item.fileIntegrity === 'missing') return 4
  if (item.isCurationCandidate) return 3
  if (item.isRawCapture) return 2
  if (item.transcriptionStatus === 'pending' || item.transcriptionStatus === 'processing') return 1
  return 0
}

export function dateValue(value?: string | null): number {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function nextSort(sort: InboxSort): InboxSort {
  if (sort === 'recent') return 'needs_triage'
  if (sort === 'needs_triage') return 'oldest'
  return 'recent'
}

export function compactTitle(item: InboxItem): string {
  return item.text.replace(/\s+/g, ' ').trim().slice(0, 120) || 'Captura sem texto'
}

export function sortLabel(sort: InboxSort): string {
  switch (sort) {
    case 'oldest':       return 'antigas'
    case 'needs_triage': return 'prioridade'
    case 'recent':
    default:             return 'recentes'
  }
}

export function inboxMetrics(items: InboxItem[]): InboxMetrics {
  const now = Date.now()
  let ageCount = 0
  let ageTotal = 0
  let failed = 0
  let firstTimestamp = Number.POSITIVE_INFINITY
  let firstTimeLabel: string | null = null

  for (const item of items) {
    if (item.transcriptionStatus === 'failed' || item.fileIntegrity === 'missing') {
      failed += 1
    }

    if (!item.capturedAt) continue
    const timestamp = new Date(item.capturedAt).getTime()
    if (!Number.isFinite(timestamp)) continue

    const age = now - timestamp
    if (age >= 0) {
      ageTotal += age
      ageCount += 1
    }
    if (timestamp < firstTimestamp) {
      firstTimestamp = timestamp
      firstTimeLabel = item.time
    }
  }

  const averageAgeMs = ageCount ? ageTotal / ageCount : 0

  return {
    open: items.length,
    averageAgeLabel: formatAge(averageAgeMs),
    firstTimeLabel,
    failed,
  }
}

export function formatAge(ms: number): string {
  if (!ms) return '0h'
  const hours = Math.max(1, Math.round(ms / (1000 * 60 * 60)))
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}

export function openLabel(count: number): string {
  return count === 1 ? '1 ABERTA' : `${count} ABERTAS`
}

export function captureCountLabel(count: number): string {
  return count === 1 ? '1 aberta' : `${count} abertas`
}

export function failureLabel(count: number): string {
  return count === 1 ? '1 FALHA' : `${count} FALHAS`
}

export function groupByDate(items: InboxItem[]): DateGroup[] {
  const map = new Map<number, DateGroup>()
  const undated: InboxItem[] = []
  for (const item of items) {
    const date = item.capturedAt ? new Date(item.capturedAt) : null
    if (!date || Number.isNaN(date.getTime())) {
      undated.push(item)
      continue
    }
    const ts = startOfDayTimestamp(date)
    if (!map.has(ts)) {
      map.set(ts, { key: String(ts), label: dateLabel(date), items: [] })
    }
    map.get(ts)!.items.push(item)
  }
  const groups = Array.from(map.values())
  if (undated.length > 0) {
    groups.push({ key: 'undated', label: 'sem data', items: undated })
  }
  return groups
}

export function startOfDayTimestamp(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function dateLabel(date: Date): string {
  const now = new Date()
  const today = startOfDayTimestamp(now)
  const target = startOfDayTimestamp(date)
  const oneDay = 24 * 60 * 60 * 1000
  if (target === today) return 'hoje'
  if (target === today - oneDay) return 'ontem'
  const day = date.getDate()
  const month = MONTHS_PT[date.getMonth()]
  return date.getFullYear() === now.getFullYear()
    ? `${day} de ${month}`
    : `${day} de ${month} de ${date.getFullYear()}`
}
