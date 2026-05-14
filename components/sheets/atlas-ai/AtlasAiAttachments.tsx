import { useEffect, useState } from 'react'
import * as Clipboard from 'expo-clipboard'
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Frau, Mono, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import {
  getAtlasAuthHeaders,
  getApiBase,
  type AtlasAiAttachment,
} from '../../../lib/api/client'
import { BottomSheet } from '../BottomSheet'
import {
  type AttachmentUploadPhase,
  type ComposerFileAttachment,
  type ComposerImageAttachment,
  fileExtensionLabel,
  formatBytes,
} from './attachmentTypes'

export function AttachmentPreviewStrip({
  attachments,
  onOpen,
  onRemove,
  readonly = false,
  size = 'compact',
}: {
  attachments: ComposerImageAttachment[]
  onOpen?: (attachment: ComposerImageAttachment) => void
  onRemove?: (id: string) => void
  readonly?: boolean
  size?: 'compact' | 'composer'
}) {
  const { c } = useTheme()
  if (attachments.length === 0) return null
  const composer = size === 'composer'

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={composer ? styles.composerAttachmentStrip : styles.attachmentStrip}
      keyboardShouldPersistTaps="handled"
    >
      {attachments.map((attachment) => (
        <Pressable
          key={attachment.id}
          onPress={() => onOpen?.(attachment)}
          disabled={!onOpen}
          accessibilityRole="imagebutton"
          accessibilityLabel="abrir imagem anexada"
          style={({ pressed }) => [
            composer ? styles.composerAttachmentThumb : styles.attachmentThumb,
            {
              borderColor: c.border,
              backgroundColor: c.surface,
              opacity: pressed ? 0.72 : readonly ? 0.86 : 1,
            },
          ]}
        >
          <Image
            source={{ uri: attachment.uri }}
            resizeMode="cover"
            style={composer ? styles.composerAttachmentImage : styles.attachmentImage}
          />
          {!readonly && onRemove ? (
            <Pressable
              onPress={() => onRemove(attachment.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="remover anexo"
              style={({ pressed }) => [
                composer ? styles.composerAttachmentRemove : styles.attachmentRemove,
                {
                  backgroundColor: composer ? c.ink : c.bg,
                  borderColor: composer ? c.ink : c.border,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Sans
                size={composer ? 17 : 13}
                lineHeight={composer ? 19 : 14}
                weight="med"
                color={composer ? c.bg : c.ink}
              >
                ×
              </Sans>
            </Pressable>
          ) : null}
        </Pressable>
      ))}
    </ScrollView>
  )
}

export function FileAttachmentPreviewStrip({
  attachments,
  onRemove,
  readonly = false,
}: {
  attachments: ComposerFileAttachment[]
  onRemove?: (id: string) => void
  readonly?: boolean
}) {
  const { c } = useTheme()
  if (attachments.length === 0) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.fileAttachmentStrip}
      keyboardShouldPersistTaps="handled"
    >
      {attachments.map((attachment) => (
        <View
          key={attachment.id}
          style={[
            styles.fileAttachmentChip,
            {
              borderColor: c.border,
              backgroundColor: c.surface,
              opacity: readonly ? 0.9 : 1,
            },
          ]}
        >
          <View style={[styles.fileAttachmentIcon, { borderColor: c.border }]}>
            <Sans size={11} lineHeight={13} weight="med" color={c.ink2}>
              {fileExtensionLabel(attachment.fileName)}
            </Sans>
          </View>
          <View style={styles.fileAttachmentText}>
            <Sans size={13} lineHeight={17} weight="med" color={c.ink} numberOfLines={1}>
              {attachment.fileName}
            </Sans>
            <Mono size={10} letterSpacing={0} color={c.ink2} numberOfLines={1}>
              {formatBytes(attachment.size ?? null)}
            </Mono>
          </View>
          {!readonly && onRemove ? (
            <Pressable
              onPress={() => onRemove(attachment.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="remover arquivo"
              style={({ pressed }) => [
                styles.fileAttachmentRemove,
                {
                  borderColor: c.border,
                  opacity: pressed ? 0.55 : 1,
                },
              ]}
            >
              <Sans size={12} lineHeight={14} color={c.ink}>×</Sans>
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollView>
  )
}

export function TurnAttachmentSummary({
  images,
  files,
  phase,
  progress,
  onOpenImage,
}: {
  images: ComposerImageAttachment[]
  files: ComposerFileAttachment[]
  phase?: AttachmentUploadPhase
  progress?: number
  onOpenImage?: (attachment: ComposerImageAttachment) => void
}) {
  const { c } = useTheme()
  if (images.length + files.length === 0) return null

  return (
    <View style={styles.turnAttachmentSummary}>
      {phase ? (
        <View style={styles.attachmentStatusLine}>
          <View
            style={[
              styles.attachmentStatusDot,
              { backgroundColor: phase === 'failed' ? c.recRed : c.bronze },
            ]}
          />
          <Mono size={10} letterSpacing={0} color={phase === 'failed' ? c.recRed : c.ink2}>
            {attachmentPhaseLabel(phase, images.length + files.length, progress)}
          </Mono>
        </View>
      ) : null}
      {typeof progress === 'number' && phase === 'uploading' ? (
        <View style={[styles.attachmentProgressTrack, { backgroundColor: c.border }]}>
          <View
            style={[
              styles.attachmentProgressFill,
              {
                backgroundColor: c.bronze,
                width: `${Math.max(0.04, Math.min(1, progress)) * 100}%`,
              },
            ]}
          />
        </View>
      ) : null}
      <AttachmentPreviewStrip
        attachments={images}
        onOpen={onOpenImage}
        readonly
      />
      <FileAttachmentPreviewStrip
        attachments={files}
        readonly
      />
    </View>
  )
}

export function HistoricalAttachmentSummary({
  attachments,
  onOpenAttachment,
}: {
  attachments: AtlasAiAttachment[]
  onOpenAttachment?: (attachment: AtlasAiAttachment) => void
}) {
  const { c } = useTheme()
  if (attachments.length === 0) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.fileAttachmentStrip}
      keyboardShouldPersistTaps="handled"
      style={styles.turnAttachmentSummary}
    >
      {attachments.map((attachment) => (
        <Pressable
          key={attachment.id}
          onPress={() => {
            if (canOpenHistoricalAttachment(attachment)) {
              onOpenAttachment?.(attachment)
            }
          }}
          disabled={!canOpenHistoricalAttachment(attachment)}
          accessibilityRole="button"
          accessibilityLabel={`abrir preview de ${attachment.name}`}
          style={({ pressed }) => [
            styles.fileAttachmentChip,
            {
              borderColor: c.border,
              backgroundColor: c.surface,
              opacity: pressed ? 0.72 : 0.92,
            },
          ]}
        >
          <View style={[styles.fileAttachmentIcon, { borderColor: c.border }]}>
            <Sans size={11} lineHeight={13} weight="med" color={c.ink2}>
              {historicalAttachmentBadge(attachment)}
            </Sans>
          </View>
          <View style={styles.fileAttachmentText}>
            <Sans size={13} lineHeight={17} weight="med" color={c.ink} numberOfLines={1}>
              {attachment.name || (attachment.kind === 'image' ? 'imagem' : 'arquivo')}
            </Sans>
            <Mono size={10} letterSpacing={0} color={c.ink2} numberOfLines={1}>
              {historicalAttachmentMeta(attachment)}
            </Mono>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  )
}

export function PdfAttachmentViewer({
  attachment,
  onClose,
}: {
  attachment: AtlasAiAttachment | null
  onClose: () => void
}) {
  const { c } = useTheme()
  const pages = attachment?.preview_pages ?? []

  return (
    <Modal
      visible={attachment != null}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.pdfPreviewSafe, { backgroundColor: c.bg }]}>
        <View style={[styles.pdfPreviewHeader, { borderBottomColor: c.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar preview do PDF"
            hitSlop={12}
            onPress={onClose}
            style={({ pressed }) => [
              styles.pdfPreviewClose,
              { borderColor: c.border, backgroundColor: pressed ? c.premium : c.surface },
            ]}
          >
            <Sans size={24} lineHeight={28} color={c.ink}>×</Sans>
          </Pressable>
          <View style={styles.pdfPreviewTitle}>
            <Sans size={14} lineHeight={18} weight="med" color={c.ink} numberOfLines={1}>
              {attachment?.name ?? 'PDF'}
            </Sans>
            <Mono size={10} lineHeight={14} letterSpacing={0} color={c.ink2} numberOfLines={1}>
              {attachment ? historicalAttachmentMeta(attachment) : ''}
            </Mono>
          </View>
          <View style={styles.pdfPreviewHeaderSide} />
        </View>

        {pages.length > 0 ? (
          <FlatList
            data={pages}
            keyExtractor={(page) => String(page.page)}
            contentContainerStyle={styles.pdfPreviewList}
            renderItem={({ item }) => (
              <View style={[styles.pdfPageFrame, { borderColor: c.border, backgroundColor: c.surface }]}>
                <Mono size={10} lineHeight={14} letterSpacing={0} color={c.ink2}>
                  página {item.page}
                </Mono>
                <Image
                  source={{ uri: apiMediaUrl(item.url), headers: getAtlasAuthHeaders() }}
                  resizeMode="contain"
                  style={styles.pdfPageImage}
                  accessibilityIgnoresInvertColors
                />
              </View>
            )}
          />
        ) : (
          <View style={styles.pdfPreviewEmpty}>
            <Frau italic size={16} lineHeight={23} align="center" color={c.ink2}>
              preview visual indisponível para este arquivo
            </Frau>
          </View>
        )}
      </View>
    </Modal>
  )
}

export function AttachmentSheet({
  visible,
  busy,
  onClose,
  onPasteImage,
  onCamera,
  onPhotos,
  onFiles,
}: {
  visible: boolean
  busy: string | null
  onClose: () => void
  onPasteImage: () => void
  onCamera: () => void
  onPhotos: () => void
  onFiles: () => void
}) {
  const { c } = useTheme()
  const [clipboardState, setClipboardState] = useState<'checking' | 'ready' | 'empty' | 'unknown'>('unknown')

  useEffect(() => {
    if (!visible) return
    let alive = true
    setClipboardState('checking')
    Clipboard.hasImageAsync()
      .then((hasImage) => {
        if (alive) setClipboardState(hasImage ? 'ready' : 'empty')
      })
      .catch(() => {
        if (alive) setClipboardState('unknown')
      })

    return () => {
      alive = false
    }
  }, [visible])

  const pasteDisabled = busy !== null || clipboardState === 'checking' || clipboardState === 'empty'
  const pasteDetail = {
    checking: 'verificando clipboard',
    ready: 'imagem copiada pronta · qualidade original',
    empty: 'copie uma imagem primeiro',
    unknown: 'print ou imagem copiada',
  }[clipboardState]

  return (
    <BottomSheet visible={visible} onClose={onClose} height={460}>
      <View style={styles.attachmentSheetContent}>
        <Frau italic size={20} lineHeight={28} color={c.ink}>
          anexar
        </Frau>
        <Mono size={9.5} lineHeight={14} letterSpacing={1.4} color={c.ink3} style={styles.attachmentSheetMeta}>
          VISUAL INPUT · ALTA FIDELIDADE
        </Mono>
        <View style={styles.attachmentActions}>
          <AttachmentAction
            label={busy === 'clipboard' ? 'colando…' : 'colar imagem'}
            detail={pasteDetail}
            disabled={pasteDisabled}
            accent={clipboardState === 'ready'}
            onPress={onPasteImage}
          />
          <AttachmentAction
            label={busy === 'camera' ? 'abrindo…' : 'câmera'}
            detail="capturar agora"
            disabled={busy !== null}
            onPress={onCamera}
          />
          <AttachmentAction
            label={busy === 'photos' ? 'abrindo…' : 'fotos'}
            detail="escolher até 8 imagens"
            disabled={busy !== null}
            onPress={onPhotos}
          />
          <AttachmentAction
            label={busy === 'files' ? 'abrindo…' : 'arquivos'}
            detail="PDF, documento ou imagem"
            disabled={busy !== null}
            onPress={onFiles}
          />
        </View>
      </View>
    </BottomSheet>
  )
}

function AttachmentAction({
  label,
  detail,
  disabled,
  accent,
  onPress,
}: {
  label: string
  detail?: string
  disabled: boolean
  accent?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.attachmentAction,
        {
          borderTopColor: c.border,
          opacity: disabled ? 0.45 : pressed ? 0.55 : 1,
        },
      ]}
    >
      <View style={styles.attachmentActionText}>
        <Sans size={17} lineHeight={24} color={accent ? c.bronze : c.ink}>
          {label}
        </Sans>
        {detail ? (
          <Mono size={9.5} lineHeight={13} letterSpacing={0.4} color={disabled ? c.ink3 : c.ink2}>
            {detail}
          </Mono>
        ) : null}
      </View>
      {accent ? (
        <View style={[styles.attachmentActionDot, { backgroundColor: c.bronze }]} />
      ) : null}
    </Pressable>
  )
}

function attachmentPhaseLabel(phase: AttachmentUploadPhase, count: number, progress?: number): string {
  const noun = count === 1 ? 'anexo' : 'anexos'
  const percent = typeof progress === 'number' ? ` ${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` : ''
  return {
    preparing: `preparando ${noun}`,
    uploading: `enviando ${noun}${percent}...`,
    accepted: count === 1 ? 'anexo recebido' : 'anexos recebidos',
    failed: count === 1 ? 'falha no envio do anexo' : 'falha no envio dos anexos',
  }[phase]
}

function canOpenHistoricalAttachment(attachment: AtlasAiAttachment): boolean {
  if (attachment.kind === 'image' && typeof attachment.content_url === 'string' && attachment.content_url.trim() !== '') {
    return true
  }
  return Array.isArray(attachment.preview_pages) && attachment.preview_pages.length > 0
}

function apiMediaUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${getApiBase()}${url.startsWith('/') ? url : `/${url}`}`
}

function historicalAttachmentBadge(attachment: AtlasAiAttachment): string {
  if (attachment.kind === 'image') return 'IMG'
  return fileExtensionLabel(attachment.name)
}

function historicalAttachmentMeta(attachment: AtlasAiAttachment): string {
  const parts = [formatBytes(attachment.bytes ?? null)]
  if (attachment.kind === 'file') {
    if (typeof attachment.pdf_page_count === 'number' && attachment.pdf_page_count > 0) {
      parts.push(attachment.pdf_page_count === 1 ? '1 pág.' : `${attachment.pdf_page_count} págs.`)
    }
    if (typeof attachment.pdf_chunk_count === 'number' && attachment.pdf_chunk_count > 0) {
      parts.push(attachment.pdf_chunk_count === 1 ? '1 trecho' : `${attachment.pdf_chunk_count} trechos`)
    }
    parts.push(attachment.text_available ? 'texto lido' : 'sem texto extraído')
    if (attachment.pdf_render_status === 'rendered' || attachment.pdf_render_status === 'partial') {
      parts.push('visual pronto')
    }
    if (attachment.pdf_ocr_status === 'processed') {
      parts.push('OCR')
    }
    if (typeof attachment.office_rendered_page_count === 'number' && attachment.office_rendered_page_count > 0) {
      parts.push(attachment.office_rendered_page_count === 1 ? '1 visual' : `${attachment.office_rendered_page_count} visuais`)
    }
    if (attachment.office_render_status === 'rendered' || attachment.office_render_status === 'partial') {
      parts.push('Office visual')
    }
  }

  return parts.join(' · ')
}

const styles = StyleSheet.create({
  turnAttachmentSummary: {
    marginTop: 12,
  },
  attachmentStatusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingBottom: 2,
  },
  attachmentStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  attachmentProgressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 5,
    marginBottom: 2,
  },
  attachmentProgressFill: {
    height: 3,
    borderRadius: 2,
  },
  attachmentStrip: {
    paddingTop: 10,
    paddingBottom: 8,
    gap: 10,
  },
  composerAttachmentStrip: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingRight: 12,
    gap: 12,
  },
  attachmentThumb: {
    width: 54,
    height: 54,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'visible',
  },
  attachmentImage: {
    width: 52,
    height: 52,
    borderRadius: 7,
  },
  composerAttachmentThumb: {
    width: 136,
    height: 96,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'visible',
  },
  composerAttachmentImage: {
    width: 134,
    height: 94,
    borderRadius: 11,
  },
  attachmentRemove: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    right: -8,
    top: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerAttachmentRemove: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    right: -7,
    top: -7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileAttachmentStrip: {
    paddingTop: 4,
    paddingBottom: 8,
    gap: 10,
  },
  fileAttachmentChip: {
    width: 220,
    minHeight: 54,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 10,
    paddingRight: 8,
  },
  fileAttachmentIcon: {
    width: 38,
    height: 34,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileAttachmentText: {
    flex: 1,
    minWidth: 0,
  },
  fileAttachmentRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfPreviewSafe: {
    flex: 1,
  },
  pdfPreviewHeader: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pdfPreviewClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfPreviewTitle: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  pdfPreviewHeaderSide: {
    width: 44,
  },
  pdfPreviewList: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 14,
  },
  pdfPageFrame: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 8,
    gap: 8,
  },
  pdfPageImage: {
    width: '100%',
    aspectRatio: 0.7727,
  },
  pdfPreviewEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  attachmentSheetContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 28,
  },
  attachmentSheetMeta: {
    marginTop: 2,
    marginBottom: 18,
  },
  attachmentActions: {
    marginTop: 2,
  },
  attachmentAction: {
    minHeight: 68,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  attachmentActionText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  attachmentActionDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
})
