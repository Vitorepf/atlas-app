import { memo, useCallback } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { Mono, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import type { useOperationalInbox } from '../../lib/useOperationalInbox'
import type { AtlasOperationalInboxItem } from '../../lib/api/client'
import { OperationalInboxCard } from './OperationalInboxCard'
import {
  OperationalEmptyState,
  OperationalFilterStrip,
  OperationalStatusPanel,
} from './OperationalInboxSections'
import { styles } from './inboxScreenStyles'

interface Props {
  criticalCount: number
  inbox: ReturnType<typeof useOperationalInbox>
  onOpenDetail: (id: string) => void
  onPair: () => void
  total: number
}

export function InboxOperationalPane({
  criticalCount,
  inbox,
  onOpenDetail,
  onPair,
  total,
}: Props) {
  const c = usePalette()
  const retry = useCallback(() => {
    void inbox.refresh()
  }, [inbox.refresh])
  const loadMore = useCallback(() => {
    void inbox.loadMore()
  }, [inbox.loadMore])

  return (
    <Animated.View
      entering={FadeIn.duration(280)}
      exiting={FadeOut.duration(180)}
    >
      <OperationalStatusPanel
        total={total}
        critical={criticalCount}
        mobilePaired={inbox.mobilePaired}
        error={inbox.error}
        onPair={onPair}
        onRetry={retry}
      />

      {inbox.showList ? (
        <>
          <CriticalReviewPanel
            busyId={inbox.busyId}
            criticalReview={inbox.criticalReview}
            onDiscuss={inbox.discussCriticalItem}
            onOpenDetail={onOpenDetail}
            onReviewAction={inbox.runCriticalReviewAction}
          />
          <OperationalFilterStrip
            active={inbox.filter}
            counts={inbox.counts}
            onChange={inbox.setFilter}
          />
          <View style={styles.list}>
            {inbox.items.length === 0 ? (
              <OperationalEmptyState
                title={inbox.error ? 'Sem dados operacionais' : 'Operacional limpo'}
                body={inbox.error
                  ? 'A conexão falhou antes de carregar itens. Tente novamente para atualizar a fila.'
                  : 'Nenhuma aprovação, recomendação ou alerta ativo agora.'}
              />
            ) : inbox.filteredItems.length > 0 ? (
              inbox.filteredItems.map((item) => (
                <OperationalCardRow
                  key={item.id}
                  item={item}
                  busy={inbox.busyId === item.id}
                  onOpenDetail={onOpenDetail}
                  runAction={inbox.runAction}
                />
              ))
            ) : (
              <OperationalEmptyState
                title="Filtro vazio"
                body="Nenhum item operacional ativo neste filtro."
              />
            )}
            {inbox.cursor ? (
              <Pressable
                disabled={inbox.loadingMore}
                onPress={loadMore}
                style={({ pressed }) => [
                  styles.loadMoreOperational,
                  {
                    borderColor: c.border,
                    backgroundColor: pressed ? c.premium : 'transparent',
                    opacity: inbox.loadingMore ? 0.55 : 1,
                  },
                ]}
              >
                <Sans weight="sb" size={12.5} lineHeight={17} color={c.prussian} align="center">
                  {inbox.loadingMore ? 'Carregando...' : 'Carregar mais'}
                </Sans>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}
    </Animated.View>
  )
}

function CriticalReviewPanel({
  busyId,
  criticalReview,
  onDiscuss,
  onOpenDetail,
  onReviewAction,
}: {
  busyId: string | null
  criticalReview: ReturnType<typeof useOperationalInbox>['criticalReview']
  onDiscuss: (id: string) => void
  onOpenDetail: (id: string) => void
  onReviewAction: (id: string, actionId: 'mark_read' | 'snooze' | 'dismiss') => void
}) {
  const c = usePalette()
  const summary = criticalReview?.review_summary
  if (!criticalReview || criticalReview.active_critical_count <= 0 || !summary) return null
  const firstItem = criticalReview.items[0] ?? null

  return (
    <View style={[styles.operationalCriticalReview, { borderColor: c.recRed, backgroundColor: c.surface }]}>
      <View style={styles.operationalCriticalReviewHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Sans weight="sb" size={13.5} lineHeight={18} color={c.ink}>
            Revisão crítica pendente
          </Sans>
          <Sans size={11.5} lineHeight={16} color={c.ink2}>
            {summary.unread_count} não lidos · {summary.health_signal_count} saúde · {summary.performance_report_count} performance · {summary.cost_visibility_recovered_count} custo recalculado
          </Sans>
        </View>
        <View style={[styles.operationalSummaryBadge, { borderColor: c.recRed, backgroundColor: c.bg }]}>
          <Mono size={12} lineHeight={15} letterSpacing={0.1} color={c.recRed}>
            {criticalReview.active_critical_count}
          </Mono>
        </View>
      </View>

      <View style={styles.operationalCriticalReviewMetrics}>
        <CriticalReviewMetric label="Decisão humana" value={String(summary.still_requires_operator_decision_count)} tone={c.recRed} />
        <CriticalReviewMetric label="Lidos" value={String(summary.read_count)} tone={c.ink2} />
        <CriticalReviewMetric label="Outros" value={String(summary.other_kind_count)} tone={c.ink2} />
      </View>

      {firstItem ? (
        <Pressable
          disabled={busyId === firstItem.id}
          onPress={() => onDiscuss(firstItem.id)}
          style={({ pressed }) => [
            styles.operationalCriticalReviewAction,
            {
              borderColor: c.recRed,
              backgroundColor: pressed ? c.premium : c.bg,
              opacity: busyId === firstItem.id ? 0.55 : 1,
            },
          ]}
        >
          <Sans weight="sb" size={12.2} lineHeight={16} color={c.recRed}>
            {busyId === firstItem.id ? 'Abrindo discussão...' : 'Discutir prioridade com Atlas'}
          </Sans>
          <Mono size={9.5} lineHeight={12} letterSpacing={0.1} color={c.ink2} numberOfLines={1}>
            {firstItem.headline}
          </Mono>
        </Pressable>
      ) : null}

      {criticalReview.items.map((item) => (
        <View key={item.id} style={[styles.operationalCriticalReviewItem, { borderColor: c.border, backgroundColor: c.bg }]}>
          <Pressable onPress={() => onOpenDetail(item.id)} style={styles.operationalCriticalReviewItemBody}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Sans weight="sb" size={12.2} lineHeight={16} color={c.ink} numberOfLines={1}>
                {item.headline}
              </Sans>
              <Sans size={10.8} lineHeight={15} color={c.ink2} numberOfLines={2}>
                {item.operator_next_step}
              </Sans>
              {item.primary_metric ? (
                <Mono size={9.5} lineHeight={12} letterSpacing={0.1} color={c.prussian} numberOfLines={1}>
                  {item.primary_metric.label}: {item.primary_metric.value}
                </Mono>
              ) : item.decision_options?.[0] ? (
                <Mono size={9.5} lineHeight={12} letterSpacing={0.1} color={c.prussian} numberOfLines={1}>
                  {item.decision_options[0].label} · {item.decision_options[0].requires_evidence ? 'exige evidência' : 'sem evidência obrigatória'}
                </Mono>
              ) : null}
            </View>
            <Mono size={9.8} lineHeight={12} letterSpacing={0.1} color={item.status === 'unread' ? c.recRed : c.ink2}>
              {item.review_kind}
            </Mono>
          </Pressable>
          <View style={styles.operationalCriticalReviewActions}>
            <CriticalReviewActionButton
              disabled={busyId === item.id}
              label="Revisado"
              tone={c.prussian}
              onPress={() => onReviewAction(item.id, 'mark_read')}
            />
            <CriticalReviewActionButton
              disabled={busyId === item.id}
              label="Adiar 7d"
              tone={c.bronze}
              onPress={() => onReviewAction(item.id, 'snooze')}
            />
            <CriticalReviewActionButton
              disabled={busyId === item.id}
              label="Descartar"
              tone={c.recRed}
              onPress={() => onReviewAction(item.id, 'dismiss')}
            />
          </View>
          {busyId === item.id ? (
            <Mono size={9.5} lineHeight={12} letterSpacing={0.1} color={c.ink2}>
              aplicando revisão...
            </Mono>
          ) : null}
        </View>
      ))}
    </View>
  )
}

function CriticalReviewActionButton({
  disabled,
  label,
  onPress,
  tone,
}: {
  disabled: boolean
  label: string
  onPress: () => void
  tone: string
}) {
  const c = usePalette()

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.operationalCriticalReviewInlineAction,
        {
          borderColor: tone,
          backgroundColor: pressed ? c.premium : c.surface,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <Mono size={9.5} lineHeight={12} letterSpacing={0.1} color={tone} numberOfLines={1}>
        {label}
      </Mono>
    </Pressable>
  )
}

function CriticalReviewMetric({
  label,
  tone,
  value,
}: {
  label: string
  tone: string
  value: string
}) {
  const c = usePalette()

  return (
    <View style={[styles.operationalCriticalReviewMetric, { borderColor: c.border, backgroundColor: c.bg }]}>
      <Mono size={9.5} lineHeight={12} letterSpacing={0.1} color={c.ink2}>
        {label}
      </Mono>
      <Sans weight="sb" size={14} lineHeight={18} color={tone}>
        {value}
      </Sans>
    </View>
  )
}

const OperationalCardRow = memo(function OperationalCardRow({
  busy,
  item,
  onOpenDetail,
  runAction,
}: {
  busy: boolean
  item: AtlasOperationalInboxItem
  onOpenDetail: (id: string) => void
  runAction: (item: AtlasOperationalInboxItem, actionId: string) => Promise<void>
}) {
  const open = useCallback(() => {
    onOpenDetail(item.id)
  }, [item.id, onOpenDetail])
  const action = useCallback((actionId: string) => {
    void runAction(item, actionId)
  }, [item, runAction])

  return (
    <OperationalInboxCard
      item={item}
      busy={busy}
      onOpen={open}
      onAction={action}
    />
  )
})
