import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import type {
  CategoryTypeIdentifier,
  CorrelationTypeIdentifier,
  ObjectTypeIdentifier,
  QuantityTypeIdentifier,
  QueryStatisticsResponse,
  SampleTypeIdentifier,
} from '@kingstinct/react-native-healthkit'
import type { StorePassiveSignalInput } from './api/client'

type HealthKitModule = typeof import('@kingstinct/react-native-healthkit')

const HEALTHKIT_ENABLED_KEY = 'atlas.healthkit.enabled'
const HEALTHKIT_LAST_SYNC_KEY = 'atlas.healthkit.lastSyncAt'
const HEALTHKIT_LAST_ERROR_KEY = 'atlas.healthkit.lastError'
const HEALTHKIT_LAST_COUNT_KEY = 'atlas.healthkit.lastSignalCount'
const HEALTHKIT_ANCHOR_PREFIX = 'atlas.healthkit.anchor'
const HEALTHKIT_DEBUG_KEY = 'atlas.healthkit.debugTrail'
const HEALTHKIT_HISTORY_BACKFILLED_KEY = 'atlas.healthkit.historyBackfilled.v1'
const HEALTHKIT_HISTORY_BACKFILLED_AT_KEY = 'atlas.healthkit.historyBackfilledAt'
const HEALTHKIT_BACKGROUND_CONFIGURED_AT_KEY = 'atlas.healthkit.backgroundConfiguredAt'
const HEALTHKIT_SAMPLE_LIMIT = 100
const HEALTHKIT_HISTORY_LIMIT = 0
const HEALTHKIT_DAILY_BACKFILL_DAYS = 60
const HEALTHKIT_SLEEP_REFRESH_DAYS = 45
const AUTH_STATUS_SHOULD_REQUEST = 1

const ActivitySummaryTypeIdentifier = 'HKActivitySummaryTypeIdentifier' as const satisfies ObjectTypeIdentifier
const AudiogramTypeIdentifier = 'HKAudiogramSampleType' as const satisfies ObjectTypeIdentifier
const ElectrocardiogramTypeIdentifier = 'HKElectrocardiogramType' as const satisfies ObjectTypeIdentifier
const HeartbeatSeriesTypeIdentifier = 'HKDataTypeIdentifierHeartbeatSeries' as const satisfies ObjectTypeIdentifier
const StateOfMindTypeIdentifier = 'HKStateOfMindTypeIdentifier' as const satisfies ObjectTypeIdentifier
const WorkoutRouteTypeIdentifier = 'HKWorkoutRouteTypeIdentifier' as const satisfies ObjectTypeIdentifier
const WorkoutTypeIdentifier = 'HKWorkoutTypeIdentifier' as const satisfies ObjectTypeIdentifier

const CHARACTERISTIC_TYPES = [
  'HKCharacteristicTypeIdentifierFitzpatrickSkinType',
  'HKCharacteristicTypeIdentifierBiologicalSex',
  'HKCharacteristicTypeIdentifierBloodType',
  'HKCharacteristicTypeIdentifierDateOfBirth',
  'HKCharacteristicTypeIdentifierWheelchairUse',
  'HKCharacteristicTypeIdentifierActivityMoveMode',
] as const satisfies readonly ObjectTypeIdentifier[]

export const HEALTHKIT_QUANTITY_TYPES = [
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKQuantityTypeIdentifierAppleMoveTime',
  'HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances',
  'HKQuantityTypeIdentifierAppleSleepingWristTemperature',
  'HKQuantityTypeIdentifierAppleStandTime',
  'HKQuantityTypeIdentifierAppleWalkingSteadiness',
  'HKQuantityTypeIdentifierAtrialFibrillationBurden',
  'HKQuantityTypeIdentifierBasalBodyTemperature',
  'HKQuantityTypeIdentifierBasalEnergyBurned',
  'HKQuantityTypeIdentifierBloodAlcoholContent',
  'HKQuantityTypeIdentifierBloodGlucose',
  'HKQuantityTypeIdentifierBloodPressureDiastolic',
  'HKQuantityTypeIdentifierBloodPressureSystolic',
  'HKQuantityTypeIdentifierBodyFatPercentage',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierBodyMassIndex',
  'HKQuantityTypeIdentifierBodyTemperature',
  'HKQuantityTypeIdentifierCrossCountrySkiingSpeed',
  'HKQuantityTypeIdentifierCyclingCadence',
  'HKQuantityTypeIdentifierCyclingFunctionalThresholdPower',
  'HKQuantityTypeIdentifierCyclingPower',
  'HKQuantityTypeIdentifierCyclingSpeed',
  'HKQuantityTypeIdentifierDietaryBiotin',
  'HKQuantityTypeIdentifierDietaryCaffeine',
  'HKQuantityTypeIdentifierDietaryCalcium',
  'HKQuantityTypeIdentifierDietaryCarbohydrates',
  'HKQuantityTypeIdentifierDietaryChloride',
  'HKQuantityTypeIdentifierDietaryCholesterol',
  'HKQuantityTypeIdentifierDietaryChromium',
  'HKQuantityTypeIdentifierDietaryCopper',
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierDietaryFatMonounsaturated',
  'HKQuantityTypeIdentifierDietaryFatPolyunsaturated',
  'HKQuantityTypeIdentifierDietaryFatSaturated',
  'HKQuantityTypeIdentifierDietaryFatTotal',
  'HKQuantityTypeIdentifierDietaryFiber',
  'HKQuantityTypeIdentifierDietaryFolate',
  'HKQuantityTypeIdentifierDietaryIodine',
  'HKQuantityTypeIdentifierDietaryIron',
  'HKQuantityTypeIdentifierDietaryMagnesium',
  'HKQuantityTypeIdentifierDietaryManganese',
  'HKQuantityTypeIdentifierDietaryMolybdenum',
  'HKQuantityTypeIdentifierDietaryNiacin',
  'HKQuantityTypeIdentifierDietaryPantothenicAcid',
  'HKQuantityTypeIdentifierDietaryPhosphorus',
  'HKQuantityTypeIdentifierDietaryPotassium',
  'HKQuantityTypeIdentifierDietaryProtein',
  'HKQuantityTypeIdentifierDietaryRiboflavin',
  'HKQuantityTypeIdentifierDietarySelenium',
  'HKQuantityTypeIdentifierDietarySodium',
  'HKQuantityTypeIdentifierDietarySugar',
  'HKQuantityTypeIdentifierDietaryThiamin',
  'HKQuantityTypeIdentifierDietaryVitaminA',
  'HKQuantityTypeIdentifierDietaryVitaminB12',
  'HKQuantityTypeIdentifierDietaryVitaminB6',
  'HKQuantityTypeIdentifierDietaryVitaminC',
  'HKQuantityTypeIdentifierDietaryVitaminD',
  'HKQuantityTypeIdentifierDietaryVitaminE',
  'HKQuantityTypeIdentifierDietaryVitaminK',
  'HKQuantityTypeIdentifierDietaryWater',
  'HKQuantityTypeIdentifierDietaryZinc',
  'HKQuantityTypeIdentifierDistanceCrossCountrySkiing',
  'HKQuantityTypeIdentifierDistanceCycling',
  'HKQuantityTypeIdentifierDistanceDownhillSnowSports',
  'HKQuantityTypeIdentifierDistancePaddleSports',
  'HKQuantityTypeIdentifierDistanceRowing',
  'HKQuantityTypeIdentifierDistanceSkatingSports',
  'HKQuantityTypeIdentifierDistanceSwimming',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierDistanceWheelchair',
  'HKQuantityTypeIdentifierElectrodermalActivity',
  'HKQuantityTypeIdentifierEnvironmentalAudioExposure',
  'HKQuantityTypeIdentifierEnvironmentalSoundReduction',
  'HKQuantityTypeIdentifierEstimatedWorkoutEffortScore',
  'HKQuantityTypeIdentifierFlightsClimbed',
  'HKQuantityTypeIdentifierForcedExpiratoryVolume1',
  'HKQuantityTypeIdentifierForcedVitalCapacity',
  'HKQuantityTypeIdentifierHeadphoneAudioExposure',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierHeartRateRecoveryOneMinute',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierHeight',
  'HKQuantityTypeIdentifierInhalerUsage',
  'HKQuantityTypeIdentifierInsulinDelivery',
  'HKQuantityTypeIdentifierLeanBodyMass',
  'HKQuantityTypeIdentifierNikeFuel',
  'HKQuantityTypeIdentifierNumberOfAlcoholicBeverages',
  'HKQuantityTypeIdentifierNumberOfTimesFallen',
  'HKQuantityTypeIdentifierOxygenSaturation',
  'HKQuantityTypeIdentifierPaddleSportsSpeed',
  'HKQuantityTypeIdentifierPeakExpiratoryFlowRate',
  'HKQuantityTypeIdentifierPeripheralPerfusionIndex',
  'HKQuantityTypeIdentifierPhysicalEffort',
  'HKQuantityTypeIdentifierPushCount',
  'HKQuantityTypeIdentifierRespiratoryRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierRowingSpeed',
  'HKQuantityTypeIdentifierRunningGroundContactTime',
  'HKQuantityTypeIdentifierRunningPower',
  'HKQuantityTypeIdentifierRunningSpeed',
  'HKQuantityTypeIdentifierRunningStrideLength',
  'HKQuantityTypeIdentifierRunningVerticalOscillation',
  'HKQuantityTypeIdentifierSixMinuteWalkTestDistance',
  'HKQuantityTypeIdentifierStairAscentSpeed',
  'HKQuantityTypeIdentifierStairDescentSpeed',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierSwimmingStrokeCount',
  'HKQuantityTypeIdentifierTimeInDaylight',
  'HKQuantityTypeIdentifierUnderwaterDepth',
  'HKQuantityTypeIdentifierUVExposure',
  'HKQuantityTypeIdentifierVO2Max',
  'HKQuantityTypeIdentifierWaistCircumference',
  'HKQuantityTypeIdentifierWalkingAsymmetryPercentage',
  'HKQuantityTypeIdentifierWalkingDoubleSupportPercentage',
  'HKQuantityTypeIdentifierWalkingHeartRateAverage',
  'HKQuantityTypeIdentifierWalkingSpeed',
  'HKQuantityTypeIdentifierWalkingStepLength',
  'HKQuantityTypeIdentifierWaterTemperature',
  'HKQuantityTypeIdentifierWorkoutEffortScore',
] as const satisfies readonly QuantityTypeIdentifier[]

export const HEALTHKIT_CATEGORY_TYPES = [
  'HKCategoryTypeIdentifierAbdominalCramps',
  'HKCategoryTypeIdentifierAcne',
  'HKCategoryTypeIdentifierAppetiteChanges',
  'HKCategoryTypeIdentifierAppleStandHour',
  'HKCategoryTypeIdentifierAppleWalkingSteadinessEvent',
  'HKCategoryTypeIdentifierAudioExposureEvent',
  'HKCategoryTypeIdentifierBladderIncontinence',
  'HKCategoryTypeIdentifierBleedingAfterPregnancy',
  'HKCategoryTypeIdentifierBleedingDuringPregnancy',
  'HKCategoryTypeIdentifierBloating',
  'HKCategoryTypeIdentifierBreastPain',
  'HKCategoryTypeIdentifierCervicalMucusQuality',
  'HKCategoryTypeIdentifierChestTightnessOrPain',
  'HKCategoryTypeIdentifierChills',
  'HKCategoryTypeIdentifierConstipation',
  'HKCategoryTypeIdentifierContraceptive',
  'HKCategoryTypeIdentifierCoughing',
  'HKCategoryTypeIdentifierDiarrhea',
  'HKCategoryTypeIdentifierDizziness',
  'HKCategoryTypeIdentifierDrySkin',
  'HKCategoryTypeIdentifierEnvironmentalAudioExposureEvent',
  'HKCategoryTypeIdentifierFainting',
  'HKCategoryTypeIdentifierFatigue',
  'HKCategoryTypeIdentifierFever',
  'HKCategoryTypeIdentifierGeneralizedBodyAche',
  'HKCategoryTypeIdentifierHairLoss',
  'HKCategoryTypeIdentifierHandwashingEvent',
  'HKCategoryTypeIdentifierHeadache',
  'HKCategoryTypeIdentifierHeadphoneAudioExposureEvent',
  'HKCategoryTypeIdentifierHeartburn',
  'HKCategoryTypeIdentifierHighHeartRateEvent',
  'HKCategoryTypeIdentifierHotFlashes',
  'HKCategoryTypeIdentifierHypertensionEvent',
  'HKCategoryTypeIdentifierInfrequentMenstrualCycles',
  'HKCategoryTypeIdentifierIntermenstrualBleeding',
  'HKCategoryTypeIdentifierIrregularHeartRhythmEvent',
  'HKCategoryTypeIdentifierIrregularMenstrualCycles',
  'HKCategoryTypeIdentifierLactation',
  'HKCategoryTypeIdentifierLossOfSmell',
  'HKCategoryTypeIdentifierLossOfTaste',
  'HKCategoryTypeIdentifierLowCardioFitnessEvent',
  'HKCategoryTypeIdentifierLowHeartRateEvent',
  'HKCategoryTypeIdentifierLowerBackPain',
  'HKCategoryTypeIdentifierMemoryLapse',
  'HKCategoryTypeIdentifierMenstrualFlow',
  'HKCategoryTypeIdentifierMindfulSession',
  'HKCategoryTypeIdentifierMoodChanges',
  'HKCategoryTypeIdentifierNausea',
  'HKCategoryTypeIdentifierNightSweats',
  'HKCategoryTypeIdentifierOvulationTestResult',
  'HKCategoryTypeIdentifierPelvicPain',
  'HKCategoryTypeIdentifierPersistentIntermenstrualBleeding',
  'HKCategoryTypeIdentifierPregnancy',
  'HKCategoryTypeIdentifierPregnancyTestResult',
  'HKCategoryTypeIdentifierProgesteroneTestResult',
  'HKCategoryTypeIdentifierProlongedMenstrualPeriods',
  'HKCategoryTypeIdentifierRapidPoundingOrFlutteringHeartbeat',
  'HKCategoryTypeIdentifierRunnyNose',
  'HKCategoryTypeIdentifierSexualActivity',
  'HKCategoryTypeIdentifierShortnessOfBreath',
  'HKCategoryTypeIdentifierSinusCongestion',
  'HKCategoryTypeIdentifierSkippedHeartbeat',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKCategoryTypeIdentifierSleepApneaEvent',
  'HKCategoryTypeIdentifierSleepChanges',
  'HKCategoryTypeIdentifierSoreThroat',
  'HKCategoryTypeIdentifierToothbrushingEvent',
  'HKCategoryTypeIdentifierVaginalDryness',
  'HKCategoryTypeIdentifierVomiting',
  'HKCategoryTypeIdentifierWheezing',
] as const satisfies readonly CategoryTypeIdentifier[]

export const HEALTHKIT_CORRELATION_TYPES = [
  'HKCorrelationTypeIdentifierBloodPressure',
  'HKCorrelationTypeIdentifierFood',
] as const satisfies readonly CorrelationTypeIdentifier[]

const SPECIAL_SAMPLE_TYPES = [
  StateOfMindTypeIdentifier,
  WorkoutTypeIdentifier,
] as const satisfies readonly ObjectTypeIdentifier[]

const ALL_READ_TYPES = uniqueTypes([
  ...CHARACTERISTIC_TYPES,
  ...HEALTHKIT_QUANTITY_TYPES,
  ...HEALTHKIT_CATEGORY_TYPES,
  ...HEALTHKIT_CORRELATION_TYPES,
  ...SPECIAL_SAMPLE_TYPES,
])

const PRIMARY_HEALTHKIT_QUANTITY_TYPES = [
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKQuantityTypeIdentifierAppleSleepingWristTemperature',
  'HKQuantityTypeIdentifierAppleStandTime',
  'HKQuantityTypeIdentifierBasalEnergyBurned',
  'HKQuantityTypeIdentifierBodyFatPercentage',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierBodyMassIndex',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierHeight',
  'HKQuantityTypeIdentifierLeanBodyMass',
  'HKQuantityTypeIdentifierOxygenSaturation',
  'HKQuantityTypeIdentifierRespiratoryRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierVO2Max',
  'HKQuantityTypeIdentifierWaistCircumference',
] as const satisfies readonly QuantityTypeIdentifier[]

const PRIMARY_HEALTHKIT_CATEGORY_TYPES = [
  'HKCategoryTypeIdentifierMindfulSession',
  'HKCategoryTypeIdentifierSleepAnalysis',
] as const satisfies readonly CategoryTypeIdentifier[]

const PRIMARY_HEALTHKIT_SPECIAL_TYPES = [
  StateOfMindTypeIdentifier,
  WorkoutTypeIdentifier,
] as const satisfies readonly ObjectTypeIdentifier[]

const PRIMARY_READ_TYPES = uniqueTypes([
  ...CHARACTERISTIC_TYPES,
  ...PRIMARY_HEALTHKIT_QUANTITY_TYPES,
  ...PRIMARY_HEALTHKIT_CATEGORY_TYPES,
  ...PRIMARY_HEALTHKIT_SPECIAL_TYPES,
])

const BACKGROUND_SAMPLE_TYPES = uniqueTypes([
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKQuantityTypeIdentifierAppleSleepingWristTemperature',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierOxygenSaturation',
  'HKQuantityTypeIdentifierRespiratoryRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierStepCount',
  'HKCategoryTypeIdentifierMindfulSession',
  'HKCategoryTypeIdentifierSleepAnalysis',
  StateOfMindTypeIdentifier,
  WorkoutTypeIdentifier,
] as const satisfies readonly SampleTypeIdentifier[])

// Keep the primary authorization sheet stable. Some advanced HealthKit objects
// use special/per-object APIs or very large native payloads and can destabilize
// the iOS authorization flow when mixed into the same button.
const SIGNAL_ALIASES: Record<string, string> = {
  HKQuantityTypeIdentifierActiveEnergyBurned: 'active_energy_kcal',
  HKQuantityTypeIdentifierAppleExerciseTime: 'exercise_minutes',
  HKQuantityTypeIdentifierAppleStandTime: 'stand_minutes',
  HKQuantityTypeIdentifierBasalEnergyBurned: 'basal_energy_kcal',
  HKQuantityTypeIdentifierBodyFatPercentage: 'body_fat_percentage',
  HKQuantityTypeIdentifierBodyMass: 'body_mass',
  HKQuantityTypeIdentifierBodyMassIndex: 'body_mass_index',
  HKQuantityTypeIdentifierDistanceWalkingRunning: 'walking_running_distance',
  HKQuantityTypeIdentifierHeight: 'height',
  HKQuantityTypeIdentifierHeartRate: 'heart_rate_bpm',
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: 'hrv_ms',
  HKQuantityTypeIdentifierLeanBodyMass: 'lean_body_mass',
  HKQuantityTypeIdentifierOxygenSaturation: 'oxygen_saturation',
  HKQuantityTypeIdentifierRespiratoryRate: 'respiratory_rate',
  HKQuantityTypeIdentifierRestingHeartRate: 'resting_heart_rate_bpm',
  HKQuantityTypeIdentifierStepCount: 'steps',
  HKQuantityTypeIdentifierVO2Max: 'vo2max',
  HKQuantityTypeIdentifierWaistCircumference: 'waist_circumference',
  HKQuantityTypeIdentifierAppleSleepingWristTemperature: 'wrist_temperature',
  HKCategoryTypeIdentifierSleepAnalysis: 'sleep_stage',
}

const ASLEEP_VALUES = new Set([1, 3, 4, 5])

interface DailyStatisticDefinition {
  identifier: QuantityTypeIdentifier
  signalType: string
  unit: string
}

const DAILY_CUMULATIVE_STATISTICS = [
  {
    identifier: 'HKQuantityTypeIdentifierStepCount',
    signalType: 'steps',
    unit: 'count',
  },
  {
    identifier: 'HKQuantityTypeIdentifierAppleExerciseTime',
    signalType: 'exercise_minutes',
    unit: 'min',
  },
  {
    identifier: 'HKQuantityTypeIdentifierActiveEnergyBurned',
    signalType: 'active_energy_kcal',
    unit: 'kcal',
  },
  {
    identifier: 'HKQuantityTypeIdentifierBasalEnergyBurned',
    signalType: 'basal_energy_kcal',
    unit: 'kcal',
  },
  {
    identifier: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
    signalType: 'walking_running_distance',
    unit: 'm',
  },
  {
    identifier: 'HKQuantityTypeIdentifierAppleStandTime',
    signalType: 'stand_minutes',
    unit: 'min',
  },
] as const satisfies readonly DailyStatisticDefinition[]

const DAILY_STATISTIC_IDENTIFIERS = new Set<string>(
  DAILY_CUMULATIVE_STATISTICS.map((definition) => definition.identifier),
)

const MOST_RECENT_QUANTITY_TYPES = [
  'HKQuantityTypeIdentifierAppleSleepingWristTemperature',
  'HKQuantityTypeIdentifierBodyFatPercentage',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierBodyMassIndex',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierHeight',
  'HKQuantityTypeIdentifierLeanBodyMass',
  'HKQuantityTypeIdentifierOxygenSaturation',
  'HKQuantityTypeIdentifierRespiratoryRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierVO2Max',
  'HKQuantityTypeIdentifierWaistCircumference',
] as const satisfies readonly QuantityTypeIdentifier[]

export interface HealthKitLocalStatus {
  available: boolean
  enabled: boolean
  lastSyncAt: string | null
  lastError: string | null
  lastSignalCount: number
  requestedTypeCount: number
  debugTrail: string[]
  historyBackfilled: boolean
  historyBackfilledAt: string | null
  backgroundConfiguredAt: string | null
}

export interface HealthKitPermissionResult extends HealthKitLocalStatus {
  granted: boolean
  availableTypeCount: number
  unavailableTypeCount: number
  medicationsGranted: boolean
}

export interface HealthKitSyncResult {
  signals: StorePassiveSignalInput[]
  syncedAt: string | null
  signalCount: number
  errors: string[]
}

export async function getHealthKitLocalStatus(): Promise<HealthKitLocalStatus> {
  const [
    enabled,
    lastSyncAt,
    lastError,
    lastSignalCount,
    debugTrail,
    historyBackfilled,
    historyBackfilledAt,
    backgroundConfiguredAt,
  ] = await Promise.all([
    AsyncStorage.getItem(HEALTHKIT_ENABLED_KEY),
    AsyncStorage.getItem(HEALTHKIT_LAST_SYNC_KEY),
    AsyncStorage.getItem(HEALTHKIT_LAST_ERROR_KEY),
    AsyncStorage.getItem(HEALTHKIT_LAST_COUNT_KEY),
    readHealthKitDebugTrail(),
    AsyncStorage.getItem(HEALTHKIT_HISTORY_BACKFILLED_KEY),
    AsyncStorage.getItem(HEALTHKIT_HISTORY_BACKFILLED_AT_KEY),
    AsyncStorage.getItem(HEALTHKIT_BACKGROUND_CONFIGURED_AT_KEY),
  ])

  return {
    available: await isHealthKitAvailable(),
    enabled: enabled === 'true',
    lastSyncAt,
    lastError: lastError || null,
    lastSignalCount: Number(lastSignalCount ?? 0) || 0,
    requestedTypeCount: PRIMARY_READ_TYPES.length,
    debugTrail,
    historyBackfilled: historyBackfilled === 'true',
    historyBackfilledAt,
    backgroundConfiguredAt,
  }
}

export async function requestAllHealthKitPermissions(): Promise<HealthKitPermissionResult> {
  await logHealthKitDebug('permission:start', { requested: PRIMARY_READ_TYPES.length })
  const healthKit = await loadHealthKit()
  if (!healthKit || !(await isHealthKitAvailable(healthKit))) {
    await logHealthKitDebug('permission:unavailable')
    const status = await getHealthKitLocalStatus()
    return {
      ...status,
      granted: false,
      availableTypeCount: 0,
      unavailableTypeCount: PRIMARY_READ_TYPES.length,
      medicationsGranted: false,
    }
  }

  const availableTypes = await availableObjectTypes(healthKit, PRIMARY_READ_TYPES)
  await logHealthKitDebug('permission:available-types', { count: availableTypes.length })
  const granted = await requestReadTypes(healthKit, availableTypes)
  await logHealthKitDebug('permission:request-finished', { granted })
  const medicationsGranted = false
  const enabled = granted || medicationsGranted

  await AsyncStorage.multiSet([
    [HEALTHKIT_ENABLED_KEY, enabled ? 'true' : 'false'],
    [HEALTHKIT_LAST_ERROR_KEY, ''],
  ])

  if (enabled) {
    await configureHealthKitBackgroundDelivery()
  }

  const status = await getHealthKitLocalStatus()

  return {
    ...status,
    enabled,
    granted: enabled,
    availableTypeCount: availableTypes.length,
    unavailableTypeCount: PRIMARY_READ_TYPES.length - availableTypes.length,
    medicationsGranted,
  }
}

export async function collectHealthKitSignals(limit = HEALTHKIT_SAMPLE_LIMIT): Promise<HealthKitSyncResult> {
  const historyBackfilled = (await AsyncStorage.getItem(HEALTHKIT_HISTORY_BACKFILLED_KEY)) === 'true'
  const queryLimit = historyBackfilled ? limit : HEALTHKIT_HISTORY_LIMIT
  const mode = historyBackfilled ? 'incremental' : 'historical-backfill'

  await logHealthKitDebug('collect:start', { limit: queryLimit, mode })
  const healthKit = await loadHealthKit()
  if (!healthKit || !(await isHealthKitAvailable(healthKit))) {
    await logHealthKitDebug('collect:unavailable')
    return { signals: [], syncedAt: null, signalCount: 0, errors: ['HealthKit indisponivel neste runtime.'] }
  }

  const signals: StorePassiveSignalInput[] = []
  const errors: string[] = []
  const availableTypes = await availableObjectTypes(healthKit, PRIMARY_READ_TYPES)
  const readableTypes = await readableObjectTypes(healthKit, availableTypes)
  await logHealthKitDebug('collect:readable-types', {
    available: availableTypes.length,
    readable: readableTypes.length,
  })
  const availableSet = new Set<string>(readableTypes)
  const sleepSamples: SleepSampleForAggregation[] = []

  for (const identifier of PRIMARY_HEALTHKIT_QUANTITY_TYPES) {
    if (!availableSet.has(identifier)) continue
    if (DAILY_STATISTIC_IDENTIFIERS.has(identifier)) continue

    try {
      const anchor = historyBackfilled ? await readAnchor('quantity', identifier) : undefined
      const response = await healthKit.queryQuantitySamplesWithAnchor(identifier, { anchor, limit: queryLimit })
      await writeAnchor('quantity', identifier, response.newAnchor)
      await logHealthKitDebug('collect:quantity', { identifier, count: response.samples.length, mode })
      for (const sample of response.samples) {
        signals.push(quantitySampleToSignal(identifier, sample))
      }
    } catch (error) {
      errors.push(`${identifier}: ${humanError(error)}`)
    }
  }

  for (const identifier of PRIMARY_HEALTHKIT_CATEGORY_TYPES) {
    if (!availableSet.has(identifier)) continue

    try {
      const anchor = historyBackfilled ? await readAnchor('category', identifier) : undefined
      const response = await healthKit.queryCategorySamplesWithAnchor(identifier, { anchor, limit: queryLimit })
      await writeAnchor('category', identifier, response.newAnchor)
      await logHealthKitDebug('collect:category', { identifier, count: response.samples.length, mode })
      for (const sample of response.samples) {
        signals.push(categorySampleToSignal(identifier, sample))
        if (identifier === 'HKCategoryTypeIdentifierSleepAnalysis' && ASLEEP_VALUES.has(Number(sample.value))) {
          sleepSamples.push({
            uuid: sample.uuid,
            startDate: toDate(sample.startDate),
            endDate: toDate(sample.endDate),
            value: Number(sample.value),
          })
        }
      }
    } catch (error) {
      errors.push(`${identifier}: ${humanError(error)}`)
    }
  }

  if (availableSet.has('HKCategoryTypeIdentifierSleepAnalysis')) {
    try {
      const recentSleepSamples = await recentSleepCategorySamples(healthKit)
      await logHealthKitDebug('collect:recent-sleep', { count: recentSleepSamples.length })
      for (const sample of recentSleepSamples) {
        signals.push(categorySampleToSignal('HKCategoryTypeIdentifierSleepAnalysis', sample))
        if (ASLEEP_VALUES.has(Number(sample.value))) {
          sleepSamples.push({
            uuid: sample.uuid,
            startDate: toDate(sample.startDate),
            endDate: toDate(sample.endDate),
            value: Number(sample.value),
          })
        }
      }
    } catch (error) {
      errors.push(`recent_sleep: ${humanError(error)}`)
    }
  }

  signals.push(...sleepDurationSignals(uniqueSleepSamples(sleepSamples)))

  if (availableSet.has(WorkoutTypeIdentifier)) {
    try {
      const anchor = historyBackfilled ? await readAnchor('workout', WorkoutTypeIdentifier) : undefined
      const response = await healthKit.queryWorkoutSamplesWithAnchor({ anchor, limit: queryLimit })
      await writeAnchor('workout', WorkoutTypeIdentifier, response.newAnchor)
      await logHealthKitDebug('collect:workout', { count: response.workouts.length, mode })
      for (const workout of response.workouts) {
        const sample = typeof workout.toJSON === 'function' ? workout.toJSON() : workout
        signals.push(workoutToSignal(sample))
      }
    } catch (error) {
      errors.push(`${WorkoutTypeIdentifier}: ${humanError(error)}`)
    }
  }

  if (availableSet.has(StateOfMindTypeIdentifier)) {
    try {
      const anchor = historyBackfilled ? await readAnchor('state_of_mind', StateOfMindTypeIdentifier) : undefined
      const response = await healthKit.queryStateOfMindSamplesWithAnchor({ anchor, limit: queryLimit })
      await writeAnchor('state_of_mind', StateOfMindTypeIdentifier, response.newAnchor)
      await logHealthKitDebug('collect:state-of-mind', { count: response.samples.length, mode })
      for (const sample of response.samples) {
        signals.push(stateOfMindToSignal(sample))
      }
    } catch (error) {
      errors.push(`${StateOfMindTypeIdentifier}: ${humanError(error)}`)
    }
  }

  signals.push(...await dailyStatisticSignals(
    healthKit,
    availableSet,
    historyBackfilled ? 14 : HEALTHKIT_DAILY_BACKFILL_DAYS,
    errors,
  ))
  signals.push(...await mostRecentQuantitySignals(healthKit, availableSet, errors))
  signals.push(...await characteristicSignals(healthKit, errors))

  const syncedAt = new Date().toISOString()
  await AsyncStorage.multiSet([
    [HEALTHKIT_LAST_SYNC_KEY, syncedAt],
    [HEALTHKIT_LAST_COUNT_KEY, String(signals.length)],
    [HEALTHKIT_LAST_ERROR_KEY, errors[0] ?? ''],
  ])

  if (!historyBackfilled) {
    await AsyncStorage.multiSet([
      [HEALTHKIT_HISTORY_BACKFILLED_KEY, 'true'],
      [HEALTHKIT_HISTORY_BACKFILLED_AT_KEY, syncedAt],
    ])
  }

  await logHealthKitDebug('collect:finished', {
    signals: signals.length,
    errors: errors.length,
    mode,
    historyBackfilled: true,
  })

  return {
    signals: dedupeSignals(signals),
    syncedAt,
    signalCount: signals.length,
    errors,
  }
}

export async function configureHealthKitBackgroundDelivery(): Promise<boolean> {
  await logHealthKitDebug('background:configure-start', { requested: BACKGROUND_SAMPLE_TYPES.length })

  const healthKit = await loadHealthKit()
  if (!healthKit || !(await isHealthKitAvailable(healthKit))) {
    await logHealthKitDebug('background:unavailable')
    return false
  }

  const availableTypes = await availableObjectTypes(healthKit, BACKGROUND_SAMPLE_TYPES)
  const readableTypes = await readableObjectTypes(healthKit, availableTypes)

  if (readableTypes.length === 0) {
    await logHealthKitDebug('background:no-readable-types')
    return false
  }

  try {
    const ok = await healthKit.configureBackgroundTypes(
      readableTypes.map(String),
      healthKit.UpdateFrequency.immediate,
    )

    let enabledCount = 0
    for (const identifier of readableTypes) {
      try {
        if (await healthKit.enableBackgroundDelivery(identifier, healthKit.UpdateFrequency.immediate)) {
          enabledCount += 1
        }
      } catch (error) {
        await logHealthKitDebug('background:enable-type-failed', {
          identifier,
          error: humanError(error),
        })
      }
    }

    await AsyncStorage.setItem(HEALTHKIT_BACKGROUND_CONFIGURED_AT_KEY, new Date().toISOString())
    await logHealthKitDebug('background:configured', {
      readable: readableTypes.length,
      enabled: enabledCount,
      ok,
    })

    return ok
  } catch (error) {
    await logHealthKitDebug('background:configure-failed', { error: humanError(error) })
    return false
  }
}

export async function subscribeToHealthKitChanges(
  onChange: (typeIdentifier: string) => void,
): Promise<() => void> {
  await logHealthKitDebug('subscription:start', { requested: BACKGROUND_SAMPLE_TYPES.length })

  const healthKit = await loadHealthKit()
  if (!healthKit || !(await isHealthKitAvailable(healthKit))) {
    await logHealthKitDebug('subscription:unavailable')
    return () => {}
  }

  const availableTypes = await availableObjectTypes(healthKit, BACKGROUND_SAMPLE_TYPES)
  const readableTypes = await readableObjectTypes(healthKit, availableTypes)
  const subscriptions: Array<{ remove: () => boolean | void }> = []

  for (const identifier of readableTypes) {
    try {
      subscriptions.push(healthKit.subscribeToChanges(identifier as SampleTypeIdentifier, (args) => {
        if (args.errorMessage) {
          void logHealthKitDebug('subscription:error', {
            identifier: args.typeIdentifier,
            error: args.errorMessage,
          })
          return
        }

        void logHealthKitDebug('subscription:change', { identifier: args.typeIdentifier })
        onChange(String(args.typeIdentifier))
      }))
    } catch (error) {
      await logHealthKitDebug('subscription:type-failed', {
        identifier,
        error: humanError(error),
      })
    }
  }

  await logHealthKitDebug('subscription:ready', { active: subscriptions.length })

  return () => {
    for (const subscription of subscriptions) {
      try {
        subscription.remove()
      } catch {
        // Native subscription cleanup must never break React unmount.
      }
    }
  }
}

async function loadHealthKit(): Promise<HealthKitModule | null> {
  if (Platform.OS !== 'ios') return null
  if (Constants.appOwnership === 'expo') return null

  try {
    return await import('@kingstinct/react-native-healthkit')
  } catch {
    return null
  }
}

async function isHealthKitAvailable(healthKit?: HealthKitModule | null): Promise<boolean> {
  const module = healthKit ?? await loadHealthKit()
  if (!module) return false

  try {
    return await module.isHealthDataAvailableAsync()
  } catch {
    return false
  }
}

async function availableObjectTypes(
  healthKit: HealthKitModule,
  types: readonly ObjectTypeIdentifier[],
): Promise<ObjectTypeIdentifier[]> {
  const unique = uniqueTypes(types)

  try {
    const availability = await healthKit.areObjectTypesAvailableAsync([...unique])
    return unique.filter((identifier) => availability[identifier] === true)
  } catch {
    const available: ObjectTypeIdentifier[] = []
    for (const identifier of unique) {
      try {
        if (await healthKit.isObjectTypeAvailableAsync(identifier)) available.push(identifier)
      } catch {
        // Availability differs by iOS version and device. Unsupported identifiers are skipped.
      }
    }
    return available
  }
}

async function readableObjectTypes(
  healthKit: HealthKitModule,
  types: readonly ObjectTypeIdentifier[],
): Promise<ObjectTypeIdentifier[]> {
  const readable: ObjectTypeIdentifier[] = []

  for (const identifier of types) {
    try {
      const status = await healthKit.getRequestStatusForAuthorization({ toRead: [identifier] })
      if (status === AUTH_STATUS_SHOULD_REQUEST) {
        await logHealthKitDebug('collect:skip-not-authorized', { identifier, status })
        continue
      }
      readable.push(identifier)
    } catch (error) {
      await logHealthKitDebug('collect:skip-auth-status-error', {
        identifier,
        error: humanError(error),
      })
    }
  }

  return readable
}

async function requestMedicationsSafely(healthKit: HealthKitModule): Promise<boolean> {
  try {
    return await healthKit.requestMedicationsAuthorization()
  } catch {
    return false
  }
}

async function requestReadTypes(healthKit: HealthKitModule, types: readonly ObjectTypeIdentifier[]): Promise<boolean> {
  if (types.length === 0) return false

  try {
    return await healthKit.requestAuthorization({ toRead: [...types] })
  } catch {
    return false
  }
}

function quantitySampleToSignal(identifier: QuantityTypeIdentifier, sample: HealthKitSample & { quantity: number; unit: string }): StorePassiveSignalInput {
  return {
    client_id: deterministicUuid(`healthkit:quantity:${sample.uuid}`),
    source: 'healthkit',
    signal_type: SIGNAL_ALIASES[identifier] ?? identifier,
    value_numeric: Number(sample.quantity),
    value_text: null,
    unit: sample.unit ?? null,
    started_at: toIso(sample.startDate),
    ended_at: toIso(sample.endDate),
    recorded_timezone: deviceTimezone(),
    metadata: healthKitMetadata('quantity', identifier, sample),
  }
}

function categorySampleToSignal(identifier: CategoryTypeIdentifier, sample: HealthKitSample & { value: unknown }): StorePassiveSignalInput {
  const numericValue = typeof sample.value === 'number' ? sample.value : Number(sample.value)

  return {
    client_id: deterministicUuid(`healthkit:category:${sample.uuid}`),
    source: 'healthkit',
    signal_type: SIGNAL_ALIASES[identifier] ?? identifier,
    value_numeric: Number.isFinite(numericValue) ? numericValue : null,
    value_text: Number.isFinite(numericValue) ? null : String(sample.value),
    unit: null,
    started_at: toIso(sample.startDate),
    ended_at: toIso(sample.endDate),
    recorded_timezone: deviceTimezone(),
    metadata: healthKitMetadata('category', identifier, sample),
  }
}

function correlationSampleToSignal(
  identifier: CorrelationTypeIdentifier,
  sample: HealthKitSample & { objects?: readonly unknown[] },
): StorePassiveSignalInput {
  return {
    client_id: deterministicUuid(`healthkit:correlation:${sample.uuid}`),
    source: 'healthkit',
    signal_type: identifier,
    value_numeric: sample.objects?.length ?? null,
    value_text: null,
    unit: 'objects',
    started_at: toIso(sample.startDate),
    ended_at: toIso(sample.endDate),
    recorded_timezone: deviceTimezone(),
    metadata: healthKitMetadata('correlation', identifier, sample, {
      objects: toPlain(sample.objects),
    }),
  }
}

function workoutToSignal(sample: HealthKitSample & {
  workoutActivityType?: unknown
  duration?: { quantity?: number; unit?: string } | number
  totalEnergyBurned?: unknown
  totalDistance?: unknown
}): StorePassiveSignalInput {
  const duration = typeof sample.duration === 'number'
    ? sample.duration
    : Number(sample.duration?.quantity ?? 0)

  return {
    client_id: deterministicUuid(`healthkit:workout:${sample.uuid}`),
    source: 'healthkit',
    signal_type: 'workout',
    value_numeric: Number.isFinite(duration) ? duration : null,
    value_text: sample.workoutActivityType === undefined ? null : String(sample.workoutActivityType),
    unit: typeof sample.duration === 'object' ? sample.duration?.unit ?? 's' : 's',
    started_at: toIso(sample.startDate),
    ended_at: toIso(sample.endDate),
    recorded_timezone: deviceTimezone(),
    metadata: healthKitMetadata('workout', WorkoutTypeIdentifier, sample, {
      total_energy_burned: toPlain(sample.totalEnergyBurned),
      total_distance: toPlain(sample.totalDistance),
    }),
  }
}

function stateOfMindToSignal(sample: HealthKitSample & {
  valence?: number
  kind?: unknown
  valenceClassification?: unknown
  labels?: readonly unknown[]
  associations?: readonly unknown[]
}): StorePassiveSignalInput {
  return {
    client_id: deterministicUuid(`healthkit:state_of_mind:${sample.uuid}`),
    source: 'healthkit',
    signal_type: 'state_of_mind_valence',
    value_numeric: typeof sample.valence === 'number' ? sample.valence : null,
    value_text: sample.valenceClassification === undefined ? null : String(sample.valenceClassification),
    unit: null,
    started_at: toIso(sample.startDate),
    ended_at: toIso(sample.endDate),
    recorded_timezone: deviceTimezone(),
    metadata: healthKitMetadata('state_of_mind', StateOfMindTypeIdentifier, sample, {
      kind: sample.kind,
      labels: toPlain(sample.labels),
      associations: toPlain(sample.associations),
    }),
  }
}

function heartbeatSeriesToSignal(sample: HealthKitSample & { heartbeats?: readonly unknown[] }): StorePassiveSignalInput {
  return {
    client_id: deterministicUuid(`healthkit:heartbeat_series:${sample.uuid}`),
    source: 'healthkit',
    signal_type: 'heartbeat_series_count',
    value_numeric: sample.heartbeats?.length ?? null,
    value_text: null,
    unit: 'beats',
    started_at: toIso(sample.startDate),
    ended_at: toIso(sample.endDate),
    recorded_timezone: deviceTimezone(),
    metadata: healthKitMetadata('heartbeat_series', HeartbeatSeriesTypeIdentifier, sample, {
      heartbeats: toPlain(sample.heartbeats),
    }),
  }
}

function electrocardiogramToSignal(sample: HealthKitSample & {
  averageHeartRateBpm?: number
  classification?: unknown
  symptomsStatus?: unknown
  samplingFrequencyHz?: number
  numberOfVoltageMeasurements?: number
}): StorePassiveSignalInput {
  return {
    client_id: deterministicUuid(`healthkit:electrocardiogram:${sample.uuid}`),
    source: 'healthkit',
    signal_type: 'electrocardiogram_average_heart_rate_bpm',
    value_numeric: sample.averageHeartRateBpm ?? null,
    value_text: sample.classification === undefined ? null : String(sample.classification),
    unit: 'bpm',
    started_at: toIso(sample.startDate),
    ended_at: toIso(sample.endDate),
    recorded_timezone: deviceTimezone(),
    metadata: healthKitMetadata('electrocardiogram', ElectrocardiogramTypeIdentifier, sample, {
      symptoms_status: sample.symptomsStatus,
      sampling_frequency_hz: sample.samplingFrequencyHz,
      voltage_measurements: sample.numberOfVoltageMeasurements,
    }),
  }
}

async function characteristicSignals(
  healthKit: HealthKitModule,
  errors: string[],
): Promise<StorePassiveSignalInput[]> {
  const signals: StorePassiveSignalInput[] = []
  const now = new Date().toISOString()

  await pushCharacteristic(signals, errors, 'biological_sex', healthKit.getBiologicalSexAsync, now)
  await pushCharacteristic(signals, errors, 'blood_type', healthKit.getBloodTypeAsync, now)
  await pushCharacteristic(signals, errors, 'date_of_birth', healthKit.getDateOfBirthAsync, now)
  await pushCharacteristic(signals, errors, 'fitzpatrick_skin_type', healthKit.getFitzpatrickSkinTypeAsync, now)
  await pushCharacteristic(signals, errors, 'wheelchair_use', healthKit.getWheelchairUseAsync, now)

  return signals
}

async function dailyStatisticSignals(
  healthKit: HealthKitModule,
  availableSet: Set<string>,
  days: number,
  errors: string[],
): Promise<StorePassiveSignalInput[]> {
  const signals: StorePassiveSignalInput[] = []
  const { start, end } = recentLocalDayRange(days)

  for (const definition of DAILY_CUMULATIVE_STATISTICS) {
    if (!availableSet.has(definition.identifier)) continue

    try {
      const statistics = await queryDailyStatistics(healthKit, definition, start, end)
      await logHealthKitDebug('collect:daily-statistic', {
        identifier: definition.identifier,
        count: statistics.length,
        days,
      })

      for (const statistic of statistics) {
        const signal = statisticToDailySignal(definition, statistic)
        if (signal) signals.push(signal)
      }
    } catch (error) {
      errors.push(`${definition.identifier}: ${humanError(error)}`)
    }
  }

  return signals
}

async function queryDailyStatistics(
  healthKit: HealthKitModule,
  definition: DailyStatisticDefinition,
  start: Date,
  end: Date,
): Promise<readonly QueryStatisticsResponse[]> {
  const queryOptions = {
    unit: definition.unit,
    filter: {
      date: {
        startDate: start,
        endDate: end,
        strictStartDate: true,
        strictEndDate: true,
      },
    },
  }

  try {
    return await healthKit.queryStatisticsCollectionForQuantity(
      definition.identifier,
      ['cumulativeSum'],
      start,
      { day: 1 },
      queryOptions,
    )
  } catch (error) {
    await logHealthKitDebug('collect:daily-statistic-collection-fallback', {
      identifier: definition.identifier,
      error: humanError(error),
    })

    const statistics: QueryStatisticsResponse[] = []
    for (let day = new Date(start); day < end; day.setDate(day.getDate() + 1)) {
      const dayStart = new Date(day)
      const dayEnd = new Date(day)
      dayEnd.setDate(dayStart.getDate() + 1)

      const statistic = await healthKit.queryStatisticsForQuantity(
        definition.identifier,
        ['cumulativeSum'],
        {
          unit: definition.unit,
          filter: {
            date: {
              startDate: dayStart,
              endDate: dayEnd,
              strictStartDate: true,
              strictEndDate: true,
            },
          },
        },
      )
      statistics.push({
        ...statistic,
        startDate: statistic.startDate ?? dayStart,
        endDate: statistic.endDate ?? dayEnd,
      })
    }
    return statistics
  }
}

function statisticToDailySignal(
  definition: DailyStatisticDefinition,
  statistic: QueryStatisticsResponse,
): StorePassiveSignalInput | null {
  const quantity = statistic.sumQuantity
  if (!quantity || !Number.isFinite(quantity.quantity)) return null

  const startedAt = toDate(statistic.startDate)
  const endedAt = toDate(statistic.endDate)
  const dateKey = localDateKey(startedAt)

  return {
    client_id: deterministicUuid(`healthkit:daily-statistic:${definition.signalType}:${dateKey}`),
    source: 'healthkit',
    signal_type: definition.signalType,
    value_numeric: Number(quantity.quantity),
    value_text: null,
    unit: quantity.unit ?? definition.unit,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    recorded_timezone: deviceTimezone(),
    metadata: {
      healthkit: {
        kind: 'daily_statistic',
        type: definition.signalType,
        source_type: definition.identifier,
        statistic: 'cumulativeSum',
        date_key: dateKey,
        sources: toPlain(statistic.sources),
      },
    },
  }
}

async function mostRecentQuantitySignals(
  healthKit: HealthKitModule,
  availableSet: Set<string>,
  errors: string[],
): Promise<StorePassiveSignalInput[]> {
  const signals: StorePassiveSignalInput[] = []

  for (const identifier of MOST_RECENT_QUANTITY_TYPES) {
    if (!availableSet.has(identifier)) continue

    try {
      const samples = await healthKit.queryQuantitySamples(identifier, {
        limit: 1,
        ascending: false,
      })
      await logHealthKitDebug('collect:most-recent-quantity', {
        identifier,
        count: samples.length,
      })
      const sample = samples[0]
      if (sample) signals.push(quantitySampleToSignal(identifier, sample))
    } catch (error) {
      errors.push(`${identifier}: ${humanError(error)}`)
    }
  }

  return signals
}

async function recentSleepCategorySamples(
  healthKit: HealthKitModule,
): Promise<readonly (HealthKitSample & { value: unknown })[]> {
  const { start, end } = recentLocalDayRange(HEALTHKIT_SLEEP_REFRESH_DAYS)
  return healthKit.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
    limit: 0,
    ascending: false,
    filter: {
      date: {
        startDate: start,
        endDate: end,
        strictStartDate: false,
        strictEndDate: true,
      },
    },
  })
}

async function pushCharacteristic(
  signals: StorePassiveSignalInput[],
  errors: string[],
  signalType: string,
  read: () => Promise<unknown>,
  now: string,
): Promise<void> {
  try {
    const value = await read()
    if (value === undefined || value === null) return

    signals.push({
      client_id: deterministicUuid(`healthkit:characteristic:${signalType}`),
      source: 'healthkit',
      signal_type: signalType,
      value_numeric: typeof value === 'number' ? value : null,
      value_text: typeof value === 'number' ? null : value instanceof Date ? value.toISOString() : String(value),
      unit: null,
      started_at: now,
      ended_at: null,
      recorded_timezone: deviceTimezone(),
      metadata: { healthkit: { kind: 'characteristic', type: signalType } },
    })
  } catch (error) {
    errors.push(`${signalType}: ${humanError(error)}`)
  }
}

async function medicationSignals(
  healthKit: HealthKitModule,
  limit: number,
  errors: string[],
): Promise<StorePassiveSignalInput[]> {
  const signals: StorePassiveSignalInput[] = []

  try {
    const medications = await healthKit.queryMedications()
    const now = new Date().toISOString()
    for (const medication of medications) {
      const plain = toPlain(medication)
      const id = stableMedicationId(plain)
      signals.push({
        client_id: deterministicUuid(`healthkit:medication:${id}`),
        source: 'healthkit',
        signal_type: 'medication',
        value_numeric: null,
        value_text: medicationText(plain),
        unit: null,
        started_at: now,
        ended_at: null,
        recorded_timezone: deviceTimezone(),
        metadata: { healthkit: { kind: 'medication', raw: plain } },
      })
    }
  } catch (error) {
    errors.push(`medications: ${humanError(error)}`)
  }

  try {
    const anchor = await readAnchor('medication_event', 'HKMedicationDoseEvent')
    const response = await healthKit.queryMedicationEventsWithAnchor({ anchor, limit })
    await writeAnchor('medication_event', 'HKMedicationDoseEvent', response.newAnchor)
    for (const sample of response.samples) {
      signals.push({
        client_id: deterministicUuid(`healthkit:medication_event:${sample.uuid}`),
        source: 'healthkit',
        signal_type: 'medication_event',
        value_numeric: null,
        value_text: 'medication_event',
        unit: null,
        started_at: toIso(sample.startDate),
        ended_at: toIso(sample.endDate),
        recorded_timezone: deviceTimezone(),
        metadata: healthKitMetadata('medication_event', 'HKMedicationDoseEvent', sample),
      })
    }
  } catch (error) {
    errors.push(`medication_events: ${humanError(error)}`)
  }

  return signals
}

function sleepDurationSignals(samples: SleepSampleForAggregation[]): StorePassiveSignalInput[] {
  const buckets = new Map<string, SleepSampleForAggregation[]>()
  for (const sample of samples) {
    const key = localDateKey(sample.endDate)
    buckets.set(key, [...(buckets.get(key) ?? []), sample])
  }

  return [...buckets.entries()].map(([dateKey, bucket]) => {
    const startedAt = new Date(Math.min(...bucket.map((sample) => sample.startDate.getTime())))
    const endedAt = new Date(Math.max(...bucket.map((sample) => sample.endDate.getTime())))
    const hours = bucket.reduce((total, sample) => (
      total + Math.max(0, sample.endDate.getTime() - sample.startDate.getTime()) / 3600000
    ), 0)
    const uuidList = bucket.map((sample) => sample.uuid).sort()

    return {
      client_id: deterministicUuid(`healthkit:sleep_duration:${dateKey}:${uuidList.join(',')}`),
      source: 'healthkit',
      signal_type: 'sleep_duration_hours',
      value_numeric: Number(hours.toFixed(2)),
      value_text: null,
      unit: 'h',
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      recorded_timezone: deviceTimezone(),
      metadata: {
        healthkit: {
          kind: 'derived',
          type: 'sleep_duration_hours',
          source_type: 'HKCategoryTypeIdentifierSleepAnalysis',
          sample_uuids: uuidList,
        },
      },
    }
  })
}

function uniqueSleepSamples(samples: SleepSampleForAggregation[]): SleepSampleForAggregation[] {
  const byUuid = new Map<string, SleepSampleForAggregation>()
  for (const sample of samples) {
    byUuid.set(sample.uuid, sample)
  }
  return [...byUuid.values()]
}

function healthKitMetadata(
  kind: string,
  type: string,
  sample: HealthKitSample,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    healthkit: {
      kind,
      type,
      uuid: sample.uuid,
      source_revision: toPlain(sample.sourceRevision),
      device: toPlain(sample.device),
      metadata: toPlain(sample.metadata),
      sample_type: toPlain(sample.sampleType),
      ...extra,
    },
  }
}

function dedupeSignals(signals: StorePassiveSignalInput[]): StorePassiveSignalInput[] {
  const byClientId = new Map<string, StorePassiveSignalInput>()
  for (const signal of signals) {
    byClientId.set(signal.client_id, signal)
  }
  return [...byClientId.values()]
}

function stableMedicationId(value: unknown): string {
  if (!value || typeof value !== 'object') return JSON.stringify(value)
  const candidate = value as Record<string, unknown>
  return String(candidate.uuid ?? candidate.id ?? candidate.identifier ?? JSON.stringify(candidate))
}

function medicationText(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const root = value as Record<string, unknown>
  const medication = root.medication && typeof root.medication === 'object'
    ? root.medication as Record<string, unknown>
    : root
  return String(medication.displayName ?? medication.name ?? medication.preferredName ?? 'medication')
}

async function readAnchor(kind: string, identifier: string): Promise<string | undefined> {
  return (await AsyncStorage.getItem(anchorKey(kind, identifier))) ?? undefined
}

async function writeAnchor(kind: string, identifier: string, anchor: string | null | undefined): Promise<void> {
  if (!anchor) return
  await AsyncStorage.setItem(anchorKey(kind, identifier), anchor)
}

function anchorKey(kind: string, identifier: string): string {
  return `${HEALTHKIT_ANCHOR_PREFIX}.${kind}.${identifier}`
}

function uniqueTypes<T extends string>(types: readonly T[]): T[] {
  return [...new Set(types)]
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

async function readHealthKitDebugTrail(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(HEALTHKIT_DEBUG_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}

async function logHealthKitDebug(step: string, metadata: Record<string, unknown> = {}): Promise<void> {
  const payload = Object.keys(metadata).length > 0 ? ` ${safeJson(metadata)}` : ''
  const line = `${new Date().toISOString()} ${step}${payload}`

  console.info(`[Atlas HealthKit] ${line}`)

  try {
    const trail = await readHealthKitDebugTrail()
    await AsyncStorage.setItem(HEALTHKIT_DEBUG_KEY, JSON.stringify([...trail, line].slice(-80)))
  } catch {
    // Debug logging must never affect HealthKit reads.
  }
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function toIso(value: Date | string | number | undefined): string {
  return toDate(value).toISOString()
}

function toDate(value: Date | string | number | undefined): Date {
  if (value instanceof Date) return value
  if (value !== undefined) {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

function toPlain(value: unknown): unknown {
  if (value === undefined) return undefined
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

function recentLocalDayRange(days: number): { start: Date; end: Date } {
  const end = startOfLocalDay(new Date())
  end.setDate(end.getDate() + 1)

  const start = new Date(end)
  start.setDate(start.getDate() - Math.max(1, days))

  return { start, end }
}

function startOfLocalDay(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

function localDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: deviceTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}

function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

function deterministicUuid(input: string): string {
  const [a, b, c, d] = cyrb128(input)
  const hex = [a, b, c, d].map((part) => part.toString(16).padStart(8, '0')).join('')
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-')
}

function cyrb128(input: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762

  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i)
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

function humanError(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'falha desconhecida'
}

interface HealthKitSample {
  uuid: string
  startDate?: Date | string | number
  endDate?: Date | string | number
  sourceRevision?: unknown
  device?: unknown
  metadata?: unknown
  sampleType?: unknown
}

interface SleepSampleForAggregation {
  uuid: string
  startDate: Date
  endDate: Date
  value: number
}
