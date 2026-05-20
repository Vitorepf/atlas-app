/**
 * Atlas AI · Mobile · contract canon.
 *
 * Porte fiel de `atlas-desktop/apps/desktop/src/surfaces/atlas-ai/contract.ts`
 * com `ATLAS_AI_SURFACE_ID = 'atlas_mobile_ai'` e preservação do block
 * `mobile_runtime_policy` em programming (RN-specific, herdado do contrato
 * mobile anterior).
 *
 * **Hyperflow-first design.** O Mobile é SURFACE, não decisora. Ele coleta
 * um hint do operador (`mode`/`task`) e despacha pro backend Router Runtime
 * / Atlas Decide / Programming Adapter. A decisão canônica de domain/flow/
 * runtime vive no `trace.hyperflow_runtime` retornado pelo backend — nunca
 * é inferida client-side como ground truth.
 *
 * `auto` é o default canônico: quando o operador não escolhe domínio,
 * enviamos `routing_domain=auto` + `routing_task=auto` e deixamos o
 * Hyperflow escolher. O `UX_FLOW_MAP` local existe APENAS como fallback de
 * UI hints enquanto o backend não retornou trace.
 *
 * Anti-regressão (espelha `atlasAiHyperflowContract.test.ts` do desktop):
 *   - `mode=auto` + `task=auto` NUNCA arrasta `programming_harness`,
 *     `capability_profile` ou `permission_policy` no payload.
 *   - `flow_id=auto` quando o operador deixa em auto.
 *
 * Substitui `lib/atlasAiModeContract.ts` (V1, marcado @deprecated).
 */
import type {
  AtlasAiFocus,
  AtlasAiMode,
  AtlasAiProvider,
  AtlasAiProviderChoice,
  AtlasAiTask,
} from './types'

export const ATLAS_AI_MODE_CONTRACT_VERSION = 2

/**
 * Surface canônica do Atlas AI mobile. O backend trata `surface_id ≠ atlas_code`
 * como "não exige Obra"; usamos `atlas_mobile_ai` para distinguir de `atlas_desktop_ai`.
 */
export const ATLAS_AI_SURFACE_ID = 'atlas_mobile_ai'
export const ATLAS_AI_APP_SURFACE = 'atlas_mobile_ai'

export const PROVIDER_OPTIONS: ReadonlyArray<{
  value: AtlasAiProviderChoice
  label: string
  sub: string
}> = [
  { value: 'auto', label: 'Auto (Atlas Decide)', sub: 'Atlas escolhe o provider ideal por contexto' },
  { value: 'claude_cli', label: 'Claude', sub: 'Anthropic via Claude CLI · vision premium' },
  { value: 'codex_cli', label: 'Codex', sub: 'OpenAI via Codex CLI · raciocínio técnico' },
  { value: 'gemini_cli', label: 'Gemini', sub: 'Google Gemini · multimodal' },
  { value: 'claude_codex', label: 'Claude+Codex council', sub: 'Dois provedores em conselho · resposta consolidada' },
]

/**
 * 12 modos canônicos. `auto` é o default — o front NÃO assume domínio.
 * Ordem espelha hierarquia do menu (auto + geral primeiro, domínios técnicos depois).
 */
export const MODE_OPTIONS: ReadonlyArray<{ value: AtlasAiMode; label: string; sub: string }> = [
  { value: 'auto', label: 'Auto (Hyperflow)', sub: 'Atlas Decide escolhe domínio/flow pelo contexto' },
  { value: 'general', label: 'Geral', sub: 'pesquisa, ideias, conversa leve' },
  { value: 'conversation', label: 'Conversa', sub: 'troca livre, sem domínio técnico' },
  { value: 'operational', label: 'Operacional', sub: 'diagnóstico, próxima ação' },
  { value: 'programming', label: 'Programação', sub: 'Atlas Dev: bugs, debug, review, features' },
  { value: 'research', label: 'Pesquisa', sub: 'investigação técnica, mercado, literatura' },
  { value: 'finance', label: 'Finanças', sub: 'análise de carteira, custo, decisão financeira' },
  { value: 'marketing', label: 'Marketing', sub: 'campanha, copy, métricas' },
  { value: 'strategy', label: 'Estratégia', sub: 'objetivos, prioridade, escolha' },
  { value: 'personal_development', label: 'Pessoal', sub: 'metas, hábitos, organização' },
  { value: 'cyber', label: 'Cyber', sub: 'red/blue/purple, segurança defensiva' },
  { value: 'automation', label: 'Automação', sub: 'workflows, integrações, scripts' },
]

export const TASK_OPTIONS_AUTO: ReadonlyArray<{ value: AtlasAiTask; label: string; sub: string }> = [
  { value: 'auto', label: 'Auto', sub: 'backend decide o task pelo Hyperflow' },
  { value: 'direct', label: 'Direto', sub: 'resposta imediata' },
  { value: 'plan', label: 'Plan', sub: 'pensar antes de responder' },
  { value: 'review', label: 'Review', sub: 'auditar/avaliar antes de agir' },
]

export const TASK_OPTIONS_PROGRAMMING: ReadonlyArray<{ value: AtlasAiTask; label: string; sub: string }> = [
  { value: 'dev', label: 'Dev', sub: 'feature pequena/média, ajuste, refator' },
  { value: 'debug', label: 'Debug', sub: 'isolar e corrigir bug' },
  { value: 'review', label: 'Review', sub: 'revisar diff, código ou plano' },
  { value: 'plan', label: 'Plan', sub: 'planejar antes de executar' },
]

export const TASK_OPTIONS_GENERAL: ReadonlyArray<{ value: AtlasAiTask; label: string; sub: string }> = [
  { value: 'direct', label: 'Direto', sub: 'resposta direta' },
  { value: 'plan', label: 'Plan', sub: 'pensar antes de responder' },
  { value: 'review', label: 'Review', sub: 'revisar/avaliar' },
]

export const TASK_OPTIONS_OPERATIONAL: ReadonlyArray<{ value: AtlasAiTask; label: string; sub: string }> = [
  { value: 'review', label: 'Review', sub: 'auditar estado, próxima ação' },
  { value: 'plan', label: 'Plan', sub: 'plano operacional curto' },
  { value: 'direct', label: 'Direto', sub: 'resposta direta operacional' },
]

export function taskOptionsForMode(mode: AtlasAiMode) {
  if (mode === 'auto') return TASK_OPTIONS_AUTO
  if (mode === 'programming') return TASK_OPTIONS_PROGRAMMING
  if (mode === 'operational') return TASK_OPTIONS_OPERATIONAL
  return TASK_OPTIONS_GENERAL
}

export function defaultTaskForMode(mode: AtlasAiMode): AtlasAiTask {
  if (mode === 'auto') return 'auto'
  if (mode === 'programming') return 'dev'
  if (mode === 'operational') return 'review'
  return 'direct'
}

export function isTaskAllowedForMode(task: AtlasAiTask, mode: AtlasAiMode): boolean {
  if (mode === 'auto') return task === 'auto' || task === 'direct' || task === 'plan' || task === 'review'
  if (mode === 'programming') return task === 'plan' || task === 'review' || task === 'dev' || task === 'debug'
  if (mode === 'operational') return task === 'direct' || task === 'plan' || task === 'review'
  return task === 'direct' || task === 'plan' || task === 'review'
}

/** Alias para compat com StatusRouting · prefixo `atlas*` legacy. */
export const atlasTaskAllowedForMode = isTaskAllowedForMode

export function focusForMode(mode: AtlasAiMode): AtlasAiFocus {
  return mode
}

/**
 * Soft local fallback para UI hints enquanto o backend não retornou um
 * `flow_id` canônico. Backend SEMPRE vence; mobile nunca usa isso como
 * source of truth.
 *
 * `auto` deliberadamente mapeia para `auto` (special token) pra qualquer
 * consumer detectar que o front NÃO escolheu flow.
 */
const UX_FLOW_MAP: Record<AtlasAiMode, Partial<Record<AtlasAiTask, string>>> = {
  auto: {
    auto: 'auto',
    direct: 'auto',
    plan: 'auto',
    review: 'auto',
  },
  general: {
    direct: 'general.answer',
    plan: 'general.answer',
    review: 'general.answer',
  },
  conversation: {
    direct: 'general.answer',
    plan: 'general.answer',
    review: 'general.answer',
  },
  operational: {
    direct: 'operations.diagnostic',
    plan: 'operations.diagnostic',
    review: 'operations.diagnostic',
  },
  programming: {
    direct: 'programming.dev',
    plan: 'programming.dev',
    review: 'programming.review',
    dev: 'programming.dev',
    debug: 'programming.repair',
  },
  research: {
    direct: 'research.investigate',
    plan: 'research.investigate',
    review: 'research.investigate',
  },
  finance: {
    direct: 'finance.analyze',
    plan: 'finance.analyze',
    review: 'finance.analyze',
  },
  marketing: {
    direct: 'marketing.plan',
    plan: 'marketing.plan',
    review: 'marketing.plan',
  },
  strategy: {
    direct: 'strategy.decide',
    plan: 'strategy.decide',
    review: 'strategy.decide',
  },
  personal_development: {
    direct: 'personal_development.organize',
    plan: 'personal_development.organize',
    review: 'personal_development.organize',
  },
  cyber: {
    direct: 'cyber.defensive',
    plan: 'cyber.defensive',
    review: 'cyber.defensive',
  },
  automation: {
    direct: 'automation.workflow',
    plan: 'automation.workflow',
    review: 'automation.workflow',
  },
}

export function flowIdForMode(mode: AtlasAiMode, task: AtlasAiTask): string {
  return UX_FLOW_MAP[mode]?.[task] ?? UX_FLOW_MAP[mode]?.direct ?? 'auto'
}

export function domainIdForFlow(flowId: string): string {
  if (flowId === 'auto') return 'auto'
  const [domain] = flowId.split('.')
  return domain ?? 'auto'
}

export interface AtlasAiPayloadInput {
  mode: AtlasAiMode
  task: AtlasAiTask
  provider: AtlasAiProviderChoice
  workspaceSlug: string | null
  routingDomain?: string | null
  conversationContext?: Record<string, unknown> | Array<Record<string, unknown>>
}

export interface AtlasAiPayloadBuildResult {
  payload: Record<string, unknown>
  provider: AtlasAiProvider | undefined
}

/**
 * Constrói o payload que vai para POST /ai/interactions.
 *
 * Filosofia Hyperflow-first:
 *   - `auto` mode/task ⇒ front envia `routing_domain=auto` + `routing_task=auto`.
 *     Backend Router Runtime / Atlas Decide decide o resto.
 *   - Modo explícito ⇒ front envia o hint canônico do operador; backend
 *     ainda pode reroutar e o trace carrega a decisão real.
 *   - Programming-specific runtime policy só entra quando `mode==='programming'`
 *     explicitamente — `auto` NUNCA arrasta atlas_programming/permission_policy.
 */
export function buildInteractionPayload(input: AtlasAiPayloadInput): AtlasAiPayloadBuildResult {
  const focus = focusForMode(input.mode)
  const decisionMode = input.provider === 'auto' ? 'atlas_decide' : 'manual_override'
  const provider = input.provider === 'auto' ? undefined : input.provider
  const workflowMode = input.task === 'debug' ? 'dev' : input.task
  const flowId = flowIdForMode(input.mode, input.task)
  const domainId = domainIdForFlow(flowId)

  // Auto-mode: front NÃO assume domínio. Programming explícito mantém
  // workspaceSlug como domínio de roteamento por compat com Atlas Dev.
  const routingDomain = input.routingDomain
    ?? (input.mode === 'auto' || input.task === 'auto'
      ? 'auto'
      : input.mode === 'programming' && input.workspaceSlug
        ? input.workspaceSlug
        : input.mode)

  const routingTask = input.task === 'auto' ? 'auto' : input.task

  const payload: Record<string, unknown> = {
    app_surface: ATLAS_AI_APP_SURFACE,
    surface_id: ATLAS_AI_SURFACE_ID,
    atlas_focus: focus,
    atlas_workflow_mode: workflowMode,
    atlas_mode: input.mode,
    routing_task: routingTask,
    routing_domain: routingDomain,
    decision_mode: decisionMode,
    flow_id: flowId,
    domain_id: domainId,
    workspace: input.workspaceSlug ?? undefined,
    atlas_mode_contract: modeContractForRouting(input.mode, input.task),
    quality_policy: qualityPolicyForMode(input.mode),
    conversation_context: input.conversationContext ?? undefined,
  }

  if (input.mode === 'programming') {
    Object.assign(payload, programmingRuntimePolicy(input.workspaceSlug))
  }

  if (provider) {
    payload.requested_provider = provider
    payload.operator_requested_provider = provider
  }

  return { payload, provider }
}

export function modeContractForRouting(mode: AtlasAiMode, task: AtlasAiTask): Record<string, unknown> {
  if (mode === 'auto') {
    return {
      schema_version: ATLAS_AI_MODE_CONTRACT_VERSION,
      mode,
      objective:
        'atlas decide domínio e flow pelo contexto operacional sem que a surface assuma programação ou operacional por default',
      routing_task: task,
      memory_scope: 'auto_current_thread',
      expected_output: ['resposta_clara', 'evidencia_quando_aplicavel', 'proxima_acao_quando_util'],
      required_behaviors: ['route_via_router_runtime', 'no_surface_side_inference_as_truth'],
    }
  }
  if (mode === 'programming') {
    return {
      schema_version: ATLAS_AI_MODE_CONTRACT_VERSION,
      mode,
      objective:
        'resolver trabalho de engenharia com contexto, plano, execucao, verificacao e evidencias',
      routing_task: task,
      default_runtime: 'engineering_harness',
      memory_scope: 'engineering_and_current_thread',
      expected_output: ['diagnostico', 'plano', 'execucao', 'testes', 'riscos', 'proximos_passos'],
      required_behaviors: ['use_tools_when_needed', 'record_evidence', 'state_tests_or_reason'],
    }
  }
  if (mode === 'operational') {
    return {
      schema_version: ATLAS_AI_MODE_CONTRACT_VERSION,
      mode,
      objective: 'explicar situacao operacional, isolar causa, medir impacto e propor proxima acao',
      routing_task: task,
      memory_scope: 'operational_context_bundle_and_current_thread',
      expected_output: [
        'resumo',
        'evidencias',
        'risco',
        'acao_recomendada',
        'quando_promover_para_programacao',
      ],
      required_behaviors: ['use_context_bundle', 'separate_fact_from_hypothesis', 'recommend_next_action'],
    }
  }
  return {
    schema_version: ATLAS_AI_MODE_CONTRACT_VERSION,
    mode,
    objective:
      'conversa geral, pesquisa, ideias e organizacao sem herdar contexto operacional ou de codigo por acidente',
    routing_task: task,
    memory_scope: 'general_current_thread',
    expected_output: ['resposta_clara', 'perguntas_necessarias', 'proximos_passos_quando_util'],
    required_behaviors: ['keep_context_light', 'do_not_assume_operational_or_code_runtime'],
  }
}

export function qualityPolicyForMode(mode: AtlasAiMode): Record<string, unknown> {
  if (mode === 'auto') {
    return {
      keep_context_light: true,
      let_router_runtime_decide: true,
    }
  }
  if (mode === 'programming') {
    return {
      require_plan: true,
      require_tests_or_reason: true,
      require_diff_or_reason: true,
      require_risk_summary: true,
    }
  }
  if (mode === 'operational') {
    return {
      require_evidence: true,
      require_uncertainty: true,
      require_next_actions: true,
      avoid_raw_json_as_primary_output: true,
    }
  }
  return {
    keep_context_light: true,
    avoid_operational_or_programming_assumptions: true,
  }
}

/**
 * Programming runtime policy · preserva `mobile_runtime_policy` block que
 * existe no contrato mobile anterior (RN-specific, ausente no desktop).
 * Removendo esse block poderia bloquear runtime mobile no backend.
 */
export function programmingRuntimePolicy(workspace: string | null): Record<string, unknown> {
  return {
    capability_profile: 'atlas_programming',
    permission_policy: 'full_access',
    permission_mode: 'danger',
    tool_permissions: {
      mode: 'danger',
      workspace: workspace ?? undefined,
      confirmed: true,
      allow_unsandboxed_provider: true,
      source: 'atlas_mobile_ai_programming_mode',
    },
    mobile_runtime_policy: {
      allows_code_execution: true,
      reason: 'Modo Programacao habilita o runtime completo do Atlas AI para codigo, scripts, testes e automacoes.',
    },
    programming_harness: {
      schema_version: ATLAS_AI_MODE_CONTRACT_VERSION,
      workspace_required: true,
      expected_artifacts: ['plan', 'diff_or_reason', 'tests_or_reason', 'risks'],
      escalation_policy: 'ask_before_destructive_or_external_write',
    },
  }
}

export function providerLabel(value: AtlasAiProviderChoice): string {
  return PROVIDER_OPTIONS.find((opt) => opt.value === value)?.label ?? value
}
