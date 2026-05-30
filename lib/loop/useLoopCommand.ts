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

import { useCallback, useMemo, useState } from 'react'
import { useShell } from '../../components/AtlasShell'
import { AtlasApiError } from '../api/client'
import {
  useLoopCycles,
  useLoopState,
  useRunControl,
  useSendDirective,
  useSubmitDecision,
  type AtlasLoopCycleRecord,
  type AtlasLoopDirectiveConsumability,
  type AtlasLoopDirectiveReceipt,
  type AtlasLoopLiveResponse,
  type AtlasLoopOperatorDecisionReceipt,
  type AtlasLoopRiskLevel,
  type AtlasLoopRunControlAction,
} from './index'
import { deriveLoopState, type LoopState } from '../../components/loop/loopTone'
import type { OperatorDecisionVerdict } from '../../components/loop/loopTypes'

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
}

const OPERATOR_ACTOR = 'vitor'

export function useLoopCommand(): UseLoopCommandResult {
  const { showToast } = useShell()
  const [window, setWindow] = useState<'24h' | 'all'>('24h')
  const [postedDirectives, setPostedDirectives] = useState<AtlasLoopDirectiveReceipt[]>([])
  const [lastReachability, setLastReachability] = useState<AtlasLoopDirectiveConsumability | null>(null)
  const [busyAction, setBusyAction] = useState<AtlasLoopRunControlAction | null>(null)

  const liveQuery = useLoopState()
  const cyclesQuery = useLoopCycles({ tail: 20, hours: window === '24h' ? 24 : undefined })

  const decideMutation = useSubmitDecision()
  const runControlMutation = useRunControl()
  const directiveMutation = useSendDirective()

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
  }
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
