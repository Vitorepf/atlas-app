import { Pressable, StyleSheet, View } from 'react-native'
import { Label, Mono, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import { type ConnectionStatusKind, type SegOption } from './settingsStatus'

export function Section({ label, children }: { label: string; children: React.ReactNode }) {
  const { c } = useTheme()
  return (
    <View>
      <View style={styles.sectionHead}>
        <Label color={c.ink2}>{label}</Label>
      </View>
      <View style={[styles.sectionBody, { borderTopColor: c.border, borderBottomColor: c.border }]}>
        {children}
      </View>
    </View>
  )
}

export function Row({
  name,
  desc,
  children,
  first,
}: {
  name: string
  desc?: string
  children: React.ReactNode
  first?: boolean
}) {
  const { c } = useTheme()
  return (
    <View
      style={[
        styles.row,
        !first && { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <View style={styles.rowMain}>
        <Sans weight="med" size={17} letterSpacing={-0.09} color={c.ink}>
          {name}
        </Sans>
        {desc && (
          <Sans size={13} lineHeight={18} color={c.ink2}>
            {desc}
          </Sans>
        )}
      </View>
      {children}
    </View>
  )
}

export function StatusBadge({ status }: { status: ConnectionStatusKind }) {
  const { c } = useTheme()
  const isOnline = status === 'online'
  const color = isOnline ? c.moss : status === 'pending' ? c.bronze : c.recRed
  const label = isOnline ? 'ONLINE' : status === 'pending' ? 'SYNC' : 'OFFLINE'

  return (
    <View style={[styles.statusBadge, { borderColor: color }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Mono size={11} letterSpacing={0.44} color={color}>
        {label}
      </Mono>
    </View>
  )
}

export function ApiAutoSaveBadge({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  const { c } = useTheme()
  if (state === 'idle') return null
  return (
    <View style={styles.autoSaveBadge}>
      <Mono size={10} letterSpacing={0.4} color={c.ink2}>
        {state === 'saving' ? 'salvando…' : 'salvo'}
      </Mono>
    </View>
  )
}

export function MiniButton({
  label,
  disabled,
  onPress,
}: {
  label: string
  disabled?: boolean
  onPress: () => void
}) {
  const { c } = useTheme()

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniButton,
        {
          backgroundColor: pressed ? c.surface : 'transparent',
          borderColor: c.prussian,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <Sans weight="med" size={13} lineHeight={17} color={c.prussian} align="center" numberOfLines={2}>
        {label}
      </Sans>
    </Pressable>
  )
}

export function ModelMetric({ label, value }: { label: string; value: string }) {
  const { c } = useTheme()

  return (
    <View style={styles.modelMetric}>
      <Mono size={9.5} letterSpacing={0.35} color={c.ink2}>
        {label.toUpperCase()}
      </Mono>
      <Sans weight="med" size={13} lineHeight={17} color={c.ink}>
        {value}
      </Sans>
    </View>
  )
}

export function Segmented({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string
  options: SegOption[]
  disabled?: boolean
  onChange: (k: string) => void
}) {
  const { c, name } = useTheme()
  return (
    <View style={[segStyles.track, { backgroundColor: c.surface, borderColor: c.border }]}>
      {options.map((o) => {
        const on = o.key === value
        return (
          <Pressable
            key={o.key}
            disabled={disabled}
            onPress={() => onChange(o.key)}
            style={[
              segStyles.btn,
              disabled && { opacity: 0.45 },
              on && {
                backgroundColor: c.bg,
                shadowColor: name === 'dark' ? '#000' : '#1A1612',
                shadowOpacity: 0.06,
                shadowRadius: 2,
                shadowOffset: { width: 0, height: 1 },
              },
            ]}
          >
            <Sans weight="med" size={13} color={on ? c.ink : c.ink2}>
              {o.label}
            </Sans>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  sectionHead: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 6 },
  sectionBody: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  row: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowMain: { flex: 1, minWidth: 0 },
  autoSaveBadge: {
    alignSelf: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  modelMetric: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  miniButton: {
    flex: 1,
    minWidth: 104,
    minHeight: 42,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  statusBadge: {
    minWidth: 88,
    minHeight: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
})

const segStyles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 0,
  },
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
})
