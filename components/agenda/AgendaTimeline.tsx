import { StyleSheet, View } from 'react-native'
import type { AtlasAgendaTask } from '../../lib/api/client'
import { buildTimeline } from '../../lib/agenda'
import { AgendaEvent } from './AgendaEvent'
import { AgendaNowMarker } from './AgendaNowMarker'

interface Props {
  tasks: AtlasAgendaTask[]
  now?: Date
  onEventPress?: (task: AtlasAgendaTask) => void
}

// Timeline do dia · agrupa AgendaEvent ordenados por hora, com AgendaNowMarker
// inserido na posição cronológica entre passados e próximos. O primeiro evento
// futuro recebe state 'next' (border-left bronze).
//
// Trilho margin 32 · canon Atlas. Sem padding interno — os events controlam
// próprios paddings/borders.
export function AgendaTimeline({ tasks, now = new Date(), onEventPress }: Props) {
  const entries = buildTimeline(tasks, now)
  if (entries.length === 0) return null

  // Calcula isFirst/isLast por entry tipo 'event' pra borders sólidas.
  const firstEventIdx = entries.findIndex((e) => e.kind === 'event')
  const lastEventIdx =
    entries.length - 1 - [...entries].reverse().findIndex((e) => e.kind === 'event')

  return (
    <View style={styles.wrap}>
      {entries.map((entry, idx) => {
        if (entry.kind === 'now-marker') {
          return <AgendaNowMarker key={`now-${idx}`} now={now} />
        }
        const task = entry.task!
        return (
          <AgendaEvent
            key={task.id}
            task={task}
            state={entry.state ?? 'normal'}
            onPress={onEventPress ? () => onEventPress(task) : undefined}
            isFirst={idx === firstEventIdx}
            isLast={idx === lastEventIdx}
          />
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 32,
  },
})
