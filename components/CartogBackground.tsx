import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, G, Path } from 'react-native-svg'
import { usePalette } from '../design/theme'

interface Props {
  opacity?: number
  style?: StyleProp<ViewStyle>
}

// P12 v6 literal · "cartografia sussurrada" · 5-7% opacity.
// Meridianos curvos verticais + paralelos horizontais + rosa-dos-ventos sutil
// no canto superior direito + pontos coordenados esparsos.
//
// "você nota na terceira vez que abre o app, não no primeiro segundo."
//
// Substituiu grid quadriculado anterior · grid era SaaS-genérico, não Atlas.
export function CartogBackground({ opacity, style }: Props = {}) {
  const c = usePalette()
  const isDark = c.bg === '#1C1916'
  const stroke = isDark ? 'rgba(244,239,230,0.5)' : 'rgba(26,22,18,0.5)'
  const finalOpacity = opacity ?? (isDark ? 0.07 : 0.055)

  return (
    <View pointerEvents="none" style={[styles.wrap, style]}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 393 800"
        preserveAspectRatio="xMidYMid slice"
        opacity={finalOpacity}
      >
        {/* meridianos verticais curvos */}
        <Path d="M 60 -20 Q 90 200 60 420 Q 30 640 60 860" stroke={stroke} strokeWidth="0.5" fill="none" />
        <Path d="M 333 -20 Q 303 200 333 420 Q 363 640 333 860" stroke={stroke} strokeWidth="0.5" fill="none" />
        <Path d="M 196 -20 Q 196 400 196 860" stroke={stroke} strokeWidth="0.4" fill="none" opacity="0.6" />

        {/* paralelos horizontais */}
        <Path d="M -20 180 Q 196 200 410 180" stroke={stroke} strokeWidth="0.4" fill="none" />
        <Path d="M -20 460 Q 196 480 410 460" stroke={stroke} strokeWidth="0.4" fill="none" />
        <Path d="M -20 700 Q 196 720 410 700" stroke={stroke} strokeWidth="0.4" fill="none" />

        {/* rosa dos ventos sutil · canto superior direito */}
        <G transform="translate(345 30)" opacity="0.55">
          <Circle r="11" fill="none" stroke={stroke} strokeWidth="0.5" />
          <Circle r="7" fill="none" stroke={stroke} strokeWidth="0.4" opacity="0.7" />
          <Path d="M 0 -11 L 0 11 M -11 0 L 11 0" stroke={stroke} strokeWidth="0.5" />
        </G>

        {/* pontos coordenados esparsos */}
        <Circle cx="120" cy="320" r="0.8" fill={stroke} opacity="0.7" />
        <Circle cx="270" cy="240" r="0.8" fill={stroke} opacity="0.7" />
        <Circle cx="80" cy="540" r="0.8" fill={stroke} opacity="0.7" />
        <Circle cx="290" cy="600" r="0.8" fill={stroke} opacity="0.7" />
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
