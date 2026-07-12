import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { BottomSheet } from './BottomSheet'
import { DestinoItem, SectionHead } from '../editorial'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import {
  ROUTING_DOMAIN_OPTIONS,
  ROUTING_DEFAULT,
  routingDomainAllowedForMode,
  routingExecutorAllowedForTask,
  sanitizeRoutingState,
  type RoutingExecutor,
  type RoutingMode,
  type RoutingState,
  type RoutingStyle,
  type RoutingTask,
} from '../console/StatusRouting'

interface Props {
  visible: boolean
  initial: RoutingState
  onClose: () => void
  onConfirm: (next: RoutingState) => void
}

// =============================================================================
// AtlasDecideSheet · canon mockup (atlas-home-editorial-mockup.html linha ~4629)
// =============================================================================
//
// Substitui RoutingSheet (que misturava vocabulário SaaS com pílulas azuis em
// "tarefa" e "domínio") pela versão editorial unificada do mockup canônico.
// 5 sections numeradas (i-v), todas usando destino-list vertical (glyph + label
// + subtitle italic).
//
// Acessado via tap em "atlas decide · trocar" no StatusRouting do Atlas AI Sheet.
// BottomSheet height 85% (canon), header eyebrow + title interrogativo + hr,
// status TOC com leader dotted mostrando estado atual, footer cancelar/confirmar
// com hairline-top + cell vertical bronze, reset link inline italic.
//
// Lógica funcional 100% preservada do RoutingSheet:
//   · sanitizeRoutingState valida transições mode→task→domain→executor→style
//   · applyAtlasMode faz cascading defaults quando mode muda
//   · routingExecutorAllowedForTask filtra executores
//   · routingDomainAllowedForMode filtra domínios
//   · dirty flag habilita Confirmar (ink2 → bronze quando há mudança)
//   · Reset volta pra ROUTING_DEFAULT (auto/auto · atlas decide)
// =============================================================================

const MODES: Array<{ key: RoutingMode; label: string; subtitle: string }> = [
  { key: 'auto',        label: 'Auto',        subtitle: 'Hyperflow decide domínio, flow e runtime pelo contexto' },
  { key: 'general',     label: 'Geral',       subtitle: 'conversa, ideias, pesquisa e organização' },
  { key: 'conversation', label: 'Conversa',   subtitle: 'troca livre, sem domínio técnico forçado' },
  { key: 'operational', label: 'Operacional', subtitle: 'diagnóstico, evidências, riscos e próximas ações' },
  { key: 'programming', label: 'Programação', subtitle: 'código, testes, automação, scripts e harness' },
  { key: 'research',    label: 'Pesquisa',    subtitle: 'investigação técnica, mercado, papers e fontes' },
  { key: 'finance',     label: 'Finanças',    subtitle: 'carteira, empresas, risco e decisão financeira' },
  { key: 'marketing',   label: 'Marketing',   subtitle: 'campanha, copy, analytics e marca' },
  { key: 'strategy',    label: 'Estratégia',  subtitle: 'prioridade, trade-off, decisão e operação' },
  { key: 'personal_development', label: 'Pessoal', subtitle: 'metas, hábitos, rotina e cognição' },
  { key: 'cyber',       label: 'Cyber',       subtitle: 'segurança defensiva, auditoria e resposta' },
  { key: 'automation',  label: 'Automação',   subtitle: 'workflow, integração, script e pipeline' },
]

const TASKS: Array<{ key: RoutingTask; label: string; subtitle: string; modes: RoutingMode[] }> = [
  { key: 'auto',   label: 'Auto',      subtitle: 'Hyperflow escolhe o task correto', modes: ['auto'] },
  { key: 'direct', label: 'Responder', subtitle: 'resolver a pergunta atual', modes: ['general', 'conversation', 'operational', 'research', 'finance', 'marketing', 'strategy', 'personal_development', 'cyber', 'automation'] },
  { key: 'plan',   label: 'Planejar',  subtitle: 'desenhar plano de execução antes de agir', modes: ['general', 'conversation', 'operational', 'programming', 'research', 'finance', 'marketing', 'strategy', 'personal_development', 'cyber', 'automation'] },
  { key: 'review', label: 'Revisar',   subtitle: 'reler, criticar e propor reescrita', modes: ['general', 'conversation', 'operational', 'programming', 'research', 'finance', 'marketing', 'strategy', 'personal_development', 'cyber', 'automation'] },
  { key: 'dev',    label: 'Dev',       subtitle: 'implementar feature ou refator', modes: ['programming'] },
  { key: 'debug',  label: 'Debug',     subtitle: 'investigar bug e propor fix', modes: ['programming'] },
]

const EXECUTORS: Array<{ key: RoutingExecutor; label: string; subtitle: string }> = [
  { key: 'auto',            label: 'Atlas decide', subtitle: 'Hermes por padrão quando fizer sentido' },
  { key: 'hermes_cli',      label: 'Hermes',       subtitle: 'runtime executivo com tools, skills e modelo interno' },
  { key: 'minimax_m27_cli', label: 'MiniMax M3',   subtitle: 'modelo direto e independente no ATLS' },
  { key: 'codex_cli',       label: 'Codex',        subtitle: 'engenharia e estrutura' },
  { key: 'claude_cli',      label: 'Claude',       subtitle: 'julgamento e arquitetura manual' },
]

const STYLES: Array<{ key: RoutingStyle; label: string; subtitle: string }> = [
  { key: 'clear',     label: 'Claro',    subtitle: 'simples, sem código por padrão' },
  { key: 'brief',     label: 'Curto',    subtitle: 'mínimo útil' },
  { key: 'technical', label: 'Técnico',  subtitle: 'com detalhes quando precisar' },
  { key: 'complete',  label: 'Completo', subtitle: 'mais contexto e critérios' },
]

export function AtlasDecideSheet({ visible, initial, onClose, onConfirm }: Props) {
  const c = usePalette()
  const [draft, setDraft] = useState<RoutingState>(sanitizeRoutingState(initial))

  // Re-hidrata o draft toda vez que o sheet abre · garantia de que `initial`
  // (que pode ter sido alterado externamente) entra como ponto de partida.
  useEffect(() => {
    if (visible) setDraft(sanitizeRoutingState(initial))
  }, [visible, initial])

  const dirty = useMemo(
    () => !sameRouting(draft, sanitizeRoutingState(initial)),
    [draft, initial],
  )

  // Filtros canon · derivam das transições válidas (mode → task → domain → executor).
  const taskOptions = useMemo(
    () => TASKS.filter((option) => option.modes.includes(draft.mode)),
    [draft.mode],
  )
  const domainOptions = useMemo(
    () => ROUTING_DOMAIN_OPTIONS.filter((option) => routingDomainAllowedForMode(option.key, draft.mode)),
    [draft.mode],
  )

  // v18 · Auto-save on close · canon Atlas radical. Vocabulário: "se você
  // tocou na opção, é porque quer · não há fricção de Confirmar". Quando user
  // fecha (drag down, tap fora, gesture nativo do BottomSheet), o draft é
  // automaticamente confirmado. Don Corleone: tocou = ato. Sem botão Confirmar.
  const handleClose = () => {
    if (dirty) {
      onConfirm(sanitizeRoutingState(draft))
    }
    onClose()
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose} height="85%">
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header editorial · eyebrow mono caps + title interrogativo Frau italic 22 + hr.
            Canon mockup: "CONFIGURAÇÃO DA SESSÃO" / "Como Atlas deve responder?". */}
        <View style={styles.headerWrap}>
          <Mono size={11} lineHeight={14} letterSpacing={1.6} color={c.ink2} style={styles.eyebrow}>
            CONFIGURAÇÃO DA SESSÃO
          </Mono>
          <Frau italic size={22} lineHeight={29} color={c.ink} letterSpacing={-0.18}>
            Como Atlas deve responder?
          </Frau>
        </View>
        <View style={[styles.hrSection, { backgroundColor: `${c.ink}1F` }]} />

        {/* Status TOC · estado atual da sessão · mono caps + leader dotted +
            value italic Frau bronze. Frase canon mockup: "modo {X} · {executor}"
            (ex.: "modo geral · atlas decide"). Mostra modo + executor mesmo
            no default state — clareza editorial sobre o que está ativo. */}
        <View style={styles.statusToc}>
          <Mono size={11} lineHeight={16} letterSpacing={1.3} color={c.ink2}>
            ESTADO
          </Mono>
          <View style={[styles.statusLeader, { borderBottomColor: `${c.ink}38` }]} />
          <Frau italic size={14} lineHeight={19} color={c.bronzeDeep}>
            {`modo ${decideModeWord(draft.mode)} · ${decideExecutorWord(draft.executor)}`}
          </Frau>
        </View>

        {/* i. MODO · 3 opções */}
        <View style={styles.section}>
          <SectionHead numeral="i" title="Modo" />
          {MODES.map((option, idx) => (
            <DestinoItem
              key={option.key}
              label={option.label}
              subtitle={option.subtitle}
              active={draft.mode === option.key}
              isLast={idx === MODES.length - 1}
              onPress={() => setDraft((d) => applyAtlasMode(d, option.key))}
            />
          ))}
        </View>

        {/* ii. TAREFA · filtrada pelo modo ativo */}
        <View style={styles.section}>
          <SectionHead numeral="ii" title="Tarefa" />
          {taskOptions.map((option, idx) => (
            <DestinoItem
              key={option.key}
              label={option.label}
              subtitle={option.subtitle}
              active={draft.task === option.key}
              isLast={idx === taskOptions.length - 1}
              onPress={() => setDraft((d) => sanitizeRoutingState({ ...d, task: option.key }))}
            />
          ))}
        </View>

        {/* iii. DOMÍNIO · filtrado pelo modo ativo */}
        <View style={styles.section}>
          <SectionHead numeral="iii" title="Domínio" />
          {domainOptions.map((option, idx) => (
            <DestinoItem
              key={option.key}
              label={option.label}
              subtitle={domainSubtitleFor(option.key)}
              active={draft.domain === option.key}
              isLast={idx === domainOptions.length - 1}
              onPress={() => setDraft((d) => ({ ...d, domain: option.key }))}
            />
          ))}
        </View>

        {/* iv. EXECUTOR · filtrado pela tarefa ativa */}
        <View style={styles.section}>
          <SectionHead numeral="iv" title="Executor" />
          {EXECUTORS.map((option, idx) => {
            const disabled = !routingExecutorAllowedForTask(option.key, draft.task)
            return (
              <DestinoItem
                key={option.key}
                label={option.label}
                subtitle={option.subtitle}
                active={draft.executor === option.key}
                disabled={disabled}
                isLast={idx === EXECUTORS.length - 1}
                onPress={
                  disabled
                    ? undefined
                    : () => setDraft((d) => sanitizeRoutingState({ ...d, executor: option.key }))
                }
              />
            )
          })}
        </View>

        {/* v. FORMA · 4 opções */}
        <View style={styles.section}>
          <SectionHead numeral="v" title="Forma" />
          {STYLES.map((option, idx) => (
            <DestinoItem
              key={option.key}
              label={option.label}
              subtitle={option.subtitle}
              active={draft.style === option.key}
              isLast={idx === STYLES.length - 1}
              onPress={() => setDraft((d) => ({ ...d, style: option.key }))}
            />
          ))}
        </View>

        {/* Footer editorial · canon Atlas radical · sem Cancelar/Confirmar.
            Auto-save on close: tocou em opção = ato. Fechar (drag down/tap
            fora) = aceito. Single link "resetar" sticky · escape pra default
            quando user quer voltar pro estado limpo. Vocabulário Don Corleone:
            "você quis, está feito · sem fricção, sem ritual de confirmação". */}
        <View style={[styles.footerRule, { backgroundColor: `${c.ink}1F` }]} />

        {/* Reset link · italic 13 ink3 com "resetar" inline bronze. Vocabulário:
            volta a "atlas decide" (estado default · ROUTING_DEFAULT). */}
        <Pressable
          onPress={() => setDraft(ROUTING_DEFAULT)}
          hitSlop={6}
          style={({ pressed }) => [styles.resetWrap, { opacity: pressed ? 0.55 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="resetar para atlas decide"
        >
          <Frau italic size={13} lineHeight={19} color={c.ink3}>
            voltar a “atlas decide” ·{' '}
            <Frau italic size={13} lineHeight={19} color={c.bronze}>
              resetar
            </Frau>
          </Frau>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  )
}

// =============================================================================
// Lógica funcional preservada do RoutingSheet original
// =============================================================================

// applyAtlasMode · cascading defaults quando user troca de modo. Modo pode
// ajustar task/domain/style, mas a escolha manual de executor é soberana:
// Hermes, MiniMax M3, Codex e Claude não viram detalhe um do outro.
function applyAtlasMode(state: RoutingState, mode: RoutingMode): RoutingState {
  if (mode === 'auto') {
    return sanitizeRoutingState({
      ...ROUTING_DEFAULT,
      executor: state.executor,
      style: state.style,
    })
  }

  if (mode === 'programming') {
    return sanitizeRoutingState({
      ...state,
      mode,
      task: state.task === 'debug' ? 'debug' : 'dev',
      domain: 'atlas',
      executor: state.executor,
      style: 'technical',
    })
  }

  if (mode === 'operational') {
    return sanitizeRoutingState({
      ...state,
      mode,
      task: 'review',
      domain: 'atlas',
      executor: state.executor,
      style: 'complete',
    })
  }

  return sanitizeRoutingState({
    ...ROUTING_DEFAULT,
    mode,
    task: mode === 'conversation' || mode === 'general' ? 'direct' : 'plan',
    executor: state.executor,
  })
}

// sameRouting · comparação shallow das 5 dimensões pra detectar dirty state.
function sameRouting(a: RoutingState, b: RoutingState): boolean {
  return (
    a.mode === b.mode
    && a.task === b.task
    && a.domain === b.domain
    && a.executor === b.executor
    && a.style === b.style
  )
}

// decideModeWord · vocabulário canon Atlas pro Status TOC do AtlasDecideSheet.
// Diferente do modeWord interno do StatusRouting (que retorna 'geral' /
// 'operacional' / 'programação'), aqui mantemos a mesma lista mas exposta
// localmente pra evitar dependência circular com console/StatusRouting.
function decideModeWord(mode: RoutingMode): string {
  switch (mode) {
    case 'auto': return 'auto'
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

// decideExecutorWord · nome do executor sem o verbo (vocabulário Status TOC
// canon). Diferente de executorVerb que retorna "claude pensa", aqui é
// "claude" puro · combinado com "modo X" forma "modo geral · atlas decide".
function decideExecutorWord(executor: RoutingExecutor): string {
  switch (executor) {
    case 'hermes_cli':   return 'hermes'
    case 'minimax_m27_cli': return 'minimax m3'
    case 'claude_cli':   return 'claude'
    case 'codex_cli':    return 'codex'
    case 'gemini_cli':   return 'gemini'
    case 'claude_codex': return 'conselho'
    default:             return 'atlas decide'
  }
}

// Subtitle pra cada domain · vocabulário canon Atlas. Não vem de
// ROUTING_DOMAIN_OPTIONS (que tem só key/label/word) porque o subtitle é
// vocabulário editorial pra UI, não dado de routing. Centralizar aqui evita
// poluir StatusRouting.tsx com vocabulário de UI.
function domainSubtitleFor(domain: string): string {
  switch (domain) {
    case 'auto':          return 'Atlas escolhe pelo conteúdo'
    case 'vault-curador': return 'segredos, segurança, infra'
    case 'saude':         return 'corpo, sono, treino, alimentação'
    case 'blackink':      return 'escrita, ensaios, conteúdo'
    case 'financas':      return 'dinheiro, transações, planejamento'
    case 'atlas':         return 'sistema operacional pessoal'
    default:              return ''
  }
}

const styles = StyleSheet.create({
  // paddingHorizontal 12 dá respiro lateral simétrico pra numerais romanos
  // hangin sem encostar na borda do BottomSheet · canon mockup mostra "i."
  // com ~12pt de margem visual da borda esquerda. Como SectionHead numeral
  // fica em x=0 do parent, o paddingLeft do scroll é a forma de empurrar
  // tudo sem mexer no SectionHead (shared com app/edicao.tsx onde Screen
  // já tem paddingHorizontal 32). Right idem pra simetria · não cortar
  // hairlines/conteúdo na borda direita.
  scroll: {
    paddingBottom: 32,
    paddingHorizontal: 12,
  },
  // Header editorial wrapper · trilho interno 32 (canon mockup).
  // marginBottom 0 — hr-section abaixo encosta sem gap.
  headerWrap: {
    marginLeft: 32,
    marginRight: 32,
    marginTop: 8,
    marginBottom: 14,
  },
  eyebrow: {
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  // hr-section · canon mockup .hr-section · 1px ink @ 12% opacity.
  hrSection: {
    height: 1,
    marginLeft: 32,
    marginRight: 32,
  },
  // Status TOC · canon mockup .atlas-config-status · padding interno 32 +
  // marginTop/Bottom 22/28 (cadência editorial).
  statusToc: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginLeft: 32,
    marginRight: 32,
    marginTop: 22,
    marginBottom: 28,
  },
  // Leader dotted · canon mockup · 1.5px dotted ink @ 22% opacity.
  // Em React Native, borderStyle 'dotted' funciona com width fixa controlada.
  statusLeader: {
    flex: 1,
    height: 0,
    borderBottomWidth: 1,
    borderStyle: 'dotted',
    transform: [{ translateY: -3 }],
  },
  section: {
    marginBottom: 12,
  },
  // Footer rule · canon Atlas radical · hairline simples acima do reset link.
  // Substitui o footer Cancelar/Confirmar antigo (que ocupava ~80pt + risco
  // de user esquecer de descer pra confirmar). Auto-save on close resolveu
  // a fricção · resta só esse hairline + reset como "escape pra default".
  footerRule: {
    height: 1,
    marginHorizontal: 32,
    marginTop: 22,
  },
  // Reset wrap · canon mockup .atlas-config-reset · italic 13 ink3 + "resetar"
  // inline bronze. marginTop 14 dá respiração editorial entre hairline e link.
  resetWrap: {
    marginTop: 14,
    marginBottom: 22,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
})
