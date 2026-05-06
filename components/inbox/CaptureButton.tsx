import { Pressable, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../design/theme'
import { fonts } from '../../design/tokens'

interface Props {
  onPress: () => void          // tap rápido (<220ms) → captura de texto
  onLongPress?: () => void     // hold (≥220ms) → captura de áudio
  size?: number
}

// "Begin a thought" affordance · self-referential typography como ícone.
// Tap rápido = texto · long-press 220ms = áudio (Frente 1 v8 sub-10s sagrado).
// Bronze hairline topo (edge lighting técnica #2) + warm shadow ink-tinted.
export function CaptureButton({ onPress, onLongPress, size = 52 }: Props) {
  const { c, name } = useTheme()
  const bg = name === 'dark' ? c.bronze : c.ink
  const glyphSize = Math.round(size * 0.55)

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      onLongPress={
        onLongPress
          ? () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              onLongPress()
            }
          : undefined
      }
      delayLongPress={220}
      accessibilityRole="button"
      accessibilityLabel="captura · toque para texto, segure para áudio"
      style={({ pressed }) => [
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: 'rgba(155,122,63,0.22)', // edge lighting bronze
          shadowColor: '#1A1612', // sombra warm ink-tinted
          shadowOpacity: 0.22,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
      ]}
    >
      <Text
        style={{
          fontFamily: fonts.serifItalic,
          fontSize: glyphSize,
          lineHeight: glyphSize,
          color: c.bg,
          marginTop: -glyphSize * 0.06,
        }}
      >
        T
      </Text>
      {/* dois pontinhos abaixo do T · semáforo cognitivo "tem dois modos" */}
      <View style={styles.affordanceDots} pointerEvents="none">
        <View style={[styles.dot, { backgroundColor: 'rgba(244,239,230,0.45)' }]} />
        <View style={[styles.dot, { backgroundColor: 'rgba(244,239,230,0.45)' }]} />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 5,
    position: 'relative',
  },
  affordanceDots: {
    position: 'absolute',
    bottom: 8,
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 999,
  },
})
