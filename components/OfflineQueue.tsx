import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Mono } from '../design/Type'
import { useTheme } from '../design/theme'

// Sussurro acima do dock — "✦ fila local: N capturas aguardando sync".
export function OfflineQueue({ visible, queue }: { visible: boolean; queue: number }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  if (!visible) return null
  return (
    <View
      pointerEvents="none"
      style={[
        styles.row,
        { bottom: 96 + insets.bottom },
      ]}
    >
      <Mono size={11} letterSpacing={0.44} color={c.bronze} align="center">
        ✦ fila local: {queue} {queue === 1 ? 'item aguardando' : 'itens aguardando'} sync
      </Mono>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 31,
    alignItems: 'center',
  },
})
