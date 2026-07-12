/**
 * Slice 3c · Composer pills row · canon Atlas Hyperflow.
 *
 * Renderiza 2 pills (mode + provider) + token counter inline acima do
 * DecideStatusLine. Espelha o canon do desktop AtlasUnifiedComposer
 * (atlas-desktop/apps/desktop/src/components/composer/AtlasUnifiedComposer.tsx)
 * adaptado pra mobile portrait viewport.
 *
 * Estado read-only · tap em qualquer pill abre o `onOpenRouting` sheet
 * existente (configurador de modo/provedor já implementado). Slice 3c não
 * cria bottom sheets dedicados por pill · reusa o flow atual.
 *
 * Token counter usa `estimateRichInputTokens` canon adaptado · soma:
 *   - text.length / 4 (proxy tokens)
 *   - 1200 por imagem (image vision overhead canon)
 *   - 600 por arquivo (PDF/file fallback canon)
 *
 * Preserve features mobile-exclusive:
 *   - Não substitui DecideStatusLine (continua abaixo)
 *   - Não toca FieldInline (voice long-press preservado)
 *   - Não interfere em attachment preview strips
 */
import { Pressable, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Frau, Mono } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import type { AtlasAiMode, AtlasAiProviderChoice } from '../../../lib/atlasAi/types'
import type {
  ComposerFileAttachment,
  ComposerImageAttachment,
} from './attachmentTypes'
import {
  estimateComposerTokens,
  labelForMode,
  labelForProvider,
} from './ComposerPillsRowModel'

interface Props {
  /** Atlas mode atual (auto/general/operational/programming/research/finance/etc.) */
  mode: string
  /** Runtime/modelo atual (auto/hermes_cli/minimax_m27_cli/claude_cli/codex_cli/gemini_cli/claude_codex) */
  provider: string
  /** Draft text · usado pra cálculo de tokens */
  draft: string
  /** Imagens anexadas · +1200 tokens each */
  imageAttachments: ComposerImageAttachment[]
  /** Files anexados · +600 tokens each */
  fileAttachments: ComposerFileAttachment[]
  /**
   * Slice 6d · callback opcional do mode pill · abre ComposerModeSheet.
   * Fallback: se ausente, cai pra onOpenRouting (sheet genérica).
   */
  onOpenMode?: () => void
  /**
   * Slice 6d · callback opcional do provider pill · abre ComposerProviderSheet.
   * Fallback: se ausente, cai pra onOpenRouting (sheet genérica).
   */
  onOpenProvider?: () => void
  /** Fallback genérico · usado quando onOpenMode/onOpenProvider ausentes */
  onOpenRouting: () => void
  /** Disabled quando interaction locked (envio em andamento) */
  disabled?: boolean
}

/**
 * @deprecated · 2026-05-18 · substituído por AtlasComposerCard (canon promise).
 *
 * Esse componente ficou orfão após o redesign Slice 6j+: pills + tokens
 * agora vivem DENTRO do AtlasComposerCard. Mantido temporariamente caso
 * outros surfaces ainda importem ele · será removido após audit completo.
 *
 * Antes: 2 pills (mode + provider) + token counter floating na zona pré-input.
 * Depois: 1 pill (auto, abre routing full) dentro do card canônico.
 */
export function ComposerPillsRow({
  mode,
  provider,
  draft,
  imageAttachments,
  fileAttachments,
  onOpenMode,
  onOpenProvider,
  onOpenRouting,
  disabled = false,
}: Props) {
  // Marker void params · evita TS unused warnings durante deprecation phase
  void mode; void provider; void draft; void imageAttachments; void fileAttachments
  void onOpenMode; void onOpenProvider; void onOpenRouting; void disabled
  return null
}

function PillButton({
  label,
  onPress,
  disabled,
  c,
}: {
  label: string
  onPress: () => void
  disabled: boolean
  c: ReturnType<typeof useTheme>['c']
}) {
  // Slice 6i · haptic Soft no press · canon premium iOS tactile.
  // Sem haptic, pills lêem como divs comuns. Com haptic, viram
  // affordance "esculpida" — premium signal de quality.
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    onPress()
  }
  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${label} · tocar para configurar conversa`}
      style={({ pressed }) => [
        styles.pill,
        {
          // Canon premium: border alpha cream 0.16 (`c.border` em slate dark
          // resolve pra rgba(233,238,242,0.10) hoje; o token é o canonical).
          // Bg transparente → pressed: surface raised sutil (sem chunky fill).
          borderColor: c.border,
          backgroundColor: pressed ? c.bgRaised : 'transparent',
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      {/* Gold dot 5.5px (era 4px) · opacity 0.95 (era 0.78) · presença canon
          atlas gold sem ficar gritante. Posicionado antes do label como
          marca d'água "estado ativo". */}
      <View style={[styles.pillDot, { backgroundColor: c.bronze, opacity: 0.95 }]} />
      {/* Label em Frau italic · vocabulário manuscript-Don-Corleone canon
          Atlas premium. Antes Sans medium · era utility/SaaS. Italic dá
          ar editorial (Smythson notebook) que combina com o resto do
          composer (FieldInline placeholder também Frau italic). */}
      <Frau italic size={12} lineHeight={15} color={c.ink2} numberOfLines={1}>
        {label}
      </Frau>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  pillsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    minHeight: 28,
  },
  pillDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
  },
  tokensCluster: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    flexShrink: 0,
  },
  tokensWord: {
    opacity: 0.85,
  },
})

/* unused types kept exported for tests/integration consumers */
export type { AtlasAiMode, AtlasAiProviderChoice }
