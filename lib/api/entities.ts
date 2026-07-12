// Entity / telemetry / sync domain API surface (types + functions), split out of ./client.
// Re-exported from ./client via `export * from './entities'` so existing imports keep working.
// Anti-cycle: this module MUST NOT import from ./client. The request engine comes from ./core;
// cross-domain types come from sibling split modules (./captures, ./health), never from ./client.
//
// This is the mutually-entangled checkins + passive-signals + behaviors + behavior-logs +
// digital-sessions + digital-activity + sync cluster: SyncDeltaInput/Response embed the
// Store*Input and Atlas* types from every one of those domains, so they must live together here.
import { apiGet, apiPatch, apiPost, queryString } from './core'
import type { AtlasCapture, StoreTextCaptureInput } from './captures'
import type { AtlasHealthSnapshot, StoreHealthSnapshotInput } from './health'

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
  source: 'healthkit' | 'rize' | 'manual'
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

export interface AtlasDigitalActivitySnapshot {
  id: string
  client_id: string
  source: 'atlas_server' | 'rize' | 'screentime' | 'manual' | 'import' | string
  snapshot_date: string
  snapshot_timezone: string
  computed_at: string
  signal_count: number
  total_screen_time_min: number | null
  pickups_count: number | null
  first_offensive_use_min_after_wake: number | null
  deep_work_sessions_count: number | null
  deep_work_total_min: number | null
  notifications_received: number | null
  notifications_actioned: number | null
  curated_input_min: number | null
  algorithmic_input_min: number | null
  intentional_entertainment_min: number | null
  default_entertainment_min: number | null
  communication_primary_min: number | null
  communication_shallow_min: number | null
  market_min: number | null
  focus_mode_active_min: Record<string, unknown>
  category_breakdown: Record<string, unknown>
  source_breakdown: Record<string, unknown>
  raw_rize_data: Record<string, unknown>
  raw_screentime_data: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AtlasDigitalSession {
  id: string
  client_id: string
  source: 'rize' | 'screentime' | 'manual' | 'import' | string
  source_event_id: string | null
  source_identifier: string
  source_name: string
  source_kind: 'app' | 'domain' | 'url' | 'project' | 'category' | 'unknown' | string
  category_class_at_time: number | null
  category_label_at_time: string | null
  intentionality: 'intentional' | 'default' | 'mixed' | 'unknown' | string
  started_at: string
  ended_at: string
  duration_seconds: number
  recorded_timezone: string
  focus_mode_active: string | null
  project_name: string | null
  task_name: string | null
  url_domain: string | null
  productivity_score: number | null
  linked_capture_id: string | null
  linked_decision_id: string | null
  raw_payload: Record<string, unknown>
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type BehaviorCategory =
  | 'substancias'
  | 'alimentacao'
  | 'sono_ritmo'
  | 'treino_movimento'
  | 'recuperacao'
  | 'digital'
  | 'trabalho_cognicao'
  | 'relacional'
  | 'saude_sintoma'
  | 'ambiente_rotina'
  | 'outro'
  | 'bebida'
  | 'conflito'
  | 'sono'
  | 'treino'
  | 'suplemento'
  | 'social'
  | 'trabalho'
  | 'saude'

export type BehaviorInputType = 'yes_no' | 'scale_1_5' | 'count_int' | 'text_short'
export type BehaviorGranularityLevel = 'binary' | 'intensity' | 'protocol'
export type BehaviorSensitivityLevel = 'normal' | 'sensitive' | 'relational' | 'medical'
export type BehaviorLifecycleStatus = 'active' | 'baseline' | 'paused' | 'dormant' | 'experiment' | 'manual_only'

export interface AtlasBehavior {
  id: string
  client_id: string
  name: string
  slug: string
  category: BehaviorCategory
  input_type: BehaviorInputType
  question_text: string
  default_value: string
  parent_factor: string | null
  factor_condition: string | null
  target_outcomes: string[]
  expected_lag: string | null
  expected_direction: string | null
  granularity_level: BehaviorGranularityLevel
  sensitivity_level: BehaviorSensitivityLevel
  derived_from: Record<string, unknown>
  operator_confirmed: boolean
  created_by: 'operator' | 'ai_suggestion' | 'import'
  source_capture_ids: unknown[]
  activation_rules: Record<string, unknown>
  lifecycle_status: BehaviorLifecycleStatus
  paused_until: string | null
  last_prompted_at: string | null
  prompt_cadence_days: number
  auto_suppress_reason: string | null
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
  occurred_at: string | null
  occurred_timezone: string | null
  quantity_numeric: number | null
  quantity_unit: string | null
  intensity: number | null
  context: Record<string, unknown>
  recorded_at: string
  recorded_timezone: string
  source: 'morning_briefing' | 'voice_capture' | 'manual' | 'retroactive' | 'import' | 'inferred'
  source_capture_id: string | null
  auto_marked: boolean
  confirmed_by_operator: boolean
  confidence: number | null
  inferred_by: string | null
  consent_snapshot_id: string | null
  reverted_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  deleted_at: string | null
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
  deleted_at?: string | null
}

export interface StoreDigitalSessionInput {
  client_id: string
  source: AtlasDigitalSession['source']
  source_event_id?: string | null
  source_identifier: string
  source_name: string
  source_kind: AtlasDigitalSession['source_kind']
  category_class_at_time?: number | null
  category_label_at_time?: string | null
  intentionality?: AtlasDigitalSession['intentionality']
  started_at: string
  ended_at: string
  duration_seconds: number
  recorded_timezone: string
  focus_mode_active?: string | null
  project_name?: string | null
  task_name?: string | null
  url_domain?: string | null
  productivity_score?: number | null
  linked_capture_id?: string | null
  linked_decision_id?: string | null
  raw_payload?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface StoreDigitalActivitySnapshotInput {
  client_id: string
  source: AtlasDigitalActivitySnapshot['source']
  snapshot_date: string
  snapshot_timezone: string
  computed_at: string
  signal_count: number
  total_screen_time_min?: number | null
  pickups_count?: number | null
  first_offensive_use_min_after_wake?: number | null
  deep_work_sessions_count?: number | null
  deep_work_total_min?: number | null
  notifications_received?: number | null
  notifications_actioned?: number | null
  curated_input_min?: number | null
  algorithmic_input_min?: number | null
  intentional_entertainment_min?: number | null
  default_entertainment_min?: number | null
  communication_primary_min?: number | null
  communication_shallow_min?: number | null
  market_min?: number | null
  focus_mode_active_min?: Record<string, unknown>
  category_breakdown?: Record<string, unknown>
  source_breakdown?: Record<string, unknown>
  raw_rize_data?: Record<string, unknown>
  raw_screentime_data?: Record<string, unknown>
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
  parent_factor?: string | null
  factor_condition?: string | null
  target_outcomes?: string[]
  expected_lag?: string | null
  expected_direction?: string | null
  granularity_level?: BehaviorGranularityLevel
  sensitivity_level?: BehaviorSensitivityLevel
  derived_from?: Record<string, unknown>
  operator_confirmed?: boolean
  created_by?: AtlasBehavior['created_by']
  source_capture_ids?: unknown[]
  activation_rules?: Record<string, unknown>
  lifecycle_status?: BehaviorLifecycleStatus
  paused_until?: string | null
  last_prompted_at?: string | null
  prompt_cadence_days?: number
  auto_suppress_reason?: string | null
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
  occurred_at?: string | null
  occurred_timezone?: string | null
  quantity_numeric?: number | null
  quantity_unit?: string | null
  intensity?: number | null
  context?: Record<string, unknown>
  recorded_at: string
  recorded_timezone: string
  source: AtlasBehaviorLog['source']
  source_capture_id?: string | null
  auto_marked?: boolean
  confirmed_by_operator?: boolean
  confidence?: number | null
  inferred_by?: string | null
  consent_snapshot_id?: string | null
  reverted_at?: string | null
  metadata?: Record<string, unknown>
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

export interface DigitalActivitySnapshotsResponse {
  digital_activity_snapshots: AtlasDigitalActivitySnapshot[]
  next_cursor: string | null
  has_more: boolean
}

export interface DigitalSessionsResponse {
  digital_sessions: AtlasDigitalSession[]
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

export interface SyncDeltaInput {
  device_id: string
  last_sync_at?: string | null
  captures_to_upload?: StoreTextCaptureInput[]
  checkins_to_upload?: StoreCheckinInput[]
  passive_signals_to_upload?: StorePassiveSignalInput[]
  health_snapshots_to_upload?: StoreHealthSnapshotInput[]
  digital_sessions_to_upload?: StoreDigitalSessionInput[]
  digital_activity_snapshots_to_upload?: StoreDigitalActivitySnapshotInput[]
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
  digital_sessions_uploaded: number
  digital_sessions_downloaded: AtlasDigitalSession[]
  digital_snapshots_uploaded: number
  digital_snapshots_downloaded: AtlasDigitalActivitySnapshot[]
  next_full_sync_recommended_at: string
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

export async function listDigitalActivitySnapshots(params: {
  since?: string | null
  limit?: number
  cursor?: string | null
  source?: AtlasDigitalActivitySnapshot['source']
  date_from?: string
  date_to?: string
} = {}): Promise<DigitalActivitySnapshotsResponse> {
  return apiGet<DigitalActivitySnapshotsResponse>(`/digital-activity-snapshots${queryString(params)}`)
}

export async function listDigitalSessions(params: {
  since?: string | null
  limit?: number
  cursor?: string | null
  source?: AtlasDigitalSession['source']
  source_identifier?: string
  category_class?: number
  date_from?: string
  date_to?: string
} = {}): Promise<DigitalSessionsResponse> {
  return apiGet<DigitalSessionsResponse>(`/digital-sessions${queryString(params)}`)
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

export async function createCheckin(input: StoreCheckinInput): Promise<AtlasCheckin> {
  return apiPost<AtlasCheckin>('/checkins', input)
}

export async function createPassiveSignal(input: StorePassiveSignalInput): Promise<AtlasPassiveSignal> {
  return apiPost<AtlasPassiveSignal>('/passive-signals', input)
}

export async function createBehavior(input: StoreBehaviorInput): Promise<AtlasBehavior> {
  return apiPost<AtlasBehavior>('/behaviors', input)
}

export async function patchBehavior(
  id: string,
  patch: Partial<Omit<StoreBehaviorInput, 'client_id'>>,
): Promise<AtlasBehavior> {
  return apiPatch<AtlasBehavior>(`/behaviors/${encodeURIComponent(id)}`, patch)
}

export async function createBehaviorLog(input: StoreBehaviorLogInput): Promise<AtlasBehaviorLog> {
  return apiPost<AtlasBehaviorLog>('/behavior-logs', input)
}

export async function syncDelta(input: SyncDeltaInput): Promise<SyncDeltaResponse> {
  return apiPost<SyncDeltaResponse>('/sync', input)
}
