/**
 * Atlas AI · Mobile · hook React para Runtime Readiness Gate.
 *
 * Pattern paralelo ao desktop. Hook chama `getAtlasAiRuntimeReadiness()`
 * silent; expõe view-model canon via `buildRuntimeReadinessView`.
 *
 * Polling: opcional. Default 60_000 ms. Quando 0, busca uma vez no mount
 * + ao chamar `refresh()` manualmente.
 *
 * O builder puro vive em `runtimeReadiness.ts` para teste isolado sem
 * dependência de RN/Expo.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  buildRuntimeReadinessView,
  type AtlasAiRuntimeReadiness,
  type RuntimeReadinessView,
} from './runtimeReadiness'
import { getAtlasAiRuntimeReadiness } from './runtimeReadinessClient'

export type {
  AtlasAiRuntimeReadiness,
  AtlasAiRuntimeReadinessCheck,
  RuntimeReadinessStatus,
  RuntimeReadinessView,
} from './runtimeReadiness'

export { buildRuntimeReadinessView, statusLabelFor } from './runtimeReadiness'
export { getAtlasAiRuntimeReadiness } from './runtimeReadinessClient'

interface UseRuntimeReadinessOptions {
  /** Intervalo de re-poll em ms. 0 = sem polling. Default 60_000. */
  pollMs?: number
  /** Quando false, hook não faz fetch. Default true. */
  enabled?: boolean
}

export function useRuntimeReadiness(options: UseRuntimeReadinessOptions = {}): RuntimeReadinessView {
  const pollMs = options.pollMs ?? 60_000
  const enabled = options.enabled ?? true

  const [raw, setRaw] = useState<AtlasAiRuntimeReadiness | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const fetchOnce = useCallback(async () => {
    if (!enabled) return
    setIsFetching(true)
    try {
      const result = await getAtlasAiRuntimeReadiness()
      setRaw(result)
    } finally {
      setIsFetching(false)
      setIsLoaded(true)
    }
  }, [enabled])

  useEffect(() => {
    let cancelled = false
    void fetchOnce()
    if (!enabled || pollMs <= 0) return () => {
      cancelled = true
    }
    const timer = setInterval(() => {
      if (!cancelled) void fetchOnce()
    }, pollMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [fetchOnce, enabled, pollMs])

  return buildRuntimeReadinessView(raw, isFetching, isLoaded, () => void fetchOnce())
}
