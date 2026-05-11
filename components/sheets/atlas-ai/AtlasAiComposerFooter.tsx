import { View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { FieldInline } from '../../console/FieldInline'
import { Frau } from '../../../design/Type'
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
      />
      <FileAttachmentPreviewStrip
        attachments={draftFileAttachments}
        onRemove={onRemoveFileAttachment}
      />
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
