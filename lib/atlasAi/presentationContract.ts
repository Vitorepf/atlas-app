/**
 * Atlas AI · Presentation Contract
 *
 * Separa **corpo principal humano/editorial** de **metadados técnicos** quando
 * a resposta vem do Hyperflow V2 / Specialist Flow Runtime.
 *
 * ## Porque existe
 *
 * O backend injeta `response_shape` no prompt do provider em snake_case inglês
 * (ex: `answer_summary`, `claims_table`, `source_refs`, `uncertainty`,
 * `open_questions`, `findings`, `assumptions`, etc.). Quando o modelo segue
 * literal, a resposta vaza esses identificadores como cabeçalhos crus no
 * `response_text` — quebra a apresentação editorial e expõe vocabulário
 * técnico interno ao operador.
 *
 * Este contrato é a **última linha de defesa do app** antes do
 * `EditorialMarkdown` renderizar:
 *
 *   1. Detecta cabeçalhos técnicos em snake_case (canônicos do Atlas).
 *   2. Renomeia para versão editorial em português quando o conteúdo da seção
 *      é útil ao humano (ex: `answer_summary` → `Resposta`).
 *   3. Move blocos puramente auditáveis (ex: `source_refs` quando contém só
 *      identificadores opacos, `uncertainty` quando degenera em flag) para o
 *      `metadata` retornado, que o ContextPanel consome.
 *   4. Insere divisor editorial `---` entre seções principais quando a
 *      resposta tem múltiplas seções (≥2) — alimenta `DividerEditorial`.
 *
 * **Invariante**: a sanitização **NUNCA** descarta conteúdo textual humano. Se
 * a seção tem prosa abaixo do cabeçalho técnico, a prosa é preservada. Se o
 * cabeçalho introduz só uma lista de identificadores opacos, ele migra inteiro
 * para `metadata.source_refs` / `metadata.uncertainty`.
 *
 * **Não desenha UI nova.** Não substitui o renderer. Não toca o backend. É
 * uma projeção pura `string → { body, metadata }` aplicada no picker.
 */

/** Vocabulário técnico que o Hyperflow injeta como response_shape. */
const TECHNICAL_SECTION_VOCABULARY = new Set<string>([
  // atlas_research
  'answer_summary',
  'claims_table',
  'source_refs',
  'sources',
  'uncertainty',
  'open_questions',
  // atlas_explain
  'plain_language_explanation',
  'assumptions',
  'relevant_context_refs',
  'context_refs',
  'next_questions',
  // atlas_debug
  'symptoms',
  'likely_causes',
  'missing_evidence',
  'next_debug_steps',
  // atlas_review
  'findings',
  'test_gaps',
  'change_summary',
  // atlas_plan
  'objective',
  'work_breakdown',
  'risk_register',
  'evidence_needed',
  'execution_recommendation',
  // atlas_conversation
  'direct_answer',
  'clarifying_question_when_needed',
  'handoff_suggestion_when_scope_changes',
  // delegation
  'delegation_reason',
  'target_flow_id',
  'operator_next_step',
  // genéricos vazados
  'trace',
  'receipt',
  'metadata',
  'evidence_refs',
  'evidence',
  'routing',
  'confidence',
  'handoff',
  'context_pack',
])

/** Tradução editorial para os técnicos que ainda fazem sentido como heading. */
const EDITORIAL_TRANSLATIONS: Record<string, string> = {
  answer_summary: 'Resposta',
  claims_table: 'Afirmações',
  open_questions: 'Perguntas em aberto',
  plain_language_explanation: 'Explicação',
  assumptions: 'Premissas',
  next_questions: 'Próximas perguntas',
  symptoms: 'Sintomas',
  likely_causes: 'Causas prováveis',
  missing_evidence: 'Evidências em falta',
  next_debug_steps: 'Próximos passos de debug',
  findings: 'Achados',
  test_gaps: 'Lacunas de teste',
  change_summary: 'Resumo das mudanças',
  objective: 'Objetivo',
  work_breakdown: 'Desdobramento',
  risk_register: 'Riscos',
  evidence_needed: 'Evidências necessárias',
  execution_recommendation: 'Execução recomendada',
  direct_answer: 'Resposta',
  clarifying_question_when_needed: 'Pergunta de clareza',
  handoff_suggestion_when_scope_changes: 'Handoff sugerido',
  delegation_reason: 'Motivo do handoff',
  target_flow_id: 'Fluxo alvo',
  operator_next_step: 'Próximo passo',
}

/** Seções que sempre migram para metadata (nunca renderizam no corpo). */
const ALWAYS_METADATA_SECTIONS = new Set<string>([
  'source_refs',
  'sources',
  'uncertainty',
  'relevant_context_refs',
  'context_refs',
  'trace',
  'receipt',
  'metadata',
  'evidence_refs',
  'evidence',
  'routing',
  'confidence',
  'handoff',
  'context_pack',
])

/** Contextos onde paths e termos técnicos devem ser preservados. */
export type TechnicalContext = 'programming' | 'debug' | 'review' | 'code' | 'audit'

export interface PresentationContext {
  /**
   * Domínio/intent do trace (vem do Hyperflow). Quando é técnico (programming,
   * debug, review), preservamos paths de arquivo e identificadores no corpo.
   */
  technicalDomain?: TechnicalContext | string | null
  /**
   * Quando true, o operador pediu auditoria explícita — não sanitizamos
   * cabeçalhos técnicos.
   */
  auditRequested?: boolean
}

export interface PresentationMetadata {
  /** Linhas migradas das seções técnicas, agrupadas por chave. */
  sections: Record<string, string[]>
}

export interface PresentationResult {
  /** Texto humano sanitizado, pronto pro EditorialMarkdown. */
  body: string
  /**
   * Metadados extraídos do corpo. O ContextPanel/Trace consome isso quando
   * source_refs/uncertainty/etc. estavam crus no response_text.
   */
  metadata: PresentationMetadata
  /** Quantas seções técnicas foram detectadas (para debug/teste). */
  technicalSectionsFound: number
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/
const BOLD_LABEL_RE = /^\*\*\s*([A-Za-z][A-Za-z0-9_ ]*?)\s*:?\s*\*\*\s*:?\s*$/
const PLAIN_LABEL_RE = /^([A-Z][A-Z0-9_]+)\s*:?\s*$/
const TITLE_CASE_LABEL_RE = /^([A-Z][A-Za-z0-9_]+)\s*:\s*$/

/**
 * Normaliza um candidato a label técnico para a forma snake_case.
 * Retorna null se não parece um cabeçalho técnico.
 */
function technicalKeyOf(label: string): string | null {
  const trimmed = label.trim()
  if (trimmed === '') return null
  // SOURCE_REFS, UNCERTAINTY, OPEN_QUESTIONS → source_refs, uncertainty, ...
  const lowered = trimmed
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_]/g, '')
    .toLowerCase()
  if (TECHNICAL_SECTION_VOCABULARY.has(lowered)) return lowered
  return null
}

/**
 * Detecta se uma linha é um cabeçalho técnico em qualquer um dos formatos
 * que o LLM costuma emitir (## SOURCE_REFS, **source_refs**, SOURCE_REFS:, etc.)
 */
function detectTechnicalHeader(line: string): string | null {
  const trimmed = line.trim()
  if (trimmed === '') return null

  const heading = trimmed.match(HEADING_RE)
  if (heading) {
    return technicalKeyOf(heading[2])
  }

  const bold = trimmed.match(BOLD_LABEL_RE)
  if (bold) {
    return technicalKeyOf(bold[1])
  }

  const upper = trimmed.match(PLAIN_LABEL_RE)
  if (upper) {
    return technicalKeyOf(upper[1])
  }

  const titled = trimmed.match(TITLE_CASE_LABEL_RE)
  if (titled) {
    return technicalKeyOf(titled[1])
  }

  return null
}

/**
 * Detecta se uma linha é um cabeçalho normal markdown (## Texto qualquer).
 * Usado para saber quando a seção técnica termina.
 */
function isAnyHeading(line: string): boolean {
  const trimmed = line.trim()
  if (HEADING_RE.test(trimmed)) return true
  if (BOLD_LABEL_RE.test(trimmed)) return true
  if (PLAIN_LABEL_RE.test(trimmed)) return true
  return false
}

/**
 * Projeta o response_text bruto numa apresentação editorial limpa.
 *
 * - Detecta cabeçalhos técnicos (snake_case inglês ou UPPER_CASE).
 * - Reescreve para editorial PT-BR quando útil, ou migra para metadata.
 * - Insere divisor `---` entre múltiplas seções principais.
 */
export function projectPresentation(
  responseText: string,
  context: PresentationContext = {},
): PresentationResult {
  const empty: PresentationResult = {
    body: '',
    metadata: { sections: {} },
    technicalSectionsFound: 0,
  }
  if (!responseText) return empty

  if (context.auditRequested) {
    return { body: responseText, metadata: { sections: {} }, technicalSectionsFound: 0 }
  }

  const lines = responseText.replace(/\r\n/g, '\n').split('\n')
  const sections: Record<string, string[]> = {}
  const editorialBlocks: Array<{ title: string | null; lines: string[] }> = []
  let current: { title: string | null; lines: string[] } = { title: null, lines: [] }
  let technicalSectionsFound = 0
  let pendingMetadataKey: string | null = null
  let pendingMetadataLines: string[] = []

  const flushMetadata = () => {
    if (pendingMetadataKey == null) return
    const trimmed = pendingMetadataLines
      .map((l) => l.trimEnd())
      .filter((l) => l.trim() !== '')
    if (trimmed.length > 0) {
      const existing = sections[pendingMetadataKey] ?? []
      sections[pendingMetadataKey] = [...existing, ...trimmed]
    }
    pendingMetadataKey = null
    pendingMetadataLines = []
  }

  const pushCurrent = () => {
    if (current.title == null && current.lines.every((l) => l.trim() === '')) return
    editorialBlocks.push(current)
    current = { title: null, lines: [] }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const technicalKey = detectTechnicalHeader(line)

    if (technicalKey) {
      technicalSectionsFound++
      // Termina seção anterior (editorial ou metadata).
      flushMetadata()

      if (ALWAYS_METADATA_SECTIONS.has(technicalKey)) {
        pushCurrent()
        pendingMetadataKey = technicalKey
        pendingMetadataLines = []
        continue
      }

      const editorialTitle = EDITORIAL_TRANSLATIONS[technicalKey] ?? null
      if (editorialTitle) {
        pushCurrent()
        current = { title: editorialTitle, lines: [] }
        continue
      }

      // Cabeçalho técnico desconhecido — drop silencioso (não vaza identificador).
      pushCurrent()
      continue
    }

    // Metadata fecha em: (1) qualquer outro heading; (2) primeira linha vazia
    // após conteúdo capturado — a regra "metadata = bloco imediatamente após
    // o cabeçalho técnico, separado por linha em branco do resto".
    if (pendingMetadataKey != null) {
      if (isAnyHeading(line)) {
        flushMetadata()
        // a linha cai abaixo como heading normal/editorial.
      } else if (line.trim() === '' && pendingMetadataLines.length > 0) {
        flushMetadata()
        // linha vazia consumida; próximas linhas vão para body.
        continue
      } else {
        pendingMetadataLines.push(line)
        continue
      }
    }

    current.lines.push(line)
  }

  flushMetadata()
  pushCurrent()

  const body = renderEditorialBody(editorialBlocks)

  return {
    body,
    metadata: { sections },
    technicalSectionsFound,
  }
}

/**
 * Reúne blocos editoriais num texto markdown com divisores `---` quando
 * apropriado. Divisor só entra quando há ≥2 blocos com título; respostas
 * curtas/sem múltiplas seções ficam contínuas.
 */
function renderEditorialBody(
  blocks: Array<{ title: string | null; lines: string[] }>,
): string {
  const cleaned = blocks
    .map((block) => ({
      title: block.title,
      content: block.lines.join('\n').replace(/^\n+|\n+$/g, ''),
    }))
    .filter((block) => block.title != null || block.content.trim() !== '')

  const titledCount = cleaned.filter((b) => b.title != null).length
  const useDividers = titledCount >= 2

  const out: string[] = []
  cleaned.forEach((block, index) => {
    if (index > 0 && useDividers && block.title != null) {
      out.push('')
      out.push('---')
      out.push('')
    }
    if (block.title != null) {
      out.push(`## ${block.title}`)
      out.push('')
    }
    if (block.content !== '') {
      out.push(block.content)
    }
  })

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Retorna `true` quando a presentation context indica que paths/identificadores
 * técnicos devem ser preservados intactos no corpo.
 */
export function preservesTechnicalTokens(context: PresentationContext): boolean {
  const domain = context.technicalDomain
  if (typeof domain !== 'string') return false
  const lowered = domain.toLowerCase()
  return (
    lowered === 'programming' ||
    lowered === 'debug' ||
    lowered === 'review' ||
    lowered === 'code' ||
    lowered === 'audit' ||
    context.auditRequested === true
  )
}
