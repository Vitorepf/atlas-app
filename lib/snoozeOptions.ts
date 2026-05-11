// Snooze options · canon mockup "Adiar para" · 3 opções fixas (amanhã / 7
// dias / 30 dias) com data calculada dinamicamente em PT-BR ("qua, 09.05").
//
// Vocabulário editorial: cada opção é "ato de adiamento", não "configurar
// notificação". Data calculada relativa ao chamador (now passado como arg)
// pra ser determinístico em testes.

import { localDateKey } from './atlasStore'

export type SnoozeKey = 'tomorrow' | 'week' | 'month'

export interface SnoozeOption {
  key: SnoozeKey
  label: string       // "amanhã", "7 dias", "30 dias"
  metaLabel: string   // "qua, 09.05" — DOW abrev + DD.MM
  /** ISO datetime · meio-dia local do dia alvo (12:00:00). */
  targetISO: string
  /** Data alvo (00:00 local) pra cálculo simples. */
  targetDate: Date
}

const DOW_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatMetaLabel(date: Date): string {
  const dow = DOW_SHORT[date.getDay()]!
  const dd = pad2(date.getDate())
  const mm = pad2(date.getMonth() + 1)
  return `${dow}, ${dd}.${mm}`
}

function startOfNoonLocal(base: Date, daysAhead: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + daysAhead)
  d.setHours(12, 0, 0, 0)
  return d
}

export function buildSnoozeOptions(now: Date = new Date()): SnoozeOption[] {
  const tomorrow = startOfNoonLocal(now, 1)
  const week = startOfNoonLocal(now, 7)
  const month = startOfNoonLocal(now, 30)
  return [
    {
      key: 'tomorrow',
      label: 'amanhã',
      metaLabel: formatMetaLabel(tomorrow),
      targetISO: tomorrow.toISOString(),
      targetDate: tomorrow,
    },
    {
      key: 'week',
      label: '7 dias',
      metaLabel: formatMetaLabel(week),
      targetISO: week.toISOString(),
      targetDate: week,
    },
    {
      key: 'month',
      label: '30 dias',
      metaLabel: formatMetaLabel(month),
      targetISO: month.toISOString(),
      targetDate: month,
    },
  ]
}

export function snoozeOptionByKey(key: SnoozeKey, now: Date = new Date()): SnoozeOption {
  const all = buildSnoozeOptions(now)
  return all.find((o) => o.key === key) ?? all[0]!
}

// Helper · localDateKey wrapper pra match calls existentes
export function snoozeDateKey(option: SnoozeOption): string {
  return localDateKey(option.targetDate)
}
