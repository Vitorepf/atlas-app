import { clamp } from './mathUtils'
export interface SleepTargetNight {
  key?: string | null
  asleepHours: number | null
  napHours?: number | null
  strainRatio?: number | null
  outcomeScore?: number | null
  recoveryScore?: number | null
  performanceScore?: number | null
  subjectiveScore?: number | null
}

export interface SleepTargetEvidenceBucket {
  rangeLabel: string
  startHours: number
  endHours: number
  nights: number
  goodNights: number
  averageSleepHours: number
  averageOutcomeScore: number | null
}

export interface SleepTargetEvidence {
  method: 'outcome' | 'duration' | 'minimum'
  targetHours: number
  baselineHours: number
  sleepNeedHours: number
  sleepDebtAdjustmentHours: number
  strainAdjustmentHours: number
  napAdjustmentHours: number
  recentSleepDebtHours: number | null
  recentStrainRatio: number | null
  recentNapHours: number | null
  sampleCount: number
  outcomeSampleCount: number
  minimumAcceptableHours: number
  buckets: SleepTargetEvidenceBucket[]
  bestRange: SleepTargetEvidenceBucket | null
}

export const MIN_ACCEPTABLE_SLEEP_HOURS = 7.5
export const MAX_INFERRED_SLEEP_TARGET_HOURS = 9
export const MAX_DYNAMIC_SLEEP_NEED_HOURS = 9.5
export const MIN_SLEEP_TARGET_HISTORY_NIGHTS = 10
export const MAX_REPORTED_SLEEP_DEBT_HOURS = 8

const SLEEP_TARGET_LOOKBACK_NIGHTS = 30
const MIN_OUTCOME_TARGET_NIGHTS = 10
const MIN_BUCKET_NIGHTS = 3
const GOOD_OUTCOME_SCORE = 72
const OUTCOME_BUCKET_HOURS = 0.5
const MIN_PLAUSIBLE_SLEEP_HOURS = 4
const MAX_PLAUSIBLE_SLEEP_HOURS = 10.5
const SLEEP_DEBT_DECAY_PER_NIGHT = 0.72

export function inferSleepTargetHours(nights: SleepTargetNight[]): number {
  return inferSleepTarget(nights).targetHours
}

export function inferSleepTarget(nights: SleepTargetNight[]): SleepTargetEvidence {
  const normalized = nights
    .filter((night) => typeof night.asleepHours === 'number')
    .slice(0, SLEEP_TARGET_LOOKBACK_NIGHTS)
    .map((night) => ({
      ...night,
      asleepHours: Number(night.asleepHours),
      napHours: numericOrNull(night.napHours),
      strainRatio: numericOrNull(night.strainRatio),
      outcomeScore: numericOrNull(night.outcomeScore),
    }))
    .filter((night) => night.asleepHours >= MIN_PLAUSIBLE_SLEEP_HOURS && night.asleepHours <= MAX_PLAUSIBLE_SLEEP_HOURS)
  const buckets = sleepTargetBuckets(normalized)
  const outcomeBuckets = buckets
    .filter((bucket) => (
      bucket.nights >= MIN_BUCKET_NIGHTS
      && bucket.goodNights >= 2
      && bucket.averageOutcomeScore !== null
      && bucket.averageOutcomeScore >= GOOD_OUTCOME_SCORE - 4
    ))
    .sort((a, b) => (
      Number(b.averageOutcomeScore) - Number(a.averageOutcomeScore)
      || b.goodNights - a.goodNights
      || a.averageSleepHours - b.averageSleepHours
    ))
  const outcomeSampleCount = normalized.filter((night) => typeof night.outcomeScore === 'number').length

  if (outcomeSampleCount >= MIN_OUTCOME_TARGET_NIGHTS && outcomeBuckets.length > 0) {
    const bestRange = outcomeBuckets[0]
    const baselineHours = clamp(
      roundToQuarterHour(bestRange.averageSleepHours),
      MIN_ACCEPTABLE_SLEEP_HOURS,
      MAX_INFERRED_SLEEP_TARGET_HOURS,
    )
    const need = dynamicSleepNeed(normalized, baselineHours)

    return {
      method: 'outcome',
      targetHours: need.sleepNeedHours,
      baselineHours,
      ...need,
      sampleCount: normalized.length,
      outcomeSampleCount,
      minimumAcceptableHours: MIN_ACCEPTABLE_SLEEP_HOURS,
      buckets,
      bestRange,
    }
  }

  const values = normalized.map((night) => night.asleepHours)
  if (values.length >= MIN_SLEEP_TARGET_HISTORY_NIGHTS) {
    const inferred = roundToQuarterHour(percentile(values, 0.75))
    const baselineHours = clamp(inferred, MIN_ACCEPTABLE_SLEEP_HOURS, MAX_INFERRED_SLEEP_TARGET_HOURS)
    const bestRange = bucketForTarget(buckets, baselineHours)
    const need = dynamicSleepNeed(normalized, baselineHours)

    return {
      method: 'duration',
      targetHours: need.sleepNeedHours,
      baselineHours,
      ...need,
      sampleCount: normalized.length,
      outcomeSampleCount,
      minimumAcceptableHours: MIN_ACCEPTABLE_SLEEP_HOURS,
      buckets,
      bestRange,
    }
  }

  const need = dynamicSleepNeed(normalized, MIN_ACCEPTABLE_SLEEP_HOURS)
  return {
    method: 'minimum',
    targetHours: need.sleepNeedHours,
    baselineHours: MIN_ACCEPTABLE_SLEEP_HOURS,
    ...need,
    sampleCount: normalized.length,
    outcomeSampleCount,
    minimumAcceptableHours: MIN_ACCEPTABLE_SLEEP_HOURS,
    buckets,
    bestRange: null,
  }
}

export function sleepDeficitHours(asleepHours: number, targetHours: number): number {
  return Math.max(0, targetHours - asleepHours)
}

export function sleepDebtHoursForNights(nights: SleepTargetNight[], targetHours: number): number | null {
  const recent = nights
    .filter((night) => typeof night.asleepHours === 'number')
    .slice(0, 7)

  if (recent.length === 0) return null

  const debt = recent.reduce((sum, night, index) => (
    sum + sleepDeficitHours(Number(night.asleepHours), targetHours) * Math.pow(SLEEP_DEBT_DECAY_PER_NIGHT, index)
  ), 0)

  return Math.min(MAX_REPORTED_SLEEP_DEBT_HOURS, debt)
}

function dynamicSleepNeed(
  nights: Array<SleepTargetNight & { asleepHours: number }>,
  baselineHours: number,
): Pick<
  SleepTargetEvidence,
  | 'sleepNeedHours'
  | 'sleepDebtAdjustmentHours'
  | 'strainAdjustmentHours'
  | 'napAdjustmentHours'
  | 'recentSleepDebtHours'
  | 'recentStrainRatio'
  | 'recentNapHours'
> {
  const hasChronology = nights.some((night) => typeof night.key === 'string' && night.key.length > 0)
  const priorNights = hasChronology ? nights.slice(1, 8) : []
  const recentSleepDebtHours = priorNights.length > 0
    ? sleepDebtHoursForNights(priorNights, baselineHours)
    : null
  const sleepDebtAdjustmentHours = typeof recentSleepDebtHours === 'number'
    ? clamp(recentSleepDebtHours * 0.18, 0, 1.25)
    : 0
  const recentStrainRatio = numericOrNull(nights[0]?.strainRatio)
  const strainAdjustmentHours = typeof recentStrainRatio === 'number'
    ? clamp((recentStrainRatio - 1.15) * 0.75, 0, 0.75)
    : 0
  const recentNapHours = numericOrNull(priorNights[0]?.napHours)
  const napAdjustmentHours = typeof recentNapHours === 'number'
    ? clamp(recentNapHours * 0.75, 0, 1)
    : 0
  const sleepNeedHours = clamp(
    roundToQuarterHour(baselineHours + sleepDebtAdjustmentHours + strainAdjustmentHours - napAdjustmentHours),
    MIN_ACCEPTABLE_SLEEP_HOURS,
    MAX_DYNAMIC_SLEEP_NEED_HOURS,
  )

  return {
    sleepNeedHours,
    sleepDebtAdjustmentHours,
    strainAdjustmentHours,
    napAdjustmentHours,
    recentSleepDebtHours,
    recentStrainRatio,
    recentNapHours,
  }
}

function sleepTargetBuckets(nights: Array<SleepTargetNight & { asleepHours: number }>): SleepTargetEvidenceBucket[] {
  const groups = new Map<number, Array<SleepTargetNight & { asleepHours: number }>>()

  for (const night of nights) {
    const start = Math.floor(night.asleepHours / OUTCOME_BUCKET_HOURS) * OUTCOME_BUCKET_HOURS
    groups.set(start, [...(groups.get(start) ?? []), night])
  }

  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([startHours, bucket]) => {
      const outcomeScores = bucket
        .map((night) => numericOrNull(night.outcomeScore))
        .filter((value): value is number => typeof value === 'number')

      return {
        rangeLabel: `${formatHours(startHours)}-${formatHours(startHours + OUTCOME_BUCKET_HOURS)}`,
        startHours,
        endHours: startHours + OUTCOME_BUCKET_HOURS,
        nights: bucket.length,
        goodNights: outcomeScores.filter((score) => score >= GOOD_OUTCOME_SCORE).length,
        averageSleepHours: average(bucket.map((night) => night.asleepHours)),
        averageOutcomeScore: outcomeScores.length ? average(outcomeScores) : null,
      }
    })
}

function bucketForTarget(buckets: SleepTargetEvidenceBucket[], targetHours: number): SleepTargetEvidenceBucket | null {
  return buckets.find((bucket) => targetHours >= bucket.startHours && targetHours < bucket.endHours) ?? null
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 0) return MIN_ACCEPTABLE_SLEEP_HOURS
  if (sorted.length === 1) return sorted[0]

  const index = clamp(fraction, 0, 1) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]

  const weight = index - lower
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight
}

function roundToQuarterHour(hours: number): number {
  return Math.round(hours * 4) / 4
}

function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h${String(m).padStart(2, '0')}`
}

function numericOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
