import { Pressable, StyleSheet, View } from 'react-native'
import { Sans } from '../design/Type'
import { useTheme } from '../design/theme'

interface Props {
  onRetry: () => void
}

// Erro inline na tela de detalhe — explica o que aconteceu, oferece próximo passo.
export function TranscribeError({ onRetry }: Props) {
  const { c } = useTheme()
  return (
    <View style={[styles.row, { borderTopColor: c.border }]}>
      <Sans size={12} lineHeight={18} color={c.ink2}>⚠</Sans>
      <Sans size={12} lineHeight={18} color={c.ink2} style={styles.text}>
        Não foi possível transcrever automaticamente
      </Sans>
      <Pressable onPress={onRetry} style={({ pressed }) => [{ opacity: pressed ? 0.65 : 1 }]}>
        <Sans
          weight="med"
          size={12}
          color={c.prussian}
          style={{ textDecorationLine: 'underline' }}
        >
          Tentar novamente
        </Sans>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    marginTop: 14,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 10,
  },
  text: { flex: 1, minWidth: 100 },
})
