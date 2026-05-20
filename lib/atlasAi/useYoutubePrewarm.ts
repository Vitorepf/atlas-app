/**
 * Atlas AI · Mobile · useYoutubePrewarm hook.
 *
 * Detecta links YouTube no draft do composer e dispara o backend prewarm
 * em background (fire-and-forget). Quando o operador clica enviar, a
 * transcrição já está pronta — zero espera.
 *
 * Princípios:
 *   - Debounce 500ms (não dispara enquanto operador digita rápido)
 *   - Dedup local por videoId (Set ref persiste cross-render)
 *   - Silent: falha de rede/endpoint não atrapalha composer
 *   - Backend é a fonte de verdade — hook não cacheia status local
 *   - Status opcional via polling 3s (só quando explicitamente habilitado)
 *
 * Doutrina canônica: `atlas-server/docs/rich-input/youtube-canon.md`.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { diffNewVideoIds, extractYoutubeLinks, type ExtractedYoutubeLink } from './youtubePrewarm'
import {
  fetchYoutubeIngestionStatus,
  prewarmYoutubeUrls,
  type YoutubePrewarmItem,
  type YoutubeStatusItem,
} from './youtubePrewarmClient'

export interface YoutubePrewarmEntry {
  videoId: string
  canonicalUrl: string
  ingestionStatus: string
  transcriptStatus: string
  translationStatus: string
  cacheHit: boolean
  dispatched: boolean
  locked: boolean
  lastUpdatedAt: number
}

export interface UseYoutubePrewarmOptions {
  /** Debounce em ms entre mudanças do draft e disparo do POST. Default 500. */
  debounceMs?: number
  /**
   * Quando habilitado, hook chama GET status a cada N ms enquanto houver
   * vídeo em ingestion_status != 'ready' / != 'failed'. Default 0 (off).
   */
  pollStatusMs?: number
  /** Desabilita tudo (útil em modo voz, etc). Default false. */
  disabled?: boolean
}

export interface UseYoutubePrewarmResult {
  /** Estado por videoId — view-model pro composer mostrar "transcrevendo…". */
  byVideoId: Record<string, YoutubePrewarmEntry>
  /** Links YouTube atualmente detectados no draft (post-dedup). */
  links: ExtractedYoutubeLink[]
}

const TERMINAL_STATUSES = new Set(['ready', 'failed'])

export function useYoutubePrewarm(
  draft: string | null | undefined,
  options: UseYoutubePrewarmOptions = {},
): UseYoutubePrewarmResult {
  const debounceMs = options.debounceMs ?? 500
  const pollStatusMs = options.pollStatusMs ?? 0
  const disabled = options.disabled ?? false

  const [byVideoId, setByVideoId] = useState<Record<string, YoutubePrewarmEntry>>({})
  const [links, setLinks] = useState<ExtractedYoutubeLink[]>([])
  const prewarmedRef = useRef<Set<string>>(new Set())
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inFlightRef = useRef<AbortController | null>(null)

  const upsert = useCallback((items: readonly YoutubePrewarmItem[]) => {
    if (items.length === 0) return
    const now = Date.now()
    setByVideoId((current) => {
      const next = { ...current }
      for (const item of items) {
        if (!item.video_id) continue
        next[item.video_id] = {
          videoId: item.video_id,
          canonicalUrl: item.canonical_url ?? '',
          ingestionStatus: String(item.ingestion_status ?? 'unknown'),
          transcriptStatus: String(item.transcript_status ?? 'unknown'),
          translationStatus: String(item.translation_status ?? 'unknown'),
          cacheHit: Boolean(item.cache_hit),
          dispatched: Boolean(item.dispatched),
          locked: Boolean(item.locked),
          lastUpdatedAt: now,
        }
      }

      return next
    })
  }, [])

  const applyStatus = useCallback((status: YoutubeStatusItem | null) => {
    if (!status || typeof status.video_id !== 'string') return
    const now = Date.now()
    setByVideoId((current) => {
      const existing = current[status.video_id]
      return {
        ...current,
        [status.video_id]: {
          videoId: status.video_id,
          canonicalUrl: existing?.canonicalUrl ?? '',
          ingestionStatus: String(status.ingestion_status ?? 'unknown'),
          transcriptStatus: String(status.transcript_status ?? 'unknown'),
          translationStatus: String(status.translation_status ?? 'unknown'),
          cacheHit: existing?.cacheHit ?? false,
          dispatched: existing?.dispatched ?? false,
          locked: existing?.locked ?? false,
          lastUpdatedAt: now,
        },
      }
    })
  }, [])

  // Debounced draft → extract → prewarm
  useEffect(() => {
    if (disabled) return

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    const detected = extractYoutubeLinks(draft)
    setLinks(detected)
    if (detected.length === 0) return

    debounceTimerRef.current = setTimeout(() => {
      const fresh = diffNewVideoIds(detected, prewarmedRef.current)
      if (fresh.length === 0) return

      // Mark optimistically so we don't refire while in-flight.
      for (const link of fresh) prewarmedRef.current.add(link.videoId)

      inFlightRef.current?.abort()
      inFlightRef.current = new AbortController()

      void prewarmYoutubeUrls(fresh.map((l) => l.canonicalUrl)).then((response) => {
        if (!response || !response.items) return
        upsert(response.items)
      }).catch(() => {
        // Silent — see doctrine.
      })
    }, debounceMs)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [draft, debounceMs, disabled, upsert])

  // Optional polling for non-terminal videos
  useEffect(() => {
    if (disabled || pollStatusMs <= 0) return

    const stopExisting = () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
    stopExisting()

    const pending = Object.values(byVideoId)
      .filter((entry) => !TERMINAL_STATUSES.has(entry.ingestionStatus))
      .map((entry) => entry.videoId)
    if (pending.length === 0) return

    pollTimerRef.current = setInterval(() => {
      void Promise.all(pending.map((id) => fetchYoutubeIngestionStatus(id))).then((statuses) => {
        for (const status of statuses) applyStatus(status)
      })
    }, pollStatusMs)

    return stopExisting
  }, [byVideoId, pollStatusMs, disabled, applyStatus])

  // Cleanup on unmount
  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      inFlightRef.current?.abort()
    },
    [],
  )

  return { byVideoId, links }
}
