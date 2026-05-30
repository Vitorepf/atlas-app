// Atlas Loop · paginated "show 5, load 5 more" windows for BACKLOG and DONE.
//
// Both new sections render a long-ish server collection (open findings; delivered
// cycles) under the LIST LAW: show 5, reveal 5 more at a time. These hooks marry
// the two existing pieces honestly:
//   • a react-query fetch hook (useLoopBacklog / useLoopDone) that pulls a
//     *server window* (offset 0, a growing limit) with the anti-flicker
//     select + keepPreviousData already wired on those hooks;
//   • the local useVisibleCount primitive that reveals the fetched window 5 rows
//     at a time, decoupled from polling.
//
// "Load more" first reveals the next 5 already in hand (instant, no network). Only
// when the local window reaches the fetched count AND the server says more exist
// do we grow the server limit by a page and let the next batch stream in. Nothing
// is ever fabricated: `total` is the server's real count, the rendered rows are a
// prefix of the real array, and `hasMore` is true only when more REAL rows exist
// (locally hidden or not-yet-fetched). placeholderData keeps the prior rows on
// screen while a larger page loads, so growing the window never blanks the list.

import { useCallback, useMemo, useState } from 'react'
import {
  useLoopBacklog,
  useLoopDone,
  type AtlasLoopBacklogFinding,
  type AtlasLoopBacklogResponse,
  type AtlasLoopCycleRecord,
  type AtlasLoopDoneResponse,
  type UseLoopBacklogOptions,
  type UseLoopDoneOptions,
} from './index'
import { LOOP_LIST_STEP, useVisibleCount } from './useVisibleCount'

/** How many rows we pull from the server per page. A multiple of the reveal step. */
const SERVER_PAGE = 50

export interface LoopPaginatedWindow<T> {
  /** The bounded slice to render right now (≤ shown ≤ fetched ≤ total). */
  items: T[]
  /** Server's real total for the collection (honest "de N"). */
  total: number
  /** How many rows are visible right now. */
  shown: number
  /** True while the FIRST page is loading (no data yet) — drives skeletons. */
  loading: boolean
  /** True on any in-flight fetch (drives the subtle refreshing tint). */
  refreshing: boolean
  /** True when growing the server window is in flight (loadMore pressed → fetch). */
  loadingMore: boolean
  /** True when more REAL rows exist (hidden locally or beyond the fetched page). */
  hasMore: boolean
  /** Reveal the next step (instant if already fetched; else grows the page). */
  loadMore: () => void
  /** Stable machine error code, or null. */
  reasonCode: string | null
  /** Per-section honesty: the read failed (not genuinely empty). */
  blocked: boolean
}

function reasonCodeFrom(error: unknown): string | null {
  if (error == null) return null
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status
    if (status === 404) return 'unknown_area'
    if (status === 0) return 'network'
    if (typeof status === 'number') return `http_${status}`
  }
  return 'network'
}

/**
 * BACKLOG window — open findings / to-implement, 5 at a time.
 * Composes useLoopBacklog (server page) + useVisibleCount (local reveal).
 */
export function useLoopBacklogWindow(
  options: Omit<UseLoopBacklogOptions, 'limit' | 'offset'> = {},
): LoopPaginatedWindow<AtlasLoopBacklogFinding> {
  const [pageLimit, setPageLimit] = useState(SERVER_PAGE)
  const query = useLoopBacklog({ ...options, limit: pageLimit, offset: 0 })

  const data: AtlasLoopBacklogResponse | undefined = query.data
  const fetched = useMemo<AtlasLoopBacklogFinding[]>(
    () => data?.findings?.items ?? [],
    [data],
  )
  const total = data?.findings?.total ?? fetched.length

  const win = useVisibleCount(fetched, { step: LOOP_LIST_STEP })

  return useBuildWindow({
    win,
    total,
    fetchedCount: fetched.length,
    pageLimit,
    setPageLimit,
    query,
  })
}

/**
 * DONE window — delivered cycles (real merges), newest-first, 5 at a time.
 * Composes useLoopDone (server page) + useVisibleCount (local reveal).
 */
export function useLoopDoneWindow(
  options: Omit<UseLoopDoneOptions, 'limit' | 'offset'> = {},
): LoopPaginatedWindow<AtlasLoopCycleRecord> {
  const [pageLimit, setPageLimit] = useState(SERVER_PAGE)
  const query = useLoopDone({ ...options, limit: pageLimit, offset: 0 })

  const data: AtlasLoopDoneResponse | undefined = query.data
  const fetched = useMemo<AtlasLoopCycleRecord[]>(() => data?.delivered ?? [], [data])
  const total = data?.delivered_total ?? fetched.length

  const win = useVisibleCount(fetched, { step: LOOP_LIST_STEP })

  return useBuildWindow({
    win,
    total,
    fetchedCount: fetched.length,
    pageLimit,
    setPageLimit,
    query,
  })
}

// --- shared assembly --------------------------------------------------------------

interface BuildWindowArgs<T> {
  win: ReturnType<typeof useVisibleCount<T>>
  total: number
  fetchedCount: number
  pageLimit: number
  setPageLimit: (next: number) => void
  query: {
    data: unknown
    isLoading: boolean
    isFetching: boolean
    isPlaceholderData: boolean
    error: unknown
  }
}

function useBuildWindow<T>(args: BuildWindowArgs<T>): LoopPaginatedWindow<T> {
  const { win, total, fetchedCount, pageLimit, setPageLimit, query } = args

  // First-load = fetching with no data yet. A background refetch never trips this.
  const loading = query.isLoading && query.data == null
  const refreshing = query.isFetching
  // We're enlarging the server window (placeholder keeps prior rows visible).
  const loadingMore = query.isFetching && query.isPlaceholderData && pageLimit > fetchedCount

  // More real rows exist if either the local window hides some, OR the server has
  // more than we've fetched. Honest: never true once everything real is shown.
  const moreFetchedLocally = win.hasMore
  const moreOnServer = fetchedCount < total
  const hasMore = moreFetchedLocally || moreOnServer

  const loadMore = useCallback(() => {
    // If there are still locally-fetched rows hidden, reveal them (no network).
    if (win.hasMore) {
      win.loadMore()
      return
    }
    // Otherwise grow the server page so the next batch streams in, then the
    // freshly-fetched rows fall inside the (already-advanced) local window.
    if (fetchedCount < total) {
      setPageLimit(Math.min(total, pageLimit + SERVER_PAGE))
      win.loadMore()
    }
  }, [win, fetchedCount, total, pageLimit, setPageLimit])

  const reasonCode = reasonCodeFrom(query.error)

  return {
    items: win.items,
    total,
    shown: win.shown,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    loadMore,
    reasonCode,
    blocked: reasonCode !== null && query.data == null,
  }
}
