// Atlas Loop Command Surface · react-query hooks.
//
// Thin react-query (v5) layer over lib/api/loopClient. The QueryClient is configured once in
// app/_layout.tsx (staleTime 30s, gcTime 5min, refetchOnWindowFocus false, refetchOnReconnect
// 'always', retry 1); these hooks override only what the Loop needs.
//
// READ hooks poll the live/cycles read models on a short interval so the operator sees the loop
// move in near-real time. The backend stamps an ETag over a timestamp-stripped surface_hash and
// answers 304 when nothing changed, so polling is cheap; staleTime is kept just under the poll
// interval so a focus/mount doesn't double-fetch. MUTATION hooks wrap the POST endpoints and
// invalidate the live + cycles queries so the surface re-reads true post-state from disk.
//
// Honesty is structural, not cosmetic: nothing here fabricates a running loop. The hooks return
// exactly what the backend reports (lock.held, outcome counts, merge_performed, the always-false
// directive consumability flag). Distinguishing an unknown-area 404 from a transport failure is
// left to the screen via AtlasApiError.status — these hooks never swallow that signal.

import { useCallback, useRef } from 'react'
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { nextStableRef, type HasSurfaceHash } from './stableRef'
import {
  ATLAS_LOOP_DEFAULT_AREA,
  ATLAS_LOOP_DEFAULT_FOCUS,
  fetchAtlasLoopAreas,
  fetchAtlasLoopBacklog,
  fetchAtlasLoopCycles,
  fetchAtlasLoopDone,
  fetchAtlasLoopLive,
  sendAtlasLoopDirective,
  startAtlasLoopRun,
  submitAtlasLoopOperatorDecision,
  submitAtlasLoopRunControl,
  type AtlasLoopAreasResponse,
  type AtlasLoopBacklogResponse,
  type AtlasLoopCyclesResponse,
  type AtlasLoopDirectiveReceipt,
  type AtlasLoopDoneResponse,
  type AtlasLoopLiveResponse,
  type AtlasLoopOperatorDecisionReceipt,
  type AtlasLoopRunControlResponse,
  type AtlasLoopStartRunResponse,
  type FetchAtlasLoopBacklogParams,
  type FetchAtlasLoopCyclesParams,
  type FetchAtlasLoopDoneParams,
  type FetchAtlasLoopLiveParams,
  type SendAtlasLoopDirectiveInput,
  type StartAtlasLoopRunInput,
  type SubmitAtlasLoopDecisionInput,
  type SubmitAtlasLoopRunControlInput,
} from '../api/loopClient'

// Re-export the contract types so screen code can import everything Loop-related from one place.
export type {
  AtlasLoopArea,
  AtlasLoopAreasResponse,
  AtlasLoopBacklogFinding,
  AtlasLoopBacklogResponse,
  AtlasLoopCockpit,
  AtlasLoopCockpitHealth,
  AtlasLoopCycleOutcome,
  AtlasLoopCycleRecord,
  AtlasLoopCyclesResponse,
  AtlasLoopDirectiveConsumability,
  AtlasLoopDirectiveError,
  AtlasLoopDirectiveReceipt,
  AtlasLoopDoneResponse,
  AtlasLoopLiveResponse,
  AtlasLoopLockHolder,
  AtlasLoopLockStatus,
  AtlasLoopOperatorDecision,
  AtlasLoopOperatorDecisionError,
  AtlasLoopOperatorDecisionReceipt,
  AtlasLoopRiskLevel,
  AtlasLoopRunControlAction,
  AtlasLoopRunControlResponse,
  AtlasLoopRunState,
  AtlasLoopSchedulerBacklog,
  AtlasLoopSchedulerCycleSummary,
  AtlasLoopSignalStatus,
  AtlasLoopStartRunBlocked,
  AtlasLoopStartRunError,
  AtlasLoopStartRunMode,
  AtlasLoopStartRunResponse,
  AtlasLoopStewardshipRecovery,
  AtlasLoop24hObservability,
  FetchAtlasLoopBacklogParams,
  FetchAtlasLoopCyclesParams,
  FetchAtlasLoopDoneParams,
  FetchAtlasLoopLiveParams,
  SendAtlasLoopDirectiveInput,
  StartAtlasLoopRunInput,
  SubmitAtlasLoopDecisionInput,
  SubmitAtlasLoopRunControlInput,
} from '../api/loopClient'

// --- query keys -----------------------------------------------------------------

/** Live state key, scoped by area/focus/portfolio/repo_root so distinct scopes never collide. */
function loopLiveKey(params: FetchAtlasLoopLiveParams) {
  return [
    'atlas-loop',
    'live',
    params.area ?? ATLAS_LOOP_DEFAULT_AREA,
    params.focus ?? ATLAS_LOOP_DEFAULT_FOCUS,
    params.portfolio ?? null,
    params.repo_root ?? null,
  ] as const
}

/** Cycles key, scoped by area/focus/tail/hours. */
function loopCyclesKey(params: FetchAtlasLoopCyclesParams) {
  return [
    'atlas-loop',
    'cycles',
    params.area ?? ATLAS_LOOP_DEFAULT_AREA,
    params.focus ?? ATLAS_LOOP_DEFAULT_FOCUS,
    params.tail ?? null,
    params.hours ?? null,
  ] as const
}

/** Broad prefix used by mutations to invalidate every live + cycles query at once. */
const LOOP_QUERY_ROOT = ['atlas-loop'] as const

// --- stable-reference select (flicker fix #2) ------------------------------------

/**
 * Build a react-query `select` that collapses identity churn to the STABLE
 * `surface_hash`. The backend stamps a volatile `generated_at` AFTER computing
 * the hash (the hash is taken over the body minus every `generated_at`), so two
 * polls that differ only by timestamp share one `surface_hash`. react-query's
 * structural sharing alone can't see that — `generated_at` is a real string diff
 * — so it produces a new top-level reference every tick and the screen blinks.
 *
 * This select holds the last {hash,value} in a ref: same hash ⇒ return the exact
 * SAME object reference as last time (identity stable → memoized children skip
 * re-render → mount-only `entering` animations never re-fire). A changed hash ⇒
 * return the new value (and remember it). The select itself is referentially
 * stable across renders (useCallback over a ref) so react-query doesn't re-run
 * it spuriously. It NEVER mutates or fabricates data — it only chooses which of
 * two structurally-equal references to surface.
 */
function useStableByHash<T extends HasSurfaceHash>(): (data: T) => T {
  const last = useRef<{ hash: string; value: T } | null>(null)
  return useCallback((data: T): T => {
    const picked = nextStableRef(last.current, data)
    last.current = picked
    return picked.value
  }, [])
}

// --- read hooks -----------------------------------------------------------------

export interface UseLoopStateOptions extends FetchAtlasLoopLiveParams {
  /** Gate fetching (e.g. only while the screen is focused/visible). Defaults to true. */
  enabled?: boolean
  /** Poll cadence in ms. Defaults to 6000 (within the contract's ~5-8s window). */
  pollIntervalMs?: number
}

/**
 * Live loop state, polled on a short interval. staleTime is set just under the poll interval so
 * an interval tick is always treated as fresh-enough to skip a redundant refetch, while a real
 * mount/focus after the window still refetches. Polling continues only while the tab is active
 * (refetchIntervalInBackground stays false) to respect battery on mobile.
 */
export function useLoopState(options: UseLoopStateOptions = {}): UseQueryResult<AtlasLoopLiveResponse> {
  const { enabled = true, pollIntervalMs = 6_000, ...params } = options
  const select = useStableByHash<AtlasLoopLiveResponse>()
  return useQuery({
    queryKey: loopLiveKey(params),
    queryFn: () => fetchAtlasLoopLive(params),
    enabled,
    refetchInterval: enabled ? pollIntervalMs : false,
    refetchIntervalInBackground: false,
    // Just under the poll interval: an in-flight window counts as fresh; a later mount refetches.
    staleTime: Math.max(0, pollIntervalMs - 1_000),
    // Collapse generated_at churn to the stable surface_hash → no per-poll blink.
    select,
    // Background refetch keeps the last good frame visible — never blanks to a skeleton.
    placeholderData: keepPreviousData,
    // Unknown area is a stable 404 (operator config error), not a transient fault — don't retry it.
    retry: (failureCount, error) => !is404(error) && failureCount < 1,
  })
}

export interface UseLoopCyclesOptions extends FetchAtlasLoopCyclesParams {
  enabled?: boolean
  /** Poll cadence in ms. Defaults to 8000 (cycles change less often than live run-state). */
  pollIntervalMs?: number
}

/**
 * Cycle ledger tail, polled slightly slower than live state (cycles advance less frequently than
 * the lock/pause/kill run-state). Same staleTime-under-interval + no-retry-on-404 discipline.
 */
export function useLoopCycles(options: UseLoopCyclesOptions = {}): UseQueryResult<AtlasLoopCyclesResponse> {
  const { enabled = true, pollIntervalMs = 8_000, ...params } = options
  const select = useStableByHash<AtlasLoopCyclesResponse>()
  return useQuery({
    queryKey: loopCyclesKey(params),
    queryFn: () => fetchAtlasLoopCycles(params),
    enabled,
    refetchInterval: enabled ? pollIntervalMs : false,
    refetchIntervalInBackground: false,
    staleTime: Math.max(0, pollIntervalMs - 1_000),
    select,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => !is404(error) && failureCount < 1,
  })
}

/**
 * The selectable run areas (AP-712 registry). v1 has exactly one. This rarely changes, so it is NOT
 * polled — fetched once with a long staleTime; the run picker reads it on mount.
 */
export function useLoopAreas(options: { enabled?: boolean } = {}): UseQueryResult<AtlasLoopAreasResponse> {
  const { enabled = true } = options
  const select = useStableByHash<AtlasLoopAreasResponse>()
  return useQuery({
    queryKey: ['atlas-loop', 'areas'] as const,
    queryFn: () => fetchAtlasLoopAreas(),
    enabled,
    staleTime: 5 * 60_000,
    select,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => !is404(error) && failureCount < 1,
  })
}

export interface UseLoopBacklogOptions extends FetchAtlasLoopBacklogParams {
  enabled?: boolean
  /** Poll cadence in ms. Defaults to 12000 (backlog drifts slowly). */
  pollIntervalMs?: number
}

/**
 * The open findings / to-implement backlog for an area (thin cockpit projection). Polled slowly —
 * the backlog moves only when the loop or a scan changes it. Same no-retry-on-404 discipline.
 */
export function useLoopBacklog(options: UseLoopBacklogOptions = {}): UseQueryResult<AtlasLoopBacklogResponse> {
  const { enabled = true, pollIntervalMs = 12_000, ...params } = options
  const select = useStableByHash<AtlasLoopBacklogResponse>()
  return useQuery({
    queryKey: [
      'atlas-loop',
      'backlog',
      params.area ?? ATLAS_LOOP_DEFAULT_AREA,
      params.focus ?? ATLAS_LOOP_DEFAULT_FOCUS,
      params.limit ?? null,
      params.offset ?? null,
    ] as const,
    queryFn: () => fetchAtlasLoopBacklog(params),
    enabled,
    refetchInterval: enabled ? pollIntervalMs : false,
    refetchIntervalInBackground: false,
    staleTime: Math.max(0, pollIntervalMs - 1_000),
    select,
    // Paging keeps the prior page visible while the next loads (no blank flash).
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => !is404(error) && failureCount < 1,
  })
}

export interface UseLoopDoneOptions extends FetchAtlasLoopDoneParams {
  enabled?: boolean
  /** Poll cadence in ms. Defaults to 12000 (a new delivery is rare). */
  pollIntervalMs?: number
}

/**
 * Delivered cycles (real merges with a merge_hash), newest-first. Polled slowly; a delivery is rare.
 */
export function useLoopDone(options: UseLoopDoneOptions = {}): UseQueryResult<AtlasLoopDoneResponse> {
  const { enabled = true, pollIntervalMs = 12_000, ...params } = options
  const select = useStableByHash<AtlasLoopDoneResponse>()
  return useQuery({
    queryKey: [
      'atlas-loop',
      'done',
      params.area ?? ATLAS_LOOP_DEFAULT_AREA,
      params.focus ?? ATLAS_LOOP_DEFAULT_FOCUS,
      params.limit ?? null,
      params.offset ?? null,
    ] as const,
    queryFn: () => fetchAtlasLoopDone(params),
    enabled,
    refetchInterval: enabled ? pollIntervalMs : false,
    refetchIntervalInBackground: false,
    staleTime: Math.max(0, pollIntervalMs - 1_000),
    select,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) => !is404(error) && failureCount < 1,
  })
}

// --- mutation hooks --------------------------------------------------------------

/**
 * Submit an operator decision (accept/reject/defer/request_changes). On success the live + cycles
 * queries are invalidated so the surface re-reads true state. The invariant is upstream: an accept
 * unlocks the next owner stage under review but NEVER executes — this hook persists the receipt only.
 */
export function useSubmitDecision(): UseMutationResult<
  AtlasLoopOperatorDecisionReceipt,
  unknown,
  SubmitAtlasLoopDecisionInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SubmitAtlasLoopDecisionInput) => submitAtlasLoopOperatorDecision(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LOOP_QUERY_ROOT })
    },
  })
}

/**
 * Pause/resume/kill/clear-kill the loop by flipping its own signal files. The response carries the
 * TRUE post-state re-read from disk; we still invalidate so any other reader of live state catches
 * up. honest-stop: this is a signal only — it never starts/stops a process or invokes a provider.
 */
export function useRunControl(): UseMutationResult<
  AtlasLoopRunControlResponse,
  unknown,
  SubmitAtlasLoopRunControlInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SubmitAtlasLoopRunControlInput) => submitAtlasLoopRunControl(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LOOP_QUERY_ROOT })
    },
  })
}

/**
 * Persist a natural-language directive into the real operational inbox as an operator-review item.
 * Invalidates live + cycles for consistency. The receipt is honest by construction:
 * loop_autonomously_consumable_now is always false — the inbox is not a loop finding source.
 */
export function useSendDirective(): UseMutationResult<
  AtlasLoopDirectiveReceipt,
  unknown,
  SendAtlasLoopDirectiveInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SendAtlasLoopDirectiveInput) => sendAtlasLoopDirective(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LOOP_QUERY_ROOT })
    },
  })
}

/**
 * Start the REAL reliable 24h loop for an area. HONESTY is structural: the backend ENQUEUES the
 * runner and returns status=enqueued — it NEVER claims the loop is running. The lock in /live is
 * the only truth it started, so on success we invalidate live (+ everything) to begin polling for
 * lock.held. A 409 (loop_already_running) or 422 surfaces as an AtlasApiError the caller handles;
 * the destructive `mode:'execute'` must be set explicitly by the caller (operator-confirmed).
 */
export function useStartRun(): UseMutationResult<
  AtlasLoopStartRunResponse,
  unknown,
  StartAtlasLoopRunInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: StartAtlasLoopRunInput) => startAtlasLoopRun(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LOOP_QUERY_ROOT })
    },
  })
}

// --- list-law re-exports ---------------------------------------------------------
// One import site for the screen: the LIST LAW primitive + the paginated windows.
export { clampVisible, LOOP_LIST_STEP, useVisibleCount, type VisibleWindow } from './useVisibleCount'
export {
  useLoopBacklogWindow,
  useLoopDoneWindow,
  type LoopPaginatedWindow,
} from './usePaginatedWindow'
export { nextStableRef, type HasSurfaceHash } from './stableRef'

// --- internal -------------------------------------------------------------------

/** True when the error is an AtlasApiError carrying HTTP 404 (unknown area — not transient). */
function is404(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === 404
  )
}
