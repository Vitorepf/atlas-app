/**
 * Atlas AI · Mobile · Hyperflow runtime consumption.
 *
 * Porte fiel do contrato `atlas.ai.hyperflow_runtime.v1` que vem na resposta
 * de `POST /ai/interactions`.
 *
 * ## Anti-regressão (espelha hyperflowTraceConsumption.test.ts do desktop)
 *
 * O Mobile é SURFACE Plane do Hyperflow:
 *
 *   - Quando o backend retorna `trace.hyperflow` com `domain_id` ≠ 'programming'
 *     o front NUNCA renderiza como `programming.dev`.
 *   - Quando `domain_id === 'programming'` E `handoff_target` está presente,
 *     o front entende isso como hand-off Atlas Dev/Forge — é o ÚNICO caminho
 *     válido pra UI exibir programming, vindo da decisão real do backend
 *     (não inferência local).
 *   - Se `trace.hyperflow == null`, o front NÃO inventa decisão · cai em
 *     estado "aguardando router" e não fabrica `programming.dev`.
 *
 * ## Duas projeções do backend
 *
 *   1. **Flat shape** (`trace.hyperflow`) — projetado pelo `AiTraceResource`
 *      pra consumo direto da UI. É o canônico hoje.
 *   2. **Nested shape** (`trace.payload?.hyperflow_runtime` ou
 *      `trace.metadata?.hyperflow_runtime`) — raw do `AtlasHyperflowEntryService`
 *      com `router_decision`, `dispatch`, `decision_receipt` aninhados.
 *
 * `extractHyperflow(trace)` lê primeiro o flat (canon) e cai pro nested se
 * necessário. Retorna `null` quando nenhum está presente.
 */

export const HYPERFLOW_RUNTIME_SCHEMA = 'atlas.ai.hyperflow_runtime.v1' as const

/**
 * Flat shape canônico que o AiTraceResource projeta como `trace.hyperflow`.
 * Espelha `AtlasAiHyperflowTrace` do desktop.
 */
export interface AtlasAiHyperflowTrace {
  schema_version: typeof HYPERFLOW_RUNTIME_SCHEMA
  /** 13 intent types: conversation/research/programming/debug/review/explain/plan/finance/marketing/strategy/cyber/personal_development/automation */
  intent: string
  /** Domain inferido pelo DomainRouterService. */
  domain_id: string
  /** Flow ID escolhido pelo FlowRouterService (atlas_dev, atlas_research, etc.) */
  flow_id: string
  /** Modo de runtime: lightweight | standard | deep | forge | blocked */
  runtime_mode: 'lightweight' | 'standard' | 'deep' | 'forge' | 'blocked' | string
  /** 0..1 — confiança do classificador. */
  confidence: number
  /** Refs a policies aplicadas (ex: `policy.gate`). */
  policy_refs: string[]
  /** Refs a evidências consultadas/exigidas. */
  evidence_refs: string[]
  /** UUID do DecisionReceipt persistido em Postgres. */
  decision_receipt_id?: string
  /** SHA-256 64-chars hex · prova criptográfica auditável. */
  decision_receipt_hash?: string
  /** Status do RuntimeDispatch: planned | dispatched | simulated | blocked | completed */
  dispatch_status: 'planned' | 'dispatched' | 'simulated' | 'blocked' | 'completed' | string
  /** Alvo de handoff quando aplicável (ex: 'atlas_dev', 'atlas_forge'). */
  handoff_target: string | null
  /** Razão textual do handoff (ex: 'hyperflow_programming_flow_handoff'). */
  handoff_reason: string | null
  /** True quando operador forçou override sobre a decisão do router. */
  router_was_overridden?: boolean
  /** Razões textuais da decisão (ex: ['intent_type:marketing', 'primary_domain:marketing']). */
  reasons?: string[]
}

/**
 * Nested shape (raw) que o backend pode projetar no `payload.hyperflow_runtime`.
 * Fallback quando o flat não está presente.
 */
export interface HyperflowRuntimePayload {
  schema_version: string
  status?: 'ready' | 'blocked' | string
  intent?: {
    intent_type?: string
    confidence?: number
    ambiguity_score?: number
    signals?: Record<string, unknown>
  }
  primary_domain?: string
  flow_id?: string
  router_decision?: {
    receipt_hash?: string
    uuid?: string
    routing_mode?: string
    policy_required?: boolean
    evidence_required?: boolean
    tool_plan_required?: boolean
  }
  flow_route?: {
    flow_profile?: string
    expected_capabilities?: string[]
    required_gates?: string[]
    fallback_flows?: string[]
    runtime_mode?: string
  }
  dispatch?: {
    dispatch_target?: string
    dispatch_status?: string
    blockers?: string[]
    receipt_hash?: string
  }
  handoff_target?: {
    kind?: string
    flow_id?: string
  } | null
  decision_receipt?: {
    receipt_hash?: string
    receipt_type?: string
  }
}

/**
 * Extrai o flat shape canônico a partir de qualquer formato que o backend
 * retorne. Ordem: `trace.hyperflow` (canon) → `trace.metadata?.hyperflow_runtime`
 * (nested fallback).
 *
 * Retorna `null` quando nenhum está presente (NÃO inventa decisão).
 */
export function extractHyperflow(trace: unknown): AtlasAiHyperflowTrace | null {
  if (!trace || typeof trace !== 'object') return null
  const record = trace as Record<string, unknown>

  // Path 1 · flat shape canônico
  const flat = record.hyperflow
  if (isHyperflowTrace(flat)) return flat

  // Path 2 · nested em metadata
  const metadata = record.metadata
  if (metadata && typeof metadata === 'object') {
    const nested = (metadata as Record<string, unknown>).hyperflow_runtime
    if (nested && typeof nested === 'object') {
      return normalizeNestedToFlat(nested as HyperflowRuntimePayload)
    }
  }

  // Path 3 · nested em payload
  const payload = record.payload
  if (payload && typeof payload === 'object') {
    const nested = (payload as Record<string, unknown>).hyperflow_runtime
    if (nested && typeof nested === 'object') {
      return normalizeNestedToFlat(nested as HyperflowRuntimePayload)
    }
  }

  return null
}

function isHyperflowTrace(value: unknown): value is AtlasAiHyperflowTrace {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.schema_version === 'string'
    && typeof v.intent === 'string'
    && typeof v.domain_id === 'string'
    && typeof v.flow_id === 'string'
  )
}

/**
 * Converte o nested shape do AtlasHyperflowEntryService em flat shape canônico
 * (mesmo que AiTraceResource produziria).
 */
function normalizeNestedToFlat(nested: HyperflowRuntimePayload): AtlasAiHyperflowTrace {
  const intent = nested.intent?.intent_type ?? 'unknown'
  const handoffTarget = nested.handoff_target?.kind ?? null

  return {
    schema_version: HYPERFLOW_RUNTIME_SCHEMA,
    intent,
    domain_id: nested.primary_domain ?? 'unknown',
    flow_id: nested.flow_id ?? 'auto',
    runtime_mode: (nested.router_decision?.routing_mode ?? nested.flow_route?.runtime_mode ?? 'standard') as AtlasAiHyperflowTrace['runtime_mode'],
    confidence: nested.intent?.confidence ?? 0,
    policy_refs: [],
    evidence_refs: [],
    decision_receipt_id: nested.decision_receipt?.receipt_hash ?? nested.router_decision?.uuid,
    decision_receipt_hash: nested.decision_receipt?.receipt_hash ?? nested.router_decision?.receipt_hash,
    dispatch_status: (nested.dispatch?.dispatch_status ?? 'planned') as AtlasAiHyperflowTrace['dispatch_status'],
    handoff_target: handoffTarget,
    handoff_reason: null,
    router_was_overridden: false,
    reasons: [],
  }
}

/**
 * Verifica se um payload de request (saída de `buildInteractionPayload`)
 * respeita o invariante auto/auto canon:
 *   - Quando atlas_mode === 'auto', NÃO carrega programming_harness,
 *     capability_profile, permission_policy, tool_permissions.
 *
 * Útil pra anti-regressão em testes E em runtime guards.
 */
export function isAutoAutoCleanPayload(payload: Record<string, unknown>): boolean {
  if (payload.atlas_mode !== 'auto') return true // só se aplica a auto
  const forbidden = ['programming_harness', 'capability_profile', 'permission_policy', 'tool_permissions', 'mobile_runtime_policy']
  return forbidden.every((key) => !(key in payload))
}

/**
 * Label humano para o intent type · usado no painel de contexto/debug do
 * composer pra mostrar "Atlas decidiu: Pesquisa" etc.
 */
const INTENT_LABEL_BY_TYPE: Record<string, string> = {
  conversation: 'Conversa',
  research: 'Pesquisa',
  programming: 'Programação',
  debug: 'Debug',
  review: 'Review',
  explain: 'Explicar',
  plan: 'Plano',
  finance: 'Finanças',
  marketing: 'Marketing',
  strategy: 'Estratégia',
  cyber: 'Cyber',
  personal_development: 'Pessoal',
  automation: 'Automação',
  unknown: 'Indefinido',
}

export function intentLabelFor(intent: string): string {
  return INTENT_LABEL_BY_TYPE[intent] ?? intent
}

/**
 * Formata as razões da decisão (`reasons` array) em string compacta humana.
 * Útil pra tooltip / context panel debug.
 */
export function formatRoutingReason(hyperflow: AtlasAiHyperflowTrace | null): string {
  if (!hyperflow) return ''
  if (hyperflow.reasons && hyperflow.reasons.length > 0) {
    return hyperflow.reasons.join(' · ')
  }
  const parts = [intentLabelFor(hyperflow.intent), `flow:${hyperflow.flow_id}`, `mode:${hyperflow.runtime_mode}`]
  return parts.join(' · ')
}

/**
 * Retorna o `flow_id` canônico (backend wins) ou `null` se o backend ainda
 * não decidiu. NUNCA retorna fallback local — quem quiser fallback usa
 * `flowIdForMode()` do contract diretamente.
 */
export function flowIdFromRuntime(hyperflow: AtlasAiHyperflowTrace | null): string | null {
  if (!hyperflow) return null
  return hyperflow.flow_id
}
