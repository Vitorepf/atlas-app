import { useEffect } from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
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

export type VoiceModeState = 'listening' | 'thinking' | 'speaking'

interface Props {
  visible: boolean
  state?: VoiceModeState
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
//     do pulse comunica estado: escutando 1.2s · falando 0.6s · pensando 1.5s
//   · Waveform 10 bars animadas em sequência · não EQ visualizer SaaS, mais
//     peso "voz viva" editorial
//   · Indicator italic Frau 19 ink2: "Atlas escutando." / "Atlas pensando." /
//     "Atlas falando." (alterna por estado, com período)
//   · Footer "Encerrar" mono caps small ink3 · saída editorial sem botão
// =============================================================================

const STATE_LABELS: Record<VoiceModeState, string> = {
  listening: 'Atlas escutando.',
  thinking:  'Atlas pensando.',
  speaking:  'Atlas falando.',
}

const STATE_PULSE_DURATION: Record<VoiceModeState, number> = {
  listening: 1200, // 1.2s · cadência calma · "estou ouvindo"
  thinking:  1500, // 1.5s · mais lento · processamento
  speaking:  600,  // 0.6s · mais rápido · ato de fala
}

const STATE_PULSE_AMPLITUDE: Record<VoiceModeState, number> = {
  listening: 0.12, // 1.0 ↔ 1.12 · subtle
  thinking:  0.08, // 1.0 ↔ 1.08 · ainda mais subtle
  speaking:  0.40, // 1.0 ↔ 1.40 · amplo, expressivo
}

export function VoiceModeSheet({ visible, state = 'listening', onClose }: Props) {
  const c = useTheme().c
  const insets = useSafeAreaInsets()
  const stateLabel = STATE_LABELS[state]

  const pulseScale = useSharedValue(1)

  // Pulse animation · cadência muda com estado (escutando/pensando/falando).
  // useEffect re-arma o withRepeat sempre que `state` ou `visible` muda.
  useEffect(() => {
    if (!visible) {
      cancelAnimation(pulseScale)
      pulseScale.value = withTiming(1, { duration: 200 })
      return
    }
    const duration = STATE_PULSE_DURATION[state]
    const amplitude = STATE_PULSE_AMPLITUDE[state]
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
  }, [visible, state, pulseScale])

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
        <View style={styles.center}>
          {/* ✦ bronze 96px Frau italic centered · pulsing animation cadência
              dinâmica (ver STATE_PULSE_DURATION). Substitui visualizer SaaS
              por signature Atlas radical · "presença ao vivo do Atlas". */}
          <Animated.View style={[styles.markWrap, pulseStyle]}>
            <Frau italic size={96} lineHeight={96} color={c.bronze} align="center">
              ✦
            </Frau>
          </Animated.View>

          {/* Waveform · 10 bars verticais com delay scaleado · vocabulário
              editorial "voz viva", não EQ visualizer SaaS. Cada bar respira
              em altura, criando o sense de fala/escuta sem mostrar dB. */}
          <Waveform active={visible} state={state} />

          {/* Indicator state · italic Frau 19 ink2 com período. Vocabulário
              imperativo curto: "Atlas escutando." (não "Listening..."). */}
          <Frau italic size={19} lineHeight={26} color={c.ink2} align="center" style={styles.stateLabel}>
            {stateLabel}
          </Frau>
        </View>

        {/* Footer "Encerrar" · mono caps small ink3 centrado · saída editorial
            sem botão pill. Tap encerra a conversa por voz e fecha o modal. */}
        <Pressable
          onPress={onClose}
          hitSlop={12}
          style={({ pressed }) => [styles.encerrar, { opacity: pressed ? 0.55 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="encerrar conversa por voz"
        >
          <Mono size={11} lineHeight={14} letterSpacing={1.6} color={c.ink3}>
            ENCERRAR
          </Mono>
        </Pressable>
      </View>
    </Modal>
  )
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
    // Cadência sincronizada com state (escutando lento, falando rápido).
    const duration = state === 'speaking' ? 360 : state === 'thinking' ? 800 : 600
    height.value = withRepeat(
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
        { backgroundColor: c.bronze, opacity: 0.55 },
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
  // Encerrar · mono caps centrado no rodapé · whisper editorial.
  // marginBottom 32 dá respiração com safe-area inset.
  encerrar: {
    paddingVertical: 18,
    marginBottom: 24,
    alignItems: 'center',
  },
})
