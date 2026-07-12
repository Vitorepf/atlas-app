// Canonical short relative-time label ("agora / 5 min / 2 h / 3 d").
// Extracted from 5 private copies in the atlas-ai sheets (runbook S-A3).
// AtlasAiContinuityPanel previously diverged ("há N min", >14d date fallback,
// "sem data") — it now adopts this majority format (audit §6.5).
//
// `now` is injectable so the branches are testable without mocking the clock.
export function formatRelative(value: string | null | undefined, now: number = Date.now()): string {
  if (!value) return 'agora'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const diff = now - date.getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.round(hours / 24)
  return `${days} d`
}
