import assert from 'node:assert/strict'
import {
  TRACE_HISTORY_LIMIT,
  buildAtlasSessionMap,
  buildPinnedTraceSummary,
  isAtlasTraceActive,
  matchesAtlasTraceSearch,
  mergeAtlasTrace,
  pollIntervalForAtlasAi,
  sortAtlasTraces,
  traceDisplayKey,
  traceMatchesClientId,
  traceMatchesTurnFilter,
  type AtlasAiTurnFilter,
} from '../lib/atlasAiRuntime'
import {
  atlasDefaultTaskForMode,
  atlasDomainAllowedForMode,
  atlasModeContractForRouting,
  atlasModePayloadForRoutingContract,
  atlasQualityPolicyForMode,
  atlasTaskAllowedForMode,
} from '../lib/atlasAiModeContract'
import type { AtlasAiQualityAction, AtlasAiSessionState, AtlasAiTrace } from '../lib/api/client'

function trace(input: Partial<AtlasAiTrace> & { id: string; created_at?: string }): AtlasAiTrace {
  return {
    id: input.id,
    trace_key: input.trace_key ?? input.id,
    thread_id: input.thread_id ?? 'thread-1',
    session_id: input.session_id ?? 'session-1',
    source_type: input.source_type ?? 'app',
    source_id: input.source_id ?? null,
    status: input.status ?? 'succeeded',
    operator_input: input.operator_input ?? 'Pergunta',
    intent: input.intent ?? null,
    agent_slug: input.agent_slug ?? 'orquestrador',
    provider: input.provider ?? 'codex_cli',
    model: input.model ?? null,
    skill_versions: input.skill_versions ?? {},
    context_refs: input.context_refs ?? [],
    prompt_hash: input.prompt_hash ?? null,
    response_hash: input.response_hash ?? null,
    response_text: input.response_text ?? 'Resposta',
    latency_ms: input.latency_ms ?? null,
    feedback_score: input.feedback_score ?? null,
    feedback_action: input.feedback_action ?? null,
    feedback_comment: input.feedback_comment ?? null,
    completed_at: input.completed_at ?? null,
    metadata: input.metadata ?? {},
    job: input.job,
    jobs: input.jobs,
    quality_evaluation: input.quality_evaluation,
    quality_actions: input.quality_actions,
    created_at: input.created_at ?? '2026-04-29T12:00:00.000Z',
    updated_at: input.updated_at ?? input.created_at ?? '2026-04-29T12:00:00.000Z',
  }
}

function action(input: Partial<AtlasAiQualityAction> = {}): AtlasAiQualityAction {
  return {
    id: input.id ?? 'action-1',
    evaluation_id: input.evaluation_id ?? null,
    trace_id: input.trace_id ?? 'trace-1',
    remediation_trace_id: input.remediation_trace_id ?? null,
    thread_id: input.thread_id ?? 'thread-1',
    session_id: input.session_id ?? 'session-1',
    action_type: input.action_type ?? 'retry_with_continuity',
    status: input.status ?? 'queued',
    priority: input.priority ?? 10,
    reason: input.reason ?? 'perdeu continuidade',
    flags: input.flags ?? [],
    payload: input.payload ?? {},
    result: input.result ?? {},
    error_message: input.error_message ?? null,
    dedupe_key: input.dedupe_key ?? null,
    completed_at: input.completed_at ?? null,
    remediation_trace: input.remediation_trace,
    created_at: input.created_at ?? '2026-04-29T12:00:00.000Z',
    updated_at: input.updated_at ?? '2026-04-29T12:00:00.000Z',
  }
}

{
  const routing = { mode: 'general', task: 'direct', domain: 'auto', executor: 'auto', style: 'clear' } as const
  const general = atlasModePayloadForRoutingContract(routing, 'general')
  assert.equal(general.atlas_mode, 'general')
  assert.equal((general as Record<string, unknown>).permission_mode, undefined)
  assert.deepEqual(atlasQualityPolicyForMode('general'), {
    keep_context_light: true,
    avoid_operational_or_programming_assumptions: true,
  })

  const operational = atlasModeContractForRouting('operational', { ...routing, mode: 'operational', task: 'review', domain: 'atlas' })
  assert.equal(operational.mode, 'operational')
  assert.ok(Array.isArray(operational.expected_output))
  assert.ok((operational.expected_output as string[]).includes('evidencias'))

  const programming = atlasModePayloadForRoutingContract({ ...routing, mode: 'programming', task: 'dev', domain: 'atlas', executor: 'codex_cli', style: 'technical' }, 'programming')
  assert.equal(programming.atlas_mode, 'programming')
  assert.equal(programming.permission_mode, 'danger')
  assert.equal((programming.mobile_runtime_policy as Record<string, unknown>).allows_code_execution, true)
  assert.equal((programming.programming_harness as Record<string, unknown>).workspace_required, true)
  const programmingWithWorkspace = atlasModePayloadForRoutingContract(
    { ...routing, mode: 'programming', task: 'dev', domain: 'atlas', executor: 'codex_cli', style: 'technical' },
    'programming',
    { workspace: '/Users/vitorepf/Develop/atlas' },
  )
  assert.equal(((programmingWithWorkspace.tool_permissions as Record<string, unknown>).workspace), '/Users/vitorepf/Develop/atlas')
  assert.equal(atlasTaskAllowedForMode('dev', 'general'), false)
  assert.equal(atlasTaskAllowedForMode('dev', 'programming'), true)
  assert.equal(atlasDefaultTaskForMode('operational'), 'review')
  assert.equal(atlasDomainAllowedForMode('atlas', 'general'), false)
}

{
  assert.equal(isAtlasTraceActive(trace({ id: 'queued', status: 'queued' })), true)
  assert.equal(isAtlasTraceActive(trace({ id: 'processing', status: 'processing' })), true)
  assert.equal(isAtlasTraceActive(trace({ id: 'done', status: 'succeeded' })), false)
}

{
  assert.equal(pollIntervalForAtlasAi({ hasActiveTrace: false, failureCount: 0 }), null)
  assert.equal(pollIntervalForAtlasAi({ hasActiveTrace: true, failureCount: 0, activeTraceAgeMs: 10_000 }), 1800)
  assert.equal(pollIntervalForAtlasAi({ hasActiveTrace: true, failureCount: 0, activeTraceAgeMs: 300_000 }), 4500)
  assert.equal(pollIntervalForAtlasAi({ hasActiveTrace: true, failureCount: 4, activeTraceAgeMs: 10_000 }), 9000)
  assert.equal(pollIntervalForAtlasAi({ hasActiveTrace: true, failureCount: 1, appIsActive: false }), null)
}

{
  const current = Array.from({ length: TRACE_HISTORY_LIMIT + 4 }, (_, index) => trace({
    id: `trace-${index}`,
    created_at: `2026-04-29T12:${String(index).padStart(2, '0')}:00.000Z`,
  }))
  const merged = mergeAtlasTrace(trace({ id: 'new', created_at: '2026-04-29T14:00:00.000Z' }), current)
  assert.equal(merged.length, TRACE_HISTORY_LIMIT)
  assert.equal(merged.at(-1)?.id, 'new')
  assert.equal(sortAtlasTraces([current[2], current[0], current[1]]).map((item) => item.id).join(','), 'trace-0,trace-1,trace-2')
}

{
  const matched = trace({
    id: 'with-client',
    metadata: { client_id: 'client-1' },
    jobs: [{ id: 'job-1', client_id: 'client-2' } as never],
  })
  assert.equal(traceMatchesClientId(matched, 'client-1'), true)
  assert.equal(traceMatchesClientId(matched, 'client-2'), true)
  assert.equal(traceMatchesClientId(matched, 'missing'), false)
  assert.equal(traceDisplayKey(matched), 'client-1')
  assert.equal(traceDisplayKey(trace({ id: 'without-client', trace_key: 'trace-key-1' })), 'trace-key-1')
}

{
  const devTrace = trace({
    id: 'dev',
    operator_input: 'implemente no arquivo AtlasAiSheet.tsx e rode npm run typecheck',
    response_text: 'Alterei o componente e rodei o teste.',
  })
  const decisionTrace = trace({
    id: 'decision',
    operator_input: 'qual opção escolher, A ou B?',
    response_text: 'Decisão: use B.',
  })
  const errorTrace = trace({
    id: 'error',
    status: 'failed',
    job: { id: 'job-error', status: 'failed', error_message: 'CLI failed' } as never,
  })

  assert.equal(matchesAtlasTraceSearch(devTrace, 'AtlasAiSheet'), true)
  assert.equal(matchesAtlasTraceSearch(devTrace, 'inexistente'), false)
  assert.equal(traceMatchesTurnFilter(devTrace, 'dev'), true)
  assert.equal(traceMatchesTurnFilter(decisionTrace, 'decisions'), true)
  assert.equal(traceMatchesTurnFilter(errorTrace, 'errors'), true)
  assert.equal(traceMatchesTurnFilter(decisionTrace, 'pinned' as AtlasAiTurnFilter, ['decision']), true)
}

{
  const state = {
    decisions: [{ text: 'Usar Atlas como harness, não como provider.' }],
    next_steps: [{ text: 'Testar fluxo real com worker.' }],
    open_loops: [{ text: 'Validar em iPhone físico.' }],
    relevant_artifacts: [{ text: 'components/sheets/AtlasAiSheet.tsx' }],
  } as AtlasAiSessionState

  const traces = [
    trace({
      id: 'pinned',
      operator_input: 'Decidir como responder C',
      response_text: 'Manter contexto de sessão.',
      metadata: { files: ['components/sheets/AtlasAiSheet.tsx'] },
    }),
    trace({
      id: 'failed',
      status: 'failed',
      jobs: [{ id: 'job-1', status: 'failed', error_message: 'timeout' } as never],
    }),
  ]

  const map = buildAtlasSessionMap({
    state,
    traces,
    qualityActions: [action({ status: 'queued', reason: 'resposta longa demais' })],
    pinnedTraceIds: ['pinned'],
  })

  assert.ok(map.decisions.some((item) => item.includes('Atlas como harness')))
  assert.ok(map.actions.some((item) => item.includes('worker')))
  assert.ok(map.actions.some((item) => item.includes('resposta longa')))
  assert.ok(map.code.some((item) => item.includes('AtlasAiSheet.tsx')))
  assert.ok(map.errors.some((item) => item.includes('timeout')))
  assert.ok(buildPinnedTraceSummary(traces, ['pinned'])[0].includes('Decidir'))
}

console.info('atlas ai runtime tests passed')
