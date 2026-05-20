import { Fragment } from 'react'
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Frau, Mono, Sans } from '../../../design/Type'
import { usePalette } from '../../../design/theme'
import { EditorialMarkdown } from '../../console/EditorialMarkdown'

export interface GearInfo {
  title: string
  subtitle?: string | null
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
  onPrevious?: () => void
  onNext?: () => void
  hasPrevious?: boolean
  hasNext?: boolean
}

export function GearInfoModal({ info, onClose, onPrevious, onNext, hasPrevious, hasNext }: Props) {
  const c = usePalette()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const evidence = info?.evidence?.filter(Boolean) ?? []
  const tests = uniqueList([...(info?.requiredTests ?? []), ...(info?.qualityGates ?? [])])
  const sourcePaths = uniqueList([info?.sourcePath, ...(info?.repoPaths ?? [])])
  const canonicalPaths = uniqueList([...(info?.relatedPaths ?? [])])
  const summary = formatHumanText(info?.subtitle)
  const readFirstFacts = info
    ? buildReadFirstFacts(info, {
        summary,
        sourcePaths,
        canonicalPaths,
        evidence,
        tests,
      })
    : []
  const executiveBrief = info
    ? buildExecutiveBrief(info, {
        summary,
        sourcePaths,
        evidence,
        tests,
      })
    : null
  const primerCards = info
    ? buildPrimerCards(info, {
        summary,
        sourcePaths,
        canonicalPaths,
        evidence,
        tests,
      })
    : []
  const maturityPanel = info ? buildMaturityPanel(info) : null
  const nomenclatureCards = info
    ? buildNomenclatureCards(info, {
        sourcePaths,
        canonicalPaths,
      })
    : []
  const onboardingRows = info
    ? buildOnboardingRows(info, {
        summary,
        evidence,
        tests,
      })
    : []
  const manualSections = info
    ? buildManualSections(info, {
        summary,
        sourcePaths,
        canonicalPaths,
        evidence,
        tests,
      })
    : []
  const decisionBoardRows = info
    ? buildDecisionBoardRows(info, {
        summary,
        sourcePaths,
        canonicalPaths,
        evidence,
        tests,
      })
    : []
  const audienceMatrixRows = info
    ? buildAudienceMatrixRows(info, {
        summary,
        sourcePaths,
        evidence,
        tests,
      })
    : []
  const healthChecklist = info
    ? buildHealthChecklist(info, {
        summary,
        sourcePaths,
        canonicalPaths,
        evidence,
        tests,
      })
    : []
  const documentationMarkdown = info
    ? buildDocumentationMarkdown(info, {
        summary,
        sourcePaths,
        canonicalPaths,
        evidence,
        tests,
      })
    : ''
  const flowCompass = info
    ? buildFlowCompass(info, {
        summary,
      })
    : null
  const topGap = Math.max(insets.top + 24, 56)
  const sheetHeight = Math.max(360, windowHeight - topGap)

  if (!info) return null

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
        <View style={styles.sheetFrame}>
          <View style={styles.headerBar}>
            <Mono size={9} letterSpacing={1.8} color={c.bronze}>
              DOCUMENTAÇÃO DA ENGRENAGEM
            </Mono>
            <View style={styles.headerActions}>
              <ModalNavButton
                kind="previous"
                enabled={Boolean(hasPrevious && onPrevious)}
                onPress={onPrevious}
              />
              <ModalNavButton
                kind="next"
                enabled={Boolean(hasNext && onNext)}
                onPress={onNext}
              />
              <ModalNavButton kind="close" enabled onPress={onClose} />
            </View>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 34 }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Frau italic weight="med" size={27} lineHeight={32} color={c.ink}>
                {info.title}
              </Frau>
              {summary ? (
                <Sans size={14} lineHeight={20} color={c.ink2}>
                  {summary}
                </Sans>
              ) : null}
            </View>

            <View style={[styles.divider, { backgroundColor: c.border }]} />

            {executiveBrief ? <ExecutiveBrief brief={executiveBrief} /> : null}

            <View style={styles.chips}>
              {info.kind ? <Chip label={info.kind} tone="bronze" /> : null}
              {info.status ? <Chip label={info.status} tone="moss" /> : null}
              {info.source ? <Chip label={info.source} tone="ink" /> : null}
              {info.childrenCount ? <Chip label={`${info.childrenCount} peças`} tone="bronze" /> : null}
              {info.requiresEvidence ? <Chip label="exige prova" tone="bronze" /> : null}
            </View>

            <HumanAnswerGrid cards={primerCards} />

            {flowCompass ? <FlowCompass compass={flowCompass} /> : null}

            <DecisionBoard rows={decisionBoardRows} />

            {maturityPanel ? <MaturityPanel panel={maturityPanel} /> : null}

            <HumanBrief rows={onboardingRows} />

            <AudienceMatrix rows={audienceMatrixRows} />

            <HumanManualDeck sections={manualSections} health={healthChecklist} />

            <NomenclatureGuard cards={nomenclatureCards} />

            <View style={styles.quickGrid}>
              {readFirstFacts.map((fact) => (
                <QuickFact key={fact.label} label={fact.label} value={fact.value} />
              ))}
            </View>

            <ReadingIndex />

            <View style={styles.markdownDocument}>
              <EditorialMarkdown text={documentationMarkdown} tone="operational" />
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  )
}

function buildExecutiveBrief(
  info: GearInfo,
  prepared: {
    summary: string | null
    sourcePaths: string[]
    evidence: string[]
    tests: string[]
  },
): {
  headline: string
  purpose: string
  flow: Array<{ label: string; value: string; tone: 'muted' | 'strong' | 'proof' | 'warning' }>
  actions: Array<{ label: string; value: string; tone: 'normal' | 'proof' | 'warning' }>
} {
  const responsibility = uniqueList([
    ...(info.decisions ?? []).map(formatHumanText),
    ...(info.capabilities ?? []).map(formatHumanText),
  ])[0]
  const before = formatHumanText(info.input) ?? listText(info.dependsOn)
  const after = formatHumanText(info.output) ?? listText(info.flowsTo)
  const proof = prepared.tests[0] ?? prepared.evidence[0]
  const source = prepared.sourcePaths[0] ?? info.sourcePath
  const risk = formatHumanText(info.risk) ?? formatHumanText(info.failureModes?.[0])

  return {
    headline: prepared.summary ?? 'Esta peça ainda não tem resumo humano declarado.',
    purpose: responsibility ?? 'A responsabilidade principal ainda não foi declarada na documentação.',
    flow: [
      { label: 'ANTES', value: before ?? 'entrada/dependência ausente', tone: before ? 'muted' : 'warning' },
      { label: 'PEÇA', value: formatHumanText(info.title) ?? info.title, tone: 'strong' },
      { label: 'DEPOIS', value: after ?? 'saída/destino ausente', tone: after ? 'muted' : 'warning' },
      { label: 'PROVA', value: proof ?? 'teste/evidência ausente', tone: proof ? 'proof' : 'warning' },
    ],
    actions: [
      {
        label: 'Use para',
        value: responsibility ?? prepared.summary ?? 'entender a função desta peça no Atlas',
        tone: 'normal',
      },
      {
        label: 'Antes de mexer',
        value: source ? `abra a fonte: ${source}` : 'a fonte canônica precisa ser declarada',
        tone: source ? 'proof' : 'warning',
      },
      {
        label: 'Bloqueie se',
        value: risk ?? 'risco/limite não estiver claro',
        tone: risk ? 'warning' : 'normal',
      },
    ],
  }
}

function buildPrimerCards(
  info: GearInfo,
  prepared: {
    summary: string | null
    sourcePaths: string[]
    canonicalPaths: string[]
    evidence: string[]
    tests: string[]
  },
): Array<{ label: string; title: string; value: string; tone?: 'normal' | 'warning' | 'proof' }> {
  const responsibility = uniqueList([
    ...(info.decisions ?? []).map((item) => prefixedHumanText('Decide', item)),
    ...(info.capabilities ?? []).map((item) => prefixedHumanText('Capacidade', item)),
  ])[0]
  const input = formatHumanText(info.input) ?? listText(info.dependsOn)
  const output = formatHumanText(info.output) ?? listText(info.flowsTo)
  const proof = prepared.tests[0] ?? prepared.evidence[0]
  const risk = formatHumanText(info.risk) ?? formatHumanText(info.failureModes?.[0])
  const source = prepared.sourcePaths[0]
  const next = formatHumanText(info.nextAction) ?? formatHumanText(info.aiEntryPoints?.[0])

  return [
    {
      label: 'RESPOSTA CURTA',
      title: 'O que é',
      value: prepared.summary ?? 'A documentação ainda não escreveu a explicação simples desta peça.',
    },
    {
      label: 'PROPÓSITO',
      title: 'Para que existe',
      value: responsibility ?? 'Responsabilidade principal ainda não declarada.',
    },
    {
      label: 'CAMINHO',
      title: 'Como entra e sai',
      value: compactSentence([input ?? 'entrada não declarada', '→', output ?? 'saída não declarada'])
        ?? 'Entrada e saída ainda não declaradas.',
    },
    {
      label: 'PROVA',
      title: 'Como confiar',
      value: proof ?? 'Teste, evidência ou sinal observável ainda não declarado.',
      tone: proof ? 'proof' : 'warning',
    },
    {
      label: 'CUIDADO',
      title: 'O que pode quebrar',
      value: risk ?? 'Risco principal ainda não declarado. Não peça alteração para IA sem checar regras e fonte.',
      tone: 'warning',
    },
    {
      label: 'ORIGEM',
      title: 'Onde está a verdade',
      value: source ?? prepared.canonicalPaths[0] ?? 'Fonte canônica ainda não declarada.',
    },
    {
      label: 'AÇÃO',
      title: 'Próximo passo',
      value: next ?? 'Próxima ação ainda não declarada.',
    },
  ]
}

function buildMaturityPanel(info: GearInfo): {
  patamarRows: Array<{ label: string; value: string; present: boolean }>
  versionRows: Array<{ label: string; value: string; present: boolean }>
  warning: string
} {
  const patamar = buildPatamarSummary(info)
  const version = buildVersionSummary(info, patamar)

  return {
    patamarRows: [
      {
        label: 'Patamar atual',
        value: patamar.current ?? 'Não declarado',
        present: Boolean(patamar.current),
      },
      {
        label: 'É próximo patamar de',
        value: patamar.nextOf ?? 'Não declarado',
        present: Boolean(patamar.nextOf),
      },
      {
        label: 'Próximo patamar',
        value: patamar.next ?? 'Não declarado',
        present: Boolean(patamar.next),
      },
      {
        label: 'Outros patamares depois',
        value: patamar.after.length ? patamar.after.join(' · ') : 'Não declarado',
        present: Boolean(patamar.after.length),
      },
    ],
    versionRows: [
      {
        label: 'Família de versão',
        value: info.versionFamily ? formatHumanText(info.versionFamily) ?? info.versionFamily : 'Não declarada',
        present: Boolean(info.versionFamily),
      },
      {
        label: 'Versões / degraus',
        value: version.detected.length ? version.detected.join(' · ') : 'Não declaradas',
        present: Boolean(version.detected.length),
      },
      {
        label: 'Nota de versão',
        value: version.note ?? 'Não declarada',
        present: Boolean(version.note),
      },
    ],
    warning: 'Patamar é salto de maturidade. Próximo patamar não é próximo bloco, camada, fonte, fluxo, unlock nem versão.',
  }
}

function buildManualSections(
  info: GearInfo,
  prepared: {
    summary: string | null
    sourcePaths: string[]
    canonicalPaths: string[]
    evidence: string[]
    tests: string[]
  },
): Array<{
  title: string
  kicker: string
  answer: string
  bullets: string[]
  tone?: 'normal' | 'proof' | 'warning'
}> {
  const patamar = buildPatamarSummary(info)
  const version = buildVersionSummary(info, patamar)
  const responsibility = uniqueList([
    ...(info.decisions ?? []).map((item) => prefixedHumanText('Decide', item)),
    ...(info.capabilities ?? []).map((item) => prefixedHumanText('Capacidade', item)),
  ])
  const flowIn = formatHumanText(info.input) ?? listText(info.dependsOn)
  const flowOut = formatHumanText(info.output) ?? listText(info.flowsTo)
  const proof = uniqueList([...(prepared.tests ?? []), ...(prepared.evidence ?? []), ...(info.observabilitySignals ?? [])])
  const source = uniqueList([...prepared.sourcePaths, ...prepared.canonicalPaths])
  const limits = uniqueList([
    ...(info.allowedChanges ?? []).map((item) => prefixedHumanText('Pode mudar', item)),
    ...(info.forbiddenChanges ?? []).map((item) => prefixedHumanText('Não pode mudar', item)),
  ])
  const risks = uniqueList([
    formatHumanText(info.risk),
    ...(info.failureModes ?? []).map((item) => prefixedHumanText('Falha possível', item)),
  ])
  const patamarBullets = uniqueList([
    patamar.current ? `Patamar atual: ${patamar.current}` : null,
    patamar.nextOf ? `É próximo patamar de: ${patamar.nextOf}` : null,
    patamar.next ? `Próximo patamar: ${patamar.next}` : null,
    ...patamar.after.map((item) => `Depois: ${item}`),
    !patamar.current && !patamar.nextOf && !patamar.next && !patamar.after.length
      ? 'Patamar ainda não declarado. Não inferir por camada, fonte, versão ou próximo bloco.'
      : null,
  ])
  const versionBullets = uniqueList([
    info.versionFamily ? `Família: ${formatHumanText(info.versionFamily)}` : null,
    ...version.detected.map((item) => `Versão/degrau: ${item}`),
    version.note,
    !version.detected.length && !version.note ? 'Versão ainda não declarada.' : null,
  ])

  return [
    {
      kicker: '1 · RESPOSTA PARA HUMANO',
      title: 'O que é e por que existe',
      answer: prepared.summary ?? 'A documentação ainda não escreveu uma resposta simples para esta peça.',
      bullets: responsibility.length
        ? responsibility
        : ['Responsabilidade principal ainda não declarada.'],
    },
    {
      kicker: '2 · FLUXO VERDADEIRO',
      title: 'Como entra, trabalha e entrega',
      answer: compactSentence([flowIn ?? 'entrada não declarada', '→', flowOut ?? 'saída não declarada'])
        ?? 'Entrada e saída ainda não declaradas.',
      bullets: uniqueList([
        flowIn ? `Entra de: ${flowIn}` : 'Entrada anterior ausente na documentação.',
        prepared.summary ? `Faz: ${prepared.summary}` : null,
        flowOut ? `Entrega para: ${flowOut}` : 'Saída/próximo destino ausente na documentação.',
      ]),
    },
    {
      kicker: '3 · MATURIDADE',
      title: 'Patamares, sem misturar com versão',
      answer: 'Patamar é salto de capacidade/maturidade. Versão é revisão, release ou degrau da mesma peça.',
      bullets: patamarBullets,
    },
    {
      kicker: '4 · VERSÕES',
      title: 'Versões ficam em outro lugar',
      answer: version.meaning ?? 'Use esta seção só para release, schema, fase ou degrau de produto.',
      bullets: versionBullets,
    },
    {
      kicker: '5 · PROVAS',
      title: 'Como confiar antes de pedir IA',
      answer: proof.length
        ? 'Existe prova declarada. Use antes de alterar código, doc, contrato ou prompt.'
        : 'A documentação ainda não declarou prova suficiente.',
      bullets: proof.length ? proof : ['Teste, evidência ou sinal observável ausente.'],
      tone: proof.length ? 'proof' : 'warning',
    },
    {
      kicker: '6 · LIMITES',
      title: 'O que pode quebrar ou não pode mudar',
      answer: risks[0] ?? 'Risco principal ainda não declarado.',
      bullets: uniqueList([...limits, ...risks]).length
        ? uniqueList([...limits, ...risks])
        : ['Regras, riscos e limites ainda não declarados.'],
      tone: risks.length ? 'warning' : 'normal',
    },
    {
      kicker: '7 · FONTES',
      title: 'Onde está a verdade canônica',
      answer: source.length
        ? 'Leia estes arquivos antes de pedir alteração. Fonte não é patamar, versão, regra nem prova.'
        : 'Fonte ou documentação relacionada ainda não declarada.',
      bullets: source.length ? source : ['Arquivo canônico ausente.'],
    },
  ]
}

function buildDecisionBoardRows(
  info: GearInfo,
  prepared: {
    summary: string | null
    sourcePaths: string[]
    canonicalPaths: string[]
    evidence: string[]
    tests: string[]
  },
): Array<{ label: string; question: string; answer: string; tone?: 'normal' | 'warning' | 'proof' }> {
  const patamar = buildPatamarSummary(info)
  const version = buildVersionSummary(info, patamar)
  const responsibility = uniqueList([
    ...(info.decisions ?? []).map(formatHumanText),
    ...(info.capabilities ?? []).map(formatHumanText),
  ])[0]
  const input = formatHumanText(info.input) ?? listText(info.dependsOn)
  const output = formatHumanText(info.output) ?? listText(info.flowsTo)
  const proof = prepared.tests[0] ?? prepared.evidence[0] ?? info.observabilitySignals?.[0]
  const forbidden = info.forbiddenChanges?.[0] ?? info.failureModes?.[0] ?? info.risk
  const source = prepared.sourcePaths[0] ?? prepared.canonicalPaths[0]
  const patamarAnswer = buildPatamarReadableSentence(patamar)
  const versionAnswer = compactSentence([
    info.versionFamily ? `família: ${formatHumanText(info.versionFamily)}` : null,
    version.detected.length ? version.detected.join(', ') : null,
    version.note,
  ])

  return [
    {
      label: 'ESSÊNCIA',
      question: 'O que é?',
      answer: prepared.summary ?? 'A documentação ainda não declarou uma explicação simples.',
    },
    {
      label: 'PROPÓSITO',
      question: 'Para que existe?',
      answer: responsibility ?? 'Responsabilidade principal ainda não declarada.',
    },
    {
      label: 'ENTRADA',
      question: 'O que precisa chegar antes?',
      answer: input ?? 'Entrada/dependência ainda não declarada.',
    },
    {
      label: 'SAÍDA',
      question: 'O que entrega depois?',
      answer: output ?? 'Saída/próximo destino ainda não declarado.',
    },
    {
      label: 'PROVA',
      question: 'Como eu confio?',
      answer: proof ?? 'Teste, evidência ou sinal observável ainda não declarado.',
      tone: proof ? 'proof' : 'warning',
    },
    {
      label: 'LIMITE',
      question: 'O que não posso fazer?',
      answer: formatHumanText(forbidden) ?? 'Limite crítico ainda não declarado.',
      tone: 'warning',
    },
    {
      label: 'FONTE',
      question: 'Onde está a verdade?',
      answer: source ?? 'Fonte canônica ainda não declarada.',
    },
    {
      label: 'PATAMAR',
      question: 'Qual maturidade declarou?',
      answer: patamarAnswer ?? 'Patamar ainda não declarado. Não inferir por fluxo, camada, fonte ou versão.',
    },
    {
      label: 'VERSÃO',
      question: 'Tem revisão/degrau?',
      answer: versionAnswer ?? 'Versão, schema ou release ainda não declarado.',
    },
  ]
}

function buildAudienceMatrixRows(
  info: GearInfo,
  prepared: {
    summary: string | null
    sourcePaths: string[]
    evidence: string[]
    tests: string[]
  },
): Array<{ area: string; read: string; decision: string }> {
  const audience = buildAudienceRows(info, prepared.summary)
  const source = prepared.sourcePaths[0] ?? 'fonte canônica ainda não declarada'
  const proof = prepared.tests[0] ?? prepared.evidence[0] ?? 'prova ainda não declarada'
  const risk = formatHumanText(info.risk) ?? formatHumanText(info.failureModes?.[0]) ?? 'risco ainda não declarado'
  const forbidden = formatHumanText(info.forbiddenChanges?.[0]) ?? 'limite proibido ainda não declarado'

  return audience.map(([area, read]) => {
    let decision = `Confirmar fonte: ${source}`
    if (area === 'Diretoria') decision = `Decidir prioridade com risco: ${risk}`
    if (area === 'Produto / Operação') decision = `Conferir fluxo e prova: ${proof}`
    if (area === 'Marketing / Comunicação') decision = `Não prometer capacidade sem prova: ${proof}`
    if (area === 'Suporte') decision = `Triar falha usando risco: ${risk}`
    if (area === 'Financeiro / Jurídico') decision = `Bloquear se violar: ${forbidden}`
    if (area === 'Tech / IA') decision = `Antes de alterar, rodar/verificar: ${proof}`
    if (area === 'Parceiros') decision = `Compartilhar só o que a fonte permite: ${source}`
    return { area, read, decision }
  })
}

function buildNomenclatureCards(
  info: GearInfo,
  prepared: {
    sourcePaths: string[]
    canonicalPaths: string[]
  },
): Array<{ label: string; question: string; value: string }> {
  const patamar = buildPatamarSummary(info)
  const version = buildVersionSummary(info, patamar)
  return buildNomenclatureRows(info, prepared, patamar, version).map(([label, value]) => ({
    label,
    question: nomenclatureQuestion(label),
    value: value ?? 'Não declarado',
  }))
}

function buildHealthChecklist(
  info: GearInfo,
  prepared: {
    summary: string | null
    sourcePaths: string[]
    canonicalPaths: string[]
    evidence: string[]
    tests: string[]
  },
): Array<{ label: string; ok: boolean; detail: string }> {
  const patamar = buildPatamarSummary(info)
  const version = buildVersionSummary(info, patamar)
  return [
    {
      label: 'Resumo humano',
      ok: Boolean(prepared.summary),
      detail: prepared.summary ? 'explica o que é' : 'ausente',
    },
    {
      label: 'Fluxo de entrada/saída',
      ok: Boolean(info.input || info.output || info.dependsOn?.length || info.flowsTo?.length),
      detail: 'entrada, saída ou relação operacional',
    },
    {
      label: 'Responsabilidade',
      ok: Boolean(info.decisions?.length || info.capabilities?.length),
      detail: 'decisão ou capacidade principal',
    },
    {
      label: 'Patamar',
      ok: Boolean(patamar.current || patamar.next || patamar.nextOf || patamar.after.length),
      detail: 'maturidade declarada, sem inferência',
    },
    {
      label: 'Versão',
      ok: Boolean(version.detected.length || version.note),
      detail: 'release/degrau separado de patamar',
    },
    {
      label: 'Testes e evidências',
      ok: Boolean(prepared.tests.length || prepared.evidence.length),
      detail: 'teste, evidência ou gate',
    },
    {
      label: 'Governança',
      ok: Boolean(info.owner || info.category || info.docSchema),
      detail: 'dono, categoria ou schema',
    },
    {
      label: 'Fonte canônica',
      ok: Boolean(prepared.sourcePaths.length),
      detail: 'arquivo canônico do repo',
    },
    {
      label: 'Documentação relacionada',
      ok: Boolean(prepared.canonicalPaths.length),
      detail: 'leituras auxiliares',
    },
  ]
}

function nomenclatureQuestion(label: string): string {
  switch (label) {
    case 'Patamar':
      return 'Qual salto de maturidade foi declarado?'
    case 'Versão':
      return 'Qual revisão, fase ou degrau da mesma peça?'
    case 'Fonte':
      return 'Onde a verdade vive no repositório?'
    case 'Documentação relacionada':
      return 'O que precisa ser lido junto?'
    case 'Camada visual':
      return 'Onde aparece no mapa?'
    case 'Regra':
      return 'O que pode ou não pode mudar?'
    case 'Risco':
      return 'O que quebra se estiver errado?'
    case 'Prova':
      return 'Como validar que está correto?'
    default:
      return 'Que categoria documental é esta?'
  }
}

function buildOnboardingRows(
  info: GearInfo,
  prepared: {
    summary: string | null
    evidence: string[]
    tests: string[]
  },
): Array<{ label: string; value: string }> {
  const patamar = buildPatamarSummary(info)
  const version = buildVersionSummary(info, patamar)
  const flow = compactSentence([
    formatHumanText(info.input) ?? listText(info.dependsOn),
    '→',
    prepared.summary ?? formatHumanText(info.title),
    '→',
    formatHumanText(info.output) ?? listText(info.flowsTo),
  ])
  const maturity = compactSentence([
    patamar.current ? `Patamar atual: ${patamar.current}` : null,
    patamar.nextOf ? `É próximo patamar de: ${patamar.nextOf}` : null,
    patamar.next ? `Próximo patamar: ${patamar.next}` : null,
    !patamar.current && !patamar.nextOf && !patamar.next
      ? 'Patamar ainda não declarado'
      : null,
    version.detected.length || version.note
      ? 'Versão fica separada de patamar'
      : null,
  ])
  const proof = prepared.tests[0] ?? prepared.evidence[0] ?? 'Prova ainda não declarada'
  const caution = formatHumanText(info.risk)
    ?? formatHumanText(info.failureModes?.[0])
    ?? 'Não pedir alteração para IA sem checar fonte, regra, risco e teste.'

  return [
    {
      label: '1 · ENTENDA',
      value: prepared.summary ?? 'A documentação ainda não explicou esta peça em linguagem humana.',
    },
    {
      label: '2 · CAMINHO',
      value: flow ?? 'A documentação ainda não declarou entrada, processamento e saída.',
    },
    {
      label: '3 · MATURIDADE',
      value: maturity ?? 'Patamar e versão ainda não foram declarados.',
    },
    {
      label: '4 · PROVA',
      value: `${proof}. Cuidado: ${caution}`,
    },
  ]
}

function buildFlowCompass(
  info: GearInfo,
  prepared: {
    summary: string | null
  },
): {
  before: string
  current: string
  after: string
  proof: string
} {
  return {
    before: formatHumanText(info.dependsOn?.[0]) ?? formatHumanText(info.input) ?? 'Entrada ainda não declarada',
    current: prepared.summary ?? formatHumanText(info.title) ?? 'Responsabilidade ainda não declarada',
    after: formatHumanText(info.flowsTo?.[0]) ?? formatHumanText(info.output) ?? 'Saída ainda não declarada',
    proof: uniqueList([...(info.requiredTests ?? []), ...(info.qualityGates ?? []), ...(info.evidence ?? [])])[0]
      ?? 'Prova ainda não declarada',
  }
}

function buildReadFirstFacts(
  info: GearInfo,
  prepared: {
    summary: string | null
    sourcePaths: string[]
    canonicalPaths: string[]
    evidence: string[]
    tests: string[]
  },
): Array<{ label: string; value: string }> {
  const patamar = buildPatamarSummary(info)
  const responsibility = uniqueList([
    ...(info.decisions ?? []).map((item) => prefixedHumanText('Decide', item)),
    ...(info.capabilities ?? []).map((item) => prefixedHumanText('Capacidade', item)),
  ])[0]
  const before = formatHumanText(info.dependsOn?.[0]) ?? formatHumanText(info.input)
  const after = formatHumanText(info.flowsTo?.[0]) ?? formatHumanText(info.output)
  const proof = prepared.tests[0] ?? prepared.evidence[0]
  const alert = formatHumanText(info.risk) ?? formatHumanText(info.failureModes?.[0])
  const governance = formatHumanText(info.owner) ?? formatHumanText(info.category)
  const patamarSummary = compactSentence([
    patamar.current ? `Atual: ${patamar.current}` : null,
    patamar.nextOf ? `É próximo patamar de: ${patamar.nextOf}` : null,
    patamar.next ? `Próximo: ${patamar.next}` : null,
    ...patamar.after.map((item) => `Depois: ${item}`),
  ])
  const versionSummary = buildVersionSummary(info, patamar)
  const versionFact = compactSentence([
    info.versionFamily ? `Família: ${formatHumanText(info.versionFamily)}` : null,
    versionSummary.detected.length ? `Versões/degraus: ${versionSummary.detected.join(', ')}` : null,
    versionSummary.note ? `Nota: ${versionSummary.note}` : null,
  ])
  const operation = formatHumanText(info.input) && formatHumanText(info.output)
    ? `${formatHumanText(info.input)} → ${formatHumanText(info.output)}`
    : before && after
      ? `${before} → ${after}`
      : null

  return [
    { label: 'O QUE É', value: prepared.summary ?? 'A documentação ainda não explica esta peça em linguagem humana.' },
    { label: 'PARA QUE EXISTE', value: responsibility ?? 'Responsabilidade principal ainda não declarada.' },
    { label: 'COMO FUNCIONA', value: operation ?? 'Entrada e saída ainda não declaradas.' },
    { label: 'DONO / GOVERNANÇA', value: governance ?? 'Dono ou categoria ainda não declarado.' },
    { label: 'ENTRA DE', value: before ?? 'Entrada anterior ainda não declarada.' },
    { label: 'ENTREGA PARA', value: after ?? 'Saída ou próxima peça ainda não declarada.' },
    { label: 'PATAMARES', value: patamarSummary ?? 'Patamar de maturidade ainda não declarado.' },
    { label: 'VERSÕES', value: versionFact ?? 'Versão, release ou schema ainda não declarado.' },
    { label: 'COMO PROVAR', value: proof ?? 'Teste/evidência ainda não declarado.' },
    { label: 'CUIDADO', value: alert ?? 'Risco principal ainda não declarado.' },
  ]
}

function buildDocumentationMarkdown(
  info: GearInfo,
  prepared: {
    summary: string | null
    sourcePaths: string[]
    canonicalPaths: string[]
    evidence: string[]
    tests: string[]
  },
): string {
  const patamar = buildPatamarSummary(info)
  const version = buildVersionSummary(info, patamar)
  const mainResponsibilities = uniqueList([
    ...(info.decisions ?? []).map((item) => boldPrefixedHumanText('Decide', item)),
    ...(info.capabilities ?? []).map((item) => boldPrefixedHumanText('Capacidade', item)),
  ])

  const flowRows = ([
    ['Chega aqui', info.input],
    ['Precisa antes', listText(info.dependsOn)],
    ['Entrega', info.output],
    ['Vai para', listText(info.flowsTo)],
    ['Libera', listText(info.unlocks)],
    ['Governa', listText(info.governs)],
  ] as Array<[string, string | null | undefined]>).filter(([, value]) => Boolean(value))

  const limitItems = [
    ...(info.allowedChanges ?? []).map((item) => boldPrefixedHumanText('Pode mudar', item)),
    ...(info.forbiddenChanges ?? []).map((item) => boldPrefixedHumanText('Não pode mudar', item)),
  ]

  const riskItems = [
    info.risk ? `**Nível de risco:** ${mdText(formatHumanText(info.risk))}` : null,
    ...(info.failureModes ?? []).map((item) => boldPrefixedHumanText('Pode falhar se', item)),
  ]

  const proofItems = [
    ...prepared.evidence.map((item) => `**Evidência:** \`${mdCode(item)}\``),
    ...prepared.tests.map((item) => `**Teste automático:** \`${mdCode(item)}\``),
    ...(info.observabilitySignals ?? []).map((item) => boldPrefixedHumanText('Sinal observável', item)),
  ]

  const architectureItems = [
    info.graphLayer ? `**Camada visual:** ${mdText(formatHumanText(info.graphLayer))}` : null,
    info.parent ? `**Peça pai:** ${mdText(formatHumanText(info.parent))}` : null,
    info.world ? `**Universo:** ${mdText(formatHumanText(info.world))}` : null,
    ...(info.visualTags ?? []).map((tag) => `**Tag visual:** ${mdText(formatHumanText(tag))}`),
  ]

  const governanceItems = [
    info.owner ? `**Dono:** ${mdText(formatHumanText(info.owner))}` : null,
    info.category ? `**Categoria documental:** ${mdText(formatHumanText(info.category))}` : null,
    info.priority != null ? `**Prioridade:** ${mdText(String(info.priority))}` : null,
    info.docSchema ? `**Schema da documentação:** \`${mdCode(info.docSchema)}\`` : null,
    info.lineLimit != null ? `**Limite de linhas:** ${mdText(String(info.lineLimit))}` : null,
    ...(info.maintenance ?? []).map((item) => boldPrefixedHumanText('Manutenção', item)),
  ]

  const patamarItems = [
    patamar.current ? `**Patamar atual:** ${mdText(patamar.current)}` : null,
    patamar.nextOf ? `**É próximo patamar de:** ${mdText(patamar.nextOf)}` : null,
    patamar.next ? `**Próximo patamar:** ${mdText(patamar.next)}` : null,
    ...patamar.after.map((item) => `**Outros patamares depois:** ${mdText(item)}`),
    !patamar.current && !patamar.next && !patamar.nextOf && !patamar.after.length
      ? 'Não declarado.'
      : null,
  ]
  const versionItems = [
    version.detected.length
      ? `**Versões/degraus citados:** ${version.detected.map((item) => `\`${mdCode(item)}\``).join(', ')}`
      : null,
    version.note ? `**Nota:** ${mdText(version.note)}` : null,
    !version.detected.length && !version.note
      ? 'Não declarado.'
      : null,
  ]

  const nextItems = [
    info.nextAction ? mdText(formatHumanText(info.nextAction)) : null,
    ...(info.aiEntryPoints ?? []).map((item) => mdText(formatHumanText(item))),
    ...(info.aiUsageNotes ?? []).map((item) => mdText(formatHumanText(item))),
  ]
  const audienceRows = buildAudienceRows(info, prepared.summary)
  const healthRows = buildDocumentationHealthRows(info, prepared, patamar, version)
  const essentialQuestions = buildEssentialQuestionRows(info, prepared, patamar)
  const nomenclatureRows = buildNomenclatureRows(info, prepared, patamar, version)
  const mapItems = labeledMarkdownList([
    ['Tipo de peça', info.kind],
    ['Status atual', info.status],
    ['Origem da verdade', info.source],
    ['Mundo', info.world],
    ['Dono', info.owner],
    ['Categoria documental', info.category],
    ['Patamar atual', patamar.current],
    ['Próximo patamar', patamar.next],
    ['Camada visual', info.graphLayer],
    ['Peça pai', info.parent],
    ['Peças internas', info.childrenCount ? String(info.childrenCount) : null],
  ])

  const operationalItems = orderedMarkdownList([
    ['Recebe', info.input ?? listText(info.dependsOn)],
    ['Faz', prepared.summary],
    ['Decide ou executa', listText(info.decisions) ?? listText(info.capabilities)],
    ['Entrega', info.output ?? listText(info.flowsTo)],
    ['Libera', listText(info.unlocks)],
    ['Governa', listText(info.governs)],
  ])

  const sourceLines = [
    ...prepared.sourcePaths.map((path) => `- \`${mdCode(path)}\``),
  ]
  const canonicalDocLines = [
    ...prepared.canonicalPaths.map((path) => `- \`${mdCode(path)}\``),
  ]
  const decisionTable = markdownTable(
    ['Pergunta', 'Resposta'],
    buildDecisionBoardRows(info, prepared).map((row) => [row.question, row.answer]),
  )
  const audienceTable = markdownTable(
    ['Área', 'Como ler', 'Decisão segura'],
    buildAudienceMatrixRows(info, prepared).map((row) => [row.area, row.read, row.decision]),
  )
  const nomenclatureTable = markdownTable(
    ['Categoria', 'Resposta correta'],
    nomenclatureRows.map(([label, value]) => [label, value ?? 'Não declarado']),
  )

  return [
    '# Documentação humana',
    '',
    '## 0. Como ler este modal',
    'Use esta ordem para qualquer área do time: **entenda a peça → veja o caminho → confira maturidade → valide prova → só então peça alteração para IA**.',
    '',
    orderedMarkdownList([
      ['Entenda', prepared.summary],
      ['Caminho', compactSentence([info.input ?? listText(info.dependsOn), '→', info.output ?? listText(info.flowsTo)])],
      ['Maturidade', patamar.current || patamar.next || patamar.nextOf ? buildPatamarReadableSentence(patamar) : 'patamar ainda não declarado'],
      ['Prova', prepared.tests[0] ?? prepared.evidence[0]],
      ['Cuidado', info.risk ?? info.failureModes?.[0]],
    ]) || 'A documentação ainda não tem informação suficiente para uma leitura guiada.',
    '',
    '### Quadro de decisão',
    decisionTable,
    '',
    '## 1. Resposta em 30 segundos',
    prepared.summary
      ? `> ${mdText(prepared.summary)}`
      : '> A documentação ainda não declarou uma explicação simples para esta engrenagem.',
    '',
    '### Perguntas essenciais',
    labeledMarkdownList(essentialQuestions) || 'A documentação ainda não responde às perguntas essenciais.',
    '',
    '### Saúde documental',
    bulletList(healthRows, 'A documentação ainda não tem campos suficientes para medir completude.'),
    '',
    bulletList([
      info.kind ? `**Que tipo de coisa é:** ${mdText(formatHumanText(info.kind))}` : null,
      info.status ? `**Estado atual:** ${mdText(formatHumanText(info.status))}` : null,
      info.childrenCount ? `**Tem por dentro:** ${info.childrenCount} peça(s) visual(is).` : null,
      prepared.tests.length || prepared.evidence.length
        ? '**Confiabilidade:** existe prova/teste declarado; confira a seção de evidências antes de alterar.'
        : '**Confiabilidade:** ainda falta prova/teste declarado na documentação.',
    ], 'A documentação ainda não tem o mínimo para leitura executiva.'),
    '',
    '## 2. Responsabilidade',
    'Esta seção responde: **por que esta peça existe e o que ela deve proteger**.',
    '',
    bulletList(mainResponsibilities, 'A documentação ainda não declarou responsabilidade, capacidade ou decisão principal.'),
    '',
    '## 3. Leitura por área',
    'Use esta parte para explicar a peça para alguém novo no Atlas sem obrigar a pessoa a ler a pasta inteira.',
    '',
    audienceTable,
    '',
    bulletList(
      audienceRows.map(([area, value]) => `**${mdText(area)}:** ${mdText(value)}`),
      'A documentação ainda não tem tradução por área.',
    ),
    '',
    '## 4. Fluxo operacional',
    'Leia como uma sequência: **entrada → processamento → saída → prova**.',
    '',
    operationalItems || 'A documentação ainda não declarou o ciclo de operação desta peça.',
    '',
    '### Contratos de entrada e saída',
    labeledMarkdownList(flowRows) || 'A documentação ainda não declarou entrada, saída ou caminho no fluxo.',
    '',
    '## 5. Limites de mudança',
    'Use esta parte antes de pedir para uma IA alterar código, documentação, contrato, prompt, automação ou regra de negócio.',
    '',
    bulletList(limitItems, 'A documentação ainda não declarou o que pode ou não pode mudar.'),
    '',
    '## 6. Riscos e falhas',
    'Se a peça estiver errada, esta seção mostra o que pode quebrar e onde olhar primeiro.',
    '',
    bulletList(riskItems, 'A documentação ainda não declarou risco ou modo de falha.'),
    '',
    '## 7. Evidências e testes',
    'Nada aqui deve ser tratado como pronto sem prova. Quando existir teste automático, ele precisa aparecer nesta seção.',
    '',
    bulletList(proofItems, 'A documentação ainda não declarou evidência, teste automático ou sinal observável.'),
    '',
    '## 8. Próximas ações',
    bulletList(nextItems, 'A documentação ainda não declarou próxima ação.'),
    '',
    '## 9. Governança',
    'Esta seção responde quem cuida da peça e quais metadados documentais controlam manutenção. Governança não é patamar, versão, fonte nem camada.',
    '',
    bulletList(governanceItems, 'A documentação ainda não declarou dono, categoria, prioridade, schema ou regra de manutenção.'),
    '',
    '## 10. Nomenclatura: não confundir',
    'Use esta seção como trava de segurança antes de pedir implementação para IA. Cada categoria abaixo responde uma pergunta diferente; misturar categorias cria mapa falso.',
    '',
    nomenclatureTable,
    '',
    labeledMarkdownList(nomenclatureRows) || 'A documentação ainda não tem dados suficientes para separar nomenclatura.',
    '',
    '## 11. Patamares',
    bulletList(patamarItems, 'Não declarado.'),
    '',
    '## 12. Versões',
    bulletList(versionItems, 'Não declarado.'),
    '',
    '## 13. Posição no mapa',
    'Esta seção é só localização arquitetural/visual. Não confundir com patamar de maturidade.',
    '',
    bulletList([...architectureItems, mapItems].filter(Boolean), 'A documentação ainda não declarou posição visual/arquitetural.'),
    '',
    '## 14. Arquivos canônicos',
    'Fonte canônica é onde a verdade vive no repositório. Ela fica separada de patamar, risco e regra.',
    '',
    [
      info.childrenCount ? `- **Peças internas visuais:** ${info.childrenCount}` : null,
      sourceLines.length ? sourceLines.join('\n') : null,
    ].filter(Boolean).join('\n') || 'A documentação ainda não declarou arquivo fonte canônico.',
    '',
    '## 15. Documentação relacionada',
    'Use esta lista para estudar o contexto antes de pedir alteração para uma IA. Ela não é patamar, versão, regra ou prova; é leitura canônica auxiliar.',
    '',
    canonicalDocLines.length ? canonicalDocLines.join('\n') : 'A documentação ainda não declarou documentos relacionados.',
  ].join('\n')
}

function buildPatamarReadableSentence(patamar: ReturnType<typeof buildPatamarSummary>): string | null {
  return compactSentence([
    patamar.current ? `Atual: ${patamar.current}` : null,
    patamar.nextOf ? `É próximo patamar de: ${patamar.nextOf}` : null,
    patamar.next ? `Próximo: ${patamar.next}` : null,
    ...patamar.after.map((item) => `Depois: ${item}`),
  ])
}

function buildVersionSummary(
  info: GearInfo,
  patamar: ReturnType<typeof buildPatamarSummary>,
): {
  detected: string[]
  note: string | null
  meaning: string | null
} {
  const haystack = uniqueList([
    info.title,
    info.subtitle,
    info.sourcePath,
    info.docSchema,
    info.schemaVersion,
    info.versionFamily,
    info.versionNote,
    ...(info.versions ?? []),
    ...(info.decisions ?? []),
    ...(info.capabilities ?? []),
    ...(info.aiEntryPoints ?? []),
    ...(info.aiUsageNotes ?? []),
  ]).join(' ')
  const detected = uniqueList([
    ...(info.versions ?? []),
    info.versionFamily,
    info.schemaVersion ? `schema_version: ${info.schemaVersion}` : null,
    info.docSchema ? `doc_schema: ${info.docSchema}` : null,
    ...Array.from(haystack.matchAll(/\bV\d+(?:\.\d+)?\b/g)).map((match) => match[0]),
    ...Array.from(haystack.matchAll(/\bv\d+(?:\.\d+)?\b/g)).map((match) => match[0]),
    haystack.toLowerCase().includes('schema_version') ? 'schema_version' : null,
    haystack.toLowerCase().includes('release') ? 'release' : null,
  ])

  return {
    detected,
    note: info.versionNote ?? patamar.versionNote ?? detectVersionNote(info, haystack.toLowerCase()),
    meaning: detected.length
      ? 'Leia como revisão ou degrau interno da mesma peça. Só trate como patamar quando a documentação declarar salto de capacidade/maturidade.'
      : patamar.versionNote
        ? 'Existe uma nota de versão porque a peça usa rótulos de versão/degrau, mas isso foi separado de patamar.'
        : null,
  }
}

function buildPatamarSummary(info: GearInfo): {
  current: string | null
  next: string | null
  nextOf: string | null
  after: string[]
  versionNote: string | null
  meaning: string | null
} {
  if (info.patamarCurrent || info.patamarNext || info.patamarNextOf || info.patamarAfter?.length) {
    return {
      current: info.patamarCurrent ? formatHumanText(info.patamarCurrent) : null,
      next: info.patamarNext ? formatHumanText(info.patamarNext) : null,
      nextOf: info.patamarNextOf ? formatHumanText(info.patamarNextOf) : null,
      after: (info.patamarAfter ?? []).map(formatHumanText).filter((item): item is string => Boolean(item)),
      versionNote: info.versionNote ?? null,
      meaning: 'Esta relação veio de campos canônicos de patamar na documentação, não de camada, fonte, versão ou chute por nome.',
    }
  }

  const title = `${info.title} ${info.layer ?? ''} ${info.graphLayer ?? ''}`.toLowerCase()
  const pathHint = `${info.sourcePath ?? ''}`.toLowerCase()
  const mentions = uniqueList([
    info.title,
    info.subtitle,
    info.layer,
    info.graphLayer,
    ...(info.decisions ?? []),
    ...(info.capabilities ?? []),
    ...(info.flowsTo ?? []),
    ...(info.unlocks ?? []),
    ...(info.aiEntryPoints ?? []),
    ...(info.aiUsageNotes ?? []),
  ]).join(' ').toLowerCase()

  if (title.includes('vox') || mentions.includes('atlas vox')) {
    return {
      current: null,
      next: null,
      nextOf: null,
      after: [],
      versionNote: 'Atlas Vox V0/V3/V4/V6 etc. são versões ou degraus da escada Vox, não patamares canônicos por padrão.',
      meaning: 'Versão indica revisão/geração de uma superfície. Patamar indica salto de maturidade/capacidade entre sistemas.',
    }
  }

  if (
    mentions.includes('self-programming safety contract') ||
    title.includes('self-programming safety contract') ||
    pathHint.includes('self-programming-safety-contract')
  ) {
    return {
      current: null,
      next: null,
      nextOf: null,
      after: [],
      versionNote: null,
      meaning: 'Este contrato apoia o proximo patamar Self-Programming OS, mas nao e o patamar por si so. Patamar precisa vir de campos canonicos da documentacao.',
    }
  }

  if (title.includes('self-construction') || mentions.includes('self-construction os')) {
    return {
      current: 'Self-Construction OS: Atlas constrói e evolui o próprio Atlas com governança, packets, gates, evidência e revisão.',
      next: 'Self-Programming OS: auto-modificação governada por safety contracts, receipts, gates, permissões e evidência.',
      nextOf: null,
      after: ['Self-Programming OS só avança para runtime mais autônomo quando safety, receipts, gates e evidência estiverem provados.'],
      versionNote: null,
      meaning: 'O salto não é trocar de camada; é sair de construção governada para capacidade de auto-modificação controlada.',
    }
  }

  if (title.includes('self-programming os') || mentions.includes('atlas self-programming os')) {
    return {
      current: 'Self-Programming OS: patamar de auto-modificação governada.',
      next: 'Runtime livre não está autorizado; o próximo avanço depende de safety, receipts, gates e evidência real.',
      nextOf: 'Self-Construction OS',
      after: ['Autonomia maior só pode existir depois de contracts, receipts e gates provarem controle humano e auditabilidade.'],
      versionNote: null,
      meaning: 'Este patamar só avança quando a documentação provar que a IA pode alterar o Atlas sem perder controle humano e auditabilidade.',
    }
  }

  if (mentions.includes('next patamar') || title.includes('next-patamar')) {
    return {
      current: 'Next Patamar Operating Systems: pacote de maturidade para autoevolução por IA.',
      next: 'Sovereign OS + Epistemic OS + Cartographic Knowledge OS operando juntos.',
      nextOf: 'Governança documental atual do Atlas',
      after: ['Sovereign OS Enterprise', 'Epistemic OS Enterprise', 'Cartographic OS Enterprise'],
      versionNote: null,
      meaning: 'O salto é governar direção, verdade e legibilidade visual antes de ampliar autonomia.',
    }
  }

  if (title.includes('epistemic operating system') || mentions.includes('epistemic os')) {
    return {
      current: 'Epistemic OS: sistema operacional de verdade, confiança, drift, contradição e permissão de IA.',
      next: null,
      nextOf: 'Knowledge Governance System',
      after: ['Epistemic OS Enterprise com contradiction register, maturity gates e permission matrix.'],
      versionNote: null,
      meaning: 'O salto é transformar governança de conhecimento em verdade computável, auditável e acionável por IA.',
    }
  }

  if (title.includes('compounding engineering intelligence') || mentions.includes('compounding intelligence')) {
    return {
      current: 'Compounding Engineering Intelligence: aprendizado operacional verificável depois de cada execução.',
      next: null,
      nextOf: 'Hyperflow',
      after: ['Self-improvement estrutural governado quando o aprendizado composto estiver provado.'],
      versionNote: null,
      meaning: 'O salto é sair de executar bem uma tarefa para melhorar estruturalmente a partir de cada tarefa.',
    }
  }

  return {
    current: null,
    next: null,
    nextOf: null,
    after: [],
    versionNote: detectVersionNote(info, mentions),
    meaning: null,
  }
}

function detectVersionNote(info: GearInfo, mentions: string): string | null {
  if (/\bv\d+\b/i.test(info.title) || /\bv\d+\b/i.test(info.subtitle ?? '') || mentions.includes('schema_version')) {
    return 'Há sinal de versão nesta peça. Versão não é patamar: versão identifica revisão, schema, release ou degrau de produto; patamar identifica salto de maturidade/capacidade.'
  }
  return null
}

function QuickFact({ label, value }: { label: string; value: string }) {
  const c = usePalette()
  return (
    <View style={[styles.quickFact, { borderColor: c.border, backgroundColor: c.bg }]}>
      <Mono size={7.5} letterSpacing={1.1} color={c.bronze}>
        {label}
      </Mono>
      <Sans size={12.5} lineHeight={17} color={c.ink}>
        {value}
      </Sans>
    </View>
  )
}

function HumanBrief({ rows }: { rows: Array<{ label: string; value: string }> }) {
  const c = usePalette()
  return (
    <View style={[styles.humanBrief, { borderColor: c.border, backgroundColor: c.bg }]}>
      <Mono size={8} letterSpacing={1.35} color={c.bronze}>
        LEITURA GUIADA
      </Mono>
      <View style={styles.humanBriefRows}>
        {rows.map((row) => (
          <View key={row.label} style={[styles.humanBriefRow, { borderColor: c.borderSoft }]}>
            <Mono size={7.5} letterSpacing={1.05} color={c.ink3}>
              {row.label}
            </Mono>
            <Sans size={13} lineHeight={18} color={c.ink}>
              {row.value}
            </Sans>
          </View>
        ))}
      </View>
    </View>
  )
}

function FlowCompass({
  compass,
}: {
  compass: ReturnType<typeof buildFlowCompass>
}) {
  const c = usePalette()
  return (
    <View style={[styles.compass, { borderColor: c.border, backgroundColor: c.bg }]}>
      <Mono size={8} letterSpacing={1.35} color={c.bronze}>
        MAPA RÁPIDO
      </Mono>
      <View style={styles.compassRail}>
        <CompassCell label="ENTRA DE" value={compass.before} tone="muted" />
        <View style={[styles.compassArrow, { backgroundColor: c.bronze }]} />
        <CompassCell label="FAZ AQUI" value={compass.current} tone="strong" />
        <View style={[styles.compassArrow, { backgroundColor: c.bronze }]} />
        <CompassCell label="ENTREGA PARA" value={compass.after} tone="muted" />
      </View>
      <View style={[styles.proofStrip, { borderColor: c.borderSoft }]}>
        <Mono size={8} letterSpacing={1.1} color={c.ink3}>
          COMO PROVAR
        </Mono>
        <Sans size={12.5} lineHeight={17} color={c.ink}>
          {compass.proof}
        </Sans>
      </View>
    </View>
  )
}

function ExecutiveBrief({
  brief,
}: {
  brief: ReturnType<typeof buildExecutiveBrief>
}) {
  const c = usePalette()
  return (
    <View style={[styles.executiveBrief, { borderColor: c.bronze + '55', backgroundColor: c.bg }]}>
      <View style={styles.panelHeaderRow}>
        <Mono size={8} letterSpacing={1.35} color={c.bronze}>
          COMEÇE AQUI
        </Mono>
        <Mono size={7.2} letterSpacing={0.9} color={c.ink3}>
          RESUMO EXECUTIVO · 30 SEGUNDOS
        </Mono>
      </View>
      <Sans weight="sb" size={15} lineHeight={21} color={c.ink}>
        {brief.headline}
      </Sans>
      <Sans size={13} lineHeight={19} color={c.ink2}>
        {brief.purpose}
      </Sans>

      <View style={styles.executiveFlow}>
        {brief.flow.map((item, index) => (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 ? <View style={[styles.executiveArrow, { backgroundColor: c.bronze }]} /> : null}
            <ExecutiveFlowCell item={item} />
          </Fragment>
        ))}
      </View>

      <View style={styles.executiveActions}>
        {brief.actions.map((action) => (
          <ExecutiveAction key={action.label} action={action} />
        ))}
      </View>
    </View>
  )
}

function ExecutiveFlowCell({
  item,
}: {
  item: ReturnType<typeof buildExecutiveBrief>['flow'][number]
}) {
  const c = usePalette()
  const color = item.tone === 'proof'
    ? c.moss
    : item.tone === 'warning'
      ? c.recRed
      : item.tone === 'strong'
        ? c.bronze
        : c.ink3
  return (
    <View style={[styles.executiveFlowCell, { borderColor: color + '55', backgroundColor: color + '0D' }]}>
      <Mono size={7.2} letterSpacing={0.9} color={color}>
        {item.label}
      </Mono>
      <Sans weight={item.tone === 'strong' ? 'sb' : 'reg'} size={12.5} lineHeight={17} color={c.ink}>
        {item.value}
      </Sans>
    </View>
  )
}

function ExecutiveAction({
  action,
}: {
  action: ReturnType<typeof buildExecutiveBrief>['actions'][number]
}) {
  const c = usePalette()
  const color = action.tone === 'proof' ? c.moss : action.tone === 'warning' ? c.recRed : c.bronze
  return (
    <View style={[styles.executiveAction, { borderColor: color + '55' }]}>
      <Mono size={7.2} letterSpacing={0.9} color={color}>
        {action.label.toUpperCase()}
      </Mono>
      <Sans size={12.3} lineHeight={17} color={c.ink2}>
        {action.value}
      </Sans>
    </View>
  )
}

function CompassCell({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'muted' | 'strong'
}) {
  const c = usePalette()
  return (
    <View
      style={[
        styles.compassCell,
        {
          borderColor: tone === 'strong' ? c.bronze : c.borderSoft,
          backgroundColor: tone === 'strong' ? c.bronze + '10' : 'transparent',
        },
      ]}
    >
      <Mono size={7.5} letterSpacing={1.05} color={tone === 'strong' ? c.bronze : c.ink3}>
        {label}
      </Mono>
      <Sans size={12} lineHeight={16} color={c.ink}>
        {value}
      </Sans>
    </View>
  )
}

function HumanAnswerGrid({
  cards,
}: {
  cards: Array<{ label: string; title: string; value: string; tone?: 'normal' | 'warning' | 'proof' }>
}) {
  const c = usePalette()
  return (
    <View style={[styles.answerGrid, { borderColor: c.border, backgroundColor: c.bg }]}>
      <Mono size={8} letterSpacing={1.35} color={c.bronze}>
        RESPOSTA HUMANA
      </Mono>
      <View style={styles.answerCards}>
        {cards.map((card) => {
          const toneColor = card.tone === 'warning' ? c.recRed : card.tone === 'proof' ? c.moss : c.bronze
          return (
            <View key={`${card.label}-${card.title}`} style={[styles.answerCard, { borderColor: toneColor + '55', backgroundColor: toneColor + '0D' }]}>
              <Mono size={7.5} letterSpacing={1.05} color={toneColor}>
                {card.label}
              </Mono>
              <Sans weight="sb" size={13} lineHeight={17} color={c.ink}>
                {card.title}
              </Sans>
              <Sans size={12.5} lineHeight={18} color={c.ink2}>
                {card.value}
              </Sans>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function DecisionBoard({
  rows,
}: {
  rows: ReturnType<typeof buildDecisionBoardRows>
}) {
  const c = usePalette()
  return (
    <View style={[styles.decisionBoard, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={styles.panelHeaderRow}>
        <Mono size={8} letterSpacing={1.35} color={c.bronze}>
          QUADRO DE DECISÃO
        </Mono>
        <Mono size={7.2} letterSpacing={0.9} color={c.ink3}>
          RESPOSTAS ANTES DE PEDIR IA
        </Mono>
      </View>
      <Sans size={12.5} lineHeight={18} color={c.ink2}>
        Leia de cima para baixo. Se uma linha estiver ausente, a documentação ainda não prova aquela parte.
      </Sans>
      <View style={styles.decisionRows}>
        {rows.map((row) => {
          const toneColor = row.tone === 'warning' ? c.recRed : row.tone === 'proof' ? c.moss : c.bronze
          return (
            <View key={row.label} style={[styles.decisionRow, { borderColor: c.borderSoft }]}>
              <View style={styles.decisionLabelColumn}>
                <View style={[styles.decisionMarker, { backgroundColor: toneColor }]} />
                <Mono size={7.2} letterSpacing={0.85} color={toneColor}>
                  {row.label}
                </Mono>
              </View>
              <View style={styles.decisionTextColumn}>
                <Sans weight="sb" size={12.5} lineHeight={17} color={c.ink}>
                  {row.question}
                </Sans>
                <Sans size={12.5} lineHeight={18} color={c.ink2}>
                  {row.answer}
                </Sans>
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function AudienceMatrix({
  rows,
}: {
  rows: ReturnType<typeof buildAudienceMatrixRows>
}) {
  const c = usePalette()
  return (
    <View style={[styles.audienceMatrix, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={styles.panelHeaderRow}>
        <Mono size={8} letterSpacing={1.35} color={c.bronze}>
          MATRIZ DE ENTENDIMENTO
        </Mono>
        <Mono size={7.2} letterSpacing={0.9} color={c.ink3}>
          DIRETORIA · SUPORTE · TECH · PARCEIROS
        </Mono>
      </View>
      <Sans size={12.5} lineHeight={18} color={c.ink2}>
        A mesma peça traduzida para cada área. Isso evita que uma pessoa nova precise ler a pasta inteira para decidir o próximo passo.
      </Sans>
      <View style={styles.audienceRows}>
        {rows.map((row) => (
          <View key={row.area} style={[styles.audienceRow, { borderColor: c.borderSoft }]}>
            <Mono size={7.4} letterSpacing={1} color={c.bronze}>
              {row.area.toUpperCase()}
            </Mono>
            <Sans size={12.3} lineHeight={17} color={c.ink}>
              {row.read}
            </Sans>
            <View style={[styles.audienceDecision, { borderColor: c.borderSoft }]}>
              <Mono size={7.1} letterSpacing={0.9} color={c.ink3}>
                DECISÃO SEGURA
              </Mono>
              <Sans weight="sb" size={12} lineHeight={16} color={c.ink2}>
                {row.decision}
              </Sans>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

function HumanManualDeck({
  sections,
  health,
}: {
  sections: ReturnType<typeof buildManualSections>
  health: ReturnType<typeof buildHealthChecklist>
}) {
  const c = usePalette()
  return (
    <View style={[styles.manualDeck, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={styles.panelHeaderRow}>
        <Mono size={8} letterSpacing={1.35} color={c.bronze}>
          MANUAL HUMANO
        </Mono>
        <Mono size={7.2} letterSpacing={0.9} color={c.ink3}>
          LEITURA RÁPIDA ANTES DA IA
        </Mono>
      </View>
      <Sans size={12.5} lineHeight={18} color={c.ink2}>
        Esta parte responde o básico em linguagem operacional: o que é, por que existe, como flui, como provar, onde ler e o que não confundir.
      </Sans>

      <View style={styles.healthGrid}>
        {health.map((item) => (
          <View
            key={item.label}
            style={[
              styles.healthPill,
              {
                borderColor: item.ok ? c.moss + '66' : c.recRed + '66',
                backgroundColor: item.ok ? c.moss + '12' : c.recRed + '10',
              },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: item.ok ? c.moss : c.recRed }]} />
            <View style={styles.healthText}>
              <Mono size={7.1} letterSpacing={0.9} color={item.ok ? c.moss : c.recRed}>
                {item.ok ? 'OK' : 'AUSENTE'}
              </Mono>
              <Sans weight="sb" size={11.5} lineHeight={15} color={c.ink}>
                {item.label}
              </Sans>
              <Sans size={10.8} lineHeight={14} color={c.ink3}>
                {item.detail}
              </Sans>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.manualSections}>
        {sections.map((section) => (
          <ManualSection key={`${section.kicker}-${section.title}`} section={section} />
        ))}
      </View>
    </View>
  )
}

function ManualSection({
  section,
}: {
  section: ReturnType<typeof buildManualSections>[number]
}) {
  const c = usePalette()
  const toneColor = section.tone === 'warning' ? c.recRed : section.tone === 'proof' ? c.moss : c.bronze
  return (
    <View style={[styles.manualSection, { borderColor: toneColor + '55', backgroundColor: toneColor + '0B' }]}>
      <Mono size={7.5} letterSpacing={1.05} color={toneColor}>
        {section.kicker}
      </Mono>
      <Sans weight="sb" size={15} lineHeight={20} color={c.ink}>
        {section.title}
      </Sans>
      <Sans size={13} lineHeight={19} color={c.ink2}>
        {section.answer}
      </Sans>
      <View style={styles.manualBullets}>
        {section.bullets.map((bullet) => (
          <View key={bullet} style={styles.manualBulletRow}>
            <View style={[styles.manualBulletDot, { backgroundColor: toneColor }]} />
            <Sans size={12.5} lineHeight={18} color={c.ink}>
              {bullet}
            </Sans>
          </View>
        ))}
      </View>
    </View>
  )
}

function MaturityPanel({
  panel,
}: {
  panel: ReturnType<typeof buildMaturityPanel>
}) {
  const c = usePalette()
  return (
    <View style={[styles.maturityPanel, { borderColor: c.border, backgroundColor: c.bg }]}>
      <View style={styles.panelHeaderRow}>
        <Mono size={8} letterSpacing={1.35} color={c.bronze}>
          PATAMARES ≠ VERSÕES
        </Mono>
        <Mono size={7.2} letterSpacing={0.9} color={c.ink3}>
          MATURIDADE SEPARADA DE RELEASE
        </Mono>
      </View>
      <Sans size={12.5} lineHeight={18} color={c.ink2}>
        {panel.warning}
      </Sans>
      <PatamarTimeline rows={panel.patamarRows} />
      <View style={styles.maturityColumns}>
        <MaturityColumn title="PATAMARES" rows={panel.patamarRows} />
        <MaturityColumn title="VERSÕES" rows={panel.versionRows} />
      </View>
    </View>
  )
}

function PatamarTimeline({
  rows,
}: {
  rows: Array<{ label: string; value: string; present: boolean }>
}) {
  const c = usePalette()
  const nextOf = rows.find((row) => row.label === 'É próximo patamar de')
  const current = rows.find((row) => row.label === 'Patamar atual')
  const next = rows.find((row) => row.label === 'Próximo patamar')
  const after = rows.find((row) => row.label === 'Outros patamares depois')
  const timeline = [
    { label: 'VEM DE', value: nextOf?.value ?? 'Não declarado', present: Boolean(nextOf?.present) },
    { label: 'ATUAL', value: current?.value ?? 'Não declarado', present: Boolean(current?.present) },
    { label: 'PRÓXIMO', value: next?.value ?? 'Não declarado', present: Boolean(next?.present) },
    { label: 'DEPOIS', value: after?.value ?? 'Não declarado', present: Boolean(after?.present) },
  ]

  return (
    <View style={[styles.patamarTimeline, { borderColor: c.borderSoft }]}>
      <Mono size={7.5} letterSpacing={1.1} color={c.bronze}>
        LINHA DE MATURIDADE
      </Mono>
      <View style={styles.timelineRail}>
        {timeline.map((item, index) => (
          <View key={item.label} style={styles.timelineItem}>
            <View style={styles.timelineHead}>
              <View
                style={[
                  styles.timelineNode,
                  {
                    borderColor: item.present ? c.bronze : c.ink3,
                    backgroundColor: item.present ? c.bronze + '24' : 'transparent',
                  },
                ]}
              />
              {index < timeline.length - 1 ? (
                <View style={[styles.timelineLine, { backgroundColor: item.present ? c.bronze : c.borderSoft }]} />
              ) : null}
            </View>
            <Mono size={7} letterSpacing={0.85} color={item.present ? c.bronze : c.ink3}>
              {item.label}
            </Mono>
            <Sans size={11.8} lineHeight={16} color={item.present ? c.ink : c.ink3}>
              {item.value}
            </Sans>
          </View>
        ))}
      </View>
    </View>
  )
}

function MaturityColumn({
  title,
  rows,
}: {
  title: string
  rows: Array<{ label: string; value: string; present: boolean }>
}) {
  const c = usePalette()
  return (
    <View style={[styles.maturityColumn, { borderColor: c.borderSoft }]}>
      <Mono size={7.5} letterSpacing={1.1} color={c.bronze}>
        {title}
      </Mono>
      <View style={styles.maturityRows}>
        {rows.map((row) => (
          <View key={row.label} style={styles.maturityRow}>
            <View style={[styles.statusDot, { backgroundColor: row.present ? c.moss : c.ink3 }]} />
            <View style={styles.maturityText}>
              <Mono size={7.2} letterSpacing={0.85} color={c.ink3}>
                {row.label.toUpperCase()}
              </Mono>
              <Sans size={12.5} lineHeight={17} color={row.present ? c.ink : c.ink3}>
                {row.value}
              </Sans>
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

function NomenclatureGuard({
  cards,
}: {
  cards: Array<{ label: string; question: string; value: string }>
}) {
  const c = usePalette()
  return (
    <View style={[styles.nomenclatureGuard, { borderColor: c.border, backgroundColor: c.bg }]}>
      <Mono size={8} letterSpacing={1.35} color={c.bronze}>
        NOMENCLATURA SEM MISTURA
      </Mono>
      <Sans size={12.5} lineHeight={18} color={c.ink2}>
        Cada categoria responde uma pergunta diferente. Isso impede a IA de transformar versão, fonte ou fluxo em maturidade falsa.
      </Sans>
      <View style={styles.nomenclatureCards}>
        {cards.map((card) => (
          <View key={card.label} style={[styles.nomenclatureCard, { borderColor: c.borderSoft }]}>
            <Mono size={7.4} letterSpacing={1} color={c.bronze}>
              {card.label.toUpperCase()}
            </Mono>
            <Sans weight="sb" size={12.5} lineHeight={17} color={c.ink}>
              {card.question}
            </Sans>
            <Sans size={12} lineHeight={17} color={c.ink2}>
              {card.value}
            </Sans>
          </View>
        ))}
      </View>
    </View>
  )
}

function ReadingIndex() {
  const c = usePalette()
  const items = ['30s', 'áreas', 'fluxo', 'limites', 'riscos', 'testes', 'governança', 'nomes', 'patamar', 'versões', 'fontes', 'docs']
  return (
    <View style={[styles.readingIndex, { borderColor: c.borderSoft }]}>
      <Mono size={8} letterSpacing={1.25} color={c.bronze}>
        ÍNDICE HUMANO
      </Mono>
      <View style={styles.indexPills}>
        {items.map((item, index) => (
          <View key={item} style={[styles.indexPill, { borderColor: c.borderSoft, backgroundColor: c.bg }]}>
            <Mono size={7.5} letterSpacing={0.95} color={index < 3 ? c.bronze : c.ink3}>
              {item.toUpperCase()}
            </Mono>
          </View>
        ))}
      </View>
    </View>
  )
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

function prefixedHumanText(prefix: string, value: string | null | undefined): string | null {
  const text = formatHumanText(value)
  return text ? `${prefix}: ${text}` : null
}

function boldPrefixedHumanText(prefix: string, value: string | null | undefined): string | null {
  const text = formatHumanText(value)
  return text ? `**${prefix}:** ${mdText(text)}` : null
}

function formatHumanText(value: string | null | undefined): string | null {
  if (!value) return null
  const raw = value.replace(/\s+/g, ' ').trim()
  if (!raw) return null
  if (raw.includes('/') || raw.includes('--') || raw.includes('.md') || raw.includes(':')) {
    return raw
  }
  const compact = raw.replace(/[_-]/g, ' ')
  if (!compact) return null
  return compact.charAt(0).toUpperCase() + compact.slice(1)
}

function listText(items: ReadonlyArray<string | null | undefined> | undefined): string | null {
  const clean = uniqueList(items ?? []).map(formatHumanText).filter((item): item is string => Boolean(item))
  return clean.length ? clean.join(', ') : null
}

function compactSentence(items: ReadonlyArray<string | null | undefined>): string | null {
  const clean = uniqueList(items).map(formatHumanText).filter((item): item is string => Boolean(item))
  return clean.length ? clean.join(' · ') : null
}

function buildAudienceRows(info: GearInfo, summary: string | null): Array<[string, string]> {
  const owner = formatHumanText(info.kind) ?? 'peça do Atlas'
  const before = listText(info.dependsOn) ?? formatHumanText(info.input) ?? 'o passo anterior do fluxo'
  const after = listText(info.flowsTo) ?? formatHumanText(info.output) ?? 'o próximo passo do fluxo'
  const risk = formatHumanText(info.risk) ?? 'risco não declarado'
  const proof = uniqueList([...(info.requiredTests ?? []), ...(info.evidence ?? [])])[0]
  const source = uniqueList([info.sourcePath, ...(info.repoPaths ?? [])])[0]

  return [
    ['Diretoria', summary ?? `Esta é uma ${owner}; use para entender responsabilidade, risco e dependências.`],
    ['Produto / Operação', `Entra depois de ${before}; entrega ou alimenta ${after}.`],
    ['Marketing / Comunicação', 'Use o resumo, a responsabilidade e o que esta peça não pode prometer. Não transforme versão, plano ou experimento em capacidade pronta.'],
    ['Suporte', `Quando algo falhar, confira o risco (${risk}), a próxima ação e se existe evidência registrada.`],
    ['Financeiro / Jurídico', 'Use limites de mudança, itens proibidos e exigência de evidência antes de aprovar impacto, custo ou contrato.'],
    ['Tech / IA', proof ? `Valide com ${proof}.` : 'Valide com os testes e evidências declarados nesta ficha antes de alterar código.'],
    ['Parceiros', source ? `Fonte auditável: ${source}.` : 'A fonte canônica ainda não foi declarada; trate como documentação incompleta.'],
  ]
}

function buildEssentialQuestionRows(
  info: GearInfo,
  prepared: {
    summary: string | null
    sourcePaths: string[]
    evidence: string[]
    tests: string[]
  },
  patamar: ReturnType<typeof buildPatamarSummary>,
): Array<[string, string | null]> {
  const responsibility = uniqueList([
    ...(info.decisions ?? []).map(formatHumanText),
    ...(info.capabilities ?? []).map(formatHumanText),
  ])[0]
  const input = formatHumanText(info.input) ?? listText(info.dependsOn)
  const output = formatHumanText(info.output) ?? listText(info.flowsTo)
  const tests = prepared.tests.length
    ? prepared.tests.join(', ')
    : prepared.evidence.length
      ? prepared.evidence.join(', ')
      : null
  const guardrails = uniqueList([...(info.allowedChanges ?? []), ...(info.forbiddenChanges ?? [])])
    .map(formatHumanText)
    .filter((item): item is string => Boolean(item))
    .slice(0, 2)
    .join(' | ')

  return [
    ['O que é?', prepared.summary ?? null],
    ['Para que existe?', responsibility ?? null],
    ['Como entra?', input ?? null],
    ['Como sai?', output ?? null],
    ['Como provo?', tests],
    ['O que não posso confundir?', patamar.versionNote ?? 'Patamar, versão, fonte, camada, risco e regra ficam separados.'],
    ['Quais limites importam?', guardrails || null],
  ]
}

function buildNomenclatureRows(
  info: GearInfo,
  prepared: {
    sourcePaths: string[]
    canonicalPaths: string[]
  },
  patamar: ReturnType<typeof buildPatamarSummary>,
  version: ReturnType<typeof buildVersionSummary>,
): Array<[string, string | null]> {
  return [
    [
      'Patamar',
      patamar.current || patamar.next || patamar.nextOf || patamar.after.length
        ? uniqueList([
          patamar.current ? `atual: ${patamar.current}` : null,
          patamar.nextOf ? `é próximo patamar de: ${patamar.nextOf}` : null,
          patamar.next ? `próximo: ${patamar.next}` : null,
          ...patamar.after.map((item) => `depois: ${item}`),
        ]).join(' · ')
        : 'não declarado; não inferir por camada, versão, fonte, fluxo ou nome parecido',
    ],
    [
      'Versão',
      version.detected.length || version.note
        ? uniqueList([version.detected.join(', '), version.note]).join(' · ')
        : 'não declarada; versão é revisão/degrau da mesma superfície, não maturidade',
    ],
    [
      'Fonte',
      prepared.sourcePaths.length
        ? prepared.sourcePaths.join(' · ')
        : 'arquivo canônico não declarado',
    ],
    [
      'Documentação relacionada',
      prepared.canonicalPaths.length
        ? prepared.canonicalPaths.join(' · ')
        : 'não declarada; quando existir, é leitura auxiliar, não patamar',
    ],
    [
      'Camada visual',
      formatHumanText(info.graphLayer) ?? formatHumanText(info.layer) ?? 'não declarada; camada localiza no mapa, não mede maturidade',
    ],
    [
      'Regra',
      listText([...(info.allowedChanges ?? []), ...(info.forbiddenChanges ?? [])]) ?? 'não declarada; regra diz o que pode/não pode mudar',
    ],
    [
      'Risco',
      formatHumanText(info.risk) ?? listText(info.failureModes) ?? 'não declarado; risco diz o que quebra se a peça mentir',
    ],
    [
      'Prova',
      listText([...(info.requiredTests ?? []), ...(info.qualityGates ?? []), ...(info.evidence ?? [])]) ?? 'não declarada; prova é teste/evidência, não fonte e não patamar',
    ],
  ]
}

function buildDocumentationHealthRows(
  info: GearInfo,
  prepared: {
    summary: string | null
    sourcePaths: string[]
    canonicalPaths: string[]
    evidence: string[]
    tests: string[]
  },
  patamar: ReturnType<typeof buildPatamarSummary>,
  version: ReturnType<typeof buildVersionSummary>,
): string[] {
  const rows: Array<[string, boolean, string]> = [
    ['Resumo humano', Boolean(prepared.summary), 'sem resumo claro'],
    ['Fluxo de entrada/saída', Boolean(info.input || info.output || info.dependsOn?.length || info.flowsTo?.length), 'sem entrada/saída declarada'],
    ['Responsabilidade', Boolean(info.decisions?.length || info.capabilities?.length), 'sem decisão/capacidade principal'],
    ['Regras de mudança', Boolean(info.allowedChanges?.length || info.forbiddenChanges?.length), 'sem permitido/proibido'],
    ['Riscos', Boolean(info.risk || info.failureModes?.length), 'sem risco declarado'],
    ['Testes e evidências', Boolean(prepared.tests.length || prepared.evidence.length), 'sem prova declarada'],
    ['Fonte canônica', Boolean(prepared.sourcePaths.length), 'sem arquivo canônico'],
    ['Documentação relacionada', Boolean(prepared.canonicalPaths.length), 'sem leitura relacionada'],
    ['Governança', Boolean(info.owner || info.category || info.docSchema), 'sem dono/schema/categoria'],
    ['Patamar', Boolean(patamar.current || patamar.next || patamar.nextOf || patamar.after.length), 'patamar não declarado'],
    ['Versão', Boolean(version.detected.length || version.note), 'versão não declarada'],
  ]

  return rows.map(([label, ok, missing]) => `**${label}:** ${ok ? 'OK' : `AUSENTE — ${missing}`}`)
}

function bulletList(items: ReadonlyArray<string | null | undefined>, empty: string): string {
  const clean = uniqueList(items)
  return clean.length ? clean.map((item) => `- ${item}`).join('\n') : empty
}

function labeledMarkdownList(rows: ReadonlyArray<[string, string | null | undefined]>): string | null {
  const clean = rows
    .map(([label, value]) => {
      const text = formatHumanText(value)
      return text ? `- **${mdText(label)}:** ${mdText(text)}` : null
    })
    .filter((item): item is string => Boolean(item))
  return clean.length ? clean.join('\n') : null
}

function orderedMarkdownList(rows: ReadonlyArray<[string, string | null | undefined]>): string | null {
  const clean = rows
    .map(([label, value], index) => {
      const text = formatHumanText(value)
      return text ? `${index + 1}. **${mdText(label)}:** ${mdText(text)}` : null
    })
    .filter((item): item is string => Boolean(item))
  return clean.length ? clean.join('\n') : null
}

function markdownTable(headers: string[], rows: string[][]): string {
  const header = `| ${headers.map(mdTableCell).join(' | ')} |`
  const divider = `| ${headers.map(() => '---').join(' | ')} |`
  const body = rows
    .map((row) => `| ${row.map((cell) => mdTableCell(formatHumanText(cell) ?? cell)).join(' | ')} |`)
    .join('\n')
  return [header, divider, body].filter(Boolean).join('\n')
}

function mdTableCell(value: string | null | undefined): string {
  return mdText(value ?? 'Não declarado').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function mdText(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
}

function mdCode(value: string): string {
  return value.replace(/`/g, '\\`')
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
  sheetFrame: {
    flex: 1,
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
    gap: 16,
    paddingHorizontal: 24,
  },
  header: {
    gap: 7,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickGrid: {
    gap: 8,
  },
  quickFact: {
    minHeight: 74,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 6,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  markdownDocument: {
    paddingTop: 2,
  },
  executiveBrief: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 11,
  },
  executiveFlow: {
    gap: 8,
  },
  executiveFlowCell: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 4,
  },
  executiveArrow: {
    alignSelf: 'center',
    width: 2,
    height: 12,
    opacity: 0.5,
  },
  executiveActions: {
    gap: 7,
  },
  executiveAction: {
    borderLeftWidth: 2,
    paddingLeft: 9,
    gap: 3,
  },
  humanBrief: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  humanBriefRows: {
    gap: 8,
  },
  humanBriefRow: {
    borderLeftWidth: 2,
    paddingLeft: 10,
    gap: 4,
  },
  compass: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  compassRail: {
    gap: 8,
  },
  compassCell: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 5,
  },
  compassArrow: {
    alignSelf: 'center',
    width: 2,
    height: 14,
    opacity: 0.5,
  },
  proofStrip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 9,
    gap: 5,
  },
  answerGrid: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  answerCards: {
    gap: 8,
  },
  answerCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 5,
  },
  manualDeck: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 12,
  },
  decisionBoard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 11,
  },
  decisionRows: {
    gap: 0,
  },
  decisionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    flexDirection: 'row',
    gap: 10,
  },
  decisionLabelColumn: {
    width: 74,
    gap: 5,
    paddingTop: 1,
  },
  decisionMarker: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  decisionTextColumn: {
    flex: 1,
    gap: 4,
  },
  audienceMatrix: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 11,
  },
  audienceRows: {
    gap: 8,
  },
  audienceRow: {
    borderLeftWidth: 2,
    paddingLeft: 10,
    gap: 6,
  },
  audienceDecision: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    gap: 3,
  },
  healthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  healthPill: {
    flexBasis: '100%',
    minHeight: 58,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
  },
  healthText: {
    flex: 1,
    gap: 2,
  },
  manualSections: {
    gap: 9,
  },
  manualSection: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 6,
  },
  manualBullets: {
    gap: 5,
    paddingTop: 2,
  },
  manualBulletRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  manualBulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 7,
  },
  maturityPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  panelHeaderRow: {
    gap: 4,
  },
  maturityColumns: {
    gap: 9,
  },
  patamarTimeline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 9,
    padding: 10,
    gap: 9,
  },
  timelineRail: {
    gap: 8,
  },
  timelineItem: {
    gap: 4,
  },
  timelineHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timelineNode: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.2,
  },
  timelineLine: {
    flex: 1,
    height: 1,
    opacity: 0.55,
    marginHorizontal: 8,
  },
  maturityColumn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 9,
    padding: 10,
    gap: 8,
  },
  maturityRows: {
    gap: 8,
  },
  maturityRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
  },
  maturityText: {
    flex: 1,
    gap: 2,
  },
  nomenclatureGuard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  nomenclatureCards: {
    gap: 8,
  },
  nomenclatureCard: {
    borderLeftWidth: 2,
    paddingLeft: 10,
    gap: 4,
  },
  readingIndex: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    gap: 8,
  },
  indexPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  indexPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
})
