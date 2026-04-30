import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../components/Screen'
import { PrimaryButton } from '../components/PrimaryButton'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { fonts } from '../design/tokens'
import { usePalette } from '../design/theme'
import { useShell } from '../components/AtlasShell'
import {
  createAiInteraction,
  getMobileAiThread,
  listAiInteractions,
  type AtlasAiMessage,
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
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const messages = useMemo(() => sortMessages(thread?.messages ?? []), [thread?.messages])
  const canSubmit = Boolean(threadId && draft.trim().length > 0 && !submitting)

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!threadId) {
      setError('Thread não informada.')
      setLoading(false)
      return
    }

    if (!silent) setLoading(true)
    setError(null)
    try {
      const [threadResponse, traceResponse] = await Promise.all([
        getMobileAiThread(threadId),
        listAiInteractions({ thread_id: threadId, limit: 20 }).catch(() => ({ traces: [] })),
      ])
      setThread(threadResponse.thread)
      setTraces(traceResponse.traces)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar thread contextual.')
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

  const submit = async () => {
    if (!threadId || !canSubmit) return

    const text = draft.trim()
    setSubmitting(true)
    setError(null)
    setDraft('')
    try {
      await createAiInteraction({
        input_text: text,
        thread_id: threadId,
        new_thread: false,
        source_type: 'mobile_thread',
        source_id: threadId,
        include_semantic_context: true,
        context_note_limit: 5,
        payload: {
          app_surface: 'mobile_thread',
          thread_source: 'mobile_gateway_inbox',
        },
      })
      await load({ silent: true })
      reloadTimer.current = setTimeout(() => void load({ silent: true }), 1800)
      showToast('mensagem enviada')
    } catch (err) {
      setDraft(text)
      setError(err instanceof Error ? err.message : 'Falha ao enviar mensagem.')
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
        <Label>Thread contextual</Label>
        <Frau size={38} lineHeight={41} color={c.ink} numberOfLines={2} style={{ marginTop: 6 }}>
          {thread?.title ?? 'Conversa Atlas'}
        </Frau>
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
            Carregando contexto...
          </Sans>
        </View>
      ) : (
        <View style={styles.stack}>
          {messages.length === 0 ? (
            <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
              <Sans size={13} lineHeight={18} color={c.ink2}>
                Esta thread ainda não tem mensagens visíveis.
              </Sans>
            </View>
          ) : (
            messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))
          )}

          {pendingTraces(traces).length > 0 ? (
            <View style={[styles.pendingPanel, { borderColor: c.border, backgroundColor: c.surface }]}>
              <Sans weight="med" size={12} lineHeight={16} color={c.ink}>
                Atlas está processando
              </Sans>
              <Sans size={12} lineHeight={17} color={c.ink2} style={{ marginTop: 4 }}>
                {pendingTraces(traces).length === 1 ? '1 execução ativa nesta thread.' : `${pendingTraces(traces).length} execuções ativas nesta thread.`}
              </Sans>
            </View>
          ) : null}

          <View style={[styles.composer, { borderColor: c.border, backgroundColor: c.surface }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Responder ao Atlas..."
              placeholderTextColor={c.ink3}
              multiline
              selectionColor={c.ink}
              style={[styles.input, { color: c.ink }]}
            />
            <PrimaryButton
              label={submitting ? 'Enviando...' : 'Enviar'}
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

function MessageBubble({ message }: { message: AtlasAiMessage }) {
  const c = usePalette()
  const isAssistant = message.role === 'assistant'
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  return (
    <View
      style={[
        styles.message,
        {
          borderColor: c.border,
          backgroundColor: isAssistant ? c.surface : isUser ? c.premium : 'transparent',
          alignSelf: isUser ? 'flex-end' : 'stretch',
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
    </View>
  )
}

function sortMessages(messages: AtlasAiMessage[]): AtlasAiMessage[] {
  return [...messages].sort((a, b) => a.position - b.position)
}

function pendingTraces(traces: AtlasAiTrace[]): AtlasAiTrace[] {
  return traces.filter((trace) => ['queued', 'running', 'blocked'].includes(trace.status))
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
  stack: {
    gap: 12,
  },
  panel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
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
  pendingPanel: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
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
