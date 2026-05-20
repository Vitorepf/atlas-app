import { StyleSheet, View } from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated'
import { Frau, Mono } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import { labelForMode } from './ComposerPillsRowModel'
import type { RoutingExecutor } from '../../console/StatusRouting'
import type {
  ComposerFileAttachment,
  ComposerImageAttachment,
} from './attachmentTypes'
import { DividerEditorial } from '../../console/DividerEditorial'
import {
  AttachmentPreviewStrip,
  FileAttachmentPreviewStrip,
} from './AtlasAiAttachments'
import { AtlasComposerCard } from './AtlasComposerCard'
import { ComposerOfflineStatusRow } from './ComposerOfflineStatusRow'
import {
  DecideStatusLine,
} from './AtlasAiDecideStatus'
import type { DecideDestino } from './AtlasAiDecideModel'
import { MAX_DRAFT_FILES } from './AtlasAiAttachmentModel'
import { classifyDecideDestino } from './AtlasAiDecideModel'
import { LONG_MESSAGE_ARTIFACT_CHARS } from './AtlasAiLongMessageModel'
import { styles } from './AtlasAiSheet.styles'
import { classifyUrl, extractUrls } from '../../../lib/richInput/urlDetector'
import { useYoutubePrewarm } from '../../../lib/atlasAi/useYoutubePrewarm'

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
  mode,
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
  /** V2 canon · routing mode atual (auto/general/operational/programming/etc) */
  mode: string
}) {
  const { c } = useTheme()
  const attachmentCount = draftAttachments.length + draftFileAttachments.length
  const trimmedDraftLength = draft.trim().length
  const longMessagePending = trimmedDraftLength > LONG_MESSAGE_ARTIFACT_CHARS
  const longMessageBlocked = longMessagePending && draftFileAttachments.length >= MAX_DRAFT_FILES
  const youtubeLinkCount = countYoutubeLinks(draft)
  // YouTube paste-time prewarm: a partir do momento que o link aparece no
  // draft, o backend já dispara `ProcessYouTubeIngestionJob`. Quando o
  // operador clicar enviar, a transcrição já está em cache. Silent: falha
  // não atrapalha composer. Doutrina: docs/rich-input/youtube-canon.md.
  const { byVideoId: prewarmedYoutube } = useYoutubePrewarm(draft, {
    disabled: interactionLocked,
  })
  const prewarmReadyCount = Object.values(prewarmedYoutube).filter(
    (entry) => entry.ingestionStatus === 'ready',
  ).length
  // Slice 6g · DividerEditorial só renderiza junto com DecideStatusLine
  // (que renderiza só quando há destino classificado). Sem isso, divider
  // ficava órfão entre pills e field-inline quando draft vazio.
  const decideDestino = decideEnabled ? destinoOverride ?? classifyDecideDestino(draft) : null
  const shouldShowDecideSection = decideDestino !== null

  return (
    // Slice 6y REMOVIDA · LayoutAnimationConfig + LinearTransition spring
    // causava SHAKE/REBOTE visível quando children appears/disappears
    // (focus do input → keyboard abre → altura muda → spring overshoot;
    // mesma coisa quando DecideStatusLine aparece ao digitar primeira letra
    // ou some ao apagar tudo). Children já têm FadeIn/FadeOut próprios,
    // wrapper Animated.View com layout spring era ruído extra.
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
      {/* CANON PROMISE · status row + ✦ divider ACIMA do card quando offline */}
      <ComposerOfflineStatusRow />

      {/* Decide line · destino classificado fica ACIMA do card como meta sutil */}
      {shouldShowDecideSection ? (
        <DecideStatusLine
          text={draft}
          executor={executor}
          destinoOverride={destinoOverride}
          onOpenConfig={onOpenRouting}
          onToggleDestino={onSetDestinoOverride}
          decideEnabled={decideEnabled}
          locked={interactionLocked}
        />
      ) : null}

      {/* Attachment preview strips · ACIMA do card (escolha editorial:
          anexos são contexto que entra na conversa, ficam visíveis antes
          do composer · o card é a entrada do usuário, não o repositório). */}
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
          entering={FadeIn.duration(200).delay(40)}
          exiting={FadeOut.duration(180)}
          style={[
            localStyles.longMessageHint,
            {
              borderColor: longMessageBlocked ? c.recRedMuted : c.border,
              backgroundColor: c.bgRaised,
            },
          ]}
        >
          <View style={[localStyles.longMessageDot, { backgroundColor: longMessageBlocked ? c.recRedMuted : c.bronze }]} />
          {/* Slice 6v · Frau italic ao invés de Sans · canon manuscript */}
          <Frau italic size={12.5} lineHeight={16} color={longMessageBlocked ? c.recRedMuted : c.ink2} style={localStyles.longMessageText}>
            {longMessageBlocked ? 'mensagem longa · libere 1 arquivo para anexar' : 'mensagem longa · será anexada em .md'}
          </Frau>
          <Mono size={10} lineHeight={14} letterSpacing={0.3} color={c.ink3}>
            {compactCharCount(trimmedDraftLength)}
          </Mono>
        </Animated.View>
      ) : null}
      {youtubeLinkCount > 0 ? (
        <Animated.View
          entering={FadeIn.duration(200).delay(40)}
          exiting={FadeOut.duration(180)}
          style={[
            localStyles.longMessageHint,
            {
              borderColor: c.border,
              backgroundColor: c.bgRaised,
            },
          ]}
        >
          <View style={[localStyles.longMessageDot, { backgroundColor: c.bronze }]} />
          <Frau italic size={12.5} lineHeight={16} color={c.ink2} style={localStyles.longMessageText}>
            {prewarmReadyCount > 0 && prewarmReadyCount === youtubeLinkCount
              ? 'YouTube · transcrição pronta · responderei em PT-BR'
              : 'YouTube detectado · transcrição em background · resposta em PT-BR'}
          </Frau>
          <Mono size={10} lineHeight={14} letterSpacing={0.3} color={c.ink3}>
            {youtubeLinkCount}
          </Mono>
        </Animated.View>
      ) : null}

      {/* THE CARD · canon promise · placeholder hero + action row interno */}
      <AtlasComposerCard
        modeLabel={labelForMode(mode)}
        value={draft}
        onChangeText={onChangeDraft}
        onSubmit={onSubmit}
        onOpenRouting={onOpenRouting}
        onOpenAttachmentSheet={onOpenAttachmentSheet}
        disabled={interactionLocked}
        recording={recording}
        attachmentCount={attachmentCount}
        canSubmitWithoutText={attachmentCount > 0}
        placeholder={turnCount === 0 ? 'Escreva ao Atlas' : 'Continuar com Atlas'}
        onMicTap={() => {
          // Mic canon · captura de áudio normal.
          onStartRecording()
        }}
        onLongPressMic={() => {
          // Long-press mantém captura; Voice Realtime vive no botão separado.
          onStartRecording()
        }}
        onVoiceTap={() => {
          onOpenVoiceMode()
        }}
      />
    </View>
  )
}

function countYoutubeLinks(text: string): number {
  // Canon: usa extractUrls + classifyUrl do `lib/richInput/urlDetector`
  // (compartilhado com desktop) em vez de regex local. Dedup automático,
  // suporte a embed/live/shorts/youtu.be vem do canon. Outras famílias
  // (Vimeo/GitHub) hoje são ignoradas aqui · futuras UI hints podem
  // consumir o mesmo extractUrls e filtrar por kind diferente.
  return extractUrls(text)
    .map((url) => classifyUrl(url))
    .filter((detected) => detected.kind === 'youtube').length
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
    gap: 9, // Slice 6v · gap aumentado pra Frau italic respirar
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingLeft: 11,
    paddingRight: 12,
    paddingVertical: 7, // Slice 6v · padding+1 pra Frau italic não cropped
    marginTop: 6,
    marginBottom: 8,
    maxWidth: '100%',
    // Slice 6v · subtle shadow lift premium consistency com chips/cards
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 3,
    elevation: 1,
  },
  longMessageDot: {
    width: 5.5, // Slice 6v · alinhado com pill dot canon
    height: 5.5,
    borderRadius: 3,
  },
  longMessageText: {
    flexShrink: 1,
  },
})
