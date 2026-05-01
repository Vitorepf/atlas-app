import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { useShell } from '../components/AtlasShell'
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
        router.push({ pathname: '/mobile-thread', params: { threadId } })
      } else {
        showToast('thread contextual criada')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir thread contextual.')
    } finally {
      setBusyActionId(null)
    }
  }, [router, showToast])

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
          <SummaryPanel item={item} />
          <TypeDetails item={item} />
          <ContextPanel item={item} />
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
  const rows: DetailRow[] = [
    { label: 'ID', value: item.id },
    { label: 'Fonte', value: [item.source_type, item.source_id].filter(Boolean).join(' / ') || null },
    { label: 'Iniciador', value: item.initiator },
    { label: 'Dedupe', value: item.dedupe_key },
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

function detailsForItem(item: AtlasOperationalInboxItem): DetailRow[] {
  const payload = item.payload ?? {}
  const reportRows = detailsForReport(payload.report)

  if (reportRows.length > 0) {
    return reportRows
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
