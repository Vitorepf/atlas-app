// Pure derivation helpers shared verbatim between app/health.tsx and app/sleep.tsx.
// Extracted by runbook S-A1 (pure-function half). Behavior-preserving relocation.
// No JSX, no hooks — params + module-level only. Types come from real lib modules,
// never from a screen file.

import type { AtlasHealthSnapshot, AtlasPassiveSignal } from './api/client'
import type { QueuedPassiveSignal } from './atlasStore'
import type { SleepTargetEvidence } from './sleepTarget'
import { isMainSleepCandidate } from './sleepValidity'

export type HealthSignal = Pick<
  AtlasPassiveSignal,
  'id' | 'client_id' | 'source' | 'signal_type' | 'value_numeric' | 'value_text' | 'unit' | 'started_at' | 'ended_at' | 'recorded_timezone' | 'metadata'
>

// --- numeric ---
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * q
  const base = Math.floor(position)
  const rest = position - base
  const next = sorted[base + 1]
  return typeof next === 'number' ? sorted[base] + rest * (next - sorted[base]) : sorted[base]
}

export function average(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0) / values.length
}

// --- guards / snapshot readers ---
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function snapshotNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function snapshotDateKey(value: string): string {
  return value.slice(0, 10)
}

// --- formatting ---
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (totalMinutes < 60) return `${totalMinutes}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

// --- sleep snapshot derivations ---
export function snapshotSleepSortTime(snapshot: AtlasHealthSnapshot): number {
  const wakeTime = isRecord(snapshot.sleep) && typeof snapshot.sleep.wake_time === 'string'
    ? snapshot.sleep.wake_time
    : null
  const time = new Date(wakeTime ?? snapshot.computed_at ?? snapshot.snapshot_date).getTime()
  if (Number.isFinite(time)) return time
  return new Date(snapshotDateKey(snapshot.snapshot_date)).getTime()
}

export function snapshotSleepAwakeHours(snapshot: AtlasHealthSnapshot | null): number | null {
  if (!snapshot || !isRecord(snapshot.sleep)) return null
  return snapshotNumber(snapshot.sleep.awake_hours)
}

export function snapshotSleepInBedHours(snapshot: AtlasHealthSnapshot | null): number | null {
  if (!snapshot || !isRecord(snapshot.sleep)) return null
  const stored = snapshotNumber(snapshot.sleep.in_bed_hours)
  if (typeof stored === 'number') return stored
  const durationHours = snapshotNumber(snapshot.sleep.duration_hours) ?? snapshot.sleep_duration_hours
  const awakeHours = snapshotSleepAwakeHours(snapshot)
  if (typeof durationHours === 'number' && typeof awakeHours === 'number') {
    return durationHours + awakeHours
  }
  return null
}

export function snapshotSleepDate(snapshot: AtlasHealthSnapshot): string {
  if (isRecord(snapshot.sleep) && typeof snapshot.sleep.wake_time === 'string' && snapshot.sleep.wake_time.trim()) {
    return snapshot.sleep.wake_time
  }
  return snapshot.computed_at
}

export function hasValidSleepSnapshotData(snapshot: AtlasHealthSnapshot): boolean {
  const sleep = isRecord(snapshot.sleep) ? snapshot.sleep : null
  const durationHours = sleep ? snapshotNumber(sleep.duration_hours) ?? snapshot.sleep_duration_hours : snapshot.sleep_duration_hours
  const bedtime = sleep && typeof sleep.bedtime === 'string' ? sleep.bedtime : null
  const wakeTime = sleep && typeof sleep.wake_time === 'string' ? sleep.wake_time : null
  return isMainSleepCandidate({ asleepHours: durationHours, bedtime, wakeTime })
}

// --- sleep target labels ---
export function idealSleepStageHours(baseHours: number, minRatio: number, maxRatio: number): string {
  return `ideal ${formatHours(baseHours * minRatio)}-${formatHours(baseHours * maxRatio)}`
}

export function sleepTargetRowLabel(evidence: SleepTargetEvidence): string {
  if (
    evidence.sleepDebtAdjustmentHours > 0
    || evidence.strainAdjustmentHours > 0
    || evidence.napAdjustmentHours > 0
  ) {
    return 'Necessidade de sono'
  }
  return evidence.method === 'minimum' ? 'Mínimo aceitável' : 'Alvo de sono'
}

export function sleepNeedAdjustmentText(evidence: SleepTargetEvidence): string | null {
  const parts = [`base ${formatHours(evidence.baselineHours)}`]
  if (evidence.sleepDebtAdjustmentHours > 0) parts.push(`dívida +${formatHours(evidence.sleepDebtAdjustmentHours)}`)
  if (evidence.strainAdjustmentHours > 0) parts.push(`carga +${formatHours(evidence.strainAdjustmentHours)}`)
  if (evidence.napAdjustmentHours > 0) parts.push(`cochilo -${formatHours(evidence.napAdjustmentHours)}`)
  if (parts.length === 1) return null
  return parts.join(' · ')
}

// --- signals ---
export function queuedToSignal(signal: QueuedPassiveSignal): HealthSignal {
  return {
    id: `local:${signal.client_id}`,
    client_id: signal.client_id,
    source: signal.source,
    signal_type: signal.signal_type,
    value_numeric: signal.value_numeric ?? null,
    value_text: signal.value_text ?? null,
    unit: signal.unit ?? null,
    started_at: signal.started_at,
    ended_at: signal.ended_at ?? null,
    recorded_timezone: signal.recorded_timezone,
    metadata: signal.metadata ?? {},
  }
}

export function signalEndTime(signal: HealthSignal): number {
  return new Date(signal.ended_at ?? signal.started_at).getTime()
}
