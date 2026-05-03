import assert from 'node:assert/strict'
import {
  bootstrapRetryResultMessage,
  bootstrapStatusLabel,
  inboxItemIdFromThread,
  isDiscussionBootstrapTrace,
  isOperationalContextThread,
  operationalBootstrapStatus,
} from '../lib/atlasOperationalBootstrap'
import type { AtlasAiThread, AtlasAiTrace } from '../lib/api/client'

function thread(input: Partial<AtlasAiThread> = {}): AtlasAiThread {
  return {
    id: input.id ?? 'thread-1',
    title: input.title ?? 'Atlas AI precisa de revisão operacional',
    summary: input.summary ?? 'Telemetry health critical; score 0/100.',
    status: input.status ?? 'active',
    surface: input.surface ?? 'mobile',
    workspace: input.workspace ?? null,
    source_type: input.source_type ?? null,
    source_id: input.source_id ?? null,
    last_trace_id: input.last_trace_id ?? null,
    last_provider: input.last_provider ?? null,
    message_count: input.message_count ?? 0,
    last_message_at: input.last_message_at ?? null,
    metadata: input.metadata ?? {},
    messages: input.messages,
    active_session: input.active_session,
    active_state: input.active_state,
    latest_compaction: input.latest_compaction,
    latest_provider_handoff: input.latest_provider_handoff,
    last_trace: input.last_trace,
    created_at: input.created_at ?? '2026-05-02T12:00:00.000Z',
    updated_at: input.updated_at ?? '2026-05-02T12:00:00.000Z',
  }
}

function trace(input: Partial<AtlasAiTrace> & { id?: string } = {}): AtlasAiTrace {
  return {
    id: input.id ?? 'trace-1',
    trace_key: input.trace_key ?? input.id ?? 'trace-1',
    thread_id: input.thread_id ?? 'thread-1',
    session_id: input.session_id ?? 'session-1',
    source_type: input.source_type ?? 'mobile',
    source_id: input.source_id ?? null,
    status: input.status ?? 'succeeded',
    operator_input: input.operator_input ?? 'Analise este item operacional do Inbox antes da primeira mensagem do operador.',
    intent: input.intent ?? null,
    agent_slug: input.agent_slug ?? 'atlas',
    provider: input.provider ?? 'codex_cli',
    model: input.model ?? null,
    skill_versions: input.skill_versions ?? {},
    context_refs: input.context_refs ?? [],
    prompt_hash: input.prompt_hash ?? null,
    response_hash: input.response_hash ?? null,
    response_text: input.response_text ?? 'Diagnóstico: revisar qualidade, custo e latência.',
    latency_ms: input.latency_ms ?? null,
    feedback_score: input.feedback_score ?? null,
    feedback_action: input.feedback_action ?? null,
    feedback_comment: input.feedback_comment ?? null,
    completed_at: input.completed_at ?? null,
    metadata: input.metadata ?? {},
    attachments: input.attachments,
    thread: input.thread,
    session: input.session,
    job: input.job,
    jobs: input.jobs,
    router_decision: input.router_decision,
    atlas_decision: input.atlas_decision,
    decision_receipt: input.decision_receipt,
    quality_evaluation: input.quality_evaluation,
    quality_actions: input.quality_actions,
    created_at: input.created_at ?? '2026-05-02T12:00:00.000Z',
    updated_at: input.updated_at ?? '2026-05-02T12:00:00.000Z',
  }
}

{
  const normal = thread({ metadata: { atlas_mode: 'general' }, source_type: null })
  assert.equal(isOperationalContextThread(normal), false)
  assert.equal(operationalBootstrapStatus(normal, []), null)
}

{
  const operational = thread({
    source_type: 'inbox_item',
    source_id: 'inbox-1',
    metadata: {
      capability_profile: 'atlas_full_access',
      discussion_bootstrap_status: 'failed',
      discussion_bootstrap_error: 'Provider unavailable',
    },
  })
  const status = operationalBootstrapStatus(operational, [])
  assert.equal(isOperationalContextThread(operational), true)
  assert.equal(inboxItemIdFromThread(operational), 'inbox-1')
  assert.equal(status?.status, 'failed')
  assert.equal(status?.title, 'Diagnóstico inicial não completou')
  assert.match(status?.summary ?? '', /Provider unavailable/)
  assert.equal(status?.steps.find((step) => step.key === 'diagnostic')?.state, 'failed')
  assert.equal(bootstrapStatusLabel(status?.status ?? 'failed'), 'falhou')
}

{
  const operational = thread({
    metadata: {
      source_type: 'ai_inbox_item',
      source_id: 'inbox-2',
      discussion_bootstrap_status: 'retrying',
      discussion_bootstrap_trace_id: 'trace-retry',
    },
  })
  const status = operationalBootstrapStatus(operational, [])
  assert.equal(inboxItemIdFromThread(operational), 'inbox-2')
  assert.equal(status?.status, 'retrying')
  assert.equal(status?.traceId, 'trace-retry')
  assert.equal(status?.title, 'Atlas está tentando novamente')
  assert.equal(status?.steps.find((step) => step.key === 'diagnostic')?.state, 'active')
}

{
  const operational = thread({
    metadata: {
      capability_profile: 'mobile_operational_read',
      inbox_item_id: 'inbox-3',
      discussion_bootstrap_trace_id: 'trace-ready',
      discussion_bootstrap_status: 'succeeded',
    },
  })
  const bootstrapTrace = trace({
    id: 'trace-ready',
    status: 'succeeded',
    response_text: 'Analisei o alerta, achei risco em custo desconhecido e sugeri revisar traces recentes.',
    metadata: { discussion_bootstrap: { source: 'inbox_discuss_action' } },
  })
  const status = operationalBootstrapStatus(operational, [bootstrapTrace])
  assert.equal(isDiscussionBootstrapTrace(bootstrapTrace), true)
  assert.equal(status?.status, 'succeeded')
  assert.equal(status?.title, 'Diagnóstico inicial pronto')
  assert.match(status?.responsePreview ?? '', /custo desconhecido/)
  assert.equal(status?.steps.find((step) => step.key === 'action')?.state, 'done')
}

{
  const operational = thread({
    metadata: {
      capability_profile: 'atlas_full_access',
      discussion_bootstrap_status: 'already_queued',
    },
  })
  const status = operationalBootstrapStatus(operational, [])
  assert.equal(status?.status, 'queued')
  assert.equal(bootstrapStatusLabel(status?.status ?? 'queued'), 'fila')
}

{
  assert.equal(bootstrapRetryResultMessage('queued'), 'Bootstrap operacional reenviado')
  assert.equal(bootstrapRetryResultMessage('already_queued'), 'Diagnostico operacional ja esta em andamento')
  assert.equal(bootstrapRetryResultMessage('succeeded'), 'Diagnostico operacional pronto')
  assert.equal(bootstrapRetryResultMessage('failed', 'provider indisponivel'), 'Bootstrap ainda nao concluiu: provider indisponivel')
}

console.info('atlas operational bootstrap tests passed')
