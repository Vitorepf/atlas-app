import { Image, Pressable, StyleSheet, View } from 'react-native'
import { useEffect, useRef } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg'
import { useRouter, usePathname } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Frau } from '../design/Type'
import { useTheme } from '../design/theme'
import { useOverlays } from '../lib/overlays'

const FOCUSED_ROUTES = new Set(['/capture', '/detail', '/decision'])
const atlasLogoMarfim = require('../assets/brand/atlas-logo-marfim.png')

// Animated Pressable · permite passar style array contendo animated styles
// pra Pressable. Usado no dome (singularity) pra animar transform + opacity
// na própria Pressable, não wrapping View — preserva shadow/bg do dome.
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

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

  // Dome press · WEIGHTED singularity feedback · 220ms in / 520ms out.
  // Mais lento que tabs (180/420) · sinal de massa simbólica.
  // Opacity 1→0.78 (dim 0.22) · scale 1→0.93 (dim 0.07) · ligeiramente
  // MAIS travel que tabs porque dome é gravitational (Vision Pro crown vibe).
  const domePress = useSharedValue(0)

  const animatedDomeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - domePress.value * 0.07 }],
    opacity: 1 - domePress.value * 0.22,
  }))

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
        {/* Atmospheric layers · 3 gradients compostos pra realismo óptico:
            - dockLight: luz marfim warm top-center (fonte de luz)
            - dockTopRim: rim light crisp na borda superior (light catching edge,
              como couro de Hermès Birkin captura sun)
            - dockAmbience: sombra bronze sutil bottom (peso do papel)
            Tudo clipped ao pill shape via overflow:hidden. */}
        <View pointerEvents="none" style={styles.dockAtmosphere}>
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="dockLight" cx="50%" cy="0%" r="80%" fx="50%" fy="0%">
                <Stop offset="0%" stopColor="#F4EFE6" stopOpacity={name === 'dark' ? '0.06' : '0.10'} />
                <Stop offset="65%" stopColor="#F4EFE6" stopOpacity="0" />
              </RadialGradient>
              {/* Top rim light · crisp highlight na borda superior fading rápido.
                  Pico em -2% (acima do pill) cria sensação de luz incidindo no rim.
                  Apple-tier depth signal. */}
              <RadialGradient id="dockTopRim" cx="50%" cy="-2%" r="55%" fx="50%" fy="-2%">
                <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={name === 'dark' ? '0.10' : '0.16'} />
                <Stop offset="40%" stopColor="#FFFFFF" stopOpacity="0" />
              </RadialGradient>
              <RadialGradient id="dockAmbience" cx="50%" cy="100%" r="65%" fx="50%" fy="100%">
                <Stop offset="0%" stopColor="#7A5E2F" stopOpacity={name === 'dark' ? '0.05' : '0.04'} />
                <Stop offset="60%" stopColor="#7A5E2F" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#dockLight)" />
            <Rect width="100%" height="100%" fill="url(#dockAmbience)" />
            <Rect width="100%" height="100%" fill="url(#dockTopRim)" />
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

        <AnimatedPressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            openAtlasAi()
          }}
          onPressIn={() => {
            // 220ms · weighted give · singularity resiste mais que tabs (180ms).
            domePress.value = withTiming(1, {
              duration: 220,
              easing: Easing.bezier(0.32, 0.72, 0.24, 1),
            })
          }}
          onPressOut={() => {
            // 520ms · cinematic recovery · 2.36x slower than in.
            // Dome respira de volta com massa, como Patek perpetual pusher.
            domePress.value = withTiming(0, {
              duration: 520,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            })
          }}
          style={[
            styles.atlas,
            {
              backgroundColor: c.prussian,
              shadowColor: '#1A1612',
              shadowOpacity: 0.32,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: 'rgba(155,122,63,0.36)',
            },
            animatedDomeStyle,
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
              {/* v17 · Rim light bottom · luz bronze refletida do papel sob o
                  dome batendo na base. Optical realism · cera oxidada pega
                  reflexão warm do plano abaixo. Apple Watch caustic effect. */}
              <RadialGradient
                id="atlasRimLight"
                cx="50%"
                cy="100%"
                r="48%"
                fx="50%"
                fy="100%"
              >
                <Stop offset="0%" stopColor="#9B7A3F" stopOpacity="0.14" />
                <Stop offset="55%" stopColor="#9B7A3F" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="50%" cy="50%" r="50%" fill="url(#atlasDepth)" />
            <Circle cx="50%" cy="50%" r="50%" fill="url(#atlasRimLight)" />
            <Circle cx="50%" cy="50%" r="50%" fill="url(#atlasDome)" />
            <Circle cx="50%" cy="50%" r="50%" fill="url(#atlasSpecular)" />
          </Svg>

          {/* Camada 2 · brand mark astrolábio · reduzido 36→30 (53% fill).
              Respiro de medalhão / signet ring · não emblema apertado. */}
          <AtlasBrandMark size={30} />

          {/* Camada 3 · inner bezel · 1px marfim 7% inset · sinal de "biselado",
              como anel de joalheria · adiciona profundidade sem virar contorno visível. */}
          <View pointerEvents="none" style={styles.atlasBezel} />
        </AnimatedPressable>

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
  // v18 · breath pulse infinito quando ativo · marker respira como ember vivo.
  // 5s cycle (2.5s up, 2.5s down), easing inOut sin · ritmo de respiração calma.
  const pulseProgress = useSharedValue(0)

  useEffect(() => {
    activeProgress.value = withTiming(active ? 1 : 0, {
      duration: 380,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
  }, [active, activeProgress])

  useEffect(() => {
    if (active) {
      pulseProgress.value = withRepeat(
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      )
    } else {
      pulseProgress.value = 0
    }
  }, [active, pulseProgress])

  // Press feedback cinematic · valores VISÍVEIS em renderização real.
  // Opacity 1→0.70 (dim 0.30) · scale 1→0.94 (dim 0.06) · perceptíveis.
  // Timing cinematic preservado (180/420 in/out). A diferença SaaS vs codex
  // é o TIMING + EASING, não a magnitude — magnitude precisa ser visível.
  //
  // + Active lift · item selecionado sobe 2px relativo aos outros (animado
  // via activeProgress, 380ms exhale) · sensação de "escolhido" sem halo/dome.
  // Compõe com press scale no mesmo transform — ambos coexistem.
  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressProgress.value * 0.30,
    transform: [
      { translateY: -2 * activeProgress.value },
      { scale: 1 - pressProgress.value * 0.06 },
    ],
  }))

  // v19 · Active depression layer · simula item afundado no papel.
  // Inset shadow top + highlight bottom (linear gradients) + warm bronze radial
  // sob o active item · 3 SVG layers compostos. Active item = "pressionado",
  // não "flutuando" como inactive. Como tecla pressionada na máquina de escrever.
  const animatedActiveLayerStyle = useAnimatedStyle(() => ({
    opacity: activeProgress.value,
  }))

  // Bronze hairline mark abaixo do label · "you are here" stamp.
  // Fade-in + scaleX 0→1 origin center · grows do meio quando vira ativo.
  // v18 breath: opacity 0.5 ↔ 0.42 + scaleX 1.0 ↔ 0.96 quando ativo (pulseProgress).
  const animatedMarkStyle = useAnimatedStyle(() => ({
    opacity: activeProgress.value * (0.5 - pulseProgress.value * 0.08),
    transform: [{ scaleX: activeProgress.value * (1 - pulseProgress.value * 0.04) }],
  }))

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        // 180ms · bezier(0.32, 0.72, 0.24, 1) · "give" codex (cera prensada,
        // não snap SaaS). Suave nos dois lados, zero sharp.
        pressProgress.value = withTiming(1, {
          duration: 180,
          easing: Easing.bezier(0.32, 0.72, 0.24, 1),
        })
      }}
      onPressOut={() => {
        // 420ms · 2.3x mais lento que in · assinatura iOS/Hermès cinematic.
        // exhale Apple Books · cera respira de volta sem quicar.
        pressProgress.value = withTiming(0, {
          duration: 420,
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        })
      }}
      style={styles.btn}
    >
      <Animated.View style={[styles.btnContent, animatedContentStyle]}>
        <Frau italic weight={active ? 'med' : 'reg'} size={13} lineHeight={13} color={labelColor} style={{ opacity: active ? 0.95 : 0.55 }}>
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
  active?: boolean
}

// Simple line icons drawn with Views to avoid a SVG dep.
// v17 cinema · stroke refinado 1.6→1.0 (mais delicate, codex feel).
// v18 letterpress · cada icon renderizado 2x: shadow ink offset 0.5px abaixo,
// depois icon real em cima. Cria efeito "carimbado em pergaminho" — strokes
// não pintados na superfície, mas IMPRESSOS · letterpress digital.
// v19 differential · active letterpress mais profundo (0.18, mais carimbado),
// inactive mais raso (0.06, quase-fade). Como manuscrito de uso real onde
// sections lidas frequentemente ficam mais marcadas no papel.
function DockIcon({ icon, color, active = false }: DockIconProps) {
  const stroke = 1.0
  const letterpressOpacity = active ? 0.18 : 0.06

  const renderStrokes = (strokeColor: string) => {
    if (icon === 'home') {
      return (
        <>
          <View style={{ position: 'absolute', left: 1, top: 5, width: 14, height: stroke, backgroundColor: strokeColor, transform: [{ rotate: '-30deg' }], borderRadius: 1 }} />
          <View style={{ position: 'absolute', right: 1, top: 5, width: 14, height: stroke, backgroundColor: strokeColor, transform: [{ rotate: '30deg' }], borderRadius: 1 }} />
          <View style={{ position: 'absolute', left: 3, top: 10, width: stroke, height: 11, backgroundColor: strokeColor, borderRadius: 1 }} />
          <View style={{ position: 'absolute', right: 3, top: 10, width: stroke, height: 11, backgroundColor: strokeColor, borderRadius: 1 }} />
          <View style={{ position: 'absolute', left: 3, top: 20, right: 3, height: stroke, backgroundColor: strokeColor, borderRadius: 1 }} />
        </>
      )
    }
    if (icon === 'inbox') {
      return (
        <>
          <View style={{ position: 'absolute', left: 1, top: 4, right: 1, height: stroke, backgroundColor: strokeColor }} />
          <View style={{ position: 'absolute', left: 1, top: 4, width: stroke, height: 12, backgroundColor: strokeColor }} />
          <View style={{ position: 'absolute', right: 1, top: 4, width: stroke, height: 12, backgroundColor: strokeColor }} />
          <View style={{ position: 'absolute', left: 1, top: 14, width: 6, height: stroke, backgroundColor: strokeColor, transform: [{ rotate: '50deg' }] }} />
          <View style={{ position: 'absolute', right: 1, top: 14, width: 6, height: stroke, backgroundColor: strokeColor, transform: [{ rotate: '-50deg' }] }} />
          <View style={{ position: 'absolute', left: 5, top: 18, right: 5, height: stroke, backgroundColor: strokeColor }} />
        </>
      )
    }
    if (icon === 'review') {
      return (
        <>
          <View style={{ position: 'absolute', left: 1, top: 3, right: 1, bottom: 1, borderWidth: stroke, borderColor: strokeColor, borderRadius: 1 }} />
          <View style={{ position: 'absolute', left: 1, top: 8, right: 1, height: stroke, backgroundColor: strokeColor }} />
          <View style={{ position: 'absolute', left: 6, top: 1, width: stroke, height: 5, backgroundColor: strokeColor }} />
          <View style={{ position: 'absolute', left: 14, top: 1, width: stroke, height: 5, backgroundColor: strokeColor }} />
        </>
      )
    }
    return (
      <>
        <View style={{ position: 'absolute', left: 1, top: 1, width: 20, height: 20, borderRadius: 10, borderWidth: stroke, borderColor: strokeColor }} />
        <View style={{ position: 'absolute', left: 11 - stroke / 2, top: 6, width: stroke, height: 6, backgroundColor: strokeColor }} />
        <View style={{ position: 'absolute', left: 11 - stroke / 2, top: 11 - stroke / 2, width: 5, height: stroke, backgroundColor: strokeColor }} />
      </>
    )
  }

  return (
    <View style={{ width: 22, height: 22 }}>
      {/* Letterpress shadow · ink offset 0.5px down, opacity differential.
          Renderiza o icon todo em ink scuro, deslocado, com opacity baseada
          em active state. Active = mais profundo (mais marcado), inactive =
          mais raso (esmaecido) · differential cria sensação tátil de leitura. */}
      <View style={{ position: 'absolute', top: 0.5, left: 0, width: 22, height: 22, opacity: letterpressOpacity }} pointerEvents="none">
        {renderStrokes('#1A1612')}
      </View>
      {/* Icon real · em cima do shadow */}
      {renderStrokes(color)}
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
    // Sem shadow · depression não projeta sombra (item está afundado, não erguido).
  },
  // v19 · Active depression layer · 3 gradients SVG clipped ao circle btn.
  // Posicionado absolute sob o content, animated opacity 0→1 com activeProgress.
  btnActiveLayer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    borderRadius: 25,
    overflow: 'hidden',
  },
  // Active state mark · bronze hairline 14×1 com EMBER HALO bronze.
  // shadowColor bronze + shadowRadius 4 cria glow perpendicular à linha,
  // como cera quente que ainda esfria. Differentiation visual sem peso.
  // Android sem glow colorido (elevation não suporta hue) · degradação OK.
  btnActiveMark: {
    width: 14,
    height: 1,
    marginTop: 2,
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
