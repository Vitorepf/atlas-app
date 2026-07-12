// Mobile domain API surface (types + functions), split out of ./client.
// Re-exported from ./client via `export * from './mobile'` so existing imports keep working.
// Anti-cycle: this module MUST NOT import from ./client. The request engine comes from ./core;
// AI thread/trace/provider/status types come from ./atlasAi (already split).
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
  apiPost,
  mobileApiGet,
  mobileApiPost,
  mobileApiDelete,
  queryString,
  AtlasApiError,
  hydrateApiConfig,
  getMobileDeviceSession,
  setMobileDeviceSession,
  clearMobileDeviceSession,
  getMobileDeviceToken,
  getMobileDeviceId,
} from './core'
import type { MobileDeviceSession } from './core'
import type { AtlasAiProvider, AtlasAiStatus, AtlasAiThread, AtlasAiTrace } from './atlasAi'

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
  const deviceToken = getMobileDeviceToken()
  if (!deviceToken) return null

  try {
    const response = await listMobileDevices(opts)
    const currentDevice = currentMobileDevice(response)
    if (!currentDevice?.id) return null

    const recoveredSession = {
      deviceToken,
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
  if (getMobileDeviceId() === deviceId) {
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

export async function replayAtlasMobilePush(
  input: AtlasMobilePushReplayInput = {},
): Promise<AtlasMobilePushReplayResponse> {
  return apiPost<AtlasMobilePushReplayResponse>('/ai/mobile/push/replay', input)
}

function currentMobileDevice(response: MobileDevicesResponse): AtlasMobileDevice | null {
  if (response.current_device?.id) return response.current_device
  if (response.current_device_id) {
    const byId = response.devices.find((device) => device.id === response.current_device_id)
    if (byId) return byId
  }

  return response.devices.find((device) => !device.revoked_at) ?? null
}
