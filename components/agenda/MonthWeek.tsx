import { StyleSheet, View } from 'react-native'
import type { MonthDay } from '../../lib/agenda'
import { MonthDayRow } from './MonthDayRow'

interface Props {
  days: MonthDay[]
  onSelectDay?: (day: MonthDay) => void
}

// Agrupador de uma semana do calendário · 7 day-rows verticais.
// Margin-bottom 18px separa visualmente as semanas (canon — sem numeral
// romano · Vitor rejeitou em 2026-05-09 · semana é agrupador quantitativo,
// não capítulo editorial).
export function MonthWeek({ days, onSelectDay }: Props) {
  return (
    <View style={styles.wrap}>
      {days.map((day) => (
        <MonthDayRow key={day.date.toISOString()} day={day} onPress={onSelectDay} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 18,
  },
})
