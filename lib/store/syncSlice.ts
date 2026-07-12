import {
  type AtlasBehavior,
  type AtlasBehaviorLog,
  type AtlasCapture,
  type AtlasCheckin,
  type AtlasDigitalActivitySnapshot,
  type AtlasDigitalSession,
  type AtlasHealthSnapshot,
  type AtlasPassiveSignal,
  AtlasApiError,
  getHealth,
  getInboxHealth,
  getTodayMission,
  listBehaviorLogs,
  listBehaviors,
  listCaptures,
  listCheckins,
  listDigitalActivitySnapshots,
  listDigitalSessions,
  listHealthSnapshots,
  listPassiveSignals,
  syncDelta,
} from '../api/client'
import {
  mergeBehaviorLogs,
  mergeBehaviors,
  mergeCaptures,
  mergeCheckins,
  mergeDigitalActivitySnapshots,
  mergeDigitalSessions,
  mergeHealthSnapshots,
  mergePassiveSignals,
  mergeQueuedBehaviorLogs,
  mergeQueuedBehaviors,
  mergeQueuedCaptures,
  mergeQueuedCheckins,
  mergeQueuedDigitalActivitySnapshots,
  mergeQueuedDigitalSessions,
  mergeQueuedHealthSnapshots,
  mergeQueuedPassiveSignals,
  queuedToBehavior,
  queuedToBehaviorLog,
  queuedToCheckin,
  queuedToDigitalActivitySnapshot,
  queuedToDigitalSession,
  queuedToHealthSnapshot,
  queuedToPassiveSignal,
  type QueuedBehavior,
  type QueuedBehaviorLog,
  type QueuedCapture,
  type QueuedCheckin,
  type QueuedDigitalActivitySnapshot,
  type QueuedDigitalSession,
  type QueuedHealthSnapshot,
  type QueuedPassiveSignal,
} from '../storeConverters'
import {
  BEHAVIOR_LOG_SYNC_BATCH_SIZE,
  BEHAVIOR_SYNC_BATCH_SIZE,
  CHECKIN_SYNC_BATCH_SIZE,
  DIGITAL_SESSION_SYNC_BATCH_SIZE,
  DIGITAL_SNAPSHOT_SYNC_BATCH_SIZE,
  HEALTH_SNAPSHOT_SYNC_BATCH_SIZE,
  PASSIVE_SIGNAL_SYNC_BATCH_SIZE,
  atlasDeviceId,
  behaviorForUpload,
  chunkItems,
  deviceTimezone,
  digitalSessionForUpload,
  digitalSnapshotForUpload,
  healthSnapshotForUpload,
  humanError,
  localQueueCounts,
  partialSyncMessage,
  stripQueueFields,
  uploadQueuedCapture,
} from './internals'
import { persist } from './persistence'
import type { AtlasGet, AtlasSet, AtlasState } from './types'

export type SyncSlice = Pick<AtlasState, 'sync'>

export const createSyncSlice = (set: AtlasSet, get: AtlasGet): SyncSlice => ({
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
})
