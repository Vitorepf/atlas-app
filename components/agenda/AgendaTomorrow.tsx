import { Pressable, StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { AtlasAgendaTask } from '../../lib/api/client'
import { formatDuration, formatHourMinute } from '../../lib/agenda'
import { eventStartTime } from '../../lib/agenda'

interface Props {
  tasks: AtlasAgendaTask[]
  onEventPress?: (task: AtlasAgendaTask) => void
}

// Lista compacta de eventos de amanhã · seção iii. AMANHÃ.
// Cada item: meta line mono caps (time prussian + duração + context ink3)
// + title Frau ink2 (peso menor que hoje · canon "peso decrescente").
//
// Hairlines top/bottom em cada row (6% ink). Trilho margin 32.
//
// TODO(schema): `tom-context` ("matriz", "varanda") precisa de
// location/notes. Hoje só duração formatada.
export function AgendaTomorrow({ tasks, onEventPress }: Props) {
  const c = usePalette()
  const sorted = [...tasks]
    .filter((t) => eventStartTime(t) !== null)
    .sort((a, b) => eventStartTime(a)!.getTime() - eventStartTime(b)!.getTime())

  if (sorted.length === 0) return null

  return (
    <View style={styles.wrap}>
      {sorted.map((task, idx) => {
        const start = eventStartTime(task)!
        const time = formatHourMinute(start)
        const duration = formatDuration(task.estimated_minutes)
        const isLast = idx === sorted.length - 1
        const row = (
          <View
            style={[
              styles.row,
              { borderTopColor: 'rgba(26,22,18,0.06)' },
              isLast ? { borderBottomColor: 'rgba(26,22,18,0.06)', borderBottomWidth: 1 } : null,
            ]}
          >
            <View style={styles.metaRow}>
              <Mono
                size={10}
                lineHeight={13}
                letterSpacing={1.4}
                color={c.prussian}
                weight="med"
              >
                {time.toUpperCase()}
              </Mono>
              {duration ? (
                <>
                  <Frau size={10} lineHeight={13} color={c.ink3}>
                    ·
                  </Frau>
                  <Mono size={10} lineHeight={13} letterSpacing={1.4} color={c.ink2}>
                    {duration.toUpperCase()}
                  </Mono>
                </>
              ) : null}
            </View>
            <Frau size={15} lineHeight={21} color={c.ink2}>
              {task.title}
            </Frau>
          </View>
        )
        if (onEventPress) {
          return (
            <Pressable
              key={task.id}
              onPress={() => onEventPress(task)}
              accessibilityRole="button"
              accessibilityLabel={task.title}
              style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
            >
              {row}
            </Pressable>
          )
        }
        return <View key={task.id}>{row}</View>
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 32,
  },
  row: {
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 5,
  },
})
