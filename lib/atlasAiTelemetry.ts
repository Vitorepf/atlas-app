import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import {
  postAiTelemetryEvents,
  type AtlasAiTelemetryEventInput,
} from './api/client'

const TELEMETRY_OUTBOX_KEY = 'atlas-ai.telemetry-outbox.v1'
const TELEMETRY_MAX_EVENTS = 500
const TELEMETRY_FLUSH_BATCH = 80

let flushInFlight = false
let enqueueChain: Promise<void> = Promise.resolve()

type AtlasAiMobileTelemetryInput = Omit<
  AtlasAiTelemetryEventInput,
  'surface' | 'runtime' | 'occurred_at_client' | 'event_name'
> & {
  eventName: string
  event_name?: string
  metadata?: Record<string, unknown>
}

export function newAtlasAiCorrelationId(): string {
  return newTelemetryUuid()
}

export async function recordAtlasAiEvent(input: AtlasAiMobileTelemetryInput): Promise<void> {
  const eventName = input.eventName
  if (!eventName) return
  const eventInput: Partial<AtlasAiTelemetryEventInput> & { eventName?: string } = { ...input }
  delete eventInput.eventName
  delete eventInput.event_name

  const event: AtlasAiTelemetryEventInput = {
    ...eventInput,
    event_name: eventName,
    event_key: input.event_key ?? eventKey(eventName, input.correlation_id, input.client_id),
    surface: 'mobile',
    runtime: mobileRuntime(),
    occurred_at_client: new Date().toISOString(),
    schema_version: input.schema_version ?? 1,
  }

  enqueueChain = enqueueChain
    .catch(() => undefined)
    .then(async () => {
      const queue = await readTelemetryQueue()
      await writeTelemetryQueue([...queue, event].slice(-TELEMETRY_MAX_EVENTS))
      void flushAtlasAiTelemetry()
    })
    .catch(() => {
      // Telemetry must never block the Atlas AI interaction path.
    })

  try {
    await enqueueChain
  } catch {
    // The chain already catches failures; this keeps the public contract quiet.
  }
}

export async function flushAtlasAiTelemetry(): Promise<void> {
  if (flushInFlight) return
  flushInFlight = true

  try {
    await enqueueChain.catch(() => undefined)
    const queue = await readTelemetryQueue()
    if (queue.length === 0) return

    const batch = queue.slice(0, TELEMETRY_FLUSH_BATCH)
    await postAiTelemetryEvents(batch)

    const sentKeys = new Set(batch.map((event) => event.event_key).filter(Boolean))
    const latest = await readTelemetryQueue()
    await writeTelemetryQueue(latest.filter((event) => !event.event_key || !sentKeys.has(event.event_key)))
  } catch {
    // Keep the outbox for the next foreground/interaction flush.
  } finally {
    flushInFlight = false
  }
}

async function readTelemetryQueue(): Promise<AtlasAiTelemetryEventInput[]> {
  const raw = await AsyncStorage.getItem(TELEMETRY_OUTBOX_KEY)
  if (!raw) return []

  try {
    const value = JSON.parse(raw)
    if (!Array.isArray(value)) return []

    return value.filter(isTelemetryEvent)
  } catch {
    return []
  }
}

async function writeTelemetryQueue(events: AtlasAiTelemetryEventInput[]): Promise<void> {
  await AsyncStorage.setItem(TELEMETRY_OUTBOX_KEY, JSON.stringify(events.slice(-TELEMETRY_MAX_EVENTS)))
}

function isTelemetryEvent(value: unknown): value is AtlasAiTelemetryEventInput {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<AtlasAiTelemetryEventInput>
  return typeof record.event_name === 'string' && record.event_name.trim().length > 0
}

function mobileRuntime(): AtlasAiTelemetryEventInput['runtime'] {
  if (Platform.OS === 'ios') return 'ios'
  if (Platform.OS === 'android') return 'android'
  return null
}

function eventKey(eventName: string, correlationId?: string | null, clientId?: string | null): string {
  return [
    'mobile',
    sanitizeKeyPart(eventName),
    correlationId ?? clientId ?? 'no-correlation',
    Date.now(),
    newTelemetryUuid(),
  ].join(':')
}

function sanitizeKeyPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_.-]+/g, '_').slice(0, 60) || 'event'
}

function newTelemetryUuid(): string {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i
  const randomUuid = globalThis.crypto?.randomUUID?.()
  if (randomUuid && uuidPattern.test(randomUuid)) return randomUuid

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16)
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8
    return value.toString(16)
  })
}
