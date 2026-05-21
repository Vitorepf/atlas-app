import { useEffect } from 'react'
import * as Updates from 'expo-updates'

let checkedThisLaunch = false

export function useMobileOtaUpdates() {
  useEffect(() => {
    if (__DEV__ || checkedThisLaunch || !Updates.isEnabled) return

    checkedThisLaunch = true

    let cancelled = false

    async function checkAndApplyUpdate() {
      try {
        const update = await Updates.checkForUpdateAsync()
        if (cancelled || !update.isAvailable) return

        await Updates.fetchUpdateAsync()
        if (cancelled) return

        await Updates.reloadAsync()
      } catch {
        // OTA is an optimization. App startup must not fail if Expo services
        // are offline or the device is temporarily without network.
      }
    }

    void checkAndApplyUpdate()

    return () => {
      cancelled = true
    }
  }, [])
}
