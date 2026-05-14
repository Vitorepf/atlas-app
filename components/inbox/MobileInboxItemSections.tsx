import { Pressable, View } from 'react-native'
import { Frau, Label, Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { AtlasInboxAction, AtlasOperationalInboxItem } from '../../lib/api/client'
import {
  REF_GROUPS,
  SNOOZE_CHOICES,
  dateLabel,
  dateTimeLabel,
  detailTitle,
  detailsForItem,
  detailsForRecommendation,
  detailsForReport,
  durationText,
  humanize,
  payloadText,
  severityColor,
  type DetailRow,
  textValue,
  typeLabel,
} from '../../lib/mobileInboxItemModels'
import { isTelemetryHealthInsight } from '../../lib/mobileInboxTelemetryModels'
import { styles } from './mobileInboxItemStyles'
import { DetailActionButton, DetailLine, EmptyText, RefRow, Section, TextBlock } from './MobileInboxItemSectionPrimitives'

export function ItemMeta({ item }: { item: AtlasOperationalInboxItem }) {
  const c = usePalette()
  const confidence = item.confidence_score == null ? null : `${Math.round(item.confidence_score * 100)}% confianca`
  const parts = [
    typeLabel(item.type),
    item.category,
    item.status,
    confidence,
    dateLabel(item.created_at),
  ].filter((part): part is string => typeof part === 'string' && part.length > 0)

  return (
    <View style={styles.metaWrap}>
      {parts.map((part, index) => (
        <View key={`${part}-${index}`} style={[styles.metaPill, { borderColor: c.border, backgroundColor: c.surface }]}>
          <Mono size={10.5} lineHeight={14} color={index === 0 ? c.prussian : c.ink2} letterSpacing={0.2} numberOfLines={1}>
            {part}
          </Mono>
        </View>
      ))}
      <View style={[styles.metaPill, { borderColor: c.border, backgroundColor: severityColor(item.severity, c, true) }]}>
        <Mono size={10.5} lineHeight={14} color={severityColor(item.severity, c)} letterSpacing={0.2} numberOfLines={1}>
          {item.severity}
        </Mono>
      </View>
    </View>
  )
}

export function SummaryPanel({ item }: { item: AtlasOperationalInboxItem }) {
  const summary = textValue(item.summary)
  const body = textValue(item.body)
  return (
    <Section title="Mensagem">
      {summary ? <TextBlock label="Resumo" value={summary} /> : null}
      {body && body !== summary ? <TextBlock label="Detalhe" value={body} /> : null}
      {!summary && !body ? <EmptyText>Nenhuma mensagem detalhada registrada.</EmptyText> : null}
    </Section>
  )
}

export function HumanPresentationPanel({ item }: { item: AtlasOperationalInboxItem }) {
  const c = usePalette()
  const presentation = item.presentation
  if (!presentation) return null

  const metrics = presentation.metrics ?? []
  const actions = presentation.recommended_actions ?? []

  return (
    <Section title="Resumo">
      <View style={[styles.diagnosticHeader, { borderColor: c.border, backgroundColor: c.premium }]}>
        <View style={styles.diagnosticCopy}>
          <Sans weight="sb" size={15} lineHeight={20} color={c.ink}>
            {presentation.headline}
          </Sans>
          <Sans size={13} lineHeight={19} color={c.ink2}>
            {presentation.plain_summary}
          </Sans>
        </View>
        <View style={[styles.scoreBadge, { borderColor: severityColor(item.severity, c, false) }]}>
          <Mono size={17} lineHeight={21} color={severityColor(item.severity, c)} align="center" numberOfLines={2}>
            {presentation.primary_metric.value}
          </Mono>
          <Sans size={10.5} lineHeight={13} color={c.ink3} align="center" numberOfLines={2}>
            {presentation.primary_metric.label}
          </Sans>
        </View>
      </View>

      {metrics.length > 0 ? (
        <View style={styles.explainGrid}>
          {metrics.slice(0, 8).map((metric) => (
            <View key={`${metric.label}-${metric.value}`} style={[styles.explainTile, { borderColor: c.border, backgroundColor: c.surface }]}>
              <Mono size={10.5} lineHeight={14} color={c.ink3} letterSpacing={0.2} style={styles.detailLabel} numberOfLines={1}>
                {metric.label}
              </Mono>
              <Sans weight="sb" size={13.5} lineHeight={18} color={metric.tone === 'critical' ? c.recRed : metric.tone === 'warning' ? c.bronze : c.ink} numberOfLines={2}>
                {metric.value}
              </Sans>
            </View>
          ))}
        </View>
      ) : null}

      <TextBlock label="Por que importa" value={presentation.why_this_matters} />
      <TextBlock label="Proximo passo" value={presentation.operator_next_step} />

      {actions.length > 0 ? (
        <View style={styles.actionAdviceList}>
          <Label>Acoes recomendadas</Label>
          {actions.slice(0, 6).map((action, index) => (
            <View key={`${action}-${index}`} style={styles.adviceRow}>
              <Mono size={11} lineHeight={16} color={c.prussian}>
                {String(index + 1).padStart(2, '0')}
              </Mono>
              <Sans size={13} lineHeight={19} color={c.ink}>
                {action}
              </Sans>
            </View>
          ))}
        </View>
      ) : null}
    </Section>
  )
}

export function TypeDetails({ item }: { item: AtlasOperationalInboxItem }) {
  const rows = detailsForItem(item)
  if (rows.length === 0) return null

  return (
    <Section title={detailTitle(item.type)}>
      <View style={styles.rows}>
        {rows.map((row) => (
          <DetailLine key={row.label} label={row.label} value={row.value} />
        ))}
      </View>
    </Section>
  )
}

export function ContextPanel({ item }: { item: AtlasOperationalInboxItem }) {
  const bundle = item.context_bundle
  if (!bundle) return null

  const refGroups = REF_GROUPS
    .map((group) => ({ ...group, refs: Array.isArray(bundle[group.key]) ? bundle[group.key] : [] }))
    .filter((group) => group.refs.length > 0)

  return (
    <Section title="Contexto">
      <TextBlock label={bundle.purpose || 'bundle'} value={[bundle.title, bundle.summary].filter(Boolean).join('\n')} />
      {refGroups.length > 0 ? (
        <View style={styles.refGroups}>
          {refGroups.map((group) => (
            <View key={group.key} style={styles.refGroup}>
              <Label>{group.label}</Label>
              <View style={styles.refs}>
                {group.refs.slice(0, 6).map((ref, index) => (
                  <RefRow key={`${group.key}-${index}`} value={ref} />
                ))}
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Section>
  )
}

export function ActionPanel({
  actions,
  busyActionId,
  confirmingActionId,
  onAction,
}: {
  actions: AtlasInboxAction[]
  busyActionId: string | null
  confirmingActionId: string | null
  onAction: (action: AtlasInboxAction) => void
}) {
  if (actions.length === 0) return null

  return (
    <Section title="Acoes">
      <View style={styles.actionStack}>
        {actions.map((action) => (
          <DetailActionButton
            key={action.id}
            action={action}
            busy={busyActionId === action.id}
            disabled={busyActionId !== null && busyActionId !== action.id}
            confirming={confirmingActionId === action.id}
            onPress={() => onAction(action)}
          />
        ))}
      </View>
    </Section>
  )
}

export function SnoozePanel({
  busy,
  onCancel,
  onSnooze,
}: {
  busy: boolean
  onCancel: () => void
  onSnooze: (days: number, reason: string) => void
}) {
  const c = usePalette()
  return (
    <Section title="Adiar">
      <View style={styles.snoozeRow}>
        {SNOOZE_CHOICES.map((choice) => (
          <Pressable
            key={choice.key}
            disabled={busy}
            onPress={() => onSnooze(choice.days, choice.reason)}
            style={({ pressed }) => [
              styles.snoozeChip,
              {
                borderColor: c.border,
                backgroundColor: pressed ? c.premium : 'transparent',
                opacity: busy ? 0.45 : 1,
              },
            ]}
          >
            <Sans weight="sb" size={12} lineHeight={16} color={c.prussian}>
              {choice.label}
            </Sans>
          </Pressable>
        ))}
        <Pressable
          disabled={busy}
          onPress={onCancel}
          style={({ pressed }) => [styles.snoozeCancel, { opacity: pressed || busy ? 0.5 : 1 }]}
        >
          <Sans weight="med" size={12} lineHeight={16} color={c.ink2}>
            Cancelar
          </Sans>
        </Pressable>
      </View>
    </Section>
  )
}

export function MetadataPanel({ item }: { item: AtlasOperationalInboxItem }) {
  const technical = !isTelemetryHealthInsight(item)
  const rows: DetailRow[] = [
    { label: 'ID', value: item.id },
    { label: 'Criado em', value: dateTimeLabel(item.created_at) },
    { label: 'Fonte', value: technical ? [item.source_type, item.source_id].filter(Boolean).join(' / ') || null : null },
    { label: 'Iniciador', value: item.initiator },
    { label: 'Dedupe', value: technical ? item.dedupe_key : null },
    { label: 'Expira em', value: dateTimeLabel(item.expires_at) },
    { label: 'Lido em', value: dateTimeLabel(item.read_at) },
    { label: 'Resolvido em', value: dateTimeLabel(item.resolved_at) },
    { label: 'Prioridade', value: String(item.priority_score) },
  ].filter((row) => row.value !== null && row.value !== '')

  if (rows.length === 0) return null

  return (
    <Section title="Metadados">
      <View style={styles.rows}>
        {rows.map((row) => <DetailLine key={row.label} label={row.label} value={row.value} compact />)}
      </View>
    </Section>
  )
}
