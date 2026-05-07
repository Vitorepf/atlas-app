import { useMemo, useRef, useState, useEffect } from 'react'
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Svg, { Circle, G, Path, Text as SvgText } from 'react-native-svg'
import { Frau, Mono, Sans } from '../design/Type'
import { usePalette } from '../design/theme'
import { captureToInboxItem, useAtlasStore, visibleCaptures } from '../lib/atlasStore'
import type { InboxItem } from '../components/InboxCard'
import { useOverlays } from '../lib/overlays'
import type { DomainKey } from '../lib/domains'

// ============================================================
// Atlas Celestial · v1 · React Native
// ============================================================
// Tela secundária acessada via 3 taps no botão Inbox do Dock.
// Cada captura = uma estrela ✦ no firmamento intelectual pessoal.
// Domains mapeiam pra direções cardinais (N/S/E/W).
// Tempo afeta brilho · recente = bronze cheio · antigo = bronze fade.
// Tap em estrela abre DetailSheet existente (reuso da experiência editorial).
// ============================================================

// Domain → cardinal direction mapping
type Cardinal = 'N' | 'S' | 'E' | 'W'
const DOMAIN_CARDINAL: Record<string, Cardinal> = {
  atlas: 'N',
  blackink: 'W',
  saude: 'S',
  financas: 'E',
  outro: 'S',
}

const CARDINAL_LABEL: Record<Cardinal, string> = {
  N: 'ATLAS',
  S: 'PESSOAL',
  E: 'FILOSOFIA',
  W: 'BLACKINK',
}

// Calcula posição da estrela baseado em cardinal + jitter determinístico do id
function starPosition(item: InboxItem, screenW: number, screenH: number): { x: number; y: number } {
  const cardinal = DOMAIN_CARDINAL[item.domain] ?? 'S'

  // Hash determinístico do id pra jitter consistente
  const hash = stringHash(item.id)
  const jitterR = (hash % 100) / 100 // 0-1
  const jitterAngle = ((hash >> 8) % 360) * (Math.PI / 180)

  // Centro da tela
  const cx = screenW / 2
  const cy = screenH / 2

  // Distância do centro · base por cardinal · varia ligeiramente com jitter
  const baseDistance = Math.min(screenW, screenH) * 0.32
  const distance = baseDistance * (0.65 + jitterR * 0.55)

  // Direção principal (cardinal) com pequeno offset baseado em jitter angle
  const cardinalAngle = {
    N: -Math.PI / 2,
    S: Math.PI / 2,
    E: 0,
    W: Math.PI,
  }[cardinal]

  // Offset angular pequeno pra espalhar dentro do quadrante (~±60deg)
  const angleSpread = (Math.PI / 3) * (((hash >> 16) % 100) / 100 - 0.5) * 2
  const finalAngle = cardinalAngle + angleSpread + (jitterAngle * 0.05)

  return {
    x: cx + Math.cos(finalAngle) * distance,
    y: cy + Math.sin(finalAngle) * distance,
  }
}

// Rubber-band clamping · pan vai além do bound mas com resistência crescente.
// Inspirado no iOS scroll bounce · sensação de elasticidade ao "puxar".
function clampSoft(value: number, min: number, max: number): number {
  'worklet'
  if (value >= min && value <= max) return value
  const overshoot = value > max ? value - max : value - min
  const resistance = 0.32 // 0 = blocked · 1 = no resistance
  return value > max
    ? max + overshoot * resistance
    : min + overshoot * resistance
}

// String hash · djb2 simplificado · usado pra posicionamento determinístico
function stringHash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i)
  }
  return Math.abs(h)
}

// Idade da captura · afeta brilho da estrela
function ageBucket(item: InboxItem): 'recent' | 'mid' | 'old' {
  if (!item.capturedAt) return 'mid'
  const ageMs = Date.now() - new Date(item.capturedAt).getTime()
  const hourMs = 1000 * 60 * 60
  if (ageMs < 6 * hourMs) return 'recent'
  if (ageMs < 48 * hourMs) return 'mid'
  return 'old'
}

export default function CelestialScreen() {
  const c = usePalette()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const captures = useAtlasStore((s) => s.captures)
  const queuedCaptures = useAtlasStore((s) => s.queuedCaptures)
  const domains = useAtlasStore((s) => s.domains)
  const openDetail = useOverlays((s) => s.openDetail)

  // Items reais do atlas (até 30 mais recentes)
  const items = useMemo(() => {
    const merged = visibleCaptures({ captures, queuedCaptures })
    return merged.slice(0, 30).map((cap) => captureToInboxItem(cap, domains))
  }, [captures, queuedCaptures, domains])

  // Star positions calculadas uma vez (recalcula só se items/screen mudar)
  const stars = useMemo(() => {
    return items.map((item) => ({
      item,
      pos: starPosition(item, width, height),
      age: ageBucket(item),
    }))
  }, [items, width, height])

  // Entry overlay · ✦ bronze cresce · marfim revela céu
  const entryProgress = useSharedValue(1)
  useEffect(() => {
    entryProgress.value = withDelay(
      900,
      withTiming(0, { duration: 600, easing: Easing.bezier(0.32, 0.72, 0, 1) }),
    )
  }, [entryProgress])

  const entryStyle = useAnimatedStyle(() => ({
    opacity: entryProgress.value,
    pointerEvents: entryProgress.value > 0.05 ? 'auto' : 'none',
  } as const))

  const entryGlyphStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + (1 - entryProgress.value) * 0.6 }],
  }))

  // ============================================================
  // PAN GESTURE · arrastar o céu com dedo · explorar diferentes regiões.
  // panX/panY · translação acumulada do star field
  // startX/startY · valor base no início do gesto (pra não resetar)
  // withDecay no onEnd · momentum natural após release · 0.997 ≈ deceleração
  // longa cinemática (Apple Maps-style). Bounds: ±60% do menor lado pra não
  // perder estrelas longe demais.
  // activeOffset 8px · pan só ativa após 8px de movimento · permite tap em ✦.
  // ============================================================
  const panX = useSharedValue(0)
  const panY = useSharedValue(0)
  const startX = useSharedValue(0)
  const startY = useSharedValue(0)
  const minDim = Math.min(width, height)
  const panBound = minDim * 0.6 // ±60% do menor lado · evita perder estrelas

  const panGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .activeOffsetY([-8, 8])
    .onStart(() => {
      'worklet'
      startX.value = panX.value
      startY.value = panY.value
    })
    .onUpdate((e) => {
      'worklet'
      const nextX = startX.value + e.translationX
      const nextY = startY.value + e.translationY
      // Soft clamping (rubber-band) nas bordas pra dar sensação de elasticidade
      panX.value = clampSoft(nextX, -panBound, panBound)
      panY.value = clampSoft(nextY, -panBound, panBound)
    })
    .onEnd((e) => {
      'worklet'
      // Momentum decay com bounds · sheet do iOS Maps inspired.
      panX.value = withDecay({
        velocity: e.velocityX,
        deceleration: 0.997,
        clamp: [-panBound, panBound],
      })
      panY.value = withDecay({
        velocity: e.velocityY,
        deceleration: 0.997,
        clamp: [-panBound, panBound],
      })
    })

  // Recenter gesture · double-tap em qualquer área vazia volta panX/Y a 0
  // com spring · "voltar pro horizonte zero" do céu.
  const recenterGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd(() => {
      'worklet'
      panX.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.9 })
      panY.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.9 })
    })

  const composedGesture = Gesture.Simultaneous(panGesture, recenterGesture)

  const fieldStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: panX.value },
      { translateY: panY.value },
    ],
  }))

  // v15.4 · "explore hint" · sussurra ao usuário que pode arrastar.
  // Fade-in depois do entry, fade-out na primeira interação de pan.
  const hintOpacity = useSharedValue(0)
  const [hintDismissed, setHintDismissed] = useState(false)
  useEffect(() => {
    if (hintDismissed) {
      hintOpacity.value = withTiming(0, { duration: 320 })
    } else {
      hintOpacity.value = withDelay(
        2200,
        withTiming(1, { duration: 600 }),
      )
    }
  }, [hintOpacity, hintDismissed])

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
  }))

  // Detecta primeira interação · dispara dismiss do hint
  useEffect(() => {
    if (hintDismissed) return
    const id = setInterval(() => {
      if (panX.value !== 0 || panY.value !== 0) {
        setHintDismissed(true)
      }
    }, 200)
    return () => clearInterval(id)
  }, [hintDismissed, panX, panY])

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Cartografia sussurrada · meridianos + paralelos · matching CartogBackground */}
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid slice"
        style={[StyleSheet.absoluteFillObject, { opacity: 0.06 }]}
        pointerEvents="none"
      >
        <Path
          d={`M ${width * 0.2} -50 Q ${width * 0.27} ${height / 2} ${width * 0.2} ${height + 50}`}
          stroke={c.ink}
          strokeWidth="0.5"
          fill="none"
        />
        <Path
          d={`M ${width * 0.8} -50 Q ${width * 0.73} ${height / 2} ${width * 0.8} ${height + 50}`}
          stroke={c.ink}
          strokeWidth="0.5"
          fill="none"
        />
        <Path
          d={`M -50 ${height * 0.3} Q ${width / 2} ${height * 0.32} ${width + 50} ${height * 0.3}`}
          stroke={c.ink}
          strokeWidth="0.4"
          fill="none"
        />
        <Path
          d={`M -50 ${height * 0.7} Q ${width / 2} ${height * 0.72} ${width + 50} ${height * 0.7}`}
          stroke={c.ink}
          strokeWidth="0.4"
          fill="none"
        />
      </Svg>

      {/* HEADER · masthead editorial */}
      <View style={[styles.header, { paddingTop: insets.top + 18 }]}>
        <Frau italic size={28} lineHeight={32} letterSpacing={-0.6} color={c.ink}>
          Atlas
        </Frau>
        <Mono size={10.5} letterSpacing={1.4} color={c.ink3} style={{ marginTop: 4, textTransform: 'uppercase' }}>
          céu pessoal · {formatDate(new Date())}
        </Mono>
      </View>

      {/* CARDINAIS · 4 domínios · FIXOS no viewport (chrome do telescópio).
          Não pannem com as estrelas · marca de orientação eterna do céu. */}
      <CardinalLabel cardinal="N" top={insets.top + 92} left={width / 2} />
      <CardinalLabel cardinal="S" top={height - 140 - insets.bottom} left={width / 2} />
      <CardinalLabel cardinal="E" top={height / 2} left={width - 28} rotate={90} />
      <CardinalLabel cardinal="W" top={height / 2} left={28} rotate={-90} />

      {/* STAR FIELD PANEL · GestureDetector envolve · Animated.View transladado.
          Estrelas e (futuras) constelações vivem aqui · pannam juntas como céu real.
          GestureDetector posicionado absolute fill · captura touches no fundo do
          viewport · activeOffset 8px deixa tap em ✦ passar. Double-tap em área
          vazia recentra. */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View
          style={[styles.starField, fieldStyle]}
          collapsable={false}
        >
          {stars.map((star, idx) => (
            <Star
              key={star.item.id}
              item={star.item}
              x={star.pos.x}
              y={star.pos.y}
              age={star.age}
              delay={1500 + idx * 60}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {})
                openDetail(star.item)
              }}
            />
          ))}
        </Animated.View>
      </GestureDetector>

      {/* READING PANEL · "leitura do céu" · footer editorial */}
      <View style={[styles.reading, { paddingBottom: insets.bottom + 24 }]}>
        <Animated.View entering={FadeIn.duration(800).delay(2400)}>
          <Sans
            weight="med"
            size={10}
            lineHeight={14}
            letterSpacing={1.4}
            color={c.ink3}
            style={[styles.readingLabel, { textTransform: 'uppercase' }]}
          >
            leitura do céu
          </Sans>
          <Frau italic size={15} lineHeight={22} letterSpacing={-0.05} color={c.ink} style={styles.readingText}>
            {generateReadingText(stars, c)}
          </Frau>
          <View style={[styles.readingRule, { backgroundColor: 'rgba(155,122,63,0.25)' }]} />
        </Animated.View>
      </View>

      {/* CLOSE BUTTON · top-right · volta pra inbox */}
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {})
          router.back()
        }}
        accessibilityRole="button"
        accessibilityLabel="fechar céu pessoal"
        hitSlop={12}
        style={[styles.close, { top: insets.top + 18, right: 22 }]}
      >
        <Frau italic size={14} lineHeight={20} color={c.ink3}>
          fechar
        </Frau>
      </Pressable>

      {/* EXPLORE HINT · sussurro sutil "arraste pra explorar"
          fade-in 2.2s após entry · fade-out na 1ª interação. */}
      <Animated.View
        style={[styles.exploreHint, hintStyle]}
        pointerEvents="none"
      >
        <Frau italic size={11} lineHeight={15} color={c.ink3} style={{ opacity: 0.85 }}>
          arraste pra explorar · toque duplo recentra
        </Frau>
      </Animated.View>

      {/* ENTRY OVERLAY · marfim escuro com ✦ bronze · fade out 900ms */}
      <Animated.View
        style={[styles.entryOverlay, { backgroundColor: c.ink }, entryStyle]}
      >
        <Animated.View style={entryGlyphStyle}>
          <Frau italic size={64} lineHeight={64} color={c.bronze}>
            ✦
          </Frau>
        </Animated.View>
      </Animated.View>
    </View>
  )
}

// ============================================================
// STAR · individual ✦ glyph com breathing animation
// ============================================================
function Star({
  item,
  x,
  y,
  age,
  delay,
  onPress,
}: {
  item: InboxItem
  x: number
  y: number
  age: 'recent' | 'mid' | 'old'
  delay: number
  onPress: () => void
}) {
  const c = usePalette()
  const breath = useSharedValue(0)

  useEffect(() => {
    if (age === 'recent') {
      breath.value = withDelay(
        delay + 800,
        withRepeat(
          withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.ease) }),
          -1,
          true,
        ),
      )
    }
  }, [breath, delay, age])

  const breathStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.06 }],
  }))

  const size = age === 'recent' ? 22 : age === 'mid' ? 18 : 14
  const color =
    age === 'recent' ? c.bronze :
    age === 'mid' ? 'rgba(155,122,63,0.75)' :
    'rgba(155,122,63,0.42)'

  return (
    <Animated.View
      entering={FadeIn.duration(700).delay(delay)}
      style={[
        styles.star,
        {
          left: x - 22,
          top: y - 22,
        },
      ]}
    >
      <Pressable onPress={onPress} hitSlop={16} accessibilityRole="button">
        <Animated.View style={breathStyle}>
          <Frau italic size={size} lineHeight={size} color={color}>
            ✦
          </Frau>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

// ============================================================
// CARDINAL LABEL · letrinhas N/S/E/W com bullet bronze
// ============================================================
function CardinalLabel({
  cardinal,
  top,
  left,
  rotate = 0,
}: {
  cardinal: Cardinal
  top: number
  left: number
  rotate?: number
}) {
  const c = usePalette()
  return (
    <Animated.View
      entering={FadeIn.duration(800).delay(1100)}
      style={[
        styles.cardinal,
        {
          top,
          left,
          transform: [{ translateX: -50 }, { translateY: -10 }, { rotate: `${rotate}deg` }],
        },
      ]}
      pointerEvents="none"
    >
      <View style={[styles.cardinalBullet, { backgroundColor: c.bronze, opacity: 0.6 }]} />
      <Sans
        weight="med"
        size={10}
        lineHeight={14}
        letterSpacing={2}
        color={c.ink3}
        style={{ textTransform: 'uppercase' }}
      >
        {CARDINAL_LABEL[cardinal]}
      </Sans>
    </Animated.View>
  )
}

// ============================================================
// READING TEXT · gerador simples baseado em distribuição das estrelas
// ============================================================
function generateReadingText(
  stars: Array<{ item: InboxItem; age: 'recent' | 'mid' | 'old' }>,
  c: ReturnType<typeof usePalette>,
): string {
  if (stars.length === 0) {
    return 'o céu está vazio · aguardando sua primeira captura para acender uma estrela.'
  }

  // Conta estrelas por cardinal
  const byCardinal: Record<Cardinal, number> = { N: 0, S: 0, E: 0, W: 0 }
  for (const star of stars) {
    const cardinal = DOMAIN_CARDINAL[star.item.domain] ?? 'S'
    byCardinal[cardinal]++
  }

  const sorted = (Object.entries(byCardinal) as Array<[Cardinal, number]>)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)

  const dominant = sorted[0]
  const recentCount = stars.filter((s) => s.age === 'recent').length

  if (!dominant) return 'céu sussurrado · poucas estrelas, muito espaço.'

  const dominantLabel = CARDINAL_LABEL[dominant[0]].toLowerCase()
  const total = stars.length

  if (recentCount > 0) {
    return `${total} estrelas no firmamento desta semana · ${recentCount} brilhando recente. aglomerado dominante em ${dominantLabel} (${dominant[1]}). atlas observa silencioso e continua mapeando.`
  }
  return `${total} estrelas catalogadas · aglomerado dominante em ${dominantLabel}. atlas aguarda novas observações pra atualizar a leitura.`
}

function formatDate(d: Date): string {
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
  return `${String(d.getDate()).padStart(2, '0')}.${months[d.getMonth()]}.${d.getFullYear()}`
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 28,
    zIndex: 5,
  },
  cardinal: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 5,
  },
  cardinalBullet: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  // v15.4 · star field container · GestureDetector envolve · Animated.View
  // transladado. position absolute fill · captura pan gestures em background.
  // Tap nas estrelas individuais funciona porque activeOffset 8px no Pan.
  starField: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  star: {
    position: 'absolute',
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  reading: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 32,
    paddingTop: 28,
    alignItems: 'center',
    zIndex: 8,
  },
  readingLabel: {
    marginBottom: 12,
  },
  readingText: {
    textAlign: 'center',
    maxWidth: 360,
  },
  readingRule: {
    width: 60,
    height: StyleSheet.hairlineWidth,
    marginTop: 18,
    alignSelf: 'center',
  },
  close: {
    position: 'absolute',
    zIndex: 30,
  },
  // v15.4 · explore hint · sussurro centralizado abaixo do header.
  // Fade-in após entry · fade-out na 1ª interação de pan.
  exploreHint: {
    position: 'absolute',
    top: 158,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 6,
  },
  entryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
})
