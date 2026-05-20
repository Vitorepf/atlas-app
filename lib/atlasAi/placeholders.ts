/**
 * Atlas AI · Mobile · placeholders canon por mode.
 *
 * Porte fiel dos 12 placeholders de `atlas-desktop/apps/desktop/src/components/composer/AtlasUnifiedComposer.tsx:103-116`.
 * Composer renderiza o texto correspondente ao mode ativo.
 */
import type { AtlasAiMode } from './types'

export const MODE_PLACEHOLDER: Record<AtlasAiMode, string> = {
  auto: 'Escreva o que precisa — Atlas decide o caminho (pesquisa, código, finanças, campanha, estratégia, automação, conversa).',
  programming: 'Bug, debug, feature ou review — arrasta arquivo ou cola screenshot.',
  operational: 'Diagnóstico, próxima ação ou risco — cole contexto se útil.',
  research: 'Pesquisa técnica ou de mercado — descreva tema e profundidade.',
  finance: 'Análise financeira — cole números e a pergunta de decisão.',
  marketing: 'Campanha, copy ou métrica — público e objetivo.',
  strategy: 'Objetivo, prioridade, escolha — contexto e restrições.',
  personal_development: 'Meta, hábito ou plano semanal — objetivo e prazo.',
  cyber: 'Postura defensiva, auditoria ou resposta a incidente — escopo.',
  automation: 'Workflow, integração ou pipeline — entrada, gatilho, saída.',
  general: 'Pesquisa, ideia ou dúvida — solte arquivo ou cole conteúdo.',
  conversation: 'Conversa solta — pergunta ou ideia livre.',
}

export function placeholderForMode(mode: AtlasAiMode): string {
  return MODE_PLACEHOLDER[mode] ?? MODE_PLACEHOLDER.auto
}
