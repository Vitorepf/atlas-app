# 05 — Runbook de execução (nível: qualquer IA executa)

> Este é o documento operacional. Os docs [01](01-eliminacao.md)/[02](02-refatoracao.md)/[03](03-migracao-atlas-ai.md) são a fonte da análise; **este arquivo é o que se executa**. Cada item é atômico: pré-condição → passos exatos → verificação → aceite → commit. Executar na ordem dos IDs, salvo dependência anotada.

## Protocolo (vale para todo item)

```
1. git status limpo antes de começar o item (ou stash).
2. Re-verificar a evidência do item (comando na seção "Verificar antes" do card).
   Se a evidência mudou (alguém religou o código), PULAR o item e anotar.
3. Executar os passos.
4. Rodar a verificação do card. Verde → commit. Vermelho → git checkout -- . e investigar.
5. Commit: 1 item = 1 commit, mensagem "refactor(runbook): <ID> <título curto>".
6. Rollback de qualquer item = git revert do commit dele (itens são independentes dentro do lote).
```

Verificação padrão (usada nos cards como **[V-STD]**):
```bash
npm run typecheck && npm run test:front
```
Verificação estendida (**[V-VOICE]**, para tudo que toca atlas-ai/voz):
```bash
npm run typecheck && npm run test:atlas-ai && npm run check:mobile-voice
```

Estado dos itens: marcar checkbox aqui neste arquivo ao concluir (este arquivo é o tracker).

---

## FASE E — ELIMINAR (~3.660 linhas, 8 deps, ~600KB) — risco zero

### E-D1 · Desinstalar 6 dependências mortas
- **Verificar antes**: `grep -rn "react-hook-form\|@hookform\|from 'zod'\|from \"zod\"\|@expo-google-fonts/fraunces\|from 'react-dom'\|livekit-client" --include='*.ts*' app components lib scripts | grep -v node_modules` → deve retornar vazio.
- **Passos**:
  ```bash
  npm uninstall react-hook-form @hookform/resolvers zod @expo-google-fonts/fraunces react-dom livekit-client
  ```
  Em `../CLAUDE.md`-filho (`atlas-app/CLAUDE.md`): remover a linha `- **Forms**: react-hook-form + Zod`.
- **Verificação**: [V-STD] + `npx expo-doctor` sem erro novo.
- **⚠️ Correção de auditoria**: `@expo-google-fonts/fraunces` está na lista de removíveis da auditoria (§1.4), mas é **VIVO** — `design/fonts.ts` importa e `app/_layout.tsx:44` carrega (gate do primeiro render). Removidas só 5 deps; fraunces mantida.
- [x] feito

### E-D2 · Remover script `web` morto + dedup plugin expo-notifications
- **Passos**: em `package.json` remover a linha `"web": "expo start --web",`. Em `app.json`, remover `expo-notifications` do array `plugins` (mantém o re-append de `app.config.js:52`, que é quem executa por último).
- **Verificação**: `npx expo config --type public | grep -c notification` (plugin aparece 1×) + [V-STD].
- **⚠️ Correção**: mantido o decl CONFIGURADO em `app.json` (som `atlas-bronze.wav`) e removido o re-append **cru** em `app.config.js:52` — o inverso do que o card dizia dropava o som. Verificado: plugin 1×, som preservado.
- [x] feito

### E-A · Deletar 13 componentes mortos (~2.061 linhas)
- **Pré-condição**: branch `feat/agent-governance-fleet-screen` mergeado/resolvido (2 arquivos do lote estão modificados nele).
- **Verificar antes** (para CADA arquivo, N = nome sem extensão): `grep -rn "<N>" --include='*.ts*' app components lib | grep -v "components/.../<N>"` → só comentários.
- **Passos**:
  ```bash
  git rm components/console/FieldInline.tsx \
         components/cartografia/focus/ContinentPeek.tsx \
         components/cartografia/floaters/MiniMap.tsx \
         components/sheets/atlas-ai/ComposerModeSheet.tsx \
         components/sheets/atlas-ai/ComposerPillsRow.tsx \
         components/sheets/atlas-ai/ComposerProviderSheet.tsx \
         components/inbox/CaptureButton.tsx \
         components/inbox/FoilStar.tsx \
         components/inbox/NewCapturesPill.tsx \
         components/ProcessingCard.tsx \
         components/SyncBar.tsx \
         components/inbox/LiveStatus.tsx \
         components/DomainChip.tsx
  ```
  **NÃO deletar** `ComposerPillsRowModel.ts` nem `scripts/composer-pills-row.test.ts` (vivos: `AtlasAiComposerFooter.tsx:9` importa `labelForMode`; o teste cobre o model).
  Em `AtlasAiDecideStatus.tsx:43-51`: remover o parâmetro `_executor` (documentava consumo pelo ComposerPillsRow morto) e atualizar os call sites (grep `AtlasAiDecideStatus`).
- **Verificação**: [V-STD] + `npm run test:composer-pills`.
- [x] feito

### E-B · Deletar 3 rotas mortas (~526 linhas)
- **Verificar antes**: `grep -rn "'/plan-visible'\|'/detail'\|'/decision'\|push('/detail\|push('/decision" --include='*.ts*' app components lib | grep -v "_layout\|FOCUSED_ROUTES"` → vazio.
- **Passos**:
  ```bash
  git rm app/plan-visible.tsx app/detail.tsx app/decision.tsx
  ```
  Em `app/_layout.tsx`: remover os `<Stack.Screen>` de `plan-visible`, `detail`, `decision`.
  No Dock (grep `FOCUSED_ROUTES`): remover `'/detail'` e `'/decision'` do literal.
- **Verificação**: [V-STD] + abrir o app (`npm run dev:ios`) e navegar pelo Dock sem crash.
- [x] feito (V-STD verde; nav manual do Dock não executada — deleção de rotas sem inbound nav, provada por typecheck + grep vazio)

### E-C · Deletar módulos lib/ mortos (~360 linhas)
- **Verificar antes**: `grep -rn "usePatamar4State\|patamar4\|useProviderChoice\|atlasAi/placeholders\|lib/inboxModels\|richInput/computeEffort" --include='*.ts*' app components lib | grep -v "lib/atlasAi/patamar4\|lib/atlasAi/usePatamar4\|lib/atlasAi/placeholders\|lib/hooks/useProviderChoice\|lib/inboxModels\|lib/richInput/computeEffort"` → vazio.
- **Passos**:
  ```bash
  git rm lib/atlasAi/patamar4State.ts lib/atlasAi/patamar4StateClient.ts lib/atlasAi/usePatamar4State.ts \
         scripts/patamar4State.test.ts \
         lib/hooks/useProviderChoice.ts lib/atlasAi/placeholders.ts \
         lib/inboxModels.ts lib/richInput/computeEffort.ts
  ```
  Em `package.json`: remover o script `"test:runtime-readiness"`? **NÃO** — runtime-readiness é vivo. Não há script de patamar4 para remover (teste era órfão).
  Nota: `scripts/inbox-models.test.ts` importa de `lib/inboxCaptureModels` (vivo), **não** de `lib/inboxModels.ts` — a bateria `test:engineering` não é afetada.
  **NÃO deletar** `lib/atlasAiModeContract.ts` (cai só na M4 — o teste do v1Adapter usa como golden-reference).
- **Verificação**: [V-STD].
- **⚠️ Correção**: auditoria §1.3/§5 hedgeavam (patamar4State "é usado", manter client) — FALSO, cluster patamar4 é loop morto fechado (typecheck confirma). 8 deletados.
- [x] feito

### E-E1 · Registrar 3 testes órfãos vivos na bateria
- **Passos**: em `package.json`, script `test:atlas-ai`, anexar ao final:
  ```
  && tsx scripts/ob05-open-brain-injection.test.ts && tsx scripts/youtube-prewarm.test.ts && tsx scripts/youtube-summary.test.ts
  ```
- **Verificação**: `npm run test:atlas-ai` verde.
- [x] feito

### E-E2 · Deletar artefatos raiz (~600KB)
- **Passos**:
  ```bash
  git rm atlas-composer-mockup.html atlas-composer-implementation-state.html \
         atlas-home-editorial-mockup.html historico-variantes-mockup.html \
         atlas-d-clean-proof.png atlas-d-screenshot-proof.png
  ```
- **Verificação**: [V-STD] (nada importa HTML/PNG da raiz).
- [ ] feito

---

## FASE F — FALHAS CRÍTICAS (auditoria §6.1-6.4) — 1 dia

### F1 · ~~Fontes referenciadas nunca carregadas~~ — CANCELADO (premissa falsa)
- **⚠️ Auditoria errada**: §6.1 afirma que não existe `useFonts()/loadAsync()`. FALSO — `design/fonts.ts::useAtlasFonts()` carrega Fraunces + Inter + JetBrains Mono, chamado em `app/_layout.tsx:44` com `if (!fontsLoaded) return null` (gate do render). As 3 famílias são VIVAS. Não remover strings nem pacotes. Item cancelado.
- [x] cancelado (nada a fazer)

### F2 · Secret e IP commitados em app.json
- **Passos**: em `app.json`, remover `extra.atlas.apiToken`, `extra.atlas.apiHost`, `extra.atlas.liveKitUrl` (valores movem para `.env` local que o `app.config.js` já lê). Em `app.config.js`: onde o fallback silencioso cai no placeholder (`:26,44`), lançar `console.warn` explícito quando `../atlas-server/.env` não existir.
- **Verificação**: `npx expo config --type public | grep -i "token\|100\.80"` → vazio; app conecta normalmente via env local.
- [ ] feito

### F3 · ATS desabilitado app-wide
- **Passos**: em `app.json`, trocar `NSAllowsArbitraryLoads: true` por exceção de domínio (`NSExceptionDomains` com o host do atlas-server permitindo HTTP local). Requer rebuild dev-client.
- **Verificação**: `npm run build:ios:dev` + fluxo de API funcionando no device.
- [ ] feito

---

## FASE S — SIMPLIFICAR (consolidação, ~600 linhas) — doc 02 Parte A

Cada item: criar/usar o destino, mover, atualizar imports, deletar as cópias. [V-STD] em todos.

### S-A1 · `lib/healthDerive.ts` + `components/health/HealthPrimitives.tsx`
- Mover os ~28 helpers duplicados de `app/health.tsx` ↔ `app/sleep.tsx` (lista: median, quantile, clamp, isRecord, average, cleanUnit, formatDateTime, snapshotSleep*, sleepStage*, idealSleepStageHours → lib; DetailBlock, DetailList, DetailMetric → components).
- **Escolhas canônicas obrigatórias** (bugs §6.6-6.7): `isRecord` = `typeof v === 'object' && v !== null`; `idealSleepStageHours` formata com `formatHours`.
- [ ] feito

### S-A2 · `components/atlas-ui/` — Metric, StatusPill, SmallAction, Fact
- Extrair de `app/engineering.tsx` (versão mais completa como base); substituir as redefinições em projects, rivals, routines, open-brain, memory.
- [ ] feito

### S-A3 · `lib/formatRelative.ts`
- 1 função canônica; substituir as 5 cópias (AtlasAiTurnModel, AtlasAiContextSheet, AtlasAiSessionSheets, AtlasAiExecutionSheet, AtlasAiContinuityPanel). **Escolha canônica**: formato curto "agora/5min/2h/3d" (maioria); ContinuityPanel adota o mesmo.
- [ ] feito

### S-A4 · Scrim único
- `BottomSheet.tsx`, `CenterModal.tsx`, `SideSheet.tsx` passam a compor `Scrim.tsx` em vez de reimplementar fade.
- [ ] feito

### S-A5+A6 · `lib/mathUtils.ts` — clamp + chunk
- `clamp(v,min,max)` substitui as 6 cópias (sleepOperational:249, readiness:2416, sleepAnalysis:476, sleepPhysiology:230, atlasStore:3311); `chunk<T>` substitui atlasStore:3289 + healthKit:2413.
- [ ] feito

### S-A7 · BackArrow + DotLeader → `components/atlas-ui/`
- bitacula↔sleep (BackArrow), review↔ritual (DotLeader).
- [ ] feito

### S-A8 · `structuredClone` em healthKit:2469
- Trocar `JSON.parse(JSON.stringify(value))` por `structuredClone(value)`.
- [ ] feito

### S-A9 · `_layout.tsx` enxuto
- Remover os `<Stack.Screen>` sem opções custom (~9 linhas); expo-router auto-registra.
- [ ] feito

---

## FASE R — REFATORAR megafiles (doc 02 Partes B/C) — 1 PR por item

### R1 · `lib/api/core.ts` (fundação do split)
- Mover de `client.ts`: linhas 1-48 (config cache), 5752-5762 (AtlasApiError), 5764-5911 (config+auth), 8677-8763 (wrappers), 8965-9360 (engine+token storage) + envelopes compartilhados de 5586-5751.
- `client.ts` importa e re-exporta tudo de `core.ts` (barrel) — **zero import site muda**.
- Verificação: [V-VOICE].
- [ ] feito

### R2 · `lib/api/atlasAi.ts` ★ pré-requisito da FASE M
- Mover o bloco contíguo `createAiInteraction`(7872) → `runAiQualityAction`(8493) + `CreateAiInteractionInput`(7842) + tipos `AtlasAi*` (~3949-4650).
- Fora da fronteira: Memory/Open-Brain (8499+), youtube (já em `youtubePrewarmClient.ts`).
- `client.ts` re-exporta (barrel). Verificação: [V-VOICE].
- [ ] feito

### R3 · `lib/api/engineering.ts`
- Funções 7241-7657 + tipos 1304-3228. Barrel. [V-STD] (`test:engineering` cobre).
- [ ] feito

### R4-R9 · Demais domínios (lotes de 2-3)
- Ordem sugerida: health+captures+sync → inbox+voice+devices → projects+tasks+agenda+routines → mac+cartografia+cognitive+memory. Layout completo no [02 Parte B](02-refatoracao.md). Barrel sempre. [V-STD] por lote.
- [ ] R4 [ ] R5 [ ] R6 [ ] R7 feito

### R10 · `lib/store/` slices (doc 02 Parte C)
- Ordem interna: `persistence.ts` + `converters.ts` + `coreSlice` → domainsSlice → capturesSlice → checkins/behaviors → healthSlice (leva o cluster sleep-repair) → screenTime/mission → **syncSlice por último** (o `sync()` de 426 linhas depende das filas de todos).
- Invariante: `PersistedAtlasState` + `persist()` centralizados; shape MMKV `atlas.store.v1` **não muda** (diff de snapshot antes/depois: hidratar, serializar, comparar JSON).
- 1 slice por PR. [V-STD] (`test:health` cobre o grosso).
- [ ] feito

### R11 · `SettingsSheet.tsx` → `components/sheets/settings/`
- Dividir por seção + `SettingsRow`/`SettingsSection` compartilhados. [V-STD].
- [ ] feito

### R12 · `DetailSheet.tsx` → `components/sheets/detail/`
- Extrair seções; corrigir `key={index}` (linhas 347, 898) na passada. [V-STD].
- [ ] feito

---

## FASE M — MIGRAÇÃO atlas-ai (doc 03, fatias S0-S8) — 1 PR por fatia, [V-VOICE] em todas

Contratos das APIs dos hooks: [03 §7](03-migracao-atlas-ai.md). Teste manual por fatia: enviar texto, voice mode completo, record memo, attachment, trocar thread, decide/routing, kill-app com submit pendente.

### M0 · Preparação
- Pré: R2 concluído. Consolidar `PENDING_SUBMISSION_KEY` (de `AtlasAiSubmissionRecovery.ts:21`) em `AtlasAiStorageKeys.ts`.
- Escrever os 3 testes de rede de segurança ([03 §6](03-migracao-atlas-ai.md)): RoutingModel dispatch, snapshot de payload de submit, stream merge/dedup. Registrar na bateria.
- [ ] feito

### M1 · `useAtlasThread` + `useAtlasTraceStream` (risco ALTO)
- Criar `components/sheets/atlas-ai/hooks/useAtlasThread.ts` e `useAtlasTraceStream.ts` conforme contrato [03 §7]. Mover: state 416/794-798, refs 1726-1733, `loadThreadData` 2075, `refresh` 2160, `startTraceStream` 2781, effects 2305-2567.
- Regra: nenhum outro código toca os refs de stream — só via hook.
- [ ] feito

### M2 · `useAtlasRouting`
- Mover: state 420-422/811-812, hydration effects 1904-1941, `openRouting` 4706, `confirmRouting` 4992-5080.
- Shape persistido de `atlas-ai.routing`/`atlas-ai.compute-effort` **não muda**.
- [ ] feito

### M3 · `useComposerRecorder`
- Mover: state 434-437, refs 438-442, fns 840-1102, effects 1076/1096. Implementar `acquire/release` (arbitragem explícita Voice↔Record).
- [ ] feito

### M4 · Matar contrato V1 (depende de confirmação backend)
- Pré: no atlas-server, confirmar telemetria aceita `source='atlas_mobile_ai_programming_mode'` e consumidores toleram `schema_version:2` + chaves extras (rodar `php artisan atlas:ai:session-bootstrap --task="mobile V1 contract removal" --json`).
- Passos: branch não-auto de `atlasModePayloadForRouting` → `buildInteractionPayload` direto; remover param morto `focus` (`void focus`, :213); deletar `lib/atlasAi/v1Adapter.ts`, `lib/atlasAiModeContract.ts`, `scripts/atlas-ai-v1-adapter.test.ts`; **atualizar `scripts/atlas-ai-runtime.test.ts`** (importa o V1 em :23 — migrar asserções para o contrato V2 ou remover as obsoletas); remover script `test:v1-adapter` do package.json.
- [ ] feito

### M5 · `useAtlasVoiceController` (risco ALTO, maior fatia)
- Mover: state 452-472, refs 1734-1758, fns 1104-1650, effects 1962-4064 (watchdog, endpointing, playback, telemetria). Consome M1+M3.
- Teste manual voice completo obrigatório no device físico.
- [ ] feito

### M6 · Sheets menores absorvem seus handlers
- Attachments → `AtlasAiAttachmentModel` (pickers 2627-2772); Workspace → `AtlasAiMobileWorkspaceModel` (fns 1968-2018); Execution/Operations/Skills/Search/SessionMap/Context/ThreadHistory: cada um leva seus handlers (5081-5204, `selectThread` 4829, `deleteThread` 5131, paginação 2234-2303).
- [ ] feito

### M7 · `useAtlasSubmit`
- Mover `submitText` 4123-4514 + `submit` 4628 + recovery (`AtlasAiSubmissionRecovery`, effects 4603/4611). Consome M1+M2+M3.
- ⚠️ `atlas-ai-mobile-hyperflow-screen.test.ts` asserta por string que AtlasAiSheet importa `buildInteractionPayload` — **atualizar a asserção** para o novo arquivo, não deletar o teste.
- [ ] feito

### M8 · Shell final
- AtlasAiSheet reduzido a container + `keyboardHeightShared` + flags + composição (~600-800 linhas). Confirmar contagem: `wc -l components/sheets/AtlasAiSheet.tsx`.
- [ ] feito

---

## FASE P — PÓS-OBRA (decisões, não execução mecânica)

- **P1** Medir performance real (startup, jank em listas) → decidir Swift ([auditoria Fase 4](../auditoria-refatoracao-2026-07.md)).
- **P2** Inversão de hierarquia (raiz outcome-first + omnibox) — [04-licoes-cursor-ios.md](04-licoes-cursor-ios.md).
- **P3** Live Activities/lock screen via `@bacons/apple-targets` — independente de P1.
- **P4** Bugs médios restantes da auditoria (§6.5, §6.8-6.14) que não caíram nas fases anteriores.

## Grafo de dependências (resumo)

```
E-D1 → E-D2 → E-A → E-B → E-C → E-E1 → E-E2      (sequência livre dentro da fase)
F1-F3                                              (qualquer ordem, após FASE E)
S-A1..A9                                           (qualquer ordem)
R1 → R2 → M0 → M1 → {M2, M3} → M4(backend) → M5 → M6 → M7 → M8
R3..R9                                             (qualquer momento após R1)
R10                                                (paralelo com FASE M — áreas disjuntas)
R11, R12                                           (qualquer momento)
P*                                                 (só após M8)
```
