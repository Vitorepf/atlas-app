// Feriados nacionais brasileiros · cobertura completa · móveis via Computus.
//
// Cobertura:
//   FERIADOS NACIONAIS FIXOS (Lei nº 662/1949 + 6.802/1980 + 10.607/2002)
//     01 jan · Confraternização Universal
//     21 abr · Tiradentes
//     01 mai · Dia do Trabalho
//     07 set · Independência
//     12 out · Nossa Sra. Aparecida
//     02 nov · Finados
//     15 nov · Proclamação da República
//     20 nov · Consciência Negra (lei 14.759/2024)
//     25 dez · Natal
//
//   FERIADOS NACIONAIS MÓVEIS (derivados da Páscoa via Computus)
//     Sexta-feira Santa · Páscoa - 2 dias
//     Páscoa            · domingo
//     Carnaval          · Páscoa - 47 dias (terça)
//     Corpus Christi    · Páscoa + 60 dias (quinta)
//
//   MARCOS CULTURAIS (não-feriado, mas relevância editorial)
//     Dia das Mães · 2º domingo de maio
//     Dia dos Pais · 2º domingo de agosto
//     Dia das Crianças · 12 out (coincide com Aparecida)
//
// Decisão editorial Atlas: marcos culturais entram como `kind: 'cultural'`
// pra renderizar em peso menor que feriados nacionais (`kind: 'national'`).
// Componentes podem filtrar por kind.

import { localDateKey } from './atlasStore'

export type HolidayKind = 'national' | 'cultural'

export interface Holiday {
  /** Data local · sempre 00:00 do dia do feriado. */
  date: Date
  /** Nome curto · "Dia do Trabalho", "Páscoa", "Tiradentes". */
  name: string
  /** Slug pra match programático · "trabalho", "pascoa", "tiradentes". */
  slug: string
  kind: HolidayKind
}

// =====================================================================
// COMPUTUS · algoritmo gregoriano de Páscoa (Meeus/Jones/Butcher).
// Usado pra derivar Carnaval, Sexta Santa, Corpus Christi.
// =====================================================================

export function computeEaster(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31) // 3=mar, 4=abr
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(date.getDate() + days)
  return next
}

// =====================================================================
// CONSTRUÇÃO DOS FERIADOS DE UM ANO
// =====================================================================

function fixedHoliday(year: number, month: number, day: number, name: string, slug: string, kind: HolidayKind = 'national'): Holiday {
  return { date: new Date(year, month - 1, day), name, slug, kind }
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  // weekday: 0=dom..6=sáb; n=1..5 (1ª, 2ª, ...)
  const firstDay = new Date(year, month - 1, 1)
  const offset = (weekday - firstDay.getDay() + 7) % 7
  const day = 1 + offset + (n - 1) * 7
  return new Date(year, month - 1, day)
}

export function buildHolidaysForYear(year: number): Holiday[] {
  const easter = computeEaster(year)
  const holidays: Holiday[] = [
    fixedHoliday(year, 1, 1, 'Confraternização Universal', 'ano-novo'),
    fixedHoliday(year, 4, 21, 'Tiradentes', 'tiradentes'),
    fixedHoliday(year, 5, 1, 'Dia do Trabalho', 'trabalho'),
    fixedHoliday(year, 9, 7, 'Independência', 'independencia'),
    fixedHoliday(year, 10, 12, 'Nossa Sra. Aparecida', 'aparecida'),
    fixedHoliday(year, 11, 2, 'Finados', 'finados'),
    fixedHoliday(year, 11, 15, 'Proclamação da República', 'republica'),
    fixedHoliday(year, 11, 20, 'Consciência Negra', 'consciencia-negra'),
    fixedHoliday(year, 12, 25, 'Natal', 'natal'),

    // Móveis · derivados de Páscoa
    { date: addDays(easter, -47), name: 'Carnaval', slug: 'carnaval', kind: 'national' },
    { date: addDays(easter, -2), name: 'Sexta-feira Santa', slug: 'sexta-santa', kind: 'national' },
    { date: easter, name: 'Páscoa', slug: 'pascoa', kind: 'national' },
    { date: addDays(easter, 60), name: 'Corpus Christi', slug: 'corpus-christi', kind: 'national' },

    // Marcos culturais · não-feriado, peso editorial menor
    { date: nthWeekdayOfMonth(year, 5, 0, 2), name: 'Dia das Mães', slug: 'maes', kind: 'cultural' },
    { date: nthWeekdayOfMonth(year, 8, 0, 2), name: 'Dia dos Pais', slug: 'pais', kind: 'cultural' },
  ]
  return holidays
}

// =====================================================================
// API PÚBLICA
// =====================================================================

export function getHolidaysForMonth(year: number, monthIdx: number): Holiday[] {
  // monthIdx: 0=jan..11=dez
  return buildHolidaysForYear(year).filter(
    (h) => h.date.getFullYear() === year && h.date.getMonth() === monthIdx,
  )
}

// Mapa indexado por dateKey (YYYY-MM-DD) pra lookup O(1) no MonthView.
export function getHolidaysMap(year: number, monthIdx: number): Map<string, Holiday> {
  const map = new Map<string, Holiday>()
  for (const h of getHolidaysForMonth(year, monthIdx)) {
    map.set(localDateKey(h.date), h)
  }
  return map
}

// Busca um feriado específico pra uma data. Quando o dia tem dois (raro),
// retorna o de maior peso (national > cultural).
export function getHolidayForDate(date: Date): Holiday | null {
  const key = localDateKey(date)
  const candidates = buildHolidaysForYear(date.getFullYear()).filter(
    (h) => localDateKey(h.date) === key,
  )
  if (candidates.length === 0) return null
  candidates.sort((a, b) => (a.kind === 'national' ? -1 : 1))
  return candidates[0]!
}

// Range arbitrário · feriados de [from, from + daysAhead]. Cobre cross-year
// automaticamente (ex.: dezembro → janeiro do ano seguinte).
export function getUpcomingHolidays(from: Date, daysAhead: number): Holiday[] {
  const start = new Date(from); start.setHours(0, 0, 0, 0)
  const end = new Date(from); end.setDate(from.getDate() + daysAhead); end.setHours(23, 59, 59, 999)
  const out: Holiday[] = []
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    for (const h of buildHolidaysForYear(y)) {
      if (h.date >= start && h.date <= end) out.push(h)
    }
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime())
  return out
}
