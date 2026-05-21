import { useMemo } from 'react'
import { Linking, StyleSheet, Text, View } from 'react-native'
import { Frau, Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { fonts } from '../../design/tokens'
import { DividerEditorial } from './DividerEditorial'
import { type Block, type InlineSpan, parseBlocks } from './markdown/parse'

type Tone = 'operational' | 'contemplative'

interface Props {
  text: string
  tone?: Tone
  onLinkPress?: (url: string) => void
}

// Renders LLM markdown in Atlas typography: italic always Fraunces italic
// (oralidade), bold takes the body font's weighted variant (peso editorial),
// inline code in JetBrains Mono on a surface tint (registro). No external
// markdown library — keeps font/color discipline absolute.
export function EditorialMarkdown({ text, tone = 'operational', onLinkPress }: Props) {
  const blocks = useMemo(() => parseBlocks(text), [text])
  return (
    <View style={styles.stack}>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} tone={tone} onLinkPress={onLinkPress} />
      ))}
    </View>
  )
}

function BlockView({ block, tone, onLinkPress }: { block: Block; tone: Tone; onLinkPress?: (url: string) => void }) {
  const c = usePalette()
  switch (block.type) {
    case 'paragraph':
      return <Paragraph spans={block.spans} tone={tone} onLinkPress={onLinkPress} />
    case 'heading':
      return <Heading level={block.level} spans={block.spans} tone={tone} onLinkPress={onLinkPress} />
    case 'list':
      return <ListBlock ordered={block.ordered} items={block.items} tone={tone} onLinkPress={onLinkPress} />
    case 'quote':
      return <QuoteBlock spans={block.spans} />
    case 'code':
      return (
        // Slice 6ad · code block canon premium · surface raised mais profundo
        // + inner top highlight subtle pra effect "carved in slate" canon.
        <View style={[
          styles.codeBlock,
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            // Shadow inset não funciona em RN View · usar boxShadow CSS-like
            // via shadow* props · subtle drop pra parecer "carved"
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.12,
            shadowRadius: 2,
            elevation: 1,
          },
        ]}>
          <Mono size={13} lineHeight={20} color={c.ink}>
            {block.text}
          </Mono>
        </View>
      )
    case 'divider':
      return <DividerEditorial />
    case 'table':
      return <TableBlock headers={block.headers} rows={block.rows} tone={tone} onLinkPress={onLinkPress} />
  }
}

// TableBlock editorial · canon Atlas (Patek dial subdial register).
// Sem stripes alternantes SaaS, sem cores de células, sem ícones.
// Header: Mono caps small bronze (registro de "etiqueta")
// Body: Sans 14 ink (corpo de relatório)
// Hairlines c.border entre rows (não em volta da tabela inteira)
// Hairline mais grossa abaixo do header (peso de "abertura de seção")
function TableBlock({
  headers,
  rows,
  tone,
  onLinkPress,
}: {
  headers: InlineSpan[][]
  rows: InlineSpan[][][]
  tone: Tone
  onLinkPress?: (url: string) => void
}) {
  const c = usePalette()
  const colCount = Math.max(headers.length, ...rows.map((r) => r.length))
  return (
    <View style={[styles.table, { borderTopColor: c.border, borderBottomColor: c.border }]}>
      {/* Header row · mono caps small bronze */}
      <View style={[styles.tableHeaderRow, { borderBottomColor: c.border }]}>
        {Array.from({ length: colCount }).map((_, ci) => (
          <View key={ci} style={[styles.tableCell, { flex: 1 }]}>
            <Mono
              size={10}
              lineHeight={14}
              letterSpacing={1.4}
              color={c.bronze}
              weight="med"
            >
              {(spansToPlain(headers[ci] ?? []) || '').toUpperCase()}
            </Mono>
          </View>
        ))}
      </View>

      {/* Body rows · Sans 14 com hairline entre */}
      {rows.map((row, ri) => (
        <View
          key={ri}
          style={[
            styles.tableRow,
            ri < rows.length - 1
              ? { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }
              : null,
          ]}
        >
          {Array.from({ length: colCount }).map((_, ci) => (
            <View key={ci} style={[styles.tableCell, { flex: 1 }]}>
              <Sans size={14} lineHeight={20} color={c.ink}>
                <InlineRun spans={row[ci] ?? []} tone={tone} onLinkPress={onLinkPress} />
              </Sans>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

function Paragraph({ spans, tone, onLinkPress }: { spans: InlineSpan[]; tone: Tone; onLinkPress?: (url: string) => void }) {
  if (tone === 'contemplative') {
    return (
      <Frau size={18} lineHeight={28}>
        <InlineRun spans={spans} tone={tone} onLinkPress={onLinkPress} />
      </Frau>
    )
  }
  return (
    <Sans size={16} lineHeight={25}>
      <InlineRun spans={spans} tone={tone} onLinkPress={onLinkPress} />
    </Sans>
  )
}

function Heading({
  level,
  spans,
  tone,
  onLinkPress,
}: {
  level: 1 | 2 | 3
  spans: InlineSpan[]
  tone: Tone
  onLinkPress?: (url: string) => void
}) {
  const c = usePalette()
  if (level === 1) {
    return (
      <View style={styles.h1}>
        <Frau size={22} lineHeight={28}>
          <InlineRun spans={spans} tone={tone} onLinkPress={onLinkPress} />
        </Frau>
      </View>
    )
  }
  if (level === 2) {
    return (
      <View style={styles.h2}>
        <Sans
          weight="med"
          size={11}
          lineHeight={14}
          letterSpacing={1.1}
          color={c.ink2}
          style={styles.smallCaps}
        >
          {spansToPlain(spans)}
        </Sans>
      </View>
    )
  }
  return (
    <View style={styles.h3}>
      <Sans weight="sb" size={14} lineHeight={20} color={c.ink}>
        <InlineRun spans={spans} tone={tone} onLinkPress={onLinkPress} />
      </Sans>
    </View>
  )
}

function ListBlock({
  ordered,
  items,
  tone,
  onLinkPress,
}: {
  ordered: boolean
  items: InlineSpan[][]
  tone: Tone
  onLinkPress?: (url: string) => void
}) {
  const c = usePalette()
  return (
    <View style={styles.list}>
      {items.map((item, idx) => (
        <View key={idx} style={styles.listRow}>
          {ordered ? (
            <Mono size={13} lineHeight={20} color={c.ink2} style={styles.listMarkerNum}>
              {`${idx + 1}.`}
            </Mono>
          ) : (
            <Sans size={16} lineHeight={25} color={c.bronze} style={styles.listMarkerDash}>
              —
            </Sans>
          )}
          <View style={styles.listBody}>
            <Paragraph spans={item} tone={tone} onLinkPress={onLinkPress} />
          </View>
        </View>
      ))}
    </View>
  )
}

function QuoteBlock({ spans }: { spans: InlineSpan[] }) {
  const c = usePalette()
  return (
    <View style={styles.quoteRow}>
      <View style={[styles.quoteMarker, { backgroundColor: c.bronze }]} />
      <View style={styles.quoteBody}>
        <Frau italic size={17} lineHeight={26}>
          <QuoteSpans spans={spans} />
        </Frau>
      </View>
    </View>
  )
}

function InlineRun({ spans, tone, onLinkPress }: { spans: InlineSpan[]; tone: Tone; onLinkPress?: (url: string) => void }) {
  const c = usePalette()
  return (
    <>
      {spans.map((span, i) => {
        if (span.type === 'text') return span.text
        if (span.type === 'italic') {
          return (
            <Frau key={i} italic>
              {span.text}
            </Frau>
          )
        }
        if (span.type === 'bold') {
          if (tone === 'contemplative') {
            return (
              <Frau key={i} weight="med">
                {span.text}
              </Frau>
            )
          }
          return (
            <Sans key={i} weight="sb">
              {span.text}
            </Sans>
          )
        }
        if (span.type === 'code') {
          return (
            <Mono
              key={i}
              size={13}
              color={c.ink}
              style={{ backgroundColor: c.surface }}
            >
              {` ${span.text} `}
            </Mono>
          )
        }
        if (span.type === 'link') {
          return (
            <Text
              key={i}
              onPress={() => {
                if (onLinkPress) {
                  onLinkPress(span.url)
                  return
                }
                void Linking.openURL(span.url).catch(() => {})
              }}
              style={{
                fontFamily: fonts.sansMd,
                color: c.prussian,
                textDecorationLine: 'underline',
              }}
            >
              {span.text}
            </Text>
          )
        }
        return null
      })}
    </>
  )
}

// Inside a Frau italic block, repeat italic is a no-op; bold becomes Frau medium
// (italic+medium font does not exist in the token set, so italic wins).
function QuoteSpans({ spans }: { spans: InlineSpan[] }) {
  const c = usePalette()
  return (
    <>
      {spans.map((span, i) => {
        if (span.type === 'text') return span.text
        if (span.type === 'italic') return span.text
        if (span.type === 'bold') {
          return (
            <Frau key={i} weight="med">
              {span.text}
            </Frau>
          )
        }
        if (span.type === 'code') {
          return (
            <Mono key={i} size={13} color={c.ink} style={{ backgroundColor: c.surface }}>
              {` ${span.text} `}
            </Mono>
          )
        }
        if (span.type === 'link') return span.text
        return null
      })}
    </>
  )
}

function spansToPlain(spans: InlineSpan[]): string {
  return spans.map((s) => (s.type === 'text' ? s.text : s.type === 'link' ? s.text : s.text)).join('')
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  h1: { paddingTop: 4 },
  h2: { paddingTop: 6, paddingBottom: 2 },
  h3: { paddingTop: 2 },
  smallCaps: { textTransform: 'uppercase' },
  list: { gap: 6 },
  listRow: { flexDirection: 'row', alignItems: 'flex-start' },
  listMarkerNum: { width: 26, paddingTop: 3 },
  listMarkerDash: { width: 22 },
  listBody: { flex: 1 },
  quoteRow: { flexDirection: 'row', alignItems: 'stretch' },
  quoteMarker: { width: 2, borderRadius: 1, marginRight: 14 },
  quoteBody: { flex: 1, paddingVertical: 2 },
  codeBlock: {
    // Slice 6ad · radius 10 (era 8) canon sheet-radius family premium
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  // Tabela editorial Atlas · hairlines top + bottom como "register marks"
  // de Patek dial. Sem border lateral (sem caixa SaaS).
  table: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginVertical: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  tableCell: {
    paddingHorizontal: 8,
  },
})
