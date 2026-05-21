/**
 * Atlas Rich Input · YouTube canonical capability.
 *
 * Three independent status dimensions (never collapse them — see
 * `docs/rich-input/youtube-canon.md` on atlas-server):
 *
 *   - `ingestion_status`  → did we fetch the video record + try captions?
 *   - `transcript_status` → do we have transcript text to feed the model?
 *   - `translation_status` → if transcript is in a foreign language, did we
 *                            translate it to `target_language` (default pt-BR)?
 *
 * Honesty rule: `translated_ready` is canonical but inalcançável today —
 * no translation pipeline exists. Foreign transcripts stay
 * `translation_status='required'` until somebody implements the pipeline.
 * Never claim we translated when we only have the original transcript.
 */

/* ──────────────────────────────────────────────────────────────────────── */
/*  Status enums                                                            */
/* ──────────────────────────────────────────────────────────────────────── */

export const YOUTUBE_INGESTION_STATUSES = ['queued', 'processing', 'ready', 'failed'] as const
export type YoutubeIngestionStatus = (typeof YOUTUBE_INGESTION_STATUSES)[number]

export const YOUTUBE_TRANSCRIPT_STATUSES = [
  'unavailable',
  'pending',
  'original_ready',
  'failed',
] as const
export type YoutubeTranscriptStatus = (typeof YOUTUBE_TRANSCRIPT_STATUSES)[number]

export const YOUTUBE_TRANSLATION_STATUSES = [
  'not_required',
  'required',
  'pending',
  'translated_ready',
  'failed',
] as const
export type YoutubeTranslationStatus = (typeof YOUTUBE_TRANSLATION_STATUSES)[number]

export const YOUTUBE_DEFAULT_TARGET_LANGUAGE = 'pt-BR'

/* ──────────────────────────────────────────────────────────────────────── */
/*  URL helpers                                                             */
/* ──────────────────────────────────────────────────────────────────────── */

const YOUTUBE_VIDEO_ID = /([A-Za-z0-9_-]{11})/
const YOUTUBE_URL_PATTERNS: RegExp[] = [
  /(?:youtube\.com\/watch\?(?:[^#\s]*&)?v=)([A-Za-z0-9_-]{11})/,
  /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  /(?:youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
  /(?:m\.youtube\.com\/watch\?(?:[^#\s]*&)?v=)([A-Za-z0-9_-]{11})/,
]

export function extractYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (trimmed === '') return null
  for (const re of YOUTUBE_URL_PATTERNS) {
    const match = trimmed.match(re)
    if (match && match[1] && YOUTUBE_VIDEO_ID.test(match[1])) return match[1]
  }
  return null
}

export function isYouTubeUrl(url: string | null | undefined): boolean {
  return extractYouTubeVideoId(url) !== null
}

/**
 * Canonicalize a YouTube URL to `https://www.youtube.com/watch?v=ID` form.
 * Drops list/feature/utm params to dedup aggressively. Preserves `t=` (seek)
 * when present, normalized to `t=N` (drops trailing `s`).
 *
 * Returns `null` if the input is not a recognizable YouTube URL.
 */
export function normalizeYouTubeUrl(url: string | null | undefined): string | null {
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) return null

  let timestamp: number | null = null
  const raw = (url as string).trim()
  const tMatch = raw.match(/[?&#]t=(\d+)(?:s)?\b/)
  if (tMatch && tMatch[1]) {
    const parsed = Number(tMatch[1])
    if (Number.isFinite(parsed) && parsed > 0) timestamp = parsed
  }

  const base = `https://www.youtube.com/watch?v=${videoId}`
  return timestamp !== null ? `${base}&t=${timestamp}` : base
}

/**
 * Dedup attachments by video ID (fallback: normalized URL).
 * Preserves input order — first occurrence wins.
 */
export function dedupYouTubeAttachments<T extends { url: string; refId?: string | null }>(
  items: readonly T[],
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const key = item.refId || extractYouTubeVideoId(item.url) || normalizeYouTubeUrl(item.url) || item.url
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Language helpers                                                        */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Normalize a caption language tag (BCP-47 style) into a canonical source
 * language identifier. Preserves regional variant for languages where it
 * matters (pt-BR vs pt-PT, zh-Hans vs zh-Hant); collapses to primary subtag
 * otherwise.
 */
export function inferYouTubeSourceLanguage(
  captionLanguage: string | null | undefined,
): string | null {
  if (!captionLanguage || typeof captionLanguage !== 'string') return null
  const trimmed = captionLanguage.trim().toLowerCase().replace('_', '-')
  if (trimmed === '' || trimmed === 'und' || trimmed === 'unknown') return null

  if (trimmed === 'pt-br' || trimmed.startsWith('pt-br-')) return 'pt-BR'
  if (trimmed === 'pt-pt' || trimmed.startsWith('pt-pt-')) return 'pt-PT'
  if (trimmed === 'pt' || trimmed.startsWith('pt-')) return 'pt'
  if (trimmed === 'zh-hans' || trimmed.startsWith('zh-hans-')) return 'zh-Hans'
  if (trimmed === 'zh-hant' || trimmed.startsWith('zh-hant-')) return 'zh-Hant'

  const primary = trimmed.split('-')[0]
  return primary && /^[a-z]{2,3}$/.test(primary) ? primary : null
}

/**
 * Pure derivation: does this video need translation to the target language?
 *
 * Rules:
 *   - target unknown → false (no claim)
 *   - source unknown → false (no claim — don't fabricate need)
 *   - source equals target (case-insensitive) → false
 *   - source is any Portuguese variant when target starts with `pt` → false
 *   - otherwise → true
 */
export function deriveYouTubeTranslationRequirement(opts: {
  source_language: string | null | undefined
  target_language: string | null | undefined
}): boolean {
  const target = opts.target_language?.trim().toLowerCase()
  const source = opts.source_language?.trim().toLowerCase()
  if (!target || !source) return false
  if (source === target) return false
  if (target.startsWith('pt') && source.startsWith('pt')) return false
  return true
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Labels                                                                  */
/* ──────────────────────────────────────────────────────────────────────── */

export type YoutubeLabelLocale = 'pt-BR' | 'en'

const INGESTION_LABELS: Record<YoutubeLabelLocale, Record<YoutubeIngestionStatus, string>> = {
  'pt-BR': {
    queued: 'aguardando processamento',
    processing: 'processando',
    ready: 'ingestão pronta',
    failed: 'falha na ingestão',
  },
  en: {
    queued: 'queued',
    processing: 'processing',
    ready: 'ingestion ready',
    failed: 'ingestion failed',
  },
}

const TRANSCRIPT_LABELS: Record<YoutubeLabelLocale, Record<YoutubeTranscriptStatus, string>> = {
  'pt-BR': {
    unavailable: 'sem transcrição',
    pending: 'transcrevendo',
    original_ready: 'transcrição original pronta',
    failed: 'falha na transcrição',
  },
  en: {
    unavailable: 'no transcript',
    pending: 'transcribing',
    original_ready: 'original transcript ready',
    failed: 'transcript failed',
  },
}

const TRANSLATION_LABELS: Record<YoutubeLabelLocale, Record<YoutubeTranslationStatus, string>> = {
  'pt-BR': {
    not_required: 'tradução não necessária',
    required: 'tradução PT-BR pendente',
    pending: 'traduzindo para PT-BR',
    translated_ready: 'tradução PT-BR pronta',
    failed: 'falha na tradução',
  },
  en: {
    not_required: 'translation not required',
    required: 'translation pending',
    pending: 'translating',
    translated_ready: 'translation ready',
    failed: 'translation failed',
  },
}

function pickLocale(locale: string | undefined | null): YoutubeLabelLocale {
  if (!locale) return 'pt-BR'
  const lower = locale.toLowerCase()
  if (lower === 'en' || lower.startsWith('en-')) return 'en'
  return 'pt-BR'
}

export function youtubeIngestionStatusLabel(
  status: YoutubeIngestionStatus | string,
  locale?: string,
): string {
  const table = INGESTION_LABELS[pickLocale(locale)]
  return (table as Record<string, string>)[status] ?? humanize(status)
}

export function youtubeTranscriptStatusLabel(
  status: YoutubeTranscriptStatus | string,
  locale?: string,
): string {
  const table = TRANSCRIPT_LABELS[pickLocale(locale)]
  return (table as Record<string, string>)[status] ?? humanize(status)
}

export function youtubeTranslationStatusLabel(
  status: YoutubeTranslationStatus | string,
  locale?: string,
  opts?: { sourceLanguage?: string | null; targetLanguage?: string | null },
): string {
  const table = TRANSLATION_LABELS[pickLocale(locale)]
  const base = (table as Record<string, string>)[status] ?? humanize(status)
  if (!opts) return base
  if (status === 'required' || status === 'pending') {
    const src = opts.sourceLanguage
    const tgt = opts.targetLanguage ?? YOUTUBE_DEFAULT_TARGET_LANGUAGE
    if (src) {
      return pickLocale(locale) === 'en'
        ? `${base} (${src} → ${tgt})`
        : `${base} (de ${src} para ${tgt})`
    }
  }
  return base
}

export function youtubeBadgeText(opts?: {
  short?: boolean
  locale?: string
}): string {
  if (opts?.short) return 'YT'
  return 'YouTube'
}

function humanize(raw: string): string {
  return String(raw).replace(/[_-]+/g, ' ').trim()
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Source label (read what the backend tells us about how we got captions) */
/* ──────────────────────────────────────────────────────────────────────── */

export function youtubeSourceLabel(opts: {
  cacheHit?: boolean
  captionKind?: string | null
  metadataSource?: string | null
  audioFallbackStatus?: string | null
  ingestionStatus?: YoutubeIngestionStatus | null
  locale?: string
}): string {
  const locale = pickLocale(opts.locale)
  const isPt = locale === 'pt-BR'
  if (opts.cacheHit) return isPt ? 'YouTube · cache' : 'YouTube · cache'
  if (opts.ingestionStatus === 'processing')
    return isPt ? 'YouTube · transcrevendo' : 'YouTube · transcribing'
  if (opts.captionKind === 'whisper_audio') return 'YouTube · Whisper'
  if (opts.captionKind === 'automatic' || opts.captionKind === 'asr')
    return isPt ? 'YouTube · legenda automática' : 'YouTube · auto captions'
  if (opts.captionKind === 'manual') return isPt ? 'YouTube · legenda manual' : 'YouTube · manual captions'
  if (opts.audioFallbackStatus)
    return isPt
      ? `YouTube · áudio ${humanize(opts.audioFallbackStatus)}`
      : `YouTube · audio ${humanize(opts.audioFallbackStatus)}`
  if (opts.metadataSource?.includes('youtube_data_api'))
    return isPt ? 'YouTube · metadados oficiais' : 'YouTube · official metadata'
  return 'YouTube'
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Backend raw status → canonical 3-tuple                                  */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Map the legacy single-string `status` produced by the backend ingestion
 * service (`YouTubeKnowledgeIngestionService`) onto the canonical
 * (ingestion, transcript) pair. Translation is derived separately from
 * source/target language + transcript availability.
 *
 * Backend statuses observed in code:
 *   ready, processing, queued, processing_stale, caption_unavailable,
 *   transcript_empty, metadata_unavailable, skipped_duration,
 *   download_failed, runtime_missing, disabled, failed, caption_failed.
 */
export function deriveYouTubeStatusTuple(rawStatus: string | null | undefined): {
  ingestion: YoutubeIngestionStatus
  transcript: YoutubeTranscriptStatus
} {
  const status = (rawStatus ?? '').toLowerCase().trim()
  switch (status) {
    case 'ready':
      return { ingestion: 'ready', transcript: 'original_ready' }
    case 'queued':
      return { ingestion: 'queued', transcript: 'pending' }
    case 'processing':
      return { ingestion: 'processing', transcript: 'pending' }
    case 'processing_stale':
      return { ingestion: 'failed', transcript: 'failed' }
    case 'caption_unavailable':
    case 'transcript_empty':
    case 'skipped_duration':
    case 'disabled':
      return { ingestion: 'ready', transcript: 'unavailable' }
    case 'metadata_unavailable':
    case 'download_failed':
    case 'runtime_missing':
      return { ingestion: 'failed', transcript: 'failed' }
    case 'failed':
    case 'caption_failed':
      return { ingestion: 'failed', transcript: 'failed' }
    default:
      return { ingestion: 'failed', transcript: 'failed' }
  }
}

/**
 * Derive `translation_status` from the three known signals. NEVER returns
 * `translated_ready` from this helper alone — that value can only be set
 * by a real translation pipeline (out of scope today).
 */
export function deriveYouTubeTranslationStatus(opts: {
  transcript: YoutubeTranscriptStatus
  translationRequired: boolean
  /** Backend may signal an explicit translation status when a future pipeline lands. */
  explicit?: YoutubeTranslationStatus | string | null
}): YoutubeTranslationStatus {
  const explicit = opts.explicit
  if (explicit && (YOUTUBE_TRANSLATION_STATUSES as readonly string[]).includes(explicit)) {
    return explicit as YoutubeTranslationStatus
  }

  if (opts.transcript === 'failed') return 'failed'
  if (opts.transcript === 'unavailable') return 'not_required'
  if (opts.transcript === 'pending') return 'pending'
  if (!opts.translationRequired) return 'not_required'
  return 'required'
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Summary                                                                 */
/* ──────────────────────────────────────────────────────────────────────── */

export interface YouTubeVideoSummary {
  /** Stable key for list rendering. */
  key: string
  /** Display title — falls back to URL then to "YouTube". */
  title: string
  /** Normalized URL (from `url` field) or original if normalization fails. */
  url: string | null
  /** 11-char video id when extractable. */
  videoId: string | null
  channel: string | null
  durationSec: number | null
  thumbnailUrl: string | null

  /** The three canonical status dimensions — never collapse them. */
  ingestionStatus: YoutubeIngestionStatus
  transcriptStatus: YoutubeTranscriptStatus
  translationStatus: YoutubeTranslationStatus

  sourceLanguage: string | null
  targetLanguage: string
  translationRequired: boolean

  captionKind: 'manual' | 'automatic' | 'whisper_audio' | string | null
  cacheHit: boolean
  failureReason: string | null
  progress: number | null
  eta: number | null

  /** Legacy raw status string from the backend (preserved for compat). */
  rawStatus: string
  /** Pre-formatted humanized source label (e.g. "YouTube · Whisper"). */
  sourceLabel: string
  /** Pre-formatted humanized detail line combining the 3 statuses honestly. */
  detail: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asBool(value: unknown): boolean {
  return value === true
}

function durationToLabel(seconds: number | null, _locale: YoutubeLabelLocale): string | null {
  if (seconds == null || seconds <= 0) return null
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`
}

/**
 * Project a raw `youtube_ingestion.videos[]` entry (as emitted by the
 * backend prompt builder) into the canonical 3-status summary. Returns
 * `null` if the input is missing every identifier (no URL, no video id).
 */
export function summarizeYouTubeVideo(
  rawVideo: unknown,
  opts?: { targetLanguage?: string; locale?: string },
): YouTubeVideoSummary | null {
  const video = asRecord(rawVideo)
  if (!video) return null

  const metadata = asRecord(video.metadata)
  const caption = asRecord(video.caption)
  const fallback = asRecord(video.audio_fallback)
  const processing =
    asRecord(video.processing) ?? asRecord(asRecord(video.diagnostics)?.processing)

  const rawUrl = asString(video.url)
  const normalizedUrl = normalizeYouTubeUrl(rawUrl) ?? rawUrl
  const videoId =
    asString(video.video_id) ??
    extractYouTubeVideoId(rawUrl ?? '')
  if (!normalizedUrl && !videoId) return null

  const title = asString(metadata?.title) ?? asString(video.title) ?? normalizedUrl ?? 'YouTube'
  const channel = asString(metadata?.channel)
  const durationSec = asNumber(metadata?.duration_seconds)
  const thumbnailUrl =
    asString(metadata?.thumbnail_url) ??
    (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null)

  const rawStatus = asString(video.status) ?? 'unknown'
  const tuple = deriveYouTubeStatusTuple(rawStatus)

  // Explicit overrides — backend may already produce the canonical fields.
  const ingestionStatus =
    pickStatus<YoutubeIngestionStatus>(video.ingestion_status, YOUTUBE_INGESTION_STATUSES) ?? tuple.ingestion
  const transcriptStatus =
    pickStatus<YoutubeTranscriptStatus>(video.transcript_status, YOUTUBE_TRANSCRIPT_STATUSES) ?? tuple.transcript

  const captionLanguage = asString(caption?.language) ?? asString(video.caption_language)
  const sourceLanguage =
    asString(video.source_language) ?? inferYouTubeSourceLanguage(captionLanguage)
  const targetLanguage =
    asString(opts?.targetLanguage) ?? asString(video.target_language) ?? YOUTUBE_DEFAULT_TARGET_LANGUAGE
  const translationRequired =
    typeof video.translation_required === 'boolean'
      ? (video.translation_required as boolean)
      : deriveYouTubeTranslationRequirement({
          source_language: sourceLanguage,
          target_language: targetLanguage,
        })
  const translationStatus = deriveYouTubeTranslationStatus({
    transcript: transcriptStatus,
    translationRequired,
    explicit: asString(video.translation_status),
  })

  const captionKind =
    asString(caption?.kind) ??
    asString(video.caption_kind) ??
    null
  const cacheHit = asBool(video.cache_hit)
  const failureReason = asString(video.reason) ?? asString(video.failure_reason)
  const progress = asNumber(processing?.progress)
  const eta = asNumber(processing?.estimated_remaining_seconds)

  const locale = pickLocale(opts?.locale)
  const sourceLabel = youtubeSourceLabel({
    cacheHit,
    captionKind,
    metadataSource: asString(metadata?.metadata_source),
    audioFallbackStatus: asString(fallback?.status),
    ingestionStatus,
    locale,
  })
  const detail = buildDetailLine(
    {
      ingestionStatus,
      transcriptStatus,
      translationStatus,
      sourceLanguage,
      targetLanguage,
      translationRequired,
      channel,
      durationSec,
      eta,
      progress,
      cacheHit,
      failureReason,
    },
    locale,
  )

  const key = videoId ?? normalizedUrl ?? rawUrl ?? `youtube-${rawStatus}`
  return {
    key,
    title,
    url: normalizedUrl ?? rawUrl,
    videoId,
    channel,
    durationSec,
    thumbnailUrl,
    ingestionStatus,
    transcriptStatus,
    translationStatus,
    sourceLanguage,
    targetLanguage,
    translationRequired,
    captionKind,
    cacheHit,
    failureReason,
    progress,
    eta,
    rawStatus,
    sourceLabel,
    detail,
  }
}

function pickStatus<T extends string>(
  value: unknown,
  allowed: readonly string[],
): T | null {
  if (typeof value !== 'string') return null
  return (allowed as readonly string[]).includes(value) ? (value as T) : null
}

function buildDetailLine(
  s: {
    ingestionStatus: YoutubeIngestionStatus
    transcriptStatus: YoutubeTranscriptStatus
    translationStatus: YoutubeTranslationStatus
    sourceLanguage: string | null
    targetLanguage: string
    translationRequired: boolean
    channel: string | null
    durationSec: number | null
    eta: number | null
    progress: number | null
    cacheHit: boolean
    failureReason: string | null
  },
  locale: YoutubeLabelLocale,
): string {
  const isPt = locale === 'pt-BR'
  const parts: string[] = []

  if (s.ingestionStatus === 'failed') {
    parts.push(youtubeIngestionStatusLabel('failed', locale))
    if (s.failureReason) parts.push(s.failureReason)
    if (s.channel) parts.push(s.channel)
    return parts.join(' · ')
  }

  if (s.ingestionStatus === 'processing' || s.ingestionStatus === 'queued') {
    parts.push(youtubeIngestionStatusLabel(s.ingestionStatus, locale))
    if (s.progress != null) {
      const pct = Math.max(0, Math.min(100, Math.round(s.progress * 100)))
      parts.push(`${pct}%`)
    }
    if (s.eta != null && s.eta > 0) {
      const etaLabel = durationToLabel(s.eta, locale) ?? `${Math.round(s.eta)}s`
      parts.push(isPt ? `~${etaLabel} restantes` : `~${etaLabel} left`)
    }
    if (s.channel) parts.push(s.channel)
    return parts.join(' · ')
  }

  // ingestionStatus === 'ready'
  if (s.transcriptStatus === 'unavailable') {
    parts.push(youtubeTranscriptStatusLabel('unavailable', locale))
  } else if (s.transcriptStatus === 'failed') {
    parts.push(youtubeTranscriptStatusLabel('failed', locale))
    if (s.failureReason) parts.push(s.failureReason)
  } else if (s.transcriptStatus === 'pending') {
    parts.push(youtubeTranscriptStatusLabel('pending', locale))
  } else if (s.transcriptStatus === 'original_ready') {
    if (s.translationRequired && s.translationStatus !== 'translated_ready') {
      // Honest split: original ready in foreign language, translation pending.
      const src = s.sourceLanguage ?? (isPt ? 'idioma estrangeiro' : 'foreign language')
      parts.push(isPt
        ? `transcrição original (${src})`
        : `original transcript (${src})`)
      parts.push(youtubeTranslationStatusLabel(s.translationStatus, locale))
    } else {
      parts.push(youtubeTranscriptStatusLabel('original_ready', locale))
      if (s.translationStatus === 'translated_ready') {
        parts.push(youtubeTranslationStatusLabel('translated_ready', locale))
      }
    }
  }

  if (s.channel) parts.push(s.channel)
  const durLabel = durationToLabel(s.durationSec, locale)
  if (durLabel) parts.push(durLabel)
  if (s.cacheHit) parts.push('cache')

  return parts.join(' · ')
}
