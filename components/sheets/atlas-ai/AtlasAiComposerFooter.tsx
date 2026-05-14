import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { FieldInline } from '../../console/FieldInline'
import { Frau, Mono, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import type { RoutingExecutor } from '../../console/StatusRouting'
import type {
  ComposerFileAttachment,
  ComposerImageAttachment,
} from './attachmentTypes'
import {
  AttachmentPreviewStrip,
  FileAttachmentPreviewStrip,
} from './AtlasAiAttachments'
import {
  DecideStatusLine,
} from './AtlasAiDecideStatus'
import type { DecideDestino } from './AtlasAiDecideModel'
import { MAX_DRAFT_FILES } from './AtlasAiAttachmentModel'
import { LONG_MESSAGE_ARTIFACT_CHARS } from './AtlasAiLongMessageModel'
import { styles } from './AtlasAiSheet.styles'

export function AtlasAiComposerFooter({
  footerPaddingBottom,
  copyToast,
  draft,
  onChangeDraft,
  onSubmit,
  interactionLocked,
  executor,
  destinoOverride,
  onOpenRouting,
  onSetDestinoOverride,
  draftAttachments,
  draftFileAttachments,
  onOpenAttachment,
  onRemoveAttachment,
  onRemoveFileAttachment,
  onOpenAttachmentSheet,
  onOpenVoiceMode,
  onStartRecording,
  recording,
  turnCount,
  decideEnabled,
}: {
  footerPaddingBottom: number
  copyToast: string | null
  decideEnabled: boolean
  draft: string
  onChangeDraft: (text: string) => void
  onSubmit: () => void
  interactionLocked: boolean
  executor: RoutingExecutor
  destinoOverride: DecideDestino | null
  onOpenRouting: () => void
  onSetDestinoOverride: (next: DecideDestino) => void
  draftAttachments: ComposerImageAttachment[]
  draftFileAttachments: ComposerFileAttachment[]
  onOpenAttachment: (attachment: ComposerImageAttachment) => void
  onRemoveAttachment: (id: string) => void
  onRemoveFileAttachment: (id: string) => void
  onOpenAttachmentSheet: () => void
  onOpenVoiceMode: () => void
  onStartRecording: () => void
  recording: boolean
  turnCount: number
}) {
  const { c } = useTheme()
  const attachmentCount = draftAttachments.length + draftFileAttachments.length
  const trimmedDraftLength = draft.trim().length
  const longMessagePending = trimmedDraftLength > LONG_MESSAGE_ARTIFACT_CHARS
  const longMessageBlocked = longMessagePending && draftFileAttachments.length >= MAX_DRAFT_FILES
  const youtubeLinkCount = countYoutubeLinks(draft)

  return (
    <View
      style={[
        styles.footer,
        {
          backgroundColor: c.bg,
          paddingBottom: footerPaddingBottom,
        },
      ]}
    >
      {copyToast && (
        <Animated.View
          key={copyToast}
          pointerEvents="none"
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(260)}
          style={styles.copyToast}
        >
          <Frau italic size={14} lineHeight={20} color={c.ink} style={{ opacity: 0.7 }}>
            — copiado {copyToast}
          </Frau>
        </Animated.View>
      )}
      <DecideStatusLine
        text={draft}
        executor={executor}
        destinoOverride={destinoOverride}
        onOpenConfig={onOpenRouting}
        onToggleDestino={onSetDestinoOverride}
        decideEnabled={decideEnabled}
        locked={interactionLocked}
      />
      <AttachmentPreviewStrip
        attachments={draftAttachments}
        onOpen={onOpenAttachment}
        onRemove={onRemoveAttachment}
        size="composer"
      />
      <FileAttachmentPreviewStrip
        attachments={draftFileAttachments}
        onRemove={onRemoveFileAttachment}
      />
      {longMessagePending ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(140)}
          style={[
            localStyles.longMessageHint,
            {
              borderColor: longMessageBlocked ? c.recRedMuted : c.border,
              backgroundColor: c.bgRaised,
            },
          ]}
        >
          <View style={[localStyles.longMessageDot, { backgroundColor: longMessageBlocked ? c.recRedMuted : c.bronze }]} />
          <Sans size={12} lineHeight={16} color={longMessageBlocked ? c.recRedMuted : c.ink2} style={localStyles.longMessageText}>
            {longMessageBlocked ? 'mensagem longa · libere 1 arquivo para anexar' : 'mensagem longa · será anexada em .md'}
          </Sans>
          <Mono size={10} lineHeight={14} letterSpacing={0} color={c.ink3}>
            {compactCharCount(trimmedDraftLength)}
          </Mono>
        </Animated.View>
      ) : null}
      {youtubeLinkCount > 0 ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(140)}
          style={[
            localStyles.longMessageHint,
            {
              borderColor: c.border,
              backgroundColor: c.bgRaised,
            },
          ]}
        >
          <View style={[localStyles.longMessageDot, { backgroundColor: c.bronze }]} />
          <Sans size={12} lineHeight={16} color={c.ink2} style={localStyles.longMessageText}>
            YouTube detectado · transcreve em background
          </Sans>
          <Mono size={10} lineHeight={14} letterSpacing={0} color={c.ink3}>
            {youtubeLinkCount}
          </Mono>
        </Animated.View>
      ) : null}
      <FieldInline
        value={draft}
        onChangeText={onChangeDraft}
        onSubmit={onSubmit}
        disabled={interactionLocked}
        placeholder={turnCount === 0 ? 'diga ao Atlas…' : 'continuar com Atlas…'}
        onAttachmentPress={onOpenAttachmentSheet}
        attachmentCount={attachmentCount}
        canSubmit={attachmentCount > 0}
        onLongPressSend={() => {
          if (draft.trim().length === 0 && attachmentCount === 0) {
            onOpenVoiceMode()
            return
          }
          onStartRecording()
        }}
        recording={recording}
      />
    </View>
  )
}

function countYoutubeLinks(text: string): number {
  const matches = text.match(/https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s<>"']*v=|shorts\/|live\/)|youtu\.be\/)[^\s<>"']+/gi)
  if (!matches) return 0
  return new Set(matches.map((url) => url.replace(/[.,;:)\]}]+$/g, ''))).size
}

function compactCharCount(chars: number): string {
  if (chars >= 1000000) return `${(chars / 1000000).toFixed(1)}M`
  if (chars >= 1000) return `${(chars / 1000).toFixed(chars >= 100000 ? 0 : 1)}k`
  return String(chars)
}

const localStyles = StyleSheet.create({
  longMessageHint: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 11,
    paddingVertical: 6,
    marginTop: 6,
    marginBottom: 8,
    maxWidth: '100%',
  },
  longMessageDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  longMessageText: {
    flexShrink: 1,
  },
})
