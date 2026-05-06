import { Image, Pressable, StyleSheet, View } from 'react-native'
import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'
import { useRouter, usePathname } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Sans } from '../design/Type'
import { useTheme } from '../design/theme'
import { useOverlays } from '../lib/overlays'

const FOCUSED_ROUTES = new Set(['/capture', '/detail', '/decision'])
const atlasLogoMarfim = require('../assets/brand/atlas-logo-marfim.png')

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

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: ty.value }],
  }))

  const wrapStyle = [styles.wrap, { bottom: 8 + insets.bottom }, animStyle]

  if (focused) {
    return <Animated.View pointerEvents="none" style={wrapStyle} />
  }

  return (
    <Animated.View pointerEvents="box-none" style={wrapStyle}>
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
                Haptics.selectionAsync()
                router.replace(it.href)
              }}
            />
          )
        })}

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            openAtlasAi()
          }}
          style={({ pressed }) => [
            styles.atlas,
            {
              backgroundColor: c.prussian,
              transform: [{ scale: pressed ? 0.92 : 1 }],
              shadowColor: '#1A1612', // ink-tinted warm shadow
              shadowOpacity: 0.32,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: 'rgba(155,122,63,0.42)', // edge lighting bronze · decisivo
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Atlas AI"
        >
          {/* Camada 1 · superfície de domo · radial highlight top-left + depth bottom-right.
              Substitui o specular oval chapado v5 (parecia smudge UI). Agora é curvatura
              óptica real · selo de cera oxidado, não enamel pintado. */}
          <Svg
            width="100%"
            height="100%"
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          >
            <Defs>
              <RadialGradient
                id="atlasDome"
                cx="32%"
                cy="22%"
                r="62%"
                fx="32%"
                fy="22%"
              >
                <Stop offset="0%" stopColor="#F4EFE6" stopOpacity="0.18" />
                <Stop offset="55%" stopColor="#F4EFE6" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient
                id="atlasDepth"
                cx="78%"
                cy="84%"
                r="58%"
                fx="78%"
                fy="84%"
              >
                <Stop offset="0%" stopColor="#06080F" stopOpacity="0.32" />
                <Stop offset="60%" stopColor="#06080F" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="50%" cy="50%" r="50%" fill="url(#atlasDepth)" />
            <Circle cx="50%" cy="50%" r="50%" fill="url(#atlasDome)" />
          </Svg>

          {/* Camada 2 · brand mark astrolábio · reduzido 36→30 (53% fill).
              Respiro de medalhão / signet ring · não emblema apertado. */}
          <AtlasBrandMark size={30} />

          {/* Camada 3 · inner bezel · 1px marfim 7% inset · sinal de "biselado",
              como anel de joalheria · adiciona profundidade sem virar contorno visível. */}
          <View pointerEvents="none" style={styles.atlasBezel} />
        </Pressable>

        {ITEMS.slice(2).map((it) => {
          const active = pathname === it.href
          return (
            <DockButton
              key={it.key}
              item={it}
              active={active}
              onPress={() => {
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
        <View style={{ position: 'absolute', left: 1, top: 5, width: 14, height: 1.6, backgroundColor: color, transform: [{ rotate: '-30deg' }], borderRadius: 1 }} />
        <View style={{ position: 'absolute', right: 1, top: 5, width: 14, height: 1.6, backgroundColor: color, transform: [{ rotate: '30deg' }], borderRadius: 1 }} />
        <View style={{ position: 'absolute', left: 3, top: 10, width: 1.6, height: 11, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ position: 'absolute', right: 3, top: 10, width: 1.6, height: 11, backgroundColor: color, borderRadius: 1 }} />
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
  return (
    <View style={{ width: 22, height: 22 }}>
      <View style={{ position: 'absolute', left: 1, top: 1, width: 20, height: 20, borderRadius: 10, borderWidth: stroke, borderColor: color }} />
      <View style={{ position: 'absolute', left: 11 - stroke / 2, top: 6, width: stroke, height: 6, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 11 - stroke / 2, top: 11 - stroke / 2, width: 5, height: stroke, backgroundColor: color }} />
    </View>
  )
}

function AtlasBrandMark({ size }: { size: number }) {
  return (
    <Image
      source={atlasLogoMarfim}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
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
  atlas: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  // Inner bezel · inset 1px · marfim 7% · sinal de biselado de joalheria.
  // Não é contorno visível — é profundidade sussurrada. Casa com bronze edge top.
  atlasBezel: {
    position: 'absolute',
    left: 1,
    top: 1,
    right: 1,
    bottom: 1,
    borderRadius: 27,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244,239,230,0.07)',
  },
})
