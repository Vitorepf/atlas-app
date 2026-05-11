import { Pressable, View } from 'react-native'
import { Frau, Sans } from '../../../design/Type'
import { useTheme } from '../../../design/theme'
import { styles } from './AtlasAiSheet.styles'
import { SyncDiamond } from './AtlasAiSyncDiamond'

export function AtlasAiHeader({
  loading,
  onBack,
  onOpenThreads,
  onNewThread,
  onRefresh,
}: {
  loading: boolean
  onBack: () => void
  onOpenThreads: () => void
  onNewThread: () => void
  onRefresh: () => void
}) {
  const { c } = useTheme()

  return (
    <View style={[styles.header, { borderBottomColor: `${c.bronze}2E` }]}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.headerSlot, { opacity: pressed ? 0.55 : 1 }]}
      >
        <Sans size={15} color={c.ink}>
          ← Voltar
        </Sans>
      </Pressable>
      <Frau size={26} lineHeight={32} align="center" color={c.ink}>
        Atlas
      </Frau>
      <View style={[styles.headerSlot, styles.headerSlotRight, styles.headerActions]}>
        <Pressable
          onPress={onOpenThreads}
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerAction,
            { opacity: pressed ? 0.55 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="histórico de conversas"
        >
          <Sans size={24} lineHeight={28} color={c.ink2}>
            ≡
          </Sans>
        </Pressable>
        <Pressable
          onPress={onNewThread}
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerAction,
            { opacity: pressed ? 0.55 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="nova conversa"
        >
          <Sans size={28} lineHeight={30} color={c.ink2}>
            +
          </Sans>
        </Pressable>
        <Pressable
          onPress={onRefresh}
          disabled={loading}
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerAction,
            { opacity: pressed ? 0.55 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="recarregar"
        >
          <SyncDiamond pulsing={loading} />
        </Pressable>
      </View>
    </View>
  )
}
