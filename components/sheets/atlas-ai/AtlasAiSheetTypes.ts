import type { AtlasAiAttachment } from '../../../lib/api/client'
import type { RoutingExecutor, RoutingState } from '../../console/StatusRouting'
import type {
  AttachmentUploadPhase,
  ComposerFileAttachment,
  ComposerImageAttachment,
} from './attachmentTypes'
import type { TurnBody } from './AtlasAiTurnBody'

export interface PendingTurn {
  clientId: string
  correlationId: string
  text: string
  attachments: ComposerImageAttachment[]
  fileAttachments: ComposerFileAttachment[]
  startedAt: number
  status: 'sending' | 'failed'
  attachmentPhase?: AttachmentUploadPhase
  attachmentProgress?: number
  errorMessage?: string
  executor: RoutingExecutor
}

export interface SubmitTextOptions {
  clientId?: string
  correlationId?: string
  threadId?: string | null
  routingSnapshot?: RoutingState
  pinnedTraceIdsSnapshot?: string[]
  attachments?: ComposerImageAttachment[]
  fileAttachments?: ComposerFileAttachment[]
  startedAt?: number
  recovered?: boolean
  threadOriginPayload?: Record<string, unknown> | null
}

export interface DisplayTurn {
  key: string
  text: string
  attachments?: ComposerImageAttachment[]
  fileAttachments?: ComposerFileAttachment[]
  historicalAttachments?: AtlasAiAttachment[]
  attachmentPhase?: AttachmentUploadPhase
  attachmentProgress?: number
  body: TurnBody
}
