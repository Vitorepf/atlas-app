import { Pressable, StyleSheet, View } from 'react-native'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'

export type RoutingTask = 'direct' | 'plan' | 'review' | 'dev' | 'debug'
export type RoutingDomain = 'auto' | 'vault-curador' | 'saude' | 'blackink' | 'financas'
export type RoutingExecutor = 'auto' | 'claude_cli' | 'codex_cli' | 'claude_codex'
export type RoutingStyle = 'clear' | 'brief' | 'technical' | 'complete'

export interface RoutingState {
  task: RoutingTask
  domain: RoutingDomain
  executor: RoutingExecutor
  style: RoutingStyle
}

export const ROUTING_DEFAULT: RoutingState = {
  task: 'direct',
  domain: 'auto',
  executor: 'auto',
  style: 'clear',
}

interface Props {
  state: RoutingState
  onPress: () => void
}

// The editorial routing line. A single sentence in Fraunces italic just above
// the input. Reads in prose: "codex pensa em planejar para blackink · trocar".
// Tap anywhere opens the routing sheet. Always present, never dominant.
// Substitutes the panel of stacked chips that violated luxo silencioso.
export function StatusRouting({ state, onPress }: Props) {
  const c = usePalette()
  const overridden = isOverridden(state)
  const opacity = overridden ? 0.55 : 0.4

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`rota atual: ${routingPhrase(state)}. tocar para trocar.`}
      style={({ pressed }) => [
        styles.row,
        { opacity: pressed ? 0.65 : 1 },
      ]}
    >
      <View style={styles.line}>
        <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity }}>
          {routingPhrase(state)}
        </Frau>
        <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity: opacity * 0.7, marginLeft: 8 }}>
          · trocar
        </Frau>
      </View>
    </Pressable>
  )
}

// "codex pensa em planejar para blackink"
// Defaults gracefully when any dimension is auto.
export function routingPhrase(state: RoutingState): string {
  const subject = executorVerb(state.executor)
  const taskClause = state.task === 'direct' ? '' : ` em ${taskWord(state.task)}`
  const domainClause = state.domain === 'auto' ? '' : ` para ${domainWord(state.domain)}`
  const styleClause = state.style === 'clear' ? ' · claro' : ` · ${styleWord(state.style)}`
  return `${subject}${taskClause}${domainClause}${styleClause}`
}

function executorVerb(executor: RoutingExecutor): string {
  switch (executor) {
    case 'claude_cli':   return 'claude pensa'
    case 'codex_cli':    return 'codex pensa'
    case 'claude_codex': return 'conselho responde'
    default:             return 'atlas decide'
  }
}

function taskWord(task: RoutingTask): string {
  if (task === 'dev')    return 'desenvolver'
  if (task === 'debug')  return 'debugar'
  if (task === 'plan')   return 'planejar'
  if (task === 'review') return 'revisar'
  return 'responder'
}

function domainWord(domain: RoutingDomain): string {
  switch (domain) {
    case 'vault-curador': return 'vault'
    case 'saude':         return 'saúde'
    case 'blackink':      return 'blackink'
    case 'financas':      return 'finanças'
    default:              return 'auto'
  }
}

function styleWord(style: RoutingStyle): string {
  switch (style) {
    case 'brief':     return 'curto'
    case 'technical': return 'técnico'
    case 'complete':  return 'completo'
    default:          return 'claro'
  }
}

function isOverridden(state: RoutingState): boolean {
  return (
    state.task !== 'direct'
    || state.domain !== 'auto'
    || state.executor !== 'auto'
    || state.style !== 'clear'
  )
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 10,
    minHeight: 36,
    justifyContent: 'center',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
})
