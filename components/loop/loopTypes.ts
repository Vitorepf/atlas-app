// Atlas Loop · screen-side view types + honest mappers from the backend
// envelopes to the props the components render. These NEVER fabricate a field;
// when the read model omits something, the mapper yields a calm absence.

import type {
  AtlasLoopLiveResponse,
  AtlasLoopRiskLevel,
} from '../../lib/loop'

// A normalized, render-ready proposal built from one cockpit.review_queue item.
export interface DecisionProposal {
  /** Deterministic decision anchor (review item `id`). Required by the service. */
  findingHash: string
  title: string
  context: string
  risk: AtlasLoopRiskLevel
  kind: string
  rsi: boolean
  autonomy: boolean
  /** Carried only when the item is inbox-backed. */
  inboxItemId?: string
  workOrderId?: string
  evidencePackHash?: string
  /** Stable React key. */
  key: string
}

// The body posted to operator-decision (mirrors SubmitAtlasLoopDecisionInput,
// minus the area which the screen supplies).
export interface OperatorDecisionVerdict {
  decision: 'accept' | 'reject' | 'defer' | 'request_changes'
  findingHash: string
  inboxItemId?: string
  workOrderId?: string
  evidencePackHash?: string
  rationale?: string
  risk: AtlasLoopRiskLevel
}

const VALID_RISKS: AtlasLoopRiskLevel[] = ['low', 'medium', 'high', 'critical']

function coerceRisk(value: unknown): AtlasLoopRiskLevel {
  const s = String(value ?? '').toLowerCase()
  return (VALID_RISKS as string[]).includes(s) ? (s as AtlasLoopRiskLevel) : 'medium'
}

/**
 * Map cockpit.review_queue items (schema review_item.v1: { kind, id, title,
 * status, risk_level, target_area, decision_anchor, blockers?,
 * recommended_operator_action, ... }) to render-ready proposals. Items WITHOUT
 * a usable anchor `id` are dropped (the service requires a finding_hash — we
 * never invent one). Context is assembled honestly from what the item carries.
 */
export function mapReviewQueue(live: AtlasLoopLiveResponse | null): DecisionProposal[] {
  const queue = (live?.cockpit?.review_queue ?? []) as Array<Record<string, unknown>>
  if (!Array.isArray(queue)) return []

  const out: DecisionProposal[] = []
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i]
    if (item == null || typeof item !== 'object') continue

    const anchor = String(item['id'] ?? '').trim()
    if (anchor === '') continue // no deterministic anchor -> cannot decide honestly

    const kind = String(item['kind'] ?? 'review').trim()
    const title = String(item['title'] ?? 'Revisar item').trim()
    const context = buildContext(item)
    const risk = coerceRisk(item['risk_level'])

    // Inbox-backed kinds carry the anchor as the inbox item id too.
    const inboxBacked = /inbox|recommendation|directive|outcome_history/i.test(kind)

    out.push({
      findingHash: anchor,
      title,
      context,
      risk,
      kind: humanKind(kind),
      rsi: /rsi|self[_-]?improvement|recursive/i.test(kind),
      autonomy: /autonomy|earned[_-]?autonomy|autonomous/i.test(kind),
      inboxItemId: inboxBacked ? anchor : undefined,
      key: `${kind}:${anchor || i}`,
    })
  }
  return out
}

function buildContext(item: Record<string, unknown>): string {
  const parts: string[] = []
  const targetArea = String(item['target_area'] ?? '').trim()
  if (targetArea !== '') parts.push(`área: ${targetArea}`)
  const rec = String(item['recommended_operator_action'] ?? '').trim()
  if (rec !== '') parts.push(rec.replace(/_/g, ' '))
  const blockers = Array.isArray(item['blockers'])
    ? (item['blockers'] as unknown[]).map((b) => String(b)).filter((b) => b.trim() !== '')
    : []
  if (blockers.length > 0) parts.push(`bloqueios: ${blockers.join('; ')}`)
  return parts.join(' · ')
}

function humanKind(kind: string): string {
  return kind.replace(/_/g, ' ')
}

// Map a 422 decision error reason to an honest inline message ON THE CARD.
export function decisionErrorMessage(reason: string): string {
  switch (reason) {
    case 'operator_actor_required':
      return 'Falta o operador dono da decisão.'
    case 'invalid_decision':
      return 'Decisão inválida.'
    case 'item_without_hash':
      return 'Este item não tem âncora determinística para decidir.'
    case 'rationale_required_for_high_risk_accept':
      return 'Aceitar risco alto exige uma justificativa explícita.'
    default:
      return reason || 'Não foi possível registrar a decisão.'
  }
}

// Map a directive 422 reason to an honest inline message.
export function directiveErrorMessage(reason: string): string {
  switch (reason) {
    case 'directive_required':
      return 'Escreva a diretiva antes de enviar.'
    case 'operator_actor_required':
      return 'Falta o operador dono da diretiva.'
    default:
      return reason || 'Não foi possível registrar a diretiva.'
  }
}
