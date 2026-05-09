import { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { usePalette } from '../design/theme'
import { Screen } from '../components/Screen'
import {
  Masthead,
  EditorialDateline,
  SectionHead,
  FolioFooter,
} from '../components/editorial'
import {
  AgendaViewTabs,
  AgendaWeekStrip,
  AgendaNow,
  AgendaTimeline,
  AgendaTomorrow,
  AgendaHorizon,
  AgendaEmptyState,
  AgendaPanorama,
  Ephemerides,
  MonthView,
  type AgendaView,
} from '../components/agenda'
import {
  buildEphemerides,
  buildHorizonDays,
  buildWeekStrip,
  findNextTask,
  groupTasksByDay,
} from '../lib/agenda'
import {
  currentEdition,
  dailyFolio,
  dayLongLabel,
  editorialDateLine,
  monthFolioLabel,
  monthLongLabel,
} from '../lib/folio'
import {
  listTaskAgenda,
  listTaskWeekAgenda,
  planTaskAgenda,
  type AtlasAgendaTask,
} from '../lib/api/client'
import { deviceTimezone, localDateKey } from '../lib/atlasStore'
import { getHolidaysMap, getUpcomingHolidays } from '../lib/holidays-br'
import { getMilestonesMap, getUpcomingMilestones } from '../lib/atlasMilestones'
import { computeMonthInsights } from '../lib/agendaInsights'
import { useShell } from '../components/AtlasShell'

// Agenda · calendário editorial TDAH-aware. Tela única com tabs internas
// (Hoje · Semana · Mês). Nunca mock data.
//
// Princípios canon aplicados:
//   - Peso decrescente: Hoje XL → Amanhã M → Horizonte S → Efemérides XS
//   - "AGORA" sempre primeira section (foco TDAH no presente)
//   - Régua bronze AGORA inline na timeline (ancoragem visual)
//   - Eventos passados line-through ink3 (closure cognitivo)
//   - Sem grid 7×6 mensal — vista Mês é TOC editorial linear
//   - Empty states editoriais Atlas-DNA (não SaaS)
//   - Section vi. PANORAMA com métricas mono caps (enterprise editorial)
export default function AgendaScreen() {
  const c = usePalette()
  const shell = useShell()
  const [view, setView] = useState<AgendaView>('hoje')
  const [todayTasks, setTodayTasks] = useState<AtlasAgendaTask[] | null>(null)
  const [tomorrowTasks, setTomorrowTasks] = useState<AtlasAgendaTask[] | null>(null)
  const [weekTasks, setWeekTasks] = useState<AtlasAgendaTask[] | null>(null)
  const [monthTasks, setMonthTasks] = useState<AtlasAgendaTask[] | null>(null)
  const [planning, setPlanning] = useState(false)

  const now = useMemo(() => new Date(), [])
  const folio = useMemo(() => dailyFolio(), [])
  const tomorrow = useMemo(() => {
    const d = new Date(now)
    d.setDate(now.getDate() + 1)
    d.setHours(0, 0, 0, 0)
    return d
  }, [now])

  // Holidays + milestones — duas escalas:
  //   monthHolidays/Milestones: do mês corrente · vista Mês + cinta semanal
  //   upcoming90: 90 dias à frente · vista Hoje · v. EFEMÉRIDES (peek longo)
  const monthHolidays = useMemo(
    () => getHolidaysMap(now.getFullYear(), now.getMonth()),
    [now],
  )
  const monthMilestones = useMemo(
    () => getMilestonesMap(now.getFullYear(), now.getMonth()),
    [now],
  )
  const upcomingHolidays = useMemo(() => getUpcomingHolidays(now, 90), [now])
  const upcomingMilestones = useMemo(() => getUpcomingMilestones(now, 90), [now])

  // Carrega tasks de hoje e amanhã (vista Hoje · seções i, ii, iii).
  useEffect(() => {
    let cancelled = false
    const loadHoje = async () => {
      try {
        const [today, tom] = await Promise.all([
          listTaskAgenda({
            date: localDateKey(now),
            timezone: deviceTimezone(),
            limit: 50,
          }),
          listTaskAgenda({
            date: localDateKey(tomorrow),
            timezone: deviceTimezone(),
            limit: 30,
          }),
        ])
        if (cancelled) return
        setTodayTasks(today.tasks ?? [])
        setTomorrowTasks(tom.tasks ?? [])
      } catch {
        if (cancelled) return
        setTodayTasks([])
        setTomorrowTasks([])
      }
    }
    if (view === 'hoje' && todayTasks === null) {
      void loadHoje()
    }
    return () => { cancelled = true }
  }, [view, now, tomorrow, todayTasks])

  // Carrega 7 dias para o Horizonte (vista Hoje · iv. HORIZONTE).
  useEffect(() => {
    let cancelled = false
    const loadWeek = async () => {
      try {
        const startDate = new Date(now)
        startDate.setDate(now.getDate() + 1)
        const response = await listTaskWeekAgenda({
          start_date: localDateKey(startDate),
          timezone: deviceTimezone(),
          days: 7,
        })
        if (cancelled) return
        const allTasks: AtlasAgendaTask[] = []
        for (const day of response.days) allTasks.push(...day.agenda.tasks)
        setWeekTasks(allTasks)
      } catch {
        if (cancelled) return
        setWeekTasks([])
      }
    }
    if (view === 'hoje' && weekTasks === null) {
      void loadWeek()
    }
    return () => { cancelled = true }
  }, [view, now, weekTasks])

  // Carrega tasks do mês inteiro (vista Mês + Panorama).
  useEffect(() => {
    let cancelled = false
    const loadMonth = async () => {
      try {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        const days = monthEnd.getDate()
        const response = await listTaskWeekAgenda({
          start_date: localDateKey(monthStart),
          timezone: deviceTimezone(),
          days,
          include_weekends: true,
          daily_limit: 20,
        })
        if (cancelled) return
        const allTasks: AtlasAgendaTask[] = []
        for (const day of response.days) allTasks.push(...day.agenda.tasks)
        setMonthTasks(allTasks)
      } catch {
        if (cancelled) return
        setMonthTasks([])
      }
    }
    if ((view === 'hoje' || view === 'mes') && monthTasks === null) {
      void loadMonth()
    }
    return () => { cancelled = true }
  }, [view, now, monthTasks])

  // Action: Atlas planeja o dia (chama planTaskAgenda).
  const handlePlanDay = useCallback(async () => {
    if (planning) return
    setPlanning(true)
    try {
      const planned = await planTaskAgenda({
        date: localDateKey(now),
        timezone: deviceTimezone(),
        create_blocks: false,
      })
      // Re-popula todayTasks com o agenda planejado.
      setTodayTasks(planned.agenda.tasks ?? [])
      shell?.showToast?.('Atlas montou o dia', { variant: 'checkin' })
    } catch {
      shell?.showToast?.('Não consegui planejar agora')
    } finally {
      setPlanning(false)
    }
  }, [planning, now, shell])

  // Derivações memoizadas
  const tasksByDayHoje = useMemo(
    () =>
      groupTasksByDay([
        ...(todayTasks ?? []),
        ...(tomorrowTasks ?? []),
        ...(weekTasks ?? []),
      ]),
    [todayTasks, tomorrowTasks, weekTasks],
  )
  const weekStripDays = useMemo(
    () => buildWeekStrip(tasksByDayHoje, now, monthHolidays, monthMilestones),
    [tasksByDayHoje, now, monthHolidays, monthMilestones],
  )
  const horizonDays = useMemo(
    () => buildHorizonDays(tasksByDayHoje, now, 7, monthHolidays, monthMilestones),
    [tasksByDayHoje, now, monthHolidays, monthMilestones],
  )
  const ephemerides = useMemo(
    () =>
      buildEphemerides({
        tasks: monthTasks ?? [],
        milestones: upcomingMilestones,
        holidays: upcomingHolidays,
        futureOnly: true,
        now,
        limit: 10,
      }),
    [monthTasks, upcomingMilestones, upcomingHolidays, now],
  )
  const nextTask = useMemo(() => findNextTask(todayTasks ?? [], now), [todayTasks, now])
  const tasksByDayMes = useMemo(() => groupTasksByDay(monthTasks ?? []), [monthTasks])

  // Insights operacionais do mês (vista Hoje · vi. PANORAMA).
  const monthInsights = useMemo(() => {
    const allHolidays = Array.from(monthHolidays.values())
    const allMilestones = Array.from(monthMilestones.values())
    return computeMonthInsights({
      month: now,
      today: now,
      tasks: monthTasks ?? [],
      milestones: allMilestones,
      holidays: allHolidays,
    })
  }, [now, monthTasks, monthHolidays, monthMilestones])

  // Tomorrow datestring "sábado, 10 de maio · descanso" (canon vista Hoje).
  const tomorrowDeck = useMemo(() => {
    const summary = tomorrowTasks && tomorrowTasks.length > 0
      ? tomorrowTasks.length === 1 ? '1 ato' : `${tomorrowTasks.length} atos`
      : 'descanso'
    return `${dayLongLabel(tomorrow)} · ${summary}`
  }, [tomorrow, tomorrowTasks])

  // Edition + counts para a dateline (Hoje vs Mês).
  const editionLine = useMemo(() => {
    if (view === 'hoje') {
      const count = todayTasks?.length ?? 0
      if (count === 0) return currentEdition()
      const word = count === 1 ? 'um ato hoje' : `${count} atos hoje`
      return `${currentEdition()} · ${word}`
    }
    if (view === 'mes') {
      const count = monthTasks?.length ?? 0
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      if (count === 0) return `${last} dias`
      return `${last} dias · ${count} ${count === 1 ? 'ato' : 'atos'}`
    }
    return currentEdition()
  }, [view, todayTasks, monthTasks, now])

  const dateLineMain = useMemo(
    () => (view === 'mes' ? monthLongLabel(now) : editorialDateLine(now)),
    [view, now],
  )

  // Estados derivados pra empty states ricos.
  const todayLoaded = todayTasks !== null
  const tomorrowLoaded = tomorrowTasks !== null
  const hasTodayTasks = (todayTasks?.length ?? 0) > 0

  return (
    <Screen bare>
      <Masthead title="Agenda" folio={null} />
      <EditorialDateline date={dateLineMain} edition={editionLine} />

      <AgendaViewTabs value={view} onChange={setView} />

      {view === 'hoje' ? (
        <View>
          <AgendaWeekStrip days={weekStripDays} />

          {/* i. AGORA — próximo compromisso ou empty state rico com "Planejar dia". */}
          <SectionHead numeral="i" title="Agora" />
          {nextTask ? (
            <AgendaNow task={nextTask} now={now} />
          ) : todayLoaded ? (
            <AgendaEmptyState
              eyebrow={hasTodayTasks ? 'sem janelas futuras' : 'agenda livre'}
              statement={
                hasTodayTasks
                  ? 'Sem próximo compromisso.'
                  : 'O dia ainda não tem horários marcados.'
              }
              prose={
                hasTodayTasks
                  ? 'Os compromissos de hoje já passaram.'
                  : 'Atlas pode propor um plano com base nas tarefas abertas.'
              }
              action={
                hasTodayTasks
                  ? undefined
                  : { label: 'Planejar dia', onPress: handlePlanDay }
              }
              loading={planning}
            />
          ) : null}

          {/* ii. RESTO DO DIA — timeline ou silêncio editorial. */}
          <SectionHead
            numeral="ii"
            title="Resto do dia"
            deck={
              hasTodayTasks
                ? `${todayTasks!.length === 1 ? 'uma janela' : `${todayTasks!.length} janelas`} · hoje`
                : undefined
            }
          />
          {hasTodayTasks ? (
            <AgendaTimeline tasks={todayTasks!} now={now} />
          ) : todayLoaded ? (
            <AgendaEmptyState
              eyebrow="dia em silêncio"
              statement="Hoje sem janelas marcadas."
              prose="Próxima oportunidade é amanhã — ou marque algo no calendário Apple e Atlas reflete aqui."
            />
          ) : null}

          {/* iii. AMANHÃ */}
          <SectionHead numeral="iii" title="Amanhã" deck={tomorrowDeck} />
          {(tomorrowTasks?.length ?? 0) > 0 ? (
            <AgendaTomorrow tasks={tomorrowTasks!} />
          ) : tomorrowLoaded ? (
            <AgendaEmptyState
              eyebrow="amanhã livre"
              statement="Nenhum compromisso amanhã."
              prose="Dia em aberto · janela boa pra trabalho profundo."
            />
          ) : null}

          {/* iv. HORIZONTE — 7 dias, condensado se tudo livre */}
          <SectionHead numeral="iv" title="Horizonte" deck="próximos sete dias" />
          <AgendaHorizon days={horizonDays} />

          {/* v. EFEMÉRIDES — sempre que houver marco nos próximos 90 dias */}
          {ephemerides.length > 0 ? (
            <>
              <SectionHead
                numeral="v"
                title="Efemérides"
                deck="marcos do horizonte · noventa dias"
              />
              <Ephemerides entries={ephemerides} />
            </>
          ) : null}

          {/* vi. PANORAMA — métricas operacionais do mês corrente */}
          <SectionHead numeral="vi" title="Panorama" deck={`${monthLongLabel(now).toLowerCase()} · indicadores do mês`} />
          <AgendaPanorama insights={monthInsights} />
        </View>
      ) : null}

      {view === 'mes' ? (
        <View>
          <MonthView
            month={now}
            tasksByDay={tasksByDayMes}
            today={now}
            holidays={monthHolidays}
            milestones={monthMilestones}
          />
        </View>
      ) : null}

      {view === 'semana' ? (
        <View style={styles.placeholderBlock}>
          <AgendaEmptyState
            eyebrow="vista semana"
            statement="Em construção."
            prose="A vista semanal entra na próxima edição. Por enquanto, use Hoje pro dia atual e Mês pra visão longa."
          />
        </View>
      ) : null}

      {view === 'mes' ? (
        <FolioFooter label={monthFolioLabel(now)} />
      ) : (
        <FolioFooter number={folio.number} suffix="agenda" />
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  placeholderBlock: {
    marginTop: 12,
  },
})
