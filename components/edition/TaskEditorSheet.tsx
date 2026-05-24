/**
 * TaskEditorSheet · sheet manuscript canon Atlas.
 *
 * Substitui o task editor inline antigo (TextInput plain + botão prussian
 * chapado) por uma superfície embossed editorial:
 *
 *   BlurView iOS systemChromeMaterialDark (intensity 56)
 *   + slate tint overlay ${surface}D9
 *   + inner top highlight 1px alpha cream 0.06
 *   + bottom inner shade 1px alpha black 0.18
 *   + shadow 0/2/10 alpha 0.18
 *   = Don Corleone signet ring on cream paper, premium frosted glass.
 *
 * Cada campo é uma FieldLine (label tiny mono caps + value Inter sans 16 +
 * cursor bronze + hairline divisor) — não <TextInput> bordado individual.
 *
 * Choices (priority/energy) viraram ChoicePill com gold dot animado.
 *
 * Botões "Salvar tarefa" / "Salvar Calendário" sumiram — viraram gestos:
 *   "registrar."         · italic Frau bronzeDeep + hairline prussian
 *   "selar no calendário." · italic Frau bronzeDeep + hairline bronze
 *
 * Entry animation FadeInDown 380ms ease.ceremonial · papel pousando.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Platform, StyleSheet, TextInput, View } from 'react-native'
import { BlurView } from 'expo-blur'
import Animated, {
  Easing,
  Keyframe,
  LinearTransition,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { Frau, Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { fonts } from '../../design/tokens'
import { ChoicePill } from './Pills'
import { SignatureGesture } from './SignatureGesture'
import { PressableTextScale } from '../atlas-ui/PressableScale'
import type { AtlasTaskEvent } from '../../lib/api/client'

export type TaskEditorPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskEditorEnergy = 'low' | 'medium' | 'high'

export interface TaskEditorDraft {
  title: string
  priority: TaskEditorPriority
  estimatedMinutes: string
  energyRequired: TaskEditorEnergy
  dueDate: string
  plannedDate: string
  startTime: string
}

interface Props {
  draft: TaskEditorDraft
  onDraftChange: (next: TaskEditorDraft) => void
  onClose: () => void
  onCommit: () => void
  onSealCalendar: () => void
  /** Se truthy, exibe "Marcando…" no calendar gesture. */
  calendarBusy?: boolean
  /** Lista opcional de eventos passados da tarefa · mono caps tiny. */
  events?: AtlasTaskEvent[]
  /** Default label da última gesture (depende se já está marcada no calendário). */
  calendarLabel?: string
}

const PRIORITY_CHOICES: Array<{ key: TaskEditorPriority; label: string }> = [
  { key: 'urgent', label: 'urgente' },
  { key: 'high', label: 'alta' },
  { key: 'normal', label: 'normal' },
  { key: 'low', label: 'baixa' },
]

const ENERGY_CHOICES: Array<{ key: TaskEditorEnergy; label: string }> = [
  { key: 'low', label: 'baixa' },
  { key: 'medium', label: 'média' },
  { key: 'high', label: 'alta' },
]

export function TaskEditorSheet({
  draft,
  onDraftChange,
  onClose,
  onCommit,
  onSealCalendar,
  calendarBusy = false,
  events,
  calendarLabel = 'selar no calendário.',
}: Props) {
  const c = usePalette()
  const reducedMotion = useReducedMotion()

  // Card border focus animation · cream alpha → atlas gold quando algum
  // field está focused. Sincroniza com cursor bronze e placeholder fade.
  const [anyFocused, setAnyFocused] = useState(false)
  const focusedValue = useSharedValue(0)
  useEffect(() => {
    focusedValue.value = withTiming(anyFocused ? 1 : 0, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    })
  }, [anyFocused, focusedValue])
  const cardAnimStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusedValue.value,
      [0, 1],
      [c.border, c.bronzeBorder],
    ),
  }))

  // Subtle commit-ready breath · quando título não está vazio, o gesto
  // "registrar." pulsa muito sutilmente (opacity 0.92→1) sinalizando que
  // o ato pode ser selado. Cancelado em reducedMotion.
  const canCommit = draft.title.trim().length > 0
  const commitBreath = useSharedValue(1)
  useEffect(() => {
    if (canCommit && !reducedMotion) {
      commitBreath.value = withRepeat(
        withSequence(
          withTiming(0.92, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        false,
      )
    } else {
      cancelAnimation(commitBreath)
      commitBreath.value = withTiming(1, { duration: 220 })
    }
  }, [canCommit, commitBreath, reducedMotion])
  const commitBreathStyle = useAnimatedStyle(() => ({
    opacity: commitBreath.value,
  }))

  // Entry canon · folha manuscrita pousando. Scale 0.97→1.0 sincronizado
  // com fade-in down + opacity 0→1. Não usa spring (evita bounce) · ease
  // ceremonial bezier curve. Layout transition (LinearTransition 360ms ios)
  // permite reflow suave quando events list aparece.
  const sheetEntry = new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 18 }, { scale: 0.97 }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.bezier(0.16, 1, 0.3, 1) },
  }).duration(420)

  return (
    <Animated.View
      entering={sheetEntry}
      layout={LinearTransition.duration(360).easing(Easing.bezier(0.32, 0.72, 0, 1))}
      style={[
        styles.sheet,
        {
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : c.surface,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.18,
          shadowRadius: 10,
          elevation: 2,
        },
        cardAnimStyle,
      ]}
    >
      {/* BlurView native iOS · systemChromeMaterialDark canon */}
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={56}
          tint="systemChromeMaterialDark"
          experimentalBlurMethod="dimezisBlurView"
          style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]}
        />
      ) : null}
      {/* Slate tint sobre o blur · preserva paleta canon */}
      {Platform.OS === 'ios' ? (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: `${c.surface}D9`, borderRadius: 14 },
          ]}
        />
      ) : null}
      {/* Inner top highlight · canon embossed manuscript */}
      <View style={styles.innerHighlight} pointerEvents="none" />
      {/* Inner bottom shade · sela o carving */}
      <View style={styles.innerShade} pointerEvents="none" />

      {/* Header · mono caps tiny — "AJUSTAR TAREFA" / "FECHAR" */}
      <View style={[styles.header, { borderBottomColor: c.borderSoft }]}>
        <Mono size={9.5} letterSpacing={1.8} color={c.ink3} style={styles.uppercase}>
          ajustar tarefa
        </Mono>
        <PressableTextScale
          onPress={onClose}
          hitSlop={10}
          accessibilityLabel="fechar editor de tarefa"
        >
          <Mono size={10} letterSpacing={1.2} color={c.ink2} style={styles.uppercase}>
            fechar
          </Mono>
        </PressableTextScale>
      </View>

      {/* TÍTULO · field-line com cursor bronze + placeholder Frau italic overlay */}
      <FieldLine label="título" borderColor={c.borderSoft}>
        <ManuscriptInput
          value={draft.title}
          onChangeText={(title) => onDraftChange({ ...draft, title })}
          placeholder="o que precisa ser atravessado hoje"
          onFocusChange={setAnyFocused}
          accessibilityLabel="título da tarefa"
        />
      </FieldLine>

      {/* PRIORIDADE · choice pills com gold dot animado */}
      <FieldLine label="prioridade" borderColor={c.borderSoft}>
        <View style={styles.choiceRow}>
          {PRIORITY_CHOICES.map((choice) => (
            <ChoicePill
              key={choice.key}
              label={choice.label}
              active={draft.priority === choice.key}
              onPress={() => onDraftChange({ ...draft, priority: choice.key })}
              accessibilityLabel={`prioridade ${choice.label}`}
            />
          ))}
        </View>
      </FieldLine>

      {/* ENERGIA · choice pills */}
      <FieldLine label="energia" borderColor={c.borderSoft}>
        <View style={styles.choiceRow}>
          {ENERGY_CHOICES.map((choice) => (
            <ChoicePill
              key={choice.key}
              label={choice.label}
              active={draft.energyRequired === choice.key}
              onPress={() => onDraftChange({ ...draft, energyRequired: choice.key })}
              accessibilityLabel={`energia ${choice.label}`}
            />
          ))}
        </View>
      </FieldLine>

      {/* DURAÇÃO · PRAZO · row compact */}
      <FieldLine label="duração · prazo" borderColor={c.borderSoft}>
        <View style={styles.inlineRow}>
          <ManuscriptInput
            value={draft.estimatedMinutes}
            onChangeText={(estimatedMinutes) => onDraftChange({ ...draft, estimatedMinutes })}
            placeholder="25"
            mono
            suffix="min"
            width={84}
            keyboardType="number-pad"
            onFocusChange={setAnyFocused}
            accessibilityLabel="duração estimada em minutos"
          />
          <View style={styles.inlineDivider} />
          <ManuscriptInput
            value={draft.dueDate}
            onChangeText={(dueDate) => onDraftChange({ ...draft, dueDate })}
            placeholder="aaaa-mm-dd"
            mono
            flex
            onFocusChange={setAnyFocused}
            accessibilityLabel="data de prazo"
          />
        </View>
      </FieldLine>

      {/* PLANEJADO PARA · HORA */}
      <FieldLine label="planejado para · hora" borderColor={c.borderSoft}>
        <View style={styles.inlineRow}>
          <ManuscriptInput
            value={draft.plannedDate}
            onChangeText={(plannedDate) => onDraftChange({ ...draft, plannedDate })}
            placeholder="aaaa-mm-dd"
            mono
            flex
            onFocusChange={setAnyFocused}
            accessibilityLabel="dia planejado"
          />
          <View style={styles.inlineDivider} />
          <ManuscriptInput
            value={draft.startTime}
            onChangeText={(startTime) => onDraftChange({ ...draft, startTime })}
            placeholder="hh:mm"
            mono
            width={84}
            onFocusChange={setAnyFocused}
            accessibilityLabel="hora de início"
          />
        </View>
      </FieldLine>

      {/* Eventos recentes · mono caps tiny, marginalia editorial */}
      {events && events.length > 0 ? (
        <View style={[styles.events, { borderTopColor: c.borderSoft }]}>
          {events.slice(0, 3).map((event) => (
            <Mono
              key={event.id}
              size={10}
              lineHeight={14}
              letterSpacing={0.4}
              color={c.ink3}
            >
              · {eventLabel(event.event_type)} · {formatEventTime(event.occurred_at)}
            </Mono>
          ))}
        </View>
      ) : null}

      {/* Gesture footer · registrar (commit prussian) + selar no calendário (external bronze) */}
      <View style={[styles.gestureFooter, { borderTopColor: c.borderSoft }]}>
        <Animated.View style={canCommit ? commitBreathStyle : undefined}>
          <SignatureGesture
            label="registrar."
            onPress={onCommit}
            disabled={!canCommit}
            seal="commit"
            haptic="light"
            accessibilityLabel="registrar tarefa"
            accessibilityHint="grava as alterações no Atlas"
          />
        </Animated.View>
        <SignatureGesture
          label={calendarBusy ? 'marcando…' : calendarLabel}
          onPress={onSealCalendar}
          disabled={calendarBusy}
          seal="external"
          haptic="light"
          accessibilityLabel="selar tarefa no calendário Apple"
          accessibilityHint="cria evento de calendário com início, fim e notas"
        />
      </View>
    </Animated.View>
  )
}

/* ───────────────────────────────────────────────────────────────────
 * FieldLine · label tiny mono caps acima + value abaixo + hairline divisor.
 *
 * Vocabulário de TOC editorial · cada campo é uma linha de papel, não
 * um input bordado SaaS. Hairline embaixo separa do próximo campo.
 * ─────────────────────────────────────────────────────────────────── */
function FieldLine({
  label,
  borderColor,
  children,
  noBorder,
}: {
  label: string
  borderColor: string
  children: ReactNode
  noBorder?: boolean
}) {
  const c = usePalette()
  return (
    <View
      style={[
        styles.fieldLine,
        !noBorder && { borderBottomColor: borderColor, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Sans
        weight="med"
        size={9}
        lineHeight={12}
        letterSpacing={1.4}
        color={c.ink3}
        style={styles.uppercase}
      >
        {label}
      </Sans>
      <View style={styles.fieldLineBody}>{children}</View>
    </View>
  )
}

/* ───────────────────────────────────────────────────────────────────
 * ManuscriptInput · TextInput canon Atlas.
 *
 *   – cursor + selection bronze (selectionColor + cursorColor)
 *   – Inter sans 16/22 ou JetBrainsMono 14 (variant mono)
 *   – placeholder Frau italic 16 ink3 opacity 0.6 (overlay absoluto · fade)
 *   – sem border individual · borda só no sheet container
 *   – padding compact
 * ─────────────────────────────────────────────────────────────────── */
function ManuscriptInput({
  value,
  onChangeText,
  placeholder,
  mono,
  suffix,
  width,
  flex,
  keyboardType,
  onFocusChange,
  accessibilityLabel,
}: {
  value: string
  onChangeText: (next: string) => void
  placeholder?: string
  mono?: boolean
  suffix?: string
  width?: number
  flex?: boolean
  keyboardType?: 'default' | 'number-pad'
  onFocusChange?: (focused: boolean) => void
  accessibilityLabel?: string
}) {
  const c = usePalette()
  const hasText = value.trim().length > 0
  const placeholderOpacity = useSharedValue(hasText ? 0 : 1)
  useEffect(() => {
    placeholderOpacity.value = withTiming(hasText ? 0 : 1, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    })
  }, [hasText, placeholderOpacity])
  const placeholderStyle = useAnimatedStyle(() => ({
    opacity: placeholderOpacity.value,
  }))

  const inputStyle = mono
    ? { fontFamily: fonts.mono, fontSize: 14, lineHeight: 20, letterSpacing: 0.4 }
    : { fontFamily: fonts.sans, fontSize: 16, lineHeight: 22 }

  return (
    <View style={[styles.inputWrap, flex && { flex: 1 }, width != null && { width }]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder=""
        placeholderTextColor="transparent"
        selectionColor={c.bronze}
        cursorColor={c.bronze}
        keyboardType={keyboardType}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        accessibilityLabel={accessibilityLabel}
        style={[styles.input, inputStyle, { color: c.ink }]}
      />
      {suffix && hasText ? (
        <Mono size={13} lineHeight={18} color={c.ink2} style={styles.suffix}>
          {suffix}
        </Mono>
      ) : null}
      {/* Placeholder overlay Frau italic · fade smooth */}
      <Animated.View pointerEvents="none" style={[styles.placeholderOverlay, placeholderStyle]}>
        <Frau italic size={mono ? 14 : 16} lineHeight={mono ? 20 : 22} color={c.ink3}>
          {placeholder}
        </Frau>
      </Animated.View>
    </View>
  )
}

function eventLabel(eventType: string): string {
  switch (eventType) {
    case 'created_from_capture': return 'criada da captura'
    case 'updated_from_capture': return 'atualizada pela captura'
    case 'generated_from_routine': return 'gerada pela rotina'
    case 'refreshed_from_routine': return 'atualizada pela rotina'
    case 'updated': return 'editada'
    case 'scheduled': return 'agendada'
    case 'deferred': return 'adiada'
    case 'completed': return 'concluída'
    default: return eventType
  }
}

function formatEventTime(value?: string | null): string {
  if (!value) return '--:--'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '--:--'
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const styles = StyleSheet.create({
  // Sheet · radius 14 (folded letter · meio termo entre composer 22 e papel 4)
  sheet: {
    position: 'relative',
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    overflow: 'hidden',
    gap: 4,
  },
  innerHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(233, 238, 242, 0.06)',
  },
  innerShade: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  uppercase: {
    textTransform: 'uppercase',
  },
  fieldLine: {
    paddingVertical: 10,
    gap: 6,
  },
  fieldLineBody: {
    minHeight: 26,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineDivider: {
    width: StyleSheet.hairlineWidth,
    height: 18,
    backgroundColor: 'rgba(233, 238, 242, 0.10)',
  },
  inputWrap: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 22,
  },
  suffix: {
    marginLeft: 6,
  },
  placeholderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  events: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 3,
  },
  gestureFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
})
