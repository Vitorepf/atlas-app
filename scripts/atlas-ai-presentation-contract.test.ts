import assert from 'node:assert/strict'
import { projectPresentation } from '../lib/atlasAi/presentationContract'
import { parseBlocks } from '../components/console/markdown/parse'

// =====================================================================
// A. Sanitização da resposta principal
// =====================================================================

// A1 · SOURCE_REFS cru em UPPER_CASE não aparece na body
{
  const input = [
    'A migração é segura porque o banco aceita a coluna nula.',
    '',
    'SOURCE_REFS',
    '- ref:atlas-server/database/migrations/0042',
    '- ref:postgres-docs#add-column',
  ].join('\n')
  const result = projectPresentation(input)
  assert.ok(!/SOURCE_REFS/.test(result.body), 'SOURCE_REFS cru não pode vazar no corpo')
  assert.ok(!/source_refs/.test(result.body), 'snake_case também não pode vazar')
  assert.ok(/migração é segura/.test(result.body), 'prosa humana antes do bloco fica intacta')
  assert.deepEqual(
    result.metadata.sections.source_refs,
    ['- ref:atlas-server/database/migrations/0042', '- ref:postgres-docs#add-column'],
    'source_refs migrou para metadata',
  )
  assert.equal(result.technicalSectionsFound, 1)
}

// A2 · UNCERTAINTY cru não aparece na body
{
  const input = [
    'A proposta funciona com a evidência atual.',
    '',
    'UNCERTAINTY',
    'Não validamos comportamento sob carga concorrente.',
  ].join('\n')
  const result = projectPresentation(input)
  assert.ok(!/UNCERTAINTY/.test(result.body), 'UNCERTAINTY cru não pode vazar')
  assert.ok(/proposta funciona/.test(result.body), 'prosa antes do bloco fica intacta')
  assert.deepEqual(
    result.metadata.sections.uncertainty,
    ['Não validamos comportamento sob carga concorrente.'],
    'uncertainty migrou para metadata',
  )
}

// A3 · ## answer_summary → editorial PT-BR "## Resposta"
{
  const input = [
    '## answer_summary',
    'Migrar primeiro o índice, depois a coluna.',
    '',
    '## open_questions',
    '- O backup foi validado nas últimas 24h?',
  ].join('\n')
  const result = projectPresentation(input)
  assert.ok(/## Resposta/.test(result.body), 'answer_summary virou Resposta')
  assert.ok(/## Perguntas em aberto/.test(result.body), 'open_questions virou Perguntas em aberto')
  assert.ok(!/answer_summary/.test(result.body))
  assert.ok(!/open_questions/.test(result.body))
}

// A4 · **source_refs:** em bold como label também é detectado
{
  const input = [
    'Posso confirmar que a função foi extraída para um helper.',
    '',
    '**source_refs:**',
    '- atlas-app/components/console/markdown/parse.ts:67',
  ].join('\n')
  const result = projectPresentation(input)
  assert.ok(!/source_refs/.test(result.body), 'bold label source_refs sanitizado')
  assert.deepEqual(
    result.metadata.sections.source_refs,
    ['- atlas-app/components/console/markdown/parse.ts:67'],
  )
}

// A5 · Markdown normal continua intacto
{
  const input = [
    '# Título normal',
    '',
    'Parágrafo com **negrito** e *itálico* e `código inline`.',
    '',
    '- item um',
    '- item dois',
    '',
    '> Citação editorial.',
  ].join('\n')
  const result = projectPresentation(input)
  assert.ok(/# Título normal/.test(result.body))
  assert.ok(/\*\*negrito\*\*/.test(result.body))
  assert.ok(/\*itálico\*/.test(result.body))
  assert.ok(/`código inline`/.test(result.body))
  assert.ok(/- item um/.test(result.body))
  assert.ok(/> Citação editorial/.test(result.body))
  assert.equal(result.technicalSectionsFound, 0)
}

// A6 · Tabela markdown legítima continua renderizável
{
  const input = [
    'Comparação de provedores:',
    '',
    '| Provider | Latência |',
    '| --- | --- |',
    '| Claude | 1.2s |',
    '| Gemini | 0.9s |',
  ].join('\n')
  const result = projectPresentation(input)
  assert.ok(/\| Provider \| Latência \|/.test(result.body))
  assert.ok(/\| Claude \| 1\.2s \|/.test(result.body))
  const blocks = parseBlocks(result.body)
  const tableBlock = blocks.find((b) => b.type === 'table')
  assert.ok(tableBlock, 'tabela permanece parseável depois da sanitização')
}

// A7 · Paths preservados em contexto programação/debug/review
{
  const input = [
    'Editei o picker em components/sheets/atlas-ai/AtlasAiTurnModel.ts:227.',
    '',
    'O parser está em components/console/markdown/parse.ts:67.',
  ].join('\n')
  const result = projectPresentation(input, { technicalDomain: 'programming' })
  assert.ok(/AtlasAiTurnModel\.ts:227/.test(result.body))
  assert.ok(/parse\.ts:67/.test(result.body))
}

// A8 · auditRequested preserva blocos crus
{
  const input = 'SOURCE_REFS\n- a\nUNCERTAINTY\n- b'
  const result = projectPresentation(input, { auditRequested: true })
  assert.ok(/SOURCE_REFS/.test(result.body), 'audit explícito preserva')
  assert.ok(/UNCERTAINTY/.test(result.body))
  assert.deepEqual(result.metadata.sections, {})
}

// =====================================================================
// B. Divisor editorial
// =====================================================================

// B1 · `---` no markdown vira block `divider` no parser
{
  const blocks = parseBlocks('Parágrafo um.\n\n---\n\nParágrafo dois.')
  const dividerIndex = blocks.findIndex((b) => b.type === 'divider')
  assert.ok(dividerIndex > -1, '--- vira block divider')
}

// B2 · Resposta multi-seção (≥2 títulos editoriais) ganha divisor
{
  const input = [
    '## answer_summary',
    'Resposta breve.',
    '',
    '## open_questions',
    '- O que validar?',
  ].join('\n')
  const result = projectPresentation(input)
  assert.ok(/\n---\n/.test(result.body), 'multi-seção tem divisor entre blocos')
  const blocks = parseBlocks(result.body)
  const dividerCount = blocks.filter((b) => b.type === 'divider').length
  assert.equal(dividerCount, 1, 'apenas um divisor entre as duas seções')
}

// B3 · Resposta curta sem múltiplas seções NÃO ganha divisor artificial
{
  const input = 'A resposta é curta. Sem precisar de seções.'
  const result = projectPresentation(input)
  assert.ok(!/---/.test(result.body), 'resposta curta não ganha divisor desnecessário')
}

// B4 · Resposta com 1 seção editorial só não ganha divisor
{
  const input = [
    '## answer_summary',
    'Texto único.',
  ].join('\n')
  const result = projectPresentation(input)
  assert.ok(!/---/.test(result.body), 'uma seção só não ganha divisor')
}

// =====================================================================
// C. Separação de metadados (presença em metadata.sections)
// =====================================================================

// C1 · source_refs disponível no metadata
{
  const input = '## source_refs\n- ref:alpha\n- ref:beta'
  const result = projectPresentation(input)
  assert.deepEqual(result.metadata.sections.source_refs, ['- ref:alpha', '- ref:beta'])
}

// C2 · uncertainty disponível no metadata
{
  const input = '## uncertainty\nIncerto se a query escala.'
  const result = projectPresentation(input)
  assert.deepEqual(result.metadata.sections.uncertainty, ['Incerto se a query escala.'])
}

// C3 · receipt/trace/handoff migram inteiros para metadata
{
  const input = [
    'Resposta concreta.',
    '',
    '## RECEIPT',
    'hash:sha256:abc123',
    '',
    '## TRACE',
    'span:atlas.research.execute',
    '',
    '## handoff',
    'target:atlas_dev',
  ].join('\n')
  const result = projectPresentation(input)
  assert.ok(!/RECEIPT/.test(result.body))
  assert.ok(!/TRACE/.test(result.body))
  assert.ok(!/handoff/.test(result.body))
  assert.deepEqual(result.metadata.sections.receipt, ['hash:sha256:abc123'])
  assert.deepEqual(result.metadata.sections.trace, ['span:atlas.research.execute'])
  assert.deepEqual(result.metadata.sections.handoff, ['target:atlas_dev'])
}

// C4 · múltiplas ocorrências do mesmo metadata acumulam
{
  const input = [
    '## source_refs',
    '- ref:a',
    '',
    'Algo no meio.',
    '',
    '## source_refs',
    '- ref:b',
  ].join('\n')
  const result = projectPresentation(input)
  assert.deepEqual(result.metadata.sections.source_refs, ['- ref:a', '- ref:b'])
  assert.ok(/Algo no meio/.test(result.body))
}

// =====================================================================
// D. Anti-regressão Hyperflow (compatibilidade com extractHyperflow)
// =====================================================================
// Estes testes garantem que o picker continua escolhendo o texto certo
// quando o trace traz hyperflow flat, nested em metadata, ou nested em
// payload — sem interferir com a sanitização editorial.

import { extractHyperflow } from '../lib/atlasAi/hyperflowRuntime'

// D1 · flat hyperflow trace funciona
{
  const trace = {
    id: 'trace-flat',
    status: 'completed',
    response_text: '## answer_summary\nResposta.',
    hyperflow: {
      schema_version: 'atlas.ai.hyperflow_runtime.v1',
      intent: 'research',
      domain_id: 'research',
      flow_id: 'atlas_research',
      runtime_mode: 'deep',
      confidence: 0.8,
      policy_refs: [],
      evidence_refs: [],
      dispatch_status: 'planned',
      handoff_target: null,
      handoff_reason: null,
    },
  }
  const hf = extractHyperflow(trace)
  assert.ok(hf, 'flat hyperflow extraído')
  assert.equal(hf!.intent, 'research')
}

// D2 · nested metadata.hyperflow_runtime funciona
{
  const trace = {
    id: 'trace-nested-meta',
    status: 'completed',
    metadata: {
      hyperflow_runtime: {
        schema_version: 'atlas.ai.hyperflow_runtime.v1',
        intent: { intent_type: 'programming', confidence: 0.9 },
        primary_domain: 'programming',
        flow_id: 'atlas_dev',
        router_decision: { routing_mode: 'standard' },
        dispatch: { dispatch_status: 'dispatched' },
        handoff_target: { kind: 'atlas_dev' },
      },
    },
  }
  const hf = extractHyperflow(trace)
  assert.ok(hf, 'nested metadata.hyperflow_runtime extraído')
  assert.equal(hf!.intent, 'programming')
  assert.equal(hf!.handoff_target, 'atlas_dev')
}

// D3 · payload.hyperflow_runtime funciona (nested em trace.payload)
{
  const trace = {
    id: 'trace-payload',
    status: 'completed',
    payload: {
      hyperflow_runtime: {
        schema_version: 'atlas.ai.hyperflow_runtime.v1',
        intent: { intent_type: 'review', confidence: 0.7 },
        primary_domain: 'review',
        flow_id: 'atlas_review',
        router_decision: { routing_mode: 'standard' },
        dispatch: { dispatch_status: 'planned' },
        handoff_target: null,
      },
    },
  }
  const hf = extractHyperflow(trace)
  assert.ok(hf, 'payload.hyperflow_runtime extraído')
  assert.equal(hf!.intent, 'review')
}

// D4 · presentationContract não interfere com decisão de handoff
{
  const input = [
    'A migração precisa de validação prática.',
    '',
    '## SOURCE_REFS',
    '- ref:trabalho_handoff_to_atlas_dev',
  ].join('\n')
  const result = projectPresentation(input, { technicalDomain: 'programming' })
  // technicalDomain=programming preserva paths/identificadores na BODY se
  // estiverem inline, mas cabeçalho SOURCE_REFS continua migrando pra metadata
  // (é metadata-sempre, não conteúdo). A regra preservesTechnicalTokens só
  // afeta paths inline, não vocabulário técnico de auditoria.
  assert.ok(!/SOURCE_REFS/.test(result.body), 'auditoria sempre migra mesmo em contexto programming')
  assert.deepEqual(result.metadata.sections.source_refs, ['- ref:trabalho_handoff_to_atlas_dev'])
}

// =====================================================================
// Edge cases
// =====================================================================

// E1 · response_text vazio
{
  const result = projectPresentation('')
  assert.equal(result.body, '')
  assert.deepEqual(result.metadata.sections, {})
}

// E2 · só cabeçalhos técnicos, sem conteúdo
{
  const input = '## SOURCE_REFS\n## UNCERTAINTY'
  const result = projectPresentation(input)
  assert.equal(result.body, '', 'só técnicos sem conteúdo → body vazio')
  // metadata vazio porque não havia conteúdo abaixo dos headers
  assert.deepEqual(result.metadata.sections, {})
}

// E3 · cabeçalho técnico não vocabulário não vaza
{
  const input = '## something_else\nConteúdo.'
  const result = projectPresentation(input)
  assert.ok(/something_else/.test(result.body), 'cabeçalho normal não-técnico preserva')
}

// E4 · paragrafos sem cabeçalho continuam intactos
{
  const input = 'Linha 1.\n\nLinha 2.\n\nLinha 3.'
  const result = projectPresentation(input)
  assert.ok(/Linha 1/.test(result.body))
  assert.ok(/Linha 2/.test(result.body))
  assert.ok(/Linha 3/.test(result.body))
}

console.log('atlas-ai-presentation-contract: ok')
