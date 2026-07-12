import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { Frau } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import {
  classifyDecideDestino,
  type DecideDestino,
} from './AtlasAiDecideModel'

const DESTINO_ORDER: DecideDestino[] = ['captura', 'conversa']

function nextDecideDestino(current: DecideDestino | null): DecideDestino {
  if (current === null) return 'captura'
  const idx = DESTINO_ORDER.indexOf(current)
  return DESTINO_ORDER[(idx + 1) % DESTINO_ORDER.length]
}

/**
 * Atlas Decide destino classifier · canon premium V2.
 *
 * Slice 6b · removida redundância V1: executor (claude/codex/gemini/conselho)
 * agora vive APENAS no ComposerPillsRow provider pill. Esta linha foca
 * exclusivamente em destino (`captura` vs `conversa`) — feature mobile-only
 * que classifica se o draft vai para inbox silencioso ou conversation thread.
 *
 * Renderiza null quando:
 *   - decide desabilitado (composer em modo standard)
 *   - classifier não conseguiu inferir destino (draft ambíguo)
 *
 * Quando destino é resolvido, mostra só `[destino] · trocar` em Frau italic.
 */
export function DecideStatusLine({
  text,
  destinoOverride,
  onOpenConfig,
  onToggleDestino,
  decideEnabled = true,
  locked,
}: {
  text: string
  destinoOverride: DecideDestino | null
  onOpenConfig: () => void
  onToggleDestino: (next: DecideDestino) => void
  decideEnabled?: boolean
  locked?: boolean
}) {
  const c = useTheme().c
  const classified = decideEnabled ? classifyDecideDestino(text) : null
  const destino = decideEnabled ? destinoOverride ?? classified : null
  const opacity = locked ? 0.35 : 0.7

  // Sem destino classificado → não renderiza nada. Pills + tokens acima
  // já comunicam estado · sem mais ruído editorial neste rail.
  if (!destino) return null

  return (
    // Slice 6u · FadeIn/FadeOut + key={destino} pra cross-fade quando
    // destino classifier MUDA (captura ↔ conversa). Premium smooth
    // transition canon editorial.
    <Animated.View
      key={destino}
      entering={FadeIn.duration(240)}
      exiting={FadeOut.duration(180)}
      style={styles.row}
    >
      <Pressable
        onPress={onOpenConfig}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`destino: ${destino}. tocar para configurar`}
      >
        <Frau italic weight="med" size={15} lineHeight={20} color={c.ink} style={{ opacity }}>
          {destino}
        </Frau>
      </Pressable>
      <Frau italic size={15} lineHeight={20} color={c.ink} style={[styles.sep, { opacity: opacity * 0.7 }]}>
        ·
      </Frau>
      <Pressable
        onPress={() => onToggleDestino(nextDecideDestino(destino))}
        hitSlop={6}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel={`trocar destino · próximo: ${nextDecideDestino(destino)}`}
      >
        <Frau italic size={12.5} lineHeight={17} color={c.ink} style={{ opacity: opacity * 0.7 }}>
          trocar
        </Frau>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 10,
    minHeight: 40,
  },
  sep: {
    marginHorizontal: 8,
  },
})
