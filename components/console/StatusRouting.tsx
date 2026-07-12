import { Pressable, StyleSheet, View } from 'react-native'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'
import {
  atlasTaskAllowedForMode,
  defaultTaskForMode as atlasDefaultTaskForMode,
} from '../../lib/atlasAi/contract'
import type {
  AtlasAiMode,
  AtlasAiTask,
} from '../../lib/atlasAi/types'

export type RoutingTask = AtlasAiTask
export const ROUTING_DOMAIN_OPTIONS = [
  { key: 'auto',          label: 'Auto',    word: 'auto' },
  { key: 'atlas',         label: 'Atlas',   word: 'atlas' },
  { key: 'vault-curador', label: 'Vault',   word: 'vault' },
  { key: 'saude',         label: 'Saúde',   word: 'saúde' },
  { key: 'blackink',      label: 'BlackInk', word: 'blackink' },
  { key: 'financas',      label: 'Finanças', word: 'finanças' },
] as const
export type RoutingDomain = (typeof ROUTING_DOMAIN_OPTIONS)[number]['key']
export type RoutingExecutor = 'auto' | 'hermes_cli' | 'minimax_m27_cli' | 'claude_cli' | 'codex_cli' | 'gemini_cli' | 'claude_codex'
export type RoutingStyle = 'clear' | 'brief' | 'technical' | 'complete'
export type RoutingMode = AtlasAiMode

export interface RoutingState {
  mode: RoutingMode
  task: RoutingTask
  domain: RoutingDomain
  executor: RoutingExecutor
  style: RoutingStyle
}

export const ROUTING_DEFAULT: RoutingState = {
  mode: 'auto',
  task: 'auto',
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
  const mode = isRoutingMode(state.mode) ? state.mode : legacyModeForTask(state.task, state.domain)
  const task = taskAllowedForMode(state.task, mode) ? state.task : defaultTaskForMode(mode)
  const domain = routingDomainAllowedForMode(state.domain, mode) ? state.domain : 'auto'
  const executor = isRoutingExecutor(state.executor) ? state.executor : 'auto'
  const style = isRoutingStyle(state.style) ? state.style : 'clear'
  const next = { ...state, mode, task, domain, executor, style }

  return routingExecutorAllowedForTask(next.executor, next.task)
    ? next
    : { ...next, executor: 'auto' }
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
  const modeClause = safeState.mode === 'general' ? '' : ` · ${modeWord(safeState.mode)}`
  return `${subject}${taskClause}${domainClause}${modeClause}${styleClause}`
}

export function isRoutingDomainKey(value: unknown): value is RoutingDomain {
  return typeof value === 'string'
    && ROUTING_DOMAIN_OPTIONS.some((option) => option.key === value)
}

export function routingDomainAllowedForMode(domain: RoutingDomain, mode: RoutingMode): boolean {
  if (domain === 'auto') return true
  if (mode === 'auto' || mode === 'conversation' || mode === 'general') return domain !== 'atlas'
  return true
}

function executorVerb(executor: RoutingExecutor): string {
  switch (executor) {
    case 'hermes_cli':   return 'hermes executa'
    case 'minimax_m27_cli': return 'minimax responde'
    case 'claude_cli':   return 'claude pensa'
    case 'codex_cli':    return 'codex pensa'
    case 'gemini_cli':   return 'gemini analisa'
    case 'claude_codex': return 'conselho responde'
    default:             return 'atlas decide'
  }
}

function taskWord(task: RoutingTask): string {
  if (task === 'auto')   return 'decidir'
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

function modeWord(mode: RoutingMode): string {
  if (mode === 'auto') return 'auto'
  switch (mode) {
    case 'operational': return 'operacional'
    case 'programming': return 'programação'
    case 'conversation': return 'conversa'
    case 'research': return 'pesquisa'
    case 'finance': return 'finanças'
    case 'marketing': return 'marketing'
    case 'strategy': return 'estratégia'
    case 'personal_development': return 'pessoal'
    case 'cyber': return 'cyber'
    case 'automation': return 'automação'
    default:            return 'geral'
  }
}

function isRoutingMode(value: unknown): value is RoutingMode {
  return value === 'auto'
    || value === 'general'
    || value === 'conversation'
    || value === 'operational'
    || value === 'programming'
    || value === 'research'
    || value === 'finance'
    || value === 'marketing'
    || value === 'strategy'
    || value === 'personal_development'
    || value === 'cyber'
    || value === 'automation'
}

function isRoutingExecutor(value: unknown): value is RoutingExecutor {
  return value === 'auto' || value === 'hermes_cli' || value === 'minimax_m27_cli' || value === 'claude_cli' || value === 'codex_cli' || value === 'gemini_cli' || value === 'claude_codex'
}

function isRoutingStyle(value: unknown): value is RoutingStyle {
  return value === 'clear' || value === 'brief' || value === 'technical' || value === 'complete'
}

function taskAllowedForMode(task: RoutingTask, mode: RoutingMode): boolean {
  return atlasTaskAllowedForMode(task, mode)
}

function defaultTaskForMode(mode: RoutingMode): RoutingTask {
  return atlasDefaultTaskForMode(mode)
}

function legacyModeForTask(task: RoutingTask, domain: RoutingDomain): RoutingMode {
  if (task === 'auto') return 'auto'
  if (task === 'dev' || task === 'debug') return 'programming'
  if (domain === 'atlas' && (task === 'review' || task === 'plan')) return 'operational'
  return 'auto'
}

function isOverridden(state: RoutingState): boolean {
  return (
    state.mode !== 'auto'
    || state.task !== 'auto'
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
