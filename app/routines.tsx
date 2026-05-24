import { RefreshControl, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { CreateDomainPanel } from '../components/domains/CreateDomainPanel'
import { PrimaryButton } from '../components/PrimaryButton'
import { Screen } from '../components/Screen'
import { Masthead, EditorialDateline, FolioFooter } from '../components/editorial'
import { SignatureGesture } from '../components/edition/SignatureGesture'
import { PressableTextScale } from '../components/atlas-ui/PressableScale'
import { dailyFolio, editorialDateLine } from '../lib/folio'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { useShell } from '../components/AtlasShell'
import { deviceTimezone } from '../lib/atlasStore'
import { domainColor, domainLabel, type DomainKey } from '../lib/domains'
import { useAtlasStore } from '../lib/atlasStore'
import {
  createRoutine,
  generateDueRoutines,
  generateRoutineOccurrence,
  listRoutineEvents,
  listRoutines,
  patchRoutine,
  type AtlasExecutionMode,
  type AtlasRoutine,
  type AtlasRoutineEvent,
  type AtlasRoutineFrequency,
  type AtlasRoutineStatus,
} from '../lib/api/client'

type RoutineFilter = AtlasRoutineStatus | 'all'

type RoutineDraft = {
  title: string
  description: string
  domain: DomainKey
  frequency: AtlasRoutineFrequency
  weekdays: number[]
  preferredTime: string
  estimatedMinutes: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  energyRequired: 'low' | 'medium' | 'high'
  executionMode: AtlasExecutionMode
  starterStep: string
  minimumViableAction: string
}

const FILTERS: Array<{ key: RoutineFilter; label: string }> = [
  { key: 'active', label: 'ativas' },
  { key: 'paused', label: 'pausadas' },
  { key: 'archived', label: 'arquivadas' },
  { key: 'all', label: 'todas' },
]

const FREQUENCIES: Array<{ key: AtlasRoutineFrequency; label: string }> = [
  { key: 'daily', label: 'todo dia' },
  { key: 'weekdays', label: 'dias úteis' },
  { key: 'weekly', label: 'semanal' },
  { key: 'custom', label: 'personalizada' },
]

const WEEKDAYS = [
  { key: 1, label: 'seg' },
  { key: 2, label: 'ter' },
  { key: 3, label: 'qua' },
  { key: 4, label: 'qui' },
  { key: 5, label: 'sex' },
  { key: 6, label: 'sáb' },
  { key: 7, label: 'dom' },
]

const PRIORITIES: Array<{ key: RoutineDraft['priority']; label: string }> = [
  { key: 'urgent', label: 'urgente' },
  { key: 'high', label: 'alta' },
  { key: 'normal', label: 'normal' },
  { key: 'low', label: 'baixa' },
]

const ENERGY: Array<{ key: RoutineDraft['energyRequired']; label: string }> = [
  { key: 'low', label: 'baixa' },
  { key: 'medium', label: 'média' },
  { key: 'high', label: 'alta' },
]

const MODES: Array<{ key: AtlasExecutionMode; label: string }> = [
  { key: 'maintenance', label: 'manutenção' },
  { key: 'quick_win', label: 'rápida' },
  { key: 'study', label: 'estudo' },
  { key: 'tedious', label: 'chata' },
  { key: 'deep_work', label: 'profunda' },
  { key: 'recovery', label: 'recuperação' },
]

export default function RoutinesScreen() {
  const c = usePalette()
  const router = useRouter()
  const { showToast } = useShell()
  const domains = useAtlasStore((s) => s.domains)
  const refreshDomains = useAtlasStore((s) => s.refreshDomains)
  const [filter, setFilter] = useState<RoutineFilter>('active')
  const [routines, setRoutines] = useState<AtlasRoutine[]>([])
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null)
  const [events, setEvents] = useState<AtlasRoutineEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [draft, setDraft] = useState<RoutineDraft>(() => emptyRoutineDraft(domains[0]?.key ?? 'atlas'))

  const selectedRoutine = useMemo(
    () => routines.find((routine) => routine.id === selectedRoutineId) ?? null,
    [routines, selectedRoutineId],
  )
  const health = useMemo(() => routineHealth(routines), [routines])

  const loadRoutines = useCallback(async (preferredId?: string | null) => {
    setLoading(true)
    try {
      const response = await listRoutines({
        status: filter,
        limit: 100,
      })
      setRoutines(response.routines)
      setSelectedRoutineId((current) => {
        if (preferredId && response.routines.some((routine) => routine.id === preferredId)) return preferredId
        if (current && response.routines.some((routine) => routine.id === current)) return current
        return response.routines[0]?.id ?? null
      })
      return response.routines
    } catch {
      setRoutines([])
      setSelectedRoutineId(null)
      showToast('Não consegui carregar rotinas')
      return []
    } finally {
      setLoading(false)
    }
  }, [filter, showToast])

  useEffect(() => {
    void refreshDomains()
  }, [refreshDomains])

  useEffect(() => {
    setDraft((current) => ({ ...current, domain: current.domain || domains[0]?.key || 'atlas' }))
  }, [domains])

  useEffect(() => {
    void loadRoutines()
  }, [loadRoutines])

  useEffect(() => {
    if (!selectedRoutineId) {
      setEvents([])
      return
    }

    void listRoutineEvents(selectedRoutineId, { limit: 8 })
      .then((response) => setEvents(response.events))
      .catch(() => setEvents([]))
  }, [selectedRoutineId])

  const submitRoutine = async () => {
    const title = draft.title.trim()
    if (!title || busyAction) return

    setBusyAction('create')
    try {
      const routine = await createRoutine({
        title,
        description: draft.description.trim() || null,
        domain: draft.domain,
        frequency: draft.frequency,
        weekdays: weekdaysForDraft(draft),
        timezone: deviceTimezone(),
        preferred_time: normalizeTimeInput(draft.preferredTime),
        estimated_minutes: parseClampedInt(draft.estimatedMinutes, 5, 480, 25),
        priority: draft.priority,
        energy_required: draft.energyRequired,
        execution_mode: draft.executionMode,
        starter_step: draft.starterStep.trim() || null,
        minimum_viable_action: draft.minimumViableAction.trim() || title,
        metadata: { entrypoint: 'routines_screen' },
      })
      await generateDueRoutines({ date: todayDate(), timezone: deviceTimezone() }).catch(() => null)
      setDraft(emptyRoutineDraft(draft.domain))
      setCreateOpen(false)
      showToast('Rotina criada', { variant: 'checkin' })
      await loadRoutines(routine.id)
    } catch {
      showToast('Não consegui criar a rotina')
    } finally {
      setBusyAction(null)
    }
  }

  const generateToday = async (routine?: AtlasRoutine) => {
    if (busyAction) return

    setBusyAction(routine ? `generate:${routine.id}` : 'generate:all')
    try {
      const count = routine
        ? ((await generateRoutineOccurrence(routine.id, { date: todayDate(), timezone: deviceTimezone() })).task ? 1 : 0)
        : (await generateDueRoutines({ date: todayDate(), timezone: deviceTimezone() })).generated_count
      showToast(count > 0 ? 'Tarefas de rotina prontas' : 'Rotinas já estavam em dia', { variant: 'checkin' })
      await loadRoutines(routine?.id ?? selectedRoutineId)
    } catch {
      showToast('Essa rotina não acontece hoje')
    } finally {
      setBusyAction(null)
    }
  }

  const changeStatus = async (routine: AtlasRoutine, status: AtlasRoutineStatus) => {
    if (busyAction) return

    setBusyAction(`status:${routine.id}`)
    try {
      await patchRoutine(routine.id, { status })
      showToast(status === 'active' ? 'Rotina reativada' : 'Rotina atualizada', { variant: 'checkin' })
      await loadRoutines(routine.id)
    } catch {
      showToast('Não consegui atualizar a rotina')
    } finally {
      setBusyAction(null)
    }
  }

  const folio = useMemo(() => dailyFolio(), [])

  return (
    <Screen
      bare
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void loadRoutines(selectedRoutineId) }} />}
    >
      {/* Masthead canon · tap volta pra edição (substitui "Edição" round button SaaS) */}
      <PressableTextScale
        onPress={() => router.replace('/edicao')}
        accessibilityLabel="voltar para edição"
        hitSlop={8}
      >
        <Masthead title="ROTINAS" folio={null} />
      </PressableTextScale>
      <EditorialDateline
        date={editorialDateLine()}
        edition={`${health.active} ativas · ${health.dueToday} para hoje · ${health.paused} pausadas`}
      />

      <View style={styles.filterRow}>
        {FILTERS.map((item) => (
          <Chip
            key={item.key}
            label={item.label}
            active={filter === item.key}
            onPress={() => setFilter(item.key)}
          />
        ))}
      </View>

      <View style={[styles.summaryGrid, { borderColor: c.border }]}>
        <Metric label="ativas" value={String(health.active)} />
        <Metric label="para hoje" value={String(health.dueToday)} tone={health.dueToday > 0 ? c.bronze : c.moss} />
        <Metric label="geradas" value={String(health.generatedToday)} />
      </View>

      {/* Gesture canon · "gerar rotinas de hoje." em vez de PrimaryButton pill */}
      <View style={styles.gestureRow}>
        <SignatureGesture
          label={busyAction === 'generate:all' ? 'gerando…' : 'gerar rotinas de hoje.'}
          onPress={() => { void generateToday() }}
          disabled={busyAction === 'generate:all'}
          seal="commit"
          haptic="light"
          accessibilityLabel="gerar tarefas das rotinas de hoje"
        />
      </View>

      <Pressable
        onPress={() => setCreateOpen((open) => !open)}
        style={({ pressed }) => [
          styles.newRoutineToggle,
          { backgroundColor: pressed ? c.premium : c.surface, borderColor: c.border },
        ]}
      >
        <Sans weight="sb" size={14} color={c.ink}>
          Nova rotina
        </Sans>
        <Mono size={10.5} lineHeight={14} letterSpacing={0.2} color={c.ink2}>
          {createOpen ? 'fechar' : 'abrir'}
        </Mono>
      </Pressable>

      {createOpen ? (
        <View style={[styles.createPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
          <TextInput
            value={draft.title}
            onChangeText={(title) => setDraft((current) => ({ ...current, title }))}
            placeholder="nome da rotina"
            placeholderTextColor={c.ink3}
            style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.bg }]}
          />
          <TextInput
            value={draft.description}
            onChangeText={(description) => setDraft((current) => ({ ...current, description }))}
            placeholder="contexto ou motivo"
            placeholderTextColor={c.ink3}
            multiline
            style={[styles.input, styles.textArea, { borderColor: c.border, color: c.ink, backgroundColor: c.bg }]}
          />
          <Label>Domínio</Label>
          <View style={styles.chipRow}>
            {domains.map((domain) => (
              <Chip
                key={domain.key}
                label={domain.label}
                active={draft.domain === domain.key}
                accent={domainColor(domain.key, c, domains)}
                onPress={() => setDraft((current) => ({ ...current, domain: domain.key }))}
              />
            ))}
          </View>
          <CreateDomainPanel onCreated={(domain) => setDraft((current) => ({ ...current, domain: domain.key }))} />

          <Label>Frequência</Label>
          <View style={styles.chipRow}>
            {FREQUENCIES.map((frequency) => (
              <Chip
                key={frequency.key}
                label={frequency.label}
                active={draft.frequency === frequency.key}
                onPress={() => setDraft((current) => ({ ...current, frequency: frequency.key }))}
              />
            ))}
          </View>
          {draft.frequency === 'weekly' || draft.frequency === 'custom' ? (
            <View style={styles.chipRow}>
              {WEEKDAYS.map((day) => (
                <Chip
                  key={day.key}
                  label={day.label}
                  active={draft.weekdays.includes(day.key)}
                  onPress={() => setDraft((current) => toggleWeekday(current, day.key))}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.formRow}>
            <TextInput
              value={draft.preferredTime}
              onChangeText={(preferredTime) => setDraft((current) => ({ ...current, preferredTime }))}
              placeholder="hora 08:30"
              placeholderTextColor={c.ink3}
              style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.bg, flex: 1 }]}
            />
            <TextInput
              value={draft.estimatedMinutes}
              onChangeText={(estimatedMinutes) => setDraft((current) => ({ ...current, estimatedMinutes }))}
              keyboardType="number-pad"
              placeholder="min"
              placeholderTextColor={c.ink3}
              style={[styles.input, styles.inputCompact, { borderColor: c.border, color: c.ink, backgroundColor: c.bg }]}
            />
          </View>

          <Label>Prioridade</Label>
          <View style={styles.chipRow}>
            {PRIORITIES.map((priority) => (
              <Chip
                key={priority.key}
                label={priority.label}
                active={draft.priority === priority.key}
                onPress={() => setDraft((current) => ({ ...current, priority: priority.key }))}
              />
            ))}
          </View>

          <Label>Energia</Label>
          <View style={styles.chipRow}>
            {ENERGY.map((energy) => (
              <Chip
                key={energy.key}
                label={energy.label}
                active={draft.energyRequired === energy.key}
                onPress={() => setDraft((current) => ({ ...current, energyRequired: energy.key }))}
              />
            ))}
          </View>

          <Label>Modo</Label>
          <View style={styles.chipRow}>
            {MODES.map((mode) => (
              <Chip
                key={mode.key}
                label={mode.label}
                active={draft.executionMode === mode.key}
                onPress={() => setDraft((current) => ({ ...current, executionMode: mode.key }))}
              />
            ))}
          </View>

          <TextInput
            value={draft.starterStep}
            onChangeText={(starterStep) => setDraft((current) => ({ ...current, starterStep }))}
            placeholder="primeiro passo"
            placeholderTextColor={c.ink3}
            style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.bg }]}
          />
          <TextInput
            value={draft.minimumViableAction}
            onChangeText={(minimumViableAction) => setDraft((current) => ({ ...current, minimumViableAction }))}
            placeholder="mínimo viável"
            placeholderTextColor={c.ink3}
            style={[styles.input, { borderColor: c.border, color: c.ink, backgroundColor: c.bg }]}
          />
          <PrimaryButton
            label={busyAction === 'create' ? 'Criando...' : 'Criar rotina executável'}
            onPress={() => { void submitRoutine() }}
          />
        </View>
      ) : null}

      {routines.length === 0 && !loading ? (
        <View style={[styles.emptyState, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Sans weight="sb" size={15} lineHeight={20} color={c.ink}>
            Nenhuma rotina nessa visão
          </Sans>
          <Sans size={12.5} lineHeight={18} color={c.ink2}>
            Crie rotinas para sono, treino, revisão, estudo ou manutenção. Elas viram tarefas reais na agenda.
          </Sans>
        </View>
      ) : null}

      <View style={styles.routineList}>
        {routines.map((routine) => (
          <RoutineCard
            key={routine.id}
            routine={routine}
            selected={selectedRoutineId === routine.id}
            events={selectedRoutineId === routine.id ? events : []}
            busyAction={busyAction}
            onSelect={() => setSelectedRoutineId(routine.id)}
            onGenerateToday={() => { void generateToday(routine) }}
            onPause={() => { void changeStatus(routine, 'paused') }}
            onResume={() => { void changeStatus(routine, 'active') }}
            onArchive={() => { void changeStatus(routine, 'archived') }}
          />
        ))}
      </View>
    </Screen>
  )
}

function RoutineCard({
  routine,
  selected,
  events,
  busyAction,
  onSelect,
  onGenerateToday,
  onPause,
  onResume,
  onArchive,
}: {
  routine: AtlasRoutine
  selected: boolean
  events: AtlasRoutineEvent[]
  busyAction: string | null
  onSelect: () => void
  onGenerateToday: () => void
  onPause: () => void
  onResume: () => void
  onArchive: () => void
}) {
  const c = usePalette()
  const domains = useAtlasStore((s) => s.domains)
  const accent = domainColor(routine.domain, c, domains)
  const disabled = busyAction != null

  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.routineCard,
        {
          backgroundColor: selected ? c.premium : c.surface,
          borderColor: selected ? accent : c.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Mono size={10.5} lineHeight={14} letterSpacing={0.42} color={accent}>
            {domainLabel(routine.domain, domains).toUpperCase()} · {frequencyLabel(routine)}
          </Mono>
          <Sans weight="sb" size={17} lineHeight={22} color={c.ink} style={{ marginTop: 5 }}>
            {routine.title}
          </Sans>
        </View>
        <StatusPill status={routine.status} />
      </View>

      {routine.description ? (
        <Sans size={12.5} lineHeight={18} color={c.ink2} numberOfLines={2}>
          {routine.description}
        </Sans>
      ) : null}

      <View style={styles.cardFacts}>
        <Fact label="próxima" value={dateLabel(routine.next_occurrence_date)} />
        <Fact label="hora" value={routine.preferred_time ?? '--'} />
        <Fact label="tamanho" value={`${routine.estimated_minutes}min`} />
      </View>

      {routine.minimum_viable_action ? (
        <View style={[styles.currentBox, { borderColor: c.border, backgroundColor: c.bg }]}>
          <Label>Mínimo viável</Label>
          <Sans weight="sb" size={13.5} lineHeight={18} color={c.ink}>
            {routine.minimum_viable_action}
          </Sans>
        </View>
      ) : null}

      {selected ? (
        <View style={[styles.detailPanel, { borderTopColor: c.border }]}>
          <View style={styles.actionRow}>
            <SmallAction label="Gerar hoje" disabled={disabled || routine.status !== 'active'} onPress={onGenerateToday} />
            {routine.status === 'active' ? (
              <SmallAction label="Pausar" disabled={disabled} onPress={onPause} />
            ) : (
              <SmallAction label="Reativar" disabled={disabled || routine.status === 'archived'} onPress={onResume} />
            )}
            <SmallAction label="Arquivar" disabled={disabled || routine.status === 'archived'} onPress={onArchive} danger />
          </View>

          <View style={styles.cardFacts}>
            <Fact label="prioridade" value={priorityLabel(routine.priority)} />
            <Fact label="energia" value={energyLabel(routine.energy_required)} />
            <Fact label="sequência" value={routineStreakLabel(routine)} />
          </View>

          {events.length > 0 ? (
            <View style={[styles.eventsBox, { borderTopColor: c.border }]}>
              <Label>Histórico</Label>
              {events.slice(0, 5).map((event) => (
                <Mono key={event.id} size={10.5} lineHeight={15} letterSpacing={0.1} color={c.ink2}>
                  {eventLabel(event.event_type)} · {dateLabel(event.occurred_at)}
                </Mono>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  )
}

function Chip({
  label,
  active,
  accent,
  onPress,
}: {
  label: string
  active: boolean
  accent?: string
  onPress: () => void
}) {
  const c = usePalette()
  const color = accent ?? c.prussian

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? color : 'transparent',
          borderColor: active ? color : c.border,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <Sans weight="med" size={12} color={active ? c.bg : c.ink2}>
        {label}
      </Sans>
    </Pressable>
  )
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  const c = usePalette()
  return (
    <View>
      <Frau size={24} lineHeight={28} color={tone ?? c.ink}>
        {value}
      </Frau>
      <Mono size={10.5} lineHeight={14} letterSpacing={0.28} color={c.ink2}>
        {label}
      </Mono>
    </View>
  )
}

function StatusPill({ status }: { status: string }) {
  const c = usePalette()
  const active = status === 'active'
  const archived = status === 'archived'
  return (
    <View style={[styles.statusPill, { borderColor: archived ? c.recRed : active ? c.moss : c.border }]}>
      <Mono size={10} lineHeight={13} letterSpacing={0.28} color={archived ? c.recRed : active ? c.moss : c.ink2}>
        {statusLabel(status)}
      </Mono>
    </View>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  const c = usePalette()
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Mono size={10} lineHeight={13} letterSpacing={0.22} color={c.ink2}>
        {label}
      </Mono>
      <Sans weight="med" size={12} lineHeight={16} color={c.ink} numberOfLines={1}>
        {value}
      </Sans>
    </View>
  )
}

function SmallAction({
  label,
  disabled,
  danger,
  onPress,
}: {
  label: string
  disabled?: boolean
  danger?: boolean
  onPress: () => void
}) {
  const c = usePalette()
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallAction,
        {
          borderColor: danger ? c.recRed : c.border,
          backgroundColor: pressed ? c.premium : 'transparent',
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Sans weight="sb" size={11.5} color={danger ? c.recRed : c.prussian}>
        {label}
      </Sans>
    </Pressable>
  )
}

function emptyRoutineDraft(domain: DomainKey): RoutineDraft {
  return {
    title: '',
    description: '',
    domain,
    frequency: 'daily',
    weekdays: [new Date().getDay() === 0 ? 7 : new Date().getDay()],
    preferredTime: '08:30',
    estimatedMinutes: '25',
    priority: 'normal',
    energyRequired: 'medium',
    executionMode: 'maintenance',
    starterStep: '',
    minimumViableAction: '',
  }
}

function weekdaysForDraft(draft: RoutineDraft): number[] {
  if (draft.frequency === 'daily') return []
  if (draft.frequency === 'weekdays') return [1, 2, 3, 4, 5]
  return draft.weekdays.length > 0 ? draft.weekdays : [new Date().getDay() === 0 ? 7 : new Date().getDay()]
}

function toggleWeekday(draft: RoutineDraft, day: number): RoutineDraft {
  const hasDay = draft.weekdays.includes(day)
  const weekdays = hasDay
    ? draft.weekdays.filter((candidate) => candidate !== day)
    : [...draft.weekdays, day].sort((a, b) => a - b)

  return { ...draft, weekdays }
}

function routineHealth(routines: AtlasRoutine[]): { active: number; paused: number; dueToday: number; generatedToday: number } {
  const today = todayDate()
  return {
    active: routines.filter((routine) => routine.status === 'active').length,
    paused: routines.filter((routine) => routine.status === 'paused').length,
    dueToday: routines.filter((routine) => routine.status === 'active' && routine.next_occurrence_date === today).length,
    generatedToday: routines.filter((routine) => routine.last_generated_for_date === today).length,
  }
}

function routineStreakLabel(routine: AtlasRoutine): string {
  const streak = routine.metadata?.streak
  if (!streak || typeof streak !== 'object') return '0 dias'
  const current = Number((streak as Record<string, unknown>).current ?? 0)
  return `${Number.isFinite(current) ? current : 0} dia${current === 1 ? '' : 's'}`
}

function frequencyLabel(routine: AtlasRoutine): string {
  if (routine.frequency === 'daily') return 'TODO DIA'
  if (routine.frequency === 'weekdays') return 'DIAS ÚTEIS'
  if (routine.frequency === 'weekly') return `SEMANAL ${weekdayLabels(routine.weekdays)}`
  if (routine.frequency === 'custom') return `CUSTOM ${weekdayLabels(routine.weekdays)}`
  return String(routine.frequency).toUpperCase()
}

function weekdayLabels(weekdays: number[]): string {
  const labels = weekdays
    .map((day) => WEEKDAYS.find((weekday) => weekday.key === day)?.label)
    .filter(Boolean)
  return labels.length > 0 ? labels.join('/') : '--'
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active': return 'ativa'
    case 'paused': return 'pausada'
    case 'archived': return 'arquivada'
    default: return status
  }
}

function priorityLabel(priority: string): string {
  switch (priority) {
    case 'urgent': return 'urgente'
    case 'high': return 'alta'
    case 'low': return 'baixa'
    case 'normal': return 'normal'
    default: return priority
  }
}

function energyLabel(energy: string): string {
  switch (energy) {
    case 'low': return 'baixa'
    case 'medium': return 'média'
    case 'high': return 'alta'
    default: return energy
  }
}

function eventLabel(eventType: string): string {
  switch (eventType) {
    case 'created': return 'criada'
    case 'updated': return 'editada'
    case 'occurrence_generated': return 'tarefa gerada'
    case 'occurrence_refreshed': return 'tarefa atualizada'
    case 'occurrence_already_completed': return 'já concluída'
    default: return eventType
  }
}

function dateLabel(value?: string | null): string {
  if (!value) return '--'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value.slice(0, 10)
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)
}

function todayDate(): string {
  const date = new Date()
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function normalizeTimeInput(value: string): string | null {
  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (!match) return null
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

function parseClampedInt(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

const styles = StyleSheet.create({
  // headerRow + roundAction removidos · Masthead canon substituiu greeting servil
  gestureRow: { marginTop: 20, marginBottom: 6, alignItems: 'flex-start' },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 22,
  },
  summaryGrid: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
  },
  newRoutineToggle: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  createPanel: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  input: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  inputCompact: { width: 86 },
  textArea: {
    minHeight: 76,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 6,
  },
  routineList: {
    gap: 12,
    marginTop: 14,
  },
  routineCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  cardFacts: {
    flexDirection: 'row',
    gap: 12,
  },
  currentBox: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 5,
  },
  detailPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 12,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  smallAction: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventsBox: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 5,
  },
})
