/**
 * Atlas AI · Mobile · hook React para consumir hyperflow runtime de um trace.
 *
 * Uso típico no composer / context panel:
 *
 * ```tsx
 * const hyperflow = useHyperflowRuntime(trace)
 * if (hyperflow.isReady) {
 *   showBadge(`${hyperflow.intentLabel} · ${hyperflow.flowId}`)
 * }
 * ```
 *
 * Backend é sempre a ground truth. O hook NUNCA inventa decisão local.
 */
import { useMemo } from 'react'
import {
  type AtlasAiHyperflowTrace,
  extractHyperflow,
  flowIdFromRuntime,
  formatRoutingReason,
  intentLabelFor,
} from './hyperflowRuntime'

export interface HyperflowRuntimeView {
  /** Raw flat shape canon, null se backend ainda não decidiu. */
  raw: AtlasAiHyperflowTrace | null
  /** True quando há decisão real do backend (não null, não pendente). */
  isReady: boolean
  /** True enquanto o trace estiver `queued`/`processing` SEM hyperflow ainda. */
  isPending: boolean
  /** Intent type (ex: 'research', 'programming') ou null. */
  intent: string | null
  /** Label humano do intent (ex: 'Pesquisa', 'Programação'). */
  intentLabel: string | null
  /** Domain inferido (ex: 'research', 'programming') ou null. */
  domainId: string | null
  /** Flow ID canônico (backend wins). Null se ainda não decidido. */
  flowId: string | null
  /** Runtime mode: lightweight | standard | deep | forge | blocked. */
  runtimeMode: string | null
  /** Confiança 0..1 ou null. */
  confidence: number | null
  /** SHA-256 64-chars hex do receipt persistido em Postgres, audit trail. */
  receiptHash: string | null
  /** Alvo de handoff (atlas_dev/atlas_forge) ou null quando não há. */
  handoffTarget: string | null
  /** Status do dispatch: planned | dispatched | simulated | blocked | completed. */
  dispatchStatus: string | null
  /** Razões textuais da decisão (ex: ['intent_type:research', ...]). */
  reasons: string[]
  /** Resumo textual compacto pra UI (ex: 'Pesquisa · flow:atlas_research · mode:deep'). */
  routingReasonSummary: string
}

interface TraceLikeWithStatus {
  status?: string
}

export function useHyperflowRuntime(trace: unknown): HyperflowRuntimeView {
  return useMemo(() => {
    const raw = extractHyperflow(trace)
    const status = (trace as TraceLikeWithStatus | null)?.status ?? null
    const isProcessing = status === 'queued' || status === 'processing'

    if (!raw) {
      return {
        raw: null,
        isReady: false,
        isPending: isProcessing,
        intent: null,
        intentLabel: null,
        domainId: null,
        flowId: null,
        runtimeMode: null,
        confidence: null,
        receiptHash: null,
        handoffTarget: null,
        dispatchStatus: null,
        reasons: [],
        routingReasonSummary: '',
      }
    }

    return {
      raw,
      isReady: true,
      isPending: false,
      intent: raw.intent,
      intentLabel: intentLabelFor(raw.intent),
      domainId: raw.domain_id,
      flowId: flowIdFromRuntime(raw),
      runtimeMode: raw.runtime_mode,
      confidence: typeof raw.confidence === 'number' ? raw.confidence : null,
      receiptHash: raw.decision_receipt_hash ?? null,
      handoffTarget: raw.handoff_target,
      dispatchStatus: raw.dispatch_status,
      reasons: raw.reasons ?? [],
      routingReasonSummary: formatRoutingReason(raw),
    }
  }, [trace])
}
