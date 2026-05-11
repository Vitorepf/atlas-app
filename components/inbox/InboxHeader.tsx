import { useEffect, useRef, useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Frau } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { failureLabel, type InboxMetrics } from '../../lib/inboxCaptureModels'
import type { InboxMode } from '../../lib/inboxTypes'
import { styles } from './inboxScreenStyles'

export function InboxModeTabs({
  active,
  capturesCount,
  operationalCount,
  operationalCritical,
  onChange,
}: {
  active: InboxMode
  capturesCount: number
  operationalCount: number
  operationalCritical: number
  onChange: (mode: InboxMode) => void
}) {
  const c = usePalette()
  const router = useRouter()
  // v15.1 · Tab underline SLIDE · NYT/Bear signature editorial.
  // FIX BUGS v15.0: slider renderizava com width=0 antes do primeiro layout (flicker)
  // + transform translateX + width combo instável em Reanimated.
  // Solução: anima `left` + `width` direto (JS thread, mais confiável pra layout
  // properties) E só renderiza slider quando layouts[active] já foi medido.
  const [layouts, setLayouts] = useState<{
    captures?: { x: number; width: number }
    operational?: { x: number; width: number }
  }>({})

  // Detecta se layouts pra ambas tabs foram medidos (evita render parcial).
  const layoutsReady = layouts.captures != null && layouts.operational != null

  const underlineX = useSharedValue(0)
  const underlineW = useSharedValue(0)
  // Ref-based · evita ler .value do JS thread (instável em Reanimated).
  // Primeira medição → set direto · subsequent → animação.
  const initializedRef = useRef(false)

  useEffect(() => {
    const target = layouts[active]
    if (!target) return
    if (!initializedRef.current) {
      // Primeira aparição · set direto sem animação · evita "slide from origin (0,0)".
      underlineX.value = target.x
      underlineW.value = target.width
      initializedRef.current = true
    } else {
      // v16 cinema · slider mode tab matches FilterChip vocabulary.
      // Duration 520ms exhale (Apple Books page-turn) · contemplativo.
      underlineX.value = withTiming(target.x, {
        duration: 520,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      })
      underlineW.value = withTiming(target.width, {
        duration: 520,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      })
    }
  }, [active, layouts, underlineX, underlineW])

  const sliderStyle = useAnimatedStyle(() => ({
    left: underlineX.value,
    width: underlineW.value,
  }))

  return (
    <View style={[styles.modeTabs, { borderBottomColor: c.border }]}>
      <InboxModeTab
        label="Capturas"
        active={active === 'captures'}
        onPress={() => onChange('captures')}
        onLongPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
          router.push('/capture?mode=text')
        }}
        onLayoutLabel={(layout) =>
          setLayouts((prev) => ({ ...prev, captures: layout }))
        }
      />
      {/* canon mockup .view-tab-sep · "·" Frau 17 ink3 entre tabs.
          Não consome layout das tabs (não interfere no slider) — só visual. */}
      <Frau size={17} lineHeight={22} color={c.ink3} style={styles.modeTabSep}>
        ·
      </Frau>
      <InboxModeTab
        label="Operacional"
        critical={operationalCritical > 0}
        active={active === 'operational'}
        onPress={() => onChange('operational')}
        onLayoutLabel={(layout) =>
          setLayouts((prev) => ({ ...prev, operational: layout }))
        }
      />
      {/* Underline SLIDER · único pra ambas tabs · só renderiza quando AMBOS
          layouts foram medidos (evita flicker width=0 inicial). Animação `left`
          + `width` direto · timing 380ms easing iOS sheet. */}
      {layoutsReady ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.modeTabSliderUnderline, sliderStyle]}
        />
      ) : null}
    </View>
  )
}

function InboxModeTab({
  label,
  critical,
  active,
  onPress,
  onLongPress,
  onLayoutLabel,
}: {
  label: string
  critical?: boolean
  active: boolean
  onPress: () => void
  onLongPress?: () => void
  onLayoutLabel?: (layout: { x: number; width: number }) => void
}) {
  const c = usePalette()
  // v18.3 canon · Frau 17 ink3 inactive · ink+med active (canon mockup spec).
  // Layout consistente · sem scale animation que distorcia tipografia.
  // Press feedback via opacity apenas · 220ms in / 360ms out.
  const activeProgress = useSharedValue(active ? 1 : 0)
  const pressProgress = useSharedValue(0)

  useEffect(() => {
    activeProgress.value = withTiming(active ? 1 : 0, {
      duration: 480,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
  }, [active, activeProgress])

  const animatedRowStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressProgress.value * 0.35,
  }))

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={220}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
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
      onLayout={(e) => {
        onLayoutLabel?.({
          x: e.nativeEvent.layout.x,
          width: e.nativeEvent.layout.width,
        })
      }}
      style={styles.modeTab}
    >
      {/* v18.3 canon · Frau 17 · inactive ink3 reg / active ink med.
          Sem scale animation · opacity-only feedback no press. */}
      <Animated.View style={[styles.modeTabLabelRow, animatedRowStyle]}>
        <Frau
          size={17}
          lineHeight={22}
          letterSpacing={0}
          weight={active ? 'med' : 'reg'}
          color={active ? c.ink : c.ink3}
          numberOfLines={1}
        >
          {label}
        </Frau>
        {critical ? (
          <View style={[styles.modeTabCriticalDot, { backgroundColor: c.recRed }]} />
        ) : null}
      </Animated.View>
    </Pressable>
  )
}

// v18.3 · canon mockup .va .dateline .date · Frau italic 14 color ink ·
// "1h em média · 2 capturas pendentes". Inclui count quando > 0.
//
// Estados:
// - 0 capturas abertas: "o dia ainda está por dizer" (whisper editorial,
//   substitui silêncio que deixava o masthead órfão sem dateline)
// - 1+ falhas de transcrição: vermelho italic ("1 falha de transcrição")
// - default: "Nh em média · N capturas pendentes" (canon)
export function MetaLine({ metrics }: { metrics: InboxMetrics }) {
  const c = usePalette()

  // Failure tem precedência · usuário precisa saber que algo está quebrado
  if (metrics.failed > 0) {
    return (
      <Frau italic size={14} lineHeight={20} color={c.recRed}>
        {failureLabel(metrics.failed).toLowerCase()}
      </Frau>
    )
  }

  // Inbox vazio · whisper editorial em vez de silêncio órfão
  if (metrics.open === 0) {
    return (
      <Frau italic size={14} lineHeight={20} color={c.ink} letterSpacing={0.4}>
        sem capturas pendentes
      </Frau>
    )
  }

  const captureWord = metrics.open === 1 ? 'captura pendente' : 'capturas pendentes'

  return (
    <Frau italic size={14} lineHeight={20} color={c.ink} letterSpacing={0.4}>
      {`${metrics.averageAgeLabel} em média · ${metrics.open} ${captureWord}`}
    </Frau>
  )
}

// Voz editorial dinâmica · Atlas falando, não posando.
function inboxVoiceLine(metrics: InboxMetrics): string | null {
  if (metrics.open === 0) return 'o dia ainda está por dizer.'
  if (metrics.open === 1) {
    return metrics.firstTimeLabel
      ? `um fragmento, capturado às ${metrics.firstTimeLabel} — ainda por destinar.`
      : 'um fragmento — ainda por destinar.'
  }
  return metrics.firstTimeLabel
    ? `${numberInWords(metrics.open)} fragmentos · o primeiro às ${metrics.firstTimeLabel}.`
    : `${numberInWords(metrics.open)} fragmentos · ainda por destinar.`
}

function numberInWords(n: number): string {
  const map: Record<number, string> = {
    2: 'dois', 3: 'três', 4: 'quatro', 5: 'cinco',
    6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez',
  }
  return map[n] ?? String(n)
}
