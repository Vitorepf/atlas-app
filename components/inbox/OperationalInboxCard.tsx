import { Pressable, StyleSheet, View } from 'react-native'
import { Frau, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { AtlasOperationalInboxItem } from '../../lib/api/client'
import {
  buildOpCardSpec,
  formatMetaTime,
} from '../../lib/inboxOperational'
import {
  OperationalCardActions,
  OperationalCardMetaRow,
} from './OperationalInboxCardParts'

interface Props {
  item: AtlasOperationalInboxItem
  busy?: boolean
  onOpen?: () => void
  onAction: (actionId: string) => void
}

export function OperationalInboxCard({ item, busy, onOpen, onAction }: Props) {
  const c = usePalette()
  const spec = buildOpCardSpec(item)
  const time = formatMetaTime(item.created_at)

  return (
    <View
      style={[
        styles.card,
        {
          borderBottomColor: 'rgba(26,22,18,0.12)',
          borderBottomWidth: 1,
        },
        spec.cardClass === 'critical' && {
          borderTopWidth: 1,
          borderTopColor: c.recRed,
        },
        spec.cardClass === 'warning' && {
          borderTopWidth: 1,
          borderTopColor: c.bronze,
        },
      ]}
    >
      <Pressable
        disabled={!onOpen}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        style={({ pressed }) => [
          styles.body,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <OperationalCardMetaRow spec={spec} time={time} />

        <Sans
          weight="med"
          size={15.5}
          lineHeight={22}
          letterSpacing={-0.05}
          color={c.ink}
          numberOfLines={2}
        >
          {item.title}
        </Sans>

        {item.summary || item.body ? (
          <Frau
            italic
            size={13.5}
            lineHeight={20}
            letterSpacing={-0.04}
            color={c.ink2}
            numberOfLines={4}
            style={styles.summary}
          >
            {item.summary ?? item.body ?? ''}
          </Frau>
        ) : null}
      </Pressable>

      <OperationalCardActions busy={busy} onAction={onAction} spec={spec} />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  body: {
    paddingHorizontal: 32,
    paddingTop: 14,
    paddingBottom: 0,
  },
  summary: { marginTop: 8 },
})
