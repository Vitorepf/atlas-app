import { Pressable, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'

// Frente 1 v8 · Modo Foco · pill "↺ voltar" top-right.
// Aparece apenas quando focusMode = true · tap = sai do foco · Cap. 13 v6 modo "silêncio" do JITAI.

interface Props {
  onPress: () => void
}

export function FocusModePill({ onPress }: Props) {
  const c = usePalette()
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {})
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel="sair do modo foco"
      hitSlop={10}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: c.bg + 'EE',
          borderColor: c.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Frau italic size={13} lineHeight={16} color={c.ink2}>
        ↺
      </Frau>
      <Frau italic size={12} lineHeight={15} letterSpacing={-0.06} color={c.ink2}>
        voltar
      </Frau>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
