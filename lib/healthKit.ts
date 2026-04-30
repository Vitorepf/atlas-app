import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import type {
  CategoryTypeIdentifier,
  CorrelationTypeIdentifier,
  DeletedSample,
  FilterForSamples,
  ObjectTypeIdentifier,
  QuantityTypeIdentifier,
  QueryOptionsWithAnchorAndUnit,
  QueryOptionsWithSortOrderAndUnit,
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
const HEALTHKIT_BACKFILL_SAMPLE_LIMIT = 1500
const HEALTHKIT_SAMPLE_BACKFILL_DAYS = 60
const HEALTHKIT_DAILY_BACKFILL_DAYS = 60
const HEALTHKIT_DAILY_REFRESH_DAYS = 14
const HEALTHKIT_SLEEP_REFRESH_DAYS = 14
const HEALTHKIT_SLEEP_SAMPLE_LIMIT = 1200
const HEALTHKIT_WORKOUT_REFRESH_DAYS = 14
const HEALTHKIT_WORKOUT_SAMPLE_LIMIT = 300
const HEALTHKIT_WORKOUT_HEART_RATE_SAMPLE_LIMIT = 2500
const HEALTHKIT_WAKING_HEART_RATE_SAMPLE_LIMIT = 12000
const HEALTHKIT_WAKING_HEART_RATE_REFRESH_DAYS = 14
const HEALTHKIT_SLEEP_HEART_RATE_SAMPLE_LIMIT = 4000
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
  'HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances',
  'HKQuantityTypeIdentifierAppleSleepingWristTemperature',
  'HKQuantityTypeIdentifierAppleStandTime',
  'HKQuantityTypeIdentifierBasalEnergyBurned',
  'HKQuantityTypeIdentifierBodyFatPercentage',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierBodyMassIndex',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierEstimatedWorkoutEffortScore',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierHeight',
  'HKQuantityTypeIdentifierLeanBodyMass',
  'HKQuantityTypeIdentifierOxygenSaturation',
  'HKQuantityTypeIdentifierRespiratoryRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierVO2Max',
  'HKQuantityTypeIdentifierWaistCircumference',
  'HKQuantityTypeIdentifierWorkoutEffortScore',
] as const satisfies readonly QuantityTypeIdentifier[]

const PRIMARY_HEALTHKIT_CATEGORY_TYPES = [
  'HKCategoryTypeIdentifierMindfulSession',
  'HKCategoryTypeIdentifierSleepAnalysis',
] as const satisfies readonly CategoryTypeIdentifier[]

const PRIMARY_HEALTHKIT_SPECIAL_TYPES = [
  StateOfMindTypeIdentifier,
  WorkoutTypeIdentifier,
] as const satisfies readonly ObjectTypeIdentifier[]

const WORKOUT_HEART_RATE_QUANTITY_TYPES = [
  'HKQuantityTypeIdentifierHeartRate',
] as const satisfies readonly QuantityTypeIdentifier[]

const PRIMARY_READ_TYPES = uniqueTypes([
  ...CHARACTERISTIC_TYPES,
  ...PRIMARY_HEALTHKIT_QUANTITY_TYPES,
  ...WORKOUT_HEART_RATE_QUANTITY_TYPES,
  ...PRIMARY_HEALTHKIT_CATEGORY_TYPES,
  ...PRIMARY_HEALTHKIT_SPECIAL_TYPES,
])

const BACKGROUND_SAMPLE_TYPES = uniqueTypes([
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances',
  'HKQuantityTypeIdentifierAppleSleepingWristTemperature',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
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
  HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances: 'sleep_breathing_disturbances',
  HKQuantityTypeIdentifierAppleStandTime: 'stand_minutes',
  HKQuantityTypeIdentifierBasalEnergyBurned: 'basal_energy_kcal',
  HKQuantityTypeIdentifierBodyFatPercentage: 'body_fat_percentage',
  HKQuantityTypeIdentifierBodyMass: 'body_mass',
  HKQuantityTypeIdentifierBodyMassIndex: 'body_mass_index',
  HKQuantityTypeIdentifierDistanceWalkingRunning: 'walking_running_distance',
  HKQuantityTypeIdentifierEstimatedWorkoutEffortScore: 'estimated_workout_effort_score',
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
  HKQuantityTypeIdentifierWorkoutEffortScore: 'workout_effort_score',
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

const WORKOUT_HEART_RATE_AGGREGATE_SIGNAL_TYPES = [
  'workout_hr_avg_bpm',
  'workout_hr_max_bpm',
  'workout_cardio_load',
  'workout_cardio_strain',
  'workout_hr_zone_1_min',
  'workout_hr_zone_2_min',
  'workout_hr_zone_3_min',
  'workout_hr_zone_4_min',
  'workout_hr_zone_5_min',
] as const

const WAKING_HEART_RATE_AGGREGATE_SIGNAL_TYPES = [
  'waking_hr_avg_bpm',
  'waking_hr_max_bpm',
  'waking_cardio_load',
  'waking_cardio_strain',
  'waking_hr_zone_1_min',
  'waking_hr_zone_2_min',
  'waking_hr_zone_3_min',
  'waking_hr_zone_4_min',
  'waking_hr_zone_5_min',
  'waking_hr_sample_count',
] as const

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

const NORMALIZED_QUANTITY_UNITS: Partial<Record<QuantityTypeIdentifier, string>> = {
  HKQuantityTypeIdentifierActiveEnergyBurned: 'kcal',
  HKQuantityTypeIdentifierAppleExerciseTime: 'min',
  HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances: 'count',
  HKQuantityTypeIdentifierAppleSleepingWristTemperature: 'degC',
  HKQuantityTypeIdentifierAppleStandTime: 'min',
  HKQuantityTypeIdentifierBasalEnergyBurned: 'kcal',
  HKQuantityTypeIdentifierBodyFatPercentage: '%',
  HKQuantityTypeIdentifierBodyMass: 'kg',
  HKQuantityTypeIdentifierBodyMassIndex: 'count',
  HKQuantityTypeIdentifierDistanceWalkingRunning: 'm',
  HKQuantityTypeIdentifierEstimatedWorkoutEffortScore: 'count',
  HKQuantityTypeIdentifierHeartRate: 'count/min',
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: 'ms',
  HKQuantityTypeIdentifierHeight: 'm',
  HKQuantityTypeIdentifierLeanBodyMass: 'kg',
  HKQuantityTypeIdentifierOxygenSaturation: '%',
  HKQuantityTypeIdentifierRespiratoryRate: 'count/min',
  HKQuantityTypeIdentifierRestingHeartRate: 'count/min',
  HKQuantityTypeIdentifierStepCount: 'count',
  HKQuantityTypeIdentifierVO2Max: 'ml/(kg*min)',
  HKQuantityTypeIdentifierWaistCircumference: 'cm',
  HKQuantityTypeIdentifierWorkoutEffortScore: 'count',
}

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
  // HealthKit does not expose per-type read grants; this means the OS processed the request.
  granted: boolean
  authorizationRequestProcessed: boolean
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
      authorizationRequestProcessed: false,
      availableTypeCount: 0,
      unavailableTypeCount: PRIMARY_READ_TYPES.length,
      medicationsGranted: false,
    }
  }

  const availableTypes = await availableObjectTypes(healthKit, PRIMARY_READ_TYPES)
  await logHealthKitDebug('permission:available-types', { count: availableTypes.length })
  const requestProcessed = await requestReadTypes(healthKit, availableTypes)
  await logHealthKitDebug('permission:request-finished', { requestProcessed })
  const medicationsGranted = false
  const enabled = requestProcessed || medicationsGranted

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
    granted: requestProcessed,
    authorizationRequestProcessed: requestProcessed,
    availableTypeCount: availableTypes.length,
    unavailableTypeCount: PRIMARY_READ_TYPES.length - availableTypes.length,
    medicationsGranted,
  }
}

export async function collectHealthKitSignals(limit = HEALTHKIT_SAMPLE_LIMIT): Promise<HealthKitSyncResult> {
  const historyBackfilled = (await AsyncStorage.getItem(HEALTHKIT_HISTORY_BACKFILLED_KEY)) === 'true'
  const queryLimit = historyBackfilled ? limit : HEALTHKIT_BACKFILL_SAMPLE_LIMIT
  const mode = historyBackfilled ? 'incremental' : 'historical-backfill'
  const backfillFilter = historyBackfilled ? undefined : recentSampleFilter(HEALTHKIT_SAMPLE_BACKFILL_DAYS)

  await logHealthKitDebug('collect:start', { limit: queryLimit, mode, backfillDays: historyBackfilled ? null : HEALTHKIT_SAMPLE_BACKFILL_DAYS })
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
  const workoutsForHeartRate: WorkoutSampleForAggregation[] = []

  for (const identifier of PRIMARY_HEALTHKIT_QUANTITY_TYPES) {
    if (!availableSet.has(identifier)) continue
    if (DAILY_STATISTIC_IDENTIFIERS.has(identifier)) continue

    try {
      const anchor = historyBackfilled ? await readAnchor('quantity', identifier) : undefined
      const response = await healthKit.queryQuantitySamplesWithAnchor(
        identifier,
        quantityAnchorOptions(identifier, anchor, queryLimit, backfillFilter),
      )
      await writeAnchor('quantity', identifier, response.newAnchor)
      signals.push(...deletedSamplesToSignals('quantity', identifier, response.deletedSamples))
      await logHealthKitDebug('collect:quantity', {
        identifier,
        count: response.samples.length,
        deleted: response.deletedSamples.length,
        mode,
      })
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
      const response = await healthKit.queryCategorySamplesWithAnchor(identifier, {
        anchor,
        limit: queryLimit,
        ...(backfillFilter ? { filter: backfillFilter } : {}),
      })
      await writeAnchor('category', identifier, response.newAnchor)
      signals.push(...deletedSamplesToSignals('category', identifier, response.deletedSamples))
      await logHealthKitDebug('collect:category', {
        identifier,
        count: response.samples.length,
        deleted: response.deletedSamples.length,
        mode,
      })
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
      const sleepRefreshDays = historyBackfilled ? HEALTHKIT_SLEEP_REFRESH_DAYS : HEALTHKIT_DAILY_BACKFILL_DAYS
      const recentSleepSamples = await recentSleepCategorySamples(healthKit, sleepRefreshDays)
      await logHealthKitDebug('collect:recent-sleep', { count: recentSleepSamples.length, days: sleepRefreshDays })
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

  const sleepSamplesForAggregation = uniqueSleepSamples(sleepSamples)
  signals.push(...sleepDurationSignals(sleepSamplesForAggregation))

  if (availableSet.has('HKQuantityTypeIdentifierHeartRate')) {
    signals.push(...await sleepHeartRateAggregateSignals(
      healthKit,
      sleepSamplesForAggregation,
      errors,
    ))
  }

  if (availableSet.has(WorkoutTypeIdentifier)) {
    try {
      const anchor = historyBackfilled ? await readAnchor('workout', WorkoutTypeIdentifier) : undefined
      const response = await healthKit.queryWorkoutSamplesWithAnchor({
        anchor,
        limit: queryLimit,
        ...(backfillFilter ? { filter: backfillFilter } : {}),
      })
      await writeAnchor('workout', WorkoutTypeIdentifier, response.newAnchor)
      signals.push(...deletedSamplesToSignals('workout', WorkoutTypeIdentifier, response.deletedSamples))
      signals.push(...deletedWorkoutAggregateSignals(response.deletedSamples))
      await logHealthKitDebug('collect:workout', {
        count: response.workouts.length,
        deleted: response.deletedSamples.length,
        mode,
      })
      for (const workout of response.workouts) {
        const sample = typeof workout.toJSON === 'function' ? workout.toJSON() : workout
        signals.push(workoutToSignal(sample))
        const aggregateSample = workoutSampleForAggregation(sample)
        if (aggregateSample) workoutsForHeartRate.push(aggregateSample)
      }
    } catch (error) {
      errors.push(`${WorkoutTypeIdentifier}: ${humanError(error)}`)
    }
  }

  const workoutsForAggregation = uniqueWorkoutSamples(workoutsForHeartRate)

  if (availableSet.has('HKQuantityTypeIdentifierHeartRate')) {
    const workoutRefreshDays = historyBackfilled ? HEALTHKIT_WORKOUT_REFRESH_DAYS : HEALTHKIT_DAILY_BACKFILL_DAYS
    let workoutsForHeartRateAggregates = workoutsForAggregation

    if (availableSet.has(WorkoutTypeIdentifier)) {
      try {
        const recentWorkouts = await recentWorkoutSamples(healthKit, workoutRefreshDays)
        workoutsForHeartRate.push(...recentWorkouts)
        workoutsForHeartRateAggregates = uniqueWorkoutSamples(workoutsForHeartRate)
        await logHealthKitDebug('collect:recent-workouts-for-hr', { count: recentWorkouts.length, days: workoutRefreshDays })
      } catch (error) {
        errors.push(`recent_workouts_for_hr: ${humanError(error)}`)
      }
    }

    const heartRateProfile = await personalHeartRateProfile(healthKit)

    if (availableSet.has(WorkoutTypeIdentifier)) {
      signals.push(...await workoutHeartRateAggregateSignals(
        healthKit,
        workoutsForHeartRateAggregates,
        heartRateProfile,
        errors,
      ))
    }

    signals.push(...await wakingHeartRateAggregateSignals(
      healthKit,
      historyBackfilled ? HEALTHKIT_WAKING_HEART_RATE_REFRESH_DAYS : HEALTHKIT_DAILY_BACKFILL_DAYS,
      sleepSamplesForAggregation,
      workoutsForHeartRateAggregates,
      heartRateProfile,
      errors,
    ))
  }

  if (availableSet.has(StateOfMindTypeIdentifier)) {
    try {
      const anchor = historyBackfilled ? await readAnchor('state_of_mind', StateOfMindTypeIdentifier) : undefined
      const response = await healthKit.queryStateOfMindSamplesWithAnchor({
        anchor,
        limit: queryLimit,
        ...(backfillFilter ? { filter: backfillFilter } : {}),
      })
      await writeAnchor('state_of_mind', StateOfMindTypeIdentifier, response.newAnchor)
      signals.push(...deletedSamplesToSignals('state_of_mind', StateOfMindTypeIdentifier, response.deletedSamples))
      await logHealthKitDebug('collect:state-of-mind', {
        count: response.samples.length,
        deleted: response.deletedSamples.length,
        mode,
      })
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
    historyBackfilled ? HEALTHKIT_DAILY_REFRESH_DAYS : HEALTHKIT_DAILY_BACKFILL_DAYS,
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

function quantityAnchorOptions(
  identifier: QuantityTypeIdentifier,
  anchor: string | undefined,
  limit: number,
  filter?: FilterForSamples,
): QueryOptionsWithAnchorAndUnit {
  const unit = NORMALIZED_QUANTITY_UNITS[identifier]

  return {
    anchor,
    limit,
    ...(filter ? { filter } : {}),
    ...(unit ? { unit } : {}),
  }
}

function quantityLatestOptions(
  identifier: QuantityTypeIdentifier,
): QueryOptionsWithSortOrderAndUnit {
  const unit = NORMALIZED_QUANTITY_UNITS[identifier]

  return {
    limit: 1,
    ascending: false,
    ...(unit ? { unit } : {}),
  }
}

function recentSampleFilter(days: number): FilterForSamples {
  const { start, end } = recentLocalDayRange(days)

  return {
    date: {
      startDate: start,
      endDate: end,
      strictStartDate: false,
      strictEndDate: true,
    },
  }
}

function deletedSamplesToSignals(
  kind: 'quantity' | 'category' | 'workout' | 'state_of_mind',
  identifier: string,
  deletedSamples: readonly DeletedSample[],
): StorePassiveSignalInput[] {
  return deletedSamples.map((sample) => deletedSampleToSignal(kind, identifier, sample))
}

function deletedSampleToSignal(
  kind: 'quantity' | 'category' | 'workout' | 'state_of_mind',
  identifier: string,
  sample: DeletedSample,
): StorePassiveSignalInput {
  const deletedAt = new Date().toISOString()
  const signalType = kind === 'workout'
    ? 'workout'
    : kind === 'state_of_mind'
      ? 'state_of_mind_valence'
      : SIGNAL_ALIASES[identifier] ?? identifier

  return {
    client_id: deterministicUuid(`healthkit:${kind}:${sample.uuid}`),
    source: 'healthkit',
    signal_type: signalType,
    value_numeric: null,
    value_text: null,
    unit: null,
    started_at: deletedAt,
    ended_at: null,
    recorded_timezone: deviceTimezone(),
    deleted_at: deletedAt,
    metadata: {
      healthkit: {
        kind: 'deleted_sample',
        original_kind: kind,
        type: identifier,
        uuid: sample.uuid,
        metadata: toPlain(sample.metadata),
      },
    },
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

function workoutSampleForAggregation(sample: HealthKitSample & {
  workoutActivityType?: unknown
  duration?: { quantity?: number; unit?: string } | number
}): WorkoutSampleForAggregation | null {
  if (!sample.uuid) return null
  const startDate = toDate(sample.startDate)
  const endDate = toDate(sample.endDate)
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime()) || endDate <= startDate) return null

  const durationSeconds = typeof sample.duration === 'number'
    ? sample.duration
    : Number(sample.duration?.quantity ?? (endDate.getTime() - startDate.getTime()) / 1000)

  return {
    uuid: sample.uuid,
    startDate,
    endDate,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : (endDate.getTime() - startDate.getTime()) / 1000,
    activityType: sample.workoutActivityType === undefined ? null : String(sample.workoutActivityType),
  }
}

async function recentWorkoutSamples(
  healthKit: HealthKitModule,
  days: number,
): Promise<WorkoutSampleForAggregation[]> {
  const { start, end } = recentLocalDayRange(days)
  const workouts = await healthKit.queryWorkoutSamples({
    limit: HEALTHKIT_WORKOUT_SAMPLE_LIMIT,
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

  return workouts
    .map((workout) => workoutSampleForAggregation(typeof workout.toJSON === 'function' ? workout.toJSON() : workout))
    .filter((workout): workout is WorkoutSampleForAggregation => workout !== null)
}

function uniqueWorkoutSamples(samples: WorkoutSampleForAggregation[]): WorkoutSampleForAggregation[] {
  const byUuid = new Map<string, WorkoutSampleForAggregation>()
  for (const sample of samples) {
    byUuid.set(sample.uuid, sample)
  }
  return [...byUuid.values()]
}

async function workoutHeartRateAggregateSignals(
  healthKit: HealthKitModule,
  workouts: WorkoutSampleForAggregation[],
  profile: HeartRateProfile,
  errors: string[],
): Promise<StorePassiveSignalInput[]> {
  if (workouts.length === 0) return []

  const signals: StorePassiveSignalInput[] = []

  for (const workout of workouts) {
    try {
      const samples = await healthKit.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
        limit: HEALTHKIT_WORKOUT_HEART_RATE_SAMPLE_LIMIT,
        ascending: true,
        unit: 'count/min',
        filter: {
          date: {
            startDate: workout.startDate,
            endDate: workout.endDate,
            strictStartDate: true,
            strictEndDate: true,
          },
        },
      })
      const aggregate = workoutHeartRateAggregate(workout, samples, profile)
      if (aggregate) signals.push(...workoutHeartRateAggregateToSignals(workout, aggregate))
    } catch (error) {
      errors.push(`workout_heart_rate:${workout.uuid}: ${humanError(error)}`)
    }
  }

  await logHealthKitDebug('collect:workout-heart-rate-aggregates', {
    workouts: workouts.length,
    signals: signals.length,
    maxHeartRate: profile.maxHeartRate,
    restingHeartRate: profile.restingHeartRate,
    maxHeartRateSource: profile.source,
  })

  return signals
}

function workoutHeartRateAggregate(
  workout: WorkoutSampleForAggregation,
  samples: readonly (HealthKitSample & { quantity: number; unit?: string })[],
  profile: HeartRateProfile,
): WorkoutHeartRateAggregate | null {
  const heartRates = samples
    .map((sample) => ({
      bpm: Number(sample.quantity),
      start: toDate(sample.startDate).getTime(),
      end: toDate(sample.endDate).getTime(),
    }))
    .filter((sample) => Number.isFinite(sample.bpm) && sample.bpm >= 35 && sample.bpm <= 230 && Number.isFinite(sample.start))
    .sort((a, b) => a.start - b.start)

  if (heartRates.length < 3) return null

  const observedMax = Math.max(...heartRates.map((sample) => sample.bpm))
  const effectiveProfile = effectiveHeartRateProfile(profile, observedMax)
  const zones = [0, 0, 0, 0, 0]
  let weightedHeartRate = 0
  let weightedSeconds = 0
  let maxObserved = 0
  const workoutEnd = workout.endDate.getTime()

  for (let index = 0; index < heartRates.length; index += 1) {
    const sample = heartRates[index]
    const next = heartRates[index + 1]
    const nativeDuration = sample.end > sample.start ? sample.end - sample.start : 0
    const inferredDuration = next ? Math.max(0, next.start - sample.start) : 30000
    const durationMs = Math.min(Math.max(nativeDuration, inferredDuration), 180000, Math.max(0, workoutEnd - sample.start))
    if (durationMs <= 0) continue

    const seconds = durationMs / 1000
    const zone = heartRateZone(sample.bpm, effectiveProfile)
    if (zone >= 1) zones[zone - 1] += seconds / 60
    weightedHeartRate += sample.bpm * seconds
    weightedSeconds += seconds
    maxObserved = Math.max(maxObserved, sample.bpm)
  }

  if (weightedSeconds <= 0) return null

  const zoneLoad = zones.reduce((sum, minutes, index) => sum + minutes * (index + 1), 0)
  const durationMinutes = Math.max(workout.durationSeconds / 60, weightedSeconds / 60)
  const density = durationMinutes > 0 ? zoneLoad / durationMinutes : 0
  const cardioLoad = zoneLoad
  const strain = clampNumber(100 * (1 - Math.exp(-cardioLoad / 150)) + Math.max(0, density - 2.2) * 4, 0, 100)

  return {
    averageBpm: weightedHeartRate / weightedSeconds,
    maxBpm: maxObserved,
    maxHeartRate: effectiveProfile.maxHeartRate,
    restingHeartRate: effectiveProfile.restingHeartRate,
    maxHeartRateSource: effectiveProfile.source,
    zoneMinutes: zones,
    cardioLoad,
    strain,
    sampleCount: heartRates.length,
    durationMinutes,
  }
}

function workoutHeartRateAggregateToSignals(
  workout: WorkoutSampleForAggregation,
  aggregate: WorkoutHeartRateAggregate,
): StorePassiveSignalInput[] {
  const baseMetadata = {
    healthkit: {
      kind: 'workout_heart_rate_aggregate',
      workout_uuid: workout.uuid,
      workout_activity_type: workout.activityType,
      max_heart_rate_estimate: aggregate.maxHeartRate,
      resting_heart_rate_bpm: aggregate.restingHeartRate,
      max_heart_rate_source: aggregate.maxHeartRateSource,
      heart_rate_sample_count: aggregate.sampleCount,
      duration_minutes: aggregate.durationMinutes,
    },
  }
  const definitions: Array<{ type: string; value: number; unit: string }> = [
    { type: 'workout_hr_avg_bpm', value: aggregate.averageBpm, unit: 'bpm' },
    { type: 'workout_hr_max_bpm', value: aggregate.maxBpm, unit: 'bpm' },
    { type: 'workout_cardio_load', value: aggregate.cardioLoad, unit: 'a.u.' },
    { type: 'workout_cardio_strain', value: aggregate.strain, unit: '%' },
    ...aggregate.zoneMinutes.map((minutes, index) => ({
      type: `workout_hr_zone_${index + 1}_min`,
      value: minutes,
      unit: 'min',
    })),
  ]

  return definitions.map((definition) => ({
    client_id: deterministicUuid(`healthkit:workout-heart-rate:${workout.uuid}:${definition.type}`),
    source: 'healthkit',
    signal_type: definition.type,
    value_numeric: Number(definition.value.toFixed(3)),
    value_text: workout.activityType,
    unit: definition.unit,
    started_at: workout.startDate.toISOString(),
    ended_at: workout.endDate.toISOString(),
    recorded_timezone: deviceTimezone(),
    metadata: baseMetadata,
  }))
}

async function sleepHeartRateAggregateSignals(
  healthKit: HealthKitModule,
  sleepSamples: SleepSampleForAggregation[],
  errors: string[],
): Promise<StorePassiveSignalInput[]> {
  const windows = sleepHeartRateWindows(sleepSamples)
  const signals: StorePassiveSignalInput[] = []

  for (const window of windows) {
    try {
      const samples = await healthKit.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
        limit: HEALTHKIT_SLEEP_HEART_RATE_SAMPLE_LIMIT,
        ascending: true,
        unit: 'count/min',
        filter: {
          date: {
            startDate: window.startDate,
            endDate: window.endDate,
            strictStartDate: false,
            strictEndDate: false,
          },
        },
      })
      const aggregate = sleepHeartRateAggregate(window, samples)
      if (aggregate) signals.push(...sleepHeartRateAggregateToSignals(window, aggregate))
    } catch (error) {
      errors.push(`sleep_heart_rate:${window.dateKey}: ${humanError(error)}`)
    }
  }

  await logHealthKitDebug('collect:sleep-heart-rate-aggregates', {
    windows: windows.length,
    signals: signals.length,
  })

  return signals
}

function sleepHeartRateWindows(samples: SleepSampleForAggregation[]): SleepHeartRateWindow[] {
  const buckets = new Map<string, SleepSampleForAggregation[]>()
  for (const sample of samples) {
    const dateKey = localDateKey(sample.endDate)
    buckets.set(dateKey, [...(buckets.get(dateKey) ?? []), sample])
  }

  return [...buckets.entries()].map(([dateKey, bucket]) => ({
    dateKey,
    startDate: new Date(Math.min(...bucket.map((sample) => sample.startDate.getTime()))),
    endDate: new Date(Math.max(...bucket.map((sample) => sample.endDate.getTime()))),
    intervals: bucket
      .map((sample) => ({ start: sample.startDate.getTime(), end: sample.endDate.getTime() }))
      .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
      .sort((a, b) => a.start - b.start),
    sampleUuids: bucket.map((sample) => sample.uuid).sort(),
  }))
}

function sleepHeartRateAggregate(
  window: SleepHeartRateWindow,
  samples: readonly (HealthKitSample & { quantity: number; unit?: string })[],
): SleepHeartRateAggregate | null {
  const heartRates = samples
    .map((sample) => ({
      bpm: Number(sample.quantity),
      start: toDate(sample.startDate).getTime(),
      end: toDate(sample.endDate).getTime(),
    }))
    .filter((sample) => (
      Number.isFinite(sample.bpm)
      && sample.bpm >= 35
      && sample.bpm <= 230
      && Number.isFinite(sample.start)
      && overlapsAnyInterval(sample.start, sample.end > sample.start ? sample.end : sample.start + 1, window.intervals)
    ))
    .sort((a, b) => a.start - b.start)

  if (heartRates.length < 3) return null

  let weightedHeartRate = 0
  let weightedSeconds = 0
  let minBpm = Number.POSITIVE_INFINITY
  let maxBpm = 0
  const values: number[] = []

  for (let index = 0; index < heartRates.length; index += 1) {
    const sample = heartRates[index]
    const next = heartRates[index + 1]
    const nativeDuration = sample.end > sample.start ? sample.end - sample.start : 0
    const inferredDuration = next ? Math.max(0, next.start - sample.start) : 30000
    const durationMs = clippedIntervalDuration(sample.start, sample.start + Math.min(Math.max(nativeDuration, inferredDuration), 300000), window.intervals)
    if (durationMs <= 0) continue

    const seconds = durationMs / 1000
    weightedHeartRate += sample.bpm * seconds
    weightedSeconds += seconds
    minBpm = Math.min(minBpm, sample.bpm)
    maxBpm = Math.max(maxBpm, sample.bpm)
    values.push(sample.bpm)
  }

  if (weightedSeconds <= 0 || values.length < 3) return null

  return {
    averageBpm: weightedHeartRate / weightedSeconds,
    minBpm,
    maxBpm,
    medianBpm: median(values),
    sampleCount: values.length,
    durationMinutes: weightedSeconds / 60,
  }
}

function sleepHeartRateAggregateToSignals(
  window: SleepHeartRateWindow,
  aggregate: SleepHeartRateAggregate,
): StorePassiveSignalInput[] {
  const metadata = {
    healthkit: {
      kind: 'sleep_heart_rate_aggregate',
      type: 'HKQuantityTypeIdentifierHeartRate',
      date_key: window.dateKey,
      sleep_sample_uuids: window.sampleUuids,
      heart_rate_sample_count: aggregate.sampleCount,
      duration_minutes: aggregate.durationMinutes,
      privacy: 'aggregate_only',
    },
  }
  const definitions: Array<{ type: string; value: number; unit: string }> = [
    { type: 'sleep_hr_avg_bpm', value: aggregate.averageBpm, unit: 'bpm' },
    { type: 'sleep_hr_min_bpm', value: aggregate.minBpm, unit: 'bpm' },
    { type: 'sleep_hr_max_bpm', value: aggregate.maxBpm, unit: 'bpm' },
    { type: 'sleep_hr_median_bpm', value: aggregate.medianBpm, unit: 'bpm' },
    { type: 'sleep_hr_sample_count', value: aggregate.sampleCount, unit: 'count' },
  ]

  return definitions.map((definition) => ({
    client_id: healthKitSleepAggregateClientId(window.dateKey, definition.type),
    source: 'healthkit',
    signal_type: definition.type,
    value_numeric: Number(definition.value.toFixed(3)),
    value_text: null,
    unit: definition.unit,
    started_at: window.startDate.toISOString(),
    ended_at: window.endDate.toISOString(),
    recorded_timezone: deviceTimezone(),
    metadata,
  }))
}

export function healthKitSleepAggregateClientId(dateKey: string, signalType: string): string {
  return deterministicUuid(`healthkit:sleep-aggregate:${dateKey}:${signalType}`)
}

async function wakingHeartRateAggregateSignals(
  healthKit: HealthKitModule,
  days: number,
  sleepSamples: SleepSampleForAggregation[],
  workouts: WorkoutSampleForAggregation[],
  profile: HeartRateProfile,
  errors: string[],
): Promise<StorePassiveSignalInput[]> {
  const { start, end } = recentLocalDayRange(days)

  try {
    const samples = await healthKit.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
      limit: HEALTHKIT_WAKING_HEART_RATE_SAMPLE_LIMIT,
      ascending: true,
      unit: 'count/min',
      filter: {
        date: {
          startDate: start,
          endDate: end,
          strictStartDate: false,
          strictEndDate: true,
        },
      },
    })

    const points = heartRatePoints(samples)
    const excludedIntervals = mergeIntervals([
      ...sleepSamples.map((sample) => ({ start: sample.startDate.getTime(), end: sample.endDate.getTime() })),
      ...workouts.map((workout) => ({ start: workout.startDate.getTime(), end: workout.endDate.getTime() })),
    ])
    const signals: StorePassiveSignalInput[] = []

    for (const dayStart of localDayStarts(start, end)) {
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayStart.getDate() + 1)
      const dateKey = localDateKey(dayStart)
      const aggregate = wakingHeartRateAggregate(
        dateKey,
        dayStart,
        dayEnd,
        points.filter((point) => point.start >= dayStart.getTime() && point.start < dayEnd.getTime()),
        excludedIntervals,
        profile,
      )

      signals.push(...(
        aggregate
          ? wakingHeartRateAggregateToSignals(aggregate)
          : deletedWakingHeartRateAggregateSignals(dateKey, dayStart, dayEnd)
      ))
    }

    await logHealthKitDebug('collect:waking-heart-rate-aggregates', {
      days,
      samples: samples.length,
      signals: signals.length,
      maxHeartRate: profile.maxHeartRate,
      restingHeartRate: profile.restingHeartRate,
      maxHeartRateSource: profile.source,
    })

    return signals
  } catch (error) {
    errors.push(`waking_heart_rate: ${humanError(error)}`)
    return []
  }
}

function wakingHeartRateAggregate(
  dateKey: string,
  dayStart: Date,
  dayEnd: Date,
  points: HeartRatePoint[],
  excludedIntervals: Array<{ start: number; end: number }>,
  profile: HeartRateProfile,
): WakingHeartRateAggregate | null {
  const validPoints = points
    .filter((point) => (
      point.bpm >= 35
      && point.bpm <= 230
      && !overlapsAnyInterval(point.start, point.end > point.start ? point.end : point.start + 1, excludedIntervals)
    ))
    .sort((a, b) => a.start - b.start)

  if (validPoints.length < 8) return null

  const observedMax = Math.max(...validPoints.map((point) => point.bpm))
  const effectiveProfile = effectiveHeartRateProfile(profile, observedMax)
  const zones = [0, 0, 0, 0, 0]
  let weightedHeartRate = 0
  let weightedSeconds = 0
  let maxObserved = 0

  for (let index = 0; index < validPoints.length; index += 1) {
    const point = validPoints[index]
    const next = validPoints[index + 1]
    const nativeDuration = point.end > point.start ? point.end - point.start : 0
    const inferredDuration = next ? Math.max(0, next.start - point.start) : 30000
    const sampleEnd = Math.min(
      point.start + Math.min(Math.max(nativeDuration, inferredDuration), 300000),
      dayEnd.getTime(),
    )
    const durationMs = durationExcludingIntervals(point.start, sampleEnd, excludedIntervals)
    if (durationMs <= 0) continue

    const seconds = durationMs / 1000
    const zone = heartRateZone(point.bpm, effectiveProfile)
    if (zone >= 1) zones[zone - 1] += seconds / 60
    weightedHeartRate += point.bpm * seconds
    weightedSeconds += seconds
    maxObserved = Math.max(maxObserved, point.bpm)
  }

  if (weightedSeconds < 20 * 60) return null

  const wakingZoneWeights = [0.1, 0.45, 1.2, 2.8, 4.5]
  const cardioLoad = zones.reduce((sum, minutes, index) => sum + minutes * wakingZoneWeights[index], 0)
  const density = cardioLoad / Math.max(weightedSeconds / 60, 1)
  const strain = clampNumber(100 * (1 - Math.exp(-cardioLoad / 220)) + Math.max(0, density - 1.4) * 5, 0, 100)

  return {
    dateKey,
    startDate: dayStart,
    endDate: dayEnd,
    averageBpm: weightedHeartRate / weightedSeconds,
    maxBpm: maxObserved,
    maxHeartRate: effectiveProfile.maxHeartRate,
    restingHeartRate: effectiveProfile.restingHeartRate,
    maxHeartRateSource: effectiveProfile.source,
    zoneMinutes: zones,
    cardioLoad,
    strain,
    sampleCount: validPoints.length,
    durationMinutes: weightedSeconds / 60,
  }
}

function wakingHeartRateAggregateToSignals(aggregate: WakingHeartRateAggregate): StorePassiveSignalInput[] {
  const metadata = {
    healthkit: {
      kind: 'waking_heart_rate_aggregate',
      type: 'HKQuantityTypeIdentifierHeartRate',
      date_key: aggregate.dateKey,
      max_heart_rate_estimate: aggregate.maxHeartRate,
      resting_heart_rate_bpm: aggregate.restingHeartRate,
      max_heart_rate_source: aggregate.maxHeartRateSource,
      heart_rate_sample_count: aggregate.sampleCount,
      duration_minutes: aggregate.durationMinutes,
      privacy: 'aggregate_only',
      exclusions: ['sleep', 'workout'],
    },
  }
  const definitions: Array<{ type: string; value: number; unit: string }> = [
    { type: 'waking_hr_avg_bpm', value: aggregate.averageBpm, unit: 'bpm' },
    { type: 'waking_hr_max_bpm', value: aggregate.maxBpm, unit: 'bpm' },
    { type: 'waking_cardio_load', value: aggregate.cardioLoad, unit: 'a.u.' },
    { type: 'waking_cardio_strain', value: aggregate.strain, unit: '%' },
    ...aggregate.zoneMinutes.map((minutes, index) => ({
      type: `waking_hr_zone_${index + 1}_min`,
      value: minutes,
      unit: 'min',
    })),
    { type: 'waking_hr_sample_count', value: aggregate.sampleCount, unit: 'count' },
  ]

  return definitions.map((definition) => ({
    client_id: healthKitWakingHeartRateAggregateClientId(aggregate.dateKey, definition.type),
    source: 'healthkit',
    signal_type: definition.type,
    value_numeric: Number(definition.value.toFixed(3)),
    value_text: null,
    unit: definition.unit,
    started_at: aggregate.startDate.toISOString(),
    ended_at: aggregate.endDate.toISOString(),
    recorded_timezone: deviceTimezone(),
    metadata,
  }))
}

function deletedWakingHeartRateAggregateSignals(dateKey: string, dayStart: Date, dayEnd: Date): StorePassiveSignalInput[] {
  const deletedAt = new Date().toISOString()
  return WAKING_HEART_RATE_AGGREGATE_SIGNAL_TYPES.map((signalType) => ({
    client_id: healthKitWakingHeartRateAggregateClientId(dateKey, signalType),
    source: 'healthkit' as const,
    signal_type: signalType,
    value_numeric: null,
    value_text: null,
    unit: null,
    started_at: dayStart.toISOString(),
    ended_at: dayEnd.toISOString(),
    recorded_timezone: deviceTimezone(),
    deleted_at: deletedAt,
    metadata: {
      healthkit: {
        kind: 'deleted_waking_heart_rate_aggregate',
        date_key: dateKey,
      },
    },
  }))
}

function healthKitWakingHeartRateAggregateClientId(dateKey: string, signalType: string): string {
  return deterministicUuid(`healthkit:waking-heart-rate:${dateKey}:${signalType}`)
}

function heartRatePoints(samples: readonly (HealthKitSample & { quantity: number; unit?: string })[]): HeartRatePoint[] {
  return samples
    .map((sample) => {
      const start = toDate(sample.startDate).getTime()
      const rawEnd = toDate(sample.endDate).getTime()
      return {
        bpm: Number(sample.quantity),
        start,
        end: Number.isFinite(rawEnd) && rawEnd > start ? rawEnd : start + 1,
      }
    })
    .filter((point) => Number.isFinite(point.bpm) && Number.isFinite(point.start))
}

function overlapsAnyInterval(start: number, end: number, intervals: Array<{ start: number; end: number }>): boolean {
  return intervals.some((interval) => Math.max(start, interval.start) < Math.min(end, interval.end))
}

function clippedIntervalDuration(start: number, end: number, intervals: Array<{ start: number; end: number }>): number {
  return intervals.reduce((total, interval) => total + Math.max(0, Math.min(end, interval.end) - Math.max(start, interval.start)), 0)
}

function durationExcludingIntervals(start: number, end: number, excludedIntervals: Array<{ start: number; end: number }>): number {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  let total = end - start

  for (const interval of excludedIntervals) {
    total -= Math.max(0, Math.min(end, interval.end) - Math.max(start, interval.start))
    if (total <= 0) return 0
  }

  return Math.max(0, total)
}

function mergeIntervals(intervals: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
  const sorted = intervals
    .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
    .sort((a, b) => a.start - b.start)

  if (sorted.length === 0) return []

  const merged: Array<{ start: number; end: number }> = [{ ...sorted[0] }]
  for (const interval of sorted.slice(1)) {
    const current = merged[merged.length - 1]
    if (interval.start <= current.end) {
      current.end = Math.max(current.end, interval.end)
    } else {
      merged.push({ ...interval })
    }
  }
  return merged
}

function localDayStarts(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const current = startOfLocalDay(start)
  while (current < end) {
    days.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  return days
}

function deletedWorkoutAggregateSignals(deletedSamples: readonly DeletedSample[]): StorePassiveSignalInput[] {
  return deletedSamples.flatMap((sample) => {
    const deletedAt = new Date().toISOString()
    return WORKOUT_HEART_RATE_AGGREGATE_SIGNAL_TYPES.map((signalType) => ({
      client_id: deterministicUuid(`healthkit:workout-heart-rate:${sample.uuid}:${signalType}`),
      source: 'healthkit' as const,
      signal_type: signalType,
      value_numeric: null,
      value_text: null,
      unit: null,
      started_at: deletedAt,
      ended_at: null,
      recorded_timezone: deviceTimezone(),
      deleted_at: deletedAt,
      metadata: {
        healthkit: {
          kind: 'deleted_derived_workout_heart_rate_aggregate',
          workout_uuid: sample.uuid,
        },
      },
    }))
  })
}

async function readDateOfBirthSafely(healthKit: HealthKitModule): Promise<Date | null> {
  try {
    const value = await healthKit.getDateOfBirthAsync()
    if (value === undefined || value === null) return null
    const date = toDate(value as Date | string | number | undefined)
    return Number.isFinite(date.getTime()) && date < new Date() ? date : null
  } catch {
    return null
  }
}

async function personalHeartRateProfile(
  healthKit: HealthKitModule,
): Promise<HeartRateProfile> {
  const dateOfBirth = await readDateOfBirthSafely(healthKit)
  const restingHeartRate = await readLatestQuantityValue(
    healthKit,
    'HKQuantityTypeIdentifierRestingHeartRate',
    'count/min',
  )

  return {
    maxHeartRate: estimatedMaxHeartRate(dateOfBirth),
    restingHeartRate: typeof restingHeartRate === 'number' && restingHeartRate >= 35 && restingHeartRate <= 110
      ? restingHeartRate
      : null,
    source: dateOfBirth ? 'date_of_birth' : 'default',
  }
}

async function readLatestQuantityValue(
  healthKit: HealthKitModule,
  identifier: QuantityTypeIdentifier,
  unit: string,
): Promise<number | null> {
  try {
    const samples = await healthKit.queryQuantitySamples(identifier, {
      limit: 1,
      ascending: false,
      unit,
    })
    const value = Number(samples[0]?.quantity)
    return Number.isFinite(value) ? value : null
  } catch (error) {
    await logHealthKitDebug('collect:optional-latest-quantity-failed', {
      identifier,
      error: humanError(error),
    })
    return null
  }
}

function estimatedMaxHeartRate(dateOfBirth: Date | null, now = new Date()): number {
  if (!dateOfBirth) return 190
  const age = ageYears(dateOfBirth, now)
  return clampNumber(Math.round(208 - 0.7 * age), 160, 205)
}

function ageYears(dateOfBirth: Date, now: Date): number {
  let age = now.getFullYear() - dateOfBirth.getFullYear()
  const monthDiff = now.getMonth() - dateOfBirth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dateOfBirth.getDate())) age -= 1
  return Math.max(0, age)
}

function effectiveHeartRateProfile(profile: HeartRateProfile, observedMax: number): HeartRateProfile {
  if (!Number.isFinite(observedMax) || observedMax < 120) return profile
  const observedEstimate = clampNumber(Math.ceil(observedMax * 1.015), 160, 215)
  if (observedEstimate <= profile.maxHeartRate) return profile

  return {
    ...profile,
    maxHeartRate: observedEstimate,
    source: 'observed_peak',
  }
}

function heartRateZone(bpm: number, profile: HeartRateProfile): number {
  const reserve = typeof profile.restingHeartRate === 'number'
    ? profile.maxHeartRate - profile.restingHeartRate
    : null
  const ratio = reserve && reserve >= 60
    ? (bpm - Number(profile.restingHeartRate)) / reserve
    : bpm / profile.maxHeartRate
  if (ratio >= 0.9) return 5
  if (ratio >= 0.8) return 4
  if (ratio >= 0.7) return 3
  if (ratio >= 0.6) return 2
  if (ratio >= 0.5) return 1
  return 0
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
      const samples = await healthKit.queryQuantitySamples(identifier, quantityLatestOptions(identifier))
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
  days: number,
): Promise<readonly (HealthKitSample & { value: unknown })[]> {
  const { start, end } = recentLocalDayRange(days)
  return healthKit.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
    limit: HEALTHKIT_SLEEP_SAMPLE_LIMIT,
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
    const hours = unionDurationHours(bucket)
    const uuidList = bucket.map((sample) => sample.uuid).sort()

    return {
      client_id: healthKitSleepDurationClientId(dateKey),
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
          date_key: dateKey,
          sample_uuids: uuidList,
        },
      },
    }
  })
}

export function healthKitSleepDurationClientId(dateKey: string): string {
  return deterministicUuid(`healthkit:sleep_duration:${dateKey}`)
}

function unionDurationHours(samples: SleepSampleForAggregation[]): number {
  const intervals = samples
    .map((sample) => ({
      start: sample.startDate.getTime(),
      end: sample.endDate.getTime(),
    }))
    .filter((interval) => Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start)
    .sort((a, b) => a.start - b.start)

  let totalMs = 0
  let currentStart: number | null = null
  let currentEnd: number | null = null

  for (const interval of intervals) {
    if (currentStart === null || currentEnd === null) {
      currentStart = interval.start
      currentEnd = interval.end
      continue
    }

    if (interval.start <= currentEnd) {
      currentEnd = Math.max(currentEnd, interval.end)
      continue
    }

    totalMs += currentEnd - currentStart
    currentStart = interval.start
    currentEnd = interval.end
  }

  if (currentStart !== null && currentEnd !== null) {
    totalMs += currentEnd - currentStart
  }

  return totalMs / 3600000
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

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
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

interface WorkoutSampleForAggregation {
  uuid: string
  startDate: Date
  endDate: Date
  durationSeconds: number
  activityType: string | null
}

interface WorkoutHeartRateAggregate {
  averageBpm: number
  maxBpm: number
  maxHeartRate: number
  restingHeartRate: number | null
  maxHeartRateSource: string
  zoneMinutes: number[]
  cardioLoad: number
  strain: number
  sampleCount: number
  durationMinutes: number
}

interface WakingHeartRateAggregate extends WorkoutHeartRateAggregate {
  dateKey: string
  startDate: Date
  endDate: Date
}

interface SleepHeartRateWindow {
  dateKey: string
  startDate: Date
  endDate: Date
  intervals: Array<{ start: number; end: number }>
  sampleUuids: string[]
}

interface SleepHeartRateAggregate {
  averageBpm: number
  minBpm: number
  maxBpm: number
  medianBpm: number
  sampleCount: number
  durationMinutes: number
}

interface HeartRateProfile {
  maxHeartRate: number
  restingHeartRate: number | null
  source: string
}

interface HeartRatePoint {
  bpm: number
  start: number
  end: number
}
