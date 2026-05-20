/**
 * Atlas Rich Input · attachment kind detection (mobile re-export from canon).
 *
 * Implementation lives in `packages/atlas-rich-input-canon`. This thin
 * re-export keeps existing mobile import paths stable
 * (`from './attachmentKind'`).
 */
export type { DetectedAttachmentKind } from '@atlas/rich-input-canon'
export { detectAttachmentKind, formatAttachmentBadge } from '@atlas/rich-input-canon'
