# Auditoria completa — atlas-app (2026-07-11)

Base de planejamento da refatoração pesada. Varredura completa de `app/`, `components/`, `lib/`, `scripts/`, dependências e configs, feita por 4 agentes de auditoria em paralelo. Escopo desta auditoria: **inchaço e over-engineering** (o que deletar/simplificar). Bugs encontrados de passagem estão catalogados na seção 6 — corrigir em passe próprio.

## 0. Números do estado atual

| Métrica | Valor |
|---|---|
| Arquivos TS/TSX (app+components+lib) | 371 |
| Rotas expo-router | 27 (21 registradas no `_layout`) |
| Maior arquivo | `lib/api/client.ts` — **9.401 linhas** |
| God-components | `AtlasAiSheet` 5.808 · `SettingsSheet` 4.116 · `lib/atlasStore` 3.474 · `DetailSheet` 2.054 |
| Código morto confirmado (deleção zero-risco) | **~3.450 linhas** |
| Redução realista total (com splits) | **~7.000+ linhas** |
| Dependências removíveis | **8** |
| Assets mortos na raiz | ~600KB (6 arquivos) |

---

## 1. FASE 1 — Deletar (zero risco, zero mudança de comportamento)

Tudo aqui tem **zero importadores reais** (só comentários "removido vN" ou referências mortas). Ordem: maior corte primeiro.

### 1.1 Componentes mortos (~2.061 linhas, 13 arquivos)

| Arquivo | Linhas | Evidência |
|---|---|---|
| `components/console/FieldInline.tsx` | 333 | substituído por AtlasComposerCard |
| `components/cartografia/focus/ContinentPeek.tsx` | 296 | zero refs |
| `components/cartografia/floaters/MiniMap.tsx` | 263 | zero refs |
| `components/sheets/atlas-ai/ComposerModeSheet.tsx` | 196 | só ref em comentário |
| `components/sheets/atlas-ai/ComposerPillsRow.tsx` | 186 | `@deprecated 2026-05-18` |
| `components/sheets/atlas-ai/ComposerProviderSheet.tsx` | 163 | só refs em comentário |
| `components/inbox/CaptureButton.tsx` + `FoilStar.tsx` | 174 | só ref em comentário de estilo |
| `components/inbox/NewCapturesPill.tsx` | 118 | "removido v13" |
| `components/ProcessingCard.tsx` | 99 | zero refs |
| `components/SyncBar.tsx` | 92 | "removido v13" |
| `components/inbox/LiveStatus.tsx` | 87 | "removido v12" |
| `components/DomainChip.tsx` | 54 | zero refs |

> Atenção: `ComposerPillsRow.tsx` e `ComposerProviderSheet.tsx` estão **modificados no branch atual** (`feat/agent-governance-fleet-screen`) — resolver o estado do branch antes de deletar.

### 1.2 Rotas mortas (~526 linhas)

| Rota | Linhas | Evidência |
|---|---|---|
| `app/plan-visible.tsx` | 246 | inspector dev AP-703, zero navegação inbound |
| `app/detail.tsx` | 187 | superseded pelo overlay system (`useOverlays().openDetail`) |
| `app/decision.tsx` | 93 | só empty-state; fluxo real roda via `overlays.ts` |

Remover também os `<Stack.Screen>` correspondentes no `_layout.tsx` e as entradas em `FOCUSED_ROUTES` do Dock.

### 1.3 Módulos lib/ mortos (~330 linhas)

| Arquivo | Linhas | Evidência |
|---|---|---|
| `lib/atlasAiModeContract.ts` | 167 | `@deprecated` V1; único importador é o próprio teste |
| `lib/atlasAi/usePatamar4State.ts` | 58 | 0 importadores (o runtime `patamar4State.ts` é o usado) |
| `lib/hooks/useProviderChoice.ts` | 45 | 0 importadores |
| `lib/atlasAi/placeholders.ts` | 26 | 0 importadores |
| `lib/inboxModels.ts` | 3 | stub vestigial |
| `lib/richInput/computeEffort.ts` | 1 | stub vestigial |

### 1.4 Dependências (8 pacotes)

Remoção imediata (zero imports no repo):
- `react-hook-form` + `@hookform/resolvers` + `zod` (o CLAUDE.md lista como stack, mas **nada usa** — atualizar o CLAUDE.md junto)
- `@expo-google-fonts/fraunces` (só aparece em comentários)
- `react-dom` (sem react-native-web, build web é impossível)
- `livekit-client` (já vem transitivo via `@livekit/react-native`)

Condicionais (resolver o bug de fontes §6.1 primeiro):
- `@expo-google-fonts/inter`, `@expo-google-fonts/jetbrains-mono`

Manter (autolinked/peers, ausência de import JS é normal): `react-native-screens`, `react-native-nitro-modules`, `react-native-worklets`, `expo-dev-client`, `expo-asset`, `expo-font`.

### 1.5 Scripts e artefatos mortos (~450 linhas + ~600KB)

- 4 testes órfãos que nenhuma bateria do `package.json` roda: `ob05-open-brain-injection.test.ts`, `patamar4State.test.ts`, `youtube-prewarm.test.ts`, `youtube-summary.test.ts`
- 6 artefatos na raiz: `atlas-composer-mockup.html`, `atlas-composer-implementation-state.html`, `atlas-home-editorial-mockup.html`, `historico-variantes-mockup.html`, `atlas-d-clean-proof.png`, `atlas-d-screenshot-proof.png`
- Script npm `web` (sem react-native-web, o comando falha)

**Verificação da Fase 1:** `npm run typecheck && npm run test:front` após cada lote de deleção.

---

## 2. FASE 2 — Consolidar duplicação (~600 linhas)

| O quê | Onde está duplicado | Destino |
|---|---|---|
| ~28 helpers idênticos (median, quantile, clamp, average, formatDateTime, snapshotSleep*, DetailBlock/List/Metric…) | `app/health.tsx` ↔ `app/sleep.tsx` (verbatim) | `lib/healthDerive.ts` (~250 linhas) |
| `Metric` / `StatusPill` / `SmallAction` / `Fact` | 6 rotas (engineering, projects, rivals, routines, open-brain, memory) | `components/atlas-ui/` (~150 linhas) |
| `formatRelative` | 5 cópias (4 idênticas + 1 divergente — ver §6.5) | 1 util compartilhado (~40 linhas) |
| Scrim fade-in/out (useSharedValue+withTiming) | BottomSheet, CenterModal, SideSheet reimplementam o que `Scrim.tsx` já faz | rotear pelos `Scrim.tsx` (~40 linhas) |
| `clamp()` | 6 cópias em lib/ (sleepOperational, readiness, sleepAnalysis, sleepPhysiology, atlasStore) | 1 shared (~15 linhas) |
| `chunkItems`/`chunks` | `atlasStore.ts:3289` ↔ `healthKit.ts:2413` (idênticos) | 1 shared (~8 linhas) |
| `BackArrow`, `DotLeader` | bitacula↔sleep, review↔ritual | shared (~40 linhas) |
| Deep clone `JSON.parse(JSON.stringify())` | `healthKit.ts:2469` | `structuredClone` (Hermes já tem) |
| `<Stack.Screen>` redundantes | `_layout.tsx` registra 21 rotas; só 6 têm animação custom | deixar expo-router auto-registrar (~15 linhas) |

---

## 3. FASE 3 — Desmontar os god-components (~2.500–3.500 linhas recuperáveis)

Maior fonte de "bagunçado e bugado" do app. Não é deleção — é extração com contrato de teste antes/depois.

1. **`components/sheets/AtlasAiSheet.tsx` (5.808 linhas)** — 1 função, 69 `useState`, 44 `useRef`, 28 branches de return. Os sub-sheets por modo (composer/thread/context/execution) **já existem** como irmãos em `atlas-ai/` — mover a lógica de cada modo para dentro deles.
2. **`components/sheets/SettingsSheet.tsx` (4.116 linhas)** — várias telas de settings coladas; dividir por seção com scaffolding de row compartilhado.
3. **`lib/api/client.ts` (9.401 linhas)** — split por domínio (health, atlas-ai, inbox, agents…).
4. **`lib/atlasStore.ts` (3.474 linhas)** — split por slice de domínio (Zustand suporta slices nativamente).
5. **`components/sheets/DetailSheet.tsx` (2.054 linhas)** — extrair seções.
6. **Camada V1→V2 do atlas-ai (~300 linhas)** — `v1Adapter.ts` (133L) existe para UM caller (`AtlasAiRoutingModel.ts:18`). Migrar o caller para `buildInteractionPayload` direto e deletar adapter + contrato V1 junto.

Regra da fase: **uma extração por PR**, `npm run check:mobile-voice` verde em cada uma.

---

## 4. FASE 4 — Decisão de stack (Swift)

Só depois das fases 1–3. Racional: reescrever com o domínio limpo é ~3× mais barato, e é possível que após o emagrecimento a experiência RN já atenda.

- **Gatilho para ir de Swift**: jank/startup medidos que Tamagui+Reanimated+Hermes não resolvem — sintomas medidos, não estética de stack.
- **Se for**: migração incremental (shell SwiftUI + telas RN via brownfield, uma tela por vez), nunca big-bang.
- **Independente da decisão**: Live Activities/widgets/lock screen já podem ser feitos agora no Expo via `@bacons/apple-targets` + extension SwiftUI (~200 linhas Swift) — não dependem de reescrita.

---

## 5. Itens borderline (decisão consciente, não cortar cego)

- `lib/sha256.ts` (123L hand-rolled): se o caminho `crypto.subtle` for confiável no runtime, deletar o fallback sync (~100L); senão trocar por `expo-crypto`.
- Fallback AsyncStorage em `lib/storage.ts`: só importa para Expo Go/web — manter enquanto dev-client não for universal.
- Thin-clients `patamar4StateClient`/`runtimeReadinessClient` (40L): split existe para isolamento dos testes tsx — manter enquanto o padrão de teste for esse.
- `mobile-thread`/`mobile-inbox-item`: alcançáveis só por deep link de push — **manter** (intencional).

---

## 6. Bugs e falhas catalogados (passe próprio, fora do escopo de deleção)

### Críticos
1. **Fontes nunca carregadas**: `Inter_400Regular`, `Inter_500Medium`, `JetBrainsMono_400Regular` usadas como `fontFamily` em várias telas, mas **não existe nenhum `useFonts()`/`loadAsync()`** — o app inteiro renderiza em fonte de sistema silenciosamente. Corrigir ou remover pacotes+strings.
2. **Secret commitado**: `extra.atlas.apiToken` hardcoded em `app.json:114`; `app.config.js` lê `../atlas-server/.env` e se faltar cai **silenciosamente** no placeholder commitado.
3. **IP de infra privada commitado**: `apiHost 100.80.228.41` + `liveKitUrl ws://...` em `app.json:112-115`.
4. **ATS desabilitado app-wide**: `NSAllowsArbitraryLoads=true` (`app.json:28-30`).

### Médios
5. `formatRelative` divergente: 4 cópias dizem "agora/min/h/d", a 5ª (ContinuityPanel) diz "há N min" — mesma função, UX inconsistente.
6. `isRecord` diverge entre health.tsx e sleep.tsx (tratamento de null/0/'' diferente) — mesmo dado, resultado diferente por tela.
7. `idealSleepStageHours` formata com função diferente em health vs sleep — drift silencioso.
8. Plugin `expo-notifications` declarado 2× (`app.json` + re-append em `app.config.js:52`) — merge indefinido.
9. `catch {}` vazio engolindo erro em `lib/api/client.ts:8163`.
10. Idempotency key via `Math.random()` em `lib/atlasVoiceRuntime.ts:122` — propenso a colisão.
11. `_executor` em `AtlasAiDecideStatus.tsx` documentado como "consumido por ComposerPillsRow", mas ComposerPillsRow está morto — executor silenciosamente dropado.
12. `key={index}` em listas mapeadas (9 ocorrências: CaptureWave, VoiceModeSheet, DetailSheet, ThreadHistorySheet, ContinentGlyph, DoneList…) — glitches de reorder/animação.
13. `detail.tsx`: botões "editar"/"mover de domínio" com handler `/* TODO */` vazio (morre junto com a rota na Fase 1).
14. Corrida potencial em `HEALTHKIT_LAST_ERROR_KEY` (reset em `healthKit.ts:571` vs leitura em :524).

---

## 7. Sequência de execução

| Fase | Conteúdo | Risco | Estimativa |
|---|---|---|---|
| 1 | Deletar mortos + deps + artefatos (~3.450 linhas, 8 deps) | Zero | 1 dia |
| Bugs críticos | §6.1–6.4 (fontes, secret, IP, ATS) | Baixo | 1 dia |
| 2 | Consolidar duplicação (~600 linhas) | Baixo | 1–2 dias |
| 3 | Splits: AtlasAiSheet → SettingsSheet → client.ts → atlasStore → DetailSheet → matar V1 adapter | Médio (1 PR por split) | 1–2 semanas |
| Bugs médios | §6.5–6.14 | Baixo | 1–2 dias |
| 4 | Medir performance real → decidir Swift (incremental se for) | — | decisão pós-fase 3 |

Verificação padrão em toda fase: `npm run typecheck && npm run test:front`; para mudanças que tocam voz/atlas-ai: `npm run check:mobile-voice`.
