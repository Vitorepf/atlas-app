import { type ReactNode } from 'react'
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
}

export function CodexReveal({ children, index = 0, delayMs, style }: Props) {
  const delay = delayMs ?? REVEAL_INITIAL_DELAY + index * REVEAL_STAGGER_STEP
  return (
    <Animated.View
      entering={codexRevealKeyframe.delay(delay)}
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
