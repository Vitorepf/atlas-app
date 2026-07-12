import { clamp } from './mathUtils'
export const ATLAS_PHYSIOLOGICAL_AGE_MODEL_VERSION = 'atlas_physiological_age_v1'

const DEFAULT_WINDOW_DAYS = 90
const RECENT_WINDOW_DAYS = 28
const VO2_MAX_AGE_DAYS = 180
const BODY_MEASUREMENT_MAX_AGE_DAYS = 3650
const BODY_MEASUREMENT_CONFIDENCE_DAYS = 365

type BiologicalSex = 'female' | 'male'

export type AtlasPhysiologicalAgeStatus = 'strong' | 'partial' | 'insufficient'

export interface PhysiologicalAgeSignal {
  signal_type: string
  value_numeric?: number | null
  value_text?: string | null
  unit?: string | null
  started_at: string
  ended_at?: string | null
  source?: string | null
  metadata?: Record<string, unknown> | null
}

export interface PhysiologicalAgeSnapshot {
  snapshot_date: string
  computed_at: string
  sleep_score?: number | null
  hrv_ms?: number | null
  resting_heart_rate_bpm?: number | null
  vo2max?: number | null
  steps?: number | null
  exercise_minutes?: number | null
  body_mass_kg?: number | null
  body_fat_percentage?: number | null
  lean_body_mass_kg?: number | null
  body_mass_index?: number | null
  waist_circumference_cm?: number | null
  sleep?: Record<string, unknown> | null
  body?: Record<string, unknown> | null
}

export interface PhysiologicalAgeReading {
  value: number | null
  unit?: string | null
  date?: string | null
  source?: string | null
  confidence?: number | null
}

export interface AtlasPhysiologicalAgeCurrentMetrics {
  sleepScore?: PhysiologicalAgeReading | null
  sleepRegularityScore?: PhysiologicalAgeReading | null
  hrvMs?: PhysiologicalAgeReading | null
  restingHeartRateBpm?: PhysiologicalAgeReading | null
  vo2max?: PhysiologicalAgeReading | null
  stepsDailyAverage?: PhysiologicalAgeReading | null
  exerciseDailyAverageMin?: PhysiologicalAgeReading | null
  bodyMassKg?: PhysiologicalAgeReading | null
  bodyFatPercentage?: PhysiologicalAgeReading | null
  leanBodyMassKg?: PhysiologicalAgeReading | null
  leanMassPercentage?: PhysiologicalAgeReading | null
  bodyMassIndex?: PhysiologicalAgeReading | null
  waistCircumferenceCm?: PhysiologicalAgeReading | null
  heightM?: PhysiologicalAgeReading | null
}

export interface AtlasPhysiologicalAgeContribution {
  key: string
  label: string
  value: number
  unit: string
  impactYears: number
  confidence: number
  weight: number
  quality: 'alta' | 'média' | 'baixa'
  source: string
}

export interface AtlasPhysiologicalAgeModel {
  modelVersion: typeof ATLAS_PHYSIOLOGICAL_AGE_MODEL_VERSION
  ageYears: number | null
  chronologicalAgeYears: number | null
  impactYears: number | null
  confidence: number
  coverage: number
  status: AtlasPhysiologicalAgeStatus
  windowDays: number
  computedAt: string
  contributors: AtlasPhysiologicalAgeContribution[]
  missingCore: string[]
  summary: string
  caveats: string[]
}

interface TimedReading extends PhysiologicalAgeReading {
  value: number
  date: string
}

export function buildAtlasPhysiologicalAge(input: {
  signals: PhysiologicalAgeSignal[]
  snapshots?: PhysiologicalAgeSnapshot[]
  now?: Date
  windowDays?: number
  current?: AtlasPhysiologicalAgeCurrentMetrics
}): AtlasPhysiologicalAgeModel {
  const now = input.now ?? new Date()
  const computedAt = now.toISOString()
  const windowDays = Math.max(RECENT_WINDOW_DAYS, input.windowDays ?? DEFAULT_WINDOW_DAYS)
  const signals = input.signals.filter((signal) => metricTime(signal) <= now.getTime())
  const snapshots = (input.snapshots ?? [])
    .filter((snapshot) => new Date(snapshot.computed_at).getTime() <= now.getTime())
    .sort((a, b) => new Date(b.computed_at).getTime() - new Date(a.computed_at).getTime())
  const current = input.current ?? {}

  const chronologicalAgeYears = ageYearsFromDate(latestTextSignal(signals, ['date_of_birth'])?.value_text, now)
  const sex = biologicalSexLabel(latestNumericSignal(signals, ['biological_sex'])?.value ?? null)
  const missingCore = [
    chronologicalAgeYears === null ? 'data de nascimento' : null,
    !sex ? 'sexo biológico' : null,
  ].filter((value): value is string => Boolean(value))

  const contributors: AtlasPhysiologicalAgeContribution[] = []

  if (chronologicalAgeYears !== null && sex) {
    const vo2max = coalesceReading(
      current.vo2max,
      latestSnapshotReading(snapshots, 'vo2max', 'ml/(kg*min)', now, VO2_MAX_AGE_DAYS),
      latestNumericSignal(signals, ['vo2max'], now, VO2_MAX_AGE_DAYS, 'ml/(kg*min)'),
    )
    if (vo2max) {
      const cardioAge = cardioFitnessAgeFromVo2(vo2max.value, sex)
      contributors.push(contribution({
        key: 'vo2max',
        label: 'VO2max',
        value: vo2max.value,
        unit: 'ml/kg/min',
        impactYears: clamp((cardioAge - chronologicalAgeYears) * 0.55, -10, 12),
        confidence: freshnessConfidence(vo2max.date, now, VO2_MAX_AGE_DAYS, 0.9),
        weight: 0.24,
        source: vo2max.source ?? 'HealthKit',
      }))
    }

    const rhr = coalesceReading(
      current.restingHeartRateBpm,
      snapshotWindowAverage(snapshots, 'resting_heart_rate_bpm', 'bpm', now, RECENT_WINDOW_DAYS),
      signalDailyMedianAverage(signals, ['resting_heart_rate_bpm'], 'bpm', now, RECENT_WINDOW_DAYS),
    )
    if (rhr) {
      contributors.push(contribution({
        key: 'resting_heart_rate',
        label: 'FC repouso',
        value: rhr.value,
        unit: 'bpm',
        impactYears: clamp((rhr.value - 60) * 0.16, -3.5, 6),
        confidence: rhr.confidence ?? freshnessConfidence(rhr.date, now, RECENT_WINDOW_DAYS, 0.84),
        weight: 0.13,
        source: rhr.source ?? 'HealthKit',
      }))
    }

    const hrv = coalesceReading(
      current.hrvMs,
      snapshotWindowAverage(snapshots, 'hrv_ms', 'ms', now, RECENT_WINDOW_DAYS),
      signalDailyMedianAverage(signals, ['hrv_ms'], 'ms', now, RECENT_WINDOW_DAYS),
    )
    if (hrv) {
      contributors.push(contribution({
        key: 'hrv',
        label: 'HRV',
        value: hrv.value,
        unit: 'ms',
        impactYears: hrvAgeImpact(hrv.value),
        confidence: hrv.confidence ?? freshnessConfidence(hrv.date, now, RECENT_WINDOW_DAYS, 0.78),
        weight: 0.1,
        source: hrv.source ?? 'HealthKit',
      }))
    }

    const sleepScore = coalesceReading(
      current.sleepScore,
      snapshotWindowAverage(snapshots, 'sleep_score', '%', now, RECENT_WINDOW_DAYS),
    )
    if (sleepScore) {
      contributors.push(contribution({
        key: 'sleep_score',
        label: 'Sono',
        value: sleepScore.value,
        unit: '%',
        impactYears: clamp((78 - sleepScore.value) * 0.12, -2.5, 5),
        confidence: sleepScore.confidence ?? freshnessConfidence(sleepScore.date, now, RECENT_WINDOW_DAYS, 0.82),
        weight: 0.16,
        source: sleepScore.source ?? 'snapshot Atlas',
      }))
    }

    const sleepRegularity = coalesceReading(
      current.sleepRegularityScore,
      snapshotJsonWindowAverage(snapshots, 'sleep', 'regularity_score', '%', now, RECENT_WINDOW_DAYS),
    )
    if (sleepRegularity) {
      contributors.push(contribution({
        key: 'sleep_regularity',
        label: 'Regularidade do sono',
        value: sleepRegularity.value,
        unit: '%',
        impactYears: clamp((82 - sleepRegularity.value) * 0.08, -1.5, 3),
        confidence: sleepRegularity.confidence ?? freshnessConfidence(sleepRegularity.date, now, RECENT_WINDOW_DAYS, 0.76),
        weight: 0.09,
        source: sleepRegularity.source ?? 'snapshot Atlas',
      }))
    }

    const steps = coalesceReading(
      current.stepsDailyAverage,
      snapshotWindowAverage(snapshots, 'steps', 'passos/dia', now, RECENT_WINDOW_DAYS),
      signalDailySumAverage(signals, ['steps'], 'passos/dia', now, RECENT_WINDOW_DAYS),
    )
    const exercise = coalesceReading(
      current.exerciseDailyAverageMin,
      snapshotWindowAverage(snapshots, 'exercise_minutes', 'min/dia', now, RECENT_WINDOW_DAYS),
      signalDailySumAverage(signals, ['exercise_minutes'], 'min/dia', now, RECENT_WINDOW_DAYS),
    )
    const activity = activityReading(steps, exercise)
    if (activity) {
      contributors.push(contribution({
        key: 'activity',
        label: 'Atividade',
        value: activity.value,
        unit: activity.unit,
        impactYears: activity.impactYears,
        confidence: activity.confidence,
        weight: 0.14,
        source: activity.source,
      }))
    }

    const body = bodyCompositionContribution({
      current,
      snapshots,
      signals,
      now,
      sex,
      chronologicalAgeYears,
    })
    if (body) {
      contributors.push(body)
    }
  }

  const coverage = round(clamp(contributors.reduce((sum, item) => sum + item.weight, 0), 0, 1), 3)
  const weightedConfidence = weightedAverage(contributors.map((item) => [item.confidence, item.weight]))
  const confidence = round(clamp((weightedConfidence ?? 0) * coverage, 0, 1), 3)
  const hasRequiredPhysiology = contributors.some((item) => item.key === 'vo2max' || item.key === 'resting_heart_rate')
  const status = missingCore.length > 0 || contributors.length < 3 || !hasRequiredPhysiology || coverage < 0.42 || confidence < 0.36
    ? 'insufficient'
    : coverage >= 0.72 && confidence >= 0.62 && contributors.length >= 5
      ? 'strong'
      : 'partial'
  const rawImpact = contributors.reduce((sum, item) => sum + item.impactYears, 0)
  const impactYears = status === 'insufficient' ? null : round(clamp(rawImpact, -15, 18), 1)
  const ageYears = chronologicalAgeYears !== null && impactYears !== null
    ? round(clamp(chronologicalAgeYears + impactYears, 18, 95), 1)
    : null

  return {
    modelVersion: ATLAS_PHYSIOLOGICAL_AGE_MODEL_VERSION,
    ageYears,
    chronologicalAgeYears,
    impactYears,
    confidence,
    coverage,
    status,
    windowDays,
    computedAt,
    contributors: contributors.sort((a, b) => Math.abs(b.impactYears) - Math.abs(a.impactYears)),
    missingCore,
    summary: physiologicalAgeSummary({ status, ageYears, chronologicalAgeYears, impactYears, contributors, confidence, coverage }),
    caveats: [
      'Modelo wellness/operacional, não diagnóstico clínico.',
      'A idade só é exibida quando há identidade biológica e cobertura mínima de fisiologia longitudinal.',
      'Métricas sobrepostas são limitadas por peso para reduzir dupla contagem.',
      'Composição corporal influencia o resultado, mas não domina o modelo.',
    ],
  }
}

export function physiologicalAgeForStorage(model: AtlasPhysiologicalAgeModel): Record<string, unknown> {
  return {
    model_version: model.modelVersion,
    age_years: model.ageYears,
    chronological_age_years: model.chronologicalAgeYears,
    impact_years: model.impactYears,
    confidence: model.confidence,
    coverage: model.coverage,
    status: model.status,
    window_days: model.windowDays,
    computed_at: model.computedAt,
    contributors: model.contributors.map((item) => ({
      key: item.key,
      label: item.label,
      value: round(item.value, 3),
      unit: item.unit,
      impact_years: round(item.impactYears, 2),
      confidence: round(item.confidence, 3),
      weight: item.weight,
      quality: item.quality,
      source: item.source,
    })),
    missing_core: model.missingCore,
    summary: model.summary,
    caveats: model.caveats,
  }
}

function bodyCompositionContribution(input: {
  current: AtlasPhysiologicalAgeCurrentMetrics
  snapshots: PhysiologicalAgeSnapshot[]
  signals: PhysiologicalAgeSignal[]
  now: Date
  sex: BiologicalSex
  chronologicalAgeYears: number
}): AtlasPhysiologicalAgeContribution | null {
  const bodyMass = coalesceReading(
    input.current.bodyMassKg,
    latestBodySignal(input.signals, ['body_mass'], 'body_mass_kg', 'kg', input.now, BODY_MEASUREMENT_MAX_AGE_DAYS),
    latestSnapshotReading(input.snapshots, 'body_mass_kg', 'kg', input.now, BODY_MEASUREMENT_MAX_AGE_DAYS),
  )
  const bodyFat = coalesceReading(
    input.current.bodyFatPercentage,
    latestBodySignal(input.signals, ['body_fat_percentage'], 'body_fat_percentage', '%', input.now, BODY_MEASUREMENT_MAX_AGE_DAYS),
    latestSnapshotReading(input.snapshots, 'body_fat_percentage', '%', input.now, BODY_MEASUREMENT_MAX_AGE_DAYS),
  )
  const directBmi = coalesceReading(
    input.current.bodyMassIndex,
    latestBodySignal(input.signals, ['body_mass_index'], 'body_mass_index', null, input.now, BODY_MEASUREMENT_MAX_AGE_DAYS),
    latestSnapshotReading(input.snapshots, 'body_mass_index', null, input.now, BODY_MEASUREMENT_MAX_AGE_DAYS),
  )
  const height = coalesceReading(
    input.current.heightM,
    latestBodySignal(input.signals, ['height'], 'height_m', 'm', input.now, BODY_MEASUREMENT_MAX_AGE_DAYS),
    latestSnapshotJsonReading(input.snapshots, 'body', 'height_m', 'm', input.now, BODY_MEASUREMENT_MAX_AGE_DAYS),
  )
  const waist = coalesceReading(
    input.current.waistCircumferenceCm,
    latestBodySignal(input.signals, ['waist_circumference'], 'waist_circumference_cm', 'cm', input.now, BODY_MEASUREMENT_MAX_AGE_DAYS),
    latestSnapshotReading(input.snapshots, 'waist_circumference_cm', 'cm', input.now, BODY_MEASUREMENT_MAX_AGE_DAYS),
  )
  const leanMass = coalesceReading(
    input.current.leanBodyMassKg,
    latestBodySignal(input.signals, ['lean_body_mass'], 'lean_body_mass_kg', 'kg', input.now, BODY_MEASUREMENT_MAX_AGE_DAYS),
    latestSnapshotReading(input.snapshots, 'lean_body_mass_kg', 'kg', input.now, BODY_MEASUREMENT_MAX_AGE_DAYS),
  )
  const bmi = coalesceReading(
    directBmi,
    bodyMass && height && height.value > 0
      ? {
        value: bodyMass.value / (height.value * height.value),
        unit: null,
        date: latestIso(bodyMass.date, height.date),
        source: 'derivada',
        confidence: Math.min(bodyMass.confidence ?? 0.72, height.confidence ?? 0.9),
      }
      : null,
  )
  const leanMassPercentage = coalesceReading(
    input.current.leanMassPercentage,
    leanMass && bodyMass && bodyMass.value > 0
      ? {
        value: (leanMass.value / bodyMass.value) * 100,
        unit: '%',
        date: leanMass.date ?? bodyMass.date,
        source: 'derivada',
        confidence: Math.min(leanMass.confidence ?? 0.72, bodyMass.confidence ?? 0.72),
      }
      : null,
    latestSnapshotJsonReading(input.snapshots, 'body', 'lean_mass_percentage', '%', input.now, BODY_MEASUREMENT_MAX_AGE_DAYS),
  )

  const impacts: number[] = []
  const confidenceParts: number[] = []
  let latestDate: string | null = null

  if (bodyFat) {
    impacts.push(bodyFatAgeImpact(bodyFat.value, input.sex, input.chronologicalAgeYears))
    confidenceParts.push(bodyFat.confidence ?? freshnessConfidence(bodyFat.date, input.now, BODY_MEASUREMENT_CONFIDENCE_DAYS, 0.72))
    latestDate = latestIso(latestDate, bodyFat.date)
  }
  if (bmi) {
    impacts.push(bmiAgeImpact(bmi.value))
    confidenceParts.push(bmi.confidence ?? freshnessConfidence(bmi.date, input.now, BODY_MEASUREMENT_CONFIDENCE_DAYS, 0.78))
    latestDate = latestIso(latestDate, bmi.date)
  }
  if (waist && height && height.value > 0) {
    const waistToHeight = waist.value / (height.value * 100)
    impacts.push(waistToHeightAgeImpact(waistToHeight))
    confidenceParts.push(Math.min(
      waist.confidence ?? freshnessConfidence(waist.date, input.now, BODY_MEASUREMENT_CONFIDENCE_DAYS, 0.78),
      height.confidence ?? freshnessConfidence(height.date, input.now, BODY_MEASUREMENT_MAX_AGE_DAYS, 0.9),
    ))
    latestDate = latestIso(latestDate, waist.date)
  }
  if (leanMassPercentage) {
    impacts.push(leanMassAgeImpact(leanMassPercentage.value, input.sex))
    confidenceParts.push(leanMassPercentage.confidence ?? freshnessConfidence(leanMassPercentage.date, input.now, BODY_MEASUREMENT_CONFIDENCE_DAYS, 0.72))
    latestDate = latestIso(latestDate, leanMassPercentage.date)
  }

  if (impacts.length === 0) return null

  const value = clamp(impacts.reduce((sum, item) => sum + item, 0), -3.5, 7)
  return contribution({
    key: 'body_composition',
    label: 'Composição corporal',
    value: Math.abs(value),
    unit: 'anos impacto',
    impactYears: value,
    confidence: clamp(average(confidenceParts) * Math.min(1, 0.55 + impacts.length * 0.16), 0, 0.86),
    weight: 0.14,
    source: latestDate ? `última medição ${latestDate.slice(0, 10)}` : 'última medição válida',
  })
}

function activityReading(
  steps: TimedReading | null,
  exercise: TimedReading | null,
): { value: number; unit: string; impactYears: number; confidence: number; source: string } | null {
  if (!steps && !exercise) return null
  const impacts: number[] = []
  const confidences: number[] = []
  const parts: string[] = []

  if (steps) {
    impacts.push(stepsAgeImpact(steps.value))
    confidences.push(steps.confidence ?? 0.74)
    parts.push(`${Math.round(steps.value).toLocaleString('pt-BR')} passos/dia`)
  }
  if (exercise) {
    impacts.push(exerciseAgeImpact(exercise.value))
    confidences.push(exercise.confidence ?? 0.74)
    parts.push(`${Math.round(exercise.value)} min/dia`)
  }

  return {
    value: exercise?.value ?? steps?.value ?? 0,
    unit: exercise ? 'min/dia' : 'passos/dia',
    impactYears: clamp(impacts.reduce((sum, item) => sum + item, 0), -3.5, 4.5),
    confidence: clamp(average(confidences), 0, 0.86),
    source: parts.join(' · '),
  }
}

function contribution(input: Omit<AtlasPhysiologicalAgeContribution, 'impactYears' | 'confidence' | 'quality'> & {
  impactYears: number
  confidence: number
}): AtlasPhysiologicalAgeContribution {
  const confidence = round(clamp(input.confidence, 0, 1), 3)
  return {
    ...input,
    impactYears: round(input.impactYears, 2),
    confidence,
    quality: confidence >= 0.82 ? 'alta' : confidence >= 0.62 ? 'média' : 'baixa',
  }
}

function physiologicalAgeSummary(input: {
  status: AtlasPhysiologicalAgeStatus
  ageYears: number | null
  chronologicalAgeYears: number | null
  impactYears: number | null
  contributors: AtlasPhysiologicalAgeContribution[]
  confidence: number
  coverage: number
}): string {
  if (input.status === 'insufficient' || input.ageYears === null || input.chronologicalAgeYears === null || input.impactYears === null) {
    return 'Base em formação: faltam identidade biológica, fisiologia longitudinal ou cobertura mínima.'
  }

  const direction = input.impactYears <= 0 ? 'abaixo' : 'acima'
  const strongest = input.contributors[0]
  const driver = strongest ? ` Principal driver: ${strongest.label} (${signedYears(strongest.impactYears)}).` : ''
  return `Idade fisiológica ${Math.abs(input.impactYears).toFixed(1).replace('.', ',')} anos ${direction} da idade cronológica.${driver} Confiança ${Math.round(input.confidence * 100)}%, cobertura ${Math.round(input.coverage * 100)}%.`
}

function signedYears(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1).replace('.', ',')} anos`
}

function cardioFitnessAgeFromVo2(vo2max: number, sex: BiologicalSex): number {
  const youngAdultMedian = sex === 'male' ? 41.9 : 31.0
  const olderAdultMedian = sex === 'male' ? 19.5 : 14.8
  const declinePerYear = (youngAdultMedian - olderAdultMedian) / 50
  return 25 + (youngAdultMedian - vo2max) / declinePerYear
}

function hrvAgeImpact(value: number): number {
  if (value >= 85) return -2.5
  if (value >= 65) return -1.6
  if (value >= 50) return -0.6
  if (value >= 35) return 1.3
  if (value >= 25) return 2.7
  return 4
}

function stepsAgeImpact(value: number): number {
  if (value >= 11000) return -2.2
  if (value >= 8500) return -1.4
  if (value >= 6500) return -0.5
  if (value >= 4500) return 0.8
  if (value >= 3000) return 1.9
  return 3
}

function exerciseAgeImpact(value: number): number {
  if (value >= 55) return -1.8
  if (value >= 35) return -1
  if (value >= 20) return -0.2
  if (value >= 10) return 1
  return 2.4
}

function bodyFatAgeImpact(value: number, sex: BiologicalSex, age: number): number {
  const reference = sex === 'male'
    ? age < 40 ? 18 : age < 60 ? 21 : 24
    : age < 40 ? 28 : age < 60 ? 31 : 34
  return clamp((value - reference) * 0.32, -2.5, 5.5)
}

function bmiAgeImpact(value: number): number {
  if (value < 18.5) return clamp((18.5 - value) * 0.8, 0, 4)
  if (value <= 24.9) return -0.4
  if (value <= 29.9) return clamp((value - 25) * 0.45, 0, 2.2)
  return clamp(2.2 + (value - 30) * 0.55, 2.2, 7)
}

function waistToHeightAgeImpact(value: number): number {
  if (value <= 0.47) return -0.9
  if (value <= 0.5) return -0.4
  if (value <= 0.58) return clamp((value - 0.5) * 24, 0, 2)
  return clamp(2 + (value - 0.58) * 34, 2, 5)
}

function leanMassAgeImpact(value: number, sex: BiologicalSex): number {
  const reference = sex === 'male' ? 76 : 68
  return clamp((reference - value) * 0.18, -1.4, 3.2)
}

function biologicalSexLabel(value: number | null): BiologicalSex | null {
  if (value === 1) return 'female'
  if (value === 2) return 'male'
  return null
}

function coalesceReading(...values: Array<PhysiologicalAgeReading | null | undefined>): TimedReading | null {
  for (const value of values) {
    if (
      value
      && typeof value.value === 'number'
      && Number.isFinite(value.value)
      && value.date
      && Number.isFinite(new Date(value.date).getTime())
    ) {
      return {
        ...value,
        value: value.value,
        date: value.date,
      }
    }
  }
  return null
}

function latestNumericSignal(
  signals: PhysiologicalAgeSignal[],
  signalTypes: string[],
  now: Date = new Date(),
  maxAgeDays?: number,
  unit?: string | null,
): TimedReading | null {
  const match = signals
    .filter((signal) => signalTypes.includes(signal.signal_type) && typeof signal.value_numeric === 'number')
    .sort((a, b) => metricTime(b) - metricTime(a))[0]
  if (!match || typeof match.value_numeric !== 'number') return null
  if (maxAgeDays !== undefined && !isFresh(match.started_at, now, maxAgeDays)) return null
  return {
    value: match.value_numeric,
    unit: unit ?? match.unit,
    date: match.ended_at ?? match.started_at,
    source: match.source,
  }
}

function latestTextSignal(signals: PhysiologicalAgeSignal[], signalTypes: string[]): PhysiologicalAgeSignal | null {
  return signals
    .filter((signal) => signalTypes.includes(signal.signal_type) && typeof signal.value_text === 'string')
    .sort((a, b) => metricTime(b) - metricTime(a))[0] ?? null
}

function latestBodySignal(
  signals: PhysiologicalAgeSignal[],
  signalTypes: string[],
  kind: 'body_mass_kg' | 'body_fat_percentage' | 'lean_body_mass_kg' | 'body_mass_index' | 'waist_circumference_cm' | 'height_m',
  unit: string | null,
  now: Date,
  maxAgeDays: number,
): TimedReading | null {
  const matches = signals
    .filter((signal) => signalTypes.includes(signal.signal_type) && typeof signal.value_numeric === 'number')
    .sort((a, b) => metricTime(b) - metricTime(a))

  for (const signal of matches) {
    if (!isFresh(signal.started_at, now, maxAgeDays)) continue
    const value = normalizeBodyValue(Number(signal.value_numeric), signal.unit, kind)
    if (value !== null) {
      return {
        value,
        unit,
        date: signal.ended_at ?? signal.started_at,
        source: signal.source,
      }
    }
  }

  return null
}

function latestSnapshotReading(
  snapshots: PhysiologicalAgeSnapshot[],
  key: keyof PhysiologicalAgeSnapshot,
  unit: string | null,
  now: Date,
  maxAgeDays: number,
): TimedReading | null {
  for (const snapshot of snapshots) {
    const value = snapshot[key]
    if (typeof value === 'number' && Number.isFinite(value) && isFresh(snapshot.computed_at, now, maxAgeDays)) {
      return { value, unit, date: snapshot.computed_at, source: 'snapshot Atlas' }
    }
  }
  return null
}

function latestSnapshotJsonReading(
  snapshots: PhysiologicalAgeSnapshot[],
  section: 'body' | 'sleep',
  key: string,
  unit: string | null,
  now: Date,
  maxAgeDays: number,
): TimedReading | null {
  for (const snapshot of snapshots) {
    const payload = snapshot[section]
    const value = isRecord(payload) ? payload[key] : null
    if (typeof value === 'number' && Number.isFinite(value) && isFresh(snapshot.computed_at, now, maxAgeDays)) {
      return { value, unit, date: snapshot.computed_at, source: 'snapshot Atlas' }
    }
  }
  return null
}

function snapshotWindowAverage(
  snapshots: PhysiologicalAgeSnapshot[],
  key: keyof PhysiologicalAgeSnapshot,
  unit: string,
  now: Date,
  days: number,
): TimedReading | null {
  const values = snapshots
    .filter((snapshot) => isFresh(snapshot.computed_at, now, days))
    .map((snapshot) => snapshot[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const latest = snapshots.find((snapshot) => typeof snapshot[key] === 'number' && isFresh(snapshot.computed_at, now, days))
  if (values.length === 0 || !latest) return null
  return {
    value: average(values),
    unit,
    date: latest.computed_at,
    source: `${values.length} snapshots`,
    confidence: sampleConfidence(values.length, days, 0.86),
  }
}

function snapshotJsonWindowAverage(
  snapshots: PhysiologicalAgeSnapshot[],
  section: 'sleep' | 'body',
  key: string,
  unit: string,
  now: Date,
  days: number,
): TimedReading | null {
  const values = snapshots
    .filter((snapshot) => isFresh(snapshot.computed_at, now, days))
    .map((snapshot) => {
      const payload = snapshot[section]
      return isRecord(payload) ? payload[key] : null
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const latest = snapshots.find((snapshot) => {
    const payload = snapshot[section]
    return isRecord(payload) && typeof payload[key] === 'number' && isFresh(snapshot.computed_at, now, days)
  })
  if (values.length === 0 || !latest) return null
  return {
    value: average(values),
    unit,
    date: latest.computed_at,
    source: `${values.length} snapshots`,
    confidence: sampleConfidence(values.length, days, 0.78),
  }
}

function signalDailySumAverage(
  signals: PhysiologicalAgeSignal[],
  signalTypes: string[],
  unit: string,
  now: Date,
  days: number,
): TimedReading | null {
  const byDay = new Map<string, { total: number; latest: string }>()
  const start = new Date(now)
  start.setDate(now.getDate() - days)

  for (const signal of signals) {
    const time = metricTime(signal)
    if (
      time < start.getTime()
      || time > now.getTime()
      || !signalTypes.includes(signal.signal_type)
      || typeof signal.value_numeric !== 'number'
      || !Number.isFinite(signal.value_numeric)
    ) {
      continue
    }
    const key = localDateKey(new Date(signal.started_at))
    const current = byDay.get(key) ?? { total: 0, latest: signal.started_at }
    current.total += signal.value_numeric
    current.latest = latestIso(current.latest, signal.started_at) ?? signal.started_at
    byDay.set(key, current)
  }

  if (byDay.size === 0) return null
  const values = [...byDay.values()]
  return {
    value: average(values.map((item) => item.total)),
    unit,
    date: values.map((item) => item.latest).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0],
    source: `${byDay.size} dias observados`,
    confidence: sampleConfidence(byDay.size, days, 0.8),
  }
}

function signalDailyMedianAverage(
  signals: PhysiologicalAgeSignal[],
  signalTypes: string[],
  unit: string,
  now: Date,
  days: number,
): TimedReading | null {
  const byDay = new Map<string, { values: number[]; latest: string }>()
  const start = new Date(now)
  start.setDate(now.getDate() - days)

  for (const signal of signals) {
    const time = metricTime(signal)
    if (
      time < start.getTime()
      || time > now.getTime()
      || !signalTypes.includes(signal.signal_type)
      || typeof signal.value_numeric !== 'number'
      || !Number.isFinite(signal.value_numeric)
    ) {
      continue
    }
    const key = localDateKey(new Date(signal.started_at))
    const current = byDay.get(key) ?? { values: [], latest: signal.started_at }
    current.values.push(signal.value_numeric)
    current.latest = latestIso(current.latest, signal.started_at) ?? signal.started_at
    byDay.set(key, current)
  }

  if (byDay.size === 0) return null
  const values = [...byDay.values()]
  return {
    value: average(values.map((item) => median(item.values))),
    unit,
    date: values.map((item) => item.latest).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0],
    source: `${byDay.size} dias observados`,
    confidence: sampleConfidence(byDay.size, days, 0.78),
  }
}

function normalizeBodyValue(
  value: number,
  unit: string | null | undefined,
  kind: 'body_mass_kg' | 'body_fat_percentage' | 'lean_body_mass_kg' | 'body_mass_index' | 'waist_circumference_cm' | 'height_m',
): number | null {
  const normalizedUnit = typeof unit === 'string' && unit.trim() !== '' ? unit.trim() : null
  if (!Number.isFinite(value)) return null
  switch (kind) {
    case 'height_m': {
      const meters = normalizedUnit === 'cm' || (!normalizedUnit && value > 3) ? value / 100 : value
      return meters >= 0.5 && meters <= 2.5 ? meters : null
    }
    case 'waist_circumference_cm': {
      const centimeters = normalizedUnit === 'm' || (!normalizedUnit && value <= 3) ? value * 100 : value
      return centimeters >= 30 && centimeters <= 250 ? centimeters : null
    }
    case 'body_fat_percentage': {
      const percent = Math.abs(value) <= 1 ? value * 100 : value
      return percent >= 3 && percent <= 75 ? percent : null
    }
    case 'body_mass_kg':
      return value >= 20 && value <= 350 ? value : null
    case 'lean_body_mass_kg':
      return value >= 10 && value <= 250 ? value : null
    case 'body_mass_index':
      return value >= 8 && value <= 90 ? value : null
  }
}

function freshnessConfidence(date: string | null | undefined, now: Date, maxAgeDays: number, base: number): number {
  if (!date) return base * 0.6
  const ageMs = now.getTime() - new Date(date).getTime()
  if (!Number.isFinite(ageMs) || ageMs < 0) return base * 0.65
  const ageDays = ageMs / 86400000
  return clamp(base * (1 - Math.min(0.38, ageDays / maxAgeDays * 0.38)), 0.35, base)
}

function sampleConfidence(samples: number, targetDays: number, max: number): number {
  const coverage = clamp(samples / Math.min(targetDays, 21), 0, 1)
  return clamp(0.42 + coverage * (max - 0.42), 0.42, max)
}

function isFresh(date: string, now: Date, maxAgeDays: number): boolean {
  const time = new Date(date).getTime()
  if (!Number.isFinite(time)) return false
  const ageMs = now.getTime() - time
  return ageMs >= 0 && ageMs <= maxAgeDays * 86400000
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

function metricTime(signal: PhysiologicalAgeSignal): number {
  return new Date(signal.ended_at ?? signal.started_at).getTime()
}

function latestIso(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null
  if (!b) return a
  return new Date(b).getTime() > new Date(a).getTime() ? b : a
}

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function weightedAverage(values: Array<[number, number]>): number | null {
  const valid = values.filter(([value, weight]) => Number.isFinite(value) && weight > 0)
  const weightSum = valid.reduce((sum, [, weight]) => sum + weight, 0)
  if (weightSum <= 0) return null
  return valid.reduce((sum, [value, weight]) => sum + value * weight, 0) / weightSum
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
