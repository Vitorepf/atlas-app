/**
 * Cartografia · viewport math · pure functions.
 *
 * Portadas do desktop (`atlas-desktop/apps/desktop/src/surfaces/cartografia/
 * viewport/viewportMath.ts`). Sem DOM, sem Reanimated, sem efeito — só
 * geometria. Worklet-safe (todas as funções podem ser chamadas dentro de
 * `'worklet'`).
 *
 * Convenções:
 *   - x/y  → translação do `.world` no viewport (pixels, screen-space).
 *   - scale → fator de zoom (1.0 = world em tamanho canon).
 *   - focalX/focalY → ponto-âncora pra zoom focal (pinch).
 *   - Sistema world-coord não é manipulado aqui — atoms vivem em coords
 *     fixos no .world, e o transform global anima a translação+escala.
 */

export function clampScale(scale: number, min: number, max: number): number {
  'worklet'
  return Math.max(min, Math.min(max, scale))
}

export interface TranslateBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

/**
 * Calcula os bounds de translação permissivos · user pode explorar
 * livremente sem perder o canvas no espaço.
 *
 * Regra: o canvas pode quase sumir do viewport (overscroll generoso de
 * `OVERSCROLL` pixels) mas no mínimo 1 pixel sempre permanece visível
 * pra que o user nunca fique sem referência visual. Em caso extremo,
 * o botão FIT sempre recupera.
 *
 * Casos:
 *   - canvas escalado > viewport (zoom-in): bounds amplos com overscroll.
 *   - canvas escalado ≤ viewport (zoom-out): bounds amplos · canvas pode
 *     mover bem fora do centro pra que user explore "espaço vazio" como
 *     em Figma/Miro.
 */
const OVERSCROLL = 280

export function computeTranslateBounds(
  scale: number,
  viewportW: number,
  viewportH: number,
  worldW: number,
  worldH: number,
): TranslateBounds {
  'worklet'
  const ww = worldW * scale
  const wh = worldH * scale

  // X: permite overscroll em ambas as direções. Limite extremo: pelo
  // menos 1 pixel do canvas dentro do viewport.
  // - translateX (visual top-left) min: viewportW - ww - OVERSCROLL
  //   (canvas todo passou pra esquerda + overscroll)
  // - translateX max: OVERSCROLL (canvas todo passou pra direita + overscroll)
  const minX = viewportW - ww - OVERSCROLL
  const maxX = OVERSCROLL

  const minY = viewportH - wh - OVERSCROLL
  const maxY = OVERSCROLL

  return { minX, maxX, minY, maxY }
}

export function clampTranslate(
  x: number,
  y: number,
  bounds: TranslateBounds,
): { x: number; y: number } {
  'worklet'
  return {
    x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
    y: Math.max(bounds.minY, Math.min(bounds.maxY, y)),
  }
}

export interface ViewportTransform {
  scale: number
  x: number
  y: number
}

export interface FitInput {
  viewportW: number
  viewportH: number
  worldW: number
  worldH: number
  padding: number
}

/**
 * Calcula a posição visual top-left do world pra ele ficar centralizado
 * no viewport. Retorna `{ scale, x, y }` onde **(x, y) é a posição
 * visual top-left** (onde o canto superior-esquerdo visualmente
 * aparecerá na tela).
 *
 * A compensação pra `transformOrigin: center` (default RN) é feita NO
 * momento de aplicar o transform (useCartografiaViewport) — aqui só
 * lidamos com coords visuais limpas.
 */
export function fitWorld({
  viewportW,
  viewportH,
  worldW,
  worldH,
  padding,
}: FitInput): ViewportTransform {
  'worklet'
  if (viewportW <= 0 || viewportH <= 0) return { scale: 1, x: 0, y: 0 }
  const availW = Math.max(1, viewportW - padding * 2)
  const availH = Math.max(1, viewportH - padding * 2)
  const scale = Math.min(availW / worldW, availH / worldH)
  return {
    scale,
    x: (viewportW - worldW * scale) / 2,
    y: (viewportH - worldH * scale) / 2,
  }
}

export interface ZoomFocalInput {
  scale: number
  x: number
  y: number
  factor: number
  focalX: number
  focalY: number
  min: number
  max: number
}

/**
 * Zoom focal · mantém o ponto (focalX, focalY) na mesma posição da tela
 * após o zoom. Math canon de qualquer canvas pan/zoom (Figma, Miro).
 *
 *   newScale = clamp(scale * factor)
 *   ratio    = newScale / scale
 *   newX     = focalX - (focalX - x) * ratio
 *   newY     = focalY - (focalY - y) * ratio
 */
export function zoomAroundPoint({
  scale,
  x,
  y,
  factor,
  focalX,
  focalY,
  min,
  max,
}: ZoomFocalInput): ViewportTransform {
  'worklet'
  const newScale = clampScale(scale * factor, min, max)
  if (newScale === scale) return { scale, x, y }
  const ratio = newScale / scale
  return {
    scale: newScale,
    x: focalX - (focalX - x) * ratio,
    y: focalY - (focalY - y) * ratio,
  }
}

export interface FocusOnRectInput {
  rect: { x: number; y: number; w: number; h: number } // world-space
  viewportW: number
  viewportH: number
  targetScale: number
  min: number
  max: number
}

/**
 * Centraliza viewport num retângulo world-space numa escala alvo.
 * Usado pra entrar em modo Foco (zoom em peça) e subflow drill-in.
 */
export function focusOnRect({
  rect,
  viewportW,
  viewportH,
  targetScale,
  min,
  max,
}: FocusOnRectInput): ViewportTransform {
  'worklet'
  const scale = clampScale(targetScale, min, max)
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  return {
    scale,
    x: viewportW / 2 - cx * scale,
    y: viewportH / 2 - cy * scale,
  }
}
