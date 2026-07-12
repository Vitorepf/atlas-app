import { clamp } from './mathUtils'
import type {
  AtlasCheckin,
  AtlasDigitalActivitySnapshot,
  AtlasPassiveSignal,
  StoreHealthSnapshotInput,
} from './api/client'
import { buildReadinessV1 } from './readiness'
import {
  sleepDeficitHours,
} from './sleepTarget'
import { analyzeSleepDay, analyzeSleepDays } from './sleepAnalysis'
import { sleepStressForDate } from './sleepPhysiology'
import { isMainSleepCandidate } from './sleepValidity'
import {
  checkinAgeHours,
  checkinLevelFreshness,
  checkinStateFreshness,
} from './checkinFreshness'
import {
  buildAtlasPhysiologicalAge,
  physiologicalAgeForStorage,
} from './physiologicalAge'

type HealthSnapshotSignal = Pick<
  AtlasPassiveSignal,
  'client_id' | 'source' | 'signal_type' | 'value_numeric' | 'value_text' | 'unit' | 'started_at' | 'ended_at' | 'recorded_timezone' | 'metadata'
>

type HealthSnapshotCheckin = Pick<
  AtlasCheckin,
  'state' | 'energy_level' | 'mood_level' | 'recorded_at' | 'recorded_timezone'
>

type HealthSnapshotDigitalSnapshot = Pick<
  AtlasDigitalActivitySnapshot,
  | 'snapshot_date'
  | 'computed_at'
  | 'total_screen_time_min'
  | 'pickups_count'
  | 'deep_work_total_min'
  | 'curated_input_min'
  | 'algorithmic_input_min'
  | 'intentional_entertainment_min'
  | 'default_entertainment_min'
  | 'communication_primary_min'
  | 'communication_shallow_min'
>

const SNAPSHOT_SOURCE = 'atlas_app' as const
const DEFAULT_SNAPSHOT_DAYS = 60
const SLEEP_MODEL_VERSION = 'sleep_operational_v4'

type SleepMetricQualityStatus = 'alta' | 'parcial' | 'baixa' | 'sem dado'

interface SleepMetricQuality {
  confidence: number
  status: SleepMetricQualityStatus
  reason: string
}

export function buildHealthSnapshotInputs(input: {
  healthSignals: HealthSnapshotSignal[]
  allSignals?: HealthSnapshotSignal[]
  digitalActivitySnapshots?: HealthSnapshotDigitalSnapshot[]
  checkins: HealthSnapshotCheckin[]
  days?: number
  dates?: string[]
  now?: Date
  timezone?: string
}): StoreHealthSnapshotInput[] {
  const now = input.now ?? new Date()
  const timezone = input.timezone ?? deviceTimezone()
  const days = Math.max(1, input.days ?? DEFAULT_SNAPSHOT_DAYS)
  const allSignals = input.allSignals ?? input.healthSignals
  const snapshots: StoreHealthSnapshotInput[] = []
  const snapshotDates = input.dates?.length
    ? normalizedSnapshotDates(input.dates)
    : recentSnapshotDates(now, days)

  for (const snapshotDate of snapshotDates) {
    const parsedDate = dateFromLocalKey(snapshotDate)
    if (!parsedDate) continue
    const date = startOfLocalDay(parsedDate)
    const end = new Date(date)
    end.setDate(date.getDate() + 1)
    end.setMilliseconds(-1)
    const isToday = snapshotDate === localDateKey(now)

    const healthUntilEnd = input.healthSignals.filter((signal) => metricTime(signal) <= end.getTime())
    const allUntilEnd = allSignals.filter((signal) => metricTime(signal) <= end.getTime())
    const dayHealthSignals = input.healthSignals.filter((signal) => signalBelongsToDate(signal, snapshotDate))
    const dayAllSignals = allSignals.filter((signal) => signalBelongsToDate(signal, snapshotDate))
    const digitalUntilEnd = (input.digitalActivitySnapshots ?? []).filter((snapshot) => (
      snapshot.snapshot_date <= snapshotDate
      && new Date(snapshot.computed_at).getTime() <= end.getTime()
    ))
    const latestCheckin = latestCheckinForDate(input.checkins, snapshotDate)

    if (dayAllSignals.length === 0 && !latestCheckin && !isToday) {
      continue
    }

    const readiness = buildReadinessV1({
      healthSignals: healthUntilEnd as AtlasPassiveSignal[],
      allSignals: allUntilEnd as AtlasPassiveSignal[],
      digitalActivitySnapshots: digitalUntilEnd as AtlasDigitalActivitySnapshot[],
      latestCheckin: latestCheckin as AtlasCheckin | null,
      checkins: input.checkins.filter((checkin) => new Date(checkin.recorded_at).getTime() <= end.getTime()),
      now: isToday ? now : end,
    })

    const sleep = sleepSummary(input.healthSignals, snapshotDate, readiness.sleepTargetHours)
    const recoveryBase = recoverySummary(dayHealthSignals)
    const recovery = {
      ...recoveryBase,
      night_recovery_score: intOrNull(readiness.nightRecovery.score),
      night_recovery_confidence: roundOrNull(readiness.nightRecovery.confidence, 3),
      night_recovery_components: readiness.nightRecoveryComponents,
    }
    const loadBase = loadSummary(dayHealthSignals)
    const load = {
      ...loadBase,
      day_strain: roundOrNull(readiness.dayStrain.value, 3),
      day_strain_label: readiness.dayStrain.label,
      day_strain_confidence: roundOrNull(readiness.dayStrain.confidence, 3),
      load_ratio: roundOrNull(readiness.dayStrain.loadRatio, 3),
      acute_chronic_ratio: roundOrNull(readiness.dayStrain.acuteChronic, 3),
      load_components: readiness.dayStrain.components,
    }
    const subjective = subjectiveSummary(dayAllSignals, latestCheckin, isToday ? now : end)
    const body = bodySummary(allUntilEnd)
    const snapshotComputedAt = isToday ? now : end
    const physiologicalAge = buildAtlasPhysiologicalAge({
      signals: allUntilEnd,
      now: snapshotComputedAt,
      current: {
        sleepScore: physiologicalAgeReading(readiness.sleep.score, '%', readiness.computedAt, 'readiness_v1'),
        sleepRegularityScore: physiologicalAgeReading(numberOrNull(sleep.regularity_score), '%', snapshotComputedAt.toISOString(), 'sleep_snapshot'),
      },
    })
    const bodyPayload = {
      ...body,
      physiological_age_atlas: physiologicalAgeForStorage(physiologicalAge),
    }
    const metrics = {
      snapshot_date: snapshotDate,
      snapshot_timezone: timezone,
      readiness_version: readiness.version,
      signal_count: dayAllSignals.length,
      generated_at: now.toISOString(),
      sources: sourceCounts(dayAllSignals),
      physiological_age_atlas: {
        model_version: physiologicalAge.modelVersion,
        age_years: physiologicalAge.ageYears,
        confidence: physiologicalAge.confidence,
        coverage: physiologicalAge.coverage,
        status: physiologicalAge.status,
      },
    }

    snapshots.push({
      client_id: deterministicUuid(`health_snapshot:${SNAPSHOT_SOURCE}:${timezone}:${snapshotDate}`),
      source: SNAPSHOT_SOURCE,
      snapshot_date: snapshotDate,
      snapshot_timezone: timezone,
      computed_at: now.toISOString(),
      signal_count: dayAllSignals.length,
      readiness_score: intOrNull(readiness.base.score),
      current_score: intOrNull(readiness.current.score),
      body_score: intOrNull(readiness.body.score),
      mind_score: intOrNull(readiness.mind.score),
      drive_score: intOrNull(readiness.drive.score),
      sleep_score: intOrNull(readiness.sleep.score),
      autonomic_score: intOrNull(readiness.autonomic.score),
      load_score: intOrNull(readiness.load.score),
      subjective_score: intOrNull(readiness.subjective.score),
      stability_score: intOrNull(readiness.stability.score),
      confidence: confidenceForStorage(readiness.confidence.value),
      sleep_duration_hours: roundOrNull(sleep.duration_hours, 3),
      sleep_efficiency: roundOrNull(sleep.efficiency, 3),
      hrv_ms: roundOrNull(recoveryBase.hrv_ms, 3),
      resting_heart_rate_bpm: roundOrNull(recoveryBase.resting_heart_rate_bpm, 3),
      respiratory_rate: roundOrNull(recoveryBase.respiratory_rate, 3),
      wrist_temperature_c: roundOrNull(recoveryBase.wrist_temperature_c, 3),
      active_energy_kcal: roundOrNull(loadBase.active_energy_kcal, 3),
      basal_energy_kcal: roundOrNull(loadBase.basal_energy_kcal, 3),
      exercise_minutes: roundOrNull(loadBase.exercise_minutes, 3),
      stand_minutes: roundOrNull(loadBase.stand_minutes, 3),
      steps: roundOrNull(loadBase.steps, 3),
      walking_running_distance_m: roundOrNull(loadBase.walking_running_distance_m, 3),
      vo2max: roundOrNull(recoveryBase.vo2max, 3),
      body_mass_kg: roundOrNull(body.body_mass_kg, 3),
      body_fat_percentage: roundOrNull(body.body_fat_percentage, 3),
      lean_body_mass_kg: roundOrNull(body.lean_body_mass_kg, 3),
      muscle_mass_percentage: roundOrNull(body.muscle_mass_percentage, 3),
      body_mass_index: roundOrNull(body.body_mass_index, 3),
      waist_circumference_cm: roundOrNull(body.waist_circumference_cm, 3),
      energy_level: latestCheckin?.energy_level ?? null,
      mood_level: latestCheckin?.mood_level ?? null,
      state: latestCheckin?.state ?? null,
      metrics,
      readiness: readiness as unknown as Record<string, unknown>,
      sleep,
      recovery,
      load,
      subjective,
      body: bodyPayload,
      metadata: {
        model: 'health_snapshot_v2',
        sleep_model: SLEEP_MODEL_VERSION,
        aggregation: 'client_daily',
        raw_sources_preserved: true,
      },
    })
  }

  return snapshots
}

function sleepSummary(signals: HealthSnapshotSignal[], snapshotDate: string, targetHours: number): Record<string, unknown> & {
  duration_hours: number | null
  efficiency: number | null
} {
  const analysis = analyzeSleepDay(signals, snapshotDate)
  const stress = sleepStressForDate(signals, snapshotDate)
  const regularity = sleepRegularitySummary(signals, snapshotDate)
  const sleepDuration = latestByDate(signals, ['sleep_duration_hours'], snapshotDate, true)
  const sleepHeartRateAverage = latestByDate(signals, ['sleep_hr_avg_bpm'], snapshotDate, true)
  const sleepHeartRateMin = latestByDate(signals, ['sleep_hr_min_bpm'], snapshotDate, true)
  const sleepHeartRateMax = latestByDate(signals, ['sleep_hr_max_bpm'], snapshotDate, true)
  const sleepHeartRateMedian = latestByDate(signals, ['sleep_hr_median_bpm'], snapshotDate, true)
  const sleepHeartRateSampleCount = latestByDate(signals, ['sleep_hr_sample_count'], snapshotDate, true)
  const sleepBreathingDisturbances = latestByDate(signals, ['sleep_breathing_disturbances'], snapshotDate, true)
  const fallbackSleepDuration = mainSleepDurationMetric(sleepDuration)
  const durationHours = analysis?.asleepHours ?? fallbackSleepDuration?.value ?? null
  const sleepWindow = sleepRecoveryWindow(analysis, fallbackSleepDuration, sleepHeartRateAverage, sleepHeartRateMin)
  const sleepRespiratoryRate = medianInWindow(signals, ['respiratory_rate'], sleepWindow)
  const sleepOxygenSaturation = medianInWindow(signals, ['oxygen_saturation'], sleepWindow)
  const sleepWristTemperature = medianInWindow(signals, ['wrist_temperature'], sleepWindow)
  const inBedHours = analysis?.inBedHours ?? null
  const efficiency = analysis?.efficiency ?? null
  const awakePercent = analysis?.awakeHours !== null && analysis?.awakeHours !== undefined && inBedHours && inBedHours > 0
    ? (analysis.awakeHours / inBedHours) * 100
    : null
  const continuityPercent = awakePercent !== null ? Math.max(0, 100 - awakePercent) : null
  const debt = durationHours === null ? null : sleepDeficitHours(durationHours, targetHours)
  const sleepRespiratoryRateValue = sleepRespiratoryRate
  const sleepOxygenSaturationValue = normalizePercent(sleepOxygenSaturation)
  const sleepWristTemperatureValue = sleepWristTemperature
  const sleepBreathingDisturbanceValue = numberOrNull(sleepBreathingDisturbances?.value_numeric)
  const metricQuality = sleepMetricQualityMap({
    analysis,
    stressConfidence: stress.confidence,
    regularityNights: regularity.regularity_nights,
    durationHours,
    heartRateSampleCount: numberOrNull(sleepHeartRateSampleCount?.value_numeric),
    sleepRespiratoryRate: sleepRespiratoryRateValue,
    sleepOxygenSaturation: sleepOxygenSaturationValue,
    sleepWristTemperature: sleepWristTemperatureValue,
    sleepBreathingDisturbances: sleepBreathingDisturbanceValue,
  })

  return {
    model_version: SLEEP_MODEL_VERSION,
    asleep_hours: analysis?.asleepHours ?? durationHours,
    rem_hours: analysis?.remHours ?? null,
    deep_hours: analysis?.deepHours ?? null,
    core_hours: analysis?.coreHours ?? null,
    awake_hours: analysis?.awakeHours ?? null,
    unspecified_hours: analysis?.unspecifiedHours ?? null,
    duration_hours: durationHours,
    sleep_target_hours: targetHours,
    in_bed_hours: inBedHours,
    efficiency,
    awake_percent: awakePercent,
    continuity_percent: continuityPercent,
    sleep_debt_hours: debt,
    bedtime: analysis?.bedtime ?? fallbackSleepDuration?.bedtime ?? null,
    wake_time: analysis?.wakeTime ?? fallbackSleepDuration?.wakeTime ?? null,
    in_bed_start_time: analysis?.inBedStartTime ?? null,
    latency_minutes: analysis?.latencyMinutes ?? null,
    awake_episode_count: analysis?.awakeEpisodeCount ?? null,
    disturbance_count: analysis?.disturbanceCount ?? null,
    sleep_cycle_count: analysis?.sleepCycleCount ?? null,
    stage_coverage: analysis?.stageCoverage ?? null,
    sleep_data_quality: analysis?.dataQuality ?? null,
    sleep_data_quality_label: analysis?.dataQualityLabel ?? null,
    sleep_capture_status: analysis?.captureStatus ?? null,
    sleep_stress_score: stress.score,
    sleep_stress_confidence: stress.confidence,
    sleep_stress_label: stress.label,
    sleep_stress_sleep_hr_ratio: stress.sleepHeartRateRatio,
    sleep_stress_sleep_hr_avg_bpm: stress.sleepHeartRateAverageBpm,
    sleep_stress_sleep_hr_min_bpm: stress.sleepHeartRateMinBpm,
    sleep_stress_hrv_ratio: stress.hrvRatio,
    sleep_stress_resting_heart_rate_ratio: stress.restingHeartRateRatio,
    sleep_stress_respiratory_rate_ratio: stress.respiratoryRateRatio,
    sleep_stress_wrist_temperature_delta_c: stress.wristTemperatureDeltaC,
    sleep_stress_oxygen_saturation_percent: stress.oxygenSaturationPercent,
    sleep_stress_breathing_disturbance_count: stress.breathingDisturbanceCount,
    sleep_hr_avg_bpm: numberOrNull(sleepHeartRateAverage?.value_numeric),
    sleep_hr_min_bpm: numberOrNull(sleepHeartRateMin?.value_numeric),
    sleep_hr_max_bpm: numberOrNull(sleepHeartRateMax?.value_numeric),
    sleep_hr_median_bpm: numberOrNull(sleepHeartRateMedian?.value_numeric),
    sleep_hr_sample_count: numberOrNull(sleepHeartRateSampleCount?.value_numeric),
    sleep_respiratory_rate: sleepRespiratoryRateValue,
    sleep_oxygen_saturation_percent: sleepOxygenSaturationValue,
    sleep_wrist_temperature_c: sleepWristTemperatureValue,
    sleep_breathing_disturbances_count: sleepBreathingDisturbanceValue,
    metric_quality: metricQuality,
    ...regularity,
    nap_hours: analysis?.napHours ?? null,
    nap_count: analysis?.napCount ?? 0,
    main_sleep_source: analysis?.source ?? null,
  }
}

function mainSleepDurationMetric(signal: HealthSnapshotSignal | null): {
  value: number
  bedtime: string
  wakeTime: string | null
} | null {
  const value = numberOrNull(signal?.value_numeric)
  if (!signal || typeof value !== 'number') return null
  const wakeTime = signal.ended_at ?? null
  if (!isMainSleepCandidate({ asleepHours: value, bedtime: signal.started_at, wakeTime })) {
    return null
  }
  return {
    value,
    bedtime: signal.started_at,
    wakeTime,
  }
}

function sleepRecoveryWindow(
  analysis: ReturnType<typeof analyzeSleepDay>,
  fallbackSleepDuration: ReturnType<typeof mainSleepDurationMetric>,
  sleepHeartRateAverage: HealthSnapshotSignal | null,
  sleepHeartRateMin: HealthSnapshotSignal | null,
): { start: number; end: number } | null {
  const bedtime = analysis?.bedtime ?? fallbackSleepDuration?.bedtime ?? null
  const wakeTime = analysis?.wakeTime ?? fallbackSleepDuration?.wakeTime ?? null
  const fromSleep = recoveryWindowFromIso(bedtime, wakeTime)
  if (fromSleep) return fromSleep

  const hrWindow = recoveryWindowFromIso(
    sleepHeartRateAverage?.started_at ?? sleepHeartRateMin?.started_at ?? null,
    sleepHeartRateAverage?.ended_at ?? sleepHeartRateMin?.ended_at ?? null,
  )
  return hrWindow
}

function recoveryWindowFromIso(startIso?: string | null, endIso?: string | null): { start: number; end: number } | null {
  if (!startIso || !endIso) return null
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return {
    start: start - 2 * 3600000,
    end: end + 2 * 3600000,
  }
}

function medianInWindow(
  signals: HealthSnapshotSignal[],
  signalTypes: string[],
  window: { start: number; end: number } | null,
): number | null {
  if (!window) return null
  const values = signals
    .filter((signal) => (
      signalTypes.includes(signal.signal_type)
      && typeof signal.value_numeric === 'number'
      && signalOverlapsWindow(signal, window)
    ))
    .map((signal) => Number(signal.value_numeric))
    .filter((value) => Number.isFinite(value))

  return values.length > 0 ? median(values) : null
}

function signalOverlapsWindow(signal: HealthSnapshotSignal, window: { start: number; end: number }): boolean {
  const start = new Date(signal.started_at).getTime()
  const end = new Date(signal.ended_at ?? signal.started_at).getTime()
  if (!Number.isFinite(start)) return false
  const effectiveEnd = Number.isFinite(end) && end > start ? end : start + 1
  return Math.max(start, window.start) < Math.min(effectiveEnd, window.end)
}

function sleepRegularitySummary(signals: HealthSnapshotSignal[], snapshotDate: string): Record<string, number | null> & {
  regularity_nights: number
} {
  const snapshotDay = dateFromLocalKey(snapshotDate)
  if (!snapshotDay) {
    return emptySleepRegularity()
  }
  const end = new Date(snapshotDay)
  end.setDate(end.getDate() + 1)
  const nights = analyzeSleepDays(signals, end, 30)
    .filter((night) => night.key <= snapshotDate)
    .slice(0, 7)
    .filter((night) => night.bedtime && night.wakeTime)

  if (nights.length < 3) {
    return emptySleepRegularity(nights.length)
  }

  const bedtimes = nights
    .map((night) => clockMinuteForSleep(String(night.bedtime)))
    .filter((value): value is number => typeof value === 'number')
  const wakeTimes = nights
    .map((night) => clockMinuteForWake(String(night.wakeTime)))
    .filter((value): value is number => typeof value === 'number')
  const midpoints = nights
    .map((night) => midpointMinuteForSleep(String(night.bedtime), String(night.wakeTime)))
    .filter((value): value is number => typeof value === 'number')

  const bedtimeRegularity = absoluteMedianDeviation(bedtimes)
  const wakeRegularity = absoluteMedianDeviation(wakeTimes)
  const midpointRegularity = absoluteMedianDeviation(midpoints)
  const socialJetlag = socialJetlagMinutes(nights)
  const regularityLoad = average([
    bedtimeRegularity,
    wakeRegularity,
    midpointRegularity,
  ].filter((value): value is number => typeof value === 'number'))
  const regularityScore = typeof regularityLoad === 'number'
    ? clamp(
      100
      - Math.max(0, regularityLoad - 25) * 0.9
      - Math.max(0, (socialJetlag ?? 0) - 60) * 0.25,
      20,
      100,
    )
    : null

  return {
    bedtime_regularity_minutes: bedtimeRegularity,
    wake_regularity_minutes: wakeRegularity,
    midpoint_regularity_minutes: midpointRegularity,
    social_jetlag_minutes: socialJetlag,
    regularity_score: regularityScore,
    regularity_nights: nights.length,
  }
}

function sleepMetricQualityMap(input: {
  analysis: ReturnType<typeof analyzeSleepDay>
  stressConfidence: number
  regularityNights: number
  durationHours: number | null
  heartRateSampleCount: number | null
  sleepRespiratoryRate: number | null
  sleepOxygenSaturation: number | null
  sleepWristTemperature: number | null
  sleepBreathingDisturbances: number | null
}): Record<string, SleepMetricQuality> {
  const analysis = input.analysis
  const dataQuality = analysis?.dataQuality ?? 0
  const stageCoverage = analysis?.stageCoverage ?? 0
  const stageConfidence = analysis
    ? analysis.source === 'stages'
      ? clamp(dataQuality * Math.max(stageCoverage, 0.45), 0, 1)
      : 0
    : 0
  const durationConfidence = input.durationHours === null
    ? 0
    : analysis?.source === 'stages'
      ? clamp(Math.max(0.82, dataQuality), 0, 1)
      : 0.72
  const awakeConfidence = analysis?.source === 'stages' ? clamp(dataQuality * 0.88, 0, 1) : 0
  const latencyConfidence = typeof analysis?.latencyMinutes === 'number' ? awakeConfidence : 0
  const heartRateConfidence = typeof input.heartRateSampleCount === 'number' && input.heartRateSampleCount >= 3
    ? clamp(0.55 + input.heartRateSampleCount / 100, 0.58, 0.95)
    : 0
  const regularityConfidence = input.regularityNights >= 3
    ? clamp(0.35 + (input.regularityNights / 7) * 0.55, 0, 0.95)
    : 0

  return {
    duration_hours: metricQuality(durationConfidence, 'Duração vem da noite principal; estágios completos aumentam a confiança.'),
    in_bed_hours: metricQuality(awakeConfidence, 'Tempo na cama depende de in-bed/awake ou da janela de estágios.'),
    efficiency: metricQuality(awakeConfidence, 'Eficiência exige duração e vigília/tempo na cama confiáveis.'),
    awake_percent: metricQuality(awakeConfidence, 'Percentual acordado depende de estágios awake.'),
    continuity_percent: metricQuality(awakeConfidence, 'Continuidade depende de estágios awake.'),
    latency_minutes: metricQuality(latencyConfidence, 'Latência exige awake/in-bed antes do primeiro sono real.'),
    awake_episode_count: metricQuality(awakeConfidence, 'Despertares dependem de blocos awake dentro da janela principal.'),
    disturbance_count: metricQuality(awakeConfidence, 'Distúrbios dependem de microblocos awake detectados pelo relógio.'),
    sleep_cycle_count: metricQuality(stageConfidence * 0.75, 'Ciclos são estimados por episódios REM; use como tendência.'),
    rem_hours: metricQuality(stageConfidence, 'REM depende da classificação de estágios do Apple Watch.'),
    deep_hours: metricQuality(stageConfidence, 'Profundo depende da classificação de estágios do Apple Watch.'),
    core_hours: metricQuality(stageConfidence, 'Core depende da classificação de estágios do Apple Watch.'),
    awake_hours: metricQuality(awakeConfidence, 'Tempo acordado depende dos estágios awake.'),
    stage_coverage: metricQuality(analysis?.source === 'stages' ? clamp(dataQuality, 0, 1) : 0, 'Cobertura mede quanto do sono tem fase detalhada.'),
    sleep_data_quality: metricQuality(analysis ? clamp(dataQuality, 0, 1) : 0, 'Qualidade operacional da noite analisada.'),
    sleep_hr_avg_bpm: metricQuality(heartRateConfidence, 'FC média usa apenas agregados dentro da janela de sono.'),
    sleep_hr_min_bpm: metricQuality(heartRateConfidence, 'FC mínima usa apenas agregados dentro da janela de sono.'),
    sleep_hr_max_bpm: metricQuality(heartRateConfidence, 'FC máxima usa apenas agregados dentro da janela de sono.'),
    sleep_hr_median_bpm: metricQuality(heartRateConfidence, 'FC mediana usa apenas agregados dentro da janela de sono.'),
    sleep_hr_sample_count: metricQuality(heartRateConfidence > 0 ? 0.95 : 0, 'Contagem audita quantas amostras sustentam a FC do sono.'),
    sleep_stress_score: metricQuality(input.stressConfidence, 'Stress do sono combina FC do sono, HRV, FC repouso, respiração, temperatura e oxigênio.'),
    sleep_respiratory_rate: metricQuality(input.sleepRespiratoryRate === null ? 0 : 0.78, 'Respiração noturna vem do HealthKit quando disponível para a data.'),
    sleep_oxygen_saturation_percent: metricQuality(input.sleepOxygenSaturation === null ? 0 : 0.74, 'Oxigênio pode ter amostragem irregular; use tendência.'),
    sleep_wrist_temperature_c: metricQuality(input.sleepWristTemperature === null ? 0 : 0.82, 'Temperatura de pulso é noturna e depende de noites com Apple Watch.'),
    sleep_breathing_disturbances_count: metricQuality(input.sleepBreathingDisturbances === null ? 0 : 0.78, 'Distúrbios respiratórios usam o sinal específico de sono do Apple Health.'),
    regularity_score: metricQuality(regularityConfidence, 'Regularidade usa até 7 noites recentes observadas.'),
    bedtime_regularity_minutes: metricQuality(regularityConfidence, 'Regularidade de dormir usa horários das noites recentes.'),
    wake_regularity_minutes: metricQuality(regularityConfidence, 'Regularidade de acordar usa horários das noites recentes.'),
    midpoint_regularity_minutes: metricQuality(regularityConfidence, 'Ponto médio resume deslocamento da janela inteira de sono.'),
    social_jetlag_minutes: metricQuality(input.regularityNights >= 5 ? regularityConfidence * 0.85 : 0, 'Jetlag social precisa de dias úteis e fim de semana no histórico recente.'),
  }
}

function metricQuality(confidence: number, reason: string): SleepMetricQuality {
  const normalized = clamp(Number.isFinite(confidence) ? confidence : 0, 0, 1)
  return {
    confidence: roundOrNull(normalized, 3) ?? 0,
    status: sleepMetricQualityStatus(normalized),
    reason,
  }
}

function sleepMetricQualityStatus(confidence: number): SleepMetricQualityStatus {
  if (confidence <= 0) return 'sem dado'
  if (confidence >= 0.78) return 'alta'
  if (confidence >= 0.48) return 'parcial'
  return 'baixa'
}

function recoverySummary(signals: HealthSnapshotSignal[]): Record<string, number | null> {
  return {
    hrv_ms: medianMetric(signals, ['hrv_ms']),
    resting_heart_rate_bpm: medianMetric(signals, ['resting_heart_rate_bpm']),
    respiratory_rate: medianMetric(signals, ['respiratory_rate']),
    wrist_temperature_c: medianMetric(signals, ['wrist_temperature']),
    vo2max: latestMetric(signals, ['vo2max']),
  }
}

function loadSummary(signals: HealthSnapshotSignal[]): Record<string, number | null> {
  return {
    steps: sumMetric(signals, ['steps']),
    active_energy_kcal: sumMetric(signals, ['active_energy_kcal']),
    basal_energy_kcal: sumMetric(signals, ['basal_energy_kcal']),
    exercise_minutes: sumMetric(signals, ['exercise_minutes']),
    stand_minutes: sumMetric(signals, ['stand_minutes']),
    walking_running_distance_m: sumMetric(signals, ['walking_running_distance']),
    workout_seconds: sumMetric(signals, ['workout']),
    workout_effort_score: maxMetric(signals, ['workout_effort_score']),
    estimated_workout_effort_score: maxMetric(signals, ['estimated_workout_effort_score']),
    workout_cardio_load: sumMetric(signals, ['workout_cardio_load']),
    workout_cardio_strain: maxMetric(signals, ['workout_cardio_strain']),
    workout_hr_avg_bpm: medianMetric(signals, ['workout_hr_avg_bpm']),
    workout_hr_max_bpm: maxMetric(signals, ['workout_hr_max_bpm']),
    workout_hr_zone_1_min: sumMetric(signals, ['workout_hr_zone_1_min']),
    workout_hr_zone_2_min: sumMetric(signals, ['workout_hr_zone_2_min']),
    workout_hr_zone_3_min: sumMetric(signals, ['workout_hr_zone_3_min']),
    workout_hr_zone_4_min: sumMetric(signals, ['workout_hr_zone_4_min']),
    workout_hr_zone_5_min: sumMetric(signals, ['workout_hr_zone_5_min']),
    waking_cardio_load: sumMetric(signals, ['waking_cardio_load']),
    waking_cardio_strain: maxMetric(signals, ['waking_cardio_strain']),
    waking_hr_avg_bpm: medianMetric(signals, ['waking_hr_avg_bpm']),
    waking_hr_max_bpm: maxMetric(signals, ['waking_hr_max_bpm']),
    waking_hr_zone_1_min: sumMetric(signals, ['waking_hr_zone_1_min']),
    waking_hr_zone_2_min: sumMetric(signals, ['waking_hr_zone_2_min']),
    waking_hr_zone_3_min: sumMetric(signals, ['waking_hr_zone_3_min']),
    waking_hr_zone_4_min: sumMetric(signals, ['waking_hr_zone_4_min']),
    waking_hr_zone_5_min: sumMetric(signals, ['waking_hr_zone_5_min']),
    waking_hr_sample_count: sumMetric(signals, ['waking_hr_sample_count']),
  }
}

function subjectiveSummary(
  signals: HealthSnapshotSignal[],
  checkin: HealthSnapshotCheckin | null,
  now: Date,
): Record<string, unknown> {
  const ageHours = checkinAgeHours(checkin, now)
  const levelFreshness = checkinLevelFreshness(checkin, now)
  const stateFreshness = checkinStateFreshness(checkin, now)
  return {
    energy_level: checkin?.energy_level ?? null,
    mood_level: checkin?.mood_level ?? null,
    state: checkin?.state ?? null,
    state_recorded_at: checkin?.recorded_at ?? null,
    state_recorded_timezone: checkin?.recorded_timezone ?? null,
    checkin_age_minutes: ageHours === null ? null : Math.round(ageHours * 60),
    checkin_level_freshness: roundOrNull(levelFreshness, 3),
    checkin_state_freshness: roundOrNull(stateFreshness, 3),
    checkin_quality: checkinQualityLabel(levelFreshness, stateFreshness, Boolean(checkin)),
    checkin_scale_version: 'checkin_v1_1_5',
    rize_focus_minutes: sumMetric(signals, ['focus_minutes', 'rize_focus_minutes']),
    state_of_mind_valence: medianMetric(signals, ['state_of_mind_valence']),
  }
}

function checkinQualityLabel(levelFreshness: number, stateFreshness: number, hasCheckin: boolean): string {
  if (!hasCheckin) return 'missing'
  if (levelFreshness >= 0.7 && stateFreshness >= 0.5) return 'fresh'
  if (levelFreshness > 0 || stateFreshness > 0) return 'partial'
  return 'stale'
}

interface BodySummary extends Record<string, unknown> {
  body_mass_kg: number | null
  body_fat_percentage: number | null
  lean_body_mass_kg: number | null
  muscle_mass_percentage: number | null
  body_mass_index: number | null
  waist_circumference_cm: number | null
}

interface BodyMetricReading {
  value: number
  signal: HealthSnapshotSignal
}

function bodySummary(signals: HealthSnapshotSignal[]): BodySummary {
  const bodyMass = latestBodyMetric(signals, ['body_mass'], 'body_mass_kg')
  const bodyFat = latestBodyMetric(signals, ['body_fat_percentage'], 'body_fat_percentage')
  const directLeanMass = latestBodyMetric(signals, ['lean_body_mass'], 'lean_body_mass_kg')
  const directMuscle = latestBodyMetric(signals, [
    'muscle_mass_percentage',
    'skeletal_muscle_percentage',
    'body_muscle_percentage',
  ], 'muscle_mass_percentage')
  const height = latestBodyMetric(signals, ['height'], 'height_m')
  const directBmi = latestBodyMetric(signals, ['body_mass_index'], 'body_mass_index')
  const waist = latestBodyMetric(signals, ['waist_circumference'], 'waist_circumference_cm')
  const bodyMassKg = bodyMass?.value ?? null
  const bodyFatPercentage = bodyFat?.value ?? null
  const derivedLeanMassKg = bodyMassKg !== null && bodyFatPercentage !== null
    ? bodyMassKg * (1 - bodyFatPercentage / 100)
    : null
  const leanBodyMassKg = directLeanMass?.value ?? derivedLeanMassKg
  const heightM = height?.value ?? null
  const derivedBmi = bodyMassKg !== null && heightM !== null
    ? bodyMassKg / (heightM * heightM)
    : null
  const dateOfBirth = latestMetricSignal(signals, ['date_of_birth'])?.value_text ?? null
  const biologicalSex = biologicalSexLabel(numberOrNull(latestMetricSignal(signals, ['biological_sex'])?.value_numeric))
  const bmrKcal = basalMetabolicRateKcal({
    bodyMassKg,
    heightM,
    ageYears: ageYearsFromDate(dateOfBirth),
    sex: biologicalSex,
  })
  const fatMassKg = bodyMassKg !== null && bodyFatPercentage !== null ? bodyMassKg * (bodyFatPercentage / 100) : null
  const leanMassPercentage = bodyMassKg !== null && leanBodyMassKg !== null ? (leanBodyMassKg / bodyMassKg) * 100 : null

  return {
    body_mass_kg: bodyMassKg,
    body_fat_percentage: bodyFatPercentage,
    lean_body_mass_kg: leanBodyMassKg,
    muscle_mass_percentage: directMuscle?.value ?? null,
    body_mass_index: directBmi?.value ?? derivedBmi,
    waist_circumference_cm: waist?.value ?? null,
    height_m: roundOrNull(heightM, 3),
    fat_mass_kg: roundOrNull(fatMassKg, 3),
    lean_mass_percentage: roundOrNull(leanMassPercentage, 3),
    basal_metabolic_rate_kcal: roundOrNull(bmrKcal, 0),
    body_model: 'body_composition_v1',
    body_quality: bodyQualitySummary({
      bodyMass,
      bodyFat,
      leanMass: directLeanMass,
      height,
      waist,
      directBmi,
      directMuscle,
      hasDerivedLeanMass: directLeanMass === null && leanBodyMassKg !== null,
      hasDerivedBmi: directBmi === null && derivedBmi !== null,
      hasBmr: bmrKcal !== null,
    }),
  }
}

type BodyMetricKind =
  | 'body_mass_kg'
  | 'body_fat_percentage'
  | 'lean_body_mass_kg'
  | 'muscle_mass_percentage'
  | 'body_mass_index'
  | 'waist_circumference_cm'
  | 'height_m'

function latestBodyMetric(
  signals: HealthSnapshotSignal[],
  signalTypes: string[],
  kind: BodyMetricKind,
): BodyMetricReading | null {
  const matches = signals
    .filter((signal) => signalTypes.includes(signal.signal_type) && typeof signal.value_numeric === 'number')
    .sort((a, b) => metricTime(b) - metricTime(a))

  for (const signal of matches) {
    const value = normalizeBodyMetricValue(Number(signal.value_numeric), signal.unit, kind)
    if (value !== null) return { value, signal }
  }

  return null
}

function latestMetricSignal(signals: HealthSnapshotSignal[], signalTypes: string[]): HealthSnapshotSignal | null {
  return signals
    .filter((signal) => signalTypes.includes(signal.signal_type))
    .sort((a, b) => metricTime(b) - metricTime(a))[0] ?? null
}

function normalizeBodyMetricValue(value: number, unit: string | null | undefined, kind: BodyMetricKind): number | null {
  if (!Number.isFinite(value)) return null
  const normalizedUnit = typeof unit === 'string' && unit.trim() !== '' ? unit.trim() : null

  switch (kind) {
    case 'height_m': {
      if (!isKnownBodyUnit(normalizedUnit, ['m', 'cm'])) return null
      const meters = normalizedUnit === 'cm' || (!normalizedUnit && value > 3) ? value / 100 : value
      return meters >= 0.5 && meters <= 2.5 ? meters : null
    }
    case 'waist_circumference_cm': {
      if (!isKnownBodyUnit(normalizedUnit, ['m', 'cm'])) return null
      const centimeters = normalizedUnit === 'm' || (!normalizedUnit && value <= 3) ? value * 100 : value
      return centimeters >= 30 && centimeters <= 250 ? centimeters : null
    }
    case 'body_fat_percentage': {
      if (!isKnownBodyUnit(normalizedUnit, ['%', 'count'])) return null
      const percent = normalizePercent(value)
      return percent !== null && percent >= 3 && percent <= 75 ? percent : null
    }
    case 'muscle_mass_percentage': {
      if (!isKnownBodyUnit(normalizedUnit, ['%', 'count'])) return null
      const percent = normalizePercent(value)
      return percent !== null && percent >= 15 && percent <= 95 ? percent : null
    }
    case 'body_mass_kg':
      if (!isKnownBodyUnit(normalizedUnit, ['kg'])) return null
      return value >= 20 && value <= 350 ? value : null
    case 'lean_body_mass_kg':
      if (!isKnownBodyUnit(normalizedUnit, ['kg'])) return null
      return value >= 10 && value <= 250 ? value : null
    case 'body_mass_index':
      if (!isKnownBodyUnit(normalizedUnit, ['count'])) return null
      return value >= 8 && value <= 90 ? value : null
  }
}

function isKnownBodyUnit(unit: string | null, allowed: string[]): boolean {
  return unit === null || allowed.includes(unit)
}

function basalMetabolicRateKcal(input: {
  bodyMassKg: number | null
  heightM: number | null
  ageYears: number | null
  sex: 'female' | 'male' | null
}): number | null {
  const { bodyMassKg, heightM, ageYears, sex } = input
  if (bodyMassKg === null || heightM === null || ageYears === null || !sex) return null

  const heightCm = heightM * 100
  const sexOffset = sex === 'male' ? 5 : -161
  const bmr = (10 * bodyMassKg) + (6.25 * heightCm) - (5 * ageYears) + sexOffset
  return Number.isFinite(bmr) && bmr >= 700 && bmr <= 3500 ? bmr : null
}

function ageYearsFromDate(iso?: string | null, now = new Date()): number | null {
  if (!iso) return null
  const birth = new Date(iso)
  if (!Number.isFinite(birth.getTime()) || birth > now) return null
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--
  return age >= 0 && age <= 130 ? age : null
}

function biologicalSexLabel(value: number | null): 'female' | 'male' | null {
  if (value === 1) return 'female'
  if (value === 2) return 'male'
  return null
}

function bodyQualitySummary(input: {
  bodyMass: BodyMetricReading | null
  bodyFat: BodyMetricReading | null
  leanMass: BodyMetricReading | null
  height: BodyMetricReading | null
  waist: BodyMetricReading | null
  directBmi: BodyMetricReading | null
  directMuscle: BodyMetricReading | null
  hasDerivedLeanMass: boolean
  hasDerivedBmi: boolean
  hasBmr: boolean
}): Record<string, unknown> {
  return {
    body_mass_source: metricSource(input.bodyMass?.signal),
    body_fat_source: metricSource(input.bodyFat?.signal),
    lean_mass_source: input.leanMass ? metricSource(input.leanMass.signal) : input.hasDerivedLeanMass ? 'derived_from_weight_and_fat' : null,
    height_source: metricSource(input.height?.signal),
    waist_source: metricSource(input.waist?.signal),
    bmi_source: input.directBmi ? metricSource(input.directBmi.signal) : input.hasDerivedBmi ? 'derived_from_weight_and_height' : null,
    muscle_source: metricSource(input.directMuscle?.signal),
    bmr_source: input.hasBmr ? 'mifflin_st_jeor' : null,
    stale_measurements_allowed: true,
    notes: [
      'Height, waist and body composition are last-measurement metrics, not daily freshness metrics.',
      'Lean mass percentage is not stored as muscle percentage unless a direct muscle metric exists.',
    ],
  }
}

function metricSource(signal?: HealthSnapshotSignal | null): string | null {
  if (!signal) return null
  const healthkitType = isRecord(signal.metadata?.healthkit) ? signal.metadata.healthkit.type : null
  return typeof healthkitType === 'string' ? `healthkit:${healthkitType}` : signal.source
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function signalBelongsToDate(signal: HealthSnapshotSignal, snapshotDate: string): boolean {
  return localDateKey(new Date(metricTime(signal))) === snapshotDate
}

function latestCheckinForDate(checkins: HealthSnapshotCheckin[], snapshotDate: string): HealthSnapshotCheckin | null {
  return checkins
    .filter((checkin) => localDateKey(new Date(checkin.recorded_at)) === snapshotDate)
    .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())[0] ?? null
}

function latestByDate(
  signals: HealthSnapshotSignal[],
  signalTypes: string[],
  snapshotDate: string,
  useEndTime = false,
): HealthSnapshotSignal | null {
  return signals
    .filter((signal) => signalTypes.includes(signal.signal_type) && localDateKey(new Date(useEndTime ? signal.ended_at ?? signal.started_at : signal.started_at)) === snapshotDate)
    .sort((a, b) => metricTime(b) - metricTime(a))[0] ?? null
}

function medianMetric(signals: HealthSnapshotSignal[], signalTypes: string[]): number | null {
  const values = numericValues(signals, signalTypes)
  return values.length > 0 ? median(values) : null
}

function latestMetric(signals: HealthSnapshotSignal[], signalTypes: string[]): number | null {
  return numberOrNull(signals
    .filter((signal) => signalTypes.includes(signal.signal_type) && typeof signal.value_numeric === 'number')
    .sort((a, b) => metricTime(b) - metricTime(a))[0]?.value_numeric)
}

function sumMetric(signals: HealthSnapshotSignal[], signalTypes: string[]): number | null {
  const values = numericValues(signals, signalTypes)
  return values.length > 0 ? values.reduce((acc, value) => acc + value, 0) : null
}

function maxMetric(signals: HealthSnapshotSignal[], signalTypes: string[]): number | null {
  const values = numericValues(signals, signalTypes)
  return values.length > 0 ? Math.max(...values) : null
}

function numericValues(signals: HealthSnapshotSignal[], signalTypes: string[]): number[] {
  return signals
    .filter((signal) => signalTypes.includes(signal.signal_type) && typeof signal.value_numeric === 'number')
    .map((signal) => Number(signal.value_numeric))
    .filter((value) => Number.isFinite(value))
}

function sourceCounts(signals: HealthSnapshotSignal[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const signal of signals) {
    counts[signal.source] = (counts[signal.source] ?? 0) + 1
  }
  return counts
}

function metricTime(signal: HealthSnapshotSignal): number {
  const iso = signal.signal_type === 'sleep_duration_hours' || signal.signal_type === 'sleep_stage' || signal.signal_type.startsWith('sleep_hr_') || signal.signal_type === 'sleep_breathing_disturbances'
    ? signal.ended_at ?? signal.started_at
    : signal.started_at
  return new Date(iso).getTime()
}

function normalizePercent(value: number | null): number | null {
  if (value === null) return null
  return Math.abs(value) <= 1 ? value * 100 : value
}

function physiologicalAgeReading(
  value: number | null,
  unit: string | null,
  date: string,
  source: string,
): { value: number | null; unit: string | null; date: string; source: string } | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? { value, unit, date, source }
    : null
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function roundOrNull(value: number | null, digits: number): number | null {
  if (value === null || !Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function confidenceForStorage(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null

  const fraction = value > 1 ? value / 100 : value
  return roundOrNull(Math.min(1, Math.max(0, fraction)), 3)
}

function intOrNull(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.round(value)
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

function absoluteMedianDeviation(values: number[]): number | null {
  if (values.length < 3) return null
  const baseline = median(values)
  return average(values.map((value) => Math.abs(value - baseline)))
}

function clockMinuteForSleep(iso: string): number | null {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return null
  const minute = date.getHours() * 60 + date.getMinutes()
  return minute < 12 * 60 ? minute + 24 * 60 : minute
}

function clockMinuteForWake(iso: string): number | null {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return null
  return date.getHours() * 60 + date.getMinutes()
}

function midpointMinuteForSleep(bedtime: string, wakeTime: string): number | null {
  const start = new Date(bedtime).getTime()
  const end = new Date(wakeTime).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return clockMinuteForSleep(new Date(start + (end - start) / 2).toISOString())
}

function socialJetlagMinutes(nights: Array<{ key: string; bedtime: string | null; wakeTime: string | null }>): number | null {
  const weekday: number[] = []
  const weekend: number[] = []

  for (const night of nights) {
    if (!night.bedtime || !night.wakeTime) continue
    const midpoint = midpointMinuteForSleep(night.bedtime, night.wakeTime)
    if (typeof midpoint !== 'number') continue
    const date = dateFromLocalKey(night.key)
    if (!date) continue
    const day = date.getDay()
    const bucket = day === 0 || day === 6 ? weekend : weekday
    bucket.push(midpoint)
  }

  if (weekday.length < 2 || weekend.length < 1) return null
  return Math.abs(Number(average(weekend)) - Number(average(weekday)))
}

function emptySleepRegularity(nights = 0): Record<string, number | null> & { regularity_nights: number } {
  return {
    bedtime_regularity_minutes: null,
    wake_regularity_minutes: null,
    midpoint_regularity_minutes: null,
    social_jetlag_minutes: null,
    regularity_score: null,
    regularity_nights: nights,
  }
}
function startOfLocalDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function recentSnapshotDates(now: Date, days: number): string[] {
  return Array.from({ length: days }, (_, offset) => {
    const date = startOfLocalDay(now)
    date.setDate(date.getDate() - offset)
    return localDateKey(date)
  })
}

function normalizedSnapshotDates(dates: string[]): string[] {
  return [...new Set(dates)]
    .filter((date) => dateFromLocalKey(date) !== null)
    .sort((a, b) => new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime())
}

function dateFromLocalKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)

  return Number.isFinite(date.getTime()) ? date : null
}

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function deterministicUuid(input: string): string {
  const [a, b, c, d] = cyrb128(input)
  const hex = [a, b, c, d].map((value) => value.toString(16).padStart(8, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hex.slice(18, 20),
    hex.slice(20, 32),
  ].join('-')
}

function cyrb128(value: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762

  for (let index = 0; index < value.length; index++) {
    const k = value.charCodeAt(index)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }

  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)

  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ]
}
