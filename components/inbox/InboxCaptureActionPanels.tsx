import { View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import type { InboxItem } from '../InboxCard'
import { Frau, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { SNOOZE_CHOICES, TASK_PRIORITIES } from '../../lib/inboxConstants'
import { compactTitle } from '../../lib/inboxCaptureModels'
import type { TaskPriority } from '../../lib/inboxTypes'
import { ActionText, PriorityChip } from './InboxControls'
import { styles } from './inboxScreenStyles'

export function BulkActionBar({
  onArchive,
  onPromote,
  onSnooze,
  selectedCount,
}: {
  onArchive: () => void
  onPromote: () => void
  onSnooze: () => void
  selectedCount: number
}) {
  const c = usePalette()

  if (selectedCount === 0) return null

  return (
    <Animated.View
      entering={FadeIn.duration(280)}
      exiting={FadeOut.duration(180)}
      style={[styles.bulkBar, { borderColor: c.border, backgroundColor: c.bgDeep }]}
    >
      <Frau italic size={14} lineHeight={18} color={c.ink}>
        {selectedCount} selecionada{selectedCount !== 1 ? 's' : ''}
      </Frau>
      <View style={{ flex: 1 }} />
      <ActionText label="promover" onPress={onPromote} />
      <Frau italic size={12} color={c.ink3} style={{ opacity: 0.45 }}>·</Frau>
      <ActionText label="adiar" onPress={onSnooze} />
      <Frau italic size={12} color={c.ink3} style={{ opacity: 0.45 }}>·</Frau>
      <ActionText label="arquivar" danger onPress={onArchive} />
    </Animated.View>
  )
}

export function TaskPriorityBar({
  item,
  onCancel,
  onChoose,
}: {
  item: InboxItem | null
  onCancel: () => void
  onChoose: (priority: TaskPriority) => void
}) {
  const c = usePalette()
  if (!item) return null

  return (
    <Animated.View
      entering={FadeIn.duration(280)}
      exiting={FadeOut.duration(180)}
      style={[styles.priorityBar, { borderColor: c.border, backgroundColor: c.bgDeep }]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans
          weight="med"
          size={10}
          lineHeight={14}
          letterSpacing={1.3}
          color={c.ink2}
          style={styles.uppercase}
        >
          Prioridade da tarefa
        </Sans>
        <Frau italic size={13} lineHeight={17} color={c.ink2} numberOfLines={1} style={{ marginTop: 2 }}>
          {compactTitle(item)}
        </Frau>
      </View>
      <View style={styles.priorityOptions}>
        {TASK_PRIORITIES.map((priority) => (
          <PriorityChip
            key={priority.key}
            label={priority.label}
            tone={priority.key}
            onPress={() => onChoose(priority.key)}
          />
        ))}
        <ActionText label="cancelar" onPress={onCancel} />
      </View>
    </Animated.View>
  )
}

export function SnoozeChoiceBar({
  onCancel,
  onChoose,
  selectedCount,
  target,
}: {
  onCancel: () => void
  onChoose: (days: number, reason: string) => void
  selectedCount: number
  target: InboxItem | 'bulk' | null
}) {
  const c = usePalette()
  if (!target) return null

  return (
    <Animated.View
      entering={FadeIn.duration(280)}
      exiting={FadeOut.duration(180)}
      style={[styles.priorityBar, { borderColor: c.border, backgroundColor: c.bgDeep }]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans
          weight="med"
          size={10}
          lineHeight={14}
          letterSpacing={1.3}
          color={c.ink2}
          style={styles.uppercase}
        >
          Adiar para
        </Sans>
        <Frau italic size={13} lineHeight={17} color={c.ink2} numberOfLines={1} style={{ marginTop: 2 }}>
          {target === 'bulk' ? `${selectedCount} selecionadas` : compactTitle(target)}
        </Frau>
      </View>
      <View style={styles.priorityOptions}>
        {SNOOZE_CHOICES.map((choice) => (
          <PriorityChip
            key={choice.key}
            label={choice.label}
            tone="neutral"
            onPress={() => onChoose(choice.days, choice.reason)}
          />
        ))}
        <ActionText label="cancelar" onPress={onCancel} />
      </View>
    </Animated.View>
  )
}
