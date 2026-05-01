import { atlasStorage } from './storage'
import { NativeModules, Platform } from 'react-native'
import type {
  StoreDigitalActivitySnapshotInput,
  StoreDigitalSessionInput,
} from './api/client'

const STORAGE_KEY = 'atlas.screentime.v1'
const DISABLED_MESSAGE = 'Fonte nativa do iPhone indisponivel. O Atlas nao usa zeros falsos para pickups, notificacoes ou primeiro uso.'
const NATIVE_MODULE_NAMES = ['AtlasScreenTime', 'ExpoAtlasScreenTime'] as const
const NATIVE_SNAPSHOT_SOURCE = 'screentime'
const NATIVE_TIMEZONE = 'America/Sao_Paulo'
const MAX_SESSION_SECONDS = 24 * 60 * 60
const HIGH_NATIVE_CONFIDENCE = 0.92

type NativeStatusPayload = Partial<ScreenTimeLocalStatus> & {
  authorizationStatus?: number | string | null
  error?: string | null
  lastError?: string | null
}

type NativeCollectionPayload = {
  status?: NativeStatusPayload | null
  sessions?: unknown[]
  snapshots?: unknown[]
  syncedAt?: string | null
}

type NativeScreenTimeModule = {
  getStatus?: () => Promise<NativeStatusPayload>
  requestAuthorization?: () => Promise<NativeStatusPayload>
  configureMonitoring?: (input: { buckets: ScreenTimeBucket[]; timezone: string }) => Promise<NativeStatusPayload>
  collectDigitalActivity?: (input: { buckets: ScreenTimeBucket[]; timezone: string; now: string }) => Promise<NativeCollectionPayload>
}

export type ScreenTimeBucketId =
  | 'deep_work'
  | 'curated_input'
  | 'algorithmic_input'
  | 'intentional_entertainment'
  | 'default_entertainment'
  | 'communication_primary'
  | 'communication_shallow'
  | 'market'

export interface ScreenTimeBucket {
  id: ScreenTimeBucketId
  selectionId: string
  shortLabel: string
  sourceIdentifier: string
  sourceName: string
  categoryClass: number
  categoryLabel: string
  intentionality: StoreDigitalSessionInput['intentionality']
  productivityScore: number
  thresholdsMin: number[]
}

export interface ScreenTimeLocalStatus {
  available: boolean
  enabled: boolean
  authorizationStatus: number | string | null
  lastSyncAt: string | null
  lastError: string | null
  lastSessionCount: number
  configuredBucketCount: number
  monitoringStartedAt: string | null
  debugTrail: string[]
  entitlementRequired: boolean
  nativeModuleAvailable: boolean
  qualityGate: 'ready' | 'blocked' | 'unavailable'
}

export interface ScreenTimeCollectionResult {
  status: ScreenTimeLocalStatus
  sessions: StoreDigitalSessionInput[]
  snapshots: StoreDigitalActivitySnapshotInput[]
  syncedAt: string
}

export const SCREEN_TIME_BUCKETS: ScreenTimeBucket[] = [
  {
    id: 'deep_work',
    selectionId: 'atlas.st.deep_work',
    shortLabel: 'Deep',
    sourceIdentifier: 'iphone.deep_work',
    sourceName: 'iPhone: trabalho profundo',
    categoryClass: 1,
    categoryLabel: 'Deep Work / Ofensivo',
    intentionality: 'intentional',
    productivityScore: 90,
    thresholdsMin: [10, 25, 45, 60, 90, 120, 180, 240, 360],
  },
  {
    id: 'curated_input',
    selectionId: 'atlas.st.curated_input',
    shortLabel: 'Curado',
    sourceIdentifier: 'iphone.curated_input',
    sourceName: 'iPhone: input curado',
    categoryClass: 3,
    categoryLabel: 'Input curado',
    intentionality: 'intentional',
    productivityScore: 65,
    thresholdsMin: [10, 20, 30, 45, 60, 90, 120, 180],
  },
  {
    id: 'algorithmic_input',
    selectionId: 'atlas.st.algorithmic_input',
    shortLabel: 'Algor.',
    sourceIdentifier: 'iphone.algorithmic_input',
    sourceName: 'iPhone: input algoritmico',
    categoryClass: 4,
    categoryLabel: 'Input algoritmico',
    intentionality: 'default',
    productivityScore: 15,
    thresholdsMin: [5, 10, 20, 30, 45, 60, 90, 120, 180],
  },
  {
    id: 'intentional_entertainment',
    selectionId: 'atlas.st.intentional_entertainment',
    shortLabel: 'Lazer',
    sourceIdentifier: 'iphone.intentional_entertainment',
    sourceName: 'iPhone: entretenimento intencional',
    categoryClass: 5,
    categoryLabel: 'Entretenimento intencional',
    intentionality: 'intentional',
    productivityScore: 40,
    thresholdsMin: [10, 20, 30, 45, 60, 90, 120, 180],
  },
  {
    id: 'default_entertainment',
    selectionId: 'atlas.st.default_entertainment',
    shortLabel: 'Default',
    sourceIdentifier: 'iphone.default_entertainment',
    sourceName: 'iPhone: entretenimento default',
    categoryClass: 6,
    categoryLabel: 'Entretenimento default',
    intentionality: 'default',
    productivityScore: 5,
    thresholdsMin: [5, 10, 20, 30, 45, 60, 90, 120, 180],
  },
  {
    id: 'communication_primary',
    selectionId: 'atlas.st.communication_primary',
    shortLabel: 'Comum.',
    sourceIdentifier: 'iphone.communication_primary',
    sourceName: 'iPhone: comunicacao primaria',
    categoryClass: 7,
    categoryLabel: 'Comunicacao primaria',
    intentionality: 'mixed',
    productivityScore: 50,
    thresholdsMin: [10, 20, 30, 45, 60, 90, 120, 180],
  },
  {
    id: 'communication_shallow',
    selectionId: 'atlas.st.communication_shallow',
    shortLabel: 'Rasa',
    sourceIdentifier: 'iphone.communication_shallow',
    sourceName: 'iPhone: comunicacao rasa',
    categoryClass: 8,
    categoryLabel: 'Comunicacao rasa',
    intentionality: 'default',
    productivityScore: 20,
    thresholdsMin: [5, 10, 20, 30, 45, 60, 90, 120],
  },
  {
    id: 'market',
    selectionId: 'atlas.st.market',
    shortLabel: 'Mercado',
    sourceIdentifier: 'iphone.market',
    sourceName: 'iPhone: mercado',
    categoryClass: 9,
    categoryLabel: 'Mercado / risco',
    intentionality: 'mixed',
    productivityScore: 55,
    thresholdsMin: [5, 10, 20, 30, 45, 60, 90, 120],
  },
]

export async function getScreenTimeLocalStatus(): Promise<ScreenTimeLocalStatus> {
  const native = nativeScreenTimeModule()
  if (!native?.getStatus) {
    const status = disabledStatus(await appendDebugTrail('native-module:missing status'))
    await writeStatus(status)
    return status
  }

  const status = normalizeStatus(await native.getStatus(), await appendDebugTrail('native-module:status'))
  await writeStatus(status)
  return status
}

export async function requestScreenTimeAuthorization(): Promise<ScreenTimeLocalStatus> {
  const native = nativeScreenTimeModule()
  if (!native?.requestAuthorization) {
    const status = disabledStatus(await appendDebugTrail('native-module:missing authorization-request'))
    await writeStatus(status)
    return status
  }

  const status = normalizeStatus(await native.requestAuthorization(), await appendDebugTrail('native-module:authorization-request'))
  await writeStatus(status)
  return status
}

export async function configureScreenTimeMonitoring(): Promise<ScreenTimeLocalStatus> {
  const native = nativeScreenTimeModule()
  if (!native?.configureMonitoring) {
    const status = disabledStatus(await appendDebugTrail('native-module:missing configure-monitoring'))
    await writeStatus(status)
    return status
  }

  const status = normalizeStatus(
    await native.configureMonitoring({ buckets: SCREEN_TIME_BUCKETS, timezone: NATIVE_TIMEZONE }),
    await appendDebugTrail('native-module:configure-monitoring'),
  )
  await writeStatus(status)
  return status
}

export async function collectScreenTimeDigitalActivity(): Promise<ScreenTimeCollectionResult> {
  const syncedAt = new Date().toISOString()
  const native = nativeScreenTimeModule()

  if (!native?.collectDigitalActivity) {
    const status = disabledStatus(await appendDebugTrail('native-module:missing collect'))
    await writeStatus(status)

    return {
      status,
      sessions: [],
      snapshots: [],
      syncedAt,
    }
  }

  const payload = await native.collectDigitalActivity({
    buckets: SCREEN_TIME_BUCKETS,
    timezone: NATIVE_TIMEZONE,
    now: syncedAt,
  })
  const sessions = normalizeNativeSessions(payload.sessions ?? [], syncedAt)
  const snapshots = normalizeNativeSnapshots(payload.snapshots ?? [], sessions, syncedAt)
  const status = normalizeStatus(payload.status ?? {}, await appendDebugTrail(`native-module:collect sessions=${sessions.length} snapshots=${snapshots.length}`), {
    lastSyncAt: syncedAt,
    lastSessionCount: sessions.length,
    configuredBucketCount: SCREEN_TIME_BUCKETS.length,
    lastError: snapshots.length > 0 || sessions.length > 0 ? null : 'Coleta nativa retornou sem sessoes e sem snapshot validos.',
  })

  await writeStatus(status)

  return {
    status,
    sessions,
    snapshots,
    syncedAt,
  }
}

export function screenTimeBucketById(bucketId: string | null): ScreenTimeBucket | null {
  if (!bucketId) return null
  return SCREEN_TIME_BUCKETS.find((bucket) => bucket.id === bucketId) ?? null
}

function disabledStatus(debugTrail: string[] = []): ScreenTimeLocalStatus {
  return {
    available: false,
    enabled: false,
    authorizationStatus: null,
    lastSyncAt: null,
    lastError: DISABLED_MESSAGE,
    lastSessionCount: 0,
    configuredBucketCount: 0,
    monitoringStartedAt: null,
    debugTrail,
    entitlementRequired: true,
    nativeModuleAvailable: false,
    qualityGate: 'unavailable',
  }
}

function nativeScreenTimeModule(): NativeScreenTimeModule | null {
  if (Platform.OS !== 'ios') return null

  for (const name of NATIVE_MODULE_NAMES) {
    const candidate = NativeModules[name]
    if (candidate && typeof candidate === 'object') return candidate as NativeScreenTimeModule
  }

  return null
}

function normalizeStatus(
  payload: NativeStatusPayload,
  debugTrail: string[],
  overrides: Partial<ScreenTimeLocalStatus> = {},
): ScreenTimeLocalStatus {
  const nativeModuleAvailable = Boolean(nativeScreenTimeModule())
  const authorizationStatus = payload.authorizationStatus ?? null
  const available = nativeModuleAvailable && payload.available === true
  const enabled = available && payload.enabled === true
  const entitlementRequired = typeof payload.entitlementRequired === 'boolean' ? payload.entitlementRequired : !available
  const lastError = overrides.lastError ?? payload.lastError ?? payload.error ?? (available ? null : DISABLED_MESSAGE)

  return {
    available,
    enabled,
    authorizationStatus,
    lastSyncAt: asStringOrNull(overrides.lastSyncAt ?? payload.lastSyncAt),
    lastError: asStringOrNull(lastError),
    lastSessionCount: asNonNegativeInt(overrides.lastSessionCount ?? payload.lastSessionCount) ?? 0,
    configuredBucketCount: asNonNegativeInt(overrides.configuredBucketCount ?? payload.configuredBucketCount) ?? 0,
    monitoringStartedAt: asStringOrNull(overrides.monitoringStartedAt ?? payload.monitoringStartedAt),
    debugTrail,
    entitlementRequired,
    nativeModuleAvailable,
    qualityGate: enabled && !entitlementRequired ? 'ready' : nativeModuleAvailable ? 'blocked' : 'unavailable',
  }
}

function normalizeNativeSessions(items: unknown[], collectedAt: string): StoreDigitalSessionInput[] {
  return items
    .map((item, index) => normalizeNativeSession(item, index, collectedAt))
    .filter((session): session is StoreDigitalSessionInput => session !== null)
}

function normalizeNativeSession(item: unknown, index: number, collectedAt: string): StoreDigitalSessionInput | null {
  if (!isRecord(item)) return null

  const startedAt = asIsoString(item.started_at ?? item.startedAt)
  const endedAt = asIsoString(item.ended_at ?? item.endedAt)
  if (!startedAt || !endedAt) return null

  const startedMs = new Date(startedAt).getTime()
  const endedMs = new Date(endedAt).getTime()
  if (!Number.isFinite(startedMs) || !Number.isFinite(endedMs) || endedMs <= startedMs) return null

  const durationSeconds = asNonNegativeInt(item.duration_seconds ?? item.durationSeconds)
    ?? Math.round((endedMs - startedMs) / 1000)
  if (durationSeconds <= 0 || durationSeconds > MAX_SESSION_SECONDS) return null

  const bucket = screenTimeBucketById(asStringOrNull(item.bucket_id ?? item.bucketId))
  const sourceIdentifier = asNonEmptyString(item.source_identifier ?? item.sourceIdentifier)
    ?? bucket?.sourceIdentifier
    ?? `iphone.unknown.${index}`
  const sourceName = asNonEmptyString(item.source_name ?? item.sourceName)
    ?? bucket?.sourceName
    ?? sourceIdentifier
  const categoryClass = asCategoryClass(item.category_class_at_time ?? item.categoryClassAtTime ?? item.category_class ?? item.categoryClass)
    ?? bucket?.categoryClass
    ?? null
  const categoryLabel = asNonEmptyString(item.category_label_at_time ?? item.categoryLabelAtTime ?? item.category_label ?? item.categoryLabel)
    ?? bucket?.categoryLabel
    ?? null
  const intentionality = asIntentionality(item.intentionality) ?? bucket?.intentionality ?? 'unknown'
  const confidence = clampNumber(asNumber(item.confidence ?? item.classification_confidence ?? item.classificationConfidence) ?? HIGH_NATIVE_CONFIDENCE, 0, 1)

  return {
    client_id: asUuid(item.client_id ?? item.clientId) ?? stableUuid(`screentime-session:${sourceIdentifier}:${startedAt}:${endedAt}:${index}`),
    source: NATIVE_SNAPSHOT_SOURCE,
    source_event_id: asStringOrNull(item.source_event_id ?? item.sourceEventId),
    source_identifier: sourceIdentifier,
    source_name: sourceName,
    source_kind: asSourceKind(item.source_kind ?? item.sourceKind) ?? 'app',
    category_class_at_time: categoryClass,
    category_label_at_time: categoryLabel,
    intentionality,
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: durationSeconds,
    recorded_timezone: asNonEmptyString(item.recorded_timezone ?? item.recordedTimezone) ?? NATIVE_TIMEZONE,
    focus_mode_active: asStringOrNull(item.focus_mode_active ?? item.focusModeActive),
    project_name: asStringOrNull(item.project_name ?? item.projectName),
    task_name: asStringOrNull(item.task_name ?? item.taskName),
    url_domain: asStringOrNull(item.url_domain ?? item.urlDomain),
    productivity_score: asNumber(item.productivity_score ?? item.productivityScore),
    linked_capture_id: asStringOrNull(item.linked_capture_id ?? item.linkedCaptureId),
    linked_decision_id: asStringOrNull(item.linked_decision_id ?? item.linkedDecisionId),
    raw_payload: isRecord(item.raw_payload) ? item.raw_payload : { native: item },
    metadata: {
      collected_at: collectedAt,
      native_source: 'ios_screentime',
      classification: {
        status: categoryClass === null ? 'unclassified' : 'mapped',
        confidence,
      },
    },
  }
}

function normalizeNativeSnapshots(
  items: unknown[],
  sessions: StoreDigitalSessionInput[],
  collectedAt: string,
): StoreDigitalActivitySnapshotInput[] {
  const nativeSnapshots = items
    .map((item, index) => normalizeNativeSnapshot(item, index, collectedAt))
    .filter((snapshot): snapshot is StoreDigitalActivitySnapshotInput => snapshot !== null)

  if (nativeSnapshots.length > 0) return nativeSnapshots.map((snapshot) => enrichScreenTimeSnapshot(snapshot, collectedAt))
  if (sessions.length === 0) return []

  return [enrichScreenTimeSnapshot(snapshotFromSessions(sessions, collectedAt), collectedAt)]
}

function normalizeNativeSnapshot(item: unknown, index: number, collectedAt: string): StoreDigitalActivitySnapshotInput | null {
  if (!isRecord(item)) return null

  const snapshotDate = asDateKey(item.snapshot_date ?? item.snapshotDate)
  if (!snapshotDate) return null

  const totalScreenTime = asNonNegativeInt(item.total_screen_time_min ?? item.totalScreenTimeMin)
  const signalCount = asNonNegativeInt(item.signal_count ?? item.signalCount) ?? 0

  return {
    client_id: asUuid(item.client_id ?? item.clientId) ?? stableUuid(`screentime-snapshot:${snapshotDate}:${index}`),
    source: NATIVE_SNAPSHOT_SOURCE,
    snapshot_date: snapshotDate,
    snapshot_timezone: asNonEmptyString(item.snapshot_timezone ?? item.snapshotTimezone) ?? NATIVE_TIMEZONE,
    computed_at: asIsoString(item.computed_at ?? item.computedAt) ?? collectedAt,
    signal_count: signalCount,
    total_screen_time_min: totalScreenTime,
    pickups_count: asNonNegativeInt(item.pickups_count ?? item.pickupsCount),
    first_offensive_use_min_after_wake: asNonNegativeInt(item.first_offensive_use_min_after_wake ?? item.firstOffensiveUseMinAfterWake),
    deep_work_sessions_count: asNonNegativeInt(item.deep_work_sessions_count ?? item.deepWorkSessionsCount),
    deep_work_total_min: asNonNegativeInt(item.deep_work_total_min ?? item.deepWorkTotalMin),
    notifications_received: asNonNegativeInt(item.notifications_received ?? item.notificationsReceived),
    notifications_actioned: asNonNegativeInt(item.notifications_actioned ?? item.notificationsActioned),
    curated_input_min: asNonNegativeInt(item.curated_input_min ?? item.curatedInputMin),
    algorithmic_input_min: asNonNegativeInt(item.algorithmic_input_min ?? item.algorithmicInputMin),
    intentional_entertainment_min: asNonNegativeInt(item.intentional_entertainment_min ?? item.intentionalEntertainmentMin),
    default_entertainment_min: asNonNegativeInt(item.default_entertainment_min ?? item.defaultEntertainmentMin),
    communication_primary_min: asNonNegativeInt(item.communication_primary_min ?? item.communicationPrimaryMin),
    communication_shallow_min: asNonNegativeInt(item.communication_shallow_min ?? item.communicationShallowMin),
    market_min: asNonNegativeInt(item.market_min ?? item.marketMin),
    focus_mode_active_min: isRecord(item.focus_mode_active_min) ? item.focus_mode_active_min : {},
    category_breakdown: isRecord(item.category_breakdown) ? item.category_breakdown : {},
    source_breakdown: isRecord(item.source_breakdown) ? item.source_breakdown : {},
    raw_rize_data: {},
    raw_screentime_data: isRecord(item.raw_screentime_data) ? item.raw_screentime_data : { native: item },
    metadata: isRecord(item.metadata) ? item.metadata : {},
  }
}

function snapshotFromSessions(sessions: StoreDigitalSessionInput[], collectedAt: string): StoreDigitalActivitySnapshotInput {
  const first = sessions
    .map((session) => session.started_at)
    .sort()[0]
  const snapshotDate = first ? localDateKey(first) : localDateKey(collectedAt)
  const categoryMinutes = new Map<number, number>()
  let deepWorkSessions = 0
  let deepWorkSeconds = 0
  let totalSeconds = 0

  for (const session of sessions) {
    totalSeconds += session.duration_seconds
    const category = typeof session.category_class_at_time === 'number' ? session.category_class_at_time : null
    if (category !== null) {
      categoryMinutes.set(category, (categoryMinutes.get(category) ?? 0) + Math.round(session.duration_seconds / 60))
      if (category === 1 && session.duration_seconds >= 25 * 60) {
        deepWorkSessions += 1
        deepWorkSeconds += session.duration_seconds
      }
    }
  }

  return {
    client_id: stableUuid(`screentime-snapshot:${snapshotDate}`),
    source: NATIVE_SNAPSHOT_SOURCE,
    snapshot_date: snapshotDate,
    snapshot_timezone: NATIVE_TIMEZONE,
    computed_at: collectedAt,
    signal_count: sessions.length,
    total_screen_time_min: Math.round(totalSeconds / 60),
    deep_work_sessions_count: deepWorkSessions > 0 ? deepWorkSessions : null,
    deep_work_total_min: deepWorkSeconds > 0 ? Math.round(deepWorkSeconds / 60) : null,
    curated_input_min: sumMap(categoryMinutes, [1, 3]),
    algorithmic_input_min: valueOrNull(categoryMinutes.get(4)),
    intentional_entertainment_min: valueOrNull(categoryMinutes.get(5)),
    default_entertainment_min: valueOrNull(categoryMinutes.get(6)),
    communication_primary_min: valueOrNull(categoryMinutes.get(7)),
    communication_shallow_min: valueOrNull(categoryMinutes.get(8)),
    market_min: valueOrNull(categoryMinutes.get(9)),
    focus_mode_active_min: {},
    category_breakdown: Object.fromEntries([...categoryMinutes.entries()].map(([key, value]) => [String(key), value])),
    source_breakdown: {},
    raw_rize_data: {},
    raw_screentime_data: { session_client_ids: sessions.map((session) => session.client_id) },
    metadata: {},
  }
}

function enrichScreenTimeSnapshot(snapshot: StoreDigitalActivitySnapshotInput, collectedAt: string): StoreDigitalActivitySnapshotInput {
  const total = asNonNegativeInt(snapshot.total_screen_time_min)
  const classified = classifiedDigitalMinutes(snapshot)
  const ratio = typeof total === 'number' && total > 0 ? clampNumber(classified / total, 0, 1) : null
  const interruptionsMeasured = typeof snapshot.pickups_count === 'number'
    || typeof snapshot.notifications_received === 'number'
    || typeof snapshot.first_offensive_use_min_after_wake === 'number'
  const warnings: string[] = []

  if (!total || total <= 0) warnings.push('no_screen_time_total')
  if (typeof ratio === 'number' && ratio < 0.8) warnings.push(ratio > 0 ? 'partial_category_classification' : 'no_category_classification')
  if (!interruptionsMeasured) warnings.push('iphone_interruptions_absent')
  if (typeof snapshot.notifications_received === 'number' && typeof snapshot.notifications_actioned === 'number' && snapshot.notifications_actioned > snapshot.notifications_received) {
    warnings.push('notifications_actioned_exceeds_received')
  }

  const score = Math.round(clampNumber(
    (total && total > 0 ? 30 : 0)
      + (typeof ratio === 'number' ? ratio * 35 : 0)
      + 20
      + (interruptionsMeasured ? 15 : 0),
    0,
    interruptionsMeasured ? 100 : 84,
  ))

  return {
    ...snapshot,
    metadata: {
      ...(snapshot.metadata ?? {}),
      native: {
        source: 'ios_screentime',
        entitlement: 'family_controls',
        collected_at: collectedAt,
      },
      coverage: {
        ...metadataRecord(snapshot.metadata, 'coverage'),
        total_minutes: total ?? null,
        classified_minutes: classified,
        classification_ratio: ratio,
      },
      capabilities: {
        screen_time: typeof total === 'number',
        category_classification: typeof ratio === 'number' && ratio > 0,
        pickups: typeof snapshot.pickups_count === 'number',
        notifications: typeof snapshot.notifications_received === 'number' || typeof snapshot.notifications_actioned === 'number',
        first_use_after_wake: typeof snapshot.first_offensive_use_min_after_wake === 'number',
      },
      quality: {
        score,
        status: score >= 80 ? 'high' : score >= 50 ? 'partial' : 'low',
        has_native_iphone_source: true,
        warnings,
      },
    },
  }
}

async function readDebugTrail(): Promise<string[]> {
  const persisted = await readStatus()
  return persisted.debugTrail
}

async function appendDebugTrail(event: string): Promise<string[]> {
  const previous = await readDebugTrail()
  return [
    ...previous,
    `${new Date().toISOString()} ${event}`,
  ].slice(-12)
}

async function readStatus(): Promise<ScreenTimeLocalStatus> {
  try {
    const raw = await atlasStorage.getItem(STORAGE_KEY)
    if (!raw) return disabledStatus()
    const parsed = JSON.parse(raw) as Partial<ScreenTimeLocalStatus>
    return {
      ...disabledStatus(),
      debugTrail: Array.isArray(parsed.debugTrail) ? parsed.debugTrail.filter((line): line is string => typeof line === 'string') : [],
    }
  } catch {
    return disabledStatus()
  }
}

async function writeStatus(status: ScreenTimeLocalStatus): Promise<void> {
  await atlasStorage.setItem(STORAGE_KEY, JSON.stringify(status))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function metadataRecord(metadata: Record<string, unknown> | undefined, key: string): Record<string, unknown> {
  const value = metadata?.[key]
  return isRecord(value) ? value : {}
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function asNonEmptyString(value: unknown): string | null {
  const stringValue = asStringOrNull(value)
  return stringValue ? stringValue.trim() : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asNonNegativeInt(value: unknown): number | null {
  const numeric = asNumber(value)
  if (numeric === null || numeric < 0) return null
  return Math.round(numeric)
}

function asIsoString(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? new Date(time).toISOString() : null
}

function asDateKey(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? localDateKey(new Date(time).toISOString()) : null
}

function asUuid(value: unknown): string | null {
  const candidate = asStringOrNull(value)
  return candidate && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : null
}

function asCategoryClass(value: unknown): number | null {
  const numeric = asNonNegativeInt(value)
  return numeric !== null && numeric >= 1 && numeric <= 10 ? numeric : null
}

function asSourceKind(value: unknown): StoreDigitalSessionInput['source_kind'] | null {
  const candidate = asStringOrNull(value)
  return candidate && ['app', 'domain', 'url', 'project', 'category', 'unknown'].includes(candidate)
    ? candidate as StoreDigitalSessionInput['source_kind']
    : null
}

function asIntentionality(value: unknown): StoreDigitalSessionInput['intentionality'] | null {
  const candidate = asStringOrNull(value)
  return candidate && ['intentional', 'default', 'mixed', 'unknown'].includes(candidate)
    ? candidate as StoreDigitalSessionInput['intentionality']
    : null
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function stableUuid(value: string): string {
  const hashes = [0x811c9dc5, 0x45d9f3b, 0x27d4eb2d, 0x165667b1].map((seed) => fnv1a(value, seed))
  const hex = hashes.map((hash) => hash.toString(16).padStart(8, '0')).join('').slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}-${hex.slice(20, 32)}`
}

function fnv1a(value: string, seed: number): number {
  let hash = seed >>> 0
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function localDateKey(iso: string): string {
  const date = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NATIVE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : iso.slice(0, 10)
}

function classifiedDigitalMinutes(snapshot: StoreDigitalActivitySnapshotInput): number {
  return [
    snapshot.curated_input_min,
    snapshot.algorithmic_input_min,
    snapshot.intentional_entertainment_min,
    snapshot.default_entertainment_min,
    snapshot.communication_primary_min,
    snapshot.communication_shallow_min,
    snapshot.market_min,
  ]
    .map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0))
    .reduce((sum, value) => sum + value, 0)
}

function valueOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && value > 0 ? value : null
}

function sumMap(map: Map<number, number>, keys: number[]): number | null {
  const total = keys.reduce((sum, key) => sum + (map.get(key) ?? 0), 0)
  return valueOrNull(total)
}
