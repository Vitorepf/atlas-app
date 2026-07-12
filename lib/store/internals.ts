// Store internals: module-private helpers shared by the store slices and by
// persistence.ts. Extracted verbatim from lib/atlasStore.ts (create() slice
// split, runbook R10). No behavior changes. This file must NOT import
// ../atlasStore or ./persistence at runtime (would cycle with the slices).
import Constants from 'expo-constants'
import * as FileSystem from 'expo-file-system/legacy'
import { Platform } from 'react-native'
import { atlasStorage } from '../storage'
import {
  type AtlasBehavior,
  type AtlasBehaviorLog,
  type AtlasCapture,
  type AtlasDigitalActivitySnapshot,
  type AtlasDigitalSession,
  type AtlasHealthSnapshot,
  type AtlasPassiveSignal,
  type StoreBehaviorInput,
  type StoreDigitalActivitySnapshotInput,
  type StoreDigitalSessionInput,
  type StoreHealthSnapshotInput,
  type StorePassiveSignalInput,
  createTextCapture,
  uploadCaptureFile,
} from '../api/client'
import { isMainSleepCandidate } from '../sleepValidity'
import { canonicalBehaviorCategory } from '../bitaculaFactors'
import {
  mergeBehaviorLogs,
  mergeBehaviors,
  mergeCaptures,
  mergeDigitalActivitySnapshots,
  mergeDigitalSessions,
  mergeHealthSnapshots,
  mergePassiveSignals,
  numberOrNull,
  queuedToBehavior,
  queuedToBehaviorLog,
  queuedToCapture,
  queuedToDigitalActivitySnapshot,
  queuedToDigitalSession,
  queuedToHealthSnapshot,
  queuedToPassiveSignal,
  recordOrNull,
  sanitizeQueuedHealthSnapshotSleep,
  slugify,
  stringOrNull,
  type QueuedBehavior,
  type QueuedCapture,
  type QueuedDigitalActivitySnapshot,
  type QueuedDigitalSession,
  type QueuedHealthSnapshot,
} from '../storeConverters'
import type { AtlasState, LocalQueueCounts, LocalQueueLike } from './types'

export const HEALTH_DATA_REPAIR_VERSION_KEY = 'atlas.health.dataRepairVersion'
export const HEALTH_DATA_REPAIR_VERSION = '2026-04-30.sleep-operational-v4'
export const LOCAL_AUDIO_DIR = `${FileSystem.documentDirectory ?? ''}atlas/audio/`
export const LOCAL_PHOTO_DIR = `${FileSystem.documentDirectory ?? ''}atlas/photos/`
export const CHECKIN_SYNC_BATCH_SIZE = 100
export const BEHAVIOR_SYNC_BATCH_SIZE = 100
export const BEHAVIOR_LOG_SYNC_BATCH_SIZE = 200
export const DEFAULT_BEHAVIOR_PRIORITY_SCORE = 50
export const PASSIVE_SIGNAL_SYNC_BATCH_SIZE = 250
export const HEALTH_SNAPSHOT_SYNC_BATCH_SIZE = 90
export const HEALTH_SNAPSHOT_BACKFILL_DAYS = 60
export const HEALTH_SNAPSHOT_REFRESH_DAYS = 3
export const DIGITAL_SESSION_SYNC_BATCH_SIZE = 250
export const DIGITAL_SNAPSHOT_SYNC_BATCH_SIZE = 90

export function visibleCaptures(state: Pick<AtlasState, 'captures' | 'queuedCaptures'>): AtlasCapture[] {
  return mergeCaptures([
    ...state.captures,
    ...state.queuedCaptures.map(queuedToCapture),
  ])
}

export function visiblePassiveSignals(state: Pick<AtlasState, 'passiveSignals' | 'queuedPassiveSignals'>): AtlasPassiveSignal[] {
  return mergePassiveSignals([
    ...state.passiveSignals,
    ...state.queuedPassiveSignals.map(queuedToPassiveSignal),
  ])
}

export function visibleHealthSnapshots(state: Pick<AtlasState, 'healthSnapshots' | 'queuedHealthSnapshots'>): AtlasHealthSnapshot[] {
  return mergeHealthSnapshots([
    ...state.healthSnapshots,
    ...state.queuedHealthSnapshots.map(queuedToHealthSnapshot),
  ])
}

export function visibleDigitalSessions(
  state: Pick<AtlasState, 'digitalSessions' | 'queuedDigitalSessions'>,
): AtlasDigitalSession[] {
  return mergeDigitalSessions([
    ...state.digitalSessions,
    ...state.queuedDigitalSessions.map(queuedToDigitalSession),
  ])
}

export function visibleDigitalActivitySnapshots(
  state: Pick<AtlasState, 'digitalActivitySnapshots' | 'queuedDigitalActivitySnapshots'>,
): AtlasDigitalActivitySnapshot[] {
  return mergeDigitalActivitySnapshots([
    ...state.digitalActivitySnapshots,
    ...state.queuedDigitalActivitySnapshots.map(queuedToDigitalActivitySnapshot),
  ])
}

export function visibleBehaviors(state: Pick<AtlasState, 'behaviors' | 'queuedBehaviors'>): AtlasBehavior[] {
  return mergeBehaviors([
    ...state.behaviors,
    ...state.queuedBehaviors.map(queuedToBehavior),
  ])
}

export function visibleBehaviorLogs(state: Pick<AtlasState, 'behaviorLogs' | 'queuedBehaviorLogs'>): AtlasBehaviorLog[] {
  return mergeBehaviorLogs([
    ...state.behaviorLogs,
    ...state.queuedBehaviorLogs.map(queuedToBehaviorLog),
  ])
}

export function localQueueCounts(
  state: LocalQueueLike,
): LocalQueueCounts {
  const captures = state.queuedCaptures.length
  const checkins = state.queuedCheckins.length
  const behaviors = state.queuedBehaviors.length
  const behaviorLogs = state.queuedBehaviorLogs.length
  const signals = state.queuedPassiveSignals.length
  const snapshots = state.queuedHealthSnapshots.length
  const digitalSessions = state.queuedDigitalSessions.length
  const digitalSnapshots = state.queuedDigitalActivitySnapshots.length

  return {
    captures,
    checkins,
    behaviors,
    behaviorLogs,
    signals,
    snapshots,
    digitalSessions,
    digitalSnapshots,
    total: captures + checkins + behaviors + behaviorLogs + signals + snapshots + digitalSessions + digitalSnapshots,
  }
}

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

export async function uploadQueuedCapture(capture: QueuedCapture): Promise<AtlasCapture> {
  if (capture.kind === 'text') {
    return createTextCapture({
      client_id: capture.client_id,
      domain: capture.domain,
      content_text: capture.content_text ?? '',
      captured_at: capture.captured_at,
      captured_timezone: capture.captured_timezone,
      captured_lat: capture.captured_lat ?? null,
      captured_lng: capture.captured_lng ?? null,
      metadata: capture.metadata ?? {},
    })
  }

  if (!capture.file_uri) {
    throw new Error('Arquivo local ausente para upload.')
  }

  return uploadCaptureFile({
    client_id: capture.client_id,
    kind: capture.kind,
    domain: capture.domain,
    file_uri: capture.file_uri,
    file_name: capture.file_name ?? fileNameFor(capture.file_uri, capture.client_id, capture.kind === 'audio' ? 'm4a' : 'jpg'),
    mime_type: capture.mime_type ?? (capture.kind === 'audio' ? 'audio/m4a' : 'image/jpeg'),
    content_duration_ms: capture.content_duration_ms ?? null,
    captured_at: capture.captured_at,
    captured_timezone: capture.captured_timezone,
    captured_lat: capture.captured_lat ?? null,
    captured_lng: capture.captured_lng ?? null,
    metadata: capture.metadata ?? {},
  })
}

export function legacyHealthSignalTombstones(existingSignals: AtlasPassiveSignal[]): StorePassiveSignalInput[] {
  const deletedAt = new Date().toISOString()
  return existingSignals
    .filter((signal) => signal.source === 'healthkit' && signal.signal_type === 'heart_rate_bpm')
    .map((signal) => ({
      client_id: signal.client_id,
      source: signal.source,
      signal_type: signal.signal_type,
      value_numeric: null,
      value_text: null,
      unit: signal.unit,
      started_at: signal.started_at,
      ended_at: signal.ended_at,
      recorded_timezone: signal.recorded_timezone,
      deleted_at: deletedAt,
      metadata: {
        ...(signal.metadata ?? {}),
        healthkit_repair: {
          version: HEALTH_DATA_REPAIR_VERSION,
          reason: 'heart_rate_bpm_not_used_by_daily_health_model',
        },
      },
    }))
}

export async function healthDataRepairPending(): Promise<boolean> {
  return (await atlasStorage.getItem(HEALTH_DATA_REPAIR_VERSION_KEY)) !== HEALTH_DATA_REPAIR_VERSION
}

export async function markHealthDataRepairApplied(): Promise<void> {
  await atlasStorage.setItem(HEALTH_DATA_REPAIR_VERSION_KEY, HEALTH_DATA_REPAIR_VERSION)
}

export function fileNameFor(uri: string, clientId: string, fallbackExtension: string): string {
  const clean = uri.split('?')[0]
  const rawName = clean.split('/').pop()
  if (rawName && rawName.includes('.')) return rawName

  return `${clientId}.${fallbackExtension}`
}

export async function persistCaptureFile(sourceUri: string, directoryUri: string, fileName: string): Promise<string> {
  if (!FileSystem.documentDirectory || sourceUri.startsWith(directoryUri)) {
    await assertReadableFile(sourceUri)
    return sourceUri
  }

  await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true })
  const destinationUri = `${directoryUri}${fileName}`
  await FileSystem.copyAsync({ from: sourceUri, to: destinationUri })
  await assertReadableFile(destinationUri)

  return destinationUri
}

async function assertReadableFile(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri)

  if (!info.exists || info.isDirectory) {
    throw new Error('Arquivo local da captura não foi encontrado.')
  }

  if ('size' in info && typeof info.size === 'number' && info.size <= 0) {
    throw new Error('Arquivo local da captura está vazio.')
  }
}

export function stripQueueFields<T extends { attempts: number; last_error?: string | null }>(
  item: T,
): Omit<T, 'attempts' | 'last_error'> {
  const { attempts: _attempts, last_error: _lastError, ...payload } = item
  return payload
}

export function healthSnapshotForUpload(snapshot: QueuedHealthSnapshot): StoreHealthSnapshotInput {
  const payload = stripQueueFields(sanitizeQueuedHealthSnapshotSleep(snapshot)) as StoreHealthSnapshotInput

  return {
    ...payload,
    confidence: normalizeConfidenceForStorage(payload.confidence),
  }
}

export function digitalSessionForUpload(session: QueuedDigitalSession): StoreDigitalSessionInput {
  const payload = stripQueueFields(session) as StoreDigitalSessionInput

  return {
    ...payload,
    source_event_id: payload.source_event_id ?? null,
    category_class_at_time: payload.category_class_at_time ?? null,
    category_label_at_time: payload.category_label_at_time ?? null,
    intentionality: payload.intentionality ?? 'unknown',
    focus_mode_active: payload.focus_mode_active ?? null,
    project_name: payload.project_name ?? null,
    task_name: payload.task_name ?? null,
    url_domain: payload.url_domain ?? null,
    productivity_score: payload.productivity_score ?? null,
    linked_capture_id: payload.linked_capture_id ?? null,
    linked_decision_id: payload.linked_decision_id ?? null,
    raw_payload: payload.raw_payload ?? {},
    metadata: payload.metadata ?? {},
  }
}

export function digitalSnapshotForUpload(snapshot: QueuedDigitalActivitySnapshot): StoreDigitalActivitySnapshotInput {
  const payload = stripQueueFields(snapshot) as StoreDigitalActivitySnapshotInput

  return {
    ...payload,
    focus_mode_active_min: payload.focus_mode_active_min ?? {},
    category_breakdown: payload.category_breakdown ?? {},
    source_breakdown: payload.source_breakdown ?? {},
    raw_rize_data: payload.raw_rize_data ?? {},
    raw_screentime_data: payload.raw_screentime_data ?? {},
    metadata: payload.metadata ?? {},
  }
}

export function behaviorForUpload(behavior: QueuedBehavior): StoreBehaviorInput {
  const payload = stripQueueFields(behavior) as StoreBehaviorInput

  return {
    ...payload,
    category: canonicalBehaviorCategory(payload.category),
    lifecycle_status: payload.lifecycle_status ?? (payload.show_in_morning_briefing === false ? 'manual_only' : 'active'),
    paused_until: payload.paused_until ?? null,
    last_prompted_at: payload.last_prompted_at ?? null,
    prompt_cadence_days: payload.prompt_cadence_days ?? 1,
    auto_suppress_reason: payload.auto_suppress_reason ?? null,
    slug: payload.slug || slugify(payload.name),
    question_text: payload.question_text || `${payload.name} aconteceu ontem?`,
    default_value: payload.default_value ?? 'no',
    target_outcomes: payload.target_outcomes ?? [],
    granularity_level: payload.granularity_level ?? 'binary',
    sensitivity_level: payload.sensitivity_level ?? 'normal',
    derived_from: payload.derived_from ?? {},
    operator_confirmed: payload.operator_confirmed ?? true,
    source_capture_ids: payload.source_capture_ids ?? [],
    activation_rules: payload.activation_rules ?? {},
    show_in_morning_briefing: payload.show_in_morning_briefing ?? true,
    priority_score: normalizeBehaviorPriorityScore(payload.priority_score),
    relational_privacy: payload.relational_privacy ?? false,
    metadata: payload.metadata ?? {},
  }
}

export function normalizeQueuedBehavior(behavior: QueuedBehavior): QueuedBehavior {
  return {
    ...behavior,
    priority_score: normalizeBehaviorPriorityScore(behavior.priority_score),
  }
}

function normalizeBehaviorPriorityScore(value: unknown): number {
  const score = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    return DEFAULT_BEHAVIOR_PRIORITY_SCORE
  }

  return Math.round(score)
}

export function normalizeQueuedHealthSnapshot(snapshot: QueuedHealthSnapshot): QueuedHealthSnapshot {
  return sanitizeQueuedHealthSnapshotSleep({
    ...snapshot,
    confidence: normalizeConfidenceForStorage(snapshot.confidence),
  })
}

export function preserveExistingValidSleepSnapshot(
  snapshot: StoreHealthSnapshotInput,
  existingSnapshots: AtlasHealthSnapshot[],
): StoreHealthSnapshotInput {
  if (hasValidMainSleepPayload(snapshot)) return snapshot

  const previous = existingSnapshots
    .filter((candidate) => !candidate.deleted_at)
    .find((candidate) => (
      candidate.snapshot_date === snapshot.snapshot_date
      && hasValidMainSleepPayload(candidate)
    ))

  if (!previous) return snapshot

  return {
    ...snapshot,
    sleep_score: previous.sleep_score ?? snapshot.sleep_score ?? null,
    sleep_duration_hours: previous.sleep_duration_hours ?? null,
    sleep_efficiency: previous.sleep_efficiency ?? null,
    sleep: previous.sleep ?? snapshot.sleep ?? {},
  }
}

function hasValidMainSleepPayload(snapshot: StoreHealthSnapshotInput | AtlasHealthSnapshot): boolean {
  const sleep = recordOrNull(snapshot.sleep)
  const durationHours = numberOrNull(sleep?.duration_hours) ?? numberOrNull(snapshot.sleep_duration_hours)
  return isMainSleepCandidate({
    asleepHours: durationHours,
    bedtime: stringOrNull(sleep?.bedtime),
    wakeTime: stringOrNull(sleep?.wake_time),
  })
}

function normalizeConfidenceForStorage(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null

  const fraction = value > 1 ? value / 100 : value
  return Math.min(1, Math.max(0, Number(fraction.toFixed(3))))
}

export function chunkItems<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

export function atlasDeviceId(): string {
  const constants = Constants as typeof Constants & {
    deviceName?: string | null
    installationId?: string | null
    sessionId?: string | null
  }

  return [
    'atlas-app',
    Platform.OS,
    constants.installationId ?? constants.sessionId ?? constants.deviceName ?? 'single-device',
  ].join(':')
}

export function clampLevel(level: number): number {
  return Math.min(5, Math.max(1, Math.round(level)))
}

export function newClientId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.()
  if (randomUuid) return randomUuid

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16)
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8
    return value.toString(16)
  })
}

export function deterministicUuid(input: string): string {
  const [a, b, c, d] = cyrb128(input)
  const hex = [a, b, c, d].map((value) => value.toString(16).padStart(8, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hex.slice(18, 20),
    hex.slice(20, 32),
  ].join('-')
}

function cyrb128(value: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762

  for (let index = 0; index < value.length; index++) {
    const k = value.charCodeAt(index)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)

  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ]
}

export function humanError(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Falha inesperada ao sincronizar.'
}

export function partialSyncMessage(queueTotal: number, errors: string[]): string {
  const uniqueErrors = [...new Set(errors.map((error) => error.trim()).filter(Boolean))]
  const detail = uniqueErrors[0] ?? 'Falha ao enviar parte da fila.'

  if (queueTotal <= 0) {
    return `Servidor online, mas parte do upload falhou. ${detail}`
  }

  return `Servidor online, mas ${queueTotal} ${queueTotal === 1 ? 'item continua' : 'itens continuam'} na fila. Último erro: ${detail}`
}
