import { Pressable, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'

interface Props {
  /** "i", "ii", "iii", "iv" — numeral romano (sem ponto, é adicionado). */
  numeral: string
  /** "Agenda", "Operação Atlas" — vai pra caps automaticamente. */
  title: string
  /** Standfirst opcional · italic Frau pequeno abaixo do título.
   *  Ex.: "diário de intenção · sete de maio". */
  deck?: string
  /** Tap handler · quando definido, o head inteiro vira Pressable.
   *  Feedback canon: opacity 0.55 on press. Usado pra abrir telas
   *  navegáveis a partir do título da seção (ex.: AGENDA → /agenda). */
  onPress?: () => void
}

// SectionHead editorial · numeral romano em mono caps com ponto bronze,
// título em Frau caps com letterSpacing de capítulo, standfirst opcional
// em italic Frau pequeno, hairline de fechamento. Substitui o TierMark
// (que era italic + ✦ diamond) — vocabulário de chapter opener de livro
// encadernado em vez de marker de wishlist.
//
// Tap opcional: quando `onPress` é passado, o head (numeral + título) vira
// pressable com feedback opacity 0.55. O deck e hr ficam fora do tap-area
// porque são contexto/estrutura, não affordance — apenas o título-portal
// reage. Vocabulário "click no logo" do canon.
export function SectionHead({ numeral, title, deck, onPress }: Props) {
  const c = usePalette()

  const headContent = (
    <View style={styles.head}>
      <Mono
        size={11}
        lineHeight={16}
        letterSpacing={0.6}
        color={c.bronze}
        style={styles.numeral}
      >
        {`${numeral.toLowerCase()}.`}
      </Mono>
      <Frau
        weight="med"
        size={17}
        lineHeight={22}
        letterSpacing={3}
        color={c.ink}
        style={styles.title}
      >
        {title.toUpperCase()}
      </Frau>
    </View>
  )

  // Slice 6ab · press scale 0.96 spring + haptic Soft canon premium
  const pressScale = useSharedValue(1)
  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    onPress?.()
  }

  return (
    <View style={styles.wrap}>
      {onPress ? (
        <Animated.View style={pressAnimStyle}>
          <Pressable
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ${title}`}
            onPressIn={() => {
              pressScale.value = withTiming(0.96, { duration: 120, easing: Easing.out(Easing.quad) })
            }}
            onPressOut={() => {
              pressScale.value = withSpring(1, { damping: 14, stiffness: 240, mass: 0.7 })
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            {headContent}
          </Pressable>
        </Animated.View>
      ) : (
        headContent
      )}

      {deck ? (
        <Frau
          italic
          size={13}
          lineHeight={19}
          color={c.ink2}
          style={styles.deck}
        >
          {deck}
        </Frau>
      ) : null}

      {/* Round 6 polish · hr opacity 0.12 → 0.08 · linha ainda mais sussurrada.
          Era visível como linha cinza nítida em dark mode; agora respira como
          marca de tinta seca quase apagada · fechamento canon manuscript. */}
      <View
        style={[
          styles.hr,
          { backgroundColor: c.ink, opacity: 0.08, marginTop: deck ? 14 : 18 },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  // Cadência vertical da home · 28px = 1 ritmo editorial canônico.
  //   marginTop: 28 — respiro entre o último bloco da seção anterior e o
  //   numeral romano da próxima. Antes 14, espaço pequeno demais; sentia
  //   que a próxima seção colava no fim da anterior.
  //   marginBottom: 28 — respiro entre a hr-section e o primeiro bloco da
  //   seção (estado, TOC, tecido). Antes 30; ajustado pra 28 manter
  //   ritmo uniforme com todos os outros gaps verticais da home.
  wrap: {
    marginTop: 28,
    marginBottom: 28,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  numeral: {
    minWidth: 22,
  },
  title: {
    flex: 1,
  },
  // deck/hr no trilho interno x=64..329 (marginLeft 32 + marginRight 32).
  // Simetria com os blocos da agenda/TOC abaixo: o hairline da seção termina
  // exatamente onde os values do TOC terminam, formando um único trilho
  // direito coerente.
  deck: {
    marginTop: 4,
    marginLeft: 32,
    marginRight: 32,
  },
  hr: {
    height: 1,
    marginLeft: 32,
    marginRight: 32,
  },
})
