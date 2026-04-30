import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { BottomSheet } from '../sheets/BottomSheet'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { BronzeDiamond } from '../console/BronzeDiamond'
import { type DomainKey, domainColor } from '../../lib/domains'
import { useOverlays } from '../../lib/overlays'
import type { InboxDomainFilter } from './InboxDomainStatus'
import { useAtlasStore } from '../../lib/atlasStore'
import { CreateDomainPanel } from '../domains/CreateDomainPanel'

// Quiet domain picker for the Inbox. Mirrors RoutingSheet's editorial
// pattern but without cancelar/confirmar: filtering is a lens, not a
// commitment, so a single tap commits and closes. Active row is marked
// with ✦ bronze on the left.
//
// Mounted once via OverlayHost so its absolute positioning lives outside
// the Screen's ScrollView (otherwise `bottom: 0` lands inside the
// scrolling content, not the viewport).
export function InboxDomainSheet() {
  const c = usePalette()
  const open = useOverlays((s) => s.open)
  const current = useOverlays((s) => s.inboxDomainFilter)
  const cb = useOverlays((s) => s.onPickInboxDomainFilter)
  const close = useOverlays((s) => s.close)
  const domains = useAtlasStore((s) => s.domains)
  const visible = open === 'inboxDomainFilter'

  const choose = (next: InboxDomainFilter) => {
    cb?.(next)
    close()
  }

  return (
    <BottomSheet visible={visible} onClose={close} height="85%">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.diamondRow}>
          <BronzeDiamond size={18} />
        </View>

        <Frau
          size={26}
          lineHeight={32}
          align="center"
          color={c.ink}
          style={styles.heading}
        >
          Ver capturas em
        </Frau>

        <View style={[styles.headingRule, { backgroundColor: c.border }]} />

        <View style={styles.list}>
          <DomainRow
            label="todos os domínios"
            active={current === 'all'}
            onPress={() => choose('all')}
          />
          {domains.map((d) => (
            <DomainRow
              key={d.key}
              label={d.label}
              accent={domainColor(d.key, c, domains)}
              active={current === d.key}
              onPress={() => choose(d.key as DomainKey)}
            />
          ))}
        </View>

        <CreateDomainPanel onCreated={(domain) => choose(domain.key as DomainKey)} />
      </ScrollView>
    </BottomSheet>
  )
}

function DomainRow({
  label,
  accent,
  active,
  onPress,
}: {
  label: string
  accent?: string
  active: boolean
  onPress: () => void
}) {
  const c = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.65 : 1 }]}
    >
      <View style={styles.rowMarker}>
        {active ? <BronzeDiamond size={12} /> : null}
      </View>
      <View style={styles.rowBody}>
        <Frau size={18} lineHeight={24} color={accent ?? c.ink}>
          {label}
        </Frau>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 32,
  },
  diamondRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  heading: {
    paddingHorizontal: 12,
  },
  headingRule: {
    width: 32,
    height: StyleSheet.hairlineWidth,
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  list: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowMarker: {
    width: 24,
  },
  rowBody: {
    flex: 1,
  },
})
