import { Platform, ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native'
import { type ReactNode } from 'react'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { Easing, Keyframe } from 'react-native-reanimated'
import { CartogBackground } from './CartogBackground'
import { HorizontalGrid } from './editorial/HorizontalGrid'
import { usePalette } from '../design/theme'

// Atlas weighted settle · scale 1.008→1.0, sem opacity, sem translateY.
// Metáfora física: copo de uísque pousando em balcão de carvalho · objeto
// pesado descendo no lugar, não folha leve flutuando até parar. Easing de
// deceleração agressiva (thud-controlado), duração 280ms — `considered`
// dos tokens. Não é exhale, é assentamento de massa.
const atlasSettle = new Keyframe({
  0: { transform: [{ scale: 1.008 }] },
  100: { transform: [{ scale: 1 }], easing: Easing.bezier(0.4, 1, 0.2, 1) },
}).duration(280)

interface Props extends ScrollViewProps {
  children: ReactNode
  // Skip the cartography background (capture screen, etc.)
  bare?: boolean
  // Extra top padding above the safe area (defaults to 24).
  topExtra?: number
  // Extra bottom padding above the dock-clearance baseline. Default 24
  // gives breath; pass higher for screens whose last element shouldn't kiss
  // the dock. Pass 0 for full-bleed flows that mount the dock themselves.
  bottomPad?: number
  containerStyle?: ViewStyle
  /** Eixos do CartogBackground · default 'both' (V+H grid completo).
   *  'vertical' = apenas colunas (vocabulário Aldine · variante F · home
   *  editorial premium · horizontais saem dos próprios componentes). */
  bgAxis?: 'both' | 'vertical'
}

// Dock geometry — kept in sync with components/Dock.tsx:
//   wrapper bottom: 8 + insets.bottom
//   dock height: 64
// Total dock occupied space from the screen bottom edge:
//   8 + insets.bottom + 64
const DOCK_BASELINE = 8 + 64

// Extra breath above the keyboard when an input is focused. iOS's
// automaticallyAdjustKeyboardInsets brings the focused field flush with the
// keyboard top; this contentInset pushes the field up by an extra 48px so the
// cursor never kisses the keyboard. Mantido pequeno para não causar overscroll
// perceptível quando o teclado está fechado.
const KEYBOARD_BREATH_INSET = { top: 0, left: 0, bottom: 48, right: 0 } as const

// Standard screen wrapper. Provides:
// - Background fill matching theme
// - Cartography grid (sussurro)
// - SafeAreaView top edge (immune to insets-race-condition)
// - Scroll container with dock-clearance bottom (responsive to safe area)
export function Screen({
  children,
  bare = false,
  topExtra = 24,
  bottomPad = 24,
  containerStyle,
  bgAxis = 'both',
  ...rest
}: Props) {
  const c = usePalette()
  const insets = useSafeAreaInsets()
  const totalBottom = DOCK_BASELINE + insets.bottom + bottomPad
  return (
    <View style={[styles.fill, { backgroundColor: c.bg }, containerStyle]}>
      {!bare && <CartogBackground axis={bgAxis} />}
      <Animated.View entering={atlasSettle} style={styles.fill}>
        <SafeAreaView edges={['top']} style={styles.fill}>
          <ScrollView
            contentContainerStyle={{
              paddingTop: topExtra,
              // F mockup canon · `.content { padding: 0 32px }`. Trilho borda
              // em x=32 (esq) e x=361 (dir, 393-32). Trilho interno em x=64
              // surge dos blocos com marginLeft:32. Layout simétrico, fiel ao
              // mockup F.
              //
              // A maioria dos values do TOC termina ANTES da penúltima coluna
              // (x=324) NATURALMENTE porque o texto é mais curto que a row —
              // "memória em dia" para em ~285, "recall e context pack" em ~320,
              // "relatório fair claude" em ~310. Só "harness runner e atlas-
              // bench" se estende até a última coluna (~358), tocando o limite
              // sem cruzar — exatamente como no mockup F renderizado em browser.
              //
              // Tentativa anterior de paddingRight:69 (recuar trilho até x=324
              // pra forçar TODOS os values antes da penúltima) deixou 2 colunas
              // inteiras vazias à direita — quebrou o equilíbrio editorial.
              // Reversão: voltamos a 32 simétrico, fiel ao mockup F.
              paddingHorizontal: 32,
              paddingBottom: totalBottom,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            // 48px de respiro acima do teclado: iOS soma este contentInset ao
            // ajuste automático, evitando que o input focado fique colado no
            // topo do teclado. Sem isso, o cursor encosta na borda do teclado.
            contentInset={Platform.OS === 'ios' ? KEYBOARD_BREATH_INSET : undefined}
            scrollIndicatorInsets={Platform.OS === 'ios' ? KEYBOARD_BREATH_INSET : undefined}
            {...rest}
          >
            {bgAxis === 'vertical' ? (
              // Variante F · wrapper relativo dentro do ScrollView abriga o
              // HorizontalGrid (absolute fill) que rola junto com o conteúdo
              // formando quadrados 36×36 com as colunas verticais fixas do bg.
              <View style={styles.scrollWrap}>
                <HorizontalGrid />
                {children}
              </View>
            ) : (
              children
            )}
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // wrapper relativo · ancora HorizontalGrid (absolute fill) ao conteúdo
  // scrollable. Sem altura fixa · sized pelos children in-flow.
  scrollWrap: { position: 'relative' },
})
