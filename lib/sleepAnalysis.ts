import { hasMeaningfulSleepEpisode, isMainSleepCandidate } from './sleepValidity'

export type SleepStageKey = 'awake' | 'rem' | 'core' | 'deep' | 'asleep' | 'inBed'

export interface SleepAnalysisSignal {
  signal_type: string
  value_numeric: number | null
  value_text?: string | null
  unit?: string | null
  started_at: string
  ended_at?: string | null
}

export interface SleepEpisodeAnalysis {
  key: string
  asleepHours: number | null
  inBedHours: number | null
  efficiency: number | null
  bedtime: string | null
  wakeTime: string | null
  inBedStartTime: string | null
  remHours: number | null
  deepHours: number | null
  coreHours: number | null
  awakeHours: number | null
  unspecifiedHours: number | null
  latencyMinutes: number | null
  awakeEpisodeCount: number | null
  disturbanceCount: number | null
  sleepCycleCount: number | null
  stageCoverage: number | null
  dataQuality: number
  dataQualityLabel: 'alta' | 'parcial' | 'baixa'
  captureStatus: 'complete' | 'partial' | 'duration_only'
  source: 'stages' | 'duration_only'
}

export interface DailySleepAnalysis extends SleepEpisodeAnalysis {
  napHours: number | null
  napCount: number
  episodes: SleepEpisodeAnalysis[]
}

type SleepInterval = { start: number; end: number }
type StageInterval = SleepInterval & { stage: SleepStageKey }

const EPISODE_GAP_MS = 90 * 60 * 1000
const MIN_AWAKE_EPISODE_MS = 2 * 60 * 1000
const MIN_DISTURBANCE_MS = 30 * 1000

export function analyzeSleepDays<T extends SleepAnalysisSignal>(
  signals: T[],
  now = new Date(),
  days = 30,
): DailySleepAnalysis[] {
  const start = new Date(now)
  start.setDate(now.getDate() - days)
  const keys = new Set<string>()

  for (const signal of signals) {
    if (!isSleepSignal(signal) || signalEndTime(signal) < start.getTime()) continue
    keys.add(localDateKey(signal.ended_at ?? signal.started_at))
  }

  return [...keys]
    .map((key) => analyzeSleepDay(signals, key))
    .filter((night): night is DailySleepAnalysis => night !== null)
    .sort((a, b) => b.key.localeCompare(a.key))
}

export function analyzeSleepDay<T extends SleepAnalysisSignal>(
  signals: T[],
  key: string,
): DailySleepAnalysis | null {
  const window = sleepAnalysisWindow(key)
  const stages = signals
    .filter((signal) => signal.signal_type === 'sleep_stage')
    .map(stageInterval)
    .filter((interval): interval is StageInterval => interval !== null)
    .filter((interval) => interval.start < window.end && interval.end > window.start)

  const durationSignals = signals
    .filter((signal) => signal.signal_type === 'sleep_duration_hours')
    .filter((signal) => localDateKey(signal.ended_at ?? signal.started_at) === key)
    .filter((signal) => typeof signal.value_numeric === 'number' && Number.isFinite(signal.value_numeric))

  const stageEpisodes = groupStageIntervals(stages)
    .map((group) => episodeFromStages(key, group))
    .filter((episode) => episode.wakeTime && localDateKey(episode.wakeTime) === key)
    .filter(isMeaningfulEpisode)
  const durationEpisodes = durationSignals
    .map((signal) => episodeFromDuration(key, signal))
    .filter((episode): episode is SleepEpisodeAnalysis => episode !== null)
    .filter(isMeaningfulEpisode)
    .filter((episode) => !stageEpisodes.some((stageEpisode) => episodesOverlap(stageEpisode, episode)))

  const episodes = [...stageEpisodes, ...durationEpisodes]
    .sort((a, b) => mainEpisodeRank(b) - mainEpisodeRank(a))

  const main = episodes.find(isMainEpisode) ?? null
  if (!main) return null

  const naps = episodes
    .filter((episode) => episode !== main)
    .filter(isMeaningfulEpisode)
  const napHours = naps.length > 0
    ? naps.reduce((sum, episode) => sum + Number(episode.asleepHours ?? 0), 0)
    : null

  return {
    ...main,
    napHours,
    napCount: naps.length,
    episodes,
  }
}

function isMeaningfulEpisode(episode: SleepEpisodeAnalysis): boolean {
  return hasMeaningfulSleepEpisode(episode.asleepHours)
}

function isMainEpisode(episode: SleepEpisodeAnalysis): boolean {
  return isMainSleepCandidate({
    asleepHours: episode.asleepHours,
    bedtime: episode.bedtime,
    wakeTime: episode.wakeTime,
  })
}

function groupStageIntervals(intervals: StageInterval[]): StageInterval[][] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end)
  const groups: StageInterval[][] = []
  let current: StageInterval[] = []
  let currentEnd = 0

  for (const interval of sorted) {
    if (current.length === 0 || interval.start - currentEnd <= EPISODE_GAP_MS) {
      current.push(interval)
      currentEnd = Math.max(currentEnd, interval.end)
      continue
    }

    groups.push(current)
    current = [interval]
    currentEnd = interval.end
  }

  if (current.length > 0) groups.push(current)
  return groups
}

function episodeFromStages(key: string, intervals: StageInterval[]): SleepEpisodeAnalysis {
  const allIntervals = intervals.map(({ start, end }) => ({ start, end }))
  const start = Math.min(...intervals.map((interval) => interval.start))
  const end = Math.max(...intervals.map((interval) => interval.end))
  const byStage: Record<SleepStageKey, SleepInterval[]> = {
    awake: [],
    rem: [],
    core: [],
    deep: [],
    asleep: [],
    inBed: [],
  }
  const typedAsleepIntervals: SleepInterval[] = []
  const asleepIntervals: SleepInterval[] = []

  for (const interval of intervals) {
    const plain = { start: interval.start, end: interval.end }
    byStage[interval.stage].push(plain)
    if (interval.stage === 'rem' || interval.stage === 'core' || interval.stage === 'deep') {
      typedAsleepIntervals.push(plain)
      asleepIntervals.push(plain)
    } else if (interval.stage === 'asleep') {
      asleepIntervals.push(plain)
    }
  }

  const asleepHours = unionDurationHours(asleepIntervals)
  const remHours = unionDurationHours(byStage.rem)
  const deepHours = unionDurationHours(byStage.deep)
  const coreHours = unionDurationHours(byStage.core)
  const awakeHours = unionDurationHours(byStage.awake)
  const unspecifiedHours = unionDurationHours(byStage.asleep)
  const inBedUnion = unionDurationHours(byStage.inBed)
  const observedInBed = sumDefined(asleepHours, awakeHours)
  const observedStageWindow = unionDurationHours(allIntervals)
  const inBedHours = inBedUnion ?? maxDefined([observedInBed, observedStageWindow])
  const efficiency = typeof asleepHours === 'number' && typeof inBedHours === 'number' && inBedHours > 0
    ? clamp((asleepHours / inBedHours) * 100, 0, 100)
    : null
  const typedAsleepHours = unionDurationHours(typedAsleepIntervals)
  const stageCoverage = typeof asleepHours === 'number' && asleepHours > 0
    ? clamp((typedAsleepHours ?? 0) / asleepHours, 0, 1)
    : null
  const firstAsleepStart = minStart(asleepIntervals)
  const lastAsleepEnd = maxEnd(asleepIntervals)
  const inBedStart = minStart([...byStage.inBed, ...byStage.awake].filter((interval) => (
    firstAsleepStart === null || interval.start <= firstAsleepStart
  ))) ?? start
  const latencyMinutes = firstAsleepStart !== null && inBedStart < firstAsleepStart
    ? Math.round((firstAsleepStart - inBedStart) / 60000)
    : null
  const awakeEpisodeCount = firstAsleepStart !== null && lastAsleepEnd !== null
    ? countAwakeEpisodes(byStage.awake, firstAsleepStart, lastAsleepEnd)
    : null
  const disturbanceCount = firstAsleepStart !== null && lastAsleepEnd !== null
    ? countDisturbances(byStage.awake, firstAsleepStart, lastAsleepEnd)
    : null
  const sleepCycleCount = countSleepCycles(byStage.rem)
  const dataQuality = sleepDataQuality({
    source: 'stages',
    stageCoverage,
    efficiency,
    latencyMinutes,
    awakeEpisodeCount,
    awakeHours,
  })

  return {
    key,
    asleepHours,
    inBedHours,
    efficiency,
    bedtime: firstAsleepStart !== null ? new Date(firstAsleepStart).toISOString() : new Date(start).toISOString(),
    wakeTime: new Date(end).toISOString(),
    inBedStartTime: new Date(inBedStart).toISOString(),
    remHours,
    deepHours,
    coreHours,
    awakeHours,
    unspecifiedHours,
    latencyMinutes,
    awakeEpisodeCount,
    disturbanceCount,
    sleepCycleCount,
    stageCoverage,
    dataQuality,
    dataQualityLabel: dataQualityLabel(dataQuality),
    captureStatus: dataQuality >= 0.78 ? 'complete' : 'partial',
    source: 'stages',
  }
}

function episodeFromDuration<T extends SleepAnalysisSignal>(
  key: string,
  signal: T,
): SleepEpisodeAnalysis | null {
  const asleepHours = typeof signal.value_numeric === 'number' && Number.isFinite(signal.value_numeric)
    ? Number(signal.value_numeric)
    : null
  if (asleepHours === null || asleepHours <= 0) return null

  const start = new Date(signal.started_at).getTime()
  const parsedEnd = new Date(signal.ended_at ?? signal.started_at).getTime()
  if (!Number.isFinite(start)) return null
  const end = Number.isFinite(parsedEnd) && parsedEnd > start
    ? parsedEnd
    : start + asleepHours * 3600000
  const spanHours = Math.max(0, (end - start) / 3600000)
  const inBedHours = spanHours > asleepHours + 0.05 ? spanHours : null
  const efficiency = inBedHours && inBedHours > 0
    ? clamp((asleepHours / inBedHours) * 100, 0, 100)
    : null
  const dataQuality = sleepDataQuality({ source: 'duration_only' })

  return {
    key,
    asleepHours,
    inBedHours,
    efficiency,
    bedtime: new Date(start).toISOString(),
    wakeTime: new Date(end).toISOString(),
    inBedStartTime: null,
    remHours: null,
    deepHours: null,
    coreHours: null,
    awakeHours: null,
    unspecifiedHours: null,
    latencyMinutes: null,
    awakeEpisodeCount: null,
    disturbanceCount: null,
    sleepCycleCount: null,
    stageCoverage: null,
    dataQuality,
    dataQualityLabel: dataQualityLabel(dataQuality),
    captureStatus: 'duration_only',
    source: 'duration_only',
  }
}

function stageInterval<T extends SleepAnalysisSignal>(signal: T): StageInterval | null {
  const stage = sleepStageKey(signal.value_numeric)
  const interval = signalInterval(signal)
  return stage && interval ? { ...interval, stage } : null
}

function sleepStageKey(value: number | null): SleepStageKey | null {
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

function countAwakeEpisodes(intervals: SleepInterval[], sleepStart: number, finalSleepEnd: number): number {
  const trimmed = intervals
    .map((interval) => ({
      start: Math.max(interval.start, sleepStart),
      end: Math.min(interval.end, finalSleepEnd),
    }))
    .filter((interval) => interval.end - interval.start >= MIN_AWAKE_EPISODE_MS)

  return mergeIntervals(trimmed).length
}

function countDisturbances(intervals: SleepInterval[], sleepStart: number, finalSleepEnd: number): number {
  const trimmed = intervals
    .map((interval) => ({
      start: Math.max(interval.start, sleepStart),
      end: Math.min(interval.end, finalSleepEnd),
    }))
    .filter((interval) => interval.end - interval.start >= MIN_DISTURBANCE_MS)

  return mergeIntervals(trimmed).length
}

function countSleepCycles(remIntervals: SleepInterval[]): number | null {
  const cycles = mergeIntervals(remIntervals).length
  return cycles > 0 ? cycles : null
}

function episodesOverlap(first: SleepEpisodeAnalysis, second: SleepEpisodeAnalysis): boolean {
  if (!first.bedtime || !first.wakeTime || !second.bedtime || !second.wakeTime) return false
  const firstInterval = {
    start: new Date(first.inBedStartTime ?? first.bedtime).getTime(),
    end: new Date(first.wakeTime).getTime(),
  }
  const secondInterval = {
    start: new Date(second.inBedStartTime ?? second.bedtime).getTime(),
    end: new Date(second.wakeTime).getTime(),
  }
  if (!Number.isFinite(firstInterval.start) || !Number.isFinite(firstInterval.end)) return false
  if (!Number.isFinite(secondInterval.start) || !Number.isFinite(secondInterval.end)) return false

  const overlap = Math.max(0, Math.min(firstInterval.end, secondInterval.end) - Math.max(firstInterval.start, secondInterval.start))
  const shorter = Math.min(firstInterval.end - firstInterval.start, secondInterval.end - secondInterval.start)
  return shorter > 0 && overlap / shorter >= 0.5
}

function mainEpisodeRank(episode: SleepEpisodeAnalysis): number {
  const asleep = episode.asleepHours ?? 0
  const wake = episode.wakeTime ? new Date(episode.wakeTime) : null
  const bedtime = episode.bedtime ? new Date(episode.bedtime) : null
  const wakeHour = wake ? wake.getHours() : 0
  const bedtimeHour = bedtime ? bedtime.getHours() : 0
  const nightBonus = wakeHour <= 12 || bedtimeHour >= 18 ? 1 : 0
  const qualityBonus = episode.source === 'stages' ? 0.2 : 0
  return asleep * 10 + nightBonus + qualityBonus
}

function sleepDataQuality(input: {
  source: 'stages' | 'duration_only'
  stageCoverage?: number | null
  efficiency?: number | null
  latencyMinutes?: number | null
  awakeEpisodeCount?: number | null
  awakeHours?: number | null
}): number {
  if (input.source === 'duration_only') return 0.35

  let score = 0.45
  score += (input.stageCoverage ?? 0) * 0.3
  if (typeof input.efficiency === 'number') score += 0.08
  if (typeof input.latencyMinutes === 'number') score += 0.07
  if (typeof input.awakeEpisodeCount === 'number') score += 0.05
  if (typeof input.awakeHours === 'number') score += 0.05
  return clamp(score, 0.25, 1)
}

function dataQualityLabel(value: number): 'alta' | 'parcial' | 'baixa' {
  if (value >= 0.75) return 'alta'
  if (value >= 0.45) return 'parcial'
  return 'baixa'
}

function isSleepSignal(signal: SleepAnalysisSignal): boolean {
  return signal.signal_type === 'sleep_duration_hours' || signal.signal_type === 'sleep_stage'
}

function sleepAnalysisWindow(key: string): { start: number; end: number } {
  const day = dateFromLocalKey(key) ?? new Date(key)
  const start = new Date(day)
  start.setDate(day.getDate() - 1)
  start.setHours(18, 0, 0, 0)
  const end = new Date(day)
  end.setDate(day.getDate() + 1)
  end.setHours(0, 0, 0, 0)
  return { start: start.getTime(), end: end.getTime() }
}

function signalInterval(signal: SleepAnalysisSignal): SleepInterval | null {
  const start = new Date(signal.started_at).getTime()
  const end = signalEndTime(signal)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return { start, end }
}

function signalEndTime(signal: SleepAnalysisSignal): number {
  return new Date(signal.ended_at ?? signal.started_at).getTime()
}

function unionDurationHours(intervals: SleepInterval[]): number | null {
  const merged = mergeIntervals(intervals)
  if (merged.length === 0) return null
  return merged.reduce((sum, interval) => sum + interval.end - interval.start, 0) / 3600000
}

function mergeIntervals(intervals: SleepInterval[]): SleepInterval[] {
  if (intervals.length === 0) return []
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)
  if (sorted.length === 0) return []

  const merged: SleepInterval[] = [{ ...sorted[0] }]
  for (const interval of sorted.slice(1)) {
    const last = merged[merged.length - 1]
    if (interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end)
      continue
    }
    merged.push({ ...interval })
  }

  return merged
}

function minStart(intervals: SleepInterval[]): number | null {
  return intervals.length > 0 ? Math.min(...intervals.map((interval) => interval.start)) : null
}

function maxEnd(intervals: SleepInterval[]): number | null {
  return intervals.length > 0 ? Math.max(...intervals.map((interval) => interval.end)) : null
}

function maxDefined(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  return present.length > 0 ? Math.max(...present) : null
}

function sumDefined(first: number | null, second: number | null): number | null {
  if (typeof first === 'number' && typeof second === 'number') return first + second
  return first ?? second
}

function localDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateFromLocalKey(key: string): Date | null {
  const [year, month, day] = key.split('-').map((part) => Number.parseInt(part, 10))
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
