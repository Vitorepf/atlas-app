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

      {/* Title · Sans med 22 ink (versão expandida do card) */}
      <Sans
        weight="med"
        size={22}
        lineHeight={29}
        letterSpacing={-0.18}
        color={c.ink}
        style={styles.title}
      >
        {item.title}
      </Sans>

      {/* Summary · Frau italic 15 ink2 */}
      {item.summary ? (
        <Frau
          italic
          size={15}
          lineHeight={22}
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
          size={15}
          lineHeight={23}
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
                  borderTopColor: 'rgba(26,22,18,0.10)',
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
                { borderTopColor: 'rgba(26,22,18,0.06)' },
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
    marginTop: 22,
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
})
