/**
 * Atlas AI · Mobile · YouTube paste-time prewarm — pure helpers.
 *
 * The hook (`useYoutubePrewarm`) lives next door. Pure functions live here
 * so they can be unit-tested with `tsx` without dragging React Native.
 *
 * Doctrine: ingestion is dispatched the moment a YouTube link appears in
 * the draft. By the time the operator hits send, the transcript is already
 * `ready` in the backend cache → response goes out without the cold-start
 * latency. See `atlas-server/docs/rich-input/youtube-canon.md`.
 */
import {
  classifyUrl,
  extractUrls,
  extractYouTubeVideoId,
  normalizeYouTubeUrl,
} from '@atlas/rich-input-canon'

export interface ExtractedYoutubeLink {
  /** Canonical URL (https://www.youtube.com/watch?v=ID), guaranteed dedup-friendly. */
  canonicalUrl: string
  /** Extracted videoId (11-char) — guaranteed present. */
  videoId: string
}

/**
 * Extract canonical YouTube links from a free-form draft. Dedupes by
 * `videoId` (different URL formats of the same video collapse). Preserves
 * input order — first occurrence wins.
 */
export function extractYoutubeLinks(draft: string | null | undefined): ExtractedYoutubeLink[] {
  if (!draft || typeof draft !== 'string') return []
  const trimmed = draft.trim()
  if (trimmed === '') return []

  const seen = new Set<string>()
  const out: ExtractedYoutubeLink[] = []

  for (const url of extractUrls(trimmed)) {
    const detected = classifyUrl(url)
    if (detected.kind !== 'youtube') continue
    const videoId = detected.refId ?? extractYouTubeVideoId(url)
    if (!videoId) continue
    if (seen.has(videoId)) continue
    seen.add(videoId)
    const canonical = normalizeYouTubeUrl(url)
    if (!canonical) continue
    out.push({ canonicalUrl: canonical, videoId })
  }

  return out
}

/**
 * Compute the set of videoIds that have NOT yet been prewarmed in this
 * session. Caller maintains the `alreadyPrewarmed` set across renders so
 * paste→type→paste cycles never double-trigger.
 */
export function diffNewVideoIds(
  links: readonly ExtractedYoutubeLink[],
  alreadyPrewarmed: ReadonlySet<string>,
): ExtractedYoutubeLink[] {
  return links.filter((link) => !alreadyPrewarmed.has(link.videoId))
}
