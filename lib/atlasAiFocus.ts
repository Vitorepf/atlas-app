export const ATLAS_AI_FOCI = ['general', 'research', 'programming', 'operational', 'project', 'review'] as const

export type AtlasAiFocus = typeof ATLAS_AI_FOCI[number]

type ThreadLike = {
  title?: string | null
  source_type?: string | null
  workspace?: string | null
  metadata?: Record<string, unknown> | null
}

const FOCUS_LABELS: Record<AtlasAiFocus, string> = {
  general: 'Geral',
  research: 'Pesquisa',
  programming: 'Programacao',
  operational: 'Operacional',
  project: 'Projeto',
  review: 'Revisao',
}

export function normalizeAtlasAiFocus(value: unknown, fallback: AtlasAiFocus = 'general'): AtlasAiFocus {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase().replace(/-/g, '_')
  if (normalized === 'coding' || normalized === 'engineering') return 'programming'
  if (normalized === 'operations') return 'operational'
  if (normalized === 'conversation') return 'general'
  return (ATLAS_AI_FOCI as readonly string[]).includes(normalized) ? normalized as AtlasAiFocus : fallback
}

export function atlasAiFocusFromThread(thread: ThreadLike | null | undefined): AtlasAiFocus {
  const metadata = thread?.metadata ?? {}
  if (thread?.source_type === 'inbox_item' || thread?.source_type === 'ai_inbox_item') {
    return normalizeAtlasAiFocus(metadata.atlas_focus, 'operational')
  }
  return normalizeAtlasAiFocus(metadata.atlas_focus ?? metadata.initial_focus, 'general')
}

export function atlasAiFocusLabel(focus: AtlasAiFocus): string {
  return FOCUS_LABELS[focus]
}

export function atlasAiContextLabel(thread: ThreadLike | null | undefined): string | null {
  const metadata = thread?.metadata ?? {}
  const explicit = firstString(
    metadata.context_label,
    metadata.context_title,
    metadata.source_label,
    metadata.context_source_label,
  )
  if (explicit) return explicit

  if (thread?.source_type === 'inbox_item' || thread?.source_type === 'ai_inbox_item') {
    return thread.title ? `Inbox - ${thread.title}` : 'Inbox operacional'
  }

  if (thread?.workspace) return `Workspace - ${thread.workspace}`
  return null
}

export function atlasAiContextMeta(thread: ThreadLike | null | undefined): string | null {
  const metadata = thread?.metadata ?? {}
  const refs = [
    metadata.context_bundle_id ? 'contexto auditavel' : null,
    metadata.permission_policy ? 'permissao controlada' : null,
    metadata.execution_policy ? 'execucao segura' : null,
  ].filter((part): part is string => typeof part === 'string')

  return refs.length > 0 ? refs.join(' - ') : null
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  }
  return null
}
