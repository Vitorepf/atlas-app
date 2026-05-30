// Atlas Loop · "O DIÁRIO DO LOOP" (The Loop Dossier).
//
// The FLAGSHIP surface and the ONLY way the operator talks to the autonomous
// 24h loop. A single weighted vertical reading whose ORDER encodes an ethic:
//   alive -> what it did -> what it asks -> what you say -> the lever -> audit.
//
// One derived `loopState` feeds the masthead pill, the Vitals "estado" row and
// the RunControl top line — they can NEVER disagree. Honesty is structural:
// real-or-blocked (no fabricated loop/cycle/merge/proof), proposal-only (APROVAR
// shows "NÃO executa · roteia ao dono"), directive-not-autonomous (permanent
// honesty band + exact recipe), honest-stop (run-control writes signal files the
// runner already obeys, re-reads TRUE post-write disk state, never optimistic).

import { useCallback, useRef, useState } from 'react'
import { RefreshControl, ScrollView, View, type LayoutChangeEvent } from 'react-native'
import { router } from 'expo-router'
import { Screen } from '../components/Screen'
import { CodexReveal } from '../components/CodexReveal'
import { Masthead, EditorialDateline, SectionHead, FolioFooter } from '../components/editorial'
import { BottomSheet } from '../components/sheets/BottomSheet'
import { PressableTextScale } from '../components/atlas-ui/PressableScale'
import { Frau, Label, Mono } from '../design/Type'
import { usePalette } from '../design/theme'
import { editorialDateLine, dailyFolio } from '../lib/folio'
import {
  BlockedNote,
  Colophon,
  CycleEntry,
  CycleReceiptSheet,
  DecisionCard,
  DirectiveComposer,
  DirectiveRow,
  LoopStatusPill,
  RunControlBar,
  Segmented,
  TrustColophon,
  VitalLedger,
  mapReviewQueue,
  relativeTime,
  shortHash,
  type LoopState,
} from '../components/loop'
import { useLoopCommand } from '../lib/loop/useLoopCommand'
import type { AtlasLoopCycleRecord, AtlasLoopLiveResponse, AtlasLoopOperatorDecisionReceipt } from '../lib/loop'

export default function LoopScreen() {
  const c = usePalette()
  const {
    live,
    cycles,
    cyclesReturned,
    cyclesTotal,
    loopState,
    loading,
    refreshing,
    reasonCode,
    cyclesBlocked,
    cyclesReasonCode,
    window,
    setWindow,
    refresh,
    decide,
    runControl,
    sendDirective,
    postedDirectives,
    busyAction,
    lastReachability,
  } = useLoopCommand()

  // Sheet host state (receipt fields live in the ledger record — no extra fetch).
  const [receiptRecord, setReceiptRecord] = useState<AtlasLoopCycleRecord | null>(null)
  // Operator-decision receipt detail (re-uses the bottom sheet via a record-less view).
  const [decisionReceipt, setDecisionReceipt] = useState<AtlasLoopOperatorDecisionReceipt | null>(null)

  // scroll-to-section: ImmuneLedger "kill armado" row -> Section v.
  const scrollRef = useRef<ScrollView>(null)
  const controlYRef = useRef(0)
  const onControlLayout = useCallback((e: LayoutChangeEvent) => {
    controlYRef.current = e.nativeEvent.layout.y
  }, [])
  const scrollToControl = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(0, controlYRef.current - 24), animated: true })
  }, [])

  // Derived view data.
  const reviewQueue = mapReviewQueue(live)
  const pendingCount = reviewQueue.length
  const newestCycleAt = cycles[0]?.recorded_at ?? null
  // The inline tail is capped at 8 (calm-under-load); the dossier never implies
  // more than the ledger holds.
  const TAIL_CAP = 8
  const showingPartial = !loading && cyclesTotal > TAIL_CAP
  const directiveHistory = postedDirectives
  const runState = {
    paused: live?.run_state?.pause?.active === true,
    killed: live?.run_state?.kill_switch?.active === true,
    hasActiveRun: live?.run_state?.lock?.held === true && live?.run_state?.lock?.orphaned !== true,
  }
  const killArmed = runState.killed
  const driftDesviado = readDrift(live)

  const onReceiptOpen = useCallback((record: AtlasLoopCycleRecord) => setReceiptRecord(record), [])

  return (
    <>
      <Screen
        ref={scrollRef}
        topExtra={22}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={c.bronze} />
        }
      >
        {/* index 0 — MASTHEAD + DATELINE + PILL */}
        <CodexReveal index={0}>
          <PressableTextScale
            onPress={() => router.replace('/edicao')}
            hitSlop={8}
            accessibilityLabel="voltar para edição"
          >
            <Masthead title="LOOP" folio={null} />
          </PressableTextScale>
          <EditorialDateline date={editorialDateLine()} edition="run vivo · ciclo 24h · comando em tempo real" />
          <View style={{ alignItems: 'flex-end', marginTop: -16, marginBottom: 16, marginHorizontal: 32 }}>
            <LoopStatusPill state={loopState} />
          </View>
        </CodexReveal>

        {loopState === 'no_signal' ? (
          /* WHOLE-SURFACE BLOCKED — masthead+dateline+pill above, then one note. */
          <CodexReveal index={1}>
            <SectionHead numeral="i" title="SINAL" />
            <BlockedNote
              title="Não consigo ler o loop agora."
              reason={humanizeReason(reasonCode)}
              rawCode={reasonCode ?? undefined}
              onRetry={() => void refresh()}
            />
          </CodexReveal>
        ) : (
          <>
            {/* index 1 — i SINAIS VITAIS (HERO #1) */}
            <CodexReveal index={1}>
              <SectionHead numeral="i" title="SINAIS VITAIS" deck={vitalsDeck(loopState)} />
              <VitalLedger
                live={live}
                loopState={loopState}
                loading={loading}
                newestCycleAt={newestCycleAt}
                onKillRowPress={scrollToControl}
              />
            </CodexReveal>

            {/* index 2 — ii DIÁRIO DE CICLOS (HERO #2) */}
            <CodexReveal index={2}>
              <SectionHead
                numeral="ii"
                title="DIÁRIO DE CICLOS"
                deck={`${loading ? '…' : cyclesReturned} ciclos · do mais recente`}
              />
              <View style={{ marginHorizontal: 32, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Label>janela</Label>
                <Segmented
                  value={window}
                  options={[
                    { value: '24h', label: '24H' },
                    { value: 'all', label: 'TUDO' },
                  ]}
                  onChange={(v) => setWindow(v as '24h' | 'all')}
                />
              </View>
              {loading ? (
                <CycleSkeletons count={3} />
              ) : cyclesBlocked ? (
                <BlockedNote
                  reason="O diário de ciclos não respondeu."
                  rawCode={cyclesReasonCode ?? undefined}
                  onRetry={() => void refresh()}
                />
              ) : cycles.length === 0 ? (
                <CyclesEmpty window={window} />
              ) : (
                cycles.slice(0, TAIL_CAP).map((rec, i) => (
                  <CycleEntry key={rec.cycle_id} record={rec} isNewest={i === 0} onOpenReceipt={onReceiptOpen} />
                ))
              )}
              {showingPartial ? (
                <PartialNote returned={Math.min(TAIL_CAP, cyclesReturned)} total={cyclesTotal} />
              ) : null}
            </CodexReveal>

            {/* index 3 — iii DECISÕES PENDENTES */}
            <CodexReveal index={3}>
              <SectionHead
                numeral="iii"
                title="DECISÕES PENDENTES"
                deck={pendingCount > 0 ? `${pendingCount} aguardando você` : undefined}
              />
              {loading ? (
                <DecisionSkeletons count={2} />
              ) : reviewQueue.length === 0 ? (
                <DecisionsEmptyPositive />
              ) : (
                reviewQueue.map((p) => (
                  <DecisionCard key={p.key} proposal={p} onDecide={decide} onViewReceipt={setDecisionReceipt} />
                ))
              )}
            </CodexReveal>

            {/* index 4 — iv DIRETIVA */}
            <CodexReveal index={4}>
              <SectionHead numeral="iv" title="DIRETIVA" deck="fale com o loop em linguagem natural" />
              <DirectiveComposer onSubmit={sendDirective} disabled={false} lastReachability={lastReachability} />
              {directiveHistory.length === 0 ? (
                <DirectiveHistoryEmpty />
              ) : (
                directiveHistory.slice(0, 5).map((d) => <DirectiveRow key={d.directive_id} directive={d} />)
              )}
            </CodexReveal>

            {/* index 5 — v CONTROLE (the lever, last) */}
            <CodexReveal index={5} style={{}}>
              <View onLayout={onControlLayout}>
                <SectionHead numeral="v" title="CONTROLE" deck={controlDeck(loopState)} />
                <RunControlBar
                  loopState={loopState}
                  runState={runState}
                  driftDesviado={driftDesviado}
                  killArmed={killArmed}
                  onControl={runControl}
                  busyAction={busyAction}
                />
              </View>
            </CodexReveal>

            {/* index 6 — vi CONFIANÇA (audit colophon) */}
            <CodexReveal index={6}>
              <SectionHead numeral="vi" title="CONFIANÇA" deck="o que a autonomia prova" />
              <TrustColophon live={live} cycles={cycles} loading={loading} />
            </CodexReveal>
          </>
        )}

        {/* index 7 — CLOSING */}
        <CodexReveal index={7}>
          <Colophon schemaShort={shortHash(live?.surface_hash)} generatedAt={relativeTime(live?.generated_at)} />
          <FolioFooter number={dailyFolio().number} suffix="loop" />
        </CodexReveal>
      </Screen>

      {/* Sheet host (outside the Screen scroll) */}
      <CycleReceiptSheet record={receiptRecord} visible={!!receiptRecord} onClose={() => setReceiptRecord(null)} />
      <DecisionReceiptSheet receipt={decisionReceipt} onClose={() => setDecisionReceipt(null)} />
    </>
  )
}

// ---------------------------------------------------------------------------
// Decks (pure functions of loopState / live) — SectionHead one-liners.
// ---------------------------------------------------------------------------
function vitalsDeck(state: LoopState): string | undefined {
  switch (state) {
    case 'alive':
      return 'vivo · saudável · ciclo em curso'
    case 'blocked':
      return 'vivo · em bloqueio honesto'
    case 'bug':
      return 'vivo · defeito detectado'
    case 'paused':
      return 'pausado pelo operador'
    case 'killed':
      return 'encerrado · à espera de liberação'
    case 'idle':
      return 'sem run ativo'
    case 'loading':
      return undefined
    default:
      return undefined
  }
}

function controlDeck(state: LoopState): string {
  switch (state) {
    case 'alive':
    case 'blocked':
    case 'bug':
      return 'loop em execução'
    case 'paused':
      return 'loop pausado'
    case 'killed':
      return 'loop encerrado'
    default:
      return 'sem run ativo'
  }
}

function readDrift(live: AtlasLoopLiveResponse | null): boolean {
  const immune = (live?.cockpit as Record<string, unknown> | undefined)?.immune as Record<string, unknown> | undefined
  const driftRaw = immune?.['drift'] ?? immune?.['drift_status']
  if (driftRaw == null) return false
  const drift = String(driftRaw).toLowerCase()
  return !['stable', 'estável', 'none', 'no_drift'].includes(drift)
}

function humanizeReason(code: string | null): string {
  switch (code) {
    case 'unknown_area':
      return 'Área desconhecida.'
    case 'network':
      return 'O leitor do loop não respondeu. Verifique o backend e o token.'
    default:
      if (code?.startsWith('http_')) return 'O leitor do loop respondeu com erro. Verifique o backend e o token.'
      return 'O leitor do loop não respondeu. Verifique o backend e o token.'
  }
}

// ---------------------------------------------------------------------------
// Local presentational helpers (engineering.tsx convention). Loading/empty per
// §STATES: ink3 "·····" placeholders that hold layout (no spinner/shimmer);
// decisions-empty is POSITIVE.
// ---------------------------------------------------------------------------
function CycleSkeletons({ count }: { count: number }) {
  const c = usePalette()
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{ marginHorizontal: 32, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: c.borderSoft, gap: 6 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.ink3 }} />
            <Frau italic size={16} lineHeight={22} color={c.ink3}>
              ·············
            </Frau>
          </View>
        </View>
      ))}
    </>
  )
}

function CyclesEmpty({ window }: { window: '24h' | 'all' }) {
  const c = usePalette()
  return (
    <View style={{ marginHorizontal: 32, gap: 6 }}>
      <Frau italic size={15} lineHeight={22} color={c.ink2}>
        Nenhum ciclo registrado ainda. O primeiro aparecerá aqui.
      </Frau>
      <Mono size={11} lineHeight={15} color={c.ink3}>
        {`tail 8 · ${window === '24h' ? '24h' : 'tudo'}`}
      </Mono>
    </View>
  )
}

function PartialNote({ returned, total }: { returned: number; total: number }) {
  const c = usePalette()
  return (
    <Mono size={11} lineHeight={15} color={c.ink3} style={{ marginHorizontal: 32, marginTop: 8 }}>
      {`mostrando ${returned} de ${total}`}
    </Mono>
  )
}

function DecisionSkeletons({ count }: { count: number }) {
  const c = usePalette()
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            marginHorizontal: 32,
            marginVertical: 8,
            borderWidth: 0.5,
            borderColor: c.border,
            borderRadius: 12,
            backgroundColor: c.surface,
            padding: 16,
            gap: 10,
          }}
        >
          <Frau italic size={17} lineHeight={24} color={c.ink3}>
            ···········
          </Frau>
          <Frau italic size={14} lineHeight={20} color={c.ink3}>
            ····· ····· ·····
          </Frau>
        </View>
      ))}
    </>
  )
}

function DecisionsEmptyPositive() {
  const c = usePalette()
  return (
    <View style={{ marginHorizontal: 32, gap: 6 }}>
      <Frau italic size={15} lineHeight={22} color={c.ink2}>
        Nada aguarda sua decisão. O loop está autônomo dentro do que você já permitiu.
      </Frau>
      <Mono size={11} lineHeight={15} letterSpacing={0.4} color={c.ink3}>
        INBOX LIMPA
      </Mono>
    </View>
  )
}

function DirectiveHistoryEmpty() {
  const c = usePalette()
  return (
    <Frau italic size={14} lineHeight={21} color={c.ink2} style={{ marginHorizontal: 32, marginTop: 14 }}>
      Nenhuma diretiva ainda. O que o loop deve priorizar?
    </Frau>
  )
}

// Operator-decision receipt detail — opened from a sealed decision row. Reuses
// CycleReceiptSheet's BottomSheet host shape; renders the receipt's proposal-only
// guarantees verbatim so the audit is never a hole.
function DecisionReceiptSheet({
  receipt,
  onClose,
}: {
  receipt: AtlasLoopOperatorDecisionReceipt | null
  onClose: () => void
}) {
  const c = usePalette()
  return (
    <BottomSheet visible={!!receipt} onClose={onClose} height="40%">
      {receipt === null ? null : (
        <View style={{ paddingHorizontal: 24, paddingBottom: 36, gap: 10 }}>
          <Mono size={12} lineHeight={17} letterSpacing={0.3} color={c.bronze}>
            {`RECIBO · ${shortHash(receipt.decision_id, 12)}`}
          </Mono>
          <Frau weight="med" size={18} lineHeight={25} color={c.ink}>
            {`Decisão: ${receipt.decision}`}
          </Frau>
          <Row label="executado" value={receipt.executed ? 'sim' : 'não'} />
          <Row label="requer execução do dono" value={receipt.requires_owner_execution ? 'sim' : 'não'} />
          <Row label="roteado a" value={receipt.routes_to_owner?.owner ?? '—'} />
          <Row label="próxima ação" value={receipt.next_allowed_action} />
          {receipt.rationale ? <Row label="justificativa" value={receipt.rationale} /> : null}
          <Frau italic size={13} lineHeight={19} color={c.ink2} style={{ marginTop: 6 }}>
            Aceito não executa. Encaminhado ao owner sob sua revisão.
          </Frau>
        </View>
      )}
    </BottomSheet>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const c = usePalette()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 4 }}>
      <Frau size={14} lineHeight={20} color={c.ink2}>
        {label}
      </Frau>
      <Mono size={12} lineHeight={18} color={c.ink} style={{ flexShrink: 1, textAlign: 'right' }} selectable>
        {value}
      </Mono>
    </View>
  )
}
