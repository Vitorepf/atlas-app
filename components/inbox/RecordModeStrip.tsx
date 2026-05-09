import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Frau, Mono } from '../../design/Type'
import { useTheme } from '../../design/theme'

interface Props {
  /** Visível quando recordingActive · controlada pelo parent. */
  visible: boolean
  /** Callback · cancelar gravação (descarta áudio). Confirmação é interna do strip. */
  onCancel: () => void
  /** Callback · enviar gravação (vai pro inbox como captura silenciosa). */
  onSend: () => void
  /** Callback · toggle pause/resume. Parent controla recorder.pause/record. */
  onPauseToggle: () => void
  /** Estado pause · vindo do parent (recorderState.isRecording invertido). */
  paused: boolean
  /** Duração externa em ms (do recorderState.durationMillis). */
  durationMs?: number
}

// =============================================================================
// RecordModeStrip · enterprise tap-lock (v2)
// =============================================================================
//
// Refator enterprise · elimina bugs do WhatsApp-style "solta dedo = envia"
// (que causava sends acidentais + race conditions). Agora:
//
//   · Long-press hold inicia → entra em LOCK AUTOMÁTICO imediato
//   · Solta dedo NÃO envia (continua gravando até user explícito tap)
//   · 3 botões claros: Cancelar · Pausar · Enviar
//   · Cancelar com confirmação (tap 1: "Cancelar?", tap 2: descarta)
//   · Pausar toggleable (canon iOS Voice Memo · pode pausar e continuar)
//
// Vocabulário Atlas premium:
//   · Cancelar (italic ink2) → tap → vira "Cancelar?" (italic recRed) → tap = descarta
//   · Pausar/Continuar (italic ink2 ou bronze quando paused) → toggle
//   · Enviar (italic bronze weight medium) → único caminho de envio · ato editorial
// =============================================================================

export function RecordModeStrip({
  visible,
  onCancel,
  onSend,
  onPauseToggle,
  paused,
  durationMs,
}: Props) {
  const c = useTheme().c
  const insets = useSafeAreaInsets()
  const [internalElapsedMs, setInternalElapsedMs] = useState(0)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const startedAtRef = useRef<number | null>(null)
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelConfirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Lock pra Pause toggle · debounce 300ms evita race entre taps rápidos +
  // recorder transitions. UI fica responsivo sem causar inconsistências.
  const pauseLockRef = useRef(false)
  const elapsedMs = durationMs != null ? durationMs : internalElapsedMs

  const pulseOpacity = useSharedValue(0.6)
  const pulseScale = useSharedValue(1)

  // Pulse · ativo quando recording (não paused). Pausado fica estático.
  useEffect(() => {
    if (!visible || paused) {
      cancelAnimation(pulseOpacity)
      cancelAnimation(pulseScale)
      pulseOpacity.value = withTiming(paused ? 0.4 : 0.6, { duration: 200 })
      pulseScale.value = withTiming(1, { duration: 200 })
      return
    }
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.6, { duration: 800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    )
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    )
    return () => {
      cancelAnimation(pulseOpacity)
      cancelAnimation(pulseScale)
    }
  }, [visible, paused, pulseOpacity, pulseScale])

  // Timer interno · só roda quando externalDuration NÃO foi passado.
  // Pause sincroniza · quando paused, timer interno também pausa.
  useEffect(() => {
    if (!visible || durationMs != null || paused) {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current)
        tickIntervalRef.current = null
      }
      return
    }
    startedAtRef.current = Date.now() - internalElapsedMs
    tickIntervalRef.current = setInterval(() => {
      if (startedAtRef.current != null) {
        setInternalElapsedMs(Date.now() - startedAtRef.current)
      }
    }, 200)
    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current)
        tickIntervalRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, durationMs, paused])

  // Reset state quando barra esconde · próxima sessão começa do zero.
  useEffect(() => {
    if (!visible) {
      setInternalElapsedMs(0)
      setConfirmingCancel(false)
      if (cancelConfirmTimeoutRef.current) {
        clearTimeout(cancelConfirmTimeoutRef.current)
        cancelConfirmTimeoutRef.current = null
      }
    }
  }, [visible])

  // Cancelar com confirmação · tap 1: arma confirm (4s timeout), tap 2: confirma.
  // Se user não tap dentro de 4s, confirm sai do estado armado (volta ao normal).
  const handleCancelTap = () => {
    if (confirmingCancel) {
      // Confirma cancel
      if (cancelConfirmTimeoutRef.current) {
        clearTimeout(cancelConfirmTimeoutRef.current)
        cancelConfirmTimeoutRef.current = null
      }
      setConfirmingCancel(false)
      onCancel()
      return
    }
    // Arma confirm
    setConfirmingCancel(true)
    cancelConfirmTimeoutRef.current = setTimeout(() => {
      setConfirmingCancel(false)
      cancelConfirmTimeoutRef.current = null
    }, 4000)
  }

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }))

  if (!visible) return null

  return (
    <View
      pointerEvents="box-none"
      style={[styles.absoluteFill, { paddingBottom: insets.bottom }]}
    >
      {/* Hint editorial · vocabulário canon · informa user que está em lock mode.
          Tap em "Enviar" é a única forma de enviar (canon enterprise). */}
      <View style={styles.hintWrap}>
        <Frau italic size={13} lineHeight={20} color={c.ink3}>
          {paused ? 'gravação pausada' : 'gravando · tocar enviar para confirmar'}
        </Frau>
      </View>

      <View
        style={[
          styles.bar,
          {
            backgroundColor: `${c.bgRaised}F0`,
            borderColor: c.borderSoft,
          },
        ]}
      >
        <View style={styles.leftCluster}>
          {/* ✦ recRed pulsing · "ATIVO gravando" · pausado fica estático ink3 */}
          <Animated.View style={pulseStyle}>
            <Frau italic size={22} lineHeight={22} color={paused ? c.ink3 : c.recRed}>
              ✦
            </Frau>
          </Animated.View>
          <Mono weight="med" size={13} lineHeight={18} letterSpacing={0.6} color={c.ink2}>
            {formatTimer(elapsedMs)}
          </Mono>
        </View>

        <View style={styles.actions}>
          {/* Cancelar · com confirmação · tap 1 vira "Cancelar?" recRed, tap 2 confirma */}
          <Pressable
            onPress={handleCancelTap}
            hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
            accessibilityRole="button"
            accessibilityLabel={confirmingCancel ? 'tocar novamente para confirmar cancelamento' : 'cancelar gravação'}
          >
            <Frau
              italic
              weight={confirmingCancel ? 'med' : 'reg'}
              size={14}
              lineHeight={20}
              color={confirmingCancel ? c.recRed : c.ink2}
            >
              {confirmingCancel ? 'Cancelar?' : 'Cancelar'}
            </Frau>
          </Pressable>

          {/* Pausar/Continuar · toggle canon iOS Voice Memo · debounce 300ms
              evita spam-tap durante transições do recorder.isRecording. */}
          <Pressable
            onPress={() => {
              if (pauseLockRef.current) return
              pauseLockRef.current = true
              onPauseToggle()
              setTimeout(() => { pauseLockRef.current = false }, 300)
            }}
            hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
            accessibilityRole="button"
            accessibilityLabel={paused ? 'continuar gravação' : 'pausar gravação'}
          >
            <Frau italic size={14} lineHeight={20} color={paused ? c.bronze : c.ink2}>
              {paused ? 'Continuar' : 'Pausar'}
            </Frau>
          </Pressable>

          {/* Enviar · ÚNICO caminho de envio · italic bronze weight medium · ato editorial */}
          <Pressable
            onPress={onSend}
            hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
            accessibilityRole="button"
            accessibilityLabel="enviar gravação"
          >
            <Frau italic weight="med" size={14} lineHeight={20} color={c.bronze}>
              Enviar
            </Frau>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

function formatTimer(elapsedMs: number): string {
  const totalSec = Math.floor(elapsedMs / 1000)
  const hours = Math.floor(totalSec / 3600)
  const min = Math.floor((totalSec % 3600) / 60)
  const sec = totalSec % 60
  if (hours > 0) {
    return `${hours}:${pad(min)}:${pad(sec)}`
  }
  return `${pad(min)}:${pad(sec)}`
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

const styles = StyleSheet.create({
  absoluteFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 0,
  },
  hintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 92,
    alignItems: 'center',
    opacity: 0.7,
  },
  bar: {
    height: 64,
    borderRadius: 36,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 22,
    paddingRight: 18,
    marginBottom: 18,
    shadowColor: '#1A1612',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 24,
    elevation: 6,
  },
  leftCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 16,
    flexShrink: 0,
  },
})
