import assert from 'node:assert/strict'
import type { InboxItem } from '../components/InboxCard'
import {
  compactTitle,
  countItemsByFilter,
  countItemsForFilter,
  dateLabel,
  filterInboxItems,
  filterItem,
  groupByDate,
  inboxMetrics,
  isNavigableDestination,
  isOpenInboxItem,
  nextSort,
  sortItems,
} from '../lib/inboxCaptureModels'
import {
  defaultProjectPlanDraft,
  draftFromProposal,
  minutesFromDraft,
  normalizeTaskPriority,
  quickActionMessage,
  taskPriorityLabel,
  triageInputFor,
} from '../lib/inboxActionModels'
import {
  countOperationalItems,
  isActiveOperationalItem,
  mergeOperationalItems,
  operationalActionMessage,
  operationalFilterMatches,
  threadIdFromActionResult,
} from '../lib/inboxOperationalModels'
import type {
  AtlasOperationalInboxItem,
  AtlasProjectPlanProposal,
} from '../lib/api/client'

function inboxItem(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: 'capture-1',
    time: '09:00',
    domain: 'general',
    text: 'Comprar cafe e revisar notas',
    capturedAt: '2026-05-10T12:00:00.000Z',
    transcriptionStatus: 'done',
    ...overrides,
  }
}

function operationalItem(overrides: Partial<AtlasOperationalInboxItem> = {}): AtlasOperationalInboxItem {
  return {
    id: 'op-1',
    user_id: 'user-1',
    type: 'approval',
    category: 'atlas_ai_recommendation',
    status: 'unread',
    severity: 'info',
    title: 'Aprovar proposta',
    summary: 'Resumo operacional',
    body: 'Corpo',
    source_type: 'atlas',
    source_id: null,
    initiator: 'atlas',
    context_bundle_id: null,
    dedupe_key: null,
    available_actions: [],
    response: null,
    payload: {},
    deep_link: null,
    push_policy: {},
    priority_score: 0,
    confidence_score: null,
    created_at: '2026-05-10T12:00:00.000Z',
    updated_at: '2026-05-10T12:00:00.000Z',
    expires_at: null,
    snoozed_until: null,
    read_at: null,
    resolved_at: null,
    dismissed_at: null,
    ...overrides,
  }
}

{
  const routed = inboxItem({ targetType: 'task', targetId: 'task-1' })
  const archived = inboxItem({ isArchived: true })
  const failed = inboxItem({ transcriptionStatus: 'failed' })
  const proposal = inboxItem({ targetType: 'semantic_curation_proposal' })
  const pending = inboxItem({ transcriptionStatus: 'processing' })
  const visible = [routed, failed, proposal, pending].filter(isOpenInboxItem)

  assert.equal(isOpenInboxItem(routed), false)
  assert.equal(isOpenInboxItem(archived), false)
  assert.equal(filterItem(failed, 'failed'), true)
  assert.equal(filterItem(proposal, 'proposal'), true)
  assert.equal(filterItem(pending, 'pending'), true)
  assert.equal(countItemsForFilter([routed, archived, failed, proposal, pending], visible, 'archived'), 1)
  assert.equal(countItemsByFilter([routed, archived, failed, proposal, pending], visible).archived, 1)
  assert.deepEqual(
    filterInboxItems({
      domainFilter: 'all',
      filter: 'failed',
      items: [routed, archived, failed, proposal, pending],
      query: 'comprar',
      visibleItems: visible,
    }).map((item) => item.id),
    [failed.id],
  )
  assert.equal(isNavigableDestination(routed), true)
}

{
  const older = inboxItem({ id: 'older', capturedAt: '2026-05-08T12:00:00.000Z', isRawCapture: true })
  const newer = inboxItem({ id: 'newer', capturedAt: '2026-05-10T12:00:00.000Z' })
  const failed = inboxItem({ id: 'failed', capturedAt: '2026-05-09T12:00:00.000Z', transcriptionStatus: 'failed' })

  assert.deepEqual(sortItems([older, newer], 'recent').map((item) => item.id), ['newer', 'older'])
  assert.deepEqual(sortItems([older, newer], 'oldest').map((item) => item.id), ['older', 'newer'])
  assert.equal(sortItems([older, newer, failed], 'needs_triage')[0].id, 'failed')
  assert.equal(nextSort('recent'), 'needs_triage')
  assert.equal(nextSort('needs_triage'), 'oldest')
  assert.equal(nextSort('oldest'), 'recent')
}

{
  const groups = groupByDate([
    inboxItem({ id: 'dated', capturedAt: '2026-05-10T12:00:00.000Z' }),
    inboxItem({ id: 'undated', capturedAt: undefined }),
  ])
  assert.equal(groups.some((group) => group.key === 'undated'), true)
  assert.equal(dateLabel(new Date()), 'hoje')

  const metrics = inboxMetrics([
    inboxItem({ id: 'ok', capturedAt: new Date(Date.now() - 3_600_000).toISOString(), time: '08:00' }),
    inboxItem({ id: 'failed', transcriptionStatus: 'failed', capturedAt: new Date(Date.now() - 7_200_000).toISOString() }),
  ])
  assert.equal(metrics.open, 2)
  assert.equal(metrics.failed, 1)
}

{
  const item = inboxItem({ text: '  Um titulo muito longo '.repeat(20) })
  assert.equal(compactTitle(item).length <= 120, true)
  assert.equal(triageInputFor(item, 'create_task').priority, 'normal')
  assert.equal(quickActionMessage('archive'), 'captura arquivada')
  assert.deepEqual(defaultProjectPlanDraft(), {
    title: '',
    nextAction: '',
    priority: 'normal',
    estimatedMinutes: '25',
  })
  assert.equal(normalizeTaskPriority('urgent'), 'urgent')
  assert.equal(normalizeTaskPriority('weird'), 'normal')
  assert.equal(taskPriorityLabel('high'), 'alta')
  assert.equal(minutesFromDraft('900', 25), 480)
  assert.equal(minutesFromDraft('x', 25), 25)
}

{
  const proposal: AtlasProjectPlanProposal = {
    id: 'proposal-1',
    project_id: null,
    source_capture_id: 'capture-1',
    status: 'draft',
    proposed_title: 'Projeto novo',
    planner_version: 'test',
    input_hash: 'hash',
    project_type: 'general',
    avoidance_profile: 'none',
    desired_outcome: 'Resultado',
    definition_of_done: 'Feito',
    minimum_useful_result: 'MUR',
    first_milestone: null,
    first_next_action: 'Abrir plano',
    estimated_energy: 'medium',
    priority_suggestion: 'high',
    estimated_duration_minutes: 45,
    confidence: 0.9,
    phases: [],
    steps: [],
    risks: [],
    questions: [],
    rationale: 'Faz sentido',
    metadata: {},
    accepted_at: null,
    rejected_at: null,
    project: null,
    source_capture: null,
    created_at: '2026-05-10T12:00:00.000Z',
    updated_at: '2026-05-10T12:00:00.000Z',
  }
  assert.deepEqual(draftFromProposal(proposal), {
    title: 'Projeto novo',
    nextAction: 'Abrir plano',
    priority: 'high',
    estimatedMinutes: '45',
  })
}

{
  const active = operationalItem({ id: 'active', status: 'unread' })
  const dismissed = operationalItem({ id: 'dismissed', status: 'dismissed' })
  const snoozedPast = operationalItem({
    id: 'snoozed-past',
    status: 'snoozed',
    snoozed_until: '2026-01-01T00:00:00.000Z',
  })
  const updated = operationalItem({ id: 'active', created_at: '2026-05-11T12:00:00.000Z', title: 'Atualizado' })

  assert.equal(isActiveOperationalItem(active), true)
  assert.equal(isActiveOperationalItem(dismissed), false)
  assert.equal(isActiveOperationalItem(snoozedPast), true)
  assert.equal(operationalFilterMatches(active, 'approval'), true)
  assert.equal(operationalFilterMatches(active, 'recommendation'), true)
  const operationalCounts = countOperationalItems([active, dismissed])
  assert.equal(operationalCounts.all, 2)
  assert.equal(operationalCounts.approval, 2)
  assert.equal(operationalCounts.recommendation, 2)
  assert.equal(mergeOperationalItems([active], [updated])[0].title, 'Atualizado')
  assert.equal(threadIdFromActionResult({ deep_link: 'atlas://thread/thread-123' }), 'thread-123')
  assert.equal(operationalActionMessage('mark_read', {}), 'marcado como lido')
}

console.info('inbox model tests passed')
