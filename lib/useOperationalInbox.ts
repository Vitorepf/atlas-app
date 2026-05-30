import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { useFocusEffect } from 'expo-router'
import {
  AtlasApiError,
  clearStoredBackendHost,
  dismissMobileInboxItem,
  discussMobileInboxItem,
  getApiBase,
  getDefaultBackendHost,
  getMobileCriticalInboxReview,
  getMobileDeviceSession,
  hydrateApiConfig,
  listMobileInbox,
  recoverMobileDeviceSession,
  respondMobileInboxItem,
  snoozeMobileInboxItem,
  type AtlasOperationalInboxItem,
  type MobileCriticalInboxReviewResponse,
} from './api/client'
import {
  OPERATIONAL_CRITICAL_TIMEOUT_MS,
  OPERATIONAL_HYDRATE_GUARD_MS,
  OPERATIONAL_LIST_TIMEOUT_MS,
  OPERATIONAL_PAGE_SIZE,
  OPERATIONAL_POLL_INTERVAL_MS,
  OPERATIONAL_POLL_JITTER_MS,
  OPERATIONAL_SESSION_TIMEOUT_MS,
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

export interface OperationalInboxDiagnostics {
  apiBase: string
  lastPhase: string
  lastStatus: number | null
  lastDurationMs: number
  lastErrorDetail: string | null
}

interface DescribedError {
  human: string
  dev: string
  status: number | null
}

// Translate a raw failure into a human message (prod) and a technical message
// (dev) that names the backend host so the operator can immediately tell a
// "wrong server / unreachable host" failure from a "server returned an error".
function describeOperationalError(error: unknown, apiBase: string): DescribedError {
  if (error instanceof AtlasApiError) {
    const human = error.status >= 500
      ? 'O Atlas server falhou ao carregar a inbox operacional.'
      : error.status === 0
        ? 'Não foi possível conectar ao Atlas server.'
        : 'Não foi possível carregar a inbox operacional.'
    return { status: error.status, human, dev: `[HTTP ${error.status}] ${error.message} @ ${apiBase}` }
  }

  const message = error instanceof Error ? error.message : String(error)
  const name = (error as { name?: string } | null)?.name
  if (name === 'AbortError' || /abort|timed?\s*out|timeout/i.test(message)) {
    return {
      status: null,
      human: 'A inbox operacional não respondeu a tempo.',
      dev: `timeout/abort @ ${apiBase} — ${message}`,
    }
  }
  return {
    status: null,
    human: 'Não foi possível conectar ao Atlas server.',
    dev: `network error @ ${apiBase} — ${message}`,
  }
}

// Local-only deadline guard for operations that have NO network timeout of their
// own (hydrateApiConfig reads SecureStore/MMKV). Network calls own their own
// timeout via the fetch layer, so they are NOT wrapped here — that is exactly
// the masking race this hook used to suffer from.
function withDeadline<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_timeout_${ms}ms`)), ms)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (error) => { clearTimeout(timer); reject(error) },
    )
  })
}

function logPhase(phase: string, apiBase: string, elapsedMs: number, extra?: string): void {
  if (__DEV__) {
    console.log(`[inbox.operational] ${phase} +${elapsedMs}ms base=${apiBase}${extra ? ` ${extra}` : ''}`)
  }
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
  const [criticalReview, setCriticalReview] = useState<MobileCriticalInboxReviewResponse['critical_review'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [diagnostics, setDiagnostics] = useState<OperationalInboxDiagnostics | null>(null)
  const refreshSeq = useRef(0)

  const refresh = useCallback(async () => {
    const seq = refreshSeq.current + 1
    refreshSeq.current = seq

    const apiBase = getApiBase()
    const startedAt = Date.now()
    const elapsed = () => Date.now() - startedAt
    let phase = 'start'
    const mark = (next: string, extra?: string) => {
      phase = next
      logPhase(next, apiBase, elapsed(), extra)
    }

    setLoading(true)
    mark('refresh_start')

    try {
      // Local storage hydrate has no network timeout of its own → guarded.
      mark('hydrate_start')
      await withDeadline(hydrateApiConfig(), OPERATIONAL_HYDRATE_GUARD_MS, 'hydrate')
      mark('hydrate_ok')

      // Session: the recover path makes an HTTP call that owns its own timeout.
      mark('session_start')
      const session = getMobileDeviceSession()
        ?? await recoverMobileDeviceSession({ timeoutMs: OPERATIONAL_SESSION_TIMEOUT_MS, retry: false })
      mark('session_ok', session ? 'paired' : 'unpaired')
      if (!session) {
        if (seq !== refreshSeq.current) return
        setItems([])
        setCursor(null)
        setCriticalReview(null)
        setError(null)
        void syncAtlasBadge(0)
        setMobilePaired(false)
        return
      }

      // List: the fetch layer owns the single 10s timeout (retry:false) so a
      // real abort/HTTP error surfaces fast instead of a masked generic message.
      mark('list_start')
      const response = await listMobileInbox(
        { status: 'active', limit: OPERATIONAL_PAGE_SIZE },
        { timeoutMs: OPERATIONAL_LIST_TIMEOUT_MS, retry: false },
      )
      if (seq !== refreshSeq.current) return
      mark('list_ok', `items=${response.items.length}`)
      setItems(response.items.filter(isActiveOperationalItem))
      setCursor(response.next_cursor ?? null)
      setError(null)
      void syncAtlasBadge(response.unread_count)
      setMobilePaired(true)
      if (__DEV__) {
        setDiagnostics({ apiBase, lastPhase: 'list_ok', lastStatus: 200, lastDurationMs: elapsed(), lastErrorDetail: null })
      }

      // Critical review is best-effort and MUST NOT block or fail the list.
      try {
        mark('critical_start')
        const criticalResponse = await getMobileCriticalInboxReview(
          { limit: 6 },
          { timeoutMs: OPERATIONAL_CRITICAL_TIMEOUT_MS, retry: false },
        )
        if (seq !== refreshSeq.current) return
        mark('critical_ok')
        setCriticalReview(criticalResponse.critical_review)
      } catch (criticalError) {
        if (seq !== refreshSeq.current) return
        mark('critical_skipped')
        setCriticalReview(null)
        if (__DEV__) {
          console.warn('[inbox.operational] critical-review skipped:', describeOperationalError(criticalError, apiBase).dev)
        }
      }
    } catch (caught) {
      if (seq !== refreshSeq.current) return

      // A 401 means the device is not (or no longer) paired — local session was
      // already cleared inside the client. Show the pairing surface, not an error.
      if (caught instanceof AtlasApiError && caught.status === 401) {
        setItems([])
        setCursor(null)
        setCriticalReview(null)
        setError(null)
        void syncAtlasBadge(0)
        setMobilePaired(false)
        return
      }

      const described = describeOperationalError(caught, apiBase)
      setError(__DEV__ ? `${described.human} · ${described.dev}` : described.human)
      showToast(described.human)
      if (__DEV__) {
        setDiagnostics({
          apiBase,
          lastPhase: phase,
          lastStatus: described.status,
          lastDurationMs: elapsed(),
          lastErrorDetail: described.dev,
        })
      }
    } finally {
      // Only the latest refresh owns the loading flag; stale runs leave it alone.
      if (seq === refreshSeq.current) setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!enabled) return

    void refresh()
  }, [enabled, refresh])

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

  const discussCriticalItem = useCallback(async (id: string) => {
    if (busyId) return

    setBusyId(id)
    try {
      const response = await discussMobileInboxItem(id)
      const threadId = threadIdFromActionResult(response.result)
      if (threadId) {
        openAtlasAi(threadId)
      } else {
        showToast('Atlas aberto')
      }
      await refresh()
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'falha ao abrir discussão crítica')
    } finally {
      setBusyId(null)
    }
  }, [busyId, openAtlasAi, refresh, showToast])

  const runCriticalReviewAction = useCallback(async (id: string, actionId: 'mark_read' | 'snooze' | 'dismiss') => {
    if (busyId) return

    setBusyId(id)
    try {
      if (actionId === 'mark_read') {
        await respondMobileInboxItem(id, 'mark_read', {
          reason: 'Operador revisou o insight crítico no painel mobile.',
        })
        showToast('insight marcado como revisado')
      } else if (actionId === 'snooze') {
        await snoozeMobileInboxItem(id, daysFromNowIso(7), 'Operador revisou e adiou o insight crítico por sete dias pelo painel mobile.')
        showToast('insight crítico adiado por 7 dias')
      } else {
        await dismissMobileInboxItem(id, 'Operador revisou o insight crítico no painel mobile e decidiu descartar após avaliação humana.')
        showToast('insight crítico descartado')
      }

      await refresh()
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : 'falha ao aplicar revisão crítica')
    } finally {
      setBusyId(null)
    }
  }, [busyId, refresh, showToast])

  // Recovery: drop a stale/unreachable stored host and reconnect against the
  // build-injected default host (the LAN IP set by `npm run dev:ios`). Fixes the
  // "stored Tailscale IP is dead and shadows the working default" lockout.
  const reconnectViaDefaultHost = useCallback(async () => {
    await clearStoredBackendHost()
    if (__DEV__) console.log('[inbox.operational] host reset → default', getDefaultBackendHost())
    await refresh()
  }, [refresh])

  const defaultHost = getDefaultBackendHost()
  const apiBase = getApiBase()

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
    loading ||
    items.length > 0 ||
    (!error && mobilePaired === true) ||
    mobilePaired === null
  )

  return {
    busyId,
    counts,
    criticalCount,
    apiBase,
    criticalReview,
    cursor,
    defaultHost,
    diagnostics,
    error,
    filter,
    filteredItems,
    items,
    loadMore,
    loading,
    loadingMore,
    mobilePaired,
    discussCriticalItem,
    reconnectViaDefaultHost,
    refresh,
    runCriticalReviewAction,
    runAction,
    setFilter,
    showList,
  }
}
