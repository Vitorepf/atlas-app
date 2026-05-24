# BRIEFING — Polimento Enterprise da Tela `edicao` (Atlas Mobile)

Você é Claude trabalhando em `/Users/vitorepf/develop/Atlas/atlas-app`. Você **não tem contexto prévio**. Este briefing é a fonte única de verdade. Leia inteiro antes de tocar em código.

---

## 1 · MISSÃO

Elevar `app/edicao.tsx` (a tela home/edição diária do Atlas Mobile · 2170 linhas) a um nível de polimento **extraordinário** — **igual ou superior** ao gold standard interno (`components/sheets/atlas-ai/AtlasComposerCard.tsx`). A barra externa: Cursor, Linear, Stripe Press, Apple Design Resources, Field.io, Sagmeister, Pentagram.

Trabalhe **apenas em tema dark** (default e único alvo de uso real do usuário). Light pode permanecer funcional mas você **não** vai investir nele.

A entrega não é "refatorar" nem "reescrever". É **calibrar**, **subir camadas de profundidade**, **eliminar pequenos vícios SaaS** e **dar ao usuário uma tela que ele encara 100x/dia sem cansar**.

---

## 2 · CONTEXTO MÍNIMO DO PROJETO

- **App**: Atlas Mobile — Expo 54 + React Native 0.81 + TypeScript strict
- **Roteamento**: expo-router 6 (file-based em `app/`)
- **UI**: Tamagui 2 + componentes próprios em `components/`
- **Estado**: Zustand 5 + React Query 5
- **Animação**: Reanimated 4 com `worklet` (já tem `useReducedMotion` guard padrão)
- **New Architecture**: habilitada (`newArchEnabled: true` em `app.json`)
- **Tema**: dark é default desde 2026-05-23
- **CLAUDE.md principais**:
  - `/Users/vitorepf/develop/Atlas/CLAUDE.md` (projeção governance — **NÃO EDITAR**)
  - `/Users/vitorepf/develop/Atlas/atlas-app/CLAUDE.md` (app)

**Governance Atlas**: docs canônicos em `docs/engineering-knowledge-base/`. **NÃO inventar arquivos** — sempre verificar antes.

---

## 3 · ARQUIVOS QUE VOCÊ VAI TOCAR

### Alvo principal
- `app/edicao.tsx` (2170 linhas · `HomeScreen`)

### Reference de qualidade (leitura obrigatória, **NÃO copiar cego**)
- `components/sheets/atlas-ai/AtlasComposerCard.tsx` — o composer-padrão
- `components/sheets/atlas-ai/ComposerPillsRow.tsx`
- `components/sheets/atlas-ai/AtlasAiComposerFooter.tsx`

### Tokens, fontes, tipografia (consultar, possivelmente estender)
- `design/tokens.ts` — palette dark, space, radii, fonts, ease, dur, spring, type
- `design/theme.tsx` — `usePalette()`, `useTheme()`
- `design/Type.tsx` — `<Frau>`, `<Sans>`, `<Mono>`, `<Label>`
- `design/fonts.ts` — Fraunces + Inter + JetBrainsMono carregados

### Componentes editoriais já existentes (REUSAR)
- `components/editorial/Masthead.tsx`
- `components/editorial/EditorialDateline.tsx`
- `components/editorial/SectionHead.tsx`
- `components/editorial/TocRow.tsx`
- `components/editorial/EditorialPullQuote.tsx`
- `components/editorial/FolioFooter.tsx`
- `components/Screen.tsx`
- `components/AtlasShell.tsx`

### Visuais auxiliares (estudar para inspiração de motion/peso)
- `atlas-composer-mockup.html`, `atlas-composer-implementation-state.html`, `atlas-home-editorial-mockup.html`, `historico-variantes-mockup.html`

---

## 4 · O QUE TORNA O COMPOSER GOLD STANDARD (DNA a internalizar)

Quando ler `AtlasComposerCard.tsx`, identifique e replique conceitualmente:

1. **Material iOS nativo**: `<BlurView intensity={56} tint="systemChromeMaterialDark" experimentalBlurMethod="dimezisBlurView" />` sob o card, com slate tint `${c.surface}D9` por cima. No Android, fallback gracioso para `surface` opaco. Premium frosted glass canon.
2. **Embossed manuscript**: `cardInnerHighlight` (1px cream alpha 0.06 no topo) + shadow `{offsetY:2, opacity:0.18, radius:10}`. Sensação Don Corleone signet ring carving on cream paper.
3. **Border animada cream → atlas gold** no focus (`interpolateColor` com `rgba(233,238,242,0.10)` → `${c.bronze}8C` em 320ms `Easing.out(Easing.cubic)`).
4. **Cross-fade mic ↔ send** no mesmo slot 36×36 absoluto. Zero layout jump.
5. **Send breath**: `withRepeat(withSequence(withTiming(1.04, 1100ms), withTiming(1, 1100ms)))` quando `canSubmit`. Cancelado em `reducedMotion`.
6. **Processing pulse**: opacity `0.55 ↔ 0.90` quando `disabled && !recording` — "Atlas pensando" sem virar spinner SaaS. Estático `0.7` em `reducedMotion`.
7. **Placeholder overlay absoluto** Frau italic 20 sobre TextInput Inter sans 16 — fade smooth 280ms ao digitar. Sem swap de fonte/jump.
8. **Cursor + selection em atlas gold** (`selectionColor`, `cursorColor` = `c.bronze`).
9. **Icons Lucide-style stroke 1.7-1.8px** SVG inline (`react-native-svg`), `strokeLinecap="round"`, `fill="none"`. NUNCA biblioteca de ícones genérica.
10. **Press spring iOS-grade**: scale 0.95 (icon) ou 0.96 (pill) com `withSpring({damping:14, stiffness:240, mass:0.7})`. Press-in via `withTiming(120ms)` rápido, release via spring suave.
11. **Haptics em cada interação**: `Haptics.impactAsync(Soft|Light|Medium)` — sempre `.catch(() => {})`.
12. **`useReducedMotion()` guard** em qualquer loop infinito ou animação > 500ms.
13. **`accessibilityLabel` + `accessibilityHint`** descritivos em português, com semântica (não "botão", "campo").
14. **Pill canon**: borderRadius 999, paddingHorizontal 11 paddingVertical 6, gold dot 5.5×5.5 + Frau italic 13.
15. **Comentários inline em português editorial** explicando o **porquê** das micro-decisões ("· canon manuscript · não é botão, é gesto de selar").

---

## 5 · CANON DO ATLAS MOBILE (não-negociável)

### Paleta (dark · `design/tokens.ts`)
```
bg          #1d2b34  canvas slate teal warm (paper-of-night)
bgRecessed  #15212a  sunken
bgRaised    #2d4351  raised (popover/modal)
bgDeep      #0f181f  selection
bgFresh     #243743  capturas <30s
surface     #243743  card surface canon
premium     #2d4351

ink         #d6dde2  body primary
ink2        #95a3ac  muted
ink3        #677482  caption
border      #313f47  hairline 10%
borderSoft  #27353e  hairline 5%

prussian    #7fa7c4  info (commitment)
bronze      #d4a85a  ATLAS GOLD CANON · 1-2 acentos por view
bronzeDeep  #a8853f
bronzeLight #e6b966
moss        #82b577  success
amber       #e0ad5e  warning
recRed      #d05a52  recording / danger
```

### Tipografia (3 famílias, sem exceção)
- **Fraunces** (serif) → `<Frau>`. Italic é a voz editorial principal. `med` italic para destaque.
- **Inter** (sans) → `<Sans>`. `reg/med/sb/bd`. Utility, body funcional.
- **JetBrains Mono** (mono) → `<Mono>`. Dados, timestamps, caps-leaders, dot separators.

**Type scale canônico** em `tokens.ts` (`type.displayLg`, `type.fraunces17`, `type.body14`, `type.mono11` etc). Use-os — não chute tamanhos.

### Spacing
4pt baseline: `space.xxs=2, xs=4, sm=8, md=12, lg=16, xl=22, xxl=28, xxxl=36`. Trilhos internos editoriais: `marginLeft:32 / marginRight:32` (já estabelecido em `estadoInline`, `whisper`, `missionEditorial`).

### Radii
`chip:20, card:12, bigCard:14, modal:20, sheet:22, pill:999`. **Composer usa 22** — esse é o radius "card premium". Os papéis editoriais menores podem usar 4 (manuscript page).

### Motion tokens
- `ease.editorial [0.22, 1, 0.36, 1]` default tween
- `ease.ceremonial [0.16, 1, 0.3, 1]` sheets, page load (composer usa este)
- `ease.iOSSmooth [0.32, 0.72, 0, 1]` layout shifts
- `dur.instinct 180 · considered 320 · ceremonial 480 · sacred 620`
- `spring.gestural / sheet / toast / overdamped` — bounce máx **0.25**, acima é Duolingo

### Hairlines
Sempre `StyleSheet.hairlineWidth`. Borders 1px inteiros são tells de Material/Tailwind.

### Regras de "não fazer" (Atlas DNA · TDAH + 12h sessions)
- **Sem em-dash inicial prefix** ("— ação"). Em-dash em Atlas = atribuição de citação.
- **Sem ✓ / ↗ / setas Unicode** decorativas. SaaS vibe. Italic editorial + ponto final imperativo cumpre o papel.
- **Sem "Nenhuma X encontrada"**. Empty state = imperativo seco em Frau italic 17 ("Definir missão.", "Capturar primeira tarefa.").
- **Sem mockar dados**. Estado honesto > placeholder fake. Atlas-server é fonte canônica.
- **Sem cor hardcoded** fora dos tokens `c.*`.
- **Sem `borderLeftWidth: 4`** colored stripe (Material/Tailwind tell).
- **Sem cards com `shadow: 0 8px 32px`**. Atlas é manuscript, não Material.
- **Sem cor warm cream** (`#F4EFE6` family). Cream warm é EXCLUSIVO da Cartografia desktop. Mobile sempre slate.
- **Sem botões com `backgroundColor: c.ink`** salvo confirmação ritualística (estilo "Salvar tarefa" do form atual — pode ficar, mas elevar).
- **Sem `Alert.alert()`** para confirmação — usar overlays canon do Atlas.

---

## 6 · DIAGNÓSTICO PRELIMINAR (use como hipótese, valide visualmente)

A `edicao.tsx` já tem muito do canon certo (CodexPressable, drop caps em agenda, TocRow editorial, Masthead, pull quote, hairlines). As **áreas fracas mais prováveis**, em ordem de impacto:

### 6.1 · Task editor (linhas ~1054-1153) — **MAIOR GAP**
Aberto ao tocar uma tarefa da agenda. Atualmente: `TextInput` plain com `borderRadius:12`, `borderWidth: StyleSheet.hairlineWidth`, `paddingHorizontal:12`. **Cheira a formulário SaaS** dentro de uma página manuscript. Não tem BlurView, não tem animação de entrada elegante, não tem placeholder hero, botões de save são `backgroundColor: c.ink/c.prussian` flat.

### 6.2 · Block editor (linhas ~1156-1202)
Mesmo problema. "Bloquear horário" expansível com inputs lado-a-lado e botão "Salvar" prussian flat.

### 6.3 · MiniAction (linhas 1484-1509)
"Planejar hoje", "Planejar semana", "Marcar plano" — pills com `borderRadius: 16`, hairline border, Sans sb 11.5 prussian. Funcional mas sem alma. Pode receber tratamento de pill canon do composer (gold dot + Frau italic).

### 6.4 · Agenda panel container (`agendaPanel`)
`borderRadius:4 + hairline border`. Coerente com canon manuscript page, mas **pode ganhar um pouco da profundidade do composer** — talvez inner highlight 1px no topo, shadow muito sutil, ou estar dentro de uma surface raised. Decida com base no que melhor compõe.

### 6.5 · Drop cap das tarefas
Já está bom. Pode ter ainda mais peso visual com weight `med` Fraunces (já é) + talvez um shadow letra-papel mínimo. Validar visualmente.

### 6.6 · Transições entre estados de check-in
`<CheckinPill>` e `<LevelPill>` já têm interpolateColor de cor de texto. Funciona. Mas **não há nenhuma transição de container** entre Estado→Energia→Humor (FadeIn duration 420 é o que carrega). Pode ganhar um layout transition mais editorial (LinearTransition já está em `estadoInline`, validar se respira).

### 6.7 · `saveCheckin` "registrar."
Já é um dos pontos altos da tela (hairline prussian sela commitment). Não toque salvo se tiver melhoria clara.

**Você pode discordar deste diagnóstico após ver a tela ao vivo** — é hipótese. A primeira fase é entender.

---

## 7 · FERRAMENTAS DISPONÍVEIS

### MCPs (escopo user, prontos)
- **playwright** — para ver web build (`expo start --web` se aplicável) e estudar HTMLs em `atlas-composer-mockup.html` etc.
- **chrome-devtools** — para Core Web Vitals e debug de rede se subir web.

### Skills
- **`huashu-design`** — **use intensivamente** para gerar variações visuais em HTML hi-fi do `edicao` redesenhado antes de tocar no RN. Permite explorar 3-5 direções de polimento em paralelo. Pode exportar MP4/GIF de animations.
- **`/verify`** — para validar a feature funcionando após implementação.
- **`/run`** — para subir o app.
- **`/code-review --effort high`** — auto-review antes de entregar.

### Comandos do projeto
```bash
npm run dev:ios            # canônico · usa scripts/dev-ios.sh (NÃO `expo start`)
npm run dev:ios:restart    # mata Metro antes
npm run typecheck          # tsc --noEmit
npm run check:mobile-voice # typecheck + atlas-ai tests + expo export embed
```

**Não há jest/vitest neste projeto.** Testes são `.test.ts` em `scripts/`, rodados via `tsx`. Veja `package.json` para baterias (`test:atlas-ai`, `test:cartografia`, etc).

### Subagents recomendados
- `Explore` — para mapear referências cruzadas antes de mexer
- `Plan` — para arquitetar a abordagem antes de implementar

---

## 8 · FASES DE TRABALHO

### FASE 1 · ENTENDIMENTO (não toque em código)
1. Leia `AtlasComposerCard.tsx` inteiro. Note cada decisão de motion/color/typography.
2. Leia `app/edicao.tsx` inteiro (2170 linhas). Identifique TODOS os sub-componentes (CheckinPill, LevelPill, TaskChip, MiniAction, CodexPressable, ConstelacaoWhisper) e padrões já estabelecidos.
3. Leia `design/tokens.ts`, `design/Type.tsx`, `design/theme.tsx`. Internalize palette dark + type scale + motion tokens.
4. Leia `atlas-composer-mockup.html` e `atlas-home-editorial-mockup.html`. Compare a tela atual ao que o mockup prometeu.
5. **Suba o app**: `npm run dev:ios` (ou `npm run dev:ios:restart`). Acesse a home/edição. Tire screenshots de:
   - Estado vazio (sem check-in, sem missão, sem tarefas)
   - Check-in em progresso (Estado → Energia → Humor)
   - Check-in registrado (compact)
   - Agenda com 1 tarefa
   - Agenda expandida (3 tarefas + mini actions)
   - Task editor aberto
   - Block editor aberto
6. **Compare lado-a-lado** com um screenshot do composer. Liste 10-15 gaps específicos de polimento.

Saída desta fase: documento markdown com diagnóstico, screenshots embedados, lista priorizada.

### FASE 2 · EXPLORAÇÃO VISUAL (huashu-design)
Para cada gap importante, gere 2-3 variações em HTML hi-fi via `huashu-design`. Foque em:
- Task editor reimaginado como sheet manuscript (não form)
- MiniAction como pill canon do composer
- Agenda panel com profundidade BlurView
- Microinteractions: como o task editor entra e sai? Como o check-in transita de cada step?

Apresente ao usuário 3 direções consolidadas. **Espere aprovação antes da fase 3.**

### FASE 3 · IMPLEMENTAÇÃO
- Trabalhe **incremental**: uma área de cada vez. Não reescreva a tela inteira.
- Cada mudança: typecheck verde antes de prosseguir.
- Cada componente extraído (se necessário) vai em `components/edition/` (criar) ou `components/editorial/` (se for reuso editorial).
- **Reusar antes de criar**: se um componente editorial já existe (`TocRow`, `SectionHead`, etc), use.
- **Reusar antes de copiar do composer**: extraia helpers do composer (`PressableIconScale`, `PressablePillScale`) para `components/atlas-ui/` se vai reusar — não duplicar.
- Mantenha **comentários inline em português editorial** explicando o porquê de cada decisão visual ("· canon manuscript · não é botão, é gesto").
- Atenção a **`useReducedMotion()`** em qualquer animação infinita.
- Haptics em todo gesto que merece feedback tátil.

### FASE 4 · VALIDAÇÃO
1. `npm run typecheck` — deve passar limpo.
2. Subir app, navegar pela tela inteira em **dark mode**.
3. Tirar screenshots dos mesmos estados da Fase 1, **lado-a-lado com o "antes"**.
4. Rodar `/code-review --effort high` no diff.
5. Verificar que nenhum teste em `scripts/` quebrou (rodar baterias relevantes — provavelmente `test:atlas-ai` é suficiente; veja `package.json`).
6. **Não criar testes novos** se a mudança é puramente visual — testes deste projeto são de contrato.

### FASE 5 · DELIVERY
Entregar:
1. **Diff completo** (use `git diff` ou explicite os arquivos editados).
2. **Comparativo visual antes/depois** — uma linha por estado, com screenshot e legenda.
3. **Justificativa de cada decisão**: por que essa cor, esse easing, esse spacing.
4. **Lista do que NÃO foi mexido e por quê** (escolhas conscientes de restraint).
5. **Próximos passos sugeridos** (gaps que ficaram para uma segunda iteração — Atlas é elegante, sabe quando parar).

---

## 9 · BARRA DE QUALIDADE — DEFINITION OF DONE

Cada mudança que você fizer precisa passar nestes filtros:

- [ ] **Tema dark testado ao vivo no iPhone (ou simulador iOS).** Não basta typecheck — você precisa ter VISTO.
- [ ] **Material/depth**: se é card, tem BlurView iOS + inner highlight + shadow sutil ou justificativa explícita do porquê não.
- [ ] **Motion**: nenhuma transição é abrupta. Defaults: 280-380ms `Easing.out(Easing.cubic)` ou `ease.ceremonial`.
- [ ] **Press feedback**: scale + opacity, NUNCA só opacity. Spring no release, timing rápido no press-in.
- [ ] **Reduced motion**: qualquer loop infinito tem guard.
- [ ] **Haptics**: gestos commit/cancel/select têm haptic.
- [ ] **A11y**: `accessibilityLabel` semântico em português.
- [ ] **Sem layout jump**: cross-fade, não swap. Placeholder absoluto, não substitute.
- [ ] **Token discipline**: zero cor/spacing hardcoded.
- [ ] **Vocabulário editorial preservado**: Frau italic dominante, Sans funcional, Mono caps para data/dot-leader. Drop caps onde fizer sentido.
- [ ] **Restraint**: você removeu pelo menos uma coisa por cada coisa que adicionou. Premium = menos ornamento, não mais.
- [ ] **Comparado a Cursor/Linear/Stripe Press/Field.io**: você não tem vergonha de mostrar.

---

## 10 · O QUE EVITAR (anti-padrões específicos)

- ❌ Adicionar lib nova de UI (Reanimated 4 + Tamagui + react-native-svg já bastam).
- ❌ Substituir `<Frau>/<Sans>/<Mono>` por `<Text>` cru — sempre passe pelos primitivos tipográficos.
- ❌ Adicionar emoji decorativo em UI (✦, ✓, etc). Atlas já decidiu não usar.
- ❌ Adicionar gradients de fundo dramáticos. Atlas é manuscript editorial, não Spotify.
- ❌ Sombras coloridas (`shadowColor: c.bronze`). Apenas `#000` com opacity baixa.
- ❌ Bordas grossas (>1px). Sempre hairline.
- ❌ Border radius de 16/20/24 onde já existe canon (4 para papel, 22 para card premium, 999 para pill, 12 para card médio).
- ❌ Animações > 500ms sem motivo cerimonial.
- ❌ Spring bounce > 0.25.
- ❌ `Pressable` com só `opacity: pressed ? 0.5 : 1` — use a `PressableIconScale` / `PressablePillScale` (extraia do composer).
- ❌ Toast/banner novo — use o `useShell().showToast` existente.
- ❌ Tocar em `app/_layout.tsx`, `design/theme.tsx`, ou qualquer coisa do bootstrap do app sem motivo cirúrgico claro.
- ❌ Mexer no `Atlas/CLAUDE.md` (é projeção gerada — `atlas memory projection --target=claude --write`).
- ❌ Criar dependência de `expo-blur` se já não estiver instalada (está — `expo-blur ~15.0.8`).
- ❌ Inventar testes em jest/vitest — este projeto usa `tsx + .test.ts`.

---

## 11 · POSTURA E TOM

Trabalhe como um designer-engenheiro que recém-saiu da Field.io e foi para a Apple Design. Você não está "fazendo um app react native bonito". Você está **gravando uma assinatura tipográfica em slate burnished que o usuário vai abrir mil vezes**.

- Pense em **gestos**, não em buttons.
- Pense em **respiração da página**, não em padding values.
- Pense em **commitment ritual**, não em form submission.
- Pense em **TDAH-friendly** (baixo ruído visual, peso decrescente, sem cascata de notificação).
- Pense em **sessões de 12 horas** (legibilidade > ornamento, italic Cormorant em body cansa — mas Fraunces aqui foi escolhida exatamente porque NÃO cansa).

Quando tiver dúvida, pergunte: **"O Don Corleone usaria isso no signet ring dele?"** Se não, refaça.

---

## 12 · CRITÉRIO DE PARADA

Você termina quando:
1. Todos os estados visuais da Fase 1 foram polidos OU intencionalmente preservados com justificativa.
2. Antes/depois lado-a-lado prova que o standard foi alcançado.
3. Typecheck verde, baterias de teste verdes.
4. `/code-review --effort high` voltou sem findings de bug.
5. Você consegue olhar para a tela e dizer em voz alta: **"isso passa por Linear, Cursor e Stripe sem pestanejar."**

Se em qualquer momento sentir que está adicionando ornamento por adicionar, **PARE** e remova. Premium = restraint.

---

**Boa execução. Comece pela Fase 1 agora.**
