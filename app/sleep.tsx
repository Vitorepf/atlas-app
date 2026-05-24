import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { SectionHeader } from '../components/SectionHeader'
import { Masthead, EditorialDateline } from '../components/editorial'
import { PressableTextScale } from '../components/atlas-ui/PressableScale'
import { editorialDateLine } from '../lib/folio'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import {
  formatRelativeSync,
  latestCheckin,
  useAtlasStore,
  visibleDigitalActivitySnapshots,
  visibleHealthSnapshots,
  type QueuedPassiveSignal,
} from '../lib/atlasStore'
import type { AtlasHealthSnapshot, AtlasPassiveSignal } from '../lib/api/client'
import { buildReadinessV1, type ReadinessV1Model } from '../lib/readiness'
import { sleepDeficitHours, type SleepTargetEvidence } from '../lib/sleepTarget'
import { analyzeSleepDays, type DailySleepAnalysis, type SleepEpisodeAnalysis } from '../lib/sleepAnalysis'
import { sleepStressForDate } from '../lib/sleepPhysiology'
import {
  aggregateSleepTimelineSegments,
  buildSleepPlanner,
  sleepInsightItems,
  sleepTimelineSegments,
  type SleepPlannerOutput,
  type SleepTimelineSegment,
  type SleepTimelineStage,
} from '../lib/sleepOperational'
import { isMainSleepCandidate } from '../lib/sleepValidity'

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
  inBedStartTime: string | null
  remHours: number | null
  deepHours: number | null
  coreHours: number | null
  awakeHours: number | null
  unspecifiedHours: number | null
  latencyMinutes: number | null
  awakeEpisodeCount: number | null
  disturbanceCount: number | null
  sleepCycleCount: number | null
  stageCoverage: number | null
  dataQuality: number
  dataQualityLabel: 'alta' | 'parcial' | 'baixa'
  napHours: number | null
  napCount: number
  sleepHeartRateAverageBpm: number | null
  sleepHeartRateMinBpm: number | null
  sleepHeartRateSampleCount: number | null
  sleepStressScore: number | null
  sleepStressConfidence: number
  sleepStressLabel: 'baixo' | 'moderado' | 'alto' | 'sem dado'
  captureStatus: 'complete' | 'partial' | 'duration_only'
  source: 'stages' | 'duration_only' | 'snapshot'
  episodeKey?: string | null
  episodeLabel?: string | null
  episodes?: SleepNight[]
}

interface SleepModel {
  night: SleepNight | null
  trendNights: SleepTrendNight[]
  latestSnapshot: AtlasHealthSnapshot | null
  sleepScore: number | null
  sleepScoreLabel: string
  sleepTargetHours: number
  sleepDebtHours: number | null
  sleepNightDebtHours: number | null
  average7dHours: number | null
  observedNights: number | null
  timelineSegments: SleepTimelineSegment[]
  timelineSource: 'real' | 'aggregate' | 'empty'
  planner: SleepPlannerOutput | null
  insightRows: SleepMetricRowModel[]
  plannerRows: SleepMetricRowModel[]
  summaryRows: SleepMetricRowModel[]
  architectureRows: SleepMetricRowModel[]
  physiologyRows: SleepMetricRowModel[]
  regularityRows: SleepMetricRowModel[]
  methodRows: SleepMetricRowModel[]
  reviewRows: SleepMetricRowModel[]
  episodeOptions: SleepEpisodeOption[]
  manualSelectionActive: boolean
}

interface SleepTrendNight {
  key: string
  asleepHours: number | null
}

interface SleepMetricRowModel {
  label: string
  value: string
  detail?: string | null
  target?: string | null
  info?: SleepMetricInfo | null
}

interface SleepMetricInfo {
  category: string
  what: string
  why: string
  calculation: string
  inputs: string[]
  source: string
  quality: string
  ideal: string
  precision: string
  caveats: string[]
}

interface SleepEpisodeOption {
  key: string
  label: string
  detail: string
}

interface MetricValue {
  value: number | null
  unit?: string | null
  text?: string | null
  date?: string | null
  confidence?: number | null
  qualityLabel?: string | null
}

export default function SleepScreen() {
  const c = usePalette()
  const router = useRouter()
  const [selectedEpisodeKey, setSelectedEpisodeKey] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<SleepMetricRowModel | null>(null)
  const passiveSignals = useAtlasStore((s) => s.passiveSignals)
  const queuedPassiveSignals = useAtlasStore((s) => s.queuedPassiveSignals)
  const checkins = useAtlasStore((s) => s.checkins)
  const queuedCheckins = useAtlasStore((s) => s.queuedCheckins)
  const storedDigitalActivitySnapshots = useAtlasStore((s) => s.digitalActivitySnapshots)
  const queuedDigitalActivitySnapshots = useAtlasStore((s) => s.queuedDigitalActivitySnapshots)
  const healthSnapshots = useAtlasStore((s) => s.healthSnapshots)
  const queuedHealthSnapshots = useAtlasStore((s) => s.queuedHealthSnapshots)
  const healthKit = useAtlasStore((s) => s.healthKit)

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
  const checkinsForReadiness = useMemo(
    () => (latestState ? [latestState, ...checkins] : checkins),
    [checkins, latestState],
  )

  const digitalActivitySnapshots = useMemo(
    () => visibleDigitalActivitySnapshots({
      digitalActivitySnapshots: storedDigitalActivitySnapshots,
      queuedDigitalActivitySnapshots,
    }),
    [queuedDigitalActivitySnapshots, storedDigitalActivitySnapshots],
  )

  const visibleSnapshots = useMemo(
    () => visibleHealthSnapshots({ healthSnapshots, queuedHealthSnapshots }),
    [healthSnapshots, queuedHealthSnapshots],
  )

  const readiness = useMemo(() => buildReadinessV1({
    healthSignals,
    allSignals,
    digitalActivitySnapshots,
    latestCheckin: latestState,
    checkins: checkinsForReadiness,
  }), [allSignals, checkinsForReadiness, digitalActivitySnapshots, healthSignals, latestState])

  const model = useMemo(
    () => buildSleepModel(healthSignals, visibleSnapshots, readiness, selectedEpisodeKey),
    [healthSignals, readiness, selectedEpisodeKey, visibleSnapshots],
  )
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

      {/* Masthead canon · SONO + dateline com última coleta wake. */}
      <PressableTextScale onPress={() => router.back()} hitSlop={8} accessibilityLabel="voltar">
        <Masthead title="SONO" folio={null} />
      </PressableTextScale>
      <EditorialDateline
        date={night?.wakeTime ? formatLongDate(night.wakeTime) : editorialDateLine()}
        edition={night?.wakeTime ? 'noite registrada · saúde apple' : 'sem noite registrada'}
      />

      <View style={styles.tileGrid}>
        <View style={styles.tileRow}>
          <SleepTile
            label="Duração"
            value={formatHoursMetric(night?.asleepHours)}
            subvalue={`alvo ${formatHoursMetric(model.sleepTargetHours)}`}
            onLongPress={() => setSelectedMetric(displaySleepRow('Duração', formatHoursMetric(night?.asleepHours), `alvo ${formatHoursMetric(model.sleepTargetHours)}`))}
          />
          <SleepTile
            label="Eficiência"
            value={formatPercentMetric(night?.efficiency)}
            subvalue="ideal >= 90%"
            onLongPress={() => setSelectedMetric(displaySleepRow('Eficiência', formatPercentMetric(night?.efficiency), 'ideal >= 90%'))}
          />
        </View>
        <View style={styles.tileRow}>
          <SleepTile
            label="Score da noite"
            value={formatPercentMetric(model.sleepScore)}
            subvalue={model.sleepScoreLabel}
            onLongPress={() => setSelectedMetric(displaySleepRow('Score da noite', formatPercentMetric(model.sleepScore), 'ideal >= 85%'))}
          />
          <SleepTile
            label="Déficit observado 7d"
            value={formatDebt(model.sleepDebtHours)}
            subvalue="ideal 0min"
            onLongPress={() => setSelectedMetric(displaySleepRow('Déficit observado 7d', formatDebt(model.sleepDebtHours), 'ideal 0min'))}
          />
        </View>
      </View>

      <SectionHeader label="Por que" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        {model.insightRows.map((item, index) => (
          <SleepMetricRow
            item={item}
            key={item.label}
            last={index === model.insightRows.length - 1}
            onLongPress={setSelectedMetric}
          />
        ))}
      </View>

      <SectionHeader label="Resumo" />
      <View style={[styles.summaryPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
        {model.summaryRows.map((item, index) => (
          <SleepMetricRow
            item={item}
            key={item.label}
            last={index === model.summaryRows.length - 1}
            onLongPress={setSelectedMetric}
          />
        ))}
      </View>

      <SectionHeader label="Arquitetura" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        <SleepStageTimeline
          segments={model.timelineSegments}
          source={model.timelineSource}
          start={night?.inBedStartTime ?? night?.bedtime ?? null}
          end={night?.wakeTime ?? null}
        />
        {model.architectureRows.map((item, index) => (
          <SleepMetricRow
            item={item}
            key={item.label}
            last={index === model.architectureRows.length - 1}
            onLongPress={setSelectedMetric}
          />
        ))}
      </View>

      <SectionHeader label="Tendência" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        <TrendBars nights={model.trendNights} />
        <SleepMetricRow label="Média 7 dias" value={formatHoursMetric(model.average7dHours)} target={`alvo ${formatHoursMetric(model.sleepTargetHours)}`} onLongPress={setSelectedMetric} />
        <SleepMetricRow label="Déficit da noite" value={formatDebt(model.sleepNightDebtHours)} target="ideal 0min" onLongPress={setSelectedMetric} />
        <SleepMetricRow label="Déficit observado 7d" value={formatDebt(model.sleepDebtHours)} target="ideal 0min" onLongPress={setSelectedMetric} />
        <SleepMetricRow label="Noites analisadas" value={model.observedNights === null ? 'Sem dado' : `${model.observedNights}/7 noites`} target="ideal 7/7" last onLongPress={setSelectedMetric} />
      </View>

      <SectionHeader label="Planner" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        {model.plannerRows.map((item, index) => (
          <SleepMetricRow
            item={item}
            key={item.label}
            last={index === model.plannerRows.length - 1}
            onLongPress={setSelectedMetric}
          />
        ))}
      </View>

      <SectionHeader label="Fisiologia" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        {model.physiologyRows.map((item, index) => (
          <SleepMetricRow
            item={item}
            key={item.label}
            last={index === model.physiologyRows.length - 1}
            onLongPress={setSelectedMetric}
          />
        ))}
      </View>

      <SectionHeader label="Regularidade" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        {model.regularityRows.map((item, index) => (
          <SleepMetricRow
            item={item}
            key={item.label}
            last={index === model.regularityRows.length - 1}
            onLongPress={setSelectedMetric}
          />
        ))}
      </View>

      <SectionHeader label="Método" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        {model.methodRows.map((item, index) => (
          <SleepMetricRow
            item={item}
            key={item.label}
            last={index === model.methodRows.length - 1}
            onLongPress={setSelectedMetric}
          />
        ))}
      </View>

      <SectionHeader label="Revisão" />
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        {model.reviewRows.map((item, index) => (
          <SleepMetricRow
            item={item}
            key={item.label}
            last={false}
            onLongPress={setSelectedMetric}
          />
        ))}
        <SleepEpisodeSelector
          options={model.episodeOptions}
          selectedKey={model.manualSelectionActive ? selectedEpisodeKey : null}
          onSelect={setSelectedEpisodeKey}
        />
      </View>
      <SleepMetricDetailSheet
        item={selectedMetric}
        onClose={() => setSelectedMetric(null)}
      />
    </Screen>
  )
}

function SleepTile({
  label,
  value,
  subvalue,
  onLongPress,
}: {
  label: string
  value: string
  subvalue?: string
  onLongPress?: () => void
}) {
  const c = usePalette()
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      disabled={!onLongPress}
      style={({ pressed }) => [
        styles.tile,
        { backgroundColor: pressed ? c.premium : c.surface, borderColor: c.border },
      ]}
    >
      <Label>{label}</Label>
      <Frau size={24} lineHeight={30} letterSpacing={-0.48} color={c.ink} style={{ marginTop: 10 }}>
        {value}
      </Frau>
      {subvalue ? (
        <Mono size={10.5} letterSpacing={0.21} color={c.ink2} style={{ marginTop: 4 }}>
          {subvalue}
        </Mono>
      ) : null}
    </Pressable>
  )
}

function SleepMetricRow({
  item,
  label,
  value,
  detail,
  target,
  last,
  onLongPress,
}: {
  item?: SleepMetricRowModel
  label?: string
  value?: string
  detail?: string
  target?: string
  last?: boolean
  onLongPress?: (item: SleepMetricRowModel) => void
}) {
  const c = usePalette()
  const row = item ?? displaySleepRow(label ?? '', value ?? 'Sem dado', target, detail)
  const enriched = row.info ? row : { ...row, info: sleepMetricInfo(row.label, row.target) }
  const open = onLongPress ? () => onLongPress(enriched) : undefined
  return (
    <Pressable
      onLongPress={open}
      delayLongPress={300}
      disabled={!open}
      style={({ pressed }) => [
        styles.metricRow,
        !last && { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
        pressed && { backgroundColor: c.premium },
      ]}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Sans size={15} color={c.ink}>{row.label}</Sans>
        {row.detail ? (
          <Mono size={10.5} letterSpacing={0.21} color={c.ink2} style={{ marginTop: 3 }}>
            {row.detail}
          </Mono>
        ) : null}
      </View>
      <View style={styles.metricValueBlock}>
        <Mono size={13} letterSpacing={0.26} color={row.value === 'Sem dado' ? c.ink3 : c.ink} align="right">
          {row.value}
        </Mono>
        {row.target ? (
          <Mono size={10} letterSpacing={0.2} color={c.ink2} align="right" style={{ marginTop: 3 }}>
            {row.target}
          </Mono>
        ) : null}
      </View>
    </Pressable>
  )
}

function SleepMetricDetailSheet({
  item,
  onClose,
}: {
  item: SleepMetricRowModel | null
  onClose: () => void
}) {
  const c = usePalette()
  const info = item ? item.info ?? sleepMetricInfo(item.label, item.target) : null

  return (
    <Modal
      transparent
      visible={Boolean(item && info)}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.detailModal}>
        <Pressable style={styles.detailScrim} onPress={onClose} />
        {item && info ? (
          <View style={[styles.detailSheet, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={[styles.detailHandle, { backgroundColor: c.border }]} />
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.detailContent}
            >
              <View style={styles.detailHeader}>
                <View style={styles.detailTitleBlock}>
                  <Label>{info.category}</Label>
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
                <DetailMetric label="Valor" value={item.value} />
                <DetailMetric label="Ideal" value={item.target ?? info.ideal} />
                <DetailMetric label="Dado" value={item.detail ?? 'Sem metadado'} last />
              </View>

              <DetailBlock title="O que é" text={info.what} />
              <DetailBlock title="Por que importa" text={info.why} />
              <DetailBlock title="Como calcula" text={info.calculation} />
              <DetailList title="Métricas usadas" items={info.inputs} />
              <DetailBlock title="Qualidade do dado" text={info.quality} />
              <DetailBlock title="Faixa ideal" text={item.target ?? info.ideal} />
              <DetailBlock title="Fonte" text={info.source} />
              <DetailBlock title="Precisão" text={info.precision} />
              <DetailList title="Limites" items={info.caveats} />
            </ScrollView>
          </View>
        ) : null}
      </View>
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
      <Mono size={12} letterSpacing={0.12} color={c.ink} style={{ marginTop: 6 }}>
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

function SleepStageTimeline({
  segments,
  source,
  start,
  end,
}: {
  segments: SleepTimelineSegment[]
  source: SleepModel['timelineSource']
  start?: string | null
  end?: string | null
}) {
  const c = usePalette()
  const total = segments.reduce((sum, segment) => sum + segment.hours, 0)
  const legendStages = uniqueStages(segments)
  const sourceLabel = source === 'real' ? 'linha real por estágio' : source === 'aggregate' ? 'agregado da noite' : 'sem timeline'

  return (
    <View style={styles.timelineBlock}>
      <View style={styles.timelineHeader}>
        <Mono size={10} letterSpacing={0.2} color={c.ink2}>
          {sourceLabel}
        </Mono>
        <Mono size={10} letterSpacing={0.2} color={c.ink2}>
          {start && end ? `${formatTime(start)}-${formatTime(end)}` : 'sem janela'}
        </Mono>
      </View>
      <View style={[styles.timelineTrack, { backgroundColor: c.premium }]}>
        {total > 0 ? segments.map((segment, index) => (
          <View
            key={`${segment.stage}-${segment.startedAt}-${index}`}
            style={{
              flex: Math.max(0.05, segment.hours / total),
              backgroundColor: stageColor(segment.stage, c),
            }}
          />
        )) : (
          <View style={{ flex: 1, backgroundColor: c.ink3, opacity: 0.35 }} />
        )}
      </View>
      <View style={styles.legendRow}>
        {legendStages.length > 0 ? legendStages.map((stage) => (
          <View key={stage} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: stageColor(stage, c) }]} />
            <Mono size={9.5} letterSpacing={0.1} color={c.ink2}>
              {stageLabel(stage)}
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

function SleepEpisodeSelector({
  options,
  selectedKey,
  onSelect,
}: {
  options: SleepEpisodeOption[]
  selectedKey: string | null
  onSelect: (key: string | null) => void
}) {
  const c = usePalette()
  const selectedOption = selectedKey ? options.find((option) => option.key === selectedKey) : null
  return (
    <View style={styles.reviewSelector}>
      <Mono size={10.5} letterSpacing={0.21} color={c.ink2}>
        Ajuste local da visualização
      </Mono>
      <View style={styles.reviewChips}>
        <Pressable
          onPress={() => onSelect(null)}
          style={({ pressed }) => [
            styles.reviewChip,
            {
              borderColor: selectedKey === null ? c.prussian : c.border,
              backgroundColor: selectedKey === null ? c.prussian : c.surface,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Mono size={10.5} letterSpacing={0.12} color={selectedKey === null ? c.onInk : c.ink}>
            Oficial
          </Mono>
        </Pressable>
        {options.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => onSelect(option.key)}
            style={({ pressed }) => [
              styles.reviewChip,
              {
                borderColor: selectedKey === option.key ? c.prussian : c.border,
                backgroundColor: selectedKey === option.key ? c.prussian : c.surface,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Mono size={10.5} letterSpacing={0.12} color={selectedKey === option.key ? c.onInk : c.ink}>
              {option.label}
            </Mono>
          </Pressable>
        ))}
      </View>
      {selectedKey ? (
        <Mono size={10} letterSpacing={0.2} color={c.ink2} style={{ marginTop: 8 }}>
          {selectedOption?.detail ?? 'episódio selecionado'} · ajuste seguro, sem alterar HealthKit ou snapshot salvo
        </Mono>
      ) : null}
    </View>
  )
}

function TrendBars({ nights }: { nights: SleepTrendNight[] }) {
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

function buildSleepModel(
  signals: HealthSignal[],
  snapshots: AtlasHealthSnapshot[],
  readiness: ReadinessV1Model,
  selectedEpisodeKey: string | null,
): SleepModel {
  const nights = buildSleepNights(signals)
  const latestSnapshot = latestSleepSnapshot(snapshots)
  const signalNight = matchingSignalNight(latestSnapshot, nights) ?? nights[0] ?? null
  const episodeOptions = sleepEpisodeOptions(nights)
  const selectedEpisode = selectedEpisodeKey
    ? sleepEpisodeByKey(nights, selectedEpisodeKey)
    : null
  const manualSelectionActive = Boolean(selectedEpisode)
  const officialNight = latestSnapshot ? sleepNightFromSnapshot(latestSnapshot, signalNight) : signalNight
  const night = selectedEpisode ?? officialNight
  const sleepSnapshot = manualSelectionActive ? null : latestSnapshot
  const trendNights = sleepTrendNights(snapshots, nights)
  const recent = trendNights.filter((item) => typeof item.asleepHours === 'number').slice(0, 7)
  const average7dHours = recent.length
    ? average(recent.map((item) => Number(item.asleepHours)))
    : null
  const sleepTargetHours = readiness.sleepTargetHours
  const sleepScore = snapshotNumber(latestSnapshot?.sleep_score) ?? readiness.sleep.score
  const sleepDate = sleepSnapshot ? snapshotSleepDate(sleepSnapshot) : night?.wakeTime ?? readiness.computedAt
  const sleepNightDebtHours = snapshotSleepNumber(sleepSnapshot, 'sleep_debt_hours')
    ?? (typeof night?.asleepHours === 'number' ? sleepDeficitHours(night.asleepHours, sleepTargetHours) : null)
  const observedNights = readiness.axisQuality.sleep.baselineDays
  const sleepTargetBest = readiness.sleepTargetEvidence.bestRange
  const sleepTargetInBedHours = sleepTargetHours / 0.9
  const remHoursReference = sleepStageReference(snapshots, 'rem_hours', sleepTargetHours, 0.2, 0.25, 'hours')
  const remPercentReference = sleepStageReference(snapshots, 'rem_hours', sleepTargetHours, 0.2, 0.25, 'percent')
  const deepHoursReference = sleepStageReference(snapshots, 'deep_hours', sleepTargetHours, 0.13, 0.23, 'hours')
  const deepPercentReference = sleepStageReference(snapshots, 'deep_hours', sleepTargetHours, 0.13, 0.23, 'percent')
  const coreHoursReference = sleepStageReference(snapshots, 'core_hours', sleepTargetHours, 0.45, 0.55, 'hours')
  const corePercentReference = sleepStageReference(snapshots, 'core_hours', sleepTargetHours, 0.45, 0.55, 'percent')
  const latestHrv = latestSignalMetric(signals, ['hrv_ms'], 'ms')
  const latestRestingHeartRate = latestSignalMetric(signals, ['resting_heart_rate_bpm'], 'bpm')
  const timelineReal = sleepTimelineSegments(signals, night?.inBedStartTime ?? night?.bedtime, night?.wakeTime)
  const timelineAggregate = aggregateSleepTimelineSegments({
    bedtime: night?.bedtime,
    wakeTime: night?.wakeTime,
    awakeHours: night?.awakeHours,
    remHours: night?.remHours,
    coreHours: night?.coreHours,
    deepHours: night?.deepHours,
    asleepHours: night?.unspecifiedHours,
  })
  const timelineSegments = timelineReal.length > 0 ? timelineReal : timelineAggregate
  const timelineSource: SleepModel['timelineSource'] = timelineReal.length > 0
    ? 'real'
    : timelineAggregate.length > 0
      ? 'aggregate'
      : 'empty'
  const planner = buildSleepPlanner({
    sleepNeedHours: sleepTargetHours,
    efficiencyPercent: night?.efficiency,
    latencyMinutes: night?.latencyMinutes,
    wakeAnchorIso: nextWakeAnchorIso(snapshots, night, readiness.computedAt),
    windDownMinutes: 45,
  })
  const insightRows = sleepInsightItems({
    durationHours: night?.asleepHours ?? null,
    targetHours: sleepTargetHours,
    sleepDebtHours: readiness.sleepDebtHours,
    efficiencyPercent: night?.efficiency ?? null,
    latencyMinutes: night?.latencyMinutes ?? null,
    awakeEpisodeCount: night?.awakeEpisodeCount ?? null,
    disturbanceCount: night?.disturbanceCount ?? null,
    sleepStressScore: snapshotSleepNumber(sleepSnapshot, 'sleep_stress_score') ?? night?.sleepStressScore ?? null,
    oxygenSaturationPercent: snapshotSleepNumber(sleepSnapshot, 'sleep_oxygen_saturation_percent'),
    dataQuality: night?.dataQuality ?? null,
    stageCoverage: night?.stageCoverage ?? null,
    regularityScore: snapshotSleepNumber(latestSnapshot, 'regularity_score'),
  }).map((item) => textRow(item.label, item.value, sleepDate, insightSeverityLabel(item.severity)))

  const summaryRows = [
    textRow('Hora de dormir', night?.bedtime ? formatTime(night.bedtime) : 'Sem dado', sleepDate),
    textRow('Hora de acordar', night?.wakeTime ? formatTime(night.wakeTime) : 'Sem dado', sleepDate),
    metricRow(sleepTargetRowLabel(readiness.sleepTargetEvidence), {
      value: sleepTargetHours,
      unit: 'h',
      date: readiness.computedAt,
    }, sleepTargetEvidenceSummary(readiness.sleepTargetEvidence)),
    metricRow('Latência', sleepPayloadMetric(sleepSnapshot, 'latency_minutes', 'min', night?.latencyMinutes, sleepDate), 'ideal <= 20min'),
    metricRow('Despertares', sleepPayloadMetric(sleepSnapshot, 'awake_episode_count', 'vezes', night?.awakeEpisodeCount, sleepDate), 'ideal 0-1'),
    metricRow('Distúrbios', sleepPayloadMetric(sleepSnapshot, 'disturbance_count', 'vezes', night?.disturbanceCount, sleepDate), 'ideal <= 8'),
    metricRow('Ciclos de sono', sleepPayloadMetric(sleepSnapshot, 'sleep_cycle_count', 'ciclos', night?.sleepCycleCount, sleepDate), 'ideal 4-6'),
    metricRow('Cochilos', sleepNapMetric(sleepSnapshot, night), 'separado da noite'),
  ]

  const architectureRows = [
    metricRow('Duração', sleepDurationMetric(sleepSnapshot, night?.asleepHours, sleepDate), `alvo ${formatHoursMetric(sleepTargetHours)}`),
    metricRow('Eficiência', sleepEfficiencyMetric(sleepSnapshot, night?.efficiency, sleepDate), 'ideal >= 90%'),
    metricRow('REM', sleepPayloadMetric(sleepSnapshot, 'rem_hours', 'h', night?.remHours, sleepDate), remHoursReference),
    metricRow('REM %', sleepStagePercentMetric(sleepSnapshot, 'rem_hours', night?.remHours, night?.asleepHours, sleepDate), remPercentReference),
    metricRow('Profundo', sleepPayloadMetric(sleepSnapshot, 'deep_hours', 'h', night?.deepHours, sleepDate), deepHoursReference),
    metricRow('Profundo %', sleepStagePercentMetric(sleepSnapshot, 'deep_hours', night?.deepHours, night?.asleepHours, sleepDate), deepPercentReference),
    metricRow('Core', sleepPayloadMetric(sleepSnapshot, 'core_hours', 'h', night?.coreHours, sleepDate), coreHoursReference),
    metricRow('Core %', sleepStagePercentMetric(sleepSnapshot, 'core_hours', night?.coreHours, night?.asleepHours, sleepDate), corePercentReference),
    metricRow('Acordado', sleepPayloadMetric(sleepSnapshot, 'awake_hours', 'h', night?.awakeHours, sleepDate), `ideal <= ${formatHoursMetric(sleepTargetInBedHours * 0.1)}`),
    metricRow('Vigília %', sleepAwakePercentMetric(sleepSnapshot, night, sleepDate), 'ideal <= 10%'),
    metricRow('Continuidade', sleepContinuityMetric(sleepSnapshot, night, sleepDate), 'ideal >= 90%'),
    metricRow('Na cama', sleepInBedMetric(sleepSnapshot, night, sleepDate), `ideal ~${formatHoursMetric(sleepTargetInBedHours)}`),
    metricRow('Cobertura de fases', sleepStageCoverageMetric(sleepSnapshot, night, sleepDate), 'ideal >= 85%'),
    metricRow('Qualidade dos dados', sleepDataQualityMetric(sleepSnapshot, night, sleepDate), 'ideal >= 75%'),
    metricRow('Status captura', sleepCaptureStatusMetric(sleepSnapshot, night, sleepDate), 'ideal completo'),
  ]

  const plannerRows = planner
    ? [
      textRow('Dormir hoje', formatTime(planner.bedtimeIso), planner.bedtimeIso, `acordar ${formatTime(planner.wakeTimeIso)}`),
      textRow('Desacelerar', formatTime(planner.windDownIso), planner.windDownIso, '45min antes'),
      metricRow('Sono necessário', { value: planner.sleepNeedHours, unit: 'h', date: readiness.computedAt }, sleepTargetEvidenceSummary(readiness.sleepTargetEvidence)),
      metricRow('Tempo na cama', { value: planner.timeInBedHours, unit: 'h', date: planner.bedtimeIso }, `eficiência ${Math.round(planner.efficiencyPercent)}%`),
      metricRow('Latência usada', { value: planner.latencyMinutes, unit: 'min', date: planner.bedtimeIso }, 'ajuste automático'),
    ]
    : [textRow('Planner', 'Sem dado', readiness.computedAt)]

  const physiologyRows = [
    metricRow('FC sono média', sleepPayloadMetric(sleepSnapshot, 'sleep_hr_avg_bpm', 'bpm', night?.sleepHeartRateAverageBpm, sleepDate), 'ideal <= seu normal'),
    metricRow('FC sono mínima', sleepPayloadMetric(sleepSnapshot, 'sleep_hr_min_bpm', 'bpm', night?.sleepHeartRateMinBpm, sleepDate), 'ideal estável'),
    metricRow('Amostras FC sono', sleepPayloadMetric(sleepSnapshot, 'sleep_hr_sample_count', 'count', night?.sleepHeartRateSampleCount, sleepDate), 'ideal >= 3'),
    metricRow('Stress sono', sleepStressMetric(sleepSnapshot, night, sleepDate), 'ideal >= 82%'),
    metricRow('HRV', latestHrv, 'ideal acima do seu normal'),
    metricRow('FC repouso', latestRestingHeartRate, 'ideal abaixo do seu normal'),
    metricRow('Respiração sono', sleepPayloadMetric(sleepSnapshot, 'sleep_respiratory_rate', 'resp/min', null, sleepDate), 'ideal estável'),
    metricRow('Oxigênio sono', sleepPayloadMetric(sleepSnapshot, 'sleep_oxygen_saturation_percent', '%', null, sleepDate), 'ideal >= 95%'),
    metricRow('Temp. pulso sono', sleepPayloadMetric(sleepSnapshot, 'sleep_wrist_temperature_c', 'degC', null, sleepDate), 'ideal estável'),
    metricRow('Distúrbios resp.', sleepPayloadMetric(sleepSnapshot, 'sleep_breathing_disturbances_count', 'count', null, sleepDate), 'ideal baixo'),
  ]

  const regularityRows = [
    metricRow('Regularidade', sleepPayloadMetric(latestSnapshot, 'regularity_score', '%', null, sleepDate), 'ideal >= 85%'),
    metricRow('Dormir ±', sleepPayloadMetric(latestSnapshot, 'bedtime_regularity_minutes', 'min', null, sleepDate), 'ideal <= 30min'),
    metricRow('Acordar ±', sleepPayloadMetric(latestSnapshot, 'wake_regularity_minutes', 'min', null, sleepDate), 'ideal <= 30min'),
    metricRow('Meio do sono ±', sleepPayloadMetric(latestSnapshot, 'midpoint_regularity_minutes', 'min', null, sleepDate), 'ideal <= 30min'),
    metricRow('Jetlag social', sleepPayloadMetric(latestSnapshot, 'social_jetlag_minutes', 'min', null, sleepDate), 'ideal <= 60min'),
  ]

  const methodRows = [
    metricRow('Alvo: evidência', sleepTargetEvidenceMetric(readiness.sleepTargetEvidence, readiness.computedAt)),
    textRow('Alvo: faixa', sleepTargetBest ? `${sleepTargetBest.rangeLabel} · ${sleepTargetBest.goodNights}/${sleepTargetBest.nights} noites boas` : 'Sem faixa pessoal ainda', readiness.computedAt),
    textRow('Modelo de sono', sleepPayloadText(latestSnapshot, 'model_version') ?? 'sleep_operational_v4', sleepDate),
    metricRow('Qualidade eixo sono', {
      value: Math.round(readiness.axisQuality.sleep.coverage * 100),
      unit: '%',
      date: readiness.computedAt,
      qualityLabel: qualityStatusLabel(readiness.axisQuality.sleep.status, readiness.axisQuality.sleep.coverage),
    }),
  ]

  const reviewRows = [
    textRow('Fonte oficial', latestSnapshot ? 'Snapshot diário' : night?.source === 'stages' ? 'HealthKit estágios' : night?.source === 'duration_only' ? 'HealthKit duração' : 'Sem dado', sleepDate),
    textRow('Janela analisada', night?.bedtime && night?.wakeTime ? `${formatTime(night.bedtime)}-${formatTime(night.wakeTime)}` : 'Sem dado', sleepDate),
    metricRow('Episódios detectados', { value: episodeOptions.length, unit: 'count', date: sleepDate }, episodeOptions.length > 1 ? 'revisável' : 'estável'),
    textRow('Ajuste ativo', manualSelectionActive ? selectedEpisode?.episodeLabel ?? 'Episódio manual' : 'Oficial', sleepDate, manualSelectionActive ? 'local' : 'snapshot'),
  ]

  return {
    night,
    trendNights,
    latestSnapshot,
    sleepScore,
    sleepScoreLabel: sleepScore === null ? 'Sem dado' : readiness.sleep.label || axisLabel(sleepScore),
    sleepTargetHours,
    sleepDebtHours: readiness.sleepDebtHours,
    sleepNightDebtHours,
    average7dHours,
    observedNights,
    timelineSegments,
    timelineSource,
    planner,
    insightRows,
    plannerRows,
    summaryRows,
    architectureRows,
    physiologyRows,
    regularityRows,
    methodRows,
    reviewRows,
    episodeOptions,
    manualSelectionActive,
  }
}

function latestSleepSnapshot(snapshots: AtlasHealthSnapshot[]): AtlasHealthSnapshot | null {
  return snapshots
    .filter((snapshot) => !snapshot.deleted_at && hasValidSleepSnapshotData(snapshot))
    .sort((a, b) => snapshotSleepSortTime(b) - snapshotSleepSortTime(a))[0] ?? null
}

function hasValidSleepSnapshotData(snapshot: AtlasHealthSnapshot): boolean {
  const durationHours = snapshotSleepNumber(snapshot, 'duration_hours') ?? snapshot.sleep_duration_hours ?? null
  return isMainSleepCandidate({
    asleepHours: durationHours,
    bedtime: sleepPayloadText(snapshot, 'bedtime'),
    wakeTime: sleepPayloadText(snapshot, 'wake_time'),
  })
}

function snapshotSleepSortTime(snapshot: AtlasHealthSnapshot): number {
  const sleep = isRecord(snapshot.sleep) ? snapshot.sleep : null
  const wakeTime = typeof sleep?.wake_time === 'string' ? sleep.wake_time : null
  const date = wakeTime ?? snapshot.computed_at ?? snapshot.snapshot_date
  const time = new Date(date).getTime()
  if (Number.isFinite(time)) return time
  return new Date(snapshotDateKey(snapshot.snapshot_date)).getTime()
}

function matchingSignalNight(snapshot: AtlasHealthSnapshot | null, nights: SleepNight[]): SleepNight | null {
  if (!snapshot) return null
  const key = snapshotDateKey(snapshot.snapshot_date)
  return nights.find((night) => night.key === key) ?? null
}

function sleepNightFromSnapshot(snapshot: AtlasHealthSnapshot, fallback: SleepNight | null): SleepNight {
  const sleep = isRecord(snapshot.sleep) ? snapshot.sleep : {}
  const rawDataQualityLabel = typeof sleep.sleep_data_quality_label === 'string' ? sleep.sleep_data_quality_label : null
  const rawStressLabel = typeof sleep.sleep_stress_label === 'string' ? sleep.sleep_stress_label : null
  const dataQualityLabel = rawDataQualityLabel ? sleepQualityLabel(rawDataQualityLabel) : fallback?.dataQualityLabel ?? 'parcial'
  const stressLabel = rawStressLabel ? sleepStressLabel(rawStressLabel) : fallback?.sleepStressLabel ?? 'sem dado'

  return {
    key: snapshotDateKey(snapshot.snapshot_date),
    asleepHours: snapshotSleepNumber(snapshot, 'duration_hours') ?? snapshot.sleep_duration_hours ?? fallback?.asleepHours ?? null,
    inBedHours: snapshotSleepInBedHours(snapshot) ?? fallback?.inBedHours ?? null,
    efficiency: snapshotSleepNumber(snapshot, 'efficiency') ?? snapshot.sleep_efficiency ?? fallback?.efficiency ?? null,
    bedtime: sleepPayloadText(snapshot, 'bedtime') ?? fallback?.bedtime ?? null,
    wakeTime: sleepPayloadText(snapshot, 'wake_time') ?? fallback?.wakeTime ?? null,
    inBedStartTime: sleepPayloadText(snapshot, 'in_bed_start_time') ?? fallback?.inBedStartTime ?? null,
    remHours: snapshotSleepNumber(snapshot, 'rem_hours') ?? fallback?.remHours ?? null,
    deepHours: snapshotSleepNumber(snapshot, 'deep_hours') ?? fallback?.deepHours ?? null,
    coreHours: snapshotSleepNumber(snapshot, 'core_hours') ?? fallback?.coreHours ?? null,
    awakeHours: snapshotSleepNumber(snapshot, 'awake_hours') ?? fallback?.awakeHours ?? null,
    unspecifiedHours: snapshotSleepNumber(snapshot, 'unspecified_hours') ?? fallback?.unspecifiedHours ?? null,
    latencyMinutes: snapshotSleepNumber(snapshot, 'latency_minutes') ?? fallback?.latencyMinutes ?? null,
    awakeEpisodeCount: snapshotSleepNumber(snapshot, 'awake_episode_count') ?? fallback?.awakeEpisodeCount ?? null,
    disturbanceCount: snapshotSleepNumber(snapshot, 'disturbance_count') ?? fallback?.disturbanceCount ?? null,
    sleepCycleCount: snapshotSleepNumber(snapshot, 'sleep_cycle_count') ?? fallback?.sleepCycleCount ?? null,
    stageCoverage: snapshotSleepNumber(snapshot, 'stage_coverage') ?? fallback?.stageCoverage ?? null,
    dataQuality: snapshotSleepNumber(snapshot, 'sleep_data_quality') ?? fallback?.dataQuality ?? 0,
    dataQualityLabel,
    napHours: snapshotSleepNumber(snapshot, 'nap_hours') ?? fallback?.napHours ?? null,
    napCount: snapshotSleepNumber(snapshot, 'nap_count') ?? fallback?.napCount ?? 0,
    sleepHeartRateAverageBpm: snapshotSleepNumber(snapshot, 'sleep_hr_avg_bpm') ?? fallback?.sleepHeartRateAverageBpm ?? null,
    sleepHeartRateMinBpm: snapshotSleepNumber(snapshot, 'sleep_hr_min_bpm') ?? fallback?.sleepHeartRateMinBpm ?? null,
    sleepHeartRateSampleCount: snapshotSleepNumber(snapshot, 'sleep_hr_sample_count') ?? fallback?.sleepHeartRateSampleCount ?? null,
    sleepStressScore: snapshotSleepNumber(snapshot, 'sleep_stress_score') ?? fallback?.sleepStressScore ?? null,
    sleepStressConfidence: snapshotSleepMetricQuality(snapshot, 'sleep_stress_score')?.confidence ?? fallback?.sleepStressConfidence ?? 0,
    sleepStressLabel: stressLabel,
    captureStatus: sleepCaptureStatusValue(sleepPayloadText(snapshot, 'sleep_capture_status')) ?? fallback?.captureStatus ?? 'duration_only',
    source: 'snapshot',
    episodeKey: fallback?.episodeKey ?? null,
    episodeLabel: fallback?.episodeLabel ?? null,
    episodes: fallback?.episodes ?? [],
  }
}

function sleepTrendNights(snapshots: AtlasHealthSnapshot[], fallbackNights: SleepNight[]): SleepTrendNight[] {
  const fromSnapshots = snapshots
    .filter((snapshot) => !snapshot.deleted_at && hasValidSleepSnapshotData(snapshot))
    .map((snapshot) => ({
      key: snapshotDateKey(snapshot.snapshot_date),
      asleepHours: snapshotSleepNumber(snapshot, 'duration_hours') ?? snapshot.sleep_duration_hours ?? null,
      sort: snapshotSleepSortTime(snapshot),
    }))
    .filter((item) => typeof item.asleepHours === 'number')
    .sort((a, b) => b.sort - a.sort)
    .map(({ key, asleepHours }) => ({ key, asleepHours }))

  return fromSnapshots.length > 0
    ? fromSnapshots
    : fallbackNights.map((night) => ({ key: night.key, asleepHours: night.asleepHours }))
}

function metricRow(label: string, metric: MetricValue, target?: string | null): SleepMetricRowModel {
  return {
    label,
    value: formatMetricValue(metric),
    detail: metricSubtitle(metric),
    target,
    info: sleepMetricInfo(label, target),
  }
}

function textRow(label: string, text: string, date?: string | null, target?: string | null): SleepMetricRowModel {
  return metricRow(label, { value: null, text, date }, target)
}

function displaySleepRow(
  label: string,
  value: string,
  target?: string | null,
  detail?: string | null,
): SleepMetricRowModel {
  return {
    label,
    value,
    detail,
    target,
    info: sleepMetricInfo(label, target),
  }
}

function sleepMetricInfo(label: string, target?: string | null): SleepMetricInfo {
  const key = normalizeSleepMetricLabel(label)
  const genericIdeal = target ?? 'Use seu normal pessoal quando existir; sem histórico, use o alvo operacional mostrado na linha.'
  const commonCaveats = [
    'Apple Watch estima estágios; não é polissonografia.',
    'Atlas prefere mostrar sem dado a promover microepisódio ou dado fora da janela principal.',
  ]

  switch (key) {
    case 'score do sono':
    case 'score da noite':
      return {
        category: 'Resumo',
        what: 'Score operacional da última noite principal válida.',
        why: 'Condensa quantidade, déficit, eficiência, arquitetura, regularidade e qualidade do dado em uma leitura rápida.',
        calculation: 'Combina duração versus necessidade de sono, déficit observado em 7 dias, eficiência, continuidade, fases REM/profundo e confiança da captura.',
        inputs: ['Duração principal', 'Necessidade de sono', 'Déficit 7d', 'Eficiência', 'REM/profundo', 'Regularidade', 'Qualidade dos dados'],
        source: 'Snapshot diário de sono quando existe; fallback local usa o mesmo analisador de sono principal.',
        quality: 'Alta quando existe noite principal com estágios e métrica de qualidade; parcial quando faltam fases ou regularidade.',
        ideal: target ?? 'ideal >= 85%',
        precision: 'Boa para decisão operacional; média para arquitetura porque fases de wearable são estimativas.',
        caveats: commonCaveats,
      }
    case 'duração':
      return {
        category: 'Quantidade',
        what: 'Tempo realmente dormido na noite principal, sem contar cochilos separados.',
        why: 'É o principal driver simples de recuperação e o maior determinante do déficit de sono.',
        calculation: 'Soma REM, core, profundo e sono genérico dentro da janela principal. Rejeita blocos muito curtos ou fora da janela de sono para evitar falso positivo como 14 minutos à noite.',
        inputs: ['Sleep stage REM', 'Sleep stage core', 'Sleep stage profundo', 'Sleep stage asleep', 'Duração HealthKit como fallback'],
        source: 'Apple Health/HealthKit filtrado pelo analisador Atlas de noite principal.',
        quality: 'Alta com estágios completos; parcial se veio só duração; inválida se for microepisódio ou bloco fora da janela principal.',
        ideal: target ?? 'alvo pessoal atual',
        precision: 'Alta para tempo total quando a noite principal é válida.',
        caveats: commonCaveats,
      }
    case 'necessidade de sono':
    case 'alvo de sono':
    case 'mínimo aceitável':
    case 'sono necessário':
      return {
        category: 'Alvo',
        what: 'Quantidade de sono que o Atlas considera necessária agora.',
        why: 'Evita usar uma meta fixa universal. A necessidade pode subir por déficit, carga ou pior recuperação.',
        calculation: 'Parte de um baseline pessoal ou mínimo aceitável e ajusta por dívida recente, carga e cochilos quando há evidência.',
        inputs: ['Histórico de sono', 'Resultados de check-in', 'Foco/produtividade quando disponível', 'Déficit observado', 'Carga'],
        source: 'Modelo de alvo de sono compartilhado entre Estado físico e tela Sono.',
        quality: 'Fica forte com várias noites e resultados; começa como mínimo aceitável quando ainda não há histórico suficiente.',
        ideal: target ?? 'o melhor valor pessoal observado, nunca uma meta fixa cega',
        precision: 'Média no começo; melhora com recorrência de noites e outcomes bons.',
        caveats: ['Enquanto houver poucas noites, trate como alvo provisório.', 'A meta pode mudar quando há déficit ou carga acima do normal.'],
      }
    case 'déficit da noite':
      return {
        category: 'Déficit',
        what: 'Quanto a última noite ficou abaixo da necessidade atual de sono.',
        why: 'Mostra o custo direto da noite curta sem misturar com semanas anteriores.',
        calculation: 'max(0, necessidade de sono atual - duração da noite principal).',
        inputs: ['Duração principal', 'Necessidade de sono'],
        source: 'Snapshot diário ou cálculo local com os mesmos campos.',
        quality: 'Alta se duração e alvo estão confiáveis; parcial se o alvo ainda é baseline.',
        ideal: target ?? 'ideal 0min',
        precision: 'Alta para a diferença aritmética; depende da qualidade do alvo.',
        caveats: ['Não significa doença; significa dívida operacional de sono.', 'Uma noite ruim pesa menos que uma sequência ruim.'],
      }
    case 'déficit observado 7d':
    case 'déficit acumulado relevante':
      return {
        category: 'Déficit',
        what: 'Soma do déficit das noites observadas nos últimos 7 dias.',
        why: 'Mostra acúmulo. Uma noite razoável pode esconder várias noites abaixo do necessário.',
        calculation: 'Soma, para cada noite válida, max(0, necessidade - duração). Noites ausentes não são inventadas.',
        inputs: ['Duração por noite', 'Necessidade de sono por noite', 'Noites válidas observadas'],
        source: 'Readiness/snapshots diários recentes.',
        quality: 'Boa com 5 a 7 noites; parcial com poucas noites observadas.',
        ideal: target ?? 'ideal 0min',
        precision: 'Média-alta como dívida observada; não tenta estimar noites sem dado.',
        caveats: ['Se houve noites sem relógio, o valor é observado, não absoluto.', 'Interprete junto com Noites usadas.'],
      }
    case 'média 7 dias':
      return {
        category: 'Tendência',
        what: 'Média de duração nas noites válidas mais recentes.',
        why: 'A tendência é mais confiável que uma noite isolada para entender recuperação.',
        calculation: 'Média das últimas noites válidas, limitada ao período recente mostrado.',
        inputs: ['Duração principal por noite', 'Filtro de noite válida'],
        source: 'Snapshots diários ou noites HealthKit analisadas.',
        quality: 'Boa com várias noites; parcial com histórico curto.',
        ideal: target ?? 'próximo da necessidade pessoal',
        precision: 'Alta para média das noites observadas; não preenche buracos sem dado.',
        caveats: ['Pode parecer melhor ou pior se houve noites sem usar o relógio.', 'Use junto de déficit 7d.'],
      }
    case 'noites usadas':
    case 'noites analisadas':
      return {
        category: 'Cobertura',
        what: 'Quantidade de noites que sustentam o cálculo recente.',
        why: 'Mostra se a leitura está forte ou se o Atlas está operando com pouca amostra.',
        calculation: 'Conta noites principais válidas dentro da janela recente.',
        inputs: ['Snapshots de sono', 'Noites HealthKit válidas'],
        source: 'Eixo de qualidade do readiness e snapshots.',
        quality: 'Alta como auditoria de cobertura.',
        ideal: target ?? 'ideal 7/7',
        precision: 'Alta para contagem de noites válidas.',
        caveats: ['Noites rejeitadas por microepisódio não entram.', 'Sem relógio ou sem permissão reduz cobertura.'],
      }
    case 'hora de dormir':
      return {
        category: 'Janela',
        what: 'Horário em que a noite principal começou.',
        why: 'Ajuda entender rotina, ritmo circadiano e regularidade.',
        calculation: 'Usa o início do primeiro estágio de sono ou início na cama quando disponível.',
        inputs: ['Bedtime', 'In bed', 'Primeiro estágio dormindo'],
        source: 'Snapshot de sono ou análise de estágios HealthKit.',
        quality: 'Boa com in bed/awake; parcial sem esses estágios.',
        ideal: target ?? 'estável e compatível com seu horário de acordar',
        precision: 'Média-alta; depende de o relógio registrar a janela completa.',
        caveats: ['Se você fica deitado acordado sem registro in bed, a latência pode ficar parcial.'],
      }
    case 'hora de acordar':
      return {
        category: 'Janela',
        what: 'Horário final da noite principal.',
        why: 'Ancora regularidade e serve de referência para o planner.',
        calculation: 'Usa o fim do último estágio de sono/awake da noite principal.',
        inputs: ['Wake time', 'Último estágio da noite', 'Janela principal'],
        source: 'Snapshot de sono ou análise de estágios HealthKit.',
        quality: 'Boa quando há estágios até o final da noite.',
        ideal: target ?? 'estável no seu padrão pessoal',
        precision: 'Média-alta para rotina; parcial se o relógio saiu antes de acordar.',
        caveats: ['Acordar e voltar a dormir pode criar episódios; Atlas escolhe a noite principal válida.'],
      }
    case 'latência':
    case 'latência usada':
      return {
        category: 'Continuidade',
        what: 'Tempo estimado até entrar no primeiro sono real.',
        why: 'Latência alta costuma indicar stress, estímulo tardio, cafeína, ansiedade ou janela circadiana ruim.',
        calculation: 'Diferença entre início na cama/vigília e primeiro estágio dormindo; no planner vira ajuste para hora de deitar.',
        inputs: ['In bed', 'Awake', 'Primeiro REM/core/profundo/asleep'],
        source: 'Estágios do Apple Watch quando disponíveis.',
        quality: 'Sem in bed/awake antes do sono, fica sem dado ou parcial.',
        ideal: target ?? 'ideal <= 20min',
        precision: 'Média; início de sono por wearable é estimado.',
        caveats: ['Não use um dia isolado como diagnóstico.', 'Se o Watch não capturou in bed, a latência pode sumir.'],
      }
    case 'despertares':
      return {
        category: 'Fragmentação',
        what: 'Número de blocos acordado depois que o sono começou e antes do despertar final.',
        why: 'Fragmentação reduz recuperação mesmo quando a duração total parece suficiente.',
        calculation: 'Conta episódios awake relevantes dentro da janela principal.',
        inputs: ['Sleep stage awake', 'Primeiro sono', 'Último sono'],
        source: 'Estágios HealthKit filtrados pela noite principal.',
        quality: 'Boa quando há estágio awake detalhado; sem estágios vira sem dado.',
        ideal: target ?? 'ideal 0-1',
        precision: 'Média; microdespertares podem ser subdetectados.',
        caveats: commonCaveats,
      }
    case 'distúrbios':
    case 'muitas interrupções':
      return {
        category: 'Fragmentação',
        what: 'Interrupções breves de vigília dentro do sono.',
        why: 'Captura noites quebradas que talvez não apareçam só olhando duração.',
        calculation: 'Conta blocos awake dentro da janela principal, incluindo interrupções curtas acima do limite mínimo.',
        inputs: ['Sleep stage awake', 'Janela principal'],
        source: 'Analisador local de estágios HealthKit.',
        quality: 'Boa com awake detalhado; parcial quando o Watch não marcou vigília.',
        ideal: target ?? 'ideal <= 8',
        precision: 'Média para número exato; útil como tendência.',
        caveats: commonCaveats,
      }
    case 'ciclos de sono':
      return {
        category: 'Arquitetura',
        what: 'Estimativa de ciclos de sono observados, usando episódios REM como marcador.',
        why: 'Ajuda saber se a noite completou arquitetura suficiente ou foi cortada cedo.',
        calculation: 'Conta blocos REM separados dentro da noite principal.',
        inputs: ['Estágio REM', 'Janela principal'],
        source: 'Estágios do Apple Watch.',
        quality: 'Parcial por depender de classificação de REM.',
        ideal: target ?? 'ideal 4-6',
        precision: 'Média-baixa para ciclo exato; boa para tendência grosseira.',
        caveats: ['Ciclo real não é apenas REM; essa é uma aproximação operacional.', ...commonCaveats],
      }
    case 'cochilos':
      return {
        category: 'Episódios',
        what: 'Sono fora da noite principal.',
        why: 'Cochilos podem ajudar recuperação, mas não podem inflar duração, REM ou déficit da noite.',
        calculation: 'Episódios válidos separados da noite principal por lacunas longas entram como cochilos.',
        inputs: ['Episódios de sono', 'Lacunas entre episódios', 'Filtro de noite principal'],
        source: 'Analisador local de episódios.',
        quality: 'Boa com horários e estágios; parcial com duração isolada.',
        ideal: target ?? 'separado da noite',
        precision: 'Média-alta para separação noite/cochilo.',
        caveats: ['Cochilos longos tarde podem afetar a próxima noite.', 'Não entram como sono principal.'],
      }
    case 'eficiência':
      return {
        category: 'Continuidade',
        what: 'Percentual do tempo na cama que foi realmente sono.',
        why: 'Mostra se você teve boa oportunidade de sono ou ficou muito tempo acordado na janela.',
        calculation: 'duração dormida / tempo na cama * 100.',
        inputs: ['Duração', 'Na cama', 'Acordado'],
        source: 'Snapshot de sono, com fallback por estágios.',
        quality: 'Alta quando há awake/in bed; parcial quando inferido.',
        ideal: target ?? 'ideal >= 90%',
        precision: 'Média-alta para tendência; depende da marcação de awake.',
        caveats: commonCaveats,
      }
    case 'rem':
      return sleepStageInfo('REM', 'Tempo total em sono REM.', 'REM pesa em consolidação cognitiva, memória e regulação emocional.', 'Soma os intervalos de estágio REM dentro da noite principal.', ['Sleep stage REM', 'Duração principal'], target, commonCaveats)
    case 'rem %':
      return sleepStageInfo('REM %', 'Percentual da noite em REM.', 'Normaliza REM pela duração total para comparar noites curtas e longas.', 'REM / duração principal * 100.', ['REM', 'Duração principal'], target, commonCaveats)
    case 'profundo':
      return sleepStageInfo('Profundo', 'Tempo total em sono profundo.', 'Sono profundo é importante para recuperação física, pressão homeostática e percepção de restauração.', 'Soma os intervalos de estágio profundo dentro da noite principal.', ['Sleep stage deep', 'Duração principal'], target, commonCaveats)
    case 'profundo %':
      return sleepStageInfo('Profundo %', 'Percentual da noite em sono profundo.', 'Ajuda avaliar se a recuperação física está comprimida em noites de durações diferentes.', 'Profundo / duração principal * 100.', ['Profundo', 'Duração principal'], target, commonCaveats)
    case 'core':
      return sleepStageInfo('Core', 'Tempo total em sono core/leve.', 'Core é a maior parte normal do sono e fecha a arquitetura entre REM e profundo.', 'Soma os intervalos de estágio core dentro da noite principal.', ['Sleep stage core', 'Duração principal'], target, commonCaveats)
    case 'core %':
      return sleepStageInfo('Core %', 'Percentual da noite em sono core/leve.', 'Ajuda detectar quando REM ou profundo ficaram comprimidos.', 'Core / duração principal * 100.', ['Core', 'Duração principal'], target, commonCaveats)
    case 'acordado':
      return {
        category: 'Fragmentação',
        what: 'Tempo acordado dentro da janela de sono principal.',
        why: 'Distingue uma noite curta de uma noite longa, mas muito quebrada.',
        calculation: 'Soma intervalos awake entre início e fim da noite principal.',
        inputs: ['Sleep stage awake', 'Janela principal'],
        source: 'Estágios HealthKit.',
        quality: 'Boa com awake detalhado; parcial se o Watch não marcou vigília.',
        ideal: target ?? 'ideal baixo',
        precision: 'Média-alta para tendência.',
        caveats: commonCaveats,
      }
    case 'vigília %':
      return {
        category: 'Fragmentação',
        what: 'Percentual do tempo na cama passado acordado.',
        why: 'Compara fragmentação entre noites de tamanhos diferentes.',
        calculation: 'acordado / tempo na cama * 100.',
        inputs: ['Acordado', 'Na cama'],
        source: 'Snapshot ou cálculo local por estágios.',
        quality: 'Boa quando awake e in bed existem.',
        ideal: target ?? 'ideal <= 10%',
        precision: 'Média-alta para tendência.',
        caveats: commonCaveats,
      }
    case 'continuidade':
      return {
        category: 'Continuidade',
        what: 'Quanto da janela na cama ficou sem vigília relevante.',
        why: 'É uma leitura simples da estabilidade da noite.',
        calculation: '100 - vigília %.',
        inputs: ['Vigília %', 'Acordado', 'Na cama'],
        source: 'Snapshot ou cálculo local.',
        quality: 'Boa quando vigília foi medida.',
        ideal: target ?? 'ideal >= 90%',
        precision: 'Média-alta como indicador operacional.',
        caveats: commonCaveats,
      }
    case 'na cama':
    case 'tempo na cama':
      return {
        category: 'Oportunidade',
        what: 'Tempo observado na janela de sono, incluindo sono e vigília.',
        why: 'Separa oportunidade de sono de sono real. Pode faltar tempo na cama mesmo com boa eficiência.',
        calculation: 'Usa in bed quando existe; senão usa sono + awake ou a janela de estágios.',
        inputs: ['In bed', 'Duração', 'Acordado', 'Janela de estágios'],
        source: 'HealthKit e analisador de sono principal.',
        quality: 'Boa com in bed/awake; parcial quando inferida.',
        ideal: target ?? 'aproximadamente necessidade / eficiência',
        precision: 'Média; não deve virar meta rígida isolada.',
        caveats: ['Tempo na cama alto com sono baixo indica baixa eficiência.', ...commonCaveats],
      }
    case 'cobertura de fases':
    case 'fases incompletas':
      return {
        category: 'Qualidade do dado',
        what: 'Quanto do sono tem fase específica REM/core/profundo.',
        why: 'Diz se a arquitetura da noite é confiável ou se só existe duração genérica.',
        calculation: '(REM + core + profundo) / duração principal.',
        inputs: ['REM', 'Core', 'Profundo', 'Sono genérico', 'Duração'],
        source: 'Snapshot de sono.',
        quality: 'Alta quando cobre quase toda a noite.',
        ideal: target ?? 'ideal >= 85%',
        precision: 'Alta como auditoria da captura; não mede saúde diretamente.',
        caveats: ['Cobertura alta não prova que a classificação de fase está perfeita.'],
      }
    case 'qualidade dos dados':
    case 'qualidade dados sono':
    case 'dado parcial':
      return {
        category: 'Qualidade do dado',
        what: 'Confiança operacional da noite analisada.',
        why: 'Impede que uma noite incompleta pareça tão confiável quanto uma noite bem capturada.',
        calculation: 'Combina cobertura de fases, eficiência plausível, latência, despertares e status de captura.',
        inputs: ['Cobertura de fases', 'Eficiência', 'Latência', 'Despertares', 'Status captura'],
        source: 'Modelo de qualidade do snapshot de sono.',
        quality: 'Alta quando há estágios completos e vigília coerente.',
        ideal: target ?? 'ideal >= 75%',
        precision: 'Alta como auditoria de dado; não é score de saúde.',
        caveats: ['Uma noite pode ser saudável e ter qualidade de dado parcial.', 'Qualidade baixa reduz confiança das outras métricas.'],
      }
    case 'status captura':
      return {
        category: 'Qualidade do dado',
        what: 'Classificação da origem da captura da noite.',
        why: 'Mostra se a noite veio completa, parcial, só duração ou fallback local.',
        calculation: 'Classifica a captura conforme presença de duração, estágios, vigília e metadados.',
        inputs: ['Duração', 'Estágios', 'Cobertura', 'Fonte'],
        source: 'Snapshot de sono.',
        quality: 'Alta para explicar o próprio dado.',
        ideal: target ?? 'ideal completo',
        precision: 'Alta como metadado operacional.',
        caveats: ['Status completo não transforma fase estimada em dado clínico.'],
      }
    case 'fc sono média':
      return physiologyInfo('FC sono média', 'Frequência cardíaca média dentro da noite principal.', 'Ajuda detectar stress fisiológico noturno, álcool, calor, doença ou recuperação ruim.', 'Agrega amostras de FC que caem dentro da janela principal de sono.', ['Heart rate durante sono', 'Janela principal'], target)
    case 'fc sono mínima':
      return physiologyInfo('FC sono mínima', 'Menor frequência cardíaca observada no sono.', 'Ajuda ver se o corpo atingiu repouso profundo em algum ponto da noite.', 'Pega o menor valor de FC dentro da janela principal.', ['Heart rate durante sono', 'Janela principal'], target)
    case 'amostras fc sono':
      return {
        category: 'Qualidade fisiológica',
        what: 'Quantidade de leituras de FC usadas no agregado de sono.',
        why: 'Audita se média e mínima de FC têm sustentação suficiente.',
        calculation: 'Conta amostras de FC dentro da janela principal.',
        inputs: ['Heart rate', 'Janela principal'],
        source: 'Apple Watch via HealthKit, agregado localmente.',
        quality: 'Alta como auditoria de cobertura.',
        ideal: target ?? 'ideal >= 3',
        precision: 'Alta para contagem de amostras.',
        caveats: ['Mais amostras melhora confiança, mas não garante recuperação boa.'],
      }
    case 'stress sono':
    case 'stress fisiológico no sono':
      return {
        category: 'Fisiologia',
        what: 'Pressão fisiológica estimada durante o sono.',
        why: 'Separa uma noite longa de uma noite realmente restauradora.',
        calculation: 'Combina FC do sono, HRV, FC repouso, respiração, oxigênio, temperatura e distúrbios respiratórios quando disponíveis.',
        inputs: ['FC sono', 'HRV', 'FC repouso', 'Respiração', 'Oxigênio', 'Temperatura de pulso', 'Distúrbios respiratórios'],
        source: 'Agregados noturnos e sinais HealthKit recentes.',
        quality: 'Média-alta com FC noturna e sinais respiratórios; parcial quando faltam sinais.',
        ideal: target ?? 'ideal >= 82%',
        precision: 'Média-alta para tendência pessoal; não é diagnóstico.',
        caveats: ['Pode cair por treino, álcool, calor, doença ou stress.', 'Interprete junto com sintomas e check-in.'],
      }
    case 'hrv':
      return physiologyInfo('HRV', 'Variabilidade da frequência cardíaca mais recente.', 'Ajuda contextualizar recuperação autonômica depois do sono.', 'Usa mediana/último dia disponível dentro do frescor permitido.', ['HRV Apple Health'], target)
    case 'fc repouso':
      return physiologyInfo('FC repouso', 'Frequência cardíaca de repouso recente.', 'FC repouso acima do normal pode indicar carga, stress, doença, calor ou recuperação ruim.', 'Usa leitura recente de repouso dentro do frescor permitido.', ['Resting heart rate Apple Health'], target)
    case 'respiração sono':
      return physiologyInfo('Respiração sono', 'Frequência respiratória associada ao sono.', 'Desvios podem indicar stress fisiológico, doença, álcool, calor ou sono ruim.', 'Prioriza valor salvo no snapshot da noite; usa sinal recente como fallback.', ['Respiratory rate', 'Janela de sono'], target)
    case 'oxigênio sono':
      return physiologyInfo('Oxigênio sono', 'Saturação de oxigênio associada ao sono.', 'Quedas recorrentes podem explicar pior recuperação e merecem atenção.', 'Prioriza SpO2 da noite; usa sinal recente como fallback.', ['Oxygen saturation'], target, ['Amostragem de SpO2 pode ser irregular.', 'Não substitui avaliação médica.'])
    case 'temp. pulso sono':
      return physiologyInfo('Temp. pulso sono', 'Temperatura de pulso medida durante o sono.', 'Desvios podem refletir doença, ciclo térmico, álcool, ambiente ou stress.', 'Prioriza temperatura salva no snapshot da noite; usa sinal recente como fallback.', ['Wrist temperature'], target, ['Apple Watch costuma entregar esse dado com baseline e durante sono.', 'Compare contra seu normal, não contra valor absoluto.'])
    case 'distúrbios resp.':
      return physiologyInfo('Distúrbios resp.', 'Contagem de eventos respiratórios do sono quando o Apple Health fornece o sinal.', 'Ajuda contextualizar oxigênio, respiração e recuperação.', 'Lê o sinal de distúrbios respiratórios associado à noite ou dado recente.', ['Sleeping breathing disturbances'], target, ['Disponível depende de aparelho, sistema, país e permissões.', 'Não é diagnóstico médico.'])
    case 'regularidade':
      return regularityInfo('Regularidade', 'Score geral de consistência do sono recente.', 'Rotina estável melhora previsibilidade circadiana, energia e foco.', 'Combina variação de dormir, acordar, ponto médio e jetlag social.', ['Bedtime', 'Wake time', 'Ponto médio', 'Jetlag social'], target)
    case 'dormir ±':
      return regularityInfo('Dormir ±', 'Variação média do horário de dormir.', 'Mostra se o início da noite está consistente.', 'Compara horários de dormir recentes contra o padrão pessoal.', ['Bedtime das noites válidas'], target)
    case 'acordar ±':
      return regularityInfo('Acordar ±', 'Variação média do horário de acordar.', 'Acordar estável ancora ritmo circadiano e energia do dia.', 'Compara horários de acordar recentes contra o padrão pessoal.', ['Wake time das noites válidas'], target)
    case 'meio do sono ±':
      return regularityInfo('Meio do sono ±', 'Variação do ponto médio do sono.', 'Resume deslocamento da janela inteira e é mais robusto que olhar só dormir ou acordar.', 'Calcula o ponto médio de cada noite e mede variação contra o padrão.', ['Bedtime', 'Wake time'], target)
    case 'jetlag social':
      return regularityInfo('Jetlag social', 'Diferença entre ponto médio de sono em dias úteis e fim de semana.', 'Mostra desalinhamento de rotina que pode degradar energia mesmo dormindo horas suficientes.', 'Compara médias de ponto médio entre grupos de dias.', ['Ponto médio dias úteis', 'Ponto médio fim de semana'], target, ['Fica parcial até haver fins de semana suficientes.'])
    case 'dormir hoje':
      return plannerInfo('Dormir hoje', 'Horário recomendado para deitar hoje.', 'Traduz necessidade de sono em ação concreta para a próxima noite.', 'Calcula para bater o horário de acordar estimado, considerando eficiência e latência.', ['Necessidade de sono', 'Eficiência', 'Latência', 'Âncora de acordar'], target)
    case 'desacelerar':
      return plannerInfo('Desacelerar', 'Horário para iniciar a transição pré-sono.', 'Reduz chance de latência alta e melhora consistência.', 'Subtrai a janela de desaceleração do horário recomendado de deitar.', ['Dormir hoje', 'Wind-down'], target)
    case 'modelo de sono':
      return {
        category: 'Método',
        what: 'Versão do modelo operacional usado para sono.',
        why: 'Permite auditar se o app está usando a lógica atual de filtros e reparo.',
        calculation: 'Valor gravado no snapshot diário de sono.',
        inputs: ['Snapshot de sono', 'Versão do modelo'],
        source: 'Atlas local/store.',
        quality: 'Alta como metadado.',
        ideal: target ?? 'sleep_operational_v4 ou superior',
        precision: 'Alta.',
        caveats: ['Se a versão mudar, o reparo local precisa reprocessar snapshots antigos.'],
      }
    case 'fonte oficial':
    case 'janela analisada':
    case 'episódios detectados':
    case 'ajuste ativo':
      return {
        category: 'Revisão',
        what: 'Campo de auditoria da noite usada na tela.',
        why: 'Ajuda conferir se a tela está lendo o snapshot correto, a janela correta e o episódio correto.',
        calculation: 'Mostra a fonte, a janela principal e o status do ajuste local de visualização.',
        inputs: ['Snapshot diário', 'Episódios detectados', 'Janela de sono'],
        source: 'Analisador local e snapshot.',
        quality: 'Alta para auditoria; não é métrica fisiológica.',
        ideal: target ?? 'snapshot oficial sem ajuste manual',
        precision: 'Alta.',
        caveats: ['Ajuste manual muda só a visualização local; não altera HealthKit nem snapshot salvo.'],
      }
    case 'alvo: evidência':
    case 'alvo: faixa':
      return {
        category: 'Alvo',
        what: 'Evidência usada para definir o alvo atual de sono.',
        why: 'Mostra se o alvo vem de resultado pessoal, padrão pessoal ou mínimo aceitável.',
        calculation: 'Agrupa noites por duração e cruza com sinais de resultado quando há amostra suficiente.',
        inputs: ['Duração de sono', 'Check-in', 'Energia/humor', 'Foco/produtividade', 'Recuperação'],
        source: 'Modelo de alvo pessoal do Atlas.',
        quality: 'Forte com 5+ noites por faixa e outcomes bons; parcial antes disso.',
        ideal: target ?? 'faixa pessoal com melhor resultado recorrente',
        precision: 'Média enquanto a amostra é pequena; melhora com histórico.',
        caveats: ['Não força 7h30 como meta fixa.', 'A faixa pode mudar com mais dados.'],
      }
    case 'qualidade eixo sono':
      return {
        category: 'Qualidade do dado',
        what: 'Cobertura/confiança do eixo sono dentro da prontidão.',
        why: 'Mostra quanto o score de sono está sustentado por dados recentes.',
        calculation: 'Combina cobertura, frescor e baseline do eixo sono.',
        inputs: ['Noites recentes', 'Frescor', 'Cobertura', 'Baseline'],
        source: 'Readiness V1.',
        quality: 'Alta como auditoria de confiança.',
        ideal: target ?? 'alta cobertura e frescor',
        precision: 'Alta para metadado de qualidade.',
        caveats: ['Não mede sono em si; mede confiança do eixo.'],
      }
    default:
      return {
        category: 'Sono',
        what: 'Informação operacional da etapa de sono.',
        why: 'Ajuda interpretar o sono sem depender apenas do número na linha.',
        calculation: 'Derivada do snapshot diário ou do analisador local de noite principal.',
        inputs: ['Noite principal', 'Snapshot diário', 'Sinais HealthKit disponíveis'],
        source: 'Modelo único de sono do Atlas.',
        quality: 'Depende da presença de duração válida, estágios e metadados de qualidade.',
        ideal: genericIdeal,
        precision: 'Boa para tendência operacional; parcial quando os sinais estão incompletos.',
        caveats: commonCaveats,
      }
  }
}

function normalizeSleepMetricLabel(label: string): string {
  return label.trim().toLocaleLowerCase('pt-BR')
}

function sleepStageInfo(
  label: string,
  what: string,
  why: string,
  calculation: string,
  inputs: string[],
  target: string | null | undefined,
  caveats: string[],
): SleepMetricInfo {
  return {
    category: 'Arquitetura',
    what,
    why,
    calculation,
    inputs,
    source: 'Estágios do Apple Watch via HealthKit, filtrados para a noite principal.',
    quality: 'Parcial por natureza: wearable estima fases, então a tendência vale mais que um valor isolado.',
    ideal: target ?? `faixa pessoal para ${label}`,
    precision: 'Média para valor absoluto; melhor para tendência pessoal.',
    caveats,
  }
}

function physiologyInfo(
  label: string,
  what: string,
  why: string,
  calculation: string,
  inputs: string[],
  target?: string | null,
  caveats: string[] = ['Compare contra seu baseline pessoal.', 'Não é diagnóstico médico.'],
): SleepMetricInfo {
  return {
    category: 'Fisiologia',
    what,
    why,
    calculation,
    inputs,
    source: 'Apple Watch/Apple Health via HealthKit, priorizando agregados da noite.',
    quality: 'Boa quando o sinal cai dentro da janela de sono; parcial quando vem como fallback recente.',
    ideal: target ?? `ideal pessoal para ${label}`,
    precision: 'Média-alta para tendência pessoal; menor para leitura isolada.',
    caveats,
  }
}

function regularityInfo(
  label: string,
  what: string,
  why: string,
  calculation: string,
  inputs: string[],
  target?: string | null,
  caveats: string[] = ['Precisa de pelo menos 3 noites para começar a ficar útil.', 'Fica mais forte com 7+ noites.'],
): SleepMetricInfo {
  return {
    category: 'Regularidade',
    what,
    why,
    calculation,
    inputs,
    source: 'Histórico recente de snapshots/noites válidas.',
    quality: 'Parcial com poucas noites; boa quando a semana está bem coberta.',
    ideal: target ?? `ideal pessoal para ${label}`,
    precision: 'Média-alta para rotina quando há amostra suficiente.',
    caveats,
  }
}

function plannerInfo(
  label: string,
  what: string,
  why: string,
  calculation: string,
  inputs: string[],
  target?: string | null,
): SleepMetricInfo {
  return {
    category: 'Planner',
    what,
    why,
    calculation,
    inputs,
    source: 'Planner local da tela Sono.',
    quality: 'Boa quando há alvo, eficiência, latência e horário de acordar recentes.',
    ideal: target ?? `usar ${label.toLocaleLowerCase('pt-BR')} como plano da próxima noite`,
    precision: 'Operacional, não rígida; ajuste se sua agenda real exigir.',
    caveats: ['O planner não grava dado no HealthKit.', 'Se o horário de acordar mudar, o plano precisa mudar.'],
  }
}

function sleepDurationMetric(
  snapshot: AtlasHealthSnapshot | null,
  fallbackValue?: number | null,
  fallbackDate?: string | null,
): MetricValue {
  const quality = snapshot ? snapshotSleepMetricQuality(snapshot, 'duration_hours') : null
  return {
    value: snapshotSleepNumber(snapshot, 'duration_hours') ?? snapshot?.sleep_duration_hours ?? numericMetricValue(fallbackValue),
    unit: 'h',
    date: snapshot ? snapshotSleepDate(snapshot) : fallbackDate ?? null,
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function sleepEfficiencyMetric(
  snapshot: AtlasHealthSnapshot | null,
  fallbackValue?: number | null,
  fallbackDate?: string | null,
): MetricValue {
  const quality = snapshot ? snapshotSleepMetricQuality(snapshot, 'efficiency') : null
  return {
    value: snapshotSleepNumber(snapshot, 'efficiency') ?? snapshot?.sleep_efficiency ?? numericMetricValue(fallbackValue),
    unit: '%',
    date: snapshot ? snapshotSleepDate(snapshot) : fallbackDate ?? null,
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function sleepPayloadMetric(
  snapshot: AtlasHealthSnapshot | null,
  key: string,
  unit: string | null,
  fallbackValue?: number | null,
  fallbackDate?: string | null,
): MetricValue {
  const quality = snapshot ? snapshotSleepMetricQuality(snapshot, key) : null
  return {
    value: snapshotSleepNumber(snapshot, key) ?? numericMetricValue(fallbackValue),
    unit,
    date: snapshot ? snapshotSleepDate(snapshot) : fallbackDate ?? null,
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function sleepStagePercentMetric(
  snapshot: AtlasHealthSnapshot | null,
  key: string,
  fallbackStageHours?: number | null,
  fallbackDurationHours?: number | null,
  fallbackDate?: string | null,
): MetricValue {
  const quality = snapshot ? snapshotSleepMetricQuality(snapshot, key) : null
  const stageHours = snapshotSleepNumber(snapshot, key) ?? numericMetricValue(fallbackStageHours)
  const durationHours = snapshotSleepNumber(snapshot, 'duration_hours') ?? snapshot?.sleep_duration_hours ?? numericMetricValue(fallbackDurationHours)
  return {
    value: typeof stageHours === 'number' && typeof durationHours === 'number' && durationHours > 0
      ? (stageHours / durationHours) * 100
      : null,
    unit: '%',
    date: snapshot ? snapshotSleepDate(snapshot) : fallbackDate ?? null,
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function sleepAwakePercentMetric(
  snapshot: AtlasHealthSnapshot | null,
  night: SleepNight | null,
  fallbackDate?: string | null,
): MetricValue {
  const quality = snapshot ? snapshotSleepMetricQuality(snapshot, 'awake_percent') : null
  const stored = snapshotSleepNumber(snapshot, 'awake_percent')
  const awakeHours = snapshotSleepAwakeHours(snapshot) ?? night?.awakeHours ?? null
  const inBedHours = snapshotSleepInBedHours(snapshot) ?? night?.inBedHours ?? null
  return {
    value: stored ?? (typeof awakeHours === 'number' && typeof inBedHours === 'number' && inBedHours > 0
      ? (awakeHours / inBedHours) * 100
      : null),
    unit: '%',
    date: snapshot ? snapshotSleepDate(snapshot) : fallbackDate ?? null,
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function sleepContinuityMetric(
  snapshot: AtlasHealthSnapshot | null,
  night: SleepNight | null,
  fallbackDate?: string | null,
): MetricValue {
  const quality = snapshot ? snapshotSleepMetricQuality(snapshot, 'continuity_percent') : null
  const stored = snapshotSleepNumber(snapshot, 'continuity_percent')
  const awakePercent = sleepAwakePercentMetric(snapshot, night, fallbackDate)
  return {
    value: stored ?? (typeof awakePercent.value === 'number' ? Math.max(0, 100 - awakePercent.value) : null),
    unit: '%',
    date: snapshot ? snapshotSleepDate(snapshot) : fallbackDate ?? null,
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function sleepInBedMetric(
  snapshot: AtlasHealthSnapshot | null,
  night: SleepNight | null,
  fallbackDate?: string | null,
): MetricValue {
  const quality = snapshot ? snapshotSleepMetricQuality(snapshot, 'in_bed_hours') : null
  return {
    value: snapshotSleepInBedHours(snapshot) ?? night?.inBedHours ?? null,
    unit: 'h',
    date: snapshot ? snapshotSleepDate(snapshot) : fallbackDate ?? null,
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function sleepStageCoverageMetric(
  snapshot: AtlasHealthSnapshot | null,
  night: SleepNight | null,
  fallbackDate?: string | null,
): MetricValue {
  const quality = snapshot ? snapshotSleepMetricQuality(snapshot, 'stage_coverage') : null
  const value = snapshotSleepNumber(snapshot, 'stage_coverage') ?? night?.stageCoverage ?? null
  return {
    value: typeof value === 'number' ? value * 100 : null,
    unit: '%',
    date: snapshot ? snapshotSleepDate(snapshot) : fallbackDate ?? null,
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function sleepDataQualityMetric(
  snapshot: AtlasHealthSnapshot | null,
  night: SleepNight | null,
  fallbackDate?: string | null,
): MetricValue {
  const quality = snapshot ? snapshotSleepMetricQuality(snapshot, 'sleep_data_quality') : null
  const value = snapshotSleepNumber(snapshot, 'sleep_data_quality') ?? night?.dataQuality ?? null
  const label = sleepPayloadText(snapshot, 'sleep_data_quality_label') ?? night?.dataQualityLabel ?? null
  return {
    value: typeof value === 'number' ? value * 100 : null,
    text: typeof value === 'number' && label ? `${Math.round(value * 100)}% · ${label}` : null,
    unit: '%',
    date: snapshot ? snapshotSleepDate(snapshot) : fallbackDate ?? null,
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function sleepCaptureStatusMetric(
  snapshot: AtlasHealthSnapshot | null,
  night: SleepNight | null,
  fallbackDate?: string | null,
): MetricValue {
  const status = sleepCaptureStatusValue(sleepPayloadText(snapshot, 'sleep_capture_status')) ?? night?.captureStatus ?? null
  const label = status === 'complete'
    ? 'Completo'
    : status === 'partial'
      ? 'Parcial'
      : status === 'duration_only'
        ? 'Só duração'
        : night
          ? 'Fallback local'
          : 'Sem dado'
  return {
    value: null,
    text: label,
    date: snapshot ? snapshotSleepDate(snapshot) : fallbackDate ?? null,
  }
}

function sleepNapMetric(snapshot: AtlasHealthSnapshot | null, night: SleepNight | null): MetricValue {
  const hours = snapshotSleepNumber(snapshot, 'nap_hours') ?? night?.napHours ?? null
  const count = snapshotSleepNumber(snapshot, 'nap_count') ?? night?.napCount ?? null
  const date = snapshot ? snapshotSleepDate(snapshot) : night?.wakeTime ?? null
  if (!count || count <= 0 || typeof hours !== 'number' || hours <= 0) {
    return { value: null, text: 'Sem cochilo', date }
  }
  return {
    value: null,
    text: `${formatHoursMetric(hours)} · ${Math.round(count)}x`,
    date,
  }
}

function sleepStressMetric(
  snapshot: AtlasHealthSnapshot | null,
  night: SleepNight | null,
  fallbackDate?: string | null,
): MetricValue {
  const quality = snapshot ? snapshotSleepMetricQuality(snapshot, 'sleep_stress_score') : null
  const value = snapshotSleepNumber(snapshot, 'sleep_stress_score') ?? night?.sleepStressScore ?? null
  const label = sleepPayloadText(snapshot, 'sleep_stress_label') ?? night?.sleepStressLabel ?? null
  return {
    value,
    text: typeof value === 'number' && label ? `${Math.round(value)}% · ${label}` : null,
    unit: '%',
    date: snapshot ? snapshotSleepDate(snapshot) : fallbackDate ?? null,
    confidence: quality?.confidence ?? null,
    qualityLabel: quality?.label ?? null,
  }
}

function latestSignalMetric(
  signals: HealthSignal[],
  signalTypes: string[],
  unit: string | null,
  useEndTime = false,
): MetricValue {
  const match = latestSignal(signals, signalTypes, useEndTime)
  return {
    value: typeof match?.value_numeric === 'number' ? Number(match.value_numeric) : null,
    unit,
    date: match ? (useEndTime ? match.ended_at ?? match.started_at : match.started_at) : null,
  }
}

function latestSignal(signals: HealthSignal[], signalTypes: string[], useEndTime = false): HealthSignal | null {
  return signals
    .filter((signal) => signalTypes.includes(signal.signal_type) && typeof signal.value_numeric === 'number')
    .sort((a, b) => signalMetricTime(b, useEndTime) - signalMetricTime(a, useEndTime))[0] ?? null
}

function sleepTargetEvidenceMetric(evidence: SleepTargetEvidence, date: string): MetricValue {
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
      : `${method} · ${evidence.sampleCount} noites · ${evidence.outcomeSampleCount} c/ resultado`,
    date,
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

function sleepTargetEvidenceSummary(evidence: SleepTargetEvidence): string {
  if (evidence.method === 'outcome') return 'resultado pessoal'
  if (evidence.method === 'duration') return 'padrão pessoal'
  return 'mínimo aceitável'
}

function sleepNeedAdjustmentText(evidence: SleepTargetEvidence): string | null {
  const parts = [`base ${formatHoursMetric(evidence.baselineHours)}`]
  if (evidence.sleepDebtAdjustmentHours > 0) parts.push(`dívida +${formatHoursMetric(evidence.sleepDebtAdjustmentHours)}`)
  if (evidence.strainAdjustmentHours > 0) parts.push(`carga +${formatHoursMetric(evidence.strainAdjustmentHours)}`)
  if (evidence.napAdjustmentHours > 0) parts.push(`cochilo -${formatHoursMetric(evidence.napAdjustmentHours)}`)
  return parts.length > 1 ? parts.join(' · ') : null
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
      return `seu normal ${formatHoursMetric(targetHours * (range.min / 100))}-${formatHoursMetric(targetHours * (range.max / 100))}`
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
    .sort((a, b) => snapshotSleepSortTime(b) - snapshotSleepSortTime(a))
    .slice(0, 28)
    .map((snapshot) => {
      const stageHours = snapshotSleepNumber(snapshot, key)
      const durationHours = snapshotSleepNumber(snapshot, 'duration_hours') ?? snapshot.sleep_duration_hours
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
  return `ideal ${formatHoursMetric(baseHours * minRatio)}-${formatHoursMetric(baseHours * maxRatio)}`
}

function snapshotSleepInBedHours(snapshot: AtlasHealthSnapshot | null): number | null {
  if (!snapshot) return null
  const stored = snapshotSleepNumber(snapshot, 'in_bed_hours')
  if (typeof stored === 'number') return stored
  const durationHours = snapshotSleepNumber(snapshot, 'duration_hours') ?? snapshot.sleep_duration_hours
  const awakeHours = snapshotSleepAwakeHours(snapshot)
  if (typeof durationHours === 'number' && typeof awakeHours === 'number') {
    return durationHours + awakeHours
  }
  return null
}

function snapshotSleepAwakeHours(snapshot: AtlasHealthSnapshot | null): number | null {
  return snapshotSleepNumber(snapshot, 'awake_hours')
}

function snapshotSleepNumber(snapshot: AtlasHealthSnapshot | null, key: string): number | null {
  if (!snapshot || !isRecord(snapshot.sleep)) return null
  return snapshotNumber(snapshot.sleep[key])
}

function sleepPayloadText(snapshot: AtlasHealthSnapshot | null, key: string): string | null {
  if (!snapshot || !isRecord(snapshot.sleep)) return null
  const value = snapshot.sleep[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function snapshotSleepDate(snapshot: AtlasHealthSnapshot): string {
  return sleepPayloadText(snapshot, 'wake_time') ?? snapshot.computed_at
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
  if (status === 'alta' || status === 'good') return 'alta confiança'
  if (status === 'parcial' || status === 'partial') return 'confiança parcial'
  if (status === 'baixa' || status === 'baseline') return 'baixa confiança'
  if (status === 'sem dado') return 'sem confiança'
  if (typeof confidence === 'number' && confidence >= 0.78) return 'alta confiança'
  if (typeof confidence === 'number' && confidence >= 0.48) return 'confiança parcial'
  if (typeof confidence === 'number' && confidence > 0) return 'baixa confiança'
  return 'sem confiança'
}

function sleepQualityLabel(value: string | null): 'alta' | 'parcial' | 'baixa' {
  if (value === 'alta' || value === 'parcial' || value === 'baixa') return value
  return 'parcial'
}

function sleepCaptureStatusValue(value: string | null): SleepNight['captureStatus'] | null {
  if (value === 'complete' || value === 'partial' || value === 'duration_only') return value
  return null
}

function sleepStressLabel(value: string | null): 'baixo' | 'moderado' | 'alto' | 'sem dado' {
  if (value === 'baixo' || value === 'moderado' || value === 'alto' || value === 'sem dado') return value
  return 'sem dado'
}

function formatMetricValue(metric: MetricValue): string {
  if (metric.text?.trim()) return metric.text.trim()
  if (typeof metric.value !== 'number') return 'Sem dado'
  if (metric.unit === 'h') return formatHoursMetric(metric.value)
  if (metric.unit === 'min') return formatMinutesMetric(metric.value)
  if (metric.unit === 'vezes') return formatCountMetric(metric.value)
  if (metric.unit === 'ciclos') return formatCycleMetric(metric.value)
  if (metric.unit === '%') return `${formatNumber(metric.value)}%`

  const unit = cleanUnit(metric.unit)
  return unit ? `${formatNumber(metric.value)}${unit}` : formatNumber(metric.value)
}

function metricSubtitle(metric: MetricValue): string | null {
  const parts = [
    metric.date ? formatDateTime(metric.date) : null,
    metric.qualityLabel,
  ].filter((part): part is string => Boolean(part?.trim()))
  return parts.length > 0 ? parts.join(' · ') : null
}

function formatNumber(value: number): string {
  if (Math.abs(value) >= 100) return Math.round(value).toLocaleString('pt-BR')
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1).replace('.', ',')
}

function axisLabel(score: number | null): string {
  if (score === null) return 'Sem dado'
  if (score >= 82) return 'forte'
  if (score >= 68) return 'bom'
  if (score >= 52) return 'moderado'
  return 'baixo'
}

function snapshotNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function numericMetricValue(value?: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function snapshotDateKey(value: string): string {
  return value.split('T')[0] || value
}

function buildSleepNights(signals: HealthSignal[]): SleepNight[] {
  return analyzeSleepDays(signals).map((night) => {
    const episodes = night.episodes.map((episode, index) => sleepNightFromAnalysis(signals, episode, {
      episodeKey: `${night.key}:${index}`,
      episodeLabel: sleepEpisodeLabel(episode, index),
    }))

    return sleepNightFromAnalysis(signals, night, {
      episodeKey: `${night.key}:official`,
      episodeLabel: 'Principal',
      episodes,
      napHours: night.napHours,
      napCount: night.napCount,
    })
  })
}

function sleepNightFromAnalysis(
  signals: HealthSignal[],
  night: SleepEpisodeAnalysis | DailySleepAnalysis,
  options: {
    episodeKey?: string | null
    episodeLabel?: string | null
    episodes?: SleepNight[]
    napHours?: number | null
    napCount?: number
  } = {},
): SleepNight {
  const stress = sleepStressForDate(signals, night.key)
  return {
    key: night.key,
    asleepHours: night.asleepHours,
    inBedHours: night.inBedHours,
    efficiency: night.efficiency,
    bedtime: night.bedtime,
    wakeTime: night.wakeTime,
    inBedStartTime: night.inBedStartTime,
    remHours: night.remHours,
    deepHours: night.deepHours,
    coreHours: night.coreHours,
    awakeHours: night.awakeHours,
    unspecifiedHours: night.unspecifiedHours,
    latencyMinutes: night.latencyMinutes,
    awakeEpisodeCount: night.awakeEpisodeCount,
    disturbanceCount: night.disturbanceCount,
    sleepCycleCount: night.sleepCycleCount,
    stageCoverage: night.stageCoverage,
    dataQuality: night.dataQuality,
    dataQualityLabel: night.dataQualityLabel,
    napHours: options.napHours ?? null,
    napCount: options.napCount ?? 0,
    sleepHeartRateAverageBpm: stress.sleepHeartRateAverageBpm ?? nightlyMetricForKey(signals, 'sleep_hr_avg_bpm', night.key),
    sleepHeartRateMinBpm: stress.sleepHeartRateMinBpm ?? nightlyMetricForKey(signals, 'sleep_hr_min_bpm', night.key),
    sleepHeartRateSampleCount: nightlyMetricForKey(signals, 'sleep_hr_sample_count', night.key),
    sleepStressScore: stress.score,
    sleepStressConfidence: stress.confidence,
    sleepStressLabel: stress.label,
    captureStatus: night.captureStatus,
    source: night.source,
    episodeKey: options.episodeKey ?? null,
    episodeLabel: options.episodeLabel ?? null,
    episodes: options.episodes ?? [],
  }
}

function sleepEpisodeLabel(episode: SleepEpisodeAnalysis, index: number): string {
  if (index === 0) return 'Principal'
  if (typeof episode.asleepHours === 'number' && episode.asleepHours < 1.25) return 'Cochilo'
  return `Episódio ${index + 1}`
}

function sleepEpisodeOptions(nights: SleepNight[]): SleepEpisodeOption[] {
  return nights
    .flatMap((night) => (night.episodes ?? []).map((episode, index) => {
      const key = episode.episodeKey ?? `${night.key}:${index}`
      const label = `${episode.episodeLabel ?? sleepEpisodeLabelFromIndex(index)} · ${formatHoursMetric(episode.asleepHours)}`
      const detail = episode.bedtime && episode.wakeTime
        ? `${formatShortDateKey(night.key)} · ${formatTime(episode.bedtime)}-${formatTime(episode.wakeTime)}`
        : formatShortDateKey(night.key)
      return { key, label, detail }
    }))
    .slice(0, 12)
}

function sleepEpisodeByKey(nights: SleepNight[], key: string): SleepNight | null {
  for (const night of nights) {
    const match = (night.episodes ?? []).find((episode, index) => (episode.episodeKey ?? `${night.key}:${index}`) === key)
    if (match) return match
  }
  return null
}

function sleepEpisodeLabelFromIndex(index: number): string {
  return index === 0 ? 'Principal' : `Episódio ${index + 1}`
}

function insightSeverityLabel(severity: 'good' | 'warning' | 'bad' | 'info'): string {
  if (severity === 'good') return 'ok'
  if (severity === 'warning') return 'atenção'
  if (severity === 'bad') return 'impacto alto'
  return 'qualidade do dado'
}

function nextWakeAnchorIso(
  snapshots: AtlasHealthSnapshot[],
  night: SleepNight | null,
  computedAt: string,
): string {
  const wakeMinutes = snapshots
    .filter((snapshot) => !snapshot.deleted_at)
    .sort((a, b) => snapshotSleepSortTime(b) - snapshotSleepSortTime(a))
    .slice(0, 14)
    .map((snapshot) => sleepPayloadText(snapshot, 'wake_time'))
    .filter((value): value is string => Boolean(value))
    .map(clockMinute)
    .filter((value): value is number => typeof value === 'number')

  const referenceMinute = wakeMinutes.length >= 3
    ? median(wakeMinutes)
    : night?.wakeTime
      ? clockMinute(night.wakeTime) ?? 7 * 60 + 30
      : 7 * 60 + 30

  return nextLocalTimeIso(computedAt, referenceMinute)
}

function nextLocalTimeIso(anchorIso: string, minuteOfDay: number): string {
  const anchor = new Date(anchorIso)
  const base = Number.isFinite(anchor.getTime()) ? anchor : new Date()
  const normalized = ((Math.round(minuteOfDay) % 1440) + 1440) % 1440
  const candidate = new Date(base)
  candidate.setHours(Math.floor(normalized / 60), normalized % 60, 0, 0)
  if (candidate.getTime() <= base.getTime()) {
    candidate.setDate(candidate.getDate() + 1)
  }
  return candidate.toISOString()
}

function clockMinute(iso: string): number | null {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return null
  return date.getHours() * 60 + date.getMinutes()
}

function uniqueStages(segments: SleepTimelineSegment[]): SleepTimelineStage[] {
  const present = new Set(segments.map((segment) => segment.stage))
  const order: SleepTimelineStage[] = ['awake', 'rem', 'core', 'deep', 'asleep', 'inBed']
  return order.filter((stage) => present.has(stage))
}

function stageLabel(stage: SleepTimelineStage): string {
  if (stage === 'awake') return 'Acordado'
  if (stage === 'rem') return 'REM'
  if (stage === 'core') return 'Core'
  if (stage === 'deep') return 'Profundo'
  if (stage === 'asleep') return 'Sono'
  return 'Na cama'
}

function stageColor(stage: SleepTimelineStage, c: ReturnType<typeof usePalette>): string {
  if (stage === 'awake') return c.recRed
  if (stage === 'rem') return c.prussian
  if (stage === 'core') return c.bronze
  if (stage === 'deep') return c.moss
  if (stage === 'asleep') return c.ink2
  return c.ink3
}

function formatShortDateKey(key: string): string {
  const [, month, day] = key.split('-')
  return month && day ? `${day}/${month}` : key
}

function nightlyMetricForKey(signals: HealthSignal[], signalType: string, key: string): number | null {
  const match = signals
    .filter((signal) => (
      signal.signal_type === signalType
      && typeof signal.value_numeric === 'number'
      && localDateKey(signal.ended_at ?? signal.started_at) === key
    ))
    .sort((a, b) => signalMetricTime(b, true) - signalMetricTime(a, true))[0]
  return typeof match?.value_numeric === 'number' ? Number(match.value_numeric) : null
}

function signalMetricTime(signal: HealthSignal, useEndTime = false): number {
  return new Date(useEndTime ? signal.ended_at ?? signal.started_at : signal.started_at).getTime()
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

function formatHoursMetric(hours?: number | null): string {
  if (typeof hours !== 'number') return 'Sem dado'
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (totalMinutes < 60) return `${totalMinutes}min`
  if (m === 0) return `${h}h`
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

function formatMinutesMetric(minutes?: number | null): string {
  if (typeof minutes !== 'number') return 'Sem dado'
  return minutes < 60 ? `${Math.round(minutes)}min` : formatHoursMetric(minutes / 60)
}

function formatCountMetric(value?: number | null): string {
  if (typeof value !== 'number') return 'Sem dado'
  return value === 1 ? '1 vez' : `${Math.round(value)} vezes`
}

function formatCycleMetric(value?: number | null): string {
  if (typeof value !== 'number') return 'Sem dado'
  return value === 1 ? '1 ciclo' : `${Math.round(value)} ciclos`
}

function cleanUnit(unit?: string | null): string {
  if (!unit || unit === 'count') return ''
  if (unit === 'ms') return 'ms'
  if (unit === 'bpm') return ' bpm'
  if (unit === 'resp/min') return ' resp/min'
  if (unit === 'count/min') return ' /min'
  if (unit === 'count/s') return ' resp/s'
  if (unit === 'degC') return ' °C'
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

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const position = (sorted.length - 1) * q
  const base = Math.floor(position)
  const rest = position - base
  const next = sorted[base + 1]
  return typeof next === 'number' ? sorted[base] + rest * (next - sorted[base]) : sorted[base]
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
    overflow: 'hidden',
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
  metricValueBlock: {
    alignItems: 'flex-end',
    maxWidth: '46%',
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
    minHeight: 74,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  detailMetric: {
    flex: 1,
    paddingHorizontal: 9,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  detailSection: {
    marginTop: 18,
  },
  detailListItems: {
    marginTop: 8,
    gap: 7,
  },
  detailListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  detailListText: {
    flex: 1,
    minWidth: 0,
  },
  timelineBlock: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  timelineHeader: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
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
  reviewSelector: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  reviewChips: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reviewChip: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
