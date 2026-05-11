import type { AtlasProjectPlanProposal, CaptureTriageInput } from './api/client'
import type { InboxItem } from '../components/InboxCard'
import { TASK_PRIORITIES } from './inboxConstants'
import type { ProjectPlanDraft, QuickAction, TaskPriority } from './inboxTypes'
import { compactTitle } from './inboxCaptureModels'

export function triageInputFor(
  item: InboxItem,
  action: QuickAction,
  overrides: Partial<CaptureTriageInput> = {},
): CaptureTriageInput {
  let base: CaptureTriageInput
  switch (action) {
    case 'promote':
      base = { action, title: compactTitle(item), reason: 'Promovida pelo Inbox.' }
      break
    case 'create_task':
      base = { action, title: compactTitle(item), priority: 'normal', reason: 'Tarefa criada pelo Inbox.' }
      break
    case 'create_project':
      base = { action, title: compactTitle(item), reason: 'Projeto criado pelo Inbox.' }
      break
    case 'snooze':
      base = { action, snoozed_until: tomorrowIso(), reason: 'Adiada pelo Inbox.' }
      break
    case 'archive':
      base = { action, reason: 'Arquivada pelo Inbox.' }
      break
  }

  return { ...base, ...overrides }
}

export function quickActionMessage(action: QuickAction): string {
  switch (action) {
    case 'promote':        return 'proposta criada'
    case 'create_task':    return 'tarefa criada'
    case 'create_project': return 'projeto criado'
    case 'snooze':         return 'captura adiada'
    case 'archive':        return 'captura arquivada'
  }
}

export function tomorrowIso(): string {
  return daysFromNowIso(1)
}

export function daysFromNowIso(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export function taskPriorityLabel(priority: TaskPriority): string {
  return TASK_PRIORITIES.find((option) => option.key === priority)?.label ?? 'normal'
}

export function defaultProjectPlanDraft(): ProjectPlanDraft {
  return {
    title: '',
    nextAction: '',
    priority: 'normal',
    estimatedMinutes: '25',
  }
}

export function draftFromProposal(proposal: AtlasProjectPlanProposal): ProjectPlanDraft {
  return {
    title: proposal.proposed_title,
    nextAction: proposal.first_next_action,
    priority: normalizeTaskPriority(proposal.priority_suggestion),
    estimatedMinutes: String(proposal.estimated_duration_minutes || 25),
  }
}

export function normalizeTaskPriority(value: string | null | undefined): TaskPriority {
  return value === 'low' || value === 'high' || value === 'urgent' ? value : 'normal'
}

export function minutesFromDraft(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback || 25
  return Math.max(5, Math.min(480, parsed))
}
