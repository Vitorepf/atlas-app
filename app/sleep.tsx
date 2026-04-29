import { useMemo } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { SectionHeader } from '../components/SectionHeader'
import { PrimaryButton } from '../components/PrimaryButton'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import {
  formatRelativeSync,
  useAtlasStore,
  type QueuedPassiveSignal,
} from '../lib/atlasStore'
import type { AtlasPassiveSignal } from '../lib/api/client'

type HealthSignal = Pick<
  AtlasPassiveSignal,
  'id' | 'client_id' | 'source' | 'signal_type' | 'value_numeric' | 'value_text' | 'unit' | 'started_at' | 'ended_at' | 'recorded_timezone' | 'metadata'
>

interface SleepNight {
  key: string
  asleepHours: number | null
  inBedHours: number | null
  efficiency: number | null
  bedtime: string | null
  wakeTime: string | null
  remHours: number | null
  deepHours: number | null
  coreHours: number | null
  awakeHours: number | null
  unspecifiedHours: number | null
  score: number | null
  scoreLabel: string
}

interface SleepModel {
  night: SleepNight | null
  nights: SleepNight[]
  sleepDebtHours: number | null
  average7dHours: number | null
  consistencyMinutes: number | null
  vitals: Array<{ label: string; value: string; date: string }>
}

type StageKey = 'awake' | 'rem' | 'core' | 'deep' | 'asleep' | 'inBed'

export default function SleepScreen() {
  const c = usePalette()
  const router = useRouter()
  const passiveSignals = useAtlasStore((s) => s.passiveSignals)
  const queuedPassiveSignals = useAtlasStore((s) => s.queuedPassiveSignals)
  const healthKit = useAtlasStore((s) => s.healthKit)
  const syncHealthKit = useAtlasStore((s) => s.syncHealthKit)
  const healthKitSyncing = useAtlasStore((s) => s.healthKitSyncing)

  const healthSignals = useMemo(() => (
    mergeSignals([
      ...passiveSignals,
      ...queuedPassiveSignals.map(queuedToSignal),
    ]).filter((signal) => signal.source === 'healthkit')
  ), [passiveSignals, queuedPassiveSignals])

  const model = useMemo(() => buildSleepModel(healthSignals), [healthSignals])
  const night = model.night

  return (
    <Screen>
      <View style={styles.head}>
        <Pressable
          onPress={() => router.back()}
          accessibilityLabel="Voltar"
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <BackArrow color={c.ink2} />
        </Pressable>
        <Mono size={11} letterSpacing={0.44} color={c.ink2}>
          Última coleta · {formatRelativeSync(healthKit.lastSyncAt)}
        </Mono>
      </View>

      <View style={styles.header}>
        <Label>Sono</Label>
        <Frau size={42} lineHeight={44} letterSpacing={-1.05} color={c.ink} style={{ marginTop: 8 }}>
          Noite de sono
        </Frau>
        <Mono size={12} letterSpacing={0.24} color={c.ink2} style={{ marginTop: 8 }}>
          {night?.wakeTime ? formatLongDate(night.wakeTime) : 'Sem noite registrada'}
        </Mono>
      </View>

      <View style={styles.tileGrid}>
        <View style={styles.tileRow}>
          <SleepTile label="Duração" value={formatHoursMetric(night?.asleepHours)} />
          <SleepTile label="Eficiência" value={formatPercentMetric(night?.efficiency)} />
        </View>
        <View style={styles.tileRow}>
          <SleepTile label="Qualidade" value={night?.score === null || night?.score === undefined ? 'Sem dado' : `${night.score}%`} subvalue={night?.scoreLabel} />
          <SleepTile label="Débito 7d" value={formatDebt(model.sleepDebtHours)} />
        </View>
      </View>

      <View style={[styles.summaryPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
        <SummaryLine label="Hora de dormir" value={night?.bedtime ? formatTime(night.bedtime) : 'Sem dado'} />
        <SummaryLine label="Hora de acordar" value={night?.wakeTime ? formatTime(night.wakeTime) : 'Sem dado'} />
        <SummaryLine label="Consistência" value={formatConsistency(model.consistencyMinutes)} last />
      </View>

      <SectionHeader label="Arquitetura" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        <SleepStageTimeline night={night} />
        <SleepMetricRow label="REM" value={formatHoursMetric(night?.remHours)} />
        <SleepMetricRow label="Profundo" value={formatHoursMetric(night?.deepHours)} />
        <SleepMetricRow label="Core" value={formatHoursMetric(night?.coreHours)} />
        <SleepMetricRow label="Acordado" value={formatHoursMetric(night?.awakeHours)} />
        <SleepMetricRow label="Na cama" value={formatHoursMetric(night?.inBedHours)} last />
      </View>

      <SectionHeader label="Tendência" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        <TrendBars nights={model.nights} />
        <SleepMetricRow label="Média 7 dias" value={formatHoursMetric(model.average7dHours)} />
        <SleepMetricRow label="Meta diária" value="7h30" />
        <SleepMetricRow label="Noites analisadas" value={`${model.nights.filter((item) => typeof item.asleepHours === 'number').length}`} last />
      </View>

      <SectionHeader label="Sinais vitais" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        {model.vitals.length > 0 ? model.vitals.map((item, index) => (
          <SleepMetricRow
            key={item.label}
            label={item.label}
            value={item.value}
            detail={formatDateTime(item.date)}
            last={index === model.vitals.length - 1}
          />
        )) : (
          <SleepMetricRow label="Sinais vitais" value="Sem dado" last />
        )}
      </View>

      <View style={{ height: 18 }} />
      <PrimaryButton
        label={healthKitSyncing ? 'Coletando…' : 'Coletar sono agora'}
        variant="secondary"
        onPress={() => {
          void syncHealthKit()
        }}
      />
    </Screen>
  )
}

function SleepTile({
  label,
  value,
  subvalue,
}: {
  label: string
  value: string
  subvalue?: string
}) {
  const c = usePalette()
  return (
    <View style={[styles.tile, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Label>{label}</Label>
      <Frau size={24} lineHeight={30} letterSpacing={-0.48} color={c.ink} style={{ marginTop: 10 }}>
        {value}
      </Frau>
      {subvalue ? (
        <Mono size={10.5} letterSpacing={0.21} color={c.ink2} style={{ marginTop: 4 }}>
          {subvalue}
        </Mono>
      ) : null}
    </View>
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
      <Mono size={12} letterSpacing={0.24} color={c.ink}>
        {value}
      </Mono>
    </View>
  )
}

function SleepMetricRow({
  label,
  value,
  detail,
  last,
}: {
  label: string
  value: string
  detail?: string
  last?: boolean
}) {
  const c = usePalette()
  return (
    <View style={[styles.metricRow, !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans size={15} color={c.ink}>{label}</Sans>
        {detail ? (
          <Mono size={10.5} letterSpacing={0.21} color={c.ink2} style={{ marginTop: 3 }}>
            {detail}
          </Mono>
        ) : null}
      </View>
      <Mono size={13} letterSpacing={0.26} color={value === 'Sem dado' ? c.ink3 : c.ink} align="right">
        {value}
      </Mono>
    </View>
  )
}

function SleepStageTimeline({ night }: { night: SleepNight | null }) {
  const c = usePalette()
  const stages = [
    { key: 'awake' as const, label: 'Acordado', value: night?.awakeHours, color: c.recRed },
    { key: 'rem' as const, label: 'REM', value: night?.remHours, color: c.prussian },
    { key: 'core' as const, label: 'Core', value: night?.coreHours, color: c.bronze },
    { key: 'deep' as const, label: 'Profundo', value: night?.deepHours, color: c.moss },
    { key: 'asleep' as const, label: 'Dormindo', value: night?.unspecifiedHours, color: c.ink2 },
  ].filter((stage) => typeof stage.value === 'number' && stage.value > 0)

  const total = stages.reduce((sum, stage) => sum + Number(stage.value), 0)

  return (
    <View style={styles.timelineBlock}>
      <View style={[styles.timelineTrack, { backgroundColor: c.premium }]}>
        {total > 0 ? stages.map((stage) => (
          <View
            key={stage.key}
            style={{
              flex: Math.max(0.08, Number(stage.value) / total),
              backgroundColor: stage.color,
            }}
          />
        )) : (
          <View style={{ flex: 1, backgroundColor: c.ink3, opacity: 0.35 }} />
        )}
      </View>
      <View style={styles.legendRow}>
        {stages.length > 0 ? stages.map((stage) => (
          <View key={stage.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: stage.color }]} />
            <Mono size={9.5} letterSpacing={0.1} color={c.ink2}>
              {stage.label}
            </Mono>
          </View>
        )) : (
          <Mono size={10.5} letterSpacing={0.21} color={c.ink2}>
            Sem fases detalhadas
          </Mono>
        )}
      </View>
    </View>
  )
}

function TrendBars({ nights }: { nights: SleepNight[] }) {
  const c = usePalette()
  const visible = [...nights]
    .filter((night) => typeof night.asleepHours === 'number')
    .slice(0, 14)
    .reverse()
  const max = Math.max(8, ...visible.map((night) => Number(night.asleepHours ?? 0)))

  return (
    <View style={styles.trendBlock}>
      <View style={styles.trendBars}>
        {visible.length > 0 ? visible.map((night) => {
          const hours = Number(night.asleepHours ?? 0)
          const color = hours >= 7 ? c.moss : hours >= 6 ? c.bronze : c.recRed
          return (
            <View key={night.key} style={styles.trendColumn}>
              <View
                style={[
                  styles.trendBar,
                  {
                    height: `${Math.max(10, (hours / max) * 100)}%`,
                    backgroundColor: color,
                  },
                ]}
              />
            </View>
          )
        }) : (
          <Mono size={11} letterSpacing={0.22} color={c.ink2}>Sem histórico</Mono>
        )}
      </View>
      <Mono size={10} letterSpacing={0.2} color={c.ink2}>
        Últimas {visible.length || 0} noites
      </Mono>
    </View>
  )
}

function buildSleepModel(signals: HealthSignal[]): SleepModel {
  const nights = buildSleepNights(signals)
  const night = nights[0] ?? null
  const recent = nights.filter((item) => typeof item.asleepHours === 'number').slice(0, 7)
  const sleepDebtHours = recent.length
    ? recent.reduce((sum, item) => sum + Math.max(0, 7.5 - Number(item.asleepHours)), 0)
    : null
  const average7dHours = recent.length
    ? average(recent.map((item) => Number(item.asleepHours)))
    : null
  const consistencyMinutes = bedtimeConsistencyMinutes(recent)

  return {
    night,
    nights,
    sleepDebtHours,
    average7dHours,
    consistencyMinutes,
    vitals: vitalRows(signals),
  }
}

function buildSleepNights(signals: HealthSignal[]): SleepNight[] {
  const groups = new Map<string, { duration?: HealthSignal; stages: HealthSignal[] }>()

  for (const signal of signals) {
    if (signal.signal_type === 'sleep_duration_hours') {
      const key = localDateKey(signal.ended_at ?? signal.started_at)
      const group = groups.get(key) ?? { stages: [] }
      if (!group.duration || signalEndTime(signal) >= signalEndTime(group.duration)) {
        group.duration = signal
      }
      groups.set(key, group)
    }

    if (signal.signal_type === 'sleep_stage') {
      const key = localDateKey(signal.ended_at ?? signal.started_at)
      const group = groups.get(key) ?? { stages: [] }
      group.stages.push(signal)
      groups.set(key, group)
    }
  }

  return [...groups.entries()]
    .map(([key, group]) => sleepNightFromGroup(key, group.duration, group.stages))
    .sort((a, b) => b.key.localeCompare(a.key))
}

function sleepNightFromGroup(
  key: string,
  duration: HealthSignal | undefined,
  stages: HealthSignal[],
): SleepNight {
  const stageDurations = stageDurationsFor(stages)
  const stageTimes = stages
    .flatMap((signal) => [new Date(signal.started_at).getTime(), signalEndTime(signal)])
    .filter((time) => Number.isFinite(time))
  const startedAt = stageTimes.length ? new Date(Math.min(...stageTimes)).toISOString() : duration?.started_at ?? null
  const endedAt = stageTimes.length ? new Date(Math.max(...stageTimes)).toISOString() : duration?.ended_at ?? duration?.started_at ?? null

  const asleepFromStages = (
    (stageDurations.deep ?? 0)
    + (stageDurations.rem ?? 0)
    + (stageDurations.core ?? 0)
    + (stageDurations.asleep ?? 0)
  )
  const asleepHours = typeof duration?.value_numeric === 'number'
    ? Number(duration.value_numeric)
    : asleepFromStages > 0
      ? asleepFromStages
      : null
  const spanHours = startedAt && endedAt
    ? Math.max(0, (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 3600000)
    : null
  const inBedHours = spanHours && asleepHours
    ? Math.max(spanHours, asleepHours)
    : spanHours ?? asleepHours
  const efficiency = inBedHours && asleepHours
    ? clamp((asleepHours / inBedHours) * 100, 0, 100)
    : null
  const score = sleepScore(asleepHours, efficiency, stageDurations)

  return {
    key,
    asleepHours,
    inBedHours,
    efficiency,
    bedtime: startedAt,
    wakeTime: endedAt,
    remHours: numericOrNull(stageDurations.rem),
    deepHours: numericOrNull(stageDurations.deep),
    coreHours: numericOrNull(stageDurations.core),
    awakeHours: numericOrNull(stageDurations.awake),
    unspecifiedHours: numericOrNull(stageDurations.asleep),
    score,
    scoreLabel: sleepScoreLabel(score, asleepHours),
  }
}

function stageDurationsFor(stages: HealthSignal[]): Partial<Record<StageKey, number>> {
  const result: Partial<Record<StageKey, number>> = {}

  for (const signal of stages) {
    const key = sleepStageKey(signal.value_numeric)
    if (!key) continue
    result[key] = (result[key] ?? 0) + signalDurationHours(signal)
  }

  return result
}

function sleepStageKey(value: number | null): StageKey | null {
  switch (Number(value)) {
    case 0: return 'inBed'
    case 1: return 'asleep'
    case 2: return 'awake'
    case 3: return 'core'
    case 4: return 'deep'
    case 5: return 'rem'
    default: return null
  }
}

function sleepScore(
  asleepHours: number | null,
  efficiency: number | null,
  stages: Partial<Record<StageKey, number>>,
): number | null {
  if (typeof asleepHours !== 'number') return null

  const durationComponent = clamp((asleepHours - 4.5) / 3, 0, 1) * 60
  const efficiencyComponent = typeof efficiency === 'number'
    ? clamp((efficiency - 80) / 15, 0, 1) * 20
    : 10
  const remDeepHours = (stages.rem ?? 0) + (stages.deep ?? 0)
  const stageComponent = remDeepHours > 0 && asleepHours > 0
    ? clamp((remDeepHours / asleepHours) / 0.33, 0, 1) * 20
    : 10

  const score = Math.round(durationComponent + efficiencyComponent + stageComponent)

  if (asleepHours < 6) return Math.min(score, 64)
  if (asleepHours < 7) return Math.min(score, 74)
  return score
}

function sleepScoreLabel(score: number | null, asleepHours: number | null): string {
  if (score === null) return 'Sem dado'
  if (typeof asleepHours === 'number' && asleepHours < 6) return 'Curta'
  if (score >= 82) return 'Alta'
  if (score >= 65) return 'Ok'
  return 'Baixa'
}

function vitalRows(signals: HealthSignal[]): Array<{ label: string; value: string; date: string }> {
  return [
    vitalMetric(signals, 'HRV', ['hrv_ms']),
    vitalMetric(signals, 'FC repouso', ['resting_heart_rate_bpm'], ' bpm'),
    vitalMetric(signals, 'Respiração', ['respiratory_rate'], ' resp/min'),
    vitalMetric(signals, 'Temperatura pulso', ['wrist_temperature']),
  ].filter((item): item is { label: string; value: string; date: string } => Boolean(item))
}

function vitalMetric(signals: HealthSignal[], label: string, signalTypes: string[], unitOverride?: string) {
  const match = signals
    .filter((signal) => signalTypes.includes(signal.signal_type) && typeof signal.value_numeric === 'number')
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0]
  if (!match) return null
  return {
    label,
    value: formatNumeric(Number(match.value_numeric), match.unit, unitOverride),
    date: match.started_at,
  }
}

function bedtimeConsistencyMinutes(nights: SleepNight[]): number | null {
  const minutes = nights
    .map((night) => night.bedtime ? clockMinuteForSleep(night.bedtime) : null)
    .filter((value): value is number => typeof value === 'number')
  if (minutes.length < 3) return null
  const baseline = median(minutes)
  return average(minutes.map((value) => Math.abs(value - baseline)))
}

function clockMinuteForSleep(iso: string): number {
  const date = new Date(iso)
  const minute = date.getHours() * 60 + date.getMinutes()
  return minute < 12 * 60 ? minute + 24 * 60 : minute
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
    if (!existing || signalEndTime(signal) >= signalEndTime(existing)) {
      byClientId.set(signal.client_id, signal)
    }
  }
  return [...byClientId.values()].sort((a, b) => signalEndTime(b) - signalEndTime(a))
}

function signalEndTime(signal: HealthSignal): number {
  return new Date(signal.ended_at ?? signal.started_at).getTime()
}

function signalDurationHours(signal: HealthSignal): number {
  const started = new Date(signal.started_at).getTime()
  const ended = signalEndTime(signal)
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) return 0
  return (ended - started) / 3600000
}

function numericOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && value > 0 ? value : null
}

function formatHoursMetric(hours?: number | null): string {
  if (typeof hours !== 'number') return 'Sem dado'
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h${String(m).padStart(2, '0')}`
}

function formatDebt(hours: number | null): string {
  if (typeof hours !== 'number') return 'Sem dado'
  if (hours < 0.25) return 'Sem débito'
  return formatHoursMetric(hours)
}

function formatPercentMetric(value?: number | null): string {
  if (typeof value !== 'number') return 'Sem dado'
  return `${Math.round(value)}%`
}

function formatConsistency(minutes: number | null): string {
  if (typeof minutes !== 'number') return 'Sem dado'
  if (minutes <= 20) return 'Estável'
  if (minutes <= 45) return `±${Math.round(minutes)}min`
  return `Irregular · ±${Math.round(minutes)}min`
}

function formatNumeric(value: number, unit?: string | null, unitOverride?: string): string {
  const formatted = Math.abs(value) >= 100
    ? Math.round(value).toLocaleString('pt-BR')
    : Number.isInteger(value)
      ? String(value)
      : value.toFixed(1).replace('.', ',')
  const suffix = unitOverride ?? cleanUnit(unit)
  return suffix ? `${formatted}${suffix}` : formatted
}

function cleanUnit(unit?: string | null): string {
  if (!unit || unit === 'count') return ''
  if (unit === 'ms') return 'ms'
  if (unit === 'bpm' || unit === 'count/min') return ' bpm'
  if (unit === 'count/s') return ' resp/s'
  if (unit === 'degC') return ' degC'
  return ` ${unit}`
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date(iso))
}

function localDateKey(iso: string): string {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function BackArrow({ color }: { color: string }) {
  return (
    <View style={{ width: 18, height: 18, transform: [{ rotate: '45deg' }] }}>
      <View style={{ position: 'absolute', left: 2, top: 8, width: 14, height: 2, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 2, top: 2, width: 2, height: 14, backgroundColor: color }} />
    </View>
  )
}

const styles = StyleSheet.create({
  head: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    marginBottom: 24,
  },
  tileGrid: {
    gap: 12,
  },
  tileRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 118,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 18,
    justifyContent: 'center',
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
  panel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  metricRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  timelineBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  timelineTrack: {
    height: 18,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  legendRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  trendBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 8,
  },
  trendBars: {
    height: 86,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  trendColumn: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  trendBar: {
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    minHeight: 10,
  },
})
