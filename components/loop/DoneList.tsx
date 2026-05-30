import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { CycleEntry } from './CycleEntry'
import { BlockedNote } from './BlockedNote'
import { LoadMoreRow } from './LoadMoreList'
import { PartialNote } from './PartialNote'
import { useLoopDoneWindow, type AtlasLoopCycleRecord } from '../../lib/loop'

interface Props {
  onOpenReceipt: (record: AtlasLoopCycleRecord) => void
  /** Bubble the real delivered total up so the section deck reads "{N} entregues". */
  onCount?: (count: number) => void
}

// Section iv body · FEITO (IMPLEMENTADO) — delivered cycles only. The backend
// /done endpoint already enforces the hard truth (outcome===merged &&
// merge_performed && merge_hash!==''), so every row here is a REAL merge with a
// hash; this component renders zero NEW proof — it reuses CycleEntry verbatim
// (MergeHashChip + ProofChip + receipt). LIST LAW via useLoopDoneWindow. Empty
// is honest; a read failure is honest. Never fabricates a delivery.
export function DoneList({ onOpenReceipt, onCount }: Props) {
  const win = useLoopDoneWindow()

  // Bubble the real delivered total up to the deck (effect — never during render).
  useEffect(() => {
    if (!win.loading && !win.blocked) onCount?.(win.total)
  }, [win.total, win.loading, win.blocked, onCount])

  if (win.loading) {
    return <DoneSkeletons count={3} />
  }

  if (win.blocked) {
    return (
      <BlockedNote
        reason="O registro de entregas não respondeu."
        rawCode={win.reasonCode ?? undefined}
      />
    )
  }

  if (win.total === 0) {
    return <DoneEmpty />
  }

  return (
    <View>
      {win.items.map((rec, i) => (
        <CycleEntry key={rec.cycle_id} record={rec} isNewest={i === 0} onOpenReceipt={onOpenReceipt} />
      ))}
      {win.hasMore ? <LoadMoreRow onPress={win.loadMore} /> : null}
      {win.total > 5 ? <PartialNote returned={win.shown} total={win.total} /> : null}
    </View>
  )
}

function DoneEmpty() {
  const c = usePalette()
  return (
    <View style={styles.empty}>
      <Frau italic size={15} lineHeight={22} color={c.ink2}>
        Nenhuma entrega provada ainda. O primeiro merge aparece aqui.
      </Frau>
      <Mono size={11} lineHeight={15} letterSpacing={0.4} color={c.ink3}>
        SEM ENTREGAS
      </Mono>
    </View>
  )
}

export function DoneSkeletons({ count }: { count: number }) {
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
