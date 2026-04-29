import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native'
import { type ReactNode } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { CartogBackground } from './CartogBackground'
import { usePalette } from '../design/theme'

interface Props extends ScrollViewProps {
  children: ReactNode
  // Skip the cartography background (capture screen, etc.)
  bare?: boolean
  // Extra top padding above the safe area (defaults to 24).
  topExtra?: number
  // Bottom padding to clear the dock.
  bottomPad?: number
  containerStyle?: ViewStyle
}

// Standard screen wrapper. Provides:
// - Background fill matching theme
// - Cartography grid (sussurro)
// - SafeAreaView top edge (immune to insets-race-condition)
// - Scroll container with dock-clearance bottom
export function Screen({
  children,
  bare = false,
  topExtra = 24,
  bottomPad = 110,
  containerStyle,
  ...rest
}: Props) {
  const c = usePalette()
  return (
    <View style={[styles.fill, { backgroundColor: c.bg }, containerStyle]}>
      {!bare && <CartogBackground />}
      <SafeAreaView edges={['top']} style={styles.fill}>
        <ScrollView
          contentContainerStyle={{
            paddingTop: topExtra,
            paddingHorizontal: 28,
            paddingBottom: bottomPad,
          }}
          showsVerticalScrollIndicator={false}
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
