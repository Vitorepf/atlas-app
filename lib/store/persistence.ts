// Store persistence: the MMKV `atlas.store.v1` data-safety block. Extracted
// verbatim from lib/atlasStore.ts (create() slice split, runbook R10). The
// persisted shape, STORAGE_KEY, initialPersistedState, normalizePersistedState
// and persist() are byte-identical to the original — do NOT change them.
import { atlasStorage } from '../storage'
import {
  type AtlasBehavior,
  type AtlasBehaviorLog,
  type AtlasCapture,
  type AtlasCheckin,
  type AtlasDigitalActivitySnapshot,
  type AtlasDigitalSession,
  type AtlasHealthSnapshot,
  type AtlasPassiveSignal,
} from '../api/client'
import { DEFAULT_DOMAINS, mergeDomains, type Domain } from '../domains'
import {
  mergeBehaviorLogs,
  mergeBehaviors,
  mergeCaptures,
  mergeCheckins,
  mergeDigitalActivitySnapshots,
  mergeDigitalSessions,
  mergeHealthSnapshots,
  mergePassiveSignals,
  mergeQueuedBehaviorLogs,
  mergeQueuedBehaviors,
  mergeQueuedCaptures,
  mergeQueuedCheckins,
  mergeQueuedDigitalActivitySnapshots,
  mergeQueuedDigitalSessions,
  mergeQueuedHealthSnapshots,
  mergeQueuedPassiveSignals,
  type QueuedBehavior,
  type QueuedBehaviorLog,
  type QueuedCapture,
  type QueuedCheckin,
  type QueuedDigitalActivitySnapshot,
  type QueuedDigitalSession,
  type QueuedHealthSnapshot,
  type QueuedPassiveSignal,
} from '../storeConverters'
import { normalizeQueuedBehavior, normalizeQueuedHealthSnapshot } from './internals'
import type { AtlasState, PersistedAtlasState } from './types'

export const STORAGE_KEY = 'atlas.store.v1'

export const initialPersistedState: PersistedAtlasState = {
  captures: [],
  domains: DEFAULT_DOMAINS,
  checkins: [],
  behaviors: [],
  behaviorLogs: [],
  passiveSignals: [],
  healthSnapshots: [],
  digitalSessions: [],
  digitalActivitySnapshots: [],
  queuedCaptures: [],
  queuedCheckins: [],
  queuedBehaviors: [],
  queuedBehaviorLogs: [],
  queuedPassiveSignals: [],
  queuedHealthSnapshots: [],
  queuedDigitalSessions: [],
  queuedDigitalActivitySnapshots: [],
  mission: null,
  lastSyncAt: null,
  serverReachable: false,
  healthKit: {
    available: false,
    enabled: false,
    lastSyncAt: null,
    lastError: null,
    lastSignalCount: 0,
    requestedTypeCount: 0,
    debugTrail: [],
    historyBackfilled: false,
    historyBackfilledAt: null,
    backgroundConfiguredAt: null,
  },
  screenTime: {
    available: false,
    enabled: false,
    authorizationStatus: null,
    lastSyncAt: null,
    lastError: null,
    lastSessionCount: 0,
    configuredBucketCount: 0,
    monitoringStartedAt: null,
    debugTrail: [],
    entitlementRequired: true,
    nativeModuleAvailable: false,
    qualityGate: 'unavailable',
  },
}

export function normalizePersistedState(raw: unknown): PersistedAtlasState {
  if (!raw || typeof raw !== 'object') return initialPersistedState

  const state = raw as Partial<PersistedAtlasState>
  return {
    captures: mergeCaptures(persistedItems<AtlasCapture>(state.captures)),
    domains: mergeDomains(persistedDomains(state.domains)),
    checkins: mergeCheckins(persistedItems<AtlasCheckin>(state.checkins)),
    behaviors: mergeBehaviors(persistedItems<AtlasBehavior>(state.behaviors)),
    behaviorLogs: mergeBehaviorLogs(persistedItems<AtlasBehaviorLog>(state.behaviorLogs)),
    passiveSignals: mergePassiveSignals(persistedItems<AtlasPassiveSignal>(state.passiveSignals)),
    healthSnapshots: mergeHealthSnapshots(persistedItems<AtlasHealthSnapshot>(state.healthSnapshots)),
    digitalSessions: mergeDigitalSessions(persistedItems<AtlasDigitalSession>(state.digitalSessions)),
    digitalActivitySnapshots: mergeDigitalActivitySnapshots(
      persistedItems<AtlasDigitalActivitySnapshot>(state.digitalActivitySnapshots),
    ),
    queuedCaptures: mergeQueuedCaptures(persistedItems<QueuedCapture>(state.queuedCaptures)),
    queuedCheckins: mergeQueuedCheckins(persistedItems<QueuedCheckin>(state.queuedCheckins)),
    queuedBehaviors: mergeQueuedBehaviors(
      persistedItems<QueuedBehavior>(state.queuedBehaviors).map(normalizeQueuedBehavior),
    ),
    queuedBehaviorLogs: mergeQueuedBehaviorLogs(persistedItems<QueuedBehaviorLog>(state.queuedBehaviorLogs)),
    queuedPassiveSignals: mergeQueuedPassiveSignals(persistedItems<QueuedPassiveSignal>(state.queuedPassiveSignals)),
    queuedHealthSnapshots: mergeQueuedHealthSnapshots(
      persistedItems<QueuedHealthSnapshot>(state.queuedHealthSnapshots).map(normalizeQueuedHealthSnapshot),
    ),
    queuedDigitalSessions: mergeQueuedDigitalSessions(
      persistedItems<QueuedDigitalSession>(state.queuedDigitalSessions),
    ),
    queuedDigitalActivitySnapshots: mergeQueuedDigitalActivitySnapshots(
      persistedItems<QueuedDigitalActivitySnapshot>(state.queuedDigitalActivitySnapshots),
    ),
    mission: state.mission ?? null,
    lastSyncAt: typeof state.lastSyncAt === 'string' ? state.lastSyncAt : null,
    serverReachable: false,
    healthKit: initialPersistedState.healthKit,
    screenTime: initialPersistedState.screenTime,
  }
}

function persistedItems<T extends { client_id: string }>(value: unknown): T[] {
  if (!Array.isArray(value)) return []
  return value.filter(hasClientId) as T[]
}

function persistedDomains(value: unknown): Domain[] {
  if (!Array.isArray(value)) return DEFAULT_DOMAINS
  return value
    .filter((domain): domain is Domain => (
      domain
      && typeof domain === 'object'
      && typeof (domain as Domain).key === 'string'
      && typeof (domain as Domain).label === 'string'
    ))
}

function hasClientId(value: unknown): value is { client_id: string } {
  return Boolean(
    value
    && typeof value === 'object'
    && 'client_id' in value
    && typeof (value as { client_id?: unknown }).client_id === 'string'
    && (value as { client_id: string }).client_id.trim().length > 0,
  )
}

export async function persist(state: AtlasState): Promise<void> {
  const payload: PersistedAtlasState = {
    captures: state.captures,
    domains: state.domains,
    checkins: state.checkins,
    behaviors: state.behaviors,
    behaviorLogs: state.behaviorLogs,
    passiveSignals: state.passiveSignals,
    healthSnapshots: state.healthSnapshots,
    digitalSessions: state.digitalSessions,
    digitalActivitySnapshots: state.digitalActivitySnapshots,
    queuedCaptures: state.queuedCaptures,
    queuedCheckins: state.queuedCheckins,
    queuedBehaviors: state.queuedBehaviors,
    queuedBehaviorLogs: state.queuedBehaviorLogs,
    queuedPassiveSignals: state.queuedPassiveSignals,
    queuedHealthSnapshots: state.queuedHealthSnapshots,
    queuedDigitalSessions: state.queuedDigitalSessions,
    queuedDigitalActivitySnapshots: state.queuedDigitalActivitySnapshots,
    mission: state.mission,
    lastSyncAt: state.lastSyncAt,
    serverReachable: state.serverReachable,
    healthKit: state.healthKit,
    screenTime: state.screenTime,
  }

  await atlasStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}
