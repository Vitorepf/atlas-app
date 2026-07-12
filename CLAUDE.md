# atlas-app — Expo 54 + RN 0.81 (mobile)

Este arquivo cobre só o específico do app mobile. **Governança canônica está em `../CLAUDE.md`** (projeção Atlas) — leia primeiro. Antes de feature nova, rode `php artisan atlas:ai:session-bootstrap --task="..." --json` no atlas-server, como manda a projeção.

## Stack
- **React Native 0.81** + Expo 54 + TypeScript 5.9 (strict)
- **Roteamento**: expo-router 6 — file-based em `app/` (cada `.tsx` é uma rota)
- **UI**: Tamagui 2 (`tamagui.config.ts`)
- **Estado**: Zustand 5 + React Query 5
- **Voz/áudio**: LiveKit (`@livekit/react-native`) + expo-audio
- **Native sensíveis**: HealthKit, Calendar, Location, Notifications, SecureStore, MMKV
- **New Architecture habilitada** (`newArchEnabled: true` em `app.json`) — cuidado com libs incompatíveis
- **Bundle**: `com.vitor.atlas` · scheme `atlas://`

## Comandos canônicos
```bash
npm run dev:ios            # bash scripts/dev-ios.sh lan — USAR ESTE, não `expo start` direto
npm run dev:ios:clear      # com CLEAR=1 (limpa cache Metro)
npm run dev:ios:restart    # mata Metro antes
npm run typecheck          # tsc --noEmit
npm run test:front         # roda baterias: health + atlas-ai + memory + engineering
npm run check:mobile-voice # typecheck + atlas-ai + expo export (validação completa)
npm run build:ios:dev      # EAS build development
npm run build:ios:preview  # EAS build preview
```

## Padrão de testes (atenção: não é Jest)

Testes são arquivos `.test.ts` em `scripts/`, rodados via `tsx` (puro Node, sem RN runtime). Cada bateria roda os arquivos em sequência via `&&`. Padrão:

- Novo teste → criar `scripts/<nome>.test.ts` que faz `assert` no contrato
- Adicionar à bateria certa em `package.json` (`test:atlas-ai`, `test:memory`, `test:engineering`, `test:cartografia`, etc.)
- Para componentes/runtime: testa o **contrato** (shape, snapshot, navegação), não a renderização nativa

## Estrutura

```
app/                    → rotas expo-router (agenda, capture, cartografia, decision,
                          edicao, engineering, health, inbox, memory, projects, review,
                          ritual, rivals, routines, sleep, mobile-thread, …)
components/             → reutilizáveis
design/                 → tokens/temas (ver tamagui.config.ts)
lib/                    → helpers de domínio
scripts/                → .test.ts (testes) + .sh (dev/build) + .mjs (doctor)
docs/                   → specs e documentação local
```

## Diferenças vs blackink-app (outro mobile Expo)

| Eixo | atlas-app | blackink-app |
|---|---|---|
| Roteamento | **expo-router** (file-based) | React Navigation (imperativo) |
| UI lib | **Tamagui** | StyleSheet/RN nativo |
| Testes | **tsx + .test.ts manuais** | Jest + jest-expo |
| Voz | LiveKit | — |

## Regras invioláveis

- **Não usar `expo start` direto** — use `npm run dev:ios` (o script trata env, host, Metro kill, LAN/tunnel).
- **Não mockar Atlas data** — vale a mesma regra do desktop. Atlas-server é fonte canônica.
- **Não criar lib nova sem checar new-arch compat** — `newArchEnabled: true` quebra libs antigas silenciosamente.
- **Não esquecer permissions** — qualquer API native (Health, Mic, Location, Notification) precisa de `infoPlist` em `app.json`.
- **Tokens Tamagui** — não hardcodar cor/spacing; usar `$tokens` do `tamagui.config.ts`.
- **Worklets/Reanimated** — funções com `'worklet'` rodam em thread UI; não chamar JS-only de dentro.
- **Sempre rodar `npm run typecheck`** antes de declarar tarefa pronta.
- **Para feature de voz/mobile** — rodar `npm run check:mobile-voice` (typecheck + tests + export embed real).

## MCPs disponíveis (escopo user)
- **playwright** — útil para web export (`expo start --web`) e specs HTML em `docs/`
- **chrome-devtools** — Core Web Vitals do web build, debug de rede

## Armadilhas conhecidas
- Tamagui babel plugin é obrigatório em `babel.config.js` — sem ele, perf cai 10x.
- `react-native-mmkv` requer dev-client (não funciona em Expo Go).
- `expo-router` reordena `app/` por nome de arquivo — prefixar com `_` para layouts/utilitários.
