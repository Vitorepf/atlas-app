import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState, type AppStateStatus, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
import { SwipeableCard } from '../components/inbox/SwipeableCard'
import { LiveStatus } from '../components/inbox/LiveStatus'
import { PaperVignette } from '../components/inbox/PaperVignette'
import { NewCapturesPill } from '../components/inbox/NewCapturesPill'
import { FocusModePill } from '../components/inbox/FocusModePill'
import { useFreshCaptures } from '../lib/useFreshCaptures'
import { Frau, Mono, Sans } from '../design/Type'
import { fonts } from '../design/tokens'
import { usePalette } from '../design/theme'
import { useOverlays } from '../lib/overlays'
import { useShell } from '../components/AtlasShell'
import { captureToInboxItem, useAtlasStore, visibleCaptures } from '../lib/atlasStore'
import { atlasStorage } from '../lib/storage'
import { syncAtlasBadge } from '../lib/pushNotifications'
import {
  AtlasApiError,
  acceptProjectPlanProposal,
  dismissMobileInboxItem,
  discussMobileInboxItem,
  getMobileDeviceSession,
  hydrateApiConfig,
  listMobileInbox,
  proposeCaptureProjectPlan,
  recoverMobileDeviceSession,
  regenerateProjectPlanProposal,
  respondMobileInboxItem,
  snoozeMobileInboxItem,
  type AtlasProjectPlanProposal,
  type AtlasOperationalInboxItem,
  type CaptureTriageInput,
} from '../lib/api/client'

type InboxFilter = 'open' | 'candidate' | 'proposal' | 'no_destination' | 'snoozed' | 'routed' | 'failed' | 'pending' | 'archived'
type InboxSort = 'recent' | 'oldest' | 'needs_triage'
type QuickAction = 'promote' | 'create_task' | 'create_project' | 'snooze' | 'archive'
type BulkAction = 'promote' | 'snooze' | 'archive'
type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
type OperationalFilter = 'all' | 'approval' | 'recommendation' | 'insight' | 'proposal' | 'job' | 'self_diagnostic' | 'alert'
type InboxMode = 'captures' | 'operational'
type ProjectPlanDraft = {
  title: string
  nextAction: string
  priority: TaskPriority
  estimatedMinutes: string
}

// 'no_destination' removido (2026-05) · era duplicata operacional de 'abertas'.
// abertas = visíveis sem destino resolvido. no_destination = isRawCapture flag.
// Toda captura aberta é também raw (não foi triada) → counts iguais sempre.
// Mantido o case no filterItem switch caso precise no futuro, só fora do strip visual.
const FILTERS: Array<{ key: InboxFilter; label: string }> = [
  { key: 'open', label: 'abertas' },
  { key: 'candidate', label: 'candidatas' },
  { key: 'proposal', label: 'propostas' },
  { key: 'snoozed', label: 'adiadas' },
  { key: 'failed', label: 'falhas' },
  { key: 'pending', label: 'pendentes' },
  { key: 'routed', label: 'com destino' },
  { key: 'archived', label: 'arquivadas' },
]

const TASK_PRIORITIES: Array<{ key: TaskPriority; label: string }> = [
  { key: 'low', label: 'baixa' },
  { key: 'normal', label: 'normal' },
  { key: 'high', label: 'alta' },
  { key: 'urgent', label: 'urgente' },
]

const OPERATIONAL_FILTERS: Array<{ key: OperationalFilter; label: string }> = [
  { key: 'all', label: 'Tudo' },
  { key: 'approval', label: 'Aprovacoes' },
  { key: 'recommendation', label: 'Recomendacoes' },
  { key: 'insight', label: 'Insights' },
  { key: 'proposal', label: 'Propostas' },
  { key: 'job', label: 'Jobs' },
  { key: 'self_diagnostic', label: 'Auto-diagnostico' },
  { key: 'alert', label: 'Alertas' },
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

// Microcopy educativa 1x na vida ao primeiro arquivamento · Lei 6 dataset sagrado.
const ARCHIVE_HINT_STORAGE_KEY = 'atlas-inbox.archive-hint-shown'

const OPERATIONAL_PAGE_SIZE = 25
const OPERATIONAL_POLL_INTERVAL_MS = 90_000
const OPERATIONAL_POLL_JITTER_MS = 4_000

export default function InboxScreen() {
  const c = usePalette()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { showToast } = useShell()
  const openDetail = useOverlays((s) => s.openDetail)
  const openDomainFilter = useOverlays((s) => s.openInboxDomainFilter)
  const openAtlasAi = useOverlays((s) => s.openAtlasAi)
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
  const [mode, setMode] = useState<InboxMode>('captures')
  const [filter, setFilter] = useState<InboxFilter>('open')
  const [morningNotifDismissed, setMorningNotifDismissed] = useState(false)
  const [focusMode, setFocusMode] = useState(false)
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
  const [operationalCursor, setOperationalCursor] = useState<string | null>(null)
  const [operationalFilter, setOperationalFilter] = useState<OperationalFilter>('all')
  const [operationalBusyId, setOperationalBusyId] = useState<string | null>(null)
  const [operationalLoadingMore, setOperationalLoadingMore] = useState(false)
  const [operationalError, setOperationalError] = useState<string | null>(null)
  const [mobilePaired, setMobilePaired] = useState<boolean | null>(null)
  const operationalRefreshSeq = useRef(0)
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
    const baseItems = filter === 'snoozed' || filter === 'proposal' || filter === 'archived' ? items : visibleItems

    return baseItems
        .filter((item) => domainFilter === 'all' || item.domain === domainFilter)
        .filter((item) => matchesQuery(item, query))
        .filter((item) => filterItem(item, filter))
  }, [items, visibleItems, domainFilter, filter, query])
  const sortedItems = useMemo(() => sortItems(filteredItems, sort), [filteredItems, sort])
  const groups = useMemo(() => groupByDate(sortedItems), [sortedItems])
  // Frente 4 v6 · fresh capture detection (≤30s) · usado em isFresh prop do InboxCard
  const freshIds = useFreshCaptures(items)
  // Frente 2 v7 · morning notification editorial · só mostra quando há propostas reais e usuário não dismissou
  const proposalsCount = useMemo(
    () => items.filter((item) => isProposalItem(item)).length,
    [items],
  )
  const showMorningNotif =
    !morningNotifDismissed &&
    proposalsCount > 0 &&
    filter !== 'proposal' &&
    mode === 'captures'
  const operationalCounts = useMemo(() => countOperationalItems(operationalItems), [operationalItems])
  const operationalCriticalCount = useMemo(
    () => operationalItems.filter((item) => item.severity === 'critical').length,
    [operationalItems],
  )
  const filteredOperationalItems = useMemo(
    () => operationalItems.filter((item) => operationalFilterMatches(item, operationalFilter)),
    [operationalFilter, operationalItems],
  )
  const showOperationalList = mobilePaired !== false && (
    operationalItems.length > 0 ||
    (!operationalError && mobilePaired === true)
  )

  useEffect(() => {
    const openIds = new Set(openItems.map((item) => item.id))
    setSelectedIds((current) => {
      const next = current.filter((id) => openIds.has(id))
      return next.length === current.length ? current : next
    })
  }, [openItems])

  useEffect(() => {
    if (mode === 'captures') return

    setSearchFocused(false)
    setSelectionMode(false)
    setSelectedIds([])
    setTaskPriorityItem(null)
    setSnoozeTarget(null)
  }, [mode])

  const [loading, setLoading] = useState(!hydrated)
  useEffect(() => {
    void hydrate().then(() => sync())
  }, [hydrate, sync])

  const refreshOperationalInbox = useCallback(async () => {
    const seq = operationalRefreshSeq.current + 1
    operationalRefreshSeq.current = seq

    try {
      await hydrateApiConfig()
      const session = getMobileDeviceSession() ?? await recoverMobileDeviceSession()
      if (!session) {
        if (seq !== operationalRefreshSeq.current) return
        setOperationalItems([])
        setOperationalCursor(null)
        setOperationalError(null)
        void syncAtlasBadge(0)
        setMobilePaired(false)
        return
      }

      const response = await listMobileInbox({ status: 'active', limit: OPERATIONAL_PAGE_SIZE })
      if (seq !== operationalRefreshSeq.current) return
      setOperationalItems(response.items.filter(isActiveOperationalItem))
      setOperationalCursor(response.next_cursor ?? null)
      setOperationalError(null)
      void syncAtlasBadge(response.unread_count)
      setMobilePaired(true)
    } catch (error) {
      if (seq !== operationalRefreshSeq.current) return

      if (error instanceof AtlasApiError && error.status === 401) {
        setOperationalItems([])
        setOperationalCursor(null)
        setOperationalError(null)
        void syncAtlasBadge(0)
        setMobilePaired(false)
        return
      }

      const message = error instanceof Error ? error.message : 'falha ao carregar inbox operacional'
      setOperationalError(message)
      showToast(message)
    }
  }, [showToast])

  const loadMoreOperationalInbox = useCallback(async () => {
    if (!operationalCursor || operationalLoadingMore) return

    setOperationalLoadingMore(true)
    try {
      const response = await listMobileInbox({
        status: 'active',
        limit: OPERATIONAL_PAGE_SIZE,
        cursor: operationalCursor,
      })
      setOperationalError(null)
      setOperationalItems((current) => mergeOperationalItems(current, response.items.filter(isActiveOperationalItem)))
      setOperationalCursor(response.next_cursor ?? null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'falha ao carregar mais itens'
      setOperationalError(message)
      showToast(message)
    } finally {
      setOperationalLoadingMore(false)
    }
  }, [operationalCursor, operationalLoadingMore, showToast])

  useFocusEffect(
    useCallback(() => {
      let active = true
      let pollTimer: ReturnType<typeof setTimeout> | null = null

      // setTimeout encadeado (não setInterval): evita empilhamento se o
      // refresh demorar mais que o intervalo. Jitter ±4s espalha picos
      // entre dispositivos. Pausa em background é tratada pelo AppState.
      const scheduleNextPoll = () => {
        if (pollTimer || !active) return
        const jitter = Math.floor(Math.random() * OPERATIONAL_POLL_JITTER_MS) - OPERATIONAL_POLL_JITTER_MS / 2
        pollTimer = setTimeout(async () => {
          pollTimer = null
          if (!active || AppState.currentState !== 'active') return
          try {
            await refreshOperationalInbox()
          } finally {
            if (active && AppState.currentState === 'active') scheduleNextPoll()
          }
        }, OPERATIONAL_POLL_INTERVAL_MS + jitter)
      }

      const stopPolling = () => {
        if (pollTimer) {
          clearTimeout(pollTimer)
          pollTimer = null
        }
      }

      void refreshOperationalInbox()

      if (AppState.currentState === 'active') {
        scheduleNextPoll()
      }

      const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
        if (!active) return
        if (nextState === 'active') {
          void refreshOperationalInbox()
          scheduleNextPoll()
        } else {
          stopPolling()
        }
      })

      return () => {
        active = false
        stopPolling()
        subscription.remove()
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
      if (result && action === 'archive') {
        // Microcopy educativa 1x na vida · Lei 6 dataset sagrado
        const seen = await atlasStorage.getItem(ARCHIVE_HINT_STORAGE_KEY)
        if (!seen) {
          showToast('arquivado · vira filtro "arquivadas". nada se perde.')
          await atlasStorage.setItem(ARCHIVE_HINT_STORAGE_KEY, '1')
        } else {
          showToast(quickActionMessage(action))
        }
      } else {
        showToast(result ? quickActionMessage(action) : 'falha ao aplicar ação')
      }
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
      if (actionId === 'snooze') {
        await snoozeMobileInboxItem(item.id, daysFromNowIso(7), 'Item operacional adiado por sete dias pelo app.')
        showToast('item adiado por 7 dias')
      } else if (actionId === 'dismiss' || actionId === 'discard') {
        await dismissMobileInboxItem(item.id, `Ação ${actionId} pelo app.`)
        showToast('item descartado')
      } else if (actionId === 'discuss') {
        const response = await discussMobileInboxItem(item.id)
        const threadId = threadIdFromActionResult(response.result)
        if (threadId) {
          openAtlasAi(threadId)
        } else {
          showToast('Atlas aberto')
        }
      } else {
        const response = await respondMobileInboxItem(item.id, actionId)
        showToast(operationalActionMessage(actionId, response.result))
      }

      await refreshOperationalInbox()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'falha ao aplicar ação')
    } finally {
      setOperationalBusyId(null)
    }
  }

  return (
    <View style={styles.fill}>
    {/* PaperVignette FORA do Screen · absoluteFillObject precisa preencher
        a viewport, não o contentContainer do ScrollView (que tem altura da
        rolagem inteira e gera retângulo visível com borda dura). */}
    <PaperVignette />
    <Screen>
      <LiveStatus initialIdx={0} hasEvent={proposalsCount > 0} />
      <NewCapturesPill
        visible={showMorningNotif}
        count={proposalsCount}
        onPress={() => {
          setFilter('proposal')
          setMorningNotifDismissed(true)
        }}
      />
      <View style={styles.titleBlock}>
        <View style={styles.titleColumn}>
          <Pressable
            onLongPress={() => setFocusMode((f) => !f)}
            delayLongPress={400}
            accessibilityRole="header"
            accessibilityLabel="Inbox · pressione e segure para entrar em modo foco"
          >
            <Frau
              size={focusMode ? 32 : 42}
              lineHeight={focusMode ? 36 : 44}
              letterSpacing={-1.05}
              color={c.ink}
              style={styles.letterpressTitle}
            >
              Inbox
            </Frau>
          </Pressable>
          {mode === 'captures' ? (
            <MetaLine metrics={metrics} />
          ) : (
            <OperationalMetaLine
              total={operationalCounts.all}
              critical={operationalCriticalCount}
              mobilePaired={mobilePaired}
              error={operationalError}
            />
          )}
        </View>
      </View>

      {!focusMode ? (
        <InboxModeTabs
          active={mode}
          capturesCount={metrics.open}
          operationalCount={operationalCounts.all}
          operationalCritical={operationalCriticalCount}
          onChange={setMode}
        />
      ) : null}

      {mode === 'captures' ? (
        <>
          {!focusMode ? (
            <InboxDomainStatus
              domain={domainFilter}
              onPress={() => openDomainFilter(domainFilter, setDomainFilter)}
            />
          ) : null}

          {!focusMode ? (
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
          ) : null}

          {!focusMode ? (
            <View style={styles.filterStripWrap}>
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
                    count={countItemsForFilter(items, visibleItems, option.key)}
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
              {/* Frente 7 v6 · fade-edge à direita + glifo "→" indicando overflow */}
              <View pointerEvents="none" style={[styles.filterFadeEdge, { backgroundColor: c.bg }]} />
              <Frau
                italic
                size={13}
                lineHeight={17}
                color={c.ink3}
                style={styles.filterEdgeArrow}
              >
                →
              </Frau>
            </View>
          ) : null}

          {selectionMode && selectedIds.length > 0 ? (
            <View style={[styles.bulkBar, { borderColor: c.border, backgroundColor: c.bgDeep }]}>
              <Frau italic size={14} lineHeight={18} color={c.ink}>
                {selectedIds.length} selecionada{selectedIds.length !== 1 ? 's' : ''}
              </Frau>
              <View style={{ flex: 1 }} />
              <ActionText label="promover" onPress={() => void runBulkAction('promote')} />
              <Frau italic size={12} color={c.ink3} style={{ opacity: 0.45 }}>·</Frau>
              <ActionText label="adiar" onPress={() => setSnoozeTarget('bulk')} />
              <Frau italic size={12} color={c.ink3} style={{ opacity: 0.45 }}>·</Frau>
              <ActionText label="arquivar" danger onPress={() => void runBulkAction('archive')} />
            </View>
          ) : null}

          {taskPriorityItem ? (
            <View style={[styles.priorityBar, { borderColor: c.border, backgroundColor: c.bgDeep }]}>
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
                  {compactTitle(taskPriorityItem)}
                </Frau>
              </View>
              <View style={styles.priorityOptions}>
                {TASK_PRIORITIES.map((priority) => (
                  <PriorityChip
                    key={priority.key}
                    label={priority.label}
                    tone={priority.key}
                    onPress={() => void runTaskWithPriority(priority.key)}
                  />
                ))}
                <ActionText label="cancelar" onPress={() => setTaskPriorityItem(null)} />
              </View>
            </View>
          ) : null}

          {snoozeTarget ? (
            <View style={[styles.priorityBar, { borderColor: c.border, backgroundColor: c.bgDeep }]}>
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
                  {snoozeTarget === 'bulk' ? `${selectedIds.length} selecionadas` : compactTitle(snoozeTarget)}
                </Frau>
              </View>
              <View style={styles.priorityOptions}>
                {SNOOZE_CHOICES.map((choice) => (
                  <PriorityChip
                    key={choice.key}
                    label={choice.label}
                    tone="neutral"
                    onPress={() => void runSnoozeChoice(choice.days, choice.reason)}
                  />
                ))}
                <ActionText label="cancelar" onPress={() => setSnoozeTarget(null)} />
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
                        tone={projectPlanDraft.priority === priority.key ? priority.key : 'neutral'}
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

          {loading ? (
            <InboxSkeleton />
          ) : groups.length === 0 ? (
            <EmptyInbox variant={openItems.length === 0 ? 'inbox' : filter} />
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
                      <SwipeableCard
                        key={item.id}
                        enabled={!selectionMode && !item.isLocal && !item.isArchived}
                        onSnooze={item.isLocal ? undefined : () => askSnooze(item)}
                        onArchive={item.isLocal ? undefined : () => void runQuickAction(item, 'archive')}
                      >
                        <InboxCard
                          item={item}
                          selected={selectedIds.includes(item.id)}
                          selectionMode={selectionMode}
                          isFresh={freshIds.has(item.id)}
                          onPress={() => selectionMode ? toggleSelected(item) : openDetail(item)}
                          onPromote={() => void runQuickAction(item, 'promote')}
                          onCreateTask={() => askTaskPriority(item)}
                          onCreateProject={() => void askProjectPlan(item)}
                          onSnooze={() => askSnooze(item)}
                          onArchive={() => void runQuickAction(item, 'archive')}
                          onOpenDestination={isNavigableDestination(item) ? () => openDestination(item) : undefined}
                          actionBusy={busyCaptureId === item.id || busyCaptureId === 'bulk'}
                        />
                      </SwipeableCard>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      ) : (
        <>
          <OperationalStatusPanel
            total={operationalCounts.all}
            critical={operationalCriticalCount}
            mobilePaired={mobilePaired}
            error={operationalError}
            onPair={() => router.push('/mobile-pairing')}
            onRetry={() => void refreshOperationalInbox()}
          />

          {showOperationalList ? (
            <>
              <OperationalFilterStrip
                active={operationalFilter}
                counts={operationalCounts}
                onChange={setOperationalFilter}
              />
              <View style={styles.list}>
                {operationalItems.length === 0 ? (
                  <OperationalEmptyState
                    title={operationalError ? 'Sem dados operacionais' : 'Operacional limpo'}
                    body={operationalError
                      ? 'A conexão falhou antes de carregar itens. Tente novamente para atualizar a fila.'
                      : 'Nenhuma aprovação, recomendação ou alerta ativo agora.'}
                  />
                ) : filteredOperationalItems.length > 0 ? (
                  filteredOperationalItems.map((item) => (
                    <OperationalInboxCard
                      key={item.id}
                      item={item}
                      busy={operationalBusyId === item.id}
                      onOpen={() => router.push({ pathname: '/mobile-inbox-item', params: { inboxId: item.id } })}
                      onAction={(actionId) => void runOperationalAction(item, actionId)}
                    />
                  ))
                ) : (
                  <OperationalEmptyState
                    title="Filtro vazio"
                    body="Nenhum item operacional ativo neste filtro."
                  />
                )}
                {operationalCursor ? (
                  <Pressable
                    disabled={operationalLoadingMore}
                    onPress={() => void loadMoreOperationalInbox()}
                    style={({ pressed }) => [
                      styles.loadMoreOperational,
                      {
                        borderColor: c.border,
                        backgroundColor: pressed ? c.premium : 'transparent',
                        opacity: operationalLoadingMore ? 0.55 : 1,
                      },
                    ]}
                  >
                    <Sans weight="sb" size={12.5} lineHeight={17} color={c.prussian} align="center">
                      {operationalLoadingMore ? 'Carregando...' : 'Carregar mais'}
                    </Sans>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : null}
        </>
      )}
    </Screen>

    {/* Floating capture · v8 thumb-zone · sai do top-right pra perto do polegar.
        Bottom = dock height (64) + dock baseline (8) + insets + 16 breath.
        pointerEvents="box-none" deixa toques passarem pelo overlay vazio. */}
    <View
      pointerEvents="box-none"
      style={[styles.floatingCapture, { bottom: 88 + insets.bottom }]}
    >
      {focusMode ? (
        <FocusModePill onPress={() => setFocusMode(false)} />
      ) : (
        <CaptureButton
          onPress={() => router.push('/capture?mode=text')}
          onLongPress={() => router.push('/capture?mode=audio')}
          size={60}
        />
      )}
    </View>
    </View>
  )
}

// v11 · ModeTabs centralizados · número ao lado removido (era "Capturas 5"/"Operacional 0")
// — count agora vive APENAS no subtitle ("5 abertas"/"0 ativos"), evita redundância.
// Tabs como grupo centralizado · gap 40 entre eles · underline acompanha largura
// exata da label (não overflow no tab inteiro como antes).
function InboxModeTabs({
  active,
  capturesCount,
  operationalCount,
  operationalCritical,
  onChange,
}: {
  active: InboxMode
  capturesCount: number
  operationalCount: number
  operationalCritical: number
  onChange: (mode: InboxMode) => void
}) {
  const c = usePalette()

  return (
    <View style={[styles.modeTabs, { borderBottomColor: c.border }]}>
      <InboxModeTab
        label="Capturas"
        subtitle={captureCountLabel(capturesCount)}
        active={active === 'captures'}
        onPress={() => onChange('captures')}
      />
      <InboxModeTab
        label="Operacional"
        subtitle={operationalTabSubtitle(operationalCount, operationalCritical)}
        critical={operationalCritical > 0}
        active={active === 'operational'}
        onPress={() => onChange('operational')}
      />
    </View>
  )
}

function InboxModeTab({
  label,
  subtitle,
  critical,
  active,
  onPress,
}: {
  label: string
  subtitle: string
  critical?: boolean
  active: boolean
  onPress: () => void
}) {
  const c = usePalette()

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} · ${subtitle}`}
      style={({ pressed }) => [
        styles.modeTab,
        {
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      {/* Label group · underline acompanha largura exata da label.
          Ativo: 22pt ink full · Inativo: 19pt ink2 muted · diferença
          de scale (3pt) faz a hierarquia editorial sem precisar de cor saturada. */}
      <View style={styles.modeTabLabelGroup}>
        <View style={styles.modeTabLabelRow}>
          <Frau
            size={active ? 22 : 19}
            lineHeight={active ? 28 : 24}
            letterSpacing={active ? -0.3 : -0.1}
            color={active ? c.ink : c.ink2}
            numberOfLines={1}
          >
            {label}
          </Frau>
          {critical ? (
            <View style={[styles.modeTabCriticalDot, { backgroundColor: c.recRed }]} />
          ) : null}
        </View>
        {active ? <View style={styles.modeTabUnderline} /> : null}
      </View>
      {/* Subtitle · count vive aqui ("5 abertas") · italic small ink2 muted.
          Sempre visível em ambos tabs · sem ocultar contexto. */}
      <Frau
        italic
        size={12}
        lineHeight={16}
        color={c.ink2}
        numberOfLines={1}
        style={!active ? styles.modeTabSubtitleInactive : undefined}
      >
        {subtitle}
      </Frau>
    </Pressable>
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
  const voice = inboxVoiceLine(metrics)
  return (
    <View>
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
      {voice ? (
        <Frau
          italic
          size={14.5}
          lineHeight={21}
          letterSpacing={-0.07}
          color={c.ink2}
          style={styles.voiceLine}
        >
          {voice}
        </Frau>
      ) : null}
    </View>
  )
}

// Voz editorial dinâmica · Atlas falando, não posando.
function inboxVoiceLine(metrics: ReturnType<typeof inboxMetrics>): string | null {
  if (metrics.open === 0) return 'o dia ainda está por dizer.'
  if (metrics.open === 1) {
    return metrics.firstTimeLabel
      ? `um fragmento, capturado às ${metrics.firstTimeLabel} — ainda por destinar.`
      : 'um fragmento — ainda por destinar.'
  }
  return metrics.firstTimeLabel
    ? `${numberInWords(metrics.open)} fragmentos · o primeiro às ${metrics.firstTimeLabel}.`
    : `${numberInWords(metrics.open)} fragmentos · ainda por destinar.`
}

function numberInWords(n: number): string {
  const map: Record<number, string> = {
    2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco',
    6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez',
  }
  return map[n] ?? String(n)
}

function OperationalMetaLine({
  total,
  critical,
  mobilePaired,
  error,
}: {
  total: number
  critical: number
  mobilePaired: boolean | null
  error: string | null
}) {
  const c = usePalette()
  const segments: Array<{ text: string; color: string }> = []

  if (mobilePaired === false) {
    segments.push({ text: 'GATEWAY DESCONECTADO', color: c.bronze })
  } else if (error) {
    segments.push({ text: 'ERRO AO CARREGAR', color: c.recRed })
  } else if (mobilePaired === null) {
    segments.push({ text: 'SINCRONIZANDO', color: c.ink2 })
  } else {
    segments.push({ text: total === 0 ? 'OPERACIONAL LIMPO' : operationalActiveLabel(total), color: c.ink2 })
  }

  if (critical > 0) {
    segments.push({ text: operationalCriticalLabel(critical), color: c.recRed })
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

function OperationalStatusPanel({
  total,
  critical,
  mobilePaired,
  error,
  onPair,
  onRetry,
}: {
  total: number
  critical: number
  mobilePaired: boolean | null
  error: string | null
  onPair: () => void
  onRetry: () => void
}) {
  const c = usePalette()

  if (mobilePaired === false) {
    return <MobileGatewayBanner onPress={onPair} />
  }

  if (error) {
    return <OperationalErrorCard message={error} onRetry={onRetry} />
  }

  const checking = mobilePaired === null
  const title = checking
    ? 'Checando operacional'
    : critical > 0
      ? 'Operacional requer atenção'
      : total > 0
        ? 'Operacional com itens ativos'
        : 'Operacional limpo'
  const body = checking
    ? 'Sincronizando gateway e carregando aprovações, recomendações e alertas.'
    : critical > 0
      ? `${operationalCriticalLabel(critical).toLowerCase()} precisam de revisão antes de misturar com as capturas.`
      : total > 0
        ? `${operationalActiveLabel(total).toLowerCase()} separados da Inbox de capturas.`
        : 'Nenhuma recomendação, aprovação ou alerta ativo agora.'

  return (
    <View style={[
      styles.operationalSummary,
      {
        borderColor: critical > 0 ? c.recRed : c.border,
        backgroundColor: c.surface,
      },
    ]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={13} lineHeight={17} color={c.ink}>
          {title}
        </Sans>
        <Sans size={12} lineHeight={16} color={c.ink2} style={{ marginTop: 3 }}>
          {body}
        </Sans>
      </View>
      <View style={[
        styles.operationalSummaryBadge,
        {
          borderColor: critical > 0 ? c.recRed : c.border,
          backgroundColor: critical > 0 ? c.bg : c.premium,
        },
      ]}>
        <Mono size={11} lineHeight={15} color={critical > 0 ? c.recRed : c.prussian}>
          {checking ? '...' : critical > 0 ? String(critical) : 'OK'}
        </Mono>
      </View>
    </View>
  )
}

function OperationalErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  const c = usePalette()
  return (
    <View style={[styles.operationalErrorCard, { borderColor: c.recRed, backgroundColor: c.surface }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans weight="med" size={13} lineHeight={17} color={c.ink}>
          Inbox operacional indisponível
        </Sans>
        <Sans size={12} lineHeight={16} color={c.ink2} style={{ marginTop: 3 }} numberOfLines={3}>
          {message}
        </Sans>
      </View>
      <Pressable
        onPress={onRetry}
        hitSlop={8}
        style={({ pressed }) => [styles.operationalRetryButton, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}
      >
        <Sans weight="sb" size={12} lineHeight={16} color={c.prussian}>
          Tentar
        </Sans>
      </Pressable>
    </View>
  )
}

function OperationalEmptyState({ title, body }: { title: string; body: string }) {
  const c = usePalette()

  return (
    <View style={[styles.operationalEmpty, { borderColor: c.border, backgroundColor: c.surface }]}>
      <Sans weight="med" size={13} lineHeight={17} color={c.ink}>
        {title}
      </Sans>
      <Sans size={12} lineHeight={16} color={c.ink2} style={{ marginTop: 4 }}>
        {body}
      </Sans>
    </View>
  )
}

function OperationalFilterStrip({
  active,
  counts,
  onChange,
}: {
  active: OperationalFilter
  counts: Record<OperationalFilter, number>
  onChange: (filter: OperationalFilter) => void
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.operationalFilterStrip}
      style={styles.operationalFilterScroll}
    >
      {OPERATIONAL_FILTERS.map((option) => (
        <OperationalFilterChip
          key={option.key}
          label={option.label}
          count={counts[option.key]}
          active={active === option.key}
          onPress={() => onChange(option.key)}
        />
      ))}
    </ScrollView>
  )
}

function OperationalFilterChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string
  count: number
  active: boolean
  onPress: () => void
}) {
  const c = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.operationalFilterChip,
        {
          borderColor: active ? c.prussian : c.border,
          backgroundColor: active ? c.surface : 'transparent',
          opacity: pressed ? 0.65 : count === 0 ? 0.45 : 1,
        },
      ]}
    >
      <Sans weight={active ? 'sb' : 'med'} size={11.5} lineHeight={15} color={active ? c.prussian : c.ink2} numberOfLines={1}>
        {label}
      </Sans>
      <Mono size={10.5} lineHeight={14} color={active ? c.prussian : c.ink3}>
        {count}
      </Mono>
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

function isActiveOperationalItem(item: AtlasOperationalInboxItem): boolean {
  if (item.status === 'resolved' || item.status === 'dismissed' || item.status === 'expired') {
    return false
  }

  if (item.status === 'snoozed' && item.snoozed_until) {
    const snoozedUntil = new Date(item.snoozed_until)
    return Number.isFinite(snoozedUntil.getTime()) && snoozedUntil.getTime() <= Date.now()
  }

  return true
}

function countOperationalItems(items: AtlasOperationalInboxItem[]): Record<OperationalFilter, number> {
  return items.reduce<Record<OperationalFilter, number>>((counts, item) => {
    counts.all += 1
    for (const option of OPERATIONAL_FILTERS) {
      if (option.key === 'all') continue
      if (operationalFilterMatches(item, option.key)) counts[option.key] += 1
    }
    return counts
  }, {
    all: 0,
    approval: 0,
    recommendation: 0,
    insight: 0,
    proposal: 0,
    job: 0,
    self_diagnostic: 0,
    alert: 0,
  })
}

function operationalFilterMatches(item: AtlasOperationalInboxItem, filter: OperationalFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'recommendation') return item.category === 'atlas_ai_recommendation'
  if (filter === 'job') return item.type === 'job_result' || item.type === 'job_status'
  return item.type === filter
}

function mergeOperationalItems(
  current: AtlasOperationalInboxItem[],
  next: AtlasOperationalInboxItem[],
): AtlasOperationalInboxItem[] {
  const byId = new Map<string, AtlasOperationalInboxItem>()
  for (const item of current) byId.set(item.id, item)
  for (const item of next) byId.set(item.id, item)

  return Array.from(byId.values()).sort((a, b) => timestampForSort(b.created_at) - timestampForSort(a.created_at))
}

function timestampForSort(value: string | null): number {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

function operationalActionMessage(actionId: string, result: Record<string, unknown>): string {
  if (actionId === 'create_proposal' && typeof result.proposal_item_id === 'string') {
    return 'proposta criada no Inbox'
  }
  if (actionId === 'ignore_30d') return 'auto-diagnóstico ignorado por 30 dias'
  if (actionId === 'review_patch') return 'proposta marcada para revisão'
  if (actionId === 'view_trace') return 'trace marcado para revisão'
  if (actionId === 'mark_read') return 'marcado como lido'

  return 'ação aplicada'
}

function FilterChip({
  label,
  active,
  count,
  onPress,
}: {
  label: string
  active: boolean
  count?: number
  onPress: () => void
}) {
  const c = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        {
          // v12 · bronze 60% sussurro · matching ModeTabs underline.
          // Era c.ink full = SaaS shouting. Agora bronze editorial signature.
          borderBottomColor: active ? 'rgba(155,122,63,0.60)' : 'transparent',
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Frau
        italic
        size={14.5}
        lineHeight={18}
        color={active ? c.ink : c.ink3}
      >
        {label}
      </Frau>
      {count != null && count > 0 ? (
        <Mono
          size={10.5}
          lineHeight={14}
          letterSpacing={0.21}
          color={active ? c.ink2 : c.ink3}
          style={styles.filterChipCount}
        >
          {count}
        </Mono>
      ) : null}
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

// Conta capturas pra cada filtro · usado pelo count nos chips do FilterStrip.
// Usa items completos (snoozed/proposal precisam disso) ou visibleItems (resto).
function countItemsForFilter(
  items: InboxItem[],
  visibleItems: InboxItem[],
  filter: InboxFilter,
): number {
  const baseItems = filter === 'snoozed' || filter === 'proposal' ? items : visibleItems
  return baseItems.filter((item) => filterItem(item, filter)).length
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
    case 'archived':
      return Boolean(item.isArchived)
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
  tone,
  onPress,
}: {
  label: string
  tone?: 'low' | 'normal' | 'high' | 'urgent' | 'neutral'
  onPress: () => void
}) {
  const c = usePalette()
  const color =
    tone === 'low' ? c.ink3 :
    tone === 'normal' ? c.ink2 :
    tone === 'high' ? c.bronze :
    tone === 'urgent' ? c.recRed :
    c.ink2
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.priorityChip,
        {
          borderColor: color,
          backgroundColor: pressed ? c.bgRaised : c.bg,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Frau italic size={14} lineHeight={18} color={color}>
        {label}
      </Frau>
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
      <Frau italic size={13} lineHeight={17} color={danger ? c.recRedMuted : c.ink2}>
        {label}
      </Frau>
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

  // Primeira captura (mais antiga) — usado pela voz editorial
  const sortedByCaptured = [...items]
    .filter((item) => Boolean(item.capturedAt))
    .sort(
      (a, b) =>
        new Date(a.capturedAt as string).getTime() -
        new Date(b.capturedAt as string).getTime(),
    )
  const firstTimeLabel = sortedByCaptured[0]?.time ?? null

  return {
    open: items.length,
    averageAgeLabel: formatAge(averageAgeMs),
    firstTimeLabel,
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

function captureCountLabel(count: number): string {
  return count === 1 ? '1 aberta' : `${count} abertas`
}

function operationalTabSubtitle(total: number, critical: number): string {
  if (critical > 0) return critical === 1 ? '1 crítico' : `${critical} críticos`
  return total === 1 ? '1 ativo' : `${total} ativos`
}

function operationalActiveLabel(count: number): string {
  return count === 1 ? '1 ATIVO' : `${count} ATIVOS`
}

function operationalCriticalLabel(count: number): string {
  return count === 1 ? '1 CRÍTICO' : `${count} CRÍTICOS`
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
  fill: { flex: 1 },
  // Floating capture · v8 thumb-zone · ancorado ao bottom-right do dispositivo.
  // Right alinhado com padrão do dock (margem 24px) · zIndex 28 fica acima do
  // conteúdo do ScrollView mas abaixo do dock (zIndex 30) e modais (z >= 40).
  floatingCapture: {
    position: 'absolute',
    right: 24,
    zIndex: 28,
    alignItems: 'flex-end',
  },
  titleBlock: { marginBottom: 14 },
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
  voiceLine: {
    marginTop: 12,
    maxWidth: 320,
  },
  // Técnica #4 v5 · letterpress sutil · highlight marfim 1px abaixo simula deboss em papel.
  // RN não suporta múltiplas textShadows como CSS — usamos apenas a highlight clara.
  letterpressTitle: {
    textShadowColor: 'rgba(255, 250, 240, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  // v11 · ModeTabs centralizados · gap 40 entre tabs · sem border row inteira.
  // justifyContent center → ambos tabs viram um grupo no centro da tela.
  modeTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 40,
    paddingTop: 4,
    paddingBottom: 14,
    marginTop: 14,
    marginBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  // Tab individual · alignItems center → label e subtitle alinhados no eixo X.
  // gap 6 → respiro entre label e subtitle (com underline no meio quando active).
  modeTab: {
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 6,
  },
  // Label group · column · alignItems stretch → underline acompanha largura
  // exata da label-row (não mais do tab inteiro como no v10).
  modeTabLabelGroup: {
    alignItems: 'stretch',
  },
  // Row da label · centro horizontal pra critical dot ficar adjacente sem
  // empurrar a label fora do center.
  modeTabLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 5,
  },
  modeTabSubtitleInactive: {
    opacity: 0.78,
  },
  // v12 · underline editorial premium · 1.5→1px bronze 60% (não mais ink full).
  // Antes: traço grosso 1.5px ink full = SaaS UI shouting. Agora: hairline
  // bronze sussurrando = Aesop/Parfums de Marly editorial signature (P12 + bronze
  // count P8: 1 aqui + 1 no FilterChip = 2 always-visible permanente).
  // marginTop 5→7 dá mais respiro entre label baseline e underline (peso magazine).
  modeTabUnderline: {
    height: 1,
    marginTop: 7,
    backgroundColor: 'rgba(155,122,63,0.60)', // bronze 60% sussurro
  },
  modeTabCriticalDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
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
  filterStripWrap: {
    position: 'relative',
  },
  filterFadeEdge: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 6,
    width: 28,
    opacity: 0.9,
  },
  filterEdgeArrow: {
    position: 'absolute',
    right: 6,
    top: '50%',
    marginTop: -10,
    opacity: 0.7,
  },
  filterStrip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 22,
    paddingRight: 36,
  },
  // v12 · underline editorial premium matching ModeTabs.
  // borderBottomWidth 1.5→1 · paddingBottom 4→6 (mais respiro pré-underline).
  // borderBottomColor agora bronze 60% (vem inline na render porque depende
  // do active state). Quieto, sussurra, jamais grita.
  filterChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    paddingHorizontal: 0,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  filterChipCount: {
    opacity: 0.6,
  },
  operationalFilterScroll: {
    marginTop: -4,
    marginBottom: 10,
  },
  operationalFilterStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  operationalFilterChip: {
    minHeight: 31,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  operationalEmpty: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  loadMoreOperational: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  operationalSummary: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  operationalSummaryBadge: {
    minWidth: 38,
    height: 34,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
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
  operationalErrorCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  operationalRetryButton: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  list: { gap: 10 },
  firstSection: { marginTop: 18 },
})
