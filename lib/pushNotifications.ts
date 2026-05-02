import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { useRootNavigationState, useRouter } from 'expo-router'
import {
  getMobileDeviceSession,
  recoverMobileDeviceSession,
  updateMobilePushToken,
} from './api/client'
import { openAtlasDeepLink } from './deepLinks'
import { useOverlays } from './overlays'

export const ATLAS_NOTIFICATION_SOUND = 'atlas-bronze.wav'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export interface AtlasPushRegistrationResult {
  status: 'registered' | 'unpaired' | 'permission_denied' | 'simulator' | 'failed'
  expoPushToken?: string
  permissionStatus?: string
  error?: string
}

export async function registerAtlasPushNotifications(): Promise<AtlasPushRegistrationResult> {
  if (Platform.OS === 'web') {
    return { status: 'simulator', permissionStatus: 'web' }
  }

  const session = getMobileDeviceSession() ?? await recoverMobileDeviceSession().catch(() => null)
  if (!session) return { status: 'unpaired' }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('atlas-default', {
        name: 'Atlas',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: ATLAS_NOTIFICATION_SOUND,
      })
    }

    const current = await Notifications.getPermissionsAsync()
    let permissionStatus = current.status
    if (permissionStatus !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync()
      permissionStatus = requested.status
    }

    if (permissionStatus !== 'granted') {
      await updateMobilePushToken({
        expo_push_token: null,
        notification_permissions: permissionStatus,
      })

      return { status: 'permission_denied', permissionStatus }
    }

    if (!Device.isDevice) {
      await updateMobilePushToken({
        expo_push_token: null,
        notification_permissions: 'simulator',
      })

      return { status: 'simulator', permissionStatus }
    }

    const token = await Notifications.getExpoPushTokenAsync(projectIdOption())
    await updateMobilePushToken({
      expo_push_token: token.data,
      notification_permissions: permissionStatus,
    })

    return {
      status: 'registered',
      expoPushToken: token.data,
      permissionStatus,
    }
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'push registration failed',
    }
  }
}

export async function syncAtlasBadge(unreadCount: number): Promise<void> {
  if (Platform.OS === 'web') return

  const safeCount = Number.isFinite(unreadCount) ? Math.max(0, Math.floor(unreadCount)) : 0
  await Notifications.setBadgeCountAsync(safeCount).catch(() => {})
}

export function useAtlasPushNotifications(): void {
  const router = useRouter()
  const rootNavigationState = useRootNavigationState()
  const openAtlasAi = useOverlays((s) => s.openAtlasAi)
  const pendingDeepLinkRef = useRef<string | null>(null)
  const handledResponseIdsRef = useRef<Set<string>>(new Set())

  const openDeepLink = useCallback((deepLink: string) => {
    if (!rootNavigationState?.key) {
      pendingDeepLinkRef.current = deepLink
      return
    }

    pendingDeepLinkRef.current = null
    if (!openAtlasDeepLink(deepLink, router, { openAtlasAi })) router.push('/inbox')
  }, [openAtlasAi, rootNavigationState?.key, router])

  const handleNotificationResponse = useCallback((response: Notifications.NotificationResponse | null | undefined) => {
    if (!response) return

    const responseId = response.notification.request.identifier
    if (handledResponseIdsRef.current.has(responseId)) return
    handledResponseIdsRef.current.add(responseId)

    const deepLink = response.notification.request.content.data?.deep_link
    if (typeof deepLink === 'string') openDeepLink(deepLink)
  }, [openDeepLink])

  useEffect(() => {
    if (Platform.OS === 'web') return

    void registerAtlasPushNotifications()
  }, [])

  useEffect(() => {
    if (Platform.OS === 'web') return
    if (!rootNavigationState?.key) return

    const pendingDeepLink = pendingDeepLinkRef.current
    if (pendingDeepLink) openDeepLink(pendingDeepLink)

    let active = true
    const readLastResponse = () => {
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (active) handleNotificationResponse(response)
      })
    }

    readLastResponse()
    const retryTimer = setTimeout(readLastResponse, 450)

    return () => {
      active = false
      clearTimeout(retryTimer)
    }
  }, [handleNotificationResponse, openDeepLink, rootNavigationState?.key])

  useEffect(() => {
    if (Platform.OS === 'web') return

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response)
    })

    return () => {
      subscription.remove()
    }
  }, [handleNotificationResponse])
}

function projectIdOption(): { projectId?: string } | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, any> | undefined
  const projectId = extra?.eas?.projectId ?? Constants.easConfig?.projectId

  return typeof projectId === 'string' && projectId !== '' ? { projectId } : undefined
}
