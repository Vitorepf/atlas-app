import { useEffect } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { useRouter } from 'expo-router'
import {
  getMobileDeviceSession,
  updateMobilePushToken,
} from './api/client'
import { openAtlasDeepLink } from './deepLinks'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
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
  const session = getMobileDeviceSession()
  if (!session) return { status: 'unpaired' }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('atlas-default', {
        name: 'Atlas',
        importance: Notifications.AndroidImportance.DEFAULT,
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

export function useAtlasPushNotifications(): void {
  const router = useRouter()

  useEffect(() => {
    void registerAtlasPushNotifications()

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const deepLink = response.notification.request.content.data?.deep_link
      if (typeof deepLink === 'string') {
        openAtlasDeepLink(deepLink, router)
      }
    })

    return () => {
      subscription.remove()
    }
  }, [router])
}

function projectIdOption(): { projectId?: string } | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, any> | undefined
  const projectId = extra?.eas?.projectId ?? Constants.easConfig?.projectId

  return typeof projectId === 'string' && projectId !== '' ? { projectId } : undefined
}
