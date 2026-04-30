import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AppState,
  type AppStateStatus,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import Animated, {
  Easing,
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SideSheet } from './SideSheet'
import { Frau, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useShell } from '../AtlasShell'
import { useOverlays } from '../../lib/overlays'
import {
  type AiObservabilityResponse,
  type AiProvidersStatusResponse,
  type AtlasAiCompaction,
  type AtlasAiContextSnapshot,
  type AtlasAiJob,
  type AtlasAiProviderHandoff,
  type AtlasAiProvider,
  type AtlasAiQualityAction,
  type AtlasAiQualityEvaluation,
  type AtlasAiSessionState,
  type AtlasAiStatus,
  type AtlasAiThread,
  type AtlasAiTrace,
  cancelAiJob,
  compactAiThread,
  createAiInteraction,
  feedbackAiInteraction,
  getAiObservability,
  getAiInteraction,
  getAiProvidersStatus,
  getAiThread,
  getAiThreadState,
  listAiInteractions,
  listAiQualityActions,
  listAiThreadSnapshots,
  listAiThreads,
  retryAiJob,
  runAiQualityAction,
  switchAiThreadProvider,
  updateAiThread,
} from '../../lib/api/client'
import { BronzeDiamond } from '../console/BronzeDiamond'
import { CaptionWhisper } from '../console/CaptionWhisper'
import { FieldInline } from '../console/FieldInline'
import { BottomSheet } from './BottomSheet'
import { PageResponse } from '../console/PageResponse'
import { QuoteCompact } from '../console/QuoteCompact'
import { RoutingSheet } from '../console/RoutingSheet'
import {
  ROUTING_DEFAULT,
  StatusRouting,
  type RoutingExecutor,
  type RoutingState,
  type RoutingStyle,
} from '../console/StatusRouting'
import { ThinkingState } from '../console/ThinkingState'
import { fonts } from '../../design/tokens'
import {
  TRACE_HISTORY_LIMIT,
  type AtlasAiTurnFilter,
  buildAtlasSessionMap,
  buildPinnedTraceSummary,
  isAtlasTraceActive,
  matchesAtlasTraceSearch,
  mergeAtlasTrace,
  pollIntervalForAtlasAi,
  sortAtlasTraces,
  traceMatchesClientId,
  traceMatchesTurnFilter,
} from '../../lib/atlasAiRuntime'

const OPEN_ACTION_STATUSES = new Set(['queued', 'running', 'blocked', 'failed'])
const CURRENT_THREAD_KEY = 'atlas-ai.current-thread-id'
const ROUTING_KEY = 'atlas-ai.routing'
const PINNED_TRACE_KEY_PREFIX = 'atlas-ai.pinned-traces.'

interface PendingTurn {
  clientId: string
  text: string
  startedAt: number
  status: 'sending' | 'failed'
  errorMessage?: string
  executor: RoutingExecutor
}

type TurnBody =
  | {
      kind: 'thinking'
      startedAtMs: number
      provider?: string
      detail?: string
      trace?: AtlasAiTrace
      onOpenExecution?: (trace: AtlasAiTrace) => void
    }
  | {
      kind: 'response'
      text: string
      attribution: string
      trace: AtlasAiTrace
      onFeedback: (trace: AtlasAiTrace, action: FeedbackAction) => void
      onRunQualityAction: (action: AtlasAiQualityAction) => void
      onOpenExecution: (trace: AtlasAiTrace) => void
      onTogglePin: (trace: AtlasAiTrace) => void
      pinned: boolean
    }
  | { kind: 'error'; message: string; onRetry?: () => void }

interface DisplayTurn {
  key: string
  text: string
  body: TurnBody
}

type FeedbackAction = 'useful' | 'wrong_context' | 'too_long' | 'weak'

export function AtlasAiSheet() {
  const open = useOverlays((s) => s.open)
  const close = useOverlays((s) => s.close)
  const visible = open === 'atlasAi'
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { showToast } = useShell()
  const scrollRef = useRef<ScrollView>(null)

  const [draft, setDraft] = useState('')
  const [traces, setTraces] = useState<AtlasAiTrace[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [routing, setRouting] = useState<RoutingState>(ROUTING_DEFAULT)
  const [routingOpen, setRoutingOpen] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [pending, setPending] = useState<PendingTurn | null>(null)
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null)
  const [currentThread, setCurrentThread] = useState<AtlasAiThread | null>(null)
  const [sessionState, setSessionState] = useState<AtlasAiSessionState | null>(null)
  const [threadList, setThreadList] = useState<AtlasAiThread[]>([])
  const [threadHistoryOpen, setThreadHistoryOpen] = useState(false)
  const [providerStatus, setProviderStatus] = useState<AiProvidersStatusResponse | null>(null)
  const [observability, setObservability] = useState<AiObservabilityResponse | null>(null)
  const [qualityActions, setQualityActions] = useState<AtlasAiQualityAction[]>([])
  const [operationBusy, setOperationBusy] = useState<string | null>(null)
  const [routingHydrated, setRoutingHydrated] = useState(false)
  const [contextOpen, setContextOpen] = useState(false)
  const [operationsOpen, setOperationsOpen] = useState(false)
  const [executionOpen, setExecutionOpen] = useState(false)
  const [executionTrace, setExecutionTrace] = useState<AtlasAiTrace | null>(null)
  const [executionLoading, setExecutionLoading] = useState(false)
  const [contextSnapshots, setContextSnapshots] = useState<AtlasAiContextSnapshot[]>([])
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [sessionMapOpen, setSessionMapOpen] = useState(false)
  const [continuityExpanded, setContinuityExpanded] = useState(false)
  const [turnFilter, setTurnFilter] = useState<AtlasAiTurnFilter>('all')
  const [pinnedTraceIds, setPinnedTraceIds] = useState<string[]>([])
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
  const [lastRefreshError, setLastRefreshError] = useState<string | null>(null)
  const [refreshFailures, setRefreshFailures] = useState(0)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)

  // Skip mount-in animations during the first ~360ms after the sheet opens
  // (otherwise every existing trace would dramatically animate on every open).
  // After the grace period, only NEW arrivals animate.
  const [animationsReady, setAnimationsReady] = useState(false)
  useEffect(() => {
    if (!visible) {
      setAnimationsReady(false)
      return
    }
    const t = setTimeout(() => setAnimationsReady(true), 360)
    return () => clearTimeout(t)
  }, [visible])

  const activeTrace = useMemo(
    () => [...traces].reverse().find(isAtlasTraceActive) ?? null,
    [traces],
  )
  const latestTrace = useMemo(() => traces[traces.length - 1] ?? null, [traces])
  const hasActiveTrace = activeTrace != null
  const isPendingSending = pending?.status === 'sending'
  const canSubmit =
    draft.trim().length > 0 && !submitting && !hasActiveTrace && !isPendingSending
  const activeTraceAgeMs = activeTrace ? Date.now() - new Date(activeTrace.created_at).getTime() : null
  const visibleTraces = useMemo(
    () => traces.filter((trace) => traceMatchesTurnFilter(trace, turnFilter, pinnedTraceIds)),
    [pinnedTraceIds, traces, turnFilter],
  )

  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem(ROUTING_KEY)
      .then((stored) => {
        if (cancelled) return
        setRouting(normalizeStoredRouting(stored))
      })
      .finally(() => {
        if (!cancelled) setRoutingHydrated(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!routingHydrated) return
    void AsyncStorage.setItem(ROUTING_KEY, JSON.stringify(routing))
  }, [routing, routingHydrated])

  useEffect(() => {
    let cancelled = false

    async function hydratePins() {
      if (!currentThreadId) {
        setPinnedTraceIds([])
        return
      }

      try {
        const stored = await AsyncStorage.getItem(pinnedTraceStorageKey(currentThreadId))
        if (cancelled) return
        const parsed = stored ? JSON.parse(stored) : []
        setPinnedTraceIds(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [])
      } catch {
        if (!cancelled) setPinnedTraceIds([])
      }
    }

    void hydratePins()
    return () => {
      cancelled = true
    }
  }, [currentThreadId])

  useEffect(() => {
    if (!currentThreadId) return
    void AsyncStorage.setItem(pinnedTraceStorageKey(currentThreadId), JSON.stringify(pinnedTraceIds.slice(0, 24)))
  }, [currentThreadId, pinnedTraceIds])

  const loadThreadData = useCallback(
    async (threadId: string | null, { silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setLoading(true)
      setError(null)

      try {
        const [
          interactionsResponse,
          threadResponse,
          stateResponse,
          providersResponse,
          observabilityResponse,
          actionsResponse,
          threadsResponse,
          snapshotsResponse,
        ] = await Promise.all([
          threadId
            ? listAiInteractions({ limit: TRACE_HISTORY_LIMIT, thread_id: threadId })
            : Promise.resolve({ traces: [] }),
          threadId ? getAiThread(threadId).catch(() => null) : Promise.resolve(null),
          threadId ? getAiThreadState(threadId).catch(() => null) : Promise.resolve(null),
          getAiProvidersStatus().catch(() => null),
          getAiObservability({ hours: 24 }).catch(() => null),
          threadId
            ? listAiQualityActions({ thread_id: threadId, limit: 30 }).catch(() => null)
            : Promise.resolve(null),
          listAiThreads({
            status: 'active',
            surface: 'atlas_ai_sheet',
            limit: 20,
          }).catch(() => null),
          threadId ? listAiThreadSnapshots(threadId, { limit: 12 }).catch(() => null) : Promise.resolve(null),
        ])

        const threads = threadsResponse?.threads ?? []
        const thread = threadResponse?.thread ?? threads.find((item) => item.id === threadId) ?? null

        setTraces(sortAtlasTraces(interactionsResponse.traces))
        setCurrentThread(thread)
        setSessionState(stateResponse?.state ?? thread?.active_state ?? null)
        setProviderStatus(providersResponse)
        setObservability(observabilityResponse)
        setQualityActions(actionsResponse?.actions ?? [])
        setThreadList(threads)
        setContextSnapshots(snapshotsResponse?.snapshots ?? [])
        setLastRefreshAt(Date.now())
        setLastRefreshError(null)
        setRefreshFailures(0)
      } catch (refreshError) {
        const message = humanAiError(refreshError, 'Falha ao carregar Atlas.')
        setLastRefreshError(message)
        setRefreshFailures((count) => count + 1)
        if (!silent) setError(message)
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [],
  )

  const refresh = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      await loadThreadData(currentThreadId, { silent })
    },
    [currentThreadId, loadThreadData],
  )

  useEffect(() => {
    if (!visible) return
    let cancelled = false

    async function hydrateThread() {
      setLoading(true)
      setError(null)
      try {
        let threadId = await AsyncStorage.getItem(CURRENT_THREAD_KEY)

        const threadsResponse = await listAiThreads({
          status: 'active',
          surface: 'atlas_ai_sheet',
          limit: 20,
        }).catch(() => null)
        const activeThreads = threadsResponse?.threads ?? []
        if (!cancelled) setThreadList(activeThreads)

        if (threadId && !activeThreads.some((thread) => thread.id === threadId)) {
          threadId = activeThreads[0]?.id ?? null
        }

        if (!threadId) {
          threadId = activeThreads[0]?.id ?? null
          if (threadId) {
            await AsyncStorage.setItem(CURRENT_THREAD_KEY, threadId)
          } else {
            await AsyncStorage.removeItem(CURRENT_THREAD_KEY)
          }
        }

        if (cancelled) return
        setCurrentThreadId(threadId)
        await loadThreadData(threadId, { silent: true })
      } catch (hydrateError) {
        if (!cancelled) setError(humanAiError(hydrateError, 'Falha ao carregar Atlas.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void hydrateThread()
    return () => {
      cancelled = true
    }
  }, [loadThreadData, visible])

  useEffect(() => {
    if (!visible) return

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previous = appStateRef.current
      appStateRef.current = nextState
      if (previous !== 'active' && nextState === 'active') {
        void refresh({ silent: true })
      }
    })

    return () => subscription.remove()
  }, [refresh, visible])

  useEffect(() => {
    if (!visible || !activeTrace) return

    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      if (cancelled) return
      const createdAt = new Date(activeTrace.created_at).getTime()
      const ageMs = Number.isFinite(createdAt) ? Date.now() - createdAt : null
      const delay = pollIntervalForAtlasAi({
        hasActiveTrace: true,
        failureCount: refreshFailures,
        activeTraceAgeMs: ageMs,
        appIsActive: appStateRef.current === 'active',
      })
      if (delay == null) return

      timeout = setTimeout(() => {
        void refresh({ silent: true }).finally(schedule)
      }, delay)
    }

    schedule()

    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)
    }
  }, [activeTrace, refresh, refreshFailures, visible])

  // Drop pending the moment its real twin appears via polling, so we don't
  // render the same turn twice after retries or request timeouts.
  useEffect(() => {
    if (!pending) return
    const matched = traces.find((trace) => traceMatchesClientId(trace, pending.clientId))
    if (matched) setPending(null)
  }, [traces, pending])

  // Reset transient state when the sheet closes.
  useEffect(() => {
    if (!visible) {
      setPending(null)
      setError(null)
    }
  }, [visible])

  // Keyboard handling — push footer above the keyboard manually since
  // KeyboardAvoidingView misbehaves inside SideSheet's absolute wrapper.
  useEffect(() => {
    if (!visible) return
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'

    const show = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
    })
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [visible])

  // Auto-scroll on new content (real or optimistic).
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60)
    return () => clearTimeout(t)
  }, [traces.length, pending?.clientId, visible])

  const submitText = useCallback(
    async (input: string) => {
      if (!input || submitting) return
      if (hasActiveTrace || isPendingSending) {
        showToast('Atlas ainda está pensando')
        return
      }

      const clientId = newClientId()
      const optimistic: PendingTurn = {
        clientId,
        text: input,
        startedAt: Date.now(),
        status: 'sending',
        executor: routing.executor,
      }

      // Optimistic UI: clear input + push pending turn synchronously,
      // then fire haptic + request in the background.
      setDraft('')
      setPending(optimistic)
      setError(null)
      setSubmitting(true)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)

      try {
        const councilMode = routing.executor === 'claude_codex'
        const provider: AtlasAiProvider | undefined =
          routing.executor === 'auto'
            ? undefined
            : (routing.executor as AtlasAiProvider)
        const agent = effectiveAgent(routing)
        const kind = councilMode
          ? 'council'
          : routing.task === 'direct'
            ? 'interaction'
            : 'analysis'
        const executionPolicy = councilMode ? 'dual_review' : 'single_provider'
        const conversationContext = buildConversationContext(traces, currentThreadId, pinnedTraceIds)
        const responsePolicy = responsePolicyFor(routing.style, routing.task)

        const response = await createAiInteraction({
          input_text: input,
          client_id: clientId,
          thread_id: currentThreadId ?? undefined,
          new_thread: currentThreadId ? false : true,
          agent_slug: agent,
          provider,
          kind,
          source_type: 'app',
          include_semantic_context: true,
          context_note_limit: 5,
          payload: {
            app_surface: 'atlas_ai_sheet',
            atlas_workflow_mode: routing.task === 'debug' ? 'dev' : routing.task,
            requested_agent: routing.domain,
            requested_provider: routing.executor,
            response_style: routing.style,
            response_policy: responsePolicy,
            task_type: routing.task === 'debug' ? 'debug' : undefined,
            constraints: responsePolicy.constraints,
            execution_policy: executionPolicy,
            conversation_context: conversationContext,
            council_providers: councilMode ? ['claude_cli', 'codex_cli'] : undefined,
            council_rule: councilMode
              ? 'both_propose_or_review; execution_requires_single_provider'
              : undefined,
          },
        })

        if (response.trace.thread_id) {
          setCurrentThreadId(response.trace.thread_id)
          await AsyncStorage.setItem(CURRENT_THREAD_KEY, response.trace.thread_id)
        }

        // Real trace arrived. Add it and clear pending atomically (React
        // batches both updates). The Turn is keyed by clientId so the
        // existing QuoteCompact stays mounted across the swap (no flash).
        setTraces((current) => mergeAtlasTrace(response.trace, current))
        setPending((curr) => (curr?.clientId === clientId ? null : curr))
        void loadThreadData(response.trace.thread_id ?? currentThreadId, { silent: true })
      } catch (submitError) {
        const message = humanAiError(submitError, 'falha no envio.')
        setPending((curr) =>
          curr?.clientId === clientId
            ? { ...curr, status: 'failed', errorMessage: message }
            : curr,
        )
      } finally {
        setSubmitting(false)
      }
    },
    [
      routing,
      submitting,
      hasActiveTrace,
      isPendingSending,
      showToast,
      traces,
      currentThreadId,
      pinnedTraceIds,
      loadThreadData,
    ],
  )

  const submit = useCallback(() => {
    void submitText(draft.trim())
  }, [submitText, draft])

  const retryPending = useCallback(() => {
    if (!pending || pending.status !== 'failed') return
    const text = pending.text
    setPending(null)
    void submitText(text)
  }, [pending, submitText])

  const startNewThread = useCallback(() => {
    if (hasActiveTrace || isPendingSending) {
      showToast('Atlas ainda está pensando')
      return
    }

    setCurrentThreadId(null)
    setCurrentThread(null)
    setSessionState(null)
    setTraces([])
    setQualityActions([])
    setContextSnapshots([])
    setPending(null)
    setDraft('')
    setError(null)
    setThreadHistoryOpen(false)
    void AsyncStorage.removeItem(CURRENT_THREAD_KEY)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [hasActiveTrace, isPendingSending, showToast])

  const selectThread = useCallback(
    async (thread: AtlasAiThread) => {
      if (hasActiveTrace || isPendingSending) {
        showToast('Atlas ainda está pensando')
        return
      }

      setThreadHistoryOpen(false)
      setCurrentThreadId(thread.id)
      setCurrentThread(thread)
      setSessionState(thread.active_state ?? null)
      await AsyncStorage.setItem(CURRENT_THREAD_KEY, thread.id)
      await loadThreadData(thread.id, { silent: false })
    },
    [hasActiveTrace, isPendingSending, loadThreadData, showToast],
  )

  const compactCurrentThread = useCallback(async () => {
    if (!currentThreadId) {
      showToast('Abra uma conversa antes de compactar')
      return
    }
    if (hasActiveTrace || isPendingSending) {
      showToast('Atlas ainda está pensando')
      return
    }

    setOperationBusy('compact')
    try {
      const response = await compactAiThread(currentThreadId, {
        reason: 'manual',
        provider: providerFromRouting(routing) ?? currentThread?.last_provider ?? null,
        metadata: {
          app_surface: 'atlas_ai_sheet',
          requested_from: 'continuity_panel',
        },
      })
      setCurrentThread(response.thread)
      setSessionState(response.thread.active_state ?? sessionState)
      showToast('Contexto compactado')
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (compactError) {
      showToast(humanAiError(compactError, 'Falha ao compactar.'))
    } finally {
      setOperationBusy(null)
    }
  }, [
    currentThread?.last_provider,
    currentThreadId,
    hasActiveTrace,
    isPendingSending,
    routing,
    sessionState,
    showToast,
  ])

  const switchProvider = useCallback(
    async (executor: Extract<RoutingExecutor, 'claude_cli' | 'codex_cli' | 'claude_codex'>) => {
      const previousRouting = routing
      setRouting((current) => ({ ...current, executor }))
      if (!currentThreadId) return

      setOperationBusy(`provider:${executor}`)
      try {
        const response = await switchAiThreadProvider(currentThreadId, {
          to_provider: executor,
          from_provider: currentThread?.last_provider ?? providerFromRouting(routing) ?? null,
          reason: 'operator_switch',
          metadata: {
            app_surface: 'atlas_ai_sheet',
            requested_from: 'continuity_panel',
          },
        })
        setCurrentThread((thread) =>
          thread
            ? {
                ...thread,
                last_provider: executor,
                latest_provider_handoff: response.handoff,
              }
            : thread,
        )
        showToast(`Próxima resposta: ${providerWord(executor) ?? executor}`)
      } catch (providerError) {
        setRouting(previousRouting)
        showToast(humanAiError(providerError, 'Falha ao trocar provider.'))
      } finally {
        setOperationBusy(null)
      }
    },
    [currentThread?.last_provider, currentThreadId, routing, showToast],
  )

  const confirmRouting = useCallback(
    (next: RoutingState) => {
      const previousProvider = providerFromRouting(routing)
      const nextProvider = providerFromRouting(next)
      setRouting(next)

      if (
        currentThreadId
        && nextProvider
        && nextProvider !== previousProvider
      ) {
        void switchAiThreadProvider(currentThreadId, {
          to_provider: nextProvider,
          from_provider: currentThread?.last_provider ?? previousProvider ?? null,
          reason: 'routing_sheet_switch',
          metadata: {
            app_surface: 'atlas_ai_sheet',
            requested_from: 'routing_sheet',
          },
        })
          .then((response) => {
            setCurrentThread((thread) =>
              thread
                ? {
                    ...thread,
                    last_provider: nextProvider,
                    latest_provider_handoff: response.handoff,
                  }
                : thread,
            )
          })
          .catch(() => {})
      }
    },
    [currentThread?.last_provider, currentThreadId, routing],
  )

  const submitFeedback = useCallback(
    async (trace: AtlasAiTrace, action: FeedbackAction) => {
      setOperationBusy(`feedback:${trace.id}`)
      try {
        const feedback = feedbackPayload(action)
        const response = await feedbackAiInteraction(trace.id, feedback)
        setTraces((current) => mergeAtlasTrace(response.trace, current))
        showToast(feedbackToast(action))
      } catch (feedbackError) {
        showToast(humanAiError(feedbackError, 'Falha ao registrar feedback.'))
      } finally {
        setOperationBusy(null)
      }
    },
    [showToast],
  )

  const runQualityAction = useCallback(
    async (action: AtlasAiQualityAction) => {
      setOperationBusy(`quality:${action.id}`)
      try {
        const response = await runAiQualityAction(action.id)
        setQualityActions((current) => mergeQualityAction(response.action, current))
        if (response.action.remediation_trace) {
          setTraces((current) => mergeAtlasTrace(response.action.remediation_trace as AtlasAiTrace, current))
        }
        await loadThreadData(currentThreadId, { silent: true })
        showToast('Correção acionada')
      } catch (qualityError) {
        showToast(humanAiError(qualityError, 'Falha ao acionar correção.'))
      } finally {
        setOperationBusy(null)
      }
    },
    [currentThreadId, loadThreadData, showToast],
  )

  const archiveThread = useCallback(
    async (thread: AtlasAiThread) => {
      if (thread.id === currentThreadId && (hasActiveTrace || isPendingSending)) {
        showToast('Atlas ainda está pensando')
        return
      }

      setOperationBusy(`archive:${thread.id}`)
      try {
        await updateAiThread(thread.id, { status: 'archived' })
        setThreadList((current) => current.filter((item) => item.id !== thread.id))
        if (thread.id === currentThreadId) {
          startNewThread()
        }
        showToast('Sessão arquivada')
      } catch (archiveError) {
        showToast(humanAiError(archiveError, 'Falha ao arquivar sessão.'))
      } finally {
        setOperationBusy(null)
      }
    },
    [currentThreadId, hasActiveTrace, isPendingSending, showToast, startNewThread],
  )

  const retryJob = useCallback(
    async (job: AtlasAiJob) => {
      setOperationBusy(`retry:${job.id}`)
      try {
        const response = await retryAiJob(job.id)
        setExecutionTrace((trace) => trace ? mergeJobIntoTrace(response.job, trace) : trace)
        if (currentThreadId) await loadThreadData(currentThreadId, { silent: true })
        showToast('Job reenfileirado')
      } catch (retryError) {
        showToast(humanAiError(retryError, 'Falha ao repetir job.'))
      } finally {
        setOperationBusy(null)
      }
    },
    [currentThreadId, loadThreadData, showToast],
  )

  const cancelJob = useCallback(
    async (job: AtlasAiJob) => {
      setOperationBusy(`cancel:${job.id}`)
      try {
        const response = await cancelAiJob(job.id)
        setExecutionTrace((trace) => trace ? mergeJobIntoTrace(response.job, trace) : trace)
        if (currentThreadId) await loadThreadData(currentThreadId, { silent: true })
        showToast('Job cancelado')
      } catch (cancelError) {
        showToast(humanAiError(cancelError, 'Falha ao cancelar job.'))
      } finally {
        setOperationBusy(null)
      }
    },
    [currentThreadId, loadThreadData, showToast],
  )

  const openExecution = useCallback(
    async (trace: AtlasAiTrace) => {
      setExecutionTrace(trace)
      setExecutionOpen(true)
      setExecutionLoading(true)

      try {
        const response = await getAiInteraction(trace.id)
        setExecutionTrace(response.trace)
        setTraces((current) => mergeAtlasTrace(response.trace, current))
      } catch (executionError) {
        showToast(humanAiError(executionError, 'Falha ao carregar execução.'))
      } finally {
        setExecutionLoading(false)
      }
    },
    [showToast],
  )

  const togglePinnedTrace = useCallback((trace: AtlasAiTrace) => {
    setPinnedTraceIds((current) => {
      if (current.includes(trace.id)) return current.filter((id) => id !== trace.id)
      return [trace.id, ...current].slice(0, 24)
    })
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  // Derive the unified list of display turns from traces + pending.
  // Stable keys (trace_key for real, clientId for optimistic) keep React
  // from remounting the QuoteCompact when an optimistic becomes real.
  const turns = useMemo<DisplayTurn[]>(() => {
    const seen = new Set<string>()
    const list: DisplayTurn[] = []

    for (const trace of visibleTraces) {
      const key = trace.trace_key || trace.id
      if (seen.has(key)) continue
      seen.add(key)
      list.push({
        key,
        text: trace.operator_input,
        body: bodyFromTrace(
          trace,
          submitFeedback,
          runQualityAction,
          openExecution,
          togglePinnedTrace,
          pinnedTraceIds.includes(trace.id),
        ),
      })
    }

    if (pending && !seen.has(pending.clientId)) {
      list.push({
        key: pending.clientId,
        text: pending.text,
        body:
          pending.status === 'sending'
            ? {
                kind: 'thinking',
                startedAtMs: pending.startedAt,
                provider: executorAsProviderWord(pending.executor),
                detail: 'criando trace e preservando continuidade',
              }
            : {
                kind: 'error',
                message: pending.errorMessage ?? 'a interação falhou.',
                onRetry: retryPending,
              },
      })
    }

    return list
  }, [visibleTraces, pending, retryPending, submitFeedback, runQualityAction, openExecution, pinnedTraceIds, togglePinnedTrace])

  const footerPaddingBottom =
    keyboardHeight > 0
      ? Math.max(8, keyboardHeight - insets.bottom + 8)
      : Math.max(12, insets.bottom + 8)

  return (
    <SideSheet visible={visible}>
      <View style={styles.fill}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <Pressable
            onPress={close}
            style={({ pressed }) => [styles.headerSlot, { opacity: pressed ? 0.55 : 1 }]}
          >
            <Sans size={15} color={c.ink}>
              ← Voltar
            </Sans>
          </Pressable>
          <Frau size={26} lineHeight={32} align="center" color={c.ink}>
            Atlas
          </Frau>
          <View style={[styles.headerSlot, styles.headerSlotRight, styles.headerActions]}>
            <Pressable
              onPress={() => setThreadHistoryOpen(true)}
              disabled={hasActiveTrace || isPendingSending}
              hitSlop={10}
              style={({ pressed }) => [
                styles.headerAction,
                { opacity: pressed ? 0.55 : hasActiveTrace || isPendingSending ? 0.35 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="histórico de conversas"
            >
              <Sans size={18} lineHeight={22} color={c.ink2}>
                ≡
              </Sans>
            </Pressable>
            <Pressable
              onPress={startNewThread}
              disabled={hasActiveTrace || isPendingSending}
              hitSlop={10}
              style={({ pressed }) => [
                styles.headerAction,
                { opacity: pressed ? 0.55 : hasActiveTrace || isPendingSending ? 0.35 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="nova conversa"
            >
              <Sans size={22} lineHeight={24} color={c.ink2}>
                +
              </Sans>
            </Pressable>
            <Pressable
              onPress={() => void refresh()}
              disabled={loading}
              hitSlop={10}
              style={({ pressed }) => [
                styles.headerAction,
                { opacity: pressed ? 0.55 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="recarregar"
            >
              <SyncDiamond pulsing={loading} />
            </Pressable>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          <ContinuityPanel
            thread={currentThread}
            state={sessionState}
            compaction={currentThread?.latest_compaction ?? null}
            handoff={currentThread?.latest_provider_handoff ?? null}
            providerStatus={providerStatus}
            observability={observability}
            qualityActions={qualityActions}
            latestTrace={latestTrace}
            activeTrace={activeTrace}
            activeTraceAgeMs={activeTraceAgeMs}
            lastRefreshAt={lastRefreshAt}
            lastRefreshError={lastRefreshError}
            refreshFailures={refreshFailures}
            pinnedCount={pinnedTraceIds.length}
            turnFilter={turnFilter}
            busy={operationBusy}
            disabled={hasActiveTrace || isPendingSending}
            onCompact={compactCurrentThread}
            onOpenThreads={() => setThreadHistoryOpen(true)}
            onOpenContext={() => setContextOpen(true)}
            onOpenOperations={() => setOperationsOpen(true)}
            onOpenExecution={openExecution}
            onOpenSkills={() => setSkillsOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            onOpenMap={() => setSessionMapOpen(true)}
            onSetTurnFilter={setTurnFilter}
            expanded={continuityExpanded}
            onToggleExpanded={() => setContinuityExpanded((value) => !value)}
            hasTurns={turns.length > 0}
          />

          {error && (
            <View style={styles.errorRow}>
              <Frau italic size={14} lineHeight={20} color={c.recRed}>
                {error}
              </Frau>
            </View>
          )}

          {turns.length === 0 && !error && (
            turnFilter === 'all'
              ? <EmptyPage />
              : <FilteredEmpty filter={turnFilter} onReset={() => setTurnFilter('all')} />
          )}

          <LayoutAnimationConfig skipEntering={!animationsReady}>
            {turns.map((turn, index) => (
              <View
                key={turn.key}
                style={[
                  styles.turn,
                  index < turns.length - 1 && styles.turnSeparator,
                ]}
              >
                <QuoteCompact text={turn.text} />
                <View style={styles.afterQuote}>
                  <TurnBodyView body={turn.body} />
                </View>
              </View>
            ))}
          </LayoutAnimationConfig>
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              backgroundColor: c.bg,
              paddingBottom: footerPaddingBottom,
            },
          ]}
        >
          <StatusRouting state={routing} onPress={() => setRoutingOpen(true)} />
          <FieldInline
            value={draft}
            onChangeText={setDraft}
            onSubmit={submit}
            disabled={submitting || hasActiveTrace || isPendingSending}
            placeholder={turns.length === 0 ? 'diga ao atlas…' : 'continuar…'}
          />
        </View>
      </View>

      <RoutingSheet
        visible={routingOpen}
        initial={routing}
        onClose={() => setRoutingOpen(false)}
        onConfirm={confirmRouting}
      />

      <ThreadHistorySheet
        visible={threadHistoryOpen}
        threads={threadList}
        currentThreadId={currentThreadId}
        onClose={() => setThreadHistoryOpen(false)}
        onSelect={selectThread}
        onNew={startNewThread}
        onArchive={archiveThread}
      />

      <ContextSheet
        visible={contextOpen}
        thread={currentThread}
        state={sessionState}
        compaction={currentThread?.latest_compaction ?? null}
        handoff={currentThread?.latest_provider_handoff ?? null}
        snapshots={contextSnapshots}
        latestTrace={latestTrace}
        onClose={() => setContextOpen(false)}
      />

      <OperationsSheet
        visible={operationsOpen}
        providerStatus={providerStatus}
        observability={observability}
        qualityActions={qualityActions}
        onClose={() => setOperationsOpen(false)}
        onRunQualityAction={runQualityAction}
      />

      <ExecutionSheet
        visible={executionOpen}
        trace={executionTrace}
        loading={executionLoading}
        onClose={() => setExecutionOpen(false)}
        onRefresh={(trace) => void openExecution(trace)}
        onRunQualityAction={runQualityAction}
        onRetryJob={retryJob}
        onCancelJob={cancelJob}
      />

      <SkillsSheet
        visible={skillsOpen}
        traces={traces}
        qualityActions={qualityActions}
        onClose={() => setSkillsOpen(false)}
      />

      <SearchSheet
        visible={searchOpen}
        traces={traces}
        pinnedTraceIds={pinnedTraceIds}
        onClose={() => setSearchOpen(false)}
        onOpenExecution={openExecution}
        onTogglePin={togglePinnedTrace}
      />

      <SessionMapSheet
        visible={sessionMapOpen}
        state={sessionState}
        traces={traces}
        qualityActions={qualityActions}
        pinnedTraceIds={pinnedTraceIds}
        onClose={() => setSessionMapOpen(false)}
      />
    </SideSheet>
  )
}

function EmptyPage() {
  const { c } = useTheme()
  return (
    <View style={styles.empty}>
      <BronzeDiamond size={16} />
      <View style={{ height: 32 }} />
      <Frau italic size={22} lineHeight={32} align="center" color={c.ink}>
        “O que você quer pensar agora?”
      </Frau>
    </View>
  )
}

function FilteredEmpty({ filter, onReset }: { filter: AtlasAiTurnFilter; onReset: () => void }) {
  const { c } = useTheme()
  return (
    <Pressable
      onPress={onReset}
      style={({ pressed }) => [styles.empty, { opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel="limpar filtro"
    >
      <BronzeDiamond size={14} opacity={0.65} />
      <View style={{ height: 22 }} />
      <Frau italic size={18} lineHeight={27} align="center" color={c.ink2}>
        sem itens em {turnFilterLabel(filter, 0)} · tocar para voltar
      </Frau>
    </Pressable>
  )
}

function TurnBodyView({ body }: { body: TurnBody }) {
  if (body.kind === 'thinking') {
    return (
      <>
        <ThinkingState startedAtMs={body.startedAtMs} provider={body.provider} />
        {body.detail && <CaptionWhisper text={body.detail} />}
        {body.trace && <TraceProgress trace={body.trace} />}
        {body.trace && body.onOpenExecution && (
          <View style={styles.feedbackRow}>
            <FeedbackButton
              label="execução"
              onPress={() => body.onOpenExecution?.(body.trace as AtlasAiTrace)}
            />
          </View>
        )}
      </>
    )
  }
  if (body.kind === 'error') {
    return <RetryRow message={body.message} onRetry={body.onRetry} />
  }
  return (
    <>
      <PageResponse text={body.text} />
      <CaptionWhisper text={body.attribution} />
      <QualityBar
        trace={body.trace}
        onRunQualityAction={body.onRunQualityAction}
      />
      <View style={styles.feedbackRow}>
        <FeedbackButton
          label={body.pinned ? 'fixado' : 'fixar'}
          active={body.pinned}
          onPress={() => body.onTogglePin(body.trace)}
        />
        <FeedbackButton
          label="execução"
          onPress={() => body.onOpenExecution(body.trace)}
        />
      </View>
      <FeedbackRow trace={body.trace} onFeedback={body.onFeedback} />
    </>
  )
}

function RetryRow({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { c } = useTheme()
  return (
    <Pressable
      onPress={onRetry}
      disabled={!onRetry}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1, paddingVertical: 8 })}
      accessibilityRole="button"
      accessibilityLabel="tentar novamente"
    >
      <Frau italic size={14} lineHeight={20} color={c.recRed}>
        × {message}
        {onRetry ? '  — tocar para tentar' : ''}
      </Frau>
    </Pressable>
  )
}

function TraceProgress({ trace }: { trace: AtlasAiTrace }) {
  const { c } = useTheme()
  const jobs = trace.jobs?.length ? trace.jobs : trace.job ? [trace.job] : []
  if (jobs.length === 0) return null

  return (
    <View style={[styles.progressBox, { borderTopColor: c.border }]}>
      {jobs.map((job) => (
        <View key={job.id} style={styles.progressRow}>
          <View style={styles.progressMain}>
            <Sans weight="med" size={12} lineHeight={17} color={c.ink}>
              {providerWord(job.provider) ?? job.provider ?? 'atlas'}
            </Sans>
            <Sans size={11} lineHeight={16} color={c.ink2}>
              {job.status === 'queued'
                ? queuePhrase(job)
                : job.status === 'processing'
                  ? processingPhrase(job)
                  : statusLabel(job.status)}
            </Sans>
          </View>
          <StatusPill status={job.status} />
        </View>
      ))}
    </View>
  )
}

function ContinuityPanel({
  thread,
  state,
  compaction,
  handoff,
  providerStatus,
  observability,
  qualityActions,
  latestTrace,
  activeTrace,
  activeTraceAgeMs,
  lastRefreshAt,
  lastRefreshError,
  refreshFailures,
  pinnedCount,
  turnFilter,
  busy,
  disabled,
  onCompact,
  onOpenThreads,
  onOpenContext,
  onOpenOperations,
  onOpenExecution,
  onOpenSkills,
  onOpenSearch,
  onOpenMap,
  onSetTurnFilter,
  expanded,
  onToggleExpanded,
  hasTurns,
}: {
  thread: AtlasAiThread | null
  state: AtlasAiSessionState | null
  compaction: AtlasAiCompaction | null
  handoff: AtlasAiProviderHandoff | null
  providerStatus: AiProvidersStatusResponse | null
  observability: AiObservabilityResponse | null
  qualityActions: AtlasAiQualityAction[]
  latestTrace: AtlasAiTrace | null
  activeTrace: AtlasAiTrace | null
  activeTraceAgeMs: number | null
  lastRefreshAt: number | null
  lastRefreshError: string | null
  refreshFailures: number
  pinnedCount: number
  turnFilter: AtlasAiTurnFilter
  busy: string | null
  disabled: boolean
  onCompact: () => void
  onOpenThreads: () => void
  onOpenContext: () => void
  onOpenOperations: () => void
  onOpenExecution: (trace: AtlasAiTrace) => void
  onOpenSkills: () => void
  expanded: boolean
  onToggleExpanded: () => void
  onOpenSearch: () => void
  onOpenMap: () => void
  onSetTurnFilter: (filter: AtlasAiTurnFilter) => void
  hasTurns: boolean
}) {
  const { c } = useTheme()
  const openActions = qualityActions.filter((action) => OPEN_ACTION_STATUSES.has(action.status))
  const queue = providerStatus?.queue ?? observability?.jobs
  const topic = state?.current_topic || state?.objective || thread?.summary || 'sem sessão ativa'
  const compactionLabel = compaction
    ? `compactado ${formatRelative(compaction.created_at)} · ${compaction.quality_gate_status}`
    : 'sem compactação manual'
  const handoffLabel = handoff
    ? `handoff para ${providerWord(handoff.to_provider) ?? handoff.to_provider} ${formatRelative(handoff.created_at)}`
    : 'sem troca recente'

  return (
    <View style={[styles.continuityPanel, expanded ? styles.continuityPanelOpen : null, { borderBottomColor: c.border }]}>
      <View style={styles.continuityTop}>
        <Pressable
          onPress={onOpenThreads}
          hitSlop={8}
          style={({ pressed }) => [styles.continuityTitle, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity: 0.55 }}>
            continuidade
          </Frau>
          <Sans weight="med" size={14} lineHeight={19} color={c.ink} numberOfLines={1}>
            {thread?.title ?? 'nova conversa'}
          </Sans>
        </Pressable>
        <Pressable
          onPress={onToggleExpanded}
          hitSlop={10}
          style={({ pressed }) => [styles.continuityToggle, { opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'recolher diagnóstico' : 'expandir diagnóstico'}
        >
          <Frau italic size={12} lineHeight={16} color={c.ink} style={{ opacity: 0.4 }}>
            · {expanded ? 'recolher' : 'expandir'}
          </Frau>
        </Pressable>
      </View>

      {expanded ? (
        <>
          <View style={styles.continuityRows}>
            <MicroLine label="estado" value={topic} />
            <MicroLine label="memória" value={compactionLabel} />
            <MicroLine label="troca" value={handoffLabel} />
            <MicroLine
              label="operação"
              value={`fila ${queue?.queued ?? 0} · rodando ${queue?.processing ?? 0} · ações ${openActions.length}`}
            />
            <MicroLine
              label="qualidade"
              value={qualitySummary(observability, openActions)}
            />
          </View>

          <RuntimeStrip
            activeTrace={activeTrace}
            activeTraceAgeMs={activeTraceAgeMs}
            lastRefreshAt={lastRefreshAt}
            lastRefreshError={lastRefreshError}
            refreshFailures={refreshFailures}
          />

          <MicroSection label="operações">
            <MicroAction
              label={busy === 'compact' ? 'compactando' : 'compactar'}
              onPress={onCompact}
              disabled={disabled || busy === 'compact'}
            />
            <MicroAction label="contexto" onPress={onOpenContext} />
            <MicroAction label="mapa" onPress={onOpenMap} active={pinnedCount > 0} />
            <MicroAction label="buscar" onPress={onOpenSearch} />
            <MicroAction label="fila" onPress={onOpenOperations} />
            <MicroAction label="skills" onPress={onOpenSkills} />
            {latestTrace && (
              <MicroAction label="execução" onPress={() => onOpenExecution(latestTrace)} />
            )}
          </MicroSection>

          {hasTurns ? (
            <MicroSection label="vistas">
              {(['all', 'pinned', 'decisions', 'actions', 'dev', 'errors'] as AtlasAiTurnFilter[]).map((filter) => (
                <MicroAction
                  key={filter}
                  label={turnFilterLabel(filter, pinnedCount)}
                  active={turnFilter === filter}
                  onPress={() => onSetTurnFilter(filter)}
                />
              ))}
            </MicroSection>
          ) : null}
        </>
      ) : null}
    </View>
  )
}

// Editorial subgroup inside ContinuityPanel. Italic lowercase label (Frau,
// opacity ~0.55) followed by a hairline that fills the row — the same
// pattern used in CaptureSettingsSheet sections. Gives operations / canal /
// vistas clear separation without removing any chip.
function MicroSection({ label, children }: { label: string; children: ReactNode }) {
  const { c } = useTheme()
  return (
    <View style={styles.microSection}>
      <View style={styles.microSectionHead}>
        <Frau italic size={12} lineHeight={16} color={c.ink} style={{ opacity: 0.55 }}>
          {label}
        </Frau>
        <View style={[styles.microSectionRule, { backgroundColor: c.border }]} />
      </View>
      <View style={styles.microSectionBody}>{children}</View>
    </View>
  )
}

function RuntimeStrip({
  activeTrace,
  activeTraceAgeMs,
  lastRefreshAt,
  lastRefreshError,
  refreshFailures,
}: {
  activeTrace: AtlasAiTrace | null
  activeTraceAgeMs: number | null
  lastRefreshAt: number | null
  lastRefreshError: string | null
  refreshFailures: number
}) {
  const { c } = useTheme()
  const activeAge = activeTraceAgeMs != null && Number.isFinite(activeTraceAgeMs)
    ? Math.max(0, activeTraceAgeMs)
    : null
  const stale = Boolean(activeTrace && activeAge != null && activeAge > 10 * 60 * 1000)
  const text = lastRefreshError
    ? `reconectando · ${refreshFailures} falha${refreshFailures === 1 ? '' : 's'} · ${lastRefreshError}`
    : stale
      ? `execução longa · ${formatLatency(activeAge ?? 0)} · acompanhando sem perder sessão`
      : lastRefreshAt
        ? `sincronizado ${formatRelative(new Date(lastRefreshAt).toISOString())}`
        : 'sincronização aguardando'

  return (
    <View style={[styles.runtimeStrip, { borderTopColor: c.border }]}>
      <Frau italic size={12} lineHeight={17} color={lastRefreshError ? c.recRed : stale ? c.bronze : c.ink2} numberOfLines={2}>
        {text}
      </Frau>
    </View>
  )
}

function MicroLine({ label, value }: { label: string; value: string }) {
  const { c } = useTheme()
  return (
    <View style={styles.microLine}>
      <Frau italic size={12} lineHeight={17} color={c.ink} style={[styles.microLabel, { opacity: 0.55 }]}>
        {label}
      </Frau>
      <Sans size={12.5} lineHeight={17} color={c.ink} numberOfLines={2} style={styles.microValue}>
        {value}
      </Sans>
    </View>
  )
}

function MicroAction({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.microAction,
        {
          borderColor: active ? c.bronze : c.border,
          opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Frau italic size={12} lineHeight={16} color={active ? c.bronze : c.ink2}>
        {label}
      </Frau>
    </Pressable>
  )
}

function SheetHeading({ title, subtitle }: { title: string; subtitle?: string | null }) {
  const { c } = useTheme()
  return (
    <View style={styles.sheetHeading}>
      <BronzeDiamond size={16} opacity={0.8} />
      <Frau size={24} lineHeight={30} color={c.ink} align="center" style={{ marginTop: 14 }}>
        {title}
      </Frau>
      {subtitle && (
        <Frau italic size={13} lineHeight={18} color={c.ink2} align="center" numberOfLines={2} style={{ marginTop: 6 }}>
          {subtitle}
        </Frau>
      )}
      <View style={[styles.headingRule, { backgroundColor: c.border }]} />
    </View>
  )
}

function DataSection({ title, children }: { title: string; children: ReactNode }) {
  const { c } = useTheme()
  return (
    <View style={styles.dataSection}>
      <Frau italic size={14} lineHeight={19} color={c.ink} style={{ opacity: 0.58 }}>
        {title}
      </Frau>
      <View style={[styles.sectionRule, { backgroundColor: c.border }]} />
      <View style={styles.dataSectionBody}>{children}</View>
    </View>
  )
}

function DataRow({ label, value }: { label: string; value: string }) {
  const { c } = useTheme()
  return (
    <View style={styles.dataRow}>
      <Sans weight="med" size={11} lineHeight={15} color={c.ink2} style={styles.dataLabel}>
        {label}
      </Sans>
      <Sans size={12} lineHeight={17} color={c.ink} style={styles.dataValue} numberOfLines={3}>
        {value}
      </Sans>
    </View>
  )
}

function DataList({ label, items }: { label: string; items?: unknown[] }) {
  const { c } = useTheme()
  const values = formatUnknownList(items)
  return (
    <View style={styles.dataList}>
      <Sans weight="med" size={11} lineHeight={15} color={c.ink2}>
        {label}
      </Sans>
      {values.length === 0 ? (
        <Frau italic size={12} lineHeight={17} color={c.ink3}>
          vazio
        </Frau>
      ) : values.slice(0, 4).map((value, index) => (
        <Sans key={`${label}-${index}`} size={12} lineHeight={17} color={c.ink}>
          {value}
        </Sans>
      ))}
    </View>
  )
}

function EmptyInline({ text }: { text: string }) {
  const { c } = useTheme()
  return (
    <Frau italic size={13} lineHeight={18} color={c.ink3}>
      {text}
    </Frau>
  )
}

function StatusPill({ status }: { status: string }) {
  const { c } = useTheme()
  return (
    <View style={[styles.statusPill, { borderColor: statusColor(status, c) }]}>
      <Frau italic size={11} lineHeight={15} color={statusColor(status, c)}>
        {statusLabel(status)}
      </Frau>
    </View>
  )
}

function ThreadHistorySheet({
  visible,
  threads,
  currentThreadId,
  onClose,
  onSelect,
  onNew,
  onArchive,
}: {
  visible: boolean
  threads: AtlasAiThread[]
  currentThreadId: string | null
  onClose: () => void
  onSelect: (thread: AtlasAiThread) => void
  onNew: () => void
  onArchive: (thread: AtlasAiThread) => void
}) {
  const { c } = useTheme()
  const [query, setQuery] = useState('')
  const filtered = filterThreads(threads, query)

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView contentContainerStyle={styles.threadPickerContent} showsVerticalScrollIndicator={false}>
        <Frau size={24} lineHeight={30} color={c.ink} align="center">
          Sessões Atlas
        </Frau>
        <View style={[styles.headingRule, { backgroundColor: c.border }]} />

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="buscar sessão…"
          placeholderTextColor={c.ink3}
          style={[styles.searchInput, { color: c.ink, borderBottomColor: c.border }]}
        />

        <Pressable
          onPress={() => {
            onNew()
            onClose()
          }}
          style={({ pressed }) => [styles.threadRow, { opacity: pressed ? 0.6 : 1 }]}
        >
          <View style={styles.threadMarker}>
            <BronzeDiamond size={12} opacity={0.7} />
          </View>
          <View style={styles.threadRowBody}>
            <Sans weight="med" size={15} lineHeight={20} color={c.ink}>
              Nova conversa
            </Sans>
            <Frau italic size={12} lineHeight={17} color={c.ink2}>
              começa sem herdar a thread atual
            </Frau>
          </View>
        </Pressable>

        {filtered.map((thread) => (
          <View key={thread.id} style={styles.threadRow}>
            <View style={styles.threadMarker}>
              {thread.id === currentThreadId && <BronzeDiamond size={12} />}
            </View>
            <Pressable
              onPress={() => onSelect(thread)}
              style={({ pressed }) => [styles.threadRowBody, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View>
                <Sans weight="med" size={15} lineHeight={20} color={c.ink} numberOfLines={1}>
                  {thread.title || 'Conversa Atlas'}
                </Sans>
                <Frau italic size={12} lineHeight={17} color={c.ink2} numberOfLines={2}>
                  {thread.summary || thread.active_state?.current_topic || `${thread.message_count} mensagens`}
                </Frau>
                <CaptionWhisper
                  text={`${providerWord(thread.last_provider) ?? 'atlas'} · ${formatRelative(thread.last_message_at ?? thread.updated_at)}`}
                />
              </View>
            </Pressable>
            <View style={styles.threadRowActions}>
              <MicroAction
                label="arquivar"
                onPress={() => onArchive(thread)}
              />
            </View>
          </View>
        ))}

        {filtered.length === 0 && <EmptyInline text="nenhuma sessão encontrada" />}
      </ScrollView>
    </BottomSheet>
  )
}

function SearchSheet({
  visible,
  traces,
  pinnedTraceIds,
  onClose,
  onOpenExecution,
  onTogglePin,
}: {
  visible: boolean
  traces: AtlasAiTrace[]
  pinnedTraceIds: string[]
  onClose: () => void
  onOpenExecution: (trace: AtlasAiTrace) => void
  onTogglePin: (trace: AtlasAiTrace) => void
}) {
  const { c } = useTheme()
  const [query, setQuery] = useState('')
  const results = useMemo(
    () => sortAtlasTraces(traces).filter((trace) => matchesAtlasTraceSearch(trace, query)).slice(-30).reverse(),
    [query, traces],
  )

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <SheetHeading title="Buscar na sessão" subtitle={`${traces.length} turns carregados`} />

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="buscar por contexto, arquivo, decisão…"
          placeholderTextColor={c.ink3}
          style={[styles.searchInput, { color: c.ink, borderBottomColor: c.border }]}
        />

        <DataSection title="resultados">
          {results.length === 0 ? (
            <EmptyInline text="nada encontrado nesta sessão" />
          ) : results.map((trace) => {
            const pinned = pinnedTraceIds.includes(trace.id)
            return (
              <View key={trace.id} style={[styles.executionRow, { borderTopColor: c.border }]}>
                <View style={styles.rowSplit}>
                  <Sans weight="med" size={13} lineHeight={18} color={c.ink} numberOfLines={1}>
                    {truncateForDisplay(trace.operator_input || 'sem pergunta', 96)}
                  </Sans>
                  <StatusPill status={trace.status} />
                </View>
                <Sans size={12} lineHeight={18} color={c.ink2} numberOfLines={3}>
                  {truncateForDisplay(pickResponseText(trace) || trace.job?.error_message || 'sem resposta', 260)}
                </Sans>
                <CaptionWhisper text={`${providerWord(trace.provider) ?? 'atlas'} · ${formatRelative(trace.created_at)}`} />
                <View style={styles.inlineActions}>
                  <MicroAction
                    label={pinned ? 'fixado' : 'fixar'}
                    active={pinned}
                    onPress={() => onTogglePin(trace)}
                  />
                  <MicroAction
                    label="execução"
                    onPress={() => {
                      onOpenExecution(trace)
                      onClose()
                    }}
                  />
                </View>
              </View>
            )
          })}
        </DataSection>
      </ScrollView>
    </BottomSheet>
  )
}

function SessionMapSheet({
  visible,
  state,
  traces,
  qualityActions,
  pinnedTraceIds,
  onClose,
}: {
  visible: boolean
  state: AtlasAiSessionState | null
  traces: AtlasAiTrace[]
  qualityActions: AtlasAiQualityAction[]
  pinnedTraceIds: string[]
  onClose: () => void
}) {
  const map = useMemo(
    () => buildAtlasSessionMap({ state, traces, qualityActions, pinnedTraceIds }),
    [pinnedTraceIds, qualityActions, state, traces],
  )
  const pinned = useMemo(
    () => buildPinnedTraceSummary(traces, pinnedTraceIds),
    [pinnedTraceIds, traces],
  )

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <SheetHeading title="Mapa da sessão" subtitle="decisões, tarefas, código e riscos" />

        <DataSection title="fixados">
          <MappedList items={pinned} empty="nenhum turn fixado" />
        </DataSection>

        <DataSection title="decisões">
          <MappedList items={map.decisions} empty="nenhuma decisão explícita" />
        </DataSection>

        <DataSection title="tarefas abertas">
          <MappedList items={map.actions} empty="nenhuma tarefa aberta" />
        </DataSection>

        <DataSection title="código e artefatos">
          <MappedList items={map.code} empty="nenhum artefato técnico detectado" />
        </DataSection>

        <DataSection title="erros e riscos">
          <MappedList items={map.errors} empty="nenhum erro detectado" />
        </DataSection>
      </ScrollView>
    </BottomSheet>
  )
}

function MappedList({ items, empty }: { items: string[]; empty: string }) {
  const { c } = useTheme()
  if (items.length === 0) return <EmptyInline text={empty} />
  return (
    <View style={styles.mappedList}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.mappedRow}>
          <Sans size={14} lineHeight={20} color={c.bronze} style={styles.mappedMarker}>
            —
          </Sans>
          <Sans size={13} lineHeight={19} color={c.ink} style={styles.mappedText}>
            {item}
          </Sans>
        </View>
      ))}
    </View>
  )
}

function ContextSheet({
  visible,
  thread,
  state,
  compaction,
  handoff,
  snapshots,
  latestTrace,
  onClose,
}: {
  visible: boolean
  thread: AtlasAiThread | null
  state: AtlasAiSessionState | null
  compaction: AtlasAiCompaction | null
  handoff: AtlasAiProviderHandoff | null
  snapshots: AtlasAiContextSnapshot[]
  latestTrace: AtlasAiTrace | null
  onClose: () => void
}) {
  const { c } = useTheme()
  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <SheetHeading title="Contexto ativo" subtitle={thread?.title ?? 'nova conversa'} />

        <DataSection title="sessão">
          <DataRow label="objetivo" value={state?.objective || 'não definido'} />
          <DataRow label="fase" value={state?.current_phase || 'não definida'} />
          <DataRow label="tópico" value={state?.current_topic || 'não definido'} />
          <DataRow label="posição" value={state?.user_position || 'não definida'} />
        </DataSection>

        <DataSection title="estado preservado">
          <DataList label="decisões" items={state?.decisions} />
          <DataList label="abertos" items={state?.open_loops} />
          <DataList label="próximos" items={state?.next_steps} />
          <DataList label="artefatos" items={state?.relevant_artifacts} />
          <DataList label="restrições" items={state?.constraints} />
          <DataList label="qualidade" items={state?.quality_notes} />
        </DataSection>

        <DataSection title="compactação">
          <DataRow
            label="última"
            value={compaction ? `${formatRelative(compaction.created_at)} · ${compaction.quality_gate_status}` : 'sem compactação'}
          />
          {compaction?.summary && (
            <Sans size={13} lineHeight={19} color={c.ink}>
              {truncateForDisplay(compaction.summary, 700)}
            </Sans>
          )}
        </DataSection>

        <DataSection title="handoff">
          <DataRow
            label="provider"
            value={handoff ? `${providerWord(handoff.from_provider) ?? 'atlas'} → ${providerWord(handoff.to_provider) ?? handoff.to_provider}` : 'sem troca recente'}
          />
          {handoff?.brief_text && (
            <Sans size={13} lineHeight={19} color={c.ink}>
              {truncateForDisplay(handoff.brief_text, 700)}
            </Sans>
          )}
        </DataSection>

        <DataSection title="fontes usadas">
          <DataList label="refs" items={latestTrace?.context_refs} />
          <DataList label="skills" items={skillVersionLabels(latestTrace)} />
        </DataSection>

        <DataSection title="snapshots">
          {snapshots.length === 0 ? (
            <EmptyInline text="nenhum snapshot de contexto carregado" />
          ) : snapshots.slice(0, 8).map((snapshot) => (
            <View key={snapshot.id} style={[styles.executionRow, { borderTopColor: c.border }]}>
              <View style={styles.rowSplit}>
                <Sans weight="med" size={13} lineHeight={18} color={c.ink}>
                  {providerWord(snapshot.provider) ?? snapshot.provider ?? 'atlas'}
                </Sans>
                <Sans size={11} lineHeight={15} color={c.ink2}>
                  {snapshot.token_estimate != null ? `${snapshot.token_estimate} tokens` : 'sem tokens'}
                </Sans>
              </View>
              <CaptionWhisper text={`${formatRelative(snapshot.created_at)} · ${shortId(snapshot.id)}`} />
              <DataList label="mensagens" items={snapshot.messages_included} />
              <DataList label="contexto" items={snapshotContextLabels(snapshot)} />
            </View>
          ))}
        </DataSection>
      </ScrollView>
    </BottomSheet>
  )
}

function OperationsSheet({
  visible,
  providerStatus,
  observability,
  qualityActions,
  onClose,
  onRunQualityAction,
}: {
  visible: boolean
  providerStatus: AiProvidersStatusResponse | null
  observability: AiObservabilityResponse | null
  qualityActions: AtlasAiQualityAction[]
  onClose: () => void
  onRunQualityAction: (action: AtlasAiQualityAction) => void
}) {
  const { c } = useTheme()
  const openActions = qualityActions.filter((action) => OPEN_ACTION_STATUSES.has(action.status))
  const providers = providerStatus?.providers ?? []

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <SheetHeading title="Operação Atlas AI" subtitle="providers, fila e qualidade" />

        <DataSection title="fila">
          <DataRow label="queued" value={String(providerStatus?.queue.queued ?? observability?.jobs.queued ?? 0)} />
          <DataRow label="rodando" value={String(providerStatus?.queue.processing ?? observability?.jobs.processing ?? 0)} />
          <DataRow label="falhas 24h" value={String(providerStatus?.queue.failed ?? observability?.jobs.failed_24h ?? 0)} />
        </DataSection>

        <DataSection title="providers">
          {providers.length === 0 ? (
            <EmptyInline text="sem health check carregado" />
          ) : providers.map((provider) => (
            <View key={`${provider.provider}-${provider.checked_at}`} style={[styles.executionRow, { borderTopColor: c.border }]}>
              <View style={styles.rowSplit}>
                <Sans weight="med" size={13} lineHeight={18} color={c.ink}>
                  {providerWord(provider.provider) ?? provider.provider}
                </Sans>
                <StatusPill status={provider.status} />
              </View>
              <CaptionWhisper
                text={`p50 ${provider.p50_latency_ms ? formatLatency(provider.p50_latency_ms) : 'n/a'} · jobs ${provider.total_jobs_24h} · dor ${provider.operational_pain_score}`}
              />
              {provider.message && (
                <Sans size={12} lineHeight={17} color={c.ink2}>
                  {provider.message}
                </Sans>
              )}
            </View>
          ))}
        </DataSection>

        <DataSection title="qualidade">
          <DataRow
            label="média"
            value={observability?.quality.available && observability.quality.average_score != null
              ? `${observability.quality.average_score}/100`
              : 'sem dados'}
          />
          <DataRow
            label="revisar"
            value={String(observability?.quality.by_status?.needs_review ?? 0)}
          />
          <DataRow
            label="falhou"
            value={String(observability?.quality.by_status?.failed ?? 0)}
          />
        </DataSection>

        <DataSection title="ações abertas">
          {openActions.length === 0 ? (
            <EmptyInline text="nenhuma ação aberta" />
          ) : openActions.slice(0, 12).map((action) => (
            <View key={action.id} style={[styles.executionRow, { borderTopColor: c.border }]}>
              <View style={styles.rowSplit}>
                <Sans weight="med" size={13} lineHeight={18} color={c.ink}>
                  {action.action_type.replace(/_/g, ' ')}
                </Sans>
                <StatusPill status={action.status} />
              </View>
              <CaptionWhisper text={`${action.reason} · prioridade ${action.priority}`} />
              <View style={styles.inlineActions}>
                <MicroAction
                  label={qualityActionLabel(action)}
                  onPress={() => onRunQualityAction(action)}
                  disabled={!canRunQualityAction(action)}
                />
              </View>
            </View>
          ))}
        </DataSection>
      </ScrollView>
    </BottomSheet>
  )
}

function ExecutionSheet({
  visible,
  trace,
  loading,
  onClose,
  onRefresh,
  onRunQualityAction,
  onRetryJob,
  onCancelJob,
}: {
  visible: boolean
  trace: AtlasAiTrace | null
  loading: boolean
  onClose: () => void
  onRefresh: (trace: AtlasAiTrace) => void
  onRunQualityAction: (action: AtlasAiQualityAction) => void
  onRetryJob: (job: AtlasAiJob) => void
  onCancelJob: (job: AtlasAiJob) => void
}) {
  const { c } = useTheme()
  const jobs = trace ? trace.jobs?.length ? trace.jobs : trace.job ? [trace.job] : [] : []
  const quality = trace?.quality_evaluation ?? null
  const actions = trace?.quality_actions ?? []
  const artifacts = executionArtifacts(trace, jobs)

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <SheetHeading
          title="Execução"
          subtitle={trace ? `${providerWord(trace.provider) ?? 'atlas'} · ${trace.agent_slug}` : 'nenhum trace selecionado'}
        />

        {trace && (
          <View style={styles.inlineActions}>
            <MicroAction
              label={loading ? 'atualizando' : 'atualizar'}
              onPress={() => onRefresh(trace)}
              disabled={loading}
            />
          </View>
        )}

        {!trace ? (
          <EmptyInline text="selecione uma resposta para ver execução" />
        ) : (
          <>
            <DataSection title="trace">
              <DataRow label="status" value={trace.status} />
              <DataRow label="id" value={shortId(trace.id)} />
              <DataRow label="provider" value={providerWord(trace.provider) ?? String(trace.provider ?? 'atlas')} />
              <DataRow label="agent" value={trace.agent_slug} />
              <DataRow label="latência" value={trace.latency_ms != null ? formatLatency(trace.latency_ms) : 'n/a'} />
              <DataRow label="criado" value={formatRelative(trace.created_at)} />
            </DataSection>

            <DataSection title="artifacts dev">
              <DataList label="arquivos" items={artifacts.files} />
              <DataList label="comandos" items={artifacts.commands} />
              <DataList label="testes" items={artifacts.tests} />
              <DataList label="erros" items={artifacts.errors} />
              <DataList label="diffs" items={artifacts.diffs} />
            </DataSection>

            <DataSection title="jobs">
              {jobs.length === 0 ? (
                <EmptyInline text="nenhum job carregado" />
              ) : jobs.map((job) => (
                <View key={job.id} style={[styles.executionRow, { borderTopColor: c.border }]}>
                  <View style={styles.rowSplit}>
                    <Sans weight="med" size={13} lineHeight={18} color={c.ink}>
                      {providerWord(job.provider) ?? job.provider ?? 'atlas'}
                    </Sans>
                    <StatusPill status={job.status} />
                  </View>
                  <CaptionWhisper
                    text={`${job.kind} · tentativa ${job.attempts}/${job.max_attempts} · ${job.worker_id ?? 'sem worker'}`}
                  />
                  <View style={styles.inlineActions}>
                    {(job.status === 'failed' || job.status === 'cancelled') && (
                      <MicroAction
                        label="retry"
                        onPress={() => onRetryJob(job)}
                      />
                    )}
                    {(job.status === 'queued' || job.status === 'processing') && (
                      <MicroAction
                        label="cancelar"
                        onPress={() => onCancelJob(job)}
                      />
                    )}
                  </View>
                  <DataRow label="início" value={job.started_at ? formatRelative(job.started_at) : 'n/a'} />
                  <DataRow label="fim" value={job.finished_at ? formatRelative(job.finished_at) : 'n/a'} />
                  {job.error_message && (
                    <Sans size={12} lineHeight={17} color={c.recRed}>
                      {job.error_message}
                    </Sans>
                  )}
                  {job.result_text && (
                    <Sans size={12} lineHeight={17} color={c.ink2}>
                      {truncateForDisplay(job.result_text, 260)}
                    </Sans>
                  )}
                  {(job.attempt_history ?? []).map((attempt) => (
                    <View key={attempt.id} style={styles.attemptLine}>
                      <Sans size={11} lineHeight={16} color={c.ink2}>
                        tentativa {attempt.attempt_number} · {attempt.status} · {attempt.duration_ms ? formatLatency(attempt.duration_ms) : 'n/a'}
                      </Sans>
                    </View>
                  ))}
                </View>
              ))}
            </DataSection>

            <DataSection title="qualidade">
              {quality ? (
                <>
                  <DataRow label="score" value={`${quality.score}/100`} />
                  <DataRow label="status" value={qualityStatusLabel(quality.status)} />
                  <DataRow label="flags" value={qualityFlagCodes(quality).join(' · ') || 'sem flags'} />
                </>
              ) : (
                <EmptyInline text="sem avaliação carregada" />
              )}
            </DataSection>

            <DataSection title="ações">
              {actions.length === 0 ? (
                <EmptyInline text="sem ações corretivas" />
              ) : actions.map((action) => (
                <View key={action.id} style={[styles.executionRow, { borderTopColor: c.border }]}>
                  <View style={styles.rowSplit}>
                    <Sans weight="med" size={13} lineHeight={18} color={c.ink}>
                      {action.action_type.replace(/_/g, ' ')}
                    </Sans>
                    <StatusPill status={action.status} />
                  </View>
                  <CaptionWhisper text={action.reason} />
                  <View style={styles.inlineActions}>
                    <MicroAction
                      label={qualityActionLabel(action)}
                      onPress={() => onRunQualityAction(action)}
                      disabled={!canRunQualityAction(action)}
                    />
                  </View>
                </View>
              ))}
            </DataSection>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  )
}

function SkillsSheet({
  visible,
  traces,
  qualityActions,
  onClose,
}: {
  visible: boolean
  traces: AtlasAiTrace[]
  qualityActions: AtlasAiQualityAction[]
  onClose: () => void
}) {
  const { c } = useTheme()
  const agents = skillDiagnostics(traces, qualityActions)

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <SheetHeading title="Skills e agentes" subtitle="uso, qualidade e pontos de atenção" />

        <DataSection title="visão geral">
          <DataRow label="agentes" value={String(agents.length)} />
          <DataRow label="traces" value={String(traces.length)} />
          <DataRow label="ações" value={String(qualityActions.length)} />
        </DataSection>

        <DataSection title="agentes ativos">
          {agents.length === 0 ? (
            <EmptyInline text="nenhum agente usado nesta sessão" />
          ) : agents.map((agent) => (
            <View key={agent.slug} style={[styles.executionRow, { borderTopColor: c.border }]}>
              <View style={styles.rowSplit}>
                <Sans weight="med" size={13} lineHeight={18} color={c.ink}>
                  {agent.slug}
                </Sans>
                <StatusPill status={agent.status} />
              </View>
              <CaptionWhisper
                text={`${agent.count} usos · qualidade ${agent.averageScore ?? 'n/a'} · ações ${agent.openActions}`}
              />
              <DataList label="providers" items={agent.providers} />
              <DataList label="skills" items={agent.skills} />
              <DataList label="flags" items={agent.flags} />
            </View>
          ))}
        </DataSection>
      </ScrollView>
    </BottomSheet>
  )
}

function QualityBar({
  trace,
  onRunQualityAction,
}: {
  trace: AtlasAiTrace
  onRunQualityAction: (action: AtlasAiQualityAction) => void
}) {
  const { c } = useTheme()
  const evaluation = trace.quality_evaluation
  const actions = trace.quality_actions ?? []
  const openActions = actions.filter((action) => OPEN_ACTION_STATUSES.has(action.status))
  const remediation = bestRemediationAction(trace)
  const flags = qualityFlagCodes(evaluation).slice(0, 3)

  if (!evaluation && actions.length === 0) return null

  return (
    <View style={[styles.qualityBar, { borderTopColor: c.border }]}>
      <Frau italic size={12} lineHeight={17} color={qualityColor(evaluation, c)}>
        {evaluation
          ? `qualidade ${evaluation.score}/100 · ${qualityStatusLabel(evaluation.status)}`
          : 'qualidade em análise'}
      </Frau>

      {flags.length > 0 && (
        <Sans size={11} lineHeight={16} color={c.ink2}>
          {flags.join(' · ')}
        </Sans>
      )}

      {openActions.length > 0 && (
        <View style={styles.qualityActions}>
          {openActions.slice(0, 2).map((action) => (
            <MicroAction
              key={action.id}
              label={qualityActionLabel(action)}
              onPress={() => onRunQualityAction(action)}
              disabled={!canRunQualityAction(action)}
            />
          ))}
        </View>
      )}

      {remediation?.remediation_trace && (
        <CaptionWhisper
          text={`resposta reparada por ${providerWord(remediation.remediation_trace.provider) ?? 'atlas'}.`}
        />
      )}
    </View>
  )
}

function FeedbackRow({
  trace,
  onFeedback,
}: {
  trace: AtlasAiTrace
  onFeedback: (trace: AtlasAiTrace, action: FeedbackAction) => void
}) {
  if (trace.status !== 'succeeded') return null

  return (
    <View style={styles.feedbackRow}>
      <FeedbackButton
        label={trace.feedback_action === 'useful' ? 'útil registrado' : 'útil'}
        active={trace.feedback_action === 'useful'}
        onPress={() => onFeedback(trace, 'useful')}
      />
      <FeedbackButton
        label="contexto"
        active={trace.feedback_action === 'wrong_context'}
        onPress={() => onFeedback(trace, 'wrong_context')}
      />
      <FeedbackButton
        label="longo"
        active={trace.feedback_comment?.includes('[too_long]') === true}
        onPress={() => onFeedback(trace, 'too_long')}
      />
      <FeedbackButton
        label="fraco"
        active={trace.feedback_comment?.includes('[weak]') === true}
        onPress={() => onFeedback(trace, 'weak')}
      />
    </View>
  )
}

function FeedbackButton({
  label,
  active,
  onPress,
}: {
  label: string
  active?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.feedbackButton,
        {
          borderColor: active ? c.moss : c.border,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Frau italic size={11} lineHeight={15} color={active ? c.moss : c.ink3}>
        {label}
      </Frau>
    </Pressable>
  )
}

function bodyFromTrace(
  trace: AtlasAiTrace,
  onFeedback: (trace: AtlasAiTrace, action: FeedbackAction) => void,
  onRunQualityAction: (action: AtlasAiQualityAction) => void,
  onOpenExecution: (trace: AtlasAiTrace) => void,
  onTogglePin: (trace: AtlasAiTrace) => void,
  pinned: boolean,
): TurnBody {
  if (isAtlasTraceActive(trace)) {
    return {
      kind: 'thinking',
      startedAtMs: new Date(trace.created_at).getTime(),
      provider: providerWord(trace.provider),
      detail: thinkingDetail(trace),
      trace,
      onOpenExecution,
    }
  }
  if (trace.status === 'failed') {
    const message = trace.job?.error_message?.trim() || 'a interação falhou.'
    return { kind: 'error', message }
  }
  if (trace.status === 'cancelled') {
    return { kind: 'error', message: 'cancelado.' }
  }
  return {
    kind: 'response',
    text: pickResponseText(trace) || '—',
    attribution: attribution(trace),
    trace,
    onFeedback,
    onRunQualityAction,
    onOpenExecution,
    onTogglePin,
    pinned,
  }
}

function SyncDiamond({ pulsing }: { pulsing: boolean }) {
  const opacity = useSharedValue(1)

  useEffect(() => {
    if (pulsing) {
      opacity.value = withRepeat(
        withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      )
    } else {
      opacity.value = withTiming(1, { duration: 200 })
    }
  }, [pulsing, opacity])

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View style={style}>
      <BronzeDiamond size={14} opacity={0.7} />
    </Animated.View>
  )
}

function pickResponseText(trace: AtlasAiTrace): string {
  const remediation = bestRemediationAction(trace)
  const remediationText = remediation?.remediation_trace
    ? pickRawResponseText(remediation.remediation_trace)
    : ''
  if (remediationText) return remediationText

  return pickRawResponseText(trace)
}

function pickRawResponseText(trace: AtlasAiTrace): string {
  return (
    trace.response_text?.trim()
    || trace.job?.result_text?.trim()
    || (trace.jobs ?? [])
      .map((job) => job.result_text?.trim())
      .filter(Boolean)
      .join('\n\n')
    || ''
  )
}

function attribution(trace: AtlasAiTrace): string {
  const remediation = bestRemediationAction(trace)
  const subject = remediation?.remediation_trace
    ? providerWord(remediation.remediation_trace.provider) ?? 'atlas'
    : providerWord(trace.provider) ?? 'atlas'
  const latency = trace.latency_ms != null ? `, em ${formatLatency(trace.latency_ms)}` : ''
  const repaired = remediation?.remediation_trace ? ' · reparado' : ''
  return `— ${subject}${latency}${repaired}.`
}

function thinkingDetail(trace: AtlasAiTrace): string {
  const jobs = trace.jobs?.length ? trace.jobs : trace.job ? [trace.job] : []
  if (jobs.length === 0) return 'mantendo sessão e contexto ativo'

  const queued = jobs.filter((job) => job.status === 'queued').length
  const processing = jobs.filter((job) => job.status === 'processing').length
  const failed = jobs.filter((job) => job.status === 'failed').length
  const attempts = Math.max(...jobs.map((job) => job.attempts ?? 0), 0)
  const worker = jobs.find((job) => job.worker_id)?.worker_id

  return [
    queued ? `${queued} na fila` : null,
    processing ? `${processing} executando` : null,
    failed ? `${failed} falhou` : null,
    attempts ? `tentativa ${attempts}` : null,
    worker ? `worker ${worker}` : null,
  ].filter(Boolean).join(' · ') || 'orquestrando execução'
}

function queuePhrase(job: AtlasAiJob): string {
  const availableAt = job.available_at ? new Date(job.available_at).getTime() : null
  if (availableAt && Number.isFinite(availableAt) && availableAt > Date.now()) {
    return `fila · disponível ${formatRelative(job.available_at)}`
  }
  return `fila · tentativa ${job.attempts}/${job.max_attempts}`
}

function processingPhrase(job: AtlasAiJob): string {
  const started = job.started_at ? new Date(job.started_at).getTime() : null
  const elapsed = started && Number.isFinite(started)
    ? formatLatency(Math.max(0, Date.now() - started))
    : 'agora'
  return `executando há ${elapsed} · tentativa ${job.attempts}/${job.max_attempts}`
}

function bestRemediationAction(trace: AtlasAiTrace): AtlasAiQualityAction | null {
  return (trace.quality_actions ?? []).find((action) => {
    if (action.status !== 'succeeded') return false
    if (!action.remediation_trace) return false
    return pickRawResponseText(action.remediation_trace).trim().length > 0
  }) ?? null
}

function qualityFlagCodes(evaluation?: AtlasAiQualityEvaluation | null): string[] {
  return (evaluation?.flags ?? []).map((flag) => {
    const code = flag.code
    return typeof code === 'string' ? code : null
  }).filter((code): code is string => Boolean(code))
}

function qualityStatusLabel(status: string): string {
  if (status === 'passed') return 'aprovado'
  if (status === 'needs_review') return 'revisar'
  if (status === 'failed') return 'falhou'
  return status
}

function qualityColor(evaluation: AtlasAiQualityEvaluation | null | undefined, c: ReturnType<typeof useTheme>['c']): string {
  if (!evaluation) return c.ink3
  if (evaluation.status === 'failed') return c.recRed
  if (evaluation.status === 'needs_review') return c.bronze
  return c.moss
}

function qualityActionLabel(action: AtlasAiQualityAction): string {
  if (action.status === 'queued') return 'correção na fila'
  if (action.status === 'running') return 'corrigindo'
  if (action.status === 'failed') return 'repetir correção'
  if (action.status === 'blocked') return 'corrigir'
  return action.action_type.replace(/_/g, ' ')
}

function turnFilterLabel(filter: AtlasAiTurnFilter, pinnedCount: number): string {
  if (filter === 'all') return 'todos'
  if (filter === 'pinned') return pinnedCount > 0 ? `fixados ${pinnedCount}` : 'fixados'
  if (filter === 'decisions') return 'decisões'
  if (filter === 'actions') return 'ações'
  if (filter === 'dev') return 'código'
  return 'erros'
}

function canRunQualityAction(action: AtlasAiQualityAction): boolean {
  return action.status === 'queued' || action.status === 'failed'
}

function qualitySummary(
  observability: AiObservabilityResponse | null,
  openActions: AtlasAiQualityAction[],
): string {
  const quality = observability?.quality
  if (!quality?.available) return `ações abertas ${openActions.length}`
  const avg = typeof quality.average_score === 'number' ? `${quality.average_score}/100` : 'sem média'
  const review = quality.by_status?.needs_review ?? 0
  const failed = quality.by_status?.failed ?? 0
  return `${avg} · revisar ${review} · falhas ${failed} · ações ${openActions.length}`
}

function filterThreads(threads: AtlasAiThread[], query: string): AtlasAiThread[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return threads

  return threads.filter((thread) => {
    const haystack = [
      thread.title,
      thread.summary,
      thread.active_state?.current_topic,
      thread.active_state?.objective,
      providerWord(thread.last_provider),
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(needle)
  })
}

function skillVersionLabels(trace: AtlasAiTrace | null): string[] {
  if (!trace) return []
  return Object.entries(trace.skill_versions ?? {}).map(([slug, data]) => {
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>
      const version = typeof record.version === 'string' ? record.version : null
      const hash = typeof record.hash === 'string' ? shortId(record.hash) : null
      return [slug, version, hash].filter(Boolean).join(' · ')
    }
    return slug
  })
}

function snapshotContextLabels(snapshot: AtlasAiContextSnapshot): string[] {
  const pack = snapshot.context_pack ?? {}
  const labels: string[] = []

  for (const key of ['conversation', 'semantic', 'task_request', 'execution_plan', 'session_state']) {
    const value = pack[key]
    if (value !== undefined) labels.push(`${key}: ${compactUnknown(value)}`)
  }

  return labels
}

function executionArtifacts(trace: AtlasAiTrace | null, jobs: AtlasAiJob[]) {
  const roots = [
    trace?.metadata,
    trace?.context_refs,
    trace?.skill_versions,
    ...jobs.flatMap((job) => [job.payload, job.metadata, job.result_json, job.result_text, job.error_message]),
  ].filter((item) => item != null)

  return {
    files: collectArtifactStrings(roots, ['file', 'files', 'path', 'paths', 'changed_file', 'changed_files']),
    commands: collectArtifactStrings(roots, ['command', 'commands', 'cmd', 'shell', 'verification_command']),
    tests: collectArtifactStrings(roots, ['test', 'tests', 'verification', 'typecheck', 'pint']),
    errors: collectArtifactStrings(roots, ['error', 'errors', 'stderr', 'error_message']),
    diffs: collectArtifactStrings(roots, ['diff', 'patch', 'changed']),
  }
}

function collectArtifactStrings(roots: unknown[], keys: string[]): string[] {
  const found: string[] = []
  const keySet = new Set(keys.map((key) => key.toLowerCase()))

  const visit = (value: unknown, keyHint?: string, depth = 0): void => {
    if (depth > 5 || found.length >= 8 || value == null) return

    const hint = keyHint?.toLowerCase() ?? ''
    const matched = [...keySet].some((key) => hint.includes(key))

    if (typeof value === 'string') {
      if (matched || looksLikeArtifact(value, keySet)) found.push(truncateForDisplay(value, 220))
      return
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      if (matched) found.push(String(value))
      return
    }

    if (Array.isArray(value)) {
      for (const item of value) visit(item, keyHint, depth + 1)
      return
    }

    if (typeof value === 'object') {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        visit(nested, key, depth + 1)
      }
    }
  }

  for (const root of roots) visit(root)

  return [...new Set(found)].slice(0, 8)
}

function looksLikeArtifact(value: string, keySet: Set<string>): boolean {
  const lower = value.toLowerCase()
  if (keySet.has('path') || keySet.has('file')) {
    if (lower.includes('/users/') || lower.includes('.tsx') || lower.includes('.php') || lower.includes('.ts')) return true
  }
  if (keySet.has('command') || keySet.has('cmd')) {
    if (lower.startsWith('npm ') || lower.startsWith('php ') || lower.startsWith('git ') || lower.startsWith('composer ')) return true
  }
  if (keySet.has('error') || keySet.has('stderr')) {
    if (lower.includes('error') || lower.includes('failed') || lower.includes('exception')) return true
  }
  return false
}

function compactUnknown(value: unknown): string {
  if (typeof value === 'string') return truncateForDisplay(value, 160)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return `${value.length} itens`
  if (value && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).slice(0, 5)
    return keys.length ? keys.join(', ') : 'objeto'
  }
  return 'n/a'
}

function mergeJobIntoTrace(job: AtlasAiJob, trace: AtlasAiTrace): AtlasAiTrace {
  const jobs = trace.jobs?.length ? trace.jobs : trace.job ? [trace.job] : []
  const nextJobs = [job, ...jobs.filter((item) => item.id !== job.id)]
  const nextStatus = job.trace?.status ?? trace.status

  return {
    ...trace,
    status: nextStatus,
    job: trace.job?.id === job.id ? job : trace.job,
    jobs: nextJobs,
  }
}

function skillDiagnostics(traces: AtlasAiTrace[], qualityActions: AtlasAiQualityAction[]) {
  const byAgent = new Map<string, {
    slug: string
    count: number
    providers: Set<string>
    skills: Set<string>
    scores: number[]
    flags: Set<string>
    openActions: number
  }>()

  for (const trace of traces) {
    const slug = trace.agent_slug || 'orquestrador'
    const current = byAgent.get(slug) ?? {
      slug,
      count: 0,
      providers: new Set<string>(),
      skills: new Set<string>(),
      scores: [],
      flags: new Set<string>(),
      openActions: 0,
    }
    current.count += 1
    if (trace.provider) current.providers.add(providerWord(trace.provider) ?? String(trace.provider))
    for (const label of skillVersionLabels(trace)) current.skills.add(label)
    if (trace.quality_evaluation?.score != null) current.scores.push(trace.quality_evaluation.score)
    for (const flag of qualityFlagCodes(trace.quality_evaluation)) current.flags.add(flag)
    byAgent.set(slug, current)
  }

  for (const action of qualityActions) {
    if (!OPEN_ACTION_STATUSES.has(action.status)) continue
    const trace = traces.find((item) => item.id === action.trace_id)
    const slug = trace?.agent_slug ?? 'desconhecido'
    const current = byAgent.get(slug) ?? {
      slug,
      count: 0,
      providers: new Set<string>(),
      skills: new Set<string>(),
      scores: [],
      flags: new Set<string>(),
      openActions: 0,
    }
    current.openActions += 1
    byAgent.set(slug, current)
  }

  return [...byAgent.values()]
    .map((item) => {
      const averageScore = item.scores.length
        ? Math.round(item.scores.reduce((sum, score) => sum + score, 0) / item.scores.length)
        : null
      return {
        slug: item.slug,
        count: item.count,
        providers: [...item.providers],
        skills: [...item.skills],
        flags: [...item.flags],
        openActions: item.openActions,
        averageScore,
        status: item.openActions > 0 ? 'needs_review' : averageScore != null && averageScore < 70 ? 'degraded' : 'passed',
      }
    })
    .sort((left, right) => right.count - left.count)
}

function normalizeStoredRouting(raw: string | null): RoutingState {
  if (!raw) return ROUTING_DEFAULT

  try {
    const value = JSON.parse(raw) as Partial<RoutingState>
    return {
      task: isRoutingTask(value.task) ? value.task : ROUTING_DEFAULT.task,
      domain: isRoutingDomain(value.domain) ? value.domain : ROUTING_DEFAULT.domain,
      executor: isRoutingExecutor(value.executor) ? value.executor : ROUTING_DEFAULT.executor,
      style: isRoutingStyle(value.style) ? value.style : ROUTING_DEFAULT.style,
    }
  } catch {
    return ROUTING_DEFAULT
  }
}

function isRoutingTask(value: unknown): value is RoutingState['task'] {
  return value === 'direct' || value === 'plan' || value === 'review' || value === 'dev' || value === 'debug'
}

function isRoutingDomain(value: unknown): value is RoutingState['domain'] {
  return value === 'auto'
    || value === 'vault-curador'
    || value === 'saude'
    || value === 'blackink'
    || value === 'financas'
}

function isRoutingExecutor(value: unknown): value is RoutingExecutor {
  return value === 'auto' || value === 'claude_cli' || value === 'codex_cli' || value === 'claude_codex'
}

function isRoutingStyle(value: unknown): value is RoutingStyle {
  return value === 'clear' || value === 'brief' || value === 'technical' || value === 'complete'
}

function formatUnknownList(items?: unknown[]): string[] {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      if (typeof item === 'string') return item.trim()
      if (typeof item === 'number' || typeof item === 'boolean') return String(item)
      if (!item || typeof item !== 'object') return ''

      const record = item as Record<string, unknown>
      for (const key of ['title', 'label', 'text', 'summary', 'description', 'content', 'decision', 'next_step']) {
        const value = record[key]
        if (typeof value === 'string' && value.trim()) return value.trim()
      }

      return JSON.stringify(record)
    })
    .filter(Boolean)
    .map((item) => truncateForDisplay(item, 180))
}

function truncateForDisplay(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function shortId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`
}

function statusLabel(status: string): string {
  if (status === 'queued') return 'fila'
  if (status === 'processing' || status === 'running') return 'rodando'
  if (status === 'succeeded' || status === 'online' || status === 'passed') return 'ok'
  if (status === 'failed' || status === 'offline') return 'falhou'
  if (status === 'needs_review') return 'revisar'
  if (status === 'blocked') return 'bloqueado'
  if (status === 'degraded') return 'degradado'
  return status
}

function statusColor(status: string, c: ReturnType<typeof useTheme>['c']): string {
  if (status === 'succeeded' || status === 'online' || status === 'passed') return c.moss
  if (status === 'queued' || status === 'processing' || status === 'running' || status === 'degraded' || status === 'needs_review') return c.bronze
  if (status === 'failed' || status === 'offline' || status === 'blocked') return c.recRed
  return c.ink3
}

function providerWord(provider: AtlasAiTrace['provider']): string | undefined {
  if (provider === 'claude_codex') return 'conselho'
  if (provider === 'claude_cli')   return 'claude'
  if (provider === 'codex_cli')    return 'codex'
  if (provider == null || provider === 'auto') return undefined
  // Unknown string provider — show as-is, lowercased.
  return String(provider).toLowerCase()
}

function executorAsProviderWord(executor: RoutingExecutor): string | undefined {
  if (executor === 'claude_cli')   return 'claude'
  if (executor === 'codex_cli')    return 'codex'
  if (executor === 'claude_codex') return 'conselho'
  return undefined
}

function providerFromRouting(routing: RoutingState): AtlasAiProvider | null {
  if (routing.executor === 'claude_cli') return 'claude_cli'
  if (routing.executor === 'codex_cli') return 'codex_cli'
  if (routing.executor === 'claude_codex') return 'claude_codex'
  return null
}

function effectiveAgent(routing: RoutingState): string | undefined {
  if (routing.domain !== 'auto') return routing.domain
  if (routing.task === 'dev' || routing.task === 'debug') return 'desenvolvedor'
  if (routing.task === 'review') return 'code-reviewer'
  return undefined
}

function responsePolicyFor(style: RoutingStyle, task: RoutingState['task']) {
  const devMode = task === 'dev' || task === 'debug'
  if (style === 'technical') {
    return {
      style,
      no_code_by_default: false,
      plain_language: false,
      preferred_shape: devMode ? 'implementation_summary_with_files' : 'technical_answer',
      constraints: [
        'Explique decisões técnicas sem despejar código desnecessário.',
        'Inclua código apenas quando o operador pedir ou quando for indispensável.',
      ],
    }
  }
  if (style === 'complete') {
    return {
      style,
      no_code_by_default: true,
      plain_language: true,
      preferred_shape: 'complete_but_scannable',
      constraints: [
        'Resposta completa, mas escaneável.',
        'Evite blocos de código longos por padrão.',
      ],
    }
  }
  if (style === 'brief') {
    return {
      style,
      no_code_by_default: true,
      plain_language: true,
      preferred_shape: 'minimal_actionable',
      constraints: [
        'Responda no mínimo útil.',
        'Sem código salvo pedido explícito.',
      ],
    }
  }
  return {
    style,
    no_code_by_default: true,
    plain_language: true,
    preferred_shape: devMode ? 'operator_summary_no_code' : 'clear_direct_answer',
    constraints: [
      'Use linguagem simples e direta.',
      'Não mostre código por padrão; traduza implementação para consequência prática.',
      'Se precisar citar código, prefira nomes de arquivos e comportamento observado.',
    ],
  }
}

function feedbackPayload(action: FeedbackAction) {
  switch (action) {
    case 'useful':
      return {
        feedback_score: 5,
        feedback_action: 'useful',
        feedback_comment: 'Resposta útil.',
      }
    case 'wrong_context':
      return {
        feedback_score: 1,
        feedback_action: 'wrong_context',
        feedback_comment: 'Usou contexto errado ou perdeu continuidade.',
      }
    case 'too_long':
      return {
        feedback_score: 2,
        feedback_action: 'not_useful',
        feedback_comment: '[too_long] Resposta longa demais para o modo atual.',
      }
    case 'weak':
      return {
        feedback_score: 1,
        feedback_action: 'not_useful',
        feedback_comment: '[weak] Resposta fraca ou pouco acionável.',
      }
  }
}

function feedbackToast(action: FeedbackAction): string {
  if (action === 'useful') return 'Feedback registrado'
  if (action === 'wrong_context') return 'Atlas vai corrigir continuidade'
  if (action === 'too_long') return 'Atlas vai preferir respostas mais curtas'
  return 'Atlas vai tratar como resposta fraca'
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  const seconds = ms / 1000
  if (seconds < 10) return `${seconds.toFixed(1)} s`
  return `${Math.round(seconds)} s`
}

function formatRelative(value: string | null | undefined): string {
  if (!value) return 'sem data'
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return 'sem data'

  const diffMs = Date.now() - time
  if (diffMs < 60_000) return 'agora'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 14) return `há ${days} d`
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function mergeQualityAction(
  action: AtlasAiQualityAction,
  actions: AtlasAiQualityAction[],
): AtlasAiQualityAction[] {
  return [action, ...actions.filter((item) => item.id !== action.id)].slice(0, 30)
}

function buildConversationContext(traces: AtlasAiTrace[], threadId: string | null, pinnedTraceIds: string[] = []) {
  const completed = sortAtlasTraces(traces).filter((trace) => {
    if (isAtlasTraceActive(trace)) return false
    return trace.operator_input?.trim() || pickResponseText(trace).trim()
  })
  const pinnedSummaries = buildPinnedTraceSummary(completed, pinnedTraceIds)

  const turns = completed.slice(-4).flatMap((trace) => {
    const assistantText = pickResponseText(trace).trim()
    const items: Array<Record<string, string>> = [
      {
        role: 'user',
        text: truncateForContext(trace.operator_input, 900),
        trace_id: trace.id,
      },
    ]

    if (assistantText) {
      items.push({
        role: 'assistant',
        text: truncateForContext(assistantText, 1600),
        provider: providerWord(trace.provider) ?? 'atlas',
        trace_id: trace.id,
      })
    }

    return items
  })

  return {
    schema_version: 1,
    source: 'atlas_ai_sheet_recent_turns',
    thread_id: threadId,
    instruction:
      'Use este contexto para resolver respostas curtas como A/B/C, "ambos", "isso", "continua" e troca de provider.',
    pinned_summaries: pinnedSummaries,
    turns,
  }
}

function truncateForContext(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function pinnedTraceStorageKey(threadId: string): string {
  return `${PINNED_TRACE_KEY_PREFIX}${threadId}`
}

function newClientId(): string {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const randomUuid = globalThis.crypto?.randomUUID?.()
  if (randomUuid && uuidPattern.test(randomUuid)) return randomUuid
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16)
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8
    return value.toString(16)
  })
}

function humanAiError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback
  if (message.includes('route ai/') || message.includes('rota ai/')) {
    return 'Atlas AI não está carregado no servidor. Rebuild/restart o atlas-server e toque na marca para tentar de novo.'
  }
  return message
}

export type { RoutingExecutor }

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    height: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  headerSlot: {
    width: 104,
    height: 44,
    justifyContent: 'center',
  },
  headerSlotRight: {
    alignItems: 'flex-end',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 14,
  },
  headerAction: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thread: {
    flex: 1,
  },
  threadContent: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 24,
  },
  continuityPanel: {
    paddingBottom: 12,
    marginBottom: 18,
  },
  // Open state lifts the divider + adds breath. Closed state keeps the
  // composer adjacent (no extra weight when nothing's expanded).
  continuityPanelOpen: {
    paddingBottom: 22,
    marginBottom: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  continuityTop: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  continuityTitle: {
    flex: 1,
    gap: 2,
  },
  continuityToggle: {
    paddingVertical: 4,
  },
  continuityRows: {
    marginTop: 14,
    gap: 7,
  },
  microLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  microLabel: {
    width: 78,
    paddingTop: 0,
  },
  microValue: {
    flex: 1,
  },
  microSection: {
    marginTop: 18,
  },
  microSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  microSectionRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  microSectionBody: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  microAction: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runtimeStrip: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetContent: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 40,
  },
  sheetHeading: {
    alignItems: 'center',
  },
  dataSection: {
    marginBottom: 28,
  },
  sectionRule: {
    height: StyleSheet.hairlineWidth,
    marginTop: 8,
    marginBottom: 12,
  },
  dataSectionBody: {
    gap: 9,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  dataLabel: {
    width: 72,
    paddingTop: 1,
  },
  dataValue: {
    flex: 1,
  },
  dataList: {
    gap: 5,
  },
  executionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 7,
  },
  rowSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusPill: {
    minHeight: 24,
    paddingHorizontal: 9,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  attemptLine: {
    paddingTop: 4,
  },
  progressBox: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressMain: {
    flex: 1,
    gap: 1,
  },
  mappedList: {
    gap: 9,
  },
  mappedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  mappedMarker: {
    width: 12,
    paddingTop: 1,
  },
  mappedText: {
    flex: 1,
  },
  errorRow: {
    paddingBottom: 24,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 96,
    paddingHorizontal: 12,
  },
  turn: {
    paddingBottom: 8,
  },
  turnSeparator: {
    marginBottom: 48,
  },
  afterQuote: {
    marginTop: 20,
  },
  headingRule: {
    width: 32,
    height: StyleSheet.hairlineWidth,
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 22,
  },
  threadPickerContent: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 36,
  },
  searchInput: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 42,
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  threadMarker: {
    width: 28,
    paddingTop: 4,
  },
  threadRowBody: {
    flex: 1,
    gap: 3,
  },
  threadRowActions: {
    paddingLeft: 10,
    paddingTop: 2,
  },
  qualityBar: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  qualityActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  feedbackRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  feedbackButton: {
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 28,
    paddingTop: 4,
  },
})
