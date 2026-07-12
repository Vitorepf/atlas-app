# 01 — Eliminação (código morto, deps, artefatos)

> Parte do plano de refatoração. Índice: [README.md](README.md) · Auditoria origem: [../auditoria-refatoracao-2026-07.md](../auditoria-refatoracao-2026-07.md)

Tudo neste documento é deleção com **zero mudança de comportamento**: cada item foi verificado por ausência real de importadores (refs restantes são comentários "removido vN" ou cadeias mortas internas). Total: **~3.450 linhas + 8 dependências + ~600KB de assets**.

## Regras de execução

1. Deletar em **lotes por seção** (1 commit por seção abaixo), nunca tudo de uma vez.
2. Após cada lote: `npm run typecheck && npm run test:front`. Se o lote tocar atlas-ai: `npm run check:mobile-voice`.
3. Ao deletar um arquivo, remover também: imports mortos que o referenciam em comentário quando triviais, entradas em barrels/index, e o `.test.ts` correspondente se existir.
4. **Pré-condição de branch**: `ComposerPillsRow.tsx`, `ComposerPillsRowModel.ts` e `ComposerProviderSheet.tsx` estão modificados no branch `feat/agent-governance-fleet-screen`. Mergear ou descartar o trabalho do branch **antes** de deletar, senão o delete vira conflito.

---

## Lote A — Componentes mortos (13 arquivos, ~2.061 linhas)

| # | Arquivo | Linhas | Evidência de morte |
|---|---|---|---|
| A1 | `components/console/FieldInline.tsx` | 333 | substituído por `AtlasComposerCard`; refs só em comentário |
| A2 | `components/cartografia/focus/ContinentPeek.tsx` | 296 | zero refs no repo |
| A3 | `components/cartografia/floaters/MiniMap.tsx` | 263 | zero refs no repo |
| A4 | `components/sheets/atlas-ai/ComposerModeSheet.tsx` | 196 | única ref é comentário em AtlasAiSheet |
| A5 | `components/sheets/atlas-ai/ComposerPillsRow.tsx` | 186 | `@deprecated 2026-05-18 → AtlasComposerCard` |
| A6 | `components/sheets/atlas-ai/ComposerProviderSheet.tsx` | 163 | refs só em comentários |
| A7 | `components/inbox/CaptureButton.tsx` | 129 | ref só em comentário de estilo |
| A8 | `components/inbox/FoilStar.tsx` | 45 | único pai era CaptureButton (A7) |
| A9 | `components/inbox/NewCapturesPill.tsx` | 118 | comentários "removido v13" |
| A10 | `components/ProcessingCard.tsx` | 99 | zero refs |
| A11 | `components/SyncBar.tsx` | 92 | "removido v13" |
| A12 | `components/inbox/LiveStatus.tsx` | 87 | "removido v12" |
| A13 | `components/DomainChip.tsx` | 54 | zero refs |

Pós-lote: buscar `ComposerPillsRow` em `AtlasAiDecideStatus.tsx` — o parâmetro `_executor` (linhas 43–51) documenta consumo por um componente morto; remover o parâmetro ou religar (ver bug §6.11 da auditoria).

⚠️ **`ComposerPillsRowModel.ts` NÃO morre com A5** — verificado 2026-07-11: `AtlasAiComposerFooter.tsx:9` importa `labelForMode` dele, e `scripts/composer-pills-row.test.ts` (script `test:composer-pills`) testa as funções puras do model, não o componente. Deletar só o `.tsx`; manter model + teste. (Opcional na fase de consolidação: renomear model+teste para refletir que servem o ComposerFooter.)

## Lote B — Rotas mortas (3 arquivos, ~526 linhas)

| # | Arquivo | Linhas | Evidência |
|---|---|---|---|
| B1 | `app/plan-visible.tsx` | 246 | inspector dev AP-703; zero navegação inbound (só no `.expo/types` gerado) |
| B2 | `app/detail.tsx` | 187 | superseded: detail abre via `useOverlays().openDetail` → DetailSheet; ninguém faz `router.push('/detail')` |
| B3 | `app/decision.tsx` | 93 | tela só de empty-state; o fluxo real roda via estado `'decision'` em `overlays.ts` |

Limpeza acoplada:
- `app/_layout.tsx`: remover os `<Stack.Screen>` de `plan-visible`, `detail`, `decision`.
- Dock (`FOCUSED_ROUTES`): remover `'/detail'` e `'/decision'` do literal.
- B2 mata junto o bug dos botões no-op "editar"/"mover de domínio" (`detail.tsx:131-132`).

## Lote C — Módulos lib/ mortos (6 arquivos, ~330 linhas)

| # | Arquivo | Linhas | Evidência |
|---|---|---|---|
| C1 | `lib/atlasAiModeContract.ts` | 167 | `@deprecated` V1 — **NÃO deletar agora, ver nota** |
| C2 | tripleto patamar4: `lib/atlasAi/patamar4State.ts` + `patamar4StateClient.ts` + `usePatamar4State.ts` | 237 | ✅ verificado 2026-07-11: **zero refs a `patamar4` fora do próprio tripleto** em app/, components/ e lib/. Morto em prod. Deletar os 3 + `scripts/patamar4State.test.ts` |
| C3 | `lib/hooks/useProviderChoice.ts` | 45 | 0 importadores |
| C4 | `lib/atlasAi/placeholders.ts` | 26 | 0 importadores |
| C5 | `lib/inboxModels.ts` | 3 | stub vestigial |
| C6 | `lib/richInput/computeEffort.ts` | 1 | stub vestigial |

⚠️ **C1 fica para a fatia S4 do doc 03** — verificado 2026-07-11: `v1Adapter.ts` **não** importa o contrato V1; o único importador é `scripts/atlas-ai-v1-adapter.test.ts`, que usa o V1 como **golden-reference** para pinar byte-compat do adapter. Enquanto o adapter estiver em produção, esse teste é rede de segurança — contrato V1 + adapter + teste morrem **juntos** na S4 ([03-migracao-atlas-ai.md §4](03-migracao-atlas-ai.md)).

## Lote D — Dependências (8 pacotes)

Remoção imediata (zero imports verificados em app/, components/, lib/, scripts/, configs):

```bash
npm uninstall react-hook-form @hookform/resolvers zod @expo-google-fonts/fraunces react-dom livekit-client
```

| Pacote | Por quê |
|---|---|
| `react-hook-form` | zero `useForm`/`Controller` no repo |
| `@hookform/resolvers` | par do de cima |
| `zod` | zero `z.object`/import no repo |
| `@expo-google-fonts/fraunces` | Fraunces só aparece em comentários |
| `react-dom` | sem `react-native-web` instalado, build web é impossível |
| `livekit-client` | já vem transitivo via `@livekit/react-native` |

Condicionais — **resolver o bug das fontes primeiro** (bug crítico §6.1 da auditoria: `Inter_*`/`JetBrainsMono_*` usadas como string mas nunca carregadas):
- Decisão a tomar: (a) carregar as fontes de verdade com `useFonts()` no `_layout` → manter `@expo-google-fonts/inter` e `@expo-google-fonts/jetbrains-mono`; ou (b) assumir a fonte de sistema que o app já renderiza hoje → deletar os 2 pacotes E as strings `fontFamily` correspondentes.
- A opção (b) é a que não muda nada visualmente (o app nunca carregou essas fontes).

Atualização acoplada: o `CLAUDE.md` do atlas-app lista "Forms: react-hook-form + Zod" como stack — **remover a linha** ao desinstalar.

Não remover (parecem sem uso mas são autolinked/peers): `react-native-screens`, `react-native-nitro-modules`, `react-native-worklets`, `expo-dev-client`, `expo-asset`, `expo-font`.

## Lote E — Scripts e artefatos (~450 linhas + ~600KB)

Testes órfãos (nenhuma bateria do `package.json` os executa — verificado 2026-07-11). Destino decidido por evidência:

| Teste | Destino | Por quê |
|---|---|---|
| `scripts/patamar4State.test.ts` | **deletar** | cobre o tripleto patamar4, morto em prod (Lote C2) |
| `scripts/youtube-prewarm.test.ts` | **registrar** em `test:atlas-ai` | fluxo VIVO: `useYoutubePrewarm` usado em `AtlasAiComposerFooter:31` + TurnBody/TurnModel/DecideModel |
| `scripts/youtube-summary.test.ts` | **registrar** em `test:atlas-ai` | idem — fluxo youtube vivo no composer/turns |
| `scripts/ob05-open-brain-injection.test.ts` | **registrar** em `test:atlas-ai` | pina o shape da open_brain policy — pré-requisito da migração ([03 §6](03-migracao-atlas-ai.md)) |

Artefatos raiz (mockups/proofs de obras passadas, nada referencia):
- `atlas-composer-mockup.html`, `atlas-composer-implementation-state.html`, `atlas-home-editorial-mockup.html`, `historico-variantes-mockup.html`
- `atlas-d-clean-proof.png`, `atlas-d-screenshot-proof.png`

Config:
- `package.json`: remover script `"web"` (`expo start --web` falha sem react-native-web).
- Deduplicar plugin `expo-notifications` (declarado em `app.json` E re-anexado em `app.config.js:52`) — manter só no `app.config.js`, que é quem manda por último.

## Ordem e verificação

```
Lote D (deps imediatas) → Lote A → Lote B → Lote C → Lote E
```

Deps primeiro porque falham rápido e alto no typecheck se algo escondido as usava. Após cada lote:

```bash
npm run typecheck && npm run test:front
```

E ao final da eliminação inteira, um build de sanidade:

```bash
npm run check:mobile-voice   # typecheck + atlas-ai tests + expo export real
```
