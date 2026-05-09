import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { usePalette } from '../../design/theme'
import { fonts } from '../../design/tokens'
import { BronzeDiamond } from './BronzeDiamond'

interface Props {
  value: string
  onChangeText: (next: string) => void
  onSubmit: () => void
  placeholder?: string
  disabled?: boolean
  multiline?: boolean
  onAttachmentPress?: () => void
  attachmentCount?: number
  canSubmit?: boolean
  onFocus?: () => void
  /**
   * v18 enterprise · Long-press no ✦ send · canon Atlas · ativa Modo Gravar
   * (captura silenciosa pro inbox · lock automático imediato). Tap normal
   * (sem long-press) = envia texto. Long-press respeita `disabled` e `recording`.
   */
  onLongPressSend?: () => void
  /**
   * v18 · Callback opcional disparado ao soltar o dedo do ✦ send (em conjunto
   * com a anim onPressOut interna). Não usado em enterprise tap-lock, mas
   * preservado pra back-compat.
   */
  onSendPressOut?: () => void
  /**
   * v18 enterprise · Quando true, gravação está ativa · ✦ send fica visível
   * mas tap normal NÃO dispara onSubmit (só serve como visual indicator).
   * Long-press também é bloqueado (não inicia outra gravação · race fix).
   */
  recording?: boolean
}

// Console input. No rectangular box. A single hairline underline at rest;
// the diamond send affordance fades in only when there is text to send.
// The whole field becomes the editorial terrain — paper, calm cursor,
// generous tap area.
export function FieldInline({
  value,
  onChangeText,
  onSubmit,
  placeholder = 'continuar…',
  disabled = false,
  multiline = true,
  onAttachmentPress,
  attachmentCount = 0,
  canSubmit = false,
  onFocus,
  onLongPressSend,
  onSendPressOut,
  recording = false,
}: Props) {
  const c = usePalette()
  const hasText = value.trim().length > 0
  const ready = (hasText || canSubmit) && !disabled
  // v18 · ✦ sempre visível quando há onLongPressSend (Voice Mode handler).
  // Sem texto, ✦ continua presente como AFFORDANCE de captura de áudio
  // (long-press hold). Vibe canon: o ato editorial está sempre disponível,
  // só muda de "enviar texto" pra "falar com Atlas". Visual diferenciado por
  // opacity (1.0 quando ready/enviar, 0.55 quando idle/só-mic).
  const visible = ready || onLongPressSend != null

  const sendOpacity = useSharedValue(0)
  const sendScale = useSharedValue(0.7)
  const sendBreath = useSharedValue(1)
  const pressScale = useSharedValue(1)

  // Entrance / exit: scale-and-fade with spring on entrance, crisp timing on exit.
  // v18 · 3 estados de opacity:
  //   ready (texto pronto pra enviar) → 1.0 (presença plena, enviar é o ato)
  //   visible mas not ready (só long-press disponível) → 0.55 (sussurro affordance)
  //   not visible (sem handlers, sem texto) → 0 (some)
  useEffect(() => {
    if (ready) {
      sendOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })
      sendScale.value = withSpring(1, { damping: 14, stiffness: 180, mass: 0.7 })
    } else if (visible) {
      sendOpacity.value = withTiming(0.55, { duration: 220, easing: Easing.out(Easing.cubic) })
      sendScale.value = withSpring(1, { damping: 14, stiffness: 180, mass: 0.7 })
    } else {
      sendOpacity.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) })
      sendScale.value = withTiming(0.7, { duration: 180, easing: Easing.in(Easing.cubic) })
    }
  }, [ready, visible, sendOpacity, sendScale])

  // Idle breathing while ready: 1 ↔ 1.045 over 2.2s — barely there, gives life.
  useEffect(() => {
    if (ready) {
      sendBreath.value = withRepeat(
        withSequence(
          withTiming(1.045, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      )
    } else {
      cancelAnimation(sendBreath)
      sendBreath.value = withTiming(1, { duration: 180 })
    }
  }, [ready, sendBreath])

  const sendStyle = useAnimatedStyle(() => ({
    opacity: sendOpacity.value,
    transform: [{ scale: sendScale.value * sendBreath.value * pressScale.value }],
  }))

  const onPressIn = () => {
    pressScale.value = withTiming(0.88, { duration: 120, easing: Easing.out(Easing.quad) })
  }
  const onPressOut = () => {
    pressScale.value = withSpring(1, { damping: 12, stiffness: 220, mass: 0.6 })
  }

  return (
    // v18 · borderTopColor com bronze@10% (era c.border cinza neutro) ·
    // canon ultra-premium: a hairline acima do composer é sutil whisper
    // bronze, não régua cinza separadora. Vocabulário "papel cream com
    // marca d'água", não "form divider SaaS". `0F` em hex = ~6% opacity.
    <View style={[styles.wrap, { borderTopColor: `${c.bronze}26` }]}>
      {onAttachmentPress ? (
        <Pressable
          onPress={onAttachmentPress}
          disabled={disabled}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={attachmentCount > 0 ? `${attachmentCount} anexos` : 'adicionar anexo'}
          style={({ pressed }) => [
            styles.attachHit,
            {
              borderColor: c.border,
              opacity: disabled ? 0.35 : pressed ? 0.55 : 1,
            },
          ]}
        >
          <Text style={[styles.attachGlyph, { color: c.ink }]}>+</Text>
          {attachmentCount > 0 ? (
            <View style={[styles.attachBadge, { backgroundColor: c.ink }]}>
              <Text style={[styles.attachBadgeText, { color: c.bg }]}>{attachmentCount}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.ink3}
        multiline={multiline}
        editable={!disabled}
        onFocus={onFocus}
        textAlignVertical="top"
        style={[styles.input, { color: c.ink }]}
        returnKeyType="default"
        keyboardType="default"
        inputMode="text"
        secureTextEntry={false}
        submitBehavior={multiline ? 'newline' : 'blurAndSubmit'}
        autoCorrect
        spellCheck
        autoCapitalize="sentences"
        textContentType="none"
        autoComplete="off"
        importantForAutofill="no"
      />
      <Animated.View style={[styles.send, sendStyle]} pointerEvents={ready || onLongPressSend ? 'auto' : 'none'}>
        <Pressable
          // v18 enterprise · tap normal bloqueado quando recording (já está
          // gravando, evita duplicar onSubmit/recordings). Disabled também
          // durante prop disabled (interactionLocked do parent).
          onPress={recording || disabled ? undefined : onSubmit}
          // Long-press só dispara se onLongPressSend existe E não está em
          // recording (já gravando) E não está disabled (interactionLocked).
          onLongPress={recording || disabled ? undefined : onLongPressSend}
          delayLongPress={420}
          onPressIn={onPressIn}
          onPressOut={() => {
            onPressOut()
            // v18 enterprise · onSendPressOut preservado pra back-compat,
            // mas Modo Gravar atual NÃO usa (lock automático imediato).
            onSendPressOut?.()
          }}
          // Disabled também respeita recording (visual: tap inerte mesmo se
          // visualmente presente). Long-press = primeiro inicio possível.
          disabled={recording || disabled || (!ready && !onLongPressSend)}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel={
            recording
              ? 'gravando · use os botões da tira pra cancelar/pausar/enviar'
              : onLongPressSend
                ? 'enviar · pressione e segure para gravar'
                : 'enviar'
          }
          style={styles.sendHit}
        >
          {/* v18 · Polish "signet ring" · text-shadow bronze @ 30% dá ao
              ✦ send a vibe de "selo gravado em papel cream" (Don Corleone
              signet ring carimbando documento). Vocabulário canon Atlas
              premium · profundidade sutil sem virar drop-shadow SaaS.
              offset {0, 1} · luz vinda de cima (canon iOS) · radius 3 · soft. */}
          <BronzeDiamond
            size={32}
            style={{
              textShadowColor: `${c.bronze}4D`,
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 3,
            }}
          />
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 18,
    paddingBottom: 4,
    paddingHorizontal: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 56,
    gap: 16,
  },
  input: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 32,
    maxHeight: 140,
  },
  attachHit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  attachGlyph: {
    fontFamily: fonts.sans,
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '300',
  },
  attachBadge: {
    position: 'absolute',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    right: -5,
    top: -5,
    paddingHorizontal: 4,
  },
  attachBadgeText: {
    fontFamily: fonts.sans,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
  send: {
    paddingBottom: 2,
  },
  sendHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
