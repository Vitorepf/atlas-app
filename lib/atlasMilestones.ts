// Marcos do projeto Atlas · datas com peso narrativo derivadas da fundação.
//
// Diferente de feriados (calendário civil), milestones são datas-marco
// específicas do projeto:
//   - Fundação (8 mai 2026) · única, irrepetível
//   - Aniversário mensal (todo dia 8 do mês, primeiros 12 meses)
//   - Aniversário anual (8 mai todo ano, vol. ii, vol. iii, ...)
//   - Marcos cumulativos por contagem (100º dia, 365º dia, 1000º dia)
//
// Esses marcos aparecem:
//   - Na vista Mês como `md-meta` em bronze + label "Atlas · fundação"
//   - Na vista Hoje · v. Efemérides como marginalia mono caps
//   - Em cintas/horizon como dot bronze (futuro)
//
// "Enterprise": cada milestone tem `kind` discriminável, `weight` pra
// ordenação, e pode ser estendido sem quebrar consumidores.

import { ATLAS_FOUNDATION, toRomanLower } from './folio'
import { localDateKey } from './atlasStore'

export type MilestoneKind =
  | 'foundation'           // 8 mai 2026 · "Atlas · fundação"
  | 'anniversary-monthly'  // dia 8 de cada mês durante o vol. i
  | 'anniversary-yearly'   // 8 mai todo ano (vira de volume)
  | 'day-100'              // 100º dia
  | 'day-365'              // 365º dia · fim do vol. i
  | 'day-1000'             // 1000º dia

export interface AtlasMilestone {
  date: Date
  kind: MilestoneKind
  /** Label editorial · "Atlas · fundação", "1 mês de fundação". */
  label: string
  /** Peso pra ordenação · 100=fundação, 80=aniv-anual, 60=marcos-num,
   *  40=aniv-mensal. Maior = mais relevante. */
  weight: number
}

const ONE_DAY_MS = 1000 * 60 * 60 * 24

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from)
  a.setHours(0, 0, 0, 0)
  const b = new Date(to)
  b.setHours(0, 0, 0, 0)
  return Math.round((b.getTime() - a.getTime()) / ONE_DAY_MS)
}

function addDaysUTC(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  d.setHours(0, 0, 0, 0)
  return d
}

// Volume Atlas (1 = primeiro ciclo de 12 meses desde fundação).
function volumeForDate(date: Date): number {
  let years = date.getFullYear() - ATLAS_FOUNDATION.getFullYear()
  const nowMD = date.getMonth() * 100 + date.getDate()
  const foundMD = ATLAS_FOUNDATION.getMonth() * 100 + ATLAS_FOUNDATION.getDate()
  if (nowMD < foundMD) years -= 1
  return Math.max(1, years + 1)
}

// =====================================================================
// CONSTRUÇÃO DOS MARCOS PARA UM RANGE
// =====================================================================

function buildMilestonesInRange(start: Date, end: Date): AtlasMilestone[] {
  const out: AtlasMilestone[] = []
  const startTime = new Date(start).setHours(0, 0, 0, 0)
  const endTime = new Date(end).setHours(0, 0, 0, 0)

  const inRange = (d: Date) => {
    const t = new Date(d).setHours(0, 0, 0, 0)
    return t >= startTime && t <= endTime
  }

  // 1. FUNDAÇÃO · única
  if (inRange(ATLAS_FOUNDATION)) {
    out.push({
      date: new Date(ATLAS_FOUNDATION),
      kind: 'foundation',
      label: 'Atlas · fundação',
      weight: 100,
    })
  }

  // 2. ANIVERSÁRIOS ANUAIS · 8 mai todo ano após fundação
  for (let year = ATLAS_FOUNDATION.getFullYear() + 1; year <= end.getFullYear(); year++) {
    const date = new Date(year, ATLAS_FOUNDATION.getMonth(), ATLAS_FOUNDATION.getDate())
    if (inRange(date)) {
      const vol = volumeForDate(date)
      out.push({
        date,
        kind: 'anniversary-yearly',
        label: `Atlas · vol. ${toRomanLower(vol)}`,
        weight: 80,
      })
    }
  }

  // 3. ANIVERSÁRIOS MENSAIS · só durante o vol. i (primeiros 12 meses)
  // Dia 8 de cada mês após fundação, até completar 12 meses.
  for (let i = 1; i <= 12; i++) {
    const d = new Date(ATLAS_FOUNDATION)
    d.setMonth(d.getMonth() + i)
    if (inRange(d)) {
      const monthsLabel = i === 1 ? '1 mês' : `${i} meses`
      out.push({
        date: d,
        kind: 'anniversary-monthly',
        label: `Atlas · ${monthsLabel}`,
        weight: 40,
      })
    }
  }

  // 4. MARCOS NUMÉRICOS · 100º, 365º, 1000º dia
  const numericMilestones: Array<{ days: number; label: string; kind: MilestoneKind }> = [
    { days: 100, label: 'Atlas · 100º dia', kind: 'day-100' },
    { days: 365, label: 'Atlas · 1 ano', kind: 'day-365' },
    { days: 1000, label: 'Atlas · 1000º dia', kind: 'day-1000' },
  ]
  for (const m of numericMilestones) {
    const date = addDaysUTC(ATLAS_FOUNDATION, m.days - 1) // dia 100 = 99 dias após fundação
    if (inRange(date)) {
      out.push({ date, kind: m.kind, label: m.label, weight: 60 })
    }
  }

  out.sort((a, b) => a.date.getTime() - b.date.getTime())
  return out
}

// =====================================================================
// API PÚBLICA
// =====================================================================

export function getMilestonesForMonth(year: number, monthIdx: number): AtlasMilestone[] {
  const start = new Date(year, monthIdx, 1)
  const end = new Date(year, monthIdx + 1, 0)
  return buildMilestonesInRange(start, end)
}

export function getMilestonesMap(year: number, monthIdx: number): Map<string, AtlasMilestone> {
  const map = new Map<string, AtlasMilestone>()
  for (const m of getMilestonesForMonth(year, monthIdx)) {
    const key = localDateKey(m.date)
    // Quando dois milestones colidem no mesmo dia (improvável), guarda o
    // de maior peso. (ex: aniv-yearly + aniv-monthly no dia 8 do mês 12).
    const existing = map.get(key)
    if (!existing || m.weight > existing.weight) {
      map.set(key, m)
    }
  }
  return map
}

export function getUpcomingMilestones(from: Date, daysAhead: number): AtlasMilestone[] {
  const start = from
  const end = addDaysUTC(from, daysAhead)
  return buildMilestonesInRange(start, end)
}

// Quanto falta pro marco em dias (positivo = futuro, negativo = passado).
export function daysUntilMilestone(milestone: AtlasMilestone, from: Date = new Date()): number {
  return daysBetween(from, milestone.date)
}
