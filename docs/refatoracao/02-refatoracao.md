# 02 — Refatoração (consolidação + desmonte dos megafiles)

> Parte do plano de refatoração. Índice: [README.md](README.md) · Pré-requisito: [01-eliminacao.md](01-eliminacao.md) concluído.

Duas frentes: **consolidar duplicação** (baixo risco, ~600 linhas) e **desmontar os 4 megafiles** (médio risco, mapeados linha a linha abaixo). A migração do núcleo atlas-ai (AtlasAiSheet) tem documento próprio: [03-migracao-atlas-ai.md](03-migracao-atlas-ai.md).

---

## Parte A — Consolidação de duplicação (~600 linhas)

Cada item = 1 commit. Verificação: `npm run typecheck && npm run test:front`.

| # | Duplicação | Onde | Destino | Ganho |
|---|---|---|---|---|
| A1 | ~28 helpers verbatim (median, quantile, clamp, average, cleanUnit, formatDateTime, snapshotSleep*, sleepStage*, idealSleepStageHours, DetailBlock/List/Metric) | `app/health.tsx` ↔ `app/sleep.tsx` | `lib/healthDerive.ts` (lógica) + `components/health/HealthPrimitives.tsx` (JSX) | ~250 |
| A2 | `Metric`, `StatusPill`, `SmallAction`, `Fact` redefinidos | 6 rotas: engineering, projects, rivals, routines, open-brain, memory | `components/atlas-ui/` | ~150 |
| A3 | `formatRelative` — 4 cópias idênticas + 1 divergente | AtlasAiTurnModel, AtlasAiContextSheet, AtlasAiSessionSheets, AtlasAiExecutionSheet, AtlasAiContinuityPanel | 1 util em `lib/formatRelative.ts` | ~40 |
| A4 | Scrim fade (useSharedValue+withTiming+useAnimatedStyle) reimplementado | BottomSheet, CenterModal, SideSheet (Scrim.tsx já existe, só 2 usam) | rotear os 3 por `Scrim.tsx` | ~40 |
| A5 | `clamp()` — 6 cópias | sleepOperational:249, readiness:2416, sleepAnalysis:476, sleepPhysiology:230, atlasStore:3311 (`clampLevel`) | `lib/mathUtils.ts` | ~15 |
| A6 | `chunkItems`/`chunks` idênticos | atlasStore:3289 ↔ healthKit:2413 | `lib/mathUtils.ts` | ~8 |
| A7 | `BackArrow` (bitacula↔sleep) e `DotLeader` (review↔ritual) | 4 rotas | `components/atlas-ui/` | ~40 |
| A8 | Deep clone `JSON.parse(JSON.stringify())` | healthKit:2469 | `structuredClone` (Hermes já tem) | 1 |
| A9 | `<Stack.Screen>` redundantes (só 6 de 21 têm animação custom) | `app/_layout.tsx` | deixar expo-router auto-registrar os default | ~15 |

⚠️ A1/A3 carregam correções de bugs junto (auditoria §6.5–6.7): ao unificar, **escolher explicitamente** o comportamento canônico:
- `isRecord`: adotar `typeof v === 'object' && v !== null` (a variante de health.tsx).
- `formatRelative`: decidir entre "agora/5min/2h" e "há 5 min" — padronizar as 5 chamadas no mesmo formato.
- `idealSleepStageHours`: usar um único formatter (`formatHours`).

---

## Parte B — Split do `lib/api/client.ts` (9.401 linhas)

### Estrutura atual (mapeada)

```
1-48        imports + cache de config (host/port/token/deviceId)
50-5751     BLOCO DE TIPOS (~5.700 linhas, intercalado por domínio)
5752-5762   AtlasApiError
5764-5911   config + auth (hydrateApiConfig, getApiBase, getAtlasAuthHeaders, mobile session)
5912-8676   funções de domínio (mapa abaixo)
8677-8763   wrappers HTTP genéricos (apiGet/apiPost/mobileApiGet/…)
8965-9360   engine privado (executeFetch, apiRequest, etag cache, retry, secure token storage)
9361-9401   re-export de ./loopClient (agents/fleet)
```

### Mapa de domínios (funções)

| Domínio | Linhas | ~vol | Destaques |
|---|---|---|---|
| Health/domains core | 5912-5950 | 40 | getHealth, listDomains, listCaptures |
| Mobile pairing/devices | 5951-6013 | 60 | confirmMobilePairing, recoverMobileDeviceSession |
| Voice (mobile) | 6014-6188 | 175 | start/endMobileVoiceSession, synthesize, readiness |
| Mac remote | 6189-6274 | 85 | mac status/sleep/caffeinate/maintenance |
| Push/notifications | 6268-6289 | 22 | updateMobilePushToken |
| Inbox/captures mobile | 6290-6423 | 134 | listMobileInbox, discussão, recommendations |
| Captures + health writes | 6425-6672 | 248 | bulkTriage, bitacula, uploads, **syncDelta:6669** |
| Mission/agenda/routines | 6673-6828 | 156 | getTodayMission, planTaskAgenda |
| Projects | 6829-7151 | 323 | CRUD, steps, blockers, plan proposals |
| Tasks | 7152-7240 | 89 | patch/schedule/defer/complete |
| **Engineering** | 7241-7657 | **417** | blueprints, harness, tools, code-intel, benchmarks |
| Calendar | 7662-7708 | 47 | calendar blocks |
| Cartografia/vault | 7709-7801 | 93 | semantic notes, curation, vault health |
| Cognitive game | 7802-7871 | 70 | — |
| **Atlas AI** | 7872-8496 | **625** | createAiInteraction:7872, streamAiInteraction:8027, threads, providers, telemetry |
| Memory/Open-Brain | 8499-8676 | 178 | context pack, review queues, projection |

### Layout alvo

```
lib/api/core.ts        ← engine + config + auth + wrappers + AtlasApiError + envelopes compartilhados
                          (linhas 1-48, 5752-5911, 8677-8763, 8965-9360 — mutuamente recursivos, ficam juntos)
lib/api/atlasAi.ts     ← 7872-8496 + tipos 3949-5074   ★ candidato nº1 (núcleo da migração, doc 03)
lib/api/engineering.ts ← 7241-7657 + tipos 1304-3228   ★ candidato nº2 (maior bloco de tipos)
lib/api/health.ts      ← health snapshots, checkins, passive, digital, behaviors, bitacula
lib/api/captures.ts    ← captures CRUD/triage/upload + plan proposals
lib/api/inbox.ts       ← mobile inbox + recommendations + pontes inbox→thread
lib/api/voice.ts       ← voice session/turn/tts/readiness
lib/api/mac.ts         ← mac remote + push/notifications
lib/api/devices.ts     ← pairing/recover/revoke/constelação
lib/api/agenda.ts      ← mission + task agenda + calendar blocks
lib/api/tasks.ts       ← tasks CRUD + events
lib/api/projects.ts    ← projects/steps/blockers/proposals
lib/api/routines.ts    ← routines
lib/api/cartografia.ts ← semantic vault
lib/api/memory.ts      ← open-brain/memory
lib/api/sync.ts        ← syncDelta + tipos (importado pelo atlasStore)
lib/api/loop.ts        ← já existe como loopClient.ts; matar o shim de re-export
lib/api/client.ts      ← vira barrel re-exportando tudo (preserva os 57 import sites)
```

### Regras do split

1. Tipos co-locados com as funções do domínio (mover a fatia correspondente de 50-5751).
2. `client.ts` vira **barrel** — nenhum import site muda no primeiro passo; migrar imports para os módulos diretos depois, oportunisticamente.
3. Ordem: `core.ts` primeiro (1 PR) → `atlasAi.ts` (1 PR, pré-requisito do doc 03) → `engineering.ts` → resto em lotes de 2-3 domínios.
4. Acoplamentos conhecidos: `DomainKey` (de `../domains`) usado por 5 domínios — fica onde está; `syncDelta` toca 8 tipos de fila — vive em `sync.ts` e importa tipos dos domínios; pontes inbox→AI thread ficam em `inbox.ts` importando tipos de `atlasAi.ts`.

---

## Parte C — Split do `lib/atlasStore.ts` (3.474 linhas)

### Estrutura atual (mapeada)

- Store Zustand único (`create<AtlasState>`, linhas 365-1607) + ~1.860 linhas de helpers (1608-3474).
- Persistência **manual** (sem middleware): `persist()` em 3447 grava `PersistedAtlasState` na chave MMKV `atlas.store.v1`; hydrate em 373 + `normalizePersistedState` em 3381; ~50 call sites `await persist(get())`.
- Hotspot: **`sync()` (449-874, 426 linhas)** — toca as 8 filas queued* e baixa todos os domínios num `Promise.all`.
- 29 arquivos consomem o store; maiores fan-outs: `domains` ×17, `queuedCaptures` ×7, `sync` ×4.

### Layout alvo (slices-pattern, `useAtlasStore` mantém identidade — zero mudança nos 29 consumers)

```
lib/store/coreSlice.ts       hydrated/syncing/lastError/serverReachable, hydrate, refresh
lib/store/domainsSlice.ts    domains, refreshDomains, createDomain
lib/store/capturesSlice.ts   captures + fila + triage/clarify + projeção inbox
lib/store/checkinsSlice.ts   checkins + fila
lib/store/behaviorsSlice.ts  behaviors/behaviorLogs + filas + bitacula helpers
lib/store/healthSlice.ts     healthSnapshots/passiveSignals + HealthKit + cluster sleep-repair (2383-2566, 3177-3268)
lib/store/screenTimeSlice.ts digitalSessions/Snapshots + ScreenTime
lib/store/missionSlice.ts    mission, loadMission
lib/store/syncSlice.ts       sync() — POR ÚLTIMO (depende das filas de todos)
lib/store/converters.ts      queuedTo* + merge* compartilhados
lib/store/persistence.ts     STORAGE_KEY, persist(), normalizePersistedState
```

### Regras do split

1. **`PersistedAtlasState` e `persist()` ficam centralizados** — enumeram todos os campos; shape persistido não muda ⇒ chave `atlas.store.v1` continua compatível, **zero migração**.
2. `sync()` é extraído **por último**, depois que cada slice expõe getters/setters da própria fila.
3. A migração one-shot de sleep-repair (`atlas.health.dataRepairVersion`) vai junto com o healthSlice.
4. 1 slice por PR, `npm run test:front` (bateria `test:health` cobre o grosso) em cada.

---

## Parte D — Splits de UI restantes

### D1 — `SettingsSheet.tsx` (4.116 linhas)
Várias telas de settings coladas num componente. Dividir por seção em `components/sheets/settings/` com scaffolding de row compartilhado (`SettingsRow`, `SettingsSection`). Ganho ~500 linhas + legibilidade. Sem estado cross-section relevante — split simples.

### D2 — `DetailSheet.tsx` (2.054 linhas)
Extrair seções para `components/sheets/detail/`. Atenção ao bug `key={index}` (linhas 347 e 898) — corrigir na passagem.

### D3 — `AtlasAiSheet.tsx` (5.808 linhas)
**Documento próprio**: [03-migracao-atlas-ai.md](03-migracao-atlas-ai.md). É o núcleo da migração e o maior risco do plano.

---

## Sequência recomendada da refatoração

```
Parte A (consolidação)                     — 1-2 dias, risco baixo
Parte B core.ts + atlasAi.ts               — pré-requisito do doc 03
Doc 03 (migração atlas-ai)                 — o grosso do trabalho
Parte C (atlasStore slices)                — paralelo possível com doc 03 (áreas disjuntas)
Parte B resto + Parte D1/D2                — cauda, oportunístico
```

Verificação padrão: `npm run typecheck && npm run test:front` por commit; `npm run check:mobile-voice` em tudo que tocar atlas-ai/voz.
