import { Pressable, StyleSheet, View } from 'react-native'
import { Frau, Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { AtlasPalette } from '../../design/tokens'
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
  const isCritical = item.severity === 'critical'
  const isWarning = item.severity === 'warning'
  const catColor = categoryColor(item, c)
  const origin = originLabel(item)

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: c.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        isCritical && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.recRedOxide, backgroundColor: c.bg },
        isWarning && !isCritical && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.bronze },
      ]}
    >
      <Pressable
        disabled={!onOpen}
        onPress={onOpen}
        style={({ pressed }) => [
          styles.body,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <View style={styles.metaRow}>
          <Mono size={12} lineHeight={16} letterSpacing={0.24} color={c.ink2}>
            {formatTime(item.created_at)}
          </Mono>
          <Sans size={11} lineHeight={14} color={c.ink3} style={styles.metaSep}>·</Sans>
          <Sans
            weight="med"
            size={10}
            lineHeight={14}
            letterSpacing={1.3}
            color={catColor}
            style={styles.uppercase}
          >
            {typeLabel(item)}
          </Sans>
          {origin ? (
            <>
              <Sans size={11} lineHeight={14} color={c.ink3} style={styles.metaSep}>·</Sans>
              <Frau italic size={12} lineHeight={15} color={c.ink3}>
                {origin}
              </Frau>
            </>
          ) : null}
          {isCritical ? (
            <View style={[styles.criticalDot, { backgroundColor: c.recRedOxide }]} />
          ) : null}
        </View>

        <Sans weight="med" size={15.5} lineHeight={22} color={c.ink} numberOfLines={2}>
          {item.title}
        </Sans>
        {summaryLabel(item) ? (
          <Frau
            italic
            size={13.5}
            lineHeight={20}
            letterSpacing={-0.06}
            color={c.ink2}
            numberOfLines={4}
            style={styles.summary}
          >
            {summaryLabel(item)}
          </Frau>
        ) : null}
      </Pressable>

      {actions.length > 0 ? (
        <View style={[styles.actionRow, { borderTopColor: c.border }]}>
          {actions.map((action, idx) => {
            const isLast = idx === actions.length - 1
            const isPrimary = action.style === 'primary' || idx === 0
            const isDanger = action.style === 'destructive'
            return (
              <Pressable
                key={action.id}
                disabled={busy}
                onPress={() => onAction(action.id)}
                style={({ pressed }) => [
                  styles.action,
                  !isLast && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: c.border },
                  {
                    backgroundColor: pressed ? c.bgRaised : 'transparent',
                    opacity: busy ? 0.35 : 1,
                  },
                ]}
              >
                <Frau
                  italic
                  size={14}
                  lineHeight={18}
                  color={isDanger ? c.recRedMuted : isPrimary ? c.prussian : c.ink2}
                  align="center"
                  numberOfLines={1}
                >
                  {action.label}
                </Frau>
              </Pressable>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}

function categoryColor(item: AtlasOperationalInboxItem, c: AtlasPalette): string {
  if (item.severity === 'critical' || item.severity === 'warning') return c.recRedOxide
  if (item.type === 'self_diagnostic') return c.moss
  if (item.category === 'atlas_ai_recommendation') return c.prussian
  if (item.type === 'job_result') return c.ink2
  if (item.type === 'insight') return c.prussian
  if (isTelemetryHealthInsight(item)) return c.moss
  return c.bronze
}

function originLabel(item: AtlasOperationalInboxItem): string | null {
  if (isTelemetryHealthInsight(item)) return 'self-diagnostic'
  if (item.type === 'self_diagnostic') return 'self-diagnostic'
  if (item.type === 'job_result') return 'harness'
  if (item.category === 'atlas_ai_recommendation') return 'jitai'
  if (item.type === 'insight') return 'curator'
  return null
}

function formatTime(value: string | null): string {
  if (!value) return '--:--'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '--:--'

  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function typeLabel(item: AtlasOperationalInboxItem): string {
  if (isTelemetryHealthInsight(item)) return 'saude atlas'
  if (item.category === 'atlas_ai_recommendation') return 'recomendacao'

  switch (item.type) {
    case 'self_diagnostic':
      return 'auto-diagnostico'
    case 'job_result':
      return 'job'
    case 'thread_update':
      return 'thread'
    default:
      return item.type.replace(/_/g, ' ')
  }
}

function summaryLabel(item: AtlasOperationalInboxItem): string | null {
  if (!isTelemetryHealthInsight(item)) return item.summary ?? item.body

  const score = scoreFromSummary(item.summary)
  const status = item.severity === 'critical' ? 'critica' : 'em atencao'
  return `Saude ${status} do Atlas${score == null ? '' : `, score ${score}/100`}. Toque para ver causas e proximos passos.`
}

function isTelemetryHealthInsight(item: AtlasOperationalInboxItem): boolean {
  const kind = typeof item.payload?.insight_kind === 'string' ? item.payload.insight_kind : null
  return item.type === 'insight'
    && (kind === 'atlas_ai_telemetry_health' || (item.dedupe_key?.includes('atlas-ai-telemetry-health') ?? false))
}

function scoreFromSummary(summary: string | null): number | null {
  const match = summary?.match(/score\s+(\d+(?:\.\d+)?)\/100/i)
  if (!match?.[1]) return null
  const score = Number(match[1])
  return Number.isFinite(score) ? score : null
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  body: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  metaSep: { opacity: 0.45 },
  uppercase: { textTransform: 'uppercase' },
  criticalDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginLeft: 'auto',
  },
  summary: { marginTop: 8 },
  actionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 4,
  },
  action: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
})
