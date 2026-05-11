import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { Frau, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { type DomainKey, domainColor, domainLabel } from '../lib/domains'
import { useAtlasStore } from '../lib/atlasStore'
import { copyToClipboard, COPY_LONG_PRESS_DELAY } from '../lib/clipboard'
import { useShell } from './AtlasShell'

export interface InboxItem {
  id: string
  clientId?: string
  time: string
  date?: string
  domain: DomainKey
  domainLabel?: string
  kind?: 'audio' | 'text' | 'photo'
  text: string
  durationMs?: number | null
  transcriptionStatus?: 'pending' | 'processing' | 'done' | 'failed' | 'na'
  transcriptionError?: string | null
  fileUrl?: string | null
  fileHeaders?: Record<string, string> | null
  fileExists?: boolean | null
  fileIntegrity?: string | null
  tags?: string[]
  capturedAt?: string
  createdAt?: string
  updatedAt?: string
  capturedLat?: number | null
  capturedLng?: number | null
  preCaptureContext?: Record<string, unknown> | null
  isLocal?: boolean
  statusLabel?: string
  statusDetail?: string
  statusTone?: 'ok' | 'pending' | 'danger' | 'muted'
  triageStatus?: string
  triageDestination?: string
  triageLabel?: string
  triageUpdatedAt?: string
  triageReason?: string | null
  triageTitle?: string | null
  snoozedUntil?: string | null
  linkedNoteTitle?: string | null
  proposalId?: string | null
  targetType?: string | null
  targetId?: string | null
  targetTitle?: string | null
  triageHistory?: InboxTriageHistoryItem[]
  semanticClarification?: InboxSemanticClarification | null
  sensitivity?: 'normal' | 'private' | 'sensitive' | string | null
  privacyLabel?: string | null
  externalAiAllowed?: boolean | null
  nextStepLabel?: string | null
  isArchived?: boolean
  isSnoozed?: boolean
  isRawCapture?: boolean
  isCurationCandidate?: boolean
  canRetryTranscription?: boolean
}

export interface InboxTriageHistoryItem {
  action?: string | null
  status?: string | null
  destination?: string | null
  at?: string | null
  reason?: string | null
  proposal_id?: string | null
  previous_destination?: string | null
  previous_target_title?: string | null
  changed_destination?: boolean | null
}

export interface InboxSemanticClarification {
  status?: string | null
  eventType?: string | null
  generatedAt?: string | null
  agentSlug?: string | null
  source?: string | null
  mainThesis?: string | null
  atomicIdeas?: string[]
  suggestedType?: string | null
  tensionOrQuestion?: string | null
  density?: {
    score?: number | null
    label?: string | null
    drivers?: string[]
  }
  possibleDestination?: {
    kind?: string | null
    noteType?: string | null
    title?: string | null
    path?: string | null
    reason?: string | null
  }
  authorshipQuestion?: string | null
  futureTriggers?: string[]
}

interface Props {
  item: InboxItem
  onPress?: () => void
  onPromote?: () => void
  onCreateTask?: () => void
  onCreateProject?: () => void
  onSnooze?: () => void
  onArchive?: () => void
  onOpenDestination?: () => void
  actionBusy?: boolean
  selected?: boolean
  selectionMode?: boolean
  isFresh?: boolean
}

// Card with body + inline triage toolbar at the bottom (Promover · Tarefa
// · Projeto · Adiar · Arquivar). Toolbar hides in selection mode and for
// local/archived items. Tap on body opens DetailSheet.
export function InboxCard({
  item,
  onPress,
  onPromote,
  onCreateTask,
  onCreateProject,
  onSnooze,
  onArchive,
  onOpenDestination,
  actionBusy,
  selected,
  selectionMode,
  isFresh,
}: Props) {
  const c = usePalette()
  const domains = useAtlasStore((s) => s.domains)
  const { showToast } = useShell()
  const isFailed =
    item.transcriptionStatus === 'failed' || item.fileIntegrity === 'missing'
  const isPending =
    item.isLocal === true ||
    item.transcriptionStatus === 'pending' ||
    item.transcriptionStatus === 'processing'
  const isSensitive =
    item.sensitivity === 'sensitive' || item.sensitivity === 'private'
  const hasResolvedDestination = isResolvedDestination(item)
  const showActions = !selectionMode && !item.isLocal && !item.isArchived && !hasResolvedDestination
  const destinationTone = resolvedDestinationColor(item, c)
  const promoteReady = canPromote(item)
  // Long-press v9 · ações ficam escondidas por padrão · respiro editorial · só body + meta + hint.
  // Long-press 1 = copia (haptic existente) + revela ações inline.
  // Long-press 2 = colapsa. Tap segue abrindo detail (nada muda).
  // Decisão: cards ficavam barulhentos com 5 verbos sempre visíveis · era dashboard, não leitura.
  const [actionsRevealed, setActionsRevealed] = useState(false)

  const dColor = domainColor(item.domain, c, domains)
  const dTextColor = domainTextColor(item.domain, c, dColor)
  const nextStepAction = item.nextStepLabel ? nextStepActionLabel(item.nextStepLabel) : null
  // Fresh state · técnica v6 · ≤30s pós-save · bg-fresh + edge bronze 1px topo + foil shimmer ✦
  const cardBg = selected ? c.bgDeep : isFresh ? c.bgFresh : c.bg
  const topEdge = selected
    ? { borderTopWidth: 0.5, borderTopColor: c.bronze }
    : isFresh
    ? { borderTopWidth: 1, borderTopColor: c.bronze }
    : isSensitive
    ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(155,122,63,0.22)' }
    : null

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          // v13 · divider bronze 10% em vez de c.border cinza · sai do sabor
          // "list view / database table" pra editorial Aesop product list.
          // Sussurro warm em vez de linha gray ASCII default RN.
          borderColor: 'rgba(155,122,63,0.10)',
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        topEdge,
      ]}
    >
      <Pressable
        onPress={onPress}
        onLongPress={() => {
          if (!actionsRevealed) {
            // Primeira pressão: copia + revela. Mantém comportamento existente +
            // expõe ações sem o usuário precisar abrir o detail.
            void copyToClipboard(item.text, () => showToast('Copiado'))
            setActionsRevealed(true)
          } else {
            // Segunda pressão: colapsa sem copiar de novo. Toggle previsível.
            setActionsRevealed(false)
          }
        }}
        delayLongPress={COPY_LONG_PRESS_DELAY}
        accessibilityHint={
          actionsRevealed
            ? 'pressionar e segurar esconde as ações'
            : 'pressionar e segurar copia o texto e mostra ações'
        }
        style={({ pressed }) => [
          styles.body,
          {
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={styles.metaRow}>
          {/* canon mockup capture-entry .meta · time mono caps lspc 1.4
              prussian med (acentua "ato editorial momento") · kind Frau italic
              13 ink2 inline, separados por · ink3@60% opacity. */}
          <Mono
            size={10}
            lineHeight={13}
            letterSpacing={1.4}
            color={c.prussian}
            weight="med"
            style={styles.uppercase}
          >
            {item.time}
          </Mono>
          {item.kind ? (
            <>
              <Frau size={11} lineHeight={14} color={c.ink3} style={styles.metaSep}>·</Frau>
              <Mono size={10} lineHeight={13} letterSpacing={1.4} color={c.ink2} style={styles.uppercase}>
                {kindLabel(item.kind)}
              </Mono>
            </>
          ) : null}
          <Sans size={11} lineHeight={14} color={c.ink3} style={styles.metaSep}>·</Sans>
          <View style={[styles.domainBullet, { backgroundColor: dTextColor }]} />
          <Sans
            weight="med"
            size={10}
            lineHeight={14}
            letterSpacing={1.3}
            color={dTextColor}
            style={styles.uppercase}
          >
            {item.domainLabel ?? domainLabel(item.domain, domains)}
          </Sans>
          {isFailed ? (
            <Frau italic size={12} lineHeight={15} color={c.recRed} style={styles.metaTrailing}>
              falha
            </Frau>
          ) : isPending ? (
            <Frau italic size={12} lineHeight={15} color={c.ink3} style={styles.metaTrailing}>
              transcrevendo
            </Frau>
          ) : null}
          {hasResolvedDestination && item.triageLabel ? (
            <Frau italic size={12} lineHeight={15} color={destinationTone} style={styles.metaTrailing}>
              {item.triageLabel}
            </Frau>
          ) : null}
        </View>

        {/* v12 · removidos « » Unicode quotes · design mais limpo na lista.
            Frau italic já comunica "captura/citação" tipograficamente. */}
        <Frau
          italic
          size={17}
          lineHeight={26}
          letterSpacing={-0.085}
          color={isFailed ? c.ink2 : c.ink}
          numberOfLines={3}
        >
          {item.text}
        </Frau>

        {/* v13 · nextStep só renderiza quando há SINAL DISTINTO (curation candidate).
            Antes: "Próximo: decidir destino" repetido em TODA card raw = ruído editorial.
            Apple Mail não escreve "ainda não lida" em cada email — usa peso tipográfico.
            Agora: ausência de nextStepRow = "ainda raw, decidir destino implícito".
            Quando isCurationCandidate=true: micro-sinal "próximo · promover".
            Estado tipográfico em vez de label repetida. */}
        {nextStepAction && item.isCurationCandidate ? (
          <View style={styles.nextStepRow}>
            <Frau
              italic
              size={13}
              lineHeight={18}
              color={c.ink2}
            >
              próximo
            </Frau>
            <Frau italic size={13} lineHeight={18} color={c.ink3}>
              ·
            </Frau>
            <Frau
              italic
              weight="med"
              size={13}
              lineHeight={18}
              color={c.bronze}
            >
              {nextStepAction}
            </Frau>
          </View>
        ) : null}
      </Pressable>

      {hasResolvedDestination ? (
        <View style={[styles.destinationRow, { borderTopColor: c.border }]}>
          <View style={styles.destinationHeader}>
            <Sans weight="sb" size={11.5} lineHeight={15} color={destinationTone}>
              {item.triageLabel ?? 'Destino definido'}
            </Sans>
            <View style={styles.destinationActions}>
              {onOpenDestination ? (
                <Pressable
                  onPress={onOpenDestination}
                  hitSlop={8}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <Sans weight="sb" size={11.5} lineHeight={15} color={c.prussian}>
                    Abrir
                  </Sans>
                </Pressable>
              ) : null}
              <Pressable
                onPress={onPress}
                disabled={!onPress}
                hitSlop={8}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <Sans weight="sb" size={11.5} lineHeight={15} color={c.prussian}>
                  Alterar
                </Sans>
              </Pressable>
            </View>
          </View>
          {item.targetTitle ? (
            <Sans size={11.5} lineHeight={15} color={c.ink2} numberOfLines={1} style={styles.destinationTitle}>
              {item.targetTitle}
            </Sans>
          ) : null}
        </View>
      ) : showActions && actionsRevealed ? (
        // v15 · animated reveal · slide down + fade in com easing iOS sheet curve.
        // entering FadeIn 240ms = aparece com presença · exiting FadeOut 160ms =
        // some discreto. Combina com long-press toggle (2ª pressão colapsa).
        <Animated.View
          entering={FadeIn.duration(240)}
          exiting={FadeOut.duration(160)}
          style={[styles.actionRow, { borderTopColor: c.border }]}
        >
          <QuickActionButton
            label="promover"
            onPress={onPromote}
            disabled={actionBusy || !onPromote || !promoteReady}
            divider
          />
          <QuickActionButton
            label="tarefa"
            onPress={onCreateTask}
            disabled={actionBusy || !onCreateTask}
            divider
          />
          <QuickActionButton
            label="projeto"
            onPress={onCreateProject}
            disabled={actionBusy || !onCreateProject}
            divider
          />
          <QuickActionButton
            label="adiar"
            onPress={onSnooze}
            disabled={actionBusy || !onSnooze}
            divider
          />
          <QuickActionButton
            label="arquivar"
            onPress={onArchive}
            disabled={actionBusy || !onArchive}
            danger
          />
        </Animated.View>
      ) : null}
    </View>
  )
}

function QuickActionButton({
  label,
  onPress,
  disabled,
  danger,
  divider,
}: {
  label: string
  onPress?: () => void
  disabled?: boolean
  danger?: boolean
  divider?: boolean
}) {
  const c = usePalette()
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        divider ? { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.border } : null,
        {
          backgroundColor: pressed ? c.bgRaised : 'transparent',
          opacity: disabled ? 0.35 : 1,
        },
      ]}
    >
      <Frau
        italic
        size={13}
        lineHeight={17}
        color={danger ? c.recRedMuted : c.ink2}
        align="center"
        numberOfLines={1}
      >
        {label}
      </Frau>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  body: {
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  metaSep: { opacity: 0.45 },
  metaTrailing: { marginLeft: 'auto' },
  uppercase: { textTransform: 'uppercase' },
  domainBullet: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginLeft: 3,
    marginRight: 3,
    opacity: 0.78,
  },
  nextStepRow: {
    marginTop: 13,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  destinationRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 42,
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 4,
  },
  destinationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  destinationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  destinationTitle: { minWidth: 0 },
  actionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 4,
  },
  quickAction: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
})

export { domainColor, domainLabel }
export type { DomainKey }

function isResolvedDestination(item: InboxItem): boolean {
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

function resolvedDestinationColor(item: InboxItem, palette: ReturnType<typeof usePalette>): string {
  switch (item.triageDestination ?? item.targetType) {
    case 'task':
    case 'project':
      return palette.prussian
    case 'semantic_note':
    case 'existing_note':
    case 'semantic_curation_proposal':
    case 'hypothesis':
      return palette.bronze
    default:
      return palette.ink2
  }
}

function canPromote(item: InboxItem): boolean {
  if (item.transcriptionStatus === 'failed' || item.fileIntegrity === 'missing') return false
  if (item.transcriptionStatus === 'pending' || item.transcriptionStatus === 'processing') return false
  return item.text.trim().length > 0
}

function kindLabel(kind: NonNullable<InboxItem['kind']>): string {
  switch (kind) {
    case 'audio':
      return 'áudio'
    case 'photo':
      return 'imagem'
    case 'text':
      return 'texto'
  }
}

function nextStepActionLabel(label: string): string {
  return label
    .replace(/^pr[oó]ximo\s*[:·-]\s*/i, '')
    .trim()
    .toLocaleLowerCase('pt-BR')
}

function domainTextColor(
  domain: DomainKey,
  palette: ReturnType<typeof usePalette>,
  fallback: string,
): string {
  return domain === 'atlas' ? palette.bronze : fallback
}
