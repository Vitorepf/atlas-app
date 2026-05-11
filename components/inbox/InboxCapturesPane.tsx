import { Fragment, type Dispatch, type SetStateAction, useCallback } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { type InboxItem } from '../InboxCard'
import { Frau, Mono } from '../../design/Type'
import { fonts } from '../../design/tokens'
import { usePalette } from '../../design/theme'
import type { useInboxCaptures } from '../../lib/useInboxCaptures'
import type { useInboxCaptureActions } from '../../lib/useInboxCaptureActions'
import { FILTERS } from '../../lib/inboxConstants'
import { nextSort, sortLabel } from '../../lib/inboxCaptureModels'
import type { InboxFilter, InboxSort } from '../../lib/inboxTypes'
import { InboxDomainStatus, type InboxDomainFilter } from './InboxDomainStatus'
import { FilterChip } from './InboxFilterChip'
import { BulkActionBar, SnoozeChoiceBar, TaskPriorityBar } from './InboxCaptureActionPanels'
import { MemoInboxCaptureList as InboxCaptureList } from './InboxCaptureList'
import { InboxProjectProposalPanel } from './InboxProjectProposalPanel'
import type { useInboxFilterSlider } from './useInboxFilterSlider'
import { styles } from './inboxScreenStyles'

interface Props {
  captureActions: ReturnType<typeof useInboxCaptureActions>
  captureInbox: ReturnType<typeof useInboxCaptures>
  domainFilter: InboxDomainFilter
  filter: InboxFilter
  filterSlider: ReturnType<typeof useInboxFilterSlider>
  focusMode: boolean
  loading: boolean
  onOpenDetail: (item: InboxItem) => void
  openDomainFilter: (domain: InboxDomainFilter, onChange: (domain: InboxDomainFilter) => void) => void
  query: string
  searchFocused: boolean
  setDomainFilter: (domain: InboxDomainFilter) => void
  setFilter: (filter: InboxFilter) => void
  setQuery: (query: string) => void
  setSearchFocused: (focused: boolean) => void
  setSort: Dispatch<SetStateAction<InboxSort>>
  sort: InboxSort
}

export function InboxCapturesPane({
  captureActions,
  captureInbox,
  domainFilter,
  filter,
  filterSlider,
  focusMode,
  loading,
  onOpenDetail,
  openDomainFilter,
  query,
  searchFocused,
  setDomainFilter,
  setFilter,
  setQuery,
  setSearchFocused,
  setSort,
  sort,
}: Props) {
  const c = usePalette()
  const { freshIds, groups, openItems } = captureInbox
  const {
    askProjectPlan,
    askSnooze,
    askTaskPriority,
    busyCaptureId,
    cancelProjectPlan,
    confirmProjectPlan,
    openDestination,
    projectPlanDraft,
    projectProposal,
    regenerateProjectPlan,
    runBulkAction,
    runQuickAction,
    runSnoozeChoice,
    runTaskWithPriority,
    selectedIds,
    selectionMode,
    setProjectPlanDraft,
    setSelectedIds,
    setSelectionMode,
    setSnoozeTarget,
    setTaskPriorityItem,
    snoozeTarget,
    taskPriorityItem,
    toggleSelected,
  } = captureActions
  const runArchive = useCallback((item: InboxItem) => {
    void runQuickAction(item, 'archive')
  }, [runQuickAction])
  const runPromote = useCallback((item: InboxItem) => {
    void runQuickAction(item, 'promote')
  }, [runQuickAction])
  const runCreateProject = useCallback((item: InboxItem) => {
    void askProjectPlan(item)
  }, [askProjectPlan])
  const runBulkArchive = useCallback(() => {
    void runBulkAction('archive')
  }, [runBulkAction])
  const runBulkPromote = useCallback(() => {
    void runBulkAction('promote')
  }, [runBulkAction])
  const startBulkSnooze = useCallback(() => {
    setSnoozeTarget('bulk')
  }, [setSnoozeTarget])
  const chooseTaskPriority = useCallback((priority: Parameters<typeof runTaskWithPriority>[0]) => {
    void runTaskWithPriority(priority)
  }, [runTaskWithPriority])
  const chooseSnooze = useCallback((days: number, reason: string) => {
    void runSnoozeChoice(days, reason)
  }, [runSnoozeChoice])
  const submitProjectPlan = useCallback(() => {
    void confirmProjectPlan()
  }, [confirmProjectPlan])
  const rerollProjectPlan = useCallback(() => {
    void regenerateProjectPlan()
  }, [regenerateProjectPlan])
  const selectNextSort = useCallback(() => {
    setSort((current) => nextSort(current))
  }, [setSort])

  return (
        <Animated.View
          entering={FadeIn.duration(280)}
          exiting={FadeOut.duration(180)}
        >
          {!focusMode ? (
            <InboxDomainStatus
              domain={domainFilter}
              onPress={() => openDomainFilter(domainFilter, setDomainFilter)}
            />
          ) : null}

          {/* canon mockup search-line · hairline-bottom 1px @18% ink + padding
              14/0 + mx 32. Sem bg, sem radius, sem shadow. "buscar" Frau italic
              15 ink3, "selecionar" mono caps 10 lspc 1.6 ink2 à direita.
              Borda inferior bronze@45% no focus (signal sussurrado). */}
          {!focusMode ? (
          <View
            style={[
              styles.searchLine,
              {
                borderBottomColor: searchFocused
                  ? 'rgba(155,122,63,0.45)'
                  : 'rgba(26,22,18,0.18)',
              },
            ]}
          >
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="buscar"
              placeholderTextColor={c.ink3}
              selectionColor={c.bronze}
              style={[styles.searchLineInput, { color: c.ink, fontFamily: fonts.serifItalic }]}
            />
            <Pressable
              onPress={() => {
                setSelectionMode((value) => !value)
                setSelectedIds([])
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={selectionMode ? 'Cancelar seleção' : 'Selecionar capturas'}
              style={({ pressed }) => [{ opacity: pressed ? 0.55 : 1 }]}
            >
              <Mono
                size={10}
                lineHeight={14}
                letterSpacing={1.6}
                color={selectionMode ? c.ink : c.ink2}
                style={styles.uppercase}
              >
                {selectionMode ? 'CANCELAR' : 'SELECIONAR'}
              </Mono>
            </Pressable>
          </View>
          ) : null}

          {!focusMode ? (
            <View style={styles.filterStripWrap}>
              <View style={styles.filterStrip}>
                {FILTERS.map((option, idx) => (
                  // Fragment-style render · separator + chip lado a lado direto
                  // no flexbox da strip. A faixa agora quebra linha para nunca
                  // cortar "falha" ou esconder estado atrás de fade/arrow.
                  <Fragment key={option.key}>
                    {idx > 0 ? (
                      // canon mockup .filter-tabs .sep · "·" italic Frau ink3
                      // entre chips. Decorativo, sem hit area, não interfere
                      // no slider underline (que mede só os FilterChips).
                      <Frau italic size={15} lineHeight={20} color={c.ink3} style={styles.filterChipSep}>
                        ·
                      </Frau>
                    ) : null}
                    <FilterChip
                      label={option.label}
                      count={captureInbox.filterCounts[option.key]}
                      active={filter === option.key}
                      onPress={() => setFilter(option.key)}
                      onLayoutChip={(layout) => filterSlider.onLayout(option.key, layout)}
                    />
                  </Fragment>
                ))}
                <Pressable
                  onPress={selectNextSort}
                  hitSlop={6}
                  style={({ pressed }) => [styles.sortLink, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Frau italic size={13} lineHeight={17} color={c.ink2} style={{ opacity: 0.8 }}>
                    · por {sortLabel(sort)}
                  </Frau>
                </Pressable>
              </View>
            </View>
          ) : null}

          {selectionMode ? (
            <BulkActionBar
              onArchive={runBulkArchive}
              onPromote={runBulkPromote}
              onSnooze={startBulkSnooze}
              selectedCount={selectedIds.length}
            />
          ) : null}

          <TaskPriorityBar
            item={taskPriorityItem}
            onCancel={() => setTaskPriorityItem(null)}
            onChoose={chooseTaskPriority}
          />

          <SnoozeChoiceBar
            onCancel={() => setSnoozeTarget(null)}
            onChoose={chooseSnooze}
            selectedCount={selectedIds.length}
            target={snoozeTarget}
          />

          {projectProposal ? (
            <InboxProjectProposalPanel
              draft={projectPlanDraft}
              onCancel={cancelProjectPlan}
              onChangeDraft={setProjectPlanDraft}
              onConfirm={submitProjectPlan}
              onRegenerate={rerollProjectPlan}
              proposal={projectProposal}
            />
          ) : null}

          <InboxCaptureList
            actionBusy={busyCaptureId}
            filter={filter}
            freshIds={freshIds}
            groups={groups}
            loading={loading}
            onArchive={runArchive}
            onCreateProject={runCreateProject}
            onCreateTask={askTaskPriority}
            onOpen={onOpenDetail}
            onOpenDestination={openDestination}
            onPromote={runPromote}
            onSnooze={askSnooze}
            onToggleSelected={toggleSelected}
            openCount={openItems.length}
            selectedIds={selectedIds}
            selectionMode={selectionMode}
          />
        </Animated.View>
  )
}
