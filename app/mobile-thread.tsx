import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { PrimaryButton } from '../components/PrimaryButton'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { fonts } from '../design/tokens'
import { usePalette } from '../design/theme'
import { useShell } from '../components/AtlasShell'
import { useProviderChoice } from '../lib/hooks/useProviderChoice'
import { copyToClipboard, COPY_LONG_PRESS_DELAY } from '../lib/clipboard'
import {
  atlasAiContextLabel,
  atlasAiContextMeta,
  atlasAiFocusFromThread,
  atlasAiFocusLabel,
  normalizeAtlasAiFocus,
} from '../lib/atlasAiFocus'
import {
  getMobileAiThread,
  replyMobileAiThread,
  type AtlasAiAttachment,
  type AtlasAiMessage,
  type AtlasMobileThreadContext,
  type AtlasAiThread,
  type AtlasAiTrace,
} from '../lib/api/client'

export default function MobileThreadScreen() {
  const c = usePalette()
  const router = useRouter()
  const { showToast } = useShell()
  const params = useLocalSearchParams<{ threadId?: string }>()
  const threadId = typeof params.threadId === 'string' ? params.threadId : null
  const [thread, setThread] = useState<AtlasAiThread | null>(null)
  const [traces, setTraces] = useState<AtlasAiTrace[]>([])
  const [mobileContext, setMobileContext] = useState<AtlasMobileThreadContext | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const messages = useMemo(() => sortMessages(thread?.messages ?? []), [thread?.messages])
  const activeTraces = useMemo(() => pendingTraces(traces), [traces])
  const attentionTraces = useMemo(() => tracesNeedingAttention(traces), [traces])
  const atlasFocus = useMemo(() => atlasAiFocusFromThread(thread), [thread])
  const contextLabel = useMemo(() => atlasAiContextLabel(thread), [thread])
  const contextMeta = useMemo(() => atlasAiContextMeta(thread), [thread])
  const canSubmit = Boolean(threadId && draft.trim().length > 0 && !submitting && activeTraces.length === 0)

  useProviderChoice(traces)

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!threadId) {
      setError('Conversa do Atlas nao informada.')
      setLoading(false)
      return
    }

    if (!silent) setLoading(true)
    setError(null)
    try {
      const threadResponse = await getMobileAiThread(threadId)
      setThread(threadResponse.thread)
      setTraces(sortTraces(threadResponse.traces ?? []))
      setMobileContext(threadResponse.mobile_context ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar Atlas.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [threadId])

  useEffect(() => {
    void load()
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
    }
  }, [load])

  useEffect(() => {
    if (!threadId || activeTraces.length === 0) return
    const oldestActive = activeTraces.reduce<number | null>((oldest, trace) => {
      const time = new Date(trace.created_at).getTime()
      if (!Number.isFinite(time)) return oldest
      return oldest == null ? time : Math.min(oldest, time)
    }, null)
    const ageMs = oldestActive == null ? 0 : Date.now() - oldestActive
    const delay = ageMs < 30_000 ? 1800 : ageMs < 180_000 ? 3200 : 6000
    const timer = setTimeout(() => void load({ silent: true }), delay)
    return () => clearTimeout(timer)
  }, [activeTraces, load, threadId])

  const submit = async () => {
    if (!canSubmit) return
    await submitText(draft.trim(), { restoreDraftOnError: true })
  }

  const submitText = async (text: string, { restoreDraftOnError = false }: { restoreDraftOnError?: boolean } = {}) => {
    if (!threadId || submitting || activeTraces.length > 0) return

    text = text.trim()
    if (text.length === 0) return

    const clientId = newClientId()
    setSubmitting(true)
    setError(null)
    if (restoreDraftOnError) setDraft('')
    try {
      const response = await replyMobileAiThread(threadId, {
        input_text: text,
        client_id: clientId,
        include_semantic_context: true,
        context_note_limit: 5,
        payload: {
          app_surface: 'mobile_thread',
          thread_source: 'mobile_gateway_inbox',
          atlas_focus: atlasFocus,
        },
      })
      setThread(response.thread)
      setTraces((current) => mergeTrace(response.trace, current))
      if (reloadTimer.current) clearTimeout(reloadTimer.current)
      reloadTimer.current = setTimeout(() => {
        reloadTimer.current = null
        void load({ silent: true })
      }, 900)
      showToast('mensagem enviada')
    } catch (err) {
      if (restoreDraftOnError) setDraft(text)
      setError(err instanceof Error ? err.message : 'Falha ao enviar mensagem ao Atlas.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Screen topExtra={18}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backButton, { backgroundColor: pressed ? c.surface : c.premium, borderColor: c.border }]}
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
        <Label>Atlas</Label>
        <Frau size={38} lineHeight={41} color={c.ink} numberOfLines={2} style={{ marginTop: 6 }}>
          {thread?.title ?? 'Atlas'}
        </Frau>
        <AtlasAiContextStrip
          focusLabel={atlasAiFocusLabel(atlasFocus)}
          contextLabel={contextLabel}
          contextMeta={contextMeta}
        />
        {thread?.summary ? (
          <Sans size={13} lineHeight={19} color={c.ink2} style={{ marginTop: 10 }}>
            {thread.summary}
          </Sans>
        ) : null}
      </View>

      {loading ? (
        <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
          <ActivityIndicator color={c.prussian} />
          <Sans size={13} lineHeight={18} color={c.ink2} align="center">
            Carregando Atlas...
          </Sans>
        </View>
      ) : (
        <View style={styles.stack}>
          <AtlasAiOperationalContextPanel context={mobileContext} />

          {messages.length === 0 ? (
            <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
              <Sans size={13} lineHeight={18} color={c.ink2}>
                Esta conversa do Atlas ainda nao tem mensagens visiveis.
              </Sans>
            </View>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}

          <TraceStatusPanel
            traces={attentionTraces}
            submitting={submitting}
            onRetry={(text) => void submitText(text)}
            onRefresh={() => void load({ silent: true })}
          />

          <View style={[styles.composer, { borderColor: c.border, backgroundColor: c.surface }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={atlasFocus === 'operational' ? 'Pergunte sobre este item ao Atlas...' : 'Responder ao Atlas...'}
              placeholderTextColor={c.ink3}
              multiline
              selectionColor={c.ink}
              style={[styles.input, { color: c.ink }]}
            />
            <PrimaryButton
              label={submitting ? 'Enviando...' : activeTraces.length > 0 ? 'Processando...' : 'Enviar'}
              onPress={canSubmit ? () => void submit() : undefined}
              style={!canSubmit ? { opacity: 0.55 } : undefined}
            />
          </View>
        </View>
      )}

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

function AtlasAiContextStrip({
  focusLabel,
  contextLabel,
  contextMeta,
}: {
  focusLabel: string
  contextLabel: string | null
  contextMeta: string | null
}) {
  const c = usePalette()

  return (
    <View style={styles.contextStrip}>
      <View style={[styles.contextPill, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Mono size={10.5} lineHeight={14} color={c.prussian} letterSpacing={0.2} numberOfLines={1}>
          Foco: {focusLabel}
        </Mono>
      </View>
      {contextLabel ? (
        <View style={[styles.contextPill, styles.contextPillWide, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Mono size={10.5} lineHeight={14} color={c.ink2} letterSpacing={0.2} numberOfLines={1}>
            Contexto: {contextLabel}
          </Mono>
        </View>
      ) : null}
      {contextMeta ? (
        <Sans size={11.5} lineHeight={16} color={c.ink3} style={styles.contextMeta}>
          {contextMeta}
        </Sans>
      ) : null}
    </View>
  )
}

function AtlasAiOperationalContextPanel({ context }: { context: AtlasMobileThreadContext | null }) {
  const c = usePalette()
  if (!context) return null

  const bundle = context.context_bundle
  const focusLabel = atlasAiFocusLabel(normalizeAtlasAiFocus(context.policy.atlas_focus))
  const refs = contextRefBadges(context.refs_count)
  const badgeLabel = bundle?.redaction_status === 'redacted' ? 'redigido' : 'auditável'

  return (
    <View style={[styles.contextPanel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.contextPanelHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Contexto usado</Label>
          <Sans size={13.5} lineHeight={19} color={c.ink} style={{ marginTop: 7 }} numberOfLines={2}>
            {bundle?.title ?? context.source.title}
          </Sans>
        </View>
        <View style={[styles.contextBadge, { borderColor: c.border }]}>
          <Mono size={10.5} lineHeight={14} color={c.prussian} letterSpacing={0.2}>
            {badgeLabel}
          </Mono>
        </View>
      </View>

      {context.source.summary ? (
        <Sans size={12.5} lineHeight={18} color={c.ink2}>
          {context.source.summary}
        </Sans>
      ) : null}

      {bundle?.body_preview ? (
        <Sans size={12.5} lineHeight={18} color={c.ink2} numberOfLines={4}>
          {bundle.body_preview}
        </Sans>
      ) : null}

      <View style={styles.contextDataGrid}>
        <ContextDataPoint label="Foco" value={focusLabel} />
        <ContextDataPoint label="Permissão" value={permissionPolicyLabel(context.policy.permission_policy)} />
        <ContextDataPoint label="Execução" value={executionPolicyLabel(context.policy.execution_policy, context.policy.allows_code_execution)} />
        <ContextDataPoint label="Evidências" value={String(context.refs_count.total)} />
      </View>

      {refs.length > 0 ? (
        <View style={styles.contextRefRow}>
          {refs.map((ref) => (
            <View key={ref.label} style={[styles.contextRefChip, { borderColor: c.border }]}>
              <Mono size={10.5} lineHeight={14} color={c.ink2} letterSpacing={0.2}>
                {ref.label}: {ref.value}
              </Mono>
            </View>
          ))}
        </View>
      ) : null}

      <Sans size={11.5} lineHeight={16} color={c.ink3}>
        Esta conversa usa contexto auditável do Inbox. Alterações em código, produção ou automações precisam virar aprovação operacional antes de executar.
      </Sans>
    </View>
  )
}

function ContextDataPoint({ label, value }: { label: string; value: string }) {
  const c = usePalette()

  return (
    <View style={styles.contextDataPoint}>
      <Mono size={9.8} lineHeight={12} color={c.ink3} letterSpacing={0.4}>
        {label.toUpperCase()}
      </Mono>
      <Sans weight="med" size={12.5} lineHeight={17} color={c.ink} numberOfLines={2}>
        {value}
      </Sans>
    </View>
  )
}

function MessageBubble({ message }: { message: AtlasAiMessage }) {
  const c = usePalette()
  const { showToast } = useShell()
  const isAssistant = message.role === 'assistant'
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  return (
    <Pressable
      onLongPress={() => void copyToClipboard(message.content, () => showToast('Copiado'))}
      delayLongPress={COPY_LONG_PRESS_DELAY}
      accessibilityHint="pressionar e segurar copia o texto da mensagem"
      style={({ pressed }) => [
        styles.message,
        {
          borderColor: c.border,
          backgroundColor: isAssistant ? c.surface : isUser ? c.premium : 'transparent',
          alignSelf: isUser ? 'flex-end' : 'stretch',
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.messageHeader}>
        <Mono size={10.5} lineHeight={14} color={isSystem ? c.ink3 : c.ink2} letterSpacing={0.3}>
          {roleLabel(message.role)}
        </Mono>
        <Mono size={10.5} lineHeight={14} color={c.ink3} letterSpacing={0.2}>
          {timeLabel(message.occurred_at ?? message.created_at)}
        </Mono>
      </View>
      <Sans size={13.5} lineHeight={20} color={isSystem ? c.ink2 : c.ink}>
        {message.content}
      </Sans>
      <MessageAttachments attachments={messageAttachments(message)} />
    </Pressable>
  )
}

function MessageAttachments({ attachments }: { attachments: AtlasAiAttachment[] }) {
  const c = usePalette()
  if (attachments.length === 0) return null

  return (
    <View style={styles.messageAttachments}>
      {attachments.map((attachment) => (
        <View key={attachment.id} style={[styles.attachmentChip, { borderColor: c.border }]}>
          <Mono size={10} lineHeight={13} letterSpacing={0} color={c.ink2}>
            {attachment.kind === 'image' ? 'IMG' : fileExtensionLabel(attachment.name)}
          </Mono>
          <Sans size={11.5} lineHeight={15} color={c.ink} numberOfLines={1} style={styles.attachmentName}>
            {attachment.name}
          </Sans>
          <Mono size={9.5} lineHeight={12} letterSpacing={0} color={c.ink3}>
            {formatBytes(attachment.bytes)}
          </Mono>
        </View>
      ))}
    </View>
  )
}

function TraceStatusPanel({
  traces,
  submitting,
  onRetry,
  onRefresh,
}: {
  traces: AtlasAiTrace[]
  submitting: boolean
  onRetry: (text: string) => void
  onRefresh: () => void
}) {
  const c = usePalette()
  if (traces.length === 0) return null

  const hasActive = traces.some(isTraceActive)

  return (
    <View style={[styles.executionPanel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.executionHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label>Execução Atlas</Label>
          <Sans size={12.5} lineHeight={18} color={c.ink2} style={{ marginTop: 5 }}>
            {hasActive ? 'Resposta em andamento nesta thread.' : 'A última tentativa falhou antes de responder.'}
          </Sans>
        </View>
        <Pressable
          onPress={onRefresh}
          hitSlop={10}
          style={({ pressed }) => [styles.smallAction, { borderColor: c.border, opacity: pressed ? 0.72 : 1 }]}
        >
          <Sans weight="med" size={11.5} lineHeight={15} color={c.prussian}>
            Atualizar
          </Sans>
        </Pressable>
      </View>

      <View style={styles.executionRows}>
        {traces.map((trace) => (
          <TraceStatusRow
            key={trace.id}
            trace={trace}
            submitting={submitting}
            onRetry={() => onRetry(trace.operator_input)}
          />
        ))}
      </View>
    </View>
  )
}

function TraceStatusRow({
  trace,
  submitting,
  onRetry,
}: {
  trace: AtlasAiTrace
  submitting: boolean
  onRetry: () => void
}) {
  const c = usePalette()
  const failed = trace.status === 'failed'
  const active = isTraceActive(trace)
  const error = friendlyTraceError(trace)
  const statusColor = failed ? c.recRed : active ? c.bronze : c.prussian

  return (
    <View style={[styles.executionRow, { borderColor: c.border, backgroundColor: failed ? `${c.recRed}10` : c.bg }]}>
      <View style={styles.executionTopLine}>
        <Mono size={10.5} lineHeight={14} color={statusColor} letterSpacing={0.25}>
          {traceStatusLabel(trace.status)}
        </Mono>
        <Mono size={10.5} lineHeight={14} color={c.ink3} letterSpacing={0.15}>
          {traceRuntimeLabel(trace)}
        </Mono>
      </View>
      <Sans size={13} lineHeight={19} color={c.ink}>
        {trace.operator_input}
      </Sans>
      <Sans size={12.5} lineHeight={18} color={failed ? c.recRed : c.ink2}>
        {error ?? traceStatusDescription(trace)}
      </Sans>
      {failed ? (
        <Pressable
          onPress={submitting ? undefined : onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            {
              borderColor: c.border,
              backgroundColor: c.surface,
              opacity: submitting ? 0.5 : pressed ? 0.72 : 1,
            },
          ]}
        >
          <Sans weight="med" size={12} lineHeight={16} color={c.prussian}>
            Tentar de novo
          </Sans>
        </Pressable>
      ) : null}
    </View>
  )
}

function sortMessages(messages: AtlasAiMessage[]): AtlasAiMessage[] {
  return [...messages].sort((a, b) => safeNumber(a.position) - safeNumber(b.position))
}

function tracesNeedingAttention(traces: AtlasAiTrace[]): AtlasAiTrace[] {
  const active = traces.filter(isTraceActive)
  const failed = [...traces]
    .filter((trace) => trace.status === 'failed')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 2)

  return sortTraces(dedupeTraces([...active, ...failed]))
}

function dedupeTraces(traces: AtlasAiTrace[]): AtlasAiTrace[] {
  const byId = new Map<string, AtlasAiTrace>()
  traces.forEach((trace) => byId.set(trace.id, trace))
  return [...byId.values()]
}

function pendingTraces(traces: AtlasAiTrace[]): AtlasAiTrace[] {
  return traces.filter(isTraceActive)
}

function isTraceActive(trace: AtlasAiTrace): boolean {
  return ['queued', 'processing', 'awaiting_user_choice'].includes(trace.status)
}

function sortTraces(traces: AtlasAiTrace[]): AtlasAiTrace[] {
  return [...traces].sort((a, b) => {
    const left = new Date(a.created_at).getTime()
    const right = new Date(b.created_at).getTime()
    if (!Number.isFinite(left) || !Number.isFinite(right)) return a.id.localeCompare(b.id)
    return left - right
  })
}

function mergeTrace(trace: AtlasAiTrace, traces: AtlasAiTrace[]): AtlasAiTrace[] {
  return sortTraces([trace, ...traces.filter((item) => item.id !== trace.id)]).slice(-20)
}

function traceJobs(trace: AtlasAiTrace): NonNullable<AtlasAiTrace['job']>[] {
  const jobs = [
    trace.job,
    ...(Array.isArray(trace.jobs) ? trace.jobs : []),
  ].filter((job): job is NonNullable<AtlasAiTrace['job']> => Boolean(job?.id))

  const byId = new Map<string, NonNullable<AtlasAiTrace['job']>>()
  jobs.forEach((job) => byId.set(job.id, job))
  return [...byId.values()]
}

function traceError(trace: AtlasAiTrace): string | null {
  const job = traceJobs(trace).find((candidate) => candidate.error_message || candidate.error_code)
  const message = job?.error_message ?? job?.error_code ?? null
  return typeof message === 'string' && message.trim().length > 0 ? message.trim() : null
}

function friendlyTraceError(trace: AtlasAiTrace): string | null {
  const error = traceError(trace)
  if (!error) return null

  const normalized = error.toLowerCase()
  if (normalized.includes('danger-full-access') || normalized.includes('permission_denied')) {
    return 'Falhou por permissão de runtime. Esta conversa agora usa modo leitura seguro; tente de novo.'
  }

  return error
}

function traceRuntimeLabel(trace: AtlasAiTrace): string {
  const job = traceJobs(trace)[0]
  const provider = trace.provider ?? job?.provider ?? 'provider n/d'
  const model = trace.model ?? job?.model
  const status = job?.status && job.status !== trace.status ? ` · job ${job.status}` : ''
  return `${provider}${model ? `/${model}` : ''}${status}`
}

function traceStatusLabel(status: string): string {
  switch (status) {
    case 'queued': return 'na fila'
    case 'processing': return 'rodando'
    case 'awaiting_user_choice': return 'aguardando escolha'
    case 'failed': return 'falhou'
    case 'succeeded': return 'concluído'
    case 'cancelled': return 'cancelado'
    default: return status
  }
}

function traceStatusDescription(trace: AtlasAiTrace): string {
  switch (trace.status) {
    case 'queued': return 'A mensagem foi registrada e aguarda o worker do Atlas.'
    case 'processing': return 'O provider está trabalhando na resposta.'
    case 'awaiting_user_choice': return 'O Atlas precisa de uma escolha de provider ou política para continuar.'
    case 'failed': return 'A execução terminou sem resposta.'
    default: return `Atualizado ${timeLabel(trace.updated_at)}.`
  }
}

function permissionPolicyLabel(value: string): string {
  switch (value) {
    case 'read_only_until_approval':
      return 'Leitura até aprovação'
    case 'read_only':
      return 'Somente leitura'
    case 'approval_required':
      return 'Aprovação obrigatória'
    default:
      return humanizeKey(value)
  }
}

function executionPolicyLabel(value: string, allowsCodeExecution: boolean): string {
  if (!allowsCodeExecution || value === 'no_code_execution') {
    return 'Sem execução'
  }

  return humanizeKey(value)
}

function contextRefBadges(counts: AtlasMobileThreadContext['refs_count']): Array<{ label: string; value: number }> {
  return [
    { label: 'fontes', value: counts.sources },
    { label: 'traces', value: counts.traces },
    { label: 'jobs', value: counts.jobs },
    { label: 'métricas', value: counts.metrics },
    { label: 'arquivos', value: counts.files },
    { label: 'diffs', value: counts.diffs },
  ].filter((item) => item.value > 0)
}

function humanizeKey(value: string): string {
  const normalized = value.replace(/[_-]+/g, ' ').trim()
  if (!normalized) return 'n/d'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function messageAttachments(message: AtlasAiMessage): AtlasAiAttachment[] {
  const attachments = message.metadata?.attachments
  return Array.isArray(attachments) ? attachments.filter(isAtlasAiAttachment) : []
}

function isAtlasAiAttachment(value: unknown): value is AtlasAiAttachment {
  if (!value || typeof value !== 'object') return false
  const attachment = value as Partial<AtlasAiAttachment>
  return typeof attachment.id === 'string'
    && typeof attachment.kind === 'string'
    && typeof attachment.name === 'string'
}

function fileExtensionLabel(fileName: string): string {
  const extension = fileName.split('.').pop()?.trim().toUpperCase()
  return extension && extension.length <= 5 ? extension : 'FILE'
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return 'tamanho n/d'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function newClientId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16)
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8
    return value.toString(16)
  })
}

function roleLabel(role: string): string {
  switch (role) {
    case 'assistant': return 'Atlas'
    case 'user': return 'Vitor'
    case 'system': return 'Contexto'
    case 'tool': return 'Tool'
    case 'summary': return 'Resumo'
    default: return role
  }
}

function timeLabel(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

const styles = StyleSheet.create({
  topBar: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
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
  contextStrip: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  contextPill: {
    minHeight: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextPillWide: {
    maxWidth: '100%',
  },
  contextMeta: {
    width: '100%',
  },
  stack: {
    gap: 12,
  },
  panel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  contextPanel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  contextPanelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  contextBadge: {
    minHeight: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextDataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  contextDataPoint: {
    width: '47%',
    minHeight: 48,
    justifyContent: 'flex-start',
    gap: 5,
  },
  contextRefRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  contextRefChip: {
    minHeight: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    maxWidth: '100%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  messageAttachments: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attachmentChip: {
    maxWidth: 180,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  attachmentName: {
    maxWidth: 150,
  },
  executionPanel: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12,
  },
  executionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  smallAction: {
    minHeight: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  executionRows: {
    gap: 8,
  },
  executionRow: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 8,
  },
  executionTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  retryButton: {
    alignSelf: 'flex-start',
    minHeight: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composer: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 12,
  },
  input: {
    minHeight: 96,
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 4,
    paddingVertical: 4,
    textAlignVertical: 'top',
  },
  errorPanel: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    padding: 14,
  },
})
