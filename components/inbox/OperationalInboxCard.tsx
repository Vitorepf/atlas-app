import { Pressable, StyleSheet, View } from 'react-native'
import { Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { AtlasOperationalInboxItem } from '../../lib/api/client'

interface Props {
  item: AtlasOperationalInboxItem
  busy?: boolean
  onOpen?: () => void
  onAction: (actionId: string) => void
}

export function OperationalInboxCard({ item, busy, onOpen, onAction }: Props) {
  const c = usePalette()
  const actions = item.available_actions.slice(0, 4)

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Pressable
        disabled={!onOpen}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.body,
          {
            backgroundColor: pressed ? c.premium : 'transparent',
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <View style={styles.metaRow}>
          <Mono size={11.5} lineHeight={15} letterSpacing={0.24} color={c.ink2}>
            {formatTime(item.created_at)}
          </Mono>
          <Sans weight="sb" size={10.5} lineHeight={14} letterSpacing={1.05} color={toneColor(item.severity, c)} style={styles.uppercase}>
            {item.severity}
          </Sans>
          <Sans weight="sb" size={10.5} lineHeight={14} letterSpacing={1.05} color={c.prussian} style={styles.uppercase}>
            {typeLabel(item.type)}
          </Sans>
        </View>

        <Sans weight="med" size={15.5} lineHeight={21} color={c.ink} numberOfLines={2}>
          {item.title}
        </Sans>
        {item.summary || item.body ? (
          <Sans size={13} lineHeight={19} color={c.ink2} numberOfLines={4} style={styles.summary}>
            {item.summary ?? item.body}
          </Sans>
        ) : null}
      </Pressable>

      {actions.length > 0 ? (
        <View style={[styles.actionRow, { borderTopColor: c.border }]}>
          {actions.map((action) => (
            <Pressable
              key={action.id}
              disabled={busy}
              onPress={() => onAction(action.id)}
              style={({ pressed }) => [
                styles.action,
                {
                  backgroundColor: pressed ? c.premium : 'transparent',
                  opacity: busy ? 0.35 : 1,
                },
              ]}
            >
              <Sans
                weight="sb"
                size={11.5}
                lineHeight={15}
                color={action.style === 'destructive' ? c.recRed : c.prussian}
                align="center"
                numberOfLines={1}
              >
                {action.label}
              </Sans>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function formatTime(value: string | null): string {
  if (!value) return '--:--'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '--:--'

  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function typeLabel(type: string): string {
  switch (type) {
    case 'self_diagnostic':
      return 'auto-diagnostico'
    case 'job_result':
      return 'job'
    case 'thread_update':
      return 'thread'
    default:
      return type.replace(/_/g, ' ')
  }
}

function toneColor(severity: string, c: ReturnType<typeof usePalette>): string {
  if (severity === 'critical' || severity === 'warning') return c.recRed
  return c.ink3
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  body: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  uppercase: { textTransform: 'uppercase' },
  summary: { marginTop: 6 },
  actionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  action: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
})
