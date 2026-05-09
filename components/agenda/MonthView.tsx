import { StyleSheet, View } from 'react-native'
import type { AtlasAgendaTask } from '../../lib/api/client'
import { buildMonthMatrix, type MonthDay } from '../../lib/agenda'
import type { Holiday } from '../../lib/holidays-br'
import type { AtlasMilestone } from '../../lib/atlasMilestones'
import { MonthWeek } from './MonthWeek'

interface Props {
  /** Mês a renderizar (qualquer Date dentro do mês alvo). */
  month: Date
  /** Tasks já agrupadas por dia (chave YYYY-MM-DD). */
  tasksByDay: Map<string, AtlasAgendaTask[]>
  /** Hoje · usado pra destacar a row e calcular passado/futuro. */
  today?: Date
  /** Feriados nacionais + marcos culturais (`getHolidaysMap`). */
  holidays?: Map<string, Holiday> | null
  /** Marcos do projeto Atlas (fundação, aniversários, marcos numéricos). */
  milestones?: Map<string, AtlasMilestone> | null
  onSelectDay?: (day: MonthDay) => void
}

// Vista mensal · TOC editorial linear · seção única `agenda-month`.
// Margin horizontal 32 (canon trilho).
//
// NÃO usa grid 7×6 SaaS — vista é vertical, cada dia uma row, semanas
// agrupadas por margin vertical. Validado em feedback_atlas_tdah_design.md
// como melhor pra mente TDAH (ler linear > scanear matriz).
export function MonthView({
  month,
  tasksByDay,
  today = new Date(),
  holidays = null,
  milestones = null,
  onSelectDay,
}: Props) {
  const weeks = buildMonthMatrix(month, tasksByDay, today, holidays, milestones)
  return (
    <View style={styles.wrap}>
      {weeks.map((week, idx) => (
        <MonthWeek key={`week-${idx}`} days={week.days} onSelectDay={onSelectDay} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 32,
  },
})
