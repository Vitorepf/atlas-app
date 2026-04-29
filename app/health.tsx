import { useMemo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { SectionHeader } from '../components/SectionHeader'
import { Tile } from '../components/Tile'
import { PrimaryButton } from '../components/PrimaryButton'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import {
  formatRelativeSync,
  latestCheckin,
  useAtlasStore,
  type QueuedPassiveSignal,
} from '../lib/atlasStore'
import type { AtlasPassiveSignal } from '../lib/api/client'
import { useShell } from '../components/AtlasShell'
import {
  buildReadinessV1,
  type ReadinessFactor,
  type ReadinessV1Model,
} from '../lib/readiness'

type HealthSignal = Pick<
  AtlasPassiveSignal,
  'id' | 'client_id' | 'source' | 'signal_type' | 'value_numeric' | 'value_text' | 'unit' | 'started_at' | 'ended_at' | 'recorded_timezone' | 'metadata'
>

type TrendMode = 'absolute' | 'relative'

interface MetricValue {
  value: number | null
  text?: string | null
  unit?: string | null
  date?: string | null
}

interface MetricRowModel {
  label: string
  value: MetricValue
  previous?: MetricValue | null
  trendMode?: TrendMode
  positiveIsGood?: boolean | null
}

export default function HealthScreen() {
  const c = usePalette()
  const router = useRouter()
  const { showToast } = useShell()
  const passiveSignals = useAtlasStore((s) => s.passiveSignals)
  const queuedPassiveSignals = useAtlasStore((s) => s.queuedPassiveSignals)
  const healthSnapshots = useAtlasStore((s) => s.healthSnapshots)
  const queuedHealthSnapshots = useAtlasStore((s) => s.queuedHealthSnapshots)
  const checkins = useAtlasStore((s) => s.checkins)
  const queuedCheckins = useAtlasStore((s) => s.queuedCheckins)
  const healthKit = useAtlasStore((s) => s.healthKit)
  const healthKitSyncing = useAtlasStore((s) => s.healthKitSyncing)
  const requestHealthKitPermissions = useAtlasStore((s) => s.requestHealthKitPermissions)
  const syncHealthKit = useAtlasStore((s) => s.syncHealthKit)
  const sync = useAtlasStore((s) => s.sync)
  const syncing = useAtlasStore((s) => s.syncing)

  const allSignals = useMemo(() => (
    mergeSignals([
      ...passiveSignals,
      ...queuedPassiveSignals.map(queuedToSignal),
    ])
  ), [passiveSignals, queuedPassiveSignals])

  const healthSignals = useMemo(() => (
    allSignals.filter((signal) => signal.source === 'healthkit')
  ), [allSignals])

  const latestState = useMemo(
    () => latestCheckin({ checkins, queuedCheckins }),
    [checkins, queuedCheckins],
  )

  const model = useMemo(() => buildHealthModel(healthSignals, allSignals, latestState), [allSignals, healthSignals, latestState])

  const requestHealth = async () => {
    await requestHealthKitPermissions()
    const state = useAtlasStore.getState()
    showToast(state.healthKit.enabled ? 'Saúde conectada' : state.healthKit.lastError ?? 'Saúde indisponível')
  }

  const collectHealth = async () => {
    await syncHealthKit()
    const state = useAtlasStore.getState()
    showToast(state.healthKit.historyBackfilled ? 'Coleta de saúde concluída' : 'Histórico de saúde importado')
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Label>Saúde Apple</Label>
        <Frau size={42} lineHeight={44} letterSpacing={-1.05} color={c.ink} style={{ marginTop: 8 }}>
          Estado físico
        </Frau>
        <Mono size={12} letterSpacing={0.24} color={c.ink2} style={{ marginTop: 8 }}>
          {healthKitStatusText(healthKit.available, healthKit.enabled)} · {healthSignals.length} sinais · {healthSnapshots.length + queuedHealthSnapshots.length} snapshots · {healthKit.historyBackfilled ? 'histórico ok' : 'histórico pendente'}
        </Mono>
      </View>

      <View style={styles.tileGrid}>
        <View style={styles.tileRow}>
          <Tile label="Prontidão" tall>
            {model.readinessV1.base.display}
          </Tile>
          <Tile label="Agora" tall>
            {model.readinessV1.current.display}
          </Tile>
        </View>
        <View style={styles.tileRow}>
          <Tile label="Corpo" tall>
            {model.readinessV1.body.display}
          </Tile>
          <Tile label="Mente" tall>
            {model.readinessV1.mind.display}
          </Tile>
        </View>
      </View>

      <View style={[styles.summaryPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
        <SummaryLine label="Assinatura" value={model.readinessV1.signature.label} />
        <SummaryLine label="Modo recomendado" value={model.readinessV1.mode.label} />
        <SummaryLine label="Capacidade de foco" value={model.readinessV1.focus.display} />
        <SummaryLine label="Confiança" value={model.readinessV1.confidence.label} last />
        {healthKit.lastError ? (
          <Sans size={12} lineHeight={17} color={c.recRed} style={{ marginTop: 12 }}>
            {healthKit.lastError}
          </Sans>
        ) : null}
      </View>

      <View style={styles.actionRow}>
        <PrimaryButton
          label={healthKitSyncing ? 'Solicitando…' : 'Permitir Saúde'}
          variant="secondary"
          fullWidth={false}
          style={styles.actionButton}
          onPress={() => {
            void requestHealth()
          }}
        />
        <PrimaryButton
          label={healthKitSyncing ? 'Coletando…' : healthKit.historyBackfilled ? 'Coletar agora' : 'Importar histórico'}
          fullWidth={false}
          style={styles.actionButton}
          onPress={() => {
            void collectHealth()
          }}
        />
      </View>

      {model.readinessV1.factors.length > 0 ? (
        <>
          <SectionHeader label="Por que" />
          <FactorList factors={model.readinessV1.factors} />
        </>
      ) : null}

      <SectionHeader label="Recuperação" />
      <MetricList
        rows={model.recoveryRows}
        onRowPress={(item) => {
          if (item.label === 'Sono') router.push('/sleep')
        }}
      />

      <SectionHeader label="Carga" />
      <MetricList rows={model.loadRows} />

      <SectionHeader label="Subjetivo" />
      <MetricList rows={model.subjectiveRows} />

      <SectionHeader label="Composição corporal" />
      <MetricList rows={model.bodyRows} />

      <View style={[styles.syncPanel, { borderTopColor: c.border, borderBottomColor: c.border }]}>
        <Mono size={11} letterSpacing={0.44} color={c.ink2} align="center">
          Última coleta HealthKit · {formatRelativeSync(healthKit.lastSyncAt)}
        </Mono>
      </View>

      <PrimaryButton
        label={syncing ? 'Sincronizando…' : 'Atualizar servidor'}
        variant="secondary"
        onPress={() => {
          void sync()
        }}
      />
    </Screen>
  )
}

function buildHealthModel(
  healthSignals: HealthSignal[],
  allSignals: HealthSignal[],
  latestState: ReturnType<typeof latestCheckin>,
) {
  const readinessV1 = buildReadinessV1({
    healthSignals,
    allSignals,
    latestCheckin: latestState,
  })
  const sleepNow = latestSleepValue(healthSignals)
  const hrvNow = latestDayMedian(healthSignals, ['hrv_ms'])
  const restingHeartRateNow = withUnit(latestDayMedian(healthSignals, ['resting_heart_rate_bpm']), 'bpm')
  const respiratoryNow = withUnit(latestDayMedian(healthSignals, ['respiratory_rate']), 'resp/min')
  const wristTemperatureNow = latestDayMedian(healthSignals, ['wrist_temperature'])

  const stepsToday = dailySum(healthSignals, ['steps'])
  const exerciseToday = dailySum(healthSignals, ['exercise_minutes'])
  const activeEnergyToday = dailySum(healthSignals, ['active_energy_kcal'])
  const distanceToday = dailySum(healthSignals, ['walking_running_distance', 'HKQuantityTypeIdentifierDistanceWalkingRunning'])
  const workoutNow = latestValue(healthSignals, ['workout'])

  const bodyMassNow = latestValue(healthSignals, ['body_mass'])
  const bodyFatNow = normalizedPercentValue(latestValue(healthSignals, ['body_fat_percentage']))
  const leanMassNow = latestValue(healthSignals, ['lean_body_mass'])
  const musclePercentNow = musclePercentValue(healthSignals)
  const bodyAgeNow = latestValue(healthSignals, ['body_age', 'metabolic_age'])
  const bmiNow = latestValue(healthSignals, ['body_mass_index'])
  const basalEnergyToday = dailySum(healthSignals, ['basal_energy_kcal'])

  return {
    readinessV1,
    sleepNow,
    hrvNow,
    recoveryRows: [
      row('Sono', sleepNow, previousWeekLatestByEnd(healthSignals, ['sleep_duration_hours']), 'absolute', true),
      row('HRV', hrvNow, previousWeekDailyMedian(healthSignals, ['hrv_ms']), 'absolute', true),
      row('FC repouso', restingHeartRateNow, withUnit(previousWeekDailyMedian(healthSignals, ['resting_heart_rate_bpm']), 'bpm'), 'absolute', false),
      row('Respiração', respiratoryNow, withUnit(previousWeekDailyMedian(healthSignals, ['respiratory_rate']), 'resp/min'), 'absolute', false),
      row('Temperatura pulso', wristTemperatureNow, previousWeekDailyMedian(healthSignals, ['wrist_temperature']), 'absolute', null),
    ],
    loadRows: [
      row('Passos hoje', stepsToday, previousWeekDailyAverage(healthSignals, ['steps']), 'relative', true),
      row('Exercício hoje', exerciseToday, previousWeekDailyAverage(healthSignals, ['exercise_minutes']), 'relative', true),
      row('Energia ativa', activeEnergyToday, previousWeekDailyAverage(healthSignals, ['active_energy_kcal']), 'relative', true),
      row('Distância hoje', distanceToday, previousWeekDailyAverage(healthSignals, ['walking_running_distance', 'HKQuantityTypeIdentifierDistanceWalkingRunning']), 'relative', true),
      row('Treino recente', workoutNow, previousWeekLatest(healthSignals, ['workout']), 'absolute', true),
    ],
    subjectiveRows: [
      row('Energia', checkinMetric(latestState?.energy_level ?? null), null, 'absolute', true),
      row('Mood', checkinMetric(latestState?.mood_level ?? null), null, 'absolute', true),
      row('Estado', { value: null, text: latestState ? checkinStateLabel(latestState.state) : 'Sem check-in' }, null, 'absolute', true),
      row('Foco Rize', latestValue(allSignals, ['focus_minutes', 'rize_focus_minutes']), previousWeekDailyAverage(allSignals, ['focus_minutes', 'rize_focus_minutes']), 'relative', true),
    ],
    bodyRows: [
      row('Gordura corporal', bodyFatNow, normalizedPercentValue(previousWeekLatest(healthSignals, ['body_fat_percentage'])), 'absolute', false),
      row('Músculo %', musclePercentNow, previousWeekMusclePercent(healthSignals), 'absolute', true),
      row('Idade corporal', bodyAgeNow, previousWeekLatest(healthSignals, ['body_age', 'metabolic_age']), 'absolute', false),
      row('Massa magra', leanMassNow, previousWeekLatest(healthSignals, ['lean_body_mass']), 'absolute', true),
      row('Peso', bodyMassNow, previousWeekLatest(healthSignals, ['body_mass']), 'absolute', false),
      row('IMC', bmiNow, previousWeekLatest(healthSignals, ['body_mass_index']), 'absolute', false),
      row('TMB', basalEnergyToday, previousWeekDailyAverage(healthSignals, ['basal_energy_kcal']), 'relative', true),
    ],
  }
}

function FactorList({ factors }: { factors: ReadinessV1Model['factors'] }) {
  const c = usePalette()
  return (
    <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
      {factors.map((factor, index) => (
        <FactorRow
          key={factor.key}
          factor={factor}
          last={index === factors.length - 1}
        />
      ))}
    </View>
  )
}

function FactorRow({
  factor,
  last,
}: {
  factor: ReadinessFactor
  last?: boolean
}) {
  const c = usePalette()
  const color = factor.kind === 'positive' ? c.moss : factor.kind === 'negative' ? c.recRed : c.ink2
  const impact = factor.impact > 0 ? `+${factor.impact}` : `${factor.impact}`
  return (
    <View style={[styles.factorRow, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={styles.metricText}>
        <Sans size={15} color={c.ink}>{factor.label}</Sans>
        <Mono size={10.5} letterSpacing={0.21} color={c.ink2}>
          {factor.value}
        </Mono>
      </View>
      <Mono size={12.5} letterSpacing={0.25} color={color} align="right">
        {impact} pts
      </Mono>
    </View>
  )
}

function MetricList({
  rows,
  onRowPress,
}: {
  rows: MetricRowModel[]
  onRowPress?: (item: MetricRowModel) => void
}) {
  const c = usePalette()
  return (
    <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
      {rows.map((item, index) => (
        <MetricRow
          key={item.label}
          item={item}
          last={index === rows.length - 1}
          onPress={onRowPress}
        />
      ))}
    </View>
  )
}

function MetricRow({
  item,
  last,
  onPress,
}: {
  item: MetricRowModel
  last?: boolean
  onPress?: (item: MetricRowModel) => void
}) {
  const c = usePalette()
  const trend = trendText(item, c)
  const press = item.label === 'Sono' && onPress ? () => onPress(item) : undefined
  return (
    <Pressable
      onPress={press}
      disabled={!press}
      style={({ pressed }) => [
        styles.metricRow,
        !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && { backgroundColor: c.premium },
      ]}
    >
      <View style={styles.metricText}>
        <Sans size={15} color={c.ink}>{item.label}</Sans>
        <Mono size={10.5} letterSpacing={0.21} color={c.ink2}>
          {item.value.date ? formatDateTime(item.value.date) : 'Sem dado'}
        </Mono>
      </View>
      <View style={styles.metricValue}>
        <Mono size={13} letterSpacing={0.26} color={hasValue(item.value) ? c.ink : c.ink3} align="right">
          {formatMetric(item.value)}
        </Mono>
        {trend ? (
          <Mono size={10.5} letterSpacing={0.1} color={trend.color} align="right">
            {trend.label}
          </Mono>
        ) : null}
      </View>
    </Pressable>
  )
}

function SummaryLine({
  label,
  value,
  last,
}: {
  label: string
  value: string
  last?: boolean
}) {
  const c = usePalette()
  return (
    <View style={[styles.summaryLine, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Sans size={14} color={c.ink2}>{label}</Sans>
      <View style={styles.summaryValue}>
        <Mono size={12} letterSpacing={0.24} color={c.ink} align="right">
          {value}
        </Mono>
      </View>
    </View>
  )
}

function row(
  label: string,
  value: MetricValue,
  previous?: MetricValue | null,
  trendMode: TrendMode = 'absolute',
  positiveIsGood: boolean | null = true,
): MetricRowModel {
  return { label, value, previous, trendMode, positiveIsGood }
}

function latestValue(signals: HealthSignal[], signalTypes: string[]): MetricValue {
  const match = signals
    .filter((signal) => signalTypes.includes(signal.signal_type))
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
  return signalToMetricValue(match)
}

function latestSleepValue(signals: HealthSignal[]): MetricValue {
  const match = signals
    .filter((signal) => signal.signal_type === 'sleep_duration_hours')
    .sort((a, b) => signalEndTime(b) - signalEndTime(a))[0]
  return signalToMetricValue(match, 'end')
}

function dailySum(signals: HealthSignal[], signalTypes: string[], date = new Date()): MetricValue {
  const start = startOfLocalDay(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 1)

  const matches = signals.filter((signal) => {
    const time = new Date(signal.started_at).getTime()
    return signalTypes.includes(signal.signal_type)
      && time >= start.getTime()
      && time < end.getTime()
      && typeof signal.value_numeric === 'number'
  })

  if (matches.length === 0) return { value: null }
  const total = matches.reduce((acc, signal) => acc + Number(signal.value_numeric ?? 0), 0)
  const latest = matches.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
  return { value: total, unit: latest.unit, date: latest.started_at }
}

function latestDayMedian(signals: HealthSignal[], signalTypes: string[]): MetricValue {
  const matches = signals
    .filter((signal) => (
      signalTypes.includes(signal.signal_type)
      && typeof signal.value_numeric === 'number'
    ))
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

  if (matches.length === 0) return { value: null }

  const latestDay = localDateKeyFromIso(matches[0].started_at)
  const daySamples = matches.filter((signal) => localDateKeyFromIso(signal.started_at) === latestDay)
  return {
    value: median(daySamples.map((signal) => Number(signal.value_numeric))),
    unit: daySamples[0]?.unit,
    date: daySamples[0]?.started_at,
  }
}

function previousWeekDailyAverage(signals: HealthSignal[], signalTypes: string[]): MetricValue | null {
  const today = startOfLocalDay(new Date())
  const values: number[] = []
  let unit: string | null | undefined
  let latestDate: string | null = null

  for (let daysAgo = 7; daysAgo < 14; daysAgo++) {
    const date = new Date(today)
    date.setDate(today.getDate() - daysAgo)
    const value = dailySum(signals, signalTypes, date)
    if (typeof value.value === 'number') {
      values.push(value.value)
      unit = value.unit
      latestDate = value.date ?? latestDate
    }
  }

  if (values.length === 0) return null
  return { value: average(values), unit, date: latestDate }
}

function previousWeekDailyMedian(signals: HealthSignal[], signalTypes: string[]): MetricValue | null {
  const range = previousWeekRange()
  const byDay = groupedNumericSignalsByDay(signals, signalTypes, range.start, range.end)
  const dayMedians = [...byDay.values()].map((bucket) => median(bucket.map((signal) => Number(signal.value_numeric))))
  const latest = [...byDay.values()]
    .flat()
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]

  if (dayMedians.length === 0) return null
  return {
    value: median(dayMedians),
    unit: latest?.unit,
    date: latest?.started_at,
  }
}

function previousWeekLatest(signals: HealthSignal[], signalTypes: string[]): MetricValue | null {
  const range = previousWeekRange()
  const match = signals
    .filter((signal) => {
      const time = new Date(signal.started_at).getTime()
      return signalTypes.includes(signal.signal_type)
        && time >= range.start.getTime()
        && time <= range.end.getTime()
    })
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
  return match ? signalToMetricValue(match) : null
}

function previousWeekLatestByEnd(signals: HealthSignal[], signalTypes: string[]): MetricValue | null {
  const range = previousWeekRange()
  const match = signals
    .filter((signal) => {
      const time = signalEndTime(signal)
      return signalTypes.includes(signal.signal_type)
        && time >= range.start.getTime()
        && time <= range.end.getTime()
    })
    .sort((a, b) => signalEndTime(b) - signalEndTime(a))[0]
  return match ? signalToMetricValue(match, 'end') : null
}

function previousWeekMedian(signals: HealthSignal[], signalTypes: string[]): MetricValue | null {
  const range = previousWeekRange()
  const values = signals
    .filter((signal) => {
      const time = new Date(signal.started_at).getTime()
      return signalTypes.includes(signal.signal_type)
        && time >= range.start.getTime()
        && time <= range.end.getTime()
        && typeof signal.value_numeric === 'number'
    })
  if (values.length === 0) return null
  const latest = values.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
  return {
    value: median(values.map((signal) => Number(signal.value_numeric))),
    unit: latest.unit,
    date: latest.started_at,
  }
}

function baselineDailyMedian(signals: HealthSignal[], signalTypes: string[]): number | null {
  const cutoff = startOfLocalDay(new Date())
  const start = new Date(cutoff)
  start.setDate(cutoff.getDate() - 28)
  const byDay = groupedNumericSignalsByDay(signals, signalTypes, start, cutoff)
  const dayMedians = [...byDay.values()].map((bucket) => median(bucket.map((signal) => Number(signal.value_numeric))))
  if (dayMedians.length < 3) return null
  return median(dayMedians)
}

function baselineMedian(signals: HealthSignal[], signalTypes: string[]): number | null {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 1)
  const start = new Date()
  start.setDate(start.getDate() - 28)
  const values = signals
    .filter((signal) => {
      const time = new Date(signal.started_at).getTime()
      return signalTypes.includes(signal.signal_type)
        && time >= start.getTime()
        && time <= cutoff.getTime()
        && typeof signal.value_numeric === 'number'
    })
    .map((signal) => Number(signal.value_numeric))
  if (values.length < 3) return null
  return median(values)
}

function signalToMetricValue(signal?: HealthSignal, dateSource: 'start' | 'end' = 'start'): MetricValue {
  if (!signal) return { value: null }
  return {
    value: typeof signal.value_numeric === 'number' ? signal.value_numeric : null,
    text: signal.value_text,
    unit: signal.unit,
    date: dateSource === 'end' ? signal.ended_at ?? signal.started_at : signal.started_at,
  }
}

function normalizedPercentValue(value: MetricValue | null): MetricValue {
  if (!value) return { value: null }
  if (typeof value.value !== 'number') return value
  const isPercent = value.unit === '%' || value.unit === 'percent' || Math.abs(value.value) <= 1
  return {
    ...value,
    value: isPercent && Math.abs(value.value) <= 1 ? value.value * 100 : value.value,
    unit: '%',
  }
}

function withUnit(value: MetricValue, unit: string): MetricValue
function withUnit(value: MetricValue | null, unit: string): MetricValue | null
function withUnit(value: MetricValue | null, unit: string): MetricValue | null {
  if (!value) return null
  return typeof value.value === 'number' ? { ...value, unit } : value
}

function musclePercentValue(signals: HealthSignal[]): MetricValue {
  const direct = normalizedPercentValue(latestValue(signals, [
    'muscle_mass_percentage',
    'skeletal_muscle_percentage',
    'body_muscle_percentage',
  ]))
  if (typeof direct.value === 'number') return direct

  const lean = latestValue(signals, ['lean_body_mass'])
  const weight = latestValue(signals, ['body_mass'])
  if (typeof lean.value !== 'number' || typeof weight.value !== 'number' || weight.value <= 0) {
    return { value: null }
  }

  return {
    value: (lean.value / weight.value) * 100,
    unit: '%',
    date: lean.date ?? weight.date,
  }
}

function previousWeekMusclePercent(signals: HealthSignal[]): MetricValue | null {
  const direct = normalizedPercentValue(previousWeekLatest(signals, [
    'muscle_mass_percentage',
    'skeletal_muscle_percentage',
    'body_muscle_percentage',
  ]))
  if (typeof direct.value === 'number') return direct

  const lean = previousWeekLatest(signals, ['lean_body_mass'])
  const weight = previousWeekLatest(signals, ['body_mass'])
  if (!lean || !weight || typeof lean.value !== 'number' || typeof weight.value !== 'number' || weight.value <= 0) {
    return null
  }

  return {
    value: (lean.value / weight.value) * 100,
    unit: '%',
    date: lean.date ?? weight.date,
  }
}

function checkinMetric(value: number | null): MetricValue {
  return typeof value === 'number' ? { value, unit: '/5' } : { value: null }
}

function readinessScore(input: {
  sleep: MetricValue
  hrv: MetricValue
  hrvBaseline: number | null
  restingHeartRate: MetricValue
  restingHeartRateBaseline: number | null
  energy: number | null
  mood: number | null
}): { score: number | null; label: string } {
  const components: number[] = []

  if (typeof input.sleep.value === 'number') {
    components.push(clamp(input.sleep.value / 7.5, 0, 1.1))
  }

  if (typeof input.hrv.value === 'number' && input.hrvBaseline) {
    components.push(clamp(input.hrv.value / input.hrvBaseline, 0.55, 1.25) / 1.25)
  }

  if (typeof input.restingHeartRate.value === 'number' && input.restingHeartRateBaseline) {
    components.push(clamp(input.restingHeartRateBaseline / input.restingHeartRate.value, 0.75, 1.15) / 1.15)
  }

  if (typeof input.energy === 'number') components.push(input.energy / 5)
  if (typeof input.mood === 'number') components.push(input.mood / 5)

  if (components.length < 3) return { score: null, label: 'Baseline' }

  const score = Math.round(average(components) * 100)
  if (score >= 82) return { score, label: `${score}% alta` }
  if (score >= 64) return { score, label: `${score}% ok` }
  return { score, label: `${score}% baixa` }
}

function sleepDebtLabel(signals: HealthSignal[]): { label: string } {
  const sleeps = recentSleepValues(signals, 7)
  if (sleeps.length === 0) return { label: 'Sem dado' }
  const debt = sleeps.reduce((acc, value) => acc + Math.max(0, 7.5 - value), 0)
  if (debt < 0.5) return { label: 'Sem débito' }
  const hours = Math.floor(debt)
  const minutes = Math.round((debt - hours) * 60)
  return { label: `${hours}h${String(minutes).padStart(2, '0')}` }
}

function recentSleepValues(signals: HealthSignal[], days: number): number[] {
  const start = startOfLocalDay(new Date())
  start.setDate(start.getDate() - days)
  return signals
    .filter((signal) => (
      signal.signal_type === 'sleep_duration_hours'
      && signalEndTime(signal) >= start.getTime()
      && typeof signal.value_numeric === 'number'
    ))
    .map((signal) => Number(signal.value_numeric))
}

function loadLabel(signals: HealthSignal[]): { label: string } {
  const todaySteps = dailySum(signals, ['steps'])
  const todayExercise = dailySum(signals, ['exercise_minutes'])
  const todayEnergy = dailySum(signals, ['active_energy_kcal'])
  const prevSteps = previousWeekDailyAverage(signals, ['steps'])
  const prevExercise = previousWeekDailyAverage(signals, ['exercise_minutes'])
  const prevEnergy = previousWeekDailyAverage(signals, ['active_energy_kcal'])

  const ratios = [
    ratio(todaySteps.value, prevSteps?.value),
    ratio(todayExercise.value, prevExercise?.value),
    ratio(todayEnergy.value, prevEnergy?.value),
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  if (ratios.length === 0) return { label: 'Sem baseline' }
  const load = average(ratios)
  if (load >= 1.25) return { label: 'Alta' }
  if (load <= 0.65) return { label: 'Baixa' }
  return { label: 'Normal' }
}

function focusCapacityLabel(
  readiness: number | null,
  sleep: number | null,
  energy: number | null,
  mood: number | null,
): { label: string } {
  const components = [
    readiness === null ? null : readiness / 100,
    typeof sleep === 'number' ? clamp(sleep / 7.5, 0, 1.1) : null,
    typeof energy === 'number' ? energy / 5 : null,
    typeof mood === 'number' ? mood / 5 : null,
  ].filter((value): value is number => typeof value === 'number')

  if (components.length < 2) return { label: 'Sem dado' }
  const score = Math.round(average(components) * 100)
  if (score >= 78) return { label: 'Profundo' }
  if (score >= 58) return { label: 'Operacional' }
  return { label: 'Leve' }
}

function recentMetricValues(signals: HealthSignal[], signalTypes: string[], days: number): number[] {
  const start = startOfLocalDay(new Date())
  start.setDate(start.getDate() - days)
  return signals
    .filter((signal) => (
      signalTypes.includes(signal.signal_type)
      && new Date(signal.started_at).getTime() >= start.getTime()
      && typeof signal.value_numeric === 'number'
    ))
    .map((signal) => Number(signal.value_numeric))
}

function trendText(
  item: MetricRowModel,
  c: ReturnType<typeof usePalette>,
): { label: string; color: string } | null {
  const current = item.value.value
  const previous = item.previous?.value
  if (typeof current !== 'number' || typeof previous !== 'number' || previous === 0) return null

  const delta = current - previous
  if (Math.abs(delta) < 0.01) return { label: 'igual sem. passada', color: c.ink2 }

  const good = item.positiveIsGood === null ? null : item.positiveIsGood ? delta > 0 : delta < 0
  const arrow = delta > 0 ? '↑' : '↓'
  const color = good === null ? c.ink2 : good ? c.moss : c.recRed

  if (item.trendMode === 'relative') {
    return {
      label: `${arrow} ${Math.abs((delta / previous) * 100).toFixed(0)}% vs sem.`,
      color,
    }
  }

  return {
    label: `${arrow} ${formatDelta(Math.abs(delta), item.value.unit)} vs sem.`,
    color,
  }
}

function formatMetric(value: MetricValue): string {
  if (value.text?.trim()) return value.text.trim()
  if (typeof value.value !== 'number') return 'Sem dado'

  if (value.unit === '/5') return `${Math.round(value.value)} / 5`
  if (value.unit === 's') return formatDuration(value.value)
  if (value.unit === 'h') return formatHours(value.value)

  const formatted = Math.abs(value.value) >= 100
    ? Math.round(value.value).toLocaleString('pt-BR')
    : Number.isInteger(value.value)
      ? String(value.value)
      : value.value.toFixed(1).replace('.', ',')

  const unit = cleanUnit(value.unit)
  return unit ? `${formatted}${unit}` : formatted
}

function formatDelta(value: number, unit?: string | null): string {
  if (unit === 's') return formatDuration(value)
  if (unit === 'h') return formatHours(value)
  const formatted = Math.abs(value) >= 10
    ? Math.round(value).toLocaleString('pt-BR')
    : value.toFixed(1).replace('.', ',')
  const clean = cleanUnit(unit)
  return clean ? `${formatted}${clean}` : formatted
}

function cleanUnit(unit?: string | null): string {
  if (!unit || unit === 'count' || unit === 'objects') return ''
  if (unit === 'beats') return ' bat.'
  if (unit === 'bpm') return ' bpm'
  if (unit === 'resp/min') return ' resp/min'
  if (unit === 'count/min') return ' /min'
  if (unit === 'ms') return 'ms'
  if (unit === 'min') return 'min'
  if (unit === 'h') return 'h'
  if (unit === 's') return 's'
  if (unit === 'kcal' || unit === 'Cal') return ' kcal'
  if (unit === '%' || unit === 'percent') return '%'
  if (unit === '/5') return ' / 5'
  return ` ${unit}`
}

function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h${String(m).padStart(2, '0')}`
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  return `${hours}h${String(minutes % 60).padStart(2, '0')}`
}

function checkinStateLabel(state: string): string {
  switch (state) {
    case 'focused': return 'Em foco'
    case 'disperse': return 'Disperso'
    case 'blocked': return 'Bloqueado'
    case 'pause': return 'Pausa'
    default: return state
  }
}

function healthKitStatusText(available: boolean, enabled: boolean): string {
  if (enabled) return 'HealthKit ativo'
  if (available) return 'Aguardando permissão'
  return 'Indisponível neste runtime'
}

function queuedToSignal(signal: QueuedPassiveSignal): HealthSignal {
  return {
    id: `local:${signal.client_id}`,
    client_id: signal.client_id,
    source: signal.source,
    signal_type: signal.signal_type,
    value_numeric: signal.value_numeric ?? null,
    value_text: signal.value_text ?? null,
    unit: signal.unit ?? null,
    started_at: signal.started_at,
    ended_at: signal.ended_at ?? null,
    recorded_timezone: signal.recorded_timezone,
    metadata: signal.metadata ?? {},
  }
}

function mergeSignals(signals: HealthSignal[]): HealthSignal[] {
  const byClientId = new Map<string, HealthSignal>()
  for (const signal of signals) {
    const existing = byClientId.get(signal.client_id)
    if (!existing || new Date(signal.started_at).getTime() >= new Date(existing.started_at).getTime()) {
      byClientId.set(signal.client_id, signal)
    }
  }

  return [...byClientId.values()].sort((a, b) => (
    new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  ))
}

function signalEndTime(signal: HealthSignal): number {
  return new Date(signal.ended_at ?? signal.started_at).getTime()
}

function previousWeekRange(): { start: Date; end: Date } {
  const today = startOfLocalDay(new Date())
  const start = new Date(today)
  start.setDate(today.getDate() - 14)
  const end = new Date(today)
  end.setDate(today.getDate() - 7)
  end.setMilliseconds(-1)
  return { start, end }
}

function groupedNumericSignalsByDay(
  signals: HealthSignal[],
  signalTypes: string[],
  start: Date,
  end: Date,
): Map<string, HealthSignal[]> {
  const byDay = new Map<string, HealthSignal[]>()

  for (const signal of signals) {
    const time = new Date(signal.started_at).getTime()
    if (
      !signalTypes.includes(signal.signal_type)
      || typeof signal.value_numeric !== 'number'
      || time < start.getTime()
      || time >= end.getTime()
    ) {
      continue
    }

    const key = localDateKeyFromIso(signal.started_at)
    byDay.set(key, [...(byDay.get(key) ?? []), signal])
  }

  return byDay
}

function localDateKeyFromIso(iso: string): string {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfLocalDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function hasValue(value: MetricValue): boolean {
  return typeof value.value === 'number' || Boolean(value.text?.trim())
}

function ratio(current?: number | null, previous?: number | null): number | null {
  if (typeof current !== 'number' || typeof previous !== 'number' || previous === 0) return null
  return current / previous
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function average(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0) / values.length
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

const styles = StyleSheet.create({
  header: { marginBottom: 24 },
  tileGrid: {
    gap: 12,
  },
  tileRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryPanel: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  summaryLine: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryValue: {
    flexShrink: 1,
    maxWidth: '58%',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 13,
  },
  list: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  metricRow: {
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  factorRow: {
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  metricText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  metricValue: {
    alignItems: 'flex-end',
    gap: 4,
    maxWidth: 150,
  },
  syncPanel: {
    marginTop: 28,
    marginBottom: 18,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
