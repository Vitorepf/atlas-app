/**
 * Atlas Patamar 4 · Mobile · React hook.
 *
 * Pattern paralelo ao desktop. Default poll 30_000 ms. Silent.
 */
import { useCallback, useEffect, useState } from 'react'
import { buildPatamar4View, type Patamar4View, type RawPatamar4State } from './patamar4State'
import { getAtlasPatamar4State } from './patamar4StateClient'

export type { Patamar4Status, Patamar4View, RawPatamar4State } from './patamar4State'
export { buildPatamar4View, patamar4StatusLabel } from './patamar4State'
export { getAtlasPatamar4State } from './patamar4StateClient'

interface UsePatamar4StateOptions {
  pollMs?: number
  enabled?: boolean
  tail?: number
}

export function usePatamar4State(options: UsePatamar4StateOptions = {}): Patamar4View {
  const pollMs = options.pollMs ?? 30_000
  const enabled = options.enabled ?? true
  const tail = options.tail ?? 5

  const [raw, setRaw] = useState<RawPatamar4State | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const fetchOnce = useCallback(async () => {
    if (!enabled) return
    setIsFetching(true)
    try {
      const result = await getAtlasPatamar4State(tail)
      setRaw(result)
    } finally {
      setIsFetching(false)
      setIsLoaded(true)
    }
  }, [enabled, tail])

  useEffect(() => {
    let cancelled = false
    void fetchOnce()
    if (!enabled || pollMs <= 0)
      return () => {
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

  return buildPatamar4View(raw, isFetching, isLoaded, () => void fetchOnce())
}
