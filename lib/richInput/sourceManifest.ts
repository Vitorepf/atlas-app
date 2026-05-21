/**
 * Atlas Rich Input · source manifest + canonical payload builder.
 *
 * Slice 5b canon · builds the `source_manifest` array of the
 * `atlas.rich_input.payload.v1` schema (see `./types.ts`).
 *
 * Each entry is the audit trail of one outbound attachment, linking the
 * canonical backend `upload_id` to its human source (file picker, paste,
 * drop, camera, photos library).
 *
 * `source_hash` is `null` when the bridge has not computed SHA-256 of the
 * source bytes (mobile skips this for CPU reasons on iPhone). Backend may
 * fill it after upload completes.
 */
import {
  ATLAS_RICH_INPUT_PAYLOAD_SCHEMA,
  ATTACHMENT_LIMITS,
  type AttachmentDraft,
  type AttachmentKind,
  type AtlasRichInputPayload,
  type AtlasRichInputSourceManifestEntry,
  type AtlasRichInputTextBlockPayload,
  type AtlasRichInputUrlAttachmentPayload,
} from './types'
import { detectAttachmentKind } from './attachmentKind'
import { classifyUrl, extractUrls, type DetectedUrl } from './urlDetector'
import { normalizeYouTubeUrl } from './youtube'

/**
 * Minimal shape the manifest builder consumes — kept local to avoid coupling
 * the canon to a specific composer attachment type.
 */
export interface ManifestAttachmentLike {
  /** Stable ID per attachment. Used as `manifest.entries[].id` when present. */
  id?: string | null
  /** Local URI (used as fallback ID seed when `id` is absent). */
  uri?: string | null
  fileName: string
  mimeType: string
  size?: number | null
  source?: string | null
}

export interface ManifestUrlLike {
  url: string
  kind: string
  title?: string | null
  author?: string | null
  duration_sec?: number | null
  thumbnail_url?: string | null
  ref_id?: string | null
}

/**
 * Resolve canonical `AttachmentKind` from MIME + filename. For uploads:
 *   - `forcedKind='image'` when the caller already classified
 *   - `forcedKind='file'` falls back to `detectAttachmentKind`
 */
function resolveKind(
  attachment: ManifestAttachmentLike,
  forcedKind?: 'image' | 'file',
): AttachmentKind {
  if (forcedKind === 'image') return 'image'
  const detected = detectAttachmentKind(attachment.mimeType, attachment.fileName)
  return detected.kind
}

/**
 * Stable ID from URI + fileName + size — useful when the attachment has no
 * `id` (e.g. raw inputs into the upload pipeline). FNV-1a 32-bit hash.
 */
function stableManifestId(attachment: ManifestAttachmentLike): string {
  if (attachment.id && attachment.id.length > 0) return attachment.id

  const input = `${attachment.uri ?? ''}|${attachment.fileName}|${attachment.size ?? 0}`
  let hash = 2166136261
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `manifest-${Math.abs(hash >>> 0).toString(36)}`
}

function stableUrlManifestId(url: string): string {
  let hash = 2166136261
  for (let index = 0; index < url.length; index++) {
    hash ^= url.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `url-${Math.abs(hash >>> 0).toString(36)}`
}

/**
 * Build a manifest entry for a single attachment + uploaded_id pair.
 */
export function buildManifestEntry(
  attachment: ManifestAttachmentLike,
  uploadedId: string | null,
  forcedKind?: 'image' | 'file',
): AtlasRichInputSourceManifestEntry {
  return {
    id: stableManifestId(attachment),
    kind: resolveKind(attachment, forcedKind),
    file_name: attachment.fileName,
    mime_type: attachment.mimeType,
    size: typeof attachment.size === 'number' && attachment.size > 0 ? attachment.size : 0,
    uploaded_id: uploadedId,
    source_hash: null,
    source: attachment.source ?? 'app',
  }
}

export function buildUrlAttachmentPayload(detected: DetectedUrl): AtlasRichInputUrlAttachmentPayload {
  const canonicalUrl =
    detected.kind === 'youtube'
      ? normalizeYouTubeUrl(detected.url) ?? detected.url
      : detected.url
  return {
    url: canonicalUrl,
    kind: detected.kind,
    title: null,
    author: null,
    duration_sec: null,
    thumbnail_url:
      detected.kind === 'youtube' && detected.refId
        ? `https://img.youtube.com/vi/${detected.refId}/hqdefault.jpg`
        : null,
    ref_id: detected.refId,
  }
}

export function buildUrlAttachmentsFromText(text: string): AtlasRichInputUrlAttachmentPayload[] {
  return extractUrls(text)
    .slice(0, ATTACHMENT_LIMITS.maxUrls)
    .map((url) => buildUrlAttachmentPayload(classifyUrl(url)))
}

function buildUrlManifestEntry(attachment: ManifestUrlLike): AtlasRichInputSourceManifestEntry {
  return {
    id: stableUrlManifestId(attachment.url),
    kind: 'url',
    file_name: attachment.url,
    mime_type: 'text/uri-list',
    size: 0,
    uploaded_id: null,
    source_hash: null,
    source: 'paste',
  }
}

/**
 * Build the full source_manifest from parallel lists of attachments and the
 * `uploaded_id`s the backend returned for each.
 *
 * Entry order: images first (in `uploadedImageIds` order), then files (in
 * `uploadedDocumentIds` order), then URLs — same order as the parallel
 * outbound arrays, so callers/backends can rebuild positional indexes.
 */
export function buildSourceManifest(input: {
  imageAttachments: ManifestAttachmentLike[]
  uploadedImageIds: string[]
  fileAttachments: ManifestAttachmentLike[]
  uploadedDocumentIds: string[]
  urlAttachments?: ManifestUrlLike[]
}): AtlasRichInputSourceManifestEntry[] {
  const manifest: AtlasRichInputSourceManifestEntry[] = []

  input.imageAttachments.forEach((attachment, idx) => {
    const uploadedId = input.uploadedImageIds[idx] ?? null
    manifest.push(buildManifestEntry(attachment, uploadedId, 'image'))
  })

  input.fileAttachments.forEach((attachment, idx) => {
    const uploadedId = input.uploadedDocumentIds[idx] ?? null
    manifest.push(buildManifestEntry(attachment, uploadedId, 'file'))
  })

  input.urlAttachments?.forEach((attachment) => {
    manifest.push(buildUrlManifestEntry(attachment))
  })

  return manifest
}

/**
 * Variant for callers that already hold a single mixed-kind list of drafts
 * (rather than the parallel `imageAttachments` / `fileAttachments` /
 * `urlAttachments` arrays that `buildSourceManifest` consumes). Used by
 * desktop's `useAtlasRichInputAttachments` hook where the local state is
 * one `AttachmentDraft[]`.
 *
 * Filters out drafts in `pending`/`processing`/`uploading`/`error` states
 * (mirrors the historic desktop guard) and emits an entry per draft.
 * Order follows the input array order.
 */
export function buildSourceManifestFromDrafts(
  drafts: readonly AttachmentDraft[],
): AtlasRichInputSourceManifestEntry[] {
  return drafts
    .filter((d) => d.status === 'ready' || d.status === 'uploaded')
    .map((d): AtlasRichInputSourceManifestEntry => ({
      id: d.id,
      kind: d.kind,
      file_name: d.fileName,
      mime_type: d.mimeType,
      size: d.size,
      uploaded_id: d.uploadedId,
      source_hash: null,
      source: d.source,
    }))
}

/**
 * Build the canonical `atlas.rich_input.payload.v1` ready to attach to
 * `/ai/interactions` or `/atlas-code/works`.
 *
 * When `urlAttachments` is omitted it is derived from `inputText` via
 * `extractUrls` + `classifyUrl`. `text_blocks` is empty by default — callers
 * that ship text/code drafts should populate it explicitly via the
 * `textBlocks` field.
 */
export function buildRichInputPayload(input: {
  imageAttachments: ManifestAttachmentLike[]
  uploadedImageIds: string[]
  fileAttachments: ManifestAttachmentLike[]
  uploadedDocumentIds: string[]
  inputText?: string
  urlAttachments?: AtlasRichInputUrlAttachmentPayload[]
  textBlocks?: AtlasRichInputTextBlockPayload[]
}): AtlasRichInputPayload {
  const urlAttachments =
    input.urlAttachments ?? buildUrlAttachmentsFromText(input.inputText ?? '')

  return {
    schema_version: ATLAS_RICH_INPUT_PAYLOAD_SCHEMA,
    uploaded_image_ids: input.uploadedImageIds,
    uploaded_document_ids: input.uploadedDocumentIds,
    text_blocks: input.textBlocks ?? [],
    url_attachments: urlAttachments,
    source_manifest: buildSourceManifest({
      ...input,
      urlAttachments,
    }),
  }
}
