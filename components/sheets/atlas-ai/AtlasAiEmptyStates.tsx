import { Pressable, StyleSheet, View } from 'react-native'
import { BronzeDiamond } from '../../console/BronzeDiamond'
import { Frau } from '../../../design/Type'
import { useTheme } from '../../../design/theme'

export function AtlasAiEmptyPage() {
  const { c } = useTheme()

  return (
    <View style={styles.empty}>
      <Frau
        italic
        size={32}
        lineHeight={32}
        color={c.bronze}
        style={{
          textShadowColor: `${c.bronze}4D`,
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 4,
        }}
      >
        ✦
      </Frau>
      <View style={{ height: 40 }} />
      <Frau italic size={22} lineHeight={32} align="center" color={c.ink}>
        “O que você quer pensar agora?”
      </Frau>
    </View>
  )
}

export function AtlasAiFilteredEmpty({
  label,
  onReset,
}: {
  label: string
  onReset: () => void
}) {
  const { c } = useTheme()

  return (
    <Pressable
      onPress={onReset}
      style={({ pressed }) => [styles.empty, { opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel="limpar filtro"
    >
      <BronzeDiamond size={14} opacity={0.65} />
      <View style={{ height: 22 }} />
      <Frau italic size={18} lineHeight={27} align="center" color={c.ink2}>
        sem itens em {label} · tocar para voltar
      </Frau>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 96,
  },
})
