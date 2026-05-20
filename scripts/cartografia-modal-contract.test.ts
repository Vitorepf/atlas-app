import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const modalSource = readFileSync(
  join(process.cwd(), 'components', 'cartografia', 'focus', 'GearInfoModal.tsx'),
  'utf8',
)

const nomenclatureContract = readFileSync(
  join(
    process.cwd(),
    '..',
    'atlas-server',
    'docs',
    'engineering-knowledge-base',
    'atlas-cartography-nomenclature-contract.md',
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

assert.match(
  modalSource,
  /if \(!info\) return null/,
  'GearInfoModal must unmount completely when closed; an invisible native Modal can block the cartography canvas',
)

assert.doesNotMatch(
  modalSource,
  /visible=\{Boolean\(info\)\}/,
  'GearInfoModal must not keep a Modal mounted with visible={false}',
)

assert.doesNotMatch(
  modalSource,
  /<Modal\b/,
  'GearInfoModal must not use native Modal here; stale native modal layers can block the cartography canvas after close',
)

assert.match(
  modalSource,
  /pointerEvents="auto"/,
  'GearInfoModal should only capture touches while its overlay is mounted',
)

for (const section of [
  'Resposta em 30 segundos',
  'Responsabilidade',
  'Leitura por área',
  'Fluxo operacional',
  'Limites de mudança',
  'Riscos e falhas',
  'Evidências e testes',
  'Próximas ações',
  'Governança',
  'Nomenclatura: não confundir',
  'Patamares',
  'Versões',
  'Posição no mapa',
  'Arquivos canônicos',
  'Documentação relacionada',
  'Como ler este modal',
  'LEITURA GUIADA',
  'PATAMARES',
  'VERSÕES',
  'RESPOSTA HUMANA',
  'COMEÇE AQUI',
  'RESUMO EXECUTIVO · 30 SEGUNDOS',
  'PATAMARES ≠ VERSÕES',
  'NOMENCLATURA SEM MISTURA',
  'MANUAL HUMANO',
  'LEITURA RÁPIDA ANTES DA IA',
  'QUADRO DE DECISÃO',
  'RESPOSTAS ANTES DE PEDIR IA',
  'MATRIZ DE ENTENDIMENTO',
  'DIRETORIA · SUPORTE · TECH · PARCEIROS',
  'RESPOSTA PARA HUMANO',
  'FLUXO VERDADEIRO',
  'Como confiar antes de pedir IA',
]) {
  assert.match(
    modalSource,
    new RegExp(section),
    `GearInfoModal must expose the human documentation section [${section}]`,
  )
}

for (const audience of [
  'Diretoria',
  'Produto / Operação',
  'Marketing / Comunicação',
  'Suporte',
  'Financeiro / Jurídico',
  'Tech / IA',
  'Parceiros',
]) {
  assert.match(
    modalSource,
    new RegExp(audience.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `GearInfoModal must translate documentation for non-technical audience [${audience}]`,
  )
}

assert.doesNotMatch(
  modalSource,
  /Patamares e fonte/,
  'GearInfoModal must not mix conceptual patamar with canonical source files',
)

assert.doesNotMatch(
  modalSource,
  /Patamar\/camada conceitual/,
  'GearInfoModal must not describe patamar as a generic layer; patamar is a maturity/capability jump',
)

assert.match(
  modalSource,
  /Self-Programming OS: auto-modificação governada/,
  'GearInfoModal must know that Self-Programming OS is the next patamar after Self-Construction OS',
)

assert.match(
  modalSource,
  /Este contrato apoia o proximo patamar Self-Programming OS, mas nao e o patamar por si so/,
  'GearInfoModal must not mislabel the Self-Programming Safety Contract as the Self-Programming OS patamar',
)

assert.ok(
  modalSource.indexOf("pathHint.includes('self-programming-safety-contract')") > -1
    && modalSource.indexOf("pathHint.includes('self-programming-safety-contract')")
      < modalSource.indexOf("title.includes('self-construction')"),
  'GearInfoModal must classify the Self-Programming Safety Contract before any Self-Construction path/name inference',
)

assert.match(
  modalSource,
  /## 12\. Versões/,
  'GearInfoModal must give versions their own category instead of hiding them inside patamares',
)

assert.doesNotMatch(
  modalSource,
  /Patamar aqui significa/,
  'GearInfoModal Patamares section must stay compact and not render glossary prose in the modal',
)

assert.doesNotMatch(
  modalSource,
  /Leia esta categoria em quatro linhas separadas/,
  'GearInfoModal Patamares section must not render long reading instructions in the modal',
)

assert.doesNotMatch(
  modalSource,
  /esta categoria só pode usar campos canônicos de patamar/,
  'GearInfoModal Patamares section must not render policy prose in the modal',
)

assert.doesNotMatch(
  modalSource,
  /Desbloqueia \$\{listText\(info\.unlocks\)\}/,
  'GearInfoModal must not turn unlocks into next patamar; unlocks are operational flow, not maturity',
)

assert.doesNotMatch(
  modalSource,
  /Prepara \$\{listText\(info\.flowsTo\)\}/,
  'GearInfoModal must not turn flows_to into next patamar; flows_to is routing, not maturity',
)

assert.doesNotMatch(
  modalSource,
  /A documentação declara camada/,
  'GearInfoModal must not turn graph layer into patamar; layer is map position only',
)

for (const governanceField of [
  /DONO \/ GOVERNANÇA/,
  /owner/,
  /category/,
  /priority/,
  /docSchema/,
  /maintenance/,
  /lineLimit/,
  /Governança não é patamar, versão, fonte nem camada/,
]) {
  assert.match(
    modalSource,
    governanceField,
    `GearInfoModal must keep governance metadata explicit and separate [${governanceField.source}]`,
  )
}

for (const explicitNomenclatureField of [
  /patamarCurrent/,
  /patamarNextOf/,
  /patamarNext/,
  /patamarAfter/,
  /versionFamily/,
  /versions/,
  /versionNote/,
  /schemaVersion/,
  /relatedPaths/,
  /campos canônicos de patamar/,
]) {
  assert.match(
    modalSource,
    explicitNomenclatureField,
    `GearInfoModal must prefer explicit nomenclature fields over fragile name inference [${explicitNomenclatureField.source}]`,
  )
}

assert.match(
  modalSource,
  /buildVersionSummary/,
  'GearInfoModal must deliberately compute version meaning separately from patamar meaning',
)

assert.match(
  modalSource,
  /buildManualSections/,
  'GearInfoModal must provide a native human manual before the long markdown document',
)

assert.match(
  modalSource,
  /buildExecutiveBrief/,
  'GearInfoModal must build a first-fold executive brief before dense documentation',
)

assert.ok(
  modalSource.indexOf('{executiveBrief ? <ExecutiveBrief brief={executiveBrief} /> : null}') > -1
    && modalSource.indexOf('{executiveBrief ? <ExecutiveBrief brief={executiveBrief} /> : null}') < modalSource.indexOf('<HumanAnswerGrid cards={primerCards} />'),
  'GearInfoModal must show the executive 30-second brief before detailed answer cards',
)

assert.ok(
  modalSource.indexOf('<HumanAnswerGrid cards={primerCards} />') > -1
    && modalSource.indexOf('<HumanAnswerGrid cards={primerCards} />') < modalSource.indexOf('<HumanManualDeck sections={manualSections} health={healthChecklist} />'),
  'GearInfoModal must answer essential human questions before the long manual deck',
)

assert.ok(
  modalSource.indexOf('{flowCompass ? <FlowCompass compass={flowCompass} /> : null}') > -1
    && modalSource.indexOf('{flowCompass ? <FlowCompass compass={flowCompass} /> : null}') < modalSource.indexOf('<DecisionBoard rows={decisionBoardRows} />'),
  'GearInfoModal must show the visual entrada -> peça -> saída map before the decision checklist',
)

assert.ok(
  modalSource.indexOf('{maturityPanel ? <MaturityPanel panel={maturityPanel} /> : null}') > -1
    && modalSource.indexOf('{maturityPanel ? <MaturityPanel panel={maturityPanel} /> : null}') < modalSource.indexOf('<HumanBrief rows={onboardingRows} />'),
  'GearInfoModal must separate patamar/version early, before secondary onboarding prose',
)

assert.match(
  modalSource,
  /buildHealthChecklist/,
  'GearInfoModal must show documentation completeness checks visually inside the modal',
)

assert.match(
  modalSource,
  /Patamar ainda não declarado\. Não inferir por camada, fonte, versão ou próximo bloco/,
  'GearInfoModal must tell the user when patamar is absent instead of inventing it from graph flow',
)

assert.match(
  modalSource,
  /Próximo patamar não é próximo bloco, camada, fonte, fluxo, unlock nem versão/,
  'GearInfoModal must explicitly separate next patamar from visual flow/layer/source/version',
)

assert.match(
  modalSource,
  /Fonte não é patamar, versão, regra nem prova/,
  'GearInfoModal must keep canonical sources separated from maturity/version/rules/proofs',
)

assert.match(
  modalSource,
  /Versões\/degraus citados/,
  'GearInfoModal must show detected V*/schema/release markers as versions, not as maturity patamares',
)

assert.match(
  modalSource,
  /É próximo patamar de:/,
  'GearInfoModal quick facts must show when a piece is the next patamar of another piece',
)

assert.match(
  modalSource,
  /Outros patamares depois:/,
  'GearInfoModal must reserve a separate patamar-after line instead of mixing future maturity with version/source fields',
)

for (const namingGuard of [
  /buildNomenclatureRows/,
  /Cada categoria abaixo responde uma pergunta diferente/,
  /não inferir por camada, versão, fonte, fluxo ou nome parecido/,
  /camada localiza no mapa, não mede maturidade/,
  /leitura auxiliar, não patamar/,
  /prova é teste\/evidência, não fonte e não patamar/,
]) {
  assert.match(
    modalSource,
    namingGuard,
    `GearInfoModal must teach nomenclature separation [${namingGuard.source}]`,
  )
}

assert.match(
  modalSource,
  /Atlas Vox V0\/V3\/V4\/V6/,
  'GearInfoModal must explain that Atlas Vox V* labels are versions/ladder steps, not canonical patamares by default',
)

for (const contract of [
  /Patamar significa salto de capacidade\/maturidade/,
  /Proximo patamar significa evolucao de maturidade, nao proxima etapa visual/,
  /Versao significa revisao, schema, fase ou release/,
  /Camada significa localizacao visual\/conceitual/,
  /Fonte significa arquivo canonico/,
  /Regra De Bolso/,
  /Salto de maturidade\/capacidade/,
  /Atlas Vox pode\s+ter muitas versoes e nenhum patamar declarado/,
  /Patamar ainda nao declarado` e listar `V0\/V3\/V4\/V6` somente em `Versoes`/,
  /Versoes`: V0\/V1\/V4\/V6, schema_version, release, fase, geracao e nota/,
  /Campos canonicos: `patamar_current`, `patamar_next_of`,/,
  /Campos canonicos: `version_family`, `versions`, `version_note`,/,
  /Contrato De Frontmatter/,
  /patamar_next: Self-Programming OS/,
  /`Self-Programming Safety Contract` nao e automaticamente o patamar/,
  /version_family: Atlas Vox/,
  /No modal, a categoria deve responder quatro perguntas separadas/,
  /Atlas Vox pode ter varias versoes/,
  /Nao usar `flows_to`, `unlocks`, `graph_layer`, nome da pasta,/,
  /Glossario De Nomenclatura Para Modal/,
  /\| Riscos \| `risk_level`, `failure_modes`/,
  /\| Regras \| `allowed_changes`, `forbidden_changes`/,
  /Regra De Patamar/,
  /Regra De Proximo Patamar/,
  /Proximo patamar nao significa "proximo bloco", "proxima camada", "proximo\s+arquivo"/,
  /`Atlas Vox` pode ter varias versoes sem ter patamares declarados/,
  /Regra De Versao/,
  /Leitura guiada`: primeira area do modal/,
  /entender a peca, ver o caminho, conferir maturidade\/patamar/,
  /Patamar atual`: o nivel de capacidade/,
  /E proximo patamar de`: a peca anterior/,
  /Proximo patamar`: o salto de maturidade/,
  /Outros patamares depois`: horizonte de maturidade/,
  /Essas quatro linhas sao independentes/,
  /Uma peca\s+tambem pode ter versoes sem declarar nenhum patamar/,
  /Se todos esses campos estiverem vazios, escrever "patamar ainda nao declarado"/,
  /Versao pode existir em produto, API, prompt, documento, schema ou runtime sem/,
  /no modal de Atlas Vox, `V0\/V3\/V4\/V6` deve aparecer em `Versoes`/,
  /Uma engrenagem que tem `flows_to: decision-receipt` apenas entrega para/,
  /Uma engrenagem visual com `target_graph_id: atlas-decide` deve abrir o fluxo/,
  /Isso e navegacao visual, nao\s+patamar e nao versao/,
  /Atlas Vox V0\/V3\/V4\/V6 sao versoes\/degraus da Escada Vox/,
  /Voice Realtime Surface nao e Atlas Vox/,
  /Regra de nomenclatura para modais/,
  /Se a peca e o proximo patamar de outra,\s+declarar `patamar_next_of`/,
  /Atlas Vox pode ter varias versoes, mas essas\s+versoes nao sao patamares/,
]) {
  assert.match(
    nomenclatureContract,
    contract,
    `Cartography nomenclature contract must document [${contract.source}]`,
  )
}

for (const cartographyContract of [
  /docs\/engineering-knowledge-base\/atlas-cartography-nomenclature-contract\.md/,
  /npm run test:cartografia/,
  /Tap navega visualmente: mundo -> sistema -> fluxo -> engrenagem -> subfluxo/,
  /Long press explica textualmente: o que e, para que existe, como entra, como sai,/,
  /Fluxo operacional, dependencia, unlock, camada e versao nunca podem ser tratados\s+como patamar/,
  /se nao tiver subfluxo, mostra fluxo terminal documentado/,
  /se nem isso existir, mostra lacuna documental explicita/,
  /Atlas Vox V0\/V3\/V4\/V6` sao versoes/,
  /`Voice Realtime Surface`\s+e surface tecnica de audio; `Atlas Vox` e programa produto\/arquitetura/,
]) {
  assert.match(
    cartographicKnowledgeOs,
    cartographyContract,
    `Cartographic Knowledge OS must point IAs to the nomenclature/test contract [${cartographyContract.source}]`,
  )
}

for (const creationGateContract of [
  /Contrato Do Modal Humano/,
  /Long press e o unico lugar da Cartografia onde texto estruturado pode ser\s+denso/,
  /nao pode virar dump de frontmatter/,
  /suporte, financeiro, marketing, tech, diretoria ou parceiro/,
  /Perguntas essenciais: o que e, para que existe, como entra, como sai,/,
  /Mapa rapido: entrada -> peca atual -> saida/,
  /Patamares e versoes: maturidade separada de release\/degrau/,
  /Saude documental: campos presentes e ausentes sem esconder lacuna/,
  /Documento Markdown completo como aprofundamento, nunca como primeira coisa/,
  /Nunca mover fonte para patamar, patamar\s+para versao, risco para regra, teste para fonte ou fluxo operacional para\s+proximo patamar/,
]) {
  assert.match(
    documentationCreationGate,
    creationGateContract,
    `Documentation Creation Gate must govern modal human-doc order [${creationGateContract.source}]`,
  )
}

assert.doesNotMatch(
  modalSource,
  /Risco e regra/,
  'GearInfoModal must not mix risks with change rules; they are different decisions for humans',
)

assert.doesNotMatch(
  nomenclatureContract,
  /Risco e regra/,
  'Cartography nomenclature contract must not mix risks with change rules',
)

assert.match(
  modalSource,
  /<ScrollView/,
  'GearInfoModal must remain scrollable because documentation can be long',
)

assert.match(
  modalSource,
  /EditorialMarkdown/,
  'GearInfoModal must render structured Markdown documentation, not a loose text dump',
)

assert.match(
  modalSource,
  /canonicalPaths/,
  'GearInfoModal must keep related canonical documents in their own prepared list instead of mixing them with source, patamar, proof or version',
)

assert.match(
  modalSource,
  /QuickFact/,
  'GearInfoModal must start with quick human-facing facts before detailed frontmatter',
)

for (const nativeDocumentationSurface of [
  /HumanAnswerGrid/,
  /ExecutiveBrief/,
  /ExecutiveFlowCell/,
  /ExecutiveAction/,
  /executiveFlow/,
  /executiveActions/,
  /DecisionBoard/,
  /buildDecisionBoardRows/,
  /AudienceMatrix/,
  /buildAudienceMatrixRows/,
  /markdownTable/,
  /buildPrimerCards/,
  /MaturityPanel/,
  /buildMaturityPanel/,
  /PatamarTimeline/,
  /LINHA DE MATURIDADE/,
  /VEM DE/,
  /ATUAL/,
  /PRÓXIMO/,
  /DEPOIS/,
  /NomenclatureGuard/,
  /buildNomenclatureCards/,
  /RESPOSTA CURTA/,
  /PROPÓSITO/,
  /CAMINHO/,
  /PROVA/,
  /CUIDADO/,
  /ORIGEM/,
  /Próximo passo/,
  /Patamar atual/,
  /É próximo patamar de/,
  /Outros patamares depois/,
  /Família de versão/,
  /Versões \/ degraus/,
  /Cada categoria responde uma pergunta diferente/,
  /Leia de cima para baixo\. Se uma linha estiver ausente/,
  /Antes de mexer/,
  /Bloqueie se/,
  /A mesma peça traduzida para cada área/,
  /DECISÃO SEGURA/,
  /ESSÊNCIA/,
  /PROPÓSITO/,
  /ENTRADA/,
  /SAÍDA/,
  /LIMITE/,
]) {
  assert.match(
    modalSource,
    nativeDocumentationSurface,
    `GearInfoModal must expose native human documentation surface [${nativeDocumentationSurface.source}]`,
  )
}

assert.match(
  modalSource,
  /HumanBrief/,
  'GearInfoModal must include a guided human-reading block before the dense documentation document',
)

assert.match(
  modalSource,
  /buildOnboardingRows/,
  'GearInfoModal must build a deliberate onboarding order for non-technical readers',
)

for (const guidedStep of [
  /1 · ENTENDA/,
  /2 · CAMINHO/,
  /3 · MATURIDADE/,
  /4 · PROVA/,
  /entenda a peça → veja o caminho → confira maturidade → valide prova/,
]) {
  assert.match(
    modalSource,
    guidedStep,
    `GearInfoModal must expose guided reading step [${guidedStep.source}]`,
  )
}

assert.match(
  modalSource,
  /Perguntas essenciais/,
  'GearInfoModal must answer the basic human questions before exposing dense documentation fields',
)

assert.match(
  modalSource,
  /Saúde documental/,
  'GearInfoModal must expose whether the documentation is complete or missing important fields',
)

for (const healthField of [
  /Resumo humano/,
  /Fluxo de entrada\/saída/,
  /Responsabilidade/,
  /Regras de mudança/,
  /Riscos/,
  /Testes e evidências/,
  /Fonte canônica/,
  /Documentação relacionada/,
  /Governança/,
  /Patamar/,
  /Versão/,
]) {
  assert.match(
    modalSource,
    healthField,
    `GearInfoModal documentation health must audit [${healthField.source}]`,
  )
}

for (const essentialQuestion of [
  /O que é\?/,
  /Para que existe\?/,
  /Como entra\?/,
  /Como sai\?/,
  /Como provo\?/,
  /O que não posso confundir\?/,
  /Quais limites importam\?/,
]) {
  assert.match(
    modalSource,
    essentialQuestion,
    `GearInfoModal must answer essential onboarding question [${essentialQuestion.source}]`,
  )
}

assert.match(
  modalSource,
  /FlowCompass/,
  'GearInfoModal must render a visual flow compass before the long Markdown document',
)

assert.match(
  modalSource,
  /MAPA RÁPIDO/,
  'GearInfoModal must expose an immediate entrada -> engrenagem -> saida reading map',
)

assert.match(
  modalSource,
  /ÍNDICE HUMANO/,
  'GearInfoModal must expose a human reading index so non-technical users can scan the documentation quickly',
)

assert.match(
  modalSource,
  /'governança'/,
  'GearInfoModal reading index must expose governança as a separate human category',
)

assert.match(
  modalSource,
  /'nomes'/,
  'GearInfoModal reading index must expose nomenclature as a separate human category',
)

assert.match(
  modalSource,
  /'docs'/,
  'GearInfoModal reading index must expose related documentation separately from source files',
)

assert.doesNotMatch(
  modalSource,
  /numberOfLines=\{3\}/,
  'GearInfoModal quick facts must not silently clip documentation; the sheet is scrollable so text must remain visible',
)

assert.doesNotMatch(
  modalSource,
  /width: '48%'/,
  'GearInfoModal quick facts must not use a cramped two-column grid on mobile documentation',
)

assert.doesNotMatch(
  modalSource,
  /\| Área \| O que precisa entender \|/,
  'GearInfoModal must not use cramped mobile tables for audience explanations; use readable labeled sections',
)

assert.match(
  modalSource,
  /labeledMarkdownList/,
  'GearInfoModal must render labeled human-readable Markdown bullets instead of loose raw frontmatter dumps',
)

assert.match(
  modalSource,
  /orderedMarkdownList/,
  'GearInfoModal must render operational flow as ordered Markdown steps',
)

assert.match(
  modalSource,
  /buildDocumentationMarkdown/,
  'GearInfoModal must build a deliberate documentation document instead of dumping raw graph fields',
)

assert.match(
  modalSource,
  /buildAudienceRows/,
  'GearInfoModal must include an audience reading layer for support, finance, marketing/product, tech and partners',
)

assert.match(
  modalSource,
  /buildPatamarSummary/,
  'GearInfoModal must deliberately compute patamar meaning instead of dumping raw frontmatter layer fields',
)

assert.doesNotMatch(
  modalSource,
  /Atlas Vox V0\/V3\/V4\/V6 deve ficar em Versões, não aqui/,
  'GearInfoModal must not render long Vox warning prose inside Patamares',
)

for (const contract of [
  'onPrevious',
  'onNext',
  'hasPrevious',
  'hasNext',
  'Engrenagem anterior',
  'Próxima engrenagem',
  'Fechar detalhes da engrenagem',
]) {
  assert.match(
    modalSource,
    new RegExp(contract),
    `GearInfoModal must keep the modal navigation contract [${contract}]`,
  )
}

assert.match(
  modalSource,
  /accessibilityState=\{\{ disabled: !enabled \}\}/,
  'GearInfoModal previous/next buttons must expose disabled state instead of becoming invisible or misleading',
)

console.log('cartografia modal contract tests passed')
