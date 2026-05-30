// Atlas Loop · pure formatting helpers (no fetch, no state).
//
// Relative timestamps recompute on LOAD only (mirrors engineering.tsx) — there
// is no live ticker. These never fabricate: a missing/invalid input yields a
// calm em-dash, never a guessed value.

/** Short hash · first 8 chars (audit signature). Empty -> ''. */
export function shortHash(hash: string | null | undefined, len = 8): string {
  const s = String(hash ?? '').trim()
  return s === '' ? '' : s.slice(0, len)
}

/** Short merge hash · first 7 chars, no '#' prefix. */
export function shortMergeHash(hash: string | null | undefined): string {
  return shortHash(hash, 7)
}

/**
 * Relative time from an ISO/atom string to `now` (computed at call time).
 * "há 38s" / "há 12m" / "há 3h" / "há 2d". Returns '—' for missing/invalid.
 */
export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  const ms = parseMs(iso)
  if (ms === null) return '—'
  const diff = Math.max(0, now.getTime() - ms)
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `há ${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `há ${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `há ${hr}h`
  const day = Math.floor(hr / 24)
  return `há ${day}d`
}

/** Absolute, terse local time "14:08" for stale-callout honesty. */
export function absoluteTime(iso: string | null | undefined): string {
  const ms = parseMs(iso)
  if (ms === null) return '—'
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * Compact uptime from an acquired_at to now: "12h 04m" / "04m" / "38s".
 * Returns null when there is no real holder timestamp (caller shows "sem run").
 */
export function uptimeSince(iso: string | null | undefined, now: Date = new Date()): string | null {
  const ms = parseMs(iso)
  if (ms === null) return null
  const diff = Math.max(0, now.getTime() - ms)
  const totalMin = Math.floor(diff / 60000)
  const hr = Math.floor(totalMin / 60)
  const min = totalMin % 60
  if (hr > 0) return `${hr}h ${String(min).padStart(2, '0')}m`
  if (min > 0) return `${min}m`
  const sec = Math.floor(diff / 1000)
  return `${sec}s`
}

/** Milliseconds since epoch from a value, or null when unparseable. */
function parseMs(iso: string | null | undefined): number | null {
  if (iso == null) return null
  const s = String(iso).trim()
  if (s === '') return null
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : t
}
