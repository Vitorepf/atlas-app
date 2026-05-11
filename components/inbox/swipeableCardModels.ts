import { Easing } from 'react-native-reanimated'

export const SPRING_OPEN = { damping: 26, stiffness: 240, mass: 0.85 }
export const SPRING_CLOSE = { damping: 28, stiffness: 300, mass: 0.85 }
export const COMMIT_TIMING = { duration: 240, easing: Easing.bezier(0.32, 0.72, 0.16, 1) }
export const BOUNCE_OUT_TIMING = { duration: 110, easing: Easing.bezier(0.32, 0, 0.67, 0) }

export const ACTION_WIDTH = 84
export const REVEAL_PX = 50
export const REVEAL_RATIO = 0.35
export const FULL_SWIPE_RATIO = 0.65
export const SNAP_OPEN_RATIO = 0.40
export const FAST_VELOCITY = 1100
export const COMMIT_VELOCITY_MIN_OFFSET = 0.30
export const BOUNCE_BACK_PX = 12

export type SwipeActionKind = 'delete' | 'archive' | 'snooze'

export interface SwipeAction {
  kind: SwipeActionKind
  label: string
  bg: string
  run: () => void
}

export function buildSwipeActions({
  amber,
  recRedMuted,
  onArchive,
  onDelete,
  onSnooze,
}: {
  amber: string
  recRedMuted: string
  onArchive?: () => void
  onDelete?: () => void
  onSnooze?: () => void
}): SwipeAction[] {
  const actions: SwipeAction[] = []
  if (onSnooze) actions.push({ kind: 'snooze', label: 'adiar', bg: amber, run: onSnooze })
  if (onArchive) actions.push({ kind: 'archive', label: 'arquivar', bg: recRedMuted, run: onArchive })
  if (onDelete) actions.push({ kind: 'delete', label: 'apagar', bg: recRedMuted, run: onDelete })
  return actions
}

export function isCommitSwipeMode(actions: SwipeAction[]): boolean {
  return actions.length === 1 && (actions[0].kind === 'delete' || actions[0].kind === 'archive')
}
