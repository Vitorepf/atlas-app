import { useMemo } from 'react'
import type { InboxDomainFilter } from '../components/inbox/InboxDomainStatus'
import { captureToInboxItem, useAtlasStore, visibleCaptures } from './atlasStore'
import {
  countItemsByFilter,
  filterInboxItems,
  groupByDate,
  inboxMetrics,
  isOpenInboxItem,
  isProposalItem,
  isVisibleInboxItem,
  sortItems,
} from './inboxCaptureModels'
import type { InboxFilter, InboxSort } from './inboxTypes'
import { useFreshCaptures } from './useFreshCaptures'

interface UseInboxCapturesParams {
  domainFilter: InboxDomainFilter
  filter: InboxFilter
  query: string
  sort: InboxSort
}

export function useInboxCaptures({
  domainFilter,
  filter,
  query,
  sort,
}: UseInboxCapturesParams) {
  const hydrated = useAtlasStore((s) => s.hydrated)
  const captures = useAtlasStore((s) => s.captures)
  const queuedCaptures = useAtlasStore((s) => s.queuedCaptures)
  const domains = useAtlasStore((s) => s.domains)
  const hydrate = useAtlasStore((s) => s.hydrate)
  const sync = useAtlasStore((s) => s.sync)
  const triageCapture = useAtlasStore((s) => s.triageCapture)

  const items = useMemo(
    () => visibleCaptures({ captures, queuedCaptures }).map((capture) => captureToInboxItem(capture, domains)),
    [captures, domains, queuedCaptures],
  )
  const visibleItems = useMemo(
    () => items.filter((item) => isVisibleInboxItem(item)),
    [items],
  )
  const openItems = useMemo(
    () => visibleItems.filter((item) => isOpenInboxItem(item)),
    [visibleItems],
  )
  const metrics = useMemo(() => inboxMetrics(openItems), [openItems])
  const filterCounts = useMemo(
    () => countItemsByFilter(items, visibleItems),
    [items, visibleItems],
  )
  const filteredItems = useMemo(() => {
    return filterInboxItems({
      domainFilter,
      filter,
      items,
      query,
      visibleItems,
    })
  }, [items, visibleItems, domainFilter, filter, query])
  const sortedItems = useMemo(() => sortItems(filteredItems, sort), [filteredItems, sort])
  const groups = useMemo(() => groupByDate(sortedItems), [sortedItems])
  const freshIds = useFreshCaptures(items)
  const proposalsCount = useMemo(
    () => items.filter((item) => isProposalItem(item)).length,
    [items],
  )

  return {
    freshIds,
    filterCounts,
    groups,
    hydrate,
    hydrated,
    items,
    metrics,
    openItems,
    proposalsCount,
    sync,
    triageCapture,
    visibleItems,
  }
}
