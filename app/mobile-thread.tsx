import { useEffect } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { Frau } from '../design/Type'
import { usePalette } from '../design/theme'
import { useShell } from '../components/AtlasShell'
import { discussMobileInboxItem } from '../lib/api/client'
import { newAtlasAiCorrelationId, recordAtlasAiEvent } from '../lib/atlasAiTelemetry'
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
      const correlationId = newAtlasAiCorrelationId()

      if (inboxId && action === 'discuss') {
        void recordAtlasAiEvent({
          eventName: 'inbox_discuss_opened',
          correlation_id: correlationId,
          metadata: {
            inbox_item_id: inboxId,
            entrypoint: 'mobile_thread_bridge',
          },
        })
      }

      try {
        nextThreadId = await resolveMobileThreadBridgeTarget({ threadId, inboxId, action }, discussMobileInboxItem)
      } catch (error) {
        if (!cancelled) {
          void recordAtlasAiEvent({
            eventName: 'inbox_discuss_open_failed',
            correlation_id: correlationId,
            metadata: {
              inbox_item_id: inboxId,
              thread_id: threadId,
              action,
              error: error instanceof Error ? error.message : 'unknown',
            },
          })
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

      void recordAtlasAiEvent({
        eventName: 'atlas_opened_from_deeplink',
        correlation_id: correlationId,
        thread_id: nextThreadId,
        metadata: {
          inbox_item_id: inboxId,
          action,
          target: 'atlas_ai',
        },
      })
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
    <Screen topExtra={24} bare>
      {/* Bridge loading · drop cap canon "A"brindo / "P"reparando · italic Frau ink. */}
      <View style={[styles.panel, { borderColor: c.borderSoft }]}>
        <ActivityIndicator color={c.bronze} />
        <Frau italic size={17} lineHeight={26} color={c.ink} align="center">
          {inboxId ? 'Preparando Atlas operacional…' : 'Abrindo no Atlas AI…'}
        </Frau>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 96,
    marginHorizontal: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 22,
    paddingVertical: 36,
    gap: 18,
    alignItems: 'center',
  },
})
