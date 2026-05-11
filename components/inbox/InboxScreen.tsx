import { useDeferredValue, useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Screen } from '../Screen'
import { PaperVignette } from './PaperVignette'
import { type InboxDomainFilter } from './InboxDomainStatus'
import { FocusModePill } from './FocusModePill'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { styles } from './inboxScreenStyles'
import { InboxModeTabs, MetaLine } from './InboxHeader'
import { useInboxFilterSlider } from './useInboxFilterSlider'
import {
  OperationalMetaLine,
} from './OperationalInboxSections'
import { InboxOperationalPane } from './InboxOperationalPane'
import { InboxCapturesPane } from './InboxCapturesPane'
import { useOverlays } from '../../lib/overlays'
import { useShell } from '../AtlasShell'
import { currentEdition, dailyFolio } from '../../lib/folio'
import { FolioFooter } from '../editorial/FolioFooter'
import { useOperationalInbox } from '../../lib/useOperationalInbox'
import { useInboxCaptures } from '../../lib/useInboxCaptures'
import { useInboxCaptureActions } from '../../lib/useInboxCaptureActions'
import type {
  InboxFilter,
  InboxMode,
  InboxSort,
} from '../../lib/inboxTypes'

export default function InboxScreen() {
  const c = usePalette()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { showToast } = useShell()
  const openDetail = useOverlays((s) => s.openDetail)
  const openOperationalDetail = useOverlays((s) => s.openOperationalDetail)
  const openDomainFilter = useOverlays((s) => s.openInboxDomainFilter)
  const openAtlasAi = useOverlays((s) => s.openAtlasAi)
  const [mode, setMode] = useState<InboxMode>('captures')
  const [filter, setFilter] = useState<InboxFilter>('open')
  const [focusMode, setFocusMode] = useState(false)
  const [domainFilter, setDomainFilter] = useState<InboxDomainFilter>('all')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [sort, setSort] = useState<InboxSort>('recent')
  const [searchFocused, setSearchFocused] = useState(false)
  const captureInbox = useInboxCaptures({
    domainFilter,
    filter,
    query: deferredQuery,
    sort,
  })
  const {
    hydrate,
    hydrated,
    items,
    metrics,
    openItems,
    sync,
    triageCapture,
  } = captureInbox
  const captureActions = useInboxCaptureActions({
    items,
    openItems,
    openDetail,
    showToast,
    sync,
    triageCapture,
  })
  const { resetTransientState } = captureActions
  const operationalInbox = useOperationalInbox({
    enabled: hydrated,
    showToast,
    openAtlasAi,
  })
  const filterSlider = useInboxFilterSlider(filter)

  const operationalCounts = operationalInbox.counts
  const operationalCriticalCount = operationalInbox.criticalCount

  useEffect(() => {
    if (mode === 'captures') return

    setSearchFocused(false)
    resetTransientState()
  }, [mode, resetTransientState])

  const [loading, setLoading] = useState(!hydrated)
  useEffect(() => {
    void hydrate().then(() => sync())
  }, [hydrate, sync])

  useEffect(() => {
    if (!hydrated) return
    if (!loading) return
    const t = setTimeout(() => setLoading(false), 360)
    return () => clearTimeout(t)
  }, [hydrated, loading])

  return (
    <View style={styles.fill}>
    {/* PaperVignette FORA do Screen · absoluteFillObject precisa preencher
        a viewport, não o contentContainer do ScrollView (que tem altura da
        rolagem inteira e gera retângulo visível com borda dura).

        v18.3 canon · Screen bare · "cream puro, sem grade" (mockup linha 894:
        `.viewport.va-canon { background-image: none }`). Os hairlines dos
        próprios componentes (masthead bottom, search-line, capture-entry
        borders, folio-footer top) já carregam toda a estrutura visual. Grade
        virava doubling — barulho. Vocabulário Patek/Cucinelli/NYRB. */}
    <PaperVignette />
    <Screen bare bottomPad={128}>
      {/* v13 · NewCapturesPill removido · era a "listra bronze que continua passando"
          que o usuário reclamou. Pill montava brevemente em propostas overnight e o
          fade-in 480ms expunha a borderTopColor: c.bronze como traço transient.
          Redundante: filter chip "propostas X" já comunica novidade · com bronze
          underline 60% quando ativo. Pill virava ruído acima da informação real.
          (Junto com LiveStatus removido em v12 · header zone agora silencioso.) */}
      <View style={styles.titleBlock}>
        <Pressable
          onLongPress={() => setFocusMode((f) => !f)}
          delayLongPress={400}
          accessibilityRole="header"
          accessibilityLabel="Inbox · pressione e segure para entrar em modo foco"
        >
          {/* canon mockup .va .masthead .title · Frau med 30, letterSpacing 5.5,
              uppercase. "I N B O X" com respiro tipográfico — não "Inbox" SaaS.
              FocusMode reduz pra 22 mantendo lspc proporcional. */}
          <Frau
            weight="med"
            size={focusMode ? 22 : 30}
            lineHeight={focusMode ? 28 : 36}
            letterSpacing={focusMode ? 4 : 5.5}
            color={c.ink}
            style={[styles.letterpressTitle, styles.uppercase]}
          >
            Inbox
          </Frau>
        </Pressable>
      </View>

      {/* canon mockup .va .dateline · centro, mt 14 mb 36, italic Frau 14
          color ink + edition mono caps 9.5 lspc 1.6 ink3 abaixo. Edição muda
          dinamicamente conforme hora do dia (matinal/vespertina/noturna). */}
      {!focusMode ? (
        <View style={styles.datelineBlock}>
          {mode === 'captures' ? (
            <MetaLine metrics={metrics} />
          ) : (
            <OperationalMetaLine
              total={operationalCounts.all}
              critical={operationalCriticalCount}
              mobilePaired={operationalInbox.mobilePaired}
              error={operationalInbox.error}
            />
          )}
          <Mono
            size={9.5}
            lineHeight={14}
            letterSpacing={1.6}
            color={c.ink3}
            style={[styles.uppercase, styles.datelineEdition]}
          >
            {currentEdition()}
          </Mono>
        </View>
      ) : null}

      {!focusMode ? (
        <InboxModeTabs
          active={mode}
          capturesCount={metrics.open}
          operationalCount={operationalCounts.all}
          operationalCritical={operationalCriticalCount}
          onChange={setMode}
        />
      ) : null}

      {/* v15 · cross-fade entre Capturas e Operacional · cinematic mode switch.
          Cada branch tem entering/exiting layout animation Reanimated · 280ms in
          / 180ms out · easing iOS sheet curve. Feel: revista virando seção, não
          tab clicando. */}
      {mode === 'captures' && (
        <InboxCapturesPane
          captureActions={captureActions}
          captureInbox={captureInbox}
          domainFilter={domainFilter}
          filter={filter}
          filterSlider={filterSlider}
          focusMode={focusMode}
          loading={loading}
          onOpenDetail={openDetail}
          openDomainFilter={openDomainFilter}
          query={query}
          searchFocused={searchFocused}
          setDomainFilter={setDomainFilter}
          setFilter={setFilter}
          setQuery={setQuery}
          setSearchFocused={setSearchFocused}
          setSort={setSort}
          sort={sort}
        />
      )}
      {mode === 'operational' && (
        <InboxOperationalPane
          criticalCount={operationalCriticalCount}
          inbox={operationalInbox}
          onOpenDetail={openOperationalDetail}
          onPair={() => router.push('/mobile-pairing')}
          total={operationalCounts.all}
        />
      )}

      {/* canon mockup .folio-footer · "— FOLIO N · INBOX —" mono caps centro
          + hairline-top @18% · fecha o exemplar como página de revista impressa.
          mode="captures" → suffix="inbox" · mode="operational" → "operacional".
          Não renderiza em focusMode (foco silencioso · sem chrome). */}
      {!focusMode ? (
        <FolioFooter
          number={dailyFolio().number}
          suffix={mode === 'captures' ? 'inbox' : 'operacional'}
        />
      ) : null}
    </Screen>

    {/* v18.2 · ✦ flutuante removido · captura de texto migrou pro long-press
        na tab "Capturas" (ver InboxModeTabs). Áudio continua via long-press
        no ✦ central do dock (Modo Gravar). Wrapper só renderiza FocusModePill
        quando focusMode ativo · saída visível pra desfocar. */}
    {focusMode ? (
      <View
        pointerEvents="box-none"
        style={[styles.floatingCapture, { bottom: 88 + insets.bottom }]}
      >
        <FocusModePill onPress={() => setFocusMode(false)} />
      </View>
    ) : null}
    </View>
  )
}

// v11 · ModeTabs centralizados · número ao lado removido (era "Capturas 5"/"Operacional 0")
// — count agora vive APENAS no subtitle ("5 abertas"/"0 ativos"), evita redundância.
// Tabs como grupo centralizado · gap 40 entre eles · underline acompanha largura
// exata da label (não overflow no tab inteiro como antes).
//
// v18.2 · Tab "Capturas" como entry-point dual:
// · tap → troca vista (Capturas ↔ Operacional)
// · long-press 220ms → /capture?mode=text (substitui ✦ flutuante removido)
// Áudio continua via long-press no ✦ central do dock (Modo Gravar inline).
// Vocabulário canon: gesto sobre o nome da seção significa "criar item nessa
// seção" — coerente com pattern Don Corleone "tocar a coisa pra invocá-la".
