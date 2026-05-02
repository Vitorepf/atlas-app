import type { AtlasEngineeringKnowledgeItemSummary } from './api/client'

type KnowledgeMeta = Pick<AtlasEngineeringKnowledgeItemSummary, 'category' | 'priority' | 'canonical_path'>

export function engineeringKnowledgeMetaLine(item: KnowledgeMeta): string {
  return `${item.category} · p${item.priority} · ${item.canonical_path}`
}

export function engineeringKnowledgeValuesLine(values: string[] | null | undefined, fallback = '-'): string {
  const clean = Array.from(new Set((values ?? [])
    .map((value) => value.trim())
    .filter(Boolean)))

  if (clean.length === 0) return fallback

  const visible = clean.slice(0, 3)
  const overflow = clean.length - visible.length

  return overflow > 0 ? `${visible.join(' · ')} +${overflow}` : visible.join(' · ')
}

export function engineeringKnowledgeBodyPreview(body: string | null | undefined, maxChars = 420): string {
  const clean = (body ?? '').replace(/\s+/g, ' ').trim()
  if (!clean) return 'Sem excerpt detalhado.'
  if (clean.length <= maxChars) return clean

  return `${clean.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`
}
