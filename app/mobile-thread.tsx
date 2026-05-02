import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { useShell } from '../components/AtlasShell'
import { discussMobileInboxItem } from '../lib/api/client'
import { resolveMobileThreadBridgeTarget } from '../lib/mobileThreadBridge'
import { useOverlays } from '../lib/overlays'

export default function MobileThreadBridgeScreen() {
  const c = usePalette()
  const router = useRouter()
  const { showToast } = useShell()
  const params = useLocalSearchParams<{ threadId?: string; inboxId?: string; action?: string; mode?: string }>()
  const openAtlasAi = useOverlays((s) => s.openAtlasAi)
  const threadId = typeof params.threadId === 'string' && params.threadId.trim().length > 0
    ? params.threadId.trim()
    : null
  const inboxId = typeof params.inboxId === 'string' && params.inboxId.trim().length > 0
    ? params.inboxId.trim()
    : null
  const action = typeof params.action === 'string' ? params.action.trim() : null

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    async function openThread() {
      let nextThreadId: string | null = null

      try {
        nextThreadId = await resolveMobileThreadBridgeTarget({ threadId, inboxId, action }, discussMobileInboxItem)
      } catch (error) {
        if (!cancelled) {
          showToast(error instanceof Error ? error.message : 'Falha ao abrir Atlas operacional')
          if (inboxId) {
            router.replace({ pathname: '/mobile-inbox-item', params: { inboxId } })
          } else {
            router.replace('/inbox')
          }
        }
        return
      }

      if (cancelled) return

      openAtlasAi(nextThreadId)
      timer = setTimeout(() => {
        router.replace('/inbox')
      }, 120)
    }

    void openThread()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [action, inboxId, openAtlasAi, router, showToast, threadId])

  return (
    <Screen topExtra={24}>
      <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
        <ActivityIndicator color={c.prussian} />
        <Sans size={14} lineHeight={20} color={c.ink2} align="center">
          {inboxId ? 'Preparando Atlas operacional...' : 'Abrindo no Atlas AI...'}
        </Sans>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 96,
    marginHorizontal: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 12,
    alignItems: 'center',
  },
})
