import { Pressable, StyleSheet, View } from 'react-native'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'

export type RoutingTask = 'direct' | 'plan' | 'review' | 'dev' | 'debug'
export const ROUTING_DOMAIN_OPTIONS = [
  { key: 'auto',          label: 'Auto',    word: 'auto' },
  { key: 'atlas',         label: 'Atlas',   word: 'atlas' },
  { key: 'vault-curador', label: 'Vault',   word: 'vault' },
  { key: 'saude',         label: 'Saúde',   word: 'saúde' },
  { key: 'blackink',      label: 'BlackInk', word: 'blackink' },
  { key: 'financas',      label: 'Finanças', word: 'finanças' },
] as const
export type RoutingDomain = (typeof ROUTING_DOMAIN_OPTIONS)[number]['key']
export type RoutingExecutor = 'auto' | 'claude_cli' | 'codex_cli' | 'gemini_cli' | 'claude_codex'
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

export function routingExecutorAllowedForTask(executor: RoutingExecutor, task: RoutingTask): boolean {
  void executor
  void task
  return true
}

export function sanitizeRoutingState(state: RoutingState): RoutingState {
  return routingExecutorAllowedForTask(state.executor, state.task)
    ? state
    : { ...state, executor: 'auto' }
}

interface Props {
  state: RoutingState
  onPress: () => void
  locked?: boolean
}

// The editorial routing line. A single sentence in Fraunces italic just above
// the input. Reads in prose: "codex pensa em planejar para blackink · trocar".
// Tap anywhere opens the routing sheet. Always present, never dominant.
// Substitutes the panel of stacked chips that violated luxo silencioso.
export function StatusRouting({ state, onPress, locked = false }: Props) {
  const c = usePalette()
  const overridden = isOverridden(state)
  const opacity = overridden ? 0.55 : 0.4
  const suffix = locked ? '· aguardando' : '· trocar'

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={
        locked
          ? `rota atual: ${routingPhrase(state)}. aguardando resposta atual.`
          : `rota atual: ${routingPhrase(state)}. tocar para trocar.`
      }
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
          {suffix}
        </Frau>
      </View>
    </Pressable>
  )
}

// "codex pensa em planejar para blackink"
// Defaults gracefully when any dimension is auto.
export function routingPhrase(state: RoutingState): string {
  const safeState = sanitizeRoutingState(state)
  const subject = executorVerb(safeState.executor)
  const taskClause = safeState.task === 'direct' ? '' : ` em ${taskWord(safeState.task)}`
  const domainClause = safeState.domain === 'auto' ? '' : ` para ${domainWord(safeState.domain)}`
  const styleClause = safeState.style === 'clear' ? '' : ` · ${styleWord(safeState.style)}`
  return `${subject}${taskClause}${domainClause}${styleClause}`
}

export function isRoutingDomainKey(value: unknown): value is RoutingDomain {
  return typeof value === 'string'
    && ROUTING_DOMAIN_OPTIONS.some((option) => option.key === value)
}

function executorVerb(executor: RoutingExecutor): string {
  switch (executor) {
    case 'claude_cli':   return 'claude pensa'
    case 'codex_cli':    return 'codex pensa'
    case 'gemini_cli':   return 'gemini analisa'
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
  return ROUTING_DOMAIN_OPTIONS.find((option) => option.key === domain)?.word ?? 'auto'
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
