# 04 — Lições do Cursor iOS (referência de produto)

> Parte do plano de refatoração. Índice: [README.md](README.md) · Aplicação: pós-obra, junto das fatias S6/S8 do [03-migracao-atlas-ai.md](03-migracao-atlas-ai.md).

Análise das telas do app iOS do Cursor (Workspaces + lista de sessões por repo, 2026-07). Quase tudo aqui é decisão de **produto/design**, não de stack — aplicável ao atlas-app em RN hoje, sem esperar decisão Swift.

## As 6 lições

### 1. A unidade é a tarefa com resultado, não a conversa
Cada linha da lista é uma sessão de agente resumida pelo **desfecho**: `+149 -15`, `Merged`, `No Changes`. Zero preview de mensagem, zero bolha de chat. Num app de agentes, a lista responde "o que aconteceu", não "o que foi dito".

**Aplicação Atlas:** o `ThreadHistorySheet` lista threads como conversas; deveria listar como **obras com evidência**. O atlas-server já tem Evidence Ledger e Decision Receipts — o mobile só não projeta o desfecho na linha. Campo natural: métrica de resultado do trace (arquivos tocados, jobs concluídos, receipt) no lugar de metadata de conversa.

### 2. Semáforo de atenção em 1 pixel
Ponto azul (precisa de você) vs cinza (não precisa) é o único indicador de estado por linha. Sem badges, sem contadores, sem cores de status espalhadas.

**Aplicação Atlas:** reduzir o metadado por linha do thread history a: título + 1 linha de desfecho + 1 ponto de atenção. Todo o resto vai para o detalhe.

### 3. Agrupamento temporal como estrutura principal
Today / Yesterday / This Week como seções da tela.

**Aplicação Atlas:** **já existe** — `threadHistoryModel.ts` tem `threadGroupKey: 'today'|'yesterday'|'thisWeek'|'older'` implementado e testado. A diferença é o Cursor promover isso a tela principal; no Atlas está enterrado num sheet. Custo de adoção: zero lógica nova.

### 4. Omnibox única e permanente
"Plan, ask, build…" fixo no rodapé de **todas** as telas — um único ponto de entrada em linguagem natural, com mic. Em vez de N botões por tela, uma caixa que aceita qualquer intenção.

**Aplicação Atlas:** é a tese canônica do Atlas ("linguagem humana natural como interface") executada com disciplina. O composer do AtlasAiSheet já tem a capacidade (texto, voz, attachments, routing); a diferença é ele viver dentro de um sheet em vez de ser o chão do app. Pós-S8, o `AtlasAiComposerFooter` extraído pode ancorar o shell raiz.

### 5. Navegação workspace-first
Workspaces → repo → sessões. Duas camadas, acabou.

**Aplicação Atlas:** workspace profiles já existem no contrato (`AtlasAiMobileWorkspaceModel`, `listAtlasWorkspaceProfiles`). O dado existe; a hierarquia de navegação é que não o usa como raiz.

### 6. Restrição visual radical
Fundo quase preto, fonte de sistema, divisória fina de 1px, sem cards/sombras/ícones decorativos. A sensação "nativa polida" vem de **remover**, não da linguagem — reforça a decisão do plano de que polish é disciplina de design, não reescrita Swift.

## Síntese: inverter a hierarquia do app

Hoje o atlas-app é "telas de domínio com IA num sheet". O modelo Cursor é:

```
raiz    = lista de trabalho com desfecho (agrupada por tempo) + omnibox permanente
detalhe = a sessão/obra específica
resto   = telas de domínio acessadas sob demanda
```

Isso conversa diretamente com as fatias S6/S8 do doc 03: quando o AtlasAiSheet virar shell (~700 linhas) com composer e thread history extraídos, promover **thread history + omnibox a tela raiz** fica barato — os três blocos necessários (agrupamento temporal, composer completo, workspace model) já existem como módulos independentes.

## O que NÃO copiar

- **Não virar clone**: o Cursor é single-purpose (código). O Atlas cobre 15 domínios — a raiz outcome-first precisa acomodar obras de qualquer domínio (health, projects, engineering), não só diffs. O desfecho por linha é do domínio da obra (receipt, snapshot, merge), não sempre `+N -M`.
- **Não antecipar**: nada disso entra antes da obra de refatoração — mexer na hierarquia de navegação com o AtlasAiSheet ainda monolítico dobraria o risco das fatias S1-S5.
