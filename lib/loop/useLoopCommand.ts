// Atlas Loop Command · the single state owner for app/loop.tsx.
//
// This is a thin orchestration layer over the EXISTING react-query hooks in
// lib/loop/index.ts (useLoopState / useLoopCycles / useSubmitDecision /
// useRunControl / useSendDirective) — the QueryClient is configured once in
// app/_layout.tsx. It exposes the small surface the screen assembly expects:
// { live, cycles, loopState, loading, refreshing, window, setWindow, refresh,
//   decide, runControl, sendDirective, postedDirectives, busyAction,
//   lastReachability, reasonCode }.
//
// HONESTY is structural: nothing here fabricates a running loop. loopState is
// derived strictly from the re-read run_state + cockpit.health (deriveLoopState),
// run-control patches state ONLY from the TRUE response (the backend re-reads the
// signal files from disk), and a sent directive is locally prepended so the
// operator sees their just-sent order before the refetch — never optimistic-lying.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useShell } from '../../components/AtlasShell'
import { AtlasApiError } from '../api/client'
import {
  useLoopAreas,
  useLoopCycles,
  useLoopState,
  useRunControl,
  useSendDirective,
  useStartRun,
  useSubmitDecision,
  type AtlasLoopArea,
  type AtlasLoopCycleRecord,
  type AtlasLoopDirectiveConsumability,
  type AtlasLoopDirectiveReceipt,
  type AtlasLoopLiveResponse,
  type AtlasLoopOperatorDecisionReceipt,
  type AtlasLoopRiskLevel,
  type AtlasLoopRunControlAction,
  type AtlasLoopStartRunResponse,
} from './index'
import { ATLAS_LOOP_DEFAULT_AREA, ATLAS_LOOP_DEFAULT_FOCUS } from '../api/loopClient'
import { deriveLoopState, type LoopState } from '../../components/loop/loopTone'
import type { OperatorDecisionVerdict } from '../../components/loop/loopTypes'
import type { StartLifecycle } from '../../components/loop/RunPrimary'
import type { StartRunInput } from '../../components/loop/StartRunSheet'

export interface UseLoopCommandResult {
  live: AtlasLoopLiveResponse | null
  cycles: AtlasLoopCycleRecord[]
  /** Records returned for the current window (after hours filter + tail). */
  cyclesReturned: number
  /** Full ledger record count (honest "de N" — never implies more than exists). */
  cyclesTotal: number
  loopState: LoopState
  /** True on the very first load (no data yet) — drives "·····" placeholders. */
  loading: boolean
  /** True on any in-flight fetch (drives the RefreshControl tint). */
  refreshing: boolean
  /** Stable 404 reason code for the whole-surface blocked state. */
  reasonCode: string | null
  /** Per-section honesty: the cycles read failed (not genuinely empty). */
  cyclesBlocked: boolean
  cyclesReasonCode: string | null
  window: '24h' | 'all'
  setWindow: (w: '24h' | 'all') => void
  refresh: () => Promise<void>
  decide: (input: OperatorDecisionVerdict) => Promise<AtlasLoopOperatorDecisionReceipt>
  runControl: (action: AtlasLoopRunControlAction, reason?: string) => Promise<void>
  sendDirective: (body: {
    directive: string
    risk: AtlasLoopRiskLevel
    target_doc?: string
  }) => Promise<AtlasLoopDirectiveReceipt>
  postedDirectives: AtlasLoopDirectiveReceipt[]
  busyAction: AtlasLoopRunControlAction | null
  lastReachability: AtlasLoopDirectiveConsumability | null
  // --- start-run surface (net-new; degrades honestly when endpoints are absent) ---
  /** The registered run areas ([] when the endpoint 404s). */
  areas: AtlasLoopArea[]
  areasLoading: boolean
  areasError: string | null
  /** The registry default area id / focus the picker pre-selects. */
  defaultAreaId: string
  defaultFocus: string
  /** Resolved default area NAME for the RunPrimary idle sub-line (null while loading). */
  areaName: string | null
  /** false when /areas|/start-run is a stable 404 (net-new backend not yet published). */
  startSupported: boolean
  startUnsupportedCode: string | null
  /** Local Face-A′ lifecycle (idle|enqueued|queued_stale) — NEVER 'running'. */
  startState: StartLifecycle
  /** Enqueue the REAL loop. Returns the 202 receipt; throws AtlasApiError on 409/422. */
  startRun: (input: StartRunInput) => Promise<AtlasLoopStartRunResponse>
}

const OPERATOR_ACTOR = 'vitor'

/** How long Face A′ stays "enqueued · aguardando worker" before escalating to the stale caption. */
const START_QUEUED_STALE_MS = 30_000

export function useLoopCommand(): UseLoopCommandResult {
  const { showToast } = useShell()
  const [window, setWindow] = useState<'24h' | 'all'>('24h')
  const [postedDirectives, setPostedDirectives] = useState<AtlasLoopDirectiveReceipt[]>([])
  const [lastReachability, setLastReachability] = useState<AtlasLoopDirectiveConsumability | null>(null)
  const [busyAction, setBusyAction] = useState<AtlasLoopRunControlAction | null>(null)

  const liveQuery = useLoopState()
  const cyclesQuery = useLoopCycles({ tail: 20, hours: window === '24h' ? 24 : undefined })
  const areasQuery = useLoopAreas()

  const decideMutation = useSubmitDecision()
  const runControlMutation = useRunControl()
  const directiveMutation = useSendDirective()
  const startRunMutation = useStartRun()

  // Local Face-A′ lifecycle. A 202 sets 'enqueued'; it auto-clears once a real
  // live lock.held shows up (deriveLoopState flips to 'alive' → Face C), and a
  // bounded timer escalates it to 'queued_stale' if no worker has picked it up.
  // NEVER claims running — the lock is the only start truth.
  const [startState, setStartState] = useState<StartLifecycle>('idle')
  const enqueuedAtRef = useRef<number | null>(null)

  const live = liveQuery.data ?? null
  // Screen renders NEWEST-FIRST; the endpoint returns oldest->newest.
  const cycles = useMemo(() => {
    const arr = cyclesQuery.data?.cycles ?? []
    return [...arr].reverse()
  }, [cyclesQuery.data])
  const cyclesReturned = cyclesQuery.data?.returned_count ?? cycles.length
  const cyclesTotal = cyclesQuery.data?.ledger_record_count_total ?? cyclesReturned

  // First-load (no data yet) vs background refetch.
  const loading = (liveQuery.isLoading && live === null) || (cyclesQuery.isLoading && cyclesQuery.data == null)
  const refreshing = liveQuery.isFetching || cyclesQuery.isFetching

  // Honest reason code: a stable 404 (unknown area) vs a transport failure.
  const reasonCode = useMemo(() => {
    const err = liveQuery.error
    if (err == null) return null
    if (err instanceof AtlasApiError) {
      if (err.status === 404) {
        const payload = err.payload as { error?: { code?: string } } | null
        return payload?.error?.code ?? 'unknown_area'
      }
      return err.status === 0 ? 'network' : `http_${err.status}`
    }
    return 'network'
  }, [liveQuery.error])

  // Per-section: cycles failed independently (live may still be fine).
  const cyclesReasonCode = useMemo(() => {
    const err = cyclesQuery.error
    if (err == null) return null
    if (err instanceof AtlasApiError) {
      if (err.status === 404) return 'unknown_area'
      return err.status === 0 ? 'network' : `http_${err.status}`
    }
    return 'network'
  }, [cyclesQuery.error])
  const cyclesBlocked = cyclesReasonCode !== null && (cyclesQuery.data?.cycles ?? null) === null

  // THE single truth. live===null after a settled fetch -> 'no_signal' (blocked).
  const loopState: LoopState = useMemo(() => {
    if (live === null && liveQuery.error != null) return 'no_signal'
    return deriveLoopState(live, loading)
  }, [live, liveQuery.error, loading])

  // --- areas + start-run surface (net-new; honest 404 degrade) -------------------
  const areas = areasQuery.data?.areas ?? []
  const defaultAreaId = areasQuery.data?.default_area ?? ATLAS_LOOP_DEFAULT_AREA
  const defaultFocus = areasQuery.data?.default_focus ?? ATLAS_LOOP_DEFAULT_FOCUS
  const areaName = useMemo(() => {
    if (areasQuery.isLoading && areasQuery.data == null) return null
    const chosen = areas.find((a) => a.area_id === defaultAreaId) ?? areas[0] ?? null
    return chosen?.area_name ?? defaultAreaId
  }, [areas, defaultAreaId, areasQuery.isLoading, areasQuery.data])
  const areasLoading = areasQuery.isLoading && areasQuery.data == null

  // The areas endpoint is the cheap canary for whether the net-new backend is
  // published. A stable 404 there => start-run is also absent => degrade honestly.
  const areasReason = useMemo(() => reasonFrom(areasQuery.error), [areasQuery.error])
  const startUnsupportedCode = areasReason
  const startSupported = !(areasQuery.error instanceof AtlasApiError && areasQuery.error.status === 404)
  const areasError = areasReason

  // Auto-clear / escalate the Face-A′ lifecycle from the REAL live lock.
  const lockHeld = live?.run_state?.lock?.held === true && live?.run_state?.lock?.orphaned !== true
  useEffect(() => {
    if (startState === 'idle') return
    if (lockHeld) {
      // The worker picked it up — the bar flips to Face C via loopState; clear A′.
      setStartState('idle')
      enqueuedAtRef.current = null
      return
    }
    // Not held yet — escalate to the stale caption after the bounded TTL.
    const startedAt = enqueuedAtRef.current
    if (startedAt == null) return
    const elapsed = Date.now() - startedAt
    if (elapsed >= START_QUEUED_STALE_MS) {
      if (startState !== 'queued_stale') setStartState('queued_stale')
      return
    }
    const t = setTimeout(() => setStartState('queued_stale'), START_QUEUED_STALE_MS - elapsed)
    return () => clearTimeout(t)
  }, [startState, lockHeld, live])

  const refresh = useCallback(async () => {
    await Promise.all([liveQuery.refetch(), cyclesQuery.refetch()])
  }, [liveQuery, cyclesQuery])

  const decide = useCallback(
    async (input: OperatorDecisionVerdict): Promise<AtlasLoopOperatorDecisionReceipt> => {
      // The mutation invalidates live + cycles on success -> surface re-reads truth.
      return decideMutation.mutateAsync({
        decision: input.decision,
        operator_actor: OPERATOR_ACTOR,
        finding_hash: input.findingHash,
        inbox_item_id: input.inboxItemId,
        work_order_id: input.workOrderId,
        evidence_pack_hash: input.evidencePackHash,
        rationale: input.rationale,
        risk: input.risk,
      })
    },
    [decideMutation],
  )

  const runControl = useCallback(
    async (action: AtlasLoopRunControlAction, reason?: string): Promise<void> => {
      setBusyAction(action)
      try {
        await runControlMutation.mutateAsync({
          action,
          operator_actor: OPERATOR_ACTOR,
          reason,
        })
        // The mutation invalidated live; re-read the TRUE on-disk post-state.
        await liveQuery.refetch()
        showToast(controlToast(action))
      } catch {
        // Never wishful state: re-fetch truth and surface an honest failure.
        await liveQuery.refetch()
        showToast('Não consegui aplicar o sinal — estado inalterado')
      } finally {
        setBusyAction(null)
      }
    },
    [runControlMutation, liveQuery, showToast],
  )

  const sendDirective = useCallback(
    async (body: {
      directive: string
      risk: AtlasLoopRiskLevel
      target_doc?: string
    }): Promise<AtlasLoopDirectiveReceipt> => {
      const receipt = await directiveMutation.mutateAsync({
        directive: body.directive,
        operator_actor: OPERATOR_ACTOR,
        focus: 'dev_forge',
        risk: body.risk,
        target_doc: body.target_doc,
      })
      // Prepend locally so the operator sees their just-sent order pre-refetch.
      setPostedDirectives((prev) => [receipt, ...prev])
      setLastReachability(receipt.to_make_loop_consumable)
      showToast('Diretiva registrada na caixa operacional')
      return receipt
    },
    [directiveMutation, showToast],
  )

  const startRun = useCallback(
    async (input: StartRunInput): Promise<AtlasLoopStartRunResponse> => {
      // Map the UI choice → the honest backend body. execute is the destructive
      // real path; dry_run only ensaios. The mutation invalidates live so /live
      // begins polling for lock.held (the only start truth).
      const receipt = await startRunMutation.mutateAsync({
        area: input.area,
        operator_actor: OPERATOR_ACTOR,
        focus: 'dev_forge',
        mode: input.execute ? 'execute' : 'dry_run',
        // single → cap at one cycle; until-blocked → leave max_cycles unset so the
        // runner's own backlog/stop-condition governance decides when to stop.
        max_cycles: input.mode === 'single' ? 1 : undefined,
        auto_merge: false,
        scope_profile: 'factory_max',
      })
      // 202 status:'enqueued' (NEVER 'running') → enter Face A′. The bar flips to
      // Face C only on a real lock.held (handled by the lifecycle effect).
      enqueuedAtRef.current = Date.now()
      setStartState('enqueued')
      showToast('Run enfileirado, não iniciado. Começa quando um worker pegar a fila.')
      return receipt
    },
    [startRunMutation, showToast],
  )

  return {
    live,
    cycles,
    cyclesReturned,
    cyclesTotal,
    loopState,
    loading,
    refreshing,
    reasonCode,
    cyclesBlocked,
    cyclesReasonCode,
    window,
    setWindow,
    refresh,
    decide,
    runControl,
    sendDirective,
    postedDirectives,
    busyAction,
    lastReachability,
    areas,
    areasLoading,
    areasError,
    defaultAreaId,
    defaultFocus,
    areaName,
    startSupported,
    startUnsupportedCode,
    startState,
    startRun,
  }
}

/** Honest machine reason for an areas/start error (404 unknown vs transport). */
function reasonFrom(error: unknown): string | null {
  if (error == null) return null
  if (error instanceof AtlasApiError) {
    if (error.status === 404) return 'http_404'
    return error.status === 0 ? 'network' : `http_${error.status}`
  }
  return 'network'
}

function controlToast(action: AtlasLoopRunControlAction): string {
  switch (action) {
    case 'kill':
      return 'Kill enviado. Loop encerra no próximo limite.'
    case 'clear-kill':
      return 'Encerramento liberado. Loop pode reiniciar.'
    case 'pause':
      return 'Pausa enviada. Loop honra no próximo limite.'
    case 'resume':
      return 'Retomada enviada. Loop honra no próximo limite.'
  }
}
