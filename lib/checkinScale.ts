export const MOOD_LEVELS = [
  { value: 1, label: 'Muito ruim' },
  { value: 2, label: 'Ruim' },
  { value: 3, label: 'Normal' },
  { value: 4, label: 'Bom' },
  { value: 5, label: 'Muito bom' },
] as const

export function moodLevelLabel(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  return MOOD_LEVELS.find((level) => level.value === rounded)?.label ?? null
}
