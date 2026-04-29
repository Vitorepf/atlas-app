import { StyleSheet, View } from 'react-native'
import { Frau, Sans } from '../design/Type'
import { Sparkle } from './Sparkle'
import { useTheme } from '../design/theme'

// "Inbox limpa." — uma pausa, não um aviso.
export function EmptyInbox() {
  const { c } = useTheme()
  return (
    <View style={styles.wrap}>
      <Sparkle size={48} />
      <View style={{ height: 26 }} />
      <Frau italic size={22} lineHeight={28} letterSpacing={-0.22} color={c.ink}>
        Inbox limpa.
      </Frau>
      <Sans
        size={14}
        lineHeight={22}
        color={c.ink2}
        align="center"
        style={{ maxWidth: 240, marginTop: 10 }}
      >
        Capture algo quando o pensamento aparecer.
      </Sans>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
})
