/**
 * Atlas Rich Input · token estimation + summary helpers.
 *
 * Client-side rough estimate (not from API): text length ÷ 4 (proxy for
 * tokens) + fixed cost per attachment family. Mobile and desktop ship the
 * same formula so the composer `~N tokens` badge stays in lockstep across
 * surfaces.
 *
 * The summary shape is a superset of the historic mobile/desktop shapes:
 *   - singular kind keys (`image`, `pdf`, `text`, `code`, `url`)
 *   - plural aliases (`images`, `pdfs`, `urls`) for desktop call-site
 *     back-compat
 *   - `total` (sum of non-error drafts) for the desktop pill renderer
 *
 * `text` does NOT include `code` — surfaces that previously bundled them
 * together for display should render `text + code` at the call site.
 */
import type { AttachmentDraft } from './types'

/**
 * Token-cost constants — exported so platform-specific composers
 * (e.g. mobile's `ComposerPillsRowModel.ts`) that compute estimates
 * on narrower attachment shapes can reuse the canon numbers without
 * forking the formula.
 */
export const TEXT_CHARS_PER_TOKEN = 4
export const IMAGE_TOKEN_COST = 1200
export const PDF_FALLBACK_TOKEN_COST_PER_PAGE = 700
export const PDF_MIN_TOKEN_COST = 600
export const URL_TOKEN_COST = 100

export function estimateRichInputTokens(
  text: string,
  drafts: readonly AttachmentDraft[] = [],
): number {
  let tokens = text.trim() === '' ? 0 : Math.max(1, Math.round(text.length / TEXT_CHARS_PER_TOKEN))

  for (const draft of drafts) {
    if (draft.status === 'error') continue

    switch (draft.kind) {
      case 'image':
        tokens += IMAGE_TOKEN_COST
        break
      case 'pdf':
        tokens += draft.extractedText
          ? Math.max(1, Math.round(draft.extractedText.length / TEXT_CHARS_PER_TOKEN))
          : Math.max(PDF_MIN_TOKEN_COST, draft.pageCount * PDF_FALLBACK_TOKEN_COST_PER_PAGE)
        break
      case 'text':
      case 'code':
        tokens += Math.max(1, Math.round(draft.content.length / TEXT_CHARS_PER_TOKEN))
        break
      case 'url':
        tokens += URL_TOKEN_COST
        break
    }
  }

  return tokens
}

export interface RichInputDraftSummary {
  /** Count of `image` drafts (excluding error). */
  image: number
  /** Count of `pdf` drafts (excluding error). */
  pdf: number
  /** Count of `text` drafts (excluding error). Does NOT include `code`. */
  text: number
  /** Count of `code` drafts (excluding error). */
  code: number
  /** Count of `url` drafts (excluding error). */
  url: number
  /** Sum of all non-error drafts. */
  total: number
  /** Plural alias for `image` — kept for desktop call-site back-compat. */
  images: number
  /** Plural alias for `pdf` — kept for desktop call-site back-compat. */
  pdfs: number
  /** Plural alias for `url` — kept for desktop call-site back-compat. */
  urls: number
}

/**
 * Tally drafts by kind, ignoring drafts in `error` status. Used to render
 * the compact label next to the token counter (e.g. `2 img · 1 pdf · 3 url`).
 */
export function summarizeRichInputDrafts(
  drafts: readonly AttachmentDraft[] = [],
): RichInputDraftSummary {
  let image = 0
  let pdf = 0
  let text = 0
  let code = 0
  let url = 0

  for (const draft of drafts) {
    if (draft.status === 'error') continue
    switch (draft.kind) {
      case 'image':
        image++
        break
      case 'pdf':
        pdf++
        break
      case 'text':
        text++
        break
      case 'code':
        code++
        break
      case 'url':
        url++
        break
    }
  }

  return {
    image,
    pdf,
    text,
    code,
    url,
    total: image + pdf + text + code + url,
    images: image,
    pdfs: pdf,
    urls: url,
  }
}

/** Narrow shape consumed by `formatRichInputSummary` — only the 5 singular
 *  kind counts. `RichInputDraftSummary` is assignable to this type, so both
 *  the historic mobile test fixtures (5-field literals) and the full canon
 *  summary work as input. */
export type RichInputDraftSummaryDisplay = Pick<
  RichInputDraftSummary,
  'image' | 'pdf' | 'text' | 'code' | 'url'
>

/**
 * Format a summary as a compact display string (`2 img · 1 pdf · 3 url`).
 * Skips zero-count categories to keep the UI quiet.
 */
export function formatRichInputSummary(summary: RichInputDraftSummaryDisplay): string {
  const parts: string[] = []
  if (summary.image > 0) parts.push(`${summary.image} img`)
  if (summary.pdf > 0) parts.push(`${summary.pdf} pdf`)
  if (summary.text > 0) parts.push(`${summary.text} txt`)
  if (summary.code > 0) parts.push(`${summary.code} code`)
  if (summary.url > 0) parts.push(`${summary.url} url`)
  return parts.join(' · ')
}
