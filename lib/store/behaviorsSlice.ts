import { patchBehavior as patchServerBehavior, type AtlasBehavior } from '../api/client'
import { behaviorFactorPayload, canonicalBehaviorCategory, normalizeBehaviorFactor } from '../bitaculaFactors'
import { buildHealthSnapshotInputs } from '../healthSnapshots'
import {
  LOCAL_ID_PREFIX,
  isPromptableLifecycle,
  localDateKey,
  mergeBehaviors,
  mergeCheckins,
  mergePassiveSignals,
  mergeQueuedBehaviorLogs,
  mergeQueuedBehaviors,
  mergeQueuedHealthSnapshots,
  numericValueForBehavior,
  queuedToCheckin,
  queuedToPassiveSignal,
  uniqueBehaviorSlug,
  type QueuedBehavior,
  type QueuedBehaviorLog,
  type QueuedCheckin,
  type QueuedHealthSnapshot,
  type QueuedPassiveSignal,
} from '../storeConverters'
import {
  DEFAULT_BEHAVIOR_PRIORITY_SCORE,
  clampLevel,
  deterministicUuid,
  deviceTimezone,
  newClientId,
  preserveExistingValidSleepSnapshot,
  visibleBehaviors,
  visibleDigitalActivitySnapshots,
  visibleHealthSnapshots,
} from './internals'
import { persist } from './persistence'
import type { AtlasGet, AtlasSet, AtlasState } from './types'

export type BehaviorsSlice = Pick<
  AtlasState,
  | 'checkins'
  | 'behaviors'
  | 'behaviorLogs'
  | 'passiveSignals'
  | 'queuedCheckins'
  | 'queuedBehaviors'
  | 'queuedBehaviorLogs'
  | 'queuedPassiveSignals'
  | 'createCheckin'
  | 'createPassiveSignal'
  | 'createBehavior'
  | 'updateBehavior'
  | 'logBehavior'
>

export const createBehaviorsSlice = (set: AtlasSet, get: AtlasGet): BehaviorsSlice => ({
  checkins: [],
  behaviors: [],
  behaviorLogs: [],
  passiveSignals: [],
  queuedCheckins: [],
  queuedBehaviors: [],
  queuedBehaviorLogs: [],
  queuedPassiveSignals: [],

  createCheckin: async (input) => {
    const clientId = newClientId()
    const queued: QueuedCheckin = {
      client_id: clientId,
      state: input.state,
      energy_level: clampLevel(input.energyLevel),
      mood_level: clampLevel(input.moodLevel),
      note: input.note ?? null,
      recorded_at: new Date().toISOString(),
      recorded_timezone: deviceTimezone(),
      metadata: input.metadata ?? {},
      attempts: 0,
      last_error: null,
    }
    const currentState = get()
    const passiveSignals = mergePassiveSignals([
      ...currentState.passiveSignals,
      ...currentState.queuedPassiveSignals.map(queuedToPassiveSignal),
    ])
    const checkins = mergeCheckins([
      ...currentState.checkins,
      ...currentState.queuedCheckins.map(queuedToCheckin),
      queuedToCheckin(queued),
    ])
    const digitalActivitySnapshots = visibleDigitalActivitySnapshots(currentState)
    const existingHealthSnapshots = visibleHealthSnapshots(currentState)
    const queuedSnapshots = buildHealthSnapshotInputs({
      healthSignals: passiveSignals.filter((signal) => signal.source === 'healthkit'),
      allSignals: passiveSignals,
      digitalActivitySnapshots,
      checkins,
      dates: [localDateKey(new Date(queued.recorded_at))],
    }).map((snapshot): QueuedHealthSnapshot => ({
      ...preserveExistingValidSleepSnapshot(snapshot, existingHealthSnapshots),
      attempts: 0,
      last_error: null,
    }))

    set((state) => ({
      queuedCheckins: [queued, ...state.queuedCheckins],
      queuedHealthSnapshots: mergeQueuedHealthSnapshots([...queuedSnapshots, ...state.queuedHealthSnapshots]),
    }))
    await persist(get())
    void get().sync()

    return clientId
  },

  createPassiveSignal: async (input) => {
    const clientId = newClientId()
    const startedAt = input.startedAt ?? new Date().toISOString()
    const queued: QueuedPassiveSignal = {
      client_id: clientId,
      source: input.source,
      signal_type: input.signalType,
      value_numeric: input.valueNumeric ?? null,
      value_text: input.valueText ?? null,
      unit: input.unit ?? null,
      started_at: startedAt,
      ended_at: input.endedAt ?? null,
      recorded_timezone: deviceTimezone(),
      metadata: input.metadata ?? {},
      attempts: 0,
      last_error: null,
    }
    const currentState = get()
    const passiveSignals = mergePassiveSignals([
      ...currentState.passiveSignals,
      ...currentState.queuedPassiveSignals.map(queuedToPassiveSignal),
      queuedToPassiveSignal(queued),
    ])
    const checkins = mergeCheckins([
      ...currentState.checkins,
      ...currentState.queuedCheckins.map(queuedToCheckin),
    ])
    const digitalActivitySnapshots = visibleDigitalActivitySnapshots(currentState)
    const existingHealthSnapshots = visibleHealthSnapshots(currentState)
    const queuedSnapshots = buildHealthSnapshotInputs({
      healthSignals: passiveSignals.filter((signal) => signal.source === 'healthkit'),
      allSignals: passiveSignals,
      digitalActivitySnapshots,
      checkins,
      dates: [localDateKey(new Date(startedAt))],
    }).map((snapshot): QueuedHealthSnapshot => ({
      ...preserveExistingValidSleepSnapshot(snapshot, existingHealthSnapshots),
      attempts: 0,
      last_error: null,
    }))

    set((state) => ({
      queuedPassiveSignals: [queued, ...state.queuedPassiveSignals],
      queuedHealthSnapshots: mergeQueuedHealthSnapshots([...queuedSnapshots, ...state.queuedHealthSnapshots]),
    }))
    await persist(get())
    void get().sync()

    return clientId
  },

  createBehavior: async (input) => {
    const clientId = newClientId()
    const name = input.name.trim()
    if (!name) {
      throw new Error('Informe o fator da Bitácula.')
    }

    if (input.showInMorningBriefing !== false) {
      const activeCount = visibleBehaviors(get()).filter((behavior) => (
        !behavior.archived_at && behavior.show_in_morning_briefing
      )).length

      if (activeCount >= 12) {
        throw new Error('A Bitácula aceita no máximo 12 fatores ativos no briefing.')
      }
    }

    const slug = uniqueBehaviorSlug(name, get())
    const normalizedFactor = normalizeBehaviorFactor(name)
    const factorPayload = behaviorFactorPayload(normalizedFactor)
    const queued: QueuedBehavior = {
      client_id: clientId,
      name,
      slug,
      category: canonicalBehaviorCategory(input.category ?? normalizedFactor?.category ?? 'outro'),
      input_type: input.inputType ?? 'yes_no',
      question_text: input.questionText?.trim() || normalizedFactor?.questionText || `${name} aconteceu ontem?`,
      default_value: 'no',
      parent_factor: input.parentFactor ?? factorPayload.parent_factor ?? null,
      factor_condition: input.factorCondition ?? factorPayload.factor_condition ?? null,
      target_outcomes: input.targetOutcomes ?? factorPayload.target_outcomes ?? [],
      expected_lag: input.expectedLag ?? factorPayload.expected_lag ?? null,
      expected_direction: input.expectedDirection ?? factorPayload.expected_direction ?? null,
      granularity_level: input.granularityLevel ?? factorPayload.granularity_level ?? 'binary',
      sensitivity_level: input.sensitivityLevel ?? factorPayload.sensitivity_level ?? 'normal',
      derived_from: input.derivedFrom ?? factorPayload.derived_from ?? {},
      operator_confirmed: input.operatorConfirmed ?? factorPayload.operator_confirmed ?? true,
      created_by: 'operator',
      source_capture_ids: [],
      activation_rules: {},
      lifecycle_status: input.lifecycleStatus ?? (input.showInMorningBriefing === false ? 'manual_only' : 'active'),
      paused_until: null,
      last_prompted_at: null,
      prompt_cadence_days: 1,
      auto_suppress_reason: null,
      show_in_morning_briefing: input.showInMorningBriefing ?? isPromptableLifecycle(input.lifecycleStatus ?? 'active'),
      priority_score: DEFAULT_BEHAVIOR_PRIORITY_SCORE,
      relational_privacy: input.relationalPrivacy ?? false,
      activated_at: new Date().toISOString(),
      archived_at: null,
      metadata: input.metadata ?? {},
      attempts: 0,
      last_error: null,
    }

    set((state) => ({ queuedBehaviors: mergeQueuedBehaviors([queued, ...state.queuedBehaviors]) }))
    await persist(get())
    void get().sync()

    return clientId
  },

  updateBehavior: async (clientId, patch) => {
    const state = get()
    const current = visibleBehaviors(state).find((behavior) => behavior.client_id === clientId)
    if (!current) {
      throw new Error('Fator não encontrado.')
    }

    const nextLifecycle = patch.lifecycleStatus ?? current.lifecycle_status
    const nextShowInBriefing = patch.showInMorningBriefing ?? isPromptableLifecycle(nextLifecycle)
    const serverPatch = {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.questionText !== undefined ? { question_text: patch.questionText.trim() } : {}),
      ...(patch.category !== undefined ? { category: canonicalBehaviorCategory(patch.category) } : {}),
      ...(patch.lifecycleStatus !== undefined ? { lifecycle_status: patch.lifecycleStatus } : {}),
      ...(patch.pausedUntil !== undefined ? { paused_until: patch.pausedUntil } : {}),
      ...(patch.autoSuppressReason !== undefined ? { auto_suppress_reason: patch.autoSuppressReason } : {}),
      ...(patch.archivedAt !== undefined ? { archived_at: patch.archivedAt } : {}),
      show_in_morning_briefing: nextShowInBriefing,
      ...(patch.metadata !== undefined ? { metadata: { ...current.metadata, ...patch.metadata } } : {}),
    }

    const applyLocal = (behavior: AtlasBehavior): AtlasBehavior => ({
      ...behavior,
      ...(serverPatch.name !== undefined ? { name: serverPatch.name } : {}),
      ...(serverPatch.question_text !== undefined ? { question_text: serverPatch.question_text } : {}),
      ...(serverPatch.category !== undefined ? { category: canonicalBehaviorCategory(serverPatch.category) } : {}),
      ...(serverPatch.lifecycle_status !== undefined ? { lifecycle_status: serverPatch.lifecycle_status } : {}),
      ...(serverPatch.paused_until !== undefined ? { paused_until: serverPatch.paused_until } : {}),
      ...(serverPatch.auto_suppress_reason !== undefined ? { auto_suppress_reason: serverPatch.auto_suppress_reason } : {}),
      ...(serverPatch.archived_at !== undefined ? { archived_at: serverPatch.archived_at } : {}),
      show_in_morning_briefing: serverPatch.show_in_morning_briefing,
      metadata: serverPatch.metadata ?? behavior.metadata,
      updated_at: new Date().toISOString(),
    })

    set((local) => ({
      behaviors: local.behaviors.map((behavior) => behavior.client_id === clientId ? applyLocal(behavior) : behavior),
      queuedBehaviors: local.queuedBehaviors.map((behavior) => behavior.client_id === clientId
        ? {
            ...behavior,
            ...(serverPatch.name !== undefined ? { name: serverPatch.name } : {}),
            ...(serverPatch.question_text !== undefined ? { question_text: serverPatch.question_text } : {}),
            ...(serverPatch.category !== undefined ? { category: canonicalBehaviorCategory(serverPatch.category) } : {}),
            ...(serverPatch.lifecycle_status !== undefined ? { lifecycle_status: serverPatch.lifecycle_status } : {}),
            ...(serverPatch.paused_until !== undefined ? { paused_until: serverPatch.paused_until } : {}),
            ...(serverPatch.auto_suppress_reason !== undefined ? { auto_suppress_reason: serverPatch.auto_suppress_reason } : {}),
            ...(serverPatch.archived_at !== undefined ? { archived_at: serverPatch.archived_at } : {}),
            show_in_morning_briefing: serverPatch.show_in_morning_briefing,
            metadata: serverPatch.metadata ?? behavior.metadata,
          }
        : behavior),
    }))
    await persist(get())

    if (!current.id.startsWith(LOCAL_ID_PREFIX)) {
      const updated = await patchServerBehavior(current.id, serverPatch)
      set((local) => ({ behaviors: mergeBehaviors([updated, ...local.behaviors]) }))
      await persist(get())
    }
  },

  logBehavior: async (input) => {
    const logDate = input.logDate ?? localDateKey(new Date())
    const clientId = deterministicUuid(`behavior_log:${input.behaviorClientId}:${logDate}`)
    const queued: QueuedBehaviorLog = {
      client_id: clientId,
      behavior_client_id: input.behaviorClientId,
      log_date: logDate,
      value: input.value,
      numeric_value: input.numericValue ?? numericValueForBehavior(input.value),
      note: input.note ?? null,
      occurred_at: input.occurredAt ?? null,
      occurred_timezone: input.occurredAt ? deviceTimezone() : null,
      quantity_numeric: input.quantityNumeric ?? null,
      quantity_unit: input.quantityUnit ?? null,
      intensity: input.intensity ?? null,
      context: input.context ?? {},
      recorded_at: new Date().toISOString(),
      recorded_timezone: deviceTimezone(),
      source: input.source ?? 'morning_briefing',
      source_capture_id: null,
      auto_marked: false,
      confirmed_by_operator: true,
      confidence: null,
      inferred_by: null,
      consent_snapshot_id: null,
      reverted_at: null,
      metadata: input.metadata ?? {},
      attempts: 0,
      last_error: null,
    }

    set((state) => ({ queuedBehaviorLogs: mergeQueuedBehaviorLogs([queued, ...state.queuedBehaviorLogs]) }))
    await persist(get())
    void get().sync()

    return clientId
  },
})
