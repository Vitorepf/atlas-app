import assert from 'node:assert/strict'
import { buildHealthSnapshotInputs } from '../lib/healthSnapshots'
import { buildReadinessV1, type ReadinessSignal } from '../lib/readiness'
import { buildSleepPlanner, sleepInsightItems, sleepTimelineSegments } from '../lib/sleepOperational'
import { inferSleepTarget, sleepDebtHoursForNights } from '../lib/sleepTarget'
import { checkinAgeHours, checkinLevelFreshness } from '../lib/checkinFreshness'

type TestSignal = ReadinessSignal & {
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
}

const TZ = 'America/Sao_Paulo'
const SNAPSHOT_DATE = '2026-04-29'
const NOW = new Date('2026-04-29T18:00:00-03:00')

function signal(input: {
  id: string
  type: string
  value: number | null
  text?: string | null
  unit?: string | null
  start: string
  end?: string | null
}): TestSignal {
  return {
    id: input.id,
    client_id: input.id,
    source: 'healthkit',
    signal_type: input.type,
    value_numeric: input.value,
    value_text: input.text ?? null,
    unit: input.unit ?? null,
    started_at: input.start,
    ended_at: input.end ?? null,
    recorded_timezone: TZ,
    metadata: {},
  }
}

function snapshotFor(signals: TestSignal[]) {
  const snapshots = buildHealthSnapshotInputs({
    healthSignals: signals,
    allSignals: signals,
    checkins: [],
    dates: [SNAPSHOT_DATE],
    now: NOW,
    timezone: TZ,
  })

  assert.equal(snapshots.length, 1)
  return snapshots[0]
}

const overlappingSleep = [
  signal({
    id: 'duration-wrong',
    type: 'sleep_duration_hours',
    value: 12,
    unit: 'h',
    start: '2026-04-29T00:00:00-03:00',
    end: '2026-04-29T12:00:00-03:00',
  }),
  signal({
    id: 'core-1',
    type: 'sleep_stage',
    value: 3,
    start: '2026-04-29T00:00:00-03:00',
    end: '2026-04-29T03:00:00-03:00',
  }),
  signal({
    id: 'deep-overlap',
    type: 'sleep_stage',
    value: 4,
    start: '2026-04-29T02:00:00-03:00',
    end: '2026-04-29T04:00:00-03:00',
  }),
  signal({
    id: 'rem-1',
    type: 'sleep_stage',
    value: 5,
    start: '2026-04-29T04:00:00-03:00',
    end: '2026-04-29T07:00:00-03:00',
  }),
  signal({
    id: 'awake-after',
    type: 'sleep_stage',
    value: 2,
    start: '2026-04-29T07:00:00-03:00',
    end: '2026-04-29T07:30:00-03:00',
  }),
]

{
  const snapshot = snapshotFor(overlappingSleep)
  assert.equal(snapshot.sleep_duration_hours, 7)
  assert.equal(snapshot.sleep?.asleep_hours, 7)
  assert.equal(snapshot.sleep?.sleep_target_hours, 7.5)
  assert.equal(snapshot.sleep?.sleep_debt_hours, 0.5)
  assert.equal(snapshot.sleep?.deep_hours, 2)
  assert.equal(snapshot.sleep?.rem_hours, 3)
  assert.equal(snapshot.sleep?.awake_hours, 0.5)
  assert.equal(snapshot.sleep?.in_bed_hours, 7.5)
  assert.equal(snapshot.sleep_efficiency, 93.333)
  assert.equal(snapshot.sleep?.awake_percent, 6.666666666666667)
  assert.equal(snapshot.sleep?.continuity_percent, 93.33333333333333)
  assert.equal(snapshot.sleep?.wake_time, '2026-04-29T10:30:00.000Z')
  assert.equal(snapshot.sleep?.sleep_capture_status, 'complete')
}

{
  const model = buildReadinessV1({
    healthSignals: overlappingSleep,
    allSignals: overlappingSleep,
    now: NOW,
  })
  assert.equal(model.diagnostics.sleepHours, 7)
  assert.equal(model.sleepTargetHours, 7.5)
  assert.equal(model.sleepDebtHours, 0.5)
}

{
  const segments = sleepTimelineSegments([
    signal({
      id: 'timeline-awake',
      type: 'sleep_stage',
      value: 2,
      start: '2026-04-28T22:50:00-03:00',
      end: '2026-04-28T23:10:00-03:00',
    }),
    signal({
      id: 'timeline-core',
      type: 'sleep_stage',
      value: 3,
      start: '2026-04-28T23:10:00-03:00',
      end: '2026-04-29T01:00:00-03:00',
    }),
    signal({
      id: 'timeline-rem',
      type: 'sleep_stage',
      value: 5,
      start: '2026-04-29T01:00:00-03:00',
      end: '2026-04-29T02:10:00-03:00',
    }),
  ], '2026-04-28T23:00:00-03:00', '2026-04-29T02:00:00-03:00')

  assert.deepEqual(segments.map((segment) => segment.stage), ['awake', 'core', 'rem'])
  assert.equal(Math.round(segments.reduce((sum, segment) => sum + segment.hours, 0) * 60), 180)
  assert.equal(segments[0].startedAt, '2026-04-29T02:00:00.000Z')
  assert.equal(segments[2].endedAt, '2026-04-29T05:00:00.000Z')
}

{
  const planner = buildSleepPlanner({
    sleepNeedHours: 8,
    efficiencyPercent: 90,
    latencyMinutes: 20,
    wakeAnchorIso: '2026-04-30T10:30:00.000Z',
    windDownMinutes: 45,
  })

  assert.ok(planner)
  assert.equal(planner.wakeTimeIso, '2026-04-30T10:30:00.000Z')
  assert.equal(planner.bedtimeIso, '2026-04-30T01:16:40.000Z')
  assert.equal(planner.windDownIso, '2026-04-30T00:31:40.000Z')
  assert.ok(planner.timeInBedHours > planner.sleepNeedHours)
}

{
  const insights = sleepInsightItems({
    durationHours: 5.5,
    targetHours: 8,
    sleepDebtHours: 4,
    efficiencyPercent: 83,
    latencyMinutes: 40,
    awakeEpisodeCount: 4,
    disturbanceCount: 12,
    sleepStressScore: 52,
    oxygenSaturationPercent: 94,
    dataQuality: 0.9,
    stageCoverage: 1,
    regularityScore: 88,
  })

  assert.deepEqual(
    insights.map((item) => item.key),
    ['short_sleep', 'sleep_debt', 'low_efficiency', 'high_latency', 'awakenings'],
  )
}

{
  const snapshot = snapshotFor([
    signal({
      id: 'pre-sleep-awake',
      type: 'sleep_stage',
      value: 2,
      start: '2026-04-28T23:00:00-03:00',
      end: '2026-04-28T23:20:00-03:00',
    }),
    signal({
      id: 'core-main-1',
      type: 'sleep_stage',
      value: 3,
      start: '2026-04-28T23:20:00-03:00',
      end: '2026-04-29T01:00:00-03:00',
    }),
    signal({
      id: 'middle-awake',
      type: 'sleep_stage',
      value: 2,
      start: '2026-04-29T01:00:00-03:00',
      end: '2026-04-29T01:10:00-03:00',
    }),
    signal({
      id: 'deep-main',
      type: 'sleep_stage',
      value: 4,
      start: '2026-04-29T01:10:00-03:00',
      end: '2026-04-29T03:00:00-03:00',
    }),
    signal({
      id: 'rem-main',
      type: 'sleep_stage',
      value: 5,
      start: '2026-04-29T03:00:00-03:00',
      end: '2026-04-29T05:00:00-03:00',
    }),
    signal({
      id: 'final-awake',
      type: 'sleep_stage',
      value: 2,
      start: '2026-04-29T05:00:00-03:00',
      end: '2026-04-29T05:20:00-03:00',
    }),
    signal({
      id: 'nap-core',
      type: 'sleep_stage',
      value: 3,
      start: '2026-04-29T14:00:00-03:00',
      end: '2026-04-29T14:30:00-03:00',
    }),
    signal({
      id: 'evening-false-rem',
      type: 'sleep_stage',
      value: 5,
      start: '2026-04-29T19:12:00-03:00',
      end: '2026-04-29T19:17:00-03:00',
    }),
    signal({
      id: 'evening-false-core',
      type: 'sleep_stage',
      value: 3,
      start: '2026-04-29T19:17:00-03:00',
      end: '2026-04-29T19:26:00-03:00',
    }),
  ])

  assert.equal(snapshot.sleep_duration_hours, 5.5)
  assert.equal(snapshot.sleep?.asleep_hours, 5.5)
  assert.equal(snapshot.sleep?.nap_hours, 0.5)
  assert.equal(snapshot.sleep?.nap_count, 1)
  assert.equal(snapshot.sleep?.latency_minutes, 20)
  assert.equal(snapshot.sleep?.awake_episode_count, 1)
  assert.equal(snapshot.sleep?.disturbance_count, 1)
  assert.equal(snapshot.sleep?.sleep_cycle_count, 1)
  assert.equal(snapshot.sleep?.bedtime, '2026-04-29T02:20:00.000Z')
  assert.equal(snapshot.sleep?.wake_time, '2026-04-29T08:20:00.000Z')
  assert.equal(snapshot.sleep?.stage_coverage, 1)
  assert.ok(Number(snapshot.sleep?.sleep_data_quality ?? 0) >= 0.9)
}

{
  const snapshot = snapshotFor([
    signal({
      id: 'false-rem-only',
      type: 'sleep_stage',
      value: 5,
      start: '2026-04-29T19:12:00-03:00',
      end: '2026-04-29T19:17:00-03:00',
    }),
    signal({
      id: 'false-core-only',
      type: 'sleep_stage',
      value: 3,
      start: '2026-04-29T19:17:00-03:00',
      end: '2026-04-29T19:26:00-03:00',
    }),
  ])

  assert.equal(snapshot.sleep_duration_hours, null)
  assert.equal(snapshot.sleep?.duration_hours, null)
  assert.equal(snapshot.sleep?.rem_hours, null)
  assert.equal(snapshot.sleep?.core_hours, null)
  assert.equal(snapshot.sleep?.wake_time, null)
  assert.equal(snapshot.sleep?.main_sleep_source, null)
}

{
  const personalizedSleep = Array.from({ length: 10 }, (_, index) => {
    const day = String(29 - index).padStart(2, '0')
    const value = index === 0 ? 7 : 8.25
    return signal({
      id: `personal-sleep-${index}`,
      type: 'sleep_duration_hours',
      value,
      unit: 'h',
      start: `2026-04-${day}T00:00:00-03:00`,
      end: `2026-04-${day}T${String(Math.floor(value)).padStart(2, '0')}:${value % 1 === 0 ? '00' : '15'}:00-03:00`,
    })
  })
  const model = buildReadinessV1({
    healthSignals: personalizedSleep,
    allSignals: personalizedSleep,
    now: NOW,
  })
  const shortSleep = model.factors.find((item) => item.key === 'short_sleep')

  assert.equal(model.sleepTargetHours, 8.25)
  assert.equal(model.sleepDebtHours, 1.25)
  assert.equal(shortSleep?.label, 'Sono abaixo do alvo')
  assert.equal(shortSleep?.value, 'faltaram 1h15')
}

{
  const evidence = inferSleepTarget([
    { asleepHours: 8.1, outcomeScore: 84 },
    { asleepHours: 8.2, outcomeScore: 82 },
    { asleepHours: 8.3, outcomeScore: 86 },
    { asleepHours: 8.4, outcomeScore: 80 },
    { asleepHours: 7.1, outcomeScore: 62 },
    { asleepHours: 7.2, outcomeScore: 64 },
    { asleepHours: 7.3, outcomeScore: 60 },
    { asleepHours: 7.4, outcomeScore: 61 },
    { asleepHours: 8.8, outcomeScore: 68 },
    { asleepHours: 8.9, outcomeScore: 70 },
    { asleepHours: 9.0, outcomeScore: 69 },
    { asleepHours: 9.1, outcomeScore: 67 },
  ])

  assert.equal(evidence.method, 'outcome')
  assert.equal(evidence.targetHours, 8.25)
  assert.equal(evidence.outcomeSampleCount, 12)
  assert.equal(evidence.bestRange?.rangeLabel, '8h00-8h30')
  assert.equal(evidence.bestRange?.nights, 4)
  assert.equal(evidence.bestRange?.goodNights, 4)
}

{
  const dynamicNeed = inferSleepTarget([
    { key: '2026-04-29', asleepHours: 8.5, strainRatio: 1.8 },
    { key: '2026-04-28', asleepHours: 6.5, napHours: 0.5 },
    { key: '2026-04-27', asleepHours: 6.5 },
    { key: '2026-04-26', asleepHours: 8.5 },
    { key: '2026-04-25', asleepHours: 8.5 },
    { key: '2026-04-24', asleepHours: 8.5 },
    { key: '2026-04-23', asleepHours: 8.5 },
    { key: '2026-04-22', asleepHours: 8.5 },
    { key: '2026-04-21', asleepHours: 8.5 },
    { key: '2026-04-20', asleepHours: 8.5 },
  ])

  assert.equal(dynamicNeed.method, 'duration')
  assert.equal(dynamicNeed.baselineHours, 8.5)
  assert.ok(dynamicNeed.sleepDebtAdjustmentHours > 0)
  assert.ok(dynamicNeed.strainAdjustmentHours > 0)
  assert.ok(dynamicNeed.napAdjustmentHours > 0)
  assert.ok(dynamicNeed.targetHours > dynamicNeed.baselineHours)
  assert.ok(dynamicNeed.targetHours <= 9.5)
}

{
  const debt = sleepDebtHoursForNights(Array.from({ length: 7 }, () => ({ asleepHours: 4 })), 8.5)
  assert.equal(debt, 8)
}

{
  const outcomeSleep = Array.from({ length: 10 }, (_, index) => {
    const day = String(29 - index).padStart(2, '0')
    return signal({
      id: `checkin-outcome-sleep-${index}`,
      type: 'sleep_duration_hours',
      value: 8.25,
      unit: 'h',
      start: `2026-04-${day}T00:00:00-03:00`,
      end: `2026-04-${day}T08:15:00-03:00`,
    })
  })
  const checkins = Array.from({ length: 10 }, (_, index) => {
    const day = String(29 - index).padStart(2, '0')
    return {
      state: 'focused' as const,
      energy_level: 5,
      mood_level: 5,
      recorded_at: `2026-04-${day}T10:00:00-03:00`,
    }
  })
  const focusSignals = Array.from({ length: 10 }, (_, index) => {
    const day = String(29 - index).padStart(2, '0')
    return signal({
      id: `checkin-outcome-focus-${index}`,
      type: 'focus_minutes',
      value: 120,
      unit: 'min',
      start: `2026-04-${day}T13:00:00-03:00`,
    })
  })
  const model = buildReadinessV1({
    healthSignals: outcomeSleep,
    allSignals: [...outcomeSleep, ...focusSignals],
    checkins,
    now: NOW,
  })

  assert.equal(model.sleepTargetEvidence.method, 'outcome')
  assert.equal(model.sleepTargetEvidence.outcomeSampleCount, 10)
  assert.equal(model.sleepTargetHours, 8.25)
}

{
  const snapshot = snapshotFor([
    signal({
      id: 'body-fat-fraction',
      type: 'body_fat_percentage',
      value: 0.202,
      unit: '%',
      start: '2026-04-29T08:00:00-03:00',
    }),
    signal({
      id: 'body-mass',
      type: 'body_mass',
      value: 69.6,
      unit: 'kg',
      start: '2026-04-29T08:00:00-03:00',
    }),
    signal({
      id: 'lean-mass',
      type: 'lean_body_mass',
      value: 55.541,
      unit: 'kg',
      start: '2026-04-29T08:00:00-03:00',
    }),
    signal({
      id: 'height-manual',
      type: 'height',
      value: 1.7,
      unit: 'm',
      start: '2026-04-29T08:10:00-03:00',
    }),
  ])
  assert.equal(snapshot.body_fat_percentage, 20.2)
  assert.equal(snapshot.body_mass_kg, 69.6)
  assert.equal(snapshot.lean_body_mass_kg, 55.541)
  assert.equal(snapshot.muscle_mass_percentage, null)
  assert.equal(snapshot.body_mass_index, 24.083)
  assert.equal(snapshot.body?.lean_mass_percentage, 79.8)
  assert.equal(snapshot.body?.height_m, 1.7)
  assert.equal(snapshot.body?.fat_mass_kg, 14.059)
}

{
  const longitudinalSignals = Array.from({ length: 14 }, (_, index) => {
    const day = String(29 - index).padStart(2, '0')
    return [
      signal({ id: `atlas-age-sleep-${day}`, type: 'sleep_duration_hours', value: 8, unit: 'h', start: `2026-04-${day}T00:00:00-03:00`, end: `2026-04-${day}T08:00:00-03:00` }),
      signal({ id: `atlas-age-rhr-${day}`, type: 'resting_heart_rate_bpm', value: 52, unit: 'bpm', start: `2026-04-${day}T07:30:00-03:00` }),
      signal({ id: `atlas-age-hrv-${day}`, type: 'hrv_ms', value: 68, unit: 'ms', start: `2026-04-${day}T07:30:00-03:00` }),
      signal({ id: `atlas-age-steps-${day}`, type: 'steps', value: 9200, unit: 'count', start: `2026-04-${day}T22:00:00-03:00` }),
      signal({ id: `atlas-age-exercise-${day}`, type: 'exercise_minutes', value: 42, unit: 'min', start: `2026-04-${day}T18:00:00-03:00` }),
    ]
  }).flat()

  const snapshot = snapshotFor([
    signal({ id: 'atlas-age-dob', type: 'date_of_birth', value: null, text: '1996-04-29', start: '2026-04-01T08:00:00-03:00' }),
    signal({ id: 'atlas-age-sex', type: 'biological_sex', value: 2, unit: 'count', start: '2026-04-01T08:00:00-03:00' }),
    signal({ id: 'atlas-age-vo2', type: 'vo2max', value: 50, unit: 'ml/(kg*min)', start: '2026-04-20T08:00:00-03:00' }),
    signal({ id: 'atlas-age-weight', type: 'body_mass', value: 69.6, unit: 'kg', start: '2026-04-29T08:00:00-03:00' }),
    signal({ id: 'atlas-age-fat', type: 'body_fat_percentage', value: 14, unit: '%', start: '2026-04-29T08:00:00-03:00' }),
    signal({ id: 'atlas-age-lean', type: 'lean_body_mass', value: 59.9, unit: 'kg', start: '2026-04-29T08:00:00-03:00' }),
    signal({ id: 'atlas-age-height', type: 'height', value: 1.7, unit: 'm', start: '2026-04-29T08:00:00-03:00' }),
    signal({ id: 'atlas-age-waist', type: 'waist_circumference', value: 78, unit: 'cm', start: '2026-04-29T08:00:00-03:00' }),
    ...longitudinalSignals,
  ])
  const atlasAge = snapshot.body?.physiological_age_atlas as Record<string, unknown> | undefined
  assert.ok(atlasAge)
  assert.equal(atlasAge.model_version, 'atlas_physiological_age_v1')
  assert.notEqual(atlasAge.status, 'insufficient')
  assert.equal(atlasAge.chronological_age_years, 30)
  assert.equal(typeof atlasAge.age_years, 'number')
  assert.ok(Number(atlasAge.age_years) < 30)
  assert.ok(Number(atlasAge.confidence) >= 0.6)
  assert.ok(Array.isArray(atlasAge.contributors))
  assert.ok((atlasAge.contributors as Array<Record<string, unknown>>).some((item) => item.key === 'vo2max'))
}

{
  const baselineDays = ['25', '26', '27'].flatMap((day) => [
    signal({ id: `stress-sleep-hr-${day}`, type: 'sleep_hr_avg_bpm', value: 50, unit: 'bpm', start: `2026-04-${day}T23:00:00-03:00`, end: `2026-04-${String(Number(day) + 1).padStart(2, '0')}T07:00:00-03:00` }),
    signal({ id: `stress-sleep-hr-min-${day}`, type: 'sleep_hr_min_bpm', value: 44, unit: 'bpm', start: `2026-04-${day}T23:00:00-03:00`, end: `2026-04-${String(Number(day) + 1).padStart(2, '0')}T07:00:00-03:00` }),
    signal({ id: `stress-hrv-${day}`, type: 'hrv_ms', value: 60, unit: 'ms', start: `2026-04-${day}T07:00:00-03:00` }),
    signal({ id: `stress-rhr-${day}`, type: 'resting_heart_rate_bpm', value: 50, unit: 'bpm', start: `2026-04-${day}T07:00:00-03:00` }),
    signal({ id: `stress-resp-${day}`, type: 'respiratory_rate', value: 15, unit: 'resp/min', start: `2026-04-${day}T07:00:00-03:00` }),
    signal({ id: `stress-temp-${day}`, type: 'wrist_temperature', value: 36.5, unit: 'degC', start: `2026-04-${day}T07:00:00-03:00` }),
    signal({ id: `stress-ox-${day}`, type: 'oxygen_saturation', value: 0.98, unit: '%', start: `2026-04-${day}T07:00:00-03:00` }),
  ])
  const snapshot = snapshotFor([
    ...baselineDays,
    signal({ id: 'stress-sleep-hr-today', type: 'sleep_hr_avg_bpm', value: 62, unit: 'bpm', start: '2026-04-28T23:00:00-03:00', end: '2026-04-29T07:00:00-03:00' }),
    signal({ id: 'stress-sleep-hr-min-today', type: 'sleep_hr_min_bpm', value: 55, unit: 'bpm', start: '2026-04-28T23:00:00-03:00', end: '2026-04-29T07:00:00-03:00' }),
    signal({ id: 'stress-sleep-hr-count-today', type: 'sleep_hr_sample_count', value: 42, unit: 'count', start: '2026-04-28T23:00:00-03:00', end: '2026-04-29T07:00:00-03:00' }),
    signal({ id: 'stress-breathing-disturbances-today', type: 'sleep_breathing_disturbances', value: 12, unit: 'count', start: '2026-04-28T23:00:00-03:00', end: '2026-04-29T07:00:00-03:00' }),
    signal({ id: 'stress-hrv-today', type: 'hrv_ms', value: 40, unit: 'ms', start: '2026-04-29T07:00:00-03:00' }),
    signal({ id: 'stress-rhr-today', type: 'resting_heart_rate_bpm', value: 60, unit: 'bpm', start: '2026-04-29T07:00:00-03:00' }),
    signal({ id: 'stress-resp-today', type: 'respiratory_rate', value: 18, unit: 'resp/min', start: '2026-04-29T07:00:00-03:00' }),
    signal({ id: 'stress-temp-today', type: 'wrist_temperature', value: 37, unit: 'degC', start: '2026-04-29T07:00:00-03:00' }),
    signal({ id: 'stress-ox-today', type: 'oxygen_saturation', value: 0.94, unit: '%', start: '2026-04-29T07:00:00-03:00' }),
  ])

  assert.ok(Number(snapshot.sleep?.sleep_stress_score ?? 100) < 45)
  assert.equal(snapshot.sleep?.sleep_stress_label, 'alto')
  assert.ok(Number(snapshot.sleep?.sleep_stress_confidence ?? 0) > 0.9)
  assert.equal(snapshot.sleep?.sleep_hr_avg_bpm, 62)
  assert.equal(snapshot.sleep?.sleep_hr_min_bpm, 55)
  assert.equal(snapshot.sleep?.sleep_hr_sample_count, 42)
  assert.equal(snapshot.sleep?.sleep_respiratory_rate, 18)
  assert.equal(snapshot.sleep?.sleep_oxygen_saturation_percent, 94)
  assert.equal(snapshot.sleep?.sleep_wrist_temperature_c, 37)
  assert.equal(snapshot.sleep?.sleep_breathing_disturbances_count, 12)
  assert.equal(snapshot.sleep?.sleep_stress_breathing_disturbance_count, 12)
  assert.ok(Number(snapshot.sleep?.sleep_stress_sleep_hr_ratio ?? 0) > 1.2)
  assert.equal((snapshot.sleep?.metric_quality as Record<string, { status: string }>).sleep_hr_avg_bpm.status, 'alta')
  assert.equal((snapshot.sleep?.metric_quality as Record<string, { status: string }>).sleep_breathing_disturbances_count.status, 'alta')
}

{
  const regularSleep = [26, 27, 28, 29].map((day) => signal({
    id: `regular-sleep-${day}`,
    type: 'sleep_duration_hours',
    value: 8,
    unit: 'h',
    start: `2026-04-${String(day - 1).padStart(2, '0')}T23:00:00-03:00`,
    end: `2026-04-${String(day).padStart(2, '0')}T07:00:00-03:00`,
  }))
  const snapshot = snapshotFor(regularSleep)

  assert.equal(snapshot.sleep?.regularity_nights, 4)
  assert.equal(snapshot.sleep?.bedtime_regularity_minutes, 0)
  assert.equal(snapshot.sleep?.wake_regularity_minutes, 0)
  assert.equal(snapshot.sleep?.midpoint_regularity_minutes, 0)
  assert.equal(snapshot.sleep?.regularity_score, 100)
  assert.equal((snapshot.sleep?.metric_quality as Record<string, { status: string }>).regularity_score.status, 'parcial')
}

{
  const snapshot = snapshotFor([
    signal({
      id: 'recovery-core-window',
      type: 'sleep_stage',
      value: 3,
      start: '2026-04-28T23:00:00-03:00',
      end: '2026-04-29T05:00:00-03:00',
    }),
    signal({
      id: 'recovery-rem-window',
      type: 'sleep_stage',
      value: 5,
      start: '2026-04-29T05:00:00-03:00',
      end: '2026-04-29T07:00:00-03:00',
    }),
    signal({
      id: 'recovery-resp-in-window',
      type: 'respiratory_rate',
      value: 17,
      unit: 'resp/min',
      start: '2026-04-29T07:30:00-03:00',
    }),
    signal({
      id: 'recovery-oxygen-outside-window',
      type: 'oxygen_saturation',
      value: 0.96,
      unit: '%',
      start: '2026-04-29T15:24:00-03:00',
    }),
    signal({
      id: 'recovery-temp-stale',
      type: 'wrist_temperature',
      value: 35.1,
      unit: 'degC',
      start: '2026-04-26T22:30:00-03:00',
    }),
  ])

  assert.equal(snapshot.sleep?.sleep_respiratory_rate, 17)
  assert.equal(snapshot.sleep?.sleep_oxygen_saturation_percent, null)
  assert.equal(snapshot.sleep?.sleep_wrist_temperature_c, null)
  assert.equal((snapshot.sleep?.metric_quality as Record<string, { status: string }>).sleep_respiratory_rate.status, 'alta')
  assert.equal((snapshot.sleep?.metric_quality as Record<string, { status: string }>).sleep_oxygen_saturation_percent.status, 'sem dado')
  assert.equal((snapshot.sleep?.metric_quality as Record<string, { status: string }>).sleep_wrist_temperature_c.status, 'sem dado')
}

{
  const model = buildReadinessV1({
    healthSignals: [
      signal({
        id: 'old-hrv',
        type: 'hrv_ms',
        value: 80,
        unit: 'ms',
        start: '2026-04-26T08:00:00-03:00',
      }),
    ],
    now: NOW,
  })
  assert.equal(model.autonomic.score, null)
  assert.equal(model.diagnostics.hrvRatio, null)
}

{
  const baseline = [26, 27, 28].flatMap((day) => [
    signal({
      id: `night-recovery-baseline-sleep-${day}`,
      type: 'sleep_duration_hours',
      value: 8,
      unit: 'h',
      start: `2026-04-${String(day - 1).padStart(2, '0')}T23:00:00-03:00`,
      end: `2026-04-${String(day).padStart(2, '0')}T07:00:00-03:00`,
    }),
    signal({
      id: `night-recovery-baseline-hr-${day}`,
      type: 'sleep_hr_avg_bpm',
      value: 60,
      unit: 'bpm',
      start: `2026-04-${String(day - 1).padStart(2, '0')}T23:00:00-03:00`,
      end: `2026-04-${String(day).padStart(2, '0')}T07:00:00-03:00`,
    }),
    signal({
      id: `night-recovery-baseline-hrv-${day}`,
      type: 'hrv_ms',
      value: 60,
      unit: 'ms',
      start: `2026-04-${String(day).padStart(2, '0')}T07:30:00-03:00`,
    }),
    signal({
      id: `night-recovery-baseline-resp-${day}`,
      type: 'respiratory_rate',
      value: 16,
      unit: 'resp/min',
      start: `2026-04-${String(day).padStart(2, '0')}T07:20:00-03:00`,
    }),
    signal({
      id: `night-recovery-baseline-temp-${day}`,
      type: 'wrist_temperature',
      value: 36.5,
      unit: 'degC',
      start: `2026-04-${String(day).padStart(2, '0')}T06:30:00-03:00`,
    }),
  ])
  const current = [
    signal({
      id: 'night-recovery-current-sleep',
      type: 'sleep_duration_hours',
      value: 8,
      unit: 'h',
      start: '2026-04-28T23:00:00-03:00',
      end: '2026-04-29T07:00:00-03:00',
    }),
    signal({
      id: 'night-recovery-current-hr',
      type: 'sleep_hr_avg_bpm',
      value: 66,
      unit: 'bpm',
      start: '2026-04-28T23:00:00-03:00',
      end: '2026-04-29T07:00:00-03:00',
    }),
    signal({
      id: 'night-recovery-current-hrv',
      type: 'hrv_ms',
      value: 50,
      unit: 'ms',
      start: '2026-04-29T07:30:00-03:00',
    }),
    signal({
      id: 'night-recovery-current-resp',
      type: 'respiratory_rate',
      value: 18,
      unit: 'resp/min',
      start: '2026-04-29T07:30:00-03:00',
    }),
    signal({
      id: 'night-recovery-current-temp',
      type: 'wrist_temperature',
      value: 37,
      unit: 'degC',
      start: '2026-04-29T06:30:00-03:00',
    }),
    signal({
      id: 'night-recovery-current-oxygen',
      type: 'oxygen_saturation',
      value: 0.94,
      unit: '%',
      start: '2026-04-29T06:45:00-03:00',
    }),
  ]
  const model = buildReadinessV1({
    healthSignals: [...baseline, ...current],
    allSignals: [...baseline, ...current],
    now: NOW,
  })
  assert.equal(model.nightRecoveryComponents.length, 6)
  assert.ok(typeof model.nightRecovery.score === 'number')
  assert.ok(Number(model.nightRecovery.score) < 80)

  const hrv = model.nightRecoveryComponents.find((component) => component.key === 'hrv')
  assert.equal(hrv?.value, 50)
  assert.equal(hrv?.baseline, 60)
  assert.equal(hrv?.delta, -10)
  assert.equal(hrv?.status, 'risk')

  const oxygen = model.nightRecoveryComponents.find((component) => component.key === 'oxygen')
  assert.equal(oxygen?.value, 94)
  assert.equal(oxygen?.baseline, null)
  assert.equal(oxygen?.status, 'watch')

  const snapshot = snapshotFor([...baseline, ...current])
  assert.equal(snapshot.recovery?.night_recovery_score, Math.round(Number(model.nightRecovery.score)))
  assert.ok(Array.isArray(snapshot.recovery?.night_recovery_components))
}

{
  const model = buildReadinessV1({
    healthSignals: [
      signal({
        id: 'fresh-hrv-no-baseline',
        type: 'hrv_ms',
        value: 72,
        unit: 'ms',
        start: '2026-04-29T08:00:00-03:00',
      }),
    ],
    now: NOW,
  })
  assert.equal(model.autonomic.score, null)
  assert.equal(model.autonomic.label, 'Sem dado')
  assert.equal(model.axisQuality.autonomic.status, 'baseline')
  assert.equal(model.axisQuality.autonomic.baselineDays, 0)
}

{
  const baseline = [26, 27, 28].flatMap((day) => [
    signal({
      id: `recovery-baseline-sleep-${day}`,
      type: 'sleep_duration_hours',
      value: 8,
      unit: 'h',
      start: `2026-04-${String(day - 1).padStart(2, '0')}T23:00:00-03:00`,
      end: `2026-04-${String(day).padStart(2, '0')}T07:00:00-03:00`,
    }),
    signal({
      id: `recovery-baseline-hrv-${day}`,
      type: 'hrv_ms',
      value: 60,
      unit: 'ms',
      start: `2026-04-${String(day).padStart(2, '0')}T07:30:00-03:00`,
    }),
  ])
  const model = buildReadinessV1({
    healthSignals: [
      ...baseline,
      signal({
        id: 'recovery-current-sleep',
        type: 'sleep_duration_hours',
        value: 8,
        unit: 'h',
        start: '2026-04-28T23:00:00-03:00',
        end: '2026-04-29T07:00:00-03:00',
      }),
      signal({
        id: 'recovery-afternoon-hrv',
        type: 'hrv_ms',
        value: 35,
        unit: 'ms',
        start: '2026-04-29T14:07:00-03:00',
      }),
    ],
    now: NOW,
  })
  assert.equal(model.diagnostics.hrvRatio, null)
}

{
  const model = buildReadinessV1({
    healthSignals: [
      signal({
        id: 'stale-sleep',
        type: 'sleep_duration_hours',
        value: 8,
        unit: 'h',
        start: '2026-04-25T00:00:00-03:00',
        end: '2026-04-25T08:00:00-03:00',
      }),
    ],
    now: NOW,
  })
  assert.equal(model.sleep.score, null)
  assert.equal(model.diagnostics.sleepHours, null)
  assert.equal(model.axisQuality.sleep.freshness, 0)
  assert.equal(model.axisQuality.sleep.status, 'baseline')
}

{
  assert.equal(
    checkinAgeHours({ recorded_at: '2026-04-29T18:06:00-03:00' }, NOW),
    null,
  )
  assert.equal(
    checkinLevelFreshness({ recorded_at: '2026-04-29T18:06:00-03:00' }, NOW),
    0,
  )
}

{
  const model = buildReadinessV1({
    healthSignals: [],
    allSignals: [],
    latestCheckin: {
      state: 'blocked',
      energy_level: 1,
      mood_level: 1,
      recorded_at: '2026-04-28T08:00:00-03:00',
    },
    now: NOW,
  })
  assert.equal(model.drive.score, null)
  assert.equal(model.focus.score, null)
  assert.equal(model.diagnostics.cognitivePenalty, 0)
  assert.equal(model.axisQuality.dataQuality.confidence, 0)
  assert.equal(model.confidence.value, 0)
}

{
  const model = buildReadinessV1({
    healthSignals: [],
    allSignals: [],
    digitalActivitySnapshots: [{
      snapshot_date: SNAPSHOT_DATE,
      computed_at: '2026-04-29T17:45:00-03:00',
      total_screen_time_min: 240,
      pickups_count: 18,
      deep_work_total_min: 95,
      curated_input_min: 25,
      algorithmic_input_min: 12,
      intentional_entertainment_min: 10,
      default_entertainment_min: 8,
      communication_primary_min: 30,
      communication_shallow_min: 10,
      metadata: {},
    }],
    now: NOW,
  })
  assert.ok((model.focus.score ?? 0) >= 70)
  assert.ok((model.mind.score ?? 0) >= 70)
  assert.ok(model.axisQuality.focus.freshness > 0)
  assert.ok(model.axisQuality.focus.coverage > 0)
}

{
  const model = buildReadinessV1({
    healthSignals: [],
    allSignals: [],
    digitalActivitySnapshots: [{
      snapshot_date: SNAPSHOT_DATE,
      computed_at: '2026-04-29T17:45:00-03:00',
      total_screen_time_min: 600,
      pickups_count: null,
      deep_work_total_min: null,
      curated_input_min: null,
      algorithmic_input_min: null,
      intentional_entertainment_min: null,
      default_entertainment_min: null,
      communication_primary_min: null,
      communication_shallow_min: null,
      metadata: {
        capabilities: { category_classification: false },
        coverage: { classification_ratio: 0 },
        quality: { score: 45, warnings: ['no_category_classification'] },
      },
    }],
    now: NOW,
  })
  assert.ok(model.focus.confidence <= 0.55)
  assert.equal(model.diagnostics.cognitivePenalty, 0)
  assert.ok(model.axisQuality.focus.coverage < 0.6)
}

{
  const baselineLoad = Array.from({ length: 7 }, (_, index) => {
    const day = String(28 - index).padStart(2, '0')
    return [
      signal({ id: `load-active-${day}`, type: 'active_energy_kcal', value: 400, unit: 'kcal', start: `2026-04-${day}T18:00:00-03:00` }),
      signal({ id: `load-exercise-${day}`, type: 'exercise_minutes', value: 30, unit: 'min', start: `2026-04-${day}T18:00:00-03:00` }),
      signal({ id: `load-steps-${day}`, type: 'steps', value: 6000, unit: 'count', start: `2026-04-${day}T18:00:00-03:00` }),
      signal({ id: `load-distance-${day}`, type: 'walking_running_distance', value: 5000, unit: 'm', start: `2026-04-${day}T18:00:00-03:00` }),
    ]
  }).flat()
  const model = buildReadinessV1({
    healthSignals: [
      ...baselineLoad,
      signal({ id: 'load-active-today', type: 'active_energy_kcal', value: 650, unit: 'kcal', start: '2026-04-29T17:30:00-03:00' }),
      signal({ id: 'load-exercise-today', type: 'exercise_minutes', value: 65, unit: 'min', start: '2026-04-29T17:30:00-03:00' }),
      signal({ id: 'load-steps-today', type: 'steps', value: 9500, unit: 'count', start: '2026-04-29T17:30:00-03:00' }),
      signal({ id: 'load-distance-today', type: 'walking_running_distance', value: 7900, unit: 'm', start: '2026-04-29T17:30:00-03:00' }),
    ],
    now: NOW,
  })

  assert.ok((model.loadRatio ?? 0) > 1.7)
  assert.ok((model.load.score ?? 100) < 78)
  assert.ok(model.axisQuality.load.coverage > 0.4)
  assert.equal(model.axisQuality.load.baselineDays, 7)
}

{
  const baselineLoad = Array.from({ length: 7 }, (_, index) => {
    const day = String(28 - index).padStart(2, '0')
    return [
      signal({ id: `cardio-load-${day}`, type: 'workout_cardio_load', value: 100, unit: 'a.u.', start: `2026-04-${day}T18:00:00-03:00` }),
      signal({ id: `cardio-active-${day}`, type: 'active_energy_kcal', value: 400, unit: 'kcal', start: `2026-04-${day}T18:00:00-03:00` }),
      signal({ id: `cardio-exercise-${day}`, type: 'exercise_minutes', value: 30, unit: 'min', start: `2026-04-${day}T18:00:00-03:00` }),
      signal({ id: `cardio-steps-${day}`, type: 'steps', value: 6000, unit: 'count', start: `2026-04-${day}T18:00:00-03:00` }),
      signal({ id: `cardio-distance-${day}`, type: 'walking_running_distance', value: 5000, unit: 'm', start: `2026-04-${day}T18:00:00-03:00` }),
    ]
  }).flat()
  const model = buildReadinessV1({
    healthSignals: [
      ...baselineLoad,
      signal({ id: 'cardio-load-today', type: 'workout_cardio_load', value: 240, unit: 'a.u.', start: '2026-04-29T17:30:00-03:00' }),
      signal({ id: 'cardio-active-today', type: 'active_energy_kcal', value: 650, unit: 'kcal', start: '2026-04-29T17:30:00-03:00' }),
      signal({ id: 'cardio-exercise-today', type: 'exercise_minutes', value: 65, unit: 'min', start: '2026-04-29T17:30:00-03:00' }),
      signal({ id: 'cardio-steps-today', type: 'steps', value: 9500, unit: 'count', start: '2026-04-29T17:30:00-03:00' }),
      signal({ id: 'cardio-distance-today', type: 'walking_running_distance', value: 7900, unit: 'm', start: '2026-04-29T17:30:00-03:00' }),
    ],
    now: NOW,
  })

  assert.ok((model.loadRatio ?? 0) > 2)
  assert.ok((model.load.score ?? 100) < 65)
  assert.ok((model.dayStrain.value ?? 0) > 10)
  assert.equal(model.dayStrain.components.length, 9)
  assert.ok((model.dayStrain.loadRatio ?? 0) > 1.4)
  assert.ok(model.axisQuality.load.coverage > 0.75)
  assert.equal(model.axisQuality.load.baselineDays, 7)
}

{
  const snapshot = snapshotFor([
    signal({
      id: 'steps-1',
      type: 'steps',
      value: 1000,
      unit: 'count',
      start: '2026-04-29T00:00:00-03:00',
    }),
    signal({
      id: 'steps-2',
      type: 'steps',
      value: 2000,
      unit: 'count',
      start: '2026-04-29T10:00:00-03:00',
    }),
    signal({
      id: 'exercise',
      type: 'exercise_minutes',
      value: 45,
      unit: 'min',
      start: '2026-04-29T00:00:00-03:00',
    }),
  ])
  assert.equal(snapshot.steps, 3000)
  assert.equal(snapshot.exercise_minutes, 45)
  assert.equal(typeof snapshot.load?.day_strain, 'number')
  assert.ok(Array.isArray(snapshot.load?.load_components))
}

console.info('health metric fixture tests passed')
