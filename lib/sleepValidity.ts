export const MIN_SLEEP_EPISODE_HOURS = 0.25
export const MIN_MAIN_SLEEP_HOURS = 1.5

const LONG_SLEEP_MAIN_HOURS = 4
const MAIN_WAKE_START_MINUTES = 3 * 60
const MAIN_WAKE_END_MINUTES = 14 * 60
const MAIN_BEDTIME_START_MINUTES = 21 * 60
const MAIN_BEDTIME_END_MINUTES = 5 * 60

export interface MainSleepCandidate {
  asleepHours?: number | null
  bedtime?: string | null
  wakeTime?: string | null
}

export function hasMeaningfulSleepEpisode(hours?: number | null): boolean {
  return typeof hours === 'number'
    && Number.isFinite(hours)
    && hours >= MIN_SLEEP_EPISODE_HOURS
}

export function isMainSleepCandidate(input: MainSleepCandidate): boolean {
  const asleepHours = input.asleepHours
  if (typeof asleepHours !== 'number' || !Number.isFinite(asleepHours) || asleepHours < MIN_MAIN_SLEEP_HOURS) {
    return false
  }

  if (asleepHours >= LONG_SLEEP_MAIN_HOURS) return true

  const wakeMinute = input.wakeTime ? localClockMinute(input.wakeTime) : null
  const bedtimeMinute = input.bedtime ? localClockMinute(input.bedtime) : null
  const hasNightBedtime = typeof bedtimeMinute === 'number'
    && (bedtimeMinute >= MAIN_BEDTIME_START_MINUTES || bedtimeMinute <= MAIN_BEDTIME_END_MINUTES)
  const hasMorningWake = typeof wakeMinute === 'number'
    && wakeMinute >= MAIN_WAKE_START_MINUTES
    && wakeMinute <= MAIN_WAKE_END_MINUTES

  return hasNightBedtime && hasMorningWake
}

function localClockMinute(iso: string): number | null {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return null
  return date.getHours() * 60 + date.getMinutes()
}
