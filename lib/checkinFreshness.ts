export const CHECKIN_LEVEL_TTL_HOURS = 12
export const CHECKIN_STATE_TTL_HOURS = 6
export const CHECKIN_CLOCK_SKEW_MINUTES = 5

type CheckinTimestamp = {
  recorded_at: string
}

export function checkinAgeHours(checkin: CheckinTimestamp | null, now = new Date()): number | null {
  if (!checkin) return null
  const recordedAt = new Date(checkin.recorded_at).getTime()
  if (!Number.isFinite(recordedAt)) return null
  if (recordedAt - now.getTime() > CHECKIN_CLOCK_SKEW_MINUTES * 60000) return null
  return Math.max(0, (now.getTime() - recordedAt) / 3600000)
}

export function checkinLevelFreshness(checkin: CheckinTimestamp | null, now = new Date()): number {
  const ageHours = checkinAgeHours(checkin, now)
  return ageHours === null || ageHours > CHECKIN_LEVEL_TTL_HOURS ? 0 : Math.pow(0.5, ageHours / 8)
}

export function checkinStateFreshness(checkin: CheckinTimestamp | null, now = new Date()): number {
  const ageHours = checkinAgeHours(checkin, now)
  return ageHours === null || ageHours > CHECKIN_STATE_TTL_HOURS ? 0 : Math.pow(0.5, ageHours / 3)
}

export function isCheckinLevelFresh(checkin: CheckinTimestamp | null, now = new Date()): boolean {
  return checkinLevelFreshness(checkin, now) > 0
}

export function isCheckinStateFresh(checkin: CheckinTimestamp | null, now = new Date()): boolean {
  return checkinStateFreshness(checkin, now) > 0
}
