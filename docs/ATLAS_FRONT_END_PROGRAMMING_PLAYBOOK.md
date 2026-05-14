# Atlas Front-End Programming Playbook

Guia para o Atlas em modo Programacao quando o trabalho envolve front-end. Este documento transforma o valor do Impeccable e os contratos do Atlas em um fluxo executavel para agentes: entender, implementar, validar, polir e entregar sem quebrar layout, performance ou identidade.

Use junto com `docs/ATLAS_FRONT_END_OPERATING_SYSTEM.md`. O Operating System define o produto; este playbook define como programar front-end dentro dele.

## 1. Quando Usar

Use este playbook quando a tarefa envolver:

- tela, componente, sheet, dock, header, lista, formulario ou estado visual;
- Atlas AI, Inbox, Edicao, Settings, Agenda, Memory, Engineering ou mobile flow;
- performance percebida de tela;
- anexos, previews, PDF, imagem, YouTube ou mensagens longas;
- refatoracao de front-end sem mudar layout;
- implementacao de uma nova experiencia visual.

Nao use como desculpa para redesenhar tudo. Em produto existente, preservar layout e comportamento e parte da entrega.

## 2. Entrada Obrigatoria Do Agente

Antes de editar, o agente deve responder internamente:

1. Qual e a superficie? Tela, sheet, componente ou fluxo.
2. Qual tarefa real do usuario?
3. Qual estado atual nao pode quebrar?
4. Qual arquivo e fonte de verdade?
5. A mudanca e visual, funcional, performance ou arquitetura?
6. Como vou validar?

Se nao conseguir responder, ler codigo antes de propor.

## 3. Fluxo Canonico

### A. Teach

Coletar contexto do repo.

Ler no minimo:

- `docs/ATLAS_FRONT_END_OPERATING_SYSTEM.md`
- `design/tokens.ts`
- `design/Type.tsx`
- arquivo da tela/componente alvo
- helper/model associado em `lib/` ou `components/sheets/atlas-ai/`

Saida mental:

- registro: sempre `product`;
- objetivo do usuario;
- restricoes de layout;
- contratos de dados;
- estados extremos.

### B. Shape

Definir o plano de implementacao.

O plano deve conter:

- arquivos que serao tocados;
- arquivos que nao serao tocados;
- impacto visual esperado;
- estado de loading/empty/error;
- validacao por teste, typecheck ou screenshot.

Regra:

- Se o pedido for "sem mudar layout", a shape deve dizer como vai preservar layout.
- Se for refatoracao, definir fronteiras e evitar refatorar estilos junto com logica.

### C. Craft

Implementar em codigo real.

Padroes:

- Usar `apply_patch` para edicoes manuais.
- Usar tokens existentes.
- Extrair logica pesada para model/helper.
- Separar view, model e side effects quando o arquivo estiver grande.
- Manter nomes do dominio Atlas, nao nomes genericos de SaaS.
- Nao misturar melhoria visual com mudanca de contrato de API sem necessidade.

### D. Polish

Refinar sem inventar nova direcao.

Checar:

- ritmo vertical;
- line-height;
- truncamento;
- safe area;
- teclado aberto;
- contraste;
- target tocavel;
- estados ativos/desabilitados;
- microcopy curta.

### E. Harden

Testar realidade.

Obrigatorio considerar:

- rede lenta;
- resposta vazia;
- erro 4xx/5xx;
- dados cacheados;
- conteudo longo;
- nomes longos;
- anexos multiplos;
- PDF sem texto;
- imagem grande;
- YouTube sem transcricao;
- thread antiga;
- retorno de background;
- deep link;
- usuario tocando rapido varias vezes.

### F. Audit

Antes de finalizar:

- `git diff --check`;
- `npm run typecheck` quando o escopo justificar;
- teste especifico quando existir;
- screenshot/verificacao visual quando layout mudou;
- explicar o que foi validado e o que nao foi.

## 4. Regras De Programacao Front-End Atlas

### Layout

- Nao alterar layout canonico sem necessidade explicita.
- Nao centralizar tudo por reflexo.
- Nao usar card dentro de card.
- Nao usar modal para fluxo que merece pagina/sheet propria.
- Nao introduzir hero/landing page em app operacional.
- Componentes fixos precisam ter dimensoes estaveis.

### Tipografia

- Fraunces para editorial e pensamento.
- Inter para leitura funcional.
- JetBrains Mono para dados, horarios, specs e status.
- Corpo longo em Inter.
- Evitar italic serif em excesso.
- Nao usar mono so para parecer tecnico.

### Cor

- Bronze como acento.
- Prussiano para informacao tecnica/fria.
- Vermelho apenas para risco, falha ou destrutivo.
- Nao criar paleta nova.
- Nao usar gradiente como atalho de "premium".

### Motion

- Movimento deve explicar estado.
- Evitar bounce infantil.
- Sheet, toast e gestos devem usar tokens de spring/ease.
- Animacao nao pode atrasar toque comum.

### Copy

- Curta, honesta, util.
- Erro precisa ter proxima acao.
- Lacuna de IA deve ser declarada sem drama.
- Evitar texto educativo dentro da UI quando o comportamento e obvio.

## 5. Atlas AI Front-End

Contratos obrigatorios:

- Conversa nova deve ser realmente nova.
- Captura/conversa so e classificado em thread vazia.
- Depois de iniciar conversa, nao reclassificar automaticamente como captura.
- Anexos precisam ter preview antes do envio e acesso depois.
- YouTube precisa mostrar fonte: cache, legenda, Whisper, audio, fallback web ou metadados.
- Long messages devem virar leitura estruturada ou anexo textual quando necessario.
- Recovery de envio pendente nao pode duplicar mensagem sem sinal claro.

Arquivos principais:

- `components/sheets/AtlasAiSheet.tsx`
- `components/sheets/atlas-ai/AtlasAiComposerFooter.tsx`
- `components/sheets/atlas-ai/AtlasAiAttachmentModel.ts`
- `components/sheets/atlas-ai/AtlasAiAttachments.tsx`
- `components/sheets/atlas-ai/AtlasAiTurnModel.ts`
- `components/sheets/atlas-ai/AtlasAiLongMessageModel.ts`
- `components/sheets/atlas-ai/AtlasAiSubmissionRecovery.ts`
- `lib/atlasAiRuntime.ts`
- `lib/atlasAiThreadRouting.ts`
- `lib/atlasAiModeContract.ts`

Validacao recomendada:

- `npm run test:atlas-ai`
- teste manual de nova conversa;
- teste manual com imagem;
- teste manual com mensagem longa;
- teste manual com link YouTube.

## 6. Inbox Front-End

Contratos obrigatorios:

- Layout canonico deve ser preservado.
- Filtros e contadores precisam bater com modelos.
- Lista deve continuar rapida.
- Swipe/action nao pode perder `requires_confirm`.
- Dock nao pode cobrir conteudo importante.
- Timeline usa "hoje", "ontem" e data por extenso.

Arquivos principais:

- `components/inbox/InboxScreen.tsx`
- `components/inbox/InboxCaptureList.tsx`
- `components/inbox/inboxScreenStyles.ts`
- `components/inbox/mobileInboxItemStyles.ts`
- `lib/inboxCaptureModels.ts`
- `lib/inboxOperational.ts`
- `lib/useInboxCaptures.ts`
- `lib/useOperationalInbox.ts`

Validacao recomendada:

- `npm run test:engineering`
- conferir filtros: abertas, candidatas, propostas, adiadas, falhas, pendentes;
- screenshot mobile antes/depois se houve layout.

## 7. Edicao, Agenda E Settings

Contratos obrigatorios:

- Mostrar cache imediatamente quando existir.
- Atualizar em background.
- Nao bloquear tela inteira se cache e valido.
- Settings deve abrir com shell imediato.
- Agenda nao pode inventar dado ausente.

Arquivos principais:

- `app/edicao.tsx`
- `components/sheets/SettingsSheet.tsx`
- `lib/editionHomeCache.ts`
- `lib/agenda.ts`
- `lib/performanceTelemetry.ts`

Eventos:

- `edition_visible_ms`
- `settings_open_ms`

## 8. Memoria, Open Brain E Provider-Safe

Contratos obrigatorios:

- Memoria externa precisa ser provider-safe.
- Bloquear tokens, JWT, private key, cloud key e provider token.
- Projection nao aplica com drift manual.
- Purge precisa de simulacao/confirmacao.
- Context pack deve declarar refs, memorias, recall, budget e hash.

Arquivos principais:

- `app/memory.tsx`
- `app/open-brain.tsx`
- `lib/openBrain.ts`
- `lib/memoryReviewSafety.ts`
- `lib/memoryProviderProjection.ts`
- `lib/memoryReviewBatch.ts`
- `lib/memoryReviewFilters.ts`

Validacao recomendada:

- `npm run test:memory`

## 9. Mobile Runtime

Contratos obrigatorios:

- Expo Go nao e ambiente real do Atlas.
- Development Build e obrigatorio para HealthKit, audio nativo e background.
- Deep links `atlas://` devem ser tolerantes a launch frio.
- Storage usa MMKV com migracao AsyncStorage best-effort.
- Sync offline nao pode perder fila local.

Arquivos principais:

- `app.config.js`
- `app.json`
- `lib/storage.ts`
- `lib/deepLinks.ts`
- `lib/atlasDeepLinkCore.ts`
- `lib/mobileThreadBridge.ts`
- `lib/atlasStore.ts`

Validacao recomendada:

- `npm run dev:ios`
- `npm run dev:ios:clear` quando Metro/cache estiver inconsistente;
- `npm run build:ios:dev` quando mudar nativo/config.

## 10. Checklist De PR Ou Entrega

Antes de dizer "terminou":

- A tarefa principal foi implementada.
- Layout foi preservado quando pedido.
- Estados loading/empty/error foram considerados.
- Performance percebida nao piorou.
- Contratos de API/tipos foram respeitados.
- Nao houve nova paleta/tipografia/raio sem motivo.
- `git diff --check` passou.
- Teste relevante foi rodado ou motivo foi declarado.
- Lacunas restantes foram declaradas.

## 11. Pontuacao

Use esta escala para autoavaliacao:

- **9.7+**: alem de funcionar, esta instrumentado, resiliente, testado, visualmente consistente e com estados extremos.
- **9.3**: pronto para producao; pequenos refinamentos futuros.
- **8.7**: bom, mas falta uma camada de hardening, teste ou polimento.
- **7.5**: funcional, mas arriscado.
- **6.0 ou menos**: nao entregar.

## 12. Frase De Execucao

Quando Atlas estiver em Programacao Front-end, a regra e:

> Primeiro preservar o produto. Depois melhorar a experiencia. So entao embelezar.

Se a mudanca nao respeita essa ordem, ela ainda nao esta pronta.
