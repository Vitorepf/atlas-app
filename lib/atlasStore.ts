import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as FileSystem from 'expo-file-system/legacy'
import { Platform } from 'react-native'
import { create } from 'zustand'
import {
  type AtlasCapture,
  type AtlasBehavior,
  type AtlasBehaviorLog,
  type AtlasCheckin,
  type AtlasDailyMission,
  type AtlasDomain,
  type AtlasDigitalActivitySnapshot,
  type AtlasDigitalSession,
  type AtlasHealthSnapshot,
  type AtlasPassiveSignal,
  type CaptureTriageInput,
  type CaptureTriageResponse,
  type CaptureKind,
  type CreateAtlasDomainInput,
  type StoreCheckinInput,
  type StoreBehaviorInput,
  type StoreBehaviorLogInput,
  type StoreDigitalActivitySnapshotInput,
  type StoreDigitalSessionInput,
  type StoreHealthSnapshotInput,
  type StorePassiveSignalInput,
  AtlasApiError,
  clarifyCapture as clarifyServerCapture,
  createDomain as createServerDomain,
  createTextCapture,
  deleteCapture as deleteServerCapture,
  getAtlasAuthHeaders,
  getCaptureFileUrl,
  getHealth,
  getInboxHealth,
  getTodayMission,
  hydrateApiConfig,
  listCaptures,
  listDomains,
  listBehaviorLogs,
  listBehaviors,
  listCheckins,
  listDigitalActivitySnapshots,
  listDigitalSessions,
  listHealthSnapshots,
  listPassiveSignals,
  patchCapture,
  patchBehavior as patchServerBehavior,
  retryCaptureTranscription,
  syncDelta,
  triageCapture as triageServerCapture,
  uploadCaptureFile,
} from './api/client'
import type { DomainKey } from './domains'
import { DEFAULT_DOMAINS, domainLabel, mergeDomains, normalizeDomainFromApi, type Domain } from './domains'
import { buildHealthSnapshotInputs } from './healthSnapshots'
import { isMainSleepCandidate } from './sleepValidity'
import {
  collectHealthKitSignals,
  getHealthKitLocalStatus,
  healthKitSleepAggregateClientId,
  healthKitSleepDurationClientId,
  requestAllHealthKitPermissions,
  type HealthKitLocalStatus,
} from './healthKit'
import {
  collectScreenTimeDigitalActivity,
  configureScreenTimeMonitoring,
  getScreenTimeLocalStatus,
  requestScreenTimeAuthorization,
  type ScreenTimeLocalStatus,
} from './screenTime'
import { behaviorFactorPayload, canonicalBehaviorCategory, normalizeBehaviorFactor } from './bitaculaFactors'
import type { InboxItem } from '../components/InboxCard'

const STORAGE_KEY = 'atlas.store.v1'
const HEALTH_DATA_REPAIR_VERSION_KEY = 'atlas.health.dataRepairVersion'
const HEALTH_DATA_REPAIR_VERSION = '2026-04-30.sleep-operational-v4'
const LOCAL_ID_PREFIX = 'local:'
const LOCAL_AUDIO_DIR = `${FileSystem.documentDirectory ?? ''}atlas/audio/`
const LOCAL_PHOTO_DIR = `${FileSystem.documentDirectory ?? ''}atlas/photos/`
const CHECKIN_SYNC_BATCH_SIZE = 100
const BEHAVIOR_SYNC_BATCH_SIZE = 100
const BEHAVIOR_LOG_SYNC_BATCH_SIZE = 200
const PASSIVE_SIGNAL_SYNC_BATCH_SIZE = 250
const HEALTH_SNAPSHOT_SYNC_BATCH_SIZE = 90
const HEALTH_SNAPSHOT_BACKFILL_DAYS = 60
const HEALTH_SNAPSHOT_REFRESH_DAYS = 3
const DIGITAL_SESSION_SYNC_BATCH_SIZE = 250
const DIGITAL_SNAPSHOT_SYNC_BATCH_SIZE = 90
const DERIVED_SLEEP_SIGNAL_TYPES = [
  'sleep_duration_hours',
  'sleep_hr_avg_bpm',
  'sleep_hr_min_bpm',
  'sleep_hr_max_bpm',
  'sleep_hr_median_bpm',
  'sleep_hr_sample_count',
] as const

export interface QueuedCapture {
  client_id: string
  kind: CaptureKind
  domain: DomainKey
  content_text?: string | null
  file_uri?: string | null
  file_name?: string | null
  mime_type?: string | null
  content_duration_ms?: number | null
  captured_at: string
  captured_timezone: string
  captured_lat?: number | null
  captured_lng?: number | null
  metadata?: Record<string, unknown>
  attempts: number
  last_error?: string | null
}

export type QueuedCheckin = StoreCheckinInput & {
  attempts: number
  last_error?: string | null
}

export type QueuedPassiveSignal = StorePassiveSignalInput & {
  attempts: number
  last_error?: string | null
}

export type QueuedHealthSnapshot = StoreHealthSnapshotInput & {
  attempts: number
  last_error?: string | null
}

export type QueuedDigitalSession = StoreDigitalSessionInput & {
  attempts: number
  last_error?: string | null
}

export type QueuedDigitalActivitySnapshot = StoreDigitalActivitySnapshotInput & {
  attempts: number
  last_error?: string | null
}

export type QueuedBehavior = StoreBehaviorInput & {
  attempts: number
  last_error?: string | null
}

export type QueuedBehaviorLog = StoreBehaviorLogInput & {
  attempts: number
  last_error?: string | null
}

export interface LocalQueueCounts {
  captures: number
  checkins: number
  behaviors: number
  behaviorLogs: number
  signals: number
  snapshots: number
  digitalSessions: number
  digitalSnapshots: number
  total: number
}

interface LocalQueueLike {
  queuedCaptures: { length: number }
  queuedCheckins: { length: number }
  queuedBehaviors: { length: number }
  queuedBehaviorLogs: { length: number }
  queuedPassiveSignals: { length: number }
  queuedHealthSnapshots: { length: number }
  queuedDigitalSessions: { length: number }
  queuedDigitalActivitySnapshots: { length: number }
}

interface PersistedAtlasState {
  captures: AtlasCapture[]
  domains: Domain[]
  checkins: AtlasCheckin[]
  behaviors: AtlasBehavior[]
  behaviorLogs: AtlasBehaviorLog[]
  passiveSignals: AtlasPassiveSignal[]
  healthSnapshots: AtlasHealthSnapshot[]
  digitalSessions: AtlasDigitalSession[]
  digitalActivitySnapshots: AtlasDigitalActivitySnapshot[]
  queuedCaptures: QueuedCapture[]
  queuedCheckins: QueuedCheckin[]
  queuedBehaviors: QueuedBehavior[]
  queuedBehaviorLogs: QueuedBehaviorLog[]
  queuedPassiveSignals: QueuedPassiveSignal[]
  queuedHealthSnapshots: QueuedHealthSnapshot[]
  queuedDigitalSessions: QueuedDigitalSession[]
  queuedDigitalActivitySnapshots: QueuedDigitalActivitySnapshot[]
  mission: AtlasDailyMission | null
  lastSyncAt: string | null
  serverReachable: boolean
  healthKit: HealthKitLocalStatus
  screenTime: ScreenTimeLocalStatus
}

interface CreateCaptureBase {
  domain: DomainKey
  capturedAt?: string
  capturedTimezone?: string
  capturedLat?: number | null
  capturedLng?: number | null
  metadata?: Record<string, unknown>
}

export interface CreateAudioCaptureInput extends CreateCaptureBase {
  fileUri: string
  durationMs?: number | null
}

export interface CreatePhotoCaptureInput extends CreateCaptureBase {
  fileUri: string
  mimeType?: string
}

export interface CreateTextCaptureInput extends CreateCaptureBase {
  text: string
}

export interface AtlasState extends PersistedAtlasState {
  hydrated: boolean
  syncing: boolean
  healthKitSyncing: boolean
  screenTimeSyncing: boolean
  lastError: string | null

  hydrate: () => Promise<void>
  refreshDomains: () => Promise<void>
  createDomain: (input: CreateAtlasDomainInput) => Promise<Domain | null>
  sync: () => Promise<void>
  refresh: () => Promise<void>
  loadMission: () => Promise<void>
  requestHealthKitPermissions: () => Promise<void>
  syncHealthKit: () => Promise<void>
  requestScreenTimePermissions: () => Promise<void>
  configureScreenTime: () => Promise<void>
  syncScreenTime: () => Promise<void>

  createAudioCapture: (input: CreateAudioCaptureInput) => Promise<string>
  createPhotoCapture: (input: CreatePhotoCaptureInput) => Promise<string>
  createTextCapture: (input: CreateTextCaptureInput) => Promise<string>
  createCheckin: (input: {
    state: AtlasCheckin['state']
    energyLevel: number
    moodLevel: number
    note?: string | null
    metadata?: Record<string, unknown>
  }) => Promise<string>
  createPassiveSignal: (input: {
    source: AtlasPassiveSignal['source']
    signalType: string
    valueNumeric?: number | null
    valueText?: string | null
    unit?: string | null
    startedAt?: string
    endedAt?: string | null
    metadata?: Record<string, unknown>
  }) => Promise<string>
  createBehavior: (input: {
    name: string
    category?: AtlasBehavior['category']
    inputType?: AtlasBehavior['input_type']
    questionText?: string
    parentFactor?: string | null
    factorCondition?: string | null
    targetOutcomes?: string[]
    expectedLag?: string | null
    expectedDirection?: string | null
    granularityLevel?: AtlasBehavior['granularity_level']
    sensitivityLevel?: AtlasBehavior['sensitivity_level']
    derivedFrom?: Record<string, unknown>
    operatorConfirmed?: boolean
    relationalPrivacy?: boolean
    lifecycleStatus?: AtlasBehavior['lifecycle_status']
    showInMorningBriefing?: boolean
    metadata?: Record<string, unknown>
  }) => Promise<string>
  updateBehavior: (clientId: string, patch: {
    name?: string
    questionText?: string
    category?: AtlasBehavior['category']
    lifecycleStatus?: AtlasBehavior['lifecycle_status']
    showInMorningBriefing?: boolean
    pausedUntil?: string | null
    archivedAt?: string | null
    autoSuppressReason?: string | null
    metadata?: Record<string, unknown>
  }) => Promise<void>
  logBehavior: (input: {
    behaviorClientId: string
    logDate?: string
    value: string
    numericValue?: number | null
    quantityNumeric?: number | null
    quantityUnit?: string | null
    intensity?: number | null
    occurredAt?: string | null
    note?: string | null
    source?: AtlasBehaviorLog['source']
    context?: Record<string, unknown>
    metadata?: Record<string, unknown>
  }) => Promise<string>
  updateCapture: (id: string, patch: Partial<Pick<AtlasCapture, 'domain' | 'content_text' | 'metadata'>>) => Promise<AtlasCapture | null>
  retryTranscription: (id: string) => Promise<AtlasCapture | null>
  clarifyCapture: (id: string) => Promise<AtlasCapture | null>
  triageCapture: (id: string, input: CaptureTriageInput) => Promise<CaptureTriageResponse | null>
  deleteCapture: (id: string) => Promise<boolean>
}

const initialPersistedState: PersistedAtlasState = {
  captures: [],
  domains: DEFAULT_DOMAINS,
  checkins: [],
  behaviors: [],
  behaviorLogs: [],
  passiveSignals: [],
  healthSnapshots: [],
  digitalSessions: [],
  digitalActivitySnapshots: [],
  queuedCaptures: [],
  queuedCheckins: [],
  queuedBehaviors: [],
  queuedBehaviorLogs: [],
  queuedPassiveSignals: [],
  queuedHealthSnapshots: [],
  queuedDigitalSessions: [],
  queuedDigitalActivitySnapshots: [],
  mission: null,
  lastSyncAt: null,
  serverReachable: false,
  healthKit: {
    available: false,
    enabled: false,
    lastSyncAt: null,
    lastError: null,
    lastSignalCount: 0,
    requestedTypeCount: 0,
    debugTrail: [],
    historyBackfilled: false,
    historyBackfilledAt: null,
    backgroundConfiguredAt: null,
  },
  screenTime: {
    available: false,
    enabled: false,
    authorizationStatus: null,
    lastSyncAt: null,
    lastError: null,
    lastSessionCount: 0,
    configuredBucketCount: 0,
    monitoringStartedAt: null,
    debugTrail: [],
    entitlementRequired: true,
    nativeModuleAvailable: false,
    qualityGate: 'unavailable',
  },
}

export const useAtlasStore = create<AtlasState>((set, get) => ({
  ...initialPersistedState,
  hydrated: false,
  syncing: false,
  healthKitSyncing: false,
  screenTimeSyncing: false,
  lastError: null,

  hydrate: async () => {
    if (get().hydrated) return

    await hydrateApiConfig()

    const [raw, healthKit, screenTime] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      getHealthKitLocalStatus(),
      getScreenTimeLocalStatus(),
    ])
    if (raw) {
      try {
        const persisted = normalizePersistedState(JSON.parse(raw))
        set({
          ...initialPersistedState,
          ...persisted,
          healthKit,
          screenTime,
          serverReachable: false,
          hydrated: true,
          syncing: false,
          healthKitSyncing: false,
          screenTimeSyncing: false,
          lastError: null,
        })
        void get().refreshDomains()
        await persist(get())
      } catch {
        set({ healthKit, screenTime, hydrated: true })
        void get().refreshDomains()
      }
    } else {
      set({ healthKit, screenTime, hydrated: true })
      void get().refreshDomains()
    }
  },

  refreshDomains: async () => {
    try {
      const response = await listDomains()
      const domains = mergeDomains(
        response.domains
          .map((domain: AtlasDomain) => normalizeDomainFromApi(domain as unknown as Record<string, unknown>))
          .filter((domain): domain is Domain => domain != null),
      )
      set({ domains, serverReachable: true, lastError: null })
      await persist(get())
    } catch (error) {
      set({ domains: mergeDomains(get().domains), lastError: humanError(error), serverReachable: error instanceof AtlasApiError })
    }
  },

  createDomain: async (input) => {
    try {
      const response = await createServerDomain(input)
      const created = normalizeDomainFromApi(response as unknown as Record<string, unknown>)
      if (!created) {
        throw new Error('Domínio criado, mas resposta inválida do servidor.')
      }

      set((state) => ({
        domains: mergeDomains([...state.domains, created]),
        serverReachable: true,
        lastError: null,
      }))
      await persist(get())

      return created
    } catch (error) {
      set({ lastError: humanError(error), serverReachable: error instanceof AtlasApiError })
      await persist(get())

      return null
    }
  },

  sync: async () => {
    if (get().syncing) return

    set({ syncing: true, lastError: null })

    try {
      await getHealth()
      await get().refreshDomains()
      try {
        await getInboxHealth()
      } catch {
        // Inbox health history is useful but should never block capture sync.
      }
      const queuedCapturesToSync = mergeQueuedCaptures(get().queuedCaptures)
      const queuedCheckinsToSync = mergeQueuedCheckins(get().queuedCheckins)
      const queuedBehaviorsToSync = mergeQueuedBehaviors(get().queuedBehaviors)
      const queuedBehaviorLogsToSync = mergeQueuedBehaviorLogs(get().queuedBehaviorLogs)
      const queuedPassiveSignalsToSync = mergeQueuedPassiveSignals(get().queuedPassiveSignals)
      const queuedHealthSnapshotsToSync = mergeQueuedHealthSnapshots(get().queuedHealthSnapshots)
      const queuedDigitalSessionsToSync = mergeQueuedDigitalSessions(get().queuedDigitalSessions)
      const queuedDigitalSnapshotsToSync = mergeQueuedDigitalActivitySnapshots(get().queuedDigitalActivitySnapshots)
      const queuedCaptureIds = new Set(queuedCapturesToSync.map((capture) => capture.client_id))
      const queuedCheckinIds = new Set(queuedCheckinsToSync.map((checkin) => checkin.client_id))
      const queuedBehaviorIds = new Set(queuedBehaviorsToSync.map((behavior) => behavior.client_id))
      const queuedBehaviorLogIds = new Set(queuedBehaviorLogsToSync.map((log) => log.client_id))
      const queuedPassiveSignalIds = new Set(queuedPassiveSignalsToSync.map((signal) => signal.client_id))
      const queuedHealthSnapshotIds = new Set(queuedHealthSnapshotsToSync.map((snapshot) => snapshot.client_id))
      const queuedDigitalSessionIds = new Set(queuedDigitalSessionsToSync.map((session) => session.client_id))
      const queuedDigitalSnapshotIds = new Set(queuedDigitalSnapshotsToSync.map((snapshot) => snapshot.client_id))
      const uploadErrors: string[] = []

      const uploadedCaptures: AtlasCapture[] = []
      const remainingCaptures: QueuedCapture[] = []

      for (const capture of queuedCapturesToSync) {
        try {
          uploadedCaptures.push(await uploadQueuedCapture(capture))
        } catch (error) {
          const message = humanError(error)
          uploadErrors.push(message)
          remainingCaptures.push({
            ...capture,
            attempts: capture.attempts + 1,
            last_error: message,
          })
        }
      }

      const uploadedCheckins: AtlasCheckin[] = []
      const downloadedSyncCaptures: AtlasCapture[] = []
      const downloadedSyncCheckins: AtlasCheckin[] = []
      const downloadedSyncBehaviors: AtlasBehavior[] = []
      const downloadedSyncBehaviorLogs: AtlasBehaviorLog[] = []
      const downloadedSyncPassiveSignals: AtlasPassiveSignal[] = []
      const downloadedSyncHealthSnapshots: AtlasHealthSnapshot[] = []
      const downloadedSyncDigitalSessions: AtlasDigitalSession[] = []
      const downloadedSyncDigitalSnapshots: AtlasDigitalActivitySnapshot[] = []
      const remainingCheckins: QueuedCheckin[] = []
      let syncDownloadSince = get().lastSyncAt
      for (const batch of chunkItems(queuedCheckinsToSync, CHECKIN_SYNC_BATCH_SIZE)) {
        try {
          const response = await syncDelta({
            device_id: atlasDeviceId(),
            last_sync_at: syncDownloadSince,
            checkins_to_upload: batch.map(stripQueueFields),
            metadata: { client: 'atlas-app', upload_kind: 'checkins', count: batch.length },
          })

          uploadedCheckins.push(...batch.map(queuedToCheckin))
          downloadedSyncCaptures.push(...response.captures_downloaded)
          downloadedSyncCheckins.push(...response.checkins_downloaded)
          downloadedSyncBehaviors.push(...(response.behaviors_downloaded ?? []))
          downloadedSyncBehaviorLogs.push(...(response.behavior_logs_downloaded ?? []))
          downloadedSyncPassiveSignals.push(...response.passive_signals_downloaded)
          downloadedSyncHealthSnapshots.push(...(response.health_snapshots_downloaded ?? []))
          downloadedSyncDigitalSessions.push(...(response.digital_sessions_downloaded ?? []))
          downloadedSyncDigitalSnapshots.push(...(response.digital_snapshots_downloaded ?? []))
          syncDownloadSince = response.synced_at
        } catch (error) {
          const message = humanError(error)
          uploadErrors.push(message)
          remainingCheckins.push(...batch.map((checkin) => ({
            ...checkin,
            attempts: checkin.attempts + 1,
            last_error: message,
          })))
        }
      }

      const uploadedBehaviors: AtlasBehavior[] = []
      const remainingBehaviors: QueuedBehavior[] = []
      for (const batch of chunkItems(queuedBehaviorsToSync, BEHAVIOR_SYNC_BATCH_SIZE)) {
        try {
          const response = await syncDelta({
            device_id: atlasDeviceId(),
            last_sync_at: syncDownloadSince,
            behaviors_to_upload: batch.map(behaviorForUpload),
            metadata: { client: 'atlas-app', upload_kind: 'behaviors', count: batch.length },
          })

          uploadedBehaviors.push(...batch.map(queuedToBehavior))
          downloadedSyncCaptures.push(...response.captures_downloaded)
          downloadedSyncCheckins.push(...response.checkins_downloaded)
          downloadedSyncBehaviors.push(...(response.behaviors_downloaded ?? []))
          downloadedSyncBehaviorLogs.push(...(response.behavior_logs_downloaded ?? []))
          downloadedSyncPassiveSignals.push(...response.passive_signals_downloaded)
          downloadedSyncHealthSnapshots.push(...(response.health_snapshots_downloaded ?? []))
          downloadedSyncDigitalSessions.push(...(response.digital_sessions_downloaded ?? []))
          downloadedSyncDigitalSnapshots.push(...(response.digital_snapshots_downloaded ?? []))
          syncDownloadSince = response.synced_at
        } catch (error) {
          const message = humanError(error)
          uploadErrors.push(message)
          remainingBehaviors.push(...batch.map((behavior) => ({
            ...behavior,
            attempts: behavior.attempts + 1,
            last_error: message,
          })))
        }
      }

      const uploadedBehaviorLogs: AtlasBehaviorLog[] = []
      const remainingBehaviorLogs: QueuedBehaviorLog[] = []
      for (const batch of chunkItems(queuedBehaviorLogsToSync, BEHAVIOR_LOG_SYNC_BATCH_SIZE)) {
        try {
          const response = await syncDelta({
            device_id: atlasDeviceId(),
            last_sync_at: syncDownloadSince,
            behavior_logs_to_upload: batch.map(stripQueueFields),
            metadata: { client: 'atlas-app', upload_kind: 'behavior_logs', count: batch.length },
          })

          uploadedBehaviorLogs.push(...batch.map(queuedToBehaviorLog))
          downloadedSyncCaptures.push(...response.captures_downloaded)
          downloadedSyncCheckins.push(...response.checkins_downloaded)
          downloadedSyncBehaviors.push(...(response.behaviors_downloaded ?? []))
          downloadedSyncBehaviorLogs.push(...(response.behavior_logs_downloaded ?? []))
          downloadedSyncPassiveSignals.push(...response.passive_signals_downloaded)
          downloadedSyncHealthSnapshots.push(...(response.health_snapshots_downloaded ?? []))
          downloadedSyncDigitalSessions.push(...(response.digital_sessions_downloaded ?? []))
          downloadedSyncDigitalSnapshots.push(...(response.digital_snapshots_downloaded ?? []))
          syncDownloadSince = response.synced_at
        } catch (error) {
          const message = humanError(error)
          uploadErrors.push(message)
          remainingBehaviorLogs.push(...batch.map((log) => ({
            ...log,
            attempts: log.attempts + 1,
            last_error: message,
          })))
        }
      }

      const uploadedPassiveSignals: AtlasPassiveSignal[] = []
      const remainingPassiveSignals: QueuedPassiveSignal[] = []
      for (const batch of chunkItems(queuedPassiveSignalsToSync, PASSIVE_SIGNAL_SYNC_BATCH_SIZE)) {
        try {
          const response = await syncDelta({
            device_id: atlasDeviceId(),
            last_sync_at: syncDownloadSince,
            passive_signals_to_upload: batch.map(stripQueueFields),
            metadata: { client: 'atlas-app', upload_kind: 'passive_signals', count: batch.length },
          })

          uploadedPassiveSignals.push(...batch.map(queuedToPassiveSignal))
          downloadedSyncCaptures.push(...response.captures_downloaded)
          downloadedSyncCheckins.push(...response.checkins_downloaded)
          downloadedSyncBehaviors.push(...(response.behaviors_downloaded ?? []))
          downloadedSyncBehaviorLogs.push(...(response.behavior_logs_downloaded ?? []))
          downloadedSyncPassiveSignals.push(...response.passive_signals_downloaded)
          downloadedSyncHealthSnapshots.push(...(response.health_snapshots_downloaded ?? []))
          downloadedSyncDigitalSessions.push(...(response.digital_sessions_downloaded ?? []))
          downloadedSyncDigitalSnapshots.push(...(response.digital_snapshots_downloaded ?? []))
          syncDownloadSince = response.synced_at
        } catch (error) {
          const message = humanError(error)
          uploadErrors.push(message)
          remainingPassiveSignals.push(...batch.map((signal) => ({
            ...signal,
            attempts: signal.attempts + 1,
            last_error: message,
          })))
        }
      }

      const uploadedHealthSnapshots: AtlasHealthSnapshot[] = []
      const remainingHealthSnapshots: QueuedHealthSnapshot[] = []
      for (const batch of chunkItems(queuedHealthSnapshotsToSync, HEALTH_SNAPSHOT_SYNC_BATCH_SIZE)) {
        try {
          const response = await syncDelta({
            device_id: atlasDeviceId(),
            last_sync_at: syncDownloadSince,
            health_snapshots_to_upload: batch.map(healthSnapshotForUpload),
            metadata: { client: 'atlas-app', upload_kind: 'health_snapshots', count: batch.length },
          })

          uploadedHealthSnapshots.push(...batch.map(queuedToHealthSnapshot))
          downloadedSyncCaptures.push(...response.captures_downloaded)
          downloadedSyncCheckins.push(...response.checkins_downloaded)
          downloadedSyncBehaviors.push(...(response.behaviors_downloaded ?? []))
          downloadedSyncBehaviorLogs.push(...(response.behavior_logs_downloaded ?? []))
          downloadedSyncPassiveSignals.push(...response.passive_signals_downloaded)
          downloadedSyncHealthSnapshots.push(...(response.health_snapshots_downloaded ?? []))
          downloadedSyncDigitalSessions.push(...(response.digital_sessions_downloaded ?? []))
          downloadedSyncDigitalSnapshots.push(...(response.digital_snapshots_downloaded ?? []))
          syncDownloadSince = response.synced_at
        } catch (error) {
          const message = humanError(error)
          uploadErrors.push(message)
          remainingHealthSnapshots.push(...batch.map((snapshot) => ({
            ...snapshot,
            attempts: snapshot.attempts + 1,
            last_error: message,
          })))
        }
      }

      const uploadedDigitalSessions: AtlasDigitalSession[] = []
      const remainingDigitalSessions: QueuedDigitalSession[] = []
      for (const batch of chunkItems(queuedDigitalSessionsToSync, DIGITAL_SESSION_SYNC_BATCH_SIZE)) {
        try {
          const response = await syncDelta({
            device_id: atlasDeviceId(),
            last_sync_at: syncDownloadSince,
            digital_sessions_to_upload: batch.map(digitalSessionForUpload),
            metadata: { client: 'atlas-app', upload_kind: 'digital_sessions', count: batch.length },
          })

          uploadedDigitalSessions.push(...batch.map(queuedToDigitalSession))
          downloadedSyncCaptures.push(...response.captures_downloaded)
          downloadedSyncCheckins.push(...response.checkins_downloaded)
          downloadedSyncBehaviors.push(...(response.behaviors_downloaded ?? []))
          downloadedSyncBehaviorLogs.push(...(response.behavior_logs_downloaded ?? []))
          downloadedSyncPassiveSignals.push(...response.passive_signals_downloaded)
          downloadedSyncHealthSnapshots.push(...(response.health_snapshots_downloaded ?? []))
          downloadedSyncDigitalSessions.push(...(response.digital_sessions_downloaded ?? []))
          downloadedSyncDigitalSnapshots.push(...(response.digital_snapshots_downloaded ?? []))
          syncDownloadSince = response.synced_at
        } catch (error) {
          const message = humanError(error)
          uploadErrors.push(message)
          remainingDigitalSessions.push(...batch.map((session) => ({
            ...session,
            attempts: session.attempts + 1,
            last_error: message,
          })))
        }
      }

      const uploadedDigitalSnapshots: AtlasDigitalActivitySnapshot[] = []
      const remainingDigitalSnapshots: QueuedDigitalActivitySnapshot[] = []
      for (const batch of chunkItems(queuedDigitalSnapshotsToSync, DIGITAL_SNAPSHOT_SYNC_BATCH_SIZE)) {
        try {
          const response = await syncDelta({
            device_id: atlasDeviceId(),
            last_sync_at: syncDownloadSince,
            digital_activity_snapshots_to_upload: batch.map(digitalSnapshotForUpload),
            metadata: { client: 'atlas-app', upload_kind: 'digital_activity_snapshots', count: batch.length },
          })

          uploadedDigitalSnapshots.push(...batch.map(queuedToDigitalActivitySnapshot))
          downloadedSyncCaptures.push(...response.captures_downloaded)
          downloadedSyncCheckins.push(...response.checkins_downloaded)
          downloadedSyncBehaviors.push(...(response.behaviors_downloaded ?? []))
          downloadedSyncBehaviorLogs.push(...(response.behavior_logs_downloaded ?? []))
          downloadedSyncPassiveSignals.push(...response.passive_signals_downloaded)
          downloadedSyncHealthSnapshots.push(...(response.health_snapshots_downloaded ?? []))
          downloadedSyncDigitalSessions.push(...(response.digital_sessions_downloaded ?? []))
          downloadedSyncDigitalSnapshots.push(...(response.digital_snapshots_downloaded ?? []))
          syncDownloadSince = response.synced_at
        } catch (error) {
          const message = humanError(error)
          uploadErrors.push(message)
          remainingDigitalSnapshots.push(...batch.map((snapshot) => ({
            ...snapshot,
            attempts: snapshot.attempts + 1,
            last_error: message,
          })))
        }
      }

      const [
        capturePage,
        checkinPage,
        behaviorPage,
        behaviorLogPage,
        signalPage,
        snapshotPage,
        digitalSessionPage,
        digitalSnapshotPage,
        missionResponse,
      ] = await Promise.all([
        listCaptures({ limit: 200 }),
        listCheckins({ limit: 100 }),
        listBehaviors({ limit: 200 }),
        listBehaviorLogs({ limit: 200 }),
        listPassiveSignals({ limit: 200 }),
        listHealthSnapshots({ limit: 90 }),
        listDigitalSessions({ limit: 200 }),
        listDigitalActivitySnapshots({ limit: 90 }),
        getTodayMission({ timezone: deviceTimezone() }),
      ])

      const completedAt = new Date().toISOString()
      set((state) => {
        const queuedCaptures = mergeQueuedCaptures([
          ...remainingCaptures,
          ...state.queuedCaptures.filter((capture) => !queuedCaptureIds.has(capture.client_id)),
        ])
        const queuedCheckins = mergeQueuedCheckins([
          ...remainingCheckins,
          ...state.queuedCheckins.filter((checkin) => !queuedCheckinIds.has(checkin.client_id)),
        ])
        const queuedBehaviors = mergeQueuedBehaviors([
          ...remainingBehaviors,
          ...state.queuedBehaviors.filter((behavior) => !queuedBehaviorIds.has(behavior.client_id)),
        ])
        const queuedBehaviorLogs = mergeQueuedBehaviorLogs([
          ...remainingBehaviorLogs,
          ...state.queuedBehaviorLogs.filter((log) => !queuedBehaviorLogIds.has(log.client_id)),
        ])
        const queuedPassiveSignals = mergeQueuedPassiveSignals([
          ...remainingPassiveSignals,
          ...state.queuedPassiveSignals.filter((signal) => !queuedPassiveSignalIds.has(signal.client_id)),
        ])
        const queuedHealthSnapshots = mergeQueuedHealthSnapshots([
          ...remainingHealthSnapshots,
          ...state.queuedHealthSnapshots.filter((snapshot) => !queuedHealthSnapshotIds.has(snapshot.client_id)),
        ])
        const queuedDigitalSessions = mergeQueuedDigitalSessions([
          ...remainingDigitalSessions,
          ...state.queuedDigitalSessions.filter((session) => !queuedDigitalSessionIds.has(session.client_id)),
        ])
        const queuedDigitalActivitySnapshots = mergeQueuedDigitalActivitySnapshots([
          ...remainingDigitalSnapshots,
          ...state.queuedDigitalActivitySnapshots.filter((snapshot) => !queuedDigitalSnapshotIds.has(snapshot.client_id)),
        ])
        const counts = localQueueCounts({
          queuedCaptures,
          queuedCheckins,
          queuedBehaviors,
          queuedBehaviorLogs,
          queuedPassiveSignals,
          queuedHealthSnapshots,
          queuedDigitalSessions,
          queuedDigitalActivitySnapshots,
        })
        const partialError = uploadErrors.length > 0
          ? partialSyncMessage(counts.total, uploadErrors)
          : null

        return {
          captures: mergeCaptures([
            ...state.captures,
            ...uploadedCaptures,
            ...downloadedSyncCaptures,
            ...capturePage.captures,
          ]),
          checkins: mergeCheckins([
            ...state.checkins,
            ...uploadedCheckins,
            ...downloadedSyncCheckins,
            ...checkinPage.checkins,
          ]),
          behaviors: mergeBehaviors([
            ...state.behaviors,
            ...uploadedBehaviors,
            ...downloadedSyncBehaviors,
            ...behaviorPage.behaviors,
          ]),
          behaviorLogs: mergeBehaviorLogs([
            ...state.behaviorLogs,
            ...uploadedBehaviorLogs,
            ...downloadedSyncBehaviorLogs,
            ...behaviorLogPage.behavior_logs,
          ]),
          passiveSignals: mergePassiveSignals([
            ...state.passiveSignals,
            ...uploadedPassiveSignals,
            ...downloadedSyncPassiveSignals,
            ...signalPage.passive_signals,
          ]),
          healthSnapshots: mergeHealthSnapshots([
            ...state.healthSnapshots,
            ...uploadedHealthSnapshots,
            ...downloadedSyncHealthSnapshots,
            ...snapshotPage.health_snapshots,
          ]),
          digitalSessions: mergeDigitalSessions([
            ...state.digitalSessions,
            ...uploadedDigitalSessions,
            ...downloadedSyncDigitalSessions,
            ...digitalSessionPage.digital_sessions,
          ]),
          digitalActivitySnapshots: mergeDigitalActivitySnapshots([
            ...state.digitalActivitySnapshots,
            ...uploadedDigitalSnapshots,
            ...downloadedSyncDigitalSnapshots,
            ...digitalSnapshotPage.digital_activity_snapshots,
          ]),
          queuedCaptures,
          queuedCheckins,
          queuedBehaviors,
          queuedBehaviorLogs,
          queuedPassiveSignals,
          queuedHealthSnapshots,
          queuedDigitalSessions,
          queuedDigitalActivitySnapshots,
          mission: missionResponse.mission,
          lastSyncAt: partialError ? state.lastSyncAt : (syncDownloadSince ?? completedAt),
          serverReachable: true,
          syncing: false,
          lastError: partialError,
        }
      })
      await persist(get())
    } catch (error) {
      set({
        serverReachable: error instanceof AtlasApiError,
        syncing: false,
        lastError: humanError(error),
      })
      await persist(get())
    }
  },

  refresh: async () => {
    await get().sync()
  },

  loadMission: async () => {
    try {
      const response = await getTodayMission({ timezone: deviceTimezone() })
      set({ mission: response.mission, serverReachable: true, lastError: null })
      await persist(get())
    } catch (error) {
      set({ serverReachable: false, lastError: humanError(error) })
      await persist(get())
    }
  },

  requestHealthKitPermissions: async () => {
    set({ healthKitSyncing: true, lastError: null })

    try {
      const result = await requestAllHealthKitPermissions()
      set((state) => ({
        healthKit: {
          ...state.healthKit,
          available: result.available,
          enabled: result.enabled,
          lastError: result.authorizationRequestProcessed
            ? null
            : result.available
              ? 'Solicitação do app Saúde não foi concluída.'
              : 'HealthKit só funciona no development build/EAS.',
          requestedTypeCount: result.requestedTypeCount,
          debugTrail: result.debugTrail,
          historyBackfilled: result.historyBackfilled,
          historyBackfilledAt: result.historyBackfilledAt,
          backgroundConfiguredAt: result.backgroundConfiguredAt,
        },
        healthKitSyncing: false,
      }))
      await persist(get())
      if (result.enabled) {
        void get().syncHealthKit()
      }
    } catch (error) {
      const healthKitStatus = await getHealthKitLocalStatus()
      set((state) => ({
        healthKit: {
          ...state.healthKit,
          lastError: humanError(error),
          debugTrail: healthKitStatus.debugTrail,
          historyBackfilled: healthKitStatus.historyBackfilled,
          historyBackfilledAt: healthKitStatus.historyBackfilledAt,
          backgroundConfiguredAt: healthKitStatus.backgroundConfiguredAt,
        },
        healthKitSyncing: false,
        lastError: humanError(error),
      }))
      await persist(get())
    }
  },

  syncHealthKit: async () => {
    if (get().healthKitSyncing) return

    set({ healthKitSyncing: true, lastError: null })

    try {
      const hadHistoryBackfilled = get().healthKit.historyBackfilled
      const repairPending = await healthDataRepairPending()
      const result = await collectHealthKitSignals()
      const healthKitStatus = await getHealthKitLocalStatus()
      const currentState = get()
      const existingPassiveSignals = mergePassiveSignals([
        ...currentState.passiveSignals,
        ...currentState.queuedPassiveSignals.map(queuedToPassiveSignal),
      ])
      const resultSignals = mergePassiveSignalInputs([
        ...result.signals,
        ...sleepDurationInvalidationsForDeletedStages(result.signals, existingPassiveSignals),
        ...(repairPending ? legacyHealthSignalTombstones(existingPassiveSignals) : []),
      ])
      const queued = resultSignals.map((signal): QueuedPassiveSignal => ({
        ...signal,
        attempts: 0,
        last_error: null,
      }))
      const passiveSignals = mergePassiveSignals([
        ...existingPassiveSignals,
        ...queued.map(queuedToPassiveSignal),
      ])
      const checkins = mergeCheckins([
        ...currentState.checkins,
        ...currentState.queuedCheckins.map(queuedToCheckin),
      ])
      const digitalActivitySnapshots = visibleDigitalActivitySnapshots(currentState)
      const existingHealthSnapshots = visibleHealthSnapshots(currentState)
      const snapshotDates = healthSnapshotDatesForHealthKitSync({
        signals: resultSignals,
        existingSignals: existingPassiveSignals,
        refreshDays: repairPending || !hadHistoryBackfilled ? HEALTH_SNAPSHOT_BACKFILL_DAYS : HEALTH_SNAPSHOT_REFRESH_DAYS,
      })
      const queuedSnapshots = buildHealthSnapshotInputs({
        healthSignals: passiveSignals.filter((signal) => signal.source === 'healthkit'),
        allSignals: passiveSignals,
        digitalActivitySnapshots,
        checkins,
        dates: snapshotDates,
      }).map((snapshot): QueuedHealthSnapshot => ({
        ...preserveExistingValidSleepSnapshot(snapshot, existingHealthSnapshots),
        attempts: 0,
        last_error: null,
      }))

      set((state) => ({
        queuedPassiveSignals: mergeQueuedPassiveSignals([...queued, ...state.queuedPassiveSignals]),
        queuedHealthSnapshots: mergeQueuedHealthSnapshots([...queuedSnapshots, ...state.queuedHealthSnapshots]),
        healthKit: {
          ...state.healthKit,
          available: true,
          enabled: state.healthKit.enabled || result.signalCount > 0,
          lastSyncAt: result.syncedAt ?? state.healthKit.lastSyncAt,
          lastSignalCount: result.signalCount,
          lastError: result.errors[0] ?? null,
          debugTrail: healthKitStatus.debugTrail,
          historyBackfilled: healthKitStatus.historyBackfilled,
          historyBackfilledAt: healthKitStatus.historyBackfilledAt,
          backgroundConfiguredAt: healthKitStatus.backgroundConfiguredAt,
        },
        healthKitSyncing: false,
      }))
      await persist(get())
      if (repairPending) {
        await markHealthDataRepairApplied()
      }
      void get().sync()
    } catch (error) {
      const healthKitStatus = await getHealthKitLocalStatus()
      set((state) => ({
        healthKit: {
          ...state.healthKit,
          lastError: humanError(error),
          debugTrail: healthKitStatus.debugTrail,
          historyBackfilled: healthKitStatus.historyBackfilled,
          historyBackfilledAt: healthKitStatus.historyBackfilledAt,
          backgroundConfiguredAt: healthKitStatus.backgroundConfiguredAt,
        },
        healthKitSyncing: false,
        lastError: humanError(error),
      }))
      await persist(get())
    }
  },

  requestScreenTimePermissions: async () => {
    if (get().screenTimeSyncing) return

    set({ screenTimeSyncing: true, lastError: null })

    try {
      const screenTime = await requestScreenTimeAuthorization()
      set({ screenTime, screenTimeSyncing: false })
      await persist(get())
    } catch (error) {
      const screenTimeStatus = await getScreenTimeLocalStatus()
      set((state) => ({
        screenTime: {
          ...screenTimeStatus,
          lastError: humanError(error),
          debugTrail: [
            ...state.screenTime.debugTrail,
            ...screenTimeStatus.debugTrail,
          ].slice(-12),
        },
        screenTimeSyncing: false,
        lastError: humanError(error),
      }))
      await persist(get())
    }
  },

  configureScreenTime: async () => {
    if (get().screenTimeSyncing) return

    set({ screenTimeSyncing: true, lastError: null })

    try {
      const screenTime = await configureScreenTimeMonitoring()
      set({ screenTime, screenTimeSyncing: false })
      await persist(get())
    } catch (error) {
      const screenTimeStatus = await getScreenTimeLocalStatus()
      set((state) => ({
        screenTime: {
          ...screenTimeStatus,
          lastError: humanError(error),
          debugTrail: [
            ...state.screenTime.debugTrail,
            ...screenTimeStatus.debugTrail,
          ].slice(-12),
        },
        screenTimeSyncing: false,
        lastError: humanError(error),
      }))
      await persist(get())
    }
  },

  syncScreenTime: async () => {
    if (get().screenTimeSyncing) return

    set({ screenTimeSyncing: true, lastError: null })

    try {
      const result = await collectScreenTimeDigitalActivity()
      const queuedSessions = result.sessions.map((session): QueuedDigitalSession => ({
        ...session,
        attempts: 0,
        last_error: null,
      }))
      const queuedSnapshots = result.snapshots.map((snapshot): QueuedDigitalActivitySnapshot => ({
        ...snapshot,
        attempts: 0,
        last_error: null,
      }))

      set((state) => ({
        queuedDigitalSessions: mergeQueuedDigitalSessions([
          ...queuedSessions,
          ...state.queuedDigitalSessions,
        ]),
        queuedDigitalActivitySnapshots: mergeQueuedDigitalActivitySnapshots([
          ...queuedSnapshots,
          ...state.queuedDigitalActivitySnapshots,
        ]),
        screenTime: result.status,
        screenTimeSyncing: false,
      }))
      await persist(get())
      void get().sync()
    } catch (error) {
      const screenTimeStatus = await getScreenTimeLocalStatus()
      set((state) => ({
        screenTime: {
          ...screenTimeStatus,
          lastError: humanError(error),
          debugTrail: [
            ...state.screenTime.debugTrail,
            ...screenTimeStatus.debugTrail,
          ].slice(-12),
        },
        screenTimeSyncing: false,
        lastError: humanError(error),
      }))
      await persist(get())
    }
  },

  createAudioCapture: async (input) => {
    const clientId = newClientId()
    const capturedAt = input.capturedAt ?? new Date().toISOString()
    const fileUri = await persistCaptureFile(input.fileUri, LOCAL_AUDIO_DIR, `${clientId}.m4a`)
    const queued: QueuedCapture = {
      client_id: clientId,
      kind: 'audio',
      domain: input.domain,
      file_uri: fileUri,
      file_name: fileNameFor(fileUri, clientId, 'm4a'),
      mime_type: 'audio/m4a',
      content_duration_ms: input.durationMs ?? null,
      captured_at: capturedAt,
      captured_timezone: input.capturedTimezone ?? deviceTimezone(),
      captured_lat: input.capturedLat ?? null,
      captured_lng: input.capturedLng ?? null,
      metadata: input.metadata ?? {},
      attempts: 0,
      last_error: null,
    }

    set((state) => ({ queuedCaptures: [queued, ...state.queuedCaptures] }))
    await persist(get())
    void get().sync()

    return clientId
  },

  createPhotoCapture: async (input) => {
    const clientId = newClientId()
    const fileUri = await persistCaptureFile(input.fileUri, LOCAL_PHOTO_DIR, `${clientId}.jpg`)
    const queued: QueuedCapture = {
      client_id: clientId,
      kind: 'photo',
      domain: input.domain,
      file_uri: fileUri,
      file_name: fileNameFor(fileUri, clientId, 'jpg'),
      mime_type: input.mimeType ?? 'image/jpeg',
      captured_at: input.capturedAt ?? new Date().toISOString(),
      captured_timezone: input.capturedTimezone ?? deviceTimezone(),
      captured_lat: input.capturedLat ?? null,
      captured_lng: input.capturedLng ?? null,
      metadata: input.metadata ?? {},
      attempts: 0,
      last_error: null,
    }

    set((state) => ({ queuedCaptures: [queued, ...state.queuedCaptures] }))
    await persist(get())
    void get().sync()

    return clientId
  },

  createTextCapture: async (input) => {
    const clientId = newClientId()
    const queued: QueuedCapture = {
      client_id: clientId,
      kind: 'text',
      domain: input.domain,
      content_text: input.text,
      captured_at: input.capturedAt ?? new Date().toISOString(),
      captured_timezone: input.capturedTimezone ?? deviceTimezone(),
      captured_lat: input.capturedLat ?? null,
      captured_lng: input.capturedLng ?? null,
      metadata: input.metadata ?? {},
      attempts: 0,
      last_error: null,
    }

    set((state) => ({ queuedCaptures: [queued, ...state.queuedCaptures] }))
    await persist(get())
    void get().sync()

    return clientId
  },

  createCheckin: async (input) => {
    const clientId = newClientId()
    const queued: QueuedCheckin = {
      client_id: clientId,
      state: input.state,
      energy_level: clampLevel(input.energyLevel),
      mood_level: clampLevel(input.moodLevel),
      note: input.note ?? null,
      recorded_at: new Date().toISOString(),
      recorded_timezone: deviceTimezone(),
      metadata: input.metadata ?? {},
      attempts: 0,
      last_error: null,
    }
    const currentState = get()
    const passiveSignals = mergePassiveSignals([
      ...currentState.passiveSignals,
      ...currentState.queuedPassiveSignals.map(queuedToPassiveSignal),
    ])
    const checkins = mergeCheckins([
      ...currentState.checkins,
      ...currentState.queuedCheckins.map(queuedToCheckin),
      queuedToCheckin(queued),
    ])
    const digitalActivitySnapshots = visibleDigitalActivitySnapshots(currentState)
    const existingHealthSnapshots = visibleHealthSnapshots(currentState)
    const queuedSnapshots = buildHealthSnapshotInputs({
      healthSignals: passiveSignals.filter((signal) => signal.source === 'healthkit'),
      allSignals: passiveSignals,
      digitalActivitySnapshots,
      checkins,
      dates: [localDateKey(new Date(queued.recorded_at))],
    }).map((snapshot): QueuedHealthSnapshot => ({
      ...preserveExistingValidSleepSnapshot(snapshot, existingHealthSnapshots),
      attempts: 0,
      last_error: null,
    }))

    set((state) => ({
      queuedCheckins: [queued, ...state.queuedCheckins],
      queuedHealthSnapshots: mergeQueuedHealthSnapshots([...queuedSnapshots, ...state.queuedHealthSnapshots]),
    }))
    await persist(get())
    void get().sync()

    return clientId
  },

  createPassiveSignal: async (input) => {
    const clientId = newClientId()
    const queued: QueuedPassiveSignal = {
      client_id: clientId,
      source: input.source,
      signal_type: input.signalType,
      value_numeric: input.valueNumeric ?? null,
      value_text: input.valueText ?? null,
      unit: input.unit ?? null,
      started_at: input.startedAt ?? new Date().toISOString(),
      ended_at: input.endedAt ?? null,
      recorded_timezone: deviceTimezone(),
      metadata: input.metadata ?? {},
      attempts: 0,
      last_error: null,
    }

    set((state) => ({ queuedPassiveSignals: [queued, ...state.queuedPassiveSignals] }))
    await persist(get())
    void get().sync()

    return clientId
  },

  createBehavior: async (input) => {
    const clientId = newClientId()
    const name = input.name.trim()
    if (!name) {
      throw new Error('Informe o fator da Bitácula.')
    }

    if (input.showInMorningBriefing !== false) {
      const activeCount = visibleBehaviors(get()).filter((behavior) => (
        !behavior.archived_at && behavior.show_in_morning_briefing
      )).length

      if (activeCount >= 12) {
        throw new Error('A Bitácula aceita no máximo 12 fatores ativos no briefing.')
      }
    }

    const slug = uniqueBehaviorSlug(name, get())
    const normalizedFactor = normalizeBehaviorFactor(name)
    const factorPayload = behaviorFactorPayload(normalizedFactor)
    const queued: QueuedBehavior = {
      client_id: clientId,
      name,
      slug,
      category: canonicalBehaviorCategory(input.category ?? normalizedFactor?.category ?? 'outro'),
      input_type: input.inputType ?? 'yes_no',
      question_text: input.questionText?.trim() || normalizedFactor?.questionText || `${name} aconteceu ontem?`,
      default_value: 'no',
      parent_factor: input.parentFactor ?? factorPayload.parent_factor ?? null,
      factor_condition: input.factorCondition ?? factorPayload.factor_condition ?? null,
      target_outcomes: input.targetOutcomes ?? factorPayload.target_outcomes ?? [],
      expected_lag: input.expectedLag ?? factorPayload.expected_lag ?? null,
      expected_direction: input.expectedDirection ?? factorPayload.expected_direction ?? null,
      granularity_level: input.granularityLevel ?? factorPayload.granularity_level ?? 'binary',
      sensitivity_level: input.sensitivityLevel ?? factorPayload.sensitivity_level ?? 'normal',
      derived_from: input.derivedFrom ?? factorPayload.derived_from ?? {},
      operator_confirmed: input.operatorConfirmed ?? factorPayload.operator_confirmed ?? true,
      created_by: 'operator',
      source_capture_ids: [],
      activation_rules: {},
      lifecycle_status: input.lifecycleStatus ?? (input.showInMorningBriefing === false ? 'manual_only' : 'active'),
      paused_until: null,
      last_prompted_at: null,
      prompt_cadence_days: 1,
      auto_suppress_reason: null,
      show_in_morning_briefing: input.showInMorningBriefing ?? isPromptableLifecycle(input.lifecycleStatus ?? 'active'),
      priority_score: Date.now(),
      relational_privacy: input.relationalPrivacy ?? false,
      activated_at: new Date().toISOString(),
      archived_at: null,
      metadata: input.metadata ?? {},
      attempts: 0,
      last_error: null,
    }

    set((state) => ({ queuedBehaviors: mergeQueuedBehaviors([queued, ...state.queuedBehaviors]) }))
    await persist(get())
    void get().sync()

    return clientId
  },

  updateBehavior: async (clientId, patch) => {
    const state = get()
    const current = visibleBehaviors(state).find((behavior) => behavior.client_id === clientId)
    if (!current) {
      throw new Error('Fator não encontrado.')
    }

    const nextLifecycle = patch.lifecycleStatus ?? current.lifecycle_status
    const nextShowInBriefing = patch.showInMorningBriefing ?? isPromptableLifecycle(nextLifecycle)
    const serverPatch = {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.questionText !== undefined ? { question_text: patch.questionText.trim() } : {}),
      ...(patch.category !== undefined ? { category: canonicalBehaviorCategory(patch.category) } : {}),
      ...(patch.lifecycleStatus !== undefined ? { lifecycle_status: patch.lifecycleStatus } : {}),
      ...(patch.pausedUntil !== undefined ? { paused_until: patch.pausedUntil } : {}),
      ...(patch.autoSuppressReason !== undefined ? { auto_suppress_reason: patch.autoSuppressReason } : {}),
      ...(patch.archivedAt !== undefined ? { archived_at: patch.archivedAt } : {}),
      show_in_morning_briefing: nextShowInBriefing,
      ...(patch.metadata !== undefined ? { metadata: { ...current.metadata, ...patch.metadata } } : {}),
    }

    const applyLocal = (behavior: AtlasBehavior): AtlasBehavior => ({
      ...behavior,
      ...(serverPatch.name !== undefined ? { name: serverPatch.name } : {}),
      ...(serverPatch.question_text !== undefined ? { question_text: serverPatch.question_text } : {}),
      ...(serverPatch.category !== undefined ? { category: canonicalBehaviorCategory(serverPatch.category) } : {}),
      ...(serverPatch.lifecycle_status !== undefined ? { lifecycle_status: serverPatch.lifecycle_status } : {}),
      ...(serverPatch.paused_until !== undefined ? { paused_until: serverPatch.paused_until } : {}),
      ...(serverPatch.auto_suppress_reason !== undefined ? { auto_suppress_reason: serverPatch.auto_suppress_reason } : {}),
      ...(serverPatch.archived_at !== undefined ? { archived_at: serverPatch.archived_at } : {}),
      show_in_morning_briefing: serverPatch.show_in_morning_briefing,
      metadata: serverPatch.metadata ?? behavior.metadata,
      updated_at: new Date().toISOString(),
    })

    set((local) => ({
      behaviors: local.behaviors.map((behavior) => behavior.client_id === clientId ? applyLocal(behavior) : behavior),
      queuedBehaviors: local.queuedBehaviors.map((behavior) => behavior.client_id === clientId
        ? {
            ...behavior,
            ...(serverPatch.name !== undefined ? { name: serverPatch.name } : {}),
            ...(serverPatch.question_text !== undefined ? { question_text: serverPatch.question_text } : {}),
            ...(serverPatch.category !== undefined ? { category: canonicalBehaviorCategory(serverPatch.category) } : {}),
            ...(serverPatch.lifecycle_status !== undefined ? { lifecycle_status: serverPatch.lifecycle_status } : {}),
            ...(serverPatch.paused_until !== undefined ? { paused_until: serverPatch.paused_until } : {}),
            ...(serverPatch.auto_suppress_reason !== undefined ? { auto_suppress_reason: serverPatch.auto_suppress_reason } : {}),
            ...(serverPatch.archived_at !== undefined ? { archived_at: serverPatch.archived_at } : {}),
            show_in_morning_briefing: serverPatch.show_in_morning_briefing,
            metadata: serverPatch.metadata ?? behavior.metadata,
          }
        : behavior),
    }))
    await persist(get())

    if (!current.id.startsWith(LOCAL_ID_PREFIX)) {
      const updated = await patchServerBehavior(current.id, serverPatch)
      set((local) => ({ behaviors: mergeBehaviors([updated, ...local.behaviors]) }))
      await persist(get())
    }
  },

  logBehavior: async (input) => {
    const logDate = input.logDate ?? localDateKey(new Date())
    const clientId = deterministicUuid(`behavior_log:${input.behaviorClientId}:${logDate}`)
    const queued: QueuedBehaviorLog = {
      client_id: clientId,
      behavior_client_id: input.behaviorClientId,
      log_date: logDate,
      value: input.value,
      numeric_value: input.numericValue ?? numericValueForBehavior(input.value),
      note: input.note ?? null,
      occurred_at: input.occurredAt ?? null,
      occurred_timezone: input.occurredAt ? deviceTimezone() : null,
      quantity_numeric: input.quantityNumeric ?? null,
      quantity_unit: input.quantityUnit ?? null,
      intensity: input.intensity ?? null,
      context: input.context ?? {},
      recorded_at: new Date().toISOString(),
      recorded_timezone: deviceTimezone(),
      source: input.source ?? 'morning_briefing',
      source_capture_id: null,
      auto_marked: false,
      confirmed_by_operator: true,
      confidence: null,
      inferred_by: null,
      consent_snapshot_id: null,
      reverted_at: null,
      metadata: input.metadata ?? {},
      attempts: 0,
      last_error: null,
    }

    set((state) => ({ queuedBehaviorLogs: mergeQueuedBehaviorLogs([queued, ...state.queuedBehaviorLogs]) }))
    await persist(get())
    void get().sync()

    return clientId
  },

  updateCapture: async (id, patch) => {
    if (id.startsWith(LOCAL_ID_PREFIX)) {
      const clientId = id.slice(LOCAL_ID_PREFIX.length)
      let updated: QueuedCapture | null = null

      set((state) => ({
        queuedCaptures: state.queuedCaptures.map((capture) => {
          if (capture.client_id !== clientId) return capture
          updated = {
            ...capture,
            domain: patch.domain ?? capture.domain,
            content_text: patch.content_text === undefined ? capture.content_text : patch.content_text,
            metadata: patch.metadata ?? capture.metadata,
          }
          return updated
        }),
      }))

      await persist(get())
      return updated ? queuedToCapture(updated) : null
    }

    const previous = get().captures
    set((state) => ({
      captures: state.captures.map((capture) => (
        capture.id === id ? { ...capture, ...patch, updated_at: new Date().toISOString() } : capture
      )),
    }))

    try {
      const updated = await patchCapture(id, patch)
      set((state) => ({ captures: mergeCaptures([...state.captures, updated]) }))
      await persist(get())
      return updated
    } catch (error) {
      set({ captures: previous, lastError: humanError(error), serverReachable: error instanceof AtlasApiError })
      await persist(get())
      return null
    }
  },

  retryTranscription: async (id) => {
    if (id.startsWith(LOCAL_ID_PREFIX)) {
      set({ lastError: 'A captura local precisa sincronizar antes do retry.' })
      return null
    }

    const previous = get().captures
    set((state) => ({
      captures: state.captures.map((capture) => (
        capture.id === id
          ? {
              ...capture,
              transcription_status: 'pending',
              transcription_error: null,
              updated_at: new Date().toISOString(),
            }
          : capture
      )),
    }))

    try {
      const updated = await retryCaptureTranscription(id)
      set((state) => ({ captures: mergeCaptures([...state.captures, updated]), serverReachable: true, lastError: null }))
      await persist(get())
      return updated
    } catch (error) {
      set({ captures: previous, lastError: humanError(error), serverReachable: error instanceof AtlasApiError })
      await persist(get())
      return null
    }
  },

  triageCapture: async (id, input) => {
    if (id.startsWith(LOCAL_ID_PREFIX)) {
      set({ lastError: 'A captura local precisa sincronizar antes da triagem.' })
      return null
    }

    try {
      const result = await triageServerCapture(id, input)
      set((state) => ({
        captures: mergeCaptures([...state.captures, result.capture]),
        serverReachable: true,
        lastError: null,
      }))
      await persist(get())
      return result
    } catch (error) {
      set({ lastError: humanError(error), serverReachable: error instanceof AtlasApiError })
      await persist(get())
      return null
    }
  },

  clarifyCapture: async (id) => {
    if (id.startsWith(LOCAL_ID_PREFIX)) {
      set({ lastError: 'A captura local precisa sincronizar antes do aclaramento.' })
      return null
    }

    try {
      const result = await clarifyServerCapture(id)
      set((state) => ({
        captures: mergeCaptures([...state.captures, result.capture]),
        serverReachable: true,
        lastError: null,
      }))
      await persist(get())
      return result.capture
    } catch (error) {
      set({ lastError: humanError(error), serverReachable: error instanceof AtlasApiError })
      await persist(get())
      return null
    }
  },

  deleteCapture: async (id) => {
    if (id.startsWith(LOCAL_ID_PREFIX)) {
      const clientId = id.slice(LOCAL_ID_PREFIX.length)
      set((state) => ({ queuedCaptures: state.queuedCaptures.filter((capture) => capture.client_id !== clientId) }))
      await persist(get())
      return true
    }

    const previous = get().captures
    set((state) => ({ captures: state.captures.filter((capture) => capture.id !== id) }))

    try {
      await deleteServerCapture(id)
      await persist(get())
      return true
    } catch (error) {
      set({ captures: previous, lastError: humanError(error), serverReachable: false })
      await persist(get())
      return false
    }
  },
}))

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

function capturePrivacy(metadata: Record<string, unknown>): {
  sensitivity: InboxItem['sensitivity']
  label: string | null
  externalAiAllowed: boolean | null
} {
  const privacy = metadata.privacy && typeof metadata.privacy === 'object' && !Array.isArray(metadata.privacy)
    ? metadata.privacy as Record<string, unknown>
    : {}
  const sensitivity = typeof privacy.sensitivity === 'string'
    ? privacy.sensitivity
    : typeof metadata.sensitivity === 'string'
      ? metadata.sensitivity
      : null
  const label = sensitivity === 'sensitive'
    ? 'SENSÍVEL'
    : sensitivity === 'private'
      ? 'PRIVADO'
      : sensitivity === 'normal'
        ? 'NORMAL'
        : null
  const externalAiAllowed = typeof privacy.external_ai_allowed === 'boolean'
    ? privacy.external_ai_allowed
    : null

  return { sensitivity, label, externalAiAllowed }
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

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function startOfLocalDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

async function uploadQueuedCapture(capture: QueuedCapture): Promise<AtlasCapture> {
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

function queuedToCapture(capture: QueuedCapture): AtlasCapture {
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${capture.client_id}`,
    client_id: capture.client_id,
    kind: capture.kind,
    domain: capture.domain,
    content_text: capture.content_text ?? null,
    content_file_path: capture.file_uri ?? null,
    content_file_exists: Boolean(capture.file_uri),
    content_file_integrity: capture.file_uri ? 'available' : 'missing',
    content_duration_ms: capture.content_duration_ms ?? null,
    content_size_bytes: null,
    content_sha256: null,
    content_mime_type: capture.mime_type ?? null,
    transcription_status: capture.kind === 'audio' ? 'pending' : 'na',
    transcription_engine: null,
    transcription_error: capture.last_error ?? null,
    captured_at: capture.captured_at,
    captured_timezone: capture.captured_timezone,
    captured_lat: capture.captured_lat ?? null,
    captured_lng: capture.captured_lng ?? null,
    pre_capture_digital_context: {},
    metadata: { ...(capture.metadata ?? {}), local: true, local_attempts: capture.attempts },
    created_at: capture.captured_at,
    updated_at: now,
    deleted_at: null,
  }
}

function queuedToCheckin(checkin: QueuedCheckin): AtlasCheckin {
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${checkin.client_id}`,
    client_id: checkin.client_id,
    state: checkin.state,
    energy_level: checkin.energy_level,
    mood_level: checkin.mood_level,
    note: checkin.note ?? null,
    recorded_at: checkin.recorded_at,
    recorded_timezone: checkin.recorded_timezone,
    metadata: { ...(checkin.metadata ?? {}), local: true },
    created_at: checkin.recorded_at,
    updated_at: now,
    deleted_at: null,
  }
}

function queuedToPassiveSignal(signal: QueuedPassiveSignal): AtlasPassiveSignal {
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${signal.client_id}`,
    client_id: signal.client_id,
    source: signal.source,
    signal_type: signal.signal_type,
    value_numeric: signal.value_numeric ?? null,
    value_text: signal.value_text ?? null,
    unit: signal.unit ?? null,
    started_at: signal.started_at,
    ended_at: signal.ended_at ?? null,
    recorded_timezone: signal.recorded_timezone,
    metadata: { ...(signal.metadata ?? {}), local: true },
    created_at: signal.started_at,
    updated_at: now,
    deleted_at: signal.deleted_at ?? null,
  }
}

function queuedToHealthSnapshot(input: QueuedHealthSnapshot): AtlasHealthSnapshot {
  const snapshot = sanitizeQueuedHealthSnapshotSleep(input)
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${snapshot.client_id}`,
    client_id: snapshot.client_id,
    source: snapshot.source,
    snapshot_date: snapshot.snapshot_date,
    snapshot_timezone: snapshot.snapshot_timezone,
    computed_at: snapshot.computed_at,
    signal_count: snapshot.signal_count,
    readiness_score: snapshot.readiness_score ?? null,
    current_score: snapshot.current_score ?? null,
    body_score: snapshot.body_score ?? null,
    mind_score: snapshot.mind_score ?? null,
    drive_score: snapshot.drive_score ?? null,
    sleep_score: snapshot.sleep_score ?? null,
    autonomic_score: snapshot.autonomic_score ?? null,
    load_score: snapshot.load_score ?? null,
    subjective_score: snapshot.subjective_score ?? null,
    stability_score: snapshot.stability_score ?? null,
    confidence: snapshot.confidence ?? null,
    sleep_duration_hours: snapshot.sleep_duration_hours ?? null,
    sleep_efficiency: snapshot.sleep_efficiency ?? null,
    hrv_ms: snapshot.hrv_ms ?? null,
    resting_heart_rate_bpm: snapshot.resting_heart_rate_bpm ?? null,
    respiratory_rate: snapshot.respiratory_rate ?? null,
    wrist_temperature_c: snapshot.wrist_temperature_c ?? null,
    active_energy_kcal: snapshot.active_energy_kcal ?? null,
    basal_energy_kcal: snapshot.basal_energy_kcal ?? null,
    exercise_minutes: snapshot.exercise_minutes ?? null,
    stand_minutes: snapshot.stand_minutes ?? null,
    steps: snapshot.steps ?? null,
    walking_running_distance_m: snapshot.walking_running_distance_m ?? null,
    vo2max: snapshot.vo2max ?? null,
    body_mass_kg: snapshot.body_mass_kg ?? null,
    body_fat_percentage: snapshot.body_fat_percentage ?? null,
    lean_body_mass_kg: snapshot.lean_body_mass_kg ?? null,
    muscle_mass_percentage: snapshot.muscle_mass_percentage ?? null,
    body_mass_index: snapshot.body_mass_index ?? null,
    waist_circumference_cm: snapshot.waist_circumference_cm ?? null,
    energy_level: snapshot.energy_level ?? null,
    mood_level: snapshot.mood_level ?? null,
    state: snapshot.state ?? null,
    metrics: snapshot.metrics ?? {},
    readiness: snapshot.readiness ?? {},
    sleep: snapshot.sleep ?? {},
    recovery: snapshot.recovery ?? {},
    load: snapshot.load ?? {},
    subjective: snapshot.subjective ?? {},
    body: snapshot.body ?? {},
    metadata: { ...(snapshot.metadata ?? {}), local: true, last_error: snapshot.last_error ?? null },
    created_at: snapshot.computed_at,
    updated_at: now,
    deleted_at: null,
  }
}

function queuedToDigitalSession(session: QueuedDigitalSession): AtlasDigitalSession {
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${session.client_id}`,
    client_id: session.client_id,
    source: session.source,
    source_event_id: session.source_event_id ?? null,
    source_identifier: session.source_identifier,
    source_name: session.source_name,
    source_kind: session.source_kind,
    category_class_at_time: session.category_class_at_time ?? null,
    category_label_at_time: session.category_label_at_time ?? null,
    intentionality: session.intentionality ?? 'unknown',
    started_at: session.started_at,
    ended_at: session.ended_at,
    duration_seconds: session.duration_seconds,
    recorded_timezone: session.recorded_timezone,
    focus_mode_active: session.focus_mode_active ?? null,
    project_name: session.project_name ?? null,
    task_name: session.task_name ?? null,
    url_domain: session.url_domain ?? null,
    productivity_score: session.productivity_score ?? null,
    linked_capture_id: session.linked_capture_id ?? null,
    linked_decision_id: session.linked_decision_id ?? null,
    raw_payload: session.raw_payload ?? {},
    metadata: { ...(session.metadata ?? {}), local: true, last_error: session.last_error ?? null },
    created_at: session.started_at,
    updated_at: now,
    deleted_at: null,
  }
}

function queuedToDigitalActivitySnapshot(snapshot: QueuedDigitalActivitySnapshot): AtlasDigitalActivitySnapshot {
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${snapshot.client_id}`,
    client_id: snapshot.client_id,
    source: snapshot.source,
    snapshot_date: snapshot.snapshot_date,
    snapshot_timezone: snapshot.snapshot_timezone,
    computed_at: snapshot.computed_at,
    signal_count: snapshot.signal_count,
    total_screen_time_min: snapshot.total_screen_time_min ?? null,
    pickups_count: snapshot.pickups_count ?? null,
    first_offensive_use_min_after_wake: snapshot.first_offensive_use_min_after_wake ?? null,
    deep_work_sessions_count: snapshot.deep_work_sessions_count ?? null,
    deep_work_total_min: snapshot.deep_work_total_min ?? null,
    notifications_received: snapshot.notifications_received ?? null,
    notifications_actioned: snapshot.notifications_actioned ?? null,
    curated_input_min: snapshot.curated_input_min ?? null,
    algorithmic_input_min: snapshot.algorithmic_input_min ?? null,
    intentional_entertainment_min: snapshot.intentional_entertainment_min ?? null,
    default_entertainment_min: snapshot.default_entertainment_min ?? null,
    communication_primary_min: snapshot.communication_primary_min ?? null,
    communication_shallow_min: snapshot.communication_shallow_min ?? null,
    market_min: snapshot.market_min ?? null,
    focus_mode_active_min: snapshot.focus_mode_active_min ?? {},
    category_breakdown: snapshot.category_breakdown ?? {},
    source_breakdown: snapshot.source_breakdown ?? {},
    raw_rize_data: snapshot.raw_rize_data ?? {},
    raw_screentime_data: snapshot.raw_screentime_data ?? {},
    metadata: { ...(snapshot.metadata ?? {}), local: true, last_error: snapshot.last_error ?? null },
    created_at: snapshot.computed_at,
    updated_at: now,
    deleted_at: null,
  }
}

function queuedToBehavior(behavior: QueuedBehavior): AtlasBehavior {
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${behavior.client_id}`,
    client_id: behavior.client_id,
    name: behavior.name,
    slug: behavior.slug,
    category: canonicalBehaviorCategory(behavior.category),
    input_type: behavior.input_type,
    question_text: behavior.question_text,
    default_value: behavior.default_value ?? 'no',
    parent_factor: behavior.parent_factor ?? null,
    factor_condition: behavior.factor_condition ?? null,
    target_outcomes: behavior.target_outcomes ?? [],
    expected_lag: behavior.expected_lag ?? null,
    expected_direction: behavior.expected_direction ?? null,
    granularity_level: behavior.granularity_level ?? 'binary',
    sensitivity_level: behavior.sensitivity_level ?? 'normal',
    derived_from: behavior.derived_from ?? {},
    operator_confirmed: behavior.operator_confirmed ?? true,
    created_by: behavior.created_by ?? 'operator',
    source_capture_ids: behavior.source_capture_ids ?? [],
    activation_rules: behavior.activation_rules ?? {},
    lifecycle_status: behavior.lifecycle_status ?? 'active',
    paused_until: behavior.paused_until ?? null,
    last_prompted_at: behavior.last_prompted_at ?? null,
    prompt_cadence_days: behavior.prompt_cadence_days ?? 1,
    auto_suppress_reason: behavior.auto_suppress_reason ?? null,
    show_in_morning_briefing: behavior.show_in_morning_briefing ?? true,
    priority_score: behavior.priority_score ?? 0,
    streak_yes: behavior.streak_yes ?? 0,
    streak_no: behavior.streak_no ?? 0,
    total_yes_count: behavior.total_yes_count ?? 0,
    total_no_count: behavior.total_no_count ?? 0,
    relational_privacy: behavior.relational_privacy ?? false,
    activated_at: behavior.activated_at ?? now,
    archived_at: behavior.archived_at ?? null,
    promoted_to_object_type: behavior.promoted_to_object_type ?? null,
    promoted_to_object_id: behavior.promoted_to_object_id ?? null,
    metadata: { ...(behavior.metadata ?? {}), local: true, last_error: behavior.last_error ?? null },
    created_at: behavior.activated_at ?? now,
    updated_at: now,
    deleted_at: null,
  }
}

function queuedToBehaviorLog(log: QueuedBehaviorLog): AtlasBehaviorLog {
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${log.client_id}`,
    client_id: log.client_id,
    behavior_id: null,
    behavior_client_id: log.behavior_client_id,
    log_date: log.log_date,
    value: log.value,
    numeric_value: log.numeric_value ?? null,
    note: log.note ?? null,
    occurred_at: log.occurred_at ?? null,
    occurred_timezone: log.occurred_timezone ?? null,
    quantity_numeric: log.quantity_numeric ?? null,
    quantity_unit: log.quantity_unit ?? null,
    intensity: log.intensity ?? null,
    context: log.context ?? {},
    recorded_at: log.recorded_at,
    recorded_timezone: log.recorded_timezone,
    source: log.source,
    source_capture_id: log.source_capture_id ?? null,
    auto_marked: log.auto_marked ?? false,
    confirmed_by_operator: log.confirmed_by_operator ?? true,
    confidence: log.confidence ?? null,
    inferred_by: log.inferred_by ?? null,
    consent_snapshot_id: log.consent_snapshot_id ?? null,
    reverted_at: log.reverted_at ?? null,
    metadata: { ...(log.metadata ?? {}), local: true, last_error: log.last_error ?? null },
    created_at: log.recorded_at,
    updated_at: now,
    deleted_at: null,
  }
}

function mergeCaptures(captures: AtlasCapture[]): AtlasCapture[] {
  const byClientId = new Map<string, AtlasCapture>()

  for (const capture of captures) {
    if (capture.deleted_at) {
      byClientId.delete(capture.client_id)
      continue
    }

    const existing = byClientId.get(capture.client_id)
    if (!existing || new Date(capture.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(capture.client_id, capture)
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
  ))
}

function mergeCheckins(checkins: AtlasCheckin[]): AtlasCheckin[] {
  const byClientId = new Map<string, AtlasCheckin>()

  for (const checkin of checkins) {
    if (checkin.deleted_at) {
      byClientId.delete(checkin.client_id)
      continue
    }

    const existing = byClientId.get(checkin.client_id)
    if (!existing || new Date(checkin.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(checkin.client_id, checkin)
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  ))
}

function mergeBehaviors(behaviors: AtlasBehavior[]): AtlasBehavior[] {
  const byClientId = new Map<string, AtlasBehavior>()

  for (const behavior of behaviors) {
    if (behavior.deleted_at) {
      byClientId.delete(behavior.client_id)
      continue
    }

    const existing = byClientId.get(behavior.client_id)
    if (!existing || new Date(behavior.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(behavior.client_id, normalizeBehaviorModel(behavior))
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    (b.priority_score - a.priority_score)
    || (new Date(b.activated_at).getTime() - new Date(a.activated_at).getTime())
  ))
}

function normalizeBehaviorModel(behavior: AtlasBehavior): AtlasBehavior {
  return {
    ...behavior,
    category: canonicalBehaviorCategory(behavior.category),
    lifecycle_status: behavior.lifecycle_status ?? (behavior.show_in_morning_briefing === false ? 'manual_only' : 'active'),
    paused_until: behavior.paused_until ?? null,
    last_prompted_at: behavior.last_prompted_at ?? null,
    prompt_cadence_days: behavior.prompt_cadence_days ?? 1,
    auto_suppress_reason: behavior.auto_suppress_reason ?? null,
    target_outcomes: behavior.target_outcomes ?? [],
    derived_from: behavior.derived_from ?? {},
    source_capture_ids: behavior.source_capture_ids ?? [],
    activation_rules: behavior.activation_rules ?? {},
    metadata: behavior.metadata ?? {},
  }
}

function mergeBehaviorLogs(logs: AtlasBehaviorLog[]): AtlasBehaviorLog[] {
  const byClientId = new Map<string, AtlasBehaviorLog>()

  for (const log of logs) {
    if (log.deleted_at) {
      byClientId.delete(log.client_id)
      continue
    }

    const existing = byClientId.get(log.client_id)
    if (!existing || new Date(log.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(log.client_id, normalizeBehaviorLogModel(log))
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
  ))
}

function normalizeBehaviorLogModel(log: AtlasBehaviorLog): AtlasBehaviorLog {
  return {
    ...log,
    occurred_at: log.occurred_at ?? null,
    occurred_timezone: log.occurred_timezone ?? null,
    quantity_numeric: log.quantity_numeric ?? null,
    quantity_unit: log.quantity_unit ?? null,
    intensity: log.intensity ?? null,
    context: log.context ?? {},
    metadata: log.metadata ?? {},
  }
}

function mergePassiveSignals(signals: AtlasPassiveSignal[]): AtlasPassiveSignal[] {
  const byClientId = new Map<string, AtlasPassiveSignal>()

  for (const signal of signals) {
    if (signal.deleted_at) {
      byClientId.delete(signal.client_id)
      continue
    }

    const existing = byClientId.get(signal.client_id)
    if (!existing || new Date(signal.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(signal.client_id, signal)
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  ))
}

function mergeHealthSnapshots(snapshots: AtlasHealthSnapshot[]): AtlasHealthSnapshot[] {
  const byClientId = new Map<string, AtlasHealthSnapshot>()

  for (const snapshot of snapshots) {
    if (snapshot.deleted_at) {
      byClientId.delete(snapshot.client_id)
      continue
    }

    const existing = byClientId.get(snapshot.client_id)
    if (!existing || new Date(snapshot.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(snapshot.client_id, snapshot)
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
  ))
}

function mergeDigitalSessions(sessions: AtlasDigitalSession[]): AtlasDigitalSession[] {
  const byClientId = new Map<string, AtlasDigitalSession>()

  for (const session of sessions) {
    if (session.deleted_at) {
      byClientId.delete(session.client_id)
      continue
    }

    const existing = byClientId.get(session.client_id)
    if (!existing || new Date(session.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(session.client_id, session)
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  ))
}

function mergeDigitalActivitySnapshots(snapshots: AtlasDigitalActivitySnapshot[]): AtlasDigitalActivitySnapshot[] {
  const byClientId = new Map<string, AtlasDigitalActivitySnapshot>()

  for (const snapshot of snapshots) {
    if (snapshot.deleted_at) {
      byClientId.delete(snapshot.client_id)
      continue
    }

    const existing = byClientId.get(snapshot.client_id)
    if (!existing || new Date(snapshot.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(snapshot.client_id, snapshot)
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
  ))
}

function mergeQueuedCaptures(captures: QueuedCapture[]): QueuedCapture[] {
  return mergeQueuedByClientId(captures, (capture) => queueTime(capture.captured_at))
}

function mergeQueuedCheckins(checkins: QueuedCheckin[]): QueuedCheckin[] {
  return mergeQueuedByClientId(checkins, (checkin) => queueTime(checkin.recorded_at))
}

function mergeQueuedBehaviors(behaviors: QueuedBehavior[]): QueuedBehavior[] {
  return mergeQueuedByClientId(behaviors, (behavior) => queueTime(behavior.activated_at))
}

function mergeQueuedBehaviorLogs(logs: QueuedBehaviorLog[]): QueuedBehaviorLog[] {
  return mergeQueuedByClientId(logs, (log) => queueTime(log.log_date))
}

function passiveSignalMetricTime(signal: AtlasPassiveSignal, signalType = signal.signal_type): number {
  const iso = signalType === 'sleep_duration_hours' || signalType === 'sleep_stage' || signalType.startsWith('sleep_hr_') || signalType === 'sleep_breathing_disturbances'
    ? signal.ended_at ?? signal.started_at
    : signal.started_at
  return new Date(iso).getTime()
}

function mergePassiveSignalInputs(signals: StorePassiveSignalInput[]): StorePassiveSignalInput[] {
  const byClientId = new Map<string, StorePassiveSignalInput>()
  for (const signal of signals) {
    byClientId.set(signal.client_id, signal)
  }
  return [...byClientId.values()]
}

function sleepDurationInvalidationsForDeletedStages(
  signals: StorePassiveSignalInput[],
  existingSignals: AtlasPassiveSignal[],
): StorePassiveSignalInput[] {
  const regeneratedKeys = new Set(
    signals
      .filter((signal) => DERIVED_SLEEP_SIGNAL_TYPES.includes(signal.signal_type as typeof DERIVED_SLEEP_SIGNAL_TYPES[number]) && !signal.deleted_at)
      .map((signal) => {
        const dateKey = dateKeyForPassiveSignalInput(signal)
        return dateKey ? `${dateKey}:${signal.signal_type}` : null
      })
      .filter((key): key is string => key !== null),
  )
  const regeneratedSleepDates = new Set(
    signals
      .filter((signal) => signal.signal_type === 'sleep_duration_hours' && !signal.deleted_at)
      .map((signal) => dateKeyForPassiveSignalInput(signal))
      .filter((date): date is string => date !== null),
  )
  const existingByClientId = new Map(existingSignals.map((signal) => [signal.client_id, signal]))
  const invalidatedKeys = new Set<string>()
  const invalidations: StorePassiveSignalInput[] = []

  for (const signal of signals) {
    if (signal.signal_type !== 'sleep_stage' || !signal.deleted_at) continue

    const existing = existingByClientId.get(signal.client_id)
    const dateKey = existing
      ? localDateKey(new Date(passiveSignalInputMetricTime(existing)))
      : dateKeyForPassiveSignalInput(signal)

    if (!dateKey) continue

    for (const signalType of DERIVED_SLEEP_SIGNAL_TYPES) {
      const key = `${dateKey}:${signalType}`
      if (regeneratedKeys.has(key) || invalidatedKeys.has(key)) continue

      invalidatedKeys.add(key)
      invalidations.push(derivedSleepTombstone({
        dateKey,
        signalType,
        deletedAt: signal.deleted_at,
        timezone: existing?.recorded_timezone ?? signal.recorded_timezone,
        reason: 'sleep_stage_deleted',
        sourceClientId: signal.client_id,
      }))
    }
  }

  for (const existing of existingSignals) {
    if (existing.deleted_at) continue
    const signalType = existing.signal_type as typeof DERIVED_SLEEP_SIGNAL_TYPES[number]
    if (
      signalType === 'sleep_duration_hours'
      || !DERIVED_SLEEP_SIGNAL_TYPES.includes(signalType)
    ) {
      continue
    }

    const dateKey = localDateKey(new Date(passiveSignalMetricTime(existing, signalType)))
    const key = `${dateKey}:${signalType}`
    if (!regeneratedSleepDates.has(dateKey) || regeneratedKeys.has(key) || invalidatedKeys.has(key)) {
      continue
    }

    const deletedAt = new Date().toISOString()
    invalidatedKeys.add(key)
    invalidations.push(derivedSleepTombstone({
      dateKey,
      signalType,
      deletedAt,
      timezone: existing.recorded_timezone,
      reason: 'derived_missing_after_sleep_refresh',
      sourceClientId: existing.client_id,
    }))
  }

  return invalidations
}

function derivedSleepTombstone(input: {
  dateKey: string
  signalType: typeof DERIVED_SLEEP_SIGNAL_TYPES[number]
  deletedAt: string
  timezone: string
  reason: string
  sourceClientId: string
}): StorePassiveSignalInput {
  return {
    client_id: derivedSleepClientId(input.dateKey, input.signalType),
    source: 'healthkit',
    signal_type: input.signalType,
    value_numeric: null,
    value_text: null,
    unit: derivedSleepSignalUnit(input.signalType),
    started_at: input.deletedAt,
    ended_at: null,
    recorded_timezone: input.timezone,
    deleted_at: input.deletedAt,
    metadata: {
      healthkit: {
        kind: 'derived_tombstone',
        type: input.signalType,
        source_type: 'HKCategoryTypeIdentifierSleepAnalysis',
        date_key: input.dateKey,
        reason: input.reason,
        source_client_id: input.sourceClientId,
      },
    },
  }
}

function derivedSleepClientId(dateKey: string, signalType: typeof DERIVED_SLEEP_SIGNAL_TYPES[number]): string {
  return signalType === 'sleep_duration_hours'
    ? healthKitSleepDurationClientId(dateKey)
    : healthKitSleepAggregateClientId(dateKey, signalType)
}

function derivedSleepSignalUnit(signalType: typeof DERIVED_SLEEP_SIGNAL_TYPES[number]): string {
  return signalType === 'sleep_duration_hours' ? 'h' : signalType === 'sleep_hr_sample_count' ? 'count' : 'bpm'
}

function legacyHealthSignalTombstones(existingSignals: AtlasPassiveSignal[]): StorePassiveSignalInput[] {
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

async function healthDataRepairPending(): Promise<boolean> {
  return (await AsyncStorage.getItem(HEALTH_DATA_REPAIR_VERSION_KEY)) !== HEALTH_DATA_REPAIR_VERSION
}

async function markHealthDataRepairApplied(): Promise<void> {
  await AsyncStorage.setItem(HEALTH_DATA_REPAIR_VERSION_KEY, HEALTH_DATA_REPAIR_VERSION)
}

function dateKeyForPassiveSignalInput(
  signal: Pick<StorePassiveSignalInput, 'signal_type' | 'started_at' | 'ended_at'>,
): string | null {
  const time = passiveSignalInputMetricTime(signal)
  return Number.isFinite(time) ? localDateKey(new Date(time)) : null
}

function healthSnapshotDatesForHealthKitSync(input: {
  signals: StorePassiveSignalInput[]
  existingSignals: AtlasPassiveSignal[]
  refreshDays: number
  now?: Date
}): string[] {
  const now = input.now ?? new Date()
  const dates = new Set<string>(recentLocalDateKeys(input.refreshDays, now))
  const existingByClientId = new Map(input.existingSignals.map((signal) => [signal.client_id, signal]))

  for (const signal of input.signals) {
    const originalSignal = signal.deleted_at ? existingByClientId.get(signal.client_id) : null
    const time = passiveSignalInputMetricTime(originalSignal ?? signal)
    if (Number.isFinite(time)) {
      dates.add(localDateKey(new Date(time)))
    }
  }

  return [...dates].sort((a, b) => new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime())
}

function recentLocalDateKeys(days: number, now = new Date()): string[] {
  return Array.from({ length: Math.max(1, days) }, (_, offset) => {
    const date = startOfLocalDay(now)
    date.setDate(date.getDate() - offset)
    return localDateKey(date)
  })
}

function passiveSignalInputMetricTime(
  signal: Pick<StorePassiveSignalInput, 'signal_type' | 'started_at' | 'ended_at'>,
): number {
  const iso = signal.signal_type === 'sleep_duration_hours' || signal.signal_type === 'sleep_stage' || signal.signal_type.startsWith('sleep_hr_') || signal.signal_type === 'sleep_breathing_disturbances'
    ? signal.ended_at ?? signal.started_at
    : signal.started_at
  return new Date(iso).getTime()
}

function mergeQueuedPassiveSignals(signals: QueuedPassiveSignal[]): QueuedPassiveSignal[] {
  return mergeQueuedByClientId(signals, (signal) => queueTime(signal.started_at))
}

function mergeQueuedHealthSnapshots(snapshots: QueuedHealthSnapshot[]): QueuedHealthSnapshot[] {
  return mergeQueuedByClientId(snapshots, (snapshot) => queueTime(snapshot.snapshot_date))
}

function mergeQueuedDigitalSessions(sessions: QueuedDigitalSession[]): QueuedDigitalSession[] {
  return mergeQueuedByClientId(sessions, (session) => queueTime(session.started_at))
}

function mergeQueuedDigitalActivitySnapshots(
  snapshots: QueuedDigitalActivitySnapshot[],
): QueuedDigitalActivitySnapshot[] {
  return mergeQueuedByClientId(snapshots, (snapshot) => queueTime(snapshot.snapshot_date))
}

function mergeQueuedByClientId<T extends { client_id: string; attempts: number; last_error?: string | null }>(
  items: T[],
  getTime: (item: T) => number,
): T[] {
  const byClientId = new Map<string, T>()

  for (const item of items) {
    if (!item.client_id) continue

    const existing = byClientId.get(item.client_id)
    if (!existing) {
      byClientId.set(item.client_id, item)
      continue
    }

    const itemTime = getTime(item)
    const existingTime = getTime(existing)
    const primary = itemTime > existingTime ? item : existing
    const secondary = itemTime > existingTime ? existing : item

    byClientId.set(item.client_id, {
      ...primary,
      attempts: Math.max(primary.attempts ?? 0, secondary.attempts ?? 0),
      last_error: primary.last_error ?? secondary.last_error ?? null,
    } as T)
  }

  return [...byClientId.values()].sort((a, b) => (
    getTime(b) - getTime(a)
  ))
}

function queueTime(iso: string | null | undefined): number {
  if (!iso) return 0
  const time = new Date(iso).getTime()
  return Number.isFinite(time) ? time : 0
}

function uniqueBehaviorSlug(name: string, state: Pick<AtlasState, 'behaviors' | 'queuedBehaviors'>): string {
  const base = slugify(name)
  const existing = new Set([
    ...state.behaviors.map((behavior) => behavior.slug),
    ...state.queuedBehaviors.map((behavior) => behavior.slug),
  ])

  if (!existing.has(base)) return base

  let suffix = 2
  let next = `${base}_${suffix}`
  while (existing.has(next)) {
    suffix += 1
    next = `${base}_${suffix}`
  }

  return next
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return slug || 'behavior'
}

function numericValueForBehavior(value: string): number | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'yes' || normalized === 'sim' || normalized === 'true') return 1
  if (normalized === 'no' || normalized === 'não' || normalized === 'nao' || normalized === 'false') return 0

  const parsed = Number(normalized.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function isPromptableLifecycle(status: AtlasBehavior['lifecycle_status']): boolean {
  return status === 'active' || status === 'experiment'
}

interface CaptureTriageMetadata {
  status?: string
  destination?: string
  last_action?: string
  updated_at?: string
  reason?: string | null
  title?: string | null
  snoozed_until?: string | null
  note_title?: string | null
  proposal_id?: string | null
  proposal_status?: string | null
  knowledge_state?: string | null
  human_gate?: string | null
  next_action?: string | null
  project_type?: string | null
  active_next_task_id?: string | null
  active_next_task_title?: string | null
  target_type?: string | null
  target_id?: string | null
  target_title?: string | null
}

function captureTriage(capture: AtlasCapture): CaptureTriageMetadata {
  const triage = capture.metadata?.triage
  return triage && typeof triage === 'object' && !Array.isArray(triage)
    ? triage as CaptureTriageMetadata
    : {}
}

function captureTriageHistory(capture: AtlasCapture): InboxItem['triageHistory'] {
  const history = capture.metadata?.triage_history
  if (!Array.isArray(history)) return []

  return history
    .filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === 'object' && !Array.isArray(entry))
    .slice(0, 20)
    .map((entry) => ({
      action: typeof entry.action === 'string' ? entry.action : null,
      status: typeof entry.status === 'string' ? entry.status : null,
      destination: typeof entry.destination === 'string' ? entry.destination : null,
      at: typeof entry.at === 'string' ? entry.at : null,
      reason: typeof entry.reason === 'string' ? entry.reason : null,
      proposal_id: typeof entry.proposal_id === 'string' ? entry.proposal_id : null,
      previous_destination: typeof entry.previous_destination === 'string' ? entry.previous_destination : null,
      previous_target_title: typeof entry.previous_target_title === 'string' ? entry.previous_target_title : null,
      changed_destination: typeof entry.changed_destination === 'boolean' ? entry.changed_destination : null,
    }))
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
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

function fileNameFor(uri: string, clientId: string, fallbackExtension: string): string {
  const clean = uri.split('?')[0]
  const rawName = clean.split('/').pop()
  if (rawName && rawName.includes('.')) return rawName

  return `${clientId}.${fallbackExtension}`
}

async function persistCaptureFile(sourceUri: string, directoryUri: string, fileName: string): Promise<string> {
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

function stripQueueFields<T extends { attempts: number; last_error?: string | null }>(
  item: T,
): Omit<T, 'attempts' | 'last_error'> {
  const { attempts: _attempts, last_error: _lastError, ...payload } = item
  return payload
}

function healthSnapshotForUpload(snapshot: QueuedHealthSnapshot): StoreHealthSnapshotInput {
  const payload = stripQueueFields(sanitizeQueuedHealthSnapshotSleep(snapshot)) as StoreHealthSnapshotInput

  return {
    ...payload,
    confidence: normalizeConfidenceForStorage(payload.confidence),
  }
}

function digitalSessionForUpload(session: QueuedDigitalSession): StoreDigitalSessionInput {
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

function digitalSnapshotForUpload(snapshot: QueuedDigitalActivitySnapshot): StoreDigitalActivitySnapshotInput {
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

function behaviorForUpload(behavior: QueuedBehavior): StoreBehaviorInput {
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
    relational_privacy: payload.relational_privacy ?? false,
    metadata: payload.metadata ?? {},
  }
}

function normalizeQueuedHealthSnapshot(snapshot: QueuedHealthSnapshot): QueuedHealthSnapshot {
  return sanitizeQueuedHealthSnapshotSleep({
    ...snapshot,
    confidence: normalizeConfidenceForStorage(snapshot.confidence),
  })
}

function sanitizeQueuedHealthSnapshotSleep(snapshot: QueuedHealthSnapshot): QueuedHealthSnapshot {
  const sleep = recordOrNull(snapshot.sleep)
  const durationHours = numberOrNull(sleep?.duration_hours) ?? numberOrNull(snapshot.sleep_duration_hours)
  if (
    durationHours === null
    || isMainSleepCandidate({
      asleepHours: durationHours,
      bedtime: stringOrNull(sleep?.bedtime),
      wakeTime: stringOrNull(sleep?.wake_time),
    })
  ) {
    return snapshot
  }

  return {
    ...snapshot,
    sleep_duration_hours: null,
    sleep_efficiency: null,
    sleep: {
      ...(sleep ?? {}),
      asleep_hours: null,
      duration_hours: null,
      sleep_debt_hours: null,
      bedtime: null,
      wake_time: null,
      in_bed_start_time: null,
      in_bed_hours: null,
      efficiency: null,
      awake_percent: null,
      continuity_percent: null,
      rem_hours: null,
      deep_hours: null,
      core_hours: null,
      awake_hours: null,
      unspecified_hours: null,
      latency_minutes: null,
      awake_episode_count: null,
      disturbance_count: null,
      sleep_cycle_count: null,
      stage_coverage: null,
      sleep_data_quality: null,
      sleep_data_quality_label: null,
      sleep_capture_status: null,
      main_sleep_source: null,
      rejected_main_sleep: true,
      rejection_reason: 'too_short_or_outside_main_sleep_window',
    },
  }
}

function preserveExistingValidSleepSnapshot(
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

function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function normalizeConfidenceForStorage(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null

  const fraction = value > 1 ? value / 100 : value
  return Math.min(1, Math.max(0, Number(fraction.toFixed(3))))
}

function chunkItems<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

function atlasDeviceId(): string {
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

function clampLevel(level: number): number {
  return Math.min(5, Math.max(1, Math.round(level)))
}

function newClientId(): string {
  const randomUuid = globalThis.crypto?.randomUUID?.()
  if (randomUuid) return randomUuid

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16)
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8
    return value.toString(16)
  })
}

function deterministicUuid(input: string): string {
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

function humanError(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Falha inesperada ao sincronizar.'
}

function partialSyncMessage(queueTotal: number, errors: string[]): string {
  const uniqueErrors = [...new Set(errors.map((error) => error.trim()).filter(Boolean))]
  const detail = uniqueErrors[0] ?? 'Falha ao enviar parte da fila.'

  if (queueTotal <= 0) {
    return `Servidor online, mas parte do upload falhou. ${detail}`
  }

  return `Servidor online, mas ${queueTotal} ${queueTotal === 1 ? 'item continua' : 'itens continuam'} na fila. Último erro: ${detail}`
}

function normalizePersistedState(raw: unknown): PersistedAtlasState {
  if (!raw || typeof raw !== 'object') return initialPersistedState

  const state = raw as Partial<PersistedAtlasState>
  return {
    captures: mergeCaptures(persistedItems<AtlasCapture>(state.captures)),
    domains: mergeDomains(persistedDomains(state.domains)),
    checkins: mergeCheckins(persistedItems<AtlasCheckin>(state.checkins)),
    behaviors: mergeBehaviors(persistedItems<AtlasBehavior>(state.behaviors)),
    behaviorLogs: mergeBehaviorLogs(persistedItems<AtlasBehaviorLog>(state.behaviorLogs)),
    passiveSignals: mergePassiveSignals(persistedItems<AtlasPassiveSignal>(state.passiveSignals)),
    healthSnapshots: mergeHealthSnapshots(persistedItems<AtlasHealthSnapshot>(state.healthSnapshots)),
    digitalSessions: mergeDigitalSessions(persistedItems<AtlasDigitalSession>(state.digitalSessions)),
    digitalActivitySnapshots: mergeDigitalActivitySnapshots(
      persistedItems<AtlasDigitalActivitySnapshot>(state.digitalActivitySnapshots),
    ),
    queuedCaptures: mergeQueuedCaptures(persistedItems<QueuedCapture>(state.queuedCaptures)),
    queuedCheckins: mergeQueuedCheckins(persistedItems<QueuedCheckin>(state.queuedCheckins)),
    queuedBehaviors: mergeQueuedBehaviors(persistedItems<QueuedBehavior>(state.queuedBehaviors)),
    queuedBehaviorLogs: mergeQueuedBehaviorLogs(persistedItems<QueuedBehaviorLog>(state.queuedBehaviorLogs)),
    queuedPassiveSignals: mergeQueuedPassiveSignals(persistedItems<QueuedPassiveSignal>(state.queuedPassiveSignals)),
    queuedHealthSnapshots: mergeQueuedHealthSnapshots(
      persistedItems<QueuedHealthSnapshot>(state.queuedHealthSnapshots).map(normalizeQueuedHealthSnapshot),
    ),
    queuedDigitalSessions: mergeQueuedDigitalSessions(
      persistedItems<QueuedDigitalSession>(state.queuedDigitalSessions),
    ),
    queuedDigitalActivitySnapshots: mergeQueuedDigitalActivitySnapshots(
      persistedItems<QueuedDigitalActivitySnapshot>(state.queuedDigitalActivitySnapshots),
    ),
    mission: state.mission ?? null,
    lastSyncAt: typeof state.lastSyncAt === 'string' ? state.lastSyncAt : null,
    serverReachable: false,
    healthKit: initialPersistedState.healthKit,
    screenTime: initialPersistedState.screenTime,
  }
}

function persistedItems<T extends { client_id: string }>(value: unknown): T[] {
  if (!Array.isArray(value)) return []
  return value.filter(hasClientId) as T[]
}

function persistedDomains(value: unknown): Domain[] {
  if (!Array.isArray(value)) return DEFAULT_DOMAINS
  return value
    .filter((domain): domain is Domain => (
      domain
      && typeof domain === 'object'
      && typeof (domain as Domain).key === 'string'
      && typeof (domain as Domain).label === 'string'
    ))
}

function hasClientId(value: unknown): value is { client_id: string } {
  return Boolean(
    value
    && typeof value === 'object'
    && 'client_id' in value
    && typeof (value as { client_id?: unknown }).client_id === 'string'
    && (value as { client_id: string }).client_id.trim().length > 0,
  )
}

async function persist(state: AtlasState): Promise<void> {
  const payload: PersistedAtlasState = {
    captures: state.captures,
    domains: state.domains,
    checkins: state.checkins,
    behaviors: state.behaviors,
    behaviorLogs: state.behaviorLogs,
    passiveSignals: state.passiveSignals,
    healthSnapshots: state.healthSnapshots,
    digitalSessions: state.digitalSessions,
    digitalActivitySnapshots: state.digitalActivitySnapshots,
    queuedCaptures: state.queuedCaptures,
    queuedCheckins: state.queuedCheckins,
    queuedBehaviors: state.queuedBehaviors,
    queuedBehaviorLogs: state.queuedBehaviorLogs,
    queuedPassiveSignals: state.queuedPassiveSignals,
    queuedHealthSnapshots: state.queuedHealthSnapshots,
    queuedDigitalSessions: state.queuedDigitalSessions,
    queuedDigitalActivitySnapshots: state.queuedDigitalActivitySnapshots,
    mission: state.mission,
    lastSyncAt: state.lastSyncAt,
    serverReachable: state.serverReachable,
    healthKit: state.healthKit,
    screenTime: state.screenTime,
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}
