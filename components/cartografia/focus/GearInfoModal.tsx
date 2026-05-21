import { useEffect, useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Frau, Mono, Sans } from '../../../design/Type'
import { usePalette } from '../../../design/theme'
import { apiGet } from '../../../lib/api/client'
import { EditorialMarkdown } from '../../console/EditorialMarkdown'

export interface GearInfo {
  graphId?: string | null
  title: string
  subtitle?: string | null
  humanSummary?: string | null
  humanName?: string | null
  canonicalName?: string | null
  technicalName?: string | null
  productName?: string | null
  runtimeAcronym?: string | null
  internalProductName?: string | null
  technicalRuntime?: string | null
  cartographyType?: string | null
  canonicalSource?: string | null
  kind?: string | null
  status?: string | null
  source?: string | null
  world?: string | null
  layer?: string | null
  graphLayer?: string | null
  parent?: string | null
  owner?: string | null
  category?: string | null
  priority?: number | string | null
  docSchema?: string | null
  maintenance?: string[]
  lineLimit?: number | string | null
  patamarCurrent?: string | null
  patamarNextOf?: string | null
  patamarNext?: string | null
  patamarAfter?: string[]
  versionFamily?: string | null
  versions?: string[]
  versionNote?: string | null
  schemaVersion?: string | null
  sourcePath?: string | null
  input?: string | null
  output?: string | null
  risk?: string | null
  evidence?: string[]
  nextAction?: string | null
  childrenCount?: number
  dependsOn?: string[]
  flowsTo?: string[]
  unlocks?: string[]
  governs?: string[]
  repoPaths?: string[]
  relatedPaths?: string[]
  capabilities?: string[]
  decisions?: string[]
  allowedChanges?: string[]
  forbiddenChanges?: string[]
  requiredTests?: string[]
  qualityGates?: string[]
  failureModes?: string[]
  observabilitySignals?: string[]
  aiEntryPoints?: string[]
  aiUsageNotes?: string[]
  visualTags?: string[]
  requiresEvidence?: boolean | string | null
}

interface Props {
  info: GearInfo | null
  onClose: () => void
  onOpenGraphId?: (graphId: string) => void
  onOpenSourcePath?: (sourcePath: string) => void
  onPrevious?: () => void
  onNext?: () => void
  hasPrevious?: boolean
  hasNext?: boolean
}

type ModalMode = 'brief' | 'detail' | 'source'

type CartographyNoteResponse = {
  graph_id: string
  exists: boolean
  source_path: string | null
  body: string | null
  frontmatter: Record<string, unknown> | null
}

export function GearInfoModal({
  info,
  onClose,
  onOpenGraphId,
  onOpenSourcePath,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: Props) {
  const c = usePalette()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const [mode, setMode] = useState<ModalMode>('brief')
  const [sourceGraphId, setSourceGraphId] = useState<string | null>(null)
  const [note, setNote] = useState<CartographyNoteResponse | null>(null)
  const [noteError, setNoteError] = useState<string | null>(null)
  const topGap = Math.max(insets.top + 24, 56)
  const sheetHeight = Math.max(360, windowHeight - topGap)

  useEffect(() => {
    setMode('brief')
    setSourceGraphId(null)
    setNote(null)
    setNoteError(null)
  }, [info?.graphId, info?.title])

  useEffect(() => {
    if (mode !== 'source' || !sourceGraphId) return
    let cancelled = false
    setNote(null)
    setNoteError(null)
    apiGet<CartographyNoteResponse>(`/atlas-cartography/note/${encodeURIComponent(sourceGraphId)}`)
      .then((payload) => {
        if (!cancelled) setNote(payload)
      })
      .catch((error: unknown) => {
        if (!cancelled) setNoteError(error instanceof Error ? error.message : 'Falha ao carregar fonte.')
      })
    return () => {
      cancelled = true
    }
  }, [mode, sourceGraphId])

  if (!info) return null

  const sourcePaths = uniqueList([info.sourcePath, ...(info.repoPaths ?? [])])
  const relatedPaths = uniqueList(info.relatedPaths ?? [])
  const tests = uniqueList([...(info.requiredTests ?? []), ...(info.qualityGates ?? [])])
  const evidence = uniqueList(info.evidence ?? [])
  const summary = humanSummary(info)
  const preparedDocument = {
    summary,
    sourcePaths,
    relatedPaths,
    tests,
    evidence,
  }
  const markdownDocument = mode === 'brief'
    ? buildBriefMarkdownDocument(info, preparedDocument)
    : mode === 'source'
      ? buildSourceMarkdownDocument(info, sourceGraphId, note, noteError)
      : buildDetailedMarkdownDocument(info, preparedDocument)
  const handleLinkPress = (url: string) => {
    if (url.startsWith('atlas://cartografia/')) {
      const graphId = decodeURIComponent(url.replace('atlas://cartografia/', ''))
      onOpenGraphId?.(graphId)
      return
    }
    if (url.startsWith('atlas://doc/')) {
      const graphId = decodeURIComponent(url.replace('atlas://doc/', ''))
      setSourceGraphId(graphId)
      setMode('source')
      return
    }
    if (url.startsWith('atlas://source/')) {
      const sourcePath = decodeURIComponent(url.replace('atlas://source/', ''))
      onOpenSourcePath?.(sourcePath)
      return
    }
    void Linking.openURL(url).catch(() => {})
  }

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <Pressable
        onPress={onClose}
        style={[StyleSheet.absoluteFillObject, styles.scrim]}
        accessibilityRole="button"
        accessibilityLabel="Fechar detalhes da engrenagem"
      />
      <View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            backgroundColor: c.bgRaised,
            borderTopColor: c.bronze,
            shadowColor: '#000',
          },
        ]}
      >
        <View style={styles.headerBar}>
          <Mono size={9} letterSpacing={1.8} color={c.bronze}>
            DOCUMENTAÇÃO DA ENGRENAGEM
          </Mono>
          <View style={styles.headerActions}>
            <ModalNavButton kind="previous" enabled={Boolean(hasPrevious && onPrevious)} onPress={onPrevious} />
            <ModalNavButton kind="next" enabled={Boolean(hasNext && onNext)} onPress={onNext} />
            <ModalNavButton kind="close" enabled onPress={onClose} />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 34 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleBlock}>
            <Frau italic weight="med" size={27} lineHeight={32} color={c.ink}>
              {info.title}
            </Frau>
            {summary ? (
              <Sans size={14} lineHeight={20} color={c.ink2}>
                {summary}
              </Sans>
            ) : null}
          </View>

          <View style={styles.chips}>
            {info.kind ? <Chip label={info.kind} tone="bronze" /> : null}
            {info.status ? <Chip label={info.status} tone="moss" /> : null}
            {info.source ? <Chip label={info.source} tone="ink" /> : null}
            {info.childrenCount ? <Chip label={`${info.childrenCount} peças`} tone="bronze" /> : null}
            {info.requiresEvidence ? <Chip label="exige prova" tone="bronze" /> : null}
          </View>

          <View style={styles.modeTabs}>
            <ModeButton label="30s" active={mode === 'brief'} onPress={() => setMode('brief')} />
            <ModeButton label="Detalhe" active={mode === 'detail'} onPress={() => setMode('detail')} />
            <ModeButton
              label="Fonte"
              active={mode === 'source'}
              disabled={!info.graphId}
              onPress={() => {
                setSourceGraphId(info.graphId ?? null)
                setMode('source')
              }}
            />
          </View>

          <View style={styles.markdownDocument}>
            <EditorialMarkdown text={markdownDocument} tone="operational" onLinkPress={handleLinkPress} />
          </View>
        </ScrollView>
      </View>
    </View>
  )
}

function buildBriefMarkdownDocument(
  info: GearInfo,
  prepared: {
    summary: string | null
    sourcePaths: string[]
    relatedPaths: string[]
    tests: string[]
    evidence: string[]
  },
): string {
  const source = info.canonicalSource ?? prepared.sourcePaths[0] ?? info.sourcePath ?? prepared.relatedPaths[0]
  const responsibility = primaryResponsibility(info)
  const before = formatHumanText(info.input) ?? linkedNodeText(info.dependsOn)
  const after = formatHumanText(info.output) ?? linkedNodeText(info.flowsTo)
  const proof = prepared.tests[0] ?? prepared.evidence[0] ?? info.observabilitySignals?.[0]
  const risk = formatHumanText(info.risk) ?? formatHumanText(info.failureModes?.[0])

  return [
    '## 30 segundos',
    '',
    `> ${prepared.summary ?? 'Esta peça ainda não tem explicação simples declarada.'}`,
    '',
    bulletList([
      `**Nome:** ${formatHumanText(info.humanName ?? info.productName ?? info.title) ?? info.title}`,
      info.runtimeAcronym ? `**Acrônimo:** ${info.runtimeAcronym}` : null,
      responsibility ? `**Serve para:** ${responsibility}` : null,
      `**Fluxo:** ${before ?? 'entrada não declarada'} → esta peça → ${after ?? 'saída não declarada'}`,
      risk ? `**Cuidado:** ${risk}` : null,
      proof ? `**Confie se:** ${inlineCodeIfCommand(proof)}` : null,
      source ? `**Fonte:** ${docLink(source, info.graphId)}` : null,
    ]),
    '',
    '---',
    '',
    '## Próximos cliques',
    '',
    bulletList([
      info.graphId ? `**Ler fonte:** ${docLink(source ?? info.graphId, info.graphId)}` : null,
      linkedNodeText(info.dependsOn) ? `**Ver origem:** ${linkedNodeText(info.dependsOn)}` : null,
      linkedNodeText(info.flowsTo) ? `**Ver saída:** ${linkedNodeText(info.flowsTo)}` : null,
    ]),
  ].join('\n')
}

function buildDetailedMarkdownDocument(
  info: GearInfo,
  prepared: {
    summary: string | null
    sourcePaths: string[]
    relatedPaths: string[]
    tests: string[]
    evidence: string[]
  },
): string {
  const source = info.canonicalSource ?? prepared.sourcePaths[0] ?? info.sourcePath ?? prepared.relatedPaths[0]
  const responsibility = uniqueList([
    ...(info.decisions ?? []).map(formatHumanText),
    ...(info.capabilities ?? []).map(formatHumanText),
  ])[0]
  const before = formatHumanText(info.input) ?? linkedNodeText(info.dependsOn)
  const after = formatHumanText(info.output) ?? linkedNodeText(info.flowsTo)
  const proof = prepared.tests[0] ?? prepared.evidence[0] ?? info.observabilitySignals?.[0]
  const risk = formatHumanText(info.risk) ?? formatHumanText(info.failureModes?.[0])
  const patamar = patamarSummary(info)
  const version = versionSummary(info, patamar)
  const identity = markdownTable(['Campo', 'Valor'], [
    ['Nome humano', formatHumanText(info.humanName ?? info.productName ?? info.title) ?? info.title],
    ['Nome canônico', formatHumanText(info.canonicalName ?? info.productName ?? info.title) ?? info.title],
    ['Acrônimo', info.runtimeAcronym ?? 'Não declarado'],
    ['Superfície interna', formatHumanText(info.internalProductName) ?? 'Não declarada'],
    ['Runtime técnico', info.technicalRuntime ?? info.technicalName ?? 'Não declarado'],
    ['Tipo', formatHumanText(info.cartographyType ?? info.kind) ?? 'Não declarado'],
    ['Status', formatHumanText(info.status) ?? 'Não declarado'],
    ['Fonte canônica', source ? docLink(source, info.graphId) : 'Não declarada'],
  ])
  const flowBullets = uniqueList([
    info.childrenCount ? `**Peças internas:** ${info.childrenCount}` : null,
    linkedNodeText(info.governs) ? `**Governa:** ${linkedNodeText(info.governs)}` : null,
    linkedNodeText(info.unlocks) ? `**Libera:** ${linkedNodeText(info.unlocks)}` : null,
  ])
  const versionLine = compactSentence([
    info.versionFamily ? `família: ${formatHumanText(info.versionFamily)}` : null,
    version.detected.length ? `versões: ${version.detected.join(', ')}` : null,
    version.note,
  ])
  const proofBullets = uniqueList([
    proof ? `**Prova:** ${inlineCodeIfCommand(proof)}` : null,
    risk ? `**Risco:** ${risk}` : null,
    ...(info.forbiddenChanges ?? []).slice(0, 2).map((item) => `Não fazer: ${formatHumanText(item) ?? item}`),
  ])
  const sourceBullets = uniqueList([
    source ? `**Fonte canônica:** ${docLink(source, info.graphId)}` : null,
    ...prepared.relatedPaths.slice(0, 3).map((item) => `**Leia junto:** ${docLink(item)}`),
  ])
  const evolution = markdownTable(['Categoria', 'Leitura humana'], [
    ['Patamar', patamar.line ?? 'Patamar ainda não declarado.'],
    ['Versão', versionLine ?? 'Versão ainda não declarada.'],
    ['Próximo passo', formatHumanText(info.nextAction) ?? 'Não declarado.'],
  ])

  return [
    '## 1. Identidade',
    '',
    identity,
    '',
    '---',
    '',
    '## 2. Em uma frase',
    '',
    `> ${prepared.summary ?? 'Esta peça ainda não tem explicação simples declarada.'}`,
    '',
    bulletList(responsibility ? [`**Serve para:** ${responsibility}`] : ['**Serve para:** responsabilidade principal ainda não declarada.']),
    '',
    '---',
    '',
    '## 3. Como ler no mapa',
    '',
    `1. **Vem de:** ${before ?? 'entrada ainda não declarada.'}`,
    `2. **Esta peça faz:** ${prepared.summary ?? responsibility ?? 'função ainda não declarada.'}`,
    `3. **Entrega para:** ${after ?? 'saída ainda não declarada.'}`,
    '',
    bulletList(flowBullets),
    '',
    '---',
    '',
    '## 4. Evolução',
    '',
    evolution,
    '',
    '---',
    '',
    '## 5. Segurança',
    '',
    proof ? '> Existe prova declarada antes de alterar.' : '> Teste ou evidência ainda não declarado.',
    '',
    bulletList(proofBullets),
    '',
    '---',
    '',
    '## 6. Fonte',
    '',
    source ? 'Abra a fonte canônica antes de pedir alteração para IA.' : 'Fonte canônica ainda não declarada.',
    '',
    bulletList(sourceBullets),
  ].join('\n')
}

function buildSourceMarkdownDocument(
  info: GearInfo,
  sourceGraphId: string | null,
  note: CartographyNoteResponse | null,
  noteError: string | null,
): string {
  if (!sourceGraphId) {
    return [
      '## Fonte',
      '',
      '> Esta peça ainda não declarou graph_id para abrir a fonte dentro da Cartografia.',
    ].join('\n')
  }
  if (noteError) {
    return [
      '## Fonte',
      '',
      `> Não consegui carregar a fonte agora: ${noteError}`,
      '',
      `- **Graph id:** \`${sourceGraphId}\``,
    ].join('\n')
  }
  if (!note) {
    return [
      '## Fonte',
      '',
      '> Carregando fonte canônica...',
      '',
      `- **Graph id:** \`${sourceGraphId}\``,
    ].join('\n')
  }
  if (!note.exists) {
    return [
      '## Fonte',
      '',
      '> Fonte não encontrada no repo/vault.',
      '',
      `- **Graph id:** \`${sourceGraphId}\``,
    ].join('\n')
  }

  const frontmatter = note.frontmatter ?? {}
  const sourcePath = note.source_path ?? info.sourcePath ?? 'fonte não declarada'
  const bodyPreview = cleanSourceBody(note.body ?? '')
  return [
    '## Fonte canônica',
    '',
    markdownTable(['Campo', 'Valor'], [
      ['Graph id', `\`${sourceGraphId}\``],
      ['Arquivo', sourcePath],
      ['Status', stringFromUnknown(frontmatter.status) ?? 'Não declarado'],
      ['Tipo', stringFromUnknown(frontmatter.cartography_type) ?? stringFromUnknown(frontmatter.type) ?? 'Não declarado'],
    ]),
    '',
    '---',
    '',
    '## Leitura da fonte',
    '',
    bodyPreview || '> A fonte existe, mas não tem corpo textual disponível.',
  ].join('\n')
}

function patamarSummary(info: GearInfo): { line: string | null; versionNote: string | null } {
  const explicit = compactSentence([
    info.patamarCurrent ? `Atual: ${formatHumanText(info.patamarCurrent)}` : null,
    info.patamarNextOf ? `É próximo patamar de: ${formatHumanText(info.patamarNextOf)}` : null,
    info.patamarNext ? `Próximo: ${formatHumanText(info.patamarNext)}` : null,
    ...(info.patamarAfter ?? []).map((item) => `Depois: ${formatHumanText(item) ?? item}`),
  ])
  if (explicit) return { line: explicit, versionNote: info.versionNote ?? null }

  const haystack = uniqueList([
    info.title,
    info.subtitle,
    info.sourcePath,
    ...(info.decisions ?? []),
    ...(info.capabilities ?? []),
    ...(info.aiEntryPoints ?? []),
    ...(info.aiUsageNotes ?? []),
  ]).join(' ').toLowerCase()

  if (haystack.includes('atlas vox') || /\bvox\b/.test(haystack)) {
    return {
      line: null,
      versionNote: 'Atlas Vox V0/V3/V4/V6 são versões ou degraus, não patamares canônicos por padrão.',
    }
  }

  if (haystack.includes('self-programming safety contract')) {
    return {
      line: null,
      versionNote: 'Self-Programming Safety Contract apoia o próximo patamar, mas não é o patamar sozinho.',
    }
  }

  if (haystack.includes('self-construction')) {
    return {
      line: 'Atual: Self-Construction OS · Próximo: Self-Programming OS',
      versionNote: null,
    }
  }

  return { line: null, versionNote: detectVersionNote(info, haystack) }
}

function versionSummary(
  info: GearInfo,
  patamar: ReturnType<typeof patamarSummary>,
): { detected: string[]; note: string | null } {
  const haystack = uniqueList([
    info.title,
    info.subtitle,
    info.sourcePath,
    info.docSchema,
    info.schemaVersion,
    info.versionFamily,
    info.versionNote,
    ...(info.versions ?? []),
  ]).join(' ')

  return {
    detected: uniqueList([
      ...(info.versions ?? []),
      info.versionFamily,
      info.schemaVersion ? `schema_version: ${info.schemaVersion}` : null,
      info.docSchema ? `doc_schema: ${info.docSchema}` : null,
      ...Array.from(haystack.matchAll(/\bV\d+(?:\.\d+)?\b/gi)).map((match) => match[0]),
      haystack.toLowerCase().includes('release') ? 'release' : null,
    ]),
    note: info.versionNote ?? patamar.versionNote,
  }
}

function detectVersionNote(info: GearInfo, haystack: string): string | null {
  if (/\bv\d+\b/i.test(info.title) || /\bv\d+\b/i.test(info.subtitle ?? '') || haystack.includes('schema_version')) {
    return 'Há sinal de versão nesta peça. Versão identifica revisão, schema, release ou degrau; patamar identifica salto de maturidade.'
  }
  return null
}

function Chip({ label, tone }: { label: string; tone: 'bronze' | 'moss' | 'ink' }) {
  const c = usePalette()
  const color = tone === 'moss' ? c.moss : tone === 'ink' ? c.ink3 : c.bronze
  return (
    <View style={[styles.chip, { borderColor: color + '55', backgroundColor: color + '14' }]}>
      <Mono size={8} letterSpacing={1.1} color={color} numberOfLines={1}>
        {label.toUpperCase()}
      </Mono>
    </View>
  )
}

function ModeButton({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const c = usePalette()
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: Boolean(disabled) }}
      style={[
        styles.modeButton,
        {
          borderColor: active ? c.bronze : c.border,
          backgroundColor: active ? c.bronze + '18' : 'transparent',
          opacity: disabled ? 0.35 : 1,
        },
      ]}
    >
      <Mono size={8} letterSpacing={1.25} color={active ? c.bronze : c.ink2}>
        {label.toUpperCase()}
      </Mono>
    </Pressable>
  )
}

function ModalNavButton({
  kind,
  enabled,
  onPress,
}: {
  kind: 'previous' | 'next' | 'close'
  enabled: boolean
  onPress?: () => void
}) {
  const c = usePalette()
  const label = kind === 'previous'
    ? 'Engrenagem anterior'
    : kind === 'next'
      ? 'Próxima engrenagem'
      : 'Fechar detalhes da engrenagem'
  const d = kind === 'previous'
    ? 'M 11 4 L 6 9 L 11 14'
    : kind === 'next'
      ? 'M 7 4 L 12 9 L 7 14'
      : 'M 4 4 L 14 14 M 14 4 L 4 14'

  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [
        styles.navButton,
        { opacity: !enabled ? 0.28 : pressed ? 0.45 : 1 },
      ]}
    >
      <Svg width={18} height={18} viewBox="0 0 18 18">
        <Path d={d} stroke={c.ink2} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </Pressable>
  )
}

function uniqueList(items: ReadonlyArray<string | null | undefined>): string[] {
  return Array.from(new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item))))
}

function formatHumanText(value: string | null | undefined): string | null {
  if (!value) return null
  const raw = value.replace(/\s+/g, ' ').trim()
  if (!raw) return null
  if (raw.includes('/') || raw.includes('--') || raw.includes('.md') || raw.includes(':')) return raw
  const compact = raw.replace(/[_-]/g, ' ')
  return compact.charAt(0).toUpperCase() + compact.slice(1)
}

function docLink(path: string, graphId?: string | null): string {
  const label = path.split('/').filter(Boolean).pop() ?? path
  const target = graphId
    ? `atlas://doc/${encodeURIComponent(graphId)}`
    : `atlas://source/${encodeURIComponent(path)}`
  return `[${mdText(label)}](${target})`
}

function nodeLink(graphId: string): string {
  const label = formatHumanText(graphId) ?? graphId
  return `[${mdText(label)}](atlas://cartografia/${encodeURIComponent(graphId)})`
}

function linkedNodeText(items: ReadonlyArray<string | null | undefined> | undefined): string | null {
  const clean = uniqueList(items ?? [])
  return clean.length ? clean.map(nodeLink).join(', ') : null
}

function mdText(value: string): string {
  return value
    .replace(/\|/g, '\\|')
    .replace(/\n+/g, ' ')
    .trim()
}

function markdownTable(headers: [string, string], rows: ReadonlyArray<readonly [string, string | null | undefined]>): string {
  const cleanRows = rows.map(([label, value]) => [mdText(label), mdText(value || 'Não declarado')] as const)
  return [
    `| ${mdText(headers[0])} | ${mdText(headers[1])} |`,
    '| --- | --- |',
    ...cleanRows.map(([label, value]) => `| ${label} | ${value} |`),
  ].join('\n')
}

function inlineCodeIfCommand(value: string): string {
  const trimmed = value.trim()
  return /^(php|npm|yarn|pnpm|npx|vendor\/bin|atlas)\b/.test(trimmed)
    ? `\`${trimmed}\``
    : trimmed
}

function humanSummary(info: GearInfo): string | null {
  return formatHumanText(info.humanSummary ?? info.subtitle)
}

function primaryResponsibility(info: GearInfo): string | null {
  return uniqueList([
    ...(info.decisions ?? []).map(formatHumanText),
    ...(info.capabilities ?? []).map(formatHumanText),
  ])[0] ?? null
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function cleanSourceBody(body: string): string {
  const withoutFrontmatter = body.replace(/^---\n[\s\S]*?\n---\n?/, '').trim()
  return withoutFrontmatter
    .split('\n')
    .filter((line) => !/^<!--/.test(line.trim()))
    .slice(0, 90)
    .join('\n')
    .trim()
}

function compactSentence(items: ReadonlyArray<string | null | undefined>): string | null {
  const clean = uniqueList(items).map(formatHumanText).filter((item): item is string => Boolean(item))
  return clean.length ? clean.join(' · ') : null
}

function bulletList(items: ReadonlyArray<string | null | undefined>): string {
  const clean = uniqueList(items)
  return clean.length ? clean.map((item) => `- ${item}`).join('\n') : ''
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    elevation: 80,
    justifyContent: 'flex-end',
  },
  scrim: {
    backgroundColor: 'rgba(8, 10, 12, 0.56)',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: -12 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 24,
  },
  headerBar: {
    minHeight: 34,
    paddingHorizontal: 28,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  body: {
    gap: 14,
    paddingHorizontal: 24,
  },
  titleBlock: {
    gap: 7,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modeTabs: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 2,
  },
  modeButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  markdownDocument: {
    paddingTop: 4,
  },
})
