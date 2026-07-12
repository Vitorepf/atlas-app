import { Pressable, StyleSheet, View } from 'react-native'
import { Frau, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'

// Lista vertical com hairline lateral à esquerda · estilo citação editorial v7.
// Usado pra ideias atômicas e gatilhos futuros — itens que merecem respiração própria.
export function InfoListBlock({ label, items }: { label: string; items: string[] }) {
  const { c } = useTheme()
  return (
    <View style={styles.infoBlock}>
      <Sans
        weight="med"
        size={9.5}
        lineHeight={13}
        letterSpacing={1.2}
        color={c.ink2}
        style={styles.uppercase}
      >
        {label}
      </Sans>
      <View style={[styles.infoListWrap, { borderLeftColor: c.border }]}>
        {items.map((item, i) => (
          <Frau
            key={i}
            italic
            size={14}
            lineHeight={20}
            letterSpacing={-0.07}
            color={c.ink}
            style={i > 0 ? styles.infoListItemSpacing : undefined}
          >
            {item}
          </Frau>
        ))}
      </View>
    </View>
  )
}

export function InfoBlock({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { c } = useTheme()

  return (
    <View style={styles.infoBlock}>
      <Sans
        weight="med"
        size={9.5}
        lineHeight={13}
        letterSpacing={1.2}
        color={c.ink2}
        style={styles.uppercase}
      >
        {label}
      </Sans>
      <View style={styles.infoBlockValueRow}>
        {accent ? (
          <Frau italic size={13} lineHeight={20} color={c.bronze} style={styles.infoBlockStar}>
            ✦
          </Frau>
        ) : null}
        <Frau
          italic
          size={14}
          lineHeight={20}
          letterSpacing={-0.07}
          color={accent ? c.prussian : c.ink}
          style={styles.infoBlockValue}
        >
          {value}
        </Frau>
      </View>
    </View>
  )
}

export function DomainPill({ label, accent }: { label: string; accent: string }) {
  const { c } = useTheme()
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: c.surface, borderColor: c.border },
      ]}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent }} />
      <Sans
        weight="med"
        size={11}
        letterSpacing={0.88}
        color={accent}
        style={{ textTransform: 'uppercase' }}
      >
        {label}
      </Sans>
    </View>
  )
}

export function Tag({ label }: { label: string }) {
  const { c } = useTheme()
  return (
    <View style={[styles.tag, { borderColor: c.border }]}>
      <Sans weight="med" size={12} color={c.ink2}>
        {label}
      </Sans>
    </View>
  )
}

export function ActionButton({
  label,
  danger,
  disabled,
  onPress,
}: {
  label: string
  danger?: boolean
  disabled?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        {
          backgroundColor: pressed ? c.surface : 'transparent',
          borderColor: danger ? c.recRed : c.border,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Sans
        weight="med"
        size={13}
        align="center"
        color={danger ? c.recRed : c.ink}
      >
        {label}
      </Sans>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tag: {
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  uppercase: { textTransform: 'uppercase' },
  infoBlock: { gap: 5, marginBottom: 14 },
  infoBlockValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
  },
  infoBlockStar: { lineHeight: 14 },
  infoBlockValue: { flex: 1, minWidth: 0 },
  infoListWrap: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: 12,
    marginTop: 2,
  },
  infoListItemSpacing: {
    marginTop: 6,
  },
  actionBtn: {
    flexGrow: 1,
    minWidth: 96,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
})
