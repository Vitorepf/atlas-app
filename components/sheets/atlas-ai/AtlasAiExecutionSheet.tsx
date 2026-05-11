import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Frau, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import type {
  AtlasAiJob,
  AtlasAiQualityAction,
  AtlasAiQualityEvaluation,
  AtlasAiTrace,
} from '../../../lib/api/client'
import { CaptionWhisper } from '../../console/CaptionWhisper'
import { BottomSheet } from '../BottomSheet'
import {
  DataList,
  DataRow,
  DataSection,
  EmptyInline,
  SheetHeading,
  StatusPill,
} from './AtlasAiDataPrimitives'
import { providerWord } from './threadHistoryModel'

export function ExecutionSheet({
  visible,
  trace,
  loading,
  onClose,
  onRefresh,
  onRunQualityAction,
  onRetryJob,
  onCancelJob,
}: {
  visible: boolean
  trace: AtlasAiTrace | null
  loading: boolean
  onClose: () => void
  onRefresh: (trace: AtlasAiTrace) => void
  onRunQualityAction: (action: AtlasAiQualityAction) => void
  onRetryJob: (job: AtlasAiJob) => void
  onCancelJob: (job: AtlasAiJob) => void
}) {
  const { c } = useTheme()
  const jobs = trace ? trace.jobs?.length ? trace.jobs : trace.job ? [trace.job] : [] : []
  const quality = trace?.quality_evaluation ?? null
  const actions = trace?.quality_actions ?? []
  const artifacts = executionArtifacts(trace, jobs)
  const decisionReceipt = trace?.decision_receipt ?? null
  const openBrain = openBrainInjectionFromTrace(trace)

  return (
    <BottomSheet visible={visible} onClose={onClose} height="85%">
      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        <SheetHeading
          title="Execução"
          subtitle={trace ? `${providerWord(trace.provider) ?? 'atlas'} · ${trace.agent_slug}` : 'nenhum trace selecionado'}
        />

        {trace && (
          <View style={styles.inlineActions}>
            <SheetAction
              label={loading ? 'atualizando' : 'atualizar'}
              onPress={() => onRefresh(trace)}
              disabled={loading}
            />
          </View>
        )}

        {!trace ? (
          <EmptyInline text="selecione uma resposta para ver execução" />
        ) : (
          <>
            <DataSection title="trace">
              <DataRow label="status" value={trace.status} />
              <DataRow label="id" value={shortId(trace.id)} />
              <DataRow label="provider" value={providerWord(trace.provider) ?? String(trace.provider ?? 'atlas')} />
              <DataRow label="agent" value={trace.agent_slug} />
              <DataRow label="latência" value={trace.latency_ms != null ? formatLatency(trace.latency_ms) : 'n/a'} />
              <DataRow label="criado" value={formatRelative(trace.created_at)} />
            </DataSection>

            {openBrain && (
              <DataSection title="open brain">
                <DataRow label="status" value={openBrainStatusLabel(openBrain.status)} />
                <DataRow label="surface" value={openBrain.surface ?? 'n/a'} />
                <DataRow label="refs" value={String(openBrain.refs ?? 0)} />
                <DataRow label="hash" value={openBrain.hash ? shortId(openBrain.hash) : 'n/a'} />
                <DataRow label="audit" value={openBrain.auditId ? shortId(openBrain.auditId) : 'n/a'} />
                <DataRow label="avisos" value={openBrain.warnings.length > 0 ? openBrain.warnings.join(' · ') : 'nenhum'} />
              </DataSection>
            )}

            {decisionReceipt && (
              <DataSection title="decisão Atlas">
                <DataRow label="modo" value={decisionModeLabel(decisionReceipt.decision_mode)} />
                <DataRow label="selecionado" value={providerWord(decisionReceipt.selected_provider) ?? String(decisionReceipt.selected_provider ?? 'atlas')} />
                <DataRow label="pedido" value={decisionReceipt.was_overridden ? (providerWord(decisionReceipt.requested_provider) ?? String(decisionReceipt.requested_provider ?? 'manual')) : 'atlas decide'} />
                <DataRow label="override" value={decisionReceipt.was_overridden ? 'sim' : 'não'} />
                {decisionReceipt.context_strategy && (
                  <DataRow label="contexto" value={String(decisionReceipt.context_strategy).replaceAll('_', ' ')} />
                )}
                {decisionReceipt.execution_strategy && (
                  <DataRow label="execução" value={String(decisionReceipt.execution_strategy).replaceAll('_', ' ')} />
                )}
                {decisionReceipt.fallback_provider && (
                  <DataRow label="fallback" value={providerWord(decisionReceipt.fallback_provider) ?? String(decisionReceipt.fallback_provider)} />
                )}
                {decisionReceipt.reason && (
                  <Sans size={12} lineHeight={17} color={c.ink2}>
                    {decisionReceipt.reason}
                  </Sans>
                )}
              </DataSection>
            )}

            <DataSection title="artifacts dev">
              <DataList label="arquivos" items={artifacts.files} />
              <DataList label="comandos" items={artifacts.commands} />
              <DataList label="testes" items={artifacts.tests} />
              <DataList label="erros" items={artifacts.errors} />
              <DataList label="diffs" items={artifacts.diffs} />
            </DataSection>

            <DataSection title="jobs">
              {jobs.length === 0 ? (
                <EmptyInline text="nenhum job carregado" />
              ) : jobs.map((job) => (
                <View key={job.id} style={[styles.executionRow, { borderTopColor: c.border }]}>
                  <View style={styles.rowSplit}>
                    <Sans weight="med" size={13} lineHeight={18} color={c.ink}>
                      {providerWord(job.provider) ?? job.provider ?? 'atlas'}
                    </Sans>
                    <StatusPill status={job.status} />
                  </View>
                  <CaptionWhisper
                    text={`${job.kind} · tentativa ${job.attempts}/${job.max_attempts} · ${job.worker_id ?? 'sem worker'}`}
                  />
                  <View style={styles.inlineActions}>
                    {(job.status === 'failed' || job.status === 'cancelled') && (
                      <SheetAction
                        label="retry"
                        onPress={() => onRetryJob(job)}
                      />
                    )}
                    {(job.status === 'queued' || job.status === 'processing') && (
                      <SheetAction
                        label="cancelar"
                        onPress={() => onCancelJob(job)}
                      />
                    )}
                  </View>
                  <DataRow label="início" value={job.started_at ? formatRelative(job.started_at) : 'n/a'} />
                  <DataRow label="fim" value={job.finished_at ? formatRelative(job.finished_at) : 'n/a'} />
                  {job.error_message && (
                    <Sans size={12} lineHeight={17} color={c.recRed}>
                      {job.error_message}
                    </Sans>
                  )}
                  {job.result_text && (
                    <Sans size={12} lineHeight={17} color={c.ink2}>
                      {truncateForDisplay(job.result_text, 260)}
                    </Sans>
                  )}
                  {(job.attempt_history ?? []).map((attempt) => (
                    <View key={attempt.id} style={styles.attemptLine}>
                      <Sans size={11} lineHeight={16} color={c.ink2}>
                        tentativa {attempt.attempt_number} · {attempt.status} · {attempt.duration_ms ? formatLatency(attempt.duration_ms) : 'n/a'}
                      </Sans>
                    </View>
                  ))}
                </View>
              ))}
            </DataSection>

            <DataSection title="qualidade">
              {quality ? (
                <>
                  <DataRow label="score" value={`${quality.score}/100`} />
                  <DataRow label="status" value={qualityStatusLabel(quality.status)} />
                  <DataRow label="flags" value={qualityFlagCodes(quality).join(' · ') || 'sem flags'} />
                </>
              ) : (
                <EmptyInline text="sem avaliação carregada" />
              )}
            </DataSection>

            <DataSection title="ações">
              {actions.length === 0 ? (
                <EmptyInline text="sem ações corretivas" />
              ) : actions.map((action) => (
                <View key={action.id} style={[styles.executionRow, { borderTopColor: c.border }]}>
                  <View style={styles.rowSplit}>
                    <Sans weight="med" size={13} lineHeight={18} color={c.ink}>
                      {action.action_type.replace(/_/g, ' ')}
                    </Sans>
                    <StatusPill status={action.status} />
                  </View>
                  <CaptionWhisper text={action.reason} />
                  <View style={styles.inlineActions}>
                    <SheetAction
                      label={qualityActionLabel(action)}
                      onPress={() => onRunQualityAction(action)}
                      disabled={!canRunQualityAction(action)}
                    />
                  </View>
                </View>
              ))}
            </DataSection>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  )
}

function SheetAction({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.microAction,
        {
          borderColor: active ? c.bronze : c.border,
          opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Frau italic size={12} lineHeight={16} color={active ? c.bronze : c.ink2}>
        {label}
      </Frau>
    </Pressable>
  )
}

function executionArtifacts(trace: AtlasAiTrace | null, jobs: AtlasAiJob[]) {
  const roots = [
    trace?.metadata,
    trace?.context_refs,
    trace?.skill_versions,
    ...jobs.flatMap((job) => [job.payload, job.metadata, job.result_json, job.result_text, job.error_message]),
  ].filter((item) => item != null)

  return {
    files: collectArtifactStrings(roots, ['file', 'files', 'path', 'paths', 'changed_file', 'changed_files']),
    commands: collectArtifactStrings(roots, ['command', 'commands', 'cmd', 'shell', 'verification_command']),
    tests: collectArtifactStrings(roots, ['test', 'tests', 'verification', 'typecheck', 'pint']),
    errors: collectArtifactStrings(roots, ['error', 'errors', 'stderr', 'error_message']),
    diffs: collectArtifactStrings(roots, ['diff', 'patch', 'changed']),
  }
}

function collectArtifactStrings(roots: unknown[], keys: string[]): string[] {
  const found: string[] = []
  const keySet = new Set(keys.map((key) => key.toLowerCase()))

  const visit = (value: unknown, keyHint?: string, depth = 0): void => {
    if (depth > 5 || found.length >= 8 || value == null) return

    const hint = keyHint?.toLowerCase() ?? ''
    const matched = [...keySet].some((key) => hint.includes(key))

    if (typeof value === 'string') {
      if (matched || looksLikeArtifact(value, keySet)) found.push(truncateForDisplay(value, 220))
      return
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      if (matched) found.push(String(value))
      return
    }

    if (Array.isArray(value)) {
      for (const item of value) visit(item, keyHint, depth + 1)
      return
    }

    if (typeof value === 'object') {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        visit(nested, key, depth + 1)
      }
    }
  }

  for (const root of roots) visit(root)

  return [...new Set(found)].slice(0, 8)
}

function looksLikeArtifact(value: string, keySet: Set<string>): boolean {
  const lower = value.toLowerCase()
  if (keySet.has('path') || keySet.has('file')) {
    if (lower.includes('/users/') || lower.includes('.tsx') || lower.includes('.php') || lower.includes('.ts')) return true
  }
  if (keySet.has('command') || keySet.has('cmd')) {
    if (lower.startsWith('npm ') || lower.startsWith('php ') || lower.startsWith('git ') || lower.startsWith('composer ')) return true
  }
  if (keySet.has('error') || keySet.has('stderr')) {
    if (lower.includes('error') || lower.includes('failed') || lower.includes('exception')) return true
  }
  return false
}

function qualityFlagCodes(evaluation?: AtlasAiQualityEvaluation | null): string[] {
  const flags = evaluation?.flags
  if (!Array.isArray(flags)) return []
  return flags.map((flag) => {
    const code = (flag as { code?: unknown })?.code
    return typeof code === 'string' ? code : null
  }).filter((code): code is string => Boolean(code))
}

function qualityStatusLabel(status: string): string {
  if (status === 'passed') return 'aprovado'
  if (status === 'needs_review') return 'revisar'
  if (status === 'failed') return 'falhou'
  return status
}

function qualityActionLabel(action: AtlasAiQualityAction): string {
  if (action.status === 'queued') return 'correção na fila'
  if (action.status === 'running') return 'corrigindo'
  if (action.status === 'failed') return 'repetir correção'
  if (action.status === 'blocked') return 'corrigir'
  return action.action_type.replace(/_/g, ' ')
}

function canRunQualityAction(action: AtlasAiQualityAction): boolean {
  return action.status === 'queued' || action.status === 'failed'
}

function decisionModeLabel(mode: unknown): string {
  if (mode === 'manual_override') return 'override manual'
  if (mode === 'atlas_decide') return 'atlas decide'
  return typeof mode === 'string' && mode.trim() ? mode : 'atlas decide'
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

function humanizeRuntimeKey(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase())
}

function truncateForDisplay(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function shortId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`
}

function formatLatency(ms: number): string {
  if (!Number.isFinite(ms)) return 'n/a'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`
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

const styles = StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 40,
  },
  executionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    gap: 7,
  },
  rowSplit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  attemptLine: {
    paddingTop: 4,
  },
  microAction: {
    minHeight: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
