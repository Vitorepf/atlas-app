/**
 * Atlas compute effort canon.
 *
 * Shared by Desktop Atlas AI, Desktop Atlas Code and Mobile Atlas AI so the
 * operator-facing selector emits the same contract everywhere. `auto` is a UI
 * choice only: the backend receives no forced effort level and Atlas Decide
 * remains sovereign.
 */

export type AtlasComputeEffortLevel = 'fast' | 'balanced' | 'deep' | 'max'
export type AtlasComputeEffortChoice = 'auto' | AtlasComputeEffortLevel

export const ATLAS_COMPUTE_EFFORT_LEVELS = ['fast', 'balanced', 'deep', 'max'] as const

export const ATLAS_COMPUTE_EFFORT_CHOICES = ['auto', ...ATLAS_COMPUTE_EFFORT_LEVELS] as const

export const ATLAS_COMPUTE_EFFORT_OPTIONS: ReadonlyArray<{
  value: AtlasComputeEffortChoice
  label: string
  shortLabel: string
  sub: string
}> = [
  {
    value: 'auto',
    label: 'Auto (Atlas Decide)',
    shortLabel: 'auto',
    sub: 'Atlas escolhe esforço por tarefa, domínio, orçamento e evidência',
  },
  {
    value: 'fast',
    label: 'Rápido',
    shortLabel: 'rápido',
    sub: 'menor latência e custo para tarefas simples',
  },
  {
    value: 'balanced',
    label: 'Equilibrado',
    shortLabel: 'normal',
    sub: 'bom equilíbrio entre velocidade, custo e profundidade',
  },
  {
    value: 'deep',
    label: 'Profundo',
    shortLabel: 'profundo',
    sub: 'mais raciocínio para programação, pesquisa ou análise difíceis',
  },
  {
    value: 'max',
    label: 'Máximo',
    shortLabel: 'máximo',
    sub: 'maior esforço permitido pela política do Atlas',
  },
] as const

const CHOICE_SET = new Set<string>(ATLAS_COMPUTE_EFFORT_CHOICES)

export function isAtlasComputeEffortChoice(value: unknown): value is AtlasComputeEffortChoice {
  return typeof value === 'string' && CHOICE_SET.has(value)
}

export function normalizeAtlasComputeEffort(value: unknown): AtlasComputeEffortChoice {
  if (isAtlasComputeEffortChoice(value)) return value
  if (typeof value !== 'string') return 'auto'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'quick' || normalized === 'low') return 'fast'
  if (normalized === 'normal' || normalized === 'medium') return 'balanced'
  if (normalized === 'high' || normalized === 'think' || normalized === 'thinking') return 'deep'
  if (normalized === 'xhigh' || normalized === 'maximum' || normalized === 'ultra') return 'max'
  return isAtlasComputeEffortChoice(normalized) ? normalized : 'auto'
}

export function atlasComputeEffortForPayload(
  value: unknown,
): AtlasComputeEffortLevel | undefined {
  const normalized = normalizeAtlasComputeEffort(value)
  return normalized === 'auto' ? undefined : normalized
}

export function labelAtlasComputeEffortShort(value: unknown): string {
  const normalized = normalizeAtlasComputeEffort(value)
  return ATLAS_COMPUTE_EFFORT_OPTIONS.find((option) => option.value === normalized)?.shortLabel ?? 'auto'
}

export function labelAtlasComputeEffort(value: unknown): string {
  const normalized = normalizeAtlasComputeEffort(value)
  return ATLAS_COMPUTE_EFFORT_OPTIONS.find((option) => option.value === normalized)?.label ?? 'Auto (Atlas Decide)'
}

export function nextAtlasComputeEffort(value: unknown): AtlasComputeEffortChoice {
  const normalized = normalizeAtlasComputeEffort(value)
  const currentIndex = ATLAS_COMPUTE_EFFORT_CHOICES.indexOf(normalized)
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % ATLAS_COMPUTE_EFFORT_CHOICES.length
  return ATLAS_COMPUTE_EFFORT_CHOICES[nextIndex]
}
