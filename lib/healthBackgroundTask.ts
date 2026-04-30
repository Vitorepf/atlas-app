import * as BackgroundTask from 'expo-background-task'
import * as TaskManager from 'expo-task-manager'
import { useAtlasStore } from './atlasStore'

const HEALTHKIT_BACKGROUND_TASK = 'atlas.healthkit.daily-sync'
const DAILY_SYNC_MIN_INTERVAL_MINUTES = 12 * 60
const DAILY_SYNC_MIN_INTERVAL_MS = DAILY_SYNC_MIN_INTERVAL_MINUTES * 60 * 1000

TaskManager.defineTask(HEALTHKIT_BACKGROUND_TASK, async () => {
  try {
    const store = useAtlasStore.getState()
    if (!store.hydrated) {
      await store.hydrate()
    }

    const state = useAtlasStore.getState()
    if (!state.healthKit.enabled || state.healthKitSyncing) {
      return BackgroundTask.BackgroundTaskResult.Success
    }

    const lastSyncAt = state.healthKit.lastSyncAt ? new Date(state.healthKit.lastSyncAt).getTime() : 0
    const elapsed = lastSyncAt > 0 ? Date.now() - lastSyncAt : Number.POSITIVE_INFINITY
    if (state.healthKit.historyBackfilled && elapsed < DAILY_SYNC_MIN_INTERVAL_MS) {
      return BackgroundTask.BackgroundTaskResult.Success
    }

    await state.syncHealthKit()
    return BackgroundTask.BackgroundTaskResult.Success
  } catch (error) {
    console.error('[Atlas HealthKit BackgroundTask] failed', error)
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

export async function registerHealthKitBackgroundTask(): Promise<boolean> {
  try {
    const taskManagerAvailable = await TaskManager.isAvailableAsync()
    const status = await BackgroundTask.getStatusAsync()
    if (!taskManagerAvailable || status !== BackgroundTask.BackgroundTaskStatus.Available) {
      console.info('[Atlas HealthKit BackgroundTask] unavailable', {
        task_manager_available: taskManagerAvailable,
        status,
      })
      return false
    }

    await BackgroundTask.registerTaskAsync(HEALTHKIT_BACKGROUND_TASK, {
      minimumInterval: DAILY_SYNC_MIN_INTERVAL_MINUTES,
    })

    return true
  } catch (error) {
    console.error('[Atlas HealthKit BackgroundTask] registration failed', error)
    return false
  }
}
