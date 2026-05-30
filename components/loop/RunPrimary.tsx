import { StyleSheet, View } from 'react-native'
import { Frau, Mono } from '../../design/Type'
import { usePalette } from '../../design/theme'
import { radii } from '../../design/tokens'
import { PressableSurfaceScale } from '../atlas-ui/PressableScale'
import { StatusDot } from './StatusDot'
import { loopStateWord, loopTone, type LoopState } from './loopTone'

// The local start lifecycle (NOT a loopState). Face A′ lives here: a 202 sets
// 'enqueued'; it auto-clears to 'idle' when a live poll shows lock.held (the
// state machine flips to 'alive' → Face C); a bounded TTL escalates it to
// 'queued_stale' if no worker has picked the job up yet. It NEVER claims running.
export type StartLifecycle = 'idle' | 'enqueued' | 'queued_stale'

interface Props {
  loopState: LoopState
  runState: { paused: boolean; killed: boolean; hasActiveRun: boolean }
  /** GET /loop/areas default_area name; null while loading. */
  areaName: string | null
  areaFocus: string | null
  startState: StartLifecycle
  /** false when /areas|/start-run 404 (net-new backend) → disabled honest bar. */
  startSupported: boolean
  startUnsupportedCode?: string | null
  /** Opens the StartRunSheet (does NOT fire a run). */
  onStartPress: () => void
  /** Smooth-scroll to ACOMPANHAR (ii). */
  onTrackPress: () => void
  /** Deep-link/scroll to CONTROLE (viii). */
  onResumeOrReleasePress: () => void
}

// The SINGLE primary-action bar (first child of Vitals, under the masthead pill).
// A calm full-width bar — NOT a loud filled CTA. A pure function of the single
// loopState + runState + the local start lifecycle; it NEVER offers an action the
// state can't honor. The destructive PAUSE/KILL stay in CONTROLE (viii) so there
// is exactly ONE destructive confirm UI in the app. HONESTY: it renders Face C
// (active) ONLY from a real live lock.held (deriveLoopState → 'alive'), never
// optimistically from a 202.
export function RunPrimary({
  loopState,
  runState,
  areaName,
  areaFocus,
  startState,
  startSupported,
  startUnsupportedCode,
  onStartPress,
  onTrackPress,
  onResumeOrReleasePress,
}: Props) {
  const c = usePalette()
  const tone = loopTone(loopState, c)
  const area = areaName ?? 'área padrão'

  // FACE F — LOADING (first paint): a placeholder that holds layout. No spinner.
  if (loopState === 'loading') {
    return (
      <Bar>
        <Mono size={13} lineHeight={18} color={c.ink3}>
          ·····
        </Mono>
      </Bar>
    )
  }

  // FACE C — ACTIVE (alive/blocked/bug): a status line + jump to ACOMPANHAR.
  if (loopState === 'alive' || loopState === 'blocked' || loopState === 'bug') {
    return (
      <PressableSurfaceScale onPress={onTrackPress} haptic="soft" accessibilityLabel="acompanhar o run">
        <Bar tone={tone}>
          <View style={styles.line}>
            <StatusDot tone={tone} />
            <Mono weight="med" size={13} lineHeight={18} letterSpacing={0.3} color={tone}>
              {loopStateWord(loopState)}
            </Mono>
            <View style={{ flex: 1 }} />
            <Mono size={12} lineHeight={16} letterSpacing={0.4} color={c.bronze}>
              ACOMPANHAR ↓
            </Mono>
          </View>
        </Bar>
      </PressableSurfaceScale>
    )
  }

  // FACE D — PAUSED: RETOMAR deep-links to CONTROLE (the canonical lever).
  if (loopState === 'paused') {
    return (
      <PressableSurfaceScale onPress={onResumeOrReleasePress} haptic="soft" accessibilityLabel="retomar em controle">
        <Bar tone={c.amber}>
          <View style={styles.line}>
            <StatusDot tone={c.amber} />
            <Mono weight="med" size={13} lineHeight={18} letterSpacing={0.3} color={c.amber}>
              RETOMAR
            </Mono>
            <View style={{ flex: 1 }} />
            <Mono size={12} lineHeight={16} color={c.bronze}>
              em Controle ↓
            </Mono>
          </View>
          <Mono size={11} lineHeight={15} color={c.amber} style={styles.caption}>
            honra na próxima fronteira (≤5s)
          </Mono>
        </Bar>
      </PressableSurfaceScale>
    )
  }

  // FACE E — KILLED: no start affordance (structurally cannot start; honest-stop).
  if (loopState === 'killed') {
    return (
      <PressableSurfaceScale onPress={onResumeOrReleasePress} haptic="soft" accessibilityLabel="liberar encerramento em controle">
        <Bar tone={c.recRed}>
          <View style={styles.line}>
            <StatusDot tone={c.recRed} />
            <Mono weight="med" size={13} lineHeight={18} letterSpacing={0.3} color={c.recRed}>
              ENCERRADO
            </Mono>
            <View style={{ flex: 1 }} />
            <Mono size={12} lineHeight={16} color={c.bronze}>
              liberar em Controle ↓
            </Mono>
          </View>
        </Bar>
      </PressableSurfaceScale>
    )
  }

  // ===== IDLE family (loopState === 'idle') =====

  // DEGRADE — start endpoints are net-new and absent (404): honest disabled bar.
  if (!startSupported) {
    return (
      <Bar>
        <View style={styles.line}>
          <StatusDot tone={c.ink3} />
          <Mono weight="med" size={13} lineHeight={18} letterSpacing={0.3} color={c.ink3}>
            INICIAR RUN
          </Mono>
        </View>
        <Frau italic size={13} lineHeight={19} color={c.ink2} style={styles.caption}>
          iniciar run requer ação de backend ainda não publicada
        </Frau>
        {startUnsupportedCode != null && startUnsupportedCode !== '' ? (
          <Mono size={11} lineHeight={15} color={c.ink3}>
            {startUnsupportedCode}
          </Mono>
        ) : null}
      </Bar>
    )
  }

  // FACE A′ — ENQUEUED / STARTING (local transient after a 202; NOT a loopState).
  if (startState === 'enqueued' || startState === 'queued_stale') {
    return (
      <Bar>
        <View style={styles.line}>
          <StatusDot tone={c.ink3} />
          <Mono weight="med" size={13} lineHeight={18} letterSpacing={0.3} color={c.ink3}>
            EM REPOUSO
          </Mono>
          <View style={{ flex: 1 }} />
          <Mono size={12} lineHeight={16} letterSpacing={0.4} color={c.ink3}>
            ENFILEIRADO…
          </Mono>
        </View>
        <Frau italic size={13} lineHeight={19} color={c.ink2} style={styles.caption}>
          {startState === 'queued_stale'
            ? 'ainda na fila — confira se um worker consome `software_company_loop`'
            : 'enfileirado · aguardando worker'}
        </Frau>
      </Bar>
    )
  }

  // FACE A — IDLE: the start affordance. Tapping opens the sheet (does NOT fire).
  return (
    <PressableSurfaceScale onPress={onStartPress} haptic="soft" accessibilityLabel="iniciar run">
      <Bar>
        <View style={styles.line}>
          <Mono weight="med" size={13} lineHeight={18} letterSpacing={0.4} color={c.bronze}>
            INICIAR RUN
          </Mono>
          <View style={{ flex: 1 }} />
          <Mono size={12} lineHeight={16} color={c.ink3}>
            {`área: ${area}`}
          </Mono>
        </View>
        <Frau italic size={13} lineHeight={19} color={c.ink2} style={styles.caption}>
          Iniciar apenas enfileira. O loop começa quando um worker o consome.
        </Frau>
      </Bar>
    </PressableSurfaceScale>
  )
}

function Bar({ children, tone }: { children: React.ReactNode; tone?: string }) {
  const c = usePalette()
  return (
    <View
      style={[
        styles.bar,
        { borderColor: tone ?? c.bronzeBorder, backgroundColor: c.bg },
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    marginHorizontal: 32,
    marginBottom: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  caption: {
    marginTop: 2,
  },
})
