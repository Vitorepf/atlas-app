// Atlas Loop · tiny local fold state (the CONFIANÇA disclosure, and reusable).
//
// Pure local UI state — never touches a query or the network. Used by TrustFold
// to collapse the trust colophon under a one-line "confiança ……" row so it is
// not a top-level hero on first paint.

import { useCallback, useState } from 'react'

export interface Expandable {
  open: boolean
  toggle: () => void
}

export function useExpandable(initial = false): Expandable {
  const [open, setOpen] = useState(initial)
  const toggle = useCallback(() => setOpen((v) => !v), [])
  return { open, toggle }
}
