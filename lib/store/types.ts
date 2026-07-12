import type { StoreApi } from 'zustand'
import type {
  AtlasCapture,
  AtlasBehavior,
  AtlasBehaviorLog,
  AtlasCheckin,
  AtlasDailyMission,
  AtlasDigitalActivitySnapshot,
  AtlasDigitalSession,
  AtlasHealthSnapshot,
  AtlasPassiveSignal,
  CaptureTriageInput,
  CaptureTriageResponse,
  CreateAtlasDomainInput,
} from '../api/client'
import type { DomainKey } from '../domains'
import type { Domain } from '../domains'
import type { HealthKitLocalStatus } from '../healthKit'
import type { ScreenTimeLocalStatus } from '../screenTime'
import type {
  QueuedBehavior,
  QueuedBehaviorLog,
  QueuedCapture,
  QueuedCheckin,
  QueuedDigitalActivitySnapshot,
  QueuedDigitalSession,
  QueuedHealthSnapshot,
  QueuedPassiveSignal,
} from '../storeConverters'

export interface LocalQueueCounts {
  captures: number
  checkins: number
  behaviors: number
  behaviorLogs: number
  signals: number
  snapshots: number
  digitalSessions: number
  digitalSnapshots: number
  total: number
}

export interface LocalQueueLike {
  queuedCaptures: { length: number }
  queuedCheckins: { length: number }
  queuedBehaviors: { length: number }
  queuedBehaviorLogs: { length: number }
  queuedPassiveSignals: { length: number }
  queuedHealthSnapshots: { length: number }
  queuedDigitalSessions: { length: number }
  queuedDigitalActivitySnapshots: { length: number }
}

export interface PersistedAtlasState {
  captures: AtlasCapture[]
  domains: Domain[]
  checkins: AtlasCheckin[]
  behaviors: AtlasBehavior[]
  behaviorLogs: AtlasBehaviorLog[]
  passiveSignals: AtlasPassiveSignal[]
  healthSnapshots: AtlasHealthSnapshot[]
  digitalSessions: AtlasDigitalSession[]
  digitalActivitySnapshots: AtlasDigitalActivitySnapshot[]
  queuedCaptures: QueuedCapture[]
  queuedCheckins: QueuedCheckin[]
  queuedBehaviors: QueuedBehavior[]
  queuedBehaviorLogs: QueuedBehaviorLog[]
  queuedPassiveSignals: QueuedPassiveSignal[]
  queuedHealthSnapshots: QueuedHealthSnapshot[]
  queuedDigitalSessions: QueuedDigitalSession[]
  queuedDigitalActivitySnapshots: QueuedDigitalActivitySnapshot[]
  mission: AtlasDailyMission | null
  lastSyncAt: string | null
  serverReachable: boolean
  healthKit: HealthKitLocalStatus
  screenTime: ScreenTimeLocalStatus
}

interface CreateCaptureBase {
  domain: DomainKey
  capturedAt?: string
  capturedTimezone?: string
  capturedLat?: number | null
  capturedLng?: number | null
  metadata?: Record<string, unknown>
}

export interface CreateAudioCaptureInput extends CreateCaptureBase {
  fileUri: string
  durationMs?: number | null
}

export interface CreatePhotoCaptureInput extends CreateCaptureBase {
  fileUri: string
  mimeType?: string
}

export interface CreateTextCaptureInput extends CreateCaptureBase {
  text: string
}

export interface AtlasState extends PersistedAtlasState {
  hydrated: boolean
  syncing: boolean
  healthKitSyncing: boolean
  screenTimeSyncing: boolean
  lastError: string | null

  hydrate: () => Promise<void>
  refreshDomains: () => Promise<void>
  createDomain: (input: CreateAtlasDomainInput) => Promise<Domain | null>
  sync: () => Promise<void>
  refresh: () => Promise<void>
  loadMission: () => Promise<void>
  requestHealthKitPermissions: () => Promise<void>
  syncHealthKit: () => Promise<void>
  requestScreenTimePermissions: () => Promise<void>
  configureScreenTime: () => Promise<void>
  syncScreenTime: () => Promise<void>

  createAudioCapture: (input: CreateAudioCaptureInput) => Promise<string>
  createPhotoCapture: (input: CreatePhotoCaptureInput) => Promise<string>
  createTextCapture: (input: CreateTextCaptureInput) => Promise<string>
  createCheckin: (input: {
    state: AtlasCheckin['state']
    energyLevel: number
    moodLevel: number
    note?: string | null
    metadata?: Record<string, unknown>
  }) => Promise<string>
  createPassiveSignal: (input: {
    source: AtlasPassiveSignal['source']
    signalType: string
    valueNumeric?: number | null
    valueText?: string | null
    unit?: string | null
    startedAt?: string
    endedAt?: string | null
    metadata?: Record<string, unknown>
  }) => Promise<string>
  createBehavior: (input: {
    name: string
    category?: AtlasBehavior['category']
    inputType?: AtlasBehavior['input_type']
    questionText?: string
    parentFactor?: string | null
    factorCondition?: string | null
    targetOutcomes?: string[]
    expectedLag?: string | null
    expectedDirection?: string | null
    granularityLevel?: AtlasBehavior['granularity_level']
    sensitivityLevel?: AtlasBehavior['sensitivity_level']
    derivedFrom?: Record<string, unknown>
    operatorConfirmed?: boolean
    relationalPrivacy?: boolean
    lifecycleStatus?: AtlasBehavior['lifecycle_status']
    showInMorningBriefing?: boolean
    metadata?: Record<string, unknown>
  }) => Promise<string>
  updateBehavior: (clientId: string, patch: {
    name?: string
    questionText?: string
    category?: AtlasBehavior['category']
    lifecycleStatus?: AtlasBehavior['lifecycle_status']
    showInMorningBriefing?: boolean
    pausedUntil?: string | null
    archivedAt?: string | null
    autoSuppressReason?: string | null
    metadata?: Record<string, unknown>
  }) => Promise<void>
  logBehavior: (input: {
    behaviorClientId: string
    logDate?: string
    value: string
    numericValue?: number | null
    quantityNumeric?: number | null
    quantityUnit?: string | null
    intensity?: number | null
    occurredAt?: string | null
    note?: string | null
    source?: AtlasBehaviorLog['source']
    context?: Record<string, unknown>
    metadata?: Record<string, unknown>
  }) => Promise<string>
  updateCapture: (id: string, patch: Partial<Pick<AtlasCapture, 'domain' | 'content_text' | 'metadata'>>) => Promise<AtlasCapture | null>
  retryTranscription: (id: string) => Promise<AtlasCapture | null>
  clarifyCapture: (id: string) => Promise<AtlasCapture | null>
  triageCapture: (id: string, input: CaptureTriageInput) => Promise<CaptureTriageResponse | null>
  deleteCapture: (id: string) => Promise<boolean>
}

export type AtlasSet = StoreApi<AtlasState>['setState']
export type AtlasGet = StoreApi<AtlasState>['getState']
