import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import { Frau, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import { BronzeDiamond } from '../../console/BronzeDiamond'

export function SheetHeading({ title, subtitle }: { title: string; subtitle?: string | null }) {
  const { c } = useTheme()
  return (
    <View style={styles.sheetHeading}>
      <BronzeDiamond size={16} opacity={0.8} />
      <Frau size={24} lineHeight={30} color={c.ink} align="center" style={{ marginTop: 14 }}>
        {title}
      </Frau>
      {subtitle && (
        <Frau italic size={13} lineHeight={18} color={c.ink2} align="center" numberOfLines={2} style={{ marginTop: 6 }}>
          {subtitle}
        </Frau>
      )}
      <View style={[styles.headingRule, { backgroundColor: c.border }]} />
    </View>
  )
}

export function DataSection({ title, children }: { title: string; children: ReactNode }) {
  const { c } = useTheme()
  return (
    <View style={styles.dataSection}>
      <Frau italic size={14} lineHeight={19} color={c.ink} style={{ opacity: 0.58 }}>
        {title}
      </Frau>
      <View style={[styles.sectionRule, { backgroundColor: c.border }]} />
      <View style={styles.dataSectionBody}>{children}</View>
    </View>
  )
}

export function DataRow({ label, value }: { label: string; value: string }) {
  const { c } = useTheme()
  return (
    <View style={styles.dataRow}>
      <Sans weight="med" size={11} lineHeight={15} color={c.ink2} style={styles.dataLabel}>
        {label}
      </Sans>
      <Sans size={12} lineHeight={17} color={c.ink} style={styles.dataValue} numberOfLines={3}>
        {value}
      </Sans>
    </View>
  )
}

export function DataList({ label, items }: { label: string; items?: unknown[] }) {
  const { c } = useTheme()
  const values = formatUnknownList(items)
  return (
    <View style={styles.dataList}>
      <Sans weight="med" size={11} lineHeight={15} color={c.ink2}>
        {label}
      </Sans>
      {values.length === 0 ? (
        <Frau italic size={12} lineHeight={17} color={c.ink3}>
          vazio
        </Frau>
      ) : values.slice(0, 4).map((value, index) => (
        <Sans key={`${label}-${index}`} size={12} lineHeight={17} color={c.ink}>
          {value}
        </Sans>
      ))}
    </View>
  )
}

export function EmptyInline({ text }: { text: string }) {
  const { c } = useTheme()
  return (
    <Frau italic size={13} lineHeight={18} color={c.ink3}>
      {text}
    </Frau>
  )
}

export function StatusPill({ status }: { status: string }) {
  const { c } = useTheme()
  return (
    <View style={[styles.statusPill, { borderColor: statusColor(status, c) }]}>
      <Frau italic size={11} lineHeight={15} color={statusColor(status, c)}>
        {statusLabel(status)}
      </Frau>
    </View>
  )
}

function formatUnknownList(items?: unknown[]): string[] {
  if (!Array.isArray(items)) return []
  return items
    .map((item) => {
      if (typeof item === 'string') return item
      if (typeof item === 'number' || typeof item === 'boolean') return String(item)
      if (!item || typeof item !== 'object') return ''
      const record = item as Record<string, unknown>
      for (const key of ['title', 'label', 'text', 'summary', 'description', 'content', 'decision', 'next_step']) {
        const value = record[key]
        if (typeof value === 'string' && value.trim()) return value.trim()
      }

      return JSON.stringify(record)
    })
    .filter(Boolean)
    .map((item) => truncateForDisplay(item, 180))
}

function truncateForDisplay(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function statusLabel(status: string): string {
  if (status === 'queued') return 'fila'
  if (status === 'processing' || status === 'running') return 'rodando'
  if (status === 'succeeded' || status === 'online' || status === 'passed') return 'ok'
  if (status === 'failed' || status === 'offline') return 'falhou'
  if (status === 'needs_review') return 'revisar'
  if (status === 'blocked') return 'bloqueado'
  if (status === 'degraded') return 'degradado'
  return status
}

function statusColor(status: string, c: ReturnType<typeof useTheme>['c']): string {
  if (status === 'succeeded' || status === 'online' || status === 'passed') return c.moss
  if (status === 'queued' || status === 'processing' || status === 'running' || status === 'degraded' || status === 'needs_review') return c.bronze
  if (status === 'failed' || status === 'offline' || status === 'blocked') return c.recRed
  return c.ink3
}

const styles = StyleSheet.create({
  sheetHeading: {
    alignItems: 'center',
  },
  dataSection: {
    marginBottom: 28,
  },
  sectionRule: {
    height: StyleSheet.hairlineWidth,
    marginTop: 8,
    marginBottom: 12,
  },
  dataSectionBody: {
    gap: 9,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  dataLabel: {
    width: 72,
    paddingTop: 1,
  },
  dataValue: {
    flex: 1,
  },
  dataList: {
    gap: 5,
  },
  statusPill: {
    minHeight: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingRule: {
    width: 32,
    height: StyleSheet.hairlineWidth,
    alignSelf: 'center',
    marginTop: 16,
    marginBottom: 22,
  },
})
