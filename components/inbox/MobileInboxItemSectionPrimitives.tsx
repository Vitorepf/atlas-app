import { type ReactNode } from 'react'
import { ActivityIndicator, Pressable, View } from 'react-native'
import { Frau, Label, Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { AtlasInboxAction } from '../../lib/api/client'
import { compactJson } from '../../lib/mobileInboxItemModels'
import { styles } from './mobileInboxItemStyles'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const c = usePalette()
  return (
    <View style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface }]}>
      <Label>{title}</Label>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

export function TextBlock({ label, value }: { label: string; value: string }) {
  const c = usePalette()
  return (
    <View style={styles.textBlock}>
      <Label>{label}</Label>
      <Sans size={13.5} lineHeight={20} color={c.ink} style={styles.preWrap}>
        {value}
      </Sans>
    </View>
  )
}

export function EmptyText({ children }: { children: ReactNode }) {
  const c = usePalette()
  return (
    <Sans size={13} lineHeight={18} color={c.ink2}>
      {children}
    </Sans>
  )
}

export function DetailLine({ label, value, compact = false }: { label: string; value: string | null; compact?: boolean }) {
  const c = usePalette()
  if (!value) return null

  return (
    <View style={[styles.detailLine, compact ? styles.detailLineCompact : null]}>
      <Mono size={10.5} lineHeight={14} color={c.ink3} letterSpacing={0.2} style={styles.detailLabel}>
        {label}
      </Mono>
      <Sans size={compact ? 12.5 : 13.5} lineHeight={compact ? 18 : 20} color={c.ink}>
        {value}
      </Sans>
    </View>
  )
}

export function RefRow({ value }: { value: unknown }) {
  const c = usePalette()
  return (
    <View style={[styles.refRow, { borderColor: c.border, backgroundColor: c.premium }]}>
      <Mono size={10.5} lineHeight={15} color={c.ink2}>
        {compactJson(value, 260)}
      </Mono>
    </View>
  )
}

export function DetailActionButton({
  action,
  busy,
  disabled,
  confirming,
  onPress,
}: {
  action: AtlasInboxAction
  busy: boolean
  disabled: boolean
  confirming: boolean
  onPress: () => void
}) {
  const c = usePalette()
  const destructive = action.style === 'destructive'
  const primary = action.style === 'primary'
  const color = destructive ? c.recRed : primary ? c.onInk : c.prussian
  const background = primary ? c.ink : 'transparent'
  const border = destructive ? c.recRed : primary ? c.ink : c.prussian

  return (
    <Pressable
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.detailAction,
        {
          borderColor: border,
          backgroundColor: pressed && !primary ? c.premium : background,
          opacity: disabled ? 0.35 : pressed ? 0.88 : 1,
        },
      ]}
    >
      <Sans weight="sb" size={13} lineHeight={17} color={color} align="center" numberOfLines={2}>
        {busy ? 'Aplicando...' : confirming ? `Confirmar ${action.label}` : action.label}
      </Sans>
    </Pressable>
  )
}
