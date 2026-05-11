import { atlasStorage } from './storage'
import type {
  AtlasMemoryReviewQueue,
  AtlasTaskAgendaResponse,
} from './api/client'

const AGENDA_CACHE_KEY = 'atlas.edicao.agenda-cache.v1'
const MEMORY_REVIEW_CACHE_KEY = 'atlas.edicao.memory-review-cache.v1'

type CacheEnvelope<T> = {
  savedAt: string
  value: T
}

export function readCachedAgenda(): AtlasTaskAgendaResponse | null {
  return readCache<AtlasTaskAgendaResponse>(AGENDA_CACHE_KEY)
}

export function writeCachedAgenda(value: AtlasTaskAgendaResponse): void {
  writeCache(AGENDA_CACHE_KEY, value)
}

export function readCachedMemoryReviewQueue(): AtlasMemoryReviewQueue | null {
  return readCache<AtlasMemoryReviewQueue>(MEMORY_REVIEW_CACHE_KEY)
}

export function writeCachedMemoryReviewQueue(value: AtlasMemoryReviewQueue): void {
  writeCache(MEMORY_REVIEW_CACHE_KEY, value)
}

function readCache<T>(key: string): T | null {
  const raw = atlasStorage.getItemSync(key)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<CacheEnvelope<T>>
    return parsed && typeof parsed === 'object' && parsed.value ? parsed.value : null
  } catch {
    return null
  }
}

function writeCache<T>(key: string, value: T): void {
  try {
    atlasStorage.setItemSync(key, JSON.stringify({
      savedAt: new Date().toISOString(),
      value,
    } satisfies CacheEnvelope<T>))
  } catch {
    // Cache is only an instant-paint optimization; never block the screen.
  }
}
