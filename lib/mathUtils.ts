// Shared numeric helpers. Extracted from 9 identical private copies across the
// health/sleep/screen-time modules (runbook S-A5).

/** Constrain `value` to the inclusive [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
