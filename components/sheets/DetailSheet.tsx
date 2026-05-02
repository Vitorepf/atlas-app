import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioSource } from 'expo-audio'
import { useRouter } from 'expo-router'
import { BottomSheet } from './BottomSheet'
import { Frau, Label, Mono, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useOverlays } from '../../lib/overlays'
import { useShell } from '../AtlasShell'
import { domainColor, domainLabel } from '../../lib/domains'
import type { InboxItem } from '../InboxCard'
import { captureToInboxItem, useAtlasStore, visibleCaptures } from '../../lib/atlasStore'
import { listSemanticNotes, type AtlasSemanticNote } from '../../lib/api/client'
import { copyToClipboard, COPY_LONG_PRESS_DELAY } from '../../lib/clipboard'

const WAVE_HEIGHTS = [4, 8, 14, 20, 26, 22, 16, 10, 6, 12, 18, 24, 28, 22, 16, 10, 6, 4, 8, 14, 20, 26, 30, 24, 18, 12, 8, 4, 10, 16, 22, 18, 12, 8, 6, 10, 14, 8, 4, 4]

export function DetailSheet() {
  const open = useOverlays((s) => s.open)
  const overlayItem = useOverlays((s) => s.item)
  const close = useOverlays((s) => s.close)
  const openConfirmDelete = useOverlays((s) => s.openConfirmDelete)
  const openEdit = useOverlays((s) => s.openEdit)
  const openDomain = useOverlays((s) => s.openDomain)
  const { showToast } = useShell()
  const updateCapture = useAtlasStore((s) => s.updateCapture)
  const retryTranscription = useAtlasStore((s) => s.retryTranscription)
  const triageCapture = useAtlasStore((s) => s.triageCapture)
  const clarifyCapture = useAtlasStore((s) => s.clarifyCapture)
  const deleteCapture = useAtlasStore((s) => s.deleteCapture)
  const captures = useAtlasStore((s) => s.captures)
  const queuedCaptures = useAtlasStore((s) => s.queuedCaptures)
  const domains = useAtlasStore((s) => s.domains)

  const item = useMemo(() => {
    if (!overlayItem) return null

    return visibleCaptures({ captures, queuedCaptures })
      .map((capture) => captureToInboxItem(capture, domains))
      .find((candidate) => candidate.id === overlayItem.id || candidate.clientId === overlayItem.clientId)
      ?? overlayItem
  }, [captures, domains, overlayItem, queuedCaptures])

  const visible = open === 'detail' && item != null

  return (
    <BottomSheet visible={visible} onClose={close} height="85%">
      {item ? (
        <DetailContent
          item={item}
          onEdit={() => openEdit(item)}
          onMove={() => openDomain((d) => {
            if (!d) return

            void updateCapture(item.id, { domain: d }).then((updated) => {
              showToast(updated ? `Movido · ${domainLabel(d, domains)}` : 'Falha ao mover captura')
            })
          })}
          onDelete={() =>
            openConfirmDelete((confirmed) => {
              if (confirmed) {
                void deleteCapture(item.id).then((deleted) => {
                  showToast(deleted ? 'Captura excluída' : 'Falha ao excluir captura')
                })
              }
            })
          }
          onRetryTranscription={async () => {
            const updated = await retryTranscription(item.id)
            showToast(updated ? 'Transcrição reenfileirada' : 'Falha ao reenfileirar transcrição')
          }}
          onTriage={async (input) => {
            const result = await triageCapture(item.id, input)
            const message = triageSuccessMessage(input.action, Boolean(result?.proposal))
            showToast(result ? message : 'Falha ao atualizar triagem')
            return Boolean(result)
          }}
          onClarify={async () => {
            const updated = await clarifyCapture(item.id)
            showToast(updated ? 'Aclaramento atualizado' : 'Falha ao aclarar captura')
            return Boolean(updated)
          }}
        />
      ) : null}
    </BottomSheet>
  )
}

interface ContentProps {
  item: InboxItem
  onEdit: () => void
  onMove: () => void
  onDelete: () => void
  onRetryTranscription: () => Promise<void>
  onTriage: (input: TriageInput) => Promise<boolean>
  onClarify: () => Promise<boolean>
}

type TriageAction =
  | 'promote'
  | 'archive'
  | 'snooze'
  | 'attach_note'
  | 'create_task'
  | 'create_project'
  | 'create_hypothesis'

interface TriageInput {
  action: TriageAction
  title?: string | null
  note_id?: string | null
  note_title?: string | null
  snoozed_until?: string | null
  due_at?: string | null
  priority?: TaskPriority | null
  goal?: string | null
  next_action?: string | null
  reason?: string | null
}

type ActionMode = 'snooze' | 'attach_note' | 'create_task' | 'create_project' | null
type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

const TASK_PRIORITIES: Array<{ key: TaskPriority; label: string }> = [
  { key: 'low', label: 'baixa' },
  { key: 'normal', label: 'normal' },
  { key: 'high', label: 'alta' },
  { key: 'urgent', label: 'urgente' },
]

function DetailContent({ item, onEdit, onMove, onDelete, onRetryTranscription, onTriage, onClarify }: ContentProps) {
  const { c } = useTheme()
  const router = useRouter()
  const close = useOverlays((s) => s.close)
  const { showToast } = useShell()
  const [playerError, setPlayerError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [triaging, setTriaging] = useState<TriageAction | null>(null)
  const [clarifying, setClarifying] = useState(false)
  const [actionMode, setActionMode] = useState<ActionMode>(null)
  const [actionTitle, setActionTitle] = useState(defaultActionTitle(item))
  const domains = useAtlasStore((s) => s.domains)

  const accent = domainColor(item.domain, c, domains)
  const hasDestination = hasResolvedDestination(item)
  const triageDisabled = Boolean(item.isLocal || triaging)
  const destinationRoute = destinationRouteFor(item)
  const bars = useMemo(() => WAVE_HEIGHTS, [])
  const audioSource = useMemo<AudioSource | null>(() => {
    if (item.kind !== 'audio' || !item.fileUrl) return null

    return item.fileHeaders
      ? { uri: item.fileUrl, headers: item.fileHeaders }
      : { uri: item.fileUrl }
  }, [item.fileHeaders, item.fileUrl, item.kind])
  const player = useAudioPlayer(audioSource, { updateInterval: 150 })
  const status = useAudioPlayerStatus(player)
  const durationSeconds = status.duration > 0 ? status.duration : (item.durationMs ?? 0) / 1000
  const progress = durationSeconds > 0 ? Math.min(1, Math.max(0, status.currentTime / durationSeconds)) : 0

  useEffect(() => {
    setActionMode(null)
    setActionTitle(defaultActionTitle(item))
  }, [item.id, item.text])

  const togglePlayback = async () => {
    if (!audioSource) {
      setPlayerError('Arquivo de áudio indisponível.')
      return
    }

    try {
      setPlayerError(null)
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      })

      if (status.playing) {
        player.pause()
        return
      }

      if (durationSeconds > 0 && status.currentTime >= durationSeconds - 0.05) {
        await player.seekTo(0)
      }

      player.play()
    } catch (error) {
      setPlayerError(error instanceof Error ? error.message : 'Não foi possível tocar o áudio.')
    }
  }

  const runTriage = async (input: TriageInput) => {
    if (item.isLocal || triaging) return

    setTriaging(input.action)
    const ok = await onTriage(input)
    if (ok) {
      setActionMode(null)
      setActionTitle(defaultActionTitle(item))
    }
    setTriaging(null)
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      <View style={styles.metaRow}>
        <Mono size={13} color={c.ink2} letterSpacing={0.26}>
          {item.time}{item.date ? ` · ${item.date}` : ''}
        </Mono>
        <DomainPill label={domainLabel(item.domain, domains)} accent={accent} />
      </View>

      <Frau size={28} lineHeight={33} letterSpacing={-0.42} color={c.ink} style={{ marginBottom: 18 }}>
        Captura
      </Frau>

      <View style={[styles.rawNotice, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Sans weight="med" size={12.5} lineHeight={17} color={c.ink}>
          {hasDestination ? destinationSummaryTitle(item) : 'Isso ainda é captura bruta, não conhecimento.'}
        </Sans>
        <Sans size={12.5} lineHeight={17} color={c.ink2}>
          {hasDestination
            ? destinationSummaryBody(item)
            : 'A triagem define se vira nota viva, hipótese, tarefa, projeto, anexo ou arquivo.'}
        </Sans>
      </View>

      <Pressable
        onLongPress={() => void copyToClipboard(item.text, () => showToast('Copiado'))}
        delayLongPress={COPY_LONG_PRESS_DELAY}
        accessibilityHint="pressionar e segurar copia o texto da captura"
        style={({ pressed }) => [{ marginBottom: 22, opacity: pressed ? 0.7 : 1 }]}
      >
        <Sans size={17} lineHeight={26} color={c.ink}>
          {item.text}
        </Sans>
      </Pressable>

      <View style={[styles.statusPanel, { borderColor: statusColor(item.statusTone, c), backgroundColor: c.surface }]}>
        <View style={[styles.statusDot, { backgroundColor: statusColor(item.statusTone, c) }]} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Mono size={11} letterSpacing={0.56} color={statusColor(item.statusTone, c)}>
            {item.statusLabel ?? 'CAPTURA'}
          </Mono>
          <Sans size={12.5} lineHeight={17} color={c.ink2}>
            {item.statusDetail ?? 'Registro salvo no Atlas'}
          </Sans>
        </View>
      </View>

      {item.kind === 'audio' && (
        <View style={{ marginBottom: 18 }}>
          <View style={[styles.player, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Pressable
              onPress={togglePlayback}
              style={({ pressed }) => [
                styles.play,
                { backgroundColor: c.prussian, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              {status.playing ? (
                <View style={styles.pauseGlyph}>
                  <View style={[styles.pauseBar, { backgroundColor: c.bg }]} />
                  <View style={[styles.pauseBar, { backgroundColor: c.bg }]} />
                </View>
              ) : (
                <View style={[styles.playGlyph, { borderLeftColor: c.bg }]} />
              )}
            </Pressable>
            <View style={styles.wave}>
              {bars.map((h, i) => {
                const played = i / bars.length < progress
                return (
                  <View
                    key={i}
                    style={{
                      width: 2,
                      height: h,
                      backgroundColor: c.prussian,
                      borderRadius: 1,
                      opacity: played ? 1 : 0.35,
                      marginRight: 2,
                    }}
                  />
                )
              })}
            </View>
            <Mono size={12} color={c.ink2} letterSpacing={0.48}>
              {formatDurationSeconds(status.currentTime > 0 ? status.currentTime : durationSeconds)}
            </Mono>
          </View>
          {playerError && (
            <Sans size={12} lineHeight={17} color={c.recRed} style={{ marginTop: 8 }}>
              {playerError}
            </Sans>
          )}
          {item.transcriptionError && item.transcriptionStatus === 'failed' && (
            <Sans size={12} lineHeight={17} color={c.recRed} style={{ marginTop: 8 }}>
              {item.transcriptionError}
            </Sans>
          )}
          {item.canRetryTranscription && (
            <ActionButton
              label={retrying ? 'Reenfileirando…' : 'Tentar transcrever de novo'}
              onPress={() => {
                if (retrying) return

                setRetrying(true)
                void onRetryTranscription().finally(() => setRetrying(false))
              }}
            />
          )}
        </View>
      )}

      {item.tags && item.tags.length > 0 && (
        <View style={styles.tags}>
          {item.tags.map((tag) => <Tag key={tag} label={tag} />)}
        </View>
      )}

      <InfoSection item={item} />

      <SemanticClarificationPanel
        item={item}
        loading={clarifying}
        onClarify={async () => {
          if (item.isLocal || clarifying) return

          setClarifying(true)
          await onClarify()
          setClarifying(false)
        }}
      />

      <View style={[styles.triagePanel, { borderColor: c.border }]}>
        <Label color={c.ink2}>Triagem</Label>
        {hasDestination ? (
          <View style={[styles.destinationPanel, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Sans weight="med" size={13} lineHeight={17} color={c.ink}>
              {destinationSummaryTitle(item)}
            </Sans>
            <Sans size={12.5} lineHeight={17} color={c.ink2}>
              {destinationSummaryBody(item)}
            </Sans>
            {destinationRoute ? (
              <View style={styles.destinationActions}>
                <ActionButton
                  label={destinationActionLabel(item)}
                  onPress={() => {
                    close()
                    router.push(destinationRoute)
                  }}
                />
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.triageGrid}>
          <ActionButton label={triaging === 'promote' ? 'Promovendo…' : 'Promover'} onPress={() => void runTriage({ action: 'promote' })} disabled={triageDisabled || !canPromote(item)} />
          <ActionButton label={triaging === 'archive' ? 'Arquivando…' : 'Arquivar'} onPress={() => void runTriage({ action: 'archive' })} disabled={triageDisabled} />
          <ActionButton label="Adiar" onPress={() => setActionMode(actionMode === 'snooze' ? null : 'snooze')} disabled={triageDisabled} />
          <ActionButton label="Anexar nota" onPress={() => setActionMode(actionMode === 'attach_note' ? null : 'attach_note')} disabled={triageDisabled} />
          <ActionButton label="Criar tarefa" onPress={() => setActionMode(actionMode === 'create_task' ? null : 'create_task')} disabled={triageDisabled} />
          <ActionButton label="Criar projeto" onPress={() => setActionMode(actionMode === 'create_project' ? null : 'create_project')} disabled={triageDisabled} />
          <ActionButton label={triaging === 'create_hypothesis' ? 'Criando…' : 'Criar hipótese'} onPress={() => void runTriage({ action: 'create_hypothesis', title: actionTitle })} disabled={triageDisabled} />
        </View>
        {item.isLocal && (
          <Sans size={12} lineHeight={17} color={c.ink2}>
            Sincronize a captura antes de aplicar triagem.
          </Sans>
        )}
        <TriageInlineMode
          mode={actionMode}
          title={actionTitle}
          setTitle={setActionTitle}
          disabled={triageDisabled}
          onRun={runTriage}
        />
      </View>

      <View style={[styles.actions, { borderTopColor: c.border }]}>
        <ActionButton label="Editar" onPress={onEdit} />
        <ActionButton label="Mover" onPress={onMove} />
        <ActionButton label="Excluir" onPress={onDelete} danger />
      </View>
    </ScrollView>
  )
}

function InfoSection({ item }: { item: InboxItem }) {
  const { c } = useTheme()
  const rows = [
    ['Tipo', kindDetail(item)],
    ['Origem', item.isLocal ? 'App mobile · fila local' : 'Servidor Atlas'],
    ['Arquivo', fileDetail(item)],
    ['Privacidade', privacyDetail(item)],
    ['Contexto', contextDetail(item)],
    ['Histórico', historyDetail(item)],
  ]

  return (
    <View style={[styles.infoPanel, { borderColor: c.border }]}>
      <Label color={c.ink2}>Origem, contexto e histórico</Label>
      <View style={{ marginTop: 10, gap: 9 }}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.infoRow}>
            <Mono size={10.5} letterSpacing={0.42} color={c.ink2} style={{ width: 74 }}>
              {label}
            </Mono>
            <Sans size={12.5} lineHeight={17} color={c.ink} style={{ flex: 1, minWidth: 0 }}>
              {value}
            </Sans>
          </View>
        ))}
      </View>
      {item.triageHistory && item.triageHistory.length > 0 && (
        <View style={[styles.historyList, { borderTopColor: c.border }]}>
          {item.triageHistory.slice(0, 3).map((event, index) => (
            <View key={`${event.at ?? 'triage'}-${index}`} style={styles.historyEvent}>
              <Sans weight="med" size={12.5} lineHeight={17} color={c.ink}>
                {historyEventTitle(event)}
              </Sans>
              <Sans size={11.5} lineHeight={16} color={c.ink2}>
                {historyEventMeta(event)}
              </Sans>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

function TriageInlineMode({
  mode,
  title,
  setTitle,
  disabled,
  onRun,
}: {
  mode: ActionMode
  title: string
  setTitle: (value: string) => void
  disabled: boolean
  onRun: (input: TriageInput) => Promise<void>
}) {
  const { c } = useTheme()
  const [notes, setNotes] = useState<AtlasSemanticNote[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [notesLoading, setNotesLoading] = useState(false)
  const [priority, setPriority] = useState<TaskPriority>('normal')

  useEffect(() => {
    if (mode !== 'attach_note') return

    setNotesLoading(true)
    listSemanticNotes({ limit: 30 })
      .then((response) => setNotes(response.notes))
      .catch(() => setNotes([]))
      .finally(() => setNotesLoading(false))
  }, [mode])

  useEffect(() => {
    setSelectedNoteId(null)
    setPriority('normal')
  }, [mode])

  if (!mode) return null

  if (mode === 'snooze') {
    return (
      <View style={[styles.inlinePanel, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Sans weight="med" size={13} color={c.ink}>Adiar captura</Sans>
        <View style={styles.inlineActions}>
          <ActionButton label="Amanhã" disabled={disabled} onPress={() => void onRun({ action: 'snooze', snoozed_until: daysFromNow(1), reason: 'Adiada para revisão amanhã' })} />
          <ActionButton label="7 dias" disabled={disabled} onPress={() => void onRun({ action: 'snooze', snoozed_until: daysFromNow(7), reason: 'Adiada por uma semana' })} />
          <ActionButton label="30 dias" disabled={disabled} onPress={() => void onRun({ action: 'snooze', snoozed_until: daysFromNow(30), reason: 'Adiada por trinta dias' })} />
        </View>
      </View>
    )
  }

  const label = mode === 'attach_note'
    ? 'Buscar nota viva'
    : mode === 'create_task'
      ? 'Título da tarefa'
      : 'Título do projeto'
  const filteredNotes = mode === 'attach_note'
    ? notes.filter((note) => noteMatchesQuery(note, title)).slice(0, 8)
    : []

  return (
    <View style={[styles.inlinePanel, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Sans weight="med" size={13} color={c.ink}>{label}</Sans>
      <TextInput
        value={title}
        onChangeText={(value) => {
          setTitle(value)
          if (mode === 'attach_note') {
            setSelectedNoteId(null)
          }
        }}
        placeholder={label}
        placeholderTextColor={c.ink3}
        autoCapitalize="sentences"
        selectionColor={c.prussian}
        style={[styles.triageInput, { color: c.ink, borderColor: c.border, backgroundColor: c.bg }]}
      />
      {mode === 'attach_note' && (
        <View style={styles.noteResults}>
          {notesLoading ? (
            <Sans size={12} lineHeight={17} color={c.ink2}>Carregando notas vivas…</Sans>
          ) : filteredNotes.length === 0 ? (
            <Sans size={12} lineHeight={17} color={c.ink2}>Nenhuma nota encontrada.</Sans>
          ) : filteredNotes.map((note) => {
            const selected = selectedNoteId === note.id
            return (
              <Pressable
                key={note.id}
                onPress={() => {
                  setSelectedNoteId(note.id)
                  setTitle(note.title)
                }}
                style={({ pressed }) => [
                  styles.noteResult,
                  {
                    borderColor: selected ? c.prussian : c.border,
                    backgroundColor: pressed || selected ? c.bg : 'transparent',
                  },
                ]}
              >
                <Sans weight="med" size={12.5} lineHeight={17} color={selected ? c.prussian : c.ink}>
                  {note.title}
                </Sans>
                <Sans size={11.5} lineHeight={15} color={c.ink2}>
                  {note.type} · {note.maturity}
                </Sans>
              </Pressable>
            )
          })}
        </View>
      )}
      {mode === 'create_task' ? (
        <TaskPrioritySelector
          value={priority}
          onChange={setPriority}
          disabled={disabled}
        />
      ) : null}
      <ActionButton
        label="Confirmar"
        disabled={disabled || (mode === 'attach_note' ? !selectedNoteId : title.trim().length === 0)}
        onPress={() => void onRun(mode === 'attach_note'
          ? { action: 'attach_note', note_id: selectedNoteId, note_title: title.trim() }
          : mode === 'create_task'
            ? { action: mode, title: title.trim(), priority, reason: `Tarefa criada com prioridade ${taskPriorityLabel(priority)}.` }
            : { action: mode, title: title.trim() })}
      />
    </View>
  )
}

function TaskPrioritySelector({
  value,
  onChange,
  disabled,
}: {
  value: TaskPriority
  onChange: (value: TaskPriority) => void
  disabled: boolean
}) {
  const { c } = useTheme()
  return (
    <View style={styles.prioritySelector}>
      <Mono size={10.5} letterSpacing={0.42} color={c.ink2}>
        prioridade
      </Mono>
      <View style={styles.priorityRow}>
        {TASK_PRIORITIES.map((option) => {
          const active = value === option.key
          return (
            <Pressable
              key={option.key}
              disabled={disabled}
              onPress={() => onChange(option.key)}
              style={({ pressed }) => [
                styles.priorityPill,
                {
                  borderColor: active ? c.prussian : c.border,
                  backgroundColor: active ? c.premium : c.bg,
                  opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <Sans weight={active ? 'sb' : 'med'} size={11.5} lineHeight={15} color={active ? c.prussian : c.ink2}>
                {option.label}
              </Sans>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

function taskPriorityLabel(priority: TaskPriority): string {
  return TASK_PRIORITIES.find((option) => option.key === priority)?.label ?? 'normal'
}

function noteMatchesQuery(note: AtlasSemanticNote, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true

  return `${note.title} ${note.summary ?? ''} ${note.path}`.toLowerCase().includes(q)
}

function SemanticClarificationPanel({
  item,
  loading,
  onClarify,
}: {
  item: InboxItem
  loading: boolean
  onClarify: () => Promise<void>
}) {
  const { c } = useTheme()
  const clarification = item.semanticClarification
  const canClarify = !item.isLocal && (item.kind === 'text' || item.transcriptionStatus === 'done')

  if (!clarification?.mainThesis) {
    return (
      <View style={[styles.clarificationPanel, { borderColor: c.border, backgroundColor: c.surface }]}>
        <Label color={c.ink2}>Aclaramento semântico</Label>
        <Sans size={12.5} lineHeight={17} color={c.ink2} style={{ marginTop: 8 }}>
          Aguardando evento capture_ready_for_curation.
        </Sans>
        {canClarify ? (
          <ActionButton label={loading ? 'Aclarando…' : 'Aclarar agora'} disabled={loading} onPress={() => void onClarify()} />
        ) : null}
      </View>
    )
  }

  return (
    <View style={[styles.clarificationPanel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={styles.clarificationHeader}>
        <Label color={c.ink2}>Aclaramento semântico</Label>
        <Mono size={10.5} letterSpacing={0.42} color={densityColor(clarification.density?.score, c)}>
          {densityLabel(clarification)}
        </Mono>
      </View>

      <InfoBlock label="Tese principal" value={clarification.mainThesis} />
      {clarification.atomicIdeas && clarification.atomicIdeas.length > 0 && (
        <InfoBlock label="Ideias atômicas" value={clarification.atomicIdeas.slice(0, 5).map((idea) => `• ${idea}`).join('\n')} />
      )}
      <InfoBlock label="Tipo sugerido" value={clarification.suggestedType ?? 'sem tipo'} />
      <InfoBlock label="Tensão/pergunta" value={clarification.tensionOrQuestion ?? 'sem tensão explícita'} />
      <InfoBlock label="Possível destino" value={destinationDetail(clarification)} />
      <InfoBlock label="Pergunta de autoria" value={clarification.authorshipQuestion ?? 'sem pergunta'} />
      {clarification.futureTriggers && clarification.futureTriggers.length > 0 && (
        <InfoBlock label="Gatilhos futuros" value={clarification.futureTriggers.join(' · ')} />
      )}
    </View>
  )
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  const { c } = useTheme()

  return (
    <View style={styles.infoBlock}>
      <Mono size={10.5} letterSpacing={0.42} color={c.ink2}>
        {label}
      </Mono>
      <Sans size={12.5} lineHeight={17} color={c.ink}>
        {value}
      </Sans>
    </View>
  )
}

function formatDuration(durationMs?: number | null): string {
  if (!durationMs) return '0:00'
  const seconds = Math.max(0, Math.round(durationMs / 1000))
  return formatDurationSeconds(seconds)
}

function formatDurationSeconds(secondsValue?: number | null): string {
  const seconds = Math.max(0, Math.round(secondsValue ?? 0))
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

function DomainPill({ label, accent }: { label: string; accent: string }) {
  const { c } = useTheme()
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
      <Sans
        weight="med"
        size={11}
        letterSpacing={0.88}
        color={accent}
        style={{ textTransform: 'uppercase' }}
      >
        {label}
      </Sans>
    </View>
  )
}

function Tag({ label }: { label: string }) {
  const { c } = useTheme()
  return (
    <View style={[styles.tag, { borderColor: c.border }]}>
      <Sans weight="med" size={12} color={c.ink2}>
        {label}
      </Sans>
    </View>
  )
}

function statusColor(status: InboxItem['statusTone'], c: ReturnType<typeof useTheme>['c']): string {
  switch (status) {
    case 'ok':
      return c.moss
    case 'danger':
      return c.recRed
    case 'pending':
      return c.bronze
    case 'muted':
    default:
      return c.ink2
  }
}

function ActionButton({
  label,
  danger,
  disabled,
  onPress,
}: {
  label: string
  danger?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        {
          backgroundColor: pressed ? c.surface : 'transparent',
          borderColor: danger ? c.recRed : c.border,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Sans
        weight="med"
        size={13}
        align="center"
        color={danger ? c.recRed : c.ink}
      >
        {label}
      </Sans>
    </Pressable>
  )
}

function triageSuccessMessage(action: TriageAction, createdProposal: boolean): string {
  switch (action) {
    case 'promote':
      return createdProposal ? 'Proposta criada' : 'Captura marcada para promoção'
    case 'archive':
      return 'Captura arquivada'
    case 'snooze':
      return 'Captura adiada'
    case 'attach_note':
      return 'Captura anexada à nota'
    case 'create_task':
      return 'Tarefa criada'
    case 'create_project':
      return 'Projeto criado'
    case 'create_hypothesis':
      return createdProposal ? 'Hipótese proposta' : 'Captura marcada como hipótese'
  }
}

function hasResolvedDestination(item: InboxItem): boolean {
  const destination = item.triageDestination
  if (destination && [
    'semantic_note',
    'existing_note',
    'task',
    'project',
    'hypothesis',
  ].includes(destination)) {
    return true
  }

  return Boolean(item.targetType && [
    'semantic_note',
    'semantic_curation_proposal',
    'task',
    'project',
    'hypothesis',
  ].includes(item.targetType))
}

function destinationSummaryTitle(item: InboxItem): string {
  return item.triageLabel ?? 'Destino definido'
}

function destinationSummaryBody(item: InboxItem): string {
  if (item.targetTitle) {
    return `${destinationNoun(item)}: ${item.targetTitle}`
  }

  return 'Esta captura já recebeu destino e saiu da triagem aberta.'
}

function destinationNoun(item: InboxItem): string {
  switch (item.triageDestination ?? item.targetType) {
    case 'task':
      return 'Tarefa'
    case 'project':
      return 'Projeto'
    case 'hypothesis':
      return 'Hipótese'
    case 'semantic_note':
    case 'existing_note':
      return 'Nota'
    case 'semantic_curation_proposal':
      return 'Proposta'
    default:
      return 'Destino'
  }
}

function destinationRouteFor(item: InboxItem): '/' | '/memory' | '/projects' | null {
  switch (item.triageDestination ?? item.targetType) {
    case 'task':
      return '/'
    case 'project':
      return '/projects'
    case 'semantic_note':
    case 'existing_note':
    case 'semantic_curation_proposal':
    case 'hypothesis':
      return '/memory'
    default:
      return null
  }
}

function destinationActionLabel(item: InboxItem): string {
  switch (item.triageDestination ?? item.targetType) {
    case 'task':
      return 'Abrir agenda'
    case 'project':
      return 'Abrir projetos'
    case 'semantic_note':
    case 'existing_note':
    case 'semantic_curation_proposal':
    case 'hypothesis':
      return 'Abrir memória'
    default:
      return 'Abrir destino'
  }
}

function canPromote(item: InboxItem): boolean {
  if (item.transcriptionStatus === 'failed' || item.fileIntegrity === 'missing') return false
  if (item.transcriptionStatus === 'pending' || item.transcriptionStatus === 'processing') return false
  return item.text.trim().length > 0
}

function defaultActionTitle(item: InboxItem): string {
  return item.text.replace(/\s+/g, ' ').trim().slice(0, 72)
}

function daysFromNow(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString()
}

function kindDetail(item: InboxItem): string {
  if (item.kind === 'audio') return `Áudio · ${item.transcriptionStatus ?? 'sem status'}`
  if (item.kind === 'photo') return 'Imagem'
  return 'Texto'
}

function fileDetail(item: InboxItem): string {
  if (!item.fileIntegrity || item.fileIntegrity === 'not_applicable') return 'Sem arquivo original'
  if (item.fileIntegrity === 'missing') return 'Arquivo original ausente'
  return item.fileExists === false ? 'Arquivo original ausente' : 'Arquivo original disponível'
}

function privacyDetail(item: InboxItem): string {
  const label = item.privacyLabel ? item.privacyLabel.toLowerCase() : 'normal'
  const externalAi = item.externalAiAllowed === null || item.externalAiAllowed === undefined
    ? 'IA externa indefinida'
    : item.externalAiAllowed
      ? 'IA externa permitida'
      : 'IA externa bloqueada'

  return `${label} · ${externalAi}`
}

function contextDetail(item: InboxItem): string {
  const coords = item.capturedLat !== null && item.capturedLat !== undefined && item.capturedLng !== null && item.capturedLng !== undefined
    ? `${item.capturedLat.toFixed(5)} · ${item.capturedLng.toFixed(5)}`
    : 'sem coordenadas'
  const digital = digitalContextDetail(item.preCaptureContext)

  return [
    item.capturedAt ? formatDateTime(item.capturedAt) : 'sem data',
    coords,
    digital,
  ].filter(Boolean).join(' · ')
}

function historyDetail(item: InboxItem): string {
  if (item.triageUpdatedAt) {
    const destination = item.triageLabel ?? item.triageDestination ?? 'triagem'
    return `Última triagem: ${destination} · ${formatDateTime(item.triageUpdatedAt)}`
  }
  return item.updatedAt ? `Atualizada ${formatDateTime(item.updatedAt)}` : 'Sem histórico de triagem'
}

function digitalContextDetail(context?: Record<string, unknown> | null): string | null {
  if (!context || Object.keys(context).length === 0) return null

  const preferredKeys = [
    'source_name',
    'source',
    'source_kind',
    'url_domain',
    'project_name',
    'task_name',
    'focus_mode_active',
  ]
  const entries = preferredKeys
    .filter((key) => context[key] !== undefined && context[key] !== null && context[key] !== '')
    .slice(0, 3)

  const keys = entries.length > 0 ? entries : Object.keys(context).slice(0, 3)
  if (keys.length === 0) return null

  return keys
    .map((key) => `${humanContextKey(key)}: ${formatContextValue(context[key])}`)
    .join(' · ')
}

function humanContextKey(key: string): string {
  switch (key) {
    case 'source_name':
      return 'fonte'
    case 'source':
      return 'origem'
    case 'source_kind':
      return 'tipo'
    case 'url_domain':
      return 'domínio'
    case 'project_name':
      return 'projeto'
    case 'task_name':
      return 'tarefa'
    case 'focus_mode_active':
      return 'foco'
    default:
      return key.replace(/_/g, ' ')
  }
}

function formatContextValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'sim' : 'não'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value.length > 42 ? `${value.slice(0, 39)}...` : value
  if (Array.isArray(value)) return `${value.length} item(ns)`
  if (value && typeof value === 'object') return 'objeto'
  return 'indefinido'
}

function historyEventTitle(event: NonNullable<InboxItem['triageHistory']>[number]): string {
  const action = actionLabel(event.action)
  const destination = destinationLabel(event.destination)
  return destination ? `${action} · ${destination}` : action
}

function historyEventMeta(event: NonNullable<InboxItem['triageHistory']>[number]): string {
  const pieces = [
    event.at ? formatDateTime(event.at) : null,
    event.changed_destination && event.previous_destination
      ? `antes: ${destinationLabel(event.previous_destination) ?? event.previous_destination}`
      : null,
    event.reason ?? null,
  ].filter(Boolean)

  return pieces.length > 0 ? pieces.join(' · ') : 'Evento de triagem'
}

function densityLabel(clarification: NonNullable<InboxItem['semanticClarification']>): string {
  const score = clarification.density?.score
  const percent = typeof score === 'number' ? `${Math.round(score * 100)}%` : 'sem score'
  return `${clarification.density?.label ?? 'densidade'} · ${percent}`
}

function densityColor(score: number | null | undefined, c: ReturnType<typeof useTheme>['c']): string {
  if (typeof score !== 'number') return c.ink2
  if (score >= 0.72) return c.moss
  if (score >= 0.45) return c.bronze
  return c.ink2
}

function destinationDetail(clarification: NonNullable<InboxItem['semanticClarification']>): string {
  const destination = clarification.possibleDestination
  return [
    destination?.noteType ?? clarification.suggestedType,
    destination?.path,
    destination?.reason,
  ].filter(Boolean).join(' · ') || 'sem destino sugerido'
}

function actionLabel(action?: string | null): string {
  switch (action) {
    case 'promote':
      return 'Promoveu'
    case 'archive':
      return 'Arquivou'
    case 'snooze':
      return 'Adiou'
    case 'attach_note':
      return 'Anexou a nota'
    case 'create_task':
      return 'Criou tarefa'
    case 'create_project':
      return 'Criou projeto'
    case 'create_hypothesis':
      return 'Criou hipótese'
    default:
      return 'Triagem'
  }
}

function destinationLabel(destination?: string | null): string | null {
  switch (destination) {
    case 'archive':
      return 'arquivo'
    case 'later':
      return 'adiada'
    case 'existing_note':
      return 'nota existente'
    case 'task':
      return 'tarefa'
    case 'project':
      return 'projeto'
    case 'hypothesis':
      return 'hipótese'
    case 'semantic_note':
      return 'nota viva'
    default:
      return null
  }
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  body: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 28 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rawNotice: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
    gap: 3,
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  statusPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    width: 0,
    height: 0,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 3,
  },
  pauseGlyph: {
    width: 13,
    height: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pauseBar: {
    width: 4,
    height: 16,
    borderRadius: 1.5,
  },
  wave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
  },
  tags: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  tag: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
  },
  infoPanel: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 4,
    marginBottom: 14,
  },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  historyList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  historyEvent: { gap: 1 },
  triagePanel: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
    gap: 10,
  },
  clarificationPanel: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
    gap: 10,
  },
  clarificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  infoBlock: { gap: 4 },
  triageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inlinePanel: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    gap: 9,
  },
  inlineActions: { flexDirection: 'row', gap: 8 },
  prioritySelector: { gap: 7 },
  priorityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  priorityPill: {
    minHeight: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    justifyContent: 'center',
  },
  destinationPanel: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  destinationActions: {
    alignItems: 'flex-start',
    marginTop: 4,
  },
  triageInput: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  noteResults: { gap: 6 },
  noteResult: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 2,
  },
  actionBtn: {
    flexGrow: 1,
    minWidth: 96,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
