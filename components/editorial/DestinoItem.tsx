import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'

interface Props {
  /**
   * Glyph editorial à esquerda · default `·` (separator/inativo) · `✦`
   * (signature Atlas em ato cognitivo · ativo) · `—` (em-dash, vocabulário
   * "se desdobra em") · `⊙ ◆ ✜ ▲` (identidade de domain). Override quando
   * precisa de signature específico, senão `active` controla ✦/·.
   */
  glyph?: string
  /** Label principal · Frau medium 17, peso de "ato editorial". */
  label: string
  /** Subtitle italic Frau 13 · descrição em-dash · sussurro. Opcional. */
  subtitle?: string
  /**
   * Estado ativo · quando true, glyph default vira ✦ bronze italic e label
   * mantém peso medium (canon: ✦ é "Atlas presente em ato cognitivo").
   * Se `glyph` for fornecido explicitamente, sobrepõe esse default.
   */
  active?: boolean
  /** Tap callback · vira Pressable. */
  onPress?: () => void
  /** Disabled state · opacity 0.4, ignora onPress. */
  disabled?: boolean
  /**
   * Último item de uma section/list · sem border-bottom · canon mockup
   * `.destino-item:last-child { border-bottom: none }`. Evita linha dupla
   * com a hairline da próxima SectionHead ou separador externo.
   */
  isLast?: boolean
  /** Override container style (margin/padding custom). */
  style?: StyleProp<ViewStyle>
}

// DestinoItem · vocabulário canon "destino-list" do mockup atlas-home-editorial.
// Layout: [glyph 24px center] [label upright + subtitle italic] vertical.
// Ativo = ✦ bronze italic. Inativo = · ink2.
//
// Reusado em:
//   · DomainSheet · ii. O que fazer? (Conversar/Estruturar tarefa/etc)
//   · AtlasDecideSheet · todas as 5 sections (modo, tarefa, domínio, executor, forma)
//   · ContinuityPanel · ii. Operações (Compactar/Contexto/Mapa/Buscar/Fila/Skills)
//   · TriageOverflowSheet · 8 ações editoriais
//
// Trilho interno · marginLeft/Right 32 (canon Atlas: trilho 64..329 simétrico).
// Hairline-bottom 6% ink · separa items dentro de uma section, sutil.
// Last-item sem hairline-bottom · controlado externamente via wrapper se necessário.
export function DestinoItem({
  glyph,
  label,
  subtitle,
  active = false,
  onPress,
  disabled = false,
  isLast = false,
  style,
}: Props) {
  const c = usePalette()
  const effectiveGlyph = glyph ?? (active ? '✦' : '·')
  const isAtlas = effectiveGlyph === '✦'

  // Slice 6ab · canon premium haptic + press scale spring
  const pressScale = useSharedValue(1)
  const pressAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }))
  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
    onPress?.()
  }

  const content = (
    // Slice 6ab · borderBottom usa c.border token (era rgba hardcoded warm
    // ink @ 6% que sumia em dark mode). Token resolve cream alpha em dark,
    // ink alpha em light · canon ambos modos.
    <View style={[styles.row, { borderBottomColor: c.border }, isLast && styles.rowLast, style]}>
      <Frau
        italic={isAtlas}
        size={18}
        lineHeight={24}
        color={isAtlas ? c.bronze : c.ink2}
        style={styles.glyph}
      >
        {effectiveGlyph}
      </Frau>
      <View style={styles.text}>
        <Frau weight="med" size={17} lineHeight={22} color={c.ink} letterSpacing={-0.05}>
          {label}
        </Frau>
        {subtitle ? (
          <Frau italic size={13} lineHeight={19} color={c.ink2} style={styles.subtitle}>
            {subtitle}
          </Frau>
        ) : null}
      </View>
    </View>
  )

  if (onPress && !disabled) {
    return (
      <Animated.View style={pressAnimStyle}>
        <Pressable
          onPress={handlePress}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={subtitle ? `${label} — ${subtitle}` : label}
          accessibilityState={{ selected: active, disabled }}
          onPressIn={() => {
            pressScale.value = withTiming(0.98, { duration: 120, easing: Easing.out(Easing.quad) })
          }}
          onPressOut={() => {
            pressScale.value = withSpring(1, { damping: 14, stiffness: 240, mass: 0.7 })
          }}
          style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
        >
          {content}
        </Pressable>
      </Animated.View>
    )
  }

  return <View style={disabled ? styles.disabled : undefined}>{content}</View>
}

const styles = StyleSheet.create({
  // Trilho interno canon · marginLeft/Right 32 (combinado com Screen
  // paddingHorizontal 32, items caem em x=64..329 com simetria perfeita).
  // paddingVertical 12 + hairline-bottom 6% ink · separação sutil entre items
  // dentro de uma destino-list. Vocabulário canon mockup: items respiram,
  // não colam um no outro, mas hairline é whisper, não régua.
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 12,
    marginLeft: 32,
    marginRight: 32,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor agora vem inline via c.border (Slice 6ab)
  },
  // Último item de uma section · canon mockup `:last-child { border-bottom: none }`.
  // Sem hairline-bottom evita linha dupla quando próxima SectionHead vier abaixo.
  rowLast: {
    borderBottomWidth: 0,
  },
  // Glyph 24px de largura fixa · alinhamento vertical com o label (não com a
  // baseline do bloco label+subtitle, mas sim com o label superior). Isso faz
  // ✦ ficar alinhado à primeira linha da label, vocabulário "marca de margem".
  glyph: {
    width: 24,
    textAlign: 'center',
  },
  text: {
    flex: 1,
  },
  subtitle: {
    marginTop: 4,
    letterSpacing: 0,
  },
  disabled: {
    opacity: 0.4,
  },
})
