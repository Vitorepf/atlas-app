/**
 * `@atlas/rich-input-canon` — Atlas Universal Rich Input Runtime.
 *
 * Single source of truth for the `atlas.rich_input.payload.v1` contract.
 * Pure TypeScript, no runtime dependencies, no platform assumptions
 * (works on web/Tauri, React Native ≥ 0.65, Node, Deno).
 *
 * Consumed by:
 *   - Atlas mobile (`atlas-app/lib/richInput`)
 *   - Atlas desktop (`atlas-desktop/apps/desktop/src/lib/rich-input`)
 *   - Atlas Forge / Obras intake (atlas-server bridges)
 *   - Any future Atlas surface
 *
 * Public surface:
 *   - Types: `AttachmentDraft`, `AtlasRichInputPayload`,
 *     `AtlasRichInputSourceManifestEntry`, `AtlasRichInputTextBlockPayload`,
 *     `AtlasRichInputUrlAttachmentPayload`, `AttachmentKind`,
 *     `AttachmentStatus`, `RichInputDraftSummary`, `DetectedUrl`,
 *     `DetectedAttachmentKind`, …
 *   - Constants: `ATLAS_RICH_INPUT_PAYLOAD_SCHEMA`, `ATTACHMENT_LIMITS`,
 *     `SUPPORTED_IMAGE_MIME`, `SUPPORTED_PDF_MIME`,
 *     `SUPPORTED_TEXT_MIME_PREFIXES`, `CODE_LANG_BY_EXT`.
 *   - Helpers: `detectLanguageFromFilename`, `detectAttachmentKind`,
 *     `formatAttachmentBadge`, `classifyUrl`, `extractUrls`,
 *     `fetchUrlMetadata`, `estimateRichInputTokens`,
 *     `summarizeRichInputDrafts`, `formatRichInputSummary`,
 *     `buildManifestEntry`, `buildSourceManifest`, `buildRichInputPayload`,
 *     `buildUrlAttachmentPayload`, `buildUrlAttachmentsFromText`,
 *     `withRetry`.
 */

export * from './types'
export * from './urlDetector'
export * from './metrics'
export * from './attachmentKind'
export * from './sourceManifest'
export * from './uploadRetry'
export * from './youtube'
export * from './computeEffort'
