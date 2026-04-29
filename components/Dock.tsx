import { Pressable, StyleSheet, View } from 'react-native'
import { useEffect, useState, type ReactNode } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useRouter, usePathname } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Sans } from '../design/Type'
import { useTheme } from '../design/theme'
import { useOverlays } from '../lib/overlays'

const FOCUSED_ROUTES = new Set(['/capture', '/detail', '/decision'])

interface DockItem {
  key: string
  href: '/' | '/inbox' | '/ritual' | '/review'
  label: string
  icon: 'home' | 'inbox' | 'review' | 'ritual'
}

const ITEMS: DockItem[] = [
  { key: 'home',   href: '/',       label: 'Home',   icon: 'home' },
  { key: 'inbox',  href: '/inbox',  label: 'Inbox',  icon: 'inbox' },
  { key: 'review', href: '/review', label: 'Review', icon: 'review' },
  { key: 'ritual', href: '/ritual', label: 'Ritual', icon: 'ritual' },
]

export function Dock() {
  const { c, name } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const openAtlasAi = useOverlays((s) => s.openAtlasAi)
  const focused = FOCUSED_ROUTES.has(pathname)
  const [quickOpen, setQuickOpen] = useState(false)

  const opacity = useSharedValue(focused ? 0 : 1)
  const ty = useSharedValue(focused ? 20 : 0)

  useEffect(() => {
    if (focused) {
      opacity.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) })
      ty.value = withTiming(20, { duration: 280, easing: Easing.out(Easing.cubic) })
    } else {
      opacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) })
      ty.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) })
    }
  }, [focused, opacity, ty])

  useEffect(() => {
    setQuickOpen(false)
  }, [focused, pathname])

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }))

  const wrapStyle = [styles.wrap, { bottom: 8 + insets.bottom }, animStyle]

  if (focused) {
    return (
      <Animated.View
        pointerEvents="none"
        style={wrapStyle}
      />
    )
  }

  return (
    <Animated.View pointerEvents="box-none" style={wrapStyle}>
      <QuickActionMenu
        visible={quickOpen}
        onRecord={() => {
          setQuickOpen(false)
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          router.push('/capture')
        }}
        onAtlas={() => {
          setQuickOpen(false)
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          openAtlasAi()
        }}
      />
      <View
        style={[
          styles.dock,
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            shadowColor: name === 'dark' ? '#000' : '#1C1916',
            shadowOpacity: name === 'dark' ? 0.5 : 0.18,
          },
        ]}
      >
        {ITEMS.slice(0, 2).map((it) => {
          const active = pathname === it.href
          return (
            <DockButton
              key={it.key}
              item={it}
              active={active}
              onPress={() => {
                setQuickOpen(false)
                Haptics.selectionAsync()
                router.replace(it.href)
              }}
            />
          )
        })}

        <Pressable
          onPress={() => {
            Haptics.selectionAsync()
            setQuickOpen((value) => !value)
          }}
          style={({ pressed }) => [
            styles.record,
            {
              backgroundColor: name === 'dark' ? c.bronze : c.ink,
              transform: [{ scale: pressed ? 0.92 : 1 }],
              shadowColor: '#1C1916',
              shadowOpacity: 0.25,
            },
          ]}
        >
          <RecordIcon color={c.bg} />
        </Pressable>

        {ITEMS.slice(2).map((it) => {
          const active = pathname === it.href
          return (
            <DockButton
              key={it.key}
              item={it}
              active={active}
              onPress={() => {
                setQuickOpen(false)
                Haptics.selectionAsync()
                router.replace(it.href)
              }}
            />
          )
        })}
      </View>
    </Animated.View>
  )
}

interface QuickActionMenuProps {
  visible: boolean
  onRecord: () => void
  onAtlas: () => void
}

function QuickActionMenu({ visible, onRecord, onAtlas }: QuickActionMenuProps) {
  const { c, name } = useTheme()
  const opacity = useSharedValue(0)
  const scale = useSharedValue(0.96)
  const ty = useSharedValue(8)

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: 180, easing: Easing.out(Easing.cubic) })
    scale.value = withTiming(visible ? 1 : 0.96, { duration: 220, easing: Easing.out(Easing.cubic) })
    ty.value = withTiming(visible ? 0 : 8, { duration: 220, easing: Easing.out(Easing.cubic) })
  }, [opacity, scale, ty, visible])

  const menuStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }, { scale: scale.value }],
  }))

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.quickWrap,
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          shadowColor: name === 'dark' ? '#000' : '#1C1916',
        },
        menuStyle,
      ]}
    >
      <QuickActionButton
        label="Gravar"
        icon={<RecordIcon color={c.bg} />}
        iconBg={name === 'dark' ? c.bronze : c.ink}
        onPress={onRecord}
      />
      <View style={[styles.quickDivider, { backgroundColor: c.border }]} />
      <QuickActionButton
        label="Atlas"
        icon={<AtlasGlyph color={c.bg} />}
        iconBg={c.prussian}
        onPress={onAtlas}
      />
    </Animated.View>
  )
}

interface QuickActionButtonProps {
  label: string
  icon: ReactNode
  iconBg: string
  onPress: () => void
}

function QuickActionButton({ label, icon, iconBg, onPress }: QuickActionButtonProps) {
  const { c } = useTheme()

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickButton,
        { opacity: pressed ? 0.72 : 1 },
      ]}
    >
      <View style={[styles.quickIcon, { backgroundColor: iconBg }]}>
        {icon}
      </View>
      <Sans weight="med" size={13} color={c.ink}>
        {label}
      </Sans>
    </Pressable>
  )
}

interface DockButtonProps {
  item: DockItem
  active: boolean
  onPress: () => void
}

function DockButton({ item, active, onPress }: DockButtonProps) {
  const { c } = useTheme()
  const iconColor = active ? c.bronze : c.ink2
  const labelColor = active ? c.ink : c.ink2

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { transform: [{ scale: pressed ? 0.92 : 1 }] },
      ]}
    >
      <DockIcon icon={item.icon} color={iconColor} />
      <Sans weight="med" size={11} color={labelColor} style={{ marginTop: 2 }}>
        {item.label}
      </Sans>
    </Pressable>
  )
}

interface DockIconProps {
  icon: DockItem['icon']
  color: string
}

// Simple line icons drawn with Views to avoid a SVG dep.
function DockIcon({ icon, color }: DockIconProps) {
  const stroke = 1.6
  if (icon === 'home') {
    return (
      <View style={{ width: 22, height: 22 }}>
        {/* roof */}
        <View style={{ position: 'absolute', left: 1, top: 5, width: 14, height: 1.6, backgroundColor: color, transform: [{ rotate: '-30deg' }], borderRadius: 1 }} />
        <View style={{ position: 'absolute', right: 1, top: 5, width: 14, height: 1.6, backgroundColor: color, transform: [{ rotate: '30deg' }], borderRadius: 1 }} />
        {/* walls */}
        <View style={{ position: 'absolute', left: 3, top: 10, width: 1.6, height: 11, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ position: 'absolute', right: 3, top: 10, width: 1.6, height: 11, backgroundColor: color, borderRadius: 1 }} />
        {/* base */}
        <View style={{ position: 'absolute', left: 3, top: 20, right: 3, height: stroke, backgroundColor: color, borderRadius: 1 }} />
      </View>
    )
  }
  if (icon === 'inbox') {
    return (
      <View style={{ width: 22, height: 22 }}>
        <View style={{ position: 'absolute', left: 1, top: 4, right: 1, height: stroke, backgroundColor: color }} />
        <View style={{ position: 'absolute', left: 1, top: 4, width: stroke, height: 12, backgroundColor: color }} />
        <View style={{ position: 'absolute', right: 1, top: 4, width: stroke, height: 12, backgroundColor: color }} />
        <View style={{ position: 'absolute', left: 1, top: 14, width: 6, height: stroke, backgroundColor: color, transform: [{ rotate: '50deg' }] }} />
        <View style={{ position: 'absolute', right: 1, top: 14, width: 6, height: stroke, backgroundColor: color, transform: [{ rotate: '-50deg' }] }} />
        <View style={{ position: 'absolute', left: 5, top: 18, right: 5, height: stroke, backgroundColor: color }} />
      </View>
    )
  }
  if (icon === 'review') {
    return (
      <View style={{ width: 22, height: 22 }}>
        <View style={{ position: 'absolute', left: 1, top: 3, right: 1, bottom: 1, borderWidth: stroke, borderColor: color, borderRadius: 1 }} />
        <View style={{ position: 'absolute', left: 1, top: 8, right: 1, height: stroke, backgroundColor: color }} />
        <View style={{ position: 'absolute', left: 6, top: 1, width: stroke, height: 5, backgroundColor: color }} />
        <View style={{ position: 'absolute', left: 14, top: 1, width: stroke, height: 5, backgroundColor: color }} />
      </View>
    )
  }
  // ritual — clock
  return (
    <View style={{ width: 22, height: 22 }}>
      <View style={{ position: 'absolute', left: 1, top: 1, width: 20, height: 20, borderRadius: 10, borderWidth: stroke, borderColor: color }} />
      <View style={{ position: 'absolute', left: 11 - stroke / 2, top: 6, width: stroke, height: 6, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 11 - stroke / 2, top: 11 - stroke / 2, width: 5, height: stroke, backgroundColor: color }} />
    </View>
  )
}

function RecordIcon({ color }: { color: string }) {
  // Mic glyph
  return (
    <View style={{ width: 22, height: 22 }}>
      <View style={{ position: 'absolute', left: 7, top: 2, width: 8, height: 11, borderRadius: 4, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 4, top: 11, width: 14, height: 1.6, backgroundColor: color, borderRadius: 8, transform: [{ skewX: '0deg' }] }} />
      <View style={{ position: 'absolute', left: 4, top: 11, width: 1.6, height: 4, backgroundColor: color }} />
      <View style={{ position: 'absolute', right: 4, top: 11, width: 1.6, height: 4, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 11 - 0.8, top: 16, width: 1.6, height: 5, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 7, top: 21, width: 8, height: 1.6, backgroundColor: color, borderRadius: 1 }} />
    </View>
  )
}

function AtlasGlyph({ color }: { color: string }) {
  return (
    <View style={{ width: 22, height: 22 }}>
      <View style={{ position: 'absolute', left: 3, top: 3, width: 16, height: 16, borderRadius: 8, borderWidth: 1.6, borderColor: color }} />
      <View style={{ position: 'absolute', left: 10.2, top: 1, width: 1.6, height: 20, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 1, top: 10.2, width: 20, height: 1.6, borderRadius: 1, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 8, top: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 30,
  },
  dock: {
    height: 64,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 36,
    elevation: 8,
  },
  btn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  record: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 6,
  },
  quickWrap: {
    position: 'absolute',
    left: '50%',
    bottom: 74,
    width: 196,
    marginLeft: -98,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 34,
    elevation: 10,
  },
  quickButton: {
    width: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 6,
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickDivider: {
    width: StyleSheet.hairlineWidth,
    height: 44,
    marginHorizontal: 2,
  },
})
