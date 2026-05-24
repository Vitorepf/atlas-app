/**
 * Atlas Composer Card · CANON PROMISE implementation.
 *
 * Mockup-fiel ao prometido em atlas-composer-mockup.html (Variante B
 * Editorial DividerEditorial). UM CARD único, sheet-radius 22px, border
 * alpha cream, dentro:
 *
 *   [Frau italic placeholder hero "Escreva ao Atlas" + ✦ inline quando focused]
 *   [paperclip] [· auto pill] · [mic] ──────────────────────────────────
 *
 * Action row interno = paperclip esquerda + auto pill (abre routing full
 * com mode/task/domain/style/executor) + mic direita. Send arrow (→)
 * aparece à direita SUBSTITUINDO o mic quando há texto, gold canon.
 *
 * Voice canon corrigido: mic é sempre captura de áudio. Voice Realtime fica
 * em um botão separado para não roubar o comportamento principal do mic.
 * Quando há texto, mic vira send que envia a mensagem.
 */
import { useEffect, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import {
  labelAtlasComputeEffortShort,
  nextAtlasComputeEffort,
  type AtlasComputeEffortChoice,
} from '../../../lib/richInput'
import Animated, {
  Easing,
  FadeInDown,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Frau } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import { fonts } from '../../../design/tokens'
import { PressableIconScale as CanonicalPressableIconScale } from '../../atlas-ui/PressableScale'
import {
  deriveCardState,
  placeholderTextFor,
  resolveLongPressMicAction,
} from './AtlasComposerCardModel'

interface Props {
  /** Atlas mode atual (label exibido na pill auto). */
  modeLabel: string
  computeEffort: AtlasComputeEffortChoice
  onComputeEffortChange: (next: AtlasComputeEffortChoice) => void
  /** Draft text · usado pra mostrar input value e calcular `hasText`. */
  value: string
  onChangeText: (next: string) => void
  /** Submit (send arrow tap ou keyboard return). */
  onSubmit: () => void
  /** Tap rápido no mic → inicia captura de áudio normal. */
  onMicTap?: () => void
  /** Long-press no mic → também inicia captura de áudio normal. */
  onLongPressMic?: () => void
  /** Botão separado → abre Voice Mode / conversa por voz. */
  onVoiceTap?: () => void
  /** Abre AtlasDecideSheet (routing config full · mode/task/domain/style/executor). */
  onOpenRouting: () => void
  /** Abre attachment picker sheet. */
  onOpenAttachmentSheet: () => void
  /** Disabled enquanto interação em curso. */
  disabled?: boolean
  /** Quando true · gravação ativa · UI exibe estado canon. */
  recording?: boolean
  /** Quantidade de anexos · badge no paperclip. */
  attachmentCount?: number
  /** Placeholder text · default 'Escreva ao Atlas'. */
  placeholder?: string
  /** True se pode submit mesmo sem texto (ex: tem anexos). */
  canSubmitWithoutText?: boolean
  /** Notification de focus pro parent (se quiser ajustar layout). */
  onFocus?: () => void
}

export function AtlasComposerCard({
  modeLabel,
  computeEffort,
  onComputeEffortChange,
  value,
  onChangeText,
  onSubmit,
  onMicTap,
  onLongPressMic,
  onVoiceTap,
  onOpenRouting,
  onOpenAttachmentSheet,
  disabled = false,
  recording = false,
  attachmentCount = 0,
  placeholder = 'Escreva ao Atlas',
  canSubmitWithoutText = false,
  onFocus,
}: Props) {
  const { c } = useTheme()
  const [isFocused, setIsFocused] = useState(false)
  // Slice 6ai · respeita system "Reduce Motion" iOS canon accessibility.
  // Quando habilitado: infinite pulses desativam, transições viram instant
  // ou fade muito sutil. Apple HIG canon.
  const reducedMotion = useReducedMotion()

  // Slice 6l · derivação stateful via model puro testável
  const state = deriveCardState({
    value,
    disabled,
    recording,
    canSubmitWithoutText,
    isFocused,
  })
  const { hasText, canSubmit, showCursor } = state
  const placeholderText = placeholderTextFor(placeholder)
  // Slice 6al · typography do TextInput agora CONSISTENTE (Inter sans 16px
  // sempre) · placeholder Frau italic 20px é overlay absoluto separado
  // que faz fade in/out smooth (não swap de fonte/size instantâneo).
  // Premium: sem jump visual quando user digita 1ª letra ou apaga tudo.
  // (placeholderTypographyFor mantida no model pra tests + futuros casos)

  // Focus state · gold accent border animation canon
  const focusedValue = useSharedValue(0)
  useEffect(() => {
    // Slice 6al · 320ms (era 240) · transição mais lenta = mais calma.
    // Border cream→gold acompanha o ritmo das outras animations (placeholder
    // fade + cross-fade), todas em 280-320ms · sincronia editorial.
    focusedValue.value = withTiming(isFocused ? 1 : 0, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    })
  }, [isFocused, focusedValue])
  const cardAnimStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusedValue.value,
      [0, 1],
      // alpha cream 0.10 → atlas gold border 0.55. Subtle premium activation.
      [`rgba(233, 238, 242, 0.10)`, `${c.bronze}8C`],
    ),
  }))

  // ✦ cursor signature REMOVIDO após review do usuário ·
  // confundia visualmente (parecia ícone decorativo flutuante sem função
  // clara). O focused-state border cream→atlas gold (cardAnimStyle acima)
  // já é o signal de "input ativo" canon premium · combinado com o
  // cursor nativo iOS em gold (selectionColor/cursorColor abaixo).
  // Premium = restraint, não acumular ornamentos.
  void showCursor // mantém model logic intacta pra back-compat

  // Slice 6al · placeholder overlay opacity · fade smooth quando user
  // digita (hasText false→true) ou apaga (hasText true→false). Substitui
  // o swap brusco de fontFamily/fontSize que estava aggressive.
  const placeholderOpacity = useSharedValue(hasText ? 0 : 1)
  useEffect(() => {
    // Slice 6al · 280ms · sincronia com outras animations · transição calma.
    placeholderOpacity.value = withTiming(hasText ? 0 : 1, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    })
  }, [hasText, placeholderOpacity])
  const placeholderAnimStyle = useAnimatedStyle(() => ({
    opacity: placeholderOpacity.value,
  }))

  // Send button breath · subtle scale loop quando ready
  // Slice 6ai · reducedMotion → scale fixo 1, sem breath infinito
  const sendBreath = useSharedValue(1)
  useEffect(() => {
    if (canSubmit && !reducedMotion) {
      sendBreath.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      )
    } else {
      cancelAnimation(sendBreath)
      sendBreath.value = withTiming(1, { duration: 180 })
    }
  }, [canSubmit, sendBreath, reducedMotion])
  const sendBreathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendBreath.value }],
  }))

  // Slice 6q · mic ↔ send cross-fade · 0 → 1 quando canSubmit muda.
  // Slice 6al · duração 280ms (era 200) · sincronia com placeholder fade
  // + focused border · todas as transições em ritmo editorial calmo.
  const sendOpacity = useSharedValue(0)
  useEffect(() => {
    sendOpacity.value = withTiming(canSubmit ? 1 : 0, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    })
  }, [canSubmit, sendOpacity])
  const sendCrossFadeStyle = useAnimatedStyle(() => ({
    opacity: sendOpacity.value,
  }))
  const micCrossFadeStyle = useAnimatedStyle(() => ({
    opacity: 1 - sendOpacity.value,
  }))

  // Slice 6m · processing shimmer · subtle border opacity pulse quando
  // disabled (typically durante envio em andamento). Premium signal de
  // "Atlas processando" sem virar spinner SaaS chunky · canon manuscript:
  // o card respira enquanto Atlas pensa, marca d'água viva.
  // Slice 6ai · reducedMotion → static 0.7 opacity, sem pulse
  const processingPulse = useSharedValue(0)
  useEffect(() => {
    if (disabled && !recording) {
      if (reducedMotion) {
        processingPulse.value = withTiming(0.7, { duration: 200 })
        return
      }
      processingPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: 800, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      )
    } else {
      cancelAnimation(processingPulse)
      processingPulse.value = withTiming(0, { duration: 180 })
    }
  }, [disabled, recording, processingPulse, reducedMotion])
  const processingStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + processingPulse.value * 0.35, // 0.55 ↔ 0.90 pulse range
  }))

  const handlePillPress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    onOpenRouting()
  }
  const handleEffortPress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    onComputeEffortChange(nextAtlasComputeEffort(computeEffort))
  }
  const handleAttachPress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    onOpenAttachmentSheet()
  }
  const handleSendPress = () => {
    if (!canSubmit) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    onSubmit()
  }
  const handleMicLongPress = () => {
    // Slice 6l · decision via model puro
    const action = resolveLongPressMicAction({
      value,
      attachmentCount,
      disabled,
      recording,
    })
    if (action === 'noop') return
    // Caller decide o que fazer (voice_mode vs start_recording) via callback único
    onLongPressMic?.()
  }

  return (
    <Animated.View
      // Slice 6x + 6al refine · entry animation smooth iOS curve.
      // Antes: springify damping 18 mass 0.8 (podia bouncear/aggressive).
      // Agora: pure timing 380ms bezier canon iOS sheet (out cubic).
      // "Papel pousando" calmo · zero overshoot · zero bounce.
      entering={FadeInDown.duration(380).easing(Easing.bezier(0.16, 1, 0.3, 1))}
      style={[
        styles.card,
        {
          // Slice 6ag · backgroundColor reduzido pra deixar BlurView
          // dominar · canon iOS frosted glass premium (Apple Mail/Messages).
          // Quando expo-blur native não compilado, surface bg garante fallback.
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : c.surface,
          // Premium embossed manuscript feel · inner top highlight (subtle
          // cream over slate raised) + 1px bottom shade. Don Corleone
          // signet ring carving on cream paper canon. Apple-grade depth.
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 10,
          elevation: 2,
        },
        cardAnimStyle,
      ]}
    >
      {/* Slice 6ag · BlurView native iOS canon · systemChromeMaterialDark
          mesmo material do Apple share sheet / iOS alert. Camada de blur
          sob o card. Fallback gracioso · em Android (no native blur),
          surface bg acima preserva legibilidade. */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={56}
          tint="systemChromeMaterialDark"
          experimentalBlurMethod="dimezisBlurView"
          style={[StyleSheet.absoluteFillObject, { borderRadius: 22 }]}
        />
      ) : null}
      {/* Slice 6ag · slate tint overlay · sutil sobre o blur pra preservar
          paleta canon mesmo com material iOS por baixo. Alpha controla
          quanto do blur do conteúdo abaixo "vaza" através. */}
      {Platform.OS === 'ios' ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: `${c.surface}D9`, borderRadius: 22 },
          ]}
        />
      ) : null}
      {/* Inner top highlight · canon embossed manuscript feel */}
      <View style={styles.cardInnerHighlight} pointerEvents="none" />

      {/* Slice 6m · processing pulse overlay · opacity-pulse subtle veil
          durante envio em andamento (disabled). Sinal premium "Atlas
          pensando" sem virar spinner SaaS · canon Don Corleone "marca
          d'água viva no manuscript". */}
      {disabled && !recording ? (
        <Animated.View
          style={[
            styles.processingVeil,
            { backgroundColor: c.bronze },
            processingStyle,
          ]}
          pointerEvents="none"
        />
      ) : null}

      {/* HERO PLACEHOLDER + INPUT · Slice 6al · TextInput Inter sans 16px
          CONSTANTE (zero swap de fonte). Overlay Frau italic 20px renderiza
          ABSOLUTO sobre o input quando empty · fade smooth quando hasText
          muda · placeholder hero sem jump visual. */}
      <View style={styles.heroRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          // placeholder NATIVO vazio · custom Frau italic overlay below
          placeholder=""
          editable={!disabled}
          multiline
          accessibilityLabel={`campo de mensagem para Atlas AI · ${placeholderText}`}
          accessibilityHint="escreva sua pergunta · paperclip anexa arquivo · auto configura modo · microfone grava áudio · voz abre conversa por voz"
          // Slice 6aj · cursor + selection atlas gold canon
          selectionColor={c.bronze}
          cursorColor={c.bronze}
          onFocus={() => {
            setIsFocused(true)
            onFocus?.()
          }}
          onBlur={() => setIsFocused(false)}
          textAlignVertical="top"
          style={[
            styles.input,
            {
              color: c.ink,
              // Slice 6al · Typography CONSISTENTE · Inter sans 16px sempre
              // (era swap Frau italic 20px ↔ Inter sans 16px que causava
              // jump visual aggressive quando user digita/apaga).
              fontFamily: fonts.sans,
              fontSize: 16,
              lineHeight: 24,
            },
          ]}
          autoCorrect
          spellCheck
          autoCapitalize="sentences"
          textContentType="none"
          autoComplete="off"
          importantForAutofill="no"
          submitBehavior="newline"
        />
        {/* Slice 6al · placeholder overlay Frau italic 20px hero canon
            posicionado absoluto · fade smooth via placeholderOpacity quando
            user digita/apaga. pointerEvents none · não bloqueia tap no input. */}
        <Animated.View
          style={[styles.placeholderOverlay, placeholderAnimStyle]}
          pointerEvents="none"
        >
          <Frau italic size={20} lineHeight={28} color={c.ink3}>
            {placeholderText}
          </Frau>
        </Animated.View>
      </View>

      {/* ACTION ROW interno · paperclip esquerda · auto pill · mic/send direita */}
      <View style={styles.actionRow}>
        <View style={styles.actionLeft}>
          <PressableIconScale
            onPress={handleAttachPress}
            disabled={disabled}
            label={attachmentCount > 0 ? `${attachmentCount} anexos` : 'anexar'}
          >
            <PaperclipIcon color={c.ink2} />
            {attachmentCount > 0 ? (
              <View style={[styles.iconBtnBadge, { backgroundColor: c.ink }]}>
                <Text style={[styles.iconBtnBadgeText, { color: c.bg }]}>{attachmentCount}</Text>
              </View>
            ) : null}
          </PressableIconScale>

          {/* AUTO pill · gold dot + Frau italic · abre routing full sheet
              Slice 6s · pressed state com Reanimated scale 0.96 + spring */}
          <PressablePillScale
            onPress={handlePillPress}
            disabled={disabled}
            label={`${modeLabel} · tocar para configurar conversa`}
            c={c}
            text={modeLabel}
          />
          <PressablePillScale
            onPress={handleEffortPress}
            disabled={disabled}
            label={`esforço ${labelAtlasComputeEffortShort(computeEffort)} · tocar para alternar`}
            c={c}
            text={labelAtlasComputeEffortShort(computeEffort)}
          />
          {!canSubmit && onVoiceTap ? (
            <PressableIconScale
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
                onVoiceTap()
              }}
              disabled={disabled}
              label="conversa por voz"
            >
              <VoiceRealtimeIcon color={c.ink2} />
            </PressableIconScale>
          ) : null}
        </View>

        {/* Slice 6q · mic ↔ send cross-fade canon premium · ambos overlaid
            no mesmo slot, opacity animada. Sem flicker layout-jump quando
            user digita primeira letra. iOS-native feel. */}
        <View style={[styles.actionRight, styles.actionRightOverlap]}>
          <Animated.View
            style={[styles.overlapSlot, sendBreathStyle, sendCrossFadeStyle]}
            pointerEvents={canSubmit ? 'auto' : 'none'}
          >
            <PressableIconScale
              onPress={handleSendPress}
              disabled={!canSubmit}
              label="enviar"
            >
              <SendIcon color={c.bronze} />
            </PressableIconScale>
          </Animated.View>
          <Animated.View
            style={[styles.overlapSlot, micCrossFadeStyle]}
            pointerEvents={canSubmit ? 'none' : 'auto'}
          >
            <PressableIconScale
              onPress={() => {
                // Tap rápido = captura de áudio normal.
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
                onMicTap?.()
              }}
              onLongPress={() => {
                // Long-press mantém o mesmo comportamento: captura áudio.
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
                handleMicLongPress()
              }}
              delayLongPress={420}
              disabled={disabled}
              label={
                onMicTap && onLongPressMic
                  ? 'gravar áudio'
                  : 'ditar'
              }
            >
              <MicIcon color={recording ? c.recRed : c.ink2} />
            </PressableIconScale>
          </Animated.View>
        </View>
      </View>
    </Animated.View>
  )
}

/* ─── Icons · stroke canon ──────────────────────────── */

// PressableIconScale migrado (round 2) · agora vem de components/atlas-ui.
// Wrapper local preserva o prop `label` legacy e delega ao canônico que
// usa `accessibilityLabel`. Zero mudança de comportamento.
// PressablePillScale abaixo continua local porque tem rendering interno
// específico (gold dot + Frau italic). Pra pills genéricas, ver MiniActionPill
// e ChoicePill em components/edition/Pills.tsx · mesmo canon visual.

function PressableIconScale({
  onPress,
  onLongPress,
  delayLongPress,
  disabled,
  label,
  children,
}: {
  onPress: () => void
  onLongPress?: () => void
  delayLongPress?: number
  disabled?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <CanonicalPressableIconScale
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      disabled={disabled}
      accessibilityLabel={label}
      haptic="none"
    >
      {children}
    </CanonicalPressableIconScale>
  )
}

/**
 * Slice 6s · pill with Reanimated press scale 0.96 spring canon iOS.
 * Premium feedback além de só opacity change.
 */
function PressablePillScale({
  onPress,
  disabled,
  label,
  c,
  text,
}: {
  onPress: () => void
  disabled: boolean
  label: string
  c: ReturnType<typeof useTheme>['c']
  text: string
}) {
  const pressScale = useSharedValue(1)
  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))
  return (
    <Animated.View style={pressAnimStyle}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPressIn={() => {
          pressScale.value = withTiming(0.96, { duration: 120, easing: Easing.out(Easing.quad) })
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { damping: 14, stiffness: 240, mass: 0.7 })
        }}
        style={({ pressed }) => [
          styles.pill,
          {
            borderColor: c.border,
            backgroundColor: pressed ? c.bgRaised : 'transparent',
            opacity: disabled ? 0.4 : 1,
          },
        ]}
      >
        <View style={[styles.pillDot, { backgroundColor: c.bronze, opacity: 0.95 }]} />
        <Frau italic size={13} lineHeight={16} color={c.ink2} numberOfLines={1}>
          {text}
        </Frau>
      </Pressable>
    </Animated.View>
  )
}

function PaperclipIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22}>
      <Path
        d="M16.05 6.85l-7.4 7.4a3.3 3.3 0 1 1-4.66-4.66l7.71-7.71a2.2 2.2 0 0 1 3.11 3.11l-7.4 7.4a1.1 1.1 0 1 1-1.55-1.55l6.93-6.93"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}

function MicIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={22}>
      <Rect x={6.7} y={2.5} width={6.6} height={11.5} rx={3.3} stroke={color} strokeWidth={1.7} fill="none" />
      <Path d="M3.5 10v1a6.5 6.5 0 0 0 13 0v-1" stroke={color} strokeWidth={1.7} strokeLinecap="round" fill="none" />
      <Line x1={10} y1={17.5} x2={10} y2={20} stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  )
}

function VoiceRealtimeIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22}>
      <Path
        d="M5.5 12.4a5.5 5.5 0 0 1 11 0"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M4.2 12.4v2.2a2 2 0 0 0 2 2h1.1v-6.2H6.2a2 2 0 0 0-2 2ZM17.8 12.4v2.2a2 2 0 0 1-2 2h-1.1v-6.2h1.1a2 2 0 0 1 2 2Z"
        stroke={color}
        strokeWidth={1.7}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M14.7 18.2c-.8.75-2 1.1-3.7 1.1"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  )
}

function SendIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22}>
      <Path
        d="M3 11h16M14 6l5 5-5 5"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}

/* Import SVG primitives at the bottom to keep top tidy */
import Svg, { Line, Path, Rect } from 'react-native-svg'

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 14,
    minHeight: 130,
    // overflow hidden garante que o inner highlight (rendered via children
    // se needed) não vaze do card. Border-radius preserved.
    overflow: 'hidden',
  },
  // Inner top highlight · 1px cream alpha sutil sobre o top do card ·
  // canon "papel cream sob marca d'água gravada" Don Corleone editorial.
  cardInnerHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(233, 238, 242, 0.06)',
  },
  // Processing veil · bottom border thin atlas gold opacity pulse · canon
  // "Atlas pensando" via marca d'água viva. Inset bottom = signal sutil.
  processingVeil: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 1.5,
    opacity: 0.55,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    // position relative · overlay absolute calcula a partir daqui
    position: 'relative',
    minHeight: 32,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 32,
    maxHeight: 160,
  },
  // Slice 6al · placeholder overlay Frau italic 20px · posicionado absoluto
  // sobre TextInput (que mantém Inter sans 16px constante). Top alinhado ao
  // baseline do TextInput · pointerEvents none não bloqueia tap.
  placeholderOverlay: {
    position: 'absolute',
    top: -2, // micro-ajuste pra alinhar baseline com TextInput Inter 16px
    left: 0,
    right: 0,
  },
  // cursorSignature/cursorGlyph removidos (Slice 6ak) · ver comentário inline
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 10,
  },
  actionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Slice 6q · overlap container · mic + send no mesmo slot, position
  // absolute, transição cross-fade premium.
  actionRightOverlap: {
    position: 'relative',
    width: 36,
    height: 36,
  },
  overlapSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 36,
    height: 36,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconBtnBadge: {
    position: 'absolute',
    top: 0, right: 0,
    minWidth: 16, height: 16,
    borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  iconBtnBadgeText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    fontWeight: '700',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    minHeight: 28,
    maxWidth: 118,
  },
  pillDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
  },
})
