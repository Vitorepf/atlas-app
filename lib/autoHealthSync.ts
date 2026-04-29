import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import {
  configureHealthKitBackgroundDelivery,
  subscribeToHealthKitChanges,
} from './healthKit'
import { useAtlasStore } from './atlasStore'

const STARTUP_DELAY_MS = 3500
const FOREGROUND_MIN_INTERVAL_MS = 30 * 60 * 1000
const CHANGE_MIN_INTERVAL_MS = 5 * 60 * 1000
const ACTIVE_POLL_INTERVAL_MS = 20 * 60 * 1000

export function useAutoHealthKitSync(): void {
  const hydrated = useAtlasStore((state) => state.hydrated)
  const enabled = useAtlasStore((state) => state.healthKit.enabled)
  const appState = useRef<AppStateStatus>(AppState.currentState)
  const pendingChangeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!hydrated || !enabled) return

    const startup = setTimeout(() => {
      runAutoHealthKitSync('startup', FOREGROUND_MIN_INTERVAL_MS)
    }, STARTUP_DELAY_MS)

    const interval = setInterval(() => {
      runAutoHealthKitSync('active-poll', FOREGROUND_MIN_INTERVAL_MS)
    }, ACTIVE_POLL_INTERVAL_MS)

    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground = appState.current.match(/inactive|background/)
      appState.current = nextState

      if (wasBackground && nextState === 'active') {
        runAutoHealthKitSync('foreground', FOREGROUND_MIN_INTERVAL_MS)
      }
    })

    return () => {
      clearTimeout(startup)
      clearInterval(interval)
      subscription.remove()
    }
  }, [enabled, hydrated])

  useEffect(() => {
    if (!hydrated || !enabled) return

    let disposed = false
    let cleanup: (() => void) | null = null

    void (async () => {
      await configureHealthKitBackgroundDelivery()
      if (disposed) return

      cleanup = await subscribeToHealthKitChanges((typeIdentifier) => {
        if (pendingChangeTimer.current) clearTimeout(pendingChangeTimer.current)
        pendingChangeTimer.current = setTimeout(() => {
          pendingChangeTimer.current = null
          runAutoHealthKitSync(`healthkit-change:${typeIdentifier}`, CHANGE_MIN_INTERVAL_MS)
        }, 1200)
      })
    })()

    return () => {
      disposed = true
      cleanup?.()
      if (pendingChangeTimer.current) {
        clearTimeout(pendingChangeTimer.current)
        pendingChangeTimer.current = null
      }
    }
  }, [enabled, hydrated])
}

function runAutoHealthKitSync(reason: string, minIntervalMs: number): void {
  const state = useAtlasStore.getState()

  if (!state.hydrated || !state.healthKit.enabled || state.healthKitSyncing) return

  const lastSyncAt = state.healthKit.lastSyncAt ? new Date(state.healthKit.lastSyncAt).getTime() : 0
  const elapsed = lastSyncAt > 0 ? Date.now() - lastSyncAt : Number.POSITIVE_INFINITY
  const historyPending = !state.healthKit.historyBackfilled

  if (!historyPending && elapsed < minIntervalMs) return

  console.info('[Atlas HealthKit AutoSync]', {
    reason,
    elapsed_ms: Number.isFinite(elapsed) ? elapsed : null,
    history_pending: historyPending,
  })

  void state.syncHealthKit()
}
