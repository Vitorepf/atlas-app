import type { InboxItem } from '../../InboxCard'
import type { AtlasSemanticNote } from '../../../lib/api/client'
import type { AtlasPalette } from '../../../design/tokens'

export type TriageAction =
  | 'promote'
  | 'archive'
  | 'snooze'
  | 'attach_note'
  | 'create_task'
  | 'create_project'
  | 'create_hypothesis'

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export const TASK_PRIORITIES: Array<{ key: TaskPriority; label: string }> = [
  { key: 'low', label: 'baixa' },
  { key: 'normal', label: 'normal' },
  { key: 'high', label: 'alta' },
  { key: 'urgent', label: 'urgente' },
]

// Variante editorial do contextDetail · sem coordenadas crus (eram dev-feel "5 decimais").
// As coords seguem na InboxItem · acessíveis no futuro via disclosure "ver origem completa".
export function contextDetailEditorial(item: InboxItem): string {
  const digital = digitalContextDetail(item.preCaptureContext)
  return [
    item.capturedAt ? formatDateTime(item.capturedAt) : 'sem data',
    digital,
  ].filter(Boolean).join(' · ')
}

export function taskPriorityLabel(priority: TaskPriority): string {
  return TASK_PRIORITIES.find((option) => option.key === priority)?.label ?? 'normal'
}

export function noteMatchesQuery(note: AtlasSemanticNote, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true

  return `${note.title} ${note.summary ?? ''} ${note.path}`.toLowerCase().includes(q)
}

export function formatDuration(durationMs?: number | null): string {
  if (!durationMs) return '0:00'
  const seconds = Math.max(0, Math.round(durationMs / 1000))
  return formatDurationSeconds(seconds)
}

export function formatDurationSeconds(secondsValue?: number | null): string {
  const seconds = Math.max(0, Math.round(secondsValue ?? 0))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function statusColor(status: InboxItem['statusTone'], c: AtlasPalette): string {
  switch (status) {
    case 'ok':
      return c.moss
    case 'danger':
      return c.recRed
    case 'pending':
      return c.bronze
    case 'muted':
    default:
      return c.ink2
  }
}

// "qua, 06.05" · abreviação PT-BR de 3 letras + DD.MM
const PT_DAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export function snoozeDateLabel(days: number): string {
  const target = new Date()
  target.setDate(target.getDate() + days)
  const dow = PT_DAYS[target.getDay()]
  const dd = String(target.getDate()).padStart(2, '0')
  const mm = String(target.getMonth() + 1).padStart(2, '0')
  return `${dow}, ${dd}.${mm}`
}

export function triageSuccessMessage(action: TriageAction, createdProposal: boolean): string {
  switch (action) {
    case 'promote':
      return createdProposal ? 'Proposta criada' : 'Captura marcada para promoção'
    case 'archive':
      return 'Captura arquivada'
    case 'snooze':
      return 'Captura adiada'
    case 'attach_note':
      return 'Captura anexada à nota'
    case 'create_task':
      return 'Tarefa criada'
    case 'create_project':
      return 'Projeto criado'
    case 'create_hypothesis':
      return createdProposal ? 'Hipótese proposta' : 'Captura marcada como hipótese'
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

export function destinationRouteFor(item: InboxItem): '/' | '/memory' | '/projects' | null {
  switch (item.triageDestination ?? item.targetType) {
    case 'task':
      return '/'
    case 'project':
      return '/projects'
    case 'semantic_note':
    case 'existing_note':
    case 'semantic_curation_proposal':
    case 'hypothesis':
      return '/memory'
    default:
      return null
  }
}

export function destinationActionLabel(item: InboxItem): string {
  switch (item.triageDestination ?? item.targetType) {
    case 'task':
      return 'Abrir agenda'
    case 'project':
      return 'Abrir projetos'
    case 'semantic_note':
    case 'existing_note':
    case 'semantic_curation_proposal':
    case 'hypothesis':
      return 'Abrir memória'
    default:
      return 'Abrir destino'
  }
}

export function canPromote(item: InboxItem): boolean {
  if (item.transcriptionStatus === 'failed' || item.fileIntegrity === 'missing') return false
  if (item.transcriptionStatus === 'pending' || item.transcriptionStatus === 'processing') return false
  return item.text.trim().length > 0
}

export function defaultActionTitle(item: InboxItem): string {
  return item.text.replace(/\s+/g, ' ').trim().slice(0, 72)
}

export function daysFromNow(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

export function kindDetail(item: InboxItem): string {
  if (item.kind === 'audio') return `Áudio · ${item.transcriptionStatus ?? 'sem status'}`
  if (item.kind === 'photo') return 'Imagem'
  return 'Texto'
}

export function fileDetail(item: InboxItem): string {
  if (!item.fileIntegrity || item.fileIntegrity === 'not_applicable') return 'Sem arquivo original'
  if (item.fileIntegrity === 'missing') return 'Arquivo original ausente'
  return item.fileExists === false ? 'Arquivo original ausente' : 'Arquivo original disponível'
}

// Label curto pra meta line · "áudio / imagem / texto"
export function kindShortLabel(kind: NonNullable<InboxItem['kind']>): string {
  switch (kind) {
    case 'audio': return 'áudio'
    case 'photo': return 'imagem'
    case 'text': return 'texto'
  }
}

export function privacyDetail(item: InboxItem): string {
  const label = item.privacyLabel ? item.privacyLabel.toLowerCase() : 'normal'
  const externalAi = item.externalAiAllowed === null || item.externalAiAllowed === undefined
    ? 'IA externa indefinida'
    : item.externalAiAllowed
      ? 'IA externa permitida'
      : 'IA externa bloqueada'

  return `${label} · ${externalAi}`
}

export function historyDetail(item: InboxItem): string {
  if (item.triageUpdatedAt) {
    const destination = item.triageLabel ?? item.triageDestination ?? 'triagem'
    return `Última triagem: ${destination} · ${formatDateTime(item.triageUpdatedAt)}`
  }
  return item.updatedAt ? `Atualizada ${formatDateTime(item.updatedAt)}` : 'Sem histórico de triagem'
}

export function digitalContextDetail(context?: Record<string, unknown> | null): string | null {
  if (!context || Object.keys(context).length === 0) return null

  const preferredKeys = [
    'source_name',
    'source',
    'source_kind',
    'url_domain',
    'project_name',
    'task_name',
    'focus_mode_active',
  ]
  const entries = preferredKeys
    .filter((key) => context[key] !== undefined && context[key] !== null && context[key] !== '')
    .slice(0, 3)

  const keys = entries.length > 0 ? entries : Object.keys(context).slice(0, 3)
  if (keys.length === 0) return null

  return keys
    .map((key) => `${humanContextKey(key)}: ${formatContextValue(context[key])}`)
    .join(' · ')
}

export function humanContextKey(key: string): string {
  switch (key) {
    case 'source_name':
      return 'fonte'
    case 'source':
      return 'origem'
    case 'source_kind':
      return 'tipo'
    case 'url_domain':
      return 'domínio'
    case 'project_name':
      return 'projeto'
    case 'task_name':
      return 'tarefa'
    case 'focus_mode_active':
      return 'foco'
    default:
      return key.replace(/_/g, ' ')
  }
}

export function formatContextValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'sim' : 'não'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value.length > 42 ? `${value.slice(0, 39)}...` : value
  if (Array.isArray(value)) return `${value.length} item(ns)`
  if (value && typeof value === 'object') return 'objeto'
  return 'indefinido'
}

export function historyEventTitle(event: NonNullable<InboxItem['triageHistory']>[number]): string {
  const action = actionLabel(event.action)
  const destination = destinationLabel(event.destination)
  return destination ? `${action} · ${destination}` : action
}

export function historyEventMeta(event: NonNullable<InboxItem['triageHistory']>[number]): string {
  const pieces = [
    event.at ? formatDateTime(event.at) : null,
    event.changed_destination && event.previous_destination
      ? `antes: ${destinationLabel(event.previous_destination) ?? event.previous_destination}`
      : null,
    event.reason ?? null,
  ].filter(Boolean)

  return pieces.length > 0 ? pieces.join(' · ') : 'Evento de triagem'
}

export function actionLabel(action?: string | null): string {
  switch (action) {
    case 'promote':
      return 'Promoveu'
    case 'archive':
      return 'Arquivou'
    case 'snooze':
      return 'Adiou'
    case 'attach_note':
      return 'Anexou a nota'
    case 'create_task':
      return 'Criou tarefa'
    case 'create_project':
      return 'Criou projeto'
    case 'create_hypothesis':
      return 'Criou hipótese'
    default:
      return 'Triagem'
  }
}

export function destinationLabel(destination?: string | null): string | null {
  switch (destination) {
    case 'archive':
      return 'arquivo'
    case 'later':
      return 'adiada'
    case 'existing_note':
      return 'nota existente'
    case 'task':
      return 'tarefa'
    case 'project':
      return 'projeto'
    case 'hypothesis':
      return 'hipótese'
    case 'semantic_note':
      return 'nota viva'
    default:
      return null
  }
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
