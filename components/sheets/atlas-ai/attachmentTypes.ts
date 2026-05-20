import type {
  AiInteractionFileAttachmentInput,
  AiInteractionImageAttachmentInput,
} from '../../../lib/api/client'
import {
  detectAttachmentKind,
  formatAttachmentBadge,
} from '../../../lib/richInput/attachmentKind'

export type AttachmentUploadPhase = 'preparing' | 'uploading' | 'accepted' | 'failed'

export interface ComposerImageAttachment extends AiInteractionImageAttachmentInput {
  id: string
}

export interface ComposerFileAttachment extends AiInteractionFileAttachmentInput {
  id: string
}

/**
 * Legacy badge · extensão uppercase capped 5 chars. Mantido pra compat de
 * locais que não passam mimeType. Novos consumers devem usar
 * `attachmentBadgeLabel(fileName, mimeType)` canon.
 *
 * @deprecated · use `attachmentBadgeLabel(fileName, mimeType)` quando tiver MIME.
 */
export function fileExtensionLabel(fileName: string): string {
  const ext = fileName.split('.').pop()?.trim().toUpperCase()
  return ext && ext.length <= 5 ? ext : 'FILE'
}

/**
 * Badge canônico usando `lib/richInput/attachmentKind`. Resolve linguagem +
 * label premium:
 *   - "report.pdf" + "application/pdf" → "PDF"
 *   - "App.tsx" + "text/plain" → "TSX"
 *   - "handler.py" + "application/octet-stream" → "Python"
 *   - "Dockerfile" + "text/plain" → "Docker"
 *   - "config.json" + "application/json" → "JSON"
 *   - "screenshot.png" + "image/png" → "PNG"
 *
 * Fallback: se mimeType ausente, cai pro `fileExtensionLabel` legacy.
 */
export function attachmentBadgeLabel(fileName: string, mimeType?: string | null): string {
  if (!mimeType) return fileExtensionLabel(fileName)
  const detected = detectAttachmentKind(mimeType, fileName)
  return formatAttachmentBadge(detected, mimeType)
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return 'arquivo'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}
