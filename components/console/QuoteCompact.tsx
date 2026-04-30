import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'

interface Props {
  text: string
}

// The operator's question rendered as a page header — Fraunces italic
// with a 2px bronze marker on the left. Replaces the iMessage-style
// dark bubble. Less assertive than a button; more present than a label.
//
// Soft fade-in so optimistic mounts feel placed, not flashed.
export function QuoteCompact({ text }: Props) {
  const c = usePalette()
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.row}>
      <View style={[styles.marker, { backgroundColor: c.bronze }]} />
      <View style={styles.body}>
        <Frau italic size={18} lineHeight={26} color={c.ink}>
          “{text}”
        </Frau>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  marker: {
    width: 2,
    borderRadius: 1,
    marginRight: 14,
  },
  body: {
    flex: 1,
    paddingVertical: 2,
  },
})
