/**
 * Cartografia · world · canvas vivo.
 *
 * Composition root da área navegável. Aplica o transform single (translate +
 * scale) num `<Animated.View>` que carrega todos os atoms em world-coords
 * fixos. Trails SVG futuras vão DENTRO desse mesmo wrapper — escalam junto
 * via parent transform, zero recalc em pan.
 *
 * GestureDetector envolve o viewport (não o world) — gestos são lidos no
 * referencial do dispositivo, math worklet converte pra transform world.
 */
import { type ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { GestureDetector } from 'react-native-gesture-handler'
import { usePalette } from '../../../design/theme'
import { WORLD_HEIGHT, WORLD_WIDTH } from './layout'
import { type CartografiaViewport } from '../viewport/useCartografiaViewport'
import { CanvasGrid } from './CanvasGrid'

interface Props {
  viewport: CartografiaViewport
  children: ReactNode
}

// Static base style fora do StyleSheet.create pra evitar narrowing TextStyle
// quando combinado com Reanimated useAnimatedStyle (issue conhecido em
// reanimated 4.x · estilo composto vira union TextStyle|ViewStyle).
//
// `transformOrigin` é deliberadamente OMITIDO. Default RN = center.
// `viewportMath.fitWorld` compensa esse center-origin via math (ver
// comentário lá). Não confiamos em transformOrigin string porque
// suporte varia entre Reanimated 4 + RN versions.
const worldBaseStyle: ViewStyle = {
  position: 'absolute',
  left: 0,
  top: 0,
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
}

export function CartographyWorld({ viewport, children }: Props) {
  const c = usePalette()

  // GestureDetector wrappa a View VIEWPORT (sem transform · hit-area
  // sólida 100% da área visível). Animated.View world fica DENTRO, com
  // transform aplicado pra pan/zoom · seu hit-test exotic devido ao
  // transform NÃO afeta o gesture detector pai. Atoms filhos continuam
  // capturando tap próprio via RNGH race nativo (tap maxDistance 8 <
  // pan minDistance 6 → tap vence em toque parado, pan vence em drag).
  return (
    <GestureDetector gesture={viewport.composedGesture}>
      <View
        style={[styles.viewport, { backgroundColor: c.bg }]}
        onLayout={viewport.onLayout}
      >
        <Animated.View style={[worldBaseStyle, viewport.animatedStyle]}>
          {/* Grid editorial canon · vive dentro do .world, escala junto */}
          <CanvasGrid />
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  )
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    overflow: 'hidden',
  },
})
