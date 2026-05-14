import { Pressable, StyleSheet, View } from 'react-native'
import { Frau, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import type {
  AtlasAiJob,
  AtlasAiQualityAction,
  AtlasAiTrace,
} from '../../../lib/api/client'
import { CaptionWhisper } from '../../console/CaptionWhisper'
import { PageResponse } from '../../console/PageResponse'
import { ThinkingState } from '../../console/ThinkingState'
import { StatusPill } from './AtlasAiDataPrimitives'
import {
  FeedbackButton,
  FeedbackRow,
  QualityBar,
  type FeedbackAction,
} from './AtlasAiQualityFeedback'
import {
  processingPhrase,
  queuePhrase,
  type YouTubeSourceSummary,
} from './AtlasAiTurnModel'
import { providerWord } from './threadHistoryModel'

export type TurnBody =
  | {
      kind: 'thinking'
      startedAtMs: number
      provider?: string
      detail?: string
      trace?: AtlasAiTrace
      onOpenExecution?: (trace: AtlasAiTrace) => void
    }
  | {
      kind: 'response'
      text: string
      attribution: string
      trace: AtlasAiTrace
      youtubeSources?: YouTubeSourceSummary[]
      onFeedback: (trace: AtlasAiTrace, action: FeedbackAction) => void
      onRunQualityAction: (action: AtlasAiQualityAction) => void
      onOpenExecution: (trace: AtlasAiTrace) => void
      onTogglePin: (trace: AtlasAiTrace) => void
      pinned: boolean
    }
  | {
      kind: 'streaming'
      text: string
      startedAtMs: number
      provider?: string
      detail?: string
      trace?: AtlasAiTrace
      onOpenExecution?: (trace: AtlasAiTrace) => void
    }
  | { kind: 'error'; message: string; onRetry?: () => void }

export function TurnBodyView({ body, onCopyResponse }: { body: TurnBody; onCopyResponse: (text: string) => void }) {
  if (body.kind === 'streaming') {
    return (
      <>
        <Pressable
          onLongPress={() => onCopyResponse(body.text)}
          delayLongPress={380}
          style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
          accessibilityRole="button"
          accessibilityLabel="copiar resposta parcial do atlas"
          accessibilityHint="pressionar e segurar copia o texto já recebido"
        >
          <PageResponse text={body.text} />
        </Pressable>
        <ThinkingState startedAtMs={body.startedAtMs} provider={body.provider} />
        {body.detail && <CaptionWhisper text={body.detail} />}
        {body.trace && <TraceProgress trace={body.trace} />}
        {body.trace && body.onOpenExecution && (
          <View style={styles.feedbackRow}>
            <FeedbackButton
              label="execução"
              onPress={() => body.onOpenExecution?.(body.trace as AtlasAiTrace)}
            />
          </View>
        )}
      </>
    )
  }
  if (body.kind === 'thinking') {
    return (
      <>
        <ThinkingState startedAtMs={body.startedAtMs} provider={body.provider} />
        {body.detail && <CaptionWhisper text={body.detail} />}
        {body.trace && <TraceProgress trace={body.trace} />}
        {body.trace && body.onOpenExecution && (
          <View style={styles.feedbackRow}>
            <FeedbackButton
              label="execução"
              onPress={() => body.onOpenExecution?.(body.trace as AtlasAiTrace)}
            />
          </View>
        )}
      </>
    )
  }
  if (body.kind === 'error') {
    return <RetryRow message={body.message} onRetry={body.onRetry} />
  }
  return (
    <>
      <Pressable
        onLongPress={() => onCopyResponse(body.text)}
        delayLongPress={380}
        style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
        accessibilityRole="button"
        accessibilityLabel="copiar resposta do atlas"
        accessibilityHint="pressionar e segurar copia o texto da resposta"
      >
        <PageResponse text={body.text} />
      </Pressable>
      <CaptionWhisper text={body.attribution} />
      <YouTubeSourceBadge sources={body.youtubeSources ?? []} />
      <OpenBrainTraceBadge trace={body.trace} />
      <QualityBar
        trace={body.trace}
        onRunQualityAction={body.onRunQualityAction}
      />
      <View style={styles.feedbackRow}>
        <FeedbackButton
          label={body.pinned ? 'fixado' : 'fixar'}
          active={body.pinned}
          onPress={() => body.onTogglePin(body.trace)}
        />
        <FeedbackButton
          label="execução"
          onPress={() => body.onOpenExecution(body.trace)}
        />
      </View>
      <FeedbackRow trace={body.trace} onFeedback={body.onFeedback} />
    </>
  )
}

function YouTubeSourceBadge({ sources }: { sources: YouTubeSourceSummary[] }) {
  const { c } = useTheme()
  if (sources.length === 0) return null

  const ready = sources.filter((source) => source.status === 'ready').length
  const color = ready > 0 ? c.moss : c.bronze
  const primary = sources[0]
  const extra = sources.length > 1 ? ` +${sources.length - 1}` : ''

  return (
    <View style={[styles.youtubeBadge, { borderTopColor: c.border }]}>
      <View style={[styles.youtubeDot, { backgroundColor: color }]} />
      <View style={styles.youtubeText}>
        <Sans weight="med" size={11} lineHeight={16} color={color}>
          {primary.source}{extra}
        </Sans>
        <Sans size={11} lineHeight={16} color={c.ink2} numberOfLines={2}>
          {primary.detail ? `${primary.detail} · ${primary.title}` : primary.title}
        </Sans>
        {primary.status === 'processing' && typeof primary.progress === 'number' ? (
          <View style={[styles.youtubeProgressTrack, { backgroundColor: c.border }]}>
            <View
              style={[
                styles.youtubeProgressFill,
                {
                  backgroundColor: color,
                  width: `${Math.max(8, Math.min(88, primary.progress * 100))}%`,
                },
              ]}
            />
          </View>
        ) : null}
      </View>
    </View>
  )
}

function RetryRow({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { c } = useTheme()
  return (
    <Pressable
      onPress={onRetry}
      disabled={!onRetry}
      hitSlop={8}
      style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1, paddingVertical: 8 })}
      accessibilityRole="button"
      accessibilityLabel="tentar novamente"
    >
      <Frau italic size={14} lineHeight={20} color={c.recRed}>
        × {message}
        {onRetry ? '  — tocar para tentar' : ''}
      </Frau>
    </Pressable>
  )
}

function TraceProgress({ trace }: { trace: AtlasAiTrace }) {
  const { c } = useTheme()
  const jobs = trace.jobs?.length ? trace.jobs : trace.job ? [trace.job] : []
  if (jobs.length === 0) return null

  return (
    <View style={[styles.progressBox, { borderTopColor: c.border }]}>
      {jobs.map((job) => (
        <View key={job.id} style={styles.progressRow}>
          <View style={styles.progressMain}>
            <Sans weight="med" size={12} lineHeight={17} color={c.ink}>
              {providerWord(job.provider) ?? job.provider ?? 'atlas'}
            </Sans>
            <Sans size={11} lineHeight={16} color={c.ink2}>
              {job.status === 'queued'
                ? queuePhrase(job)
                : job.status === 'processing'
                  ? processingPhrase(job)
                  : statusLabel(job.status)}
            </Sans>
          </View>
          <StatusPill status={job.status} />
        </View>
      ))}
    </View>
  )
}

function OpenBrainTraceBadge({ trace }: { trace: AtlasAiTrace }) {
  const { c } = useTheme()
  const openBrain = openBrainInjectionFromTrace(trace)

  if (!openBrain || openBrain.status === 'skipped') return null

  const color = openBrainStatusColor(openBrain.status, c)
  const parts = [
    openBrain.refs != null ? `${openBrain.refs} refs` : null,
    openBrain.hash ? `hash ${shortId(openBrain.hash)}` : null,
    openBrain.warnings.length > 0 ? `${openBrain.warnings.length} aviso${openBrain.warnings.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean)

  return (
    <View style={[styles.openBrainBadge, { borderTopColor: c.border }]}>
      <View style={[styles.openBrainDot, { backgroundColor: color }]} />
      <Sans weight="med" size={11} lineHeight={16} color={color}>
        Open Brain {openBrainStatusLabel(openBrain.status)}
      </Sans>
      {parts.length > 0 && (
        <Sans size={11} lineHeight={16} color={c.ink2} style={styles.openBrainText}>
          {parts.join(' · ')}
        </Sans>
      )}
    </View>
  )
}

interface OpenBrainTraceMetadata {
  status: string
  surface: string | null
  hash: string | null
  auditId: string | null
  refs: number | null
  warnings: string[]
}

function openBrainInjectionFromTrace(trace: AtlasAiTrace | null): OpenBrainTraceMetadata | null {
  if (!trace) return null

  const traceInjection = metadataRecord(trace.metadata ?? {}, 'open_brain_injection')
  const jobInjection = trace.job ? metadataRecord(trace.job.metadata ?? {}, 'open_brain_injection') : null
  const source = traceInjection ?? jobInjection
  const status = stringFromRecord(source, 'status')

  if (!source || !status) return null

  const summary = metadataRecord(source, 'summary') ?? {}
  const warningsRaw = source.warnings
  const warnings = Array.isArray(warningsRaw)
    ? warningsRaw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []

  return {
    status,
    surface: stringFromRecord(source, 'surface'),
    hash: stringFromRecord(source, 'context_pack_hash'),
    auditId: stringFromRecord(source, 'audit_id'),
    refs: numberFromRecord(summary, 'context_refs'),
    warnings,
  }
}

function openBrainStatusLabel(status: string): string {
  if (status === 'injected') return 'usado'
  if (status === 'degraded') return 'parcial'
  if (status === 'failed_open') return 'falhou aberto'
  if (status === 'failed_closed') return 'bloqueado'
  if (status === 'skipped') return 'ignorado'
  return humanizeRuntimeKey(status).toLowerCase()
}

function openBrainStatusColor(status: string, c: ReturnType<typeof useTheme>['c']): string {
  if (status === 'injected') return c.moss
  if (status === 'degraded') return c.bronze
  if (status === 'failed_open' || status === 'failed_closed') return c.recRed
  return c.ink2
}

function metadataRecord(metadata: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> | null {
  const value = metadata?.[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function stringFromRecord(value: unknown, key: string): string | null {
  if (!value || typeof value !== 'object') return null
  const next = (value as Record<string, unknown>)[key]
  return typeof next === 'string' && next.trim().length > 0 ? next.trim() : null
}

function numberFromRecord(value: unknown, key: string): number | null {
  if (!value || typeof value !== 'object') return null
  const next = (value as Record<string, unknown>)[key]
  return typeof next === 'number' && Number.isFinite(next) ? next : null
}

function statusLabel(status: string): string {
  if (status === 'queued') return 'fila'
  if (status === 'processing' || status === 'running') return 'rodando'
  if (status === 'succeeded' || status === 'online' || status === 'passed') return 'ok'
  if (status === 'failed' || status === 'offline') return 'falhou'
  if (status === 'needs_review') return 'revisar'
  if (status === 'blocked') return 'bloqueado'
  if (status === 'degraded') return 'degradado'
  return status
}

function shortId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`
}

function humanizeRuntimeKey(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase())
}

const styles = StyleSheet.create({
  feedbackRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  progressBox: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressMain: {
    flex: 1,
    gap: 1,
  },
  openBrainBadge: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  openBrainDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  openBrainText: {
    flexShrink: 1,
  },
  youtubeBadge: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  youtubeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
  },
  youtubeText: {
    flex: 1,
    gap: 1,
  },
  youtubeProgressTrack: {
    marginTop: 4,
    height: 2,
    width: '100%',
    overflow: 'hidden',
  },
  youtubeProgressFill: {
    height: 2,
  },
})
