/**
 * Slice 6c · Composer offline status row · canon Atlas premium.
 *
 * Renderiza "servidor desconectado" sentence-case calm + DividerEditorial
 * acima do ComposerPillsRow QUANDO `serverReachable === false`.
 * Some completamente quando online (zero ruído visual).
 *
 * Canon Codex-inspired aplicado mobile:
 *   - Sentence-case, sem badge, sem cor saturada (cool muted)
 *   - Frau italic 13px subtle · text-faint color
 *   - DividerEditorial ✦ hairline · marca transição editorial
 *   - Premise: status comunica via TIPOGRAFIA, não via alerta vermelho
 *
 * Detection via `useAtlasStore(s => s.serverReachable)` — store já mantém
 * esse estado via sync ticks (verá AtlasShell.tsx:50).
 */
import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { Frau } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import { useAtlasStore } from '../../../lib/atlasStore'
import { DividerEditorial } from '../../console/DividerEditorial'

export function ComposerOfflineStatusRow() {
  const { c } = useTheme()
  const reachable = useAtlasStore((s) => s.serverReachable)

  // Canon: online = zero render (composer respira sozinho)
  if (reachable) return null

  return (
    // Slice 6r · FadeIn/FadeOut animation quando server toggles online/offline.
    // Premium: status row materializa smooth, não pop instantâneo. Reanimated
    // entering/exiting handle automatic via FadeIn primitive duration 260ms
    // bezier canon iOS.
    <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(220)}>
      <View style={styles.row}>
        <Frau
          italic
          size={13}
          lineHeight={18}
          color={c.ink2}
          align="center"
          style={styles.text}
        >
          servidor desconectado
        </Frau>
      </View>
      {/* DividerEditorial ✦ marca transição editorial entre status calm
          e composer config (pills). Mesmo padrão usado entre pills e
          DecideStatusLine no Slice 6a. */}
      <DividerEditorial />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  text: {
    opacity: 0.78,
  },
})
