export type MemoryHomeLoadState = 'loading' | 'ready' | 'unavailable'

export interface MemoryHomeReviewQueueSnapshot {
  total?: number | null
  counts?: Record<string, number> | null
  items?: Array<{ severity?: string | null }>
}

export interface MemoryHomeSummary {
  title: string
  detail: string
  doorwayValue: string
  pendingCount: number
  highPriorityCount: number
  state: MemoryHomeLoadState
}

export function buildMemoryHomeSummary(
  queue: MemoryHomeReviewQueueSnapshot | null,
  state: MemoryHomeLoadState = 'ready',
): MemoryHomeSummary {
  if (!queue && state === 'loading') {
    return {
      title: 'Memória e fila de revisão',
      detail: 'consultando registry · verbatim · relações',
      doorwayValue: 'carregando',
      pendingCount: 0,
      highPriorityCount: 0,
      state,
    }
  }

  if (!queue && state === 'unavailable') {
    return {
      title: 'Memória e fila de revisão',
      detail: 'status indisponível · abrir painel',
      doorwayValue: 'abrir',
      pendingCount: 0,
      highPriorityCount: 0,
      state,
    }
  }

  const pendingCount = nonNegativeInt(queue?.total ?? queue?.items?.length ?? 0)
  const highPriorityCount = (queue?.items ?? [])
    .filter((item) => ['high', 'critical'].includes(String(item.severity ?? '').toLowerCase()))
    .length

  if (pendingCount === 0) {
    return {
      title: 'Memória em dia',
      detail: 'registry · verbatim · privacidade sem pendência',
      doorwayValue: 'em dia',
      pendingCount,
      highPriorityCount,
      state: 'ready',
    }
  }

  return {
    title: `${pendingCount} ${plural(pendingCount, 'revisão', 'revisões')} de memória`,
    detail: pendingDetail(queue, highPriorityCount),
    doorwayValue: `${pendingCount} ${plural(pendingCount, 'pendente', 'pendentes')}`,
    pendingCount,
    highPriorityCount,
    state: 'ready',
  }
}

function pendingDetail(queue: MemoryHomeReviewQueueSnapshot | null, highPriorityCount: number): string {
  const counts = queue?.counts ?? {}
  const parts = [
    countLabel(counts.memory_privacy, 'registry'),
    countLabel(counts.verbatim_privacy, 'verbatim'),
    countLabel(counts.relation, 'relação', 'relações'),
  ].filter(Boolean)

  if (highPriorityCount > 0) {
    parts.unshift(`${highPriorityCount} alta prioridade`)
  }

  return parts.length > 0 ? parts.join(' · ') : 'abrir fila de revisão'
}

function countLabel(value: unknown, singular: string, pluralLabel = singular): string | null {
  const count = nonNegativeInt(value)
  if (count <= 0) return null

  return `${count} ${plural(count, singular, pluralLabel)}`
}

function plural(count: number, singular: string, pluralLabel: string): string {
  return count === 1 ? singular : pluralLabel
}

function nonNegativeInt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0

  return Math.max(0, Math.floor(value))
}
