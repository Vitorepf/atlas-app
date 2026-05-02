import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { useShell } from '../components/AtlasShell'
import { useOverlays } from '../lib/overlays'
import {
  dismissMobileInboxItem,
  discussMobileInboxItem,
  getMobileInboxItem,
  markMobileInboxRead,
  respondMobileInboxItem,
  snoozeMobileInboxItem,
  type AtlasInboxAction,
  type AtlasOperationalInboxItem,
} from '../lib/api/client'

type DetailRow = {
  label: string
  value: string | null
}

type TelemetryIssue = {
  key: string
  severity: string
  value: unknown
  threshold: unknown
  summary: string | null
}

type TelemetryHealthReport = {
  status: string
  score: number | null
  window: string | null
  traces: number | null
  sample: Record<string, unknown> | null
  whyReceived: Record<string, unknown> | null
  notificationPolicy: Record<string, unknown> | null
  breakdowns: Record<string, Array<Record<string, unknown>>>
  issues: TelemetryIssue[]
  actions: string[]
  metrics: Array<{ name: string; value: unknown }>
}

type ContextBundle = NonNullable<AtlasOperationalInboxItem['context_bundle']>
type RefGroup = {
  key: keyof Pick<ContextBundle, 'source_refs' | 'trace_refs' | 'job_refs' | 'metric_refs' | 'file_refs' | 'diff_refs'>
  label: string
}

const REF_GROUPS: RefGroup[] = [
  { key: 'source_refs', label: 'Fontes' },
  { key: 'trace_refs', label: 'Traces' },
  { key: 'job_refs', label: 'Jobs' },
  { key: 'metric_refs', label: 'Metricas' },
  { key: 'file_refs', label: 'Arquivos' },
  { key: 'diff_refs', label: 'Diffs' },
]

const SNOOZE_CHOICES: Array<{ key: string; label: string; days: number; reason: string }> = [
  { key: 'tomorrow', label: 'Amanha', days: 1, reason: 'Item operacional adiado para revisao amanha.' },
  { key: 'week', label: '7 dias', days: 7, reason: 'Item operacional adiado por sete dias.' },
  { key: 'month', label: '30 dias', days: 30, reason: 'Item operacional adiado por trinta dias.' },
]

export default function MobileInboxItemScreen() {
  const c = usePalette()
  const router = useRouter()
  const { showToast } = useShell()
  const openAtlasAi = useOverlays((s) => s.openAtlasAi)
  const params = useLocalSearchParams<{ inboxId?: string; inboxAction?: string }>()
  const inboxId = typeof params.inboxId === 'string' ? params.inboxId : null
  const initialAction = typeof params.inboxAction === 'string' ? params.inboxAction : null
  const initialActionHandled = useRef(false)
  const [item, setItem] = useState<AtlasOperationalInboxItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyActionId, setBusyActionId] = useState<string | null>(null)
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null)
  const [snoozeAction, setSnoozeAction] = useState<AtlasInboxAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  const actions = useMemo(() => item?.available_actions ?? [], [item?.available_actions])

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!inboxId) {
      setError('Item do inbox nao informado.')
      setLoading(false)
      return
    }

    if (!silent) setLoading(true)
    setError(null)
    try {
      const response = await getMobileInboxItem(inboxId)
      let nextItem = response.item
      if (nextItem.status === 'unread') {
        const readResponse = await markMobileInboxRead(inboxId).catch(() => null)
        nextItem = readResponse?.item ?? nextItem
      }
      setItem(nextItem)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar item do inbox.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [inboxId])

  useEffect(() => {
    void load()
  }, [load])

  const runDiscuss = useCallback(async (targetItem: AtlasOperationalInboxItem) => {
    setBusyActionId('discuss')
    setError(null)
    try {
      const response = await discussMobileInboxItem(targetItem.id)
      setItem(response.item)
      const threadId = threadIdFromActionResult(response.result)
      if (threadId) {
        openAtlasAi(threadId)
      } else {
        showToast('Atlas aberto')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir Atlas.')
    } finally {
      setBusyActionId(null)
    }
  }, [openAtlasAi, showToast])

  useEffect(() => {
    if (initialActionHandled.current || loading || !item || initialAction !== 'discuss') return
    initialActionHandled.current = true
    void runDiscuss(item)
  }, [initialAction, item, loading, runDiscuss])

  const requestAction = async (action: AtlasInboxAction) => {
    if (!item || busyActionId) return

    if (action.id === 'snooze') {
      setConfirmingActionId(null)
      setSnoozeAction(action)
      return
    }

    if (action.requires_confirm && confirmingActionId !== action.id) {
      setConfirmingActionId(action.id)
      return
    }

    setConfirmingActionId(null)
    setBusyActionId(action.id)
    setError(null)
    try {
      if (action.id === 'dismiss' || action.id === 'discard') {
        const response = await dismissMobileInboxItem(item.id, `Acao ${action.id} pelo app.`)
        setItem(response.item)
        showToast('item descartado')
        router.back()
        return
      }

      if (action.id === 'discuss') {
        await runDiscuss(item)
        return
      }

      const response = await respondMobileInboxItem(item.id, action.id)
      setItem(response.item)
      showToast(actionMessage(action.id, response.result))
      await load({ silent: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao aplicar acao.')
    } finally {
      setBusyActionId(null)
    }
  }

  const runSnooze = async (days: number, reason: string) => {
    if (!item || busyActionId) return

    setBusyActionId('snooze')
    setError(null)
    try {
      const response = await snoozeMobileInboxItem(item.id, daysFromNowIso(days), reason)
      setItem(response.item)
      setSnoozeAction(null)
      showToast(days === 1 ? 'item adiado para amanha' : `item adiado por ${days} dias`)
      router.back()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao adiar item.')
    } finally {
      setBusyActionId(null)
    }
  }

  return (
    <Screen topExtra={18}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.roundButton, { backgroundColor: pressed ? c.surface : c.premium, borderColor: c.border }]}
        >
          <Sans size={26} lineHeight={28} color={c.ink}>‹</Sans>
        </Pressable>
        <Pressable
          onPress={() => void load()}
          hitSlop={10}
          style={({ pressed }) => [styles.refreshButton, { borderColor: c.border, backgroundColor: pressed ? c.premium : c.surface }]}
        >
          <Sans weight="med" size={12} lineHeight={16} color={c.prussian}>
            Atualizar
          </Sans>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Label>Inbox operacional</Label>
        <Frau size={36} lineHeight={39} color={c.ink} numberOfLines={3} style={{ marginTop: 7 }}>
          {item?.title ?? 'Item do Atlas'}
        </Frau>
        {item ? <ItemMeta item={item} /> : null}
      </View>

      {loading ? (
        <View style={[styles.panel, styles.loadingPanel, { borderColor: c.border, backgroundColor: c.surface }]}>
          <ActivityIndicator color={c.prussian} />
          <Sans size={13} lineHeight={18} color={c.ink2} align="center">
            Carregando item operacional...
          </Sans>
        </View>
      ) : item ? (
        <View style={styles.stack}>
          {isTelemetryHealthInsight(item) ? (
            <>
              <TelemetryHealthPanel item={item} />
              <TelemetryHealthMetricsPanel item={item} />
              <TelemetryHealthBreakdownPanel item={item} />
            </>
          ) : (
            <>
              <SummaryPanel item={item} />
              <TypeDetails item={item} />
              <ContextPanel item={item} />
            </>
          )}
          <ActionPanel
            actions={actions}
            busyActionId={busyActionId}
            confirmingActionId={confirmingActionId}
            onAction={(action) => void requestAction(action)}
          />
          {snoozeAction ? (
            <SnoozePanel
              busy={busyActionId === 'snooze'}
              onCancel={() => setSnoozeAction(null)}
              onSnooze={(days, reason) => void runSnooze(days, reason)}
            />
          ) : null}
          <MetadataPanel item={item} />
        </View>
      ) : null}

      {error ? (
        <View style={[styles.errorPanel, { borderColor: c.recRed, backgroundColor: c.surface }]}>
          <Sans weight="med" size={13} lineHeight={18} color={c.recRed}>
            {error}
          </Sans>
        </View>
      ) : null}
    </Screen>
  )
}

function ItemMeta({ item }: { item: AtlasOperationalInboxItem }) {
  const c = usePalette()
  const confidence = item.confidence_score == null ? null : `${Math.round(item.confidence_score * 100)}% confianca`
  const parts = [
    typeLabel(item.type),
    item.category,
    item.status,
    confidence,
    dateLabel(item.created_at),
  ].filter((part): part is string => typeof part === 'string' && part.length > 0)

  return (
    <View style={styles.metaWrap}>
      {parts.map((part, index) => (
        <View key={`${part}-${index}`} style={[styles.metaPill, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Mono size={10.5} lineHeight={14} color={index === 0 ? c.prussian : c.ink2} letterSpacing={0.2} numberOfLines={1}>
            {part}
          </Mono>
        </View>
      ))}
      <View style={[styles.metaPill, { borderColor: c.border, backgroundColor: severityColor(item.severity, c, true) }]}>
        <Mono size={10.5} lineHeight={14} color={severityColor(item.severity, c)} letterSpacing={0.2} numberOfLines={1}>
          {item.severity}
        </Mono>
      </View>
    </View>
  )
}

function SummaryPanel({ item }: { item: AtlasOperationalInboxItem }) {
  const summary = textValue(item.summary)
  const body = textValue(item.body)
  return (
    <Section title="Mensagem">
      {summary ? <TextBlock label="Resumo" value={summary} /> : null}
      {body && body !== summary ? <TextBlock label="Detalhe" value={body} /> : null}
      {!summary && !body ? <EmptyText>Nenhuma mensagem detalhada registrada.</EmptyText> : null}
    </Section>
  )
}

function TelemetryHealthPanel({ item }: { item: AtlasOperationalInboxItem }) {
  const c = usePalette()
  const report = telemetryHealthReport(item)
  const criticalCount = report.issues.filter((issue) => issue.severity === 'critical').length
  const warningCount = report.issues.filter((issue) => issue.severity === 'warning').length
  const statusText = report.status === 'critical' ? 'Critico' : report.status === 'warning' ? 'Atencao' : humanize(report.status)
  const scoreText = report.score == null ? '--' : `${report.score}/100`

  return (
    <Section title="Diagnostico">
      <View style={[styles.diagnosticHeader, { borderColor: c.border, backgroundColor: c.premium }]}>
        <View style={styles.diagnosticCopy}>
          <Sans weight="sb" size={15} lineHeight={20} color={c.ink}>
            Saude do Atlas em {statusText.toLowerCase()}
          </Sans>
          <Sans size={13} lineHeight={19} color={c.ink2}>
            O Atlas avaliou a telemetria operacional e abriu este item porque encontrou sinais fora do limite.
          </Sans>
        </View>
        <View style={[styles.scoreBadge, { borderColor: severityColor(item.severity, c, false) }]}>
          <Mono size={19} lineHeight={23} color={severityColor(item.severity, c)}>
            {scoreText}
          </Mono>
          <Sans size={10.5} lineHeight={13} color={c.ink3} align="center">
            score
          </Sans>
        </View>
      </View>

      <View style={styles.explainGrid}>
        <ExplainTile label="Janela" value={report.window ?? '48h recentes'} />
        <ExplainTile label="Amostra" value={report.traces == null ? 'sem dado' : `${report.traces} traces`} />
        <ExplainTile label="Criticos" value={String(criticalCount)} danger={criticalCount > 0} />
        <ExplainTile label="Alertas" value={String(warningCount)} danger={warningCount > 0} />
      </View>

      <TextBlock label="Por que apareceu" value={whyReceivedText(report)} />

      {sampleConfidence(report) === 'limited' ? (
        <View style={[styles.sampleNotice, { borderColor: c.border, backgroundColor: c.premium }]}>
          <Sans weight="sb" size={13} lineHeight={18} color={c.ink}>
            Leitura com amostra pequena
          </Sans>
          <Sans size={12.5} lineHeight={18} color={c.ink2}>
            {sampleMessage(report) ?? 'Use este item como sinal de investigacao, nao como conclusao definitiva.'}
          </Sans>
        </View>
      ) : null}

      <TextBlock
        label="O que significa"
        value="Isto nao quer dizer que o app quebrou. Quer dizer que a camada de IA produziu sinais ruins ou incompletos na janela analisada: qualidade baixa, first-pass ruim, custo sem atribuicao ou outro indicador acima do limite."
      />

      {report.issues.length > 0 ? (
        <View style={styles.issueList}>
          <Label>Sinais que dispararam</Label>
          {report.issues.map((issue, index) => (
            <IssueRow key={`${issue.key}-${index}`} issue={issue} />
          ))}
        </View>
      ) : null}

      {report.actions.length > 0 ? (
        <View style={styles.actionAdviceList}>
          <Label>Proximos passos recomendados</Label>
          {report.actions.map((action, index) => (
            <View key={`${action}-${index}`} style={styles.adviceRow}>
              <Mono size={11} lineHeight={16} color={c.prussian}>
                {String(index + 1).padStart(2, '0')}
              </Mono>
              <Sans size={13} lineHeight={19} color={c.ink}>
                {translateTelemetryAction(action)}
              </Sans>
            </View>
          ))}
        </View>
      ) : null}
    </Section>
  )
}

function TelemetryHealthMetricsPanel({ item }: { item: AtlasOperationalInboxItem }) {
  const report = telemetryHealthReport(item)
  const primaryMetrics = telemetryPrimaryMetrics(report)
  if (primaryMetrics.length === 0) return null

  return (
    <Section title="Metricas principais">
      <View style={styles.metricRows}>
        {primaryMetrics.map((metric) => (
          <MetricRow
            key={metric.name}
            label={metricLabel(metric.name)}
            value={formatMetricValue(metric.name, metric.value)}
            hint={metricHint(metric.name)}
          />
        ))}
      </View>
    </Section>
  )
}

function TelemetryHealthBreakdownPanel({ item }: { item: AtlasOperationalInboxItem }) {
  const report = telemetryHealthReport(item)
  const surfaceRows = report.breakdowns.by_surface ?? []
  const providerRows = report.breakdowns.by_provider ?? []
  const modelRows = report.breakdowns.by_model ?? []

  if (surfaceRows.length === 0 && providerRows.length === 0 && modelRows.length === 0) return null

  return (
    <Section title="Origem do sinal">
      {surfaceRows.length > 0 ? <BreakdownGroup title="Superficie" rows={surfaceRows} /> : null}
      {providerRows.length > 0 ? <BreakdownGroup title="Provider" rows={providerRows} /> : null}
      {modelRows.length > 0 ? <BreakdownGroup title="Modelo" rows={modelRows} /> : null}
    </Section>
  )
}

function BreakdownGroup({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  return (
    <View style={styles.breakdownGroup}>
      <Label>{title}</Label>
      <View style={styles.breakdownRows}>
        {rows.slice(0, 4).map((row, index) => (
          <BreakdownRow key={`${title}-${textValue(row.bucket) ?? index}`} row={row} />
        ))}
      </View>
    </View>
  )
}

function BreakdownRow({ row }: { row: Record<string, unknown> }) {
  const c = usePalette()
  const bucket = textValue(row.bucket) ?? 'unknown'
  const traces = numberValue(row.traces)
  const quality = numberValue(row.quality_avg)
  const firstPass = numberValue(row.first_pass_success_rate)
  const unknownCostCount = numberValue(row.unknown_cost_count)
  const latency = numberValue(row.latency_avg_ms)

  return (
    <View style={[styles.breakdownRow, { borderColor: c.border }]}>
      <View style={styles.metricCopy}>
        <Sans weight="sb" size={13.5} lineHeight={18} color={c.ink}>
          {bucket}
        </Sans>
        <Sans size={12.5} lineHeight={17} color={c.ink2}>
          {[
            traces == null ? null : `${formatNumber(traces, 0)} traces`,
            quality == null ? null : `qualidade ${formatMetricValue('final_quality_avg', quality)}`,
            firstPass == null ? null : `first-pass ${formatMetricValue('first_pass_success_rate', firstPass)}`,
            latency == null ? null : `latencia ${formatMetricValue('latency_avg_ms', latency)}`,
          ].filter(Boolean).join(' · ')}
        </Sans>
      </View>
      {unknownCostCount && unknownCostCount > 0 ? (
        <Mono size={11} lineHeight={15} color={c.recRed}>
          {formatNumber(unknownCostCount, 0)} sem custo
        </Mono>
      ) : null}
    </View>
  )
}

function ExplainTile({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  const c = usePalette()
  return (
    <View style={[styles.explainTile, { borderColor: c.border, backgroundColor: danger ? `${c.recRed}10` : c.surface }]}>
      <Mono size={10.5} lineHeight={14} color={c.ink3} letterSpacing={0.2} style={styles.detailLabel}>
        {label}
      </Mono>
      <Sans weight="sb" size={13.5} lineHeight={18} color={danger ? c.recRed : c.ink}>
        {value}
      </Sans>
    </View>
  )
}

function IssueRow({ issue }: { issue: TelemetryIssue }) {
  const c = usePalette()
  const critical = issue.severity === 'critical'
  return (
    <View style={[styles.issueRow, { borderColor: c.border, backgroundColor: critical ? `${c.recRed}10` : c.surface }]}>
      <View style={styles.issueTopRow}>
        <Sans weight="sb" size={13.5} lineHeight={18} color={c.ink}>
          {metricLabel(issue.key)}
        </Sans>
        <Mono size={10.5} lineHeight={14} color={critical ? c.recRed : c.ink2} letterSpacing={0.2} style={styles.detailLabel}>
          {issue.severity}
        </Mono>
      </View>
      <Sans size={12.5} lineHeight={18} color={c.ink2}>
        {formatMetricValue(issue.key, issue.value)} vs limite {formatMetricValue(issue.key, issue.threshold)}
      </Sans>
      <Sans size={12.5} lineHeight={18} color={c.ink}>
        {issueMeaning(issue)}
      </Sans>
    </View>
  )
}

function MetricRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  const c = usePalette()
  return (
    <View style={[styles.metricRow, { borderColor: c.border }]}>
      <View style={styles.metricCopy}>
        <Sans weight="sb" size={13.5} lineHeight={18} color={c.ink}>
          {label}
        </Sans>
        <Sans size={12.5} lineHeight={17} color={c.ink2}>
          {hint}
        </Sans>
      </View>
      <Mono size={13} lineHeight={18} color={c.prussian}>
        {value}
      </Mono>
    </View>
  )
}

function TypeDetails({ item }: { item: AtlasOperationalInboxItem }) {
  const rows = detailsForItem(item)
  if (rows.length === 0) return null

  return (
    <Section title={detailTitle(item.type)}>
      <View style={styles.rows}>
        {rows.map((row) => (
          <DetailLine key={row.label} label={row.label} value={row.value} />
        ))}
      </View>
    </Section>
  )
}

function ContextPanel({ item }: { item: AtlasOperationalInboxItem }) {
  const bundle = item.context_bundle
  if (!bundle) return null

  const refGroups = REF_GROUPS
    .map((group) => ({ ...group, refs: Array.isArray(bundle[group.key]) ? bundle[group.key] : [] }))
    .filter((group) => group.refs.length > 0)

  return (
    <Section title="Contexto">
      <TextBlock label={bundle.purpose || 'bundle'} value={[bundle.title, bundle.summary].filter(Boolean).join('\n')} />
      {refGroups.length > 0 ? (
        <View style={styles.refGroups}>
          {refGroups.map((group) => (
            <View key={group.key} style={styles.refGroup}>
              <Label>{group.label}</Label>
              <View style={styles.refs}>
                {group.refs.slice(0, 6).map((ref, index) => (
                  <RefRow key={`${group.key}-${index}`} value={ref} />
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Section>
  )
}

function ActionPanel({
  actions,
  busyActionId,
  confirmingActionId,
  onAction,
}: {
  actions: AtlasInboxAction[]
  busyActionId: string | null
  confirmingActionId: string | null
  onAction: (action: AtlasInboxAction) => void
}) {
  if (actions.length === 0) return null

  return (
    <Section title="Acoes">
      <View style={styles.actionStack}>
        {actions.map((action) => (
          <DetailActionButton
            key={action.id}
            action={action}
            busy={busyActionId === action.id}
            disabled={busyActionId !== null && busyActionId !== action.id}
            confirming={confirmingActionId === action.id}
            onPress={() => onAction(action)}
          />
        ))}
      </View>
    </Section>
  )
}

function SnoozePanel({
  busy,
  onCancel,
  onSnooze,
}: {
  busy: boolean
  onCancel: () => void
  onSnooze: (days: number, reason: string) => void
}) {
  const c = usePalette()
  return (
    <Section title="Adiar">
      <View style={styles.snoozeRow}>
        {SNOOZE_CHOICES.map((choice) => (
          <Pressable
            key={choice.key}
            disabled={busy}
            onPress={() => onSnooze(choice.days, choice.reason)}
            style={({ pressed }) => [
              styles.snoozeChip,
              {
                borderColor: c.border,
                backgroundColor: pressed ? c.premium : 'transparent',
                opacity: busy ? 0.45 : 1,
              },
            ]}
          >
            <Sans weight="sb" size={12} lineHeight={16} color={c.prussian}>
              {choice.label}
            </Sans>
          </Pressable>
        ))}
        <Pressable
          disabled={busy}
          onPress={onCancel}
          style={({ pressed }) => [styles.snoozeCancel, { opacity: pressed || busy ? 0.5 : 1 }]}
        >
          <Sans weight="med" size={12} lineHeight={16} color={c.ink2}>
            Cancelar
          </Sans>
        </Pressable>
      </View>
    </Section>
  )
}

function MetadataPanel({ item }: { item: AtlasOperationalInboxItem }) {
  const technical = !isTelemetryHealthInsight(item)
  const rows: DetailRow[] = [
    { label: 'ID', value: item.id },
    { label: 'Criado em', value: dateTimeLabel(item.created_at) },
    { label: 'Fonte', value: technical ? [item.source_type, item.source_id].filter(Boolean).join(' / ') || null : null },
    { label: 'Iniciador', value: item.initiator },
    { label: 'Dedupe', value: technical ? item.dedupe_key : null },
    { label: 'Expira em', value: dateTimeLabel(item.expires_at) },
    { label: 'Lido em', value: dateTimeLabel(item.read_at) },
    { label: 'Resolvido em', value: dateTimeLabel(item.resolved_at) },
    { label: 'Prioridade', value: String(item.priority_score) },
  ].filter((row) => row.value !== null && row.value !== '')

  if (rows.length === 0) return null

  return (
    <Section title="Metadados">
      <View style={styles.rows}>
        {rows.map((row) => <DetailLine key={row.label} label={row.label} value={row.value} compact />)}
      </View>
    </Section>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const c = usePalette()
  return (
    <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <Label>{title}</Label>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

function TextBlock({ label, value }: { label: string; value: string }) {
  const c = usePalette()
  return (
    <View style={styles.textBlock}>
      <Label>{label}</Label>
      <Sans size={13.5} lineHeight={20} color={c.ink} style={styles.preWrap}>
        {value}
      </Sans>
    </View>
  )
}

function EmptyText({ children }: { children: ReactNode }) {
  const c = usePalette()
  return (
    <Sans size={13} lineHeight={18} color={c.ink2}>
      {children}
    </Sans>
  )
}

function DetailLine({ label, value, compact = false }: { label: string; value: string | null; compact?: boolean }) {
  const c = usePalette()
  if (!value) return null

  return (
    <View style={[styles.detailLine, compact ? styles.detailLineCompact : null]}>
      <Mono size={10.5} lineHeight={14} color={c.ink3} letterSpacing={0.2} style={styles.detailLabel}>
        {label}
      </Mono>
      <Sans size={compact ? 12.5 : 13.5} lineHeight={compact ? 18 : 20} color={c.ink}>
        {value}
      </Sans>
    </View>
  )
}

function RefRow({ value }: { value: unknown }) {
  const c = usePalette()
  return (
    <View style={[styles.refRow, { borderColor: c.border, backgroundColor: c.premium }]}>
      <Mono size={10.5} lineHeight={15} color={c.ink2}>
        {compactJson(value, 260)}
      </Mono>
    </View>
  )
}

function DetailActionButton({
  action,
  busy,
  disabled,
  confirming,
  onPress,
}: {
  action: AtlasInboxAction
  busy: boolean
  disabled: boolean
  confirming: boolean
  onPress: () => void
}) {
  const c = usePalette()
  const destructive = action.style === 'destructive'
  const primary = action.style === 'primary'
  const color = destructive ? c.recRed : primary ? c.onInk : c.prussian
  const background = primary ? c.ink : 'transparent'
  const border = destructive ? c.recRed : primary ? c.ink : c.prussian

  return (
    <Pressable
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.detailAction,
        {
          borderColor: border,
          backgroundColor: pressed && !primary ? c.premium : background,
          opacity: disabled ? 0.35 : pressed ? 0.88 : 1,
        },
      ]}
    >
      <Sans weight="sb" size={13} lineHeight={17} color={color} align="center" numberOfLines={2}>
        {busy ? 'Aplicando...' : confirming ? `Confirmar ${action.label}` : action.label}
      </Sans>
    </Pressable>
  )
}

function isTelemetryHealthInsight(item: AtlasOperationalInboxItem): boolean {
  return item.type === 'insight'
    && (payloadText(item.payload ?? {}, 'insight_kind') === 'atlas_ai_telemetry_health'
      || (item.dedupe_key?.includes('atlas-ai-telemetry-health') ?? false))
}

function telemetryHealthReport(item: AtlasOperationalInboxItem): TelemetryHealthReport {
  const payload = item.payload ?? {}
  const health = isRecord(payload.health) ? payload.health : null
  const legacy = parseLegacyTelemetryBody(item.body)
  const metrics = telemetryMetricRefs(item)
  const sample = isRecord(health?.sample) ? health.sample : null
  const whyReceived = isRecord(health?.why_received) ? health.why_received : null
  const notificationPolicy = isRecord(health?.notification_policy) ? health.notification_policy : null
  const breakdowns = telemetryBreakdowns(health?.breakdowns)
  const score = numberValue(health?.health_score) ?? scoreFromSummary(item.summary)
  const issues = telemetryIssueList(health?.issues).length > 0
    ? telemetryIssueList(health?.issues)
    : legacy.issues
  const actions = telemetryActionList(health?.actions).length > 0
    ? telemetryActionList(health?.actions)
    : legacy.actions

  return {
    status: textValue(health?.status) ?? item.severity,
    score,
    window: windowLabelFromRecord(health?.window),
    traces: numberMetric(metrics, 'traces'),
    sample,
    whyReceived,
    notificationPolicy,
    breakdowns,
    issues,
    actions,
    metrics,
  }
}

function parseLegacyTelemetryBody(body: string | null): { issues: TelemetryIssue[]; actions: string[] } {
  if (!body) return { issues: [], actions: [] }

  const issueMatch = body.match(/Issues:\s*(\[[\s\S]*?\])\s*(?:\n\n|$)/)
  let issues: TelemetryIssue[] = []
  if (issueMatch?.[1]) {
    try {
      issues = telemetryIssueList(JSON.parse(issueMatch[1]))
    } catch {
      issues = []
    }
  }

  const actionMatch = body.match(/Acoes sugeridas:\s*([\s\S]+)$/)
  const actions = actionMatch?.[1]
    ?.split('|')
    .map((entry) => entry.trim())
    .filter(Boolean) ?? []

  return { issues, actions }
}

function telemetryIssueList(value: unknown): TelemetryIssue[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return []
    const key = textValue(entry.key)
    const severity = textValue(entry.severity)
    if (!key || !severity) return []
    return [{
      key,
      severity,
      value: entry.value,
      threshold: entry.threshold,
      summary: textValue(entry.summary),
    }]
  })
}

function telemetryActionList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((entry) => textValue(entry)).filter((entry): entry is string => typeof entry === 'string')
}

function telemetryMetricRefs(item: AtlasOperationalInboxItem): Array<{ name: string; value: unknown }> {
  const refs = item.context_bundle?.metric_refs
  if (!Array.isArray(refs)) return []
  return refs.flatMap((ref) => {
    if (!isRecord(ref)) return []
    const name = textValue(ref.name)
    if (!name) return []
    return [{ name, value: ref.value }]
  })
}

function telemetryBreakdowns(value: unknown): Record<string, Array<Record<string, unknown>>> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).map(([key, rows]) => [
    key,
    Array.isArray(rows) ? rows.filter(isRecord) : [],
  ]))
}

function whyReceivedText(report: TelemetryHealthReport): string {
  const message = textValue(report.whyReceived?.message)
    ?? 'O monitor automatico de telemetria abriu este item porque encontrou sinais fora do limite.'
  const scheduler = textValue(report.whyReceived?.scheduler)
  const cadence = textValue(report.whyReceived?.cadence)
  const notification = textValue(report.whyReceived?.notification_label)
    ?? notificationPolicyLabel(report.notificationPolicy)
  const parts = [message, notification ? `Notificacao: ${notification}` : null]

  if (scheduler || cadence) {
    parts.push(`Origem: ${scheduler ?? 'monitor de telemetria'}${cadence === 'hourly' ? ', roda de hora em hora' : ''}.`)
  }

  return parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join('\n')
}

function notificationPolicyLabel(policy: Record<string, unknown> | null): string | null {
  const send = textValue(policy?.send)
  if (send === 'none') return 'sem push imediato; fica no Inbox e no relatorio da manha.'
  if (send === 'immediate') return 'push imediato porque o sinal pode afetar a operacao agora.'
  if (send === 'auto') return 'pode ser agrupado com outras atualizacoes.'
  return null
}

function sampleConfidence(report: TelemetryHealthReport): string | null {
  return textValue(report.sample?.confidence)
}

function sampleMessage(report: TelemetryHealthReport): string | null {
  return textValue(report.sample?.message)
}

function telemetryPrimaryMetrics(report: TelemetryHealthReport): Array<{ name: string; value: unknown }> {
  const byName = new Map(report.metrics.map((metric) => [metric.name, metric.value]))
  const traces = numberMetric(report.metrics, 'traces')
  const unknownCostCount = numberMetric(report.metrics, 'unknown_cost_count')
  if (!byName.has('unknown_cost_rate') && traces && unknownCostCount != null) {
    byName.set('unknown_cost_rate', unknownCostCount / traces)
  }

  return [
    'traces',
    'final_quality_avg',
    'final_efficiency_avg',
    'first_pass_success_rate',
    'unknown_cost_rate',
    'total_latency_avg_ms',
    'app_visible_avg_ms',
  ].flatMap((name) => (byName.has(name) ? [{ name, value: byName.get(name) }] : []))
}

function numberMetric(metrics: Array<{ name: string; value: unknown }>, name: string): number | null {
  const value = metrics.find((metric) => metric.name === name)?.value
  return numberValue(value)
}

function numberValue(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function scoreFromSummary(summary: string | null): number | null {
  const match = summary?.match(/score\s+(\d+(?:\.\d+)?)\/100/i)
  if (!match?.[1]) return null
  const score = Number(match[1])
  return Number.isFinite(score) ? score : null
}

function windowLabelFromRecord(value: unknown): string | null {
  if (!isRecord(value)) return null
  const since = textValue(value.since)
  const until = textValue(value.until)
  if (!since || !until) return null
  const start = dateTimeLabel(since)
  const end = dateTimeLabel(until)
  return start && end ? `${start} ate ${end}` : null
}

function metricLabel(key: string): string {
  switch (key) {
    case 'traces':
      return 'Traces analisados'
    case 'final_quality_avg':
      return 'Qualidade media'
    case 'final_efficiency_avg':
      return 'Eficiencia media'
    case 'context_efficiency_avg':
      return 'Eficiencia de contexto'
    case 'first_pass_success_rate':
      return 'First-pass'
    case 'unknown_cost_rate':
      return 'Custo desconhecido'
    case 'unknown_cost_count':
      return 'Traces sem custo'
    case 'low_quality_rate':
      return 'Baixa qualidade'
    case 'total_latency_avg_ms':
      return 'Latencia media'
    case 'app_visible_avg_ms':
      return 'Latencia visivel'
    case 'needed_remediation_rate':
      return 'Remediacao'
    case 'slow_trace_rate':
      return 'Traces lentas'
    default:
      return humanize(key)
  }
}

function metricHint(key: string): string {
  switch (key) {
    case 'traces':
      return 'Tamanho da amostra usada no diagnostico.'
    case 'final_quality_avg':
      return 'Score medio de qualidade das respostas.'
    case 'final_efficiency_avg':
      return 'Score medio de eficiencia operacional.'
    case 'first_pass_success_rate':
      return 'Percentual que passou de primeira, sem retrabalho.'
    case 'unknown_cost_rate':
      return 'Parte das execucoes sem custo calculado.'
    case 'total_latency_avg_ms':
      return 'Tempo medio medido na execucao.'
    case 'app_visible_avg_ms':
      return 'Tempo percebido no app, quando existe evento mobile.'
    default:
      return 'Metrica de apoio para investigar o item.'
  }
}

function formatMetricValue(key: string, value: unknown): string {
  const number = numberValue(value)
  if (number == null) return 'sem dado'
  if (key.endsWith('_rate') || key === 'first_pass_success_rate' || key === 'needed_remediation_rate') {
    return `${formatNumber(number * 100, 2)}%`
  }
  if (key.endsWith('_ms')) {
    return number >= 1000 ? `${formatNumber(number / 1000, 2)}s` : `${Math.round(number)}ms`
  }
  return formatNumber(number, 2)
}

function formatNumber(value: number, maximumFractionDigits = 2): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  })
}

function issueMeaning(issue: TelemetryIssue): string {
  switch (issue.key) {
    case 'final_quality_avg':
      return 'As respostas recentes ficaram abaixo do padrao esperado.'
    case 'final_efficiency_avg':
      return 'O Atlas esta usando mais esforco do que deveria para chegar ao resultado.'
    case 'first_pass_success_rate':
      return 'Poucas execucoes estao ficando boas na primeira tentativa.'
    case 'unknown_cost_rate':
      return 'A telemetria nao consegue calcular custo com confianca para essa janela.'
    case 'low_quality_rate':
      return 'Uma parte alta das execucoes recentes recebeu score baixo.'
    case 'slow_trace_rate':
    case 'app_visible_avg_ms':
      return 'A experiencia pode parecer lenta para quem usa o app.'
    default:
      return issue.summary ?? 'Sinal fora do limite configurado.'
  }
}

function translateTelemetryAction(action: string): string {
  if (action.startsWith('Open recent low-score traces')) {
    return 'Abrir traces recentes com score baixo e revisar prompt, contexto e provider antes de mudar comportamento.'
  }
  if (action.startsWith('Configure operational estimate cost rates')) {
    return action
      .replace('Configure operational estimate cost rates for ', 'Configurar taxas estimadas de custo para ')
      .replace(' and rerun telemetry rollup.', ' e rodar o rollup de telemetria novamente.')
  }
  if (action.startsWith('Fix provider/model attribution')) {
    return 'Corrigir a atribuicao de provider/model nos traces com custo desconhecido antes de importar taxas.'
  }
  if (action.startsWith('Review quality flags')) {
    return 'Revisar flags de qualidade e feedback humano recente; ajustar selecao de contexto ou politica de resposta primeiro.'
  }
  if (action.startsWith('Check queue wait')) {
    return 'Separar tempo de fila, latencia do provider e eventos de visibilidade no app para descobrir onde o tempo esta sendo gasto.'
  }
  if (action.startsWith('Compare first-pass failures')) {
    return 'Comparar falhas de first-pass com traces bem-sucedidos por tipo de tarefa e provider.'
  }
  return action
}

function detailsForItem(item: AtlasOperationalInboxItem): DetailRow[] {
  const payload = item.payload ?? {}
  const reportRows = detailsForReport(payload.report)

  if (reportRows.length > 0) {
    return reportRows
  }

  const recommendationRows = detailsForRecommendation(payload.recommendation)
  if (recommendationRows.length > 0) {
    return recommendationRows
  }

  if (item.type === 'proposal') {
    return [
      { label: 'O que encontrou', value: payloadText(payload, 'finding') ?? item.summary },
      { label: 'Problema', value: payloadText(payload, 'problem') },
      { label: 'Solucao', value: payloadText(payload, 'solution') },
      { label: 'Vale a pena', value: payloadText(payload, 'worth_it') },
      { label: 'Alternativas', value: listText(payload.alternatives) },
      { label: 'Branch', value: payloadText(payload, 'branch') },
      { label: 'Politica', value: compactJson(payload.policy, 360) },
    ].filter((row) => row.value)
  }

  if (item.type === 'self_diagnostic') {
    return [
      { label: 'Observacao', value: payloadText(payload, 'observation') },
      { label: 'Hipotese', value: payloadText(payload, 'hypothesis') },
      { label: 'Correcao proposta', value: payloadText(payload, 'proposed_fix') },
      { label: 'Metricas', value: compactJson(payload.metrics, 520) },
      { label: 'Proposta criada', value: payloadText(payload, 'proposal_inbox_item_id') },
      { label: 'Ignorado ate', value: dateTimeLabel(payloadText(payload, 'ignored_until')) },
    ].filter((row) => row.value)
  }

  if (item.type === 'job_result' || item.type === 'job_status') {
    return [
      { label: 'Status', value: payloadText(payload, 'status') },
      { label: 'Importancia', value: payloadText(payload, 'importance') },
      { label: 'Kind', value: payloadText(payload, 'kind') },
      { label: 'Provider', value: payloadText(payload, 'provider') },
      { label: 'Model', value: payloadText(payload, 'model') },
      { label: 'Duracao', value: durationText(payload.duration_ms) },
      { label: 'Erro', value: [payloadText(payload, 'error_code'), payloadText(payload, 'error_message')].filter(Boolean).join(' - ') || null },
      { label: 'Job', value: payloadText(payload, 'job_id') },
      { label: 'Trace', value: payloadText(payload, 'trace_id') },
    ].filter((row) => row.value)
  }

  if (item.type === 'insight') {
    return [
      { label: 'Categoria', value: payloadText(payload, 'category') ?? item.category },
      { label: 'Tipo', value: payloadText(payload, 'insight_kind') },
      { label: 'Confianca', value: payloadNumber(payload.confidence, true) },
    ].filter((row) => row.value)
  }

  return Object.entries(payload)
    .slice(0, 8)
    .map(([label, value]) => ({ label: humanize(label), value: valueToText(value) }))
    .filter((row) => row.value)
}

function detailTitle(type: string): string {
  switch (type) {
    case 'proposal':
      return 'Proposta'
    case 'self_diagnostic':
      return 'Auto-diagnostico'
    case 'job_result':
    case 'job_status':
      return 'Resultado do job'
    case 'insight':
      return 'Insight'
    default:
      return 'Detalhes'
  }
}

function detailsForReport(value: unknown): DetailRow[] {
  if (!isRecord(value)) return []

  return [
    { label: 'Decisao', value: textValue(value.decision) },
    { label: 'Achados', value: listText(value.highlights) },
    { label: 'Proximas acoes', value: listText(value.next_actions) },
    { label: 'Riscos', value: listText(value.risks) },
    { label: 'Validacao', value: compactJson(value.validation, 520) },
    { label: 'Relatorio', value: textValue(value.full_text) },
  ].filter((row) => row.value)
}

function detailsForRecommendation(value: unknown): DetailRow[] {
  if (!isRecord(value)) return []

  return [
    { label: 'Estado', value: textValue(value.state) },
    { label: 'Tipo', value: textValue(value.kind) },
    { label: 'Metrica alvo', value: textValue(value.target_metric) },
    { label: 'Dimensao', value: compactJson(value.target_dimension, 360) },
    { label: 'Impacto esperado', value: recommendationImpactText(value.expected_impact) },
    { label: 'Baseline', value: compactJson(value.baseline_snapshot, 420) },
    { label: 'Impacto observado', value: compactJson(value.observed_impact, 420) },
    { label: 'Medicao', value: measurementText(value) },
    { label: 'Adiada ate', value: dateTimeLabel(textValue(value.snoozed_until)) },
    { label: 'Fechada em', value: dateTimeLabel(textValue(value.closed_at)) },
    { label: 'Motivo de fechamento', value: textValue(value.closed_reason) },
    { label: 'Prioridade', value: payloadNumber(value.priority_score) },
  ].filter((row) => row.value)
}

function threadIdFromActionResult(result: Record<string, unknown>): string | null {
  const threadId = result.thread_id
  if (typeof threadId === 'string' && threadId !== '') return threadId

  const deepLink = result.deep_link
  if (typeof deepLink !== 'string') return null

  const match = deepLink.match(/^atlas:\/\/thread\/([^/?#]+)/)
  return match?.[1] ?? null
}

function actionMessage(actionId: string, result: Record<string, unknown>): string {
  if (actionId === 'create_proposal' && typeof result.proposal_item_id === 'string') return 'proposta criada no Inbox'
  if (actionId === 'ignore_30d') return 'auto-diagnostico ignorado por 30 dias'
  if (actionId === 'acknowledge_recommendation') return 'recomendacao reconhecida'
  if (actionId === 'apply_recommendation') return 'recomendacao marcada como aplicada'
  if (actionId === 'reject_recommendation') return 'recomendacao rejeitada'
  if (actionId === 'review_patch') return 'proposta marcada para revisao'
  if (actionId === 'view_trace') return 'trace marcado para revisao'
  if (actionId === 'mark_read') return 'marcado como lido'
  return 'acao aplicada'
}

function payloadText(payload: Record<string, unknown>, key: string): string | null {
  return textValue(payload[key])
}

function textValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function valueToText(value: unknown): string | null {
  return textValue(value) ?? listText(value) ?? compactJson(value, 420)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function listText(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null
  return value.map((entry) => textValue(entry) ?? compactJson(entry, 180)).join('\n')
}

function payloadNumber(value: unknown, percent = false): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return percent ? `${Math.round(value * 100)}%` : String(value)
}

function recommendationImpactText(value: unknown): string | null {
  if (!isRecord(value)) return null
  const parts = [
    textValue(value.direction),
    payloadNumber(value.magnitude, true),
    textValue(value.rationale),
  ].filter((part): part is string => typeof part === 'string' && part.length > 0)

  return parts.length > 0 ? parts.join(' - ') : compactJson(value, 360)
}

function measurementText(value: Record<string, unknown>): string | null {
  const dueAt = dateTimeLabel(textValue(value.measurement_due_at))
  const windowDays = payloadNumber(value.measurement_window_days)
  const parts = [
    windowDays ? `${windowDays} dias` : null,
    dueAt ? `proxima: ${dueAt}` : null,
  ].filter((part): part is string => typeof part === 'string')

  return parts.length > 0 ? parts.join(' - ') : null
}

function durationText(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < 1000) return `${Math.round(value)}ms`
  return `${(value / 1000).toFixed(1)}s`
}

function compactJson(value: unknown, limit = 320): string | null {
  if (value == null) return null
  try {
    const text = JSON.stringify(value, null, 2)
    return text.length > limit ? `${text.slice(0, limit - 3)}...` : text
  } catch {
    return String(value)
  }
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function typeLabel(type: string): string {
  switch (type) {
    case 'self_diagnostic':
      return 'auto-diagnostico'
    case 'job_result':
      return 'job'
    case 'thread_update':
      return 'thread'
    default:
      return type.replace(/_/g, ' ')
  }
}

function dateLabel(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function dateTimeLabel(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function daysFromNowIso(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function severityColor(severity: string, c: ReturnType<typeof usePalette>, soft = false): string {
  if (severity === 'critical' || severity === 'warning') return soft ? `${c.recRed}18` : c.recRed
  return soft ? c.surface : c.ink3
}

const styles = StyleSheet.create({
  topBar: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  roundButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshButton: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    marginBottom: 18,
  },
  metaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  metaPill: {
    maxWidth: '100%',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  stack: {
    gap: 12,
  },
  panel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 15,
  },
  loadingPanel: {
    gap: 12,
  },
  sectionBody: {
    marginTop: 12,
    gap: 14,
  },
  textBlock: {
    gap: 7,
  },
  preWrap: {
    flexShrink: 1,
  },
  diagnosticHeader: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  diagnosticCopy: {
    flex: 1,
    gap: 5,
  },
  scoreBadge: {
    width: 74,
    minHeight: 62,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  sampleNotice: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  explainGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  explainTile: {
    width: '48%',
    minHeight: 58,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  issueList: {
    gap: 8,
  },
  issueRow: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  issueTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionAdviceList: {
    gap: 8,
  },
  adviceRow: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
  },
  metricRows: {
    gap: 8,
  },
  metricRow: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricCopy: {
    flex: 1,
    gap: 4,
  },
  breakdownGroup: {
    gap: 8,
  },
  breakdownRows: {
    gap: 8,
  },
  breakdownRow: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rows: {
    gap: 12,
  },
  detailLine: {
    gap: 5,
  },
  detailLineCompact: {
    gap: 3,
  },
  detailLabel: {
    textTransform: 'uppercase',
  },
  refGroups: {
    gap: 16,
  },
  refGroup: {
    gap: 8,
  },
  refs: {
    gap: 7,
  },
  refRow: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  actionStack: {
    gap: 9,
  },
  snoozeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  snoozeChip: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  snoozeCancel: {
    minHeight: 34,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  detailAction: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorPanel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    padding: 14,
  },
})
