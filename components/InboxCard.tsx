import { Pressable, StyleSheet, View } from 'react-native'
import { Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { type DomainKey, domainColor, domainLabel } from '../lib/domains'

export interface InboxItem {
  id: string
  clientId?: string
  time: string
  date?: string
  domain: DomainKey
  kind?: 'audio' | 'text' | 'photo'
  text: string
  durationMs?: number | null
  transcriptionStatus?: 'pending' | 'processing' | 'done' | 'failed' | 'na'
  fileUrl?: string | null
  fileHeaders?: Record<string, string> | null
  tags?: string[]
  capturedAt?: string
  capturedLat?: number | null
  capturedLng?: number | null
  isLocal?: boolean
}

interface Props {
  item: InboxItem
  onPress?: () => void
}

export function InboxCard({ item, onPress }: Props) {
  const c = usePalette()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: pressed ? c.ink2 : c.border,
          transform: [{ translateX: pressed ? 2 : 0 }],
        },
      ]}
    >
      <View style={styles.metaRow}>
        <Mono size={12} lineHeight={16} letterSpacing={0.24} color={c.ink2}>
          {item.time}
        </Mono>
        {item.kind && (
          <Sans
            weight="sb"
            size={10.5}
            lineHeight={14}
            letterSpacing={1.05}
            color={c.ink2}
            style={{ textTransform: 'uppercase' }}
          >
            {kindLabel(item.kind)}
          </Sans>
        )}
        <Sans
          weight="sb"
          size={10.5}
          lineHeight={14}
          letterSpacing={1.05}
          color={domainColor(item.domain, c)}
          style={{ textTransform: 'uppercase' }}
        >
          {domainLabel(item.domain)}
        </Sans>
        {item.isLocal && (
          <Mono size={10.5} lineHeight={14} letterSpacing={0.42} color={c.bronze}>
            FILA
          </Mono>
        )}
      </View>
      <Sans size={14.5} lineHeight={21} color={c.ink}>
        {item.text}
      </Sans>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
})

// re-export for convenience
export { domainColor, domainLabel }
export type { DomainKey }

function kindLabel(kind: NonNullable<InboxItem['kind']>): string {
  switch (kind) {
    case 'audio':
      return 'áudio'
    case 'photo':
      return 'imagem'
    case 'text':
      return 'texto'
  }
}
