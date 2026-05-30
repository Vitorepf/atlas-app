// Atlas Loop · LIST LAW primitive — "show 5, load 5 more".
//
// Every list on the Loop dossier obeys one law: render at most a small initial
// window (5) and let the operator reveal another step (5) at a time, so no
// section can dominate the reading or stutter under a long ledger. There was no
// reusable primitive for this in the app (only ad-hoc `slice(0, N)`), so this is
// it — a tiny, poll-independent hook plus a pure helper.
//
// CRITICAL (anti-flicker): the visible count is LOCAL component state, fully
// decoupled from the react-query polling cycle. A background refetch that
// returns the same `surface_hash` (and therefore the same stable reference) does
// NOT reset how much the operator has expanded — `visible` only ever changes
// when the operator presses "load more" or when the list shrinks below the
// current window (we clamp down so we never claim to show rows that no longer
// exist). It NEVER fabricates rows: it only ever caps a real array.

import { useCallback, useMemo, useState } from 'react'

export const LOOP_LIST_STEP = 5

/**
 * Pure window math (no React) — exported for unit tests and reuse. Given the real
 * `total`, the operator-requested `visible` count, and the `initial` floor,
 * returns how many to actually show. Clamps to [min(initial,total), total] and
 * collapses to 0 for an empty list. Deterministic: same inputs → same output.
 */
export function clampVisible(total: number, visible: number, initial: number): number {
  if (total <= 0) return 0
  const floor = Math.min(initial, total)
  const capped = Math.min(visible, total)
  return Math.min(Math.max(capped, floor), total)
}

export interface VisibleWindow<T> {
  /** The bounded slice to render (never longer than `total`). */
  items: T[]
  /** Real length of the underlying array (honest "de N"). */
  total: number
  /** How many are currently shown (== items.length). */
  shown: number
  /** True when more real rows exist beyond the window. */
  hasMore: boolean
  /** How many the next "load more" press will reveal (clamped to remaining). */
  nextStep: number
  /** Reveal the next step. No-op once everything is shown. */
  loadMore: () => void
  /** Collapse back to the initial window (e.g. on area switch). */
  reset: () => void
}

/**
 * Window a real array to a growable "first N, then +step" view. `step` and the
 * initial window both default to LOOP_LIST_STEP (5). Pure over `items`: the same
 * input array + same visible count always yields the same slice, so wrapping it
 * in this hook adds no churn of its own.
 */
export function useVisibleCount<T>(
  items: readonly T[],
  options: { step?: number; initial?: number } = {},
): VisibleWindow<T> {
  const step = options.step ?? LOOP_LIST_STEP
  const initial = options.initial ?? step
  const [visible, setVisible] = useState(initial)

  const total = items.length
  // Clamp: never report more shown than actually exist; if the list shrank below
  // the window keep at least the initial window so a re-grow doesn't snap to 1.
  const effectiveShown = clampVisible(total, visible, initial)

  const slice = useMemo(() => items.slice(0, effectiveShown) as T[], [items, effectiveShown])

  const loadMore = useCallback(() => {
    setVisible((v) => v + step)
  }, [step])

  const reset = useCallback(() => {
    setVisible(initial)
  }, [initial])

  const remaining = Math.max(total - effectiveShown, 0)

  return {
    items: slice,
    total,
    shown: effectiveShown,
    hasMore: remaining > 0,
    nextStep: Math.min(step, remaining),
    loadMore,
    reset,
  }
}
