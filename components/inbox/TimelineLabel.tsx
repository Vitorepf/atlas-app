import { StyleSheet, View } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { BronzeDiamond } from '../console/BronzeDiamond'

// Timeline-label canon + linha-✦ inline com diamante centralizado no eixo
// horizontal da linha (não centralizado no espaço pós-label).
//
// Layout: [esquerda flex:1: label + hairline] [✦ fixa] [direita flex:1: hairline].
// Como esquerda e direita são ambas flex:1, o diamante fica no centro
// geométrico exato da linha. As hairlines têm comprimentos visuais
// distintos (esquerda é "label + restante", direita é "hairline cheia"),
// mas o ✦ permanece anchored ao meio — análogo ao DividerEditorial do
// Atlas AI, expandido pra acolher um label inline.
//
// Vocabulário sancionado em `feedback_atlas_diamond_day_separator.md`.
// Vocabulário PT-BR editorial: "hoje" / "ontem" / "9 de maio".
interface Props {
  label: string
}

export function TimelineLabel({ label }: Props) {
  const c = usePalette()
  return (
    <Animated.View entering={FadeIn.duration(380)} style={styles.row}>
      <View style={styles.leftHalf}>
        <Frau italic size={14} lineHeight={20} color={c.ink2}>
          {label}
        </Frau>
        <View style={[styles.line, { backgroundColor: c.border }]} />
      </View>
      <BronzeDiamond size={11} opacity={0.7} style={styles.diamond} />
      <View style={[styles.line, { backgroundColor: c.border }]} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 6,
  },
  leftHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  diamond: {
    paddingHorizontal: 14,
  },
})

export default TimelineLabel
