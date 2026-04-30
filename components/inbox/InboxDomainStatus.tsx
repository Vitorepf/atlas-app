import { Pressable, StyleSheet, View } from 'react-native'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { type DomainKey, domainLabel } from '../../lib/domains'
import { useAtlasStore } from '../../lib/atlasStore'

export type InboxDomainFilter = 'all' | DomainKey

interface Props {
  domain: InboxDomainFilter
  onPress: () => void
}

// The Inbox's editorial domain-scope line. A single italic sentence
// reading "em todos os domínios · trocar" or "em blackink · trocar".
// Tap opens InboxDomainSheet. Same pattern as console/StatusRouting:
// prose, not chips. The screen stays bronze-free; the affordance lives
// in the suffix italic.
export function InboxDomainStatus({ domain, onPress }: Props) {
  const c = usePalette()
  const domains = useAtlasStore((s) => s.domains)
  const overridden = domain !== 'all'
  const opacity = overridden ? 0.55 : 0.4

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`escopo atual: ${domainPhrase(domain, domains)}. tocar para trocar.`}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.65 : 1 }]}
    >
      <View style={styles.line}>
        <Frau italic size={13} lineHeight={18} color={c.ink} style={{ opacity }}>
          {domainPhrase(domain, domains)}
        </Frau>
        <Frau
          italic
          size={13}
          lineHeight={18}
          color={c.ink}
          style={{ opacity: opacity * 0.7, marginLeft: 8 }}
        >
          · trocar
        </Frau>
      </View>
    </Pressable>
  )
}

export function domainPhrase(domain: InboxDomainFilter, domains = useAtlasStore.getState().domains): string {
  if (domain === 'all') return 'em todos os domínios'
  return `em ${domainLabel(domain, domains).toLowerCase()}`
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 10,
    minHeight: 38,
    justifyContent: 'center',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
})
