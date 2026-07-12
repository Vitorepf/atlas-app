/**
 * Atlas AI · Mobile · adapter V1 RoutingState → V2 canon.
 *
 * Slice 3a (Hyperflow migration): permite que `atlasModePayloadForRouting()` em
 * `AtlasAiRoutingModel.ts` (V1) use internamente `buildInteractionPayload()` (V2)
 * sem mudar a assinatura nem o shape de output esperado pelos consumers
 * (`AtlasAiSheet.tsx:3646` etc.).
 *
 * Filosofia:
 *   - V1 retornava SUBSET do payload (mode + contract + quality + programming policy)
 *   - V2 retorna PAYLOAD COMPLETO (com surface_id, app_surface, routing_*, flow_id, etc.)
 *   - Adapter chama V2 e EXTRAI o subset V1 pra manter compat byte-a-byte
 *
 * Quando o composer mobile for refatorado (Slice 3c) pra usar `buildInteractionPayload`
 * direto, esse adapter pode ser removido junto com `atlasModePayloadForRouting`
 * (que vira no-op).
 *
 * **Preserva `source: 'atlas_ai_programming_mode'` V1** (vs V2 que usa
 * `'atlas_mobile_ai_programming_mode'`). Manter source V1 evita quebrar
 * telemetry no backend que filtra por source. Migração final acontece no Slice 3c.
 */
import { buildInteractionPayload, type AtlasAiPayloadInput } from './contract'
import type { AtlasAiMode, AtlasAiProviderChoice, AtlasAiTask } from './types'

/**
 * Shape mínimo do RoutingState V1 que o adapter precisa. Mantido inline pra
 * evitar importar `components/console/StatusRouting.tsx` (UI primitive) num
 * arquivo de `lib/`. Quando RoutingState evoluir, atualizar aqui também.
 */
export interface V1RoutingStateLike {
  mode: 'general' | 'operational' | 'programming'
  task: 'direct' | 'plan' | 'review' | 'dev' | 'debug'
  domain: string
  executor: 'auto' | 'hermes_cli' | 'minimax_m27_cli' | 'claude_cli' | 'codex_cli' | 'gemini_cli' | 'claude_codex'
  style: string
}

/**
 * Converte RoutingState V1 em AtlasAiPayloadInput V2.
 *
 * Mapping notes:
 *   - V1 não tem `mode='auto'` — sempre mapeia direto pra V2 (general/operational/programming ⊂ V2)
 *   - V1 não tem `task='auto'` — V2 task type ⊃ V1 task type, mapeamento direto
 *   - V1 `executor` === V2 `provider` (mesmo type)
 *   - V1 `domain==='auto'` ⇒ V2 sem `routingDomain` override (backend decide)
 *   - V1 `style` não tem equivalente V2 — descartado (Slice 3c decide se preserva)
 */
export function v1RoutingToV2Input(
  routing: V1RoutingStateLike,
  workspaceSlug: string | null,
): AtlasAiPayloadInput {
  return {
    mode: routing.mode satisfies AtlasAiMode,
    task: routing.task satisfies AtlasAiTask,
    provider: routing.executor satisfies AtlasAiProviderChoice,
    workspaceSlug,
    routingDomain: routing.domain === 'auto' ? undefined : routing.domain,
  }
}

/**
 * Keys do payload V2 que faziam parte do output V1 de
 * `atlasModePayloadForRoutingContract`. Tudo fora dessa lista (app_surface,
 * surface_id, routing_*, flow_id, decision_mode, conversation_context, etc.) é
 * filtrado fora pra manter compat estrita do shape V1.
 */
const V1_OUTPUT_KEYS = new Set([
  // Core (sempre presente)
  'atlas_mode',
  'atlas_mode_contract',
  'quality_policy',
  // Programming-only (presente apenas em mode='programming')
  'capability_profile',
  'permission_policy',
  'permission_mode',
  'tool_permissions',
  'mobile_runtime_policy',
  'programming_harness',
])

/**
 * Builds the V1-compat policy block from a RoutingState. Internally uses
 * V2 `buildInteractionPayload` then filters down to the V1 subset.
 *
 * **Compat mode**: força `source: 'atlas_ai_programming_mode'` (V1) em
 * `tool_permissions` pra preservar telemetry. V2 source canônico é
 * `'atlas_mobile_ai_programming_mode'` (será adotado em Slice 3c).
 *
 * Atenção: este adapter inclui `schema_version: 1` no `atlas_mode_contract`
 * pra zero diff em consumers V1. V2 nativo usa schema_version: 2.
 */
export function buildModePolicyFromRoutingState(
  routing: V1RoutingStateLike,
  workspaceSlug: string | null,
): Record<string, unknown> {
  const input = v1RoutingToV2Input(routing, workspaceSlug)
  const { payload } = buildInteractionPayload(input)

  // Extrai apenas o subset V1
  const filtered: Record<string, unknown> = {}
  for (const key of V1_OUTPUT_KEYS) {
    if (key in payload) {
      filtered[key] = payload[key]
    }
  }

  // V1 compat: força source 'atlas_ai_programming_mode' em tool_permissions
  // (V2 mobile usa 'atlas_mobile_ai_programming_mode' que é canônico mas
  // mudaria contrato V1 e quebraria telemetry filter no backend).
  if (filtered.tool_permissions && typeof filtered.tool_permissions === 'object') {
    const tp = filtered.tool_permissions as Record<string, unknown>
    if (tp.source === 'atlas_mobile_ai_programming_mode') {
      filtered.tool_permissions = { ...tp, source: 'atlas_ai_programming_mode' }
    }
  }

  // V1 compat: força schema_version: 1 em atlas_mode_contract + programming_harness
  // (V2 canônico usa 2; manter 1 evita diff downstream antes do Slice 3c)
  if (filtered.atlas_mode_contract && typeof filtered.atlas_mode_contract === 'object') {
    filtered.atlas_mode_contract = {
      ...filtered.atlas_mode_contract,
      schema_version: 1,
    }
  }
  if (filtered.programming_harness && typeof filtered.programming_harness === 'object') {
    filtered.programming_harness = {
      ...filtered.programming_harness,
      schema_version: 1,
    }
  }

  return filtered
}
