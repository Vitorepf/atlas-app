import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { BacklogRow } from './BacklogRow'
import { BlockedNote } from './BlockedNote'
import { LoadMoreRow } from './LoadMoreList'
import { PartialNote } from './PartialNote'
import { useLoopBacklogWindow } from '../../lib/loop'

interface Props {
  /** When the cockpit reports a blocked status, surface the real reason here. */
  blockedReason?: string | null
  /** Bubble the honest open count up so the section deck can read "{N} abertos". */
  onCount?: (count: number) => void
}

// Section iii body · A FAZER (BACKLOG) — open findings the loop still has to
// implement, under the LIST LAW (5 + carregar mais 5) via useLoopBacklogWindow.
// The window hook reveals 5 already-fetched rows instantly and only grows the
// server page when the local window runs out — never fabricating a row (`total`
// is the server's real count). Empty is POSITIVE; a read failure is honest.
export function BacklogList({ blockedReason, onCount }: Props) {
  const win = useLoopBacklogWindow()

  // Bubble the honest total up to the section deck (in an effect — never set
  // parent state during this component's render).
  useEffect(() => {
    if (!win.loading && !win.blocked) onCount?.(win.rawTotal)
  }, [win.rawTotal, win.loading, win.blocked, onCount])

  // Cockpit-level blocked beats the list (the area itself is blocked).
  if (blockedReason != null && String(blockedReason).trim() !== '') {
    return <BlockedNote reason={String(blockedReason)} />
  }

  if (win.loading) {
    return <BacklogSkeletons count={3} />
  }

  if (win.blocked) {
    return (
      <BlockedNote
        reason="A fila de implementação não respondeu."
        rawCode={win.reasonCode ?? undefined}
      />
    )
  }

  if (win.total === 0) {
    return <BacklogEmpty />
  }

  return (
    <View>
      {win.items.map((finding, i) => (
        <BacklogRow key={`${finding.finding_hash || finding.title || 'finding'}:${i}`} finding={finding} />
      ))}
      {win.hasMore ? <LoadMoreRow onPress={win.loadMore} /> : null}
      {win.total > 5 ? <PartialNote returned={win.shown} total={win.total} /> : null}
    </View>
  )
}

function BacklogEmpty() {
  const c = usePalette()
  return (
    <View style={styles.empty}>
      <Frau italic size={15} lineHeight={22} color={c.ink2}>
        Nada na fila de implementação para esta área.
      </Frau>
      <Mono size={11} lineHeight={15} letterSpacing={0.4} color={c.ink3}>
        BACKLOG LIMPO
      </Mono>
    </View>
  )
}

export function BacklogSkeletons({ count }: { count: number }) {
  const c = usePalette()
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            marginHorizontal: 32,
            paddingVertical: 12,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: c.borderSoft,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.ink3 }} />
            <Frau italic size={16} lineHeight={22} color={c.ink3}>
              ············
            </Frau>
          </View>
        </View>
      ))}
    </>
  )
}

const styles = StyleSheet.create({
  empty: {
    marginHorizontal: 32,
    gap: 6,
  },
})
