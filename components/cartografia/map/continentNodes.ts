/**
 * Cartografia · nodes canônicos por continente (não-Atlas).
 *
 * Atlas tem pipeline próprio em `atlasFlowData.ts`. Outros continentes
 * (Memória, Obras, Forge, Filosofia, Gargalos) têm nodes orgânicos —
 * livros, projetos, princípios, gargalos. Layout canon: radial · um
 * glifo central representa o continente, nodes orbitam em raio fixo.
 *
 * Cada node tem ficha 7 campos canon quando o backend
 * `/atlas-cartography/graph` entrar. Por enquanto: nome + deck curto.
 *
 * Counts batem com `UNIVERSE_CONTINENTS` em `layout.ts` (peças visíveis
 * ≤ count canon).
 */

/** Categoria visual do node · controla glifo SVG mini no orbit */
export type NodeKind =
  | 'book'      // códice (livros, manuscritos)
  | 'pillar'    // coluna (princípios, modelos)
  | 'spark'     // ✦ centelha (ideia, story)
  | 'gear'      // engrenagem (projetos, obras)
  | 'gates'     // 3 gates (SDD, quality)
  | 'risk'      // X (gargalos)
  | 'tag'       // etiqueta (canon, identidade)

export interface ContinentNode {
  id: string
  name: string
  deck: string
  /** graph_id real quando este node aponta para documento canônico */
  graphId?: string
  /** Categoria visual · default 'tag' */
  kind?: NodeKind
  /** opcional · marca node de risco/gargalo · pinta rec-red */
  risk?: boolean
}

export interface ContinentScene {
  continentId: string
  centerLabel: string
  /** ângulo inicial em radianos (0 = direita) */
  startAngle: number
  /** raio em world-units · controlled per scene pra acomodar contagens diferentes */
  radius: number
  nodes: ReadonlyArray<ContinentNode>
}

export const CONTINENT_SCENES: ReadonlyArray<ContinentScene> = [
  {
    continentId: 'memory',
    centerLabel: 'memory',
    startAngle: -Math.PI / 2,
    radius: 580,
    nodes: [
      { id: 'mem-cartas',     name: 'Cartas a Lucílio',  deck: 'Sêneca · 124 cartas', kind: 'book' },
      { id: 'mem-meditacoes', name: 'Meditações',        deck: 'Marco Aurélio',       kind: 'book' },
      { id: 'mem-padrinho',   name: 'O Padrinho',        deck: 'Mario Puzo',          kind: 'book' },
      { id: 'mem-xogum',      name: 'Xógum',             deck: 'James Clavell',       kind: 'book' },
      { id: 'mem-estoicismo', name: 'Estoicismo',        deck: 'corpus filosófico',   kind: 'pillar' },
      { id: 'mem-lindy',      name: 'Lindy',             deck: 'tempo · resiliência', kind: 'pillar' },
      { id: 'mem-corleone',   name: 'Vito Corleone',     deck: 'autoridade calma',    kind: 'spark' },
      { id: 'mem-principios', name: 'Princípios',        deck: 'destilados em ação',  kind: 'pillar' },
    ],
  },
  {
    continentId: 'works',
    centerLabel: 'works',
    startAngle: -Math.PI / 2,
    radius: 540,
    nodes: [
      { id: 'work-atlas',     name: 'Atlas App',     deck: 'mobile · desktop · server', kind: 'gear' },
      { id: 'work-obraos',    name: 'ObraOS',        deck: 'operacionar obras',         kind: 'gear' },
      { id: 'work-foundry',   name: 'Foundry',       deck: 'forge embeddings',          kind: 'gear' },
      { id: 'work-sovereign', name: 'Sovereign OS',  deck: 'orquestração soberana',     kind: 'gear' },
      {
        id: 'work-vox',
        graphId: 'atlas-vox-operational-thinking-interface',
        name: 'Atlas Vox',
        deck: 'programa de voz · intenção · ação governada',
        kind: 'spark',
      },
      {
        id: 'work-voice-realtime',
        graphId: 'atlas-ai-voice-realtime-surface',
        name: 'Voice Realtime',
        deck: 'superfície técnica · áudio · LiveKit',
        kind: 'gear',
      },
      { id: 'work-cyber',     name: 'Cyber Plane',   deck: 'red · blue · purple',       kind: 'gates' },
    ],
  },
  {
    continentId: 'forge',
    centerLabel: 'forge',
    startAngle: -Math.PI / 2,
    radius: 540,
    nodes: [
      { id: 'forge-sdd',      name: 'SDD Core',         deck: 'spec-driven',         kind: 'gates' },
      { id: 'forge-exec',     name: 'Execution Workspace', deck: 'workspace por obra', kind: 'gear' },
      { id: 'forge-gates',    name: 'Quality Gates',    deck: 'filtros canon',       kind: 'gates' },
      { id: 'forge-splitter', name: 'Work Splitter',    deck: 'partir o trabalho',   kind: 'gear' },
      { id: 'forge-rivals',   name: 'Forge Rivals',     deck: 'arena multi-arm',     kind: 'spark' },
    ],
  },
  {
    continentId: 'philosophy',
    centerLabel: 'philosophy',
    startAngle: -Math.PI / 2,
    radius: 540,
    nodes: [
      { id: 'phi-principios', name: 'Princípios',     deck: 'norte de operação',   kind: 'pillar' },
      { id: 'phi-modelos',    name: 'Modelos mentais', deck: 'lenses cognitivas',  kind: 'pillar' },
      { id: 'phi-estetica',   name: 'Estética',        deck: 'DNA visual atlas',   kind: 'tag' },
      { id: 'phi-identidade', name: 'Identidade',      deck: 'quem é o Atlas',     kind: 'tag' },
      { id: 'phi-tdah',       name: 'TDAH design',     deck: 'peso decrescente',   kind: 'spark' },
    ],
  },
  {
    continentId: 'risks',
    centerLabel: 'risks',
    startAngle: -Math.PI / 2,
    radius: 480,
    nodes: [
      { id: 'risk-vqa',     name: 'Visual QA manual',    deck: 'aberto', kind: 'risk', risk: true },
      { id: 'risk-sandbox', name: 'Sandbox não-uniforme', deck: 'aberto', kind: 'risk', risk: true },
      { id: 'risk-pruning', name: 'Pruning do Ledger',   deck: 'aberto', kind: 'risk', risk: true },
      { id: 'risk-policy',  name: 'Policies sem versão', deck: 'aberto', kind: 'risk', risk: true },
    ],
  },
]

export function findContinentScene(continentId: string): ContinentScene | null {
  return CONTINENT_SCENES.find((s) => s.continentId === continentId) ?? null
}

/** Calcula coords radiais world-space pra um node */
export function radialAnchor(
  centerX: number,
  centerY: number,
  radius: number,
  index: number,
  total: number,
  startAngle: number,
): { x: number; y: number; angle: number } {
  const angle = startAngle + (index / total) * Math.PI * 2
  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
    angle,
  }
}
