/**
 * Atlas Rich Input · URL detector + oEmbed metadata fetcher.
 *
 * Covers 4 families: YouTube, Vimeo, GitHub, generic web. For each one we try
 * to enrich with title/author/thumbnail/duration via public oEmbed (no API
 * key required). On network failure or timeout we fall back to 'generic'
 * with only the parsed URL.
 *
 * Uses `globalThis.setTimeout` / `globalThis.clearTimeout` to work both on
 * browser (web/Tauri) and React Native (≥ 0.65). `AbortController` and
 * `fetch` are universal in the same target range.
 */

export type DetectedUrlKind = 'youtube' | 'vimeo' | 'github' | 'generic'

export interface DetectedUrl {
  url: string
  kind: DetectedUrlKind
  /** Resource ID (videoId, repo slug, …) — when applicable */
  refId: string | null
}

export interface UrlMetadata {
  title: string | null
  author: string | null
  thumbnailUrl: string | null
  durationSec: number | null
}

const URL_REGEX = /\bhttps?:\/\/[^\s<>"')]+/gi

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX) ?? []
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of matches) {
    if (!seen.has(u)) {
      seen.add(u)
      out.push(u)
    }
  }
  return out
}

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
  /youtube\.com\/live\/([A-Za-z0-9_-]{11})/,
]

const VIMEO_PATTERN = /vimeo\.com\/(?:video\/|channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)/

const GITHUB_PATTERN = /github\.com\/([^/]+)\/([^/?#]+)/

export function classifyUrl(raw: string): DetectedUrl {
  const url = raw.trim()
  for (const re of YOUTUBE_PATTERNS) {
    const m = url.match(re)
    if (m) return { url, kind: 'youtube', refId: m[1] ?? null }
  }
  const v = url.match(VIMEO_PATTERN)
  if (v) return { url, kind: 'vimeo', refId: v[1] ?? null }
  const g = url.match(GITHUB_PATTERN)
  if (g) return { url, kind: 'github', refId: `${g[1]}/${g[2]?.replace(/\.git$/, '')}` }
  return { url, kind: 'generic', refId: null }
}

async function fetchJson<T>(url: string, timeoutMs = 4000): Promise<T | null> {
  try {
    const ctrl = new AbortController()
    const t = globalThis.setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { signal: ctrl.signal })
    globalThis.clearTimeout(t)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

interface YoutubeOembed {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

interface VimeoOembed {
  title?: string
  author_name?: string
  thumbnail_url?: string
  duration?: number
}

interface GithubRepo {
  full_name?: string
  description?: string
  owner?: { login?: string; avatar_url?: string }
}

export async function fetchUrlMetadata(detected: DetectedUrl): Promise<UrlMetadata> {
  if (detected.kind === 'youtube' && detected.refId) {
    const oe = await fetchJson<YoutubeOembed>(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(detected.url)}`,
    )
    if (oe?.title) {
      return {
        title: oe.title ?? null,
        author: oe.author_name ?? null,
        thumbnailUrl:
          oe.thumbnail_url ?? `https://img.youtube.com/vi/${detected.refId}/hqdefault.jpg`,
        durationSec: null,
      }
    }
    return {
      title: null,
      author: null,
      thumbnailUrl: `https://img.youtube.com/vi/${detected.refId}/hqdefault.jpg`,
      durationSec: null,
    }
  }

  if (detected.kind === 'vimeo' && detected.refId) {
    const oe = await fetchJson<VimeoOembed>(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(detected.url)}`,
    )
    if (oe?.title) {
      return {
        title: oe.title ?? null,
        author: oe.author_name ?? null,
        thumbnailUrl: oe.thumbnail_url ?? null,
        durationSec: typeof oe.duration === 'number' ? oe.duration : null,
      }
    }
  }

  if (detected.kind === 'github' && detected.refId) {
    const repo = await fetchJson<GithubRepo>(`https://api.github.com/repos/${detected.refId}`)
    if (repo?.full_name) {
      return {
        title: repo.description?.trim() ? `${repo.full_name} · ${repo.description}` : repo.full_name,
        author: repo.owner?.login ?? null,
        thumbnailUrl: repo.owner?.avatar_url ?? null,
        durationSec: null,
      }
    }
  }

  return { title: null, author: null, thumbnailUrl: null, durationSec: null }
}
