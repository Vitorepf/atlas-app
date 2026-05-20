import { Pressable, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Frau, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import type {
  AtlasAiQualityAction,
  AtlasAiQualityEvaluation,
  AtlasAiTrace,
} from '../../../lib/api/client'
import { CaptionWhisper } from '../../console/CaptionWhisper'
import { providerWord } from './threadHistoryModel'

const OPEN_ACTION_STATUSES = new Set(['queued', 'running', 'blocked', 'failed'])

export type FeedbackAction = 'useful' | 'wrong_context' | 'too_long' | 'weak'

export function mergeQualityAction(
  action: AtlasAiQualityAction,
  actions: AtlasAiQualityAction[],
): AtlasAiQualityAction[] {
  return [action, ...actions.filter((item) => item.id !== action.id)].slice(0, 30)
}

export function QualityBar({
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
            <QualityActionButton
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

export function FeedbackRow({
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

export function FeedbackButton({
  label,
  active,
  onPress,
}: {
  label: string
  active?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  // Slice 6w · haptic Soft no press · canon premium iOS tactile
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    onPress()
  }
  // Slice 6w · scale press canon iOS
  const pressScale = useSharedValue(1)
  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))
  return (
    <Animated.View style={pressAnimStyle}>
      <Pressable
        onPress={handlePress}
        hitSlop={8}
        onPressIn={() => {
          pressScale.value = withTiming(0.96, { duration: 120, easing: Easing.out(Easing.quad) })
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { damping: 14, stiffness: 240, mass: 0.7 })
        }}
        style={({ pressed }) => [
          styles.feedbackButton,
          {
            borderColor: active ? c.moss : c.border,
            backgroundColor: pressed ? c.bgRaised : 'transparent',
            opacity: 1,
          },
        ]}
      >
        <Frau italic size={13} lineHeight={18} color={active ? c.moss : c.ink2}>
          {label}
        </Frau>
      </Pressable>
    </Animated.View>
  )
}

export function bestRemediationAction(trace: AtlasAiTrace): AtlasAiQualityAction | null {
  return (trace.quality_actions ?? []).find((action) => {
    if (action.status !== 'succeeded') return false
    if (!action.remediation_trace) return false
    return pickRawResponseText(action.remediation_trace).trim().length > 0
  }) ?? null
}

export function feedbackPayload(action: FeedbackAction) {
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

export function feedbackToast(action: FeedbackAction): string {
  if (action === 'useful') return 'Feedback registrado'
  if (action === 'wrong_context') return 'Atlas vai corrigir continuidade'
  if (action === 'too_long') return 'Atlas vai preferir respostas mais curtas'
  return 'Atlas vai tratar como resposta fraca'
}

function QualityActionButton({
  label,
  disabled,
  onPress,
}: {
  label: string
  disabled?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  // Slice 6aa · haptic + scale press canon premium
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    onPress()
  }
  const pressScale = useSharedValue(1)
  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))
  return (
    <Animated.View style={pressAnimStyle}>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        hitSlop={8}
        onPressIn={() => {
          pressScale.value = withTiming(0.96, { duration: 120, easing: Easing.out(Easing.quad) })
        }}
        onPressOut={() => {
          pressScale.value = withSpring(1, { damping: 14, stiffness: 240, mass: 0.7 })
        }}
        style={({ pressed }) => [
          styles.qualityAction,
          {
            borderColor: c.border,
            backgroundColor: pressed ? c.bgRaised : 'transparent',
            opacity: disabled ? 0.35 : 1,
          },
        ]}
      >
        <Frau italic size={12} lineHeight={16} color={c.ink2}>
          {label}
        </Frau>
      </Pressable>
    </Animated.View>
  )
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

function canRunQualityAction(action: AtlasAiQualityAction): boolean {
  return action.status === 'queued' || action.status === 'failed'
}

const styles = StyleSheet.create({
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
  qualityAction: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
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
})
