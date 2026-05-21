/**
 * Atlas Rich Input · attachment kind detection.
 *
 * Classifies a file (MIME + name) into one of 5 canonical `AttachmentKind`:
 *   - `image` · PNG/JPEG/WebP/GIF (SUPPORTED_IMAGE_MIME)
 *   - `pdf` · application/pdf (SUPPORTED_PDF_MIME)
 *   - `code` · text MIME WITH extension mapped in CODE_LANG_BY_EXT
 *   - `text` · text MIME WITHOUT a code-known extension
 *   - `url` · not classified here (URLs come from `urlDetector`)
 *
 * Used by composers to render the canonical attachment badge:
 *   - `image` → "PNG · 4.2 MB"
 *   - `pdf` → "PDF · 12 pág"
 *   - `code` → "TypeScript · 18 KB"
 *   - `text` → "Markdown · 4 KB" / "TEXT · 4 KB"
 */
import {
  SUPPORTED_IMAGE_MIME,
  SUPPORTED_PDF_MIME,
  SUPPORTED_TEXT_MIME_PREFIXES,
  detectLanguageFromFilename,
  type AttachmentKind,
} from './types'

export interface DetectedAttachmentKind {
  kind: Exclude<AttachmentKind, 'url'>
  /** Language detected for kind='code', null otherwise. */
  language: string | null
  /** Reason for the classification (debug + audit). */
  reason: string
}

/**
 * Classify a file via MIME + filename extension.
 *
 * Heuristic (ordered):
 *   1. MIME in SUPPORTED_IMAGE_MIME → 'image'
 *   2. MIME in SUPPORTED_PDF_MIME → 'pdf'
 *   3. Extension in CODE_LANG_BY_EXT (non-markdown) → 'code' with language
 *   4. Markdown extension → 'text' with language='markdown'
 *   5. MIME prefixed text/ or application/json|xml → 'text'
 *   6. Fallback → 'text' (with reason='fallback:...')
 */
export function detectAttachmentKind(mimeType: string, fileName: string): DetectedAttachmentKind {
  const normalizedMime = (mimeType ?? '').toLowerCase().trim()
  const normalizedName = (fileName ?? '').toLowerCase().trim()

  if (SUPPORTED_IMAGE_MIME.has(normalizedMime)) {
    return { kind: 'image', language: null, reason: `mime:${normalizedMime}` }
  }

  if (SUPPORTED_PDF_MIME.has(normalizedMime)) {
    return { kind: 'pdf', language: null, reason: `mime:${normalizedMime}` }
  }

  const language = detectLanguageFromFilename(normalizedName)
  if (language && language !== 'markdown') {
    return { kind: 'code', language, reason: `ext:${language}` }
  }

  const matchesTextPrefix = SUPPORTED_TEXT_MIME_PREFIXES.some((prefix) =>
    normalizedMime.startsWith(prefix),
  )

  if (language === 'markdown') {
    return { kind: 'text', language: 'markdown', reason: 'ext:markdown' }
  }

  if (matchesTextPrefix) {
    return { kind: 'text', language: null, reason: `mime:${normalizedMime}` }
  }

  return { kind: 'text', language: null, reason: `fallback:${normalizedMime || 'unknown'}` }
}

/**
 * Display helper: canonical text badge from the detection result.
 *
 * Examples:
 *   - `image` → "PNG" / "JPEG" / "WEBP" / "GIF" / "IMG"
 *   - `pdf` → "PDF"
 *   - `code` with language='typescript' → "TypeScript"
 *   - `text` with language='markdown' → "Markdown"
 *   - `text` without language → "TEXT"
 */
export function formatAttachmentBadge(detected: DetectedAttachmentKind, mimeType?: string): string {
  if (detected.kind === 'image') {
    const mime = (mimeType ?? '').toLowerCase()
    if (mime === 'image/jpeg' || mime === 'image/jpg') return 'JPEG'
    if (mime === 'image/png') return 'PNG'
    if (mime === 'image/webp') return 'WEBP'
    if (mime === 'image/gif') return 'GIF'
    return 'IMG'
  }
  if (detected.kind === 'pdf') return 'PDF'
  if (detected.kind === 'code' && detected.language) {
    return capitalize(detected.language)
  }
  if (detected.kind === 'text' && detected.language === 'markdown') {
    return 'Markdown'
  }
  return 'TEXT'
}

function capitalize(slug: string): string {
  if (slug === 'javascript') return 'JavaScript'
  if (slug === 'typescript') return 'TypeScript'
  if (slug === 'tsx') return 'TSX'
  if (slug === 'jsx') return 'JSX'
  if (slug === 'csharp') return 'C#'
  if (slug === 'cpp') return 'C++'
  if (slug === 'bash') return 'Shell'
  if (slug === 'sql') return 'SQL'
  if (slug === 'html') return 'HTML'
  if (slug === 'css') return 'CSS'
  if (slug === 'json') return 'JSON'
  if (slug === 'yaml') return 'YAML'
  if (slug === 'toml') return 'TOML'
  if (slug === 'xml') return 'XML'
  if (slug === 'docker') return 'Docker'
  if (slug === 'makefile') return 'Makefile'
  return slug.charAt(0).toUpperCase() + slug.slice(1)
}
