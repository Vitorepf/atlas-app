import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AppState,
  type AppStateStatus,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import { atlasStorage } from '../../lib/storage'
import * as Clipboard from 'expo-clipboard'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LayoutAnimationConfig,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SideSheet } from './SideSheet'
import { Frau, Mono, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useShell } from '../AtlasShell'
import { useOverlays } from '../../lib/overlays'
import {
  AtlasApiError,
  type AiInteractionUploadProgress,
  type AiObservabilityResponse,
  type AiInteractionFileAttachmentInput,
  type AiInteractionImageAttachmentInput,
  type AiProvidersStatusResponse,
  type AtlasAiAttachment,
  type AtlasAiCompaction,
  type AtlasAiContextSnapshot,
  type AtlasAiJob,
  type AtlasAiProviderHandoff,
  type AtlasAiProvider,
  type AtlasAiQualityAction,
  type AtlasAiQualityEvaluation,
  type AtlasAiSessionState,
  type AtlasAiThread,
  type AtlasAiTrace,
  cancelAiJob,
  compactAiThread,
  createAiInteraction,
  feedbackAiInteraction,
  getAtlasAuthHeaders,
  getApiBase,
  getAiObservability,
  getAiInteraction,
  getAiProvidersStatus,
  getAiThread,
  getAiThreadState,
  listAiInteractions,
  listAiQualityActions,
  listAiThreadSnapshots,
  listAiThreads,
  retryMobileInboxDiscussionBootstrap,
  retryAiJob,
  runAiQualityAction,
  switchAiThreadProvider,
  updateAiThread,
} from '../../lib/api/client'
import { BronzeDiamond } from '../console/BronzeDiamond'
import { CaptionWhisper } from '../console/CaptionWhisper'
import { FieldInline } from '../console/FieldInline'
import { AttachmentImageViewer } from '../console/AttachmentImageViewer'
import { BottomSheet } from './BottomSheet'
import { PageResponse } from '../console/PageResponse'
import { QuoteCompact } from '../console/QuoteCompact'
import { RoutingSheet } from '../console/RoutingSheet'
import {
  ROUTING_DEFAULT,
  StatusRouting,
  isRoutingDomainKey,
  sanitizeRoutingState,
  type RoutingExecutor,
  type RoutingMode,
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
  traceDisplayKey,
  traceMatchesClientId,
  traceMatchesTurnFilter,
} from '../../lib/atlasAiRuntime'
import {
  flushAtlasAiTelemetry,
  newAtlasAiCorrelationId,
  recordAtlasAiEvent,
} from '../../lib/atlasAiTelemetry'
import {
  atlasAiContextLabel,
  atlasAiFocusFromThread,
  atlasAiFocusLabel,
  normalizeAtlasAiFocus,
  type AtlasAiFocus,
} from '../../lib/atlasAiFocus'
import {
  atlasAiFocusForRouting,
  atlasAiModeFromThread,
  atlasAiModeLabel,
  normalizeAtlasAiMode,
  threadRoutingMetadataPatch,
} from '../../lib/atlasAiThreadRouting'
import {
  atlasModePayloadForRoutingContract,
} from '../../lib/atlasAiModeContract'
import {
  bootstrapRetryResultMessage,
  bootstrapStatusLabel,
  inboxItemIdFromThread,
  isDiscussionBootstrapTrace,
  isOperationalContextThread,
  operationalBootstrapStatus,
  type OperationalBootstrapData,
  type OperationalBootstrapStep,
} from '../../lib/atlasOperationalBootstrap'

const OPEN_ACTION_STATUSES = new Set(['queued', 'running', 'blocked', 'failed'])
const PENDING_SUBMISSION_KEY = 'atlas-ai.pending-submission'
const ROUTING_KEY = 'atlas-ai.routing'
const PINNED_TRACE_KEY_PREFIX = 'atlas-ai.pinned-traces.'
const PENDING_SUBMISSION_RETRY_DELAY_MS = 8_000
const MAX_DRAFT_IMAGES = 8
const MAX_DRAFT_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_DRAFT_FILE_BYTES = 20 * 1024 * 1024
const MAX_DRAFT_FILES = 4

async function copyToClipboard(text: string, onSuccess?: () => void): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return
  try {
    await Clipboard.setStringAsync(trimmed)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onSuccess?.()
  } catch {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
  }
}

function formatConversationForCopy(traces: AtlasAiTrace[]): string {
  const blocks: string[] = []
  for (const trace of traces) {
    const userText = trace.operator_input?.trim() ?? ''
    if (userText) blocks.push(`você\n${userText}`)
    const atlasText = pickResponseText(trace).trim()
    if (atlasText) blocks.push(`atlas\n${atlasText}`)
  }
  return blocks.join('\n\n')
}

interface PendingTurn {
  clientId: string
  correlationId: string
  text: string
  attachments: ComposerImageAttachment[]
  fileAttachments: ComposerFileAttachment[]
  startedAt: number
  status: 'sending' | 'failed'
  attachmentPhase?: AttachmentUploadPhase
  attachmentProgress?: number
  errorMessage?: string
  executor: RoutingExecutor
}

type AttachmentUploadPhase = 'preparing' | 'uploading' | 'accepted' | 'failed'

interface ComposerImageAttachment extends AiInteractionImageAttachmentInput {
  id: string
}

interface ComposerFileAttachment extends AiInteractionFileAttachmentInput {
  id: string
}

interface PendingAiSubmission {
  clientId: string
  correlationId: string
  input: string
  attachments?: ComposerImageAttachment[]
  fileAttachments?: ComposerFileAttachment[]
  threadId: string | null
  routing: RoutingState
  pinnedTraceIds: string[]
  threadOriginPayload?: Record<string, unknown> | null
  startedAt: number
}

interface SubmitTextOptions {
  clientId?: string
  correlationId?: string
  threadId?: string | null
  routingSnapshot?: RoutingState
  pinnedTraceIdsSnapshot?: string[]
  attachments?: ComposerImageAttachment[]
  fileAttachments?: ComposerFileAttachment[]
  startedAt?: number
  recovered?: boolean
  threadOriginPayload?: Record<string, unknown> | null
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
  attachments?: ComposerImageAttachment[]
  fileAttachments?: ComposerFileAttachment[]
  historicalAttachments?: AtlasAiAttachment[]
  attachmentPhase?: AttachmentUploadPhase
  attachmentProgress?: number
  body: TurnBody
}

type FeedbackAction = 'useful' | 'wrong_context' | 'too_long' | 'weak'

export function AtlasAiSheet() {
  const open = useOverlays((s) => s.open)
  const requestedThreadId = useOverlays((s) => s.atlasAiThreadId)
  const close = useOverlays((s) => s.close)
  const visible = open === 'atlasAi'
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { showToast } = useShell()
  const scrollRef = useRef<FlatList<DisplayTurn>>(null)

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
  const [bootstrapRetrying, setBootstrapRetrying] = useState(false)
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
  const [copyToast, setCopyToast] = useState<string | null>(null)
  const copyToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pinnedTraceIds, setPinnedTraceIds] = useState<string[]>([])
  const [draftAttachments, setDraftAttachments] = useState<ComposerImageAttachment[]>([])
  const [draftFileAttachments, setDraftFileAttachments] = useState<ComposerFileAttachment[]>([])
  const [attachmentSheetOpen, setAttachmentSheetOpen] = useState(false)
  const [attachmentBusy, setAttachmentBusy] = useState<string | null>(null)
  const [previewAttachment, setPreviewAttachment] = useState<ComposerImageAttachment | null>(null)
  const [previewHistoricalAttachment, setPreviewHistoricalAttachment] = useState<AtlasAiAttachment | null>(null)
  const [pendingThreadOrigin, setPendingThreadOrigin] = useState<Record<string, unknown> | null>(null)
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null)
  const [lastRefreshError, setLastRefreshError] = useState<string | null>(null)
  const [refreshFailures, setRefreshFailures] = useState(0)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)

  const flashCopyToast = useCallback((label: string) => {
    setCopyToast(label)
    if (copyToastTimer.current) clearTimeout(copyToastTimer.current)
    copyToastTimer.current = setTimeout(() => setCopyToast(null), 1400)
  }, [])

  useEffect(() => () => {
    if (copyToastTimer.current) clearTimeout(copyToastTimer.current)
  }, [])

  const recoveringPendingRef = useRef(false)
  const threadViewVersionRef = useRef(0)
  const activeTraceRef = useRef<AtlasAiTrace | null>(null)
  const currentThreadIdRef = useRef<string | null>(currentThreadId)

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
  const interactionLocked = submitting || hasActiveTrace || isPendingSending
  const activeTraceAgeMs = activeTrace ? Date.now() - new Date(activeTrace.created_at).getTime() : null
  const visibleTraces = useMemo(
    () => traces.filter((trace) => traceMatchesTurnFilter(trace, turnFilter, pinnedTraceIds)),
    [pinnedTraceIds, traces, turnFilter],
  )
  const contextualIntro = useMemo(() => contextualThreadIntro(currentThread), [currentThread])
  const operationalBootstrap = useMemo(
    () => operationalBootstrapStatus(currentThread, traces),
    [currentThread, traces],
  )
  const modeNotice = useMemo(() => threadModeNotice(currentThread), [currentThread])

  useEffect(() => {
    activeTraceRef.current = activeTrace
  }, [activeTrace])

  useEffect(() => {
    currentThreadIdRef.current = currentThreadId
  }, [currentThreadId])

  useEffect(() => {
    let cancelled = false
    atlasStorage.getItem(ROUTING_KEY)
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
    void atlasStorage.setItem(ROUTING_KEY, JSON.stringify(routing))
  }, [routing, routingHydrated])

  useEffect(() => {
    let cancelled = false

    async function hydratePins() {
      if (!currentThreadId) {
        setPinnedTraceIds([])
        return
      }

      try {
        const stored = await atlasStorage.getItem(pinnedTraceStorageKey(currentThreadId))
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
    void atlasStorage.setItem(pinnedTraceStorageKey(currentThreadId), JSON.stringify(pinnedTraceIds.slice(0, 24)))
  }, [currentThreadId, pinnedTraceIds])

  const loadThreadData = useCallback(
    async (
      threadId: string | null,
      {
        silent = false,
        knownThreads = null,
        skipThreadList = false,
      }: { silent?: boolean; knownThreads?: AtlasAiThread[] | null; skipThreadList?: boolean } = {},
    ) => {
      if (!silent) setLoading(true)
      setError(null)

      try {
        let threadListError: unknown = null
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
          knownThreads
            ? Promise.resolve({ threads: knownThreads })
            : skipThreadList
              ? Promise.resolve(null)
              : listAiThreads({
                  status: 'active',
                  limit: 20,
                }).catch((threadsError) => {
                  threadListError = threadsError
                  return null
                }),
          threadId ? listAiThreadSnapshots(threadId, { limit: 12 }).catch(() => null) : Promise.resolve(null),
        ])

        const threads = threadsResponse?.threads ?? null
        const thread = threadResponse?.thread ?? threads?.find((item) => item.id === threadId) ?? null

        setTraces(sortAtlasTraces(interactionsResponse.traces))
        setCurrentThread(thread)
        if (thread) setRouting((current) => routingStateFromThread(thread, current))
        setSessionState(stateResponse?.state ?? thread?.active_state ?? null)
        setProviderStatus(providersResponse)
        setObservability(observabilityResponse)
        setQualityActions(actionsResponse?.actions ?? [])
        if (threads) setThreadList(threads)
        setContextSnapshots(snapshotsResponse?.snapshots ?? [])
        setLastRefreshAt(Date.now())
        if (threadListError) {
          const message = humanAiError(threadListError, 'Falha ao carregar conversas.')
          setLastRefreshError(message)
          setRefreshFailures((count) => count + 1)
          if (!silent) setError(message)
        } else {
          setLastRefreshError(null)
          setRefreshFailures(0)
        }
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

  const retryOperationalBootstrap = useCallback(async () => {
    const inboxItemId = inboxItemIdFromThread(currentThread)
    if (!currentThreadId || !inboxItemId) {
      showToast('Nao encontrei o item operacional desta conversa')
      return
    }

    const correlationId = newAtlasAiCorrelationId()
    setBootstrapRetrying(true)
    void recordAtlasAiEvent({
      eventName: 'bootstrap_retry_requested',
      correlation_id: correlationId,
      thread_id: currentThreadId,
      metadata: {
        inbox_item_id: inboxItemId,
        bootstrap_status: currentThread?.metadata?.discussion_bootstrap_status ?? null,
        bootstrap_trace_id: currentThread?.metadata?.discussion_bootstrap_trace_id ?? null,
      },
    })

    try {
      const response = await retryMobileInboxDiscussionBootstrap(inboxItemId)
      const bootstrap = response.result.bootstrap
      const bootstrapStatus = stringFromRecord(bootstrap, 'status')
      const bootstrapReason = stringFromRecord(bootstrap, 'reason')
      void recordAtlasAiEvent({
        eventName: 'bootstrap_retry_result',
        correlation_id: correlationId,
        thread_id: currentThreadId,
        trace_id: stringFromRecord(bootstrap, 'trace_id') ?? null,
        metadata: {
          inbox_item_id: inboxItemId,
          bootstrap_status: bootstrapStatus,
          attempt: numberFromRecord(bootstrap, 'attempt'),
          reason: bootstrapReason,
        },
      })
      showToast(bootstrapRetryResultMessage(bootstrapStatus, bootstrapReason))
      await loadThreadData(currentThreadId, { silent: true })
    } catch (retryError) {
      const message = humanAiError(retryError, 'Falha ao tentar novamente.')
      void recordAtlasAiEvent({
        eventName: 'bootstrap_retry_failed',
        correlation_id: correlationId,
        thread_id: currentThreadId,
        metadata: {
          inbox_item_id: inboxItemId,
          error: message,
        },
      })
      showToast(message)
    } finally {
      setBootstrapRetrying(false)
    }
  }, [currentThread, currentThreadId, loadThreadData, showToast])

  useEffect(() => {
    if (!visible) return
    let cancelled = false

    // Tap no FAB sempre abre uma conversa NOVA. Quando outro painel chama
    // openAtlasAi(threadId), abrimos exatamente aquela conversa sem enviar
    // mensagem nova.
    // Antes, restaurar a última thread fazia 8 requests em Promise.all e
    // travava a UI por minutos quando o histórico era grande.
    threadViewVersionRef.current += 1
    setCurrentThreadId(requestedThreadId ?? null)
    setCurrentThread(null)
    setSessionState(null)
    setTraces([])
    setQualityActions([])
    setContextSnapshots([])
    setPending(null)
    setPendingThreadOrigin(null)
    setError(null)
    setLastRefreshError(null)
    setRefreshFailures(0)

    if (requestedThreadId) {
      void loadThreadData(requestedThreadId, { silent: false })

      return () => {
        cancelled = true
      }
    }

    setLoading(false)

    // Background fetch silencioso da lista de threads para que o botão
    // "Conversas anteriores" tenha dados prontos. Falhas são silenciosas —
    // lista vazia só esconde a affordance, não bloqueia o chat.
    void listAiThreads({
      status: 'active',
      limit: 20,
    })
      .then((response) => {
        if (cancelled) return
        setThreadList(response?.threads ?? [])
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [loadThreadData, requestedThreadId, visible])

  // Refresh silencioso da lista de threads quando o painel de histórico abre.
  useEffect(() => {
    if (!threadHistoryOpen) return
    let cancelled = false
    void listAiThreads({
      status: 'active',
      limit: 20,
    })
      .then((response) => {
        if (cancelled) return
        setThreadList(response?.threads ?? [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [threadHistoryOpen])

  useEffect(() => {
    if (!visible) return
    void recordAtlasAiEvent({
      eventName: 'atlas_ai_sheet_opened',
      thread_id: currentThreadIdRef.current,
      metadata: {
        has_current_thread: currentThreadIdRef.current != null,
      },
    })
    void flushAtlasAiTelemetry()
  }, [visible])

  useEffect(() => {
    if (!visible) return

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previous = appStateRef.current
      appStateRef.current = nextState
      if (previous === 'active' && nextState !== 'active') {
        const trace = activeTraceRef.current
        if (trace) {
          const createdAt = new Date(trace.created_at).getTime()
          void recordAtlasAiEvent({
            eventName: 'app_backgrounded_during_trace',
            trace_id: trace.id,
            thread_id: trace.thread_id ?? currentThreadIdRef.current,
            provider: trace.provider,
            agent_slug: trace.agent_slug,
            duration_ms: Number.isFinite(createdAt) ? Math.max(0, Date.now() - createdAt) : null,
            metadata: {
              status: trace.status,
              app_state: nextState,
            },
          })
        }
      }
      if (previous !== 'active' && nextState === 'active') {
        void flushAtlasAiTelemetry()
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
      void flushAtlasAiTelemetry()
      setPending(null)
      setError(null)
      setAttachmentSheetOpen(false)
      setAttachmentBusy(null)
      setDraftAttachments([])
      setDraftFileAttachments([])
      setPreviewAttachment(null)
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
      void recordAtlasAiEvent({
        eventName: 'keyboard_opened',
        thread_id: currentThreadIdRef.current,
        trace_id: activeTraceRef.current?.id ?? null,
        metadata: {
          has_active_trace: activeTraceRef.current != null,
        },
      })
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

  const addDraftAttachments = useCallback(async (incoming: ComposerImageAttachment[]) => {
    if (incoming.length === 0) return
    const accepted: ComposerImageAttachment[] = []
    for (const attachment of incoming) {
      if (await attachmentFitsLocalLimit(attachment)) {
        accepted.push(attachment)
      } else {
        showToast(`Imagem acima de ${formatBytes(MAX_DRAFT_IMAGE_BYTES)}`)
      }
    }
    if (accepted.length === 0) return

    setDraftAttachments((current) => {
      const merged = [...current]
      for (const attachment of accepted) {
        if (merged.length >= MAX_DRAFT_IMAGES) break
        if (merged.some((item) => item.uri === attachment.uri)) continue
        merged.push(attachment)
      }
      if (accepted.length + current.length > MAX_DRAFT_IMAGES) {
        showToast(`Limite de ${MAX_DRAFT_IMAGES} imagens por mensagem`)
      }
      return merged
    })
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [showToast])

  const addDraftFileAttachments = useCallback(async (incoming: ComposerFileAttachment[]) => {
    if (incoming.length === 0) return
    const accepted: ComposerFileAttachment[] = []
    for (const attachment of incoming) {
      if (await fileAttachmentFitsLocalLimit(attachment)) {
        accepted.push(attachment)
      } else {
        showToast('Arquivo muito grande para enviar')
      }
    }
    if (accepted.length === 0) return

    setDraftFileAttachments((current) => {
      const merged = [...current]
      for (const attachment of accepted) {
        if (merged.length >= MAX_DRAFT_FILES) break
        if (merged.some((item) => item.uri === attachment.uri)) continue
        merged.push(attachment)
      }
      if (accepted.length + current.length > MAX_DRAFT_FILES) {
        showToast(`Limite de ${MAX_DRAFT_FILES} arquivos por mensagem`)
      }
      return merged
    })
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [showToast])

  const pasteClipboardImage = useCallback(async () => {
    if (draftAttachments.length >= MAX_DRAFT_IMAGES) {
      showToast(`Limite de ${MAX_DRAFT_IMAGES} imagens por mensagem`)
      return
    }

    setAttachmentBusy('clipboard')
    try {
      const hasImage = await Clipboard.hasImageAsync().catch(() => false)
      if (!hasImage) {
        showToast('Nenhuma imagem no clipboard')
        return
      }

      const image = await Clipboard.getImageAsync({ format: 'png' })
      if (!image?.data) {
        showToast('Nenhuma imagem no clipboard')
        return
      }

      await addDraftAttachments([await attachmentFromClipboardImage(image)])
      setAttachmentSheetOpen(false)
    } catch (clipboardError) {
      showToast(humanAiError(clipboardError, 'Falha ao colar imagem.'))
    } finally {
      setAttachmentBusy(null)
    }
  }, [addDraftAttachments, draftAttachments.length, showToast])

  const pickDocumentFiles = useCallback(async () => {
    if (draftFileAttachments.length >= MAX_DRAFT_FILES) {
      showToast(`Limite de ${MAX_DRAFT_FILES} arquivos por mensagem`)
      return
    }

    setAttachmentBusy('files')
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
        copyToCacheDirectory: true,
      })

      if (!result.canceled) {
        const remainingFiles = MAX_DRAFT_FILES - draftFileAttachments.length
        const remainingImages = MAX_DRAFT_IMAGES - draftAttachments.length
        const imageAssets = result.assets
          .filter(isDocumentImageAsset)
          .slice(0, remainingImages)
        const fileAssets = result.assets
          .filter((asset) => !isDocumentImageAsset(asset))
          .slice(0, remainingFiles)

        await addDraftAttachments(imageAssets.map(attachmentFromDocumentImageAsset))
        await addDraftFileAttachments(fileAssets.map(attachmentFromDocumentAsset))
        setAttachmentSheetOpen(false)
      }
    } catch (fileError) {
      showToast(humanAiError(fileError, 'Não foi possível abrir arquivos.'))
    } finally {
      setAttachmentBusy(null)
    }
  }, [
    addDraftAttachments,
    addDraftFileAttachments,
    draftAttachments.length,
    draftFileAttachments.length,
    showToast,
  ])

  const pickCameraImage = useCallback(async () => {
    if (draftAttachments.length >= MAX_DRAFT_IMAGES) {
      showToast(`Limite de ${MAX_DRAFT_IMAGES} imagens por mensagem`)
      return
    }

    setAttachmentBusy('camera')
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        showToast('Permissão de câmera negada')
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        exif: false,
      })

      if (!result.canceled && result.assets[0]) {
        await addDraftAttachments([attachmentFromAsset(result.assets[0], 'camera')])
        setAttachmentSheetOpen(false)
      }
    } catch (cameraError) {
      showToast(humanAiError(cameraError, 'Não foi possível abrir a câmera.'))
    } finally {
      setAttachmentBusy(null)
    }
  }, [addDraftAttachments, draftAttachments.length, showToast])

  const pickPhotoImages = useCallback(async () => {
    if (draftAttachments.length >= MAX_DRAFT_IMAGES) {
      showToast(`Limite de ${MAX_DRAFT_IMAGES} imagens por mensagem`)
      return
    }

    setAttachmentBusy('photos')
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync(false)
      if (!permission.granted) {
        showToast('Permissão de fotos negada')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: Math.max(1, MAX_DRAFT_IMAGES - draftAttachments.length),
        quality: 1,
        exif: false,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
      })

      if (!result.canceled) {
        await addDraftAttachments(result.assets.map((asset) => attachmentFromAsset(asset, 'photos')))
        setAttachmentSheetOpen(false)
      }
    } catch (photoError) {
      showToast(humanAiError(photoError, 'Não foi possível abrir fotos.'))
    } finally {
      setAttachmentBusy(null)
    }
  }, [addDraftAttachments, draftAttachments.length, showToast])

  const removeDraftAttachment = useCallback((id: string) => {
    setDraftAttachments((current) => current.filter((attachment) => attachment.id !== id))
    setPreviewAttachment((current) => (current?.id === id ? null : current))
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const removeDraftFileAttachment = useCallback((id: string) => {
    setDraftFileAttachments((current) => current.filter((attachment) => attachment.id !== id))
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const submitText = useCallback(
    async (input: string, options: SubmitTextOptions = {}) => {
      const attachments = options.attachments ?? []
      const fileAttachments = options.fileAttachments ?? []
      input = input.trim() || attachmentOnlyPrompt(attachments, fileAttachments)
      if (!input || submitting) return
      if (hasActiveTrace || isPendingSending) {
        showToast('Atlas ainda está pensando')
        return
      }

      const clientId = options.clientId ?? newClientId()
      const correlationId = options.correlationId ?? newAtlasAiCorrelationId()
      const threadId = options.threadId !== undefined ? options.threadId : currentThreadId
      const routingSnapshot = sanitizeRoutingState(options.routingSnapshot ?? routing)
      const pinnedTraceIdsSnapshot = options.pinnedTraceIdsSnapshot ?? pinnedTraceIds
      const startedAt = options.startedAt ?? Date.now()
      const threadViewVersion = threadViewVersionRef.current
      const threadOriginPayload = options.threadOriginPayload ?? (!threadId ? pendingThreadOrigin : null)
      const agent = effectiveAgent(routingSnapshot)
      const hasAttachments = attachments.length + fileAttachments.length > 0
      const attachmentAnalysisPreferred =
        hasAttachments
        && routingSnapshot.executor === 'auto'
        && geminiAutomaticEnabled(providerStatus)
      const pendingExecutor: RoutingExecutor = routingSnapshot.executor
      const decisionMode = routingSnapshot.executor === 'auto' ? 'atlas_decide' : 'manual_override'
      const telemetryRoute = {
        mode: routingSnapshot.mode,
        executor: routingSnapshot.executor,
        task: routingSnapshot.task,
        style: routingSnapshot.style,
        domain: routingSnapshot.domain,
        recovered: options.recovered === true,
        input_chars: input.length,
        image_attachments: attachments.length,
        file_attachments: fileAttachments.length,
      }
      const optimistic: PendingTurn = {
        clientId,
        correlationId,
        text: input,
        attachments,
        fileAttachments,
        startedAt,
        status: 'sending',
        attachmentPhase: hasAttachments ? 'preparing' : undefined,
        executor: pendingExecutor,
      }
      const pendingSubmission: PendingAiSubmission = {
        clientId,
        correlationId,
        input,
        attachments,
        fileAttachments,
        threadId,
        routing: routingSnapshot,
        pinnedTraceIds: pinnedTraceIdsSnapshot.slice(0, 24),
        threadOriginPayload,
        startedAt,
      }

      setError(null)
      setSubmitting(true)
      await recordAtlasAiEvent({
        eventName: 'message_send_pressed',
        correlation_id: correlationId,
        client_id: clientId,
        thread_id: threadId,
        agent_slug: agent,
        numeric_value: input.length,
        unit: 'chars',
        metadata: telemetryRoute,
      })
      const pendingStored = await storePendingSubmission(pendingSubmission)
      await recordAtlasAiEvent({
        eventName: 'pending_submission_stored',
        correlation_id: correlationId,
        client_id: clientId,
        thread_id: threadId,
        agent_slug: agent,
        numeric_value: pendingStored ? 1 : 0,
        unit: 'boolean',
        metadata: {
          ...telemetryRoute,
          stored: pendingStored,
        },
      })

      // Optimistic UI after the local outbox is durable.
      setDraft('')
      if (!options.recovered) {
        setDraftAttachments([])
        setDraftFileAttachments([])
      }
      setPending(optimistic)
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)

      try {
        const requestStartedAt = Date.now()
        const councilMode = routingSnapshot.executor === 'claude_codex'
        const provider: AtlasAiProvider | undefined =
          councilMode
            ? 'claude_codex'
            : (routingSnapshot.executor === 'auto'
                ? undefined
                : (routingSnapshot.executor as AtlasAiProvider))
        const kind = councilMode
          ? 'council'
          : routingSnapshot.task === 'direct'
            ? 'interaction'
            : 'analysis'
        const executionPolicy = councilMode ? 'dual_review' : 'single_provider'
        const conversationContext = buildConversationContext(traces, threadId, pinnedTraceIdsSnapshot)
        const responsePolicy = responsePolicyFor(routingSnapshot.style, routingSnapshot.task)
        const routeFocus = atlasAiFocusForRouting(routingSnapshot)
        const atlasFocus = currentThread && isOperationalContextThread(currentThread) && routeFocus === 'general'
          ? 'operational'
          : routeFocus
        const modePolicy = atlasModePayloadForRouting(routingSnapshot, atlasFocus, currentThread?.workspace ?? null)
        const threadRuntimePolicy =
          threadId && currentThread?.id === threadId
            ? runtimePolicyPayloadForThread(currentThread, atlasFocus)
            : {}
        const runtimePolicy = {
          ...modePolicy,
          ...threadRuntimePolicy,
          ...(threadOriginPayload ?? {}),
        }

        void recordAtlasAiEvent({
          eventName: 'interaction_request_started',
          correlation_id: correlationId,
          client_id: clientId,
          thread_id: threadId,
          provider: provider ?? null,
          agent_slug: agent,
          metadata: {
            ...telemetryRoute,
            new_thread: threadId == null,
            execution_policy: executionPolicy,
            decision_mode: decisionMode,
            context_strategy_hint: attachmentAnalysisPreferred ? 'long_context_or_multimodal' : undefined,
            image_attachments: attachments.length,
          },
        })

        if (hasAttachments) {
          setPending((curr) =>
            curr?.clientId === clientId
              ? { ...curr, attachmentPhase: 'uploading' }
              : curr,
          )
        }

        const handleUploadProgress = (progress: AiInteractionUploadProgress) => {
          if (!hasAttachments) return
          setPending((curr) =>
            curr?.clientId === clientId
              ? {
                  ...curr,
                  attachmentPhase: progress.phase === 'complete' ? 'accepted' : 'uploading',
                  attachmentProgress: progress.percent,
                }
              : curr,
          )
        }

        const response = await createAiInteraction({
          input_text: input,
          client_id: clientId,
          thread_id: threadId ?? undefined,
          new_thread: threadId ? false : true,
          agent_slug: agent,
          provider,
          kind,
          source_type: 'app',
          include_semantic_context: true,
          context_note_limit: 5,
          image_attachments: attachments.map(({ id: _id, ...attachment }) => attachment),
          file_attachments: fileAttachments.map(({ id: _id, ...attachment }) => attachment),
          on_upload_progress: handleUploadProgress,
          payload: {
            app_surface: 'atlas_ai_sheet',
            atlas_focus: atlasFocus,
            atlas_workflow_mode: routingSnapshot.task === 'debug' ? 'dev' : routingSnapshot.task,
            open_brain: openBrainPayloadForRouting(routingSnapshot),
            decision_mode: decisionMode,
            routing_task: routingSnapshot.task,
            routing_domain: routingSnapshot.domain,
            requested_agent: routingSnapshot.domain,
            requested_provider: provider,
            operator_requested_provider: routingSnapshot.executor,
            context_strategy_hint: attachmentAnalysisPreferred ? 'long_context_or_multimodal' : undefined,
            visual_input: attachments.length > 0
              ? {
                  image_count: attachments.length,
                  sources: [...new Set(attachments.map((attachment) => attachment.source ?? 'app'))],
                }
              : undefined,
            file_input: fileAttachments.length > 0
              ? {
                  file_count: fileAttachments.length,
                  names: fileAttachments.map((attachment) => attachment.fileName).slice(0, MAX_DRAFT_FILES),
                }
              : undefined,
            response_style: routingSnapshot.style,
            response_policy: responsePolicy,
            task_type: routingSnapshot.task === 'debug' ? 'debug' : undefined,
            constraints: responsePolicy.constraints,
            execution_policy: executionPolicy,
            conversation_context: conversationContext,
            council_providers: councilMode ? ['claude_cli', 'codex_cli'] : undefined,
            council_rule: councilMode
              ? 'both_propose_or_review; execution_requires_single_provider'
              : undefined,
            ...runtimePolicy,
          },
        })

        const submissionStillSelected = threadViewVersionRef.current === threadViewVersion

        void recordAtlasAiEvent({
          eventName: 'interaction_accepted',
          correlation_id: correlationId,
          client_id: clientId,
          trace_id: response.trace.id,
          thread_id: response.trace.thread_id ?? threadId,
          provider: response.trace.provider ?? provider ?? null,
          agent_slug: response.trace.agent_slug ?? agent,
          duration_ms: Date.now() - requestStartedAt,
          metadata: {
            ...telemetryRoute,
            trace_status: response.trace.status,
            visible_in_current_view: submissionStillSelected,
          },
        })

        if (response.trace.thread_id && submissionStillSelected) {
          setCurrentThreadId(response.trace.thread_id)
          if (!threadId) setPendingThreadOrigin(null)
        }
        await clearPendingSubmission(clientId)

        // Real trace arrived. Add it and clear pending atomically (React
        // batches both updates). The Turn is keyed by clientId so the
        // existing QuoteCompact stays mounted across the swap (no flash).
        if (submissionStillSelected) {
          if (hasAttachments) {
            setPending((curr) =>
              curr?.clientId === clientId
                ? { ...curr, attachmentPhase: 'accepted' }
                : curr,
            )
          }
          setTraces((current) => mergeAtlasTrace(response.trace, current))
          setPending((curr) => (curr?.clientId === clientId ? null : curr))
          void recordAtlasAiEvent({
            eventName: 'trace_visible_in_ui',
            correlation_id: correlationId,
            client_id: clientId,
            trace_id: response.trace.id,
            thread_id: response.trace.thread_id ?? threadId,
            provider: response.trace.provider ?? provider ?? null,
            agent_slug: response.trace.agent_slug ?? agent,
            duration_ms: Date.now() - startedAt,
            metadata: telemetryRoute,
          })
          void loadThreadData(response.trace.thread_id ?? threadId, { silent: true })
        } else {
          void recordAtlasAiEvent({
            eventName: 'trace_not_visible_after_thread_change',
            correlation_id: correlationId,
            client_id: clientId,
            trace_id: response.trace.id,
            thread_id: response.trace.thread_id ?? threadId,
            provider: response.trace.provider ?? provider ?? null,
            agent_slug: response.trace.agent_slug ?? agent,
            duration_ms: Date.now() - startedAt,
            metadata: telemetryRoute,
          })
        }
      } catch (submitError) {
        const keepPending = shouldKeepPendingSubmission(submitError)
        void recordAtlasAiEvent({
          eventName: 'interaction_request_failed',
          correlation_id: correlationId,
          client_id: clientId,
          thread_id: threadId,
          agent_slug: agent,
          duration_ms: Date.now() - startedAt,
          metadata: {
            ...telemetryRoute,
            keep_pending: keepPending,
            error_type: submitError instanceof Error ? submitError.name : typeof submitError,
            status: submitError instanceof AtlasApiError ? submitError.status : null,
          },
        })
        if (!keepPending) {
          void clearPendingSubmission(clientId)
        }
        const message = humanAiError(submitError, 'falha no envio.')
        if (threadViewVersionRef.current === threadViewVersion) {
          setPending((curr) =>
            curr?.clientId === clientId
              ? { ...curr, status: 'failed', attachmentPhase: 'failed', errorMessage: message }
              : curr,
          )
        }
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
      currentThread,
      pendingThreadOrigin,
      pinnedTraceIds,
      loadThreadData,
      providerStatus,
    ],
  )

  const recoverPendingSubmission = useCallback(async () => {
    if (recoveringPendingRef.current || submitting || hasActiveTrace || isPendingSending) return

    const pendingSubmission = await readPendingSubmission()
    if (!pendingSubmission) return
    if ((pendingSubmission.threadId ?? null) !== currentThreadId) return

    const existingTrace = traces.find((trace) => traceMatchesClientId(trace, pendingSubmission.clientId))
    if (existingTrace) {
      void recordAtlasAiEvent({
        eventName: 'pending_submission_matched_existing_trace',
        correlation_id: pendingSubmission.correlationId,
        client_id: pendingSubmission.clientId,
        trace_id: existingTrace.id,
        thread_id: existingTrace.thread_id ?? pendingSubmission.threadId,
        provider: existingTrace.provider,
        agent_slug: existingTrace.agent_slug,
        duration_ms: Date.now() - pendingSubmission.startedAt,
        metadata: {
          recovered_from_local_outbox: true,
        },
      })
      await clearPendingSubmission(pendingSubmission.clientId)
      return
    }

    if (Date.now() - pendingSubmission.startedAt < PENDING_SUBMISSION_RETRY_DELAY_MS) return

    recoveringPendingRef.current = true
    try {
      void recordAtlasAiEvent({
        eventName: 'pending_submission_recovered',
        correlation_id: pendingSubmission.correlationId,
        client_id: pendingSubmission.clientId,
        thread_id: pendingSubmission.threadId,
        duration_ms: Date.now() - pendingSubmission.startedAt,
        metadata: {
          age_ms: Date.now() - pendingSubmission.startedAt,
          executor: pendingSubmission.routing.executor,
          task: pendingSubmission.routing.task,
          style: pendingSubmission.routing.style,
          domain: pendingSubmission.routing.domain,
        },
      })
      showToast('Retomando envio pendente do Atlas')
      await submitText(pendingSubmission.input, {
        clientId: pendingSubmission.clientId,
        correlationId: pendingSubmission.correlationId,
        threadId: pendingSubmission.threadId,
        routingSnapshot: pendingSubmission.routing,
        pinnedTraceIdsSnapshot: pendingSubmission.pinnedTraceIds,
        attachments: pendingSubmission.attachments ?? [],
        fileAttachments: pendingSubmission.fileAttachments ?? [],
        startedAt: pendingSubmission.startedAt,
        recovered: true,
        threadOriginPayload: pendingSubmission.threadOriginPayload ?? null,
      })
    } finally {
      recoveringPendingRef.current = false
    }
  }, [currentThreadId, hasActiveTrace, isPendingSending, showToast, submitText, submitting, traces])

  useEffect(() => {
    if (!visible) return
    const timeout = setTimeout(() => {
      void recoverPendingSubmission()
    }, 1200)
    return () => clearTimeout(timeout)
  }, [recoverPendingSubmission, visible])

  useEffect(() => {
    if (!visible) return

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void recoverPendingSubmission()
      }
    })

    return () => subscription.remove()
  }, [recoverPendingSubmission, visible])

  const submit = useCallback(() => {
    void submitText(draft.trim(), {
      attachments: draftAttachments,
      fileAttachments: draftFileAttachments,
    })
  }, [submitText, draft, draftAttachments, draftFileAttachments])

  const openRouting = useCallback(() => {
    setRoutingOpen(true)
  }, [])

  const retryPending = useCallback(() => {
    if (!pending || pending.status !== 'failed') return
    const text = pending.text
    const correlationId = pending.correlationId
    const attachments = pending.attachments
    const fileAttachments = pending.fileAttachments
    setPending(null)
    void submitText(text, { correlationId, attachments, fileAttachments })
  }, [pending, submitText])

  const startNewThread = useCallback(() => {
    const trace = activeTraceRef.current
    if (trace) {
      void recordAtlasAiEvent({
        eventName: 'thread_new_started_while_trace_active',
        trace_id: trace.id,
        thread_id: trace.thread_id ?? currentThreadIdRef.current,
        provider: trace.provider,
        agent_slug: trace.agent_slug,
        metadata: {
          status: trace.status,
        },
      })
    }
    threadViewVersionRef.current += 1
    setCurrentThreadId(null)
    setCurrentThread(null)
    setSessionState(null)
    setTraces([])
    setQualityActions([])
    setContextSnapshots([])
    setPending(null)
    setPendingThreadOrigin(null)
    setDraft('')
    setDraftAttachments([])
    setDraftFileAttachments([])
    setAttachmentSheetOpen(false)
    setPreviewAttachment(null)
    setError(null)
    setThreadHistoryOpen(false)
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }, [])

  const promoteContextToDevelopment = useCallback(() => {
    if (!currentThread || !contextualIntro) return
    if (interactionLocked) {
      showToast('Aguarde a resposta atual antes de abrir desenvolvimento')
      return
    }

    const programmingRouting = sanitizeRoutingState({
      mode: 'programming',
      task: 'dev',
      domain: 'atlas',
      executor: 'codex_cli',
      style: 'technical',
    })
    const threadOriginPayload = developmentThreadOriginPayload(currentThread, contextualIntro)
    const developmentPrompt = developmentPromptFromContext(contextualIntro, currentThread, traces)
    const promotionCorrelationId = newAtlasAiCorrelationId()

    threadViewVersionRef.current += 1
    setRouting(programmingRouting)
    setPendingThreadOrigin(threadOriginPayload)
    setCurrentThreadId(null)
    setCurrentThread(null)
    setSessionState(null)
    setTraces([])
    setQualityActions([])
    setContextSnapshots([])
    setPending(null)
    setDraft('')
    setDraftAttachments([])
    setDraftFileAttachments([])
    setAttachmentSheetOpen(false)
    setPreviewAttachment(null)
    setError(null)
    setThreadHistoryOpen(false)
    showToast('Programação iniciada com contexto operacional')
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    void recordAtlasAiEvent({
      eventName: 'promoted_to_programming',
      correlation_id: promotionCorrelationId,
      thread_id: currentThread.id,
      metadata: {
        source_thread_id: currentThread.id,
        source_inbox_item_id: inboxItemIdFromThread(currentThread),
        target_mode: programmingRouting.mode,
        target_task: programmingRouting.task,
        target_executor: programmingRouting.executor,
      },
    })
    void recordAtlasAiEvent({
      eventName: 'programming_auto_started',
      correlation_id: promotionCorrelationId,
      thread_id: null,
      metadata: {
        source_thread_id: currentThread.id,
        source_inbox_item_id: inboxItemIdFromThread(currentThread),
        prompt_chars: developmentPrompt.length,
      },
    })
    void submitText(developmentPrompt, {
      correlationId: promotionCorrelationId,
      threadId: null,
      routingSnapshot: programmingRouting,
      pinnedTraceIdsSnapshot: [],
      threadOriginPayload,
    })
  }, [contextualIntro, currentThread, interactionLocked, showToast, submitText, traces])

  const selectThread = useCallback(
    async (thread: AtlasAiThread) => {
      const switchingThreads = thread.id !== currentThreadId
      if (switchingThreads) {
        const trace = activeTraceRef.current
        if (trace) {
          void recordAtlasAiEvent({
            eventName: 'thread_switched_while_trace_active',
            trace_id: trace.id,
            thread_id: trace.thread_id ?? currentThreadId,
            provider: trace.provider,
            agent_slug: trace.agent_slug,
            metadata: {
              from_thread_id: currentThreadId,
              to_thread_id: thread.id,
              status: trace.status,
            },
          })
        }
        threadViewVersionRef.current += 1
      }
      setThreadHistoryOpen(false)
      setDraftAttachments([])
      setDraftFileAttachments([])
      setAttachmentSheetOpen(false)
      setPreviewAttachment(null)
      setCurrentThreadId(thread.id)
      setCurrentThread(thread)
      setSessionState(thread.active_state ?? null)
      if (switchingThreads) {
        setPending(null)
        setError(null)
      }
      await loadThreadData(thread.id, { silent: false })
    },
    [currentThreadId, loadThreadData],
  )

  const compactCurrentThread = useCallback(async () => {
    if (!currentThreadId) {
      showToast('Abra uma conversa antes de compactar')
      return
    }
    if (interactionLocked) {
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
    interactionLocked,
    routing,
    sessionState,
    showToast,
  ])

  const syncThreadRoutingMetadata = useCallback(
    (next: RoutingState) => {
      if (!currentThreadId || !currentThread) return

      const metadataPatch = threadRoutingMetadataPatch(currentThread, next)
      setCurrentThread((thread) =>
        thread && thread.id === currentThreadId
          ? { ...thread, metadata: { ...(thread.metadata ?? {}), ...metadataPatch } }
          : thread,
      )
      setThreadList((threads) =>
        threads.map((thread) =>
          thread.id === currentThreadId
            ? { ...thread, metadata: { ...(thread.metadata ?? {}), ...metadataPatch } }
            : thread,
        ),
      )

      void updateAiThread(currentThreadId, { metadata: metadataPatch })
        .then((response) => {
          setCurrentThread((thread) =>
            thread && thread.id === response.thread.id
              ? { ...thread, ...response.thread }
              : thread,
          )
          setThreadList((threads) =>
            threads.map((thread) => thread.id === response.thread.id ? { ...thread, ...response.thread } : thread),
          )
        })
        .catch((routingError) => {
          showToast(humanAiError(routingError, 'Falha ao registrar modo da conversa.'))
        })
    },
    [currentThread, currentThreadId, showToast],
  )

  const switchProvider = useCallback(
    async (executor: Extract<RoutingExecutor, 'claude_cli' | 'codex_cli' | 'gemini_cli' | 'claude_codex'>) => {
      const nextRouting = sanitizeRoutingState({ ...routing, executor })
      setRouting(nextRouting)
      if (interactionLocked) {
        syncThreadRoutingMetadata(nextRouting)
        showToast(`Próxima resposta: ${providerWord(executor) ?? executor}`)
        return
      }

      const previousRouting = routing
      if (!currentThreadId) return

      const currentProvider = currentThread?.last_provider ?? providerFromRouting(routing)
      if (currentProvider === executor) {
        showToast(`Próxima resposta: ${providerWord(executor) ?? executor}`)
        return
      }

      setOperationBusy(`provider:${executor}`)
      try {
        const response = await switchAiThreadProvider(currentThreadId, {
          to_provider: executor,
          from_provider: currentProvider ?? null,
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
        syncThreadRoutingMetadata(nextRouting)
        showToast(`Próxima resposta: ${providerWord(executor) ?? executor}`)
      } catch (providerError) {
        setRouting(previousRouting)
        showToast(humanAiError(providerError, 'Falha ao trocar provider.'))
      } finally {
        setOperationBusy(null)
      }
    },
    [currentThread?.last_provider, currentThreadId, interactionLocked, routing, showToast, syncThreadRoutingMetadata],
  )

  const confirmRouting = useCallback(
    (next: RoutingState) => {
      const previousProvider = providerFromRouting(routing)
      const nextProvider = providerFromRouting(next)
      const currentProvider = currentThread?.last_provider ?? previousProvider
      setRouting(next)
      syncThreadRoutingMetadata(next)

      if (interactionLocked) {
        showToast('Rota atualizada para a próxima mensagem')
        return
      }

      if (
        currentThreadId
        && nextProvider
        && nextProvider !== currentProvider
      ) {
        void switchAiThreadProvider(currentThreadId, {
          to_provider: nextProvider,
          from_provider: currentProvider ?? null,
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
          .catch((providerError) => {
            showToast(humanAiError(providerError, 'Falha ao registrar troca de provider.'))
          })
      }
    },
    [currentThread?.last_provider, currentThreadId, interactionLocked, routing, showToast, syncThreadRoutingMetadata],
  )

  const submitFeedback = useCallback(
    async (trace: AtlasAiTrace, action: FeedbackAction) => {
      setOperationBusy(`feedback:${trace.id}`)
      try {
        const feedback = feedbackPayload(action)
        void recordAtlasAiEvent({
          eventName: 'feedback_submitted',
          trace_id: trace.id,
          thread_id: trace.thread_id,
          provider: trace.provider,
          model: trace.model,
          agent_slug: trace.agent_slug,
          numeric_value: feedback.feedback_score,
          unit: 'score_1_5',
          metadata: {
            feedback_action: feedback.feedback_action,
          },
        })
        const response = await feedbackAiInteraction(trace.id, feedback)
        setTraces((current) => mergeAtlasTrace(response.trace, current))
        showToast(feedbackToast(action))
      } catch (feedbackError) {
        void recordAtlasAiEvent({
          eventName: 'feedback_submit_failed',
          trace_id: trace.id,
          thread_id: trace.thread_id,
          provider: trace.provider,
          model: trace.model,
          agent_slug: trace.agent_slug,
          metadata: {
            feedback_action: action,
            error_type: feedbackError instanceof Error ? feedbackError.name : typeof feedbackError,
            status: feedbackError instanceof AtlasApiError ? feedbackError.status : null,
          },
        })
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
      if (thread.id === currentThreadId && interactionLocked) {
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
    [currentThreadId, interactionLocked, showToast, startNewThread],
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
  // Stable keys prefer clientId for both optimistic and real traces, so React
  // keeps QuoteCompact mounted when the backend trace replaces the pending turn.
  const turns = useMemo<DisplayTurn[]>(() => {
    const seen = new Set<string>()
    const list: DisplayTurn[] = []

    for (const trace of visibleTraces) {
      const key = traceDisplayKey(trace)
      if (seen.has(key)) continue
      seen.add(key)
      list.push({
        key,
        text: trace.operator_input,
        historicalAttachments: attachmentsFromTrace(trace),
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
        attachments: pending.attachments,
        fileAttachments: pending.fileAttachments,
        attachmentPhase: pending.attachmentPhase,
        attachmentProgress: pending.attachmentProgress,
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
              hitSlop={10}
              style={({ pressed }) => [
                styles.headerAction,
                { opacity: pressed ? 0.55 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="histórico de conversas"
            >
              <Sans size={24} lineHeight={28} color={c.ink2}>
                ≡
              </Sans>
            </Pressable>
            <Pressable
              onPress={startNewThread}
              hitSlop={10}
              style={({ pressed }) => [
                styles.headerAction,
                { opacity: pressed ? 0.55 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="nova conversa"
            >
              <Sans size={28} lineHeight={30} color={c.ink2}>
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

        {/*
          ContinuityPanel fica FORA do FlatList (não no ListHeaderComponent)
          pra preservar o comportamento "sticky" do ScrollView original — o
          painel sempre visível no topo, conversa rolando embaixo. Em FlatList,
          stickyHeaderIndices se referiria ao primeiro item da lista, não ao
          ListHeader, o que produziria sticky no turn errado.
        */}
        <View style={styles.threadHeader}>
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
            disabled={interactionLocked}
            onCompact={compactCurrentThread}
            onOpenThreads={() => setThreadHistoryOpen(true)}
            onOpenContext={() => setContextOpen(true)}
            onOpenOperations={() => setOperationsOpen(true)}
            onOpenExecution={openExecution}
            onOpenSkills={() => setSkillsOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            onOpenMap={() => setSessionMapOpen(true)}
            onSetTurnFilter={setTurnFilter}
            onCopyConversation={() => void copyToClipboard(formatConversationForCopy(traces), () => flashCopyToast('conversa'))}
            expanded={continuityExpanded}
            onToggleExpanded={() => setContinuityExpanded((value) => !value)}
            hasTurns={traces.length > 0}
          />
          {error && (
            <View style={styles.errorRow}>
              <Frau italic size={14} lineHeight={20} color={c.recRed}>
                {error}
              </Frau>
            </View>
          )}
        </View>

        <LayoutAnimationConfig skipEntering={!animationsReady}>
          <FlatList<DisplayTurn>
            ref={scrollRef}
            data={turns}
            keyExtractor={(turn) => turn.key}
            style={styles.thread}
            contentContainerStyle={styles.threadListContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            initialNumToRender={8}
            maxToRenderPerBatch={6}
            windowSize={7}
            ListEmptyComponent={
              !error
                ? (turnFilter === 'all'
                    ? <EmptyPage />
                    : <FilteredEmpty filter={turnFilter} onReset={() => setTurnFilter('all')} />)
                : null
            }
            ListHeaderComponent={
              modeNotice || operationalBootstrap || contextualIntro
                ? (
                    <>
                      {modeNotice ? <AtlasAiModeNotice notice={modeNotice} /> : null}
                      {operationalBootstrap ? (
                        <OperationalBootstrapPanel
                          status={operationalBootstrap}
                          retrying={bootstrapRetrying}
                          onRefresh={() => void refresh({ silent: false })}
                          onRetry={() => void retryOperationalBootstrap()}
                        />
                      ) : null}
                      {contextualIntro ? <AtlasAiContextIntro intro={contextualIntro} onPromoteToDevelopment={promoteContextToDevelopment} /> : null}
                    </>
                  )
                : null
            }
            renderItem={({ item: turn, index }) => (
              <View
                style={[
                  styles.turn,
                  index < turns.length - 1 && styles.turnSeparator,
                ]}
              >
                <Pressable
                  onLongPress={() => void copyToClipboard(turn.text, () => flashCopyToast('mensagem'))}
                  delayLongPress={380}
                  style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
                  accessibilityRole="button"
                  accessibilityLabel="copiar sua mensagem"
                  accessibilityHint="pressionar e segurar copia o texto da pergunta"
                >
                  <QuoteCompact text={turn.text} />
                </Pressable>
                <TurnAttachmentSummary
                  images={turn.attachments ?? []}
                  files={turn.fileAttachments ?? []}
                  phase={turn.attachmentPhase}
                  progress={turn.attachmentProgress}
                  onOpenImage={setPreviewAttachment}
                />
                <HistoricalAttachmentSummary
                  attachments={turn.historicalAttachments ?? []}
                  onOpenAttachment={setPreviewHistoricalAttachment}
                />
                <View style={styles.afterQuote}>
                  <TurnBodyView
                    body={turn.body}
                    onCopyResponse={(text) => void copyToClipboard(text, () => flashCopyToast('resposta'))}
                  />
                </View>
              </View>
            )}
          />
        </LayoutAnimationConfig>

        <View
          style={[
            styles.footer,
            {
              backgroundColor: c.bg,
              paddingBottom: footerPaddingBottom,
            },
          ]}
        >
          {copyToast && (
            <Animated.View
              key={copyToast}
              pointerEvents="none"
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(260)}
              style={styles.copyToast}
            >
              <Frau italic size={14} lineHeight={20} color={c.ink} style={{ opacity: 0.7 }}>
                — copiado {copyToast}
              </Frau>
            </Animated.View>
          )}
          <StatusRouting state={routing} onPress={openRouting} locked={interactionLocked} />
          <AttachmentPreviewStrip
            attachments={draftAttachments}
            onOpen={setPreviewAttachment}
            onRemove={removeDraftAttachment}
          />
          <FileAttachmentPreviewStrip
            attachments={draftFileAttachments}
            onRemove={removeDraftFileAttachment}
          />
          <FieldInline
            value={draft}
            onChangeText={setDraft}
            onSubmit={submit}
            disabled={interactionLocked}
            placeholder={turns.length === 0 ? 'diga ao Atlas…' : 'continuar com Atlas…'}
            onAttachmentPress={() => setAttachmentSheetOpen(true)}
            attachmentCount={draftAttachments.length + draftFileAttachments.length}
            canSubmit={draftAttachments.length + draftFileAttachments.length > 0}
          />
        </View>
      </View>

      <AttachmentSheet
        visible={attachmentSheetOpen}
        busy={attachmentBusy}
        onClose={() => setAttachmentSheetOpen(false)}
        onPasteImage={pasteClipboardImage}
        onCamera={pickCameraImage}
        onPhotos={pickPhotoImages}
        onFiles={pickDocumentFiles}
      />

      <AttachmentImageViewer
        visible={previewAttachment != null}
        imageUri={previewAttachment?.uri ?? ''}
        title={previewAttachment?.fileName ?? 'imagem anexada'}
        onClose={() => setPreviewAttachment(null)}
        onRemove={previewAttachment ? () => removeDraftAttachment(previewAttachment.id) : undefined}
      />

      <PdfAttachmentViewer
        attachment={previewHistoricalAttachment}
        onClose={() => setPreviewHistoricalAttachment(null)}
      />

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

function AttachmentPreviewStrip({
  attachments,
  onOpen,
  onRemove,
  readonly = false,
}: {
  attachments: ComposerImageAttachment[]
  onOpen?: (attachment: ComposerImageAttachment) => void
  onRemove?: (id: string) => void
  readonly?: boolean
}) {
  const { c } = useTheme()
  if (attachments.length === 0) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.attachmentStrip}
      keyboardShouldPersistTaps="handled"
    >
      {attachments.map((attachment) => (
        <Pressable
          key={attachment.id}
          onPress={() => onOpen?.(attachment)}
          disabled={!onOpen}
          accessibilityRole="imagebutton"
          accessibilityLabel="abrir imagem anexada"
          style={({ pressed }) => [
            styles.attachmentThumb,
            {
              borderColor: c.border,
              opacity: pressed ? 0.72 : readonly ? 0.86 : 1,
            },
          ]}
        >
          <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} />
          {!readonly && onRemove ? (
            <Pressable
              onPress={() => onRemove(attachment.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="remover anexo"
              style={({ pressed }) => [
                styles.attachmentRemove,
                {
                  backgroundColor: c.bg,
                  borderColor: c.border,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Sans size={13} lineHeight={14} color={c.ink}>×</Sans>
            </Pressable>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  )
}

function FileAttachmentPreviewStrip({
  attachments,
  onRemove,
  readonly = false,
}: {
  attachments: ComposerFileAttachment[]
  onRemove?: (id: string) => void
  readonly?: boolean
}) {
  const { c } = useTheme()
  if (attachments.length === 0) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.fileAttachmentStrip}
      keyboardShouldPersistTaps="handled"
    >
      {attachments.map((attachment) => (
        <View
          key={attachment.id}
          style={[
            styles.fileAttachmentChip,
            {
              borderColor: c.border,
              backgroundColor: c.surface,
              opacity: readonly ? 0.9 : 1,
            },
          ]}
        >
          <View style={[styles.fileAttachmentIcon, { borderColor: c.border }]}>
            <Sans size={11} lineHeight={13} weight="med" color={c.ink2}>
              {fileExtensionLabel(attachment.fileName)}
            </Sans>
          </View>
          <View style={styles.fileAttachmentText}>
            <Sans size={13} lineHeight={17} weight="med" color={c.ink} numberOfLines={1}>
              {attachment.fileName}
            </Sans>
            <Mono size={10} letterSpacing={0} color={c.ink2} numberOfLines={1}>
              {formatBytes(attachment.size ?? null)}
            </Mono>
          </View>
          {!readonly && onRemove ? (
            <Pressable
              onPress={() => onRemove(attachment.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="remover arquivo"
              style={({ pressed }) => [
                styles.fileAttachmentRemove,
                {
                  borderColor: c.border,
                  opacity: pressed ? 0.55 : 1,
                },
              ]}
            >
              <Sans size={12} lineHeight={14} color={c.ink}>×</Sans>
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollView>
  )
}

function TurnAttachmentSummary({
  images,
  files,
  phase,
  progress,
  onOpenImage,
}: {
  images: ComposerImageAttachment[]
  files: ComposerFileAttachment[]
  phase?: AttachmentUploadPhase
  progress?: number
  onOpenImage?: (attachment: ComposerImageAttachment) => void
}) {
  const { c } = useTheme()
  if (images.length + files.length === 0) return null

  return (
    <View style={styles.turnAttachmentSummary}>
      {phase ? (
        <View style={styles.attachmentStatusLine}>
          <View
            style={[
              styles.attachmentStatusDot,
              { backgroundColor: phase === 'failed' ? c.recRed : c.bronze },
            ]}
          />
          <Mono size={10} letterSpacing={0} color={phase === 'failed' ? c.recRed : c.ink2}>
            {attachmentPhaseLabel(phase, images.length + files.length, progress)}
          </Mono>
        </View>
      ) : null}
      {typeof progress === 'number' && phase === 'uploading' ? (
        <View style={[styles.attachmentProgressTrack, { backgroundColor: c.border }]}>
          <View
            style={[
              styles.attachmentProgressFill,
              {
                backgroundColor: c.bronze,
                width: `${Math.max(0.04, Math.min(1, progress)) * 100}%`,
              },
            ]}
          />
        </View>
      ) : null}
      <AttachmentPreviewStrip
        attachments={images}
        onOpen={onOpenImage}
        readonly
      />
      <FileAttachmentPreviewStrip
        attachments={files}
        readonly
      />
    </View>
  )
}

function attachmentPhaseLabel(phase: AttachmentUploadPhase, count: number, progress?: number): string {
  const noun = count === 1 ? 'anexo' : 'anexos'
  const percent = typeof progress === 'number' ? ` ${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` : ''
  return {
    preparing: `preparando ${noun}`,
    uploading: `enviando ${noun}${percent}...`,
    accepted: count === 1 ? 'anexo recebido' : 'anexos recebidos',
    failed: count === 1 ? 'falha no envio do anexo' : 'falha no envio dos anexos',
  }[phase]
}

function HistoricalAttachmentSummary({
  attachments,
  onOpenAttachment,
}: {
  attachments: AtlasAiAttachment[]
  onOpenAttachment?: (attachment: AtlasAiAttachment) => void
}) {
  const { c } = useTheme()
  if (attachments.length === 0) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.fileAttachmentStrip}
      keyboardShouldPersistTaps="handled"
      style={styles.turnAttachmentSummary}
    >
      {attachments.map((attachment) => (
        <Pressable
          key={attachment.id}
          onPress={() => {
            if (canPreviewHistoricalAttachment(attachment)) {
              onOpenAttachment?.(attachment)
            }
          }}
          disabled={!canPreviewHistoricalAttachment(attachment)}
          accessibilityRole="button"
          accessibilityLabel={`abrir preview de ${attachment.name}`}
          style={({ pressed }) => [
            styles.fileAttachmentChip,
            {
              borderColor: c.border,
              backgroundColor: c.surface,
              opacity: pressed ? 0.72 : 0.92,
            },
          ]}
        >
          <View style={[styles.fileAttachmentIcon, { borderColor: c.border }]}>
            <Sans size={11} lineHeight={13} weight="med" color={c.ink2}>
              {historicalAttachmentBadge(attachment)}
            </Sans>
          </View>
          <View style={styles.fileAttachmentText}>
            <Sans size={13} lineHeight={17} weight="med" color={c.ink} numberOfLines={1}>
              {attachment.name || (attachment.kind === 'image' ? 'imagem' : 'arquivo')}
            </Sans>
            <Mono size={10} letterSpacing={0} color={c.ink2} numberOfLines={1}>
              {historicalAttachmentMeta(attachment)}
            </Mono>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  )
}

function canPreviewHistoricalAttachment(attachment: AtlasAiAttachment): boolean {
  return Array.isArray(attachment.preview_pages) && attachment.preview_pages.length > 0
}

function PdfAttachmentViewer({
  attachment,
  onClose,
}: {
  attachment: AtlasAiAttachment | null
  onClose: () => void
}) {
  const { c } = useTheme()
  const pages = attachment?.preview_pages ?? []

  return (
    <Modal
      visible={attachment != null}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.pdfPreviewSafe, { backgroundColor: c.bg }]}>
        <View style={[styles.pdfPreviewHeader, { borderBottomColor: c.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar preview do PDF"
            hitSlop={12}
            onPress={onClose}
            style={({ pressed }) => [
              styles.pdfPreviewClose,
              { borderColor: c.border, backgroundColor: pressed ? c.premium : c.surface },
            ]}
          >
            <Sans size={24} lineHeight={28} color={c.ink}>×</Sans>
          </Pressable>
          <View style={styles.pdfPreviewTitle}>
            <Sans size={14} lineHeight={18} weight="med" color={c.ink} numberOfLines={1}>
              {attachment?.name ?? 'PDF'}
            </Sans>
            <Mono size={10} lineHeight={14} letterSpacing={0} color={c.ink2} numberOfLines={1}>
              {attachment ? historicalAttachmentMeta(attachment) : ''}
            </Mono>
          </View>
          <View style={styles.pdfPreviewHeaderSide} />
        </View>

        {pages.length > 0 ? (
          <FlatList
            data={pages}
            keyExtractor={(page) => String(page.page)}
            contentContainerStyle={styles.pdfPreviewList}
            renderItem={({ item }) => (
              <View style={[styles.pdfPageFrame, { borderColor: c.border, backgroundColor: c.surface }]}>
                <Mono size={10} lineHeight={14} letterSpacing={0} color={c.ink2}>
                  página {item.page}
                </Mono>
                <Image
                  source={{ uri: apiMediaUrl(item.url), headers: getAtlasAuthHeaders() }}
                  resizeMode="contain"
                  style={styles.pdfPageImage}
                  accessibilityIgnoresInvertColors
                />
              </View>
            )}
          />
        ) : (
          <View style={styles.pdfPreviewEmpty}>
            <Frau italic size={16} lineHeight={23} align="center" color={c.ink2}>
              preview visual indisponível para este arquivo
            </Frau>
          </View>
        )}
      </View>
    </Modal>
  )
}

function apiMediaUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${getApiBase()}${url.startsWith('/') ? url : `/${url}`}`
}

function historicalAttachmentBadge(attachment: AtlasAiAttachment): string {
  if (attachment.kind === 'image') return 'IMG'
  return fileExtensionLabel(attachment.name)
}

function historicalAttachmentMeta(attachment: AtlasAiAttachment): string {
  const parts = [formatBytes(attachment.bytes ?? null)]
  if (attachment.kind === 'file') {
    if (typeof attachment.pdf_page_count === 'number' && attachment.pdf_page_count > 0) {
      parts.push(attachment.pdf_page_count === 1 ? '1 pág.' : `${attachment.pdf_page_count} págs.`)
    }
    if (typeof attachment.pdf_chunk_count === 'number' && attachment.pdf_chunk_count > 0) {
      parts.push(attachment.pdf_chunk_count === 1 ? '1 trecho' : `${attachment.pdf_chunk_count} trechos`)
    }
    parts.push(attachment.text_available ? 'texto lido' : 'sem texto extraído')
    if (attachment.pdf_render_status === 'rendered' || attachment.pdf_render_status === 'partial') {
      parts.push('visual pronto')
    }
    if (attachment.pdf_ocr_status === 'processed') {
      parts.push('OCR')
    }
    if (typeof attachment.office_rendered_page_count === 'number' && attachment.office_rendered_page_count > 0) {
      parts.push(attachment.office_rendered_page_count === 1 ? '1 visual' : `${attachment.office_rendered_page_count} visuais`)
    }
    if (attachment.office_render_status === 'rendered' || attachment.office_render_status === 'partial') {
      parts.push('Office visual')
    }
  }

  return parts.join(' · ')
}

function AttachmentSheet({
  visible,
  busy,
  onClose,
  onPasteImage,
  onCamera,
  onPhotos,
  onFiles,
}: {
  visible: boolean
  busy: string | null
  onClose: () => void
  onPasteImage: () => void
  onCamera: () => void
  onPhotos: () => void
  onFiles: () => void
}) {
  const { c } = useTheme()
  return (
    <BottomSheet visible={visible} onClose={onClose} height={350}>
      <View style={styles.attachmentSheetContent}>
        <Frau italic size={20} lineHeight={28} color={c.ink}>
          anexar
        </Frau>
        <View style={styles.attachmentActions}>
          <AttachmentAction label={busy === 'clipboard' ? 'colando…' : 'colar imagem'} disabled={busy !== null} onPress={onPasteImage} />
          <AttachmentAction label={busy === 'camera' ? 'abrindo…' : 'câmera'} disabled={busy !== null} onPress={onCamera} />
          <AttachmentAction label={busy === 'photos' ? 'abrindo…' : 'fotos'} disabled={busy !== null} onPress={onPhotos} />
          <AttachmentAction label={busy === 'files' ? 'abrindo…' : 'arquivos'} disabled={busy !== null} onPress={onFiles} />
        </View>
      </View>
    </BottomSheet>
  )
}

function AttachmentAction({
  label,
  disabled,
  onPress,
}: {
  label: string
  disabled: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.attachmentAction,
        {
          borderTopColor: c.border,
          opacity: disabled ? 0.45 : pressed ? 0.55 : 1,
        },
      ]}
    >
      <Sans size={17} lineHeight={24} color={c.ink}>
        {label}
      </Sans>
    </Pressable>
  )
}

function TurnBodyView({ body, onCopyResponse }: { body: TurnBody; onCopyResponse: (text: string) => void }) {
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
      <Pressable
        onLongPress={() => onCopyResponse(body.text)}
        delayLongPress={380}
        style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
        accessibilityRole="button"
        accessibilityLabel="copiar resposta do atlas"
        accessibilityHint="pressionar e segurar copia o texto da resposta"
      >
        <PageResponse text={body.text} />
      </Pressable>
      <CaptionWhisper text={body.attribution} />
      <OpenBrainTraceBadge trace={body.trace} />
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
  onCopyConversation,
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
  onCopyConversation: () => void
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
    <Animated.View
      layout={LinearTransition.springify().damping(22).stiffness(170).mass(0.9)}
      style={[styles.continuityPanel, expanded ? styles.continuityPanelOpen : null, { borderBottomColor: c.border, backgroundColor: c.bg }]}
    >
      <View style={[styles.continuityTop, thread?.title ? null : styles.continuityTopEmpty]}>
        {thread?.title ? (
          <Pressable
            onPress={onOpenThreads}
            hitSlop={8}
            style={({ pressed }) => [styles.continuityTitle, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity: 0.55 }}>
              continuidade
            </Frau>
            <Sans weight="med" size={14} lineHeight={19} color={c.ink} numberOfLines={1}>
              {thread.title}
            </Sans>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onToggleExpanded}
          hitSlop={10}
          style={({ pressed }) => [styles.continuityToggle, { opacity: pressed ? 0.55 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'recolher diagnóstico' : 'expandir diagnóstico'}
        >
          <Frau italic size={14} lineHeight={20} color={c.ink} style={{ opacity: 0.55 }}>
            · {expanded ? 'recolher' : 'expandir'}
          </Frau>
        </Pressable>
      </View>

      {expanded ? (
        <Animated.View
          entering={FadeInDown.duration(360).springify().damping(22).stiffness(160).mass(0.85)}
          exiting={FadeOutUp.duration(220).easing(Easing.out(Easing.cubic))}
        >
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
            {hasTurns && (
              <MicroAction label="copiar" onPress={onCopyConversation} />
            )}
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
        </Animated.View>
      ) : null}
    </Animated.View>
  )
}

interface AtlasAiContextIntroData {
  title: string
  summary: string | null
  body: string | null
  focus: string
  permission: string
  execution: string
}

interface AtlasAiModeNoticeData {
  title: string
  summary: string
  tone: RoutingMode
}

function AtlasAiModeNotice({ notice }: { notice: AtlasAiModeNoticeData }) {
  const { c } = useTheme()

  return (
    <View style={[styles.modeNotice, { borderColor: modeColor(notice.tone, c), backgroundColor: c.surface }]}>
      <View style={[styles.modeNoticeDot, { backgroundColor: modeColor(notice.tone, c) }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Mono size={9.5} lineHeight={13} color={c.ink2} letterSpacing={0.35}>
          MODO DA CONVERSA
        </Mono>
        <Sans weight="sb" size={14} lineHeight={19} color={c.ink} numberOfLines={2} style={{ marginTop: 3 }}>
          {notice.title}
        </Sans>
        <Frau italic size={12} lineHeight={17} color={c.ink2} numberOfLines={2} style={{ marginTop: 2 }}>
          {notice.summary}
        </Frau>
      </View>
    </View>
  )
}

function OperationalBootstrapPanel({
  status,
  retrying,
  onRefresh,
  onRetry,
}: {
  status: OperationalBootstrapData
  retrying: boolean
  onRefresh: () => void
  onRetry: () => void
}) {
  const { c } = useTheme()
  const active = status.status === 'queued' || status.status === 'processing' || status.status === 'retrying'
  const failed = status.status === 'failed' || status.status === 'cancelled' || status.status === 'skipped'
  const primaryAction = failed ? onRetry : onRefresh
  const primaryLabel = failed
    ? (retrying ? 'Tentando...' : 'Tentar novamente')
    : 'Atualizar'

  return (
    <View style={[
      styles.bootstrapPanel,
      {
        borderColor: failed ? c.recRed : active ? c.bronze : c.border,
        backgroundColor: c.surface,
      },
    ]}>
      <View style={styles.bootstrapHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Mono size={9.5} lineHeight={13} color={failed ? c.recRed : c.bronze} letterSpacing={0.35}>
            BOOTSTRAP OPERACIONAL
          </Mono>
          <Sans weight="sb" size={15} lineHeight={20} color={c.ink} numberOfLines={2} style={{ marginTop: 4 }}>
            {status.title}
          </Sans>
        </View>
        <View style={[
          styles.bootstrapStatusPill,
          { borderColor: failed ? c.recRed : active ? c.bronze : c.border },
        ]}>
          <Mono size={9.5} lineHeight={12} color={failed ? c.recRed : c.prussian} letterSpacing={0.25}>
            {bootstrapStatusLabel(status.status)}
          </Mono>
        </View>
      </View>

      <Sans size={12.5} lineHeight={18} color={c.ink2}>
        {status.summary}
      </Sans>

      <View style={styles.bootstrapSteps}>
        {status.steps.map((step) => (
          <View key={step.key} style={styles.bootstrapStep}>
            <View style={[
              styles.bootstrapStepDot,
              { backgroundColor: bootstrapStepColor(step.state, c) },
            ]} />
            <Sans weight={step.state === 'active' ? 'sb' : 'med'} size={11.5} lineHeight={15} color={step.state === 'pending' ? c.ink3 : c.ink2} numberOfLines={1}>
              {step.label}
            </Sans>
          </View>
        ))}
      </View>

      {status.responsePreview ? (
        <View style={[styles.bootstrapPreview, { borderColor: c.border }]}>
          <Sans size={12} lineHeight={17} color={c.ink2} numberOfLines={4}>
            {status.responsePreview}
          </Sans>
        </View>
      ) : null}

      {(active || failed) ? (
        <Pressable
          onPress={primaryAction}
          disabled={retrying}
          style={({ pressed }) => [
            styles.bootstrapRefresh,
            { borderColor: c.border, opacity: pressed || retrying ? 0.68 : 1 },
          ]}
        >
          <Sans weight="sb" size={12.5} lineHeight={17} color={c.prussian}>
            {primaryLabel}
          </Sans>
        </Pressable>
      ) : null}
    </View>
  )
}

function AtlasAiContextIntro({
  intro,
  onPromoteToDevelopment,
}: {
  intro: AtlasAiContextIntroData
  onPromoteToDevelopment: () => void
}) {
  const { c } = useTheme()

  return (
    <View style={[styles.contextIntro, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.contextIntroHead}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity: 0.56 }}>
            contexto carregado
          </Frau>
          <Sans weight="med" size={15} lineHeight={20} color={c.ink} numberOfLines={2} style={{ marginTop: 4 }}>
            {intro.title}
          </Sans>
        </View>
        <View style={[styles.contextIntroBadge, { borderColor: c.border }]}>
          <Mono size={10.5} lineHeight={14} color={c.prussian} letterSpacing={0.2}>
            auditável
          </Mono>
        </View>
      </View>

      {intro.summary ? (
        <Sans size={12.5} lineHeight={18} color={c.ink2}>
          {intro.summary}
        </Sans>
      ) : null}

      {intro.body ? (
        <Sans size={12.5} lineHeight={18} color={c.ink2} numberOfLines={5}>
          {intro.body}
        </Sans>
      ) : null}

      <View style={styles.contextIntroGrid}>
        <ContextIntroMetric label="Foco" value={intro.focus} />
        <ContextIntroMetric label="Permissão" value={intro.permission} />
        <ContextIntroMetric label="Execução" value={intro.execution} />
      </View>

      <Pressable
        onPress={onPromoteToDevelopment}
        style={({ pressed }) => [
          styles.contextIntroAction,
          { borderColor: c.prussian, opacity: pressed ? 0.68 : 1 },
        ]}
      >
        <Sans weight="sb" size={12.5} lineHeight={17} color={c.prussian} align="center">
          Desenvolver com este contexto
        </Sans>
      </Pressable>
    </View>
  )
}

function ContextIntroMetric({ label, value }: { label: string; value: string }) {
  const { c } = useTheme()

  return (
    <View style={styles.contextIntroMetric}>
      <Mono size={9.5} lineHeight={12} color={c.ink2} letterSpacing={0.35}>
        {label.toUpperCase()}
      </Mono>
      <Sans weight="med" size={12} lineHeight={16} color={c.ink}>
        {value}
      </Sans>
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

function OpenBrainTraceBadge({ trace }: { trace: AtlasAiTrace }) {
  const { c } = useTheme()
  const openBrain = openBrainInjectionFromTrace(trace)

  if (!openBrain || openBrain.status === 'skipped') return null

  const color = openBrainStatusColor(openBrain.status, c)
  const parts = [
    openBrain.refs != null ? `${openBrain.refs} refs` : null,
    openBrain.hash ? `hash ${shortId(openBrain.hash)}` : null,
    openBrain.warnings.length > 0 ? `${openBrain.warnings.length} aviso${openBrain.warnings.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean)

  return (
    <View style={[styles.openBrainBadge, { borderTopColor: c.border }]}>
      <View style={[styles.openBrainDot, { backgroundColor: color }]} />
      <Sans weight="med" size={11} lineHeight={16} color={color}>
        Open Brain {openBrainStatusLabel(openBrain.status)}
      </Sans>
      {parts.length > 0 && (
        <Sans size={11} lineHeight={16} color={c.ink2} style={styles.openBrainText}>
          {parts.join(' · ')}
        </Sans>
      )}
    </View>
  )
}

type ThreadHistoryModeFilter = 'all' | RoutingMode

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
  const [modeFilter, setModeFilter] = useState<ThreadHistoryModeFilter>('all')
  const queryFiltered = filterThreads(threads, query)
  const modeOptions = threadHistoryModeOptions(queryFiltered)
  const filtered = modeFilter === 'all'
    ? queryFiltered
    : queryFiltered.filter((thread) => atlasAiModeFromThread(thread) === modeFilter)

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView contentContainerStyle={styles.threadPickerContent} showsVerticalScrollIndicator={false}>
        <Frau size={24} lineHeight={30} color={c.ink} align="center">
          Histórico Atlas
        </Frau>
        <View style={[styles.headingRule, { backgroundColor: c.border }]} />

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="buscar sessão…"
          placeholderTextColor={c.ink3}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          textContentType="none"
          style={[styles.searchInput, { color: c.ink, borderBottomColor: c.border }]}
        />

        <View style={styles.threadModeGrid}>
          {modeOptions.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => setModeFilter(option.key)}
              style={({ pressed }) => [
                styles.threadModeCard,
                {
                  borderColor: modeFilter === option.key ? modeFilterColor(option.key, c) : c.border,
                  backgroundColor: modeFilter === option.key ? c.surface : 'transparent',
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <View style={styles.threadModeCardTop}>
                <View style={[
                  styles.threadFocusDot,
                  { backgroundColor: modeFilterColor(option.key, c) },
                ]} />
                <Mono
                  size={10}
                  lineHeight={13}
                  color={modeFilter === option.key ? c.prussian : c.ink2}
                  letterSpacing={0.25}
                >
                  {option.count}
                </Mono>
              </View>
              <Sans
                weight="sb"
                size={14}
                lineHeight={18}
                color={c.ink}
              >
                {option.label}
              </Sans>
              <Frau italic size={11.5} lineHeight={16} color={c.ink2} numberOfLines={1}>
                {option.caption}
              </Frau>
            </Pressable>
          ))}
        </View>

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
                  geral · sem contexto herdado
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
                <View style={styles.threadRowHeader}>
                  <View style={[styles.threadFocusDot, { backgroundColor: modeColor(atlasAiModeFromThread(thread), c) }]} />
                  <Mono size={9.5} lineHeight={13} color={c.ink2} letterSpacing={0.25}>
                    {atlasAiModeLabel(atlasAiModeFromThread(thread)).toUpperCase()}
                  </Mono>
                  <Mono size={9.5} lineHeight={13} color={c.ink3} letterSpacing={0.25} numberOfLines={1}>
                    ORIGEM {threadOriginLabel(thread).toUpperCase()}
                  </Mono>
                </View>
                <Sans weight="med" size={15} lineHeight={20} color={c.ink} numberOfLines={1}>
                  {thread.title || 'Conversa Atlas'}
                </Sans>
                <Frau italic size={12} lineHeight={17} color={c.ink2} numberOfLines={2}>
                  {threadHistorySubtitle(thread)}
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
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          textContentType="none"
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
  const metrics = observability?.metrics
  const metricsHealth = observability?.metrics_health
  const metricTotals = metrics?.available ? metrics.totals : null
  const surfaceBuckets = metrics?.available ? metrics.by_surface ?? [] : []
  const atlasDecideMetrics = metrics?.available ? metrics.atlas_decide : null
  const atlasDecideBuckets = metrics?.available ? metrics.by_atlas_decide_execution_strategy ?? [] : []
  const missingCostRates = metricsHealth?.evidence?.missing_cost_rates ?? []

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <SheetHeading title="Operação Atlas" subtitle="providers, fila e qualidade" />

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

        <DataSection title="health gate">
          {!metricsHealth?.available ? (
            <EmptyInline text="sem health gate carregado" />
          ) : (
            <>
              <DataRow label="status" value={String(metricsHealth.status)} />
              <DataRow label="score" value={metricsHealth.health_score != null ? `${metricsHealth.health_score}/100` : 'n/a'} />
              <DataRow label="issues" value={String(metricsHealth.issues.length)} />
              {missingCostRates.length > 0 && (
                <DataList
                  label="rates faltando"
                  items={missingCostRates.map((rate) => {
                    const provider = rate.provider ? providerWord(rate.provider) ?? rate.provider : 'provider?'
                    const model = rate.model ?? 'model?'

                    return `${provider}/${model} · ${rate.reason} · ${rate.traces} traces`
                  })}
                />
              )}
              {metricsHealth.issues.slice(0, 3).map((issue) => (
                <DataRow key={issue.key} label={issue.key} value={`${issue.severity}: ${issue.summary}`} />
              ))}
            </>
          )}
        </DataSection>

        <DataSection title="eficiência">
          {!metrics?.available || !metricTotals ? (
            <EmptyInline text="sem scorecard carregado" />
          ) : (
            <>
              <DataRow label="traces 24h" value={String(metricTotals.traces)} />
              <DataRow label="qualidade final" value={formatScore(metricTotals.final_quality_avg)} />
              <DataRow label="eficiência final" value={formatScore(metricTotals.final_efficiency_avg)} />
              <DataRow label="1a passagem" value={formatRate(metricTotals.first_pass_success_rate)} />
              <DataRow label="remediação" value={formatRate(metricTotals.needed_remediation_rate)} />
              <DataRow
                label="visível app"
                value={metricTotals.app_visible_avg_ms != null ? formatLatency(metricTotals.app_visible_avg_ms) : 'n/a'}
              />
              <DataRow label="custo incerto" value={String(metricTotals.unknown_cost_count)} />
              <DataRow label="custo estimado" value={String(metricTotals.estimated_cost_count ?? 0)} />
              <DataRow label="custo real" value={String(metricTotals.actual_cost_count ?? 0)} />
              {atlasDecideMetrics?.available && (
                <>
                  <DataRow label="atlas decide" value={`${atlasDecideMetrics.traces} traces`} />
                  <DataRow label="multi-stage" value={`${atlasDecideMetrics.multi_stage_count} · ${formatRate(atlasDecideMetrics.multi_stage_rate)}`} />
                  <DataRow label="degradado" value={`${atlasDecideMetrics.degraded_count} · ${formatRate(atlasDecideMetrics.degraded_rate)}`} />
                  {atlasDecideBuckets.slice(0, 2).map((bucket) => (
                    <DataRow
                      key={`atlas-decide-${bucket.bucket}`}
                      label={bucket.bucket.replace(/_/g, ' ')}
                      value={`${bucket.traces} · q ${formatScore(bucket.quality_avg)} · e ${formatScore(bucket.efficiency_avg)}`}
                    />
                  ))}
                </>
              )}
              {surfaceBuckets.slice(0, 3).map((bucket) => (
                <DataRow
                  key={bucket.bucket}
                  label={bucket.bucket}
                  value={`q ${formatScore(bucket.quality_avg)} · e ${formatScore(bucket.efficiency_avg)}`}
                />
              ))}
            </>
          )}
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
  const decisionReceipt = trace?.decision_receipt ?? null
  const openBrain = openBrainInjectionFromTrace(trace)

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

            {openBrain && (
              <DataSection title="open brain">
                <DataRow label="status" value={openBrainStatusLabel(openBrain.status)} />
                <DataRow label="surface" value={openBrain.surface ?? 'n/a'} />
                <DataRow label="refs" value={String(openBrain.refs ?? 0)} />
                <DataRow label="hash" value={openBrain.hash ? shortId(openBrain.hash) : 'n/a'} />
                <DataRow label="audit" value={openBrain.auditId ? shortId(openBrain.auditId) : 'n/a'} />
                <DataRow label="avisos" value={openBrain.warnings.length > 0 ? openBrain.warnings.join(' · ') : 'nenhum'} />
              </DataSection>
            )}

            {decisionReceipt && (
              <DataSection title="decisão Atlas">
                <DataRow label="modo" value={decisionModeLabel(decisionReceipt.decision_mode)} />
                <DataRow label="selecionado" value={providerWord(decisionReceipt.selected_provider) ?? String(decisionReceipt.selected_provider ?? 'atlas')} />
                <DataRow label="pedido" value={decisionReceipt.was_overridden ? (providerWord(decisionReceipt.requested_provider) ?? String(decisionReceipt.requested_provider ?? 'manual')) : 'atlas decide'} />
                <DataRow label="override" value={decisionReceipt.was_overridden ? 'sim' : 'não'} />
                {decisionReceipt.context_strategy && (
                  <DataRow label="contexto" value={String(decisionReceipt.context_strategy).replaceAll('_', ' ')} />
                )}
                {decisionReceipt.execution_strategy && (
                  <DataRow label="execução" value={String(decisionReceipt.execution_strategy).replaceAll('_', ' ')} />
                )}
                {decisionReceipt.fallback_provider && (
                  <DataRow label="fallback" value={providerWord(decisionReceipt.fallback_provider) ?? String(decisionReceipt.fallback_provider)} />
                )}
                {decisionReceipt.reason && (
                  <Sans size={12} lineHeight={17} color={c.ink2}>
                    {decisionReceipt.reason}
                  </Sans>
                )}
              </DataSection>
            )}

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
      <Frau italic size={13} lineHeight={18} color={active ? c.moss : c.ink2}>
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

function attachmentsFromTrace(trace: AtlasAiTrace): AtlasAiAttachment[] {
  if (Array.isArray(trace.attachments) && trace.attachments.length > 0) {
    return trace.attachments.filter(isAtlasAiAttachment)
  }

  const jobs = trace.jobs?.length ? trace.jobs : trace.job ? [trace.job] : []
  const attachments: AtlasAiAttachment[] = []
  for (const job of jobs) {
    attachments.push(...attachmentsFromJobPayload(job))
  }

  const seen = new Set<string>()
  return attachments.filter((attachment) => {
    if (seen.has(attachment.id)) return false
    seen.add(attachment.id)
    return true
  })
}

function attachmentsFromJobPayload(job: AtlasAiJob): AtlasAiAttachment[] {
  const payload = job.payload
  if (!payload || typeof payload !== 'object') return []
  const attachmentContainer = (payload as { attachments?: unknown }).attachments
  if (!attachmentContainer || typeof attachmentContainer !== 'object') return []
  const images = Array.isArray((attachmentContainer as { images?: unknown }).images)
    ? (attachmentContainer as { images: unknown[] }).images
    : []
  const files = Array.isArray((attachmentContainer as { files?: unknown }).files)
    ? (attachmentContainer as { files: unknown[] }).files
    : []

  return [...images, ...files].filter(isAtlasAiAttachment)
}

function isAtlasAiAttachment(value: unknown): value is AtlasAiAttachment {
  if (!value || typeof value !== 'object') return false
  const attachment = value as Partial<AtlasAiAttachment>
  return typeof attachment.id === 'string'
    && typeof attachment.name === 'string'
    && typeof attachment.kind === 'string'
}

function SyncDiamond({ pulsing }: { pulsing: boolean }) {
  const opacity = useSharedValue(1)
  const scale = useSharedValue(1)
  const rotate = useSharedValue(0)

  useEffect(() => {
    if (pulsing) {
      opacity.value = withRepeat(
        withTiming(0.4, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      )
      scale.value = withRepeat(
        withTiming(1.28, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      )
      rotate.value = withRepeat(
        withTiming(360, { duration: 4200, easing: Easing.linear }),
        -1,
        false,
      )
    } else {
      opacity.value = withTiming(1, { duration: 220 })
      scale.value = withTiming(1, { duration: 220 })
      rotate.value = withTiming(0, { duration: 220 })
    }
  }, [pulsing, opacity, scale, rotate])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }))

  return (
    <Animated.View style={style}>
      <BronzeDiamond size={20} opacity={0.9} />
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
  const flags = evaluation?.flags
  if (!Array.isArray(flags)) return []
  return flags.map((flag) => {
    const code = (flag as { code?: unknown })?.code
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

function threadHistoryModeOptions(threads: AtlasAiThread[]): Array<{ key: ThreadHistoryModeFilter; label: string; caption: string; count: number }> {
  const counts = new Map<RoutingMode, number>([
    ['general', 0],
    ['operational', 0],
    ['programming', 0],
  ])

  for (const thread of threads) {
    const mode = atlasAiModeFromThread(thread)
    counts.set(mode, (counts.get(mode) ?? 0) + 1)
  }

  return [
    { key: 'all', label: 'Tudo', caption: 'todas as conversas', count: threads.length },
    { key: 'general', label: 'Geral', caption: 'conversa e ideias', count: counts.get('general') ?? 0 },
    { key: 'operational', label: 'Operacional', caption: 'alertas e diagnóstico', count: counts.get('operational') ?? 0 },
    { key: 'programming', label: 'Programação', caption: 'código e testes', count: counts.get('programming') ?? 0 },
  ]
}

function threadHistorySubtitle(thread: AtlasAiThread): string {
  const context = atlasAiContextLabel(thread)
  const summary = thread.summary || thread.active_state?.current_topic
  const fallback = `${thread.message_count} mensagens`

  return [context, summary || fallback].filter(Boolean).join(' · ')
}

function threadOriginLabel(thread: AtlasAiThread): string {
  const metadata = thread.metadata ?? {}
  const explicit = metadataString(metadata, 'origin_label')
  if (explicit) {
    return explicit.toLowerCase().includes('operacional') ? 'Operacional' : explicit
  }

  const originType = metadataString(metadata, 'origin_type') ?? metadataString(metadata, 'created_from')
  if (originType === 'operational_promotion') return 'Operacional'
  if (originType === 'notification' || originType === 'push') return 'Notificação'

  if (thread.source_type === 'inbox_item' || thread.source_type === 'ai_inbox_item') return 'Inbox'
  if (metadataString(metadata, 'discussion_entrypoint') === 'atlas_ai_sheet') return 'Inbox'
  if (metadataString(metadata, 'source_type') === 'ai_inbox_item') return 'Inbox'
  if (metadataString(metadata, 'source_operational_thread_id')) return 'Operacional'
  if (thread.source_type === 'app' || thread.source_type === 'manual' || !thread.source_type) return 'Manual'

  return humanizeRuntimeKey(thread.source_type)
}

function modeFilterColor(filter: ThreadHistoryModeFilter, c: ReturnType<typeof useTheme>['c']): string {
  if (filter === 'all') return c.ink2
  return modeColor(filter, c)
}

function modeColor(mode: RoutingMode, c: ReturnType<typeof useTheme>['c']): string {
  switch (mode) {
    case 'programming':
      return c.prussian
    case 'operational':
      return c.bronze
    default:
      return c.ink3
  }
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
    return sanitizeRoutingState({
      mode: isRoutingMode(value.mode) ? value.mode : ROUTING_DEFAULT.mode,
      task: isRoutingTask(value.task) ? value.task : ROUTING_DEFAULT.task,
      domain: isRoutingDomain(value.domain) ? value.domain : ROUTING_DEFAULT.domain,
      executor: isRoutingExecutor(value.executor) ? value.executor : ROUTING_DEFAULT.executor,
      style: isRoutingStyle(value.style) ? value.style : ROUTING_DEFAULT.style,
    })
  } catch {
    return ROUTING_DEFAULT
  }
}

function routingStateFromThread(thread: AtlasAiThread, fallback: RoutingState): RoutingState {
  const metadata = thread.metadata ?? {}
  const mode = atlasAiModeFromThread(thread)
  const base = routingDefaultForMode(mode, fallback)
  const task = metadataString(metadata, 'routing_task')
  const domain = metadataString(metadata, 'routing_domain')
  const style = metadataString(metadata, 'routing_style')
  const requestedProvider = metadataString(metadata, 'requested_provider') ?? thread.last_provider

  return sanitizeRoutingState({
    mode,
    task: isRoutingTask(task) ? task : base.task,
    domain: isRoutingDomain(domain) ? domain : base.domain,
    executor: isRoutingExecutor(requestedProvider) ? requestedProvider : base.executor,
    style: isRoutingStyle(style) ? style : base.style,
  })
}

function routingDefaultForMode(mode: RoutingMode, fallback: RoutingState): RoutingState {
  if (mode === 'programming') {
    return sanitizeRoutingState({
      ...fallback,
      mode,
      task: fallback.task === 'debug' ? 'debug' : 'dev',
      domain: fallback.domain === 'auto' ? 'atlas' : fallback.domain,
      executor: fallback.executor === 'auto' ? 'codex_cli' : fallback.executor,
      style: fallback.style === 'clear' ? 'technical' : fallback.style,
    })
  }

  if (mode === 'operational') {
    return sanitizeRoutingState({
      ...fallback,
      mode,
      task: fallback.task === 'plan' ? 'plan' : 'review',
      domain: fallback.domain === 'auto' ? 'atlas' : fallback.domain,
      style: fallback.style === 'clear' ? 'complete' : fallback.style,
    })
  }

  return sanitizeRoutingState({
    ...fallback,
    mode,
    task: fallback.task === 'dev' || fallback.task === 'debug' ? 'direct' : fallback.task,
    domain: fallback.domain === 'atlas' ? 'auto' : fallback.domain,
  })
}

function isRoutingTask(value: unknown): value is RoutingState['task'] {
  return value === 'direct' || value === 'plan' || value === 'review' || value === 'dev' || value === 'debug'
}

function isRoutingMode(value: unknown): value is RoutingMode {
  return value === 'general' || value === 'operational' || value === 'programming'
}

function isRoutingDomain(value: unknown): value is RoutingState['domain'] {
  return isRoutingDomainKey(value)
}

function isRoutingExecutor(value: unknown): value is RoutingExecutor {
  return value === 'auto' || value === 'claude_cli' || value === 'codex_cli' || value === 'gemini_cli' || value === 'claude_codex'
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

function providerWord(provider: AtlasAiTrace['provider'] | undefined): string | undefined {
  if (provider === 'claude_codex') return 'conselho'
  if (provider === 'claude_cli')   return 'claude'
  if (provider === 'codex_cli')    return 'codex'
  if (provider === 'gemini_cli')   return 'gemini'
  if (provider == null || provider === 'auto') return undefined
  // Unknown string provider — show as-is, lowercased.
  return String(provider).toLowerCase()
}

function decisionModeLabel(mode: unknown): string {
  if (mode === 'manual_override') return 'override manual'
  if (mode === 'atlas_decide') return 'atlas decide'
  return typeof mode === 'string' && mode.trim() ? mode : 'atlas decide'
}

function executorAsProviderWord(executor: RoutingExecutor): string | undefined {
  if (executor === 'claude_cli')   return 'claude'
  if (executor === 'codex_cli')    return 'codex'
  if (executor === 'gemini_cli')   return 'gemini'
  if (executor === 'claude_codex') return 'conselho'
  return undefined
}

function providerFromRouting(routing: RoutingState): AtlasAiProvider | null {
  routing = sanitizeRoutingState(routing)
  if (routing.executor === 'claude_cli') return 'claude_cli'
  if (routing.executor === 'codex_cli') return 'codex_cli'
  if (routing.executor === 'gemini_cli') return 'gemini_cli'
  if (routing.executor === 'claude_codex') return 'claude_codex'
  return null
}

function geminiAutomaticEnabled(status: AiProvidersStatusResponse | null): boolean {
  return status?.model_policy?.providers.find((item) => item.provider === 'gemini_cli')?.allow_auto === true
}

function effectiveAgent(routing: RoutingState): string | undefined {
  routing = sanitizeRoutingState(routing)
  if (routing.mode === 'programming') return 'desenvolvedor'
  if (routing.domain !== 'auto') return routing.domain
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

function formatScore(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a'
  const rounded = Math.round(value * 10) / 10
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}/100`
}

function formatRate(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'n/a'
  return `${Math.round(value * 100)}%`
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
    const userItem: Record<string, unknown> = {
      role: 'user',
      text: truncateForContext(trace.operator_input, 900),
      trace_id: trace.id,
    }
    const attachments = attachmentsFromTrace(trace).map((attachment) => ({
      id: attachment.id,
      kind: attachment.kind,
      name: attachment.name,
      mime_type: attachment.mime_type,
      bytes: attachment.bytes,
      pdf_page_count: attachment.pdf_page_count,
      pdf_processing_status: attachment.pdf_processing_status,
      pdf_render_status: attachment.pdf_render_status,
      pdf_ocr_status: attachment.pdf_ocr_status,
    }))
    if (attachments.length > 0) {
      userItem.attachments = attachments
    }

    const items: Array<Record<string, unknown>> = [userItem]

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

function atlasModePayloadForRouting(routing: RoutingState, focus: AtlasAiFocus, workspace?: string | null): Record<string, unknown> {
  return atlasModePayloadForRoutingContract(routing, focus, { workspace })
}

function runtimePolicyPayloadForThread(thread: AtlasAiThread | null, focusOverride?: AtlasAiFocus): Record<string, unknown> {
  const metadata = thread?.metadata ?? {}
  const capabilityProfile = metadataString(metadata, 'capability_profile')
  const metadataSourceType = metadataString(metadata, 'source_type')
  const operationalContext = capabilityProfile === 'mobile_operational_read'
    || metadataSourceType === 'ai_inbox_item'
    || thread?.source_type === 'inbox_item'

  if (!operationalContext) return {}
  const focus = focusOverride ?? normalizeAtlasAiFocus(metadataString(metadata, 'atlas_focus'), 'operational')

  return {
    atlas_focus: focus,
    source_atlas_focus: metadataString(metadata, 'atlas_focus') ?? 'operational',
    thread_source: 'mobile_gateway_inbox',
    inbox_item_id: metadataString(metadata, 'inbox_item_id') ?? thread?.source_id ?? undefined,
    context_bundle_id: metadataString(metadata, 'context_bundle_id') ?? undefined,
    capability_profile: 'atlas_full_access',
    permission_policy: 'full_access',
    execution_policy: 'provider_execution_allowed',
    permission_mode: 'danger',
    tool_permissions: {
      mode: 'danger',
      workspace: thread?.workspace ?? undefined,
      confirmed: true,
      allow_unsandboxed_provider: true,
      source: 'atlas_ai_contextual_thread_full_access',
    },
    mobile_runtime_policy: {
      allows_code_execution: true,
      reason: 'Atlas app runtime settings allow provider execution and full-access tooling.',
    },
  }
}

function bootstrapStepColor(
  state: OperationalBootstrapStep['state'],
  c: ReturnType<typeof useTheme>['c'],
): string {
  if (state === 'done') return c.moss
  if (state === 'active') return c.bronze
  if (state === 'failed') return c.recRed
  return c.ink3
}

function threadModeNotice(thread: AtlasAiThread | null): AtlasAiModeNoticeData | null {
  if (!thread) return null

  const metadata = thread.metadata ?? {}
  const current = atlasAiModeFromThread(thread)
  const initial = normalizeAtlasAiMode(
    metadataString(metadata, 'initial_mode')
      ?? metadataString(metadata, 'initial_focus')
      ?? metadataString(metadata, 'atlas_mode')
      ?? metadataString(metadata, 'atlas_focus'),
    current,
  )
  const history = Array.isArray(metadata.mode_history) ? metadata.mode_history : []
  const changed = current !== initial || history.length > 1

  if (!changed) return null

  return {
    tone: current,
    title: `Modo ${atlasAiModeLabel(current)} ativo`,
    summary: `Começou em ${atlasAiModeLabel(initial)}; próximos envios seguem ${atlasAiModeLabel(current)}.`,
  }
}

function contextualThreadIntro(thread: AtlasAiThread | null): AtlasAiContextIntroData | null {
  if (!isOperationalContextThread(thread)) return null

  const metadata = thread?.metadata ?? {}
  const systemContext = [...(thread?.messages ?? [])]
    .sort((left, right) => left.position - right.position)
    .find((message) => message.role === 'system' && message.content.trim().length > 0)
    ?.content
    ?.trim() ?? null

  return {
    title: metadataString(metadata, 'context_label') ?? thread?.title ?? 'Contexto operacional',
    summary: thread?.summary ?? null,
    body: systemContext ? truncateForContext(systemContext, 900) : null,
    focus: focusLabel(metadataString(metadata, 'atlas_focus') ?? 'operational'),
    permission: permissionPolicyLabel('full_access'),
    execution: executionPolicyLabel('provider_execution_allowed'),
  }
}

function developmentPromptFromContext(
  intro: AtlasAiContextIntroData,
  sourceThread: AtlasAiThread,
  traces: AtlasAiTrace[],
): string {
  const metadata = sourceThread.metadata ?? {}
  const bootstrapTrace = traces.find(isDiscussionBootstrapTrace) ?? null
  const bootstrapResponse = bootstrapTrace ? pickResponseText(bootstrapTrace).trim() : ''
  const recentUserTurns = sortAtlasTraces(traces)
    .filter((trace) => trace.operator_input.trim().length > 0 && !isDiscussionBootstrapTrace(trace))
    .slice(-3)
    .map((trace) => `- ${truncateForContext(trace.operator_input.trim(), 260)}`)

  const sections = [
    'Modo Programação do Atlas AI.',
    'Use este contexto operacional como briefing técnico. Não peça para eu reenviar o alerta; o contexto abaixo é a fonte inicial.',
    [
      'Origem operacional:',
      `- Título: ${intro.title}`,
      intro.summary ? `- Resumo: ${intro.summary}` : null,
      `- Thread operacional: ${sourceThread.id}`,
      metadataString(metadata, 'inbox_item_id') ? `- Inbox item: ${metadataString(metadata, 'inbox_item_id')}` : null,
      metadataString(metadata, 'context_bundle_id') ? `- Context bundle: ${metadataString(metadata, 'context_bundle_id')}` : null,
      metadataString(metadata, 'source_type') ? `- Source: ${metadataString(metadata, 'source_type')}` : null,
    ].filter(Boolean).join('\n'),
    intro.body ? `Contexto carregado:\n${intro.body}` : null,
    bootstrapResponse
      ? `Diagnóstico inicial do Atlas:\n${truncateForContext(bootstrapResponse, 1600)}`
      : 'Diagnóstico inicial do Atlas: ainda não há resposta automática completa; use o contexto carregado e investigue antes de concluir.',
    recentUserTurns.length > 0 ? `Mensagens recentes do operador:\n${recentUserTurns.join('\n')}` : null,
    [
      'Objetivo técnico:',
      '- Transformar o alerta operacional em diagnóstico executável.',
      '- Identificar arquivos, serviços, comandos, queries, logs ou testes relevantes.',
      '- Se for preciso webscrape, script, teste, Postgres ou alteração de código, use o runtime normal de Programação do Atlas.',
      '- Antes de alterar comportamento, isole causa, risco e critério de sucesso.',
    ].join('\n'),
    [
      'Saída esperada:',
      '- Plano curto.',
      '- Evidências verificadas.',
      '- Execução realizada ou motivo claro para não executar.',
      '- Testes/comandos rodados ou próximos comandos exatos.',
      '- Riscos e rollback quando houver mudança.',
    ].join('\n'),
  ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0)

  return sections.join('\n\n')
}

function developmentThreadOriginPayload(
  sourceThread: AtlasAiThread,
  intro: AtlasAiContextIntroData,
): Record<string, unknown> {
  const metadata = sourceThread.metadata ?? {}

  return {
    created_from: 'operational_promotion',
    origin_type: 'operational_promotion',
    origin_label: 'Operacional para Programação',
    source_operational_thread_id: sourceThread.id,
    source_operational_title: intro.title,
    source_inbox_item_id: metadataString(metadata, 'inbox_item_id') ?? sourceThread.source_id ?? undefined,
    source_context_bundle_id: metadataString(metadata, 'context_bundle_id') ?? undefined,
    source_thread_mode: atlasAiModeFromThread(sourceThread),
    source_thread_focus: atlasAiFocusFromThread(sourceThread),
  }
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function metadataRecord(metadata: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = metadata[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function stringFromRecord(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null
  const next = (value as Record<string, unknown>)[key]
  return typeof next === 'string' && next.trim().length > 0 ? next.trim() : null
}

function numberFromRecord(value: unknown, key: string): number | null {
  if (!value || typeof value !== 'object') return null
  const next = (value as Record<string, unknown>)[key]
  return typeof next === 'number' && Number.isFinite(next) ? next : null
}

function focusLabel(value: string): string {
  switch (value) {
    case 'operational': return 'Operacional'
    case 'programming': return 'Programação'
    case 'research': return 'Pesquisa'
    case 'project': return 'Projeto'
    case 'review': return 'Revisão'
    case 'general': return 'Geral'
    default: return humanizeRuntimeKey(value)
  }
}

function permissionPolicyLabel(value: string): string {
  switch (value) {
    case 'full_access': return 'Acesso total'
    case 'read_only_until_approval': return 'Leitura até aprovação'
    case 'read_only': return 'Somente leitura'
    case 'approval_required': return 'Aprovação obrigatória'
    default: return humanizeRuntimeKey(value)
  }
}

function executionPolicyLabel(value: string): string {
  switch (value) {
    case 'provider_execution_allowed': return 'Execução liberada'
    case 'no_code_execution': return 'Sem execução'
    case 'single_provider': return 'Provider único'
    case 'dual_review': return 'Revisão dupla'
    default: return humanizeRuntimeKey(value)
  }
}

function humanizeRuntimeKey(value: string): string {
  const normalized = value.replace(/[_-]+/g, ' ').trim()
  if (!normalized) return 'n/d'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function openBrainPayloadForRouting(routing: RoutingState): Record<string, unknown> | undefined {
  const shouldInject = routing.mode === 'programming' || routing.task === 'dev' || routing.task === 'debug' || routing.task === 'review'
  if (!shouldInject) return undefined

  return {
    mode: 'auto',
    surface: 'app_ai',
    provider_safe_only: true,
  }
}

interface OpenBrainTraceMetadata {
  status: string
  surface: string | null
  hash: string | null
  auditId: string | null
  refs: number | null
  warnings: string[]
}

function openBrainInjectionFromTrace(trace: AtlasAiTrace | null): OpenBrainTraceMetadata | null {
  if (!trace) return null

  const traceInjection = metadataRecord(trace.metadata ?? {}, 'open_brain_injection')
  const jobInjection = trace.job ? metadataRecord(trace.job.metadata ?? {}, 'open_brain_injection') : null
  const source = traceInjection ?? jobInjection
  const status = stringFromRecord(source, 'status')

  if (!source || !status) return null

  const summary = metadataRecord(source, 'summary') ?? {}
  const warningsRaw = source.warnings
  const warnings = Array.isArray(warningsRaw)
    ? warningsRaw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []

  return {
    status,
    surface: stringFromRecord(source, 'surface'),
    hash: stringFromRecord(source, 'context_pack_hash'),
    auditId: stringFromRecord(source, 'audit_id'),
    refs: numberFromRecord(summary, 'context_refs'),
    warnings,
  }
}

function openBrainStatusLabel(status: string): string {
  if (status === 'injected') return 'usado'
  if (status === 'degraded') return 'parcial'
  if (status === 'failed_open') return 'falhou aberto'
  if (status === 'failed_closed') return 'bloqueado'
  if (status === 'skipped') return 'ignorado'
  return humanizeRuntimeKey(status).toLowerCase()
}

function openBrainStatusColor(status: string, c: ReturnType<typeof useTheme>['c']): string {
  if (status === 'injected') return c.moss
  if (status === 'degraded') return c.bronze
  if (status === 'failed_open' || status === 'failed_closed') return c.recRed
  return c.ink2
}

function truncateForContext(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function pinnedTraceStorageKey(threadId: string): string {
  return `${PINNED_TRACE_KEY_PREFIX}${threadId}`
}

function attachmentOnlyPrompt(
  attachments: ComposerImageAttachment[],
  fileAttachments: ComposerFileAttachment[],
): string {
  if (attachments.length > 0 && fileAttachments.length > 0) {
    return `analise os ${attachments.length + fileAttachments.length} anexos enviados.`
  }
  if (attachments.length > 0) {
    return attachments.length === 1
      ? 'analise a imagem anexada.'
      : `analise as ${attachments.length} imagens anexadas.`
  }
  if (fileAttachments.length > 0) {
    return fileAttachments.length === 1
      ? 'analise o arquivo anexado.'
      : `analise os ${fileAttachments.length} arquivos anexados.`
  }

  return ''
}

async function attachmentFromClipboardImage(image: Clipboard.ClipboardImage): Promise<ComposerImageAttachment> {
  const parsed = parseImageDataUri(image.data)
  const fileName = `atlas-clipboard-${Date.now()}.${extensionForMime(parsed.mimeType)}`
  const cacheDir = FileSystem.cacheDirectory
  if (!cacheDir) {
    throw new Error('Cache local indisponível para salvar o print.')
  }

  const uri = `${cacheDir}${fileName}`
  await FileSystem.writeAsStringAsync(uri, parsed.base64, {
    encoding: FileSystem.EncodingType.Base64,
  })

  return {
    id: newAttachmentId(),
    uri,
    fileName,
    mimeType: parsed.mimeType,
    width: image.size.width,
    height: image.size.height,
    source: 'clipboard',
  }
}

function attachmentFromAsset(asset: ImagePicker.ImagePickerAsset, source: 'camera' | 'photos'): ComposerImageAttachment {
  const mimeType = asset.mimeType || 'image/jpeg'
  return {
    id: newAttachmentId(),
    uri: asset.uri,
    fileName: asset.fileName || `atlas-${source}-${Date.now()}.${extensionForMime(mimeType)}`,
    mimeType,
    width: asset.width,
    height: asset.height,
    source,
  }
}

function attachmentFromDocumentAsset(asset: DocumentPicker.DocumentPickerAsset): ComposerFileAttachment {
  return {
    id: newAttachmentId(),
    uri: asset.uri,
    fileName: asset.name || `atlas-file-${Date.now()}`,
    mimeType: asset.mimeType || mimeForFileName(asset.name),
    size: typeof asset.size === 'number' ? asset.size : null,
    source: 'files',
  }
}

function isDocumentImageAsset(asset: DocumentPicker.DocumentPickerAsset): boolean {
  const mimeType = asset.mimeType || mimeForFileName(asset.name)
  return mimeType.startsWith('image/')
}

function attachmentFromDocumentImageAsset(asset: DocumentPicker.DocumentPickerAsset): ComposerImageAttachment {
  const mimeType = asset.mimeType || mimeForFileName(asset.name)
  return {
    id: newAttachmentId(),
    uri: asset.uri,
    fileName: asset.name || `atlas-file-image-${Date.now()}.${extensionForMime(mimeType)}`,
    mimeType,
    width: null,
    height: null,
    source: 'files',
  }
}

async function attachmentFitsLocalLimit(attachment: ComposerImageAttachment): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(attachment.uri)
    return !info.exists || info.size <= MAX_DRAFT_IMAGE_BYTES
  } catch {
    return true
  }
}

async function fileAttachmentFitsLocalLimit(attachment: ComposerFileAttachment): Promise<boolean> {
  if (typeof attachment.size === 'number' && attachment.size > MAX_DRAFT_FILE_BYTES) {
    return false
  }

  try {
    const info = await FileSystem.getInfoAsync(attachment.uri)
    return !info.exists || info.size <= MAX_DRAFT_FILE_BYTES
  } catch {
    return true
  }
}

function mimeForFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'json') return 'application/json'
  if (ext === 'csv') return 'text/csv'
  if (ext === 'md' || ext === 'markdown') return 'text/markdown'
  if (ext === 'xml') return 'application/xml'
  if (ext === 'html' || ext === 'htm') return 'text/html'
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (ext === 'pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  if (ext === 'txt') return 'text/plain'
  return 'application/octet-stream'
}

function fileExtensionLabel(fileName: string): string {
  const ext = fileName.split('.').pop()?.trim().toUpperCase()
  return ext && ext.length <= 5 ? ext : 'FILE'
}

function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return 'arquivo'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

function parseImageDataUri(dataUri: string): { mimeType: string; base64: string } {
  const match = dataUri.match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i)
  if (!match?.[1] || !match[2]) {
    throw new Error('Clipboard não retornou uma imagem válida.')
  }

  return {
    mimeType: match[1].toLowerCase(),
    base64: match[2],
  }
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  return 'png'
}

function newAttachmentId(): string {
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
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

async function storePendingSubmission(submission: PendingAiSubmission): Promise<boolean> {
  try {
    await atlasStorage.setItem(PENDING_SUBMISSION_KEY, JSON.stringify(submission))
    return true
  } catch {
    // Best-effort recovery only; a storage failure should not block sending.
    return false
  }
}

async function readPendingSubmission(): Promise<PendingAiSubmission | null> {
  try {
    const raw = await atlasStorage.getItem(PENDING_SUBMISSION_KEY)
    return parsePendingSubmission(raw)
  } catch {
    return null
  }
}

async function clearPendingSubmission(clientId?: string): Promise<void> {
  try {
    if (clientId) {
      const current = parsePendingSubmission(await atlasStorage.getItem(PENDING_SUBMISSION_KEY))
      if (current && current.clientId !== clientId) return
    }
    await atlasStorage.removeItem(PENDING_SUBMISSION_KEY)
  } catch {
    // Nothing useful to do; the next recovery pass will re-check the payload.
  }
}

function parsePendingSubmission(raw: string | null): PendingAiSubmission | null {
  if (!raw) return null

  try {
    const value = JSON.parse(raw) as Partial<PendingAiSubmission>
    if (typeof value.clientId !== 'string' || typeof value.input !== 'string' || value.input.trim() === '') {
      return null
    }

    const startedAt = typeof value.startedAt === 'number' && Number.isFinite(value.startedAt)
      ? value.startedAt
      : Date.now()
    const pinnedTraceIds = Array.isArray(value.pinnedTraceIds)
      ? value.pinnedTraceIds.filter((id): id is string => typeof id === 'string')
      : []
    const attachments = normalizeStoredAttachments(value.attachments)
    const fileAttachments = normalizeStoredFileAttachments(value.fileAttachments)

    return {
      clientId: value.clientId,
      correlationId: typeof value.correlationId === 'string' ? value.correlationId : value.clientId,
      input: value.input,
      attachments,
      fileAttachments,
      threadId: typeof value.threadId === 'string' ? value.threadId : null,
      routing: normalizeStoredRouting(JSON.stringify(value.routing ?? ROUTING_DEFAULT)),
      pinnedTraceIds,
      threadOriginPayload: normalizeStoredRecord(value.threadOriginPayload),
      startedAt,
    }
  } catch {
    return null
  }
}

function normalizeStoredRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizeStoredAttachments(value: unknown): ComposerImageAttachment[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item): ComposerImageAttachment | null => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const uri = typeof record.uri === 'string' ? record.uri : ''
      const fileName = typeof record.fileName === 'string' ? record.fileName : ''
      const mimeType = typeof record.mimeType === 'string' ? record.mimeType : ''
      if (!uri || !fileName || !mimeType.startsWith('image/')) return null

      return {
        id: typeof record.id === 'string' ? record.id : newAttachmentId(),
        uri,
        fileName,
        mimeType,
        width: typeof record.width === 'number' ? record.width : null,
        height: typeof record.height === 'number' ? record.height : null,
        source: typeof record.source === 'string' ? record.source : 'recovered',
      }
    })
    .filter((item): item is ComposerImageAttachment => item !== null)
    .slice(0, MAX_DRAFT_IMAGES)
}

function normalizeStoredFileAttachments(value: unknown): ComposerFileAttachment[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item): ComposerFileAttachment | null => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const uri = typeof record.uri === 'string' ? record.uri : ''
      const fileName = typeof record.fileName === 'string' ? record.fileName : ''
      const mimeType = typeof record.mimeType === 'string' ? record.mimeType : ''
      if (!uri || !fileName) return null

      return {
        id: typeof record.id === 'string' ? record.id : newAttachmentId(),
        uri,
        fileName,
        mimeType: mimeType || mimeForFileName(fileName),
        size: typeof record.size === 'number' ? record.size : null,
        source: typeof record.source === 'string' ? record.source : 'recovered',
      }
    })
    .filter((item): item is ComposerFileAttachment => item !== null)
    .slice(0, MAX_DRAFT_FILES)
}

function shouldKeepPendingSubmission(error: unknown): boolean {
  if (!(error instanceof AtlasApiError)) return true
  return error.status === 408 || error.status === 429 || error.status >= 500
}

function humanAiError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback
  if (message.includes('route ai/') || message.includes('rota ai/')) {
    return 'Atlas não está carregado no servidor. Rebuild/restart o atlas-server e toque na marca para tentar de novo.'
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
    gap: 18,
  },
  headerAction: {
    width: 36,
    height: 40,
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
  threadHeader: {
    paddingHorizontal: 28,
    paddingTop: 20,
  },
  threadListContent: {
    paddingHorizontal: 28,
    paddingBottom: 24,
    flexGrow: 1,
  },
  modeNotice: {
    minHeight: 74,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  modeNoticeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  bootstrapPanel: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 11,
    marginBottom: 14,
  },
  bootstrapHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  bootstrapStatusPill: {
    minHeight: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bootstrapPreview: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 11,
  },
  bootstrapSteps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bootstrapStep: {
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bootstrapStepDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  bootstrapRefresh: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  contextIntro: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
    marginBottom: 18,
  },
  contextIntroHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  contextIntroBadge: {
    minHeight: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextIntroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  contextIntroMetric: {
    minWidth: '30%',
    flex: 1,
    gap: 4,
  },
  contextIntroAction: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
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
  continuityTopEmpty: {
    justifyContent: 'flex-end',
    minHeight: 0,
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
  openBrainBadge: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  openBrainDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  openBrainText: {
    flexShrink: 1,
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
  threadModeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
  },
  threadModeCard: {
    width: '47.5%',
    minHeight: 82,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 5,
  },
  threadModeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  threadRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  threadFocusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
    minHeight: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  turnAttachmentSummary: {
    marginTop: 12,
  },
  attachmentStatusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingBottom: 2,
  },
  attachmentStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  attachmentProgressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 5,
    marginBottom: 2,
  },
  attachmentProgressFill: {
    height: 3,
    borderRadius: 2,
  },
  attachmentStrip: {
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
  },
  attachmentThumb: {
    width: 54,
    height: 54,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'visible',
  },
  attachmentImage: {
    width: 52,
    height: 52,
    borderRadius: 7,
  },
  attachmentRemove: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    right: -8,
    top: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileAttachmentStrip: {
    paddingTop: 4,
    paddingBottom: 8,
    gap: 10,
  },
  fileAttachmentChip: {
    width: 220,
    minHeight: 54,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 10,
    paddingRight: 8,
  },
  fileAttachmentIcon: {
    width: 38,
    height: 34,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileAttachmentText: {
    flex: 1,
    minWidth: 0,
  },
  fileAttachmentRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfPreviewSafe: {
    flex: 1,
  },
  pdfPreviewHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pdfPreviewClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfPreviewTitle: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  pdfPreviewHeaderSide: {
    width: 44,
  },
  pdfPreviewList: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 14,
  },
  pdfPageFrame: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
    gap: 8,
  },
  pdfPageImage: {
    width: '100%',
    aspectRatio: 0.7727,
  },
  pdfPreviewEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  attachmentSheetContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 28,
  },
  attachmentActions: {
    marginTop: 16,
  },
  attachmentAction: {
    minHeight: 54,
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 28,
    paddingTop: 4,
  },
  copyToast: {
    position: 'absolute',
    top: -28,
    left: 28,
    right: 28,
    alignItems: 'center',
  },
})
