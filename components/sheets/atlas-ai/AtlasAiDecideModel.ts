import { isYouTubeUrl } from '../../../lib/richInput/youtube'

export type DecideDestino = 'captura' | 'conversa'

export interface AtlasAiDraftDecision {
  destino: DecideDestino | null
  confidence: number
  reasons: string[]
}

const CAPTURE_CONFIDENCE_THRESHOLD = 0.74

const CONVERSATION_PATTERNS: Array<[RegExp, string, number]> = [
  [/\?\s*$/u, 'pergunta direta', 0.55],
  [/^(como|por\s+qu[êe]|quando|onde|qual|quais|quem|o\s+qu[êe])\b/iu, 'pronome interrogativo', 0.5],
  [/\b(faz\s+sentido|para\s+voc[êe]|pra\s+voc[êe])\b/iu, 'pedido de validação', 0.62],
  [/\b(me\s+ajud\w*|me\s+explica|me\s+explique|me\s+conta|me\s+fala|vamos\s+pensar|quero\s+conversar|preciso\s+conversar)\b/iu, 'pedido explícito ao Atlas', 0.7],
  [/\b(estou|t[oô]|me\s+sinto|sinto\s+que|acho\s+que|tenho\s+pensado|estava\s+pensando|quero\s+entender|preciso\s+entender|preciso\s+pensar|pensar\s+sobre|organizar\s+minh\w+)\b/iu, 'frase reflexiva/pessoal', 0.62],
  [/^(implement|criar?|fazer|desenh|escrev|refator|consert|adicion|remov|atualiz|ajust|configur|publi)\b/iu, 'pedido de execução', 0.5],
]

const CAPTURE_PATTERNS: Array<[RegExp, string, number]> = [
  [/^(ideia|nota|lembrar|lembrete|todo|comprar|pagar|ligar|enviar|marcar|agendar|anotar|registro)\b/iu, 'prefixo de anotação', 0.34],
  [/^[-*•]\s+\S/u, 'item de lista', 0.22],
  [/\b\d{1,2}[:h]\d{0,2}\b/u, 'horário ou dado objetivo', 0.12],
  [/\b(kg|km|mg|ml|reais|r\$|%|min|hora|horas)\b/iu, 'medida ou valor', 0.1],
]

export function decideInitialAtlasDestination(text: string): AtlasAiDraftDecision {
  const trimmed = normalizeInput(text)
  if (!trimmed) {
    return { destino: null, confidence: 0, reasons: ['vazio'] }
  }

  if (isYouTubeUrl(trimmed)) {
    return { destino: 'conversa', confidence: 0.96, reasons: ['video do YouTube'] }
  }

  const wordCount = countWords(trimmed)
  const lineCount = trimmed.split(/\n+/u).filter((line) => line.trim().length > 0).length
  let captureScore = 0
  let conversationScore = 0
  const reasons: string[] = []

  if (wordCount <= 7 && lineCount === 1) {
    captureScore += 0.34
    reasons.push('curto')
  } else if (wordCount <= 14 && lineCount <= 2) {
    captureScore += 0.2
    reasons.push('anotação breve')
  } else {
    conversationScore += 0.24
    reasons.push('texto longo')
  }

  if (!/[?.!]\s*$/u.test(trimmed) && wordCount <= 12) {
    captureScore += 0.16
    reasons.push('sem pontuação conversacional')
  }

  for (const [pattern, reason, weight] of CAPTURE_PATTERNS) {
    if (pattern.test(trimmed)) {
      captureScore += weight
      reasons.push(reason)
    }
  }

  for (const [pattern, reason, weight] of CONVERSATION_PATTERNS) {
    if (pattern.test(trimmed)) {
      conversationScore += weight
      reasons.push(reason)
    }
  }

  if (lineCount >= 3) {
    conversationScore += 0.24
    reasons.push('múltiplas linhas')
  }

  if (wordCount <= 3 && !hasConversationSignal(trimmed)) {
    captureScore += 0.18
    reasons.push('fragmento curto')
  }

  const captureConfidence = clamp(captureScore - conversationScore + 0.38, 0, 1)
  if (captureConfidence >= CAPTURE_CONFIDENCE_THRESHOLD) {
    return { destino: 'captura', confidence: captureConfidence, reasons }
  }

  return {
    destino: 'conversa',
    confidence: clamp(1 - captureConfidence, 0, 1),
    reasons: reasons.length > 0 ? reasons : ['fallback conservador'],
  }
}

export function classifyDecideDestino(text: string): DecideDestino | null {
  return decideInitialAtlasDestination(text).destino
}

export function shouldClassifyAtlasAiDraft({
  currentThreadId,
  pending,
  traceCount,
}: {
  currentThreadId: string | null
  pending: boolean
  traceCount: number
}): boolean {
  return currentThreadId == null && !pending && traceCount === 0
}

function normalizeInput(text: string): string {
  return text.trim().replace(/[ \t]+/gu, ' ')
}

function countWords(text: string): number {
  return text.split(/\s+/u).filter(Boolean).length
}

function hasConversationSignal(text: string): boolean {
  return CONVERSATION_PATTERNS.some(([pattern]) => pattern.test(text))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
