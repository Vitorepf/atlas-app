import * as Clipboard from 'expo-clipboard'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import type {
  ComposerFileAttachment,
  ComposerImageAttachment,
} from './attachmentTypes'

export const MAX_DRAFT_IMAGES = 8
export const MAX_DRAFT_IMAGE_BYTES = 20 * 1024 * 1024
export const MAX_DRAFT_FILE_BYTES = 20 * 1024 * 1024
export const MAX_DRAFT_FILES = 4

export function attachmentOnlyPrompt(
  attachments: ComposerImageAttachment[],
  fileAttachments: ComposerFileAttachment[],
): string {
  if (attachments.length > 0 && fileAttachments.length > 0) {
    return `analise os ${attachments.length + fileAttachments.length} anexos enviados.`
  }
  if (attachments.length > 0) {
    return attachments.length === 1
      ? 'analise a imagem anexada.'
      : `analise as ${attachments.length} imagens anexadas.`
  }
  if (fileAttachments.length > 0) {
    return fileAttachments.length === 1
      ? 'analise o arquivo anexado.'
      : `analise os ${fileAttachments.length} arquivos anexados.`
  }

  return ''
}

export async function attachmentFromClipboardImage(image: Clipboard.ClipboardImage): Promise<ComposerImageAttachment> {
  const parsed = parseImageDataUri(image.data)
  const fileName = uniqueAttachmentFileName('clipboard', parsed.mimeType)
  const cacheDir = FileSystem.cacheDirectory
  if (!cacheDir) {
    throw new Error('Cache local indisponível para salvar o print.')
  }

  const uri = `${cacheDir}${fileName}`
  await FileSystem.writeAsStringAsync(uri, parsed.base64, {
    encoding: FileSystem.EncodingType.Base64,
  })
  const info = await FileSystem.getInfoAsync(uri)

  return {
    id: newAttachmentId(),
    uri,
    fileName,
    mimeType: parsed.mimeType,
    size: info.exists && typeof info.size === 'number' ? info.size : null,
    width: image.size.width,
    height: image.size.height,
    source: 'clipboard',
  }
}

export function attachmentFromAsset(asset: ImagePicker.ImagePickerAsset, source: 'camera' | 'photos'): ComposerImageAttachment {
  const mimeType = asset.mimeType || 'image/jpeg'
  const originalName = cleanFileName(asset.fileName)
  return {
    id: newAttachmentId(),
    uri: asset.uri,
    fileName: originalName || uniqueAttachmentFileName(source === 'camera' ? 'camera' : 'photo', mimeType),
    mimeType,
    size: typeof asset.fileSize === 'number' ? asset.fileSize : null,
    width: asset.width,
    height: asset.height,
    source,
  }
}

export function attachmentFromDocumentAsset(asset: DocumentPicker.DocumentPickerAsset): ComposerFileAttachment {
  const originalName = cleanFileName(asset.name)
  return {
    id: newAttachmentId(),
    uri: asset.uri,
    fileName: originalName || uniqueAttachmentFileName('file', asset.mimeType || 'application/octet-stream'),
    mimeType: asset.mimeType || mimeForFileName(originalName),
    size: typeof asset.size === 'number' ? asset.size : null,
    source: 'files',
  }
}

export function isDocumentImageAsset(asset: DocumentPicker.DocumentPickerAsset): boolean {
  const mimeType = asset.mimeType || mimeForFileName(asset.name)
  return mimeType.startsWith('image/')
}

export function attachmentFromDocumentImageAsset(asset: DocumentPicker.DocumentPickerAsset): ComposerImageAttachment {
  const mimeType = asset.mimeType || mimeForFileName(asset.name)
  const originalName = cleanFileName(asset.name)
  return {
    id: newAttachmentId(),
    uri: asset.uri,
    fileName: originalName || uniqueAttachmentFileName('file-image', mimeType),
    mimeType,
    size: typeof asset.size === 'number' ? asset.size : null,
    width: null,
    height: null,
    source: 'files',
  }
}

export async function attachmentFitsLocalLimit(attachment: ComposerImageAttachment): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(attachment.uri)
    return !info.exists || info.size <= MAX_DRAFT_IMAGE_BYTES
  } catch {
    return true
  }
}

export async function fileAttachmentFitsLocalLimit(attachment: ComposerFileAttachment): Promise<boolean> {
  if (typeof attachment.size === 'number' && attachment.size > MAX_DRAFT_FILE_BYTES) {
    return false
  }

  try {
    const info = await FileSystem.getInfoAsync(attachment.uri)
    return !info.exists || info.size <= MAX_DRAFT_FILE_BYTES
  } catch {
    return true
  }
}

export function mimeForFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'json') return 'application/json'
  if (ext === 'csv') return 'text/csv'
  if (ext === 'md' || ext === 'markdown') return 'text/markdown'
  if (ext === 'xml') return 'application/xml'
  if (ext === 'html' || ext === 'htm') return 'text/html'
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (ext === 'pptx') return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  if (ext === 'txt') return 'text/plain'
  return 'application/octet-stream'
}

export function newAttachmentId(): string {
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function uniqueAttachmentFileName(prefix: string, mimeType: string): string {
  return `atlas-${prefix}-${timestampSlug()}-${Math.random().toString(36).slice(2, 6)}.${extensionForMime(mimeType)}`
}

function timestampSlug(date = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('') + '-' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('')
}

function cleanFileName(value: unknown): string {
  if (typeof value !== 'string') return ''
  const cleaned = value.split(/[\\/]/).pop()?.trim() ?? ''
  return cleaned.length > 0 ? cleaned : ''
}

function parseImageDataUri(dataUri: string): { mimeType: string; base64: string } {
  const match = dataUri.match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i)
  if (!match?.[1] || !match[2]) {
    throw new Error('Clipboard não retornou uma imagem válida.')
  }

  return {
    mimeType: match[1].toLowerCase(),
    base64: match[2],
  }
}

function extensionForMime(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  if (mimeType === 'image/gif') return 'gif'
  return 'png'
}
