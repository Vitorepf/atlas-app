import { Pressable, StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'

interface Props {
  /** Eyebrow mono caps small bronze (opcional · contexto operacional). */
  eyebrow?: string
  /** Statement Frau italic 17 ink — frase imperativa ou afirmativa curta. */
  statement: string
  /** Prosa explicativa Frau italic 14 ink2 (opcional). */
  prose?: string
  /** Action editorial · link mono caps bronze com underline 1.5px.
   *  Vocabulário canon: "PAREAR", "PLANEJAR DIA", "ABRIR INBOX". */
  action?: { label: string; onPress: () => void }
  /** Loading da action · disabled state com peso menor. */
  loading?: boolean
}

// Empty state editorial canônico · vocabulário "Mobile Gateway desconectado"
// do mockup. Substitui empty states genéricos ("Sem X.") por estrutura rica:
//   eyebrow mono caps · contexto operacional
//   statement Frau italic 19 · frase principal (Atlas DNA)
//   prose Frau italic 14 · explicação curta
//   action mono caps bronze · link editorial (nunca botão pill SaaS)
//
// Aplicado em todas as seções da Agenda quando há ausência de dados:
// AGORA sem próximo, RESTO DO DIA em silêncio, AMANHÃ vazio.
//
// Anti-pattern banido: botão pill colored com sombra. Atlas usa link
// underlined bronze · peso editorial não-SaaS.
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
        <Pressable
          onPress={loading ? undefined : action.onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{ disabled: loading }}
          style={({ pressed }) => [
            styles.actionWrap,
            { opacity: loading ? 0.45 : pressed ? 0.55 : 1 },
          ]}
        >
          <Mono
            size={11}
            lineHeight={14}
            letterSpacing={1.6}
            color={c.bronze}
            weight="med"
            style={[styles.actionLabel, { borderBottomColor: c.bronze }]}
          >
            {action.label.toUpperCase()}
          </Mono>
        </Pressable>
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
