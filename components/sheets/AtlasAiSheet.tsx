import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { SideSheet } from './SideSheet'
import { Frau, Label, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { fonts, type AtlasPalette } from '../../design/tokens'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShell } from '../AtlasShell'
import { useOverlays } from '../../lib/overlays'
import {
  type AtlasAiProvider,
  type AtlasAiStatus,
  type AtlasAiTrace,
  type AiProvidersStatusResponse,
  createAiInteraction,
  feedbackAiInteraction,
  getAiProvidersStatus,
  listAiInteractions,
} from '../../lib/api/client'

const ACTIVE_STATUSES = new Set<AtlasAiStatus>(['queued', 'processing'])
type WorkMode = 'direct' | 'plan' | 'review'
type ProviderMode = 'auto' | AtlasAiProvider | 'claude_codex'
type AgentMode = 'auto' | 'vault-curador' | 'saude' | 'blackink' | 'financas'

const WORK_MODES: Array<{ key: WorkMode; label: string; kind: 'interaction' | 'analysis' }> = [
  { key: 'direct', label: 'Responder', kind: 'interaction' },
  { key: 'plan', label: 'Planejar', kind: 'analysis' },
  { key: 'review', label: 'Revisar', kind: 'analysis' },
]

const AGENT_MODES: Array<{ key: AgentMode; label: string }> = [
  { key: 'auto', label: 'Auto' },
  { key: 'vault-curador', label: 'Vault' },
  { key: 'saude', label: 'Saúde' },
  { key: 'blackink', label: 'BlackInk' },
  { key: 'financas', label: 'Finanças' },
]

const PROVIDER_MODES: Array<{ key: ProviderMode; label: string }> = [
  { key: 'auto', label: 'Auto' },
  { key: 'claude_cli', label: 'Claude' },
  { key: 'codex_cli', label: 'Codex' },
  { key: 'claude_codex', label: 'Conselho' },
]

export function AtlasAiSheet() {
  const open = useOverlays((s) => s.open)
  const close = useOverlays((s) => s.close)
  const visible = open === 'atlasAi'
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { showToast } = useShell()
  const scrollRef = useRef<ScrollView>(null)
  const [draft, setDraft] = useState('')
  const [traces, setTraces] = useState<AtlasAiTrace[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workMode, setWorkMode] = useState<WorkMode>('direct')
  const [agentMode, setAgentMode] = useState<AgentMode>('auto')
  const [providerMode, setProviderMode] = useState<ProviderMode>('auto')
  const [status, setStatus] = useState<AiProvidersStatusResponse | null>(null)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  const activeTrace = useMemo(
    () => [...traces].reverse().find((trace) => ACTIVE_STATUSES.has(trace.status)) ?? null,
    [traces],
  )
  const hasActiveTrace = activeTrace != null
  const canSubmit = draft.trim().length > 0 && !submitting && !hasActiveTrace

  const refresh = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true)
    setError(null)

    try {
      const [response, providerResponse] = await Promise.all([
        listAiInteractions({ limit: 12 }),
        getAiProvidersStatus(),
      ])
      setTraces(sortTraces(response.traces))
      setStatus(providerResponse)
    } catch (refreshError) {
      setError(humanAiError(refreshError, 'Falha ao carregar Atlas AI.'))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    void refresh()
  }, [refresh, visible])

  useEffect(() => {
    if (!visible || !hasActiveTrace) return

    const interval = setInterval(() => {
      void refresh({ silent: true })
    }, 3000)

    return () => clearInterval(interval)
  }, [hasActiveTrace, refresh, visible])

  useEffect(() => {
    if (!visible) return

    const show = Keyboard.addListener('keyboardWillShow', () => setKeyboardOpen(true))
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardOpen(false))

    return () => {
      show.remove()
      hide.remove()
    }
  }, [visible])

  useEffect(() => {
    if (!visible) return

    const timeout = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true })
    }, 80)

    return () => clearTimeout(timeout)
  }, [traces.length, visible])

  const submit = async () => {
    const input = draft.trim()
    if (!input || submitting) return
    if (hasActiveTrace) {
      showToast('Atlas ainda está processando')
      return
    }

    setSubmitting(true)
    setError(null)
    const selectedWorkMode = WORK_MODES.find((option) => option.key === workMode) ?? WORK_MODES[0]
    const agent = agentMode === 'auto' ? undefined : agentMode
    const councilMode = providerMode === 'claude_codex'
    const provider = providerMode === 'auto' ? undefined : providerMode
    const executionPolicy = councilMode ? 'dual_review' : 'single_provider'

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      const response = await createAiInteraction({
        input_text: input,
        client_id: newClientId(),
        agent_slug: agent,
        provider,
        kind: councilMode ? 'council' : selectedWorkMode.kind,
        source_type: 'app',
        include_semantic_context: true,
        context_note_limit: 5,
        payload: {
          app_surface: 'atlas_ai_sheet',
          atlas_workflow_mode: workMode,
          requested_agent: agentMode,
          requested_provider: providerMode,
          execution_policy: executionPolicy,
          council_providers: councilMode ? ['claude_cli', 'codex_cli'] : undefined,
          council_rule: councilMode ? 'both_propose_or_review; execution_requires_single_provider' : undefined,
        },
      })

      setDraft('')
      setTraces((current) => mergeTrace(response.trace, current))
      showToast('Atlas recebeu')
    } catch (submitError) {
      setError(humanAiError(submitError, 'Falha ao enviar para o Atlas.'))
    } finally {
      setSubmitting(false)
    }
  }

  const sendFeedback = async (trace: AtlasAiTrace, action: 'useful' | 'not_useful') => {
    try {
      const response = await feedbackAiInteraction(trace.id, {
        feedback_score: action === 'useful' ? 5 : 1,
        feedback_action: action,
      })
      setTraces((current) => current.map((item) => (item.id === trace.id ? response.trace : item)))
      await Haptics.selectionAsync()
    } catch (feedbackError) {
      setError(humanAiError(feedbackError, 'Falha ao registrar feedback.'))
    }
  }

  return (
    <SideSheet visible={visible}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <Pressable onPress={close} style={({ pressed }) => [styles.slot, { opacity: pressed ? 0.65 : 1 }]}>
            <Sans weight="med" size={15} color={c.ink}>← Voltar</Sans>
          </Pressable>
          <Frau size={25} lineHeight={30} align="center" color={c.ink}>
            Atlas
          </Frau>
          <Pressable
            onPress={() => {
              void refresh()
            }}
            disabled={loading}
            style={({ pressed }) => [styles.slot, styles.headerRight, { opacity: pressed ? 0.65 : 1 }]}
          >
            <Label color={c.ink2}>{loading ? '...' : 'Sync'}</Label>
          </Pressable>
        </View>

        <View style={[styles.operationalStrip, { borderBottomColor: c.border }]}>
          <OperationalStatus
            activeTrace={activeTrace}
            status={status}
            loading={loading}
            providerMode={providerMode}
          />
        </View>

        {!keyboardOpen && (
          <View style={[styles.controlPanel, { borderBottomColor: c.border }]}>
            <ControlSection label="Tarefa">
              {WORK_MODES.map((option) => (
                <ControlChip
                  key={option.key}
                  label={option.label}
                  active={workMode === option.key}
                  onPress={() => setWorkMode(option.key)}
                />
              ))}
            </ControlSection>

            <ControlSection label="Especialidade">
              {AGENT_MODES.map((option) => (
                <ControlChip
                  key={option.key}
                  label={option.label}
                  active={agentMode === option.key}
                  onPress={() => setAgentMode(option.key)}
                />
              ))}
            </ControlSection>

            <ControlSection label="Estratégia">
              {PROVIDER_MODES.map((option) => (
                <ControlChip
                  key={option.key}
                  label={option.label}
                  active={providerMode === option.key}
                  onPress={() => setProviderMode(option.key)}
                />
              ))}
            </ControlSection>
          </View>
        )}

        <ScrollView
          ref={scrollRef}
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            scrollRef.current?.scrollToEnd({ animated: true })
          }}
        >
          {error && (
            <View style={[styles.notice, { borderColor: c.recRed, backgroundColor: c.premium }]}>
              <Sans size={13} lineHeight={19} color={c.recRed}>{error}</Sans>
            </View>
          )}

          {traces.length === 0 && !error && (
            <EmptyThread
              workMode={workMode}
              agentMode={agentMode}
              providerMode={providerMode}
            />
          )}

          {traces.map((trace) => (
            <TraceCard
              key={trace.id}
              trace={trace}
              onFeedback={sendFeedback}
            />
          ))}
        </ScrollView>

        <View
          style={[
            styles.composerWrap,
            {
              borderTopColor: c.border,
              backgroundColor: c.bg,
              paddingBottom: Math.max(12, insets.bottom + 8),
            },
          ]}
        >
          <View style={[styles.composer, { backgroundColor: c.surface, borderColor: c.border }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              placeholder="Diga ao Atlas..."
              placeholderTextColor={c.ink2}
              style={[styles.input, { color: c.ink }]}
              textAlignVertical="top"
            />
            <Pressable
              onPress={submit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.send,
                {
                  backgroundColor: canSubmit ? c.ink : c.ink2,
                  opacity: canSubmit && pressed ? 0.75 : 1,
                },
              ]}
            >
              <Sans weight="bd" size={13} color={c.bg}>
                {submitLabel({ submitting, hasActiveTrace })}
              </Sans>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SideSheet>
  )
}

function OperationalStatus({
  activeTrace,
  status,
  loading,
  providerMode,
}: {
  activeTrace: AtlasAiTrace | null
  status: AiProvidersStatusResponse | null
  loading: boolean
  providerMode: ProviderMode
}) {
  const { c } = useTheme()
  const queued = status?.queue.queued ?? 0
  const processing = status?.queue.processing ?? 0
  const failed = status?.queue.failed ?? 0
  const providerLabelText = providerMode === 'claude_codex' ? 'Claude + Codex' : providerLabel(providerMode)
  const activeLabel = activeTrace ? compactTraceState(activeTrace) : null
  const healthy = !activeTrace && queued === 0 && processing === 0

  return (
    <View style={styles.operationalInner}>
      <View style={styles.operationalCopy}>
        <Label color={healthy ? c.moss : c.bronze}>{healthy ? 'Pronto' : activeLabel?.label ?? 'Fila ativa'}</Label>
        <Sans size={12} lineHeight={17} color={c.ink2}>
          {activeLabel?.detail
            ?? (healthy ? `${providerLabelText} pronto para o próximo turno.` : `${queued} na fila · ${processing} pensando · ${failed} falhas`)}
        </Sans>
      </View>
      {(loading || activeTrace) ? (
        <ActivityIndicator size="small" color={activeTrace?.status === 'processing' ? c.prussian : c.bronze} />
      ) : (
        <View style={[styles.statusDot, { backgroundColor: healthy ? c.moss : c.bronze }]} />
      )}
    </View>
  )
}

function ControlSection({ label, children }: { label: string; children: ReactNode }) {
  const { c } = useTheme()
  return (
    <View style={styles.controlSection}>
      <Label color={c.ink2}>{label}</Label>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.controlOptions}
      >
        {children}
      </ScrollView>
    </View>
  )
}

function EmptyThread({
  workMode,
  agentMode,
  providerMode,
}: {
  workMode: WorkMode
  agentMode: AgentMode
  providerMode: ProviderMode
}) {
  const { c } = useTheme()
  return (
    <View style={[styles.emptyState, { borderColor: c.border }]}>
      <Label color={c.ink2}>Atlas AI</Label>
      <Sans size={17} lineHeight={24} color={c.ink}>
        Converse com o Atlas para responder, planejar ou revisar. Use Conselho quando quiser Claude e Codex no mesmo turno.
      </Sans>
      <Sans size={12} lineHeight={18} color={c.ink2}>
        {modeLabel(workMode)} · {agentLabel(agentMode)} · {providerLabel(providerMode)}
      </Sans>
    </View>
  )
}

function ControlChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { c } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlChip,
        {
          backgroundColor: active ? c.ink : c.surface,
          borderColor: active ? c.ink : c.border,
          opacity: pressed ? 0.72 : 1,
        },
      ]}
    >
      <Sans weight="med" size={13} color={active ? c.bg : c.ink}>
        {label}
      </Sans>
    </Pressable>
  )
}

interface TraceCardProps {
  trace: AtlasAiTrace
  onFeedback: (trace: AtlasAiTrace, action: 'useful' | 'not_useful') => void
}

function TraceCard({ trace, onFeedback }: TraceCardProps) {
  const { c } = useTheme()
  const status = traceStatus(trace, c)
  const active = ACTIVE_STATUSES.has(trace.status)
  const response = trace.response_text?.trim()
    || trace.job?.result_text?.trim()
    || trace.jobs?.map((job) => job.result_text?.trim()).filter(Boolean).join('\n\n')
    || trace.job?.error_message?.trim()
    || status.message

  return (
    <View style={styles.trace}>
      <View style={[styles.operatorBubble, { backgroundColor: c.ink }]}>
        <Sans size={15} lineHeight={22} color={c.bg}>{trace.operator_input}</Sans>
      </View>

      <View style={[styles.atlasBubble, { backgroundColor: c.premium, borderColor: c.border }]}>
        <View style={styles.traceMeta}>
          <View style={styles.traceMetaLeft}>
            {active && <ActivityIndicator size="small" color={status.color} />}
            <Label color={status.color}>{status.label}</Label>
          </View>
          <Label color={c.ink2}>{traceMeta(trace)}</Label>
        </View>
        <Sans size={15} lineHeight={23} color={status.isError ? c.recRed : c.ink}>
          {response}
        </Sans>

        {active && isCouncilTrace(trace) && (
          <View style={[styles.jobPanel, { borderColor: c.border }]}>
            {(trace.jobs ?? []).map((job) => (
              <View key={job.id} style={styles.jobRow}>
                <Sans size={12} color={c.ink2}>{providerLabel(job.provider)}</Sans>
                <Label color={jobStatusColor(job.status, c)}>{jobStatusLabel(job.status)}</Label>
              </View>
            ))}
          </View>
        )}

        {trace.status === 'succeeded' && (
          <View style={styles.feedbackRow}>
            <FeedbackButton
              label="Útil"
              active={trace.feedback_action === 'useful'}
              onPress={() => onFeedback(trace, 'useful')}
            />
            <FeedbackButton
              label="Ruim"
              active={trace.feedback_action === 'not_useful'}
              onPress={() => onFeedback(trace, 'not_useful')}
            />
          </View>
        )}
      </View>
    </View>
  )
}

function FeedbackButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { c } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.feedback,
        {
          borderColor: active ? c.prussian : c.border,
          backgroundColor: active ? c.surface : 'transparent',
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Sans weight="med" size={12} color={active ? c.prussian : c.ink2}>
        {label}
      </Sans>
    </Pressable>
  )
}

function traceStatus(trace: AtlasAiTrace, c: AtlasPalette): { label: string; message: string; color: string; isError: boolean } {
  const council = isCouncilTrace(trace)
  if (trace.status === 'queued') {
    return {
      label: 'Na fila',
      message: council ? 'Aguardando Claude e Codex processarem no Mac.' : 'Aguardando o worker do Mac processar.',
      color: c.bronze,
      isError: false,
    }
  }
  if (trace.status === 'processing') {
    return {
      label: 'Processando',
      message: council ? 'Claude e Codex estão trabalhando na mesma pergunta.' : 'Atlas está operando no Mac.',
      color: c.prussian,
      isError: false,
    }
  }
  if (trace.status === 'failed') {
    return {
      label: 'Falhou',
      message: trace.job?.error_message ?? 'O worker registrou falha ao processar esta interação.',
      color: c.recRed,
      isError: true,
    }
  }
  if (trace.status === 'cancelled') {
    return {
      label: 'Cancelado',
      message: 'Interação cancelada.',
      color: c.ink2,
      isError: false,
    }
  }

  return {
    label: traceResultLabel(trace),
    message: 'Concluído.',
    color: c.moss,
    isError: false,
  }
}

function compactTraceState(trace: AtlasAiTrace): { label: string; detail: string } {
  if (trace.status === 'queued') {
    return {
      label: 'Na fila',
      detail: isCouncilTrace(trace) ? 'Claude + Codex aguardando worker do Mac.' : `${traceProviderLabel(trace)} aguardando worker do Mac.`,
    }
  }

  if (trace.status === 'processing') {
    return {
      label: 'Pensando',
      detail: isCouncilTrace(trace) ? 'Rodada dupla em andamento.' : `${traceProviderLabel(trace)} processando agora.`,
    }
  }

  return { label: 'Ativo', detail: 'Turno em andamento.' }
}

function mergeTrace(trace: AtlasAiTrace, traces: AtlasAiTrace[]): AtlasAiTrace[] {
  return sortTraces([trace, ...traces.filter((item) => item.id !== trace.id)]).slice(-12)
}

function sortTraces(traces: AtlasAiTrace[]): AtlasAiTrace[] {
  return [...traces].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime()
    const rightTime = new Date(right.created_at).getTime()

    if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
      return left.id.localeCompare(right.id)
    }

    return leftTime - rightTime
  })
}

function newClientId(): string {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const randomUuid = globalThis.crypto?.randomUUID?.()
  if (randomUuid && uuidPattern.test(randomUuid)) return randomUuid

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16)
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8
    return value.toString(16)
  })
}

function providerLabel(provider: AtlasAiTrace['provider']): string {
  if (provider === 'claude_codex') return 'Claude + Codex'
  if (provider === 'claude_cli') return 'Claude'
  if (provider === 'codex_cli') return 'Codex'
  return 'Auto'
}

function modeLabel(mode: WorkMode): string {
  if (mode === 'plan') return 'Planejar'
  if (mode === 'review') return 'Revisar'
  return 'Responder'
}

function agentLabel(agent: string | null): string {
  if (agent === 'vault-curador') return 'Vault'
  if (agent === 'saude') return 'Saúde'
  if (agent === 'blackink') return 'BlackInk'
  if (agent === 'financas') return 'Finanças'
  return 'Auto'
}

function traceMeta(trace: AtlasAiTrace): string {
  const latency = trace.latency_ms != null ? ` · ${(trace.latency_ms / 1000).toFixed(1)}s` : ''
  return `${traceProviderLabel(trace)} · ${workflowLabel(trace)} · ${agentLabel(trace.agent_slug)}${latency}`
}

function jobStatusLabel(status: AtlasAiStatus): string {
  if (status === 'queued') return 'Fila'
  if (status === 'processing') return 'Pensando'
  if (status === 'succeeded') return 'Ok'
  if (status === 'failed') return 'Falhou'
  return 'Cancelado'
}

function jobStatusColor(status: AtlasAiStatus, c: AtlasPalette): string {
  if (status === 'queued') return c.bronze
  if (status === 'processing') return c.prussian
  if (status === 'succeeded') return c.moss
  if (status === 'failed') return c.recRed
  return c.ink2
}

function submitLabel({ submitting, hasActiveTrace }: { submitting: boolean; hasActiveTrace: boolean }): string {
  if (submitting) return 'Enviando'
  if (hasActiveTrace) return 'Aguarde'
  return 'Enviar'
}

function traceResultLabel(trace: AtlasAiTrace): string {
  if (isCouncilTrace(trace)) return 'Conselho'
  const workflowMode = trace.job?.payload?.atlas_workflow_mode
  if (workflowMode === 'plan') return 'Plano'
  if (workflowMode === 'review') return 'Revisão'
  return 'Resposta'
}

function workflowLabel(trace: AtlasAiTrace): string {
  if (isCouncilTrace(trace)) return 'Conselho'
  const workflowMode = trace.job?.payload?.atlas_workflow_mode
  if (workflowMode === 'plan') return 'Planejar'
  if (workflowMode === 'review') return 'Revisar'
  return 'Responder'
}

function traceProviderLabel(trace: AtlasAiTrace): string {
  if (isCouncilTrace(trace)) return 'Claude + Codex'
  return providerLabel(trace.provider)
}

function isCouncilTrace(trace: AtlasAiTrace): boolean {
  return trace.provider === 'claude_codex'
    || trace.metadata?.execution_policy === 'dual_review'
    || trace.job?.kind === 'council'
    || trace.jobs?.some((job) => job.kind === 'council') === true
}

function humanAiError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback
  if (message.includes('route ai/') || message.includes('rota ai/')) {
    return 'Atlas AI não está carregado no servidor. Rebuild/restart o atlas-server e toque em Sync.'
  }

  return message
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    height: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  slot: {
    width: 92,
    height: 44,
    justifyContent: 'center',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  operationalStrip: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  operationalInner: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  operationalCopy: {
    flex: 1,
    gap: 3,
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  controlPanel: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 12,
  },
  controlSection: {
    gap: 7,
  },
  controlOptions: {
    gap: 8,
    paddingRight: 24,
  },
  controlChip: {
    height: 34,
    minWidth: 72,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  thread: {
    flex: 1,
  },
  threadContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 16,
  },
  notice: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  emptyState: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  trace: {
    gap: 10,
  },
  operatorBubble: {
    alignSelf: 'flex-end',
    maxWidth: '86%',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  atlasBubble: {
    alignSelf: 'flex-start',
    width: '92%',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 15,
  },
  traceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  traceMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  jobPanel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    paddingTop: 12,
    gap: 8,
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  feedbackRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  feedback: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  composerWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  composer: {
    minHeight: 58,
    maxHeight: 150,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 118,
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 21,
    paddingTop: 8,
    paddingBottom: 7,
  },
  send: {
    height: 40,
    paddingHorizontal: 15,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
