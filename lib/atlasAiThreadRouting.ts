import {
  atlasAiFocusFromThread,
  normalizeAtlasAiFocus,
  type AtlasAiFocus,
} from './atlasAiFocus'
import type {
  AtlasAiMode,
  AtlasAiRoutingDomain,
  AtlasAiRoutingTask,
} from './atlasAiModeContract'

export type AtlasAiRoutingStyle = 'clear' | 'brief' | 'technical' | 'complete'
export type AtlasAiRoutingExecutor = 'auto' | 'claude_cli' | 'codex_cli' | 'gemini_cli' | 'claude_codex'

export interface AtlasAiThreadRoutingState {
  mode: AtlasAiMode
  task: AtlasAiRoutingTask
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
  if (routing.task === 'dev' || routing.task === 'debug') return 'programming'
  if (routing.task === 'review') return 'review'
  if (routing.task === 'plan') return 'project'
  if (routing.domain === 'vault-curador') return 'research'
  if (routing.domain === 'atlas') return 'operational'

  return 'general'
}

export function atlasAiModeFromThread(thread: AtlasAiThreadRoutingLike | null | undefined): AtlasAiMode {
  const metadata = thread?.metadata ?? {}
  const explicit = metadataString(metadata, 'current_mode') ?? metadataString(metadata, 'atlas_mode')
  if (explicit) return normalizeAtlasAiMode(explicit)

  const focus = atlasAiFocusFromThread(thread)
  if (focus === 'programming') return 'programming'
  if (focus === 'operational') return 'operational'
  return 'general'
}

export function normalizeAtlasAiMode(value: unknown, fallback: AtlasAiMode = 'general'): AtlasAiMode {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-\s]+/g, '_')
  if (normalized === 'programacao' || normalized === 'programming' || normalized === 'dev' || normalized === 'debug') return 'programming'
  if (normalized === 'operacional' || normalized === 'operational' || normalized === 'operations') return 'operational'
  if (normalized === 'geral' || normalized === 'general' || normalized === 'conversation') return 'general'
  return fallback
}

export function atlasAiModeLabel(mode: AtlasAiMode): string {
  if (mode === 'programming') return 'Programação'
  if (mode === 'operational') return 'Operacional'
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
