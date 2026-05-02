import { Platform, ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native'
import { type ReactNode } from 'react'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { CartogBackground } from './CartogBackground'
import { usePalette } from '../design/theme'

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
  ...rest
}: Props) {
  const c = usePalette()
  const insets = useSafeAreaInsets()
  const totalBottom = DOCK_BASELINE + insets.bottom + bottomPad
  return (
    <View style={[styles.fill, { backgroundColor: c.bg }, containerStyle]}>
      {!bare && <CartogBackground />}
      <SafeAreaView edges={['top']} style={styles.fill}>
        <ScrollView
          contentContainerStyle={{
            paddingTop: topExtra,
            paddingHorizontal: 28,
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
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
})
