/**
 * Atlas AI · Mobile · YouTube prewarm HTTP client (silent).
 *
 *   POST /ai/youtube/prewarm       (paste-time background ingestion)
 *   GET  /ai/youtube/ingestion/{videoId}  (live status poll)
 *
 * Silent philosophy: any error → null. The composer never blocks on prewarm.
 * Worst case: the operator hits send and pays the latency once (same as
 * before this feature).
 */
import { apiGet, apiPost } from '../api/client'

import type {
  YoutubeIngestionStatus,
  YoutubeTranscriptStatus,
  YoutubeTranslationStatus,
} from '../richInput'

export interface YoutubePrewarmItem {
  url: string
  canonical_url: string | null
  video_id: string | null
  ingestion_status: YoutubeIngestionStatus | string
  transcript_status: YoutubeTranscriptStatus | string
  translation_status: YoutubeTranslationStatus | string
  source_language: string | null
  target_language: string
  translation_required: boolean
  cache_hit: boolean
  dispatched: boolean
  locked: boolean
  last_ingested_at: string | null
  reason?: string
}

export interface YoutubePrewarmResponse {
  schema_version: 1
  items: YoutubePrewarmItem[]
}

export interface YoutubeStatusItem {
  video_id: string
  ingestion_status: YoutubeIngestionStatus | string
  transcript_status: YoutubeTranscriptStatus | string
  translation_status: YoutubeTranslationStatus | string
  source_language: string | null
  target_language: string
  translation_required: boolean
  last_ingested_at: string | null
  // Other canonical fields may be present; we only care about the headline status.
  [key: string]: unknown
}

export async function prewarmYoutubeUrls(urls: readonly string[]): Promise<YoutubePrewarmResponse | null> {
  if (urls.length === 0) return null
  try {
    return await apiPost<YoutubePrewarmResponse>('/ai/youtube/prewarm', { urls })
  } catch {
    return null
  }
}

export async function fetchYoutubeIngestionStatus(videoId: string): Promise<YoutubeStatusItem | null> {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null
  try {
    const response = await apiGet<{ schema_version: 1; item: YoutubeStatusItem }>(
      `/ai/youtube/ingestion/${encodeURIComponent(videoId)}`,
    )

    return response?.item ?? null
  } catch {
    return null
  }
}
