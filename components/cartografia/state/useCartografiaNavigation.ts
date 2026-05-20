/**
 * Cartografia · navegação canon.
 *
 * Maquina simples:
 *   universe → flow (tap em continente atlas)
 *   flow     → universe (back-to-universe)
 *   flow     → gear/subflow (tap em peça pipeline · roadmap próximo)
 *
 * Portado do desktop · `useCartografiaNavigation.ts`. Mantém ids
 * canônicos (`pipe-N`, `lane-X`, `mb-Y`...) pra ficar pronto pra plug
 * com `/atlas-cartography/graph` real.
 */
import { useCallback, useState } from 'react'

export type CartografiaView = 'universe' | 'flow' | 'gear' | 'subflow'

export interface CartografiaNavigation {
  view: CartografiaView
  continent: string | null
  focusedId: string | null
  enterContinent: (id: string) => void
  enterFocus: (id: string) => void
  exitFocus: () => void
  backToUniverse: () => void
  enterSubflow: (id: string) => void
  exitSubflow: () => void
}

export function useCartografiaNavigation(): CartografiaNavigation {
  const [view, setView] = useState<CartografiaView>('universe')
  const [continent, setContinent] = useState<string | null>(null)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const enterContinent = useCallback((id: string) => {
    setContinent(id)
    // Atlas tem flow scene canon · outros continentes vão pra flow simples
    // (mesma cena, dados diferentes · roadmap próximo)
    setView('flow')
    setFocusedId(null)
  }, [])

  const enterFocus = useCallback((id: string) => {
    setFocusedId(id)
  }, [])

  const exitFocus = useCallback(() => {
    setFocusedId(null)
  }, [])

  const backToUniverse = useCallback(() => {
    setView('universe')
    setContinent(null)
    setFocusedId(null)
  }, [])

  const enterSubflow = useCallback((id: string) => {
    setFocusedId(id)
    setView('subflow')
  }, [])

  const exitSubflow = useCallback(() => {
    setView('flow')
    setFocusedId(null)
  }, [])

  return {
    view,
    continent,
    focusedId,
    enterContinent,
    enterFocus,
    exitFocus,
    backToUniverse,
    enterSubflow,
    exitSubflow,
  }
}
