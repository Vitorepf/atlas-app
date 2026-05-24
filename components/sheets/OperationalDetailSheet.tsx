import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { BottomSheet } from './BottomSheet'
import { Frau, Mono, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useOverlays } from '../../lib/overlays'
import { useShell } from '../AtlasShell'

// Type-narrowing helper · respond/discuss endpoints retornam
// `result: Record<string, unknown>`; extract thread_id se vier.
function extractThreadId(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null
  const candidate = (result as Record<string, unknown>).thread_id
  if (typeof candidate === 'string' && candidate.length > 0) return candidate
  return null
}
import {
  buildOperationalBrief,
  buildOpCardSpec,
  formatMetaTime,
  type OpMetaCatColor,
} from '../../lib/inboxOperational'
import {
  dismissMobileInboxItem,
  discussMobileInboxItem,
  getMobileInboxItem,
  markMobileInboxRead,
  respondMobileInboxItem,
  snoozeMobileInboxItem,
  type AtlasOperationalInboxItem,
} from '../../lib/api/client'
import type { AtlasPalette } from '../../design/tokens'

// =============================================================================
// OperationalDetailSheet · canon mockup (v18)
// =============================================================================
//
// Detalhe de item operacional como sheet modal · coerente com DetailSheet de
// capturas. Layout canon:
//
//   detail-handle (do BottomSheet)
//   meta-header · time prussian + meta-cat color + origin italic + critical-dot
//   hairline-bottom bronze@18% · sinal "header termina"
//   title · Sans med 17 ink lh 1.4
//   summary · Frau italic 15 ink2 lh 1.55 (margin top 14)
//   body extra (quando houver) · Frau 15 ink lh 1.55
//   actions-block · primary upright + secondary inline italic
//   hairline + ações secundárias · adiar/discutir/descartar
//
// Esse sheet substitui (em uso inline) a rota fullscreen
// `app/mobile-inbox-item.tsx` (que continua existindo como entrypoint pra
// deep-links/push notifications).
// =============================================================================

export function OperationalDetailSheet() {
  const open = useOverlays((s) => s.open)
  const itemId = useOverlays((s) => s.operationalDetailId)
  const close = useOverlays((s) => s.close)
  const openAtlasAi = useOverlays((s) => s.openAtlasAi)
  const visible = open === 'operationalDetail'
  const { showToast } = useShell()

  const [item, setItem] = useState<AtlasOperationalInboxItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  // Carrega o item ao abrir.
  useEffect(() => {
    if (!visible || !itemId) {
      setItem(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const fetched = await getMobileInboxItem(itemId)
        if (cancelled) return
        setItem(fetched.item)
        // Marca como lido em segundo plano (não bloqueante).
        if (fetched.item.status === 'unread') {
          void markMobileInboxRead(itemId).catch(() => {})
        }
      } catch {
        if (cancelled) return
        showToast('Falha ao carregar item operacional')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [visible, itemId, showToast])

  const onAction = useCallback(
    async (actionId: string) => {
      if (!item || busy) return
      setBusy(true)
      try {
        if (actionId === 'dismiss') {
          await dismissMobileInboxItem(item.id)
          showToast('Item descartado')
          close()
          return
        }
        if (actionId === 'snooze') {
          // Snooze padrão · 7 dias (UI dedicada via SnoozeSheet abre via outro fluxo)
          const sevenDaysISO = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          await snoozeMobileInboxItem(item.id, sevenDaysISO, 'Adiado pelo app por 7 dias')
          showToast('Item adiado por 7 dias')
          close()
          return
        }
        if (actionId === 'discuss') {
          const response = await discussMobileInboxItem(item.id)
          const threadId = extractThreadId(response.result)
          // Fecha o sheet operacional e abre o AtlasAiSheet com a thread
          // retornada — vocabulário canon "uma sala dá lugar à outra".
          close()
          openAtlasAi(threadId)
          return
        }
        // Generic action via respond endpoint
        await respondMobileInboxItem(item.id, actionId, {})
        showToast('Ação registrada')
      } catch {
        showToast('Não consegui executar a ação')
      } finally {
        setBusy(false)
      }
    },
    [item, busy, close, showToast],
  )

  return (
    <BottomSheet visible={visible} onClose={close} height="85%">
      {item ? (
        <Body item={item} loading={loading} busy={busy} onAction={onAction} />
      ) : loading ? (
        <LoadingBody />
      ) : (
        <EmptyBody />
      )}
    </BottomSheet>
  )
}

function Body({
  item,
  loading,
  busy,
  onAction,
}: {
  item: AtlasOperationalInboxItem
  loading: boolean
  busy: boolean
  onAction: (actionId: string) => void
}) {
  const { c } = useTheme()
  const spec = buildOpCardSpec(item)
  const brief = buildOperationalBrief(item)
  const time = formatMetaTime(item.created_at)

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Meta header */}
      <View style={styles.metaHeader}>
        <View style={styles.metaRow}>
          {time ? (
            <Mono
              size={11}
              lineHeight={14}
              letterSpacing={0.6}
              color={c.prussian}
              weight="med"
              style={styles.tabularNums}
            >
              {time}
            </Mono>
          ) : null}
          <MetaSep />
          <Mono
            size={10}
            lineHeight={13}
            letterSpacing={1.4}
            color={metaCatHex(spec.metaCatColor, c)}
            weight="med"
            style={styles.uppercase}
          >
            {spec.metaCatLabel.toUpperCase()}
          </Mono>
          {spec.metaOrigin ? (
            <>
              <MetaSep />
              <Frau italic size={12} lineHeight={15} color={c.ink3}>
                {spec.metaOrigin}
              </Frau>
            </>
          ) : null}
          {spec.showCriticalDot ? (
            <View style={[styles.criticalDot, { backgroundColor: c.recRed }]} />
          ) : null}
        </View>
      </View>

      {/* Hairline scroll-edge bronze@18% */}
      <View style={[styles.headerRule, { backgroundColor: 'rgba(155,122,63,0.18)' }]} />

      <View style={[styles.executivePanel, { borderColor: item.severity === 'critical' ? c.recRed : c.border, backgroundColor: c.surface }]}>
        <View style={styles.executivePanelTop}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Mono size={9.5} lineHeight={12} letterSpacing={1} color={item.severity === 'critical' ? c.recRed : c.prussian} style={styles.uppercase}>
              {brief.kicker}
            </Mono>
            <Sans weight="sb" size={16} lineHeight={21} color={c.ink} style={styles.executiveHeadline}>
              {brief.headline}
            </Sans>
          </View>
          <Mono size={10} lineHeight={13} letterSpacing={0.2} color={item.severity === 'critical' ? c.recRed : c.ink2} numberOfLines={2}>
            {brief.statusLabel}
          </Mono>
        </View>

        {brief.metrics.length > 0 ? (
          <View style={styles.detailMetricGrid}>
            {brief.metrics.slice(0, 6).map((metric) => (
              <View key={`${metric.label}-${metric.value}`} style={[styles.detailMetric, { borderColor: c.border, backgroundColor: c.bg }]}>
                <Mono size={9.2} lineHeight={12} letterSpacing={0.7} color={c.ink3} style={styles.uppercase} numberOfLines={1}>
                  {metric.label}
                </Mono>
                <Sans weight="sb" size={14} lineHeight={18} color={metricTone(metric.tone, c)} numberOfLines={1}>
                  {metric.value}
                </Sans>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <ReportBlock eyebrow="Resumo" title="O que aconteceu" body={brief.summary} />
      <ReportBlock eyebrow="Impacto" title="Por que importa" body={brief.whyItMatters} />
      <ReportBlock eyebrow="Decisão" title="Próximo passo" body={brief.nextStep} accent />

      {brief.recommendedActions.length > 0 ? (
        <View style={[styles.reportBlock, { borderColor: c.border }]}>
          <Mono size={9.5} lineHeight={12} letterSpacing={1} color={c.ink3} style={styles.uppercase}>
            Ações recomendadas
          </Mono>
          <View style={styles.recommendedList}>
            {brief.recommendedActions.slice(0, 5).map((action) => (
              <View key={action} style={styles.recommendedRow}>
                <View style={[styles.recommendedDot, { backgroundColor: c.prussian }]} />
                <Sans size={13} lineHeight={18} color={c.ink} style={{ flex: 1 }}>
                  {action}
                </Sans>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Title · fallback técnico expandido */}
      <Sans
        weight="med"
        size={17}
        lineHeight={23}
        letterSpacing={-0.18}
        color={c.ink}
        style={styles.title}
      >
        Evidência original
      </Sans>

      {/* Summary · Frau italic 15 ink2 */}
      {item.summary ? (
        <Frau
          italic
          size={13.5}
          lineHeight={20}
          letterSpacing={-0.04}
          color={c.ink2}
          style={styles.summary}
        >
          {item.summary}
        </Frau>
      ) : null}

      {/* Body extra · Frau regular 15 ink */}
      {item.body && item.body !== item.summary ? (
        <Frau
          size={13.5}
          lineHeight={20}
          letterSpacing={0}
          color={c.ink}
          style={styles.bodyText}
        >
          {item.body}
        </Frau>
      ) : null}

      {loading ? (
        <Mono size={10} lineHeight={14} letterSpacing={1.4} color={c.ink3} style={styles.loading}>
          ATUALIZANDO…
        </Mono>
      ) : null}

      {/* Actions block · primary upright + secondary inline italic */}
      {spec.primary || spec.secondary.length > 0 ? (
        <View style={styles.actionsBlock}>
          {spec.primary ? (
            <Pressable
              disabled={busy}
              onPress={() => onAction(spec.primary!.id)}
              accessibilityRole="button"
              accessibilityLabel={spec.primary.label}
              style={({ pressed }) => [
                styles.actionPrimary,
                {
                  borderTopColor: 'rgba(233,238,242,0.05)',
                  borderTopWidth: 1,
                  opacity: busy ? 0.35 : pressed ? 0.55 : 1,
                },
              ]}
            >
              <Frau
                weight="med"
                size={16}
                lineHeight={22}
                color={spec.primary.destructive ? c.recRed : c.prussian}
                align="center"
              >
                {spec.primary.label}
              </Frau>
            </Pressable>
          ) : null}

          {spec.secondary.length > 0 ? (
            <View
              style={[
                styles.actionSecondary,
                { borderTopColor: 'rgba(233,238,242,0.04)' },
              ]}
            >
              {spec.secondary.map((action, idx) => (
                <View key={action.id} style={styles.secondaryRow}>
                  {idx > 0 ? (
                    <Frau size={13} lineHeight={20} color={c.ink3} style={styles.secondaryDot}>
                      ·
                    </Frau>
                  ) : null}
                  <Pressable
                    disabled={busy}
                    onPress={() => onAction(action.id)}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                    style={({ pressed }) => ({
                      opacity: busy ? 0.35 : pressed ? 0.55 : 1,
                    })}
                  >
                    <Frau
                      italic
                      weight={action.destructive ? 'med' : undefined}
                      size={13}
                      lineHeight={20}
                      color={action.destructive ? c.recRed : c.ink2}
                    >
                      {action.label}
                    </Frau>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  )
}

function ReportBlock({
  accent = false,
  body,
  eyebrow,
  title,
}: {
  accent?: boolean
  body: string
  eyebrow: string
  title: string
}) {
  const { c } = useTheme()

  return (
    <View style={[styles.reportBlock, { borderColor: accent ? c.bronze : c.border, backgroundColor: accent ? c.premium : 'transparent' }]}>
      <Mono size={9.5} lineHeight={12} letterSpacing={1} color={accent ? c.bronze : c.ink3} style={styles.uppercase}>
        {eyebrow}
      </Mono>
      <Sans weight="sb" size={13.5} lineHeight={18} color={c.ink}>
        {title}
      </Sans>
      <Sans size={13} lineHeight={19} color={c.ink2}>
        {body}
      </Sans>
    </View>
  )
}

function metricTone(tone: string, c: AtlasPalette): string {
  if (tone === 'critical') return c.recRed
  if (tone === 'warning') return c.bronze
  if (tone === 'ok') return c.moss
  return c.prussian
}

function LoadingBody() {
  const { c } = useTheme()
  return (
    <View style={styles.emptyState}>
      <Mono
        size={10}
        lineHeight={14}
        letterSpacing={1.6}
        color={c.ink3}
        style={styles.uppercase}
      >
        CARREGANDO
      </Mono>
      <Frau italic size={17} lineHeight={26} color={c.ink2} style={styles.emptyProse}>
        Atlas está abrindo o item.
      </Frau>
    </View>
  )
}

function EmptyBody() {
  const { c } = useTheme()
  return (
    <View style={styles.emptyState}>
      <Mono
        size={10}
        lineHeight={14}
        letterSpacing={1.6}
        color={c.ink3}
        style={styles.uppercase}
      >
        SEM ITEM
      </Mono>
      <Frau italic size={17} lineHeight={26} color={c.ink2} style={styles.emptyProse}>
        Item não disponível.
      </Frau>
    </View>
  )
}

function MetaSep() {
  const { c } = useTheme()
  return (
    <Frau size={11} lineHeight={14} color={c.ink3} style={styles.metaSep}>
      ·
    </Frau>
  )
}

function metaCatHex(color: OpMetaCatColor, c: AtlasPalette): string {
  switch (color) {
    case 'rec-red': return c.recRed
    case 'bronze': return c.bronze
    case 'prussian': return c.prussian
    case 'moss': return c.moss
    case 'ink2': return c.ink2
    default: return c.ink2
  }
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: 32,
  },
  metaHeader: {
    paddingHorizontal: 32,
    paddingBottom: 14,
  },
  headerRule: {
    height: 1,
    marginHorizontal: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  metaSep: { opacity: 0.6 },
  tabularNums: { fontVariant: ['tabular-nums'] },
  uppercase: { textTransform: 'uppercase' },
  criticalDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginLeft: 'auto',
  },
  title: {
    marginHorizontal: 32,
    marginTop: 12,
    marginBottom: 8,
  },
  summary: {
    marginHorizontal: 32,
    marginBottom: 14,
  },
  bodyText: {
    marginHorizontal: 32,
    marginBottom: 14,
  },
  loading: {
    marginHorizontal: 32,
    marginTop: 4,
    marginBottom: 14,
  },
  actionsBlock: {
    marginTop: 22,
  },
  actionPrimary: {
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  actionSecondary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'baseline',
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    columnGap: 10,
    rowGap: 6,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  secondaryDot: {
    paddingHorizontal: 4,
    opacity: 0.6,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 32,
  },
  emptyProse: {
    marginTop: 12,
    textAlign: 'center',
  },
  executivePanel: {
    marginHorizontal: 24,
    marginTop: 18,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  executivePanelTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  executiveHeadline: {
    marginTop: 4,
  },
  detailMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detailMetric: {
    minWidth: 112,
    flexGrow: 1,
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  reportBlock: {
    marginHorizontal: 24,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    gap: 6,
  },
  recommendedList: {
    gap: 8,
  },
  recommendedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  recommendedDot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    marginTop: 7,
  },
})
