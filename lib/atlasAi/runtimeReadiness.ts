/**
 * Atlas AI · Mobile · Runtime Readiness types + view-model puro.
 *
 * NÃO importa `lib/api/client` (que arrasta React Native) para permitir
 * testes via `tsx` direto. Fetcher silent vive em `runtimeReadinessClient.ts`.
 */

/* ---------- Shape canônico (mirror do backend) ---------- */

export interface AtlasAiRuntimeReadinessCheck {
  id: string
  label: string
  status: 'passed' | 'warn' | 'failed' | string
  severity: 'critical' | 'warn' | string
  source_service?: string | null
  evidence_refs?: ReadonlyArray<string> | null
  detail?: Record<string, unknown> | null
}

export interface AtlasAiRuntimeReadiness {
  schema_version?: string
  status?: 'ready' | 'partial' | 'blocked' | string
  generated_at?: string | null
  summary?: {
    total?: number
    passed?: number
    partial?: number
    failed?: number
    critical_failed?: number
    warn_failed?: number
  } | null
  checks?: ReadonlyArray<AtlasAiRuntimeReadinessCheck> | null
  blockers?: ReadonlyArray<string> | null
  warnings?: ReadonlyArray<string> | null
  evidence_refs?: ReadonlyArray<string> | null
  required_commands?: ReadonlyArray<string> | null
  claim_policy?: {
    declares_benchmark?: boolean
    declares_rivals?: boolean
    declares_superiority?: boolean
    declares_teos_certification?: boolean
    invokes_provider?: boolean
    scope?: string | null
    forbidden_claims?: ReadonlyArray<string> | null
  } | null
  release_scope?: string | null
  certification_hash?: string | null
  /** UX bundle dinâmico (active mission, pending approvals, latest handoff).
   * Fora do `certification_hash` — alimenta o status pill leve. */
  ux_bundle?: {
    schema_version?: string
    active_mission?: {
      id?: string
      title?: string
      status?: string
      mission_type?: string | null
      next_action?: string | null
    } | null
    pending_approvals_count?: number
    latest_handoff?: {
      target?: string
      reason?: string
      status?: string
      created_at?: string | null
    } | null
    assisted_execution?: {
      schema_version?: string
      status?: 'ready' | 'needs_attention' | 'unavailable' | string
      route_target?: string | null
      flow_id?: string | null
      doctrine_gate_status?: string | null
      selected_drivers?: ReadonlyArray<string> | null
      context_memory_status?: string | null
      context_must_keep_coverage?: number | null
      areg_status?: string | null
      areg_path?: string | null
      outcome_feedback_status?: string | null
      aemor_feedback_status?: string | null
      blockers?: ReadonlyArray<string> | null
      summary?: string | null
      hash?: string | null
    } | null
  } | null
}

/* ---------- View-model puro ---------- */

export type RuntimeReadinessStatus = 'ready' | 'partial' | 'blocked' | 'unavailable' | 'loading'

export interface RuntimeReadinessActiveMission {
  id: string
  title: string
  status: string
  missionType: string | null
  nextAction: string | null
}

export interface RuntimeReadinessLatestHandoff {
  target: string
  reason: string
  status: string
  createdAt: string | null
  isDev: boolean
  isForge: boolean
}

export interface RuntimeReadinessAssistedExecution {
  status: string
  routeTarget: string | null
  flowId: string | null
  doctrineGateStatus: string | null
  selectedDrivers: ReadonlyArray<string>
  contextMemoryStatus: string | null
  contextMustKeepCoverage: number | null
  aregPath: string | null
  outcomeFeedbackStatus: string | null
  aemorFeedbackStatus: string | null
  blockers: ReadonlyArray<string>
  summary: string | null
  hash: string | null
}

export interface RuntimeReadinessView {
  raw: AtlasAiRuntimeReadiness | null
  status: RuntimeReadinessStatus
  statusLabel: string
  isLoaded: boolean
  isFetching: boolean
  criticalFailed: number
  warnFailed: number
  blockers: ReadonlyArray<string>
  warnings: ReadonlyArray<string>
  /** Primeiro blocker humanizado (snake_case → words). Null se ready. */
  primaryBlocker: string | null
  certificationHash: string | null
  /** Hash truncado para exibição compacta (16 chars + ellipsis). */
  certificationHashShort: string | null
  /** UX bundle (mission ativa, contadores, handoff). Null quando ausente. */
  activeMission: RuntimeReadinessActiveMission | null
  pendingApprovalsCount: number
  latestHandoff: RuntimeReadinessLatestHandoff | null
  assistedExecution: RuntimeReadinessAssistedExecution | null
  refresh: () => void
}

const STATUS_LABEL: Record<RuntimeReadinessStatus, string> = {
  ready: 'Pronto',
  partial: 'Parcial',
  blocked: 'Bloqueado',
  unavailable: 'Indisponível',
  loading: 'Verificando',
}

export function statusLabelFor(status: RuntimeReadinessStatus): string {
  return STATUS_LABEL[status]
}

function humanizeBlockerId(id: string): string {
  return id.replace(/[._-]+/g, ' ').trim()
}

export function buildRuntimeReadinessView(
  raw: AtlasAiRuntimeReadiness | null,
  isFetching: boolean,
  isLoaded: boolean,
  refresh: () => void,
): RuntimeReadinessView {
  if (!raw) {
    const status: RuntimeReadinessStatus = isLoaded ? 'unavailable' : 'loading'
    return {
      raw: null,
      status,
      statusLabel: STATUS_LABEL[status],
      isLoaded,
      isFetching,
      criticalFailed: 0,
      warnFailed: 0,
      blockers: [],
      warnings: [],
      primaryBlocker: null,
      certificationHash: null,
      certificationHashShort: null,
      activeMission: null,
      pendingApprovalsCount: 0,
      latestHandoff: null,
      assistedExecution: null,
      refresh,
    }
  }

  const rawStatus = (raw.status ?? 'unavailable') as RuntimeReadinessStatus
  const status: RuntimeReadinessStatus
    = rawStatus === 'ready' || rawStatus === 'partial' || rawStatus === 'blocked'
      ? rawStatus
      : 'unavailable'

  const blockers = raw.blockers ?? []
  const warnings = raw.warnings ?? []
  const primaryBlocker = blockers.length > 0
    ? humanizeBlockerId(blockers[0]!)
    : warnings.length > 0
      ? humanizeBlockerId(warnings[0]!)
      : null

  const hash = raw.certification_hash ?? null

  const bundleMission = raw.ux_bundle?.active_mission ?? null
  const activeMission: RuntimeReadinessActiveMission | null = bundleMission && bundleMission.id
    ? {
        id: String(bundleMission.id),
        title: String(bundleMission.title ?? 'Sem título'),
        status: String(bundleMission.status ?? 'unknown'),
        missionType: bundleMission.mission_type ?? null,
        nextAction: bundleMission.next_action ?? null,
      }
    : null

  const bundleHandoff = raw.ux_bundle?.latest_handoff ?? null
  const latestHandoff: RuntimeReadinessLatestHandoff | null = bundleHandoff && bundleHandoff.target
    ? {
        target: String(bundleHandoff.target),
        reason: String(bundleHandoff.reason ?? ''),
        status: String(bundleHandoff.status ?? 'unknown'),
        createdAt: bundleHandoff.created_at ?? null,
        isDev: String(bundleHandoff.target).toLowerCase().includes('dev'),
        isForge: String(bundleHandoff.target).toLowerCase().includes('forge'),
      }
    : null

  const bundleAssisted = raw.ux_bundle?.assisted_execution ?? null
  const assistedExecution: RuntimeReadinessAssistedExecution | null = bundleAssisted
    ? {
        status: String(bundleAssisted.status ?? 'unknown'),
        routeTarget: bundleAssisted.route_target ?? null,
        flowId: bundleAssisted.flow_id ?? null,
        doctrineGateStatus: bundleAssisted.doctrine_gate_status ?? null,
        selectedDrivers: Array.isArray(bundleAssisted.selected_drivers) ? bundleAssisted.selected_drivers.map(String) : [],
        contextMemoryStatus: bundleAssisted.context_memory_status ?? null,
        contextMustKeepCoverage: typeof bundleAssisted.context_must_keep_coverage === 'number'
          ? bundleAssisted.context_must_keep_coverage
          : null,
        aregPath: bundleAssisted.areg_path ?? null,
        outcomeFeedbackStatus: bundleAssisted.outcome_feedback_status ?? null,
        aemorFeedbackStatus: bundleAssisted.aemor_feedback_status ?? null,
        blockers: Array.isArray(bundleAssisted.blockers) ? bundleAssisted.blockers.map(String) : [],
        summary: bundleAssisted.summary ?? null,
        hash: bundleAssisted.hash ?? null,
      }
    : null

  return {
    raw,
    status,
    statusLabel: STATUS_LABEL[status],
    isLoaded,
    isFetching,
    criticalFailed: raw.summary?.critical_failed ?? 0,
    warnFailed: raw.summary?.warn_failed ?? 0,
    blockers,
    warnings,
    primaryBlocker,
    certificationHash: hash,
    certificationHashShort: hash ? `${hash.slice(0, 16)}…` : null,
    activeMission,
    pendingApprovalsCount: raw.ux_bundle?.pending_approvals_count ?? 0,
    latestHandoff,
    assistedExecution,
    refresh,
  }
}
