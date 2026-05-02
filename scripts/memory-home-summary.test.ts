import assert from 'node:assert/strict'
import { buildMemoryHomeSummary } from '../lib/memoryHomeSummary'

assert.deepEqual(buildMemoryHomeSummary(null, 'loading'), {
  title: 'Memória e fila de revisão',
  detail: 'consultando registry · verbatim · relações',
  doorwayValue: 'carregando',
  pendingCount: 0,
  highPriorityCount: 0,
  state: 'loading',
})

assert.deepEqual(buildMemoryHomeSummary(null, 'unavailable'), {
  title: 'Memória e fila de revisão',
  detail: 'status indisponível · abrir painel',
  doorwayValue: 'abrir',
  pendingCount: 0,
  highPriorityCount: 0,
  state: 'unavailable',
})

assert.deepEqual(buildMemoryHomeSummary({ total: 0, counts: {}, items: [] }), {
  title: 'Memória em dia',
  detail: 'registry · verbatim · privacidade sem pendência',
  doorwayValue: 'em dia',
  pendingCount: 0,
  highPriorityCount: 0,
  state: 'ready',
})

assert.deepEqual(buildMemoryHomeSummary({
  total: 4,
  counts: {
    memory_privacy: 2,
    verbatim_privacy: 1,
    relation: 1,
  },
  items: [
    { severity: 'high' },
    { severity: 'medium' },
    { severity: 'critical' },
  ],
}), {
  title: '4 revisões de memória',
  detail: '2 alta prioridade · 2 registry · 1 verbatim · 1 relação',
  doorwayValue: '4 pendentes',
  pendingCount: 4,
  highPriorityCount: 2,
  state: 'ready',
})

assert.deepEqual(buildMemoryHomeSummary({
  total: 1,
  counts: { relation: 1 },
  items: [{ severity: 'low' }],
}), {
  title: '1 revisão de memória',
  detail: '1 relação',
  doorwayValue: '1 pendente',
  pendingCount: 1,
  highPriorityCount: 0,
  state: 'ready',
})

console.log('memory home summary tests passed')
