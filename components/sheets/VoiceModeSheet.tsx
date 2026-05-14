import { useEffect, type ComponentType } from 'react'
import { Modal, NativeModules, Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  withDelay,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Frau, Mono, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import type { MobileVoiceRecordingBlockReason } from '../../lib/atlasVoiceRuntime'

declare const require: (moduleName: string) => unknown

export type VoiceModeState = 'starting' | 'connecting' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'reconnecting' | 'failed'

export interface VoiceModeLiveKitSession {
  livekitUrl: string
  participantToken: string
  roomName: string
  participantIdentity: string
  agentIdentity?: string | null
}

interface Props {
  visible: boolean
  state?: VoiceModeState
  recording?: boolean
  recordingEnabled?: boolean
  recordingUnavailableReason?: MobileVoiceRecordingBlockReason | null
  onHoldStart?: () => void
  onHoldEnd?: () => void
  liveKitSession?: VoiceModeLiveKitSession | null
  statusDetail?: string | null
  onLiveKitConnected?: () => void
  onLiveKitDisconnected?: (reason?: string) => void
  onLiveKitError?: (message: string) => void
  onClose: () => void
}

// =============================================================================
// VoiceModeSheet · canon mockup (atlas-home-editorial-mockup.html linha ~4640)
// =============================================================================
//
// Tela fullscreen sem chrome (sem dock, sem header) — entrega total à conversa
// por voz tempo real com Atlas. Acessada via long-press no ✦ send do FieldInline
// (não via ◉ no header como antes — decisão editorial: gesto premium oculto
// vale mais que ícone visível pra ação rara).
//
// Vocabulário "salão de Don Corleone": tela inteira é o ato cognitivo da
// conversa, sem distração. Substitui ChatGPT voice mode (que tem múltiplos
// botões + visualizers SaaS) com peso editorial radical.
//
// Componentes canônicos:
//   · ✦ bronze 96px pulsing centered · "presença ao vivo do Atlas" · velocidade
//     do pulse comunica estado: escutando 1.2s · transcrevendo 1.05s ·
//     falando 0.6s · pensando 1.5s · falha 0.9s
//   · Waveform 10 bars animadas em sequência · não EQ visualizer SaaS, mais
//     peso "voz viva" editorial
//   · Indicator italic Frau 19 ink2: "Atlas escutando." / "Atlas pensando." /
//     "Atlas transcrevendo." / "Atlas falando." / "Atlas não conseguiu ouvir."
//     (alterna por estado, com período)
//   · Footer "Encerrar" mono caps small ink3 · saída editorial sem botão
// =============================================================================

const STATE_LABELS: Record<VoiceModeState, string> = {
  starting:      'Atlas preparando.',
  connecting:    'Atlas conectando.',
  listening:     'Pronto para ouvir.',
  transcribing:  'Atlas transcrevendo.',
  thinking:      'Atlas pensando.',
  speaking:      'Atlas falando.',
  reconnecting:  'Atlas reconectando.',
  failed:        'Atlas não conseguiu continuar.',
}

const STATE_ACCESSIBILITY_LABELS: Record<VoiceModeState, string> = {
  starting:      'Atlas preparando a conversa por voz.',
  connecting:    'Atlas conectando ao LiveKit.',
  listening:     'Atlas ao vivo. Pode falar normalmente.',
  transcribing:  'Atlas transcrevendo seu áudio.',
  thinking:      'Atlas pensando na resposta.',
  speaking:      'Atlas falando a resposta.',
  reconnecting:  'Atlas reconectando a conversa por voz.',
  failed:        'Atlas não conseguiu continuar a conversa por voz.',
}

const STATE_ACCESSIBILITY_HINTS: Record<VoiceModeState, string> = {
  starting:      'Aguarde a sessão ficar pronta.',
  connecting:    'Aguarde a conexão com a sala de voz.',
  listening:     'Fale normalmente. O microfone já está aberto para a conversa ao vivo.',
  transcribing:  'Aguarde a transcrição terminar.',
  thinking:      'Aguarde a resposta do Atlas.',
  speaking:      'Fale por cima para interromper a resposta.',
  reconnecting:  'Aguarde a reconexão automática.',
  failed:        'Encerre e abra novamente se o modo de voz não recuperar.',
}

const RECORDING_UNAVAILABLE_HINTS: Record<MobileVoiceRecordingBlockReason, string> = {
  mode_closed: 'O modo de voz está fechado.',
  missing_session: 'A sessão de voz ainda não foi criada.',
  session_not_ready: 'Aguarde a sessão ficar pronta.',
  recording_active: 'A gravação atual já está em andamento.',
  operation_in_flight: 'Aguarde a operação atual terminar.',
  session_closing: 'Aguarde o fechamento da sessão atual.',
  session_starting: 'Aguarde a sessão ficar pronta.',
  session_failed: 'Encerre e abra novamente o modo de voz.',
}

const STATE_PULSE_DURATION: Record<VoiceModeState, number> = {
  starting:     1300, // 1.3s · preparação de sessão sem ansiedade visual
  connecting:   1100,
  listening:    1200, // 1.2s · cadência calma · "estou ouvindo"
  transcribing: 1050, // 1.05s · transcrição assíncrona em andamento
  thinking:     1500, // 1.5s · mais lento · processamento
  speaking:     600,  // 0.6s · mais rápido · ato de fala
  reconnecting: 760,
  failed:       900,  // 0.9s · feedback breve sem travar o fluxo
}

const STATE_PULSE_AMPLITUDE: Record<VoiceModeState, number> = {
  starting:     0.07, // 1.0 ↔ 1.07 · boot discreto
  connecting:   0.09,
  listening:    0.12, // 1.0 ↔ 1.12 · subtle
  transcribing: 0.10, // 1.0 ↔ 1.10 · intermediário entre escuta e decisão
  thinking:     0.08, // 1.0 ↔ 1.08 · ainda mais subtle
  speaking:     0.40, // 1.0 ↔ 1.40 · amplo, expressivo
  reconnecting: 0.14,
  failed:       0.05, // 1.0 ↔ 1.05 · quase parado, sinal de falha discreto
}

export function VoiceModeSheet({
  visible,
  state = 'listening',
  recording = false,
  recordingEnabled = true,
  recordingUnavailableReason = null,
  onHoldStart,
  onHoldEnd,
  liveKitSession = null,
  statusDetail = null,
  onLiveKitConnected,
  onLiveKitDisconnected,
  onLiveKitError,
  onClose,
}: Props) {
  const c = useTheme().c
  const insets = useSafeAreaInsets()
  const effectiveState = recording ? 'listening' : state
  const stateLabel = statusDetail?.trim() || (recording ? 'Estou ouvindo.' : STATE_LABELS[state])
  const markColor = effectiveState === 'failed' ? c.recRed : c.bronze
  const pressDisabled = true
  const interactionOpacity = 1
  const actionLabel = state === 'failed'
    ? unavailableActionLabel(recordingUnavailableReason, state)
    : liveKitSession
      ? liveKitSession.roomName
      : 'Aguardando LiveKit'
  const accessibilityLabel = recording
    ? 'Atlas está ouvindo. Toque para enviar o turno de voz.'
    : STATE_ACCESSIBILITY_LABELS[state]
  const accessibilityHint = !recording && pressDisabled && recordingUnavailableReason
    ? RECORDING_UNAVAILABLE_HINTS[recordingUnavailableReason] ?? STATE_ACCESSIBILITY_HINTS[state]
    : STATE_ACCESSIBILITY_HINTS[state]
  const handlePress = recording ? onHoldEnd : onHoldStart

  const pulseScale = useSharedValue(1)

  // Pulse animation · cadência muda com estado (escutando/transcrevendo/pensando/falando).
  // useEffect re-arma o withRepeat sempre que `state` ou `visible` muda.
  useEffect(() => {
    if (!visible) {
      cancelAnimation(pulseScale)
      pulseScale.value = withTiming(1, { duration: 200 })
      return
    }
    const duration = STATE_PULSE_DURATION[effectiveState]
    const amplitude = STATE_PULSE_AMPLITUDE[effectiveState]
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1 + amplitude, { duration: duration / 2, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: duration / 2, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    )
    return () => {
      cancelAnimation(pulseScale)
    }
  }, [visible, effectiveState, pulseScale])

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }))

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {liveKitSession ? (
          <LiveKitVoiceTransport
            session={liveKitSession}
            connected={visible && state !== 'failed'}
            onConnected={onLiveKitConnected}
            onDisconnected={onLiveKitDisconnected}
            onError={onLiveKitError}
          />
        ) : null}
        <Pressable
          style={({ pressed }) => [
            styles.center,
            {
              opacity: pressed && !pressDisabled ? 0.9 : interactionOpacity,
            },
          ]}
          onPress={handlePress}
          disabled={pressDisabled}
          accessibilityRole="text"
          accessibilityState={{ disabled: pressDisabled, busy: state === 'starting' || state === 'transcribing' || state === 'thinking' }}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
        >
          {/* ✦ bronze 96px Frau italic centered · pulsing animation cadência
              dinâmica (ver STATE_PULSE_DURATION). Substitui visualizer SaaS
              por signature Atlas radical · "presença ao vivo do Atlas". */}
          <Animated.View style={[styles.markWrap, pulseStyle]}>
            <Frau italic size={96} lineHeight={96} color={markColor} align="center">
              ✦
            </Frau>
          </Animated.View>

          {/* Waveform · 10 bars verticais com delay scaleado · vocabulário
              editorial "voz viva", não EQ visualizer SaaS. Cada bar respira
              em altura, criando o sense de fala/escuta sem mostrar dB. */}
          <Waveform active={visible} state={effectiveState} />

          {/* Indicator state · italic Frau 19 ink2 com período. Vocabulário
              imperativo curto: "Atlas escutando." (não "Listening..."). */}
          <Frau italic size={19} lineHeight={26} color={c.ink2} align="center" style={styles.stateLabel}>
            {stateLabel}
          </Frau>

          <View style={[styles.holdHint, { borderColor: markColor }]}>
            <Sans weight="med" size={14} lineHeight={18} color={markColor} align="center">
              {actionLabel}
            </Sans>
          </View>
        </Pressable>

        {/* Footer "Encerrar" · mono caps small ink3 centrado · saída editorial
            sem botão pill. Tap encerra a conversa por voz e fecha o modal. */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={({ pressed }) => [styles.encerrar, { opacity: pressed ? 0.55 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="encerrar conversa por voz"
          accessibilityHint="Fecha o modo de conversa por voz."
        >
          <Mono size={11} lineHeight={14} letterSpacing={1.6} color={c.ink3}>
            ENCERRAR
          </Mono>
        </Pressable>
      </View>
    </Modal>
  )
}

function LiveKitVoiceTransport({
  session,
  connected,
  onConnected,
  onDisconnected,
  onError,
}: {
  session: VoiceModeLiveKitSession
  connected: boolean
  onConnected?: () => void
  onDisconnected?: (reason?: string) => void
  onError?: (message: string) => void
}) {
  const livekit = getLiveKitNative()
  const AudioSession = livekit?.AudioSession
  const LiveKitRoom = livekit?.LiveKitRoom

  useEffect(() => {
    if (!AudioSession) {
      onError?.('LiveKit nativo ausente neste build. Rode um development build com WebRTC.')
      return
    }
    let mounted = true
    AudioSession.startAudioSession()
      .catch((error) => {
        if (mounted) onError?.(error instanceof Error ? error.message : 'Falha ao iniciar audio session LiveKit.')
      })
    return () => {
      mounted = false
      AudioSession.stopAudioSession().catch(() => {})
    }
  }, [AudioSession, onError])

  if (!LiveKitRoom) return null

  return (
    <LiveKitRoom
      serverUrl={session.livekitUrl}
      token={session.participantToken}
      connect={connected}
      audio
      video={false}
      options={{
        adaptiveStream: false,
        dynacast: false,
      }}
      onConnected={() => onConnected?.()}
      onDisconnected={() => onDisconnected?.()}
      onError={(error: unknown) => onError?.(error instanceof Error ? error.message : 'Falha na conexão LiveKit.')}
      onMediaDeviceFailure={(failure: unknown) => onError?.(`Falha de dispositivo de audio: ${failure ?? 'desconhecida'}.`)}
    />
  )
}

function getLiveKitNative(): {
  AudioSession: {
    startAudioSession: () => Promise<void>
    stopAudioSession: () => Promise<void>
  }
  LiveKitRoom: ComponentType<Record<string, unknown>>
} | null {
  if (!NativeModules.WebRTCModule) {
    return null
  }

  try {
    const livekit = require('@livekit/react-native') as {
      AudioSession?: {
        startAudioSession: () => Promise<void>
        stopAudioSession: () => Promise<void>
      }
      LiveKitRoom?: ComponentType<Record<string, unknown>>
    }
    if (!livekit.AudioSession || !livekit.LiveKitRoom) return null

    return {
      AudioSession: livekit.AudioSession,
      LiveKitRoom: livekit.LiveKitRoom,
    }
  } catch {
    return null
  }
}

function unavailableActionLabel(reason: MobileVoiceRecordingBlockReason | null, state: VoiceModeState): string {
  if (state === 'starting' || state === 'connecting' || reason === 'session_starting' || reason === 'session_not_ready') return 'Preparando voz'
  if (state === 'failed' || reason === 'session_failed') return 'Encerre e tente de novo'
  if (reason === 'operation_in_flight') return 'Aguarde'
  if (reason === 'recording_active') return 'Gravando'
  return 'Indisponível'
}

// Waveform · 10 vertical bars animadas em sequência. Cada bar tem delay próprio
// pra criar onda visual sequencial (não pulse simultâneo). Altura oscila entre
// 8px e 32px. Easing inOut suave · vocabulário "voz viva" editorial.
function Waveform({ active, state }: { active: boolean; state: VoiceModeState }) {
  const bars = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  return (
    <View style={styles.waveform}>
      {bars.map((idx) => (
        <WaveformBar key={idx} active={active} state={state} delay={idx * 90} />
      ))}
    </View>
  )
}

function WaveformBar({ active, state, delay }: { active: boolean; state: VoiceModeState; delay: number }) {
  const c = useTheme().c
  const height = useSharedValue(8)

  useEffect(() => {
    if (!active) {
      cancelAnimation(height)
      height.value = withTiming(8, { duration: 200 })
      return
    }
    // Cadência sincronizada com state (escutando/transcrevendo/pensando/falando/falha).
    const duration = state === 'speaking' ? 360 : state === 'thinking' ? 800 : state === 'transcribing' ? 680 : state === 'failed' ? 900 : state === 'starting' ? 760 : state === 'connecting' ? 700 : state === 'reconnecting' ? 520 : 600
    height.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(28, {
            duration,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(8, {
            duration,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    )
    return () => {
      cancelAnimation(height)
    }
  }, [active, state, delay, height])

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }))

  return (
    <Animated.View
      style={[
        styles.waveformBar,
        { backgroundColor: state === 'failed' ? c.recRed : c.bronze, opacity: 0.55 },
        animatedStyle,
      ]}
    />
  )
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  // Center wrapper · ✦ + waveform + state label centralizados absolutos.
  // Vocabulário "salão Don Corleone": tela inteira é o ato cognitivo,
  // sem distração de chrome.
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  markWrap: {
    marginBottom: 56,
  },
  // Waveform · 10 bars 4px de largura, gap 6px entre. Container fixo 56px
  // de altura pra dar espaço pras bars oscilarem sem cortar.
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    gap: 6,
    marginBottom: 40,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
  },
  stateLabel: {
    letterSpacing: 0,
  },
  holdHint: {
    minWidth: 176,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 26,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Encerrar · mono caps centrado no rodapé · whisper editorial.
  // marginBottom 32 dá respiração com safe-area inset.
  encerrar: {
    paddingVertical: 18,
    marginBottom: 24,
    alignItems: 'center',
  },
})
