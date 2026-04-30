import { Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import * as Location from 'expo-location'
import { Screen } from '../components/Screen'
import { SectionHeader } from '../components/SectionHeader'
import { Tile } from '../components/Tile'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { BronzeDiamond } from '../components/console/BronzeDiamond'
import { usePalette } from '../design/theme'
import { useOverlays } from '../lib/overlays'
import { useShell } from '../components/AtlasShell'
import {
  deviceTimezone,
  formatPassiveSignal,
  latestCheckin,
  latestPassiveSignal,
  useAtlasStore,
  visibleBehaviors,
  visibleCaptures,
  visiblePassiveSignals,
} from '../lib/atlasStore'
import {
  completeTask,
  createCalendarBlock,
  deferTask,
  generateDueRoutines,
  listTaskAgenda,
  listTaskEvents,
  planTaskAgenda,
  planTaskWeekAgenda,
  patchTask,
  scheduleTask,
  type AtlasAgendaTask,
  type AtlasCheckin,
  type AtlasTaskAgendaResponse,
  type AtlasTaskEvent,
} from '../lib/api/client'
import { buildReadinessV1 } from '../lib/readiness'
import { isCheckinLevelFresh } from '../lib/checkinFreshness'
import { MOOD_LEVELS } from '../lib/checkinScale'
import { canUseAppleCalendar, createAppleCalendarEvent } from '../lib/appleCalendar'

const CHECKIN_STATES: Array<{ key: AtlasCheckin['state']; label: string }> = [
  { key: 'focused', label: 'Foco' },
  { key: 'disperse', label: 'Disperso' },
  { key: 'blocked', label: 'Bloqueado' },
  { key: 'pause', label: 'Pausa' },
]

type TaskEditDraft = {
  title: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
  estimatedMinutes: string
  energyRequired: 'low' | 'medium' | 'high'
  dueDate: string
  plannedDate: string
  startTime: string
}

const PRIORITY_CHOICES: Array<{ key: TaskEditDraft['priority']; label: string }> = [
  { key: 'urgent', label: 'Urgente' },
  { key: 'high', label: 'Alta' },
  { key: 'normal', label: 'Normal' },
  { key: 'low', label: 'Baixa' },
]

const ENERGY_CHOICES: Array<{ key: TaskEditDraft['energyRequired']; label: string }> = [
  { key: 'low', label: 'Baixa' },
  { key: 'medium', label: 'Média' },
  { key: 'high', label: 'Alta' },
]

export default function HomeScreen() {
  const c = usePalette()
  const router = useRouter()
  const openSettings = useOverlays((s) => s.openSettings)
  const { showToast } = useShell()
  const captures = useAtlasStore((s) => s.captures)
  const queuedCaptures = useAtlasStore((s) => s.queuedCaptures)
  const checkins = useAtlasStore((s) => s.checkins)
  const queuedCheckins = useAtlasStore((s) => s.queuedCheckins)
  const passiveSignals = useAtlasStore((s) => s.passiveSignals)
  const queuedPassiveSignals = useAtlasStore((s) => s.queuedPassiveSignals)
  const behaviors = useAtlasStore((s) => s.behaviors)
  const queuedBehaviors = useAtlasStore((s) => s.queuedBehaviors)
  const mission = useAtlasStore((s) => s.mission)
  const createCheckin = useAtlasStore((s) => s.createCheckin)
  const [locationLabel, setLocationLabel] = useState<string | null>(null)
  const [checkinState, setCheckinState] = useState<AtlasCheckin['state'] | null>(null)
  const [energyLevel, setEnergyLevel] = useState<number | null>(null)
  const [moodLevel, setMoodLevel] = useState<number | null>(null)
  const [checkinEditing, setCheckinEditing] = useState(false)
  const [agenda, setAgenda] = useState<AtlasTaskAgendaResponse | null>(null)
  const [agendaLoading, setAgendaLoading] = useState(false)
  const [selectedTask, setSelectedTask] = useState<AtlasAgendaTask | null>(null)
  const [taskDraft, setTaskDraft] = useState<TaskEditDraft>(() => emptyTaskDraft())
  const [taskEvents, setTaskEvents] = useState<AtlasTaskEvent[]>([])
  const [blockEditorOpen, setBlockEditorOpen] = useState(false)
  const [blockDraft, setBlockDraft] = useState({ title: 'Compromisso', startTime: '13:00', endTime: '14:00' })
  const [calendarBusyTaskId, setCalendarBusyTaskId] = useState<string | null>(null)
  const [agendaPlanning, setAgendaPlanning] = useState(false)
  const [weekPlanning, setWeekPlanning] = useState(false)
  const [agendaExpanded, setAgendaExpanded] = useState(false)

  const captureCountToday = useMemo(() => {
    const today = new Date().toDateString()
    return visibleCaptures({ captures, queuedCaptures })
      .filter((capture) => new Date(capture.captured_at).toDateString() === today)
      .length
  }, [captures, queuedCaptures])
  const latestState = useMemo(
    () => latestCheckin({ checkins, queuedCheckins }),
    [checkins, queuedCheckins],
  )
  const currentLevelState = useMemo(
    () => (isCheckinLevelFresh(latestState) ? latestState : null),
    [latestState],
  )
  const checkinsForReadiness = useMemo(
    () => (latestState ? [latestState, ...checkins] : checkins),
    [checkins, latestState],
  )
  const allSignals = useMemo(
    () => visiblePassiveSignals({ passiveSignals, queuedPassiveSignals }),
    [passiveSignals, queuedPassiveSignals],
  )
  const readiness = useMemo(
    () => buildReadinessV1({
      healthSignals: allSignals.filter((signal) => signal.source === 'healthkit'),
      allSignals,
      latestCheckin: latestState,
      checkins: checkinsForReadiness,
    }),
    [allSignals, checkinsForReadiness, latestState],
  )
  const sleep = useMemo(
    () => latestPassiveSignal({ passiveSignals, queuedPassiveSignals }, 'sleep_duration_hours'),
    [passiveSignals, queuedPassiveSignals],
  )
  const hrv = useMemo(
    () => latestPassiveSignal({ passiveSignals, queuedPassiveSignals }, 'hrv_ms'),
    [passiveSignals, queuedPassiveSignals],
  )
  const question = missionQuestion(mission?.metadata)
  const canSaveCheckin = checkinState !== null && energyLevel !== null && moodLevel !== null
  const activeBehaviorCount = useMemo(() => (
    visibleBehaviors({ behaviors, queuedBehaviors })
      .filter((behavior) => !behavior.archived_at && behavior.show_in_morning_briefing)
      .length
  ), [behaviors, queuedBehaviors])

  const loadAgenda = async () => {
    setAgendaLoading(true)
    try {
      await generateDueRoutines({
        date: todayDate(),
        timezone: deviceTimezone(),
      }).catch(() => null)
      const response = await listTaskAgenda({
        timezone: deviceTimezone(),
        energy_level: currentLevelState?.energy_level ?? undefined,
        limit: 12,
      })
      setAgenda(response)
    } catch {
      setAgenda(null)
    } finally {
      setAgendaLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    void resolveCurrentCity().then((city) => {
      if (mounted && city) setLocationLabel(city)
    })

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true

    setAgendaLoading(true)
    void generateDueRoutines({
      date: todayDate(),
      timezone: deviceTimezone(),
    })
      .catch(() => null)
      .then(() => listTaskAgenda({
        timezone: deviceTimezone(),
        energy_level: currentLevelState?.energy_level ?? undefined,
        limit: 12,
      }))
      .then((response) => {
        if (mounted) setAgenda(response)
      })
      .catch(() => {
        if (mounted) setAgenda(null)
      })
      .finally(() => {
        if (mounted) setAgendaLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [currentLevelState?.energy_level])

  const saveCheckin = async () => {
    if (!checkinState || !energyLevel || !moodLevel) return

    await createCheckin({
      state: checkinState,
      energyLevel,
      moodLevel,
      metadata: { entrypoint: 'home_checkin' },
    })
    setCheckinState(null)
    setEnergyLevel(null)
    setMoodLevel(null)
    setCheckinEditing(false)
    showToast('Check-in registrado', { variant: 'checkin' })
  }

  const openTaskEditor = async (task: AtlasAgendaTask) => {
    setSelectedTask(task)
    setTaskDraft(draftFromTask(task))
    try {
      const response = await listTaskEvents(task.id, { limit: 5 })
      setTaskEvents(response.events)
    } catch {
      setTaskEvents([])
    }
  }

  const closeTaskEditor = () => {
    setSelectedTask(null)
    setTaskEvents([])
    setTaskDraft(emptyTaskDraft())
  }

  const markTaskDone = async (task: AtlasAgendaTask) => {
    try {
      await completeTask(task.id, { note: 'Concluída pela Home.' })
      showToast('Tarefa concluída', { variant: 'checkin' })
      if (selectedTask?.id === task.id) closeTaskEditor()
      await loadAgenda()
    } catch {
      showToast('Não consegui concluir a tarefa')
    }
  }

  const deferAgendaTask = async (task: AtlasAgendaTask) => {
    try {
      await deferTask(task.id, {
        defer_until: tomorrowDate(),
        timezone: deviceTimezone(),
        reason: 'Adiada pela Home.',
      })
      showToast('Adiada para amanhã', { variant: 'checkin' })
      if (selectedTask?.id === task.id) closeTaskEditor()
      await loadAgenda()
    } catch {
      showToast('Não consegui adiar a tarefa')
    }
  }

  const saveTaskDraft = async () => {
    if (!selectedTask) return

    try {
      const estimatedMinutes = parseClampedInt(taskDraft.estimatedMinutes, 5, 480, selectedTask.estimated_minutes)
      await patchTask(selectedTask.id, {
        title: taskDraft.title.trim() || selectedTask.title,
        priority: taskDraft.priority,
        estimated_minutes: estimatedMinutes,
        energy_required: taskDraft.energyRequired,
        due_at: dateInputToIso(taskDraft.dueDate),
      })

      if (taskDraft.plannedDate.trim()) {
        const plannedStart = taskDraft.startTime.trim()
          ? localDateTimeToIso(taskDraft.plannedDate, taskDraft.startTime)
          : null
        await scheduleTask(selectedTask.id, {
          planned_for_date: taskDraft.plannedDate,
          planned_start_at: plannedStart,
          planned_end_at: plannedStart ? addMinutesIso(plannedStart, estimatedMinutes) : null,
          estimated_minutes: estimatedMinutes,
          timezone: deviceTimezone(),
          note: 'Planejada pela Home.',
        })
      }

      showToast('Tarefa atualizada', { variant: 'checkin' })
      closeTaskEditor()
      await loadAgenda()
    } catch {
      showToast('Não consegui salvar a tarefa')
    }
  }

  const createAgendaBlock = async () => {
    try {
      const today = todayDate()
      await createCalendarBlock({
        block_date: today,
        timezone: deviceTimezone(),
        title: blockDraft.title.trim() || 'Compromisso',
        starts_at: localDateTimeToIso(today, blockDraft.startTime),
        ends_at: localDateTimeToIso(today, blockDraft.endTime),
        source: 'manual',
        metadata: { entrypoint: 'home_agenda_block' },
      })
      setBlockEditorOpen(false)
      setBlockDraft({ title: 'Compromisso', startTime: '13:00', endTime: '14:00' })
      showToast('Horário bloqueado', { variant: 'checkin' })
      await loadAgenda()
    } catch {
      showToast('Revise início e fim do bloqueio')
    }
  }

  const planTodayAgenda = async () => {
    if (agendaPlanning) return

    setAgendaPlanning(true)
    try {
      await generateDueRoutines({
        date: todayDate(),
        timezone: deviceTimezone(),
      }).catch(() => null)
      const response = await planTaskAgenda({
        date: todayDate(),
        timezone: deviceTimezone(),
        energy_level: currentLevelState?.energy_level ?? undefined,
        limit: 12,
        create_blocks: true,
      })
      setAgenda(response.agenda)
      showToast(
        response.planned_count > 0
          ? `${response.planned_count} tarefa${response.planned_count === 1 ? '' : 's'} planejada${response.planned_count === 1 ? '' : 's'}`
          : 'Agenda já estava planejada',
        { variant: 'checkin' },
      )
    } catch {
      showToast('Não consegui planejar o dia')
    } finally {
      setAgendaPlanning(false)
    }
  }

  const planWeekAgenda = async () => {
    if (weekPlanning) return

    setWeekPlanning(true)
    try {
      const startDate = todayDate()
      await Promise.all(
        Array.from({ length: 7 }, (_, index) =>
          generateDueRoutines({
            date: addDaysDate(startDate, index),
            timezone: deviceTimezone(),
          }).catch(() => null),
        ),
      )
      const response = await planTaskWeekAgenda({
        start_date: startDate,
        timezone: deviceTimezone(),
        energy_level: currentLevelState?.energy_level ?? undefined,
        days: 7,
        weekday_capacity_minutes: 210,
        weekend_capacity_minutes: 90,
        daily_limit: 6,
        create_blocks: true,
      })
      setAgenda(response.week.days[0]?.agenda ?? null)
      showToast(
        response.planned_count > 0
          ? `${response.planned_count} tarefa${response.planned_count === 1 ? '' : 's'} distribuída${response.planned_count === 1 ? '' : 's'} na semana`
          : 'Semana já estava planejada',
        { variant: 'checkin' },
      )
    } catch {
      showToast('Não consegui planejar a semana')
    } finally {
      setWeekPlanning(false)
    }
  }

  const addTaskToAppleCalendar = async (task: AtlasAgendaTask, draft?: TaskEditDraft) => {
    if (calendarBusyTaskId) return

    if (!canUseAppleCalendar()) {
      showToast('Calendário Apple disponível apenas no iPhone')
      return
    }

    const existingBlock = agenda?.blocks?.find((block) => block.task_id === task.id && block.source === 'external_calendar')
    if (existingBlock?.source_ref) {
      showToast('Essa tarefa já está no calendário')
      return
    }

    const window = calendarWindowForTask(task, draft)
    if (!window) {
      showToast('Defina dia e hora antes de marcar')
      return
    }

    setCalendarBusyTaskId(task.id)
    try {
      const event = await createAppleCalendarEvent({
        title: `Atlas · ${draft?.title?.trim() || task.title}`,
        startsAt: window.startsAt,
        endsAt: window.endsAt,
        timeZone: deviceTimezone(),
        notes: calendarNotesForTask(task),
        alarmMinutesBefore: 10,
      })

      if (draft) {
        await patchTask(task.id, {
          title: draft.title.trim() || task.title,
          priority: draft.priority,
          estimated_minutes: window.estimatedMinutes,
          energy_required: draft.energyRequired,
          due_at: dateInputToIso(draft.dueDate),
        })
      }
      await scheduleTask(task.id, {
        planned_for_date: dateOnlyFromIso(window.startsAt),
        planned_start_at: window.startsAt,
        planned_end_at: window.endsAt,
        estimated_minutes: window.estimatedMinutes,
        timezone: deviceTimezone(),
        note: `Marcada no Calendário Apple (${event.calendarTitle}).`,
      })
      await createCalendarBlock({
        block_date: dateOnlyFromIso(window.startsAt),
        timezone: deviceTimezone(),
        title: draft?.title?.trim() || task.title,
        starts_at: window.startsAt,
        ends_at: window.endsAt,
        source: 'external_calendar',
        source_ref: event.eventId,
        task_id: task.id,
        metadata: {
          provider: 'apple_calendar',
          calendar_id: event.calendarId,
          calendar_title: event.calendarTitle,
          entrypoint: 'home_task_calendar',
        },
      })

      showToast(`Marcada em ${event.calendarTitle}`, { variant: 'checkin' })
      if (selectedTask?.id === task.id) closeTaskEditor()
      await loadAgenda()
    } catch {
      showToast('Não consegui marcar no Calendário')
    } finally {
      setCalendarBusyTaskId(null)
    }
  }

  const addAgendaPlanToAppleCalendar = async () => {
    if (calendarBusyTaskId) return

    if (!canUseAppleCalendar()) {
      showToast('Calendário Apple disponível apenas no iPhone')
      return
    }

    setCalendarBusyTaskId('agenda')
    try {
      const planned = await planTaskAgenda({
        date: todayDate(),
        timezone: deviceTimezone(),
        energy_level: currentLevelState?.energy_level ?? undefined,
        limit: 12,
        create_blocks: true,
      })
      const existingTaskIds = new Set(
        planned.agenda.blocks
          ?.filter((block) => block.source === 'external_calendar' && block.task_id)
          .map((block) => block.task_id as string) ?? [],
      )
      let created = 0

      for (const task of planned.agenda.tasks) {
        if (existingTaskIds.has(task.id)) continue

        const window = calendarWindowForTask(task)
        if (!window) continue

        const event = await createAppleCalendarEvent({
          title: `Atlas · ${task.title}`,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          timeZone: deviceTimezone(),
          notes: calendarNotesForTask(task),
          alarmMinutesBefore: 10,
        })

        await scheduleTask(task.id, {
          planned_for_date: dateOnlyFromIso(window.startsAt),
          planned_start_at: window.startsAt,
          planned_end_at: window.endsAt,
          estimated_minutes: window.estimatedMinutes,
          timezone: deviceTimezone(),
          note: `Marcada no Calendário Apple (${event.calendarTitle}) pelo plano do dia.`,
        })
        await createCalendarBlock({
          block_date: dateOnlyFromIso(window.startsAt),
          timezone: deviceTimezone(),
          title: task.title,
          starts_at: window.startsAt,
          ends_at: window.endsAt,
          source: 'external_calendar',
          source_ref: event.eventId,
          task_id: task.id,
          metadata: {
            provider: 'apple_calendar',
            calendar_id: event.calendarId,
            calendar_title: event.calendarTitle,
            entrypoint: 'home_agenda_plan_calendar',
          },
        })
        created += 1
      }

      showToast(created > 0 ? `${created} evento${created === 1 ? '' : 's'} no Calendário` : 'Plano já estava no Calendário', { variant: 'checkin' })
      await loadAgenda()
    } catch {
      showToast('Não consegui marcar o plano no Calendário')
    } finally {
      setCalendarBusyTaskId(null)
    }
  }

  return (
    <Screen>
      <View style={styles.greetRow}>
        <View style={{ flex: 1 }}>
          <Frau size={38} lineHeight={40} letterSpacing={-0.95} color={c.ink}>
            Bom dia,{'\n'}Vitor
          </Frau>
          <Mono size={11} lineHeight={14} letterSpacing={0.44} color={c.ink2} style={{ marginTop: 6, textTransform: 'uppercase' }}>
            {todayLine()}{locationLabel ? ` · ${locationLabel}` : ''}
          </Mono>
        </View>
        <Pressable
          onPress={openSettings}
          accessibilityLabel="Configurações"
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerMark,
            { opacity: pressed ? 0.55 : 1 },
          ]}
        >
          <BronzeDiamond size={20} opacity={0.85} />
        </Pressable>
      </View>

      <View style={styles.statusLine}>
        <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity: 0.55 }}>
          {bodyStatusLine({ sleep, hrv, energy: currentLevelState?.energy_level ?? null, readiness: readiness.base.display })}
        </Frau>
      </View>

      <View style={[styles.divider, { backgroundColor: c.ink2, opacity: 0.5 }]} />

      <View style={[styles.prompt, { borderLeftColor: c.bronze }]}>
        <Frau italic size={18} lineHeight={26} color={c.ink2}>
          {question ? `“${question}”` : 'Nenhuma pergunta registrada para hoje.'}
        </Frau>
      </View>

      <SectionHeader label="Missão de hoje" />
      <Pressable
        onPress={() => router.push('/ritual')}
        style={({ pressed }) => [
          styles.mission,
          {
            backgroundColor: pressed ? c.premium : c.surface,
            borderColor: c.border,
            borderLeftColor: c.bronze,
          },
        ]}
      >
        <Sans weight="sb" size={16} lineHeight={20} color={c.ink} style={{ marginBottom: 4 }}>
          {mission?.title ?? 'Nenhuma missão definida'}
        </Sans>
        <Mono size={11} lineHeight={14} letterSpacing={0.22} color={c.ink2}>
          {mission?.detail ?? 'Abra o ritual para revisar o dia'}
        </Mono>
      </Pressable>

      <SectionHeader label="Próxima ação" />
      <View style={[styles.agendaPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
        {agenda && agenda.tasks.length > 0 ? (
          <>
            {(agendaExpanded ? agenda.tasks.slice(0, 3) : agenda.tasks.slice(0, 1)).map((task, index) => (
              <View
                key={task.id}
                style={[
                  styles.agendaTaskShell,
                  { borderColor: c.border, marginTop: index === 0 ? 0 : 12 },
                ]}
              >
                <Pressable onPress={() => { void openTaskEditor(task) }} style={styles.nextActionMeta}>
                  <Mono size={11} lineHeight={15} letterSpacing={0.32} color={c.prussian}>
                    {formatAgendaTime(task.recommended_start_at)}
                  </Mono>
                  <Sans
                    weight="sb"
                    size={10.5}
                    lineHeight={14}
                    letterSpacing={1.05}
                    color={c.ink2}
                    style={styles.uppercase}
                  >
                    {priorityLabel(task.priority)}
                  </Sans>
                  <Mono size={10.5} lineHeight={14} letterSpacing={0.28} color={c.ink2}>
                    {task.estimated_minutes}min
                  </Mono>
                  <Mono size={10.5} lineHeight={14} letterSpacing={0.28} color={c.ink2}>
                    {agendaIntentLabel(task)}
                  </Mono>
                </Pressable>
                <Sans
                  weight="sb"
                  size={15}
                  lineHeight={22}
                  color={c.ink}
                  numberOfLines={3}
                  style={styles.nextActionTitle}
                >
                  {task.title}
                </Sans>
                <View style={styles.agendaActions}>
                  <MiniAction label="Feita" onPress={() => { void markTaskDone(task) }} />
                  <MiniAction label="Adiar" onPress={() => { void deferAgendaTask(task) }} />
                  <MiniAction label="Editar" onPress={() => { void openTaskEditor(task) }} />
                </View>
              </View>
            ))}

            <Pressable
              onPress={() => setAgendaExpanded((value) => !value)}
              hitSlop={8}
              style={({ pressed }) => [styles.agendaToggle, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity: 0.5 }}>
                {agendaExpanded
                  ? '· recolher'
                  : agenda.tasks.length > 1
                    ? `ver agenda completa · ${agenda.tasks.length} no dia`
                    : 'ver agenda completa'}
              </Frau>
            </Pressable>

            {agendaExpanded ? (
              <View style={styles.agendaActions}>
                <MiniAction
                  label={agendaPlanning ? 'Planejando' : 'Planejar hoje'}
                  onPress={() => { void planTodayAgenda() }}
                />
                <MiniAction
                  label={weekPlanning ? 'Planejando' : 'Planejar semana'}
                  onPress={() => { void planWeekAgenda() }}
                />
                <MiniAction
                  label={calendarBusyTaskId === 'agenda' ? 'Marcando' : 'Marcar plano'}
                  onPress={() => { void addAgendaPlanToAppleCalendar() }}
                />
              </View>
            ) : null}
            {selectedTask ? (
              <View style={[styles.taskEditor, { borderColor: c.border, backgroundColor: c.bg }]}>
                <View style={styles.agendaHeader}>
                  <Sans weight="sb" size={13.5} lineHeight={18} color={c.ink} style={{ flex: 1 }}>
                    Ajustar tarefa
                  </Sans>
                  <Pressable onPress={closeTaskEditor}>
                    <Mono size={10.5} lineHeight={14} letterSpacing={0.2} color={c.ink2}>fechar</Mono>
                  </Pressable>
                </View>
                <TextInput
                  value={taskDraft.title}
                  onChangeText={(title) => setTaskDraft((draft) => ({ ...draft, title }))}
                  placeholder="título"
                  placeholderTextColor={c.ink2}
                  style={[styles.input, { borderColor: c.border, color: c.ink }]}
                />
                <View style={styles.choiceRow}>
                  {PRIORITY_CHOICES.map((choice) => (
                    <TaskChip
                      key={choice.key}
                      label={choice.label}
                      active={taskDraft.priority === choice.key}
                      onPress={() => setTaskDraft((draft) => ({ ...draft, priority: choice.key }))}
                    />
                  ))}
                </View>
                <View style={styles.choiceRow}>
                  {ENERGY_CHOICES.map((choice) => (
                    <TaskChip
                      key={choice.key}
                      label={`energia ${choice.label.toLowerCase()}`}
                      active={taskDraft.energyRequired === choice.key}
                      onPress={() => setTaskDraft((draft) => ({ ...draft, energyRequired: choice.key }))}
                    />
                  ))}
                </View>
                <View style={styles.formRow}>
                  <TextInput
                    value={taskDraft.estimatedMinutes}
                    onChangeText={(estimatedMinutes) => setTaskDraft((draft) => ({ ...draft, estimatedMinutes }))}
                    keyboardType="number-pad"
                    placeholder="min"
                    placeholderTextColor={c.ink2}
                    style={[styles.input, styles.inputCompact, { borderColor: c.border, color: c.ink }]}
                  />
                  <TextInput
                    value={taskDraft.dueDate}
                    onChangeText={(dueDate) => setTaskDraft((draft) => ({ ...draft, dueDate }))}
                    placeholder="prazo AAAA-MM-DD"
                    placeholderTextColor={c.ink2}
                    style={[styles.input, { borderColor: c.border, color: c.ink, flex: 1 }]}
                  />
                </View>
                <View style={styles.formRow}>
                  <TextInput
                    value={taskDraft.plannedDate}
                    onChangeText={(plannedDate) => setTaskDraft((draft) => ({ ...draft, plannedDate }))}
                    placeholder="dia AAAA-MM-DD"
                    placeholderTextColor={c.ink2}
                    style={[styles.input, { borderColor: c.border, color: c.ink, flex: 1 }]}
                  />
                  <TextInput
                    value={taskDraft.startTime}
                    onChangeText={(startTime) => setTaskDraft((draft) => ({ ...draft, startTime }))}
                    placeholder="hora"
                    placeholderTextColor={c.ink2}
                    style={[styles.input, styles.inputCompact, { borderColor: c.border, color: c.ink }]}
                  />
                </View>
                {taskEvents.length > 0 ? (
                  <View style={[styles.eventList, { borderTopColor: c.border }]}>
                    {taskEvents.slice(0, 3).map((event) => (
                      <Mono key={event.id} size={10.5} lineHeight={14} letterSpacing={0.18} color={c.ink2}>
                        {eventLabel(event.event_type)} · {formatAgendaTime(event.occurred_at)}
                      </Mono>
                    ))}
                  </View>
                ) : null}
                <Pressable
                  onPress={() => { void saveTaskDraft() }}
                  style={({ pressed }) => [
                    styles.saveTask,
                    { backgroundColor: c.ink, opacity: pressed ? 0.88 : 1 },
                  ]}
                >
                  <Sans weight="sb" size={13} color={c.bg} align="center">Salvar tarefa</Sans>
                </Pressable>
                <Pressable
                  onPress={() => { void addTaskToAppleCalendar(selectedTask, taskDraft) }}
                  style={({ pressed }) => [
                    styles.saveTask,
                    { backgroundColor: c.prussian, opacity: pressed ? 0.88 : 1 },
                  ]}
                >
                  <Sans weight="sb" size={13} color={c.bg} align="center">
                    {calendarBusyTaskId === selectedTask.id ? 'Marcando…' : 'Salvar no Calendário Apple'}
                  </Sans>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : agendaLoading ? (
          <>
            <Sans weight="sb" size={14} lineHeight={18} color={c.ink}>
              Montando agenda
            </Sans>
            <Sans size={11.5} lineHeight={16} color={c.ink2}>
              Calculando prioridade, energia, blocos e esforço.
            </Sans>
          </>
        ) : (
          <>
            <Sans weight="sb" size={14} lineHeight={18} color={c.ink}>
              Nenhuma tarefa ativa para hoje
            </Sans>
            <Sans size={11.5} lineHeight={16} color={c.ink2}>
              Quando uma captura virar tarefa, o Atlas calcula prioridade, esforço e lugar na agenda.
            </Sans>
          </>
        )}
        {agendaExpanded ? (
          <View style={[styles.blockEditor, { borderTopColor: c.border }]}>
            <Pressable onPress={() => setBlockEditorOpen((open) => !open)} style={styles.blockHeader}>
              <Sans weight="sb" size={12.5} lineHeight={16} color={c.ink}>
                Bloquear horário
              </Sans>
              <Mono size={10.5} lineHeight={14} letterSpacing={0.2} color={c.ink2}>
                {blockEditorOpen ? 'fechar' : 'abrir'}
              </Mono>
            </Pressable>
            {blockEditorOpen ? (
              <>
                <TextInput
                  value={blockDraft.title}
                  onChangeText={(title) => setBlockDraft((draft) => ({ ...draft, title }))}
                  placeholder="compromisso"
                  placeholderTextColor={c.ink2}
                  style={[styles.input, { borderColor: c.border, color: c.ink }]}
                />
                <View style={styles.formRow}>
                  <TextInput
                    value={blockDraft.startTime}
                    onChangeText={(startTime) => setBlockDraft((draft) => ({ ...draft, startTime }))}
                    placeholder="início"
                    placeholderTextColor={c.ink2}
                    style={[styles.input, styles.inputCompact, { borderColor: c.border, color: c.ink }]}
                  />
                  <TextInput
                    value={blockDraft.endTime}
                    onChangeText={(endTime) => setBlockDraft((draft) => ({ ...draft, endTime }))}
                    placeholder="fim"
                    placeholderTextColor={c.ink2}
                    style={[styles.input, styles.inputCompact, { borderColor: c.border, color: c.ink }]}
                  />
                  <Pressable
                    onPress={() => { void createAgendaBlock() }}
                    style={({ pressed }) => [
                      styles.blockSave,
                      { backgroundColor: c.prussian, opacity: pressed ? 0.88 : 1 },
                    ]}
                  >
                    <Sans weight="sb" size={12.5} color={c.bg}>Salvar</Sans>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        ) : null}
      </View>

      <SectionHeader label="Como você está agora" />
      {currentLevelState && !checkinEditing && !(checkinState || energyLevel || moodLevel) ? (
        <Pressable
          onPress={() => {
            setCheckinState(null)
            setEnergyLevel(null)
            setMoodLevel(null)
            setCheckinEditing(true)
          }}
          hitSlop={8}
          style={({ pressed }) => [styles.checkinDone, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Frau italic size={14} lineHeight={20} color={c.ink} style={{ opacity: 0.55 }}>
            ✓ check-in registrado · refazer
          </Frau>
        </Pressable>
      ) : (
        <View style={[styles.checkinPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Label>Estado</Label>
          <View style={styles.choiceRow}>
            {CHECKIN_STATES.map((state) => (
              <CheckinPill
                key={state.key}
                label={state.label}
                active={checkinState === state.key}
                onPress={() => setCheckinState(state.key)}
              />
            ))}
          </View>

          {checkinState ? (
            <>
              <Label style={{ marginTop: 16 }}>Energia</Label>
              <View style={styles.levelRow}>
                {[1, 2, 3, 4, 5].map((level) => (
                  <LevelPill
                    key={level}
                    level={level}
                    active={energyLevel === level}
                    onPress={() => setEnergyLevel(level)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {energyLevel ? (
            <>
              <Label style={{ marginTop: 16 }}>Humor</Label>
              <View style={styles.choiceRow}>
                {MOOD_LEVELS.map((level) => (
                  <CheckinPill
                    key={level.value}
                    label={level.label}
                    active={moodLevel === level.value}
                    onPress={() => setMoodLevel(level.value)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {canSaveCheckin ? (
            <Pressable
              onPress={() => {
                void saveCheckin()
              }}
              style={({ pressed }) => [
                styles.saveCheckin,
                { backgroundColor: c.ink, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <Sans weight="sb" size={14} color={c.bg} align="center">
                Registrar
              </Sans>
            </Pressable>
          ) : null}
        </View>
      )}

      <View style={styles.portas}>
        <Doorway
          label="ritual"
          value="briefing matinal"
          onPress={() => router.push('/ritual')}
        />
        <Doorway
          label="revisão"
          value="weekly"
          onPress={() => router.push('/review')}
        />
        <Doorway
          label="inbox"
          value={inboxValue(captureCountToday)}
          onPress={() => router.push('/inbox')}
        />
        <Doorway
          label="bitácula"
          value={`${activeBehaviorCount} ${activeBehaviorCount === 1 ? 'ativo' : 'ativos'}`}
          onPress={() => router.push('/bitacula')}
        />
        <Doorway
          label="saúde"
          value={healthValue(sleep, hrv)}
          onPress={() => router.push('/health')}
        />
        <Doorway
          label="plano"
          value="abrir"
          onPress={() => router.push('/projects')}
        />
        <Doorway
          label="rotinas"
          value="montar dia"
          onPress={() => router.push('/routines')}
        />
      </View>
    </Screen>
  )
}

// Editorial entry-point row. Italic Frau label on the left, italic dim
// value on the right, hairline separator. Replaces the former dashboard
// tiles (Estado físico / Capturas / Execução / Ritual) — same destinations,
// 1/4 of the visual weight.
function Doorway({
  label,
  value,
  onPress,
}: {
  label: string
  value: string
  onPress: () => void
}) {
  const c = usePalette()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.doorway,
        { borderBottomColor: c.border, opacity: pressed ? 0.55 : 1 },
      ]}
    >
      <Frau italic size={15} lineHeight={22} color={c.ink} style={{ opacity: 0.75 }}>
        {label}
      </Frau>
      <View style={{ flex: 1 }} />
      <Frau italic size={13.5} lineHeight={22} color={c.ink} style={{ opacity: 0.45 }}>
        {value}
      </Frau>
    </Pressable>
  )
}

function CheckinPill({
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
        styles.choicePill,
        {
          backgroundColor: active ? c.prussian : 'transparent',
          borderColor: active ? c.prussian : c.border,
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

function LevelPill({
  level,
  active,
  onPress,
}: {
  level: number
  active: boolean
  onPress: () => void
}) {
  const c = usePalette()

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.levelPill,
        {
          backgroundColor: active ? c.bronze : 'transparent',
          borderColor: active ? c.bronze : c.border,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <Mono size={13} color={active ? c.bg : c.ink2}>
        {level}
      </Mono>
    </Pressable>
  )
}

function TaskChip({
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
        styles.taskChip,
        {
          backgroundColor: active ? c.prussian : 'transparent',
          borderColor: active ? c.prussian : c.border,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <Sans weight="med" size={11.5} color={active ? c.bg : c.ink2}>
        {label}
      </Sans>
    </Pressable>
  )
}

function MiniAction({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}) {
  const c = usePalette()

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniAction,
        {
          borderColor: c.border,
          backgroundColor: pressed ? c.premium : 'transparent',
        },
      ]}
    >
      <Sans weight="sb" size={11.5} color={c.prussian}>
        {label}
      </Sans>
    </Pressable>
  )
}

function todayLine(): string {
  const date = new Date()
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
    .format(date)
    .replace('.', '')
    .toUpperCase()
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit' }).format(date)
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
    .format(date)
    .replace('.', '')
    .toUpperCase()
  const year = new Intl.DateTimeFormat('pt-BR', { year: 'numeric' }).format(date)

  return `${weekday} · ${day}.${month}.${year}`
}

async function resolveCurrentCity(): Promise<string | null> {
  try {
    const permission = await Location.getForegroundPermissionsAsync()
    const granted = permission.granted
      ? permission
      : await Location.requestForegroundPermissionsAsync()

    if (!granted.granted) {
      return null
    }

    const position = await Location.getLastKnownPositionAsync({
      maxAge: 30 * 60 * 1000,
      requiredAccuracy: 5000,
    }) ?? await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    })

    const [address] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    })

    return cityFromAddress(address)
  } catch {
    return null
  }
}

function cityFromAddress(address?: Location.LocationGeocodedAddress): string | null {
  const city = [
    address?.city,
    address?.district,
    address?.subregion,
    address?.region,
  ].find((value) => typeof value === 'string' && value.trim().length > 0)

  return city ? city.trim() : null
}

function missionQuestion(metadata?: Record<string, unknown>): string | null {
  const question = metadata?.question
  return typeof question === 'string' && question.trim() ? question.trim() : null
}

function bodyStatusLine({
  sleep,
  hrv,
  energy,
  readiness,
}: {
  sleep: ReturnType<typeof latestPassiveSignal>
  hrv: ReturnType<typeof latestPassiveSignal>
  energy: number | null
  readiness: string
}): string {
  const segments: string[] = []
  const sleepLabel = formatPassiveSignal(sleep)
  if (sleepLabel && sleepLabel !== '—') segments.push(`sono ${sleepLabel.toLowerCase()}`)
  if (energy != null) segments.push(`energia ${energy}/5`)
  if (readiness) segments.push(`prontidão ${readiness.toLowerCase()}`)
  const hrvLabel = formatPassiveSignal(hrv)
  if (hrvLabel && hrvLabel !== '—' && segments.length < 3) segments.push(`hrv ${hrvLabel.toLowerCase()}`)
  return segments.length > 0 ? segments.join(' · ') : 'corpo sem leitura ainda'
}

function inboxValue(count: number): string {
  if (count === 0) return 'sem capturas hoje'
  return count === 1 ? '1 captura hoje' : `${count} capturas hoje`
}

function healthValue(
  sleep: ReturnType<typeof latestPassiveSignal>,
  hrv: ReturnType<typeof latestPassiveSignal>,
): string {
  const sleepLabel = formatPassiveSignal(sleep)
  const hrvLabel = formatPassiveSignal(hrv)
  if (sleepLabel && sleepLabel !== '—') return `sono ${sleepLabel.toLowerCase()}`
  if (hrvLabel && hrvLabel !== '—') return `hrv ${hrvLabel.toLowerCase()}`
  return 'ver detalhes'
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

function agendaIntentLabel(task: AtlasAgendaTask): string {
  switch (task.agenda_intent) {
    case 'continue': return 'continuação'
    case 'recover': return 'retomada'
    case 'replan': return 'replanejar'
    case 'unblock': return 'destravar'
    case 'execute':
    default: return task.bucket || 'execução'
  }
}

function taskProjectLabel(task: AtlasAgendaTask): string | null {
  const title = task.project_title ?? task.project?.title
  return title ? `projeto: ${title}` : null
}

function taskStepLabel(task: AtlasAgendaTask): string | null {
  const title = task.project_step_title ?? task.project_step?.title
  return title ? `etapa: ${title}` : null
}

function taskRoutineLabel(task: AtlasAgendaTask): string | null {
  const title = task.routine_title ?? task.routine?.title
  return title ? `rotina: ${title}` : null
}

function formatAgendaTime(value?: string | null): string {
  if (!value) return '--:--'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '--:--'
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function emptyTaskDraft(): TaskEditDraft {
  return {
    title: '',
    priority: 'normal',
    estimatedMinutes: '25',
    energyRequired: 'medium',
    dueDate: '',
    plannedDate: todayDate(),
    startTime: '',
  }
}

function draftFromTask(task: AtlasAgendaTask): TaskEditDraft {
  return {
    title: task.title,
    priority: normalizePriority(task.priority),
    estimatedMinutes: String(task.estimated_minutes ?? 25),
    energyRequired: normalizeEnergy(task.energy_required),
    dueDate: dateOnlyFromIso(task.due_at),
    plannedDate: task.planned_for_date ?? todayDate(),
    startTime: timeOnlyFromIso(task.planned_start_at ?? task.recommended_start_at),
  }
}

function calendarWindowForTask(
  task: AtlasAgendaTask,
  draft?: TaskEditDraft,
): { startsAt: string; endsAt: string; estimatedMinutes: number } | null {
  const estimatedMinutes = draft
    ? parseClampedInt(draft.estimatedMinutes, 5, 480, task.estimated_minutes)
    : Math.max(5, task.estimated_minutes || 25)

  const startsAt = draft?.plannedDate?.trim() && draft?.startTime?.trim()
    ? localDateTimeToIso(draft.plannedDate, draft.startTime)
    : task.planned_start_at ?? task.recommended_start_at ?? null
  if (!startsAt) return null

  const endsAt = task.planned_end_at && !draft
    ? task.planned_end_at
    : addMinutesIso(startsAt, estimatedMinutes)
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
    return null
  }

  return { startsAt, endsAt, estimatedMinutes }
}

function calendarNotesForTask(task: AtlasAgendaTask): string {
  return [
    'Criado pelo Atlas.',
    taskProjectLabel(task) ? `\n${taskProjectLabel(task)}` : null,
    taskRoutineLabel(task) ? `\n${taskRoutineLabel(task)}` : null,
    taskStepLabel(task) ? `\n${taskStepLabel(task)}` : null,
    task.starter_step ? `\nComeçar por: ${task.starter_step}` : null,
    task.minimum_viable_action ? `\nMínimo viável: ${task.minimum_viable_action}` : null,
    task.description ? `\n${task.description}` : null,
    task.why.length > 0 ? `\nPor que agora: ${task.why.join('; ')}.` : null,
    task.source_capture_id ? `\nCaptura de origem: ${task.source_capture_id}` : null,
  ].filter(Boolean).join('\n')
}

function normalizePriority(priority: string): TaskEditDraft['priority'] {
  return priority === 'urgent' || priority === 'high' || priority === 'low' || priority === 'normal'
    ? priority
    : 'normal'
}

function normalizeEnergy(energy: string): TaskEditDraft['energyRequired'] {
  return energy === 'low' || energy === 'high' || energy === 'medium'
    ? energy
    : 'medium'
}

function dateOnlyFromIso(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function timeOnlyFromIso(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function todayDate(): string {
  return dateOnlyFromIso(new Date().toISOString())
}

function tomorrowDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return dateOnlyFromIso(date.toISOString())
}

function addDaysDate(baseDate: string, days: number): string {
  const [year, month, day] = baseDate.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  date.setDate(date.getDate() + days)
  return dateOnlyFromIso(date.toISOString())
}

function dateInputToIso(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return localDateTimeToIso(trimmed, '23:59')
}

function localDateTimeToIso(dateInput: string, timeInput: string): string {
  const [year, month, day] = dateInput.split('-').map(Number)
  const [hour, minute] = timeInput.split(':').map(Number)
  const date = new Date()
  date.setFullYear(year || date.getFullYear(), (month || 1) - 1, day || date.getDate())
  date.setHours(hour || 0, minute || 0, 0, 0)
  return date.toISOString()
}

function addMinutesIso(value: string, minutes: number): string {
  const date = new Date(value)
  date.setMinutes(date.getMinutes() + minutes)
  return date.toISOString()
}

function parseClampedInt(value: string, min: number, max: number, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function eventLabel(eventType: string): string {
  switch (eventType) {
    case 'created_from_capture': return 'criada'
    case 'updated_from_capture': return 'atualizada pela captura'
    case 'generated_from_routine': return 'gerada pela rotina'
    case 'refreshed_from_routine': return 'atualizada pela rotina'
    case 'updated': return 'editada'
    case 'scheduled': return 'agendada'
    case 'deferred': return 'adiada'
    case 'completed': return 'concluída'
    default: return eventType
  }
}

const styles = StyleSheet.create({
  greetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerMark: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { width: 28, height: 1, marginTop: 22, marginBottom: 22 },
  statusLine: { marginTop: 14 },
  portas: {
    marginTop: 24,
  },
  doorway: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  prompt: {
    paddingLeft: 14,
    borderLeftWidth: 2,
    marginBottom: 8,
  },
  mission: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 4,
  },
  agendaPanel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  agendaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  agendaList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 10,
  },
  agendaTaskShell: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
    gap: 8,
  },
  nextActionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  uppercase: {
    textTransform: 'uppercase',
  },
  nextActionTitle: {
    marginTop: 1,
  },
  agendaToggle: {
    alignSelf: 'flex-start',
    paddingTop: 2,
  },
  agendaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  agendaActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  miniAction: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  blockSummary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    gap: 2,
  },
  taskEditor: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  taskChip: {
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  inputCompact: {
    width: 92,
  },
  eventList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    gap: 3,
  },
  saveTask: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  blockEditor: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 10,
  },
  blockHeader: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockSave: {
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileRow: { flexDirection: 'row', gap: 12 },
  checkinPanel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  checkinDone: {
    paddingVertical: 14,
  },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choicePill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  levelRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  levelPill: {
    width: 36,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveCheckin: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
})
