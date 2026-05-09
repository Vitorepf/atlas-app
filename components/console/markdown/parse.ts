// Pure markdown parser scoped to what LLMs actually emit:
// **bold**, *italic*, ***bold-italic***, `code`, [text](url),
// headings (# ## ###), unordered (- * +) and ordered lists,
// blockquotes (> ), fenced code blocks (```), and dividers (--- *** ___).
//
// Two passes: blocks first, then inline within block content.
// Underscore emphasis (_x_, __x__) is intentionally unsupported — too many
// false positives from snake_case identifiers.

export type InlineSpan =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; url: string }

export type Block =
  | { type: 'paragraph'; spans: InlineSpan[] }
  | { type: 'heading'; level: 1 | 2 | 3; spans: InlineSpan[] }
  | { type: 'list'; ordered: boolean; items: InlineSpan[][] }
  | { type: 'quote'; spans: InlineSpan[] }
  | { type: 'code'; text: string; lang?: string }
  | { type: 'divider' }
  | { type: 'table'; headers: InlineSpan[][]; rows: InlineSpan[][][] }

const INLINE_RE =
  /(`+)([^`\n]+?)\1|\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*\*([^*\n]+?)\*\*\*|\*\*([^*\n]+?)\*\*|\*([^*\n]+?)\*/g

export function parseInline(text: string): InlineSpan[] {
  const out: InlineSpan[] = []
  let last = 0
  for (const m of text.matchAll(INLINE_RE)) {
    const idx = m.index ?? 0
    if (idx > last) {
      out.push({ type: 'text', text: text.slice(last, idx) })
    }
    if (m[2] != null) out.push({ type: 'code', text: m[2] })
    else if (m[3] != null) out.push({ type: 'link', text: m[3], url: m[4] })
    else if (m[5] != null) out.push({ type: 'italic', text: m[5] })
    else if (m[6] != null) out.push({ type: 'bold', text: m[6] })
    else if (m[7] != null) out.push({ type: 'italic', text: m[7] })
    last = idx + m[0].length
  }
  if (last < text.length) {
    out.push({ type: 'text', text: text.slice(last) })
  }
  return out.map(unescapeText)
}

function unescapeText(span: InlineSpan): InlineSpan {
  if (span.type !== 'text') return span
  return { ...span, text: span.text.replace(/\\([*_`[\]()#>~\\\-])/g, '$1') }
}

const DIVIDER_RE = /^\s*([-*_])\1{2,}\s*$/
const FENCE_RE = /^```(\w*)\s*$/
const HEADING_RE = /^(#{1,3})\s+(.+?)\s*#*\s*$/
const ULIST_RE = /^[-*+]\s+/
const OLIST_RE = /^\d+\.\s+/
const QUOTE_RE = /^>\s?/
// Tabela GFM · header linha com ≥1 pipe + linha separator (| --- | --- |)
// abaixo. Pipes externos opcionais (| a | b | OU a | b). Pra evitar
// false-positives em texto como "x | y", exigimos a separator line.
const TABLE_PIPE_RE = /\|/
const TABLE_SEPARATOR_RE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/

export function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i++
      continue
    }

    if (DIVIDER_RE.test(line)) {
      blocks.push({ type: 'divider' })
      i++
      continue
    }

    const fence = line.match(FENCE_RE)
    if (fence) {
      const lang = fence[1] || undefined
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      if (i < lines.length) i++
      blocks.push({ type: 'code', text: buf.join('\n'), lang })
      continue
    }

    const head = line.match(HEADING_RE)
    if (head) {
      blocks.push({
        type: 'heading',
        level: head[1].length as 1 | 2 | 3,
        spans: parseInline(head[2]),
      })
      i++
      continue
    }

    if (QUOTE_RE.test(line)) {
      const buf: string[] = []
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        buf.push(lines[i].replace(QUOTE_RE, ''))
        i++
      }
      blocks.push({ type: 'quote', spans: parseInline(buf.join(' ')) })
      continue
    }

    if (ULIST_RE.test(line)) {
      const items: InlineSpan[][] = []
      while (i < lines.length && ULIST_RE.test(lines[i])) {
        items.push(parseInline(lines[i].replace(ULIST_RE, '')))
        i++
      }
      blocks.push({ type: 'list', ordered: false, items })
      continue
    }

    if (OLIST_RE.test(line)) {
      const items: InlineSpan[][] = []
      while (i < lines.length && OLIST_RE.test(lines[i])) {
        items.push(parseInline(lines[i].replace(OLIST_RE, '')))
        i++
      }
      blocks.push({ type: 'list', ordered: true, items })
      continue
    }

    // Tabela GFM · só consome se a próxima linha É um separator válido.
    // Senão, deixa cair no parágrafo (texto solto com pipes).
    if (TABLE_PIPE_RE.test(line) && i + 1 < lines.length && TABLE_SEPARATOR_RE.test(lines[i + 1])) {
      const headers = splitTableRow(line).map(parseInline)
      i += 2  // skip header + separator
      const rows: InlineSpan[][][] = []
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        TABLE_PIPE_RE.test(lines[i]) &&
        !isBlockStart(lines[i])
      ) {
        rows.push(splitTableRow(lines[i]).map(parseInline))
        i++
      }
      blocks.push({ type: 'table', headers, rows })
      continue
    }

    const buf: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
      buf.push(lines[i])
      i++
    }
    blocks.push({ type: 'paragraph', spans: parseInline(buf.join(' ')) })
  }
  return blocks
}

function isBlockStart(line: string): boolean {
  return (
    /^#{1,3}\s/.test(line) ||
    ULIST_RE.test(line) ||
    OLIST_RE.test(line) ||
    QUOTE_RE.test(line) ||
    /^```/.test(line) ||
    DIVIDER_RE.test(line)
  )
}

// Split de linha de tabela em células · respeita pipes externos opcionais
// e trim de cada célula. Ex: "| a | b | c |" → ["a", "b", "c"].
// Pipes escapados com \| ficam como literal "|" dentro de uma célula.
function splitTableRow(line: string): string[] {
  // Remove pipes externos
  let trimmed = line.trim()
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1)
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1)

  // Split em pipes não-escapados (suporta \| como literal)
  const cells: string[] = []
  let current = ''
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]
    const next = trimmed[i + 1]
    if (ch === '\\' && next === '|') {
      current += '|'
      i++
      continue
    }
    if (ch === '|') {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return cells
}
