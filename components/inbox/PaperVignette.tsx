import { StyleSheet, View } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { usePalette } from '../../design/theme'

// Técnica #7 v5 · vinheta direcional · luz top-left + sombra bottom-right.
// Implementado via SVG radial-gradient · efeito sutil real, não dois blobs grosseiros.
//
// Corrigido após screenshot mostrar dois "círculos grandes" visíveis demais ·
// versão anterior era 25-35% opaca · agora é ≤4% como vinheta editorial real.
export function PaperVignette() {
  const c = usePalette()
  const isDark = c.bg === '#1C1916'
  // Pico ≤5% em ambos os modos · vinheta editorial sussurrada, nunca blob visível.
  // Bug 2026-05: light mode estava em 0.42 (42%!) — gerava retângulo bronze hard-edge
  // sobre as cartas. Corrigido pra 0.045 alinhado com comentário original.
  const lightStop = isDark ? 'rgba(244,239,230,0.045)' : 'rgba(255,250,240,0.05)'
  const shadowStop = isDark ? 'rgba(122,94,47,0.07)' : 'rgba(122,94,47,0.05)'

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <Defs>
          {/* Luz top-left · marfim warm · cresce do canto e some no centro */}
          <RadialGradient id="paperLight" cx="22%" cy="18%" r="65%" fx="22%" fy="18%">
            <Stop offset="0%" stopColor={lightStop} stopOpacity="1" />
            <Stop offset="55%" stopColor={lightStop} stopOpacity="0" />
          </RadialGradient>
          {/* Sombra bottom-right · bronze tint · cresce do canto e some no centro */}
          <RadialGradient id="paperShadow" cx="82%" cy="88%" r="70%" fx="82%" fy="88%">
            <Stop offset="0%" stopColor={shadowStop} stopOpacity="1" />
            <Stop offset="50%" stopColor={shadowStop} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#paperLight)" />
        <Rect width="100%" height="100%" fill="url(#paperShadow)" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
})
