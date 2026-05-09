import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
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

  const content = (
    <View style={[styles.row, isLast && styles.rowLast, style]}>
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
      <Pressable
        onPress={onPress}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${label} — ${subtitle}` : label}
        accessibilityState={{ selected: active, disabled }}
        style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
      >
        {content}
      </Pressable>
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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26,22,18,0.06)',
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
