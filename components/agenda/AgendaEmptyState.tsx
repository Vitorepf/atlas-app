import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { PressableTextScale } from '../atlas-ui/PressableScale'

interface Props {
  /** Eyebrow mono caps small bronze (opcional · contexto operacional). */
  eyebrow?: string
  /** Statement Frau italic 17 ink — frase imperativa ou afirmativa curta. */
  statement: string
  /** Prosa explicativa Frau italic 14 ink2 (opcional). */
  prose?: string
  /** Action editorial · link mono caps bronze com underline 1.5px. */
  action?: { label: string; onPress: () => void }
  /** Loading da action · disabled state com peso menor. */
  loading?: boolean
}

// Empty state editorial canônico · vocabulário "Mobile Gateway desconectado".
// Substitui empty states genéricos por estrutura rica:
//   eyebrow mono caps · contexto operacional
//   statement Frau italic 19 · frase principal (Atlas DNA)
//   prose Frau italic 14 · explicação curta
//   action mono caps bronze · link editorial (nunca botão pill SaaS)
//
// Round agenda polish · ação ganhou PressableTextScale + haptic Light
// (commit) + spring scale. Underline bronze 1.5px mantido como selo.
export function AgendaEmptyState({ eyebrow, statement, prose, action, loading = false }: Props) {
  const c = usePalette()
  return (
    <View style={styles.wrap}>
      {eyebrow ? (
        <Mono
          size={10}
          lineHeight={14}
          letterSpacing={1.6}
          color={c.bronze}
          weight="med"
          style={styles.eyebrow}
        >
          {eyebrow.toUpperCase()}
        </Mono>
      ) : null}
      <Frau italic size={19} lineHeight={26} letterSpacing={-0.3} color={c.ink} style={styles.statement}>
        {statement}
      </Frau>
      {prose ? (
        <Frau italic size={14} lineHeight={22} color={c.ink2} style={styles.prose}>
          {prose}
        </Frau>
      ) : null}
      {action ? (
        <View style={styles.actionWrap}>
          <PressableTextScale
            onPress={loading ? () => {} : action.onPress}
            disabled={loading}
            haptic="light"
            accessibilityLabel={action.label}
          >
            <Mono
              size={11}
              lineHeight={14}
              letterSpacing={1.6}
              color={c.bronze}
              weight="med"
              style={[styles.actionLabel, { borderBottomColor: c.bronze, opacity: loading ? 0.45 : 1 }]}
            >
              {action.label.toUpperCase()}
            </Mono>
          </PressableTextScale>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 32,
    marginTop: 4,
    marginBottom: 12,
  },
  eyebrow: {
    marginBottom: 8,
  },
  statement: {
    marginBottom: 14,
  },
  prose: {
    marginBottom: 22,
  },
  actionWrap: {
    alignSelf: 'flex-start',
  },
  actionLabel: {
    borderBottomWidth: 1.5,
    paddingBottom: 3,
  },
})
