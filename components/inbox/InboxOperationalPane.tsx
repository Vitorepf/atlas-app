import { memo, useCallback } from 'react'
import { Pressable, View } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import { Sans } from '../../design/Type'
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
