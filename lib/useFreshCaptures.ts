import { useEffect, useState } from 'react'
import type { InboxItem } from '../components/InboxCard'

const FRESH_WINDOW_MS = 30_000

// Detecta capturas "frescas" (criadas nos últimos 30s) baseado em capturedAt real.
// Estado temporal · NÃO posicional · regra v6 (não confundir com "primeiro card").
//
// Atualiza a cada 5s pra cards saírem do estado fresh quando expirarem.
// Retorna Set de IDs frescos · usar em <InboxCard isFresh={fresh.has(item.id)} />
export function useFreshCaptures(items: InboxItem[]): Set<string> {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 5_000)
    return () => clearInterval(interval)
  }, [])

  const now = Date.now()
  const fresh = new Set<string>()
  for (const item of items) {
    if (!item.capturedAt) continue
    const ts = new Date(item.capturedAt).getTime()
    if (!Number.isFinite(ts)) continue
    if (now - ts <= FRESH_WINDOW_MS) {
      fresh.add(item.id)
    }
  }
  // tick é usado apenas pra forçar re-render periódico
  void tick
  return fresh
}
