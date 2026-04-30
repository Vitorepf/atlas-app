import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { BottomSheet } from './BottomSheet'
import { Frau, Sans } from '../../design/Type'
import { useTheme } from '../../design/theme'
import { useOverlays } from '../../lib/overlays'
import { domainColor, type DomainKey } from '../../lib/domains'
import { useAtlasStore } from '../../lib/atlasStore'
import { CreateDomainPanel } from '../domains/CreateDomainPanel'

interface DomainGlyph {
  key: DomainKey
  glyph: string
}

const GLYPHS: DomainGlyph[] = [
  { key: 'blackink', glyph: '◆' },
  { key: 'atlas',    glyph: '✦' },
  { key: 'saude',    glyph: '✜' },
  { key: 'financas', glyph: '▲' },
  { key: 'outro',    glyph: '·' },
]

export function DomainSheet() {
  const open = useOverlays((s) => s.open)
  const cb = useOverlays((s) => s.onPickDomain)
  const close = useOverlays((s) => s.close)
  const visible = open === 'domain'

  const finish = (d: DomainKey | null) => {
    cb?.(d)
    close()
  }

  return (
    <BottomSheet visible={visible} onClose={() => finish(null)} height="85%">
      <Body onPick={finish} />
    </BottomSheet>
  )
}

function Body({ onPick }: { onPick: (d: DomainKey | null) => void }) {
  const { c } = useTheme()
  const domains = useAtlasStore((s) => s.domains)
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.body}
      showsVerticalScrollIndicator={false}
    >
      <Frau size={24} lineHeight={29} letterSpacing={-0.36} color={c.ink} style={styles.header}>
        Sobre o quê é?
      </Frau>

      <View style={styles.list}>
        {domains.map((d) => {
          const accent = domainColor(d.key, c, domains)
          const glyph = GLYPHS.find((g) => g.key === d.key)?.glyph ?? '·'
          return (
            <Pressable
              key={d.key}
              onPress={() => onPick(d.key)}
              style={({ pressed }) => [
                styles.btn,
                {
                  backgroundColor: c.surface,
                  borderColor: c.border,
                  borderLeftColor: accent,
                  transform: [{ translateX: pressed ? 2 : 0 }, { scale: pressed ? 0.99 : 1 }],
                },
              ]}
            >
              <Sans size={18} weight="reg" color={accent} style={styles.glyph}>
                {glyph}
              </Sans>
              <Sans weight="sb" size={18} letterSpacing={-0.09} color={c.ink}>
                {d.label}
              </Sans>
            </Pressable>
          )
        })}
      </View>

      <CreateDomainPanel onCreated={(domain) => onPick(domain.key)} />

      <Pressable
        onPress={() => onPick(null)}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1, marginTop: 16, paddingVertical: 10 }]}
      >
        <Sans weight="med" size={14} align="center" color={c.ink2}>
          Pular
        </Sans>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 28 },
  header: { marginTop: 6, marginBottom: 18 },
  list: { gap: 8 },
  btn: {
    height: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
  },
  glyph: { width: 28, height: 28, textAlign: 'center', lineHeight: 28 },
})
