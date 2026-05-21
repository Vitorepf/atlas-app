import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AppState,
  Alert,
  type AppStateStatus,
  FlatList,
  InteractionManager,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native'
import { atlasStorage } from '../../lib/storage'
import * as Clipboard from 'expo-clipboard'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import Animated, {
  Easing,
  LayoutAnimationConfig,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, usePathname } from 'expo-router'
import {
  atlasComputeEffortForPayload,
  normalizeAtlasComputeEffort,
  type AtlasComputeEffortChoice,
} from '../../lib/richInput'
import { SideSheet } from './SideSheet'
import { Frau, Mono, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useShell } from '../AtlasShell'
import { useOverlays } from '../../lib/overlays'
import { sha256Hex } from '../../lib/sha256'
import {
  mobileVoiceDispatchFailureFromResult,
  mobileVoiceDispatchTraceFromResult,
  mobileVoiceEmptyResponseFailure,
  mobileVoiceEndpointingDecision,
  mobileVoiceInterruptionStage,
  mobileVoiceMeteringIsSpeech,
  mobileVoiceMetricMs,
  mobileVoiceOpenBlockReason,
  mobileVoiceReadinessSummary,
  mobileVoiceRecordingBlockReason,
  mobileVoiceRecordingValidationFailure,
  mobileVoiceSessionCloseStrategy,
  mobileVoiceSessionDeferredCloseOutcome,
  mobileVoiceLiveKitSessionFromStartResponse,
  mobileVoiceSessionStartOutcome,
  mobileVoiceShouldRecordInterruption,
  mobileVoiceStaleDispatchFailure,
  mobileVoiceTraceTerminalFailure,
  mobileVoiceTraceLookupPollFailureSignal,
  newMobileVoiceRuntimeId,
  mobileVoiceUiWatchdogDecision,
  type MobileVoiceLiveKitSession,
} from '../../lib/atlasVoiceRuntime'
import {
  AtlasApiError,
  type AiInteractionUploadProgress,
  type AiObservabilityResponse,
  type AiProvidersStatusResponse,
  type AtlasAiDomainCatalogResponse,
  type AtlasAiAttachment,
  type AtlasAiCompaction,
  type AtlasAiContextSnapshot,
  type AtlasAiJob,
  type AtlasAiProviderHandoff,
  type AtlasAiProvider,
  type AtlasAiQualityAction,
  type AtlasAiQualityEvaluation,
  type AtlasAiSessionState,
  type AtlasAiStreamEvent,
  type AtlasAiThread,
  type AtlasAiTrace,
  type AtlasVoiceSessionResponse,
  type AiThreadsResponse,
  cancelAiJob,
  compactAiThread,
  createAiInteraction,
  deleteAiThread,
  feedbackAiInteraction,
  getAiObservability,
  getAiInteraction,
  getAiDomainCatalog,
  getAiProvidersStatus,
  getAiThread,
  getAiThreadState,
  getMobileVoiceReadiness,
  getMobileDeviceSession,
  getApiBase,
  getAtlasAuthHeaders,
  interruptMobileVoiceTurn,
  listAiInteractions,
  listCaptures,
  listAiQualityActions,
  listAiThreadSnapshots,
  listAiThreads,
  retryMobileInboxDiscussionBootstrap,
  retryAiJob,
  recordMobileVoiceRuntimeFailed,
  recordMobileVoiceTurnPlayed,
  recordMobileVoiceTurnSynthesized,
  recoverMobileDeviceSession,
  runAiQualityAction,
  streamAiInteraction,
  synthesizeMobileVoiceTurn,
  startMobileVoiceSession,
  endMobileVoiceSession,
  switchAiThreadProvider,
  updateAiThread,
} from '../../lib/api/client'
// v18 · Modo Gravar via long-press ✦ send do composer · canon Atlas radical.
// Substitui Voice Mode no gesture (que perdeu trigger quando dock sumiu em /).
// Captura silenciosa pro inbox · vocabulário "WhatsApp voice memo".
import { RecordModeStrip } from '../inbox/RecordModeStrip'
import { useAtlasStore } from '../../lib/atlasStore'
import { AttachmentImageViewer } from '../console/AttachmentImageViewer'
import { QuoteCompact } from '../console/QuoteCompact'
// v18 · RoutingSheet substituído por AtlasDecideSheet (canon mockup com
// 5 sections numeradas + destino-list editorial). Vocabulário 100% editorial:
// pílulas azuis arredondadas (SaaS) deram lugar a lista vertical com ✦
// no item ativo. Lógica funcional preservada (sanitize/applyAtlasMode/etc).
import { AtlasDecideSheet } from './AtlasDecideSheet'
// v18 · Voice Mode (conversa por voz tempo real fullscreen) · canon mockup
// atlas-home-editorial · acessado via long-press no ✦ send do composer.
import { VoiceModeSheet, type VoiceModeState } from './VoiceModeSheet'
import { AtlasAiEmptyPage, AtlasAiFilteredEmpty } from './atlas-ai/AtlasAiEmptyStates'
import { AtlasAiScreenContainer } from './atlas-ai/AtlasAiScreenContainer'
import { ThreadHistorySheet as AtlasAiThreadHistorySheet } from './atlas-ai/ThreadHistorySheet'
import {
  SearchSheet,
  SessionMapSheet,
} from './atlas-ai/AtlasAiSessionSheets'
import { ContextSheet } from './atlas-ai/AtlasAiContextSheet'
import {
  OperationsSheet,
  SkillsSheet,
} from './atlas-ai/AtlasAiDiagnosticsSheets'
import { ExecutionSheet } from './atlas-ai/AtlasAiExecutionSheet'
import {
  providerWord,
} from './atlas-ai/threadHistoryModel'
import {
  AttachmentSheet,
  HistoricalAttachmentSummary,
  PdfAttachmentViewer,
  TurnAttachmentSummary,
} from './atlas-ai/AtlasAiAttachments'
import {
  type ComposerFileAttachment,
  type ComposerImageAttachment,
  formatBytes,
} from './atlas-ai/attachmentTypes'
import {
  MAX_DRAFT_FILE_BYTES,
  MAX_DRAFT_FILES,
  MAX_DRAFT_IMAGE_BYTES,
  MAX_DRAFT_IMAGES,
  attachmentFitsLocalLimit,
  attachmentFromAsset,
  attachmentFromClipboardImage,
  attachmentFromDocumentAsset,
  attachmentFromDocumentImageAsset,
  attachmentOnlyPrompt,
  fileAttachmentFitsLocalLimit,
  isDocumentImageAsset,
} from './atlas-ai/AtlasAiAttachmentModel'
import {
  clearPendingSubmission,
  humanAiError,
  newClientId,
  readPendingSubmission,
  shouldKeepPendingSubmission,
  storePendingSubmission,
  type PendingAiSubmission,
} from './atlas-ai/AtlasAiSubmissionRecovery'
import {
  compactDomainSelectionForPayload,
  compactDomainSelectionPayloadPatch,
} from './atlas-ai/AtlasAiDomainSelectionModel'
import {
  prepareLongMessageForAtlas,
} from './atlas-ai/AtlasAiLongMessageModel'
import {
  numberFromRecord,
  stringFromRecord,
} from './atlas-ai/AtlasAiRecordModel'
import { styles } from './atlas-ai/AtlasAiSheet.styles'
import { copyToClipboard } from './atlas-ai/AtlasAiClipboard'
import { AtlasAiHeader } from './atlas-ai/AtlasAiHeader'
import {
  PENDING_SUBMISSION_RETRY_DELAY_MS,
  COMPUTE_EFFORT_KEY,
  ROUTING_KEY,
  THREAD_PAGE_SIZE,
  pinnedTraceStorageKey,
} from './atlas-ai/AtlasAiStorageKeys'
import type {
  DisplayTurn,
  PendingTurn,
  SubmitTextOptions,
} from './atlas-ai/AtlasAiSheetTypes'
import {
  feedbackPayload,
  feedbackToast,
  mergeQualityAction,
  type FeedbackAction,
} from './atlas-ai/AtlasAiQualityFeedback'
import { TurnBodyView } from './atlas-ai/AtlasAiTurnBody'
import {
  attachmentsFromTrace,
  bodyFromTrace,
  buildConversationContext,
  formatConversationForCopy,
  mergeJobIntoTrace,
  pickResponseText,
} from './atlas-ai/AtlasAiTurnModel'
import {
  AtlasAiContextIntro,
  AtlasAiModeNotice,
  OperationalBootstrapPanel,
  type AtlasAiContextIntroData,
} from './atlas-ai/AtlasAiContextPanels'
import {
  contextualThreadIntro,
  developmentPromptFromContext,
  developmentThreadOriginPayload,
  threadModeNotice,
} from './atlas-ai/AtlasAiContextModel'
import {
  ContinuityPanel,
  turnFilterLabel,
} from './atlas-ai/AtlasAiContinuityPanel'
import {
  classifyDecideDestino,
  shouldClassifyAtlasAiDraft,
  type DecideDestino,
} from './atlas-ai/AtlasAiDecideModel'
import { AtlasAiComposerFooter } from './atlas-ai/AtlasAiComposerFooter'
import {
  ROUTING_DEFAULT,
  StatusRouting,
  sanitizeRoutingState,
  type RoutingDomain,
  type RoutingExecutor,
  type RoutingMode,
  type RoutingState,
  type RoutingStyle,
} from '../console/StatusRouting'
import { fonts } from '../../design/tokens'
import {
  TRACE_HISTORY_LIMIT,
  type AtlasAiTurnFilter,
  isAtlasTraceActive,
  mergeAtlasTrace,
  pollIntervalForAtlasAi,
  sortAtlasTraces,
  traceDisplayKey,
  traceMatchesClientId,
  traceMatchesTurnFilter,
} from '../../lib/atlasAiRuntime'
import { buildInteractionPayload } from '../../lib/atlasAi/contract'
import {
  flushAtlasAiTelemetry,
  newAtlasAiCorrelationId,
  recordAtlasAiEvent,
} from '../../lib/atlasAiTelemetry'
import {
  nowMs,
  recordPerformanceDuration,
} from '../../lib/performanceTelemetry'
import {
  atlasAiContextLabel,
  atlasAiFocusLabel,
} from '../../lib/atlasAiFocus'
import {
  atlasAiFocusForRouting,
  atlasAiModeFromThread,
  threadRoutingMetadataPatch,
} from '../../lib/atlasAiThreadRouting'
import {
  effectiveAgent,
  executorAsProviderWord,
  geminiAutomaticEnabled,
  normalizeStoredRouting,
  openBrainPayloadForRouting,
  providerFromRouting,
  providerGovernanceFromThread,
  responsePolicyFor,
  routingStateFromThread,
  runtimePolicyPayloadForThread,
} from './atlas-ai/AtlasAiRoutingModel'
import {
  bootstrapRetryResultMessage,
  inboxItemIdFromThread,
  isOperationalContextThread,
  operationalBootstrapStatus,
} from '../../lib/atlasOperationalBootstrap'
import {
  selectAtlasAiDomainFlow,
} from '../../lib/atlasAiDomainCatalog'

type VoiceRuntimeTurn = {
  sessionId: string
  turnId: string
  envelopeId?: string
  receiptId?: string
  startedAt?: number
}

type MobileVoiceInterruptPayload = Parameters<typeof interruptMobileVoiceTurn>[0]
type MobileVoiceRuntimeFailedPayload = Parameters<typeof recordMobileVoiceRuntimeFailed>[0]
type MobileVoiceTurnPlayedPayload = Parameters<typeof recordMobileVoiceTurnPlayed>[0]
type MobileVoiceTurnSynthesizedPayload = Parameters<typeof recordMobileVoiceTurnSynthesized>[0]

const ATLAS_VOICE_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
}

const MOBILE_VOICE_AUTO_START_DELAY_MS = 420
const MOBILE_VOICE_POST_PLAYBACK_MIC_GUARD_MS = 1_400
const MOBILE_VOICE_SPEECH_THRESHOLD_DB = -38
const MOBILE_VOICE_MIN_TURN_MS = 5_000
const MOBILE_VOICE_MIN_SPEECH_MS = 2_000
const MOBILE_VOICE_MIN_VOICED_METERING_SAMPLES = Math.ceil(MOBILE_VOICE_MIN_SPEECH_MS / 150)
const MOBILE_VOICE_SILENCE_AFTER_SPEECH_MS = 18_000
const MOBILE_VOICE_NO_SPEECH_TIMEOUT_MS = 90_000
const MOBILE_VOICE_MAX_TURN_AFTER_SPEECH_MS = 120_000
const MOBILE_VOICE_MAX_TURN_MS = 1_800_000
const MOBILE_VOICE_QUALITY_FIRST_ENDPOINTING = true

interface AtlasAiSheetProps {
  /**
   * 'sheet' (default) · usa SideSheet wrapper, abre/fecha via overlay state
   * (open === 'atlasAi'). Modo legacy preservado pra compat com chamadas
   * de outros lugares (push notifications, ✦ dock em outras rotas).
   * 'screen' · renderiza como tela fullscreen direto, sem overlay. Usado em
   * app/index.tsx (Atlas AI vira "home" do app · canon v18). Sempre visible,
   * "← Voltar" navega pra /edicao em vez de fechar overlay.
   */
  presentationMode?: 'sheet' | 'screen'
}

export function AtlasAiSheet({ presentationMode = 'sheet' }: AtlasAiSheetProps = {}) {
  const open = useOverlays((s) => s.open)
  const requestedThreadId = useOverlays((s) => s.atlasAiThreadId)
  const atlasAiOpenNonce = useOverlays((s) => s.atlasAiOpenNonce)
  const close = useOverlays((s) => s.close)
  const openConfirmDelete = useOverlays((s) => s.openConfirmDelete)
  // openDomain · canon Atlas · após captura de áudio do Modo Gravar, abre
  // a Domain Sheet "Categorizar + Elaborar" pra user escolher domain (ou Pular).
  const openDomain = useOverlays((s) => s.openDomain)
  // Em screen mode, sempre visible · em sheet mode, controlado pelo overlay state.
  const visible = presentationMode === 'screen' || open === 'atlasAi'
  const isScreen = presentationMode === 'screen'
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { showToast } = useShell()
  const router = useRouter()
  const pathname = usePathname()
  const scrollRef = useRef<FlatList<DisplayTurn>>(null)

  // v18 · Atlas AI vira a "home" navegacional (rota `/`).
  // "← Voltar" precisa ter destino editorial — antes do refator, fechar o
  // sheet revelava a home antiga (exemplar editorial) que estava por baixo.
  //
  // Comportamento context-aware:
  //   • presentationMode === 'screen' → SEMPRE navega pra /edicao
  //     (Atlas AI é tela primária, não há overlay pra fechar).
  //   • Se estamos em `/` em sheet mode → fecha sheet + navega pra /edicao.
  //   • Se estamos em outra rota (/inbox, /review, etc · sheet aberto via
  //     ✦ central do dock como overlay sobre essa tela) → só fecha o sheet,
  //     a tela por baixo reaparece naturalmente. Preserva UX "voltar pra
  //     onde estava".
  const closeAndGoBack = useCallback(() => {
    if (isScreen) {
      router.replace('/edicao')
      return
    }
    close()
    if (pathname === '/') {
      router.replace('/edicao')
    }
  }, [close, isScreen, pathname, router])

  const [draft, setDraft] = useState('')
  const [traces, setTraces] = useState<AtlasAiTrace[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [routing, setRouting] = useState<RoutingState>(ROUTING_DEFAULT)
  const [computeEffort, setComputeEffort] = useState<AtlasComputeEffortChoice>('auto')
  const [routingOpen, setRoutingOpen] = useState(false)
  // v18 · destinoOverride · canon Atlas Decide. Quando user tap em "trocar",
  // alterna entre captura/conversa. Tarefa/projeto são definidos depois,
  // durante curadoria da captura.
  const [destinoOverride, setDestinoOverride] = useState<DecideDestino | null>(null)

  // v18 · Modo Gravar enterprise (v3) · refator final com 5 mutex/sync fixes:
  //   · recordingActiveRef setado SÍNCRONO (race start fix)
  //   · recordOpInFlightRef mutex pra Send vs Cancel (race stop fix)
  //   · cleanup no unmount (unmount durante gravação)
  //   · sync recordingPaused com recorder.isRecording (state desync fix)
  //   · long-press respeita interactionLocked (lock fix)
  const [recordingActive, setRecordingActive] = useState(false)
  const [recordingPaused, setRecordingPaused] = useState(false)
  const composerRecorder = useAudioRecorder(ATLAS_VOICE_RECORDING_OPTIONS)
  const composerRecorderState = useAudioRecorderState(composerRecorder, 150)
  const recordingActiveRef = useRef(false)
  // Mutex pra Send/Cancel · enterprise canon · evita ambos rodarem juntos
  // se user tap em sequência rápida.
  const recordOpInFlightRef = useRef(false)
  const recordStartInFlightRef = useRef<Promise<boolean> | null>(null)
  // isMountedRef · evita setState em componente desmontado (React warning +
  // memory leak). Ativo em mount, false em cleanup. Setters checam antes.
  const isMountedRef = useRef(true)
  const createAudioCapture = useAtlasStore((s) => s.createAudioCapture)
  // createTextCapture · canon Atlas Decide · quando destino classificado é
  // 'captura', tap ✦ send NÃO invoca Atlas AI · cria text capture pro inbox
  // diretamente. Vocabulário: "captura passa por curadoria editorial via
  // Domain Sheet · não vira conversa".
  const createTextCapture = useAtlasStore((s) => s.createTextCapture)
  const [voiceModeOpen, setVoiceModeOpen] = useState(false)
  const [voiceModeState, setVoiceModeState] = useState<VoiceModeState>('listening')
  const [voiceSessionReady, setVoiceSessionReady] = useState(false)
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null)
  const [voiceSessionEnvelopeId, setVoiceSessionEnvelopeId] = useState<string | null>(null)
  const [voiceSessionReceiptId, setVoiceSessionReceiptId] = useState<string | null>(null)
  const [voiceLiveKitSession, setVoiceLiveKitSession] = useState<MobileVoiceLiveKitSession | null>(null)
  const [voiceStatusDetail, setVoiceStatusDetail] = useState<string | null>(null)
  const [voiceTraceId, setVoiceTraceId] = useState<string | null>(null)
  const [pendingVoiceAiInteraction, setPendingVoiceAiInteraction] = useState<{
    traceId: string
    threadId: string | null
  } | null>(null)
  const [pendingVoiceTraceLookup, setPendingVoiceTraceLookup] = useState<{
    clientId: string
    captureClientId?: string | null
    threadId: string | null
    runtimeTurn: VoiceRuntimeTurn
    startedAt: number
  } | null>(null)
  const [voiceTraceRuntimeTurns, setVoiceTraceRuntimeTurns] = useState<Record<string, VoiceRuntimeTurn>>({})

  // Mount tracking · setado true no mount, false no unmount.
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Helpers safe-setters · ignoram set quando unmounted.
  const safeSetRecordingActive = useCallback((value: boolean) => {
    if (isMountedRef.current) setRecordingActive(value)
  }, [])
  const safeSetRecordingPaused = useCallback((value: boolean) => {
    if (isMountedRef.current) setRecordingPaused(value)
  }, [])

  function resetVoiceEndpointingRefs() {
    voiceEndpointingInFlightRef.current = false
    voiceRecordingStartedAtRef.current = null
    voiceLastSpeechAtRef.current = null
    voiceLastMeteringSampleAtRef.current = null
    voiceSpeechMsRef.current = 0
  }

  function markVoiceRecordingStartedForEndpointing() {
    const now = Date.now()
    voiceEndpointingInFlightRef.current = false
    voiceRecordingStartedAtRef.current = now
    voiceLastSpeechAtRef.current = null
    voiceLastMeteringSampleAtRef.current = now
    voiceSpeechMsRef.current = 0
  }

  function stopAtlasVoicePlayback() {
    voiceAudioStopRef.current?.()
    voiceAudioStopRef.current = null
    const player = voiceAudioPlayerRef.current
    voiceAudioPlayerRef.current = null
    if (!player) return
    try {
      player.pause()
      player.remove()
    } catch {
      // Playback cleanup must never block closing/cancelling the voice session.
    }
  }

  async function playAtlasVoiceResponseAudio(
    audioBase64: string,
    audioHash: string,
    estimatedDurationMs: number,
    shouldContinue: () => boolean,
    registerPlayer?: (player: ReturnType<typeof createAudioPlayer>) => void,
  ): Promise<'done' | 'stopped' | 'cancelled'> {
    if (!shouldContinue()) return 'cancelled'

    const root = FileSystem.cacheDirectory ?? FileSystem.documentDirectory
    if (!root) {
      const error = new Error('Não há cache local para reproduzir a voz do Atlas.')
      error.name = 'AtlasVoiceAudioCacheUnavailable'
      throw error
    }

    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
    const uri = `${root}atlas-voice-${audioHash}.mp3`
    await FileSystem.writeAsStringAsync(uri, audioBase64, { encoding: FileSystem.EncodingType.Base64 })
    if (!shouldContinue()) return 'cancelled'

    return new Promise((resolve, reject) => {
      let settled = false
      const player = createAudioPlayer({ uri }, {
        updateInterval: 100,
        keepAudioSessionActive: true,
      })
      voiceAudioPlayerRef.current = player
      registerPlayer?.(player)
      let subscription: { remove: () => void } | null = null
      let timeout: ReturnType<typeof setTimeout> | null = null
      let poll: ReturnType<typeof setInterval> | null = null

      const settle = (result: 'done' | 'stopped' | 'cancelled', error?: unknown) => {
        if (settled) return
        settled = true
        if (timeout) clearTimeout(timeout)
        if (poll) clearInterval(poll)
        voiceAudioStopRef.current = null
        try {
          subscription?.remove()
        } catch {
          // Listener removal is best-effort; player cleanup below is authoritative.
        }
        if (voiceAudioPlayerRef.current === player) {
          voiceAudioPlayerRef.current = null
        }
        try {
          player.remove()
        } catch {
          // The player may already be removed by an interruption.
        }
        if (error) {
          reject(error instanceof Error ? error : new Error('Falha ao reproduzir voz premium do Atlas.'))
          return
        }
        resolve(result)
      }

      timeout = setTimeout(() => {
        const error = new Error('Tempo limite ao reproduzir voz premium do Atlas.')
        error.name = 'AtlasVoicePremiumPlaybackTimeout'
        settle('stopped', error)
      }, Math.max(20000, Math.min(10 * 60_000, estimatedDurationMs + 30000)))

      subscription = player.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          settle('done')
        }
      })
      const playbackStartedAt = Date.now()
      poll = setInterval(() => {
        if (!shouldContinue()) {
          settle('cancelled')
          return
        }
        const durationMs = Number.isFinite(player.duration) && player.duration > 0
          ? player.duration * 1000
          : estimatedDurationMs
        const currentTimeMs = Math.max(0, player.currentTime * 1000)
        const playedLongEnough = currentTimeMs >= Math.max(150, durationMs - 250)
        const stoppedAfterStarting = !player.playing && Date.now() - playbackStartedAt > 450
        if (playedLongEnough || stoppedAfterStarting) {
          settle('done')
        }
      }, 100)

      voiceAudioStopRef.current = () => settle('stopped')

      try {
        player.play()
      } catch (error) {
        settle('stopped', error)
      }
    })
  }

  function resetVoiceRuntimeRefs(options: {
    stopSpeech?: boolean
    resetSessionStartPromise?: boolean
  } = {}) {
    if (voiceAutoStartTimerRef.current) {
      clearTimeout(voiceAutoStartTimerRef.current)
      voiceAutoStartTimerRef.current = null
    }
    voiceEndpointingInFlightRef.current = false
    voiceRecordingStartedAtRef.current = null
    voiceLastSpeechAtRef.current = null
    voiceLastMeteringSampleAtRef.current = null
    voiceSpeechMsRef.current = 0
    if (voiceSessionStartWatchdogRef.current) {
      clearTimeout(voiceSessionStartWatchdogRef.current)
      voiceSessionStartWatchdogRef.current = null
    }
    voiceSessionStartTimedOutRef.current = false
    voiceSynthesisRecordedRef.current.clear()
    voicePlaybackRecordedRef.current.clear()
    voiceInterruptionRecordedRef.current.clear()
    voiceTerminalFailureRecordedRef.current.clear()
    voiceFirstAssistantDeltaRecordedRef.current.clear()
    voiceTraceRuntimeTurnsRef.current = {}
    voicePlaybackStartedAtRef.current.clear()
    voiceSpeechLifecycleRef.current = null
    voiceLastPlaybackEndedAtRef.current = null
    if (options.stopSpeech !== false) {
      stopAtlasVoicePlayback()
    }
    if (options.resetSessionStartPromise === true) {
      voiceSessionStartPromiseRef.current = null
    }
  }

  const recordVoiceReadinessSnapshot = useCallback(async (
    phase: 'open' | 'close' | 'foreground',
    sessionId?: string | null,
  ) => {
    try {
      const readiness = await getMobileVoiceReadiness({ hours: 24 })
      const summary = mobileVoiceReadinessSummary(readiness)
      await recordAtlasAiEvent({
        eventName: 'mobile_voice_readiness_snapshot',
        metadata: {
          phase,
          session_id: sessionId ?? null,
          status: summary.status,
          score: summary.score,
          ready: summary.ready,
          ready_for_promotion: summary.readyForPromotion,
          healthy_loop_ready: summary.healthyLoopReady,
          interruption_drill_recorded: summary.interruptionDrillRecorded,
          redacted_failure_drill_recorded: summary.redactedFailureDrillRecorded,
          latency_slo_clean: summary.latencySloClean,
          missing_events: summary.missingEvents,
          missing_promotion_events: summary.missingPromotionEvents,
          recommended_action: summary.recommendedAction,
        },
      })
    } catch (error) {
      await recordAtlasAiEvent({
        eventName: 'mobile_voice_readiness_snapshot_failed',
        metadata: {
          phase,
          session_id: sessionId ?? null,
          error_class: errorClassFromUnknown(error),
        },
      })
    }
  }, [])
  const recordMobileVoiceInterruption = useCallback((
    payload: MobileVoiceInterruptPayload,
    metadata: { source: 'barge_in' | 'close'; traceId?: string | null; pendingStage?: string | null },
  ) => {
    const startedAt = Date.now()
    void interruptMobileVoiceTurn(payload)
      .then(() => recordAtlasAiEvent({
        eventName: 'mobile_voice_turn_interruption_recorded',
        trace_id: metadata.traceId ?? undefined,
        metadata: {
          source: metadata.source,
          session_id: payload.session_id,
          turn_id: payload.turn_id,
          reason: payload.reason ?? null,
          interrupted_stage: payload.interrupted_stage ?? null,
          pending_stage: metadata.pendingStage ?? null,
          played_duration_ms: payload.played_duration_ms ?? null,
          callback_latency_ms: payload.latency_ms ?? null,
          latency_ms: Math.max(0, Math.round(Date.now() - startedAt)),
        },
      }))
      .catch((error) => {
        void recordAtlasAiEvent({
          eventName: 'mobile_voice_turn_interruption_failed',
          trace_id: metadata.traceId ?? undefined,
          metadata: {
            source: metadata.source,
            session_id: payload.session_id,
            turn_id: payload.turn_id,
            reason: payload.reason ?? null,
            interrupted_stage: payload.interrupted_stage ?? null,
            pending_stage: metadata.pendingStage ?? null,
            error_class: errorClassFromUnknown(error),
            latency_ms: Math.max(0, Math.round(Date.now() - startedAt)),
          },
        })
      })
  }, [])
  const recordMobileVoiceSynthesis = useCallback((
    payload: MobileVoiceTurnSynthesizedPayload,
    metadata: { traceId?: string | null } = {},
  ) => {
    const startedAt = Date.now()
    void recordMobileVoiceTurnSynthesized(payload)
      .then(() => recordAtlasAiEvent({
        eventName: 'mobile_voice_turn_synthesis_recorded',
        trace_id: metadata.traceId ?? undefined,
        metadata: {
          session_id: payload.session_id,
          turn_id: payload.turn_id,
          tts_provider: payload.tts_provider ?? null,
          audio_duration_ms: payload.audio_duration_ms ?? null,
          callback_latency_ms: payload.latency_ms ?? null,
          response_text_hash_present: typeof payload.response_text_hash === 'string' && payload.response_text_hash.trim().length > 0,
          latency_ms: Math.max(0, Math.round(Date.now() - startedAt)),
        },
      }))
      .catch((error) => {
        void recordMobileVoiceRuntimeFailedWithError({
          session_id: payload.session_id,
          envelope_id: payload.envelope_id,
          receipt_id: payload.receipt_id,
          turn_id: payload.turn_id,
          failure_code: 'mobile_voice_synthesis_receipt_failed',
          error_class: errorClassFromUnknown(error),
          latency_ms: Math.max(0, Math.round(Date.now() - startedAt)),
        }, error).catch(() => {})
      })
  }, [])
  const recordMobileVoicePlayback = useCallback((
    payload: MobileVoiceTurnPlayedPayload,
    metadata: { traceId?: string | null } = {},
  ) => {
    const startedAt = Date.now()
    void recordMobileVoiceTurnPlayed(payload)
      .then(() => recordAtlasAiEvent({
        eventName: 'mobile_voice_turn_playback_recorded',
        trace_id: metadata.traceId ?? undefined,
        metadata: {
          session_id: payload.session_id,
          turn_id: payload.turn_id,
          played_duration_ms: payload.played_duration_ms ?? null,
          callback_latency_ms: payload.latency_ms ?? null,
          latency_ms: Math.max(0, Math.round(Date.now() - startedAt)),
        },
      }))
      .catch((error) => {
        void recordMobileVoiceRuntimeFailedWithError({
          session_id: payload.session_id,
          envelope_id: payload.envelope_id,
          receipt_id: payload.receipt_id,
          turn_id: payload.turn_id,
          failure_code: 'mobile_voice_playback_receipt_failed',
          error_class: errorClassFromUnknown(error),
          latency_ms: Math.max(0, Math.round(Date.now() - startedAt)),
        }, error).catch(() => {})
      })
  }, [])
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  // Slice 6n · Reanimated shared value para keyboard offset · animação
  // SMOOTH matching iOS native curve (vs setState raw que muda instant).
  // Premium: paddingBottom transita via spring easing canon iOS UIView
  // animateWithKeyboard. Funciona dentro do SideSheet (KeyboardAvoidingView
  // não funciona aqui).
  const keyboardHeightShared = useSharedValue(0)
  const [pending, setPending] = useState<PendingTurn | null>(null)
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null)
  const [currentThread, setCurrentThread] = useState<AtlasAiThread | null>(null)
  const [sessionState, setSessionState] = useState<AtlasAiSessionState | null>(null)
  const [threadList, setThreadList] = useState<AtlasAiThread[]>([])
  const [threadHistoryOpen, setThreadHistoryOpen] = useState(false)
  // ROUND 3 · queryClient pra invalidar/popular cache de threads
  // (substitui a soup de useEffects por uma única fonte de verdade
  // react-query). Streaming ainda usa setThreadList local, mas
  // queryClient mantém cache fresco para próximos opens.
  const queryClient = useQueryClient()
  const [providerStatus, setProviderStatus] = useState<AiProvidersStatusResponse | null>(null)
  const [domainCatalog, setDomainCatalog] = useState<AtlasAiDomainCatalogResponse | null>(null)
  const [observability, setObservability] = useState<AiObservabilityResponse | null>(null)
  const [qualityActions, setQualityActions] = useState<AtlasAiQualityAction[]>([])
  const [operationBusy, setOperationBusy] = useState<string | null>(null)
  const [bootstrapRetrying, setBootstrapRetrying] = useState(false)
  const [routingHydrated, setRoutingHydrated] = useState(false)
  const [computeEffortHydrated, setComputeEffortHydrated] = useState(false)
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
  const [atlasWarmupReady, setAtlasWarmupReady] = useState(false)
  // v18 · Reset destinoOverride quando draft esvazia · próxima conversa começa
  // limpa, classifier auto retoma. Mantém override enquanto há texto pra que
  // a escolha do user persista durante edição.
  useEffect(() => {
    if (draft.trim().length === 0 && destinoOverride !== null) {
      setDestinoOverride(null)
    }
  }, [draft, destinoOverride])

  // v18 · Modo Gravar handlers · enterprise tap-lock (v2).
  // Race condition fix: recordingActiveRef.current = true SÍNCRONO antes
  // de qualquer await · evita duplicate recordings se long-press disparar
  // múltiplas vezes em sequência (ex: user nervoso). Subsequent calls são
  // ignoradas pelo guard inicial.
  const handleComposerRecordStart = useCallback(async (): Promise<boolean> => {
    if (recordingActiveRef.current || recordStartInFlightRef.current) return false
    // ✅ FIX RACE CONDITION · marca como ativo IMEDIATAMENTE (síncrono)
    // Próximas chamadas vão sair no guard acima · zero duplicação.
    recordingActiveRef.current = true
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})

    const start = (async (): Promise<boolean> => {
      try {
        const permission = await requestRecordingPermissionsAsync()
        if (!permission.granted) {
          recordingActiveRef.current = false  // rollback
          showToast('Permissão de microfone necessária pra gravar')
          return false
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
        await composerRecorder.prepareToRecordAsync()
        if (!recordingActiveRef.current) {
          void setAudioModeAsync({ allowsRecording: false }).catch(() => {})
          return false
        }
        composerRecorder.record()
        setRecordingActive(true)
      setRecordingPaused(false)
      if (voiceModeOpenRef.current) {
        markVoiceRecordingStartedForEndpointing()
        setVoiceStatusDetail('Fale normalmente. Eu espero pausas longas antes de enviar.')
      }
      return true
      } catch (err) {
        recordingActiveRef.current = false  // rollback em caso de erro
        const msg = err instanceof Error ? err.message : 'Falha ao iniciar gravação'
        showToast(msg)
        void setAudioModeAsync({ allowsRecording: false }).catch(() => {})
        return false
      }
    })()

    recordStartInFlightRef.current = start
    try {
      return await start
    } finally {
      if (recordStartInFlightRef.current === start) {
        recordStartInFlightRef.current = null
      }
    }
  }, [composerRecorder, showToast])

  // Pause toggle · canon iOS Voice Memo · pausa/continua a gravação
  // sem perder o que já foi gravado. Quando paused, recorder.pause();
  // ao continuar, recorder.record() continua do mesmo arquivo.
  const handleComposerRecordPauseToggle = useCallback(() => {
    if (!recordingActiveRef.current) return
    Haptics.selectionAsync().catch(() => {})
    try {
      if (composerRecorderState.isRecording) {
        composerRecorder.pause()
        setRecordingPaused(true)
      } else {
        composerRecorder.record()
        setRecordingPaused(false)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao pausar/continuar'
      showToast(msg)
    }
  }, [composerRecorder, composerRecorderState.isRecording, showToast])

  const handleComposerRecordCancel = useCallback(async () => {
    // ✅ FIX MUTEX · evita rodar concurrently com Send
    if (recordOpInFlightRef.current) return
    recordOpInFlightRef.current = true
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    await recordStartInFlightRef.current?.catch(() => {})
    safeSetRecordingActive(false)
    safeSetRecordingPaused(false)
    if (!recordingActiveRef.current) {
      recordOpInFlightRef.current = false
      return
    }
    recordingActiveRef.current = false
    try {
      if (composerRecorderState.isRecording) {
        await composerRecorder.stop()
      }
    } catch {
      // ignore — só queremos descartar
    } finally {
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {})
      if (voiceModeOpenRef.current) {
        resetVoiceEndpointingRefs()
      }
      recordOpInFlightRef.current = false
    }
  }, [composerRecorder, composerRecorderState.isRecording, safeSetRecordingActive, safeSetRecordingPaused])

  const handleComposerRecordSend = useCallback(async () => {
    // ✅ FIX MUTEX · evita rodar concurrently com Cancel
    if (recordOpInFlightRef.current) return
    recordOpInFlightRef.current = true
    await recordStartInFlightRef.current?.catch(() => {})

    if (!recordingActiveRef.current) {
      safeSetRecordingActive(false)
      safeSetRecordingPaused(false)
      recordOpInFlightRef.current = false
      return
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    const durationMs = composerRecorderState.durationMillis
    safeSetRecordingActive(false)
    safeSetRecordingPaused(false)
    recordingActiveRef.current = false
    resetVoiceEndpointingRefs()

    let fileUri: string | null = null
    try {
      if (composerRecorderState.isRecording || composerRecorderState.url) {
        await composerRecorder.stop()
      }
      fileUri = (() => {
        try { return composerRecorder.uri } catch { return null }
      })() ?? composerRecorderState.url
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao parar gravação'
      showToast(msg)
    } finally {
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {})
      voiceEndpointingInFlightRef.current = false
      recordOpInFlightRef.current = false
    }

    if (!fileUri) {
      showToast('Gravação não gerou arquivo')
      return
    }

    // ✅ Canon mockup restaurado · Domain Sheet "Categorizar + Elaborar"
    // (i. Sobre o quê é? + ii. O que fazer?). Áudio sempre vai pro inbox
    // como captura — destino editorial é metadata pro Atlas Decide processar
    // depois (estruturar como tarefa/projeto/conversa).
    openDomain((picked, destino) => {
      void (async () => {
        const finalDomain = picked ?? 'outro'
        const finalDestino = destino ?? 'salvar'
        const voiceTurnId = newMobileVoiceRuntimeId('mobile_voice_turn')
        const voiceClientId = voiceSessionId ? `voice:${voiceSessionId}:${voiceTurnId}` : null
        const voiceStartedAt = Date.now()
        try {
          if (voiceSessionId && finalDestino === 'conversar') {
            if (voiceClientId) {
              setPendingVoiceTraceLookup({
                clientId: voiceClientId,
                threadId: currentThreadId,
                runtimeTurn: {
                  sessionId: voiceSessionId,
                  turnId: voiceTurnId,
                  envelopeId: voiceSessionEnvelopeId ?? undefined,
                  receiptId: voiceSessionReceiptId ?? undefined,
                  startedAt: voiceStartedAt,
                },
                startedAt: voiceStartedAt,
              })
            }
          }
          const captureClientId = await createAudioCapture({
            domain: finalDomain,
            fileUri: fileUri!,
            durationMs,
            metadata: {
              captureMode: 'audio',
              captureSurface: 'atlas_ai_composer_long_press',
              source: 'modo_gravar_composer',
              destino: finalDestino,
              voiceSessionId,
              voice_realtime_dispatch: voiceSessionId && finalDestino === 'conversar'
                ? {
                    dispatch_to_ai: true,
                    allow_transcript_persistence: true,
                    session_id: voiceSessionId,
                    envelope_id: voiceSessionEnvelopeId,
                    receipt_id: voiceSessionReceiptId,
                    turn_id: voiceTurnId,
                    ai_thread_id: currentThreadId,
                    domain_hint: finalDomain,
                    flow_hint: 'voice.push_to_talk',
                    language: 'pt-BR',
                    client_surface: 'mobile',
                    transport: 'mobile_push_to_talk',
                    runtime: 'livekit_agents_sdk',
                    privacy_class: 'p3_audio',
                  }
                : undefined,
            },
          })
          if (voiceSessionId && finalDestino === 'conversar' && voiceClientId) {
            setPendingVoiceTraceLookup((current) =>
              current?.clientId === voiceClientId
                ? { ...current, captureClientId }
                : current,
            )
          }
          showToast(finalDestino === 'conversar' ? 'Turno de voz registrado' : 'Áudio capturado')
        } catch (err) {
          if (voiceSessionId && finalDestino === 'conversar' && voiceClientId) {
            setPendingVoiceTraceLookup((current) => current?.clientId === voiceClientId ? null : current)
            void recordMobileVoiceRuntimeFailedWithError({
              session_id: voiceSessionId,
              envelope_id: voiceSessionEnvelopeId ?? undefined,
              receipt_id: voiceSessionReceiptId ?? undefined,
              turn_id: voiceTurnId,
              failure_code: 'mobile_capture_dispatch_failed',
              error_class: errorClassFromUnknown(err),
              latency_ms: Math.max(0, Math.round(Date.now() - voiceStartedAt)),
            }, err).catch(() => {})
          }
          const msg = err instanceof Error ? err.message : 'Falha ao salvar captura'
          showToast(msg)
        }
      })()
    })
  }, [
    composerRecorder,
    composerRecorderState,
    createAudioCapture,
    openDomain,
    showToast,
    safeSetRecordingActive,
    safeSetRecordingPaused,
    voiceSessionEnvelopeId,
    voiceSessionId,
    voiceSessionReceiptId,
    currentThreadId,
  ])

  // ✅ FIX 2 · Cleanup no unmount · garante que gravação ativa pare quando
  // AtlasAi desmonta (user navega, app vai pra background, etc). Evita
  // memory leak + libera audioMode global pra outros áudios funcionarem.
  useEffect(() => {
    return () => {
      if (recordingActiveRef.current) {
        recordingActiveRef.current = false
        void (async () => {
          try {
            await composerRecorder.stop()
          } catch {
            // ignore
          }
          await setAudioModeAsync({ allowsRecording: false }).catch(() => {})
        })()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ✅ FIX 4 · Sync recordingPaused com recorder real · se recorder pausa
  // por timeout interno do expo-audio sem que tenhamos chamado pause(),
  // sincroniza React state (evita UI mostrar "gravando" quando está paused).
  useEffect(() => {
    if (!recordingActive) return
    const realPaused = !composerRecorderState.isRecording
    if (realPaused !== recordingPaused) {
      safeSetRecordingPaused(realPaused)
    }
  }, [recordingActive, recordingPaused, composerRecorderState.isRecording, safeSetRecordingPaused])

  const openVoiceMode = useCallback(async () => {
    const blockReason = mobileVoiceOpenBlockReason({
      modeOpen: voiceModeOpen,
      sessionId: voiceSessionId,
      recordingActive: recordingActiveRef.current,
      ending: voiceEndingRef.current,
    })
    if (blockReason) {
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_open_ignored',
        metadata: {
          reason: blockReason,
          session_id: voiceSessionId,
          session_ready: voiceSessionReadyRef.current,
          recording_active: recordingActiveRef.current,
        },
      })
      return
    }

    let mobileSession = getMobileDeviceSession()
    if (!mobileSession) {
      try {
        mobileSession = await recoverMobileDeviceSession()
      } catch (error) {
        void recordAtlasAiEvent({
          eventName: 'mobile_voice_pairing_check_failed',
          metadata: {
            error_class: errorClassFromUnknown(error),
            status: error instanceof AtlasApiError ? error.status : null,
          },
        })
      }
    }

    if (!mobileSession) {
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_open_blocked',
        metadata: { reason: 'mobile_pairing_required' },
      })
      Alert.alert(
        'Pareamento necessário',
        'Para usar a voz em tempo real, este iPhone precisa estar pareado com o Atlas Server.',
        [
          { text: 'Agora não', style: 'cancel' },
          {
            text: 'Parear agora',
            onPress: () => {
              router.push('/mobile-pairing')
            },
          },
        ],
      )
      return
    }

    const sessionId = newMobileVoiceRuntimeId('mobile_voice')
    const envelopeId = newMobileVoiceRuntimeId('mobile_voice_env')
    const receiptId = newMobileVoiceRuntimeId('mobile_voice_receipt')
    voiceSessionIdRef.current = sessionId
    voiceSessionReadyRef.current = false
    setVoiceSessionId(sessionId)
    setVoiceSessionEnvelopeId(envelopeId)
    setVoiceSessionReceiptId(receiptId)
    setVoiceLiveKitSession(null)
    setVoiceStatusDetail('Conectando ao Atlas Voice.')
    setVoiceSessionReady(false)
    setVoiceTraceId(null)
    setPendingVoiceTraceLookup(null)
    setPendingVoiceAiInteraction(null)
    setVoiceTraceRuntimeTurns({})
    resetVoiceRuntimeRefs()
    if (voiceFailureTimerRef.current) {
      clearTimeout(voiceFailureTimerRef.current)
      voiceFailureTimerRef.current = null
    }
    setVoiceModeState('starting')
    setVoiceModeOpen(true)
    void recordVoiceReadinessSnapshot('open', sessionId)

    const sessionStartedAt = Date.now()
    const startPromise = startMobileVoiceSession({
      session_id: sessionId,
      envelope_id: envelopeId,
      receipt_id: receiptId,
      participant_identity: 'mobile:vitor',
      transport: 'livekit_webrtc',
    })
    voiceSessionStartPromiseRef.current = startPromise
    voiceSessionStartTimedOutRef.current = false
    voiceSessionStartWatchdogRef.current = setTimeout(() => {
      if (voiceSessionStartPromiseRef.current !== startPromise || voiceSessionIdRef.current !== sessionId) return
      voiceSessionStartTimedOutRef.current = true
      voiceSessionReadyRef.current = false
      setVoiceSessionReady(false)
      setVoiceLiveKitSession(null)
      setVoiceStatusDetail(null)
      setVoiceModeState('failed')
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_session_start_timeout',
        metadata: {
          session_id: sessionId,
          latency_ms: Math.max(0, Math.round(Date.now() - sessionStartedAt)),
        },
      })
      showToast('Atlas ainda está preparando a voz. Tente abrir novamente em instantes.')
    }, 12_000)

    void startPromise.then((response) => {
      if (voiceSessionStartPromiseRef.current !== startPromise || voiceSessionIdRef.current !== sessionId) {
        void recordAtlasAiEvent({
          eventName: 'mobile_voice_session_start_response_ignored',
          metadata: {
            session_id: sessionId,
            current_session_id: voiceSessionIdRef.current,
            promise_current: voiceSessionStartPromiseRef.current === startPromise,
            latency_ms: Math.max(0, Math.round(Date.now() - sessionStartedAt)),
          },
        })
        return
      }
      const timedOut = voiceSessionStartTimedOutRef.current
      if (voiceSessionStartWatchdogRef.current) {
        clearTimeout(voiceSessionStartWatchdogRef.current)
        voiceSessionStartWatchdogRef.current = null
      }
      const outcome = mobileVoiceSessionStartOutcome(response, {
        requestedSessionId: sessionId,
        timedOut,
        startedAtMs: sessionStartedAt,
      })
      const telemetry = outcome.telemetry
      const resolvedSessionId = outcome.resolvedSessionId
      const liveKitSession = outcome.sessionReady ? mobileVoiceLiveKitSessionFromStartResponse(response) : null
      setVoiceSessionId(resolvedSessionId)
      voiceSessionReadyRef.current = outcome.sessionReady
      setVoiceSessionReady(outcome.sessionReady)
      setVoiceLiveKitSession(liveKitSession)
      setVoiceStatusDetail(liveKitSession ? 'Conectando ao LiveKit.' : voiceSessionStartFailureDetail(telemetry.status, telemetry.tokenStatus))
      setVoiceModeState(outcome.sessionReady ? 'connecting' : outcome.modeState)
      void recordAtlasAiEvent({
        eventName: outcome.eventName,
        metadata: {
          session_id: telemetry.sessionId,
          status: telemetry.status,
          latency_ms: telemetry.latencyMs,
          runtime: telemetry.runtime,
          transport: telemetry.transport,
          room_name: telemetry.roomName,
          token_status: telemetry.tokenStatus,
          livekit_url_provided: telemetry.livekitUrlProvided,
          participant_token_provided: telemetry.participantTokenProvided,
        },
      })
      if (outcome.cleanupTimedOutSession) {
        voiceSessionIdRef.current = null
        setVoiceSessionId(null)
        void endMobileVoiceSession({
          session_id: resolvedSessionId,
          envelope_id: envelopeId,
          receipt_id: receiptId,
          reason: 'session_start_timeout_cleanup',
        }).then(() => recordAtlasAiEvent({
          eventName: 'mobile_voice_session_start_timeout_cleanup_succeeded',
          metadata: {
            session_id: resolvedSessionId,
            latency_ms: Math.max(0, Math.round(Date.now() - sessionStartedAt)),
          },
        })).catch((error) => {
          void recordAtlasAiEvent({
            eventName: 'mobile_voice_session_start_timeout_cleanup_failed',
            metadata: {
              session_id: resolvedSessionId,
              error_class: errorClassFromUnknown(error),
              latency_ms: Math.max(0, Math.round(Date.now() - sessionStartedAt)),
            },
          })
        })
      }
    }).catch((error) => {
      if (voiceSessionStartPromiseRef.current !== startPromise || voiceSessionIdRef.current !== sessionId) {
        void recordAtlasAiEvent({
          eventName: 'mobile_voice_session_start_error_ignored',
          metadata: {
            session_id: sessionId,
            current_session_id: voiceSessionIdRef.current,
            promise_current: voiceSessionStartPromiseRef.current === startPromise,
            error_class: errorClassFromUnknown(error),
            latency_ms: Math.max(0, Math.round(Date.now() - sessionStartedAt)),
          },
        })
        return
      }
      if (voiceSessionStartWatchdogRef.current) {
        clearTimeout(voiceSessionStartWatchdogRef.current)
        voiceSessionStartWatchdogRef.current = null
      }
      voiceSessionReadyRef.current = false
      setVoiceSessionReady(false)
      setVoiceModeState('failed')
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_session_start_failed',
        metadata: {
          session_id: sessionId,
          latency_ms: Math.max(0, Math.round(Date.now() - sessionStartedAt)),
          error_class: errorClassFromUnknown(error),
          status: error instanceof AtlasApiError ? error.status : null,
          message: error instanceof Error ? error.message : null,
        },
      })
      if (error instanceof AtlasApiError && error.status === 401) {
        showToast('Pareamento necessário para iniciar voz em tempo real.')
        router.push('/mobile-pairing')
      } else {
        showToast(humanAiError(error, 'LiveKit não iniciou a sessão de voz.'))
      }
    }).finally(() => {
      if (voiceSessionStartWatchdogRef.current) {
        clearTimeout(voiceSessionStartWatchdogRef.current)
        voiceSessionStartWatchdogRef.current = null
      }
      if (voiceSessionStartPromiseRef.current === startPromise) {
        voiceSessionStartPromiseRef.current = null
      }
    })
  }, [recordVoiceReadinessSnapshot, router, showToast, voiceModeOpen, voiceSessionId])

  const endVoiceMode = useCallback(async (reason: 'operator_closed_mobile_voice' | 'app_backgrounded_mobile_voice' | 'atlas_ai_sheet_hidden_mobile_voice') => {
    if (voiceEndingRef.current) {
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_session_close_ignored',
        metadata: {
          reason,
          ignore_reason: 'close_already_in_progress',
          session_id: voiceSessionIdRef.current,
        },
      })
      return
    }
    voiceEndingRef.current = true

    const sessionId = voiceSessionId
    const sessionStartPromise = voiceSessionStartPromiseRef.current
    let closeStrategy = mobileVoiceSessionCloseStrategy({
      sessionId,
      sessionReady: voiceSessionReadyRef.current,
      startInFlight: sessionStartPromise != null,
    })
    const envelopeId = voiceSessionEnvelopeId ?? undefined
    const receiptId = voiceSessionReceiptId ?? undefined
    const closeStartedAt = Date.now()
    void recordAtlasAiEvent({
      eventName: 'mobile_voice_session_close_requested',
      metadata: {
        session_id: sessionId,
        reason,
        close_strategy: closeStrategy,
        session_ready: voiceSessionReadyRef.current,
        start_in_flight: sessionStartPromise != null,
        recording_active: recordingActiveRef.current,
      },
    })
    const traceId = voiceTraceId
    const runtimeTurn = traceId ? voiceTraceRuntimeTurns[traceId] : null
    const pendingLookupRuntimeTurn = pendingVoiceTraceLookup?.runtimeTurn ?? null
    const pendingAiRuntimeTurn = pendingVoiceAiInteraction?.traceId
      ? voiceTraceRuntimeTurns[pendingVoiceAiInteraction.traceId]
      : null
    const closeRuntimeTurn = runtimeTurn ?? pendingAiRuntimeTurn ?? pendingLookupRuntimeTurn
    const trace = traceId ? activeTraceRef.current : null
    const jobs = trace?.id === traceId
      ? trace.jobs?.length
        ? trace.jobs
        : trace.job
          ? [trace.job]
          : []
      : []
    const cancellableJobs = jobs.filter((job) => ['queued', 'processing', 'awaiting_user_choice'].includes(job.status))

    if (recordingActiveRef.current) {
      const discardedTurnId = newMobileVoiceRuntimeId('mobile_voice_turn_discarded')
      const discardStartedAt = Date.now()
      recordingActiveRef.current = false
      safeSetRecordingActive(false)
      safeSetRecordingPaused(false)
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_recording_discard_on_close_requested',
        metadata: {
          session_id: sessionId,
          turn_id: discardedTurnId,
          reason,
          close_strategy: closeStrategy,
        },
      })
      void composerRecorder.stop()
        .then(() => recordAtlasAiEvent({
          eventName: 'mobile_voice_recording_discard_on_close_succeeded',
          metadata: {
            session_id: sessionId,
            turn_id: discardedTurnId,
            reason,
            latency_ms: Math.max(0, Math.round(Date.now() - discardStartedAt)),
          },
        }))
        .catch((error) => {
          void recordAtlasAiEvent({
            eventName: 'mobile_voice_recording_discard_on_close_failed',
            metadata: {
              session_id: sessionId,
              turn_id: discardedTurnId,
              reason,
              error_class: errorClassFromUnknown(error),
              latency_ms: Math.max(0, Math.round(Date.now() - discardStartedAt)),
            },
          })
        })
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {})
    }

    setVoiceModeOpen(false)
    voiceSessionIdRef.current = null
    voiceSessionReadyRef.current = false
    setVoiceSessionReady(false)
    setVoiceSessionId(null)
    setVoiceSessionEnvelopeId(null)
    setVoiceSessionReceiptId(null)
    setVoiceLiveKitSession(null)
    setVoiceStatusDetail(null)
    setVoiceTraceId(null)
    setPendingVoiceTraceLookup(null)
    setPendingVoiceAiInteraction(null)
    setVoiceTraceRuntimeTurns({})
    if (voiceFailureTimerRef.current) {
      clearTimeout(voiceFailureTimerRef.current)
      voiceFailureTimerRef.current = null
    }

    if (closeStrategy === 'skip_no_session' || !sessionId) {
      resetVoiceRuntimeRefs()
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_session_close_skipped',
        metadata: {
          session_id: sessionId,
          reason,
          close_strategy: closeStrategy,
          latency_ms: Math.max(0, Math.round(Date.now() - closeStartedAt)),
        },
      })
      voiceEndingRef.current = false
      return
    }

    const lifecycleKey = traceId && runtimeTurn ? voiceTurnLifecycleKey(runtimeTurn, traceId) : null
    const shouldRecordCloseInterruption = mobileVoiceShouldRecordInterruption({
      hasRuntimeTurn: closeRuntimeTurn != null,
      hasLifecycleKey: lifecycleKey != null,
      assistantActive: cancellableJobs.length > 0,
      pendingTraceLookup: pendingVoiceTraceLookup != null,
      pendingAiInteraction: pendingVoiceAiInteraction != null,
      state: voiceModeState,
      playbackRecorded: lifecycleKey ? voicePlaybackRecordedRef.current.has(lifecycleKey) : false,
      interruptionRecorded: lifecycleKey ? voiceInterruptionRecordedRef.current.has(lifecycleKey) : false,
    })
    if (closeRuntimeTurn && shouldRecordCloseInterruption) {
      let playedDurationMs: number | undefined
      let latencyMs: number | undefined
      if (lifecycleKey) {
        const playbackStartedAt = voicePlaybackStartedAtRef.current.get(lifecycleKey)
        if (playbackStartedAt != null) {
          playedDurationMs = Math.max(0, Math.round(Date.now() - playbackStartedAt))
          voicePlaybackStartedAtRef.current.delete(lifecycleKey)
        }
        if (voiceSpeechLifecycleRef.current === lifecycleKey) {
          const stopRequestedAt = Date.now()
          voiceSpeechLifecycleRef.current = null
          stopAtlasVoicePlayback()
          latencyMs = Math.max(0, Math.round(Date.now() - stopRequestedAt))
        }
        voicePlaybackRecordedRef.current.add(lifecycleKey)
        voiceInterruptionRecordedRef.current.add(lifecycleKey)
      }
      if (pendingVoiceTraceLookup) {
        latencyMs = Math.max(0, Math.round(Date.now() - pendingVoiceTraceLookup.startedAt))
      } else if (pendingAiRuntimeTurn?.startedAt != null) {
        latencyMs = Math.max(0, Math.round(Date.now() - pendingAiRuntimeTurn.startedAt))
      }
      recordMobileVoiceInterruption({
        session_id: closeRuntimeTurn.sessionId,
        envelope_id: closeRuntimeTurn.envelopeId ?? envelopeId,
        receipt_id: closeRuntimeTurn.receiptId ?? receiptId,
        turn_id: closeRuntimeTurn.turnId,
        reason,
        interrupted_stage: mobileVoiceInterruptionStage({
          assistantStreaming: cancellableJobs.length > 0,
          transcriptionPending: pendingVoiceTraceLookup != null,
          assistantThinking: pendingVoiceAiInteraction != null,
          state: voiceModeState,
        }),
        interruption_source: 'mobile',
        played_duration_ms: playedDurationMs,
        latency_ms: latencyMs,
      }, {
        source: 'close',
        traceId,
        pendingStage: pendingVoiceTraceLookup ? 'trace_lookup' : pendingVoiceAiInteraction ? 'ai_interaction' : null,
      })
    }

    if (cancellableJobs.length > 0) {
      currentStreamRunIdRef.current += 1
      streamCancelRef.current?.()
      streamCancelRef.current = null
      if (currentStreamTraceIdRef.current) {
        streamedTraceIdsRef.current.delete(currentStreamTraceIdRef.current)
        currentStreamTraceIdRef.current = null
      }
      void Promise.all(cancellableJobs.map((job) => cancelAiJob(job.id))).catch(() => {})
    }

    resetVoiceRuntimeRefs()

    try {
      if (closeStrategy === 'wait_for_start' && sessionStartPromise) {
        let sessionStartSettled = false
        void recordAtlasAiEvent({
          eventName: 'mobile_voice_session_close_waiting_for_start',
          metadata: {
            session_id: sessionId,
            reason,
          },
        })
        const sessionStartConfirmed = await Promise.race([
          sessionStartPromise
            .then(() => {
              sessionStartSettled = true
              return true
            })
            .catch(() => {
              sessionStartSettled = true
              return false
            }),
          new Promise<boolean>((resolve) => {
            setTimeout(() => resolve(false), 3500)
          }),
        ])
        if (!sessionStartSettled) {
          void recordAtlasAiEvent({
            eventName: 'mobile_voice_session_close_deferred_cleanup',
            metadata: {
              session_id: sessionId,
              reason,
              wait_ms: Math.max(0, Math.round(Date.now() - closeStartedAt)),
            },
          })
          void sessionStartPromise
            .then(() => endMobileVoiceSession({
              session_id: sessionId,
              envelope_id: envelopeId,
              receipt_id: receiptId,
              reason,
            }))
            .then(() => recordAtlasAiEvent({
              eventName: 'mobile_voice_session_close_deferred_cleanup_succeeded',
              metadata: {
                session_id: sessionId,
                reason,
                latency_ms: Math.max(0, Math.round(Date.now() - closeStartedAt)),
              },
            }))
            .catch((error) => {
              void recordAtlasAiEvent({
                eventName: 'mobile_voice_session_close_deferred_cleanup_failed',
                metadata: {
                  session_id: sessionId,
                  reason,
                  error_class: errorClassFromUnknown(error),
                  latency_ms: Math.max(0, Math.round(Date.now() - closeStartedAt)),
                },
              })
            })
        }
        const deferredOutcome = mobileVoiceSessionDeferredCloseOutcome({
          startConfirmed: sessionStartConfirmed,
          startSettled: sessionStartSettled,
        })
        void recordAtlasAiEvent({
          eventName: 'mobile_voice_session_close_wait_result',
          metadata: {
            session_id: sessionId,
            reason,
            outcome: deferredOutcome,
            latency_ms: Math.max(0, Math.round(Date.now() - closeStartedAt)),
          },
        })
        closeStrategy = sessionStartConfirmed ? 'end_now' : 'skip_no_session'
      }
      if (closeStrategy === 'end_now') {
        await endMobileVoiceSession({
          session_id: sessionId,
          envelope_id: envelopeId,
          receipt_id: receiptId,
          reason,
        })
        void recordAtlasAiEvent({
          eventName: 'mobile_voice_session_close_succeeded',
          metadata: {
            session_id: sessionId,
            reason,
            latency_ms: Math.max(0, Math.round(Date.now() - closeStartedAt)),
          },
        })
      }
    } catch (error) {
      // O fechamento visual é local e deve continuar funcionando offline.
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_session_close_failed',
        metadata: {
          session_id: sessionId,
          reason,
          close_strategy: closeStrategy,
          error_class: errorClassFromUnknown(error),
          latency_ms: Math.max(0, Math.round(Date.now() - closeStartedAt)),
        },
      })
    } finally {
      if (voiceSessionStartPromiseRef.current === sessionStartPromise) {
        voiceSessionStartPromiseRef.current = null
      }
      void recordVoiceReadinessSnapshot('close', sessionId)
      voiceEndingRef.current = false
    }
  }, [
    composerRecorder,
    safeSetRecordingActive,
    safeSetRecordingPaused,
    pendingVoiceAiInteraction,
    pendingVoiceTraceLookup,
    voiceSessionEnvelopeId,
    voiceSessionId,
    voiceSessionReceiptId,
    voiceTraceId,
    voiceTraceRuntimeTurns,
    voiceModeState,
    recordMobileVoiceInterruption,
    recordVoiceReadinessSnapshot,
  ])
  const closeVoiceMode = useCallback(() => {
    void endVoiceMode('operator_closed_mobile_voice')
  }, [endVoiceMode])

  const handleVoiceLiveKitConnected = useCallback(() => {
    if (!voiceSessionIdRef.current) return
    setVoiceModeState('listening')
    setVoiceStatusDetail('Atlas ao vivo.')
    void recordAtlasAiEvent({
      eventName: 'mobile_voice_livekit_connected',
      metadata: {
        session_id: voiceSessionIdRef.current,
        room_name: voiceLiveKitSession?.roomName ?? null,
      },
    })
  }, [voiceLiveKitSession?.roomName])

  const handleVoiceLiveKitDisconnected = useCallback((reason?: string) => {
    if (!voiceModeOpenRef.current) return
    setVoiceModeState('reconnecting')
    setVoiceStatusDetail(reason ? `LiveKit desconectou: ${reason}.` : 'LiveKit reconectando.')
    void recordAtlasAiEvent({
      eventName: 'mobile_voice_livekit_disconnected',
      metadata: {
        session_id: voiceSessionIdRef.current,
        reason: reason ?? null,
      },
    })
  }, [])

  const handleVoiceLiveKitError = useCallback((message: string) => {
    voiceSessionReadyRef.current = false
    setVoiceSessionReady(false)
    setVoiceModeState('failed')
    setVoiceStatusDetail(message)
    void recordAtlasAiEvent({
      eventName: 'mobile_voice_livekit_failed',
      metadata: {
        session_id: voiceSessionIdRef.current,
        message,
      },
    })
  }, [])

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
  const [previewHistoricalImage, setPreviewHistoricalImage] = useState<AtlasAiAttachment | null>(null)
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
  const streamCancelRef = useRef<(() => void) | null>(null)
  const currentStreamTraceIdRef = useRef<string | null>(null)
  const currentStreamRunIdRef = useRef(0)
  const streamedTraceIdsRef = useRef<Set<string>>(new Set())
  const streamSequencesRef = useRef<Map<string, number>>(new Map())
  const voiceSynthesisRecordedRef = useRef<Set<string>>(new Set())
  const voicePlaybackRecordedRef = useRef<Set<string>>(new Set())
  const voiceInterruptionRecordedRef = useRef<Set<string>>(new Set())
  const voiceTerminalFailureRecordedRef = useRef<Set<string>>(new Set())
  const voiceFirstAssistantDeltaRecordedRef = useRef<Set<string>>(new Set())
  const voiceTraceRuntimeTurnsRef = useRef<Record<string, VoiceRuntimeTurn>>({})
  const voicePlaybackStartedAtRef = useRef<Map<string, number>>(new Map())
  const voiceSpeechLifecycleRef = useRef<string | null>(null)
  const voiceLastPlaybackEndedAtRef = useRef<number | null>(null)
  const voiceAudioPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null)
  const voiceAudioStopRef = useRef<(() => void) | null>(null)
  const voiceEndingRef = useRef(false)
  const voiceSessionReadyRef = useRef(false)
  const voiceSessionStartPromiseRef = useRef<Promise<AtlasVoiceSessionResponse> | null>(null)
  const voiceSessionStartTimedOutRef = useRef(false)
  const voiceSessionStartWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voiceFailureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voiceAutoStartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const voiceEndpointingInFlightRef = useRef(false)
  const voiceRecordingStartedAtRef = useRef<number | null>(null)
  const voiceLastSpeechAtRef = useRef<number | null>(null)
  const voiceLastMeteringSampleAtRef = useRef<number | null>(null)
  const voiceSpeechMsRef = useRef(0)
  const voiceModeOpenRef = useRef(voiceModeOpen)
  const voiceSessionIdRef = useRef<string | null>(voiceSessionId)
  const visibleStartedAtRef = useRef<number | null>(visible ? nowMs() : null)
  const readyMetricRecordedRef = useRef(false)

  // Skip mount-in animations during the first ~360ms after the sheet opens
  // (otherwise every existing trace would dramatically animate on every open).
  // After the grace period, only NEW arrivals animate.
  const [animationsReady, setAnimationsReady] = useState(false)
  useEffect(() => {
    if (!visible) {
      setAnimationsReady(false)
      setAtlasWarmupReady(false)
      visibleStartedAtRef.current = null
      readyMetricRecordedRef.current = false
      return
    }
    visibleStartedAtRef.current = nowMs()
    readyMetricRecordedRef.current = false
    const t = setTimeout(() => setAnimationsReady(true), 360)
    return () => clearTimeout(t)
  }, [visible])

  useEffect(() => {
    if (!visible) return

    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | null = null
    const task = InteractionManager.runAfterInteractions(() => {
      timeout = setTimeout(() => {
        if (!cancelled) {
          setAtlasWarmupReady(true)
          if (!readyMetricRecordedRef.current && visibleStartedAtRef.current != null) {
            readyMetricRecordedRef.current = true
            recordPerformanceDuration('atlas_ai_ready_ms', visibleStartedAtRef.current, {
              presentation_mode: presentationMode,
              requested_thread: requestedThreadId != null,
              has_current_thread: currentThreadIdRef.current != null,
            })
          }
        }
      }, 800)
    })

    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)
      task.cancel()
    }
  }, [presentationMode, requestedThreadId, visible])

  const activeTrace = useMemo(() => {
    for (let index = traces.length - 1; index >= 0; index -= 1) {
      if (isAtlasTraceActive(traces[index])) return traces[index]
    }
    return null
  }, [traces])
  const latestTrace = useMemo(() => traces[traces.length - 1] ?? null, [traces])
  const hasActiveTrace = activeTrace != null
  const isPendingSending = pending?.status === 'sending'
  const interactionLocked = submitting || hasActiveTrace || isPendingSending
  const composerLocked = submitting || isPendingSending
  const canClassifyDraftAsCapture = shouldClassifyAtlasAiDraft({
    currentThreadId,
    pending: pending != null,
    traceCount: traces.length,
  })
  const activeTraceAgeMs = activeTrace ? Date.now() - new Date(activeTrace.created_at).getTime() : null
  const visibleTraces = useMemo(
    () => traces.filter((trace) => traceMatchesTurnFilter(trace, turnFilter, pinnedTraceIds)),
    [pinnedTraceIds, traces, turnFilter],
  )
  const pinnedTraceIdSet = useMemo(() => new Set(pinnedTraceIds), [pinnedTraceIds])
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
    voiceModeOpenRef.current = voiceModeOpen
  }, [voiceModeOpen])

  useEffect(() => {
    voiceSessionIdRef.current = voiceSessionId
  }, [voiceSessionId])

  useEffect(() => {
    voiceTraceRuntimeTurnsRef.current = voiceTraceRuntimeTurns
  }, [voiceTraceRuntimeTurns])

  useEffect(() => {
    currentThreadIdRef.current = currentThreadId
  }, [currentThreadId])

  useEffect(() => () => {
    currentStreamRunIdRef.current += 1
    streamCancelRef.current?.()
    streamCancelRef.current = null
    if (currentStreamTraceIdRef.current) {
      streamedTraceIdsRef.current.delete(currentStreamTraceIdRef.current)
      currentStreamTraceIdRef.current = null
    }
    voiceSessionReadyRef.current = false
    voiceEndingRef.current = false
    resetVoiceRuntimeRefs({ resetSessionStartPromise: true })
    if (voiceFailureTimerRef.current) {
      clearTimeout(voiceFailureTimerRef.current)
      voiceFailureTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!canClassifyDraftAsCapture && destinoOverride !== null) {
      setDestinoOverride(null)
    }
  }, [canClassifyDraftAsCapture, destinoOverride])

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
    atlasStorage.getItem(COMPUTE_EFFORT_KEY)
      .then((stored) => {
        if (cancelled) return
        setComputeEffort(normalizeAtlasComputeEffort(stored))
      })
      .finally(() => {
        if (!cancelled) setComputeEffortHydrated(true)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!computeEffortHydrated) return
    void atlasStorage.setItem(COMPUTE_EFFORT_KEY, computeEffort)
  }, [computeEffort, computeEffortHydrated])

  useEffect(() => {
    if (!visible && voiceModeOpen) {
      void endVoiceMode('atlas_ai_sheet_hidden_mobile_voice')
    }
  }, [endVoiceMode, visible, voiceModeOpen])

  useEffect(() => {
    if (!visible || !atlasWarmupReady) return
    let cancelled = false

    getAiDomainCatalog()
      .then((catalog) => {
        if (!cancelled) setDomainCatalog(catalog)
      })
      .catch(() => {
        if (!cancelled) setDomainCatalog(null)
      })

    return () => {
      cancelled = true
    }
  }, [atlasWarmupReady, visible])

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
                  limit: THREAD_PAGE_SIZE,
                  // light=true · só precisamos do array pra `find(thread.id)`,
                  // sem relations pesadas. Cai de 1.2MB → 15KB no bootstrap.
                  light: true,
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

  // ROUND 3 + REDESIGN · useQuery com paginação client-side.
  // Carrega 10 inicial, "ver mais" incrementa +10 (cap em 100 = limit
  // máximo do backend). Cada incremento refaz fetch com novo limit;
  // placeholderData mantém data anterior visível durante refetch (UX
  // fluida sem flash de loading entre 10→20→30).
  //
  // Quando backend implementar cursor pagination (TODO em
  // AiThreadController.php), migrar pra useInfiniteQuery — fetch
  // incremental real (só os novos 10) em vez de re-baixar todos.
  const PAGE_SIZE = THREAD_PAGE_SIZE
  const PAGE_MAX = 100  // backend max
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE)
  const threadListEnabled = visible && (threadHistoryOpen || atlasWarmupReady)
  const threadListQueryKey = useMemo(
    () => ['atlas-ai', 'threads', { status: 'active', limit: pageLimit, light: true }] as const,
    [pageLimit],
  )
  const threadListQuery = useQuery({
    queryKey: threadListQueryKey,
    // light=true pede payload mínimo (~15KB pra 10 threads em vez de 1.2MB).
    // Backend omite activeSession/activeState/latestCompaction/handoff/lastTrace.
    // Histórico só precisa de id/title/metadata pra listar. Quando user abre
    // uma thread específica, getAiThread() carrega o payload completo.
    queryFn: () => listAiThreads({ status: 'active', limit: pageLimit, light: true }),
    enabled: threadListEnabled,
    // placeholderData: mantém resultado anterior visível enquanto novo
    // fetch (com limit maior) está em flight. Sem isso o user vê flash
    // de "skeleton/empty" cada vez que clica "ver mais".
    placeholderData: (previous) => previous,
    // Backoff exponencial: 1s · 2s · 4s. Total 7s no pior caso · honesto
    // pra rede móvel intermitente sem hammering.
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    // staleTime aqui sobreescreve o default 30s do queryClient pra 60s ·
    // lista de conversas muda devagar comparado a outras queries.
    staleTime: 60_000,
  })

  // Detecta se backend tem mais threads disponíveis. Heurística: se
  // backend devolveu EXATAMENTE pageLimit threads, presumimos que tem
  // mais (ainda não chegou ao fim). Se devolveu menos, o histórico
  // acabou. Cap em PAGE_MAX (limite hard do backend).
  // Defensive: array com optional chain pra não crash se payload vier
  // sem `.threads` por algum motivo (proxy/CDN/payload malformado).
  const totalLoaded = Array.isArray(threadListQuery.data?.threads)
    ? threadListQuery.data!.threads.length
    : 0
  const hasMore = totalLoaded >= pageLimit && pageLimit < PAGE_MAX

  // "ver mais" callback · incrementa pageLimit em PAGE_SIZE,
  // capeado em PAGE_MAX. Mudança em pageLimit muda queryKey,
  // dispara refetch automático.
  const loadMoreThreads = useCallback(() => {
    setPageLimit((prev) => Math.min(prev + PAGE_SIZE, PAGE_MAX))
  }, [])

  // Sync query.data → threadList state. Mantém compat com streaming
  // updates (ainda chamam setThreadList) e tudo que já consome threadList
  // direto. Quando a query refetch, sincroniza; entre fetches, optimistic
  // updates de stream ficam preservados localmente.
  // Defensive: só sync se threads é array válido.
  useEffect(() => {
    const threads = threadListQuery.data?.threads
    if (Array.isArray(threads)) {
      setThreadList(threads)
    }
  }, [threadListQuery.data])

  // Error/refreshing derivados da query. humanAiError formata pra
  // vocabulário canon (sem stack trace cru).
  const threadListError = threadListQuery.error
    ? humanAiError(threadListQuery.error, 'Falha ao carregar conversas.')
    : null
  const threadListRefreshing = threadListQuery.isFetching

  // Retry callback estável · refetch pluga em pull-to-refresh + banner
  // "tentar de novo". react-query cuida do dedupe (chamadas concorrentes
  // viram uma só).
  const retryThreadListFetch = useCallback(() => {
    void threadListQuery.refetch()
  }, [threadListQuery])

  useEffect(() => {
    if (!visible) return
    let cancelled = false

    // Tap no FAB sempre abre uma conversa NOVA. Quando outro painel chama
    // openAtlasAi(threadId), abrimos exatamente aquela conversa sem enviar
    // mensagem nova.
    // Antes, restaurar a última thread fazia 8 requests em Promise.all e
    // travava a UI por minutos quando o histórico era grande.
    threadViewVersionRef.current += 1
    currentStreamRunIdRef.current += 1
    streamCancelRef.current?.()
    streamCancelRef.current = null
    if (currentStreamTraceIdRef.current) {
      streamedTraceIdsRef.current.delete(currentStreamTraceIdRef.current)
      currentStreamTraceIdRef.current = null
    }
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

    return () => {
      cancelled = true
    }
  }, [loadThreadData, requestedThreadId, visible, atlasAiOpenNonce])

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
      if (previous === 'active' && nextState !== 'active' && voiceModeOpen) {
        void endVoiceMode('app_backgrounded_mobile_voice')
      }
      if (previous !== 'active' && nextState === 'active') {
        void flushAtlasAiTelemetry()
        if (voiceSessionIdRef.current) {
          void recordVoiceReadinessSnapshot('foreground', voiceSessionIdRef.current)
        }
        void refresh({ silent: true })
      }
    })

    return () => subscription.remove()
  }, [endVoiceMode, recordVoiceReadinessSnapshot, refresh, visible, voiceModeOpen])

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
      // Slice 6n · animação canon iOS · curva nativa keyboard reveal.
      // event.duration vem do iOS (~250ms tipicamente). Bezier match
      // UIKitsicht UIViewAnimationCurveEaseInOut padrão Apple.
      const duration = Platform.OS === 'ios' && typeof event.duration === 'number'
        ? Math.max(150, event.duration)
        : 280
      keyboardHeightShared.value = withTiming(event.endCoordinates.height, {
        duration,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
      })
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
    const hide = Keyboard.addListener(hideEvent, (event) => {
      setKeyboardHeight(0)
      const duration = Platform.OS === 'ios' && typeof event.duration === 'number'
        ? Math.max(150, event.duration)
        : 250
      keyboardHeightShared.value = withTiming(0, {
        duration,
        easing: Easing.bezier(0.32, 0.72, 0, 1),
      })
    })
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

  const openHistoricalAttachment = useCallback((attachment: AtlasAiAttachment) => {
    if (attachment.kind === 'image' && attachment.content_url) {
      setPreviewHistoricalImage(attachment)
      return
    }
    setPreviewHistoricalAttachment(attachment)
  }, [])

  const startTraceStream = useCallback((trace: AtlasAiTrace, threadViewVersion: number) => {
    if (streamedTraceIdsRef.current.has(trace.id)) return
    if (currentStreamTraceIdRef.current) {
      streamedTraceIdsRef.current.delete(currentStreamTraceIdRef.current)
      currentStreamTraceIdRef.current = null
    }
    const afterSequence = streamSequencesRef.current.get(trace.id) ?? 0
    streamSequencesRef.current.set(trace.id, afterSequence)
    const streamRunId = currentStreamRunIdRef.current + 1
    currentStreamRunIdRef.current = streamRunId
    streamCancelRef.current?.()
    streamCancelRef.current = null
    streamedTraceIdsRef.current.add(trace.id)
    currentStreamTraceIdRef.current = trace.id

    const stream = streamAiInteraction(trace.id, {
      onEvent: (event: AtlasAiStreamEvent) => {
        if (currentStreamRunIdRef.current !== streamRunId) return
        if (threadViewVersionRef.current !== threadViewVersion) return
        if (event.trace_id !== trace.id) return
        if (event.channel && event.channel !== 'assistant') return
        if (!['token', 'response'].includes(event.type)) return

        const content = event.content ?? ''
        if (!content) return

        const lastSequence = streamSequencesRef.current.get(trace.id) ?? 0
        if (event.sequence <= lastSequence) return
        streamSequencesRef.current.set(trace.id, event.sequence)

        const voiceRuntimeTurn = voiceTraceRuntimeTurnsRef.current[trace.id]
        if (voiceRuntimeTurn?.startedAt != null && !voiceFirstAssistantDeltaRecordedRef.current.has(trace.id)) {
          voiceFirstAssistantDeltaRecordedRef.current.add(trace.id)
          void recordAtlasAiEvent({
            eventName: 'mobile_voice_first_assistant_delta_received',
            trace_id: trace.id,
            thread_id: trace.thread_id ?? currentThreadIdRef.current,
            metadata: {
              session_id: voiceRuntimeTurn.sessionId,
              turn_id: voiceRuntimeTurn.turnId,
              sequence: event.sequence,
              event_type: event.type,
              latency_ms: Math.max(0, Math.round(Date.now() - voiceRuntimeTurn.startedAt)),
            },
          })
        }

        setTraces((current) =>
          current.map((item) => {
            if (item.id !== trace.id) return item
            const existing = item.response_text ?? ''
            const responseText = event.type === 'response'
              ? content
              : `${existing}${content}`

            return {
              ...item,
              response_text: responseText,
              job: item.job ? { ...item.job, result_text: responseText } : item.job,
            }
          }),
        )
      },
      onDone: () => {
        if (currentStreamRunIdRef.current !== streamRunId) return
        streamedTraceIdsRef.current.delete(trace.id)
        if (currentStreamTraceIdRef.current === trace.id) {
          currentStreamTraceIdRef.current = null
        }
        const voiceRuntimeTurn = voiceTraceRuntimeTurnsRef.current[trace.id]
        if (voiceRuntimeTurn?.startedAt != null) {
          void recordAtlasAiEvent({
            eventName: 'mobile_voice_assistant_stream_done',
            trace_id: trace.id,
            thread_id: trace.thread_id ?? currentThreadIdRef.current,
            metadata: {
              session_id: voiceRuntimeTurn.sessionId,
              turn_id: voiceRuntimeTurn.turnId,
              last_sequence: streamSequencesRef.current.get(trace.id) ?? null,
              latency_ms: Math.max(0, Math.round(Date.now() - voiceRuntimeTurn.startedAt)),
            },
          })
        }
        if (threadViewVersionRef.current === threadViewVersion) {
          void loadThreadData(trace.thread_id ?? currentThreadIdRef.current, { silent: true })
        }
      },
      onError: () => {
        if (currentStreamRunIdRef.current !== streamRunId) return
        streamedTraceIdsRef.current.delete(trace.id)
        if (currentStreamTraceIdRef.current === trace.id) {
          currentStreamTraceIdRef.current = null
        }
        const voiceRuntimeTurn = voiceTraceRuntimeTurnsRef.current[trace.id]
        if (voiceRuntimeTurn?.startedAt != null) {
          void recordAtlasAiEvent({
            eventName: 'mobile_voice_assistant_stream_error',
            trace_id: trace.id,
            thread_id: trace.thread_id ?? currentThreadIdRef.current,
            metadata: {
              session_id: voiceRuntimeTurn.sessionId,
              turn_id: voiceRuntimeTurn.turnId,
              last_sequence: streamSequencesRef.current.get(trace.id) ?? null,
              latency_ms: Math.max(0, Math.round(Date.now() - voiceRuntimeTurn.startedAt)),
            },
          })
        }
        // Polling continua como trilho de recuperação; stream é melhoria de latência.
      },
    }, { after: afterSequence })

    streamCancelRef.current = stream.cancel
  }, [loadThreadData])

  const showVoiceFailureBriefly = useCallback(() => {
    if (!voiceModeOpen) return
    if (voiceFailureTimerRef.current) {
      clearTimeout(voiceFailureTimerRef.current)
    }
    setVoiceModeState('failed')
    voiceFailureTimerRef.current = setTimeout(() => {
      voiceFailureTimerRef.current = null
      setVoiceModeState((current) => (current === 'failed' ? 'listening' : current))
    }, 1700)
  }, [voiceModeOpen])

  useEffect(() => {
    if (!visible || !activeTrace) return
    startTraceStream(activeTrace, threadViewVersionRef.current)
  }, [activeTrace, startTraceStream, visible])

  useEffect(() => {
    if (!pendingVoiceAiInteraction) return
    let cancelled = false
    const { traceId, threadId } = pendingVoiceAiInteraction
    const runtimeTurn = voiceTraceRuntimeTurns[traceId]
    const interactionStillCurrent = () =>
      !runtimeTurn || (voiceModeOpenRef.current && voiceSessionIdRef.current === runtimeTurn.sessionId)

    setPendingVoiceAiInteraction(null)
    setVoiceModeState('thinking')

    if (threadId) {
      setCurrentThreadId(threadId)
    }

    void (async () => {
      try {
        const response = await getAiInteraction(traceId)
        if (cancelled || !interactionStillCurrent()) return
        setTraces((current) => mergeAtlasTrace(response.trace, current))
        startTraceStream(response.trace, threadViewVersionRef.current)
        await loadThreadData(response.trace.thread_id ?? threadId, { silent: true })
      } catch (error) {
        if (cancelled || !interactionStillCurrent()) return
        if (runtimeTurn) {
          const lifecycleKey = `${voiceTurnLifecycleKey(runtimeTurn, traceId)}:fetch_failed`
          if (!voiceTerminalFailureRecordedRef.current.has(lifecycleKey)) {
            voiceTerminalFailureRecordedRef.current.add(lifecycleKey)
            void recordMobileVoiceRuntimeFailedWithError({
              session_id: runtimeTurn.sessionId,
              envelope_id: runtimeTurn.envelopeId,
              receipt_id: runtimeTurn.receiptId,
              turn_id: runtimeTurn.turnId,
              failure_code: 'mobile_voice_trace_fetch_failed',
              error_class: errorClassFromUnknown(error),
              latency_ms: runtimeTurn.startedAt != null
                ? Math.max(0, Math.round(Date.now() - runtimeTurn.startedAt))
                : undefined,
            }, error).catch(() => {})
            showVoiceFailureBriefly()
          }
        }
        if (threadId) {
          await loadThreadData(threadId, { silent: true }).catch(() => {})
        } else {
          setVoiceModeState('listening')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadThreadData, pendingVoiceAiInteraction, showVoiceFailureBriefly, startTraceStream, voiceTraceRuntimeTurns])

  useEffect(() => {
    if (!pendingVoiceTraceLookup) return
    let cancelled = false
    let pollTimeout: ReturnType<typeof setTimeout> | null = null
    let consecutivePollFailures = 0
    let lastPollFailureEventAt = 0
    const deadlineMs = pendingVoiceTraceLookup.startedAt + 5 * 60 * 1000
    const lookupStillCurrent = () =>
      voiceModeOpenRef.current
      && voiceSessionIdRef.current === pendingVoiceTraceLookup.runtimeTurn.sessionId

    const poll = async () => {
      if (cancelled || !lookupStillCurrent()) return
      if (Date.now() > deadlineMs) {
        if (!lookupStillCurrent()) return
        setPendingVoiceTraceLookup((current) =>
          current?.clientId === pendingVoiceTraceLookup.clientId ? null : current,
        )
        void recordMobileVoiceRuntimeFailedWithTelemetry({
          session_id: pendingVoiceTraceLookup.runtimeTurn.sessionId,
          envelope_id: pendingVoiceTraceLookup.runtimeTurn.envelopeId,
          receipt_id: pendingVoiceTraceLookup.runtimeTurn.receiptId,
          turn_id: pendingVoiceTraceLookup.runtimeTurn.turnId,
          failure_code: 'mobile_voice_trace_lookup_timeout',
          latency_ms: Date.now() - pendingVoiceTraceLookup.startedAt,
        }, { source: 'trace_lookup_timeout' })
        showVoiceFailureBriefly()
        return
      }

      try {
        if (pendingVoiceTraceLookup.captureClientId) {
          const capturesResponse = await listCaptures({
            client_id: pendingVoiceTraceLookup.captureClientId,
            kind: 'audio',
            limit: 1,
          })
          if (cancelled || !lookupStillCurrent()) return
          const capture = capturesResponse.captures[0]
          const dispatchResult = capture?.metadata?.voice_realtime_dispatch_result
          const dispatchTrace = mobileVoiceDispatchTraceFromResult(dispatchResult)
          if (dispatchTrace) {
            setPendingVoiceTraceLookup((current) =>
              current?.clientId === pendingVoiceTraceLookup.clientId ? null : current,
            )
            setVoiceTraceId(dispatchTrace.trace_id)
            setVoiceTraceRuntimeTurns((current) => ({
              ...current,
              [dispatchTrace.trace_id]: pendingVoiceTraceLookup.runtimeTurn,
            }))
            void recordAtlasAiEvent({
              eventName: 'mobile_voice_ai_trace_linked',
              trace_id: dispatchTrace.trace_id,
              thread_id: dispatchTrace.thread_id ?? pendingVoiceTraceLookup.threadId,
              metadata: {
                source: 'capture_dispatch_result',
                session_id: pendingVoiceTraceLookup.runtimeTurn.sessionId,
                turn_id: pendingVoiceTraceLookup.runtimeTurn.turnId,
                latency_ms: Math.max(0, Math.round(Date.now() - pendingVoiceTraceLookup.startedAt)),
              },
            })
            setPendingVoiceAiInteraction({
              traceId: dispatchTrace.trace_id,
              threadId: dispatchTrace.thread_id ?? pendingVoiceTraceLookup.threadId,
            })
            return
          }

          const dispatchFailure = mobileVoiceDispatchFailureFromResult(dispatchResult)
          if (dispatchFailure) {
            setPendingVoiceTraceLookup((current) =>
              current?.clientId === pendingVoiceTraceLookup.clientId ? null : current,
            )
            void recordMobileVoiceRuntimeFailedWithTelemetry({
              session_id: pendingVoiceTraceLookup.runtimeTurn.sessionId,
              envelope_id: pendingVoiceTraceLookup.runtimeTurn.envelopeId,
              receipt_id: pendingVoiceTraceLookup.runtimeTurn.receiptId,
              turn_id: pendingVoiceTraceLookup.runtimeTurn.turnId,
              failure_code: dispatchFailure.failure_code,
              error_class: dispatchFailure.error_class,
              error_message_hash: dispatchFailure.error_message_hash,
              latency_ms: Date.now() - pendingVoiceTraceLookup.startedAt,
            }, { source: 'dispatch_result_failure' })
            if (dispatchFailure.failure_code === 'mobile_voice_suspect_transcript_discarded') {
              setVoiceStatusDetail('Ignorei uma transcrição estranha. Pode continuar falando.')
              setVoiceModeState('listening')
              return
            }
            showVoiceFailureBriefly()
            return
          }
          if (capture?.transcription_status === 'failed') {
            const dispatchResult = recordFromUnknown(capture.metadata?.voice_realtime_dispatch_result)
            setPendingVoiceTraceLookup((current) =>
              current?.clientId === pendingVoiceTraceLookup.clientId ? null : current,
            )
            void recordMobileVoiceRuntimeFailedWithTelemetry({
              session_id: pendingVoiceTraceLookup.runtimeTurn.sessionId,
              envelope_id: pendingVoiceTraceLookup.runtimeTurn.envelopeId,
              receipt_id: pendingVoiceTraceLookup.runtimeTurn.receiptId,
              turn_id: pendingVoiceTraceLookup.runtimeTurn.turnId,
              failure_code: 'mobile_voice_transcription_failed',
              error_class: stringFromRecord(dispatchResult, 'error_class') ?? 'TranscriptionFailed',
              error_message_hash: stringFromRecord(dispatchResult, 'error_message_hash') ?? undefined,
              latency_ms: Date.now() - pendingVoiceTraceLookup.startedAt,
            }, { source: 'transcription_failed' })
            showVoiceFailureBriefly()
            return
          }
          const staleDispatchFailure = mobileVoiceStaleDispatchFailure({
            result: dispatchResult,
            transcription_status: capture?.transcription_status,
            updated_at: capture?.updated_at,
          })
          if (staleDispatchFailure) {
            setPendingVoiceTraceLookup((current) =>
              current?.clientId === pendingVoiceTraceLookup.clientId ? null : current,
            )
            void recordMobileVoiceRuntimeFailedWithTelemetry({
              session_id: pendingVoiceTraceLookup.runtimeTurn.sessionId,
              envelope_id: pendingVoiceTraceLookup.runtimeTurn.envelopeId,
              receipt_id: pendingVoiceTraceLookup.runtimeTurn.receiptId,
              turn_id: pendingVoiceTraceLookup.runtimeTurn.turnId,
              failure_code: staleDispatchFailure.failure_code,
              error_class: staleDispatchFailure.error_class,
              latency_ms: Date.now() - pendingVoiceTraceLookup.startedAt,
            }, { source: 'stale_dispatch_failure' })
            showVoiceFailureBriefly()
            return
          }
        }

        const response = await listAiInteractions({
          client_id: pendingVoiceTraceLookup.clientId,
          limit: 1,
        })
        if (cancelled || !lookupStillCurrent()) return
        const trace = response.traces[0]
        if (trace?.id) {
          setPendingVoiceTraceLookup(null)
          setVoiceTraceId(trace.id)
          setVoiceTraceRuntimeTurns((current) => ({
            ...current,
            [trace.id]: pendingVoiceTraceLookup.runtimeTurn,
          }))
          void recordAtlasAiEvent({
            eventName: 'mobile_voice_ai_trace_linked',
            trace_id: trace.id,
            thread_id: trace.thread_id ?? pendingVoiceTraceLookup.threadId,
            metadata: {
              source: 'ai_interactions_fallback',
              session_id: pendingVoiceTraceLookup.runtimeTurn.sessionId,
              turn_id: pendingVoiceTraceLookup.runtimeTurn.turnId,
              latency_ms: Math.max(0, Math.round(Date.now() - pendingVoiceTraceLookup.startedAt)),
            },
          })
          setPendingVoiceAiInteraction({
            traceId: trace.id,
            threadId: trace.thread_id ?? pendingVoiceTraceLookup.threadId,
          })
          return
        }
        if (consecutivePollFailures > 0) {
          void recordAtlasAiEvent({
            eventName: 'mobile_voice_trace_lookup_poll_recovered',
            metadata: {
              session_id: pendingVoiceTraceLookup.runtimeTurn.sessionId,
              turn_id: pendingVoiceTraceLookup.runtimeTurn.turnId,
              previous_failures: consecutivePollFailures,
              latency_ms: Math.max(0, Math.round(Date.now() - pendingVoiceTraceLookup.startedAt)),
            },
          })
        }
        consecutivePollFailures = 0
      } catch (error) {
        // A captura/transcrição pode ainda estar offline; tentamos de novo.
        consecutivePollFailures += 1
        const signal = mobileVoiceTraceLookupPollFailureSignal({ consecutiveFailures: consecutivePollFailures })
        const now = Date.now()
        if (signal && now - lastPollFailureEventAt > 10_000) {
          lastPollFailureEventAt = now
          void recordAtlasAiEvent({
            eventName: 'mobile_voice_trace_lookup_poll_failed',
            metadata: {
              session_id: pendingVoiceTraceLookup.runtimeTurn.sessionId,
              turn_id: pendingVoiceTraceLookup.runtimeTurn.turnId,
              signal,
              consecutive_failures: consecutivePollFailures,
              error_class: errorClassFromUnknown(error),
              latency_ms: Math.max(0, Math.round(now - pendingVoiceTraceLookup.startedAt)),
            },
          })
        }
      }

      if (cancelled || !lookupStillCurrent()) return
      pollTimeout = setTimeout(poll, 3000)
    }

    setVoiceModeState('transcribing')
    pollTimeout = setTimeout(poll, 1200)
    return () => {
      cancelled = true
      if (pollTimeout) clearTimeout(pollTimeout)
    }
  }, [pendingVoiceTraceLookup, showVoiceFailureBriefly])

  const voiceTrace = useMemo(
    () => (voiceTraceId ? traces.find((item) => item.id === voiceTraceId) ?? null : null),
    [traces, voiceTraceId],
  )
  const voiceTraceStatus = voiceTrace?.status ?? null
  const voiceTraceResponseText = voiceTrace?.response_text?.trim() ?? ''
  const voiceTraceActive = voiceTrace ? isAtlasTraceActive(voiceTrace) : false
  const voiceRuntimeTurn = voiceTraceId ? voiceTraceRuntimeTurns[voiceTraceId] : undefined

  useEffect(() => {
    if (!voiceModeOpen) return
    const decision = mobileVoiceUiWatchdogDecision(voiceModeState)
    if (!decision) return

    const state = voiceModeState
    const startedAt = Date.now()
    const timeout = setTimeout(() => {
      if (!voiceModeOpenRef.current) return
      const pendingAiRuntimeTurn = pendingVoiceAiInteraction?.traceId
        ? voiceTraceRuntimeTurnsRef.current[pendingVoiceAiInteraction.traceId]
        : undefined
      const runtimeTurn = pendingVoiceTraceLookup?.runtimeTurn ?? voiceRuntimeTurn ?? pendingAiRuntimeTurn

      void recordAtlasAiEvent({
        eventName: 'mobile_voice_ui_state_watchdog_timeout',
        trace_id: voiceTraceId ?? pendingVoiceAiInteraction?.traceId ?? undefined,
        metadata: {
          state,
          session_id: runtimeTurn?.sessionId ?? voiceSessionIdRef.current,
          turn_id: runtimeTurn?.turnId ?? null,
          timeout_ms: decision.timeoutMs,
          elapsed_ms: Math.max(0, Math.round(Date.now() - startedAt)),
        },
      })

      if (runtimeTurn) {
        void recordMobileVoiceRuntimeFailedWithTelemetry({
          session_id: runtimeTurn.sessionId,
          envelope_id: runtimeTurn.envelopeId,
          receipt_id: runtimeTurn.receiptId,
          turn_id: runtimeTurn.turnId,
          failure_code: decision.failureCode,
          error_class: decision.errorClass,
          latency_ms: runtimeTurn.startedAt != null
            ? Math.max(0, Math.round(Date.now() - runtimeTurn.startedAt))
            : Math.max(0, Math.round(Date.now() - startedAt)),
        }, {
          source: 'ui_state_watchdog',
          traceId: voiceTraceId ?? pendingVoiceAiInteraction?.traceId ?? null,
        })
      }

      showVoiceFailureBriefly()
    }, decision.timeoutMs)

    return () => clearTimeout(timeout)
  }, [
    pendingVoiceAiInteraction,
    pendingVoiceTraceLookup,
    showVoiceFailureBriefly,
    voiceModeState,
    voiceModeOpen,
    voiceModeState,
    voiceRuntimeTurn,
    voiceTraceId,
  ])

  useEffect(() => {
    if (!voiceModeOpen || !voiceTraceId || !voiceTraceStatus) return

    if (voiceTraceActive) {
      setVoiceModeState(voiceTraceResponseText ? 'speaking' : 'thinking')
      return
    }

    if (voiceTraceStatus === 'succeeded' && voiceTraceResponseText) {
      if (voiceRuntimeTurn) {
        const lifecycleKey = voiceTurnLifecycleKey(voiceRuntimeTurn, voiceTraceId)
        if (voicePlaybackRecordedRef.current.has(lifecycleKey)) {
          setVoiceModeState('listening')
          return
        }
      }
      setVoiceModeState('speaking')
      if (voiceRuntimeTurn) return
      const timeout = setTimeout(() => setVoiceModeState('listening'), 1400)
      return () => clearTimeout(timeout)
    }

    setVoiceModeState('listening')
  }, [voiceModeOpen, voiceRuntimeTurn, voiceTraceActive, voiceTraceId, voiceTraceResponseText, voiceTraceStatus])

  useEffect(() => {
    if (!voiceModeOpen || !voiceTraceId || !voiceRuntimeTurn || !voiceTrace) return
    const terminalFailure = mobileVoiceTraceTerminalFailure({
      status: voiceTraceStatus,
      job: voiceTrace.job,
      jobs: voiceTrace.jobs,
    })
    if (!terminalFailure) return

    const lifecycleKey = voiceTurnLifecycleKey(voiceRuntimeTurn, voiceTraceId)
    if (voiceTerminalFailureRecordedRef.current.has(lifecycleKey)) return
    voiceTerminalFailureRecordedRef.current.add(lifecycleKey)

    void recordMobileVoiceRuntimeFailedWithTelemetry({
      session_id: voiceRuntimeTurn.sessionId,
      envelope_id: voiceRuntimeTurn.envelopeId,
      receipt_id: voiceRuntimeTurn.receiptId,
      turn_id: voiceRuntimeTurn.turnId,
      failure_code: terminalFailure.failure_code,
      error_class: terminalFailure.error_class,
      latency_ms: voiceRuntimeTurn.startedAt != null
        ? Math.max(0, Math.round(Date.now() - voiceRuntimeTurn.startedAt))
        : undefined,
    }, { source: 'trace_terminal_failure', traceId: voiceTraceId })
    showVoiceFailureBriefly()
  }, [
    showVoiceFailureBriefly,
    voiceModeOpen,
    recordMobileVoicePlayback,
    recordMobileVoiceSynthesis,
    voiceRuntimeTurn,
    voiceTrace,
    voiceTraceId,
    voiceTraceStatus,
  ])

  useEffect(() => {
    if (!voiceModeOpen || !voiceTraceId || !voiceRuntimeTurn) return
    const emptyResponseFailure = mobileVoiceEmptyResponseFailure({
      status: voiceTraceStatus,
      response_text: voiceTraceResponseText,
    })
    if (!emptyResponseFailure) return

    const lifecycleKey = `${voiceTurnLifecycleKey(voiceRuntimeTurn, voiceTraceId)}:empty_response`
    if (voiceTerminalFailureRecordedRef.current.has(lifecycleKey)) return

    const timeout = setTimeout(() => {
      if (voiceTerminalFailureRecordedRef.current.has(lifecycleKey)) return
      voiceTerminalFailureRecordedRef.current.add(lifecycleKey)
      void recordMobileVoiceRuntimeFailedWithTelemetry({
        session_id: voiceRuntimeTurn.sessionId,
        envelope_id: voiceRuntimeTurn.envelopeId,
        receipt_id: voiceRuntimeTurn.receiptId,
        turn_id: voiceRuntimeTurn.turnId,
        failure_code: emptyResponseFailure.failure_code,
        error_class: emptyResponseFailure.error_class,
        latency_ms: voiceRuntimeTurn.startedAt != null
          ? Math.max(0, Math.round(Date.now() - voiceRuntimeTurn.startedAt))
          : undefined,
      }, { source: 'empty_response', traceId: voiceTraceId })
      showVoiceFailureBriefly()
    }, 900)

    return () => clearTimeout(timeout)
  }, [
    showVoiceFailureBriefly,
    voiceModeOpen,
    voiceRuntimeTurn,
    voiceTraceId,
    voiceTraceResponseText,
    voiceTraceStatus,
  ])

  useEffect(() => {
    if (!voiceModeOpen || !voiceTraceId || !voiceRuntimeTurn || voiceTraceStatus !== 'succeeded' || voiceTraceResponseText === '') return

    const runtimeTurn = voiceRuntimeTurn
    const responseText = voiceTraceResponseText
    const lifecycleKey = voiceTurnLifecycleKey(runtimeTurn, voiceTraceId)
    const estimatedDurationMs = estimateSpokenResponseDurationMs(responseText)
    const recordPlaybackCompleted = (playedDurationMs: number) => {
      if (voicePlaybackRecordedRef.current.has(lifecycleKey)) return
      voicePlaybackRecordedRef.current.add(lifecycleKey)
      voicePlaybackStartedAtRef.current.delete(lifecycleKey)
      recordMobileVoicePlayback({
        session_id: runtimeTurn.sessionId,
        envelope_id: runtimeTurn.envelopeId,
        receipt_id: runtimeTurn.receiptId,
        turn_id: runtimeTurn.turnId,
        played_duration_ms: Math.max(0, Math.round(playedDurationMs)),
      }, { traceId: voiceTraceId })
    }

    if (voiceSynthesisRecordedRef.current.has(lifecycleKey)) {
      return
    }
    voiceSynthesisRecordedRef.current.add(lifecycleKey)

    let cancelled = false
    let synthesisCompleted = false
    let speechCompleted = false

    void (async () => {
      const playbackStartedAt = Date.now()
      try {
        const startedAt = Date.now()
        const responseTextHash = await sha256Hex(responseText)
        if (cancelled) return

        const synthesis = await synthesizeMobileVoiceTurn({
          session_id: runtimeTurn.sessionId,
          envelope_id: runtimeTurn.envelopeId,
          receipt_id: runtimeTurn.receiptId,
          turn_id: runtimeTurn.turnId,
          text: responseText,
          response_text_hash: responseTextHash,
        })
        if (cancelled) return
        if (synthesis.status !== 'synthesized' || !synthesis.audio_base64 || !synthesis.audio_hash) {
          throw new Error('ElevenLabs não retornou áudio reproduzível.')
        }

        synthesisCompleted = true
        recordMobileVoiceSynthesis({
          session_id: runtimeTurn.sessionId,
          envelope_id: runtimeTurn.envelopeId,
          receipt_id: runtimeTurn.receiptId,
          turn_id: runtimeTurn.turnId,
          response_text_hash: responseTextHash,
          tts_provider: synthesis.provider || 'elevenlabs',
          audio_hash: synthesis.audio_hash,
          audio_duration_ms: estimatedDurationMs,
          latency_ms: synthesis.latency_ms ?? Date.now() - startedAt,
        }, { traceId: voiceTraceId })

        if (cancelled) return
        voiceSpeechLifecycleRef.current = lifecycleKey
        stopAtlasVoicePlayback()
        if (cancelled) return
        voicePlaybackStartedAtRef.current.set(lifecycleKey, playbackStartedAt)
        const speechResult = await playAtlasVoiceResponseAudio(
          synthesis.audio_base64,
          synthesis.audio_hash,
          estimatedDurationMs,
          () => !cancelled && voiceSpeechLifecycleRef.current === lifecycleKey,
        )
        if (speechResult !== 'done') {
          if (!cancelled && voiceSpeechLifecycleRef.current === lifecycleKey && speechResult === 'stopped') {
            const stoppedLifecycleKey = `${lifecycleKey}:tts_stopped`
            voiceSpeechLifecycleRef.current = null
            voicePlaybackStartedAtRef.current.delete(lifecycleKey)
            if (!voiceTerminalFailureRecordedRef.current.has(stoppedLifecycleKey)) {
              voiceTerminalFailureRecordedRef.current.add(stoppedLifecycleKey)
              void recordMobileVoiceRuntimeFailedWithTelemetry({
                session_id: runtimeTurn.sessionId,
                envelope_id: runtimeTurn.envelopeId,
                receipt_id: runtimeTurn.receiptId,
                turn_id: runtimeTurn.turnId,
                failure_code: 'mobile_voice_tts_playback_stopped',
                error_class: 'AtlasVoicePlaybackStopped',
                latency_ms: Date.now() - playbackStartedAt,
              }, { source: 'tts_playback_stopped', traceId: voiceTraceId })
              showVoiceFailureBriefly()
            }
          }
          return
        }
        speechCompleted = true
        if (cancelled) return
        if (voiceSpeechLifecycleRef.current !== lifecycleKey) return
        voiceSpeechLifecycleRef.current = null
        recordPlaybackCompleted(Date.now() - playbackStartedAt)
        voiceLastPlaybackEndedAtRef.current = Date.now()
        setPendingVoiceAiInteraction((current) => current?.traceId === voiceTraceId ? null : current)
        setVoiceTraceId((current) => current === voiceTraceId ? null : current)
        setVoiceModeState('listening')
      } catch (error) {
        voicePlaybackStartedAtRef.current.delete(lifecycleKey)
        if (voiceSpeechLifecycleRef.current === lifecycleKey) {
          voiceSpeechLifecycleRef.current = null
        }
        if (!cancelled) {
          void recordMobileVoiceRuntimeFailedWithError({
            session_id: runtimeTurn.sessionId,
            envelope_id: runtimeTurn.envelopeId,
            receipt_id: runtimeTurn.receiptId,
            turn_id: runtimeTurn.turnId,
            failure_code: 'mobile_voice_tts_unavailable',
            error_class: errorClassFromUnknown(error),
            latency_ms: Date.now() - playbackStartedAt,
          }, error).catch(() => {})
          showVoiceFailureBriefly()
          setVoiceModeState('listening')
        }
      }
    })()

    return () => {
      cancelled = true
      if (voiceSpeechLifecycleRef.current === lifecycleKey) {
        voiceSpeechLifecycleRef.current = null
        stopAtlasVoicePlayback()
      }
      if (!synthesisCompleted || !speechCompleted) {
        voiceSynthesisRecordedRef.current.delete(lifecycleKey)
      }
    }
  }, [
    showVoiceFailureBriefly,
    voiceModeOpen,
    voiceRuntimeTurn,
    voiceTraceId,
    voiceTraceResponseText,
    voiceTraceStatus,
  ])

  const interruptActiveTrace = useCallback(async (reason: 'barge_in' | 'cancel_button' = 'barge_in'): Promise<boolean> => {
    const trace = activeTraceRef.current
    if (!trace) return true

    const jobs = trace.jobs?.length
      ? trace.jobs
      : trace.job
        ? [trace.job]
        : []
    const cancellableJobs = jobs.filter((job) => ['queued', 'processing', 'awaiting_user_choice'].includes(job.status))
    if (cancellableJobs.length === 0) return false

    currentStreamRunIdRef.current += 1
    streamCancelRef.current?.()
    streamCancelRef.current = null
    if (currentStreamTraceIdRef.current) {
      streamedTraceIdsRef.current.delete(currentStreamTraceIdRef.current)
      currentStreamTraceIdRef.current = null
    }

    setOperationBusy(`interrupt:${trace.id}`)
    try {
      await Promise.all(cancellableJobs.map((job) => cancelAiJob(job.id)))
      setTraces((current) =>
        current.map((item) =>
          item.id === trace.id
            ? {
                ...item,
                status: 'cancelled',
                completed_at: new Date().toISOString(),
                metadata: {
                  ...item.metadata,
                  interrupted_by: reason,
                },
                job: item.job ? { ...item.job, status: 'cancelled' } : item.job,
                jobs: item.jobs?.map((job) =>
                  cancellableJobs.some((cancelledJob) => cancelledJob.id === job.id)
                    ? { ...job, status: 'cancelled' }
                    : job,
                ),
              }
            : item,
        ),
      )
      if (currentThreadIdRef.current) {
        void loadThreadData(currentThreadIdRef.current, { silent: true })
      }
      void recordAtlasAiEvent({
        eventName: 'active_trace_interrupted',
        trace_id: trace.id,
        thread_id: trace.thread_id ?? currentThreadIdRef.current,
        metadata: {
          reason,
          cancelled_jobs: cancellableJobs.length,
        },
      })
      return true
    } catch (interruptError) {
      showToast(humanAiError(interruptError, 'Nao consegui interromper o Atlas agora.'))
      return false
    } finally {
      setOperationBusy(null)
    }
  }, [loadThreadData, showToast])

  const handleVoiceModeRecordStart = useCallback(async () => {
    const recordingBlockReason = mobileVoiceRecordingBlockReason({
      modeOpen: voiceModeOpen,
      sessionId: voiceSessionId,
      sessionReady: voiceSessionReady,
      state: voiceModeState,
      recordingActive: recordingActiveRef.current,
      operationInFlight: recordOpInFlightRef.current,
      ending: voiceEndingRef.current,
    })
    if (recordingBlockReason) {
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_recording_start_ignored',
        metadata: {
          reason: recordingBlockReason,
          session_id: voiceSessionId,
          session_ready: voiceSessionReady,
          state: voiceModeState,
          recording_active: recordingActiveRef.current,
          operation_in_flight: recordOpInFlightRef.current,
        },
      })
      return
    }

    const activeVoiceSessionId = voiceSessionId
    if (!activeVoiceSessionId) return

    const interruptedTraceId = voiceTraceId
    const interruptedRuntimeTurn = interruptedTraceId ? voiceTraceRuntimeTurns[interruptedTraceId] : null
    const interruptedLifecycleKey = interruptedTraceId && interruptedRuntimeTurn
      ? voiceTurnLifecycleKey(interruptedRuntimeTurn, interruptedTraceId)
      : null
    const activeVoiceTrace = activeTraceRef.current?.id === interruptedTraceId ? activeTraceRef.current : null
    const shouldRecordBargeIn = mobileVoiceShouldRecordInterruption({
      hasRuntimeTurn: interruptedRuntimeTurn != null,
      hasLifecycleKey: interruptedLifecycleKey != null,
      assistantActive: activeVoiceTrace != null,
      pendingTraceLookup: pendingVoiceTraceLookup != null,
      pendingAiInteraction: pendingVoiceAiInteraction?.traceId === interruptedTraceId,
      state: voiceModeState,
      playbackRecorded: interruptedLifecycleKey ? voicePlaybackRecordedRef.current.has(interruptedLifecycleKey) : false,
      interruptionRecorded: interruptedLifecycleKey ? voiceInterruptionRecordedRef.current.has(interruptedLifecycleKey) : false,
    })
    const interruptedStage = mobileVoiceInterruptionStage({
      assistantStreaming: activeVoiceTrace != null,
      transcriptionPending: pendingVoiceTraceLookup != null,
      assistantThinking: pendingVoiceAiInteraction?.traceId === interruptedTraceId,
      state: voiceModeState,
    })
    let playedDurationMs: number | undefined
    let latencyMs: number | undefined
    if (interruptedLifecycleKey) {
      const playbackStartedAt = voicePlaybackStartedAtRef.current.get(interruptedLifecycleKey)
      if (playbackStartedAt != null) {
        playedDurationMs = Math.max(0, Math.round(Date.now() - playbackStartedAt))
        voicePlaybackStartedAtRef.current.delete(interruptedLifecycleKey)
      }
      if (voiceSpeechLifecycleRef.current === interruptedLifecycleKey) {
        const stopRequestedAt = Date.now()
        voiceSpeechLifecycleRef.current = null
        stopAtlasVoicePlayback()
        latencyMs = Math.max(0, Math.round(Date.now() - stopRequestedAt))
      }
    }
    if (activeVoiceTrace) {
      const interrupted = await interruptActiveTrace('barge_in')
      if (!interrupted) return
    }

    if (pendingVoiceTraceLookup) {
      const runtimeTurn = pendingVoiceTraceLookup.runtimeTurn
      setPendingVoiceTraceLookup(null)
      recordMobileVoiceInterruption({
        session_id: runtimeTurn.sessionId,
        envelope_id: runtimeTurn.envelopeId,
        receipt_id: runtimeTurn.receiptId,
        turn_id: runtimeTurn.turnId,
        reason: 'barge_in',
        interrupted_stage: 'transcription_pending',
        interruption_source: 'mobile',
        latency_ms: Math.max(0, Math.round(Date.now() - pendingVoiceTraceLookup.startedAt)),
      }, {
        source: 'barge_in',
        traceId: interruptedTraceId,
        pendingStage: 'trace_lookup',
      })
    }

    if (pendingVoiceAiInteraction) {
      setPendingVoiceAiInteraction(null)
    }

    if (interruptedTraceId && interruptedRuntimeTurn && interruptedLifecycleKey && shouldRecordBargeIn) {
      voicePlaybackRecordedRef.current.add(interruptedLifecycleKey)
      voiceInterruptionRecordedRef.current.add(interruptedLifecycleKey)
      recordMobileVoiceInterruption({
        session_id: interruptedRuntimeTurn.sessionId,
        envelope_id: interruptedRuntimeTurn.envelopeId,
        receipt_id: interruptedRuntimeTurn.receiptId,
        turn_id: interruptedRuntimeTurn.turnId,
        reason: 'barge_in',
        interrupted_stage: interruptedStage,
        interruption_source: 'mobile',
        played_duration_ms: playedDurationMs,
        latency_ms: latencyMs,
      }, {
        source: 'barge_in',
        traceId: interruptedTraceId,
        pendingStage: pendingVoiceAiInteraction ? 'ai_interaction' : null,
      })
    }

    setVoiceModeState('listening')
    void recordAtlasAiEvent({
      eventName: 'mobile_voice_recording_start_requested',
      metadata: {
        session_id: activeVoiceSessionId,
        state: voiceModeState,
        interrupted_trace_id: interruptedTraceId,
        pending_trace_lookup: pendingVoiceTraceLookup != null,
        pending_ai_interaction: pendingVoiceAiInteraction != null,
      },
    })
    const recordingStartRequestedAt = Date.now()
    const started = await handleComposerRecordStart()
    if (!started) {
      void recordMobileVoiceRuntimeFailedWithTelemetry({
        session_id: activeVoiceSessionId,
        envelope_id: voiceSessionEnvelopeId ?? undefined,
        receipt_id: voiceSessionReceiptId ?? undefined,
        turn_id: newMobileVoiceRuntimeId('mobile_voice_turn_start_failed'),
        failure_code: 'mobile_voice_recording_start_failed',
        error_class: 'MobileVoiceRecordingStartFailed',
        latency_ms: Math.max(0, Math.round(Date.now() - recordingStartRequestedAt)),
      }, { source: 'local_recording_start' })
      showVoiceFailureBriefly()
    } else {
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_recording_start_succeeded',
        metadata: {
          session_id: activeVoiceSessionId,
          latency_ms: Math.max(0, Math.round(Date.now() - recordingStartRequestedAt)),
        },
      })
    }
  }, [
    handleComposerRecordStart,
    interruptActiveTrace,
    pendingVoiceAiInteraction,
    pendingVoiceTraceLookup,
    recordMobileVoiceInterruption,
    showVoiceFailureBriefly,
    voiceSessionEnvelopeId,
    voiceModeOpen,
    voiceModeState,
    voiceSessionReady,
    voiceSessionId,
    voiceSessionReceiptId,
    voiceTraceId,
    voiceTraceRuntimeTurns,
  ])

  const discardVoiceModeSilentRecording = useCallback(async (reason: string) => {
    if (!voiceModeOpenRef.current || !voiceSessionIdRef.current) return
    if (!recordingActiveRef.current && !composerRecorderState.isRecording) return
    if (voiceEndpointingInFlightRef.current) return

    voiceEndpointingInFlightRef.current = true
    const sessionId = voiceSessionIdRef.current
    const durationMs = composerRecorderState.durationMillis
    await handleComposerRecordCancel()
    resetVoiceEndpointingRefs()
    if (!voiceModeOpenRef.current || voiceSessionIdRef.current !== sessionId) return

    setVoiceModeState('listening')
    setVoiceStatusDetail('Não ouvi fala suficiente. Pode falar de novo.')
    void recordAtlasAiEvent({
      eventName: 'mobile_voice_silence_turn_discarded',
      metadata: {
        session_id: sessionId,
        reason,
        duration_ms: mobileVoiceMetricMs(durationMs) ?? null,
      },
    })
  }, [composerRecorderState.durationMillis, composerRecorderState.isRecording, handleComposerRecordCancel])

  const handleVoiceModeRecordEnd = useCallback(async () => {
    if (!voiceModeOpen || !voiceSessionId || !voiceSessionReady) {
      voiceEndpointingInFlightRef.current = false
      return
    }
    if (recordOpInFlightRef.current) {
      voiceEndpointingInFlightRef.current = false
      return
    }
    const activeVoiceSessionId = voiceSessionId
    if (!activeVoiceSessionId) {
      voiceEndpointingInFlightRef.current = false
      return
    }

    recordOpInFlightRef.current = true
    await recordStartInFlightRef.current?.catch(() => {})

    if (!recordingActiveRef.current) {
      safeSetRecordingActive(false)
      safeSetRecordingPaused(false)
      recordOpInFlightRef.current = false
      resetVoiceEndpointingRefs()
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_recording_end_ignored',
        metadata: {
          session_id: activeVoiceSessionId,
          reason: 'no_active_recording',
          session_ready: voiceSessionReady,
          state: voiceModeState,
        },
      })
      return
    }

    const voiceTurnId = newMobileVoiceRuntimeId('mobile_voice_turn')
    const voiceStartedAt = Date.now()
    const durationMs = composerRecorderState.durationMillis
    const recordingStopRequestedAt = Date.now()
    void recordAtlasAiEvent({
      eventName: 'mobile_voice_recording_stop_requested',
      metadata: {
        session_id: activeVoiceSessionId,
        turn_id: voiceTurnId,
        duration_ms: mobileVoiceMetricMs(durationMs) ?? null,
      },
    })
    safeSetRecordingActive(false)
    safeSetRecordingPaused(false)
    recordingActiveRef.current = false

    let fileUri: string | null = null
    try {
      if (composerRecorderState.isRecording || composerRecorderState.url) {
        await composerRecorder.stop()
      }
      fileUri = (() => {
        try { return composerRecorder.uri } catch { return null }
      })() ?? composerRecorderState.url
    } catch (err) {
      void recordMobileVoiceRuntimeFailedWithError({
        session_id: activeVoiceSessionId,
        envelope_id: voiceSessionEnvelopeId ?? undefined,
        receipt_id: voiceSessionReceiptId ?? undefined,
        turn_id: voiceTurnId,
        failure_code: 'mobile_voice_recording_stop_failed',
        error_class: errorClassFromUnknown(err),
        latency_ms: Math.max(0, Math.round(Date.now() - recordingStopRequestedAt)),
      }, err).catch(() => {})
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_recording_stop_failed',
        metadata: {
          session_id: activeVoiceSessionId,
          turn_id: voiceTurnId,
          error_class: errorClassFromUnknown(err),
          duration_ms: mobileVoiceMetricMs(durationMs) ?? null,
          latency_ms: Math.max(0, Math.round(Date.now() - recordingStopRequestedAt)),
        },
      })
      showToast(err instanceof Error ? err.message : 'Falha ao parar gravação')
    } finally {
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {})
      recordOpInFlightRef.current = false
    }

    if (!voiceModeOpenRef.current || voiceSessionIdRef.current !== activeVoiceSessionId) {
      return
    }

    const recordLocalVoiceFailure = (failureCode: string, errorClass: string) => {
      void recordMobileVoiceRuntimeFailedWithTelemetry({
        session_id: activeVoiceSessionId,
        envelope_id: voiceSessionEnvelopeId ?? undefined,
        receipt_id: voiceSessionReceiptId ?? undefined,
        turn_id: voiceTurnId,
        failure_code: failureCode,
        error_class: errorClass,
        latency_ms: Math.max(0, Math.round(Date.now() - voiceStartedAt)),
      }, { source: 'local_recording_validation' })
    }

    void recordAtlasAiEvent({
      eventName: 'mobile_voice_recording_stopped',
      metadata: {
        session_id: activeVoiceSessionId,
        turn_id: voiceTurnId,
        file_uri_present: typeof fileUri === 'string' && fileUri.trim().length > 0,
        duration_ms: mobileVoiceMetricMs(durationMs) ?? null,
        latency_ms: Math.max(0, Math.round(Date.now() - recordingStopRequestedAt)),
      },
    })

    const meteringSamples = voiceLastMeteringSampleAtRef.current
      ? Math.max(1, Math.round(Math.max(0, durationMs) / 150))
      : 0
    const voicedMeteringSamples = voiceLastMeteringSampleAtRef.current
      ? Math.max(0, Math.round(voiceSpeechMsRef.current / 150))
      : 0
    const validationFailure = mobileVoiceRecordingValidationFailure({
      fileUri,
      durationMs,
      meteringSamples,
      voicedMeteringSamples,
      minVoicedMeteringSamples: MOBILE_VOICE_MIN_VOICED_METERING_SAMPLES,
    })
    if (validationFailure) {
      recordLocalVoiceFailure(validationFailure.failure_code, validationFailure.error_class)
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_recording_validation_failed',
        metadata: {
          session_id: activeVoiceSessionId,
          turn_id: voiceTurnId,
          failure_code: validationFailure.failure_code,
          duration_ms: mobileVoiceMetricMs(durationMs) ?? null,
          speech_ms: mobileVoiceMetricMs(voiceSpeechMsRef.current) ?? null,
          metering_samples: meteringSamples,
          voiced_metering_samples: voicedMeteringSamples,
          file_uri_present: typeof fileUri === 'string' && fileUri.trim().length > 0,
          latency_ms: Math.max(0, Math.round(Date.now() - voiceStartedAt)),
        },
      })
      showVoiceFailureBriefly()
      resetVoiceEndpointingRefs()
      return
    }

    const validatedFileUri = fileUri
    if (!validatedFileUri) {
      resetVoiceEndpointingRefs()
      return
    }

    const voiceClientId = `voice:${activeVoiceSessionId}:${voiceTurnId}`
    const voiceDomain = captureDomainForVoiceRouting(routing.domain)

    setPendingVoiceTraceLookup({
      clientId: voiceClientId,
      threadId: currentThreadId,
      runtimeTurn: {
        sessionId: activeVoiceSessionId,
        turnId: voiceTurnId,
        envelopeId: voiceSessionEnvelopeId ?? undefined,
        receiptId: voiceSessionReceiptId ?? undefined,
        startedAt: voiceStartedAt,
      },
      startedAt: voiceStartedAt,
    })
    setVoiceModeState('transcribing')
    void recordAtlasAiEvent({
      eventName: 'mobile_voice_capture_dispatch_requested',
      metadata: {
        session_id: activeVoiceSessionId,
        turn_id: voiceTurnId,
        client_id: voiceClientId,
        domain_hint: voiceDomain,
        thread_id: currentThreadId,
        duration_ms: mobileVoiceMetricMs(durationMs) ?? null,
      },
    })

    try {
      const captureClientId = await createAudioCapture({
        domain: voiceDomain,
        fileUri: validatedFileUri,
        durationMs,
        metadata: {
          captureMode: 'audio',
          captureSurface: 'atlas_ai_voice_mode',
          source: 'modo_voz_fullscreen',
          destino: 'conversar',
          voiceSessionId: activeVoiceSessionId,
          voice_realtime_dispatch: {
            dispatch_to_ai: true,
            allow_transcript_persistence: true,
            session_id: activeVoiceSessionId,
            envelope_id: voiceSessionEnvelopeId,
            receipt_id: voiceSessionReceiptId,
            turn_id: voiceTurnId,
            ai_thread_id: currentThreadId,
            domain_hint: voiceDomain,
            flow_hint: 'voice.push_to_talk.fullscreen',
            language: 'pt-BR',
            client_surface: 'mobile',
            transport: 'mobile_push_to_talk',
            runtime: 'livekit_agents_sdk',
            privacy_class: 'p3_audio',
            endpointing_profile: 'quality_first',
          },
        },
      })
      setPendingVoiceTraceLookup((current) =>
        current?.clientId === voiceClientId
          ? { ...current, captureClientId }
          : current,
      )
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_capture_dispatch_succeeded',
        metadata: {
          session_id: activeVoiceSessionId,
          turn_id: voiceTurnId,
          client_id: voiceClientId,
          capture_client_id: captureClientId,
          latency_ms: Math.max(0, Math.round(Date.now() - voiceStartedAt)),
        },
      })
      resetVoiceEndpointingRefs()
    } catch (error) {
      setPendingVoiceTraceLookup((current) => current?.clientId === voiceClientId ? null : current)
      resetVoiceEndpointingRefs()
      showVoiceFailureBriefly()
      void recordMobileVoiceRuntimeFailedWithError({
        session_id: activeVoiceSessionId,
        envelope_id: voiceSessionEnvelopeId ?? undefined,
        receipt_id: voiceSessionReceiptId ?? undefined,
        turn_id: voiceTurnId,
        failure_code: 'mobile_capture_dispatch_failed',
        error_class: errorClassFromUnknown(error),
        latency_ms: Math.max(0, Math.round(Date.now() - voiceStartedAt)),
      }, error).catch(() => {})
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_capture_dispatch_failed',
        metadata: {
          session_id: activeVoiceSessionId,
          turn_id: voiceTurnId,
          client_id: voiceClientId,
          error_class: errorClassFromUnknown(error),
          latency_ms: Math.max(0, Math.round(Date.now() - voiceStartedAt)),
        },
      })
      showToast(humanAiError(error, 'Falha ao enviar turno de voz.'))
    }
  }, [
    composerRecorder,
    composerRecorderState,
    createAudioCapture,
    currentThreadId,
    routing.domain,
    safeSetRecordingActive,
    safeSetRecordingPaused,
    showToast,
    showVoiceFailureBriefly,
    voiceModeState,
    voiceModeOpen,
    voiceSessionReady,
    voiceSessionEnvelopeId,
    voiceSessionId,
    voiceSessionReceiptId,
  ])

  useEffect(() => {
    if (!voiceModeOpen || !voiceSessionReady || !voiceSessionId) return
    if (voiceModeState !== 'listening') return
    if (recordingActive || recordingActiveRef.current) return
    if (recordOpInFlightRef.current || recordStartInFlightRef.current || voiceEndingRef.current) return
    if (pendingVoiceTraceLookup || pendingVoiceAiInteraction || voiceSpeechLifecycleRef.current) return

    if (voiceAutoStartTimerRef.current) {
      clearTimeout(voiceAutoStartTimerRef.current)
    }

    const playbackEndedAt = voiceLastPlaybackEndedAtRef.current
    const postPlaybackGuardMs = playbackEndedAt == null
      ? 0
      : Math.max(0, MOBILE_VOICE_POST_PLAYBACK_MIC_GUARD_MS - (Date.now() - playbackEndedAt))
    const autoStartDelayMs = Math.max(MOBILE_VOICE_AUTO_START_DELAY_MS, postPlaybackGuardMs)

    voiceAutoStartTimerRef.current = setTimeout(() => {
      voiceAutoStartTimerRef.current = null
      if (!voiceModeOpenRef.current) return
      if (!voiceSessionReadyRef.current || !voiceSessionIdRef.current) return
      if (recordingActiveRef.current || recordOpInFlightRef.current || recordStartInFlightRef.current) return
      if (voiceEndingRef.current || voiceSpeechLifecycleRef.current) return
      void handleVoiceModeRecordStart()
    }, autoStartDelayMs)

    return () => {
      if (voiceAutoStartTimerRef.current) {
        clearTimeout(voiceAutoStartTimerRef.current)
        voiceAutoStartTimerRef.current = null
      }
    }
  }, [
    handleVoiceModeRecordStart,
    pendingVoiceAiInteraction,
    pendingVoiceTraceLookup,
    recordingActive,
    voiceModeOpen,
    voiceModeState,
    voiceSessionId,
    voiceSessionReady,
  ])

  useEffect(() => {
    if (!voiceModeOpen || !recordingActiveRef.current || !composerRecorderState.isRecording) return
    if (voiceEndpointingInFlightRef.current) return

    const now = Date.now()
    const lastSampleAt = voiceLastMeteringSampleAtRef.current ?? now
    const sampleDeltaMs = Math.max(0, Math.min(300, now - lastSampleAt))
    voiceLastMeteringSampleAtRef.current = now

    if (mobileVoiceMeteringIsSpeech(composerRecorderState.metering, MOBILE_VOICE_SPEECH_THRESHOLD_DB)) {
      voiceLastSpeechAtRef.current = now
      voiceSpeechMsRef.current += sampleDeltaMs > 0 ? sampleDeltaMs : 150
    }

    const decision = mobileVoiceEndpointingDecision({
      recordingActive: recordingActiveRef.current,
      isRecording: composerRecorderState.isRecording,
      durationMs: composerRecorderState.durationMillis,
      nowMs: now,
      startedAtMs: voiceRecordingStartedAtRef.current,
      lastSpeechAtMs: voiceLastSpeechAtRef.current,
      speechMs: voiceSpeechMsRef.current,
      minTurnMs: MOBILE_VOICE_MIN_TURN_MS,
      minSpeechMs: MOBILE_VOICE_MIN_SPEECH_MS,
      silenceAfterSpeechMs: MOBILE_VOICE_SILENCE_AFTER_SPEECH_MS,
      noSpeechTimeoutMs: MOBILE_VOICE_NO_SPEECH_TIMEOUT_MS,
      maxTurnAfterSpeechMs: MOBILE_VOICE_MAX_TURN_AFTER_SPEECH_MS,
      maxTurnMs: MOBILE_VOICE_MAX_TURN_MS,
      qualityFirst: MOBILE_VOICE_QUALITY_FIRST_ENDPOINTING,
    })

    if (decision.action === 'continue') return

    if (decision.action === 'finish') {
      voiceEndpointingInFlightRef.current = true
      void recordAtlasAiEvent({
        eventName: 'mobile_voice_auto_endpoint_detected',
        metadata: {
          session_id: voiceSessionIdRef.current,
          reason: decision.reason,
          duration_ms: mobileVoiceMetricMs(composerRecorderState.durationMillis) ?? null,
          speech_ms: mobileVoiceMetricMs(voiceSpeechMsRef.current) ?? null,
          last_metering: mobileVoiceMetricMs(composerRecorderState.metering) ?? null,
        },
      })
      void handleVoiceModeRecordEnd()
      return
    }

    void discardVoiceModeSilentRecording(decision.reason)
  }, [
    composerRecorderState.durationMillis,
    composerRecorderState.isRecording,
    composerRecorderState.metering,
    discardVoiceModeSilentRecording,
    handleVoiceModeRecordEnd,
    voiceModeOpen,
  ])

  const submitText = useCallback(
    async (input: string, options: SubmitTextOptions = {}) => {
      const attachments = options.attachments ?? []
      let fileAttachments = options.fileAttachments ?? []
      input = input.trim() || attachmentOnlyPrompt(attachments, fileAttachments)
      if (!input || submitting) return
      if (isPendingSending) {
        showToast('Atlas ainda está pensando')
        return
      }
      if (activeTraceRef.current) {
        const interrupted = await interruptActiveTrace('barge_in')
        if (!interrupted) return
      }

      const originalInputChars = input.length
      let longMessagePayload: Record<string, unknown> | null = null
      try {
        const preparedLongMessage = await prepareLongMessageForAtlas(input, fileAttachments)
        input = preparedLongMessage.input
        fileAttachments = preparedLongMessage.fileAttachments
        longMessagePayload = preparedLongMessage.metadata ?? null
      } catch (prepareError) {
        showToast(humanAiError(prepareError, 'falha ao preparar mensagem longa.'))
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
        original_input_chars: originalInputChars,
        long_message_externalized: longMessagePayload !== null,
        long_message_chunks: typeof longMessagePayload?.chunk_count === 'number' ? longMessagePayload.chunk_count : undefined,
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
        const hyperflowBuild = buildInteractionPayload({
          mode: routingSnapshot.mode,
          task: routingSnapshot.task,
          provider: routingSnapshot.executor,
          computeEffort,
          workspaceSlug: currentThread?.workspace ?? null,
          routingDomain: routingSnapshot.domain === 'auto' ? undefined : routingSnapshot.domain,
          conversationContext,
        })
        const domainSelection = domainCatalog
          ? selectAtlasAiDomainFlow(domainCatalog, {
              surface_id: 'atlas_mobile_ai',
              mode: routingSnapshot.mode,
              task: routingSnapshot.task,
              routing_domain: routingSnapshot.domain,
              domain_id: typeof hyperflowBuild.payload.domain_id === 'string' ? hyperflowBuild.payload.domain_id : undefined,
              flow_id: typeof hyperflowBuild.payload.flow_id === 'string' ? hyperflowBuild.payload.flow_id : undefined,
            })
          : null
        const threadRuntimePolicy =
          threadId && currentThread?.id === threadId
            ? runtimePolicyPayloadForThread(currentThread, atlasFocus)
            : {}
        const runtimePolicy = {
          ...hyperflowBuild.payload,
          ...threadRuntimePolicy,
          ...(threadOriginPayload ?? {}),
        }
        const requestedComputeEffort = atlasComputeEffortForPayload(computeEffort)
        const runtimePolicyHints =
          typeof runtimePolicy.policy_hints === 'object' && runtimePolicy.policy_hints !== null
            ? runtimePolicy.policy_hints as Record<string, unknown>
            : {}
        const policyHints = requestedComputeEffort
          ? { ...runtimePolicyHints, compute_effort: requestedComputeEffort }
          : runtimePolicyHints

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
            compute_effort: computeEffort,
            requested_compute_effort: requestedComputeEffort ?? null,
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
            ...runtimePolicy,
            app_surface: 'atlas_mobile_ai',
            mobile_surface_id: 'atlas_ai_sheet',
            atlas_focus: runtimePolicy.atlas_focus ?? atlasFocus,
            atlas_workflow_mode: runtimePolicy.atlas_workflow_mode ?? (routingSnapshot.task === 'debug' ? 'dev' : routingSnapshot.task),
            open_brain: openBrainPayloadForRouting(routingSnapshot),
            decision_mode: runtimePolicy.decision_mode ?? decisionMode,
            routing_task: runtimePolicy.routing_task ?? routingSnapshot.task,
            routing_domain: runtimePolicy.routing_domain ?? routingSnapshot.domain,
            requested_agent: routingSnapshot.domain === 'auto' ? undefined : routingSnapshot.domain,
            requested_provider: provider,
            operator_requested_provider: routingSnapshot.executor,
            operator_compute_effort: computeEffort,
            compute_effort: requestedComputeEffort,
            policy_hints: Object.keys(policyHints).length > 0 ? policyHints : undefined,
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
            long_message: longMessagePayload ?? undefined,
            response_style: routingSnapshot.style,
            response_policy: responsePolicy,
            task_type: routingSnapshot.task === 'debug' ? 'debug' : undefined,
            constraints: responsePolicy.constraints,
            execution_policy: executionPolicy,
            conversation_context: conversationContext,
            ...(domainSelection?.status === 'ok' ? compactDomainSelectionPayloadPatch(domainSelection.payload_patch) : {}),
            domain_catalog_selection: domainSelection ? compactDomainSelectionForPayload(domainSelection) : undefined,
            council_providers: councilMode ? ['claude_cli', 'codex_cli'] : undefined,
            council_rule: councilMode
              ? 'both_propose_or_review; execution_requires_single_provider'
              : undefined,
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
          startTraceStream(response.trace, threadViewVersion)
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
        const keepPending = shouldKeepPendingSubmission(submitError, hasAttachments)
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
      interruptActiveTrace,
      showToast,
      traces,
      currentThreadId,
      currentThread,
      pendingThreadOrigin,
      pinnedTraceIds,
      loadThreadData,
      startTraceStream,
      providerStatus,
      domainCatalog,
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

  // ✅ Atlas Decide canon · submit branch baseado em destino classificado.
  // Quando destino === 'captura' (anotação curta), NÃO invoca Atlas AI · cria
  // text capture e abre Domain Sheet pra escolher domain. Conversa segue
  // fluxo Atlas AI atual (submitText). Tarefa/projeto são definidos depois
  // da captura, na curadoria.
  const submit = useCallback(() => {
    const text = draft.trim()
    if (!text) return

    // Atlas Decide só existe no estado inicial: conversa nova, sem thread,
    // sem trace e sem pending. Depois que a conversa começa, toda digitação
    // é conversa; nunca sequestra para captura no meio do diálogo.
    const effectiveDestino = canClassifyDraftAsCapture
      ? destinoOverride ?? classifyDecideDestino(text)
      : 'conversa'

    // CAPTURA · abre Domain Sheet "Categorizar + Elaborar" pra user escolher
    // domain (i.) + destino editorial (ii.). Callback recebe ambos · branch
    // baseado em destino:
    //   · conversar → submitText (fluxo Atlas AI tradicional)
    //   · salvar → createTextCapture pro inbox raw
    if (effectiveDestino === 'captura') {
      const capturedText = text
      const capturedAttachments = draftAttachments
      const capturedFileAttachments = draftFileAttachments
      // Limpa draft imediatamente · UI feedback rápido.
      setDraft('')
      setDraftAttachments([])
      setDraftFileAttachments([])
      openDomain((picked, destino) => {
        // Default destino "salvar" se user pular sem escolher destino.
        const finalDestino = destino ?? 'salvar'
        const finalDomain = picked ?? 'outro'

        // CONVERSAR · invoca Atlas AI com captura como contexto.
        if (finalDestino === 'conversar') {
          void submitText(capturedText, {
            attachments: capturedAttachments,
            fileAttachments: capturedFileAttachments,
          })
          return
        }

        // SALVAR (default) · vai pro inbox raw · sem invocar Atlas AI.
        void (async () => {
          try {
            await createTextCapture({
              domain: finalDomain,
              text: capturedText,
              metadata: {
                captureMode: 'text',
                captureSurface: 'atlas_ai_composer',
                source: 'atlas_decide_captura',
              },
            })
            showToast('Captura registrada')
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Falha ao salvar captura'
            showToast(msg)
          }
        })()
      })
      return
    }

    // CONVERSA/TAREFA/PROJETO (sem passar pela Domain Sheet) · fluxo Atlas AI
    // tradicional · destino classificado já indica intent claro pro backend.
    void submitText(text, {
      attachments: draftAttachments,
      fileAttachments: draftFileAttachments,
    })
  }, [
    submitText,
    draft,
    draftAttachments,
    draftFileAttachments,
    destinoOverride,
    canClassifyDraftAsCapture,
    createTextCapture,
    openDomain,
    showToast,
  ])

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
    setDestinoOverride(null)
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

  const deleteThreadAfterConfirmation = useCallback(
    async (thread: AtlasAiThread) => {
      setOperationBusy(`delete:${thread.id}`)
      // Remove otimista no cache react-query e no state local. Se o
      // backend recusar, voltamos exatamente ao snapshot anterior.
      const previousCache = queryClient.getQueryData<AiThreadsResponse>(threadListQueryKey)
      queryClient.setQueryData<AiThreadsResponse>(threadListQueryKey, (current) => {
        if (!current) return current
        return { ...current, threads: current.threads.filter((item) => item.id !== thread.id) }
      })
      setThreadList((current) => current.filter((item) => item.id !== thread.id))
      try {
        await deleteAiThread(thread.id)
        if (thread.id === currentThreadId) {
          startNewThread()
        }
        showToast('Conversa apagada')
      } catch (deleteError) {
        if (previousCache) {
          queryClient.setQueryData(threadListQueryKey, previousCache)
          setThreadList(previousCache.threads)
        }
        showToast(humanAiError(deleteError, 'Falha ao apagar conversa.'))
      } finally {
        setOperationBusy(null)
      }
    },
    [currentThreadId, queryClient, showToast, startNewThread, threadListQueryKey],
  )

  const deleteThread = useCallback(
    async (thread: AtlasAiThread) => {
      if (thread.id === currentThreadId && interactionLocked) {
        showToast('Atlas ainda está pensando')
        return
      }

      openConfirmDelete((confirmed) => {
        if (!confirmed) return

        void deleteThreadAfterConfirmation(thread)
      }, {
        title: 'Excluir esta conversa?',
        body: 'A conversa sai do histórico e deixa de alimentar busca, contexto e memória operacional.',
        confirmLabel: 'Excluir',
      })
    },
    [currentThreadId, deleteThreadAfterConfirmation, interactionLocked, openConfirmDelete, showToast],
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
          pinnedTraceIdSet.has(trace.id),
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
  }, [visibleTraces, pending, retryPending, submitFeedback, runQualityAction, openExecution, pinnedTraceIdSet, togglePinnedTrace])

  // Footer só precisa de safe-area inset bottom (composer interno já é flush).
  // Keyboard avoidance é feito no nível do container (paddingBottom = keyboardHeight)
  // pra empurrar TUDO pra cima, não só padding interno do footer.
  const footerPaddingBottom = Math.max(12, insets.bottom + 8)

  // v18 · Container condicional · em sheet mode usa SideSheet (slide animado
  // overlay), em screen mode usa View flex 1 direto com safe-area top inset
  // (Atlas AI é tela primária, não há slide-in). Variável renderContainer
  // wrap o body com o container correto.
  const renderContainer = (body: ReactNode): ReactNode =>
    isScreen ? (
      <AtlasAiScreenContainer>{body}</AtlasAiScreenContainer>
    ) : (
      <SideSheet visible={visible}>{body}</SideSheet>
    )

  // v18 · Keyboard avoidance · paddingBottom no fill empurra TODO o conteúdo
  // pra cima quando teclado abre. KeyboardAvoidingView misbehaves no SideSheet
  // (comentário acima na linha 849), então fazemos manual: keyboardHeight vem
  // do listener Keyboard.addListener. Quando keyboard fecha, padding volta a 0.
  // FlatList encolhe pra acomodar (já é flex: 1) e Footer composer fica
  // visível logo acima do teclado · vocabulário "Don Corleone scrivendo carta".
  // Slice 6n · keyboardOffset agora derivado do shared value (animated).
  // Mantido useState keyboardHeight pra outros consumers (telemetry,
  // recording logic, etc) que ainda usam sync value.
  void keyboardHeight // referenced via setState only for telemetry now
  // Animated paddingBottom matching iOS keyboard curve. insetBottom
  // subtraído pra evitar double-safe-area-stack.
  const insetsBottom = insets.bottom
  const fillAnimStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(0, keyboardHeightShared.value - insetsBottom),
  }))
  const voiceRecordingBlockReason = recordingActive
    ? null
    : mobileVoiceRecordingBlockReason({
        modeOpen: voiceModeOpen,
        sessionId: voiceSessionId,
        sessionReady: voiceSessionReady,
        state: voiceModeState,
        recordingActive,
        operationInFlight: recordOpInFlightRef.current,
        ending: voiceEndingRef.current,
      })
  const voiceRecordingEnabled = recordingActive || voiceRecordingBlockReason === null

  return renderContainer(
    <>
      <Animated.View style={[styles.fill, fillAnimStyle]}>
        <AtlasAiHeader
          loading={loading}
          onBack={closeAndGoBack}
          onOpenThreads={() => setThreadHistoryOpen(true)}
          onNewThread={startNewThread}
          onRefresh={() => void refresh()}
        />

        {/*
          v18 · ContinuityPanel agora é ListHeaderComponent do FlatList
          (mudança da Onda 4.1). Antes ficava fora do FlatList em
          <View style={styles.threadHeader}> pra preservar sticky behaviour,
          mas isso causava problema CRÍTICO: quando o panel é expanded
          (i. ESTADO + ii. OPERAÇÕES com 6+ items + iii. VISTAS), o conteúdo
          excede a viewport mas a View estática não rola → user não conseguia
          ver Skills/Copiar/Execução nos final.
          Agora o ContinuityPanel rola JUNTO com os turns dentro do FlatList
          scroll. Sticky behaviour foi removido (não era essencial — empty
          state e long conversations ambos beneficiam de scroll natural).
        */}
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
                    ? <AtlasAiEmptyPage />
                    : <AtlasAiFilteredEmpty label={turnFilterLabel(turnFilter, 0)} onReset={() => setTurnFilter('all')} />)
                : null
            }
            ListHeaderComponent={
              <View style={styles.threadHeader}>
                {/* v18 · ContinuityPanel dentro do FlatList ListHeader · rola
                    junto com turns. Resolve bug de tela não rolar quando o
                    panel é expanded e ocupa mais que viewport. */}
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
              </View>
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
                  onOpenAttachment={openHistoricalAttachment}
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

        <AtlasAiComposerFooter
          footerPaddingBottom={footerPaddingBottom}
          copyToast={copyToast}
          draft={draft}
          onChangeDraft={setDraft}
          onSubmit={submit}
          interactionLocked={composerLocked}
          executor={routing.executor}
          destinoOverride={destinoOverride}
          decideEnabled={canClassifyDraftAsCapture}
          onOpenRouting={openRouting}
          onSetDestinoOverride={setDestinoOverride}
          draftAttachments={draftAttachments}
          draftFileAttachments={draftFileAttachments}
          onOpenAttachment={setPreviewAttachment}
          onRemoveAttachment={removeDraftAttachment}
          onRemoveFileAttachment={removeDraftFileAttachment}
          onOpenAttachmentSheet={() => setAttachmentSheetOpen(true)}
          onOpenVoiceMode={openVoiceMode}
          onStartRecording={() => void handleComposerRecordStart()}
          recording={recordingActive}
          turnCount={turns.length}
          mode={routing.mode}
          computeEffort={computeEffort}
          onComputeEffortChange={setComputeEffort}
        />
      </Animated.View>

      {attachmentSheetOpen ? (
        <AttachmentSheet
          visible
          busy={attachmentBusy}
          onClose={() => setAttachmentSheetOpen(false)}
          onPasteImage={pasteClipboardImage}
          onCamera={pickCameraImage}
          onPhotos={pickPhotoImages}
          onFiles={pickDocumentFiles}
        />
      ) : null}

      {previewAttachment ? (
        <AttachmentImageViewer
          visible
          imageUri={previewAttachment.uri}
          title={previewAttachment.fileName ?? 'imagem anexada'}
          onClose={() => setPreviewAttachment(null)}
          onRemove={() => removeDraftAttachment(previewAttachment.id)}
        />
      ) : null}

      {previewHistoricalAttachment ? (
        <PdfAttachmentViewer
          attachment={previewHistoricalAttachment}
          onClose={() => setPreviewHistoricalAttachment(null)}
        />
      ) : null}

      {previewHistoricalImage?.content_url ? (
        <AttachmentImageViewer
          visible
          imageUri={atlasMediaUrl(previewHistoricalImage.content_url)}
          imageHeaders={getAtlasAuthHeaders()}
          title={previewHistoricalImage.name || 'imagem anexada'}
          onClose={() => setPreviewHistoricalImage(null)}
        />
      ) : null}

      {/* v18 · canon mockup atlas-home-editorial · 5 sections numeradas
          (modo · tarefa · domínio · executor · forma) com destino-list
          vertical. Substitui RoutingSheet (que tinha pílulas azuis SaaS
          em tarefa+domínio) sem mudar contrato (mesmas props initial/
          onClose/onConfirm e mesma lógica funcional sanitize+applyMode). */}
      {routingOpen ? (
        <AtlasDecideSheet
          visible
          initial={routing}
          onClose={() => setRoutingOpen(false)}
          onConfirm={confirmRouting}
        />
      ) : null}

      {/* CANON PROMISE redesign · ComposerModeSheet / ComposerProviderSheet
          REMOVIDOS após review do usuário. Auto pill agora abre routing
          FULL (AtlasDecideSheet acima) preservando todas as configurações
          (mode/task/domain/style/executor). Sheets dedicados perdiam
          task/domain/style — eram regressão UX. */}


      {/* v18 · Voice Mode · canon mockup · conversa por voz tempo real
          fullscreen sem chrome. Acessado via long-press no ✦ send do
          composer (gesture canon Atlas). ✦ bronze 96px pulsing centered
          com cadência variável por estado (listening 1.2s · thinking 1.5s
          · speaking 0.6s) + waveform 10 bars sequencial + indicator italic
          "Atlas escutando./pensando./falando." + Encerrar mono caps no
          rodapé. Vocabulário "salão Don Corleone": tela inteira é o ato. */}
      {voiceModeOpen ? (
        <VoiceModeSheet
          visible
          state={voiceModeState}
          recording={recordingActive}
          recordingEnabled={voiceRecordingEnabled}
          recordingUnavailableReason={voiceRecordingBlockReason}
          liveKitSession={voiceLiveKitSession}
          statusDetail={voiceStatusDetail}
          onLiveKitConnected={handleVoiceLiveKitConnected}
          onLiveKitDisconnected={handleVoiceLiveKitDisconnected}
          onLiveKitError={handleVoiceLiveKitError}
          onClose={() => closeVoiceMode()}
        />
      ) : null}

      {/* v18 · Modo Gravar overlay enterprise (v2) · 3 botões claros.
          Entra em lock automático · solta dedo NÃO envia. Cancelar com
          confirmação interna (tap 1: "Cancelar?", tap 2: descarta).
          Pausar toggleable · canon iOS Voice Memo. Enviar é único caminho
          de envio · ato editorial bronze. */}
      <RecordModeStrip
        visible={recordingActive && !voiceModeOpen}
        durationMs={composerRecorderState.durationMillis}
        paused={recordingPaused}
        onCancel={() => { void handleComposerRecordCancel() }}
        onSend={() => { void handleComposerRecordSend() }}
        onPauseToggle={handleComposerRecordPauseToggle}
      />

      {threadHistoryOpen ? (
        <AtlasAiThreadHistorySheet
          visible
          threads={threadList}
          currentThreadId={currentThreadId}
          listError={threadListError}
          listRefreshing={threadListRefreshing}
          hasMore={hasMore}
          onRetryList={retryThreadListFetch}
          onLoadMore={loadMoreThreads}
          onClose={() => setThreadHistoryOpen(false)}
          onSelect={selectThread}
          onNew={startNewThread}
          onDelete={deleteThread}
        />
      ) : null}

      {contextOpen ? (
        <ContextSheet
          visible
          thread={currentThread}
          state={sessionState}
          compaction={currentThread?.latest_compaction ?? null}
          handoff={currentThread?.latest_provider_handoff ?? null}
          snapshots={contextSnapshots}
          latestTrace={latestTrace}
          onClose={() => setContextOpen(false)}
        />
      ) : null}

      {operationsOpen ? (
        <OperationsSheet
          visible
          providerStatus={providerStatus}
          observability={observability}
          qualityActions={qualityActions}
          onClose={() => setOperationsOpen(false)}
          onRunQualityAction={runQualityAction}
        />
      ) : null}

      {executionOpen ? (
        <ExecutionSheet
          visible
          trace={executionTrace}
          loading={executionLoading}
          onClose={() => setExecutionOpen(false)}
          onRefresh={(trace) => void openExecution(trace)}
          onRunQualityAction={runQualityAction}
          onRetryJob={retryJob}
          onCancelJob={cancelJob}
        />
      ) : null}

      {skillsOpen ? (
        <SkillsSheet
          visible
          traces={traces}
          qualityActions={qualityActions}
          onClose={() => setSkillsOpen(false)}
        />
      ) : null}

      {searchOpen ? (
        <SearchSheet
          visible
          traces={traces}
          pinnedTraceIds={pinnedTraceIds}
          onClose={() => setSearchOpen(false)}
          onOpenExecution={openExecution}
          onTogglePin={togglePinnedTrace}
          responseTextForTrace={pickResponseText}
        />
      ) : null}

      {sessionMapOpen ? (
        <SessionMapSheet
          visible
          state={sessionState}
          traces={traces}
          qualityActions={qualityActions}
          pinnedTraceIds={pinnedTraceIds}
          onClose={() => setSessionMapOpen(false)}
        />
      ) : null}
    </>,
  )
}


export type { RoutingExecutor }

function atlasMediaUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${getApiBase()}${url.startsWith('/') ? '' : '/'}${url}`
}

function estimateSpokenResponseDurationMs(text: string): number {
  const wordCount = Math.max(1, text.trim().split(/\s+/).filter(Boolean).length)
  const wordsPerMinute = 155
  return Math.max(900, Math.min(20000, Math.round((wordCount / wordsPerMinute) * 60_000)))
}

function recordFromUnknown(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function errorClassFromUnknown(error: unknown): string {
  return error instanceof Error && error.name ? error.name : 'UnknownError'
}

function voiceSessionStartFailureDetail(status: string | null, tokenStatus: string | null): string {
  if (status === 'session_started_scaffold') return 'Backend ainda retornou scaffold.'
  if (tokenStatus === 'not_issued_missing_config') return 'LiveKit sem URL ou credenciais no backend.'
  if (tokenStatus === 'blocked_by_eclipse') return 'Sessão bloqueada pela política de segurança.'
  if (tokenStatus && tokenStatus !== 'issued') return `LiveKit token indisponível: ${tokenStatus}.`

  return 'Sessão de voz não ficou pronta.'
}

async function recordMobileVoiceRuntimeFailedWithError(
  input: MobileVoiceRuntimeFailedPayload,
  error: unknown,
): Promise<void> {
  const errorMessageHash = input.error_message_hash ?? await errorMessageHashFromUnknown(error)
  await recordMobileVoiceRuntimeFailedWithTelemetry({
    ...input,
    ...(errorMessageHash ? { error_message_hash: errorMessageHash } : {}),
  }, {
    source: 'exception',
    errorClass: errorClassFromUnknown(error),
  })
}

async function recordMobileVoiceRuntimeFailedWithTelemetry(
  input: MobileVoiceRuntimeFailedPayload,
  metadata: { source?: string; traceId?: string | null; errorClass?: string | null } = {},
): Promise<void> {
  const startedAt = Date.now()
  try {
    await recordMobileVoiceRuntimeFailed(input)
    await recordAtlasAiEvent({
      eventName: 'mobile_voice_runtime_failure_recorded',
      trace_id: metadata.traceId ?? undefined,
      metadata: {
        source: metadata.source ?? 'runtime',
        session_id: input.session_id,
        turn_id: input.turn_id,
        failure_code: input.failure_code ?? null,
        error_class: input.error_class ?? metadata.errorClass ?? null,
        error_message_hash_present: typeof input.error_message_hash === 'string' && input.error_message_hash.trim().length > 0,
        callback_latency_ms: input.latency_ms ?? null,
        latency_ms: Math.max(0, Math.round(Date.now() - startedAt)),
      },
    })
  } catch (error) {
    await recordAtlasAiEvent({
      eventName: 'mobile_voice_runtime_failure_record_failed',
      trace_id: metadata.traceId ?? undefined,
      metadata: {
        source: metadata.source ?? 'runtime',
        session_id: input.session_id,
        turn_id: input.turn_id,
        failure_code: input.failure_code ?? null,
        error_class: input.error_class ?? metadata.errorClass ?? null,
        record_error_class: errorClassFromUnknown(error),
        latency_ms: Math.max(0, Math.round(Date.now() - startedAt)),
      },
    })
  }
}

async function errorMessageHashFromUnknown(error: unknown): Promise<string | undefined> {
  const message = error instanceof Error
    ? error.message.trim()
    : typeof error === 'string'
      ? error.trim()
      : ''

  if (!message) return undefined

  try {
    return await sha256Hex(message)
  } catch {
    return undefined
  }
}

function voiceTurnLifecycleKey(turn: VoiceRuntimeTurn, traceId: string): string {
  return `${turn.sessionId}:${turn.turnId}:${traceId}`
}

function captureDomainForVoiceRouting(domain: RoutingDomain): string {
  return ['atlas', 'saude', 'blackink', 'financas'].includes(domain) ? domain : 'atlas'
}
