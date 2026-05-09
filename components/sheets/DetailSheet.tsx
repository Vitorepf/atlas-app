import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
                  if (deleted) {
                    close()
                    showToast('Captura excluída')
                    return
                  }
                  showToast('Falha ao excluir captura')
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

// Variante editorial do contextDetail · sem coordenadas crus (eram dev-feel "5 decimais").
// As coords seguem na InboxItem · acessíveis no futuro via disclosure "ver origem completa".
function contextDetailEditorial(item: InboxItem): string {
  const digital = digitalContextDetail(item.preCaptureContext)
  return [
    item.capturedAt ? formatDateTime(item.capturedAt) : 'sem data',
    digital,
  ].filter(Boolean).join(' · ')
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
          <Frau italic size={14} lineHeight={20} color={c.bronze} style={{ marginLeft: 12 }}>✦</Frau>
          <Frau italic size={14} lineHeight={20} color={c.bronze} style={{ marginLeft: 6 }}>
            {suggestedType}
          </Frau>
        </View>
      )}
    </View>
  )
}

// Lista vertical com hairline lateral à esquerda · estilo citação editorial v7.
// Usado pra ideias atômicas e gatilhos futuros — itens que merecem respiração própria.
function InfoListBlock({ label, items }: { label: string; items: string[] }) {
  const { c } = useTheme()
  return (
    <View style={styles.infoBlock}>
      <Sans
        weight="med"
        size={9.5}
        lineHeight={13}
        letterSpacing={1.2}
        color={c.ink2}
        style={styles.uppercase}
      >
        {label}
      </Sans>
      <View style={[styles.infoListWrap, { borderLeftColor: c.border }]}>
        {items.map((item, i) => (
          <Frau
            key={i}
            italic
            size={14}
            lineHeight={20}
            letterSpacing={-0.07}
            color={c.ink}
            style={i > 0 ? styles.infoListItemSpacing : undefined}
          >
            {item}
          </Frau>
        ))}
      </View>
    </View>
  )
}

function InfoBlock({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { c } = useTheme()

  return (
    <View style={styles.infoBlock}>
      <Sans
        weight="med"
        size={9.5}
        lineHeight={13}
        letterSpacing={1.2}
        color={c.ink2}
        style={styles.uppercase}
      >
        {label}
      </Sans>
      <View style={styles.infoBlockValueRow}>
        {accent ? (
          <Frau italic size={13} lineHeight={20} color={c.bronze} style={styles.infoBlockStar}>
            ✦
          </Frau>
        ) : null}
        <Frau
          italic
          size={14}
          lineHeight={20}
          letterSpacing={-0.07}
          color={accent ? c.prussian : c.ink}
          style={styles.infoBlockValue}
        >
          {value}
        </Frau>
      </View>
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

// QuickActionBar · v7 mockup · 5 ações editoriais fixas no rodapé do sheet.
// Frau italic 14pt · hairlines verticais · arquivar em recRed (destrutivo).
// Cada ação é um Pressable com flex:1 · respiração igual entre verbos.
// + ícone ••• discreto à direita pra acessar o overflow (Anexar/Hipótese/Edit/Move/Excluir).
//
// Princípio: usuário pica destino direto sem rolar tudo · Atlas é foco e performance.
// Pós-triagem (hasDestination=true), Promover vira o label do destino ("Abrir nota viva")
// e os outros 4 ficam disabled · estado consistente, ação retroativa explícita.
function QuickActionBar({
  hasDestination,
  destinationLabel,
  triaging,
  disabled,
  promoteReady,
  onPromote,
  onTask,
  onProject,
  onSnooze,
  onArchive,
}: {
  hasDestination: boolean
  destinationLabel: string | null
  triaging: TriageAction | null
  disabled: boolean
  promoteReady: boolean
  onPromote: () => void
  onTask: () => void
  onProject: () => void
  onSnooze: () => void
  onArchive: () => void
}) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const promoteLabel = hasDestination
    ? (destinationLabel ?? 'Abrir')
    : (triaging === 'promote' ? 'promovendo…' : 'promover')
  const archiveLabel = triaging === 'archive' ? 'arquivando…' : 'arquivar'
  return (
    <View
      style={[
        actionBarStyles.bar,
        {
          backgroundColor: c.bg,
          borderTopColor: c.border,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <QuickAction
        label={promoteLabel}
        onPress={onPromote}
        disabled={disabled || (!hasDestination && !promoteReady)}
        divider
      />
      <QuickAction
        label="tarefa"
        onPress={onTask}
        disabled={disabled || hasDestination}
        divider
      />
      <QuickAction
        label="projeto"
        onPress={onProject}
        disabled={disabled || hasDestination}
        divider
      />
      <QuickAction
        label="adiar"
        onPress={onSnooze}
        disabled={disabled || hasDestination}
        divider
      />
      <QuickAction
        label={archiveLabel}
        onPress={onArchive}
        disabled={disabled}
        danger
      />
    </View>
  )
}

function QuickAction({
  label,
  onPress,
  disabled,
  divider,
  danger,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  divider?: boolean
  danger?: boolean
}) {
  const { c } = useTheme()
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        actionBarStyles.action,
        divider && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.border },
        {
          opacity: disabled ? 0.32 : pressed ? 0.55 : 1,
        },
      ]}
    >
      <Frau
        italic
        size={14}
        lineHeight={18}
        color={danger ? c.recRed : c.ink}
        numberOfLines={1}
      >
        {label}
      </Frau>
    </Pressable>
  )
}

const actionBarStyles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 0,
    minHeight: 56,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 4,
  },
})

type OverflowAction =
  | 'snooze'
  | 'attach_note'
  | 'create_task'
  | 'create_project'
  | 'create_hypothesis'
  | 'edit'
  | 'move'
  | 'delete'

// BottomSheet com ações secundárias agrupadas por intenção · 3 grupos:
// (1) Triagem complementar · (2) Edição · (3) Destrutivo (Excluir, vermelho discreto).
// HIG: destructive at end + .destructive role; aqui = recRed text + hairline isolada.
function TriageOverflowSheet({
  visible,
  onClose,
  onAction,
  triaging,
  disabled,
  hasDestination,
}: {
  visible: boolean
  onClose: () => void
  onAction: (act: OverflowAction) => void
  triaging: TriageAction | null
  disabled: boolean
  hasDestination: boolean
}) {
  const { c } = useTheme()
  // Sheet 75% · 8 OverflowRows + 2 dividers + 2 group labels não cabem em 520.
  // ScrollView interno garante que se vier mais ação no futuro nada quebra.
  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView
        style={overflowStyles.scroll}
        contentContainerStyle={overflowStyles.wrap}
        showsVerticalScrollIndicator={false}
      >
        <Frau italic size={13} lineHeight={18} color={c.ink2} style={overflowStyles.groupLabel}>
          Triagem
        </Frau>
        <OverflowRow
          label="Adiar"
          subtitle="dormir e voltar amanhã, semana, mês"
          disabled={disabled}
          onPress={() => onAction('snooze')}
        />
        <OverflowRow
          label="Anexar a uma nota"
          subtitle="virar bloco em nota viva existente"
          disabled={disabled}
          onPress={() => onAction('attach_note')}
        />
        <OverflowRow
          label="Criar tarefa"
          subtitle="vira ação no projeto"
          disabled={disabled}
          onPress={() => onAction('create_task')}
        />
        <OverflowRow
          label="Criar projeto"
          subtitle="vira projeto novo no atlas"
          disabled={disabled}
          onPress={() => onAction('create_project')}
        />
        <OverflowRow
          label={triaging === 'create_hypothesis' ? 'Criando hipótese…' : 'Criar hipótese'}
          subtitle="vira hipótese no laboratório"
          disabled={disabled || triaging === 'create_hypothesis'}
          onPress={() => onAction('create_hypothesis')}
        />

        <View style={[overflowStyles.divider, { backgroundColor: c.border }]} />

        <Frau italic size={13} lineHeight={18} color={c.ink2} style={overflowStyles.groupLabel}>
          Registro
        </Frau>
        <OverflowRow
          label="Editar texto"
          subtitle="ajustar transcrição ou conteúdo"
          onPress={() => onAction('edit')}
        />
        <OverflowRow
          label="Mover de domínio"
          subtitle={hasDestination ? 'já triada · pode reatribuir' : 'reatribuir antes da triagem'}
          onPress={() => onAction('move')}
        />

        <View style={[overflowStyles.divider, { backgroundColor: c.border }]} />

        <OverflowRow
          label="Excluir captura"
          subtitle="apaga em definitivo · não há undo"
          danger
          onPress={() => onAction('delete')}
        />
      </ScrollView>
    </BottomSheet>
  )
}

// SnoozeSheet · v8 Frente 5 mockup · "ADIAR PARA" + 3 rows editoriais.
// Cada row: Frau italic label (esq) + Mono date (dir) + chevron sutil.
// Datas calculadas dinamicamente via daysFromNow + abreviação PT-BR.
function SnoozeSheet({
  visible,
  onClose,
  onSelect,
  disabled,
}: {
  visible: boolean
  onClose: () => void
  onSelect: (days: number, reason: string) => void
  disabled: boolean
}) {
  const { c } = useTheme()
  const options: Array<{ days: number; label: string; reason: string }> = [
    { days: 1, label: 'amanhã', reason: 'Adiada para revisão amanhã' },
    { days: 7, label: '7 dias', reason: 'Adiada por uma semana' },
    { days: 30, label: '30 dias', reason: 'Adiada por trinta dias' },
  ]
  return (
    <BottomSheet visible={visible} onClose={onClose} height={340}>
      <View style={snoozeStyles.wrap}>
        <Sans
          weight="med"
          size={11}
          letterSpacing={1.4}
          color={c.ink2}
          style={[snoozeStyles.title, { color: c.ink2 }]}
        >
          ADIAR PARA
        </Sans>
        <View style={[snoozeStyles.divider, { backgroundColor: c.border }]} />
        {options.map((opt, idx) => (
          <View key={opt.days}>
            <Pressable
              onPress={() => onSelect(opt.days, opt.reason)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`adiar para ${opt.label}`}
              style={({ pressed }) => [
                snoozeStyles.row,
                { opacity: disabled ? 0.4 : pressed ? 0.55 : 1 },
              ]}
            >
              <Frau italic size={20} lineHeight={26} letterSpacing={-0.1} color={c.ink}>
                {opt.label}
              </Frau>
              <View style={snoozeStyles.rowRight}>
                <Mono size={12} letterSpacing={0.4} color={c.ink2}>
                  {snoozeDateLabel(opt.days)}
                </Mono>
                <Frau size={14} lineHeight={18} color={c.ink3} style={{ marginLeft: 8 }}>
                  ›
                </Frau>
              </View>
            </Pressable>
            {idx < options.length - 1 && (
              <View style={[snoozeStyles.divider, { backgroundColor: c.border }]} />
            )}
          </View>
        ))}
      </View>
    </BottomSheet>
  )
}

// "qua, 06.05" · abreviação PT-BR de 3 letras + DD.MM
const PT_DAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
function snoozeDateLabel(days: number): string {
  const target = new Date()
  target.setDate(target.getDate() + days)
  const dow = PT_DAYS[target.getDay()]
  const dd = String(target.getDate()).padStart(2, '0')
  const mm = String(target.getMonth() + 1).padStart(2, '0')
  return `${dow}, ${dd}.${mm}`
}

const snoozeStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 28,
    paddingTop: 4,
    paddingBottom: 32,
  },
  title: {
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
})

function OverflowRow({
  label,
  subtitle,
  danger,
  disabled,
  onPress,
}: {
  label: string
  subtitle?: string
  danger?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        overflowStyles.row,
        {
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Frau
        size={17}
        lineHeight={22}
        letterSpacing={-0.07}
        color={danger ? c.recRed : c.ink}
      >
        {label}
      </Frau>
      {subtitle && (
        <Frau italic size={12.5} lineHeight={17} color={c.ink2} style={{ marginTop: 1 }}>
          {subtitle}
        </Frau>
      )}
    </Pressable>
  )
}

const overflowStyles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  wrap: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 48,
  },
  groupLabel: {
    marginTop: 14,
    marginBottom: 4,
    letterSpacing: 0.24,
    textTransform: 'lowercase',
  },
  row: {
    paddingVertical: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
})

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

// Label curto pra meta line · "áudio / imagem / texto"
function kindShortLabel(kind: NonNullable<InboxItem['kind']>): string {
  switch (kind) {
    case 'audio': return 'áudio'
    case 'photo': return 'imagem'
    case 'text': return 'texto'
  }
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
  // Hairline scroll-edge · bronze @ 8% opacity · sinal sutil de "header termina".
  // iOS 17 pattern: header tem edge fade quando content rola atrás.
  metaHeaderRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(155,122,63,0.10)',
  },
  // metaRow legado · referenciado em outros pontos do app · mantido pra retrocompat.
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 0, marginBottom: 24 },
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
  // QuickActionBar styles vivem em actionBarStyles · esses (primaryAction/
  // secondaryAction/overflowDot/triageRow) ficaram orfãos quando substituí
  // pela barra fixa v7. Removidos pra reduzir confusão de design system.
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
  triagePanel: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
    gap: 10,
  },
  infoBlock: { gap: 5, marginBottom: 14 },
  infoBlockValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  infoBlockStar: { lineHeight: 14 },
  infoBlockValue: { flex: 1, minWidth: 0 },
  infoListWrap: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: 12,
    marginTop: 2,
  },
  infoListItemSpacing: {
    marginTop: 6,
  },
  metaSep: { opacity: 0.45 },
  // v11 · bullet 6→7 (mais peso na masthead row centralizada) · marginHorizontal removido
  // (gap do metaDomainRow já cuida do spacing).
  metaDomainBullet: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  metaPrivacy: { marginLeft: 'auto' },
  // v11 · ⋯ overflow trigger · agora dentro do metaSupportRow flex spacer.
  // flex:1 spacer empurra privacy + ⋯ pra direita · marginLeft auto removido.
  // Hit slop generoso (10) pra fácil acesso ao tap.
  metaOverflow: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  uppercase: { textTransform: 'uppercase' },
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
