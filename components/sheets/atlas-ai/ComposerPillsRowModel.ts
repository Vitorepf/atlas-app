/**
 * Slice 3c · pure logic do ComposerPillsRow (testável sem RN runtime).
 *
 * Separa funções puras (estimateComposerTokens, labelForMode, labelForProvider)
 * do componente React Native pra permitir testes via `tsx` no Node sem precisar
 * de RN bundle.
 */
import type {
  ComposerFileAttachment,
  ComposerImageAttachment,
} from './attachmentTypes'
import {
  IMAGE_TOKEN_COST,
  PDF_MIN_TOKEN_COST,
  TEXT_CHARS_PER_TOKEN,
} from '../../../lib/richInput/metrics'

// Re-export os symbols canon que callers internos esperam pelo nome legado.
// Fonte da verdade vive em `@atlas/rich-input-canon` · não definir literais
// aqui pra não drift do canon mobile/desktop.
export { IMAGE_TOKEN_COST, TEXT_CHARS_PER_TOKEN }
export const FILE_TOKEN_COST_FALLBACK = PDF_MIN_TOKEN_COST

/**
 * Token estimator mobile · adaptação simplificada do canon
 * `estimateRichInputTokens` para os tipos ComposerImageAttachment +
 * ComposerFileAttachment (vs AttachmentDraft do canon que usa shape mais rico).
 *
 * Fórmula:
 *   - text trim > 0: max(1, text.length / 4)
 *   - imagem: +1200 fixos (overhead vision canon)
 *   - file: +600 fallback (PDF sem text extraction · valor conservador)
 *
 * Match desktop em 1ª ordem; refinamentos (PDF page count, text/code length)
 * vêm em slice futura quando mobile suportar AttachmentDraft canon completo.
 */
export function estimateComposerTokens(
  text: string,
  imageAttachments: ComposerImageAttachment[],
  fileAttachments: ComposerFileAttachment[],
): number {
  let tokens = text.trim() === '' ? 0 : Math.max(1, Math.round(text.length / TEXT_CHARS_PER_TOKEN))
  tokens += imageAttachments.length * IMAGE_TOKEN_COST
  tokens += fileAttachments.length * FILE_TOKEN_COST_FALLBACK
  return tokens
}

/**
 * Mode → label legível pt-BR · espelha labels canon do desktop MODE_OPTIONS
 * sem importar o array completo (acoplamento leve).
 */
export function labelForMode(mode: string): string {
  const labels: Record<string, string> = {
    auto: 'auto',
    general: 'geral',
    conversation: 'conversa',
    operational: 'operacional',
    programming: 'programação',
    research: 'pesquisa',
    finance: 'finanças',
    marketing: 'marketing',
    strategy: 'estratégia',
    personal_development: 'pessoal',
    cyber: 'cyber',
    automation: 'automação',
  }
  return labels[mode] ?? mode
}

/**
 * Provider → label · primeira palavra lowercase canon desktop.
 */
export function labelForProvider(provider: string): string {
  if (provider === 'auto') return 'auto'
  if (provider === 'claude_cli') return 'claude'
  if (provider === 'codex_cli') return 'codex'
  if (provider === 'gemini_cli') return 'gemini'
  if (provider === 'claude_codex') return 'conselho'
  return provider
}
