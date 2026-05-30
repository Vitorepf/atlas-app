import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { radii } from '../../design/tokens'
import { PressableTextScale } from '../atlas-ui/PressableScale'
import { StatusDot } from './StatusDot'
import { RiskTag } from './RiskTag'
import { RationaleField } from './RationaleField'
import { SealedDecisionRow } from './SealedDecisionRow'
import { riskTone } from './loopTone'
import { decisionErrorMessage, type DecisionProposal, type OperatorDecisionVerdict } from './loopTypes'
import type { AtlasLoopOperatorDecisionReceipt } from '../../lib/loop'
import { AtlasApiError } from '../../lib/api/client'

type Decision = OperatorDecisionVerdict['decision']

interface Props {
  proposal: DecisionProposal
  /** Decide → POST operator-decision; resolves to the verbatim receipt. */
  onDecide: (input: OperatorDecisionVerdict) => Promise<AtlasLoopOperatorDecisionReceipt>
  /** Open the sealed receipt detail. */
  onViewReceipt: (receipt: AtlasLoopOperatorDecisionReceipt) => void
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'confirm'; decision: Decision } // low/medium accept, or reject/defer/request_changes
  | { kind: 'rationale'; decision: 'accept' } // high/critical accept gate

// Section iii raised proposal · the ONLY component with c.surface fill +
// radii.card. No action fires on first tap. High/critical accept is gated on a
// visible rationale + a deliberate confirm. Aprovar NEVER executes (the receipt
// is executed:false, requires_owner_execution:true) — said plainly on the card.
export function DecisionCard({ proposal, onDecide, onViewReceipt }: Props) {
  const c = usePalette()
  const [expandedContext, setExpandedContext] = useState(false)
  const [mode, setMode] = useState<Mode>({ kind: 'idle' })
  const [rationale, setRationale] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resolved, setResolved] = useState<AtlasLoopOperatorDecisionReceipt | null>(null)

  const highRisk = proposal.risk === 'high' || proposal.risk === 'critical'

  // --- SEALED state: settle to a one-line receipt row (audit stays visible) --
  if (resolved !== null) {
    return (
      <Animated.View
        entering={FadeIn.duration(280)}
        style={[styles.card, styles.sealed, { backgroundColor: c.surface, borderColor: c.border }]}
      >
        <SealedDecisionRow
          decision={resolved.decision}
          decisionId={resolved.decision_id}
          routedTo={resolved.routes_to_owner?.owner ?? '—'}
          onViewReceipt={() => onViewReceipt(resolved)}
        />
        {resolved.decision === 'accept' ? (
          <Frau italic size={12} lineHeight={17} color={c.ink2} style={styles.sealedNote}>
            Aceito não executa. Encaminhado ao owner sob sua revisão.
          </Frau>
        ) : null}
      </Animated.View>
    )
  }

  const beginDecision = (decision: Decision) => {
    setError(null)
    if (decision === 'accept' && highRisk) {
      setMode({ kind: 'rationale', decision: 'accept' })
    } else {
      setMode({ kind: 'confirm', decision })
    }
  }

  const cancel = () => {
    setMode({ kind: 'idle' })
    setError(null)
  }

  const confirm = async (decision: Decision) => {
    if (submitting) return
    const trimmed = rationale.trim()
    // Client-side mirror of the backend gate (server is still the authority).
    if (decision === 'accept' && highRisk && trimmed === '') {
      setError(decisionErrorMessage('rationale_required_for_high_risk_accept'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const receipt = await onDecide({
        decision,
        findingHash: proposal.findingHash,
        inboxItemId: proposal.inboxItemId,
        workOrderId: proposal.workOrderId,
        evidencePackHash: proposal.evidencePackHash,
        rationale: trimmed !== '' ? trimmed : undefined,
        risk: proposal.risk,
      })
      setResolved(receipt)
    } catch (e) {
      setError(extractDecisionError(e))
      setSubmitting(false)
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {/* TOP ROW */}
      <View style={styles.topRow}>
        <View style={styles.topLeft}>
          <StatusDot tone={riskTone(proposal.risk, c)} />
          <RiskTag risk={proposal.risk} rsi={proposal.rsi} autonomy={proposal.autonomy} />
        </View>
        <Mono size={11} lineHeight={14} color={c.ink3} numberOfLines={1} style={styles.kind}>
          {proposal.kind}
        </Mono>
      </View>

      {/* TITLE */}
      <Frau weight="med" size={17} lineHeight={24} color={c.ink} numberOfLines={2} style={styles.title}>
        {proposal.title}
      </Frau>

      {/* CONTEXT */}
      {proposal.context !== '' ? (
        <View style={styles.contextWrap}>
          <Frau
            size={14}
            lineHeight={20}
            color={c.ink2}
            numberOfLines={expandedContext ? undefined : 3}
          >
            {proposal.context}
          </Frau>
          {!expandedContext && proposal.context.length > 120 ? (
            <PressableTextScale onPress={() => setExpandedContext(true)} haptic="soft" accessibilityLabel="ler mais">
              <Mono size={11} lineHeight={16} color={c.bronze} style={styles.readMore}>
                ler mais
              </Mono>
            </PressableTextScale>
          ) : null}
        </View>
      ) : null}

      {/* ACTION ROW (escalating order) */}
      <View style={[styles.actionRow, { borderTopColor: c.borderSoft }]}>
        <Action label="aprovar" color={c.moss} disabled={submitting} onPress={() => beginDecision('accept')} />
        <Action label="ajustes" color={c.prussian} disabled={submitting} onPress={() => beginDecision('request_changes')} />
        <Action label="adiar" color={c.amber} disabled={submitting} onPress={() => beginDecision('defer')} />
        <Action label="recusar" color={c.recRed} disabled={submitting} onPress={() => beginDecision('reject')} />
      </View>

      {/* HONESTY LINE (always) */}
      <Mono size={11} lineHeight={15} color={c.ink3} style={styles.honesty}>
        Aprovar NÃO executa. Roteia ao dono sob sua revisão.
      </Mono>

      {/* HIGH-RISK ACCEPT GATE — inline rationale + deliberate confirm */}
      {mode.kind === 'rationale' ? (
        <Animated.View entering={FadeIn.duration(280)}>
          <RationaleField
            value={rationale}
            onChangeText={setRationale}
            required
            label="JUSTIFICATIVA (OBRIGATÓRIA)"
            placeholder="Por que aceitar este risco?"
          />
          <View style={styles.confirmStrip}>
            <PressableTextScale onPress={cancel} haptic="soft" accessibilityLabel="cancelar">
              <Mono size={13} lineHeight={18} color={c.ink2}>
                cancelar
              </Mono>
            </PressableTextScale>
            <PressableTextScale
              onPress={() => void confirm('accept')}
              disabled={rationale.trim() === '' || submitting}
              haptic="medium"
              accessibilityLabel="confirmar aprovação"
            >
              <Mono size={13} lineHeight={18} weight="med" color={c.moss}>
                {submitting ? 'confirmando…' : 'confirmar aprovação'}
              </Mono>
            </PressableTextScale>
          </View>
        </Animated.View>
      ) : null}

      {/* LOW/MED ACCEPT + reject/defer/request_changes confirm strip */}
      {mode.kind === 'confirm' ? (
        <Animated.View entering={FadeIn.duration(280)}>
          {mode.decision === 'reject' || mode.decision === 'request_changes' ? (
            <RationaleField
              value={rationale}
              onChangeText={setRationale}
              label="MOTIVO (OPCIONAL)"
              placeholder={mode.decision === 'reject' ? 'Por que recusar?' : 'O que ajustar?'}
            />
          ) : null}
          <View style={styles.confirmStrip}>
            <PressableTextScale onPress={cancel} haptic="soft" accessibilityLabel="cancelar">
              <Mono size={13} lineHeight={18} color={c.ink2}>
                cancelar
              </Mono>
            </PressableTextScale>
            <PressableTextScale
              onPress={() => void confirm(mode.decision)}
              disabled={submitting}
              haptic="light"
              accessibilityLabel={`confirmar ${confirmWord(mode.decision)}`}
            >
              <Mono size={13} lineHeight={18} weight="med" color={confirmColor(mode.decision, c)}>
                {submitting ? 'confirmando…' : `confirmar ${confirmWord(mode.decision)}`}
              </Mono>
            </PressableTextScale>
          </View>
        </Animated.View>
      ) : null}

      {/* 422 inline message ON THE CARD (never a generic toast for a decision error) */}
      {error !== null ? (
        <Frau italic size={13} lineHeight={19} color={c.recRed} style={styles.error}>
          {error}
        </Frau>
      ) : null}
    </View>
  )
}

function Action({
  label,
  color,
  disabled,
  onPress,
}: {
  label: string
  color: string
  disabled: boolean
  onPress: () => void
}) {
  return (
    <PressableTextScale onPress={onPress} disabled={disabled} haptic="soft" accessibilityLabel={label}>
      <Mono size={13} lineHeight={18} weight="med" color={color}>
        {label}
      </Mono>
    </PressableTextScale>
  )
}

function confirmWord(decision: Decision): string {
  switch (decision) {
    case 'accept':
      return 'aprovação'
    case 'reject':
      return 'recusa'
    case 'defer':
      return 'adiamento'
    case 'request_changes':
      return 'ajustes'
  }
}

function confirmColor(decision: Decision, c: ReturnType<typeof usePalette>): string {
  switch (decision) {
    case 'accept':
      return c.moss
    case 'reject':
      return c.recRed
    case 'defer':
      return c.amber
    case 'request_changes':
      return c.prussian
  }
}

function extractDecisionError(e: unknown): string {
  if (e instanceof AtlasApiError) {
    const payload = e.payload as { reason?: string; detail?: string } | null
    if (payload?.reason) return decisionErrorMessage(payload.reason)
    if (payload?.detail) return payload.detail
  }
  return 'Não foi possível registrar a decisão.'
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 32,
    marginVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  sealed: {
    paddingVertical: 12,
  },
  sealedNote: {
    marginTop: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  topLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  kind: {
    flexShrink: 1,
    textAlign: 'right',
  },
  title: {
    marginTop: 10,
  },
  contextWrap: {
    marginTop: 6,
    gap: 4,
  },
  readMore: {
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexWrap: 'wrap',
  },
  honesty: {
    marginTop: 8,
  },
  confirmStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 20,
    marginTop: 12,
  },
  error: {
    marginTop: 10,
  },
})
