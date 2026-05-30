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

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import {
  ATLAS_LOOP_DEFAULT_AREA,
  ATLAS_LOOP_DEFAULT_FOCUS,
  fetchAtlasLoopCycles,
  fetchAtlasLoopLive,
  sendAtlasLoopDirective,
  submitAtlasLoopOperatorDecision,
  submitAtlasLoopRunControl,
  type AtlasLoopCyclesResponse,
  type AtlasLoopDirectiveReceipt,
  type AtlasLoopLiveResponse,
  type AtlasLoopOperatorDecisionReceipt,
  type AtlasLoopRunControlResponse,
  type FetchAtlasLoopCyclesParams,
  type FetchAtlasLoopLiveParams,
  type SendAtlasLoopDirectiveInput,
  type SubmitAtlasLoopDecisionInput,
  type SubmitAtlasLoopRunControlInput,
} from '../api/client'

// Re-export the contract types so screen code can import everything Loop-related from one place.
export type {
  AtlasLoopCockpit,
  AtlasLoopCockpitHealth,
  AtlasLoopCycleOutcome,
  AtlasLoopCycleRecord,
  AtlasLoopCyclesResponse,
  AtlasLoopDirectiveConsumability,
  AtlasLoopDirectiveError,
  AtlasLoopDirectiveReceipt,
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
  AtlasLoopStewardshipRecovery,
  AtlasLoop24hObservability,
  FetchAtlasLoopCyclesParams,
  FetchAtlasLoopLiveParams,
  SendAtlasLoopDirectiveInput,
  SubmitAtlasLoopDecisionInput,
  SubmitAtlasLoopRunControlInput,
} from '../api/client'

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
  return useQuery({
    queryKey: loopLiveKey(params),
    queryFn: () => fetchAtlasLoopLive(params),
    enabled,
    refetchInterval: enabled ? pollIntervalMs : false,
    refetchIntervalInBackground: false,
    // Just under the poll interval: an in-flight window counts as fresh; a later mount refetches.
    staleTime: Math.max(0, pollIntervalMs - 1_000),
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
  return useQuery({
    queryKey: loopCyclesKey(params),
    queryFn: () => fetchAtlasLoopCycles(params),
    enabled,
    refetchInterval: enabled ? pollIntervalMs : false,
    refetchIntervalInBackground: false,
    staleTime: Math.max(0, pollIntervalMs - 1_000),
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
