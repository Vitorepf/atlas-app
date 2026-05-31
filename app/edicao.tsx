import { Pressable, StyleSheet, View, InteractionManager, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'expo-router'
import * as Location from 'expo-location'
import * as Haptics from 'expo-haptics'
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolateColor,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Screen } from '../components/Screen'
import { Frau, Label, Mono, Sans } from '../design/Type'
import {
  Masthead,
  EditorialDateline,
  SectionHead,
  TocRow,
  EditorialPullQuote,
  FolioFooter,
} from '../components/editorial'
import {
  TaskEditorSheet,
  BlockEditorInline,
  MiniActionPill,
  type TaskEditorDraft,
  type BlockDraft,
} from '../components/edition'
import { PressableTextScale, PressableSurfaceScale } from '../components/atlas-ui/PressableScale'
import { usePalette } from '../design/theme'
import { useOverlays } from '../lib/overlays'
import { useShell } from '../components/AtlasShell'
import { buildMemoryHomeSummary } from '../lib/memoryHomeSummary'
import { dailyPassage } from '../lib/dailyPassage'
import {
  currentEdition,
  dailyFolio,
  editorialDateLine,
  standfirstAgenda,
} from '../lib/folio'
import {
  deviceTimezone,
  formatPassiveSignal,
  latestCheckin,
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
  type AtlasPassiveSignal,
  type AtlasTaskAgendaResponse,
  type AtlasTaskEvent,
} from '../lib/api/client'
import { buildReadinessV1 } from '../lib/readiness'
import { isCheckinLevelFresh } from '../lib/checkinFreshness'
import { MOOD_LEVELS } from '../lib/checkinScale'
import { canUseAppleCalendar, createAppleCalendarEvent } from '../lib/appleCalendar'
import {
  readCachedAgenda,
  readCachedMemoryReviewQueue,
  writeCachedAgenda,
  writeCachedMemoryReviewQueue,
} from '../lib/editionHomeCache'
import { nowMs, recordPerformanceDuration } from '../lib/performanceTelemetry'

const CHECKIN_STATES: Array<{ key: AtlasCheckin['state']; label: string }> = [
  { key: 'focused', label: 'Foco' },
  { key: 'disperse', label: 'Disperso' },
  { key: 'blocked', label: 'Bloqueado' },
  { key: 'pause', label: 'Pausa' },
]

// Draft types vivem em components/edition · TaskEditorDraft + BlockDraft.
// As listas de choice (priority/energy) ficam internas do TaskEditorSheet.

// Atlas DNA: peso, não cascata. Página chega inteira (settle no Screen.tsx).
// Motion canônico da home agora vive em components/atlas-ui/PressableScale
// (PressableSurfaceScale = press 0.985 + opacity 0.55 release exhale).
// CheckinPill/LevelPill mantêm cinema custom (interpolateColor do texto)
// mas ganharam o canon de press scale spring + haptic Soft em round 2.

const exhaleEase = () => Easing.bezier(0.16, 1, 0.3, 1)
const pressInEase = () => Easing.bezier(0.32, 0, 0.67, 0)

// Components animados pra interpolar color em texto · createAnimatedComponent
// faz Mono/Frau receberem useAnimatedStyle no style prop sem hack.
// (AnimatedSans removido com TaskChip; ChoicePill agora vive em components/edition/Pills.tsx)
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

function latestPassiveSignalFromList(
  signals: AtlasPassiveSignal[],
  signalType: string,
): AtlasPassiveSignal | null {
  let latest: AtlasPassiveSignal | null = null
  let latestTime = 0

  for (const signal of signals) {
    if (signal.signal_type !== signalType) continue
    const time = passiveSignalTime(signal)
    if (!latest || time > latestTime) {
      latest = signal
      latestTime = time
    }
  }

  return latest
}

function passiveSignalTime(signal: AtlasPassiveSignal): number {
  const value = signal.ended_at ?? signal.started_at ?? signal.created_at
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

// CodexPressable removido (round 2) · DNA migrou pra PressableSurfaceScale
// em components/atlas-ui (mesmo timing 220ms in / 360ms out, scale 0.985,
// opacity 1→0.55, exhale bezier). Toda surface pressionável da home agora
// herda canon único. Restraint: 50 linhas a menos, zero perda visual.

/**
 * EditorialEmptyLine · empty state imperativo com drop cap bronze inline.
 *
 * Vocabulário canon: primeira letra em Frau med upright bronze (inkCarving
 * textShadow) + resto em Frau italic ink. Imperativos seco do hub edição:
 *   "D"efinir missão.
 *   "C"apturar primeira tarefa.
 *
 * Implementação · uses nested <Frau> (which renders as nested <Text>) com
 * lineHeight unificado no outer. Em RN, nested Text alinha baseline
 * automaticamente. Outer Frau italic 17 ditando lineHeight; inner Frau
 * med 24 upright apenas muda fontSize + family + color · linha única
 * visualmente, sem flex row hack que quebrou no device real.
 */
function EditorialEmptyLine({ text }: { text: string }) {
  const c = usePalette()
  const first = text.charAt(0)
  const rest = text.slice(1)
  return (
    <Frau italic size={17} lineHeight={26} color={c.ink}>
      <Frau
        weight="med"
        size={24}
        color={c.bronze}
        style={{
          textShadowColor: c.inkCarving,
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 0,
        }}
      >
        {first}
      </Frau>
      {rest}
    </Frau>
  )
}

export default function HomeScreen() {
  const visibleStartedAt = useMemo(() => nowMs(), [])
  const visibleMetricRecordedRef = useRef(false)
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
  const [agenda, setAgenda] = useState<AtlasTaskAgendaResponse | null>(() => readCachedAgenda())
  const [agendaLoading, setAgendaLoading] = useState(false)
  const [selectedTask, setSelectedTask] = useState<AtlasAgendaTask | null>(null)
  const [taskDraft, setTaskDraft] = useState<TaskEditorDraft>(() => emptyTaskDraft())
  const [taskEvents, setTaskEvents] = useState<AtlasTaskEvent[]>([])
  const [blockEditorOpen, setBlockEditorOpen] = useState(false)
  const [blockDraft, setBlockDraft] = useState<BlockDraft>({ title: 'Compromisso', startTime: '13:00', endTime: '14:00' })
  const [calendarBusyTaskId, setCalendarBusyTaskId] = useState<string | null>(null)
  const [agendaPlanning, setAgendaPlanning] = useState(false)
  const [weekPlanning, setWeekPlanning] = useState(false)
  const [agendaExpanded, setAgendaExpanded] = useState(false)
  const [memoryReviewQueue, setMemoryReviewQueue] = useState<AtlasMemoryReviewQueue | null>(() => readCachedMemoryReviewQueue())
  const hadCachedAgenda = useMemo(() => agenda != null, [])
  const hadCachedMemory = useMemo(() => memoryReviewQueue != null, [])
  const [memoryReviewLoading, setMemoryReviewLoading] = useState(false)
  const [memoryReviewUnavailable, setMemoryReviewUnavailable] = useState(false)
  const [editionWarmupReady, setEditionWarmupReady] = useState(false)

  const captureCountToday = useMemo(() => {
    const today = todayDate()
    let count = 0
    for (const capture of visibleCaptures({ captures, queuedCaptures })) {
      if (dateOnlyFromIso(capture.captured_at) === today) count += 1
    }
    return count
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
    () => latestPassiveSignalFromList(allSignals, 'sleep_duration_hours'),
    [allSignals],
  )
  const hrv = useMemo(
    () => latestPassiveSignalFromList(allSignals, 'hrv_ms'),
    [allSignals],
  )
  // Pergunta-norte do dia · prioridade dupla:
  //   1. mission.metadata.question — pergunta explícita da missão (Curator/user
  //      define quando há voz mais próxima a dizer algo).
  //   2. Fallback: passagem do dia · canon de 100 entradas curadas (sabedoria
  //      que venceu o tempo, rotação determinística por dias-desde-fundação).
  // Detalhes do canon e critério Lindy: docs/passagem-do-dia-canon.md.
  const explicitQuestion = missionQuestion(mission?.metadata)
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
      writeCachedAgenda(response)
    } catch {
      setAgenda((current) => current ?? readCachedAgenda())
    } finally {
      setAgendaLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    let timeout: ReturnType<typeof setTimeout> | null = null
    const task = InteractionManager.runAfterInteractions(() => {
      timeout = setTimeout(() => {
        if (!cancelled) {
          setEditionWarmupReady(true)
          if (!visibleMetricRecordedRef.current) {
            visibleMetricRecordedRef.current = true
            recordPerformanceDuration('edition_visible_ms', visibleStartedAt, {
              cached_agenda: hadCachedAgenda,
              cached_memory: hadCachedMemory,
            })
          }
        }
      }, 500)
    })

    return () => {
      cancelled = true
      if (timeout) clearTimeout(timeout)
      task.cancel()
    }
  }, [hadCachedAgenda, hadCachedMemory, visibleStartedAt])

  useEffect(() => {
    if (!editionWarmupReady) return
    let mounted = true

    void resolveCurrentCity().then((city) => {
      if (mounted && city) setLocationLabel(city)
    })

    return () => {
      mounted = false
    }
  }, [editionWarmupReady])

  useEffect(() => {
    if (!editionWarmupReady) return
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
        writeCachedAgenda(response)
        if (mounted) setAgenda(response)
      })
      .catch(() => {
        if (mounted) setAgenda((current) => current ?? readCachedAgenda())
      })
      .finally(() => {
        if (mounted) setAgendaLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [currentLevelState?.energy_level, editionWarmupReady])

  useEffect(() => {
    if (!editionWarmupReady) return
    let mounted = true

    setMemoryReviewLoading(true)
    void listAtlasMemoryReviewQueue({ limit: 6 })
      .then((response) => {
        writeCachedMemoryReviewQueue(response.review_queue)
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
  }, [editionWarmupReady])

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

  const addTaskToAppleCalendar = async (task: AtlasAgendaTask, draft?: TaskEditorDraft) => {
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

  // Folio editorial · numeração ritual do exemplar do dia (vol. + no.)
  const folio = dailyFolio()

  // Pullquote da home · resolve a fonte. explicitQuestion (da missão) tem
  // prioridade; fallback é a passagem do dia do canon (sabedoria que venceu
  // o tempo, ver docs/passagem-do-dia-canon.md).
  const passage = explicitQuestion === null ? dailyPassage(folio.number) : null
  const pullquoteText = explicitQuestion ?? passage?.text ?? null
  const pullquoteAttribution = explicitQuestion
    ? 'pergunta de hoje'
    : (passage?.attribution ?? '')

  return (
    <Screen bare>
        {/* Masthead editorial · ATLAS centralizado + folio mono caps · hairline.
            Tap no masthead abre Configurações — o título é o portal pro
            backstage do Atlas (vocabulário de "click no logo" universal). */}
        <Pressable
          onPress={openSettings}
          accessibilityLabel="Abrir configurações do Atlas"
          accessibilityRole="button"
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

        {/* Passagem do dia · epígrafe ritual. Abre o exemplar (vem antes da
            primeira seção, não interrompe a agenda). É a fala do sábio que o
            leitor vai recitar e contemplar durante o dia. Quando há
            mission.metadata.question, vira a pergunta-norte da missão; senão,
            fallback pro canon de 100 entradas. Ver docs/passagem-do-dia-canon.md. */}
        {pullquoteText ? (
          <EditorialPullQuote quote={pullquoteText} attribution={pullquoteAttribution} />
        ) : null}

        {/* i. AGENDA · diário de intenção · tap abre tela de calendário.
            Round 3 polish · stagger fade-in 60ms × idx · cada section head
            entra como tipografia editorial assentando (não cascata SaaS).
            Sincroniza com Screen.tsx atlasSettle 280ms. */}
        <Animated.View entering={FadeInDown.duration(460).delay(60).easing(exhaleEase()).springify().damping(22).stiffness(180)}>
          <SectionHead
            numeral="i"
            title="Agenda"
            deck={standfirstAgenda()}
            onPress={() => router.push('/agenda')}
          />
        </Animated.View>

      {/* Estado · TDAH ergonomic move · how-you-are before what-you-do.
          Compact pill when state is fresh; full panel when stale or absent. */}
      {currentLevelState && !checkinEditing && !(checkinState || energyLevel || moodLevel) ? (
        <Animated.View
          entering={FadeIn.duration(420)}
          exiting={FadeOut.duration(220)}
        >
          <PressableTextScale
            onPress={() => {
              setCheckinState(null)
              setEnergyLevel(null)
              setMoodLevel(null)
              setCheckinEditing(true)
            }}
            hitSlop={8}
            haptic="soft"
            accessibilityLabel="refazer check-in"
            style={styles.checkinDone}
          >
            {/* Sem ✓ Unicode · vocabulário SaaS (form validated, parabéns).
                Tipografia editorial italic já carrega o sentido de "está
                feito" pela presença + ação "refazer" depois do separador.
                Round 4 polish · hairline-bottom prussianSeal ecoa o gesto
                "registrar." que foi feito · simetria visual entre o ato e
                seu compact-state. */}
            <View style={[styles.checkinDoneSeal, { borderBottomColor: c.prussianSeal }]}>
              <Frau italic size={14} lineHeight={20} color={c.ink} style={{ opacity: 0.55 }}>
                check-in registrado · refazer
              </Frau>
            </View>
          </PressableTextScale>
        </Animated.View>
      ) : (
        <Animated.View
          entering={FadeIn.duration(420)}
          exiting={FadeOut.duration(220)}
          style={styles.estadoInline}
          layout={LinearTransition.duration(360).easing(exhaleEase())}
        >
          {/* Round 3 polish · label ESTADO vira bronze quando nenhum estado
              foi escolhido AINDA · signal sutil de "esse slot aguarda gesto",
              sem virar badge SaaS. Volta ao ink2 default assim que user
              escolhe qualquer estado. */}
          <Label color={checkinState === null && energyLevel === null && moodLevel === null ? c.bronze : undefined}>
            Estado
          </Label>
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
              <PressableSurfaceScale
                onPress={() => { void saveCheckin() }}
                accessibilityLabel="registrar check-in"
                haptic="light"
                style={styles.saveCheckin}
              >
                <View style={styles.saveCheckinSignature}>
                  {/* registrar. · italic Frau bronzeDeep + período (vocabulário
                      "ato encerrado" · canon empty state da home: "Definir
                      missão.", "Capturar primeira tarefa."). Sem em-dash inicial
                      (em-dash em Atlas é atribuição de citação · "— Sêneca",
                      "— sincronizado há 49 min" · não prefixo decorativo de ação).
                      Cor bronzeDeep substitui ink @ 0.82 — coerente com pills
                      active (Foco/2/Ruim todos bronze), o ato de selar o
                      check-in herda o mesmo signature. Hairline-bottom continua
                      prussian — canon commitment-seal preserved. */}
                  <Frau italic size={17} lineHeight={24} color={c.bronzeDeep}>
                    registrar.
                  </Frau>
                </View>
              </PressableSurfaceScale>
            </Animated.View>
          ) : null}
        </Animated.View>
      )}

      {/* MISSÃO · vocabulário editorial F.
          Estado preenchido: label "MISSÃO" + título italic 19 + detail mono.
          Estado vazio: imperativo seco "Definir missão →" — F philosophy
          (silêncio ou comando, NUNCA "— Nenhuma X" apologético). */}
      {/* Missão preenchida ou vazia · ambos usam EditorialEmptyLine pra
          consistência absoluta. Quando preenchida, mission.detail vira
          subtitle mono caps tiny abaixo (canon "subtitle metadata"). */}
      <PressableSurfaceScale
        onPress={() => router.push('/ritual')}
        hitSlop={6}
        haptic="soft"
        accessibilityLabel={mission ? `abrir missão · ${mission.title}` : 'definir missão do dia'}
        style={styles.missionEditorial}
      >
        {/* Round 6 polish · MISSÃO label vira bronze quando vazia (canon ESTADO).
            Sinal sutil "esse slot aguarda gesto ritual". Quando preenchida,
            volta a ink2 default · estado neutro. */}
        <Label color={mission ? undefined : c.bronze}>Missão</Label>
        <View style={{ marginTop: 6 }}>
          <EditorialEmptyLine text={mission ? mission.title : 'Definir missão.'} />
        </View>
        {mission?.detail ? (
          <Mono size={10.5} lineHeight={14} letterSpacing={1.4} color={c.ink3} style={{ marginTop: 8, textTransform: 'uppercase' }}>
            {mission.detail}
          </Mono>
        ) : null}
      </PressableSurfaceScale>

      {agenda && agenda.tasks.length > 0 ? (
        <View style={[styles.agendaPanel, styles.tierBlock, { backgroundColor: c.surface, borderColor: c.border, overflow: 'hidden' }]}>
          {/* Inner top highlight · canon embossed manuscript Don Corleone.
              Sutil 1px cream alpha 0.04 acima do papel slate dá peso de
              carving sob o dedo · sensação de página dobrada e selada. */}
          <View style={styles.agendaPanelHighlight} pointerEvents="none" />
          {/* Inner bottom shade · fecha o emboss canon do composer.
              1px black alpha 0.10 (mais discreto que composer 0.18 porque
              o agendaPanel não é card hero · é página de papel). */}
          <View style={styles.agendaPanelShade} pointerEvents="none" />
          <>
            {(agendaExpanded ? agenda.tasks.slice(0, 3) : agenda.tasks.slice(0, 1)).map((task, index) => (
              <View
                key={task.id}
                style={[
                  styles.agendaTaskShell,
                  // Round 2 polish · divisor visível entre task blocks:
                  // border-top hairline cream alpha 0.10 + padding-top 14
                  // pra ritmo respiratório entre as tarefas. Sem isso o
                  // segundo task fica colando no primeiro · com isso a
                  // página respira como manuscrito copiado, não como list.
                  index > 0 && {
                    marginTop: 14,
                    paddingTop: 14,
                    borderTopColor: c.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  },
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

                {/* Actions · F vocabulary: mono caps com separadores · (não buttons).
                    Cada ação tem press canon (scale 0.97 + spring + haptic Soft)
                    via PressableTextScale · "Feita" usa haptic Light (commit).
                    "Adiar" usa Soft (escolha). "Editar" Soft. */}
                <View style={styles.taskActionsRow}>
                  <PressableTextScale
                    onPress={() => { void markTaskDone(task) }}
                    hitSlop={6}
                    haptic="light"
                    accessibilityLabel="marcar tarefa como feita"
                  >
                    <Mono size={10.5} letterSpacing={1.4} color={c.ink2} style={styles.uppercase}>Feita</Mono>
                  </PressableTextScale>
                  <Mono size={10.5} color={c.ink3}>·</Mono>
                  <PressableTextScale
                    onPress={() => { void deferAgendaTask(task) }}
                    hitSlop={6}
                    haptic="soft"
                    accessibilityLabel="adiar tarefa"
                  >
                    <Mono size={10.5} letterSpacing={1.4} color={c.ink2} style={styles.uppercase}>Adiar</Mono>
                  </PressableTextScale>
                  <Mono size={10.5} color={c.ink3}>·</Mono>
                  <PressableTextScale
                    onPress={() => { void openTaskEditor(task) }}
                    hitSlop={6}
                    haptic="soft"
                    accessibilityLabel="editar tarefa"
                  >
                    <Mono size={10.5} letterSpacing={1.4} color={c.ink2} style={styles.uppercase}>Editar</Mono>
                  </PressableTextScale>
                </View>
              </View>
            ))}

            <PressableTextScale
              onPress={() => setAgendaExpanded((value) => !value)}
              hitSlop={8}
              haptic="soft"
              accessibilityLabel={agendaExpanded ? 'recolher agenda' : 'ver agenda completa'}
              style={styles.agendaToggle}
            >
              <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity: 0.5 }}>
                {agendaExpanded
                  ? '· recolher'
                  : agenda.tasks.length > 1
                    ? `ver agenda completa · ${agenda.tasks.length} no dia`
                    : 'ver agenda completa'}
              </Frau>
            </PressableTextScale>

            {agendaExpanded ? (
              <View style={styles.agendaActions}>
                <MiniActionPill
                  label={agendaPlanning ? 'planejando' : 'planejar hoje'}
                  onPress={() => { void planTodayAgenda() }}
                  disabled={agendaPlanning}
                />
                <MiniActionPill
                  label={weekPlanning ? 'planejando' : 'planejar semana'}
                  onPress={() => { void planWeekAgenda() }}
                  disabled={weekPlanning}
                />
                <MiniActionPill
                  label={calendarBusyTaskId === 'agenda' ? 'marcando' : 'marcar plano'}
                  onPress={() => { void addAgendaPlanToAppleCalendar() }}
                  disabled={calendarBusyTaskId === 'agenda'}
                />
              </View>
            ) : null}

            {selectedTask ? (
              <TaskEditorSheet
                draft={taskDraft}
                onDraftChange={setTaskDraft}
                onClose={closeTaskEditor}
                onCommit={() => { void saveTaskDraft() }}
                onSealCalendar={() => { void addTaskToAppleCalendar(selectedTask, taskDraft) }}
                calendarBusy={calendarBusyTaskId === selectedTask.id}
                events={taskEvents}
              />
            ) : null}
          </>

          {agendaExpanded ? (
            <BlockEditorInline
              open={blockEditorOpen}
              draft={blockDraft}
              onDraftChange={setBlockDraft}
              onToggleOpen={() => setBlockEditorOpen((open) => !open)}
              onCommit={() => { void createAgendaBlock() }}
            />
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
        // Empty state F philosophy · imperativo seco em Frau italic 17, sem
        // seta Unicode. Mantém integridade tipográfica editorial (Sans choca
        // o vocabulário Frau-dominante da home, → vira "next button" SaaS).
        <PressableTextScale
          onPress={() => router.push('/capture')}
          hitSlop={6}
          haptic="soft"
          accessibilityLabel="capturar primeira tarefa do dia"
          style={styles.tierBlock}
        >
          <EditorialEmptyLine text="Capturar primeira tarefa." />
        </PressableTextScale>
      )}

        <Animated.View entering={FadeInDown.duration(460).delay(120).easing(exhaleEase()).springify().damping(22).stiffness(180)}>
          <SectionHead numeral="ii" title="Operação Atlas" deck="dossiês abertos · arquivo vivo" />
        </Animated.View>

      {/* Codex austero · 10/10 sussurro · sem box, sem subtitle, sem CTA.
          Título Frau italic com ponto terminal (pontuação de tratado) +
          classification em caps tiny right-aligned + hairline entre.
          Vocabulário Penguin Classics / Hermès Le Carré / Cucinelli Solomeo. */}
        {/* TOC editorial · cada dossiê é uma linha label · dot leader · descrição.
            Vocabulário de TOC de livro encadernado / Monocle daily briefing.
            Round 4 polish · stagger fade-in 40ms × idx · TOC entra como
            páginas de livro folheadas uma a uma, não cascata SaaS. */}
        <Animated.View entering={FadeInDown.duration(420).delay(120).easing(exhaleEase()).springify().damping(20).stiffness(160)}>
          <TocRow
            label="Loop"
            value="run vivo · comando 24h"
            onPress={() => router.push('/loop')}
            accessibilityLabel="Abrir o Loop · run vivo e comando do ciclo 24h."
            variant="codex"
            live
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(420).delay(140).easing(exhaleEase()).springify().damping(20).stiffness(160)}>
          <TocRow
            label="Memory"
            value={memoryHome.title.replace(/[.!?]+$/, '').toLowerCase()}
            onPress={() => router.push('/memory')}
            accessibilityLabel={`Abrir memória do Atlas. ${memoryHome.title}.`}
            variant="codex"
            live={memoryReviewQueue != null && memoryReviewQueue.total > 0}
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(420).delay(180).easing(exhaleEase()).springify().damping(20).stiffness(160)}>
          <TocRow
            label="Open Brain"
            value="recall e context pack"
            onPress={() => router.push('/open-brain')}
            accessibilityLabel="Abrir Atlas Open Brain · recall e context pack."
            variant="codex"
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(420).delay(220).easing(exhaleEase()).springify().damping(20).stiffness(160)}>
          <TocRow
            label="Engineering"
            value="harness runner e atlas-bench"
            onPress={() => router.push('/engineering')}
            accessibilityLabel="Abrir Atlas Engineering · harness runner e bench."
            variant="codex"
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(420).delay(260).easing(exhaleEase()).springify().damping(20).stiffness(160)}>
          <TocRow
            label="Cartografia"
            value="mapa vivo do atlas"
            onPress={() => router.push('/cartografia')}
            accessibilityLabel="Abrir Cartografia · mapa vivo do Atlas."
            variant="codex"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(460).delay(180).easing(exhaleEase()).springify().damping(22).stiffness(180)}>
          <SectionHead numeral="iii" title="Tecido" deck="constelações · fios soltos" />
        </Animated.View>

        <ConstelacaoWhisper onPress={() => router.push('/celestial')} />

        <Animated.View entering={FadeInDown.duration(460).delay(240).easing(exhaleEase()).springify().damping(22).stiffness(180)}>
          <SectionHead numeral="iv" title="Portas" />
        </Animated.View>

      {/* Portas · destinos não duplicados pelo dock ou pelos 4 dossiês.
          Vocabulário TOC editorial: cada porta é label · dot leader · estado.
          Variante 'doorway' = label italic (vs codex weight medium).
          Round 4 polish · stagger fade-in continuando do TOC codex. */}
      <Animated.View entering={FadeInDown.duration(420).delay(340).easing(exhaleEase()).springify().damping(20).stiffness(160)}>
        <TocRow
          label="bitácula"
          value={`${activeBehaviorCount} ${activeBehaviorCount === 1 ? 'ativo' : 'ativos'}`}
          onPress={() => router.push('/bitacula')}
          variant="doorway"
          live={activeBehaviorCount > 0}
        />
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(420).delay(380).easing(exhaleEase()).springify().damping(20).stiffness(160)}>
        <TocRow
          label="saúde"
          value={healthValue(sleep, hrv)}
          onPress={() => router.push('/health')}
          variant="doorway"
          live={sleep != null || hrv != null}
        />
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(420).delay(420).easing(exhaleEase()).springify().damping(20).stiffness(160)}>
        <TocRow
          label="plano"
          value="abrir"
          onPress={() => router.push('/projects')}
          variant="doorway"
        />
      </Animated.View>
      <Animated.View entering={FadeInDown.duration(420).delay(460).easing(exhaleEase()).springify().damping(20).stiffness(160)}>
        <TocRow
          label="rotinas"
          value="montar dia"
          onPress={() => router.push('/routines')}
          variant="doorway"
        />
      </Animated.View>

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
  // Smooth 380ms exhale entre estados via interpolateColor no texto.
  // Round 2 polish: ganhou press scale 0.94 + haptic Soft no select.
  // Scale fica no texto (não no container) pra evitar layout shift inline.
  const activeProgress = useSharedValue(active ? 1 : 0)
  const pressProgress = useSharedValue(0)
  const pressScale = useSharedValue(1)

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
    transform: [{ scale: pressScale.value }],
  }))

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
        onPress()
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`selecionar estado ${label.toLowerCase()}`}
      onPressIn={() => {
        pressProgress.value = withTiming(1, { duration: 220, easing: pressInEase() })
        pressScale.value = withTiming(0.94, { duration: 120, easing: pressInEase() })
      }}
      onPressOut={() => {
        pressProgress.value = withTiming(0, { duration: 360, easing: exhaleEase() })
        pressScale.value = withSpring(1, { damping: 14, stiffness: 240, mass: 0.7 })
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
  // Round 2 polish: ganhou press scale 0.94 + haptic Soft (canon CheckinPill).
  const activeProgress = useSharedValue(active ? 1 : 0)
  const pressProgress = useSharedValue(0)
  const pressScale = useSharedValue(1)

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
    transform: [{ scale: pressScale.value }],
  }))

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
        onPress()
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`selecionar nível ${level}`}
      onPressIn={() => {
        pressProgress.value = withTiming(1, { duration: 220, easing: pressInEase() })
        pressScale.value = withTiming(0.94, { duration: 120, easing: pressInEase() })
      }}
      onPressOut={() => {
        pressProgress.value = withTiming(0, { duration: 360, easing: exhaleEase() })
        pressScale.value = withSpring(1, { damping: 14, stiffness: 240, mass: 0.7 })
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

// TaskChip e MiniAction antigos (Sans sb prussian, radius 16) foram
// substituídos por ChoicePill e MiniActionPill em components/edition/Pills.tsx
// — canon do composer: radius 999, gold dot, Frau italic 13, press scale spring.

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
    <PressableSurfaceScale
      onPress={onPress}
      hitSlop={6}
      haptic="soft"
      accessibilityLabel="abrir constelação · o céu de Atlas"
      style={styles.whisper}
    >
      <Frau italic size={14} lineHeight={21} color={c.ink2}>
        veias do tecido ·{' '}
        {/* Round 3 polish · "O CÉU DE ATLAS" em bronze · era ink uniforme.
            Marca-d'água celestial canon · 1-2 acentos bronze por view, e esse
            é o ponto-de-portal pro Bilderatlas. Sutil mas com peso de selo. */}
        <Mono size={11} lineHeight={21} letterSpacing={1.0} color={c.bronze}>O CÉU DE ATLAS</Mono>
        {' '}· constelação aberta.
      </Frau>
    </PressableSurfaceScale>
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
  sleep: AtlasPassiveSignal | null
  hrv: AtlasPassiveSignal | null
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
  sleep: AtlasPassiveSignal | null,
  hrv: AtlasPassiveSignal | null,
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

function emptyTaskDraft(): TaskEditorDraft {
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

function draftFromTask(task: AtlasAgendaTask): TaskEditorDraft {
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
  draft?: TaskEditorDraft,
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

function normalizePriority(priority: string): TaskEditorDraft['priority'] {
  return priority === 'urgent' || priority === 'high' || priority === 'low' || priority === 'normal'
    ? priority
    : 'normal'
}

function normalizeEnergy(energy: string): TaskEditorDraft['energyRequired'] {
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
  // Cadência vertical da Agenda · 28px entre blocos editoriais (uniforme).
  //   marginTop: 28 — respiro consistente acima.
  //   marginBottom: 0 — deixa o próximo bloco cuidar do espaço via mt.
  // Antes era 18/26 (assimétrico) — gerava ritmo irregular entre missão,
  // tarefa e seção seguinte. Agora ritmo uniforme = sensação editorial
  // de "entrada do diário do dia" cadenciada.
  missionEditorial: { marginTop: 28, marginBottom: 0, marginLeft: 32, marginRight: 32 },
  // Mesma cadência 28px aplicada ao tierBlock (Capturar primeira, agendaPanel,
  // loading state). Substitui o `Universal gap 24px` anterior.
  tierBlock: {
    marginTop: 28,
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
  // Round 5 calibração · paddingVertical 14→4. O SectionHead acima já tem
  // marginBottom 28 · 14 extra no whisper criava gap ~42px isolando o tecido.
  // Agora gap ~32px · whisper respira sem ficar ilhado.
  whisper: {
    paddingVertical: 4,
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
  // Agenda panel · manuscript page embossed.
  // Radius 4 (manuscript canon) + inner top highlight 1px alpha cream 0.04
  // + sutil shadow 0/1/4 alpha 0.10 dá peso de papel sob o dedo · canon
  // embossed do composer adaptado pra "página de agenda" (não card SaaS).
  // Border continua hairline cream alpha 0.10 · gap 10 interno preservado.
  agendaPanel: {
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 1,
  },
  // Inner top highlight overlay · canon embossed manuscript Don Corleone.
  // Sutil cream alpha 0.04 (vs 0.06 do composer · agenda panel é mais
  // discreto pra não competir com o sheet do task editor).
  agendaPanelHighlight: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(233, 238, 242, 0.04)',
  },
  // Inner bottom shade · fecha o emboss · 1px black alpha 0.10.
  // Carving pattern: highlight top + shade bottom = peso 3D sutil.
  agendaPanelShade: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.10)',
  },
  // EditorialEmptyLine usa nested <Frau> inline · sem flex row, sem styles
  // de margem/padding. Layout single-line nativo do Text de RN.
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
    // Subtle ink-on-paper carving · sombra 1px alpha 0.22 dá peso de tinta
    // sobre o papel slate. Não é shadow Photoshop · é traço de bico-de-pena
    // que afundou meio milímetro no papel. Sem isso o dropcap fica "flutuando".
    textShadowColor: 'rgba(0, 0, 0, 0.22)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
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
  agendaToggle: {
    alignSelf: 'flex-start',
    paddingTop: 2,
  },
  agendaActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // miniAction (radius 16 prussian), taskChip (radius 16 prussian bg), input
  // (radius 10 hairline border), inputCompact, eventList, saveTask, blockEditor,
  // blockHeader, blockSave, taskEditor, formRow · removidos.
  // Substituídos por TaskEditorSheet · BlockEditorInline · MiniActionPill ·
  // ChoicePill em components/edition (embossed manuscript canon).
  //
  // checkinPanel, blockSummary, tileRow · removidos (não usados em lugar nenhum).
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
  // Hairline seal prussian sob o texto · ecoa "registrar." gesture.
  // alignSelf flex-start pra não estender por toda a largura (selo).
  checkinDoneSeal: {
    alignSelf: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 4,
    paddingHorizontal: 2,
  },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 6, marginTop: 6 },
  levelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  // choicePill / levelPill removidos · CheckinPill/LevelPill agora são inline
  // (italic Frau · numeral mono) sem container pill. Estado inline canon.
  // Registrar · stamp signature de tratado.
  // Italic Frau "registrar." bronzeDeep + período (vocabulário "ato
  // encerrado" canon · ver empty states da home) + hairline prussian @ 32%
  // abaixo (sela commitment). Sem em-dash inicial (em-dash em Atlas é
  // atribuição de citação, não prefixo SaaS de ação). Bronze no texto
  // herda signature dos pills active (Foco/2/Ruim) — o ato de selar
  // check-in rima com os 3 commits ativos acima.
  // Não é botão · não é frame · é o gesto de autenticar uma linha.
  saveCheckin: {
    marginTop: 36,
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
