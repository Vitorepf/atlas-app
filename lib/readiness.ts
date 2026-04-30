import type { AtlasCheckin, AtlasDigitalActivitySnapshot, AtlasPassiveSignal } from './api/client'
import {
  inferSleepTarget,
  sleepDebtHoursForNights,
  sleepDeficitHours,
  type SleepTargetEvidence,
  type SleepTargetNight,
} from './sleepTarget'
import {
  checkinLevelFreshness,
  checkinStateFreshness,
} from './checkinFreshness'
import { analyzeSleepDays } from './sleepAnalysis'
import { sleepStressForDate } from './sleepPhysiology'

export type ReadinessSignal = Pick<
  AtlasPassiveSignal,
  'id' | 'client_id' | 'source' | 'signal_type' | 'value_numeric' | 'value_text' | 'unit' | 'started_at' | 'ended_at' | 'recorded_timezone' | 'metadata'
>

export type ReadinessCheckin = Pick<
  AtlasCheckin,
  'state' | 'energy_level' | 'mood_level' | 'recorded_at'
>

export type ReadinessDigitalSnapshot = Pick<
  AtlasDigitalActivitySnapshot,
  | 'snapshot_date'
  | 'computed_at'
  | 'total_screen_time_min'
  | 'pickups_count'
  | 'deep_work_total_min'
  | 'curated_input_min'
  | 'algorithmic_input_min'
  | 'intentional_entertainment_min'
  | 'default_entertainment_min'
  | 'communication_primary_min'
  | 'communication_shallow_min'
  | 'metadata'
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

export type ReadinessAxisKey =
  | 'base'
  | 'current'
  | 'body'
  | 'mind'
  | 'drive'
  | 'focus'
  | 'nightRecovery'
  | 'sleep'
  | 'autonomic'
  | 'load'
  | 'subjective'
  | 'stability'
  | 'dataQuality'

export interface ReadinessAxisQuality {
  confidence: number
  coverage: number
  freshness: number
  baselineDays: number | null
  status: 'good' | 'partial' | 'baseline'
  summary: string
}

export type NightRecoveryComponentKey =
  | 'hrv'
  | 'sleep_hr'
  | 'respiration'
  | 'wrist_temperature'
  | 'oxygen'
  | 'sleep'

export interface NightRecoveryComponent {
  key: NightRecoveryComponentKey
  label: string
  value: number | null
  baseline: number | null
  unit: string | null
  delta: number | null
  percentDelta: number | null
  score: number | null
  confidence: number
  weight: number
  direction: 'higher_is_better' | 'lower_is_better' | 'stable_is_better'
  status: 'good' | 'watch' | 'risk' | 'missing'
  summary: string
}

export type LoadComponentKey =
  | 'cardio_load'
  | 'waking_cardio_load'
  | 'high_zones'
  | 'moderate_zones'
  | 'workout_effort'
  | 'active_energy'
  | 'exercise'
  | 'steps'
  | 'distance'

export interface LoadComponent {
  key: LoadComponentKey
  label: string
  value: number | null
  baseline: number | null
  unit: string | null
  ratio: number | null
  strainContribution: number | null
  confidence: number
  weight: number
  status: 'low' | 'normal' | 'high' | 'missing'
  summary: string
}

export interface DayStrain {
  value: number | null
  label: string
  confidence: number
  loadRatio: number | null
  acuteChronic: number | null
  coverage: number
  components: LoadComponent[]
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
  nightRecovery: ReadinessScore
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
  sleepTargetHours: number
  sleepTargetEvidence: SleepTargetEvidence
  sleepDebtHours: number | null
  dayStrain: DayStrain
  loadRatio: number | null
  axisQuality: Record<ReadinessAxisKey, ReadinessAxisQuality>
  nightRecoveryComponents: NightRecoveryComponent[]
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
type SleepInterval = { start: number; end: number }

interface ScoreComponent {
  key: string
  score: number | null
  weight: number
  confidence?: number
}

interface LoadRatioInput {
  value: number
  weight: number
  baselineDays: number
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
  latencyMinutes: number | null
  awakeEpisodeCount: number | null
  disturbanceCount: number | null
  sleepCycleCount: number | null
  stageCoverage: number | null
  dataQuality: number
  napHours: number | null
  napCount: number
  sleepStressScore: number | null
  sleepStressConfidence: number
  sleepStressLabel: 'baixo' | 'moderado' | 'alto' | 'sem dado'
}

const PHYSIOLOGICAL_FRESHNESS_HOURS = 36
const SLEEP_FRESHNESS_HOURS = 48
const DIGITAL_FRESHNESS_HOURS = 24
const STATE_OF_MIND_FRESHNESS_HOURS = 24
const COMPLETE_LOAD_RATIO_WEIGHT = 77

export function buildReadinessV1(input: {
  healthSignals: ReadinessSignal[]
  allSignals?: ReadinessSignal[]
  digitalActivitySnapshots?: ReadinessDigitalSnapshot[]
  latestCheckin?: ReadinessCheckin | null
  checkins?: ReadinessCheckin[]
  now?: Date
}): ReadinessV1Model {
  const now = input.now ?? new Date()
  const allSignals = input.allSignals ?? input.healthSignals
  const healthSignals = input.healthSignals

  const sleepNights = buildSleepNights(healthSignals, now)
  const sleepTarget = inferSleepTarget(sleepTargetNightsWithOutcomes({
    sleepNights,
    healthSignals,
    allSignals,
    latestCheckin: input.latestCheckin ?? null,
    checkins: input.checkins ?? [],
    now,
  }))
  const currentNight = freshSleepNight(sleepNights[0] ?? null, now)
  const sleep = sleepAxis(sleepNights, sleepTarget, now)
  const autonomic = autonomicAxis(healthSignals, now, sleepNights)
  const load = loadAxis(healthSignals, now)
  const subjective = subjectiveAxis(allSignals, input.latestCheckin ?? null, now)
  const stability = stabilityAxis(healthSignals, now, sleepNights)
  const nightRecoveryAxisResult = nightRecoveryAxis({
    sleep,
    autonomic,
    stability,
    night: currentNight,
  })
  const nightRecovery = scoreDisplay(
    nightRecoveryAxisResult.score,
    nightRecoveryAxisResult.confidence,
    recoveryLabel,
  )

  const baseRaw = weightedScore([
    component('night_recovery', nightRecovery.score, 70, nightRecovery.confidence),
    component('load', load.score, 15, load.confidence),
    component('subjective', subjective.score, 15, subjective.confidence),
  ])
  const baseScore = currentNight?.asleepHours && currentNight.asleepHours < 5
    ? Math.min(baseRaw.score ?? 45, 52)
    : baseRaw.score
  const base = scoreDisplay(baseScore, baseRaw.confidence, readinessLabel)

  const bodyRaw = weightedScore([
    component('night_recovery', nightRecovery.score, 68, nightRecovery.confidence),
    component('load', load.score, 32, load.confidence),
  ])
  const body = scoreDisplay(bodyRaw.score, bodyRaw.confidence, axisLabel)

  const digitalFocus = digitalFocusAxis(input.digitalActivitySnapshots ?? [], allSignals, now)
  const mindRaw = weightedScore([
    component('subjective', subjective.score, 42, subjective.confidence),
    component('sleep', sleep.score, 24, sleep.confidence),
    component('autonomic', autonomic.score, 14, autonomic.confidence),
    component('digital', digitalFocus.score, 20, digitalFocus.confidence),
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
    component('digital', digitalFocus.score, 20, digitalFocus.confidence),
  ])
  const focus = scoreDisplay(focusRaw.score, focusRaw.confidence, focusLabel)

  const awakeHours = currentNight?.wakeTime
    ? Math.max(0, (now.getTime() - new Date(currentNight.wakeTime).getTime()) / 3600000)
    : null
  const todayDrain = currentDayDrain(load.loadRatio, awakeHours, currentNight?.asleepHours ?? null)
  const cognitivePenalty = currentCognitivePenalty(subjective.state, subjective.freshness, digitalFocus.todayMinutes, digitalFocus.pressurePenalty)
  const currentRawScore = base.score === null
    ? null
    : clamp(base.score - todayDrain - cognitivePenalty + recoveryBonus(subjective.state, subjective.freshness), 0, 100)
  const current = scoreDisplay(
    currentRawScore,
    currentConfidence(base.confidence, load.confidence, subjective.confidence, digitalFocus.confidence),
    capacityLabel,
  )

  const factors = readinessFactors({
    sleepNights,
    sleepTargetHours: sleep.sleepTargetHours,
    sleepTargetMethod: sleepTarget.method,
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
  const axisQuality = buildAxisQuality({
    base,
    current,
    body,
    mind,
    drive,
    focus,
    nightRecoveryScore: nightRecovery,
    sleepScore: scoreDisplay(sleep.score, sleep.confidence, axisLabel),
    autonomicScore: scoreDisplay(autonomic.score, autonomic.confidence, axisLabel),
    loadScore: scoreDisplay(load.score, load.confidence, loadLabel),
    subjectiveScore: scoreDisplay(subjective.score, subjective.confidence, axisLabel),
    stabilityScore: scoreDisplay(stability.score, stability.confidence, stabilityLabel),
    sleepAxis: sleep,
    autonomicAxis: autonomic,
    loadAxis: load,
    subjectiveAxis: subjective,
    digitalFocus,
    stabilityAxis: stability,
    nightRecoveryAxis: nightRecoveryAxisResult,
    healthSignals,
    now,
  })
  const confidence = confidenceLabel(axisQualityScore(axisQuality.dataQuality))

  return {
    version: 'readiness_v1',
    computedAt: now.toISOString(),
    base,
    current,
    body,
    mind,
    drive,
    focus,
    nightRecovery,
    sleep: scoreDisplay(sleep.score, sleep.confidence, axisLabel),
    autonomic: scoreDisplay(autonomic.score, autonomic.confidence, axisLabel),
    load: scoreDisplay(load.score, load.confidence, loadLabel),
    subjective: scoreDisplay(subjective.score, subjective.confidence, axisLabel),
    stability: scoreDisplay(stability.score, stability.confidence, stabilityLabel),
    signature,
    mode,
    confidence,
    factors,
    sleepTargetHours: sleep.sleepTargetHours,
    sleepTargetEvidence: sleepTarget,
    sleepDebtHours: sleep.sleepDebtHours,
    dayStrain: load.dayStrain,
    loadRatio: load.loadRatio,
    axisQuality,
    nightRecoveryComponents: nightRecoveryAxisResult.components,
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

function sleepAxis(nights: SleepNight[], sleepTarget: SleepTargetEvidence, now: Date) {
  const sleepTargetHours = sleepTarget.targetHours
  const sleepBaselineHours = sleepTarget.baselineHours
  const night = freshSleepNight(nights[0] ?? null, now)
  const recentNightCount = recentObservedSleepNightCount(nights, now)
  const recentNightCoverage = clamp(recentNightCount / 5, 0, 1)
  const freshness = sleepFreshness(nights[0] ?? null, now)
  if (!night || typeof night.asleepHours !== 'number') {
    return { score: null, confidence: 0, sleepTargetHours, sleepDebtHours: null, freshness, recentNightCount, recentNightCoverage }
  }

  const asleep = night.asleepHours
  const durationScore = clamp(((asleep - 4.5) / Math.max(1, sleepTargetHours - 4.5)) * 100, 0, 100)
  const sleepDebtHours = sleepDebtHoursForNights(nights, sleepBaselineHours)
  const debtScore = sleepDebtHours === null
    ? null
    : clamp(100 - sleepDebtHours * 8, 20, 100)
  const consistency = sleepTimingConsistencyMinutes(nights.slice(0, 7))
  const consistencyScore = consistency === null
    ? null
    : clamp(100 - Math.max(0, consistency - 20) * 0.9, 25, 100)
  const continuityScore = typeof night.efficiency === 'number'
    ? clamp(((night.efficiency - 78) / 17) * 100, 0, 100)
    : null
  const architectureScore = architectureScoreFor(night)
  const latencyScore = typeof night.latencyMinutes === 'number'
    ? clamp(100 - Math.max(0, night.latencyMinutes - 20) * 2.2, 25, 100)
    : null
  const awakeningsScore = typeof night.awakeEpisodeCount === 'number'
    ? clamp(100 - Math.max(0, night.awakeEpisodeCount - 1) * 12, 35, 100)
    : null
  const disturbanceScore = typeof night.disturbanceCount === 'number'
    ? clamp(100 - Math.max(0, night.disturbanceCount - 8) * 5, 35, 100)
    : null
  const physiologyScore = typeof night.sleepStressScore === 'number' ? night.sleepStressScore : null
  const dataQuality = clamp(night.dataQuality, 0.25, 1)

  const raw = weightedScore([
    component('duration', durationScore, 34),
    component('debt', debtScore, 16),
    component('consistency', consistencyScore, 12),
    component('continuity', continuityScore, 10),
    component('architecture', architectureScore, 10, dataQuality),
    component('latency', latencyScore, 4),
    component('awakenings', awakeningsScore, 4),
    component('disturbances', disturbanceScore, 4),
    component('physiology', physiologyScore, 6, night.sleepStressConfidence),
  ])

  let score = raw.score
  if (score !== null && asleep < 5) score = Math.min(score, 50)
  if (score !== null && asleep < 6) score = Math.min(score, 64)
  if (score !== null && asleep < 7) score = Math.min(score, 78)

  return {
    score,
    confidence: clamp(raw.confidence * sleepCoverageConfidence(nights, now) * dataQuality, 0, 1),
    sleepTargetHours,
    sleepDebtHours,
    freshness,
    recentNightCount,
    recentNightCoverage,
  }
}

function freshSleepNight(night: SleepNight | null, now: Date): SleepNight | null {
  if (!night?.wakeTime) return null
  const wakeTime = new Date(night.wakeTime).getTime()
  if (!Number.isFinite(wakeTime)) return null
  return now.getTime() - wakeTime <= SLEEP_FRESHNESS_HOURS * 3600000 ? night : null
}

function sleepCoverageConfidence(nights: SleepNight[], now: Date): number {
  const observed = recentObservedSleepNightCount(nights, now)
  if (observed >= 5) return 1
  if (observed >= 3) return 0.75
  return 0.5
}

function recentObservedSleepNightCount(nights: SleepNight[], now: Date): number {
  const cutoff = startOfLocalDay(now)
  return nights
    .filter((night) => typeof night.asleepHours === 'number')
    .filter((night) => {
      const parsed = dateFromLocalKey(night.key)
      if (!parsed) return false
      const ageDays = Math.floor((cutoff.getTime() - parsed.getTime()) / 86400000)
      return ageDays >= 0 && ageDays <= 6
    }).length
}

function sleepFreshness(night: SleepNight | null, now: Date): number {
  if (!night?.wakeTime) return 0
  const wakeTime = new Date(night.wakeTime).getTime()
  if (!Number.isFinite(wakeTime)) return 0
  const ageHours = Math.max(0, (now.getTime() - wakeTime) / 3600000)
  if (ageHours > SLEEP_FRESHNESS_HOURS) return 0
  return Math.pow(0.5, ageHours / 36)
}

function sleepTargetNightsWithOutcomes(input: {
  sleepNights: SleepNight[]
  healthSignals: ReadinessSignal[]
  allSignals: ReadinessSignal[]
  latestCheckin: ReadinessCheckin | null
  checkins: ReadinessCheckin[]
  now: Date
}): SleepTargetNight[] {
  const hrvBaseline = baselineDailyMedian(input.healthSignals, ['hrv_ms'], input.now)
  const rhrBaseline = baselineDailyMedian(input.healthSignals, ['resting_heart_rate_bpm'], input.now)
  const respirationBaseline = baselineDailyMedian(input.healthSignals, ['respiratory_rate'], input.now)
  const wristTempBaseline = baselineDailyMedian(input.healthSignals, ['wrist_temperature'], input.now)
  const focusBaseline = baselineDailySumMedian(input.allSignals, ['focus_minutes', 'rize_focus_minutes', 'deep_work_total_min'], input.now)

  return input.sleepNights.map((night) => {
    const recoveryScore = recoveryOutcomeScoreForDate(input.healthSignals, night.key, {
      hrvBaseline,
      rhrBaseline,
      respirationBaseline,
      wristTempBaseline,
    })
    const performanceScore = performanceOutcomeScoreForDate(input.allSignals, night.key, focusBaseline)
    const subjectiveScore = subjectiveOutcomeScoreForDate(input.allSignals, input.checkins, input.latestCheckin, night.key)
    const outcome = weightedScore([
      component('recovery', recoveryScore, 55),
      component('performance', performanceScore, 30),
      component('subjective', subjectiveScore, 15),
    ])

    return {
      key: night.key,
      asleepHours: night.asleepHours,
      napHours: night.napHours,
      strainRatio: strainRatioForSleepNight(input.healthSignals, night.key, input.now),
      recoveryScore,
      performanceScore,
      subjectiveScore,
      outcomeScore: outcome.confidence >= 0.35 ? outcome.score : null,
    }
  })
}

function strainRatioForSleepNight(signals: ReadinessSignal[], dateKey: string, now: Date): number | null {
  const previousDay = shiftDateKey(dateKey, -1)
  if (!previousDay) return null
  const baselines = [
    strainRatioInputForDate(signals, ['workout_cardio_load'], previousDay, now, 45),
    strainRatioInputForDate(signals, ['active_energy_kcal'], previousDay, now, 25),
    strainRatioInputForDate(signals, ['exercise_minutes'], previousDay, now, 15),
    strainRatioInputForDate(signals, ['steps'], previousDay, now, 10),
    strainRatioInputForDate(signals, ['walking_running_distance', 'HKQuantityTypeIdentifierDistanceWalkingRunning'], previousDay, now, 5),
  ].filter((value): value is { ratio: number; weight: number } => value !== null)

  const weight = baselines.reduce((sum, item) => sum + item.weight, 0)
  return weight > 0
    ? baselines.reduce((sum, item) => sum + item.ratio * item.weight, 0) / weight
    : null
}

function strainRatioInputForDate(
  signals: ReadinessSignal[],
  signalTypes: string[],
  dateKey: string,
  now: Date,
  weight: number,
): { ratio: number; weight: number } | null {
  const value = dailySumForDate(signals, signalTypes, dateKey)
  const baseline = baselineDailySumMedian(signals, signalTypes, now)
  if (typeof value !== 'number' || typeof baseline !== 'number' || baseline <= 0) return null
  return {
    ratio: value / baseline,
    weight,
  }
}

function recoveryOutcomeScoreForDate(
  signals: ReadinessSignal[],
  dateKey: string,
  baselines: {
    hrvBaseline: number | null
    rhrBaseline: number | null
    respirationBaseline: number | null
    wristTempBaseline: number | null
  },
): number | null {
  const hrv = dailyMedianForDate(signals, ['hrv_ms'], dateKey)
  const rhr = dailyMedianForDate(signals, ['resting_heart_rate_bpm'], dateKey)
  const respiration = dailyMedianForDate(signals, ['respiratory_rate'], dateKey)
  const wristTemp = dailyMedianForDate(signals, ['wrist_temperature'], dateKey)
  const hrvRatio = ratio(hrv, baselines.hrvBaseline)
  const rhrRatio = ratio(baselines.rhrBaseline, rhr)
  const respirationRatio = ratio(respiration, baselines.respirationBaseline)
  const raw = weightedScore([
    component('hrv', hrvRatio === null ? null : ratioHigherIsBetterScore(hrvRatio), 40),
    component('rhr', rhrRatio === null ? null : ratioHigherIsBetterScore(rhrRatio), 32),
    component('respiration', respirationRatio === null ? null : stableRatioScore(respirationRatio), 16),
    component('wrist_temp', wristTemperatureStabilityScore(wristTemp, baselines.wristTempBaseline), 12),
  ])

  return raw.confidence >= 0.35 ? raw.score : null
}

function performanceOutcomeScoreForDate(
  signals: ReadinessSignal[],
  dateKey: string,
  focusBaseline: number | null,
): number | null {
  const focusMinutes = dailySumForDate(signals, ['focus_minutes', 'rize_focus_minutes', 'deep_work_total_min'], dateKey)
  if (typeof focusMinutes !== 'number') return null

  if (typeof focusBaseline !== 'number' || focusBaseline <= 0) {
    if (focusMinutes < 45) return null
    return clamp(54 + focusMinutes / 5, 58, 86)
  }

  return clamp(58 + (focusMinutes / focusBaseline - 1) * 34, 25, 94)
}

function subjectiveOutcomeScoreForDate(
  signals: ReadinessSignal[],
  checkins: ReadinessCheckin[],
  latestCheckin: ReadinessCheckin | null,
  dateKey: string,
): number | null {
  const checkin = latestCheckinForDate(checkins, latestCheckin, dateKey)
  const checkinScore = checkin
    ? average([levelToScore(checkin.energy_level), levelToScore(checkin.mood_level)])
    : null
  const stateOfMind = stateOfMindScore(dailyMedianForDate(signals, ['state_of_mind_valence'], dateKey))
  const raw = weightedScore([
    component('checkin', checkinScore, 65),
    component('state_of_mind', stateOfMind, 35),
  ])

  return raw.confidence >= 0.3 ? raw.score : null
}

function latestCheckinForDate(
  checkins: ReadinessCheckin[],
  latestCheckin: ReadinessCheckin | null,
  dateKey: string,
): ReadinessCheckin | null {
  return [
    ...checkins,
    ...(latestCheckin ? [latestCheckin] : []),
  ]
    .filter((checkin) => localDateKey(checkin.recorded_at) === dateKey)
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0] ?? null
}

function autonomicAxis(signals: ReadinessSignal[], now: Date, sleepNights: SleepNight[]) {
  const night = freshSleepNight(sleepNights[0] ?? null, now)
  const hrv = nightRecoveryMetric(signals, ['hrv_ms'], night)
  const hrvBaseline = baselineNightRecoveryMedian(signals, ['hrv_ms'], sleepNights, night?.key ?? null)
  const rhr = nightRecoveryMetric(signals, ['sleep_hr_avg_bpm'], night)
  const rhrBaseline = baselineNightRecoveryMedian(signals, ['sleep_hr_avg_bpm'], sleepNights, night?.key ?? null)
  const respiration = nightRecoveryMetric(signals, ['respiratory_rate'], night)
  const respirationBaseline = baselineNightRecoveryMedian(signals, ['respiratory_rate'], sleepNights, night?.key ?? null)

  const hrvRatio = ratio(hrv.value, hrvBaseline)
  const rhrRatio = ratio(rhrBaseline, rhr.value)
  const respirationRatio = ratio(respiration.value, respirationBaseline)

  const hrvScore = hrvRatio === null ? null : ratioHigherIsBetterScore(hrvRatio)
  const rhrScore = rhrRatio === null ? null : ratioHigherIsBetterScore(rhrRatio)
  const respirationScore = respirationRatio === null ? null : stableRatioScore(respirationRatio)

  const raw = weightedScore([
    component('hrv', hrvScore, 50),
    component('rhr', rhrScore, 35),
    component('respiration', respirationScore, 15),
  ])

  return {
    score: raw.score,
    confidence: raw.confidence,
    freshness: average([
      metricFreshness(hrv, now, SLEEP_FRESHNESS_HOURS),
      metricFreshness(rhr, now, SLEEP_FRESHNESS_HOURS),
      metricFreshness(respiration, now, SLEEP_FRESHNESS_HOURS),
    ]),
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

function nightRecoveryMetric(
  signals: ReadinessSignal[],
  signalTypes: string[],
  night: SleepNight | null,
): ReadinessMetricValue {
  const matches = nightRecoverySignals(signals, signalTypes, night)
  if (matches.length === 0) return { value: null }
  const latest = matches.sort((a, b) => signalEndTime(b) - signalEndTime(a))[0]
  return {
    value: median(matches.map((signal) => Number(signal.value_numeric))),
    unit: latest?.unit,
    date: latest ? new Date(signalEndTime(latest)).toISOString() : night?.wakeTime ?? null,
  }
}

function baselineNightRecoveryMedian(
  signals: ReadinessSignal[],
  signalTypes: string[],
  nights: SleepNight[],
  currentKey: string | null,
): number | null {
  const values = nights
    .filter((night) => night.key !== currentKey)
    .slice(0, 28)
    .map((night) => {
      const matches = nightRecoverySignals(signals, signalTypes, night)
      return matches.length > 0
        ? median(matches.map((signal) => Number(signal.value_numeric)))
        : null
    })
    .filter((value): value is number => typeof value === 'number')

  return values.length >= 3 ? median(values) : null
}

function baselineNightRecoveryDayCount(
  signals: ReadinessSignal[],
  signalTypes: string[],
  nights: SleepNight[],
  currentKey: string | null,
): number {
  return nights
    .filter((night) => night.key !== currentKey)
    .slice(0, 28)
    .filter((night) => nightRecoverySignals(signals, signalTypes, night).length > 0)
    .length
}

function nightRecoverySignals(
  signals: ReadinessSignal[],
  signalTypes: string[],
  night: SleepNight | null,
): ReadinessSignal[] {
  const window = recoveryWindowForNight(night)
  if (!window) return []
  return signals
    .filter((signal) => (
      signalTypes.includes(signal.signal_type)
      && typeof signal.value_numeric === 'number'
      && signalOverlapsWindow(signal, window)
    ))
}

function recoveryWindowForNight(night: SleepNight | null): SleepInterval | null {
  if (!night?.bedtime || !night.wakeTime) return null
  const start = new Date(night.bedtime).getTime()
  const end = new Date(night.wakeTime).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return {
    start: start - 2 * 3600000,
    end: end + 2 * 3600000,
  }
}

function signalOverlapsWindow(signal: ReadinessSignal, window: SleepInterval): boolean {
  const start = new Date(signal.started_at).getTime()
  const rawEnd = new Date(signal.ended_at ?? signal.started_at).getTime()
  if (!Number.isFinite(start)) return false
  const end = Number.isFinite(rawEnd) && rawEnd > start ? rawEnd : start + 1
  return Math.max(start, window.start) < Math.min(end, window.end)
}

function loadAxis(signals: ReadinessSignal[], now: Date) {
  const progress = dayProgress(now)
  const dayStrain = dayStrainSummary(signals, now)
  const ratioInputs = [
    loadRatioInput(signals, ['workout_cardio_load'], now, progress, 35),
    loadRatioInput(signals, ['waking_cardio_load'], now, progress, 20),
    loadRatioInput(signals, ['active_energy_kcal'], now, progress, 18),
    loadRatioInput(signals, ['exercise_minutes'], now, progress, 12),
    loadRatioInput(signals, ['steps'], now, progress, 8),
    loadRatioInput(signals, ['walking_running_distance', 'HKQuantityTypeIdentifierDistanceWalkingRunning'], now, progress, 4),
    loadMaxRatioInput(signals, ['workout_effort_score', 'estimated_workout_effort_score'], now, 3),
  ].filter((value): value is LoadRatioInput => value !== null)
  const ratioWeight = ratioInputs.reduce((sum, item) => sum + item.weight, 0)
  const loadRatio = ratioWeight > 0
    ? ratioInputs.reduce((sum, item) => sum + item.value * item.weight, 0) / ratioWeight
    : null
  const baselineDays = ratioInputs.length > 0 ? Math.min(...ratioInputs.map((item) => item.baselineDays)) : null
  const recentWorkout = latestValue(signals, ['workout'])
  const workoutPressure = workoutPenalty(recentWorkout, now)
  const acuteChronic = acuteChronicLoadRatio(signals, ['workout_cardio_load'], now)
    ?? acuteChronicLoadRatio(signals, ['waking_cardio_load'], now)
    ?? acuteChronicLoadRatio(signals, ['active_energy_kcal'], now)
  const acutePenalty = typeof acuteChronic === 'number' && acuteChronic > 1.3
    ? Math.min(16, (acuteChronic - 1.3) * 32)
    : 0

  const score = loadRatio === null
    ? workoutPressure > 0 ? clamp(82 - workoutPressure - acutePenalty, 30, 90) : null
    : clamp(94 - Math.max(0, loadRatio - 1.1) * 38 - workoutPressure - acutePenalty, 22, 96)

  return {
    score,
    confidence: loadRatio === null ? (workoutPressure > 0 ? 0.35 : 0) : clamp(ratioWeight / 75, 0.35, 1),
    dayStrain,
    loadRatio,
    acuteChronic,
    ratioCount: ratioInputs.length,
    ratioWeight,
    baselineDays,
    freshness: loadFreshness(signals, now),
    recentWorkout,
    workoutPressure,
  }
}

function dayStrainSummary(signals: ReadinessSignal[], now: Date): DayStrain {
  const cardioLoad = dailySum(signals, ['workout_cardio_load'], now)
  const wakingCardioLoad = dailySum(signals, ['waking_cardio_load'], now)
  const highZones = dailySum(signals, ['workout_hr_zone_4_min', 'workout_hr_zone_5_min', 'waking_hr_zone_4_min', 'waking_hr_zone_5_min'], now)
  const moderateZones = dailySum(signals, ['workout_hr_zone_2_min', 'workout_hr_zone_3_min', 'waking_hr_zone_2_min', 'waking_hr_zone_3_min'], now)
  const workoutEffort = dailyMax(signals, ['workout_effort_score', 'estimated_workout_effort_score'], now)
  const activeEnergy = dailySum(signals, ['active_energy_kcal'], now)
  const exercise = dailySum(signals, ['exercise_minutes'], now)
  const steps = dailySum(signals, ['steps'], now)
  const distance = dailySum(signals, ['walking_running_distance', 'HKQuantityTypeIdentifierDistanceWalkingRunning'], now)

  const components: LoadComponent[] = [
    loadComponent(signals, now, 'cardio_load', 'Carga cardio treino', cardioLoad, ['workout_cardio_load'], 26, 1.0, 'Carga derivada das zonas de FC durante treinos.'),
    loadComponent(signals, now, 'waking_cardio_load', 'Carga FC ativa', wakingCardioLoad, ['waking_cardio_load'], 16, 0.85, 'Carga por FC fora de sono e fora de treinos, agregada sem salvar batimento bruto.'),
    loadComponent(signals, now, 'high_zones', 'Zonas 4-5', highZones, ['workout_hr_zone_4_min', 'workout_hr_zone_5_min', 'waking_hr_zone_4_min', 'waking_hr_zone_5_min'], 16, 10, 'Minutos de alta intensidade pesam muito porque geram mais strain.'),
    loadComponent(signals, now, 'moderate_zones', 'Zonas 2-3', moderateZones, ['workout_hr_zone_2_min', 'workout_hr_zone_3_min', 'waking_hr_zone_2_min', 'waking_hr_zone_3_min'], 10, 3, 'Volume aeróbico moderado sustenta carga sem pesar como alta intensidade.'),
    loadComponent(signals, now, 'workout_effort', 'Esforço treino', workoutEffort, ['workout_effort_score', 'estimated_workout_effort_score'], 12, 22, 'Score de esforço do treino entra para cobrir musculação e treinos em que a FC subestima carga.'),
    loadComponent(signals, now, 'active_energy', 'Energia ativa', activeEnergy, ['active_energy_kcal'], 10, 0.12, 'Calorias ativas entram como fallback quando não há FC de treino suficiente.'),
    loadComponent(signals, now, 'exercise', 'Exercício', exercise, ['exercise_minutes'], 5, 0.9, 'Minutos de exercício ajudam medir volume observado no dia.'),
    loadComponent(signals, now, 'steps', 'Passos', steps, ['steps'], 3, 0.007, 'Passos capturam carga leve acumulada fora de treinos.'),
    loadComponent(signals, now, 'distance', 'Distância', distance, ['walking_running_distance', 'HKQuantityTypeIdentifierDistanceWalkingRunning'], 2, 0.0015, 'Distância ajuda diferenciar passos curtos de deslocamento real.'),
  ]

  const present = components.filter((item) => typeof item.strainContribution === 'number')
  const cardioPresent = typeof cardioLoad.value === 'number' || typeof wakingCardioLoad.value === 'number'
  const rawLoad = present.reduce((sum, item) => {
    const contribution = item.strainContribution ?? 0
    if (cardioPresent && (item.key === 'high_zones' || item.key === 'moderate_zones')) {
      return sum + contribution * 0.25
    }
    if (cardioPresent && item.key === 'workout_effort') {
      return sum + contribution * 0.55
    }
    if (cardioPresent && (item.key === 'active_energy' || item.key === 'exercise')) {
      return sum + contribution * 0.25
    }
    if (cardioPresent && (item.key === 'steps' || item.key === 'distance')) {
      return sum + contribution * 0.4
    }
    return sum + contribution
  }, 0)
  const value = present.length === 0 ? null : strain21FromLoad(rawLoad)
  const weightedRatio = weightedComponentRatio(components)
  const acuteChronic = acuteChronicLoadRatio(signals, ['workout_cardio_load'], now)
    ?? acuteChronicLoadRatio(signals, ['waking_cardio_load'], now)
    ?? acuteChronicLoadRatio(signals, ['active_energy_kcal'], now)
  const coverage = clamp(present.reduce((sum, item) => sum + item.weight, 0) / components.reduce((sum, item) => sum + item.weight, 0), 0, 1)
  const confidence = clamp(coverage * (cardioPresent ? 1 : 0.72), 0, 1)

  return {
    value,
    label: strainLabel(value),
    confidence,
    loadRatio: weightedRatio,
    acuteChronic,
    coverage,
    components,
  }
}

function loadComponent(
  signals: ReadinessSignal[],
  now: Date,
  key: LoadComponentKey,
  label: string,
  metric: ReadinessMetricValue,
  signalTypes: string[],
  weight: number,
  strainMultiplier: number,
  summary: string,
): LoadComponent {
  const baseline = baselineDailySumMedian(signals, signalTypes, now)
  const value = metric.value
  const ratio = typeof value === 'number' && typeof baseline === 'number' && baseline > 0
    ? value / baseline
    : null
  const strainContribution = typeof value === 'number' ? value * strainMultiplier : null
  const confidence = typeof value === 'number'
    ? clamp((baselineDayCount(signals, signalTypes, now) >= 7 ? 1 : 0.72) * (metricFreshness(metric, now, 24) > 0 ? 1 : 0.5), 0, 1)
    : 0

  return {
    key,
    label,
    value,
    baseline,
    unit: metric.unit ?? null,
    ratio,
    strainContribution,
    confidence,
    weight,
    status: loadComponentStatus(ratio, value),
    summary,
  }
}

function weightedComponentRatio(components: LoadComponent[]): number | null {
  const present = components.filter((item) => typeof item.ratio === 'number')
  const weight = present.reduce((sum, item) => sum + item.weight, 0)
  if (weight <= 0) return null
  return present.reduce((sum, item) => sum + Number(item.ratio) * item.weight, 0) / weight
}

function loadComponentStatus(ratio: number | null, value: number | null): LoadComponent['status'] {
  if (typeof value !== 'number') return 'missing'
  if (ratio === null) return value > 0 ? 'normal' : 'low'
  if (ratio >= 1.35) return 'high'
  if (ratio >= 0.65) return 'normal'
  return 'low'
}

function strain21FromLoad(load: number): number {
  return clamp(21 * (1 - Math.exp(-Math.max(0, load) / 260)), 0, 21)
}

function strainLabel(value: number | null): string {
  if (value === null) return 'Sem dado'
  if (value >= 18) return 'muito alta'
  if (value >= 14) return 'alta'
  if (value >= 10) return 'moderada'
  if (value >= 5) return 'leve'
  return 'baixa'
}

function subjectiveAxis(signals: ReadinessSignal[], checkin: ReadinessCheckin | null, now: Date) {
  const stateOfMind = latestValueWithMaxAge(signals, ['state_of_mind_valence'], now, STATE_OF_MIND_FRESHNESS_HOURS)
  const levelFreshness = checkinLevelFreshness(checkin, now)
  const stateFreshness = checkinStateFreshness(checkin, now)
  const freshness = Math.max(levelFreshness, stateFreshness)
  const state = stateFreshness > 0 ? checkin?.state ?? null : null
  const energyScore = typeof checkin?.energy_level === 'number' && levelFreshness > 0
    ? decayScoreToNeutral(levelToScore(checkin.energy_level), levelFreshness)
    : null
  const moodScore = typeof checkin?.mood_level === 'number' && levelFreshness > 0
    ? decayScoreToNeutral(levelToScore(checkin.mood_level), levelFreshness)
    : stateOfMindScore(stateOfMind.value)
  const stateScore = state ? decayScoreToNeutral(stateToScore(state), stateFreshness) : null

  const raw = weightedScore([
    component('energy', energyScore, 38),
    component('mood', moodScore, 34, levelFreshness > 0 ? 1 : 0.45),
    component('state', stateScore, 28),
  ])

  return {
    score: raw.score,
    confidence: checkin && freshness > 0
      ? clamp(raw.confidence * freshness, 0.15, 1)
      : raw.confidence * 0.45,
    energyScore,
    moodScore,
    stateScore,
    state,
    freshness,
    checkin: freshness > 0 ? checkin : null,
    stateOfMind,
  }
}

function rizeFocusAxis(signals: ReadinessSignal[], now: Date) {
  const todayMetric = dailySum(signals, ['focus_minutes', 'rize_focus_minutes'], now)
  const todayMinutes = todayMetric.value
  const baseline = previousSevenDayAverage(signals, ['focus_minutes', 'rize_focus_minutes'], now)
  if (typeof todayMinutes !== 'number' && typeof baseline !== 'number') {
    return { score: null, confidence: 0, todayMinutes: null, freshness: 0 }
  }

  if (typeof todayMinutes === 'number' && typeof baseline === 'number' && baseline > 0) {
    return {
      score: clamp(55 + (todayMinutes / Math.max(30, baseline * dayProgress(now)) - 1) * 18, 35, 92),
      confidence: 0.75,
      todayMinutes,
      freshness: metricFreshness(todayMetric, now, DIGITAL_FRESHNESS_HOURS),
    }
  }

  return {
    score: typeof todayMinutes === 'number' && todayMinutes > 60 ? 72 : 58,
    confidence: 0.35,
    todayMinutes,
    freshness: metricFreshness(todayMetric, now, DIGITAL_FRESHNESS_HOURS),
  }
}

function hasDigitalClassification(snapshot: ReadinessDigitalSnapshot): boolean {
  const capability = digitalMetadataBoolean(snapshot, ['capabilities', 'category_classification'])
  if (capability !== null) return capability

  const categoryValues = [
    snapshot.curated_input_min,
    snapshot.algorithmic_input_min,
    snapshot.intentional_entertainment_min,
    snapshot.default_entertainment_min,
    snapshot.communication_primary_min,
    snapshot.communication_shallow_min,
  ].map(numericOrNull)

  return categoryValues.some((value) => typeof value === 'number' && value > 0)
}

function digitalClassificationCoverage(snapshot: ReadinessDigitalSnapshot, total: number | null): number {
  const metadataRatio = digitalMetadataNumber(snapshot, ['coverage', 'classification_ratio'])
  if (typeof metadataRatio === 'number') return clamp(metadataRatio, 0.1, 1)
  if (typeof total !== 'number' || total <= 0) return 0.25

  const classified = [
    snapshot.curated_input_min,
    snapshot.algorithmic_input_min,
    snapshot.intentional_entertainment_min,
    snapshot.default_entertainment_min,
    snapshot.communication_primary_min,
    snapshot.communication_shallow_min,
  ]
    .map(numericOrNull)
    .filter((value): value is number => typeof value === 'number')
    .reduce((sum, value) => sum + value, 0)

  return classified > 0 ? clamp(classified / total, 0.1, 1) : 0.25
}

function digitalMetadataBoolean(snapshot: ReadinessDigitalSnapshot, path: string[]): boolean | null {
  const value = digitalMetadataValue(snapshot, path)
  return typeof value === 'boolean' ? value : null
}

function digitalMetadataNumber(snapshot: ReadinessDigitalSnapshot, path: string[]): number | null {
  const value = digitalMetadataValue(snapshot, path)
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function digitalMetadataValue(snapshot: ReadinessDigitalSnapshot, path: string[]): unknown {
  let current: unknown = snapshot.metadata
  for (const key of path) {
    if (!isRecord(current)) return null
    current = current[key]
  }
  return current
}

function digitalFocusAxis(
  snapshots: ReadinessDigitalSnapshot[],
  signals: ReadinessSignal[],
  now: Date,
) {
  const fallback = rizeFocusAxis(signals, now)
  const snapshot = latestDigitalSnapshot(snapshots, now)
  if (!snapshot) return { ...fallback, pressurePenalty: 0 }

  const total = numericOrNull(snapshot.total_screen_time_min)
  const ageHours = Math.max(0, (now.getTime() - new Date(snapshot.computed_at).getTime()) / 3600000)
  const freshness = ageHours > DIGITAL_FRESHNESS_HOURS ? 0 : Math.pow(0.5, ageHours / 18)
  const hasClassification = hasDigitalClassification(snapshot)

  if (!hasClassification) {
    const screenTimeScore = typeof total === 'number'
      ? clamp(94 - Math.max(0, total - 240) * 0.08 - Math.max(0, total - 480) * 0.05, 35, 94)
      : null
    const combined = weightedScore([
      component('screen_time_load', screenTimeScore, 45, freshness),
      component('passive_focus', fallback.score, 55, fallback.confidence),
    ])

    return {
      score: combined.score,
      confidence: clamp(Math.max((typeof screenTimeScore === 'number' ? 0.38 * freshness : 0), fallback.confidence * 0.7), 0, 0.55),
      todayMinutes: fallback.todayMinutes,
      pressurePenalty: 0,
      freshness: Math.max(freshness, fallback.freshness * 0.7),
    }
  }

  const deepWork = numericOrNull(snapshot.deep_work_total_min)
  const algorithmic = numericOrZero(snapshot.algorithmic_input_min)
  const defaultEntertainment = numericOrZero(snapshot.default_entertainment_min)
  const shallowComm = numericOrZero(snapshot.communication_shallow_min)
  const curated = numericOrZero(snapshot.curated_input_min)
  const intentionalEntertainment = numericOrZero(snapshot.intentional_entertainment_min)
  const primaryComm = numericOrZero(snapshot.communication_primary_min)
  const pickups = numericOrNull(snapshot.pickups_count)
  const pressureMinutes = algorithmic + defaultEntertainment + shallowComm
  const intentionalMinutes = numericOrZero(deepWork) + curated + intentionalEntertainment + primaryComm

  const deepRatioScore = total && total > 0 && typeof deepWork === 'number'
    ? clamp((deepWork / total / 0.24) * 100, 20, 96)
    : null
  const pressureScore = total && total > 0
    ? clamp(96 - (pressureMinutes / total) * 120, 20, 96)
    : null
  const intentionalScore = total && total > 0
    ? clamp((intentionalMinutes / total / 0.52) * 100, 24, 96)
    : null
  const fragmentationScore = total && total > 0 && typeof pickups === 'number'
    ? clamp(94 - (pickups / Math.max(total / 60, 0.5)) * 7, 18, 94)
    : null
  const raw = weightedScore([
    component('deep_work_ratio', deepRatioScore, 35),
    component('intentionality', intentionalScore, 25),
    component('pressure', pressureScore, 25),
    component('fragmentation', fragmentationScore, 15),
  ])
  const classificationCoverage = digitalClassificationCoverage(snapshot, total)
  const score = raw.score === null
    ? fallback.score
    : fallback.score === null
      ? raw.score
      : weightedScore([
        component('digital_snapshot', raw.score, 70, freshness * classificationCoverage),
        component('passive_focus', fallback.score, 30, fallback.confidence),
      ]).score

  return {
    score,
    confidence: clamp(Math.max(raw.confidence * freshness * classificationCoverage, fallback.confidence * 0.7), 0, 1),
    todayMinutes: deepWork ?? fallback.todayMinutes,
    pressurePenalty: total && total > 0 ? clamp((pressureMinutes / total - 0.38) * 14, 0, 7) : 0,
    freshness: Math.max(freshness, fallback.freshness * 0.7),
  }
}

function stabilityAxis(signals: ReadinessSignal[], now: Date, sleepNights: SleepNight[]) {
  const night = freshSleepNight(sleepNights[0] ?? null, now)
  const wristTemp = nightRecoveryMetric(signals, ['wrist_temperature'], night)
  const wristTempBaseline = baselineNightRecoveryMedian(signals, ['wrist_temperature'], sleepNights, night?.key ?? null)
  const respiration = nightRecoveryMetric(signals, ['respiratory_rate'], night)
  const respirationBaseline = baselineNightRecoveryMedian(signals, ['respiratory_rate'], sleepNights, night?.key ?? null)
  const oxygen = nightRecoveryMetric(signals, ['oxygen_saturation'], night)
  const baselineDays = minDefined([
    baselineNightRecoveryDayCount(signals, ['wrist_temperature'], sleepNights, night?.key ?? null),
    baselineNightRecoveryDayCount(signals, ['respiratory_rate'], sleepNights, night?.key ?? null),
  ])

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

  const freshness = average([
    metricFreshness(wristTemp, now, SLEEP_FRESHNESS_HOURS),
    metricFreshness(respiration, now, SLEEP_FRESHNESS_HOURS),
    metricFreshness(oxygen, now, SLEEP_FRESHNESS_HOURS),
  ])
  const coverage = confidence

  if (confidence === 0) {
    return {
      score: null,
      confidence: 0,
      coverage,
      freshness,
      baselineDays,
      wristTemp,
      wristTempBaseline,
      respiration,
      respirationBaseline,
      oxygen,
    }
  }

  return {
    score: clamp(92 - penalty, 25, 96),
    confidence: clamp(confidence, 0, 1),
    coverage,
    freshness,
    baselineDays,
    wristTemp,
    wristTempBaseline,
    respiration,
    respirationBaseline,
    oxygen,
  }
}

function nightRecoveryAxis(input: {
  sleep: ReturnType<typeof sleepAxis>
  autonomic: ReturnType<typeof autonomicAxis>
  stability: ReturnType<typeof stabilityAxis>
  night: SleepNight | null
}) {
  const hrvScore = input.autonomic.hrvRatio === null ? null : ratioHigherIsBetterScore(input.autonomic.hrvRatio)
  const sleepHrScore = input.autonomic.rhrRatio === null ? null : ratioHigherIsBetterScore(input.autonomic.rhrRatio)
  const respirationScore = input.autonomic.respirationRatio === null ? null : stableRatioScore(input.autonomic.respirationRatio)
  const wristTempScore = wristTemperatureStabilityScore(input.stability.wristTemp.value, input.stability.wristTempBaseline)
  const oxygen = normalizedOxygenMetric(input.stability.oxygen)
  const oxygenScore = oxygenSaturationScore(oxygen.value)
  const sleepScore = input.sleep.score

  const components: NightRecoveryComponent[] = [
    recoveryComponent({
      key: 'hrv',
      label: 'HRV noturno',
      metric: input.autonomic.hrv,
      baseline: input.autonomic.hrvBaseline,
      score: hrvScore,
      confidence: input.autonomic.hrvRatio === null ? 0 : 0.95,
      weight: 35,
      direction: 'higher_is_better',
      summary: 'Principal marcador autonômico: acima do seu normal tende a indicar melhor recuperação.',
    }),
    recoveryComponent({
      key: 'sleep_hr',
      label: 'FC sono',
      metric: input.autonomic.rhr,
      baseline: input.autonomic.rhrBaseline,
      score: sleepHrScore,
      confidence: input.autonomic.rhrRatio === null ? 0 : 0.9,
      weight: 25,
      direction: 'lower_is_better',
      summary: 'FC média do sono: abaixo do seu normal tende a indicar menor carga fisiológica.',
    }),
    recoveryComponent({
      key: 'respiration',
      label: 'Respiração sono',
      metric: input.autonomic.respiration,
      baseline: input.autonomic.respirationBaseline,
      score: respirationScore,
      confidence: input.autonomic.respirationRatio === null ? 0 : 0.78,
      weight: 12,
      direction: 'stable_is_better',
      summary: 'Respiração deve ficar estável contra seu normal; desvios grandes reduzem confiança.',
    }),
    recoveryComponent({
      key: 'wrist_temperature',
      label: 'Temperatura pulso',
      metric: input.stability.wristTemp,
      baseline: input.stability.wristTempBaseline,
      score: wristTempScore,
      confidence: wristTempScore === null ? 0 : 0.72,
      weight: 10,
      direction: 'stable_is_better',
      summary: 'Temperatura noturna é lida por desvio contra seu normal, não pelo valor absoluto.',
    }),
    recoveryComponent({
      key: 'oxygen',
      label: 'Oxigênio sono',
      metric: oxygen,
      baseline: null,
      score: oxygenScore,
      confidence: oxygenScore === null ? 0 : 0.62,
      weight: 8,
      direction: 'higher_is_better',
      summary: 'SpO2 noturno contextualiza respiração; amostragem irregular reduz peso.',
    }),
    recoveryComponent({
      key: 'sleep',
      label: 'Sono',
      metric: {
        value: input.night?.asleepHours ?? null,
        unit: 'h',
        date: input.night?.wakeTime ?? null,
      },
      baseline: input.sleep.sleepTargetHours,
      score: sleepScore,
      confidence: input.sleep.confidence,
      weight: 10,
      direction: 'higher_is_better',
      summary: 'Sono entra como sustentação: uma fisiologia boa com noite curta ainda não deve virar recovery alto.',
    }),
  ]

  const raw = weightedScore(components.map((item) => component(item.key, item.score, item.weight, item.confidence)))
  const score = raw.confidence >= 0.3 ? raw.score : null
  const freshness = average([
    input.sleep.freshness,
    input.autonomic.freshness,
    input.stability.freshness,
  ])
  const coverage = clamp(
    components
      .filter((item) => typeof item.score === 'number')
      .reduce((sum, item) => sum + item.weight, 0) / components.reduce((sum, item) => sum + item.weight, 0),
    0,
    1,
  )
  const baselineDays = minDefined([
    input.autonomic.hrvBaseline === null ? 0 : 3,
    input.autonomic.rhrBaseline === null ? 0 : 3,
    input.autonomic.respirationBaseline === null ? 0 : 3,
    input.stability.baselineDays,
  ])

  return {
    score,
    confidence: raw.confidence,
    freshness,
    coverage,
    baselineDays,
    components,
  }
}

function recoveryComponent(input: {
  key: NightRecoveryComponentKey
  label: string
  metric: ReadinessMetricValue
  baseline: number | null
  score: number | null
  confidence: number
  weight: number
  direction: NightRecoveryComponent['direction']
  summary: string
}): NightRecoveryComponent {
  const value = input.metric.value
  const baseline = input.baseline
  const delta = typeof value === 'number' && typeof baseline === 'number'
    ? value - baseline
    : null
  const percentDelta = delta !== null && typeof baseline === 'number' && baseline !== 0
    ? delta / baseline
    : null

  return {
    key: input.key,
    label: input.label,
    value,
    baseline,
    unit: input.metric.unit ?? null,
    delta,
    percentDelta,
    score: input.score,
    confidence: clamp(input.confidence, 0, 1),
    weight: input.weight,
    direction: input.direction,
    status: recoveryComponentStatus(input.score),
    summary: input.summary,
  }
}

function recoveryComponentStatus(score: number | null): NightRecoveryComponent['status'] {
  if (score === null) return 'missing'
  if (score >= 78) return 'good'
  if (score >= 55) return 'watch'
  return 'risk'
}

function oxygenSaturationScore(value: number | null): number | null {
  if (typeof value !== 'number') return null
  const percent = value <= 1 ? value * 100 : value
  if (!Number.isFinite(percent)) return null
  if (percent >= 97) return 96
  if (percent >= 95) return clamp(84 + (percent - 95) * 6, 84, 96)
  if (percent >= 92) return clamp(52 + (percent - 92) * 10.5, 52, 84)
  return clamp(25 + Math.max(0, percent - 88) * 6.75, 25, 52)
}

function normalizedOxygenMetric(metric: ReadinessMetricValue): ReadinessMetricValue {
  if (typeof metric.value !== 'number') return metric
  return {
    ...metric,
    value: metric.value <= 1 ? metric.value * 100 : metric.value,
    unit: '%',
  }
}

function readinessFactors(input: {
  sleepNights: SleepNight[]
  sleepTargetHours: number
  sleepTargetMethod: SleepTargetEvidence['method']
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
  const sleepTargetHours = input.sleepTargetHours
  const targetLabel = input.sleepTargetMethod === 'minimum' ? 'mínimo' : 'alvo'

  if (typeof night?.asleepHours === 'number') {
    const deficit = sleepDeficitHours(night.asleepHours, sleepTargetHours)
    const surplus = night.asleepHours - sleepTargetHours
    if (deficit > 0.35) {
      factors.push(factor('short_sleep', `Sono abaixo do ${targetLabel}`, `faltaram ${formatHours(deficit)}`, -Math.min(24, Math.round(deficit * 8))))
    } else if (surplus > 0.2) {
      factors.push(factor('sleep_target', input.sleepTargetMethod === 'minimum' ? 'Mínimo de sono atingido' : 'Alvo de sono atingido', `${formatHours(night.asleepHours)} dormidas`, 8))
    }
  }

  if (typeof input.sleepDebtHours === 'number' && input.sleepDebtHours > 0.75) {
    factors.push(factor('sleep_debt', 'Déficit observado 7d', `${formatHours(input.sleepDebtHours)} acumuladas`, -Math.min(22, Math.round(input.sleepDebtHours * 4))))
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
      factors.push(factor('low_mood', 'Humor baixo', `${input.subjective.checkin.mood_level} / 5`, -9))
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
  return analyzeSleepDays(signals, now, 30)
    .map((night) => ({
      stress: sleepStressForDate(signals, night.key),
      night,
    }))
    .map(({ night, stress }) => ({
      key: night.key,
      asleepHours: night.asleepHours,
      inBedHours: night.inBedHours,
      efficiency: night.efficiency,
      bedtime: night.bedtime,
      wakeTime: night.wakeTime,
      remHours: night.remHours,
      deepHours: night.deepHours,
      coreHours: night.coreHours,
      awakeHours: night.awakeHours,
      latencyMinutes: night.latencyMinutes,
      awakeEpisodeCount: night.awakeEpisodeCount,
      disturbanceCount: night.disturbanceCount,
      sleepCycleCount: night.sleepCycleCount,
      stageCoverage: night.stageCoverage,
      dataQuality: night.dataQuality,
      napHours: night.napHours,
      napCount: night.napCount,
      sleepStressScore: stress.score,
      sleepStressConfidence: stress.confidence,
      sleepStressLabel: stress.label,
    }))
    .filter((night) => typeof night.asleepHours === 'number' || night.wakeTime)
}

function stageDurationsFor(stages: ReadinessSignal[]): Partial<Record<StageKey, number>> {
  const intervals: Partial<Record<StageKey, SleepInterval[]>> = {}
  for (const signal of stages) {
    const key = sleepStageKey(signal.value_numeric)
    if (!key) continue
    const interval = signalInterval(signal)
    if (!interval) continue
    intervals[key] = [...(intervals[key] ?? []), interval]
  }

  const result: Partial<Record<StageKey, number>> = {}
  for (const [key, bucket] of Object.entries(intervals) as Array<[StageKey, SleepInterval[]]>) {
    const hours = unionDurationHours(bucket)
    if (hours !== null) result[key] = hours
  }

  return result
}

function asleepDurationFor(stages: ReadinessSignal[]): number | null {
  const intervals: SleepInterval[] = []
  for (const signal of stages) {
    const key = sleepStageKey(signal.value_numeric)
    if (key !== 'asleep' && key !== 'core' && key !== 'deep' && key !== 'rem') continue
    const interval = signalInterval(signal)
    if (interval) intervals.push(interval)
  }

  return unionDurationHours(intervals)
}

function sleepStageKey(value: number | null): StageKey | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  switch (value) {
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

function bedtimeConsistencyMinutes(nights: SleepNight[]): number | null {
  const minutes = nights
    .map((night) => night.bedtime ? clockMinuteForSleep(night.bedtime) : null)
    .filter((value): value is number => typeof value === 'number')
  if (minutes.length < 3) return null
  const baseline = median(minutes)
  return average(minutes.map((value) => Math.abs(value - baseline)))
}

function sleepTimingConsistencyMinutes(nights: SleepNight[]): number | null {
  const bedtime = bedtimeConsistencyMinutes(nights)
  const wake = wakeConsistencyMinutes(nights)
  const midpoint = midpointConsistencyMinutes(nights)
  const values = [bedtime, wake, midpoint].filter((value): value is number => typeof value === 'number')
  return values.length ? average(values) : null
}

function wakeConsistencyMinutes(nights: SleepNight[]): number | null {
  const minutes = nights
    .map((night) => night.wakeTime ? clockMinuteForWake(night.wakeTime) : null)
    .filter((value): value is number => typeof value === 'number')
  if (minutes.length < 3) return null
  const baseline = median(minutes)
  return average(minutes.map((value) => Math.abs(value - baseline)))
}

function midpointConsistencyMinutes(nights: SleepNight[]): number | null {
  const minutes = nights
    .map((night) => night.bedtime && night.wakeTime ? midpointMinuteForSleep(night.bedtime, night.wakeTime) : null)
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

function clockMinuteForWake(iso: string): number {
  const date = new Date(iso)
  return date.getHours() * 60 + date.getMinutes()
}

function midpointMinuteForSleep(bedtime: string, wakeTime: string): number | null {
  const start = new Date(bedtime).getTime()
  const end = new Date(wakeTime).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return clockMinuteForSleep(new Date(start + (end - start) / 2).toISOString())
}

function latestValue(signals: ReadinessSignal[], signalTypes: string[]): ReadinessMetricValue {
  const match = signals
    .filter((signal) => signalTypes.includes(signal.signal_type))
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
  return signalToMetricValue(match)
}

function latestValueWithMaxAge(
  signals: ReadinessSignal[],
  signalTypes: string[],
  now: Date,
  maxAgeHours: number,
): ReadinessMetricValue {
  const metric = latestValue(signals, signalTypes)
  if (!metric.date) return metric
  const ageMs = now.getTime() - new Date(metric.date).getTime()
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > maxAgeHours * 3600000) {
    return { value: null, unit: metric.unit ?? null, date: metric.date }
  }
  return metric
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

  const latestTime = new Date(matches[0].started_at).getTime()
  if (now.getTime() - latestTime > PHYSIOLOGICAL_FRESHNESS_HOURS * 3600000) {
    return {
      value: null,
      unit: matches[0].unit,
      date: matches[0].started_at,
    }
  }

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

function dailyMax(signals: ReadinessSignal[], signalTypes: string[], date = new Date()): ReadinessMetricValue {
  const start = startOfLocalDay(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 1)
  const matches = signals.filter((signal) => {
    const time = new Date(signal.started_at).getTime()
    return signalTypes.includes(signal.signal_type)
      && time >= start.getTime()
      && time < end.getTime()
      && typeof signal.value_numeric === 'number'
      && Number.isFinite(signal.value_numeric)
  })

  if (matches.length === 0) return { value: null }
  const maxSignal = matches.reduce((best, signal) => (
    Number(signal.value_numeric) > Number(best.value_numeric) ? signal : best
  ))
  return { value: Number(maxSignal.value_numeric), unit: maxSignal.unit, date: maxSignal.started_at }
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

function baselineDailySumMedian(signals: ReadinessSignal[], signalTypes: string[], now: Date): number | null {
  const today = startOfLocalDay(now)
  const values: number[] = []

  for (let daysAgo = 1; daysAgo <= 28; daysAgo++) {
    const date = new Date(today)
    date.setDate(today.getDate() - daysAgo)
    const value = dailySum(signals, signalTypes, date).value
    if (typeof value === 'number') values.push(value)
  }

  return values.length >= 3 ? median(values) : null
}

function baselineDailyMaxMedian(signals: ReadinessSignal[], signalTypes: string[], now: Date): number | null {
  const today = startOfLocalDay(now)
  const values: number[] = []

  for (let daysAgo = 1; daysAgo <= 28; daysAgo++) {
    const date = new Date(today)
    date.setDate(today.getDate() - daysAgo)
    const value = dailyMax(signals, signalTypes, date).value
    if (typeof value === 'number') values.push(value)
  }

  return values.length >= 3 ? median(values) : null
}

function expectedDayRatio(signals: ReadinessSignal[], signalTypes: string[], now: Date, progress: number): number | null {
  const current = dailySum(signals, signalTypes, now).value
  const baseline = baselineDailySumMedian(signals, signalTypes, now)
  if (typeof current !== 'number' || typeof baseline !== 'number' || baseline <= 0) return null
  return current / Math.max(baseline * Math.max(0.18, progress), 1)
}

function loadRatioInput(
  signals: ReadinessSignal[],
  signalTypes: string[],
  now: Date,
  progress: number,
  weight: number,
): LoadRatioInput | null {
  const value = expectedDayRatio(signals, signalTypes, now, progress)
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return {
    value,
    weight,
    baselineDays: baselineDayCount(signals, signalTypes, now),
  }
}

function loadMaxRatioInput(
  signals: ReadinessSignal[],
  signalTypes: string[],
  now: Date,
  weight: number,
): LoadRatioInput | null {
  const current = dailyMax(signals, signalTypes, now).value
  const baseline = baselineDailyMaxMedian(signals, signalTypes, now)
  if (typeof current !== 'number' || typeof baseline !== 'number' || baseline <= 0) return null
  const value = current / baseline
  return {
    value,
    weight,
    baselineDays: baselineDayCount(signals, signalTypes, now),
  }
}

function acuteChronicLoadRatio(signals: ReadinessSignal[], signalTypes: string[], now: Date): number | null {
  const today = startOfLocalDay(now)
  const acuteValues: number[] = []
  const chronicValues: number[] = []

  for (let daysAgo = 0; daysAgo <= 6; daysAgo++) {
    const date = new Date(today)
    date.setDate(today.getDate() - daysAgo)
    const value = dailySum(signals, signalTypes, date).value
    if (typeof value === 'number') acuteValues.push(value)
  }

  for (let daysAgo = 7; daysAgo <= 34; daysAgo++) {
    const date = new Date(today)
    date.setDate(today.getDate() - daysAgo)
    const value = dailySum(signals, signalTypes, date).value
    if (typeof value === 'number') chronicValues.push(value)
  }

  if (acuteValues.length < 3 || chronicValues.length < 7) return null
  const chronic = average(chronicValues)
  return chronic > 0 ? average(acuteValues) / chronic : null
}

function loadFreshness(signals: ReadinessSignal[], now: Date): number {
  const values = [
    dailySum(signals, ['workout_cardio_load'], now),
    dailySum(signals, ['waking_cardio_load'], now),
    dailyMax(signals, ['workout_effort_score', 'estimated_workout_effort_score'], now),
    dailySum(signals, ['active_energy_kcal'], now),
    dailySum(signals, ['exercise_minutes'], now),
    dailySum(signals, ['steps'], now),
  ].map((value) => metricFreshness(value, now, 24))

  return Math.max(...values, 0)
}

function dailyMedianForDate(signals: ReadinessSignal[], signalTypes: string[], dateKey: string): number | null {
  const values = signals
    .filter((signal) => (
      signalTypes.includes(signal.signal_type)
      && typeof signal.value_numeric === 'number'
      && localDateKey(signal.started_at) === dateKey
    ))
    .map((signal) => Number(signal.value_numeric))
    .filter((value) => Number.isFinite(value))

  return values.length ? median(values) : null
}

function dailySumForDate(signals: ReadinessSignal[], signalTypes: string[], dateKey: string): number | null {
  const values = signals
    .filter((signal) => (
      signalTypes.includes(signal.signal_type)
      && typeof signal.value_numeric === 'number'
      && localDateKey(signal.started_at) === dateKey
    ))
    .map((signal) => Number(signal.value_numeric))
    .filter((value) => Number.isFinite(value))

  return values.length ? values.reduce((sum, value) => sum + value, 0) : null
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

function baselineDayCount(signals: ReadinessSignal[], signalTypes: string[], now: Date): number {
  const cutoff = startOfLocalDay(now)
  const start = new Date(cutoff)
  start.setDate(cutoff.getDate() - 28)
  return groupedNumericSignalsByDay(signals, signalTypes, start, cutoff).size
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
  const weighted = present.reduce((sum, item) => sum + Number(item.score) * item.weight * clamp(item.confidence ?? 1, 0, 1), 0)
  const weight = present.reduce((sum, item) => sum + item.weight * clamp(item.confidence ?? 1, 0, 1), 0)
  const confidence = present.reduce((sum, item) => sum + item.weight * clamp(item.confidence ?? 1, 0, 1), 0) / totalWeight
  if (weight <= 0) return { score: null, confidence: clamp(confidence, 0, 1) }
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
  if (score >= 55) return 'moderada'
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
  if (score >= 82) return 'forte'
  if (score >= 68) return 'bom'
  if (score >= 52) return 'moderado'
  return 'baixo'
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
  if (score >= 82) return 'alta'
  if (score >= 62) return 'normal'
  return 'baixa'
}

function stabilityLabel(score: number | null): string {
  if (score === null) return 'Sem dado'
  if (score >= 82) return 'estável'
  if (score >= 62) return 'observar'
  return 'instável'
}

function recoveryLabel(score: number | null): string {
  if (score === null) return 'Sem dado'
  if (score >= 85) return 'alta'
  if (score >= 70) return 'boa'
  if (score >= 55) return 'moderada'
  if (score >= 40) return 'baixa'
  return 'crítica'
}

function confidenceLabel(value: number): { value: number; label: string } {
  const pct = Math.round(clamp(value, 0, 1) * 100)
  if (pct >= 78) return { value: pct, label: `${pct}% boa` }
  if (pct >= 48) return { value: pct, label: `${pct}% parcial` }
  return { value: pct, label: `${pct}% base em formação` }
}

function buildAxisQuality(input: {
  base: ReadinessScore
  current: ReadinessScore
  body: ReadinessScore
  mind: ReadinessScore
  drive: ReadinessScore
  focus: ReadinessScore
  nightRecoveryScore: ReadinessScore
  sleepScore: ReadinessScore
  autonomicScore: ReadinessScore
  loadScore: ReadinessScore
  subjectiveScore: ReadinessScore
  stabilityScore: ReadinessScore
  sleepAxis: ReturnType<typeof sleepAxis>
  autonomicAxis: ReturnType<typeof autonomicAxis>
  loadAxis: ReturnType<typeof loadAxis>
  subjectiveAxis: ReturnType<typeof subjectiveAxis>
  digitalFocus: ReturnType<typeof digitalFocusAxis>
  stabilityAxis: ReturnType<typeof stabilityAxis>
  nightRecoveryAxis: ReturnType<typeof nightRecoveryAxis>
  healthSignals: ReadinessSignal[]
  now: Date
}): Record<ReadinessAxisKey, ReadinessAxisQuality> {
  const sleepFreshness = input.sleepAxis.freshness
  const sleepCoverage = input.sleepAxis.recentNightCoverage
  const autonomicBaselineDays = minDefined([
    baselineDayCount(input.healthSignals, ['hrv_ms'], input.now),
    baselineDayCount(input.healthSignals, ['resting_heart_rate_bpm'], input.now),
    baselineDayCount(input.healthSignals, ['respiratory_rate'], input.now),
  ])
  const autonomicCoverage = clamp((autonomicBaselineDays ?? 0) / 7, 0, 1)
  const loadCoverage = loadRatioCoverage(input.loadAxis.ratioWeight)
  const subjectiveFreshness = input.subjectiveAxis.freshness
  const subjectiveCoverage = input.subjectiveAxis.checkin
    ? 1
    : typeof input.subjectiveAxis.stateOfMind.value === 'number'
      ? 0.45
      : 0
  const digitalFreshness = input.digitalFocus.freshness
  const stabilityCoverage = input.stabilityAxis.coverage
  const nightRecoveryCoverage = input.nightRecoveryAxis.coverage
  const nightRecoveryFreshness = input.nightRecoveryAxis.freshness

  const result = {
    nightRecovery: axisQuality(input.nightRecoveryScore, nightRecoveryCoverage, nightRecoveryFreshness, input.nightRecoveryAxis.baselineDays, 'Score noturno com HRV, FC sono, respiração, temperatura, oxigênio e sono.'),
    sleep: axisQuality(input.sleepScore, sleepCoverage, sleepFreshness, input.sleepAxis.recentNightCount, 'Noites recentes e fases do sono usadas no eixo.'),
    autonomic: axisQuality(input.autonomicScore, autonomicCoverage, input.autonomicAxis.freshness, autonomicBaselineDays, 'Baseline autonômico disponível para HRV, FC repouso e respiração.'),
    load: axisQuality(input.loadScore, loadCoverage, input.loadAxis.freshness, input.loadAxis.baselineDays, 'Cobertura da carga relativa e treino recente.'),
    subjective: axisQuality(input.subjectiveScore, subjectiveCoverage, subjectiveFreshness, null, 'Frescor do check-in e fallback de estado mental.'),
    stability: axisQuality(input.stabilityScore, stabilityCoverage, input.stabilityAxis.freshness, input.stabilityAxis.baselineDays, 'Cobertura de temperatura, respiração e oxigênio.'),
    mind: axisQuality(input.mind, average([input.subjectiveScore.confidence, sleepCoverage, input.autonomicScore.confidence, input.digitalFocus.confidence]), average([subjectiveFreshness, sleepFreshness, input.autonomicAxis.freshness, digitalFreshness]), null, 'Composto de estado percebido, sono, recuperação e digital.'),
    drive: axisQuality(input.drive, average([input.subjectiveScore.confidence, input.loadScore.confidence, input.sleepScore.confidence]), average([subjectiveFreshness, input.loadAxis.freshness, sleepFreshness]), null, 'Composto de energia percebida, estado, carga e sono.'),
    focus: axisQuality(input.focus, average([input.subjectiveScore.confidence, input.sleepScore.confidence, input.digitalFocus.confidence]), average([subjectiveFreshness, sleepFreshness, digitalFreshness]), null, 'Composto de check-in, sono e comportamento digital.'),
    body: axisQuality(input.body, average([input.nightRecoveryScore.confidence, input.loadScore.confidence]), average([nightRecoveryFreshness, input.loadAxis.freshness]), null, 'Composto de recuperação noturna e margem de carga.'),
    base: axisQuality(input.base, input.base.confidence, average([nightRecoveryFreshness, input.loadAxis.freshness, subjectiveFreshness]), null, 'Cobertura global da prontidão do dia.'),
    current: axisQuality(input.current, input.current.confidence, average([sleepFreshness, input.loadAxis.freshness, subjectiveFreshness, digitalFreshness]), null, 'Cobertura dos sinais que ainda mudam ao longo do dia.'),
  } satisfies Omit<Record<ReadinessAxisKey, ReadinessAxisQuality>, 'dataQuality'>

  const dataConfidence = average(Object.values(result).map((item) => item.confidence))
  const dataQuality = axisQuality(
    { score: Math.round(dataConfidence * 100), confidence: dataConfidence, label: '', display: '' },
    average(Object.values(result).map((item) => item.coverage)),
    average(Object.values(result).map((item) => item.freshness)),
    null,
    'Qualidade agregada dos dados que sustentam os eixos.',
  )

  return {
    ...result,
    dataQuality,
  }
}

function loadRatioCoverage(ratioWeight: number): number {
  return clamp(ratioWeight / COMPLETE_LOAD_RATIO_WEIGHT, 0, 1)
}

function axisQuality(
  score: ReadinessScore,
  coverage: number,
  freshness: number,
  baselineDays: number | null,
  summary: string,
): ReadinessAxisQuality {
  const confidence = clamp(score.confidence, 0, 1)
  const normalizedCoverage = clamp(coverage, 0, 1)
  const normalizedFreshness = clamp(freshness, 0, 1)
  const combined = confidence * 0.5 + normalizedCoverage * 0.25 + normalizedFreshness * 0.25
  const status: ReadinessAxisQuality['status'] = combined >= 0.78
    ? 'good'
    : combined >= 0.48
      ? 'partial'
      : 'baseline'

  return {
    confidence,
    coverage: normalizedCoverage,
    freshness: normalizedFreshness,
    baselineDays,
    status,
    summary,
  }
}

function axisQualityScore(quality: ReadinessAxisQuality): number {
  return clamp(quality.confidence * 0.5 + quality.coverage * 0.25 + quality.freshness * 0.25, 0, 1)
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

function currentConfidence(base: number, load: number, subjective: number, digital: number): number {
  const dynamicConfidence = average([load, subjective, digital].map((value) => clamp(value, 0, 1)))
  return clamp(base * (0.65 + dynamicConfidence * 0.35), 0, 1)
}

function currentCognitivePenalty(
  state: CheckinState | null,
  freshness: number,
  focusToday: number | null,
  digitalPressurePenalty = 0,
): number {
  let penalty = 0
  if (state === 'blocked') penalty += 12
  if (state === 'disperse') penalty += 7
  if (state === 'pause') penalty += 3
  if (freshness < 0.25 && state) penalty += 2
  if (typeof focusToday === 'number' && focusToday > 210) penalty += 4
  penalty += digitalPressurePenalty
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

function wristTemperatureStabilityScore(value: number | null, baseline: number | null): number | null {
  if (typeof value !== 'number' || typeof baseline !== 'number') return null
  return clamp(96 - Math.abs(value - baseline) * 70, 35, 96)
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

function decayScoreToNeutral(score: number, freshness: number): number {
  const bounded = clamp(freshness, 0, 1)
  return score * bounded + 60 * (1 - bounded)
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

function signalInterval(signal: ReadinessSignal): SleepInterval | null {
  const started = new Date(signal.started_at).getTime()
  const ended = signalEndTime(signal)
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) return null
  return { start: started, end: ended }
}

function unionDurationHours(intervals: SleepInterval[]): number | null {
  if (intervals.length === 0) return null

  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  let totalMs = 0
  let currentStart = sorted[0].start
  let currentEnd = sorted[0].end

  for (const interval of sorted.slice(1)) {
    if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end)
      continue
    }

    totalMs += currentEnd - currentStart
    currentStart = interval.start
    currentEnd = interval.end
  }

  totalMs += currentEnd - currentStart
  return totalMs / 3600000
}

function latestDigitalSnapshot(snapshots: ReadinessDigitalSnapshot[], now: Date): ReadinessDigitalSnapshot | null {
  const today = localDateKey(now.toISOString())
  return snapshots
    .filter((snapshot) => (
      snapshot.snapshot_date === today
      && new Date(snapshot.computed_at).getTime() <= now.getTime()
    ))
    .sort((a, b) => new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime())[0] ?? null
}

function numericOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function numericOrZero(value: unknown): number {
  return numericOrNull(value) ?? 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function metricFreshness(metric: ReadinessMetricValue, now: Date, ttlHours: number): number {
  if (!metric.date || typeof metric.value !== 'number') return 0
  const time = new Date(metric.date).getTime()
  if (!Number.isFinite(time)) return 0
  const ageHours = Math.max(0, (now.getTime() - time) / 3600000)
  if (ageHours > ttlHours) return 0
  return Math.pow(0.5, ageHours / Math.max(1, ttlHours * 0.75))
}

function minDefined(values: Array<number | null | undefined>): number | null {
  const present = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return present.length ? Math.min(...present) : null
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

function dateFromLocalKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isFinite(date.getTime()) ? date : null
}

function shiftDateKey(key: string, days: number): string | null {
  const date = dateFromLocalKey(key)
  if (!date) return null
  date.setDate(date.getDate() + days)
  return localDateKey(date.toISOString())
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
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
