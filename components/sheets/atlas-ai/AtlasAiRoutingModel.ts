import type {
  AiProvidersStatusResponse,
  AtlasAiProvider,
  AtlasAiThread,
} from '../../../lib/api/client'
import {
  ROUTING_DEFAULT,
  isRoutingDomainKey,
  sanitizeRoutingState,
  type RoutingExecutor,
  type RoutingMode,
  type RoutingState,
  type RoutingStyle,
} from '../../console/StatusRouting'
import { normalizeAtlasAiFocus, type AtlasAiFocus } from '../../../lib/atlasAiFocus'
import { atlasAiModeFromThread } from '../../../lib/atlasAiThreadRouting'
import { buildInteractionPayload } from '../../../lib/atlasAi/contract'
import { buildModePolicyFromRoutingState } from '../../../lib/atlasAi/v1Adapter'

export type ThreadProviderGovernance = {
  decisionMode: string | null
  decisionAuthority: string | null
  executionProvider: string | null
  manualOverride: boolean
}

export function normalizeStoredRouting(raw: string | null): RoutingState {
  if (!raw) return ROUTING_DEFAULT

  try {
    const value = JSON.parse(raw) as Partial<RoutingState>
    return sanitizeRoutingState({
      mode: isRoutingMode(value.mode) ? value.mode : ROUTING_DEFAULT.mode,
      task: isRoutingTask(value.task) ? value.task : ROUTING_DEFAULT.task,
      domain: isRoutingDomain(value.domain) ? value.domain : ROUTING_DEFAULT.domain,
      executor: isRoutingExecutor(value.executor) ? value.executor : ROUTING_DEFAULT.executor,
      style: isRoutingStyle(value.style) ? value.style : ROUTING_DEFAULT.style,
    })
  } catch {
    return ROUTING_DEFAULT
  }
}

export function routingStateFromThread(thread: AtlasAiThread, fallback: RoutingState): RoutingState {
  const metadata = thread.metadata ?? {}
  const mode = atlasAiModeFromThread(thread)
  const base = routingDefaultForMode(mode, fallback)
  const task = metadataString(metadata, 'routing_task')
  const domain = metadataString(metadata, 'routing_domain')
  const style = metadataString(metadata, 'routing_style')
  const requestedProvider = metadataString(metadata, 'requested_provider') ?? thread.last_provider

  return sanitizeRoutingState({
    mode,
    task: isRoutingTask(task) ? task : base.task,
    domain: isRoutingDomain(domain) ? domain : base.domain,
    executor: isRoutingExecutor(requestedProvider) ? requestedProvider : base.executor,
    style: isRoutingStyle(style) ? style : base.style,
  })
}

function routingDefaultForMode(mode: RoutingMode, fallback: RoutingState): RoutingState {
  if (mode === 'auto') {
    return sanitizeRoutingState({
      ...fallback,
      mode,
      task: 'auto',
      domain: 'auto',
      executor: fallback.executor,
      style: fallback.style,
    })
  }

  if (mode === 'programming') {
    return sanitizeRoutingState({
      ...fallback,
      mode,
      task: fallback.task === 'debug' ? 'debug' : 'dev',
      domain: fallback.domain === 'auto' ? 'atlas' : fallback.domain,
      executor: fallback.executor,
      style: fallback.style === 'clear' ? 'technical' : fallback.style,
    })
  }

  if (mode === 'operational') {
    return sanitizeRoutingState({
      ...fallback,
      mode,
      task: fallback.task === 'plan' ? 'plan' : 'review',
      domain: fallback.domain === 'auto' ? 'atlas' : fallback.domain,
      style: fallback.style === 'clear' ? 'complete' : fallback.style,
    })
  }

  return sanitizeRoutingState({
    ...fallback,
    mode,
    task: fallback.task === 'dev' || fallback.task === 'debug' || fallback.task === 'auto' ? 'direct' : fallback.task,
    domain: fallback.domain === 'atlas' ? 'auto' : fallback.domain,
  })
}

export function providerGovernanceFromThread(thread: AtlasAiThread): ThreadProviderGovernance {
  const metadata = thread.metadata ?? {}
  const governance = metadataRecord(metadata, 'provider_governance')
  const decisionMode = metadataString(governance ?? metadata, 'decision_mode')
  const decisionAuthority = metadataString(governance ?? metadata, 'decision_authority')
  const executionProvider =
    metadataString(governance ?? metadata, 'execution_provider')
    ?? metadataString(governance ?? metadata, 'selected_provider')
    ?? thread.last_provider
    ?? null
  const manualOverrideRaw = governance?.manual_override

  return {
    decisionMode,
    decisionAuthority,
    executionProvider,
    manualOverride: manualOverrideRaw === true || decisionMode === 'manual_override' || decisionAuthority === 'operator_override',
  }
}

export function executorAsProviderWord(executor: RoutingExecutor): string | undefined {
  if (executor === 'hermes_cli') return 'hermes'
  if (executor === 'minimax_m27_cli') return 'minimax m3'
  if (executor === 'claude_cli') return 'claude'
  if (executor === 'codex_cli') return 'codex'
  if (executor === 'gemini_cli') return 'gemini'
  if (executor === 'claude_codex') return 'conselho'
  return undefined
}

export function providerFromRouting(routing: RoutingState): AtlasAiProvider | null {
  routing = sanitizeRoutingState(routing)
  if (routing.executor === 'hermes_cli') return 'hermes_cli'
  if (routing.executor === 'minimax_m27_cli') return 'minimax_m27_cli'
  if (routing.executor === 'claude_cli') return 'claude_cli'
  if (routing.executor === 'codex_cli') return 'codex_cli'
  if (routing.executor === 'gemini_cli') return 'gemini_cli'
  if (routing.executor === 'claude_codex') return 'claude_codex'
  return null
}

export function geminiAutomaticEnabled(status: AiProvidersStatusResponse | null): boolean {
  return status?.model_policy?.providers.find((item) => item.provider === 'gemini_cli')?.allow_auto === true
}

export function effectiveAgent(routing: RoutingState): string | undefined {
  routing = sanitizeRoutingState(routing)
  if (routing.mode === 'programming') return 'desenvolvedor'
  if (routing.domain !== 'auto') return routing.domain
  if (routing.task === 'review') return 'code-reviewer'
  return undefined
}

export function responsePolicyFor(style: RoutingStyle, task: RoutingState['task']) {
  const devMode = task === 'dev' || task === 'debug'
  if (style === 'technical') {
    return {
      style,
      no_code_by_default: false,
      plain_language: false,
      preferred_shape: devMode ? 'implementation_summary_with_files' : 'technical_answer',
      constraints: [
        'Explique decisões técnicas sem despejar código desnecessário.',
        'Inclua código apenas quando o operador pedir ou quando for indispensável.',
      ],
    }
  }
  if (style === 'complete') {
    return {
      style,
      no_code_by_default: true,
      plain_language: true,
      preferred_shape: 'complete_but_scannable',
      constraints: [
        'Resposta completa, mas escaneável.',
        'Evite blocos de código longos por padrão.',
      ],
    }
  }
  if (style === 'brief') {
    return {
      style,
      no_code_by_default: true,
      plain_language: true,
      preferred_shape: 'minimal_actionable',
      constraints: [
        'Responda no mínimo útil.',
        'Sem código salvo pedido explícito.',
      ],
    }
  }
  return {
    style,
    no_code_by_default: true,
    plain_language: true,
    preferred_shape: devMode ? 'operator_summary_no_code' : 'clear_direct_answer',
    constraints: [
      'Use linguagem simples e direta.',
      'Não mostre código por padrão; traduza implementação para consequência prática.',
      'Se precisar citar código, prefira nomes de arquivos e comportamento observado.',
    ],
  }
}

export function atlasModePayloadForRouting(routing: RoutingState, focus: AtlasAiFocus, workspace?: string | null): Record<string, unknown> {
  // V2 canon migration (Slice 3a · 2026-05-18): output subset V1-compat
  // gerado via buildInteractionPayload (canon Hyperflow-first). `focus` param
  // permanece na assinatura por compat com consumers (passa pelo adapter como
  // mode da RoutingState; não é mais usado isoladamente). Slice 3c migra o
  // composer pra `buildInteractionPayload` direto.
  void focus
  if (
    routing.mode === 'auto'
    || routing.mode === 'conversation'
    || routing.mode === 'research'
    || routing.mode === 'finance'
    || routing.mode === 'marketing'
    || routing.mode === 'strategy'
    || routing.mode === 'personal_development'
    || routing.mode === 'cyber'
    || routing.mode === 'automation'
    || routing.task === 'auto'
  ) {
    return buildInteractionPayload({
      mode: routing.mode,
      task: routing.task,
      provider: routing.executor,
      workspaceSlug: workspace ?? null,
      routingDomain: routing.domain === 'auto' ? undefined : routing.domain,
    }).payload
  }
  return buildModePolicyFromRoutingState({
    mode: routing.mode as 'general' | 'operational' | 'programming',
    task: routing.task as 'direct' | 'plan' | 'review' | 'dev' | 'debug',
    domain: routing.domain,
    executor: routing.executor,
    style: routing.style,
  }, workspace ?? null)
}

export function runtimePolicyPayloadForThread(thread: AtlasAiThread | null, focusOverride?: AtlasAiFocus): Record<string, unknown> {
  const metadata = thread?.metadata ?? {}
  const capabilityProfile = metadataString(metadata, 'capability_profile')
  const metadataSourceType = metadataString(metadata, 'source_type')
  const operationalContext = capabilityProfile === 'mobile_operational_read'
    || metadataSourceType === 'ai_inbox_item'
    || thread?.source_type === 'inbox_item'

  if (!operationalContext) return {}
  const focus = focusOverride ?? normalizeAtlasAiFocus(metadataString(metadata, 'atlas_focus'), 'operational')

  return {
    atlas_focus: focus,
    source_atlas_focus: metadataString(metadata, 'atlas_focus') ?? 'operational',
    thread_source: 'mobile_gateway_inbox',
    inbox_item_id: metadataString(metadata, 'inbox_item_id') ?? thread?.source_id ?? undefined,
    context_bundle_id: metadataString(metadata, 'context_bundle_id') ?? undefined,
    capability_profile: 'atlas_full_access',
    permission_policy: 'full_access',
    execution_policy: 'provider_execution_allowed',
    permission_mode: 'danger',
    tool_permissions: {
      mode: 'danger',
      workspace: thread?.workspace ?? undefined,
      confirmed: true,
      allow_unsandboxed_provider: true,
      source: 'atlas_ai_contextual_thread_full_access',
    },
    mobile_runtime_policy: {
      allows_code_execution: true,
      reason: 'Atlas app runtime settings allow provider execution and full-access tooling.',
    },
  }
}

export function openBrainPayloadForRouting(routing: RoutingState): Record<string, unknown> | undefined {
  const shouldInject = routing.mode === 'programming' || routing.task === 'dev' || routing.task === 'debug' || routing.task === 'review'
  if (!shouldInject) return undefined

  return {
    mode: 'auto',
    surface: 'app_ai',
    provider_safe_only: true,
    policy: {
      provider_safe_only: true,
      raw_text_exposed: false,
      raw_logs_allowed: false,
      providers_invoked: false,
    },
  }
}

function isRoutingTask(value: unknown): value is RoutingState['task'] {
  return value === 'auto' || value === 'direct' || value === 'plan' || value === 'review' || value === 'dev' || value === 'debug'
}

function isRoutingMode(value: unknown): value is RoutingMode {
  return value === 'auto'
    || value === 'general'
    || value === 'conversation'
    || value === 'operational'
    || value === 'programming'
    || value === 'research'
    || value === 'finance'
    || value === 'marketing'
    || value === 'strategy'
    || value === 'personal_development'
    || value === 'cyber'
    || value === 'automation'
}

function isRoutingDomain(value: unknown): value is RoutingState['domain'] {
  return isRoutingDomainKey(value)
}

function isRoutingExecutor(value: unknown): value is RoutingExecutor {
  return value === 'auto' || value === 'hermes_cli' || value === 'minimax_m27_cli' || value === 'claude_cli' || value === 'codex_cli' || value === 'gemini_cli' || value === 'claude_codex'
}

function isRoutingStyle(value: unknown): value is RoutingStyle {
  return value === 'clear' || value === 'brief' || value === 'technical' || value === 'complete'
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function metadataRecord(metadata: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = metadata[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}
