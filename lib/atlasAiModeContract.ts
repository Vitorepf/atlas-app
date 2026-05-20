/**
 * @deprecated · 2026-05-18 · use `lib/atlasAi/contract.ts` (V2, 12 modos canon).
 *
 * Este arquivo é o contrato V1 (3 modos: general/operational/programming) e
 * NÃO reflete o canon atual do Atlas AI (12 modos · auto default · Hyperflow
 * routing). Mantido temporariamente pra não quebrar consumidores existentes.
 *
 * Migração: consumidores devem trocar para:
 *   - import { ... } from 'lib/atlasAi/contract'
 *   - buildInteractionPayload() ao invés de atlasModePayloadForRoutingContract()
 *   - 12 modes incluindo 'auto' default
 *
 * Anti-regressão: NÃO adicionar novos consumidores deste arquivo.
 */
import type { AtlasAiFocus } from './atlasAiFocus'

export type AtlasAiMode = 'general' | 'operational' | 'programming'
export type AtlasAiRoutingTask = 'direct' | 'plan' | 'review' | 'dev' | 'debug'
export type AtlasAiRoutingDomain = 'auto' | 'atlas' | 'vault-curador' | 'saude' | 'blackink' | 'financas'

export interface AtlasAiModeRoutingLike {
  mode: AtlasAiMode
  task: string
  domain: string
  executor: string
  style: string
}

export interface AtlasAiModeRuntimeOptions {
  workspace?: string | null
}

export const ATLAS_AI_MODE_CONTRACT_VERSION = 1

export function atlasModeForFocus(focus: AtlasAiFocus | string | null | undefined): AtlasAiMode {
  if (focus === 'programming') return 'programming'
  if (focus === 'operational') return 'operational'
  return 'general'
}

export function atlasTaskAllowedForMode(task: AtlasAiRoutingTask, mode: AtlasAiMode): boolean {
  if (mode === 'programming') return task === 'plan' || task === 'review' || task === 'dev' || task === 'debug'
  if (mode === 'operational') return task === 'direct' || task === 'plan' || task === 'review'
  return task === 'direct' || task === 'plan' || task === 'review'
}

export function atlasDefaultTaskForMode(mode: AtlasAiMode): AtlasAiRoutingTask {
  if (mode === 'programming') return 'dev'
  if (mode === 'operational') return 'review'
  return 'direct'
}

export function atlasDomainAllowedForMode(domain: AtlasAiRoutingDomain, mode: AtlasAiMode): boolean {
  if (domain === 'auto') return true
  if (mode === 'general') return domain !== 'atlas'
  return true
}

export function atlasModePayloadForRoutingContract(
  routing: AtlasAiModeRoutingLike,
  focus: AtlasAiFocus,
  options: AtlasAiModeRuntimeOptions = {},
): Record<string, unknown> {
  const mode = atlasModeForFocus(focus)
  const base = {
    atlas_mode: mode,
    atlas_mode_contract: atlasModeContractForRouting(mode, routing),
    quality_policy: atlasQualityPolicyForMode(mode),
  }

  if (mode !== 'programming') return base

  return {
    ...base,
    ...atlasProgrammingRuntimePolicy(options),
  }
}

export function atlasModeContractForRouting(
  mode: AtlasAiMode,
  routing: AtlasAiModeRoutingLike,
): Record<string, unknown> {
  if (mode === 'programming') {
    return {
      schema_version: ATLAS_AI_MODE_CONTRACT_VERSION,
      mode,
      objective: 'resolver trabalho de engenharia com contexto, plano, execucao, verificacao e evidencias',
      routing_task: routing.task,
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
      routing_task: routing.task,
      memory_scope: 'operational_context_bundle_and_current_thread',
      expected_output: ['resumo', 'evidencias', 'risco', 'acao_recomendada', 'quando_promover_para_programacao'],
      required_behaviors: ['use_context_bundle', 'separate_fact_from_hypothesis', 'recommend_next_action'],
    }
  }

  return {
    schema_version: ATLAS_AI_MODE_CONTRACT_VERSION,
    mode,
    objective: 'conversa geral, pesquisa, ideias e organizacao sem herdar contexto operacional ou de codigo por acidente',
    routing_task: routing.task,
    memory_scope: 'general_current_thread',
    expected_output: ['resposta_clara', 'perguntas_necessarias', 'proximos_passos_quando_util'],
    required_behaviors: ['keep_context_light', 'do_not_assume_operational_or_code_runtime'],
  }
}

export function atlasQualityPolicyForMode(mode: AtlasAiMode): Record<string, unknown> {
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

export function atlasProgrammingRuntimePolicy(options: AtlasAiModeRuntimeOptions = {}): Record<string, unknown> {
  return {
    capability_profile: 'atlas_programming',
    permission_policy: 'full_access',
    permission_mode: 'danger',
    tool_permissions: {
      mode: 'danger',
      workspace: options.workspace ?? undefined,
      confirmed: true,
      allow_unsandboxed_provider: true,
      source: 'atlas_ai_programming_mode',
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
