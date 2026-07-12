import { create } from 'zustand'
import {
  type AtlasCapture,
  type AtlasCheckin,
  type AtlasPassiveSignal,
  getAtlasAuthHeaders,
  getCaptureFileUrl,
} from './api/client'
import { DEFAULT_DOMAINS, domainLabel, type Domain } from './domains'
import type { InboxItem } from '../components/InboxCard'
import {
  LOCAL_ID_PREFIX,
  capturePrivacy,
  captureTriage,
  captureTriageHistory,
  mergeCheckins,
  mergePassiveSignals,
  passiveSignalMetricTime,
  queuedToCheckin,
  queuedToPassiveSignal,
  type CaptureTriageMetadata,
} from './storeConverters'
import { createBehaviorsSlice } from './store/behaviorsSlice'
import { createCapturesSlice } from './store/capturesSlice'
import { createCoreSlice } from './store/coreSlice'
import { createDomainsSlice } from './store/domainsSlice'
import { createHealthSlice } from './store/healthSlice'
import { createProductivitySlice } from './store/productivitySlice'
import { createSyncSlice } from './store/syncSlice'
import type {
  AtlasState,
  CreateAudioCaptureInput,
  CreatePhotoCaptureInput,
  CreateTextCaptureInput,
  LocalQueueCounts,
} from './store/types'

export { localDateKey } from './storeConverters'
export type {
  QueuedBehavior,
  QueuedBehaviorLog,
  QueuedCapture,
  QueuedCheckin,
  QueuedDigitalActivitySnapshot,
  QueuedDigitalSession,
  QueuedHealthSnapshot,
  QueuedPassiveSignal,
} from './storeConverters'
export {
  deviceTimezone,
  localQueueCounts,
  visibleBehaviorLogs,
  visibleBehaviors,
  visibleCaptures,
  visibleDigitalActivitySnapshots,
  visibleDigitalSessions,
  visibleHealthSnapshots,
  visiblePassiveSignals,
} from './store/internals'
export type {
  AtlasState,
  CreateAudioCaptureInput,
  CreatePhotoCaptureInput,
  CreateTextCaptureInput,
  LocalQueueCounts,
}

export const useAtlasStore = create<AtlasState>((set, get) => ({
  ...createCoreSlice(set, get),
  ...createDomainsSlice(set, get),
  ...createCapturesSlice(set, get),
  ...createBehaviorsSlice(set, get),
  ...createHealthSlice(set, get),
  ...createProductivitySlice(set, get),
  ...createSyncSlice(set, get),
}))

export function captureToInboxItem(capture: AtlasCapture, domains: Domain[] = DEFAULT_DOMAINS): InboxItem {
  const isLocal = capture.id.startsWith(LOCAL_ID_PREFIX)
  const hasFile = Boolean(capture.content_file_path)
  const status = captureReliabilityStatus(capture, isLocal)
  const triage = captureTriage(capture)
  const clarification = semanticClarification(capture)
  const noteLink = acceptedSemanticNoteLink(capture)
  const destinationLink = primaryDestinationLink(capture)
  const hasLinkedDestination = Boolean(noteLink || destinationLink)
  const expiredSnooze = isExpiredSnooze(triage.snoozed_until)
  const curationCandidate = isCurationCandidate(capture, triage, clarification, hasLinkedDestination)
  const privacy = capturePrivacy(capture.metadata)

  return {
    id: capture.id,
    clientId: capture.client_id,
    time: formatTime(capture.captured_at),
    date: formatDate(capture.captured_at),
    domain: capture.domain,
    domainLabel: domainLabel(capture.domain, domains),
    kind: capture.kind,
    text: captureText(capture),
    durationMs: capture.content_duration_ms,
    transcriptionStatus: capture.transcription_status,
    transcriptionError: capture.transcription_error,
    fileUrl: hasFile && capture.content_file_exists !== false ? (isLocal ? capture.content_file_path : getCaptureFileUrl(capture.id)) : null,
    fileHeaders: hasFile && !isLocal && capture.content_file_exists !== false ? getAtlasAuthHeaders() : null,
    fileExists: capture.content_file_exists,
    fileIntegrity: capture.content_file_integrity,
    tags: metadataTags(capture.metadata),
    capturedAt: capture.captured_at,
    createdAt: capture.created_at,
    updatedAt: capture.updated_at,
    capturedLat: capture.captured_lat,
    capturedLng: capture.captured_lng,
    preCaptureContext: capture.pre_capture_digital_context ?? null,
    isLocal,
    statusLabel: status.label,
    statusDetail: status.detail,
    statusTone: status.tone,
    triageStatus: triage.status,
    triageDestination: triage.destination,
    triageLabel: triageLabel(triage, curationCandidate, noteLink),
    triageUpdatedAt: triage.updated_at,
    triageReason: triage.reason,
    triageTitle: triage.title,
    snoozedUntil: triage.snoozed_until,
    linkedNoteTitle: triage.note_title ?? noteLink?.target_title ?? null,
    proposalId: triage.proposal_id,
    targetType: triage.target_type ?? destinationLink?.target_type ?? null,
    targetId: triage.target_id ?? destinationLink?.target_id ?? null,
    targetTitle: triage.target_title ?? destinationLink?.target_title ?? null,
    triageHistory: captureTriageHistory(capture),
    semanticClarification: clarification,
    sensitivity: privacy.sensitivity,
    privacyLabel: privacy.label,
    externalAiAllowed: privacy.externalAiAllowed,
    nextStepLabel: nextStepLabel(capture, triage, curationCandidate, destinationLink, noteLink),
    isArchived: triage.status === 'archived',
    isSnoozed: triage.status === 'snoozed' && !expiredSnooze,
    isRawCapture: (!triage.status || expiredSnooze) && !hasLinkedDestination,
    isCurationCandidate: curationCandidate,
    canRetryTranscription: !isLocal
      && capture.kind === 'audio'
      && capture.content_file_exists !== false
      && capture.transcription_status === 'failed',
  }
}

export function latestCheckin(state: Pick<AtlasState, 'checkins' | 'queuedCheckins'>): AtlasCheckin | null {
  const queued = state.queuedCheckins.map(queuedToCheckin)
  return mergeCheckins([...state.checkins, ...queued])[0] ?? null
}

export function latestPassiveSignal(
  state: Pick<AtlasState, 'passiveSignals' | 'queuedPassiveSignals'>,
  signalType: string,
): AtlasPassiveSignal | null {
  const queued = state.queuedPassiveSignals.map(queuedToPassiveSignal)
  return mergePassiveSignals([...state.passiveSignals, ...queued])
    .filter((signal) => signal.signal_type === signalType)
    .sort((a, b) => passiveSignalMetricTime(b, signalType) - passiveSignalMetricTime(a, signalType))[0] ?? null
}

export function formatPassiveSignal(signal: AtlasPassiveSignal | null, fallback = 'Sem dado'): string {
  if (!signal) return fallback
  if (signal.value_text?.trim()) return signal.value_text.trim()
  if (signal.value_numeric === null || signal.value_numeric === undefined) return fallback

  if (signal.signal_type === 'sleep_duration_hours') {
    const hours = Math.floor(signal.value_numeric)
    const minutes = Math.round((signal.value_numeric - hours) * 60)
    return `${hours}h${String(minutes).padStart(2, '0')}`
  }

  const value = Number.isInteger(signal.value_numeric)
    ? String(signal.value_numeric)
    : signal.value_numeric.toFixed(1)
  return `${value}${signal.unit ?? ''}`
}

export function formatRelativeSync(iso: string | null): string {
  if (!iso) return 'nunca'

  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 10) return 'agora'
  if (seconds < 60) return `há ${seconds}s`

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `há ${minutes}min`

  const hours = Math.round(minutes / 60)
  return `há ${hours}h`
}

function primaryDestinationLink(capture: AtlasCapture): NonNullable<AtlasCapture['links']>[number] | null {
  const links = Array.isArray(capture.links) ? capture.links : []
  if (links.length === 0) return null

  return [...links]
    .filter((link) => link.relation_type === 'triage_destination')
    .sort((a, b) =>
      dateValue(b.updated_at ?? b.created_at) - dateValue(a.updated_at ?? a.created_at)
      || dateValue(b.created_at) - dateValue(a.created_at),
    )[0] ?? null
}

function acceptedSemanticNoteLink(capture: AtlasCapture): NonNullable<AtlasCapture['links']>[number] | null {
  const links = Array.isArray(capture.links) ? capture.links : []

  return [...links]
    .filter((link) => (
      link.target_type === 'semantic_note'
      && (
        link.metadata?.action === 'curation_proposal_accepted'
        || link.metadata?.action === 'attach_note'
      )
    ))
    .sort((a, b) => dateValue(b.created_at) - dateValue(a.created_at))[0] ?? null
}

function dateValue(value?: string | null): number {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function semanticClarification(capture: AtlasCapture): InboxItem['semanticClarification'] {
  const clarification = capture.metadata?.semantic_clarification
  if (!clarification || typeof clarification !== 'object' || Array.isArray(clarification)) return null

  const record = clarification as Record<string, unknown>
  const result = record.result && typeof record.result === 'object' && !Array.isArray(record.result)
    ? record.result as Record<string, unknown>
    : {}
  const density = result.density && typeof result.density === 'object' && !Array.isArray(result.density)
    ? result.density as Record<string, unknown>
    : {}
  const destination = result.possible_destination && typeof result.possible_destination === 'object' && !Array.isArray(result.possible_destination)
    ? result.possible_destination as Record<string, unknown>
    : {}

  return {
    status: stringField(record.status),
    eventType: stringField(record.event_type),
    generatedAt: stringField(record.generated_at),
    agentSlug: stringField(record.agent_slug),
    source: stringField(record.source),
    mainThesis: stringField(result.main_thesis),
    atomicIdeas: stringListField(result.atomic_ideas),
    suggestedType: stringField(result.suggested_type),
    tensionOrQuestion: stringField(result.tension_or_question),
    density: {
      score: typeof density.score === 'number' ? density.score : Number.isFinite(Number(density.score)) ? Number(density.score) : null,
      label: stringField(density.label),
      drivers: stringListField(density.drivers),
    },
    possibleDestination: {
      kind: stringField(destination.kind),
      noteType: stringField(destination.note_type),
      title: stringField(destination.title),
      path: stringField(destination.path),
      reason: stringField(destination.reason),
    },
    authorshipQuestion: stringField(result.authorship_question),
    futureTriggers: stringListField(result.future_triggers),
  }
}

function isCurationCandidate(
  capture: AtlasCapture,
  triage: CaptureTriageMetadata,
  clarification: InboxItem['semanticClarification'],
  hasLinkedDestination = false,
): boolean {
  if (hasLinkedDestination) return false
  if (triage.status && !(triage.status === 'snoozed' && isExpiredSnooze(triage.snoozed_until))) return false
  if (capture.deleted_at) return false
  if (capture.id.startsWith(LOCAL_ID_PREFIX)) return false
  if (capture.kind === 'audio' && capture.transcription_status !== 'done') return false
  if (capture.content_file_path && capture.content_file_exists === false) return false

  const densityScore = clarification?.density?.score ?? 0
  if (densityScore >= 0.42) return true

  const text = capture.content_text?.trim() ?? ''
  if (text.length >= 80) return true

  const lower = text.toLowerCase()
  return [
    'preciso',
    'decidi',
    'ideia',
    'hipotese',
    'hipótese',
    'princípio',
    'principio',
    'testar',
    'projeto',
    'não posso esquecer',
    'nao posso esquecer',
  ].some((needle) => lower.includes(needle))
}

function isExpiredSnooze(value?: string | null): boolean {
  if (!value) return false
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) && timestamp <= Date.now()
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function stringListField(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function triageLabel(
  triage: CaptureTriageMetadata,
  curationCandidate: boolean,
  noteLink: NonNullable<AtlasCapture['links']>[number] | null,
): string {
  if (noteLink?.metadata?.action === 'curation_proposal_accepted') return 'Nota viva criada'
  if (triage.status === 'archived') return 'Arquivada'
  if (triage.status === 'snoozed') return isExpiredSnooze(triage.snoozed_until) ? 'Voltou para triagem' : 'Adiada'
  if (triage.knowledge_state === 'semantic_note_created') return 'Nota viva criada'
  if (triage.knowledge_state === 'proposal_pending') return 'Proposta pendente'
  if (triage.destination === 'semantic_note') return 'Proposta semântica'
  if (triage.destination === 'hypothesis') return 'Hipótese proposta'
  if (triage.destination === 'task') return 'Tarefa criada'
  if (triage.destination === 'project') return 'Projeto criado'
  if (triage.destination === 'existing_note') return 'Anexada à nota'
  if (curationCandidate) return 'Candidata à curadoria'
  return 'Captura bruta · sem destino'
}

function nextStepLabel(
  capture: AtlasCapture,
  triage: CaptureTriageMetadata,
  curationCandidate: boolean,
  destinationLink: NonNullable<AtlasCapture['links']>[number] | null,
  noteLink: NonNullable<AtlasCapture['links']>[number] | null,
): string | null {
  if (noteLink) {
    return noteLink.target_title ? `Nota viva: ${noteLink.target_title}` : 'Destino: nota viva'
  }

  if (triage.destination) {
    switch (triage.destination) {
      case 'semantic_note':
        if (triage.knowledge_state === 'proposal_pending' || triage.next_action === 'ratify_proposal') {
          return triage.target_title ? `Ratificar proposta: ${triage.target_title}` : 'Próximo: ratificar proposta na Memória'
        }
        if (triage.knowledge_state === 'semantic_note_created') {
          return triage.target_title ? `Nota viva: ${triage.target_title}` : 'Destino: nota viva'
        }
        return triage.target_title ? `Proposta: ${triage.target_title}` : 'Destino: proposta semântica'
      case 'hypothesis':
        return triage.target_title ? `Hipótese: ${triage.target_title}` : 'Destino: hipótese'
      case 'task':
        return triage.target_title ? `Tarefa: ${triage.target_title}` : 'Destino: tarefa'
      case 'project':
        return triage.active_next_task_title
          ? `Projeto: ${triage.target_title ?? 'sem título'} · próxima ação: ${triage.active_next_task_title}`
          : (triage.target_title ? `Projeto: ${triage.target_title}` : 'Destino: projeto')
      case 'existing_note':
        return triage.note_title ? `Nota: ${triage.note_title}` : 'Destino: nota anexada'
      case 'later':
        return isExpiredSnooze(triage.snoozed_until) ? 'Próximo: decidir destino' : 'Próximo: revisar depois'
      case 'archive':
        return 'Destino: arquivo'
      default:
        return `Destino: ${triage.destination}`
    }
  }

  if (destinationLink) {
    switch (destinationLink.target_type) {
      case 'task':
        return destinationLink.target_title ? `Tarefa: ${destinationLink.target_title}` : 'Destino: tarefa'
      case 'project':
        return destinationLink.target_title ? `Projeto: ${destinationLink.target_title}` : 'Destino: projeto'
      case 'semantic_curation_proposal':
        return destinationLink.target_title ? `Proposta: ${destinationLink.target_title}` : 'Destino: proposta semântica'
      case 'hypothesis':
        return destinationLink.target_title ? `Hipótese: ${destinationLink.target_title}` : 'Destino: hipótese'
      default:
        return destinationLink.target_title ?? null
    }
  }

  if (capture.kind === 'audio' && ['pending', 'processing'].includes(capture.transcription_status)) {
    return 'Aguardando transcrição'
  }
  if (capture.transcription_status === 'failed' || capture.content_file_exists === false) {
    return 'Próximo: corrigir falha'
  }
  if (curationCandidate) {
    return 'Próximo: promover'
  }

  return 'Próximo: decidir destino'
}

function captureReliabilityStatus(
  capture: AtlasCapture,
  isLocal: boolean,
): { label: string; detail: string; tone: NonNullable<InboxItem['statusTone']> } {
  if (isLocal) {
    const attempts = Number(capture.metadata?.local_attempts ?? 0)
    return {
      label: 'FILA',
      detail: attempts > 0 ? `Aguardando sync · ${attempts} tentativa(s)` : 'Aguardando sincronização local',
      tone: 'pending',
    }
  }

  if (capture.content_file_path && capture.content_file_exists === false) {
    return {
      label: 'ARQUIVO AUSENTE',
      detail: 'O banco aponta para um arquivo que não está no storage Atlas',
      tone: 'danger',
    }
  }

  if (capture.kind === 'audio') {
    switch (capture.transcription_status) {
      case 'pending':
        return { label: 'PENDENTE', detail: 'Áudio recebido; aguardando worker de transcrição', tone: 'pending' }
      case 'processing':
        return { label: 'TRANSCREVENDO', detail: 'Whisper está processando o áudio', tone: 'pending' }
      case 'failed':
        return {
          label: 'FALHOU',
          detail: capture.transcription_error || 'A transcrição falhou; o áudio original foi preservado',
          tone: 'danger',
        }
      case 'done':
        return { label: 'TRANSCRITA', detail: 'Texto pronto para triagem e curadoria', tone: 'ok' }
      case 'na':
        return { label: 'SEM TRANSCRIÇÃO', detail: 'Áudio marcado como não aplicável para transcrição', tone: 'muted' }
    }
  }

  if (capture.kind === 'photo' && capture.content_file_path) {
    return { label: 'IMAGEM SALVA', detail: 'Arquivo visual preservado no Atlas', tone: 'ok' }
  }

  return { label: 'SINCRONIZADA', detail: 'Captura salva no servidor Atlas', tone: 'ok' }
}

function captureText(capture: AtlasCapture): string {
  if (capture.content_file_path && capture.content_file_exists === false) {
    if (capture.content_text?.trim()) return capture.content_text.trim()
    return capture.kind === 'photo'
      ? 'Imagem registrada, mas arquivo original ausente no storage.'
      : 'Áudio registrado, mas arquivo original ausente no storage.'
  }

  if (capture.kind === 'text') return capture.content_text?.trim() || 'Texto sem conteúdo'
  if (capture.kind === 'photo') return capture.content_text?.trim() || 'Imagem capturada'

  if (capture.transcription_status === 'failed') {
    return 'Transcrição falhou. Áudio preservado.'
  }

  if (capture.content_text?.trim()) return capture.content_text.trim()

  if (capture.id.startsWith(LOCAL_ID_PREFIX)) {
    return 'Áudio aguardando sincronização…'
  }

  if (capture.transcription_status === 'done') {
    return 'Áudio sem transcrição.'
  }

  return 'Transcrição em andamento…'
}

function metadataTags(metadata: Record<string, unknown>): string[] {
  const tags = metadata.tags
  if (!Array.isArray(tags)) return []

  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 6)
}

function formatTime(iso: string): string {
  // canon mockup · "12.27" (ponto entre HH e MM, não dois pontos).
  // Vocabulário Atlas: mono caps com tabular-nums alinhados, ponto remete
  // a relógio editorial (Patek/Cucinelli) vs separador técnico SaaS.
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
  return formatted.replace(':', '.')
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}
