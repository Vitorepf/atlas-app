import { useMemo, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { SectionHeader } from '../components/SectionHeader'
import { Tile } from '../components/Tile'
import { PrimaryButton } from '../components/PrimaryButton'
import { Masthead, EditorialDateline } from '../components/editorial'
import { PressableTextScale } from '../components/atlas-ui/PressableScale'
import { editorialDateLine } from '../lib/folio'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette, useTheme } from '../design/theme'
import {
  formatRelativeSync,
  latestCheckin,
  useAtlasStore,
  visibleDigitalActivitySnapshots,
  visibleDigitalSessions,
  visibleHealthSnapshots,
  type QueuedPassiveSignal,
} from '../lib/atlasStore'
import type { AtlasCheckin, AtlasDigitalActivitySnapshot, AtlasDigitalSession, AtlasHealthSnapshot, AtlasPassiveSignal } from '../lib/api/client'
import {
  buildReadinessV1,
  type DayStrain,
  type LoadComponent,
  type NightRecoveryComponent,
  type ReadinessAxisKey,
  type ReadinessAxisQuality,
  type ReadinessFactor,
  type ReadinessScore,
  type ReadinessV1Model,
} from '../lib/readiness'
import { sleepDeficitHours, type SleepTargetEvidence } from '../lib/sleepTarget'
import { isMainSleepCandidate } from '../lib/sleepValidity'
import {
  checkinLevelFreshness,
  checkinStateFreshness,
  isCheckinLevelFresh,
  isCheckinStateFresh,
} from '../lib/checkinFreshness'
import { moodLevelLabel } from '../lib/checkinScale'
import type { ScreenTimeLocalStatus } from '../lib/screenTime'
import {
  buildAtlasPhysiologicalAge,
  type AtlasPhysiologicalAgeModel,
  type PhysiologicalAgeReading,
} from '../lib/physiologicalAge'

type HealthSignal = Pick<
  AtlasPassiveSignal,
  'id' | 'client_id' | 'source' | 'signal_type' | 'value_numeric' | 'value_text' | 'unit' | 'started_at' | 'ended_at' | 'recorded_timezone' | 'metadata'
>

type TrendMode = 'absolute' | 'relative'

const PHYSIOLOGICAL_FRESHNESS_HOURS = 36
const SLEEP_RECOVERY_FRESHNESS_HOURS = 48
const STATE_OF_MIND_FRESHNESS_HOURS = 24

type ManualBodyMetricKey = 'height' | 'waist_circumference'

const MANUAL_BODY_METRICS: Record<ManualBodyMetricKey, {
  label: string
  signalType: ManualBodyMetricKey
  unit: string
  min: number
  max: number
  placeholder: string
}> = {
  height: {
    label: 'Altura',
    signalType: 'height',
    unit: 'm',
    min: 0.5,
    max: 2.5,
    placeholder: '1,75',
  },
  waist_circumference: {
    label: 'Cintura',
    signalType: 'waist_circumference',
    unit: 'cm',
    min: 30,
    max: 250,
    placeholder: '82',
  },
}

interface MetricValue {
  value: number | null
  text?: string | null
  unit?: string | null
  date?: string | null
  confidence?: number | null
  qualityLabel?: string | null
  source?: string | null
}

interface MetricRowModel {
  label: string
  value: MetricValue
  previous?: MetricValue | null
  trendMode?: TrendMode
  positiveIsGood?: boolean | null
  detail?: MetricDetail | null
  reference?: string | null
  comparisonLabel?: string | null
}

interface MetricDetail {
  category: string
  what: string
  why: string
  inputs: string[]
  source: string
  freshness: string
  quality: string
  precision: string
  caveats: string[]
  evidence?: string[]
  confidence?: number | null
  axisQuality?: ReadinessAxisQuality | null
}

interface MetricGroupModel {
  label: string
  caption: string
  rows: MetricRowModel[]
}

type DigitalMetricKey =
  | 'total_screen_time_min'
  | 'pickups_count'
  | 'first_offensive_use_min_after_wake'
  | 'deep_work_total_min'
  | 'deep_work_sessions_count'
  | 'notifications_received'
  | 'notifications_actioned'
  | 'curated_input_min'
  | 'algorithmic_input_min'
  | 'intentional_entertainment_min'
  | 'default_entertainment_min'
  | 'communication_primary_min'
  | 'communication_shallow_min'
  | 'market_min'

const DIGITAL_CATEGORY_METRIC_KEYS: DigitalMetricKey[] = [
  'deep_work_total_min',
  'deep_work_sessions_count',
  'curated_input_min',
  'algorithmic_input_min',
  'intentional_entertainment_min',
  'default_entertainment_min',
  'communication_primary_min',
  'communication_shallow_min',
  'market_min',
]

const DIGITAL_UNSUPPORTED_RIZE_KEYS: DigitalMetricKey[] = [
  'pickups_count',
  'first_offensive_use_min_after_wake',
  'notifications_received',
  'notifications_actioned',
]

const DIGITAL_OFFENSIVE_CLASSES = new Set([4, 6, 8, 9])

type HealthSnapshotMetricKey =
  | 'sleep_duration_hours'
  | 'sleep_efficiency'
  | 'hrv_ms'
  | 'resting_heart_rate_bpm'
  | 'respiratory_rate'
  | 'wrist_temperature_c'
  | 'active_energy_kcal'
  | 'basal_energy_kcal'
  | 'exercise_minutes'
  | 'stand_minutes'
  | 'steps'
  | 'walking_running_distance_m'
  | 'vo2max'
  | 'body_mass_kg'
  | 'body_fat_percentage'
  | 'lean_body_mass_kg'
  | 'muscle_mass_percentage'
  | 'body_mass_index'
  | 'waist_circumference_cm'

export default function HealthScreen() {
  const c = usePalette()
  const router = useRouter()
  const [selectedMetric, setSelectedMetric] = useState<MetricRowModel | null>(null)
  const [manualMetric, setManualMetric] = useState<ManualBodyMetricKey | null>(null)
  const [manualValue, setManualValue] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)
  const [manualSaving, setManualSaving] = useState(false)
  const passiveSignals = useAtlasStore((s) => s.passiveSignals)
  const queuedPassiveSignals = useAtlasStore((s) => s.queuedPassiveSignals)
  const healthSnapshots = useAtlasStore((s) => s.healthSnapshots)
  const queuedHealthSnapshots = useAtlasStore((s) => s.queuedHealthSnapshots)
  const storedDigitalSessions = useAtlasStore((s) => s.digitalSessions)
  const queuedDigitalSessions = useAtlasStore((s) => s.queuedDigitalSessions)
  const storedDigitalActivitySnapshots = useAtlasStore((s) => s.digitalActivitySnapshots)
  const queuedDigitalActivitySnapshots = useAtlasStore((s) => s.queuedDigitalActivitySnapshots)
  const checkins = useAtlasStore((s) => s.checkins)
  const queuedCheckins = useAtlasStore((s) => s.queuedCheckins)
  const healthKit = useAtlasStore((s) => s.healthKit)
  const screenTime = useAtlasStore((s) => s.screenTime)
  const sync = useAtlasStore((s) => s.sync)
  const syncing = useAtlasStore((s) => s.syncing)
  const createPassiveSignal = useAtlasStore((s) => s.createPassiveSignal)

  const allSignals = useMemo(() => (
    mergeSignals([
      ...passiveSignals,
      ...queuedPassiveSignals.map(queuedToSignal),
    ])
  ), [passiveSignals, queuedPassiveSignals])

  const healthSignals = useMemo(() => (
    allSignals.filter((signal) => signal.source === 'healthkit')
  ), [allSignals])

  const compositionSignals = useMemo(() => (
    allSignals.filter((signal) => signal.source === 'healthkit' || signal.source === 'manual')
  ), [allSignals])

  const latestState = useMemo(
    () => latestCheckin({ checkins, queuedCheckins }),
    [checkins, queuedCheckins],
  )

  const digitalActivitySnapshots = useMemo(
    () => visibleDigitalActivitySnapshots({
      digitalActivitySnapshots: storedDigitalActivitySnapshots,
      queuedDigitalActivitySnapshots,
    }),
    [queuedDigitalActivitySnapshots, storedDigitalActivitySnapshots],
  )
  const digitalSessions = useMemo(
    () => visibleDigitalSessions({
      digitalSessions: storedDigitalSessions,
      queuedDigitalSessions,
    }),
    [queuedDigitalSessions, storedDigitalSessions],
  )

  const visibleSnapshots = useMemo(
    () => visibleHealthSnapshots({ healthSnapshots, queuedHealthSnapshots }),
    [healthSnapshots, queuedHealthSnapshots],
  )

  const model = useMemo(
    () => buildHealthModel(allSignals, healthSignals, compositionSignals, visibleSnapshots, digitalActivitySnapshots, digitalSessions, checkins, latestState, screenTime),
    [allSignals, checkins, compositionSignals, digitalActivitySnapshots, digitalSessions, healthSignals, latestState, screenTime, visibleSnapshots],
  )

  const openManualMetric = (metric: ManualBodyMetricKey, current: MetricValue): void => {
    const config = MANUAL_BODY_METRICS[metric]
    setManualMetric(metric)
    setManualError(null)
    setManualValue(typeof current.value === 'number' ? manualDisplayValue(current.value, config.unit) : '')
  }

  const closeManualMetric = (): void => {
    if (manualSaving) return
    setManualMetric(null)
    setManualValue('')
    setManualError(null)
  }

  const submitManualMetric = async (): Promise<void> => {
    if (!manualMetric) return
    const config = MANUAL_BODY_METRICS[manualMetric]
    const parsed = parseManualBodyValue(manualValue, config)
    if (parsed === null) {
      setManualError(`Informe ${config.label.toLowerCase()} entre ${manualDisplayValue(config.min, config.unit)} e ${manualDisplayValue(config.max, config.unit)}.`)
      return
    }

    setManualSaving(true)
    setManualError(null)
    try {
      await createPassiveSignal({
        source: 'manual',
        signalType: config.signalType,
        valueNumeric: parsed,
        unit: config.unit,
        metadata: {
          manual: {
            kind: 'body_composition',
            metric: config.signalType,
            source: 'operator_entry',
            version: 'body_manual_v1',
          },
        },
      })
      closeManualMetric()
    } catch (error) {
      setManualError(error instanceof Error ? error.message : 'Não foi possível registrar a medida.')
    } finally {
      setManualSaving(false)
    }
  }

  return (
    <Screen>
      {/* Masthead canon · SAÚDE + dateline healthkit signature. */}
      <PressableTextScale onPress={() => router.replace('/edicao')} hitSlop={8} accessibilityLabel="voltar para edição">
        <Masthead title="SAÚDE" folio={null} />
      </PressableTextScale>
      <EditorialDateline
        date={editorialDateLine()}
        edition={`${healthKitStatusText(healthKit.available, healthKit.enabled)} · ${healthSignals.length} sinais · ${visibleSnapshots.length} snapshots`}
      />

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
        <SummaryLine label="Qualidade dos dados" value={model.readinessV1.confidence.label} last />
        {healthKit.lastError ? (
          <Sans size={12} lineHeight={17} color={c.recRed} style={{ marginTop: 12 }}>
            {healthKit.lastError}
          </Sans>
        ) : null}
      </View>

      {model.readinessV1.factors.length > 0 ? (
        <>
          <SectionHeader label="Por que" />
          <FactorList factors={model.readinessV1.factors} />
        </>
      ) : null}

      <SectionHeader label="Eixos calculados" />
      <MetricList
        rows={model.scoreRows}
        onRowLongPress={(item) => {
          if (item.detail) setSelectedMetric(item)
        }}
      />

      <SectionHeader label="Sono" />
      <MetricList
        rows={model.sleepRows}
        onRowPress={(item) => {
          if (item.label === 'Duração') router.push('/sleep')
        }}
        onRowLongPress={(item) => {
          if (item.detail) setSelectedMetric(item)
        }}
      />

      <SectionHeader label="Recuperação" />
      <MetricList
        rows={model.recoveryRows}
        onRowLongPress={(item) => {
          if (item.detail) setSelectedMetric(item)
        }}
      />

      <SectionHeader label="Carga" />
      <MetricList
        rows={model.loadRows}
        onRowLongPress={(item) => {
          if (item.detail) setSelectedMetric(item)
        }}
      />

      <SectionHeader label="Atividade digital" />
      <MetricList
        rows={model.digitalRows}
        onRowLongPress={(item) => {
          if (item.detail) setSelectedMetric(item)
        }}
      />

      <SectionHeader label="Check-in" />
      <MetricList rows={model.subjectiveRows} />

      <SectionHeader label="Healthspan Atlas" />
      <MetricList
        rows={model.healthspanRows}
        onRowLongPress={(item) => {
          if (item.detail) setSelectedMetric(item)
        }}
      />

      <SectionHeader label="Composição corporal" />
      <BodyMetricGroups
        rows={model.bodyRows}
        onRowPress={(item) => {
          const metric = editableBodyMetricKey(item)
          if (metric) openManualMetric(metric, item.value)
        }}
        canPressRow={(item) => editableBodyMetricKey(item) !== null}
        onRowLongPress={(item) => {
          if (item.detail) setSelectedMetric(item)
        }}
      />

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
      <MetricDetailSheet
        item={selectedMetric}
        onClose={() => setSelectedMetric(null)}
      />
      <ManualBodyMetricModal
        metric={manualMetric}
        value={manualValue}
        error={manualError}
        saving={manualSaving}
        onChangeValue={setManualValue}
        onSubmit={() => {
          void submitManualMetric()
        }}
        onClose={closeManualMetric}
      />
    </Screen>
  )
}

function buildHealthModel(
  allSignals: HealthSignal[],
  healthSignals: HealthSignal[],
  compositionSignals: HealthSignal[],
  healthSnapshots: AtlasHealthSnapshot[],
  digitalActivitySnapshots: AtlasDigitalActivitySnapshot[],
  digitalSessions: AtlasDigitalSession[],
  checkins: AtlasCheckin[],
  latestState: ReturnType<typeof latestCheckin>,
  screenTime: ScreenTimeLocalStatus,
) {
  const checkinsForReadiness = latestState ? [latestState, ...checkins] : checkins
  const liveReadinessV1 = buildReadinessV1({
    healthSignals,
    allSignals,
    digitalActivitySnapshots,
    latestCheckin: latestState,
    checkins: checkinsForReadiness,
  })
  const computedNow = new Date(liveReadinessV1.computedAt)
  const checkinLevelFreshnessValue = checkinLevelFreshness(latestState, computedNow)
  const checkinStateFreshnessValue = checkinStateFreshness(latestState, computedNow)
  const currentLevelState = isCheckinLevelFresh(latestState, computedNow) ? latestState : null
  const currentCheckinState = isCheckinStateFresh(latestState, computedNow) ? latestState : null
  const latestSnapshot = latestHealthSnapshot(healthSnapshots)
  const latestSleepSnapshot = latestSleepHealthSnapshot(healthSnapshots, computedNow)
  const readinessV1 = readinessFromSnapshot(latestSnapshot, liveReadinessV1)
  const sleepTargetBest = readinessV1.sleepTargetEvidence.bestRange
  const isTodaySnapshot = latestSnapshot
    ? snapshotDateKey(latestSnapshot.snapshot_date) === localDateKeyFromDate(new Date(liveReadinessV1.computedAt))
    : false
  const dynamicComputedAt = isTodaySnapshot ? liveReadinessV1.computedAt : readinessV1.computedAt
  const sleepNow = snapshotOrSignal(
    snapshotSleepMetric(latestSleepSnapshot, 'sleep_duration_hours', 'h'),
    latestSleepValue(healthSignals),
  )
  const hrvNow = nightWindowMetric(healthSignals, latestSleepSnapshot, ['hrv_ms'], 'ms')
  const sleepHeartRateNow = snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'sleep_hr_avg_bpm', 'bpm')
  const respiratoryNow = snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'sleep_respiratory_rate', 'resp/min')
  const wristTemperatureNow = snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'sleep_wrist_temperature_c', 'degC')
  const oxygenSaturationNow = snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'sleep_oxygen_saturation_percent', '%')
  const vo2maxNow = snapshotOrSignal(
    latestSnapshotMetric(latestSnapshot, 'vo2max', 'ml/(kg*min)'),
    latestValueWithMaxAge(healthSignals, ['vo2max'], 180 * 24),
  )
  const hrvNormal = previousSleepWindowMedian(healthSignals, healthSnapshots, ['hrv_ms'], 'ms')
  const sleepHeartRateNormal = previousSleepPayloadAverage(healthSnapshots, 'sleep_hr_avg_bpm', 'bpm')
  const respiratoryNormal = previousSleepPayloadAverage(healthSnapshots, 'sleep_respiratory_rate', 'resp/min')
  const wristTemperatureNormal = previousSleepPayloadAverage(healthSnapshots, 'sleep_wrist_temperature_c', 'degC')
  const oxygenSaturationNormal = previousSleepPayloadAverage(healthSnapshots, 'sleep_oxygen_saturation_percent', '%')

  const stepsToday = snapshotOrSignal(
    latestSnapshotMetric(latestSnapshot, 'steps', 'count'),
    dailySum(healthSignals, ['steps']),
  )
  const exerciseToday = snapshotOrSignal(
    latestSnapshotMetric(latestSnapshot, 'exercise_minutes', 'min'),
    dailySum(healthSignals, ['exercise_minutes']),
  )
  const activeEnergyToday = snapshotOrSignal(
    latestSnapshotMetric(latestSnapshot, 'active_energy_kcal', 'kcal'),
    dailySum(healthSignals, ['active_energy_kcal']),
  )
  const basalEnergyToday = snapshotOrSignal(
    latestSnapshotMetric(latestSnapshot, 'basal_energy_kcal', 'kcal'),
    dailySum(healthSignals, ['basal_energy_kcal']),
  )
  const totalEnergyToday = sumMetricValues(activeEnergyToday, basalEnergyToday, 'kcal')
  const standToday = snapshotOrSignal(
    latestSnapshotMetric(latestSnapshot, 'stand_minutes', 'min'),
    dailySum(healthSignals, ['stand_minutes']),
  )
  const distanceToday = snapshotOrSignal(
    latestSnapshotMetric(latestSnapshot, 'walking_running_distance_m', 'm'),
    dailySum(healthSignals, ['walking_running_distance', 'HKQuantityTypeIdentifierDistanceWalkingRunning']),
  )
  const workoutNow = latestValueWithMaxAge(healthSignals, ['workout'], 30)
  const workoutToday = dailySum(healthSignals, ['workout'])
  const cardioLoadToday = snapshotOrSignal(
    snapshotJsonMetric(latestSnapshot, 'load', 'workout_cardio_load', 'a.u.'),
    dailySum(healthSignals, ['workout_cardio_load']),
  )
  const wakingCardioLoadToday = snapshotOrSignal(
    snapshotJsonMetric(latestSnapshot, 'load', 'waking_cardio_load', 'a.u.'),
    dailySum(healthSignals, ['waking_cardio_load']),
  )
  const cardioStrainToday = snapshotOrSignal(
    snapshotJsonMetric(latestSnapshot, 'load', 'workout_cardio_strain', '%'),
    dailyMax(healthSignals, ['workout_cardio_strain']),
  )
  const wakingCardioStrainToday = snapshotOrSignal(
    snapshotJsonMetric(latestSnapshot, 'load', 'waking_cardio_strain', '%'),
    dailyMax(healthSignals, ['waking_cardio_strain']),
  )
  const workoutEffortToday = snapshotOrSignal(
    coalesceMetricValue(
      snapshotJsonMetric(latestSnapshot, 'load', 'workout_effort_score', 'appleEffortScore'),
      snapshotJsonMetric(latestSnapshot, 'load', 'estimated_workout_effort_score', 'appleEffortScore'),
    ),
    dailyMax(healthSignals, ['workout_effort_score', 'estimated_workout_effort_score']),
  )
  const strainToday: MetricValue = {
    value: readinessV1.dayStrain.value,
    unit: 'strain',
    date: dynamicComputedAt,
    confidence: readinessV1.dayStrain.confidence,
    qualityLabel: qualityStatusLabel(null, readinessV1.dayStrain.confidence),
  }
  const workoutHrAvgToday = snapshotOrSignal(
    snapshotJsonMetric(latestSnapshot, 'load', 'workout_hr_avg_bpm', 'bpm'),
    dailyMedian(healthSignals, ['workout_hr_avg_bpm']),
  )
  const workoutHrMaxToday = snapshotOrSignal(
    snapshotJsonMetric(latestSnapshot, 'load', 'workout_hr_max_bpm', 'bpm'),
    dailyMax(healthSignals, ['workout_hr_max_bpm']),
  )
  const wakingHrAvgToday = snapshotOrSignal(
    snapshotJsonMetric(latestSnapshot, 'load', 'waking_hr_avg_bpm', 'bpm'),
    dailyMedian(healthSignals, ['waking_hr_avg_bpm']),
  )
  const wakingHrMaxToday = snapshotOrSignal(
    snapshotJsonMetric(latestSnapshot, 'load', 'waking_hr_max_bpm', 'bpm'),
    dailyMax(healthSignals, ['waking_hr_max_bpm']),
  )
  const workoutZoneHighToday = snapshotOrSignal(
    sumMetricValues(
      snapshotJsonMetric(latestSnapshot, 'load', 'workout_hr_zone_4_min', 'min'),
      snapshotJsonMetric(latestSnapshot, 'load', 'workout_hr_zone_5_min', 'min'),
      'min',
    ),
    dailySum(healthSignals, ['workout_hr_zone_4_min', 'workout_hr_zone_5_min']),
  )
  const workoutZone2Today = snapshotOrSignal(
    snapshotJsonMetric(latestSnapshot, 'load', 'workout_hr_zone_2_min', 'min'),
    dailySum(healthSignals, ['workout_hr_zone_2_min']),
  )
  const workoutZone3Today = snapshotOrSignal(
    snapshotJsonMetric(latestSnapshot, 'load', 'workout_hr_zone_3_min', 'min'),
    dailySum(healthSignals, ['workout_hr_zone_3_min']),
  )
  const workoutZone1Today = snapshotOrSignal(
    snapshotJsonMetric(latestSnapshot, 'load', 'workout_hr_zone_1_min', 'min'),
    dailySum(healthSignals, ['workout_hr_zone_1_min']),
  )
  const wakingZoneHighToday = snapshotOrSignal(
    sumMetricValues(
      snapshotJsonMetric(latestSnapshot, 'load', 'waking_hr_zone_4_min', 'min'),
      snapshotJsonMetric(latestSnapshot, 'load', 'waking_hr_zone_5_min', 'min'),
      'min',
    ),
    dailySum(healthSignals, ['waking_hr_zone_4_min', 'waking_hr_zone_5_min']),
  )
  const mindfulToday = dailyDuration(healthSignals, ['HKCategoryTypeIdentifierMindfulSession'])

  const bodyMassNow = withMetricQuality(snapshotOrSignal(
    latestSnapshotMetric(latestSnapshot, 'body_mass_kg', 'kg'),
    latestValue(compositionSignals, ['body_mass']),
  ), bodyMetricQualityLabel(latestSnapshot, 'body_mass_source', 'medida'), 0.9)
  const bodyFatNow = withMetricQuality(snapshotOrSignal(
    latestSnapshotMetric(latestSnapshot, 'body_fat_percentage', '%'),
    normalizedPercentValue(latestValue(compositionSignals, ['body_fat_percentage'])),
  ), bodyMetricQualityLabel(latestSnapshot, 'body_fat_source', 'medida externa'), 0.72)
  const leanMassNow = withMetricQuality(snapshotOrSignal(
    latestSnapshotMetric(latestSnapshot, 'lean_body_mass_kg', 'kg'),
    leanMassMetric(bodyMassNow, bodyFatNow, latestValue(compositionSignals, ['lean_body_mass'])),
  ), bodyMetricQualityLabel(latestSnapshot, 'lean_mass_source', 'medida externa'), 0.74)
  const leanMassPercentNow = withMetricQuality(snapshotOrSignal(
    snapshotJsonMetric(latestSnapshot, 'body', 'lean_mass_percentage', '%'),
    leanMassPercentMetric(bodyMassNow, leanMassNow),
  ), 'derivada', 0.76)
  const heightNow = withMetricQuality(latestValue(compositionSignals, ['height']), 'estável', 0.95)
  const bmiNow = withMetricQuality(snapshotOrSignal(
    latestSnapshotMetric(latestSnapshot, 'body_mass_index', null),
    bmiMetric(bodyMassNow, heightNow, latestValue(compositionSignals, ['body_mass_index'])),
  ), bodyMetricQualityLabel(latestSnapshot, 'bmi_source', 'derivado'), 0.9)
  const waistNow = withMetricQuality(snapshotOrSignal(
    latestSnapshotMetric(latestSnapshot, 'waist_circumference_cm', 'cm'),
    latestValue(compositionSignals, ['waist_circumference']),
  ), bodyMetricQualityLabel(latestSnapshot, 'waist_source', 'manual'), 0.85)
  const fatMassNow = withMetricQuality(fatMassMetric(bodyMassNow, bodyFatNow), 'derivada', 0.78)
  const bmrNow = withMetricQuality(snapshotOrSignal(
    snapshotJsonMetric(latestSnapshot, 'body', 'basal_metabolic_rate_kcal', 'kcal'),
    basalMetabolicRateMetric({
      weight: bodyMassNow,
      height: heightNow,
      dateOfBirth: latestValue(healthSignals, ['date_of_birth']),
      biologicalSex: latestValue(healthSignals, ['biological_sex']),
    }),
  ), bodyMetricQualityLabel(latestSnapshot, 'bmr_source', 'estimada'), 0.68)
  const atlasPhysiologicalAge = buildAtlasPhysiologicalAge({
    signals: allSignals,
    snapshots: healthSnapshots,
    now: computedNow,
    current: {
      sleepScore: physiologicalReadingFromMetric(scoreMetric(readinessV1.sleep.score, readinessV1.computedAt), 'readiness_v1'),
      sleepRegularityScore: physiologicalReadingFromMetric(snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'regularity_score', '%'), 'sleep_snapshot'),
      vo2max: physiologicalReadingFromMetric(vo2maxNow, 'HealthKit'),
    },
  })
  const atlasPhysiologicalAgeNow = atlasPhysiologicalAgeMetric(atlasPhysiologicalAge)
  const sleepDebtToday = snapshotOrSignal(
    snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'sleep_debt_hours', 'h'),
    typeof sleepNow.value === 'number'
      ? { value: sleepDeficitHours(sleepNow.value, readinessV1.sleepTargetHours), unit: 'h', date: sleepNow.date ?? readinessV1.computedAt }
      : { value: null, unit: 'h' },
  )
  const inBedNow = snapshotSleepInBedMetric(latestSleepSnapshot)
  const sleepTargetInBedHours = readinessV1.sleepTargetHours / 0.9
  const remHoursReference = sleepStageReference(healthSnapshots, 'rem_hours', readinessV1.sleepTargetHours, 0.2, 0.25, 'hours')
  const remPercentReference = sleepStageReference(healthSnapshots, 'rem_hours', readinessV1.sleepTargetHours, 0.2, 0.25, 'percent')
  const deepHoursReference = sleepStageReference(healthSnapshots, 'deep_hours', readinessV1.sleepTargetHours, 0.13, 0.23, 'hours')
  const deepPercentReference = sleepStageReference(healthSnapshots, 'deep_hours', readinessV1.sleepTargetHours, 0.13, 0.23, 'percent')
  const coreHoursReference = sleepStageReference(healthSnapshots, 'core_hours', readinessV1.sleepTargetHours, 0.45, 0.55, 'hours')
  const corePercentReference = sleepStageReference(healthSnapshots, 'core_hours', readinessV1.sleepTargetHours, 0.45, 0.55, 'percent')
  const sleepRegularityNow = snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'regularity_score', '%')
  const sleepEfficiencyNow = snapshotSleepMetric(latestSleepSnapshot, 'sleep_efficiency', '%')
  const sleepContinuityNow = snapshotSleepContinuityMetric(latestSleepSnapshot)
  const digitalToday = latestDigitalSnapshot(digitalActivitySnapshots)
  const algorithmicPressureKeys: DigitalMetricKey[] = ['algorithmic_input_min', 'default_entertainment_min', 'communication_shallow_min']
  const intentionalDigitalKeys: DigitalMetricKey[] = ['deep_work_total_min', 'curated_input_min', 'intentional_entertainment_min', 'communication_primary_min']
  const algorithmicPressureToday = digitalSumMetric(digitalToday, algorithmicPressureKeys, 'duration')
  const algorithmicPressurePercentToday = digitalRatioMetric(digitalToday, algorithmicPressureKeys, 'total_screen_time_min')
  const intentionalityToday = digitalRatioMetric(digitalToday, intentionalDigitalKeys, 'total_screen_time_min')
  const deepWorkToday = latestDigitalMetric(digitalActivitySnapshots, 'deep_work_total_min', 'duration')
  const fragmentationToday = digitalFragmentationMetric(digitalToday)
  const firstOffensiveUse = firstOffensiveUseMetric({
    snapshot: digitalToday,
    sessions: digitalSessions,
    sleepSnapshot: latestSleepSnapshot,
    screenTime,
    now: computedNow,
  })
  const stateOfMindNow = latestValueWithMaxAge(healthSignals, ['state_of_mind_valence'], STATE_OF_MIND_FRESHNESS_HOURS)
  const overloadRisk = overloadRiskMetric({
    readiness: readinessV1,
    strain: strainToday,
    highZoneMinutes: sumMetricValues(workoutZoneHighToday, wakingZoneHighToday, 'min'),
    sleepDebt: { value: readinessV1.sleepDebtHours, unit: 'h', date: readinessV1.computedAt },
  })
  const cardiovascularEfficiency = cardiovascularEfficiencyMetric({
    wakingHrAvg: wakingHrAvgToday,
    workoutHrAvg: workoutHrAvgToday,
    steps: stepsToday,
    distance: distanceToday,
    activeEnergy: activeEnergyToday,
    cardioLoad: sumMetricValues(cardioLoadToday, wakingCardioLoadToday, 'a.u.'),
    vo2max: vo2maxNow,
  })
  const sleepStability = sleepStabilityMetric({
    sleepScore: scoreMetric(readinessV1.sleep.score, readinessV1.computedAt),
    regularity: sleepRegularityNow,
    efficiency: sleepEfficiencyNow,
    continuity: sleepContinuityNow,
    sleepDebt7d: { value: readinessV1.sleepDebtHours, unit: 'h', date: readinessV1.computedAt },
    observedNights: readinessV1.axisQuality.sleep.baselineDays ?? null,
  })
  const cognitivePressure = cognitivePressureMetric({
    algorithmicPressurePercent: algorithmicPressurePercentToday,
    fragmentation: fragmentationToday,
    firstOffensiveUse,
    intentionality: intentionalityToday,
    deepWork: deepWorkToday,
    cognitivePenalty: readinessV1.diagnostics.cognitivePenalty,
    computedAt: dynamicComputedAt,
  })
  const performanceWindow = performanceWindowMetric({
    readiness: readinessV1,
    overloadRisk,
    cognitivePressure,
    computedAt: dynamicComputedAt,
  })
  const paceOfAging = paceOfAgingMetric(healthSnapshots, atlasPhysiologicalAge)
  const metabolicProfile = metabolicProfileMetric({
    waist: waistNow,
    height: heightNow,
    bmi: bmiNow,
    bodyFat: bodyFatNow,
    leanMassPercent: leanMassPercentNow,
    biologicalSex: latestValue(healthSignals, ['biological_sex']),
    computedAt: dynamicComputedAt,
  })
  const bodyDataQuality = bodyCompositionQualityMetric({
    weight: bodyMassNow,
    bodyFat: bodyFatNow,
    leanMass: leanMassNow,
    waist: waistNow,
    height: heightNow,
    bmi: bmiNow,
    computedAt: dynamicComputedAt,
  })

  return {
    readinessV1,
    sleepNow,
    hrvNow,
    scoreRows: [
	      row('Prontidão do dia', scoreMetric(readinessV1.base.score, readinessV1.computedAt), null, 'absolute', true, axisDetail(readinessV1.base, 'Resultado principal', 'Resumo da capacidade do dia antes do dreno intra-dia.', 'Importa porque condensa recuperação, carga e estado percebido em uma decisão operacional simples.', ['Sono', 'Sinais de recuperação', 'Margem de carga', 'Estado percebido', 'Estabilidade fisiológica'], 'Snapshot diário quando disponível; no dia atual usa dados recalculados a partir do store local.', 'Sono 48h; fisiologia 36h; check-in 12h; digital 24h.', 'Boa quando sono + HRV/FC repouso + atividade + check-in recente estão presentes.', 'Média-alta para decisão diária; não é diagnóstico clínico.', ['Pode cair para baseline quando sinais críticos faltam.', 'Ainda é heurístico e precisa validação longitudinal por outcomes reais.'], readinessV1.axisQuality.base)),
	      row('Capacidade agora', scoreMetric(readinessV1.current.score, dynamicComputedAt), null, 'absolute', true, axisDetail(readinessV1.current, 'Resultado em tempo real', 'Estimativa de capacidade neste momento, ajustada por dreno do dia e penalidade cognitiva.', 'Importa porque separa o que você acordou podendo fazer do que ainda consegue fazer agora.', ['Prontidão do dia', 'Dreno do dia', 'Horas acordado', 'Estado percebido', 'Pressão digital'], 'Sempre cálculo vivo no dia atual; snapshot não congela este eixo.', 'Carga e digital do dia; sono até 48h; check-in de estado até 6h.', 'Boa quando HealthKit sincronizou hoje e existe check-in/digital recente.', 'Média; é propositalmente mais volátil que prontidão.', ['Pode oscilar ao longo do dia.', 'Não deve ser comparada isoladamente com média semanal.'], readinessV1.axisQuality.current)),
	      row('Janela de alta performance', performanceWindow, null, 'absolute', true, compositeMetricDetail('Decisão', 'Leitura de oportunidade para trabalho profundo, treino forte ou execução crítica agora.', 'Combina capacidade atual com risco de sobrecarga e pressão cognitiva para não recomendar intensidade quando o custo está alto.', ['Capacidade agora', 'Capacidade de foco', 'Recuperação corporal', 'Margem de carga', 'Risco de sobrecarga', 'Pressão cognitiva líquida'], 'Cálculo vivo a partir dos scores já auditados no readiness e das métricas compostas novas.', 'Atualiza no dia atual conforme saúde, carga, check-in e digital mudam.', 'Boa quando há sono, carga e digital recentes; parcial quando a fonte digital ou check-in faltam.', 'Média-alta para decisão operacional; não mede performance real concluída.', ['Pode ficar conservadora quando dados de carga ou digital estão parciais.', 'Não substitui contexto de calendário, dor, doença ou prioridade estratégica.'], compositeMetricEvidence(['Capacidade agora', scoreMetric(readinessV1.current.score, dynamicComputedAt)], ['Foco', scoreMetric(readinessV1.focus.score, dynamicComputedAt)], ['Risco de sobrecarga', overloadRisk], ['Pressão cognitiva', cognitivePressure]), performanceWindow.confidence), '>= 75%'),
	      row('Recuperação noturna', scoreMetric(readinessV1.nightRecovery.score, readinessV1.computedAt), null, 'absolute', true, nightRecoveryDetail(readinessV1), 'ideal >= 85%'),
      row('Recuperação corporal', scoreMetric(readinessV1.body.score, readinessV1.computedAt), null, 'absolute', true, axisDetail(readinessV1.body, 'Eixo composto', 'Estado físico de recuperação, combinando sono, sinais autonômicos, carga e estabilidade.', 'Importa para decidir treino, esforço físico e volume de execução.', ['Sono', 'Sinais de recuperação', 'Margem de carga', 'Estabilidade fisiológica'], 'Snapshot diário com fallback vivo quando necessário.', 'Sono 48h; fisiologia 36h; carga do dia.', 'Alta quando Apple Watch coletou sono, HRV, FC repouso e atividade recentes.', 'Média-alta para recuperação física operacional.', ['Não inclui dor muscular ou percepção direta de fadiga muscular.', 'Composição corporal e VO2max aparecem em detalhes, mas não movem este eixo diário.'], readinessV1.axisQuality.body)),
      row('Clareza mental', scoreMetric(readinessV1.mind.score, readinessV1.computedAt), null, 'absolute', true, axisDetail(readinessV1.mind, 'Eixo mental', 'Capacidade cognitiva estimada a partir de estado percebido, sono, recuperação e sinais digitais.', 'Importa para escolher trabalho profundo, decisões difíceis e exposição a estímulos.', ['Estado percebido', 'Sono', 'Sinais de recuperação', 'Deep work', 'Pressão algorítmica', 'Fragmentação digital'], 'Cálculo local com digital snapshot quando existe para o dia.', 'Digital 24h; check-in 12h; fisiologia 36h.', 'Boa quando há check-in e snapshot digital recente; parcial sem Rize/digital.', 'Média; melhora com histórico de produtividade real.', ['Ainda não aprende pesos pessoais automaticamente.', 'Minutos de foco não provam clareza, apenas ajudam como evidência.'], readinessV1.axisQuality.mind)),
      row('Energia de execução', scoreMetric(readinessV1.drive.score, readinessV1.computedAt), null, 'absolute', true, axisDetail(readinessV1.drive, 'Eixo de impulso', 'Energia prática para iniciar e sustentar ação hoje.', 'Importa porque um corpo recuperado ainda pode ter baixa tração para executar.', ['Energia do check-in', 'Estado atual', 'Margem de carga', 'Sono'], 'Cálculo vivo com expiração agressiva do check-in.', 'Energia/humor até 12h; estado atual até 6h; sono até 48h.', 'Boa se o check-in foi feito recentemente; baixa sem check-in.', 'Média-baixa sem hábito consistente de check-in.', ['Não deve ser lida como motivação fixa.', 'Check-in antigo expira em vez de continuar empurrando o score.'], readinessV1.axisQuality.drive)),
      row('Capacidade de foco', scoreMetric(readinessV1.focus.score, dynamicComputedAt), null, 'absolute', true, axisDetail(readinessV1.focus, 'Eixo de foco', 'Probabilidade operacional de sustentar foco agora.', 'Importa para decidir se vale abrir bloco profundo ou fazer trabalho leve.', ['Estado atual', 'Energia', 'Sono', 'Deep work', 'Intencionalidade digital', 'Pressão algorítmica', 'Fragmentação'], 'No dia atual usa cálculo vivo e digital snapshot recente.', 'Digital 24h; estado 6h; energia 12h; sono 48h.', 'Boa com Rize/digital + check-in; parcial só com saúde.', 'Média; forte para rotina pessoal depois de validação.', ['Muito foco já feito pode indicar fadiga, não só capacidade.', 'Ainda precisa aprender seus horários e padrões pessoais.'], readinessV1.axisQuality.focus)),
      row('Sono', scoreMetric(readinessV1.sleep.score, readinessV1.computedAt), null, 'absolute', true, axisDetail(readinessV1.sleep, 'Driver fisiológico', 'Qualidade operacional da última noite válida.', 'Importa porque sono é o maior driver individual de recuperação e foco.', ['Duração', 'Déficit observado 7d', 'Consistência', 'Eficiência', 'REM + profundo'], 'Modelo único compartilhado entre Estado Físico e tela Sono.', 'Última noite precisa ter acordado há até 48h.', 'Alta com estágios do Apple Watch; média quando só há duração.', 'Alta para duração; média para arquitetura.', ['Déficit 7d é observado apenas sobre noites disponíveis.', 'Arquitetura ainda é heurística, não polissonografia.'], readinessV1.axisQuality.sleep)),
      row('Sinais de recuperação', scoreMetric(readinessV1.autonomic.score, readinessV1.computedAt), null, 'absolute', true, axisDetail(readinessV1.autonomic, 'Driver fisiológico', 'Recuperação autonômica comparada ao seu baseline.', 'Importa porque HRV, FC repouso e respiração capturam estresse fisiológico antes de você perceber.', ['HRV', 'FC repouso', 'Respiração', 'Baseline de até 28 dias'], 'Só calcula quando existe baseline suficiente; sem baseline vira sem dado.', 'Sinais fisiológicos expiram em 36h.', 'Alta quando há pelo menos 3 dias úteis de baseline por sinal.', 'Média-alta para tendência pessoal; não é diagnóstico.', ['Não usa fallback neutro quando falta baseline.', 'Pode ficar indisponível após falhas de sync ou noites sem relógio.'], readinessV1.axisQuality.autonomic)),
      row('Margem de carga', scoreMetric(readinessV1.load.score, dynamicComputedAt), null, 'absolute', true, axisDetail(readinessV1.load, 'Driver de esforço', 'Quanto espaço ainda existe para carga hoje sem exceder seu padrão recente.', 'Importa para não confundir atividade alta com recuperação alta.', ['Carga cardiovascular por zonas de FC', 'Energia ativa', 'Exercício', 'Passos', 'Distância', 'Treino recente'], 'No dia atual usa cálculo vivo; score alto significa margem alta, não carga alta.', 'Atividade do dia; treino recente até 30h; zonas de FC por treino quando disponíveis.', 'Boa com Apple Watch registrando FC durante treino; parcial quando só há atividade cotidiana.', 'Média-alta para carga operacional quando há zonas de FC; média sem treino com FC.', ['Zonas usam FC máxima estimada por idade quando disponível.', 'Rotinas muito concentradas pela manhã ainda podem distorcer a curva esperada.'], readinessV1.axisQuality.load)),
      row('Estado percebido', scoreMetric(readinessV1.subjective.score, readinessV1.computedAt), null, 'absolute', true, axisDetail(readinessV1.subjective, 'Driver subjetivo', 'Como você declarou estar, com apoio opcional de registros emocionais do Saúde quando já existirem.', 'Importa porque fisiologia não captura tudo: percepção, humor e energia mudam decisões.', ['Energia do check-in', 'Humor do check-in', 'Estado atual', 'Registro emocional opcional'], 'Cálculo vivo com decay para neutro quando o check-in envelhece.', 'Energia/humor até 12h; estado atual até 6h.', 'Alta com check-in recente; parcial sem check-in.', 'Média-baixa sem consistência de registro.', ['É autorrelato, não sensor.', 'Check-in antigo não deve ser usado como verdade atual.', 'O registro emocional externo é opcional e não é necessário para usar o Atlas.'], readinessV1.axisQuality.subjective)),
      row('Estabilidade fisiológica', scoreMetric(readinessV1.stability.score, readinessV1.computedAt), null, 'absolute', true, axisDetail(readinessV1.stability, 'Driver de alerta', 'Sinais de desvio fisiológico que pedem observação.', 'Importa para detectar instabilidade que pode vir de doença, estresse, álcool, calor ou noite ruim.', ['Temperatura de pulso', 'Respiração', 'Oxigênio'], 'Snapshot diário ou cálculo local quando há dados recentes.', 'Fisiologia 36h; temperatura de pulso depende de noites com Apple Watch.', 'Média; boa como alerta, não como diagnóstico.', 'Média para triagem de tendência.', ['Temperatura de pulso costuma ser noturna, não contínua no dia.', 'Oxigênio pode não estar disponível dependendo de região/aparelho.'], readinessV1.axisQuality.stability)),
      row('Qualidade dos dados', scoreMetric(readinessV1.confidence.value, dynamicComputedAt), null, 'absolute', true, axisDetail({ score: readinessV1.confidence.value, confidence: readinessV1.confidence.value / 100, label: readinessV1.confidence.label, display: readinessV1.confidence.label }, 'Metadado do modelo', 'Cobertura e frescor dos sinais usados pelo readiness.', 'Importa porque score sem dados suficientes não deve ser tratado como verdade.', ['Cobertura dos eixos', 'Frescor', 'Baseline disponível', 'Presença de check-in/digital'], 'Cálculo vivo no dia atual; snapshots antigos são apenas histórico.', 'Agrega TTLs por fonte: sono, fisiologia, check-in e digital.', 'Alta para medir cobertura; não mede verdade clínica.', 'Alta para qualidade operacional dos dados.', ['Não é métrica de saúde.', 'Mostra confiabilidade operacional, não prova causalidade.'], readinessV1.axisQuality.dataQuality)),
    ],
	    sleepRows: [
	      row('Score do sono', scoreMetric(readinessV1.sleep.score, readinessV1.computedAt), null, 'absolute', true, axisDetail(readinessV1.sleep, 'Sono', 'Score operacional da última noite principal, separado de cochilos.', 'Importa porque resume quantidade, regularidade, continuidade, fases e qualidade do dado em uma leitura rápida.', ['Duração', 'Déficit 7d', 'Regularidade', 'Eficiência', 'REM + profundo', 'Latência', 'Despertares'], 'Analisador único de sono usado por snapshot, readiness e tela Sono.', 'Última noite válida até 48h.', 'Alta com estágios do Apple Watch; parcial quando só existe duração.', 'Alta para duração; média para fases e despertares.', ['Não é polissonografia.', 'Cochilos entram separados e não inflam a noite principal.'], readinessV1.axisQuality.sleep), 'ideal >= 85%'),
	      row('Estabilidade do sono', sleepStability, null, 'absolute', true, compositeMetricDetail('Sono', 'Score composto de estabilidade: rotina, continuidade, eficiência e dívida recente.', 'Diferencia uma noite boa isolada de um padrão de sono realmente estável para performance.', ['Score do sono', 'Regularidade', 'Eficiência', 'Continuidade', 'Déficit observado 7d', 'Noites usadas'], 'Cálculo local sobre snapshot de sono e readiness_v1.', 'Última noite válida até 48h; déficit e regularidade usam histórico recente observado.', 'Boa com 5+ noites e estágios; parcial com poucas noites ou sem regularidade.', 'Alta para direção de rotina; fases e despertares continuam estimativas de wearable.', ['Não é diagnóstico de sono.', 'Não tenta preencher noites ausentes; cobertura baixa reduz confiança.'], compositeMetricEvidence(['Score', scoreMetric(readinessV1.sleep.score, readinessV1.computedAt)], ['Regularidade', sleepRegularityNow], ['Eficiência', sleepEfficiencyNow], ['Continuidade', sleepContinuityNow], ['Déficit 7d', { value: readinessV1.sleepDebtHours, unit: 'h', date: readinessV1.computedAt }]), sleepStability.confidence), '>= 85%'),
	      row('Duração', sleepNow, previousWeekSnapshotAverage(healthSnapshots, 'sleep_duration_hours', 'h') ?? previousWeekLatestByEnd(healthSignals, ['sleep_duration_hours']), 'absolute', true, sleepMetricDetail('Tempo dormido na noite principal.', 'É o maior driver simples de recuperação e déficit.', ['Estágios REM/core/profundo/asleep do Apple Watch', 'Fallback: duração de sono'], 'Boa quando há estágios; parcial com duração isolada.', 'Alta para tempo total quando a noite principal foi detectada.'), `alvo ${formatHours(readinessV1.sleepTargetHours)}`),
      row(sleepTargetRowLabel(readinessV1.sleepTargetEvidence), { value: readinessV1.sleepTargetHours, unit: 'h', date: readinessV1.computedAt }, null, 'absolute', true, sleepMetricDetail('Alvo pessoal inferido a partir do histórico disponível.', 'Evita tratar 7h30 como meta fixa universal; 7h30 é só mínimo quando não há evidência pessoal.', ['Noites recentes', 'Check-in', 'Foco/produtividade', 'Recuperação'], 'Boa quando há noites com resultado; baseline quando só há duração.', 'Média: melhora com mais noites e outcomes consistentes.')),
      row('Déficit da noite', sleepDebtToday, null, 'absolute', false, sleepMetricDetail('Diferença entre o alvo atual e o sono da última noite.', 'Mostra o quanto a noite ficou abaixo do necessário para você.', ['Duração da noite principal', 'Alvo de sono'], 'Boa quando duração e alvo estão disponíveis.', 'Alta para cálculo aritmético; depende da precisão do alvo.'), 'ideal 0min'),
      row('Déficit observado 7d', { value: readinessV1.sleepDebtHours, unit: 'h', date: readinessV1.computedAt }, null, 'absolute', false, sleepMetricDetail('Soma dos déficits das noites observadas nos últimos 7 dias.', 'Evita uma noite isolada esconder uma dívida acumulada.', ['Duração por noite principal', 'Alvo de sono'], 'Boa com 5+ noites; parcial com menos noites.', 'Média-alta; é observado, não inventa noites ausentes.'), 'ideal 0min'),
      row('Noites usadas', sleepObservedNightsMetric(readinessV1), null, 'absolute', true, sleepMetricDetail('Quantidade de noites recentes que entraram no cálculo.', 'Mostra se o score está bem sustentado por dados.', ['Snapshots de sono', 'Noites HealthKit'], 'Alta: mede cobertura de dados.', 'Alta para auditoria de cobertura.'), 'ideal 7/7'),
      row('Latência', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'latency_minutes', 'min'), null, 'absolute', false, sleepMetricDetail('Tempo estimado entre deitar/início de vigília e o primeiro sono real.', 'Latência alta costuma indicar estresse, estímulo tardio ou janela circadiana ruim.', ['In bed', 'Awake', 'Primeiro estágio dormindo'], 'Só aparece quando o Apple Watch entrega vigília/in bed antes do sono.', 'Média; depende da qualidade dos estágios iniciais.'), 'ideal <= 20min'),
      row('Despertares', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'awake_episode_count', 'vezes'), null, 'absolute', false, sleepMetricDetail('Número de blocos acordado depois do início do sono e antes do despertar final.', 'Captura fragmentação que a eficiência sozinha pode esconder.', ['Estágios awake entre sono inicial e final'], 'Boa quando há estágios detalhados; sem estágios vira sem dado.', 'Média; microdespertares curtos podem não ser capturados.'), 'ideal 0-1'),
      row('Distúrbios', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'disturbance_count', 'vezes'), null, 'absolute', false, sleepMetricDetail('Blocos breves de vigília detectados dentro do sono.', 'Aproxima a ideia de disturbance count: uma noite pode ter poucos despertares longos, mas muitas interrupções curtas.', ['Estágios awake após início do sono'], 'Boa quando há estágios awake detalhados.', 'Média; wearables podem subdetectar microdespertares.'), 'ideal <= 8'),
      row('Ciclos de sono', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'sleep_cycle_count', 'ciclos'), null, 'absolute', true, sleepMetricDetail('Quantidade aproximada de ciclos observados por episódios REM.', 'Ajuda interpretar se a noite completou arquitetura suficiente, especialmente quando foi curta.', ['Episódios REM', 'Janela principal'], 'Parcial: usa REM como marcador de ciclo.', 'Média-baixa para ciclo exato; útil como tendência.'), 'ideal 4-6'),
      row('Cochilos', snapshotSleepNapMetric(latestSleepSnapshot), null, 'absolute', null, sleepMetricDetail('Sono fora do episódio principal da noite.', 'Separa recuperação extra de cochilos para não distorcer duração, fases e déficit da noite.', ['Episódios de sono separados por lacunas longas'], 'Boa quando há horários/estágios; parcial com duração isolada.', 'Média-alta para separar noite vs cochilo.'), 'separado da noite'),
	      row('Eficiência', sleepEfficiencyNow, null, 'absolute', true, sleepMetricDetail('Percentual do tempo na cama que foi sono.', 'Mostra se a noite foi contínua ou teve vigília relevante.', ['Duração dormida', 'Na cama', 'Acordado'], 'Boa quando há estágio awake ou in bed.', 'Média-alta; depende de estágios do Watch.'), 'ideal >= 90%'),
      row('REM', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'rem_hours', 'h'), null, 'absolute', true, sleepMetricDetail('Tempo em sono REM na noite principal.', 'REM ajuda consolidação cognitiva e regulação emocional.', ['Estágio REM do Apple Watch', 'Duração total'], 'Parcial: fases por wearable são estimativas.', 'Média; use tendência, não um dia isolado.'), remHoursReference),
      row('REM %', snapshotSleepStagePercentMetric(latestSleepSnapshot, 'rem_hours'), null, 'absolute', true, sleepMetricDetail('Percentual da noite em REM.', 'Normaliza REM pela duração total da noite.', ['REM', 'Duração'], 'Parcial: depende da classificação de estágios.', 'Média para tendência.'), remPercentReference),
      row('Profundo', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'deep_hours', 'h'), null, 'absolute', true, sleepMetricDetail('Tempo em sono profundo na noite principal.', 'Sono profundo pesa para recuperação física e pressão homeostática.', ['Estágio deep do Apple Watch', 'Duração total'], 'Parcial: estimativa de wearable.', 'Média para tendência.'), deepHoursReference),
      row('Profundo %', snapshotSleepStagePercentMetric(latestSleepSnapshot, 'deep_hours'), null, 'absolute', true, sleepMetricDetail('Percentual da noite em sono profundo.', 'Evita comparar profundo absoluto entre noites curtas e longas.', ['Profundo', 'Duração'], 'Parcial: depende da classificação de estágios.', 'Média para tendência.'), deepPercentReference),
      row('Core', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'core_hours', 'h'), null, 'absolute', true, sleepMetricDetail('Tempo em sono core/leve.', 'É a maior parte normal da arquitetura e ajuda fechar a conta da noite.', ['Estágio core do Apple Watch'], 'Parcial: estimativa de wearable.', 'Média para tendência.'), coreHoursReference),
      row('Core %', snapshotSleepStagePercentMetric(latestSleepSnapshot, 'core_hours'), null, 'absolute', true, sleepMetricDetail('Percentual da noite em core/leve.', 'Ajuda detectar se REM/profundo estão comprimidos.', ['Core', 'Duração'], 'Parcial: depende da classificação de estágios.', 'Média para tendência.'), corePercentReference),
      row('Acordado', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'awake_hours', 'h'), null, 'absolute', false, sleepMetricDetail('Tempo acordado dentro da janela de sono principal.', 'Mostra vigília real durante a noite, não apenas quanto tempo você dormiu.', ['Estágio awake', 'Janela principal'], 'Boa quando o Watch marcou awake.', 'Média-alta para vigília detectada.'), `ideal <= ${formatHours(sleepTargetInBedHours * 0.1)}`),
      row('Vigília %', snapshotSleepAwakePercentMetric(latestSleepSnapshot), null, 'absolute', false, sleepMetricDetail('Percentual da janela na cama em vigília.', 'Compara fragmentação entre noites de tamanhos diferentes.', ['Acordado', 'Na cama'], 'Boa quando há awake e in bed/estágios.', 'Média-alta para tendência.'), 'ideal <= 10%'),
	      row('Continuidade', sleepContinuityNow, null, 'absolute', true, sleepMetricDetail('Complemento da vigília: quanto da janela foi contínua.', 'Facilita ver se a noite foi estável.', ['Vigília %'], 'Boa quando vigília foi medida.', 'Média-alta para tendência.'), 'ideal >= 90%'),
      row('Na cama', inBedNow, null, 'absolute', null, sleepMetricDetail('Tempo observado na janela principal de sono.', 'Ajuda separar oportunidade de sono de sono real.', ['In bed quando existe', 'Sono + awake', 'Janela de estágios'], 'Boa com in bed/awake; parcial quando inferido por estágios.', 'Média; não deve virar meta rígida.'), `ideal ~${formatHours(sleepTargetInBedHours)}`),
      row('FC sono média', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'sleep_hr_avg_bpm', 'bpm'), null, 'absolute', false, sleepMetricDetail('Frequência cardíaca média dentro da janela principal de sono.', 'É um sinal direto de carga fisiológica noturna; alto contra seu baseline costuma indicar estresse, álcool, calor, doença ou recuperação ruim.', ['Amostras de FC que caem dentro da janela de sono'], 'Agregado local; o app não persiste FC batimento a batimento.', 'Alta para tendência quando há amostras suficientes.'), 'ideal <= seu normal'),
      row('FC sono mínima', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'sleep_hr_min_bpm', 'bpm'), null, 'absolute', false, sleepMetricDetail('Menor FC observada durante o sono principal.', 'Ajuda ver se o corpo chegou a um estado de repouso profundo.', ['Amostras de FC no sono'], 'Agregado local sem salvar série bruta.', 'Média-alta; depende da frequência de amostragem do Apple Watch.'), 'ideal estável'),
      row('Amostras FC sono', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'sleep_hr_sample_count', 'count'), null, 'absolute', true, sleepMetricDetail('Quantidade de leituras usadas no agregado de FC do sono.', 'Mostra se a média noturna tem sustentação suficiente.', ['FC do Apple Watch dentro do sono'], 'Auditoria de cobertura; não é métrica de saúde.', 'Alta para qualidade do dado.'), 'ideal >= 3'),
      row('Respiração sono', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'sleep_respiratory_rate', 'resp/min'), null, 'absolute', false, sleepMetricDetail('Frequência respiratória observada na noite.', 'Desvios respiratórios podem indicar stress fisiológico, doença, álcool, calor ou má recuperação.', ['Respiração do Apple Health na data da noite'], 'Boa quando o Watch gravou respiração noturna.', 'Média-alta para tendência pessoal.'), 'ideal estável'),
      row('Oxigênio sono', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'sleep_oxygen_saturation_percent', '%'), null, 'absolute', true, sleepMetricDetail('Saturação de oxigênio associada à noite.', 'Ajuda contextualizar respiração e recuperação; quedas recorrentes merecem atenção.', ['SpO2 do Apple Health'], 'Parcial porque a amostragem pode ser irregular.', 'Média; não é diagnóstico médico.'), 'ideal >= 95%'),
      row('Temp. pulso sono', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'sleep_wrist_temperature_c', 'degC'), null, 'absolute', null, sleepMetricDetail('Temperatura de pulso medida no sono.', 'Desvios podem sinalizar doença, álcool, ciclo térmico, ambiente ou stress.', ['Temperatura de pulso do Apple Watch'], 'Boa quando há noite com relógio.', 'Média para tendência pessoal.'), 'ideal estável'),
      row('Distúrbios resp.', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'sleep_breathing_disturbances_count', 'count'), null, 'absolute', false, sleepMetricDetail('Contagem de distúrbios respiratórios do sono quando o Apple Health fornece esse sinal.', 'Aproxima a camada respiratória que falta em leituras simples de sono.', ['Apple Sleeping Breathing Disturbances'], 'Disponível apenas quando o sistema/aparelho entrega esse tipo.', 'Média; use tendência e contexto.'), 'ideal baixo'),
      row('Stress sono', snapshotSleepStressMetric(latestSleepSnapshot), null, 'absolute', true, sleepMetricDetail('Pressão fisiológica estimada na noite a partir de sinais de recuperação.', 'Ajuda separar uma noite longa e fisiologicamente carregada de uma noite realmente restauradora.', ['FC do sono', 'HRV', 'FC repouso', 'Respiração', 'Temperatura de pulso', 'Oxigênio', 'Distúrbios respiratórios'], 'Usa agregados noturnos e sinais fisiológicos; não salva FC segundo a segundo.', 'Média-alta quando há FC do sono + HRV/respiração; parcial sem FC noturna.'), 'ideal >= 82%'),
      row('Cobertura de fases', snapshotSleepStageCoverageMetric(latestSleepSnapshot), null, 'absolute', true, sleepMetricDetail('Quanto do sono dormido tem estágio detalhado REM/core/profundo.', 'Indica se a arquitetura da noite é confiável ou se veio só duração genérica.', ['REM', 'Core', 'Profundo', 'Asleep genérico'], 'Alta quando estágios cobrem quase toda a noite.', 'Alta para qualidade do dado, não para saúde.'), 'ideal >= 85%'),
      row('Qualidade dados sono', snapshotSleepDataQualityMetric(latestSleepSnapshot), null, 'absolute', true, sleepMetricDetail('Confiança operacional da noite analisada.', 'Evita tratar uma noite com dados incompletos como verdade forte.', ['Cobertura de fases', 'Eficiência', 'Latência', 'Despertares'], 'Alta quando há estágios completos e vigília.', 'Alta para auditar dado; não mede saúde.'), 'ideal >= 75%'),
      row('Status captura', snapshotSleepCaptureStatusMetric(latestSleepSnapshot), null, 'absolute', true, sleepMetricDetail('Classificação da captura usada na noite.', 'Mostra rapidamente se o sono veio completo, parcial ou só por duração.', ['Cobertura de estágios', 'Fonte do sono'], 'Alta para auditoria de dados.', 'Alta para explicar a confiabilidade operacional.'), 'ideal completo'),
	      row('Regularidade', sleepRegularityNow, null, 'absolute', true, sleepMetricDetail('Score de consistência dos horários recentes de sono.', 'Regularidade circadiana melhora previsibilidade de sono, energia e foco.', ['Hora de dormir', 'Hora de acordar', 'Ponto médio do sono', 'Jetlag social'], 'Boa com 3+ noites recentes; melhor com 7.', 'Média-alta para rotina.'), 'ideal >= 85%'),
      row('Dormir ±', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'bedtime_regularity_minutes', 'min'), null, 'absolute', false, sleepMetricDetail('Desvio médio do horário de dormir em relação ao seu padrão recente.', 'Mostra se a rotina de início do sono está estável.', ['Bedtime das últimas noites'], 'Boa com 3+ noites.', 'Média-alta para rotina.'), 'ideal <= 30min'),
      row('Acordar ±', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'wake_regularity_minutes', 'min'), null, 'absolute', false, sleepMetricDetail('Desvio médio do horário de acordar em relação ao padrão recente.', 'Horário de acordar estável ancora ritmo circadiano e energia do dia.', ['Wake time das últimas noites'], 'Boa com 3+ noites.', 'Média-alta para rotina.'), 'ideal <= 30min'),
      row('Meio do sono ±', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'midpoint_regularity_minutes', 'min'), null, 'absolute', false, sleepMetricDetail('Variação do ponto médio da noite de sono.', 'É mais robusto que olhar só dormir ou acordar, porque resume o deslocamento da janela inteira.', ['Bedtime', 'Wake time'], 'Boa com 3+ noites.', 'Média-alta para rotina.'), 'ideal <= 30min'),
      row('Jetlag social', snapshotJsonMetric(latestSleepSnapshot, 'sleep', 'social_jetlag_minutes', 'min'), null, 'absolute', false, sleepMetricDetail('Diferença entre o ponto médio do sono em dias úteis e fim de semana.', 'Captura desalinhamento de rotina que pode degradar energia mesmo com duração adequada.', ['Ponto médio em dias úteis', 'Ponto médio em fim de semana'], 'Parcial até haver fins de semana suficientes.', 'Média para tendência.'), 'ideal <= 60min'),
      row('Alvo: evidência', sleepTargetEvidenceMetric(readinessV1.sleepTargetEvidence), null, 'absolute', true, sleepMetricDetail('Explica de onde veio o alvo atual.', 'Permite saber se o alvo é pessoal por resultado, pessoal por duração ou mínimo aceitável.', ['Noites', 'Resultados', 'Check-in', 'Foco'], 'Alta como auditoria do método.', 'Alta para explicar o modelo.')),
      row('Alvo: faixa', sleepTargetBest ? { value: null, text: `${sleepTargetBest.rangeLabel} · ${sleepTargetBest.goodNights}/${sleepTargetBest.nights} noites boas`, date: readinessV1.computedAt } : { value: null, text: 'Sem faixa pessoal ainda', date: readinessV1.computedAt }, null, 'absolute', true, sleepMetricDetail('Faixa de sono com melhor resultado observado.', 'Mostra evidência concreta do seu histórico, não uma regra genérica.', ['Sono', 'Energia', 'Humor', 'Estado', 'Foco'], 'Boa quando há 5+ noites por faixa e outcomes.', 'Média; precisa de mais dados para ficar forte.')),
    ],
    recoveryRows: [
      row('Recuperação noturna', scoreMetric(readinessV1.nightRecovery.score, readinessV1.computedAt), null, 'absolute', true, nightRecoveryDetail(readinessV1), 'ideal >= 85%'),
      row('HRV noturno', hrvNow, hrvNormal, 'absolute', true, recoveryMetricDetail('HRV noturno', 'Mediana de HRV dentro da janela da noite principal.', 'É um dos sinais mais fortes de recuperação autonômica; queda contra seu normal costuma indicar carga, stress, álcool, doença ou sono ruim.', ['HRV SDNN', 'Janela da noite principal', 'Baseline noturno'], 'Atualiza quando o Apple Watch grava HRV perto/durante a noite. Atlas aceita apenas amostras na janela do sono ou até 2h ao redor dela.', 'Alta quando existe amostra noturna; sem amostra noturna vira sem dado, não usa HRV solto da tarde.', 'Média-alta para tendência pessoal; leitura isolada é ruidosa.'), normalReference(hrvNormal) ?? 'ideal >= normal', 'normal'),
      row('FC sono', sleepHeartRateNow, sleepHeartRateNormal, 'absolute', false, recoveryMetricDetail('FC sono', 'Frequência cardíaca média durante a noite principal.', 'Funciona melhor que FC repouso solta para recuperação: se sobe contra seu normal, pode indicar stress fisiológico.', ['Amostras de FC dentro da janela de sono', 'Noite principal', 'Baseline noturno'], 'Atualiza após a coleta de sono/FC noturna; o app salva apenas agregados, não batimento a batimento.', 'Alta quando há pelo menos algumas amostras de FC no sono; parcial sem amostras suficientes.', 'Alta para tendência de sono; não é diagnóstico.'), normalReference(sleepHeartRateNormal) ?? 'ideal <= normal', 'normal'),
      row('Respiração sono', respiratoryNow, respiratoryNormal, 'absolute', false, recoveryMetricDetail('Respiração sono', 'Frequência respiratória associada à noite principal.', 'Desvios contra seu normal podem sinalizar stress, doença, álcool, calor ou pior recuperação.', ['Respiração HealthKit dentro da janela de sono', 'Baseline noturno'], 'Atualiza quando o Apple Watch entrega respiração da noite; sinais fora da janela não entram como recuperação.', 'Boa quando a amostra cai na janela de sono; sem isso vira sem dado.', 'Média-alta para tendência pessoal.'), normalReference(respiratoryNormal) ?? 'ideal estável', 'normal'),
      row('Temperatura pulso sono', wristTemperatureNow, wristTemperatureNormal, 'absolute', null, recoveryMetricDetail('Temperatura pulso sono', 'Temperatura de pulso medida na noite principal.', 'Desvio térmico pode antecipar doença, álcool, stress, ambiente quente/frio ou alteração fisiológica.', ['Temperatura de pulso Apple Watch', 'Janela da noite principal', 'Baseline noturno'], 'Atualiza quando o Apple Watch gera temperatura de sono. Atlas não reaproveita temperatura velha de dias anteriores para a recuperação de hoje.', 'Boa quando há leitura para a noite; sem leitura da noite fica sem dado.', 'Média para tendência e desvios; o valor absoluto importa menos que a mudança contra seu normal.'), normalReference(wristTemperatureNormal) ?? 'ideal estável', 'normal'),
      row('Oxigênio sono', oxygenSaturationNow, oxygenSaturationNormal, 'absolute', true, recoveryMetricDetail('Oxigênio sono', 'Saturação de oxigênio associada à noite principal.', 'Ajuda contextualizar respiração e recuperação; quedas recorrentes merecem atenção.', ['SpO2 HealthKit dentro da janela de sono', 'Noite principal'], 'Atualiza quando o Apple Watch registra oxigênio perto/durante o sono. Leitura solta à tarde não entra como recuperação.', 'Parcial por amostragem irregular; bom para tendência, não para diagnóstico.', 'Média; use com respiração, sintomas e histórico.'), oxygenSaturationNormal ? normalReference(oxygenSaturationNormal) : 'ideal >= 95%', oxygenSaturationNormal ? 'normal' : null),
      row('VO2max', vo2maxNow, previousWeekSnapshotLatest(healthSnapshots, 'vo2max', 'ml/(kg*min)') ?? previousWeekLatest(healthSignals, ['vo2max']), 'absolute', true, recoveryMetricDetail('VO2max', 'Estimativa de aptidão cardiorrespiratória.', 'Não é uma métrica que muda toda noite, mas contextualiza capacidade física e idade física.', ['VO2max Apple Health', 'Treinos/caminhadas/corridas qualificadas'], 'Atualiza quando a Apple gera nova estimativa, normalmente após atividades compatíveis; Atlas aceita valor recente por até 180 dias.', 'Boa quando há estimativa recente; fica sem dado se estiver velho demais.', 'Média-alta para tendência de aptidão, não para recuperação diária.'), 'quanto maior melhor'),
    ],
    loadRows: [
	      row('Strain do dia', strainToday, null, 'absolute', false, dayStrainDetail(readinessV1.dayStrain), '0-21'),
	      row('Margem de carga', scoreMetric(readinessV1.load.score, dynamicComputedAt), null, 'absolute', true, axisDetail(readinessV1.load, 'Carga', 'Quanto espaço ainda existe hoje antes de passar do seu padrão recente.', 'Evita confundir dia ativo com dia bom: score alto significa margem alta, score baixo significa carga já pesada.', ['Strain do dia', 'Carga relativa', 'Carga aguda/crônica', 'FC ativa', 'Esforço treino', 'Treino recente'], 'Modelo central readiness_v1 com carga acumulada e baseline pessoal.', 'Atualiza ao longo do dia quando chegam passos, energia, exercício, FC acordado ou treino com FC.', 'Alta com zonas de FC; parcial quando só há passos/calorias.', 'Boa para decisão operacional, não para diagnóstico.', ['Carga é acumulativa e muda durante o dia.', 'Sem Apple Watch durante treino, o modelo perde precisão cardiovascular.', 'Sem score de esforço, musculação ainda depende de duração, energia e FC.'], readinessV1.axisQuality.load), 'alto = sobra'),
	      row('Risco de sobrecarga', overloadRisk, null, 'absolute', false, compositeMetricDetail('Carga', 'Probabilidade operacional de excesso hoje, combinando carga, intensidade e recuperação recente.', 'Mostra quando a carga está alta demais para a base atual, mesmo que a motivação ou o treino pareçam bons.', ['Strain do dia', 'Carga relativa', 'Aguda/crônica', 'Zonas 4-5', 'Déficit observado 7d', 'Recuperação noturna'], 'Cálculo local sobre readiness_v1 e agregados de carga do dia.', 'Atualiza durante o dia; sono e recuperação usam a última noite válida.', 'Boa com zonas de FC e histórico de carga; parcial sem FC de treino.', 'Média-alta para gestão de carga; não prevê lesão individual.', ['Musculação pesada sem FC alta pode subestimar risco muscular.', 'Dor, doença e volume externo não registrado precisam ser considerados fora do score.'], compositeMetricEvidence(['Strain', strainToday], ['Carga relativa', ratioPercentMetric(readinessV1.dayStrain.loadRatio ?? readinessV1.loadRatio, readinessV1.computedAt)], ['Aguda/crônica', ratioPercentMetric(readinessV1.dayStrain.acuteChronic, readinessV1.computedAt)], ['Zonas altas', sumMetricValues(workoutZoneHighToday, wakingZoneHighToday, 'min')], ['Déficit 7d', { value: readinessV1.sleepDebtHours, unit: 'h', date: readinessV1.computedAt }]), overloadRisk.confidence), '<= 35%'),
	      row('Eficiência cardiovascular', cardiovascularEfficiency, null, 'absolute', true, compositeMetricDetail('Carga', 'Score de economia cardiovascular: quanto movimento/carga você produziu para a resposta de FC observada.', 'Diferencia capacidade máxima de eficiência diária. VO2max entra só como contexto leve; o motor principal é FC por volume de movimento.', ['FC ativa média', 'FC treino média', 'Passos', 'Distância', 'Energia ativa', 'Carga cardio', 'VO2max como contexto'], 'Cálculo local com pesos limitados para não transformar eficiência em outro VO2max.', 'Atualiza no dia atual; fica melhor com várias semanas de comparação pessoal.', 'Boa com FC acordado/treino e volume de movimento; parcial se só houver passos ou só houver FC.', 'Média para leitura diária; melhor como tendência semanal.', ['Não substitui teste de esforço.', 'Sem pace ou potência externa, a eficiência é aproximação por sensores disponíveis.'], compositeMetricEvidence(['FC ativa média', wakingHrAvgToday], ['FC treino média', workoutHrAvgToday], ['Passos', stepsToday], ['Distância', distanceToday], ['VO2max', vo2maxNow]), cardiovascularEfficiency.confidence), '>= 75%'),
	      row('Carga relativa', ratioPercentMetric(readinessV1.dayStrain.loadRatio ?? readinessV1.loadRatio, readinessV1.computedAt), null, 'absolute', false, loadMetricDetail('Relação entre a carga observada hoje e seu normal.', 'Mostra se o dia está leve, normal ou acima do padrão pessoal.', ['Cardio load', 'Energia ativa', 'Exercício', 'Passos', 'Distância'], 'Atualiza durante o dia; usa baseline pessoal quando existe.', 'Boa com 7+ dias úteis de baseline.', 'Média-alta; depende da cobertura de sensores.'), 'ideal ~100%'),
      row('Aguda/crônica', ratioPercentMetric(readinessV1.dayStrain.acuteChronic, readinessV1.computedAt), null, 'absolute', false, loadMetricDetail('Relação entre carga recente e carga crônica.', 'Ajuda detectar salto de carga que aumenta risco de excesso mesmo quando o treino parece normal.', ['Últimos 7 dias', 'Histórico anterior de até 28 dias'], 'Atualiza quando existe histórico suficiente.', 'Boa com várias semanas de dados.', 'Média; é tendência, não regra clínica.'), 'ideal <= 130%'),
      row('Carga cardio treino', cardioLoadToday, previousWeekDailyAverage(healthSignals, ['workout_cardio_load']), 'relative', false, loadMetricDetail('Carga cardiovascular derivada de zonas de frequência cardíaca em treinos.', 'É o melhor sinal de esforço real quando o Apple Watch registrou FC durante treino.', ['FC treino', 'Duração', 'Zonas 1-5'], 'Atualiza após treinos com FC suficiente.', 'Alta com 3+ amostras de FC por treino; sem FC vira sem dado.', 'Alta para treino; não mede musculação sem resposta cardiovascular.'), 'quanto menor, mais leve'),
      row('Carga FC ativa', wakingCardioLoadToday, previousWeekDailyAverage(healthSignals, ['waking_cardio_load']), 'relative', false, loadMetricDetail('Carga cardiovascular fora de sono e fora de treinos.', 'Aproxima o strain de dia inteiro: captura esforço físico que não virou workout formal sem salvar batimento bruto.', ['FC do dia agregada', 'Sono excluído', 'Treinos excluídos', 'Zonas pessoais'], 'Atualiza por agregados recentes de HealthKit; não importa samples brutos para o banco.', 'Boa quando há amostragem suficiente de FC acordado; sem amostras vira sem dado.', 'Média-alta para tendência de carga diária; melhor junto com treino e energia ativa.'), 'vs normal'),
      row('Strain cardiovascular', cardioStrainToday, previousWeekLatest(healthSignals, ['workout_cardio_strain']), 'absolute', false, loadMetricDetail('Intensidade percentual estimada do treino mais forte do dia.', 'Mostra quão pesado foi o estímulo cardiovascular, separado do volume total.', ['Cardio load', 'Densidade de zonas', 'Duração'], 'Atualiza por treino; pega o maior strain do dia.', 'Alta com FC de treino; parcial sem FC contínua.', 'Média-alta para esforço cardiovascular.'), '0-100%'),
      row('Strain FC ativa', wakingCardioStrainToday, previousWeekLatest(healthSignals, ['waking_cardio_strain']), 'absolute', false, loadMetricDetail('Intensidade cardiovascular agregada fora de treino.', 'Ajuda detectar dias fisicamente pesados mesmo sem treino registrado.', ['Carga FC ativa', 'Zonas pessoais', 'Duração acordado amostrada'], 'Atualiza quando há FC acordado suficiente.', 'Parcial quando o relógio mediu pouco durante o dia.', 'Média-alta para tendência, não substitui treino com FC contínua.'), '0-100%'),
      row('Esforço treino', workoutEffortToday, previousWeekLatest(healthSignals, ['workout_effort_score', 'estimated_workout_effort_score']), 'absolute', false, loadMetricDetail('Score de esforço do treino salvo ou estimado pelo HealthKit.', 'Cobre melhor treinos em que FC subestima carga, especialmente força, intervalado curto e esforço percebido alto.', ['Workout Effort Score', 'Estimated Workout Effort Score'], 'Atualiza quando o HealthKit entrega esforço do treino.', 'Boa quando vem como esforço salvo; parcial quando é estimado.', 'Média-alta como complemento muscular/subjetivo, não como carga externa de peso/reps.'), '1-10'),
      row('Zonas 4-5', workoutZoneHighToday, previousWeekDailyAverage(healthSignals, ['workout_hr_zone_4_min', 'workout_hr_zone_5_min']), 'absolute', false, loadMetricDetail('Minutos em alta intensidade.', 'Poucos minutos aqui podem pesar mais que muito volume leve.', ['Zona 4', 'Zona 5'], 'Atualiza após treino com FC.', 'Alta quando zonas foram calculadas por FC.', 'Alta para carga cardiovascular.'), 'alto = pesado'),
      row('Zonas 4-5 ativas', wakingZoneHighToday, previousWeekDailyAverage(healthSignals, ['waking_hr_zone_4_min', 'waking_hr_zone_5_min']), 'absolute', false, loadMetricDetail('Minutos em alta intensidade fora de treino e fora do sono.', 'Evita perder esforço real quando você não iniciou workout mas o corpo trabalhou pesado.', ['FC acordado', 'Zona 4', 'Zona 5'], 'Atualiza por agregado diário de FC.', 'Boa quando há amostras suficientes; sem cobertura fica sem dado.', 'Média para eventos curtos; boa para tendência.'), 'alto = pesado'),
      row('Zona 3', workoutZone3Today, previousWeekDailyAverage(healthSignals, ['workout_hr_zone_3_min']), 'absolute', false, loadMetricDetail('Minutos em intensidade moderada-alta.', 'Ajuda separar treino aeróbico forte de passeio leve.', ['Zona 3'], 'Atualiza após treino com FC.', 'Alta quando zonas foram calculadas por FC.', 'Média-alta para tendência.'), 'moderado'),
      row('Zona 2', workoutZone2Today, previousWeekDailyAverage(healthSignals, ['workout_hr_zone_2_min']), 'absolute', true, loadMetricDetail('Minutos em aeróbico leve/moderado.', 'É volume útil e sustentável, mas pesa menos no strain que zonas altas.', ['Zona 2'], 'Atualiza após treino com FC.', 'Alta quando zonas foram calculadas por FC.', 'Média-alta para tendência.'), 'base aeróbica'),
      row('Zona 1', workoutZone1Today, previousWeekDailyAverage(healthSignals, ['workout_hr_zone_1_min']), 'absolute', true, loadMetricDetail('Minutos em intensidade muito leve dentro de treino.', 'Completa a arquitetura cardíaca do treino e separa aquecimento/recuperação do esforço real.', ['Zona 1'], 'Atualiza após treino com FC.', 'Alta quando zonas foram calculadas por FC.', 'Média; pesa pouco no strain.'), 'aquecimento'),
      row('FC treino média', workoutHrAvgToday, previousWeekDailyMedian(healthSignals, ['workout_hr_avg_bpm']), 'absolute', false, loadMetricDetail('Frequência cardíaca média dos treinos do dia.', 'Contextualiza se a carga veio de esforço real ou só duração.', ['FC durante treino'], 'Atualiza quando há treino com FC.', 'Boa com amostragem contínua.', 'Média; depende do tipo de treino.'), 'menor = leve'),
      row('FC treino máx.', workoutHrMaxToday, previousWeekLatest(healthSignals, ['workout_hr_max_bpm']), 'absolute', false, loadMetricDetail('Pico de FC observado no treino.', 'Ajuda identificar estímulos intensos e possíveis picos anormais.', ['FC durante treino'], 'Atualiza quando há treino com FC.', 'Boa com amostragem contínua.', 'Média; picos isolados podem ser ruído.'), 'pico'),
      row('FC ativa média', wakingHrAvgToday, previousWeekDailyMedian(healthSignals, ['waking_hr_avg_bpm']), 'absolute', false, loadMetricDetail('FC média acordado, excluindo sono e treinos.', 'Ajuda entender carga fisiológica do dia fora de workouts formais.', ['FC acordado agregada'], 'Atualiza por agregado diário.', 'Boa quando há amostras suficientes.', 'Média; sensível a stress, calor, cafeína e movimento.'), 'contexto'),
      row('FC ativa máx.', wakingHrMaxToday, previousWeekLatest(healthSignals, ['waking_hr_max_bpm']), 'absolute', false, loadMetricDetail('Maior FC acordado fora de treino.', 'Mostra picos fisiológicos não capturados por workout.', ['FC acordado agregada'], 'Atualiza por agregado diário.', 'Parcial para picos curtos por amostragem intermitente.', 'Média; deve ser lida com zonas e carga.'), 'pico'),
      row('Energia ativa', activeEnergyToday, previousWeekSnapshotAverage(healthSnapshots, 'active_energy_kcal', 'kcal') ?? previousWeekDailyAverage(healthSignals, ['active_energy_kcal']), 'relative', false, loadMetricDetail('Calorias ativas do dia.', 'Serve como fallback de volume quando não há treino com FC.', ['Active Energy'], 'Atualiza ao longo do dia.', 'Boa para volume geral; fraca para intensidade.', 'Média; não substitui FC.'), 'vs sem.'),
      row('Exercício hoje', exerciseToday, previousWeekSnapshotAverage(healthSnapshots, 'exercise_minutes', 'min') ?? previousWeekDailyAverage(healthSignals, ['exercise_minutes']), 'relative', false, loadMetricDetail('Minutos de exercício reconhecidos pelo Apple Watch.', 'Ajuda medir volume de atividade estruturada.', ['Apple Exercise Time'], 'Atualiza ao longo do dia.', 'Boa para volume; não captura intensidade sozinha.', 'Média.'), 'vs sem.'),
      row('Passos hoje', stepsToday, previousWeekSnapshotAverage(healthSnapshots, 'steps', 'count') ?? previousWeekDailyAverage(healthSignals, ['steps']), 'relative', false, loadMetricDetail('Passos acumulados hoje.', 'Captura carga leve e NEAT fora dos treinos.', ['Steps'], 'Atualiza ao longo do dia.', 'Alta para contagem; baixa para intensidade.', 'Boa para volume leve.'), 'vs sem.'),
      row('Distância hoje', distanceToday, previousWeekSnapshotAverage(healthSnapshots, 'walking_running_distance_m', 'm') ?? previousWeekDailyAverage(healthSignals, ['walking_running_distance', 'HKQuantityTypeIdentifierDistanceWalkingRunning']), 'relative', false, loadMetricDetail('Distância andando/correndo hoje.', 'Complementa passos e diferencia deslocamento real de movimento curto.', ['Walking + running distance'], 'Atualiza ao longo do dia.', 'Boa para deslocamento; parcial indoor.', 'Média-alta.'), 'vs sem.'),
      row('Em pé hoje', standToday, previousWeekSnapshotAverage(healthSnapshots, 'stand_minutes', 'min') ?? previousWeekDailyAverage(healthSignals, ['stand_minutes']), 'relative', true, loadMetricDetail('Minutos em pé/movimento leve.', 'É contexto de atividade leve, não carga principal.', ['Apple Stand Time'], 'Atualiza ao longo do dia.', 'Boa como contexto; baixo peso no strain.', 'Média.'), 'contexto'),
      row('Treino hoje', workoutToday, previousWeekDailyAverage(healthSignals, ['workout']), 'relative', false, loadMetricDetail('Duração total de treinos registrados hoje.', 'Mostra volume formal, mas só vira carga de qualidade quando há FC/zonas.', ['Workouts'], 'Atualiza quando um treino é salvo.', 'Boa para duração; parcial para intensidade.', 'Média sem FC.'), 'volume'),
      row('Treino recente', workoutNow, null, 'absolute', false, loadMetricDetail('Treino encerrado nas últimas 30h.', 'Treino recente ainda pode reduzir margem de carga e explicar fadiga.', ['Workout recente'], 'Expira em 30h para não poluir a tela com treino antigo.', 'Boa quando há treino recente; sem treino fica sem dado.', 'Média; depende do tipo e duração.'), 'últimas 30h'),
      row('Dreno do dia', { value: readinessV1.diagnostics.todayDrain, unit: 'pts', date: readinessV1.computedAt }, null, 'absolute', false, loadMetricDetail('Penalidade dinâmica que reduz a capacidade agora conforme o dia avança e a carga acumula.', 'Impede que uma boa recuperação pela manhã permaneça artificialmente alta após esforço.', ['Horas acordado', 'Carga relativa', 'Sono da noite'], 'Cálculo vivo no dia atual.', 'Boa quando sono e carga do dia existem.', 'Média; é um controle operacional.'), 'menor melhor'),
    ],
    digitalRows: [
      row('Tempo de tela', latestDigitalMetric(digitalActivitySnapshots, 'total_screen_time_min', 'duration'), previousWeekDigitalAverage(digitalActivitySnapshots, 'total_screen_time_min', 'duration'), 'absolute', false, digitalMetricDetail(digitalToday, ['total_screen_time_min'], 'Tempo total de sessões digitais medidas hoje.', 'É a base de pressão digital: muito tempo de tela reduz recuperação cognitiva mesmo quando não sabemos a categoria.', ['Sessões importadas do Rize', 'Tempo sobreposto ao dia local'], 'Medido quando há sessões; não depende de classificação de apps.', 'Alta para uso no computador integrado; incompleta para iPhone sem Screen Time nativo.'), 'menor = melhor'),
      row('Qualidade digital', digitalDataQualityMetric(digitalToday), null, 'absolute', true, digitalMetricDetail(digitalToday, [], 'Cobertura operacional do snapshot digital de hoje.', 'Impede ler categorias ou foco como verdade quando só existe tempo bruto de tela.', ['Tempo medido', 'Sessões', 'Classificação de apps', 'Frescor do snapshot'], 'Combina presença de tempo de tela, classificação e frescor.', 'Alta para auditar confiabilidade; não mede qualidade do dia.'), '>= 75%'),
      row('Fonte iPhone', screenTimeSourceMetric(screenTime), null, 'absolute', true, screenTimeSourceDetail(screenTime), screenTime.entitlementRequired ? 'requer entitlement' : 'fonte nativa'),
      row('Classificação apps', digitalClassificationMetric(digitalToday), null, 'absolute', true, digitalMetricDetail(digitalToday, DIGITAL_CATEGORY_METRIC_KEYS, 'Percentual do tempo digital que conseguiu ser classificado em categorias úteis.', 'Sem isso, categorias como feed, comunicação rasa e trabalho profundo não podem ser tratadas como número real.', ['Mapeamentos de app/domínio', 'Category class no servidor', 'Tempo classificado / tempo total'], 'Alta quando a maior parte das sessões tem categoria; sem classificação vira sem dado.', 'Boa para cobertura de taxonomia; depende da curadoria dos mapeamentos.'), '>= 80%'),
      row('Sessões digitais', digitalSessionsMetric(digitalToday), null, 'absolute', false, digitalMetricDetail(digitalToday, [], 'Quantidade de blocos digitais importados hoje.', 'Ajuda diferenciar uma sessão longa de muitos blocos fragmentados.', ['Sessões Rize importadas', 'Snapshot diário'], 'Boa quando a fonte integrou todas as sessões do dia.', 'Média: sessão não é pickup de celular; é bloco de atividade da fonte.'), 'contexto'),
      row('Fragmentação digital', digitalFragmentationMetric(digitalToday), null, 'absolute', false, digitalMetricDetail(digitalToday, [], 'Sessões por hora de tela medida.', 'Quanto mais fragmentado, maior o custo de troca de contexto e menor a chance de trabalho profundo sustentado.', ['Sessões digitais', 'Tempo de tela'], 'Boa quando as sessões vêm completas; não substitui pickups do iPhone.', 'Média para foco; é proxy de fragmentação, não interrupção exata.'), 'menor = melhor'),
      row('Pickups', latestDigitalMetric(digitalActivitySnapshots, 'pickups_count', 'count'), previousWeekDigitalAverage(digitalActivitySnapshots, 'pickups_count', 'count'), 'relative', false, digitalMetricDetail(digitalToday, ['pickups_count'], 'Número de vezes que o telefone foi pego/desbloqueado.', 'É um dos melhores sinais de fragmentação, mas a fonte atual não entrega esse dado.', ['Screen Time / DeviceActivity quando habilitado'], 'Hoje fica sem dado porque Rize não mede pickups.', 'Sem precisão até existir fonte nativa no iPhone.'), 'fonte ausente'),
      row('Primeira distração', firstOffensiveUse, previousWeekDigitalAverage(digitalActivitySnapshots, 'first_offensive_use_min_after_wake', 'duration'), 'absolute', true, digitalMetricDetail(digitalToday, ['first_offensive_use_min_after_wake'], 'Tempo entre acordar e o primeiro uso digital classificado como distração.', 'Uso ofensivo logo ao acordar tende a piorar direção, foco e tomada de decisão.', ['Hora de acordar', 'Primeira sessão classificada como feed/entretenimento raso', 'Fallback por snapshot quando disponível'], 'Derivado de sessões classificadas do dia quando existe wake time. Sem classificação ou sem fonte iPhone, não inventa valor.', 'Média quando vem de Rize/desktop; alta só quando houver Screen Time nativo e taxonomia completa.'), 'mais tarde = melhor'),
      row('Trabalho profundo', latestDigitalMetric(digitalActivitySnapshots, 'deep_work_total_min', 'duration'), previousWeekDigitalAverage(digitalActivitySnapshots, 'deep_work_total_min', 'duration'), 'absolute', true, digitalMetricDetail(digitalToday, ['deep_work_total_min'], 'Tempo em sessões classificadas como trabalho profundo com duração suficiente.', 'É o sinal digital positivo mais forte: tempo de tela pode ser ruim ou excelente dependendo do contexto.', ['Sessões classificadas como classe 1', 'Blocos com pelo menos 25 minutos'], 'Só aparece quando apps/projetos estão classificados.', 'Boa para tendência; ainda precisa validação por tarefas concluídas.'), 'mais = melhor'),
      row('Foco / tela', digitalRatioMetric(digitalToday, ['deep_work_total_min'], 'total_screen_time_min'), null, 'absolute', true, digitalMetricDetail(digitalToday, ['deep_work_total_min', 'total_screen_time_min'], 'Percentual do tempo de tela que virou trabalho profundo.', 'Normaliza foco pelo volume: 2h profundas em 3h de tela são diferentes de 2h em 10h.', ['Trabalho profundo', 'Tempo de tela'], 'Depende de classificação; sem classificação fica sem dado.', 'Boa quando a taxonomia está coberta.'), '>= 25%'),
      row('Sessões profundas', latestDigitalMetric(digitalActivitySnapshots, 'deep_work_sessions_count', 'sessões'), previousWeekDigitalAverage(digitalActivitySnapshots, 'deep_work_sessions_count', 'sessões'), 'absolute', true, digitalMetricDetail(digitalToday, ['deep_work_sessions_count'], 'Número de blocos profundos com duração mínima.', 'Mostra se o dia teve blocos reais de execução, não apenas minutos soltos.', ['Sessões classe 1', 'Duração mínima de 25 minutos'], 'Só aparece com classificação.', 'Boa para rotina; não mede qualidade do output.'), '>= 2'),
      row('Notificações', latestDigitalMetric(digitalActivitySnapshots, 'notifications_received', 'count'), previousWeekDigitalAverage(digitalActivitySnapshots, 'notifications_received', 'count'), 'relative', false, digitalMetricDetail(digitalToday, ['notifications_received'], 'Notificações recebidas no dia.', 'Notificação é interrupção potencial; sem esse dado, fragmentação fica incompleta.', ['Screen Time / Notification summaries'], 'A fonte atual não entrega notificações.', 'Sem precisão até existir fonte nativa.'), 'fonte ausente'),
      row('Notificações tratadas', latestDigitalMetric(digitalActivitySnapshots, 'notifications_actioned', 'count'), previousWeekDigitalAverage(digitalActivitySnapshots, 'notifications_actioned', 'count'), 'relative', true, digitalMetricDetail(digitalToday, ['notifications_actioned'], 'Notificações que receberam ação/resposta.', 'Ajuda separar ruído ignorado de interrupção que realmente capturou atenção.', ['Notificações recebidas', 'Interações'], 'A fonte atual não entrega esse dado.', 'Sem precisão até existir fonte nativa.'), 'fonte ausente'),
      row('Notif. tratadas %', digitalRatioMetric(digitalToday, ['notifications_actioned'], 'notifications_received'), null, 'absolute', true, digitalMetricDetail(digitalToday, ['notifications_actioned', 'notifications_received'], 'Percentual de notificações que viraram ação.', 'Mostra quanto do input externo conseguiu puxar sua atenção.', ['Notificações recebidas', 'Notificações tratadas'], 'Sem dado enquanto notificações não forem capturadas.', 'Sem precisão até existir fonte nativa.'), 'fonte ausente'),
      row('Consumo curado', latestDigitalMetric(digitalActivitySnapshots, 'curated_input_min', 'duration'), previousWeekDigitalAverage(digitalActivitySnapshots, 'curated_input_min', 'duration'), 'absolute', true, digitalMetricDetail(digitalToday, ['curated_input_min'], 'Tempo em leitura, pesquisa ou input escolhido conscientemente.', 'Nem todo consumo é ruim: input curado pode alimentar trabalho e decisões.', ['Categorias curadas', 'Sessões classificadas'], 'Só aparece com mapeamento de apps/domínios.', 'Média-alta com boa taxonomia.'), 'intencional'),
      row('Feed algorítmico', latestDigitalMetric(digitalActivitySnapshots, 'algorithmic_input_min', 'duration'), previousWeekDigitalAverage(digitalActivitySnapshots, 'algorithmic_input_min', 'duration'), 'absolute', false, digitalMetricDetail(digitalToday, ['algorithmic_input_min'], 'Tempo em feeds e superfícies que escolhem o próximo estímulo por você.', 'É uma das formas mais fortes de pressão atencional e perda de direção.', ['Apps/domínios classe algorítmica'], 'Depende de classificação.', 'Boa se redes/feeds estiverem mapeados; sem mapeamento vira sem dado.'), 'menor = melhor'),
	      row('Pressão algorítmica', algorithmicPressureToday, null, 'absolute', false, digitalMetricDetail(digitalToday, algorithmicPressureKeys, 'Soma de feed algorítmico, entretenimento automático e comunicação rasa.', 'Resume o volume de estímulo digital que tende a drenar foco sem gerar execução.', ['Feed algorítmico', 'Entretenimento automático', 'Comunicação rasa'], 'Depende de classificação; sem classificação fica sem dado.', 'Boa como proxy de pressão, não como causalidade perfeita.'), 'menor = melhor'),
	      row('Pressão cognitiva líquida', cognitivePressure, null, 'absolute', false, compositeMetricDetail('Atividade digital', 'Pressão líquida de atenção no dia: estímulo algorítmico e fragmentação menos sinais de intenção e trabalho profundo.', 'Ajuda separar um dia digital produtivo de um dia digital que drena clareza, mesmo com o mesmo tempo de tela.', ['Pressão algorítmica %', 'Fragmentação digital', 'Primeira distração', 'Intencionalidade digital', 'Trabalho profundo', 'Penalidade cognitiva'], 'Cálculo local sobre snapshot digital e readiness atual.', 'Usa o snapshot digital do dia; check-in/penalidade cognitiva expiram pelo readiness.', 'Boa com classificação digital; parcial quando só há tempo de tela bruto.', 'Média-alta para decisão operacional; não mede cognição clínica.', ['Sem Screen Time nativo, pickups e notificações ainda ficam fora.', 'Taxonomia ruim pode distorcer pressão algorítmica e intencionalidade.'], compositeMetricEvidence(['Pressão algorítmica %', algorithmicPressurePercentToday], ['Fragmentação', fragmentationToday], ['Primeira distração', firstOffensiveUse], ['Intencionalidade', intentionalityToday], ['Trabalho profundo', deepWorkToday]), cognitivePressure.confidence), '<= 35%'),
	      row('Pressão algorítmica %', algorithmicPressurePercentToday, null, 'absolute', false, digitalMetricDetail(digitalToday, [...algorithmicPressureKeys, 'total_screen_time_min'], 'Percentual da tela gasto em pressão algorítmica.', 'Normaliza a pressão pelo total: pouco tempo de tela ruim ainda pode pesar se for quase todo feed.', ['Pressão algorítmica', 'Tempo de tela'], 'Depende de classificação.', 'Boa quando a maior parte do tempo está classificada.'), '<= 25%'),
	      row('Intencionalidade digital', intentionalityToday, null, 'absolute', true, digitalMetricDetail(digitalToday, [...intentionalDigitalKeys, 'total_screen_time_min'], 'Percentual do tempo de tela que foi intencional ou produtivo.', 'É a leitura mais importante da seção: não pune tela usada para trabalho real.', ['Trabalho profundo', 'Consumo curado', 'Entretenimento intencional', 'Comunicação primária'], 'Depende de classificação e mapeamento consistente.', 'Média-alta quando a taxonomia está coberta.'), '>= 50%'),
      row('Entretenimento intencional', latestDigitalMetric(digitalActivitySnapshots, 'intentional_entertainment_min', 'duration'), previousWeekDigitalAverage(digitalActivitySnapshots, 'intentional_entertainment_min', 'duration'), 'absolute', true, digitalMetricDetail(digitalToday, ['intentional_entertainment_min'], 'Lazer escolhido de forma deliberada.', 'Descanso digital planejado é diferente de cair em feed automático.', ['Sessões de entretenimento intencional'], 'Depende de classificação.', 'Média: intenção ainda precisa de curadoria manual ou contexto.'), 'planejado'),
      row('Entretenimento automático', latestDigitalMetric(digitalActivitySnapshots, 'default_entertainment_min', 'duration'), previousWeekDigitalAverage(digitalActivitySnapshots, 'default_entertainment_min', 'duration'), 'absolute', false, digitalMetricDetail(digitalToday, ['default_entertainment_min'], 'Lazer iniciado por padrão/hábito, sem intenção clara.', 'Costuma ser dreno leve ou moderado quando aparece em blocos longos.', ['Sessões classe entretenimento default'], 'Depende de classificação.', 'Média; intenção real pode exigir confirmação pelo usuário.'), 'menor = melhor'),
      row('Comunicação primária', latestDigitalMetric(digitalActivitySnapshots, 'communication_primary_min', 'duration'), previousWeekDigitalAverage(digitalActivitySnapshots, 'communication_primary_min', 'duration'), 'absolute', true, digitalMetricDetail(digitalToday, ['communication_primary_min'], 'Comunicação essencial: trabalho, família, coordenação importante.', 'Ajuda não punir mensagens necessárias como se fossem distração.', ['Apps/canais classificados como comunicação primária'], 'Depende de classificação.', 'Média; pode exigir ajustes por contato/projeto.'), 'útil'),
      row('Comunicação rasa', latestDigitalMetric(digitalActivitySnapshots, 'communication_shallow_min', 'duration'), previousWeekDigitalAverage(digitalActivitySnapshots, 'communication_shallow_min', 'duration'), 'absolute', false, digitalMetricDetail(digitalToday, ['communication_shallow_min'], 'Comunicação de baixo valor ou dispersiva.', 'Aumenta troca de contexto e reduz continuidade cognitiva.', ['Apps/canais classificados como comunicação rasa'], 'Depende de classificação.', 'Média; precisa curadoria para não punir conversas importantes.'), 'menor = melhor'),
      row('Mercado', latestDigitalMetric(digitalActivitySnapshots, 'market_min', 'duration'), previousWeekDigitalAverage(digitalActivitySnapshots, 'market_min', 'duration'), 'absolute', false, digitalMetricDetail(digitalToday, ['market_min'], 'Tempo em apps/sites de mercado, financeiro ou monitoramento que podem capturar atenção.', 'Pode ser necessário, mas costuma ter alto potencial de checagem compulsiva.', ['Apps/domínios classificados como mercado'], 'Depende de classificação.', 'Média; precisa separar análise planejada de checagem reativa.'), 'contexto'),
    ],
    subjectiveRows: [
      row('Energia', checkinMetric(currentLevelState?.energy_level ?? null, currentLevelState?.recorded_at ?? null, checkinLevelFreshnessValue), null, 'absolute', true, checkinLevelDetail('Energia', currentLevelState, checkinLevelFreshnessValue), '1 baixo · 5 alto'),
      row('Humor', moodCheckinMetric(currentLevelState?.mood_level ?? null, currentLevelState?.recorded_at ?? null, checkinLevelFreshnessValue), null, 'absolute', true, checkinLevelDetail('Humor', currentLevelState, checkinLevelFreshnessValue), '1 ruim · 5 bom'),
      row('Estado', checkinStateMetric(currentCheckinState, checkinStateFreshnessValue), null, 'absolute', true, checkinStateDetail(currentCheckinState, checkinStateFreshnessValue), 'expira 6h'),
      ...(typeof stateOfMindNow.value === 'number'
        ? [row('Registro emocional', stateOfMindMetric(stateOfMindNow), stateOfMindMetric(previousWeekDailyMedian(healthSignals, ['state_of_mind_valence'])), 'absolute', true, stateOfMindDetail(stateOfMindNow), 'opcional')]
        : []),
      row('Penalidade cognitiva', { value: readinessV1.diagnostics.cognitivePenalty, unit: 'pts', date: readinessV1.computedAt, confidence: readinessV1.axisQuality.current.confidence, qualityLabel: readinessV1.diagnostics.cognitivePenalty > 0 ? 'ativa' : 'sem penalidade' }, null, 'absolute', false, cognitivePenaltyDetail(readinessV1, currentCheckinState, checkinStateFreshnessValue), 'ideal 0'),
    ],
	    healthspanRows: [
	      row('Idade Fisiológica Atlas', atlasPhysiologicalAgeNow, previousAtlasPhysiologicalAge(healthSnapshots), 'absolute', false, atlasPhysiologicalAgeDetail(atlasPhysiologicalAge), confidenceReference(atlasPhysiologicalAgeNow) ?? physiologicalAgeStatusLabel(atlasPhysiologicalAge.status), 'janela lenta'),
	      row('Pace of Aging Atlas', paceOfAging, null, 'absolute', false, paceOfAgingDetail(paceOfAging, atlasPhysiologicalAge), '<= 1,0x'),
	    ],
	    bodyRows: [
	      row('Qualidade da composição', bodyDataQuality, null, 'absolute', true, bodyCompositionQualityDetail(bodyDataQuality, bodyMassNow, bodyFatNow, leanMassNow, waistNow, heightNow, bmiNow), '>= 80%'),
	      row('Perfil metabólico', metabolicProfile, null, 'absolute', true, metabolicProfileDetail(metabolicProfile, waistNow, heightNow, bmiNow, bodyFatNow, leanMassPercentNow), '>= 80%'),
	      row('Gordura corporal', bodyFatNow, previousWeekSnapshotLatest(healthSnapshots, 'body_fat_percentage', '%') ?? normalizedPercentValue(previousWeekLatest(compositionSignals, ['body_fat_percentage'])), 'absolute', false, bodyCompositionDetail('Gordura corporal', ['Body Fat Percentage'], 'Última medição válida, normalizada para percentual.', 'Métrica de composição corporal; não expira diariamente.', 'HealthKit ou entrada manual validada por faixa fisiológica.'), confidenceReference(bodyFatNow)),
      row('Massa gorda', fatMassNow, null, 'absolute', false, bodyCompositionDetail('Massa gorda', ['Peso', 'Gordura corporal'], 'Peso multiplicado pelo percentual de gordura.', 'Derivada; muda quando peso ou gordura mudam.', 'Cálculo local a partir das últimas medições válidas.'), confidenceReference(fatMassNow)),
      row('Massa magra %', leanMassPercentNow, previousWeekLeanMassPercent(healthSnapshots, compositionSignals), 'absolute', true, bodyCompositionDetail('Massa magra %', ['Massa magra', 'Peso'], 'Percentual de massa livre de gordura, não músculo esquelético direto.', 'Última medição/derivação; não deve ser lida como músculo real se a fonte não entrega músculo.', 'Cálculo local ou snapshot validado.'), confidenceReference(leanMassPercentNow)),
      row('Massa magra', leanMassNow, previousWeekSnapshotLatest(healthSnapshots, 'lean_body_mass_kg', 'kg') ?? previousWeekLatest(compositionSignals, ['lean_body_mass']), 'absolute', true, bodyCompositionDetail('Massa magra', ['Lean Body Mass', 'Peso', 'Gordura corporal'], 'Massa livre de gordura; pode ser medida ou derivada.', 'Última medição válida. Não exige atualização diária.', 'HealthKit ou cálculo peso - massa gorda quando a massa magra direta não existe.'), confidenceReference(leanMassNow)),
      row('Peso', bodyMassNow, previousWeekSnapshotLatest(healthSnapshots, 'body_mass_kg', 'kg') ?? previousWeekLatest(compositionSignals, ['body_mass']), 'absolute', false, bodyCompositionDetail('Peso', ['Body Mass'], 'Último peso válido em kg.', 'Pode ficar estável até nova pesagem.', 'HealthKit ou entrada manual validada.'), confidenceReference(bodyMassNow)),
      row('Altura', heightNow, previousWeekLatest(compositionSignals, ['height']), 'absolute', null, bodyCompositionDetail('Altura', ['Height'], 'Última altura válida. É métrica estável.', 'Usada para IMC e TMB estimada; não precisa atualização frequente.', 'HealthKit ou entrada manual validada.'), 'editar'),
      row('IMC', bmiNow, previousWeekSnapshotLatest(healthSnapshots, 'body_mass_index', null) ?? previousWeekLatest(compositionSignals, ['body_mass_index']), 'absolute', false, bodyCompositionDetail('IMC', ['Peso', 'Altura', 'Body Mass Index'], 'Índice peso/altura ao quadrado.', 'Usa leitura direta quando existe; senão deriva de peso e altura válidos.', 'HealthKit, entrada manual e cálculo local com limites fisiológicos.'), confidenceReference(bmiNow)),
      row('Cintura', waistNow, previousWeekSnapshotLatest(healthSnapshots, 'waist_circumference_cm', 'cm') ?? previousWeekLatest(compositionSignals, ['waist_circumference']), 'absolute', false, bodyCompositionDetail('Cintura', ['Waist Circumference'], 'Última circunferência de cintura válida.', 'Métrica manual/intermitente; não expira diariamente.', 'HealthKit ou entrada manual validada.'), 'editar'),
      row('TMB estimada', bmrNow, null, 'absolute', true, bodyCompositionDetail('TMB estimada', ['Peso', 'Altura', 'Idade', 'Sexo biológico'], 'Estimativa pela equação de Mifflin-St Jeor.', 'Não usa energia basal parcial do dia, então não oscila com sincronização incompleta.', 'Cálculo local; fica sem dado se faltar peso, altura, idade ou sexo.'), confidenceReference(bmrNow)),
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
  onRowLongPress,
  canPressRow,
}: {
  rows: MetricRowModel[]
  onRowPress?: (item: MetricRowModel) => void
  onRowLongPress?: (item: MetricRowModel) => void
  canPressRow?: (item: MetricRowModel) => boolean
}) {
  const c = usePalette()
  return (
    <View style={[styles.list, { backgroundColor: c.surface, borderColor: c.border }]}>
      {rows.map((item, index) => (
        <MetricRow
          key={item.label}
          item={item}
          last={index === rows.length - 1}
          onPress={onRowPress && (!canPressRow || canPressRow(item)) ? onRowPress : undefined}
          onLongPress={onRowLongPress}
        />
      ))}
    </View>
  )
}

function BodyMetricGroups({
  rows,
  onRowPress,
  onRowLongPress,
  canPressRow,
}: {
  rows: MetricRowModel[]
  onRowPress?: (item: MetricRowModel) => void
  onRowLongPress?: (item: MetricRowModel) => void
  canPressRow?: (item: MetricRowModel) => boolean
}) {
  const c = usePalette()
  const groups = groupedBodyMetrics(rows)

  return (
    <View style={styles.bodyGroups}>
      {groups.map((group) => (
        <View key={group.label} style={styles.bodyGroup}>
          <View style={styles.bodyGroupHeader}>
            <Label>{group.label}</Label>
            <Sans size={12} lineHeight={17} color={c.ink2}>
              {group.caption}
            </Sans>
          </View>
          <MetricList
            rows={group.rows}
            onRowPress={onRowPress}
            onRowLongPress={onRowLongPress}
            canPressRow={canPressRow}
          />
        </View>
      ))}
    </View>
  )
}

function MetricRow({
  item,
  last,
  onPress,
  onLongPress,
}: {
  item: MetricRowModel
  last?: boolean
  onPress?: (item: MetricRowModel) => void
  onLongPress?: (item: MetricRowModel) => void
}) {
  const c = usePalette()
  const trend = trendText(item, c)
  const referenceColor = metricReferenceColor(item.reference, c)
  const press = onPress ? () => onPress(item) : undefined
  const longPress = onLongPress && item.detail ? () => onLongPress(item) : undefined
  const editable = Boolean(press) && item.reference === 'editar'
  return (
    <Pressable
      onPress={press}
      onLongPress={longPress}
      delayLongPress={300}
      disabled={!press && !longPress}
      style={({ pressed }) => [
        styles.metricRow,
        !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && { backgroundColor: c.premium },
      ]}
    >
      <View style={styles.metricText}>
        <Sans size={15} color={c.ink}>{item.label}</Sans>
        <Mono size={10.5} letterSpacing={0.21} color={c.ink2}>
          {metricSubtitle(item.value)}
        </Mono>
      </View>
      <View style={styles.metricValue}>
        <Mono size={13} letterSpacing={0.26} color={hasValue(item.value) ? c.ink : c.ink3} align="right">
          {formatMetric(item.value)}
        </Mono>
        {item.reference && editable ? (
          <View style={[styles.editPill, { borderColor: c.border, backgroundColor: c.bg }]}>
            <Mono size={10.5} letterSpacing={0.1} color={c.prussian} align="right">
              Editar
            </Mono>
          </View>
        ) : item.reference ? (
          <Mono size={10.5} letterSpacing={0.1} color={referenceColor} align="right">
            {item.reference}
          </Mono>
        ) : null}
        {trend ? (
          <Mono size={10.5} letterSpacing={0.1} color={trend.color} align="right">
            {trend.label}
          </Mono>
        ) : null}
      </View>
    </Pressable>
  )
}

function MetricDetailSheet({
  item,
  onClose,
}: {
  item: MetricRowModel | null
  onClose: () => void
}) {
  const c = usePalette()
  const detail = item?.detail
  const axisQuality = detail?.axisQuality ?? null
  const confidence = item?.value.confidence ?? axisQuality?.confidence ?? detail?.confidence ?? null

  return (
    <Modal
      transparent
      visible={Boolean(item && detail)}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.detailModal}>
        <Pressable style={styles.detailScrim} onPress={onClose} />
        {item && detail ? (
          <View style={[styles.detailSheet, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={[styles.detailHandle, { backgroundColor: c.border }]} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.detailContent}
            >
              <View style={styles.detailHeader}>
                <View style={styles.detailTitleBlock}>
                  <Label>{detail.category}</Label>
                  <Frau size={28} lineHeight={32} letterSpacing={-0.56} color={c.ink} style={{ marginTop: 6 }}>
                    {item.label}
                  </Frau>
                </View>
                <Pressable
                  accessibilityLabel="Fechar detalhe"
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.detailClose,
                    { borderColor: c.border, opacity: pressed ? 0.72 : 1 },
                  ]}
                >
                  <Mono size={12} letterSpacing={0.24} color={c.ink2}>Fechar</Mono>
                </Pressable>
              </View>

              <View style={[styles.detailMetrics, { borderColor: c.border }]}>
                <DetailMetric label="Valor" value={formatMetric(item.value)} />
                <DetailMetric label="Confiança" value={percentText(confidence)} />
                <DetailMetric label="Frescor" value={percentText(axisQuality?.freshness ?? null)} last />
              </View>

              {axisQuality ? (
                <DetailBlock title="Estado da métrica" text={axisQualitySummary(axisQuality, item.value.date)} />
              ) : null}
              {detail.evidence?.length ? (
                <DetailList title="Evidências" items={detail.evidence} />
              ) : null}
              <DetailBlock title="O que é" text={detail.what} />
              <DetailBlock title="Por que importa" text={detail.why} />
              <DetailList title="Métricas usadas" items={detail.inputs} />
              <DetailBlock title="Qualidade do dado" text={detail.quality} />
              <DetailBlock title="Frescor" text={detail.freshness} />
              <DetailBlock title="Fonte do cálculo" text={detail.source} />
              <DetailBlock title="Precisão" text={detail.precision} />
              <DetailList title="Limites" items={detail.caveats} />
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  )
}

function ManualBodyMetricModal({
  metric,
  value,
  error,
  saving,
  onChangeValue,
  onSubmit,
  onClose,
}: {
  metric: ManualBodyMetricKey | null
  value: string
  error: string | null
  saving: boolean
  onChangeValue: (value: string) => void
  onSubmit: () => void
  onClose: () => void
}) {
  const { c, name } = useTheme()
  const config = metric ? MANUAL_BODY_METRICS[metric] : null
  const range = config ? `${manualDisplayValue(config.min, config.unit)}-${manualDisplayValue(config.max, config.unit)} ${config.unit}` : ''

  return (
    <Modal
      transparent
      visible={Boolean(config)}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.manualModal}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.manualScrim} onPress={saving ? undefined : onClose} />
        {config ? (
          <View style={[styles.manualSheet, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={[styles.manualHandle, { backgroundColor: c.border }]} />
            <View style={styles.manualHeader}>
              <View style={styles.manualTitleBlock}>
                <Label color={c.bronze}>Medição manual</Label>
                <Frau size={30} lineHeight={34} letterSpacing={0} color={c.ink} style={{ marginTop: 6 }}>
                  {config.label}
                </Frau>
              </View>
              <Pressable
                accessibilityLabel="Fechar edição"
                disabled={saving}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.manualClose,
                  { borderColor: c.border, opacity: pressed || saving ? 0.68 : 1 },
                ]}
              >
                <Sans size={22} lineHeight={24} color={c.ink2} align="center">×</Sans>
              </Pressable>
            </View>

            <View style={[styles.manualInputFrame, { backgroundColor: c.bg, borderColor: c.border }]}>
              <TextInput
                value={value}
                onChangeText={(next) => {
                  onChangeValue(next)
                }}
                placeholder={config.placeholder}
                placeholderTextColor={c.ink3}
                keyboardType="decimal-pad"
                keyboardAppearance={name === 'dark' ? 'dark' : 'light'}
                returnKeyType="done"
                selectTextOnFocus
                onSubmitEditing={onSubmit}
                selectionColor={c.prussian}
                style={[styles.manualInput, { color: c.ink }]}
              />
              <View style={[styles.manualUnitPill, { borderColor: c.border, backgroundColor: c.surface }]}>
                <Mono size={12} letterSpacing={0.24} color={c.ink2} align="center">
                  {config.unit}
                </Mono>
              </View>
            </View>

            <View style={styles.manualMetaRow}>
              <View style={[styles.manualMetaItem, { borderColor: c.border }]}>
                <Mono size={10.5} letterSpacing={0.35} color={c.ink3}>INTERVALO</Mono>
                <Mono size={12} letterSpacing={0} color={c.ink}>{range}</Mono>
              </View>
              <View style={[styles.manualMetaItem, { borderColor: c.border }]}>
                <Mono size={10.5} letterSpacing={0.35} color={c.ink3}>ORIGEM</Mono>
                <Mono size={12} letterSpacing={0} color={c.ink}>manual</Mono>
              </View>
            </View>

            <Sans
              size={12.5}
              lineHeight={17}
              color={error ? c.recRed : c.ink2}
              style={styles.manualMessage}
            >
              {error ?? 'Usada como última medição válida até nova atualização.'}
            </Sans>

            <View style={styles.manualActions}>
              <Pressable
                disabled={saving}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.manualButton,
                  { borderColor: c.border, opacity: pressed || saving ? 0.72 : 1 },
                ]}
              >
                <Sans weight="med" size={14} color={c.ink2}>Cancelar</Sans>
              </Pressable>
              <Pressable
                disabled={saving}
                onPress={onSubmit}
                style={({ pressed }) => [
                  styles.manualButton,
                  styles.manualButtonPrimary,
                  { borderColor: c.ink, backgroundColor: c.ink, opacity: pressed || saving ? 0.78 : 1 },
                ]}
              >
                <Sans weight="sb" size={14} color={c.onInk}>{saving ? 'Salvando' : 'Salvar medida'}</Sans>
              </Pressable>
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  )
}

function DetailMetric({
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
    <View style={[styles.detailMetric, !last && { borderRightColor: c.border, borderRightWidth: StyleSheet.hairlineWidth }]}>
      <Mono size={10} letterSpacing={0.3} color={c.ink2}>{label}</Mono>
      <Mono size={13} letterSpacing={0.13} color={c.ink} style={{ marginTop: 6 }}>
        {value}
      </Mono>
    </View>
  )
}

function DetailBlock({
  title,
  text,
}: {
  title: string
  text: string
}) {
  const c = usePalette()
  return (
    <View style={styles.detailSection}>
      <Label>{title}</Label>
      <Sans size={13} lineHeight={19} color={c.ink} style={{ marginTop: 8 }}>
        {text}
      </Sans>
    </View>
  )
}

function DetailList({
  title,
  items,
}: {
  title: string
  items: string[]
}) {
  const c = usePalette()
  return (
    <View style={styles.detailSection}>
      <Label>{title}</Label>
      <View style={styles.detailListItems}>
        {items.map((item) => (
          <View key={item} style={styles.detailListItem}>
            <Mono size={11} letterSpacing={0.1} color={c.ink2}>-</Mono>
            <Sans size={13} lineHeight={18} color={c.ink} style={styles.detailListText}>
              {item}
            </Sans>
          </View>
        ))}
      </View>
    </View>
  )
}

function percentText(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${Math.round(clamp(value, 0, 1) * 100)}%`
    : 'Sem dado'
}

function axisQualitySummary(quality: ReadinessAxisQuality, computedAt?: string | null): string {
  const parts = [
    `${axisStatusLabel(quality.status)}.`,
    `Cobertura ${percentText(quality.coverage)}.`,
    `Frescor ${percentText(quality.freshness)}.`,
  ]

  if (typeof quality.baselineDays === 'number') {
    parts.push(`Baseline: ${quality.baselineDays} dias úteis.`)
  }

  if (computedAt) {
    parts.push(`Calculado em ${formatDateTime(computedAt)}.`)
  }

  parts.push(quality.summary)
  return parts.join(' ')
}

function axisStatusLabel(status: ReadinessAxisQuality['status']): string {
  switch (status) {
    case 'good':
      return 'Dado bom'
    case 'partial':
      return 'Dado parcial'
    case 'baseline':
      return 'Baseline em formação'
    default:
      return 'Sem classificação'
  }
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
  detail?: MetricDetail | null,
  reference?: string | null,
  comparisonLabel?: string | null,
): MetricRowModel {
  return { label, value, previous, trendMode, positiveIsGood, detail, reference, comparisonLabel }
}

function groupedBodyMetrics(rows: MetricRowModel[]): MetricGroupModel[] {
  const byLabel = new Map(rows.map((item) => [item.label, item]))
  const pick = (labels: string[]): MetricRowModel[] => (
    labels.map((label) => byLabel.get(label)).filter((item): item is MetricRowModel => Boolean(item))
  )

  return [
    {
      label: 'Medidas base',
      caption: 'Entradas auditáveis que podem vir do HealthKit ou de registro manual.',
      rows: pick(['Qualidade da composição', 'Peso', 'Altura', 'Cintura']),
    },
    {
      label: 'Composição',
      caption: 'Leituras e cálculos dependentes de gordura corporal e massa magra.',
      rows: pick(['Gordura corporal', 'Massa gorda', 'Massa magra', 'Massa magra %']),
    },
    {
      label: 'Modelos',
      caption: 'Cálculos auxiliares sem idade paralela; a idade oficial fica em Healthspan Atlas.',
      rows: pick(['Perfil metabólico', 'IMC', 'TMB estimada']),
    },
  ].filter((group) => group.rows.length > 0)
}

function axisDetail(
  score: ReadinessScore,
  category: string,
  what: string,
  why: string,
  inputs: string[],
  source: string,
  freshness: string,
  quality: string,
  precision: string,
  caveats: string[],
  axisQuality?: ReadinessAxisQuality | null,
): MetricDetail {
  return {
    category,
    what,
    why,
    inputs,
    source,
    freshness,
    quality,
    precision,
    caveats,
    confidence: score.confidence,
    axisQuality,
  }
}

function sleepMetricDetail(
  what: string,
  why: string,
  inputs: string[],
  quality: string,
  precision: string,
  caveats: string[] = [],
): MetricDetail {
  return {
    category: 'Sono',
    what,
    why,
    inputs,
    source: 'Analisador único de sono principal: separa cochilos, calcula a janela principal e salva no snapshot diário.',
    freshness: 'Última noite válida até 48h; regularidade e déficit usam histórico recente observado.',
    quality,
    precision,
    caveats: caveats.length > 0
      ? caveats
      : ['Use tendências de várias noites; fases de sono por wearable são estimativas.', 'Sem estágios detalhados, a métrica fica parcial ou sem dado.'],
  }
}

function nightRecoveryDetail(readiness: ReadinessV1Model): MetricDetail {
  return {
    category: 'Recuperação',
    what: 'Score noturno de recuperação calculado a partir da noite principal validada.',
    why: 'É a leitura mais parecida com recovery: resume se o sistema autônomo, a estabilidade fisiológica e o sono sustentam carga hoje.',
    inputs: [
      'HRV noturno: 35%',
      'FC sono: 25%',
      'Respiração sono: 12%',
      'Temperatura de pulso: 10%',
      'Oxigênio sono: 8%',
      'Sono: 10%',
    ],
    source: 'Modelo central readiness_v1. Usa apenas sinais associados à janela da noite principal; sinais soltos fora da noite não entram.',
    freshness: 'A noite precisa ter acordado há até 48h. Sinais fisiológicos vêm da janela do sono com margem de 2h.',
    quality: 'Alta quando HRV e FC do sono têm baseline noturno; parcial quando faltam temperatura, oxigênio ou respiração.',
    precision: 'Boa para tendência pessoal e decisão operacional; não é diagnóstico médico.',
    evidence: recoveryComponentEvidence(readiness.nightRecoveryComponents),
    caveats: [
      'Sem baseline pessoal suficiente, o score fica parcial ou sem dado.',
      'Oxigênio e temperatura têm menor peso porque a amostragem pode ser irregular.',
      'Uma noite curta limita o score mesmo com HRV bom.',
    ],
    confidence: readiness.nightRecovery.confidence,
    axisQuality: readiness.axisQuality.nightRecovery,
  }
}

function recoveryMetricDetail(
  label: string,
  what: string,
  why: string,
  inputs: string[],
  freshness: string,
  quality: string,
  precision: string,
  caveats: string[] = [],
): MetricDetail {
  return {
    category: 'Recuperação',
    what,
    why,
    inputs,
    source: 'Recuperação usa primeiro a noite principal validada. Sinais soltos fora da janela noturna não viram verdade forte.',
    freshness,
    quality,
    precision,
    caveats: caveats.length > 0
      ? caveats
      : [
        `${label} deve ser lido contra seu baseline pessoal, não contra uma média genérica.`,
        'Não é diagnóstico médico; serve para decisão operacional e tendência.',
      ],
  }
}

function recoveryComponentEvidence(components: NightRecoveryComponent[]): string[] {
  if (components.length === 0) return ['Sem componentes suficientes para explicar o score.']
  return components.map((component) => {
    const value = typeof component.value === 'number'
      ? formatMetric({ value: component.value, unit: component.unit })
      : 'Sem dado'
    const baseline = typeof component.baseline === 'number'
      ? formatMetric({ value: component.baseline, unit: component.unit })
      : component.key === 'oxygen'
        ? 'ideal >= 95%'
        : 'sem normal'
    const delta = typeof component.delta === 'number'
      ? `${component.delta >= 0 ? '+' : '-'}${formatDelta(Math.abs(component.delta), component.unit)}`
      : 'sem delta'
    const score = typeof component.score === 'number' ? `${Math.round(component.score)}%` : 'sem score'
    return `${component.label}: ${value} · referência ${baseline} · ${delta} · peso ${component.weight}% · ${score}. ${component.summary}`
  })
}

function dayStrainDetail(dayStrain: DayStrain): MetricDetail {
  return {
    category: 'Carga',
    what: 'Strain acumulado do dia em escala 0-21, inspirado em carga cardiovascular e volume total.',
    why: 'Mostra quanto esforço o corpo já recebeu hoje. É diferente de prontidão: quanto maior, mais carga acumulada.',
    inputs: [
      'Carga cardio por zonas',
      'Carga FC ativa',
      'Zonas 4-5',
      'Zonas 2-3',
      'Esforço treino',
      'Energia ativa',
      'Exercício',
      'Passos',
      'Distância',
    ],
    source: 'Modelo central readiness_v1. Prioriza FC de treino quando existe; usa atividade geral como fallback.',
    freshness: 'Atualiza durante o dia conforme HealthKit entrega atividade, energia, treino e FC.',
    quality: 'Alta com treinos usando Apple Watch e zonas de FC. Parcial quando só existem calorias/passos.',
    precision: 'Boa para tendência pessoal e decisão de carga; não mede dano muscular localizado.',
    evidence: loadComponentEvidence(dayStrain.components),
    caveats: [
      'Musculação pode ter strain cardiovascular baixo mesmo com carga muscular alta.',
      'Sem FC de treino, o Atlas reduz confiança e usa volume como aproximação.',
      'O score sobe ao longo do dia e não deve ser comparado com recovery.',
    ],
    confidence: dayStrain.confidence,
  }
}

function loadMetricDetail(
  what: string,
  why: string,
  inputs: string[],
  freshness: string,
  quality: string,
  precision: string,
  caveats: string[] = [],
): MetricDetail {
  return {
    category: 'Carga',
    what,
    why,
    inputs,
    source: 'Carga usa sinais do dia e baseline pessoal. Treinos com FC têm prioridade sobre calorias/passos.',
    freshness,
    quality,
    precision,
    caveats: caveats.length > 0
      ? caveats
      : [
        'Carga é uma métrica acumulativa do dia.',
        'Sem FC durante treino, a precisão cai.',
      ],
  }
}

function loadComponentEvidence(components: LoadComponent[]): string[] {
  if (components.length === 0) return ['Sem componentes suficientes para explicar o strain.']
  return components.map((component) => {
    const value = typeof component.value === 'number'
      ? formatMetric({ value: component.value, unit: component.unit })
      : 'Sem dado'
    const baseline = typeof component.baseline === 'number'
      ? formatMetric({ value: component.baseline, unit: component.unit })
      : 'sem normal'
    const ratio = typeof component.ratio === 'number'
      ? `${Math.round(component.ratio * 100)}% do normal`
      : 'sem razão'
    const contribution = typeof component.strainContribution === 'number'
      ? `${component.strainContribution.toFixed(1).replace('.', ',')} carga bruta`
      : 'sem contribuição'
    return `${component.label}: ${value} · normal ${baseline} · ${ratio} · ${contribution} · peso ${component.weight}%. ${component.summary}`
  })
}

function digitalMetricDetail(
  snapshot: AtlasDigitalActivitySnapshot | null,
  keys: DigitalMetricKey[],
  what: string,
  why: string,
  inputs: string[],
  quality: string,
  precision: string,
  caveats: string[] = [],
): MetricDetail {
  return {
    category: 'Atividade digital',
    what,
    why,
    inputs,
    source: 'Snapshot diário de atividade digital. Hoje a fonte efetiva é Rize no servidor; Screen Time nativo do iPhone só deve entrar quando houver entitlement/captura própria.',
    freshness: 'Métricas digitais são do dia local e expiram no fechamento do dia; a UI não usa snapshot antigo como se fosse hoje.',
    quality,
    precision,
    evidence: digitalEvidence(snapshot, keys),
    caveats: caveats.length > 0
      ? caveats
      : [
        'Tempo de tela medido sem classificação não prova distração.',
        'Pickups e notificações ficam sem dado enquanto a fonte não entregar esses sinais.',
        'Categorias dependem de mapeamento de apps/domínios; sem taxonomia, zero não é assumido.',
      ],
    confidence: snapshot ? digitalDetailConfidence(snapshot, keys) : 0,
  }
}

function screenTimeSourceDetail(screenTime: ScreenTimeLocalStatus): MetricDetail {
  return {
    category: 'Atividade digital',
    what: 'Estado da fonte nativa do iPhone para Screen Time, pickups, notificações e primeiro uso.',
    why: 'Sem fonte nativa, o Atlas não deve fingir que sabe pickups/notificações. Esses campos ficam explicitamente ausentes para proteger a confiabilidade.',
    inputs: ['Autorização Screen Time', 'DeviceActivity/FamilyControls', 'Buckets configurados', 'Última coleta nativa'],
    source: 'Status local do módulo Screen Time no app.',
    freshness: screenTime.lastSyncAt ? `Última tentativa em ${formatDateTime(screenTime.lastSyncAt)}.` : 'Ainda sem coleta nativa válida.',
    quality: screenTime.enabled && screenTime.configuredBucketCount > 0
      ? 'Fonte nativa configurada; ainda depende da entrega dos relatórios do iOS.'
      : 'Fonte nativa indisponível ou sem entitlement. Rize continua cobrindo sessões de desktop/backend, mas não pickups/notificações do iPhone.',
    precision: screenTime.enabled ? 'Alta para eventos nativos quando o entitlement estiver ativo; parcial quando só existe Rize.' : 'Sem precisão para iPhone até ativar a fonte nativa.',
    evidence: [
      `Disponível: ${screenTime.available ? 'sim' : 'não'}.`,
      `Autorizado: ${screenTime.enabled ? 'sim' : 'não'}.`,
      `Buckets configurados: ${screenTime.configuredBucketCount}.`,
      `Sessões nativas recentes: ${screenTime.lastSessionCount}.`,
      screenTime.entitlementRequired ? 'Entitlement nativo ainda necessário.' : 'Entitlement não marcado como pendente.',
    ],
    caveats: [
      'Rize não substitui Screen Time para pickups e notificações do iPhone.',
      'Sem essa fonte, essas métricas ficam Sem dado por design.',
    ],
    confidence: screenTime.enabled && screenTime.configuredBucketCount > 0 ? 0.82 : 0,
  }
}

function checkinLevelDetail(
  kind: 'Energia' | 'Humor',
  checkin: AtlasCheckin | null,
  freshness: number,
): MetricDetail {
  const isEnergy = kind === 'Energia'
  const value = isEnergy ? checkin?.energy_level : checkin?.mood_level
  const label = isEnergy ? energyLevelLabel(value ?? null) : moodLevelLabel(value ?? null)
  return {
    category: 'Check-in',
    what: isEnergy
      ? 'Energia percebida no momento do check-in, em escala de 1 a 5.'
      : 'Humor declarado no momento do check-in, em escala de 1 a 5.',
    why: isEnergy
      ? 'Entra em energia de execução, foco e estado percebido. Ajuda o Atlas não depender só de sensores fisiológicos.'
      : 'Entra em clareza mental, estado percebido e aprendizado de sono ideal por resultado subjetivo.',
    inputs: [isEnergy ? 'energy_level do check-in' : 'mood_level do check-in', 'Horário do registro', 'Decaimento de frescor'],
    source: 'Autorrelato no check-in do Atlas. É dado sensível e operacional, não diagnóstico.',
    freshness: 'Energia e humor valem por até 12h. Depois disso expiram; antes disso decaem gradualmente para neutro.',
    quality: checkin
      ? `Registro presente com ${checkinFreshnessLabel(freshness)}.`
      : 'Sem check-in recente; a métrica fica ausente em vez de reaproveitar dado antigo.',
    precision: 'Alta para percepção atual quando recém-registrado; média para previsão, porque autorrelato varia com contexto.',
    evidence: checkin
      ? [
        `Valor: ${label ? `${label} (${value} / 5)` : `${value} / 5`}.`,
        `Registrado em ${formatDateTime(checkin.recorded_at)}.`,
        `Frescor do sinal: ${percentText(freshness)}.`,
      ]
      : ['Sem check-in válido dentro da janela de 12h.'],
    caveats: [
      'Não deve substituir sono, HRV ou carga; é um eixo complementar.',
      'Um registro antigo não é carregado como verdade atual.',
      'Mudança de contexto forte pode exigir novo check-in.',
    ],
    confidence: checkin ? freshness : 0,
  }
}

function checkinStateDetail(checkin: AtlasCheckin | null, freshness: number): MetricDetail {
  return {
    category: 'Check-in',
    what: 'Estado operacional declarado agora: foco, disperso, bloqueado ou pausa.',
    why: 'É usado para ajustar foco, drive e penalidade cognitiva. Estado atual muda rápido e por isso expira antes de energia/humor.',
    inputs: ['state do check-in', 'Horário do registro', 'TTL curto de 6h'],
    source: 'Autorrelato no check-in do Atlas.',
    freshness: 'Estado vale por até 6h e decai com meia-vida curta. Depois expira para evitar carregar um momento antigo.',
    quality: checkin
      ? `Estado ${checkinStateLabel(checkin.state).toLowerCase()} com ${checkinFreshnessLabel(freshness)}.`
      : 'Sem estado recente; o Atlas não assume foco, dispersão ou bloqueio.',
    precision: 'Boa para o momento declarado; baixa para muitas horas depois. Por isso o TTL é agressivo.',
    evidence: checkin
      ? [
        `Estado: ${checkinStateLabel(checkin.state)}.`,
        `Registrado em ${formatDateTime(checkin.recorded_at)}.`,
        `Frescor do estado: ${percentText(freshness)}.`,
      ]
      : ['Sem check-in de estado válido dentro da janela de 6h.'],
    caveats: [
      'Pode mudar em minutos após uma interrupção, reunião, refeição ou treino.',
      'Quando disperso ou bloqueado, também pode gerar penalidade cognitiva explícita.',
    ],
    confidence: checkin ? freshness : 0,
  }
}

function stateOfMindDetail(metric: MetricValue | null): MetricDetail {
  return {
    category: 'Sinal opcional',
    what: 'Registro emocional opcional importado do Saúde quando já existe.',
    why: 'Serve apenas como contexto fraco quando não há check-in recente; o Atlas não exige esse registro.',
    inputs: ['Registro emocional opcional do Saúde', 'Frescor máximo de 24h'],
    source: 'HealthKit/Saúde, opcional. O humor oficial do Atlas continua sendo o check-in.',
    freshness: 'Só aparece se houver registro nas últimas 24h; valor mais antigo fica sem dado.',
    quality: metric?.value === null || metric?.value === undefined
      ? 'Sem registro emocional recente.'
      : 'Dado complementar. Não substitui energia/humor do check-in quando o check-in está fresco.',
    precision: 'Média-baixa: depende de como e quando o usuário registrou esse estado fora do Atlas.',
    evidence: metric?.value === null || metric?.value === undefined
      ? ['Sem registro emocional recente.']
      : [
        `Valor normalizado: ${formatMetric(stateOfMindMetric(metric))}.`,
        metric.date ? `Registrado em ${formatDateTime(metric.date)}.` : 'Sem horário de registro.',
      ],
    caveats: [
      'Não precisa registrar isso na Apple para usar o Atlas.',
      'Não é o mesmo campo que humor, energia, Estado ou Foco do Atlas.',
      'Pode refletir um momento emocional, não a capacidade operacional inteira.',
    ],
    confidence: typeof metric?.value === 'number' ? 0.55 : 0,
  }
}

function cognitivePenaltyDetail(
  readiness: ReadinessV1Model,
  checkin: AtlasCheckin | null,
  stateFreshness: number,
): MetricDetail {
  return {
    category: 'Check-in',
    what: 'Penalidade aplicada à capacidade agora quando o estado cognitivo ou a pressão digital indicam baixa tração.',
    why: 'Impede que uma boa prontidão fisiológica esconda dispersão, bloqueio ou excesso de estímulo no momento atual.',
    inputs: ['Estado do check-in', 'Frescor do estado', 'Pressão digital', 'Foco acumulado no dia'],
    source: 'Cálculo vivo do readiness. Quanto menor, melhor; ideal é 0 pts.',
    freshness: 'Recalculado agora. O componente de estado só entra enquanto o check-in de estado ainda está fresco.',
    quality: readiness.diagnostics.cognitivePenalty > 0
      ? 'Penalidade ativa; leia as evidências antes de interpretar o score.'
      : 'Sem penalidade cognitiva ativa no momento.',
    precision: 'Média: é uma trava operacional, não uma medição clínica de cognição.',
    evidence: cognitivePenaltyEvidence(readiness, checkin, stateFreshness),
    caveats: [
      'Pode somar com o próprio score subjetivo; isso é intencional quando usado como trava de momento.',
      'Sem fonte digital completa, parte da pressão cognitiva ainda fica parcial.',
    ],
    confidence: readiness.axisQuality.current.confidence,
  }
}

function digitalEvidence(snapshot: AtlasDigitalActivitySnapshot | null, keys: DigitalMetricKey[]): string[] {
  if (!snapshot) return ['Sem snapshot digital válido para hoje.']

  const evidence: string[] = [
    `Snapshot: ${formatDateTime(snapshot.computed_at)}.`,
    `Fonte: ${snapshot.source}.`,
    `Sessões medidas: ${snapshot.signal_count}.`,
  ]

  if (typeof snapshot.total_screen_time_min === 'number') {
    evidence.push(`Tempo de tela medido: ${formatMetric({ value: snapshot.total_screen_time_min * 60, unit: 's' })}.`)
  }

  const classification = digitalClassificationRatio(snapshot)
  evidence.push(
    typeof classification === 'number'
      ? `Classificação de apps: ${Math.round(classification * 100)}% do tempo medido.`
      : 'Classificação de apps: sem cobertura suficiente.',
  )
  const qualityScore = digitalMetadataNumber(snapshot, ['quality', 'score'])
  if (typeof qualityScore === 'number') {
    evidence.push(`Qualidade do snapshot: ${Math.round(qualityScore)}%.`)
  }
  const classificationConfidence = digitalMetadataNumber(snapshot, ['quality', 'classification_confidence_avg'])
  if (typeof classificationConfidence === 'number') {
    evidence.push(`Confiança média dos mapeamentos: ${Math.round(classificationConfidence * 100)}%.`)
  }
  const warnings = digitalMetadataStringArray(snapshot, ['quality', 'warnings'])
  if (warnings.length > 0) {
    evidence.push(`Alertas: ${warnings.join(', ')}.`)
  }

  const unsupported = keys.filter((key) => DIGITAL_UNSUPPORTED_RIZE_KEYS.includes(key))
  if (unsupported.length > 0) {
    evidence.push('Capacidade ausente na fonte atual: pickups, notificações e primeiro uso do iPhone não vêm do Rize.')
  }

  return evidence
}

function digitalDetailConfidence(snapshot: AtlasDigitalActivitySnapshot, keys: DigitalMetricKey[]): number {
  if (keys.length === 0) return digitalDataQualityScore(snapshot) / 100
  const confidences = keys.map((key) => digitalMetricQuality(snapshot, key).confidence ?? 0)
  return confidences.length > 0 ? average(confidences) : 0
}

function normalReference(value?: MetricValue | null): string | null {
  if (!value || typeof value.value !== 'number') return null
  return `normal ${formatMetric(value)}`
}

function latestHealthSnapshot(snapshots: AtlasHealthSnapshot[], now = new Date()): AtlasHealthSnapshot | null {
  const today = localDateKeyFromDate(now)

  return snapshots
    .filter((snapshot) => !snapshot.deleted_at && snapshotDateKey(snapshot.snapshot_date) === today)
    .sort((a, b) => (
      snapshotDateKey(b.snapshot_date).localeCompare(snapshotDateKey(a.snapshot_date))
      || new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime()
    ))[0] ?? null
}

function latestSleepHealthSnapshot(snapshots: AtlasHealthSnapshot[], now = new Date()): AtlasHealthSnapshot | null {
  return snapshots
    .filter((snapshot) => (
      !snapshot.deleted_at
      && hasValidSleepSnapshotData(snapshot)
      && isFreshSleepSnapshot(snapshot, now)
    ))
    .sort((a, b) => snapshotSleepSortTime(b) - snapshotSleepSortTime(a))[0] ?? null
}

function isFreshSleepSnapshot(snapshot: AtlasHealthSnapshot, now: Date): boolean {
  const sleepTime = snapshotSleepSortTime(snapshot)
  const currentTime = now.getTime()
  if (!Number.isFinite(sleepTime) || !Number.isFinite(currentTime) || sleepTime > currentTime) return false
  return currentTime - sleepTime <= SLEEP_RECOVERY_FRESHNESS_HOURS * 3600000
}

function hasValidSleepSnapshotData(snapshot: AtlasHealthSnapshot): boolean {
  const sleep = isRecord(snapshot.sleep) ? snapshot.sleep : null
  const durationHours = sleep ? snapshotNumber(sleep.duration_hours) ?? snapshot.sleep_duration_hours : snapshot.sleep_duration_hours
  const bedtime = sleep && typeof sleep.bedtime === 'string' ? sleep.bedtime : null
  const wakeTime = sleep && typeof sleep.wake_time === 'string' ? sleep.wake_time : null
  return isMainSleepCandidate({ asleepHours: durationHours, bedtime, wakeTime })
}

function snapshotSleepSortTime(snapshot: AtlasHealthSnapshot): number {
  const wakeTime = isRecord(snapshot.sleep) && typeof snapshot.sleep.wake_time === 'string'
    ? snapshot.sleep.wake_time
    : null
  const time = new Date(wakeTime ?? snapshot.computed_at ?? snapshot.snapshot_date).getTime()
  if (Number.isFinite(time)) return time
  return new Date(snapshotDateKey(snapshot.snapshot_date)).getTime()
}

function latestSnapshotMetric(
  snapshot: AtlasHealthSnapshot | null,
  key: HealthSnapshotMetricKey,
  unit: string | null,
): MetricValue {
  if (!snapshot) return { value: null, unit }
  const value = snapshot[key]

  return {
    value: typeof value === 'number' ? value : null,
    unit,
    date: snapshot.computed_at,
  }
}

function previousWeekSnapshotAverage(
  snapshots: AtlasHealthSnapshot[],
  key: HealthSnapshotMetricKey,
  unit: string | null,
): MetricValue | null {
  const range = previousWeekDateRange()
  const matching = snapshots.filter((snapshot) => {
    const date = snapshotDateKey(snapshot.snapshot_date)
    return !snapshot.deleted_at
      && date >= range.start
      && date <= range.end
      && typeof snapshot[key] === 'number'
  })

  if (matching.length === 0) return null

  const latest = matching.sort((a, b) => snapshotDateKey(b.snapshot_date).localeCompare(snapshotDateKey(a.snapshot_date)))[0]
  return {
    value: average(matching.map((snapshot) => Number(snapshot[key]))),
    unit,
    date: latest.computed_at,
  }
}

function previousWeekSnapshotLatest(
  snapshots: AtlasHealthSnapshot[],
  key: HealthSnapshotMetricKey,
  unit: string | null,
): MetricValue | null {
  const range = previousWeekDateRange()
  const snapshot = snapshots
    .filter((item) => {
      const date = snapshotDateKey(item.snapshot_date)
      return !item.deleted_at
        && date >= range.start
        && date <= range.end
        && typeof item[key] === 'number'
    })
    .sort((a, b) => snapshotDateKey(b.snapshot_date).localeCompare(snapshotDateKey(a.snapshot_date)))[0]

  if (!snapshot) return null

  return {
    value: Number(snapshot[key]),
    unit,
    date: snapshot.computed_at,
  }
}

function previousWeekSnapshotJsonMetric(
  snapshots: AtlasHealthSnapshot[],
  section: SnapshotPayloadKey,
  key: string,
  unit: string | null,
): MetricValue | null {
  const range = previousWeekDateRange()
  const snapshot = snapshots
    .filter((item) => {
      const date = snapshotDateKey(item.snapshot_date)
      const payload = item[section]
      return !item.deleted_at
        && date >= range.start
        && date <= range.end
        && isRecord(payload)
        && typeof payload[key] === 'number'
    })
    .sort((a, b) => snapshotDateKey(b.snapshot_date).localeCompare(snapshotDateKey(a.snapshot_date)))[0]

  if (!snapshot) return null
  const payload = snapshot[section]
  return {
    value: isRecord(payload) && typeof payload[key] === 'number' ? payload[key] : null,
    unit,
    date: snapshot.computed_at,
  }
}

function snapshotOrSignal(snapshot: MetricValue, signal: MetricValue): MetricValue {
  if (hasValue(snapshot)) return snapshot
  return signal
}

type SnapshotPayloadKey = 'metrics' | 'readiness' | 'sleep' | 'recovery' | 'load' | 'subjective' | 'body' | 'metadata'

function snapshotJsonMetric(
  snapshot: AtlasHealthSnapshot | null,
  section: SnapshotPayloadKey,
  key: string,
  unit: string | null,
): MetricValue {
  if (!snapshot) return { value: null, unit }
  const payload = snapshot[section]
  const date = section === 'sleep' ? snapshotSleepDate(snapshot) : snapshot.computed_at
  const quality = section === 'sleep' ? snapshotSleepMetricQuality(snapshot, key) : null
  if (!isRecord(payload)) return { value: null, unit, date }
  return {
    value: snapshotNumber(payload[key]),
    unit,
    date,
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function snapshotSleepMetric(
  snapshot: AtlasHealthSnapshot | null,
  key: 'sleep_duration_hours' | 'sleep_efficiency',
  unit: string | null,
): MetricValue {
  const qualityKey = key === 'sleep_duration_hours' ? 'duration_hours' : 'efficiency'
  const quality = snapshot ? snapshotSleepMetricQuality(snapshot, qualityKey) : null
  if (!snapshot || typeof snapshot[key] !== 'number') {
    return {
      value: null,
      unit,
      date: snapshot ? snapshotSleepDate(snapshot) : null,
      confidence: quality?.confidence ?? null,
      qualityLabel: quality?.label ?? null,
    }
  }
  return {
    value: Number(snapshot[key]),
    unit,
    date: snapshotSleepDate(snapshot),
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function snapshotSleepStagePercentMetric(snapshot: AtlasHealthSnapshot | null, key: string): MetricValue {
  if (!snapshot || !isRecord(snapshot.sleep)) return { value: null, unit: '%' }
  const quality = snapshotSleepMetricQuality(snapshot, key)
  const stageHours = snapshotNumber(snapshot.sleep[key])
  const durationHours = snapshotNumber(snapshot.sleep.duration_hours) ?? snapshot.sleep_duration_hours
  if (typeof stageHours !== 'number' || typeof durationHours !== 'number' || durationHours <= 0) {
    return {
      value: null,
      unit: '%',
      date: snapshotSleepDate(snapshot),
      confidence: quality?.confidence ?? null,
      qualityLabel: quality?.label ?? null,
    }
  }
  return {
    value: (stageHours / durationHours) * 100,
    unit: '%',
    date: snapshotSleepDate(snapshot),
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function snapshotSleepAwakePercentMetric(snapshot: AtlasHealthSnapshot | null): MetricValue {
  if (!snapshot || !isRecord(snapshot.sleep)) return { value: null, unit: '%' }
  const quality = snapshotSleepMetricQuality(snapshot, 'awake_percent')
  const stored = snapshotNumber(snapshot.sleep.awake_percent)
  if (typeof stored === 'number') {
    return {
      value: stored,
      unit: '%',
      date: snapshotSleepDate(snapshot),
      confidence: quality?.confidence ?? null,
      qualityLabel: quality?.label ?? null,
    }
  }
  const awakeHours = snapshotSleepAwakeHours(snapshot)
  const inBedHours = snapshotSleepInBedHours(snapshot)
  if (typeof awakeHours !== 'number' || typeof inBedHours !== 'number' || inBedHours <= 0) {
    return {
      value: null,
      unit: '%',
      date: snapshotSleepDate(snapshot),
      confidence: quality?.confidence ?? null,
      qualityLabel: quality?.label ?? null,
    }
  }
  return {
    value: (awakeHours / inBedHours) * 100,
    unit: '%',
    date: snapshotSleepDate(snapshot),
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function snapshotSleepContinuityMetric(snapshot: AtlasHealthSnapshot | null): MetricValue {
  if (!snapshot || !isRecord(snapshot.sleep)) return { value: null, unit: '%' }
  const quality = snapshotSleepMetricQuality(snapshot, 'continuity_percent')
  const stored = snapshotNumber(snapshot.sleep.continuity_percent)
  if (typeof stored === 'number') {
    return {
      value: stored,
      unit: '%',
      date: snapshotSleepDate(snapshot),
      confidence: quality?.confidence ?? null,
      qualityLabel: quality?.label ?? null,
    }
  }
  const awakePercent = snapshotSleepAwakePercentMetric(snapshot)
  return typeof awakePercent.value === 'number'
    ? {
      value: Math.max(0, 100 - awakePercent.value),
      unit: '%',
      date: awakePercent.date,
      confidence: quality?.confidence ?? null,
      qualityLabel: quality?.label ?? null,
    }
    : {
      value: null,
      unit: '%',
      date: snapshotSleepDate(snapshot),
      confidence: quality?.confidence ?? null,
      qualityLabel: quality?.label ?? null,
    }
}

function snapshotSleepStageCoverageMetric(snapshot: AtlasHealthSnapshot | null): MetricValue {
  if (!snapshot || !isRecord(snapshot.sleep)) return { value: null, unit: '%' }
  const quality = snapshotSleepMetricQuality(snapshot, 'stage_coverage')
  const value = snapshotNumber(snapshot.sleep.stage_coverage)
  return {
    value: typeof value === 'number' ? value * 100 : null,
    unit: '%',
    date: snapshotSleepDate(snapshot),
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function snapshotSleepDataQualityMetric(snapshot: AtlasHealthSnapshot | null): MetricValue {
  if (!snapshot || !isRecord(snapshot.sleep)) return { value: null, unit: '%' }
  const quality = snapshotSleepMetricQuality(snapshot, 'sleep_data_quality')
  const value = snapshotNumber(snapshot.sleep.sleep_data_quality)
  const label = typeof snapshot.sleep.sleep_data_quality_label === 'string'
    ? snapshot.sleep.sleep_data_quality_label
    : null
  return {
    value: typeof value === 'number' ? value * 100 : null,
    text: typeof value === 'number' && label ? `${Math.round(value * 100)}% · ${label}` : null,
    unit: '%',
    date: snapshotSleepDate(snapshot),
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function snapshotSleepCaptureStatusMetric(snapshot: AtlasHealthSnapshot | null): MetricValue {
  if (!snapshot || !isRecord(snapshot.sleep)) return { value: null, text: 'Sem dado', date: snapshot ? snapshotSleepDate(snapshot) : null }
  const status = typeof snapshot.sleep.sleep_capture_status === 'string'
    ? snapshot.sleep.sleep_capture_status
    : null
  const label = status === 'complete'
    ? 'Completo'
    : status === 'partial'
      ? 'Parcial'
      : status === 'duration_only'
        ? 'Só duração'
        : 'Sem dado'
  return { value: null, text: label, date: snapshotSleepDate(snapshot) }
}

function snapshotSleepNapMetric(snapshot: AtlasHealthSnapshot | null): MetricValue {
  if (!snapshot || !isRecord(snapshot.sleep)) return { value: null, text: 'Sem dado', date: snapshot ? snapshotSleepDate(snapshot) : null }
  const hours = snapshotNumber(snapshot.sleep.nap_hours)
  const count = snapshotNumber(snapshot.sleep.nap_count)
  if (!count || count <= 0 || typeof hours !== 'number' || hours <= 0) {
    return { value: null, text: 'Sem cochilo', date: snapshotSleepDate(snapshot) }
  }
  return {
    value: null,
    text: `${formatHours(hours)} · ${Math.round(count)}x`,
    date: snapshotSleepDate(snapshot),
  }
}

function snapshotSleepStressMetric(snapshot: AtlasHealthSnapshot | null): MetricValue {
  if (!snapshot || !isRecord(snapshot.sleep)) return { value: null, unit: '%', date: snapshot ? snapshotSleepDate(snapshot) : null }
  const quality = snapshotSleepMetricQuality(snapshot, 'sleep_stress_score')
  const value = snapshotNumber(snapshot.sleep.sleep_stress_score)
  const label = typeof snapshot.sleep.sleep_stress_label === 'string'
    ? snapshot.sleep.sleep_stress_label
    : null
  return {
    value,
    text: typeof value === 'number' && label ? `${Math.round(value)}% · ${label}` : null,
    unit: '%',
    date: snapshotSleepDate(snapshot),
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function snapshotSleepInBedMetric(snapshot: AtlasHealthSnapshot | null): MetricValue {
  const quality = snapshot ? snapshotSleepMetricQuality(snapshot, 'in_bed_hours') : null
  return {
    value: snapshotSleepInBedHours(snapshot),
    unit: 'h',
    date: snapshot ? snapshotSleepDate(snapshot) : null,
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function nightWindowMetric(
  signals: HealthSignal[],
  sleepSnapshot: AtlasHealthSnapshot | null,
  signalTypes: string[],
  unit: string | null,
): MetricValue {
  const matches = nightWindowSignals(signals, sleepSnapshot, signalTypes)
  if (matches.length === 0) {
    return {
      value: null,
      unit,
      date: sleepSnapshot ? snapshotSleepDate(sleepSnapshot) : null,
      confidence: 0,
      qualityLabel: 'sem confiança',
    }
  }

  const values = matches
    .map((signal) => Number(signal.value_numeric))
    .filter((value) => Number.isFinite(value))
  const latest = matches.sort((a, b) => signalEndTime(b) - signalEndTime(a))[0]
  const confidence = matches.length >= 2 ? 0.86 : 0.72
  return {
    value: values.length > 0 ? median(values) : null,
    unit,
    date: latest?.started_at ?? snapshotSleepDate(sleepSnapshot as AtlasHealthSnapshot),
    confidence,
    qualityLabel: qualityStatusLabel(null, confidence),
  }
}

function previousSleepWindowMedian(
  signals: HealthSignal[],
  snapshots: AtlasHealthSnapshot[],
  signalTypes: string[],
  unit: string | null,
): MetricValue | null {
  const validSnapshots = snapshots
    .filter((snapshot) => !snapshot.deleted_at && hasValidSleepSnapshotData(snapshot))
    .sort((a, b) => snapshotSleepSortTime(b) - snapshotSleepSortTime(a))
    .slice(1, 8)
  const values = validSnapshots
    .map((snapshot) => {
      const matches = nightWindowSignals(signals, snapshot, signalTypes)
      const sampleValues = matches
        .map((signal) => Number(signal.value_numeric))
        .filter((value) => Number.isFinite(value))
      return sampleValues.length > 0 ? median(sampleValues) : null
    })
    .filter((value): value is number => typeof value === 'number')

  if (values.length === 0) return null
  return {
    value: median(values),
    unit,
    date: snapshotSleepDate(validSnapshots[0]),
  }
}

function previousSleepPayloadAverage(
  snapshots: AtlasHealthSnapshot[],
  key: string,
  unit: string | null,
): MetricValue | null {
  const validSnapshots = snapshots
    .filter((snapshot) => !snapshot.deleted_at && hasValidSleepSnapshotData(snapshot))
    .sort((a, b) => snapshotSleepSortTime(b) - snapshotSleepSortTime(a))
    .slice(1, 8)
  const values = validSnapshots
    .map((snapshot) => {
      if (!isRecord(snapshot.sleep)) return null
      return snapshotNumber(snapshot.sleep[key])
    })
    .filter((value): value is number => typeof value === 'number')

  if (values.length === 0) return null
  return {
    value: median(values),
    unit,
    date: snapshotSleepDate(validSnapshots[0]),
  }
}

function nightWindowSignals(
  signals: HealthSignal[],
  sleepSnapshot: AtlasHealthSnapshot | null,
  signalTypes: string[],
): HealthSignal[] {
  const window = sleepSnapshot ? recoveryWindowFromSleepSnapshot(sleepSnapshot) : null
  if (!window) return []
  return signals
    .filter((signal) => (
      signalTypes.includes(signal.signal_type)
      && typeof signal.value_numeric === 'number'
      && signalOverlapsRange(signal, window)
    ))
}

function recoveryWindowFromSleepSnapshot(snapshot: AtlasHealthSnapshot): { start: number; end: number } | null {
  const bedtime = snapshotSleepText(snapshot, 'bedtime')
  const wakeTime = snapshotSleepText(snapshot, 'wake_time')
  if (!bedtime || !wakeTime) return null
  const start = new Date(bedtime).getTime()
  const end = new Date(wakeTime).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return {
    start: start - 2 * 3600000,
    end: end + 2 * 3600000,
  }
}

function signalOverlapsRange(signal: HealthSignal, range: { start: number; end: number }): boolean {
  const start = new Date(signal.started_at).getTime()
  const rawEnd = new Date(signal.ended_at ?? signal.started_at).getTime()
  if (!Number.isFinite(start)) return false
  const end = Number.isFinite(rawEnd) && rawEnd > start ? rawEnd : start + 1
  return Math.max(start, range.start) < Math.min(end, range.end)
}

function snapshotSleepInBedHours(snapshot: AtlasHealthSnapshot | null): number | null {
  if (!snapshot || !isRecord(snapshot.sleep)) return null
  const stored = snapshotNumber(snapshot.sleep.in_bed_hours)
  if (typeof stored === 'number') return stored
  const durationHours = snapshotNumber(snapshot.sleep.duration_hours) ?? snapshot.sleep_duration_hours
  const awakeHours = snapshotSleepAwakeHours(snapshot)
  if (typeof durationHours === 'number' && typeof awakeHours === 'number') {
    return durationHours + awakeHours
  }
  return null
}

function snapshotSleepAwakeHours(snapshot: AtlasHealthSnapshot | null): number | null {
  if (!snapshot || !isRecord(snapshot.sleep)) return null
  return snapshotNumber(snapshot.sleep.awake_hours)
}

function snapshotSleepDate(snapshot: AtlasHealthSnapshot): string {
  if (isRecord(snapshot.sleep) && typeof snapshot.sleep.wake_time === 'string' && snapshot.sleep.wake_time.trim()) {
    return snapshot.sleep.wake_time
  }
  return snapshot.computed_at
}

function snapshotSleepText(snapshot: AtlasHealthSnapshot | null, key: string): string | null {
  if (!snapshot || !isRecord(snapshot.sleep)) return null
  const value = snapshot.sleep[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function snapshotSleepMetricQuality(snapshot: AtlasHealthSnapshot, key: string): { confidence: number; label: string; reason: string | null } | null {
  if (!isRecord(snapshot.sleep) || !isRecord(snapshot.sleep.metric_quality)) return null
  const quality = snapshot.sleep.metric_quality[key]
  if (!isRecord(quality)) return null
  const confidence = snapshotNumber(quality.confidence)
  const status = typeof quality.status === 'string' ? quality.status : null
  const reason = typeof quality.reason === 'string' ? quality.reason : null
  if (typeof confidence !== 'number' && !status) return null
  return {
    confidence: typeof confidence === 'number' ? confidence : 0,
    label: qualityStatusLabel(status, confidence),
    reason,
  }
}

function qualityStatusLabel(status: string | null, confidence?: number | null): string {
  const label = status === 'alta'
    ? 'alta confiança'
    : status === 'parcial'
      ? 'confiança parcial'
      : status === 'baixa'
        ? 'baixa confiança'
        : status === 'sem dado'
          ? 'sem confiança'
          : typeof confidence === 'number' && confidence >= 0.78
            ? 'alta confiança'
            : typeof confidence === 'number' && confidence >= 0.48
              ? 'confiança parcial'
              : typeof confidence === 'number' && confidence > 0
                ? 'baixa confiança'
                : 'sem confiança'
  return label
}

function scoreMetric(score: number | null, date?: string | null): MetricValue {
  return typeof score === 'number'
    ? { value: clamp(Math.round(score), 0, 100), unit: '%', date }
    : { value: null, unit: '%', date }
}

function ratioPercentMetric(value: number | null, date?: string | null): MetricValue {
  return typeof value === 'number' ? { value: value * 100, unit: '%', date } : { value: null, unit: '%', date }
}

function sleepTargetEvidenceMetric(evidence: SleepTargetEvidence): MetricValue {
  const method = evidence.method === 'outcome'
    ? 'resultado pessoal'
    : evidence.method === 'duration'
      ? 'padrão pessoal'
      : 'mínimo aceitável'
  const adjustment = sleepNeedAdjustmentText(evidence)

  return {
    value: null,
    text: adjustment
      ? `${method} · ${adjustment}`
      : `${method} · ${evidence.sampleCount} noites · ${evidence.outcomeSampleCount} com resultado`,
  }
}

function sleepTargetRowLabel(evidence: SleepTargetEvidence): string {
  if (
    evidence.sleepDebtAdjustmentHours > 0
    || evidence.strainAdjustmentHours > 0
    || evidence.napAdjustmentHours > 0
  ) {
    return 'Necessidade de sono'
  }
  return evidence.method === 'minimum' ? 'Mínimo aceitável' : 'Alvo de sono'
}

function sleepObservedNightsMetric(model: ReadinessV1Model): MetricValue {
  const nights = model.axisQuality.sleep.baselineDays
  return typeof nights === 'number'
    ? { value: null, text: `${nights}/7 noites`, date: model.computedAt }
    : { value: null, text: 'Sem histórico recente', date: model.computedAt }
}

function sleepNeedAdjustmentText(evidence: SleepTargetEvidence): string | null {
  const parts = [`base ${formatHours(evidence.baselineHours)}`]
  if (evidence.sleepDebtAdjustmentHours > 0) parts.push(`dívida +${formatHours(evidence.sleepDebtAdjustmentHours)}`)
  if (evidence.strainAdjustmentHours > 0) parts.push(`carga +${formatHours(evidence.strainAdjustmentHours)}`)
  if (evidence.napAdjustmentHours > 0) parts.push(`cochilo -${formatHours(evidence.napAdjustmentHours)}`)
  if (parts.length === 1) return null
  return parts.join(' · ')
}

function snapshotSleepRegularityMetric(snapshots: AtlasHealthSnapshot[], date: string): MetricValue {
  const minutes = snapshots
    .filter((snapshot) => !snapshot.deleted_at && isRecord(snapshot.sleep) && typeof snapshot.sleep.bedtime === 'string')
    .sort((a, b) => snapshotDateKey(b.snapshot_date).localeCompare(snapshotDateKey(a.snapshot_date)))
    .slice(0, 7)
    .map((snapshot) => clockMinuteForSleep(String((snapshot.sleep as Record<string, unknown>).bedtime)))
    .filter((value): value is number => typeof value === 'number')

  if (minutes.length < 3) return { value: null, unit: 'min', date }
  const baseline = median(minutes)
  return {
    value: average(minutes.map((value) => Math.abs(value - baseline))),
    unit: 'min',
    date,
  }
}

function sleepStageReference(
  snapshots: AtlasHealthSnapshot[],
  key: string,
  targetHours: number,
  minRatio: number,
  maxRatio: number,
  mode: 'hours' | 'percent',
): string {
  const range = sleepStagePersonalPercentRange(snapshots, key)
  if (range) {
    if (mode === 'hours') {
      return `seu normal ${formatHours(targetHours * (range.min / 100))}-${formatHours(targetHours * (range.max / 100))}`
    }
    return `seu normal ${Math.round(range.min)}-${Math.round(range.max)}%`
  }

  return mode === 'hours'
    ? idealSleepStageHours(targetHours, minRatio, maxRatio)
    : `ideal ${Math.round(minRatio * 100)}-${Math.round(maxRatio * 100)}%`
}

function sleepStagePersonalPercentRange(
  snapshots: AtlasHealthSnapshot[],
  key: string,
): { min: number; max: number } | null {
  const values = snapshots
    .filter((snapshot) => !snapshot.deleted_at && isRecord(snapshot.sleep) && hasValidSleepSnapshotData(snapshot))
    .sort((a, b) => snapshotDateKey(b.snapshot_date).localeCompare(snapshotDateKey(a.snapshot_date)))
    .slice(0, 28)
    .map((snapshot) => {
      const sleep = snapshot.sleep as Record<string, unknown>
      const stageHours = snapshotNumber(sleep[key])
      const durationHours = snapshotNumber(sleep.duration_hours) ?? snapshot.sleep_duration_hours
      return typeof stageHours === 'number' && typeof durationHours === 'number' && durationHours > 0
        ? (stageHours / durationHours) * 100
        : null
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  if (values.length < 7) return null
  return {
    min: quantile(values, 0.25),
    max: quantile(values, 0.75),
  }
}

function idealSleepStageHours(baseHours: number, minRatio: number, maxRatio: number): string {
  return `ideal ${formatHours(baseHours * minRatio)}-${formatHours(baseHours * maxRatio)}`
}

function sumMetricValues(first: MetricValue, second: MetricValue, unit: string): MetricValue {
  if (typeof first.value !== 'number' || typeof second.value !== 'number') return { value: null, unit }
  return {
    value: first.value + second.value,
    unit,
    date: first.date ?? second.date,
  }
}

function coalesceMetricValue(...values: MetricValue[]): MetricValue {
  return values.find(hasValue) ?? values[0] ?? { value: null }
}

function fatMassMetric(weight: MetricValue, bodyFat: MetricValue): MetricValue {
  if (typeof weight.value !== 'number' || typeof bodyFat.value !== 'number') return { value: null, unit: 'kg' }
  return {
    value: weight.value * (bodyFat.value / 100),
    unit: 'kg',
    date: bodyFat.date ?? weight.date,
  }
}

function leanMassMetric(weight: MetricValue, bodyFat: MetricValue, directLean: MetricValue): MetricValue {
  if (typeof directLean.value === 'number') return { ...directLean, unit: directLean.unit ?? 'kg' }
  if (typeof weight.value !== 'number' || typeof bodyFat.value !== 'number') return { value: null, unit: 'kg' }
  return {
    value: weight.value * (1 - bodyFat.value / 100),
    unit: 'kg',
    date: bodyFat.date ?? weight.date,
    confidence: 0.72,
    qualityLabel: 'derivada',
  }
}

function leanMassPercentMetric(weight: MetricValue, leanMass: MetricValue): MetricValue {
  if (typeof weight.value !== 'number' || typeof leanMass.value !== 'number' || weight.value <= 0) {
    return { value: null, unit: '%' }
  }

  return {
    value: (leanMass.value / weight.value) * 100,
    unit: '%',
    date: leanMass.date ?? weight.date,
    confidence: leanMass.qualityLabel === 'derivada' ? 0.72 : null,
    qualityLabel: leanMass.qualityLabel === 'derivada' ? 'derivada' : null,
  }
}

function bmiMetric(weight: MetricValue, height: MetricValue, directBmi: MetricValue): MetricValue {
  if (typeof directBmi.value === 'number') return directBmi
  if (typeof weight.value !== 'number' || typeof height.value !== 'number' || height.value <= 0) return { value: null }

  return {
    value: weight.value / (height.value * height.value),
    date: weight.date ?? height.date,
    confidence: 0.9,
    qualityLabel: 'derivado',
  }
}

function withMetricQuality(value: MetricValue, qualityLabel: string, confidence: number): MetricValue {
  if (!hasValue(value)) return value
  return {
    ...value,
    confidence: value.confidence ?? confidence,
    qualityLabel: value.qualityLabel ?? metricQualityLabel(value, qualityLabel),
  }
}

function metricQualityLabel(value: MetricValue, qualityLabel: string): string {
  if (qualityLabel.includes(' · ')) return qualityLabel
  const source = metricSourceLabel(value.source)
  return source ? `${source} · ${qualityLabel}` : qualityLabel
}

function metricSourceLabel(source?: string | null): string | null {
  if (source === 'healthkit') return 'HealthKit'
  if (source === 'manual') return 'manual'
  if (source === 'rize') return 'Rize'
  return null
}

function bodyMetricQualityLabel(
  snapshot: AtlasHealthSnapshot | null,
  key: string,
  fallback: string,
): string {
  const source = bodyQualitySource(snapshot, key)
  if (!source) return fallback
  if (source === 'derivada' || source === 'modelo') return `${source} · ${fallback}`
  return `${source} · ${fallback}`
}

function bodyQualitySource(snapshot: AtlasHealthSnapshot | null, key: string): string | null {
  const body = snapshot?.body
  if (!isRecord(body) || !isRecord(body.body_quality)) return null
  const value = body.body_quality[key]
  if (typeof value !== 'string') return null
  if (value.startsWith('healthkit:')) return 'HealthKit'
  if (value === 'manual') return 'manual'
  if (value.startsWith('derived_from_')) return 'derivada'
  if (value === 'mifflin_st_jeor') return 'modelo'
  return null
}

function confidenceReference(value: MetricValue): string | null {
  if (!hasValue(value) || typeof value.confidence !== 'number') return null
  if (value.confidence >= 0.85) return 'conf. alta'
  if (value.confidence >= 0.68) return 'conf. média'
  return 'conf. baixa'
}

function compositeMetricDetail(
  category: string,
  what: string,
  why: string,
  inputs: string[],
  source: string,
  freshness: string,
  quality: string,
  precision: string,
  caveats: string[],
  evidence?: string[],
  confidence?: number | null,
): MetricDetail {
  return {
    category,
    what,
    why,
    inputs,
    source,
    freshness,
    quality,
    precision,
    caveats,
    evidence,
    confidence,
  }
}

function compositeMetricEvidence(...items: Array<[string, MetricValue | null | undefined]>): string[] {
  const evidence = items
    .filter((item): item is [string, MetricValue] => Boolean(item[1]))
    .map(([label, metric]) => {
      const confidence = typeof metric.confidence === 'number'
        ? ` · conf. ${Math.round(metric.confidence * 100)}%`
        : ''
      const date = metric.date ? ` · ${formatDateTime(metric.date)}` : ''
      return `${label}: ${formatMetric(metric)}${date}${confidence}.`
    })

  return evidence.length > 0 ? evidence : ['Sem sinais suficientes para explicar esta métrica.']
}

function overloadRiskMetric(input: {
  readiness: ReadinessV1Model
  strain: MetricValue
  highZoneMinutes: MetricValue
  sleepDebt: MetricValue
}): MetricValue {
  const computedAt = input.readiness.computedAt
  const components: WeightedMetricComponent[] = [
    weightedMetricComponent(metricScale(input.strain, 8, 18), 0.26, input.strain.confidence ?? input.readiness.dayStrain.confidence),
    weightedMetricComponent(ratioRiskScore(input.readiness.dayStrain.loadRatio ?? input.readiness.loadRatio, 0.85, 1.35), 0.20, input.readiness.axisQuality.load.confidence),
    weightedMetricComponent(ratioRiskScore(input.readiness.dayStrain.acuteChronic, 0.9, 1.45), 0.15, input.readiness.axisQuality.load.confidence),
    weightedMetricComponent(metricScale(input.highZoneMinutes, 8, 45), 0.15, input.highZoneMinutes.confidence ?? input.readiness.axisQuality.load.confidence),
    weightedMetricComponent(metricScale(input.sleepDebt, 0.75, 5), 0.12, input.readiness.axisQuality.sleep.confidence),
    weightedMetricComponent(inverseScore(input.readiness.nightRecovery.score), 0.12, input.readiness.axisQuality.nightRecovery.confidence),
  ]
  const score = weightedMetricScore(components)
  if (score === null) return { value: null, unit: '%', date: computedAt, confidence: 0, qualityLabel: 'sem base' }

  return {
    value: Math.round(score),
    unit: '%',
    date: computedAt,
    confidence: weightedMetricConfidence(components),
    qualityLabel: score >= 75 ? 'risco alto' : score >= 55 ? 'risco moderado' : score >= 35 ? 'atenção' : 'baixo risco',
  }
}

function cardiovascularEfficiencyMetric(input: {
  wakingHrAvg: MetricValue
  workoutHrAvg: MetricValue
  steps: MetricValue
  distance: MetricValue
  activeEnergy: MetricValue
  cardioLoad: MetricValue
  vo2max: MetricValue
}): MetricValue {
  const hrComponents: WeightedMetricComponent[] = [
    weightedMetricComponent(inverseMetricScale(input.wakingHrAvg, 65, 105), 0.55, input.wakingHrAvg.confidence),
    weightedMetricComponent(inverseMetricScale(input.workoutHrAvg, 120, 172), 0.45, input.workoutHrAvg.confidence),
  ]
  const outputComponents: WeightedMetricComponent[] = [
    weightedMetricComponent(metricScale(input.steps, 2500, 12000), 0.30, input.steps.confidence),
    weightedMetricComponent(metricScale(input.distance, 1000, 9000), 0.22, input.distance.confidence),
    weightedMetricComponent(metricScale(input.activeEnergy, 120, 850), 0.22, input.activeEnergy.confidence),
    weightedMetricComponent(metricScale(input.cardioLoad, 5, 70), 0.16, input.cardioLoad.confidence),
    weightedMetricComponent(metricScale(input.vo2max, 28, 55), 0.10, input.vo2max.confidence),
  ]
  const hrScore = weightedMetricScore(hrComponents)
  const outputScore = weightedMetricScore(outputComponents)
  if (hrScore === null || outputScore === null) {
    return { value: null, unit: '%', date: input.wakingHrAvg.date ?? input.workoutHrAvg.date ?? input.steps.date, confidence: 0, qualityLabel: 'sem par FC/volume' }
  }

  const vo2Score = metricScale(input.vo2max, 28, 55)
  const combined = weightedMetricScore([
    weightedMetricComponent(hrScore, 0.46, weightedMetricConfidence(hrComponents)),
    weightedMetricComponent(outputScore, 0.44, weightedMetricConfidence(outputComponents)),
    weightedMetricComponent(vo2Score, 0.10, input.vo2max.confidence),
  ])
  const score = combined ?? (hrScore + outputScore) / 2
  const confidence = weightedMetricConfidence([
    ...hrComponents,
    ...outputComponents,
  ])

  return {
    value: Math.round(score),
    unit: '%',
    date: input.workoutHrAvg.date ?? input.wakingHrAvg.date ?? input.steps.date ?? input.activeEnergy.date,
    confidence,
    qualityLabel: score >= 78 ? 'eficiente' : score >= 58 ? 'adequada' : 'custo alto',
  }
}

function sleepStabilityMetric(input: {
  sleepScore: MetricValue
  regularity: MetricValue
  efficiency: MetricValue
  continuity: MetricValue
  sleepDebt7d: MetricValue
  observedNights: number | null
}): MetricValue {
  const components: WeightedMetricComponent[] = [
    weightedMetricComponent(metricScoreValue(input.sleepScore), 0.24, input.sleepScore.confidence),
    weightedMetricComponent(metricScoreValue(input.regularity), 0.22, input.regularity.confidence),
    weightedMetricComponent(metricScoreValue(input.efficiency), 0.18, input.efficiency.confidence),
    weightedMetricComponent(metricScoreValue(input.continuity), 0.16, input.continuity.confidence),
    weightedMetricComponent(inverseMetricScale(input.sleepDebt7d, 0, 5.5), 0.14, input.sleepDebt7d.confidence),
    weightedMetricComponent(typeof input.observedNights === 'number' ? clamp((input.observedNights / 7) * 100, 0, 100) : null, 0.06, 0.75),
  ]
  const score = weightedMetricScore(components)
  if (score === null) return { value: null, unit: '%', date: input.sleepScore.date, confidence: 0, qualityLabel: 'sem sono' }

  return {
    value: Math.round(score),
    unit: '%',
    date: input.sleepScore.date ?? input.regularity.date ?? input.efficiency.date,
    confidence: weightedMetricConfidence(components),
    qualityLabel: score >= 85 ? 'estável' : score >= 68 ? 'parcial' : 'instável',
  }
}

function cognitivePressureMetric(input: {
  algorithmicPressurePercent: MetricValue
  fragmentation: MetricValue
  firstOffensiveUse: MetricValue
  intentionality: MetricValue
  deepWork: MetricValue
  cognitivePenalty: number
  computedAt: string
}): MetricValue {
  const firstDistractionScore = typeof input.firstOffensiveUse.value === 'number'
    ? 100 - metricScaleNumber(input.firstOffensiveUse.value / 60, 0, 150)
    : null
  const deepWorkProtection = typeof input.deepWork.value === 'number'
    ? 100 - metricScaleNumber(input.deepWork.value / 60, 0, 180)
    : null
  const cognitivePenaltyScore = input.cognitivePenalty > 0
    ? metricScaleNumber(input.cognitivePenalty, 0, 25)
    : null
  const components: WeightedMetricComponent[] = [
    weightedMetricComponent(metricScale(input.algorithmicPressurePercent, 20, 70), 0.28, input.algorithmicPressurePercent.confidence),
    weightedMetricComponent(metricScale(input.fragmentation, 2, 12), 0.18, input.fragmentation.confidence),
    weightedMetricComponent(firstDistractionScore, 0.16, input.firstOffensiveUse.confidence),
    weightedMetricComponent(inverseMetricScore(input.intentionality), 0.16, input.intentionality.confidence),
    weightedMetricComponent(deepWorkProtection, 0.12, input.deepWork.confidence),
    weightedMetricComponent(cognitivePenaltyScore, 0.10, input.cognitivePenalty > 0 ? 0.82 : 0),
  ]
  const score = weightedMetricScore(components)
  if (score === null) return { value: null, unit: '%', date: input.computedAt, confidence: 0, qualityLabel: 'sem digital' }

  return {
    value: Math.round(score),
    unit: '%',
    date: input.computedAt,
    confidence: weightedMetricConfidence(components),
    qualityLabel: score >= 68 ? 'pressão alta' : score >= 42 ? 'pressão média' : 'pressão baixa',
  }
}

function performanceWindowMetric(input: {
  readiness: ReadinessV1Model
  overloadRisk: MetricValue
  cognitivePressure: MetricValue
  computedAt: string
}): MetricValue {
  const components: WeightedMetricComponent[] = [
    weightedMetricComponent(input.readiness.current.score, 0.30, input.readiness.axisQuality.current.confidence),
    weightedMetricComponent(input.readiness.focus.score, 0.20, input.readiness.axisQuality.focus.confidence),
    weightedMetricComponent(input.readiness.body.score, 0.15, input.readiness.axisQuality.body.confidence),
    weightedMetricComponent(input.readiness.nightRecovery.score, 0.12, input.readiness.axisQuality.nightRecovery.confidence),
    weightedMetricComponent(input.readiness.load.score, 0.10, input.readiness.axisQuality.load.confidence),
    weightedMetricComponent(inverseMetricScore(input.overloadRisk), 0.07, input.overloadRisk.confidence),
    weightedMetricComponent(inverseMetricScore(input.cognitivePressure), 0.06, input.cognitivePressure.confidence),
  ]
  const score = weightedMetricScore(components)
  if (score === null) return { value: null, unit: '%', date: input.computedAt, confidence: 0, qualityLabel: 'sem base' }

  return {
    value: Math.round(score),
    unit: '%',
    date: input.computedAt,
    confidence: weightedMetricConfidence(components),
    qualityLabel: score >= 78 ? 'janela forte' : score >= 62 ? 'boa janela' : score >= 45 ? 'janela leve' : 'evitar pico',
  }
}

function paceOfAgingMetric(
  snapshots: AtlasHealthSnapshot[],
  current: AtlasPhysiologicalAgeModel,
): MetricValue {
  const currentAge = current.ageYears
  if (typeof currentAge !== 'number') {
    return {
      value: null,
      text: 'Base em formação',
      unit: 'x',
      date: current.computedAt,
      confidence: current.confidence,
      qualityLabel: physiologicalAgeStatusLabel(current.status),
    }
  }

  const currentTime = new Date(current.computedAt).getTime()
  const baseline = snapshots
    .filter((snapshot) => !snapshot.deleted_at)
    .map((snapshot) => {
      const payload = atlasPhysiologicalAgePayload(snapshot)
      const age = snapshotNumber(payload?.age_years)
      const time = new Date(snapshot.computed_at).getTime()
      const confidence = snapshotNumber(payload?.confidence)
      return typeof age === 'number' && Number.isFinite(time)
        ? { age, time, computedAt: snapshot.computed_at, confidence }
        : null
    })
    .filter((item): item is { age: number; time: number; computedAt: string; confidence: number | null } => (
      item !== null && currentTime - item.time >= 45 * 86400000
    ))
    .sort((a, b) => a.time - b.time)[0]

  if (!baseline) {
    return {
      value: null,
      text: 'Histórico insuficiente',
      unit: 'x',
      date: current.computedAt,
      confidence: current.confidence * 0.35,
      qualityLabel: 'precisa 45d',
    }
  }

  const elapsedYears = (currentTime - baseline.time) / (365.25 * 86400000)
  if (!Number.isFinite(elapsedYears) || elapsedYears <= 0) {
    return { value: null, text: 'Histórico insuficiente', unit: 'x', date: current.computedAt, confidence: 0, qualityLabel: 'sem janela' }
  }

  const pace = clamp((currentAge - baseline.age) / elapsedYears, 0, 3)
  const historyConfidence = clamp(elapsedYears / 0.5, 0.25, 1)
  const baselineConfidence = typeof baseline.confidence === 'number' ? baseline.confidence : 0.55

  return {
    value: pace,
    unit: 'x',
    date: current.computedAt,
    confidence: clamp(current.confidence * baselineConfidence * historyConfidence, 0, 0.9),
    qualityLabel: pace <= 0.85 ? 'desacelerado' : pace <= 1.08 ? 'estável' : pace <= 1.25 ? 'acelerado' : 'alto ritmo',
  }
}

function metabolicProfileMetric(input: {
  waist: MetricValue
  height: MetricValue
  bmi: MetricValue
  bodyFat: MetricValue
  leanMassPercent: MetricValue
  biologicalSex: MetricValue
  computedAt: string
}): MetricValue {
  const sex = biologicalSexLabel(input.biologicalSex.value)
  const waistHeightRatio = typeof input.waist.value === 'number' && typeof input.height.value === 'number' && input.height.value > 0
    ? input.waist.value / (input.height.value * 100)
    : null
  const bodyFatRange = sex === 'female'
    ? { low: 16, idealHigh: 30, high: 40 }
    : { low: 8, idealHigh: 22, high: 32 }
  const leanTarget = sex === 'female' ? 66 : 75
  const components: WeightedMetricComponent[] = [
    weightedMetricComponent(waistHeightProfileScore(waistHeightRatio), 0.34, averageMetricConfidence([input.waist, input.height])),
    weightedMetricComponent(bmiProfileScore(input.bmi.value), 0.22, input.bmi.confidence),
    weightedMetricComponent(bodyFatProfileScore(input.bodyFat.value, bodyFatRange), 0.28, input.bodyFat.confidence),
    weightedMetricComponent(metricScale(input.leanMassPercent, leanTarget - 8, leanTarget + 4), 0.16, input.leanMassPercent.confidence),
  ]
  const score = weightedMetricScore(components)
  if (score === null) return { value: null, unit: '%', date: input.computedAt, confidence: 0, qualityLabel: 'sem base' }

  return {
    value: Math.round(score),
    unit: '%',
    date: input.computedAt,
    confidence: weightedMetricConfidence(components),
    qualityLabel: score >= 82 ? 'favorável' : score >= 64 ? 'adequado' : score >= 45 ? 'atenção' : 'risco alto',
  }
}

function bodyCompositionQualityMetric(input: {
  weight: MetricValue
  bodyFat: MetricValue
  leanMass: MetricValue
  waist: MetricValue
  height: MetricValue
  bmi: MetricValue
  computedAt: string
}): MetricValue {
  const components: WeightedMetricComponent[] = [
    weightedMetricComponent(bodyMetricReliabilityScore(input.weight, 45), 0.20, input.weight.confidence),
    weightedMetricComponent(bodyMetricReliabilityScore(input.bodyFat, 120), 0.22, input.bodyFat.confidence),
    weightedMetricComponent(bodyMetricReliabilityScore(input.leanMass, 120), 0.16, input.leanMass.confidence),
    weightedMetricComponent(bodyMetricReliabilityScore(input.waist, 180), 0.15, input.waist.confidence),
    weightedMetricComponent(bodyMetricReliabilityScore(input.height, 3650), 0.15, input.height.confidence),
    weightedMetricComponent(bodyMetricReliabilityScore(input.bmi, 45), 0.12, input.bmi.confidence),
  ]
  const score = weightedMetricCompletenessScore(components)
  if (score === null) return { value: null, unit: '%', date: input.computedAt, confidence: 0, qualityLabel: 'sem dados' }

  return {
    value: Math.round(score),
    unit: '%',
    date: input.computedAt,
    confidence: clamp(score / 100, 0, 0.96),
    qualityLabel: score >= 82 ? 'auditável' : score >= 62 ? 'parcial' : 'frágil',
  }
}

function paceOfAgingDetail(metric: MetricValue, model: AtlasPhysiologicalAgeModel): MetricDetail {
  return compositeMetricDetail(
    'Healthspan Atlas',
    'Velocidade estimada de mudança da Idade Fisiológica Atlas em relação ao tempo cronológico.',
    'Ajuda diferenciar idade fisiológica atual de tendência: a idade pode estar boa, mas acelerando, ou alta, mas melhorando.',
    ['Idade Fisiológica Atlas atual', 'Primeira leitura histórica válida com pelo menos 45 dias', 'Tempo decorrido'],
    'Cálculo local derivado do histórico de snapshots Atlas; não usa idade corporal externa.',
    'Só fica numérico depois de existir janela histórica suficiente. Antes disso mostra histórico insuficiente.',
    'Boa apenas para tendência lenta; confiança reduzida quando a janela histórica é curta.',
    'Média para direção longitudinal; não é marcador clínico de envelhecimento biológico.',
    [
      'Mudanças de versão do modelo podem deslocar o ritmo até haver nova base consistente.',
      'Leituras de poucos meses são sensíveis a ruído de VO2max, composição e sono.',
    ],
    [
      `Pace atual: ${formatMetric(metric)}.`,
      `Idade fisiológica atual: ${formatMetric(atlasPhysiologicalAgeMetric(model))}.`,
      `Cobertura do modelo: ${Math.round(model.coverage * 100)}%.`,
    ],
    metric.confidence,
  )
}

function metabolicProfileDetail(
  metric: MetricValue,
  waist: MetricValue,
  height: MetricValue,
  bmi: MetricValue,
  bodyFat: MetricValue,
  leanMassPercent: MetricValue,
): MetricDetail {
  const waistHeightRatio = typeof waist.value === 'number' && typeof height.value === 'number' && height.value > 0
    ? waist.value / (height.value * 100)
    : null
  return compositeMetricDetail(
    'Composição corporal',
    'Score de perfil metabólico estrutural a partir de cintura/altura, IMC, gordura corporal e massa magra percentual.',
    'Dá uma leitura compacta de risco estrutural sem transformar peso isolado em julgamento de saúde.',
    ['Cintura/altura', 'IMC', 'Gordura corporal', 'Massa magra %'],
    'Cálculo local sobre últimas medidas válidas; não cria diagnóstico e não depende de atualização diária.',
    'Altura pode ser estável; cintura, peso e composição usam última medição válida com confiança explícita.',
    'Boa quando há cintura e gordura corporal recentes; parcial quando depende só de IMC.',
    'Média para triagem pessoal. Cintura/altura é robusta; bioimpedância e gordura corporal variam por método.',
    [
      'Não diagnostica síndrome metabólica, diabetes ou risco cardiovascular clínico.',
      'Atletas muito musculosos podem ter IMC alto sem o mesmo significado metabólico.',
    ],
    [
      waistHeightRatio === null ? 'Cintura/altura: sem dado.' : `Cintura/altura: ${waistHeightRatio.toFixed(2).replace('.', ',')}.`,
      `IMC: ${formatMetric(bmi)}.`,
      `Gordura corporal: ${formatMetric(bodyFat)}.`,
      `Massa magra %: ${formatMetric(leanMassPercent)}.`,
      `Score: ${formatMetric(metric)}.`,
    ],
    metric.confidence,
  )
}

function bodyCompositionQualityDetail(
  metric: MetricValue,
  weight: MetricValue,
  bodyFat: MetricValue,
  leanMass: MetricValue,
  waist: MetricValue,
  height: MetricValue,
  bmi: MetricValue,
): MetricDetail {
  return compositeMetricDetail(
    'Composição corporal',
    'Score de confiabilidade dos dados de composição corporal, separado do resultado físico.',
    'Impede que métricas derivadas pareçam mais sólidas do que os dados que as sustentam.',
    ['Peso', 'Gordura corporal', 'Massa magra', 'Cintura', 'Altura', 'IMC'],
    'Cálculo local usando presença, frescor e confiança de cada medida. Altura aceita janela longa porque é estável.',
    'Peso e IMC esperam medida mais recente; altura tolera anos; cintura/gordura/massa magra toleram janelas intermediárias.',
    'Alta quando as medidas principais existem e têm fonte clara; parcial quando composição depende de estimativa antiga.',
    'Alta para auditoria de integridade dos dados; não mede saúde diretamente.',
    [
      'Score baixo não significa corpo ruim; significa base de dados fraca.',
      'Atualizações manuais de altura e cintura entram como fonte válida quando passam pelas faixas fisiológicas.',
    ],
    compositeMetricEvidence(
      ['Peso', weight],
      ['Gordura corporal', bodyFat],
      ['Massa magra', leanMass],
      ['Cintura', waist],
      ['Altura', height],
      ['IMC', bmi],
      ['Qualidade', metric],
    ),
    metric.confidence,
  )
}

interface WeightedMetricComponent {
  score: number | null
  weight: number
  confidence: number | null
}

function weightedMetricComponent(score: number | null, weight: number, confidence?: number | null): WeightedMetricComponent {
  return {
    score: typeof score === 'number' && Number.isFinite(score) ? clamp(score, 0, 100) : null,
    weight,
    confidence: typeof confidence === 'number' && Number.isFinite(confidence) ? clamp(confidence, 0, 1) : null,
  }
}

function weightedMetricScore(components: WeightedMetricComponent[]): number | null {
  const valid = components.filter((component) => typeof component.score === 'number')
  const weight = valid.reduce((sum, component) => sum + component.weight, 0)
  if (valid.length === 0 || weight <= 0) return null
  return valid.reduce((sum, component) => sum + Number(component.score) * component.weight, 0) / weight
}

function weightedMetricConfidence(components: WeightedMetricComponent[]): number {
  const valid = components.filter((component) => typeof component.score === 'number')
  const declaredWeight = components.reduce((sum, component) => sum + component.weight, 0)
  const presentWeight = valid.reduce((sum, component) => sum + component.weight, 0)
  if (valid.length === 0 || presentWeight <= 0 || declaredWeight <= 0) return 0
  const confidence = valid.reduce((sum, component) => sum + (component.confidence ?? 0.62) * component.weight, 0) / presentWeight
  const coverage = presentWeight / declaredWeight
  return clamp(confidence * (0.65 + coverage * 0.35), 0, 0.96)
}

function weightedMetricCompletenessScore(components: WeightedMetricComponent[]): number | null {
  const declaredWeight = components.reduce((sum, component) => sum + component.weight, 0)
  if (declaredWeight <= 0) return null
  const hasAnyValue = components.some((component) => typeof component.score === 'number')
  if (!hasAnyValue) return null
  return components.reduce((sum, component) => sum + (component.score ?? 0) * component.weight, 0) / declaredWeight
}

function metricScoreValue(metric: MetricValue): number | null {
  return typeof metric.value === 'number' && Number.isFinite(metric.value) ? clamp(metric.value, 0, 100) : null
}

function inverseScore(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(100 - value, 0, 100) : null
}

function inverseMetricScore(metric: MetricValue): number | null {
  return inverseScore(metric.value)
}

function metricScale(metric: MetricValue, low: number, high: number): number | null {
  return typeof metric.value === 'number' ? metricScaleNumber(metric.value, low, high) : null
}

function inverseMetricScale(metric: MetricValue, low: number, high: number): number | null {
  const score = metricScale(metric, low, high)
  return score === null ? null : 100 - score
}

function ratioRiskScore(value: number | null, low: number, high: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? metricScaleNumber(value, low, high) : null
}

function metricScaleNumber(value: number, low: number, high: number): number {
  if (high === low) return value >= high ? 100 : 0
  return clamp(((value - low) / (high - low)) * 100, 0, 100)
}

function averageMetricConfidence(metrics: MetricValue[]): number | null {
  const confidences = metrics
    .map((metric) => metric.confidence)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (confidences.length === 0) return null
  return average(confidences)
}

function waistHeightProfileScore(ratio: number | null): number | null {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return null
  if (ratio < 0.38) return clamp(70 - (0.38 - ratio) * 180, 35, 70)
  if (ratio <= 0.50) return 100
  if (ratio <= 0.58) return clamp(100 - ((ratio - 0.50) / 0.08) * 40, 60, 100)
  return clamp(60 - ((ratio - 0.58) / 0.12) * 60, 0, 60)
}

function bmiProfileScore(value: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value >= 18.5 && value <= 24.9) return 100
  if (value < 18.5) return clamp(100 - ((18.5 - value) / 4) * 55, 35, 100)
  if (value <= 29.9) return clamp(100 - ((value - 24.9) / 5) * 35, 65, 100)
  return clamp(65 - ((value - 29.9) / 10) * 65, 0, 65)
}

function bodyFatProfileScore(value: number | null, range: { low: number; idealHigh: number; high: number }): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < range.low) return clamp(82 - ((range.low - value) / range.low) * 42, 40, 82)
  if (value <= range.idealHigh) return 100
  return clamp(100 - ((value - range.idealHigh) / (range.high - range.idealHigh)) * 65, 20, 100)
}

function bodyMetricReliabilityScore(metric: MetricValue, maxAgeDays: number): number | null {
  if (typeof metric.value !== 'number' && !metric.text?.trim()) return null
  const freshness = metricFreshnessScore(metric.date, maxAgeDays)
  const confidence = typeof metric.confidence === 'number' ? clamp(metric.confidence, 0, 1) : 0.62
  return clamp((0.55 + freshness * 0.25 + confidence * 0.20) * 100, 0, 100)
}

function metricFreshnessScore(date: string | null | undefined, maxAgeDays: number): number {
  if (!date) return 0.55
  const time = new Date(date).getTime()
  if (!Number.isFinite(time)) return 0.55
  const ageDays = Math.max(0, (Date.now() - time) / 86400000)
  return clamp(1 - ageDays / maxAgeDays, 0.25, 1)
}

function physiologicalReadingFromMetric(value: MetricValue, source: string): PhysiologicalAgeReading | null {
  if (typeof value.value !== 'number' || !Number.isFinite(value.value) || !value.date) return null
  return {
    value: value.value,
    unit: value.unit,
    date: value.date,
    source,
    confidence: value.confidence,
  }
}

function atlasPhysiologicalAgeMetric(model: AtlasPhysiologicalAgeModel): MetricValue {
  if (typeof model.ageYears === 'number') {
    return {
      value: model.ageYears,
      unit: 'anos',
      date: model.computedAt,
      confidence: model.confidence,
      qualityLabel: physiologicalAgeStatusLabel(model.status),
    }
  }

  return {
    value: null,
    text: 'Base em formação',
    unit: 'anos',
    date: model.computedAt,
    confidence: model.confidence,
    qualityLabel: physiologicalAgeStatusLabel(model.status),
  }
}

function previousAtlasPhysiologicalAge(snapshots: AtlasHealthSnapshot[]): MetricValue | null {
  const range = previousWeekDateRange()
  const match = snapshots
    .filter((snapshot) => {
      const date = snapshotDateKey(snapshot.snapshot_date)
      return date >= range.start && date <= range.end
    })
    .sort((a, b) => new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime())
    .find((snapshot) => {
      const payload = atlasPhysiologicalAgePayload(snapshot)
      return typeof payload?.age_years === 'number'
    })

  const payload = match ? atlasPhysiologicalAgePayload(match) : null
  if (!match || !payload || typeof payload.age_years !== 'number') return null
  const confidence = typeof payload.confidence === 'number' ? payload.confidence : null
  const status = typeof payload.status === 'string' ? payload.status : null
  return {
    value: payload.age_years,
    unit: 'anos',
    date: match.computed_at,
    confidence,
    qualityLabel: status ? physiologicalAgeStatusLabel(status) : null,
  }
}

function atlasPhysiologicalAgePayload(snapshot: AtlasHealthSnapshot): Record<string, unknown> | null {
  const body = snapshot.body
  if (isRecord(body) && isRecord(body.physiological_age_atlas)) return body.physiological_age_atlas
  const metrics = snapshot.metrics
  if (isRecord(metrics) && isRecord(metrics.physiological_age_atlas)) return metrics.physiological_age_atlas
  return null
}

function physiologicalAgeStatusLabel(status: string): string {
  if (status === 'strong') return 'modelo forte'
  if (status === 'partial') return 'base parcial'
  return 'base em formação'
}

function atlasPhysiologicalAgeDetail(model: AtlasPhysiologicalAgeModel): MetricDetail {
  const usedInputs = model.contributors.map((item) => item.label)
  const missing = model.missingCore.length ? ` Faltando: ${model.missingCore.join(', ')}.` : ''
  return {
    category: 'Healthspan Atlas',
    what: 'Estimativa de idade fisiológica Atlas, separada da idade corporal externa.',
    why: 'Resume sinais lentos de longevidade funcional: aptidão cardiorrespiratória, recuperação autonômica, sono, atividade e composição corporal.',
    inputs: usedInputs.length ? usedInputs : ['Data de nascimento', 'Sexo biológico', 'VO2max/FC repouso', 'Sono', 'Atividade', 'Composição corporal'],
    source: `Modelo ${model.modelVersion}. Parte da idade cronológica e aplica impactos em anos por domínio, com pesos limitados para evitar dupla contagem.`,
    freshness: `Janela lenta de ${model.windowDays} dias; VO2max pode ser aceito por até 180 dias. Altura entra como medida estável, não como dado diário.`,
    quality: `${physiologicalAgeStatusLabel(model.status)}. Cobertura ${Math.round(model.coverage * 100)}%, confiança ${Math.round(model.confidence * 100)}%.${missing}`,
    precision: 'Serve para tendência e direção de saúde funcional; não é idade biológica clínica nem diagnóstico.',
    caveats: model.caveats,
    evidence: atlasPhysiologicalAgeEvidence(model),
    confidence: model.confidence,
  }
}

function atlasPhysiologicalAgeEvidence(model: AtlasPhysiologicalAgeModel): string[] {
  const evidence = [
    typeof model.chronologicalAgeYears === 'number'
      ? `Idade cronológica: ${model.chronologicalAgeYears} anos.`
      : 'Idade cronológica ausente.',
    typeof model.impactYears === 'number'
      ? `Impacto líquido: ${formatSignedYears(model.impactYears)}.`
      : 'Impacto líquido indisponível até fechar cobertura mínima.',
  ]

  for (const item of model.contributors) {
    evidence.push(`${item.label}: ${formatSignedYears(item.impactYears)} · ${formatPhysiologicalContributionValue(item)} · confiança ${Math.round(item.confidence * 100)}%.`)
  }

  if (model.missingCore.length) {
    evidence.push(`Bloqueadores: ${model.missingCore.join(', ')}.`)
  }

  return evidence
}

function formatSignedYears(value: number): string {
  const rounded = Math.abs(value).toFixed(1).replace('.', ',')
  if (Math.abs(value) < 0.05) return '0,0 anos'
  return `${value > 0 ? '+' : '-'}${rounded} anos`
}

function formatPhysiologicalContributionValue(item: AtlasPhysiologicalAgeModel['contributors'][number]): string {
  if (item.unit === 'ml/kg/min') return `${item.value.toFixed(1).replace('.', ',')} ml/kg/min`
  if (item.unit === 'bpm') return `${Math.round(item.value)} bpm`
  if (item.unit === 'ms') return `${Math.round(item.value)} ms`
  if (item.unit === '%' || item.unit === 'anos impacto') return `${item.value.toFixed(1).replace('.', ',')}${item.unit === '%' ? '%' : ''}`
  if (item.unit === 'min/dia') return `${Math.round(item.value)} min/dia`
  if (item.unit === 'passos/dia') return `${Math.round(item.value).toLocaleString('pt-BR')} passos/dia`
  return `${item.value.toFixed(1).replace('.', ',')} ${item.unit}`
}

function basalMetabolicRateMetric(input: {
  weight: MetricValue
  height: MetricValue
  dateOfBirth: MetricValue
  biologicalSex: MetricValue
}): MetricValue {
  const age = ageYearsFromDate(input.dateOfBirth.text)
  const sex = biologicalSexLabel(input.biologicalSex.value)
  if (typeof input.weight.value !== 'number' || typeof input.height.value !== 'number' || age === null || !sex) {
    return { value: null, unit: 'kcal' }
  }

  const heightCm = input.height.value * 100
  const sexOffset = sex === 'male' ? 5 : -161
  const value = (10 * input.weight.value) + (6.25 * heightCm) - (5 * age) + sexOffset
  if (!Number.isFinite(value) || value < 700 || value > 3500) return { value: null, unit: 'kcal' }

  return {
    value,
    unit: 'kcal',
    date: input.weight.date ?? input.height.date ?? input.dateOfBirth.date,
    confidence: 0.78,
    qualityLabel: 'estimada',
  }
}

function previousWeekLeanMassPercent(
  snapshots: AtlasHealthSnapshot[],
  signals: HealthSignal[],
): MetricValue | null {
  const snapshot = previousWeekSnapshotJsonMetric(snapshots, 'body', 'lean_mass_percentage', '%')
  if (snapshot && typeof snapshot.value === 'number') return snapshot

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

function bodyCompositionDetail(
  what: string,
  inputs: string[],
  source: string,
  freshness: string,
  precision: string,
): MetricDetail {
  return {
    category: 'Composição corporal',
    what,
    why: 'Esses dados contextualizam composição, aptidão e cálculos derivados, mas não devem mover prontidão diária como HRV, sono ou carga.',
    inputs,
    source,
    freshness,
    quality: 'Valores passam por normalização de unidade e faixa fisiológica. Medidas estáveis usam última medição válida em vez de expirar artificialmente.',
    precision,
    caveats: [
      'Bioimpedância e estimativas de gordura variam com hidratação, horário e equipamento.',
      'Massa magra não é sinônimo de músculo esquelético.',
      'TMB é estimativa, não medição metabólica em laboratório.',
    ],
  }
}

function ageYearsFromDate(iso?: string | null, now = new Date()): number | null {
  if (!iso) return null
  const birth = new Date(iso)
  if (!Number.isFinite(birth.getTime()) || birth > now) return null
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--
  return age >= 0 ? age : null
}

function biologicalSexLabel(value: number | null): 'female' | 'male' | null {
  if (value === 1) return 'female'
  if (value === 2) return 'male'
  return null
}

function readinessFromSnapshot(
  snapshot: AtlasHealthSnapshot | null,
  fallback: ReadinessV1Model,
): ReadinessV1Model {
  if (!snapshot) return fallback

  const isTodaySnapshot = snapshotDateKey(snapshot.snapshot_date) === localDateKeyFromDate(new Date(fallback.computedAt))
  const confidence = normalizedSnapshotConfidence(snapshot.confidence)
  const base = snapshotScore(snapshot.readiness_score, fallback.base, snapshotReadinessLabel, confidence)
  const body = snapshotScore(snapshot.body_score, fallback.body, snapshotAxisLabel, confidence)
  const mind = snapshotScore(snapshot.mind_score, fallback.mind, snapshotAxisLabel, confidence)
  const drive = snapshotScore(snapshot.drive_score, fallback.drive, snapshotAxisLabel, confidence)
  const readinessPayload = readinessPayloadFromSnapshot(snapshot)
  const axisQuality = snapshotAxisQualityMap(readinessPayload?.axisQuality, fallback.axisQuality)
  const current = isTodaySnapshot
    ? liveCurrentFromSnapshotBase(base, fallback)
    : snapshotScore(snapshot.current_score, fallback.current, snapshotCapacityLabel, confidence)

  return {
    ...fallback,
    computedAt: snapshot.computed_at,
    base,
    current,
    body,
    mind,
    drive,
    nightRecovery: snapshotReadinessScore(readinessPayload?.nightRecovery, fallback.nightRecovery),
    sleep: snapshotScore(snapshot.sleep_score, fallback.sleep, snapshotAxisLabel, confidence),
    autonomic: snapshotScore(snapshot.autonomic_score, fallback.autonomic, snapshotAxisLabel, confidence),
    load: isTodaySnapshot ? fallback.load : snapshotScore(snapshot.load_score, fallback.load, snapshotLoadLabel, confidence),
    subjective: snapshotScore(snapshot.subjective_score, fallback.subjective, snapshotAxisLabel, confidence),
    stability: snapshotScore(snapshot.stability_score, fallback.stability, snapshotStabilityLabel, confidence),
    focus: isTodaySnapshot ? fallback.focus : snapshotReadinessScore(readinessPayload?.focus, fallback.focus),
    signature: snapshotLabelDetail(readinessPayload?.signature, snapshotSignature(body.score, mind.score, drive.score, fallback.signature)),
    mode: snapshotLabelDetail(readinessPayload?.mode, snapshotMode(base.score, current.score, fallback.mode)),
    confidence: isTodaySnapshot || confidence === null ? fallback.confidence : snapshotConfidenceLabel(confidence),
    factors: isTodaySnapshot ? fallback.factors : snapshotFactors(readinessPayload?.factors),
    sleepTargetHours: snapshotNumberField(readinessPayload, 'sleepTargetHours', fallback.sleepTargetHours),
    sleepDebtHours: snapshotNullableNumberField(readinessPayload, 'sleepDebtHours', fallback.sleepDebtHours),
    dayStrain: snapshotDayStrain(readinessPayload?.dayStrain, fallback.dayStrain),
    loadRatio: isTodaySnapshot ? fallback.loadRatio : snapshotNullableNumberField(readinessPayload, 'loadRatio', fallback.loadRatio),
    axisQuality: isTodaySnapshot
      ? {
        ...axisQuality,
        current: fallback.axisQuality.current,
        load: fallback.axisQuality.load,
        focus: fallback.axisQuality.focus,
        dataQuality: fallback.axisQuality.dataQuality,
      }
      : axisQuality,
    diagnostics: isTodaySnapshot ? fallback.diagnostics : snapshotDiagnostics(readinessPayload?.diagnostics, fallback.diagnostics),
    nightRecoveryComponents: snapshotNightRecoveryComponents(readinessPayload?.nightRecoveryComponents, fallback.nightRecoveryComponents),
  }
}

function readinessPayloadFromSnapshot(snapshot: AtlasHealthSnapshot): Record<string, unknown> | null {
  return isRecord(snapshot.readiness) ? snapshot.readiness : null
}

function snapshotReadinessScore(value: unknown, fallback: ReadinessScore): ReadinessScore {
  if (!isRecord(value)) return fallback
  const rawScore = snapshotNumber(value.score)
  const score = rawScore === null ? fallback.score : clamp(Math.round(rawScore), 0, 100)
  const label = typeof value.label === 'string' ? value.label : fallback.label
  const display = typeof value.display === 'string'
    ? value.display
    : score === null
      ? fallback.display
      : `${score}% ${label}`
  const confidence = snapshotNumber(value.confidence)

  return {
    score,
    label,
    display,
    confidence: confidence === null ? fallback.confidence : clamp(confidence, 0, 1),
  }
}

function snapshotNightRecoveryComponents(value: unknown, fallback: NightRecoveryComponent[]): NightRecoveryComponent[] {
  if (!Array.isArray(value)) return fallback
  const parsed = value
    .map((item) => {
      if (!isRecord(item) || typeof item.key !== 'string' || typeof item.label !== 'string') return null
      const direction = item.direction === 'higher_is_better' || item.direction === 'lower_is_better' || item.direction === 'stable_is_better'
        ? item.direction
        : 'stable_is_better'
      const status = item.status === 'good' || item.status === 'watch' || item.status === 'risk' || item.status === 'missing'
        ? item.status
        : 'missing'
      return {
        key: item.key as NightRecoveryComponent['key'],
        label: item.label,
        value: snapshotNumber(item.value),
        baseline: snapshotNumber(item.baseline),
        unit: typeof item.unit === 'string' ? item.unit : null,
        delta: snapshotNumber(item.delta),
        percentDelta: snapshotNumber(item.percentDelta),
        score: snapshotNumber(item.score),
        confidence: clamp(snapshotNumber(item.confidence) ?? 0, 0, 1),
        weight: snapshotNumber(item.weight) ?? 0,
        direction,
        status,
        summary: typeof item.summary === 'string' ? item.summary : '',
      } satisfies NightRecoveryComponent
    })
    .filter((item): item is NightRecoveryComponent => item !== null)

  return parsed.length > 0 ? parsed : fallback
}

function snapshotDayStrain(value: unknown, fallback: DayStrain): DayStrain {
  if (!isRecord(value)) return fallback
  return {
    value: snapshotNumber(value.value),
    label: typeof value.label === 'string' ? value.label : fallback.label,
    confidence: clamp(snapshotNumber(value.confidence) ?? fallback.confidence, 0, 1),
    loadRatio: snapshotNumber(value.loadRatio),
    acuteChronic: snapshotNumber(value.acuteChronic),
    coverage: clamp(snapshotNumber(value.coverage) ?? fallback.coverage, 0, 1),
    components: snapshotLoadComponents(value.components, fallback.components),
  }
}

function snapshotLoadComponents(value: unknown, fallback: LoadComponent[]): LoadComponent[] {
  if (!Array.isArray(value)) return fallback
  const parsed = value
    .map((item) => {
      if (!isRecord(item) || typeof item.key !== 'string' || typeof item.label !== 'string') return null
      const status = item.status === 'low' || item.status === 'normal' || item.status === 'high' || item.status === 'missing'
        ? item.status
        : 'missing'
      return {
        key: item.key as LoadComponent['key'],
        label: item.label,
        value: snapshotNumber(item.value),
        baseline: snapshotNumber(item.baseline),
        unit: typeof item.unit === 'string' ? item.unit : null,
        ratio: snapshotNumber(item.ratio),
        strainContribution: snapshotNumber(item.strainContribution),
        confidence: clamp(snapshotNumber(item.confidence) ?? 0, 0, 1),
        weight: snapshotNumber(item.weight) ?? 0,
        status,
        summary: typeof item.summary === 'string' ? item.summary : '',
      } satisfies LoadComponent
    })
    .filter((item): item is LoadComponent => item !== null)

  return parsed.length > 0 ? parsed : fallback
}

function liveCurrentFromSnapshotBase(base: ReadinessScore, fallback: ReadinessV1Model): ReadinessScore {
  if (typeof base.score !== 'number' || typeof fallback.base.score !== 'number' || typeof fallback.current.score !== 'number') {
    return fallback.current
  }

  const liveDelta = fallback.current.score - fallback.base.score
  const score = clamp(Math.round(base.score + liveDelta), 0, 100)
  const label = snapshotCapacityLabel(score)
  return {
    score,
    label,
    display: `${score}% ${label}`,
    confidence: Math.min(base.confidence, fallback.current.confidence),
  }
}

function snapshotLabelDetail(
  value: unknown,
  fallback: ReadinessV1Model['signature'],
): ReadinessV1Model['signature'] {
  if (!isRecord(value) || typeof value.label !== 'string') return fallback
  return {
    label: value.label,
    detail: typeof value.detail === 'string' ? value.detail : fallback.detail,
  }
}

function snapshotFactors(value: unknown): ReadinessFactor[] {
  if (!Array.isArray(value)) return []
  const factors = value
    .map((item) => {
      if (!isRecord(item)) return null
      const kind = item.kind
      if (
        typeof item.key !== 'string'
        || typeof item.label !== 'string'
        || typeof item.value !== 'string'
        || typeof item.impact !== 'number'
        || !Number.isFinite(item.impact)
        || (kind !== 'positive' && kind !== 'negative' && kind !== 'neutral')
      ) {
        return null
      }
      return {
        key: item.key,
        label: normalizedFactorLabel(item.key, item.label),
        value: normalizedFactorValue(item.key, item.value),
        impact: item.impact,
        kind,
      }
    })
    .filter((item): item is ReadinessFactor => item !== null)
  return factors
}

function normalizedFactorLabel(key: string, label: string): string {
  if (key === 'short_sleep') return 'Sono abaixo do alvo'
  if (key === 'sleep_target') return 'Alvo de sono atingido'
  if (key === 'sleep_debt') return 'Déficit observado 7d'
  return label
}

function normalizedFactorValue(key: string, value: string): string {
  const trimmed = value.trim()
  if (key === 'short_sleep' && /^\d+h\d{2}$/.test(trimmed)) return `faltaram ${trimmed}`
  if (key === 'sleep_target' && /^\d+h\d{2}$/.test(trimmed)) return `${trimmed} dormidas`
  if (key === 'sleep_debt' && /^\d+h\d{2}$/.test(trimmed)) return `${trimmed} acumuladas`
  return value
}

function snapshotAxisQualityMap(
  value: unknown,
  fallback: Record<ReadinessAxisKey, ReadinessAxisQuality>,
): Record<ReadinessAxisKey, ReadinessAxisQuality> {
  const payload = isRecord(value) ? value : null
  const keys = Object.keys(fallback) as ReadinessAxisKey[]
  return keys.reduce((acc, key) => {
    acc[key] = snapshotAxisQuality(payload?.[key], fallback[key])
    return acc
  }, {} as Record<ReadinessAxisKey, ReadinessAxisQuality>)
}

function snapshotAxisQuality(value: unknown, fallback: ReadinessAxisQuality): ReadinessAxisQuality {
  if (!isRecord(value)) return fallback
  return {
    confidence: clamp(snapshotNumberField(value, 'confidence', fallback.confidence), 0, 1),
    coverage: clamp(snapshotNumberField(value, 'coverage', fallback.coverage), 0, 1),
    freshness: clamp(snapshotNumberField(value, 'freshness', fallback.freshness), 0, 1),
    baselineDays: snapshotNullableNumberField(value, 'baselineDays', fallback.baselineDays),
    status: snapshotAxisStatus(value.status, fallback.status),
    summary: typeof value.summary === 'string' ? value.summary : fallback.summary,
  }
}

function snapshotAxisStatus(value: unknown, fallback: ReadinessAxisQuality['status']): ReadinessAxisQuality['status'] {
  return value === 'good' || value === 'partial' || value === 'baseline' ? value : fallback
}

function snapshotDiagnostics(
  value: unknown,
  fallback: ReadinessV1Model['diagnostics'],
): ReadinessV1Model['diagnostics'] {
  if (!isRecord(value)) return fallback

  return {
    sleepHours: snapshotNullableNumberField(value, 'sleepHours', fallback.sleepHours),
    hrvRatio: snapshotNullableNumberField(value, 'hrvRatio', fallback.hrvRatio),
    restingHeartRateRatio: snapshotNullableNumberField(value, 'restingHeartRateRatio', fallback.restingHeartRateRatio),
    awakeHours: snapshotNullableNumberField(value, 'awakeHours', fallback.awakeHours),
    todayDrain: snapshotNumberField(value, 'todayDrain', fallback.todayDrain),
    cognitivePenalty: snapshotNumberField(value, 'cognitivePenalty', fallback.cognitivePenalty),
  }
}

function snapshotNullableNumberField(
  value: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number | null,
): number | null {
  if (!value || !(key in value)) return fallback
  if (value[key] === null) return null
  return snapshotNumber(value[key]) ?? fallback
}

function snapshotNumberField(
  value: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number,
): number {
  if (!value || !(key in value)) return fallback
  return snapshotNumber(value[key]) ?? fallback
}

function snapshotNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function snapshotScore(
  value: number | null,
  fallback: ReadinessScore,
  labeler: (score: number | null) => string,
  confidence: number | null,
): ReadinessScore {
  if (typeof value !== 'number') return fallback
  const score = clamp(Math.round(value), 0, 100)
  const label = labeler(score)
  return {
    score,
    label,
    display: `${score}% ${label}`,
    confidence: confidence ?? fallback.confidence,
  }
}

function normalizedSnapshotConfidence(value: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return clamp(value > 1 ? value / 100 : value, 0, 1)
}

function snapshotConfidenceLabel(value: number): ReadinessV1Model['confidence'] {
  const pct = Math.round(clamp(value, 0, 1) * 100)
  if (pct >= 78) return { value: pct, label: `${pct}% boa` }
  if (pct >= 48) return { value: pct, label: `${pct}% parcial` }
  return { value: pct, label: `${pct}% baseline` }
}

function snapshotReadinessLabel(score: number | null): string {
  if (score === null) return 'Baseline'
  if (score >= 85) return 'alta'
  if (score >= 70) return 'boa'
  if (score >= 55) return 'moderada'
  if (score >= 40) return 'frágil'
  return 'recuperação'
}

function snapshotCapacityLabel(score: number | null): string {
  if (score === null) return 'Sem dado'
  if (score >= 82) return 'alta'
  if (score >= 68) return 'operacional'
  if (score >= 52) return 'limitada'
  if (score >= 38) return 'baixa'
  return 'preservar'
}

function snapshotAxisLabel(score: number | null): string {
  if (score === null) return 'Sem dado'
  if (score >= 82) return 'forte'
  if (score >= 68) return 'bom'
  if (score >= 52) return 'moderado'
  return 'baixo'
}

function snapshotLoadLabel(score: number | null): string {
  if (score === null) return 'Sem baseline'
  if (score >= 82) return 'alta'
  if (score >= 62) return 'normal'
  return 'baixa'
}

function snapshotStabilityLabel(score: number | null): string {
  if (score === null) return 'Sem dado'
  if (score >= 82) return 'estável'
  if (score >= 62) return 'observar'
  return 'instável'
}

function snapshotSignature(
  body: number | null,
  mind: number | null,
  drive: number | null,
  fallback: ReadinessV1Model['signature'],
): ReadinessV1Model['signature'] {
  if (body === null || mind === null || drive === null) return fallback
  const lowest = Math.min(body, mind, drive)
  if (lowest === body) return { label: 'Corpo limitante', detail: 'Snapshot diário aponta corpo como eixo mais frágil.' }
  if (lowest === mind) return { label: 'Mente limitante', detail: 'Snapshot diário aponta mente como eixo mais frágil.' }
  return { label: 'Energia limitante', detail: 'Snapshot diário aponta energia de execução como eixo mais frágil.' }
}

function snapshotMode(
  readiness: number | null,
  current: number | null,
  fallback: ReadinessV1Model['mode'],
): ReadinessV1Model['mode'] {
  const score = current ?? readiness
  if (score === null) return fallback
  if (score >= 82) return { label: 'Expandir', detail: 'Snapshot permite carga alta com monitoramento.' }
  if (score >= 68) return { label: 'Construir', detail: 'Snapshot sustenta trabalho normal.' }
  if (score >= 52) return { label: 'Manter', detail: 'Snapshot pede execução sem excesso.' }
  return { label: 'Recuperar', detail: 'Snapshot pede reduzir carga e priorizar recuperação.' }
}

function latestValue(signals: HealthSignal[], signalTypes: string[]): MetricValue {
  const match = signals
    .filter((signal) => signalTypes.includes(signal.signal_type))
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
  return signalToMetricValue(match)
}

function latestValueWithMaxAge(
  signals: HealthSignal[],
  signalTypes: string[],
  maxAgeHours: number,
): MetricValue {
  const metric = latestValue(signals, signalTypes)
  if (!metric.date) return metric
  const ageMs = Date.now() - new Date(metric.date).getTime()
  if (Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= maxAgeHours * 3600000) {
    return {
      ...metric,
      confidence: metric.confidence ?? 0.78,
      qualityLabel: metric.qualityLabel ?? 'confiança parcial',
    }
  }

  return {
    value: null,
    unit: metric.unit,
    date: metric.date,
    confidence: 0,
    qualityLabel: 'sem confiança',
  }
}

function latestSleepValue(signals: HealthSignal[]): MetricValue {
  const match = signals
    .filter((signal) => (
      signal.signal_type === 'sleep_duration_hours'
      && isMainSleepCandidate({
        asleepHours: typeof signal.value_numeric === 'number' ? signal.value_numeric : null,
        bedtime: signal.started_at,
        wakeTime: signal.ended_at ?? null,
      })
    ))
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

function dailyMax(signals: HealthSignal[], signalTypes: string[], date = new Date()): MetricValue {
  const matches = dailyNumericSignals(signals, signalTypes, date)
  if (matches.length === 0) return { value: null }
  const maxSignal = matches.reduce((best, signal) => (
    Number(signal.value_numeric) > Number(best.value_numeric) ? signal : best
  ))
  return { value: Number(maxSignal.value_numeric), unit: maxSignal.unit, date: maxSignal.started_at }
}

function dailyMedian(signals: HealthSignal[], signalTypes: string[], date = new Date()): MetricValue {
  const matches = dailyNumericSignals(signals, signalTypes, date)
  if (matches.length === 0) return { value: null }
  const values = matches.map((signal) => Number(signal.value_numeric)).sort((a, b) => a - b)
  const latest = matches.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
  return { value: median(values), unit: latest.unit, date: latest.started_at }
}

function dailyNumericSignals(signals: HealthSignal[], signalTypes: string[], date = new Date()): HealthSignal[] {
  const start = startOfLocalDay(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 1)

  return signals.filter((signal) => {
    const time = new Date(signal.started_at).getTime()
    return signalTypes.includes(signal.signal_type)
      && time >= start.getTime()
      && time < end.getTime()
      && typeof signal.value_numeric === 'number'
      && Number.isFinite(signal.value_numeric)
  })
}

function dailyDuration(signals: HealthSignal[], signalTypes: string[], date = new Date()): MetricValue {
  const start = startOfLocalDay(date)
  const end = new Date(start)
  end.setDate(start.getDate() + 1)
  const matches = signals.filter((signal) => {
    const time = new Date(signal.started_at).getTime()
    return signalTypes.includes(signal.signal_type)
      && time >= start.getTime()
      && time < end.getTime()
      && signal.ended_at
  })

  if (matches.length === 0) return { value: null, unit: 'min' }

  const total = matches.reduce((acc, signal) => {
    const started = new Date(signal.started_at).getTime()
    const ended = new Date(signal.ended_at ?? signal.started_at).getTime()
    return Number.isFinite(started) && Number.isFinite(ended) && ended > started
      ? acc + (ended - started) / 60000
      : acc
  }, 0)
  const latest = matches.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
  return total > 0 ? { value: total, unit: 'min', date: latest.started_at } : { value: null, unit: 'min' }
}

function latestDayMedian(
  signals: HealthSignal[],
  signalTypes: string[],
  maxAgeHours: number | null = PHYSIOLOGICAL_FRESHNESS_HOURS,
): MetricValue {
  const now = new Date()
  const matches = signals
    .filter((signal) => (
      signalTypes.includes(signal.signal_type)
      && typeof signal.value_numeric === 'number'
      && new Date(signal.started_at).getTime() <= now.getTime()
    ))
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

  if (matches.length === 0) return { value: null }

  const latestTime = new Date(matches[0].started_at).getTime()
  if (maxAgeHours !== null && now.getTime() - latestTime > maxAgeHours * 3600000) {
    return {
      value: null,
      unit: matches[0].unit,
      date: matches[0].started_at,
    }
  }

  const latestDay = localDateKeyFromIso(matches[0].started_at)
  const daySamples = matches.filter((signal) => localDateKeyFromIso(signal.started_at) === latestDay)
  return {
    value: median(daySamples.map((signal) => Number(signal.value_numeric))),
    unit: daySamples[0]?.unit,
    date: daySamples[0]?.started_at,
  }
}

function previousWeekDailyDuration(signals: HealthSignal[], signalTypes: string[]): MetricValue | null {
  const today = startOfLocalDay(new Date())
  const values: number[] = []
  let latestDate: string | null = null

  for (let daysAgo = 7; daysAgo < 14; daysAgo++) {
    const date = new Date(today)
    date.setDate(today.getDate() - daysAgo)
    const value = dailyDuration(signals, signalTypes, date)
    if (typeof value.value === 'number') {
      values.push(value.value)
      latestDate = value.date ?? latestDate
    }
  }

  if (values.length === 0) return null
  return { value: average(values), unit: 'min', date: latestDate }
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

function baselineDailyMedian(signals: HealthSignal[], signalTypes: string[]): number | null {
  const cutoff = startOfLocalDay(new Date())
  const start = new Date(cutoff)
  start.setDate(cutoff.getDate() - 28)
  const byDay = groupedNumericSignalsByDay(signals, signalTypes, start, cutoff)
  const dayMedians = [...byDay.values()].map((bucket) => median(bucket.map((signal) => Number(signal.value_numeric))))
  if (dayMedians.length < 3) return null
  return median(dayMedians)
}

function signalToMetricValue(signal?: HealthSignal, dateSource: 'start' | 'end' = 'start'): MetricValue {
  if (!signal) return { value: null }
  return {
    value: typeof signal.value_numeric === 'number' ? signal.value_numeric : null,
    text: signal.value_text,
    unit: signal.unit,
    date: dateSource === 'end' ? signal.ended_at ?? signal.started_at : signal.started_at,
    source: signal.source,
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

function latestDigitalMetric(
  snapshots: AtlasDigitalActivitySnapshot[],
  key: DigitalMetricKey,
  unit = 'min',
): MetricValue {
  const snapshot = latestDigitalSnapshot(snapshots)
  if (!snapshot) return { value: null, unit: metricDisplayUnit(unit) }

  const value = snapshot[key]
  const quality = digitalMetricQuality(snapshot, key)
  if (DIGITAL_CATEGORY_METRIC_KEYS.includes(key) && !hasDigitalClassification(snapshot)) {
    return {
      value: null,
      unit: metricDisplayUnit(unit),
      date: snapshot.computed_at,
      ...quality,
    }
  }
  if (DIGITAL_UNSUPPORTED_RIZE_KEYS.includes(key) && typeof value !== 'number') {
    return {
      value: null,
      unit: metricDisplayUnit(unit),
      date: snapshot.computed_at,
      ...quality,
    }
  }
  return digitalMetricValue(value, unit, snapshot.computed_at, quality)
}

function screenTimeSourceMetric(screenTime: ScreenTimeLocalStatus): MetricValue {
  if (screenTime.enabled && screenTime.configuredBucketCount > 0) {
    return {
      value: null,
      text: 'Ativa',
      date: screenTime.lastSyncAt,
      confidence: screenTime.qualityGate === 'ready' ? 0.92 : 0.72,
      qualityLabel: `${screenTime.configuredBucketCount} buckets`,
    }
  }

  if (!screenTime.nativeModuleAvailable) {
    return {
      value: null,
      text: 'Ausente',
      date: screenTime.lastSyncAt,
      confidence: 0,
      qualityLabel: 'módulo nativo ausente',
    }
  }

  return {
    value: null,
    text: screenTime.entitlementRequired ? 'Pendente' : 'Inativa',
    date: screenTime.lastSyncAt,
    confidence: 0,
    qualityLabel: screenTime.entitlementRequired ? 'entitlement necessário' : 'sem autorização',
  }
}

function firstOffensiveUseMetric(input: {
  snapshot: AtlasDigitalActivitySnapshot | null
  sessions: AtlasDigitalSession[]
  sleepSnapshot: AtlasHealthSnapshot | null
  screenTime: ScreenTimeLocalStatus
  now: Date
}): MetricValue {
  const wakeIso = snapshotSleepText(input.sleepSnapshot, 'wake_time')
  const wakeTime = wakeIso ? new Date(wakeIso).getTime() : NaN
  const snapshotValue = input.snapshot?.first_offensive_use_min_after_wake
  if (input.snapshot && typeof snapshotValue === 'number') {
    return digitalMetricValue(
      snapshotValue,
      'duration',
      input.snapshot?.computed_at ?? null,
      digitalMetricQuality(input.snapshot, 'first_offensive_use_min_after_wake'),
    )
  }

  if (!Number.isFinite(wakeTime)) {
    return {
      value: null,
      unit: 's',
      date: input.snapshot?.computed_at ?? null,
      confidence: 0,
      qualityLabel: 'sem wake time',
    }
  }

  const day = localDateKeyFromDate(input.now)
  const offensive = input.sessions
    .filter((session) => (
      !session.deleted_at
      && localDateKeyFromIso(session.started_at) === day
      && DIGITAL_OFFENSIVE_CLASSES.has(Number(session.category_class_at_time))
      && new Date(session.started_at).getTime() >= wakeTime
    ))
    .sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime())[0]

  if (!offensive) {
    const hasClassification = input.snapshot && hasDigitalClassification(input.snapshot)
    const quality = hasClassification
      ? { confidence: 0.55, qualityLabel: 'sem distração classificada' }
      : { confidence: 0, qualityLabel: input.screenTime.enabled ? 'sem classificação' : 'fonte ausente' }
    return {
      value: null,
      text: hasClassification ? 'Sem distração' : null,
      unit: 's',
      date: input.snapshot?.computed_at ?? wakeIso,
      ...quality,
    }
  }

  return {
    value: Math.max(0, (new Date(offensive.started_at).getTime() - wakeTime) / 1000),
    unit: 's',
    date: offensive.started_at,
    confidence: offensive.source === 'screentime' && input.screenTime.qualityGate === 'ready' ? 0.9 : offensive.source === 'screentime' ? 0.72 : 0.58,
    qualityLabel: offensive.source === 'screentime' ? 'fonte iPhone' : 'proxy desktop',
  }
}

function digitalSumMetric(
  snapshot: AtlasDigitalActivitySnapshot | null,
  keys: DigitalMetricKey[],
  unit = 'min',
): MetricValue {
  if (!snapshot) return { value: null, unit: metricDisplayUnit(unit) }
  const hasUnsupported = keys.some((key) => DIGITAL_UNSUPPORTED_RIZE_KEYS.includes(key))
  if (hasUnsupported && keys.every((key) => typeof snapshot[key] !== 'number')) {
    return {
      value: null,
      unit: metricDisplayUnit(unit),
      date: snapshot.computed_at,
      confidence: 0,
      qualityLabel: 'fonte ausente',
    }
  }
  const needsClassification = keys.some((key) => DIGITAL_CATEGORY_METRIC_KEYS.includes(key))
  if (needsClassification && !hasDigitalClassification(snapshot)) {
    return {
      value: null,
      unit: metricDisplayUnit(unit),
      date: snapshot.computed_at,
      confidence: 0,
      qualityLabel: 'sem classificação',
    }
  }
  const values = keys
    .map((key) => snapshot[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  if (values.length === 0) return { value: null, unit: metricDisplayUnit(unit), date: snapshot.computed_at }

  return digitalMetricValue(
    values.reduce((sum, value) => sum + value, 0),
    unit,
    snapshot.computed_at,
    digitalCompositeQuality(snapshot, keys),
  )
}

function digitalRatioMetric(
  snapshot: AtlasDigitalActivitySnapshot | null,
  numeratorKeys: DigitalMetricKey[],
  denominatorKey: DigitalMetricKey,
): MetricValue {
  if (!snapshot) return { value: null, unit: '%' }
  const hasUnsupported = [...numeratorKeys, denominatorKey].some((key) => DIGITAL_UNSUPPORTED_RIZE_KEYS.includes(key))
  if (hasUnsupported && [...numeratorKeys, denominatorKey].every((key) => typeof snapshot[key] !== 'number')) {
    return { value: null, unit: '%', date: snapshot.computed_at, confidence: 0, qualityLabel: 'fonte ausente' }
  }
  const needsClassification = numeratorKeys.some((key) => DIGITAL_CATEGORY_METRIC_KEYS.includes(key))
  if (needsClassification && !hasDigitalClassification(snapshot)) {
    return { value: null, unit: '%', date: snapshot.computed_at, confidence: 0, qualityLabel: 'sem classificação' }
  }
  const numeratorValues = numeratorKeys
    .map((key) => snapshot[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (numeratorValues.length === 0) return { value: null, unit: '%', date: snapshot.computed_at }

  const numerator = numeratorValues
    .reduce((sum, value) => sum + value, 0)
  const denominator = snapshot[denominatorKey]

  if (typeof denominator !== 'number' || !Number.isFinite(denominator) || denominator <= 0) {
    return { value: null, unit: '%', date: snapshot.computed_at }
  }

  return {
    value: clamp((numerator / denominator) * 100, 0, 100),
    unit: '%',
    date: snapshot.computed_at,
    ...digitalCompositeQuality(snapshot, numeratorKeys),
  }
}

function previousWeekDigitalAverage(
  snapshots: AtlasDigitalActivitySnapshot[],
  key: DigitalMetricKey,
  unit = 'min',
): MetricValue | null {
  const range = previousWeekDateRange()
  const values = snapshots
    .filter((snapshot) => {
      const date = snapshotDateKey(snapshot.snapshot_date)
      return date >= range.start
        && date <= range.end
        && typeof snapshot[key] === 'number'
    })
    .map((snapshot) => Number(snapshot[key]))

  if (values.length === 0) return null

  const latest = snapshots
    .filter((snapshot) => {
      const date = snapshotDateKey(snapshot.snapshot_date)
      return date >= range.start && date <= range.end
    })
    .sort((a, b) => snapshotDateKey(b.snapshot_date).localeCompare(snapshotDateKey(a.snapshot_date)))[0]

  return {
    value: unit === 'duration' ? average(values) * 60 : average(values),
    unit: metricDisplayUnit(unit),
    date: latest?.computed_at ?? null,
  }
}

function latestDigitalSnapshot(snapshots: AtlasDigitalActivitySnapshot[], now = new Date()): AtlasDigitalActivitySnapshot | null {
  const today = localDateKeyFromDate(now)
  return snapshots
    .filter((snapshot) => (
      !snapshot.deleted_at
      && snapshotDateKey(snapshot.snapshot_date) === today
      && new Date(snapshot.computed_at).getTime() <= now.getTime()
    ))
    .sort((a, b) => new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime())[0] ?? null
}

function digitalFragmentationMetric(snapshot: AtlasDigitalActivitySnapshot | null): MetricValue {
  if (!snapshot || typeof snapshot.signal_count !== 'number' || typeof snapshot.total_screen_time_min !== 'number' || snapshot.total_screen_time_min <= 0) {
    return { value: null, unit: 'sess/h' }
  }

  return {
    value: snapshot.signal_count / (snapshot.total_screen_time_min / 60),
    unit: 'sess/h',
    date: snapshot.computed_at,
    confidence: snapshot.signal_count > 0 ? 0.76 : 0,
    qualityLabel: snapshot.signal_count > 0 ? 'sessões medidas' : 'sem sessões',
  }
}

function digitalSessionsMetric(snapshot: AtlasDigitalActivitySnapshot | null): MetricValue {
  if (!snapshot) return { value: null, unit: 'sessões' }
  return {
    value: snapshot.signal_count,
    unit: 'sessões',
    date: snapshot.computed_at,
    confidence: typeof snapshot.signal_count === 'number' ? 0.82 : 0,
    qualityLabel: typeof snapshot.signal_count === 'number' ? 'fonte medida' : 'sem fonte',
  }
}

function digitalClassificationMetric(snapshot: AtlasDigitalActivitySnapshot | null): MetricValue {
  if (!snapshot) return { value: null, unit: '%' }
  const ratio = digitalClassificationRatio(snapshot)
  if (typeof ratio !== 'number') {
    return { value: null, unit: '%', date: snapshot.computed_at, confidence: 0, qualityLabel: 'sem classificação' }
  }

  return {
    value: ratio * 100,
    unit: '%',
    date: snapshot.computed_at,
    confidence: clamp(ratio, 0, 1),
    qualityLabel: digitalClassificationLabel(ratio),
  }
}

function digitalDataQualityMetric(snapshot: AtlasDigitalActivitySnapshot | null): MetricValue {
  if (!snapshot) return { value: null, unit: '%' }
  const score = digitalDataQualityScore(snapshot)
  return {
    value: score,
    unit: '%',
    date: snapshot.computed_at,
    confidence: clamp(score / 100, 0, 1),
    qualityLabel: score >= 75 ? 'alta' : score >= 45 ? 'parcial' : 'baixa',
  }
}

function digitalDataQualityScore(snapshot: AtlasDigitalActivitySnapshot): number {
  const serverScore = digitalMetadataNumber(snapshot, ['quality', 'score'])
  if (typeof serverScore === 'number') return Math.round(clamp(serverScore, 0, 100))

  const hasScreenTime = typeof snapshot.total_screen_time_min === 'number' && snapshot.signal_count > 0
  const classification = digitalClassificationRatio(snapshot) ?? 0
  const ageHours = Math.max(0, (Date.now() - new Date(snapshot.computed_at).getTime()) / 3600000)
  const freshness = ageHours > 24 ? 0 : Math.pow(0.5, ageHours / 18)
  return Math.round(clamp((hasScreenTime ? 45 : 0) + classification * 40 + freshness * 15, 0, 100))
}

function digitalMetricValue(
  value: unknown,
  unit: string,
  date: string | null,
  quality?: Pick<MetricValue, 'confidence' | 'qualityLabel'>,
): MetricValue {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : null
  return {
    value: numeric === null ? null : unit === 'duration' ? numeric * 60 : numeric,
    unit: metricDisplayUnit(unit),
    date,
    ...quality,
  }
}

function metricDisplayUnit(unit: string): string {
  return unit === 'duration' ? 's' : unit
}

function digitalMetricQuality(
  snapshot: AtlasDigitalActivitySnapshot,
  key: DigitalMetricKey,
): Pick<MetricValue, 'confidence' | 'qualityLabel'> {
  const value = snapshot[key]
  if (DIGITAL_UNSUPPORTED_RIZE_KEYS.includes(key) && typeof value !== 'number') {
    return { confidence: 0, qualityLabel: 'fonte ausente' }
  }

  if (DIGITAL_CATEGORY_METRIC_KEYS.includes(key)) {
    const ratio = digitalClassificationRatio(snapshot)
    if (!hasDigitalClassification(snapshot) || typeof ratio !== 'number') {
      return { confidence: 0, qualityLabel: 'sem classificação' }
    }
    return {
      confidence: clamp(ratio, 0.2, 0.95),
      qualityLabel: digitalClassificationLabel(ratio),
    }
  }

  if (key === 'total_screen_time_min') {
    const measured = typeof value === 'number' && snapshot.signal_count > 0
    return {
      confidence: measured ? 0.85 : 0.35,
      qualityLabel: measured ? 'fonte medida' : 'sem sessões',
    }
  }

  return typeof value === 'number'
    ? { confidence: 0.75, qualityLabel: 'fonte medida' }
    : { confidence: 0, qualityLabel: 'sem dado' }
}

function digitalCompositeQuality(
  snapshot: AtlasDigitalActivitySnapshot,
  keys: DigitalMetricKey[],
): Pick<MetricValue, 'confidence' | 'qualityLabel'> {
  const qualities = keys.map((key) => digitalMetricQuality(snapshot, key))
  const confidence = qualities.length > 0
    ? average(qualities.map((quality) => quality.confidence ?? 0))
    : digitalDataQualityScore(snapshot) / 100
  const label = keys.some((key) => DIGITAL_CATEGORY_METRIC_KEYS.includes(key))
    ? digitalClassificationLabel(digitalClassificationRatio(snapshot) ?? 0)
    : confidence >= 0.75
      ? 'alta confiança'
      : confidence >= 0.45
        ? 'confiança parcial'
        : 'baixa confiança'
  return { confidence, qualityLabel: label }
}

function hasDigitalClassification(snapshot: AtlasDigitalActivitySnapshot): boolean {
  const metadataCapability = digitalCapability(snapshot, 'category_classification')
  if (metadataCapability !== null) return metadataCapability
  const positiveCategory = DIGITAL_CATEGORY_METRIC_KEYS
    .filter((key) => key !== 'deep_work_sessions_count')
    .some((key) => typeof snapshot[key] === 'number' && Number(snapshot[key]) > 0)
  return positiveCategory || (snapshot.total_screen_time_min === 0 && DIGITAL_CATEGORY_METRIC_KEYS.some((key) => typeof snapshot[key] === 'number'))
}

function digitalClassificationRatio(snapshot: AtlasDigitalActivitySnapshot): number | null {
  const metadataRatio = digitalMetadataNumber(snapshot, ['coverage', 'classification_ratio'])
  if (typeof metadataRatio === 'number') return clamp(metadataRatio, 0, 1)

  const total = snapshot.total_screen_time_min
  if (typeof total !== 'number' || total <= 0) return null
  const classifiedMinutes = DIGITAL_CATEGORY_METRIC_KEYS
    .filter((key) => key !== 'deep_work_sessions_count' && key !== 'deep_work_total_min')
    .map((key) => snapshot[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0)

  return classifiedMinutes > 0 ? clamp(classifiedMinutes / total, 0, 1) : null
}

function digitalClassificationLabel(ratio: number): string {
  if (ratio >= 0.8) return 'alta classificação'
  if (ratio >= 0.45) return 'classificação parcial'
  if (ratio > 0) return 'baixa classificação'
  return 'sem classificação'
}

function digitalCapability(snapshot: AtlasDigitalActivitySnapshot, key: string): boolean | null {
  const capabilities = digitalMetadataRecord(snapshot, ['capabilities'])
  const value = capabilities?.[key]
  return typeof value === 'boolean' ? value : null
}

function digitalMetadataNumber(snapshot: AtlasDigitalActivitySnapshot, path: string[]): number | null {
  const record = digitalMetadataRecord(snapshot, path.slice(0, -1))
  const last = path[path.length - 1]
  if (!last) return null
  const value = record?.[last]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function digitalMetadataStringArray(snapshot: AtlasDigitalActivitySnapshot, path: string[]): string[] {
  const record = digitalMetadataRecord(snapshot, path.slice(0, -1))
  const last = path[path.length - 1]
  if (!last) return []
  const value = record?.[last]
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
}

function digitalMetadataRecord(snapshot: AtlasDigitalActivitySnapshot, path: string[]): Record<string, unknown> | null {
  let current: unknown = snapshot.metadata
  for (const key of path) {
    if (!isRecord(current)) return null
    current = current[key]
  }
  return isRecord(current) ? current : null
}

function checkinMetric(value: number | null, date?: string | null, freshness?: number): MetricValue {
  const label = energyLevelLabel(value)
  return typeof value === 'number'
    ? {
      value,
      unit: '/5',
      text: label ? `${label} (${Math.round(value)} / 5)` : undefined,
      date,
      confidence: freshness,
      qualityLabel: checkinFreshnessLabel(freshness),
    }
    : { value: null, text: 'Sem check-in recente', confidence: 0, qualityLabel: 'expirado' }
}

function moodCheckinMetric(value: number | null, date?: string | null, freshness?: number): MetricValue {
  if (typeof value !== 'number') return { value: null, text: 'Sem check-in recente', confidence: 0, qualityLabel: 'expirado' }
  const label = moodLevelLabel(value)
  return {
    value,
    unit: '/5',
    text: label ? `${label} (${Math.round(value)} / 5)` : undefined,
    date,
    confidence: freshness,
    qualityLabel: checkinFreshnessLabel(freshness),
  }
}

function checkinStateMetric(checkin: AtlasCheckin | null, freshness?: number): MetricValue {
  return checkin
    ? {
      value: null,
      text: checkinStateLabel(checkin.state),
      date: checkin.recorded_at,
      confidence: freshness,
      qualityLabel: checkinFreshnessLabel(freshness),
    }
    : { value: null, text: 'Sem check-in recente', confidence: 0, qualityLabel: 'expirado' }
}

function stateOfMindMetric(metric: MetricValue | null): MetricValue {
  if (!metric || typeof metric.value !== 'number') {
    return { value: null, text: 'Sem dado', date: metric?.date ?? null, confidence: 0, qualityLabel: 'sem confiança' }
  }

  const label = stateOfMindLabel(metric.value)
  return {
    ...metric,
    text: `${label} (${metric.value.toFixed(2).replace('.', ',')})`,
    confidence: metric.confidence ?? 0.55,
    qualityLabel: metric.qualityLabel ?? 'complementar',
  }
}

function energyLevelLabel(value: number | null | undefined): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  if (rounded <= 1) return 'Muito baixa'
  if (rounded === 2) return 'Baixa'
  if (rounded === 3) return 'Normal'
  if (rounded === 4) return 'Alta'
  return 'Muito alta'
}

function stateOfMindLabel(value: number): string {
  if (value >= 0.35) return 'positivo'
  if (value <= -0.35) return 'baixo'
  return 'neutro'
}

function parseManualBodyValue(
  raw: string,
  config: (typeof MANUAL_BODY_METRICS)[ManualBodyMetricKey],
): number | null {
  const normalized = raw.trim().replace(',', '.')
  if (!normalized) return null
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  const measurement = config.signalType === 'height' && value > 3 ? value / 100 : value
  return measurement >= config.min && measurement <= config.max ? measurement : null
}

function editableBodyMetricKey(item: MetricRowModel): ManualBodyMetricKey | null {
  if (item.label === 'Altura') return 'height'
  if (item.label === 'Cintura') return 'waist_circumference'
  return null
}

function manualDisplayValue(value: number, unit: string): string {
  if (unit === 'm') return value.toFixed(2).replace('.', ',')
  if (unit === 'cm') return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',')
  return String(value).replace('.', ',')
}

function checkinFreshnessLabel(freshness: number | null | undefined): string {
  if (typeof freshness !== 'number' || freshness <= 0) return 'expirado'
  if (freshness >= 0.75) return 'alta confiança'
  if (freshness >= 0.4) return 'confiança parcial'
  return 'baixa confiança'
}

function cognitivePenaltyEvidence(
  readiness: ReadinessV1Model,
  checkin: AtlasCheckin | null,
  stateFreshness: number,
): string[] {
  const penalty = Math.round(readiness.diagnostics.cognitivePenalty)
  if (penalty <= 0) return ['Penalidade atual: 0 pts.']

  const evidence: string[] = [`Penalidade total: ${penalty} pts.`]
  let explained = 0
  if (checkin?.state === 'blocked') {
    evidence.push('Estado bloqueado: +12 pts.')
    explained += 12
  } else if (checkin?.state === 'disperse') {
    evidence.push('Estado disperso: +7 pts.')
    explained += 7
  } else if (checkin?.state === 'pause') {
    evidence.push('Estado pausa: +3 pts.')
    explained += 3
  }

  if (checkin && stateFreshness > 0 && stateFreshness < 0.25) {
    evidence.push('Estado perto de expirar: +2 pts.')
    explained += 2
  }

  const residual = penalty - explained
  if (residual > 0) {
    evidence.push(`Pressão digital, foco acumulado ou outro dreno cognitivo: +${residual} pts.`)
  }

  if (checkin) {
    evidence.push(`Check-in usado: ${checkinStateLabel(checkin.state)} em ${formatDateTime(checkin.recorded_at)}.`)
  }

  return evidence
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
      label: `${arrow} ${Math.abs((delta / previous) * 100).toFixed(0)}% vs ${item.comparisonLabel ?? 'sem.'}`,
      color,
    }
  }

  return {
    label: `${arrow} ${formatDelta(Math.abs(delta), item.value.unit)} vs ${item.comparisonLabel ?? 'sem.'}`,
    color,
  }
}

function metricReferenceColor(
  reference: string | null | undefined,
  c: ReturnType<typeof usePalette>,
): string {
  if (!reference) return c.ink2
  if (reference.includes('alta')) return c.moss
  if (reference.includes('média')) return c.bronze
  if (reference.includes('baixa') || reference.includes('sem fonte')) return c.recRed
  return c.ink2
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

function metricSubtitle(value: MetricValue): string {
  const parts = [
    value.date ? formatDateTime(value.date) : null,
    value.qualityLabel,
  ].filter((part): part is string => Boolean(part?.trim()))
  return parts.length > 0 ? parts.join(' · ') : 'Sem dado'
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
  if (unit === 'appleEffortScore') return ''
  if (unit === 'ms') return 'ms'
  if (unit === 'min') return 'min'
  if (unit === 'strain') return ''
  if (unit === 'h') return 'h'
  if (unit === 's') return 's'
  if (unit === 'kg') return ' kg'
  if (unit === 'm') return ' m'
  if (unit === 'cm') return ' cm'
  if (unit === 'degC') return ' °C'
  if (unit === 'ml/(kg*min)') return ' ml/kg/min'
  if (unit === 'pts') return ' pts'
  if (unit === 'vezes') return ' vezes'
  if (unit === 'ciclos') return ' ciclos'
  if (unit === 'sess/h') return ' sess/h'
  if (unit === 'anos') return ' anos'
  if (unit === 'x') return 'x'
  if (unit === 'sessões') return ' sessões'
  if (unit === 'kcal' || unit === 'Cal') return ' kcal'
  if (unit === '%' || unit === 'percent') return '%'
  if (unit === '/5') return ' / 5'
  return ` ${unit}`
}

function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (totalMinutes < 60) return `${totalMinutes}min`
  if (m === 0) return `${h}h`
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
  if (enabled) return 'HealthKit solicitado'
  if (available) return 'Aguardando solicitação'
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
  start.setDate(today.getDate() - 13)
  const end = new Date(today)
  end.setDate(today.getDate() - 6)
  end.setMilliseconds(-1)
  return { start, end }
}

function previousWeekDateRange(): { start: string; end: string } {
  const range = previousWeekRange()
  return {
    start: localDateKeyFromDate(range.start),
    end: localDateKeyFromDate(range.end),
  }
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
  return localDateKeyFromDate(new Date(iso))
}

function localDateKeyFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function snapshotDateKey(value: string): string {
  return value.slice(0, 10)
}

function startOfLocalDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function hasValue(value: MetricValue): boolean {
  return typeof value.value === 'number' || Boolean(value.text?.trim())
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * q
  const base = Math.floor(position)
  const rest = position - base
  const next = sorted[base + 1]
  return typeof next === 'number' ? sorted[base] + rest * (next - sorted[base]) : sorted[base]
}

function average(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0) / values.length
}

function clockMinuteForSleep(iso: string): number | null {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return null
  const minute = date.getHours() * 60 + date.getMinutes()
  return minute < 12 * 60 ? minute + 24 * 60 : minute
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
    maxWidth: 176,
  },
  bodyGroups: {
    gap: 16,
  },
  bodyGroup: {
    gap: 8,
  },
  bodyGroupHeader: {
    paddingHorizontal: 2,
    gap: 3,
  },
  editPill: {
    minHeight: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailModal: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  detailScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  detailSheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  detailHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  detailContent: {
    paddingBottom: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  detailTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  detailClose: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  detailMetrics: {
    marginTop: 18,
    minHeight: 70,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  detailMetric: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  manualModal: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  manualScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  manualSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: -12 },
    elevation: 18,
  },
  manualHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginBottom: 18,
  },
  manualHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  manualTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  manualClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualInputFrame: {
    marginTop: 22,
    minHeight: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  manualInput: {
    flex: 1,
    minHeight: 66,
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 0,
    textAlign: 'right',
  },
  manualUnitPill: {
    marginLeft: 14,
    minWidth: 52,
    minHeight: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  manualMetaRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  manualMetaItem: {
    flex: 1,
    minHeight: 54,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: 'space-between',
  },
  manualMessage: {
    marginTop: 12,
    minHeight: 34,
  },
  manualActions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  manualButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualButtonPrimary: {
    borderWidth: 1,
  },
  detailSection: {
    marginTop: 18,
  },
  detailListItems: {
    gap: 8,
    marginTop: 9,
  },
  detailListItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  detailListText: {
    flex: 1,
  },
  syncPanel: {
    marginTop: 28,
    marginBottom: 18,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
})
