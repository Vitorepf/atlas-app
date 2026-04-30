import { Pressable, StyleSheet, Text } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useTheme } from '../../design/theme'
import { fonts } from '../../design/tokens'

interface Props {
  onPress: () => void
  size?: number
}

// The Inbox's primary "begin a thought" affordance. Circular ink button
// with a Fraunces italic "T" — text capture is the default path. Uses
// Atlas's own typeface as the icon: self-referential and editorial,
// avoids the generic-app feel of a pencil/plus glyph.
export function CaptureButton({ onPress, size = 52 }: Props) {
  const { c, name } = useTheme()
  const bg = name === 'dark' ? c.bronze : c.ink
  const glyphSize = Math.round(size * 0.55)

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel="nova captura de texto"
      style={({ pressed }) => [
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          shadowColor: '#1C1916',
          shadowOpacity: 0.22,
          transform: [{ scale: pressed ? 0.92 : 1 }],
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
  },
})
