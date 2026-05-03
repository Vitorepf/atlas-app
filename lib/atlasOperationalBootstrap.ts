import type { AtlasAiStatus, AtlasAiThread, AtlasAiTrace } from './api/client'

export type OperationalBootstrapStatus = AtlasAiStatus | 'ready' | 'skipped' | 'retrying'

export interface OperationalBootstrapData {
  status: OperationalBootstrapStatus
  title: string
  summary: string
  traceId: string | null
  responsePreview: string | null
  steps: OperationalBootstrapStep[]
}

export interface OperationalBootstrapStep {
  key: string
  label: string
  state: 'done' | 'active' | 'pending' | 'failed'
}

export function operationalBootstrapStatus(
  thread: AtlasAiThread | null,
  traces: AtlasAiTrace[],
): OperationalBootstrapData | null {
  if (!thread || !isOperationalContextThread(thread)) return null

  const metadata = thread.metadata ?? {}
  const metadataTraceId = metadataString(metadata, 'discussion_bootstrap_trace_id')
  const metadataStatus = normalizeOperationalBootstrapStatus(metadataString(metadata, 'discussion_bootstrap_status'))
  const metadataError = metadataString(metadata, 'discussion_bootstrap_error')
  const bootstrapTrace = traces.find((trace) => {
    return isDiscussionBootstrapTrace(trace) || (metadataTraceId != null && trace.id === metadataTraceId)
  }) ?? null

  if (!bootstrapTrace) {
    return operationalBootstrapStatusFromMetadata(metadataStatus, metadataTraceId, metadataError)
  }

  if (bootstrapTrace.status === 'queued' || bootstrapTrace.status === 'processing') {
    return {
      status: bootstrapTrace.status,
      title: 'Preparando diagnóstico operacional',
      summary: 'O contexto do Inbox já foi enviado; evidências, risco e próximas ações estão sendo preparados.',
      traceId: bootstrapTrace.id,
      responsePreview: null,
      steps: operationalBootstrapSteps(bootstrapTrace.status, false),
    }
  }

  if (bootstrapTrace.status === 'failed' || bootstrapTrace.status === 'cancelled') {
    return {
      status: bootstrapTrace.status,
      title: 'Diagnóstico inicial não completou',
      summary: 'O contexto continua preso à conversa. Tente novamente ou envie uma mensagem para o Atlas continuar a análise.',
      traceId: bootstrapTrace.id,
      responsePreview: null,
      steps: operationalBootstrapSteps(bootstrapTrace.status, false),
    }
  }

  const preview = bootstrapResponseText(bootstrapTrace).trim()

  return {
    status: bootstrapTrace.status,
    title: 'Diagnóstico inicial pronto',
    summary: 'O Atlas já analisou o alerta antes da sua primeira mensagem nesta conversa.',
    traceId: bootstrapTrace.id,
    responsePreview: preview ? truncateForContext(preview, 360) : null,
    steps: operationalBootstrapSteps(bootstrapTrace.status, preview.length > 0),
  }
}

export function isOperationalContextThread(thread: AtlasAiThread | null): boolean {
  const metadata = thread?.metadata ?? {}

  return metadataString(metadata, 'capability_profile') === 'mobile_operational_read'
    || metadataString(metadata, 'capability_profile') === 'atlas_full_access'
    || metadataString(metadata, 'source_type') === 'ai_inbox_item'
    || thread?.source_type === 'inbox_item'
}

export function inboxItemIdFromThread(thread: AtlasAiThread | null): string | null {
  const metadata = thread?.metadata ?? {}

  return metadataString(metadata, 'inbox_item_id')
    ?? metadataString(metadata, 'source_id')
    ?? (thread?.source_type === 'inbox_item' || thread?.source_type === 'ai_inbox_item' ? thread.source_id : null)
}

export function isDiscussionBootstrapTrace(trace: AtlasAiTrace): boolean {
  const metadata = trace.metadata ?? {}
  const clientId = metadataString(metadata, 'client_id') ?? metadataString(metadata, 'clientId')
  const bootstrap = metadata.discussion_bootstrap
  const bootstrapSource = bootstrap && typeof bootstrap === 'object'
    ? metadataString(bootstrap as Record<string, unknown>, 'source')
    : null

  return clientId?.startsWith('inbox-discuss-bootstrap-') === true
    || bootstrapSource === 'inbox_discuss_action'
    || trace.operator_input.includes('Analise este item operacional do Inbox')
}

export function bootstrapStatusLabel(status: OperationalBootstrapData['status']): string {
  if (status === 'queued') return 'fila'
  if (status === 'processing') return 'rodando'
  if (status === 'retrying') return 'tentando'
  if (status === 'failed') return 'falhou'
  if (status === 'skipped') return 'indisponível'
  if (status === 'cancelled') return 'cancelado'
  if (status === 'awaiting_user_choice') return 'pausado'
  return 'pronto'
}

export function normalizeOperationalBootstrapStatus(value: string | null): OperationalBootstrapStatus | null {
  if (!value) return null
  if (
    value === 'ready'
    || value === 'skipped'
    || value === 'queued'
    || value === 'processing'
    || value === 'retrying'
    || value === 'succeeded'
    || value === 'failed'
    || value === 'cancelled'
    || value === 'awaiting_user_choice'
  ) {
    return value
  }

  if (value === 'already_queued') return 'queued'
  return null
}

export function bootstrapRetryResultMessage(status: string | null, reason: string | null = null): string {
  if (status === 'queued' || status === 'retrying') {
    return 'Bootstrap operacional reenviado'
  }

  if (status === 'already_queued' || status === 'processing') {
    return 'Diagnostico operacional ja esta em andamento'
  }

  if (status === 'succeeded' || status === 'awaiting_user_choice') {
    return 'Diagnostico operacional pronto'
  }

  if (status === 'failed' || status === 'skipped' || status === 'cancelled') {
    return reason
      ? `Bootstrap ainda nao concluiu: ${reason}`
      : 'Bootstrap ainda nao concluiu'
  }

  return 'Status do bootstrap operacional atualizado'
}

function operationalBootstrapStatusFromMetadata(
  status: OperationalBootstrapStatus | null,
  traceId: string | null,
  error: string | null,
): OperationalBootstrapData {
  if (!status) {
    return {
      status: 'ready',
      title: 'Contexto operacional carregado',
      summary: 'Atlas abriu esta conversa com contexto, permissão e execução preparados. Nenhum bootstrap automático foi registrado.',
      traceId: null,
      responsePreview: null,
      steps: operationalBootstrapSteps('ready', false),
    }
  }

  if (status === 'queued' || status === 'processing' || status === 'retrying') {
    return {
      status,
      title: status === 'retrying' ? 'Atlas está tentando novamente' : 'Preparando diagnóstico operacional',
      summary: 'O contexto do Inbox foi registrado; o Atlas está preparando evidências, risco e próximas ações.',
      traceId,
      responsePreview: null,
      steps: operationalBootstrapSteps(status, false),
    }
  }

  if (status === 'failed' || status === 'cancelled' || status === 'skipped') {
    return {
      status,
      title: status === 'skipped' ? 'Bootstrap operacional indisponível' : 'Diagnóstico inicial não completou',
      summary: error
        ? `O Atlas abriu a conversa, mas o bootstrap automático falhou antes de concluir: ${error}.`
        : 'O Atlas abriu a conversa, mas o bootstrap automático falhou antes de concluir.',
      traceId,
      responsePreview: null,
      steps: operationalBootstrapSteps(status, false),
    }
  }

  return {
    status,
    title: 'Diagnóstico inicial registrado',
    summary: 'O Atlas registrou o bootstrap desta conversa operacional, mas a trace ainda não apareceu no histórico local.',
    traceId,
    responsePreview: null,
    steps: operationalBootstrapSteps(status, false),
  }
}

function operationalBootstrapSteps(
  status: OperationalBootstrapStatus,
  hasResponse: boolean,
): OperationalBootstrapStep[] {
  const failed = status === 'failed' || status === 'cancelled' || status === 'skipped'
  const active = status === 'queued' || status === 'processing' || status === 'retrying'
  const completed = status === 'succeeded' || status === 'awaiting_user_choice'

  return [
    { key: 'context', label: 'contexto carregado', state: 'done' },
    { key: 'evidence', label: 'evidências preparadas', state: failed ? 'failed' : active || completed || status === 'ready' ? 'done' : 'pending' },
    {
      key: 'diagnostic',
      label: 'diagnóstico inicial',
      state: failed ? 'failed' : active ? 'active' : completed ? 'done' : 'pending',
    },
    {
      key: 'action',
      label: 'próxima ação',
      state: failed ? 'pending' : hasResponse ? 'done' : active ? 'pending' : status === 'ready' ? 'pending' : 'pending',
    },
  ]
}

function bootstrapResponseText(trace: AtlasAiTrace): string {
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

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function truncateForContext(value: string, maxLength: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`
}
