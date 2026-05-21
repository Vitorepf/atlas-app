import { sha256Hex } from './sha256'

export function mobileVoiceSynthesizedIdempotencyKey(input: {
  session_id: string
  turn_id: string
  response_text_hash?: string
  audio_hash?: string
}): string {
  return [
    'mobile-voice-synthesized',
    idempotencyFragment(input.session_id),
    idempotencyFragment(input.turn_id),
    idempotencyFragment(input.response_text_hash ?? input.audio_hash ?? 'no-hash'),
  ].join('-')
}

export function mobileVoiceTtsSynthesisIdempotencyKey(input: {
  session_id: string
  turn_id: string
  response_text_hash?: string
}): string {
  return [
    'mobile-voice-tts',
    idempotencyFragment(input.session_id),
    idempotencyFragment(input.turn_id),
    idempotencyFragment(input.response_text_hash ?? 'no-response-hash'),
  ].join('-')
}

export function mobileVoicePlayedIdempotencyKey(input: {
  session_id: string
  turn_id: string
}): string {
  return [
    'mobile-voice-played',
    idempotencyFragment(input.session_id),
    idempotencyFragment(input.turn_id),
  ].join('-')
}

export function mobileVoiceSessionStartIdempotencyKey(input: {
  session_id: string
}): string {
  return [
    'mobile-voice-session',
    idempotencyFragment(input.session_id),
  ].join('-')
}

export function mobileVoiceSessionEndIdempotencyKey(input: {
  session_id: string
  reason?: string
}): string {
  return [
    'mobile-voice-session-end',
    idempotencyFragment(input.session_id),
    idempotencyFragment(input.reason ?? 'operator_finished'),
  ].join('-')
}

export function mobileVoiceTurnIdempotencyKey(input: {
  session_id: string
  turn_id: string
}): string {
  return [
    'mobile-voice-turn',
    idempotencyFragment(input.session_id),
    idempotencyFragment(input.turn_id),
  ].join('-')
}

export function mobileVoiceInterruptIdempotencyKey(input: {
  session_id: string
  envelope_id?: string
  receipt_id?: string
  turn_id?: string
  reason?: string
  interrupted_stage?: string
}): string {
  return [
    'mobile-voice-interrupt',
    idempotencyFragment(input.session_id),
    idempotencyFragment(input.turn_id ?? input.receipt_id ?? input.envelope_id ?? 'session'),
    idempotencyFragment(input.reason ?? 'operator_interrupted'),
    idempotencyFragment(input.interrupted_stage ?? 'unknown_stage'),
  ].join('-')
}

export function mobileVoiceRuntimeFailedIdempotencyKey(input: {
  session_id: string
  turn_id: string
  failure_code?: string
  error_class?: string
  error_message_hash?: string
}): string {
  return [
    'mobile-voice-runtime-failed',
    idempotencyFragment(input.session_id),
    idempotencyFragment(input.turn_id),
    idempotencyFragment(input.failure_code ?? 'unknown'),
    ...(input.error_class ? [idempotencyFragment(input.error_class)] : []),
    ...(input.error_message_hash ? [idempotencyFragment(input.error_message_hash)] : []),
  ].join('-')
}

export async function mobileVoiceRuntimeFailureHash(input: {
  failure_code?: string
  error_class?: string
  error_message_hash?: string
}): Promise<string> {
  const existing = typeof input.error_message_hash === 'string' ? input.error_message_hash.trim() : ''
  if (/^[a-f0-9]{64}$/i.test(existing)) return existing.toLowerCase()

  return sha256Hex([
    'atlas_mobile_voice_runtime_failed',
    input.failure_code?.trim() || 'unknown_failure',
    input.error_class?.trim() || 'UnknownError',
  ].join(':'))
}

export function newMobileVoiceRuntimeId(prefix: string): string {
  return `${idempotencyFragment(prefix)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function mobileVoiceMetricMs(value: number | null | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined

  return Math.max(0, Math.round(value))
}

export type MobileVoiceRecordingGateInput = {
  modeOpen: boolean
  sessionId?: string | null
  sessionReady: boolean
  state?: string | null
  recordingActive?: boolean
  operationInFlight?: boolean
  ending?: boolean
}

export type MobileVoiceOpenBlockReason =
  | 'already_open'
  | 'session_active'
  | 'recording_active'
  | 'session_closing'

export type MobileVoiceRecordingBlockReason =
  | 'mode_closed'
  | 'missing_session'
  | 'session_not_ready'
  | 'recording_active'
  | 'operation_in_flight'
  | 'session_closing'
  | 'session_starting'
  | 'session_failed'

export function mobileVoiceOpenBlockReason(input: {
  modeOpen?: boolean
  sessionId?: string | null
  recordingActive?: boolean
  ending?: boolean
}): MobileVoiceOpenBlockReason | null {
  if (input.modeOpen === true) return 'already_open'
  if (typeof input.sessionId === 'string' && input.sessionId.trim() !== '') return 'session_active'
  if (input.recordingActive === true) return 'recording_active'
  if (input.ending === true) return 'session_closing'

  return null
}

export function mobileVoiceCanStartRecording(input: MobileVoiceRecordingGateInput): boolean {
  return mobileVoiceRecordingBlockReason(input) === null
}

export function mobileVoiceRecordingBlockReason(input: MobileVoiceRecordingGateInput): MobileVoiceRecordingBlockReason | null {
  if (!input.modeOpen) return 'mode_closed'
  if (!input.sessionId || input.sessionId.trim() === '') return 'missing_session'
  if (!input.sessionReady) return 'session_not_ready'
  if (input.recordingActive === true) return 'recording_active'
  if (input.operationInFlight === true) return 'operation_in_flight'
  if (input.ending === true) return 'session_closing'
  if (input.state === 'starting') return 'session_starting'
  if (input.state === 'failed') return 'session_failed'

  return null
}

export type MobileVoiceSessionStartTelemetry = {
  status: string
  sessionId: string | null
  roomName: string | null
  runtime: string | null
  transport: string | null
  tokenStatus: string | null
  livekitUrlProvided: boolean
  participantTokenProvided: boolean
  latencyMs: number | null
}

export type MobileVoiceSessionStartOutcome = {
  telemetry: MobileVoiceSessionStartTelemetry
  resolvedSessionId: string
  sessionReady: boolean
  modeState: 'listening' | 'failed'
  eventName: 'mobile_voice_session_start_succeeded' | 'mobile_voice_session_start_succeeded_after_timeout'
  cleanupTimedOutSession: boolean
}

export type MobileVoiceLiveKitSession = {
  livekitUrl: string
  roomName: string
  participantIdentity: string
  participantToken: string
  agentIdentity: string | null
}

export type MobileVoiceSessionCloseStrategy =
  | 'skip_no_session'
  | 'end_now'
  | 'wait_for_start'

export type MobileVoiceSessionDeferredCloseOutcome =
  | 'cleanup_after_start'
  | 'start_failed'
  | 'start_not_settled'

export type MobileVoiceInterruptionStage =
  | 'assistant_streaming'
  | 'assistant_thinking'
  | 'transcription_pending'
  | 'tts_playback'

export function mobileVoiceInterruptionStage(input: {
  assistantStreaming?: boolean
  transcriptionPending?: boolean
  assistantThinking?: boolean
  state?: string | null
}): MobileVoiceInterruptionStage {
  if (input.assistantStreaming === true) return 'assistant_streaming'
  if (input.transcriptionPending === true || input.state === 'transcribing') return 'transcription_pending'
  if (input.assistantThinking === true || input.state === 'thinking') return 'assistant_thinking'

  return 'tts_playback'
}

export function mobileVoiceShouldRecordInterruption(input: {
  hasRuntimeTurn?: boolean
  hasLifecycleKey?: boolean
  assistantActive?: boolean
  pendingTraceLookup?: boolean
  pendingAiInteraction?: boolean
  state?: string | null
  playbackRecorded?: boolean
  interruptionRecorded?: boolean
}): boolean {
  if (input.hasRuntimeTurn !== true) return false
  if (input.assistantActive === true || input.pendingTraceLookup === true || input.pendingAiInteraction === true) return true
  if (input.hasLifecycleKey !== true) return false
  if (input.state === 'listening') return false
  if (input.playbackRecorded === true) return false
  if (input.interruptionRecorded === true) return false

  return true
}

export function mobileVoiceSessionCloseStrategy(input: {
  sessionId?: string | null
  sessionReady: boolean
  startInFlight?: boolean
}): MobileVoiceSessionCloseStrategy {
  if (!input.sessionId || input.sessionId.trim() === '') return 'skip_no_session'
  if (input.sessionReady) return 'end_now'
  if (input.startInFlight === true) return 'wait_for_start'

  return 'skip_no_session'
}

export function mobileVoiceSessionDeferredCloseOutcome(input: {
  startConfirmed?: boolean
  startSettled?: boolean
}): MobileVoiceSessionDeferredCloseOutcome {
  if (input.startConfirmed === true) return 'cleanup_after_start'
  if (input.startSettled === true) return 'start_failed'

  return 'start_not_settled'
}

export function mobileVoiceSessionStartTelemetry(
  response: unknown,
  input: { requestedSessionId?: string | null; startedAtMs?: number; nowMs?: number } = {},
): MobileVoiceSessionStartTelemetry {
  const record = recordFromUnknown(response)
  const session = recordFromUnknown(record?.session)
  const lease = recordFromUnknown(record?.session_lease)
  const startedAtMs = input.startedAtMs
  const nowMs = input.nowMs ?? Date.now()
  const latencyMs = typeof startedAtMs === 'number' && Number.isFinite(startedAtMs)
    ? mobileVoiceMetricMs(nowMs - startedAtMs) ?? null
    : null

  return {
    status: stringFromRecord(record, 'status') ?? 'unknown',
    sessionId: stringFromRecord(session, 'session_id') ?? stringOrNull(input.requestedSessionId),
    roomName: stringFromRecord(session, 'room_name') ?? stringFromRecord(lease, 'room_name'),
    runtime: stringFromRecord(session, 'runtime'),
    transport: stringFromRecord(session, 'transport'),
    tokenStatus: stringFromRecord(lease, 'token_status'),
    livekitUrlProvided: stringFromRecord(record, 'livekit_url') !== null || stringFromRecord(lease, 'livekit_url') !== null,
    participantTokenProvided: stringFromRecord(record, 'participant_token') !== null || stringFromRecord(lease, 'access_token') !== null,
    latencyMs,
  }
}

export function mobileVoiceSessionStartOutcome(
  response: unknown,
  input: {
    requestedSessionId?: string | null
    timedOut?: boolean
    startedAtMs?: number
    nowMs?: number
  } = {},
): MobileVoiceSessionStartOutcome {
  const telemetry = mobileVoiceSessionStartTelemetry(response, input)
  const resolvedSessionId = telemetry.sessionId ?? stringOrNull(input.requestedSessionId) ?? ''
  const timedOut = input.timedOut === true
  const ready = !timedOut
    && telemetry.status === 'session_ready'
    && telemetry.transport === 'livekit_webrtc'
    && telemetry.tokenStatus === 'issued'
    && telemetry.livekitUrlProvided
    && telemetry.participantTokenProvided
    && telemetry.roomName !== null

  return {
    telemetry,
    resolvedSessionId,
    sessionReady: ready,
    modeState: ready ? 'listening' : 'failed',
    eventName: timedOut
      ? 'mobile_voice_session_start_succeeded_after_timeout'
      : 'mobile_voice_session_start_succeeded',
    cleanupTimedOutSession: (timedOut || !ready) && resolvedSessionId.length > 0,
  }
}

export function mobileVoiceLiveKitSessionFromStartResponse(response: unknown): MobileVoiceLiveKitSession | null {
  const record = recordFromUnknown(response)
  const session = recordFromUnknown(record?.session)
  const lease = recordFromUnknown(record?.session_lease)
  const livekitUrl = stringFromRecord(record, 'livekit_url') ?? stringFromRecord(lease, 'livekit_url')
  const roomName = stringFromRecord(record, 'room_name') ?? stringFromRecord(session, 'room_name') ?? stringFromRecord(lease, 'room_name')
  const participantIdentity = stringFromRecord(record, 'participant_identity') ?? stringFromRecord(session, 'participant_identity') ?? stringFromRecord(lease, 'participant_identity')
  const participantToken = stringFromRecord(record, 'participant_token') ?? stringFromRecord(lease, 'access_token')

  if (!livekitUrl || !roomName || !participantIdentity || !participantToken) return null

  return {
    livekitUrl,
    roomName,
    participantIdentity,
    participantToken,
    agentIdentity: stringFromRecord(record, 'agent_identity') ?? stringFromRecord(lease, 'agent_identity'),
  }
}

export type MobileVoiceDispatchFailure = {
  failure_code: string
  error_class: string
  error_message_hash?: string
}

export type MobileVoiceTraceTerminalFailureInput = {
  status?: string | null
  job?: unknown
  jobs?: unknown[]
}

export type MobileVoiceEmptyResponseFailureInput = {
  status?: string | null
  response_text?: string | null
}

export type MobileVoiceDispatchStaleFailureInput = {
  result: unknown
  transcription_status?: string | null
  updated_at?: string | null
  now_ms?: number
  grace_ms?: number
}

export type MobileVoiceTraceLookupPollFailureSignal =
  | 'first_failure'
  | 'repeated_failure'

export type MobileVoiceRecordingValidationFailure = {
  failure_code: 'mobile_voice_recording_file_missing' | 'mobile_voice_recording_too_short' | 'mobile_voice_recording_silence'
  error_class: 'MobileVoiceRecordingFileMissing' | 'MobileVoiceRecordingTooShort' | 'MobileVoiceRecordingSilence'
}

export type MobileVoiceUiWatchdogDecision = {
  timeoutMs: number
  failureCode: 'mobile_voice_transcription_ui_watchdog_timeout' | 'mobile_voice_thinking_ui_watchdog_timeout'
  errorClass: 'MobileVoiceTranscriptionUiWatchdogTimeout' | 'MobileVoiceThinkingUiWatchdogTimeout'
}

export type MobileVoiceDispatchTrace = {
  trace_id: string
  thread_id: string | null
}

export type MobileVoiceReadinessSummary = {
  status: string
  score: number | null
  ready: boolean
  readyForPromotion: boolean
  healthyLoopReady: boolean
  interruptionDrillRecorded: boolean
  redactedFailureDrillRecorded: boolean
  latencySloClean: boolean
  missingEvents: string[]
  missingPromotionEvents: string[]
  recommendedAction: string | null
}

export function mobileVoiceReadinessSummary(readiness: unknown): MobileVoiceReadinessSummary {
  const record = recordFromUnknown(readiness)
  const enterprise = recordFromUnknown(record?.enterprise_mobile_loop)
  const gates = recordFromUnknown(enterprise?.gates)
  const reviewSignal = recordFromUnknown(record?.review_signal)
  const missingEvents = stringArrayFromUnknown(record?.missing_events)
  const missingPromotionEvents = stringArrayFromUnknown(enterprise?.missing_promotion_events)
  const status = stringFromRecord(record, 'status') ?? 'unknown'
  const enterpriseStatus = stringFromRecord(enterprise, 'status')
  const score = typeof record?.score === 'number' && Number.isFinite(record.score) ? record.score : null
  const latencySloClean = booleanFromRecord(gates, 'latency_slo_clean')
    ?? booleanFromRecord(recordFromUnknown(record?.gates), 'latency_slo_clean')
    ?? false
  const healthyLoopReady = booleanFromRecord(gates, 'healthy_loop_ready')
    ?? (status === 'ready' && missingEvents.length === 0 && latencySloClean)
  const interruptionDrillRecorded = booleanFromRecord(gates, 'interruption_drill_recorded') ?? false
  const redactedFailureDrillRecorded = booleanFromRecord(gates, 'redacted_failure_drill_recorded') ?? false

  return {
    status,
    score,
    ready: status === 'ready' && missingEvents.length === 0 && latencySloClean,
    readyForPromotion: enterpriseStatus === 'promotion_evidence_ready'
      && missingPromotionEvents.length === 0
      && healthyLoopReady
      && interruptionDrillRecorded
      && redactedFailureDrillRecorded
      && latencySloClean,
    healthyLoopReady,
    interruptionDrillRecorded,
    redactedFailureDrillRecorded,
    latencySloClean,
    missingEvents,
    missingPromotionEvents,
    recommendedAction: stringFromRecord(reviewSignal, 'recommended_action'),
  }
}

export function mobileVoiceDispatchTraceFromResult(result: unknown): MobileVoiceDispatchTrace | null {
  if (!result || typeof result !== 'object') return null

  const record = result as Record<string, unknown>
  if (record.dispatched !== true) return null
  if (record.status !== 'ai_interaction_enqueued' && record.status !== 'ai_interaction_dispatched') return null
  if (typeof record.trace_id !== 'string' || record.trace_id.trim() === '') return null

  return {
    trace_id: record.trace_id.trim(),
    thread_id: typeof record.thread_id === 'string' && record.thread_id.trim() ? record.thread_id.trim() : null,
  }
}

export function mobileVoiceDispatchFailureFromResult(result: unknown): MobileVoiceDispatchFailure | null {
  if (!result || typeof result !== 'object') return null

  const record = result as Record<string, unknown>
  if (record.dispatched === true) return null

  const status = typeof record.status === 'string' ? record.status : ''
  if (!status) return null

  const errorClass = typeof record.error_class === 'string' && record.error_class.trim()
    ? record.error_class.trim()
    : status
  const errorMessageHash = sha256HashFromRecord(record, 'error_message_hash')
  const failure = (failure_code: string, error_class: string): MobileVoiceDispatchFailure => ({
    failure_code,
    error_class,
    ...(errorMessageHash ? { error_message_hash: errorMessageHash } : {}),
  })

  if (status === 'transcription_failed') {
    return failure('mobile_voice_transcription_failed', errorClass)
  }
  if (status === 'blocked_transcript_persistence_not_allowed') {
    return failure('mobile_voice_dispatch_blocked', errorClass)
  }
  if (status === 'blocked_by_eclipse') {
    return failure('mobile_voice_dispatch_blocked', 'AtlasVoiceEclipseBlocked')
  }
  if (status === 'skipped_empty_transcript') {
    return failure('mobile_voice_empty_transcript', errorClass)
  }
  if (status === 'skipped_suspect_stt_ghost_transcript') {
    return failure('mobile_voice_suspect_transcript_discarded', 'SuspectSttGhostTranscript')
  }
  if (status === 'ai_interaction_dispatch_failed' || status === 'ai_interaction_enqueue_failed') {
    return failure('mobile_voice_ai_dispatch_failed', errorClass)
  }
  if (record.dispatched === false) {
    return failure('mobile_voice_ai_dispatch_not_dispatched', errorClass)
  }

  return null
}

export function mobileVoiceStaleDispatchFailure(input: MobileVoiceDispatchStaleFailureInput): MobileVoiceDispatchFailure | null {
  if (input.transcription_status !== 'done') return null
  const updatedAt = input.updated_at ? Date.parse(input.updated_at) : Number.NaN
  if (!Number.isFinite(updatedAt)) return null

  const now = input.now_ms ?? Date.now()
  const graceMs = input.grace_ms ?? 12_000
  if (Math.max(0, now - updatedAt) <= graceMs) return null

  if (input.result == null) {
    return {
      failure_code: 'mobile_voice_dispatch_result_missing',
      error_class: 'VoiceDispatchResultMissing',
    }
  }

  return {
    failure_code: 'mobile_voice_dispatch_result_invalid',
    error_class: 'VoiceDispatchResultInvalid',
  }
}

export function mobileVoiceTraceLookupPollFailureSignal(input: {
  consecutiveFailures: number
}): MobileVoiceTraceLookupPollFailureSignal | null {
  if (!Number.isFinite(input.consecutiveFailures) || input.consecutiveFailures <= 0) return null
  if (input.consecutiveFailures === 1) return 'first_failure'
  if (input.consecutiveFailures % 5 === 0) return 'repeated_failure'

  return null
}

export function mobileVoiceRecordingValidationFailure(input: {
  fileUri?: string | null
  durationMs?: number | null
  minDurationMs?: number
  meteringSamples?: number | null
  voicedMeteringSamples?: number | null
  minVoicedMeteringSamples?: number
}): MobileVoiceRecordingValidationFailure | null {
  if (typeof input.fileUri !== 'string' || input.fileUri.trim() === '') {
    return {
      failure_code: 'mobile_voice_recording_file_missing',
      error_class: 'MobileVoiceRecordingFileMissing',
    }
  }

  const minDurationMs = input.minDurationMs ?? 450
  if (typeof input.durationMs !== 'number' || !Number.isFinite(input.durationMs) || input.durationMs < minDurationMs) {
    return {
      failure_code: 'mobile_voice_recording_too_short',
      error_class: 'MobileVoiceRecordingTooShort',
    }
  }

  const meteringSamples = input.meteringSamples
  const voicedMeteringSamples = input.voicedMeteringSamples
  const minVoicedMeteringSamples = input.minVoicedMeteringSamples ?? 3
  if (
    typeof meteringSamples === 'number'
    && Number.isFinite(meteringSamples)
    && meteringSamples > 0
    && (typeof voicedMeteringSamples !== 'number'
      || !Number.isFinite(voicedMeteringSamples)
      || voicedMeteringSamples < minVoicedMeteringSamples)
  ) {
    return {
      failure_code: 'mobile_voice_recording_silence',
      error_class: 'MobileVoiceRecordingSilence',
    }
  }

  return null
}

export type MobileVoiceEndpointingAction =
  | 'continue'
  | 'finish'
  | 'discard_silence'

export type MobileVoiceEndpointingDecision = {
  action: MobileVoiceEndpointingAction
  reason: string
}

export type MobileVoiceEndpointingInput = {
  recordingActive?: boolean
  isRecording?: boolean
  durationMs?: number | null
  nowMs?: number
  startedAtMs?: number | null
  lastSpeechAtMs?: number | null
  speechMs?: number | null
  minTurnMs?: number
  minSpeechMs?: number
  silenceAfterSpeechMs?: number
  noSpeechTimeoutMs?: number
  maxTurnMs?: number
  maxTurnAfterSpeechMs?: number
  qualityFirst?: boolean
}

export function mobileVoiceAdaptiveSilenceAfterSpeechMs(input: {
  baseSilenceAfterSpeechMs?: number
  speechMs?: number | null
  qualityFirst?: boolean
}): number {
  const base = Math.max(0, Math.round(input.baseSilenceAfterSpeechMs ?? 18_000))
  if (input.qualityFirst !== true) return base

  const speechMs = Math.max(0, Math.round(input.speechMs ?? 0))
  if (speechMs < 12_000) return base

  const extraMs = Math.min(24_000, Math.round(speechMs * 0.18))
  return Math.max(base, Math.min(45_000, base + extraMs))
}

export function mobileVoiceMeteringIsSpeech(
  metering?: number | null,
  thresholdDb = -50,
): boolean {
  if (typeof metering !== 'number' || !Number.isFinite(metering)) return false
  return metering >= thresholdDb
}

export function mobileVoiceSpeechChunkTimeoutMs(text?: string | null): number {
  const normalized = typeof text === 'string' ? text.trim() : ''
  if (normalized === '') return 8_000

  const wordCount = normalized.split(/\s+/u).filter(Boolean).length
  if (wordCount >= 100) return 45_000

  return 8_000
}

export function mobileVoiceEndpointingDecision(
  input: MobileVoiceEndpointingInput,
): MobileVoiceEndpointingDecision {
  if (input.recordingActive !== true || input.isRecording !== true) {
    return { action: 'continue', reason: 'not_recording' }
  }

  const now = Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now()
  const durationMs = Math.max(0, Math.round(input.durationMs ?? (
    input.startedAtMs != null ? now - input.startedAtMs : 0
  )))
  const speechMs = Math.max(0, Math.round(input.speechMs ?? 0))
  const minTurnMs = Math.max(0, Math.round(input.minTurnMs ?? 5_000))
  const minSpeechMs = Math.max(0, Math.round(input.minSpeechMs ?? 2_000))
  const silenceAfterSpeechMs = mobileVoiceAdaptiveSilenceAfterSpeechMs({
    baseSilenceAfterSpeechMs: input.silenceAfterSpeechMs ?? 12_000,
    speechMs,
    qualityFirst: input.qualityFirst,
  })
  const noSpeechTimeoutMs = Math.max(minTurnMs, Math.round(input.noSpeechTimeoutMs ?? 60_000))
  const maxTurnMs = Math.max(noSpeechTimeoutMs, Math.round(input.maxTurnMs ?? 1_800_000))
  const maxTurnAfterSpeechMs = Math.max(minTurnMs, Math.round(input.maxTurnAfterSpeechMs ?? 120_000))
  const hasEnoughSpeech = speechMs >= minSpeechMs

  if (durationMs >= maxTurnMs) {
    return hasEnoughSpeech
      ? { action: 'finish', reason: 'max_turn_reached' }
      : { action: 'discard_silence', reason: 'max_turn_without_speech' }
  }

  if (!hasEnoughSpeech) {
    if (durationMs >= noSpeechTimeoutMs) {
      return { action: 'discard_silence', reason: 'no_speech_timeout' }
    }
    return { action: 'continue', reason: 'waiting_for_speech' }
  }

  if (durationMs < minTurnMs) {
    return { action: 'continue', reason: 'min_turn_not_reached' }
  }

  if (durationMs >= maxTurnAfterSpeechMs) {
    return { action: 'finish', reason: 'quality_turn_limit_reached' }
  }

  const lastSpeechAtMs = input.lastSpeechAtMs
  if (typeof lastSpeechAtMs !== 'number' || !Number.isFinite(lastSpeechAtMs)) {
    return { action: 'continue', reason: 'waiting_for_silence_anchor' }
  }

  const silenceMs = Math.max(0, Math.round(now - lastSpeechAtMs))
  if (silenceMs >= silenceAfterSpeechMs) {
    return { action: 'finish', reason: 'silence_after_speech' }
  }

  return { action: 'continue', reason: 'speech_or_short_pause' }
}

export function mobileVoiceUiWatchdogDecision(state?: string | null): MobileVoiceUiWatchdogDecision | null {
  if (state === 'transcribing') {
    return {
      timeoutMs: 305_000,
      failureCode: 'mobile_voice_transcription_ui_watchdog_timeout',
      errorClass: 'MobileVoiceTranscriptionUiWatchdogTimeout',
    }
  }

  if (state === 'thinking') {
    return {
      timeoutMs: 120_000,
      failureCode: 'mobile_voice_thinking_ui_watchdog_timeout',
      errorClass: 'MobileVoiceThinkingUiWatchdogTimeout',
    }
  }

  return null
}

export function mobileVoiceTraceTerminalFailure(input: MobileVoiceTraceTerminalFailureInput): MobileVoiceDispatchFailure | null {
  if (input.status !== 'failed' && input.status !== 'cancelled') return null

  const failedJob = input.jobs?.map(recordFromUnknown).find((job) => job?.status === 'failed')
  const job = recordFromUnknown(input.job) ?? failedJob ?? recordFromUnknown(input.jobs?.[0])
  const errorCode = stringFromRecord(job, 'error_code')
  const errorMessage = stringFromRecord(job, 'error_message')

  return {
    failure_code: input.status === 'cancelled'
      ? 'mobile_voice_trace_cancelled'
      : 'mobile_voice_trace_failed',
    error_class: errorCode
      ?? (errorMessage ? 'AiJobFailed' : input.status === 'cancelled' ? 'AiTraceCancelled' : 'AiTraceFailed'),
  }
}

export function mobileVoiceEmptyResponseFailure(input: MobileVoiceEmptyResponseFailureInput): MobileVoiceDispatchFailure | null {
  if (input.status !== 'succeeded') return null
  if (typeof input.response_text === 'string' && input.response_text.trim() !== '') return null

  return {
    failure_code: 'mobile_voice_empty_response',
    error_class: 'AiTraceEmptyResponse',
  }
}

function recordFromUnknown(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringFromRecord(record: Record<string, unknown> | null, key: string): string | null {
  const value = record?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function stringOrNull(value: string | null | undefined): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function booleanFromRecord(record: Record<string, unknown> | null, key: string): boolean | null {
  const value = record?.[key]
  return typeof value === 'boolean' ? value : null
}

function stringArrayFromUnknown(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : []
}

function sha256HashFromRecord(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value.trim()) ? value.trim().toLowerCase() : undefined
}

function idempotencyFragment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 160) || 'unknown'
}
