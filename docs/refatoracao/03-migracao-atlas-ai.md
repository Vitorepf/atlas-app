# 03 — Migração do núcleo Atlas AI

> Documento central do plano. Índice: [README.md](README.md) · Pré-requisitos: [01-eliminacao.md](01-eliminacao.md) e Parte B (core+atlasAi de client.ts) de [02-refatoracao.md](02-refatoracao.md).

O atlas-ai é o subsistema mais crítico e mais acoplado do app: o `AtlasAiSheet.tsx` (5.808 linhas) concentra a lógica de 14 superfícies, e a camada de contrato ainda carrega um shim V1→V2. Este documento mapeia o estado atual em profundidade e define a migração em fatias seguras.

---

## 1. Diagnóstico central

**O AtlasAiSheet não é um switch de modos — é UMA tela (Header + FlatList de turns + Composer) com ~14 sheets-irmãos montados por flag booleana.** A UI já foi extraída para `components/sheets/atlas-ai/` (42 arquivos); o que ficou preso no pai foi a **lógica e o estado** de cada sheet: 69 `useState`, 44 `useRef`, ~48 `useEffect`. A migração, portanto, não é "quebrar em telas" — é **mover a lógica de cada domínio para hooks/models que os sheets já existentes consomem**.

## 2. Inventário do domínio (`lib/atlasAi/`)

| Módulo | LOC | Papel | Estado |
|---|---|---|---|
| `contract.ts` | 415 | **Canon V2.** `buildInteractionPayload()`, `MODE_OPTIONS`(12), `PROVIDER_OPTIONS`(5), `UX_FLOW_MAP`, `qualityPolicyForMode`, `programmingRuntimePolicy` | vivo, núcleo |
| `v1Adapter.ts` | 133 | Shim V1→V2: filtra payload para 9 chaves V1, força `schema_version:1` | **single-caller** (`AtlasAiRoutingModel.ts:18`) — alvo de remoção |
| `types.ts` | 57 | Tipos canônicos: `AtlasAiMode`(12), `AtlasAiTask`(6), `AtlasAiProvider`(6) | vivo |
| `presentationContract.ts` | 392 | Separa corpo humano vs metadata técnica do response Hyperflow V2 | vivo |
| `hyperflowRuntime.ts` + `useHyperflowRuntime.ts` | 351 | Parse de `trace.hyperflow` → view-model + hook | vivo |
| `runtimeReadiness*` (3 arquivos) | 366 | View-model + client + hook (poll 60s) de runtime readiness | vivo |
| `patamar4State*` (3 arquivos) | 237 | View-model + client + hook (poll 30s) | ✅ **morto confirmado** (2026-07-11: zero refs fora do tripleto) — deletar no doc 01, Lote C2 |
| `youtubePrewarm*` (3 arquivos) | 335 | Prewarm de links YouTube no composer (debounce 500ms) | vivo (`AtlasAiComposerFooter:31`) |
| `placeholders.ts` | 26 | `MODE_PLACEHOLDER` | **morto** (doc 01, lote C4) |
| `lib/atlasAiModeContract.ts` | 167 | Contrato V1 `@deprecated` | morto em prod; vivo só como golden-reference do teste do adapter |
| `lib/atlasAiThreadRouting.ts` | 212 | Ponte thread↔routing: `atlasAiModeFromThread` (precedência 5 níveis), `threadRoutingMetadataPatch` | vivo |
| `AtlasAiRoutingModel.ts` (em components) | 336 | routing→payload + provider: `atlasModePayloadForRouting`, `openBrainPayloadForRouting` | vivo — ponto do fork V1/V2 |

### Pontos de decisão do routing (contrato de comportamento a preservar)

1. **Provider**: `'auto'` → `decision_mode='atlas_decide'`, provider omitido; senão `manual_override` + `requested_provider`/`operator_requested_provider` (`contract.ts:243-244, 291-294`).
2. **Routing domain**: override explícito → `auto` se mode/task auto → workspace slug se programming+workspace → senão `mode` (`contract.ts:253-258`).
3. **open_brain policy**: injetada só quando `mode==='programming' || task∈{dev,debug,review}` → `{mode:'auto', surface:'app_ai', provider_safe_only:true, policy:{raw_text_exposed:false, raw_logs_allowed:false, providers_invoked:false}}` (`AtlasAiRoutingModel.ts:278-293`; pinado por `ob05-open-brain-injection.test.ts`).
4. **Programming runtime policy** (`capability_profile:atlas_programming`, `permission_mode:danger`, `mobile_runtime_policy`, `programming_harness`) só quando `mode==='programming'`; `auto` nunca arrasta (`contract.ts:287-289`).
5. **`atlasAiModeFromThread`** — precedência de 5 níveis: `current_mode`/`atlas_mode` → `workflow_mode` → `routing_task` → `requested_agent` (substring PT-BR+EN) → focus fallback.

### Storage (client-side, tudo em `AtlasAiSheet.tsx` hoje)

| Chave | Valor | Uso |
|---|---|---|
| `atlas-ai.routing` (`ROUTING_KEY`) | RoutingState persistido | hidrata em 1906, grava em 1922 |
| `atlas-ai.compute-effort` | escolha de compute effort | 1927/1943 |
| `atlas-ai.pinned-traces.{threadId}` | pins por thread | 2055/2072 |
| `atlas-ai.pending-submission` | recovery de submit pendente | ⚠️ definida **inline** em `AtlasAiSubmissionRecovery.ts:21` — consolidar em `AtlasAiStorageKeys.ts` |

Persistência de threads é server-side (`/ai/threads`); histórico de routing vive em `thread.metadata.mode_history` (cap ~12, via `appendRoutingHistory`).

### Superfície de API (fronteira de extração para `lib/api/atlasAi.ts`)

Bloco contíguo `createAiInteraction`(7872) → `runAiQualityAction`(8493) + tipos `AtlasAi*` (~3949-4650) + `CreateAiInteractionInput`(7842):
- **Interaction/stream**: `createAiInteraction` (3 variantes), `streamAiInteraction` (wrap de `atlasAiStreamRuntime`), upload em chunks (`/ai/uploads/chunks/*`)
- **Threads**: list/get/create/update/delete, `getAiThreadState`, `compactAiThread`, `switchAiThreadProvider`, snapshots, workspace profiles
- **Jobs**: list/get/retry/cancel/resume-choice
- **Providers/policies**: status, profiles, domain catalog, preview, settings, check
- **Telemetria/quality**: observability, telemetry events/scorecard/health, cost-rates, outcomes, quality actions

**Fora da fronteira**: Memory/Open-Brain (8499+, domínio próprio), YouTube prewarm (já vive em `youtubePrewarmClient.ts`), `apiGet/apiPost` genéricos.

---

## 3. Mapa do god-component (o que migrar de onde para onde)

| Cluster no AtlasAiSheet | Linhas (lógica) | Estado próprio | Destino |
|---|---|---|---|
| **Voice Mode** (maior cluster) | fns 1104-1650, effects 1962-4064 | ~18 state + ~30 refs (quase autocontido) | **`useAtlasVoiceController`** — hook novo; `VoiceModeSheet` é UI-only hoje. Maior extração faltante |
| **Thread runtime** (stream+poll) | `startTraceStream` 2781, effects 2400-2567 | `traces`, `pending`, stream refs | **`useAtlasTraceStream`** + **`useAtlasThread`** |
| **Record Mode** (memo de voz) | fns 840-1102 | `recordingActive`, `recordingPaused` + recorder compartilhado | **`useComposerRecorder`** (serviço único de recorder) |
| **Submit** | `submitText` 4123-4514, `submit` 4628 | draft, attachments, routing | **`useAtlasSubmit`** consumindo routing/thread hooks |
| **Routing/Decide** | `openRouting` 4706, `confirmRouting` 4992-5080, hydration 1904-1941 | `routing`, `computeEffort` + hidratação | **`useAtlasRouting`** (estado + persistência centralizados) |
| **Attachments** | pickers 2627-2772 | 7 state | handlers para dentro de `AtlasAiAttachments`/`AtlasAiAttachmentModel` (modelo já existe) |
| **Workspace** | fns 1968-2018, hydration 1946-1962 | 3 state | `AtlasAiMobileWorkspaceModel` já existe; mover handlers |
| **Thread History** | `selectThread` 4829, `deleteThread` 5131, paginação 2234-2303 | 1 flag + queries | `ThreadHistorySheet` + `threadHistoryModel` |
| **Execution/Operations/Skills/Search/SessionMap/Context** | 5081-5204 + effects pontuais | flags booleanas + 2-3 state cada | cada sheet-irmão absorve os próprios handlers |

### As 5 acoplagens duras (resolver ANTES de extrair)

1. **Voice ↔ Record compartilham o mesmo `composerRecorder` (436-437) e `recordingActive` (434).** Ambos dirigem o mesmo recorder expo-audio; o loop de metering (4064) arbitra a posse em runtime. Solução: **um único serviço de recorder** (`useComposerRecorder`) do qual Voice e Record são clientes — nunca dois `useAudioRecorder`.
2. **Refs de stream são singletons mutáveis cross-cutting**: `streamCancelRef`, `currentStreamTraceIdRef/RunIdRef`, `streamedTraceIdsRef`, `streamSequencesRef`, `activeTraceRef`, `threadViewVersionRef`, `currentThreadIdRef` — mutados por `startTraceStream`, polling, voice e `submitText`. Solução: extrair **`useAtlasTraceStream` como dono único**; thread e voice consomem.
3. **`traces` + `pending` + `currentThread(Id)` + `sessionState` são a fonte de verdade lida por praticamente todo modo.** Solução: mover para **hook/slice compartilhado (`useAtlasThread`)** ANTES de qualquer overlay ganhar estado próprio.
4. **`routing` é escrito por Composer/Decide e lido por submit + voice + metadata patch**, com persistência própria. Solução: **`useAtlasRouting`** centraliza estado+hidratação; proibido duplicar por sheet.
5. **`keyboardHeightShared` (Reanimated shared value)** anima o root e é lido pelo composer. Solução: fica no **shell** (AtlasAiSheet pós-migração) e desce por prop/context.

---

## 4. Migração V1→V2 do contrato (matar o v1Adapter)

Estado atual do fork em `atlasModePayloadForRouting` (`AtlasAiRoutingModel.ts:226-234`):
- Branch auto/expanded-modes → **já chama `buildInteractionPayload` direto** (V2 puro).
- Branch general/operational/programming não-auto → passa pelo `v1Adapter` (filtra para 9 chaves, força `schema_version:1` e `tool_permissions.source='atlas_ai_programming_mode'`).

### O que a unificação muda no payload (diff de comportamento)

| Campo | Via adapter (hoje) | Direto (alvo) |
|---|---|---|
| Chaves emitidas | só as 9 V1 | payload completo (`app_surface`, `surface_id`, `atlas_focus`, `routing_task`, `routing_domain`, `flow_id`, `domain_id`, `workspace`, `conversation_context`, …) |
| `schema_version` | 1 (forçado) | 2 |
| `tool_permissions.source` | `atlas_ai_programming_mode` (compat telemetria) | `atlas_mobile_ai_programming_mode` |

### Passos (nesta ordem)

1. **Backend primeiro**: confirmar no atlas-server que (a) a telemetria aceita `source='atlas_mobile_ai_programming_mode'` e (b) consumidores do payload toleram chaves extras + `schema_version:2`. *(Rodar `php artisan atlas:ai:session-bootstrap --task="mobile V1 contract removal" --json` antes, como manda a projeção.)*
2. Migrar o branch não-auto de `atlasModePayloadForRouting` para `buildInteractionPayload(...).payload` direto — a função colapsa para uma linha de dispatch.
3. Remover o parâmetro morto `focus` (`void focus`, linha 213) na mesma passada.
4. Deletar `lib/atlasAi/v1Adapter.ts` + `lib/atlasAiModeContract.ts` + `scripts/atlas-ai-v1-adapter.test.ts` (o teste existe só para pinar byte-compat com o V1) + `scripts/atlas-ai-runtime.test.ts` se só importar o contrato V1; tirar das baterias no `package.json`.
5. **Escrever o teste que falta**: `AtlasAiRoutingModel` direto — dispatch de `atlasModePayloadForRouting` produzindo payload V2 em todos os modos, `openBrainPayloadForRouting`, `runtimePolicyPayloadForThread`, `routingDefaultForMode` (hoje só cobertos indiretamente).

Ganho: ~300 linhas + eliminação do último resíduo V1 do app.

---

## 5. Plano de fatias (ordem de execução)

Cada fatia = 1 PR, com `npm run check:mobile-voice` verde. A UI dos sheets **não muda** — só a posse da lógica.

| Fatia | Conteúdo | Risco | Desbloqueio |
|---|---|---|---|
| **S0** | `lib/api/atlasAi.ts` extraído do client.ts (doc 02 Parte B) + consolidar `PENDING_SUBMISSION_KEY` em `AtlasAiStorageKeys.ts` | baixo | fronteira limpa p/ tudo |
| **S1** | `useAtlasThread` + `useAtlasTraceStream` (acoplagens #2 e #3): traces/pending/currentThread/sessionState + stream/poll saem do Sheet | **alto** (coração do runtime) | todas as fatias seguintes |
| **S2** | `useAtlasRouting` (acoplagem #4): estado + hidratação `ROUTING_KEY`/`COMPUTE_EFFORT_KEY` + `confirmRouting`/`openRouting` | médio | S4, V1→V2 |
| **S3** | `useComposerRecorder` (acoplagem #1) + Record Mode handlers | médio | S5 |
| **S4** | Migração V1→V2 (§4) — matar v1Adapter | médio (depende de backend) | deleta 300 linhas |
| **S5** | `useAtlasVoiceController`: todo o cluster voice (18 state + 30 refs + effects 1962-4064) consumindo S1+S3 | **alto** (maior cluster) | Sheet cai ~2.000 linhas |
| **S6** | Attachments → `AtlasAiAttachmentModel`; Workspace → `AtlasAiMobileWorkspaceModel`; handlers dos sheets menores (Execution/Operations/Skills/Search/SessionMap/Context/ThreadHistory) para dentro de cada sheet | baixo | Sheet vira shell |
| **S7** | `useAtlasSubmit` (`submitText` 4123-4514) consumindo S1+S2+S3; recovery (`AtlasAiSubmissionRecovery`) junto | médio | — |
| **S8** | Limpeza final: AtlasAiSheet reduzido a shell (~500-800 linhas: container, keyboard shared value, wiring de flags) | baixo | — |

**Resultado esperado**: 5.808 → ~600-800 linhas no shell; lógica testável em hooks/models puros; nenhum comportamento alterado (os testes de contrato pinam isso).

---

## 6. Rede de segurança (testes)

### Já pinado (não quebrar)
- `atlas-ai-contract.test.ts` — surface_id, schema v2, 12 modos, 5 providers, flow/task maps
- `ob05-open-brain-injection.test.ts` — shape da open_brain policy (⚠️ **órfão** — registrar na bateria `test:atlas-ai` antes de começar, doc 01 Lote E)
- `atlas-ai-thread-routing.test.ts` — precedência 5 níveis
- `atlas-ai-presentation-{contract,snapshot}.test.ts`, `atlas-ai-context-hyperflow.test.ts`, `hyperflow-runtime-consumption.test.ts`
- `atlas-ai-mobile-hyperflow-screen.test.ts` — asserta por string que AtlasAiSheet importa `buildInteractionPayload` (⚠️ vai quebrar quando o import mudar de arquivo na S7 — atualizar a asserção, não deletar)

### Escrever ANTES das fatias de risco alto (S1/S5)
1. **Teste de contrato do RoutingModel** (gap conhecido): dispatch completo de `atlasModePayloadForRouting`, `openBrainPayloadForRouting`, `runtimePolicyPayloadForThread`.
2. **Snapshot do payload de submit**: fixture routing+thread+attachments → payload exato de `createAiInteraction` (pina S7).
3. **Teste do stream runtime**: sequência de eventos → estado final de traces (pina S1). `atlas-ai-streaming.test.ts` já existe — estender para o merge/dedup (`mergeAtlasTrace`, `streamedTraceIdsRef` semantics).
4. ✅ Resolvido (2026-07-11): tripleto patamar4 confirmado morto → deletar com o teste (doc 01, C2). Testes de youtube (`youtube-prewarm`, `youtube-summary`) cobrem fluxo VIVO → registrar em `test:atlas-ai` (doc 01, Lote E).

### Verificação por fatia
```bash
npm run typecheck && npm run test:front && npm run check:mobile-voice
```
E teste manual no device dos fluxos: enviar mensagem texto, voice mode completo (abrir→falar→resposta→fechar), record memo, attachment de imagem, trocar thread, decide/routing, matar app com submit pendente (recovery).

---

## 7. Apêndice — contratos dos hooks (design das fatias S1-S7)

Assinaturas-alvo para execução das fatias. Regra geral: cada hook é dono exclusivo do seu estado; o Sheet (shell) só compõe. Nomes de estado abaixo referem-se às variáveis atuais do AtlasAiSheet (linhas na coluna do §3).

### S1 — `useAtlasThread` (fonte de verdade do runtime)
```ts
function useAtlasThread(opts: {
  visible: boolean
  requestedThreadId?: string | null
  openNonce?: number
}): {
  // estado (hoje: traces 416, pending 794, currentThreadId 795, currentThread 796, sessionState 797)
  traces: AtlasAiTrace[]
  pending: PendingTurn | null
  currentThread: AtlasAiThread | null
  sessionState: AtlasAiThreadState | null
  loading: boolean; error: string | null
  lastRefreshAt: number | null; refreshFailures: number
  // ações (hoje: loadThreadData 2075, refresh 2160, selectThread 4829, deleteThread 5131)
  refresh(): Promise<void>
  selectThread(id: string): Promise<void>
  deleteThread(id: string): Promise<void>
  reconcilePending(trace: AtlasAiTrace): void
}
```
Absorve os effects 2305-2567 (load, polling, reconciliação pending, auto-scroll fica no shell). Internamente compõe `useAtlasTraceStream`.

### S1 — `useAtlasTraceStream` (dono único dos refs de stream)
```ts
function useAtlasTraceStream(opts: {
  onTraceUpdate(trace: AtlasAiTrace): void
  threadViewVersion: React.MutableRefObject<number>
}): {
  startStream(traceId: string, runId?: string): void   // hoje: startTraceStream 2781
  cancelStream(): void
  isStreaming(traceId: string): boolean
}
```
Encapsula os 6 refs singleton (`streamCancelRef`, `currentStreamTraceIdRef/RunIdRef`, `streamedTraceIdsRef`, `streamSequencesRef`, `activeTraceRef`). Voice (S5) e submit (S7) consomem via este hook — **nunca tocam os refs direto**.

### S2 — `useAtlasRouting`
```ts
function useAtlasRouting(currentThread: AtlasAiThread | null): {
  routing: RoutingState               // hoje: 420, hidratação 1904/1920
  computeEffort: AtlasComputeEffortChoice  // hoje: 421, hidratação 1925/1941
  hydrated: boolean
  setRouting(next: RoutingState): void        // persiste ROUTING_KEY
  setComputeEffort(next: AtlasComputeEffortChoice): void  // persiste COMPUTE_EFFORT_KEY
  confirmRouting(sel: RoutingSelection): Promise<void>    // hoje: 4992-5080
  payloadForSubmit(ctx: SubmitContext): AtlasAiPayloadInput  // via atlasModePayloadForRouting
}
```
Única fonte do estado de routing; derivação thread→routing (`routingStateFromThread`) interna.

### S3 — `useComposerRecorder` (arbitragem Voice ↔ Record)
```ts
function useComposerRecorder(): {
  state: 'idle' | 'recording' | 'paused'
  owner: 'record' | 'voice' | null      // arbitragem explícita (hoje implícita no metering 4064)
  acquire(owner: 'record' | 'voice'): boolean   // false se ocupado pelo outro
  release(owner: 'record' | 'voice'): void
  start(): Promise<void>; stop(): Promise<AudioResult>; pauseToggle(): void
  meteringSample: number | null
}
```
Um único `useAudioRecorder` interno. `voiceRecordingBlockReason` (5297) vira derivação de `owner`.

### S5 — `useAtlasVoiceController`
```ts
function useAtlasVoiceController(deps: {
  thread: ReturnType<typeof useAtlasThread>
  stream: ReturnType<typeof useAtlasTraceStream>
  recorder: ReturnType<typeof useComposerRecorder>
  routing: ReturnType<typeof useAtlasRouting>
}): {
  open: boolean; state: VoiceModeState; statusDetail: string | null
  openVoiceMode(): Promise<void>   // hoje: 1104-1330
  endVoiceMode(): Promise<void>    // hoje: 1331-1649
  runtimeTurns: VoiceRuntimeTurn[]
}
```
Absorve os ~18 state + ~30 refs `voice*` e os effects 1962-4064 (watchdog, endpointing, playback, telemetria de síntese). Maior fatia; extrair por último entre as de risco alto.

### S7 — `useAtlasSubmit`
```ts
function useAtlasSubmit(deps: { thread; stream; routing; recorder }): {
  submitting: boolean
  submit(input: { text: string; attachments: DraftAttachment[] }): Promise<void>  // hoje: submitText 4123-4514
  recoverPending(): Promise<void>   // AtlasAiSubmissionRecovery
}
```

### O que sobra no shell (S8, ~600-800 linhas)
Container (`SideSheet`/`AtlasAiScreenContainer`), `keyboardHeightShared` + listeners (2523), flags booleanas dos 14 sheets, composição dos hooks acima, FlatList de turns, wiring de `useOverlays`/toast/router.

## 8. O que NÃO fazer nesta migração

- **Não renomear** módulos `AtlasLoop*` da keep-list nem tocar AAEL/Stewardship (regra da obra Autônomos — CLAUDE.md raiz).
- **Não mudar o shape persistido** de `atlas-ai.routing`/`atlas-ai.compute-effort` (usuários têm estado gravado).
- **Não fundir** Voice e Record num modo só — são produtos distintos que compartilham o recorder, não a UX.
- **Não migrar** Memory/Open-Brain junto (domínio próprio, fatia própria fora deste doc).
- **Não tocar** no `atlasAiStreamRuntime`/`atlasVoiceRuntime` (lib de baixo nível já isolada) além de mover quem os chama.
