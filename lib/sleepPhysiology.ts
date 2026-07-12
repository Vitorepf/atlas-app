import { clamp } from './mathUtils'
export interface SleepPhysiologySignal {
  signal_type: string
  value_numeric: number | null
  unit?: string | null
  started_at: string
  ended_at?: string | null
}

export interface SleepStressSummary {
  score: number | null
  confidence: number
  label: 'baixo' | 'moderado' | 'alto' | 'sem dado'
  sleepHeartRateRatio: number | null
  sleepHeartRateAverageBpm: number | null
  sleepHeartRateMinBpm: number | null
  hrvRatio: number | null
  restingHeartRateRatio: number | null
  respiratoryRateRatio: number | null
  wristTemperatureDeltaC: number | null
  oxygenSaturationPercent: number | null
  breathingDisturbanceCount: number | null
}

export function sleepStressForDate<T extends SleepPhysiologySignal>(
  signals: T[],
  dateKey: string,
): SleepStressSummary {
  const sleepHeartRateAverage = dailyMedianForDate(signals, ['sleep_hr_avg_bpm'], dateKey)
  const sleepHeartRateAverageBaseline = baselineDailyMedianBeforeDate(signals, ['sleep_hr_avg_bpm'], dateKey)
  const sleepHeartRateMin = dailyMedianForDate(signals, ['sleep_hr_min_bpm'], dateKey)
  const hrv = dailyMedianForDate(signals, ['hrv_ms'], dateKey)
  const hrvBaseline = baselineDailyMedianBeforeDate(signals, ['hrv_ms'], dateKey)
  const restingHeartRate = dailyMedianForDate(signals, ['resting_heart_rate_bpm'], dateKey)
  const restingHeartRateBaseline = baselineDailyMedianBeforeDate(signals, ['resting_heart_rate_bpm'], dateKey)
  const respiratoryRate = dailyMedianForDate(signals, ['respiratory_rate'], dateKey)
  const respiratoryRateBaseline = baselineDailyMedianBeforeDate(signals, ['respiratory_rate'], dateKey)
  const wristTemperature = dailyMedianForDate(signals, ['wrist_temperature'], dateKey)
  const wristTemperatureBaseline = baselineDailyMedianBeforeDate(signals, ['wrist_temperature'], dateKey)
  const oxygenSaturation = normalizeOxygen(dailyMedianForDate(signals, ['oxygen_saturation'], dateKey))
  const breathingDisturbances = dailySumForDate(signals, ['sleep_breathing_disturbances'], dateKey)

  const sleepHeartRateRatio = ratio(sleepHeartRateAverage, sleepHeartRateAverageBaseline)
  const hrvRatio = ratio(hrv, hrvBaseline)
  const rhrRatio = ratio(restingHeartRate, restingHeartRateBaseline)
  const respirationRatio = ratio(respiratoryRate, respiratoryRateBaseline)
  const wristTempDelta = typeof wristTemperature === 'number' && typeof wristTemperatureBaseline === 'number'
    ? wristTemperature - wristTemperatureBaseline
    : null

  let penalty = 0
  let confidence = 0

  if (typeof sleepHeartRateRatio === 'number') {
    penalty += sleepHeartRateRatio > 1 ? Math.min(26, (sleepHeartRateRatio - 1) * 105) : 0
    confidence += 0.24
  }

  if (typeof hrvRatio === 'number') {
    penalty += hrvRatio < 1 ? Math.min(30, (1 - hrvRatio) * 85) : 0
    confidence += 0.32
  }

  if (typeof rhrRatio === 'number') {
    penalty += rhrRatio > 1 ? Math.min(28, (rhrRatio - 1) * 95) : 0
    confidence += typeof sleepHeartRateRatio === 'number' ? 0.2 : 0.28
  }

  if (typeof respirationRatio === 'number') {
    const diff = Math.abs(respirationRatio - 1)
    penalty += diff > 0.05 ? Math.min(18, (diff - 0.05) * 150) : 0
    confidence += 0.18
  }

  if (typeof wristTempDelta === 'number') {
    const absDelta = Math.abs(wristTempDelta)
    penalty += absDelta > 0.2 ? Math.min(16, (absDelta - 0.2) * 30) : 0
    confidence += 0.14
  }

  if (typeof oxygenSaturation === 'number') {
    penalty += oxygenSaturation < 95 ? Math.min(18, (95 - oxygenSaturation) * 6) : 0
    confidence += 0.08
  }

  if (typeof breathingDisturbances === 'number') {
    penalty += breathingDisturbances > 5 ? Math.min(16, (breathingDisturbances - 5) * 1.8) : 0
    confidence += 0.08
  }

  if (confidence < 0.28) {
    return {
      score: null,
      confidence: 0,
      label: 'sem dado',
      sleepHeartRateRatio,
      sleepHeartRateAverageBpm: sleepHeartRateAverage,
      sleepHeartRateMinBpm: sleepHeartRateMin,
      hrvRatio,
      restingHeartRateRatio: rhrRatio,
      respiratoryRateRatio: respirationRatio,
      wristTemperatureDeltaC: wristTempDelta,
      oxygenSaturationPercent: oxygenSaturation,
      breathingDisturbanceCount: breathingDisturbances,
    }
  }

  const score = clamp(100 - penalty, 0, 100)

  return {
    score,
    confidence: clamp(confidence, 0, 1),
    label: score >= 82 ? 'baixo' : score >= 62 ? 'moderado' : 'alto',
    sleepHeartRateRatio,
    sleepHeartRateAverageBpm: sleepHeartRateAverage,
    sleepHeartRateMinBpm: sleepHeartRateMin,
    hrvRatio,
    restingHeartRateRatio: rhrRatio,
    respiratoryRateRatio: respirationRatio,
    wristTemperatureDeltaC: wristTempDelta,
    oxygenSaturationPercent: oxygenSaturation,
    breathingDisturbanceCount: breathingDisturbances,
  }
}

function dailyMedianForDate<T extends SleepPhysiologySignal>(
  signals: T[],
  signalTypes: string[],
  dateKey: string,
): number | null {
  const values = signals
    .filter((signal) => (
      signalTypes.includes(signal.signal_type)
      && typeof signal.value_numeric === 'number'
      && metricDateKey(signal) === dateKey
    ))
    .map((signal) => Number(signal.value_numeric))
    .filter((value) => Number.isFinite(value))

  return values.length ? median(values) : null
}

function dailySumForDate<T extends SleepPhysiologySignal>(
  signals: T[],
  signalTypes: string[],
  dateKey: string,
): number | null {
  const values = signals
    .filter((signal) => (
      signalTypes.includes(signal.signal_type)
      && typeof signal.value_numeric === 'number'
      && metricDateKey(signal) === dateKey
    ))
    .map((signal) => Number(signal.value_numeric))
    .filter((value) => Number.isFinite(value))

  return values.length ? values.reduce((sum, value) => sum + value, 0) : null
}

function baselineDailyMedianBeforeDate<T extends SleepPhysiologySignal>(
  signals: T[],
  signalTypes: string[],
  dateKey: string,
): number | null {
  const end = dateFromLocalKey(dateKey)
  if (!end) return null
  const start = new Date(end)
  start.setDate(end.getDate() - 28)

  const byDay = new Map<string, number[]>()
  for (const signal of signals) {
    const time = metricTime(signal)
    if (
      !signalTypes.includes(signal.signal_type)
      || typeof signal.value_numeric !== 'number'
      || time < start.getTime()
      || time >= end.getTime()
    ) {
      continue
    }

    const key = metricDateKey(signal)
    byDay.set(key, [...(byDay.get(key) ?? []), Number(signal.value_numeric)])
  }

  const dayMedians = [...byDay.values()].map((values) => median(values))
  return dayMedians.length >= 3 ? median(dayMedians) : null
}

function normalizeOxygen(value: number | null): number | null {
  if (typeof value !== 'number') return null
  return value <= 1 ? value * 100 : value
}

function ratio(value: number | null, baseline: number | null): number | null {
  if (typeof value !== 'number' || typeof baseline !== 'number' || baseline === 0) return null
  return value / baseline
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function localDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function metricDateKey(signal: SleepPhysiologySignal): string {
  return localDateKey(new Date(metricTime(signal)))
}

function metricTime(signal: SleepPhysiologySignal): number {
  const iso = signal.signal_type.startsWith('sleep_hr_') || signal.signal_type === 'sleep_breathing_disturbances' || signal.signal_type === 'sleep_duration_hours' || signal.signal_type === 'sleep_stage'
    ? signal.ended_at ?? signal.started_at
    : signal.started_at
  return new Date(iso).getTime()
}

function dateFromLocalKey(key: string): Date | null {
  const [year, month, day] = key.split('-').map((part) => Number.parseInt(part, 10))
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}
