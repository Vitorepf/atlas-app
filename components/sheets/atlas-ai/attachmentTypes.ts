import type {
  AiInteractionFileAttachmentInput,
  AiInteractionImageAttachmentInput,
} from '../../../lib/api/client'

export type AttachmentUploadPhase = 'preparing' | 'uploading' | 'accepted' | 'failed'

export interface ComposerImageAttachment extends AiInteractionImageAttachmentInput {
  id: string
}

export interface ComposerFileAttachment extends AiInteractionFileAttachmentInput {
  id: string
}

export function fileExtensionLabel(fileName: string): string {
  const ext = fileName.split('.').pop()?.trim().toUpperCase()
  return ext && ext.length <= 5 ? ext : 'FILE'
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return 'arquivo'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}
