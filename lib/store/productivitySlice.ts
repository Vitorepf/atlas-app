import { getTodayMission } from '../api/client'
import {
  collectScreenTimeDigitalActivity,
  configureScreenTimeMonitoring,
  getScreenTimeLocalStatus,
  requestScreenTimeAuthorization,
} from '../screenTime'
import {
  mergeQueuedDigitalActivitySnapshots,
  mergeQueuedDigitalSessions,
  type QueuedDigitalActivitySnapshot,
  type QueuedDigitalSession,
} from '../storeConverters'
import { deviceTimezone, humanError } from './internals'
import { initialPersistedState, persist } from './persistence'
import type { AtlasGet, AtlasSet, AtlasState } from './types'

export type ProductivitySlice = Pick<
  AtlasState,
  | 'digitalSessions'
  | 'digitalActivitySnapshots'
  | 'queuedDigitalSessions'
  | 'queuedDigitalActivitySnapshots'
  | 'screenTime'
  | 'screenTimeSyncing'
  | 'mission'
  | 'requestScreenTimePermissions'
  | 'configureScreenTime'
  | 'syncScreenTime'
  | 'loadMission'
>

export const createProductivitySlice = (set: AtlasSet, get: AtlasGet): ProductivitySlice => ({
  digitalSessions: [],
  digitalActivitySnapshots: [],
  queuedDigitalSessions: [],
  queuedDigitalActivitySnapshots: [],
  screenTime: initialPersistedState.screenTime,
  screenTimeSyncing: false,
  mission: null,

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
})
