// Insights operacionais da Agenda · métricas do mês corrente.
// Vocabulário enterprise editorial: tabela mono caps com counts/labels que
// sintetizam a "saúde do mês" — atos planejados, completados, marcos
// futuros, dias úteis livres. Substitui dashboards SaaS por TOC dot-leader.

import type { AtlasAgendaTask } from './api/client'
import type { Holiday } from './holidays-br'
import type { AtlasMilestone } from './atlasMilestones'
import { isMajorTask } from './agenda'

export interface MonthInsights {
  /** Total de dias do mês (28-31). */
  daysTotal: number
  /** Dias passados (incluindo hoje). */
  daysPast: number
  /** Dias restantes a partir de amanhã. */
  daysRemaining: number
  /** Tasks com `planned_for_date` ou `recommended_start_at` no mês. */
  tasksPlanned: number
  /** Tasks com `completed_at` definido. */
  tasksCompleted: number
  /** Tasks abertas (no mês, ainda sem completed_at). */
  tasksOpen: number
  /** Major events futuros do mês (priority urgent + datas futuras). */
  majorEventsAhead: number
  /** Marcos do projeto Atlas no mês. */
  milestonesInMonth: number
  /** Marcos futuros do mês. */
  milestonesAhead: number
  /** Feriados nacionais no mês. */
  holidaysInMonth: number
  /** Feriados nacionais futuros do mês. */
  holidaysAhead: number
}

interface ComputeArgs {
  month: Date
  today: Date
  tasks: AtlasAgendaTask[]
  milestones: AtlasMilestone[]
  holidays: Holiday[]
}

export function computeMonthInsights({ month, today, tasks, milestones, holidays }: ComputeArgs): MonthInsights {
  const year = month.getFullYear()
  const monthIdx = month.getMonth()
  const lastDay = new Date(year, monthIdx + 1, 0).getDate()
  const todayDay = sameMonth(today, year, monthIdx) ? today.getDate() : monthIdx < today.getMonth() || year < today.getFullYear() ? lastDay : 0

  // Tasks do mês corrente
  const monthTasks = tasks.filter((t) => taskBelongsToMonth(t, year, monthIdx))
  const completed = monthTasks.filter((t) => Boolean(t.completed_at))
  const open = monthTasks.filter((t) => !t.completed_at)

  // Major events futuros (>= hoje)
  const cutoff = new Date(today); cutoff.setHours(0, 0, 0, 0)
  const majorAhead = monthTasks.filter((t) => {
    if (!isMajorTask(t)) return false
    const iso = t.recommended_start_at ?? t.planned_start_at ?? t.planned_for_date
    if (!iso) return false
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return false
    return d >= cutoff
  })

  const monthMilestones = milestones.filter((m) => sameMonth(m.date, year, monthIdx))
  const milestonesAhead = monthMilestones.filter((m) => m.date >= cutoff)

  const nationalHolidays = holidays.filter(
    (h) => h.kind === 'national' && sameMonth(h.date, year, monthIdx),
  )
  const nationalHolidaysAhead = nationalHolidays.filter((h) => h.date >= cutoff)

  return {
    daysTotal: lastDay,
    daysPast: todayDay,
    daysRemaining: Math.max(0, lastDay - todayDay),
    tasksPlanned: monthTasks.length,
    tasksCompleted: completed.length,
    tasksOpen: open.length,
    majorEventsAhead: majorAhead.length,
    milestonesInMonth: monthMilestones.length,
    milestonesAhead: milestonesAhead.length,
    holidaysInMonth: nationalHolidays.length,
    holidaysAhead: nationalHolidaysAhead.length,
  }
}

function sameMonth(date: Date, year: number, monthIdx: number): boolean {
  return date.getFullYear() === year && date.getMonth() === monthIdx
}

function taskBelongsToMonth(task: AtlasAgendaTask, year: number, monthIdx: number): boolean {
  const iso = task.planned_for_date ?? task.planned_start_at ?? task.recommended_start_at
  if (!iso) return false
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  return sameMonth(d, year, monthIdx)
}
