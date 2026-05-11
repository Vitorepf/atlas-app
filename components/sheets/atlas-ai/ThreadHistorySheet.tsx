import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  InteractionManager,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
  type ListRenderItem,
} from 'react-native'
import Animated, { Easing, LinearTransition } from 'react-native-reanimated'
import { Sparkle } from '../../Sparkle'
import { SwipeableCard } from '../../inbox/SwipeableCard'
import { Frau, Mono, Sans } from '../../../design/Type'
import { fonts } from '../../../design/tokens'
import { useTheme } from '../../../design/theme'
import { SectionHead } from '../../editorial'
import { BottomSheet } from '../BottomSheet'
import type { AtlasAiThread } from '../../../lib/api/client'
import { atlasAiModeFromThread, atlasAiModeLabel } from '../../../lib/atlasAiThreadRouting'
import { nowMs, recordPerformanceDuration } from '../../../lib/performanceTelemetry'
import {
  THREAD_GROUP_LABELS,
  compactThreadWorkspace,
  computeMetaDiversity,
  filterThreads,
  formatHistoryTimestamp,
  providerWord,
  shortWorkspace,
  threadActiveDuration,
  threadGroupKey,
  threadHistoryModeOptions,
  threadIsCli,
  threadIsRecentlyActive,
  type MetaDiversity,
  type ThreadGroupKey,
  type ThreadHistoryModeFilter,
} from './threadHistoryModel'

export type ThreadHistorySheetProps = {
  visible: boolean
  threads: AtlasAiThread[]
  currentThreadId: string | null
  listError: string | null
  listRefreshing: boolean
  hasMore: boolean
  onRetryList: () => void
  onLoadMore: () => void
  onClose: () => void
  onSelect: (thread: AtlasAiThread) => void
  onNew: () => void
  onDelete: (thread: AtlasAiThread) => void
}

function ThreadHistorySheetInner({
  visible,
  threads,
  currentThreadId,
  listError,
  listRefreshing,
  hasMore,
  onRetryList,
  onLoadMore,
  onClose,
  onSelect,
  onNew,
  onDelete,
}: ThreadHistorySheetProps) {
  const { c } = useTheme()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [modeFilter, setModeFilter] = useState<ThreadHistoryModeFilter>('all')
  const openedAtRef = useRef<number | null>(null)
  const openMetricRecordedRef = useRef(false)

  useEffect(() => {
    if (!visible) openedAtRef.current = null
    else openedAtRef.current = nowMs()
    openMetricRecordedRef.current = false
  }, [visible])

  useEffect(() => {
    if (!visible) return

    let cancelled = false
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelled || openMetricRecordedRef.current || openedAtRef.current == null) return
      openMetricRecordedRef.current = true
      recordPerformanceDuration('history_open_ms', openedAtRef.current, {
        thread_count: threads.length,
        has_more: hasMore,
        refreshing: listRefreshing,
      })
    })

    return () => {
      cancelled = true
      task.cancel()
    }
  }, [hasMore, listRefreshing, threads.length, visible])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === debouncedQuery) return
    const timer = setTimeout(() => setDebouncedQuery(trimmed), 250)
    return () => clearTimeout(timer)
  }, [query, debouncedQuery])

  const queryFiltered = useMemo(
    () => filterThreads(threads, debouncedQuery),
    [threads, debouncedQuery],
  )
  const modeOptions = useMemo(
    () => threadHistoryModeOptions(queryFiltered),
    [queryFiltered],
  )
  const filtered = useMemo(
    () => (modeFilter === 'all'
      ? queryFiltered
      : queryFiltered.filter((thread) => atlasAiModeFromThread(thread) === modeFilter)),
    [queryFiltered, modeFilter],
  )
  const runningCli = useMemo(
    () => filtered.filter((thread) => threadIsCli(thread) && threadIsRecentlyActive(thread)),
    [filtered],
  )
  const totalCount = filtered.length
  const inCurseCount = runningCli.length

  const headerEl = useMemo(() => (
    <View>
      <Frau weight="med" size={26} lineHeight={32} letterSpacing={5} color={c.ink} align="center">
        HISTÓRICO
      </Frau>
      <View style={[styles.headingRule, { backgroundColor: c.border }]} />
      <Frau italic size={13} lineHeight={19} color={c.ink2} align="center" style={styles.historicoSub}>
        {totalCount === 1 ? '1 conversa' : `${totalCount} conversas`}
        {inCurseCount > 0 ? ` · ${inCurseCount} em curso` : ''}
      </Frau>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="buscar sessão…"
        placeholderTextColor={c.ink3}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="off"
        textContentType="none"
        style={[styles.historicoSearch, { color: c.ink, borderBottomColor: c.border }]}
      />

      {listError ? (
        <View style={[styles.historicoErrorBanner, { borderLeftColor: c.recRedMuted, backgroundColor: `${c.recRedMuted}0A` }]}>
          <View style={{ flex: 1 }}>
            <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.recRedMuted} weight="med">
              FALHA NA SINCRONIA
            </Mono>
            <Frau italic size={13} lineHeight={19} color={c.ink2} style={{ marginTop: 4 }}>
              {listError}
            </Frau>
          </View>
          <Pressable
            onPress={onRetryList}
            disabled={listRefreshing}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: listRefreshing ? 0.4 : pressed ? 0.55 : 1, marginLeft: 12 })}
            accessibilityRole="button"
            accessibilityLabel="tentar novamente"
          >
            <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.bronze} weight="med">
              {listRefreshing ? 'TENTANDO…' : 'TENTAR DE NOVO'}
            </Mono>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.historicoFilter}>
        {modeOptions.map((option, idx) => {
          const active = modeFilter === option.key
          return (
            <Pressable
              key={option.key}
              onPress={() => setModeFilter(option.key)}
              hitSlop={6}
              style={({ pressed }) => [styles.historicoFilterItem, { opacity: pressed ? 0.55 : 1 }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Frau
                italic
                weight={active ? 'med' : 'reg'}
                size={14}
                lineHeight={20}
                color={active ? c.bronze : c.ink2}
                style={active ? styles.historicoFilterActive : undefined}
              >
                {option.label.toLowerCase()}
              </Frau>
              <Mono size={9.5} lineHeight={13} letterSpacing={0.4} color={c.ink3} style={styles.historicoFilterCount}>
                ({option.count})
              </Mono>
              {idx < modeOptions.length - 1 ? (
                <Frau italic size={14} lineHeight={20} color={c.ink3} style={styles.historicoFilterSep}>
                  ·
                </Frau>
              ) : null}
            </Pressable>
          )
        })}
      </View>

      {runningCli.length > 0 ? (
        <View>
          <SectionHead
            numeral="i"
            title="Em curso"
            deck="sessões Atlas CLI rodando · acompanhe pelo mobile"
          />
          {runningCli.map((thread) => (
            <EmCursoCard
              key={thread.id}
              thread={thread}
              onContinue={() => {
                onSelect(thread)
                onClose()
              }}
            />
          ))}
        </View>
      ) : null}

      <View style={[styles.novaConversaAnchor, { borderTopColor: c.border }]}>
        <Pressable
          onPress={() => {
            onNew()
            onClose()
          }}
          style={({ pressed }) => [styles.novaConversaRow, { opacity: pressed ? 0.55 : 1 }]}
        >
          <View style={styles.novaConversaText}>
            <Frau weight="med" size={17} lineHeight={22} color={c.ink} letterSpacing={-0.05}>
              Nova conversa
            </Frau>
            <Frau italic size={13} lineHeight={19} color={c.ink2}>
              do silêncio · sem herança
            </Frau>
          </View>
        </Pressable>
      </View>
    </View>
  ), [c, query, listError, listRefreshing, onRetryList, modeOptions, modeFilter, runningCli, onSelect, onClose, onNew, totalCount, inCurseCount])

  const metaDiversity = useMemo(() => computeMetaDiversity(filtered), [filtered])
  const listItems = useMemo<HistoryListItem[]>(() => {
    const runningIds = new Set(runningCli.map((thread) => thread.id))
    const groups: Record<ThreadGroupKey, AtlasAiThread[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    }
    for (const thread of filtered) {
      if (runningIds.has(thread.id)) continue
      groups[threadGroupKey(thread)].push(thread)
    }
    const items: HistoryListItem[] = []
    for (const key of ['today', 'yesterday', 'thisWeek', 'older'] as ThreadGroupKey[]) {
      const list = groups[key]
      if (list.length === 0) continue
      items.push({ kind: 'group', key: `group-${key}`, label: THREAD_GROUP_LABELS[key], count: list.length })
      for (const thread of list) {
        items.push({ kind: 'thread', key: thread.id, thread, isCurrent: thread.id === currentThreadId })
      }
    }
    return items
  }, [filtered, runningCli, currentThreadId])

  const renderItem = useCallback<ListRenderItem<HistoryListItem>>(
    ({ item }) => {
      if (item.kind === 'group') return <HistoryGroupHeader label={item.label} count={item.count} />
      return (
        <ConversaRow
          thread={item.thread}
          isCurrent={item.isCurrent}
          metaDiversity={metaDiversity}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      )
    },
    [metaDiversity, onSelect, onDelete],
  )
  const keyExtractor = useCallback((item: HistoryListItem) => item.key, [])
  const emptyEl = useMemo(() => {
    if (listRefreshing && filtered.length === 0 && !listError) return <HistoricoSkeleton />
    return <EmptyInline text="nenhuma sessão encontrada" />
  }, [listRefreshing, filtered.length, listError])
  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={listRefreshing}
        onRefresh={onRetryList}
        tintColor={c.bronze}
        colors={[c.bronze]}
      />
    ),
    [listRefreshing, onRetryList, c.bronze],
  )
  const footerEl = useMemo(() => {
    if (filtered.length === 0) return null
    if (hasMore) {
      return (
        <Pressable
          onPress={onLoadMore}
          disabled={listRefreshing}
          hitSlop={8}
          style={({ pressed }) => [
            styles.loadMoreRow,
            { opacity: listRefreshing ? 0.4 : pressed ? 0.55 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="ver mais conversas"
        >
          <Frau italic size={15} lineHeight={22} color={c.bronze}>
            {listRefreshing ? 'carregando…' : 'ver mais · 10'}
          </Frau>
        </Pressable>
      )
    }
    return (
      <View style={styles.loadMoreRow}>
        <Frau italic size={13} lineHeight={18} color={c.ink3}>
          fim do histórico
        </Frau>
      </View>
    )
  }, [hasMore, filtered.length, listRefreshing, onLoadMore, c.bronze, c.ink3])

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <Animated.FlatList
        data={listItems}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={headerEl}
        ListEmptyComponent={emptyEl}
        ListFooterComponent={footerEl}
        contentContainerStyle={styles.historicoContent}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        itemLayoutAnimation={LinearTransition.duration(280).easing(Easing.bezier(0.32, 0.72, 0.16, 1).factory())}
      />
    </BottomSheet>
  )
}

export const ThreadHistorySheet = memo(ThreadHistorySheetInner)

type HistoryListItem =
  | { kind: 'group'; key: string; label: string; count: number }
  | { kind: 'thread'; key: string; thread: AtlasAiThread; isCurrent: boolean }

function EmptyInline({ text }: { text: string }) {
  const { c } = useTheme()
  return (
    <Frau italic size={13} lineHeight={18} color={c.ink3}>
      {text}
    </Frau>
  )
}

const HistoryGroupHeader = memo(function HistoryGroupHeader({
  label,
  count,
}: {
  label: string
  count: number
}) {
  const { c } = useTheme()
  return (
    <View style={styles.groupOrnament}>
      <View style={styles.groupOrnamentRow}>
        <View style={[styles.groupOrnamentLine, { backgroundColor: c.border }]} />
        <Sparkle size={14} />
        <View style={[styles.groupOrnamentLine, { backgroundColor: c.border }]} />
      </View>
      <Frau italic size={13} lineHeight={18} color={c.ink3} align="center" style={styles.groupOrnamentLabel}>
        {label.toLowerCase()} · {count}
      </Frau>
    </View>
  )
})

type ConversaRowProps = {
  thread: AtlasAiThread
  isCurrent: boolean
  metaDiversity: MetaDiversity
  onSelect: (thread: AtlasAiThread) => void
  onDelete: (thread: AtlasAiThread) => void
}

const ConversaRow = memo(function ConversaRow({ thread, isCurrent, metaDiversity, onSelect, onDelete }: ConversaRowProps) {
  const { c } = useTheme()
  const isCli = threadIsCli(thread)
  const mode = atlasAiModeFromThread(thread)
  const workspace = shortWorkspace(thread)
  const isHomeWorkspace = workspace === '(home)'
  const turns = thread.message_count ?? 0
  const provider = providerWord(providerFromThreadGovernance(thread) ?? thread.last_provider) ?? 'atlas'
  const timestamp = formatHistoryTimestamp(thread.last_message_at ?? thread.updated_at)
  const showProviderSignal = provider !== 'atlas'
  const showCliBadge = isCli
  const showModeChip = metaDiversity.showMode && mode !== 'general'
  const showAtualChip = isCurrent
  const showMetaLine = showModeChip || showCliBadge || showAtualChip
  const signalsSuffix: string[] = []
  if (turns > 1) signalsSuffix.push(turns === 2 ? '2 turnos' : `${turns} turnos`)
  if (showProviderSignal) signalsSuffix.push(provider)
  const hasSignals = workspace || signalsSuffix.length > 0

  return (
    <SwipeableCard onDelete={() => onDelete(thread)}>
      <View style={[styles.conversaRow, { borderBottomColor: c.border }]}>
        <Pressable
          onPress={() => onSelect(thread)}
          style={({ pressed }) => [styles.conversaRowBody, { opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={`abrir conversa ${thread.title || 'sem título'}`}
          accessibilityState={{ selected: isCurrent }}
        >
          <View style={styles.conversaTopRow}>
            <View style={styles.conversaTopMeta}>
              {showModeChip ? (
                <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.bronze} weight="med">
                  {atlasAiModeLabel(mode).toUpperCase()}
                </Mono>
              ) : null}
              {showCliBadge ? (
                <>
                  {showModeChip ? (
                    <Frau italic size={10} lineHeight={14} color={c.ink3} style={styles.conversaTopSep}>
                      ·
                    </Frau>
                  ) : null}
                  <Mono weight="med" size={10} lineHeight={14} letterSpacing={1.4} color={c.bronze}>
                    CLI
                  </Mono>
                </>
              ) : null}
              {showAtualChip ? (
                <>
                  {showModeChip || showCliBadge ? (
                    <Frau italic size={10} lineHeight={14} color={c.ink3} style={styles.conversaTopSep}>
                      ·
                    </Frau>
                  ) : null}
                  <Frau italic size={11} lineHeight={14} color={c.bronze}>
                    atual
                  </Frau>
                </>
              ) : null}
            </View>
            {timestamp ? (
              <Frau italic size={11} lineHeight={14} color={c.ink3}>
                {timestamp}
              </Frau>
            ) : null}
          </View>
          {showMetaLine || timestamp ? <View style={styles.conversaTopGap} /> : null}
          <Sans weight="med" size={16} lineHeight={22} color={c.ink} letterSpacing={-0.1} numberOfLines={2}>
            {thread.title || 'Conversa Atlas'}
          </Sans>
          {hasSignals ? (
            <Frau italic size={13} lineHeight={18} color={c.ink2} numberOfLines={1} style={styles.conversaSignals}>
              {workspace ? (
                <Frau italic size={13} lineHeight={18} color={isHomeWorkspace ? c.ink3 : c.ink2}>
                  {workspace}
                </Frau>
              ) : null}
              {workspace && signalsSuffix.length > 0 ? ' · ' : ''}
              {signalsSuffix.join(' · ')}
            </Frau>
          ) : null}
        </Pressable>
      </View>
    </SwipeableCard>
  )
})

const HistoricoSkeleton = memo(function HistoricoSkeleton() {
  const { c } = useTheme()
  return (
    <View style={styles.skeletonContainer}>
      <Frau italic size={13} lineHeight={19} color={c.ink3} align="center" style={{ marginBottom: 18 }}>
        consultando memória…
      </Frau>
      {Array.from({ length: 5 }).map((_, idx) => (
        <View key={idx} style={[styles.skeletonRow, { borderBottomColor: c.border }]}>
          <View style={[styles.skeletonLineMeta, { backgroundColor: `${c.ink3}1A` }]} />
          <View style={[styles.skeletonLineTitle, { backgroundColor: `${c.ink2}1A` }]} />
          <View style={[styles.skeletonLineSub, { backgroundColor: `${c.ink3}14` }]} />
        </View>
      ))}
    </View>
  )
})

function EmCursoCard({
  thread,
  onContinue,
}: {
  thread: AtlasAiThread
  onContinue: () => void
}) {
  const { c } = useTheme()
  const turnsLabel = thread.message_count === 1 ? '1 turno' : `${thread.message_count} turnos`
  const workspace = compactThreadWorkspace(thread)
  const provider = providerWord(thread.last_provider) ?? 'codex'

  return (
    <View
      style={[
        styles.emCursoCard,
        {
          backgroundColor: `${c.bronze}0A`,
          borderLeftColor: c.bronze,
          borderColor: `${c.bronze}33`,
        },
      ]}
    >
      <View style={styles.emCursoMeta}>
        <Frau italic size={13} lineHeight={18} color={c.bronze} style={{ marginRight: 6 }}>
          ✦
        </Frau>
        <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.bronze} weight="med">
          RODANDO
        </Mono>
        <MetaSep />
        <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.ink2}>
          {threadActiveDuration(thread).toUpperCase()}
        </Mono>
        <MetaSep />
        <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.ink2}>
          {turnsLabel.toUpperCase()}
        </Mono>
      </View>
      <Sans weight="med" size={15.5} lineHeight={21} color={c.ink} letterSpacing={-0.05} numberOfLines={3} style={styles.emCursoTitle}>
        {thread.title || 'Sessão Atlas CLI'}
      </Sans>
      {workspace ? (
        <Frau italic size={13} lineHeight={19} color={c.ink2} numberOfLines={2} style={styles.emCursoWorkspace}>
          {provider} · {workspace}
        </Frau>
      ) : null}
      <View style={styles.emCursoActions}>
        <Pressable onPress={onContinue} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}>
          <Mono weight="med" size={10} lineHeight={14} letterSpacing={1.4} color={c.bronze}>
            CONTINUAR AQUI
          </Mono>
        </Pressable>
        <Mono size={10} lineHeight={14} color={c.ink3} style={styles.emCursoActionSep}>·</Mono>
        <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.ink2}>
          VER LOGS
        </Mono>
        <Mono size={10} lineHeight={14} color={c.ink3} style={styles.emCursoActionSep}>·</Mono>
        <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.ink2}>
          INTERROMPER
        </Mono>
      </View>
    </View>
  )
}

function MetaSep() {
  const { c } = useTheme()
  return (
    <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.ink3} style={{ marginHorizontal: 8 }}>
      ·
    </Mono>
  )
}

function providerFromThreadGovernance(thread: AtlasAiThread): string | null {
  const metadata = thread.metadata ?? {}
  const governance = recordFrom(metadata.provider_governance)
  return (
    metadataString(governance ?? metadata, 'execution_provider')
    ?? metadataString(governance ?? metadata, 'selected_provider')
    ?? thread.last_provider
    ?? null
  )
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

const styles = StyleSheet.create({
  headingRule: {
    width: 32,
    height: StyleSheet.hairlineWidth,
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 22,
  },
  historicoContent: {
    paddingTop: 20,
    paddingBottom: 36,
  },
  historicoSub: {
    marginTop: 8,
    marginBottom: 14,
  },
  historicoErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 32,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderLeftWidth: 3,
  },
  historicoSearch: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 42,
    marginHorizontal: 32,
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 18,
  },
  historicoFilter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginHorizontal: 32,
    marginBottom: 24,
    gap: 0,
  },
  historicoFilterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  historicoFilterActive: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
  },
  historicoFilterCount: {
    marginLeft: 4,
  },
  historicoFilterSep: {
    paddingHorizontal: 8,
    opacity: 0.45,
  },
  skeletonContainer: {
    paddingHorizontal: 32,
    marginTop: 8,
  },
  skeletonRow: {
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  skeletonLineMeta: {
    width: 84,
    height: 8,
    borderRadius: 1,
    marginBottom: 12,
  },
  skeletonLineTitle: {
    width: '78%',
    height: 14,
    borderRadius: 1,
    marginBottom: 10,
  },
  skeletonLineSub: {
    width: '52%',
    height: 10,
    borderRadius: 1,
  },
  emCursoCard: {
    marginHorizontal: 32,
    marginTop: 18,
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderLeftWidth: 3,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 2,
  },
  emCursoMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  emCursoTitle: {
    marginBottom: 6,
  },
  emCursoWorkspace: {
    marginBottom: 14,
  },
  emCursoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 0,
  },
  emCursoActionSep: {
    marginHorizontal: 12,
    opacity: 0.55,
  },
  novaConversaAnchor: {
    marginHorizontal: 32,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  novaConversaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 14,
    paddingVertical: 14,
    paddingBottom: 18,
  },
  novaConversaText: {
    flex: 1,
    gap: 4,
  },
  conversaRow: {
    marginHorizontal: 32,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  conversaRowBody: {},
  conversaTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    minHeight: 14,
  },
  conversaTopMeta: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 1,
  },
  conversaTopSep: {
    marginHorizontal: 6,
  },
  conversaTopGap: {
    height: 6,
  },
  conversaSignals: {
    marginTop: 6,
  },
  groupOrnament: {
    marginTop: 26,
    marginBottom: 14,
  },
  groupOrnamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 32,
  },
  groupOrnamentLine: {
    flex: 1,
    height: 1,
  },
  groupOrnamentLabel: {
    marginTop: 10,
  },
  loadMoreRow: {
    alignItems: 'center',
    paddingVertical: 28,
  },
})
