import { Pressable, StyleSheet, View } from 'react-native'
import { Frau, Sans } from '../design/Type'
import { useTheme } from '../design/theme'

export function EmptyMission({ onDefine }: { onDefine?: () => void }) {
  const { c } = useTheme()
  return (
    <View style={[styles.card, { borderColor: c.ink3 }]}>
      <Frau italic size={18} lineHeight={26} color={c.ink} align="center" style={{ marginBottom: 18 }}>
        Nenhuma missão definida para hoje.
      </Frau>
      <Pressable
        onPress={onDefine}
        style={({ pressed }) => [
          styles.btn,
          {
            borderColor: c.prussian,
            backgroundColor: pressed ? c.prussian : 'transparent',
          },
        ]}
      >
        <Sans weight="med" size={13} letterSpacing={0.26} color={c.prussian}>
          Definir agora
        </Sans>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 26,
  },
  btn: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1,
  },
})
