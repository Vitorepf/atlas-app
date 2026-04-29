import type {
  AtlasCheckin,
  AtlasPassiveSignal,
  StoreHealthSnapshotInput,
} from './api/client'
import { buildReadinessV1 } from './readiness'

type HealthSnapshotSignal = Pick<
  AtlasPassiveSignal,
  'client_id' | 'source' | 'signal_type' | 'value_numeric' | 'value_text' | 'unit' | 'started_at' | 'ended_at' | 'recorded_timezone' | 'metadata'
>

type HealthSnapshotCheckin = Pick<
  AtlasCheckin,
  'state' | 'energy_level' | 'mood_level' | 'recorded_at' | 'recorded_timezone'
>

const SNAPSHOT_SOURCE = 'atlas_app' as const
const DEFAULT_SNAPSHOT_DAYS = 60
const SLEEP_TARGET_HOURS = 7.5

export function buildHealthSnapshotInputs(input: {
  healthSignals: HealthSnapshotSignal[]
  allSignals?: HealthSnapshotSignal[]
  checkins: HealthSnapshotCheckin[]
  days?: number
  now?: Date
  timezone?: string
}): StoreHealthSnapshotInput[] {
  const now = input.now ?? new Date()
  const timezone = input.timezone ?? deviceTimezone()
  const days = Math.max(1, input.days ?? DEFAULT_SNAPSHOT_DAYS)
  const allSignals = input.allSignals ?? input.healthSignals
  const snapshots: StoreHealthSnapshotInput[] = []

  for (let offset = 0; offset < days; offset++) {
    const date = startOfLocalDay(now)
    date.setDate(date.getDate() - offset)
    const end = new Date(date)
    end.setDate(date.getDate() + 1)
    end.setMilliseconds(-1)
    const snapshotDate = localDateKey(date)

    const healthUntilEnd = input.healthSignals.filter((signal) => metricTime(signal) <= end.getTime())
    const allUntilEnd = allSignals.filter((signal) => metricTime(signal) <= end.getTime())
    const dayHealthSignals = input.healthSignals.filter((signal) => signalBelongsToDate(signal, snapshotDate))
    const dayAllSignals = allSignals.filter((signal) => signalBelongsToDate(signal, snapshotDate))
    const latestCheckin = latestCheckinForDate(input.checkins, snapshotDate)

    if (dayAllSignals.length === 0 && !latestCheckin && offset > 0) {
      continue
    }

    const readiness = buildReadinessV1({
      healthSignals: healthUntilEnd as AtlasPassiveSignal[],
      allSignals: allUntilEnd as AtlasPassiveSignal[],
      latestCheckin: latestCheckin as AtlasCheckin | null,
      now: offset === 0 ? now : end,
    })

    const sleep = sleepSummary(input.healthSignals, snapshotDate)
    const recovery = recoverySummary(dayHealthSignals)
    const load = loadSummary(dayHealthSignals)
    const subjective = subjectiveSummary(dayAllSignals, latestCheckin)
    const body = bodySummary(healthUntilEnd)
    const metrics = {
      snapshot_date: snapshotDate,
      snapshot_timezone: timezone,
      readiness_version: readiness.version,
      signal_count: dayAllSignals.length,
      generated_at: now.toISOString(),
      sources: sourceCounts(dayAllSignals),
    }

    snapshots.push({
      client_id: deterministicUuid(`health_snapshot:${SNAPSHOT_SOURCE}:${timezone}:${snapshotDate}`),
      source: SNAPSHOT_SOURCE,
      snapshot_date: snapshotDate,
      snapshot_timezone: timezone,
      computed_at: now.toISOString(),
      signal_count: dayAllSignals.length,
      readiness_score: intOrNull(readiness.base.score),
      current_score: intOrNull(readiness.current.score),
      body_score: intOrNull(readiness.body.score),
      mind_score: intOrNull(readiness.mind.score),
      drive_score: intOrNull(readiness.drive.score),
      sleep_score: intOrNull(readiness.sleep.score),
      autonomic_score: intOrNull(readiness.autonomic.score),
      load_score: intOrNull(readiness.load.score),
      subjective_score: intOrNull(readiness.subjective.score),
      stability_score: intOrNull(readiness.stability.score),
      confidence: confidenceForStorage(readiness.confidence.value),
      sleep_duration_hours: roundOrNull(sleep.duration_hours, 3),
      sleep_efficiency: roundOrNull(sleep.efficiency, 3),
      hrv_ms: roundOrNull(recovery.hrv_ms, 3),
      resting_heart_rate_bpm: roundOrNull(recovery.resting_heart_rate_bpm, 3),
      respiratory_rate: roundOrNull(recovery.respiratory_rate, 3),
      wrist_temperature_c: roundOrNull(recovery.wrist_temperature_c, 3),
      active_energy_kcal: roundOrNull(load.active_energy_kcal, 3),
      basal_energy_kcal: roundOrNull(load.basal_energy_kcal, 3),
      exercise_minutes: roundOrNull(load.exercise_minutes, 3),
      stand_minutes: roundOrNull(load.stand_minutes, 3),
      steps: roundOrNull(load.steps, 3),
      walking_running_distance_m: roundOrNull(load.walking_running_distance_m, 3),
      vo2max: roundOrNull(recovery.vo2max, 3),
      body_mass_kg: roundOrNull(body.body_mass_kg, 3),
      body_fat_percentage: roundOrNull(body.body_fat_percentage, 3),
      lean_body_mass_kg: roundOrNull(body.lean_body_mass_kg, 3),
      muscle_mass_percentage: roundOrNull(body.muscle_mass_percentage, 3),
      body_mass_index: roundOrNull(body.body_mass_index, 3),
      waist_circumference_cm: roundOrNull(body.waist_circumference_cm, 3),
      energy_level: latestCheckin?.energy_level ?? null,
      mood_level: latestCheckin?.mood_level ?? null,
      state: latestCheckin?.state ?? null,
      metrics,
      readiness: readiness as unknown as Record<string, unknown>,
      sleep,
      recovery,
      load,
      subjective,
      body,
      metadata: {
        model: 'health_snapshot_v1',
        aggregation: 'client_daily',
        raw_sources_preserved: true,
      },
    })
  }

  return snapshots
}

function sleepSummary(signals: HealthSnapshotSignal[], snapshotDate: string): Record<string, unknown> & {
  duration_hours: number | null
  efficiency: number | null
} {
  const sleepDuration = latestByDate(signals, ['sleep_duration_hours'], snapshotDate, true)
  const stageDurations = sleepStageDurations(signals, snapshotDate)
  const inBedHours = stageDurations.in_bed_hours ?? (
    sleepDuration?.value_numeric && stageDurations.awake_hours !== null
      ? Number(sleepDuration.value_numeric) + stageDurations.awake_hours
      : null
  )
  const durationHours = numberOrNull(sleepDuration?.value_numeric)
  const efficiency = durationHours !== null && inBedHours && inBedHours > 0
    ? (durationHours / inBedHours) * 100
    : null
  const debt = durationHours === null ? null : Math.max(0, SLEEP_TARGET_HOURS - durationHours)

  return {
    duration_hours: durationHours,
    in_bed_hours: inBedHours,
    efficiency,
    sleep_debt_hours: debt,
    bedtime: sleepDuration?.started_at ?? null,
    wake_time: sleepDuration?.ended_at ?? null,
    ...stageDurations,
  }
}

function recoverySummary(signals: HealthSnapshotSignal[]): Record<string, number | null> {
  return {
    hrv_ms: medianMetric(signals, ['hrv_ms']),
    resting_heart_rate_bpm: medianMetric(signals, ['resting_heart_rate_bpm']),
    respiratory_rate: medianMetric(signals, ['respiratory_rate']),
    wrist_temperature_c: medianMetric(signals, ['wrist_temperature']),
    vo2max: latestMetric(signals, ['vo2max']),
  }
}

function loadSummary(signals: HealthSnapshotSignal[]): Record<string, number | null> {
  return {
    steps: sumMetric(signals, ['steps']),
    active_energy_kcal: sumMetric(signals, ['active_energy_kcal']),
    basal_energy_kcal: sumMetric(signals, ['basal_energy_kcal']),
    exercise_minutes: sumMetric(signals, ['exercise_minutes']),
    stand_minutes: sumMetric(signals, ['stand_minutes']),
    walking_running_distance_m: sumMetric(signals, ['walking_running_distance']),
    workout_seconds: sumMetric(signals, ['workout']),
  }
}

function subjectiveSummary(
  signals: HealthSnapshotSignal[],
  checkin: HealthSnapshotCheckin | null,
): Record<string, unknown> {
  return {
    energy_level: checkin?.energy_level ?? null,
    mood_level: checkin?.mood_level ?? null,
    state: checkin?.state ?? null,
    state_recorded_at: checkin?.recorded_at ?? null,
    rize_focus_minutes: sumMetric(signals, ['focus_minutes', 'rize_focus_minutes']),
    state_of_mind_valence: medianMetric(signals, ['state_of_mind_valence']),
  }
}

function bodySummary(signals: HealthSnapshotSignal[]): Record<string, number | null> {
  const bodyMassKg = latestMetric(signals, ['body_mass'])
  const leanBodyMassKg = latestMetric(signals, ['lean_body_mass'])
  const directMuscle = latestMetric(signals, [
    'muscle_mass_percentage',
    'skeletal_muscle_percentage',
    'body_muscle_percentage',
  ])

  return {
    body_mass_kg: bodyMassKg,
    body_fat_percentage: normalizePercent(latestMetric(signals, ['body_fat_percentage'])),
    lean_body_mass_kg: leanBodyMassKg,
    muscle_mass_percentage: directMuscle ?? (
      bodyMassKg && leanBodyMassKg ? (leanBodyMassKg / bodyMassKg) * 100 : null
    ),
    body_mass_index: latestMetric(signals, ['body_mass_index']),
    waist_circumference_cm: latestMetric(signals, ['waist_circumference']),
  }
}

function sleepStageDurations(signals: HealthSnapshotSignal[], snapshotDate: string): Record<string, number | null> {
  const result = {
    rem_hours: 0,
    deep_hours: 0,
    core_hours: 0,
    awake_hours: 0,
    in_bed_hours: 0,
  }
  let hasStage = false

  for (const signal of signals) {
    if (signal.signal_type !== 'sleep_stage' || localDateKey(new Date(signal.ended_at ?? signal.started_at)) !== snapshotDate) {
      continue
    }

    const hours = durationHours(signal)
    if (hours <= 0) continue
    hasStage = true

    switch (Number(signal.value_numeric)) {
      case 0:
        result.in_bed_hours += hours
        break
      case 2:
        result.awake_hours += hours
        break
      case 3:
        result.core_hours += hours
        break
      case 4:
        result.deep_hours += hours
        break
      case 5:
        result.rem_hours += hours
        break
      default:
        break
    }
  }

  if (!hasStage) {
    return {
      rem_hours: null,
      deep_hours: null,
      core_hours: null,
      awake_hours: null,
      in_bed_hours: null,
    }
  }

  return result
}

function signalBelongsToDate(signal: HealthSnapshotSignal, snapshotDate: string): boolean {
  return localDateKey(new Date(metricTime(signal))) === snapshotDate
}

function latestCheckinForDate(checkins: HealthSnapshotCheckin[], snapshotDate: string): HealthSnapshotCheckin | null {
  return checkins
    .filter((checkin) => localDateKey(new Date(checkin.recorded_at)) === snapshotDate)
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0] ?? null
}

function latestByDate(
  signals: HealthSnapshotSignal[],
  signalTypes: string[],
  snapshotDate: string,
  useEndTime = false,
): HealthSnapshotSignal | null {
  return signals
    .filter((signal) => signalTypes.includes(signal.signal_type) && localDateKey(new Date(useEndTime ? signal.ended_at ?? signal.started_at : signal.started_at)) === snapshotDate)
    .sort((a, b) => metricTime(b) - metricTime(a))[0] ?? null
}

function medianMetric(signals: HealthSnapshotSignal[], signalTypes: string[]): number | null {
  const values = numericValues(signals, signalTypes)
  return values.length > 0 ? median(values) : null
}

function latestMetric(signals: HealthSnapshotSignal[], signalTypes: string[]): number | null {
  return numberOrNull(signals
    .filter((signal) => signalTypes.includes(signal.signal_type) && typeof signal.value_numeric === 'number')
    .sort((a, b) => metricTime(b) - metricTime(a))[0]?.value_numeric)
}

function sumMetric(signals: HealthSnapshotSignal[], signalTypes: string[]): number | null {
  const values = numericValues(signals, signalTypes)
  return values.length > 0 ? values.reduce((acc, value) => acc + value, 0) : null
}

function numericValues(signals: HealthSnapshotSignal[], signalTypes: string[]): number[] {
  return signals
    .filter((signal) => signalTypes.includes(signal.signal_type) && typeof signal.value_numeric === 'number')
    .map((signal) => Number(signal.value_numeric))
    .filter((value) => Number.isFinite(value))
}

function sourceCounts(signals: HealthSnapshotSignal[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const signal of signals) {
    counts[signal.source] = (counts[signal.source] ?? 0) + 1
  }
  return counts
}

function durationHours(signal: HealthSnapshotSignal): number {
  const start = new Date(signal.started_at).getTime()
  const end = new Date(signal.ended_at ?? signal.started_at).getTime()
  return Math.max(0, end - start) / 3600000
}

function metricTime(signal: HealthSnapshotSignal): number {
  const iso = signal.signal_type === 'sleep_duration_hours' || signal.signal_type === 'sleep_stage'
    ? signal.ended_at ?? signal.started_at
    : signal.started_at
  return new Date(iso).getTime()
}

function normalizePercent(value: number | null): number | null {
  if (value === null) return null
  return Math.abs(value) <= 1 ? value * 100 : value
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function roundOrNull(value: number | null, digits: number): number | null {
  if (value === null || !Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function confidenceForStorage(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null

  const fraction = value > 1 ? value / 100 : value
  return roundOrNull(Math.min(1, Math.max(0, fraction)), 3)
}

function intOrNull(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.round(value)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function startOfLocalDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function deterministicUuid(input: string): string {
  const [a, b, c, d] = cyrb128(input)
  const hex = [a, b, c, d].map((value) => value.toString(16).padStart(8, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hex.slice(18, 20),
    hex.slice(20, 32),
  ].join('-')
}

function cyrb128(value: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762

  for (let index = 0; index < value.length; index++) {
    const k = value.charCodeAt(index)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)

  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ]
}
