import { Pressable, StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { AtlasPalette } from '../../design/tokens'
import type { OpCardSpec, OpMetaCatColor } from '../../lib/inboxOperational'

export function OperationalCardMetaRow({
  spec,
  time,
}: {
  spec: OpCardSpec
  time: string | null
}) {
  const c = usePalette()

  return (
    <View style={styles.metaRow}>
      {time ? (
        <Mono
          size={11}
          lineHeight={14}
          letterSpacing={0.4}
          color={c.prussian}
          weight="med"
          style={styles.tabularNums}
        >
          {time}
        </Mono>
      ) : null}
      <MetaSep />
      <Mono
        size={10}
        lineHeight={13}
        letterSpacing={1.4}
        color={metaCatHex(spec.metaCatColor, c)}
        weight="med"
        style={styles.uppercase}
      >
        {spec.metaCatLabel.toUpperCase()}
      </Mono>
      {spec.metaOrigin ? (
        <>
          <MetaSep />
          <Frau italic size={12} lineHeight={15} color={c.ink3}>
            {spec.metaOrigin}
          </Frau>
        </>
      ) : null}
      {spec.showCriticalDot ? (
        <View style={[styles.criticalDot, { backgroundColor: c.recRed }]} />
      ) : null}
    </View>
  )
}

export function OperationalCardActions({
  busy,
  onAction,
  spec,
}: {
  busy?: boolean
  onAction: (actionId: string) => void
  spec: OpCardSpec
}) {
  const c = usePalette()
  if (!spec.primary && spec.secondary.length === 0) return null

  return (
    <View style={styles.actionsBlock}>
      {spec.primary ? (
        <Pressable
          disabled={busy}
          onPress={() => onAction(spec.primary!.id)}
          accessibilityRole="button"
          accessibilityLabel={spec.primary.label}
          style={({ pressed }) => [
            styles.actionPrimary,
            {
              borderTopColor: 'rgba(26,22,18,0.10)',
              borderTopWidth: 1,
              opacity: busy ? 0.35 : pressed ? 0.55 : 1,
            },
          ]}
        >
          <Frau
            weight="med"
            size={16}
            lineHeight={22}
            color={spec.primary.destructive ? c.recRed : c.prussian}
            align="center"
          >
            {spec.primary.label}
          </Frau>
        </Pressable>
      ) : null}

      {spec.secondary.length > 0 ? (
        <View
          style={[
            styles.actionSecondary,
            { borderTopColor: 'rgba(26,22,18,0.06)' },
          ]}
        >
          {spec.secondary.map((action, idx) => (
            <View key={action.id} style={styles.secondaryRow}>
              {idx > 0 ? (
                <Frau size={13} lineHeight={20} color={c.ink3} style={styles.secondaryDot}>
                  ·
                </Frau>
              ) : null}
              <Pressable
                disabled={busy}
                onPress={() => onAction(action.id)}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                style={({ pressed }) => ({ opacity: busy ? 0.35 : pressed ? 0.55 : 1 })}
              >
                <Frau
                  italic
                  weight={action.destructive ? 'med' : undefined}
                  size={13}
                  lineHeight={20}
                  color={action.destructive ? c.recRed : c.ink2}
                >
                  {action.label}
                </Frau>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

function MetaSep() {
  const c = usePalette()
  return (
    <Frau size={11} lineHeight={14} color={c.ink3} style={styles.metaSep}>
      ·
    </Frau>
  )
}

function metaCatHex(color: OpMetaCatColor, c: AtlasPalette): string {
  switch (color) {
    case 'rec-red': return c.recRed
    case 'bronze': return c.bronze
    case 'prussian': return c.prussian
    case 'moss': return c.moss
    case 'ink2': return c.ink2
    default: return c.ink2
  }
}

const styles = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
    marginBottom: 8,
  },
  metaSep: { opacity: 0.6 },
  uppercase: { textTransform: 'uppercase' },
  tabularNums: { fontVariant: ['tabular-nums'] },
  criticalDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginLeft: 'auto',
  },
  actionsBlock: {
    marginTop: 14,
  },
  actionPrimary: {
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  actionSecondary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'baseline',
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    columnGap: 10,
    rowGap: 6,
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  secondaryDot: {
    paddingHorizontal: 4,
    opacity: 0.6,
  },
})
