/**
 * Atlas Patamar 4 · Mobile · pure view-model.
 *
 * Mirror of the desktop builder (apps/desktop/src/surfaces/atlas-ai/patamar4StateView.ts).
 * Tested via tsx without RN/Expo runtime.
 */

export type Patamar4Status = 'unavailable' | 'loading' | 'ready' | 'stale'

export interface Patamar4KernelView {
  kernelHash: string | null
  invariantCount: number
  violationCount: number
}

export interface Patamar4ReconciliationView {
  tickCount: number
  outcomeTally: Record<string, number>
}

export interface Patamar4AntifragilityView {
  wrapperMultiplierM: number | null
  components: Record<string, number>
}

export interface Patamar4View {
  status: Patamar4Status
  subsystemCount: number
  groupCount: number
  kernel: Patamar4KernelView
  reconciliation: Patamar4ReconciliationView
  admissionTicketCount: number
  teosI4TreeCount: number
  swarmDispatchCount: number
  tdcActiveCapsules: number
  antifragility: Patamar4AntifragilityView
  claimPolicySafe: boolean
  generatedAt: string | null
  isFetching: boolean
  refresh: () => void
}

export interface RawPatamar4State {
  schema_version?: string
  generated_at?: string
  kernel?: {
    kernel_hash?: string
    invariants?: Array<{ id: string; class: string }>
    violation_count?: number
  }
  cognitive_function_atlas?: {
    subsystem_count?: number
    group_count?: number
  }
  autonomy_admission?: {
    ticket_count?: number
  }
  reconciliation?: {
    summary?: {
      tick_count?: number
      outcomes?: Record<string, number>
    }
  }
  teos_i4?: {
    tree_count?: number
  }
  swarm?: {
    dispatch_count?: number
  }
  temporary_domain?: {
    active_capsule_count?: number
  }
  antifragility?: {
    wrapper_multiplier_m?: number
    components?: Record<string, number>
  }
  claim_policy?: {
    benchmark_claim_allowed?: boolean
    rivals_claim_allowed?: boolean
    superiority_claim_allowed?: boolean
    external_rivals_certification_touched?: boolean
  }
}

const EMPTY_VIEW = (refresh: () => void): Patamar4View => ({
  status: 'unavailable',
  subsystemCount: 0,
  groupCount: 0,
  kernel: { kernelHash: null, invariantCount: 0, violationCount: 0 },
  reconciliation: { tickCount: 0, outcomeTally: {} },
  admissionTicketCount: 0,
  teosI4TreeCount: 0,
  swarmDispatchCount: 0,
  tdcActiveCapsules: 0,
  antifragility: { wrapperMultiplierM: null, components: {} },
  claimPolicySafe: true,
  generatedAt: null,
  isFetching: false,
  refresh,
})

export function buildPatamar4View(
  raw: RawPatamar4State | null,
  isFetching: boolean,
  isLoaded: boolean,
  refresh: () => void,
): Patamar4View {
  if (!isLoaded) {
    return { ...EMPTY_VIEW(refresh), status: 'loading', isFetching }
  }
  if (raw === null) {
    return { ...EMPTY_VIEW(refresh), status: 'unavailable', isFetching }
  }
  const cp = raw.claim_policy ?? {}
  const claimPolicySafe =
    !cp.benchmark_claim_allowed &&
    !cp.rivals_claim_allowed &&
    !cp.superiority_claim_allowed &&
    !cp.external_rivals_certification_touched

  return {
    status: claimPolicySafe ? 'ready' : 'stale',
    subsystemCount: raw.cognitive_function_atlas?.subsystem_count ?? 0,
    groupCount: raw.cognitive_function_atlas?.group_count ?? 0,
    kernel: {
      kernelHash: raw.kernel?.kernel_hash ?? null,
      invariantCount: (raw.kernel?.invariants ?? []).length,
      violationCount: raw.kernel?.violation_count ?? 0,
    },
    reconciliation: {
      tickCount: raw.reconciliation?.summary?.tick_count ?? 0,
      outcomeTally: raw.reconciliation?.summary?.outcomes ?? {},
    },
    admissionTicketCount: raw.autonomy_admission?.ticket_count ?? 0,
    teosI4TreeCount: raw.teos_i4?.tree_count ?? 0,
    swarmDispatchCount: raw.swarm?.dispatch_count ?? 0,
    tdcActiveCapsules: raw.temporary_domain?.active_capsule_count ?? 0,
    antifragility: {
      wrapperMultiplierM: raw.antifragility?.wrapper_multiplier_m ?? null,
      components: raw.antifragility?.components ?? {},
    },
    claimPolicySafe,
    generatedAt: raw.generated_at ?? null,
    isFetching,
    refresh,
  }
}

export function patamar4StatusLabel(status: Patamar4Status): string {
  switch (status) {
    case 'ready':
      return 'Ativo'
    case 'loading':
      return 'Carregando…'
    case 'stale':
      return 'Drift de claim policy'
    case 'unavailable':
    default:
      return 'Indisponível'
  }
}
