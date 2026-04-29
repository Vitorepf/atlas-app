import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { Screen } from '../components/Screen'
import { PrimaryButton } from '../components/PrimaryButton'
import { Sparkle } from '../components/Sparkle'
import { EmptyWeekly } from '../components/EmptyWeekly'
import { Frau, Label, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { useAtlasStore, visibleCaptures } from '../lib/atlasStore'
import { domainLabel, type DomainKey } from '../lib/domains'

export default function ReviewScreen() {
  const c = usePalette()
  const captures = useAtlasStore((s) => s.captures)
  const queuedCaptures = useAtlasStore((s) => s.queuedCaptures)
  const sync = useAtlasStore((s) => s.sync)
  const syncing = useAtlasStore((s) => s.syncing)
  const range = useMemo(() => currentWeekRange(), [])

  const weeklyCaptures = useMemo(() => (
    visibleCaptures({ captures, queuedCaptures })
      .filter((capture) => {
        const capturedAt = new Date(capture.captured_at)
        return capturedAt >= range.start && capturedAt <= range.end
      })
  ), [captures, queuedCaptures, range.end, range.start])

  const rows = useMemo(() => weeklyRows(weeklyCaptures), [weeklyCaptures])

  return (
    <Screen>
      <View style={{ marginBottom: 28 }}>
        <Label>Weekly review</Label>
        <Frau size={42} lineHeight={44} letterSpacing={-1.05} color={c.ink} style={{ marginTop: 8 }}>
          Semana atual
        </Frau>
        <Mono size={12} color={c.ink2} letterSpacing={0.24} style={{ marginTop: 4 }}>
          {formatRange(range.start, range.end)}
        </Mono>
      </View>

      {weeklyCaptures.length === 0 ? (
        <EmptyWeekly />
      ) : (
        <>
          <View style={styles.dividerRow}>
            <View style={[styles.line, { backgroundColor: c.border }]} />
            <Sparkle size={14} />
            <View style={[styles.line, { backgroundColor: c.border }]} />
          </View>

          <Frau italic size={19} lineHeight={28} color={c.ink}>
            {weeklyCaptures.length === 1
              ? '1 captura registrada nesta semana.'
              : `${weeklyCaptures.length} capturas registradas nesta semana.`}
          </Frau>

          <Label style={{ marginTop: 30, marginBottom: 0 }}>Resumo real</Label>
          <View style={[styles.list, { borderTopColor: c.border }]}>
            {rows.map((row, i) => (
              <View
                key={row.label}
                style={[
                  styles.row,
                  i === rows.length - 1 ? null : { borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <Sans size={16} color={c.ink}>{row.label}</Sans>
                <Mono size={13.5} letterSpacing={0.27} color={c.ink2}>
                  {row.value}
                </Mono>
              </View>
            ))}
          </View>

          <View style={[styles.coordsBlock, { borderTopColor: c.border, borderBottomColor: c.border }]}>
            <Sparkle size={18} style={{ marginBottom: 8 }} />
            <Mono size={11} color={c.ink2} letterSpacing={0.66} align="center">
              Dados sincronizados do Atlas Server
            </Mono>
            <Frau italic size={15} color={c.ink2} align="center" style={{ marginTop: 6 }}>
              Última captura: {formatDateTime(weeklyCaptures[0]?.captured_at)}
            </Frau>
          </View>
        </>
      )}

      <View style={{ height: 28 }} />
      <PrimaryButton
        label={syncing ? 'Sincronizando…' : 'Atualizar dados'}
        onPress={() => {
          void sync()
        }}
      />
    </Screen>
  )
}

function weeklyRows(captures: ReturnType<typeof visibleCaptures>) {
  const audio = captures.filter((capture) => capture.kind === 'audio').length
  const text = captures.filter((capture) => capture.kind === 'text').length
  const photo = captures.filter((capture) => capture.kind === 'photo').length
  const domains = captures.reduce<Record<string, number>>((acc, capture) => {
    acc[capture.domain] = (acc[capture.domain] ?? 0) + 1
    return acc
  }, {})
  const topDomain = Object.entries(domains).sort((a, b) => b[1] - a[1])[0]

  return [
    { label: 'Áudios', value: String(audio) },
    { label: 'Textos', value: String(text) },
    { label: 'Imagens', value: String(photo) },
    { label: 'Domínio principal', value: topDomain ? `${domainLabel(topDomain[0] as DomainKey)} · ${topDomain[1]}` : 'Sem dado' },
  ]
}

function currentWeekRange(): { start: Date; end: Date } {
  const now = new Date()
  const day = now.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = new Date(now)
  start.setDate(now.getDate() + mondayOffset)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

function formatRange(start: Date, end: Date): string {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  return `${formatter.format(start)} — ${formatter.format(end)}`
}

function formatDateTime(iso?: string): string {
  if (!iso) return 'Sem dado'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

const styles = StyleSheet.create({
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 26 },
  line: { flex: 1, height: 1 },
  list: { marginTop: 22, borderTopWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  coordsBlock: {
    marginTop: 36,
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
})
