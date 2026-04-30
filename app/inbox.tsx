import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useFocusEffect, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { InboxCard, type InboxItem } from '../components/InboxCard'
import { InboxSkeleton } from '../components/InboxSkeleton'
import { EmptyInbox } from '../components/EmptyInbox'
import { SectionHeader } from '../components/SectionHeader'
import {
  InboxDomainStatus,
  type InboxDomainFilter,
} from '../components/inbox/InboxDomainStatus'
import { CaptureButton } from '../components/inbox/CaptureButton'
import { OperationalInboxCard } from '../components/inbox/OperationalInboxCard'
import { Frau, Sans } from '../design/Type'
import { fonts } from '../design/tokens'
import { usePalette } from '../design/theme'
import { useOverlays } from '../lib/overlays'
import { useShell } from '../components/AtlasShell'
import { captureToInboxItem, useAtlasStore, visibleCaptures } from '../lib/atlasStore'
import {
  AtlasApiError,
  acceptProjectPlanProposal,
  dismissMobileInboxItem,
  discussMobileInboxItem,
  getMobileDeviceSession,
  hydrateApiConfig,
  listMobileInbox,
  proposeCaptureProjectPlan,
  regenerateProjectPlanProposal,
  respondMobileInboxItem,
  type AtlasProjectPlanProposal,
  type AtlasOperationalInboxItem,
  type CaptureTriageInput,
} from '../lib/api/client'

type InboxFilter = 'open' | 'candidate' | 'proposal' | 'no_destination' | 'snoozed' | 'routed' | 'failed' | 'pending'
type InboxSort = 'recent' | 'oldest' | 'needs_triage'
type QuickAction = 'promote' | 'create_task' | 'create_project' | 'snooze' | 'archive'
type BulkAction = 'promote' | 'snooze' | 'archive'
type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
type ProjectPlanDraft = {
  title: string
  nextAction: string
  priority: TaskPriority
  estimatedMinutes: string
}

const FILTERS: Array<{ key: InboxFilter; label: string }> = [
  { key: 'open', label: 'abertas' },
  { key: 'no_destination', label: 'sem destino' },
  { key: 'candidate', label: 'candidatas' },
  { key: 'proposal', label: 'propostas' },
  { key: 'snoozed', label: 'adiadas' },
  { key: 'failed', label: 'falhas' },
  { key: 'pending', label: 'pendentes' },
  { key: 'routed', label: 'com destino' },
]

const TASK_PRIORITIES: Array<{ key: TaskPriority; label: string }> = [
  { key: 'low', label: 'baixa' },
  { key: 'normal', label: 'normal' },
  { key: 'high', label: 'alta' },
  { key: 'urgent', label: 'urgente' },
]

const SNOOZE_CHOICES: Array<{ key: string; label: string; days: number; reason: string }> = [
  { key: 'tomorrow', label: 'amanhã', days: 1, reason: 'Adiada para revisão amanhã.' },
  { key: 'week', label: '7 dias', days: 7, reason: 'Adiada por uma semana.' },
  { key: 'month', label: '30 dias', days: 30, reason: 'Adiada por trinta dias.' },
]

const ROMAN_MONTHS = [
  'I', 'II', 'III', 'IV', 'V', 'VI',
  'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
]

export default function InboxScreen() {
  const c = usePalette()
  const router = useRouter()
  const { showToast } = useShell()
  const openDetail = useOverlays((s) => s.openDetail)
  const openDomainFilter = useOverlays((s) => s.openInboxDomainFilter)
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
  const [filter, setFilter] = useState<InboxFilter>('open')
  const [domainFilter, setDomainFilter] = useState<InboxDomainFilter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<InboxSort>('recent')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [busyCaptureId, setBusyCaptureId] = useState<string | null>(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const [taskPriorityItem, setTaskPriorityItem] = useState<InboxItem | null>(null)
  const [snoozeTarget, setSnoozeTarget] = useState<InboxItem | 'bulk' | null>(null)
  const [projectPlanItem, setProjectPlanItem] = useState<InboxItem | null>(null)
  const [projectProposal, setProjectProposal] = useState<AtlasProjectPlanProposal | null>(null)
  const [projectPlanDraft, setProjectPlanDraft] = useState<ProjectPlanDraft>(() => defaultProjectPlanDraft())
  const [operationalItems, setOperationalItems] = useState<AtlasOperationalInboxItem[]>([])
  const [operationalBusyId, setOperationalBusyId] = useState<string | null>(null)
  const [mobilePaired, setMobilePaired] = useState<boolean | null>(null)
  const searchFocus = useSharedValue(0)

  useEffect(() => {
    searchFocus.value = withTiming(searchFocused ? 1 : 0, { duration: 220 })
  }, [searchFocused, searchFocus])

  const searchPillStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(searchFocus.value, [0, 1], [0.07, 0.13]),
    shadowRadius: interpolate(searchFocus.value, [0, 1], [12, 18]),
    transform: [{ translateY: interpolate(searchFocus.value, [0, 1], [0, -1]) }],
  }))

  const visibleItems = useMemo(
    () => items.filter((item) => isVisibleInboxItem(item)),
    [items],
  )
  const openItems = useMemo(
    () => visibleItems.filter((item) => isOpenInboxItem(item)),
    [visibleItems],
  )
  const metrics = useMemo(() => inboxMetrics(openItems), [openItems])
  const filteredItems = useMemo(() => {
    const baseItems = filter === 'snoozed' || filter === 'proposal' ? items : visibleItems

    return baseItems
        .filter((item) => domainFilter === 'all' || item.domain === domainFilter)
        .filter((item) => matchesQuery(item, query))
        .filter((item) => filterItem(item, filter))
  }, [items, visibleItems, domainFilter, filter, query])
  const sortedItems = useMemo(() => sortItems(filteredItems, sort), [filteredItems, sort])
  const groups = useMemo(() => groupByDate(sortedItems), [sortedItems])

  useEffect(() => {
    const openIds = new Set(openItems.map((item) => item.id))
    setSelectedIds((current) => {
      const next = current.filter((id) => openIds.has(id))
      return next.length === current.length ? current : next
    })
  }, [openItems])

  const [loading, setLoading] = useState(!hydrated)
  useEffect(() => {
    void hydrate().then(() => sync())
  }, [hydrate, sync])

  const refreshOperationalInbox = useCallback(async () => {
    try {
      const response = await listMobileInbox({ status: 'unread', limit: 25 })
      setOperationalItems(response.items)
      setMobilePaired(true)
    } catch (error) {
      if (error instanceof AtlasApiError && error.status === 401) {
        setOperationalItems([])
        setMobilePaired(false)
        return
      }
      showToast('falha ao carregar inbox operacional')
    }
  }, [showToast])

  useFocusEffect(
    useCallback(() => {
      let active = true
      void hydrateApiConfig().then(() => {
        if (active) setMobilePaired(Boolean(getMobileDeviceSession()))
      })
      void refreshOperationalInbox()

      return () => {
        active = false
      }
    }, [refreshOperationalInbox]),
  )

  useEffect(() => {
    if (!hydrated) return
    void refreshOperationalInbox()
  }, [hydrated, refreshOperationalInbox])

  useEffect(() => {
    if (!hydrated) return
    if (!loading) return
    const t = setTimeout(() => setLoading(false), 360)
    return () => clearTimeout(t)
  }, [hydrated, loading])

  const toggleSelected = (item: InboxItem) => {
    if (!isOpenInboxItem(item)) return

    setSelectedIds((current) => current.includes(item.id) ? current.filter((x) => x !== item.id) : [...current, item.id])
  }

  const runQuickAction = async (
    item: InboxItem,
    action: QuickAction,
    overrides: Partial<CaptureTriageInput> = {},
  ) => {
    if (item.isLocal || busyCaptureId) return

    setBusyCaptureId(item.id)
    try {
      const result = await triageCapture(item.id, triageInputFor(item, action, overrides))
      showToast(result ? quickActionMessage(action) : 'falha ao aplicar ação')
    } finally {
      setBusyCaptureId(null)
    }
  }

  const askTaskPriority = (item: InboxItem) => {
    if (item.isLocal || busyCaptureId) return
    setTaskPriorityItem(item)
  }

  const askSnooze = (item: InboxItem) => {
    if (item.isLocal || busyCaptureId) return
    setSnoozeTarget(item)
  }

  const askProjectPlan = async (item: InboxItem) => {
    if (item.isLocal || busyCaptureId) return

    setBusyCaptureId(item.id)
    try {
      const proposal = await proposeCaptureProjectPlan(item.id, {
        title: compactTitle(item),
        metadata: { entrypoint: 'inbox_project_button' },
      })
      setProjectPlanItem(item)
      setProjectProposal(proposal)
      setProjectPlanDraft(draftFromProposal(proposal))
      showToast('proposta de projeto criada')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'falha ao criar proposta')
    } finally {
      setBusyCaptureId(null)
    }
  }

  const confirmProjectPlan = async () => {
    if (!projectProposal || busyCaptureId) return

    setBusyCaptureId(projectPlanItem?.id ?? projectProposal.id)
    try {
      await acceptProjectPlanProposal(projectProposal.id, {
        title: projectPlanDraft.title.trim() || projectProposal.proposed_title,
        next_action: projectPlanDraft.nextAction.trim() || projectProposal.first_next_action,
        priority: projectPlanDraft.priority,
        estimated_minutes: minutesFromDraft(projectPlanDraft.estimatedMinutes, projectProposal.estimated_duration_minutes),
      })
      setProjectPlanItem(null)
      setProjectProposal(null)
      setProjectPlanDraft(defaultProjectPlanDraft())
      await sync()
      showToast('projeto criado com próxima ação')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'falha ao confirmar projeto')
    } finally {
      setBusyCaptureId(null)
    }
  }

  const regenerateProjectPlan = async () => {
    if (!projectProposal || busyCaptureId) return

    setBusyCaptureId(projectPlanItem?.id ?? projectProposal.id)
    try {
      const proposal = await regenerateProjectPlanProposal(projectProposal.id, {
        title: projectPlanDraft.title.trim() || projectProposal.proposed_title,
        next_action: projectPlanDraft.nextAction.trim() || projectProposal.first_next_action,
        priority: projectPlanDraft.priority,
        estimated_minutes: minutesFromDraft(projectPlanDraft.estimatedMinutes, projectProposal.estimated_duration_minutes),
        instruction: 'Gerar uma versão mais clara, menor e mais executável para TDAH.',
        metadata: { entrypoint: 'inbox_project_regenerate' },
      })
      setProjectProposal(proposal)
      setProjectPlanDraft(draftFromProposal(proposal))
      showToast('proposta recalculada')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'falha ao regenerar proposta')
    } finally {
      setBusyCaptureId(null)
    }
  }

  const cancelProjectPlan = () => {
    setProjectPlanItem(null)
    setProjectProposal(null)
    setProjectPlanDraft(defaultProjectPlanDraft())
  }

  const openDestination = (item: InboxItem) => {
    if ((item.targetType === 'project' || item.triageDestination === 'project') && item.targetId) {
      router.push({ pathname: '/projects', params: { projectId: item.targetId } })
      return
    }

    if ((item.targetType === 'task' || item.triageDestination === 'task') && item.targetId) {
      router.push('/')
      return
    }

    openDetail(item)
  }

  const runTaskWithPriority = async (priority: TaskPriority) => {
    const item = taskPriorityItem
    if (!item || busyCaptureId) return

    setTaskPriorityItem(null)
    await runQuickAction(item, 'create_task', {
      priority,
      reason: `Tarefa criada pelo Inbox com prioridade ${taskPriorityLabel(priority)}.`,
    })
  }

  const runSnoozeChoice = async (days: number, reason: string) => {
    const target = snoozeTarget
    if (!target || busyCaptureId) return

    setSnoozeTarget(null)
    const snoozed_until = daysFromNowIso(days)
    if (target === 'bulk') {
      await runBulkAction('snooze', { snoozed_until, reason })
      return
    }

    await runQuickAction(target, 'snooze', { snoozed_until, reason })
  }

  const runBulkAction = async (
    action: BulkAction,
    overrides: Partial<CaptureTriageInput> = {},
  ) => {
    if (selectedIds.length === 0 || busyCaptureId) return

    setBusyCaptureId('bulk')
    let ok = 0
    try {
      for (const id of selectedIds) {
        const item = items.find((candidate) => candidate.id === id)
        if (!item) continue
        const result = await triageCapture(id, triageInputFor(item, action, overrides))
        if (result) ok++
      }
      showToast(`${ok} ${ok === 1 ? 'captura atualizada' : 'capturas atualizadas'}`)
      setSelectedIds([])
      setSelectionMode(false)
    } finally {
      setBusyCaptureId(null)
    }
  }

  const runOperationalAction = async (item: AtlasOperationalInboxItem, actionId: string) => {
    if (operationalBusyId) return

    setOperationalBusyId(item.id)
    try {
      if (actionId === 'dismiss' || actionId === 'discard') {
        await dismissMobileInboxItem(item.id, `Ação ${actionId} pelo app.`)
      } else if (actionId === 'discuss') {
        const response = await discussMobileInboxItem(item.id)
        const threadId = threadIdFromActionResult(response.result)
        if (threadId) {
          router.push({ pathname: '/mobile-thread', params: { threadId } })
        } else {
          showToast('thread contextual criada')
        }
      } else {
        await respondMobileInboxItem(item.id, actionId)
      }

      await refreshOperationalInbox()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'falha ao aplicar ação')
    } finally {
      setOperationalBusyId(null)
    }
  }

  return (
    <Screen>
      <View style={[styles.titleBlock, styles.titleRow]}>
        <View style={styles.titleColumn}>
          <Frau size={42} lineHeight={44} letterSpacing={-1.05} color={c.ink}>
            Inbox
          </Frau>
          <MetaLine metrics={metrics} />
        </View>
        <CaptureButton onPress={() => router.push('/capture?mode=text')} />
      </View>

      <InboxDomainStatus
        domain={domainFilter}
        onPress={() => openDomainFilter(domainFilter, setDomainFilter)}
      />

      <Animated.View
        style={[
          styles.searchPill,
          searchPillStyle,
          {
            backgroundColor: searchFocused ? c.premium : c.surface,
            shadowColor: '#1A1612',
          },
        ]}
      >
        <View style={[styles.searchTopGloss, { backgroundColor: 'rgba(255,255,255,0.22)' }]} pointerEvents="none" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="buscar"
          placeholderTextColor={c.ink2}
          selectionColor={c.ink}
          style={[styles.searchInput, { color: c.ink }]}
        />
        <Pressable
          onPress={() => {
            setSelectionMode((value) => !value)
            setSelectedIds([])
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.selectionLink, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Frau italic size={12.5} lineHeight={16} color={selectionMode ? c.ink : c.ink2}>
            · {selectionMode ? 'cancelar' : 'selecionar'}
          </Frau>
        </Pressable>
      </Animated.View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterStrip}
        style={styles.filterScroll}
      >
        {FILTERS.map((option) => (
          <FilterChip
            key={option.key}
            label={option.label}
            active={filter === option.key}
            onPress={() => setFilter(option.key)}
          />
        ))}
        <Pressable
          onPress={() => setSort(nextSort(sort))}
          hitSlop={6}
          style={({ pressed }) => [styles.sortLink, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Frau italic size={13} lineHeight={17} color={c.ink2} style={{ opacity: 0.8 }}>
            · por {sortLabel(sort)}
          </Frau>
        </Pressable>
      </ScrollView>

      {selectionMode && selectedIds.length > 0 ? (
        <View style={[styles.bulkBar, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Sans size={12} lineHeight={16} color={c.ink2}>{selectedIds.length} selecionadas</Sans>
          <ActionText label="Promover" onPress={() => void runBulkAction('promote')} />
          <ActionText label="Adiar" onPress={() => setSnoozeTarget('bulk')} />
          <ActionText label="Arquivar" danger onPress={() => void runBulkAction('archive')} />
        </View>
      ) : null}

      {taskPriorityItem ? (
        <View style={[styles.priorityBar, { borderColor: c.border, backgroundColor: c.surface }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Sans weight="med" size={12} lineHeight={16} color={c.ink}>
              Prioridade da tarefa
            </Sans>
            <Sans size={11.5} lineHeight={15} color={c.ink2} numberOfLines={1}>
              {compactTitle(taskPriorityItem)}
            </Sans>
          </View>
          <View style={styles.priorityOptions}>
            {TASK_PRIORITIES.map((priority) => (
              <PriorityChip
                key={priority.key}
                label={priority.label}
                onPress={() => void runTaskWithPriority(priority.key)}
              />
            ))}
            <ActionText label="Cancelar" onPress={() => setTaskPriorityItem(null)} />
          </View>
        </View>
      ) : null}

      {snoozeTarget ? (
        <View style={[styles.priorityBar, { borderColor: c.border, backgroundColor: c.surface }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Sans weight="med" size={12} lineHeight={16} color={c.ink}>
              Adiar captura
            </Sans>
            <Sans size={11.5} lineHeight={15} color={c.ink2} numberOfLines={1}>
              {snoozeTarget === 'bulk' ? `${selectedIds.length} selecionadas` : compactTitle(snoozeTarget)}
            </Sans>
          </View>
          <View style={styles.priorityOptions}>
            {SNOOZE_CHOICES.map((choice) => (
              <PriorityChip
                key={choice.key}
                label={choice.label}
                onPress={() => void runSnoozeChoice(choice.days, choice.reason)}
              />
            ))}
            <ActionText label="Cancelar" onPress={() => setSnoozeTarget(null)} />
          </View>
        </View>
      ) : null}

      {projectProposal ? (
        <View style={[styles.projectProposal, { borderColor: c.border, backgroundColor: c.surface }]}>
          <View style={styles.projectProposalHeader}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Sans weight="sb" size={12} lineHeight={16} color={c.ink}>
                Proposta de projeto
              </Sans>
              <Sans size={11.5} lineHeight={15} color={c.ink2} numberOfLines={1}>
                IA propõe. Vitor confirma.
              </Sans>
            </View>
            <Sans weight="sb" size={11} lineHeight={14} color={c.bronze}>
              {String(projectProposal.project_type).replace('_', ' ').toUpperCase()}
            </Sans>
          </View>

          <LabeledInput
            label="título"
            value={projectPlanDraft.title}
            onChangeText={(title) => setProjectPlanDraft((draft) => ({ ...draft, title }))}
          />
          <ProposalText label="resultado" value={projectProposal.desired_outcome} />
          <ProposalText label="menor resultado útil" value={projectProposal.minimum_useful_result} />
          <LabeledInput
            label="próxima ação"
            value={projectPlanDraft.nextAction}
            multiline
            onChangeText={(nextAction) => setProjectPlanDraft((draft) => ({ ...draft, nextAction }))}
          />

          <View style={styles.projectProposalRow}>
            <View style={{ flex: 1 }}>
              <Sans size={10.5} lineHeight={13} color={c.ink2} style={styles.fieldLabel}>
                prioridade
              </Sans>
              <View style={styles.priorityOptions}>
                {TASK_PRIORITIES.map((priority) => (
                  <PriorityChip
                    key={priority.key}
                    label={priority.label}
                    active={projectPlanDraft.priority === priority.key}
                    onPress={() => setProjectPlanDraft((draft) => ({ ...draft, priority: priority.key }))}
                  />
                ))}
              </View>
            </View>
            <View style={styles.minutesField}>
              <Sans size={10.5} lineHeight={13} color={c.ink2} style={styles.fieldLabel}>
                minutos
              </Sans>
              <TextInput
                value={projectPlanDraft.estimatedMinutes}
                onChangeText={(estimatedMinutes) => setProjectPlanDraft((draft) => ({ ...draft, estimatedMinutes }))}
                keyboardType="number-pad"
                placeholder="25"
                placeholderTextColor={c.ink2}
                style={[styles.minutesInput, { color: c.ink, borderColor: c.border }]}
              />
            </View>
          </View>

          <ProposalText label="por que o Atlas sugeriu" value={projectProposal.rationale} />

          <View style={styles.projectProposalActions}>
            <ActionText label="Cancelar" onPress={cancelProjectPlan} />
            <ActionText label="Regerar" onPress={() => void regenerateProjectPlan()} />
            <ActionText label="Confirmar projeto" onPress={() => void confirmProjectPlan()} />
          </View>
        </View>
      ) : null}

      {mobilePaired === false ? (
        <MobileGatewayBanner onPress={() => router.push('/mobile-pairing')} />
      ) : null}

      {operationalItems.length > 0 ? (
        <View>
          <SectionHeader label="Operacional" style={styles.firstSection} />
          <View style={styles.list}>
            {operationalItems.map((item) => (
              <OperationalInboxCard
                key={item.id}
                item={item}
                busy={operationalBusyId === item.id}
                onAction={(actionId) => void runOperationalAction(item, actionId)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {loading ? (
        <InboxSkeleton />
      ) : groups.length === 0 ? (
        <EmptyInbox />
      ) : (
        <View>
          {groups.map((group, idx) => (
            <View key={group.key}>
              <SectionHeader
                label={group.label}
                style={idx === 0 ? styles.firstSection : undefined}
              />
              <View style={styles.list}>
                {group.items.map((item) => (
                  <InboxCard
                    key={item.id}
                    item={item}
                    selected={selectedIds.includes(item.id)}
                    selectionMode={selectionMode}
                    onPress={() => selectionMode ? toggleSelected(item) : openDetail(item)}
                    onPromote={() => void runQuickAction(item, 'promote')}
                    onCreateTask={() => askTaskPriority(item)}
                    onCreateProject={() => void askProjectPlan(item)}
                    onSnooze={() => askSnooze(item)}
                    onArchive={() => void runQuickAction(item, 'archive')}
                    onOpenDestination={isNavigableDestination(item) ? () => openDestination(item) : undefined}
                    actionBusy={busyCaptureId === item.id || busyCaptureId === 'bulk'}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  )
}

function MetaLine({ metrics }: { metrics: ReturnType<typeof inboxMetrics> }) {
  const c = usePalette()
  const segments: Array<{ text: string; color: string }> = [
    { text: openLabel(metrics.open), color: c.ink2 },
  ]
  if (metrics.open > 0) {
    segments.push({ text: `${metrics.averageAgeLabel} IDADE MÉDIA`, color: c.ink2 })
  }
  if (metrics.failed > 0) {
    segments.push({ text: failureLabel(metrics.failed), color: c.recRed })
  }
  return (
    <View style={styles.metaRow}>
      {segments.map((seg, i) => (
        <View key={i} style={styles.metaSegment}>
          {i > 0 ? (
            <Sans
              weight="med"
              size={11}
              lineHeight={14}
              letterSpacing={1.1}
              color={c.ink3}
            >
              ·
            </Sans>
          ) : null}
          <Sans
            weight="med"
            size={11}
            lineHeight={14}
            letterSpacing={1.1}
            color={seg.color}
            style={styles.uppercase}
          >
            {seg.text}
          </Sans>
        </View>
      ))}
    </View>
  )
}

function MobileGatewayBanner({ onPress }: { onPress: () => void }) {
  const c = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.mobileGatewayBanner,
        {
          borderColor: c.border,
          backgroundColor: pressed ? c.premium : c.surface,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={13} lineHeight={17} color={c.ink}>
          Mobile Gateway desconectado
        </Sans>
        <Sans size={12} lineHeight={16} color={c.ink2} style={{ marginTop: 3 }}>
          Pareie este app para receber push e mensagens operacionais do Atlas.
        </Sans>
      </View>
      <Sans weight="med" size={12} lineHeight={16} color={c.prussian}>
        Parear
      </Sans>
    </Pressable>
  )
}

function threadIdFromActionResult(result: Record<string, unknown>): string | null {
  const threadId = result.thread_id
  if (typeof threadId === 'string' && threadId !== '') return threadId

  const deepLink = result.deep_link
  if (typeof deepLink !== 'string') return null

  const match = deepLink.match(/^atlas:\/\/thread\/([^/?#]+)/)
  return match?.[1] ?? null
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const c = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        {
          borderColor: active ? c.ink : c.border,
          backgroundColor: active ? c.surface : 'transparent',
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Sans
        weight={active ? 'med' : 'reg'}
        size={13}
        lineHeight={17}
        color={active ? c.ink : c.ink3}
      >
        {label}
      </Sans>
    </Pressable>
  )
}

function isVisibleInboxItem(item: InboxItem): boolean {
  if (item.isArchived) return false
  if (!item.snoozedUntil) return true
  const snoozedUntil = new Date(item.snoozedUntil).getTime()
  return Number.isFinite(snoozedUntil) ? snoozedUntil <= Date.now() : true
}

function isOpenInboxItem(item: InboxItem): boolean {
  return isVisibleInboxItem(item) && !hasResolvedDestination(item)
}

function filterItem(item: InboxItem, filter: InboxFilter): boolean {
  switch (filter) {
    case 'pending':
      return Boolean(
        item.isLocal ||
          item.transcriptionStatus === 'pending' ||
          item.transcriptionStatus === 'processing',
      )
    case 'no_destination':
      return Boolean(item.isRawCapture)
    case 'candidate':
      return Boolean(item.isCurationCandidate)
    case 'snoozed':
      return Boolean(item.isSnoozed)
    case 'proposal':
      return isProposalItem(item)
    case 'routed':
      return hasResolvedDestination(item)
    case 'failed':
      return Boolean(item.transcriptionStatus === 'failed' || item.fileIntegrity === 'missing')
    case 'open':
    default:
      return isOpenInboxItem(item)
  }
}

function hasResolvedDestination(item: InboxItem): boolean {
  const destination = item.triageDestination
  if (destination && [
    'semantic_note',
    'existing_note',
    'task',
    'project',
    'hypothesis',
  ].includes(destination)) {
    return true
  }

  return Boolean(item.targetType && [
    'semantic_note',
    'semantic_curation_proposal',
    'task',
    'project',
    'hypothesis',
  ].includes(item.targetType))
}

function isProposalItem(item: InboxItem): boolean {
  return Boolean(
    item.triageDestination === 'semantic_note' ||
      item.triageDestination === 'hypothesis' ||
      item.targetType === 'semantic_curation_proposal' ||
      item.targetType === 'hypothesis',
  )
}

function isNavigableDestination(item: InboxItem): boolean {
  return Boolean(
    item.targetId &&
      ['project', 'task'].includes(String(item.targetType ?? item.triageDestination ?? '')),
  )
}

function matchesQuery(item: InboxItem, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  return [
    item.text,
    item.domain,
    item.domainLabel,
    item.statusLabel,
    item.statusDetail,
    item.triageLabel,
    item.nextStepLabel,
    item.targetTitle,
    item.linkedNoteTitle,
  ].filter(Boolean).join(' ').toLowerCase().includes(q)
}

function sortItems(items: InboxItem[], sort: InboxSort): InboxItem[] {
  const copy = [...items]
  switch (sort) {
    case 'oldest':
      return copy.sort((a, b) => dateValue(a.capturedAt) - dateValue(b.capturedAt))
    case 'needs_triage':
      return copy.sort((a, b) => triagePriority(b) - triagePriority(a) || dateValue(a.capturedAt) - dateValue(b.capturedAt))
    case 'recent':
    default:
      return copy.sort((a, b) => dateValue(b.capturedAt) - dateValue(a.capturedAt))
  }
}

function triagePriority(item: InboxItem): number {
  if (item.transcriptionStatus === 'failed' || item.fileIntegrity === 'missing') return 4
  if (item.isCurationCandidate) return 3
  if (item.isRawCapture) return 2
  if (item.transcriptionStatus === 'pending' || item.transcriptionStatus === 'processing') return 1
  return 0
}

function dateValue(value?: string | null): number {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function nextSort(sort: InboxSort): InboxSort {
  if (sort === 'recent') return 'needs_triage'
  if (sort === 'needs_triage') return 'oldest'
  return 'recent'
}

function triageInputFor(
  item: InboxItem,
  action: QuickAction,
  overrides: Partial<CaptureTriageInput> = {},
): CaptureTriageInput {
  let base: CaptureTriageInput
  switch (action) {
    case 'promote':
      base = { action, title: compactTitle(item), reason: 'Promovida pelo Inbox.' }
      break
    case 'create_task':
      base = { action, title: compactTitle(item), priority: 'normal', reason: 'Tarefa criada pelo Inbox.' }
      break
    case 'create_project':
      base = { action, title: compactTitle(item), reason: 'Projeto criado pelo Inbox.' }
      break
    case 'snooze':
      base = { action, snoozed_until: tomorrowIso(), reason: 'Adiada pelo Inbox.' }
      break
    case 'archive':
      base = { action, reason: 'Arquivada pelo Inbox.' }
      break
  }

  return { ...base, ...overrides }
}

function quickActionMessage(action: QuickAction): string {
  switch (action) {
    case 'promote':        return 'proposta criada'
    case 'create_task':    return 'tarefa criada'
    case 'create_project': return 'projeto criado'
    case 'snooze':         return 'captura adiada'
    case 'archive':        return 'captura arquivada'
  }
}

function compactTitle(item: InboxItem): string {
  return item.text.replace(/\s+/g, ' ').trim().slice(0, 120) || 'Captura sem texto'
}

function tomorrowIso(): string {
  return daysFromNowIso(1)
}

function daysFromNowIso(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function sortLabel(sort: InboxSort): string {
  switch (sort) {
    case 'oldest':       return 'antigas'
    case 'needs_triage': return 'prioridade'
    case 'recent':
    default:             return 'recentes'
  }
}

function taskPriorityLabel(priority: TaskPriority): string {
  return TASK_PRIORITIES.find((option) => option.key === priority)?.label ?? 'normal'
}

function defaultProjectPlanDraft(): ProjectPlanDraft {
  return {
    title: '',
    nextAction: '',
    priority: 'normal',
    estimatedMinutes: '25',
  }
}

function draftFromProposal(proposal: AtlasProjectPlanProposal): ProjectPlanDraft {
  return {
    title: proposal.proposed_title,
    nextAction: proposal.first_next_action,
    priority: normalizeTaskPriority(proposal.priority_suggestion),
    estimatedMinutes: String(proposal.estimated_duration_minutes || 25),
  }
}

function normalizeTaskPriority(value: string | null | undefined): TaskPriority {
  return value === 'low' || value === 'high' || value === 'urgent' ? value : 'normal'
}

function minutesFromDraft(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback || 25
  return Math.max(5, Math.min(480, parsed))
}

function LabeledInput({
  label,
  value,
  multiline,
  onChangeText,
}: {
  label: string
  value: string
  multiline?: boolean
  onChangeText: (value: string) => void
}) {
  const c = usePalette()
  return (
    <View style={styles.proposalField}>
      <Sans size={10.5} lineHeight={13} color={c.ink2} style={styles.fieldLabel}>
        {label}
      </Sans>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor={c.ink2}
        style={[
          styles.proposalInput,
          multiline ? styles.proposalInputMultiline : null,
          { color: c.ink, borderColor: c.border },
        ]}
      />
    </View>
  )
}

function ProposalText({ label, value }: { label: string; value?: string | null }) {
  const c = usePalette()
  if (!value) return null

  return (
    <View style={styles.proposalField}>
      <Sans size={10.5} lineHeight={13} color={c.ink2} style={styles.fieldLabel}>
        {label}
      </Sans>
      <Sans size={12.5} lineHeight={17} color={c.ink}>
        {value}
      </Sans>
    </View>
  )
}

function PriorityChip({
  label,
  active,
  onPress,
}: {
  label: string
  active?: boolean
  onPress: () => void
}) {
  const c = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.priorityChip,
        {
          borderColor: active ? c.prussian : c.border,
          backgroundColor: active ? c.premium : (pressed ? c.premium : c.bg),
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Sans weight="med" size={11.5} lineHeight={15} color={c.prussian}>
        {label}
      </Sans>
    </Pressable>
  )
}

function ActionText({
  label,
  danger,
  onPress,
}: {
  label: string
  danger?: boolean
  onPress: () => void
}) {
  const c = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionText, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Sans weight="med" size={12} lineHeight={16} color={danger ? c.recRed : c.prussian}>
        {label}
      </Sans>
    </Pressable>
  )
}

function inboxMetrics(items: InboxItem[]) {
  const now = Date.now()
  const ages = items
    .map((item) =>
      item.capturedAt ? now - new Date(item.capturedAt).getTime() : null,
    )
    .filter((age): age is number => age !== null && Number.isFinite(age) && age >= 0)
  const averageAgeMs = ages.length
    ? ages.reduce((sum, age) => sum + age, 0) / ages.length
    : 0

  return {
    open: items.length,
    averageAgeLabel: formatAge(averageAgeMs),
    failed: items.filter(
      (item) =>
        item.transcriptionStatus === 'failed' || item.fileIntegrity === 'missing',
    ).length,
  }
}

function formatAge(ms: number): string {
  if (!ms) return '0H'
  const hours = Math.max(1, Math.round(ms / (1000 * 60 * 60)))
  if (hours < 24) return `${hours}H`
  const days = Math.round(hours / 24)
  return `${days}D`
}

function openLabel(count: number): string {
  return count === 1 ? '1 ABERTA' : `${count} ABERTAS`
}

function failureLabel(count: number): string {
  return count === 1 ? '1 FALHA' : `${count} FALHAS`
}

interface DateGroup {
  key: string
  label: string
  items: InboxItem[]
}

function groupByDate(items: InboxItem[]): DateGroup[] {
  const map = new Map<number, DateGroup>()
  const undated: InboxItem[] = []
  for (const item of items) {
    const date = item.capturedAt ? new Date(item.capturedAt) : null
    if (!date || Number.isNaN(date.getTime())) {
      undated.push(item)
      continue
    }
    const ts = startOfDayTimestamp(date)
    if (!map.has(ts)) {
      map.set(ts, { key: String(ts), label: dateLabel(date), items: [] })
    }
    map.get(ts)!.items.push(item)
  }
  const groups = Array.from(map.values())
  if (undated.length > 0) {
    groups.push({ key: 'undated', label: 'sem data', items: undated })
  }
  return groups
}

function startOfDayTimestamp(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function dateLabel(date: Date): string {
  const today = startOfDayTimestamp(new Date())
  const target = startOfDayTimestamp(date)
  const oneDay = 24 * 60 * 60 * 1000
  if (target === today) return 'hoje'
  if (target === today - oneDay) return 'ontem'
  const day = date.getDate()
  const romanMonth = ROMAN_MONTHS[date.getMonth()]
  const year = date.getFullYear()
  return `${day}.${romanMonth}.${year}`
}

const styles = StyleSheet.create({
  titleBlock: { marginBottom: 14 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  titleColumn: { flex: 1 },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  metaSegment: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uppercase: { textTransform: 'uppercase' },
  filterScroll: { marginBottom: 8 },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 50,
    borderRadius: 16,
    paddingHorizontal: 18,
    marginTop: 6,
    marginBottom: 16,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    overflow: 'hidden',
  },
  searchTopGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 20,
    paddingVertical: 0,
  },
  selectionLink: {
    paddingVertical: 8,
  },
  sortLink: {
    paddingVertical: 6,
    paddingLeft: 4,
    alignSelf: 'center',
  },
  bulkBar: {
    minHeight: 42,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priorityBar: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 10,
  },
  projectProposal: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 12,
  },
  projectProposalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  projectProposalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  projectProposalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 14,
  },
  proposalField: {
    gap: 5,
  },
  fieldLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  proposalInput: {
    minHeight: 38,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 17,
  },
  proposalInputMultiline: {
    minHeight: 58,
    textAlignVertical: 'top',
  },
  minutesField: {
    width: 78,
    gap: 5,
  },
  minutesInput: {
    height: 34,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 10,
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 17,
  },
  priorityOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  priorityChip: {
    minHeight: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    justifyContent: 'center',
  },
  actionText: {
    minHeight: 30,
    justifyContent: 'center',
  },
  filterStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  mobileGatewayBanner: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  list: { gap: 10 },
  firstSection: { marginTop: 18 },
})
