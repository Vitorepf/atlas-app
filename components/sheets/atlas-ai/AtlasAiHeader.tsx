/**
 * Atlas AI Header · canon premium polish · Slice 6o.
 *
 * Antes: title Frau regular 26px, action labels "≡"/"+" unicode bare.
 * Depois: title Frau italic manuscript signature, action icons SVG canon
 * (chevron back, hamburger lines, plus stroke), haptic Soft no press.
 *
 * Mantém integração SyncDiamond canon · borda inferior bronze hairline.
 */
import { Pressable, StyleSheet, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import Svg, { Line, Path } from 'react-native-svg'
import { Frau } from '../../../design/Type'
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

  const haptic = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {})
  }
  const handleBack = () => { haptic(); onBack() }
  const handleOpenThreads = () => { haptic(); onOpenThreads() }
  const handleNewThread = () => { haptic(); onNewThread() }
  const handleRefresh = () => {
    if (loading) return
    haptic()
    onRefresh()
  }

  return (
    <View style={[styles.header, { borderBottomColor: `${c.bronze}2E` }]}>
      <Pressable
        onPress={handleBack}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="voltar"
        style={({ pressed }) => [styles.headerSlot, localStyles.backSlot, { opacity: pressed ? 0.55 : 1 }]}
      >
        <ChevronBackIcon color={c.ink} />
      </Pressable>

      {/* Title canon manuscript · Frau italic 26px (era regular).
          Italic dá ar editorial Don Corleone Smythson · não vibe SaaS. */}
      <Frau italic size={26} lineHeight={32} align="center" color={c.ink}>
        Atlas
      </Frau>

      <View style={[styles.headerSlot, styles.headerSlotRight, styles.headerActions]}>
        <Pressable
          onPress={handleOpenThreads}
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerAction,
            localStyles.iconBtn,
            { opacity: pressed ? 0.55 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="histórico de conversas"
        >
          <HamburgerIcon color={c.ink2} />
        </Pressable>
        <Pressable
          onPress={handleNewThread}
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerAction,
            localStyles.iconBtn,
            { opacity: pressed ? 0.55 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="nova conversa"
        >
          <PlusIcon color={c.ink2} />
        </Pressable>
        <Pressable
          onPress={handleRefresh}
          disabled={loading}
          hitSlop={10}
          style={({ pressed }) => [
            styles.headerAction,
            localStyles.iconBtn,
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

function ChevronBackIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22}>
      <Path
        d="M13.5 5l-7 6 7 6"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  )
}

function HamburgerIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22}>
      <Line x1={4} y1={7} x2={18} y2={7} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={4} y1={11} x2={18} y2={11} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={4} y1={15} x2={18} y2={15} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  )
}

function PlusIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22}>
      <Line x1={11} y1={4} x2={11} y2={18} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Line x1={4} y1={11} x2={18} y2={11} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  )
}

const localStyles = StyleSheet.create({
  backSlot: {
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
