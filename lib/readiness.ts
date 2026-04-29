import type { AtlasCheckin, AtlasPassiveSignal } from './api/client'

export type ReadinessSignal = Pick<
  AtlasPassiveSignal,
  'id' | 'client_id' | 'source' | 'signal_type' | 'value_numeric' | 'value_text' | 'unit' | 'started_at' | 'ended_at' | 'recorded_timezone' | 'metadata'
>

export type ReadinessCheckin = Pick<
  AtlasCheckin,
  'state' | 'energy_level' | 'mood_level' | 'recorded_at'
>

export interface ReadinessMetricValue {
  value: number | null
  text?: string | null
  unit?: string | null
  date?: string | null
}

export interface ReadinessScore {
  score: number | null
  label: string
  display: string
  confidence: number
}

export interface ReadinessFactor {
  key: string
  label: string
  value: string
  impact: number
  kind: 'positive' | 'negative' | 'neutral'
}

export interface ReadinessV1Model {
  version: 'readiness_v1'
  computedAt: string
  base: ReadinessScore
  current: ReadinessScore
  body: ReadinessScore
  mind: ReadinessScore
  drive: ReadinessScore
  focus: ReadinessScore
  sleep: ReadinessScore
  autonomic: ReadinessScore
  load: ReadinessScore
  subjective: ReadinessScore
  stability: ReadinessScore
  signature: {
    label: string
    detail: string
  }
  mode: {
    label: string
    detail: string
  }
  confidence: {
    value: number
    label: string
  }
  factors: ReadinessFactor[]
  sleepDebtHours: number | null
  loadRatio: number | null
  diagnostics: {
    sleepHours: number | null
    hrvRatio: number | null
    restingHeartRateRatio: number | null
    awakeHours: number | null
    todayDrain: number
    cognitivePenalty: number
  }
}

type StageKey = 'awake' | 'rem' | 'core' | 'deep' | 'asleep' | 'inBed'
type CheckinState = ReadinessCheckin['state']

interface ScoreComponent {
  key: string
  score: number | null
  weight: number
  confidence?: number
}

interface SleepNight {
  key: string
  asleepHours: number | null
  inBedHours: number | null
  efficiency: number | null
  bedtime: string | null
  wakeTime: string | null
  remHours: number | null
  deepHours: number | null
  coreHours: number | null
  awakeHours: number | null
}

const SLEEP_TARGET_HOURS = 7.5

export function buildReadinessV1(input: {
  healthSignals: ReadinessSignal[]
  allSignals?: ReadinessSignal[]
  latestCheckin?: ReadinessCheckin | null
  now?: Date
}): ReadinessV1Model {
  const now = input.now ?? new Date()
  const allSignals = input.allSignals ?? input.healthSignals
  const healthSignals = input.healthSignals

  const sleepNights = buildSleepNights(healthSignals, now)
  const currentNight = sleepNights[0] ?? null
  const sleep = sleepAxis(sleepNights)
  const autonomic = autonomicAxis(healthSignals, now)
  const load = loadAxis(healthSignals, now)
  const subjective = subjectiveAxis(allSignals, input.latestCheckin ?? null, now)
  const stability = stabilityAxis(healthSignals, now)

  const baseRaw = weightedScore([
    component('sleep', sleep.score, 35, sleep.confidence),
    component('autonomic', autonomic.score, 30, autonomic.confidence),
    component('load', load.score, 15, load.confidence),
    component('subjective', subjective.score, 15, subjective.confidence),
    component('stability', stability.score, 5, stability.confidence),
  ])
  const baseScore = currentNight?.asleepHours && currentNight.asleepHours < 5
    ? Math.min(baseRaw.score ?? 45, 52)
    : baseRaw.score
  const base = scoreDisplay(baseScore, baseRaw.confidence, readinessLabel)

  const bodyRaw = weightedScore([
    component('sleep', sleep.score, 34, sleep.confidence),
    component('autonomic', autonomic.score, 34, autonomic.confidence),
    component('load', load.score, 22, load.confidence),
    component('stability', stability.score, 10, stability.confidence),
  ])
  const body = scoreDisplay(bodyRaw.score, bodyRaw.confidence, axisLabel)

  const rizeFocus = rizeFocusAxis(allSignals, now)
  const mindRaw = weightedScore([
    component('subjective', subjective.score, 42, subjective.confidence),
    component('sleep', sleep.score, 24, sleep.confidence),
    component('autonomic', autonomic.score, 14, autonomic.confidence),
    component('rize', rizeFocus.score, 20, rizeFocus.confidence),
  ])
  const mind = scoreDisplay(mindRaw.score, mindRaw.confidence, axisLabel)

  const driveRaw = weightedScore([
    component('energy', subjective.energyScore, 45, subjective.confidence),
    component('state', subjective.stateScore, 25, subjective.confidence),
    component('load', load.score, 15, load.confidence),
    component('sleep', sleep.score, 15, sleep.confidence),
  ])
  const drive = scoreDisplay(driveRaw.score, driveRaw.confidence, axisLabel)

  const focusRaw = weightedScore([
    component('state', subjective.stateScore, 34, subjective.confidence),
    component('energy', subjective.energyScore, 24, subjective.confidence),
    component('sleep', sleep.score, 22, sleep.confidence),
    component('rize', rizeFocus.score, 20, rizeFocus.confidence),
  ])
  const focus = scoreDisplay(focusRaw.score, focusRaw.confidence, focusLabel)

  const awakeHours = currentNight?.wakeTime
    ? Math.max(0, (now.getTime() - new Date(currentNight.wakeTime).getTime()) / 3600000)
    : null
  const todayDrain = currentDayDrain(load.loadRatio, awakeHours, currentNight?.asleepHours ?? null)
  const cognitivePenalty = currentCognitivePenalty(subjective.state, subjective.freshness, rizeFocus.todayMinutes)
  const currentRawScore = base.score === null
    ? null
    : clamp(base.score - todayDrain - cognitivePenalty + recoveryBonus(subjective.state, subjective.freshness), 0, 100)
  const current = scoreDisplay(currentRawScore, Math.min(base.confidence, Math.max(0.35, subjective.confidence)), capacityLabel)

  const factors = readinessFactors({
    sleepNights,
    sleepDebtHours: sleep.sleepDebtHours,
    autonomic,
    load,
    subjective,
    stability,
    todayDrain,
    cognitivePenalty,
  })

  const signature = readinessSignature(body.score, mind.score, drive.score)
  const mode = readinessMode(base.score, current.score, signature.label)
  const confidence = confidenceLabel(weightedScore([
    component('sleep', sleep.score, 35, sleep.confidence),
    component('autonomic', autonomic.score, 30, autonomic.confidence),
    component('subjective', subjective.score, 20, subjective.confidence),
    component('load', load.score, 15, load.confidence),
  ]).confidence)

  return {
    version: 'readiness_v1',
    computedAt: now.toISOString(),
    base,
    current,
    body,
    mind,
    drive,
    focus,
    sleep: scoreDisplay(sleep.score, sleep.confidence, axisLabel),
    autonomic: scoreDisplay(autonomic.score, autonomic.confidence, axisLabel),
    load: scoreDisplay(load.score, load.confidence, loadLabel),
    subjective: scoreDisplay(subjective.score, subjective.confidence, axisLabel),
    stability: scoreDisplay(stability.score, stability.confidence, stabilityLabel),
    signature,
    mode,
    confidence,
    factors,
    sleepDebtHours: sleep.sleepDebtHours,
    loadRatio: load.loadRatio,
    diagnostics: {
      sleepHours: currentNight?.asleepHours ?? null,
      hrvRatio: autonomic.hrvRatio,
      restingHeartRateRatio: autonomic.rhrRatio,
      awakeHours,
      todayDrain,
      cognitivePenalty,
    },
  }
}

function sleepAxis(nights: SleepNight[]) {
  const night = nights[0] ?? null
  if (!night || typeof night.asleepHours !== 'number') {
    return { score: null, confidence: 0, sleepDebtHours: null }
  }

  const asleep = night.asleepHours
  const durationScore = clamp(((asleep - 4.5) / 3) * 100, 0, 100)
  const sleepDebtHours = sleepDebt(nights)
  const debtScore = sleepDebtHours === null
    ? null
    : clamp(100 - sleepDebtHours * 8, 20, 100)
  const consistency = bedtimeConsistencyMinutes(nights.slice(0, 7))
  const consistencyScore = consistency === null
    ? null
    : clamp(100 - Math.max(0, consistency - 20) * 0.9, 25, 100)
  const continuityScore = typeof night.efficiency === 'number'
    ? clamp(((night.efficiency - 78) / 17) * 100, 0, 100)
    : null
  const architectureScore = architectureScoreFor(night)

  const raw = weightedScore([
    component('duration', durationScore, 45),
    component('debt', debtScore, 20),
    component('consistency', consistencyScore, 15),
    component('continuity', continuityScore, 10),
    component('architecture', architectureScore, 10),
  ])

  let score = raw.score
  if (score !== null && asleep < 5) score = Math.min(score, 50)
  if (score !== null && asleep < 6) score = Math.min(score, 64)
  if (score !== null && asleep < 7) score = Math.min(score, 78)

  return {
    score,
    confidence: raw.confidence,
    sleepDebtHours,
  }
}

function autonomicAxis(signals: ReadinessSignal[], now: Date) {
  const hrv = latestDayMedian(signals, ['hrv_ms'], now)
  const hrvBaseline = baselineDailyMedian(signals, ['hrv_ms'], now)
  const rhr = latestDayMedian(signals, ['resting_heart_rate_bpm'], now)
  const rhrBaseline = baselineDailyMedian(signals, ['resting_heart_rate_bpm'], now)
  const respiration = latestDayMedian(signals, ['respiratory_rate'], now)
  const respirationBaseline = baselineDailyMedian(signals, ['respiratory_rate'], now)

  const hrvRatio = ratio(hrv.value, hrvBaseline)
  const rhrRatio = ratio(rhrBaseline, rhr.value)
  const respirationRatio = ratio(respiration.value, respirationBaseline)

  const hrvScore = hrvRatio === null
    ? typeof hrv.value === 'number' ? 62 : null
    : ratioHigherIsBetterScore(hrvRatio)
  const rhrScore = rhrRatio === null
    ? typeof rhr.value === 'number' ? 66 : null
    : ratioHigherIsBetterScore(rhrRatio)
  const respirationScore = respirationRatio === null
    ? typeof respiration.value === 'number' ? 68 : null
    : stableRatioScore(respirationRatio)

  const raw = weightedScore([
    component('hrv', hrvScore, 50, hrvRatio === null ? 0.35 : 1),
    component('rhr', rhrScore, 35, rhrRatio === null ? 0.35 : 1),
    component('respiration', respirationScore, 15, respirationRatio === null ? 0.35 : 1),
  ])

  return {
    score: raw.score,
    confidence: raw.confidence,
    hrv,
    hrvBaseline,
    hrvRatio,
    rhr,
    rhrBaseline,
    rhrRatio,
    respiration,
    respirationBaseline,
    respirationRatio,
  }
}

function loadAxis(signals: ReadinessSignal[], now: Date) {
  const progress = dayProgress(now)
  const ratios = [
    expectedDayRatio(signals, ['steps'], now, progress),
    expectedDayRatio(signals, ['exercise_minutes'], now, progress),
    expectedDayRatio(signals, ['active_energy_kcal'], now, progress),
    expectedDayRatio(signals, ['walking_running_distance', 'HKQuantityTypeIdentifierDistanceWalkingRunning'], now, progress),
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const loadRatio = ratios.length ? median(ratios) : null
  const recentWorkout = latestValue(signals, ['workout'])
  const workoutPressure = workoutPenalty(recentWorkout, now)

  const score = loadRatio === null
    ? workoutPressure > 0 ? clamp(82 - workoutPressure, 30, 90) : null
    : clamp(92 - Math.max(0, loadRatio - 1.05) * 42 - workoutPressure, 25, 96)

  return {
    score,
    confidence: loadRatio === null ? (workoutPressure > 0 ? 0.35 : 0) : clamp(ratios.length / 3, 0.35, 1),
    loadRatio,
    recentWorkout,
    workoutPressure,
  }
}

function subjectiveAxis(signals: ReadinessSignal[], checkin: ReadinessCheckin | null, now: Date) {
  const stateOfMind = latestValue(signals, ['state_of_mind_valence'])
  const state = checkin?.state ?? null
  const ageHours = checkin ? Math.max(0, (now.getTime() - new Date(checkin.recorded_at).getTime()) / 3600000) : null
  const freshness = ageHours === null ? 0 : Math.pow(0.5, ageHours / 8)
  const energyScore = typeof checkin?.energy_level === 'number'
    ? levelToScore(checkin.energy_level)
    : null
  const moodScore = typeof checkin?.mood_level === 'number'
    ? levelToScore(checkin.mood_level)
    : stateOfMindScore(stateOfMind.value)
  const stateScore = state ? stateToScore(state) : null

  const raw = weightedScore([
    component('energy', energyScore, 38),
    component('mood', moodScore, 34, checkin ? 1 : 0.45),
    component('state', stateScore, 28),
  ])

  const decayed = raw.score === null
    ? null
    : raw.score * Math.max(0.2, freshness) + 60 * (1 - Math.max(0.2, freshness))

  return {
    score: decayed,
    confidence: checkin
      ? clamp(0.25 + raw.confidence * (0.35 + freshness * 0.65), 0.25, 1)
      : raw.confidence * 0.45,
    energyScore,
    moodScore,
    stateScore,
    state,
    freshness,
    checkin,
    stateOfMind,
  }
}

function rizeFocusAxis(signals: ReadinessSignal[], now: Date) {
  const todayMinutes = dailySum(signals, ['focus_minutes', 'rize_focus_minutes'], now).value
  const baseline = previousSevenDayAverage(signals, ['focus_minutes', 'rize_focus_minutes'], now)
  if (typeof todayMinutes !== 'number' && typeof baseline !== 'number') {
    return { score: null, confidence: 0, todayMinutes: null }
  }

  if (typeof todayMinutes === 'number' && typeof baseline === 'number' && baseline > 0) {
    return {
      score: clamp(55 + (todayMinutes / Math.max(30, baseline * dayProgress(now)) - 1) * 18, 35, 92),
      confidence: 0.75,
      todayMinutes,
    }
  }

  return {
    score: typeof todayMinutes === 'number' && todayMinutes > 60 ? 72 : 58,
    confidence: 0.35,
    todayMinutes,
  }
}

function stabilityAxis(signals: ReadinessSignal[], now: Date) {
  const wristTemp = latestDayMedian(signals, ['wrist_temperature'], now)
  const wristTempBaseline = baselineDailyMedian(signals, ['wrist_temperature'], now)
  const respiration = latestDayMedian(signals, ['respiratory_rate'], now)
  const respirationBaseline = baselineDailyMedian(signals, ['respiratory_rate'], now)
  const oxygen = latestDayMedian(signals, ['oxygen_saturation'], now)

  let penalty = 0
  let confidence = 0

  if (typeof wristTemp.value === 'number' && typeof wristTempBaseline === 'number') {
    const diff = Math.abs(wristTemp.value - wristTempBaseline)
    penalty += diff > 0.25 ? Math.min(26, diff * 28) : 0
    confidence += 0.4
  }

  if (typeof respiration.value === 'number' && typeof respirationBaseline === 'number' && respirationBaseline > 0) {
    const diff = Math.abs(respiration.value / respirationBaseline - 1)
    penalty += diff > 0.08 ? Math.min(28, diff * 170) : 0
    confidence += 0.35
  }

  if (typeof oxygen.value === 'number') {
    const oxygenPercent = oxygen.value <= 1 ? oxygen.value * 100 : oxygen.value
    penalty += oxygenPercent < 94 ? Math.min(30, (94 - oxygenPercent) * 8) : 0
    confidence += 0.25
  }

  if (confidence === 0) return { score: null, confidence: 0, wristTemp, wristTempBaseline, respiration, respirationBaseline }

  return {
    score: clamp(92 - penalty, 25, 96),
    confidence: clamp(confidence, 0, 1),
    wristTemp,
    wristTempBaseline,
    respiration,
    respirationBaseline,
  }
}

function readinessFactors(input: {
  sleepNights: SleepNight[]
  sleepDebtHours: number | null
  autonomic: ReturnType<typeof autonomicAxis>
  load: ReturnType<typeof loadAxis>
  subjective: ReturnType<typeof subjectiveAxis>
  stability: ReturnType<typeof stabilityAxis>
  todayDrain: number
  cognitivePenalty: number
}): ReadinessFactor[] {
  const factors: ReadinessFactor[] = []
  const night = input.sleepNights[0] ?? null

  if (typeof night?.asleepHours === 'number') {
    const delta = night.asleepHours - SLEEP_TARGET_HOURS
    if (delta < -0.35) {
      factors.push(factor('short_sleep', 'Sono curto', formatHours(Math.abs(delta)), -Math.min(24, Math.round(Math.abs(delta) * 8))))
    } else if (delta > 0.2) {
      factors.push(factor('sleep_target', 'Sono suficiente', formatHours(night.asleepHours), 8))
    }
  }

  if (typeof input.sleepDebtHours === 'number' && input.sleepDebtHours > 0.75) {
    factors.push(factor('sleep_debt', 'Débito acumulado', formatHours(input.sleepDebtHours), -Math.min(22, Math.round(input.sleepDebtHours * 4))))
  }

  if (typeof input.autonomic.hrvRatio === 'number') {
    if (input.autonomic.hrvRatio < 0.9) {
      factors.push(factor('hrv_low', 'HRV abaixo da base', `${Math.round((1 - input.autonomic.hrvRatio) * 100)}%`, -Math.min(18, Math.round((1 - input.autonomic.hrvRatio) * 70))))
    } else if (input.autonomic.hrvRatio > 1.08) {
      factors.push(factor('hrv_high', 'HRV acima da base', `${Math.round((input.autonomic.hrvRatio - 1) * 100)}%`, 10))
    }
  }

  if (typeof input.autonomic.rhrRatio === 'number') {
    if (input.autonomic.rhrRatio < 0.94) {
      factors.push(factor('rhr_high', 'FC repouso pressionada', `${Math.round((1 / input.autonomic.rhrRatio - 1) * 100)}%`, -10))
    } else if (input.autonomic.rhrRatio > 1.04) {
      factors.push(factor('rhr_good', 'FC repouso favorável', `${Math.round((input.autonomic.rhrRatio - 1) * 100)}%`, 8))
    }
  }

  if (typeof input.load.loadRatio === 'number' && input.load.loadRatio > 1.2) {
    factors.push(factor('activity_high', 'Carga acima do esperado', `${Math.round(input.load.loadRatio * 100)}%`, -Math.min(18, Math.round((input.load.loadRatio - 1) * 24))))
  }

  if (input.load.workoutPressure > 0) {
    factors.push(factor('recent_workout', 'Treino recente', formatMetricValue(input.load.recentWorkout), -Math.round(input.load.workoutPressure)))
  }

  if (input.subjective.checkin) {
    if (input.subjective.checkin.energy_level <= 2) {
      factors.push(factor('low_energy', 'Energia baixa', `${input.subjective.checkin.energy_level} / 5`, -12))
    }
    if (input.subjective.checkin.mood_level <= 2) {
      factors.push(factor('low_mood', 'Mood baixo', `${input.subjective.checkin.mood_level} / 5`, -9))
    }
    if (input.subjective.state && input.subjective.state !== 'focused') {
      factors.push(factor('state_not_focused', 'Estado atual', checkinStateLabel(input.subjective.state), input.subjective.state === 'blocked' ? -14 : -7))
    }
  }

  if (input.todayDrain > 7) {
    factors.push(factor('day_drain', 'Dreno do dia', `${Math.round(input.todayDrain)} pts`, -Math.round(input.todayDrain)))
  }

  if (input.cognitivePenalty > 0) {
    factors.push(factor('cognitive_state', 'Mente sem tração', `${Math.round(input.cognitivePenalty)} pts`, -Math.round(input.cognitivePenalty)))
  }

  if (typeof input.stability.score === 'number' && input.stability.score < 72) {
    factors.push(factor('stability', 'Sinais de instabilidade', `${Math.round(input.stability.score)}%`, -8))
  }

  return factors
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 5)
}

function buildSleepNights(signals: ReadinessSignal[], now: Date): SleepNight[] {
  const groups = new Map<string, { duration?: ReadinessSignal; stages: ReadinessSignal[] }>()
  const start = new Date(now)
  start.setDate(now.getDate() - 30)

  for (const signal of signals) {
    if (signal.signal_type !== 'sleep_duration_hours' && signal.signal_type !== 'sleep_stage') continue
    if (signalEndTime(signal) < start.getTime()) continue

    const key = localDateKey(signal.ended_at ?? signal.started_at)
    const group = groups.get(key) ?? { stages: [] }
    if (signal.signal_type === 'sleep_duration_hours') {
      if (!group.duration || signalEndTime(signal) >= signalEndTime(group.duration)) {
        group.duration = signal
      }
    } else {
      group.stages.push(signal)
    }
    groups.set(key, group)
  }

  return [...groups.entries()]
    .map(([key, group]) => sleepNightFromGroup(key, group.duration, group.stages))
    .filter((night) => typeof night.asleepHours === 'number' || night.wakeTime)
    .sort((a, b) => b.key.localeCompare(a.key))
}

function sleepNightFromGroup(key: string, duration: ReadinessSignal | undefined, stages: ReadinessSignal[]): SleepNight {
  const stageDurations = stageDurationsFor(stages)
  const stageTimes = stages
    .flatMap((signal) => [new Date(signal.started_at).getTime(), signalEndTime(signal)])
    .filter((time) => Number.isFinite(time))
  const startedAt = stageTimes.length ? new Date(Math.min(...stageTimes)).toISOString() : duration?.started_at ?? null
  const endedAt = stageTimes.length ? new Date(Math.max(...stageTimes)).toISOString() : duration?.ended_at ?? duration?.started_at ?? null
  const asleepFromStages = (
    (stageDurations.deep ?? 0)
    + (stageDurations.rem ?? 0)
    + (stageDurations.core ?? 0)
    + (stageDurations.asleep ?? 0)
  )
  const asleepHours = typeof duration?.value_numeric === 'number'
    ? Number(duration.value_numeric)
    : asleepFromStages > 0
      ? asleepFromStages
      : null
  const spanHours = startedAt && endedAt
    ? Math.max(0, (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 3600000)
    : null
  const inBedHours = spanHours && asleepHours ? Math.max(spanHours, asleepHours) : spanHours ?? asleepHours
  const efficiency = inBedHours && asleepHours ? clamp((asleepHours / inBedHours) * 100, 0, 100) : null

  return {
    key,
    asleepHours,
    inBedHours,
    efficiency,
    bedtime: startedAt,
    wakeTime: endedAt,
    remHours: numericOrNull(stageDurations.rem),
    deepHours: numericOrNull(stageDurations.deep),
    coreHours: numericOrNull(stageDurations.core),
    awakeHours: numericOrNull(stageDurations.awake),
  }
}

function stageDurationsFor(stages: ReadinessSignal[]): Partial<Record<StageKey, number>> {
  const result: Partial<Record<StageKey, number>> = {}
  for (const signal of stages) {
    const key = sleepStageKey(signal.value_numeric)
    if (!key) continue
    result[key] = (result[key] ?? 0) + signalDurationHours(signal)
  }
  return result
}

function sleepStageKey(value: number | null): StageKey | null {
  switch (Number(value)) {
    case 0: return 'inBed'
    case 1: return 'asleep'
    case 2: return 'awake'
    case 3: return 'core'
    case 4: return 'deep'
    case 5: return 'rem'
    default: return null
  }
}

function architectureScoreFor(night: SleepNight): number | null {
  if (typeof night.asleepHours !== 'number' || night.asleepHours <= 0) return null
  const remDeep = (night.remHours ?? 0) + (night.deepHours ?? 0)
  if (remDeep <= 0) return null
  const ratioValue = remDeep / night.asleepHours
  return clamp((ratioValue / 0.32) * 100, 35, 100)
}

function sleepDebt(nights: SleepNight[]): number | null {
  const recent = nights
    .filter((night) => typeof night.asleepHours === 'number')
    .slice(0, 7)
  if (recent.length === 0) return null
  return recent.reduce((sum, night) => sum + Math.max(0, SLEEP_TARGET_HOURS - Number(night.asleepHours)), 0)
}

function bedtimeConsistencyMinutes(nights: SleepNight[]): number | null {
  const minutes = nights
    .map((night) => night.bedtime ? clockMinuteForSleep(night.bedtime) : null)
    .filter((value): value is number => typeof value === 'number')
  if (minutes.length < 3) return null
  const baseline = median(minutes)
  return average(minutes.map((value) => Math.abs(value - baseline)))
}

function clockMinuteForSleep(iso: string): number {
  const date = new Date(iso)
  const minute = date.getHours() * 60 + date.getMinutes()
  return minute < 12 * 60 ? minute + 24 * 60 : minute
}

function latestValue(signals: ReadinessSignal[], signalTypes: string[]): ReadinessMetricValue {
  const match = signals
    .filter((signal) => signalTypes.includes(signal.signal_type))
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
  return signalToMetricValue(match)
}

function latestDayMedian(signals: ReadinessSignal[], signalTypes: string[], now: Date): ReadinessMetricValue {
  const matches = signals
    .filter((signal) => (
      signalTypes.includes(signal.signal_type)
      && typeof signal.value_numeric === 'number'
      && new Date(signal.started_at).getTime() <= now.getTime()
    ))
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

  if (matches.length === 0) return { value: null }

  const latestDay = localDateKey(matches[0].started_at)
  const daySamples = matches.filter((signal) => localDateKey(signal.started_at) === latestDay)
  return {
    value: median(daySamples.map((signal) => Number(signal.value_numeric))),
    unit: daySamples[0]?.unit,
    date: daySamples[0]?.started_at,
  }
}

function dailySum(signals: ReadinessSignal[], signalTypes: string[], date = new Date()): ReadinessMetricValue {
  const start = startOfLocalDay(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 1)
  const matches = signals.filter((signal) => {
    const time = new Date(signal.started_at).getTime()
    return signalTypes.includes(signal.signal_type)
      && time >= start.getTime()
      && time < end.getTime()
      && typeof signal.value_numeric === 'number'
  })

  if (matches.length === 0) return { value: null }
  const total = matches.reduce((acc, signal) => acc + Number(signal.value_numeric ?? 0), 0)
  const latest = matches.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
  return { value: total, unit: latest.unit, date: latest.started_at }
}

function previousSevenDayAverage(signals: ReadinessSignal[], signalTypes: string[], now: Date): number | null {
  const today = startOfLocalDay(now)
  const values: number[] = []

  for (let daysAgo = 1; daysAgo <= 7; daysAgo++) {
    const date = new Date(today)
    date.setDate(today.getDate() - daysAgo)
    const value = dailySum(signals, signalTypes, date).value
    if (typeof value === 'number') values.push(value)
  }

  return values.length ? average(values) : null
}

function expectedDayRatio(signals: ReadinessSignal[], signalTypes: string[], now: Date, progress: number): number | null {
  const current = dailySum(signals, signalTypes, now).value
  const baseline = previousSevenDayAverage(signals, signalTypes, now)
  if (typeof current !== 'number' || typeof baseline !== 'number' || baseline <= 0) return null
  return current / Math.max(baseline * Math.max(0.18, progress), 1)
}

function baselineDailyMedian(signals: ReadinessSignal[], signalTypes: string[], now: Date): number | null {
  const cutoff = startOfLocalDay(now)
  const start = new Date(cutoff)
  start.setDate(cutoff.getDate() - 28)
  const byDay = groupedNumericSignalsByDay(signals, signalTypes, start, cutoff)
  const dayMedians = [...byDay.values()].map((bucket) => median(bucket.map((signal) => Number(signal.value_numeric))))
  if (dayMedians.length < 3) return null
  return median(dayMedians)
}

function groupedNumericSignalsByDay(
  signals: ReadinessSignal[],
  signalTypes: string[],
  start: Date,
  end: Date,
): Map<string, ReadinessSignal[]> {
  const byDay = new Map<string, ReadinessSignal[]>()
  for (const signal of signals) {
    const time = new Date(signal.started_at).getTime()
    if (
      !signalTypes.includes(signal.signal_type)
      || typeof signal.value_numeric !== 'number'
      || time < start.getTime()
      || time >= end.getTime()
    ) {
      continue
    }
    const key = localDateKey(signal.started_at)
    byDay.set(key, [...(byDay.get(key) ?? []), signal])
  }
  return byDay
}

function weightedScore(components: ScoreComponent[]): { score: number | null; confidence: number } {
  const totalWeight = components.reduce((sum, item) => sum + item.weight, 0)
  const present = components.filter((item) => typeof item.score === 'number')
  if (present.length === 0 || totalWeight === 0) return { score: null, confidence: 0 }
  const weighted = present.reduce((sum, item) => sum + Number(item.score) * item.weight, 0)
  const weight = present.reduce((sum, item) => sum + item.weight, 0)
  const confidence = present.reduce((sum, item) => sum + item.weight * (item.confidence ?? 1), 0) / totalWeight
  return { score: clamp(weighted / weight, 0, 100), confidence: clamp(confidence, 0, 1) }
}

function component(key: string, score: number | null, weight: number, confidence = 1): ScoreComponent {
  return { key, score, weight, confidence }
}

function scoreDisplay(
  score: number | null,
  confidence: number,
  labeler: (score: number | null, confidence?: number) => string,
): ReadinessScore {
  const rounded = typeof score === 'number' ? Math.round(score) : null
  const label = labeler(rounded, confidence)
  return {
    score: rounded,
    label,
    display: rounded === null ? label : `${rounded}% ${label}`,
    confidence: clamp(confidence, 0, 1),
  }
}

function readinessLabel(score: number | null): string {
  if (score === null) return 'Baseline'
  if (score >= 85) return 'alta'
  if (score >= 70) return 'boa'
  if (score >= 55) return 'baixa'
  if (score >= 40) return 'frágil'
  return 'recuperação'
}

function capacityLabel(score: number | null): string {
  if (score === null) return 'Sem dado'
  if (score >= 82) return 'alta'
  if (score >= 68) return 'operacional'
  if (score >= 52) return 'limitada'
  if (score >= 38) return 'baixa'
  return 'preservar'
}

function axisLabel(score: number | null): string {
  if (score === null) return 'Sem dado'
  if (score >= 82) return 'alto'
  if (score >= 68) return 'bom'
  if (score >= 52) return 'baixo'
  return 'fraco'
}

function focusLabel(score: number | null): string {
  if (score === null) return 'Sem dado'
  if (score >= 78) return 'profundo'
  if (score >= 60) return 'operacional'
  if (score >= 42) return 'leve'
  return 'baixo'
}

function loadLabel(score: number | null): string {
  if (score === null) return 'Sem baseline'
  if (score >= 82) return 'baixa'
  if (score >= 62) return 'normal'
  return 'alta'
}

function stabilityLabel(score: number | null): string {
  if (score === null) return 'Sem dado'
  if (score >= 82) return 'estável'
  if (score >= 62) return 'observar'
  return 'instável'
}

function confidenceLabel(value: number): { value: number; label: string } {
  const pct = Math.round(clamp(value, 0, 1) * 100)
  if (pct >= 78) return { value: pct, label: `${pct}% boa` }
  if (pct >= 48) return { value: pct, label: `${pct}% parcial` }
  return { value: pct, label: `${pct}% baseline` }
}

function readinessSignature(body: number | null, mind: number | null, drive: number | null) {
  if (body === null || mind === null) {
    return {
      label: 'Baseline em formação',
      detail: 'Atlas ainda precisa de mais sinais para separar corpo e mente.',
    }
  }

  if (body < 55 && mind >= 70) {
    return {
      label: 'Corpo cansado, mente acelerada',
      detail: 'Use foco curto e preserve carga física.',
    }
  }

  if (body >= 70 && mind < 55) {
    return {
      label: 'Corpo pronto, mente baixa',
      detail: 'A primeira tarefa deve ser simples e concreta.',
    }
  }

  if (body < 55 && mind < 55) {
    return {
      label: 'Recuperação prioritária',
      detail: 'Hoje pede menos volume e mais controle de estímulo.',
    }
  }

  if (body >= 75 && mind >= 75 && (drive ?? 0) >= 70) {
    return {
      label: 'Janela forte',
      detail: 'Bom momento para trabalho profundo ou treino mais exigente.',
    }
  }

  return {
    label: 'Operacional com margem limitada',
    detail: 'Funciona melhor com blocos curtos e revisão frequente do estado.',
  }
}

function readinessMode(base: number | null, current: number | null, signature: string) {
  const score = current ?? base
  if (score === null) {
    return { label: 'Coletar baseline', detail: 'Permita saúde, faça check-in e colete dados por alguns dias.' }
  }

  if (signature === 'Corpo cansado, mente acelerada') {
    return { label: 'Foco protegido', detail: 'Sem aumentar carga física; use blocos mentais menores.' }
  }

  if (score < 42) return { label: 'Recuperação', detail: 'Reduzir fricção, evitar decisões pesadas e preservar sono.' }
  if (score < 56) return { label: 'Leve', detail: 'Tarefas operacionais, pausas curtas e sem volume extra.' }
  if (score < 72) return { label: 'Manutenção', detail: 'Dia útil, mas com limite claro de intensidade.' }
  if (score < 86) return { label: 'Profundo', detail: 'Boa janela para foco ou execução importante.' }
  return { label: 'Expansão', detail: 'Seu sistema aceita maior complexidade hoje.' }
}

function currentDayDrain(loadRatio: number | null, awakeHours: number | null, sleepHours: number | null): number {
  let drain = 0
  if (typeof loadRatio === 'number' && loadRatio > 1.05) {
    drain += Math.min(18, (loadRatio - 1.05) * 18)
  }

  if (typeof awakeHours === 'number') {
    const threshold = typeof sleepHours === 'number' && sleepHours < 6 ? 8 : 11
    if (awakeHours > threshold) drain += Math.min(18, (awakeHours - threshold) * 2.1)
  }

  return Math.round(clamp(drain, 0, 28))
}

function currentCognitivePenalty(state: CheckinState | null, freshness: number, rizeToday: number | null): number {
  let penalty = 0
  if (state === 'blocked') penalty += 12
  if (state === 'disperse') penalty += 7
  if (state === 'pause') penalty += 3
  if (freshness < 0.25 && state) penalty += 2
  if (typeof rizeToday === 'number' && rizeToday > 210) penalty += 4
  return penalty
}

function recoveryBonus(state: CheckinState | null, freshness: number): number {
  return state === 'pause' && freshness > 0.4 ? 4 : 0
}

function workoutPenalty(workout: ReadinessMetricValue, now: Date): number {
  if (typeof workout.value !== 'number' || !workout.date) return 0
  const ageHours = Math.max(0, (now.getTime() - new Date(workout.date).getTime()) / 3600000)
  if (ageHours > 30) return 0
  const minutes = workout.unit === 's' ? workout.value / 60 : workout.value
  if (minutes < 25) return 0
  return clamp((minutes - 25) / 5, 2, 14) * Math.pow(0.5, ageHours / 18)
}

function ratioHigherIsBetterScore(value: number): number {
  if (value >= 1.15) return 96
  if (value >= 1) return 76 + (value - 1) * 120
  if (value >= 0.85) return 52 + (value - 0.85) * 160
  return clamp(35 + (value - 0.65) * 85, 18, 52)
}

function stableRatioScore(value: number): number {
  const deviation = Math.abs(value - 1)
  return clamp(100 - deviation * 260, 25, 100)
}

function levelToScore(value: number): number {
  return clamp(20 + (value - 1) * 20, 0, 100)
}

function stateToScore(state: CheckinState): number {
  switch (state) {
    case 'focused': return 86
    case 'pause': return 66
    case 'disperse': return 45
    case 'blocked': return 28
    default: return 50
  }
}

function stateOfMindScore(value: number | null): number | null {
  if (typeof value !== 'number') return null
  return clamp(50 + value * 45, 5, 95)
}

function factor(key: string, label: string, value: string, impact: number): ReadinessFactor {
  return {
    key,
    label,
    value,
    impact,
    kind: impact > 0 ? 'positive' : impact < 0 ? 'negative' : 'neutral',
  }
}

function checkinStateLabel(state: CheckinState): string {
  switch (state) {
    case 'focused': return 'Em foco'
    case 'disperse': return 'Disperso'
    case 'blocked': return 'Bloqueado'
    case 'pause': return 'Pausa'
    default: return state
  }
}

function signalToMetricValue(signal?: ReadinessSignal): ReadinessMetricValue {
  if (!signal) return { value: null }
  return {
    value: typeof signal.value_numeric === 'number' ? signal.value_numeric : null,
    text: signal.value_text,
    unit: signal.unit,
    date: signal.started_at,
  }
}

function formatMetricValue(value: ReadinessMetricValue): string {
  if (value.text?.trim()) return value.text.trim()
  if (typeof value.value !== 'number') return 'Sem dado'
  if (value.unit === 's') return formatDuration(value.value)
  if (value.unit === 'h') return formatHours(value.value)
  const formatted = Number.isInteger(value.value) ? String(value.value) : value.value.toFixed(1).replace('.', ',')
  return `${formatted}${value.unit ? ` ${value.unit}` : ''}`
}

function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h${String(m).padStart(2, '0')}`
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  return `${hours}h${String(minutes % 60).padStart(2, '0')}`
}

function dayProgress(date: Date): number {
  const minutes = date.getHours() * 60 + date.getMinutes()
  return clamp(minutes / 1440, 0.08, 1)
}

function signalEndTime(signal: ReadinessSignal): number {
  return new Date(signal.ended_at ?? signal.started_at).getTime()
}

function signalDurationHours(signal: ReadinessSignal): number {
  const started = new Date(signal.started_at).getTime()
  const ended = signalEndTime(signal)
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) return 0
  return (ended - started) / 3600000
}

function numericOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && value > 0 ? value : null
}

function localDateKey(iso: string): string {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfLocalDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function ratio(current?: number | null, previous?: number | null): number | null {
  if (typeof current !== 'number' || typeof previous !== 'number' || previous === 0) return null
  return current / previous
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
