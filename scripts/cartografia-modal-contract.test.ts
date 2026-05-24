import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const modalSource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'focus', 'GearInfoModal.tsx'),
  'utf8',
)

const documentationCreationGate = readFileSync(
  join(
    process.cwd(),
    '..',
    'atlas-server',
    'docs',
    'engineering-knowledge-base',
    'atlas-documentation-creation-gate.md',
  ),
  'utf8',
)

const cartographicKnowledgeOs = readFileSync(
  join(
    process.cwd(),
    '..',
    'atlas-server',
    'docs',
    'engineering-knowledge-base',
    'atlas-cartographic-knowledge-os.md',
  ),
  'utf8',
)

assert.match(
  modalSource,
  /if \(!info\) return null/,
  'GearInfoModal must unmount completely when closed',
)

assert.doesNotMatch(
  modalSource,
  /<Modal\b|visible=\{Boolean\(info\)\}/,
  'GearInfoModal must not keep native Modal layers mounted after close',
)

assert.match(
  modalSource,
  /pointerEvents="auto"/,
  'GearInfoModal should capture touches only while mounted',
)

for (const required of [
  /EditorialMarkdown/,
  /buildBriefMarkdownDocument/,
  /buildDetailedMarkdownDocument/,
  /buildSourceMarkdownDocument/,
  /markdownTable/,
  /docLink/,
  /nodeLink/,
  /linkedNodeText/,
  /onLinkPress/,
  /atlas:\/\/cartografia\//,
  /atlas:\/\/doc\//,
  /atlas:\/\/source\//,
  /apiGet<CartographyNoteResponse>/,
  /type ModalMode = 'brief' \| 'detail' \| 'source'/,
  /label="30s"/,
  /label="Detalhe"/,
  /label="Fonte"/,
  /runtimeAcronym/,
  /internalProductName/,
  /technicalRuntime/,
  /artifactLakePacks/,
  /artifactPackTableRows/,
  /Packs AWIS persistidos/,
  /## 30 segundos/,
  /## Próximos cliques/,
  /## 1\. Identidade/,
  /## 2\. Em uma frase/,
  /## 3\. Como ler no mapa/,
  /## 4\. Evolução/,
  /## 5\. Segurança/,
  /## 6\. Fonte/,
  /> \$\{prepared\.summary/,
  /---/,
  /bulletList/,
]) {
  assert.match(modalSource, required, `GearInfoModal must expose markdown editorial layer [${required.source}]`)
}

for (const essentialField of [
  /\['Nome humano'/,
  /\['Nome canônico'/,
  /\['Acrônimo'/,
  /\['Superfície interna'/,
  /\['Runtime técnico'/,
  /\['Tipo'/,
  /\['Status'/,
  /\['Fonte canônica'/,
]) {
  assert.match(modalSource, essentialField, `Essential layer must preserve identity field [${essentialField.source}]`)
}

for (const removedNoise of [
  /RESPOSTA HUMANA/,
  /Resumo curto/,
  /buildCalmCards/,
  /buildCalmQuickFacts/,
  /QuickFact/,
  /AudienceMatrix/,
  /MATRIZ DE ENTENDIMENTO/,
  /Diretoria/,
  /Produto \/ Operação/,
  /Marketing \/ Comunicação/,
  /Suporte/,
  /Financeiro \/ Jurídico/,
  /Parceiros/,
  /HumanManualDeck/,
  /DecisionBoard/,
  /ReadingSectionCard/,
  /sectionCard/,
]) {
  assert.doesNotMatch(modalSource, removedNoise, `Mobile modal must not carry noisy old section [${removedNoise.source}]`)
}

assert.doesNotMatch(
  modalSource,
  /Fonte[\s\S]{0,80}Teste[\s\S]{0,80}Evidência/,
  'Source, test and evidence must not be rendered as three loose repeated cards',
)

assert.match(
  modalSource,
  /Patamar ainda não declarado/,
  'Modal must explicitly say when patamar is absent instead of inventing maturity',
)

assert.match(
  modalSource,
  /Versão ainda não declarada/,
  'Modal must keep versions separate from patamares',
)

assert.match(
  modalSource,
  /Atlas Vox V0\/V3\/V4\/V6 são versões ou degraus, não patamares canônicos por padrão/,
  'Modal must keep Vox versions out of patamar inference',
)

assert.match(modalSource, /Fonte canônica/, 'Modal must keep canonical source visible inside the source layer')

for (const contract of [
  /Contrato Do Modal Humano/,
  /Long press abre a explicacao humana da peca/,
  /nao pode ser dump de\s+frontmatter/,
  /A ordem canonica obrigatoria tem 7 camadas/,
  /\| 1\. Essencial \| nome humano, nome tecnico\/canonico, tipo, status, fonte canonica/,
  /\| 5\. Patamares \| patamar atual, proximo patamar de, proximo patamar e cadeia futura/,
  /\| 6\. Versoes \| schema, release, familia e versoes internas/,
  /Nunca mover fonte para patamar, patamar para versao, risco para regra,\s+teste para fonte ou fluxo operacional para proximo patamar/,
]) {
  assert.match(
    documentationCreationGate,
    contract,
    `Documentation Creation Gate must define modal contract [${contract.source}]`,
  )
}

for (const cartographyContract of [
  /Tap navega visualmente: mundo -> sistema -> fluxo -> engrenagem -> subfluxo/,
  /Long press explica textualmente: o que e, para que existe, como entra, como sai,/,
  /Fluxo operacional, dependencia, unlock, camada e versao nunca podem ser tratados\s+como patamar/,
]) {
  assert.match(
    cartographicKnowledgeOs,
    cartographyContract,
    `Cartographic Knowledge OS must define tap/long-press separation [${cartographyContract.source}]`,
  )
}

console.log('cartografia modal contract tests passed')
