import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  mobileVoiceInterruptIdempotencyKey,
  mobileVoiceDispatchFailureFromResult,
  mobileVoiceDispatchTraceFromResult,
  mobileVoiceEmptyResponseFailure,
  mobileVoiceEndpointingDecision,
  mobileVoiceAdaptiveSilenceAfterSpeechMs,
  mobileVoiceInterruptionStage,
  mobileVoiceMeteringIsSpeech,
  mobileVoiceMetricMs,
  mobileVoiceCanStartRecording,
  mobileVoiceOpenBlockReason,
  mobileVoicePlayedIdempotencyKey,
  mobileVoiceReadinessSummary,
  mobileVoiceRecordingValidationFailure,
  mobileVoiceRecordingBlockReason,
  mobileVoiceRuntimeFailureHash,
  mobileVoiceRuntimeFailedIdempotencyKey,
  mobileVoiceSessionCloseStrategy,
  mobileVoiceSessionDeferredCloseOutcome,
  mobileVoiceSessionStartOutcome,
  mobileVoiceSessionStartTelemetry,
  mobileVoiceShouldRecordInterruption,
  mobileVoiceSessionEndIdempotencyKey,
  mobileVoiceSessionStartIdempotencyKey,
  mobileVoiceSynthesizedIdempotencyKey,
  mobileVoiceTraceLookupPollFailureSignal,
  mobileVoiceTraceTerminalFailure,
  mobileVoiceTurnIdempotencyKey,
  mobileVoiceUiWatchdogDecision,
  mobileVoiceStaleDispatchFailure,
  newMobileVoiceRuntimeId,
} from '../lib/atlasVoiceRuntime'
import { sha256Hex } from '../lib/sha256'

{
  const first = newMobileVoiceRuntimeId('Mobile Voice Turn')
  const second = newMobileVoiceRuntimeId('Mobile Voice Turn')
  assert.match(first, /^mobile_voice_turn_[a-z0-9]+_[a-z0-9]+$/)
  assert.match(second, /^mobile_voice_turn_[a-z0-9]+_[a-z0-9]+$/)
}

{
  assert.equal(mobileVoiceMetricMs(undefined), undefined)
  assert.equal(mobileVoiceMetricMs(null), undefined)
  assert.equal(mobileVoiceMetricMs(Number.NaN), undefined)
  assert.equal(mobileVoiceMetricMs(Number.POSITIVE_INFINITY), undefined)
  assert.equal(mobileVoiceMetricMs(-12.4), 0)
  assert.equal(mobileVoiceMetricMs(12.4), 12)
  assert.equal(mobileVoiceMetricMs(12.5), 13)
}

{
  assert.equal(mobileVoiceOpenBlockReason({ modeOpen: true }), 'already_open')
  assert.equal(mobileVoiceOpenBlockReason({ sessionId: 'session-1' }), 'session_active')
  assert.equal(mobileVoiceOpenBlockReason({ sessionId: '   ', recordingActive: true }), 'recording_active')
  assert.equal(mobileVoiceOpenBlockReason({ ending: true }), 'session_closing')
  assert.equal(mobileVoiceOpenBlockReason({}), null)
}

{
  assert.equal(mobileVoiceMeteringIsSpeech(undefined), false)
  assert.equal(mobileVoiceMeteringIsSpeech(Number.NaN), false)
  assert.equal(mobileVoiceMeteringIsSpeech(-70), false)
  assert.equal(mobileVoiceMeteringIsSpeech(-50), true)
  assert.equal(mobileVoiceMeteringIsSpeech(-32), true)
}

{
  const ready = {
    modeOpen: true,
    sessionId: 'voice-session-1',
    sessionReady: true,
    state: 'listening',
  }
  assert.equal(mobileVoiceCanStartRecording(ready), true)
  assert.equal(mobileVoiceCanStartRecording({ ...ready, state: 'speaking' }), true)
  assert.equal(mobileVoiceCanStartRecording({ ...ready, modeOpen: false }), false)
  assert.equal(mobileVoiceCanStartRecording({ ...ready, sessionId: null }), false)
  assert.equal(mobileVoiceCanStartRecording({ ...ready, sessionId: '   ' }), false)
  assert.equal(mobileVoiceCanStartRecording({ ...ready, sessionReady: false }), false)
  assert.equal(mobileVoiceCanStartRecording({ ...ready, state: 'starting' }), false)
  assert.equal(mobileVoiceCanStartRecording({ ...ready, state: 'failed' }), false)
  assert.equal(mobileVoiceCanStartRecording({ ...ready, recordingActive: true }), false)
  assert.equal(mobileVoiceCanStartRecording({ ...ready, operationInFlight: true }), false)
  assert.equal(mobileVoiceCanStartRecording({ ...ready, ending: true }), false)
  assert.equal(mobileVoiceRecordingBlockReason(ready), null)
  assert.equal(mobileVoiceRecordingBlockReason({ ...ready, modeOpen: false }), 'mode_closed')
  assert.equal(mobileVoiceRecordingBlockReason({ ...ready, sessionId: null }), 'missing_session')
  assert.equal(mobileVoiceRecordingBlockReason({ ...ready, sessionReady: false }), 'session_not_ready')
  assert.equal(mobileVoiceRecordingBlockReason({ ...ready, recordingActive: true }), 'recording_active')
  assert.equal(mobileVoiceRecordingBlockReason({ ...ready, operationInFlight: true }), 'operation_in_flight')
  assert.equal(mobileVoiceRecordingBlockReason({ ...ready, ending: true }), 'session_closing')
  assert.equal(mobileVoiceRecordingBlockReason({ ...ready, state: 'starting' }), 'session_starting')
  assert.equal(mobileVoiceRecordingBlockReason({ ...ready, state: 'failed' }), 'session_failed')
}

{
  assert.equal(mobileVoiceAdaptiveSilenceAfterSpeechMs({
    baseSilenceAfterSpeechMs: 18_000,
    speechMs: 8_000,
    qualityFirst: true,
  }), 18_000)
  assert.equal(mobileVoiceAdaptiveSilenceAfterSpeechMs({
    baseSilenceAfterSpeechMs: 18_000,
    speechMs: 60_000,
    qualityFirst: true,
  }), 28_800)
  assert.equal(mobileVoiceAdaptiveSilenceAfterSpeechMs({
    baseSilenceAfterSpeechMs: 18_000,
    speechMs: 300_000,
    qualityFirst: true,
  }), 42_000)
}

{
  const base = {
    recordingActive: true,
    isRecording: true,
    minTurnMs: 5_000,
    minSpeechMs: 2_000,
    silenceAfterSpeechMs: 18_000,
    noSpeechTimeoutMs: 90_000,
    maxTurnAfterSpeechMs: 120_000,
    maxTurnMs: 1_800_000,
    qualityFirst: true,
  }
  assert.deepEqual(
    mobileVoiceEndpointingDecision({
      ...base,
      durationMs: 3_000,
      nowMs: 3_000,
      speechMs: 0,
      lastSpeechAtMs: null,
    }),
    { action: 'continue', reason: 'waiting_for_speech' },
  )
  assert.deepEqual(
    mobileVoiceEndpointingDecision({
      ...base,
      durationMs: 90_200,
      nowMs: 90_200,
      speechMs: 0,
      lastSpeechAtMs: null,
    }),
    { action: 'discard_silence', reason: 'no_speech_timeout' },
  )
  assert.deepEqual(
    mobileVoiceEndpointingDecision({
      ...base,
      durationMs: 8_000,
      nowMs: 8_000,
      speechMs: 2_400,
      lastSpeechAtMs: 2_200,
    }),
    { action: 'continue', reason: 'speech_or_short_pause' },
  )
  assert.deepEqual(
    mobileVoiceEndpointingDecision({
      ...base,
      durationMs: 16_000,
      nowMs: 16_000,
      speechMs: 2_400,
      lastSpeechAtMs: 3_000,
    }),
    { action: 'continue', reason: 'speech_or_short_pause' },
  )
  assert.deepEqual(
    mobileVoiceEndpointingDecision({
      ...base,
      durationMs: 23_000,
      nowMs: 23_000,
      speechMs: 2_400,
      lastSpeechAtMs: 3_000,
    }),
    { action: 'finish', reason: 'silence_after_speech' },
  )
  assert.deepEqual(
    mobileVoiceEndpointingDecision({
      ...base,
      durationMs: 45_000,
      nowMs: 45_000,
      speechMs: 60_000,
      lastSpeechAtMs: 18_000,
    }),
    { action: 'continue', reason: 'speech_or_short_pause' },
  )
  assert.deepEqual(
    mobileVoiceEndpointingDecision({
      ...base,
      durationMs: 47_000,
      nowMs: 47_000,
      speechMs: 60_000,
      lastSpeechAtMs: 18_000,
    }),
    { action: 'finish', reason: 'silence_after_speech' },
  )
  assert.deepEqual(
    mobileVoiceEndpointingDecision({
      ...base,
      durationMs: 121_000,
      nowMs: 121_000,
      speechMs: 70_000,
      lastSpeechAtMs: 120_800,
    }),
    { action: 'finish', reason: 'quality_turn_limit_reached' },
  )
  assert.deepEqual(
    mobileVoiceEndpointingDecision({
      ...base,
      durationMs: 1_801_000,
      nowMs: 1_801_000,
      speechMs: 30_000,
      lastSpeechAtMs: 1_799_000,
    }),
    { action: 'finish', reason: 'max_turn_reached' },
  )
}

{
  const response = {
    status: 'session_ready',
    livekit_url: 'wss://livekit.example',
    participant_token: 'token.jwt.value',
    session: {
      session_id: 'session-1',
      room_name: 'atlas-voice-session-1',
      runtime: 'livekit_agents_sdk',
      transport: 'livekit_webrtc',
    },
    session_lease: {
      token_status: 'issued',
      livekit_url: 'wss://livekit.example',
    },
  }

  assert.deepEqual(
    mobileVoiceSessionStartTelemetry(response, {
      requestedSessionId: 'requested-session',
      startedAtMs: 1000,
      nowMs: 1570,
    }),
    {
      status: 'session_ready',
      sessionId: 'session-1',
      roomName: 'atlas-voice-session-1',
      runtime: 'livekit_agents_sdk',
      transport: 'livekit_webrtc',
      tokenStatus: 'issued',
      livekitUrlProvided: true,
      participantTokenProvided: true,
      latencyMs: 570,
    },
  )
  assert.deepEqual(
    mobileVoiceSessionStartTelemetry(null, {
      requestedSessionId: ' requested-session ',
      startedAtMs: 1000,
      nowMs: 900,
    }),
    {
      status: 'unknown',
      sessionId: 'requested-session',
      roomName: null,
      runtime: null,
      transport: null,
      tokenStatus: null,
      livekitUrlProvided: false,
      participantTokenProvided: false,
      latencyMs: 0,
    },
  )
  assert.deepEqual(
    mobileVoiceSessionStartOutcome(response, {
      requestedSessionId: 'requested-session',
      startedAtMs: 1000,
      nowMs: 1570,
    }),
    {
      telemetry: {
        status: 'session_ready',
        sessionId: 'session-1',
        roomName: 'atlas-voice-session-1',
        runtime: 'livekit_agents_sdk',
        transport: 'livekit_webrtc',
        tokenStatus: 'issued',
        livekitUrlProvided: true,
        participantTokenProvided: true,
        latencyMs: 570,
      },
      resolvedSessionId: 'session-1',
      sessionReady: true,
      modeState: 'listening',
      eventName: 'mobile_voice_session_start_succeeded',
      cleanupTimedOutSession: false,
    },
  )
  assert.deepEqual(
    mobileVoiceSessionStartOutcome(response, {
      requestedSessionId: 'requested-session',
      timedOut: true,
      startedAtMs: 1000,
      nowMs: 13_100,
    }),
    {
      telemetry: {
        status: 'session_ready',
        sessionId: 'session-1',
        roomName: 'atlas-voice-session-1',
        runtime: 'livekit_agents_sdk',
        transport: 'livekit_webrtc',
        tokenStatus: 'issued',
        livekitUrlProvided: true,
        participantTokenProvided: true,
        latencyMs: 12100,
      },
      resolvedSessionId: 'session-1',
      sessionReady: false,
      modeState: 'failed',
      eventName: 'mobile_voice_session_start_succeeded_after_timeout',
      cleanupTimedOutSession: true,
    },
  )
}

{
  const scaffold = {
    status: 'session_started_scaffold',
    session: {
      session_id: 'session-scaffold',
      room_name: 'atlas-voice-scaffold',
      runtime: 'livekit_agents_sdk',
      transport: 'mobile_push_to_talk',
    },
    session_lease: {
      token_status: 'issued',
      livekit_url: 'wss://livekit.example',
      access_token: 'token.jwt.value',
    },
  }

  const outcome = mobileVoiceSessionStartOutcome(scaffold, {
    requestedSessionId: 'session-scaffold',
    startedAtMs: 1000,
    nowMs: 1200,
  })

  assert.equal(outcome.sessionReady, false)
  assert.equal(outcome.modeState, 'failed')
  assert.equal(outcome.cleanupTimedOutSession, true)
}

{
  assert.equal(mobileVoiceSessionCloseStrategy({
    sessionId: null,
    sessionReady: false,
    startInFlight: false,
  }), 'skip_no_session')
  assert.equal(mobileVoiceSessionCloseStrategy({
    sessionId: '   ',
    sessionReady: true,
    startInFlight: true,
  }), 'skip_no_session')
  assert.equal(mobileVoiceSessionCloseStrategy({
    sessionId: 'session-1',
    sessionReady: true,
    startInFlight: false,
  }), 'end_now')
  assert.equal(mobileVoiceSessionCloseStrategy({
    sessionId: 'session-1',
    sessionReady: false,
    startInFlight: true,
  }), 'wait_for_start')
  assert.equal(mobileVoiceSessionCloseStrategy({
    sessionId: 'session-1',
    sessionReady: false,
    startInFlight: false,
  }), 'skip_no_session')
  assert.equal(
    mobileVoiceSessionDeferredCloseOutcome({ startConfirmed: true, startSettled: true }),
    'cleanup_after_start',
  )
  assert.equal(
    mobileVoiceSessionDeferredCloseOutcome({ startConfirmed: false, startSettled: true }),
    'start_failed',
  )
  assert.equal(
    mobileVoiceSessionDeferredCloseOutcome({ startConfirmed: false, startSettled: false }),
    'start_not_settled',
  )
}

{
  assert.equal(mobileVoiceInterruptionStage({ assistantStreaming: true }), 'assistant_streaming')
  assert.equal(mobileVoiceInterruptionStage({
    assistantStreaming: true,
    transcriptionPending: true,
    assistantThinking: true,
    state: 'thinking',
  }), 'assistant_streaming')
  assert.equal(mobileVoiceInterruptionStage({ transcriptionPending: true }), 'transcription_pending')
  assert.equal(mobileVoiceInterruptionStage({ state: 'transcribing' }), 'transcription_pending')
  assert.equal(mobileVoiceInterruptionStage({ assistantThinking: true }), 'assistant_thinking')
  assert.equal(mobileVoiceInterruptionStage({ state: 'thinking' }), 'assistant_thinking')
  assert.equal(mobileVoiceInterruptionStage({ state: 'speaking' }), 'tts_playback')
  assert.equal(mobileVoiceInterruptionStage({}), 'tts_playback')
}

{
  const ready = {
    hasRuntimeTurn: true,
    hasLifecycleKey: true,
    state: 'speaking',
  }
  assert.equal(mobileVoiceShouldRecordInterruption(ready), true)
  assert.equal(mobileVoiceShouldRecordInterruption({ ...ready, assistantActive: true, state: 'listening' }), true)
  assert.equal(mobileVoiceShouldRecordInterruption({ ...ready, pendingTraceLookup: true, state: 'listening' }), true)
  assert.equal(mobileVoiceShouldRecordInterruption({ ...ready, pendingAiInteraction: true, state: 'listening' }), true)
  assert.equal(mobileVoiceShouldRecordInterruption({ ...ready, hasRuntimeTurn: false }), false)
  assert.equal(mobileVoiceShouldRecordInterruption({ ...ready, hasLifecycleKey: false }), false)
  assert.equal(mobileVoiceShouldRecordInterruption({ ...ready, state: 'listening' }), false)
  assert.equal(mobileVoiceShouldRecordInterruption({ ...ready, playbackRecorded: true }), false)
  assert.equal(mobileVoiceShouldRecordInterruption({ ...ready, interruptionRecorded: true }), false)
}

{
  assert.equal(
    mobileVoiceSessionStartIdempotencyKey({ session_id: ' Session 1 ' }),
    'mobile-voice-session-session_1',
  )
  assert.equal(
    mobileVoiceTurnIdempotencyKey({ session_id: ' Session 1 ', turn_id: ' Turn 1 ' }),
    'mobile-voice-turn-session_1-turn_1',
  )
}

{
  const input = {
    session_id: 'session-1',
    turn_id: 'turn-1',
    response_text_hash: 'a'.repeat(64),
  }
  assert.equal(
    mobileVoiceSynthesizedIdempotencyKey(input),
    mobileVoiceSynthesizedIdempotencyKey(input),
  )
  assert.equal(
    mobileVoiceSynthesizedIdempotencyKey(input),
    `mobile-voice-synthesized-session-1-turn-1-${'a'.repeat(64)}`,
  )
}

{
  assert.equal(
    mobileVoiceSessionEndIdempotencyKey({
      session_id: 'Session 1',
      reason: 'operator closed mobile voice',
    }),
    'mobile-voice-session-end-session_1-operator_closed_mobile_voice',
  )
  assert.equal(
    mobileVoiceSessionEndIdempotencyKey({ session_id: 'session-1' }),
    mobileVoiceSessionEndIdempotencyKey({ session_id: 'session-1', reason: 'operator_finished' }),
  )
  assert.notEqual(
    mobileVoiceSessionEndIdempotencyKey({ session_id: 'session-1', reason: 'operator_finished' }),
    mobileVoiceSessionEndIdempotencyKey({ session_id: 'session-1', reason: 'app_backgrounded_mobile_voice' }),
  )
}

{
  assert.equal(
    mobileVoiceInterruptIdempotencyKey({
      session_id: 'session-1',
      turn_id: 'turn-1',
      reason: 'barge_in',
      interrupted_stage: 'tts_playback',
    }),
    'mobile-voice-interrupt-session-1-turn-1-barge_in-tts_playback',
  )
  assert.equal(
    mobileVoiceInterruptIdempotencyKey({
      session_id: ' Session 1 ',
      receipt_id: 'Receipt 9',
      reason: 'operator closed / mobile voice',
      interrupted_stage: 'tts playback',
    }),
    'mobile-voice-interrupt-session_1-receipt_9-operator_closed_mobile_voice-tts_playback',
  )
  assert.notEqual(
    mobileVoiceInterruptIdempotencyKey({
      session_id: 'session-1',
      turn_id: 'turn-1',
      reason: 'barge_in',
      interrupted_stage: 'tts_playback',
    }),
    mobileVoiceInterruptIdempotencyKey({
      session_id: 'session-1',
      turn_id: 'turn-1',
      reason: 'operator_closed_mobile_voice',
      interrupted_stage: 'tts_playback',
    }),
  )
}

{
  const input = {
    session_id: 'session-1',
    turn_id: 'turn-1',
  }
  assert.equal(
    mobileVoicePlayedIdempotencyKey(input),
    mobileVoicePlayedIdempotencyKey({ ...input }),
  )
  assert.equal(
    mobileVoicePlayedIdempotencyKey(input),
    'mobile-voice-played-session-1-turn-1',
  )
}

{
  const input = {
    session_id: 'session-1',
    turn_id: 'turn-1',
    failure_code: 'mobile_voice_tts_playback_failed',
  }
  assert.equal(
    mobileVoiceRuntimeFailedIdempotencyKey(input),
    'mobile-voice-runtime-failed-session-1-turn-1-mobile_voice_tts_playback_failed',
  )
  assert.equal(
    mobileVoiceRuntimeFailedIdempotencyKey({ session_id: 'session-1', turn_id: 'turn-1' }),
    'mobile-voice-runtime-failed-session-1-turn-1-unknown',
  )
  assert.equal(
    mobileVoiceRuntimeFailedIdempotencyKey({
      ...input,
      error_class: 'Speech Playback Timeout',
    }),
    'mobile-voice-runtime-failed-session-1-turn-1-mobile_voice_tts_playback_failed-speech_playback_timeout',
  )
  assert.notEqual(
    mobileVoiceRuntimeFailedIdempotencyKey({
      ...input,
      error_class: 'Speech Playback Timeout',
    }),
    mobileVoiceRuntimeFailedIdempotencyKey({
      ...input,
      error_class: 'Expo Speech Error',
    }),
  )
  assert.equal(
    mobileVoiceRuntimeFailedIdempotencyKey({
      ...input,
      error_message_hash: 'a'.repeat(64),
    }),
    `mobile-voice-runtime-failed-session-1-turn-1-mobile_voice_tts_playback_failed-${'a'.repeat(64)}`,
  )
  assert.notEqual(
    mobileVoiceRuntimeFailedIdempotencyKey({
      ...input,
      error_message_hash: 'a'.repeat(64),
    }),
    mobileVoiceRuntimeFailedIdempotencyKey({
      ...input,
      error_message_hash: 'b'.repeat(64),
    }),
  )
}

{
  assert.deepEqual(
    mobileVoiceReadinessSummary({
      status: 'ready',
      score: 100,
      missing_events: [],
      enterprise_mobile_loop: {
        status: 'promotion_evidence_ready',
        missing_promotion_events: [],
        gates: {
          healthy_loop_ready: true,
          interruption_drill_recorded: true,
          redacted_failure_drill_recorded: true,
          latency_slo_clean: true,
        },
      },
      review_signal: {
        recommended_action: 'voice_enterprise_loop_ready_for_promotion_review',
      },
    }),
    {
      status: 'ready',
      score: 100,
      ready: true,
      readyForPromotion: true,
      healthyLoopReady: true,
      interruptionDrillRecorded: true,
      redactedFailureDrillRecorded: true,
      latencySloClean: true,
      missingEvents: [],
      missingPromotionEvents: [],
      recommendedAction: 'voice_enterprise_loop_ready_for_promotion_review',
    },
  )
  assert.deepEqual(
    mobileVoiceReadinessSummary({
      status: 'ready',
      score: 100,
      missing_events: [],
      enterprise_mobile_loop: {
        status: 'needs_promotion_evidence',
        missing_promotion_events: ['VOICE_TURN_INTERRUPTED', 'VOICE_RUNTIME_FAILED'],
        gates: {
          healthy_loop_ready: true,
          interruption_drill_recorded: false,
          redacted_failure_drill_recorded: false,
          latency_slo_clean: true,
        },
      },
    }),
    {
      status: 'ready',
      score: 100,
      ready: true,
      readyForPromotion: false,
      healthyLoopReady: true,
      interruptionDrillRecorded: false,
      redactedFailureDrillRecorded: false,
      latencySloClean: true,
      missingEvents: [],
      missingPromotionEvents: ['VOICE_TURN_INTERRUPTED', 'VOICE_RUNTIME_FAILED'],
      recommendedAction: null,
    },
  )
  assert.equal(mobileVoiceReadinessSummary(null).ready, false)
}

{
  assert.equal(mobileVoiceDispatchTraceFromResult(null), null)
  assert.equal(mobileVoiceDispatchTraceFromResult({ status: 'ai_interaction_enqueued', dispatched: false, trace_id: 'trace-1' }), null)
  assert.equal(mobileVoiceDispatchTraceFromResult({ status: 'ai_interaction_enqueued', dispatched: true }), null)
  assert.deepEqual(
    mobileVoiceDispatchTraceFromResult({
      status: 'ai_interaction_enqueued',
      dispatched: true,
      trace_id: ' trace-1 ',
      thread_id: ' thread-1 ',
    }),
    { trace_id: 'trace-1', thread_id: 'thread-1' },
  )
  assert.deepEqual(
    mobileVoiceDispatchTraceFromResult({
      status: 'ai_interaction_dispatched',
      dispatched: true,
      trace_id: 'trace-2',
    }),
    { trace_id: 'trace-2', thread_id: null },
  )
}

{
  assert.equal(mobileVoiceDispatchFailureFromResult(null), null)
  assert.equal(mobileVoiceDispatchFailureFromResult({ status: 'ai_interaction_dispatched', dispatched: true }), null)
  assert.deepEqual(
    mobileVoiceDispatchFailureFromResult({
      status: 'transcription_failed',
      dispatched: false,
      error_class: 'WhisperTimeout',
    }),
    { failure_code: 'mobile_voice_transcription_failed', error_class: 'WhisperTimeout' },
  )
  assert.deepEqual(
    mobileVoiceDispatchFailureFromResult({
      status: 'blocked_transcript_persistence_not_allowed',
      dispatched: false,
    }),
    {
      failure_code: 'mobile_voice_dispatch_blocked',
      error_class: 'blocked_transcript_persistence_not_allowed',
    },
  )
  assert.deepEqual(
    mobileVoiceDispatchFailureFromResult({
      status: 'blocked_by_eclipse',
      dispatched: false,
    }),
    {
      failure_code: 'mobile_voice_dispatch_blocked',
      error_class: 'AtlasVoiceEclipseBlocked',
    },
  )
  assert.deepEqual(
    mobileVoiceDispatchFailureFromResult({
      status: 'skipped_empty_transcript',
      dispatched: false,
    }),
    { failure_code: 'mobile_voice_empty_transcript', error_class: 'skipped_empty_transcript' },
  )
  assert.deepEqual(
    mobileVoiceDispatchFailureFromResult({
      status: 'skipped_suspect_stt_ghost_transcript',
      dispatched: false,
    }),
    {
      failure_code: 'mobile_voice_suspect_transcript_discarded',
      error_class: 'SuspectSttGhostTranscript',
    },
  )
  assert.deepEqual(
    mobileVoiceDispatchFailureFromResult({
      status: 'ai_interaction_dispatch_failed',
      dispatched: false,
      error_class: 'AtlasApiError',
      error_message_hash: 'A'.repeat(64),
    }),
    {
      failure_code: 'mobile_voice_ai_dispatch_failed',
      error_class: 'AtlasApiError',
      error_message_hash: 'a'.repeat(64),
    },
  )
  assert.deepEqual(
    mobileVoiceDispatchFailureFromResult({
      status: 'ai_interaction_enqueue_failed',
      dispatched: false,
      error_class: 'AiGatewayUnavailable',
    }),
    { failure_code: 'mobile_voice_ai_dispatch_failed', error_class: 'AiGatewayUnavailable' },
  )
  assert.deepEqual(
    mobileVoiceDispatchFailureFromResult({
      status: 'unexpected_dispatch_status',
      dispatched: false,
    }),
    { failure_code: 'mobile_voice_ai_dispatch_not_dispatched', error_class: 'unexpected_dispatch_status' },
  )
}

{
  const now = Date.parse('2026-05-13T12:00:20.000Z')
  assert.equal(
    mobileVoiceStaleDispatchFailure({
      result: null,
      transcription_status: 'processing',
      updated_at: '2026-05-13T12:00:00.000Z',
      now_ms: now,
    }),
    null,
  )
  assert.equal(
    mobileVoiceStaleDispatchFailure({
      result: null,
      transcription_status: 'done',
      updated_at: '2026-05-13T12:00:10.000Z',
      now_ms: now,
      grace_ms: 12_000,
    }),
    null,
  )
  assert.deepEqual(
    mobileVoiceStaleDispatchFailure({
      result: null,
      transcription_status: 'done',
      updated_at: '2026-05-13T12:00:00.000Z',
      now_ms: now,
      grace_ms: 12_000,
    }),
    {
      failure_code: 'mobile_voice_dispatch_result_missing',
      error_class: 'VoiceDispatchResultMissing',
    },
  )
  assert.deepEqual(
    mobileVoiceStaleDispatchFailure({
      result: { status: 'unknown_shape' },
      transcription_status: 'done',
      updated_at: '2026-05-13T12:00:00.000Z',
      now_ms: now,
      grace_ms: 12_000,
    }),
    {
      failure_code: 'mobile_voice_dispatch_result_invalid',
      error_class: 'VoiceDispatchResultInvalid',
    },
  )
  assert.equal(
    mobileVoiceStaleDispatchFailure({
      result: null,
      transcription_status: 'done',
      updated_at: 'not-a-date',
      now_ms: now,
    }),
    null,
  )
}

{
  assert.deepEqual(
    mobileVoiceRecordingValidationFailure({ fileUri: null, durationMs: 1000 }),
    {
      failure_code: 'mobile_voice_recording_file_missing',
      error_class: 'MobileVoiceRecordingFileMissing',
    },
  )
  assert.deepEqual(
    mobileVoiceRecordingValidationFailure({ fileUri: 'file:///turn.m4a', durationMs: 449 }),
    {
      failure_code: 'mobile_voice_recording_too_short',
      error_class: 'MobileVoiceRecordingTooShort',
    },
  )
  assert.deepEqual(
    mobileVoiceRecordingValidationFailure({ fileUri: 'file:///turn.m4a', durationMs: Number.NaN }),
    {
      failure_code: 'mobile_voice_recording_too_short',
      error_class: 'MobileVoiceRecordingTooShort',
    },
  )
  assert.equal(
    mobileVoiceRecordingValidationFailure({ fileUri: 'file:///turn.m4a', durationMs: 450 }),
    null,
  )
  assert.deepEqual(
    mobileVoiceRecordingValidationFailure({
      fileUri: 'file:///turn.m4a',
      durationMs: 3200,
      meteringSamples: 12,
      voicedMeteringSamples: 0,
    }),
    {
      failure_code: 'mobile_voice_recording_silence',
      error_class: 'MobileVoiceRecordingSilence',
    },
  )
  assert.equal(
    mobileVoiceRecordingValidationFailure({
      fileUri: 'file:///turn.m4a',
      durationMs: 3200,
      meteringSamples: 12,
      voicedMeteringSamples: 3,
    }),
    null,
  )
  assert.deepEqual(
    mobileVoiceRecordingValidationFailure({
      fileUri: 'file:///turn.m4a',
      durationMs: 3200,
      meteringSamples: 12,
      voicedMeteringSamples: 3,
      minVoicedMeteringSamples: 8,
    }),
    {
      failure_code: 'mobile_voice_recording_silence',
      error_class: 'MobileVoiceRecordingSilence',
    },
  )
  assert.equal(
    mobileVoiceRecordingValidationFailure({
      fileUri: 'file:///turn.m4a',
      durationMs: 3200,
      meteringSamples: 0,
      voicedMeteringSamples: 0,
    }),
    null,
  )
}

{
  assert.deepEqual(
    mobileVoiceUiWatchdogDecision('transcribing'),
    {
      timeoutMs: 305000,
      failureCode: 'mobile_voice_transcription_ui_watchdog_timeout',
      errorClass: 'MobileVoiceTranscriptionUiWatchdogTimeout',
    },
  )
  assert.deepEqual(
    mobileVoiceUiWatchdogDecision('thinking'),
    {
      timeoutMs: 120000,
      failureCode: 'mobile_voice_thinking_ui_watchdog_timeout',
      errorClass: 'MobileVoiceThinkingUiWatchdogTimeout',
    },
  )
  assert.equal(mobileVoiceUiWatchdogDecision('speaking'), null)
  assert.equal(mobileVoiceUiWatchdogDecision('listening'), null)
}

{
  assert.equal(mobileVoiceTraceLookupPollFailureSignal({ consecutiveFailures: 0 }), null)
  assert.equal(mobileVoiceTraceLookupPollFailureSignal({ consecutiveFailures: 1 }), 'first_failure')
  assert.equal(mobileVoiceTraceLookupPollFailureSignal({ consecutiveFailures: 2 }), null)
  assert.equal(mobileVoiceTraceLookupPollFailureSignal({ consecutiveFailures: 5 }), 'repeated_failure')
  assert.equal(mobileVoiceTraceLookupPollFailureSignal({ consecutiveFailures: 10 }), 'repeated_failure')
}

{
  assert.equal(mobileVoiceTraceTerminalFailure({ status: 'processing' }), null)
  assert.deepEqual(
    mobileVoiceTraceTerminalFailure({
      status: 'failed',
      job: { status: 'failed', error_code: 'provider_timeout', error_message: 'timed out' },
    }),
    { failure_code: 'mobile_voice_trace_failed', error_class: 'provider_timeout' },
  )
  assert.deepEqual(
    mobileVoiceTraceTerminalFailure({
      status: 'failed',
      jobs: [
        { status: 'succeeded' },
        { status: 'failed', error_message: 'CLI failed' },
      ],
    }),
    { failure_code: 'mobile_voice_trace_failed', error_class: 'AiJobFailed' },
  )
  assert.deepEqual(
    mobileVoiceTraceTerminalFailure({ status: 'failed' }),
    { failure_code: 'mobile_voice_trace_failed', error_class: 'AiTraceFailed' },
  )
  assert.deepEqual(
    mobileVoiceTraceTerminalFailure({ status: 'cancelled' }),
    { failure_code: 'mobile_voice_trace_cancelled', error_class: 'AiTraceCancelled' },
  )
}

{
  assert.equal(mobileVoiceEmptyResponseFailure({ status: 'processing', response_text: '' }), null)
  assert.equal(mobileVoiceEmptyResponseFailure({ status: 'succeeded', response_text: 'resposta' }), null)
  assert.deepEqual(
    mobileVoiceEmptyResponseFailure({ status: 'succeeded', response_text: '   ' }),
    { failure_code: 'mobile_voice_empty_response', error_class: 'AiTraceEmptyResponse' },
  )
  assert.deepEqual(
    mobileVoiceEmptyResponseFailure({ status: 'succeeded', response_text: null }),
    { failure_code: 'mobile_voice_empty_response', error_class: 'AiTraceEmptyResponse' },
  )
}

void (async () => {
  {
    const normalized = await mobileVoiceRuntimeFailureHash({
      error_message_hash: 'A'.repeat(64),
    })
    assert.equal(normalized, 'a'.repeat(64))

    const redactedFallback = await mobileVoiceRuntimeFailureHash({
      failure_code: 'mobile_voice_tts_playback_failed',
      error_class: 'ExpoSpeechTimeout',
      error_message_hash: 'raw timeout message',
    })
    assert.equal(
      redactedFallback,
      await sha256Hex('atlas_mobile_voice_runtime_failed:mobile_voice_tts_playback_failed:ExpoSpeechTimeout'),
    )

    const defaultFallback = await mobileVoiceRuntimeFailureHash({})
    assert.equal(
      defaultFallback,
      await sha256Hex('atlas_mobile_voice_runtime_failed:unknown_failure:UnknownError'),
    )
  }

  {
    const sheetSource = fs.readFileSync(
      path.join(process.cwd(), 'components/sheets/AtlasAiSheet.tsx'),
      'utf8',
    )
    const packageJson = fs.readFileSync(
      path.join(process.cwd(), 'package.json'),
      'utf8',
    )

    assert.equal(sheetSource.includes('expo-speech'), false)
    assert.equal(sheetSource.includes('Speech.speak'), false)
    assert.equal(sheetSource.includes('Speech.stop'), false)
    assert.equal(sheetSource.includes('getAvailableVoicesAsync'), false)
    assert.equal(sheetSource.includes('synthesizeMobileVoiceTurn'), true)
    assert.equal(sheetSource.includes('createAudioPlayer'), true)
    assert.equal(sheetSource.includes('const MOBILE_VOICE_POST_PLAYBACK_MIC_GUARD_MS = 1_400'), true)
    assert.equal(sheetSource.includes('MOBILE_VOICE_POST_PLAYBACK_MIC_GUARD_MS - (Date.now() - playbackEndedAt)'), true)
    assert.equal(sheetSource.includes('const MOBILE_VOICE_SILENCE_AFTER_SPEECH_MS = 18_000'), true)
    assert.equal(sheetSource.includes('const MOBILE_VOICE_NO_SPEECH_TIMEOUT_MS = 90_000'), true)
    assert.equal(sheetSource.includes('const MOBILE_VOICE_QUALITY_FIRST_ENDPOINTING = true'), true)
    assert.equal(sheetSource.includes("endpointing_profile: 'quality_first'"), true)
    assert.equal(sheetSource.includes('ai_thread_id: currentThreadId'), true)
    assert.equal(sheetSource.includes("setVoiceModeState('listening')"), true)
    assert.equal(packageJson.includes('"expo-speech"'), false)
  }

  console.info('mobile voice runtime tests passed')
})()
