import { StyleSheet, View } from 'react-native'
import { usePalette } from '../../design/theme'
import { BronzeDiamond } from './BronzeDiamond'

// Editorial section break — hairline + ✦ bronze centered. The Atlas
// answer to a markdown horizontal rule. Used inside response prose to
// mark a tonal shift; never as decoration.
export function DividerEditorial() {
  const c = usePalette()
  return (
    <View style={styles.row}>
      <View style={[styles.line, { backgroundColor: c.border }]} />
      <BronzeDiamond size={11} opacity={0.7} style={styles.diamond} />
      <View style={[styles.line, { backgroundColor: c.border }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  diamond: {
    paddingHorizontal: 14,
  },
})
