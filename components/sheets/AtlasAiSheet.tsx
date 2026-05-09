import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AppState,
  Alert,
  type AppStateStatus,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native'
import { atlasStorage } from '../../lib/storage'
import * as Clipboard from 'expo-clipboard'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio'
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
import { Sparkle } from '../Sparkle'
import { SwipeableCard } from '../inbox/SwipeableCard'
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
  type AiInteractionFileAttachmentInput,
  type AiInteractionImageAttachmentInput,
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
  getAtlasAuthHeaders,
  getApiBase,
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
import { BronzeDiamond } from '../console/BronzeDiamond'
// v18 · Modo Gravar via long-press ✦ send do composer · canon Atlas radical.
// Substitui Voice Mode no gesture (que perdeu trigger quando dock sumiu em /).
// Captura silenciosa pro inbox · vocabulário "WhatsApp voice memo".
import { RecordModeStrip } from '../inbox/RecordModeStrip'
import { useAtlasStore } from '../../lib/atlasStore'
import { CaptionWhisper } from '../console/CaptionWhisper'
import { FieldInline } from '../console/FieldInline'
import { AttachmentImageViewer } from '../console/AttachmentImageViewer'
import { BottomSheet } from './BottomSheet'
import { PageResponse } from '../console/PageResponse'
import { QuoteCompact } from '../console/QuoteCompact'
// v18 · RoutingSheet substituído por AtlasDecideSheet (canon mockup com
// 5 sections numeradas + destino-list editorial). Vocabulário 100% editorial:
// pílulas azuis arredondadas (SaaS) deram lugar a lista vertical com ✦
// no item ativo. Lógica funcional preservada (sanitize/applyAtlasMode/etc).
import { AtlasDecideSheet } from './AtlasDecideSheet'
// v18 · editorial atoms canon (SectionHead numeral romano, TocRow label+leader+value,
// DestinoItem glyph+label+subtitle) usados em ContinuityPanel + outras telas
// pra unificar vocabulário visual entre todas as sub-sheets do Atlas AI.
import { SectionHead, TocRow, DestinoItem } from '../editorial'
// v18 · Voice Mode (conversa por voz tempo real fullscreen) · canon mockup
// atlas-home-editorial · acessado via long-press no ✦ send do composer.
import { VoiceModeSheet, type VoiceModeState } from './VoiceModeSheet'
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
import {
  selectAtlasAiDomainFlow,
  type AtlasAiDomainFlowSelection,
} from '../../lib/atlasAiDomainCatalog'

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
  // rotaciona pelos 4 destinos (captura/conversa/tarefa/projeto). Quando null,
  // usa o classifier auto baseado no texto. Reset quando draft esvazia.
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
    if (!visible) return
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
  }, [visible])

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
  const PAGE_SIZE = 10
  const PAGE_MAX = 100  // backend max
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE)

  const threadListEnabled = visible && !requestedThreadId
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
    enabled: threadListEnabled || threadHistoryOpen,
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
    // Diagnostic log · ajuda a achar problema quando user reporta "0 conversas"
    // mas backend tem threads. Remover após estabilizar.
    if (__DEV__ && threadListQuery.data) {
      // eslint-disable-next-line no-console
      console.log('[Histórico] query.data:', {
        threads_count: Array.isArray(threads) ? threads.length : 'NOT_ARRAY',
        pageLimit,
        isFetching: threadListQuery.isFetching,
        error: threadListQuery.error?.message ?? null,
      })
    }
  }, [threadListQuery.data, threadListQuery.error, threadListQuery.isFetching, pageLimit])

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
  }, [loadThreadData, requestedThreadId, visible])

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
  // text capture e abre Domain Sheet pra escolher domain. Outros destinos
  // (conversa/tarefa/projeto) seguem fluxo Atlas AI atual (submitText).
  const submit = useCallback(() => {
    const text = draft.trim()
    if (!text) return

    // Destino efetivo · override do user (via "trocar") sobrepõe classifier auto.
    const effectiveDestino = destinoOverride ?? classifyDecideDestino(text)

    // CAPTURA · abre Domain Sheet "Categorizar + Elaborar" pra user escolher
    // domain (i.) + destino editorial (ii.). Callback recebe ambos · branch
    // baseado em destino:
    //   · conversar → submitText (fluxo Atlas AI tradicional)
    //   · tarefa/projeto → futuro: Atlas Decide estrutura (por agora vai
    //     pro Atlas AI também)
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

        // TAREFA / PROJETO · futuro: Atlas estrutura via LLM. Por agora,
        // delega pro submitText com hint no metadata.
        if (finalDestino === 'tarefa' || finalDestino === 'projeto') {
          // TODO: integrar Atlas Decide structure (tarefa/projeto). Fallback
          // atual usa submitText pra manter funcional · backend pode usar
          // metadata pra detectar intent.
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
        {/* Header 3-column [← Voltar / Atlas / ≡ + ✦] · borderBottomColor
            bronze@18% (canon mockup atlas-ai-header) — vocabulário editorial
            premium, não cinza neutro c.border. ${c.bronze}2E = bronze + alpha
            hex 2E (≈ 18%). Funciona pra light + dark mode (palette tem bronze
            específico em cada). */}
        <View style={[styles.header, { borderBottomColor: `${c.bronze}2E` }]}>
          <Pressable
            onPress={closeAndGoBack}
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
                    ? <EmptyPage />
                    : <FilteredEmpty filter={turnFilter} onReset={() => setTurnFilter('all')} />)
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
          {/* v18 · DecideStatusLine canon premium · substitui o StatusRouting
              "atlas decide · trocar" antigo (feio + redundante) por linha
              limpa: só "atlas" (ou claude/codex/gemini/conselho) quando vazio.
              Quando user digita, vira "atlas · captura · trocar" — modelo +
              destino classificado + link toggle. Tap em modelo/destino abre
              Atlas Decide Sheet (config). Tap em "trocar" rotaciona pelos
              4 destinos (captura/conversa/tarefa/projeto). */}
          <DecideStatusLine
            text={draft}
            executor={routing.executor}
            destinoOverride={destinoOverride}
            onOpenConfig={openRouting}
            onToggleDestino={(next) => setDestinoOverride(next)}
            locked={interactionLocked}
          />
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
            // Long-press idle abre Voice Mode mobile-first. Com texto/anexo no
            // composer, preserva Modo Gravar como captura operacional.
            onLongPressSend={() => {
              if (draft.trim().length === 0 && draftAttachments.length === 0 && draftFileAttachments.length === 0) {
                openVoiceMode()
                return
              }
              void handleComposerRecordStart()
            }}
            recording={recordingActive}
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

      {/* v18 · canon mockup atlas-home-editorial · 5 sections numeradas
          (modo · tarefa · domínio · executor · forma) com destino-list
          vertical. Substitui RoutingSheet (que tinha pílulas azuis SaaS
          em tarefa+domínio) sem mudar contrato (mesmas props initial/
          onClose/onConfirm e mesma lógica funcional sanitize+applyMode). */}
      <AtlasDecideSheet
        visible={routingOpen}
        initial={routing}
        onClose={() => setRoutingOpen(false)}
        onConfirm={confirmRouting}
      />

      {/* v18 · Voice Mode · canon mockup · conversa por voz tempo real
          fullscreen sem chrome. Acessado via long-press no ✦ send do
          composer (gesture canon Atlas). ✦ bronze 96px pulsing centered
          com cadência variável por estado (listening 1.2s · thinking 1.5s
          · speaking 0.6s) + waveform 10 bars sequencial + indicator italic
          "Atlas escutando./pensando./falando." + Encerrar mono caps no
          rodapé. Vocabulário "salão Don Corleone": tela inteira é o ato. */}
      <VoiceModeSheet
        visible={voiceModeOpen}
        state={voiceModeState}
        onClose={closeVoiceMode}
      />

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

      <ThreadHistorySheet
        visible={threadHistoryOpen}
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
    </>,
  )
}

// AtlasAiScreenContainer · canon v18 · wrapper alternativo ao SideSheet quando
// Atlas AI é renderizado como tela primária (rota `/`). Sem slide animation,
// sem overlay zIndex — só flex fill + safe-area top inset. Mesma estrutura
// visual do SideSheet (backgroundColor c.bg + paddingTop), mas em flow normal
// do Stack expo-router em vez de overlay absolute.
function AtlasAiScreenContainer({ children }: { children: ReactNode }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  // paddingTop · safe-area top inset (status bar do iPhone).
  // paddingBottom NÃO aplicado · o footer interno (composer) já tem
  // footerPaddingBottom = insets.bottom + 8 (linha ~2034). Aplicar aqui
  // duplicaria espaço e empurraria o composer pra fora da viewport.
  return (
    <View
      style={[
        styles.screenContainer,
        { backgroundColor: c.bg, paddingTop: insets.top },
      ]}
    >
      {children}
    </View>
  )
}

function EmptyPage() {
  const { c } = useTheme()
  // Empty state · canon ultra-premium · canon mockup atlas-ai-empty refinado.
  // ✦ Frau italic 32 bronze (era 22 · agora matching ✦ send do composer ·
  // peso editorial pleno · "Atlas presente em ato cognitivo"). Gap 40 entre
  // ✦ e pergunta-norte (era 32 · respiração canon Don Corleone).
  // ✦ ganha signet ring shadow (mesmo polish A do send).
  // Container: paddingBottom 96 puxa o centro visual pra cima do terço
  // geométrico · vocabulário canon "pergunta sobe das mãos" · Don Corleone.
  return (
    <View style={styles.empty}>
      <Frau
        italic
        size={32}
        lineHeight={32}
        color={c.bronze}
        style={{
          textShadowColor: `${c.bronze}4D`,
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }}
      >
        ✦
      </Frau>
      <View style={{ height: 40 }} />
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
      {/* Top row · "continuidade [thread.title]" + "· expandir/recolher".
          Quando expanded, esconde o "continuidade [thread]" (já que vai ter
          header editorial completo abaixo) e mantém apenas o link "· recolher"
          alinhado à direita. */}
      <View style={[styles.continuityTop, (!thread?.title || expanded) ? styles.continuityTopEmpty : null]}>
        {thread?.title && !expanded ? (
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
          {/* Header editorial canon mockup · eyebrow CONTINUIDADE DA SESSÃO
              (mono caps small) + title "Atlas · sessão atual." (Frau italic 22
              afirmativo com ponto · vocabulário "ato encerrado") + hairline.
              Substitui o "continuidade [thread.title]" minimalista por header
              editorial completo · vocabulário canon. */}
          <View style={styles.continuityHeader}>
            <Mono size={11} lineHeight={14} letterSpacing={1.6} color={c.ink2} style={styles.continuityHeaderEyebrow}>
              CONTINUIDADE DA SESSÃO
            </Mono>
            <Frau italic size={22} lineHeight={29} letterSpacing={-0.18} color={c.ink}>
              {thread?.title || 'Atlas · sessão atual.'}
            </Frau>
          </View>
          <View style={[styles.continuityHeaderRule, { backgroundColor: `${c.ink}1F` }]} />

          {/* i. ESTADO · canon mockup atlas-home-editorial · 5 toc-rows com
              label italic Frau + leader dotted + value Frau. Vocabulário Don
              Corleone "escritório em ordem": quando tudo é zero, mostra
              "em repouso"/"89/100" (silêncio editorial); quando há atividade
              real, valores detalhados. Substitui MicroLine grid 2-col SaaS.
              withDivider={false} canon · sem hairlines entre toc-rows · só
              leader dotted separa label/value. Items respiram com gap. */}
          <View style={styles.continuitySection}>
            <SectionHead numeral="i" title="Estado" />
            <TocRow withDivider={false} variant="doorway" label="estado" value={topic} />
            <TocRow withDivider={false} variant="doorway" label="memória" value={compactionLabel} />
            <TocRow withDivider={false} variant="doorway" label="troca" value={handoffLabel} />
            <TocRow
              withDivider={false}
              variant="doorway"
              label="operação"
              value={operacaoSummary(queue, openActions.length)}
            />
            <TocRow
              withDivider={false}
              variant="doorway"
              label="qualidade"
              value={qualitySummary(observability, openActions)}
            />
          </View>

          {/* Sync dateline · canon mockup .continuity-sync · italic Frau 14
              ink2 com em-dash inicial (vocabulário "atribuição de citação"
              aplicado a marca temporal). Substitui RuntimeStrip antigo que
              tinha mesma info mas sem peso editorial. */}
          <SyncDateline
            activeTrace={activeTrace}
            activeTraceAgeMs={activeTraceAgeMs}
            lastRefreshAt={lastRefreshAt}
            lastRefreshError={lastRefreshError}
            refreshFailures={refreshFailures}
          />

          {/* ii. OPERAÇÕES · canon mockup · 6 destino-items vertical (Compactar
              · Contexto · Mapa · Buscar · Fila · Skills + extras condicionais).
              Substitui pílulas inline antigas (vocabulário SaaS proibido) por
              lista canônica · cada item: · glyph + label Frau med 17 + subtitle
              italic 13. Active = ✦ bronze (Atlas em ato cognitivo). isLast no
              último item dinâmico (depende de hasTurns + latestTrace) evita
              hairline-bottom redundante antes da próxima section. */}
          <View style={styles.continuitySection}>
            <SectionHead numeral="ii" title="Operações" />
            <DestinoItem
              label={busy === 'compact' ? 'Compactando' : 'Compactar'}
              subtitle="comprime memória da sessão atual"
              onPress={onCompact}
              disabled={disabled || busy === 'compact'}
            />
            <DestinoItem
              label="Contexto"
              subtitle="abrir Context Pack ativo"
              onPress={onOpenContext}
            />
            <DestinoItem
              label="Mapa"
              subtitle="ver mapa cognitivo do Atlas"
              active={pinnedCount > 0}
              onPress={onOpenMap}
            />
            <DestinoItem
              label="Buscar"
              subtitle="buscar em sessões e memória"
              onPress={onOpenSearch}
            />
            <DestinoItem
              label="Fila"
              subtitle="fila de operações pendentes"
              onPress={onOpenOperations}
            />
            <DestinoItem
              label="Skills"
              subtitle="skills disponíveis"
              isLast={!hasTurns && !latestTrace}
              onPress={onOpenSkills}
            />
            {hasTurns ? (
              <DestinoItem
                label="Copiar"
                subtitle="copia toda a conversa pra clipboard"
                isLast={!latestTrace}
                onPress={onCopyConversation}
              />
            ) : null}
            {latestTrace ? (
              <DestinoItem
                label="Execução"
                subtitle="abre o trace de execução mais recente"
                isLast
                onPress={() => onOpenExecution(latestTrace)}
              />
            ) : null}
          </View>

          {/* iii. VISTAS · filter strip de turns (condicional, só quando há
              turns na conversa). Mantido como section editorial canon · não
              está no mockup mas é funcionalidade essencial pra navegar
              conversas longas. Filter strip horizontal italic Frau ink3,
              underline bronze no ativo (mesma vocabulário do filter strip
              do Inbox · Capturas). */}
          {hasTurns ? (
            <View style={styles.continuitySection}>
              <SectionHead numeral="iii" title="Vistas" />
              <View style={styles.vistasStrip}>
                {(['all', 'pinned', 'decisions', 'actions', 'dev', 'errors'] as AtlasAiTurnFilter[]).map((filter, idx) => {
                  const active = turnFilter === filter
                  return (
                    <Pressable
                      key={filter}
                      onPress={() => onSetTurnFilter(filter)}
                      hitSlop={6}
                      style={({ pressed }) => [styles.vistasItem, { opacity: pressed ? 0.55 : 1 }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Frau
                        italic
                        weight={active ? 'med' : 'reg'}
                        size={14}
                        lineHeight={20}
                        color={active ? c.bronze : c.ink3}
                        style={active ? styles.vistasItemActive : undefined}
                      >
                        {turnFilterLabel(filter, pinnedCount)}
                      </Frau>
                      {idx < 5 ? (
                        <Frau italic size={14} lineHeight={20} color={c.ink3} style={styles.vistasSep}>
                          ·
                        </Frau>
                      ) : null}
                    </Pressable>
                  )
                })}
              </View>
            </View>
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

// v18 · MicroSection, RuntimeStrip e MicroLine removidos · vocabulário SaaS
// que o canon mockup substituiu por SectionHead + TocRow + DestinoItem +
// SyncDateline (editorial atoms reusáveis em components/editorial/). Os
// styles antigos (microSection*, runtimeStrip, microLine, microLabel,
// microValue) também foram retirados do StyleSheet.

// SyncDateline · canon mockup .continuity-sync (atlas-home-editorial-mockup.html
// linha ~2510). Italic Frau 14 ink2 com em-dash inicial — vocabulário "atribuição
// de citação" aplicado a marca temporal de sincronização. Substitui RuntimeStrip
// quando dentro do ContinuityPanel canon — o RuntimeStrip antigo continua
// disponível pra outros usos (ele tem tratamento de erro/stale com cores).
//
// Cores condicionais preservadas:
//   · ink2 padrão (sincronização normal)
//   · bronze quando trace ativo está stale (>10min)
//   · recRed quando há erro de refresh
function SyncDateline({
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
    ? `reconectando · ${refreshFailures} falha${refreshFailures === 1 ? '' : 's'}`
    : stale
      ? `execução longa · ${formatLatency(activeAge ?? 0)}`
      : lastRefreshAt
        ? `sincronizado ${formatRelative(new Date(lastRefreshAt).toISOString())}`
        : 'sincronização aguardando'

  return (
    <View style={styles.syncDateline}>
      <Frau italic size={14} lineHeight={20} color={lastRefreshError ? c.recRed : stale ? c.bronze : c.ink2}>
        — {text}.
      </Frau>
    </View>
  )
}

// operacaoSummary · vocabulário canon Atlas (Don Corleone "escritório em ordem")
// quando todos os contadores são zero, mostra silêncio editorial "em repouso";
// quando há atividade real, valores detalhados. Mesma lógica do mockup canon.
// =============================================================================
// DecideStatusLine · canon premium acima do composer
// =============================================================================
//
// Substitui "atlas decide · trocar" antigo (feio + redundante) pela linha
// canon premium: só "atlas" (ou nome do executor) quando vazio. Quando user
// digita, vira "atlas · captura · trocar" — modelo + destino classificado +
// link toggle.
//
// Comportamentos:
//   · Tap "atlas" (ou nome do executor) → abre Atlas Decide Sheet (config)
//   · Tap "captura" (destino) → abre Atlas Decide Sheet (config)
//   · Tap "trocar" → rotaciona destino (captura → conversa → tarefa →
//     projeto → captura) · seta destinoOverride
//   · Sem texto: "trocar" some (não há destino pra trocar)
//
// O classifier auto roda quando destinoOverride === null. Quando user já
// trocou manualmente (override !== null), respeita a escolha até draft
// esvaziar (que reseta override).
// =============================================================================

export type DecideDestino = 'captura' | 'conversa' | 'tarefa' | 'projeto'

const DESTINO_ORDER: DecideDestino[] = ['captura', 'conversa', 'tarefa', 'projeto']

// Classifier heurístico · roda em real-time sem precisar de backend LLM.
// Quando backend Atlas Decide LLM estiver disponível, substituir por chamada
// API com debounce 300ms. Heurística atual:
//   · vazio → null (não mostra destino)
//   · termina com `?` → conversa (pergunta natural)
//   · texto longo (>= 200 chars) com quebras de linha → projeto (doc densa)
//   · texto médio (>= 80 chars) com escopo → tarefa (algo a fazer)
//   · default (curto) → captura (anotação rápida)
function classifyDecideDestino(text: string): DecideDestino | null {
  const trimmed = text.trim()
  if (trimmed.length === 0) return null

  // Pergunta · termina com ?
  if (/\?\s*$/.test(trimmed)) return 'conversa'

  // Projeto · texto longo + estrutura (parágrafos ou bullets)
  if (trimmed.length >= 200 && /\n\s*\n|^[-*•]/m.test(trimmed)) return 'projeto'

  // Tarefa · médio + verbo imperativo no início (Implementar/Fazer/Criar/etc)
  if (trimmed.length >= 80 && /^(implement|criar?|fazer|desenh|escrev|refator|consert|adicion|remov|atualiz|ajust|configur|publi)/i.test(trimmed)) {
    return 'tarefa'
  }

  // Conversa · começa com pronome interrogativo ou "como/por que/quando/onde"
  if (/^(como|por\s+qu[êe]|quando|onde|qual|quem|o\s+qu[êe]|me\s+(ajud|expli|cont|fal))/i.test(trimmed)) {
    return 'conversa'
  }

  // Default · captura (anotação curta)
  return 'captura'
}

// Label curto pro executor · sem verbo. Canon premium: "atlas" (não "atlas
// decide"), "claude" (não "claude pensa"), etc.
function executorShortLabel(executor: RoutingExecutor): string {
  switch (executor) {
    case 'claude_cli':   return 'claude'
    case 'codex_cli':    return 'codex'
    case 'gemini_cli':   return 'gemini'
    case 'claude_codex': return 'conselho'
    default:             return 'atlas'
  }
}

// Próximo destino na rotação · trocar cycle: captura → conversa → tarefa →
// projeto → captura. Quando current null, começa em captura.
function nextDecideDestino(current: DecideDestino | null): DecideDestino {
  if (current === null) return 'captura'
  const idx = DESTINO_ORDER.indexOf(current)
  return DESTINO_ORDER[(idx + 1) % DESTINO_ORDER.length]
}

function DecideStatusLine({
  text,
  executor,
  destinoOverride,
  onOpenConfig,
  onToggleDestino,
  locked,
}: {
  text: string
  executor: RoutingExecutor
  destinoOverride: DecideDestino | null
  onOpenConfig: () => void
  onToggleDestino: (next: DecideDestino) => void
  locked?: boolean
}) {
  const c = useTheme().c
  const executorLabel = executorShortLabel(executor)
  const classified = classifyDecideDestino(text)
  // destino efetivo · override do user > classifier auto > null (vazio)
  const destino = destinoOverride ?? classified
  // Opacity 0.7 (era 0.55) · canon premium · "atlas" precisa ter presença
  // visível, não sussurro perdido. Locked state mantém 0.35 (clearly disabled).
  const opacity = locked ? 0.35 : 0.7

  // Vazio · só mostra o executor (clicável, abre config)
  if (!destino) {
    return (
      <View style={statusLineStyles.row}>
        <Pressable
          onPress={onOpenConfig}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`atual: ${executorLabel}. tocar para configurar`}
        >
          <Frau italic weight="med" size={16} lineHeight={22} color={c.ink} style={{ opacity }}>
            {executorLabel}
          </Frau>
        </Pressable>
      </View>
    )
  }

  // Com texto · executor · destino · trocar
  return (
    <View style={statusLineStyles.row}>
      <Pressable
        onPress={onOpenConfig}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`atual: ${executorLabel} ${destino}. tocar para configurar`}
      >
        <Frau italic weight="med" size={16} lineHeight={22} color={c.ink} style={{ opacity }}>
          {executorLabel}
        </Frau>
      </Pressable>
      <Frau italic size={16} lineHeight={22} color={c.ink} style={[statusLineStyles.sep, { opacity: opacity * 0.7 }]}>
        ·
      </Frau>
      <Pressable
        onPress={onOpenConfig}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`destino: ${destino}. tocar para configurar`}
      >
        <Frau italic weight="med" size={16} lineHeight={22} color={c.ink} style={{ opacity }}>
          {destino}
        </Frau>
      </Pressable>
      <Frau italic size={16} lineHeight={22} color={c.ink} style={[statusLineStyles.sep, { opacity: opacity * 0.7 }]}>
        ·
      </Frau>
      <Pressable
        onPress={() => onToggleDestino(nextDecideDestino(destino))}
        hitSlop={6}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel={`trocar destino · próximo: ${nextDecideDestino(destino)}`}
      >
        <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity: opacity * 0.7 }}>
          trocar
        </Frau>
      </Pressable>
    </View>
  )
}

const statusLineStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 12,
    minHeight: 44,
  },
  sep: {
    marginHorizontal: 8,
  },
})

function operacaoSummary(
  queue: { queued?: number; processing?: number } | null | undefined,
  openActionsCount: number,
): string {
  const queued = queue?.queued ?? 0
  const processing = queue?.processing ?? 0
  if (queued === 0 && processing === 0 && openActionsCount === 0) {
    return 'em repouso'
  }
  return `fila ${queued} · rodando ${processing} · ações ${openActionsCount}`
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

type ThreadHistorySheetProps = {
  visible: boolean
  threads: AtlasAiThread[]
  currentThreadId: string | null
  listError: string | null
  listRefreshing: boolean
  hasMore: boolean
  onRetryList: () => void
  onLoadMore: () => void
  onClose: () => void
  onSelect: (thread: AtlasAiThread) => void
  onNew: () => void
  onDelete: (thread: AtlasAiThread) => void
}

function ThreadHistorySheetInner({
  visible,
  threads,
  currentThreadId,
  listError,
  listRefreshing,
  hasMore,
  onRetryList,
  onLoadMore,
  onClose,
  onSelect,
  onNew,
  onDelete,
}: ThreadHistorySheetProps) {
  const { c } = useTheme()
  const [query, setQuery] = useState('')
  // ROUND 1 · Debounce 250ms — evita re-cálculo de filtro em cada
  // keystroke. Search continua responsiva visualmente (input controlled),
  // mas filtro só dispara depois que digitação para. Canon enterprise
  // (input "snappy", computação "preguiçosa").
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [modeFilter, setModeFilter] = useState<ThreadHistoryModeFilter>('all')

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === debouncedQuery) return
    const timer = setTimeout(() => setDebouncedQuery(trimmed), 250)
    return () => clearTimeout(timer)
  }, [query, debouncedQuery])

  // ROUND 1 · useMemo nos 4 derivados pesados. Antes: re-filtrava 4 vezes
  // a cada render (mesmo quando só threadList/query/modeFilter não
  // mudavam). Agora: só recompila se deps mudam. Para 30+ threads,
  // economia de ~12ms por render no thread mid-tier.
  const queryFiltered = useMemo(
    () => filterThreads(threads, debouncedQuery),
    [threads, debouncedQuery],
  )
  const modeOptions = useMemo(
    () => threadHistoryModeOptions(queryFiltered),
    [queryFiltered],
  )
  const filtered = useMemo(
    () => (modeFilter === 'all'
      ? queryFiltered
      : queryFiltered.filter((thread) => atlasAiModeFromThread(thread) === modeFilter)),
    [queryFiltered, modeFilter],
  )
  // Sessões CLI "em curso" · canon mockup `i. EM CURSO`. Critério: thread
  // origem CLI + atividade recente (last_message_at < 30 min). Quando
  // backend publicar status real-time via gateway, substituir critério por
  // metadata.status === 'running'.
  const runningCli = useMemo(
    () => filtered.filter((t) => threadIsCli(t) && threadIsRecentlyActive(t)),
    [filtered],
  )
  const totalCount = filtered.length
  const inCurseCount = runningCli.length

  // ROUND 2 · ListHeaderComponent memoizado · evita re-render do header
  // quando data (filtered) muda. Header inclui: título HISTÓRICO + sub
  // counts + search input + error banner + filter strip + section EM
  // CURSO (com EmCursoCards) + section header CONVERSAS + Nova conversa
  // row. Tudo que não é conversa-row vai aqui.
  const headerEl = useMemo(() => (
    <View>
      {/* Header editorial · canon mockup .historico (linha ~2370). Title
          "HISTÓRICO" Frau medium 26 caps letterSpacing 5 (massive editorial,
          vocabulário canon · igual masthead). Hairline + sub-line italic
          centered com counts agregados ("6 conversas · 1 em curso"). */}
      <Frau weight="med" size={26} lineHeight={32} letterSpacing={5} color={c.ink} align="center">
        HISTÓRICO
      </Frau>
      <View style={[styles.headingRule, { backgroundColor: c.border }]} />
      <Frau italic size={13} lineHeight={19} color={c.ink2} align="center" style={styles.historicoSub}>
        {totalCount === 1 ? '1 conversa' : `${totalCount} conversas`}
        {inCurseCount > 0 ? ` · ${inCurseCount} em curso` : ''}
      </Frau>

      {/* Search line · hairline-only no topo · sem bg cream rounded SaaS.
          Vocabulário canon: minimal, só hairline bottom como underline. */}
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
        style={[styles.historicoSearch, { color: c.ink, borderBottomColor: c.border }]}
      />

      {/* ROUND 1 · Error banner editorial · vocabulário canon (sem
          badge SaaS vermelho gigante). Hairline accent recRedMuted
          border-left + texto Frau italic + retry como link mono caps
          inline. */}
      {listError ? (
        <View style={[styles.historicoErrorBanner, { borderLeftColor: c.recRedMuted, backgroundColor: `${c.recRedMuted}0A` }]}>
          <View style={{ flex: 1 }}>
            <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.recRedMuted} weight="med">
              FALHA NA SINCRONIA
            </Mono>
            <Frau italic size={13} lineHeight={19} color={c.ink2} style={{ marginTop: 4 }}>
              {listError}
            </Frau>
          </View>
          <Pressable
            onPress={onRetryList}
            disabled={listRefreshing}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: listRefreshing ? 0.4 : pressed ? 0.55 : 1, marginLeft: 12 })}
            accessibilityRole="button"
            accessibilityLabel="tentar novamente"
          >
            <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.bronze} weight="med">
              {listRefreshing ? 'TENTANDO…' : 'TENTAR DE NOVO'}
            </Mono>
          </Pressable>
        </View>
      ) : null}

      {/* Filter strip horizontal · canon mockup .modo-filter / .filter-tabs
          (mesmo do Inbox · Capturas). */}
      <View style={styles.historicoFilter}>
        {modeOptions.map((option, idx) => {
          const active = modeFilter === option.key
          return (
            <Pressable
              key={option.key}
              onPress={() => setModeFilter(option.key)}
              hitSlop={6}
              style={({ pressed }) => [styles.historicoFilterItem, { opacity: pressed ? 0.55 : 1 }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Frau
                italic
                weight={active ? 'med' : 'reg'}
                size={14}
                lineHeight={20}
                color={active ? c.bronze : c.ink2}
                style={active ? styles.historicoFilterActive : undefined}
              >
                {option.label.toLowerCase()}
              </Frau>
              <Mono size={9.5} lineHeight={13} letterSpacing={0.4} color={c.ink3} style={styles.historicoFilterCount}>
                ({option.count})
              </Mono>
              {idx < modeOptions.length - 1 ? (
                <Frau italic size={14} lineHeight={20} color={c.ink3} style={styles.historicoFilterSep}>
                  ·
                </Frau>
              ) : null}
            </Pressable>
          )
        })}
      </View>

      {/* REDESIGN v3 · Section EM CURSO de volta (charme canon).
          Numeral i. mono bronze + EM CURSO Frau caps + deck italic.
          Card EmCursoCard com ✦ pulsing + actions inline. Só renderiza
          quando há sessões CLI ativas (silêncio editorial quando vazio).
          As threads que aparecem aqui SÃO removidas do agrupamento
          temporal HOJE/ONTEM abaixo (evita duplicação). */}
      {runningCli.length > 0 ? (
        <View>
          <SectionHead
            numeral="i"
            title="Em curso"
            deck="sessões Atlas CLI rodando · acompanhe pelo mobile"
          />
          {runningCli.map((thread) => (
            <EmCursoCard
              key={thread.id}
              thread={thread}
              onContinue={() => {
                onSelect(thread)
                onClose()
              }}
            />
          ))}
        </View>
      ) : null}

      {/* Nova conversa entry · hairline simples acima (mesmo padrão das
          conversa-rows abaixo) · sem traço bronze que destacava demais e
          quebrava o vocabulário visual uniforme da tela. Sub mantém
          vocabulário Don Corleone "do silêncio · sem herança". */}
      <View style={[styles.novaConversaAnchor, { borderTopColor: c.border }]}>
        <Pressable
          onPress={() => {
            onNew()
            onClose()
          }}
          style={({ pressed }) => [styles.novaConversaRow, { opacity: pressed ? 0.55 : 1 }]}
        >
          <View style={styles.novaConversaText}>
            <Frau weight="med" size={17} lineHeight={22} color={c.ink} letterSpacing={-0.05}>
              Nova conversa
            </Frau>
            <Frau italic size={13} lineHeight={19} color={c.ink2}>
              do silêncio · sem herança
            </Frau>
          </View>
        </Pressable>
      </View>
    </View>
  ), [c, query, listError, listRefreshing, onRetryList, modeOptions, modeFilter, runningCli, onSelect, onClose, onNew, totalCount, inCurseCount])

  // REDESIGN · meta diversity computado da lista filtrada · usado em
  // cada row pra decidir o que mostrar (mode/origin/provider só quando
  // diferem do default).
  const metaDiversity = useMemo(() => computeMetaDiversity(filtered), [filtered])

  // REDESIGN · data heterogêneo · alterna entre group-header e thread.
  // Canon Mail.app: HOJE / ONTEM / ESTA SEMANA / MAIS ANTIGAS sections
  // como "fichas de processo no escritório do Don" (não rows de spreadsheet).
  // Build groups → flatten em items pra FlatList consumir virtualizado.
  type HistoryListItem =
    | { kind: 'group'; key: string; label: string; count: number }
    | { kind: 'thread'; key: string; thread: AtlasAiThread; isCurrent: boolean }

  const listItems = useMemo<HistoryListItem[]>(() => {
    // REDESIGN v3 · threads em runningCli (renderizadas no header como
    // EmCursoCard) são excluídas dos grupos temporais — evita duplicação
    // (mesma thread aparecendo em "i. EM CURSO" E em "hoje · 4").
    const runningIds = new Set(runningCli.map((t) => t.id))
    const groups: Record<ThreadGroupKey, AtlasAiThread[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    }
    for (const thread of filtered) {
      if (runningIds.has(thread.id)) continue
      groups[threadGroupKey(thread)].push(thread)
    }
    const order: ThreadGroupKey[] = ['today', 'yesterday', 'thisWeek', 'older']
    const items: HistoryListItem[] = []
    for (const key of order) {
      const list = groups[key]
      if (list.length === 0) continue
      items.push({
        kind: 'group',
        key: `group-${key}`,
        label: THREAD_GROUP_LABELS[key],
        count: list.length,
      })
      for (const thread of list) {
        items.push({
          kind: 'thread',
          key: thread.id,
          thread,
          isCurrent: thread.id === currentThreadId,
        })
      }
    }
    return items
  }, [filtered, runningCli, currentThreadId])

  // REDESIGN · renderItem heterogêneo · switch no kind do item.
  // Group headers ganham peso editorial silencioso (caps mono small +
  // hairline + count italic). Thread rows usam ConversaRow refinado.
  const renderItem = useCallback<ListRenderItem<HistoryListItem>>(
    ({ item }) => {
      if (item.kind === 'group') {
        return <HistoryGroupHeader label={item.label} count={item.count} />
      }
      return (
        <ConversaRow
          thread={item.thread}
          isCurrent={item.isCurrent}
          metaDiversity={metaDiversity}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      )
    },
    [metaDiversity, onSelect, onDelete],
  )

  const keyExtractor = useCallback((item: HistoryListItem) => item.key, [])

  // ROUND 2 · Empty state inteligente: skeleton enquanto carrega
  // primeiro fetch (lista vazia + refreshing + sem erro), texto canon
  // editorial caso contrário. Sem shimmer SaaS · só Frau italic dim.
  const emptyEl = useMemo(() => {
    if (listRefreshing && filtered.length === 0 && !listError) {
      return <HistoricoSkeleton />
    }
    return <EmptyInline text="nenhuma sessão encontrada" />
  }, [listRefreshing, filtered.length, listError])

  // ROUND 2 · RefreshControl iOS-native · tint bronze (signature Atlas).
  // Pull-to-refresh chama mesmo callback que o retry banner usa.
  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={listRefreshing}
        onRefresh={onRetryList}
        tintColor={c.bronze}
        colors={[c.bronze]}
      />
    ),
    [listRefreshing, onRetryList, c.bronze],
  )

  // REDESIGN · ListFooterComponent · botão "ver mais" editorial canônico
  // OU mensagem editorial silenciosa de "fim do histórico" quando não há
  // mais. Vocabulário Atlas: sem CTA SaaS gritando · italic Frau bronze
  // como link inline (mesmo padrão do "+ novo domínio" do DomainSheet).
  const footerEl = useMemo(() => {
    if (filtered.length === 0) return null  // empty state cuida disso
    if (hasMore) {
      return (
        <Pressable
          onPress={onLoadMore}
          disabled={listRefreshing}
          hitSlop={8}
          style={({ pressed }) => [
            styles.loadMoreRow,
            { opacity: listRefreshing ? 0.4 : pressed ? 0.55 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="ver mais conversas"
        >
          <Frau italic size={15} lineHeight={22} color={c.bronze}>
            {listRefreshing ? 'carregando…' : 'ver mais · 10'}
          </Frau>
        </Pressable>
      )
    }
    return (
      <View style={styles.loadMoreRow}>
        <Frau italic size={13} lineHeight={18} color={c.ink3}>
          fim do histórico
        </Frau>
      </View>
    )
  }, [hasMore, filtered.length, listRefreshing, onLoadMore, c.bronze, c.ink3])

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      {/* REDESIGN v4 · Animated.FlatList (reanimated) com itemLayoutAnimation.
          Quando uma row some via swipe-to-delete, as restantes animam
          subindo suavemente em ~280ms cubic-bezier (Apple Mail signature) ·
          em vez do "pulo brusco" do FlatList nativo. Canon Mail.app:
          HOJE / ONTEM / ESTA SEMANA / MAIS ANTIGAS · agora com transição
          física entre estados da lista. */}
      <Animated.FlatList
        data={listItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={headerEl}
        ListEmptyComponent={emptyEl}
        ListFooterComponent={footerEl}
        contentContainerStyle={styles.historicoContent}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        itemLayoutAnimation={LinearTransition.duration(280).easing(Easing.bezier(0.32, 0.72, 0.16, 1).factory())}
      />
    </BottomSheet>
  )
}

// REDESIGN v3 · HistoryGroupHeader · ornament canônico Atlas (mesmo padrão
// do app/review.tsx · linha 50). <Sparkle size={14} /> bronze + linhas
// hairline c.border flex 1 dos lados + gap 14. Refinado, não grosseiro.
// Label "hoje/ontem/esta semana/mais antigas" centralizado abaixo em
// Frau italic 13 ink3 dim · sussurro editorial.
const HistoryGroupHeader = memo(function HistoryGroupHeader({
  label,
  count,
}: {
  label: string
  count: number
}) {
  const { c } = useTheme()
  return (
    <View style={styles.groupOrnament}>
      <View style={styles.groupOrnamentRow}>
        <View style={[styles.groupOrnamentLine, { backgroundColor: c.border }]} />
        <Sparkle size={14} />
        <View style={[styles.groupOrnamentLine, { backgroundColor: c.border }]} />
      </View>
      <Frau italic size={13} lineHeight={18} color={c.ink3} align="center" style={styles.groupOrnamentLabel}>
        {label.toLowerCase()} · {count}
      </Frau>
    </View>
  )
})

// REDESIGN · ConversaRow editorial · canon Atlas.
// Estrutura nova:
//   [meta line condicional]              [tempo compacto editorial]
//   título Sans med 16/22 · 2 linhas max
//   workspace · turnos · provider (italic Frau dim · só sinais relevantes)
//
// Regras editoriais (esconde quando default):
//   · meta line: só renderiza se metaDiversity tem algum sinal a mostrar
//     OU se é a thread atual (· ATUAL bronze italic)
//   · provider: só se diversidade > 1 (mistura claude/codex/gemini)
//   · origem (CLI/APP): só se diversidade > 1
//   · turnos: só se message_count > 1 (single-turn não merece signal)
//   · workspace: só se shortWorkspace devolve algo non-trivial
//
// Swipe-left revela APAGAR gestural (canon iOS Mail · SwipeableCard
// já usado no Inbox). Remove o botão fixo de cada row · ação destrutiva
// aparece só no gesto para manter o histórico silencioso.
type ConversaRowProps = {
  thread: AtlasAiThread
  isCurrent: boolean
  metaDiversity: MetaDiversity
  onSelect: (thread: AtlasAiThread) => void
  onDelete: (thread: AtlasAiThread) => void
}

const ConversaRow = memo(function ConversaRow({ thread, isCurrent, metaDiversity, onSelect, onDelete }: ConversaRowProps) {
  const { c } = useTheme()
  const isCli = threadIsCli(thread)
  const mode = atlasAiModeFromThread(thread)
  const workspace = shortWorkspace(thread)
  const isHomeWorkspace = workspace === '(home)'
  const turns = thread.message_count ?? 0
  const governance = providerGovernanceFromThread(thread)
  const provider = providerWord(governance.executionProvider ?? thread.last_provider) ?? 'atlas'
  const timestamp = formatHistoryTimestamp(thread.last_message_at ?? thread.updated_at)

  // VARIANTE B · Regras "default vira silêncio":
  //   1. Provider claude/atlas (defaults) NUNCA aparecem nos signals.
  //      Só codex/gemini/etc (não-default).
  //   2. Origem APP (default mobile/desktop) NUNCA renderiza badge.
  //      Só CLI (terminal) ganha destaque bronze.
  //   3. Workspace home directory (`(home)`) renderiza italic dim ink3
  //      em vez do nome (sussurro "estava na minha sala").
  //   4. Mode "general" (default) só aparece se há diversidade real.
  const showProviderSignal = provider !== 'atlas'
  const showCliBadge = isCli  // APP virou silêncio · só CLI vira badge
  const showModeChip = metaDiversity.showMode && mode !== 'general'
  const showAtualChip = isCurrent
  const showMetaLine = showModeChip || showCliBadge || showAtualChip

  // Signals row · só sinais que adicionam informação. Workspace renderiza
  // separadamente (pra ficar dim quando é home) — resto vai como string.
  const signalsSuffix: string[] = []
  if (turns > 1) signalsSuffix.push(turns === 2 ? '2 turnos' : `${turns} turnos`)
  if (showProviderSignal) signalsSuffix.push(provider)
  const hasSignals = workspace || signalsSuffix.length > 0

  return (
    <SwipeableCard onDelete={() => onDelete(thread)}>
      <View style={[styles.conversaRow, { borderBottomColor: c.border }]}>
        <Pressable
          onPress={() => onSelect(thread)}
          style={({ pressed }) => [styles.conversaRowBody, { opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={`abrir conversa ${thread.title || 'sem título'}`}
          accessibilityState={{ selected: isCurrent }}
        >
          {/* Top row: meta condicional à esquerda + timestamp à direita. */}
          <View style={styles.conversaTopRow}>
            <View style={styles.conversaTopMeta}>
              {showModeChip ? (
                <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.bronze} weight="med">
                  {atlasAiModeLabel(mode).toUpperCase()}
                </Mono>
              ) : null}
              {showCliBadge ? (
                <>
                  {showModeChip ? (
                    <Frau italic size={10} lineHeight={14} color={c.ink3} style={styles.conversaTopSep}>
                      ·
                    </Frau>
                  ) : null}
                  <Mono weight="med" size={10} lineHeight={14} letterSpacing={1.4} color={c.bronze}>
                    CLI
                  </Mono>
                </>
              ) : null}
              {showAtualChip ? (
                <>
                  {showModeChip || showCliBadge ? (
                    <Frau italic size={10} lineHeight={14} color={c.ink3} style={styles.conversaTopSep}>
                      ·
                    </Frau>
                  ) : null}
                  <Frau italic size={11} lineHeight={14} color={c.bronze}>
                    atual
                  </Frau>
                </>
              ) : null}
            </View>
            {timestamp ? (
              <Frau italic size={11} lineHeight={14} color={c.ink3}>
                {timestamp}
              </Frau>
            ) : null}
          </View>
          {showMetaLine || timestamp ? <View style={styles.conversaTopGap} /> : null}
          {/* Título · 2 linhas max · respira. */}
          <Sans
            weight="med"
            size={16}
            lineHeight={22}
            color={c.ink}
            letterSpacing={-0.1}
            numberOfLines={2}
          >
            {thread.title || 'Conversa Atlas'}
          </Sans>
          {/* Signals row · workspace renderiza com cor diferente quando é
              (home) — italic ink3 dim em vez de ink2. Resto inline. */}
          {hasSignals ? (
            <Frau italic size={13} lineHeight={18} color={c.ink2} numberOfLines={1} style={styles.conversaSignals}>
              {workspace ? (
                <Frau italic size={13} lineHeight={18} color={isHomeWorkspace ? c.ink3 : c.ink2}>
                  {workspace}
                </Frau>
              ) : null}
              {workspace && signalsSuffix.length > 0 ? ' · ' : ''}
              {signalsSuffix.join(' · ')}
            </Frau>
          ) : null}
        </Pressable>
      </View>
    </SwipeableCard>
  )
})

// ROUND 2 · HistoricoSkeleton · loading state editorial canon. Sem
// shimmer gradient SaaS, sem dots animados infantis. 5 rows mockados
// com Frau italic ink3 dim — vocabulário "lendo histórico…" com cadência
// editorial silenciosa (Don Corleone "esperando o homem terminar").
const HistoricoSkeleton = memo(function HistoricoSkeleton() {
  const { c } = useTheme()
  return (
    <View style={styles.skeletonContainer}>
      <Frau italic size={13} lineHeight={19} color={c.ink3} align="center" style={{ marginBottom: 18 }}>
        consultando memória…
      </Frau>
      {Array.from({ length: 5 }).map((_, idx) => (
        <View key={idx} style={[styles.skeletonRow, { borderBottomColor: c.border }]}>
          <View style={[styles.skeletonLineMeta, { backgroundColor: `${c.ink3}1A` }]} />
          <View style={[styles.skeletonLineTitle, { backgroundColor: `${c.ink2}1A` }]} />
          <View style={[styles.skeletonLineSub, { backgroundColor: `${c.ink3}14` }]} />
        </View>
      ))}
    </View>
  )
})

// ROUND 1 · React.memo evita re-render do ThreadHistorySheet quando o
// parent (AtlasAiSheet) re-renderiza por motivo não relacionado (typing
// no composer, recebimento de stream, etc). ScrollView com 30+ rows
// renderiza tudo síncrono — evitar render desnecessário é o ganho mais
// barato. Comparison default rasa basta: threadList muta por reference,
// callbacks são useCallback estáveis, primitives comparam por valor.
const ThreadHistorySheet = memo(ThreadHistorySheetInner)

// threadIsCli · detecta se thread foi originada via Atlas CLI direto
// (terminal: `atlas chat`, `atlas decide`, etc) vs app GUI (mobile/desktop).
//
// FIX (2026-05) · antes usava thread.last_provider.includes('cli'), mas
// TODOS engines Atlas executam via CLI no backend (claude_cli, codex_cli,
// gemini_cli) — discriminator errado, marcava 100% das threads como CLI
// independente da origem real.
//
// Discriminator correto: thread.surface, declarada na criação:
//   · 'cli' / 'atlas_cli' / 'manual'  → CLI direto pelo usuário
//   · 'atlas_ai_sheet' / 'app' / etc  → app mobile/desktop
//   · 'background' / 'scheduled'      → job automático (não-CLI direto)
//   · '' / null                        → desconhecido, conservador: NÃO CLI
function threadIsCli(thread: AtlasAiThread): boolean {
  const surface = (thread.surface ?? '').toLowerCase()
  return surface === 'cli' || surface === 'atlas_cli' || surface === 'manual'
}

// threadIsRecentlyActive · critério "em curso" pra section i. EM CURSO.
// Atividade < 30 min indica thread provavelmente ainda rodando. Quando
// backend publicar status real-time, substituir por metadata.status === 'running'.
function threadIsRecentlyActive(thread: AtlasAiThread): boolean {
  const lastActivity = thread.last_message_at ?? thread.updated_at
  if (!lastActivity) return false
  try {
    const lastTs = new Date(lastActivity).getTime()
    const ageMs = Date.now() - lastTs
    return ageMs < 30 * 60 * 1000  // 30 min
  } catch {
    return false
  }
}

// compactThreadWorkspace · substitui /Users/{user} por ~ + remove prefixo
// "Workspace - " do label canon. Vocabulário canon mockup: paths editoriais
// curtos (~/develop/Atlas/atlas-app), não verbose absolute paths SaaS.
function compactThreadWorkspace(thread: AtlasAiThread): string | null {
  const label = atlasAiContextLabel(thread)
  if (!label) return null
  return label
    .replace(/^Workspace - /, '')
    .replace(/^\/Users\/[^/]+/, '~')
}

// REDESIGN · workspace inteligente · só o último segmento + sandbox + home
// detection. Path completo é metadata operacional, não voz editorial.
// Hierarquia visual: title é o assunto, workspace é "em que mesa".
//   ~/develop/Atlas/atlas-server          → atlas-server
//   ~/develop/Atlas/atlas-app             → atlas-app
//   /Users/vitorepf  ou  ~                → (home)         · sussurro dim
//   /private/var/folders/.../tmp.X        → (sandbox)
//   ~/Develop/atlas                       → atlas
//   null/undefined                        → null (não renderiza)
function shortWorkspace(thread: AtlasAiThread): string | null {
  if (!threadIsCli(thread)) return null

  const label = atlasAiContextLabel(thread)
  if (!label) return null
  const cleaned = label.replace(/^Workspace - /, '').trim()
  // Home directory · /Users/{user} OU ~ OU ~/. Vocabulário canon Atlas:
  // "(home)" italic dim · não anuncia "estive na minha sala", só está.
  if (cleaned === '~' || cleaned === '~/' || /^\/Users\/[^/]+\/?$/.test(cleaned) || /^~\/?$/.test(cleaned)) {
    return '(home)'
  }
  // Sandbox/temp paths do macOS · lixo absoluto pra leitor humano.
  if (/^\/private\/var\/folders\//.test(cleaned) || /\/tmp\.[A-Za-z0-9]+/.test(cleaned)) {
    return '(sandbox)'
  }
  // Último segmento do path · "atlas-server" em vez de "~/develop/Atlas/atlas-server".
  const segments = cleaned.replace(/^~\//, '').replace(/^\/+/, '').split('/').filter(Boolean)
  if (segments.length === 0) return null
  const last = segments[segments.length - 1]
  // Se o último segmento for vazio ou único caractere, devolve label original
  // compactado pra não perder contexto.
  if (!last || last.length < 2) return cleaned
  return last.toLowerCase()
}

// REDESIGN · timestamp editorial canon Mail.app · "09:34" mesmo dia /
// "ontem" / "seg" semana atual / "12 mai" meses / "mai 2025" anos.
// Substitui "há 43 min" / "há 13 h" / "há 1 d" — vocabulário Atlas
// silencioso (Don Corleone não diz "há 43 minutos", diz "às nove e meia").
const WEEKDAYS_PT_BR = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const
const MONTHS_PT_BR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const

function formatHistoryTimestamp(input: string | null | undefined): string {
  if (!input) return ''
  let date: Date
  try {
    date = new Date(input)
    if (isNaN(date.getTime())) return ''
  } catch {
    return ''
  }
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) {
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }
  // Ontem · single dedicated label (mais quente que "seg" / "ter").
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return 'ontem'
  }
  // Esta semana · weekday curto.
  const ageMs = now.getTime() - date.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  if (ageDays < 7) {
    return WEEKDAYS_PT_BR[date.getDay()]
  }
  // Mesmo ano · "12 mai".
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getDate()} ${MONTHS_PT_BR[date.getMonth()]}`
  }
  // Anos anteriores · "mai 2025".
  return `${MONTHS_PT_BR[date.getMonth()]} ${date.getFullYear()}`
}

// REDESIGN · grupo temporal · canon Mail.app sections.
//   HOJE · ONTEM · ESTA SEMANA · MAIS ANTIGAS
// Threads sem last_message_at caem em "MAIS ANTIGAS" (vocabulário silencioso
// pra "não sabemos quando foi mexido por último").
type ThreadGroupKey = 'today' | 'yesterday' | 'thisWeek' | 'older'

const THREAD_GROUP_LABELS: Record<ThreadGroupKey, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  thisWeek: 'Esta semana',
  older: 'Mais antigas',
}

function threadGroupKey(thread: AtlasAiThread): ThreadGroupKey {
  const ts = thread.last_message_at ?? thread.updated_at
  if (!ts) return 'older'
  let date: Date
  try {
    date = new Date(ts)
    if (isNaN(date.getTime())) return 'older'
  } catch {
    return 'older'
  }
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return 'today'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'yesterday'
  const ageMs = now.getTime() - date.getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  if (ageDays < 7) return 'thisWeek'
  return 'older'
}

// REDESIGN · meta diversity · decide se vale mostrar mode/origin/provider
// em cada row baseado em diversidade da lista. Se 100% das threads são CLI,
// mostrar "CLI" em cada row é ruído. Se mistos (5 CLI + 3 APP), aí sim
// vale destacar pra distinguir. Mesma lógica pra mode e provider.
type MetaDiversity = {
  showMode: boolean      // varia entre threads (geral/saúde/projetos)
  showOrigin: boolean    // varia entre CLI/APP
  showProvider: boolean  // varia entre claude/codex/gemini/etc
}

function computeMetaDiversity(threads: AtlasAiThread[]): MetaDiversity {
  if (threads.length < 2) {
    return { showMode: false, showOrigin: false, showProvider: false }
  }
  const modes = new Set<string>()
  const origins = new Set<string>()
  const providers = new Set<string>()
  for (const t of threads) {
    modes.add(atlasAiModeFromThread(t))
    origins.add(threadIsCli(t) ? 'cli' : 'manual')
    providers.add(providerWord(t.last_provider) ?? 'atlas')
  }
  return {
    showMode: modes.size > 1,
    showOrigin: origins.size > 1,
    showProvider: providers.size > 1,
  }
}

// threadActiveDuration · "X MIN" desde início da thread (ou last activity).
// Usado no card EM CURSO pra meta "RODANDO · 12 MIN · 3 TURNOS".
function threadActiveDuration(thread: AtlasAiThread): string {
  const start = thread.created_at ?? thread.last_message_at
  if (!start) return '? min'
  try {
    const ageMs = Date.now() - new Date(start).getTime()
    const min = Math.max(1, Math.floor(ageMs / 60000))
    if (min < 60) return `${min} min`
    const hours = Math.floor(min / 60)
    return `${hours}h ${min % 60}m`
  } catch {
    return '? min'
  }
}

// EmCursoCard · canon mockup linha ~2691 .em-curso-card · sessão CLI ativa
// como card destaque com border-left bronze 3px + bg @4% bronze + meta caps
// + title + workspace + actions inline. Vocabulário "thread viva":
//   ✦ RODANDO · 12 MIN · 3 TURNOS  (meta mono caps com ✦ pulsing bronze)
//   implemente AtlasDecide refactor pra extrair provider policy  (title sans)
//   codex · /Users/.../atlas-app  (workspace path italic)
//   CONTINUAR AQUI · VER LOGS · INTERROMPER  (actions mono caps inline)
function EmCursoCard({
  thread,
  onContinue,
}: {
  thread: AtlasAiThread
  onContinue: () => void
}) {
  const c = useTheme().c
  const turnsLabel = thread.message_count === 1 ? '1 turno' : `${thread.message_count} turnos`
  const workspace = compactThreadWorkspace(thread)
  const provider = providerWord(thread.last_provider) ?? 'codex'

  return (
    <View
      style={[
        styles.emCursoCard,
        {
          backgroundColor: `${c.bronze}0A`,  // bronze @ ~4% opacity
          borderLeftColor: c.bronze,
          borderColor: `${c.bronze}33`,
        },
      ]}
    >
      <View style={styles.emCursoMeta}>
        <Frau italic size={13} lineHeight={18} color={c.bronze} style={{ marginRight: 6 }}>
          ✦
        </Frau>
        <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.bronze} weight="med">
          RODANDO
        </Mono>
        <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.ink3} style={{ marginHorizontal: 8 }}>
          ·
        </Mono>
        <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.ink2}>
          {threadActiveDuration(thread).toUpperCase()}
        </Mono>
        <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.ink3} style={{ marginHorizontal: 8 }}>
          ·
        </Mono>
        <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.ink2}>
          {turnsLabel.toUpperCase()}
        </Mono>
      </View>
      <Sans weight="med" size={15.5} lineHeight={21} color={c.ink} letterSpacing={-0.05} numberOfLines={3} style={styles.emCursoTitle}>
        {thread.title || 'Sessão Atlas CLI'}
      </Sans>
      {workspace ? (
        <Frau italic size={13} lineHeight={19} color={c.ink2} numberOfLines={2} style={styles.emCursoWorkspace}>
          {provider} · {workspace}
        </Frau>
      ) : null}
      <View style={styles.emCursoActions}>
        <Pressable onPress={onContinue} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
          <Mono weight="med" size={10} lineHeight={14} letterSpacing={1.4} color={c.bronze}>
            CONTINUAR AQUI
          </Mono>
        </Pressable>
        <Mono size={10} lineHeight={14} color={c.ink3} style={styles.emCursoActionSep}>·</Mono>
        <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.ink2}>
          VER LOGS
        </Mono>
        <Mono size={10} lineHeight={14} color={c.ink3} style={styles.emCursoActionSep}>·</Mono>
        <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.ink2}>
          INTERROMPER
        </Mono>
      </View>
    </View>
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

// qualitySummary · vocabulário canon Atlas (Don Corleone "escritório em ordem"):
// quando todos os contadores são zero, mostra apenas o score (silêncio editorial);
// quando há alertas, mostra apenas os relevantes (omite zeros). Lógica idêntica
// ao operacaoSummary do ContinuityPanel — preserva legibilidade e respeita o
// canon: palavra carrega significado, não enumeração de zeros.
//
// Exemplos:
//   · todos zero · "89/100"
//   · só revisar 2 · "89/100 · 2 a revisar"
//   · só falhas 1 · "89/100 · 1 falha"
//   · revisar + falhas · "89/100 · 2 a revisar · 1 falha"
//   · sem quality data + ações 3 · "3 ações abertas"
//   · sem quality data + zero ações · "em repouso"
function qualitySummary(
  observability: AiObservabilityResponse | null,
  openActions: AtlasAiQualityAction[],
): string {
  const quality = observability?.quality
  const actionsCount = openActions.length

  // Sem quality data · vocabulário fallback minimalista
  if (!quality?.available) {
    return actionsCount === 0 ? 'em repouso' : `${actionsCount} ${actionsCount === 1 ? 'ação aberta' : 'ações abertas'}`
  }

  const avg = typeof quality.average_score === 'number' ? `${quality.average_score}/100` : 'sem média'
  const review = quality.by_status?.needs_review ?? 0
  const failed = quality.by_status?.failed ?? 0

  // Todos zero · só score (silêncio canon Atlas)
  if (review === 0 && failed === 0 && actionsCount === 0) {
    return avg
  }

  // Há alertas · monta lista omitindo zeros
  const parts: string[] = [avg]
  if (review > 0) parts.push(`${review} a revisar`)
  if (failed > 0) parts.push(`${failed} ${failed === 1 ? 'falha' : 'falhas'}`)
  if (actionsCount > 0) parts.push(`${actionsCount} ${actionsCount === 1 ? 'ação' : 'ações'}`)
  return parts.join(' · ')
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

// modeFilterColor · removido · usado pelos cards 2x2 antigos do
// ThreadHistorySheet (canon v18 substituiu por filter strip horizontal sem
// bullets coloridos). modeColor preservado · ainda usado em AtlasAiModeNotice.

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

type ThreadProviderGovernance = {
  decisionMode: string | null
  decisionAuthority: string | null
  executionProvider: string | null
  manualOverride: boolean
}

function providerGovernanceFromThread(thread: AtlasAiThread): ThreadProviderGovernance {
  const metadata = thread.metadata ?? {}
  const governance = metadataRecord(metadata, 'provider_governance')
  const decisionMode = metadataString(governance ?? metadata, 'decision_mode')
  const decisionAuthority = metadataString(governance ?? metadata, 'decision_authority')
  const executionProvider =
    metadataString(governance ?? metadata, 'execution_provider')
    ?? metadataString(governance ?? metadata, 'selected_provider')
    ?? thread.last_provider
    ?? null
  const manualOverrideRaw = governance?.manual_override

  return {
    decisionMode,
    decisionAuthority,
    executionProvider,
    manualOverride: manualOverrideRaw === true || decisionMode === 'manual_override' || decisionAuthority === 'operator_override',
  }
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

function compactDomainSelectionPayloadPatch(
  patch: AtlasAiDomainFlowSelection['payload_patch'],
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== null && value !== undefined),
  )
}

function compactDomainSelectionForPayload(selection: AtlasAiDomainFlowSelection): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      schema_version: selection.schema_version,
      status: selection.status,
      surface_id: selection.surface_id,
      selection_source: selection.selection_source,
      operator_override: selection.operator_override,
      ux: selection.ux,
      requested: selection.requested,
      domain: selection.domain
        ? {
            id: selection.domain.id,
            label: selection.domain.label,
            default_flow: selection.domain.default_flow,
            orchestrator_maturity: selection.domain.orchestrator_maturity,
            runtime_family: selection.domain.runtime_family,
            autonomy_default: selection.domain.autonomy_default,
            background_allowed: selection.domain.background_allowed,
            onboarding: selection.domain.onboarding,
          }
        : undefined,
      flow: selection.flow
        ? {
            id: selection.flow.id,
            domain_id: selection.flow.domain_id,
            label: selection.flow.label,
            runtime: selection.flow.runtime,
            orchestrator_maturity: selection.flow.orchestrator_maturity,
            autonomy: selection.flow.autonomy,
            background_allowed: selection.flow.background_allowed,
            destructive_requires_approval: selection.flow.destructive_requires_approval,
            executor_preference: selection.flow.executor_preference,
          }
        : undefined,
      safety: selection.safety,
    }).filter(([, value]) => value !== undefined),
  )
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
  // v18 · screen mode container · canon Atlas AI como tela primária.
  // flex 1 sem absolute (não é overlay) · backgroundColor cream sólido ·
  // safe-area top inset aplicado externamente (paddingTop). Diferente do
  // SideSheet que tem position absolute + zIndex 58.
  screenContainer: {
    flex: 1,
  },
  // Header 3-column · canon mockup atlas-ai-header (linha 2184).
  // alignItems baseline (não center) — alinha tipografia pelo baseline,
  // que é como mockup "Atlas" Frau 26 alinha com "← Voltar" Sans 15 e
  // ícones na direita. Editorial > geométrico.
  // Sem height fixo — paddingTop+paddingBottom controlam respiração.
  // borderBottomColor é setado inline com bronze@18% (vocabulário canon
  // do mockup, não c.border cinza).
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
  },
  // headerSlot esquerdo/direito flex 1 — empurra título "Atlas" pra centro
  // sem largura fixa. Mockup: .left { flex: 1 } / .right { flex: 1 }.
  headerSlot: {
    flex: 1,
    justifyContent: 'center',
  },
  headerSlotRight: {
    alignItems: 'flex-end',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 18,
  },
  headerAction: {
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
  // microAction · ainda usado em SearchSheet/OperationsSheet/ExecutionSheet/
  // SkillsSheet/SessionMapSheet (8 usos). Preservado. Os outros micro* styles
  // (microLine, microLabel, microValue, microSection*, runtimeStrip) foram
  // removidos · canon v18 substitui por SectionHead + TocRow + DestinoItem.
  microAction: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // v18 · canon mockup atlas-home-editorial · sub-styles do ContinuityPanel
  // refatorado pra usar SectionHead + TocRow + DestinoItem editorial.
  // continuitySection · wrapper de cada section (i. ESTADO / ii. OPERAÇÕES /
  // iii. VISTAS) · marginBottom 12 entre sections (cadência editorial).
  continuitySection: {
    marginBottom: 12,
  },
  // Header editorial canon · eyebrow CONTINUIDADE DA SESSÃO + title
  // "Atlas · sessão atual." (Frau italic 22). marginLeft/Right 32 alinha
  // com trilho interno canon do app. marginTop 12 dá respiro entre o
  // toggle "· recolher" e o eyebrow. marginBottom 0 — hr-section abaixo
  // encosta sem gap.
  continuityHeader: {
    marginLeft: 32,
    marginRight: 32,
    marginTop: 12,
    marginBottom: 14,
  },
  continuityHeaderEyebrow: {
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  // hr-section · canon mockup .hr-section · 1px ink @ 12% opacity.
  continuityHeaderRule: {
    height: 1,
    marginLeft: 32,
    marginRight: 32,
    marginBottom: 4,
  },
  // syncDateline · canon mockup .continuity-sync · italic Frau 14 ink2 com
  // em-dash inicial. marginTop 18 dá respiração entre o bloco i. ESTADO e
  // a próxima section. marginLeft 32 alinha com trilho interno canon.
  syncDateline: {
    marginTop: 18,
    marginBottom: 6,
    marginLeft: 32,
    marginRight: 32,
  },
  // vistasStrip · filter strip horizontal italic Frau · vocabulário canon do
  // filter strip do Inbox · Capturas. Items inline separados por · ink3.
  // marginLeft 32 alinha com trilho interno canon.
  vistasStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 14,
    marginLeft: 32,
    marginRight: 32,
    gap: 0,
  },
  vistasItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  vistasItemActive: {
    // Underline bronze sutil pro filter ativo · vocabulário canon Atlas
    // (mesmo do filter strip do Inbox).
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
  vistasSep: {
    paddingHorizontal: 8,
    opacity: 0.45,
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
  // Empty state container · canon ultra-premium · puxa o centro visual pra
  // cima do terço geométrico (paddingBottom 96 maior que paddingTop 48)
  // criando vibe "pergunta sobe das mãos" — Don Corleone. Quando o usuário
  // abre o app, sua atenção cai naturalmente no terço-superior visual,
  // não no meio geométrico (que parece "balão flutuando").
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 96,
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
  // searchInput · ainda usado em SearchSheet (busca em traces). Preservado.
  // Os outros thread* styles (threadPickerContent, threadModeGrid,
  // threadModeCard, threadRow, threadMarker, threadRowBody, threadRowActions,
  // threadRowHeader, threadFocusDot) foram removidos · canon v18 substitui
  // por historicoContent + filter strip + nova/conversaRow.
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
  // v18 · canon mockup atlas-home-editorial · ThreadHistorySheet refatorado
  // pra layout editorial com filter strip horizontal + sections numeradas.
  // Substitui threadPickerContent + threadModeGrid + threadRow do layout
  // antigo (que usava cards 2x2 com bullets coloridos · vocabulário SaaS).
  historicoContent: {
    paddingTop: 20,
    paddingBottom: 36,
  },
  historicoSub: {
    marginTop: 8,
    marginBottom: 14,
  },
  // ROUND 1 · Error banner editorial · border-left recRedMuted hairline
  // accent + bg subtle 4% recRedMuted (igual em-curso-card pattern).
  // Vocabulário canon: sem badge SaaS, sem ícone alarme. Texto Frau
  // italic + retry mono caps inline bronze. Trilho interno marginHoriz 32.
  historicoErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 32,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderLeftWidth: 3,
  },
  // Search line · hairline-only no topo · canon: minimal, sem bg cream
  // rounded SaaS. paddingHorizontal 32 alinha com trilho interno canon.
  historicoSearch: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 42,
    marginHorizontal: 32,
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 18,
  },
  // Filter strip horizontal · canon mockup .modo-filter · italic Frau inline
  // separados por · ink3 · counts mono entre parens · underline bronze ativo.
  // Trilho interno marginLeft/Right 32. paddingVertical 4 dá hit area decente.
  historicoFilter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginHorizontal: 32,
    marginBottom: 24,
    gap: 0,
  },
  historicoFilterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  historicoFilterActive: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
  historicoFilterCount: {
    marginLeft: 4,
  },
  historicoFilterSep: {
    paddingHorizontal: 8,
    opacity: 0.45,
  },
  // Section wrapper · marginBottom 12 entre sections (cadência editorial canon).
  historicoSection: {
    marginBottom: 12,
  },
  // ROUND 2 · Section header-only wrapper · usado quando rows ficam fora
  // (FlatList data) mas section title + Nova conversa entry continuam no
  // ListHeaderComponent. Sem marginBottom (FlatList items já têm
  // espaçamento próprio).
  historicoSectionHeaderOnly: {
    marginBottom: 0,
  },
  // ROUND 2 · Skeleton container · cadência editorial silenciosa.
  // marginHorizontal 32 alinha com trilho interno canon (mesmo das rows).
  // marginTop pra respirar do header.
  skeletonContainer: {
    paddingHorizontal: 32,
    marginTop: 8,
  },
  skeletonRow: {
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  skeletonLineMeta: {
    width: 84,
    height: 8,
    borderRadius: 1,
    marginBottom: 12,
  },
  skeletonLineTitle: {
    width: '78%',
    height: 14,
    borderRadius: 1,
    marginBottom: 10,
  },
  skeletonLineSub: {
    width: '52%',
    height: 10,
    borderRadius: 1,
  },
  // EM CURSO card · canon mockup .em-curso-card · sessão CLI ativa.
  // Border-left bronze 3px + bg subtle (@4% bronze) · vocabulário "thread viva
  // com peso bronze". marginHorizontal 32 alinha com trilho interno canon.
  // padding 18 vertical + 22 horizontal pra respirar com o conteúdo denso.
  emCursoCard: {
    marginHorizontal: 32,
    marginTop: 18,
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderLeftWidth: 3,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 2,
  },
  emCursoMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  emCursoTitle: {
    marginBottom: 6,
  },
  emCursoWorkspace: {
    marginBottom: 14,
  },
  emCursoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 0,
  },
  emCursoActionSep: {
    marginHorizontal: 12,
    opacity: 0.55,
  },
  // Nova conversa anchor · hairline simples acima (mesmo padrão dos
  // separadores entre conversa-rows da lista). Sem traço bronze que
  // destacava demais e quebrava o vocabulário visual uniforme da tela.
  novaConversaAnchor: {
    marginHorizontal: 32,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  // Nova conversa row · label Frau med 17 + sub italic 13.
  // SEM border-bottom · o ornament temporal "─ ✦ ─" abaixo já dá
  // separação visual editorial. Antes tinha hairline-bottom que ficava
  // redundante (duas linhas próximas competindo).
  novaConversaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 14,
    paddingVertical: 14,
    paddingBottom: 18,
  },
  novaConversaGlyph: {
    width: 18,
    textAlign: 'center',
  },
  novaConversaText: {
    flex: 1,
    gap: 4,
  },
  // REDESIGN · Conversa row editorial · canon Mail.app + Atlas DNA.
  // marginHorizontal 32 alinha com trilho interno · paddingVertical 16
  // dá respiro entre rows · hairline bottom dinâmico (cor vem do theme,
  // funciona em light/dark sem alpha hardcoded).
  conversaRow: {
    marginHorizontal: 32,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  conversaRowBody: {
    // gap 0 · espaçamento entre top-row, title e signals controlado
    // por marginTop dedicado em cada elemento (controle fino editorial).
  },
  // REDESIGN · Top row · meta condicional à esquerda + timestamp à direita.
  // Sempre renderiza (timestamp sozinho ainda merece a row). Baseline
  // alignment pra texto editorial alinhado.
  conversaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    minHeight: 14,
  },
  conversaTopMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 1,
  },
  conversaTopSep: {
    marginHorizontal: 6,
  },
  // Gap entre top-row e título · 6pt · respiro editorial sem perder densidade.
  conversaTopGap: {
    height: 6,
  },
  // Signals row (workspace · turnos · provider) · marginTop 6 entre title.
  conversaSignals: {
    marginTop: 6,
  },
  // REDESIGN v3 · Group ornament canônico · espelha app/review.tsx
  // (linha 161): flexDirection row + alignItems center + gap 14 +
  // marginVertical 26. Sparkle 14pt bronze + hairlines flex 1 dos
  // lados. Refinado, mesmo vocabulário visual usado em outras telas.
  groupOrnament: {
    marginTop: 26,
    marginBottom: 14,
  },
  groupOrnamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 32,
  },
  groupOrnamentLine: {
    flex: 1,
    // height 1px sólido (não hairlineWidth) · canon app/review.tsx:162.
    // hairlineWidth = ~0.5px no retina = quase invisível, fica delicado
    // demais. Review usa 1px sólido pra peso visual correto.
    height: 1,
  },
  groupOrnamentLabel: {
    marginTop: 10,
  },
  // REDESIGN · "Ver mais" footer · paddingVertical 28 dá respiro entre
  // último row e o botão · centralizado como link editorial Frau italic
  // bronze (mesmo vocabulário do "+ novo domínio" inline link).
  loadMoreRow: {
    alignItems: 'center',
    paddingVertical: 28,
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
  // Footer (composer + status routing) · canon mockup atlas-ai-composer
  // (linha 2316). paddingHorizontal 24 (não 28 ad-hoc anterior) — alinha
  // com o mesmo trilho horizontal do header (24px). paddingTop 4 mantido,
  // paddingBottom dinâmico via footerPaddingBottom (insets safe-area iPhone).
  footer: {
    paddingHorizontal: 24,
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
