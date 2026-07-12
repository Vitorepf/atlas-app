import { atlasStorage, ensureMigrationFromAsyncStorage } from '../storage'
import Constants from 'expo-constants'
import * as FileSystem from 'expo-file-system/legacy'
import * as SecureStore from 'expo-secure-store'
import { withRetry } from '../richInput/uploadRetry'
import { buildRichInputPayload } from '../richInput/sourceManifest'
import type { DomainKey } from '../domains'
import {
  mobileVoiceInterruptIdempotencyKey,
  mobileVoiceMetricMs,
  mobileVoicePlayedIdempotencyKey,
  mobileVoiceRuntimeFailureHash,
  mobileVoiceRuntimeFailedIdempotencyKey,
  mobileVoiceSessionEndIdempotencyKey,
  mobileVoiceSessionStartIdempotencyKey,
  mobileVoiceSynthesizedIdempotencyKey,
  mobileVoiceTtsSynthesisIdempotencyKey,
  mobileVoiceTurnIdempotencyKey,
  newMobileVoiceRuntimeId,
} from '../atlasVoiceRuntime'
import {
  createAtlasAiInteractionStream,
  type AtlasAiStreamDone,
  type AtlasAiStreamEvent,
} from '../atlasAiStreamRuntime'

export type { AtlasAiStreamDone, AtlasAiStreamEvent } from '../atlasAiStreamRuntime'

const extraAtlas = (Constants.expoConfig?.extra?.atlas ?? {}) as Partial<ApiConfig>

const DEFAULT_HOST = extraAtlas.apiHost ?? '127.0.0.1'
const DEFAULT_PORT = Number(extraAtlas.apiPort ?? 3737)
const DEFAULT_TOKEN = extraAtlas.apiToken ?? 'local-development-atlas-token-change-me'
const LEGACY_PLACEHOLDER_TOKEN = 'local-development-atlas-token-change-me'
const LEGACY_DEFAULT_HOSTS = new Set(['vitors-macbook-pro-1', 'macbook-pro-de-vitor'])

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

export interface AtlasNotificationPreferences {
  critical_push_enabled: boolean
  telemetry_health_push_enabled: boolean
  daily_report_push_enabled: boolean
  quiet_hours_enabled: boolean
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
  notification_preferences: AtlasNotificationPreferences
  last_seen_at: string | null
  paired_at: string | null
  revoked_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface MobileDevicesResponse {
  devices: AtlasMobileDevice[]
  current_device_id?: string | null
  current_device?: AtlasMobileDevice | null
}

export interface ConstelacaoPositionItem {
  source_type: 'semantic_note' | 'capture' | string
  source_id: string
  title: string
  domains: string[]
  kind: string
  status: string
  x: number
  y: number
  intensity: number
  cluster_key: string
  position_method: string
  position_hash: string
  updated_at: string | null
  preview?: {
    summary_available?: boolean
    content_redacted?: boolean
  }
}

export interface ConstelacaoPositionsResponse {
  schema_version: 'atlas.constelacao.positions.v1' | string
  status: 'ok' | string
  surface_id: 'constelacao' | string
  lens: 'bilderatlas' | 'command_sky' | string
  ui_contract?: {
    schema_version: 'atlas.constelacao.ui_contract.v1' | string
    lens: string
    lens_role: string
    operational_chrome_allowed: boolean
    default_interaction: string
    raw_reading_allowed: boolean
    telemetry?: {
      required_events?: string[]
      privacy_class?: string
      raw_content_allowed?: boolean
    }
  }
  position_engine: {
    mode: string
    source: string
    semantic_positioning_mode?: string
    graph_rag_status: string
    embedding_runtime: string
    fallback_active: boolean
    semantic_positioning_readiness?: Record<string, unknown>
  }
  privacy: {
    privacy_class: string
    raw_content_exposed: boolean
    body_excerpt_exposed: boolean
    vault_raw_content_exposed: boolean
    payload_hash: string
  }
  items: ConstelacaoPositionItem[]
  evidence_ledger: {
    recorded: boolean
    event_type: string
    event_id: string | null
  }
  generated_at: string
}

export interface AtlasVoiceSessionLease {
  schema_version: 'atlas.voice.session_lease.v1' | string
  mode: 'livekit_webrtc' | 'mobile_push_to_talk' | string
  room_name: string
  participant_identity: string
  token_status: 'not_issued_scaffold' | 'issued' | string
  access_token?: string
  livekit_url?: string | null
  ttl_seconds?: number
  kernel_decision_required_per_turn: boolean
  raw_audio_persistence_allowed: boolean
}

export interface AtlasVoiceSessionResponse {
  schema_version: 'atlas.voice_realtime.v1' | 'atlas.voice_realtime.scaffold.v1' | string
  status: 'session_ready' | 'session_blocked' | 'session_started_scaffold' | 'session_ended_scaffold' | string
  session: {
    session_id: string
    surface_id: 'voice_realtime' | string
    client_surface: 'mobile' | 'mac_edge' | string
    transport: 'livekit_webrtc' | 'mobile_push_to_talk' | string
    runtime: 'livekit_agents_sdk' | string
    room_name: string
    participant_identity: string
    privacy_class: string
    rivals_arm: string
  }
  session_lease?: AtlasVoiceSessionLease
  eclipse?: {
    active: boolean
    reasons: string[]
    raw_audio_persistence_allowed: boolean
  }
  evidence_ledger?: {
    recorded: boolean
    event_type: string
    event_id: string | null
  }
  livekit_url?: string | null
  room_name?: string | null
  participant_identity?: string | null
  participant_token?: string | null
  agent_identity?: string | null
}

export interface AtlasVoiceTurnResponse extends AtlasVoiceSessionResponse {
  status: 'turn_accepted_scaffold' | 'blocked_by_eclipse' | string
  turn?: {
    turn_id: string
    provider_execution_enabled?: boolean
    runtime_execution_enabled?: boolean
    interruption_recorded?: boolean
    interruption_source?: 'operator' | 'mobile' | 'runtime_callback' | string
    reason?: string
    interrupted_stage?: string
    played_duration_ms?: number | null
    latency_ms?: number | null
    raw_text_persisted?: boolean
    raw_audio_persisted?: boolean
    event_type?: string
    accepted_kernel_turn_required?: boolean
    payload_contract_valid?: boolean
    violations?: string[]
    response_text_hash?: string
    audio_hash?: string
    audio_duration_ms?: number | null
    tts_provider?: string | null
    failure_code?: string
    error_class?: string
    error_message_hash?: string
    operation_envelope?: {
      envelope_id?: string
      trace_id?: string
      input_hash?: string
      chain_hash?: string
    }
    decision_receipt?: {
      receipt_id?: string
      dry_run?: boolean
      domain?: string
      flow?: string
      receipt_hash?: string
      chain_hash?: string
    }
    ai_interaction?: {
      dispatched?: boolean
      status?: string
      reason?: string
      trace_id?: string | null
      thread_id?: string | null
      trace_status?: AtlasAiStatus | string
      transcript_hash?: string
      error_class?: string
      error_message_hash?: string
    }
  }
}

export interface AtlasVoiceTtsSynthesisResponse {
  schema_version: 'atlas.voice_realtime.tts_synthesis.v1' | string
  status: 'synthesized' | 'voice_unavailable' | string
  provider: 'elevenlabs' | string
  voice_id: string | null
  model_id: string | null
  mime_type: 'audio/mpeg' | string
  audio_base64: string
  audio_hash: string
  byte_length?: number | null
  latency_ms?: number | null
  response_text_hash?: string | null
}

export interface AtlasVoiceReadinessResponse {
  schema_version: 'atlas.voice.readiness.v1' | string
  available: boolean
  status: 'ready' | 'attention' | 'ledger_unavailable' | string
  hours?: number
  window?: {
    since: string
    until: string
  }
  mobile_first: boolean
  phase0_hardening?: Record<string, unknown>
  product_loop_check?: {
    schema_version?: string
    status?: string
    command?: string
    promotion_allowed?: boolean
    auto_promotion_allowed?: boolean
    daemon_started?: boolean
    required_gates?: string[]
    [key: string]: unknown
  }
  enterprise_mobile_loop?: {
    schema_version: 'atlas.voice_realtime.enterprise_mobile_loop.v1' | string
    status: 'contract_ready' | 'needs_promotion_evidence' | 'promotion_evidence_ready' | 'blocked' | string
    promotion_required_events: string[]
    healthy_loop_events: string[]
    required_drills_before_promotion: string[]
    missing_promotion_events?: string[]
    mobile_callbacks: {
      turn_synthesized: string
      turn_played: string
      turn_interrupted: string
      runtime_failed: string
      [key: string]: string
    }
    privacy_invariants: {
      raw_audio_persisted: boolean
      raw_transcript_persisted: boolean
      raw_response_text_persisted: boolean
      runtime_errors_require_error_message_hash: boolean
      hashes_normalized_lowercase: boolean
      [key: string]: boolean
    }
    latency_slo_stages: string[]
    gates?: {
      healthy_loop_ready: boolean
      interruption_drill_recorded: boolean
      redacted_failure_drill_recorded: boolean
      latency_slo_clean: boolean
      raw_payload_persistence_forbidden: boolean
      [key: string]: boolean
    }
  }
  runtime_dependency_summary?: Record<string, unknown>
  score: number | null
  event_counts?: Record<string, number>
  session_count?: number
  turn_count?: number
  slo?: {
    observation_count: number
    breach_count: number
    stages: Record<string, number>
  }
  gates?: {
    ledger_available?: boolean
    required_events_present: boolean
    latency_slo_clean: boolean
    raw_audio_forbidden: boolean
    kernel_decision_per_turn: boolean
    rivals_voice_ready: boolean
    [key: string]: boolean | undefined
  }
  required_events?: string[]
  missing_events: string[]
  review_signal: {
    status: string
    severity: string
    recommended_action: string
  }
  next_action?: string
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

export interface AtlasInboxPresentationMetric {
  label: string
  value: string
  tone: 'critical' | 'warning' | 'ok' | 'neutral' | string
}

export interface AtlasInboxHumanPresentation {
  schema_version: 'atlas.inbox_item.human_presentation.v1' | string
  headline: string
  severity_label: string
  status_label: string
  category_label: string
  plain_summary: string
  primary_metric: AtlasInboxPresentationMetric
  metrics: AtlasInboxPresentationMetric[]
  why_this_matters: string
  operator_next_step: string
  recommended_actions: string[]
  review_required: boolean
  auto_resolution_allowed: boolean
  sections: Array<{
    title: string
    items: Array<Record<string, unknown>>
  }>
}

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
  presentation?: AtlasInboxHumanPresentation | null
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

export interface AtlasMobileThreadContext {
  source: {
    type: 'ai_inbox_item' | string
    id: string
    inbox_type: AtlasOperationalInboxType | string
    category: string | null
    severity: 'debug' | 'info' | 'warning' | 'critical' | string
    status: string
    title: string
    summary: string | null
    initiator: string
    created_at: string | null
  }
  context_bundle: {
    id: string
    purpose: string
    title: string
    summary: string
    body_preview: string | null
    redaction_status: string
    token_estimate: number | null
    expires_at: string | null
  } | null
  policy: {
    atlas_focus: string
    capability_profile: string
    permission_policy: string
    execution_policy: string
    allows_code_execution: boolean
    requires_approval_for_changes: boolean
  }
  refs_count: {
    sources: number
    traces: number
    jobs: number
    metrics: number
    files: number
    diffs: number
    total: number
  }
}

export interface MobileInboxResponse {
  items: AtlasOperationalInboxItem[]
  unread_count: number
  next_cursor?: string | null
  generated_at: string
}

export interface AtlasCriticalInboxReviewItem {
  id: string
  deep_link: string
  review_kind: 'health' | 'performance' | 'generic' | string
  category: string | null
  severity: string
  status: string
  status_label: string
  created_at: string | null
  headline: string
  plain_summary: string | null
  primary_metric: AtlasInboxPresentationMetric | null
  metrics: AtlasInboxPresentationMetric[]
  why_this_matters: string | null
  operator_next_step: string
  decision_options?: Array<{
    id: string
    label: string
    action_id: string
    recommended: boolean
    requires_reason: boolean
    requires_evidence: boolean
    state_effect: string
    status_after: string
    allowed_for_agent: boolean
    allowed_for_operator: boolean
    explanation: string
    [key: string]: unknown
  }>
  commands: Record<string, string>
  safety: Record<string, unknown>
  [key: string]: unknown
}

export interface AtlasCriticalInboxReviewSummary {
  schema_version: 'atlas.inbox.critical_review_summary.v1' | string
  scope: string
  active_critical_count: number
  returned_item_count: number
  unread_count: number
  read_count: number
  other_status_count: number
  health_signal_count: number
  performance_report_count: number
  other_kind_count: number
  cost_visibility_recovered_count: number
  still_requires_operator_decision_count: number
  priority_order: string[]
  recommended_operator_flow: string[]
  safety: Record<string, unknown>
  [key: string]: unknown
}

export interface MobileCriticalInboxReviewResponse {
  critical_review: {
    schema_version: 'atlas.inbox.critical_review.v1' | string
    status: string
    active_critical_count: number
    returned_item_count: number
    operator_required: boolean
    agent_auto_resolve_allowed: boolean
    agent_auto_dismiss_allowed: boolean
    raw_payload_exposed: boolean
    review_summary: AtlasCriticalInboxReviewSummary
    items: AtlasCriticalInboxReviewItem[]
    completion_recheck_command?: string
    generated_at?: string
    [key: string]: unknown
  }
}

export interface MobileInboxActionResponse {
  ok: boolean
  idempotent?: boolean
  result: Record<string, unknown>
  item: AtlasOperationalInboxItem
}

export interface AtlasPerformanceRecommendation {
  id: string
  user_id: string
  state: string
  kind: string
  target_metric: string
  target_dimension: Record<string, unknown>
  expected_impact: Record<string, unknown>
  baseline_snapshot: Record<string, unknown> | null
  observed_impact: Record<string, unknown> | null
  measurement_due_at: string | null
  measurement_window_days: number | null
  priority_score: number
  snoozed_until: string | null
  closed_at: string | null
  closed_reason: string | null
  created_at: string | null
  updated_at: string | null
}

export interface MobileRecommendationsResponse {
  items: AtlasPerformanceRecommendation[]
  generated_at: string
}

export interface MobileRecommendationResponse {
  item: AtlasPerformanceRecommendation
}

export interface AtlasPowerSession {
  id: string
  kind: string
  status: string
  reason: string | null
  source: string | null
  ai_job_id: string | null
  caffeinate_pid: number | null
  caffeinate_label: string | null
  caffeinate_alive: boolean | null
  started_at: string | null
  expires_at: string | null
  stopped_at: string | null
  stop_reason: string | null
  metadata: Record<string, unknown>
}

export interface AtlasMaintenanceWindow {
  id: string
  name: string
  enabled: boolean
  timezone: string
  wake_time: string
  duration_minutes: number
  days_of_week: number[]
  last_scheduled_at: string | null
  last_started_at: string | null
  last_completed_at: string | null
  metadata: Record<string, unknown>
}

export interface AtlasPowerEvent {
  id: string
  event_type: string
  severity: string
  message: string | null
  metadata: Record<string, unknown>
  occurred_at: string | null
}

export interface AtlasMacStatusResponse {
  host_key: string
  status: 'online_idle' | 'held_awake' | 'running_jobs' | 'offline_or_sleeping' | 'not_installed' | string
  host: {
    host_key: string
    hostname: string | null
    status: string
    agent_available: boolean
    caffeinate_available: boolean
    pmset_available: boolean
    docker_available: boolean
    on_ac_power: boolean | null
    battery_percent: number | null
    active_power_sessions: number
    active_ai_jobs: number
    last_seen_at: string | null
    metadata: Record<string, unknown>
  } | null
  active_sessions: AtlasPowerSession[]
  mac_agent?: {
    installed: boolean
    loaded: boolean | null
    running: boolean | null
    ready: boolean
    needs_install: boolean
    pid: number | null
    plist: string
    label: string
    launchctl_domain: string
    install_command: string
    uninstall_command: string
    log_paths: {
      stdout: string
      stderr: string
    }
    next_action: {
      code: string
      severity: string
      message: string
      command: string | null
    }
    last_error: string | null
  }
  power_helper?: {
    installed: boolean
    loaded: boolean | null
    running: boolean | null
    ready?: boolean
    needs_install: boolean
    plist: string
    label: string
    last_checked_at: string | null
    last_success_at: string | null
    last_success_fresh?: boolean
    stale_after_minutes?: number
    install_command: string
    uninstall_command?: string
    doctor_command?: string
    sudo_without_password?: boolean | null
    admin_password_required?: boolean | null
    launchctl_domain?: string
    log_paths?: {
      stdout: string
      stderr: string
    }
    next_action?: {
      code: string
      severity: string
      message: string
      command: string | null
    }
    last_error: string | null
  }
  caffeinate_runtime?: {
    available: boolean
    method: string
    label_prefix: string
    active_labels: string[]
    launchctl_labels: string[]
    orphan_labels: string[]
    orphan_count: number
    cleanup_command: string
  }
  wake_schedule?: {
    available: boolean
    scheduled: boolean
    atlas_confirmed: boolean
    system_has_wakeorpoweron: boolean
    raw: string | null
    next_wake_at: string | null
  }
  readiness?: {
    overall: 'ready' | 'remote_ready_wake_blocked' | 'blocked' | string
    summary?: {
      label: string
      message: string
      mode: string
    }
    ready_for_remote: boolean
    ready_for_scheduled_wake: boolean
    ready_for_background_jobs: boolean
    power_ready_for_background_jobs: boolean
    agent_online: boolean
    mac_agent_ready: boolean
    caffeinate_ready: boolean
    power_helper_ready: boolean
    atlas_wake_confirmed: boolean
    on_ac_power: boolean | null
    battery_percent: number | null
    active_power_sessions: number
    active_ai_jobs: number
    next_action?: {
      code: string
      severity: string
      message: string
      command: string | null
      kind: string
    }
    blockers: Array<{
      code: string
      severity: string
      message: string
      action: string | null
    }>
    warnings: Array<{
      code: string
      severity: string
      message: string
      action: string | null
    }>
  }
  recent_events?: AtlasPowerEvent[]
  maintenance_windows?: AtlasMaintenanceWindow[]
  generated_at: string
}

export interface AtlasMacSessionResponse {
  ok: boolean
  session: AtlasPowerSession | null
  status: AtlasMacStatusResponse
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
  open_blockers_count?: number
  top_blocker?: AtlasProjectBlocker | null
  execution_health?: {
    status: 'healthy' | 'attention' | 'paused' | 'completed' | 'archived' | string
    reasons: string[]
    score: number
    missing_next_action: boolean
    review_due: boolean
    overdue: boolean
    deferred_action?: boolean
    deferred_ready?: boolean
    open_blockers_count?: number
    has_open_blockers?: boolean
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

export type AtlasProjectBlockerReasonCode =
  | 'unclear'
  | 'too_large'
  | 'boring'
  | 'waiting_external'
  | 'missing_resource'
  | 'fear'
  | 'energy'
  | 'technical_unknown'
  | 'decision_needed'
  | 'other'

export type AtlasProjectBlockerStatus = 'open' | 'resolved' | 'cancelled'
export type AtlasProjectBlockerSeverity = 'low' | 'medium' | 'high'

export interface AtlasProjectBlocker {
  id: string
  project_id: string
  task_id: string | null
  project_step_id: string | null
  unblock_task_id: string | null
  status: AtlasProjectBlockerStatus | string
  severity: AtlasProjectBlockerSeverity | string
  reason_code: AtlasProjectBlockerReasonCode | string
  description: string
  unblock_next_action: string | null
  waiting_on: string | null
  due_at: string | null
  resolved_at: string | null
  resolution_note: string | null
  created_from_event_id: string | null
  project?: Pick<AtlasProject, 'id' | 'title' | 'status' | 'domain'> | null
  task?: Pick<AtlasTask, 'id' | 'title' | 'status' | 'planning_status'> | null
  project_step?: Pick<AtlasProjectStep, 'id' | 'title' | 'status' | 'step_order'> | null
  unblock_task?: Pick<AtlasTask, 'id' | 'title' | 'status' | 'planning_status'> | null
  metadata: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
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

export type AtlasEngineeringEvidenceStatus =
  | 'passed'
  | 'failed'
  | 'needs_review'
  | 'not_applicable'
  | string

export type AtlasEngineeringEvidenceType =
  | 'acceptance'
  | 'scenario'
  | 'validation_evidence'
  | 'manual_qa'
  | 'deep_code_review'
  | 'database_review'
  | string

export interface AtlasEngineeringTaskContract {
  contract_version: number | string
  source: string
  type: string
  goal: string
  context: string[]
  in_scope: string[]
  out_of_scope: string[]
  acceptance_criteria: Array<string | { id?: string; statement?: string; verification_method?: string }>
  likely_files: string[]
  allowed_paths?: string[]
  patterns_to_follow: string[]
  patterns_to_avoid: string[]
  edge_cases: string[]
  dependencies: {
    blocked_by: string[]
    blocks: string[]
  }
  test_coverage: string[]
  estimated_size: 'XS' | 'S' | 'M' | 'L' | 'XL' | string
  definition_of_done: string[]
  refs: Record<string, unknown>
}

export interface AtlasEngineeringBlueprintPhase {
  id: string
  title: string
  gate: string
  required_outputs: string[]
}

export interface AtlasEngineeringAcceptanceItem {
  id: string
  criterion: string
  verification_method: string
  status: string
  evidence_required: boolean
}

export interface AtlasEngineeringScenario {
  id: string
  name: string
  source?: string
  verification_method?: string
}

export interface AtlasEngineeringReviewGate {
  id: string
  title: string
  required: boolean
  status: string
  minimum_confidence?: number
  checks?: string[]
  evidence?: string
  evidence_id?: string | null
}

export interface AtlasEngineeringBlueprint {
  schema_version: number
  blueprint_id: string
  source: string
  generated_at: string
  objective: string
  phases: AtlasEngineeringBlueprintPhase[]
  task_contract_refs: {
    task_id: string
    project_id: string | null
    project_step_id: string | null
  }
  acceptance_matrix: AtlasEngineeringAcceptanceItem[]
  scenario_inventory: AtlasEngineeringScenario[]
  review_gates: AtlasEngineeringReviewGate[]
  contingency_policy: {
    stop_conditions: string[]
    fallback: string
    human_review_required_when: string[]
  }
}

export interface AtlasEngineeringEvidence {
  id: string
  evidence_type: AtlasEngineeringEvidenceType
  target_id: string | null
  status: AtlasEngineeringEvidenceStatus
  confidence: number | null
  summary: string
  trace_id?: string | null
  command: string | null
  artifact_url: string | null
  output_excerpt: string | null
  files: string[]
  metadata: Record<string, unknown>
  source: string
  recorded_at: string | null
}

export interface AtlasEngineeringRunAttemptSummary {
  id: string
  attempt_number: number
  provider?: string | null
  model?: string | null
  phase: string | null
  status: string | null
  trace_id?: string | null
  patch_hash?: string | null
  diff_stat?: Record<string, unknown> | null
  changed_files?: string[]
  failure_summary?: string | null
  started_at?: string | null
  finished_at?: string | null
}

export interface AtlasEngineeringPatchArtifactSummary {
  id: string
  attempt_id?: string | null
  base_ref?: string | null
  head_ref?: string | null
  diff_hash?: string | null
  diff_excerpt?: string | null
  diff_path?: string | null
  changed_files?: string[]
  created_files?: string[]
  deleted_files?: string[]
  risk_flags?: string[]
  metadata?: Record<string, unknown> | null
  created_at?: string | null
}

export interface AtlasEngineeringPatchDiffResponse {
  patch_artifact: AtlasEngineeringPatchArtifactSummary & {
    engineering_run_id: string
    computed_hash?: string | null
    hash_matches?: boolean | null
  }
  diff: {
    content: string
    source: 'diff_path' | 'excerpt' | string
    size_bytes: number
    returned_bytes: number
    truncated: boolean
    max_bytes: number
  }
}

export interface AtlasEngineeringControlResultSummary {
  id?: string
  attempt_id?: string | null
  control_id?: string | null
  control_slug: string
  control_definition_hash?: string | null
  control_version?: number | null
  status: string
  summary?: string | null
  output_excerpt?: string | null
  duration_ms?: number | null
  artifact_path?: string | null
  metadata?: Record<string, unknown> | null
  created_at?: string | null
}

export interface AtlasEngineeringTestRunSummary {
  id?: string
  attempt_id?: string | null
  test_case_id?: string | null
  command?: string | null
  status: string
  exit_code?: number | null
  duration_ms?: number | null
  stdout_excerpt?: string | null
  stderr_excerpt?: string | null
  type?: string | null
  source?: string | null
  artifact_path?: string | null
  metadata?: Record<string, unknown> | null
  visual_artifact_export?: Record<string, unknown> | null
  visual_e2e?: Record<string, unknown> | null
  visual_smoke?: Record<string, unknown> | null
  quality_scan?: Record<string, unknown> | null
  quality_scan_result?: Record<string, unknown> | null
  quality_artifact_export?: Record<string, unknown> | null
  created_at?: string | null
}

export interface AtlasEngineeringTestArtifactFile {
  path: string
  bytes: number
  mime_type?: string | null
  kind: 'image' | 'html' | 'json' | 'xml' | 'text' | 'binary' | string
  readable_inline: boolean
  sha256?: string | null
  modified_at?: string | null
}

export interface AtlasEngineeringTestArtifactsResponse {
  run_id: string
  test_run_id: string
  artifact_root_hash: string
  file_count: number
  total_listed_bytes: number
  truncated: boolean
  files: AtlasEngineeringTestArtifactFile[]
}

export interface AtlasEngineeringTestArtifactContentResponse {
  run_id: string
  test_run_id: string
  artifact: AtlasEngineeringTestArtifactFile & {
    returned_bytes: number
    truncated: boolean
    max_bytes: number
  }
  content?: string | null
  content_base64?: string | null
  data_url?: string | null
}

export interface AtlasEngineeringReviewFindingSummary {
  id: string
  severity: string
  status: string
  confidence?: number | null
  category?: string | null
  source?: string | null
  title: string
  body?: string | null
  file_path?: string | null
  start_line?: number | null
  end_line?: number | null
  evidence?: Record<string, unknown> | null
  recommendation?: string | null
  resolution?: Record<string, unknown> | null
  detected_at?: string | null
  resolved_at?: string | null
  created_at?: string | null
}

export interface AtlasEngineeringRunOperatorActionSummary {
  id: string
  action: 'cancel' | 'accept' | 'needs_human' | 'reject' | string
  actor: string | null
  status_before: string | null
  decision_before: string | null
  status_after: string | null
  decision_after: string | null
  note?: string | null
  payload?: Record<string, unknown> | null
  acted_at?: string | null
  created_at?: string | null
}

export interface AtlasEngineeringAttemptComparisonRow {
  attempt_id: string
  attempt_number: number
  provider?: string | null
  model?: string | null
  phase?: string | null
  status?: string | null
  score: number
  rank: number
  recommendation: 'best_repair_base' | 'review_before_replay' | 'avoid_replay_base' | string
  patch_hash?: string | null
  changed_files_count: number
  patch_count: number
  passed_tests: number
  failed_tests: number
  failed_controls: number
  open_findings: number
  blocking_findings: number
  risk_flags: string[]
  signals: string[]
}

export interface AtlasEngineeringAttemptComparison {
  status: 'empty' | 'single_attempt' | 'ranked' | string
  best_attempt_id?: string | null
  best_attempt_number?: number | null
  best_score?: number | null
  best_recommendation?: string | null
  attempts: AtlasEngineeringAttemptComparisonRow[]
}

export interface AtlasEngineeringRunSummary {
  id?: string
  task_id?: string
  generated_at?: string | null
  plan_id?: string | null
  blueprint_id?: string | null
  status?: string | null
  decision?: string | null
  score?: number | null
  attempt_count?: number
  context_pack_hash?: string | null
  harnessability_score?: number | null
  autonomy_policy?: Record<string, unknown> | null
  model_selection?: Record<string, unknown> | null
  replay?: Record<string, unknown> | null
  workspace?: {
    mode?: string | null
    status?: string | null
    isolated?: boolean
    release_status?: string | null
  }
  review_summary?: {
    open_count: number
    blocking_count: number
    by_severity: Record<string, number>
  }
  attempts?: AtlasEngineeringRunAttemptSummary[]
  patch_artifacts?: AtlasEngineeringPatchArtifactSummary[]
  control_results?: AtlasEngineeringControlResultSummary[]
  test_runs?: AtlasEngineeringTestRunSummary[]
  review_findings?: AtlasEngineeringReviewFindingSummary[]
  operator_actions?: AtlasEngineeringRunOperatorActionSummary[]
  attempt_comparison?: AtlasEngineeringAttemptComparison | null
  timeline?: Array<{
    type: string
    status: string
    label: string | null
    at: string | null
    ref_id: string | null
  }>
  started_at?: string | null
  finished_at?: string | null
  changed_files_count?: number
  acceptance_total?: number
  acceptance_needs_review?: number
  review_needs_attention?: number
  [key: string]: unknown
}

export interface AtlasEngineeringBenchmarkRunSummary {
  id: string
  suite_id: string
  benchmark_key: string | null
  provider: string | null
  model: string | null
  mode: string | null
  case_set_hash: string | null
  status: string
  total_cases: number
  passed_cases: number
  failed_cases: number
  baseline_run_id: string | null
  pass_rate: number | null
  pass_rate_delta: number | null
  average_score: number | null
  average_score_delta: number | null
  duration_ms: number
  trend_status: string | null
  harness_version: string | null
  total_attempts: number
  failed_control_count: number
  blocked_control_count: number
  skipped_required_control_count: number
  failed_test_count: number
  open_review_finding_count: number
  blocking_review_finding_count: number
  changed_files_count: number
  risk_flag_count: number
  total_tokens: number | null
  cost_microusd: number | null
  telemetry_coverage_count: number
  quality_metrics?: Record<string, unknown> | null
  release_gate_status: string | null
  release_gate_profile: string | null
  release_gate_policy?: Record<string, unknown> | null
  release_gate_failures?: string[] | null
  release_gate_warnings?: string[] | null
  rollout_status: string | null
  rollout_policy?: Record<string, unknown> | null
  rollout_decision_at: string | null
  outcome_status: string | null
  outcome_score: number | null
  outcome?: Record<string, unknown> | null
  outcome_recorded_at: string | null
  outcome_recorded_by: string | null
  summary?: Record<string, unknown> | null
  started_at: string | null
  finished_at: string | null
  created_at: string | null
}

export interface AtlasEngineeringBenchmarkSuiteSummary {
  id: string
  slug: string
  name: string
  description: string | null
  status: string
  cases_count: number
  benchmark_runs_count: number
  corpus_manifest?: Record<string, unknown> | null
  corpus_health?: Record<string, unknown> | null
  rollout_policy?: Record<string, unknown> | null
  rollout_calibration?: Record<string, unknown> | null
  latest_run: AtlasEngineeringBenchmarkRunSummary | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasEngineeringBenchmarkCaseSummary {
  id: string
  suite_id: string
  task_id: string | null
  case_code: string
  title: string
  description: string | null
  expected_decision: string | null
  min_score: number
  corpus_tier: string | null
  domain_slug: string | null
  risk_profile: string | null
  curation_status: string | null
  curation_score: number | null
  corpus_fingerprint: string | null
  curated_at: string | null
  tags: string[]
  status: string
  workspace_path_hash: string | null
  metadata?: Record<string, unknown>
  created_at: string | null
}

export interface AtlasEngineeringBenchmarkResultSummary {
  id: string
  benchmark_run_id: string
  case_id: string
  case_code: string | null
  engineering_run_id: string | null
  task_id: string | null
  status: string
  passed: boolean
  decision: string | null
  score: number | null
  duration_ms: number
  expectation: Record<string, unknown>
  observed: Record<string, unknown>
  failure_summary: string | null
  engineering_run?: AtlasEngineeringRunSummary | null
  created_at: string | null
}

export interface AtlasEngineeringBenchmarkSuiteResponse {
  suite: {
    id: string
    slug: string
    name: string
    description: string | null
    status: string
    default_runner_options: Record<string, unknown>
    metadata: Record<string, unknown>
    corpus_manifest?: Record<string, unknown> | null
    corpus_health?: Record<string, unknown> | null
    rollout_policy?: Record<string, unknown> | null
    rollout_calibration?: Record<string, unknown> | null
    created_at: string | null
    updated_at: string | null
  }
  cases: AtlasEngineeringBenchmarkCaseSummary[]
  latest_runs: AtlasEngineeringBenchmarkRunSummary[]
}

export interface AtlasEngineeringBenchmarkRunResponse {
  benchmark_run: AtlasEngineeringBenchmarkRunSummary
  suite: {
    id: string
    slug: string
    name: string
  } | null
  results: AtlasEngineeringBenchmarkResultSummary[]
}

export interface AtlasEngineeringBenchmarkSuitesResponse {
  suites: AtlasEngineeringBenchmarkSuiteSummary[]
}

export interface AtlasEngineeringBenchmarkRunInput {
  workspace?: string | null
  provider?: string | null
  model?: string | null
  model_policy?: 'fixed' | 'off' | 'auto' | 'balanced' | 'best_quality' | 'best-quality' | 'fastest' | 'cheapest' | string | null
  fair_mode?: boolean | null
  claude_only?: boolean | null
  single_provider?: boolean | null
  no_decide?: boolean | null
  fallback_disabled?: boolean | null
  require_pass_without_human?: boolean | null
  claude_code_baseline?: 'off' | 'plan' | 'run' | boolean | number | string | null
  claude_code_baseline_mode?: 'off' | 'plan' | 'run' | string | null
  claude_code_baseline_model?: string | null
  claude_code_baseline_binary?: string | null
  claude_code_baseline_workspace?: string | null
  claude_code_baseline_timeout?: number | null
  claude_code_baseline_validation_timeout?: number | null
  baseline_runner?: 'off' | 'plan' | 'run' | string | null
  baseline_model?: string | null
  baseline_timeout_seconds?: number | null
  baseline_validation_timeout_seconds?: number | null
  rivals_battery_mode?: 'official_fair' | 'same_model' | 'max' | string | null
  rivals_battery_plan_hash?: string | null
  operator_plan_reviewed?: boolean | null
  operator_cost_acknowledged?: boolean | null
  permission?: 'auto' | 'read' | 'write' | 'danger' | string | null
  sandbox?: 'workspace' | 'worktree' | 'docker' | string | null
  docker_service?: string | null
  docker_image?: string | null
  docker_workdir?: string | null
  docker_cache?: 'auto' | 'off' | string | null
  docker_network?: 'profile' | 'none' | 'bridge' | string | null
  docker_healthcheck_services?: string[] | null
  docker_healthcheck_timeout?: number | null
  docker_artifact_paths?: string[] | null
  docker_artifact_max_files?: number | null
  docker_artifact_max_bytes?: number | null
  provider_runtime?: 'host' | 'docker' | 'auto' | string | null
  provider_docker_compose_file?: string | null
  provider_docker_service?: string | null
  provider_docker_app_dir?: string | null
  provider_docker_workspace_dir?: string | null
  max_attempts?: number | null
  test_command?: string | null
  visual_e2e?: 'auto' | 'off' | 'required' | string | null
  quality_scan?: 'auto' | 'off' | 'required' | string | null
  quality_profile?: 'auto' | 'fast' | 'standard' | 'release' | 'deep' | string | null
  quality_changed_only?: boolean | null
  harness_policy?: 'auto' | 'off' | 'strict' | string | null
  control_profile?: string | null
  complete?: boolean | null
  auto_test?: boolean | null
  critical?: boolean | null
  dry_run?: boolean | null
  no_provider?: boolean | null
  keep_workspace?: boolean | null
  apply_isolated_patch?: boolean | null
  release_gate_profile?: 'off' | 'advisory' | 'smoke' | 'release' | 'strict' | string | null
  release_gate_policy?: Record<string, unknown> | null
  limit?: number | null
  corpus_tier?: 'smoke' | 'release' | 'full_regression' | 'quarantine' | string | null
  domain_slug?: string | null
  risk_profile?: 'low' | 'medium' | 'high' | 'critical' | string | null
  curation_status?: 'candidate' | 'curated' | 'quarantined' | 'retired' | string | null
  case_codes?: string[]
  tags?: string[]
  runner_options?: Record<string, unknown>
}

export interface AtlasEngineeringRivalsBatteryPlanInput {
  mode: 'official_fair' | 'same_model' | 'max' | string
  workspace?: string | null
  baseline_workspace?: string | null
  provider?: string | null
  model?: string | null
  limit?: number | null
}

export interface AtlasEngineeringRivalsBatteryPlanResponse {
  battery_plan: {
    schema_version: 'atlas.rivals.battery_plan.v1' | string
    mode: string
    status: string
    ready: boolean
    blockers: string[]
    operator_required: boolean
    cost_acknowledgement_required: boolean
    agent_auto_execution_allowed: boolean
    provider_dispatch_required: boolean
    external_cost_possible: boolean
    synthetic_scores_allowed: boolean
    plan_review_required: boolean
    plan_hash: string
    selection_contract?: {
      schema_version: 'atlas.rivals.battery_selection_contract.v1' | string
      allowed_modes?: Array<{
        id: string
        label?: string | null
        description?: string | null
        requires_provider?: boolean | null
        requires_model?: boolean | null
        requires_baseline_workspace?: boolean | null
        fair_claim_eligible?: boolean | null
        max_capability_run?: boolean | null
        recommended_provider?: string | null
        recommended_model?: string | null
      }>
      provider_model_options?: Array<{
        provider: string
        label?: string | null
        allow_auto?: boolean | null
        allow_manual?: boolean | null
        models?: Array<{
          model: string
          label?: string | null
          role?: string | null
          tier?: string | null
        }>
      }>
      ui_must_send_mode?: boolean | null
      ui_must_send_provider_and_model_for_modes?: string[]
      ui_may_leave_provider_or_model_empty_for_modes?: string[]
    }
    execution_intent: Record<string, unknown>
    corpus: Record<string, unknown>
    safety: Record<string, unknown>
    generated_at: string | null
    [key: string]: unknown
  }
}

export interface AtlasStructureMotherAuditAction {
  id: string
  module_id?: string | null
  type: string
  status: string
  operator_required?: boolean
  due_at?: string | null
  current_due_at?: string | null
  review_due_at?: string | null
  dry_run_command?: string | null
  apply_command?: string | null
  list_command?: string | null
  list_missing_command?: string | null
  record_command?: string | null
  missing_rate_count?: number | null
  critical_item_count?: number | null
  agent_auto_dispatch_allowed?: boolean | null
  external_notification_possible?: boolean | null
  diagnostics?: Record<string, unknown> | null
  item_commands?: Array<Record<string, unknown>>
  notes?: string[]
  [key: string]: unknown
}

export interface AtlasStructureMotherAuditModule {
  id: string
  label: string
  status: string
  implementation_status: string
  operational_status: string
  evidence: Record<string, unknown>
  canonical_command: string
  blockers: string[]
  operational_blockers: string[]
}

export interface AtlasStructureMotherAuditResponse {
  status: string
  structure_mother_audit: {
    schema_version: 'atlas.structure_mother_audit.v1' | string
    status: string
    complete: boolean
    implementation_complete: boolean
    hours: number
    workspace: string
    summary: {
      module_count: number
      ready_count: number
      attention_count: number
      blocked_count: number
      blocker_count: number
      operational_blocker_count: number
      qualitative_level?: string | null
      next_qualitative_level?: string | null
      next_level_blockers?: string[]
    }
    completion_gate: {
      status: string
      reason: string
      update_goal_allowed: boolean
    }
    operator_action_plan: {
      schema_version: 'atlas.structure_mother.operator_action_plan.v1' | string
      status: string
      action_count: number
      action_summary?: {
        schema_version: 'atlas.structure_mother.operator_action_summary.v1' | string
        status: string
        actionable_now_count: number
        calendar_wait_count: number
        human_review_action_count: number
        external_effect_action_count: number
        next_calendar_due_at?: string | null
        next_action_ids: string[]
        calendar_action_ids: string[]
      }
      actions: AtlasStructureMotherAuditAction[]
      rules: Record<string, unknown>
    }
    modules: AtlasStructureMotherAuditModule[]
    blockers: Array<{
      module_id: string
      module: string
      blocker: string
    }>
    generated_at: string | null
    [key: string]: unknown
  }
}

export interface AtlasMobilePushReplayInput {
  limit?: number | null
  apply?: boolean | null
  confirm_external_dispatch?: boolean | null
  reason?: string | null
}

export interface AtlasMobilePushReplayResponse {
  status: string
  push_replay: {
    schema_version: 'atlas.mobile.push_replay_pending.v1' | string
    dry_run: boolean
    limit: number
    candidate_count: number
    dispatched_count: number
    mobile_enabled: boolean
    operator_reason?: string | null
    external_dispatch_confirmed?: boolean
    items: Array<{
      id: string
      type: string
      category: string | null
      severity: string
      status: string
      dedupe_key: string | null
      push_policy_send: string
      created_at: string | null
    }>
    [key: string]: unknown
  }
}

export interface AtlasEngineeringRunReplayInput extends AtlasEngineeringBenchmarkRunInput {
  provider_replay?: boolean | null
  same_sandbox?: boolean | null
}

export interface AtlasEngineeringRunOperatorActionInput {
  action: 'cancel' | 'accept' | 'needs_human' | 'reject'
  actor?: string | null
  note?: string | null
  payload?: Record<string, unknown> | null
}

export interface AtlasEngineeringRunResponse {
  ok?: boolean
  run: AtlasEngineeringRunSummary
  operator_action?: AtlasEngineeringRunOperatorActionSummary
  contract?: Record<string, unknown>
  blueprint?: Record<string, unknown>
  context_pack?: Record<string, unknown>
  controls?: Array<Record<string, unknown>>
  harnessability?: Record<string, unknown>
  score?: Record<string, unknown>
  test_run_count?: number
}

export interface AtlasEngineeringBenchmarkDefaultSuiteInput {
  slug?: string | null
  name?: string | null
  description?: string | null
  default_runner_options?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface AtlasEngineeringBenchmarkOutcomeInput {
  status?: 'pending' | 'healthy' | 'accepted' | 'degraded' | 'incident' | 'rolled_back' | string | null
  outcome_status?: 'pending' | 'healthy' | 'accepted' | 'degraded' | 'incident' | 'rolled_back' | string | null
  score?: number | null
  outcome_score?: number | null
  summary?: string | null
  notes?: string | null
  signals?: Record<string, unknown>
  rollback_reason?: string | null
  incident_ref?: string | null
  recorded_by?: string | null
}

export interface AtlasEngineeringBenchmarkCalibrationInput {
  limit?: number | null
}

export interface AtlasEngineeringHarnessabilityCalibrationInput {
  limit?: number | null
}

export interface AtlasEngineeringHarnessabilityCalibrationResponse {
  harnessability_calibration: Record<string, unknown> | null
}

export interface AtlasEngineeringKnowledgeItemSummary {
  id: string
  slug: string
  title: string
  category: string
  status: string
  priority: number
  source_type: string
  canonical_path: string
  source_hash: string
  content_hash: string
  summary: string | null
  tags: string[]
  related_paths: string[]
  capabilities: string[]
  decisions: string[]
  maintenance: string[]
  metadata?: Record<string, unknown>
  indexed_at: string | null
  last_verified_at: string | null
  archived_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasEngineeringKnowledgeItemDetail extends AtlasEngineeringKnowledgeItemSummary {
  body_excerpt: string | null
}

export interface AtlasEngineeringKnowledgeItemResponse {
  knowledge_item: AtlasEngineeringKnowledgeItemDetail
}

export interface AtlasEngineeringKnowledgeContextRef {
  type: string
  id: string
  slug: string
  title: string
  category: string
  priority: number
  canonical_path: string
  content_hash: string
  summary: string | null
  reason: string
}

export interface AtlasEngineeringKnowledgeContextResponse {
  knowledge_refs: AtlasEngineeringKnowledgeContextRef[]
}

export interface AtlasEngineeringKnowledgeResponse {
  summary: {
    status: string
    table_exists: boolean
    docs_root: string
    docs_root_exists: boolean
    canonical_doc_count?: number
    total: number
    active: number
    archived?: number
    categories: Record<string, number>
    last_indexed_at: string | null
  }
  items: AtlasEngineeringKnowledgeItemSummary[]
}

export interface AtlasEngineeringKnowledgeSyncResponse {
  ok: boolean
  dry_run: boolean
  docs_root: string
  summary: {
    created: number
    updated: number
    unchanged: number
    archived: number
    failed: number
  }
  items: Array<Record<string, unknown>>
  generated_at: string
}

export interface AtlasEngineeringCodeSummary {
  status: string
  table_exists: boolean
  module_count: number
  symbol_count: number
  doc_link_count: number
  route_count?: number
  command_count?: number
  migration_count?: number
  test_count?: number
  docs_status?: Record<string, number>
  layers?: Record<string, number>
  last_indexed_at?: string | null
}

export interface AtlasEngineeringCodeModuleSummary {
  id: string
  slug: string
  name: string
  layer: string
  root_path: string | null
  primary_language: string | null
  status: string
  owner: string | null
  description: string | null
  docs_status: string
  file_count: number
  symbol_count: number
  route_count: number
  command_count: number
  migration_count: number
  test_count: number
  source_hash: string
  docs_hash: string | null
  tags: string[]
  related_docs: string[]
  related_tests: string[]
  metadata: Record<string, unknown>
  indexed_at: string | null
  archived_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface AtlasEngineeringCodeSymbolSummary {
  id: string
  module_id: string | null
  module_slug: string | null
  symbol_type: string
  symbol_name: string
  file_path: string
  line_start: number | null
  line_end: number | null
  language: string | null
  signature: string | null
  namespace: string | null
  parent_symbol: string | null
  visibility: string | null
  status: string
  docs_status: string
  source_hash: string
  related_doc_ids: string[]
  metadata: Record<string, unknown>
  indexed_at: string | null
}

export interface AtlasEngineeringDocLinkSummary {
  id: string
  knowledge_item_id: string | null
  module_id: string | null
  symbol_id: string | null
  link_type: string
  status: string
  canonical_path: string
  target_path: string | null
  doc_hash: string | null
  target_hash: string | null
  metadata: Record<string, unknown>
  indexed_at: string | null
}

export interface AtlasEngineeringCodeModulesResponse {
  summary: AtlasEngineeringCodeSummary
  modules: AtlasEngineeringCodeModuleSummary[]
}

export interface AtlasEngineeringCodeSymbolsResponse {
  summary: AtlasEngineeringCodeSummary
  symbols: AtlasEngineeringCodeSymbolSummary[]
}

export interface AtlasEngineeringCodeModuleResponse {
  module: AtlasEngineeringCodeModuleSummary
  symbols: AtlasEngineeringCodeSymbolSummary[]
  doc_links: AtlasEngineeringDocLinkSummary[]
}

export interface AtlasEngineeringCodeIndexResponse {
  ok: boolean
  dry_run: boolean
  workspace: string
  summary: {
    module_count: number
    symbol_count: number
    doc_link_count: number
    route_count: number
    command_count: number
    migration_count: number
    test_count: number
    file_count: number
  }
  modules?: AtlasEngineeringCodeModuleSummary[]
  symbols_preview?: AtlasEngineeringCodeSymbolSummary[]
  symbol_count?: number
  generated_at: string
}

export interface AtlasEngineeringCodeAuditModuleCounts {
  missing_in_index: number
  removed_from_workspace: number
  changed: number
}

export interface AtlasEngineeringCodeAuditSymbolCounts {
  added: number
  removed: number
}

export interface AtlasEngineeringCodeAuditDocLinkCounts {
  current: number
  persisted_missing_target_status: number
  missing_targets: number
  stale_target_hashes: number
}

export interface AtlasEngineeringCodeAuditSummary {
  scanned: {
    module_count?: number
    symbol_count?: number
    doc_link_count?: number
    route_count?: number
    command_count?: number
    migration_count?: number
    test_count?: number
    file_count?: number
    [key: string]: unknown
  }
  persisted: AtlasEngineeringCodeSummary
  drift: {
    total: number
    modules: AtlasEngineeringCodeAuditModuleCounts
    symbols: AtlasEngineeringCodeAuditSymbolCounts
    doc_links: AtlasEngineeringCodeAuditDocLinkCounts
  }
}

export interface AtlasEngineeringCodeAuditResponse {
  ok: boolean
  dry_run: boolean
  writes: boolean
  status: 'fresh' | 'drift_detected' | 'empty_index' | string
  workspace: string
  summary: AtlasEngineeringCodeAuditSummary
  drift: {
    modules: {
      counts: AtlasEngineeringCodeAuditModuleCounts
      missing_in_index: Array<Record<string, unknown>>
      removed_from_workspace: Array<Record<string, unknown>>
      changed: Array<Record<string, unknown>>
    }
    symbols: {
      counts: AtlasEngineeringCodeAuditSymbolCounts
      by_type: {
        added: Record<string, number>
        removed: Record<string, number>
      }
      added: Array<Record<string, unknown>>
      removed: Array<Record<string, unknown>>
    }
    doc_links: {
      counts: AtlasEngineeringCodeAuditDocLinkCounts
      missing_targets: Array<Record<string, unknown>>
      stale_target_hashes: Array<Record<string, unknown>>
    }
  }
  generated_at: string
}

export interface AtlasEngineeringBenchmarkTrendSeries {
  benchmark_key: string
  provider: string | null
  model: string | null
  mode: string | null
  case_set_hash: string | null
  latest_status: string | null
  latest_trend_status: string | null
  run_count: number
  runs: AtlasEngineeringBenchmarkRunSummary[]
}

export interface AtlasEngineeringBenchmarkTrendsResponse {
  suite: {
    id: string
    slug: string
    name: string
  }
  runs: AtlasEngineeringBenchmarkRunSummary[]
  series: AtlasEngineeringBenchmarkTrendSeries[]
}

export interface AtlasEngineeringFairClaudeScorecard {
  enabled: boolean
  case_count: number
  protocol_validity_rate: number | null
  pass_without_human_rate: number | null
  pass_without_human_rate_medium_hard: number | null
  repair_conversion_rate: number | null
  final_gate_pass_rate: number | null
  intervention_reduction: number | null
  autonomous_success_lift: number | null
  time_to_green: unknown
  cost_per_green_case: unknown
  invalid_case_count: number
  provider_violation_count: number
  fallback_violation_count: number
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeCaseComparison {
  schema_version: number
  result_id: string
  benchmark_run_id: string
  case_id: string
  case_code: string | null
  title: string | null
  domain_slug: string | null
  risk_profile: string | null
  corpus_tier: string | null
  status: string
  passed: boolean
  decision: string | null
  score: number | null
  comparison_status: string
  comparable: boolean
  winner: 'atlas' | 'claude_code_baseline' | 'tie' | string | null
  winner_reason: string | null
  blocking_reasons: string[]
  atlas: {
    verified: boolean
    passed: boolean
    pass_without_human: boolean
    score: number | null
    duration_ms: number | null
    attempt_count: number | null
    repair_attempt_count: number | null
    repair_used: boolean
    converted_to_green: boolean
    provider_violation_count: number
    fallback_violation_count: number
    human_intervention_count: number
    [key: string]: unknown
  }
  claude_code_baseline: {
    verified: boolean
    passed: boolean
    pass_without_human: boolean
    score: number | null
    duration_ms: number | null
    human_intervention_count: number
    [key: string]: unknown
  }
  deltas: {
    score: number | null
    duration_ms: number | null
    human_intervention_count: number | null
    [key: string]: unknown
  }
  failure_summary: string | null
  created_at: string | null
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeNextAction {
  id: string
  severity: 'critical' | 'warning' | 'info' | string
  title: string
  detail: string
  command: string | null
  owner: string | null
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeExecutiveSummary {
  claim_status: string
  headline: string
  ready_for_claim: boolean
  winner: 'atlas' | 'claude_code_baseline' | 'tie' | string | null
  confidence: string
  sample: Record<string, unknown>
  quality_bar: Record<string, unknown>
  auditability: Record<string, unknown>
  top_risks: string[]
  baseline_win_cases: string[]
  blocked_cases: string[]
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeEvidencePacket {
  schema_version: number
  kind: 'fair_claude_claim_evidence_packet' | string
  generated_at: string | null
  evidence_hash: string
  suite: Record<string, unknown>
  protocol: Record<string, unknown>
  claim: Record<string, unknown>
  scorecard: Record<string, unknown>
  audit: Record<string, unknown>
  case_outcomes: Array<Record<string, unknown>>
  next_action_ids: string[]
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeBatteryExecutionContract {
  schema_version: 'atlas.fair_claude.battery_execution_contract.v1' | string
  status: string
  summary: string
  operator_required: boolean
  agent_auto_execution_allowed: boolean
  provider_dispatch_required: boolean
  external_cost_possible: boolean
  synthetic_scores_allowed: boolean
  current_state: {
    corpus_prepared: boolean
    release_corpus_case_count: number
    minimum_release_corpus_case_count: number
    paired_case_count: number
    comparable_case_count: number
    baseline_executed: boolean
    replay_verified: boolean
    ready_for_claim: boolean
    [key: string]: unknown
  }
  start_requirements: string[]
  commands: Record<string, string>
  recommended_presets: Array<{
    id: string
    case_count: number | null
    estimated_time: string
    purpose: string
    [key: string]: unknown
  }>
  safety: Record<string, unknown>
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeExportBundle {
  schema_version: number
  kind: 'fair_claude_export_bundle' | string
  recommended_directory: string
  verification_command?: string
  evidence_hash: string | null
  bundle_hash: string
  files: Record<string, {
    kind: string
    content_type: string
    bytes: number
    sha256: string
    [key: string]: unknown
  }>
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeRunHistorySummary {
  schema_version: number
  health_status: string
  winner: 'atlas' | 'claude_code_baseline' | 'tie' | string | null
  blocking_reasons: string[]
  atlas_win_count: number
  claude_code_baseline_win_count: number
  tie_count: number
  comparable_count: number
  protocol_validity_rate: number | null
  pass_without_human_rate: number | null
  pass_without_human_rate_medium_hard: number | null
  final_gate_pass_rate: number | null
  repair_conversion_rate: number | null
  baseline_executed_count: number
  replay_packet_count: number
  replay_integrity_failed_count: number
  [key: string]: unknown
}

export interface AtlasEngineeringFairClaudeRunSummary extends AtlasEngineeringBenchmarkRunSummary {
  fair_report_scope?: 'official_fair_claude' | 'paired_non_fair' | string
  history_summary?: AtlasEngineeringFairClaudeRunHistorySummary
  paired_scorecard?: AtlasEngineeringFairClaudeScorecard | Record<string, unknown> | null
  claude_code_baseline?: Record<string, unknown> | null
  replay_manifest?: Record<string, unknown> | null
}

export interface AtlasEngineeringFairClaudeReportResponse {
  schema_version: number
  kind: 'fair_claude_benchmark_report' | string
  generated_at: string | null
  suite: {
    id: string
    slug: string
    name: string
  }
  limit: number
  scan_limit: number
  scanned_run_count: number
  run_count: number
  result_count: number
  scope: {
    paired_run_count: number
    fair_run_count: number
    paired_result_count: number
    fair_result_count: number
    non_fair_paired_result_count: number
    [key: string]: unknown
  }
  readiness: {
    status: string
    ready_for_claim: boolean
    blocking_reasons: string[]
    atlas_win_count: number
    claude_code_baseline_win_count: number
    tie_count: number
    comparable_count: number
    fair_mode_count: number
    active_corpus_case_count: number
    release_corpus_case_count: number
    minimum_release_corpus_case_count: number
    [key: string]: unknown
  }
  executive_summary?: AtlasEngineeringFairClaudeExecutiveSummary
  battery_execution_contract?: AtlasEngineeringFairClaudeBatteryExecutionContract
  corpus_manifest?: Record<string, unknown> | null
  next_actions?: AtlasEngineeringFairClaudeNextAction[]
  evidence_packet?: AtlasEngineeringFairClaudeEvidencePacket
  claim_markdown?: string
  export_bundle?: AtlasEngineeringFairClaudeExportBundle
  paired_scorecard: AtlasEngineeringFairClaudeScorecard
  all_paired_scorecard?: AtlasEngineeringFairClaudeScorecard | null
  claude_code_baseline: {
    enabled: boolean
    case_count: number
    [key: string]: unknown
  }
  replay_manifest: {
    enabled: boolean
    run_count: number
    packet_count: number
    artifact_integrity_passed_count: number
    artifact_integrity_failed_count: number
    [key: string]: unknown
  }
  case_comparisons?: AtlasEngineeringFairClaudeCaseComparison[]
  runs: AtlasEngineeringFairClaudeRunSummary[]
}

export interface AtlasEngineeringDecision {
  status: string
  auto_complete_allowed: boolean
  reason: string
}

export interface AtlasEngineeringAcceptanceStatusItem extends AtlasEngineeringAcceptanceItem {
  evidence?: string
}

export interface AtlasEngineeringStatusSnapshot {
  snapshot_version: number
  generated_at: string
  task_id: string
  contract_goal: string
  blueprint_id: string
  decision: AtlasEngineeringDecision
  acceptance_checklist: AtlasEngineeringAcceptanceStatusItem[]
  review_gates: AtlasEngineeringReviewGate[]
  evidence_summary: {
    total: number
    latest: AtlasEngineeringEvidence | null
    passed: number
    failed: number
    needs_review: number
  }
}

export interface AtlasEngineeringBlueprintSnapshot {
  id: string
  task_id: string
  project_id: string | null
  project_step_id: string | null
  status: string
  version: number
  source: string
  content_hash: string
  frozen_at: string | null
  created_at: string | null
  updated_at: string | null
  matches_current_content: boolean
}

export interface AtlasEngineeringPackageResponse {
  task_id: string
  contract: AtlasEngineeringTaskContract
  blueprint: AtlasEngineeringBlueprint
  blueprint_snapshot: AtlasEngineeringBlueprintSnapshot | null
  status_snapshot: AtlasEngineeringStatusSnapshot
  latest_run: AtlasEngineeringRunSummary | null
  run_history: AtlasEngineeringRunSummary[]
  latest_harness_run?: AtlasEngineeringRunSummary | null
  harness_runs?: AtlasEngineeringRunSummary[]
  benchmark_cases?: AtlasEngineeringBenchmarkCaseSummary[]
  benchmark_results?: AtlasEngineeringBenchmarkResultSummary[]
  latest_evidence: AtlasEngineeringEvidence | null
  evidence_history: AtlasEngineeringEvidence[]
  events: AtlasTaskEvent[]
}

export interface AtlasEngineeringEvidenceInput {
  evidence_type: AtlasEngineeringEvidenceType
  target_id?: string | null
  status: AtlasEngineeringEvidenceStatus
  confidence?: number | null
  summary: string
  trace_id?: string | null
  command?: string | null
  artifact_url?: string | null
  output_excerpt?: string | null
  files?: string[]
  metadata?: Record<string, unknown>
}

export interface AtlasEngineeringEvidenceResponse {
  task_id: string
  evidence: AtlasEngineeringEvidence
  contract: AtlasEngineeringTaskContract
  blueprint: AtlasEngineeringBlueprint
  blueprint_snapshot: AtlasEngineeringBlueprintSnapshot | null
  status_snapshot: AtlasEngineeringStatusSnapshot
  latest_run: AtlasEngineeringRunSummary | null
  evidence_history: AtlasEngineeringEvidence[]
}

export interface AtlasEngineeringProjectBlueprintRecord {
  id: string
  project_id: string
  status: 'draft' | 'frozen' | 'superseded' | 'archived' | string
  version: number
  source: string
  created_by: string
  content_hash: string
  matches_current_content: boolean
  stale: boolean
  validation: Record<string, unknown>
  human_exception: Record<string, unknown>
  prepared_at: string | null
  frozen_at: string | null
  superseded_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface AtlasEngineeringProjectBlueprintResponse {
  project_id: string
  latest?: AtlasEngineeringProjectBlueprintRecord | null
  frozen?: AtlasEngineeringProjectBlueprintRecord | null
  record?: AtlasEngineeringProjectBlueprintRecord | null
  blueprint?: Record<string, unknown> | null
  content_hash?: string
  validation?: Record<string, unknown>
  missing_fields?: string[]
  suggested_questions?: string[]
}

export interface AtlasEngineeringProjectTasksGenerateResponse {
  project_id: string
  project_blueprint_id: string
  project_blueprint_version: number
  created_count: number
  updated_count: number
  skipped_count: number
  created: Array<Record<string, unknown>>
  updated: Array<Record<string, unknown>>
  skipped: Array<Record<string, unknown>>
}

export interface AtlasEngineeringQaInput {
  target_id?: string | null
  status: AtlasEngineeringEvidenceStatus
  confidence?: number | null
  summary?: string
  steps: string[]
  expected_result: string
  actual_result: string
  screenshot_url?: string | null
  artifact_url?: string | null
  console_output?: string | null
  network_output?: string | null
  risk_notes?: string | null
  visual_required?: boolean
  files?: string[]
}

export interface AtlasEngineeringGateResponse {
  task_id: string
  blocking?: boolean
  evidence?: AtlasEngineeringEvidence
  qa?: AtlasEngineeringEvidence
  status?: string
  checks?: Record<string, string>
  findings?: Array<Record<string, unknown>>
  summary?: Record<string, unknown>
  recorded_findings?: Array<Record<string, unknown>>
}

export interface AtlasToolDefinitionSummary {
  id?: string
  slug: string
  name: string
  type: string
  category: string
  risk_level: string
  status: string
  cost_posture: string
  execution_tier?: 'T0' | 'T1' | 'T2' | 'T3' | string
  expected_cost?: string | null
  default_trigger?: string | null
  authority_role?: string | null
  authority_group?: string | null
  capabilities_json?: string[]
  capabilities?: string[]
  risks_json?: string[]
  risks?: string[]
  default_failure_policy?: string
  default_timeout_seconds?: number
  created_at?: string | null
  updated_at?: string | null
}

export interface AtlasToolDoctorItem {
  slug: string
  name: string
  type: string
  category: string
  capabilities: string[]
  risks: string[]
  risk_level: string
  cost_posture: string
  execution_tier?: 'T0' | 'T1' | 'T2' | 'T3' | string
  expected_cost?: string | null
  default_trigger?: string | null
  authority_role?: string | null
  authority_group?: string | null
  status: 'ready' | 'missing' | 'disabled' | 'skipped' | 'failed' | 'timeout' | string
  execution_layer: string
  binary: string
  binary_path_hash: string | null
  version: string | null
  install_hint: string | null
  safe_commands?: AtlasToolSafeCommand[]
}

export interface AtlasToolSafeCommand {
  name: string
  category: string
  description: string
  command: string[]
  dry_run_default: boolean
  recommended_surface: string
  creates_evidence: boolean
  blocking_capable: boolean
  network_allowed: boolean
  max_execution_tier?: 'T0' | 'T1' | 'T2' | 'T3' | string | null
  sandbox_mode?: 'workspace' | 'worktree' | 'docker' | 'host' | 'none' | string | null
  privacy_level?: 'standard' | 'sensitive' | 'restricted' | string | null
  task_type?: string | null
  requires_provider_safe?: boolean
}

export interface AtlasToolsDoctorResponse {
  status: string
  workspace_hash: string
  tool_count: number
  tools: AtlasToolDoctorItem[]
}

export interface AtlasToolCommandsResponse {
  tool: AtlasToolDoctorItem
  commands: AtlasToolSafeCommand[]
}

export interface AtlasToolAuthorityTool {
  slug: string
  name: string
  execution_tier: 'T0' | 'T1' | 'T2' | 'T3' | string
  expected_cost: string
  default_trigger: string
  authority_role: string
  risk_level: string
  status: string
}

export interface AtlasToolAuthorityGroup {
  authority_group: string
  tool_count: number
  tier_span: string[]
  primary_tools: AtlasToolAuthorityTool[]
  complementary_tools: AtlasToolAuthorityTool[]
  fallback_tools: AtlasToolAuthorityTool[]
  executor_tools: AtlasToolAuthorityTool[]
  high_risk_tools: AtlasToolAuthorityTool[]
  release_heavy_tools: AtlasToolAuthorityTool[]
  missing_primary: boolean
  duplicate_primary: boolean
}

export interface AtlasToolAuthorityRecommendation {
  code: string
  severity: 'low' | 'medium' | 'high' | string
  authority_group: string
  message: string
}

export interface AtlasToolsAuthorityResponse {
  status: string
  generated_at: string
  summary: {
    tool_count: number
    authority_group_count: number
    primary_count: number
    complementary_count: number
    fallback_count: number
    executor_count: number
    high_risk_count: number
    t0_count: number
    t1_count: number
    t2_count: number
    t3_count: number
  }
  tiers: Record<string, { tool_count: number; tools: AtlasToolAuthorityTool[] }>
  authority_groups: AtlasToolAuthorityGroup[]
  recommendations: AtlasToolAuthorityRecommendation[]
}

export interface AtlasToolAuthorityPolicy {
  authority_group: string
  policy: string
  block_severities: string[]
  warn_severities: string[]
  block_reason: string
  warn_reason: string
  description: string
  source?: 'default' | 'workspace' | 'global' | string
  policy_id?: string | null
}

export interface AtlasToolsAuthorityPoliciesResponse {
  status: string
  schema: string
  summary: {
    policy_count: number
    blocking_policy_count: number
    warning_policy_count: number
  }
  policies: AtlasToolAuthorityPolicy[]
}

export interface AtlasToolAuthorityPolicyInput {
  workspace?: string | null
  scope_type?: 'workspace' | 'global' | string
  policy?: string | null
  block_severities?: string[]
  warn_severities?: string[]
  block_reason?: string | null
  warn_reason?: string | null
  description?: string | null
}

export interface AtlasToolAuthorityPolicyMutationResponse {
  status: string
  data: AtlasToolPolicySummary | null
  catalog: AtlasToolsAuthorityPoliciesResponse
}

export interface AtlasToolArtifactSummary {
  id: string
  tool_run_id: string
  type: string
  path: string
  filename: string
  mime_type: string | null
  size_bytes: number
  sha256: string
  is_redacted: boolean
  preview_json: Record<string, unknown>
  created_at: string | null
  updated_at?: string | null
}

export interface AtlasToolFindingSummary {
  id: string
  tool_run_id: string
  rule_id: string | null
  title: string
  message: string | null
  severity: string
  confidence: number | null
  file_path: string | null
  line: number | null
  end_line: number | null
  fingerprint: string | null
  blocks_resolved: boolean
  waiver_id: string | null
  status: string
  metadata_json: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
}

export interface AtlasToolRunSummary {
  id: string
  tool_definition_id: string | null
  tool_slug: string
  surface: string
  workspace_hash: string | null
  workspace: string | null
  run_context_type: string | null
  run_context_id: string | null
  status: string
  required: boolean
  failure_policy: string
  policy_decision: string
  command_hash: string | null
  exit_code: number | null
  started_at: string | null
  finished_at: string | null
  duration_ms: number
  summary_json: Record<string, unknown>
  normalized_result_json: Record<string, unknown>
  policy_decision_json: Record<string, unknown>
  metadata_json: Record<string, unknown>
  created_at: string | null
  updated_at: string | null
  tool?: AtlasToolDefinitionSummary | null
  artifacts?: AtlasToolArtifactSummary[]
  findings?: AtlasToolFindingSummary[]
}

export interface AtlasToolsIndexResponse {
  data: AtlasToolDefinitionSummary[]
}

export interface AtlasToolsEvidenceResponse {
  data: AtlasToolRunSummary[]
}

export interface AtlasToolsEvidenceFilters extends Record<string, unknown> {
  workspace?: string | null
  tool_slug?: string
  tool?: string
  surface?: string
  status?: string
  policy_decision?: string
  run_context_type?: string
  run_context_id?: string
  recipe?: string
  recipe_category?: string
  recipe_recommended_surface?: string
  recipe_blocking_capable?: boolean
  required?: boolean
  limit?: number
}

export interface AtlasToolRunInput {
  workspace?: string | null
  command: string[]
  dry_run?: boolean
  approved?: boolean
  required?: boolean
  network_allowed?: boolean
  max_execution_tier?: 'T0' | 'T1' | 'T2' | 'T3' | string
  sandbox_mode?: 'workspace' | 'worktree' | 'docker' | 'host' | 'none' | string
  privacy_level?: 'standard' | 'sensitive' | 'restricted' | string
  task_type?: string
  requires_provider_safe?: boolean
  env?: Record<string, string> | string[]
  output_limit?: number
}

export interface AtlasToolRunRecipeInput {
  workspace?: string | null
  dry_run?: boolean
  approved?: boolean
  required?: boolean
  env?: Record<string, string> | string[]
  output_limit?: number
}

export interface AtlasToolRunResponse {
  data: AtlasToolRunSummary
}

export interface AtlasToolPolicySummary {
  id: string
  scope_type: 'workspace' | 'global' | string
  scope_id: string | null
  tool_slug: string
  enabled: boolean
  required_when_json: Record<string, unknown> | null
  failure_policy: string | null
  timeout_seconds: number | null
  thresholds_json: Record<string, unknown> | null
  metadata: {
    approved?: boolean
    approved_at?: string
    approved_until?: string
    approved_by?: string
    approval_reason?: string
    network_allowed?: boolean
    max_execution_tier?: string
    sandbox_mode?: string
    privacy_level?: string
    task_type?: string
    requires_provider_safe?: boolean
    workspace_hash?: string
    ttl_hours?: number
    approval_source?: string
    revoked_at?: string
    revocation_source?: string
    [key: string]: unknown
  } | null
  created_at: string | null
  updated_at: string | null
  approval_status?: string
}

export interface AtlasToolsPoliciesResponse {
  data: AtlasToolPolicySummary[]
}

export interface AtlasToolApprovalInput {
  workspace?: string | null
  scope_type?: 'workspace' | 'global' | string
  reason?: string | null
  ttl_hours?: number
  network_allowed?: boolean
  max_execution_tier?: 'T0' | 'T1' | 'T2' | 'T3' | string
  sandbox_mode?: 'workspace' | 'worktree' | 'docker' | 'host' | 'none' | string
  privacy_level?: 'standard' | 'sensitive' | 'restricted' | string
  task_type?: string
  requires_provider_safe?: boolean
}

export interface AtlasToolApprovalResponse {
  data: AtlasToolPolicySummary | null
  approval_status: string
}

export interface AtlasToolsGateResponse {
  status: 'passed' | 'warning' | 'blocked' | string
  allowed: boolean
  filters: Record<string, unknown>
  required_tools: string[]
  fail_statuses: string[]
  summary: {
    run_count: number
    input_run_count?: number
    tool_count: number
    failed_run_count: number
    blocking_failure_count: number
    warning_count: number
    stale_evidence_count?: number
    correlated_finding_group_count?: number
    suppressed_duplicate_finding_count?: number
  }
  freshness?: {
    max_age_minutes: number | null
    stale_blocks: boolean
  }
  selection?: {
    latest_per_tool: boolean
  }
  blocking_failures: Array<Record<string, unknown>>
  warnings: Array<Record<string, unknown>>
  finding_correlations?: Array<Record<string, unknown>>
  runs: Array<Record<string, unknown>>
}

export interface AtlasToolsGateFilters extends AtlasToolsEvidenceFilters {
  required_tool?: string[]
  fail_status?: string[]
  require_evidence?: boolean
  max_age_minutes?: number
  stale_blocks?: boolean
  latest_per_tool?: boolean
}

export interface AtlasEngineeringApiContractInput {
  workspace: string
  spec?: string | null
  strict?: boolean | null
  run_context_type?: string | null
  run_context_id?: string | null
}

export interface AtlasEngineeringApiContractResponse {
  status: string
  workspace_hash: string
  artifact_root: string
  artifact_root_hash: string
  spec_path: string | null
  strict: boolean
  summary: {
    spec_detected: boolean
    route_count: number
    documented_path_count: number
    finding_count: number
    blocking_finding_count: number
    severity_counts?: Record<string, number>
  }
  findings: Array<Record<string, unknown>>
  metrics: Record<string, unknown>
  recommendations: Array<Record<string, unknown>>
  duration_ms: number
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

export interface ProjectBlockersResponse {
  blockers: AtlasProjectBlocker[]
  summary: {
    open_count: number
    resolved_count: number
    cancelled_count: number
  }
  generated_at: string
}

export interface ProjectBlockerMutationResponse {
  project: AtlasProject
  blocker: AtlasProjectBlocker
  unblock_task: AtlasTask | null
  health: NonNullable<AtlasProject['execution_health']>
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

export type AtlasAiProvider = 'hermes_cli' | 'minimax_m27_cli' | 'claude_cli' | 'codex_cli' | 'gemini_cli' | 'claude_codex'
export type AtlasAiStatus = 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'awaiting_user_choice'

export type AtlasAiChoiceAction = 'switch_provider' | 'downgrade_model' | 'wait' | 'fail' | 'cancel' | 'retry_same'

export interface AtlasAiExecutionState {
  strategy?: string | null
  activation_status?: string | null
  blocked_reason?: string | null
  atlas_decide_stage?: string | null
  dependency_state?: string | null
  dependency_job_id?: string | null
  dependent_job_id?: string | null
  dependency_provider?: AtlasAiProvider | string | null
  dependency_model?: string | null
  dependency_timeout_seconds?: number | null
  [key: string]: unknown
}

export interface AtlasAiChoiceOption {
  id: string
  label: string
  description?: string
  action: AtlasAiChoiceAction
  provider?: string
  model?: string | null
  available_at_iso?: string
  cli_command?: string
  reason?: string
}

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
  atlas_decide_execution?: AtlasAiExecutionState
  atlas_decide_stage?: string | null
  dependency_state?: string | null
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
  awaiting_user_choice?: boolean
  choice_options?: AtlasAiChoiceOption[]
  provider_choice_state?: 'pending' | 'resolved' | null
  provider_choice_error_code?: string | null
  provider_reset_at?: string | null
  reset_hint?: string | null
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
  atlas_decide_execution?: AtlasAiExecutionState
  attachments?: AtlasAiAttachment[]
  thread?: AtlasAiThread
  session?: AtlasAiSession
  job?: AtlasAiJob
  jobs?: AtlasAiJob[]
  router_decision?: AtlasAiRouterDecision | null
  atlas_decision?: AtlasAiDecision | null
  decision_receipt?: AtlasAiDecisionReceipt | null
  quality_evaluation?: AtlasAiQualityEvaluation | null
  quality_actions?: AtlasAiQualityAction[]
  created_at: string
  updated_at: string
}

export interface AtlasAiRouterDecision {
  id: string
  mode: string
  selected_provider: AtlasAiProvider | string | null
  fallback_provider: AtlasAiProvider | string | null
  signals: Record<string, unknown>
  reason: string
  was_overridden: boolean
  created_at: string | null
  updated_at: string | null
}

export interface AtlasAiDecisionReceipt {
  decision_id?: string
  trace_id?: string
  schema_version?: number
  decision_mode?: 'atlas_decide' | 'manual_override' | string
  candidate_provider?: AtlasAiProvider | string | null
  selected_provider?: AtlasAiProvider | string | null
  selected_model?: string | null
  fallback_provider?: AtlasAiProvider | string | null
  fallback_reason?: string | null
  operator_requested_provider?: AtlasAiProvider | 'auto' | string | null
  requested_provider?: AtlasAiProvider | string | null
  was_overridden?: boolean
  reason?: string
  signals?: Record<string, unknown>
  candidates?: Array<Record<string, unknown>>
  constraints?: Record<string, unknown>
  metrics_snapshot?: Record<string, unknown>
  task_profile?: Record<string, unknown>
  context_strategy?: string | null
  execution_strategy?: string | null
  execution_graph?: Record<string, unknown>
}

export interface AtlasAiDecision {
  id: string
  trace_id: string | null
  router_decision_id: string | null
  policy_version: string
  decision_mode: 'atlas_decide' | 'manual_override' | string
  route_mode: string | null
  task_type: string | null
  risk_level: string | null
  context_strategy: string | null
  execution_strategy: string | null
  selected_provider: AtlasAiProvider | string | null
  selected_model: string | null
  fallback_provider: AtlasAiProvider | string | null
  operator_requested_provider: AtlasAiProvider | 'auto' | string | null
  requested_provider: AtlasAiProvider | string | null
  was_overridden: boolean
  confidence_score: number | null
  signals: Record<string, unknown>
  candidates: Array<Record<string, unknown>>
  constraints: Record<string, unknown>
  metrics_snapshot: Record<string, unknown>
  task_profile: Record<string, unknown>
  execution_graph: Record<string, unknown>
  reason: string
  created_at: string | null
  updated_at: string | null
}

export interface AtlasAiAttachment {
  id: string
  kind: 'image' | 'file' | string
  name: string
  mime_type: string | null
  bytes: number | null
  sha256?: string | null
  source?: string | null
  text_available?: boolean
  text_truncated?: boolean
  pdf_page_count?: number | null
  pdf_processing_status?: string | null
  pdf_chunk_count?: number | null
  pdf_render_status?: string | null
  pdf_rendered_page_count?: number | null
  pdf_ocr_status?: string | null
  pdf_visual_understanding_status?: string | null
  office_processing_status?: string | null
  office_render_status?: string | null
  office_rendered_page_count?: number | null
  content_url?: string | null
  preview_pages?: Array<{
    page: number
    url: string
  }>
}

export interface AtlasAiAttachmentSearchResult {
  id: string
  trace_id: string | null
  thread_id: string | null
  attachment_id: string
  attachment_kind: string
  source_name: string | null
  mime_type: string | null
  unit_type: string
  unit_number: number | null
  title: string | null
  excerpt: string
  visual_caption: string | null
  metadata: Record<string, unknown> | null
  indexed_at: string | null
  score?: number | null
}

export interface AtlasAiAttachmentSearchResponse {
  results: AtlasAiAttachmentSearchResult[]
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
  id: string | null
  provider: AtlasAiProvider | string
  provider_label?: string | null
  enabled?: boolean
  model?: string | null
  model_label?: string | null
  model_tier?: string | null
  model_source?: string | null
  model_alias?: string | null
  model_selection?: 'auto' | 'fixed' | string | null
  default_model_alias?: string | null
  model_catalog?: AtlasAiProviderModelCatalogItem[]
  allow_auto?: boolean
  allow_manual?: boolean
  fallback_model?: string | null
  fallback_model_label?: string | null
  premium_model?: string | null
  premium_model_label?: string | null
  status: 'online' | 'degraded' | 'offline' | 'unknown'
  checked_at: string | null
  last_success_at: string | null
  last_failure_at: string | null
  total_jobs_24h: number
  failed_jobs_24h: number
  p50_latency_ms: number | null
  operational_pain_score: number
  message: string | null
  metadata: Record<string, unknown>
  created_at: string | null
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
  occurred_at: string | null
  created_at: string | null
}

export interface AtlasAiQueueByProvider {
  provider: AtlasAiProvider | string | null
  queued: number
  processing: number
  awaiting_user_choice?: number
  failed: number
}

export interface AtlasAiQueueStatus {
  queued: number
  processing: number
  awaiting_user_choice?: number
  failed: number
  by_provider?: AtlasAiQueueByProvider[]
}

export interface AtlasAiWorkerStatus {
  provider: AtlasAiProvider | string
  status: 'running' | 'stale' | 'stopped' | 'unknown' | string
  worker_id: string | null
  event_type: string | null
  severity: string | null
  message: string | null
  occurred_at: string | null
  age_seconds: number | null
}

export interface AtlasAiProviderUsage {
  provider: AtlasAiProvider | string
  model?: string | null
  traces: number
  failed_traces: number
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
  estimated_tokens: number
  visible_tokens: number
  cost_microusd: number
  cost_usd_estimate: number
  unknown_cost_count: number
  last_computed_at: string | null
}

export interface AtlasAiBudgetUsage {
  visible_tokens: number
  total_tokens: number
  estimated_tokens: number
  traces: number
  max_visible_tokens: number | null
  warn_visible_tokens: number | null
  remaining_visible_tokens: number | null
  status: 'ok' | 'warning' | 'blocked' | string
}

export interface AtlasAiProviderBudget extends AtlasAiBudgetUsage {
  provider: AtlasAiProvider | string
}

export interface AtlasAiBudgetStatus {
  available: boolean
  enabled: boolean
  mode: 'monitor' | 'block' | string
  window_hours: number
  totals: AtlasAiBudgetUsage
  providers: AtlasAiProviderBudget[]
}

export interface AtlasAiUsageWindow {
  available: boolean
  window_hours: number
  since: string | null
  by_provider: AtlasAiProviderUsage[]
  by_model?: AtlasAiProviderUsage[]
  totals: AtlasAiProviderUsage | null
}

export interface AtlasAiActiveJob {
  id: string
  trace_id: string | null
  kind?: string | null
  priority?: number | null
  provider: AtlasAiProvider | string | null
  model: string | null
  model_label?: string | null
  model_tier?: string | null
  model_source?: string | null
  atlas_decide_execution?: AtlasAiExecutionState
  atlas_decide_stage?: string | null
  atlas_decide_strategy?: string | null
  dependency_state?: string | null
  dependency_job_id?: string | null
  dependent_job_id?: string | null
  dependency_provider?: AtlasAiProvider | string | null
  dependency_model?: string | null
  dependency_deadline_at?: string | null
  status: string
  attempts: number
  worker_id: string | null
  available_at: string | null
  started_at: string | null
  updated_at: string | null
}

export interface AtlasAiProviderModelPolicy {
  provider: AtlasAiProvider | string
  provider_label?: string | null
  enabled?: boolean
  model: string | null
  model_label: string | null
  model_tier: string | null
  model_source: string | null
  model_alias?: string | null
  model_selection?: 'auto' | 'fixed' | string | null
  default_model_alias?: string | null
  model_catalog?: AtlasAiProviderModelCatalogItem[]
  allow_auto: boolean
  allow_manual: boolean
  fallback_model?: string | null
  fallback_model_label?: string | null
  premium_model?: string | null
  premium_model_label?: string | null
}

export interface AtlasAiProviderModelCatalogItem {
  key: string
  alias?: string | null
  model?: string | null
  label: string
  tier?: string | null
  description?: string | null
}

export interface AtlasAiModelPolicy {
  source?: string
  updated_at?: string | null
  default_tier: string
  council_allow_auto: boolean
  providers: AtlasAiProviderModelPolicy[]
}

export interface AtlasAiDomainProfile {
  id: string
  label: string
  status: string
  default_flow?: string | null
  orchestrator?: string | null
  runtime_family?: string | null
  description?: string | null
  autonomy_default?: string | null
  background_allowed?: boolean
  model_policy?: Record<string, unknown>
  context_policy?: Record<string, unknown>
  skill_policy?: Record<string, unknown>
  tool_policy?: Record<string, unknown>
  memory_policy?: Record<string, unknown>
  gate_policy?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface AtlasAiFlowProfile {
  id: string
  domain_id: string
  label: string
  status: string
  orchestrator?: string | null
  runtime?: string | null
  description?: string | null
  autonomy?: string | null
  background_allowed?: boolean
  requires_human_approval_for_destructive?: boolean
  model_policy?: Record<string, unknown>
  context_policy?: Record<string, unknown>
  skill_policy?: Record<string, unknown>
  tool_policy?: Record<string, unknown>
  memory_policy?: Record<string, unknown>
  gate_policy?: Record<string, unknown>
  execution_policy?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export interface AtlasAiPolicyProfileRegistry {
  schema_version: number
  source: string
  domains: AtlasAiDomainProfile[]
  flows: AtlasAiFlowProfile[]
}

export interface AtlasAiPolicyProfilesResponse {
  generated_at?: string
  profile_registry: AtlasAiPolicyProfileRegistry
}

export interface AtlasAiDomainCatalogOnboarding {
  status: string
  completed_count: number
  total_count: number
  completed_phases: string[]
  missing_phases: string[]
}

export interface AtlasAiDomainCatalogDomain {
  id: string
  label: string
  default_flow: string
  orchestrator: string
  orchestrator_maturity: string
  runtime_family: string
  autonomy_default: string
  background_allowed: boolean
  flow_count: number
  onboarding: AtlasAiDomainCatalogOnboarding
}

export interface AtlasAiDomainCatalogFlow {
  id: string
  domain_id: string
  label: string
  runtime: string
  orchestrator: string
  orchestrator_maturity: string
  autonomy: string
  background_allowed: boolean
  destructive_requires_approval: boolean
  executor_preference: string
}

export interface AtlasAiDomainCatalogOrchestrator {
  id: string
  class: string
  maturity: string
  implemented_contract: boolean
  domains: string[]
  flows: string[]
}

export interface AtlasAiDomainCatalogResponse {
  schema_version: number
  status: string
  source: string
  filters: {
    domain: string | null
    flow: string | null
    maturity: string | null
  }
  summary: {
    domains: number
    flows: number
    orchestrators: number
    implemented_orchestrators: number
    scaffold_orchestrators: number
    planned_orchestrators: number
    ready_domains: number
    executable_incomplete_domains: number
  }
  domains: AtlasAiDomainCatalogDomain[]
  flows: AtlasAiDomainCatalogFlow[]
  orchestrators: AtlasAiDomainCatalogOrchestrator[]
  validation: {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
  generated_at: string
}

export interface AtlasAiDomainCatalogParams {
  domain?: string | null
  flow?: string | null
  maturity?: 'implemented' | 'scaffold' | 'planned' | string | null
}

export interface AtlasAiPolicyPreviewResponse {
  generated_at?: string
  profile: Record<string, unknown>
  effective_policy: Record<string, unknown>
  policy_merge_receipt: Record<string, unknown>
  legacy_policy: Record<string, unknown>
}

export interface AtlasAiPolicyPreviewInput {
  profile_id?: string
  surface?: string
  mode?: string
  task?: string
  payload?: Record<string, unknown>
  ai_policy_override?: Record<string, unknown>
}

export type AtlasAiDomainProfilePatch = Partial<Pick<
  AtlasAiDomainProfile,
  | 'label'
  | 'status'
  | 'default_flow'
  | 'orchestrator'
  | 'runtime_family'
  | 'description'
  | 'autonomy_default'
  | 'background_allowed'
  | 'model_policy'
  | 'context_policy'
  | 'skill_policy'
  | 'tool_policy'
  | 'memory_policy'
  | 'gate_policy'
  | 'metadata'
>>

export type AtlasAiFlowProfilePatch = Partial<Pick<
  AtlasAiFlowProfile,
  | 'label'
  | 'status'
  | 'orchestrator'
  | 'runtime'
  | 'description'
  | 'autonomy'
  | 'background_allowed'
  | 'requires_human_approval_for_destructive'
  | 'model_policy'
  | 'context_policy'
  | 'skill_policy'
  | 'tool_policy'
  | 'memory_policy'
  | 'gate_policy'
  | 'execution_policy'
  | 'metadata'
>>

export interface AtlasAiDomainProfileUpdateResponse {
  domain_profile: AtlasAiDomainProfile
  profile_registry: AtlasAiPolicyProfileRegistry
}

export interface AtlasAiFlowProfileUpdateResponse {
  flow_profile: AtlasAiFlowProfile
  profile_registry: AtlasAiPolicyProfileRegistry
  effective_policy?: Record<string, unknown>
}

export interface AtlasAiRuntimeSettings {
  source?: string
  updated_at?: string | null
  default_provider_selection?: 'auto' | 'fixed' | string
  default_provider: AtlasAiProvider | string
  default_tier: string
  council_allow_auto: boolean
  providers: Record<string, Partial<AtlasAiProviderModelPolicy>>
  budget: {
    enabled: boolean
    mode: string
    window_hours: number
    max_visible_tokens: number | null
    warn_visible_tokens: number | null
    providers: Record<string, {
      max_visible_tokens: number | null
      warn_visible_tokens: number | null
    }>
  }
}

export interface AtlasAiRuntimeSettingsPatch {
  default_provider?: AtlasAiProvider | string
  default_provider_selection?: 'auto' | 'fixed' | string
  default_tier?: string
  council_allow_auto?: boolean
  providers?: Record<string, {
    model?: string | null
    model_label?: string | null
    model_tier?: string | null
    model_identity?: string | null
    default_model_alias?: string | null
    allow_auto?: boolean
    allow_manual?: boolean
  }>
  budget?: {
    enabled?: boolean
    mode?: 'monitor' | 'block' | string
    window_hours?: number
    max_visible_tokens?: number | null
    warn_visible_tokens?: number | null
    providers?: Record<string, {
      max_visible_tokens?: number | null
      warn_visible_tokens?: number | null
    }>
  }
}

export interface AiProvidersStatusResponse {
  generated_at?: string
  runtime_settings?: AtlasAiRuntimeSettings
  provider_choice_catalog?: {
    schema_version?: string
    default_provider_selection?: 'auto' | 'fixed' | string
    default_provider?: AtlasAiProvider | string
    default_provider_options?: Array<{
      key: string
      provider?: AtlasAiProvider | string | null
      label: string
      description?: string | null
    }>
    providers?: AtlasAiProviderModelPolicy[]
  }
  default_provider_selection?: 'auto' | 'fixed' | string
  default_provider?: AtlasAiProvider | string
  default_model?: AtlasAiProviderModelPolicy
  model_policy?: AtlasAiModelPolicy
  budget?: AtlasAiBudgetStatus
  queue: AtlasAiQueueStatus
  workers?: AtlasAiWorkerStatus[]
  providers: AtlasAiProviderHealth[]
  usage_24h?: AtlasAiUsageWindow
  active_jobs?: AtlasAiActiveJob[]
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
  metrics?: AtlasAiTelemetryScorecard
  metrics_health?: AtlasAiTelemetryHealth
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

export interface AtlasAiTelemetryScorecard {
  available: boolean
  window?: {
    since: string
    until: string
  }
  totals?: {
    traces: number
    final_quality_avg: number | null
    final_efficiency_avg: number | null
    context_efficiency_avg: number | null
    total_latency_avg_ms: number | null
    app_visible_avg_ms: number | null
    cost_microusd_sum: number
    unknown_cost_count: number
    estimated_cost_count?: number
    actual_cost_count?: number
    operational_estimate_cost_count?: number
    first_pass_success_rate: number | null
    needed_remediation_rate: number | null
    backgrounded_during_run_rate: number | null
    recovered_from_pending_count: number
    reask_detected_count: number
    atlas_decide_trace_count?: number
    atlas_decide_multi_stage_count?: number
    atlas_decide_degraded_count?: number
  }
  by_surface?: AtlasAiTelemetryScorecardBucket[]
  by_provider?: AtlasAiTelemetryScorecardBucket[]
  by_task_type?: AtlasAiTelemetryScorecardBucket[]
  by_atlas_decide_execution_strategy?: AtlasAiTelemetryAtlasBucket[]
  by_atlas_decide_context_strategy?: AtlasAiTelemetryAtlasBucket[]
  atlas_decide?: {
    available: boolean
    traces: number
    multi_stage_count: number
    multi_stage_rate: number | null
    degraded_count: number
    degraded_rate: number | null
    by_execution_strategy?: AtlasAiTelemetryAtlasBucket[]
    by_context_strategy?: AtlasAiTelemetryAtlasBucket[]
    by_selected_provider?: AtlasAiTelemetryAtlasBucket[]
    by_scout_provider?: AtlasAiTelemetryAtlasBucket[]
  }
  risks?: Record<string, number>
  recent_low_score?: Array<Record<string, unknown>>
}

export interface AtlasAiTelemetryScorecardBucket {
  bucket: string
  traces: number
  quality_avg: number | null
  efficiency_avg: number | null
  latency_avg_ms: number | null
  cost_microusd_sum: number
  unknown_cost_count?: number
  estimated_cost_count?: number
  first_pass_success_rate: number | null
  needed_remediation_rate: number | null
}

export interface AtlasAiTelemetryAtlasBucket {
  bucket: string
  traces: number
  quality_avg: number | null
  efficiency_avg: number | null
  latency_avg_ms: number | null
  cost_microusd_sum: number
  multi_stage_rate: number | null
  degraded_rate: number | null
  providers_used?: string[]
}

export interface AtlasAiTelemetryHealthIssue {
  key: string
  severity: 'watch' | 'warning' | 'critical' | string
  value: unknown
  threshold: unknown
  summary: string
}

export interface AtlasAiMissingCostRate {
  provider: string | null
  model: string | null
  reason: string
  can_import_rate: boolean
  traces: number
  latest_computed_at: string | null
  rate_template?: Record<string, unknown> | null
}

export interface AtlasAiTelemetryHealth {
  available: boolean
  status: 'healthy' | 'watch' | 'warning' | 'critical' | 'unknown' | string
  health_score: number | null
  window?: {
    since: string
    until: string
  }
  thresholds?: Record<string, unknown>
  issues: AtlasAiTelemetryHealthIssue[]
  evidence?: {
    missing_cost_rates?: AtlasAiMissingCostRate[]
    [key: string]: unknown
  }
  actions: string[]
  scorecard?: AtlasAiTelemetryScorecard
}

export interface AtlasAiTelemetryEventInput {
  event_key?: string
  correlation_id?: string
  trace_id?: string | null
  thread_id?: string | null
  session_id?: string | null
  ai_job_id?: string | null
  ai_job_attempt_id?: string | null
  client_id?: string | null
  surface: 'mobile' | 'cli' | 'server' | 'worker' | 'scheduler' | 'eval'
  runtime?: 'ios' | 'android' | 'mac_cli' | 'laravel' | 'worker' | 'scheduler' | 'test' | null
  app_version?: string | null
  cli_version?: string | null
  provider?: string | null
  model?: string | null
  agent_slug?: string | null
  event_name: string
  event_phase?: string | null
  occurred_at_client?: string | null
  duration_ms?: number | null
  numeric_value?: number | null
  unit?: string | null
  metadata?: Record<string, unknown>
  privacy?: Record<string, unknown>
  schema_version?: number
}

export interface AtlasAiTelemetryBatchResponse {
  accepted: number
  duplicates: number
  rejected: number
  events: Array<{ id: string; event_key: string; duplicate: boolean }>
  errors: Array<{ index: number; message: string }>
}

export interface AtlasAiTelemetryScorecardResponse {
  scorecard: AtlasAiTelemetryScorecard
  health?: AtlasAiTelemetryHealth
  recomputed: number | null
}

export interface AtlasAiProviderCostRate {
  id: string
  provider: string
  model: string
  input_microusd_per_1k: number
  output_microusd_per_1k: number
  currency: string
  effective_from: string | null
  effective_until: string | null
  metadata: Record<string, unknown>
  created_at: string | null
}

export interface AtlasAiOutcomeLink {
  id: string
  trace_id: string | null
  thread_id: string | null
  session_id: string | null
  outcome_type: string
  target_type: string | null
  target_id: string | null
  value_score: number | null
  confidence: number | null
  source: string
  occurred_at: string | null
  metadata: Record<string, unknown>
  created_at: string | null
}

export interface AiThreadsResponse {
  threads: AtlasAiThread[]
}

export interface AtlasWorkspaceProfile {
  slug: string
  name: string
  kind?: string | null
  workspace_path?: string | null
  workspace_path_exists?: boolean | null
  repo_root?: string | null
  stack_summary?: string | null
  production_status?: string | null
  docs_status?: string | null
  status?: string | null
  safety?: Record<string, unknown>
}

export interface AtlasWorkspaceProfileListResponse {
  schema_version: 'atlas.code.workspace_profile.v1' | string
  data: AtlasWorkspaceProfile[]
  meta: {
    total: number
    default_slug: string | null
  }
}

export interface AtlasWorkspaceProfileMutationResponse {
  schema_version: 'atlas.code.workspace_profile.v1' | string
  workspace: AtlasWorkspaceProfile
  meta: {
    persisted: boolean
    execution_allowed: boolean
    execution_blocked_reason?: string | null
  }
}

export interface AtlasWorkspaceProfileCreateInput {
  slug: string
  name: string
  workspace_path?: string | null
  repo_root?: string | null
  kind?: string
  source?: string
  status?: string
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

export type AtlasMemoryReviewQueueKind = 'memory_privacy' | 'verbatim_privacy' | 'relation'

export interface AtlasMemoryReviewQueueItem {
  id: string
  kind: AtlasMemoryReviewQueueKind | string
  review_type: string
  priority: number
  severity: 'low' | 'medium' | 'high' | string
  reason: string | null
  action_hint: string | null
  memory_entry_id?: string | null
  verbatim_memory_id?: string | null
  relation_id?: string | null
  relation_type?: 'duplicate' | 'conflict' | string
  title?: string | null
  summary?: string | null
  scope?: string | null
  project_id?: string | null
  task_id?: string | null
  engineering_run_id?: string | null
  source_type?: string | null
  source_id?: string | null
  source_memory_entry_id?: string | null
  target_memory_entry_id?: string | null
  source_memory?: Record<string, unknown> | null
  target_memory?: Record<string, unknown> | null
  privacy_class?: 'normal' | 'private' | 'sensitive' | 'secret' | string | null
  external_ai_allowed?: boolean | null
  redaction_status?: 'clean' | 'redacted' | string | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface AtlasMemoryReviewQueue {
  generated_at: string
  areas: string[]
  total: number
  counts: {
    memory_privacy: number
    verbatim_privacy: number
    relation: number
    [key: string]: number
  }
  items: AtlasMemoryReviewQueueItem[]
}

export interface AtlasMemoryReviewQueueResponse {
  review_queue: AtlasMemoryReviewQueue
}

export type AtlasMemoryProviderProjectionTarget = 'claude' | 'agents' | 'all'

export type AtlasMemoryProviderProjectionSummary = Record<string, number | undefined>

export interface AtlasMemoryProviderProjectionItem {
  target: string
  path: string | null
  exists?: boolean
  managed?: boolean
  manual_drift?: boolean
  stale?: boolean
  changed?: boolean
  change_type?: 'create' | 'update' | 'adopt' | 'manual_drift' | 'none' | string
  reason?: string | null
  current_line_count?: number
  proposed_line_count?: number
  memory_count?: number
  diff_line_count?: number
  diff?: string
  written?: boolean
  error?: string | null
  inspection?: Record<string, unknown>
  result?: Record<string, unknown>
}

export interface AtlasMemoryProviderProjection {
  ok?: boolean
  status: 'passed' | 'needs_review' | string
  workspace?: string | null
  workspace_exists?: boolean
  target?: string
  targets?: string[]
  summary: AtlasMemoryProviderProjectionSummary
  detail?: string | null
  next_actions?: string[]
  projections?: AtlasMemoryProviderProjectionItem[]
  review?: AtlasMemoryProviderProjection
  applied?: AtlasMemoryProviderProjectionItem[]
  blocked?: AtlasMemoryProviderProjectionItem[]
  failed?: AtlasMemoryProviderProjectionItem[]
}

export interface AtlasMemoryProviderProjectionResponse {
  provider_projection: AtlasMemoryProviderProjection
  audit?: AtlasMemoryProviderProjectionAudit | null
}

export interface AtlasMemoryProviderProjectionParams {
  target?: AtlasMemoryProviderProjectionTarget
  workspace?: string
  max_lines?: number
  memory_limit?: number
  force?: boolean
}

export interface ApplyAtlasMemoryProviderProjectionInput extends AtlasMemoryProviderProjectionParams {
  confirm: boolean
  allow_partial?: boolean
}

export interface AtlasMemoryProviderProjectionAudit {
  id: string
  action: string
  target: AtlasMemoryProviderProjectionTarget | string
  workspace: string | null
  initiator: string
  confirmation_mode: string | null
  status: 'passed' | 'needs_review' | string
  ok: boolean
  summary: AtlasMemoryProviderProjectionSummary
  applied: AtlasMemoryProviderProjectionItem[]
  blocked: AtlasMemoryProviderProjectionItem[]
  failed: AtlasMemoryProviderProjectionItem[]
  review_summary: AtlasMemoryProviderProjectionSummary
  metadata: Record<string, unknown>
  applied_at: string | null
  created_at: string | null
}

export interface AtlasMemoryProviderProjectionAuditsResponse {
  provider_projection_audits: AtlasMemoryProviderProjectionAudit[]
}

export interface AtlasMemoryProviderProjectionAuditSummaryBucket {
  value: string
  total: number
  applied: number
  blocked: number
}

export interface AtlasMemoryProviderProjectionAuditSummary {
  ok: boolean
  period_days: number
  since_at: string
  generated_at: string
  total: number
  applied: number
  blocked: number
  by_target: Record<string, AtlasMemoryProviderProjectionAuditSummaryBucket>
  by_initiator: Record<string, AtlasMemoryProviderProjectionAuditSummaryBucket>
  latest_at: string | null
  oldest_at: string | null
}

export interface AtlasMemoryProviderProjectionAuditSummaryResponse {
  provider_projection_audit_summary: AtlasMemoryProviderProjectionAuditSummary
}

export interface AtlasMemoryProviderProjectionAuditParams {
  target?: AtlasMemoryProviderProjectionTarget
  workspace?: string
  initiator?: 'api' | 'cli' | 'system'
  status?: 'passed' | 'needs_review' | 'confirmation_required' | 'cancelled' | string
  ok?: boolean
  limit?: number
}

export interface AtlasMemoryProviderProjectionAuditSummaryParams extends AtlasMemoryProviderProjectionAuditParams {
  days?: number
}

export interface PurgeAtlasMemoryProviderProjectionAuditInput extends AtlasMemoryProviderProjectionAuditParams {
  older_than_days?: number
  dry_run?: boolean
  confirm?: boolean
  confirmation_fingerprint?: string
}

export interface AtlasMemoryProviderProjectionAuditPurgePolicy {
  authorized: boolean
  requires_operator: boolean
  mode: 'atlas_token' | 'operator_header' | 'operator_token' | string
  header: string
}

export interface AtlasMemoryProviderProjectionAuditPurge {
  ok: boolean
  dry_run: boolean
  older_than_days: number
  cutoff_at?: string
  matched?: number
  deleted: number
  confirmation_fingerprint?: string | null
  filters?: Record<string, unknown>
  policy?: AtlasMemoryProviderProjectionAuditPurgePolicy
  status?: string
}

export interface AtlasMemoryProviderProjectionAuditPurgeResponse {
  provider_projection_audit_purge: AtlasMemoryProviderProjectionAuditPurge
}

export interface AtlasMemoryRegistryEntry {
  id: string
  memory_type: string
  scope_type: string
  scope_id: string | null
  project_id?: string | null
  task_id?: string | null
  engineering_run_id?: string | null
  title: string | null
  body: string
  summary: string | null
  redacted_title?: string | null
  redacted_body?: string | null
  redacted_summary?: string | null
  privacy_class?: string | null
  external_ai_allowed?: boolean | null
  redaction_status?: string | null
  status: string
  metadata: Record<string, unknown>
}

export interface AtlasVerbatimMemoryEntry {
  id: string
  memory_entry_id: string | null
  verbatim_type: string
  scope_type?: string | null
  scope_id?: string | null
  project_id?: string | null
  task_id?: string | null
  engineering_run_id?: string | null
  title: string | null
  verbatim_text?: string | null
  redacted_text: string
  summary: string | null
  privacy_class: string
  external_ai_allowed: boolean
  redaction_status: string
  status: string
  metadata: Record<string, unknown>
}

export interface AtlasMemoryRecallItem {
  rank?: number
  source?: string
  source_ref_type?: string
  source_ref_id?: string
  id?: string
  type?: string
  scope?: string
  title?: string | null
  summary?: string | null
  excerpt?: string | null
  body?: string | null
  snippet?: string | null
  score?: number
  reason?: string | null
  estimated_chars?: number
  [key: string]: unknown
}

export interface AtlasMemoryRecall {
  query: string
  context: Record<string, unknown>
  summary: {
    registry_candidates?: number
    verbatim_candidates?: number
    semantic_candidates?: number
    recall_count?: number
    budget_chars?: number
    policy?: string
    [key: string]: unknown
  }
  recall: AtlasMemoryRecallItem[]
  sources: {
    registry?: AtlasMemoryRecallItem[]
    verbatim?: AtlasMemoryRecallItem[]
    semantic?: AtlasMemoryRecallItem[]
    [key: string]: unknown
  }
}

export interface AtlasMemoryRecallResponse {
  memory_recall: AtlasMemoryRecall
}

export interface AtlasOpenBrainContextPack {
  ok: boolean
  schema_version: number
  context_pack_hash: string
  context_pack: Record<string, unknown>
  context_refs: Record<string, unknown>[]
  summary: {
    context_refs_count?: number
    memory_refs_count?: number
    recall_count?: number
    registry_count?: number
    verbatim_count?: number
    semantic_count?: number
    provider_safe?: boolean
    [key: string]: unknown
  }
  audit?: Record<string, unknown> | null
  prompt_section?: string
}

export interface AtlasOpenBrainContextPackResponse {
  open_brain: AtlasOpenBrainContextPack
}

export interface AtlasOpenBrainAudit {
  id: string
  surface: string
  requester: string | null
  action: string
  status: string
  workspace_hash: string | null
  workspace_label: string | null
  context_pack_hash: string | null
  context_refs_count: number
  memory_refs_count: number
  provider_safe: boolean
  query: Record<string, unknown>
  result_summary: Record<string, unknown>
  accessed_at: string | null
}

export interface AtlasOpenBrainAuditsResponse {
  open_brain_audits: AtlasOpenBrainAudit[]
}

export interface AtlasMemoryMaintenanceStage {
  ok?: boolean
  status?: string
  summary?: Record<string, unknown>
  overall_status?: string
  next_actions?: string[]
  [key: string]: unknown
}

export interface AtlasMemoryQualityTrendDriver {
  kind?: string
  key?: string
  severity?: string
  delta?: number
  current?: number
  previous?: number
  [key: string]: unknown
}

export interface AtlasMemoryQualityTrend {
  status?: string
  current_score?: number
  latest_snapshot_score?: number
  previous_snapshot_score?: number | null
  snapshot_count?: number
  current_delta_from_latest?: number | null
  latest_delta_from_previous?: number | null
  window_delta?: number | null
  latest_snapshot_id?: string | null
  latest_snapshot_at?: string | null
  drivers?: AtlasMemoryQualityTrendDriver[]
  [key: string]: unknown
}

export interface AtlasMemoryQualitySnapshot {
  id: string
  workspace?: string | null
  workspace_hash?: string | null
  source_type?: string | null
  source_id?: string | null
  status: string
  score: number
  components?: Record<string, unknown>
  counts?: Record<string, unknown>
  ratios?: Record<string, unknown>
  issues?: Record<string, unknown>[]
  recommendations?: string[]
  metadata?: Record<string, unknown>
  snapshot_at?: string | null
  created_at?: string | null
}

export interface AtlasMemoryQuality {
  ok: boolean
  status: string
  score: number
  components?: Record<string, number>
  counts?: Record<string, unknown>
  ratios?: Record<string, number>
  issues?: Record<string, unknown>[]
  trend?: AtlasMemoryQualityTrend
  recommendations?: string[]
  latest_snapshot?: Partial<AtlasMemoryQualitySnapshot> | null
  generated_at?: string
  [key: string]: unknown
}

export interface AtlasMemoryQualityResponse {
  memory_quality: AtlasMemoryQuality
}

export interface AtlasMemoryQualityHistory {
  ok: boolean
  status: string
  period_days: number
  since_at: string
  summary: Record<string, unknown>
  snapshots: AtlasMemoryQualitySnapshot[]
  generated_at?: string
}

export interface AtlasMemoryQualityHistoryResponse {
  memory_quality_history: AtlasMemoryQualityHistory
}

export interface AtlasMemoryMaintenance {
  ok: boolean
  status: string
  workspace: string
  dry_run: boolean
  prune: boolean
  writes: {
    knowledge_sync?: boolean
    code_index?: boolean
    provider_projection_apply?: boolean
    [key: string]: boolean | undefined
  }
  stages: {
    knowledge_sync?: AtlasMemoryMaintenanceStage
    code_index?: AtlasMemoryMaintenanceStage
    memory_quality?: AtlasMemoryMaintenanceStage & AtlasMemoryQuality
    memory_quality_snapshot?: AtlasMemoryMaintenanceStage
    provider_projection_status?: AtlasMemoryMaintenanceStage
    provider_projection_apply?: AtlasMemoryMaintenanceStage
    mcp_health?: AtlasMemoryMaintenanceStage
    [key: string]: AtlasMemoryMaintenanceStage | undefined
  }
  generated_at: string
}

export interface AtlasMemoryMaintenanceResponse {
  memory_maintenance: AtlasMemoryMaintenance
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

function shouldUseStoredBackendHost(host: string): boolean {
  const normalized = host.trim()
  if (!normalized) return false

  // Builds antigos gravavam hostnames Bonjour/DNS locais como default. Quando
  // esses nomes param de resolver, o app fica "zerado" mesmo com relatório real
  // no backend. Se o operador não escolheu outro host, migra para o default atual.
  if (LEGACY_DEFAULT_HOSTS.has(normalized) && normalized !== DEFAULT_HOST) return false

  return true
}

export async function hydrateApiConfig(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      // Garante que valores legados em AsyncStorage estejam copiados pro
      // MMKV antes de ler. Sem isso, usuários atualizando perderiam host
      // customizado, device pairing, etc.
      await ensureMigrationFromAsyncStorage()
      const [host, port, token, mobileToken, mobileDeviceId] = await Promise.all([
        atlasStorage.getItem(HOST_KEY),
        atlasStorage.getItem(PORT_KEY),
        readStoredToken(),
        readStoredMobileDeviceToken(),
        readStoredMobileDeviceId(),
      ])

      if (host) {
        if (shouldUseStoredBackendHost(host)) {
          cachedHost = host.trim()
        } else {
          cachedHost = null
          await atlasStorage.removeItem(HOST_KEY)
        }
      }
      if (port) {
        const n = Number(port)
        if (Number.isFinite(n) && n > 0) cachedPort = n
      }
      if (token && token !== LEGACY_PLACEHOLDER_TOKEN) cachedToken = token
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
  await atlasStorage.setItem(HOST_KEY, cachedHost)
}

// Drop a stored backend host so the app reverts to the build-injected default
// host (set by `npm run dev:ios` to the Mac's LAN IP). Recovery path for when a
// previously-stored host (e.g. a Tailscale IP) stops being reachable and would
// otherwise permanently shadow the working default.
export async function clearStoredBackendHost(): Promise<void> {
  cachedHost = null
  await atlasStorage.removeItem(HOST_KEY)
}

export function getDefaultBackendHost(): string {
  return DEFAULT_HOST
}

export async function setBackendPort(port: number): Promise<void> {
  cachedPort = Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT
  await atlasStorage.setItem(PORT_KEY, String(cachedPort))
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

export function hasMobileDeviceBearer(): boolean {
  return Boolean(cachedMobileDeviceToken)
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
    writeStoredMobileDeviceId(session.deviceId),
  ])
}

export async function clearMobileDeviceSession(): Promise<void> {
  cachedMobileDeviceToken = null
  cachedMobileDeviceId = null
  await Promise.all([
    removeStoredMobileDeviceToken(),
    removeStoredMobileDeviceId(),
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
  client_id?: string
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

export async function recoverMobileDeviceSession(
  opts: { timeoutMs?: number; retry?: boolean } = {},
): Promise<MobileDeviceSession | null> {
  await hydrateApiConfig()
  const currentSession = getMobileDeviceSession()
  if (currentSession) return currentSession
  if (!cachedMobileDeviceToken) return null

  try {
    const response = await listMobileDevices(opts)
    const currentDevice = currentMobileDevice(response)
    if (!currentDevice?.id) return null

    const recoveredSession = {
      deviceToken: cachedMobileDeviceToken,
      deviceId: currentDevice.id,
    }
    await setMobileDeviceSession(recoveredSession)

    return recoveredSession
  } catch (error) {
    // 401 já limpou a sessão dentro de mobileApiRequest — apenas absorve.
    if (error instanceof AtlasApiError && error.status === 401) return null
    throw error
  }
}

export async function listMobileDevices(
  opts: { timeoutMs?: number; retry?: boolean } = {},
): Promise<MobileDevicesResponse> {
  return mobileApiGet<MobileDevicesResponse>('/v1/mobile/devices', opts)
}

export async function listMobileConstelacaoPositions(params: {
  limit?: number
  domain?: DomainKey | 'all'
  lens?: 'bilderatlas' | 'command_sky'
} = {}): Promise<ConstelacaoPositionsResponse> {
  const normalized = { ...params, domain: params.domain === 'all' ? undefined : params.domain }

  return mobileApiGet<ConstelacaoPositionsResponse>(
    `/v1/mobile/atlas/celestial/positions${queryString(normalized)}`,
  )
}

export async function startMobileVoiceSession(input: {
  session_id?: string
  envelope_id?: string
  receipt_id?: string
  client_surface?: 'mobile'
  transport?: 'livekit_webrtc' | 'mobile_push_to_talk'
  runtime?: 'livekit_agents_sdk'
  room_name?: string
  participant_identity?: string
  privacy_class?: 'p1_public' | 'p2_internal' | 'p3_audio' | 'p4_secret'
  explicit_operator_consent?: boolean
  rivals_arm?: 'atlas_voice' | 'direct_provider_baseline'
} = {}): Promise<AtlasVoiceSessionResponse> {
  const payload = {
    ...input,
    session_id: input.session_id ?? newMobileVoiceRuntimeId('mobile_voice'),
    client_surface: input.client_surface ?? 'mobile',
    transport: input.transport ?? 'livekit_webrtc',
    runtime: input.runtime ?? 'livekit_agents_sdk',
    privacy_class: input.privacy_class ?? 'p3_audio',
    explicit_operator_consent: input.explicit_operator_consent ?? true,
  }
  return mobileApiPost<AtlasVoiceSessionResponse>('/v1/mobile/ai/voice/session/start', payload, {
    idempotencyKey: mobileVoiceSessionStartIdempotencyKey(payload),
  })
}

export async function endMobileVoiceSession(input: {
  session_id: string
  envelope_id?: string
  receipt_id?: string
  reason?: string
}): Promise<AtlasVoiceSessionResponse> {
  const payload = {
    ...input,
    reason: input.reason ?? 'operator_finished',
  }
  return mobileApiPost<AtlasVoiceSessionResponse>('/v1/mobile/ai/voice/session/end', payload, {
    idempotencyKey: mobileVoiceSessionEndIdempotencyKey(payload),
  })
}

export async function sendMobileVoiceTurn(input: {
  session_id: string
  envelope_id?: string
  receipt_id?: string
  turn_id?: string
  audio_hash?: string
  audio_duration_ms?: number
  transcript?: string
  language?: string
  domain_hint?: string
  flow_hint?: string
  turn_to_first_audio_ms?: number
  dispatch_to_ai?: boolean
  allow_transcript_persistence?: boolean
  ai_thread_id?: string
}): Promise<AtlasVoiceTurnResponse> {
  const payload = {
    ...input,
    turn_id: input.turn_id ?? newMobileVoiceRuntimeId('mobile_voice_turn'),
    audio_duration_ms: mobileVoiceMetricMs(input.audio_duration_ms),
    turn_to_first_audio_ms: mobileVoiceMetricMs(input.turn_to_first_audio_ms),
  }
  return mobileApiPost<AtlasVoiceTurnResponse>('/v1/mobile/ai/voice/turn', payload, {
    idempotencyKey: mobileVoiceTurnIdempotencyKey(payload),
  })
}

export async function interruptMobileVoiceTurn(input: {
  session_id: string
  envelope_id?: string
  receipt_id?: string
  turn_id?: string
  reason?: string
  interrupted_stage?: string
  interruption_source?: 'operator' | 'mobile' | 'runtime_callback'
  played_duration_ms?: number
  latency_ms?: number
}): Promise<AtlasVoiceTurnResponse> {
  const payload = {
    ...input,
    reason: input.reason ?? 'operator_interrupted',
    interruption_source: input.interruption_source ?? 'mobile',
    played_duration_ms: mobileVoiceMetricMs(input.played_duration_ms),
    latency_ms: mobileVoiceMetricMs(input.latency_ms),
  }
  return mobileApiPost<AtlasVoiceTurnResponse>('/v1/mobile/ai/voice/turn/interrupted', payload, {
    idempotencyKey: mobileVoiceInterruptIdempotencyKey(payload),
  })
}

export async function recordMobileVoiceTurnSynthesized(input: {
  session_id: string
  envelope_id?: string
  receipt_id?: string
  turn_id: string
  response_text_hash?: string
  tts_provider?: string
  audio_hash?: string
  audio_duration_ms?: number
  latency_ms?: number
}): Promise<AtlasVoiceTurnResponse> {
  const payload = {
    ...input,
    audio_duration_ms: mobileVoiceMetricMs(input.audio_duration_ms),
    latency_ms: mobileVoiceMetricMs(input.latency_ms),
  }
  return mobileApiPost<AtlasVoiceTurnResponse>('/v1/mobile/ai/voice/turn/synthesized', payload, {
    idempotencyKey: mobileVoiceSynthesizedIdempotencyKey(payload),
  })
}

export async function synthesizeMobileVoiceTurn(input: {
  session_id: string
  envelope_id?: string
  receipt_id?: string
  turn_id: string
  text: string
  response_text_hash?: string
}): Promise<AtlasVoiceTtsSynthesisResponse> {
  const payload = { ...input }

  return mobileApiPost<AtlasVoiceTtsSynthesisResponse>('/v1/mobile/ai/voice/tts/synthesize', payload, {
    idempotencyKey: mobileVoiceTtsSynthesisIdempotencyKey(payload),
  })
}

export async function recordMobileVoiceTurnPlayed(input: {
  session_id: string
  envelope_id?: string
  receipt_id?: string
  turn_id: string
  played_duration_ms?: number
  latency_ms?: number
}): Promise<AtlasVoiceTurnResponse> {
  const payload = {
    ...input,
    played_duration_ms: mobileVoiceMetricMs(input.played_duration_ms),
    latency_ms: mobileVoiceMetricMs(input.latency_ms),
  }
  return mobileApiPost<AtlasVoiceTurnResponse>('/v1/mobile/ai/voice/turn/played', payload, {
    idempotencyKey: mobileVoicePlayedIdempotencyKey(payload),
  })
}

export async function recordMobileVoiceRuntimeFailed(input: {
  session_id: string
  envelope_id?: string
  receipt_id?: string
  turn_id: string
  failure_code?: string
  error_class?: string
  error_message_hash?: string
  latency_ms?: number
}): Promise<AtlasVoiceTurnResponse> {
  const errorMessageHash = await mobileVoiceRuntimeFailureHash(input)
  const payload = {
    ...input,
    error_message_hash: errorMessageHash,
    latency_ms: mobileVoiceMetricMs(input.latency_ms),
  }
  return mobileApiPost<AtlasVoiceTurnResponse>('/v1/mobile/ai/voice/runtime/failed', payload, {
    idempotencyKey: mobileVoiceRuntimeFailedIdempotencyKey(payload),
  })
}

export async function getMobileVoiceReadiness(params: {
  hours?: number
} = {}): Promise<AtlasVoiceReadinessResponse> {
  return mobileApiGet<AtlasVoiceReadinessResponse>(
    `/v1/mobile/ai/voice/readiness${queryString(params)}`,
  )
}

export async function getMobileMacStatus(): Promise<AtlasMacStatusResponse> {
  return mobileApiGet<AtlasMacStatusResponse>('/v1/mobile/mac/status')
}

export async function startMobileMacRemoteSession(input: {
  duration_minutes?: number
  reason?: string | null
}): Promise<AtlasMacSessionResponse> {
  return mobileApiPost<AtlasMacSessionResponse>('/v1/mobile/mac/remote-session', input, {
    idempotencyKey: `mac-remote-session-${Date.now()}`,
  })
}

export async function stopMobileMacRemoteSession(sessionId: string): Promise<AtlasMacSessionResponse> {
  return mobileApiPost<AtlasMacSessionResponse>(`/v1/mobile/mac/remote-session/${encodeURIComponent(sessionId)}/stop`, {}, {
    idempotencyKey: `mac-remote-stop-${sessionId}-${Date.now()}`,
  })
}

export async function requestMobileMacSleepNow(): Promise<{ ok: boolean; status: AtlasMacStatusResponse }> {
  return mobileApiPost<{ ok: boolean; status: AtlasMacStatusResponse }>('/v1/mobile/mac/sleep-now', {}, {
    idempotencyKey: `mac-sleep-now-${Date.now()}`,
  })
}

export async function cleanupMobileMacCaffeinate(): Promise<{
  ok: boolean
  cleanup: { checked: number; removed: number; labels: string[]; queued_for_host?: boolean }
  status: AtlasMacStatusResponse
}> {
  return mobileApiPost<{
    ok: boolean
    cleanup: { checked: number; removed: number; labels: string[]; queued_for_host?: boolean }
    status: AtlasMacStatusResponse
  }>('/v1/mobile/mac/caffeinate/cleanup', {}, {
    idempotencyKey: `mac-caffeinate-cleanup-${Date.now()}`,
  })
}

export async function bootstrapMobileMacAgent(input: {
  wake_time?: string
  duration_minutes?: number
  timezone?: string
} = {}): Promise<{
  ok: boolean
  complete: boolean
  steps: Array<Record<string, unknown>>
  next_actions: Array<{ code: string; severity: string; message: string; command: string | null }>
  before_readiness: AtlasMacStatusResponse['readiness'] | null
  status: AtlasMacStatusResponse
}> {
  return mobileApiPost<{
    ok: boolean
    complete: boolean
    steps: Array<Record<string, unknown>>
    next_actions: Array<{ code: string; severity: string; message: string; command: string | null }>
    before_readiness: AtlasMacStatusResponse['readiness'] | null
    status: AtlasMacStatusResponse
  }>('/v1/mobile/mac/bootstrap', input, {
    idempotencyKey: `mac-bootstrap-${Date.now()}`,
  })
}

export async function createMobileMacMaintenanceWindow(input: {
  name?: string
  wake_time: string
  duration_minutes?: number
  days_of_week?: number[]
  enabled?: boolean
}): Promise<{ ok: boolean; window: AtlasMaintenanceWindow }> {
  return mobileApiPost<{ ok: boolean; window: AtlasMaintenanceWindow }>('/v1/mobile/mac/maintenance-windows', input, {
    idempotencyKey: `mac-maintenance-${Date.now()}`,
  })
}

export async function deleteMobileMacMaintenanceWindow(windowId: string): Promise<{ ok: boolean }> {
  return mobileApiDelete<{ ok: boolean }>(`/v1/mobile/mac/maintenance-windows/${encodeURIComponent(windowId)}`)
}

export async function updateMobilePushToken(input: {
  expo_push_token?: string | null
  notification_permissions?: string | null
}): Promise<{ device: AtlasMobileDevice }> {
  return mobileApiPost<{ device: AtlasMobileDevice }>('/v1/mobile/devices/push-token', input)
}

export async function updateMobileNotificationPreferences(
  input: Partial<AtlasNotificationPreferences>,
): Promise<{ device: AtlasMobileDevice }> {
  return mobileApiPost<{ device: AtlasMobileDevice }>('/v1/mobile/devices/notification-preferences', input)
}

export async function revokeMobileDevice(deviceId: string): Promise<{ device: AtlasMobileDevice }> {
  const response = await mobileApiDelete<{ device: AtlasMobileDevice }>(`/v1/mobile/devices/${encodeURIComponent(deviceId)}`)
  if (cachedMobileDeviceId === deviceId) {
    await clearMobileDeviceSession()
  }

  return response
}

export async function listMobileInbox(
  params: {
    status?: 'unread' | 'read' | 'actioned' | 'resolved' | 'dismissed' | 'expired' | 'snoozed' | 'active' | 'all'
    type?: AtlasOperationalInboxType
    severity?: 'debug' | 'info' | 'warning' | 'critical'
    limit?: number
    cursor?: string | null
  } = {},
  opts: { timeoutMs?: number; retry?: boolean } = {},
): Promise<MobileInboxResponse> {
  return mobileApiGet<MobileInboxResponse>(`/v1/mobile/inbox${queryString(params)}`, opts)
}

export async function getMobileCriticalInboxReview(
  params: { limit?: number } = {},
  opts: { timeoutMs?: number; retry?: boolean } = {},
): Promise<MobileCriticalInboxReviewResponse> {
  return mobileApiGet<MobileCriticalInboxReviewResponse>(`/v1/mobile/inbox/critical-review${queryString(params)}`, opts)
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

export async function retryMobileInboxDiscussionBootstrap(id: string): Promise<MobileInboxActionResponse> {
  return mobileApiPost<MobileInboxActionResponse>(`/v1/mobile/inbox/${encodeURIComponent(id)}/discussion-bootstrap/retry`, {}, {
    idempotencyKey: `discussion-bootstrap-retry-${id}-${Date.now()}`,
  })
}

export async function listMobileRecommendations(params: {
  state?: 'open' | 'all' | string
  limit?: number
} = {}): Promise<MobileRecommendationsResponse> {
  return mobileApiGet<MobileRecommendationsResponse>(`/v1/mobile/ai/recommendations${queryString(params)}`)
}

export async function getMobileRecommendation(id: string): Promise<MobileRecommendationResponse> {
  return mobileApiGet<MobileRecommendationResponse>(`/v1/mobile/ai/recommendations/${encodeURIComponent(id)}`)
}

export async function transitionMobileRecommendation(
  id: string,
  input: {
    state: 'acknowledged' | 'in_progress' | 'applied' | 'rejected' | 'snoozed'
    reason?: string | null
    snoozed_until?: string | null
  },
): Promise<{ ok: boolean; item: AtlasPerformanceRecommendation }> {
  return mobileApiPost<{ ok: boolean; item: AtlasPerformanceRecommendation }>(
    `/v1/mobile/ai/recommendations/${encodeURIComponent(id)}/transition`,
    input,
    { idempotencyKey: `recommendation-${input.state}-${id}-${Date.now()}` },
  )
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

export async function getMobileAiThread(id: string): Promise<{
  thread: AtlasAiThread
  traces: AtlasAiTrace[]
  mobile_context: AtlasMobileThreadContext | null
}> {
  return mobileApiGet<{
    thread: AtlasAiThread
    traces: AtlasAiTrace[]
    mobile_context: AtlasMobileThreadContext | null
  }>(`/v1/mobile/threads/${encodeURIComponent(id)}`)
}

export async function replyMobileAiThread(
  id: string,
  input: {
    input_text: string
    client_id?: string
    agent_slug?: string
    provider?: AtlasAiProvider
    include_semantic_context?: boolean
    context_note_limit?: number
    payload?: Record<string, unknown>
  },
): Promise<{ trace: AtlasAiTrace; thread: AtlasAiThread }> {
  return mobileApiPost<{ trace: AtlasAiTrace; thread: AtlasAiThread }>(
    `/v1/mobile/threads/${encodeURIComponent(id)}/reply`,
    input,
    { idempotencyKey: input.client_id ? `mobile-thread-reply-${input.client_id}` : undefined },
  )
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

export async function deleteCapture(id: string): Promise<{
  ok: boolean
  deleted_capture_id: string
  deletion: {
    content_purged: boolean
    file_deleted: boolean
  }
}> {
  return apiDelete<{
    ok: boolean
    deleted_capture_id: string
    deletion: {
      content_purged: boolean
      file_deleted: boolean
    }
  }>(`/captures/${id}`)
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

export async function listProjectBlockers(
  projectId: string,
  params: { status?: AtlasProjectBlockerStatus | string; limit?: number } = {},
): Promise<ProjectBlockersResponse> {
  return apiGet<ProjectBlockersResponse>(`/projects/${encodeURIComponent(projectId)}/blockers${queryString(params)}`)
}

export async function createProjectBlocker(
  projectId: string,
  input: {
    task_id?: string | null
    project_step_id?: string | null
    severity?: AtlasProjectBlockerSeverity | null
    reason_code?: AtlasProjectBlockerReasonCode | null
    blocker_reason_code?: AtlasProjectBlockerReasonCode | null
    description?: string | null
    blocker?: string | null
    reason?: string | null
    note?: string | null
    unblock_next_action?: string | null
    next_hint?: string | null
    waiting_on?: string | null
    due_at?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<ProjectBlockerMutationResponse> {
  return apiPost<ProjectBlockerMutationResponse>(`/projects/${encodeURIComponent(projectId)}/blockers`, input)
}

export async function resolveProjectBlocker(
  projectId: string,
  blockerId: string,
  input: { resolution_note?: string | null; note?: string | null } = {},
): Promise<ProjectBlockerMutationResponse> {
  return apiPost<ProjectBlockerMutationResponse>(
    `/projects/${encodeURIComponent(projectId)}/blockers/${encodeURIComponent(blockerId)}/resolve`,
    input,
  )
}

export async function convertProjectBlockerToTask(
  projectId: string,
  blockerId: string,
  input: {
    title?: string | null
    description?: string | null
    priority?: 'low' | 'normal' | 'high' | 'urgent' | null
    estimated_minutes?: number | null
    energy_required?: 'low' | 'medium' | 'high' | null
    starter_step?: string | null
    minimum_viable_action?: string | null
  } = {},
): Promise<ProjectBlockerMutationResponse> {
  return apiPost<ProjectBlockerMutationResponse>(
    `/projects/${encodeURIComponent(projectId)}/blockers/${encodeURIComponent(blockerId)}/task`,
    input,
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
    blocker_reason_code?: AtlasProjectBlockerReasonCode | null
    blocker_severity?: AtlasProjectBlockerSeverity | null
    unblock_next_action?: string | null
    waiting_on?: string | null
    next_hint?: string | null
  } = {},
): Promise<AtlasTask> {
  return apiPost<AtlasTask>(`/tasks/${encodeURIComponent(id)}/complete`, input)
}

export async function listTaskEvents(id: string, params: { limit?: number } = {}): Promise<TaskEventsResponse> {
  return apiGet<TaskEventsResponse>(`/tasks/${encodeURIComponent(id)}/events${queryString(params)}`)
}

export async function fetchTaskEngineering(
  id: string,
  params: { limit?: number } = {},
): Promise<AtlasEngineeringPackageResponse> {
  return apiGet<AtlasEngineeringPackageResponse>(`/tasks/${encodeURIComponent(id)}/engineering${queryString(params)}`)
}

export async function freezeTaskEngineeringBlueprint(id: string): Promise<AtlasEngineeringPackageResponse> {
  return apiPost<AtlasEngineeringPackageResponse>(`/tasks/${encodeURIComponent(id)}/engineering/blueprint/freeze`, {})
}

export async function recordTaskEngineeringEvidence(
  id: string,
  input: AtlasEngineeringEvidenceInput,
): Promise<AtlasEngineeringEvidenceResponse> {
  return apiPost<AtlasEngineeringEvidenceResponse>(`/tasks/${encodeURIComponent(id)}/engineering/evidence`, input)
}

export async function fetchProjectEngineeringBlueprint(id: string): Promise<AtlasEngineeringProjectBlueprintResponse> {
  return apiGet<AtlasEngineeringProjectBlueprintResponse>(`/projects/${encodeURIComponent(id)}/engineering/blueprint`)
}

export async function prepareProjectEngineeringBlueprint(id: string): Promise<AtlasEngineeringProjectBlueprintResponse> {
  return apiPost<AtlasEngineeringProjectBlueprintResponse>(`/projects/${encodeURIComponent(id)}/engineering/blueprint/prepare`, {})
}

export async function createProjectEngineeringBlueprint(id: string): Promise<AtlasEngineeringProjectBlueprintResponse> {
  return apiPost<AtlasEngineeringProjectBlueprintResponse>(`/projects/${encodeURIComponent(id)}/engineering/blueprint/create`, {})
}

export async function validateProjectEngineeringBlueprint(
  id: string,
  input: { version?: number } = {},
): Promise<AtlasEngineeringProjectBlueprintResponse> {
  return apiPost<AtlasEngineeringProjectBlueprintResponse>(`/projects/${encodeURIComponent(id)}/engineering/blueprint/validate`, input)
}

export async function freezeProjectEngineeringBlueprint(
  id: string,
  input: { version?: number; exception_reason?: string; approved_by?: string } = {},
): Promise<AtlasEngineeringProjectBlueprintResponse> {
  return apiPost<AtlasEngineeringProjectBlueprintResponse>(`/projects/${encodeURIComponent(id)}/engineering/blueprint/freeze`, input)
}

export async function generateProjectEngineeringTasks(
  id: string,
  input: { version?: number; force?: boolean } = {},
): Promise<AtlasEngineeringProjectTasksGenerateResponse> {
  return apiPost<AtlasEngineeringProjectTasksGenerateResponse>(`/projects/${encodeURIComponent(id)}/engineering/tasks/generate`, input)
}

export async function recordTaskEngineeringQa(
  id: string,
  input: AtlasEngineeringQaInput,
): Promise<AtlasEngineeringGateResponse> {
  return apiPost<AtlasEngineeringGateResponse>(`/tasks/${encodeURIComponent(id)}/engineering/qa`, input)
}

export async function runTaskEngineeringHarness(
  id: string,
  input: AtlasEngineeringBenchmarkRunInput,
): Promise<AtlasEngineeringRunResponse> {
  return apiPost<AtlasEngineeringRunResponse>(`/tasks/${encodeURIComponent(id)}/engineering/runs`, input)
}

export async function runTaskEngineeringDeepReview(
  id: string,
  input: { findings?: Array<Record<string, unknown>>; recorded_by?: string } = {},
): Promise<AtlasEngineeringGateResponse> {
  return apiPost<AtlasEngineeringGateResponse>(`/tasks/${encodeURIComponent(id)}/engineering/review/deep`, input)
}

export async function runTaskPostgresReview(
  id: string,
  input: { workspace?: string; files?: string[] } = {},
): Promise<AtlasEngineeringGateResponse> {
  return apiPost<AtlasEngineeringGateResponse>(`/tasks/${encodeURIComponent(id)}/engineering/db/review`, input)
}

export async function fetchEngineeringRunPatchDiff(
  runId: string,
  patchId: string,
  params: { max_bytes?: number } = {},
): Promise<AtlasEngineeringPatchDiffResponse> {
  return apiGet<AtlasEngineeringPatchDiffResponse>(
    `/engineering/runs/${encodeURIComponent(runId)}/patch-artifacts/${encodeURIComponent(patchId)}/diff${queryString(params)}`,
  )
}

export async function replayEngineeringRun(
  runId: string,
  input: AtlasEngineeringRunReplayInput,
): Promise<AtlasEngineeringRunResponse> {
  return apiPost<AtlasEngineeringRunResponse>(`/engineering/runs/${encodeURIComponent(runId)}/replay`, input)
}

export async function replayEngineeringRunAttempt(
  runId: string,
  attemptId: string,
  input: AtlasEngineeringRunReplayInput,
): Promise<AtlasEngineeringRunResponse> {
  return apiPost<AtlasEngineeringRunResponse>(
    `/engineering/runs/${encodeURIComponent(runId)}/attempts/${encodeURIComponent(attemptId)}/replay`,
    input,
  )
}

export async function applyEngineeringRunOperatorAction(
  runId: string,
  input: AtlasEngineeringRunOperatorActionInput,
): Promise<AtlasEngineeringRunResponse> {
  return apiPost<AtlasEngineeringRunResponse>(`/engineering/runs/${encodeURIComponent(runId)}/operator-action`, input)
}

export async function listEngineeringTestRunArtifacts(
  runId: string,
  testRunId: string,
  params: { limit?: number } = {},
): Promise<AtlasEngineeringTestArtifactsResponse> {
  return apiGet<AtlasEngineeringTestArtifactsResponse>(
    `/engineering/runs/${encodeURIComponent(runId)}/test-runs/${encodeURIComponent(testRunId)}/artifacts${queryString(params)}`,
  )
}

export async function fetchEngineeringTestRunArtifactContent(
  runId: string,
  testRunId: string,
  params: { path: string; max_bytes?: number },
): Promise<AtlasEngineeringTestArtifactContentResponse> {
  return apiGet<AtlasEngineeringTestArtifactContentResponse>(
    `/engineering/runs/${encodeURIComponent(runId)}/test-runs/${encodeURIComponent(testRunId)}/artifacts/content${queryString(params)}`,
  )
}

export async function fetchEngineeringHarnessabilityCalibration(): Promise<AtlasEngineeringHarnessabilityCalibrationResponse> {
  return apiGet<AtlasEngineeringHarnessabilityCalibrationResponse>('/engineering/harnessability/calibration')
}

export async function calibrateEngineeringHarnessability(
  input: AtlasEngineeringHarnessabilityCalibrationInput = {},
): Promise<AtlasEngineeringHarnessabilityCalibrationResponse> {
  return apiPost<AtlasEngineeringHarnessabilityCalibrationResponse>('/engineering/harnessability/calibrate', input)
}

export async function fetchAtlasToolsDoctor(
  params: { workspace?: string | null } = {},
): Promise<AtlasToolsDoctorResponse> {
  return apiGet<AtlasToolsDoctorResponse>(`/tools/doctor${queryString(params)}`)
}

export async function fetchAtlasToolsAuthority(): Promise<AtlasToolsAuthorityResponse> {
  return apiGet<AtlasToolsAuthorityResponse>('/tools/authority')
}

export async function fetchAtlasToolsAuthorityPolicies(
  params: { workspace?: string | null } = {},
): Promise<AtlasToolsAuthorityPoliciesResponse> {
  return apiGet<AtlasToolsAuthorityPoliciesResponse>(`/tools/authority/policies${queryString(params)}`)
}

export async function configureAtlasToolAuthorityPolicy(
  authorityGroup: string,
  input: AtlasToolAuthorityPolicyInput = {},
): Promise<AtlasToolAuthorityPolicyMutationResponse> {
  return apiPut<AtlasToolAuthorityPolicyMutationResponse>(
    `/tools/authority/policies/${encodeURIComponent(authorityGroup)}`,
    input,
  )
}

export async function revokeAtlasToolAuthorityPolicy(
  authorityGroup: string,
  input: { workspace?: string | null; scope_type?: 'workspace' | 'global' | string } = {},
): Promise<AtlasToolAuthorityPolicyMutationResponse> {
  return apiDelete<AtlasToolAuthorityPolicyMutationResponse>(
    `/tools/authority/policies/${encodeURIComponent(authorityGroup)}${queryString(input as Record<string, unknown>)}`,
  )
}

export async function listAtlasToolEvidence(
  params: AtlasToolsEvidenceFilters = {},
): Promise<AtlasToolsEvidenceResponse> {
  return apiGet<AtlasToolsEvidenceResponse>(`/tools/evidence${queryString(params as Record<string, unknown>)}`)
}

export async function runAtlasTool(
  tool: string,
  input: AtlasToolRunInput,
): Promise<AtlasToolRunResponse> {
  return apiPost<AtlasToolRunResponse>(`/tools/${encodeURIComponent(tool)}/run`, input)
}

export async function fetchAtlasToolCommands(
  tool: string,
  params: { workspace?: string | null } = {},
): Promise<AtlasToolCommandsResponse> {
  return apiGet<AtlasToolCommandsResponse>(`/tools/${encodeURIComponent(tool)}/commands${queryString(params)}`)
}

export async function runAtlasToolRecipe(
  tool: string,
  recipe: string,
  input: AtlasToolRunRecipeInput = {},
): Promise<AtlasToolRunResponse> {
  return apiPost<AtlasToolRunResponse>(
    `/tools/${encodeURIComponent(tool)}/commands/${encodeURIComponent(recipe)}/run`,
    input,
  )
}

export async function listAtlasToolPolicies(
  params: { workspace?: string | null; limit?: number } = {},
): Promise<AtlasToolsPoliciesResponse> {
  return apiGet<AtlasToolsPoliciesResponse>(`/tools/policies${queryString(params)}`)
}

export async function approveAtlasTool(
  tool: string,
  input: AtlasToolApprovalInput = {},
): Promise<AtlasToolApprovalResponse> {
  return apiPost<AtlasToolApprovalResponse>(`/tools/${encodeURIComponent(tool)}/approval`, input)
}

export async function revokeAtlasToolApproval(
  tool: string,
  input: { workspace?: string | null; scope_type?: 'workspace' | 'global' | string } = {},
): Promise<AtlasToolApprovalResponse> {
  return apiDelete<AtlasToolApprovalResponse>(
    `/tools/${encodeURIComponent(tool)}/approval${queryString(input as Record<string, unknown>)}`,
  )
}

export async function evaluateAtlasToolGate(
  params: AtlasToolsGateFilters = {},
): Promise<AtlasToolsGateResponse> {
  return apiGet<AtlasToolsGateResponse>(`/tools/gate${queryString(params as Record<string, unknown>)}`)
}

export async function runEngineeringApiContract(
  input: AtlasEngineeringApiContractInput,
): Promise<AtlasEngineeringApiContractResponse> {
  return apiPost<AtlasEngineeringApiContractResponse>('/engineering/api-contract', input)
}

export async function fetchEngineeringKnowledge(
  params: { category?: string; status?: string; q?: string; include_archived?: boolean; limit?: number } = {},
): Promise<AtlasEngineeringKnowledgeResponse> {
  return apiGet<AtlasEngineeringKnowledgeResponse>(`/engineering/knowledge${queryString(params)}`)
}

export async function fetchEngineeringKnowledgeItem(
  item: string,
): Promise<AtlasEngineeringKnowledgeItemResponse> {
  return apiGet<AtlasEngineeringKnowledgeItemResponse>(`/engineering/knowledge/items/${encodeURIComponent(item)}`)
}

export async function fetchEngineeringKnowledgeContext(
  params: { category?: string; q?: string; limit?: number } = {},
): Promise<AtlasEngineeringKnowledgeContextResponse> {
  return apiGet<AtlasEngineeringKnowledgeContextResponse>(`/engineering/knowledge/context${queryString(params)}`)
}

export async function syncEngineeringKnowledge(
  input: { dry_run?: boolean; prune?: boolean } = {},
): Promise<AtlasEngineeringKnowledgeSyncResponse> {
  return apiPost<AtlasEngineeringKnowledgeSyncResponse>('/engineering/knowledge/sync', input)
}

export async function indexEngineeringCodeKnowledge(
  input: { workspace?: string | null; dry_run?: boolean; prune?: boolean } = {},
): Promise<AtlasEngineeringCodeIndexResponse> {
  return apiPost<AtlasEngineeringCodeIndexResponse>('/engineering/knowledge/code/index', input)
}

export async function fetchEngineeringCodeAudit(
  params: { workspace?: string | null; limit?: number } = {},
): Promise<AtlasEngineeringCodeAuditResponse> {
  return apiGet<AtlasEngineeringCodeAuditResponse>(`/engineering/knowledge/code/audit${queryString(params)}`)
}

export async function fetchEngineeringCodeModules(
  params: { layer?: string; docs_status?: string; q?: string; include_archived?: boolean; limit?: number } = {},
): Promise<AtlasEngineeringCodeModulesResponse> {
  return apiGet<AtlasEngineeringCodeModulesResponse>(`/engineering/knowledge/code/modules${queryString(params)}`)
}

export async function fetchEngineeringCodeSymbols(
  params: { module?: string; symbol_type?: string; language?: string; docs_status?: string; q?: string; include_archived?: boolean; limit?: number } = {},
): Promise<AtlasEngineeringCodeSymbolsResponse> {
  return apiGet<AtlasEngineeringCodeSymbolsResponse>(`/engineering/knowledge/code/symbols${queryString(params)}`)
}

export async function fetchEngineeringCodeModule(
  module: string,
): Promise<AtlasEngineeringCodeModuleResponse> {
  return apiGet<AtlasEngineeringCodeModuleResponse>(`/engineering/knowledge/code/modules/${encodeURIComponent(module)}`)
}

export async function listEngineeringBenchmarkSuites(
  params: { status?: string } = {},
): Promise<AtlasEngineeringBenchmarkSuitesResponse> {
  return apiGet<AtlasEngineeringBenchmarkSuitesResponse>(`/engineering/benchmarks/suites${queryString(params)}`)
}

export async function fetchEngineeringBenchmarkSuite(
  suite: string,
): Promise<AtlasEngineeringBenchmarkSuiteResponse> {
  return apiGet<AtlasEngineeringBenchmarkSuiteResponse>(`/engineering/benchmarks/suites/${encodeURIComponent(suite)}`)
}

export async function fetchEngineeringBenchmarkTrends(
  suite: string,
  params: { limit?: number; benchmark_key?: string; provider?: string } = {},
): Promise<AtlasEngineeringBenchmarkTrendsResponse> {
  return apiGet<AtlasEngineeringBenchmarkTrendsResponse>(`/engineering/benchmarks/suites/${encodeURIComponent(suite)}/trends${queryString(params)}`)
}

export async function fetchEngineeringFairClaudeReport(
  suite = 'atlas-fair-claude-v1',
  params: { limit?: number } = {},
): Promise<AtlasEngineeringFairClaudeReportResponse> {
  return apiGet<AtlasEngineeringFairClaudeReportResponse>(
    `/engineering/benchmarks/suites/${encodeURIComponent(suite)}/fair-claude-report${queryString(params)}`,
  )
}

export async function fetchAtlasStructureMotherAudit(
  params: { hours?: number; workspace?: string | null } = {},
): Promise<AtlasStructureMotherAuditResponse> {
  return apiGet<AtlasStructureMotherAuditResponse>(`/ai/structure-mother-audit${queryString(params)}`)
}

export async function replayAtlasMobilePush(
  input: AtlasMobilePushReplayInput = {},
): Promise<AtlasMobilePushReplayResponse> {
  return apiPost<AtlasMobilePushReplayResponse>('/ai/mobile/push/replay', input)
}

export async function prepareEngineeringFairClaudeBenchmark(
  input: { suite?: string | null; workspace?: string | null } = {},
): Promise<AtlasEngineeringBenchmarkSuiteResponse & {
  corpus_manifest?: Record<string, unknown>
  promoted_count?: number
  promoted_cases?: AtlasEngineeringBenchmarkCaseSummary[]
}> {
  return apiPost<AtlasEngineeringBenchmarkSuiteResponse & {
    corpus_manifest?: Record<string, unknown>
    promoted_count?: number
    promoted_cases?: AtlasEngineeringBenchmarkCaseSummary[]
  }>('/engineering/benchmarks/fair-claude/prepare', input)
}

export async function ensureDefaultEngineeringBenchmarkSuite(
  input: AtlasEngineeringBenchmarkDefaultSuiteInput = {},
): Promise<AtlasEngineeringBenchmarkSuiteResponse> {
  return apiPost<AtlasEngineeringBenchmarkSuiteResponse>('/engineering/benchmarks/suites/default', input)
}

export async function refreshEngineeringBenchmarkCorpus(
  suite: string,
): Promise<AtlasEngineeringBenchmarkSuiteResponse & { corpus_manifest?: Record<string, unknown> }> {
  return apiPost<AtlasEngineeringBenchmarkSuiteResponse & { corpus_manifest?: Record<string, unknown> }>(
    `/engineering/benchmarks/suites/${encodeURIComponent(suite)}/corpus/refresh`,
    {},
  )
}

export async function calibrateEngineeringBenchmarkSuite(
  suite: string,
  input: AtlasEngineeringBenchmarkCalibrationInput = {},
): Promise<AtlasEngineeringBenchmarkSuiteResponse & { rollout_calibration?: Record<string, unknown> }> {
  return apiPost<AtlasEngineeringBenchmarkSuiteResponse & { rollout_calibration?: Record<string, unknown> }>(
    `/engineering/benchmarks/suites/${encodeURIComponent(suite)}/calibrate`,
    input,
  )
}

export async function fetchEngineeringBenchmarkRun(
  runId: string,
): Promise<AtlasEngineeringBenchmarkRunResponse> {
  return apiGet<AtlasEngineeringBenchmarkRunResponse>(`/engineering/benchmarks/runs/${encodeURIComponent(runId)}`)
}

export async function recordEngineeringBenchmarkOutcome(
  runId: string,
  input: AtlasEngineeringBenchmarkOutcomeInput,
): Promise<AtlasEngineeringBenchmarkRunResponse> {
  return apiPatch<AtlasEngineeringBenchmarkRunResponse>(`/engineering/benchmarks/runs/${encodeURIComponent(runId)}/outcome`, input)
}

export async function runEngineeringBenchmarkSuite(
  suite: string,
  input: AtlasEngineeringBenchmarkRunInput,
): Promise<AtlasEngineeringBenchmarkRunResponse> {
  return apiPost<AtlasEngineeringBenchmarkRunResponse>(`/engineering/benchmarks/suites/${encodeURIComponent(suite)}/run`, input)
}

export async function planEngineeringRivalsBattery(
  suite: string,
  input: AtlasEngineeringRivalsBatteryPlanInput,
): Promise<AtlasEngineeringRivalsBatteryPlanResponse> {
  return apiPost<AtlasEngineeringRivalsBatteryPlanResponse>(
    `/engineering/benchmarks/suites/${encodeURIComponent(suite)}/rivals/battery-plan`,
    input,
  )
}

export async function promoteEngineeringRunToBenchmarkCase(
  suite: string,
  input: { run_id: string; title?: string; expected_decision?: string; status?: string; metadata?: Record<string, unknown> },
): Promise<{ case: AtlasEngineeringBenchmarkCaseSummary }> {
  return apiPost<{ case: AtlasEngineeringBenchmarkCaseSummary }>(
    `/engineering/benchmarks/suites/${encodeURIComponent(suite)}/cases/from-run`,
    input,
  )
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

export interface AiInteractionImageAttachmentInput {
  uri: string
  fileName: string
  mimeType: string
  size?: number | null
  width?: number | null
  height?: number | null
  source?: string | null
}

export interface AiInteractionFileAttachmentInput {
  uri: string
  fileName: string
  mimeType: string
  size?: number | null
  source?: string | null
}

export interface CreateAiInteractionInput {
  input_text: string
  client_id?: string
  thread_id?: string
  session_id?: string
  new_thread?: boolean
  agent_slug?: string
  provider?: AtlasAiProvider | string
  kind?: AtlasAiJob['kind']
  source_type?: string
  source_id?: string
  priority?: number
  include_semantic_context?: boolean
  context_note_limit?: number
  payload?: Record<string, unknown>
  image_attachments?: AiInteractionImageAttachmentInput[]
  file_attachments?: AiInteractionFileAttachmentInput[]
  on_upload_progress?: (progress: AiInteractionUploadProgress) => void
}

export interface AiInteractionUploadProgress {
  phase: 'starting' | 'uploading' | 'finalizing' | 'complete'
  fileName: string
  fileIndex: number
  fileCount: number
  sentBytes: number
  totalBytes: number
  percent: number
}

export async function createAiInteraction(input: CreateAiInteractionInput): Promise<{ trace: AtlasAiTrace }> {
  const imageAttachments = input.image_attachments ?? []
  const fileAttachments = input.file_attachments ?? []
  if (imageAttachments.length > 0 || fileAttachments.length > 0) {
    let chunkedUploadReady = false
    let uploadedImages: string[] = []
    let uploadedDocuments: string[] = []
    let totalBytes = 0
    const allUploads = [
      ...imageAttachments.map((attachment) => ({ kind: 'image' as const, attachment })),
      ...fileAttachments.map((attachment) => ({ kind: 'file' as const, attachment })),
    ]

    try {
      let uploadedBytesBefore = 0
      totalBytes = await totalAttachmentBytes(allUploads.map((item) => item.attachment))

      for (let index = 0; index < allUploads.length; index++) {
        const item = allUploads[index]
        const upload = await uploadAiAttachmentInChunks(
          item.attachment,
          item.kind,
          index,
          allUploads.length,
          totalBytes,
          uploadedBytesBefore,
          input.on_upload_progress,
        )
        uploadedBytesBefore += upload.bytes
        if (item.kind === 'image') uploadedImages.push(upload.id)
        else uploadedDocuments.push(upload.id)
      }

      chunkedUploadReady = true
    } catch {
      // Fallback: mantém compatibilidade em ambientes onde leitura em chunks
      // por file:// não está disponível. Erros da criação da interação não
      // entram aqui, para evitar reenviar anexos depois de um 4xx/5xx real.
    }

    if (chunkedUploadReady) {
      input.on_upload_progress?.({
        phase: 'finalizing',
        fileName: 'anexos',
        fileIndex: allUploads.length,
        fileCount: allUploads.length,
        sentBytes: totalBytes,
        totalBytes,
        percent: 1,
      })

      const {
        image_attachments: _imageAttachments,
        file_attachments: _fileAttachments,
        on_upload_progress: _onUploadProgress,
        ...jsonInput
      } = input

      // Slice 5b · rich_input_payload canon v1 (atlas.rich_input.payload.v1).
      // Forward-compat: backend hoje só consome uploaded_images/documents,
      // mas Forge/Dev futuros vão ler o manifest pra audit trail + dedup
      // por source_hash. Mobile não popula source_hash (custo CPU SHA-256
      // em iPhone) · backend pode preencher após processar.
      const richInputPayload = buildRichInputPayload({
        imageAttachments: imageAttachments,
        uploadedImageIds: uploadedImages,
        fileAttachments: fileAttachments,
        uploadedDocumentIds: uploadedDocuments,
        inputText: input.input_text,
      })

      const response = await apiPost<{ trace: AtlasAiTrace }>('/ai/interactions', {
        ...jsonInput,
        uploaded_images: uploadedImages,
        uploaded_documents: uploadedDocuments,
        rich_input_payload: richInputPayload,
      })

      input.on_upload_progress?.({
        phase: 'complete',
        fileName: 'anexos',
        fileIndex: allUploads.length,
        fileCount: allUploads.length,
        sentBytes: totalBytes,
        totalBytes,
        percent: 1,
      })

      return response
    }

    const form = new FormData()
    appendInteractionForm(form, 'input_text', input.input_text)
    appendInteractionForm(form, 'client_id', input.client_id)
    appendInteractionForm(form, 'thread_id', input.thread_id)
    appendInteractionForm(form, 'session_id', input.session_id)
    appendInteractionForm(form, 'new_thread', input.new_thread)
    appendInteractionForm(form, 'agent_slug', input.agent_slug)
    appendInteractionForm(form, 'provider', input.provider)
    appendInteractionForm(form, 'kind', input.kind)
    appendInteractionForm(form, 'source_type', input.source_type)
    appendInteractionForm(form, 'source_id', input.source_id)
    appendInteractionForm(form, 'priority', input.priority)
    appendInteractionForm(form, 'include_semantic_context', input.include_semantic_context)
    appendInteractionForm(form, 'context_note_limit', input.context_note_limit)
    appendInteractionForm(form, 'payload', JSON.stringify(input.payload ?? {}))
    appendInteractionForm(form, 'rich_input_payload', JSON.stringify(buildRichInputPayload({
      imageAttachments: imageAttachments,
      uploadedImageIds: [],
      fileAttachments: fileAttachments,
      uploadedDocumentIds: [],
      inputText: input.input_text,
    })))

    imageAttachments.forEach((attachment, index) => {
      form.append('images[]', {
        uri: attachment.uri,
        name: attachment.fileName || `atlas-image-${index + 1}.png`,
        type: attachment.mimeType || 'image/png',
      } as unknown as Blob)
    })

    fileAttachments.forEach((attachment, index) => {
      form.append('documents[]', {
        uri: attachment.uri,
        name: attachment.fileName || `atlas-file-${index + 1}`,
        type: attachment.mimeType || 'application/octet-stream',
      } as unknown as Blob)
    })

    return apiUpload<{ trace: AtlasAiTrace }>('/ai/interactions', form)
  }

  const {
    image_attachments: _imageAttachments,
    file_attachments: _fileAttachments,
    ...jsonInput
  } = input
  const richInputPayload = buildRichInputPayload({
    imageAttachments: [],
    uploadedImageIds: [],
    fileAttachments: [],
    uploadedDocumentIds: [],
    inputText: input.input_text,
  })
  const hasRichInputPayload = richInputPayload.url_attachments.length > 0
    || richInputPayload.source_manifest.length > 0
    || richInputPayload.text_blocks.length > 0

  return apiPost<{ trace: AtlasAiTrace }>('/ai/interactions', {
    ...jsonInput,
    ...(hasRichInputPayload ? { rich_input_payload: richInputPayload } : {}),
  })
}

export function streamAiInteraction(
  traceId: string,
  handlers: {
    onEvent?: (event: AtlasAiStreamEvent) => void
    onDone?: (event: AtlasAiStreamDone) => void
    onError?: (error: unknown) => void
  },
  options: {
    after?: number
    timeoutSeconds?: number
    maxReconnects?: number
  } = {},
): { cancel: () => void } {
  return createAtlasAiInteractionStream({
    traceId,
    handlers,
    options,
    prepare: hydrateApiConfig,
    getApiBase,
    getAuthHeaders: getAtlasAuthHeaders,
    createHttpError: (status, url) => new AtlasApiError(`Atlas stream ${status}`, status, url, null),
  })
}

const AI_UPLOAD_CHUNK_BYTES = 768 * 1024

async function uploadAiAttachmentInChunks(
  attachment: AiInteractionImageAttachmentInput | AiInteractionFileAttachmentInput,
  kind: 'image' | 'file',
  index: number,
  fileCount: number,
  aggregateTotalBytes: number,
  aggregateUploadedBefore: number,
  onProgress?: (progress: AiInteractionUploadProgress) => void,
): Promise<{ id: string; bytes: number }> {
  const info = await FileSystem.getInfoAsync(attachment.uri)
  const bytes = typeof attachment.size === 'number'
    ? attachment.size
    : (info.exists && typeof info.size === 'number' ? info.size : 0)
  if (bytes <= 0) throw new Error('Arquivo local sem tamanho para upload em chunks.')

  const fileName = attachment.fileName || (kind === 'image' ? `atlas-image-${index + 1}.png` : `atlas-file-${index + 1}`)
  onProgress?.({
    phase: 'starting',
    fileName,
    fileIndex: index + 1,
    fileCount,
    sentBytes: aggregateUploadedBefore,
    totalBytes: aggregateTotalBytes,
    percent: aggregateTotalBytes > 0 ? aggregateUploadedBefore / aggregateTotalBytes : 0,
  })

  const start = await apiPost<{
    upload: { id: string; received_chunks?: number[] }
  }>('/ai/uploads/chunks/start', {
    client_upload_id: `${kind}-${stableUploadKey(attachment.uri, fileName, bytes)}`,
    kind,
    file_name: fileName,
    mime_type: attachment.mimeType || 'application/octet-stream',
    total_bytes: bytes,
    source: attachment.source ?? 'app',
  })
  const uploadId = start.upload.id
  const received = new Set(start.upload.received_chunks ?? [])
  const totalChunks = Math.ceil(bytes / AI_UPLOAD_CHUNK_BYTES)
  let uploadedForFile = 0

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const offset = chunkIndex * AI_UPLOAD_CHUNK_BYTES
    const chunkBytes = Math.min(AI_UPLOAD_CHUNK_BYTES, bytes - offset)
    if (!received.has(chunkIndex)) {
      const chunkBase64 = await FileSystem.readAsStringAsync(attachment.uri, {
        encoding: FileSystem.EncodingType.Base64,
        position: offset,
        length: chunkBytes,
      })
      // Resilience: chunked upload POST não tem Idempotency-Key, então o
      // retry built-in do apiRequest não dispara. withRetry adiciona 3
      // tentativas com backoff exponencial (280/560/1120ms) idênticas ao
      // canon desktop. base64 é computada UMA vez fora do retry · retry
      // reusa o mesmo payload.
      await withRetry(() =>
        apiPost(`/ai/uploads/chunks/${encodeURIComponent(uploadId)}/chunk`, {
          index: chunkIndex,
          total_chunks: totalChunks,
          offset,
          bytes: chunkBytes,
          chunk_base64: chunkBase64,
        }),
      )
    }

    uploadedForFile += chunkBytes
    const sentBytes = Math.min(aggregateTotalBytes, aggregateUploadedBefore + uploadedForFile)
    onProgress?.({
      phase: 'uploading',
      fileName,
      fileIndex: index + 1,
      fileCount,
      sentBytes,
      totalBytes: aggregateTotalBytes,
      percent: aggregateTotalBytes > 0 ? sentBytes / aggregateTotalBytes : 0,
    })
  }

  const complete = await apiPost<{
    upload: { id: string; bytes?: number | null }
  }>(`/ai/uploads/chunks/${encodeURIComponent(uploadId)}/complete`, {})

  return {
    id: complete.upload.id,
    bytes: typeof complete.upload.bytes === 'number' ? complete.upload.bytes : bytes,
  }
}

function stableUploadKey(uri: string, fileName: string, bytes: number): string {
  const input = `${uri}|${fileName}|${bytes}`
  let hash = 2166136261
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `${Math.abs(hash >>> 0).toString(36)}-${bytes.toString(36)}`
}

async function totalAttachmentBytes(attachments: Array<AiInteractionImageAttachmentInput | AiInteractionFileAttachmentInput>): Promise<number> {
  let total = 0
  for (const attachment of attachments) {
    if (typeof attachment.size === 'number' && attachment.size > 0) {
      total += attachment.size
      continue
    }
    try {
      const info = await FileSystem.getInfoAsync(attachment.uri)
      if (info.exists && typeof info.size === 'number') total += info.size
    } catch {}
  }
  return total
}

export async function listAiInteractions(params: {
  thread_id?: string
  status?: AtlasAiStatus
  agent?: string
  client_id?: string
  limit?: number
} = {}): Promise<AiInteractionsResponse> {
  return apiGet<AiInteractionsResponse>(`/ai/interactions${queryString(params)}`)
}

export async function listAiDecisions(params: {
  trace_id?: string
  provider?: AtlasAiProvider | string
  decision_mode?: 'atlas_decide' | 'manual_override' | string
  task_type?: string
  limit?: number
} = {}): Promise<{ decisions: AtlasAiDecision[] }> {
  return apiGet<{ decisions: AtlasAiDecision[] }>(`/ai/decisions${queryString(params)}`)
}

export async function previewAiDecision(input: {
  input_text: string
  provider?: AtlasAiProvider | 'auto' | string | null
  model?: string | null
  source_type?: string | null
  agent_slug?: string | null
  mode?: string | null
  payload?: Record<string, unknown>
}): Promise<{ decision: AtlasAiDecisionReceipt }> {
  return apiPost<{ decision: AtlasAiDecisionReceipt }>('/ai/decisions/preview', input)
}

export async function searchAiAttachments(input: {
  query: string
  thread_id?: string | null
  limit?: number
}): Promise<AtlasAiAttachmentSearchResponse> {
  return apiPost<AtlasAiAttachmentSearchResponse>('/ai/attachments/search', input)
}

export async function listAiThreads(params: {
  status?: 'active' | 'archived' | 'closed' | 'all'
  surface?: string
  workspace?: string
  include_messages?: boolean
  limit?: number
  // 2026-05 · light=true omite relations pesadas (activeSession, activeState,
  // latestCompaction, latestProviderHandoff, lastTrace). Payload cai ~80×
  // (1.2MB → ~15KB pra 10 threads). Use no histórico — só precisa de
  // id/title/meta pra listar. Mobile inicial deve sempre passar true.
  light?: boolean
} = {}): Promise<AiThreadsResponse> {
  return apiGet<AiThreadsResponse>(`/ai/threads${queryString(params)}`)
}

export async function listAtlasWorkspaceProfiles(): Promise<AtlasWorkspaceProfileListResponse> {
  return apiGet<AtlasWorkspaceProfileListResponse>('/atlas-code/projects/workspaces')
}

export async function createAtlasWorkspaceProfile(input: AtlasWorkspaceProfileCreateInput): Promise<AtlasWorkspaceProfileMutationResponse> {
  return apiPost<AtlasWorkspaceProfileMutationResponse>('/atlas-code/projects/workspaces', input)
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

export async function deleteAiThread(id: string): Promise<{
  ok: boolean
  deleted_thread_id: string
  deletion: {
    content_purged: boolean
    traces_tombstoned: number
  }
}> {
  return apiDelete<{
    ok: boolean
    deleted_thread_id: string
    deletion: {
      content_purged: boolean
      traces_tombstoned: number
    }
  }>(`/ai/threads/${encodeURIComponent(id)}`)
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

export async function resumeAiJobChoice(
  jobId: string,
  optionId: string,
): Promise<{ job: AtlasAiJob }> {
  return apiRequest<{ job: AtlasAiJob }>(
    `/ai/jobs/${encodeURIComponent(jobId)}/resume-choice`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ option_id: optionId }),
    },
  )
}

export async function getAiProvidersStatus(): Promise<AiProvidersStatusResponse> {
  return apiGet<AiProvidersStatusResponse>('/ai/providers/status')
}

export async function getAiPolicyProfiles(): Promise<AtlasAiPolicyProfilesResponse> {
  return apiGet<AtlasAiPolicyProfilesResponse>('/ai/policies/profiles')
}

export async function getAiDomainCatalog(params: AtlasAiDomainCatalogParams = {}): Promise<AtlasAiDomainCatalogResponse> {
  return apiGet<AtlasAiDomainCatalogResponse>(`/ai/domains${queryString(params as Record<string, unknown>)}`)
}

export async function previewAiPolicy(input: AtlasAiPolicyPreviewInput): Promise<AtlasAiPolicyPreviewResponse> {
  return apiPost<AtlasAiPolicyPreviewResponse>('/ai/policies/preview', input)
}

export async function updateAiDomainProfile(
  domainId: string,
  input: AtlasAiDomainProfilePatch,
): Promise<AtlasAiDomainProfileUpdateResponse> {
  return apiPatch<AtlasAiDomainProfileUpdateResponse>(`/ai/policies/domains/${encodeURIComponent(domainId)}`, input)
}

export async function updateAiFlowProfile(
  flowId: string,
  input: AtlasAiFlowProfilePatch,
): Promise<AtlasAiFlowProfileUpdateResponse> {
  return apiPatch<AtlasAiFlowProfileUpdateResponse>(`/ai/policies/flows/${encodeURIComponent(flowId)}`, input)
}

export async function updateAiProviderSettings(input: AtlasAiRuntimeSettingsPatch): Promise<AiProvidersStatusResponse> {
  return apiPatch<AiProvidersStatusResponse>('/ai/providers/settings', input)
}

export async function checkAiProviders(): Promise<{ providers: AtlasAiProviderHealth[] }> {
  return apiPost('/ai/providers/check', {})
}

export async function getAiObservability(params: {
  hours?: number
} = {}): Promise<AiObservabilityResponse> {
  return apiGet<AiObservabilityResponse>(`/ai/observability${queryString(params)}`)
}

export async function postAiTelemetryEvents(
  events: AtlasAiTelemetryEventInput[],
): Promise<AtlasAiTelemetryBatchResponse> {
  await hydrateApiConfig()
  const payload = { events }

  return getMobileDeviceSession()
    ? mobileApiPost<AtlasAiTelemetryBatchResponse>('/v1/mobile/telemetry/events', payload)
    : apiPost<AtlasAiTelemetryBatchResponse>('/ai/telemetry/events', payload)
}

export async function getAiTelemetryScorecard(params: {
  hours?: number
  recompute?: boolean
} = {}): Promise<AtlasAiTelemetryScorecardResponse> {
  return apiGet<AtlasAiTelemetryScorecardResponse>(`/ai/telemetry/scorecard${queryString(params)}`)
}

export async function getAiTelemetryHealth(params: {
  hours?: number
  recompute?: boolean
  emit?: boolean
} = {}): Promise<{ health: AtlasAiTelemetryHealth; insight: { emitted: boolean; item_id: string | null; reason: string }; recomputed: number | null }> {
  return apiGet<{ health: AtlasAiTelemetryHealth; insight: { emitted: boolean; item_id: string | null; reason: string }; recomputed: number | null }>(`/ai/telemetry/health${queryString(params)}`)
}

export async function listAiProviderCostRates(params: {
  provider?: string
  model?: string
  active?: boolean
  limit?: number
} = {}): Promise<{ available: boolean; rates: AtlasAiProviderCostRate[] }> {
  return apiGet<{ available: boolean; rates: AtlasAiProviderCostRate[] }>(`/ai/telemetry/cost-rates${queryString(params)}`)
}

export async function listMissingAiProviderCostRates(params: {
  hours?: number
  limit?: number
} = {}): Promise<{ available: boolean; missing_rates: AtlasAiMissingCostRate[] }> {
  return apiGet<{ available: boolean; missing_rates: AtlasAiMissingCostRate[] }>(`/ai/telemetry/cost-rates/missing${queryString(params)}`)
}

export async function upsertAiProviderCostRate(input: {
  provider: string
  model: string
  input_microusd_per_1k: number
  output_microusd_per_1k: number
  currency?: string
  effective_from?: string
  effective_until?: string
  metadata?: Record<string, unknown>
}): Promise<{ rate: AtlasAiProviderCostRate }> {
  return apiPost<{ rate: AtlasAiProviderCostRate }>('/ai/telemetry/cost-rates', input)
}

export async function recordAiOutcome(input: {
  trace_id?: string | null
  thread_id?: string | null
  session_id?: string | null
  outcome_type: string
  target_type?: string | null
  target_id?: string | null
  value_score?: number | null
  confidence?: number | null
  source?: string
  occurred_at?: string
  metadata?: Record<string, unknown>
}): Promise<{ outcome: AtlasAiOutcomeLink | null }> {
  return apiPost<{ outcome: AtlasAiOutcomeLink | null }>('/ai/telemetry/outcomes', input)
}

export async function listAiOutcomes(params: {
  trace_id?: string
  thread_id?: string
  outcome_type?: string
  limit?: number
} = {}): Promise<{ available: boolean; outcomes: AtlasAiOutcomeLink[] }> {
  return apiGet<{ available: boolean; outcomes: AtlasAiOutcomeLink[] }>(`/ai/telemetry/outcomes${queryString(params)}`)
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

export async function listAtlasMemoryReviewQueue(params: {
  area?: 'memory' | 'verbatim' | 'relations' | 'memory_privacy' | 'verbatim_privacy' | 'relation'
  scope_type?: string
  scope_id?: string
  project_id?: string
  task_id?: string
  engineering_run_id?: string
  privacy_class?: string
  relation_status?: string
  include_unreviewed?: boolean
  include_inactive?: boolean
  limit?: number
} = {}): Promise<AtlasMemoryReviewQueueResponse> {
  return apiGet<AtlasMemoryReviewQueueResponse>(`/ai/memory/review-queue${queryString(params)}`)
}

export async function recallAtlasMemory(input: {
  query: string
  context?: Record<string, unknown>
  filters?: Record<string, unknown>
  options?: Record<string, unknown>
}): Promise<AtlasMemoryRecallResponse> {
  return apiPost<AtlasMemoryRecallResponse>('/ai/memory/recall', input)
}

export async function buildAtlasOpenBrainContextPack(input: {
  objective: string
  workspace?: string
  task_type?: 'direct' | 'dev' | 'debug' | 'review' | 'research' | 'decision' | 'memory'
  desired_mode?: string
  agent?: string
  intent?: string
  requester?: string
  include_prompt?: boolean
  payload?: Record<string, unknown>
  options?: Record<string, unknown>
}): Promise<AtlasOpenBrainContextPackResponse> {
  return apiPost<AtlasOpenBrainContextPackResponse>('/ai/open-brain/context-pack', input)
}

export async function listAtlasOpenBrainAudits(params: { limit?: number } = {}): Promise<AtlasOpenBrainAuditsResponse> {
  return apiGet<AtlasOpenBrainAuditsResponse>(`/ai/open-brain/audits${queryString(params)}`)
}

export async function getAtlasMemoryQuality(params: {
  workspace?: string
  type?: string[]
  scope_type?: string
  scope_id?: string
  project_id?: string
  task_id?: string
  engineering_run_id?: string
  source_type?: string
  status?: string
} = {}): Promise<AtlasMemoryQualityResponse> {
  return apiGet<AtlasMemoryQualityResponse>(`/ai/memory/quality${queryString(params)}`)
}

export async function getAtlasMemoryQualityHistory(params: {
  workspace?: string
  days?: number
  limit?: number
  status?: string
  source_type?: string
} = {}): Promise<AtlasMemoryQualityHistoryResponse> {
  return apiGet<AtlasMemoryQualityHistoryResponse>(`/ai/memory/quality/history${queryString(params)}`)
}

export async function runAtlasMemoryMaintenance(input: {
  workspace?: string
  dry_run?: boolean
  sync?: boolean
  index_code?: boolean
  prune?: boolean
  include_drift_audit?: boolean
  apply_projection?: boolean
  confirm?: boolean
}): Promise<AtlasMemoryMaintenanceResponse> {
  return apiPost<AtlasMemoryMaintenanceResponse>('/ai/memory/maintain', input)
}

export async function getAtlasMemoryProviderProjectionStatus(
  params: AtlasMemoryProviderProjectionParams = {},
): Promise<AtlasMemoryProviderProjectionResponse> {
  return apiGet<AtlasMemoryProviderProjectionResponse>(`/ai/memory/provider-projection/status${queryString({ ...params })}`)
}

export async function reviewAtlasMemoryProviderProjection(
  params: AtlasMemoryProviderProjectionParams = {},
): Promise<AtlasMemoryProviderProjectionResponse> {
  return apiGet<AtlasMemoryProviderProjectionResponse>(`/ai/memory/provider-projection/review${queryString({ ...params })}`)
}

export async function applyAtlasMemoryProviderProjection(
  input: ApplyAtlasMemoryProviderProjectionInput,
): Promise<AtlasMemoryProviderProjectionResponse> {
  return apiPost<AtlasMemoryProviderProjectionResponse>('/ai/memory/provider-projection/apply', input)
}

export async function listAtlasMemoryProviderProjectionAudits(
  params: AtlasMemoryProviderProjectionAuditParams = {},
): Promise<AtlasMemoryProviderProjectionAuditsResponse> {
  return apiGet<AtlasMemoryProviderProjectionAuditsResponse>(`/ai/memory/provider-projection/audits${queryString({ ...params })}`)
}

export async function summarizeAtlasMemoryProviderProjectionAudits(
  params: AtlasMemoryProviderProjectionAuditSummaryParams = {},
): Promise<AtlasMemoryProviderProjectionAuditSummaryResponse> {
  return apiGet<AtlasMemoryProviderProjectionAuditSummaryResponse>(`/ai/memory/provider-projection/audits/summary${queryString({ ...params })}`)
}

export async function purgeAtlasMemoryProviderProjectionAudits(
  input: PurgeAtlasMemoryProviderProjectionAuditInput,
): Promise<AtlasMemoryProviderProjectionAuditPurgeResponse> {
  return apiPost<AtlasMemoryProviderProjectionAuditPurgeResponse>('/ai/memory/provider-projection/audits/purge', input)
}

export async function getAtlasMemoryEntry(id: string): Promise<{ memory: AtlasMemoryRegistryEntry }> {
  return apiGet<{ memory: AtlasMemoryRegistryEntry }>(`/ai/memory/${encodeURIComponent(id)}`)
}

export async function reviewAtlasMemoryPrivacy(
  id: string,
  input: {
    privacy_class?: string
    external_ai_allowed?: boolean
    redacted_title?: string | null
    redacted_body?: string | null
    redacted_summary?: string | null
    reviewed_by?: string
    review_note?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<{ memory: AtlasMemoryRegistryEntry }> {
  return apiPost(`/ai/memory/${encodeURIComponent(id)}/privacy`, input)
}

export async function reviewAtlasVerbatimMemory(
  id: string,
  input: {
    privacy_class?: string
    external_ai_allowed?: boolean
    redacted_text?: string | null
    summary?: string | null
    status?: string
    re_redact?: boolean
    reviewed_by?: string
    review_action?: string
    review_note?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<{ verbatim_memory: AtlasVerbatimMemoryEntry }> {
  return apiPost(`/ai/memory/verbatim/${encodeURIComponent(id)}/review`, input)
}

export async function getAtlasVerbatimMemory(
  id: string,
  params: { include_verbatim?: boolean } = {},
): Promise<{ verbatim_memory: AtlasVerbatimMemoryEntry }> {
  return apiGet<{ verbatim_memory: AtlasVerbatimMemoryEntry }>(`/ai/memory/verbatim/${encodeURIComponent(id)}${queryString(params)}`)
}

export async function reviewAtlasMemoryRelation(
  id: string,
  input: {
    status: 'open' | 'resolved' | 'dismissed'
    source_status?: string | null
    target_status?: string | null
    resolution_action?: string | null
    reviewed_by?: string
    review_note?: string | null
    reason?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<{ relation: Record<string, unknown> }> {
  return apiPost(`/ai/memory/relations/${encodeURIComponent(id)}/review`, input)
}

export async function apiGet<T>(
  path: string,
  opts: { auth?: boolean; etag?: boolean } = {},
): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' }, opts)
}

export async function mobileApiGet<T>(
  path: string,
  opts: { timeoutMs?: number; retry?: boolean } = {},
): Promise<T> {
  return mobileApiRequest<T>(path, { method: 'GET' }, opts)
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

export async function mobileApiDelete<T>(path: string): Promise<T> {
  return mobileApiRequest<T>(path, { method: 'DELETE' })
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

const DEFAULT_FETCH_TIMEOUT_MS = 15_000
const UPLOAD_FETCH_TIMEOUT_MS = 120_000

// --- GET ETag/304 conditional cache ------------------------------------------
// The backend serves an ETag (a deterministic surface hash over the body minus
// volatile fields like generated_at) plus a 304 branch when nothing real
// changed. Without honoring it, every poll re-downloads + re-parses a fresh body
// = a brand-new object reference each tick, which defeats react-query structural
// sharing and makes the UI blink. This cache makes GET conditional:
//   • on a GET with a cached ETag we send `If-None-Match`;
//   • a 304 returns the PREVIOUSLY-PARSED payload BY REFERENCE (no re-parse, so
//     the reference is stable → structural sharing keeps it → no re-render);
//   • a 200 stores the response ETag + parsed payload for next time.
// It is purely additive and self-gating: endpoints that don't emit an ETag never
// get a cache entry and never receive an `If-None-Match`, so their behavior is
// byte-identical to before. Only the operator-token GET surfaces that serve an
// ETag (the Loop command read models today) take the fast path. The cache is
// keyed by the absolute request URL (which already carries auth scope via path +
// query) and is bounded with simple LRU eviction so it can't grow unbounded in a
// long-lived session.
interface EtagCacheEntry {
  etag: string
  payload: unknown
}

const ETAG_CACHE = new Map<string, EtagCacheEntry>()
const ETAG_CACHE_MAX_ENTRIES = 64

function etagCacheGet(url: string): EtagCacheEntry | undefined {
  const hit = ETAG_CACHE.get(url)
  if (hit === undefined) return undefined
  // Touch for LRU recency: delete + re-set moves it to the end of the Map.
  ETAG_CACHE.delete(url)
  ETAG_CACHE.set(url, hit)
  return hit
}

function etagCacheSet(url: string, entry: EtagCacheEntry): void {
  if (ETAG_CACHE.has(url)) ETAG_CACHE.delete(url)
  ETAG_CACHE.set(url, entry)
  while (ETAG_CACHE.size > ETAG_CACHE_MAX_ENTRIES) {
    const oldest = ETAG_CACHE.keys().next().value
    if (oldest === undefined) break
    ETAG_CACHE.delete(oldest)
  }
}

function fetchBackoffMs(attempt: number): number {
  return Math.min(200 * 2 ** attempt, 1400)
}

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function executeFetch(
  url: string,
  init: RequestInit,
  options: { timeoutMs?: number; retry?: boolean } = {},
): Promise<Response> {
  const headers = new Headers(init.headers ?? {})
  const method = (init.method ?? 'GET').toUpperCase()
  const isUpload = init.body instanceof FormData
  const timeoutMs = options.timeoutMs ?? (isUpload ? UPLOAD_FETCH_TIMEOUT_MS : DEFAULT_FETCH_TIMEOUT_MS)
  const safeMethods = method === 'GET' || method === 'HEAD'
  const hasIdempotencyKey = headers.has('Idempotency-Key')
  const shouldRetry = options.retry ?? (safeMethods || hasIdempotencyKey)
  const maxAttempts = shouldRetry ? 3 : 1

  // Se o caller passou um signal externo, encadeamos com o nosso de timeout:
  // qualquer um dos dois aborta o fetch. Hoje nenhum caller usa, mas evita
  // armadilha futura de signal silenciosamente sobrescrito.
  const externalSignal = (init as RequestInit & { signal?: AbortSignal }).signal ?? null

  let lastError: unknown = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onExternalAbort = () => controller.abort()
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort()
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true })
    }
    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onExternalAbort)
      if (response.status >= 500 && response.status <= 599 && attempt < maxAttempts - 1) {
        // Drena o body e preserva payload pro caso de TODAS as tentativas
        // falharem — caller terá a mensagem real do servidor.
        let errorPayload: unknown = null
        try {
          const text = await response.text()
          if (text) {
            try { errorPayload = JSON.parse(text) } catch { errorPayload = text }
          }
        } catch {
          // body já consumido / stream falhou: nada a fazer.
        }
        lastError = new AtlasApiError(
          errorMessage(url, response.status, errorPayload),
          response.status,
          url,
          errorPayload,
        )
        await delayMs(fetchBackoffMs(attempt))
        continue
      }
      return response
    } catch (error) {
      clearTimeout(timer)
      externalSignal?.removeEventListener('abort', onExternalAbort)
      lastError = error
      if (attempt < maxAttempts - 1) {
        await delayMs(fetchBackoffMs(attempt))
        continue
      }
      throw error
    }
  }
  throw lastError ?? new AtlasApiError('Atlas API request failed', 0, url, null)
}

async function apiRequest<T>(
  path: string,
  init: RequestInit,
  opts: { auth?: boolean; timeoutMs?: number; retry?: boolean; etag?: boolean } = {},
): Promise<T> {
  await hydrateApiConfig()

  const headers = new Headers(init.headers)
  if (opts.auth !== false) {
    headers.set('X-Atlas-Token', getBackendToken())
  }

  const url = `${getApiBase()}${path}`
  const method = (init.method ?? 'GET').toUpperCase()

  // Conditional GET — OPT-IN (opts.etag). Default-off so every existing caller is
  // byte-identical: only callers that ask for it (the Loop read models, whose
  // backend serves ETag + 304) participate, keeping blast radius to that surface
  // while concurrent work touches other screens. When on: if we hold a cached
  // ETag for this exact URL, send `If-None-Match`; a 304 means the body is
  // byte-identical to what we already parsed, so we hand back the SAME reference
  // (stable identity → react-query keeps it → no per-poll blink). A caller-supplied
  // If-None-Match is never overridden.
  const conditional = opts.etag === true && method === 'GET'
  const isConditionalGet = conditional && !headers.has('If-None-Match')
  const cached = isConditionalGet ? etagCacheGet(url) : undefined
  if (cached !== undefined) headers.set('If-None-Match', cached.etag)

  const response = await executeFetch(
    url,
    { ...init, headers },
    { timeoutMs: opts.timeoutMs, retry: opts.retry },
  )

  if (response.status === 304 && cached !== undefined) {
    // Drain to free the connection; the body is empty by spec. Return cached ref.
    void response.text().catch(() => undefined)
    return cached.payload as T
  }

  const text = await response.text()
  const payload = text ? parsePayload(text) : null

  if (!response.ok) {
    const message = errorMessage(path, response.status, payload)
    throw new AtlasApiError(message, response.status, path, payload)
  }

  // Store/refresh the conditional-GET cache when the server advertises an ETag.
  // Only for opt-in GETs (self-gating twice over): no opt-in ⇒ no cache entry.
  if (conditional) {
    const etag = response.headers.get('ETag')
    if (etag !== null && etag !== '') {
      etagCacheSet(url, { etag, payload })
    }
  }

  return payload as T
}

async function mobileApiRequest<T>(
  path: string,
  init: RequestInit,
  opts: { timeoutMs?: number; retry?: boolean } = {},
): Promise<T> {
  await hydrateApiConfig()

  if (!cachedMobileDeviceToken) {
    throw new AtlasApiError('Atlas mobile ainda nao esta pareado.', 401, path, null)
  }

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${cachedMobileDeviceToken}`)

  const response = await executeFetch(
    `${getApiBase()}${path}`,
    { ...init, headers },
    { timeoutMs: opts.timeoutMs, retry: opts.retry },
  )

  const text = await response.text()
  const payload = text ? parsePayload(text) : null

  if (!response.ok) {
    const message = errorMessage(path, response.status, payload)
    // Single source of truth for "server doesn't accept our mobile bearer":
    // any 401 on a mobile-bearer endpoint means the device record is gone
    // (revoked, deleted, banco resetado, build apontando pra outro server).
    // Clear local session atomically so callers never observe a "pareado
    // localmente mas rejeitado pelo servidor" estado fantasma. Idempotent —
    // safe to invoke from anywhere.
    if (response.status === 401) {
      await clearMobileDeviceSession()
    }
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
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error: unknown }).error
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as { message: unknown }).message)
    }
  }
  if (payload && typeof payload === 'object' && 'errors' in payload) {
    const errors = (payload as { errors: unknown }).errors
    if (errors && typeof errors === 'object') {
      const first = Object.values(errors as Record<string, unknown>)[0]
      if (Array.isArray(first) && first[0]) return String(first[0])
      if (typeof first === 'string') return first
    }
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

  // Booleans · Laravel `boolean` validate aceita 1/0/true/false mas
  // REJEITA "true"/"false" como string. String(true) = "true" (422).
  // Solução universal: serializar boolean como "1"/"0" sempre.
  if (typeof value === 'boolean') {
    return value ? '1' : '0'
  }

  return String(value)
}

function appendForm(form: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null || value === '') return
  form.append(key, String(value))
}

function appendInteractionForm(form: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null || value === '') return
  if (typeof value === 'boolean') {
    form.append(key, value ? '1' : '0')
    return
  }
  form.append(key, String(value))
}

async function readStoredToken(): Promise<string | null> {
  try {
    const secureToken = await SecureStore.getItemAsync(TOKEN_KEY)
    if (secureToken) return secureToken
  } catch {
    // SecureStore can be unavailable in a non-native runtime; legacy storage remains a fallback.
  }

  return atlasStorage.getItem(TOKEN_KEY)
}

async function writeStoredToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    await atlasStorage.removeItem(TOKEN_KEY)
  } catch {
    await atlasStorage.setItem(TOKEN_KEY, token)
  }
}

async function readStoredMobileDeviceToken(): Promise<string | null> {
  try {
    const secureToken = await SecureStore.getItemAsync(MOBILE_TOKEN_KEY)
    if (secureToken) return secureToken
  } catch {
    // SecureStore can be unavailable in a non-native runtime; AsyncStorage remains a fallback.
  }

  return atlasStorage.getItem(MOBILE_TOKEN_KEY)
}

async function writeStoredMobileDeviceToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(MOBILE_TOKEN_KEY, token)
    await atlasStorage.removeItem(MOBILE_TOKEN_KEY)
    return
  } catch {
    // SecureStore can be unavailable in non-native runtimes; MMKV/memory remains a fallback.
  }

  await atlasStorage.setItem(MOBILE_TOKEN_KEY, token)
}

async function removeStoredMobileDeviceToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(MOBILE_TOKEN_KEY)
  } catch {
    // Ignore SecureStore removal failures and still clear the fallback key.
  }

  await atlasStorage.removeItem(MOBILE_TOKEN_KEY)
}

async function readStoredMobileDeviceId(): Promise<string | null> {
  try {
    const secureDeviceId = await SecureStore.getItemAsync(MOBILE_DEVICE_ID_KEY)
    if (secureDeviceId) return secureDeviceId
  } catch {
    // SecureStore can be unavailable in a non-native runtime; storage remains a fallback.
  }

  return atlasStorage.getItem(MOBILE_DEVICE_ID_KEY)
}

async function writeStoredMobileDeviceId(deviceId: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(MOBILE_DEVICE_ID_KEY, deviceId)
  } catch {
    // Device id is not secret; durable storage is still attempted below.
  }

  await atlasStorage.setItem(MOBILE_DEVICE_ID_KEY, deviceId)
}

async function removeStoredMobileDeviceId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(MOBILE_DEVICE_ID_KEY)
  } catch {
    // Ignore SecureStore removal failures and still clear the fallback key.
  }

  await atlasStorage.removeItem(MOBILE_DEVICE_ID_KEY)
}

function currentMobileDevice(response: MobileDevicesResponse): AtlasMobileDevice | null {
  if (response.current_device?.id) return response.current_device
  if (response.current_device_id) {
    const byId = response.devices.find((device) => device.id === response.current_device_id)
    if (byId) return byId
  }

  return response.devices.find((device) => !device.revoked_at) ?? null
}

// Atlas Loop Command Surface · re-exported so callers keep importing from `lib/api/client`
// (the same surface every sibling lib module uses) while the implementation lives in its own
// `loopClient` file. loopClient depends only on the apiGet/apiPost defined above; this barrel
// re-export is evaluated after they exist, so there is no init-order hazard.
export {
  ATLAS_LOOP_DEFAULT_AREA,
  ATLAS_LOOP_DEFAULT_FOCUS,
  ATLAS_LOOP_DEFAULT_PORTFOLIO,
  fetchAtlasLoopLive,
  fetchAtlasLoopCycles,
  submitAtlasLoopOperatorDecision,
  submitAtlasLoopRunControl,
  sendAtlasLoopDirective,
} from './loopClient'
export type {
  AtlasLoopCycleOutcome,
  AtlasLoopWorkClass,
  AtlasLoopOperatorDecision,
  AtlasLoopRiskLevel,
  AtlasLoopRunControlAction,
  AtlasLoopLockHolder,
  AtlasLoopLockStatus,
  AtlasLoopSignalStatus,
  AtlasLoopStewardshipRecovery,
  AtlasLoopSchedulerCycleSummary,
  AtlasLoopSchedulerBacklog,
  AtlasLoopRunState,
  AtlasLoopCockpitHealth,
  AtlasLoop24hObservability,
  AtlasLoopCockpit,
  AtlasLoopLiveResponse,
  FetchAtlasLoopLiveParams,
  AtlasLoopCycleRecord,
  AtlasLoopCyclesResponse,
  FetchAtlasLoopCyclesParams,
  SubmitAtlasLoopDecisionInput,
  AtlasLoopOperatorDecisionReceipt,
  AtlasLoopOperatorDecisionError,
  SubmitAtlasLoopRunControlInput,
  AtlasLoopRunControlResponse,
  SendAtlasLoopDirectiveInput,
  AtlasLoopDirectiveConsumability,
  AtlasLoopDirectiveReceipt,
  AtlasLoopDirectiveError,
} from './loopClient'
