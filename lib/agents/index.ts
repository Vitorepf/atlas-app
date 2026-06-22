// Atlas Agent Governance — fleet visibility + DESLIGAR. Thin react-query layer over the server's
// /api/agents/* control-plane endpoints. READ hooks poll on a short interval so the operator always sees,
// in near-real time, exactly which autonomous agents are running and which account they spend. The MUTATION
// hooks only ever turn agents OFF — there is no turn-ON here, by design, so the app can only reduce spend.

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { apiGet, apiPost } from '../api/client'

export interface FleetAgent {
  key: string
  label: string
  account: string
  kind: string
  provider_spending: boolean
  desired: boolean
  authorized: boolean
  set_by: string | null
  set_at: string | null
  ttl_remaining_seconds: number | null
  budget_limit_usd: number | null
  target_ref: string | null
  reason: string | null
  status: 'running' | 'desired_dead' | 'off'
  alive: boolean
  pids: number[]
  uptime_seconds: number | null
  spent_usd: number
}

export interface FleetSnapshot {
  schema_version: string
  generated_at: string
  fleet_master: 'on' | 'off'
  active_count: number
  spending_accounts: string[]
  agents: FleetAgent[]
}

export interface AgentEvent {
  agent_key: string
  event: string
  at: string
  by: string | null
  account: string | null
  pid: number | null
  duration_seconds: number | null
  reason: string | null
  detail: Record<string, unknown> | null
}

export interface AgentHistoryResponse {
  schema_version: string
  events: AgentEvent[]
}

const FLEET_KEY = ['agents', 'fleet'] as const
const ACTIVE_KEY = ['agents', 'active'] as const
const HISTORY_KEY = ['agents', 'history'] as const

/** The whole fleet (running + desired + off) for the detail screen. */
export function useFleetStatus(pollIntervalMs = 4_000): UseQueryResult<FleetSnapshot> {
  return useQuery({
    queryKey: FLEET_KEY,
    queryFn: () => apiGet<FleetSnapshot>('/agents/status'),
    refetchInterval: pollIntervalMs,
    refetchIntervalInBackground: false,
    staleTime: Math.max(0, pollIntervalMs - 500),
    placeholderData: keepPreviousData,
    retry: 1,
  })
}

/** Only the running agents — what the persistent "🔴 N ativos" badge counts. Polled globally + cheaply. */
export function useActiveAgents(pollIntervalMs = 5_000): UseQueryResult<FleetSnapshot> {
  return useQuery({
    queryKey: ACTIVE_KEY,
    queryFn: () => apiGet<FleetSnapshot>('/agents/active'),
    refetchInterval: pollIntervalMs,
    refetchIntervalInBackground: false,
    staleTime: Math.max(0, pollIntervalMs - 500),
    placeholderData: keepPreviousData,
    retry: 1,
  })
}

export function useAgentHistory(limit = 60): UseQueryResult<AgentHistoryResponse> {
  return useQuery({
    queryKey: [...HISTORY_KEY, limit],
    queryFn: () => apiGet<AgentHistoryResponse>(`/agents/history?limit=${limit}`),
    refetchInterval: 8_000,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
    retry: 1,
  })
}

/** DESLIGAR one agent (declare desired-OFF; the babá stops it). */
export function useTurnOffAgent(): UseMutationResult<unknown, Error, string> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (key: string) => apiPost(`/agents/${key}/off`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

/** PANIC — desired-OFF for the whole fleet + both master switches OFF. */
export function useTurnOffAll(): UseMutationResult<unknown, Error, void> {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiPost('/agents/off-all', {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents'] })
    },
  })
}

export function humanDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—'
  if (seconds < 60) return `${Math.floor(seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  return `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m`
}
