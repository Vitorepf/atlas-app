import { useCallback } from 'react'
import { ActivityIndicator, Pressable, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '../Screen'
import { Frau, Label, Sans } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { useShell } from '../AtlasShell'
import { useOverlays } from '../../lib/overlays'
import { useMobileInboxItem } from '../../lib/useMobileInboxItem'
import { styles } from './mobileInboxItemStyles'
import {
  ActionPanel,
  ContextPanel,
  HumanPresentationPanel,
  ItemMeta,
  MetadataPanel,
  SnoozePanel,
  SummaryPanel,
  TypeDetails,
} from './MobileInboxItemSections'
import {
  TelemetryHealthBreakdownPanel,
  TelemetryHealthMetricsPanel,
  TelemetryHealthPanel,
} from './MobileInboxItemTelemetrySections'
import { isTelemetryHealthInsight } from '../../lib/mobileInboxTelemetryModels'

// =============================================================================
// MobileInboxItemScreen · rota fullscreen pra deep-links / push notifications
// =============================================================================
//
// Coexiste com `OperationalDetailSheet` (`components/sheets/OperationalDetailSheet.tsx`)
// que é o sheet modal canon usado quando user toca card inline no Inbox.
//
// Quando ENTROU pelo Inbox:    → abre OperationalDetailSheet (sheet modal)
// Quando ENTROU por deep-link: → abre essa rota (fullscreen, UI rica)
//
// A rota mantém fetch/ações em `useMobileInboxItem` e render especializado
// nos sections locais, para continuar compatível com deep-links/push.
// =============================================================================

export default function MobileInboxItemScreen() {
  const c = usePalette()
  const router = useRouter()
  const { showToast } = useShell()
  const openAtlasAi = useOverlays((s) => s.openAtlasAi)
  const params = useLocalSearchParams<{ inboxId?: string; inboxAction?: string }>()
  const inboxId = typeof params.inboxId === 'string' ? params.inboxId : null
  const initialAction = typeof params.inboxAction === 'string' ? params.inboxAction : null
  const close = useCallback(() => router.back(), [router])
  const {
    actions,
    busyActionId,
    confirmingActionId,
    error,
    item,
    load,
    loading,
    requestAction,
    runSnooze,
    setSnoozeAction,
    snoozeAction,
  } = useMobileInboxItem({
    inboxId,
    initialAction,
    onClose: close,
    openAtlasAi,
    showToast,
  })

  return (
    <Screen topExtra={18}>
      <View style={styles.topBar}>
        <Pressable
          onPress={close}
          hitSlop={12}
          style={({ pressed }) => [styles.roundButton, { backgroundColor: pressed ? c.surface : c.premium, borderColor: c.border }]}
        >
          <Sans size={26} lineHeight={28} color={c.ink}>‹</Sans>
        </Pressable>
        <Pressable
          onPress={() => void load()}
          hitSlop={10}
          style={({ pressed }) => [styles.refreshButton, { borderColor: c.border, backgroundColor: pressed ? c.premium : c.surface }]}
        >
          <Sans weight="med" size={12} lineHeight={16} color={c.prussian}>
            Atualizar
          </Sans>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Label>Inbox operacional</Label>
        <Frau size={36} lineHeight={39} color={c.ink} numberOfLines={3} style={{ marginTop: 7 }}>
          {item?.presentation?.headline ?? item?.title ?? 'Item do Atlas'}
        </Frau>
        {item ? <ItemMeta item={item} /> : null}
      </View>

      {loading ? (
        <View style={[styles.panel, styles.loadingPanel, { borderColor: c.border, backgroundColor: c.surface }]}>
          <ActivityIndicator color={c.prussian} />
          <Sans size={13} lineHeight={18} color={c.ink2} align="center">
            Carregando item operacional...
          </Sans>
        </View>
      ) : item ? (
        <View style={styles.stack}>
          {isTelemetryHealthInsight(item) ? (
            <>
              <HumanPresentationPanel item={item} />
              <TelemetryHealthPanel item={item} />
              <TelemetryHealthMetricsPanel item={item} />
              <TelemetryHealthBreakdownPanel item={item} />
            </>
          ) : (
            <>
              {item.presentation ? <HumanPresentationPanel item={item} /> : <SummaryPanel item={item} />}
              <TypeDetails item={item} />
              <ContextPanel item={item} />
            </>
          )}
          <ActionPanel
            actions={actions}
            busyActionId={busyActionId}
            confirmingActionId={confirmingActionId}
            onAction={(action) => void requestAction(action)}
          />
          {snoozeAction ? (
            <SnoozePanel
              busy={busyActionId === 'snooze'}
              onCancel={() => setSnoozeAction(null)}
              onSnooze={(days, reason) => void runSnooze(days, reason)}
            />
          ) : null}
          <MetadataPanel item={item} />
        </View>
      ) : null}

      {error ? (
        <View style={[styles.errorPanel, { borderColor: c.recRed, backgroundColor: c.surface }]}>
          <Sans weight="med" size={13} lineHeight={18} color={c.recRed}>
            {error}
          </Sans>
        </View>
      ) : null}
    </Screen>
  )
}
