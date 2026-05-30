import { useEffect, useRef, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { fonts } from '../../design/tokens'
import { PressableTextScale } from '../atlas-ui/PressableScale'
import { PartialNote } from './PartialNote'
import { LOOP_LIST_STEP, useVisibleCount } from '../../lib/loop/useVisibleCount'

// =====================================================================
// Atlas Loop · THE pagination primitive — the LIST LAW (5 + carregar mais 5).
// =====================================================================
//
// Every list on the dossier (A FAZER / FEITO / DIÁRIO / DECISÕES / DIRETIVA
// history) renders through this one component so no section can dump a whole
// collection or dominate the reading. It shows at most `step` (5) rows and
// reveals another step at a time via a calm editorial control — NOT a SaaS
// button.
//
// CRITICAL (anti-flicker): the visible count is LOCAL state (useVisibleCount),
// fully decoupled from polling. A background refetch that returns the same
// surface_hash (same stable reference, see lib/loop/stableRef) does NOT reset or
// grow how much the operator expanded. The window only resets when `listKey`
// changes (an intentional new query, e.g. the DIÁRIO window 24H↔TUDO). It NEVER
// fabricates rows: it only ever caps a real array; `total` is the honest count.
//
// The newly-revealed rows are flagged (`isNewlyRevealed`) so the caller can apply
// a row-level reveal ONLY to the new 5 — already-visible rows never re-animate, so
// expansion reads like turning a page.

interface Props<T> {
  items: T[]
  /** Identity; changing it resets the window back to `step` (intentional). */
  listKey: string
  renderItem: (item: T, index: number, isNewlyRevealed: boolean) => ReactNode
  keyExtractor: (item: T, index: number) => string
  /** Rendered when items.length === 0 (NO control, NO PartialNote). */
  emptyState?: ReactNode
  /** Honest total for PartialNote (defaults to items.length). */
  total?: number
  step?: number
}

export function LoadMoreList<T>({
  items,
  listKey,
  renderItem,
  keyExtractor,
  emptyState,
  total,
  step = LOOP_LIST_STEP,
}: Props<T>) {
  const win = useVisibleCount(items, { step, initial: step })
  const reset = win.reset

  // Reset the window when the list identity changes (a new query, not a poll).
  // `reset` is a stable useCallback; depending on it keeps the effect honest
  // without re-running on every poll.
  const prevKey = useRef(listKey)
  useEffect(() => {
    if (prevKey.current !== listKey) {
      prevKey.current = listKey
      reset()
    }
  }, [listKey, reset])

  // The "newly revealed" frontier: rows at index >= shown - step. We only count
  // them as new once the window has actually grown past the first page, so the
  // first paint never animates rows as if they had just expanded.
  const grew = win.shown > step
  const frontier = grew ? win.shown - step : -1

  if (items.length === 0) {
    return <>{emptyState ?? null}</>
  }

  const realTotal = total ?? items.length

  return (
    <View>
      {win.items.map((item, index) => {
        const isNewlyRevealed = grew && index >= frontier
        return (
          <View key={keyExtractor(item, index)}>{renderItem(item, index, isNewlyRevealed)}</View>
        )
      })}

      {win.hasMore ? <LoadMoreRow onPress={win.loadMore} /> : null}

      {/* Calm honesty footer. Omitted for short lists (≤ step) — no chrome. */}
      {realTotal > step ? <PartialNote returned={win.shown} total={realTotal} /> : null}
    </View>
  )
}

// --- the "carregar mais 5" control (co-located; not a separate import) -----------

interface LoadMoreRowProps {
  label?: string
  onPress: () => void
}

// An editorial row, NOT a SaaS button: full-width, hairline-top, Mono bronze
// label with a trailing dot-leader (TocRow DOT vocabulary). Tapping reveals the
// next step instantly — no fetch, no spinner.
export function LoadMoreRow({ label = 'carregar mais 5  ↓', onPress }: LoadMoreRowProps) {
  const c = usePalette()
  return (
    <PressableTextScale onPress={onPress} haptic="light" accessibilityLabel="carregar mais 5">
      <View style={[styles.row, { borderTopColor: c.borderSoft }]}>
        <Mono size={12} lineHeight={16} letterSpacing={0.4} color={c.bronze}>
          {label}
        </Mono>
        <View style={styles.leaderWrap}>
          <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.leaderText, { color: c.ink3 }]}>
            {DOT_STRING}
          </Text>
        </View>
      </View>
    </PressableTextScale>
  )
}

const DOT_STRING = '· '.repeat(80)

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginHorizontal: 32,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  leaderWrap: {
    flex: 1,
    overflow: 'hidden',
    height: 14,
    justifyContent: 'flex-end',
  },
  leaderText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: 0.5,
    opacity: 0.55,
  },
})
