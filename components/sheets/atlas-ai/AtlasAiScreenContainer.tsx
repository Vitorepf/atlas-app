import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../../../design/theme'

export function AtlasAiScreenContainer({ children }: { children: ReactNode }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={[
        styles.screenContainer,
        { backgroundColor: c.bg, paddingTop: insets.top },
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
})
