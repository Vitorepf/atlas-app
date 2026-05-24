import { StyleSheet, View } from 'react-native'
import { Frau, Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { AtlasAgendaTask } from '../../lib/api/client'
import { formatDuration, formatTimeRange, type EventState } from '../../lib/agenda'
import { PressableTextScale } from '../atlas-ui/PressableScale'

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
//   - next: padding-left 14 + border-left bronze 2px + bronzeGlow halo (selo "próximo")
//   - normal: padding zero, peso pleno
//
// Round agenda polish · ganhou:
//   – PressableTextScale (scale 0.97 spring + haptic Soft)
//   – borders via c.borderSoft (era rgba hardcoded)
//   – past line-through via c.ink3 (era rgba hardcoded)
//   – next border ganha shadow bronzeGlow (peso de selo, não traço chapado)
export function AgendaEvent({ task, state, onPress, isFirst, isLast }: Props) {
  const c = usePalette()
  const isPast = state === 'past'
  const isNext = state === 'next'

  const timeLabel = formatTimeRange(
    task.recommended_start_at ?? task.planned_start_at,
    task.recommended_end_at ?? task.planned_end_at,
  )
  const duration = formatDuration(task.estimated_minutes)

  let timeSuffix: string | null = null
  if (isPast) timeSuffix = 'concluído'
  else if (isNext) timeSuffix = 'próximo'
  else if (duration) timeSuffix = duration

  const timeFull = timeSuffix && timeLabel ? `${timeLabel} · ${timeSuffix}` : timeLabel ?? ''

  const timeColor = isPast ? c.ink3 : c.prussian
  const titleColor = isPast ? c.ink3 : c.ink
  const contextColor = isPast ? c.ink3 : c.ink2

  let contextLine: string | null = null
  if (!isPast && !isNext && duration && !timeFull.includes(duration)) {
    contextLine = duration
  }

  const body = (
    <View
      style={[
        styles.row,
        isFirst ? null : { borderTopColor: c.borderSoft, borderTopWidth: StyleSheet.hairlineWidth },
        isLast ? { borderBottomColor: c.borderSoft, borderBottomWidth: StyleSheet.hairlineWidth } : null,
        isNext
          ? [
              styles.nextRow,
              {
                borderLeftColor: c.bronze,
                shadowColor: c.bronze,
                shadowOffset: { width: -1, height: 0 },
                shadowOpacity: 0.18,
                shadowRadius: 3,
              },
            ]
          : null,
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
          isPast ? { textDecorationLine: 'line-through', textDecorationColor: c.ink3 } : null,
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
      <PressableTextScale onPress={onPress} haptic="soft" accessibilityLabel={task.title}>
        {body}
      </PressableTextScale>
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
  title: {
    marginBottom: 4,
  },
  context: {
    marginTop: 0,
  },
})
