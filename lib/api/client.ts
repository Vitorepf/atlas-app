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
const MOBILE_TOKEN_KEY = 'atlas-mobile.deviceToken'
const MOBILE_DEVICE_ID_KEY = 'atlas-mobile.deviceId'

let cachedHost: string | null = null
let cachedPort: number | null = null
let cachedToken: string | null = null
let cachedMobileDeviceToken: string | null = null
let cachedMobileDeviceId: string | null = null
let hydratePromise: Promise<void> | null = null

export interface ApiConfig {
  apiHost: string
  apiPort: number
  apiToken: string
}

export interface MobileDeviceSession {
  deviceToken: string
  deviceId: string
}

export interface AtlasMobileDevice {
  id: string
  user_id: string
  device_label: string
  platform: 'ios' | 'android' | string
  app_version: string | null
  os_version: string | null
  has_push_token: boolean
  notification_permissions: string
  last_seen_at: string | null
  paired_at: string | null
  revoked_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasInboxAction {
  id: string
  label: string
  style?: 'primary' | 'default' | 'destructive' | string
  requires_confirm?: boolean
  handler?: string
  deep_link?: string
  policy?: Record<string, unknown>
}

export type AtlasOperationalInboxType =
  | 'approval'
  | 'alert'
  | 'completion'
  | 'capture'
  | 'thread_update'
  | 'job_status'
  | 'insight'
  | 'proposal'
  | 'job_result'
  | 'self_diagnostic'

export interface AtlasOperationalInboxItem {
  id: string
  user_id: string
  type: AtlasOperationalInboxType | string
  category: string | null
  severity: 'debug' | 'info' | 'warning' | 'critical' | string
  status: 'unread' | 'read' | 'actioned' | 'resolved' | 'dismissed' | 'expired' | 'snoozed' | string
  title: string
  summary: string | null
  body: string | null
  source_type: string | null
  source_id: string | null
  initiator: 'operator' | 'atlas' | 'system' | 'job' | string
  context_bundle_id: string | null
  dedupe_key: string | null
  available_actions: AtlasInboxAction[]
  response: Record<string, unknown> | null
  payload: Record<string, unknown>
  deep_link: string | null
  push_policy: Record<string, unknown>
  priority_score: number
  confidence_score: number | null
  expires_at: string | null
  snoozed_until: string | null
  read_at: string | null
  resolved_at: string | null
  dismissed_at: string | null
  created_at: string | null
  updated_at: string | null
  context_bundle?: {
    id: string
    purpose: string
    title: string
    summary: string
    source_refs: unknown[]
    trace_refs: unknown[]
    job_refs: unknown[]
    metric_refs: unknown[]
    file_refs: unknown[]
    diff_refs: unknown[]
  } | null
}

export interface MobileInboxResponse {
  items: AtlasOperationalInboxItem[]
  unread_count: number
  generated_at: string
}

export interface MobileInboxActionResponse {
  ok: boolean
  idempotent?: boolean
  result: Record<string, unknown>
  item: AtlasOperationalInboxItem
}

export interface AtlasDomain {
  slug: string
  label: string
  description: string | null
  color_light: string
  color_dark: string
  default_sensitivity: 'normal' | 'private' | 'sensitive' | string
  external_ai_policy: 'allow' | 'block_private_sensitive' | 'block_all' | string
  active: boolean
  sort_order: number
  metadata: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
}

export interface AtlasCaptureLink {
  id: string
  capture_id: string
  target_type: 'semantic_note' | 'semantic_curation_proposal' | 'task' | 'project' | 'hypothesis' | 'external' | string
  target_id: string | null
  target_title: string | null
  relation_type: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasInboxHealth {
  open_count: number
  no_destination_count: number
  failed_count: number
  curation_candidate_count: number
  average_age_hours: number
  oldest_capture_at: string | null
  by_domain: Record<string, {
    open_count: number
    no_destination_count: number
    failed_count: number
    curation_candidate_count: number
  }>
}

export interface AtlasHealth {
  status: 'ok' | string
  version: string
  service: string
  ts: string
  db_connected: boolean
  overall_ok?: boolean
  checks?: {
    database?: { ok: boolean }
    storage?: {
      ok: boolean
      writable: boolean
      path: string | null
      error: string | null
    }
    transcription?: {
      enabled: boolean
      engine: string | null
      language: string | null
      binary_path: string | null
      binary_exists: boolean
      binary_executable: boolean
      model_path: string | null
      model_exists: boolean
      ffmpeg_path: string | null
      ffmpeg_exists: boolean
      ffmpeg_executable: boolean
    }
    transcription_jobs?: {
      queued: number
      processing: number
      failed: number
    }
    scheduler?: {
      configured: boolean
      note: string
    }
    queue?: {
      connection: string
      transcription_queue: string
      note: string
    }
  }
}

export type CaptureKind = 'audio' | 'text' | 'photo'
export type TranscriptionStatus = 'pending' | 'processing' | 'done' | 'failed' | 'na'
export type CaptureTriageAction =
  | 'promote'
  | 'archive'
  | 'snooze'
  | 'attach_note'
  | 'create_task'
  | 'create_project'
  | 'create_hypothesis'

export interface AtlasCapture {
  id: string
  client_id: string
  kind: CaptureKind
  domain: DomainKey
  content_text: string | null
  content_file_path: string | null
  content_file_exists: boolean | null
  content_file_integrity: 'available' | 'missing' | 'not_applicable' | string
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
  pre_capture_digital_context?: Record<string, unknown>
  metadata: Record<string, unknown>
  links?: AtlasCaptureLink[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CaptureTriageInput {
  action: CaptureTriageAction
  title?: string | null
  note_id?: string | null
  note_title?: string | null
  snoozed_until?: string | null
  due_at?: string | null
  priority?: 'low' | 'normal' | 'high' | 'urgent' | null
  planned_for_date?: string | null
  planned_start_at?: string | null
  planned_end_at?: string | null
  estimated_minutes?: number | null
  energy_required?: 'low' | 'medium' | 'high' | null
  urgency_score?: number | null
  impact_score?: number | null
  effort_score?: number | null
  priority_score?: number | null
  goal?: string | null
  next_action?: string | null
  project_type?: AtlasProjectType | null
  desired_outcome?: string | null
  minimum_viable_outcome?: string | null
  definition_of_done?: string | null
  why_now?: string | null
  deadline_at?: string | null
  deadline_kind?: AtlasDeadlineKind | null
  energy_profile?: AtlasProjectEnergyProfile | null
  avoidance_reason?: AtlasAvoidanceReason | null
  execution_mode?: AtlasExecutionMode | null
  friction_level?: number | null
  emotional_resistance?: number | null
  clarity_level?: number | null
  starter_step?: string | null
  minimum_viable_action?: string | null
  if_then_plan?: string | null
  reward_hint?: string | null
  reason?: string | null
  metadata?: Record<string, unknown>
}

export interface CaptureTriageResponse {
  capture: AtlasCapture
  proposal: AtlasSemanticCurationProposal | null
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

export interface AtlasTask {
  id: string
  title: string
  description: string | null
  status: 'open' | 'next' | 'waiting' | 'done' | 'archived' | string
  priority: 'low' | 'normal' | 'high' | 'urgent' | string
  domain: DomainKey
  source_capture_id: string | null
  project_id: string | null
  project_step_id: string | null
  routine_id: string | null
  routine_occurrence_date: string | null
  project?: AtlasTaskProjectSummary | null
  project_step?: AtlasTaskProjectStepSummary | null
  routine?: AtlasTaskRoutineSummary | null
  due_at: string | null
  planned_for_date: string | null
  planned_start_at: string | null
  planned_end_at: string | null
  estimated_minutes: number
  energy_required: 'low' | 'medium' | 'high' | string
  urgency_score: number
  impact_score: number
  effort_score: number
  priority_score: number
  planning_status: 'unscheduled' | 'suggested' | 'planned' | 'scheduled' | 'deferred' | string
  completed_at: string | null
  execution_mode: AtlasExecutionMode | string
  friction_level: number
  emotional_resistance: number
  clarity_level: number
  starter_step: string | null
  minimum_viable_action: string | null
  if_then_plan: string | null
  reward_hint: string | null
  failure_reason_last: string | null
  attempt_count: number
  recovery_count: number
  metadata: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export interface AtlasAgendaTask extends AtlasTask {
  project_title?: string | null
  project_type?: AtlasProjectType | string | null
  project_step_title?: string | null
  project_step_order?: number | null
  routine_title?: string | null
  routine_frequency?: AtlasRoutineFrequency | string | null
  agenda_score: number
  bucket: string
  agenda_intent?: string | null
  agenda_risk?: string | null
  project_signal?: Record<string, unknown> | null
  why: string[]
  recommended_start_at?: string | null
  recommended_end_at?: string | null
}

export type AtlasProjectType =
  | 'study'
  | 'technical_build'
  | 'creative'
  | 'business'
  | 'research'
  | 'writing'
  | 'health'
  | 'admin'
  | 'personal'
  | 'tedious'
  | 'routine_candidate'

export type AtlasDeadlineKind = 'real' | 'desired' | 'artificial' | 'none'
export type AtlasProjectEnergyProfile = 'low' | 'medium' | 'high' | 'mixed'
export type AtlasAvoidanceReason =
  | 'unclear'
  | 'boring'
  | 'too_large'
  | 'scary'
  | 'perfectionism'
  | 'no_reward'
  | 'low_energy'
  | 'dependency'
  | 'unknown'
export type AtlasExecutionMode =
  | 'quick_win'
  | 'deep_work'
  | 'admin'
  | 'study'
  | 'tedious'
  | 'creative'
  | 'decision'
  | 'maintenance'
  | 'recovery'

export interface AtlasTaskProjectSummary {
  id: string
  title: string
  status: string
  domain: DomainKey
  project_type: AtlasProjectType | string
}

export interface AtlasTaskProjectStepSummary {
  id: string
  title: string
  status: string
  step_order: number
  step_type: string
}

export type AtlasRoutineStatus = 'active' | 'paused' | 'archived'
export type AtlasRoutineFrequency = 'daily' | 'weekdays' | 'weekly' | 'custom'

export interface AtlasTaskRoutineSummary {
  id: string
  title: string
  status: AtlasRoutineStatus | string
  domain: DomainKey
  frequency: AtlasRoutineFrequency | string
}

export interface AtlasRoutine {
  id: string
  title: string
  description: string | null
  status: AtlasRoutineStatus | string
  domain: DomainKey
  source_capture_id: string | null
  project_id: string | null
  project?: AtlasTaskProjectSummary | null
  frequency: AtlasRoutineFrequency | string
  weekdays: number[]
  timezone: string
  preferred_time: string | null
  estimated_minutes: number
  energy_required: 'low' | 'medium' | 'high' | string
  priority: 'low' | 'normal' | 'high' | 'urgent' | string
  execution_mode: AtlasExecutionMode | string
  friction_level: number
  emotional_resistance: number
  clarity_level: number
  starter_step: string | null
  minimum_viable_action: string | null
  if_then_plan: string | null
  reward_hint: string | null
  next_occurrence_date: string | null
  last_generated_for_date: string | null
  tasks_count?: number
  metadata: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export interface AtlasProjectStep {
  id: string
  project_id: string
  active_task_id: string | null
  active_task?: AtlasTask | null
  step_order: number
  title: string
  description: string | null
  status: 'pending' | 'active' | 'done' | 'skipped' | 'blocked' | string
  step_type: 'phase' | 'action' | 'milestone' | 'review' | string
  expected_output: string | null
  acceptance_criteria: string | null
  estimated_minutes: number
  energy_required: 'low' | 'medium' | 'high' | string
  friction_level: number
  metadata: Record<string, unknown>
  started_at: string | null
  completed_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasProject {
  id: string
  title: string
  description: string | null
  status: 'active' | 'paused' | 'blocked' | 'waiting' | 'completed' | 'archived' | string
  domain: DomainKey
  source_capture_id: string | null
  goal: string | null
  next_action: string | null
  project_type: AtlasProjectType | string
  desired_outcome: string | null
  minimum_viable_outcome: string | null
  definition_of_done: string | null
  why_now: string | null
  deadline_at: string | null
  deadline_kind: AtlasDeadlineKind | string
  priority: 'low' | 'normal' | 'high' | 'urgent' | string
  energy_profile: AtlasProjectEnergyProfile | string
  avoidance_reason: AtlasAvoidanceReason | string
  active_next_task_id: string | null
  active_next_task?: AtlasTask | null
  current_step_id: string | null
  current_step?: AtlasProjectStep | null
  tasks_count?: number
  steps_count?: number
  execution_health?: {
    status: 'healthy' | 'attention' | 'paused' | 'completed' | 'archived' | string
    reasons: string[]
    score: number
    missing_next_action: boolean
    review_due: boolean
    overdue: boolean
    deferred_action?: boolean
    deferred_ready?: boolean
    last_touched_days: number | null
  }
  last_touched_at: string | null
  next_review_at: string | null
  completed_at: string | null
  paused_until: string | null
  metadata: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export type AtlasProjectPlanProposalStatus =
  | 'draft'
  | 'pending_review'
  | 'accepted'
  | 'rejected'
  | 'superseded'
  | string

export interface AtlasProjectPlanProposal {
  id: string
  project_id: string | null
  source_capture_id: string | null
  status: AtlasProjectPlanProposalStatus
  proposed_title: string
  planner_version: string
  input_hash: string
  project_type: AtlasProjectType | string
  avoidance_profile: AtlasAvoidanceReason | string
  desired_outcome: string
  definition_of_done: string
  minimum_useful_result: string
  first_milestone: string | null
  first_next_action: string
  estimated_energy: AtlasProjectEnergyProfile | string
  estimated_duration_minutes: number
  priority_suggestion: 'low' | 'normal' | 'high' | 'urgent' | string
  confidence: number
  phases: unknown[]
  steps: unknown[]
  risks: unknown[]
  questions: unknown[]
  rationale: string
  metadata: Record<string, unknown>
  accepted_at: string | null
  rejected_at: string | null
  project?: Pick<AtlasProject, 'id' | 'title' | 'status' | 'domain'> | null
  source_capture?: Pick<AtlasCapture, 'id' | 'kind' | 'domain' | 'captured_at'> | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasTaskEvent {
  id: string
  task_id: string
  event_type: string
  source: string
  payload: Record<string, unknown>
  occurred_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasProjectEvent {
  id: string
  project_id: string
  event_type: string
  source: string
  payload: Record<string, unknown>
  occurred_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasRoutineEvent {
  id: string
  routine_id: string
  event_type: string
  source: string
  payload: Record<string, unknown>
  occurred_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasCalendarBlock {
  id: string
  block_date: string
  timezone: string
  title: string
  starts_at: string
  ends_at: string
  source: 'manual' | 'external_calendar' | 'rize' | 'system' | string
  source_ref: string | null
  task_id: string | null
  metadata: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
  deleted_at: string | null
}

export interface AtlasTaskAgendaResponse {
  date: string
  timezone: string
  capacity_minutes: number
  scheduled_minutes: number
  energy_level: number | null
  context?: {
    energy_level: number | null
    energy_source: string | null
    checkin_state: AtlasCheckin['state'] | null
    mood_level: number | null
    readiness_score: number | null
    current_score: number | null
    sleep_duration_hours: number | null
    deep_work_minutes: number | null
    algorithmic_input_minutes: number | null
    digital_load: string | null
  }
  summary: {
    task_count: number
    backlog_count: number
    focus_task: string | null
    strategy: string
  }
  blocks?: AtlasCalendarBlock[]
  tasks: AtlasAgendaTask[]
  backlog: AtlasAgendaTask[]
}

export interface AtlasTaskAgendaPlanResponse {
  date: string
  timezone: string
  planned_count: number
  skipped_count: number
  planned_tasks: Array<AtlasAgendaTask & { calendar_block_id?: string | null }>
  skipped_tasks: Array<{ id: string; reason: string; planned_start_at?: string | null }>
  agenda: AtlasTaskAgendaResponse
}

export interface AtlasTaskWeekAgendaDay {
  date: string
  weekday: string
  is_weekend: boolean
  capacity_minutes: number
  agenda: AtlasTaskAgendaResponse
}

export interface AtlasTaskWeekAgendaResponse {
  start_date: string
  end_date: string
  timezone: string
  days_count: number
  summary: {
    task_count: number
    scheduled_minutes: number
    focus_days: number
    strategy: string
  }
  days: AtlasTaskWeekAgendaDay[]
}

export interface AtlasTaskWeekAgendaPlanResponse {
  start_date: string
  end_date: string
  timezone: string
  planned_count: number
  skipped_count: number
  planned_tasks: Array<AtlasAgendaTask & { date: string; calendar_block_id?: string | null }>
  skipped_tasks: Array<{ id: string | null; reason: string; date: string; planned_start_at?: string | null }>
  week: AtlasTaskWeekAgendaResponse
}

export interface TasksResponse {
  tasks: AtlasTask[]
}

export interface ProjectsResponse {
  projects: AtlasProject[]
}

export interface RoutinesResponse {
  routines: AtlasRoutine[]
}

export interface ProjectStepsResponse {
  steps: AtlasProjectStep[]
}

export interface TaskEventsResponse {
  events: AtlasTaskEvent[]
}

export interface ProjectEventsResponse {
  events: AtlasProjectEvent[]
}

export interface RoutineEventsResponse {
  events: AtlasRoutineEvent[]
}

export interface CreateProjectResponse {
  project: AtlasProject
  active_next_task: AtlasTask
}

export interface ProjectNextActionResponse {
  project: AtlasProject
  task: AtlasTask
}

export interface ProjectPlanResponse {
  project: AtlasProject
  steps: AtlasProjectStep[]
  active_next_task: AtlasTask
}

export interface ProjectPlanProposalsResponse {
  proposals: AtlasProjectPlanProposal[]
}

export interface ProjectPlanProposalAcceptResponse {
  proposal: AtlasProjectPlanProposal
  project: AtlasProject
  active_next_task: AtlasTask
}

export interface ProjectExecutionPacket {
  status: 'ready' | 'no_active_action' | string
  project_id: string
  task_id: string | null
  step_id: string | null
  title: string
  mode: string
  timebox_minutes: number | null
  starter_step: string | null
  minimum_viable_action: string | null
  done_when: string | null
  if_then_plan: string | null
  reward_hint: string | null
  low_energy_action: string | null
  avoid_now: string | null
  attempt_count: number
  friction_level?: number
  energy_required?: string | null
  next_review_at?: string | null
  why?: string[]
  generated_at: string
}

export interface ProjectExecutionResponse {
  project: AtlasProject
  active_next_task: AtlasTask | null
  packet: ProjectExecutionPacket
}

export interface ProjectReviewSuggestion {
  action: 'mark_reviewed' | 'postpone' | 'ensure_next_action' | 'rebuild_plan' | 'reactivate' | 'review_blocker' | 'recover' | string
  label: string
  reason: string
  proposed_next_action: string | null
  review_interval_days: number
  target_minutes?: number | null
  defer_reason_code?: string | null
}

export interface ProjectReviewItem {
  project: AtlasProject
  health: NonNullable<AtlasProject['execution_health']>
  suggestion: ProjectReviewSuggestion
  review_score: number
}

export interface ProjectReviewQueueResponse {
  items: ProjectReviewItem[]
  summary: {
    count: number
    blocked_count: number
    missing_next_action_count: number
    review_due_count: number
  }
  generated_at: string
}

export interface ProjectReviewActionResponse {
  project: AtlasProject
  active_next_task: AtlasTask | null
  health: NonNullable<AtlasProject['execution_health']>
  suggestion: ProjectReviewSuggestion
}

export interface ProjectStepMutationResponse {
  project: AtlasProject
  step: AtlasProjectStep
  active_next_task: AtlasTask | null
}

export interface CalendarBlocksResponse {
  blocks: AtlasCalendarBlock[]
}

export interface RoutineGenerateResponse {
  routine: AtlasRoutine
  task: AtlasTask | null
}

export interface RoutinesGenerateDueResponse {
  date: string
  timezone: string
  generated_count: number
  created_count: number
  routines: AtlasRoutine[]
  tasks: AtlasTask[]
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

export interface BitaculaCanonicalFactor {
  id: string
  label: string
  category: BehaviorCategory
  parent_factor: string
  factor_condition: string
  question_text: string
  target_outcomes: string[]
  expected_lag: string
  expected_direction: string
  granularity_level: BehaviorGranularityLevel
  sensitivity_level: BehaviorSensitivityLevel
  guidance: string | null
  aliases: string[]
}

export interface BitaculaNormalizationSuggestion extends BitaculaCanonicalFactor {
  confidence: number
  matched_text: string
  match_reason: string
  operator_action: 'confirm' | string
  payload: Partial<StoreBehaviorInput>
}

export interface BitaculaNormalizationResponse {
  input_text: string
  normalized_text: string
  normalizer: string
  suggestions: BitaculaNormalizationSuggestion[]
}

export interface BitaculaFactorsResponse {
  normalizer: string
  factors: BitaculaCanonicalFactor[]
}

export interface BitaculaBriefingItem {
  behavior: AtlasBehavior
  log: AtlasBehaviorLog | null
  date: string
  score: number
  reason: string
}

export interface BitaculaBriefingResponse {
  date: string
  items: BitaculaBriefingItem[]
  normalizer: string
}

export interface BitaculaAnalysisRow {
  outcome: string
  yes_count: number
  no_count: number
  avg_yes: number | null
  avg_no: number | null
  difference: number | null
  effect_direction: 'higher_when_yes' | 'lower_when_yes' | 'neutral' | null | string
  support: 'insufficient' | 'weak' | 'moderate_exploratory' | 'strong_exploratory' | string
  sample_sufficient: boolean
  confidence_level: 'low' | 'medium' | 'high' | string
  interpretation: 'insufficient_data' | 'weak_signal' | 'hypothesis_candidate' | string
}

export interface BitaculaConfounder {
  name: string
  parent_factor: string | null
  count: number
}

export interface BitaculaAnalysisResponse {
  behavior: AtlasBehavior
  window_days: number
  lag_days: number
  date_from: string
  date_to: string
  computed_at: string
  analysis: BitaculaAnalysisRow[]
  confounders: BitaculaConfounder[]
  disclaimer: string
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
  source_links_count?: number
  target_links_count?: number
  source_links?: AtlasSemanticNoteLink[]
  target_links?: AtlasSemanticNoteLink[]
  score?: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface AtlasSemanticNoteLink {
  id: string
  source_note_id: string
  target_note_id: string
  source_note?: AtlasSemanticNote
  target_note?: AtlasSemanticNote
  link_type: 'supports' | 'contradicts' | 'extends' | 'example_of' | 'applies_to' | 'derived_from' | 'similar_to' | 'tension'
  explanation: string
  created_by: 'operator' | 'atlas_suggestion' | 'import'
  confidence: number | null
  confirmed_by_operator: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
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
  feedback_action: 'useful' | 'not_useful' | 'too_early' | 'too_late' | 'dismissed' | null
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
  cognitive_return?: AtlasCognitiveReturn
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasCognitiveReturn {
  version?: string
  score?: number
  label?: string
  useful_activations_7d?: number
  activations_7d?: number
  utility_rate_7d?: number
  response_rate_7d?: number
  active_note_coverage_7d?: number
  activated_notes_7d?: number
  notes_per_useful_activation_7d?: number | null
  interpretation?: string
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

export type AtlasAiProvider = 'claude_cli' | 'codex_cli' | 'claude_codex'
export type AtlasAiStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled'
export type AtlasAiQualityStatus = 'passed' | 'needs_review' | 'failed' | string
export type AtlasAiQualityActionStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped'
  | 'blocked'
  | string

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
  trace?: AtlasAiTrace
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
  thread_id: string | null
  session_id: string | null
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
  thread?: AtlasAiThread
  session?: AtlasAiSession
  job?: AtlasAiJob
  jobs?: AtlasAiJob[]
  quality_evaluation?: AtlasAiQualityEvaluation | null
  quality_actions?: AtlasAiQualityAction[]
  created_at: string
  updated_at: string
}

export interface AtlasAiSession {
  id: string
  thread_id: string
  provider: AtlasAiProvider | string | null
  model: string | null
  title: string | null
  status: 'active' | 'closed' | 'archived' | string
  started_at: string | null
  ended_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasAiMessage {
  id: string
  thread_id: string
  trace_id: string | null
  position: number
  role: 'user' | 'assistant' | 'system' | 'tool' | 'summary' | string
  status: 'draft' | 'final' | 'failed' | 'redacted' | string
  content: string
  provider: AtlasAiProvider | string | null
  model: string | null
  agent_slug: string | null
  token_estimate: number | null
  occurred_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasAiThread {
  id: string
  title: string
  summary: string | null
  status: 'active' | 'archived' | 'closed' | string
  surface: string
  workspace: string | null
  source_type: string | null
  source_id: string | null
  last_trace_id: string | null
  last_provider: AtlasAiProvider | string | null
  message_count: number
  last_message_at: string | null
  metadata: Record<string, unknown>
  messages?: AtlasAiMessage[]
  active_session?: AtlasAiSession | null
  active_state?: AtlasAiSessionState | null
  latest_compaction?: AtlasAiCompaction | null
  latest_provider_handoff?: AtlasAiProviderHandoff | null
  last_trace?: AtlasAiTrace
  created_at: string
  updated_at: string
}

export interface AtlasAiSessionState {
  id: string
  thread_id: string
  session_id: string | null
  version: number
  active: boolean
  objective: string | null
  current_phase: string | null
  current_topic: string | null
  user_position: string | null
  decisions: unknown[]
  open_loops: unknown[]
  next_steps: unknown[]
  relevant_artifacts: unknown[]
  constraints: unknown[]
  provider_context: Record<string, unknown>
  quality_notes: unknown[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasAiCompaction {
  id: string
  thread_id: string
  session_id: string | null
  reason: string
  source_position_start: number | null
  source_position_end: number | null
  source_message_count: number
  summary: string
  structured_state: Record<string, unknown>
  token_estimate_before: number | null
  token_estimate_after: number | null
  quality_gate_status: string
  provider: string | null
  model: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasAiProviderHandoff {
  id: string
  thread_id: string
  session_id: string | null
  from_provider: string | null
  to_provider: string
  reason: string
  brief_text: string
  brief_json: Record<string, unknown>
  compaction_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface AtlasAiContextSnapshot {
  id: string
  trace_id: string | null
  thread_id: string | null
  session_id: string | null
  provider: string | null
  model: string | null
  prompt_hash: string | null
  context_pack: Record<string, unknown>
  messages_included: unknown[]
  compaction_id: string | null
  provider_handoff_id: string | null
  token_estimate: number | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface AtlasAiQualityEvaluation {
  id: string
  trace_id: string | null
  thread_id: string | null
  session_id: string | null
  provider: AtlasAiProvider | string | null
  model: string | null
  agent_slug: string | null
  evaluator_version: string
  score: number
  status: AtlasAiQualityStatus
  dimensions: Record<string, unknown>
  flags: Array<Record<string, unknown>>
  suggested_actions: unknown[]
  metadata: Record<string, unknown>
  actions?: AtlasAiQualityAction[]
  created_at: string
  updated_at: string
}

export interface AtlasAiQualityAction {
  id: string
  evaluation_id: string | null
  trace_id: string | null
  remediation_trace_id: string | null
  thread_id: string | null
  session_id: string | null
  action_type: string
  status: AtlasAiQualityActionStatus
  priority: number
  reason: string
  flags: unknown[]
  payload: Record<string, unknown>
  result: Record<string, unknown>
  error_message: string | null
  dedupe_key: string | null
  completed_at: string | null
  remediation_trace?: AtlasAiTrace | null
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

export interface AiObservabilityResponse {
  window: {
    since: string
    until: string
  }
  threads: {
    active: number
    atlas_cli: number
  }
  traces: {
    total: number
    by_status: Record<string, number>
    by_provider: Record<string, number>
  }
  jobs: {
    queued: number
    processing: number
    failed_24h: number
  }
  quality: {
    available: boolean
    total?: number
    average_score?: number
    by_status?: Record<string, number>
    recent_needs_review?: Array<{
      id: string
      trace_id: string | null
      thread_id: string | null
      provider: AtlasAiProvider | string | null
      score: number
      status: AtlasAiQualityStatus
      flags: string[]
      created_at: string | null
    }>
  }
  actions: {
    available: boolean
    by_status?: Record<string, number>
    open?: number
    recent?: Array<{
      id: string
      trace_id: string | null
      remediation_trace_id: string | null
      action_type: string
      status: AtlasAiQualityActionStatus
      priority: number
      reason: string
      created_at: string | null
    }>
  }
}

export interface AiThreadsResponse {
  threads: AtlasAiThread[]
}

export interface AtlasAuditItem {
  id: string
  type: 'curation_proposal' | 'semantic_activation' | 'ai_audit' | string
  title: string
  status: string
  created_at: string | null
  why: string
  evidence: Record<string, unknown>
  privacy: Record<string, unknown>
  raw_refs: Record<string, unknown>
}

export interface AtlasAuditResponse {
  items: AtlasAuditItem[]
  generated_at: string
}

export interface CapturesResponse {
  captures: AtlasCapture[]
  next_cursor: string | null
  has_more: boolean
}

export interface DomainsResponse {
  domains: AtlasDomain[]
}

export interface CreateAtlasDomainInput {
  slug: string
  label: string
  description?: string | null
  color_light?: string
  color_dark?: string
  default_sensitivity?: 'normal' | 'private' | 'sensitive'
  external_ai_policy?: 'allow' | 'block_private_sensitive' | 'block_all'
  sort_order?: number
  active?: boolean
  metadata?: Record<string, unknown>
}

export interface InboxResponse {
  captures: AtlasCapture[]
  health: AtlasInboxHealth
  generated_at: string
}

export interface InboxHealthResponse {
  health: AtlasInboxHealth
  snapshot: {
    id: string
    snapshot_date: string | null
    domain: string | null
    created_at: string | null
    updated_at: string | null
  }
  generated_at: string
}

export interface InboxBulkResponse {
  captures: AtlasCapture[]
  updated_count: number
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

export interface MissionTodayResponse {
  date: string
  timezone: string
  mission: AtlasDailyMission | null
}

export interface TasksResponse {
  tasks: AtlasTask[]
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

export interface AiQualityActionsResponse {
  actions: AtlasAiQualityAction[]
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
      const [host, port, token, mobileToken, mobileDeviceId] = await Promise.all([
        AsyncStorage.getItem(HOST_KEY),
        AsyncStorage.getItem(PORT_KEY),
        readStoredToken(),
        readStoredMobileDeviceToken(),
        AsyncStorage.getItem(MOBILE_DEVICE_ID_KEY),
      ])

      if (host) cachedHost = host
      if (port) {
        const n = Number(port)
        if (Number.isFinite(n) && n > 0) cachedPort = n
      }
      if (token) cachedToken = token
      if (mobileToken) cachedMobileDeviceToken = mobileToken
      if (mobileDeviceId) cachedMobileDeviceId = mobileDeviceId
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

export function getMobileDeviceSession(): MobileDeviceSession | null {
  if (!cachedMobileDeviceToken || !cachedMobileDeviceId) return null

  return {
    deviceToken: cachedMobileDeviceToken,
    deviceId: cachedMobileDeviceId,
  }
}

export function getMobileAuthHeaders(): Record<string, string> {
  if (!cachedMobileDeviceToken) return {}

  return { Authorization: `Bearer ${cachedMobileDeviceToken}` }
}

export async function setMobileDeviceSession(session: MobileDeviceSession): Promise<void> {
  cachedMobileDeviceToken = session.deviceToken
  cachedMobileDeviceId = session.deviceId
  await Promise.all([
    writeStoredMobileDeviceToken(session.deviceToken),
    AsyncStorage.setItem(MOBILE_DEVICE_ID_KEY, session.deviceId),
  ])
}

export async function clearMobileDeviceSession(): Promise<void> {
  cachedMobileDeviceToken = null
  cachedMobileDeviceId = null
  await Promise.all([
    removeStoredMobileDeviceToken(),
    AsyncStorage.removeItem(MOBILE_DEVICE_ID_KEY),
  ])
}

export function getCaptureFileUrl(captureId: string): string {
  return `${getApiBase()}/captures/${encodeURIComponent(captureId)}/file`
}

export async function getHealth(): Promise<AtlasHealth> {
  return apiGet<AtlasHealth>('/health', { auth: false })
}

export async function listDomains(params: { include_inactive?: boolean } = {}): Promise<DomainsResponse> {
  return apiGet<DomainsResponse>(`/domains${queryString(params)}`)
}

export async function createDomain(input: CreateAtlasDomainInput): Promise<AtlasDomain> {
  return apiPost<AtlasDomain>('/domains', input)
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

export async function listInbox(params: {
  q?: string
  domain?: DomainKey | 'all'
  status?: 'open' | 'pending' | 'transcribed' | 'failed' | 'no_destination' | 'candidate' | 'routed' | 'archived' | 'snoozed' | 'all'
  sort?: 'recent' | 'oldest' | 'updated' | 'needs_triage'
  limit?: number
} = {}): Promise<InboxResponse> {
  const normalized = { ...params, domain: params.domain === 'all' ? undefined : params.domain }
  return apiGet<InboxResponse>(`/inbox${queryString(normalized)}`)
}

export async function getInboxHealth(params: { domain?: DomainKey | 'all' } = {}): Promise<InboxHealthResponse> {
  const normalized = { domain: params.domain === 'all' ? undefined : params.domain }
  return apiGet<InboxHealthResponse>(`/inbox/health${queryString(normalized)}`)
}

export async function confirmMobilePairing(input: {
  code: string
  platform: 'ios' | 'android'
  device_label?: string | null
  expo_push_token?: string | null
  app_version?: string | null
  os_version?: string | null
  notification_permissions?: string | null
}): Promise<{ device_token: string; device: AtlasMobileDevice }> {
  const response = await apiPost<{ device_token: string; device: AtlasMobileDevice }>('/v1/mobile/pairing/confirm', input)
  await setMobileDeviceSession({
    deviceToken: response.device_token,
    deviceId: response.device.id,
  })

  return response
}

export async function listMobileDevices(): Promise<{ devices: AtlasMobileDevice[] }> {
  return mobileApiGet<{ devices: AtlasMobileDevice[] }>('/v1/mobile/devices')
}

export async function updateMobilePushToken(input: {
  expo_push_token?: string | null
  notification_permissions?: string | null
}): Promise<{ device: AtlasMobileDevice }> {
  return mobileApiPost<{ device: AtlasMobileDevice }>('/v1/mobile/devices/push-token', input)
}

export async function listMobileInbox(params: {
  status?: 'unread' | 'read' | 'actioned' | 'resolved' | 'dismissed' | 'expired' | 'snoozed' | 'all'
  type?: AtlasOperationalInboxType
  limit?: number
} = {}): Promise<MobileInboxResponse> {
  return mobileApiGet<MobileInboxResponse>(`/v1/mobile/inbox${queryString(params)}`)
}

export async function getMobileInboxItem(id: string): Promise<{ item: AtlasOperationalInboxItem }> {
  return mobileApiGet<{ item: AtlasOperationalInboxItem }>(`/v1/mobile/inbox/${encodeURIComponent(id)}`)
}

export async function markMobileInboxRead(id: string): Promise<{ item: AtlasOperationalInboxItem }> {
  return mobileApiPost<{ item: AtlasOperationalInboxItem }>(`/v1/mobile/inbox/${encodeURIComponent(id)}/read`, {})
}

export async function dismissMobileInboxItem(id: string, reason?: string | null): Promise<{ item: AtlasOperationalInboxItem }> {
  return mobileApiPost<{ item: AtlasOperationalInboxItem }>(`/v1/mobile/inbox/${encodeURIComponent(id)}/dismiss`, { reason })
}

export async function snoozeMobileInboxItem(id: string, snoozedUntil: string, reason?: string | null): Promise<{ item: AtlasOperationalInboxItem }> {
  return mobileApiPost<{ item: AtlasOperationalInboxItem }>(`/v1/mobile/inbox/${encodeURIComponent(id)}/snooze`, {
    snoozed_until: snoozedUntil,
    reason,
  })
}

export async function respondMobileInboxItem(
  id: string,
  action: string,
  data: Record<string, unknown> = {},
): Promise<MobileInboxActionResponse> {
  return mobileApiPost<MobileInboxActionResponse>(`/v1/mobile/inbox/${encodeURIComponent(id)}/respond`, {
    action,
    data,
  }, { idempotencyKey: `${action}-${id}-${Date.now()}` })
}

export async function discussMobileInboxItem(id: string): Promise<MobileInboxActionResponse> {
  return mobileApiPost<MobileInboxActionResponse>(`/v1/mobile/inbox/${encodeURIComponent(id)}/discuss`, {}, {
    idempotencyKey: `discuss-${id}`,
  })
}

export async function createThreadFromMobileInbox(id: string): Promise<{
  ok: boolean
  thread_id: string | null
  deep_link: string | null
  item: string
}> {
  return mobileApiPost<{
    ok: boolean
    thread_id: string | null
    deep_link: string | null
    item: string
  }>(`/v1/mobile/threads/from-inbox/${encodeURIComponent(id)}`, {}, {
    idempotencyKey: `thread-from-inbox-${id}`,
  })
}

export async function getMobileAiThread(id: string): Promise<{ thread: AtlasAiThread }> {
  return mobileApiGet<{ thread: AtlasAiThread }>(`/v1/mobile/threads/${encodeURIComponent(id)}`)
}

export async function bulkTriageCaptures(input: {
  capture_ids: string[]
  action: Exclude<CaptureTriageAction, 'attach_note'>
  title?: string | null
  snoozed_until?: string | null
  reason?: string | null
  metadata?: Record<string, unknown>
}): Promise<InboxBulkResponse> {
  return apiPost<InboxBulkResponse>('/inbox/bulk', input)
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

export async function listBitaculaFactors(): Promise<BitaculaFactorsResponse> {
  return apiGet<BitaculaFactorsResponse>('/bitacula/factors')
}

export async function normalizeBitaculaText(input: { text: string; limit?: number }): Promise<BitaculaNormalizationResponse> {
  return apiPost<BitaculaNormalizationResponse>('/bitacula/normalize', input)
}

export async function getBitaculaBriefing(params: {
  date?: string
  limit?: number
  include_logged?: boolean
} = {}): Promise<BitaculaBriefingResponse> {
  return apiGet<BitaculaBriefingResponse>(`/bitacula/briefing${queryString(params)}`)
}

export async function getBitaculaAnalysis(params: {
  behavior_client_id: string
  window_days?: number
}): Promise<BitaculaAnalysisResponse> {
  return apiGet<BitaculaAnalysisResponse>(`/bitacula/analysis${queryString(params)}`)
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

export async function retryCaptureTranscription(id: string): Promise<AtlasCapture> {
  return apiPost<AtlasCapture>(`/captures/${encodeURIComponent(id)}/transcription/retry`, {})
}

export async function triageCapture(id: string, input: CaptureTriageInput): Promise<CaptureTriageResponse> {
  return apiPost<CaptureTriageResponse>(`/captures/${encodeURIComponent(id)}/triage`, input)
}

export async function clarifyCapture(id: string): Promise<{ capture: AtlasCapture }> {
  return apiPost<{ capture: AtlasCapture }>(`/captures/${encodeURIComponent(id)}/semantic/clarify`, {})
}

export async function listCaptureProjectPlanProposals(id: string): Promise<ProjectPlanProposalsResponse> {
  return apiGet<ProjectPlanProposalsResponse>(`/captures/${encodeURIComponent(id)}/project-plan/proposals`)
}

export async function proposeCaptureProjectPlan(
  id: string,
  input: Partial<CaptureTriageInput> & {
    instruction?: string | null
    regeneration_instruction?: string | null
  } = {},
): Promise<AtlasProjectPlanProposal> {
  return apiPost<AtlasProjectPlanProposal>(`/captures/${encodeURIComponent(id)}/project-plan/propose`, input)
}

export async function acceptProjectPlanProposal(
  proposalId: string,
  input: Partial<CaptureTriageInput> = {},
): Promise<ProjectPlanProposalAcceptResponse> {
  return apiPost<ProjectPlanProposalAcceptResponse>(`/project-plan-proposals/${encodeURIComponent(proposalId)}/accept`, input)
}

export async function rejectProjectPlanProposal(
  proposalId: string,
  input: { reason?: string | null } = {},
): Promise<{ proposal: AtlasProjectPlanProposal }> {
  return apiPost<{ proposal: AtlasProjectPlanProposal }>(`/project-plan-proposals/${encodeURIComponent(proposalId)}/reject`, input)
}

export async function regenerateProjectPlanProposal(
  proposalId: string,
  input: Partial<CaptureTriageInput> & {
    instruction?: string | null
    regeneration_instruction?: string | null
  } = {},
): Promise<AtlasProjectPlanProposal> {
  return apiPost<AtlasProjectPlanProposal>(`/project-plan-proposals/${encodeURIComponent(proposalId)}/regenerate`, input)
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

export async function getTodayMission(params: { date?: string; timezone?: string } = {}): Promise<MissionTodayResponse> {
  return apiGet<MissionTodayResponse>(`/mission/today${queryString(params)}`)
}

export async function listTaskAgenda(params: {
  date?: string
  timezone?: string
  domain?: string
  energy_level?: number
  capacity_minutes?: number
  limit?: number
} = {}): Promise<AtlasTaskAgendaResponse> {
  return apiGet<AtlasTaskAgendaResponse>(`/tasks/agenda${queryString(params)}`)
}

export async function planTaskAgenda(input: {
  date?: string
  timezone?: string
  domain?: string
  energy_level?: number
  capacity_minutes?: number
  limit?: number
  force?: boolean
  create_blocks?: boolean
} = {}): Promise<AtlasTaskAgendaPlanResponse> {
  return apiPost<AtlasTaskAgendaPlanResponse>('/tasks/agenda/plan', input)
}

export async function listTaskWeekAgenda(params: {
  start_date?: string
  timezone?: string
  domain?: string
  energy_level?: number
  days?: number
  weekday_capacity_minutes?: number
  weekend_capacity_minutes?: number
  capacity_minutes?: number
  daily_limit?: number
  limit?: number
  include_weekends?: boolean
} = {}): Promise<AtlasTaskWeekAgendaResponse> {
  return apiGet<AtlasTaskWeekAgendaResponse>(`/tasks/agenda/week${queryString(params)}`)
}

export async function planTaskWeekAgenda(input: {
  start_date?: string
  timezone?: string
  domain?: string
  energy_level?: number
  days?: number
  weekday_capacity_minutes?: number
  weekend_capacity_minutes?: number
  capacity_minutes?: number
  daily_limit?: number
  limit?: number
  include_weekends?: boolean
  force?: boolean
  create_blocks?: boolean
} = {}): Promise<AtlasTaskWeekAgendaPlanResponse> {
  return apiPost<AtlasTaskWeekAgendaPlanResponse>('/tasks/agenda/week/plan', input)
}

export async function listTasks(params: {
  domain?: string
  status?: string
  limit?: number
} = {}): Promise<TasksResponse> {
  return apiGet<TasksResponse>(`/tasks${queryString(params)}`)
}

export async function listRoutines(params: {
  domain?: string
  status?: AtlasRoutineStatus | 'all'
  limit?: number
} = {}): Promise<RoutinesResponse> {
  return apiGet<RoutinesResponse>(`/routines${queryString(params)}`)
}

export async function createRoutine(input: {
  title: string
  description?: string | null
  status?: AtlasRoutineStatus
  domain: string
  source_capture_id?: string | null
  project_id?: string | null
  frequency?: AtlasRoutineFrequency
  weekdays?: number[]
  timezone?: string
  preferred_time?: string | null
  estimated_minutes?: number
  energy_required?: 'low' | 'medium' | 'high'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  execution_mode?: AtlasExecutionMode
  friction_level?: number
  emotional_resistance?: number
  clarity_level?: number
  starter_step?: string | null
  minimum_viable_action?: string | null
  if_then_plan?: string | null
  reward_hint?: string | null
  next_occurrence_date?: string | null
  metadata?: Record<string, unknown>
}): Promise<AtlasRoutine> {
  return apiPost<AtlasRoutine>('/routines', input)
}

export async function patchRoutine(
  id: string,
  patch: Partial<Pick<AtlasRoutine,
    | 'title'
    | 'description'
    | 'status'
    | 'domain'
    | 'source_capture_id'
    | 'project_id'
    | 'frequency'
    | 'weekdays'
    | 'timezone'
    | 'preferred_time'
    | 'estimated_minutes'
    | 'energy_required'
    | 'priority'
    | 'execution_mode'
    | 'friction_level'
    | 'emotional_resistance'
    | 'clarity_level'
    | 'starter_step'
    | 'minimum_viable_action'
    | 'if_then_plan'
    | 'reward_hint'
    | 'next_occurrence_date'
    | 'metadata'
  >>,
): Promise<AtlasRoutine> {
  return apiPatch<AtlasRoutine>(`/routines/${encodeURIComponent(id)}`, patch)
}

export async function generateRoutineOccurrence(
  id: string,
  input: { date?: string; timezone?: string } = {},
): Promise<RoutineGenerateResponse> {
  return apiPost<RoutineGenerateResponse>(`/routines/${encodeURIComponent(id)}/generate`, input)
}

export async function generateDueRoutines(input: {
  date?: string
  timezone?: string
  domain?: string
} = {}): Promise<RoutinesGenerateDueResponse> {
  return apiPost<RoutinesGenerateDueResponse>('/routines/generate-due', input)
}

export async function listRoutineEvents(id: string, params: { limit?: number } = {}): Promise<RoutineEventsResponse> {
  return apiGet<RoutineEventsResponse>(`/routines/${encodeURIComponent(id)}/events${queryString(params)}`)
}

export async function listProjects(params: {
  domain?: string
  status?: string
  limit?: number
} = {}): Promise<ProjectsResponse> {
  return apiGet<ProjectsResponse>(`/projects${queryString(params)}`)
}

export async function listProjectReviewQueue(params: {
  domain?: string
  mode?: 'attention' | 'all'
  limit?: number
} = {}): Promise<ProjectReviewQueueResponse> {
  return apiGet<ProjectReviewQueueResponse>(`/projects/review${queryString(params)}`)
}

export async function createProject(input: {
  title: string
  description?: string | null
  status?: AtlasProject['status']
  domain: string
  source_capture_id?: string | null
  goal?: string | null
  next_action?: string | null
  project_type?: AtlasProjectType | null
  desired_outcome?: string | null
  minimum_viable_outcome?: string | null
  definition_of_done?: string | null
  why_now?: string | null
  deadline_at?: string | null
  deadline_kind?: AtlasDeadlineKind | null
  priority?: 'low' | 'normal' | 'high' | 'urgent' | null
  energy_profile?: AtlasProjectEnergyProfile | null
  avoidance_reason?: AtlasAvoidanceReason | null
  next_review_at?: string | null
  metadata?: Record<string, unknown>
}): Promise<CreateProjectResponse> {
  return apiPost<CreateProjectResponse>('/projects', input)
}

export async function patchProject(
  id: string,
  patch: Partial<Pick<AtlasProject,
    | 'title'
    | 'description'
    | 'status'
    | 'domain'
    | 'source_capture_id'
    | 'goal'
    | 'next_action'
    | 'project_type'
    | 'desired_outcome'
    | 'minimum_viable_outcome'
    | 'definition_of_done'
    | 'why_now'
    | 'deadline_at'
    | 'deadline_kind'
    | 'priority'
    | 'energy_profile'
    | 'avoidance_reason'
    | 'last_touched_at'
    | 'next_review_at'
    | 'completed_at'
    | 'paused_until'
    | 'metadata'
  >> & {
    completion_outcome?: string | null
    completion_evidence?: string | null
    completion_note?: string | null
    force_completion?: boolean | null
  },
): Promise<AtlasProject> {
  return apiPatch<AtlasProject>(`/projects/${encodeURIComponent(id)}`, patch)
}

export async function createProjectNextAction(
  id: string,
  input: {
    title?: string | null
    next_action?: string | null
    priority?: 'low' | 'normal' | 'high' | 'urgent' | null
    due_at?: string | null
    estimated_minutes?: number | null
    energy_required?: 'low' | 'medium' | 'high' | null
    metadata?: Record<string, unknown>
  } = {},
): Promise<ProjectNextActionResponse> {
  return apiPost<ProjectNextActionResponse>(`/projects/${encodeURIComponent(id)}/next-action`, input)
}

export async function listProjectSteps(
  id: string,
  params: { status?: AtlasProjectStep['status'] } = {},
): Promise<ProjectStepsResponse> {
  return apiGet<ProjectStepsResponse>(`/projects/${encodeURIComponent(id)}/steps${queryString(params)}`)
}

export async function rebuildProjectPlan(
  id: string,
  input: {
    replace?: boolean
    next_action?: string | null
    goal?: string | null
    priority?: 'low' | 'normal' | 'high' | 'urgent' | null
    metadata?: Record<string, unknown>
  } = {},
): Promise<ProjectPlanResponse> {
  return apiPost<ProjectPlanResponse>(`/projects/${encodeURIComponent(id)}/plan`, input)
}

export async function listProjectPlanProposals(id: string): Promise<ProjectPlanProposalsResponse> {
  return apiGet<ProjectPlanProposalsResponse>(`/projects/${encodeURIComponent(id)}/plan/proposals`)
}

export async function proposeProjectPlan(
  id: string,
  input: {
    title?: string | null
    description?: string | null
    goal?: string | null
    next_action?: string | null
    priority?: 'low' | 'normal' | 'high' | 'urgent' | null
    project_type?: AtlasProjectType | null
    desired_outcome?: string | null
    minimum_viable_outcome?: string | null
    definition_of_done?: string | null
    why_now?: string | null
    estimated_minutes?: number | null
    energy_required?: 'low' | 'medium' | 'high' | null
    instruction?: string | null
    regeneration_instruction?: string | null
    metadata?: Record<string, unknown>
  } = {},
): Promise<AtlasProjectPlanProposal> {
  return apiPost<AtlasProjectPlanProposal>(`/projects/${encodeURIComponent(id)}/plan/propose`, input)
}

export async function acceptProjectScopedPlanProposal(
  projectId: string,
  proposalId: string,
  input: Partial<CaptureTriageInput> = {},
): Promise<ProjectPlanProposalAcceptResponse> {
  return apiPost<ProjectPlanProposalAcceptResponse>(
    `/projects/${encodeURIComponent(projectId)}/plan/proposals/${encodeURIComponent(proposalId)}/accept`,
    input,
  )
}

export async function rejectProjectScopedPlanProposal(
  projectId: string,
  proposalId: string,
  input: { reason?: string | null } = {},
): Promise<{ proposal: AtlasProjectPlanProposal }> {
  return apiPost<{ proposal: AtlasProjectPlanProposal }>(
    `/projects/${encodeURIComponent(projectId)}/plan/proposals/${encodeURIComponent(proposalId)}/reject`,
    input,
  )
}

export async function regenerateProjectScopedPlanProposal(
  projectId: string,
  proposalId: string,
  input: {
    title?: string | null
    goal?: string | null
    next_action?: string | null
    priority?: 'low' | 'normal' | 'high' | 'urgent' | null
    project_type?: AtlasProjectType | null
    instruction?: string | null
    regeneration_instruction?: string | null
    metadata?: Record<string, unknown>
  } = {},
): Promise<AtlasProjectPlanProposal> {
  return apiPost<AtlasProjectPlanProposal>(
    `/projects/${encodeURIComponent(projectId)}/plan/proposals/${encodeURIComponent(proposalId)}/regenerate`,
    input,
  )
}

export async function getProjectExecution(
  id: string,
  params: {
    available_minutes?: number | null
    energy_level?: number | null
    environment?: string | null
  } = {},
): Promise<ProjectExecutionResponse> {
  return apiGet<ProjectExecutionResponse>(`/projects/${encodeURIComponent(id)}/execution${queryString(params)}`)
}

export async function startProjectExecution(
  id: string,
  input: {
    available_minutes?: number | null
    energy_level?: number | null
    environment?: string | null
    note?: string | null
  } = {},
): Promise<ProjectExecutionResponse> {
  return apiPost<ProjectExecutionResponse>(`/projects/${encodeURIComponent(id)}/execution/start`, input)
}

export async function recoverProjectExecution(
  id: string,
  input: {
    available_minutes?: number | null
    target_minutes?: number | null
    next_action?: string | null
    reason?: string | null
  } = {},
): Promise<ProjectExecutionResponse> {
  return apiPost<ProjectExecutionResponse>(`/projects/${encodeURIComponent(id)}/recover`, input)
}

export async function reviewProject(
  id: string,
  input: {
    action?: 'mark_reviewed' | 'postpone' | 'ensure_next_action' | 'rebuild_plan' | 'reactivate' | 'recover'
    review_interval_days?: number | null
    next_action?: string | null
    goal?: string | null
    priority?: 'low' | 'normal' | 'high' | 'urgent' | null
    estimated_minutes?: number | null
    target_minutes?: number | null
    energy_required?: 'low' | 'medium' | 'high' | null
    note?: string | null
    metadata?: Record<string, unknown>
  } = {},
): Promise<ProjectReviewActionResponse> {
  return apiPost<ProjectReviewActionResponse>(`/projects/${encodeURIComponent(id)}/review`, input)
}

export async function patchProjectStep(
  projectId: string,
  stepId: string,
  patch: Partial<Pick<AtlasProjectStep,
    | 'title'
    | 'description'
    | 'status'
    | 'step_type'
    | 'expected_output'
    | 'acceptance_criteria'
    | 'estimated_minutes'
    | 'energy_required'
    | 'friction_level'
    | 'metadata'
  >>,
): Promise<ProjectStepMutationResponse> {
  return apiPatch<ProjectStepMutationResponse>(
    `/projects/${encodeURIComponent(projectId)}/steps/${encodeURIComponent(stepId)}`,
    patch,
  )
}

export async function activateProjectStep(
  projectId: string,
  stepId: string,
): Promise<ProjectStepMutationResponse> {
  return apiPost<ProjectStepMutationResponse>(
    `/projects/${encodeURIComponent(projectId)}/steps/${encodeURIComponent(stepId)}/activate`,
    {},
  )
}

export async function patchTask(
  id: string,
  patch: Partial<Pick<AtlasTask,
    | 'title'
    | 'description'
    | 'status'
    | 'priority'
    | 'project_id'
    | 'project_step_id'
    | 'due_at'
    | 'planned_for_date'
    | 'planned_start_at'
    | 'planned_end_at'
    | 'estimated_minutes'
    | 'energy_required'
    | 'urgency_score'
    | 'impact_score'
    | 'effort_score'
    | 'priority_score'
    | 'planning_status'
    | 'completed_at'
    | 'execution_mode'
    | 'friction_level'
    | 'emotional_resistance'
    | 'clarity_level'
    | 'starter_step'
    | 'minimum_viable_action'
    | 'if_then_plan'
    | 'reward_hint'
    | 'failure_reason_last'
    | 'attempt_count'
    | 'recovery_count'
    | 'metadata'
  >>,
): Promise<AtlasTask> {
  return apiPatch<AtlasTask>(`/tasks/${encodeURIComponent(id)}`, patch)
}

export async function scheduleTask(
  id: string,
  input: {
    planned_for_date?: string | null
    planned_start_at?: string | null
    planned_end_at?: string | null
    estimated_minutes?: number | null
    timezone?: string
    note?: string | null
  },
): Promise<AtlasTask> {
  return apiPost<AtlasTask>(`/tasks/${encodeURIComponent(id)}/schedule`, input)
}

export async function deferTask(
  id: string,
  input: {
    defer_until?: string | null
    timezone?: string
    reason?: string | null
    reason_code?: 'low_energy' | 'too_big' | 'unclear' | 'blocked' | 'waiting' | 'calendar' | 'avoidance' | 'not_now' | null
  } = {},
): Promise<AtlasTask> {
  return apiPost<AtlasTask>(`/tasks/${encodeURIComponent(id)}/defer`, input)
}

export async function completeTask(
  id: string,
  input: {
    completed_at?: string | null
    note?: string | null
    actual_minutes?: number | null
    completion_quality?: 'complete' | 'partial' | 'learned' | 'blocked' | null
    energy_after?: number | null
    outcome?: string | null
    evidence?: string | null
    blocker?: string | null
    next_hint?: string | null
  } = {},
): Promise<AtlasTask> {
  return apiPost<AtlasTask>(`/tasks/${encodeURIComponent(id)}/complete`, input)
}

export async function listTaskEvents(id: string, params: { limit?: number } = {}): Promise<TaskEventsResponse> {
  return apiGet<TaskEventsResponse>(`/tasks/${encodeURIComponent(id)}/events${queryString(params)}`)
}

export async function listProjectEvents(id: string, params: { limit?: number } = {}): Promise<ProjectEventsResponse> {
  return apiGet<ProjectEventsResponse>(`/projects/${encodeURIComponent(id)}/events${queryString(params)}`)
}

export async function listCalendarBlocks(params: {
  date?: string
  date_from?: string
  date_to?: string
  timezone?: string
  source?: string
  limit?: number
} = {}): Promise<CalendarBlocksResponse> {
  return apiGet<CalendarBlocksResponse>(`/calendar/blocks${queryString(params)}`)
}

export async function createCalendarBlock(input: {
  block_date?: string | null
  timezone: string
  title: string
  starts_at: string
  ends_at: string
  source?: 'manual' | 'external_calendar' | 'rize' | 'system' | string
  source_ref?: string | null
  task_id?: string | null
  metadata?: Record<string, unknown>
}): Promise<AtlasCalendarBlock> {
  return apiPost<AtlasCalendarBlock>('/calendar/blocks', input)
}

export async function patchCalendarBlock(
  id: string,
  patch: Partial<Pick<AtlasCalendarBlock, 'block_date' | 'timezone' | 'title' | 'starts_at' | 'ends_at' | 'source' | 'source_ref' | 'task_id' | 'metadata'>>,
): Promise<AtlasCalendarBlock> {
  return apiPatch<AtlasCalendarBlock>(`/calendar/blocks/${encodeURIComponent(id)}`, patch)
}

export async function deleteCalendarBlock(id: string): Promise<AtlasCalendarBlock> {
  return apiDelete<AtlasCalendarBlock>(`/calendar/blocks/${encodeURIComponent(id)}`)
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
  feedback_action?: AtlasSemanticActivation['feedback_action'],
  operator_feedback?: string,
): Promise<AtlasSemanticActivation> {
  return apiPost(`/semantic/activations/${encodeURIComponent(id)}/feedback`, {
    usefulness_score,
    feedback_action,
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
  thread_id?: string
  session_id?: string
  new_thread?: boolean
  agent_slug?: string
  provider?: AtlasAiProvider
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
  thread_id?: string
  status?: AtlasAiStatus
  agent?: string
  limit?: number
} = {}): Promise<AiInteractionsResponse> {
  return apiGet<AiInteractionsResponse>(`/ai/interactions${queryString(params)}`)
}

export async function listAiThreads(params: {
  status?: 'active' | 'archived' | 'closed' | 'all'
  surface?: string
  workspace?: string
  include_messages?: boolean
  limit?: number
} = {}): Promise<AiThreadsResponse> {
  return apiGet<AiThreadsResponse>(`/ai/threads${queryString(params)}`)
}

export async function getAiThread(id: string): Promise<{ thread: AtlasAiThread }> {
  return apiGet(`/ai/threads/${encodeURIComponent(id)}`)
}

export async function createAiThread(input: {
  title?: string
  summary?: string | null
  surface?: string
  workspace?: string | null
  source_type?: string | null
  source_id?: string | null
  metadata?: Record<string, unknown>
} = {}): Promise<{ thread: AtlasAiThread }> {
  return apiPost('/ai/threads', input)
}

export async function updateAiThread(
  id: string,
  patch: {
    title?: string
    summary?: string | null
    status?: 'active' | 'archived' | 'closed'
    metadata?: Record<string, unknown>
  },
): Promise<{ thread: AtlasAiThread }> {
  return apiPatch(`/ai/threads/${encodeURIComponent(id)}`, patch)
}

export async function getAiThreadState(id: string): Promise<{ state: AtlasAiSessionState }> {
  return apiGet(`/ai/threads/${encodeURIComponent(id)}/state`)
}

export async function compactAiThread(
  id: string,
  input: {
    reason?: 'manual' | 'auto' | 'provider_switch' | 'phase_change' | 'session_resume' | 'session_close'
    provider?: string | null
    model?: string | null
    metadata?: Record<string, unknown>
  } = {},
): Promise<{ compaction: AtlasAiCompaction; thread: AtlasAiThread }> {
  return apiPost(`/ai/threads/${encodeURIComponent(id)}/compact`, input)
}

export async function switchAiThreadProvider(
  id: string,
  input: {
    to_provider: AtlasAiProvider
    from_provider?: string | null
    reason?: string
    metadata?: Record<string, unknown>
  },
): Promise<{ handoff: AtlasAiProviderHandoff }> {
  return apiPost(`/ai/threads/${encodeURIComponent(id)}/switch-provider`, input)
}

export async function listAiThreadSnapshots(
  id: string,
  params: { limit?: number } = {},
): Promise<{ snapshots: AtlasAiContextSnapshot[] }> {
  return apiGet(`/ai/threads/${encodeURIComponent(id)}/snapshots${queryString(params)}`)
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
  provider?: AtlasAiProvider | string
  limit?: number
} = {}): Promise<AiJobsResponse> {
  return apiGet<AiJobsResponse>(`/ai/jobs${queryString(params)}`)
}

export async function getAiJob(id: string): Promise<{ job: AtlasAiJob }> {
  return apiGet(`/ai/jobs/${encodeURIComponent(id)}`)
}

export async function retryAiJob(id: string): Promise<{ job: AtlasAiJob }> {
  return apiPost(`/ai/jobs/${encodeURIComponent(id)}/retry`, {})
}

export async function cancelAiJob(id: string): Promise<{ job: AtlasAiJob }> {
  return apiPost(`/ai/jobs/${encodeURIComponent(id)}/cancel`, {})
}

export async function getAiProvidersStatus(): Promise<AiProvidersStatusResponse> {
  return apiGet<AiProvidersStatusResponse>('/ai/providers/status')
}

export async function checkAiProviders(): Promise<{ providers: AtlasAiProviderHealth[] }> {
  return apiPost('/ai/providers/check', {})
}

export async function getAiObservability(params: {
  hours?: number
} = {}): Promise<AiObservabilityResponse> {
  return apiGet<AiObservabilityResponse>(`/ai/observability${queryString(params)}`)
}

export async function listAiQualityActions(params: {
  status?: AtlasAiQualityActionStatus
  action_type?: string
  trace_id?: string
  thread_id?: string
  limit?: number
} = {}): Promise<AiQualityActionsResponse> {
  return apiGet<AiQualityActionsResponse>(`/ai/quality/actions${queryString(params)}`)
}

export async function runAiQualityAction(id: string): Promise<{ action: AtlasAiQualityAction }> {
  return apiPost(`/ai/quality/actions/${encodeURIComponent(id)}/run`, {})
}

export async function listSuggestionAudit(params: { limit?: number } = {}): Promise<AtlasAuditResponse> {
  return apiGet<AtlasAuditResponse>(`/audit/suggestions${queryString(params)}`)
}

export async function apiGet<T>(path: string, opts: { auth?: boolean } = {}): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' }, opts)
}

export async function mobileApiGet<T>(path: string): Promise<T> {
  return mobileApiRequest<T>(path, { method: 'GET' })
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function mobileApiPost<T>(
  path: string,
  body: unknown,
  opts: { idempotencyKey?: string } = {},
): Promise<T> {
  return mobileApiRequest<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
    },
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
  deleted_at?: string | null
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

async function mobileApiRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  await hydrateApiConfig()

  if (!cachedMobileDeviceToken) {
    throw new AtlasApiError('Atlas mobile ainda nao esta pareado.', 401, path, null)
  }

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${cachedMobileDeviceToken}`)

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
  const pairs: Array<[string, string]> = []
  for (const [key, value] of Object.entries(params)) {
    const normalized = normalizeQueryValue(key, value)
    if (normalized !== null) pairs.push([key, normalized])
  }
  if (pairs.length === 0) return ''

  return `?${pairs
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')}`
}

function normalizeQueryValue(key: string, value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null

  if (key === 'limit' && typeof value === 'number') {
    const safeLimit = Math.min(200, Math.max(1, Math.trunc(value)))
    return String(safeLimit)
  }

  return String(value)
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

async function readStoredMobileDeviceToken(): Promise<string | null> {
  try {
    const secureToken = await SecureStore.getItemAsync(MOBILE_TOKEN_KEY)
    if (secureToken) return secureToken
  } catch {
    // SecureStore can be unavailable in a non-native runtime; AsyncStorage remains a fallback.
  }

  return AsyncStorage.getItem(MOBILE_TOKEN_KEY)
}

async function writeStoredMobileDeviceToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(MOBILE_TOKEN_KEY, token)
    await AsyncStorage.removeItem(MOBILE_TOKEN_KEY)
  } catch {
    await AsyncStorage.setItem(MOBILE_TOKEN_KEY, token)
  }
}

async function removeStoredMobileDeviceToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(MOBILE_TOKEN_KEY)
  } catch {
    // Ignore SecureStore removal failures and still clear the fallback key.
  }

  await AsyncStorage.removeItem(MOBILE_TOKEN_KEY)
}
