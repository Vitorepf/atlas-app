import type { DomainKey } from './domains'
import {
  type AtlasBehavior,
  type AtlasBehaviorLog,
  type AtlasCapture,
  type AtlasCheckin,
  type AtlasDigitalActivitySnapshot,
  type AtlasDigitalSession,
  type AtlasHealthSnapshot,
  type AtlasPassiveSignal,
  type CaptureKind,
  type StoreBehaviorInput,
  type StoreBehaviorLogInput,
  type StoreCheckinInput,
  type StoreDigitalActivitySnapshotInput,
  type StoreDigitalSessionInput,
  type StoreHealthSnapshotInput,
  type StorePassiveSignalInput,
} from './api/client'
import { canonicalBehaviorCategory } from './bitaculaFactors'
import { healthKitSleepAggregateClientId, healthKitSleepDurationClientId } from './healthKit'
import { isMainSleepCandidate } from './sleepValidity'
import type { InboxItem } from '../components/InboxCard'

export const LOCAL_ID_PREFIX = 'local:'
export const DERIVED_SLEEP_SIGNAL_TYPES = [
  'sleep_duration_hours',
  'sleep_hr_avg_bpm',
  'sleep_hr_min_bpm',
  'sleep_hr_max_bpm',
  'sleep_hr_median_bpm',
  'sleep_hr_sample_count',
] as const

export interface QueuedCapture {
  client_id: string
  kind: CaptureKind
  domain: DomainKey
  content_text?: string | null
  file_uri?: string | null
  file_name?: string | null
  mime_type?: string | null
  content_duration_ms?: number | null
  captured_at: string
  captured_timezone: string
  captured_lat?: number | null
  captured_lng?: number | null
  metadata?: Record<string, unknown>
  attempts: number
  last_error?: string | null
}

export type QueuedCheckin = StoreCheckinInput & {
  attempts: number
  last_error?: string | null
}

export type QueuedPassiveSignal = StorePassiveSignalInput & {
  attempts: number
  last_error?: string | null
}

export type QueuedHealthSnapshot = StoreHealthSnapshotInput & {
  attempts: number
  last_error?: string | null
}

export type QueuedDigitalSession = StoreDigitalSessionInput & {
  attempts: number
  last_error?: string | null
}

export type QueuedDigitalActivitySnapshot = StoreDigitalActivitySnapshotInput & {
  attempts: number
  last_error?: string | null
}

export type QueuedBehavior = StoreBehaviorInput & {
  attempts: number
  last_error?: string | null
}

export type QueuedBehaviorLog = StoreBehaviorLogInput & {
  attempts: number
  last_error?: string | null
}

export function capturePrivacy(metadata: Record<string, unknown>): {
  sensitivity: InboxItem['sensitivity']
  label: string | null
  externalAiAllowed: boolean | null
} {
  const privacy = metadata.privacy && typeof metadata.privacy === 'object' && !Array.isArray(metadata.privacy)
    ? metadata.privacy as Record<string, unknown>
    : {}
  const sensitivity = typeof privacy.sensitivity === 'string'
    ? privacy.sensitivity
    : typeof metadata.sensitivity === 'string'
      ? metadata.sensitivity
      : null
  const label = sensitivity === 'sensitive'
    ? 'SENSÍVEL'
    : sensitivity === 'private'
      ? 'PRIVADO'
      : sensitivity === 'normal'
        ? 'NORMAL'
        : null
  const externalAiAllowed = typeof privacy.external_ai_allowed === 'boolean'
    ? privacy.external_ai_allowed
    : null

  return { sensitivity, label, externalAiAllowed }
}

export function startOfLocalDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function queuedToCapture(capture: QueuedCapture): AtlasCapture {
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${capture.client_id}`,
    client_id: capture.client_id,
    kind: capture.kind,
    domain: capture.domain,
    content_text: capture.content_text ?? null,
    content_file_path: capture.file_uri ?? null,
    content_file_exists: Boolean(capture.file_uri),
    content_file_integrity: capture.file_uri ? 'available' : 'missing',
    content_duration_ms: capture.content_duration_ms ?? null,
    content_size_bytes: null,
    content_sha256: null,
    content_mime_type: capture.mime_type ?? null,
    transcription_status: capture.kind === 'audio' ? 'pending' : 'na',
    transcription_engine: null,
    transcription_error: capture.last_error ?? null,
    captured_at: capture.captured_at,
    captured_timezone: capture.captured_timezone,
    captured_lat: capture.captured_lat ?? null,
    captured_lng: capture.captured_lng ?? null,
    pre_capture_digital_context: {},
    metadata: { ...(capture.metadata ?? {}), local: true, local_attempts: capture.attempts },
    created_at: capture.captured_at,
    updated_at: now,
    deleted_at: null,
  }
}

export function queuedToCheckin(checkin: QueuedCheckin): AtlasCheckin {
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${checkin.client_id}`,
    client_id: checkin.client_id,
    state: checkin.state,
    energy_level: checkin.energy_level,
    mood_level: checkin.mood_level,
    note: checkin.note ?? null,
    recorded_at: checkin.recorded_at,
    recorded_timezone: checkin.recorded_timezone,
    metadata: { ...(checkin.metadata ?? {}), local: true },
    created_at: checkin.recorded_at,
    updated_at: now,
    deleted_at: null,
  }
}

export function queuedToPassiveSignal(signal: QueuedPassiveSignal): AtlasPassiveSignal {
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${signal.client_id}`,
    client_id: signal.client_id,
    source: signal.source,
    signal_type: signal.signal_type,
    value_numeric: signal.value_numeric ?? null,
    value_text: signal.value_text ?? null,
    unit: signal.unit ?? null,
    started_at: signal.started_at,
    ended_at: signal.ended_at ?? null,
    recorded_timezone: signal.recorded_timezone,
    metadata: { ...(signal.metadata ?? {}), local: true },
    created_at: signal.started_at,
    updated_at: now,
    deleted_at: signal.deleted_at ?? null,
  }
}

export function queuedToHealthSnapshot(input: QueuedHealthSnapshot): AtlasHealthSnapshot {
  const snapshot = sanitizeQueuedHealthSnapshotSleep(input)
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${snapshot.client_id}`,
    client_id: snapshot.client_id,
    source: snapshot.source,
    snapshot_date: snapshot.snapshot_date,
    snapshot_timezone: snapshot.snapshot_timezone,
    computed_at: snapshot.computed_at,
    signal_count: snapshot.signal_count,
    readiness_score: snapshot.readiness_score ?? null,
    current_score: snapshot.current_score ?? null,
    body_score: snapshot.body_score ?? null,
    mind_score: snapshot.mind_score ?? null,
    drive_score: snapshot.drive_score ?? null,
    sleep_score: snapshot.sleep_score ?? null,
    autonomic_score: snapshot.autonomic_score ?? null,
    load_score: snapshot.load_score ?? null,
    subjective_score: snapshot.subjective_score ?? null,
    stability_score: snapshot.stability_score ?? null,
    confidence: snapshot.confidence ?? null,
    sleep_duration_hours: snapshot.sleep_duration_hours ?? null,
    sleep_efficiency: snapshot.sleep_efficiency ?? null,
    hrv_ms: snapshot.hrv_ms ?? null,
    resting_heart_rate_bpm: snapshot.resting_heart_rate_bpm ?? null,
    respiratory_rate: snapshot.respiratory_rate ?? null,
    wrist_temperature_c: snapshot.wrist_temperature_c ?? null,
    active_energy_kcal: snapshot.active_energy_kcal ?? null,
    basal_energy_kcal: snapshot.basal_energy_kcal ?? null,
    exercise_minutes: snapshot.exercise_minutes ?? null,
    stand_minutes: snapshot.stand_minutes ?? null,
    steps: snapshot.steps ?? null,
    walking_running_distance_m: snapshot.walking_running_distance_m ?? null,
    vo2max: snapshot.vo2max ?? null,
    body_mass_kg: snapshot.body_mass_kg ?? null,
    body_fat_percentage: snapshot.body_fat_percentage ?? null,
    lean_body_mass_kg: snapshot.lean_body_mass_kg ?? null,
    muscle_mass_percentage: snapshot.muscle_mass_percentage ?? null,
    body_mass_index: snapshot.body_mass_index ?? null,
    waist_circumference_cm: snapshot.waist_circumference_cm ?? null,
    energy_level: snapshot.energy_level ?? null,
    mood_level: snapshot.mood_level ?? null,
    state: snapshot.state ?? null,
    metrics: snapshot.metrics ?? {},
    readiness: snapshot.readiness ?? {},
    sleep: snapshot.sleep ?? {},
    recovery: snapshot.recovery ?? {},
    load: snapshot.load ?? {},
    subjective: snapshot.subjective ?? {},
    body: snapshot.body ?? {},
    metadata: { ...(snapshot.metadata ?? {}), local: true, last_error: snapshot.last_error ?? null },
    created_at: snapshot.computed_at,
    updated_at: now,
    deleted_at: null,
  }
}

export function queuedToDigitalSession(session: QueuedDigitalSession): AtlasDigitalSession {
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${session.client_id}`,
    client_id: session.client_id,
    source: session.source,
    source_event_id: session.source_event_id ?? null,
    source_identifier: session.source_identifier,
    source_name: session.source_name,
    source_kind: session.source_kind,
    category_class_at_time: session.category_class_at_time ?? null,
    category_label_at_time: session.category_label_at_time ?? null,
    intentionality: session.intentionality ?? 'unknown',
    started_at: session.started_at,
    ended_at: session.ended_at,
    duration_seconds: session.duration_seconds,
    recorded_timezone: session.recorded_timezone,
    focus_mode_active: session.focus_mode_active ?? null,
    project_name: session.project_name ?? null,
    task_name: session.task_name ?? null,
    url_domain: session.url_domain ?? null,
    productivity_score: session.productivity_score ?? null,
    linked_capture_id: session.linked_capture_id ?? null,
    linked_decision_id: session.linked_decision_id ?? null,
    raw_payload: session.raw_payload ?? {},
    metadata: { ...(session.metadata ?? {}), local: true, last_error: session.last_error ?? null },
    created_at: session.started_at,
    updated_at: now,
    deleted_at: null,
  }
}

export function queuedToDigitalActivitySnapshot(snapshot: QueuedDigitalActivitySnapshot): AtlasDigitalActivitySnapshot {
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${snapshot.client_id}`,
    client_id: snapshot.client_id,
    source: snapshot.source,
    snapshot_date: snapshot.snapshot_date,
    snapshot_timezone: snapshot.snapshot_timezone,
    computed_at: snapshot.computed_at,
    signal_count: snapshot.signal_count,
    total_screen_time_min: snapshot.total_screen_time_min ?? null,
    pickups_count: snapshot.pickups_count ?? null,
    first_offensive_use_min_after_wake: snapshot.first_offensive_use_min_after_wake ?? null,
    deep_work_sessions_count: snapshot.deep_work_sessions_count ?? null,
    deep_work_total_min: snapshot.deep_work_total_min ?? null,
    notifications_received: snapshot.notifications_received ?? null,
    notifications_actioned: snapshot.notifications_actioned ?? null,
    curated_input_min: snapshot.curated_input_min ?? null,
    algorithmic_input_min: snapshot.algorithmic_input_min ?? null,
    intentional_entertainment_min: snapshot.intentional_entertainment_min ?? null,
    default_entertainment_min: snapshot.default_entertainment_min ?? null,
    communication_primary_min: snapshot.communication_primary_min ?? null,
    communication_shallow_min: snapshot.communication_shallow_min ?? null,
    market_min: snapshot.market_min ?? null,
    focus_mode_active_min: snapshot.focus_mode_active_min ?? {},
    category_breakdown: snapshot.category_breakdown ?? {},
    source_breakdown: snapshot.source_breakdown ?? {},
    raw_rize_data: snapshot.raw_rize_data ?? {},
    raw_screentime_data: snapshot.raw_screentime_data ?? {},
    metadata: { ...(snapshot.metadata ?? {}), local: true, last_error: snapshot.last_error ?? null },
    created_at: snapshot.computed_at,
    updated_at: now,
    deleted_at: null,
  }
}

export function queuedToBehavior(behavior: QueuedBehavior): AtlasBehavior {
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${behavior.client_id}`,
    client_id: behavior.client_id,
    name: behavior.name,
    slug: behavior.slug,
    category: canonicalBehaviorCategory(behavior.category),
    input_type: behavior.input_type,
    question_text: behavior.question_text,
    default_value: behavior.default_value ?? 'no',
    parent_factor: behavior.parent_factor ?? null,
    factor_condition: behavior.factor_condition ?? null,
    target_outcomes: behavior.target_outcomes ?? [],
    expected_lag: behavior.expected_lag ?? null,
    expected_direction: behavior.expected_direction ?? null,
    granularity_level: behavior.granularity_level ?? 'binary',
    sensitivity_level: behavior.sensitivity_level ?? 'normal',
    derived_from: behavior.derived_from ?? {},
    operator_confirmed: behavior.operator_confirmed ?? true,
    created_by: behavior.created_by ?? 'operator',
    source_capture_ids: behavior.source_capture_ids ?? [],
    activation_rules: behavior.activation_rules ?? {},
    lifecycle_status: behavior.lifecycle_status ?? 'active',
    paused_until: behavior.paused_until ?? null,
    last_prompted_at: behavior.last_prompted_at ?? null,
    prompt_cadence_days: behavior.prompt_cadence_days ?? 1,
    auto_suppress_reason: behavior.auto_suppress_reason ?? null,
    show_in_morning_briefing: behavior.show_in_morning_briefing ?? true,
    priority_score: behavior.priority_score ?? 0,
    streak_yes: behavior.streak_yes ?? 0,
    streak_no: behavior.streak_no ?? 0,
    total_yes_count: behavior.total_yes_count ?? 0,
    total_no_count: behavior.total_no_count ?? 0,
    relational_privacy: behavior.relational_privacy ?? false,
    activated_at: behavior.activated_at ?? now,
    archived_at: behavior.archived_at ?? null,
    promoted_to_object_type: behavior.promoted_to_object_type ?? null,
    promoted_to_object_id: behavior.promoted_to_object_id ?? null,
    metadata: { ...(behavior.metadata ?? {}), local: true, last_error: behavior.last_error ?? null },
    created_at: behavior.activated_at ?? now,
    updated_at: now,
    deleted_at: null,
  }
}

export function queuedToBehaviorLog(log: QueuedBehaviorLog): AtlasBehaviorLog {
  const now = new Date().toISOString()

  return {
    id: `${LOCAL_ID_PREFIX}${log.client_id}`,
    client_id: log.client_id,
    behavior_id: null,
    behavior_client_id: log.behavior_client_id,
    log_date: log.log_date,
    value: log.value,
    numeric_value: log.numeric_value ?? null,
    note: log.note ?? null,
    occurred_at: log.occurred_at ?? null,
    occurred_timezone: log.occurred_timezone ?? null,
    quantity_numeric: log.quantity_numeric ?? null,
    quantity_unit: log.quantity_unit ?? null,
    intensity: log.intensity ?? null,
    context: log.context ?? {},
    recorded_at: log.recorded_at,
    recorded_timezone: log.recorded_timezone,
    source: log.source,
    source_capture_id: log.source_capture_id ?? null,
    auto_marked: log.auto_marked ?? false,
    confirmed_by_operator: log.confirmed_by_operator ?? true,
    confidence: log.confidence ?? null,
    inferred_by: log.inferred_by ?? null,
    consent_snapshot_id: log.consent_snapshot_id ?? null,
    reverted_at: log.reverted_at ?? null,
    metadata: { ...(log.metadata ?? {}), local: true, last_error: log.last_error ?? null },
    created_at: log.recorded_at,
    updated_at: now,
    deleted_at: null,
  }
}

export function mergeCaptures(captures: AtlasCapture[]): AtlasCapture[] {
  const byClientId = new Map<string, AtlasCapture>()

  for (const capture of captures) {
    if (capture.deleted_at) {
      byClientId.delete(capture.client_id)
      continue
    }

    const existing = byClientId.get(capture.client_id)
    if (!existing || new Date(capture.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(capture.client_id, capture)
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
  ))
}

export function mergeCheckins(checkins: AtlasCheckin[]): AtlasCheckin[] {
  const byClientId = new Map<string, AtlasCheckin>()

  for (const checkin of checkins) {
    if (checkin.deleted_at) {
      byClientId.delete(checkin.client_id)
      continue
    }

    const existing = byClientId.get(checkin.client_id)
    if (!existing || new Date(checkin.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(checkin.client_id, checkin)
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  ))
}

export function mergeBehaviors(behaviors: AtlasBehavior[]): AtlasBehavior[] {
  const byClientId = new Map<string, AtlasBehavior>()

  for (const behavior of behaviors) {
    if (behavior.deleted_at) {
      byClientId.delete(behavior.client_id)
      continue
    }

    const existing = byClientId.get(behavior.client_id)
    if (!existing || new Date(behavior.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(behavior.client_id, normalizeBehaviorModel(behavior))
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    (b.priority_score - a.priority_score)
    || (new Date(b.activated_at).getTime() - new Date(a.activated_at).getTime())
  ))
}

export function normalizeBehaviorModel(behavior: AtlasBehavior): AtlasBehavior {
  return {
    ...behavior,
    category: canonicalBehaviorCategory(behavior.category),
    lifecycle_status: behavior.lifecycle_status ?? (behavior.show_in_morning_briefing === false ? 'manual_only' : 'active'),
    paused_until: behavior.paused_until ?? null,
    last_prompted_at: behavior.last_prompted_at ?? null,
    prompt_cadence_days: behavior.prompt_cadence_days ?? 1,
    auto_suppress_reason: behavior.auto_suppress_reason ?? null,
    target_outcomes: behavior.target_outcomes ?? [],
    derived_from: behavior.derived_from ?? {},
    source_capture_ids: behavior.source_capture_ids ?? [],
    activation_rules: behavior.activation_rules ?? {},
    metadata: behavior.metadata ?? {},
  }
}

export function mergeBehaviorLogs(logs: AtlasBehaviorLog[]): AtlasBehaviorLog[] {
  const byClientId = new Map<string, AtlasBehaviorLog>()

  for (const log of logs) {
    if (log.deleted_at) {
      byClientId.delete(log.client_id)
      continue
    }

    const existing = byClientId.get(log.client_id)
    if (!existing || new Date(log.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(log.client_id, normalizeBehaviorLogModel(log))
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
  ))
}

export function normalizeBehaviorLogModel(log: AtlasBehaviorLog): AtlasBehaviorLog {
  return {
    ...log,
    occurred_at: log.occurred_at ?? null,
    occurred_timezone: log.occurred_timezone ?? null,
    quantity_numeric: log.quantity_numeric ?? null,
    quantity_unit: log.quantity_unit ?? null,
    intensity: log.intensity ?? null,
    context: log.context ?? {},
    metadata: log.metadata ?? {},
  }
}

export function mergePassiveSignals(signals: AtlasPassiveSignal[]): AtlasPassiveSignal[] {
  const byClientId = new Map<string, AtlasPassiveSignal>()

  for (const signal of signals) {
    if (signal.deleted_at) {
      byClientId.delete(signal.client_id)
      continue
    }

    const existing = byClientId.get(signal.client_id)
    if (!existing || new Date(signal.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(signal.client_id, signal)
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  ))
}

export function mergeHealthSnapshots(snapshots: AtlasHealthSnapshot[]): AtlasHealthSnapshot[] {
  const byClientId = new Map<string, AtlasHealthSnapshot>()

  for (const snapshot of snapshots) {
    if (snapshot.deleted_at) {
      byClientId.delete(snapshot.client_id)
      continue
    }

    const existing = byClientId.get(snapshot.client_id)
    if (!existing || new Date(snapshot.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(snapshot.client_id, snapshot)
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
  ))
}

export function mergeDigitalSessions(sessions: AtlasDigitalSession[]): AtlasDigitalSession[] {
  const byClientId = new Map<string, AtlasDigitalSession>()

  for (const session of sessions) {
    if (session.deleted_at) {
      byClientId.delete(session.client_id)
      continue
    }

    const existing = byClientId.get(session.client_id)
    if (!existing || new Date(session.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(session.client_id, session)
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  ))
}

export function mergeDigitalActivitySnapshots(snapshots: AtlasDigitalActivitySnapshot[]): AtlasDigitalActivitySnapshot[] {
  const byClientId = new Map<string, AtlasDigitalActivitySnapshot>()

  for (const snapshot of snapshots) {
    if (snapshot.deleted_at) {
      byClientId.delete(snapshot.client_id)
      continue
    }

    const existing = byClientId.get(snapshot.client_id)
    if (!existing || new Date(snapshot.updated_at).getTime() >= new Date(existing.updated_at).getTime()) {
      byClientId.set(snapshot.client_id, snapshot)
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
  ))
}

export function mergeQueuedCaptures(captures: QueuedCapture[]): QueuedCapture[] {
  return mergeQueuedByClientId(captures, (capture) => queueTime(capture.captured_at))
}

export function mergeQueuedCheckins(checkins: QueuedCheckin[]): QueuedCheckin[] {
  return mergeQueuedByClientId(checkins, (checkin) => queueTime(checkin.recorded_at))
}

export function mergeQueuedBehaviors(behaviors: QueuedBehavior[]): QueuedBehavior[] {
  return mergeQueuedByClientId(behaviors, (behavior) => queueTime(behavior.activated_at))
}

export function mergeQueuedBehaviorLogs(logs: QueuedBehaviorLog[]): QueuedBehaviorLog[] {
  return mergeQueuedByClientId(logs, (log) => queueTime(log.log_date))
}

export function passiveSignalMetricTime(signal: AtlasPassiveSignal, signalType = signal.signal_type): number {
  const iso = signalType === 'sleep_duration_hours' || signalType === 'sleep_stage' || signalType.startsWith('sleep_hr_') || signalType === 'sleep_breathing_disturbances'
    ? signal.ended_at ?? signal.started_at
    : signal.started_at
  return new Date(iso).getTime()
}

export function mergePassiveSignalInputs(signals: StorePassiveSignalInput[]): StorePassiveSignalInput[] {
  const byClientId = new Map<string, StorePassiveSignalInput>()
  for (const signal of signals) {
    byClientId.set(signal.client_id, signal)
  }
  return [...byClientId.values()]
}

export function sleepDurationInvalidationsForDeletedStages(
  signals: StorePassiveSignalInput[],
  existingSignals: AtlasPassiveSignal[],
): StorePassiveSignalInput[] {
  const regeneratedKeys = new Set(
    signals
      .filter((signal) => DERIVED_SLEEP_SIGNAL_TYPES.includes(signal.signal_type as typeof DERIVED_SLEEP_SIGNAL_TYPES[number]) && !signal.deleted_at)
      .map((signal) => {
        const dateKey = dateKeyForPassiveSignalInput(signal)
        return dateKey ? `${dateKey}:${signal.signal_type}` : null
      })
      .filter((key): key is string => key !== null),
  )
  const regeneratedSleepDates = new Set(
    signals
      .filter((signal) => signal.signal_type === 'sleep_duration_hours' && !signal.deleted_at)
      .map((signal) => dateKeyForPassiveSignalInput(signal))
      .filter((date): date is string => date !== null),
  )
  const existingByClientId = new Map(existingSignals.map((signal) => [signal.client_id, signal]))
  const invalidatedKeys = new Set<string>()
  const invalidations: StorePassiveSignalInput[] = []

  for (const signal of signals) {
    if (signal.signal_type !== 'sleep_stage' || !signal.deleted_at) continue

    const existing = existingByClientId.get(signal.client_id)
    const dateKey = existing
      ? localDateKey(new Date(passiveSignalInputMetricTime(existing)))
      : dateKeyForPassiveSignalInput(signal)

    if (!dateKey) continue

    for (const signalType of DERIVED_SLEEP_SIGNAL_TYPES) {
      const key = `${dateKey}:${signalType}`
      if (regeneratedKeys.has(key) || invalidatedKeys.has(key)) continue

      invalidatedKeys.add(key)
      invalidations.push(derivedSleepTombstone({
        dateKey,
        signalType,
        deletedAt: signal.deleted_at,
        timezone: existing?.recorded_timezone ?? signal.recorded_timezone,
        reason: 'sleep_stage_deleted',
        sourceClientId: signal.client_id,
      }))
    }
  }

  for (const existing of existingSignals) {
    if (existing.deleted_at) continue
    const signalType = existing.signal_type as typeof DERIVED_SLEEP_SIGNAL_TYPES[number]
    if (
      signalType === 'sleep_duration_hours'
      || !DERIVED_SLEEP_SIGNAL_TYPES.includes(signalType)
    ) {
      continue
    }

    const dateKey = localDateKey(new Date(passiveSignalMetricTime(existing, signalType)))
    const key = `${dateKey}:${signalType}`
    if (!regeneratedSleepDates.has(dateKey) || regeneratedKeys.has(key) || invalidatedKeys.has(key)) {
      continue
    }

    const deletedAt = new Date().toISOString()
    invalidatedKeys.add(key)
    invalidations.push(derivedSleepTombstone({
      dateKey,
      signalType,
      deletedAt,
      timezone: existing.recorded_timezone,
      reason: 'derived_missing_after_sleep_refresh',
      sourceClientId: existing.client_id,
    }))
  }

  return invalidations
}

export function derivedSleepTombstone(input: {
  dateKey: string
  signalType: typeof DERIVED_SLEEP_SIGNAL_TYPES[number]
  deletedAt: string
  timezone: string
  reason: string
  sourceClientId: string
}): StorePassiveSignalInput {
  return {
    client_id: derivedSleepClientId(input.dateKey, input.signalType),
    source: 'healthkit',
    signal_type: input.signalType,
    value_numeric: null,
    value_text: null,
    unit: derivedSleepSignalUnit(input.signalType),
    started_at: input.deletedAt,
    ended_at: null,
    recorded_timezone: input.timezone,
    deleted_at: input.deletedAt,
    metadata: {
      healthkit: {
        kind: 'derived_tombstone',
        type: input.signalType,
        source_type: 'HKCategoryTypeIdentifierSleepAnalysis',
        date_key: input.dateKey,
        reason: input.reason,
        source_client_id: input.sourceClientId,
      },
    },
  }
}

export function derivedSleepClientId(dateKey: string, signalType: typeof DERIVED_SLEEP_SIGNAL_TYPES[number]): string {
  return signalType === 'sleep_duration_hours'
    ? healthKitSleepDurationClientId(dateKey)
    : healthKitSleepAggregateClientId(dateKey, signalType)
}

export function derivedSleepSignalUnit(signalType: typeof DERIVED_SLEEP_SIGNAL_TYPES[number]): string {
  return signalType === 'sleep_duration_hours' ? 'h' : signalType === 'sleep_hr_sample_count' ? 'count' : 'bpm'
}

export function dateKeyForPassiveSignalInput(
  signal: Pick<StorePassiveSignalInput, 'signal_type' | 'started_at' | 'ended_at'>,
): string | null {
  const time = passiveSignalInputMetricTime(signal)
  return Number.isFinite(time) ? localDateKey(new Date(time)) : null
}

export function healthSnapshotDatesForHealthKitSync(input: {
  signals: StorePassiveSignalInput[]
  existingSignals: AtlasPassiveSignal[]
  refreshDays: number
  now?: Date
}): string[] {
  const now = input.now ?? new Date()
  const dates = new Set<string>(recentLocalDateKeys(input.refreshDays, now))
  const existingByClientId = new Map(input.existingSignals.map((signal) => [signal.client_id, signal]))

  for (const signal of input.signals) {
    const originalSignal = signal.deleted_at ? existingByClientId.get(signal.client_id) : null
    const time = passiveSignalInputMetricTime(originalSignal ?? signal)
    if (Number.isFinite(time)) {
      dates.add(localDateKey(new Date(time)))
    }
  }

  return [...dates].sort((a, b) => new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime())
}

export function recentLocalDateKeys(days: number, now = new Date()): string[] {
  return Array.from({ length: Math.max(1, days) }, (_, offset) => {
    const date = startOfLocalDay(now)
    date.setDate(date.getDate() - offset)
    return localDateKey(date)
  })
}

export function passiveSignalInputMetricTime(
  signal: Pick<StorePassiveSignalInput, 'signal_type' | 'started_at' | 'ended_at'>,
): number {
  const iso = signal.signal_type === 'sleep_duration_hours' || signal.signal_type === 'sleep_stage' || signal.signal_type.startsWith('sleep_hr_') || signal.signal_type === 'sleep_breathing_disturbances'
    ? signal.ended_at ?? signal.started_at
    : signal.started_at
  return new Date(iso).getTime()
}

export function mergeQueuedPassiveSignals(signals: QueuedPassiveSignal[]): QueuedPassiveSignal[] {
  return mergeQueuedByClientId(signals, (signal) => queueTime(signal.started_at))
}

export function mergeQueuedHealthSnapshots(snapshots: QueuedHealthSnapshot[]): QueuedHealthSnapshot[] {
  return mergeQueuedByClientId(snapshots, (snapshot) => queueTime(snapshot.snapshot_date))
}

export function mergeQueuedDigitalSessions(sessions: QueuedDigitalSession[]): QueuedDigitalSession[] {
  return mergeQueuedByClientId(sessions, (session) => queueTime(session.started_at))
}

export function mergeQueuedDigitalActivitySnapshots(
  snapshots: QueuedDigitalActivitySnapshot[],
): QueuedDigitalActivitySnapshot[] {
  return mergeQueuedByClientId(snapshots, (snapshot) => queueTime(snapshot.snapshot_date))
}

export function mergeQueuedByClientId<T extends { client_id: string; attempts: number; last_error?: string | null }>(
  items: T[],
  getTime: (item: T) => number,
): T[] {
  const byClientId = new Map<string, T>()

  for (const item of items) {
    if (!item.client_id) continue

    const existing = byClientId.get(item.client_id)
    if (!existing) {
      byClientId.set(item.client_id, item)
      continue
    }

    const itemTime = getTime(item)
    const existingTime = getTime(existing)
    const primary = itemTime > existingTime ? item : existing
    const secondary = itemTime > existingTime ? existing : item

    byClientId.set(item.client_id, {
      ...primary,
      attempts: Math.max(primary.attempts ?? 0, secondary.attempts ?? 0),
      last_error: primary.last_error ?? secondary.last_error ?? null,
    } as T)
  }

  return [...byClientId.values()].sort((a, b) => (
    getTime(b) - getTime(a)
  ))
}

export function queueTime(iso: string | null | undefined): number {
  if (!iso) return 0
  const time = new Date(iso).getTime()
  return Number.isFinite(time) ? time : 0
}

export function uniqueBehaviorSlug(name: string, state: { behaviors: AtlasBehavior[]; queuedBehaviors: QueuedBehavior[] }): string {
  const base = slugify(name)
  const existing = new Set([
    ...state.behaviors.map((behavior) => behavior.slug),
    ...state.queuedBehaviors.map((behavior) => behavior.slug),
  ])

  if (!existing.has(base)) return base

  let suffix = 2
  let next = `${base}_${suffix}`
  while (existing.has(next)) {
    suffix += 1
    next = `${base}_${suffix}`
  }

  return next
}

export function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return slug || 'behavior'
}

export function numericValueForBehavior(value: string): number | null {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'yes' || normalized === 'sim' || normalized === 'true') return 1
  if (normalized === 'no' || normalized === 'não' || normalized === 'nao' || normalized === 'false') return 0

  const parsed = Number(normalized.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

export function isPromptableLifecycle(status: AtlasBehavior['lifecycle_status']): boolean {
  return status === 'active' || status === 'experiment'
}

export interface CaptureTriageMetadata {
  status?: string
  destination?: string
  last_action?: string
  updated_at?: string
  reason?: string | null
  title?: string | null
  snoozed_until?: string | null
  note_title?: string | null
  proposal_id?: string | null
  proposal_status?: string | null
  knowledge_state?: string | null
  human_gate?: string | null
  next_action?: string | null
  project_type?: string | null
  active_next_task_id?: string | null
  active_next_task_title?: string | null
  target_type?: string | null
  target_id?: string | null
  target_title?: string | null
}

export function captureTriage(capture: AtlasCapture): CaptureTriageMetadata {
  const triage = capture.metadata?.triage
  return triage && typeof triage === 'object' && !Array.isArray(triage)
    ? triage as CaptureTriageMetadata
    : {}
}

export function captureTriageHistory(capture: AtlasCapture): InboxItem['triageHistory'] {
  const history = capture.metadata?.triage_history
  if (!Array.isArray(history)) return []

  return history
    .filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === 'object' && !Array.isArray(entry))
    .slice(0, 20)
    .map((entry) => ({
      action: typeof entry.action === 'string' ? entry.action : null,
      status: typeof entry.status === 'string' ? entry.status : null,
      destination: typeof entry.destination === 'string' ? entry.destination : null,
      at: typeof entry.at === 'string' ? entry.at : null,
      reason: typeof entry.reason === 'string' ? entry.reason : null,
      proposal_id: typeof entry.proposal_id === 'string' ? entry.proposal_id : null,
      previous_destination: typeof entry.previous_destination === 'string' ? entry.previous_destination : null,
      previous_target_title: typeof entry.previous_target_title === 'string' ? entry.previous_target_title : null,
      changed_destination: typeof entry.changed_destination === 'boolean' ? entry.changed_destination : null,
    }))
}

export function sanitizeQueuedHealthSnapshotSleep(snapshot: QueuedHealthSnapshot): QueuedHealthSnapshot {
  const sleep = recordOrNull(snapshot.sleep)
  const durationHours = numberOrNull(sleep?.duration_hours) ?? numberOrNull(snapshot.sleep_duration_hours)
  if (
    durationHours === null
    || isMainSleepCandidate({
      asleepHours: durationHours,
      bedtime: stringOrNull(sleep?.bedtime),
      wakeTime: stringOrNull(sleep?.wake_time),
    })
  ) {
    return snapshot
  }

  return {
    ...snapshot,
    sleep_duration_hours: null,
    sleep_efficiency: null,
    sleep: {
      ...(sleep ?? {}),
      asleep_hours: null,
      duration_hours: null,
      sleep_debt_hours: null,
      bedtime: null,
      wake_time: null,
      in_bed_start_time: null,
      in_bed_hours: null,
      efficiency: null,
      awake_percent: null,
      continuity_percent: null,
      rem_hours: null,
      deep_hours: null,
      core_hours: null,
      awake_hours: null,
      unspecified_hours: null,
      latency_minutes: null,
      awake_episode_count: null,
      disturbance_count: null,
      sleep_cycle_count: null,
      stage_coverage: null,
      sleep_data_quality: null,
      sleep_data_quality_label: null,
      sleep_capture_status: null,
      main_sleep_source: null,
      rejected_main_sleep: true,
      rejection_reason: 'too_short_or_outside_main_sleep_window',
    },
  }
}

export function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}
