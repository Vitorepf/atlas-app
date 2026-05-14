# Atlas Front-End Operating System

Documento de referencia para evoluir o front-end do Atlas com consistencia, velocidade e qualidade de produto. Ele adapta as melhores ideias do Impeccable para o Atlas: contexto persistente, disciplina de design, anti-slop, hardening e revisao objetiva antes de qualquer entrega.

Este documento nao copia a estetica do Impeccable. O que deve ser copiado e o metodo: entender o produto, escrever o criterio, executar com restricao, auditar sem vaidade e melhorar ate a interface parecer inevitavel.

Para execucao de tarefas de programacao front-end, use tambem `docs/ATLAS_FRONT_END_PROGRAMMING_PLAYBOOK.md`.

## 1. Tese

Atlas e um produto de pensamento, captura e decisao. A interface deve parecer premium, calma e extremamente responsiva, mas nunca decorativa a ponto de competir com o conteudo do usuario.

O front-end deve carregar tres ideias ao mesmo tempo:

- **Editorial**: hierarquia tipografica forte, respiro, ritual e leitura confortavel.
- **Operacional**: acoes claras, estados previsiveis, listas rapidas, zero friccao.
- **Confiavel**: anexos, IA, historico, cache, erros e progresso precisam ser explicitos.

Sempre que houver conflito, a ordem de prioridade e:

1. O usuario consegue concluir a tarefa?
2. A tela responde imediatamente?
3. O conteudo esta legivel e auditavel?
4. A composicao parece Atlas?

## 2. Registro Do Produto

Registro canonico: **product**.

Atlas nao e landing page, portfolio, showcase de CSS ou experimento visual. E um app usado muitas vezes por dia para capturar pensamento, transformar informacao e recuperar memoria. A UI pode ser bela, mas deve servir velocidade mental.

Na pratica:

- Use composicao editorial para orientar o olhar, nao para enfeitar.
- Use microcopy curta e honesta.
- Prefira estados reais a mensagens genericas.
- Se uma animacao atrasa uma acao comum, ela esta errada.
- Se um detalhe visual dificulta escaneamento, ele esta errado.

## 3. Fontes De Verdade

Antes de modificar qualquer tela visual, leia estas fontes:

- `design/tokens.ts`: cores, espacos, raios, motion, escala tipografica.
- `design/Type.tsx`: componentes tipograficos canonicos (`Frau`, `Sans`, `Mono`, `Label`).
- `design/theme.tsx`: acesso a paleta atual.
- `atlas-desing-system/brand/README.md`: marca, paleta, tipografia e proibicoes.
- `components/inbox/inboxScreenStyles.ts`: canon atual do Inbox mobile.
- `docs/AMBIENTE_DESENVOLVIMENTO_IOS.md`: fluxo oficial de desenvolvimento iOS.
- `docs/passagem-do-dia-canon.md`: canon editorial da passagem do dia.
- `lib/api/client.ts`: contrato typed com backend; fonte de verdade para traces, jobs, anexos, memoria, providers e telemetria.
- `lib/atlasAiRuntime.ts`: filtros, ordenacao, merge e resumo operacional de traces.
- `lib/atlasAiThreadRouting.ts`: modos, dominio, executor, estilo e metadata de roteamento.
- `components/sheets/atlas-ai/AtlasAiContextModel.ts`: prompts operacionais gerados no app.
- `components/sheets/atlas-ai/AtlasAiDecideModel.ts`: regra local captura/conversa.
- `components/sheets/atlas-ai/AtlasAiAttachmentModel.ts`: limites e normalizacao local de anexos.
- `lib/performanceTelemetry.ts`: eventos de performance que viram telemetria Atlas AI.
- `lib/editionHomeCache.ts`: cache imediato da tela de Edicao.
- `lib/storage.ts`: MMKV, migracao AsyncStorage e chaves persistentes.
- `lib/openBrain.ts`: formato de recall, context pack, auditoria e qualidade da memoria.
- `lib/memoryReviewSafety.ts`: detector provider-safe para segredos antes de expor memoria a providers.
- `lib/memoryProviderProjection.ts`: projection de memoria para Claude/agents com auditoria e drift.
- `lib/atlasOperationalBootstrap.ts`: bootstrap de conversas operacionais vindas do Inbox.
- `lib/atlasAiModeContract.ts`: contrato dos modos geral, operacional e programacao.
- `lib/deepLinks.ts` e `lib/atlasDeepLinkCore.ts`: roteamento `atlas://`.
- `lib/mobileThreadBridge.ts`: ponte de inbox item para thread mobile.
- `lib/atlasStore.ts`: store global, sync offline, filas locais, HealthKit, Screen Time e captura.
- `lib/atlasAiDomainCatalog.ts`: selecao de dominio/flow do Atlas AI baseada em UX.
- `lib/inboxOperational.ts`: mapeamento canonico dos itens operacionais do Inbox.
- `lib/inboxCaptureModels.ts` e `lib/useInboxCaptures.ts`: filtros, busca, agrupamento e performance do Inbox de capturas.
- `lib/engineeringKnowledge.ts` e `lib/engineeringToolRuntime.ts`: contratos da tela Engineering, knowledge base e tool authority.
- `lib/agenda.ts`: canon de agenda, timeline e principio no-mock.
- `lib/readiness.ts`: modelo local de readiness fisiologico/cognitivo.
- `lib/healthKit.ts`: coleta HealthKit, limites, backfill e anchors locais.
- `lib/clipboard.ts`: primitiva global de copy/haptic.
- `app.config.js` e `app.json`: configuracao nativa, env, permissoes e plugins Expo.
- `atlas-home-editorial-mockup.html` e `atlas-desing-system/refactor-inbox/*.html`: referencias historicas de direcao visual; nao sao implementacao canonica, mas explicam intencao.

Nunca introduza uma nova paleta, familia tipografica, raio, sombra ou easing sem justificar por que os tokens atuais nao resolvem.

## 3.1 Inventario Operacional Do Repo

Nao ha uma pasta formal `skills/`, `prompts/` ou `.agents/` neste front-end. Mesmo assim, existem "skills" e "prompts" implicitos no codigo. Eles precisam ser tratados como contrato de produto.

### Prompts E Briefings Gerados Pelo App

O arquivo `components/sheets/atlas-ai/AtlasAiContextModel.ts` gera o prompt de programacao quando um contexto operacional vira conversa tecnica.

Contrato:

- O prompt deve carregar origem, thread, inbox item, context bundle e ultimas mensagens relevantes.
- Deve declarar objetivo tecnico, evidencias esperadas, comandos/testes e riscos.
- Nao deve pedir para o usuario reenviar contexto ja carregado.
- Deve truncar com criterio, preservando o que ajuda execucao.

Qualquer mudanca aqui muda a forma como Atlas AI trabalha com Codex/Claude/Gemini. Trate como prompt de sistema de produto.

### Atlas Decide Local

O arquivo `components/sheets/atlas-ai/AtlasAiDecideModel.ts` decide apenas:

- `captura`
- `conversa`

Contrato:

- Classificar somente quando `currentThreadId == null`, `pending == false` e `traceCount === 0`.
- Depois que existe conversa, nao reclassificar automaticamente.
- Threshold de captura e conservador; em duvida, conversa.
- "tarefa" e "projeto" nao sao destinos iniciais do composer; sao derivados depois da captura.

### Catalogo De Dominios E Flows

O arquivo `lib/atlasAiDomainCatalog.ts` escolhe `domain_id` e `flow_id` para cada superficie do Atlas AI.

Mapa UX atual:

- `general/direct|plan|review` -> `general.answer`
- `operational/direct|plan|review` -> `operations.diagnostic`
- `programming/direct|plan|dev` -> `programming.dev`
- `programming/review` -> `programming.review`
- `programming/debug` ou `repair` -> `programming.repair`

Contrato:

- `surface_id` default e `atlas_app`.
- Override explicito de `domain_id` ou `flow_id` deve ser preservado.
- Se dominio/flow nao resolver, status deve ser `unresolved`; nao inventar flow.
- Flows destrutivos precisam exigir confirmacao na superficie.
- Dominio so entra como pronto quando onboarding esta `ready`.

### Anexos Locais

O arquivo `components/sheets/atlas-ai/AtlasAiAttachmentModel.ts` define limites locais:

- Maximo de imagens no draft: `8`.
- Maximo de arquivos no draft: `4`.
- Limite local por imagem: `20 MB`.
- Limite local por arquivo: `20 MB`.
- Clipboard, camera, fotos e arquivos devem gerar `id` unico.
- O nome visual do arquivo nao pode ser usado como identidade unica.

### Runtime Atlas AI

O front-end entende:

- providers: `claude_cli`, `codex_cli`, `gemini_cli`, `claude_codex`.
- jobs: `queued`, `processing`, `succeeded`, `failed`, `cancelled`, `awaiting_user_choice`.
- traces com `skill_versions`, `context_refs`, `attachments`, `quality_evaluation`, `quality_actions`, `decision_receipt` e `atlas_decide_execution`.

Contrato:

- UI deve mostrar provider, progresso e fallback quando isso existir.
- Falha de provider nao deve virar silencio.
- `skill_versions` deve aparecer em contexto/diagnostico quando existir.
- Quality actions precisam ser visiveis e acionaveis.

### Modos Atlas AI

O arquivo `lib/atlasAiModeContract.ts` define tres modos:

- `general`: conversa geral, pesquisa e organizacao leve.
- `operational`: explica situacao operacional, evidencia, risco e proxima acao.
- `programming`: engenharia com plano, execucao, testes, riscos e artefatos.

Contrato:

- Modo `programming` habilita runtime completo, workspace obrigatorio e politica de permissao forte.
- Modo `operational` exige evidencias, incerteza e proxima acao.
- Modo `general` nao deve herdar contexto operacional ou de codigo por acidente.
- Se um fluxo promove Inbox para programacao, precisa preservar origem, contexto e permissao.

### Bootstrap Operacional

O arquivo `lib/atlasOperationalBootstrap.ts` controla conversas criadas a partir de itens operacionais do Inbox.

Contrato:

- Threads operacionais devem mostrar se o diagnostico inicial esta em fila, rodando, pronto, falhou ou foi pulado.
- O usuario nao deve precisar reenviar o alerta.
- O contexto operacional precisa ficar preso a thread.
- Falha do bootstrap deve deixar proxima acao clara.

### Open Brain E Memoria Provider-Safe

Arquivos relevantes:

- `lib/openBrain.ts`
- `lib/memoryReviewSafety.ts`
- `lib/memoryProviderProjection.ts`

Contrato:

- Recall e context pack devem declarar quantidade de referencias, memorias, budget e hash.
- Memoria enviada para provider precisa ser `provider-safe`.
- Detectar e bloquear tokens, JWT, private key, cloud key, provider token e atribuicoes de segredo.
- Projection para Claude/agents so pode aplicar quando nao houver drift manual.
- Auditoria de projection usa janela de 30 dias e retencao de 90 dias.
- Purge e apply precisam de simulacao/confirmacao quando houver risco.

### Deep Links E Ponte Mobile

Arquivos relevantes:

- `lib/atlasDeepLinkCore.ts`
- `lib/deepLinks.ts`
- `lib/mobileThreadBridge.ts`

Contratos de rota:

- `atlas://capture` abre captura.
- `atlas://inbox/:id` abre item mobile.
- `atlas://inbox/:id/discuss` promove para thread operacional.
- `atlas://thread/:id` abre Atlas AI quando o overlay esta disponivel.
- `atlas://thread/new` abre conversa nova.
- `atlas://memory?...` abre memoria com params.
- Links invalidos caem para Inbox com toast curto.

Regra:

- Deep link nao pode quebrar app launch.
- URLs que nao comecam com `atlas://` devem ser ignoradas.
- Discuss de Inbox precisa retornar `thread_id`; se nao retornar, deve falhar de forma explicita.

### Storage, Cache E Persistencia

Arquivos relevantes:

- `lib/storage.ts`
- `lib/editionHomeCache.ts`

Contrato:

- Storage principal e MMKV (`atlas.v1`) com fallback em memoria para ambiente sem JSI.
- Migracao AsyncStorage -> MMKV e best-effort, idempotente e nao pode bloquear app.
- Chaves persistentes importantes incluem host/port/token, device id/token, pending submission, routing, pinned traces, filtros de memoria e tema.
- Cache de Edicao usa `atlas.edicao.agenda-cache.v1` e `atlas.edicao.memory-review-cache.v1`.
- Cache e otimizacao de pintura instantanea; falha de cache nunca pode bloquear tela.

### Store Global, Offline E Sync

O arquivo `lib/atlasStore.ts` e o centro operacional do app.

Contrato:

- Persistencia principal em `atlas.store.v1`.
- Capturas locais usam prefixo `local:`.
- Audio local fica em `atlas/audio/`; fotos em `atlas/photos/`.
- Filas locais existem para capturas, checkins, behaviors, logs, passive signals, health snapshots, digital sessions e digital snapshots.
- Sync precisa ser tolerante a rede ruim e preservar `attempts`/`last_error`.
- Batch sizes atuais sao parte da performance: checkins 100, behavior logs 200, passive signals 250, health snapshots 90, digital sessions 250.
- Health backfill atual cobre 60 dias; refresh curto cobre dados recentes.
- Estado `serverReachable` e filas locais devem aparecer como verdade operacional, nao serem escondidos.

### Inbox De Capturas

Arquivos relevantes:

- `lib/inboxCaptureModels.ts`
- `lib/useInboxCaptures.ts`

Contrato:

- Itens arquivados e snoozed nao entram em "abertas" ate voltarem.
- Filtros canonicos: abertas, candidatas, propostas, sem destino, adiadas, roteadas, falhas, pendentes e arquivadas.
- Busca deve usar cache por item (`WeakMap`) para nao recalcular texto em toda digitacao.
- Timeline usa "hoje", "ontem" e depois data por extenso; nao usar numeral romano para mes.
- Sorting e grouping precisam ficar fora da view.

### Inbox Operacional

O arquivo `lib/inboxOperational.ts` mapeia itens operacionais em vocabulário visual canonico.

Categorias canonicas:

- `alert`: critico/ver trace.
- `approval`: aprovacao/aprovar/negar.
- `job_result`: job/ver trace.
- `self_diagnostic`: auto-diagnostico/discutir com Atlas.
- `proposal`: proposta/revisar proposta.
- `atlas_ai_recommendation`: recomendacao/marcar aplicada.
- `insight`: insight/discutir com Atlas.

Contrato:

- Acoes devem vir de `available_actions[]`; fallback sintetico so quando necessario.
- Acoes destrutivas devem ser marcadas e renderizadas como tal.
- `requires_confirm` e policy do server precisam ser preservados no `source`.
- Categoria visual nao pode mudar sem preservar o significado operacional.

### Engineering, Tools E Authority

Arquivos relevantes:

- `lib/engineeringKnowledge.ts`
- `lib/engineeringToolRuntime.ts`

Contrato:

- Knowledge mostra categoria, prioridade, canonical path e preview compacto.
- Code audit diferencia `fresh`, `drift_detected` e `empty_index`.
- Tool runtime classifica ready, warning, failed e unknown.
- Authority separa T0/T1/T2/T3, grupos primarios, complementares, fallback e executores.
- Gate de tools deve declarar se esta `liberado` ou `bloqueado`, evidencias, bloqueios, avisos, stale e duplicatas.
- Policy deve expor tier, sandbox, privacy, task type, provider-safe e rede.

### Agenda Sem Mock

O arquivo `lib/agenda.ts` explicita o principio no-mock.

Contrato:

- Dados reais vem de `listTaskAgenda`.
- Campo ausente no schema nao deve ser inventado no front.
- Location, holiday e efemerides so renderizam quando existirem.
- Timeline insere marcador `agora` na posicao cronologica.
- Proximo evento futuro vira `next`.
- Eventos passados usam `completed_at` ou fim anterior ao `now`.
- Formato de hora canonico usa ponto: `15.00`, nao `15:00`.

### HealthKit E Readiness

Arquivos relevantes:

- `lib/healthKit.ts`
- `lib/readiness.ts`

Contrato:

- HealthKit usa anchors locais e backfill controlado; nao buscar infinito.
- Backfill principal atual: 60 dias.
- Refreshes curtos preservam bateria e velocidade.
- Readiness e modelo local `readiness_v1`, com base, current, body, mind, drive, focus, sleep, autonomic, load, subjective, stability e dataQuality.
- Score sem dados deve reduzir confianca, nao fingir precisao.
- Diagnosticos fisiologicos precisam separar valor, baseline, delta, confianca e status.

### Clipboard E Haptics

O arquivo `lib/clipboard.ts` e a primitiva global de copiar.

Contrato:

- Trim antes de copiar.
- Ignorar texto vazio.
- Haptic medio em sucesso.
- Haptic warning em falha.
- Long press canonico: `380ms`.

### Contratos Especializados Ainda Espalhados

Estes modulos nao precisam dominar o documento central, mas sao importantes o suficiente para consultar antes de mexer nas respectivas telas.

Atlas AI submodelos:

- `components/sheets/atlas-ai/AtlasAiRoutingModel.ts`: estado de roteamento visual.
- `components/sheets/atlas-ai/AtlasAiDomainSelectionModel.ts`: selecao de dominio no sheet.
- `components/sheets/atlas-ai/AtlasAiLongMessageModel.ts`: mensagens longas e conversao em anexo/texto estruturado.
- `components/sheets/atlas-ai/AtlasAiSubmissionRecovery.ts`: recuperacao de envio pendente.
- `components/sheets/atlas-ai/AtlasAiTurnModel.ts`: montagem de turnos, anexos historicos, YouTube source badge e contexto de conversa.
- `components/sheets/atlas-ai/threadHistoryModel.ts`: historico, provider word e sinais de thread.

Shell, overlays e navegacao:

- `components/AtlasShell.tsx`: shell global, toasts, sync whisper e estrutura comum.
- `lib/overlays.ts`: estado global dos sheets, incluindo Atlas AI open nonce.
- `components/Dock.tsx`: navegacao principal e FAB central.
- `components/Screen.tsx`: wrapper base de telas.

Operacao mobile:

- `lib/pushNotifications.ts`: notificacoes.
- `lib/screenTime.ts`: autorizacao e coleta Screen Time.
- `lib/autoHealthSync.ts` e `lib/healthBackgroundTask.ts`: sync automatico/background de HealthKit.
- `app/mobile-pairing.tsx`: pareamento mobile e preferencias operacionais.

Memoria e review:

- `lib/memoryHomeSummary.ts`: resumo da home de memoria.
- `lib/memoryReviewFilters.ts`, `lib/memoryReviewNavigation.ts`, `lib/memoryReviewShortcuts.ts`, `lib/memoryReviewBatch.ts`: contratos de revisao de memoria.
- `app/memory.tsx`: tela grande que orquestra review, provider projection, auditoria, purge, recall e quality.

Vida, saude e sono:

- `lib/sleepAnalysis.ts`, `lib/sleepOperational.ts`, `lib/sleepPhysiology.ts`, `lib/sleepTarget.ts`, `lib/sleepValidity.ts`: pipeline local de sono.
- `lib/physiologicalAge.ts`: idade fisiologica.
- `lib/healthSnapshots.ts`: snapshots derivados.
- `lib/checkinFreshness.ts` e `lib/checkinScale.ts`: frescor e escala de checkins.

Conteudo editorial:

- `lib/dailyPassage.ts`: selecao da passagem do dia.
- `lib/folio.ts`: estrutura editorial de folio.
- `lib/bitaculaBriefing.ts` e `lib/bitaculaFactors.ts`: briefing e fatores da bitacula.
- `lib/domains.ts`: dominios canonicos do app.

Regra:

- Antes de refatorar uma tela especializada, ler o helper/model correspondente.
- Se a tela virar prioridade de produto, criar doc propria em vez de inflar este operating system.
- O documento central registra fronteiras; documentos especificos devem registrar algoritmo, estados e testes.

### Configuracao Nativa E Permissoes

Arquivos relevantes:

- `app.config.js`
- `app.json`
- `docs/AMBIENTE_DESENVOLVIMENTO_IOS.md`

Contrato:

- `app.config.js` injeta `ATLAS_API_HOST`, `ATLAS_API_PORT` e `ATLAS_API_TOKEN`, com fallback no `.env` do `atlas-server`.
- Development build e obrigatorio para HealthKit, audio nativo e background modes.
- Expo Go nao e ambiente real do Atlas.
- HealthKit, localizacao, notificacoes, background task e document/image picker sao partes do produto, nao extras.
- Mudancas em dependencia nativa, entitlement, plugin ou config exigem novo build iOS dev.

### Scripts Oficiais

Scripts de desenvolvimento:

- `npm run dev:ios`
- `npm run dev:ios:clear`
- `npm run dev:ios:tunnel`
- `npm run dev:ios:restart`
- `npm run build:ios:dev`
- `npm run build:ios:preview`

Scripts de verificacao:

- `npm run typecheck`
- `npm run test:health`
- `npm run test:atlas-ai`
- `npm run test:memory`
- `npm run test:engineering`
- `npm run test:front`

Regra:

- Mudanca visual simples: pelo menos typecheck quando possivel.
- Mudanca Atlas AI: `npm run test:atlas-ai`.
- Mudanca Inbox/modelos: `npm run test:engineering` ou teste especifico afetado.
- Mudanca memoria/review: `npm run test:memory`.
- Mudanca transversal: `npm run test:front`.

## 4. Identidade Visual

### Cores

Base clara:

- `bg`: marfim, fundo principal.
- `surface` e `premium`: superficies discretas.
- `ink`: texto primario.
- `ink2` e `ink3`: texto secundario e silencioso.
- `bronze`: acento principal, divisores, pontos de estado e chamadas premium.
- `prussian`: acento frio para informacao tecnica, dominio BlackInk ou contraste funcional.

Regras:

- Bronze e acento, nao tinta de paragrafo inteiro.
- Prussiano deve ser raro e informativo.
- Evite telas monocromaticas sem hierarquia.
- Evite pure black/white como base visual, exceto status bar ou casos tecnicos.
- Nao use gradiente como solucao de premio.

### Tipografia

Papel das familias:

- **Fraunces**: titulos editoriais, frases de pensamento, momentos contemplativos.
- **Inter**: corpo funcional, controles, respostas longas, leitura continua.
- **JetBrains Mono**: horario, contadores, specs, metadados, status tecnico.
- **Cinzel**: wordmark e mastheads especificos.

Regras:

- Display serifado deve aparecer onde existe ritual, nao dentro de controles densos.
- Corpo longo deve ser Inter, com line-height confortavel.
- Mono deve indicar dado, nao virar estilo geral.
- Evite italic serif em excesso; ele perde forca quando tudo vira gesto.

### Espaco E Forma

Use a escala de `space` em `design/tokens.ts`. O Atlas deve respirar, mas nao parecer vazio por falta de conteudo.

Regras:

- Cards so para itens repetidos, modais, sheets ou superficies realmente agrupadas.
- Nao colocar card dentro de card.
- Hairlines e divisores devem ajudar leitura, nao desenhar caixas por habito.
- Bottom sheets podem ser generosos, mas devem aproveitar o espaco vazio com conteudo util.
- Botoes e targets tocaveis precisam manter ergonomia mobile.

## 5. Telas Criticas

### Atlas AI

Objetivo: conversa e captura com o menor atrito possivel.

Regras:

- Ao abrir pelo FAB ou pelo `+`, conversa nova deve ser realmente nova.
- Deteccao captura/conversa so deve existir quando a conversa ainda esta vazia.
- Depois que o usuario inicia conversa, nao reclassificar texto como captura automaticamente.
- O composer deve responder imediatamente, mesmo com rede lenta.
- Imagens anexadas devem ter preview antes do envio e visualizacao depois do envio.
- Arquivos grandes devem ter progresso, erro recuperavel e representacao clara.
- Respostas longas devem ser estruturadas para leitura mobile, nao despejadas como bloco unico.
- YouTube deve declarar fonte: legenda oficial, audio transcrito, fallback web ou metadados apenas.

Estados obrigatorios:

- pronto
- enviando
- processando anexos
- transcrevendo/ingerindo video
- resposta parcial ou progresso
- erro recuperavel
- lacuna declarada quando o conteudo nao foi acessado

### Inbox

Objetivo: triagem rapida de capturas sem perder a sensacao editorial.

Canon atual:

- Masthead centralizado.
- Tabs centradas ate a transicao para conteudo.
- Conteudo da lista alinhado a esquerda.
- Search como linha editorial, sem caixa pesada.
- Chips com separadores leves.
- Dock nao deve cobrir informacao importante.

Regras:

- Nao alterar layout visual sem comparacao por screenshot.
- Lista deve virtualizar e memoizar itens caros.
- Datas, horarios e metadados devem ser escaneaveis.
- Acoes de swipe devem ser previsiveis e reversiveis quando possivel.
- Estados vazios precisam ser bonitos e uteis, nao poeticos demais.

### Edicao

Objetivo: abrir instantaneamente e permitir agir antes da rede terminar.

Regras:

- Mostrar ultimo resultado salvo imediatamente.
- Atualizar agenda/memoria em background.
- Nunca bloquear a tela inteira se ja existe cache confiavel.
- Diferenciar "dados salvos", "sincronizando" e "falhou".
- Navegar para settings sem travar render principal.

### Settings

Objetivo: ajustes rapidos e previsiveis.

Regras:

- Abrir com shell imediato.
- Carregar secoes pesadas sob demanda.
- Nao recalcular estados globais em abertura simples.
- Instrumentar tempo de abertura.

### Anexos, PDF, Imagens E YouTube

Objetivo: entrada multimodal de alta fidelidade.

Regras:

- Imagens: manter qualidade original para screenshot, texto e UI; comprimir apenas quando a perda nao prejudica leitura.
- PDF: extrair texto nativo primeiro, OCR/render por pagina quando necessario.
- Textos enormes: converter para anexo textual estruturado quando exceder limite pratico do chat.
- YouTube: usar pipeline em camadas, com declaracao honesta da fonte.
- Nome de arquivo exibido nao pode ser a identidade interna unica; use `id`, hash ou storage key para unicidade.

## 6. Pipeline De Trabalho Para Agentes

Use este fluxo antes de mexer em UI relevante.

Este fluxo adapta o loop do Impeccable para o Atlas: ensinar contexto, dar forma, construir, polir, endurecer e manter. No Atlas, esses passos nao sao comandos instalados; sao disciplina de trabalho.

### 1. Teach

Entender:

- Qual tela?
- Qual tarefa do usuario?
- Qual estado atual?
- Qual regra visual ja existe?
- Qual performance percebida?

Saida esperada: 3 a 7 linhas de contexto.

### 2. Shape

Definir:

- Mudanca minima necessaria.
- Arquivos provaveis.
- Estados que podem quebrar.
- Como validar visualmente.

Saida esperada: plano curto antes de editar.

### 3. Build

Implementar:

- Usar tokens existentes.
- Preservar layout salvo se a tarefa nao pediu redesenho.
- Separar logica pesada da view.
- Memoizar onde ha listas, anexos ou transforms caros.

### 4. Harden

Verificar:

- Loading.
- Empty.
- Error.
- Offline ou rede lenta.
- Reentrada na tela.
- Teclado aberto.
- Safe area.
- Conteudo longo.
- Anexos multiplos.

### 5. Polish

Ajustar:

- Ritmo vertical.
- Line-height.
- Contraste.
- Toque minimo.
- Truncamento.
- Hierarquia de metadados.
- Animacoes discretas.

### 6. Audit

Responder antes de finalizar:

- Isso ficou mais rapido?
- Isso preservou o layout?
- Isso reduziu ambiguidade?
- Isso usa fonte de verdade do design system?
- O usuario consegue recuperar de erro?

### Vocabulário Impeccable Adaptado

Use estes nomes como linguagem interna de trabalho, mesmo sem instalar o skill:

- `teach`: entender usuario, registro, voz, anti-referencias e contexto real.
- `document`: atualizar a documentacao do sistema para que o proximo agente nao redescubra tudo.
- `shape`: definir direcao antes de codar.
- `craft`: implementar em codigo real.
- `polish`: refinar o que ja existe sem redesenhar por vaidade.
- `audit`: avaliar acessibilidade, performance, responsividade, theming e anti-patterns.
- `critique`: revisar como designer, com ponto de vista.
- `clarify`: reduzir microcopy confusa.
- `harden`: testar estados extremos, overflow, offline, erro e dados reais.
- `optimize`: diagnosticar e corrigir performance percebida.
- `extract`: transformar repeticao em token, helper ou componente.
- `adapt`: manter a experiencia boa em viewport, teclado, safe area e contexto diferente.

O Atlas nao precisa copiar os 23 comandos do Impeccable. Precisa copiar a ideia: dar nome ao tipo de melhoria para o agente nao tratar todo problema como "refatorar componente".

### Contexto Portavel

Impeccable usa `PRODUCT.md` e `DESIGN.md`. No Atlas, este documento cumpre parte desse papel, mas a separacao ideal e:

- `PRODUCT.md`: quem usa o Atlas, para que, em que estado mental, quais anti-referencias e qual voz.
- `DESIGN.md`: tokens, tipografia, componentes, exemplos e proibicoes visuais em formato portavel.
- `ATLAS_FRONT_END_OPERATING_SYSTEM.md`: contratos de produto, runtime, performance, telas criticas e disciplina de entrega.

Regra:

- Se outro agente vai precisar da mesma informacao mais de uma vez, ela nao deve viver so no chat.
- Se uma decisao visual virou canon, ela entra em doc.
- Se uma regra depende de codigo, a doc aponta o arquivo-fonte.

## 7. Anti-Slop Atlas

Evite explicitamente:

- Gradiente em texto.
- Glow escuro.
- Card dentro de card.
- Tudo centralizado sem motivo.
- Spacing monotono.
- Hierarquia tipografica plana.
- Serif italic em excesso.
- Texto pequeno demais para mobile.
- Corpo todo em caps.
- Tracking largo em corpo de texto.
- Botao com label quando icone familiar resolver melhor.
- Sombra pesada para parecer premium.
- Estado vazio que parece landing page.
- Skeleton que dura mais que o dado real.
- Animacao com bounce infantil.
- Paleta nova para uma tela isolada.
- Refatoracao que muda layout sem screenshot de comparacao.

## 8. Performance

Meta: o Atlas deve parecer instantaneo mesmo quando a rede nao e.

Padroes obrigatorios:

- Renderizar shell primeiro.
- Cachear ultimo resultado util.
- Atualizar em background.
- Paginar historico em blocos pequenos.
- Evitar computacao pesada no render.
- Usar `useMemo`, `useCallback` e componentes memoizados com criterio, nao por ritual.
- Virtualizar listas longas.
- Separar parsing, normalizacao e upload da camada visual.
- Debounce para busca, nao para toque principal.

Instrumentacao minima:

- `edition_visible_ms`
- `atlas_ai_ready_ms`
- `settings_open_ms`
- `history_open_ms`
- `inbox_visible_ms`
- `attachment_preview_ms`
- `youtube_ingest_ms`

Eventos devem carregar resultado:

- `ok`
- `cache`
- `network`
- `error`
- `fallback`
- `cancelled`

## 9. Resiliencia E Honestidade

Atlas pode falhar; ele nao pode fingir.

Para IA e ingestao:

- Dizer quando usou transcricao.
- Dizer quando usou audio.
- Dizer quando usou fallback web.
- Dizer quando so tem metadados.
- Nunca apresentar resumo de video como se tivesse visto o video se nao viu.
- Mostrar lacuna de forma curta e util.

Para UI:

- Erro precisa ter proxima acao.
- Upload precisa poder ser removido antes de enviar.
- Anexo enviado precisa poder ser aberto depois.
- Estado antigo nao pode parecer dado fresco.

## 10. Rubrica De Qualidade

Use nota de 0 a 10 antes de fechar trabalho visual relevante.

- **10.0**: rapido, bonito, robusto, acessivel, instrumentado, com estados completos e nenhum desvio do design system.
- **9.3**: excelente para producao; pequenos refinamentos restantes nao bloqueiam.
- **8.7**: bom, mas ainda existe lacuna clara em estado, performance ou consistencia.
- **7.5**: funcional, porem com risco visual ou operacional.
- **6.0 ou menos**: entrega incompleta; nao fechar.

Checklist para mirar 9.3+:

- Layout preservado ou evoluido com intencao.
- Nenhum token novo sem motivo.
- Empty/loading/error cobertos.
- Rede lenta nao congela tela.
- Conteudo longo nao quebra.
- Teclado nao esconde acao principal.
- Screenshot mobile revisado.
- Sem regressao em anexos, conversa, captura ou historico.

## 11. Definicao De Pronto

Uma mudanca de front-end Atlas so esta pronta quando:

1. A tela abre rapido com dados cacheados ou shell imediato.
2. O usuario entende o estado atual sem explicacao externa.
3. A composicao segue tokens e tipografia canonicos.
4. Os estados extremos foram considerados.
5. A implementacao nao misturou logica pesada dentro da view.
6. Foi feita verificacao visual quando houve mudanca de layout.
7. A entrega declara qualquer lacuna restante.

## 12. Frase Guia

Antes de aceitar qualquer solucao, pergunte:

> Isso deixa o Atlas mais calmo, mais rapido e mais confiavel para pensar?

Se a resposta nao for claramente sim, ainda nao esta pronto.

## 13. Matriz De Cobertura

Esta doc e o sistema operacional central do front-end. Ela nao substitui docs profundas de cada dominio.

Coberto em nivel operacional:

- Design system, tokens, tipografia e anti-slop.
- Atlas AI: conversa/captura, runtime, providers, anexos, YouTube, PDF, long messages, recovery e historico.
- Inbox: capturas, operacional, filtros, ações, layout canonico e performance.
- Edicao: cache imediato, background refresh e telemetria.
- Memoria: Open Brain, provider-safe, projection, auditoria e purge.
- Engineering: knowledge, tools, authority, gate e evidencias.
- Mobile runtime: deep links, pairing, storage, MMKV, sync offline e permissoes nativas.
- Agenda, HealthKit, readiness e contratos no-mock.

Referenciado, mas nao dissecado linha a linha:

- `app/sleep.tsx`, `app/routines.tsx`, `app/projects.tsx`, `app/bitacula.tsx`, `app/rivals.tsx`, `app/celestial.tsx`.
- Componentes visuais atomicos (`PrimaryButton`, `Tile`, `Skeleton`, `Sparkle`, `SectionHeader`) quando nao carregam regra de negocio propria.
- Mockups HTML historicos em `atlas-desing-system/` e `atlas-home-editorial-mockup.html`; eles explicam direcao, mas nao sao fonte final de implementacao.

Nao existe no repo, nesta data:

- Pasta formal `skills/`.
- Pasta formal `prompts/`.
- `SKILL.md` de produto dentro do app.
- `.agents/` ou `.codex/` versionado no front-end.

Proxima documentacao recomendada, se o Atlas continuar crescendo:

- `docs/ATLAS_AI_RUNTIME.md`: providers, jobs, traces, qualidade, YouTube, anexos e recovery.
- `docs/INBOX_OPERATING_SYSTEM.md`: capturas, operacional, triagem, swipe, filtros e performance.
- `docs/MEMORY_OPEN_BRAIN.md`: recall, context pack, provider-safe, projection e auditoria.
- `docs/HEALTH_SLEEP_PIPELINE.md`: HealthKit, sono, readiness, fisiologia e confianca.
- `docs/MOBILE_NATIVE_RUNTIME.md`: dev build, deep links, push, background tasks, storage e sync offline.
