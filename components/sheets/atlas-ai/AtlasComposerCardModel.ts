/**
 * Atlas Composer Card · pure logic model (testável sem RN runtime).
 *
 * Extrai decisões stateful do AtlasComposerCard component pra funções puras
 * testáveis via tsx. Clean architecture canon · UI fica fina, lógica vive em
 * model auditável.
 */

export interface CardStateInput {
  /** Texto atual no input. */
  value: string
  /** True quando interação travada (envio em andamento, etc). */
  disabled: boolean
  /** True durante gravação ativa. */
  recording: boolean
  /** Permite submit mesmo sem texto (ex: tem anexos pendentes). */
  canSubmitWithoutText: boolean
  /** True quando TextInput tem foco. */
  isFocused: boolean
}

export interface CardStateDerived {
  /** True se há texto não-trivial no input. */
  hasText: boolean
  /** True se o composer pode enviar agora (texto OR canSubmitWithoutText, sem bloqueios). */
  canSubmit: boolean
  /** True quando ✦ cursor signature deve renderizar (focused + empty + ativo). */
  showCursor: boolean
  /** True quando o action row direito mostra SEND (substitui mic). */
  showSendInRightSlot: boolean
  /** True quando o action row direito mostra MIC (estado idle/recording). */
  showMicInRightSlot: boolean
}

/**
 * Deriva o estado completo da UI do card a partir do input.
 *
 * Regras canon:
 *   - hasText = text.trim().length > 0
 *   - canSubmit = (hasText OR canSubmitWithoutText) AND NOT disabled AND NOT recording
 *   - showCursor = isFocused AND NOT hasText AND NOT disabled (pulse só quando vazio + ativo)
 *   - showSend = canSubmit (com texto OR anexos prontos)
 *   - showMic = NOT showSend (sempre alternativos)
 */
export function deriveCardState(input: CardStateInput): CardStateDerived {
  const hasText = input.value.trim().length > 0
  const canSubmit =
    (hasText || input.canSubmitWithoutText) && !input.disabled && !input.recording
  const showCursor = input.isFocused && !hasText && !input.disabled
  const showSendInRightSlot = canSubmit
  const showMicInRightSlot = !showSendInRightSlot

  return {
    hasText,
    canSubmit,
    showCursor,
    showSendInRightSlot,
    showMicInRightSlot,
  }
}

/**
 * Resolve placeholder visual props · qual fontFamily/fontSize/lineHeight
 * o TextInput deve usar baseado em hasText.
 *
 * Empty → Frau italic 20px (manuscript hero)
 * Typed → Inter sans 16px (operational utility)
 */
export interface PlaceholderTypography {
  fontFamilyKey: 'serifItalic' | 'sans'
  fontSize: number
  lineHeight: number
}

export function placeholderTypographyFor(hasText: boolean): PlaceholderTypography {
  if (hasText) {
    return { fontFamilyKey: 'sans', fontSize: 16, lineHeight: 24 }
  }
  return { fontFamilyKey: 'serifItalic', fontSize: 20, lineHeight: 28 }
}

/**
 * Resolve placeholder text default · prioridade:
 *   1. props.placeholder explícito
 *   2. fallback canon "Escreva ao Atlas"
 */
export function placeholderTextFor(provided?: string | null): string {
  if (provided && provided.trim().length > 0) return provided
  return 'Escreva ao Atlas'
}

/**
 * Long-press behavior decision · canon mobile.
 *
 * Quando user faz long-press no mic:
 *   - empty + sem anexos → abre Voice Mode fullscreen
 *   - com texto OU com anexos → inicia recording (transcreve junto com mensagem)
 */
export type LongPressMicAction = 'voice_mode' | 'start_recording' | 'noop'

export function resolveLongPressMicAction(input: {
  value: string
  attachmentCount: number
  disabled: boolean
  recording: boolean
}): LongPressMicAction {
  if (input.disabled || input.recording) return 'noop'
  const hasContent = input.value.trim().length > 0 || input.attachmentCount > 0
  return hasContent ? 'start_recording' : 'voice_mode'
}
