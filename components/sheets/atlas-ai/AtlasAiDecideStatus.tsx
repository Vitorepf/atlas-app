import { Pressable, StyleSheet, View } from 'react-native'
import { Frau } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import type { RoutingExecutor } from '../../console/StatusRouting'
import {
  classifyDecideDestino,
  type DecideDestino,
} from './AtlasAiDecideModel'

const DESTINO_ORDER: DecideDestino[] = ['captura', 'conversa']

function executorShortLabel(executor: RoutingExecutor): string {
  switch (executor) {
    case 'claude_cli':   return 'claude'
    case 'codex_cli':    return 'codex'
    case 'gemini_cli':   return 'gemini'
    case 'claude_codex': return 'conselho'
    default:             return 'atlas'
  }
}

function nextDecideDestino(current: DecideDestino | null): DecideDestino {
  if (current === null) return 'captura'
  const idx = DESTINO_ORDER.indexOf(current)
  return DESTINO_ORDER[(idx + 1) % DESTINO_ORDER.length]
}

export function DecideStatusLine({
  text,
  executor,
  destinoOverride,
  onOpenConfig,
  onToggleDestino,
  decideEnabled = true,
  locked,
}: {
  text: string
  executor: RoutingExecutor
  destinoOverride: DecideDestino | null
  onOpenConfig: () => void
  onToggleDestino: (next: DecideDestino) => void
  decideEnabled?: boolean
  locked?: boolean
}) {
  const c = useTheme().c
  const executorLabel = executorShortLabel(executor)
  const classified = decideEnabled ? classifyDecideDestino(text) : null
  const destino = decideEnabled ? destinoOverride ?? classified : null
  const opacity = locked ? 0.35 : 0.7

  if (!destino) {
    return (
      <View style={styles.row}>
        <Pressable
          onPress={onOpenConfig}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`atual: ${executorLabel}. tocar para configurar`}
        >
          <Frau italic weight="med" size={16} lineHeight={22} color={c.ink} style={{ opacity }}>
            {executorLabel}
          </Frau>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onOpenConfig}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`atual: ${executorLabel} ${destino}. tocar para configurar`}
      >
        <Frau italic weight="med" size={16} lineHeight={22} color={c.ink} style={{ opacity }}>
          {executorLabel}
        </Frau>
      </Pressable>
      <Frau italic size={16} lineHeight={22} color={c.ink} style={[styles.sep, { opacity: opacity * 0.7 }]}>
        ·
      </Frau>
      <Pressable
        onPress={onOpenConfig}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`destino: ${destino}. tocar para configurar`}
      >
        <Frau italic weight="med" size={16} lineHeight={22} color={c.ink} style={{ opacity }}>
          {destino}
        </Frau>
      </Pressable>
      <Frau italic size={16} lineHeight={22} color={c.ink} style={[styles.sep, { opacity: opacity * 0.7 }]}>
        ·
      </Frau>
      <Pressable
        onPress={() => onToggleDestino(nextDecideDestino(destino))}
        hitSlop={6}
        disabled={locked}
        accessibilityRole="button"
        accessibilityLabel={`trocar destino · próximo: ${nextDecideDestino(destino)}`}
      >
        <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity: opacity * 0.7 }}>
          trocar
        </Frau>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 12,
    minHeight: 44,
  },
  sep: {
    marginHorizontal: 8,
  },
})
