import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioSource } from 'expo-audio'
import { useRouter } from 'expo-router'
import { Frau, Label, Mono, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import { useOverlays } from '../../../lib/overlays'
import { useShell } from '../../AtlasShell'
import { domainColor, domainLabel } from '../../../lib/domains'
import type { InboxItem } from '../../InboxCard'
import { useAtlasStore } from '../../../lib/atlasStore'
import { listSemanticNotes, type AtlasSemanticNote } from '../../../lib/api/client'
import { copyToClipboard, COPY_LONG_PRESS_DELAY } from '../../../lib/clipboard'
import { ActionButton, InfoListBlock, Tag } from './DetailPrimitives'
import { QuickActionBar, SnoozeSheet, TriageOverflowSheet } from './DetailActions'
import {
  canPromote,
  contextDetailEditorial,
  daysFromNow,
  defaultActionTitle,
  destinationActionLabel,
  destinationRouteFor,
  fileDetail,
  formatDateTime,
  formatDuration,
  formatDurationSeconds,
  hasResolvedDestination,
  historyDetail,
  historyEventMeta,
  historyEventTitle,
  kindDetail,
  kindShortLabel,
  noteMatchesQuery,
  privacyDetail,
  statusColor,
  TASK_PRIORITIES,
  type TaskPriority,
  taskPriorityLabel,
  type TriageAction,
} from './detailHelpers'

const WAVE_HEIGHTS = [4, 8, 14, 20, 26, 22, 16, 10, 6, 12, 18, 24, 28, 22, 16, 10, 6, 4, 8, 14, 20, 26, 30, 24, 18, 12, 8, 4, 10, 16, 22, 18, 12, 8, 6, 10, 14, 8, 4, 4]

interface ContentProps {
  item: InboxItem
  onEdit: () => void
  onMove: () => void
  onDelete: () => void
  onRetryTranscription: () => Promise<void>
  onTriage: (input: TriageInput) => Promise<boolean>
  onClarify: () => Promise<boolean>
}

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

export function DetailContent({ item, onEdit, onMove, onDelete, onRetryTranscription, onTriage, onClarify }: ContentProps) {
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
  // Direção B v9 · overflow ••• menu pra ações secundárias (Adiar/Anexar/Criar tarefa
  // /Criar projeto/Criar hipótese/Editar/Mover/Excluir). Visíveis ficam só Promover
  // primary + Arquivar secondary. iOS pattern: 1 primary + 1 secondary + ••• overflow.
  const [overflowOpen, setOverflowOpen] = useState(false)
  // Snooze sub-sheet · "ADIAR PARA · amanhã / 7 dias / 30 dias" (v8 mockup Frente 5).
  // Aberto quando user pica "Adiar" no overflow · sub-BottomSheet em vez de inline.
  const [snoozeOpen, setSnoozeOpen] = useState(false)
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
    <>
    {/* v13 · meta header SINGLE-ROW · ATLAS centralizado · 3-column FLEX BASELINE.
        Layout: [Left flex:1 baseline] + [Center natural width] + [Right flex:1 baseline].
        Sides com flex:1 distribuem espaço igual ao redor do center → ATLAS no
        centro visual. alignItems:baseline em todos = baselines tipográficos
        alinhados (Mono 11.5 / Frau 13 / Sans 12 / Sans 14 todos no mesmo baseline). */}
    <View style={[styles.metaHeader, { backgroundColor: c.bg }]}>
      <View style={styles.metaRowSingle}>
        {/* Left cluster · time + kind · flex:1 */}
        <View style={styles.metaSideLeft}>
          <Mono size={11.5} lineHeight={14} color={c.ink2} letterSpacing={0.6}>
            {item.time}
          </Mono>
          {item.kind ? (
            <Frau italic size={13} lineHeight={14} color={c.ink2}>
              {kindShortLabel(item.kind)}
            </Frau>
          ) : null}
        </View>

        {/* Center cluster · natural width · ● DOMAIN identity */}
        <View style={styles.metaCenterCluster}>
          <View style={[styles.metaDomainBullet, { backgroundColor: accent }]} />
          <Sans
            weight="med"
            size={12}
            lineHeight={14}
            letterSpacing={2.0}
            color={accent}
            style={styles.uppercase}
          >
            {item.domainLabel ?? domainLabel(item.domain, domains)}
          </Sans>
        </View>

        {/* Right cluster · privacy + ⋯ · flex:1 end-aligned */}
        <View style={styles.metaSideRight}>
          {item.sensitivity === 'private' || item.sensitivity === 'sensitive' ? (
            <Frau italic size={12} lineHeight={14} color={c.ink3}>
              {item.privacyLabel?.toLowerCase() ?? 'privado'}
            </Frau>
          ) : null}
          <Pressable
            onPress={() => setOverflowOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="mais ações"
            hitSlop={10}
            style={({ pressed }) => [
              styles.metaOverflow,
              { opacity: pressed ? 0.55 : 1 },
            ]}
          >
            <Sans size={14} lineHeight={14} color={c.ink2}>⋯</Sans>
          </Pressable>
        </View>
      </View>

      {/* Hairline scroll-edge · bronze @ 8% · sinal sussurrado de "header termina". */}
      <View style={styles.metaHeaderRule} />
    </View>

    <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
      {/* Direção B v9 · removidos headline "Captura" + rawNotice ("Isso ainda é
          captura bruta…") · ambos eram tautológicos · usuário abriu detalhe, sabe.
          Agente Atlas: "user already knows it's a capture" · ~110pt de respiro
          recuperados · body vira protagonista absoluto do primeiro viewport. */}
      <Pressable
        onLongPress={() => void copyToClipboard(item.text, () => showToast('Copiado'))}
        delayLongPress={COPY_LONG_PRESS_DELAY}
        accessibilityHint="pressionar e segurar copia o texto da captura"
        style={({ pressed }) => [{ marginBottom: 28, opacity: pressed ? 0.7 : 1 }]}
      >
        {/* v12 · removidos « » Unicode quotes (matching InboxCard) · design limpo.
            Frau italic 22pt já comunica "captura/citação" pelo peso tipográfico. */}
        <Frau italic size={22} lineHeight={32} letterSpacing={-0.18} color={c.ink}>
          {item.text}
        </Frau>
      </Pressable>

      {/* statusPanel só aparece em estados não-ok · v7 editorial · quando transcrição
          está done o body JÁ é a transcrição, caixa "TRANSCRITA · Texto pronto" só
          gritava redundância. Erros/pending seguem visíveis (usuário precisa saber). */}
      {item.statusTone !== 'ok' && (
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
      )}

      {item.kind === 'audio' && (
        <View style={{ marginBottom: 14 }}>
          {/* v7 audio · slim utilitário · sem bg cheia, só hairline topo+base.
              Play menor (28), waveform mais fina (altura 22, barra 1.5), duration mono.
              É ferramenta de verificação do transcrito · não deve dominar a leitura. */}
          <View style={[styles.player, { borderColor: c.border }]}>
            <Pressable
              onPress={togglePlayback}
              accessibilityRole="button"
              accessibilityLabel={status.playing ? 'pausar áudio' : 'reproduzir áudio'}
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
                // Altura escalada pra altura do wave reduzida (32→22) · ratio 0.7.
                const scaledH = Math.max(2, h * 0.7)
                return (
                  <View
                    key={i}
                    style={{
                      width: 1.5,
                      height: scaledH,
                      backgroundColor: c.prussian,
                      borderRadius: 1,
                      opacity: played ? 1 : 0.32,
                      marginRight: 1.5,
                    }}
                  />
                )
              })}
            </View>
            <Mono size={11} color={c.ink2} letterSpacing={0.4}>
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

      {/* Ordem editorial v7: voz do Atlas (clarification) vem ANTES da metadata
          (origem/contexto). Atlas fala primeiro · forensics depois. */}
      <ClarificationProse
        item={item}
        loading={clarifying}
        onClarify={async () => {
          if (item.isLocal || clarifying) return

          setClarifying(true)
          await onClarify()
          setClarifying(false)
        }}
      />

      <MetadataDisclosure item={item} />

      {item.isLocal && (
        <Sans size={12} lineHeight={17} color={c.ink2} style={{ marginTop: 14 }}>
          Sincronize a captura antes de aplicar triagem.
        </Sans>
      )}

      {/* Inline picker quando user pica tarefa/projeto/anexar (precisa input).
          Renderiza acima da QuickActionBar fixa · ScrollView tem paddingBottom
          suficiente pra picker não ficar coberto. */}
      <TriageInlineMode
        mode={actionMode}
        title={actionTitle}
        setTitle={setActionTitle}
        disabled={triageDisabled}
        onRun={runTriage}
      />
    </ScrollView>

    {/* v9 v7-aligned · QuickActionBar fixa no rodapé do sheet · 5 ações editoriais.
        Foco e performance · usuário não rola pra triar. Independe do tamanho do
        body/clarification · sempre acessível. Hairlines verticais entre os 5 verbos,
        arquivar em recRed (destrutivo), todos Frau italic. ••• overflow virou
        ícone discreto no canto superior do sheet (próximo do PRIVADO no header). */}
    <QuickActionBar
      hasDestination={hasDestination}
      destinationLabel={hasDestination ? destinationActionLabel(item) : null}
      triaging={triaging}
      disabled={triageDisabled}
      promoteReady={canPromote(item)}
      onPromote={() => {
        if (hasDestination && destinationRoute) {
          close()
          router.push(destinationRoute)
        } else {
          void runTriage({ action: 'promote' })
        }
      }}
      onTask={() => setActionMode(actionMode === 'create_task' ? null : 'create_task')}
      onProject={() => setActionMode(actionMode === 'create_project' ? null : 'create_project')}
      onSnooze={() => setSnoozeOpen(true)}
      onArchive={() => void runTriage({ action: 'archive' })}
    />

    {/* Overflow sheet · ações secundárias agrupadas por intenção.
        Triagem (5) → Editar (2) → Destrutivo (1, vermelho discreto). */}
    <TriageOverflowSheet
      visible={overflowOpen}
      onClose={() => setOverflowOpen(false)}
      triaging={triaging}
      disabled={triageDisabled}
      hasDestination={hasDestination}
      onAction={(act) => {
        setOverflowOpen(false)
        if (act === 'snooze') setSnoozeOpen(true)
        else if (act === 'attach_note') setActionMode(actionMode === 'attach_note' ? null : 'attach_note')
        else if (act === 'create_task') setActionMode(actionMode === 'create_task' ? null : 'create_task')
        else if (act === 'create_project') setActionMode(actionMode === 'create_project' ? null : 'create_project')
        else if (act === 'create_hypothesis') void runTriage({ action: 'create_hypothesis', title: actionTitle })
        else if (act === 'edit') onEdit()
        else if (act === 'move') onMove()
        else if (act === 'delete') onDelete()
      }}
    />

    {/* Snooze sub-sheet · v8 Frente 5 · 3 opções editoriais com data calculada */}
    <SnoozeSheet
      visible={snoozeOpen}
      onClose={() => setSnoozeOpen(false)}
      disabled={triageDisabled}
      onSelect={(days, reason) => {
        setSnoozeOpen(false)
        void runTriage({ action: 'snooze', snoozed_until: daysFromNow(days), reason })
      }}
    />
    </>
  )
}

// Direção B v9 · metadata por padrão é UMA linha italic no rodapé.
// Tap abre o registro técnico completo (InfoSection) inline.
// Forensics não compete com leitura · disclosure on demand.
function MetadataDisclosure({ item }: { item: InboxItem }) {
  const { c } = useTheme()
  const [open, setOpen] = useState(false)

  // Linha de resumo · "capturado às 03:09 · áudio 11s · privado"
  const summary = useMemo(() => {
    const time = item.capturedAt ? formatDateTime(item.capturedAt) : null
    const kindBit = kindShortLabel(item.kind ?? 'text')
    const durBit = item.durationMs ? formatDuration(item.durationMs) : null
    const privacy = item.sensitivity === 'private' || item.sensitivity === 'sensitive'
      ? (item.privacyLabel ?? 'privado').toLowerCase()
      : null
    return [time, kindBit + (durBit ? ` ${durBit}` : ''), privacy].filter(Boolean).join(' · ')
  }, [item.capturedAt, item.kind, item.durationMs, item.sensitivity, item.privacyLabel])

  return (
    <View style={styles.metadataDisclosure}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={open ? 'fechar registro técnico' : 'abrir registro técnico'}
        hitSlop={6}
        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
      >
        <Frau italic size={13} lineHeight={20} color={c.ink3}>
          {summary}
          <Frau italic size={13} lineHeight={20} color={c.ink3}>
            {open ? '   ⌃ fechar registro' : '   ⌄ ver registro'}
          </Frau>
        </Frau>
      </Pressable>

      {open && (
        <View style={{ marginTop: 18 }}>
          <InfoSection item={item} />
        </View>
      )}
    </View>
  )
}

function InfoSection({ item }: { item: InboxItem }) {
  const { c } = useTheme()
  // v7 editorial · sem linha "Origem" (sempre é Servidor Atlas vs App mobile · ruído).
  // Contexto sem coordenadas crus (5 decimais era dev-feel) · só data + contexto digital.
  const rows: Array<[string, string]> = [
    ['Tipo', kindDetail(item)],
    ['Arquivo', fileDetail(item)],
    ['Privacidade', privacyDetail(item)],
    ['Contexto', contextDetailEditorial(item)],
    ['Histórico', historyDetail(item)],
  ]

  return (
    <View style={styles.infoBlockBare}>
      <Label color={c.ink2}>Origem, contexto e histórico</Label>
      <View style={{ marginTop: 14, gap: 9 }}>
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

// v10 · v7 mockup literal · ACLARADO POR ATLAS section header + 4 sub-labels.
// Decisão (após drift Direção B): mockup É o spec, não inspiração.
// Estrutura editorial: small-caps labels = cartografia sussurrada (P12),
// não ausência de cartografia. Body em Frau regular ink full (não italic, não muted).
// Ideias atômicas = bullet list com hairline-left (InfoListBlock existente).
// P8 bronze count v12: 1 ✦ no tipo sugerido (« » glyphs removidos por limpeza).
function ClarificationProse({
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
      <View style={styles.clarificationBlock}>
        <Label color={c.ink2}>Aclarado por Atlas</Label>
        <Frau italic size={15} lineHeight={22} color={c.ink2} style={{ marginTop: 8 }}>
          Aguardando aclaramento.
        </Frau>
        {canClarify ? (
          <ActionButton label={loading ? 'Aclarando…' : 'Aclarar agora'} disabled={loading} onPress={() => void onClarify()} />
        ) : null}
      </View>
    )
  }

  const ideas = clarification.atomicIdeas?.slice(0, 5) ?? []
  const tension = clarification.tensionOrQuestion
  const suggestedType = clarification.suggestedType

  return (
    <View style={styles.clarificationBlock}>
      {/* Section header · âncora editorial "essa é a voz do Atlas" */}
      <Label color={c.ink2}>Aclarado por Atlas</Label>

      {/* TESE PRINCIPAL · v7 label + body em Frau regular ink full */}
      <View style={styles.clarSubsection}>
        <Sans
          weight="med"
          size={10}
          lineHeight={14}
          letterSpacing={1.2}
          color={c.ink2}
          style={styles.uppercase}
        >
          Tese principal
        </Sans>
        <Frau size={17} lineHeight={26} letterSpacing={-0.06} color={c.ink} style={{ marginTop: 6 }}>
          {clarification.mainThesis}
        </Frau>
      </View>

      {/* IDEIAS ATÔMICAS · bullet list com hairline-left (InfoListBlock existente) */}
      {ideas.length > 0 && (
        <InfoListBlock label="Ideias atômicas" items={ideas} />
      )}

      {/* TENSÃO · PERGUNTA · v7 label + body italic ink (perguntar = oralidade) */}
      {tension && (
        <View style={styles.clarSubsection}>
          <Sans
            weight="med"
            size={10}
            lineHeight={14}
            letterSpacing={1.2}
            color={c.ink2}
            style={styles.uppercase}
          >
            Tensão · pergunta
          </Sans>
          <Frau italic size={17} lineHeight={26} letterSpacing={-0.06} color={c.ink} style={{ marginTop: 6 }}>
            {tension}
          </Frau>
        </View>
      )}

      {/* TIPO SUGERIDO · label + ✦ bronze + tipo italic bronze (único accent) */}
      {suggestedType && suggestedType !== 'sem tipo' && (
        <View style={[styles.clarSubsection, styles.clarTypeRow]}>
          <Sans
            weight="med"
            size={10}
            lineHeight={14}
            letterSpacing={1.2}
            color={c.ink2}
            style={styles.uppercase}
          >
            Tipo sugerido
          </Sans>
          {/* canon mockup · em-dash bronze inline (substitui ✦ que é proibido
              como decoração · ✦ é signature exclusiva pra capture button,
              empty state Atlas AI, send, voice mode, refresh sync). */}
          <Frau size={14} lineHeight={20} color={c.bronze} style={{ marginLeft: 12 }}>—</Frau>
          <Frau italic size={14} lineHeight={20} color={c.bronze} style={{ marginLeft: 6 }}>
            {suggestedType}
          </Frau>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  // v10 final · metaHeader saiu pra fora do ScrollView · paddingTop 0 (metaHeader
  // já dá padding bottom 18) · paddingBottom 96 (action bar 56 + insets ~34 + breath).
  body: { paddingHorizontal: 28, paddingTop: 0, paddingBottom: 96 },
  // v13 · meta header SINGLE-ROW · 3-column FLEX BASELINE (não absolute).
  // Outer container · padding vertical balanceado pra row tipograficamente justa.
  metaHeader: {
    paddingTop: 4,
    paddingBottom: 14,
  },
  // Row 3-column · alignItems baseline em TODOS níveis · todos os textos
  // (Mono/Frau/Sans em sizes diferentes) compartilham mesmo baseline tipográfico.
  // gap 12 entre clusters · paddingHorizontal 28 (matching body do scroll).
  metaRowSingle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 28,
    gap: 12,
  },
  // Left side · flex 1 · time + kind alinhados à esquerda em baseline.
  metaSideLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  // Right side · flex 1 · privacy + ⋯ alinhados à DIREITA em baseline.
  metaSideRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
    gap: 12,
  },
  // Center cluster · width natural · sides flex:1 distribuem espaço igualmente
  // ao redor → ATLAS sempre no centro visual. Não precisa mais de absolute.
  metaCenterCluster: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  // canon mockup detail-meta-header · border-bottom 1px bronze @ 18%.
  // Sinal "header termina" em sussurro warm (não cinza technical).
  metaHeaderRule: {
    height: 1,
    backgroundColor: 'rgba(155,122,63,0.18)',
  },
  // v7 audio slim · sem bg cheia · só hairlines topo+base definindo o row.
  // Padding vertical reduzido (12→8) · play menor (36→28) · wave height 32→22.
  // Ferramenta utilitária pra verificar transcrição · não dominar leitura.
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginBottom: 0,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 8,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 2,
  },
  pauseGlyph: {
    width: 9,
    height: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pauseBar: {
    width: 2.5,
    height: 11,
    borderRadius: 1,
  },
  wave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
  },
  tags: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  // v7 editorial · seções bare · sem moldura, sem bg · respiração no marfim do sheet.
  // Era infoPanel/clarificationPanel com border + paddingHorizontal · agora só margens
  // verticais. As hairlines internas (history list, infoListWrap) seguem.
  infoBlockBare: {
    marginBottom: 22,
  },
  metadataDisclosure: {
    marginTop: 18,
    marginBottom: 18,
  },
  clarificationBlock: {
    marginBottom: 28,
  },
  // v10 · subsection v7 · spacing 18pt acima (cartografia sussurrada).
  // Cada subsection começa com label small-caps + body abaixo.
  clarSubsection: {
    marginTop: 18,
  },
  clarTypeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  historyList: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  historyEvent: { gap: 1 },
  // v11 · bullet 6→7 (mais peso na masthead row centralizada) · marginHorizontal removido
  // (gap do metaDomainRow já cuida do spacing).
  metaDomainBullet: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  // v11 · ⋯ overflow trigger · agora dentro do metaSupportRow flex spacer.
  // flex:1 spacer empurra privacy + ⋯ pra direita · marginLeft auto removido.
  // Hit slop generoso (10) pra fácil acesso ao tap.
  metaOverflow: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  uppercase: { textTransform: 'uppercase' },
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
})
