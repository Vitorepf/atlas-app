import { useEffect } from 'react'
import { View } from 'react-native'
import { Stack } from 'expo-router'
import { TamaguiProvider } from 'tamagui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'

import config from '../tamagui.config'
import { AtlasThemeProvider, useTheme } from '../design/theme'
import { useAtlasFonts } from '../design/fonts'
import { AtlasShell } from '../components/AtlasShell'
import { useAutoHealthKitSync } from '../lib/autoHealthSync'

const queryClient = new QueryClient()

SplashScreen.preventAutoHideAsync().catch(() => {})

export default function RootLayout() {
  const fontsLoaded = useAtlasFonts()

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TamaguiProvider config={config} defaultTheme="dark">
          <QueryClientProvider client={queryClient}>
            <AtlasThemeProvider>
              <ThemedRoot />
            </AtlasThemeProvider>
          </QueryClientProvider>
        </TamaguiProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

function ThemedRoot() {
  const { c, name } = useTheme()
  useAutoHealthKitSync()

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <AtlasShell>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.bg },
            animation: 'fade',
            animationDuration: 360,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="inbox" />
          <Stack.Screen name="health"   options={{ animation: 'slide_from_bottom', animationDuration: 380 }} />
          <Stack.Screen name="sleep"    options={{ animation: 'slide_from_right', animationDuration: 320 }} />
          <Stack.Screen name="ritual"   options={{ animation: 'slide_from_bottom', animationDuration: 380 }} />
          <Stack.Screen name="review"   options={{ animation: 'slide_from_bottom', animationDuration: 380 }} />
          <Stack.Screen name="bitacula" options={{ animation: 'slide_from_right', animationDuration: 320 }} />
          <Stack.Screen name="memory"   options={{ animation: 'slide_from_right', animationDuration: 320 }} />
          <Stack.Screen name="capture"  options={{ animation: 'slide_from_bottom', animationDuration: 380 }} />
          <Stack.Screen name="detail"   options={{ animation: 'slide_from_bottom', animationDuration: 380 }} />
          <Stack.Screen name="decision" options={{ animation: 'slide_from_bottom', animationDuration: 380 }} />
        </Stack>
      </AtlasShell>
    </View>
  )
}
