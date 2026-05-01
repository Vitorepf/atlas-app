import { Pressable, StyleSheet, View } from 'react-native'
import { Mono, Sans } from '../design/Type'
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

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: selected ? c.prussian : c.border,
          borderWidth: selected ? 1.5 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        onLongPress={() => void copyToClipboard(item.text, () => showToast('Copiado'))}
        delayLongPress={COPY_LONG_PRESS_DELAY}
        accessibilityHint="pressionar e segurar copia o texto"
        style={({ pressed }) => [
          styles.body,
          {
            opacity: pressed ? 0.7 : 1,
            transform: [{ translateX: pressed && !selectionMode ? 2 : 0 }],
          },
        ]}
      >
        <View style={styles.metaRow}>
          <Mono size={12} lineHeight={16} letterSpacing={0.24} color={c.ink2}>
            {item.time}
          </Mono>
          {item.kind ? (
            <Sans
              weight="sb"
              size={10.5}
              lineHeight={14}
              letterSpacing={1.05}
              color={c.ink3}
              style={styles.uppercase}
            >
              {kindLabel(item.kind)}
            </Sans>
          ) : null}
          <Sans
            weight="sb"
            size={10.5}
            lineHeight={14}
            letterSpacing={1.05}
            color={domainColor(item.domain, c, domains)}
            style={styles.uppercase}
          >
            {item.domainLabel ?? domainLabel(item.domain, domains)}
          </Sans>
          {isFailed ? (
            <Sans
              weight="sb"
              size={10.5}
              lineHeight={14}
              letterSpacing={1.05}
              color={c.recRed}
              style={styles.uppercase}
            >
              falha
            </Sans>
          ) : isPending ? (
            <Sans
              weight="sb"
              size={10.5}
              lineHeight={14}
              letterSpacing={1.05}
              color={c.ink3}
              style={styles.uppercase}
            >
              transcrevendo
            </Sans>
          ) : null}
          {hasResolvedDestination && item.triageLabel ? (
            <Sans
              weight="sb"
              size={10.5}
              lineHeight={14}
              letterSpacing={1.05}
              color={destinationTone}
              style={styles.uppercase}
            >
              {item.triageLabel}
            </Sans>
          ) : null}
          {isSensitive && item.privacyLabel ? (
            <Mono
              size={10.5}
              lineHeight={14}
              letterSpacing={0.42}
              color={c.ink3}
              style={styles.privacyAlignRight}
            >
              {item.privacyLabel}
            </Mono>
          ) : null}
        </View>

        <Sans
          size={15}
          lineHeight={22}
          color={isFailed ? c.ink2 : c.ink}
          numberOfLines={3}
        >
          {item.text}
        </Sans>

        {item.nextStepLabel ? (
          <Sans
            size={11.5}
            lineHeight={15}
            color={item.isCurationCandidate ? c.prussian : c.ink2}
            style={styles.nextStep}
          >
            {item.nextStepLabel}
          </Sans>
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
      ) : showActions ? (
        <View style={[styles.actionRow, { borderTopColor: c.border }]}>
          <QuickActionButton
            label="Promover"
            onPress={onPromote}
            disabled={actionBusy || !onPromote || !promoteReady}
          />
          <QuickActionButton
            label="Tarefa"
            onPress={onCreateTask}
            disabled={actionBusy || !onCreateTask}
          />
          <QuickActionButton
            label="Projeto"
            onPress={onCreateProject}
            disabled={actionBusy || !onCreateProject}
          />
          <QuickActionButton
            label="Adiar"
            onPress={onSnooze}
            disabled={actionBusy || !onSnooze}
          />
          <QuickActionButton
            label="Arquivar"
            onPress={onArchive}
            disabled={actionBusy || !onArchive}
            danger
          />
        </View>
      ) : null}
    </View>
  )
}

function QuickActionButton({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string
  onPress?: () => void
  disabled?: boolean
  danger?: boolean
}) {
  const c = usePalette()
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        {
          backgroundColor: pressed ? c.premium : 'transparent',
          opacity: disabled ? 0.35 : 1,
        },
      ]}
    >
      <Sans
        weight="sb"
        size={11.5}
        lineHeight={15}
        color={danger ? c.recRed : c.prussian}
        align="center"
      >
        {label}
      </Sans>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  body: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  uppercase: { textTransform: 'uppercase' },
  privacyAlignRight: { marginLeft: 'auto' },
  nextStep: { marginTop: 8 },
  destinationRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 42,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  },
  quickAction: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
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
