/**
 * Atlas Rich Input · source manifest + canonical payload builder
 * (mobile re-export from canon).
 *
 * Implementation lives in `packages/atlas-rich-input-canon`. This thin
 * re-export keeps existing mobile import paths stable
 * (`from './sourceManifest'`).
 */
export type { ManifestAttachmentLike, ManifestUrlLike } from '@atlas/rich-input-canon'
export {
  buildManifestEntry,
  buildRichInputPayload,
  buildSourceManifest,
  buildUrlAttachmentPayload,
  buildUrlAttachmentsFromText,
} from '@atlas/rich-input-canon'
