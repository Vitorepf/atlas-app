import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { BottomSheet } from './BottomSheet'
import { Frau } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useOverlays, type DomainDestino } from '../../lib/overlays'
import { domainColor, type DomainKey } from '../../lib/domains'
import { useAtlasStore } from '../../lib/atlasStore'
import { CreateDomainPanel } from '../domains/CreateDomainPanel'
import { SectionHead, DestinoItem } from '../editorial'
import {
  getAtlasDecide,
  prefetchAtlasDecide,
  type AtlasDecideResult,
} from '../../lib/atlasDecide'

interface DomainGlyph {
  key: DomainKey
  glyph: string
}

const GLYPHS: DomainGlyph[] = [
  { key: 'blackink', glyph: '◆' },
  { key: 'atlas',    glyph: '⊙' },
  { key: 'saude',    glyph: '✜' },
  { key: 'financas', glyph: '▲' },
  { key: 'outro',    glyph: '·' },
]

// =============================================================================
// DomainSheet · canon mockup "Categorizar + Elaborar" (v18)
// =============================================================================
//
// Acessado SEMPRE após captura (texto via Atlas Decide 'captura', áudio via
// Modo Gravar). Substitui o cards-SaaS antigo (background + border + radius 12)
// pela versão editorial canon do mockup HTML:
//
//   i. SOBRE O QUÊ É?  · 5 domínios com glyph identidade + border-left color
//                        (◆ blackink ink · ⊙ atlas bronze · ✜ saúde moss
//                         · ▲ finanças prussian · · outro ink3)
//   ii. O QUE FAZER?   · 4 destinos editoriais com vocabulário canônico
//                        (✦ Conversar com Atlas · — Estruturar como tarefa
//                         · — Estruturar como projeto · · Apenas salvar)
//
// Atlas Decide LLM classifier pré-seleciona via metadata da captura · user
// confirma ou troca. "Pular" mono caps no fim · vai pro inbox raw com domain
// auto-detectado e destino "salvar".
//
// API: callback (d, destino?) — 2º arg opcional pra back-compat com chamadas
// antigas (DetailSheet.move) que só usam domain.
// =============================================================================

export function DomainSheet() {
  const open = useOverlays((s) => s.open)
  const cb = useOverlays((s) => s.onPickDomain)
  const captureId = useOverlays((s) => s.domainSheetCaptureId)
  const prePicked = useOverlays((s) => s.domainSheetPrePicked)
  const close = useOverlays((s) => s.close)
  const visible = open === 'domain'

  // ✅ pickedDomain ELEVADO pro level do BottomSheet · canon Atlas auto-save.
  // Quando user faz drag down (close gesture), usa o domain ESCOLHIDO + destino
  // 'salvar' (não null/null como antes que ignorava a escolha do user).
  // Vocabulário: "tap em Atlas + fechar = salva como Atlas, como se tivesse
  // tap em Apenas salvar". Don Corleone "ato é ato, escolha é escolha".
  const [pickedDomain, setPickedDomain] = useState<DomainKey>('outro')
  const [decided, setDecided] = useState<AtlasDecideResult | null>(null)

  // Reset + pre-populate quando sheet reabre. Três estratégias em ordem:
  //   1. Se há captureId no contexto: consulta Atlas Decide cache (LLM
  //      server-side via clarifyCapture). Se não tem cache, dispara prefetch
  //      e atualiza quando chegar — não-bloqueante.
  //   2. Se há prePicked (heurística client-side via inferAtlasDecide): usa
  //      como pickedDomain + destino sugerido. Fluxo de criação de captura.
  //   3. Default: pickedDomain 'outro', sem destino sugerido.
  useEffect(() => {
    if (!visible) return

    if (captureId) {
      const cached = getAtlasDecide(captureId)
      if (cached) {
        setPickedDomain(cached.domain)
        setDecided(cached)
        return
      }
      // Sem cache · prefetch não-bloqueante
      setPickedDomain(prePicked?.domain ?? 'outro')
      setDecided(
        prePicked
          ? { domain: prePicked.domain, destino: prePicked.destino, confidence: 0, capture: null }
          : null,
      )
      let cancelled = false
      void prefetchAtlasDecide(captureId).then((result) => {
        if (cancelled) return
        setPickedDomain(result.domain)
        setDecided(result)
      })
      return () => {
        cancelled = true
      }
    }

    if (prePicked) {
      // Pré-classificação heurística client-side · usada no fluxo de criação
      // (capture.tsx + Dock long-press) quando ainda não há captureId.
      setPickedDomain(prePicked.domain)
      setDecided({
        domain: prePicked.domain,
        destino: prePicked.destino,
        confidence: 0,
        capture: null,
      })
      return
    }

    // Default · sem captureId nem prePicked
    setPickedDomain('outro')
    setDecided(null)
  }, [visible, captureId, prePicked])

  const finish = (d: DomainKey | null, destino?: DomainDestino) => {
    cb?.(d, destino)
    close()
  }

  return (
    <BottomSheet
      visible={visible}
      // ✅ Drag down auto-save · usa pickedDomain currente + destino sugerido
      // pelo Atlas Decide quando disponível, ou 'salvar' como fallback canon.
      // Se user não tap em nada antes, fica 'outro' (default). Se tap em
      // qualquer domain, usa esse. Comportamento consistente com Atlas
      // Decide Sheet (configuração também auto-save on close).
      onClose={() => finish(pickedDomain, decided?.destino ?? 'salvar')}
      height="85%"
    >
      <Body
        pickedDomain={pickedDomain}
        setPickedDomain={setPickedDomain}
        suggestedDestino={decided?.destino ?? null}
        onPick={finish}
      />
    </BottomSheet>
  )
}

function Body({
  pickedDomain,
  setPickedDomain,
  suggestedDestino,
  onPick,
}: {
  pickedDomain: DomainKey
  setPickedDomain: (key: DomainKey) => void
  suggestedDestino: DomainDestino | null
  onPick: (d: DomainKey | null, destino?: DomainDestino) => void
}) {
  const { c } = useTheme()
  const domains = useAtlasStore((s) => s.domains)

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* i. SOBRE O QUÊ É? · canon mockup · 5 domínios com border-left color */}
      <View style={styles.section}>
        <SectionHead numeral="i" title="Sobre o quê é?" />
        {domains.map((d) => {
          const accent = domainColor(d.key, c, domains)
          const glyph = GLYPHS.find((g) => g.key === d.key)?.glyph ?? '·'
          const active = pickedDomain === d.key
          return (
            <Pressable
              key={d.key}
              onPress={() => setPickedDomain(d.key)}
              hitSlop={4}
              style={({ pressed }) => [
                styles.domainItem,
                {
                  // v18 canon · Atlas domain (⊙) usa bronze como border-left
                  // (signature canon "Atlas em ato cognitivo"), não c.domAtlas
                  // purple (vocabulário SaaS legacy). Outros domains mantêm
                  // accent natural (◆ ink, ✜ moss, ▲ prussian, · ink3).
                  borderLeftColor: glyph === '⊙' ? c.bronze : accent,
                  borderLeftWidth: active ? 4 : 2,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={d.label}
              accessibilityState={{ selected: active }}
            >
              {/* v18 canon · Atlas glyph (⊙) ganha signature bronze italic
                  com signet ring shadow (mesma vibe do ✦ send · "Atlas em
                  ato cognitivo"). Outros domains usam accent color natural
                  do domain (◆ ink, ✜ moss, ▲ prussian, · ink3). */}
              <Frau
                italic={glyph === '⊙'}
                size={18}
                lineHeight={24}
                color={glyph === '⊙' ? c.bronze : accent}
                style={[
                  styles.domainGlyph,
                  glyph === '⊙' && {
                    textShadowColor: `${c.bronze}4D`,
                    textShadowOffset: { width: 0, height: 1 },
                    textShadowRadius: 3,
                  },
                ]}
              >
                {glyph}
              </Frau>
              <Frau
                weight="med"
                size={17}
                lineHeight={22}
                color={c.ink}
                letterSpacing={-0.05}
              >
                {d.label}
              </Frau>
            </Pressable>
          )
        })}
        <CreateDomainPanel
          onCreated={(domain) => setPickedDomain(domain.key)}
        />
      </View>

      {/* ii. O QUE FAZER? · canon mockup · 4 destinos editoriais.
          Tap = confirma com pickedDomain currente. ✦ Conversar é signature
          Atlas (exception fundamentada · "Atlas em ato cognitivo").
          Quando Atlas Decide sugere um destino, ele aparece com peso visual
          extra (sufixo " · sugerido" no subtitle) — user confirma ou troca. */}
      <View style={styles.section}>
        <SectionHead numeral="ii" title="O que fazer?" />
        <DestinoItem
          glyph="✦"
          label="Conversar com Atlas"
          subtitle={
            suggestedDestino === 'conversar'
              ? 'abre o sheet com a captura como contexto · sugerido'
              : 'abre o sheet com a captura como contexto'
          }
          onPress={() => onPick(pickedDomain, 'conversar')}
        />
        <DestinoItem
          glyph="—"
          label="Estruturar como tarefa"
          subtitle={
            suggestedDestino === 'tarefa'
              ? 'Atlas propõe título, contexto, prazo · sugerido'
              : 'Atlas propõe título, contexto, prazo'
          }
          onPress={() => onPick(pickedDomain, 'tarefa')}
        />
        <DestinoItem
          glyph="—"
          label="Estruturar como projeto"
          subtitle={
            suggestedDestino === 'projeto'
              ? 'Atlas propõe escopo, etapas, missões · sugerido'
              : 'Atlas propõe escopo, etapas, missões'
          }
          onPress={() => onPick(pickedDomain, 'projeto')}
        />
        <DestinoItem
          glyph="·"
          label="Apenas salvar"
          subtitle={
            suggestedDestino === 'salvar'
              ? 'vai pro inbox raw, decide depois · sugerido'
              : 'vai pro inbox raw, decide depois'
          }
          isLast
          onPress={() => onPick(pickedDomain, 'salvar')}
        />
      </View>

      {/* v18 canon Atlas radical · PULAR removido por ser redundante.
          Drag down (close gesture) já salva com domain currente + destino
          'salvar'. Tap em "Apenas salvar" (section ii) faz a mesma coisa
          explicitamente. Vocabulário Don Corleone "fechar = ato",
          consistente com Atlas Decide Sheet configuração. */}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 32,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  section: {
    marginBottom: 18,
  },
  // domainItem · canon mockup .domain-item · border-left color do domain
  // (3px sólido) + padding-left 16. SEM background card, SEM radius 12 SaaS.
  // Items respiram no papel · vocabulário "marca de margem editorial".
  // Hairline-bottom 6% ink separa items dentro da section.
  domainItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 14,
    paddingVertical: 14,
    paddingLeft: 18,
    paddingRight: 16,
    marginLeft: 32,
    marginRight: 32,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(26,22,18,0.06)',
  },
  domainGlyph: {
    width: 24,
    textAlign: 'center',
  },
})
