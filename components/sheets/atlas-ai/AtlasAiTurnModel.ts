import type {
  AtlasAiAttachment,
  AtlasAiJob,
  AtlasAiQualityAction,
  AtlasAiTrace,
} from '../../../lib/api/client'
import {
  buildPinnedTraceSummary,
  isAtlasTraceActive,
  sortAtlasTraces,
} from '../../../lib/atlasAiRuntime'
import type { FeedbackAction } from './AtlasAiQualityFeedback'
import type { TurnBody } from './AtlasAiTurnBody'
import { providerWord } from './threadHistoryModel'

export interface YouTubeSourceSummary {
  key: string
  title: string
  status: string
  source: string
  detail: string
  progress?: number | null
}

export function bodyFromTrace(
  trace: AtlasAiTrace,
  onFeedback: (trace: AtlasAiTrace, action: FeedbackAction) => void,
  onRunQualityAction: (action: AtlasAiQualityAction) => void,
  onOpenExecution: (trace: AtlasAiTrace) => void,
  onTogglePin: (trace: AtlasAiTrace) => void,
  pinned: boolean,
): TurnBody {
  if (isAtlasTraceActive(trace)) {
    const streamedText = pickResponseText(trace).trim()
    if (streamedText) {
      return {
        kind: 'streaming',
        text: streamedText,
        startedAtMs: new Date(trace.created_at).getTime(),
        provider: providerWord(trace.provider),
        detail: thinkingDetail(trace),
        trace,
        onOpenExecution,
      }
    }

    return {
      kind: 'thinking',
      startedAtMs: new Date(trace.created_at).getTime(),
      provider: providerWord(trace.provider),
      detail: thinkingDetail(trace),
      trace,
      onOpenExecution,
    }
  }
  if (trace.status === 'failed') {
    const message = trace.job?.error_message?.trim() || 'a interação falhou.'
    return { kind: 'error', message }
  }
  if (trace.status === 'cancelled') {
    return { kind: 'error', message: 'cancelado.' }
  }
  return {
    kind: 'response',
    text: pickResponseText(trace) || '—',
    attribution: attribution(trace),
    trace,
    youtubeSources: youtubeSourcesFromTrace(trace),
    onFeedback,
    onRunQualityAction,
    onOpenExecution,
    onTogglePin,
    pinned,
  }
}

export function attachmentsFromTrace(trace: AtlasAiTrace): AtlasAiAttachment[] {
  if (Array.isArray(trace.attachments) && trace.attachments.length > 0) {
    return trace.attachments.filter(isAtlasAiAttachment)
  }

  const jobs = trace.jobs?.length ? trace.jobs : trace.job ? [trace.job] : []
  const attachments: AtlasAiAttachment[] = []
  for (const job of jobs) {
    attachments.push(...attachmentsFromJobPayload(job))
  }

  const seen = new Set<string>()
  return attachments.filter((attachment) => {
    if (seen.has(attachment.id)) return false
    seen.add(attachment.id)
    return true
  })
}

export function youtubeSourcesFromTrace(trace: AtlasAiTrace): YouTubeSourceSummary[] {
  const jobs = trace.jobs?.length ? trace.jobs : trace.job ? [trace.job] : []
  const sources: YouTubeSourceSummary[] = []

  for (const job of jobs) {
    const ingestion = recordValue(job.payload?.youtube_ingestion)
    const videos = Array.isArray(ingestion?.videos) ? ingestion.videos : []
    for (const item of videos) {
      const video = recordValue(item)
      if (!video) continue
      const metadata = recordValue(video.metadata)
      const caption = recordValue(video.caption)
      const fallback = recordValue(video.audio_fallback)
      const processing = recordValue(video.processing) ?? recordValue(recordValue(video.diagnostics)?.processing)
      const url = stringValue(video.url)
      const title = stringValue(metadata?.title) ?? stringValue(video.url) ?? 'YouTube'
      const status = stringValue(video.status) ?? 'unknown'
      const source = sourceLabel(
        stringValue(metadata?.metadata_source),
        stringValue(caption?.kind),
        stringValue(fallback?.status),
        Boolean(video.cache_hit),
        status,
      )
      const progress = numberValue(processing?.progress)
      const eta = numberValue(processing?.estimated_remaining_seconds)
      const detail = [
        statusLabel(status),
        stringValue(metadata?.channel),
        durationLabel(numberValue(metadata?.duration_seconds)),
        eta ? `~${durationLabel(eta) ?? `${Math.round(eta)}s`}` : null,
        Boolean(video.cache_hit) ? 'cache' : null,
      ].filter(Boolean).join(' · ')

      sources.push({
        key: url ?? `${job.id}:${sources.length}`,
        title,
        status,
        source,
        detail,
        progress,
      })
    }
  }

  const seen = new Set<string>()
  return sources.filter((source) => {
    if (seen.has(source.key)) return false
    seen.add(source.key)
    return true
  })
}

export function mergeJobIntoTrace(job: AtlasAiJob, trace: AtlasAiTrace): AtlasAiTrace {
  const jobs = trace.jobs?.length ? trace.jobs : trace.job ? [trace.job] : []
  const nextJobs = [job, ...jobs.filter((item) => item.id !== job.id)]
  const nextStatus = job.trace?.status ?? trace.status

  return {
    ...trace,
    status: nextStatus,
    job: trace.job?.id === job.id ? job : trace.job,
    jobs: nextJobs,
  }
}

export function buildConversationContext(traces: AtlasAiTrace[], threadId: string | null, pinnedTraceIds: string[] = []) {
  const completed = sortAtlasTraces(traces).filter((trace) => {
    if (isAtlasTraceActive(trace)) return false
    return trace.operator_input?.trim() || pickResponseText(trace).trim()
  })
  const pinnedSummaries = buildPinnedTraceSummary(completed, pinnedTraceIds)

  const turns = completed.slice(-4).flatMap((trace) => {
    const assistantText = pickResponseText(trace).trim()
    const userItem: Record<string, unknown> = {
      role: 'user',
      text: truncateForContext(trace.operator_input, 900),
      trace_id: trace.id,
    }
    const attachments = attachmentsFromTrace(trace).map((attachment) => ({
      id: attachment.id,
      kind: attachment.kind,
      name: attachment.name,
      mime_type: attachment.mime_type,
      bytes: attachment.bytes,
      pdf_page_count: attachment.pdf_page_count,
      pdf_processing_status: attachment.pdf_processing_status,
      pdf_render_status: attachment.pdf_render_status,
      pdf_ocr_status: attachment.pdf_ocr_status,
    }))
    if (attachments.length > 0) {
      userItem.attachments = attachments
    }

    const items: Array<Record<string, unknown>> = [userItem]

    if (assistantText) {
      items.push({
        role: 'assistant',
        text: truncateForContext(assistantText, 1600),
        provider: providerWord(trace.provider) ?? 'atlas',
        trace_id: trace.id,
      })
    }

    return items
  })

  return {
    schema_version: 1,
    source: 'atlas_ai_sheet_recent_turns',
    thread_id: threadId,
    instruction:
      'Use este contexto para resolver respostas curtas como A/B/C, "ambos", "isso", "continua" e troca de provider.',
    pinned_summaries: pinnedSummaries,
    turns,
  }
}

export function formatConversationForCopy(traces: AtlasAiTrace[]): string {
  const blocks: string[] = []
  for (const trace of traces) {
    const userText = trace.operator_input?.trim() ?? ''
    if (userText) blocks.push(`você\n${userText}`)
    const atlasText = pickResponseText(trace).trim()
    if (atlasText) blocks.push(`atlas\n${atlasText}`)
  }
  return blocks.join('\n\n')
}

export function pickResponseText(trace: AtlasAiTrace): string {
  const remediation = bestRemediationAction(trace)
  const remediationText = remediation?.remediation_trace
    ? pickRawResponseText(remediation.remediation_trace)
    : ''
  if (remediationText) return remediationText

  return pickRawResponseText(trace)
}

export function pickRawResponseText(trace: AtlasAiTrace): string {
  return (
    trace.response_text?.trim()
    || trace.job?.result_text?.trim()
    || (trace.jobs ?? [])
      .map((job) => job.result_text?.trim())
      .filter(Boolean)
      .join('\n\n')
    || ''
  )
}

export function attribution(trace: AtlasAiTrace): string {
  const remediation = bestRemediationAction(trace)
  const subject = remediation?.remediation_trace
    ? providerWord(remediation.remediation_trace.provider) ?? 'atlas'
    : providerWord(trace.provider) ?? 'atlas'
  const latency = trace.latency_ms != null ? `, em ${formatLatency(trace.latency_ms)}` : ''
  const repaired = remediation?.remediation_trace ? ' · reparado' : ''
  return `— ${subject}${latency}${repaired}.`
}

export function thinkingDetail(trace: AtlasAiTrace): string {
  const jobs = trace.jobs?.length ? trace.jobs : trace.job ? [trace.job] : []
  if (jobs.length === 0) return 'mantendo sessão e contexto ativo'

  const queued = jobs.filter((job) => job.status === 'queued').length
  const processing = jobs.filter((job) => job.status === 'processing').length
  const failed = jobs.filter((job) => job.status === 'failed').length
  const attempts = Math.max(...jobs.map((job) => job.attempts ?? 0), 0)
  const worker = jobs.find((job) => job.worker_id)?.worker_id

  return [
    queued ? `${queued} na fila` : null,
    processing ? `${processing} executando` : null,
    failed ? `${failed} falhou` : null,
    attempts ? `tentativa ${attempts}` : null,
    worker ? `worker ${worker}` : null,
  ].filter(Boolean).join(' · ') || 'orquestrando execução'
}

export function queuePhrase(job: AtlasAiJob): string {
  const availableAt = job.available_at ? new Date(job.available_at).getTime() : null
  if (availableAt && Number.isFinite(availableAt) && availableAt > Date.now()) {
    return `fila · disponível ${formatRelative(job.available_at)}`
  }
  return `fila · tentativa ${job.attempts}/${job.max_attempts}`
}

export function processingPhrase(job: AtlasAiJob): string {
  const started = job.started_at ? new Date(job.started_at).getTime() : null
  const elapsed = started && Number.isFinite(started)
    ? formatLatency(Math.max(0, Date.now() - started))
    : 'agora'
  return `executando há ${elapsed} · tentativa ${job.attempts}/${job.max_attempts}`
}

export function bestRemediationAction(trace: AtlasAiTrace): AtlasAiQualityAction | null {
  return (trace.quality_actions ?? []).find((action) => {
    if (action.status !== 'succeeded') return false
    if (!action.remediation_trace) return false
    return pickRawResponseText(action.remediation_trace).trim().length > 0
  }) ?? null
}

function attachmentsFromJobPayload(job: AtlasAiJob): AtlasAiAttachment[] {
  const payload = job.payload
  if (!payload || typeof payload !== 'object') return []
  const attachmentContainer = (payload as { attachments?: unknown }).attachments
  if (!attachmentContainer || typeof attachmentContainer !== 'object') return []
  const images = Array.isArray((attachmentContainer as { images?: unknown }).images)
    ? (attachmentContainer as { images: unknown[] }).images
    : []
  const files = Array.isArray((attachmentContainer as { files?: unknown }).files)
    ? (attachmentContainer as { files: unknown[] }).files
    : []

  return [...images, ...files].filter(isAtlasAiAttachment)
}

function isAtlasAiAttachment(value: unknown): value is AtlasAiAttachment {
  if (!value || typeof value !== 'object') return false
  const attachment = value as Partial<AtlasAiAttachment>
  return typeof attachment.id === 'string'
    && typeof attachment.name === 'string'
    && typeof attachment.kind === 'string'
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function sourceLabel(metadataSource: string | null, captionKind: string | null, fallbackStatus: string | null, cacheHit: boolean, status?: string): string {
  if (cacheHit) return 'YouTube · cache pronto'
  if (status === 'processing') return 'YouTube · transcrevendo áudio'
  if (captionKind === 'whisper_audio') return 'YouTube · Whisper'
  if (captionKind) return `YouTube · ${captionKind === 'asr' || captionKind === 'automatic' ? 'legenda automática' : 'legenda'}`
  if (fallbackStatus) return `YouTube · áudio ${statusLabel(fallbackStatus).toLowerCase()}`
  if (metadataSource?.includes('youtube_data_api')) return 'YouTube · metadados oficiais'
  return 'YouTube'
}

function durationLabel(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`
}

function statusLabel(status: string): string {
  if (status === 'ready') return 'transcrição pronta'
  if (status === 'processing' || status === 'queued') return 'processando'
  if (status === 'caption_unavailable') return 'sem legenda'
  if (status === 'transcript_empty') return 'transcrição vazia'
  if (status === 'metadata_unavailable') return 'metadados indisponíveis'
  if (status === 'skipped_duration') return 'vídeo longo'
  if (status === 'download_failed') return 'download falhou'
  if (status === 'runtime_missing') return 'runtime ausente'
  if (status === 'disabled') return 'desativado'
  if (status === 'failed' || status === 'caption_failed') return 'falhou'
  return status.replace(/[_-]+/g, ' ')
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`
  return `${Math.round(seconds / 60)} min`
}

function truncateForContext(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function formatRelative(value: string | null | undefined): string {
  if (!value) return 'agora'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const diff = Date.now() - date.getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h`
  const days = Math.round(hours / 24)
  return `${days} d`
}
