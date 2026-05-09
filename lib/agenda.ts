// Helpers da Agenda · formatação de tempo, agrupamento por dia, derivação
// de estado dos eventos. Toda lógica de derivação visual (past/next/major)
// vive aqui pra `app/agenda.tsx` ficar declarativo.
//
// Princípio nunca-mock: dados reais vêm de `listTaskAgenda` da API. Quando
// um campo do design canon não existe no schema atual (location, holiday,
// efemerides), os helpers retornam null/vazio — componentes renderizam
// silente sem fake. Ver feedback_atlas_no_mock.md.

import type { AtlasAgendaTask } from './api/client'
import { localDateKey } from './atlasStore'
import type { Holiday } from './holidays-br'
import type { AtlasMilestone } from './atlasMilestones'

// =====================================================================
// TIME FORMATTING
// =====================================================================

const pad2 = (n: number): string => String(n).padStart(2, '0')

// "15.00" — Atlas usa ponto separador editorial em vez de dois pontos
// (vocabulário Patek/Aldine vs SaaS digital "15:00").
export function formatHourMinute(date: Date): string {
  return `${pad2(date.getHours())}.${pad2(date.getMinutes())}`
}

// "15.00 — 16.00" — em-dash entre start e end. Pra agenda-event-time.
export function formatTimeRange(startISO: string | null, endISO: string | null): string | null {
  if (!startISO) return null
  const start = new Date(startISO)
  if (Number.isNaN(start.getTime())) return null
  if (!endISO) return formatHourMinute(start)
  const end = new Date(endISO)
  if (Number.isNaN(end.getTime())) return formatHourMinute(start)
  return `${formatHourMinute(start)} — ${formatHourMinute(end)}`
}

// "60min" — duração compacta. Pra meta-line.
export function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes <= 0) return null
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const rem = minutes - hours * 60
  if (rem === 0) return `${hours}h`
  return `${hours}h${pad2(rem)}`
}

// "em 28 minutos" / "em 1 hora" / "em 2 horas e 15 minutos" / null se passou.
// Anchor temporal pro AgendaNow eyebrow.
export function formatRelativeFuture(targetISO: string | null, now: Date = new Date()): string | null {
  if (!targetISO) return null
  const target = new Date(targetISO)
  if (Number.isNaN(target.getTime())) return null
  const diffMs = target.getTime() - now.getTime()
  if (diffMs <= 0) return null
  const minutes = Math.round(diffMs / 60000)
  if (minutes < 1) return 'em instantes'
  if (minutes < 60) return `em ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
  const hours = Math.floor(minutes / 60)
  const rem = minutes - hours * 60
  if (rem === 0) return `em ${hours} ${hours === 1 ? 'hora' : 'horas'}`
  return `em ${hours}h${pad2(rem)}`
}

// "agora · 14.32" — label da régua AGORA na timeline.
export function currentTimeLabel(now: Date = new Date()): string {
  return `agora · ${formatHourMinute(now)}`
}

// =====================================================================
// EVENT STATE DERIVATION
// =====================================================================

export type EventState = 'past' | 'next' | 'normal'

// Determina state visual do evento na timeline:
//   - past: já terminou (recommended_end_at < now) OU completed_at presente
//   - next: o PRÓXIMO evento futuro (calculado em buildTimeline, não isolado)
//   - normal: futuro que não é o próximo
export function isPastEvent(task: AtlasAgendaTask, now: Date = new Date()): boolean {
  if (task.completed_at) return true
  const endISO = task.recommended_end_at ?? task.planned_end_at
  if (!endISO) return false
  const end = new Date(endISO)
  if (Number.isNaN(end.getTime())) return false
  return end.getTime() < now.getTime()
}

export function eventStartTime(task: AtlasAgendaTask): Date | null {
  const startISO = task.recommended_start_at ?? task.planned_start_at
  if (!startISO) return null
  const start = new Date(startISO)
  if (Number.isNaN(start.getTime())) return null
  return start
}

// Marker de "major event" — viagens, marcos, eventos com peso narrativo.
// Heurística atual: priority === 'urgent'. TODO(schema): adicionar campo
// `is_major: boolean` ou tag dedicada quando backend evoluir.
export function isMajorTask(task: AtlasAgendaTask): boolean {
  return task.priority === 'urgent'
}

// =====================================================================
// GROUPING / TIMELINE
// =====================================================================

export interface TimelineEntry {
  kind: 'event' | 'now-marker'
  task?: AtlasAgendaTask
  state?: EventState
}

// Constrói timeline ordenada do dia com a régua AGORA inserida na posição
// cronológica correta entre passados e próximos. Marca o primeiro evento
// futuro como `next` (pra ganhar border-left bronze).
export function buildTimeline(
  tasks: AtlasAgendaTask[],
  now: Date = new Date(),
): TimelineEntry[] {
  const sorted = [...tasks]
    .filter((t) => eventStartTime(t) !== null)
    .sort((a, b) => {
      const aStart = eventStartTime(a)!.getTime()
      const bStart = eventStartTime(b)!.getTime()
      return aStart - bStart
    })

  const entries: TimelineEntry[] = []
  let nowMarkerInserted = false
  let nextMarked = false

  for (const task of sorted) {
    const start = eventStartTime(task)!
    if (!nowMarkerInserted && start.getTime() > now.getTime()) {
      entries.push({ kind: 'now-marker' })
      nowMarkerInserted = true
    }
    const past = isPastEvent(task, now)
    let state: EventState = 'normal'
    if (past) state = 'past'
    else if (!nextMarked) {
      state = 'next'
      nextMarked = true
    }
    entries.push({ kind: 'event', task, state })
  }

  // Caso todos os eventos sejam passados, ainda mostra a régua no final.
  if (!nowMarkerInserted && sorted.length > 0) {
    entries.push({ kind: 'now-marker' })
  }

  return entries
}

// Encontra o "próximo compromisso" — primeiro evento futuro (não passado).
// Usado pelo AgendaNow.
export function findNextTask(tasks: AtlasAgendaTask[], now: Date = new Date()): AtlasAgendaTask | null {
  const futureSorted = [...tasks]
    .filter((t) => {
      const start = eventStartTime(t)
      return start !== null && start.getTime() > now.getTime()
    })
    .sort((a, b) => eventStartTime(a)!.getTime() - eventStartTime(b)!.getTime())
  return futureSorted[0] ?? null
}

// =====================================================================
// CINTA SEMANAL (7 dias seg-dom da semana corrente)
// =====================================================================

export interface WeekDay {
  date: Date
  dateKey: string  // YYYY-MM-DD
  dow: string      // "seg", "ter", ..., "dom"
  num: number      // 1-31
  isPast: boolean
  isToday: boolean
  isWeekend: boolean
  taskCount: number  // pra mostrar dots (cap em 3)
  /** Há milestone do Atlas neste dia · vira dot bronze accent na cinta. */
  hasMilestone: boolean
  /** Há feriado nacional neste dia · vira dot bronze accent na cinta. */
  hasHoliday: boolean
}

// pt-BR weekday short — getDay() retorna 0=dom, 1=seg, ..., 6=sáb.
// Atlas mostra ordem seg-dom (week-start segunda).
const DOW_LABELS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  // getDay: 0=dom..6=sáb. Pra começar na seg, deslocar pra trás:
  //   se hoje é seg, deslocamento 0; se dom, 6; se ter, 1; etc.
  const dayOfWeek = d.getDay()
  const shift = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  d.setDate(d.getDate() - shift)
  return d
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return localDateKey(a) === localDateKey(b)
}

export function buildWeekStrip(
  tasksByDay: Map<string, AtlasAgendaTask[]>,
  today: Date = new Date(),
  holidays?: Map<string, Holiday> | null,
  milestones?: Map<string, AtlasMilestone> | null,
): WeekDay[] {
  const start = startOfWeekMonday(today)
  const todayKey = localDateKey(today)
  const days: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(start)
    date.setDate(start.getDate() + i)
    const dateKey = localDateKey(date)
    const dow = DOW_LABELS[date.getDay()]!
    const isToday = dateKey === todayKey
    const holiday = holidays?.get(dateKey) ?? null
    const milestone = milestones?.get(dateKey) ?? null
    days.push({
      date,
      dateKey,
      dow,
      num: date.getDate(),
      isPast: !isToday && date < today,
      isToday,
      isWeekend: date.getDay() === 0 || date.getDay() === 6,
      taskCount: tasksByDay.get(dateKey)?.length ?? 0,
      hasMilestone: milestone !== null,
      hasHoliday: holiday !== null && holiday.kind === 'national',
    })
  }
  return days
}

// =====================================================================
// HORIZONTE (próximos 7 dias após hoje · vista Hoje · iv. Horizonte)
// =====================================================================

export interface HorizonDay {
  date: Date
  dayLabel: string  // "dom 11", "seg 12", ...
  meta: string      // "3 atos", "livre", "São Paulo · congresso", "Atlas · 1 mês"
  isMajor: boolean
  isEmpty: boolean
  /** Origem do meta: task agenda · milestone do Atlas · feriado nacional. */
  source: 'task' | 'milestone' | 'holiday' | 'none'
}

// Gera resumo de meta a partir de tasks do dia. Quando `tasks` é vazio,
// retorna "livre" — palavra positiva validada pelo Vitor (ver
// feedback_atlas_tdah_design.md).
function summarizeDayMeta(tasks: AtlasAgendaTask[]): { meta: string; isMajor: boolean; isEmpty: boolean } {
  if (tasks.length === 0) {
    return { meta: 'livre', isMajor: false, isEmpty: true }
  }
  const major = tasks.find(isMajorTask)
  if (major) {
    return { meta: major.title, isMajor: true, isEmpty: false }
  }
  const count = tasks.length
  return {
    meta: count === 1 ? '1 ato' : `${count} atos`,
    isMajor: false,
    isEmpty: false,
  }
}

const DOW_HORIZON: Record<number, string> = {
  0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sáb',
}

export function buildHorizonDays(
  tasksByDay: Map<string, AtlasAgendaTask[]>,
  today: Date = new Date(),
  count: number = 7,
  holidays?: Map<string, Holiday> | null,
  milestones?: Map<string, AtlasMilestone> | null,
): HorizonDay[] {
  const days: HorizonDay[] = []
  for (let i = 1; i <= count; i++) {
    const date = new Date(today)
    date.setDate(today.getDate() + i)
    date.setHours(0, 0, 0, 0)
    const dateKey = localDateKey(date)
    const tasks = tasksByDay.get(dateKey) ?? []
    const summary = summarizeDayMeta(tasks)
    const dow = DOW_HORIZON[date.getDay()]!
    const milestone = milestones?.get(dateKey) ?? null
    const holiday = holidays?.get(dateKey) ?? null

    // Hierarquia editorial:
    //   1. Major task real → vence (peso narrativo do compromisso)
    //   2. Milestone do Atlas → quando dia vazio (sem tasks normais)
    //   3. Holiday national → quando dia vazio
    //   4. Tasks normais → "N atos"
    //   5. Vazio → "livre"
    let meta = summary.meta
    let isMajor = summary.isMajor
    let isEmpty = summary.isEmpty
    let source: HorizonDay['source'] = isEmpty ? 'none' : 'task'
    if (!isMajor && summary.isEmpty && milestone) {
      meta = milestone.label
      isMajor = true
      isEmpty = false
      source = 'milestone'
    } else if (!isMajor && summary.isEmpty && holiday && holiday.kind === 'national') {
      meta = holiday.name
      isMajor = true
      isEmpty = false
      source = 'holiday'
    }

    days.push({
      date,
      dayLabel: `${dow} ${date.getDate()}`,
      meta,
      isMajor,
      isEmpty,
      source,
    })
  }
  return days
}

// =====================================================================
// VISTA MÊS · TOC LINEAR (semanas · cada dia uma row)
// =====================================================================

export type MonthDayState = 'past' | 'today' | 'major' | 'milestone' | 'holiday' | 'empty' | 'normal'

export interface MonthDay {
  date: Date
  num: number       // 1-31
  dow: string       // "seg", "ter", ...
  meta: string      // "2 atos", "livre", title de major event, ou label do milestone
  state: MonthDayState
  isWeekend: boolean
  isEmpty: boolean  // pra .empty class (livre/descanso)
  isToday: boolean
  isMajor: boolean
  /** Marco do projeto Atlas (fundação, aniversário, marco numérico).
   *  Quando presente, vira o `meta` em bronze + state 'milestone'. */
  milestone?: AtlasMilestone | null
  /** Feriado nacional ou marco cultural · renderizado como marginalia
   *  italic ink3 small (segunda linha do day-row). */
  holiday?: Holiday | null
}

export interface MonthWeek {
  days: MonthDay[]
}

function isWeekend(date: Date): boolean {
  const d = date.getDay()
  return d === 0 || d === 6
}

export function buildMonthMatrix(
  month: Date,
  tasksByDay: Map<string, AtlasAgendaTask[]>,
  today: Date = new Date(),
  holidays?: Map<string, Holiday> | null,
  milestones?: Map<string, AtlasMilestone> | null,
): MonthWeek[] {
  const year = month.getFullYear()
  const monthIdx = month.getMonth()
  const todayKey = localDateKey(today)
  const todayMidnight = new Date(today); todayMidnight.setHours(0,0,0,0)

  // Quantos dias o mês tem
  const lastDay = new Date(year, monthIdx + 1, 0).getDate()

  const allDays: MonthDay[] = []
  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(year, monthIdx, day)
    const dateKey = localDateKey(date)
    const dow = DOW_HORIZON[date.getDay()]!
    const tasks = tasksByDay.get(dateKey) ?? []
    const summary = summarizeDayMeta(tasks)
    const isToday = dateKey === todayKey
    const isPast = date < todayMidnight && !isToday
    const isWknd = isWeekend(date)
    const milestone = milestones?.get(dateKey) ?? null
    const holiday = holidays?.get(dateKey) ?? null

    // Hierarquia de meta:
    //   1. Major task real → vence sempre (peso narrativo do compromisso)
    //   2. Milestone do Atlas (fundação > aniv-anual > marco-num > aniv-mensal)
    //   3. Holiday national (somente se sem tasks · vira o meta principal)
    //   4. Tasks normais → "N atos"
    //   5. Vazio → "livre"
    let meta = summary.meta
    let isMajor = summary.isMajor
    let isMilestone = false
    let isHolidayMeta = false
    if (milestone && !isMajor) {
      meta = milestone.label
      isMilestone = true
    } else if (holiday && holiday.kind === 'national' && summary.isEmpty) {
      meta = holiday.name
      isHolidayMeta = true
    }

    let state: MonthDayState = 'normal'
    if (isToday) state = 'today'
    else if (isMajor) state = 'major'
    else if (isMilestone) state = 'milestone'
    else if (isHolidayMeta) state = 'holiday'
    else if (summary.isEmpty) state = 'empty'
    else if (isPast) state = 'past'

    allDays.push({
      date,
      num: day,
      dow,
      meta,
      state,
      isWeekend: isWknd,
      // Quando o meta foi substituído por milestone/holiday, o dia já não
      // é "vazio" pro contraste editorial — tem peso narrativo próprio.
      isEmpty: summary.isEmpty && !isMilestone && !isHolidayMeta,
      isToday,
      isMajor,
      milestone: isMilestone ? milestone : null,
      // Holiday segue como marginalia se não foi o meta principal (ou seja,
      // dia tem tasks/milestone E feriado · ambos importam).
      holiday: isHolidayMeta ? null : holiday,
    })
  }

  // Agrupa em semanas (semana começa na segunda).
  const weeks: MonthWeek[] = []
  let currentWeek: MonthDay[] = []

  for (const d of allDays) {
    const dayOfWeek = d.date.getDay() // 0=dom..6=sáb
    // segunda inicia nova semana, exceto na primeira iteração (ainda vazia).
    if (dayOfWeek === 1 && currentWeek.length > 0) {
      weeks.push({ days: currentWeek })
      currentWeek = []
    }
    currentWeek.push(d)
  }
  if (currentWeek.length > 0) weeks.push({ days: currentWeek })

  return weeks
}

// =====================================================================
// AGRUPAMENTO POR DIA
// =====================================================================

export function groupTasksByDay(tasks: AtlasAgendaTask[]): Map<string, AtlasAgendaTask[]> {
  const map = new Map<string, AtlasAgendaTask[]>()
  for (const task of tasks) {
    const startISO = task.recommended_start_at ?? task.planned_start_at ?? task.planned_for_date
    if (!startISO) continue
    const start = new Date(startISO)
    if (Number.isNaN(start.getTime())) continue
    const key = localDateKey(start)
    const arr = map.get(key)
    if (arr) arr.push(task)
    else map.set(key, [task])
  }
  return map
}

// =====================================================================
// EFEMÉRIDES (marcos do mês · vista Hoje · v. Efemérides)
// =====================================================================
//
// Combina três fontes:
//   1. Tasks `priority: 'urgent'` do mês corrente (heurística enquanto
//      schema não tem campo `is_major`)
//   2. Milestones do Atlas (fundação, aniversários, marcos numéricos)
//   3. Feriados nacionais (kind: 'national')
//
// Ordenado cronologicamente. Vista Hoje mostra somente marcos FUTUROS
// no mês corrente (já passou perdeu relevância · TDAH foco no presente).

export type EphemerisKind = 'task-major' | 'milestone' | 'holiday'

export interface Ephemeris {
  date: Date
  whenLabel: string  // "14.05"
  what: string       // "São Paulo · congresso", "Atlas · fundação", "Dia do Trabalho"
  kind: EphemerisKind
}

interface BuildEphemeridesArgs {
  /** Tasks pré-carregadas (qualquer range — função filtra futureOnly). */
  tasks?: AtlasAgendaTask[]
  /** Marcos do Atlas pré-carregados (qualquer range). */
  milestones?: AtlasMilestone[]
  /** Feriados pré-carregados (qualquer range). */
  holidays?: Holiday[]
  /** Filtra somente datas >= now. Default true (foco no futuro · TDAH). */
  futureOnly?: boolean
  now?: Date
  /** Limite máximo de entries retornados. Default 12 (cabe na cabeça canon). */
  limit?: number
}

function dayMonthLabel(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}`
}

export function buildEphemerides(args: BuildEphemeridesArgs): Ephemeris[] {
  const { tasks = [], milestones = [], holidays = [], futureOnly = true, now = new Date(), limit = 12 } = args
  const out: Ephemeris[] = []
  const cutoff = new Date(now); cutoff.setHours(0, 0, 0, 0)

  // 1. Major tasks (prioridade urgent)
  for (const task of tasks) {
    if (!isMajorTask(task)) continue
    const startISO = task.recommended_start_at ?? task.planned_start_at ?? task.planned_for_date
    if (!startISO) continue
    const date = new Date(startISO)
    if (Number.isNaN(date.getTime())) continue
    if (futureOnly && date < cutoff) continue
    out.push({
      date,
      whenLabel: dayMonthLabel(date),
      what: task.title,
      kind: 'task-major',
    })
  }

  // 2. Milestones do Atlas
  for (const m of milestones) {
    if (futureOnly && m.date < cutoff) continue
    out.push({
      date: m.date,
      whenLabel: dayMonthLabel(m.date),
      what: m.label,
      kind: 'milestone',
    })
  }

  // 3. Feriados nacionais (cultural não entra · ruído)
  for (const h of holidays) {
    if (h.kind !== 'national') continue
    if (futureOnly && h.date < cutoff) continue
    out.push({
      date: h.date,
      whenLabel: dayMonthLabel(h.date),
      what: h.name,
      kind: 'holiday',
    })
  }

  out.sort((a, b) => a.date.getTime() - b.date.getTime())
  return out.slice(0, limit)
}
