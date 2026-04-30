import { Pressable, StyleSheet } from 'react-native'
import { Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { domainColor, type DomainKey } from '../lib/domains'
import { useAtlasStore } from '../lib/atlasStore'

interface Props {
  domain: DomainKey
  label: string
  active: boolean
  onPress: () => void
}

export function DomainChip({ domain, label, active, onPress }: Props) {
  const c = usePalette()
  const domains = useAtlasStore((s) => s.domains)
  const accent = domainColor(domain, c, domains)
  const bg = active ? accent : c.surface
  const border = active ? accent : c.border
  const fg = active ? c.bg : c.ink2

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Sans
        weight="med"
        size={11}
        letterSpacing={0.88}
        color={fg}
        style={{ textTransform: 'uppercase' }}
      >
        {label}
      </Sans>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
