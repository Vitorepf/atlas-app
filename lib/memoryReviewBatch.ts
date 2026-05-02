import type { AtlasMemoryReviewQueueItem } from './api/client'

export type MemoryReviewBatchAction = 'block_privacy' | 'dismiss_relations'

export type MemoryReviewBatchPlan = {
  selected_count: number
  privacy_count: number
  relation_count: number
  unsupported_count: number
  privacy_items: AtlasMemoryReviewQueueItem[]
  relation_items: AtlasMemoryReviewQueueItem[]
  unsupported_items: AtlasMemoryReviewQueueItem[]
  can_block_privacy: boolean
  can_dismiss_relations: boolean
}

export function buildMemoryReviewBatchPlan(
  items: AtlasMemoryReviewQueueItem[],
  selectedIds: string[],
): MemoryReviewBatchPlan {
  const selected = new Set(selectedIds)
  const selectedItems = items.filter((item) => selected.has(item.id))
  const privacyItems = selectedItems.filter(isBatchBlockablePrivacyItem)
  const relationItems = selectedItems.filter(isBatchDismissibleRelationItem)
  const supported = new Set([...privacyItems, ...relationItems].map((item) => item.id))
  const unsupportedItems = selectedItems.filter((item) => !supported.has(item.id))

  return {
    selected_count: selectedItems.length,
    privacy_count: privacyItems.length,
    relation_count: relationItems.length,
    unsupported_count: unsupportedItems.length,
    privacy_items: privacyItems,
    relation_items: relationItems,
    unsupported_items: unsupportedItems,
    can_block_privacy: privacyItems.length > 0,
    can_dismiss_relations: relationItems.length > 0,
  }
}

export function selectableReviewItemIds(items: AtlasMemoryReviewQueueItem[]): string[] {
  return items
    .filter((item) => isBatchBlockablePrivacyItem(item) || isBatchDismissibleRelationItem(item))
    .map((item) => item.id)
}

function isBatchBlockablePrivacyItem(item: AtlasMemoryReviewQueueItem): boolean {
  if (item.kind === 'memory_privacy') return Boolean(item.memory_entry_id)
  if (item.kind === 'verbatim_privacy') return Boolean(item.verbatim_memory_id)

  return false
}

function isBatchDismissibleRelationItem(item: AtlasMemoryReviewQueueItem): boolean {
  return item.kind === 'relation' && Boolean(item.relation_id)
}
