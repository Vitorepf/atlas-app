import { useCallback, useMemo, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { useFocusEffect } from 'expo-router'
import {
  AtlasApiError,
  dismissMobileInboxItem,
  discussMobileInboxItem,
  getMobileDeviceSession,
  hydrateApiConfig,
  listMobileInbox,
  recoverMobileDeviceSession,
  respondMobileInboxItem,
  snoozeMobileInboxItem,
  type AtlasOperationalInboxItem,
} from './api/client'
import {
  OPERATIONAL_PAGE_SIZE,
  OPERATIONAL_POLL_INTERVAL_MS,
  OPERATIONAL_POLL_JITTER_MS,
} from './inboxConstants'
import {
  daysFromNowIso,
} from './inboxActionModels'
import {
  countOperationalItems,
  isActiveOperationalItem,
  mergeOperationalItems,
  operationalActionMessage,
  operationalFilterMatches,
  threadIdFromActionResult,
} from './inboxOperationalModels'
import type { OperationalFilter } from './inboxTypes'
import { syncAtlasBadge } from './pushNotifications'

interface UseOperationalInboxParams {
  enabled: boolean
  showToast: (message: string) => void
  openAtlasAi: (threadId?: string | null) => void
}

export function useOperationalInbox({
  enabled,
  showToast,
  openAtlasAi,
}: UseOperationalInboxParams) {
  const [items, setItems] = useState<AtlasOperationalInboxItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [filter, setFilter] = useState<OperationalFilter>('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mobilePaired, setMobilePaired] = useState<boolean | null>(null)
  const refreshSeq = useRef(0)

  const refresh = useCallback(async () => {
    const seq = refreshSeq.current + 1
    refreshSeq.current = seq

    try {
      await hydrateApiConfig()
      const session = getMobileDeviceSession() ?? await recoverMobileDeviceSession()
      if (!session) {
        if (seq !== refreshSeq.current) return
        setItems([])
        setCursor(null)
        setError(null)
        void syncAtlasBadge(0)
        setMobilePaired(false)
        return
      }

      const response = await listMobileInbox({ status: 'active', limit: OPERATIONAL_PAGE_SIZE })
      if (seq !== refreshSeq.current) return
      setItems(response.items.filter(isActiveOperationalItem))
      setCursor(response.next_cursor ?? null)
      setError(null)
      void syncAtlasBadge(response.unread_count)
      setMobilePaired(true)
    } catch (caught) {
      if (seq !== refreshSeq.current) return

      if (caught instanceof AtlasApiError && caught.status === 401) {
        setItems([])
        setCursor(null)
        setError(null)
        void syncAtlasBadge(0)
        setMobilePaired(false)
        return
      }

      const message = caught instanceof Error ? caught.message : 'falha ao carregar inbox operacional'
      setError(message)
      showToast(message)
    }
  }, [showToast])

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return

    setLoadingMore(true)
    try {
      const response = await listMobileInbox({
        status: 'active',
        limit: OPERATIONAL_PAGE_SIZE,
        cursor,
      })
      setError(null)
      setItems((current) => mergeOperationalItems(current, response.items.filter(isActiveOperationalItem)))
      setCursor(response.next_cursor ?? null)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'falha ao carregar mais itens'
      setError(message)
      showToast(message)
    } finally {
      setLoadingMore(false)
    }
  }, [cursor, loadingMore, showToast])

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined

      let active = true
      let pollTimer: ReturnType<typeof setTimeout> | null = null

      const scheduleNextPoll = () => {
        if (pollTimer || !active) return
        const jitter = Math.floor(Math.random() * OPERATIONAL_POLL_JITTER_MS) - OPERATIONAL_POLL_JITTER_MS / 2
        pollTimer = setTimeout(async () => {
          pollTimer = null
          if (!active || AppState.currentState !== 'active') return
          try {
            await refresh()
          } finally {
            if (active && AppState.currentState === 'active') scheduleNextPoll()
          }
        }, OPERATIONAL_POLL_INTERVAL_MS + jitter)
      }

      const stopPolling = () => {
        if (pollTimer) {
          clearTimeout(pollTimer)
          pollTimer = null
        }
      }

      void refresh()

      if (AppState.currentState === 'active') {
        scheduleNextPoll()
      }

      const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
        if (!active) return
        if (nextState === 'active') {
          void refresh()
          scheduleNextPoll()
        } else {
          stopPolling()
        }
      })

      return () => {
        active = false
        stopPolling()
        subscription.remove()
      }
    }, [enabled, refresh]),
  )

  const runAction = useCallback(async (item: AtlasOperationalInboxItem, actionId: string) => {
    if (busyId) return

    setBusyId(item.id)
    try {
      if (actionId === 'snooze') {
        await snoozeMobileInboxItem(item.id, daysFromNowIso(7), 'Item operacional adiado por sete dias pelo app.')
        showToast('item adiado por 7 dias')
      } else if (actionId === 'dismiss' || actionId === 'discard') {
        await dismissMobileInboxItem(item.id, `Ação ${actionId} pelo app.`)
        showToast('item descartado')
      } else if (actionId === 'discuss') {
        const response = await discussMobileInboxItem(item.id)
        const threadId = threadIdFromActionResult(response.result)
        if (threadId) {
          openAtlasAi(threadId)
        } else {
          showToast('Atlas aberto')
        }
      } else {
        const response = await respondMobileInboxItem(item.id, actionId)
        showToast(operationalActionMessage(actionId, response.result))
      }

      await refresh()
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'falha ao aplicar ação')
    } finally {
      setBusyId(null)
    }
  }, [busyId, openAtlasAi, refresh, showToast])

  const counts = useMemo(() => countOperationalItems(items), [items])
  const criticalCount = useMemo(
    () => items.filter((item) => item.severity === 'critical').length,
    [items],
  )
  const filteredItems = useMemo(
    () => items.filter((item) => operationalFilterMatches(item, filter)),
    [filter, items],
  )
  const showList = mobilePaired !== false && (
    items.length > 0 ||
    (!error && mobilePaired === true)
  )

  return {
    busyId,
    counts,
    criticalCount,
    cursor,
    error,
    filter,
    filteredItems,
    items,
    loadMore,
    loadingMore,
    mobilePaired,
    refresh,
    runAction,
    setFilter,
    showList,
  }
}
