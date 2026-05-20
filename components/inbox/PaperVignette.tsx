import { StyleSheet, View } from 'react-native'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { useTheme } from '../../design/theme'

// Técnica #7 v5 · vinheta direcional · luz top-left + sombra bottom-right.
// Implementado via SVG radial-gradient · efeito sutil real, não dois blobs grosseiros.
//
// Pico ≤5% em ambos os modos · vinheta editorial sussurrada, nunca blob visível.
// Dark canon slate · light cool cream highlight + deep slate shadow tint
// (bronze warm tint do canon antigo Aesop foi removido).
export function PaperVignette() {
  const isDark = useTheme().name === 'dark'
  const lightStop = isDark ? 'rgba(214,221,226,0.045)' : 'rgba(255,250,240,0.05)'
  const shadowStop = isDark ? 'rgba(15,33,42,0.10)' : 'rgba(122,94,47,0.05)'

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
