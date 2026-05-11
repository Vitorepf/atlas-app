// Inbox · Operacional · canon mapper.
//
// Cada AtlasOperationalInboxItem é mapeado pra um OpCardSpec que carrega
// vocabulário canon do mockup: card class (border-top color), meta-cat
// (cor + label PT-BR), action-primary (Frau med 16 prussian), action-secondary
// (Frau italic 13 ink2 + destructive flag).
//
// Mapeamento canônico das 7 categorias do mockup (atlas-home-editorial-mockup.html
// viewport "Inbox · Operacional populado"):
//
//   alert (critical)        · border-top recRed   · meta-cat recRed     · "Ver trace"
//   approval (warning)      · border-top bronze   · meta-cat bronze     · "Aprovar"
//   job_result (warning)    · border-top bronze   · meta-cat ink2       · "Ver trace"
//   self_diagnostic (warn)  · border-top bronze   · meta-cat moss       · "Discutir com Atlas"
//   proposal (default)      · default             · meta-cat bronze     · "Revisar proposta"
//   atlas_ai_recommendation · default             · meta-cat prussian   · "Marcar aplicada"
//   insight (default)       · default             · meta-cat prussian   · "Discutir com Atlas"
//
// Schema: action.id é mapeado de `available_actions[]` do server. Quando o
// id não bater, fallback é `respond` genérico.

import type { AtlasOperationalInboxItem, AtlasInboxAction } from './api/client'

export type OpCardClass = 'critical' | 'warning' | 'default'
export type OpMetaCatColor = 'rec-red' | 'bronze' | 'prussian' | 'moss' | 'ink2'

export interface OpActionSpec {
  /** ID do action handler (do server `available_actions[]`). */
  id: string
  /** Label PT-BR exibido no botão. */
  label: string
  /** Quando true, renderiza em rec-red weight 500 (ações destrutivas). */
  destructive?: boolean
  /** Carrega o action original do server pra preservar `requires_confirm`/`policy`. */
  source?: AtlasInboxAction
}

export interface OpCardSpec {
  /** Border-top color do card. */
  cardClass: OpCardClass
  /** Cor da meta-cat label (no meta-row). */
  metaCatColor: OpMetaCatColor
  /** Label PT-BR (uppercase aplicado no render). */
  metaCatLabel: string
  /** Origem (sub-source) — "atlas", "harness", "self-diagnostic", "jitai", etc. */
  metaOrigin: string
  /** Mostra critical-dot no fim do meta-row. */
  showCriticalDot: boolean
  /** Action principal (botão centered Frau med 16 prussian). null se sem ação. */
  primary: OpActionSpec | null
  /** Actions secundárias (inline italic, separadas por ·). */
  secondary: OpActionSpec[]
}

// ============================================================================
// MAP de tipos → spec canônico
// ============================================================================

function findAction(actions: AtlasInboxAction[], ...ids: string[]): AtlasInboxAction | null {
  for (const id of ids) {
    const found = actions.find((a) => a.id === id)
    if (found) return found
  }
  return null
}

function actionToSpec(action: AtlasInboxAction | null, fallback: { id: string; label: string }, destructive = false): OpActionSpec | null {
  if (!action) {
    // Quando server não tem o action, criar spec sintético usando fallback.
    return { id: fallback.id, label: fallback.label, destructive }
  }
  return {
    id: action.id,
    label: action.label,
    destructive: destructive || action.style === 'destructive',
    source: action,
  }
}

// Origin é livre · server às vezes preenche em metadata, às vezes em initiator.
// Pra cada tipo, usamos vocabulário canon do mockup.
function originForType(type: string, fallback: string): string {
  switch (type) {
    case 'alert':
      return 'sistema'
    case 'approval':
      return 'atlas'
    case 'job_result':
      return 'harness'
    case 'self_diagnostic':
      return 'self-diagnostic'
    case 'proposal':
      return 'atlas'
    case 'insight':
      return 'curator'
    default:
      return fallback
  }
}

export function buildOpCardSpec(item: AtlasOperationalInboxItem): OpCardSpec {
  const actions = item.available_actions ?? []
  const isCritical = item.severity === 'critical'
  const isWarning = item.severity === 'warning'
  const initiator = (item.initiator ?? '').toLowerCase()

  // ALERT (critical)
  if (item.type === 'alert') {
    return {
      cardClass: isCritical ? 'critical' : 'warning',
      metaCatColor: 'rec-red',
      metaCatLabel: 'alerta',
      metaOrigin: originForType('alert', initiator || 'sistema'),
      showCriticalDot: isCritical,
      primary: actionToSpec(findAction(actions, 'view_trace', 'discuss'), { id: 'view_trace', label: 'Ver trace' }),
      secondary: [
        actionToSpec(findAction(actions, 'discuss'), { id: 'discuss', label: 'discutir com Atlas' }),
        actionToSpec(findAction(actions, 'dismiss'), { id: 'dismiss', label: 'descartar' }),
      ].filter((a): a is OpActionSpec => a !== null),
    }
  }

  // APPROVAL (warning)
  if (item.type === 'approval') {
    return {
      cardClass: 'warning',
      metaCatColor: 'bronze',
      metaCatLabel: 'aprovação',
      metaOrigin: originForType('approval', initiator || 'atlas'),
      showCriticalDot: false,
      primary: actionToSpec(findAction(actions, 'approve_once', 'approve'), { id: 'approve_once', label: 'Aprovar' }),
      secondary: [
        actionToSpec(findAction(actions, 'approve_session'), { id: 'approve_session', label: 'sessão' }),
        actionToSpec(findAction(actions, 'approve_workspace_1h'), { id: 'approve_workspace_1h', label: 'workspace 1h' }),
        actionToSpec(findAction(actions, 'deny'), { id: 'deny', label: 'negar' }, /* destructive */ true),
      ].filter((a): a is OpActionSpec => a !== null),
    }
  }

  // JOB_RESULT (warning quando failed)
  if (item.type === 'job_result') {
    return {
      cardClass: isWarning || isCritical ? 'warning' : 'default',
      metaCatColor: 'ink2',
      metaCatLabel: 'job',
      metaOrigin: originForType('job_result', initiator || 'harness'),
      showCriticalDot: false,
      primary: actionToSpec(findAction(actions, 'view_trace'), { id: 'view_trace', label: 'Ver trace' }),
      secondary: [
        actionToSpec(findAction(actions, 'discuss'), { id: 'discuss', label: 'discutir com Atlas' }),
        actionToSpec(findAction(actions, 'dismiss'), { id: 'dismiss', label: 'descartar' }),
      ].filter((a): a is OpActionSpec => a !== null),
    }
  }

  // SELF_DIAGNOSTIC (warning)
  if (item.type === 'self_diagnostic') {
    return {
      cardClass: 'warning',
      metaCatColor: 'moss',
      metaCatLabel: 'auto-diagnóstico',
      metaOrigin: originForType('self_diagnostic', initiator || 'self-diagnostic'),
      showCriticalDot: false,
      primary: actionToSpec(findAction(actions, 'discuss'), { id: 'discuss', label: 'Discutir com Atlas' }),
      secondary: [
        actionToSpec(findAction(actions, 'create_proposal'), { id: 'create_proposal', label: 'criar proposta' }),
        actionToSpec(findAction(actions, 'ignore_30d', 'snooze'), { id: 'ignore_30d', label: 'ignorar 30 dias' }),
        actionToSpec(findAction(actions, 'dismiss'), { id: 'dismiss', label: 'descartar' }),
      ].filter((a): a is OpActionSpec => a !== null),
    }
  }

  // PROPOSAL (default)
  if (item.type === 'proposal') {
    return {
      cardClass: 'default',
      metaCatColor: 'bronze',
      metaCatLabel: 'proposta',
      metaOrigin: originForType('proposal', initiator || 'atlas'),
      showCriticalDot: false,
      primary: actionToSpec(findAction(actions, 'review_patch', 'review_proposal'), { id: 'review_patch', label: 'Revisar proposta' }),
      secondary: [
        actionToSpec(findAction(actions, 'discuss'), { id: 'discuss', label: 'discutir com Atlas' }),
        actionToSpec(findAction(actions, 'dismiss'), { id: 'dismiss', label: 'descartar' }, /* destructive */ true),
      ].filter((a): a is OpActionSpec => a !== null),
    }
  }

  // ATLAS_AI_RECOMMENDATION (jitai)
  if (item.type === 'atlas_ai_recommendation') {
    return {
      cardClass: 'default',
      metaCatColor: 'prussian',
      metaCatLabel: 'recomendação',
      metaOrigin: 'jitai',
      showCriticalDot: false,
      primary: actionToSpec(findAction(actions, 'apply_recommendation', 'mark_applied'), { id: 'apply_recommendation', label: 'Marcar aplicada' }),
      secondary: [
        actionToSpec(findAction(actions, 'acknowledge_recommendation', 'acknowledge'), { id: 'acknowledge_recommendation', label: 'reconhecer' }),
        actionToSpec(findAction(actions, 'reject_recommendation', 'reject'), { id: 'reject_recommendation', label: 'rejeitar' }, /* destructive */ true),
      ].filter((a): a is OpActionSpec => a !== null),
    }
  }

  // INSIGHT (default)
  if (item.type === 'insight') {
    return {
      cardClass: 'default',
      metaCatColor: 'prussian',
      metaCatLabel: 'insight',
      metaOrigin: originForType('insight', initiator || 'curator'),
      showCriticalDot: false,
      primary: actionToSpec(findAction(actions, 'discuss'), { id: 'discuss', label: 'Discutir com Atlas' }),
      secondary: [
        actionToSpec(findAction(actions, 'snooze'), { id: 'snooze', label: 'adiar' }),
        actionToSpec(findAction(actions, 'dismiss'), { id: 'dismiss', label: 'descartar' }),
      ].filter((a): a is OpActionSpec => a !== null),
    }
  }

  // Fallback genérico — completion / capture / thread_update / job_status
  return {
    cardClass: isCritical ? 'critical' : isWarning ? 'warning' : 'default',
    metaCatColor: 'ink2',
    metaCatLabel: humanizeType(item.type),
    metaOrigin: initiator || 'sistema',
    showCriticalDot: isCritical,
    primary: actions[0] ? actionToSpec(actions[0], { id: actions[0].id, label: actions[0].label }) : null,
    secondary: actions.slice(1, 4).map((a) =>
      actionToSpec(a, { id: a.id, label: a.label }, a.style === 'destructive')!,
    ),
  }
}

function humanizeType(type: string): string {
  const map: Record<string, string> = {
    completion: 'conclusão',
    capture: 'captura',
    thread_update: 'thread',
    job_status: 'job',
    job_result: 'job',
  }
  return map[type] ?? type.replace(/_/g, ' ')
}

// ============================================================================
// FILTER STRIP · canon mockup · 8 chips com counts
// ============================================================================
//
// "Tudo · Aprovações · Recomendações · Insights · Propostas · Jobs ·
//  Auto-diagnóstico · Alertas"

export type OpFilterKey =
  | 'all'
  | 'approval'
  | 'atlas_ai_recommendation'
  | 'insight'
  | 'proposal'
  | 'job_result'
  | 'self_diagnostic'
  | 'alert'

export interface OpFilterChip {
  key: OpFilterKey
  label: string
  count: number
}

export function buildFilterChips(items: AtlasOperationalInboxItem[]): OpFilterChip[] {
  const counts = new Map<OpFilterKey, number>()
  let total = 0
  for (const item of items) {
    total += 1
    const key = item.type as OpFilterKey
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [
    { key: 'all', label: 'Tudo', count: total },
    { key: 'approval', label: 'Aprovações', count: counts.get('approval') ?? 0 },
    { key: 'atlas_ai_recommendation', label: 'Recomendações', count: counts.get('atlas_ai_recommendation') ?? 0 },
    { key: 'insight', label: 'Insights', count: counts.get('insight') ?? 0 },
    { key: 'proposal', label: 'Propostas', count: counts.get('proposal') ?? 0 },
    { key: 'job_result', label: 'Jobs', count: counts.get('job_result') ?? 0 },
    { key: 'self_diagnostic', label: 'Auto-diagnóstico', count: counts.get('self_diagnostic') ?? 0 },
    { key: 'alert', label: 'Alertas', count: counts.get('alert') ?? 0 },
  ]
}

export function filterItemsByKey(items: AtlasOperationalInboxItem[], key: OpFilterKey): AtlasOperationalInboxItem[] {
  if (key === 'all') return items
  return items.filter((item) => item.type === key)
}

// ============================================================================
// META TIME formatting · "12.41" (HH.MM com ponto, canon)
// ============================================================================

export function formatMetaTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}.${mm}`
}
