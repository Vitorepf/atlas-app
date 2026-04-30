import { StyleSheet } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Frau } from '../../design/Type'

interface Props {
  text: string
  align?: 'left' | 'right'
}

// Whispered attribution at the foot of a response page.
// Replaces dashboard-style meta-lines like "CLAUDE · RESPONDER · AUTO · 6.6S"
// with editorial voice: "— claude, em seis segundos."
//
// Arrives 220ms after the response — gives the page a moment to settle
// before the signature appears underneath.
export function CaptionWhisper({ text, align = 'right' }: Props) {
  return (
    <Animated.View
      entering={FadeIn.duration(280).delay(220)}
      style={[styles.row, align === 'right' && styles.right]}
    >
      <Frau italic size={13} lineHeight={18} style={styles.text}>
        {text}
      </Frau>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingTop: 12,
  },
  right: {
    justifyContent: 'flex-end',
  },
  text: {
    opacity: 0.4,
  },
})
