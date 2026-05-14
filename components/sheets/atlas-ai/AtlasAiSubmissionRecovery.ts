import { atlasStorage } from '../../../lib/storage'
import {
  AtlasApiError,
} from '../../../lib/api/client'
import {
  ROUTING_DEFAULT,
  type RoutingState,
} from '../../console/StatusRouting'
import type {
  ComposerFileAttachment,
  ComposerImageAttachment,
} from './attachmentTypes'
import {
  MAX_DRAFT_FILES,
  MAX_DRAFT_IMAGES,
  mimeForFileName,
  newAttachmentId,
} from './AtlasAiAttachmentModel'
import { normalizeStoredRouting } from './AtlasAiRoutingModel'

const PENDING_SUBMISSION_KEY = 'atlas-ai.pending-submission'

export interface PendingAiSubmission {
  clientId: string
  correlationId: string
  input: string
  attachments: ComposerImageAttachment[]
  fileAttachments: ComposerFileAttachment[]
  threadId: string | null
  routing: RoutingState
  pinnedTraceIds: string[]
  threadOriginPayload?: Record<string, unknown> | null
  startedAt: number
}

export async function storePendingSubmission(submission: PendingAiSubmission): Promise<boolean> {
  try {
    await atlasStorage.setItem(PENDING_SUBMISSION_KEY, JSON.stringify(submission))
    return true
  } catch {
    return false
  }
}

export async function readPendingSubmission(): Promise<PendingAiSubmission | null> {
  try {
    const raw = await atlasStorage.getItem(PENDING_SUBMISSION_KEY)
    return parsePendingSubmission(raw)
  } catch {
    return null
  }
}

export async function clearPendingSubmission(clientId?: string): Promise<void> {
  try {
    if (clientId) {
      const current = parsePendingSubmission(await atlasStorage.getItem(PENDING_SUBMISSION_KEY))
      if (current && current.clientId !== clientId) return
    }
    await atlasStorage.removeItem(PENDING_SUBMISSION_KEY)
  } catch {
    // The next recovery pass will re-check the payload.
  }
}

export function shouldKeepPendingSubmission(error: unknown, hasAttachments = false): boolean {
  if (!(error instanceof AtlasApiError)) return true
  if (hasAttachments && error.status >= 500) return false
  return error.status === 408 || error.status === 429 || error.status >= 500
}

export function humanAiError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback
  if (message.includes('route ai/') || message.includes('rota ai/')) {
    return 'Atlas não está carregado no servidor. Rebuild/restart o atlas-server e toque na marca para tentar de novo.'
  }
  return message
}

export function newClientId(): string {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const randomUuid = globalThis.crypto?.randomUUID?.()
  if (randomUuid && uuidPattern.test(randomUuid)) return randomUuid
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16)
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8
    return value.toString(16)
  })
}

function parsePendingSubmission(raw: string | null): PendingAiSubmission | null {
  if (!raw) return null

  try {
    const value = JSON.parse(raw) as Partial<PendingAiSubmission>
    if (typeof value.clientId !== 'string' || typeof value.input !== 'string' || value.input.trim() === '') {
      return null
    }

    const startedAt = typeof value.startedAt === 'number' && Number.isFinite(value.startedAt)
      ? value.startedAt
      : Date.now()
    const pinnedTraceIds = Array.isArray(value.pinnedTraceIds)
      ? value.pinnedTraceIds.filter((id): id is string => typeof id === 'string')
      : []
    const attachments = normalizeStoredAttachments(value.attachments)
    const fileAttachments = normalizeStoredFileAttachments(value.fileAttachments)

    return {
      clientId: value.clientId,
      correlationId: typeof value.correlationId === 'string' ? value.correlationId : value.clientId,
      input: value.input,
      attachments,
      fileAttachments,
      threadId: typeof value.threadId === 'string' ? value.threadId : null,
      routing: normalizeStoredRouting(JSON.stringify(value.routing ?? ROUTING_DEFAULT)),
      pinnedTraceIds,
      threadOriginPayload: normalizeStoredRecord(value.threadOriginPayload),
      startedAt,
    }
  } catch {
    return null
  }
}

function normalizeStoredRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function normalizeStoredAttachments(value: unknown): ComposerImageAttachment[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item): ComposerImageAttachment | null => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const uri = typeof record.uri === 'string' ? record.uri : ''
      const fileName = typeof record.fileName === 'string' ? record.fileName : ''
      const mimeType = typeof record.mimeType === 'string' ? record.mimeType : ''
      if (!uri || !fileName || !mimeType.startsWith('image/')) return null

      return {
        id: typeof record.id === 'string' ? record.id : newAttachmentId(),
        uri,
        fileName,
        mimeType,
        width: typeof record.width === 'number' ? record.width : null,
        height: typeof record.height === 'number' ? record.height : null,
        source: typeof record.source === 'string' ? record.source : 'recovered',
      }
    })
    .filter((item): item is ComposerImageAttachment => item !== null)
    .slice(0, MAX_DRAFT_IMAGES)
}

function normalizeStoredFileAttachments(value: unknown): ComposerFileAttachment[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item): ComposerFileAttachment | null => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const uri = typeof record.uri === 'string' ? record.uri : ''
      const fileName = typeof record.fileName === 'string' ? record.fileName : ''
      const mimeType = typeof record.mimeType === 'string' ? record.mimeType : ''
      if (!uri || !fileName) return null

      return {
        id: typeof record.id === 'string' ? record.id : newAttachmentId(),
        uri,
        fileName,
        mimeType: mimeType || mimeForFileName(fileName),
        size: typeof record.size === 'number' ? record.size : null,
        source: typeof record.source === 'string' ? record.source : 'recovered',
      }
    })
    .filter((item): item is ComposerFileAttachment => item !== null)
    .slice(0, MAX_DRAFT_FILES)
}
