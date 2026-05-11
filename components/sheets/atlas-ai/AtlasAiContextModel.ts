import type {
  AtlasAiThread,
  AtlasAiTrace,
} from '../../../lib/api/client'
import {
  isDiscussionBootstrapTrace,
  isOperationalContextThread,
} from '../../../lib/atlasOperationalBootstrap'
import {
  atlasAiFocusFromThread,
} from '../../../lib/atlasAiFocus'
import {
  atlasAiModeFromThread,
  atlasAiModeLabel,
  normalizeAtlasAiMode,
} from '../../../lib/atlasAiThreadRouting'
import { sortAtlasTraces } from '../../../lib/atlasAiRuntime'
import type {
  AtlasAiContextIntroData,
  AtlasAiModeNoticeData,
} from './AtlasAiContextPanels'
import { pickResponseText } from './AtlasAiTurnModel'

export function threadModeNotice(thread: AtlasAiThread | null): AtlasAiModeNoticeData | null {
  if (!thread) return null

  const metadata = thread.metadata ?? {}
  const current = atlasAiModeFromThread(thread)
  const initial = normalizeAtlasAiMode(
    metadataString(metadata, 'initial_mode')
      ?? metadataString(metadata, 'initial_focus')
      ?? metadataString(metadata, 'atlas_mode')
      ?? metadataString(metadata, 'atlas_focus'),
    current,
  )
  const history = Array.isArray(metadata.mode_history) ? metadata.mode_history : []
  const changed = current !== initial || history.length > 1

  if (!changed) return null

  return {
    tone: current,
    title: `Modo ${atlasAiModeLabel(current)} ativo`,
    summary: `Começou em ${atlasAiModeLabel(initial)}; próximos envios seguem ${atlasAiModeLabel(current)}.`,
  }
}

export function contextualThreadIntro(thread: AtlasAiThread | null): AtlasAiContextIntroData | null {
  if (!isOperationalContextThread(thread)) return null

  const metadata = thread?.metadata ?? {}
  const systemContext = [...(thread?.messages ?? [])]
    .sort((left, right) => left.position - right.position)
    .find((message) => message.role === 'system' && message.content.trim().length > 0)
    ?.content
    ?.trim() ?? null

  return {
    title: metadataString(metadata, 'context_label') ?? thread?.title ?? 'Contexto operacional',
    summary: thread?.summary ?? null,
    body: systemContext ? truncateForContext(systemContext, 900) : null,
    focus: focusLabel(metadataString(metadata, 'atlas_focus') ?? 'operational'),
    permission: permissionPolicyLabel('full_access'),
    execution: executionPolicyLabel('provider_execution_allowed'),
  }
}

export function developmentPromptFromContext(
  intro: AtlasAiContextIntroData,
  sourceThread: AtlasAiThread,
  traces: AtlasAiTrace[],
): string {
  const metadata = sourceThread.metadata ?? {}
  const bootstrapTrace = traces.find(isDiscussionBootstrapTrace) ?? null
  const bootstrapResponse = bootstrapTrace ? pickResponseText(bootstrapTrace).trim() : ''
  const recentUserTurns = sortAtlasTraces(traces)
    .filter((trace) => trace.operator_input.trim().length > 0 && !isDiscussionBootstrapTrace(trace))
    .slice(-3)
    .map((trace) => `- ${truncateForContext(trace.operator_input.trim(), 260)}`)

  const sections = [
    'Modo Programação do Atlas AI.',
    'Use este contexto operacional como briefing técnico. Não peça para eu reenviar o alerta; o contexto abaixo é a fonte inicial.',
    [
      'Origem operacional:',
      `- Título: ${intro.title}`,
      intro.summary ? `- Resumo: ${intro.summary}` : null,
      `- Thread operacional: ${sourceThread.id}`,
      metadataString(metadata, 'inbox_item_id') ? `- Inbox item: ${metadataString(metadata, 'inbox_item_id')}` : null,
      metadataString(metadata, 'context_bundle_id') ? `- Context bundle: ${metadataString(metadata, 'context_bundle_id')}` : null,
      metadataString(metadata, 'source_type') ? `- Source: ${metadataString(metadata, 'source_type')}` : null,
    ].filter(Boolean).join('\n'),
    intro.body ? `Contexto carregado:\n${intro.body}` : null,
    bootstrapResponse
      ? `Diagnóstico inicial do Atlas:\n${truncateForContext(bootstrapResponse, 1600)}`
      : 'Diagnóstico inicial do Atlas: ainda não há resposta automática completa; use o contexto carregado e investigue antes de concluir.',
    recentUserTurns.length > 0 ? `Mensagens recentes do operador:\n${recentUserTurns.join('\n')}` : null,
    [
      'Objetivo técnico:',
      '- Transformar o alerta operacional em diagnóstico executável.',
      '- Identificar arquivos, serviços, comandos, queries, logs ou testes relevantes.',
      '- Se for preciso webscrape, script, teste, Postgres ou alteração de código, use o runtime normal de Programação do Atlas.',
      '- Antes de alterar comportamento, isole causa, risco e critério de sucesso.',
    ].join('\n'),
    [
      'Saída esperada:',
      '- Plano curto.',
      '- Evidências verificadas.',
      '- Execução realizada ou motivo claro para não executar.',
      '- Testes/comandos rodados ou próximos comandos exatos.',
      '- Riscos e rollback quando houver mudança.',
    ].join('\n'),
  ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0)

  return sections.join('\n\n')
}

export function developmentThreadOriginPayload(
  sourceThread: AtlasAiThread,
  intro: AtlasAiContextIntroData,
): Record<string, unknown> {
  const metadata = sourceThread.metadata ?? {}

  return {
    created_from: 'operational_promotion',
    origin_type: 'operational_promotion',
    origin_label: 'Operacional para Programação',
    source_operational_thread_id: sourceThread.id,
    source_operational_title: intro.title,
    source_inbox_item_id: metadataString(metadata, 'inbox_item_id') ?? sourceThread.source_id ?? undefined,
    source_context_bundle_id: metadataString(metadata, 'context_bundle_id') ?? undefined,
    source_thread_mode: atlasAiModeFromThread(sourceThread),
    source_thread_focus: atlasAiFocusFromThread(sourceThread),
  }
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function focusLabel(value: string): string {
  switch (value) {
    case 'operational': return 'Operacional'
    case 'programming': return 'Programação'
    case 'research': return 'Pesquisa'
    case 'project': return 'Projeto'
    case 'review': return 'Revisão'
    case 'general': return 'Geral'
    default: return humanizeRuntimeKey(value)
  }
}

function permissionPolicyLabel(value: string): string {
  switch (value) {
    case 'full_access': return 'Acesso total'
    case 'read_only_until_approval': return 'Leitura até aprovação'
    case 'read_only': return 'Somente leitura'
    case 'approval_required': return 'Aprovação obrigatória'
    default: return humanizeRuntimeKey(value)
  }
}

function executionPolicyLabel(value: string): string {
  switch (value) {
    case 'provider_execution_allowed': return 'Execução liberada'
    case 'no_code_execution': return 'Sem execução'
    case 'single_provider': return 'Provider único'
    case 'dual_review': return 'Revisão dupla'
    default: return humanizeRuntimeKey(value)
  }
}

function humanizeRuntimeKey(value: string): string {
  const normalized = value.replace(/[_-]+/g, ' ').trim()
  if (!normalized) return 'n/d'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

function truncateForContext(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}
