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
}

// Renders LLM markdown in Atlas typography: italic always Fraunces italic
// (oralidade), bold takes the body font's weighted variant (peso editorial),
// inline code in JetBrains Mono on a surface tint (registro). No external
// markdown library — keeps font/color discipline absolute.
export function EditorialMarkdown({ text, tone = 'operational' }: Props) {
  const blocks = useMemo(() => parseBlocks(text), [text])
  return (
    <View style={styles.stack}>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} tone={tone} />
      ))}
    </View>
  )
}

function BlockView({ block, tone }: { block: Block; tone: Tone }) {
  const c = usePalette()
  switch (block.type) {
    case 'paragraph':
      return <Paragraph spans={block.spans} tone={tone} />
    case 'heading':
      return <Heading level={block.level} spans={block.spans} tone={tone} />
    case 'list':
      return <ListBlock ordered={block.ordered} items={block.items} tone={tone} />
    case 'quote':
      return <QuoteBlock spans={block.spans} />
    case 'code':
      return (
        <View style={[styles.codeBlock, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Mono size={13} lineHeight={20} color={c.ink}>
            {block.text}
          </Mono>
        </View>
      )
    case 'divider':
      return <DividerEditorial />
  }
}

function Paragraph({ spans, tone }: { spans: InlineSpan[]; tone: Tone }) {
  if (tone === 'contemplative') {
    return (
      <Frau size={18} lineHeight={28}>
        <InlineRun spans={spans} tone={tone} />
      </Frau>
    )
  }
  return (
    <Sans size={16} lineHeight={25}>
      <InlineRun spans={spans} tone={tone} />
    </Sans>
  )
}

function Heading({
  level,
  spans,
  tone,
}: {
  level: 1 | 2 | 3
  spans: InlineSpan[]
  tone: Tone
}) {
  const c = usePalette()
  if (level === 1) {
    return (
      <View style={styles.h1}>
        <Frau size={22} lineHeight={28}>
          <InlineRun spans={spans} tone={tone} />
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
        <InlineRun spans={spans} tone={tone} />
      </Sans>
    </View>
  )
}

function ListBlock({
  ordered,
  items,
  tone,
}: {
  ordered: boolean
  items: InlineSpan[][]
  tone: Tone
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
            <Paragraph spans={item} tone={tone} />
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

function InlineRun({ spans, tone }: { spans: InlineSpan[]; tone: Tone }) {
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
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
})
