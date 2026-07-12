import type { AtlasAiThread, AtlasAiTrace } from '../../../lib/api/client'
import { MODE_OPTIONS } from '../../../lib/atlasAi/contract'
import { atlasAiContextLabel } from '../../../lib/atlasAiFocus'
import {
  atlasAiModeLabel,
  atlasAiModeFromThread,
  type AtlasAiThreadRoutingState,
} from '../../../lib/atlasAiThreadRouting'

export type ThreadHistoryModeFilter = 'all' | AtlasAiThreadRoutingState['mode']

export type MetaDiversity = {
  showMode: boolean
  showOrigin: boolean
  showProvider: boolean
}

export type ThreadGroupKey = 'today' | 'yesterday' | 'thisWeek' | 'older'

export const THREAD_GROUP_LABELS: Record<ThreadGroupKey, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  thisWeek: 'Esta semana',
  older: 'Mais antigas',
}

const WEEKDAYS_PT_BR = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const
const MONTHS_PT_BR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const

export function threadIsCli(thread: AtlasAiThread): boolean {
  const surface = (thread.surface ?? '').toLowerCase()
  return surface === 'cli' || surface === 'atlas_cli' || surface === 'manual'
}

export function threadIsRecentlyActive(thread: AtlasAiThread): boolean {
  const lastActivity = thread.last_message_at ?? thread.updated_at
  if (!lastActivity) return false
  const lastTs = new Date(lastActivity).getTime()
  if (!Number.isFinite(lastTs)) return false
  return Date.now() - lastTs < 30 * 60 * 1000
}

export function compactThreadWorkspace(thread: AtlasAiThread): string | null {
  const label = atlasAiContextLabel(thread)
  if (!label) return null
  return label
    .replace(/^Workspace - /, '')
    .replace(/^\/Users\/[^/]+/, '~')
}

export function shortWorkspace(thread: AtlasAiThread): string | null {
  if (!threadIsCli(thread)) return null

  const label = atlasAiContextLabel(thread)
  if (!label) return null
  const cleaned = label.replace(/^Workspace - /, '').trim()
  if (cleaned === '~' || cleaned === '~/' || /^\/Users\/[^/]+\/?$/.test(cleaned) || /^~\/?$/.test(cleaned)) {
    return '(home)'
  }
  if (/^\/private\/var\/folders\//.test(cleaned) || /\/tmp\.[A-Za-z0-9]+/.test(cleaned)) {
    return '(sandbox)'
  }
  const segments = cleaned.replace(/^~\//, '').replace(/^\/+/, '').split('/').filter(Boolean)
  if (segments.length === 0) return null
  const last = segments[segments.length - 1]
  if (!last || last.length < 2) return cleaned
  return last.toLowerCase()
}

export function formatHistoryTimestamp(input: string | null | undefined): string {
  if (!input) return ''
  const date = new Date(input)
  if (!Number.isFinite(date.getTime())) return ''

  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'ontem'

  const ageDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  if (ageDays < 7) return WEEKDAYS_PT_BR[date.getDay()]
  if (date.getFullYear() === now.getFullYear()) return `${date.getDate()} ${MONTHS_PT_BR[date.getMonth()]}`
  return `${MONTHS_PT_BR[date.getMonth()]} ${date.getFullYear()}`
}

export function threadGroupKey(thread: AtlasAiThread): ThreadGroupKey {
  const ts = thread.last_message_at ?? thread.updated_at
  if (!ts) return 'older'
  const date = new Date(ts)
  if (!Number.isFinite(date.getTime())) return 'older'

  const now = new Date()
  if (date.toDateString() === now.toDateString()) return 'today'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'yesterday'
  const ageDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  return ageDays < 7 ? 'thisWeek' : 'older'
}

export function computeMetaDiversity(threads: AtlasAiThread[]): MetaDiversity {
  if (threads.length < 2) {
    return { showMode: false, showOrigin: false, showProvider: false }
  }
  const modes = new Set<string>()
  const origins = new Set<string>()
  const providers = new Set<string>()
  for (const thread of threads) {
    modes.add(atlasAiModeFromThread(thread))
    origins.add(threadIsCli(thread) ? 'cli' : 'manual')
    providers.add(providerWord(thread.last_provider) ?? 'atlas')
  }
  return {
    showMode: modes.size > 1,
    showOrigin: origins.size > 1,
    showProvider: providers.size > 1,
  }
}

export function threadActiveDuration(thread: AtlasAiThread): string {
  const start = thread.created_at ?? thread.last_message_at
  if (!start) return '? min'
  const startMs = new Date(start).getTime()
  if (!Number.isFinite(startMs)) return '? min'
  const min = Math.max(1, Math.floor((Date.now() - startMs) / 60000))
  if (min < 60) return `${min} min`
  const hours = Math.floor(min / 60)
  return `${hours}h ${min % 60}m`
}

export function filterThreads(threads: AtlasAiThread[], query: string): AtlasAiThread[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return threads

  return threads.filter((thread) => {
    const haystack = [
      thread.title,
      thread.summary,
      thread.active_state?.current_topic,
      thread.active_state?.objective,
      providerWord(thread.last_provider),
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(needle)
  })
}

export function threadHistoryModeOptions(
  threads: AtlasAiThread[],
): Array<{ key: ThreadHistoryModeFilter; label: string; caption: string; count: number }> {
  const counts = new Map<AtlasAiThreadRoutingState['mode'], number>()

  for (const thread of threads) {
    const mode = atlasAiModeFromThread(thread)
    counts.set(mode, (counts.get(mode) ?? 0) + 1)
  }

  const pinnedModes: AtlasAiThreadRoutingState['mode'][] = ['general', 'operational', 'programming']
  const modes = MODE_OPTIONS
    .map((option) => option.value)
    .filter((mode) => pinnedModes.includes(mode) || (counts.get(mode) ?? 0) > 0)

  return [
    { key: 'all', label: 'Tudo', caption: 'todas as conversas', count: threads.length },
    ...modes.map((mode) => ({
      key: mode,
      label: atlasAiModeLabel(mode),
      caption: MODE_OPTIONS.find((option) => option.value === mode)?.sub ?? atlasAiModeLabel(mode),
      count: counts.get(mode) ?? 0,
    })),
  ]
}

export function providerWord(provider: AtlasAiTrace['provider'] | undefined): string | undefined {
  if (provider === 'claude_codex') return 'conselho'
  if (provider === 'hermes_cli') return 'hermes'
  if (provider === 'minimax_m27_cli') return 'minimax m3'
  if (provider === 'claude_cli') return 'claude'
  if (provider === 'codex_cli') return 'codex'
  if (provider === 'gemini_cli') return 'gemini'
  if (typeof provider === 'string' && provider.trim()) return provider.replace(/_cli$/, '').replace(/_/g, ' ')
  return undefined
}
