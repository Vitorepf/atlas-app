/**
 * Cartografia · world layout canon.
 *
 * World dimensions espelham o desktop (1880×1820) — o mesmo mundo, sem
 * shrink pra mobile. Em portrait 393×852, fit() inicial cai em ~0.21,
 * ativando zoom-far (só nomes). Zoom é o drilldown.
 *
 * Universe positions: layout cartográfico curado · Atlas no centro,
 * Memória oeste-norte, Obras nordeste, Forge sudeste, Filosofia sul,
 * Gargalos sudoeste. Cada continente é um atom retangular com peso
 * editorial proporcional à contagem de peças (count canon do mockup).
 *
 * Counts vêm de atlas-server/docs/atlas-vault-cartografia.md §8.1.
 * Quando o backend de cartografia entrar, esses counts serão substituídos
 * por `graph.audit.count_by_source` real.
 */

// Mundo amplo · 2800×2600 dá espaço editorial generoso pra exploração
// (canon Figma/Miro: sensação de "universo aberto"). Boot fit cai em
// ~0.14 em viewport portrait, ainda permitindo zoom-out leve via
// minDynamicScale = fit*0.85.
export const WORLD_WIDTH = 2800
export const WORLD_HEIGHT = 2600

export const VIEWPORT_PADDING = 32

export interface ContinentLayout {
  id: string
  name: string
  deck: string
  count: number
  x: number
  y: number
  w: number
  h: number
}

export const UNIVERSE_CONTINENTS: ReadonlyArray<ContinentLayout> = [
  {
    id: 'atlas',
    name: 'Atlas',
    deck: 'kernel pipeline · 17 etapas · 6 lanes',
    count: 41,
    x: 1100,
    y: 1020,
    w: 600,
    h: 560,
  },
  {
    id: 'memory',
    name: 'Memória',
    deck: 'segundo cérebro · livros · filosofia',
    count: 26,
    x: 200,
    y: 260,
    w: 500,
    h: 400,
  },
  {
    id: 'works',
    name: 'Obras',
    deck: 'projetos em construção',
    count: 18,
    x: 2100,
    y: 260,
    w: 500,
    h: 380,
  },
  {
    id: 'forge',
    name: 'Forge',
    deck: 'SDD · gates · evidência',
    count: 15,
    x: 2100,
    y: 1840,
    w: 500,
    h: 380,
  },
  {
    id: 'philosophy',
    name: 'Filosofia',
    deck: 'princípios · modelos mentais · estética',
    count: 22,
    x: 1100,
    y: 2080,
    w: 600,
    h: 380,
  },
  {
    id: 'risks',
    name: 'Gargalos',
    deck: 'bloqueios em aberto',
    count: 7,
    x: 200,
    y: 1900,
    w: 500,
    h: 340,
  },
]

/** LOD thresholds · zoom progressivo · calibrados pro mundo 2800×2600.
 * Boot fit cai em ~0.14, user precisa pinch out pra revelar detalhe. */
export const LOD_FAR_MAX = 0.42
export const LOD_MID_MAX = 0.95

export type LodLevel = 'far' | 'mid' | 'close'

export function lodForScale(scale: number): LodLevel {
  if (scale < LOD_FAR_MAX) return 'far'
  if (scale < LOD_MID_MAX) return 'mid'
  return 'close'
}

/** Scale bounds canon (espelham mockup AtlasVault §10.4 · ajustados pro
 * mundo expandido). Max ampliado pra permitir zoom-in profundo nos atoms. */
export const MIN_SCALE = 0.12
export const MAX_SCALE = 3.2
