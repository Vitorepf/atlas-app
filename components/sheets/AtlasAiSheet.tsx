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
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
import {
  LayoutAnimationConfig,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, usePathname } from 'expo-router'
import { SideSheet } from './SideSheet'
import { Frau, Mono, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useShell } from '../AtlasShell'
import { useOverlays } from '../../lib/overlays'
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
  type AtlasAiThread,
  type AtlasAiTrace,
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
  listAiInteractions,
  listAiQualityActions,
  listAiThreadSnapshots,
  listAiThreads,
  retryMobileInboxDiscussionBootstrap,
  retryAiJob,
  runAiQualityAction,
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
  numberFromRecord,
  stringFromRecord,
} from './atlas-ai/AtlasAiRecordModel'
import { styles } from './atlas-ai/AtlasAiSheet.styles'
import { copyToClipboard } from './atlas-ai/AtlasAiClipboard'
import { AtlasAiHeader } from './atlas-ai/AtlasAiHeader'
import {
  PENDING_SUBMISSION_RETRY_DELAY_MS,
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
  atlasModePayloadForRouting,
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
  const composerRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const composerRecorderState = useAudioRecorderState(composerRecorder, 150)
  const recordingActiveRef = useRef(false)
  // Mutex pra Send/Cancel · enterprise canon · evita ambos rodarem juntos
  // se user tap em sequência rápida.
  const recordOpInFlightRef = useRef(false)
  // isMountedRef · evita setState em componente desmontado (React warning +
  // memory leak). Ativo em mount, false em cleanup. Setters checam antes.
  const isMountedRef = useRef(true)
  const createAudioCapture = useAtlasStore((s) => s.createAudioCapture)
  // createTextCapture · canon Atlas Decide · quando destino classificado é
  // 'captura', tap ✦ send NÃO invoca Atlas AI · cria text capture pro inbox
  // diretamente. Vocabulário: "captura passa por curadoria editorial via
  // Domain Sheet · não vira conversa".
  const createTextCapture = useAtlasStore((s) => s.createTextCapture)

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
  const [keyboardHeight, setKeyboardHeight] = useState(0)
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
  const handleComposerRecordStart = useCallback(async () => {
    if (recordingActiveRef.current) return
    // ✅ FIX RACE CONDITION · marca como ativo IMEDIATAMENTE (síncrono)
    // Próximas chamadas vão sair no guard acima · zero duplicação.
    recordingActiveRef.current = true
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})

    try {
      const permission = await requestRecordingPermissionsAsync()
      if (!permission.granted) {
        recordingActiveRef.current = false  // rollback
        showToast('Permissão de microfone necessária pra gravar')
        return
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
      await composerRecorder.prepareToRecordAsync()
      composerRecorder.record()
      setRecordingActive(true)
      setRecordingPaused(false)
    } catch (err) {
      recordingActiveRef.current = false  // rollback em caso de erro
      const msg = err instanceof Error ? err.message : 'Falha ao iniciar gravação'
      showToast(msg)
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {})
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
      recordOpInFlightRef.current = false
    }
  }, [composerRecorder, composerRecorderState.isRecording, safeSetRecordingActive, safeSetRecordingPaused])

  const handleComposerRecordSend = useCallback(async () => {
    // ✅ FIX MUTEX · evita rodar concurrently com Cancel
    if (recordOpInFlightRef.current) return
    recordOpInFlightRef.current = true

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
        try {
          await createAudioCapture({
            domain: finalDomain,
            fileUri: fileUri!,
            durationMs,
            metadata: {
              captureMode: 'audio',
              captureSurface: 'atlas_ai_composer_long_press',
              source: 'modo_gravar_composer',
              destino: finalDestino,
            },
          })
          showToast('Áudio capturado')
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Falha ao salvar captura'
          showToast(msg)
        }
      })()
    })
  }, [composerRecorder, composerRecorderState, createAudioCapture, openDomain, showToast, safeSetRecordingActive, safeSetRecordingPaused])

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

  // Voice Mode state machine. A sessão real começa no Kernel via mobile
  // gateway; enquanto LiveKit/STT/TTS não estiverem ligados no app, o modal
  // mantém o ciclo visual local como fallback seguro.
  const [voiceModeOpen, setVoiceModeOpen] = useState(false)
  const [voiceModeState, setVoiceModeState] = useState<VoiceModeState>('listening')
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null)
  const [voiceSessionEnvelopeId, setVoiceSessionEnvelopeId] = useState<string | null>(null)
  const [voiceSessionReceiptId, setVoiceSessionReceiptId] = useState<string | null>(null)

  // Cycle demonstrativo · simula loop natural de conversa por voz.
  // listening (4s · usuário fala) → thinking (2s · Atlas processa) →
  // speaking (3s · Atlas responde) → loop. Quando integrar STT/TTS real,
  // remover este useEffect e substituir por hooks de eventos do provider.
  useEffect(() => {
    if (!voiceModeOpen) {
      setVoiceModeState('listening')
      return
    }
    const cycle: Array<{ next: VoiceModeState; duration: number }> = [
      { next: 'thinking', duration: 4000 },
      { next: 'speaking', duration: 2000 },
      { next: 'listening', duration: 3000 },
    ]
    let idx = 0
    const tick = () => {
      const step = cycle[idx % cycle.length]
      setVoiceModeState(step.next)
      idx += 1
    }
    const interval = setInterval(tick, 4000)
    return () => clearInterval(interval)
  }, [voiceModeOpen])

  const openVoiceMode = useCallback(() => {
    if (recordingActiveRef.current) {
      return
    }

    const sessionId = `mobile_voice_${Date.now()}`
    const envelopeId = `mobile_voice_env_${Date.now()}`
    const receiptId = `mobile_voice_receipt_${Date.now()}`
    setVoiceSessionId(sessionId)
    setVoiceSessionEnvelopeId(envelopeId)
    setVoiceSessionReceiptId(receiptId)
    setVoiceModeState('listening')
    setVoiceModeOpen(true)

    void startMobileVoiceSession({
      session_id: sessionId,
      envelope_id: envelopeId,
      receipt_id: receiptId,
      participant_identity: 'mobile:vitor',
    }).catch((error) => {
      showToast(humanAiError(error, 'Voz local aberta; Atlas Server ainda nao iniciou a sessao.'))
    })
  }, [showToast])

  const closeVoiceMode = useCallback(() => {
    const sessionId = voiceSessionId
    const envelopeId = voiceSessionEnvelopeId ?? undefined
    const receiptId = voiceSessionReceiptId ?? undefined
    setVoiceModeOpen(false)
    setVoiceSessionId(null)
    setVoiceSessionEnvelopeId(null)
    setVoiceSessionReceiptId(null)

    if (!sessionId) return

    void endMobileVoiceSession({
      session_id: sessionId,
      envelope_id: envelopeId,
      receipt_id: receiptId,
      reason: 'operator_closed_mobile_voice',
    }).catch(() => {
      // O fechamento visual é local e deve continuar funcionando offline.
    })
  }, [voiceSessionEnvelopeId, voiceSessionId, voiceSessionReceiptId])
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
    currentThreadIdRef.current = currentThreadId
  }, [currentThreadId])

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
  const threadListEnabled = visible && !requestedThreadId && (threadHistoryOpen || atlasWarmupReady)
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
        const domainSelection = domainCatalog
          ? selectAtlasAiDomainFlow(domainCatalog, {
              surface_id: 'atlas_app',
              mode: routingSnapshot.mode,
              task: routingSnapshot.task,
              routing_domain: routingSnapshot.domain,
            })
          : null
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
            ...(domainSelection?.status === 'ok' ? compactDomainSelectionPayloadPatch(domainSelection.payload_patch) : {}),
            domain_catalog_selection: domainSelection ? compactDomainSelectionForPayload(domainSelection) : undefined,
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
  const keyboardOffset = keyboardHeight > 0 ? Math.max(0, keyboardHeight - insets.bottom) : 0

  return renderContainer(
    <>
      <View style={[styles.fill, keyboardOffset > 0 && { paddingBottom: keyboardOffset }]}>
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

        <AtlasAiComposerFooter
          footerPaddingBottom={footerPaddingBottom}
          copyToast={copyToast}
          draft={draft}
          onChangeDraft={setDraft}
          onSubmit={submit}
          interactionLocked={interactionLocked}
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
        />
      </View>

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
          onClose={closeVoiceMode}
        />
      ) : null}

      {/* v18 · Modo Gravar overlay enterprise (v2) · 3 botões claros.
          Entra em lock automático · solta dedo NÃO envia. Cancelar com
          confirmação interna (tap 1: "Cancelar?", tap 2: descarta).
          Pausar toggleable · canon iOS Voice Memo. Enviar é único caminho
          de envio · ato editorial bronze. */}
      <RecordModeStrip
        visible={recordingActive}
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
