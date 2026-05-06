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

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={`escopo atual: ${domainPhrase(domain, domains)}. tocar para trocar.`}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.65 : 1 }]}
    >
      <View style={styles.line}>
        <Frau italic size={14} lineHeight={20} letterSpacing={-0.07} color={c.ink2}>
          {domainPhrase(domain, domains)}
        </Frau>
        <Frau
          italic
          size={14}
          lineHeight={20}
          letterSpacing={-0.07}
          color={c.ink3}
          style={{ marginLeft: 6 }}
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

// v11 · alignItems center → linha "em todos os domínios · trocar" centralizada
// horizontalmente · matching ModeTabs centralizados que vieram logo abaixo.
const styles = StyleSheet.create({
  row: {
    paddingVertical: 10,
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
  },
  line: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
})
