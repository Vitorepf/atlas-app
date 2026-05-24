import { Pressable, StyleSheet, View } from 'react-native'
import { Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { AtlasPalette } from '../../design/tokens'
import type { AtlasOperationalInboxItem } from '../../lib/api/client'
import {
  buildOpCardSpec,
  buildOperationalBrief,
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
  const brief = buildOperationalBrief(item)
  const time = formatMetaTime(item.created_at)
  const metrics = brief.metrics.slice(0, 4)

  return (
    <View
      style={[
        styles.card,
        {
          borderBottomColor: 'rgba(233,238,242,0.06)',
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
        accessibilityLabel={brief.headline}
        style={({ pressed }) => [
          styles.body,
          { opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <OperationalCardMetaRow spec={spec} time={time} />

        <View style={styles.executiveBand}>
          <Mono size={9.5} lineHeight={12} color={toneColor(brief.tone, c)} letterSpacing={0.8} numberOfLines={1} style={styles.uppercase}>
            {brief.kicker}
          </Mono>
          <Mono size={9.5} lineHeight={12} color={c.ink3} letterSpacing={0.4} numberOfLines={1}>
            {brief.statusLabel}
          </Mono>
        </View>

        <Sans
          weight="med"
          size={16.5}
          lineHeight={22}
          letterSpacing={-0.05}
          color={c.ink}
          numberOfLines={2}
        >
          {brief.headline}
        </Sans>

        <Sans
          size={12.2}
          lineHeight={17}
          color={c.ink2}
          numberOfLines={3}
          style={styles.summary}
        >
          {brief.summary}
        </Sans>

        {metrics.length > 0 ? (
          <View style={styles.metricStrip}>
            {metrics.map((metric) => (
              <View
                key={`${metric.label}-${metric.value}`}
                style={[
                  styles.metricPill,
                  {
                    borderColor: toneColor(metric.tone, c),
                    backgroundColor: toneBackground(metric.tone, c),
                  },
                ]}
              >
                <Mono size={9.5} lineHeight={12} color={c.ink3} letterSpacing={0.2} numberOfLines={1} style={styles.metricLabel}>
                  {metric.label}
                </Mono>
                <Sans weight="sb" size={12.5} lineHeight={16} color={toneColor(metric.tone, c)} numberOfLines={1}>
                  {metric.value}
                </Sans>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.nextStepBox, { borderColor: c.border, backgroundColor: c.bg }]}>
          <Mono size={9.2} lineHeight={12} color={c.ink3} letterSpacing={0.7} style={styles.uppercase}>
            Próxima ação
          </Mono>
          <Sans weight="sb" size={12.2} lineHeight={17} color={c.prussian} numberOfLines={2}>
            {brief.nextStep}
          </Sans>
        </View>
      </Pressable>

      <OperationalCardActions busy={busy} onAction={onAction} spec={spec} />
    </View>
  )
}

function toneColor(tone: string, c: AtlasPalette): string {
  switch (tone) {
    case 'critical':
      return c.recRed
    case 'warning':
      return c.bronze
    case 'ok':
      return c.moss
    default:
      return c.prussian
  }
}

function toneBackground(tone: string, c: AtlasPalette): string {
  switch (tone) {
    case 'critical':
      return `${c.recRed}10`
    case 'warning':
      return `${c.bronze}12`
    case 'ok':
      return `${c.moss}10`
    default:
      return c.surface
  }
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
  executiveBand: {
    marginTop: 10,
    marginBottom: 7,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  uppercase: {
    textTransform: 'uppercase',
  },
  metricStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 10,
  },
  metricPill: {
    maxWidth: '100%',
    flexGrow: 1,
    minWidth: 112,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  metricLabel: {
    textTransform: 'uppercase',
  },
  nextStepBox: {
    marginTop: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 3,
  },
})
