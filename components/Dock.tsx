import { Image, Pressable, StyleSheet, View } from 'react-native'
import { useEffect, useRef } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg'
import { useRouter, usePathname } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Frau } from '../design/Type'
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

  // v15.3 · Triple-tap detector pro botão Inbox · 3 taps em janela 600ms abre
  // Atlas Celestial (tela secundária mapa estelar). Tap simples segue navegação
  // normal pra /inbox. Decisão arquitetural: easter egg gestural · descoberta
  // organica · não polui UI com botão extra "view celestial".
  const inboxTapsRef = useRef(0)
  const inboxTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleInboxTap = () => {
    inboxTapsRef.current += 1

    // 3º tap em janela ativa → abre celestial
    if (inboxTapsRef.current >= 3) {
      inboxTapsRef.current = 0
      if (inboxTapTimerRef.current) {
        clearTimeout(inboxTapTimerRef.current)
        inboxTapTimerRef.current = null
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      router.push('/celestial')
      return
    }

    // 1º tap · navega pra inbox normal (preserva UX padrão)
    if (inboxTapsRef.current === 1) {
      Haptics.selectionAsync()
      router.replace('/inbox')
    }

    // Reset counter após 600ms de inatividade · janela pra completar triple-tap
    if (inboxTapTimerRef.current) clearTimeout(inboxTapTimerRef.current)
    inboxTapTimerRef.current = setTimeout(() => {
      inboxTapsRef.current = 0
      inboxTapTimerRef.current = null
    }, 600)
  }

  if (focused) {
    return <Animated.View pointerEvents="none" style={wrapStyle} />
  }

  return (
    <Animated.View pointerEvents="box-none" style={wrapStyle}>
      {/* v17 · multi-layer shadow stack · 3 camadas compostas pra dar profundidade
          física real (objeto sobre pergaminho), não flat "card flutuando".
          Layer 1 (far): atmosphere wide soft halo
          Layer 2 (mid): mid grounding
          Layer 3 (close): sharp contact com o "papel" + dock content */}
      <View
        style={[
          styles.dockShadowFar,
          {
            backgroundColor: c.surface,
            shadowColor: name === 'dark' ? '#000' : '#1A1612',
            shadowOpacity: name === 'dark' ? 0.32 : 0.06,
          },
        ]}
      >
      <View
        style={[
          styles.dockShadowMid,
          {
            backgroundColor: c.surface,
            shadowColor: name === 'dark' ? '#000' : '#1A1612',
            shadowOpacity: name === 'dark' ? 0.22 : 0.10,
          },
        ]}
      >
      <View
        style={[
          styles.dock,
          {
            backgroundColor: c.surface,
            borderColor: c.border,
            shadowColor: name === 'dark' ? '#000' : '#1A1612',
            shadowOpacity: name === 'dark' ? 0.18 : 0.08,
          },
        ]}
      >
        {/* B · Atmospheric gradient · luz marfim warm top-center fading pra
            sombra bronze sutil bottom-edges. Como pegada de luz internalizada
            em pergaminho envelhecido (vocabulário Hermès Birkin). Clipped à
            forma do pill via overflow:hidden no wrapper. */}
        <View pointerEvents="none" style={styles.dockAtmosphere}>
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="dockLight" cx="50%" cy="0%" r="80%" fx="50%" fy="0%">
                <Stop offset="0%" stopColor="#F4EFE6" stopOpacity={name === 'dark' ? '0.06' : '0.10'} />
                <Stop offset="65%" stopColor="#F4EFE6" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="dockAmbience" cx="50%" cy="100%" r="65%" fx="50%" fy="100%">
                <Stop offset="0%" stopColor="#7A5E2F" stopOpacity={name === 'dark' ? '0.05' : '0.04'} />
                <Stop offset="60%" stopColor="#7A5E2F" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#dockLight)" />
            <Rect width="100%" height="100%" fill="url(#dockAmbience)" />
          </Svg>
        </View>

        {/* Inner bezel · marfim inset · jewelry signal (mesmo idioma do
            atlasBezel da capture dome). Profundidade biselada sutil sem
            virar contorno visível. */}
        <View
          pointerEvents="none"
          style={[
            styles.dockBezel,
            { borderColor: name === 'dark' ? 'rgba(244,239,230,0.10)' : 'rgba(244,239,230,0.18)' },
          ]}
        />
        {ITEMS.slice(0, 2).map((it) => {
          const active = pathname === it.href
          return (
            <DockButton
              key={it.key}
              item={it}
              active={active}
              onPress={() => {
                // v15.3 · Inbox tap detection · single tap navigation,
                // triple tap (3 taps em <600ms) abre Atlas Celestial.
                if (it.key === 'inbox') {
                  handleInboxTap()
                } else {
                  Haptics.selectionAsync()
                  router.replace(it.href)
                }
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
              borderTopColor: 'rgba(155,122,63,0.36)', // v17 · edge bronze 42→36% (mais whisper, menos chunky)
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Atlas AI"
        >
          {/* v17 · curvatura óptica real · 3 layers SVG ao invés de 2:
              - atlasDepth (bottom-right shadow profundidade)
              - atlasDome (highlight warm soft top-left, halo amplo)
              - atlasSpecular (highlight crisp focal · Apple Watch tier glass) */}
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
                <Stop offset="0%" stopColor="#06080F" stopOpacity="0.36" />
                <Stop offset="60%" stopColor="#06080F" stopOpacity="0" />
              </RadialGradient>
              {/* Specular crisp · highlight focal pequeno e brilhante.
                  Diferente do atlasDome que é soft halo, este é o "ponto de luz"
                  refletido como em vidro polido. Apple Watch face technique. */}
              <RadialGradient
                id="atlasSpecular"
                cx="36%"
                cy="26%"
                r="20%"
                fx="36%"
                fy="26%"
              >
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.14" />
                <Stop offset="80%" stopColor="#FFFFFF" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="50%" cy="50%" r="50%" fill="url(#atlasDepth)" />
            <Circle cx="50%" cy="50%" r="50%" fill="url(#atlasDome)" />
            <Circle cx="50%" cy="50%" r="50%" fill="url(#atlasSpecular)" />
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
      </View>
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
  // v17 cinema · cor inativa c.ink3 (mais faded que c.ink2) · whisper.
  // Active = bronze · contraste cool-warm sobre paper.
  const iconColor = active ? c.bronze : c.ink3
  const labelColor = active ? c.ink : c.ink2

  // v17 · animated press feedback (220ms in / 360ms out exhale) · mesma
  // vocabulary do CodexPressable na home + chips do inbox.
  const pressProgress = useSharedValue(0)
  // Active state progress · drive bronze hairline marker fade-in.
  const activeProgress = useSharedValue(active ? 1 : 0)

  useEffect(() => {
    activeProgress.value = withTiming(active ? 1 : 0, {
      duration: 380,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
  }, [active, activeProgress])

  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressProgress.value * 0.45,
    transform: [{ scale: 1 - pressProgress.value * 0.06 }],
  }))

  // Bronze hairline mark abaixo do label · "you are here" stamp.
  // Fade-in + scaleX 0→1 origin center · grows do meio quando vira ativo.
  const animatedMarkStyle = useAnimatedStyle(() => ({
    opacity: activeProgress.value * 0.5,
    transform: [{ scaleX: activeProgress.value }],
  }))

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressProgress.value = withTiming(1, {
          duration: 220,
          easing: Easing.bezier(0.32, 0, 0.67, 0),
        })
      }}
      onPressOut={() => {
        pressProgress.value = withTiming(0, {
          duration: 360,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })
      }}
      style={styles.btn}
    >
      <Animated.View style={[styles.btnContent, animatedContentStyle]}>
        <DockIcon icon={item.icon} color={iconColor} />
        <Frau italic size={11} lineHeight={14} color={labelColor} style={{ marginTop: 3, opacity: active ? 0.85 : 0.55 }}>
          {item.label.toLowerCase()}
        </Frau>
        <Animated.View
          style={[styles.btnActiveMark, { backgroundColor: c.bronze }, animatedMarkStyle]}
          pointerEvents="none"
        />
      </Animated.View>
    </Pressable>
  )
}

interface DockIconProps {
  icon: DockItem['icon']
  color: string
}

// Simple line icons drawn with Views to avoid a SVG dep.
// v17 cinema · stroke refinado 1.6→1.0 (mais delicate, codex feel).
function DockIcon({ icon, color }: DockIconProps) {
  const stroke = 1.0
  if (icon === 'home') {
    return (
      <View style={{ width: 22, height: 22 }}>
        <View style={{ position: 'absolute', left: 1, top: 5, width: 14, height: stroke, backgroundColor: color, transform: [{ rotate: '-30deg' }], borderRadius: 1 }} />
        <View style={{ position: 'absolute', right: 1, top: 5, width: 14, height: stroke, backgroundColor: color, transform: [{ rotate: '30deg' }], borderRadius: 1 }} />
        <View style={{ position: 'absolute', left: 3, top: 10, width: stroke, height: 11, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ position: 'absolute', right: 3, top: 10, width: stroke, height: 11, backgroundColor: color, borderRadius: 1 }} />
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
  // v17 · multi-layer shadow · stack de 3 Views idênticos (mesmo size + radius
  // + bg c.surface) cada um castando shadow distinto. Empilhados pixel-perfect,
  // só o topmost (dock) é visualmente percebido · shadows compõem profundidade real.
  dockShadowFar: {
    height: 64,
    borderRadius: 32,
    shadowOffset: { width: 0, height: 24 },
    shadowRadius: 48,
    elevation: 14, // Android fallback (stacked elevation só usa o maior)
  },
  dockShadowMid: {
    height: 64,
    borderRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
  },
  dock: {
    height: 64,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    position: 'relative',
  },
  // Inner bezel · 1px marfim inset · profundidade biselada como joalheria.
  // Cor varia com tema (light: 18%, dark: 10%) pra rim apropriado.
  dockBezel: {
    position: 'absolute',
    left: 1,
    top: 1,
    right: 1,
    bottom: 1,
    borderRadius: 31,
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 1,
    pointerEvents: 'none',
  },
  // Atmospheric gradient interno · clipped ao pill via overflow:hidden.
  // Renderiza luz top-center + ambiente bronze bottom-edges (4-10% opacity).
  // Como Birkin · luz internalizada do pergaminho.
  dockAtmosphere: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: 32,
    overflow: 'hidden',
    zIndex: 0,
  },
  btn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Active state mark · bronze hairline 14×1 com EMBER HALO bronze.
  // shadowColor bronze + shadowRadius 4 cria glow perpendicular à linha,
  // como cera quente que ainda esfria. Differentiation visual sem peso.
  // Android sem glow colorido (elevation não suporta hue) · degradação OK.
  btnActiveMark: {
    width: 14,
    height: 1,
    marginTop: 4,
    borderRadius: 0.5,
    shadowColor: '#9B7A3F',
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 4,
    elevation: 2,
  },
  // v17 · dome 56→54, borderRadius 28→27 · subtle downscale, menos chunky.
  // Mantém presença como singularity do app · só ligeiramente mais discreto.
  atlas: {
    width: 54,
    height: 54,
    borderRadius: 27,
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
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(244,239,230,0.07)',
  },
})
