/**
 * SignatureGesture · gesto cerimonial Atlas · não é botão, é selo.
 *
 * Vocabulário canon herdado do saveCheckin "registrar." da home:
 *   – verbo imperativo + ponto final ("registrar.", "selar no calendário.",
 *     "selar bloco.")
 *   – Frau italic 17 bronzeDeep · italic carrega a voz editorial,
 *     bronzeDeep dá peso (canon "ato encerrado")
 *   – hairline 1px abaixo · prussian (commit interno · rima com checkin
 *     pills) ou bronze (selo externo · rima com agenda gold)
 *   – sem fundo · sem borda total · sem padding tipo button · só o
 *     traço sob a palavra · marca de tinta que sela o ato
 *
 * Press canon: scale 0.97 + opacity 0.62 + spring (via PressableTextScale).
 * Haptic Light por padrão (selar é commit, não escolha trivial).
 */
import { StyleSheet, View } from 'react-native'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { PressableTextScale } from '../atlas-ui/PressableScale'

type SealKind =
  /** Hairline prussian alpha 0.32 · ato de comprometer interno (checkin, tarefa) */
  | 'commit'
  /** Hairline bronze alpha 0.36 · ato de selar com mundo externo (calendário, bloco) */
  | 'external'

interface Props {
  label: string
  onPress: () => void
  disabled?: boolean
  /** Default 'commit' (hairline prussian). 'external' = hairline bronze pra
   *  atos que tocam sistema fora do Atlas (Calendar, bloco de tempo). */
  seal?: SealKind
  /** Haptic ao confirmar. Default 'light' · use 'medium' pra destrutivos. */
  haptic?: 'soft' | 'light' | 'medium'
  accessibilityLabel?: string
  accessibilityHint?: string
}

export function SignatureGesture({
  label,
  onPress,
  disabled = false,
  seal = 'commit',
  haptic = 'light',
  accessibilityLabel,
  accessibilityHint,
}: Props) {
  const c = usePalette()
  const sealColor = seal === 'external' ? c.bronzeSeal : c.prussianSeal

  return (
    <PressableTextScale
      onPress={onPress}
      disabled={disabled}
      haptic={haptic}
      hitSlop={10}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
    >
      <View style={[styles.seal, { borderBottomColor: sealColor }]}>
        <Frau italic size={17} lineHeight={24} color={c.bronzeDeep}>
          {label}
        </Frau>
      </View>
    </PressableTextScale>
  )
}

const styles = StyleSheet.create({
  // Selo · hairline-bottom + paddingBottom 4 (espaço entre baseline do
  // texto e a linha de selar) + paddingHorizontal 2 (a linha estende
  // micro além das letras · sensação de "sublinhado de tinta seca").
  seal: {
    alignSelf: 'flex-start',
    borderBottomWidth: 1,
    paddingBottom: 4,
    paddingHorizontal: 2,
  },
})
