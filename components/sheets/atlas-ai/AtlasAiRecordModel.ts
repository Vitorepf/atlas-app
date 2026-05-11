export function stringFromRecord(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null
  const next = (value as Record<string, unknown>)[key]
  return typeof next === 'string' && next.trim().length > 0 ? next.trim() : null
}

export function numberFromRecord(value: unknown, key: string): number | null {
  if (!value || typeof value !== 'object') return null
  const next = (value as Record<string, unknown>)[key]
  return typeof next === 'number' && Number.isFinite(next) ? next : null
}
