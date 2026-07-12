# Atlas-app → SwiftUI puro: plano de migração definitivo

> Gerado por design multi-agente (5 análises fundamentadas no código → 3 estratégias + júri → síntese → crítica adversarial). Estratégia vencedora: **parallel-native-rebuild**. Correções da revisão adversarial já aplicadas abaixo.

## ⚠️ Nota de estado do repo (ler primeiro)

Este plano usa a **decomposição limpa** como spec do port (o motivo de a refatoração ter valido): `lib/api/*` (core/atlasAi/engineering/…), `lib/store/` slices, `lib/storeConverters.ts`. **Esse estado vive no branch `feat/agent-governance-fleet-screen` (37 commits), não no `main`.** No `main` o código ainda é o monolito (`lib/api/client.ts` ~9.4k linhas, `lib/atlasStore.ts` com o merge inline no reducer `sync()`).

**Recomendação:** basear o port Swift no branch decomposto (mergear a refatoração primeiro) — a spec limpa (403 DTOs em módulos por domínio, slices, merge extraído) é muito melhor mapa pro Swift do que o monolito. Se optar por ficar no `main` monolito, **o passo zero de §3.5 é extrair o merge core do reducer `sync()` pra funções puras em TS (atrás dos testes existentes) antes de portar** — senão você traduz spaghetti direto pro Swift.

## ✅ Correções da revisão adversarial (aplicadas / a observar)

1. **SSE não streama token-a-token no device hoje** (§3.4 corrigido). Em New Arch, `response.body` é `null` → o runtime cai no branch `response.text()` e **bufferiza o turno inteiro**. O loop de reconnect `after=lastSequence` é o **mecanismo de resumabilidade load-bearing**, não cerimônia. Em Swift, `URLSession.bytes` entrega streaming *pela primeira vez* — é **upgrade, não paridade**. A "baseline TTFT" na verdade mede time-to-**full**-response.
2. **"Nunca prebuild" NÃO é o diferencial** (§2 corrigido): MMKV v4 + nitro **já forçam um dev-client custom em todo build EAS** — o app já cruza o prebuild. Parallel-rebuild se justifica pelo que é real: **N=1, sem estado in-process pra compartilhar, A/B lado-a-lado**.
3. **Segundo bundle = duplicação de provisioning, não "re-parear uma vez"** (§2/§8): `com.vitor.atlas.native` é App ID separado com provisioning profile, cert APNs, entitlement HealthKit, background-delivery e associated-domain `atlas://` próprios (+ expiry de 7 dias no profile dev não-pago). Trabalho único explícito, não trivial.
4. **Readiness: gate em epsilon, não byte-idêntico** (§6 M2): `readiness.ts`/`physiologicalAge.ts` são transcendental-heavy; `Math.pow/exp` JS vs `Foundation` Swift diferem nos últimos ULPs. Gate = score dentro de tolerância pequena + mesmo tier bucket, não igualdade de bytes.
5. **Baseline enxuta pra N=1**: reduzir §1 a três gates que param um cutover ruim — (a) dogfood do operador lado-a-lado (gate de aceite legítimo), (b) um número de FPS pra `cartografia` (única tela onde Swift pode perder), (c) golden-value (epsilon) de readiness. O resto é medição por medição.
6. **Contagens são estimadas**: `openAtlasAi` ≈ 5 invocações reais (não 13 — o resto são imports/deep-link/push); LOC varia ±3% (`AtlasAiSheet` ~5.66k). Não muda conclusões.

---

**Repo:** `/Users/vitorepf/develop/Atlas/atlas-app` · **Stack atual:** RN 0.81.5 + Expo 54.0.33 (managed), newArch ON, expo-router, Tamagui, Zustand, LiveKit, HealthKit, MMKV · **Bundle:** `com.vitor.atlas` · **Scheme:** `atlas://` · **Backend:** Laravel local `127.0.0.1:3737` (Bearer + `X-Atlas-Token`) · **Operador:** N=1 (Vitor), local-first.

**Decisão já tomada:** destino é SwiftUI puro (zero RN no end-state). Este plano é *como* chegar lá **incrementalmente, sem big-bang, com o app sempre shippável** — não *se* fazer.

**Estratégia vencedora:** `parallel-native-rebuild` (rebuild nativo paralelo contra o mesmo contrato REST), com enxertos das outras três (omnibox-first do hybrid-shell, verificação on-device de Keychain/MMKV do brownfield, harness golden-value de HealthKit + gotcha de data ISO8601).

---

## 1. Decisão & gate — a baseline RN que valida os alvos Swift

A decisão de ir pra Swift é do operador e não está em disputa. Mas o **gatilho de cada cutover é jank medido**, não fé. A baseline RN serve duas funções: (a) definir o alvo que o Swift **não pode regredir**, e (b) confirmar a *ordem* das telas (as telas que mais doem em RN sobem na fila).

**Regra de ouro (da auditoria):** nenhuma tela nativa faz cutover se não **iguala ou bate** sua baseline RN. Se não bater, a flag fica em RN e a versão nativa volta pra bancada. É isso que torna a flag por-tela uma *decisão real*, não formalidade.

### Baseline a capturar — no device físico, nunca no simulador

Medir **antes** de portar. Estas três hipóteses de ordenação dependem dos números:

| # | Métrica | Onde | Por que importa |
|---|---|---|---|
| 1 | **FPS de pan/zoom** vs. contagem de nós | `cartografia` (`components/cartografia/`, 32 arquivos, SVG + reanimated worklets) | Suspeito pior ofensor. Define o alvo do `Canvas` Swift e confirma que cartografia vai **por último**. |
| 2 | **Cold-mount + latência keystroke→render p95** | `AtlasAiSheet` (5.807 linhas, sempre montado no `OverlayHost`) | É o produto. Define a barra de TTI/latência do flagship. |
| 3 | **TTI + frame drops durante cálculo de readiness** | `health.tsx` (5.101 linhas) + `readiness.ts` (2.415) computando na JS thread | Caso mais forte de "Swift ganha" (compute sai da JS thread + HealthKit nativo). Valida a prioridade da fase HealthKit. |

**Secundárias (startup / memória):**
- **Cold-hydrate blob:** custo de `hydrate()` no boot — leitura MMKV + `JSON.parse` + `normalizePersistedState` do blob `atlas.store.v1` (MB-scale). Toda tela espera isso no cold start.
- **Memória residente** do processo RN em idle (denominador pra comparar contra Swift).
- **Time-to-first-token** do SSE no composer (`lib/atlasAiStreamRuntime.ts`).
- **Jank de scroll** nas listas pesadas: `projects.tsx`, `memory.tsx`, `engineering.tsx`.

**Ferramentas (lazy, nativas):** Instruments (Time Profiler + Core Animation FPS + Allocations) no build de release RN instalado no device; `console.time` no `hydrate()` pra o blob-parse; `PerformanceObserver`/logs manuais no runtime SSE. Não montar dashboard de métricas — os números vão pra uma tabela no doc de milestones e servem de gate. `// ponytail: baseline é uma planilha, não um sistema de telemetria`

**Alvos Swift derivados:** health TTI e keystroke-latency do composer devem *melhorar* (não só empatar); cartografia deve sustentar 60/120fps na contagem de nós da baseline; readiness deve dar **valor idêntico** (golden test), não "aproximado".

---

## 2. Estratégia escolhida — rebuild nativo paralelo, dois bundles, cutover por release

### Por que paralelo e não brownfield in-process

O fato estrutural que decide tudo: **quase não há estado in-process pra compartilhar.** Todo estado durável vive em três lugares que um processo Swift alcança **sem RN rodando**:

1. **Servidor** — `127.0.0.1:3737`, canônico (CLAUDE.md: "não mockar Atlas data"). Ambos os apps batem os mesmos endpoints com os mesmos headers. Estado de servidor é compartilhado de graça.
2. **Keychain** — `expo-secure-store` **é** o Keychain (`lib/api/core.ts` ~L559-635: `atlas-api.token`, `atlas-mobile.deviceToken`, `atlas-mobile.deviceId`). Swift lê os mesmos itens direto.
3. **MMKV `atlas.v1`** — cache de leitura + outbox offline (`lib/storage.ts`, **sem encryption key**). É *descartável* (o servidor é a verdade), então nem precisa migrar.

A única razão pra pagar o custo de brownfield in-process (`RCTRootView`/`RCTHost`, inversão do bootstrap bridgeless, dupla navegação, sessão de áudio disputada) é uma coexistência de runtime que **um app N=1 local-first não precisa**. O contra-fato que normalmente impede o app paralelo — uma base de usuários que pula entre telas nativas e RN no meio da sessão — **não existe**: um operador, um device.

### O modelo de coexistência: dois ícones, lado a lado

Não há bridge de runtime. Os dois apps coexistem só no sentido de estarem **ambos instalados no device do operador** durante a migração, batendo no mesmo servidor.

- **Swift ship como segundo bundle:** `com.vitor.atlas.native`, instalado ao lado do RN `com.vitor.atlas`. O operador roda os dois. Cada tela migrada é validada **lado a lado contra a original RN, no mesmo device, mesmo servidor, mesmos dados.** Esse é o harness A/B — **zero infra de feature-flag**.
- **Quando o Swift atinge paridade total**, ele assume a identidade `com.vitor.atlas` e o app RN é aposentado. Até esse flip, o app RN na home é o rollback sempre-disponível.
- **App RN permanece 100% shippável o tempo todo** — o ícone RN na home é o rollback sempre-disponível. (Correção: o "nunca prebuild" **não** é o diferencial — MMKV v4 + nitro já forçam um dev-client custom em todo build EAS, então o app já roda prebuild efêmero hoje; `ios/` é gitignored. A vantagem real do parallel-rebuild é **não haver estado in-process pra compartilhar** num app N=1 + **A/B lado-a-lado** no mesmo device, não pureza de prebuild.)

### As três regras que mantêm isso seguro

1. **Servidor é canônico + merge idempotente.** Leituras podem ser duplicadas em todo lugar. Um screen Swift pode fazer fetch/merge/render à vontade enquanto o RN ainda escreve.
2. **Um escritor por entidade por vez.** O blob `atlas.store.v1` é escrito inteiro (`persist()`). Migra-se **verticais inteiras** (tela *e* seu write-path juntos), aposentando o escritor RN daquela entidade. Nunca separar uma tela de suas escritas entre os dois runtimes. Cutover do escritor só quando `queue.total == 0` pra aquela entidade.
3. **Token: re-parear uma vez, não engenheirar sharing.** O Swift roda o fluxo de pareamento existente **uma vez** contra o mesmo servidor e guarda o próprio token no próprio Keychain. `// ponytail: re-parear uma vez; keychain-access-group compartilhado só se o churn de builds TestFlight incomodar` — pular a dança de entitlement/Team-ID pra economizar 20 segundos de pareamento.

### Enxertos das estratégias perdedoras (o que puxamos)

- **Do `hybrid-shell-first`:** a tese de que **o omnibox É o produto**. Não migramos o flagship *dead-last* cegamente — ele é server-backed (SSE + REST, **não escreve o outbox `atlas.store.v1`**), então pode dominar sua vertical inteira sem conflito de escritor. Isso permite antecipar o flagship assim que os padrões (list, detail, HealthKit, overlay, SSE-em-Swift) estiverem provados em telas mais baratas — entregando valor de produto antes das duas "rochas" gráficas (voz + cartografia). Também puxamos o estilo de gate por regressão-de-cold-start medida.
- **Do `brownfield-incremental`:** a disciplina de **verificação on-device dos atributos de Keychain/MMKV** — dump dos `kSecAttrService`/`kSecAttrAccessible` do app RN rodando, e do `mmapID`, **não assumir**. Vale mesmo no build paralelo se depois adicionarmos access-group compartilhado. Mais o **harness golden-value de HealthKit** e o **gotcha de data ISO8601 fracionária** (as três estratégias convergiram nisso).

---

## 3. Arquitetura-alvo Swift

Substrato construído **uma vez** na Fase 0, reusado por toda tela. Todo o substrato transfere intacto mesmo se algo der errado — é o piso de risco.

### 3.1 Navegação & shell

- **`NavigationStack` nativo**, não recriar expo-router. O root **não é um launcher** — é a lista de trabalho outcome-first + omnibox (a lição do Cursor-iOS: a raiz é o work-list + omnibox). Os 13 call-sites de `openAtlasAi` (verificados em `app/`+`components/`+`lib/`) viram navegação nativa que apresenta o composer.
- O `OverlayHost` sempre-montado (13 overlays em RN) vira apresentação nativa por `.sheet`/`.fullScreenCover` conforme a tela dona vai pra nativa. O `Dock` (`components/Dock.tsx`, absoluto sobre toda rota) vira uma `TabView`/dock nativo.

### 3.2 Estado — `@Observable`, **não** TCA

O store atual (`lib/atlasStore.ts`, monolito ~3.5k linhas + slices inline) já é um modelo pragmático set/get, não reducer/action/effect. Mapeia 1:1 pra `@Observable` (Observation, iOS 17+), e o tracking field-level da Observation é uma *simplificação* sobre os selectors do Zustand.

```swift
@MainActor @Observable final class AtlasStore {
    // persistido (espelha PersistedAtlasState)
    var captures: [AtlasCapture] = []
    var queuedCaptures: [QueuedCapture] = []
    // ...8 arrays canônicos + 8 filas + mission/lastSyncAt/health/screenTime
    // efêmero
    var hydrated = false; var syncing = false; var lastError: String?
}
```

TCA é taxa de cerimônia de semanas (reducers/effects/DI) sem payoff pra um blob set/get de operador único — falha o filtro de 5 perguntas do CLAUDE.md (#4/#5). Um `actor` para o engine de sync já dá a segurança de concorrência que importa. `// ponytail: @Observable + actor no sync; TCA só se um dia houver time e time-travel debugging`

### 3.3 Networking — `actor AtlasClient` mapeado do `client.ts`

**Correção factual importante:** o repo **não** tem 12 módulos `lib/api/` — tem **`lib/api/client.ts` (um monolito de ~9.4k linhas, ~284KB)** + `loopClient.ts`. Isso é uma vantagem: é *um contrato escrito* = a spec. Os ~403 DTOs (`export interface`) e ~492 funções de endpoint são codegen-áveis num primeiro passe, com correção manual das bordas.

O engine de request (`lib/api/core.ts`, o `apiRequest<T>`) mapeia 1:1:

```swift
actor AtlasClient {
    func request<T: Decodable>(_ path: String, method: HTTPMethod = .get,
                               body: (any Encodable)? = nil,
                               auth: Bool = true, etag: Bool = false) async throws -> T
}
```

| Mecanismo RN | Equivalente Swift | Dificuldade |
|---|---|---|
| `AbortController` + timeout | `URLSessionConfiguration.timeoutIntervalForRequest` (15s / 120s upload) + cancelamento estruturado | Fácil (mais limpo em Swift) |
| Retry + backoff (3 tentativas, 5xx/rede, só safe+idempotente) | `for attempt in 0..<n { try await Task.sleep }`, reusar o gate `safeMethods \|\| hasIdempotencyKey` | Fácil |
| Dual auth `X-Atlas-Token` + `Bearer`; **401 no path Bearer limpa pareamento** | Dois builders de header; replicar exato o 401→clear ou vira "pareado zumbi" | Fácil (invariante load-bearing) |
| `queryString`: **boolean → `"1"/"0"`**, `limit` clampado 1…200 | `URLComponents` na mão — **Laravel rejeita `"true"`** | Fácil mas gotcha real |
| Envelope de erro (`.message`/`.error.message`/`.errors{}`) | Decodar `AtlasErrorEnvelope` leniente, throw `AtlasApiError` | Fácil |
| ETag/304 LRU cache | **Pular na v1** — existe só pra preservar identidade de referência p/ React Query; `@Observable` diffa por valor. Vira só otimização de banda. | — |

**Os 4 gotchas de Codable que vão morder:**
1. **`Record<string, unknown>` em quase todo DTO** (metadata bags). Swift não tem "any JSON" — escrever **um** `enum JSONValue: Codable` (AnyCodable), tipar metadata como `[String: JSONValue]`. Taxa única, volume alto, testar contra um payload de capture real.
2. **Drift numérico:** campos `Int` que chegam `50.0` (confidence, scores, horas de sono). Codable dá throw. Tipar como `Double?` + decoder leniente pros fuzzy; `Int?` só pra identidade.
3. **Bodies vazios** (204/DELETE): `T` não-opcional falha ao decodar `""`. Tratar `data.isEmpty`.
4. **Data (o correctness core, §3.5).**

`decoder.keyDecodingStrategy = .convertFromSnakeCase` global mata a necessidade de CodingKeys nos ~403 structs.

### 3.4 SSE streaming — Swift é UPGRADE, não paridade (correção)

**Realidade no device (corrigido):** `AtlasAiSheet.tsx` → `streamAiInteraction` (`client.ts`) → `createAtlasAiInteractionStream` usa o `fetch` global **sem `fetchImpl`**. Em RN New Arch, `response.body` é `null`, `getReader` não existe → a execução cai no branch **`await response.text()`**: o app **bufferiza o turno inteiro** e nunca renderiza token-a-token no device. O branch `getReader` nunca roda em produção. Logo:

- A "baseline TTFT" mede time-to-**full**-response, não first-token. Não derivar alvo de TTFT Swift dela.
- Em Swift, `URLSession.bytes(for:)` streama de verdade **pela primeira vez** — é ganho de produto, não "matching baseline".
- O loop de reconnect resumível (`after=lastSequence`) é a **engine de resumabilidade load-bearing** que compensa o fetch não-streaming — **portar como requisito duro**, não descartar como cerimônia.

`URLSession.bytes` torna o parsing mais limpo, mas a resumabilidade continua sendo o coração:

```swift
for try await line in bytes.lines {   // URLSession.bytes(for: req).lines
   // acumula frame em linha vazia → parse event:/data: → dispatch
}
```

Manter o contrato de wire exato: `event: done`/`error`, ignorar `heartbeat`+`timeout`, filtrar por `trace_id`, `sequence` monotônico, loop de reconnect resumível (`after=lastSequence`, até 4 reconnects → `for attempt in 0...4` + `Task.sleep`). `AbortController.abort()` → `Task.cancel()` (nativo).

### 3.5 Persistência — **um arquivo JSON Codable, não SwiftData**

O app já trata estado como blob serializado carregado inteiro e reconciliado funcionalmente (`persist()` escreve `JSON.stringify` do payload inteiro). Um struct `Codable` + `Data.write(options: .atomic)` em `Documents/atlas.store.v1.json` é **byte-compatível** com o blob RN e torna a bridge de export (abaixo) trivial. É MB-scale — confortável em memória.

`// ponytail: SwiftData só se o blob passar da memória ou precisar de query parcial — nada disso é verdade hoje`

**O merge é o correctness core — portar verbatim.** As funções `mergeCaptures/Checkins/Behaviors/…` são **client_id-keyed LWW por `updated_at`, tombstone em `deleted_at`**, com sort determinístico; rodam em todo `set` e no hydrate. **Localização:** funções top-level puras em `lib/atlasStore.ts` no `main`; **extraídas pra `lib/storeConverters.ts` no branch decomposto** (R10) — é justamente o formato limpo que facilita o port. Portar como funções puras sobre arrays, cobertura de teste máxima (reusar os testes existentes como oráculo). Se ficar no monolito `main`, extrair essas funções primeiro em TS (elas já são top-level, então é barato) antes de traduzir.

**Gotcha de data (risco de corrupção silenciosa):** o merge compara `new Date(updated_at).getTime()` (JS, permissivo). `ISO8601DateFormatter` do Swift é **estrito** e por padrão **não** aceita segundos fracionários — se o servidor emite `...T15:41:00.123Z`, o formatter retorna `nil` e o LWW quebra em silêncio (todo compare trata a data como ausente → vencedor errado). **Manter `updated_at` como `String` no struct**, parse tolerante (`.withInternetDateTime.union(.withFractionalSeconds)`, fallback string-compare). Este é o gotcha #1 do port inteiro.

### 3.6 Migração MMKV — **pular** (não é problema)

O blob `atlas.store.v1` dentro do MMKV `atlas.v1` é formato mmap proprietário que o Swift não lê nativamente. Mas quase nunca precisa: **é cache de leitura + outbox.** No primeiro launch Swift, se a fila está drenada, o Swift **refetcha do servidor** (o mesmo `Promise.all` de ~9 endpoints de lista do `sync()`) e reconstrói o cache. Zero migração.

- **Gate do cutover por tela:** `queue.total == 0` pra aquela entidade (surfaced hoje via `localQueueCounts().total`), OU manter a criação/escrita em RN até a vertical estar 100% portada.
- **Se houver fila offline não-vazia** (operador ficou offline numa viagem): bridge de **~20 linhas em RN** copiando `atlas.store.v1` pra `Documents/atlas-export.json`, que o Swift lê uma vez e deleta. Deletável depois da migração. Batendo o `Codable` JSON de §3.5, os formatos casam.
- **`device_id` de `/sync`:** `atlas-app:ios:<installationId>` (`atlasStore.ts` ~L511). Swift não tem `Constants.installationId`. Persistir a string exata do RN uma vez, Swift lê — senão o servidor trata como device novo e reseta o cursor delta (inofensivo mas desperdiça um full re-download).

### 3.7 Fundação do design-system (~3.5 eng-days, construir **primeiro**)

É a dimensão mais fácil e toda tela depende dela. Transcrição mecânica de `design/tokens.ts`.

- **Fontes — o maior gotcha, decidido cedo:** os pacotes `@expo-google-fonts/{fraunces,inter,jetbrains-mono}` shipam **TTFs estáticos pré-instanciados** (72–88KB cada), **não** a variable font. **Copiar os 10 TTFs exatos de `node_modules/@expo-google-fonts/*` pro target Xcode** e listar em `UIAppFonts`. **NÃO** re-baixar Fraunces variable do Google — os eixos `opsz`/`SOFT`/`WONK` renderizam letterforms visivelmente diferentes nos tamanhos display (Masthead 30pt, displayXl 56pt). Verificar os PostScript names reais uma vez com um probe `UIFont.fontNames(forFamilyName:)` e deletar.
- **Tema — struct + Environment, não 40 asset catalogs.** O source RN *é* um struct de hex switchado por nome. **Correção do brief:** o dark default é **slate-teal `#1d2b34`** (não "near-black" — `pureBlack` é reservado pro status bar/Dynamic Island); light é cream `#F4EFE6`. Duas paletas hand-authored (`lightPalette`/`darkPalette`) → uma struct `AtlasPalette` com duas instâncias `static`. `Color` não tem init de hex nativo — extension de 6 linhas fecha o gap. Modo (`auto|light|dark`, persistido em `atlas-theme.mode`) → `@AppStorage` (nativo, sem bridge MMKV pra um enum).
- **Tipografia — factory de `Text`.** Três gotchas: (A) `lineHeight` RN é altura total da linha; `.lineSpacing()` SwiftUI é gap *extra* — aproximar `lineSpacing = lineHeight − size`, e pra display multi-linha exato usar `UIViewRepresentable` com `NSParagraphStyle.min/maxLineHeight`. (B) `letterSpacing` → `.tracking()` (**não** `.kerning`). (C) tamanhos fixos → `.custom(name, fixedSize:)` = paridade RN (opta o app fora de Dynamic Type, igual RN hoje; upgrade acessível é task separada, não contrabandear no port).
- **Hairline (571 usos):** `Divider()` nativo está errado (~0.5–1pt). `Color.frame(height: 1 / displayScale)` via `@Environment(\.displayScale)`. Dot-leader → char-repeat `'· '` com clip (fidelidade) sobre stroke dashed.
- **Motion — quase 1:1 no iOS 17+:** os springs de `tokens.ts` (`{damping, stiffness, mass}`) mapeiam **verbatim** pro init `Spring(mass:stiffness:damping:)`. Haptics `expo-haptics` → `UIImpactFeedbackGenerator`. `atlasSettle` (scale 1.008→1, "no opacity/translateY" — decisão de design, manter).
- **`CartogBackground`** (grid 36px @ 2.5% opacity) → um `Canvas` (mais barato que 52 subviews). `Screen` wrapper: `paddingHorizontal 32` (o rail é load-bearing) + safe area + dock-clearance.
- **Componentes editoriais:** `Masthead`, `SectionHead`, `FolioFooter`, `Dateline`, `TocRow`, `PullQuote` — puros de layout sobre o acima, curtos. Números copiados dos arquivos reais em `components/editorial/*`.

**Tamagui é peso morto — não portar.** `tamagui.config.ts` são 12 linhas do config stock e exatamente 1 arquivo importa de `'tamagui'`. Zero decisão de design. Sai do modelo mental inteiro.

---

## 4. Mapa de native modules

Regra: um módulo fica **RN-owned** até a tela que o usa ir pra nativa; então aquela tela reimplementa contra o framework Apple de primeira-parte. O mapeamento é quase todo 1:1 — o app mal usa capacidade RN-only.

### Tier 0 — sem path nativo limpo (decidir antes)

| Módulo | Realidade | Ação |
|---|---|---|
| **`expo-updates`** (OTA, `lib/mobileOtaUpdates.ts`) | Sem análogo SwiftUI. Hoje o app se auto-cura em campo sem rebuild. | **Deletar a capacidade conscientemente.** TestFlight/`xcodebuild` substitui pra N=1. Não é port, é deleção deliberada. |
| **`expo-notifications`** (`lib/pushNotifications.ts`) | Cliente é trivial (`UNUserNotificationCenter`, delegate de tap-routing `atlas://`, badge). O **trap é o contrato de servidor**: atlas-server hoje empurra pro Expo Push Service (`ExponentPushToken[...]`); Swift registra em **APNs direto** (token hex cru). | **Cross-repo.** O Laravel tem que trocar o sender pra APNs (`.p8`, topic `com.vitor.atlas`). Colocar no board do atlas-server e **coordenar antes** da tela de notificações migrar. Único item fora do controle do time de app. |

### Tier 1 — difícil (path existe, pesado/stateful)

| Módulo | Path nativo | Dificuldade | Notas |
|---|---|---|---|
| **`@kingstinct/react-native-healthkit`** (`lib/healthKit.ts`, **2.618 linhas** — maior superfície nativa) | **HealthKit.framework**: `HKAnchoredObjectQuery`, `HKStatisticsCollectionQuery`, `HKObserverQuery` + `enableBackgroundDelivery` | **Moderada-a-difícil por volume, não por mapping** | 1:1 e limpo. Resetar o anchor uma vez (as strings opacas do RN não reusam) → um backfill full via flag `historyBackfilled`. Background delivery precisa registrar `HKObserverQuery` no `AppDelegate` (o `@main App` init é tarde demais) → manter `UIApplicationDelegateAdaptor`. As ~250 tabelas de type-identifier + math de HR-zone/sleep-dedup são **lógica pura** — traduzir, não redesenhar. |
| **LiveKit** (`@livekit/react-native` + `-webrtc` + `livekit-client`; `VoiceModeSheet.tsx` + `lib/livekitGlobals.ts` + `lib/atlasVoiceRuntime.ts` 798 linhas) | **LiveKit Swift SDK** (o SDK flagship deles é Swift) | **Difícil** (não pelo SDK swap — pela unificação de áudio + porte do cérebro de 800 linhas) | `livekitGlobals.ts` **deleta inteiro** (WebRTC nativo não precisa de shim de global). `atlasVoiceRuntime.ts` (endpointing/interrupção/idempotência) é **TS puro, já testado** (`scripts/mobile-voice-runtime.test.ts`) — portar 1:1 com o teste como oráculo. **Unificar `AVAudioSession`:** hoje `expo-audio` e LiveKit disputam o mic; nativo colapsa numa sessão só (`.playAndRecord`/`.voiceChat`) que você é dono — *simplificação*, mas centralizar as transições ou vem o bug clássico "mic morto depois do turno". |
| **`react-native-mmkv` v4** (+ `react-native-nitro-modules`; `lib/storage.ts`) | Ver §3.6 | **Pular migração** | API é trivial; o Nitro host morre com RN. |

**Knob de calibração de hardware (não transfere 1:1):** o threshold de detecção de fala (`-50 dB` em `mobileVoiceMeteringIsSpeech`) é calibrado contra a escala dB do `expo-audio`; `AVAudioRecorder.averagePower` usa referência diferente (0 dB = full scale). **Recalibrar no device.** `// ponytail: -50dB é expo-calibrado; retunar contra AVAudioRecorder em hardware real, deixar como constante ajustável`

### Tier 2 — moderado (framework limpo, trabalho limitado)

| Módulo | Path | Nota |
|---|---|---|
| `expo-background-task` + `expo-task-manager` (`lib/healthBackgroundTask.ts`) | **BGTaskScheduler** (`BGProcessingTask` — o mode `processing` já está declarado) | Registrar IDs em `BGTaskSchedulerPermittedIdentifiers`. Pareado com `HKObserverQuery` (event-driven é o path primário; BGTask é rede de segurança). |
| `expo-audio` (`app/capture.tsx`, metering 150ms) | **AVFoundation** (`AVAudioRecorder` com `isMeteringEnabled` + `averagePower`) | Ver knob de calibração acima. |
| `expo-secure-store` (`lib/api/core.ts`) | **Keychain Services** | 1:1. **Verificar atributos on-device** (dump do `kSecAttrService`/`kSecAttrAccessible` do RN rodando). Dropar os fallbacks não-nativos. |
| `react-native-reanimated` v4 (81 arquivos, só 7 `'worklet'`) | **SwiftUI animation** (`withAnimation`/`Animatable`/`matchedGeometryEffect`) | 90% declarativo → SwiftUI é *menos* código. Os 7 worklets reais são pan/zoom da cartografia → `DragGesture`/`MagnificationGesture` + `Canvas`. |
| `react-native-svg` (18 arquivos, concentrados em cartografia) | **SwiftUI `Path`/`Shape` + `Canvas`, SF Symbols** | Gráficos procedurais data-driven → `Canvas` é a ferramenta certa. |

### Tier 3 — trivial (framework direto)

`expo-calendar`→EventKit · `expo-location`→CoreLocation (foreground-only) · `expo-image-picker`→PHPicker (sem prompt de permissão, *mais simples*) · `expo-document-picker`→`UIDocumentPicker` · `expo-file-system`→`FileManager`+`URLSession` (upload multipart nativo mais robusto) · `expo-clipboard`→`UIPasteboard` · `expo-haptics`→`UIFeedbackGenerator` · `expo-blur`→`.ultraThinMaterial` · `expo-device`→`#if targetEnvironment(simulator)` · `expo-constants`→`Info.plist` · `expo-linking`→`.onOpenURL` · fontes→bundle `.ttf` · `async-storage`→**deletar** (só alimenta a migração MMKV) · `gesture-handler`/`screens`/`safe-area-context`/`tamagui`/`nitro-modules`→**morrem com RN**, são a coisa sendo substituída.

**Onde Swift é *menos* código:** animação/material SwiftUI, PHPicker, upload multipart `URLSession` em background, `AVAudioSession` unificada. Ganho líquido, não só paridade.

---

## 5. Sequência de telas

25 telas de rota reais (verificado: sem `agents.tsx` no `app/` — a "fleet screen" do branch vive em componente). Dificuldade é dirigida por **superfície nativa e acoplamento ao backbone de overlay**, não por LOC (vários `app/*.tsx` são wrappers de 3 linhas; `cartografia.tsx` = 3 linhas, o peso está em `components/`).

**Root outcome-first (a inversão do Cursor-iOS):** a raiz nativa é a **lista de trabalho + omnibox**, não um launcher de tabs. Isso enquadra o flagship como o centro, não uma tela entre outras.

### Fase 0 — Substrato (não é tela; bloqueia tudo)
`AtlasClient` (engine `client.ts`) + `JSONValue` + fatia de DTOs + Keychain interop + merge/sync verbatim + fundação de design-system (§3.7). **Exit:** app Swift pareia, lê um endpoint, renderiza um componente editorial pixel-fiel; testes de merge/sync verdes contra golden data.

### Fase 1 — Provar o pipeline num LEAF
- **`open-brain.tsx`** (857, REST puro, **0 store, 0 overlay, 0 nativo exótico**) → **primeira tela**. Exercita o API client + design tokens + list render, sem mais nada no caminho.
- Depois `review.tsx` + `ritual.tsx` (editorial store-read) pra travar o padrão de design + store-read.

`// ponytail: sem agents.tsx real no repo — se a fleet screen virar rota, entra aqui como leaf`

### Fase 2 — Par HealthKit (maior payoff nativo — onde Swift *bate* RN)
`sleep.tsx` → `health.tsx`. HealthKit nativo substitui o double-bridge; o compute pesado (`readiness.ts` 2.415, `physiologicalAge.ts` 894, `sleepAnalysis.ts` 475) sai da JS thread. Grande mas **mecânico**. **Harness golden-value:** alimentar amostras HealthKit idênticas, assertar readiness scores **idênticos** contra o output RN. Depois do pipeline provado, não antes.

### Fase 3 — Editorial REST (bulk, estruturalmente simples)
`memory.tsx`, `engineering.tsx`, `projects.tsx`, `bitacula.tsx`, `routines.tsx`, `agenda.tsx` (adiciona EventKit). Tudo list/detail sobre REST. `celestial.tsx` cabe aqui — pequeno canvas SVG/gesture, **aquecimento deliberado** pras técnicas da cartografia. As rotas de suporte `decision.tsx`/`detail.tsx`/`plan-visible.tsx` (backing de overlays/DetailSheet) migram junto com suas donas.

### Fase 4 — Telas acopladas a overlay
`inbox.tsx` (InboxScreen, 8 touchpoints de overlay, swipe triage) + `edicao.tsx` + `capture.tsx`. Forçam re-homing nativo do `OverlayHost` + mecanismo `openAtlasAi`. `capture.tsx` traz audio-record + image-picker + location. Gate: vêm logo antes do flagship porque dependem do web de overlay.

### Fase 5 — O flagship (o produto)
`app/index.tsx` = `<AtlasAiSheet presentationMode="screen"/>` — thin host; a subárvore real é `AtlasAiSheet.tsx` (5.807) + `components/sheets/atlas-ai/` (~9.368 em 39 arquivos) + Voice (519) + Settings (1.660) ≈ **~18k LOC**. **Dual-mode** (renderiza como `/` *e* como overlay), aberto de **13 call-sites** via `openAtlasAi(threadId)`.

**Regras:**
- Migrar **como unidade** — composer + `ThreadHistorySheet` (792) + routing (`AtlasAiRoutingModel`) + attachments (782) + execution sheet (495). Nunca meio-portar.
- **SSE mais fácil em Swift** (§3.4). Attachments → PHPicker/`URLSession` multipart (menos código). Voz pode ficar em RN até a Fase 6 (é vertical separada) OU migrar junto se o áudio já estiver unificado.
- **Ponto de não-retorno:** colapsar o dual-mode numa apresentação nativa; os 13 `openAtlasAi` viram navegação nativa; **flip da identidade do bundle aqui** (`com.vitor.atlas.native` assume `com.vitor.atlas`).
- **Enxerto omnibox-first:** por ser server-backed e não escrever o outbox, o flagship *pode* ser antecipado assim que Fases 1–4 provarem os padrões (list/detail/HealthKit/overlay/SSE). Decisão do operador: valor de produto mais cedo vs. de-risco máximo. Recomendação: entregar Fases 1–2 (prova + HealthKit-ganha), então avaliar antecipar o flagship antes do bulk REST se a vontade de dogfood do omnibox nativo pesar.

### Fase 6 — As duas rochas + deep-links
- **Voz** (`VoiceModeSheet` + `atlasVoiceRuntime` + LiveKit Swift SDK).
- **`cartografia`** (`components/cartografia/`, 8.593 LOC / 32 arquivos, SVG + gesture pan/zoom + reanimated worklets → SwiftUI `Canvas`/Metal). **Endgame.**
- **Manter ambas no app RN o tempo todo** — o operador usa RN pra voz e mapa até essas landarem por último.
- Varrer o trio de deep-link (`mobile-thread.tsx`, `mobile-inbox-item.tsx`, `mobile-pairing.tsx`) oportunisticamente — `mobile-thread` é quase de graça uma vez que o composer é nativo.

**Nunca migrar:** `loop.tsx` (Loop/ACDE = "MVP morto", `atlas:loop:*` hard-deleted per CLAUDE.md) e `rivals.tsx` (de-priorizado no canon). Deletar da rota ou congelar em RN até removidas.

---

## 6. Marcos & milestones

Cada marco = um incremento **shippável e validado lado-a-lado**.

| # | Marco | Definição de pronto (barra de paridade, medida) | Superfície nativa introduzida | Outcome demoável |
|---|---|---|---|---|
| **M0** | Substrato | App Swift pareia, lê um endpoint, renderiza um componente editorial pixel-fiel; testes de merge + sync verdes contra golden data; design foundation completa | URLSession, Keychain, fontes | "O app nativo autentica como o Atlas e desenha um Masthead idêntico" |
| **M1** | Pipeline provado | `open-brain` + `review`/`ritual` renderizam dados idênticos ao RN, lado a lado, batendo baselines FPS/TTI | padrão store-read | "Tela nativa lê o cérebro e as listas rolam a 120fps" |
| **M2** | HealthKit | `sleep` + `health`: readiness/age dentro de **epsilon** (tolerância pequena + **mesmo tier bucket**, NÃO byte-idêntico — `Math.pow/exp` JS vs `Foundation` diferem nos últimos ULPs) vs. harness golden; background delivery headless no device (dias, não simulador) | HealthKit, BGTaskScheduler | "Readiness nativo bate o número do RN e o TTI é menor" |
| **M3** | Editorial REST | `memory`/`engineering`/`projects`/`bitacula`/`routines`/`agenda` em paridade; `celestial` (aquecimento canvas) feito | EventKit, primeiro `Canvas` | "Metade dos 15 domínios navegáveis em nativo" |
| **M4** | Overlay + capture | `inbox`/`edicao`/`capture` nativos; `OverlayHost` + `openAtlasAi` re-homed nativos; regra one-writer vale pra captures | audio-record, PHPicker, CoreLocation | "Capturo por voz/foto no app nativo e sincroniza" |
| **M5** | **Flagship** | Composer + thread history + routing + attachments + SSE em paridade; **host flipado pra SwiftUI**; APNs live no servidor; 13 open-sites nativos | SSE via `URLSession.bytes`, UNUserNotifications/APNs | "Omnibox nativo é a raiz do app — o produto migrou" |
| **M6** | Rochas + aposentar RN | Voz (LiveKit nativo) + cartografia (`Canvas`/gestures) em paridade batendo gates de FPS/latência; trio de deep-link varrido; **app RN aposentado** | LiveKit Swift SDK, gesture canvas | "SwiftUI puro. RN, Expo, Tamagui deletados do build" |

Ponto de não-retorno: **M5** (flip da identidade do bundle). Antes disso, reverter é usar o outro ícone. Manter o último build RN arquivado e TestFlight-instalável até M6 estabilizar; aceitar uma janela onde o RN é retido *só* pra voz+cartografia entre M5 e M6.

---

## 7. Riscos & quem verifica

Restrição a declarar em voz alta: **não há time de QA.** Verificação = operador no device + testes golden automatizados + (um item) o lado atlas-server. Isso molda todo "quem verifica". Como N=1, os gates têm que ser **medidos** (FPS, TTI, latência, valores golden), nunca subjetivos — exceto o dogfood do operador, que *é* um gate de aceitação legítimo pro app pessoal.

| Risco | Prob. | Impacto | Mitigação | Quem verifica |
|---|---|---|---|---|
| **Switch APNs no servidor atrasa** (Expo-Push→APNs é cross-repo; push para em silêncio) | Média | Alto | Landar + testar o sender APNs no atlas-server **antes** do M5; manter app RN (com Expo-Push funcionando) até confirmar | **Lado atlas-server** + operador no device (push de teste, confirmar tap-routing `atlas://`) |
| **Merge/data LWW corrompe em silêncio** (ISO8601 estrito dropa frac. seconds → vencedor errado) | Média | Alto | `updated_at` como String + parse tolerante; golden tests com arrays sobrepostos/tombstoned/fora-de-ordem | Testes automatizados (portar `scripts/*.test.ts`), depois spot-check do operador |
| **HealthKit background delivery instável headless** (`HKObserverQuery` tem que registrar no AppDelegate, não no `@main`) | Média | Médio | Manter `UIApplicationDelegateAdaptor`; verificar wakeups em device real por dias, não simulador | Operador no device (observação multi-dia) |
| **Regressão de sessão de áudio** ("mic morto depois do turno" — colisão de category `AVAudioSession`) | Média | Médio | Centralizar todas as transições de category numa sessão só; portar o `atlasVoiceRuntime` testado verbatim; recalibrar o knob `-50 dB` | Operador no device (turn-taking, interrupção; 20 turnos intercalados com visita ao capture) |
| **Flagship mais difícil que estimado** (~18k LOC, dual-mode, 13 open-sites) | Média | Alto | Migrado *late*, como unidade, sobre substrato provado; não é exercício de aprendizado; flip do host só depois de passar o gate de latência | Operador side-by-side vs. composer RN |
| **cartografia `Canvas` não bate o gate de FPS** | Baixa-Média | Médio | Baseline RN primeiro; aquecer no `celestial` no M3; é última, então falha não bloqueia nada; fallback é manter em RN mais tempo | Gate de FPS medido no device |
| **Drift de DTO Codable** (`JSONValue` everywhere, `Int` chegando `50.0`, bodies 204, query `1/0`) | Média | Baixo-Médio | Um `JSONValue` testado; `Double?` + decode leniente; tratar body vazio; codegen do primeiro passe + fix manual | Teste round-trip automatizado contra payload de capture real |
| **Perder OTA dói mais que esperado** (sem fix instantâneo em campo) | Baixa | Baixo | Aceitar conscientemente; TestFlight/`xcodebuild` pra um operador serve | Operador (aceita o tradeoff) |
| **`/sync device_id` reseta cursor** | Baixa | Baixo (desperdício, não perda) | Persistir a string `atlasDeviceId()` do RN uma vez, Swift lê exata | Automatizado (assertar continuidade do cursor) + operador |
| **Drift de dois-codebases** (contrato do servidor muda no meio; RN e Swift divergem) | Média | Médio | `client.ts` é a spec escrita única; quando o servidor muda, atualizar os dois; regra one-writer limita o raio | Operador (ambos batem o mesmo servidor; uma quebra de contrato aparece nos dois) |

**Postura de verificação transversal:** toda alegação de latência/jank/startup é verificada **no device físico, não simulador**; o **operador (Vitor) é gate de primeira-classe** ("parece certo" é aceitação real pro app pessoal); lógica portada (SSE frame parsing, voice runtime, readiness math, merge) reusa os `scripts/*.test.ts` existentes como oráculos golden.

---

## 8. Independente da decisão — o que começa **agora**

Estas não dependem de nenhuma tela migrar; podem começar em paralelo à baseline (§1) e dão valor imediato ao app RN *hoje* enquanto pavimentam o mundo nativo.

- **Live Activities + Widgets via `@bacons/apple-targets`** (**confirmado: não instalado ainda** — `npm i -D @bacons/apple-targets` + plugin em `app.json`). Este config plugin adiciona um app-extension target nativo (Swift/SwiftUI) **sem ejetar do managed workflow** — é a única forma de shipar SwiftUI de verdade dentro do app Expo atual sem `prebuild`. Casos que já fazem sentido:
  - **Live Activity de sync/readiness:** o loop de `sync()` de 18s e o readiness do dia numa Live Activity/Dynamic Island. Escreve SwiftUI real, lê o mesmo servidor/Keychain — **prova o substrato de §3 num alvo pequeno e descartável antes de apostar numa tela.**
  - **Widgets de home screen:** readiness, próximo item de agenda, contagem de inbox — todos REST puros sobre o `AtlasClient` Swift.
- **App Intents / Siri Shortcuts:** "Atlas, captura isto" → um intent nativo que posta no `127.0.0.1:3737`. Zero UI, valida o path de escrita nativo cedo.
- **Verificação on-device dos atributos de interop** (do enxerto brownfield): dump dos `kSecAttrService`/`kSecAttrAccessible` do expo-secure-store e do `mmapID`/formato do MMKV do app RN rodando. Fazer **agora** — informa se um keychain-access-group compartilhado vale a pena e derisca o M0.
- **Codegen dos DTOs:** gerar o primeiro passe dos ~403 `struct Codable` a partir dos `export interface` de `client.ts`. É mecânico e paralelizável, não bloqueia nada.

**Por que agora:** o widget/Live Activity é o menor alvo SwiftUI possível que toca o substrato inteiro (URLSession + Keychain + Codable + design tokens) num contexto isolado e reversível. Se o substrato de §3 tem uma falha, ela aparece aqui **antes** de qualquer tela de produto depender dele — e o operador ganha um widget de readiness útil no mesmo movimento. `// ponytail: o widget é o teste de integração do substrato que também é feature`

---

**Bottom line:** rebuild nativo paralelo — dois bundles lado a lado no device, cutover por release, RN nunca ejetado e sempre shippável. As partes assustadoras são respectivamente **puláveis** (migração MMKV — cache é descartável, gate em queue-drenada), **mais limpas em Swift** (SSE via `URLSession.bytes`, sessão de áudio unificada, LiveKit/HealthKit nativos) e **mecânicas** (DTOs Codable, engine de sync, merge). As arestas afiadas de verdade são poucas e nomeadas: o **gotcha de data LWW**, o **switch APNs** (único item cross-repo) e **flagship + voz + cartografia** landando por último sobre terreno de-riscado. Construir o substrato primeiro, provar no `open-brain`, começar Live Activities/widgets já, gate de todo cutover em jank/TTI medido, manter o app RN a um toque de distância até M6.

**Arquivos-chave pra quem executa:** `lib/api/client.ts` (a spec de ~9.4k linhas), `lib/atlasStore.ts` + `lib/storeConverters.ts` (store + merge core), `lib/atlasAiStreamRuntime.ts` (SSE), `lib/healthKit.ts` (2.618, o port grande), `lib/atlasVoiceRuntime.ts` + `scripts/mobile-voice-runtime.test.ts` (cérebro de voz + oráculo), `lib/storage.ts` (MMKV `atlas.v1` — o cache que você *não* migra), `lib/pushNotifications.ts` + `lib/mobileOtaUpdates.ts` (o switch APNs cross-repo e a capacidade que se dropa), `design/tokens.ts` + `components/editorial/*` (fundação de design), `app/index.tsx` + `components/sheets/AtlasAiSheet.tsx` + `components/sheets/atlas-ai/` (o flagship, Fase 5), `components/cartografia/` (canvas de 32 arquivos, por último).