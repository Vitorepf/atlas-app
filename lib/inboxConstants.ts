import type { InboxFilter, OperationalFilter, TaskPriority } from './inboxTypes'

// 'no_destination' removido (2026-05) · era duplicata operacional de 'abertas'.
// abertas = visíveis sem destino resolvido. no_destination = isRawCapture flag.
// Toda captura aberta é também raw (não foi triada) → counts iguais sempre.
// Mantido o case no filterItem switch caso precise no futuro, só fora do strip visual.
export const FILTERS: Array<{ key: InboxFilter; label: string }> = [
  { key: 'open', label: 'abertas' },
  { key: 'candidate', label: 'candidatas' },
  { key: 'proposal', label: 'propostas' },
  { key: 'snoozed', label: 'adiadas' },
  { key: 'failed', label: 'falhas' },
  { key: 'pending', label: 'pendentes' },
  { key: 'routed', label: 'com destino' },
  { key: 'archived', label: 'arquivadas' },
]

export const TASK_PRIORITIES: Array<{ key: TaskPriority; label: string }> = [
  { key: 'low', label: 'baixa' },
  { key: 'normal', label: 'normal' },
  { key: 'high', label: 'alta' },
  { key: 'urgent', label: 'urgente' },
]

export const OPERATIONAL_FILTERS: Array<{ key: OperationalFilter; label: string }> = [
  { key: 'all', label: 'Tudo' },
  { key: 'approval', label: 'Aprovacoes' },
  { key: 'recommendation', label: 'Recomendacoes' },
  { key: 'insight', label: 'Insights' },
  { key: 'proposal', label: 'Propostas' },
  { key: 'job', label: 'Jobs' },
  { key: 'self_diagnostic', label: 'Auto-diagnostico' },
  { key: 'alert', label: 'Alertas' },
]

export const SNOOZE_CHOICES: Array<{ key: string; label: string; days: number; reason: string }> = [
  { key: 'tomorrow', label: 'amanhã', days: 1, reason: 'Adiada para revisão amanhã.' },
  { key: 'week', label: '7 dias', days: 7, reason: 'Adiada por uma semana.' },
  { key: 'month', label: '30 dias', days: 30, reason: 'Adiada por trinta dias.' },
]

export const ARCHIVE_HINT_STORAGE_KEY = 'atlas-inbox.archive-hint-shown'
export const OPERATIONAL_PAGE_SIZE = 25
export const OPERATIONAL_POLL_INTERVAL_MS = 90_000
export const OPERATIONAL_POLL_JITTER_MS = 4_000
