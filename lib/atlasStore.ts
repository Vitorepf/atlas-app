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
  type AtlasHealthSnapshot,
  type AtlasPassiveSignal,
  type CaptureKind,
  type StoreCheckinInput,
  type StoreBehaviorInput,
  type StoreBehaviorLogInput,
  type StoreHealthSnapshotInput,
  type StorePassiveSignalInput,
  createTextCapture,
  deleteCapture as deleteServerCapture,
  getAtlasAuthHeaders,
  getCaptureFileUrl,
  getHealth,
  getTodayMission,
  hydrateApiConfig,
  listCaptures,
  listBehaviorLogs,
  listBehaviors,
  listCheckins,
  listHealthSnapshots,
  listPassiveSignals,
  patchCapture,
  syncDelta,
  uploadCaptureFile,
} from './api/client'
import type { DomainKey } from './domains'
import { buildHealthSnapshotInputs } from './healthSnapshots'
import {
  collectHealthKitSignals,
  getHealthKitLocalStatus,
  requestAllHealthKitPermissions,
  type HealthKitLocalStatus,
} from './healthKit'
import type { InboxItem } from '../components/InboxCard'

const STORAGE_KEY = 'atlas.store.v1'
const LOCAL_ID_PREFIX = 'local:'
const LOCAL_AUDIO_DIR = `${FileSystem.documentDirectory ?? ''}atlas/audio/`
const LOCAL_PHOTO_DIR = `${FileSystem.documentDirectory ?? ''}atlas/photos/`
const CHECKIN_SYNC_BATCH_SIZE = 100
const BEHAVIOR_SYNC_BATCH_SIZE = 100
const BEHAVIOR_LOG_SYNC_BATCH_SIZE = 200
const PASSIVE_SIGNAL_SYNC_BATCH_SIZE = 250
const HEALTH_SNAPSHOT_SYNC_BATCH_SIZE = 90

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
  total: number
}

interface LocalQueueLike {
  queuedCaptures: { length: number }
  queuedCheckins: { length: number }
  queuedBehaviors: { length: number }
  queuedBehaviorLogs: { length: number }
  queuedPassiveSignals: { length: number }
  queuedHealthSnapshots: { length: number }
}

interface PersistedAtlasState {
  captures: AtlasCapture[]
  checkins: AtlasCheckin[]
  behaviors: AtlasBehavior[]
  behaviorLogs: AtlasBehaviorLog[]
  passiveSignals: AtlasPassiveSignal[]
  healthSnapshots: AtlasHealthSnapshot[]
  queuedCaptures: QueuedCapture[]
  queuedCheckins: QueuedCheckin[]
  queuedBehaviors: QueuedBehavior[]
  queuedBehaviorLogs: QueuedBehaviorLog[]
  queuedPassiveSignals: QueuedPassiveSignal[]
  queuedHealthSnapshots: QueuedHealthSnapshot[]
  mission: AtlasDailyMission | null
  lastSyncAt: string | null
  serverReachable: boolean
  healthKit: HealthKitLocalStatus
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
  lastError: string | null

  hydrate: () => Promise<void>
  sync: () => Promise<void>
  refresh: () => Promise<void>
  loadMission: () => Promise<void>
  requestHealthKitPermissions: () => Promise<void>
  syncHealthKit: () => Promise<void>

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
    relationalPrivacy?: boolean
    showInMorningBriefing?: boolean
    metadata?: Record<string, unknown>
  }) => Promise<string>
  logBehavior: (input: {
    behaviorClientId: string
    logDate?: string
    value: string
    numericValue?: number | null
    note?: string | null
    source?: AtlasBehaviorLog['source']
    metadata?: Record<string, unknown>
  }) => Promise<string>
  updateCapture: (id: string, patch: Partial<Pick<AtlasCapture, 'domain' | 'content_text' | 'metadata'>>) => Promise<AtlasCapture | null>
  deleteCapture: (id: string) => Promise<boolean>
}

const initialPersistedState: PersistedAtlasState = {
  captures: [],
  checkins: [],
  behaviors: [],
  behaviorLogs: [],
  passiveSignals: [],
  healthSnapshots: [],
  queuedCaptures: [],
  queuedCheckins: [],
  queuedBehaviors: [],
  queuedBehaviorLogs: [],
  queuedPassiveSignals: [],
  queuedHealthSnapshots: [],
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
}

export const useAtlasStore = create<AtlasState>((set, get) => ({
  ...initialPersistedState,
  hydrated: false,
  syncing: false,
  healthKitSyncing: false,
  lastError: null,

  hydrate: async () => {
    if (get().hydrated) return

    await hydrateApiConfig()

    const [raw, healthKit] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      getHealthKitLocalStatus(),
    ])
    if (raw) {
      try {
        const persisted = normalizePersistedState(JSON.parse(raw))
        set({
          ...initialPersistedState,
          ...persisted,
          healthKit,
          serverReachable: false,
          hydrated: true,
          syncing: false,
          healthKitSyncing: false,
          lastError: null,
        })
        await persist(get())
      } catch {
        set({ healthKit, hydrated: true })
      }
    } else {
      set({ healthKit, hydrated: true })
    }
  },

  sync: async () => {
    if (get().syncing) return

    set({ syncing: true, lastError: null })

    try {
      await getHealth()
      const queuedCapturesToSync = mergeQueuedCaptures(get().queuedCaptures)
      const queuedCheckinsToSync = mergeQueuedCheckins(get().queuedCheckins)
      const queuedBehaviorsToSync = mergeQueuedBehaviors(get().queuedBehaviors)
      const queuedBehaviorLogsToSync = mergeQueuedBehaviorLogs(get().queuedBehaviorLogs)
      const queuedPassiveSignalsToSync = mergeQueuedPassiveSignals(get().queuedPassiveSignals)
      const queuedHealthSnapshotsToSync = mergeQueuedHealthSnapshots(get().queuedHealthSnapshots)
      const queuedCaptureIds = new Set(queuedCapturesToSync.map((capture) => capture.client_id))
      const queuedCheckinIds = new Set(queuedCheckinsToSync.map((checkin) => checkin.client_id))
      const queuedBehaviorIds = new Set(queuedBehaviorsToSync.map((behavior) => behavior.client_id))
      const queuedBehaviorLogIds = new Set(queuedBehaviorLogsToSync.map((log) => log.client_id))
      const queuedPassiveSignalIds = new Set(queuedPassiveSignalsToSync.map((signal) => signal.client_id))
      const queuedHealthSnapshotIds = new Set(queuedHealthSnapshotsToSync.map((snapshot) => snapshot.client_id))
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

      const [capturePage, checkinPage, behaviorPage, behaviorLogPage, signalPage, snapshotPage, missionResponse] = await Promise.all([
        listCaptures({ limit: 200 }),
        listCheckins({ limit: 100 }),
        listBehaviors({ limit: 200 }),
        listBehaviorLogs({ limit: 200 }),
        listPassiveSignals({ limit: 200 }),
        listHealthSnapshots({ limit: 90 }),
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
        const counts = localQueueCounts({
          queuedCaptures,
          queuedCheckins,
          queuedBehaviors,
          queuedBehaviorLogs,
          queuedPassiveSignals,
          queuedHealthSnapshots,
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
          queuedCaptures,
          queuedCheckins,
          queuedBehaviors,
          queuedBehaviorLogs,
          queuedPassiveSignals,
          queuedHealthSnapshots,
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
        serverReachable: false,
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
          lastError: result.granted
            ? null
            : result.available
              ? 'Permissão do app Saúde não concedida.'
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
      const result = await collectHealthKitSignals()
      const healthKitStatus = await getHealthKitLocalStatus()
      const queued = result.signals.map((signal): QueuedPassiveSignal => ({
        ...signal,
        attempts: 0,
        last_error: null,
      }))
      const currentState = get()
      const passiveSignals = mergePassiveSignals([
        ...currentState.passiveSignals,
        ...currentState.queuedPassiveSignals.map(queuedToPassiveSignal),
        ...queued.map(queuedToPassiveSignal),
      ])
      const checkins = mergeCheckins([
        ...currentState.checkins,
        ...currentState.queuedCheckins.map(queuedToCheckin),
      ])
      const queuedSnapshots = buildHealthSnapshotInputs({
        healthSignals: passiveSignals.filter((signal) => signal.source === 'healthkit'),
        allSignals: passiveSignals,
        checkins,
      }).map((snapshot): QueuedHealthSnapshot => ({
        ...snapshot,
        attempts: 0,
        last_error: null,
      }))

      set((state) => ({
        queuedPassiveSignals: mergeQueuedPassiveSignals([...queued, ...state.queuedPassiveSignals]),
        queuedHealthSnapshots: mergeQueuedHealthSnapshots([...queuedSnapshots, ...state.queuedHealthSnapshots]),
        healthKit: {
          ...state.healthKit,
          available: true,
          enabled: true,
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
    const queuedSnapshots = buildHealthSnapshotInputs({
      healthSignals: passiveSignals.filter((signal) => signal.source === 'healthkit'),
      allSignals: passiveSignals,
      checkins,
      days: 7,
    }).map((snapshot): QueuedHealthSnapshot => ({
      ...snapshot,
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
      throw new Error('Informe o nome do comportamento.')
    }

    if (input.showInMorningBriefing !== false) {
      const activeCount = visibleBehaviors(get()).filter((behavior) => (
        !behavior.archived_at && behavior.show_in_morning_briefing
      )).length

      if (activeCount >= 12) {
        throw new Error('A Bitácula aceita no máximo 12 comportamentos ativos no briefing.')
      }
    }

    const slug = uniqueBehaviorSlug(name, get())
    const queued: QueuedBehavior = {
      client_id: clientId,
      name,
      slug,
      category: input.category ?? 'outro',
      input_type: input.inputType ?? 'yes_no',
      question_text: input.questionText?.trim() || `${name} aconteceu ontem?`,
      default_value: 'no',
      created_by: 'operator',
      source_capture_ids: [],
      activation_rules: {},
      show_in_morning_briefing: input.showInMorningBriefing ?? true,
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
      recorded_at: new Date().toISOString(),
      recorded_timezone: deviceTimezone(),
      source: input.source ?? 'morning_briefing',
      source_capture_id: null,
      auto_marked: false,
      confirmed_by_operator: true,
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
      set({ captures: previous, lastError: humanError(error), serverReachable: false })
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

  return {
    captures,
    checkins,
    behaviors,
    behaviorLogs,
    signals,
    snapshots,
    total: captures + checkins + behaviors + behaviorLogs + signals + snapshots,
  }
}

export function captureToInboxItem(capture: AtlasCapture): InboxItem {
  const isLocal = capture.id.startsWith(LOCAL_ID_PREFIX)
  const hasFile = Boolean(capture.content_file_path)

  return {
    id: capture.id,
    clientId: capture.client_id,
    time: formatTime(capture.captured_at),
    date: formatDate(capture.captured_at),
    domain: capture.domain,
    kind: capture.kind,
    text: captureText(capture),
    durationMs: capture.content_duration_ms,
    transcriptionStatus: capture.transcription_status,
    fileUrl: hasFile ? (isLocal ? capture.content_file_path : getCaptureFileUrl(capture.id)) : null,
    fileHeaders: hasFile && !isLocal ? getAtlasAuthHeaders() : null,
    tags: metadataTags(capture.metadata),
    capturedAt: capture.captured_at,
    capturedLat: capture.captured_lat,
    capturedLng: capture.captured_lng,
    isLocal,
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

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
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
    metadata: { ...(capture.metadata ?? {}), local: true },
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
    deleted_at: null,
  }
}

function queuedToHealthSnapshot(snapshot: QueuedHealthSnapshot): AtlasHealthSnapshot {
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

function queuedToBehavior(behavior: QueuedBehavior): AtlasBehavior {
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${behavior.client_id}`,
    client_id: behavior.client_id,
    name: behavior.name,
    slug: behavior.slug,
    category: behavior.category,
    input_type: behavior.input_type,
    question_text: behavior.question_text,
    default_value: behavior.default_value ?? 'no',
    created_by: behavior.created_by ?? 'operator',
    source_capture_ids: behavior.source_capture_ids ?? [],
    activation_rules: behavior.activation_rules ?? {},
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
    recorded_at: log.recorded_at,
    recorded_timezone: log.recorded_timezone,
    source: log.source,
    source_capture_id: log.source_capture_id ?? null,
    auto_marked: log.auto_marked ?? false,
    confirmed_by_operator: log.confirmed_by_operator ?? true,
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
      byClientId.set(behavior.client_id, behavior)
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    (b.priority_score - a.priority_score)
    || (new Date(b.activated_at).getTime() - new Date(a.activated_at).getTime())
  ))
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
      byClientId.set(log.client_id, log)
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
  ))
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
  const iso = signalType === 'sleep_duration_hours'
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

function captureText(capture: AtlasCapture): string {
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
  const payload = stripQueueFields(snapshot) as StoreHealthSnapshotInput

  return {
    ...payload,
    confidence: normalizeConfidenceForStorage(payload.confidence),
  }
}

function behaviorForUpload(behavior: QueuedBehavior): StoreBehaviorInput {
  const payload = stripQueueFields(behavior) as StoreBehaviorInput

  return {
    ...payload,
    slug: payload.slug || slugify(payload.name),
    question_text: payload.question_text || `${payload.name} aconteceu ontem?`,
    default_value: payload.default_value ?? 'no',
    source_capture_ids: payload.source_capture_ids ?? [],
    activation_rules: payload.activation_rules ?? {},
    show_in_morning_briefing: payload.show_in_morning_briefing ?? true,
    relational_privacy: payload.relational_privacy ?? false,
    metadata: payload.metadata ?? {},
  }
}

function normalizeQueuedHealthSnapshot(snapshot: QueuedHealthSnapshot): QueuedHealthSnapshot {
  return {
    ...snapshot,
    confidence: normalizeConfidenceForStorage(snapshot.confidence),
  }
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
    checkins: mergeCheckins(persistedItems<AtlasCheckin>(state.checkins)),
    behaviors: mergeBehaviors(persistedItems<AtlasBehavior>(state.behaviors)),
    behaviorLogs: mergeBehaviorLogs(persistedItems<AtlasBehaviorLog>(state.behaviorLogs)),
    passiveSignals: mergePassiveSignals(persistedItems<AtlasPassiveSignal>(state.passiveSignals)),
    healthSnapshots: mergeHealthSnapshots(persistedItems<AtlasHealthSnapshot>(state.healthSnapshots)),
    queuedCaptures: mergeQueuedCaptures(persistedItems<QueuedCapture>(state.queuedCaptures)),
    queuedCheckins: mergeQueuedCheckins(persistedItems<QueuedCheckin>(state.queuedCheckins)),
    queuedBehaviors: mergeQueuedBehaviors(persistedItems<QueuedBehavior>(state.queuedBehaviors)),
    queuedBehaviorLogs: mergeQueuedBehaviorLogs(persistedItems<QueuedBehaviorLog>(state.queuedBehaviorLogs)),
    queuedPassiveSignals: mergeQueuedPassiveSignals(persistedItems<QueuedPassiveSignal>(state.queuedPassiveSignals)),
    queuedHealthSnapshots: mergeQueuedHealthSnapshots(
      persistedItems<QueuedHealthSnapshot>(state.queuedHealthSnapshots).map(normalizeQueuedHealthSnapshot),
    ),
    mission: state.mission ?? null,
    lastSyncAt: typeof state.lastSyncAt === 'string' ? state.lastSyncAt : null,
    serverReachable: false,
    healthKit: initialPersistedState.healthKit,
  }
}

function persistedItems<T extends { client_id: string }>(value: unknown): T[] {
  if (!Array.isArray(value)) return []
  return value.filter(hasClientId) as T[]
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
    checkins: state.checkins,
    behaviors: state.behaviors,
    behaviorLogs: state.behaviorLogs,
    passiveSignals: state.passiveSignals,
    healthSnapshots: state.healthSnapshots,
    queuedCaptures: state.queuedCaptures,
    queuedCheckins: state.queuedCheckins,
    queuedBehaviors: state.queuedBehaviors,
    queuedBehaviorLogs: state.queuedBehaviorLogs,
    queuedPassiveSignals: state.queuedPassiveSignals,
    queuedHealthSnapshots: state.queuedHealthSnapshots,
    mission: state.mission,
    lastSyncAt: state.lastSyncAt,
    serverReachable: state.serverReachable,
    healthKit: state.healthKit,
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}
