/**
 * Atlas AI · Presentation snapshot proof.
 *
 * Não temos como tirar screenshot real do app via CLI. Em vez disso, este
 * teste:
 *
 *   1. Monta um `response_text` realista que o Hyperflow V2 produziria após
 *      a regressão (multi-seção, source_refs cru, uncertainty cru, divisores,
 *      tabela, lista, link, code fence, paths de arquivo, snake_case
 *      vazado).
 *   2. Roda o `projectPresentation` (PresentationContract).
 *   3. Parseia o body editorial via `parseBlocks` — o MESMO parser que o
 *      `EditorialMarkdown` (React Native) usa em runtime.
 *   4. Asserta que o AST de blocos contém exatamente os componentes
 *      editoriais esperados (heading PT-BR, divider que vai virar
 *      DividerEditorial com ✦, table, list, paragraph com link, code).
 *   5. Asserta que o vocabulário técnico (SOURCE_REFS, UNCERTAINTY,
 *      source_refs, claims_table, open_questions) NÃO aparece em
 *      nenhum span do AST.
 *   6. Emite um snapshot legível do AST + metadata em
 *      `scripts/__snapshots__/atlas-ai-presentation-snapshot.txt` para
 *      inspeção visual humana posterior, sem depender de mobile build.
 *
 * Isso é o equivalente CLI a "abrir o sheet no simulador e olhar".
 */

import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Block, type InlineSpan, parseBlocks } from '../components/console/markdown/parse'
import { projectPresentation } from '../lib/atlasAi/presentationContract'

const REGRESSED_RESPONSE_TEXT = `## answer_summary
A migração para Hyperflow V2 mantém o trace completo, mas separa a apresentação editorial dos metadados técnicos. O operador vê resposta limpa em português; auditoria fica no painel de contexto.

A integração funciona com três providers (Claude, Gemini, Codex) e respeita o **contrato de identidade Atlas**.

## claims_table

| Provider | Latência média | Cache |
| --- | --- | --- |
| Claude  | 1.2s | sim |
| Gemini  | 0.9s | sim |
| Codex   | 1.5s | parcial |

Veja a [documentação canônica](https://atlas.local/docs/hyperflow) para o pipeline completo.

\`\`\`ts
const result = projectPresentation(trace.response_text)
\`\`\`

## SOURCE_REFS
- ref:docs/engineering-knowledge-base/atlas-ai-hyperflow-runtime.md
- ref:app/Services/Ai/RouterRuntime/AtlasHyperflowEntryService.php
- ref:hash:sha256:abc123

## UNCERTAINTY
Não validamos o comportamento sob >10k req/s. O ledger ainda não tem dados de produção.

## open_questions
- O AtlasVault precisa migrar índices?
- Existe budget para rodar bateria semanal?
`

const result = projectPresentation(REGRESSED_RESPONSE_TEXT)
const blocks = parseBlocks(result.body)

// =====================================================================
// 1 · Vocabulário técnico crus NÃO aparece no body nem nos spans do AST.
// =====================================================================

function inlineText(spans: InlineSpan[]): string {
  return spans
    .map((span) => {
      if (span.type === 'text' || span.type === 'bold' || span.type === 'italic' || span.type === 'code') {
        return span.text
      }
      if (span.type === 'link') return `${span.text} (${span.url})`
      return ''
    })
    .join('')
}

function flattenAst(blocks: Block[]): string {
  const out: string[] = []
  for (const block of blocks) {
    if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'quote') {
      out.push(inlineText(block.spans))
    } else if (block.type === 'list') {
      for (const item of block.items) out.push(inlineText(item))
    } else if (block.type === 'code') {
      out.push(block.text)
    } else if (block.type === 'table') {
      for (const cell of block.headers) out.push(inlineText(cell))
      for (const row of block.rows) for (const cell of row) out.push(inlineText(cell))
    }
  }
  return out.join('\n')
}

const flat = flattenAst(blocks)
for (const forbidden of [
  'SOURCE_REFS',
  'UNCERTAINTY',
  'source_refs',
  'claims_table',
  'open_questions',
  'answer_summary',
]) {
  assert.ok(!flat.includes(forbidden), `body do AST não pode conter "${forbidden}": ${flat}`)
}

// =====================================================================
// 2 · Headings editoriais PT-BR estão presentes (alimentam Type.tsx).
// =====================================================================

const headings = blocks.filter((b): b is Extract<Block, { type: 'heading' }> => b.type === 'heading')
const headingTexts = headings.map((h) => inlineText(h.spans))
assert.ok(headingTexts.includes('Resposta'), `headings esperam "Resposta": ${headingTexts.join(' | ')}`)
assert.ok(headingTexts.includes('Afirmações'), `headings esperam "Afirmações": ${headingTexts.join(' | ')}`)
assert.ok(headingTexts.includes('Perguntas em aberto'), `headings esperam "Perguntas em aberto": ${headingTexts.join(' | ')}`)

// =====================================================================
// 3 · DividerEditorial (✦) — pelo menos um block divider entre seções.
// =====================================================================

const dividerCount = blocks.filter((b) => b.type === 'divider').length
assert.ok(dividerCount >= 2, `esperava ≥2 divisores entre seções principais, obteve ${dividerCount}`)

// =====================================================================
// 4 · Tabela markdown legítima sobrevive (não é confundida com técnica).
// =====================================================================

const tables = blocks.filter((b): b is Extract<Block, { type: 'table' }> => b.type === 'table')
assert.equal(tables.length, 1, 'a tabela markdown da claims_table deve sobreviver')
assert.equal(tables[0].headers.length, 3)
assert.equal(tables[0].rows.length, 3)
const firstRowCells = tables[0].rows[0].map(inlineText)
assert.deepEqual(firstRowCells, ['Claude', '1.2s', 'sim'])

// =====================================================================
// 5 · Link inline preservado.
// =====================================================================

const allLinks: { text: string; url: string }[] = []
for (const block of blocks) {
  if (block.type === 'paragraph' || block.type === 'quote' || block.type === 'heading') {
    for (const span of block.spans) {
      if (span.type === 'link') allLinks.push({ text: span.text, url: span.url })
    }
  }
}
assert.ok(
  allLinks.some((l) => l.url === 'https://atlas.local/docs/hyperflow'),
  'link inline preservado no AST',
)

// =====================================================================
// 6 · Code fence preservado.
// =====================================================================

const codes = blocks.filter((b): b is Extract<Block, { type: 'code' }> => b.type === 'code')
assert.equal(codes.length, 1)
assert.equal(codes[0].lang, 'ts')
assert.ok(codes[0].text.includes('projectPresentation'))

// =====================================================================
// 7 · Lista de bullet (Perguntas em aberto) preservada como list ordered=false.
// =====================================================================

const lists = blocks.filter((b): b is Extract<Block, { type: 'list' }> => b.type === 'list')
assert.ok(lists.length >= 1)
assert.ok(lists.some((l) => l.ordered === false && l.items.length >= 2))

// =====================================================================
// 8 · Metadata.sections expõe source_refs + uncertainty para o ContextPanel.
// =====================================================================

assert.ok(
  result.metadata.sections.source_refs?.length === 3,
  `source_refs migrados para metadata: ${JSON.stringify(result.metadata.sections.source_refs)}`,
)
assert.ok(
  result.metadata.sections.uncertainty?.length === 1,
  `uncertainty migrado para metadata: ${JSON.stringify(result.metadata.sections.uncertainty)}`,
)
assert.ok(
  result.metadata.sections.source_refs?.[0].includes('atlas-ai-hyperflow-runtime.md'),
  'conteúdo do source_refs preservado intacto no metadata',
)
assert.ok(
  result.metadata.sections.uncertainty?.[0].includes('Não validamos'),
  'conteúdo do uncertainty preservado intacto no metadata',
)

// =====================================================================
// 9 · Snapshot legível para inspeção visual humana.
// =====================================================================

function renderSnapshot(): string {
  const lines: string[] = []
  lines.push('================================================================')
  lines.push('Atlas AI · Presentation Snapshot · Hyperflow V2 sanitization')
  lines.push('================================================================')
  lines.push('')
  lines.push('## raw response_text (regressed input from provider)')
  lines.push('----------------------------------------------------------------')
  lines.push(REGRESSED_RESPONSE_TEXT)
  lines.push('')
  lines.push('## body (após PresentationContract → EditorialMarkdown)')
  lines.push('----------------------------------------------------------------')
  lines.push(result.body)
  lines.push('')
  lines.push('## AST blocks (que EditorialMarkdown consome em React Native)')
  lines.push('----------------------------------------------------------------')
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
        lines.push(`heading h${block.level}: ${inlineText(block.spans)}`)
        break
      case 'divider':
        lines.push('divider ····················· (DividerEditorial · hairline ✦ hairline)')
        break
      case 'paragraph':
        lines.push(`paragraph: ${inlineText(block.spans)}`)
        break
      case 'list':
        lines.push(`list${block.ordered ? '[ordered]' : '[bullet]'}:`)
        for (const item of block.items) lines.push(`  · ${inlineText(item)}`)
        break
      case 'quote':
        lines.push(`quote: ${inlineText(block.spans)}`)
        break
      case 'code':
        lines.push(`code[${block.lang ?? 'plain'}]:`)
        for (const codeLine of block.text.split('\n')) lines.push(`  | ${codeLine}`)
        break
      case 'table':
        lines.push('table:')
        lines.push(`  headers: ${block.headers.map(inlineText).join(' | ')}`)
        for (const row of block.rows) lines.push(`  row: ${row.map(inlineText).join(' | ')}`)
        break
    }
  }
  lines.push('')
  lines.push('## metadata (consumido pelo AtlasAiContextSheet "auditoria")')
  lines.push('----------------------------------------------------------------')
  for (const [key, value] of Object.entries(result.metadata.sections)) {
    lines.push(`${key}:`)
    for (const item of value) lines.push(`  · ${item}`)
  }
  lines.push('')
  lines.push('## invariants')
  lines.push('----------------------------------------------------------------')
  lines.push(`- technical_sections_found: ${result.technicalSectionsFound}`)
  lines.push(`- editorial_headings:       ${headings.length}`)
  lines.push(`- divider_count:            ${dividerCount}`)
  lines.push(`- table_count:              ${tables.length}`)
  lines.push(`- list_count:               ${lists.length}`)
  lines.push(`- code_count:               ${codes.length}`)
  lines.push(`- link_count:               ${allLinks.length}`)
  lines.push('================================================================')
  return lines.join('\n')
}

const snapshotDir = join(process.cwd(), 'scripts', '__snapshots__')
mkdirSync(snapshotDir, { recursive: true })
const snapshotPath = join(snapshotDir, 'atlas-ai-presentation-snapshot.txt')
writeFileSync(snapshotPath, renderSnapshot(), 'utf8')

console.log('atlas-ai-presentation-snapshot: ok')
console.log(`snapshot escrito em: ${snapshotPath}`)
