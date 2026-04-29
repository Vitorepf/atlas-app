import { StyleSheet, View } from 'react-native'
import { Frau, Sans } from '../design/Type'
import { Sparkle } from './Sparkle'
import { useTheme } from '../design/theme'

export function EmptyWeekly() {
  const { c } = useTheme()
  return (
    <View style={styles.wrap}>
      <Sparkle size={18} style={{ marginBottom: 22 }} />
      <Frau italic size={20} lineHeight={28} color={c.ink} align="center" style={{ maxWidth: 280, marginBottom: 14 }}>
        Nenhuma captura nesta semana.
      </Frau>
      <Sans size={14} lineHeight={22} color={c.ink2} align="center" style={{ maxWidth: 260 }}>
        A revisão semanal aparece assim que houver dados sincronizados no Atlas Server.
      </Sans>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 60, paddingBottom: 40, paddingHorizontal: 16, alignItems: 'center' },
})
