import { getRecordingPermissionsAsync } from 'expo-audio'
import {
  type AiProvidersStatusResponse,
  type AtlasAiActiveJob,
  type AtlasAiFlowProfile,
  type AtlasAiJob,
  type AtlasAiPolicyPreviewResponse,
  type AtlasAiPolicyProfilesResponse,
  type AtlasHealth,
  type AtlasMacStatusResponse,
} from '../../../lib/api/client'
import { formatRelativeSync, localQueueCounts, useAtlasStore } from '../../../lib/atlasStore'
import type { ScreenTimeLocalStatus } from '../../../lib/screenTime'

export type VoicePermission = Awaited<ReturnType<typeof getRecordingPermissionsAsync>>

export interface SegOption {
  key: string
  label: string
}

export interface ProviderModelCatalogOption {
  key: string
  alias?: string | null
  model?: string | null
  label: string
  tier?: string | null
}

export function normalizeApiDrafts(hostDraft: string, portDraft: string, tokenDraft: string) {
  const host = hostDraft.trim().replace(/\/+$/, '')
  const port = Number(portDraft)
  const token = tokenDraft.trim()

  if (!host) {
    throw new Error('Informe o host do atlas-server.')
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Informe uma porta válida.')
  }

  if (!token) {
    throw new Error('Informe o token do Atlas.')
  }

  return { host, port, token }
}

export function activeStatusRank(status: string): number {
  if (status === 'processing') return 0
  if (status === 'awaiting_user_choice') return 1
  if (status === 'queued') return 2
  return 3
}

export function activeJobTime(job: AtlasAiJob): number {
  const date = job.started_at ?? job.reserved_at ?? job.available_at ?? job.updated_at ?? job.created_at
  const value = date ? new Date(date).getTime() : 0
  return Number.isFinite(value) ? value : 0
}

export type ConnectionStatusKind = 'online' | 'pending' | 'offline'
export type ProviderHealth = AiProvidersStatusResponse['providers'][number]
export const PROVIDER_HEALTH_FRESH_MS = 10 * 60 * 1000
export const AI_WORKER_FRESH_MS = 2 * 60 * 1000

export function statusAfterSync(successMessage: string): string {
  const state = useAtlasStore.getState()
  const counts = localQueueCounts(state)

  if (!state.serverReachable) return state.lastError ?? 'Servidor não alcançado'
  if (state.lastError) return state.lastError
  if (counts.total > 0) {
    return `Servidor online · ${counts.total} ${counts.total === 1 ? 'item pendente' : 'itens pendentes'}`
  }

  return successMessage
}

export function connectionStatusKind(input: {
  serverReachable: boolean
  lastError: string | null
  queue: number
}): ConnectionStatusKind {
  if (!input.serverReachable) return 'offline'
  if (input.lastError || input.queue > 0) return 'pending'
  return 'online'
}

export function statusKindFromMessage(status: string): ConnectionStatusKind {
  const lower = status.toLowerCase()
  if (
    lower.includes('invalid or missing x-atlas-token')
    || lower.includes('unauthorized')
    || lower.includes('falha')
    || lower.includes('erro')
  ) return 'offline'
  if (lower.includes('pendente') || lower.includes('fila') || lower.includes('postgres indisponível')) return 'pending'
  if (/\bok\b/.test(lower) || lower.includes('completa')) return 'online'
  return 'offline'
}

export function connectionStatusDescription(input: {
  serverReachable: boolean
  lastError: string | null
  queue: number
  syncing: boolean
  testing: boolean
}): string {
  if (input.testing) return 'Testando servidor e token'
  if (input.syncing) return 'Sincronizando fila local'
  if (!input.serverReachable) return input.lastError ?? 'Servidor não verificado'
  if (input.lastError) return input.lastError
  if (input.queue > 0) {
    return `Servidor online · ${input.queue} ${input.queue === 1 ? 'item pendente' : 'itens pendentes'}`
  }

  return 'Conexão pronta'
}

export function macConnectionStatus(
  status: AtlasMacStatusResponse | null,
  error: string | null,
  loading: boolean,
): ConnectionStatusKind {
  if (loading) return 'pending'
  if (error || !status) return 'offline'
  if (status.status === 'offline_or_sleeping' || status.status === 'not_installed') return 'offline'
  if (status.status === 'held_awake' || status.status === 'running_jobs') return 'pending'
  return 'online'
}

export function macStatusDescription(
  status: AtlasMacStatusResponse | null,
  error: string | null,
  loading: boolean,
): string {
  if (loading) return 'Atualizando status do Mac Agent'
  if (error) return error
  if (!status) return 'Ainda não verificado neste aparelho'
  if (status.status === 'not_installed') return 'Tabelas do Mac Agent ainda não migradas'
  if (status.status === 'offline_or_sleeping') return 'Mac Agent offline, dormindo ou sem heartbeat recente'
  if (status.status === 'held_awake') return `${status.active_sessions.length} sessão ativa mantendo o Mac acordado`
  if (status.status === 'running_jobs') return 'Worker executando jobs no Mac'
  return 'Mac Agent online e sem retenção de energia'
}

export function macReadinessStatus(status: AtlasMacStatusResponse | null): ConnectionStatusKind {
  const readiness = status?.readiness
  if (!readiness) return 'offline'
  if (readiness.ready_for_background_jobs) return 'online'
  if (readiness.ready_for_remote) return 'pending'
  return 'offline'
}

export function macReadinessDescription(status: AtlasMacStatusResponse | null): string {
  const readiness = status?.readiness
  if (!readiness) return 'Prontidão ainda não verificada'
  if (readiness.summary?.message) return readiness.summary.message
  if (readiness.ready_for_background_jobs) return 'Remoto, jobs e wake automático prontos'
  if (readiness.ready_for_remote) {
    const batteryBlocker = readiness.blockers.find((item) => item.code === 'battery_too_low_for_background_jobs')
    if (batteryBlocker) return batteryBlocker.message
    const blocker = readiness.blockers.find((item) => item.code === 'power_helper_not_ready' || item.code === 'atlas_wake_not_confirmed')
    return blocker?.message ?? 'Modo remoto pronto; wake automático pendente'
  }
  return readiness.blockers[0]?.message ?? 'Mac Agent bloqueado'
}

export function macNextActionStatus(status: AtlasMacStatusResponse | null): ConnectionStatusKind {
  const action = status?.readiness?.next_action
  if (!action) return 'offline'
  if (action.code === 'none') return 'online'
  if (action.severity === 'critical') return 'offline'
  return 'pending'
}

export function macNextActionDescription(status: AtlasMacStatusResponse | null): string {
  const action = status?.readiness?.next_action
  if (!action) return 'Nenhuma ação calculada ainda'
  if (action.code === 'none') return action.message
  if (action.command) return `${action.message} · ${shortMacCommand(action.command)}`
  return action.message
}

export function shortMacCommand(command: string): string {
  if (command.includes('install-power-helper-launch-daemon.sh')) return 'instalar Power Helper no Mac'
  if (command.includes('install-mac-agent-launch-agent.sh')) return 'instalar LaunchAgent'
  if (command.includes('cleanup-caffeinate')) return 'limpar retenções órfãs'
  if (command.includes('atlas:host doctor')) return 'rodar doctor'
  if (command.includes('atlas:host schedule-wake')) return 'programar wake'
  return command
}

export function macAgentSupervisorStatus(status: AtlasMacStatusResponse | null): ConnectionStatusKind {
  const supervisor = status?.mac_agent
  if (!supervisor) return 'offline'
  if (supervisor.ready) return 'online'
  if (supervisor.installed) return 'pending'
  return 'offline'
}

export function macAgentSupervisorDescription(status: AtlasMacStatusResponse | null): string {
  const supervisor = status?.mac_agent
  if (!supervisor) return 'LaunchAgent ainda não verificado'
  if (supervisor.next_action?.code && supervisor.next_action.code !== 'ready') return supervisor.next_action.message
  if (supervisor.running && supervisor.pid) return `${supervisor.label} rodando · pid ${supervisor.pid}`
  if (supervisor.ready) return `${supervisor.label} carregado`
  if (supervisor.installed) return `${supervisor.label} instalado, mas não carregado`
  return 'Instale o LaunchAgent para manter o agente ativo'
}

export function remoteModeActive(status: AtlasMacStatusResponse | null): boolean {
  return Boolean(status?.active_sessions.some((session) => session.kind === 'remote_manual' && session.status === 'active'))
}

export function remoteModeDescription(status: AtlasMacStatusResponse | null): string {
  const session = status?.active_sessions.find((item) => item.kind === 'remote_manual' && item.status === 'active')
  if (!session) return 'Nenhum modo remoto segurando o Mac acordado'
  const caffeinate =
    session.caffeinate_alive === true
      ? 'caffeinate ok'
      : session.caffeinate_alive === false
        ? 'caffeinate reiniciando'
        : 'caffeinate não verificado'
  const expiry = session.expires_at ? `até ${formatRelativeSync(session.expires_at)}` : 'sem expiração registrada'
  return `Ativo ${expiry} · ${caffeinate}`
}

export function macPowerDescription(status: AtlasMacStatusResponse | null): string {
  const host = status?.host
  if (!host) return 'Bateria e tomada ainda não verificadas'
  const power = host.on_ac_power === null ? 'fonte desconhecida' : host.on_ac_power ? 'na tomada' : 'na bateria'
  const sessions = host.active_power_sessions === 1 ? '1 sessão' : `${host.active_power_sessions} sessões`
  return `${power} · ${sessions} · ${host.active_ai_jobs} jobs ativos`
}

export function macBatteryValue(status: AtlasMacStatusResponse | null): string {
  const battery = status?.host?.battery_percent
  if (battery === null || battery === undefined) return '-'
  return `${battery}%`
}

export function maintenanceDescription(status: AtlasMacStatusResponse | null): string {
  const next = status?.maintenance_windows?.[0]
  if (!next) return 'Nenhuma janela cadastrada'
  if (next.metadata?.pmset_ok === false) return `${next.name} · wake pendente de helper root`
  return `${next.name} · ${next.wake_time} · ${next.duration_minutes}min`
}

export function powerHelperStatus(status: AtlasMacStatusResponse | null): ConnectionStatusKind {
  if (!status?.power_helper) return 'offline'
  if (status.power_helper.ready || (status.power_helper.installed && status.power_helper.last_success_fresh)) return 'online'
  if (status.power_helper.installed) return 'pending'
  return 'offline'
}

export function powerHelperDescription(status: AtlasMacStatusResponse | null): string {
  const helper = status?.power_helper
  if (!helper) return 'Ainda não verificado'
  if (helper.next_action?.code && helper.next_action.code !== 'ready') return helper.next_action.message
  if (helper.installed && helper.last_success_fresh && helper.last_success_at) return `${helper.label} ok · ${formatRelativeSync(helper.last_success_at)}`
  if (helper.installed && helper.last_success_at) return `${helper.label} sem check recente · ${formatRelativeSync(helper.last_success_at)}`
  if (helper.installed && helper.running) return `${helper.label} rodando`
  if (helper.installed) return `${helper.label} instalado, sem check root recente`
  return 'Necessário para programar wake do macOS'
}

export function caffeinateRuntimeStatus(status: AtlasMacStatusResponse | null): ConnectionStatusKind {
  const runtime = status?.caffeinate_runtime
  if (!runtime?.available) return 'offline'
  if (runtime.orphan_count > 0) return 'pending'
  return 'online'
}

export function caffeinateRuntimeDescription(status: AtlasMacStatusResponse | null): string {
  const runtime = status?.caffeinate_runtime
  if (!runtime) return 'Runtime de vigília ainda não verificado'
  if (!runtime.available) return 'caffeinate indisponível neste Mac'
  if (runtime.orphan_count > 0) return `${runtime.orphan_count} retenção órfã será limpa pelo agente`
  const active = runtime.active_labels.length === 1 ? '1 retenção ativa' : `${runtime.active_labels.length} retenções ativas`
  return `${active} · launchctl monitorado`
}

export function wakeScheduleStatus(status: AtlasMacStatusResponse | null): ConnectionStatusKind {
  if (!status?.wake_schedule?.available) return 'offline'
  if (status.wake_schedule.scheduled) return 'online'
  if ((status.maintenance_windows?.length ?? 0) > 0) return 'pending'
  return 'offline'
}

export function wakeScheduleDescription(status: AtlasMacStatusResponse | null): string {
  const schedule = status?.wake_schedule
  if (!schedule?.available) return 'pmset schedule ainda não verificado'
  if (schedule.scheduled) return schedule.next_wake_at ? `Próximo wake ${formatRelativeSync(schedule.next_wake_at)}` : 'Wake programado no macOS'
  if (schedule.system_has_wakeorpoweron) return 'Existe wake do sistema, mas nenhum wake Atlas confirmado'
  if ((status?.maintenance_windows?.length ?? 0) > 0) return 'Janela cadastrada, mas wake ainda não programado'
  return 'Nenhum wake programado'
}

export function databaseHealthStatus(health: AtlasHealth | null): ConnectionStatusKind {
  if (!health) return 'offline'
  return health.db_connected ? 'online' : 'offline'
}

export function databaseHealthDescription(health: AtlasHealth | null): string {
  if (!health) return 'Rode "Testar conexão" para carregar o health operacional'
  return health.db_connected ? 'Postgres conectado' : 'Servidor responde, mas Postgres falhou'
}

export function storageHealthStatus(health: AtlasHealth | null): ConnectionStatusKind {
  if (!health) return 'offline'
  return health.checks?.storage?.writable ? 'online' : 'offline'
}

export function storageHealthDescription(health: AtlasHealth | null): string {
  const storage = health?.checks?.storage
  if (!storage) return 'Storage ainda não verificado'
  if (storage.writable) return `Escrita ok · ${storage.path ?? 'disco atlas'}`
  return storage.error ? `Falha no storage · ${storage.error}` : 'Storage Atlas sem escrita'
}

export function transcriptionHealthStatus(health: AtlasHealth | null): ConnectionStatusKind {
  const transcription = health?.checks?.transcription
  if (!transcription) return 'offline'
  if (!transcription.enabled) return 'pending'

  const ready = transcription.binary_exists
    && transcription.binary_executable
    && transcription.model_exists
    && transcription.ffmpeg_exists
    && transcription.ffmpeg_executable

  return ready ? 'online' : 'offline'
}

export function transcriptionHealthDescription(health: AtlasHealth | null): string {
  const transcription = health?.checks?.transcription
  if (!transcription) return 'Whisper ainda não verificado'
  if (!transcription.enabled) return 'Transcrição desativada no servidor'

  const missing: string[] = []
  if (!transcription.binary_exists || !transcription.binary_executable) missing.push('whisper-cli')
  if (!transcription.model_exists) missing.push('modelo')
  if (!transcription.ffmpeg_exists || !transcription.ffmpeg_executable) missing.push('ffmpeg')

  if (missing.length === 0) {
    return `${transcription.engine ?? 'Whisper'} · ${transcription.language ?? 'auto'} · bin/model/ffmpeg ok`
  }

  return `Falta validar: ${missing.join(', ')}`
}

export function transcriptionQueueStatus(health: AtlasHealth | null): ConnectionStatusKind {
  const jobs = health?.checks?.transcription_jobs
  if (!jobs) return 'offline'
  if (jobs.failed > 0) return 'pending'
  if (jobs.queued > 0 || jobs.processing > 0) return 'pending'
  return 'online'
}

export function transcriptionQueueDescription(health: AtlasHealth | null): string {
  const jobs = health?.checks?.transcription_jobs
  const queue = health?.checks?.queue
  if (!jobs || !queue) return 'Fila ainda não verificada'
  return `${jobs.queued} aguardando · ${jobs.processing} processando · ${jobs.failed} falhas · ${queue.connection}/${queue.transcription_queue}`
}

export function providerLabel(provider: string | null | undefined): string {
  if (provider === 'auto') return 'Auto'
  if (provider === 'hermes_cli') return 'Hermes'
  if (provider === 'minimax_m27_cli') return 'MiniMax M3'
  if (provider === 'claude_cli') return 'Claude CLI'
  if (provider === 'codex_cli') return 'Codex CLI'
  if (provider === 'gemini_cli') return 'Gemini CLI'
  if (provider === 'claude_codex') return 'Conselho'
  if (!provider) return 'padrão'
  return provider.replace(/_cli$/, '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export function activeAiSessionsDescription(jobs: AtlasAiJob[], loading: boolean): string {
  if (loading && jobs.length === 0) return 'Verificando execuções que podem consumir'
  if (jobs.length === 0) return 'Nada consumindo agora'

  const processing = jobs.filter((job) => job.status === 'processing').length
  const queued = jobs.filter((job) => job.status === 'queued').length
  const choices = jobs.filter((job) => job.status === 'awaiting_user_choice').length
  const tokens = jobs.reduce((sum, job) => sum + estimateActiveJobTokens(job), 0)
  const parts = [
    processing > 0 ? `${processing} rodando` : null,
    queued > 0 ? `${queued} aguardando` : null,
    choices > 0 ? `${choices} pedindo escolha` : null,
    tokens > 0 ? `~${formatCompactNumber(tokens)} tokens estimados` : null,
  ].filter(Boolean)

  return parts.join(' · ') || `${jobs.length} execução ativa`
}

export function activeAiJobTitle(job: AtlasAiJob, status: AiProvidersStatusResponse | null): string {
  const origin = activeAiJobOriginLabel(job)
  const resolvedProvider = activeAiJobProvider(job)
  const provider = providerLabel(resolvedProvider)
  const model = activeAiJobModelLabel(job, status)
  const runtime = model ? `${provider} · ${model}` : provider

  return `${origin} · ${runtime}`
}

export function activeAiJobModelLabel(job: AtlasAiJob, status: AiProvidersStatusResponse | null): string {
  const metadata = objectRecord(job.metadata)
  const payload = objectRecord(job.payload)
  const traceMetadata = objectRecord(job.trace?.metadata)
  const explicit = firstText(
    metadata.model_label,
    payload.model_label,
    traceMetadata.model_label,
    job.model,
    job.trace?.model,
  )

  if (explicit) return explicit

  return providerModelLabel(status, activeAiJobProvider(job) ?? '', firstText(job.model, job.trace?.model))
}

export function activeAiJobProvider(job: AtlasAiJob): string | null {
  return firstText(job.provider, job.trace?.provider)
}

export function activeAiJobSubtitle(job: AtlasAiJob): string {
  const context = activeAiJobContextLabel(job)
  const elapsed = activeAiJobElapsed(job)
  const tokens = estimateActiveJobTokens(job)
  const metadata = objectRecord(job.metadata)
  const processPid = firstNumber(metadata.process_pid)
  const worker = job.worker_id ? ` · worker ${job.worker_id}` : ''
  const pid = processPid ? ` · pid ${processPid}` : ''
  const tokenText = tokens > 0 ? ` · ~${formatCompactNumber(tokens)} tokens` : ''

  return `${context} · ${elapsed}${tokenText}${pid}${worker}`
}

export function activeAiJobOriginLabel(job: AtlasAiJob): string {
  const source = job.trace?.source_type
  const surface = activeAiJobSurface(job)
  const workflow = activeAiJobWorkflow(job)

  if (source === 'scheduled' || surface === 'atlas_cli_schedule' || workflow === 'scheduled') return 'Agendado'
  if (workflow === 'dev' && (surface === 'atlas_cli' || source === 'manual')) return 'Atlas dev CLI'
  if (workflow === 'dev' && (surface === 'atlas_ai_sheet' || source === 'app')) return 'Atlas dev app'
  if (workflow === 'dev') return 'Atlas dev'
  if (source === 'system' || surface === 'worker' || surface === 'server') return 'Sistema'
  if (surface === 'atlas_cli' || source === 'manual') return 'Terminal'
  if (surface === 'mobile' || surface === 'mobile_thread') return 'Mobile'
  if (surface === 'atlas_ai_sheet' || source === 'app') return 'App'

  return surface ? humanAiSurface(surface) : 'Atlas'
}

export function activeAiJobContextLabel(job: AtlasAiJob): string {
  const thread = job.trace?.thread
  const session = job.trace?.session
  const surface = activeAiJobSurface(job)
  const workspace = firstText(thread?.workspace, job.client_id)
  const title = firstText(thread?.title)
  const parts = [
    surface ? humanAiSurface(surface) : activeAiJobOriginLabel(job),
    title && title !== surface ? title : null,
    workspace,
    session?.id ? `sessão ${shortId(session.id)}` : null,
  ].filter(Boolean)

  return parts.join(' · ') || 'Atlas'
}

export function activeAiJobCanOpen(job: AtlasAiJob): boolean {
  return Boolean(job.trace?.thread_id)
}

export function activeAiJobSurface(job: AtlasAiJob): string | null {
  const payload = objectRecord(job.payload)
  const metadata = objectRecord(job.metadata)
  const traceMetadata = objectRecord(job.trace?.metadata)

  return firstText(
    job.trace?.thread?.surface,
    payload.app_surface,
    payload.surface,
    metadata.app_surface,
    metadata.surface,
    traceMetadata.app_surface,
    traceMetadata.surface,
  )
}

export function activeAiJobWorkflow(job: AtlasAiJob): string | null {
  const payload = objectRecord(job.payload)
  const metadata = objectRecord(job.metadata)
  const traceMetadata = objectRecord(job.trace?.metadata)

  return firstText(
    payload.atlas_workflow_mode,
    metadata.atlas_workflow_mode,
    traceMetadata.atlas_workflow_mode,
  )
}

export function humanAiSurface(surface: string): string {
  if (surface === 'atlas_ai_sheet') return 'App chat'
  if (surface === 'atlas_cli') return 'Terminal'
  if (surface === 'atlas_cli_schedule') return 'Scheduler CLI'
  if (surface === 'mobile_thread') return 'Mobile thread'
  if (surface === 'mobile') return 'Mobile'
  if (surface === 'worker') return 'Worker'
  if (surface === 'server') return 'Servidor'

  return surface.replace(/_/g, ' ')
}

export function shortId(value: string): string {
  return value.length <= 8 ? value : value.slice(0, 8)
}

export interface AiRuntimeModelGroup {
  key: string
  provider: string | null
  modelLabel: string
  activeJobs: number
  tokens: number
  origins: string[]
  originSet: Set<string>
}

export function aiRuntimeModelGroups(
  jobs: AtlasAiJob[],
  status: AiProvidersStatusResponse | null,
): AiRuntimeModelGroup[] {
  const groups = new Map<string, AiRuntimeModelGroup>()

  const ensure = (provider: string | null, modelLabel: string): AiRuntimeModelGroup => {
    const key = `${provider ?? 'default'}::${modelLabel}`
    const existing = groups.get(key)
    if (existing) return existing

    const group: AiRuntimeModelGroup = {
      key,
      provider,
      modelLabel,
      activeJobs: 0,
      tokens: 0,
      origins: [],
      originSet: new Set<string>(),
    }
    groups.set(key, group)
    return group
  }

  const addOrigin = (group: AiRuntimeModelGroup, origin: string) => {
    if (group.originSet.has(origin)) return
    group.originSet.add(origin)
    group.origins.push(origin)
  }

  jobs.forEach((job) => {
    const provider = activeAiJobProvider(job)
    const group = ensure(provider, activeAiJobModelLabel(job, status))
    group.activeJobs += 1
    group.tokens += estimateActiveJobTokens(job)
    addOrigin(group, activeAiJobOriginLabel(job))
  })

  return [...groups.values()]
    .map((group) => ({ ...group, origins: group.origins.length ? group.origins : ['Atlas'] }))
    .sort((left, right) => {
      const activeDelta = right.activeJobs - left.activeJobs
      if (activeDelta !== 0) return activeDelta
      return providerLabel(left.provider).localeCompare(providerLabel(right.provider))
    })
}

export function activeAiJobElapsed(job: AtlasAiJob): string {
  const date = job.started_at ?? job.reserved_at ?? job.available_at ?? job.updated_at ?? job.created_at
  if (!date) return 'tempo desconhecido'
  const elapsedMs = Math.max(0, Date.now() - new Date(date).getTime())
  if (!Number.isFinite(elapsedMs)) return formatRelativeSync(date)
  const seconds = Math.floor(elapsedMs / 1000)
  if (seconds < 60) return `${Math.max(1, seconds)}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m${seconds % 60 ? `${seconds % 60}s` : ''}`
  const hours = Math.floor(minutes / 60)
  return `${hours}h${minutes % 60 ? `${minutes % 60}m` : ''}`
}

export function activeAiJobPrompt(job: AtlasAiJob): string {
  const input = firstText(job.trace?.operator_input, job.input_text)
  if (!input) return ''
  const normalized = input.replace(/\s+/g, ' ').trim()
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized
}

export function activeAiJobStatusLabel(status: string): string {
  if (status === 'processing') return 'RODANDO'
  if (status === 'queued') return 'FILA'
  if (status === 'awaiting_user_choice') return 'ESCOLHA'
  return status.toUpperCase()
}

export function estimateActiveJobTokens(job: AtlasAiJob): number {
  const metadata = objectRecord(job.metadata)
  const payload = objectRecord(job.payload)
  const traceMetadata = objectRecord(job.trace?.metadata)
  const direct = firstNumber(
    metadata.visible_tokens,
    metadata.estimated_tokens,
    metadata.token_estimate,
    payload.visible_tokens,
    payload.estimated_tokens,
    payload.token_estimate,
    traceMetadata.visible_tokens,
    traceMetadata.estimated_tokens,
    traceMetadata.token_estimate,
  )
  if (direct != null) return direct

  const input = firstText(job.input_text, job.trace?.operator_input) ?? ''
  const output = firstText(job.result_text, job.trace?.response_text) ?? ''

  return Math.ceil((input.length + output.length) / 4)
}

export function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

export function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) {
      return String(value).trim()
    }
  }

  return null
}

export function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
    if (Number.isFinite(number) && number > 0) return Math.round(number)
  }

  return null
}

export function defaultProviderDescription(status: AiProvidersStatusResponse | null): string {
  if (!status) return 'Ainda não verificado'
  if (defaultProviderChoice(status) === 'auto') {
    return 'Atlas Decide roteia runtime/modelo; Hermes é o padrão executivo quando fizer sentido'
  }
  const model = status.default_model
  const label = model?.model_label || model?.model || 'modelo padrão do CLI'
  const tier = model?.model_tier ? ` · tier ${model.model_tier}` : ''
  return `${providerLabel(status.default_provider ?? 'hermes_cli')} será usado quando nenhum runtime/modelo for escolhido · ${label}${tier}`
}

export function modelPolicyByProvider(status: AiProvidersStatusResponse | null, provider: string) {
  return status?.model_policy?.providers.find((item) => item.provider === provider)
    ?? status?.providers.find((item) => item.provider === provider)
    ?? null
}

export function defaultModelValue(status: AiProvidersStatusResponse | null): string {
  const model = status?.default_model
  if (!model) return '-'
  return model.model_label || model.model || 'CLI default'
}

export function defaultModelDescription(status: AiProvidersStatusResponse | null): string {
  if (!status?.default_model) return 'Modelo ainda não verificado'
  const model = status.default_model
  const id = model.model ? `id ${model.model}` : 'sem id explícito'
  const source = model.model_source ? ` · origem ${model.model_source}` : ''
  const tier = model.model_tier ? ` · tier ${model.model_tier}` : ''
  return `${id}${tier}${source}`
}

export function runtimeSettingsDescription(status: AiProvidersStatusResponse | null): string {
  if (!status) return 'Ainda não carregado'
  const source = status.model_policy?.source ?? status.runtime_settings?.source ?? 'config'
  const updated = status.model_policy?.updated_at ?? status.runtime_settings?.updated_at
  const when = updated ? ` · atualizado ${formatRelativeSync(updated)}` : ''
  const mode = defaultProviderChoice(status) === 'auto' ? 'Auto · ' : ''
  return source === 'database'
    ? `${mode}persistido no Atlas DB${when}`
    : `${mode}usando .env/config como fallback${when}`
}

export function aiPolicyProfilesDescription(profiles: AtlasAiPolicyProfilesResponse | null): string {
  if (!profiles) return 'Perfis ainda não carregados'
  const domains = profiles.profile_registry.domains.length
  const flows = profiles.profile_registry.flows.length
  const source = profiles.profile_registry.source === 'database' ? 'Atlas DB' : 'fallback local'
  return `${domains} domínios · ${flows} fluxos · ${source}`
}

export function selectedAiFlowDescription(
  profiles: AtlasAiPolicyProfilesResponse | null,
  flow: AtlasAiFlowProfile | null,
): string {
  if (!profiles) return 'Catálogo de perfis ainda não carregado'
  if (!flow) return 'Selecione um fluxo para editar'
  const domain = profiles.profile_registry.domains.find((item) => item.id === flow.domain_id)
  const source = profiles.profile_registry.source === 'database'
    ? 'editável no Atlas DB'
    : 'fallback local; rode migrations para salvar'
  return `${domain?.label ?? flow.domain_id} · ${flow.label} · ${source}`
}

export function effectivePolicyPreviewReady(preview: AtlasAiPolicyPreviewResponse | null): boolean {
  return Boolean(preview?.effective_policy && Object.keys(preview.effective_policy).length > 0)
}

export function effectivePolicyPreviewDescription(
  preview: AtlasAiPolicyPreviewResponse | null,
  loading: boolean,
): string {
  if (loading) return 'Recalculando merge de perfil, runtime e sessão'
  if (!effectivePolicyPreviewReady(preview)) return 'Preview ainda não calculado'
  const policy = objectRecord(preview?.effective_policy)
  const runtime = objectRecord(policy.runtime_policy)
  const policies = objectRecord(policy.policies)
  const contracts = objectRecord(policy.operational_contracts)
  const modelGraph = objectRecord(contracts.model_graph)
  const authority = firstText(policy.execution_authority) ?? 'sem autoridade'
  const provider = firstText(runtime.default_provider) ?? '-'
  const executor = firstText(objectRecord(policy.execution_policy).executor_preference) ?? '-'
  const modelPreset = firstText(modelGraph.preset, objectRecord(policies.model_policy).preset, objectRecord(policies.model_policy).default) ?? 'default'
  return `${authority} · ${provider} · ${executor} · ${firstText(modelGraph.graph) ?? 'single'} · modelo ${modelPreset}`
}

export function effectivePolicyMetricRows(preview: AtlasAiPolicyPreviewResponse | null): Array<{ label: string; value: string; desc: string }> {
  const policy = objectRecord(preview?.effective_policy)
  if (Object.keys(policy).length === 0) return []

  const runtime = objectRecord(policy.runtime_policy)
  const execution = objectRecord(policy.execution_policy)
  const contracts = objectRecord(policy.operational_contracts)
  const modelGraph = objectRecord(contracts.model_graph)
  const context = objectRecord(contracts.context)
  const memory = objectRecord(contracts.memory)
  const skills = objectRecord(contracts.skills)
  const tools = objectRecord(contracts.tools)
  const gates = objectRecord(contracts.gates)

  return [
    {
      label: 'authority',
      value: firstText(policy.execution_authority) ?? '-',
      desc: firstText(policy.profile_id) ?? firstText(preview?.profile?.profile_id) ?? '-',
    },
    {
      label: 'provider',
      value: providerLabel(firstText(runtime.default_provider)),
      desc: arrayText(modelGraph.fallback_order) || arrayText(runtime.fallback_order) || 'fallback pelo runtime',
    },
    {
      label: 'graph',
      value: firstText(modelGraph.graph) ?? '-',
      desc: `${firstText(modelGraph.preset) ?? 'preset'} · ${modelGraphNodeText(modelGraph.nodes)}`,
    },
    {
      label: 'executor',
      value: firstText(execution.executor_preference) ?? '-',
      desc: `max ${firstText(execution.max_iterations) ?? '1'} · ${truthyText(execution.quality_required, 'quality')}`,
    },
    {
      label: 'context',
      value: firstText(context.depth) ?? '-',
      desc: truthyText(context.require_context_pack, 'context pack'),
    },
    {
      label: 'memory',
      value: firstText(memory.scope) ?? '-',
      desc: arrayText(memory.recall) || truthyText(memory.record_decisions, 'record decisions'),
    },
    {
      label: 'skills',
      value: firstText(skills.mode) ?? '-',
      desc: arrayText(skills.required_bundles) || truthyText(skills.require_skill_trace, 'trace'),
    },
    {
      label: 'tools',
      value: firstText(tools.mode) ?? '-',
      desc: truthyText(tools.workspace_write, 'workspace write'),
    },
    {
      label: 'gates',
      value: firstText(gates.minimum_gate) ?? '-',
      desc: arrayText(gates.required_gates) || truthyText(gates.evidence_required, 'evidence'),
    },
  ]
}

export function modelGraphNodeText(value: unknown): string {
  if (!Array.isArray(value)) return 'sem nós'
  const roles = value
    .map((item) => objectRecord(item))
    .map((item) => firstText(item.role, item.id))
    .filter(Boolean)
    .slice(0, 3)
  return roles.length > 0 ? roles.join(', ') : 'sem nós'
}

export function arrayText(value: unknown): string {
  if (!Array.isArray(value)) return ''
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 4).join(', ')
}

export function truthyText(value: unknown, label: string): string {
  return value === true || value === 'true' || value === 1 ? label : 'não'
}

export function flowExecutorPreference(flow: AtlasAiFlowProfile | null): string {
  const execution = objectRecord(flow?.execution_policy)
  return firstText(execution.executor_preference) ?? 'simple_provider_execution'
}

export function flowExecutorDescription(flow: AtlasAiFlowProfile | null, editable: boolean): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  const executor = flowExecutorPreference(flow)
  const mode = editable ? 'salva no perfil do fluxo' : 'somente leitura enquanto catálogo estiver em fallback'
  if (executor === 'engineering_harness') return `Harness completo · ${mode}`
  if (executor === 'dev_repair_executor') return `Execução com repair loop · ${mode}`
  return `Execução direta por provider · ${mode}`
}

export function flowAutonomyDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  if (flow.autonomy === 'high') return 'Pode planejar fluxo longo, múltiplos passos e gates mais caros'
  if (flow.autonomy === 'low') return 'Conservador; evita trabalho em background e ações arriscadas'
  return 'Equilíbrio entre velocidade, qualidade e custo'
}

export function flowApprovalDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  return flow.requires_human_approval_for_destructive === false
    ? 'Ações destrutivas não exigem aprovação pelo perfil'
    : 'Ações destrutivas exigem aprovação humana'
}

export function flowBackgroundDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  return flow.background_allowed
    ? 'Fluxo pode ser usado por automações quando política permitir'
    : 'Fluxo limitado a sessão/manual'
}

export function flowGateMinimum(flow: AtlasAiFlowProfile | null): string {
  const gate = objectRecord(flow?.gate_policy)
  const minimum = firstText(gate.minimum_gate)
  return ['standard', 'strict', 'release'].includes(minimum ?? '') ? minimum as string : 'standard'
}

export function flowGatePolicyDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  const minimum = flowGateMinimum(flow)
  if (minimum === 'release') return 'Exige padrão de release antes de considerar concluído'
  if (minimum === 'strict') return 'Exige evidência e verificação mais forte'
  return 'Gate padrão do domínio e do executor'
}

export function flowModelPolicyPreset(flow: AtlasAiFlowProfile | null): string {
  const policy = objectRecord(flow?.model_policy)
  const preset = firstText(policy.preset, policy.default, policy.mode)
  return ['balanced', 'quality', 'cost_guarded'].includes(preset ?? '') ? preset as string : 'balanced'
}

export function flowModelPolicyDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  const preset = flowModelPolicyPreset(flow)
  if (preset === 'quality') return 'Prefere modelo mais forte, fallback e conselho quando útil'
  if (preset === 'cost_guarded') return 'Prefere modelo diário e limita escalada automática'
  return 'Equilibra qualidade, custo e disponibilidade'
}

export function modelPolicyPatchForPreset(preset: string): Record<string, unknown> {
  if (preset === 'quality') {
    return {
      preset,
      default: 'quality',
      escalation: 'allow_premium_when_needed',
      fallback: 'quality_then_available',
    }
  }
  if (preset === 'cost_guarded') {
    return {
      preset,
      default: 'daily',
      escalation: 'manual_or_gate_triggered',
      fallback: 'daily_available_first',
    }
  }

  return {
    preset: 'balanced',
    default: 'balanced',
    escalation: 'auto_when_confidence_or_complexity_requires',
    fallback: 'available_first',
  }
}

export function flowContextPolicyPreset(flow: AtlasAiFlowProfile | null): string {
  const policy = objectRecord(flow?.context_policy)
  const preset = firstText(policy.preset, policy.depth)
  return ['light', 'focused', 'deep'].includes(preset ?? '') ? preset as string : 'focused'
}

export function flowContextPolicyDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  const preset = flowContextPolicyPreset(flow)
  if (preset === 'deep') return 'Contexto longo, memória e evidências antes de executar'
  if (preset === 'light') return 'Contexto mínimo para respostas rápidas'
  return 'Contexto focado no fluxo e no workspace atual'
}

export function contextPolicyPatchForPreset(preset: string): Record<string, unknown> {
  if (preset === 'deep') {
    return {
      preset,
      depth: 'deep',
      include_memory: true,
      include_recent_traces: true,
      require_context_pack: true,
    }
  }
  if (preset === 'light') {
    return {
      preset,
      depth: 'light',
      include_memory: false,
      include_recent_traces: false,
      require_context_pack: false,
    }
  }

  return {
    preset: 'focused',
    depth: 'focused',
    include_memory: true,
    include_recent_traces: true,
    require_context_pack: false,
  }
}

export function flowMemoryPolicyPreset(flow: AtlasAiFlowProfile | null): string {
  const policy = objectRecord(flow?.memory_policy)
  const preset = firstText(policy.preset, policy.scope)
  return ['thread', 'project', 'deep'].includes(preset ?? '') ? preset as string : 'project'
}

export function flowMemoryPolicyDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  const preset = flowMemoryPolicyPreset(flow)
  if (preset === 'deep') return 'Usa memória semântica, projeto e decisões canônicas'
  if (preset === 'thread') return 'Limita memória ao contexto da conversa'
  return 'Usa memória do projeto e thread atual'
}

export function memoryPolicyPatchForPreset(preset: string): Record<string, unknown> {
  if (preset === 'deep') {
    return {
      preset,
      scope: 'deep',
      recall: ['thread', 'project', 'semantic', 'decisions'],
      record_decisions: true,
    }
  }
  if (preset === 'thread') {
    return {
      preset,
      scope: 'thread',
      recall: ['thread'],
      record_decisions: false,
    }
  }

  return {
    preset: 'project',
    scope: 'project',
    recall: ['thread', 'project'],
    record_decisions: true,
  }
}

export function flowSkillPolicyPreset(flow: AtlasAiFlowProfile | null): string {
  const policy = objectRecord(flow?.skill_policy)
  const preset = firstText(policy.preset, policy.mode)
  return ['minimal', 'domain', 'council'].includes(preset ?? '') ? preset as string : 'domain'
}

export function flowSkillPolicyDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  const preset = flowSkillPolicyPreset(flow)
  if (preset === 'council') return 'Permite múltiplas skills/vozes quando o fluxo exigir'
  if (preset === 'minimal') return 'Ativa apenas skills essenciais'
  return 'Ativa skills específicas do domínio'
}

export function skillPolicyPatchForPreset(preset: string): Record<string, unknown> {
  if (preset === 'council') {
    return {
      preset,
      mode: 'council',
      allow_multi_skill: true,
      require_skill_trace: true,
    }
  }
  if (preset === 'minimal') {
    return {
      preset,
      mode: 'minimal',
      allow_multi_skill: false,
      require_skill_trace: false,
    }
  }

  return {
    preset: 'domain',
    mode: 'domain',
    allow_multi_skill: true,
    require_skill_trace: true,
  }
}

export function flowToolPolicyPreset(flow: AtlasAiFlowProfile | null): string {
  const policy = objectRecord(flow?.tool_policy)
  const preset = firstText(policy.preset, policy.mode)
  return ['read_only', 'workspace_write', 'harness'].includes(preset ?? '') ? preset as string : 'workspace_write'
}

export function flowToolPolicyDescription(flow: AtlasAiFlowProfile | null): string {
  if (!flow) return 'Nenhum fluxo selecionado'
  const preset = flowToolPolicyPreset(flow)
  if (preset === 'harness') return 'Permite ferramentas completas com gates e evidência'
  if (preset === 'read_only') return 'Ferramentas limitadas a leitura/diagnóstico'
  return 'Permite escrita no workspace com aprovação para destrutivo'
}

export function toolPolicyPatchForPreset(preset: string): Record<string, unknown> {
  if (preset === 'harness') {
    return {
      preset,
      mode: 'harness',
      workspace_write: true,
      destructive_requires_approval: true,
      require_evidence_packet: true,
    }
  }
  if (preset === 'read_only') {
    return {
      preset,
      mode: 'read_only',
      workspace_write: false,
      destructive_requires_approval: true,
      require_evidence_packet: false,
    }
  }

  return {
    preset: 'workspace_write',
    mode: 'workspace_write',
    workspace_write: true,
    destructive_requires_approval: true,
    require_evidence_packet: true,
  }
}

export function providerModelDescription(status: AiProvidersStatusResponse | null, provider: string): string {
  const policy = modelPolicyByProvider(status, provider)
  if (!policy) return 'Modelo ainda não verificado'
  if (providerModelChoice(status, provider) === 'auto') {
    return 'Auto · Atlas Decide escolhe o melhor modelo permitido dentro deste provider'
  }
  const label = policy.model_label || policy.model || 'CLI default'
  const tier = policy.model_tier ? ` · tier ${policy.model_tier}` : ''
  return `${label}${tier} · id ${policy.model ?? 'default'}`
}

export function providerCatalogRows(status: AiProvidersStatusResponse | null) {
  const rows = status?.provider_choice_catalog?.providers?.length
    ? status.provider_choice_catalog.providers
    : status?.model_policy?.providers ?? status?.providers ?? []

  return rows.filter((provider) => (
    provider.provider !== 'claude_codex'
    && (provider.enabled ?? true)
    && (provider.allow_manual || provider.allow_auto)
  ))
}

export function defaultProviderChoice(status: AiProvidersStatusResponse | null): string {
  const selection = status?.provider_choice_catalog?.default_provider_selection
    ?? status?.default_provider_selection
    ?? status?.runtime_settings?.default_provider_selection

  return selection === 'auto' ? 'auto' : String(status?.default_provider ?? 'claude_cli')
}

export function defaultProviderOptions(status: AiProvidersStatusResponse | null): SegOption[] {
  const catalog = status?.provider_choice_catalog?.default_provider_options
  if (catalog?.length) {
    return catalog.map((option) => ({
      key: option.key,
      label: compactSegmentLabel(option.label),
    }))
  }

  return [
    { key: 'auto', label: 'Auto' },
    ...providerCatalogRows(status).map((provider) => ({
      key: String(provider.provider),
      label: compactSegmentLabel(provider.provider_label ?? providerLabel(provider.provider)),
    })),
  ]
}

export function providerModelChoice(status: AiProvidersStatusResponse | null, provider: string): string {
  const policy = modelPolicyByProvider(status, provider)
  if (!policy) return 'auto'
  if (policy.model_selection === 'auto' || policy.default_model_alias === 'auto') return 'auto'
  const catalog = providerModelCatalog(policy)
  const model = policy.model
  const alias = policy.model_alias

  return catalog.find((item) => item.key !== 'auto' && (item.key === alias || item.alias === alias || item.model === model))?.key
    ?? (catalog.some((item) => item.key === 'default') ? 'default' : catalog[0]?.key ?? 'auto')
}

export function providerModelOptions(status: AiProvidersStatusResponse | null, provider: string): SegOption[] {
  return providerModelCatalog(modelPolicyByProvider(status, provider)).map((item) => ({
    key: item.key,
    label: compactModelLabel(item),
  }))
}

export function providerModelCatalog(policy: ReturnType<typeof modelPolicyByProvider>): ProviderModelCatalogOption[] {
  const catalog = policy?.model_catalog?.length ? policy.model_catalog : []
  if (catalog.length) return completeProviderModelCatalog(policy, catalog)

  const generated: ProviderModelCatalogOption[] = [{ key: 'auto', alias: 'auto', model: null, label: 'Auto', tier: null }]
  if (policy?.model) generated.push({ key: 'default', alias: 'default', model: policy.model, label: policy.model_label || policy.model, tier: policy.model_tier ?? null })
  if (policy?.premium_model) generated.push({ key: 'premium', alias: 'premium', model: policy.premium_model, label: policy.premium_model_label || policy.premium_model, tier: 'premium' })
  if (policy?.fallback_model) generated.push({ key: 'fallback', alias: 'fallback', model: policy.fallback_model, label: policy.fallback_model_label || policy.fallback_model, tier: policy.model_tier ?? null })

  return completeProviderModelCatalog(policy, generated)
}

export function completeProviderModelCatalog(
  policy: ReturnType<typeof modelPolicyByProvider>,
  catalog: ProviderModelCatalogOption[],
): ProviderModelCatalogOption[] {
  if (policy?.provider !== 'gemini_cli') return catalog

  const hasFlash = catalog.some((item) => item.key === 'gemini_flash' || item.alias === 'gemini_flash' || item.model === 'gemini-3.5-flash')
  const hasPro = catalog.some((item) => item.key === 'gemini_pro' || item.alias === 'gemini_pro' || item.model === 'gemini-3.1-pro-preview')
  const completed = [...catalog]

  if (!hasFlash) {
    completed.splice(Math.min(1, completed.length), 0, {
      key: 'gemini_flash',
      alias: 'gemini_flash',
      model: 'gemini-3.5-flash',
      label: 'Gemini 3.5 Flash',
      tier: 'daily',
    })
  }

  if (!hasPro) {
    completed.push({
      key: 'gemini_pro',
      alias: 'gemini_pro',
      model: 'gemini-3.1-pro-preview',
      label: 'Gemini 3.1 Pro',
      tier: 'premium',
    })
  }

  return completed
}

export function modelPatchForChoice(status: AiProvidersStatusResponse | null, provider: string, choice: string) {
  if (choice === 'auto') {
    return {
      default_model_alias: 'auto',
      model: null,
      model_identity: null,
      model_label: null,
      model_tier: null,
    }
  }

  const selected = providerModelCatalog(modelPolicyByProvider(status, provider)).find((item) => item.key === choice)
  if (!selected?.model) {
    return {
      default_model_alias: 'auto',
      model: null,
      model_identity: null,
      model_label: null,
      model_tier: null,
    }
  }

  return {
    ...modelPatch({
      model: selected.model,
      model_label: selected.label || selected.model,
      model_tier: selected.tier || 'daily',
    }),
    default_model_alias: selected.alias || selected.key,
  }
}

export function compactSegmentLabel(label: string): string {
  return label
    .replace(/\s+CLI$/i, '')
    .replace(/^Gemini\s+/i, '')
    .replace(/^Claude\s+/i, '')
    .replace(/^GPT-5\./i, '5.')
    .replace(/^GPT-/i, '')
    .replace(/Codex-/i, '')
    .replace(/\s+Preview$/i, '')
}

export function compactModelLabel(item: ProviderModelCatalogOption): string {
  if (item.key === 'gemini_flash' || item.alias === 'gemini_flash') return '3.5 Flash'
  if (item.key === 'gemini_pro' || item.alias === 'gemini_pro') return '3.1 Pro'
  return compactSegmentLabel(item.label)
}

export function modelPatch(model: { model: string; model_label: string; model_tier: string }) {
  return {
    model: model.model,
    model_identity: model.model,
    model_label: model.model_label,
    model_tier: model.model_tier,
  }
}

export function providerModelLabel(status: AiProvidersStatusResponse | null, provider: string, fallbackModel?: string | null): string {
  const policy = modelPolicyByProvider(status, provider)
  if (fallbackModel && policy?.model === fallbackModel) return policy.model_label || fallbackModel
  return policy?.model_label || fallbackModel || policy?.model || 'CLI default'
}

export function providerAutomationStatus(status: AiProvidersStatusResponse | null, provider: string): ConnectionStatusKind {
  const policy = modelPolicyByProvider(status, provider)
  if (!policy) return 'offline'
  return policy.allow_auto ? 'pending' : 'online'
}

export function providerAutomationDescription(status: AiProvidersStatusResponse | null, provider: string): string {
  const policy = modelPolicyByProvider(status, provider)
  if (!policy) return 'Política de modelo ainda não verificada'
  const manual = policy.allow_manual ? 'manual permitido' : 'manual bloqueado'
  const automatic = policy.allow_auto ? 'automático permitido' : 'automático bloqueado'
  const model = policy.model_label || policy.model || 'CLI default'
  return `${automatic} · ${manual} · default ${model}`
}

export function workerByProvider(status: AiProvidersStatusResponse | null, provider: string) {
  return status?.workers?.find((item) => item.provider === provider) ?? null
}

export function providerWorkerStatus(status: AiProvidersStatusResponse | null, provider: string): ConnectionStatusKind {
  const worker = workerByProvider(status, provider)
  if (!worker) return 'offline'
  if (worker.status === 'running') return 'online'
  if (worker.status === 'stale') return 'pending'
  return 'offline'
}

export function providerWorkerDescription(status: AiProvidersStatusResponse | null, provider: string): string {
  const worker = workerByProvider(status, provider)
  if (!worker) return 'Sem evento de worker registrado'

  const when = formatRelativeSync(worker.occurred_at)
  if (worker.status === 'running') return `${worker.event_type ?? 'worker'} · rodando · ${when}`
  if (worker.status === 'stale') return `${worker.event_type ?? 'worker'} · visto recentemente · ${when}`
  if (worker.status === 'stopped') return `${worker.event_type ?? 'worker'} · parado · ${when}`
  return worker.message ? `${worker.message} · ${when}` : `Sem heartbeat recente · ${when}`
}

export function aiQueueHasWork(status: AiProvidersStatusResponse | null): boolean {
  return !!status && (status.queue.queued > 0 || status.queue.processing > 0 || (status.queue.awaiting_user_choice ?? 0) > 0 || status.queue.failed > 0)
}

export function aiQueueValue(status: AiProvidersStatusResponse | null): string {
  if (!status) return '-'
  return `${status.queue.queued}/${status.queue.processing}/${status.queue.awaiting_user_choice ?? 0}/${status.queue.failed}`
}

export function aiQueueDescription(status: AiProvidersStatusResponse | null): string {
  if (!status) return 'Fila ainda não verificada'
  const active = (status.queue.by_provider ?? [])
    .filter((item) => item.queued + item.processing + (item.awaiting_user_choice ?? 0) + item.failed > 0)
    .map((item) => `${providerLabel(item.provider)} ${item.queued}/${item.processing}/${item.awaiting_user_choice ?? 0}/${item.failed}`)

  if (active.length === 0) return '0 aguardando · 0 processando · 0 escolha · 0 falhas'
  return active.join(' · ')
}

export function activeAiJob(status: AiProvidersStatusResponse | null) {
  return status?.active_jobs?.find((job) => job.status === 'processing')
    ?? null
}

export function activeAiJobValue(status: AiProvidersStatusResponse | null): string {
  const job = activeAiJob(status)
  if (!job) return 'nada'
  return activeAiJobShortLabel(job)
}

export function activeAiJobDescription(status: AiProvidersStatusResponse | null): string {
  if (!status) return 'Jobs ativos ainda não verificados'
  const job = activeAiJob(status)
  if (!job) {
    const waiting = status.active_jobs?.find((item) => item.status === 'queued' || item.status === 'awaiting_user_choice')
    if (!waiting) return 'Nada processando agora'
    const waitingStage = activeAiJobStageLabel(waiting)
    const waitingDependency = activeAiJobDependencyLabel(waiting)
    return `Nada processando · ${activeAiJobShortLabel(waiting)} ${waiting.status}${waitingStage}${waitingDependency} · atualizado ${formatRelativeSync(waiting.updated_at)}`
  }
  const model = job.model_label || providerModelLabel(status, job.provider ?? '', job.model)
  const tier = job.model_tier ? ` · tier ${job.model_tier}` : ''
  const worker = job.worker_id ? ` · ${job.worker_id}` : ''
  const stage = activeAiJobStageLabel(job)
  const dependency = activeAiJobDependencyLabel(job)
  return `${job.status}${stage}${dependency} · ${model}${tier}${worker} · atualizado ${formatRelativeSync(job.updated_at)}`
}

export function activeAiJobShortLabel(job: AtlasAiActiveJob): string {
  const provider = providerLabel(job.provider)
  const stage = job.atlas_decide_stage ?? job.atlas_decide_execution?.atlas_decide_stage ?? null

  if (stage === 'context_scout') return `${provider} scout`
  if (stage === 'primary_executor') return `${provider} executor`

  return provider
}

export function activeAiJobStageLabel(job: AtlasAiActiveJob): string {
  const stage = job.atlas_decide_stage ?? job.atlas_decide_execution?.atlas_decide_stage ?? null
  if (stage === 'context_scout') return ' · Atlas Decide scout'
  if (stage === 'primary_executor') return ' · Atlas Decide executor'
  if (stage) return ` · ${stage}`
  return ''
}

export function activeAiJobDependencyLabel(job: AtlasAiActiveJob): string {
  const dependency = job.dependency_state ?? job.atlas_decide_execution?.dependency_state ?? null
  if (!dependency || dependency === 'none' || dependency === 'source') return ''
  return ` · dependência ${dependency}`
}

export function usageByProvider(status: AiProvidersStatusResponse | null, provider: string) {
  return status?.usage_24h?.by_provider.find((item) => item.provider === provider) ?? null
}

export function providerUsageHasActivity(status: AiProvidersStatusResponse | null, provider: string): boolean {
  const usage = usageByProvider(status, provider)
  return !!usage && usage.traces > 0
}

export function providerUsageValue(status: AiProvidersStatusResponse | null, provider: string): string {
  if (!status?.usage_24h?.available) return 'sem dados'
  const usage = usageByProvider(status, provider)
  if (!usage) return '0 tok'
  const tokens = usage.visible_tokens || usage.estimated_tokens || usage.total_tokens
  return `${formatCompactNumber(tokens)} tok`
}

export function providerUsageDescription(status: AiProvidersStatusResponse | null, provider: string): string {
  if (!status?.usage_24h?.available) return 'Telemetria de tokens ainda não disponível'
  const usage = usageByProvider(status, provider)
  if (!usage) return '0 execuções nas últimas 24h'

  const failures = usage.failed_traces > 0 ? ` · ${usage.failed_traces} falhas` : ''
  const cost = usage.cost_usd_estimate > 0
    ? ` · ~US$ ${usage.cost_usd_estimate.toFixed(4)}`
    : usage.unknown_cost_count > 0
      ? ` · ${usage.unknown_cost_count} sem custo calculado`
      : ''

  const modelUsage = (status.usage_24h.by_model ?? [])
    .filter((item) => item.provider === provider)
    .filter((item) => item.traces > 0)
    .map((item) => `${providerModelLabel(status, provider, item.model)} ${formatCompactNumber(item.visible_tokens || item.estimated_tokens || item.total_tokens)} tok`)
    .slice(0, 2)
    .join(' · ')
  const models = modelUsage ? ` · ${modelUsage}` : ''

  return `${usage.traces} execuções${failures}${cost}${models} · atualizado ${formatRelativeSync(usage.last_computed_at)}`
}

export function aiBudgetDescription(status: AiProvidersStatusResponse | null): string {
  const budget = status?.budget
  if (!budget) return 'Budget ainda não carregado'
  if (!budget.available) return 'Tabela de telemetria ainda não disponível'

  const mode = budget.enabled
    ? budget.mode === 'block' ? 'bloqueia no limite' : 'monitora'
    : 'desligado'
  const used = formatCompactNumber(budget.totals.visible_tokens)
  const max = budget.totals.max_visible_tokens ? `/${formatCompactNumber(budget.totals.max_visible_tokens)}` : ''
  return `${mode} · janela ${budget.window_hours}h · ${used}${max} tok visíveis`
}

export function budgetByProvider(status: AiProvidersStatusResponse | null, provider: string) {
  return status?.budget?.providers.find((item) => item.provider === provider) ?? null
}

export function providerBudgetDescription(status: AiProvidersStatusResponse | null, provider: string): string {
  const budget = budgetByProvider(status, provider)
  if (!status?.budget?.available) return 'Sem telemetria para medir limite'
  if (!budget) return 'Sem budget configurado para provider'

  const used = formatCompactNumber(budget.visible_tokens)
  const max = budget.max_visible_tokens ? formatCompactNumber(budget.max_visible_tokens) : 'sem limite'
  const remaining = budget.remaining_visible_tokens == null ? '' : ` · resta ${formatCompactNumber(budget.remaining_visible_tokens)}`
  const state = budget.status === 'blocked' ? 'bloqueado' : budget.status === 'warning' ? 'atenção' : 'ok'
  return `${state} · ${used}/${max} tok em ${status.budget.window_hours}h${remaining}`
}

export function budgetPresetOptions(): SegOption[] {
  return [
    { key: 'none', label: 'Sem' },
    { key: '50k', label: '50k' },
    { key: '100k', label: '100k' },
    { key: '250k', label: '250k' },
  ]
}

export function providerBudgetChoice(status: AiProvidersStatusResponse | null, provider: string): string {
  const max = budgetByProvider(status, provider)?.max_visible_tokens ?? null
  if (max === 50_000) return '50k'
  if (max === 100_000) return '100k'
  if (max === 250_000) return '250k'
  return 'none'
}

export function budgetValueForChoice(choice: string): number | null {
  if (choice === '50k') return 50_000
  if (choice === '100k') return 100_000
  if (choice === '250k') return 250_000
  return null
}

export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (value >= 1_000_000) return `${trimFixed(value / 1_000_000)}M`
  if (value >= 1_000) return `${trimFixed(value / 1_000)}k`
  return String(Math.round(value))
}

export function trimFixed(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}

export function providerByKey(status: AiProvidersStatusResponse | null, provider: string): ProviderHealth | null {
  return status?.providers.find((item) => item.provider === provider) ?? null
}

export function aiGatewayStatus(
  status: AiProvidersStatusResponse | null,
  error: string | null,
  loading: boolean,
): ConnectionStatusKind {
  if (loading) return 'pending'
  if (error) return 'offline'
  if (!status) return 'offline'

  const workerState = aiWorkerState(status)
  const hasQueue = status.queue.queued > 0 || status.queue.processing > 0
  if (hasQueue && workerState !== 'running') return 'offline'
  if (status.queue.failed > 0 || hasQueue) return 'pending'

  return 'online'
}

export function aiGatewayDescription(status: AiProvidersStatusResponse | null, error: string | null): string {
  if (error) return error
  if (!status) return 'Status ainda não verificado'

  const total = status.queue.queued + status.queue.processing + status.queue.failed
  const workerState = aiWorkerState(status)
  if (status.queue.queued > 0 && workerState !== 'running') {
    return `Worker local parado · ${status.queue.queued} ${status.queue.queued === 1 ? 'item aguardando' : 'itens aguardando'}`
  }

  if (total === 0) {
    const hasFreshWorker = status.providers.some((provider) => providerHealthIsFresh(provider))
    if (workerState === 'running') return 'Worker local rodando; fila vazia'
    return hasFreshWorker
      ? 'Gateway responde; CLIs verificados, mas worker não está contínuo'
      : 'Gateway responde; health do worker local desatualizado'
  }

  if (workerState === 'running') {
    return `${status.queue.queued} na fila · ${status.queue.processing} processando · worker ativo`
  }

  return `${status.queue.queued} na fila · ${status.queue.processing} processando · ${status.queue.failed} falhas`
}

export type AiWorkerState = 'running' | 'stopped' | 'stale' | 'unknown'

export function aiWorkerState(status: AiProvidersStatusResponse): AiWorkerState {
  const workerEvent = status.recent_events.find((event) => event.event_type.startsWith('worker_'))
  if (!workerEvent) return 'unknown'
  if (workerEvent.event_type === 'worker_stopped') return 'stopped'
  if (!workerEvent.occurred_at) return 'unknown'

  const occurredAt = new Date(workerEvent.occurred_at).getTime()
  if (!Number.isFinite(occurredAt)) return 'unknown'
  return Date.now() - occurredAt <= AI_WORKER_FRESH_MS ? 'running' : 'stale'
}

export function providerStatus(status: AiProvidersStatusResponse | null, providerKey: string): ConnectionStatusKind {
  const provider = providerByKey(status, providerKey)
  if (!provider) return 'offline'

  const recentEvent = recentProviderEvent(status, providerKey)
  const hasFreshSuccess = recentEvent?.event_type === 'job_succeeded' || recentEvent?.event_type === 'health_check'
  const hasFreshFailure = ['job_failed', 'timeout', 'auth_expired', 'rate_limited'].includes(recentEvent?.event_type ?? '')

  if (!providerHealthIsFresh(provider) && !hasFreshSuccess && !hasFreshFailure) return 'pending'
  if (hasFreshFailure) return recentEvent?.event_type === 'auth_expired' ? 'offline' : 'pending'
  if (provider.status === 'online' && provider.operational_pain_score === 0) return 'online'
  if (hasFreshSuccess) return 'online'
  if (provider.status === 'online' || provider.status === 'degraded') return 'pending'
  return 'offline'
}

export function providerDescription(status: AiProvidersStatusResponse | null, providerKey: string): string {
  const provider = providerByKey(status, providerKey)
  if (!provider) return 'Sem health check registrado'

  const model = providerModelLabel(status, providerKey, provider.model)
  const tier = provider.model_tier ? `/${provider.model_tier}` : ''
  const message = provider.message ? ` · ${provider.message}` : ''
  const modelText = ` · modelo ${model}${tier}`
  const recentEvent = recentProviderEvent(status, providerKey)
  if (recentEvent?.event_type === 'job_succeeded') {
    return `Último job ok · ${formatRelativeSync(recentEvent.occurred_at)}${modelText}${message}`
  }
  if (recentEvent && ['job_failed', 'timeout', 'auth_expired', 'rate_limited'].includes(recentEvent.event_type)) {
    return `${recentEvent.message} · ${formatRelativeSync(recentEvent.occurred_at)}${modelText}${message}`
  }

  if (!providerHealthIsFresh(provider)) {
    return `Health check desatualizado · ${formatRelativeSync(provider.checked_at)}${modelText}${message}`
  }

  return `${providerPainLabel(provider.operational_pain_score)} · ${formatRelativeSync(provider.checked_at)}${modelText}${message}`
}

export function recentProviderEvent(status: AiProvidersStatusResponse | null, provider: string) {
  const event = status?.recent_events.find((item) => item.provider === provider)
  if (!event) return null
  if (!event.occurred_at) return null

  const occurredAt = new Date(event.occurred_at).getTime()
  if (!Number.isFinite(occurredAt)) return null
  return Date.now() - occurredAt <= PROVIDER_HEALTH_FRESH_MS ? event : null
}

export function providerHealthIsFresh(provider: ProviderHealth): boolean {
  if (!provider.checked_at) return false

  const checkedAt = new Date(provider.checked_at).getTime()
  if (!Number.isFinite(checkedAt)) return false

  return Date.now() - checkedAt <= PROVIDER_HEALTH_FRESH_MS
}

export function providerPainLabel(score: number): string {
  if (score <= 0) return 'Sem dor operacional'
  if (score === 1) return 'Dor operacional leve'
  if (score === 2) return 'Dor operacional moderada'
  if (score === 3) return 'Dor operacional alta'
  return 'Dor operacional crítica'
}

export function lastAiEventDescription(status: AiProvidersStatusResponse | null): string {
  const event = status?.recent_events[0]
  if (!event) return 'Nenhum evento do worker registrado'

  return `${event.event_type} · ${event.message}`
}

export function queueDescription(counts: {
  queuedCaptures: number
  queuedCheckins: number
  queuedBehaviors: number
  queuedBehaviorLogs: number
  queuedSignals: number
  queuedSnapshots: number
  queuedDigitalSessions: number
  queuedDigitalSnapshots: number
}): string {
  return `${counts.queuedCaptures} capturas · ${counts.queuedCheckins} check-ins · ${counts.queuedBehaviors} comportamentos · ${counts.queuedBehaviorLogs} logs · ${counts.queuedSignals} sinais · ${counts.queuedSnapshots} saúde · ${counts.queuedDigitalSessions} sessões digitais · ${counts.queuedDigitalSnapshots} snapshots digitais`
}

export function firstQueueError(errors: Array<string | null | undefined>): string | null {
  return errors.find((error) => Boolean(error?.trim()))?.trim() ?? null
}

export function humanAiError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback
  if (message.includes('route ai/') || message.includes('rota ai/')) {
    return 'Atlas não está carregado no servidor. Rebuild/restart o atlas-server.'
  }

  return message
}

export function healthKitDescription(healthKit: {
  available: boolean
  enabled: boolean
  requestedTypeCount: number
  debugTrail: string[]
  historyBackfilled: boolean
  historyBackfilledAt: string | null
  backgroundConfiguredAt: string | null
}): string {
  if (!healthKit.available) return 'HealthKit indisponível neste aparelho'
  if (!healthKit.enabled) return `${healthKit.requestedTypeCount || 0} tipos de leitura aguardando permissão`
  return `${healthKit.requestedTypeCount || 0} tipos de leitura solicitados`
}

export function voicePermissionStatusKind(permission: VoicePermission | null, busy: boolean): ConnectionStatusKind {
  if (busy) return 'pending'
  if (!permission) return 'pending'
  return permission.granted ? 'online' : 'offline'
}

export function voicePermissionDescription(permission: VoicePermission | null): string {
  if (!permission) return 'Toque para verificar a permissão do microfone'
  if (permission.granted) return 'Microfone liberado para conversa por voz'
  if (permission.canAskAgain === false) return 'Bloqueado nos Ajustes do iPhone'
  return 'Aguardando permissão do iOS'
}

export function screenTimeStatusKind(
  screenTime: ScreenTimeLocalStatus,
  syncing: boolean,
): ConnectionStatusKind {
  if (syncing) return 'pending'
  if (!screenTime.available || !screenTime.enabled) return 'offline'
  if (screenTime.lastError || screenTime.configuredBucketCount <= 0) return 'pending'
  return 'online'
}

export function screenTimeDescription(screenTime: ScreenTimeLocalStatus): string {
  if (!screenTime.nativeModuleAvailable) {
    return screenTime.lastError ?? 'Modulo iOS nativo ausente neste build'
  }
  if (screenTime.entitlementRequired) {
    return 'Family Controls/DeviceActivity exige entitlement aprovado no build iOS'
  }
  if (!screenTime.available) {
    return screenTime.lastError ?? 'Rastreamento nativo pausado; Sensor 4 segue via Rize/backend'
  }
  if (!screenTime.enabled) {
    return 'Autorize o Tempo de Uso para medir buckets cognitivos'
  }
  if (screenTime.configuredBucketCount <= 0) {
    return 'Permissão ok; falta selecionar os buckets'
  }
  return `${screenTime.configuredBucketCount} buckets ativos · dados selecionados pelo operador`
}

export function domainPrivacyLabel(value?: string | null): string {
  if (value === 'sensitive') return 'sensível'
  if (value === 'private') return 'privado'
  return 'normal'
}

export function policyFlowOptions(profiles: AtlasAiPolicyProfilesResponse | null): AtlasAiFlowProfile[] {
  const flows = profiles?.profile_registry.flows ?? []
  const priority = [
    'programming.dev',
    'programming.forge',
    'research.quick',
    'research.super',
    'finance.research',
    'personal_development.reflect',
    'background.safe',
  ]

  return [...flows]
    .sort((left, right) => {
      const leftRank = priority.indexOf(left.id)
      const rightRank = priority.indexOf(right.id)
      if (leftRank !== -1 || rightRank !== -1) {
        return (leftRank === -1 ? 999 : leftRank) - (rightRank === -1 ? 999 : rightRank)
      }
      return left.id.localeCompare(right.id)
    })
    .slice(0, 8)
}
