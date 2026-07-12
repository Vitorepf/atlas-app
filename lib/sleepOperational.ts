import { clamp } from './mathUtils'
export type SleepTimelineStage = 'awake' | 'rem' | 'core' | 'deep' | 'asleep' | 'inBed'

export interface SleepTimelineSignal {
  signal_type: string
  value_numeric: number | null
  started_at: string
  ended_at?: string | null
}

export interface SleepTimelineSegment {
  stage: SleepTimelineStage
  startedAt: string
  endedAt: string
  hours: number
}

export interface SleepPlannerInput {
  sleepNeedHours: number
  efficiencyPercent?: number | null
  latencyMinutes?: number | null
  wakeAnchorIso: string
  windDownMinutes?: number
}

export interface SleepPlannerOutput {
  bedtimeIso: string
  wakeTimeIso: string
  windDownIso: string
  timeInBedHours: number
  sleepNeedHours: number
  efficiencyPercent: number
  latencyMinutes: number
}

export interface SleepInsightInput {
  durationHours: number | null
  targetHours: number
  sleepDebtHours: number | null
  efficiencyPercent: number | null
  latencyMinutes: number | null
  awakeEpisodeCount: number | null
  disturbanceCount: number | null
  sleepStressScore: number | null
  oxygenSaturationPercent: number | null
  dataQuality: number | null
  stageCoverage: number | null
  regularityScore: number | null
}

export interface SleepInsight {
  key: string
  label: string
  value: string
  severity: 'good' | 'warning' | 'bad' | 'info'
}

const MIN_SEGMENT_MS = 30 * 1000

export function sleepTimelineSegments(
  signals: SleepTimelineSignal[],
  startIso?: string | null,
  endIso?: string | null,
): SleepTimelineSegment[] {
  if (!startIso || !endIso) return []
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return []

  const segments = signals
    .filter((signal) => signal.signal_type === 'sleep_stage')
    .map((signal) => {
      const stage = sleepStageKey(signal.value_numeric)
      const signalStart = new Date(signal.started_at).getTime()
      const signalEnd = new Date(signal.ended_at ?? signal.started_at).getTime()
      if (!stage || !Number.isFinite(signalStart) || !Number.isFinite(signalEnd) || signalEnd <= signalStart) {
        return null
      }
      const clippedStart = Math.max(start, signalStart)
      const clippedEnd = Math.min(end, signalEnd)
      if (clippedEnd - clippedStart < MIN_SEGMENT_MS) return null
      return {
        stage,
        startedAt: new Date(clippedStart).toISOString(),
        endedAt: new Date(clippedEnd).toISOString(),
        hours: (clippedEnd - clippedStart) / 3600000,
      }
    })
    .filter((segment): segment is SleepTimelineSegment => segment !== null)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())

  return mergeAdjacentSegments(segments)
}

export function aggregateSleepTimelineSegments(input: {
  bedtime?: string | null
  wakeTime?: string | null
  awakeHours?: number | null
  remHours?: number | null
  coreHours?: number | null
  deepHours?: number | null
  asleepHours?: number | null
}): SleepTimelineSegment[] {
  const start = input.bedtime ? new Date(input.bedtime).getTime() : NaN
  if (!Number.isFinite(start)) return []
  let cursor = start
  const stages: Array<[SleepTimelineStage, number | null | undefined]> = [
    ['awake', input.awakeHours],
    ['deep', input.deepHours],
    ['core', input.coreHours],
    ['rem', input.remHours],
    ['asleep', input.asleepHours],
  ]

  return stages.flatMap(([stage, hours]) => {
    if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) return []
    const segmentStart = cursor
    const segmentEnd = cursor + hours * 3600000
    cursor = segmentEnd
    return [{
      stage,
      startedAt: new Date(segmentStart).toISOString(),
      endedAt: new Date(segmentEnd).toISOString(),
      hours,
    }]
  })
}

export function buildSleepPlanner(input: SleepPlannerInput): SleepPlannerOutput | null {
  const wakeTime = new Date(input.wakeAnchorIso).getTime()
  if (!Number.isFinite(wakeTime) || !Number.isFinite(input.sleepNeedHours) || input.sleepNeedHours <= 0) return null

  const efficiencyPercent = clamp(input.efficiencyPercent ?? 90, 75, 98)
  const latencyMinutes = clamp(input.latencyMinutes ?? 20, 0, 90)
  const windDownMinutes = clamp(input.windDownMinutes ?? 45, 15, 120)
  const timeInBedHours = clamp(input.sleepNeedHours / (efficiencyPercent / 100), input.sleepNeedHours, input.sleepNeedHours + 2)
  const bedtime = wakeTime - timeInBedHours * 3600000 - latencyMinutes * 60000
  const windDown = bedtime - windDownMinutes * 60000

  return {
    bedtimeIso: new Date(bedtime).toISOString(),
    wakeTimeIso: new Date(wakeTime).toISOString(),
    windDownIso: new Date(windDown).toISOString(),
    timeInBedHours,
    sleepNeedHours: input.sleepNeedHours,
    efficiencyPercent,
    latencyMinutes,
  }
}

export function sleepInsightItems(input: SleepInsightInput): SleepInsight[] {
  const items: SleepInsight[] = []
  if (typeof input.durationHours === 'number') {
    const deficit = Math.max(0, input.targetHours - input.durationHours)
    if (deficit >= 1) {
      items.push(insight('short_sleep', 'Sono abaixo do necessário', `${formatHours(deficit)} abaixo do alvo`, 'bad'))
    } else if (deficit >= 0.25) {
      items.push(insight('slight_short_sleep', 'Sono um pouco curto', `${formatHours(deficit)} abaixo do alvo`, 'warning'))
    } else {
      items.push(insight('duration_ok', 'Duração suficiente', `${formatHours(input.durationHours)} dormidas`, 'good'))
    }
  }

  if (typeof input.sleepDebtHours === 'number' && input.sleepDebtHours >= 2) {
    items.push(insight('sleep_debt', 'Déficit acumulado relevante', `${formatHours(input.sleepDebtHours)} em 7 dias`, input.sleepDebtHours >= 4 ? 'bad' : 'warning'))
  }
  if (typeof input.efficiencyPercent === 'number' && input.efficiencyPercent < 88) {
    items.push(insight('low_efficiency', 'Eficiência baixa', `${Math.round(input.efficiencyPercent)}% na cama`, 'warning'))
  }
  if (typeof input.latencyMinutes === 'number' && input.latencyMinutes > 30) {
    items.push(insight('high_latency', 'Demorou para dormir', `${Math.round(input.latencyMinutes)}min de latência`, input.latencyMinutes > 45 ? 'bad' : 'warning'))
  }
  if (typeof input.awakeEpisodeCount === 'number' && input.awakeEpisodeCount > 2) {
    items.push(insight('awakenings', 'Sono fragmentado', `${Math.round(input.awakeEpisodeCount)} despertares`, 'warning'))
  }
  if (typeof input.disturbanceCount === 'number' && input.disturbanceCount > 10) {
    items.push(insight('disturbances', 'Muitas interrupções', `${Math.round(input.disturbanceCount)} distúrbios`, input.disturbanceCount > 16 ? 'bad' : 'warning'))
  }
  if (typeof input.sleepStressScore === 'number' && input.sleepStressScore < 70) {
    items.push(insight('sleep_stress', 'Stress fisiológico no sono', `${Math.round(input.sleepStressScore)}%`, input.sleepStressScore < 55 ? 'bad' : 'warning'))
  }
  if (typeof input.oxygenSaturationPercent === 'number' && input.oxygenSaturationPercent < 95) {
    items.push(insight('oxygen', 'Oxigênio abaixo do ideal', `${formatNumber(input.oxygenSaturationPercent)}%`, 'warning'))
  }
  if (typeof input.regularityScore === 'number' && input.regularityScore < 75) {
    items.push(insight('regularity', 'Rotina irregular', `${Math.round(input.regularityScore)}% regularidade`, 'warning'))
  }
  if (typeof input.stageCoverage === 'number' && input.stageCoverage < 0.75) {
    items.push(insight('stage_coverage', 'Fases incompletas', `${Math.round(input.stageCoverage * 100)}% de cobertura`, 'info'))
  }
  if (typeof input.dataQuality === 'number' && input.dataQuality < 0.55) {
    items.push(insight('data_quality', 'Dado parcial', `${Math.round(input.dataQuality * 100)}% confiança`, 'info'))
  }

  if (items.length === 0) {
    items.push(insight('stable_night', 'Noite estável', 'sem alerta relevante', 'good'))
  }

  return items.slice(0, 5)
}

function insight(key: string, label: string, value: string, severity: SleepInsight['severity']): SleepInsight {
  return { key, label, value, severity }
}

function sleepStageKey(value: number | null): SleepTimelineStage | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  switch (value) {
    case 0: return 'inBed'
    case 1: return 'asleep'
    case 2: return 'awake'
    case 3: return 'core'
    case 4: return 'deep'
    case 5: return 'rem'
    default: return null
  }
}

function mergeAdjacentSegments(segments: SleepTimelineSegment[]): SleepTimelineSegment[] {
  const merged: SleepTimelineSegment[] = []
  for (const segment of segments) {
    const last = merged[merged.length - 1]
    const lastEnd = last ? new Date(last.endedAt).getTime() : NaN
    const currentStart = new Date(segment.startedAt).getTime()
    if (last && last.stage === segment.stage && Math.abs(currentStart - lastEnd) <= 60000) {
      last.endedAt = segment.endedAt
      last.hours += segment.hours
      continue
    }
    merged.push({ ...segment })
  }
  return merged
}

function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (totalMinutes < 60) return `${totalMinutes}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 100) return Math.round(value).toLocaleString('pt-BR')
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1).replace('.', ',')
}
