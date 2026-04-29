import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { Screen } from '../components/Screen'
import { InboxCard } from '../components/InboxCard'
import { InboxSkeleton } from '../components/InboxSkeleton'
import { EmptyInbox } from '../components/EmptyInbox'
import { Frau, Label } from '../design/Type'
import { usePalette } from '../design/theme'
import { useOverlays } from '../lib/overlays'
import { captureToInboxItem, useAtlasStore, visibleCaptures } from '../lib/atlasStore'

export default function InboxScreen() {
  const c = usePalette()
  const openDetail = useOverlays((s) => s.openDetail)
  const hydrated = useAtlasStore((s) => s.hydrated)
  const captures = useAtlasStore((s) => s.captures)
  const queuedCaptures = useAtlasStore((s) => s.queuedCaptures)
  const hydrate = useAtlasStore((s) => s.hydrate)
  const sync = useAtlasStore((s) => s.sync)

  const items = useMemo(
    () => visibleCaptures({ captures, queuedCaptures }).map(captureToInboxItem),
    [captures, queuedCaptures],
  )

  // Initial-load skeleton — fade in real list after 360ms on first visit.
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
    <Screen>
      <View style={styles.titleBlock}>
        <Frau size={42} lineHeight={44} letterSpacing={-1.05} color={c.ink}>
          Inbox
        </Frau>
        <Label style={{ marginTop: 10 }}>Últimas 50 capturas</Label>
      </View>

      {loading ? (
        <InboxSkeleton />
      ) : items.length === 0 ? (
        <EmptyInbox />
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((item) => (
            <InboxCard
              key={item.id}
              item={item}
              onPress={() => openDetail(item)}
            />
          ))}
        </View>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  titleBlock: { marginBottom: 28 },
})
