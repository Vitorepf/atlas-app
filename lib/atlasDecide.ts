// Atlas Decide · LLM classifier wrapper para pré-popular DomainSheet
// (Categorizar + Elaborar) com domain + destino sugeridos.
//
// Pipeline:
//   1. Captura criada (texto ou áudio transcrito)
//   2. App dispara prefetchAtlasDecide(captureId) em paralelo (não bloqueia)
//   3. Server-side: clarifyCapture invoca LLM, retorna AtlasCapture com
//      metadata.classification (quando disponível)
//   4. DomainSheet abre e consulta getAtlasDecide(captureId) — pega o
//      result em cache (ou null se ainda não terminou) e pré-popula
//   5. User confirma ou troca via "trocar"
//
// Princípio: NÃO bloqueante. Se classifier demorar/falhar, sheet abre
// com defaults genéricos (domain Atlas, destino Salvar). Atlas Decide é
// "assistente, não autoridade".

import { clarifyCapture, type AtlasCapture } from './api/client'
import type { DomainKey } from './domains'
import type { DomainDestino } from './overlays'

export interface AtlasDecideResult {
  /** Domínio inferido. Default 'atlas' se não detectável. */
  domain: DomainKey
  /** Destino editorial inferido. */
  destino: DomainDestino
  /** Confiança 0-1 do classifier (0 = heurística pura). */
  confidence: number
  /** Capture com metadata enriquecida (pra outros consumidores). */
  capture: AtlasCapture | null
}

const cache = new Map<string, AtlasDecideResult>()
const inFlight = new Map<string, Promise<AtlasDecideResult>>()

// ============================================================================
// HEURÍSTICAS · fallback quando server não retorna classification
// ============================================================================

function inferDomainFromText(text: string | null | undefined): DomainKey {
  if (!text) return 'atlas'
  const lower = text.toLowerCase()
  // Sinais de saúde: corpo, sono, treino, médico, exame
  if (/\b(saúde|corpo|sono|treino|médic|exame|hrv|peso|dieta|alimentaç)/i.test(lower)) {
    return 'saude'
  }
  // Sinais de finanças: dinheiro, conta, despesa, investir
  if (/\b(dinheiro|conta|despes|invest|financ|imposto|fatur|orçament)/i.test(lower)) {
    return 'financas'
  }
  // Sinais de blackink: escrita, ensaio, capítulo, conteúdo
  if (/\b(escrita|ensaio|capítul|conteúd|texto|artigo|publicaç|blog)/i.test(lower)) {
    return 'blackink'
  }
  return 'atlas'
}

function inferDestinoFromText(text: string | null | undefined): DomainDestino {
  if (!text) return 'salvar'
  const len = text.trim().length
  // Heurística simplista por comprimento + presença de "?" ou "como"
  if (/\?|como\b|por que\b|por quê\b/i.test(text)) {
    return 'conversar'
  }
  if (len < 80) return 'salvar'
  if (len < 240) return 'tarefa'
  return 'projeto'
}

// ============================================================================
// EXTRACTION · ler classification do metadata da captura quando server populou
// ============================================================================

function extractFromCapture(capture: AtlasCapture): AtlasDecideResult {
  const metadata = (capture.metadata ?? {}) as Record<string, unknown>
  const classification = (metadata.classification ?? metadata.atlas_decide ?? null) as
    | { domain?: string; destino?: string; intent?: string; confidence?: number }
    | null

  // Domain · prefere capture.domain (já existe no schema), senão classification, senão heurística.
  let domain: DomainKey = capture.domain ?? 'atlas'
  if (classification?.domain && isDomainKey(classification.domain)) {
    domain = classification.domain
  }

  // Destino · classification > intent inference > heurística
  let destino: DomainDestino = 'salvar'
  if (classification?.destino && isDestino(classification.destino)) {
    destino = classification.destino
  } else if (classification?.intent) {
    destino = mapIntentToDestino(classification.intent)
  } else {
    destino = inferDestinoFromText(capture.content_text)
  }

  return {
    domain,
    destino,
    confidence: classification?.confidence ?? 0,
    capture,
  }
}

function isDomainKey(value: string): value is DomainKey {
  return ['blackink', 'atlas', 'saude', 'financas', 'outro'].includes(value)
}

function isDestino(value: string): value is DomainDestino {
  return ['conversar', 'tarefa', 'projeto', 'salvar'].includes(value)
}

function mapIntentToDestino(intent: string): DomainDestino {
  const lower = intent.toLowerCase()
  if (lower.includes('conversa') || lower.includes('chat')) return 'conversar'
  if (lower.includes('projet')) return 'projeto'
  if (lower.includes('tarefa') || lower.includes('task')) return 'tarefa'
  return 'salvar'
}

// ============================================================================
// API PÚBLICA
// ============================================================================

/**
 * Dispara o classifier não-bloqueante. Pode ser chamado várias vezes pro
 * mesmo captureId — coalesce automaticamente. Retorna a Promise pra quem
 * quiser aguardar (mas DomainSheet não aguarda; usa getAtlasDecide).
 */
export function prefetchAtlasDecide(captureId: string): Promise<AtlasDecideResult> {
  if (cache.has(captureId)) {
    return Promise.resolve(cache.get(captureId)!)
  }
  const existing = inFlight.get(captureId)
  if (existing) return existing

  const promise = (async () => {
    try {
      const response = await clarifyCapture(captureId)
      const result = extractFromCapture(response.capture)
      cache.set(captureId, result)
      return result
    } catch {
      // Falha silente · retorna result heurístico baseado em null capture.
      const fallback: AtlasDecideResult = {
        domain: 'atlas',
        destino: 'salvar',
        confidence: 0,
        capture: null,
      }
      cache.set(captureId, fallback)
      return fallback
    } finally {
      inFlight.delete(captureId)
    }
  })()

  inFlight.set(captureId, promise)
  return promise
}

/**
 * Síncrono · retorna result em cache (já populado por prefetch). null se ainda
 * não chegou. DomainSheet usa isso pra pre-populate ao montar.
 */
export function getAtlasDecide(captureId: string): AtlasDecideResult | null {
  return cache.get(captureId) ?? null
}

/**
 * Heurística pura · usado quando não há captureId (não foi chamado prefetch).
 * Inputs locais, retorno imediato.
 */
export function inferAtlasDecide(input: { text?: string | null; domain?: DomainKey | null }): AtlasDecideResult {
  return {
    domain: input.domain ?? inferDomainFromText(input.text),
    destino: inferDestinoFromText(input.text),
    confidence: 0,
    capture: null,
  }
}

/**
 * Limpa cache · usar após resolver triage (capture já foi categorizada,
 * cache obsoleto).
 */
export function clearAtlasDecide(captureId: string): void {
  cache.delete(captureId)
  inFlight.delete(captureId)
}
