import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import type { DomainKey } from '../domains'

const extraAtlas = (Constants.expoConfig?.extra?.atlas ?? {}) as Partial<ApiConfig>

const DEFAULT_HOST = extraAtlas.apiHost ?? 'vitors-macbook-pro-1'
const DEFAULT_PORT = Number(extraAtlas.apiPort ?? 3737)
const DEFAULT_TOKEN = extraAtlas.apiToken ?? 'local-development-atlas-token-change-me'

const HOST_KEY = 'atlas-api.host'
const PORT_KEY = 'atlas-api.port'
const TOKEN_KEY = 'atlas-api.token'

let cachedHost: string | null = null
let cachedPort: number | null = null
let cachedToken: string | null = null
let hydratePromise: Promise<void> | null = null

export interface ApiConfig {
  apiHost: string
  apiPort: number
  apiToken: string
}

export interface AtlasHealth {
  status: 'ok' | string
  version: string
  service: string
  ts: string
  db_connected: boolean
}

export type CaptureKind = 'audio' | 'text' | 'photo'
export type TranscriptionStatus = 'pending' | 'processing' | 'done' | 'failed' | 'na'

export interface AtlasCapture {
  id: string
  client_id: string
  kind: CaptureKind
  domain: DomainKey
  content_text: string | null
  content_file_path: string | null
  content_duration_ms: number | null
  content_size_bytes: number | null
  content_sha256: string | null
  content_mime_type: string | null
  transcription_status: TranscriptionStatus
  transcription_engine: string | null
  transcription_error: string | null
  captured_at: string
  captured_timezone: string
  captured_lat: number | null
  captured_lng: number | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AtlasCheckin {
  id: string
  client_id: string
  state: 'focused' | 'disperse' | 'blocked' | 'pause'
  energy_level: number
  mood_level: number
  note: string | null
  recorded_at: string
  recorded_timezone: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AtlasPassiveSignal {
  id: string
  client_id: string
  source: 'healthkit' | 'rize'
  signal_type: string
  value_numeric: number | null
  value_text: string | null
  unit: string | null
  started_at: string
  ended_at: string | null
  recorded_timezone: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AtlasDailyMission {
  id: string
  date: string
  timezone: string
  title: string
  detail: string | null
  status: 'active' | 'done' | 'skipped' | string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AtlasHealthSnapshot {
  id: string
  client_id: string
  source: 'atlas_app' | 'server' | 'import'
  snapshot_date: string
  snapshot_timezone: string
  computed_at: string
  signal_count: number
  readiness_score: number | null
  current_score: number | null
  body_score: number | null
  mind_score: number | null
  drive_score: number | null
  sleep_score: number | null
  autonomic_score: number | null
  load_score: number | null
  subjective_score: number | null
  stability_score: number | null
  confidence: number | null
  sleep_duration_hours: number | null
  sleep_efficiency: number | null
  hrv_ms: number | null
  resting_heart_rate_bpm: number | null
  respiratory_rate: number | null
  wrist_temperature_c: number | null
  active_energy_kcal: number | null
  basal_energy_kcal: number | null
  exercise_minutes: number | null
  stand_minutes: number | null
  steps: number | null
  walking_running_distance_m: number | null
  vo2max: number | null
  body_mass_kg: number | null
  body_fat_percentage: number | null
  lean_body_mass_kg: number | null
  muscle_mass_percentage: number | null
  body_mass_index: number | null
  waist_circumference_cm: number | null
  energy_level: number | null
  mood_level: number | null
  state: AtlasCheckin['state'] | null
  metrics: Record<string, unknown>
  readiness: Record<string, unknown>
  sleep: Record<string, unknown>
  recovery: Record<string, unknown>
  load: Record<string, unknown>
  subjective: Record<string, unknown>
  body: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type BehaviorCategory =
  | 'bebida'
  | 'alimentacao'
  | 'conflito'
  | 'sono'
  | 'treino'
  | 'suplemento'
  | 'social'
  | 'trabalho'
  | 'outro'

export type BehaviorInputType = 'yes_no' | 'scale_1_5' | 'count_int' | 'text_short'

export interface AtlasBehavior {
  id: string
  client_id: string
  name: string
  slug: string
  category: BehaviorCategory
  input_type: BehaviorInputType
  question_text: string
  default_value: string
  created_by: 'operator' | 'ai_suggestion' | 'import'
  source_capture_ids: unknown[]
  activation_rules: Record<string, unknown>
  show_in_morning_briefing: boolean
  priority_score: number
  streak_yes: number
  streak_no: number
  total_yes_count: number
  total_no_count: number
  relational_privacy: boolean
  activated_at: string
  archived_at: string | null
  promoted_to_object_type: string | null
  promoted_to_object_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AtlasBehaviorLog {
  id: string
  client_id: string
  behavior_id: string | null
  behavior_client_id: string
  log_date: string
  value: string
  numeric_value: number | null
  note: string | null
  recorded_at: string
  recorded_timezone: string
  source: 'morning_briefing' | 'voice_capture' | 'manual' | 'retroactive' | 'import'
  source_capture_id: string | null
  auto_marked: boolean
  confirmed_by_operator: boolean
  reverted_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type SemanticNoteType =
  | 'source_note'
  | 'mental_model'
  | 'principle'
  | 'hypothesis'
  | 'practice'
  | 'synthesis'
  | 'decision_identity'
  | 'cognitive_game'

export type SemanticNoteStatus = 'inbox' | 'draft' | 'active' | 'testing' | 'validated' | 'archived' | 'invalid'

export interface AtlasSemanticNote {
  id: string
  note_key: string
  path: string
  title: string
  type: SemanticNoteType
  status: SemanticNoteStatus
  confidence: 'low' | 'medium' | 'high' | 'validated'
  maturity: 'seed' | 'draft' | 'useful' | 'tested' | 'principle' | 'archived'
  domains: unknown[]
  summary: string | null
  body_excerpt: string | null
  frontmatter: Record<string, unknown>
  when_to_use: unknown[]
  trigger_signals: unknown[]
  do_not_use_when: unknown[]
  postgres_refs: Record<string, unknown>
  content_hash: string
  indexed_at: string | null
  last_seen_at: string | null
  last_activated_at: string | null
  last_practiced_at: string | null
  activation_count: number
  usefulness_avg: number | null
  validation_errors: unknown[]
  metadata: Record<string, unknown>
  score?: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AtlasSemanticCurationProposal {
  id: string
  source_type: 'capture' | 'transcription' | 'behavior_pattern' | 'health_pattern' | 'rize_pattern' | 'manual'
  source_refs: Record<string, unknown>
  proposed_note_type: SemanticNoteType
  proposed_title: string
  proposed_summary: string
  proposed_path: string | null
  proposed_frontmatter: Record<string, unknown>
  proposed_body: string | null
  score: number | null
  reason: string
  status: 'pending' | 'accepted' | 'edited' | 'dismissed' | 'postponed'
  shown_at: string | null
  resolved_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasSemanticActivation {
  id: string
  note_id: string
  note?: AtlasSemanticNote
  activation_type: 'remember' | 'practice' | 'connect' | 'confront' | 'test' | 'promote' | 'archive_review'
  context_type: string
  context_payload: Record<string, unknown>
  prompt: string
  shown_at: string | null
  acted_at: string | null
  dismissed_at: string | null
  usefulness_score: number | null
  operator_feedback: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasVaultHealthSnapshot {
  id: string
  snapshot_date: string
  total_notes: number
  active_notes: number
  inbox_notes: number
  invalid_notes: number
  stale_notes: number
  notes_without_triggers: number
  notes_without_links: number
  activations_7d: number
  useful_activations_7d: number
  health_state: 'healthy' | 'inflated' | 'cold' | 'anxious' | 'mature' | 'needs_attention'
  recommendations: unknown[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasCognitiveGameRun {
  id: string
  game_key: string
  title: string
  input_note_ids: unknown[]
  prompt: string
  operator_answer: string | null
  atlas_feedback: string | null
  score: number | null
  duration_seconds: number | null
  promoted_note_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type AtlasAiProvider = 'claude_cli' | 'codex_cli'
export type AtlasAiStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled'

export interface AtlasAiJob {
  id: string
  trace_id: string | null
  client_id: string | null
  kind: 'interaction' | 'curation' | 'analysis' | 'council' | 'skill_test' | 'manual'
  status: AtlasAiStatus
  priority: number
  agent_slug: string
  provider: AtlasAiProvider | string | null
  model: string | null
  input_text: string
  context_refs: unknown[]
  payload: Record<string, unknown>
  result_text: string | null
  result_json: Record<string, unknown>
  error_code: string | null
  error_message: string | null
  available_at: string | null
  reserved_at: string | null
  started_at: string | null
  finished_at: string | null
  attempts: number
  max_attempts: number
  timeout_seconds: number
  worker_id: string | null
  metadata: Record<string, unknown>
  attempt_history?: AtlasAiJobAttempt[]
  created_at: string
  updated_at: string
}

export interface AtlasAiJobAttempt {
  id: string
  ai_job_id: string
  attempt_number: number
  worker_id: string
  provider: AtlasAiProvider | string
  model: string | null
  command: unknown[]
  command_hash: string | null
  prompt_hash: string
  response_hash: string | null
  status: 'processing' | 'succeeded' | 'failed' | 'timeout' | 'cancelled'
  exit_code: number | null
  duration_ms: number | null
  output_text: string | null
  stdout_excerpt: string | null
  stderr_excerpt: string | null
  error_code: string | null
  error_message: string | null
  started_at: string
  finished_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasAiTrace {
  id: string
  trace_key: string
  source_type: string
  source_id: string | null
  status: AtlasAiStatus
  operator_input: string
  intent: string | null
  agent_slug: string
  provider: AtlasAiProvider | string | null
  model: string | null
  skill_versions: Record<string, unknown>
  context_refs: unknown[]
  prompt_hash: string | null
  response_hash: string | null
  response_text: string | null
  latency_ms: number | null
  feedback_score: number | null
  feedback_action: string | null
  feedback_comment: string | null
  completed_at: string | null
  metadata: Record<string, unknown>
  job?: AtlasAiJob
  jobs?: AtlasAiJob[]
  created_at: string
  updated_at: string
}

export interface AtlasAiProviderHealth {
  id: string
  provider: AtlasAiProvider | string
  status: 'online' | 'degraded' | 'offline' | 'unknown'
  checked_at: string
  last_success_at: string | null
  last_failure_at: string | null
  total_jobs_24h: number
  failed_jobs_24h: number
  p50_latency_ms: number | null
  operational_pain_score: number
  message: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface AtlasAiWorkerEvent {
  id: string
  worker_id: string
  provider: AtlasAiProvider | string | null
  ai_job_id: string | null
  ai_job_attempt_id: string | null
  event_type: string
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical'
  message: string
  metadata: Record<string, unknown>
  occurred_at: string
  created_at: string
}

export interface AiProvidersStatusResponse {
  queue: { queued: number; processing: number; failed: number }
  providers: AtlasAiProviderHealth[]
  recent_events: AtlasAiWorkerEvent[]
}

export interface CapturesResponse {
  captures: AtlasCapture[]
  next_cursor: string | null
  has_more: boolean
}

export interface CheckinsResponse {
  checkins: AtlasCheckin[]
  next_cursor: string | null
  has_more: boolean
}

export interface PassiveSignalsResponse {
  passive_signals: AtlasPassiveSignal[]
  next_cursor: string | null
  has_more: boolean
}

export interface HealthSnapshotsResponse {
  health_snapshots: AtlasHealthSnapshot[]
  next_cursor: string | null
  has_more: boolean
}

export interface BehaviorsResponse {
  behaviors: AtlasBehavior[]
  next_cursor: string | null
  has_more: boolean
}

export interface BehaviorLogsResponse {
  behavior_logs: AtlasBehaviorLog[]
  next_cursor: string | null
  has_more: boolean
}

export interface MissionTodayResponse {
  date: string
  timezone: string
  mission: AtlasDailyMission | null
}

export interface SemanticNotesResponse {
  notes: AtlasSemanticNote[]
}

export interface SemanticNoteDetailResponse {
  note: AtlasSemanticNote
  content: string | null
}

export interface SemanticCurationProposalsResponse {
  proposals: AtlasSemanticCurationProposal[]
}

export interface SemanticActivationsResponse {
  activations: AtlasSemanticActivation[]
}

export interface CognitiveGameTodayResponse {
  game: AtlasCognitiveGameRun | null
}

export interface AiInteractionsResponse {
  traces: AtlasAiTrace[]
}

export interface AiJobsResponse {
  jobs: AtlasAiJob[]
}

export interface SyncDeltaInput {
  device_id: string
  last_sync_at?: string | null
  captures_to_upload?: StoreTextCaptureInput[]
  checkins_to_upload?: StoreCheckinInput[]
  passive_signals_to_upload?: StorePassiveSignalInput[]
  health_snapshots_to_upload?: StoreHealthSnapshotInput[]
  behaviors_to_upload?: StoreBehaviorInput[]
  behavior_logs_to_upload?: StoreBehaviorLogInput[]
  metadata?: Record<string, unknown>
}

export interface SyncDeltaResponse {
  synced_at: string
  captures_uploaded: number
  captures_downloaded: AtlasCapture[]
  checkins_uploaded: number
  checkins_downloaded: AtlasCheckin[]
  passive_signals_uploaded: number
  passive_signals_downloaded: AtlasPassiveSignal[]
  health_snapshots_uploaded: number
  health_snapshots_downloaded: AtlasHealthSnapshot[]
  behaviors_uploaded: number
  behaviors_downloaded: AtlasBehavior[]
  behavior_logs_uploaded: number
  behavior_logs_downloaded: AtlasBehaviorLog[]
  next_full_sync_recommended_at: string
}

export class AtlasApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly payload: unknown,
  ) {
    super(message)
    this.name = 'AtlasApiError'
  }
}

export async function hydrateApiConfig(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      const [host, port, token] = await Promise.all([
        AsyncStorage.getItem(HOST_KEY),
        AsyncStorage.getItem(PORT_KEY),
        readStoredToken(),
      ])

      if (host) cachedHost = host
      if (port) {
        const n = Number(port)
        if (Number.isFinite(n) && n > 0) cachedPort = n
      }
      if (token) cachedToken = token
    })()
  }

  await hydratePromise
}

export function getBackendHost(): string {
  return cachedHost ?? DEFAULT_HOST
}

export function getBackendPort(): number {
  return cachedPort ?? DEFAULT_PORT
}

export function getBackendToken(): string {
  return cachedToken ?? DEFAULT_TOKEN
}

export function getApiConfig(): ApiConfig {
  return {
    apiHost: getBackendHost(),
    apiPort: getBackendPort(),
    apiToken: getBackendToken(),
  }
}

export async function setBackendHost(host: string): Promise<void> {
  cachedHost = host.trim() || DEFAULT_HOST
  await AsyncStorage.setItem(HOST_KEY, cachedHost)
}

export async function setBackendPort(port: number): Promise<void> {
  cachedPort = Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT
  await AsyncStorage.setItem(PORT_KEY, String(cachedPort))
}

export async function setBackendToken(token: string): Promise<void> {
  cachedToken = token.trim() || DEFAULT_TOKEN
  await writeStoredToken(cachedToken)
}

export function getApiBase(): string {
  const host = getBackendHost().replace(/\/+$/, '')
  if (host.startsWith('http://') || host.startsWith('https://')) return host

  return `http://${host}:${getBackendPort()}`
}

export function getAtlasAuthHeaders(): Record<string, string> {
  return { 'X-Atlas-Token': getBackendToken() }
}

export function getCaptureFileUrl(captureId: string): string {
  return `${getApiBase()}/captures/${encodeURIComponent(captureId)}/file`
}

export async function getHealth(): Promise<AtlasHealth> {
  return apiGet<AtlasHealth>('/health', { auth: false })
}

export async function listCaptures(params: {
  since?: string | null
  limit?: number
  cursor?: string | null
  domain?: DomainKey
  kind?: CaptureKind
} = {}): Promise<CapturesResponse> {
  return apiGet<CapturesResponse>(`/captures${queryString(params)}`)
}

export async function listCheckins(params: {
  since?: string | null
  limit?: number
  cursor?: string | null
  state?: AtlasCheckin['state']
  energy_level?: number
  mood_level?: number
} = {}): Promise<CheckinsResponse> {
  return apiGet<CheckinsResponse>(`/checkins${queryString(params)}`)
}

export async function listPassiveSignals(params: {
  since?: string | null
  limit?: number
  cursor?: string | null
  source?: AtlasPassiveSignal['source']
  signal_type?: string
} = {}): Promise<PassiveSignalsResponse> {
  return apiGet<PassiveSignalsResponse>(`/passive-signals${queryString(params)}`)
}

export async function listHealthSnapshots(params: {
  since?: string | null
  limit?: number
  cursor?: string | null
  source?: AtlasHealthSnapshot['source']
  date_from?: string
  date_to?: string
} = {}): Promise<HealthSnapshotsResponse> {
  return apiGet<HealthSnapshotsResponse>(`/health-snapshots${queryString(params)}`)
}

export async function listBehaviors(params: {
  since?: string | null
  limit?: number
  cursor?: string | null
  category?: BehaviorCategory
  active?: boolean
  briefing?: boolean
} = {}): Promise<BehaviorsResponse> {
  return apiGet<BehaviorsResponse>(`/behaviors${queryString(params)}`)
}

export async function listBehaviorLogs(params: {
  since?: string | null
  limit?: number
  cursor?: string | null
  behavior_client_id?: string
  date_from?: string
  date_to?: string
  source?: AtlasBehaviorLog['source']
} = {}): Promise<BehaviorLogsResponse> {
  return apiGet<BehaviorLogsResponse>(`/behavior-logs${queryString(params)}`)
}

export async function createTextCapture(input: StoreTextCaptureInput): Promise<AtlasCapture> {
  return apiPost<AtlasCapture>('/captures', {
    ...input,
    kind: 'text',
  })
}

export async function uploadCaptureFile(input: UploadCaptureFileInput): Promise<AtlasCapture> {
  const form = new FormData()

  appendForm(form, 'client_id', input.client_id)
  appendForm(form, 'kind', input.kind)
  appendForm(form, 'domain', input.domain)
  appendForm(form, 'captured_at', input.captured_at)
  appendForm(form, 'captured_timezone', input.captured_timezone)
  appendForm(form, 'captured_lat', input.captured_lat)
  appendForm(form, 'captured_lng', input.captured_lng)
  appendForm(form, 'content_duration_ms', input.content_duration_ms)
  appendForm(form, 'metadata', JSON.stringify(input.metadata ?? {}))

  form.append('file', {
    uri: input.file_uri,
    name: input.file_name,
    type: input.mime_type,
  } as unknown as Blob)

  return apiUpload<AtlasCapture>('/captures', form)
}

export async function patchCapture(
  id: string,
  patch: Partial<Pick<AtlasCapture, 'domain' | 'content_text' | 'content_duration_ms' | 'captured_at' | 'captured_timezone' | 'captured_lat' | 'captured_lng' | 'metadata'>>,
): Promise<AtlasCapture> {
  return apiPatch<AtlasCapture>(`/captures/${id}`, patch)
}

export async function deleteCapture(id: string): Promise<AtlasCapture> {
  return apiDelete<AtlasCapture>(`/captures/${id}`)
}

export async function createCheckin(input: StoreCheckinInput): Promise<AtlasCheckin> {
  return apiPost<AtlasCheckin>('/checkins', input)
}

export async function createPassiveSignal(input: StorePassiveSignalInput): Promise<AtlasPassiveSignal> {
  return apiPost<AtlasPassiveSignal>('/passive-signals', input)
}

export async function createHealthSnapshot(input: StoreHealthSnapshotInput): Promise<AtlasHealthSnapshot> {
  return apiPost<AtlasHealthSnapshot>('/health-snapshots', input)
}

export async function createBehavior(input: StoreBehaviorInput): Promise<AtlasBehavior> {
  return apiPost<AtlasBehavior>('/behaviors', input)
}

export async function createBehaviorLog(input: StoreBehaviorLogInput): Promise<AtlasBehaviorLog> {
  return apiPost<AtlasBehaviorLog>('/behavior-logs', input)
}

export async function syncDelta(input: SyncDeltaInput): Promise<SyncDeltaResponse> {
  return apiPost<SyncDeltaResponse>('/sync', input)
}

export async function getTodayMission(params: { date?: string; timezone?: string } = {}): Promise<MissionTodayResponse> {
  return apiGet<MissionTodayResponse>(`/mission/today${queryString(params)}`)
}

export async function upsertTodayMission(input: {
  date?: string
  timezone?: string
  title: string
  detail?: string | null
  status?: string
  metadata?: Record<string, unknown>
}): Promise<AtlasDailyMission> {
  return apiPut<AtlasDailyMission>('/mission/today', input)
}

export async function listSemanticNotes(params: {
  limit?: number
  domain?: string
  trigger_signal?: string
  since?: string
} = {}): Promise<SemanticNotesResponse> {
  return apiGet<SemanticNotesResponse>(`/semantic/notes${queryString(params)}`)
}

export async function getSemanticNote(id: string): Promise<SemanticNoteDetailResponse> {
  return apiGet<SemanticNoteDetailResponse>(`/semantic/notes/${encodeURIComponent(id)}`)
}

export async function reindexSemanticVault(): Promise<{
  vault_created: string[]
  index: { created: number; updated: number; skipped: number; deleted: number }
}> {
  return apiPost('/semantic/notes/reindex', {})
}

export async function searchSemanticNotes(input: {
  query?: string
  limit?: number
  filters?: Record<string, unknown>
}): Promise<SemanticNotesResponse> {
  return apiPost<SemanticNotesResponse>('/semantic/search', input)
}

export async function listSemanticCurationProposals(params: {
  status?: AtlasSemanticCurationProposal['status']
  limit?: number
} = {}): Promise<SemanticCurationProposalsResponse> {
  return apiGet<SemanticCurationProposalsResponse>(`/semantic/curation-proposals${queryString(params)}`)
}

export async function acceptSemanticCurationProposal(
  id: string,
  edits: { path?: string; frontmatter_edits?: Record<string, unknown>; body_edits?: string } = {},
): Promise<{ proposal: AtlasSemanticCurationProposal; note: AtlasSemanticNote }> {
  return apiPost(`/semantic/curation-proposals/${encodeURIComponent(id)}/accept`, edits)
}

export async function dismissSemanticCurationProposal(id: string): Promise<AtlasSemanticCurationProposal> {
  return apiPost(`/semantic/curation-proposals/${encodeURIComponent(id)}/dismiss`, {})
}

export async function postponeSemanticCurationProposal(id: string): Promise<AtlasSemanticCurationProposal> {
  return apiPost(`/semantic/curation-proposals/${encodeURIComponent(id)}/postpone`, {})
}

export async function listSemanticActivations(params: {
  context_type?: string
  limit?: number
} = {}): Promise<SemanticActivationsResponse> {
  return apiGet<SemanticActivationsResponse>(`/semantic/activations${queryString(params)}`)
}

export async function createSemanticActivations(input: {
  context_type?: string
  context_payload?: Record<string, unknown>
} = {}): Promise<{ created: number; skipped: number; signals: string[] }> {
  return apiPost('/semantic/activations', input)
}

export async function markSemanticActivationShown(id: string): Promise<AtlasSemanticActivation> {
  return apiPost(`/semantic/activations/${encodeURIComponent(id)}/shown`, {})
}

export async function feedbackSemanticActivation(
  id: string,
  usefulness_score: number,
  operator_feedback?: string,
): Promise<AtlasSemanticActivation> {
  return apiPost(`/semantic/activations/${encodeURIComponent(id)}/feedback`, {
    usefulness_score,
    operator_feedback,
  })
}

export async function dismissSemanticActivation(id: string): Promise<AtlasSemanticActivation> {
  return apiPost(`/semantic/activations/${encodeURIComponent(id)}/dismiss`, {})
}

export async function getVaultHealth(): Promise<AtlasVaultHealthSnapshot> {
  return apiGet<AtlasVaultHealthSnapshot>('/semantic/vault-health')
}

export async function recomputeVaultHealth(): Promise<AtlasVaultHealthSnapshot> {
  return apiPost<AtlasVaultHealthSnapshot>('/semantic/vault-health/recompute', {})
}

export async function getTodayCognitiveGame(): Promise<CognitiveGameTodayResponse> {
  return apiGet<CognitiveGameTodayResponse>('/semantic/cognitive-games/today')
}

export async function startCognitiveGame(input: {
  game_key?: 'recall' | 'forced_connection' | 'adversarial' | 'blind_application' | 'synthesis'
  note_ids?: string[]
} = {}): Promise<AtlasCognitiveGameRun> {
  return apiPost<AtlasCognitiveGameRun>('/semantic/cognitive-games', input)
}

export async function answerCognitiveGame(
  id: string,
  operator_answer: string,
  duration_seconds?: number,
): Promise<AtlasCognitiveGameRun> {
  return apiPost<AtlasCognitiveGameRun>(`/semantic/cognitive-games/${encodeURIComponent(id)}/answer`, {
    operator_answer,
    duration_seconds,
  })
}

export async function createAiInteraction(input: {
  input_text: string
  client_id?: string
  agent_slug?: string
  provider?: AtlasAiProvider | 'claude_codex'
  kind?: AtlasAiJob['kind']
  source_type?: string
  source_id?: string
  priority?: number
  include_semantic_context?: boolean
  context_note_limit?: number
  payload?: Record<string, unknown>
}): Promise<{ trace: AtlasAiTrace }> {
  return apiPost('/ai/interactions', input)
}

export async function listAiInteractions(params: {
  status?: AtlasAiStatus
  agent?: string
  limit?: number
} = {}): Promise<AiInteractionsResponse> {
  return apiGet<AiInteractionsResponse>(`/ai/interactions${queryString(params)}`)
}

export async function getAiInteraction(id: string): Promise<{ trace: AtlasAiTrace }> {
  return apiGet(`/ai/interactions/${encodeURIComponent(id)}`)
}

export async function feedbackAiInteraction(
  id: string,
  feedback: { feedback_score?: number; feedback_action?: string; feedback_comment?: string },
): Promise<{ trace: AtlasAiTrace }> {
  return apiPost(`/ai/interactions/${encodeURIComponent(id)}/feedback`, feedback)
}

export async function listAiJobs(params: {
  status?: AtlasAiStatus
  provider?: AtlasAiProvider
  limit?: number
} = {}): Promise<AiJobsResponse> {
  return apiGet<AiJobsResponse>(`/ai/jobs${queryString(params)}`)
}

export async function getAiProvidersStatus(): Promise<AiProvidersStatusResponse> {
  return apiGet<AiProvidersStatusResponse>('/ai/providers/status')
}

export async function checkAiProviders(): Promise<{ providers: AtlasAiProviderHealth[] }> {
  return apiPost('/ai/providers/check', {})
}

export async function apiGet<T>(path: string, opts: { auth?: boolean } = {}): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' }, opts)
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'DELETE' })
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: form as unknown as BodyInit,
  })
}

export interface StoreTextCaptureInput {
  client_id: string
  domain: DomainKey
  content_text: string
  captured_at: string
  captured_timezone: string
  captured_lat?: number | null
  captured_lng?: number | null
  metadata?: Record<string, unknown>
}

export interface UploadCaptureFileInput {
  client_id: string
  kind: Exclude<CaptureKind, 'text'>
  domain: DomainKey
  file_uri: string
  file_name: string
  mime_type: string
  content_duration_ms?: number | null
  captured_at: string
  captured_timezone: string
  captured_lat?: number | null
  captured_lng?: number | null
  metadata?: Record<string, unknown>
}

export interface StoreCheckinInput {
  client_id: string
  state: AtlasCheckin['state']
  energy_level: number
  mood_level: number
  note?: string | null
  recorded_at: string
  recorded_timezone: string
  metadata?: Record<string, unknown>
}

export interface StorePassiveSignalInput {
  client_id: string
  source: AtlasPassiveSignal['source']
  signal_type: string
  value_numeric?: number | null
  value_text?: string | null
  unit?: string | null
  started_at: string
  ended_at?: string | null
  recorded_timezone: string
  metadata?: Record<string, unknown>
}

export interface StoreHealthSnapshotInput {
  client_id: string
  source: AtlasHealthSnapshot['source']
  snapshot_date: string
  snapshot_timezone: string
  computed_at: string
  signal_count: number
  readiness_score?: number | null
  current_score?: number | null
  body_score?: number | null
  mind_score?: number | null
  drive_score?: number | null
  sleep_score?: number | null
  autonomic_score?: number | null
  load_score?: number | null
  subjective_score?: number | null
  stability_score?: number | null
  confidence?: number | null
  sleep_duration_hours?: number | null
  sleep_efficiency?: number | null
  hrv_ms?: number | null
  resting_heart_rate_bpm?: number | null
  respiratory_rate?: number | null
  wrist_temperature_c?: number | null
  active_energy_kcal?: number | null
  basal_energy_kcal?: number | null
  exercise_minutes?: number | null
  stand_minutes?: number | null
  steps?: number | null
  walking_running_distance_m?: number | null
  vo2max?: number | null
  body_mass_kg?: number | null
  body_fat_percentage?: number | null
  lean_body_mass_kg?: number | null
  muscle_mass_percentage?: number | null
  body_mass_index?: number | null
  waist_circumference_cm?: number | null
  energy_level?: number | null
  mood_level?: number | null
  state?: AtlasCheckin['state'] | null
  metrics?: Record<string, unknown>
  readiness?: Record<string, unknown>
  sleep?: Record<string, unknown>
  recovery?: Record<string, unknown>
  load?: Record<string, unknown>
  subjective?: Record<string, unknown>
  body?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface StoreBehaviorInput {
  client_id: string
  name: string
  slug: string
  category: BehaviorCategory
  input_type: BehaviorInputType
  question_text: string
  default_value?: string | null
  created_by?: AtlasBehavior['created_by']
  source_capture_ids?: unknown[]
  activation_rules?: Record<string, unknown>
  show_in_morning_briefing?: boolean
  priority_score?: number
  streak_yes?: number
  streak_no?: number
  total_yes_count?: number
  total_no_count?: number
  relational_privacy?: boolean
  activated_at?: string | null
  archived_at?: string | null
  promoted_to_object_type?: string | null
  promoted_to_object_id?: string | null
  metadata?: Record<string, unknown>
}

export interface StoreBehaviorLogInput {
  client_id: string
  behavior_client_id: string
  log_date: string
  value: string
  numeric_value?: number | null
  note?: string | null
  recorded_at: string
  recorded_timezone: string
  source: AtlasBehaviorLog['source']
  source_capture_id?: string | null
  auto_marked?: boolean
  confirmed_by_operator?: boolean
  reverted_at?: string | null
  metadata?: Record<string, unknown>
}

async function apiRequest<T>(
  path: string,
  init: RequestInit,
  opts: { auth?: boolean } = {},
): Promise<T> {
  await hydrateApiConfig()

  const headers = new Headers(init.headers)
  if (opts.auth !== false) {
    headers.set('X-Atlas-Token', getBackendToken())
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers,
  })

  const text = await response.text()
  const payload = text ? parsePayload(text) : null

  if (!response.ok) {
    const message = errorMessage(path, response.status, payload)
    throw new AtlasApiError(message, response.status, path, payload)
  }

  return payload as T
}

function parsePayload(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function errorMessage(path: string, status: number, payload: unknown): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    return String((payload as { message: unknown }).message)
  }

  return `Atlas API ${status} em ${path}`
}

function queryString(params: Record<string, unknown>): string {
  const pairs = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  if (pairs.length === 0) return ''

  return `?${pairs
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')}`
}

function appendForm(form: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null || value === '') return
  form.append(key, String(value))
}

async function readStoredToken(): Promise<string | null> {
  try {
    const secureToken = await SecureStore.getItemAsync(TOKEN_KEY)
    if (secureToken) return secureToken
  } catch {
    // SecureStore can be unavailable in a non-native runtime; legacy storage remains a fallback.
  }

  return AsyncStorage.getItem(TOKEN_KEY)
}

async function writeStoredToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    await AsyncStorage.removeItem(TOKEN_KEY)
  } catch {
    await AsyncStorage.setItem(TOKEN_KEY, token)
  }
}
