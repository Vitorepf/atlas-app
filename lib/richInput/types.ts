/**
 * Atlas Universal Rich Input Runtime · canonical types.
 *
 * Single source of truth for the `atlas.rich_input.payload.v1` contract.
 * Consumed by:
 *   - Atlas mobile (`atlas-app/lib/richInput/*`)
 *   - Atlas desktop (`atlas-desktop/apps/desktop/src/lib/rich-input/*`)
 *   - Atlas Forge / Obras intake (atlas-server `ForgeIntakeService`)
 *   - Future Atlas surfaces (Dev workspace bundles, CLI, …)
 *
 * Five attachment families (image / pdf / text / code / url) flow through the
 * same 4-state machine (`pending → processing → ready → uploading → uploaded`
 * or `error`). Every surface ingests via the same builders + classifiers and
 * emits the same outbound payload schema; only platform-specific bridges
 * (file picker, clipboard, upload transport) live on the host side.
 *
 * NEVER inline base64. Backend caps: 20MB / 8 imgs / 4 docs (see
 * StoreAiInteractionRequest / AtlasCodeWorkController). Drafts stay local
 * until the operator confirms, then chunked uploaders return canonical
 * `uploaded_id`s consumed by Atlas AI / Forge / Dev interaction payloads.
 *
 * Schema canon for the final outbound payload: see `AtlasRichInputPayload`.
 */

export type AttachmentKind = 'image' | 'pdf' | 'text' | 'code' | 'url'

export type AttachmentStatus =
  | 'pending'
  | 'processing'
  | 'ready'
  | 'uploading'
  | 'uploaded'
  | 'error'

export interface AttachmentBase {
  id: string
  kind: AttachmentKind
  status: AttachmentStatus
  fileName: string
  /** bytes — for image is post-compression; for url is 0 */
  size: number
  mimeType: string
  createdAt: number
  error: string | null
  /** 0..1 */
  progress: number
  uploadedId: string | null
}

/**
 * Image source enum is the UNION across platforms:
 *   - Desktop web/Tauri: paste / drop / picker / camera
 *   - Mobile RN/expo: + photos_library (expo-image-picker)
 *
 * HEIC/HEIF (mobile-only) are converted to JPEG before upload — they never
 * reach the outbound payload as HEIC.
 */
export interface ImageAttachment extends AttachmentBase {
  kind: 'image'
  previewDataUrl: string
  /**
   * In RN, blob may be backed by a `file://...` URI or data URI rather than a
   * native Blob; the `Blob` type stays in the schema for compat — host code is
   * responsible for adapting at the upload boundary.
   */
  blob: Blob
  width: number
  height: number
  originalSize: number
  source: 'paste' | 'drop' | 'picker' | 'camera' | 'photos_library'
}

export interface PdfAttachment extends AttachmentBase {
  kind: 'pdf'
  blob: Blob
  pageCount: number
  thumbnailDataUrl: string | null
  extractedText: string
  textLength: number
  source: 'drop' | 'picker'
}

export interface TextAttachment extends AttachmentBase {
  kind: 'text'
  blob: Blob
  content: string
  language: string | null
  source: 'drop' | 'picker' | 'paste'
}

export interface CodeAttachment extends AttachmentBase {
  kind: 'code'
  blob: Blob
  content: string
  language: string
  source: 'drop' | 'picker' | 'paste'
}

export interface UrlAttachment extends AttachmentBase {
  kind: 'url'
  url: string
  urlKind: 'youtube' | 'vimeo' | 'github' | 'generic'
  title: string | null
  thumbnailUrl: string | null
  author: string | null
  durationSec: number | null
  refId: string | null
  source: 'paste' | 'manual'
  /**
   * Optional YouTube canonical fields — populated when the surface receives
   * status updates from the backend trace payload. See
   * `@atlas/rich-input-canon/youtube` for canonical types. Surfaces that
   * never expose status updates leave these undefined.
   */
  ingestionStatus?: import('./youtube').YoutubeIngestionStatus
  transcriptStatus?: import('./youtube').YoutubeTranscriptStatus
  translationStatus?: import('./youtube').YoutubeTranslationStatus
  sourceLanguage?: string | null
  targetLanguage?: string
  translationRequired?: boolean
}

export type AttachmentDraft =
  | ImageAttachment
  | PdfAttachment
  | TextAttachment
  | CodeAttachment
  | UrlAttachment

/**
 * Canonical limits — MUST stay in lockstep with the atlas-server validators:
 *   - StoreAiInteractionRequest (`/ai/interactions`)
 *   - AtlasCodeWorkController (`/atlas-code/works`)
 *
 * Mudança em qualquer lado exige update simultâneo do outro.
 */
export const ATTACHMENT_LIMITS = {
  maxImages: 8,
  maxPdfs: 4,
  maxTextFiles: 8,
  maxUrls: 16,
  maxImageBytes: 20 * 1024 * 1024,
  maxPdfBytes: 20 * 1024 * 1024,
  maxTextBytes: 4 * 1024 * 1024,
  maxTextPreviewChars: 200_000,
  maxImageDimension: 2048,
  imageJpegQuality: 0.86,
  imageWebpQuality: 0.86,
  chunkSize: 1.5 * 1024 * 1024,
} as const

export const SUPPORTED_IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
])

export const SUPPORTED_PDF_MIME = new Set(['application/pdf'])

export const SUPPORTED_TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml']

/**
 * Canonical extension → language map. Used to split `code` (language-tagged
 * attachment) from `text` (untagged) at classification time.
 */
export const CODE_LANG_BY_EXT: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  h: 'c',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  sql: 'sql',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  css: 'css',
  scss: 'css',
  less: 'css',
  md: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  json: 'json',
  jsonc: 'json',
  vue: 'vue',
  svelte: 'svelte',
  dart: 'dart',
  lua: 'lua',
  ex: 'elixir',
  exs: 'elixir',
  erl: 'erlang',
  elm: 'elm',
  hs: 'haskell',
  ml: 'ocaml',
  zig: 'zig',
  diff: 'diff',
  patch: 'diff',
  conf: 'ini',
  ini: 'ini',
  env: 'bash',
  dockerfile: 'docker',
}

export function detectLanguageFromFilename(name: string): string | null {
  const lower = name.toLowerCase()
  if (lower === 'dockerfile' || lower.endsWith('/dockerfile')) return 'docker'
  if (lower === 'makefile') return 'makefile'
  const ext = lower.split('.').pop() ?? ''
  return CODE_LANG_BY_EXT[ext] ?? null
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Canonical outbound payload contract: `atlas.rich_input.payload.v1`.    */
/* ──────────────────────────────────────────────────────────────────────── */

export const ATLAS_RICH_INPUT_PAYLOAD_SCHEMA = 'atlas.rich_input.payload.v1' as const

export interface AtlasRichInputUrlAttachmentPayload {
  url: string
  kind: string
  title: string | null
  author: string | null
  duration_sec: number | null
  thumbnail_url: string | null
  ref_id: string | null
}

export interface AtlasRichInputTextBlockPayload {
  file_name: string
  mime_type: string
  language: string | null
  content: string
  /** Attached when the source was a PDF — callers ignore otherwise. */
  page_count?: number
}

/**
 * Source manifest entry — describes each attached artifact in a typed shape
 * that any consumer (Atlas AI, Forge, Dev) can audit. The manifest is built
 * from the same drafts that produced uploaded_*_ids / text_blocks /
 * url_attachments, so it stays in lockstep with the outbound payload.
 */
export interface AtlasRichInputSourceManifestEntry {
  id: string
  kind: AttachmentKind
  file_name: string
  mime_type: string
  size: number
  uploaded_id: string | null
  /**
   * SHA-256 of the source bytes — present when the bridge already computed it
   * (chunkedUploader complete-response may carry it). Otherwise `null` and
   * downstream callers either compute or treat the artifact as
   * non-verifiable.
   */
  source_hash: string | null
  source: string
}

/**
 * `atlas.rich_input.payload.v1` — the canonical outbound shape that every
 * Atlas surface emits when forwarding attachments + URLs to the backend.
 *
 * Backend today consumes `uploaded_image_ids`, `uploaded_document_ids`,
 * `text_blocks` and `url_attachments`. `source_manifest` + `hashes` are
 * forward-compatible additions: callers MAY populate them today, and future
 * Atlas surfaces (Forge intake, Atlas Dev workspace bundles) MUST.
 */
export interface AtlasRichInputPayload {
  schema_version: typeof ATLAS_RICH_INPUT_PAYLOAD_SCHEMA
  uploaded_image_ids: string[]
  uploaded_document_ids: string[]
  text_blocks: AtlasRichInputTextBlockPayload[]
  url_attachments: AtlasRichInputUrlAttachmentPayload[]
  source_manifest: AtlasRichInputSourceManifestEntry[]
  hashes?: {
    /** Hex sha256 covering the canonical serialization of the manifest. */
    manifest_sha256?: string
  }
}
