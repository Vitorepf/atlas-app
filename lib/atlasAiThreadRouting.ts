import {
  atlasAiFocusFromThread,
  normalizeAtlasAiFocus,
  type AtlasAiFocus,
} from './atlasAiFocus'
import type {
  AtlasAiMode,
  AtlasAiTask,
} from './atlasAi/types'

export type AtlasAiRoutingStyle = 'clear' | 'brief' | 'technical' | 'complete'
export type AtlasAiRoutingExecutor = 'auto' | 'hermes_cli' | 'minimax_m27_cli' | 'claude_cli' | 'codex_cli' | 'gemini_cli' | 'claude_codex'
export type AtlasAiRoutingDomain = 'auto' | 'atlas' | 'vault-curador' | 'saude' | 'blackink' | 'financas'

export interface AtlasAiThreadRoutingState {
  mode: AtlasAiMode
  task: AtlasAiTask
  domain: AtlasAiRoutingDomain
  executor: AtlasAiRoutingExecutor
  style: AtlasAiRoutingStyle
}

export interface AtlasAiThreadRoutingLike {
  id?: string | null
  source_type?: string | null
  source_id?: string | null
  last_provider?: string | null
  metadata?: Record<string, unknown> | null
}

export interface ThreadRoutingMetadataOptions {
  now?: string
  source?: string
}

export function atlasAiFocusForRouting(routing: Pick<AtlasAiThreadRoutingState, 'mode' | 'task' | 'domain'>): AtlasAiFocus {
  if (routing.mode === 'programming') return 'programming'
  if (routing.mode === 'operational') return 'operational'
  if (routing.mode === 'research') return 'research'
  if (routing.task === 'dev' || routing.task === 'debug') return 'programming'
  if (routing.task === 'review') return 'review'
  if (routing.task === 'plan') return 'project'
  if (routing.domain === 'vault-curador') return 'research'
  if (routing.domain === 'atlas') return 'operational'

  return 'general'
}

export function atlasAiModeFromThread(thread: AtlasAiThreadRoutingLike | null | undefined): AtlasAiMode {
  const metadata = thread?.metadata ?? {}

  // 1. Modo explícito (mobile/sheet salva isso após routing)
  const explicit = metadataString(metadata, 'current_mode') ?? metadataString(metadata, 'atlas_mode')
  if (explicit) return normalizeAtlasAiMode(explicit)

  // 2. CLI workflow mode · `atlas dev` envia `atlas_workflow_mode: 'dev'`
  //    no payload (que NÃO vai pro `atlas_mode` no AiThreadResolver).
  //    `normalizeAtlasAiMode` já mapeia 'dev'/'debug' → 'programming'.
  const workflow = metadataString(metadata, 'atlas_workflow_mode') ?? metadataString(metadata, 'workflow_mode')
  if (workflow) {
    const normalized = normalizeAtlasAiMode(workflow, 'general')
    if (normalized !== 'general') return normalized
  }

  // 3. Routing task explícito · 'dev'/'debug'/'execute' = programming,
  //    'research'/'analysis' = operational. Espelha o mapping do
  //    AtlasAiPolicyService::mode() do backend.
  const task = metadataString(metadata, 'routing_task')
  if (task) {
    const t = task.trim().toLowerCase()
    if (t === 'dev' || t === 'debug' || t === 'execute' || t === 'quality_repair') return 'programming'
    if (t === 'research') return 'research'
    if (t === 'analysis') return 'operational'
  }

  // 4. Requested agent / last agent slug · agentes específicos sinalizam
  //    intenção. Backend Atlas usa agent slugs PT-BR ('desenvolvedor',
  //    'pesquisador', 'analista') além dos en-US ('dev', 'code', 'engineer').
  //    Real exemplo: thread `019e0cf8` tem requested_agent='desenvolvedor'
  //    e last_agent_slug='desenvolvedor' (verificado no banco).
  const agent = metadataString(metadata, 'requested_agent')
    ?? metadataString(metadata, 'last_agent_slug')
  if (agent) {
    const a = agent.trim().toLowerCase()
    // PT-BR explícitos (canon Atlas)
    if (a === 'desenvolvedor' || a === 'engenheiro' || a === 'programador') return 'programming'
    if (a === 'pesquisador') return 'research'
    if (a === 'analista' || a === 'consultor') return 'operational'
    // EN/substring fallback
    if (a.includes('dev') || a.includes('code') || a.includes('engineer')) return 'programming'
    if (a.includes('research')) return 'research'
    if (a.includes('analy')) return 'operational'
  }

  // 5. Fallback final · derive de focus (geralmente 'general' se nada veio).
  const focus = atlasAiFocusFromThread(thread)
  if (focus === 'programming') return 'programming'
  if (focus === 'operational') return 'operational'
  if (focus === 'research') return 'research'
  return 'general'
}

export function normalizeAtlasAiMode(value: unknown, fallback: AtlasAiMode = 'general'): AtlasAiMode {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-\s]+/g, '_')
  if (normalized === 'auto') return 'auto'
  if (normalized === 'programacao' || normalized === 'programming' || normalized === 'dev' || normalized === 'debug') return 'programming'
  if (normalized === 'operacional' || normalized === 'operational' || normalized === 'operations') return 'operational'
  if (normalized === 'pesquisa' || normalized === 'research') return 'research'
  if (normalized === 'finance' || normalized === 'financas' || normalized === 'finanças') return 'finance'
  if (normalized === 'marketing') return 'marketing'
  if (normalized === 'strategy' || normalized === 'estrategia' || normalized === 'estratégia') return 'strategy'
  if (normalized === 'personal_development' || normalized === 'pessoal') return 'personal_development'
  if (normalized === 'cyber' || normalized === 'security' || normalized === 'seguranca' || normalized === 'segurança') return 'cyber'
  if (normalized === 'automation' || normalized === 'automacao' || normalized === 'automação') return 'automation'
  if (normalized === 'conversation' || normalized === 'conversa') return 'conversation'
  if (normalized === 'geral' || normalized === 'general') return 'general'
  return fallback
}

export function atlasAiModeLabel(mode: AtlasAiMode): string {
  if (mode === 'auto') return 'Auto'
  if (mode === 'programming') return 'Programação'
  if (mode === 'operational') return 'Operacional'
  if (mode === 'research') return 'Pesquisa'
  if (mode === 'finance') return 'Finanças'
  if (mode === 'marketing') return 'Marketing'
  if (mode === 'strategy') return 'Estratégia'
  if (mode === 'personal_development') return 'Pessoal'
  if (mode === 'cyber') return 'Cyber'
  if (mode === 'automation') return 'Automação'
  if (mode === 'conversation') return 'Conversa'
  return 'Geral'
}

export function threadRoutingMetadataPatch(
  thread: AtlasAiThreadRoutingLike,
  routing: AtlasAiThreadRoutingState,
  options: ThreadRoutingMetadataOptions = {},
): Record<string, unknown> {
  const metadata = thread.metadata ?? {}
  const mode = routing.mode
  const focus = atlasAiFocusForRouting(routing)
  const now = options.now ?? new Date().toISOString()
  const source = options.source ?? 'atlas_ai_sheet'
  const initialMode = metadataString(metadata, 'initial_mode')
    ?? metadataString(metadata, 'atlas_mode')
    ?? atlasAiModeFromThread(thread)
  const initialFocus = metadataString(metadata, 'initial_focus')
    ?? metadataString(metadata, 'atlas_focus')
    ?? atlasAiFocusFromThread(thread)

  return {
    initial_mode: normalizeAtlasAiMode(initialMode, mode),
    current_mode: mode,
    atlas_mode: mode,
    mode_history: appendRoutingHistory(metadata.mode_history, mode, now, routing, source),
    initial_focus: normalizeAtlasAiFocus(initialFocus, focus),
    current_focus: focus,
    atlas_focus: focus,
    focus_history: appendRoutingHistory(metadata.focus_history, focus, now, routing, source),
    routing_task: routing.task,
    routing_domain: routing.domain,
    routing_style: routing.style,
    requested_provider: providerFromRoutingExecutor(routing.executor),
    routing_updated_from: source,
    routing_updated_at: now,
  }
}

export function appendRoutingHistory(
  raw: unknown,
  value: string,
  changedAt: string,
  routing: AtlasAiThreadRoutingState,
  source = 'atlas_ai_sheet',
): Array<Record<string, unknown>> {
  const history = (Array.isArray(raw) ? raw : [])
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object' && !Array.isArray(item))
    .slice(-11)
  const last = history[history.length - 1]

  if (last && last.value === value) return history

  return [
    ...history,
    {
      value,
      changed_at: changedAt,
      source,
      task: routing.task,
      domain: routing.domain,
      executor: routing.executor,
      style: routing.style,
    },
  ]
}

function providerFromRoutingExecutor(executor: AtlasAiRoutingExecutor): string | null {
  if (executor === 'hermes_cli') return 'hermes_cli'
  if (executor === 'minimax_m27_cli') return 'minimax_m27_cli'
  if (executor === 'claude_cli') return 'claude_cli'
  if (executor === 'codex_cli') return 'codex_cli'
  if (executor === 'gemini_cli') return 'gemini_cli'
  if (executor === 'claude_codex') return 'claude_codex'
  return null
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}
