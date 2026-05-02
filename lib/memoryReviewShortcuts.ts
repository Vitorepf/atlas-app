export type MemoryReviewShortcutAction =
  | 'next_item'
  | 'previous_item'
  | 'toggle_editor'
  | 'toggle_selection'
  | 'select_all'
  | 'clear_focus'

export type MemoryReviewShortcutEvent = {
  key: string
  altKey?: boolean
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  defaultPrevented?: boolean
  targetTagName?: string | null
  targetRole?: string | null
  isContentEditable?: boolean
}

export function memoryReviewShortcutActionFromKey(event: MemoryReviewShortcutEvent): MemoryReviewShortcutAction | null {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null
  if (isEditableTarget(event)) return null

  const key = event.key.toLowerCase()
  if (key === 'j' || key === 'arrowdown') return 'next_item'
  if (key === 'k' || key === 'arrowup') return 'previous_item'
  if (key === 'e' || key === 'enter') return 'toggle_editor'
  if (key === 'x') return 'toggle_selection'
  if (key === 'a') return 'select_all'
  if (key === 'escape') return 'clear_focus'

  return null
}

export function nextMemoryReviewItemId(
  ids: string[],
  currentId: string | null | undefined,
  direction: 'next' | 'previous',
): string | null {
  if (ids.length === 0) return null
  if (!currentId) return direction === 'next' ? ids[0] : ids[ids.length - 1]

  const currentIndex = ids.indexOf(currentId)
  if (currentIndex === -1) return direction === 'next' ? ids[0] : ids[ids.length - 1]

  const offset = direction === 'next' ? 1 : -1
  const nextIndex = (currentIndex + offset + ids.length) % ids.length

  return ids[nextIndex] ?? null
}

function isEditableTarget(event: MemoryReviewShortcutEvent): boolean {
  if (event.isContentEditable) return true

  const tag = event.targetTagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true

  const role = event.targetRole?.toLowerCase()
  return role === 'textbox' || role === 'searchbox' || role === 'combobox'
}
