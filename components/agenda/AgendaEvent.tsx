import { Pressable, StyleSheet, View } from 'react-native'
import { Frau, Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { AtlasAgendaTask } from '../../lib/api/client'
import { formatDuration, formatTimeRange, type EventState } from '../../lib/agenda'

interface Props {
  task: AtlasAgendaTask
  state: EventState
  onPress?: () => void
  isFirst?: boolean
  isLast?: boolean
}

// Entry individual da timeline · meta line com time mono prussian + suffix
// editorial, title sans medium 15.5, context italic Frau 13 ink2.
//
// Estados visuais:
//   - past: time line-through ink3, title ink3 weight 400, context ink3
//   - next: padding-left 14 + border-left bronze 2px (selo "próximo")
//   - normal: padding zero, peso pleno
//
// TODO(schema): `agenda-event-context` do mockup ("escritório · 90min",
// "academia · braço") precisa de campo `location` ou `notes` no schema
// AtlasAgendaTask. Hoje renderizamos só duração formatada.
export function AgendaEvent({ task, state, onPress, isFirst, isLast }: Props) {
  const c = usePalette()
  const isPast = state === 'past'
  const isNext = state === 'next'

  const timeLabel = formatTimeRange(
    task.recommended_start_at ?? task.planned_start_at,
    task.recommended_end_at ?? task.planned_end_at,
  )
  const duration = formatDuration(task.estimated_minutes)

  // Suffix editorial após o time: "concluído" se passado, "próximo" se next.
  let timeSuffix: string | null = null
  if (isPast) timeSuffix = 'concluído'
  else if (isNext) timeSuffix = 'próximo'
  else if (duration) timeSuffix = duration

  const timeFull = timeSuffix && timeLabel ? `${timeLabel} · ${timeSuffix}` : timeLabel ?? ''

  const timeColor = isPast ? c.ink3 : c.prussian
  const titleColor = isPast ? c.ink3 : c.ink
  const contextColor = isPast ? c.ink3 : c.ink2

  // Context line: como location/notes não existem ainda, mostramos só a
  // duração quando o time já não a contém. Silente se nada disso.
  let contextLine: string | null = null
  if (!isPast && !isNext && duration && !timeFull.includes(duration)) {
    contextLine = duration
  }

  const body = (
    <View
      style={[
        styles.row,
        isFirst ? null : { borderTopColor: 'rgba(26,22,18,0.06)', borderTopWidth: 1 },
        isLast ? { borderBottomColor: 'rgba(26,22,18,0.06)', borderBottomWidth: 1 } : null,
        isNext ? [styles.nextRow, { borderLeftColor: c.bronze }] : null,
      ]}
    >
      <Mono
        size={11}
        lineHeight={14}
        letterSpacing={0.6}
        color={timeColor}
        weight={isPast ? undefined : 'med'}
        style={[
          styles.time,
          isPast ? styles.pastTime : null,
        ]}
      >
        {timeFull}
      </Mono>
      <Sans
        weight={isPast ? 'reg' : 'med'}
        size={15.5}
        lineHeight={22}
        letterSpacing={-0.05}
        color={titleColor}
        style={styles.title}
      >
        {task.title}
      </Sans>
      {contextLine ? (
        <Frau italic size={13} lineHeight={19} color={contextColor} style={styles.context}>
          {contextLine}
        </Frau>
      ) : null}
    </View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={task.title}
        style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
      >
        {body}
      </Pressable>
    )
  }
  return body
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 14,
  },
  nextRow: {
    paddingLeft: 14,
    marginLeft: -14,
    borderLeftWidth: 2,
  },
  time: {
    marginBottom: 4,
  },
  pastTime: {
    textDecorationLine: 'line-through',
    textDecorationColor: 'rgba(168,159,144,0.4)',
  },
  title: {
    marginBottom: 4,
  },
  context: {
    marginTop: 0,
  },
})
