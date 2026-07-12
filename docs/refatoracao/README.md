# Plano de Refatoração — atlas-app

Documentação completa da obra de eliminação, refatoração e migração do app mobile. Origem: [auditoria completa de 2026-07-11](../auditoria-refatoracao-2026-07.md) (4 varreduras paralelas + 3 mapeamentos profundos).

## Documentos

| Doc | Escopo | Risco | Estimativa |
|---|---|---|---|
| [01-eliminacao.md](01-eliminacao.md) | Código morto (~3.450 linhas), 8 deps, artefatos — lotes A-E com evidência por arquivo | zero | 1 dia |
| [02-refatoracao.md](02-refatoracao.md) | Consolidação de duplicação (~600 linhas) + splits mapeados linha a linha de `client.ts` (9.401L), `atlasStore.ts` (3.474L), SettingsSheet, DetailSheet | baixo-médio | ~1 semana |
| [03-migracao-atlas-ai.md](03-migracao-atlas-ai.md) | **Núcleo do plano.** Migração do AtlasAiSheet (5.808L → shell de ~700L) em 8 fatias, morte do contrato V1, as 5 acoplagens duras, rede de testes | médio-alto | 1-2 semanas |
| [04-licoes-cursor-ios.md](04-licoes-cursor-ios.md) | Referência de produto (Cursor iOS): 6 lições + inversão da hierarquia do app (raiz outcome-first + omnibox). Aplicação pós-S8 | — | pós-obra |
| [05-runbook-execucao.md](05-runbook-execucao.md) | **Documento operacional/tracker.** Todos os itens atômicos (E/F/S/R/M/P) com comandos exatos, verificação, aceite e checkbox. Qualquer IA executa só seguindo os cards | — | — |

**Para executar a obra: comece pelo [05-runbook-execucao.md](05-runbook-execucao.md).** Os docs 01-03 são a análise de suporte; o runbook é autossuficiente para execução mecânica.

## Ordem de execução

```
01 (eliminação)
  → bugs críticos da auditoria (§6.1-6.4: fontes, secret, IP, ATS)
    → 02 Parte A (consolidação)
      → 02 Parte B core.ts + atlasAi.ts   ← pré-requisito do 03
        → 03 fatias S0→S8 (atlas-ai)      ← 02 Parte C (store slices) pode rodar em paralelo
          → 02 Parte B resto + D1/D2 (cauda)
```

## Invariantes de toda a obra

- 1 lote/fatia por PR; `npm run typecheck && npm run test:front` verde em cada; `npm run check:mobile-voice` em tudo que toca atlas-ai/voz.
- Nenhuma mudança de comportamento sem teste que a pine antes.
- Shapes persistidos (MMKV `atlas.store.v1`, `atlas-ai.routing`, etc.) não mudam — zero migração de dados.
- Antes de fatias que dependem do backend (03 §4): `php artisan atlas:ai:session-bootstrap --task="..." --json` no atlas-server.
- Decisão Swift (reescrita nativa) só **depois** da obra, com performance medida — ver auditoria §Fase 4.
