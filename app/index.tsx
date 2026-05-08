import { Pressable, StyleSheet, TextInput, View, type PressableProps, type ViewStyle, type StyleProp } from 'react-native'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'expo-router'
import * as Location from 'expo-location'
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Screen } from '../components/Screen'
import { SectionHeader } from '../components/SectionHeader'
import { Frau, Label, Mono, Sans } from '../design/Type'
import {
  Masthead,
  EditorialDateline,
  SectionHead,
  TocRow,
  EditorialPullQuote,
  FolioFooter,
} from '../components/editorial'
import { usePalette } from '../design/theme'
import { useOverlays } from '../lib/overlays'
import { useShell } from '../components/AtlasShell'
import { buildMemoryHomeSummary } from '../lib/memoryHomeSummary'
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
  listAtlasMemoryReviewQueue,
  planTaskAgenda,
  planTaskWeekAgenda,
  patchTask,
  scheduleTask,
  type AtlasAgendaTask,
  type AtlasCheckin,
  type AtlasMemoryReviewQueue,
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

// Atlas DNA: peso, não cascata. Página chega inteira (settle no Screen.tsx).
// CodexPressable abaixo é o único motion da home: release mais lento que
// press · sensação de cera oxidada / latão envelhecido sob o dedo.

const exhaleEase = () => Easing.bezier(0.16, 1, 0.3, 1)
const pressInEase = () => Easing.bezier(0.32, 0, 0.67, 0)

// Components animados pra interpolar color em texto · createAnimatedComponent
// faz Sans/Mono/Frau receberem useAnimatedStyle no style prop sem hack.
const AnimatedSans = Animated.createAnimatedComponent(Sans)
const AnimatedMono = Animated.createAnimatedComponent(Mono)
const AnimatedFrau = Animated.createAnimatedComponent(Frau)

// Separador inline entre pills/levels editoriais · ponto centralizado.
// Usado entre Estado/Humor (4-5 opções) e Energia (1-5) pra dar ritmo
// tipográfico de TOC de revista premium em vez de pill row SaaS.
function DotSep() {
  const c = usePalette()
  return (
    <Frau italic size={14} lineHeight={20} color={c.ink3} style={dotSepStyle}>·</Frau>
  )
}
const dotSepStyle = { opacity: 0.5 } as const

/**
 * CodexPressable · Pressable com transição animada de press state.
 * Opacity 1→0.55 (220ms in · 360ms out) + scale 1→0.985.
 * Release mais lento que press = sensação de cera, não de botão.
 */
function CodexPressable({
  onPress,
  onLongPress,
  hitSlop,
  accessibilityRole,
  accessibilityLabel,
  style,
  children,
}: {
  onPress?: () => void
  onLongPress?: () => void
  hitSlop?: PressableProps['hitSlop']
  accessibilityRole?: PressableProps['accessibilityRole']
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const opacity = useSharedValue(1)
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        opacity.value = withTiming(0.55, { duration: 220, easing: pressInEase() })
        scale.value = withTiming(0.985, { duration: 220, easing: pressInEase() })
      }}
      onPressOut={() => {
        opacity.value = withTiming(1, { duration: 360, easing: exhaleEase() })
        scale.value = withTiming(1, { duration: 360, easing: exhaleEase() })
      }}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  )
}

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
  const [memoryReviewQueue, setMemoryReviewQueue] = useState<AtlasMemoryReviewQueue | null>(null)
  const [memoryReviewLoading, setMemoryReviewLoading] = useState(false)
  const [memoryReviewUnavailable, setMemoryReviewUnavailable] = useState(false)

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
  const memoryHome = useMemo(
    () => buildMemoryHomeSummary(
      memoryReviewQueue,
      memoryReviewLoading && !memoryReviewQueue
        ? 'loading'
        : memoryReviewUnavailable
          ? 'unavailable'
          : 'ready',
    ),
    [memoryReviewLoading, memoryReviewQueue, memoryReviewUnavailable],
  )

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

  useEffect(() => {
    let mounted = true

    setMemoryReviewLoading(true)
    void listAtlasMemoryReviewQueue({ limit: 6 })
      .then((response) => {
        if (!mounted) return
        setMemoryReviewQueue(response.review_queue)
        setMemoryReviewUnavailable(false)
      })
      .catch(() => {
        if (mounted) setMemoryReviewUnavailable(true)
      })
      .finally(() => {
        if (mounted) setMemoryReviewLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

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

  // Folio editorial · day-of-year como número do exemplar do dia.
  const folio = dailyFolio()

  return (
    <Screen>
        {/* Masthead editorial · ATLAS centralizado + folio mono caps · hairline.
            Long-press na masthead abre Configurações (Atlas não cumprimenta,
            settings é gesto descoberto pelo leitor). */}
        <Pressable
          onLongPress={openSettings}
          accessibilityLabel="Atlas masthead · long-press para configurações"
        >
          <Masthead folio={folio.full} />
        </Pressable>

        {/* Dateline · cidade · data por extenso · edição do dia. */}
        <EditorialDateline
          date={editorialDateLine()}
          location={locationLabel}
          edition={currentEdition()}
        />

        {/* Status corporal removido · F mockup não tem essa linha.
            "Ainda em silêncio corporal" era prosa apologética (viola F philosophy
            de empty state). Quando houver dados reais (HRV/sono), reaproveitar
            como marginalia em mono caps · não em italic Frau apologético. */}

        {/* i. AGENDA · diário de intenção. */}
        <SectionHead numeral="i" title="Agenda" deck={standfirstAgenda()} />

      {/* Estado · TDAH ergonomic move · how-you-are before what-you-do.
          Compact pill when state is fresh; full panel when stale or absent. */}
      {currentLevelState && !checkinEditing && !(checkinState || energyLevel || moodLevel) ? (
        <Animated.View
          entering={FadeIn.duration(420)}
          exiting={FadeOut.duration(220)}
        >
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
        </Animated.View>
      ) : (
        <Animated.View
          entering={FadeIn.duration(420)}
          exiting={FadeOut.duration(220)}
          style={styles.estadoInline}
          layout={LinearTransition.duration(360).easing(exhaleEase())}
        >
          <Label>Estado</Label>
          <View style={styles.choiceRow}>
            {CHECKIN_STATES.flatMap((state, idx) => [
              idx > 0 ? <DotSep key={`sep-${state.key}`} /> : null,
              <CheckinPill
                key={state.key}
                label={state.label}
                active={checkinState === state.key}
                onPress={() => setCheckinState(state.key)}
              />,
            ]).filter(Boolean)}
          </View>

          {checkinState ? (
            <Animated.View entering={FadeIn.duration(420)} exiting={FadeOut.duration(220)}>
              <Label style={{ marginTop: 16 }}>Energia</Label>
              <View style={styles.levelRow}>
                {[1, 2, 3, 4, 5].flatMap((level, idx) => [
                  idx > 0 ? <DotSep key={`sep-${level}`} /> : null,
                  <LevelPill
                    key={level}
                    level={level}
                    active={energyLevel === level}
                    onPress={() => setEnergyLevel(level)}
                  />,
                ]).filter(Boolean)}
              </View>
            </Animated.View>
          ) : null}

          {energyLevel ? (
            <Animated.View entering={FadeIn.duration(420)} exiting={FadeOut.duration(220)}>
              <Label style={{ marginTop: 16 }}>Humor</Label>
              <View style={styles.choiceRow}>
                {MOOD_LEVELS.flatMap((level, idx) => [
                  idx > 0 ? <DotSep key={`sep-${level.value}`} /> : null,
                  <CheckinPill
                    key={level.value}
                    label={level.label}
                    active={moodLevel === level.value}
                    onPress={() => setMoodLevel(level.value)}
                  />,
                ]).filter(Boolean)}
              </View>
            </Animated.View>
          ) : null}

          {canSaveCheckin ? (
            <Animated.View entering={FadeIn.duration(420)} exiting={FadeOut.duration(220)}>
              <CodexPressable
                onPress={() => { void saveCheckin() }}
                accessibilityLabel="Registrar check-in"
                style={styles.saveCheckin}
              >
                <View style={styles.saveCheckinSignature}>
                  <Frau italic size={16} lineHeight={24} color={c.ink} style={{ opacity: 0.82 }}>
                    — registrar
                  </Frau>
                </View>
              </CodexPressable>
            </Animated.View>
          ) : null}
        </Animated.View>
      )}

        {question ? (
          <EditorialPullQuote quote={question} attribution="pergunta de hoje" />
        ) : null}

      {/* MISSÃO · vocabulário editorial F.
          Estado preenchido: label "MISSÃO" + título italic 19 + detail mono.
          Estado vazio: imperativo seco "Definir missão →" — F philosophy
          (silêncio ou comando, NUNCA "— Nenhuma X" apologético). */}
      {mission ? (
        <Pressable onPress={() => router.push('/ritual')} hitSlop={6} style={styles.missionEditorial}>
          <Label>Missão</Label>
          <Frau italic size={17} lineHeight={24} color={c.ink} style={{ marginTop: 6 }}>
            {mission.title}
          </Frau>
          {mission.detail ? (
            <Mono size={11} lineHeight={15} letterSpacing={0.22} color={c.ink2} style={{ marginTop: 6 }}>
              {mission.detail}
            </Mono>
          ) : null}
        </Pressable>
      ) : (
        <Pressable
          onPress={() => router.push('/ritual')}
          hitSlop={6}
          style={({ pressed }) => [styles.missionEditorial, { opacity: pressed ? 0.55 : 1 }]}
        >
          <Label>Missão</Label>
          <Sans weight="med" size={15} lineHeight={22} color={c.ink} style={{ marginTop: 4 }}>
            Definir missão  →
          </Sans>
        </Pressable>
      )}

      {agenda && agenda.tasks.length > 0 ? (
        <View style={[styles.agendaPanel, styles.tierBlock, { backgroundColor: c.surface, borderColor: c.border }]}>
          <>
            {(agendaExpanded ? agenda.tasks.slice(0, 3) : agenda.tasks.slice(0, 1)).map((task, index) => (
              <View
                key={task.id}
                style={[
                  styles.agendaTaskShell,
                  { borderColor: c.border, marginTop: index === 0 ? 0 : 12 },
                ]}
              >
                {/* Meta row · F vocabulary: time prussian + priority BRONZE caps + min mono + intent mono. */}
                <Pressable onPress={() => { void openTaskEditor(task) }} style={styles.nextActionMeta}>
                  <Mono size={11} lineHeight={15} letterSpacing={0.32} color={c.prussian}>
                    {formatAgendaTime(task.recommended_start_at)}
                  </Mono>
                  <Sans
                    weight="sb"
                    size={10.5}
                    lineHeight={14}
                    letterSpacing={1.05}
                    color={c.bronze}
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

                {/* Título · F vocabulary: drop cap bronze (Frau display 36px) na primeira
                    letra + Sans sb 14 no resto. Layout flex-row align-baseline · letra
                    grande puxa o "eye" do leitor pro item destacado do dia. */}
                <View style={styles.taskTitleRow}>
                  <Frau weight="med" size={36} lineHeight={32} color={c.bronze} style={styles.taskDropCap}>
                    {task.title.charAt(0)}
                  </Frau>
                  <Sans
                    weight="sb"
                    size={14}
                    lineHeight={20}
                    color={c.ink}
                    numberOfLines={3}
                    style={styles.taskTitleBody}
                  >
                    {task.title.slice(1)}
                  </Sans>
                </View>

                {/* Actions · F vocabulary: mono caps com separadores · (não buttons). */}
                <View style={styles.taskActionsRow}>
                  <Pressable onPress={() => { void markTaskDone(task) }} hitSlop={6}>
                    <Mono size={10.5} letterSpacing={1.4} color={c.ink2} style={styles.uppercase}>Feita</Mono>
                  </Pressable>
                  <Mono size={10.5} color={c.ink3}>·</Mono>
                  <Pressable onPress={() => { void deferAgendaTask(task) }} hitSlop={6}>
                    <Mono size={10.5} letterSpacing={1.4} color={c.ink2} style={styles.uppercase}>Adiar</Mono>
                  </Pressable>
                  <Mono size={10.5} color={c.ink3}>·</Mono>
                  <Pressable onPress={() => { void openTaskEditor(task) }} hitSlop={6}>
                    <Mono size={10.5} letterSpacing={1.4} color={c.ink2} style={styles.uppercase}>Editar</Mono>
                  </Pressable>
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
      ) : agendaLoading ? (
        // Loading state · mono caps tenso, sem em-dash apologético.
        <View style={styles.tierBlock}>
          <Mono size={11} letterSpacing={1.4} color={c.ink3} style={{ textTransform: 'uppercase' }}>
            montando agenda · prioridade · energia · blocos
          </Mono>
        </View>
      ) : (
        // Empty state F philosophy · imperativo seco, não "— Nenhuma".
        <Pressable
          onPress={() => router.push('/capture')}
          hitSlop={6}
          style={({ pressed }) => [styles.tierBlock, { opacity: pressed ? 0.55 : 1 }]}
        >
          <Sans weight="med" size={15} lineHeight={22} color={c.ink}>
            Capturar primeira tarefa  →
          </Sans>
        </Pressable>
      )}

        <SectionHead numeral="ii" title="Operação Atlas" deck="dossiês abertos · arquivo vivo" />

      {/* Codex austero · 10/10 sussurro · sem box, sem subtitle, sem CTA.
          Título Frau italic com ponto terminal (pontuação de tratado) +
          classification em caps tiny right-aligned + hairline entre.
          Vocabulário Penguin Classics / Hermès Le Carré / Cucinelli Solomeo. */}
        {/* TOC editorial · cada dossiê é uma linha label · dot leader · descrição.
            Vocabulário de TOC de livro encadernado / Monocle daily briefing. */}
        <TocRow
          label="Memory"
          value={memoryHome.title.replace(/[.!?]+$/, '').toLowerCase()}
          onPress={() => router.push('/memory')}
          accessibilityLabel={`Abrir memória do Atlas. ${memoryHome.title}.`}
          variant="codex"
        />
        <TocRow
          label="Open Brain"
          value="recall e context pack"
          onPress={() => router.push('/open-brain')}
          accessibilityLabel="Abrir Atlas Open Brain · recall e context pack."
          variant="codex"
        />
        <TocRow
          label="Engineering"
          value="harness runner e atlas-bench"
          onPress={() => router.push('/engineering')}
          accessibilityLabel="Abrir Atlas Engineering · harness runner e bench."
          variant="codex"
        />
        <TocRow
          label="Rivals"
          value="relatório fair claude"
          onPress={() => router.push('/rivals')}
          accessibilityLabel="Abrir Atlas Rivals · relatório Fair Claude."
          variant="codex"
        />

        <SectionHead numeral="iii" title="Tecido" deck="constelações · fios soltos" />

        <ConstelacaoWhisper onPress={() => router.push('/celestial')} />

        <SectionHead numeral="iv" title="Portas" />

      {/* Portas · destinos não duplicados pelo dock ou pelos 4 dossiês.
          Vocabulário TOC editorial: cada porta é label · dot leader · estado.
          Variante 'doorway' = label italic (vs codex weight medium). */}
      <TocRow
        label="bitácula"
        value={`${activeBehaviorCount} ${activeBehaviorCount === 1 ? 'ativo' : 'ativos'}`}
        onPress={() => router.push('/bitacula')}
        variant="doorway"
      />
      <TocRow
        label="saúde"
        value={healthValue(sleep, hrv)}
        onPress={() => router.push('/health')}
        variant="doorway"
      />
      <TocRow
        label="plano"
        value="abrir"
        onPress={() => router.push('/projects')}
        variant="doorway"
      />
      <TocRow
        label="rotinas"
        value="montar dia"
        onPress={() => router.push('/routines')}
        variant="doorway"
      />

      {/* Folio rodapé · "— FOLIO N —" mono caps centralizado · fecha a página
          como rodapé de livro encadernado. Sem isso a home fica "aberta",
          sem encerramento ritual. */}
      <FolioFooter number={folio.number} />
    </Screen>
  )
}

// (Removido) Doorway · substituído por TocRow (components/editorial/) na
// variante F · vocabulário TOC de livro encadernado: label · dot leader · value.

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
  // Variante F editorial · inline italic Frau, sem prussian background pill.
  // Active = bronze + weight medium; inactive = ink3 + weight regular.
  // Smooth 380ms exhale entre estados via interpolateColor no texto · sem
  // mudança de layout (sem scale, sem border). Press feedback minimal:
  // opacity 1→0.55 sem scale (evita shift em layout inline).
  const activeProgress = useSharedValue(active ? 1 : 0)
  const pressProgress = useSharedValue(0)

  useEffect(() => {
    activeProgress.value = withTiming(active ? 1 : 0, {
      duration: 380,
      easing: exhaleEase(),
    })
  }, [active, activeProgress])

  const animatedTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      activeProgress.value,
      [0, 1],
      [c.ink3, c.bronze],
    ),
    opacity: 1 - pressProgress.value * 0.45,
  }))

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      onPressIn={() => {
        pressProgress.value = withTiming(1, { duration: 220, easing: pressInEase() })
      }}
      onPressOut={() => {
        pressProgress.value = withTiming(0, { duration: 360, easing: exhaleEase() })
      }}
    >
      <Animated.View>
        <AnimatedFrau italic weight={active ? 'med' : 'reg'} size={14} lineHeight={20} style={animatedTextStyle}>
          {label}
        </AnimatedFrau>
      </Animated.View>
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
  // Variante F editorial · numeral inline em mono, sem prussian background.
  // Active = bronze + weight medium; inactive = ink3 + weight regular.
  const activeProgress = useSharedValue(active ? 1 : 0)
  const pressProgress = useSharedValue(0)

  useEffect(() => {
    activeProgress.value = withTiming(active ? 1 : 0, {
      duration: 380,
      easing: exhaleEase(),
    })
  }, [active, activeProgress])

  const animatedTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      activeProgress.value,
      [0, 1],
      [c.ink3, c.bronze],
    ),
    opacity: 1 - pressProgress.value * 0.45,
  }))

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      onPressIn={() => {
        pressProgress.value = withTiming(1, { duration: 220, easing: pressInEase() })
      }}
      onPressOut={() => {
        pressProgress.value = withTiming(0, { duration: 360, easing: exhaleEase() })
      }}
    >
      <Animated.View>
        <AnimatedMono weight={active ? 'med' : 'reg'} size={14} lineHeight={20} style={animatedTextStyle}>
          {level}
        </AnimatedMono>
      </Animated.View>
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
  // Cinema unificado · mesma vocabulary CheckinPill/LevelPill.
  const activeProgress = useSharedValue(active ? 1 : 0)
  const pressProgress = useSharedValue(0)

  useEffect(() => {
    activeProgress.value = withTiming(active ? 1 : 0, {
      duration: 380,
      easing: exhaleEase(),
    })
  }, [active, activeProgress])

  const animatedChipStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      ['rgba(0,0,0,0)', c.prussian],
    ),
    borderColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      [c.border, c.prussian],
    ),
    opacity: 1 - pressProgress.value * 0.45,
    transform: [{ scale: 1 - pressProgress.value * 0.025 }],
  }))

  const animatedTextStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      activeProgress.value,
      [0, 1],
      [c.ink2, c.bg],
    ),
  }))

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressProgress.value = withTiming(1, { duration: 220, easing: pressInEase() })
      }}
      onPressOut={() => {
        pressProgress.value = withTiming(0, { duration: 360, easing: exhaleEase() })
      }}
    >
      <Animated.View style={[styles.taskChip, animatedChipStyle]}>
        <AnimatedSans weight="med" size={11.5} style={animatedTextStyle}>
          {label}
        </AnimatedSans>
      </Animated.View>
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

// (Removido) TierMark · substituído por SectionHead (components/editorial/) na
// variante F · numeral romano + caps title + standfirst + hairline. Vocabulário
// de chapter opener de livro encadernado em vez de italic + ✦ wishlist marker.

// Constelação whisper · polymath signature on the home, sussurrada (not card).
// Triple-tap on Inbox dock still works as Easter egg; this is the editorial
// surface that says "Bilderatlas exists, the céu is the tank, look up".
function ConstelacaoWhisper({ onPress }: { onPress: () => void }) {
  const c = usePalette()
  // F mockup tecido vocabulary · italic Frau corpo + Mono caps inline pra
  // estatística/destino · texto editorial corrido (não label+value lateral).
  return (
    <CodexPressable
      onPress={onPress}
      hitSlop={6}
      accessibilityLabel="Abrir constelação · o céu de Atlas"
      style={styles.whisper}
    >
      <Frau italic size={14} lineHeight={21} color={c.ink2}>
        veias do tecido ·{' '}
        <Mono size={11} lineHeight={21} letterSpacing={1.0} color={c.ink}>O CÉU DE ATLAS</Mono>
        {' '}· constelação aberta.
      </Frau>
    </CodexPressable>
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

// Dateline editorial · "Quinta · 7 de Maio de 2026" (full names, no leading
// zero, italic-ready). Vocabulário de cabeçalho de jornal impresso (Le Monde
// "Vendredi 8 mars", NYT "Friday, March 8, 2024"). Uso na variante F home.
function editorialDateLine(): string {
  const date = new Date()
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  // weekday 'long' em pt-BR retorna "quinta-feira" · cortamos "-feira" pra
  // match F mockup que usa só "Quinta" (forma curta sem sufixo).
  const weekdayLong = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date)
  const weekday = cap(weekdayLong.split('-')[0]!)
  const day = date.getDate()
  const month = cap(new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date))
  const year = date.getFullYear()
  return `${weekday} · ${day} de ${month} de ${year}`
}

// Standfirst longo do deck da seção · "diário de intenção · sete de maio".
// Día por extenso em pt-BR pra evocar manuscrito (não data técnica numérica).
function standfirstAgenda(): string {
  const date = new Date()
  const dayWord = ['zero','primeiro','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove','vinte','vinte e um','vinte e dois','vinte e três','vinte e quatro','vinte e cinco','vinte e seis','vinte e sete','vinte e oito','vinte e nove','trinta','trinta e um'][date.getDate()] ?? `dia ${date.getDate()}`
  const month = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date)
  return `diário de intenção · ${dayWord} de ${month}`
}

// Folio · numeração diária do "exemplar" do Atlas · day-of-year é o no.
// vol. (volume) hardcoded em "iii" — pode evoluir pra ano-base no futuro.
function dailyFolio(): { full: string; number: number } {
  const date = new Date()
  const start = new Date(date.getFullYear(), 0, 0)
  const oneDay = 1000 * 60 * 60 * 24
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / oneDay)
  return { full: `vol. iii · no. ${dayOfYear}`, number: dayOfYear }
}

// Edition · matinal antes de 12, vespertina depois.
function currentEdition(): string {
  return new Date().getHours() < 12 ? 'edição matinal' : 'edição vespertina'
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

// Status line · prosa poética quando dados estão ausentes, lista quando há
// leituras reais. Filtra explicitamente 'sem dado' e 'baseline' (defaults sem
// substância) — só fala quando tem o que dizer. Codex regra: silêncio elegante
// > dashboard com placeholders.
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
  const sleepLabel = formatPassiveSignal(sleep)
  const hrvLabel = formatPassiveSignal(hrv)

  const hasSleep = !!sleepLabel && sleepLabel !== '—' && !sleepLabel.toLowerCase().includes('sem dado')
  const hasHrv = !!hrvLabel && hrvLabel !== '—' && !hrvLabel.toLowerCase().includes('sem dado')
  const hasEnergy = energy != null
  const hasReadiness = !!readiness && readiness.toLowerCase() !== 'baseline'

  const segments: string[] = []
  if (hasSleep) segments.push(`sono ${sleepLabel.toLowerCase()}`)
  if (hasEnergy) segments.push(`energia ${energy}/5`)
  if (hasReadiness) segments.push(`prontidão ${readiness.toLowerCase()}`)
  if (hasHrv && segments.length < 3) segments.push(`hrv ${hrvLabel.toLowerCase()}`)

  if (segments.length === 0) return 'ainda em silêncio corporal'
  return segments.join(' · ')
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
    marginTop: 12,
  },
  doorway: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Codex tier mark · illuminated initial baseline-aligned with italic label
  // + bronze hairline + ✦ at end. Manuscript chapter opener feel.
  // Spacing calibrado: marginTop 30 (abertura do tier) + marginBottom 12.
  tierMark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginTop: 30,
    marginBottom: 12,
  },
  tierRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  // Mission editorial · padding apenas, sem card surface · F vocabulary.
  // marginBottom 26 dá ritmo descendente entre missão e bloco de tarefa.
  // marginLeft:32 + marginRight:32 = trilhos internos simétricos (x=64..329).
  missionEditorial: { marginTop: 18, marginBottom: 26, marginLeft: 32, marginRight: 32 },
  // Universal gap between content blocks within a tier · 24px.
  // Aplicado em: mission, agendaPanel, marginNote (próxima ação empty),
  // qualquer bloco que vem depois de outro dentro de um tier.
  // marginLeft:32 + marginRight:32 = trilhos internos simétricos (x=64..329).
  tierBlock: {
    marginTop: 24,
    marginLeft: 32,
    marginRight: 32,
  },
  // Codex card · replaces SaaS-pattern left-stripe with inline ✦ glyph.
  // Border radius 4 (manuscript pages have minimal rounding).
  // No borderLeftWidth — that was Material/Tailwind tells.
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  // Margin note · used for empty states. No card, no border, just italic
  // text. Aligned com pergunta-norte na borda esquerda — sem inset que cria
  // L-shape com pergunta. Marginalia vem do tom italic faded, não da margem.
  marginNote: {
    paddingVertical: 8,
  },
  // 10/10 austere codex entry · index of treatise.
  // Penguin Great Ideas / Hermès Le Carré / Cucinelli Solomeo vocabulary:
  // title italic + classification tiny caps right-aligned + hairline between.
  // No box, no border, no CTA, no subtitle.
  codexEntry: {
    paddingVertical: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  codexClassification: {
    alignSelf: 'flex-start',
    marginBottom: 6,
    fontSize: 10,
    letterSpacing: 2.6,
    opacity: 0.42,
  },
  codexListTopRule: {
    height: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  // Constelação whisper · slightly more weight than a doorway (italic 17 vs 15)
  // to signal "this is the polymath antessala", not just another module.
  // marginLeft:32 + marginRight:32 = trilhos internos simétricos (x=64..329).
  whisper: {
    paddingVertical: 14,
    paddingLeft: 0,
    marginLeft: 32,
    marginRight: 32,
  },
  prompt: {
    paddingLeft: 14,
    borderLeftWidth: 2,
    marginBottom: 8,
  },
  // Pergunta-norte placement inside tier i (after estado).
  // Sem stripe lateral · italic flow puro · 24px gap padronizado.
  promptInTier: {
    marginTop: 24,
  },
  // Mission card · codex page · radius 4, hairline border, no SaaS stripe.
  mission: {
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  // Codex card · was engineeringEntry with SaaS left-stripe; now manuscript
  // page with hairline border, minimal radius, glyph ✦ inline marks identity.
  engineeringEntry: {
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginTop: 14,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  // Agenda panel · same codex card vocabulary as engineeringEntry/mission.
  // Radius 4 (manuscript page), hairline border, generous breath.
  agendaPanel: {
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
    paddingHorizontal: 20,
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
  // F mockup task block · sem border (editorial puro), spacing maior entre meta+title+actions.
  agendaTaskShell: {
    paddingBottom: 14,
    gap: 8,
  },
  // Drop cap row · primeira letra grande bronze + resto do título inline.
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  taskDropCap: {
    // Drop cap baseline-aligned · pequeno offset top pra puxar a letra
    // pra dentro do bloco visual (compensa ascender do glyph).
    marginTop: 4,
  },
  taskTitleBody: {
    flex: 1,
    paddingTop: 4,
  },
  // Actions inline · mono caps com · separadores, não buttons.
  taskActionsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
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
  // Estado inline · no card box, no surface, no border.
  // Codex whisper · label + chips no mesmo nível do papel.
  // marginLeft:32 = trilho interno editorial esquerdo (x=64).
  // marginRight:32 = trilho interno editorial direito (x=329) — SIMETRIA com o
  //   esquerdo. Sem isso, palavras à direita encostam 32px do canto, enquanto
  //   à esquerda ficam 64px do canto — assimetria visível, quebra de rigor.
  estadoInline: {
    paddingVertical: 8,
    marginLeft: 32,
    marginRight: 32,
  },
  checkinDone: {
    paddingVertical: 14,
    marginLeft: 32,
    marginRight: 32,
  },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 6, marginTop: 6 },
  choicePill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  levelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  levelPill: {
    width: 36,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Registrar · stamp signature de tratado.
  // Italic Frau "— registrar" + UMA hairline bronze 32% largura-da-palavra
  // embaixo (como assinatura em documento). Em-dash rima com margin notes.
  // Não é botão · não é frame · é o gesto de autenticar uma linha.
  saveCheckin: {
    marginTop: 32,
    alignItems: 'center',
  },
  // Hairline em prussian (não bronze) · sela a cadeia de comprometimentos
  // ativos (Estado → Energia → Humor são todos prussian chips). Bronze é
  // canon estrutural (drop caps, codex rules) · prussian é commitment ·
  // a linha que sela 3 commits ativos tem que rimar com eles.
  saveCheckinSignature: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(27,58,87,0.32)',
    paddingBottom: 4,
    paddingHorizontal: 2,
  },
})
