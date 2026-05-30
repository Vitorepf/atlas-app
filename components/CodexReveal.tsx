import { useRef, type ReactNode } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, Keyframe } from 'react-native-reanimated'

// =====================================================================
// Atlas Codex Reveal · vocabulary unificada de revelação de conteúdo
// =====================================================================
//
// Aplicado em todas as screens principais (home, inbox, review, ritual,
// memory, engineering, rivals) pra revelar sections após Screen transition
// settling. Apple Books "page settle + content emerging" vocabulary.
//
// 4 design specialists convergiram em:
//   - Custom Keyframe (controle de easing fine-tuned)
//   - opacity 0→1 + translateY 8→0 (whisper magnitudes · não Material 16px)
//   - duration 380ms · easing bezier(0.22, 1, 0.36, 1) Apple Books exhale
//   - stagger step 80ms entre sections (não rushed, não drag)
//   - initial delay 180ms após Screen mount (deixa transição settle primeiro)
//   - top-down sempre · reverence cascade
//
// Total reveal pra screen com 5-7 sections: 700-1000ms · contemplativo.
//
// Usage:
//   <Screen>
//     <CodexReveal index={0}><Masthead /></CodexReveal>
//     <CodexReveal index={1}><MainSection /></CodexReveal>
//     <CodexReveal index={2}><Cards /></CodexReveal>
//   </Screen>
//
// Or with explicit delay:
//   <CodexReveal delayMs={420}>{...}</CodexReveal>
// =====================================================================

const REVEAL_INITIAL_DELAY = 180
const REVEAL_STAGGER_STEP = 80
const REVEAL_DURATION = 380

// Apple Books exhale · easeOutQuint · zero overshoot.
// Match com Screen entering + Expo Router fade · vocabulary única.
const codexRevealKeyframe = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ translateY: 8 }],
  },
  100: {
    opacity: 1,
    transform: [{ translateY: 0 }],
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  },
}).duration(REVEAL_DURATION)

interface Props {
  children: ReactNode
  /** Section index (0-based) · auto stagger via 180 + index*80ms. */
  index?: number
  /** Override delay explícito · ignora index. */
  delayMs?: number
  style?: StyleProp<ViewStyle>
  /**
   * Reveal at most ONCE. Default false (preserva o comportamento atual de todas
   * as screens). Em telas que re-renderizam sob polling (e.g. Loop), `true`
   * garante que a cascade de entrada nunca re-dispare num refetch de fundo: o
   * `entering` do Reanimated já é mount-only, então isso só importa se algo
   * remontar a section — aí o flag (escopo por `revealId`, sobrevive a remount)
   * suprime o replay. Sem `revealId`, o flag é por instância (cobre re-render;
   * um remount real recomeçaria — por isso passe `revealId` em telas críticas).
   */
  animateOnce?: boolean
  /**
   * Identidade estável da section para o guard `animateOnce` (e.g. "loop:vitals").
   * Quando presente, o "já revelou" é lembrado num registry de módulo, então um
   * remount da mesma section não re-anima. Mantenha o conjunto pequeno (uma id
   * por section fixa) — é bounded e nunca é limpo em runtime.
   */
  revealId?: string
}

/** Module registry of sections that have already revealed (animateOnce + revealId). */
const REVEALED_ONCE = new Set<string>()

export function CodexReveal({ children, index = 0, delayMs, style, animateOnce = false, revealId }: Props) {
  const delay = delayMs ?? REVEAL_INITIAL_DELAY + index * REVEAL_STAGGER_STEP

  // Per-instance one-shot (covers re-render churn even without a revealId).
  const revealedRef = useRef(false)

  let suppress = false
  if (animateOnce) {
    if (revealId != null && revealId !== '') {
      suppress = REVEALED_ONCE.has(revealId)
      if (!suppress) REVEALED_ONCE.add(revealId)
    } else {
      suppress = revealedRef.current
    }
    revealedRef.current = true
  }

  return (
    <Animated.View
      entering={suppress ? undefined : codexRevealKeyframe.delay(delay)}
      style={style}
    >
      {children}
    </Animated.View>
  )
}

// Constantes exportadas pra screens que precisam alinhar timings custom
// (e.g., home com tier delays maiores) · mantém vocabulary coerente.
export const ATLAS_REVEAL_CONFIG = {
  initialDelay: REVEAL_INITIAL_DELAY,
  staggerStep: REVEAL_STAGGER_STEP,
  duration: REVEAL_DURATION,
} as const
