import { memo, useCallback, useMemo } from 'react'
import { View } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated'
import { InboxCard, type InboxItem } from '../InboxCard'
import { InboxSkeleton } from '../InboxSkeleton'
import { EmptyInbox } from '../EmptyInbox'
import { TimelineLabel } from './TimelineLabel'
import { isNavigableDestination } from '../../lib/inboxCaptureModels'
import type { DateGroup } from '../../lib/inboxCaptureModels'
import type { InboxFilter } from '../../lib/inboxTypes'
import { SwipeableCard } from './SwipeableCard'
import { styles } from './inboxScreenStyles'

interface Props {
  actionBusy: string | null
  filter: InboxFilter
  freshIds: Set<string>
  groups: DateGroup[]
  loading: boolean
  onArchive: (item: InboxItem) => void
  onCreateProject: (item: InboxItem) => void
  onCreateTask: (item: InboxItem) => void
  onOpen: (item: InboxItem) => void
  onOpenDestination: (item: InboxItem) => void
  onPromote: (item: InboxItem) => void
  onSnooze: (item: InboxItem) => void
  onToggleSelected: (item: InboxItem) => void
  openCount: number
  selectedIds: string[]
  selectionMode: boolean
}

export function InboxCaptureList({
  actionBusy,
  filter,
  freshIds,
  groups,
  loading,
  onArchive,
  onCreateProject,
  onCreateTask,
  onOpen,
  onOpenDestination,
  onPromote,
  onSnooze,
  onToggleSelected,
  openCount,
  selectedIds,
  selectionMode,
}: Props) {
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])

  if (loading) {
    return <InboxSkeleton />
  }

  if (groups.length === 0) {
    return <EmptyInbox variant={openCount === 0 ? 'inbox' : filter} />
  }

  return (
    <View>
      {groups.map((group) => (
        <View key={group.key}>
          <TimelineLabel label={group.label} />
          <View style={styles.list}>
            {group.items.map((item, cardIdx) => (
              <InboxCaptureRow
                key={item.id}
                actionBusy={actionBusy === item.id || actionBusy === 'bulk'}
                cardIdx={cardIdx}
                fresh={freshIds.has(item.id)}
                item={item}
                lastInGroup={cardIdx === group.items.length - 1}
                onArchive={onArchive}
                onCreateProject={onCreateProject}
                onCreateTask={onCreateTask}
                onOpen={onOpen}
                onOpenDestination={onOpenDestination}
                onPromote={onPromote}
                onSnooze={onSnooze}
                onToggleSelected={onToggleSelected}
                selected={selectedIdSet.has(item.id)}
                selectionMode={selectionMode}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

export const MemoInboxCaptureList = memo(InboxCaptureList)

const InboxCaptureRow = memo(function InboxCaptureRow({
  actionBusy,
  cardIdx,
  fresh,
  item,
  lastInGroup,
  onArchive,
  onCreateProject,
  onCreateTask,
  onOpen,
  onOpenDestination,
  onPromote,
  onSnooze,
  onToggleSelected,
  selected,
  selectionMode,
}: {
  actionBusy: boolean
  cardIdx: number
  fresh: boolean
  item: InboxItem
  lastInGroup: boolean
  onArchive: (item: InboxItem) => void
  onCreateProject: (item: InboxItem) => void
  onCreateTask: (item: InboxItem) => void
  onOpen: (item: InboxItem) => void
  onOpenDestination: (item: InboxItem) => void
  onPromote: (item: InboxItem) => void
  onSnooze: (item: InboxItem) => void
  onToggleSelected: (item: InboxItem) => void
  selected: boolean
  selectionMode: boolean
}) {
  const archive = useCallback(() => onArchive(item), [item, onArchive])
  const createProject = useCallback(() => onCreateProject(item), [item, onCreateProject])
  const createTask = useCallback(() => onCreateTask(item), [item, onCreateTask])
  const open = useCallback(() => {
    if (selectionMode) {
      onToggleSelected(item)
    } else {
      onOpen(item)
    }
  }, [item, onOpen, onToggleSelected, selectionMode])
  const openDestination = useCallback(() => onOpenDestination(item), [item, onOpenDestination])
  const promote = useCallback(() => onPromote(item), [item, onPromote])
  const snooze = useCallback(() => onSnooze(item), [item, onSnooze])
  const canSwipe = !selectionMode && !item.isLocal && !item.isArchived

  return (
    <Animated.View
      entering={FadeIn
        .duration(480)
        .delay(Math.min(cardIdx, 7) * 50)}
      exiting={FadeOut.duration(240)}
      layout={LinearTransition.duration(480).easing(
        Easing.bezier(0.16, 1, 0.3, 1).factory(),
      )}
    >
      <SwipeableCard
        enabled={canSwipe}
        onSnooze={item.isLocal ? undefined : snooze}
        onArchive={item.isLocal ? undefined : archive}
      >
        <InboxCard
          item={item}
          selected={selected}
          selectionMode={selectionMode}
          isFresh={fresh}
          lastInGroup={lastInGroup}
          onPress={open}
          onPromote={promote}
          onCreateTask={createTask}
          onCreateProject={createProject}
          onSnooze={snooze}
          onArchive={archive}
          onOpenDestination={isNavigableDestination(item) ? openDestination : undefined}
          actionBusy={actionBusy}
        />
      </SwipeableCard>
    </Animated.View>
  )
})
