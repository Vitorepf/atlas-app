import {
  collectHealthKitSignals,
  getHealthKitLocalStatus,
  requestAllHealthKitPermissions,
} from '../healthKit'
import { buildHealthSnapshotInputs } from '../healthSnapshots'
import {
  healthSnapshotDatesForHealthKitSync,
  mergeCheckins,
  mergePassiveSignalInputs,
  mergePassiveSignals,
  mergeQueuedHealthSnapshots,
  mergeQueuedPassiveSignals,
  queuedToCheckin,
  queuedToPassiveSignal,
  sleepDurationInvalidationsForDeletedStages,
  type QueuedHealthSnapshot,
  type QueuedPassiveSignal,
} from '../storeConverters'
import {
  HEALTH_SNAPSHOT_BACKFILL_DAYS,
  HEALTH_SNAPSHOT_REFRESH_DAYS,
  healthDataRepairPending,
  humanError,
  legacyHealthSignalTombstones,
  markHealthDataRepairApplied,
  preserveExistingValidSleepSnapshot,
  visibleDigitalActivitySnapshots,
  visibleHealthSnapshots,
} from './internals'
import { initialPersistedState, persist } from './persistence'
import type { AtlasGet, AtlasSet, AtlasState } from './types'

export type HealthSlice = Pick<
  AtlasState,
  | 'healthSnapshots'
  | 'queuedHealthSnapshots'
  | 'healthKit'
  | 'healthKitSyncing'
  | 'requestHealthKitPermissions'
  | 'syncHealthKit'
>

export const createHealthSlice = (set: AtlasSet, get: AtlasGet): HealthSlice => ({
  healthSnapshots: [],
  queuedHealthSnapshots: [],
  healthKit: initialPersistedState.healthKit,
  healthKitSyncing: false,

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
})
