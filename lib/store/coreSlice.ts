import { atlasStorage } from '../storage'
import { hydrateApiConfig } from '../api/client'
import { getHealthKitLocalStatus } from '../healthKit'
import { getScreenTimeLocalStatus } from '../screenTime'
import { STORAGE_KEY, initialPersistedState, normalizePersistedState, persist } from './persistence'
import type { AtlasGet, AtlasSet, AtlasState } from './types'

export type CoreSlice = Pick<
  AtlasState,
  'hydrated' | 'syncing' | 'lastError' | 'serverReachable' | 'lastSyncAt' | 'hydrate' | 'refresh'
>

export const createCoreSlice = (set: AtlasSet, get: AtlasGet): CoreSlice => ({
  hydrated: false,
  syncing: false,
  lastError: null,
  serverReachable: false,
  lastSyncAt: null,

  hydrate: async () => {
    if (get().hydrated) return

    await hydrateApiConfig()

    const [raw, healthKit, screenTime] = await Promise.all([
      atlasStorage.getItem(STORAGE_KEY),
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

  refresh: async () => {
    await get().sync()
  },
})
